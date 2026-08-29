import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { generateOilDistribution3D, OIL_FIELD_UNITS } from "@/lib/oilDistribution";
import { generateArtifactDistribution3D, artifactKey } from "@/lib/artifactDistribution";
import { createDemonBounty } from "@/lib/oilDemon";
import { logTimeline } from "@/lib/oilTimeline";
import { sendPlayerAlert } from "@/lib/oilAlerts";
import {
  PASSIVE_DRILLS, MAX_DEPTH, depthCapFor, seasonClock, strikeTargetMs,
} from "@/lib/oilStrikeClock";
import { chargesCapFor, resolvePendingDecision, assayAlertBody } from "@/lib/oilLoopV2";
import { applyV2Resolution } from "@/lib/oilLoopV2Server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Continuous-pump strike loop ───────────────────────────────────────────────
// Runs on a short cadence (every 5 min via the Firebase `oilStrikeTick`
// scheduled function, or any cron that hits this route with the CRON_SECRET).
//
// Fill-the-season pacing (docs/oil-game.md → "TIMING FRAMEWORK"). When a season
// clock is configured (gameStartDate + seasonLengthDays), each armed rig spreads
// its strikes across the WHOLE season: avg interval = season ÷ depthCap, so a
// depth-10 rig strikes ~1/day and a depth-20 rig ~2/day, and every rig finishes
// near the buzzer (no idle, no staggered finishes). Within each interval window
// the strike fires at a random, unguessable moment — the "did my rig hit?"
// engagement engine. Without a season clock it falls back to the legacy
// once-per-UTC-day, random-minute-of-day cadence.
//
// The strike is never random in OUTCOME — the oil at each layer is fixed by the
// deterministic block-hash distribution. Only the reveal TIME is randomized.
//
// Model:
//   • depthCap = min(PASSIVE_DRILLS + bonusDrills, MAX_DEPTH) — bonus buys both
//     deeper layers AND a shorter interval (more frequent strikes).
//   • A strike drills the cell one layer deeper (cap at the per-rig depthCap).
//   • Lump-sum: the newly drilled layer's oil is added to the rig's `tankOil`.
//   • Uncapped tank: `tankOil` grows freely; banking is a separate action.
//   • Idempotent: the interval target + `lastStrikeAt` guard against double-
//     striking within a window (legacy mode: `lastStrikeDate`).
//   • Buzzer: at season end the tick flips gamePhase→ended, auto-banks every
//     tank, and publishes the fairness reveal.

const DEFAULT_DEPTH_Z = 20;

// Firestore Timestamp → ms (the strike clock works in plain ms; see oilStrikeClock).
const tsMillis = (ts) => (ts && typeof ts.toMillis === "function" ? ts.toMillis() : null);

// ── Buried-artifact layer (docs/artifact-expansion.md) ───────────────────────
// Generated from the SAME committed seed as the oil, on separate RNG streams,
// so both derive deterministically per tick with no extra storage. Settings
// knobs let an admin tune a season PRE-ANCHOR only — like the oil radius band,
// changing them after commit remaps every seed.
function generateArtifacts(settings, seed, gridSize, depthZ, grid, hellPockets) {
  return generateArtifactDistribution3D({
    blockHash: seed,
    gridX: gridSize,
    gridY: gridSize,
    depthZ,
    oilGrid: grid,
    hellPockets,
    perColumn: settings.artifactPerColumn ?? 3,
    relicFraction: settings.artifactRelicFraction ?? 0.15,
    cursedFraction: settings.artifactCursedFraction ?? 0.25,
    mapCopies: settings.artifactMapCopies ?? 2,
    shallowCap: PASSIVE_DRILLS, // ≥1 artifact reachable on a zero-bonus rig
  });
}

// Flat inventory key on oilDrills.artifacts — duplicates increment (dupes
// level the item, they're never waste). Underscores, not dots/colons:
// Firestore treats dots in merge keys as path separators.
function artifactItemKey(a) {
  if (a.type === "amber") return `amber_${a.specimenId}_${a.fragmentIndex}`;
  if (a.type === "relic") return `relic_${a.relicId}`;
  if (a.type === "map") return `map_${a.pieceIndex}`;
  return "cache";
}

// Payload persisted on the plot's revealedArtifacts map + lastStrikeArtifact.
// Coords stripped — the plot doc IS the coordinate; keep reveals coordinate-free
// everywhere else (same rule as the timeline).
function publicArtifact(a) {
  const { x, y, z, ...payload } = a;
  return payload;
}

