import { NextResponse } from "next/server";
import {
  db, doc, setDoc, collection, getDocs, deleteDoc, serverTimestamp,
} from "@/lib/firebaseServer";

const FAKE_NAMES = [
  "DrillSgt", "PetroMax", "OilBaron99", "GusherQueen", "DeepStrike",
  "ShaleHunter", "CrudeDude", "BarrelRoll", "PumpKing", "WildcatWilma",
  "DerrickDan", "SpudMuffin", "BlackGold", "RigPig", "BitBorer",
  "SlickRick", "PipelinePat", "WellDone", "DrillerThriller", "TexOil",
];

export async function POST(req) {
  try {
    const { password, count = 15, clear = false } = await req.json();

    const correct = process.env.ADMIN_PASSWORD;
    if (!correct || password !== correct) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    if (!db) {
      return NextResponse.json({ ok: false, error: "DB unavailable" }, { status: 503 });
    }

    // Clear previous fake data if requested
    if (clear) {
      const plotSnap = await getDocs(collection(db, "oilPlots"));
      const drillSnap = await getDocs(collection(db, "oilDrills"));
      let cleared = 0;
      for (const d of plotSnap.docs) {
        if (d.data().currentOwnerId?.startsWith("fake_")) {
          await deleteDoc(doc(db, "oilPlots", d.id));
          cleared++;
        }
      }
      for (const d of drillSnap.docs) {
        if (d.id.startsWith("fake_")) {
          await deleteDoc(doc(db, "oilDrills", d.id));
          cleared++;
        }
      }
      if (clear === "only") {
        return NextResponse.json({ ok: true, cleared });
      }
    }

    // Build a set of already-claimed plots
    const existingSnap = await getDocs(collection(db, "oilPlots"));
    const claimed = new Set();
    existingSnap.docs.forEach((d) => {
      if (d.data().currentOwnerId) claimed.add(d.id);
    });

    // Seed fake players
    const gridSize = 10;
    const maxDepth = 20;
    const seeded = [];

    for (let i = 0; i < Math.min(count, FAKE_NAMES.length); i++) {
      const userId = `fake_${i}`;
      const username = FAKE_NAMES[i];

      // Pick a random unclaimed plot
      let col, row, key;
      let attempts = 0;
      do {
        col = Math.floor(Math.random() * gridSize);
        row = Math.floor(Math.random() * gridSize);
        key = `${col}_${row}`;
        attempts++;
      } while (claimed.has(key) && attempts < 200);

      if (claimed.has(key)) continue;
      claimed.add(key);

      // Random drill depth — weighted toward moderate depths
      const drillDay = Math.min(maxDepth, Math.floor(1 + Math.random() * 14 + Math.random() * 5));

      // Write oilPlots
      await setDoc(doc(db, "oilPlots", key), {
        col,
        row,
        drillDay,
        currentOwnerId: userId,
        ownerHistory: [{ userId, claimedAt: new Date().toISOString() }],
        disqualified: false,
      });

      // Write oilDrills
      await setDoc(doc(db, "oilDrills", userId), {
        userId,
        col,
        row,
        drillDay,
        username,
        totalCollected: 0,
        bonusDrills: Math.floor(Math.random() * 3),
        claimJumpsUsed: 0,
        tankDrains: 0,
        updatedAt: serverTimestamp(),
      });

      seeded.push({ userId, username, col, row, drillDay });
    }

    return NextResponse.json({ ok: true, seeded: seeded.length, players: seeded });
  } catch (err) {
    console.error("[oil-seed-test] Error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
