import { NextResponse } from "next/server";
import {
  db,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "@/lib/firebaseServer";

export async function POST(req) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
    }

    const { adminPassword } = await req.json();

    // Verify admin
    const correct = process.env.ADMIN_PASSWORD;
    if (!correct || adminPassword !== correct) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read current game settings
    const settingsRef = doc(db, "oilGame", "settings");
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      return NextResponse.json({ error: "Game settings not found" }, { status: 404 });
    }

    const settings = settingsSnap.data();
    if (settings.gamePhase !== "grid_locked") {
      return NextResponse.json({ error: "Not in draft phase" }, { status: 400 });
    }

    const currentPick = settings.currentPickOrder || 1;
    const gridSize = settings.gridSize || 10;
    const pickWindowMinutes = settings.pickWindowMinutes || 120;

    // Find the current picker's ticket
    const ticketsCol = collection(db, "oilTickets");
    const pickerQuery = query(ticketsCol, where("purchaseOrder", "==", currentPick));
    const pickerSnap = await getDocs(pickerQuery);

    if (pickerSnap.empty) {
      return NextResponse.json({ error: "No ticket for current pick order" }, { status: 404 });
    }

    const pickerDoc = pickerSnap.docs[0];

    // Get all taken plots
    const allTicketsSnap = await getDocs(query(ticketsCol, where("plotCol", "!=", null)));
    const takenPlots = new Set();
    allTicketsSnap.forEach((d) => {
      const t = d.data();
      takenPlots.add(`${t.plotCol},${t.plotRow}`);
    });

    // Find available plots
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

    // Assign random plot
    const pick = available[Math.floor(Math.random() * available.length)];

    // Update picker's ticket
    await updateDoc(pickerDoc.ref, {
      plotCol: pick.col,
      plotRow: pick.row,
      pickedAt: serverTimestamp(),
      skipped: true,
    });

    // Advance to next picker + set new deadline
    const newDeadline = Timestamp.fromDate(
      new Date(Date.now() + pickWindowMinutes * 60 * 1000)
    );
    await updateDoc(settingsRef, {
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
