import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";

// Claim-jump: move the authenticated user's rig to an UNCLAIMED plot. Mirrors the
// old client transaction, but server-authoritative — the free-jump limit, bonus-
// drill cost, depth inheritance and re-arm are all enforced here, re-checked
// inside the transaction against a race.
export const runtime = "nodejs";

const FREE_CLAIM_JUMPS = 2;
const GRID_MAX = 50; // sanity cap on coordinates

export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { newCol, newRow } = await req.json().catch(() => ({}));
    if (!Number.isInteger(newCol) || !Number.isInteger(newRow) ||
        newCol < 0 || newRow < 0 || newCol > GRID_MAX || newRow > GRID_MAX) {
      return NextResponse.json({ error: "Invalid target plot" }, { status: 400 });
    }

    const db = getAdminDb();

    // Claim-jump stays enabled during active play (engagement). It carries an
    // insider-tipping risk (operator could steer a jump onto a known-rich cell
    // post-anchor), so every jump is written to the PUBLIC oilClaimLog with the
    // phase + whether the map was already knowable (`anchored`). Post-game, with
    // the revealed map, anyone can audit jumps onto deposits. The tipping surface
    // is also bounded by a right-sized (small) grid. See docs/oil-game.md →
    // "Insider-tipping defense".
    const settings = (await db.collection("oilGame").doc("settings").get()).data() || {};

    const drillRef = db.collection("oilDrills").doc(userId);
    const targetKey = `${newCol}_${newRow}`;
    const targetRef = db.collection("oilPlots").doc(targetKey);

    const result = await db.runTransaction(async (t) => {
      const drillSnap = await t.get(drillRef);
      if (!drillSnap.exists) throw new Error("No drill record");
      const drill = drillSnap.data();
      if (drill.col == null || drill.row == null) throw new Error("No current plot");
      const oldKey = `${drill.col}_${drill.row}`;
      if (oldKey === targetKey) throw new Error("Already on that plot");

      const targetSnap = await t.get(targetRef);
      if (targetSnap.exists && targetSnap.data().currentOwnerId != null) {
        throw new Error("Plot already claimed");
      }

      const jumpsUsed = drill.claimJumpsUsed ?? 0;
      const bonus = drill.bonusDrills ?? 0;
      // Free jumps: the season allowance plus any won on the DAILY TICKET (jackpot).
      const isFree = jumpsUsed < FREE_CLAIM_JUMPS + (drill.bonusClaimJumps ?? 0);
      if (!isFree && bonus <= 0) throw new Error("No jumps left (need a bonus drill)");

      const oldRef = db.collection("oilPlots").doc(oldKey);
      const nowIso = new Date().toISOString();

      // Release old plot.
      t.set(oldRef, {
        currentOwnerId: null,
        ownerHistory: FieldValue.arrayUnion({ userId, releasedAt: nowIso, reason: "claim_jump" }),
      }, { merge: true });

      // Claim new plot — inherit existing depth/lastDrillDate.
      t.set(targetRef, {
        col: newCol, row: newRow,
        drillDay: targetSnap.exists ? (targetSnap.data().drillDay ?? 0) : 0,
        currentOwnerId: userId,
        ownerHistory: FieldValue.arrayUnion({ userId, claimedAt: nowIso }),
        disqualified: false,
        lastDrillDate: targetSnap.exists ? (targetSnap.data().lastDrillDate ?? null) : null,
      }, { merge: true });

      // Update the rig: count the jump, deduct a bonus drill if not free, re-arm.
      const newBonus = isFree ? bonus : Math.max(0, bonus - 1);
      t.set(drillRef, {
        col: newCol, row: newRow,
        claimJumpsUsed: jumpsUsed + 1,
        bonusDrills: newBonus,
        armed: true,
        rigDepleted: false,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      t.set(db.collection("oilQualified").doc(userId), {
        plotCol: newCol, plotRow: newRow,
      }, { merge: true });

      return { oldKey, newCol, newRow, claimJumpsUsed: jumpsUsed + 1, bonusDrills: newBonus, username: drill.username || null };
    });

    // Public audit log (best-effort, server-only write). `anchored` flags jumps
    // made while the map was already knowable — the auditable, potentially-suspect
    // kind. Failure here must not roll back the jump.
    try {
      const [fromCol, fromRow] = result.oldKey.split("_").map(Number);
      await db.collection("oilClaimLog").add({
        type: "jump", userId, username: result.username,
        fromCol, fromRow, col: newCol, row: newRow,
        phase: settings.gamePhase || null,
        anchored: !!settings.anchorBlockHash,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.error("[oil-claim-jump] audit log failed:", e.message);
    }

    // Carry pump customization to the new cell (best-effort, outside the txn).
    try {
      const oldCfgRef = db.collection("pumpConfigs").doc(`${userId}_${result.oldKey}`);
      const oldCfg = await oldCfgRef.get();
      if (oldCfg.exists) {
        await db.collection("pumpConfigs").doc(`${userId}_${targetKey}`).set(oldCfg.data(), { merge: true });
        await oldCfgRef.delete();
      }
    } catch (e) {
      console.error("[oil-claim-jump] pump carry failed:", e.message);
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[oil-claim-jump] Error:", err.message);
    const status = /already claimed|No jumps|No current plot|No drill|Already on/.test(err.message) ? 409 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
