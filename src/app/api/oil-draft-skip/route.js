import { NextResponse } from "next/server";
import { getAdminDb, FieldValue, Timestamp } from "@/lib/firebaseAdmin";

export async function POST(req) {
  try {
    const { adminPassword } = await req.json();

    const correct = process.env.ADMIN_PASSWORD;
    if (!correct || adminPassword !== correct) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    const settingsRef = db.collection("oilGame").doc("settings");
    const ticketsCol = db.collection("oilTickets");

    const settingsSnap = await settingsRef.get();
    if (!settingsSnap.exists) {
      return NextResponse.json({ error: "Game settings not found" }, { status: 404 });
    }

    const settings = settingsSnap.data();
    if (settings.gamePhase !== "grid_locked") {
      return NextResponse.json({ error: "Not in draft phase" }, { status: 400 });
    }

    const currentPick = settings.currentPickOrder || 1;
    const gridSize = settings.gridSize || 10;
    const pickWindowMinutes = settings.pickWindowMinutes || 120;

    const pickerSnap = await ticketsCol.where("purchaseOrder", "==", currentPick).get();
    if (pickerSnap.empty) {
      return NextResponse.json({ error: "No ticket for current pick order" }, { status: 404 });
    }
    const pickerDoc = pickerSnap.docs[0];

    const allTicketsSnap = await ticketsCol.where("plotCol", "!=", null).get();
    const takenPlots = new Set();
    allTicketsSnap.forEach((d) => {
      const t = d.data();
      takenPlots.add(`${t.plotCol},${t.plotRow}`);
    });

    const available = [];
    for (let col = 0; col < gridSize; col++) {
      for (let row = 0; row < gridSize; row++) {
        if (!takenPlots.has(`${col},${row}`)) {
          available.push({ col, row });
        }
      }
    }

    if (available.length === 0) {
      return NextResponse.json({ error: "No available plots" }, { status: 400 });
    }

    const pick = available[Math.floor(Math.random() * available.length)];

    await pickerDoc.ref.update({
      plotCol: pick.col,
      plotRow: pick.row,
      pickedAt: FieldValue.serverTimestamp(),
      skipped: true,
    });

    const newDeadline = Timestamp.fromDate(
      new Date(Date.now() + pickWindowMinutes * 60 * 1000)
    );
    await settingsRef.update({
      currentPickOrder: currentPick + 1,
      pickDeadline: newDeadline,
    });

    return NextResponse.json({
      ok: true,
      skippedUser: pickerDoc.data().clerkName,
      assignedPlot: pick,
      nextPickOrder: currentPick + 1,
    });
  } catch (err) {
    console.error("[oil-draft-skip] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
