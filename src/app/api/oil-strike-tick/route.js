import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { generateOilDistribution3D } from "@/lib/oilDistribution";
import { createDemonBounty } from "@/lib/oilDemon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── Continuous-pump strike loop ───────────────────────────────────────────────
// Runs hourly (triggered by the Firebase `oilStrikeTick` scheduled function, or
// any cron that hits this route with the CRON_SECRET). Each armed rig strikes
// exactly ONCE per UTC day, at a per-rig random hour the player can't predict.
//
// The strike is never random in OUTCOME — the oil at each layer is fixed by the
// deterministic block-hash distribution. Only the reveal TIME is randomized.
//
// Model (see docs/oil-game.md → "Economy & Timing Model"):
//   • Auto-advance: a strike drills the cell one layer deeper (cap at depthZ).
//   • Lump-sum: the newly drilled layer's oil is added to the rig's `tankOil`.
//   • Uncapped tank: `tankOil` grows freely; banking is a separate action.
//   • Idempotent: `lastStrikeDate` guards against double-striking within a day.

const DEFAULT_DEPTH_Z = 20;

// Deterministic, unpredictable strike hour [0,23] per (rig, day). Stable across
// ticks with no extra Firestore writes, so a missed/retried tick is safe.
function strikeHourFor(userId, dateStr) {
  const s = `${userId}:${dateStr}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % 24;
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

async function runTick({ force = false } = {}) {
  const db = getAdminDb();

  const settingsSnap = await db.collection("oilGame").doc("settings").get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  if (settings.gamePhase !== "active") {
    return { ok: true, skipped: "phase_not_active", phase: settings.gamePhase || null };
  }
  if (!settings.blockHash) {
    return { ok: true, skipped: "no_block_hash" };
  }

  // Respect the global single-demon blockade — drilling halts while a demon is loose.
  const blockadeSnap = await db.collection("oilGame").doc("demonBlockade").get();
  if (blockadeSnap.exists && blockadeSnap.data().active) {
    return { ok: true, skipped: "demon_blockade" };
  }

  const gridSize = settings.gridSize || 10;
  const depthZ = settings.depthZ || DEFAULT_DEPTH_Z;
  const { grid, hellPockets } = generateOilDistribution3D({
    blockHash: settings.blockHash,
    gridX: gridSize,
    gridY: gridSize,
    depthZ,
    totalOilBudget: settings.totalOilBudget || 500000,
    numberOfDeposits: settings.numberOfDeposits || 5,
  });
  const hellSet = new Set((hellPockets || []).map((p) => `${p.x}_${p.y}_${p.z}`));

  const now = new Date();
  const today = utcDateStr(now);
  const hour = now.getUTCHours();

  const drillsSnap = await db.collection("oilDrills").get();

  const summary = { struck: 0, skipped: 0, depleted: 0, errors: 0, demonsSummoned: 0 };
  const strikes = [];
  // Once a hell pocket summons a demon, the blockade halts drilling — stop
  // striking the remaining rigs this tick so we don't drill through the halt.
  let summonedThisTick = false;

  for (const docSnap of drillsSnap.docs) {
    const drill = docSnap.data();
    const userId = docSnap.id;
    const { col, row } = drill;

    if (summonedThisTick) { summary.skipped++; continue; }
    // Must hold a claimed plot, be armed, not already struck today, not bottomed out.
    if (col == null || row == null) { summary.skipped++; continue; }
    if (drill.armed === false || drill.rigDepleted) { summary.skipped++; continue; }
    if (drill.lastStrikeDate === today) { summary.skipped++; continue; }
    if (!force && hour < strikeHourFor(userId, today)) { summary.skipped++; continue; }

    const cellKey = `${col}_${row}`;
    const plotRef = db.collection("oilPlots").doc(cellKey);
    const drillRef = db.collection("oilDrills").doc(userId);

    try {
      const outcome = await db.runTransaction(async (t) => {
        const plotSnap = await t.get(plotRef);
        const drillNow = (await t.get(drillRef)).data() || drill;

        // Re-check the day guard inside the txn (idempotent under concurrent ticks).
        if (drillNow.lastStrikeDate === today) return { status: "already_struck" };

        const currentDepth = (plotSnap.exists ? plotSnap.data().drillDay : 0) || 0;
        if (currentDepth >= depthZ) {
          // Rig has reached the floor — disarm it; nothing left to strike.
          t.set(drillRef, { armed: false, rigDepleted: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
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
        }, { merge: true });

        t.set(drillRef, {
          userId,
          tankOil: FieldValue.increment(oilAtLayer),
          lastStrikeDate: today,
          lastStrikeAt: FieldValue.serverTimestamp(),
          lastStrikeOil: oilAtLayer,
          lastStrikeDepth: newDepth,
          lastStrikeHell: isHell,
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
        } else {
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
          // Best-effort retention hook — fire-and-forget Telegram alert.
          const msg = outcome.oil > 0
            ? `⛽ <b>YOUR RIG STRUCK!</b>\nPlot (${col}, ${row}) hit ${outcome.oil} at depth ${outcome.depth}.\nBank it before a dino comes sniffing.`
            : `🪨 Your rig drilled to depth ${outcome.depth} at (${col}, ${row}) — dry layer this time.`;
          await notifyTelegram(db, userId, msg);
        }
      } else if (outcome.status === "depleted") {
        summary.depleted++;
      } else {
        summary.skipped++;
      }
    } catch (err) {
      summary.errors++;
      console.error(`[oil-strike-tick] strike failed for ${userId}:`, err.message);
    }
  }

  return { ok: true, date: today, hour, ...summary, strikes };
}

function authorized(req) {
  const auth = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth === `Bearer ${cronSecret}`) return { ok: true, cron: true };
  const url = new URL(req.url);
  const pw = url.searchParams.get("password");
  if (process.env.ADMIN_PASSWORD && pw === process.env.ADMIN_PASSWORD) {
    return { ok: true, cron: false, force: url.searchParams.get("force") === "1" };
  }
  return { ok: false };
}

async function handle(req) {
  const a = authorized(req);
  if (!a.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = await runTick({ force: a.force });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[oil-strike-tick] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET supports Vercel cron / browser-based admin testing; POST for the Firebase ping.
export async function GET(req) { return handle(req); }
export async function POST(req) { return handle(req); }
