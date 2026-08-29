import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";
import { generateOilDistribution3D, OIL_FIELD_UNITS } from "@/lib/oilDistribution";
import { generateArtifactDistribution3D, artifactKey } from "@/lib/artifactDistribution";
import { PASSIVE_DRILLS } from "@/lib/oilStrikeClock";
import { chargesRemainingFor } from "@/lib/oilLoopV2";
import { inclusionItemKey } from "@/lib/oilLoopV2Server";
import { logTimeline } from "@/lib/oilTimeline";
import { sendPlayerAlert } from "@/lib/oilAlerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// v2 LATERAL DRILL (docs/oil-game.md → "Lateral drills — the full-grid game").
// Spend one charge to take a PASSED layer from an orthogonally adjacent
// column. First lateral wins — the transaction re-checks `lateralTaken`, so a
// race loser gets a clean "already taken", never a double-take. The salvaged
// oil banks like an extraction; a flagged inclusion left in the pocket rides
// along. Wording is load-bearing: this is SALVAGE of an irrevocable discard —
// the owner lost nothing (pass is final; they were never getting it back).
export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const col = Number(body.col), row = Number(body.row), layer = Number(body.layer);
    if (![col, row, layer].every(Number.isInteger)) {
      return NextResponse.json({ error: "col, row, layer required" }, { status: 400 });
    }

    const db = getAdminDb();
    const settingsSnap = await db.collection("oilGame").doc("settings").get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    if (settings.loopV2 !== true) return NextResponse.json({ error: "loopV2 not active" }, { status: 400 });
    if (settings.gamePhase !== "active") return NextResponse.json({ error: "season not active" }, { status: 400 });
    const depthZ = settings.depthZ || 20;
    const gridSize = settings.gridSize || 10;
    if (col < 0 || col >= gridSize || row < 0 || row >= gridSize || layer < 0 || layer >= depthZ) {
      return NextResponse.json({ error: "out of bounds" }, { status: 400 });
    }

    // Inclusion identity from the committed seed (only when the pocket is
    // flagged — same derive-never-store rule as the decide route).
    const targetRef = db.collection("oilPlots").doc(`${col}_${row}`);
    const targetPeek = (await targetRef.get()).data() || {};
    let inclusionArtifact = null;
    if (targetPeek.passedInclusions?.[layer]) {
      const secretSnap = await db.collection("oilSecret").doc("seed").get();
      const seed = (secretSnap.exists && secretSnap.data().seed) || settings.blockHash;
      if (seed) {
        const dist = generateOilDistribution3D({
          blockHash: seed, gridX: gridSize, gridY: gridSize, depthZ,
          totalOilBudget: OIL_FIELD_UNITS,
          numberOfDeposits: settings.numberOfDeposits || 5,
          numberOfHellPockets: settings.numberOfHellPockets ?? null,
        });
        const { byKey } = generateArtifactDistribution3D({
          blockHash: seed, gridX: gridSize, gridY: gridSize, depthZ,
          oilGrid: dist.grid, hellPockets: dist.hellPockets,
          perColumn: settings.artifactPerColumn ?? 3,
          relicFraction: settings.artifactRelicFraction ?? 0.15,
          cursedFraction: settings.artifactCursedFraction ?? 0.25,
          mapCopies: settings.artifactMapCopies ?? 2,
          shallowCap: PASSIVE_DRILLS,
        });
        inclusionArtifact = byKey[artifactKey(col, row, layer)] || null;
      }
    }

    const drillRef = db.collection("oilDrills").doc(userId);
    const communityRef = db.collection("oilGame").doc("communityStorage");

    const result = await db.runTransaction(async (t) => {
      const drillNow = (await t.get(drillRef)).data();
      if (!drillNow || drillNow.col == null) return { error: "no rig" };
      // Orthogonal adjacency only — the reach that makes the field social.
      if (Math.abs(drillNow.col - col) + Math.abs(drillNow.row - row) !== 1) {
        return { error: "not adjacent to your claim" };
      }
      if (chargesRemainingFor(drillNow, settings, depthZ) <= 0) {
        return { error: "no charges remaining" };
      }
      const target = (await t.get(targetRef)).data() || {};
      const pocketOil = target.passed?.[layer];
      const hasInclusion = !!target.passedInclusions?.[layer];
      if (pocketOil === undefined || (pocketOil <= 0 && !hasInclusion)) {
        return { error: "nothing open at that layer" };
      }
      if (target.lateralTaken?.[layer] !== undefined) {
        return { error: "already taken — first lateral wins" };
      }

      const oil = Math.max(0, pocketOil || 0);
      const drillUpdate = {
        chargesSpent: (drillNow.chargesSpent || 0) + 1,
        totalCollected: (drillNow.totalCollected || 0) + oil,
        laterals: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (hasInclusion && inclusionArtifact) {
        drillUpdate.artifacts = { [inclusionItemKey(inclusionArtifact)]: FieldValue.increment(1) };
        drillUpdate.artifactFinds = FieldValue.increment(1);
      }
      t.set(drillRef, drillUpdate, { merge: true });
      if (oil > 0) {
        t.set(communityRef, {
          totalOil: FieldValue.increment(oil),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      const targetUpdate = { lateralTaken: { [layer]: userId } };
      if (hasInclusion && inclusionArtifact) {
        const { x, y, z, ...payload } = inclusionArtifact;
        targetUpdate.revealedArtifacts = { [layer]: payload };
      }
      t.set(targetRef, targetUpdate, { merge: true });
      return {
        ok: true, oil, layer,
        inclusion: hasInclusion ? inclusionArtifact?.type ?? true : null,
        ownerId: target.currentOwnerId || null,
        username: drillNow.username || null,
      };
    });

    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

    // Field feed (coordinate-free, house rule) + a courtesy note to the passer
    // — salvage, not theft: they discarded it, but they'd want to know.
    try {
      await logTimeline(db, { type: "lateral", username: result.username, userId, detail: "salvaged a neighbour's discard" });
      if (result.ownerId && result.ownerId !== userId) {
        await sendPlayerAlert(db, result.ownerId, {
          title: "🛢 YOUR DISCARD WAS SALVAGED",
          body: `The layer you passed at L${result.layer + 1} (${Math.round(result.oil).toLocaleString()} BTR) was taken by a neighbour's lateral. You lost nothing — pass is final either way — but the field noticed.`,
          tag: "hmpc-lateral",
          channels: { telegram: true, push: false },
          telegramHtml: `🛢 <b>YOUR DISCARD WAS SALVAGED</b>\nThe layer you passed at L${result.layer + 1} (${Math.round(result.oil).toLocaleString()} BTR) was taken by a neighbour's lateral.`,
        });
      }
    } catch (err) {
      console.error("[oil-lateral] feed/alert failed:", err.message);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[oil-lateral] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
