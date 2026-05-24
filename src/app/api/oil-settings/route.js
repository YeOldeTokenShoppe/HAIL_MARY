import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";

// Whitelist of fields the admin UI is allowed to set on oilGame/settings.
// ticketCount / currentPickOrder / pickDeadline are excluded — those are
// owned by /api/oil-ticket and /api/oil-draft-skip and must not be writable
// from this endpoint to prevent admin-side tampering with the draft order
// or ticket count.
const ALLOWED_FIELDS = new Set([
  "blockHash",
  "numberOfDeposits",
  "totalOilBudget",
  "gridSize",
  "gamePhase",
  "gameEnded",
  "gameDay",
  "gameStartDate",
]);

export async function POST(req) {
  try {
    const { adminPassword, settings } = await req.json();

    const correct = process.env.ADMIN_PASSWORD;
    if (!correct || adminPassword !== correct) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!settings || typeof settings !== "object") {
      return NextResponse.json({ error: "Missing settings object" }, { status: 400 });
    }

    const filtered = {};
    for (const [key, value] of Object.entries(settings)) {
      if (ALLOWED_FIELDS.has(key)) filtered[key] = value;
    }

    if (Object.keys(filtered).length === 0) {
      return NextResponse.json({ error: "No valid settings fields provided" }, { status: 400 });
    }

    const db = getAdminDb();
    await db.collection("oilGame").doc("settings").set(
      { ...filtered, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    return NextResponse.json({ ok: true, written: Object.keys(filtered) });
  } catch (err) {
    console.error("[oil-settings] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