// End-of-season buzzer: flip the phase once (txn-guarded so concurrent ticks
// don't double-run), auto-bank every rig's un-banked tank so nobody loses oil to
// timing, then publish the fairness reveal (mirrors oil-settings' gameEnded path).
async function endSeason(db, settings = {}) {
  const settingsRef = db.collection("oilGame").doc("settings");
  const won = await db.runTransaction(async (t) => {
    const s = (await t.get(settingsRef)).data() || {};
    if (s.gamePhase !== "active") return false;
    t.set(settingsRef, {
      gamePhase: "ended",
      gameEnded: true,
      seasonEndedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  });
  if (!won) return { ok: true, skipped: "already_ended" };

  // Sweep tankOil → totalCollected (only un-banked oil; idempotent — a re-run sees 0).
  let swept = 0, sweptOil = 0;
  if (settings.loopV2 === true) {
    // v2 buzzer: the tank is a DECISION BUFFER, not a balance — never blind-
    // sweep it. Resolve every rig's final pending by its standing order
    // (charges permitting); unspent charges are simply wasted (hoarding has a
    // cost). Regenerate the artifact map once for inclusion grants.
    const secretSnap = await db.collection("oilSecret").doc("seed").get();
    const seed = (secretSnap.exists && secretSnap.data().seed) || settings.blockHash || null;
    const gridSize = settings.gridSize || 10;
    const depthZ = settings.depthZ || DEFAULT_DEPTH_Z;
    let artifactsByKey = {};
    if (seed) {
      const dist = generateOilDistribution3D({
        blockHash: seed, gridX: gridSize, gridY: gridSize, depthZ,
        totalOilBudget: OIL_FIELD_UNITS,
        numberOfDeposits: settings.numberOfDeposits || 5,
        numberOfHellPockets: settings.numberOfHellPockets ?? null,
      });
      artifactsByKey = generateArtifacts(settings, seed, gridSize, depthZ, dist.grid, dist.hellPockets).byKey;
    }
    const communityRef = db.collection("oilGame").doc("communityStorage");
    const drillsSnapV2 = await db.collection("oilDrills").get();
    for (const d of drillsSnapV2.docs) {
      const data = d.data();
      if (!data.pending || typeof data.pending.layer !== "number" || data.col == null) continue;
      const plotRef = db.collection("oilPlots").doc(`${data.col}_${data.row}`);
      await db.runTransaction(async (t) => {
        const drillNow = (await t.get(d.ref)).data() || {};
        const p = drillNow.pending;
        if (!p || typeof p.layer !== "number") return; // already resolved
        const chargesRemaining = Math.max(0, chargesCapFor(drillNow, settings, depthZ) - (drillNow.chargesSpent || 0));
        const decision = resolvePendingDecision({
          pending: p, threshold: Number(drillNow.threshold) || 0, chargesRemaining, depthZ,
          autopilot: drillNow.autopilot === true,
        });
        const inclArt = p.hasInclusion
          ? (artifactsByKey[artifactKey(data.col, data.row, p.layer)] || null) : null;
        applyV2Resolution(t, {
          FieldValue, drillRef: d.ref, plotRef, communityRef,
          drillNow, col: data.col, row: data.row, pending: p, decision, inclusionArtifact: inclArt,
        });
        t.set(d.ref, { armed: false }, { merge: true });
      });
      swept++;
    }
  } else {
    const drillsSnap = await db.collection("oilDrills").get();
    for (const d of drillsSnap.docs) {
      const tank = d.data().tankOil || 0;
      if (tank > 0) {
        await d.ref.set({
          totalCollected: FieldValue.increment(tank),
          tankOil: 0,
          armed: false,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        swept++; sweptOil += tank;
      }
    }
  }

  // Provable-fairness reveal (same as oil-settings on gameEnded:true).
  let revealed = false;
  try {
    const sd = (await db.collection("oilSecret").doc("seed").get()).data() || {};
    if (sd.serverSecret) {
      await settingsRef.set({
        seedReveal: sd.serverSecret,
        finalSeedReveal: sd.seed || null,
        revealedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      revealed = true;
    } else if (sd.seed) {
      await settingsRef.set({ seedReveal: sd.seed, revealedAt: FieldValue.serverTimestamp() }, { merge: true });
      revealed = true;
    }
  } catch (err) {
    console.error("[oil-strike-tick] season-end reveal failed:", err.message);
  }

  await logTimeline(db, { type: "system", detail: "The season has ended" });
  if (revealed) {
    await logTimeline(db, { type: "system", detail: "seed revealed — anyone can now verify the entire map" });
  }

  return { ok: true, ended: true, swept, sweptOil };
}

// Deterministic, unpredictable strike minute-of-day [0,1439] per (rig, day).
// Stable across ticks with no extra Firestore writes, so a missed/retried tick
// is safe. Minute granularity (not hour) lets a strike land at any time of day.
function strikeMinuteFor(userId, dateStr) {
  const s = `${userId}:${dateStr}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % 1440;
}

// UTC "YYYY-MM-DD" — match the date basis the rest of the game uses.
function utcDateStr(d) {
  return d.toISOString().slice(0, 10);
}

// Player alerts now fan out through lib/oilAlerts (Telegram + web push).

async function runTick({ force = false, deep = 1, targetCol = null, targetRow = null } = {}) {
  const db = getAdminDb();
  // Targeted admin strike: drill only the rig sitting on this cell (the survey-map
  // selection). Other rigs are passed over silently — not counted as skips.
  const targeted = targetCol != null && targetRow != null;

  const settingsSnap = await db.collection("oilGame").doc("settings").get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  if (settings.gamePhase !== "active") {
    return { ok: true, skipped: "phase_not_active", phase: settings.gamePhase || null };
  }

  // End-of-season buzzer — only when a season clock is configured. Flips the
  // phase, auto-banks every tank, and reveals the seed. Runs before any drilling.
  const season = seasonClock(settings);
  if (season && Date.now() >= season.endMs) {
    return await endSeason(db, settings);
  }

  // Seed lives in the server-only secret doc; fall back to the legacy public
  // `blockHash` for pre-migration games.
  const secretSnap = await db.collection("oilSecret").doc("seed").get();
  const seed = (secretSnap.exists && secretSnap.data().seed) || settings.blockHash;
  if (!seed) {
    return { ok: true, skipped: "no_seed" };
  }

  // Respect the global single-demon blockade — drilling halts while a demon is loose.
  const blockadeSnap = await db.collection("oilGame").doc("demonBlockade").get();
  if (blockadeSnap.exists && blockadeSnap.data().active) {
    return { ok: true, skipped: "demon_blockade" };
  }

  // v2 EXTRACT-OR-PASS (docs/oil-game.md → "v2 LOOP" + "Build order" phase 2).
  // Flag-gated per dev season from the admin panel: settings.loopV2 === true.
  // In v2 the bore reveals EVERY layer over the season (depth is no longer
  // gated by bonuses); charges decide what you keep. v1 path untouched.
  const loopV2 = settings.loopV2 === true;

  const gridSize = settings.gridSize || 10;
  const depthZ = settings.depthZ || DEFAULT_DEPTH_Z;
  const { grid, hellPockets, maxOil } = generateOilDistribution3D({
    blockHash: seed,
    gridX: gridSize,
    gridY: gridSize,
    depthZ,
    totalOilBudget: OIL_FIELD_UNITS, // field resolution, not the $ prize
    numberOfDeposits: settings.numberOfDeposits || 5,
    numberOfHellPockets: settings.numberOfHellPockets ?? null, // null ⇒ derive from grid
  });
  const hellSet = new Set((hellPockets || []).map((p) => `${p.x}_${p.y}_${p.z}`));
  const { byKey: artifactsByKey } = generateArtifacts(settings, seed, gridSize, depthZ, grid, hellPockets);
  // Strike tiers, relative to the field's single richest cell (self-calibrating
  // per season). gusher ≥ 50%, motherlode ≥ 85%. Drives the feed label AND the
  // scaled 3D response (gusherEvents.tier) in step 2.
  const gusherThreshold = (maxOil || 0) * 0.5;
  const motherlodeThreshold = (maxOil || 0) * 0.85;
  const tierFor = (oil) => oil <= 0 ? "strike"
    : (motherlodeThreshold > 0 && oil >= motherlodeThreshold) ? "motherlode"
    : (gusherThreshold > 0 && oil >= gusherThreshold) ? "gusher"
    : "strike";

  const now = new Date();
  const today = utcDateStr(now);
  const hour = now.getUTCHours();
  const nowMinutes = hour * 60 + now.getUTCMinutes();

  const drillsSnap = await db.collection("oilDrills").get();

  const summary = { struck: 0, skipped: 0, depleted: 0, errors: 0, demonsSummoned: 0, artifactsFound: 0, cursesTriggered: 0, skipReasons: {} };
  // Tally a skip with a human-readable reason so the admin FORCE STRIKE toast can
  // say *why* nothing struck (e.g. every rig lost its plot to a board reset).
  const skip = (reason) => { summary.skipped++; summary.skipReasons[reason] = (summary.skipReasons[reason] || 0) + 1; };
  const strikes = [];
  // Once a hell pocket summons a demon, the blockade halts drilling — stop
  // striking the remaining rigs this tick so we don't drill through the halt.
  let summonedThisTick = false;
  // Admin overrides bypass the once-per-day guard: deep-drill (deep > 1) so a
  // single call can drill multiple layers, and any explicit `force` so an admin
  // can repeatedly force-strike for testing even if the rig already struck today.
  // Normal cron ticks (force=false, deep=1) keep the once-per-day guard.
  const ignoreDayGuard = deep > 1 || force;

  for (const docSnap of drillsSnap.docs) {
    const drill = docSnap.data();
    const userId = docSnap.id;
    const { col, row } = drill;

    // Targeted mode: ignore every rig except the one on the selected cell.
    if (targeted && (col !== targetCol || row !== targetRow)) continue;

    if (summonedThisTick) { skip("demon_blockade"); continue; }
    // Must hold a claimed plot and be armed (admin hard-disable via armed:false).
    if (col == null || row == null) { skip("no_plot"); continue; }
    if (drill.armed === false) { skip("disarmed"); continue; }

    const cellKey = `${col}_${row}`;
    const plotRef = db.collection("oilPlots").doc(cellKey);
    const drillRef = db.collection("oilDrills").doc(userId);

    // Per-rig depth ceiling (base + earned bonus). Read the cell's current depth
    // up front — it drives both the depletion check and the interval pacing.
    // Admin force/deep drilling bypasses the cap (drill the full field for testing).
    // v2: the bore is never gated — it reveals the whole field; charges gate keeping.
    const depthCap = loopV2 ? depthZ : depthCapFor(drill, depthZ);
    const effectiveCap = (loopV2 || ignoreDayGuard) ? depthZ : depthCap;
    const gateDepth = ((await plotRef.get()).data()?.drillDay) || 0;
    if (gateDepth >= effectiveCap) {
      // Capped for THIS player (cells persist across owners; earning bonus later
      // raises the cap and the rig revives). Cache rigDepleted for the UI; don't
      // disarm, so a bonus grant doesn't need to re-arm it.
      if (!drill.rigDepleted) {
        await drillRef.set({ rigDepleted: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
      summary.depleted++; continue;
    }

    // Time gate — interval-windowed when a season is configured, else legacy daily.
    let gateWindowMs = null;
    if (season) {
      const { windowStartMs, targetMs } = strikeTargetMs(season, tsMillis(drill.lastStrikeAt), gateDepth, depthCap, userId);
      gateWindowMs = windowStartMs;
      if (!force && Date.now() < targetMs) { skip("not_yet"); continue; }
    } else {
      if (!ignoreDayGuard && drill.lastStrikeDate === today) { skip("struck_today"); continue; }
      if (!force && nowMinutes < strikeMinuteFor(userId, today)) { skip("not_yet"); continue; }
    }

    try {
      // deep > 1 (admin) drills several layers in one call; deep = 1 is the normal tick.
      for (let i = 0; i < deep; i++) {
        const outcome = await db.runTransaction(async (t) => {
          const plotSnap = await t.get(plotRef);
          const drillNow = (await t.get(drillRef)).data() || drill;

          // Re-check the gate inside the txn (idempotent under concurrent ticks).
          // Season mode: bail if another tick already advanced lastStrikeAt past
          // the window we gated on. Legacy: the once-per-day guard.
          if (!ignoreDayGuard) {
            if (season) {
              const nowLastMs = tsMillis(drillNow.lastStrikeAt) ?? season.startMs;
              if (nowLastMs !== gateWindowMs) return { status: "already_struck" };
            } else if (drillNow.lastStrikeDate === today) {
              return { status: "already_struck" };
            }
          }

          const currentDepth = (plotSnap.exists ? plotSnap.data().drillDay : 0) || 0;
          if (currentDepth >= effectiveCap) {
            // Capped for this player — mark depleted. Don't disarm: a later bonus
            // raises depthCap and the rig revives on the next tick.
            t.set(drillRef, { rigDepleted: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
            return { status: "depleted" };
          }

          if (loopV2) {
            // ── v2 EXTRACT-OR-PASS: resolve the prior pending layer by the
            // standing order, then reveal the next layer as the NEW pending.
            // Extraction = banking (applyV2Resolution writes totalCollected +
            // the community total in this txn). Hell resolves immediately —
            // a tonic caps the breach (v2 tonic semantics), else the demon.
            const communityRef = db.collection("oilGame").doc("communityStorage");
            const threshold = Number(drillNow.threshold) || 0;
            const chargesCap = chargesCapFor(drillNow, settings, depthZ);
            let chargesRemaining = Math.max(0, chargesCap - (drillNow.chargesSpent || 0));
            let resolved = null;
            const pending = drillNow.pending;
            if (pending && typeof pending.layer === "number") {
              const decision = resolvePendingDecision({ pending, threshold, chargesRemaining, depthZ, autopilot: drillNow.autopilot === true });
              const inclArt = pending.hasInclusion
                ? (artifactsByKey[artifactKey(col, row, pending.layer)] || null) : null;
              resolved = applyV2Resolution(t, {
                FieldValue, drillRef, plotRef, communityRef,
                drillNow, col, row, pending, decision, inclusionArtifact: inclArt,
              });
              if (decision === "extract") chargesRemaining -= 1;
            }

            const li = currentDepth;
            const isHellL = hellSet.has(`${col}_${row}_${li}`);
            const v2oil = grid?.[col]?.[row]?.[li] ?? 0;
            const v2art = artifactsByKey[artifactKey(col, row, li)] || null;
            const plotUpdate = { col, row, drillDay: li + 1, lastStrikeAt: FieldValue.serverTimestamp() };
            const drillUpdate = {
              userId,
              lastStrikeDate: today,
              lastStrikeAt: FieldValue.serverTimestamp(),
              lastStrikeDepth: li + 1,
              rigDepleted: false,
              updatedAt: FieldValue.serverTimestamp(),
            };
            let tonicCapped = false;
            if (isHellL) {
              plotUpdate.hellLayers = { [li]: true };
              plotUpdate.revealed = { [li]: 0 };
              drillUpdate.pending = null;
              drillUpdate.tankOil = 0;
              drillUpdate.lastStrikeOil = 0;
              drillUpdate.lastStrikeHell = true;
              if ((drillNow.supplies?.tonic || 0) > 0) {
                tonicCapped = true;
                plotUpdate.hellCapped = { [li]: true };
                drillUpdate.supplies = { tonic: FieldValue.increment(-1) };
                drillUpdate.tonicsUsed = FieldValue.increment(1);
                drillUpdate.lastTonicAt = FieldValue.serverTimestamp();
              }
            } else {
              plotUpdate.revealed = { [li]: v2oil };
              // §Multi-element core: flag the inclusion, keep its identity
              // hidden until extraction (the anti-lottery guard).
              if (v2art) plotUpdate.inclusionFlags = { [li]: true };
              drillUpdate.pending = { layer: li, oil: v2oil, hasInclusion: !!v2art, revealedAt: Date.now() };
              drillUpdate.tankOil = v2oil; // decision buffer: full = a decision is waiting
              drillUpdate.lastStrikeOil = v2oil;
              drillUpdate.lastStrikeHell = false;
            }
            t.set(plotRef, plotUpdate, { merge: true });
            t.set(drillRef, drillUpdate, { merge: true });
            return {
              status: "struck", v2: true, oil: v2oil, depth: li + 1,
              isHell: isHellL && !tonicCapped, tonicCapped,
              resolved, hasInclusion: !!v2art,
              threshold, chargesRemaining,
              username: drillNow.username || null,
              newTank: v2oil,
            };
          }

          // The layers this strike drills: one, or two when the rig has a
          // TONIC (a DAILY TICKET prize) and the cap allows a second. Each
          // layer reveals its own oil / hell / artifact exactly as a single
          // strike would; a hell pocket on the first layer stops the second.
          const tonicReady = (drillNow.supplies?.tonic || 0) > 0 && currentDepth + 1 < effectiveCap;
          const layers = [];
          for (let k = 0; k < (tonicReady ? 2 : 1); k++) {
            const li = currentDepth + k; // layers 0..drillDay-1 are revealed
            const isHellK = hellSet.has(`${col}_${row}_${li}`);
            layers.push({
              layerIndex: li,
              oil: grid?.[col]?.[row]?.[li] ?? 0,
              isHell: isHellK,
              // Buried artifact at this layer (never co-located with hell — the
              // generator avoids those cells, so hell and artifact paths are exclusive).
              artifact: artifactsByKey[artifactKey(col, row, li)] || null,
            });
            if (isHellK) break;
          }
          const tonicUsed = layers.length === 2;
          const newDepth = currentDepth + layers.length;
          const oilAtLayer = layers.reduce((s, l) => s + l.oil, 0);
          const isHell = layers.some((l) => l.isHell);
          const artifact = layers.find((l) => l.artifact)?.artifact || null;
          const revealed = Object.fromEntries(layers.map((l) => [l.layerIndex, l.oil]));
          const hellLayers = Object.fromEntries(layers.filter((l) => l.isHell).map((l) => [l.layerIndex, true]));
          const revealedArtifacts = Object.fromEntries(layers.filter((l) => l.artifact).map((l) => [l.layerIndex, publicArtifact(l.artifact)]));
          const artifactInventory = {};
          for (const l of layers) if (l.artifact) { const k = artifactItemKey(l.artifact); artifactInventory[k] = FieldValue.increment(1); }

          t.set(plotRef, {
            col, row,
            drillDay: newDepth,
            lastStrikeAt: FieldValue.serverTimestamp(),
            // Server-authoritative reveal: persist the discovered oil for this
            // layer so the client renders the field from Firestore, never by
            // recomputing the secret seed. merge:true deep-merges the map, so
            // previously revealed layers are preserved.
            revealed,
            ...(Object.keys(hellLayers).length ? { hellLayers } : {}),
            ...(Object.keys(revealedArtifacts).length ? { revealedArtifacts } : {}),
          }, { merge: true });

          t.set(drillRef, {
            userId,
            tankOil: FieldValue.increment(oilAtLayer),
            lastStrikeDate: today,
            lastStrikeAt: FieldValue.serverTimestamp(),
            lastStrikeOil: oilAtLayer,
            lastStrikeDepth: newDepth,
            lastStrikeHell: isHell,
            lastStrikeArtifact: artifact ? publicArtifact(artifact) : null,
            // Inventory: flat item-key → count. Dupes increment (item leveling);
            // artifactFinds is the running Museum tally for recap/leaderboard.
            ...(Object.keys(artifactInventory).length ? {
              artifacts: artifactInventory,
              artifactFinds: FieldValue.increment(Object.keys(artifactInventory).length),
            } : {}),
            // The tonic is spent on the strike it doubled.
            ...(tonicUsed ? { supplies: { tonic: FieldValue.increment(-1) }, tonicsUsed: FieldValue.increment(1), lastTonicAt: FieldValue.serverTimestamp() } : {}),
            rigDepleted: false, // a successful strike clears any stale depleted cache
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          return { status: "struck", oil: oilAtLayer, depth: newDepth, isHell, artifact, tonicUsed, username: drillNow.username || null, newTank: (drillNow.tankOil || 0) + oilAtLayer };
        });

        if (outcome.status === "struck") {
          summary.struck++;
          strikes.push({ userId, col, row, ...outcome });
          if (outcome.tonicUsed) {
            summary.tonicsUsed = (summary.tonicsUsed || 0) + 1;
            await logTimeline(db, { type: "tonic", username: outcome.username, userId, detail: "two layers in one strike" });
          }

          if (outcome.isHell) {
            // Hell pocket → summon the demon via the shared creator (identical to the
            // player path). unbankedOil = the rig's post-strike tank; createDemonBounty
            // drains it as the cost of unleashing hell.
            try {
              const demon = await createDemonBounty(db, {
                userId,
                username: outcome.username,
                col, row,
                unbankedOil: outcome.newTank,
              });
              if (demon.ok) {
                summonedThisTick = true;
                summary.demonsSummoned++;
                await logTimeline(db, { type: "hell", username: outcome.username, userId, detail: "the field froze" });
                await sendPlayerAlert(db, userId, {
                  title: "🔥 YOUR RIG BREACHED A HELL POCKET!",
                  body: "A demon is loose on the field — your unbanked tank fueled the bounty. Drilling is halted until it's banished.",
                  tag: "hmpc-hell",
                  telegramHtml: `🔥 <b>YOUR RIG BREACHED A HELL POCKET!</b>\nA demon is loose on the field — your unbanked tank fueled the bounty. Drilling is halted until it's banished.`,
                });
              }
            } catch (err) {
              console.error(`[oil-strike-tick] demon summon failed for ${userId}:`, err.message);
            }
            break; // hell halts drilling (blockade) — end this rig's run
          }

          // Normal strike: reuse gusherEvents so the existing 3D strike visual fires.
          if (outcome.oil > 0) {
            const strikeTier = tierFor(outcome.oil); // strike | gusher | motherlode
            await db.collection("gusherEvents").add({
              col, row, userId,
              username: outcome.username,
              oilAmount: outcome.oil,
              depth: outcome.depth,
              tier: strikeTier, // drives the size-scaled 3D response (step 2)
              createdAt: FieldValue.serverTimestamp(),
              status: "active",
            });
            // FIELD ACTIVITY feed (who/what/when only — no amount, no coords).
            await logTimeline(db, { type: strikeTier, username: outcome.username, userId });
          }

          // Buried artifact side effects (docs/artifact-expansion.md). Timeline
          // stays coordinate-free like every other event type.
          const art = outcome.artifact;
          if (art) {
            summary.artifactsFound++;
            if (art.type === "relic" && art.cursed) {
              summary.cursesTriggered++;
              // Curse record: phase-4's tick-driven spread/cleanse acts on this.
              // Coords included (like demonBounty) — the curse is field-visible.
              await db.collection("oilCurses").add({
                status: "active",
                col, row,
                layerIndex: outcome.depth - 1,
                relicId: art.relicId,
                summonerId: userId,
                summonerUsername: outcome.username,
                createdAt: FieldValue.serverTimestamp(),
                // Spreads to a neighboring plot after 24h unless cleansed.
                spreadAtMs: Date.now() + 24 * 3600 * 1000,
              });
              await logTimeline(db, { type: "curse", username: outcome.username, userId, detail: "disturbed a cursed burial ground" });
            } else if (art.type === "cache") {
              // Payout split (community pool) lands in phase 4 — the find is
              // recorded and celebrated now.
              await logTimeline(db, { type: "cache_found", username: outcome.username, userId, detail: "unearthed the outlaw cache" });
            } else {
              const findDetail = art.type === "amber" ? "unearthed an amber shard"
                : art.type === "map" ? "dug up a torn map fragment"
                : "unearthed a relic";
              await logTimeline(db, { type: "artifact_find", username: outcome.username, userId, detail: findDetail });
            }
          }

          // Best-effort retention hook — skipped during deep admin drills to avoid spam.
          if (deep === 1 && outcome.v2) {
            // v2 alerts under the Copy rule: cost model explicit, threshold
            // phrased as the crew's standing order — never a bare number.
            const resolvedLine = outcome.resolved
              ? (outcome.resolved.decision === "extract"
                ? `\n✔ L${outcome.resolved.layer + 1} EXTRACTED — ${Math.round(outcome.resolved.oil).toLocaleString()} BTR banked${outcome.resolved.inclusion ? " · inclusion recovered" : ""}.`
                : `\n↷ L${outcome.resolved.layer + 1} passed${outcome.resolved.oil > 0 ? " — open to neighbours" : " (dry)"}.`)
              : "";
            if (outcome.tonicCapped) {
              await logTimeline(db, { type: "tonic", username: outcome.username, userId, detail: "capped a hell pocket" });
              await sendPlayerAlert(db, userId, {
                title: "🧪 TONIC CAPPED A HELL POCKET",
                body: `Plot (${col + 1}, ${row + 1}) L${outcome.depth}: the breach hit hell — your tonic sealed it. No demon, no halt.${resolvedLine}`,
                tag: "hmpc-strike",
                telegramHtml: `🧪 <b>TONIC CAPPED A HELL POCKET</b>\nPlot (${col + 1}, ${row + 1}) L${outcome.depth}: the breach hit hell — your tonic sealed it. No demon, no halt.${resolvedLine}`,
              });
            } else if (!outcome.isHell) {
              const body = assayAlertBody({
                col, row, layer: outcome.depth - 1, oil: outcome.oil,
                threshold: outcome.threshold, chargesRemaining: outcome.chargesRemaining,
                hasInclusion: outcome.hasInclusion,
              }) + resolvedLine;
              await sendPlayerAlert(db, userId, {
                title: "⛏ CORE ASSAY — LAYER " + outcome.depth,
                body,
                tag: "hmpc-strike",
                // Dry, no-inclusion assays go Telegram-only, same signal-value
                // rule as v1 dry layers.
                ...(outcome.oil <= 0 && !outcome.hasInclusion ? { channels: { telegram: true, push: false } } : {}),
                telegramHtml: `⛏ <b>CORE ASSAY — LAYER ${outcome.depth}</b>\n${body}`,
              });
            }
            // Uncapped hell is alerted by the demon path above, as in v1.
          } else if (deep === 1) {
            // One artifact line, appended to a strike push or standing alone.
            const artLine = !art ? ""
              : art.type === "amber" ? `🦴 Amber shard unearthed — ${art.specimenId.toUpperCase()} fragment ${art.fragmentIndex + 1}/6.`
              : art.type === "map" ? `🗺 Torn map fragment ${art.pieceIndex + 1} — someone out there holds the rest.`
              : art.type === "cache" ? `💰 THE OUTLAW CACHE. You found it.`
              : art.cursed ? `⚰️ ${art.relicId.toUpperCase()} relic — the ground here was a grave. Something stirred.`
              : `🗿 ${art.relicId.toUpperCase()} relic recovered for the Museum.`;
            if (outcome.oil > 0) {
              // Fixed-rate ≈$ tag — the dollar figure is what makes the ping land.
              const usdVal = (outcome.oil * (settings.totalOilBudget || 500)) / OIL_FIELD_UNITS;
              const usdTag = usdVal >= 0.005 ? ` (≈ $${usdVal.toFixed(2)})` : "";
              const artSuffix = artLine ? `\n${artLine}` : "";
              await sendPlayerAlert(db, userId, {
                title: "⛽ YOUR RIG STRUCK!",
                body: `Plot (${col + 1}, ${row + 1}) hit ${outcome.oil.toLocaleString()} BTR${usdTag} at depth ${outcome.depth}. Bank it before a dino comes sniffing.${artSuffix}`,
                tag: "hmpc-strike",
                telegramHtml: `⛽ <b>YOUR RIG STRUCK!</b>\nPlot (${col + 1}, ${row + 1}) hit ${outcome.oil.toLocaleString()} BTR${usdTag} at depth ${outcome.depth}.\nBank it before a dino comes sniffing.${artSuffix}`,
              });
            } else if (art) {
              // A dry layer with an artifact is a FIND, not a miss — it gets a
              // real push. This is the "dry strikes stop being silent" beat.
              await sendPlayerAlert(db, userId, {
                title: art.type === "cache" ? "💰 OUTLAW CACHE FOUND!" : "🏺 ARTIFACT UNEARTHED!",
                body: `Depth ${outcome.depth} at plot (${col + 1}, ${row + 1}): no Betroleum… but the drill hit something else.\n${artLine}`,
                tag: "hmpc-artifact",
                telegramHtml: `🏺 <b>ARTIFACT UNEARTHED!</b>\nDepth ${outcome.depth} at plot (${col + 1}, ${row + 1}) — ${artLine}`,
              });
            } else {
              // Truly empty layers go to Telegram only — push stays reserved
              // for paydirt so the notification keeps its signal value.
              await sendPlayerAlert(db, userId, {
                title: "🪨 Dry layer",
                body: `Your rig drilled to depth ${outcome.depth} at plot (${col + 1}, ${row + 1}) — dry layer this time.`,
                channels: { telegram: true, push: false },
                telegramHtml: `🪨 Your rig drilled to depth ${outcome.depth} at plot (${col + 1}, ${row + 1}) — dry layer this time.`,
              });
            }
          }
        } else if (outcome.status === "depleted") {
          summary.depleted++;
          break;
        } else {
          skip("already_struck");
          break;
        }
      }
    } catch (err) {
      summary.errors++;
      console.error(`[oil-strike-tick] strike failed for ${userId}:`, err.message);
    }
  }

  return { ok: true, date: today, hour, ...summary, strikes };
}

