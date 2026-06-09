import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

// Admin reset (password-gated): release EVERY plot and clear EVERY rig's position,
// regardless of owner. For wiping stuck/orphaned test claims (e.g. rigs created by
// admin-claim under arbitrary userIds) that the per-user / fake-only tools can't reach.
async function handle(req) {
  const url = new URL(req.url);
  let pw = url.searchParams.get("password");
  if (!pw) { try { pw = (await req.json())?.password; } catch {} }
  if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  let batch = db.batch();
  let n = 0;
  const flush = async (force) => {
    if (n >= 400 || (force && n > 0)) { await batch.commit(); batch = db.batch(); n = 0; }
  };

  // Release ownership AND wipe the drilled state (depth + revealed oil + hell
  // layers) so the survey map / cross-section go back to a true clean slate.
  let plotsCleared = 0;
  const plotsSnap = await db.collection("oilPlots").get();
  for (const d of plotsSnap.docs) {
    const p = d.data();
    if (p.currentOwnerId != null || p.drillDay || p.revealed || p.hellLayers) {
      batch.set(d.ref, {
        currentOwnerId: null,
        drillDay: 0,
        revealed: FieldValue.delete(),
        hellLayers: FieldValue.delete(),
      }, { merge: true });
      plotsCleared++; n++; await flush(false);
    }
  }

  // Clear every rig: position + un-banked tank + strike/rig state. Banked score
  // (totalCollected) is intentionally left alone.
  let rigsCleared = 0;
  const drillsSnap = await db.collection("oilDrills").get();
  for (const d of drillsSnap.docs) {
    const dd = d.data();
    if (dd.col != null || dd.tankOil || dd.drillDay) {
      batch.set(d.ref, {
        col: null, row: null,
        drillDay: 0, tankOil: 0,
        lastStrikeOil: null, lastStrikeDepth: null, lastStrikeDate: null,
        rigDepleted: false, armed: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      rigsCleared++; n++; await flush(false);
    }
  }

  // Clear active gusher broadcast effects — otherwise the 3D field keeps
  // erupting after a reset (these are ephemeral; safe to delete).
  let gushersCleared = 0;
  const gushersSnap = await db.collection("gusherEvents").get();
  for (const d of gushersSnap.docs) {
    batch.delete(d.ref);
    gushersCleared++; n++; await flush(false);
  }

  // Clear the FIELD ACTIVITY timeline — it's season-scoped (resets with the board).
  const timelineSnap = await db.collection("oilTimeline").get();
  for (const d of timelineSnap.docs) {
    batch.delete(d.ref);
    n++; await flush(false);
  }

  await flush(true);

  // Zero the community holding tank — it's incremented by banking/demon flows and
  // is otherwise never reset, so without this it stays "full" across board resets
  // (the big oil tower fills as communityOil / OIL_FIELD_UNITS and clamps at 100%).
  const communityRef = db.collection("oilGame").doc("communityStorage");
  const communitySnap = await communityRef.get();
  const communityOilBefore = communitySnap.exists ? (communitySnap.data().totalOil || 0) : 0;
  if (communityOilBefore !== 0) {
    await communityRef.set(
      { totalOil: 0, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
  }

  // A wiped board is never "ended" — drop the game back to a clean, playable
  // phase so gamePhase/gameEnded can't be left contradicting the fresh board
  // (e.g. ACTIVE highlighted while the GAME ENDED banner lingers). Also clear any
  // leftover reveal fields: a stale seedReveal on an active board would make the
  // verifier (and the client) expose the live map — a fairness leak.
  await db.collection("oilGame").doc("settings").set(
    {
      gamePhase: "active", gameEnded: false,
      seedReveal: FieldValue.delete(),
      finalSeedReveal: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true, plotsCleared, rigsCleared, gushersCleared, communityOilCleared: communityOilBefore, phaseReset: "active" });
}

export async function POST(req) { return handle(req); }
export async function GET(req) { return handle(req); }
