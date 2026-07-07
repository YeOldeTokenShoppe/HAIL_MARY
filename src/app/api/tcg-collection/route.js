import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { authedUserId } from "@/lib/oilAuth";
import { ensureCollection } from "@/lib/tcgCollection";

export const runtime = "nodejs";

// ── GET /api/tcg-collection ──
// Returns the caller's card collection, granting the free starter set on
// first call (idempotent — the grant is transaction-guarded). Identity comes
// from the verified Clerk session token, never the request body, so a player
// can only ever read or seed their own collection.
export async function GET(req) {
  try {
    const userId = await authedUserId(req);
    if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const db = getAdminDb();
    const collection = await ensureCollection(db, userId);
    return NextResponse.json(collection);
  } catch (err) {
    console.error("[tcg-collection] failed:", err);
    return NextResponse.json({ error: "collection-unavailable" }, { status: 500 });
  }
}