// Admin scout: reveal where the oil is (no writes) so a tester can aim a rig.
// Returns the richest columns by total oil, with both 0-based coords and the
// on-screen (col+1, row+1) label.
async function scoutOil() {
  const db = getAdminDb();
  const settingsSnap = await db.collection("oilGame").doc("settings").get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const secretSnap = await db.collection("oilSecret").doc("seed").get();
  const seed = (secretSnap.exists && secretSnap.data().seed) || settings.blockHash;
  if (!seed) return { ok: false, error: "no_seed" };

  const gridSize = settings.gridSize || 10;
  const depthZ = settings.depthZ || DEFAULT_DEPTH_Z;
  const { grid, hellPockets } = generateOilDistribution3D({
    blockHash: seed,
    gridX: gridSize,
    gridY: gridSize,
    depthZ,
    totalOilBudget: OIL_FIELD_UNITS, // field resolution, not the $ prize
    numberOfDeposits: settings.numberOfDeposits || 5,
    numberOfHellPockets: settings.numberOfHellPockets ?? null, // null ⇒ derive from grid
  });

  const cells = [];
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      let total = 0, best = 0, bestDepth = -1;
      for (let z = 0; z < depthZ; z++) {
        const v = grid?.[x]?.[y]?.[z] ?? 0;
        total += v;
        if (v > best) { best = v; bestDepth = z; }
      }
      if (total > 0) {
        cells.push({
          col: x, row: y,
          label: `(${x + 1}, ${y + 1})`, // on-screen grid label
          total: Math.round(total),
          best: Math.round(best),
          bestLayer: bestDepth + 1, // 1-based depth, matches DEPTH N/20
        });
      }
    }
  }
  cells.sort((a, b) => b.total - a.total);

  // Hell-pocket locations (admin only) so a tester can park a rig on one and
  // force-strike down to its layer to trigger the hell/demon effect. Each
  // pocket needs the rig at (col,row) and a strike that reaches depth z+1.
  const hell = (hellPockets || []).map((p) => ({
    col: p.x, row: p.y,
    label: `(${p.x + 1}, ${p.y + 1})`,
    layer: p.z + 1, // 1-based; force-strike to this DEPTH to breach it
  }));

  // Artifact layer (admin only) — same seed + knobs as the tick, so a tester
  // can park a rig on a cache/cursed relic and force-strike to its layer.
  const artifacts = generateArtifacts(settings, seed, gridSize, depthZ, grid, hellPockets);
  const artifactCells = artifacts.cells.map((c) => ({
    col: c.x, row: c.y,
    label: `(${c.x + 1}, ${c.y + 1})`,
    layer: c.z + 1, // 1-based; force-strike to this DEPTH to unearth it
    type: c.type,
    ...(c.type === "amber" ? { specimenId: c.specimenId, fragmentIndex: c.fragmentIndex } : {}),
    ...(c.type === "relic" ? { relicId: c.relicId, cursed: c.cursed } : {}),
    ...(c.type === "map" ? { pieceIndex: c.pieceIndex } : {}),
  }));

  return {
    ok: true, gridSize, depthZ, richest: cells.slice(0, 10), hell,
    artifactSummary: artifacts.summary,
    artifacts: artifactCells,
  };
}

