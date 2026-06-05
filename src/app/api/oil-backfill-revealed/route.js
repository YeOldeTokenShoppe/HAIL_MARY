import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { generateOilDistribution3D, OIL_FIELD_UNITS } from "@/lib/oilDistribution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── One-time backfill: server-authoritative reveal for already-drilled cells ──
// Before the migration to server-authoritative reveal, `oilPlots` stored only
// `drillDay` (depth) and the client recomputed oil from the public seed. This
// route walks every drilled plot and writes the discovered oil per layer into
// `oilPlots/{col_row}.revealed` (+ `hellLayers`), from the current seed, so the
// client can render the field from Firestore without the seed.
//
// Idempotent: recomputing and re-writing the same revealed values is safe.
// Admin-gated (same password scheme as oil-strike-tick). Run once at cutover.
//   GET /api/oil-backfill-revealed?password=<ADMIN_PASSWORD>

const DEFAULT_DEPTH_Z = 20;

async function runBackfill() {
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
  const hellSet = new Set((hellPockets || []).map((p) => `${p.x}_${p.y}_${p.z}`));

  const plotsSnap = await db.collection("oilPlots").get();
  const summary = { plots: 0, backfilled: 0, layers: 0, skipped: 0 };

  for (const docSnap of plotsSnap.docs) {
    summary.plots++;
    const plot = docSnap.data();
    const { col, row } = plot;
    const drillDay = plot.drillDay ?? 0;
    if (col == null || row == null || drillDay <= 0) { summary.skipped++; continue; }

    const revealed = {};
    const hellLayers = {};
    const depth = Math.min(drillDay, depthZ);
    for (let z = 0; z < depth; z++) {
      revealed[z] = grid?.[col]?.[row]?.[z] ?? 0;
      if (hellSet.has(`${col}_${row}_${z}`)) hellLayers[z] = true;
    }

    await docSnap.ref.set(
      { revealed, ...(Object.keys(hellLayers).length ? { hellLayers } : {}) },
      { merge: true }
    );
    summary.backfilled++;
    summary.layers += depth;
  }

  return { ok: true, ...summary };
}

function authorized(req) {
  const url = new URL(req.url);
  const pw = url.searchParams.get("password");
  return !!(process.env.ADMIN_PASSWORD && pw === process.env.ADMIN_PASSWORD);
}

async function handle(req) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await runBackfill());
  } catch (err) {
    console.error("[oil-backfill-revealed] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req) { return handle(req); }
export async function POST(req) { return handle(req); }
