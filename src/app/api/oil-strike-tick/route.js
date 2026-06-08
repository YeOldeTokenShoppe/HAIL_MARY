import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { generateOilDistribution3D, OIL_FIELD_UNITS } from "@/lib/oilDistribution";
import { createDemonBounty } from "@/lib/oilDemon";
import {
  PASSIVE_DRILLS, MAX_DEPTH, depthCapFor, seasonClock, strikeTargetMs,
} from "@/lib/oilStrikeClock";

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

// End-of-season buzzer: flip the phase once (txn-guarded so concurrent ticks
// don't double-run), auto-bank every rig's un-banked tank so nobody loses oil to
// timing, then publish the fairness reveal (mirrors oil-settings' gameEnded path).
async function endSeason(db) {
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

  // Provable-fairness reveal (same as oil-settings on gameEnded:true).
  try {
    const sd = (await db.collection("oilSecret").doc("seed").get()).data() || {};
    if (sd.serverSecret) {
      await settingsRef.set({
        seedReveal: sd.serverSecret,
        finalSeedReveal: sd.seed || null,
        revealedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    } else if (sd.seed) {
      await settingsRef.set({ seedReveal: sd.seed, revealedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  } catch (err) {
    console.error("[oil-strike-tick] season-end reveal failed:", err.message);
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

async function notifyTelegram(db, userId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const linkSnap = await db.collection("oilTelegram").doc(userId).get();
    const chatId = linkSnap.exists ? linkSnap.data().chatId : null;
    if (!chatId) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
  } catch (err) {
    console.error("[oil-strike-tick] telegram notify failed:", err.message);
  }
}

async function runTick({ force = false, deep = 1 } = {}) {
  const db = getAdminDb();

  const settingsSnap = await db.collection("oilGame").doc("settings").get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  if (settings.gamePhase !== "active") {
    return { ok: true, skipped: "phase_not_active", phase: settings.gamePhase || null };
  }

  // End-of-season buzzer — only when a season clock is configured. Flips the
  // phase, auto-banks every tank, and reveals the seed. Runs before any drilling.
  const season = seasonClock(settings);
  if (season && Date.now() >= season.endMs) {
    return await endSeason(db);
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

  const gridSize = settings.gridSize || 10;
  const depthZ = settings.depthZ || DEFAULT_DEPTH_Z;
  const { grid, hellPockets } = generateOilDistribution3D({
    blockHash: seed,
    gridX: gridSize,
    gridY: gridSize,
    depthZ,
    totalOilBudget: OIL_FIELD_UNITS, // field resolution, not the $ prize
    numberOfDeposits: settings.numberOfDeposits || 5,
  });
  const hellSet = new Set((hellPockets || []).map((p) => `${p.x}_${p.y}_${p.z}`));

  const now = new Date();
  const today = utcDateStr(now);
  const hour = now.getUTCHours();
  const nowMinutes = hour * 60 + now.getUTCMinutes();

  const drillsSnap = await db.collection("oilDrills").get();

  const summary = { struck: 0, skipped: 0, depleted: 0, errors: 0, demonsSummoned: 0 };
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

    if (summonedThisTick) { summary.skipped++; continue; }
    // Must hold a claimed plot and be armed (admin hard-disable via armed:false).
    if (col == null || row == null) { summary.skipped++; continue; }
    if (drill.armed === false) { summary.skipped++; continue; }

    const cellKey = `${col}_${row}`;
    const plotRef = db.collection("oilPlots").doc(cellKey);
    const drillRef = db.collection("oilDrills").doc(userId);

    // Per-rig depth ceiling (base + earned bonus). Read the cell's current depth
    // up front — it drives both the depletion check and the interval pacing.
    // Admin force/deep drilling bypasses the cap (drill the full field for testing).
    const depthCap = depthCapFor(drill, depthZ);
    const effectiveCap = ignoreDayGuard ? depthZ : depthCap;
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
      if (!force && Date.now() < targetMs) { summary.skipped++; continue; }
    } else {
      if (!ignoreDayGuard && drill.lastStrikeDate === today) { summary.skipped++; continue; }
      if (!force && nowMinutes < strikeMinuteFor(userId, today)) { summary.skipped++; continue; }
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

          const newDepth = currentDepth + 1;
          const layerIndex = currentDepth; // layers 0..drillDay-1 are revealed
          const oilAtLayer = grid?.[col]?.[row]?.[layerIndex] ?? 0;
          const isHell = hellSet.has(`${col}_${row}_${layerIndex}`);

          t.set(plotRef, {
            col, row,
            drillDay: newDepth,
            lastStrikeAt: FieldValue.serverTimestamp(),
            // Server-authoritative reveal: persist the discovered oil for this
            // layer so the client renders the field from Firestore, never by
            // recomputing the secret seed. merge:true deep-merges the map, so
            // previously revealed layers are preserved.
            revealed: { [layerIndex]: oilAtLayer },
            ...(isHell ? { hellLayers: { [layerIndex]: true } } : {}),
          }, { merge: true });

          t.set(drillRef, {
            userId,
            tankOil: FieldValue.increment(oilAtLayer),
            lastStrikeDate: today,
            lastStrikeAt: FieldValue.serverTimestamp(),
            lastStrikeOil: oilAtLayer,
            lastStrikeDepth: newDepth,
            lastStrikeHell: isHell,
            rigDepleted: false, // a successful strike clears any stale depleted cache
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });

          return { status: "struck", oil: oilAtLayer, depth: newDepth, isHell, username: drillNow.username || null, newTank: (drillNow.tankOil || 0) + oilAtLayer };
        });

        if (outcome.status === "struck") {
          summary.struck++;
          strikes.push({ userId, col, row, ...outcome });

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
                await notifyTelegram(db, userId,
                  `🔥 <b>YOUR RIG BREACHED A HELL POCKET!</b>\nA demon is loose on the field — your unbanked tank fueled the bounty. Drilling is halted until it's banished.`);
              }
            } catch (err) {
              console.error(`[oil-strike-tick] demon summon failed for ${userId}:`, err.message);
            }
            break; // hell halts drilling (blockade) — end this rig's run
          }

          // Normal strike: reuse gusherEvents so the existing 3D strike visual fires.
          if (outcome.oil > 0) {
            await db.collection("gusherEvents").add({
              col, row, userId,
              username: outcome.username,
              oilAmount: outcome.oil,
              depth: outcome.depth,
              createdAt: FieldValue.serverTimestamp(),
              status: "active",
            });
          }
          // Best-effort retention hook — skipped during deep admin drills to avoid spam.
          if (deep === 1) {
            const msg = outcome.oil > 0
              ? `⛽ <b>YOUR RIG STRUCK!</b>\nPlot (${col}, ${row}) hit ${outcome.oil} at depth ${outcome.depth}.\nBank it before a dino comes sniffing.`
              : `🪨 Your rig drilled to depth ${outcome.depth} at (${col}, ${row}) — dry layer this time.`;
            await notifyTelegram(db, userId, msg);
          }
        } else if (outcome.status === "depleted") {
          summary.depleted++;
          break;
        } else {
          summary.skipped++;
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

  return { ok: true, gridSize, depthZ, richest: cells.slice(0, 10), hell };
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
    return { ok: true, cron: false, force: url.searchParams.get("force") === "1", deep, scout: url.searchParams.get("scout") === "1", grant: url.searchParams.get("grant") };
  }
  return { ok: false };
}

async function handle(req) {
  const a = authorized(req);
  if (!a.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = a.grant ? await grantJumps(a.grant)
      : a.scout ? await scoutOil()
      : await runTick({ force: a.force, deep: a.deep });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[oil-strike-tick] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET supports Vercel cron / browser-based admin testing; POST for the Firebase ping.
export async function GET(req) { return handle(req); }
export async function POST(req) { return handle(req); }
