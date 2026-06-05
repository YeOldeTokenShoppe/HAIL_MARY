import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";

export const runtime = "nodejs";

// Transfer the authenticated user's plot to another (qualified) player, optionally
// moving premium upgrades. Server verifies: the SENDER is the session user and
// still owns the plot, the recipient exists + is qualified — both re-checked
// inside the transaction.
export async function POST(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { recipientUsername, transferUpgrades } = await req.json().catch(() => ({}));
    const uname = typeof recipientUsername === "string" ? recipientUsername.trim() : "";
    if (!uname) return NextResponse.json({ error: "Enter a username" }, { status: 400 });

    const db = getAdminDb();
    const senderDrillRef = db.collection("oilDrills").doc(userId);
    const senderSnap = await senderDrillRef.get();
    if (!senderSnap.exists || senderSnap.data().col == null) {
      return NextResponse.json({ error: "You have no plot to transfer" }, { status: 400 });
    }
    const senderCol = senderSnap.data().col;
    const senderRow = senderSnap.data().row;

    const recipSnap = await db.collection("oilDrills").where("username", "==", uname).limit(1).get();
    if (recipSnap.empty) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const recipientId = recipSnap.docs[0].data().userId || recipSnap.docs[0].id;
    if (recipientId === userId) {
      return NextResponse.json({ error: "Cannot transfer to yourself" }, { status: 400 });
    }

    const senderKey = `${senderCol}_${senderRow}`;
    const senderPlotRef = db.collection("oilPlots").doc(senderKey);
    const recipDrillRef = db.collection("oilDrills").doc(recipientId);
    const recipQualRef = db.collection("oilQualified").doc(recipientId);
    const nowIso = new Date().toISOString();

    await db.runTransaction(async (t) => {
      const qualCheck = await t.get(recipQualRef);
      if (!qualCheck.exists || !qualCheck.data().qualified) throw new Error("Recipient not qualified");

      const senderPlotSnap = await t.get(senderPlotRef);
      if (!senderPlotSnap.exists || senderPlotSnap.data().currentOwnerId !== userId) {
        throw new Error("You no longer own this plot");
      }
      const recipDrillSnap = await t.get(recipDrillRef);
      const recipDrill = recipDrillSnap.exists ? recipDrillSnap.data() : {};

      // Release the recipient's existing (different) plot, if any.
      if (recipDrill.col != null && `${recipDrill.col}_${recipDrill.row}` !== senderKey) {
        t.set(db.collection("oilPlots").doc(`${recipDrill.col}_${recipDrill.row}`), {
          currentOwnerId: null,
          ownerHistory: FieldValue.arrayUnion({ userId: recipientId, releasedAt: nowIso, reason: "transfer_received_new" }),
        }, { merge: true });
      }

      // Reassign the sender's plot to the recipient (history records both sides).
      t.set(senderPlotRef, {
        col: senderCol, row: senderRow,
        currentOwnerId: recipientId,
        ownerHistory: FieldValue.arrayUnion(
          { userId, releasedAt: nowIso, reason: "transfer_out" },
          { userId: recipientId, claimedAt: nowIso, reason: "transfer_in" },
        ),
        disqualified: false,
      }, { merge: true });

      t.set(recipDrillRef, { col: senderCol, row: senderRow, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      t.set(recipQualRef, { plotCol: senderCol, plotRow: senderRow }, { merge: true });
      t.set(senderDrillRef, { col: null, row: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      t.set(db.collection("oilQualified").doc(userId), { plotCol: null, plotRow: null }, { merge: true });
    });

    // Move premium upgrades into the recipient's account (best-effort).
    if (transferUpgrades) {
      try {
        const sP = db.collection("oilPurchases").doc(userId);
        const rP = db.collection("oilPurchases").doc(recipientId);
        const [sSnap, rSnap] = await Promise.all([sP.get(), rP.get()]);
        const sUnlocked = sSnap.exists ? (sSnap.data().unlocked || {}) : {};
        const rUnlocked = rSnap.exists ? (rSnap.data().unlocked || {}) : {};
        const merged = { ...rUnlocked };
        const clearSender = {};
        for (const k of Object.keys(sUnlocked)) {
          merged[k] = true;
          clearSender[`unlocked.${k}`] = FieldValue.delete();
        }
        await rP.set({ unlocked: merged }, { merge: true });
        if (Object.keys(clearSender).length) await sP.update(clearSender);
      } catch (e) {
        console.error("[oil-transfer] upgrade move failed:", e.message);
      }
    }

    return NextResponse.json({ ok: true, recipientId });
  } catch (err) {
    console.error("[oil-transfer] Error:", err.message);
    const status = /not qualified|no longer own|not found|yourself|no plot/.test(err.message) ? 409 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
