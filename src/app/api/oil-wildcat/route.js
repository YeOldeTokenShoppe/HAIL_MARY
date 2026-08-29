import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";
import { generateOilDistribution3D, OIL_FIELD_UNITS } from "@/lib/oilDistribution";
import { generateArtifactDistribution3D, artifactKey } from "@/lib/artifactDistribution";
import { PASSIVE_DRILLS } from "@/lib/oilStrikeClock";
import { chargesRemainingFor } from "@/lib/oilLoopV2";
import { inclusionItemKey } from "@/lib/oilLoopV2Server";
import { createDemonBounty } from "@/lib/oilDemon";
import { logTimeline } from "@/lib/oilTimeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// v2 WILDCAT — generalized to the whole frontier (decided 2026-08-27, the
// "3×3 territories" bridge): spend a charge to drill BLIND into any of the 8
// adjacent UNCLAIMED columns, at a layer your own bore has already reached
// (depth = reach). First-come per cell. The survey blobs are the only map —
// the assay is only known once the charge is spent. Oil banks like an
// extraction; an inclusion is recovered; a dormant hell pocket wakes the
// demon on the wildcatter (a tonic caps it, as on a reveal).
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

    // The sealed map — the server must resolve the blind dig regardless of
    // what it finds (derive-never-store, same as the tick).
    const secretSnap = await db.collection("oilSecret").doc("seed").get();
    const seed = (secretSnap.exists && secretSnap.data().seed) || settings.blockHash;
    if (!seed) return NextResponse.json({ error: "no seed" }, { status: 400 });
    const dist = generateOilDistribution3D({
      blockHash: seed, gridX: gridSize, gridY: gridSize, depthZ,
      totalOilBudget: OIL_FIELD_UNITS,
      numberOfDeposits: settings.numberOfDeposits || 5,
      numberOfHellPockets: settings.numberOfHellPockets ?? null,
    });
    const hellSet = new Set((dist.hellPockets || []).map((p) => `${p.x}_${p.y}_${p.z}`));
    const { byKey } = generateArtifactDistribution3D({
      blockHash: seed, gridX: gridSize, gridY: gridSize, depthZ,
      oilGrid: dist.grid, hellPockets: dist.hellPockets,
      perColumn: settings.artifactPerColumn ?? 3,
      relicFraction: settings.artifactRelicFraction ?? 0.15,
      cursedFraction: settings.artifactCursedFraction ?? 0.25,
      mapCopies: settings.artifactMapCopies ?? 2,
      shallowCap: PASSIVE_DRILLS,
    });

    const drillRef = db.collection("oilDrills").doc(userId);
    const targetRef = db.collection("oilPlots").doc(`${col}_${row}`);
    const communityRef = db.collection("oilGame").doc("communityStorage");

    const result = await db.runTransaction(async (t) => {
      const drillNow = (await t.get(drillRef)).data();
      if (!drillNow || drillNow.col == null) return { error: "no rig" };
      // 8-neighbour reach — territories touch diagonally (3×3 bridge).
      if (Math.max(Math.abs(drillNow.col - col), Math.abs(drillNow.row - row)) !== 1) {
        return { error: "not adjacent to your claim" };
      }
      if (chargesRemainingFor(drillNow, settings, depthZ) <= 0) {
        return { error: "no charges remaining" };
      }
      // Depth prerequisite: your bore must have reached that layer at home.
      const ownPlot = (await t.get(db.collection("oilPlots").doc(`${drillNow.col}_${drillNow.row}`))).data() || {};
      if (layer >= (ownPlot.drillDay || 0)) {
        return { error: "your bore hasn't reached that depth yet" };
      }
      const target = (await t.get(targetRef)).data() || {};
      if (target.currentOwnerId != null) {
        return { error: "column is claimed — laterals only take what its owner passes" };
      }
      // Virgin cells only: never revealed (by a rig or a prior wildcat).
      if (target.revealed?.[layer] !== undefined || target.wildcatTaken?.[layer] !== undefined) {
        return { error: "already drilled — first wildcat wins" };
      }

      const oil = dist.grid?.[col]?.[row]?.[layer] ?? 0;
      const isHell = hellSet.has(`${col}_${row}_${layer}`);
      const art = byKey[artifactKey(col, row, layer)] || null;
      const tonics = drillNow.supplies?.tonic || 0;
      const tonicCapped = isHell && tonics > 0;

      const drillUpdate = {
        chargesSpent: (drillNow.chargesSpent || 0) + 1,
        wildcats: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      };
      const targetUpdate = {
        col, row,
        revealed: { [layer]: isHell ? 0 : oil },
        wildcatTaken: { [layer]: userId },
      };
      if (isHell) {
        targetUpdate.hellLayers = { [layer]: true };
        if (tonicCapped) {
          targetUpdate.hellCapped = { [layer]: true };
          drillUpdate.supplies = { tonic: FieldValue.increment(-1) };
          drillUpdate.tonicsUsed = FieldValue.increment(1);
          drillUpdate.lastTonicAt = FieldValue.serverTimestamp();
        }
      } else if (oil > 0) {
        drillUpdate.totalCollected = (drillNow.totalCollected || 0) + oil;
        t.set(communityRef, {
          totalOil: FieldValue.increment(oil),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      if (!isHell && art) {
        drillUpdate.artifacts = { [inclusionItemKey(art)]: FieldValue.increment(1) };
        drillUpdate.artifactFinds = FieldValue.increment(1);
        const { x, y, z, ...payload } = art;
        targetUpdate.revealedArtifacts = { [layer]: payload };
      }
      t.set(drillRef, drillUpdate, { merge: true });
      t.set(targetRef, targetUpdate, { merge: true });
      return {
        ok: true, oil: isHell ? 0 : oil, layer, col, row,
        hell: isHell, tonicCapped,
        inclusion: (!isHell && art) ? art.type : null,
        username: drillNow.username || null,
      };
    });

    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

    // Field feed; an uncapped hell wildcat wakes the demon on the wildcatter.
    try {
      if (result.hell && !result.tonicCapped) {
        await createDemonBounty(db, {
          userId, username: result.username, col: result.col, row: result.row, unbankedOil: 0,
        });
        await logTimeline(db, { type: "hell", username: result.username, userId, detail: "wildcatted into a hell pocket" });
      } else {
        await logTimeline(db, {
          type: "wildcat", username: result.username, userId,
          detail: result.tonicCapped ? "hit hell wildcatting — tonic capped it"
            : result.oil > 0 ? "struck oil on the frontier"
            : result.inclusion ? "dug something out of the frontier" : "dry hole on the frontier",
        });
      }
    } catch (err) {
      console.error("[oil-wildcat] feed failed:", err.message);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[oil-wildcat] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
