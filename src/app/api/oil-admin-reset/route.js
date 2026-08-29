import { NextResponse } from "next/server";
import { getAdminDb, getAdminBucket, FieldValue } from "@/lib/firebaseAdmin";

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
    if (p.currentOwnerId != null || p.drillDay || p.revealed || p.hellLayers ||
        p.passed || p.inclusionFlags || p.passedInclusions || p.hellCapped) {
      batch.set(d.ref, {
        currentOwnerId: null,
        drillDay: 0,
        revealed: FieldValue.delete(),
        hellLayers: FieldValue.delete(),
        // v2 loop state (open pockets, inclusion flags, capped hell)
        passed: FieldValue.delete(),
        passedInclusions: FieldValue.delete(),
        inclusionFlags: FieldValue.delete(),
        hellCapped: FieldValue.delete(),
        revealedArtifacts: FieldValue.delete(),
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
    if (dd.col != null || dd.tankOil || dd.drillDay ||
        dd.pending || dd.chargesSpent || dd.layersExtracted || dd.layersPassed) {
      batch.set(d.ref, {
        col: null, row: null,
        drillDay: 0, tankOil: 0,
        lastStrikeOil: null, lastStrikeDepth: null, lastStrikeDate: null,
        lastDrillDate: null, // else a same-day reset keeps rigs in the TODAY count
        rigDepleted: false, armed: FieldValue.delete(),
        // v2 loop state — stale chargesSpent from a previous season silently
        // exhausts the new season's budget (smoke test 2026-08-26: 12 ghost
        // charges → every wet layer auto-passed as "no charges").
        pending: FieldValue.delete(),
        chargesSpent: FieldValue.delete(),
        threshold: FieldValue.delete(),
        layersExtracted: FieldValue.delete(),
        layersPassed: FieldValue.delete(),
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

  // Clear the FIELD DISPATCH polaroid feed (approved + pending) — also
  // season-scoped. Each doc owns a Storage blob; delete those too (same
  // pattern as the oil-feed-admin reject flow) or the bucket leaks orphans.
  // Blob deletes can't ride the Firestore batch — do them first, best-effort.
  let feedCleared = 0;
  const feedSnap = await db.collection("oilFeed").get();
  const bucket = getAdminBucket();
  if (bucket) {
    await Promise.allSettled(
      feedSnap.docs
        .map((d) => d.data().storagePath)
        .filter(Boolean)
        .map((p) => bucket.file(p).delete()),
    );
  }
  for (const d of feedSnap.docs) {
    batch.delete(d.ref);
    feedCleared++; n++; await flush(false);
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
  // (e.g. ACTIVE highlighted while the GAME ENDED banner lingers). Also wipe the
  // ENTIRE fairness lifecycle (commit + anchor + reveal), not just the reveal:
  //  - a stale seedReveal on an active board would let the verifier/client
  //    expose the live map — a fairness leak;
  //  - a stale commit keeps OilAnchorEvent counting down to last season's block;
  //  - a stale anchorBlockHash silently REJECTS all first-plot claims in the
  //    next registration (oil-claim requires ticket_sale && !anchorBlockHash).
  // The lobby falls back to the honest "no commitment yet" state; run a fresh
  // COMMIT (+ ANCHOR) in the fairness console to start the next season.
  await db.collection("oilGame").doc("settings").set(
    {
      gamePhase: "active", gameEnded: false,
      seedScheme: FieldValue.delete(),
      seedCommitment: FieldValue.delete(),
      anchorBlock: FieldValue.delete(),
      anchorBlockHash: FieldValue.delete(),
      seedReveal: FieldValue.delete(),
      finalSeedReveal: FieldValue.delete(),
      revealedAt: FieldValue.delete(),
      blockHash: FieldValue.delete(), // legacy public seed — never client-readable
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // Drop the server-side secret too — without it strike-tick idles cleanly
  // ({skipped:"no_seed"}) until the next COMMIT + ANCHOR mint a fresh map.
  await db.collection("oilSecret").doc("seed").delete();

  return NextResponse.json({ ok: true, plotsCleared, rigsCleared, gushersCleared, feedCleared, communityOilCleared: communityOilBefore, phaseReset: "active", fairnessCleared: true });
}

export async function POST(req) { return handle(req); }
export async function GET(req) { return handle(req); }