// Admin test helper: reset a single user's claim-jump counter (and re-arm the rig)
// so a tester can keep relocating. Targeted by userId so it can't affect others.
async function grantJumps(userId) {
  const db = getAdminDb();
  const ref = db.collection("oilDrills").doc(userId);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "no_drill_doc" };
  await ref.set({
    claimJumpsUsed: 0,
    armed: true,
    rigDepleted: false,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true, granted: userId, claimJumpsUsed: 0 };
}

function authorized(req) {
  const auth = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth === `Bearer ${cronSecret}`) return { ok: true, cron: true };
  const url = new URL(req.url);
  const pw = url.searchParams.get("password");
  if (process.env.ADMIN_PASSWORD && pw === process.env.ADMIN_PASSWORD) {
    const deep = Math.max(1, Math.min(parseInt(url.searchParams.get("deep") || "1", 10) || 1, 20));
    const targetCol = url.searchParams.has("col") ? parseInt(url.searchParams.get("col"), 10) : null;
    const targetRow = url.searchParams.has("row") ? parseInt(url.searchParams.get("row"), 10) : null;
    return { ok: true, cron: false, force: url.searchParams.get("force") === "1", deep, scout: url.searchParams.get("scout") === "1", grant: url.searchParams.get("grant"), targetCol, targetRow };
  }
  return { ok: false };
}

async function handle(req) {
  const a = authorized(req);
  if (!a.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = a.grant ? await grantJumps(a.grant)
      : a.scout ? await scoutOil()
      : await runTick({ force: a.force, deep: a.deep, targetCol: a.targetCol, targetRow: a.targetRow });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[oil-strike-tick] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET supports Vercel cron / browser-based admin testing; POST for the Firebase ping.
export async function GET(req) { return handle(req); }
export async function POST(req) { return handle(req); }
