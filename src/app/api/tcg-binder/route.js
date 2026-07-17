import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { getCollection } from "@/lib/tcgCollection";

export const runtime = "nodejs";

// ── GET /api/tcg-binder?u=<userId> ──
//
// Public, read-only view of a user's card collection for shareable binders —
// the access model firestore.rules already declares (cardCollections has
// public read; the only writers are server routes). Returns just the card
// map and total; no auth, no side effects (never triggers a starter grant —
// that stays on the owner's own /api/tcg-collection fetch).
export async function GET(request) {
  try {
    const userId = request.nextUrl.searchParams.get("u");
    if (!userId || typeof userId !== "string" || userId.length > 128 || !/^[\w-]+$/.test(userId)) {
      return NextResponse.json({ error: "invalid-user" }, { status: 400 });
    }
    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "firestore-unavailable" }, { status: 503 });

    const collection = await getCollection(db, userId);
    if (!collection) return NextResponse.json({ error: "binder-not-found" }, { status: 404 });

    return NextResponse.json({ cards: collection.cards, total: collection.total });
  } catch (err) {
    console.error("[tcg-binder] failed:", err);
    return NextResponse.json({ error: "binder-fetch-failed" }, { status: 500 });
  }
}
