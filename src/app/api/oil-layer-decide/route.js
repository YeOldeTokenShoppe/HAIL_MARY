import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";
import { generateOilDistribution3D, OIL_FIELD_UNITS } from "@/lib/oilDistribution";
import { generateArtifactDistribution3D, artifactKey } from "@/lib/artifactDistribution";
import { PASSIVE_DRILLS } from "@/lib/oilStrikeClock";
import { chargesRemainingFor } from "@/lib/oilLoopV2";
import { applyV2Resolution } from "@/lib/oilLoopV2Server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// v2 manual EXTRACT / PASS on the player's own pending layer (docs/oil-game.md
// → "v2 LOOP"). The acting user comes from the verified session; the amounts
// come only from the server-stored `pending` written by the strike tick — the
// client supplies nothing but the verb. Idempotent: once pending is null (this
// route or the tick's threshold auto-resolve got there first), the call is a
// clean no-op with `already: true`.
//
// EXTRACT spends 1 charge and banks the pending oil (extraction = banking —
// same community-total write as the old bank verb). PASS is free and FINAL:
// the pocket opens on the public plot doc for laterals; a flagged inclusion
// stays in the ground with it.
export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action === "extract" ? "extract" : body.action === "pass" ? "pass" : null;
    if (!action) return NextResponse.json({ error: "action must be extract|pass" }, { status: 400 });

    const db = getAdminDb();
    const settingsSnap = await db.collection("oilGame").doc("settings").get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    if (settings.loopV2 !== true) return NextResponse.json({ error: "loopV2 not active" }, { status: 400 });
    if (settings.gamePhase !== "active") return NextResponse.json({ error: "season not active" }, { status: 400 });

    const depthZ = settings.depthZ || 20;
    const gridSize = settings.gridSize || 10;

    // Inclusion identity comes from the committed seed, exactly as the tick
    // derives it — regenerated, never stored, never trusted from the client.
    const drillSnap = await db.collection("oilDrills").doc(userId).get();
    const drillPeek = drillSnap.exists ? drillSnap.data() : null;
    if (!drillPeek || drillPeek.col == null) return NextResponse.json({ error: "no rig" }, { status: 400 });
    let artifactsByKey = {};
    if (drillPeek.pending?.hasInclusion) {
      const secretSnap = await db.collection("oilSecret").doc("seed").get();
      const seed = (secretSnap.exists && secretSnap.data().seed) || settings.blockHash;
      if (seed) {
        const dist = generateOilDistribution3D({
          blockHash: seed, gridX: gridSize, gridY: gridSize, depthZ,
          totalOilBudget: OIL_FIELD_UNITS,
          numberOfDeposits: settings.numberOfDeposits || 5,
          numberOfHellPockets: settings.numberOfHellPockets ?? null,
        });
        artifactsByKey = generateArtifactDistribution3D({
          blockHash: seed, gridX: gridSize, gridY: gridSize, depthZ,
          oilGrid: dist.grid, hellPockets: dist.hellPockets,
          perColumn: settings.artifactPerColumn ?? 3,
          relicFraction: settings.artifactRelicFraction ?? 0.15,
          cursedFraction: settings.artifactCursedFraction ?? 0.25,
          mapCopies: settings.artifactMapCopies ?? 2,
          shallowCap: PASSIVE_DRILLS,
        }).byKey;
      }
    }

    const drillRef = db.collection("oilDrills").doc(userId);
    const communityRef = db.collection("oilGame").doc("communityStorage");

    const result = await db.runTransaction(async (t) => {
      const drillNow = (await t.get(drillRef)).data();
      if (!drillNow) throw new Error("No drill record for user");
      const pending = drillNow.pending;
      if (!pending || typeof pending.layer !== "number") return { already: true };

      const { col, row } = drillNow;
      if (col == null || row == null) throw new Error("No plot");
      const chargesRemaining = chargesRemainingFor(drillNow, settings, depthZ);
      if (action === "extract" && chargesRemaining <= 0) {
        return { error: "no charges remaining" };
      }
      const plotRef = db.collection("oilPlots").doc(`${col}_${row}`);
      const inclArt = pending.hasInclusion
        ? (artifactsByKey[artifactKey(col, row, pending.layer)] || null) : null;
      const summary = applyV2Resolution(t, {
        FieldValue, drillRef, plotRef, communityRef,
        drillNow, col, row, pending, decision: action, inclusionArtifact: inclArt,
      });
      return {
        ...summary,
        chargesRemaining: action === "extract" ? chargesRemaining - 1 : chargesRemaining,
      };
    });

    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[oil-layer-decide] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
