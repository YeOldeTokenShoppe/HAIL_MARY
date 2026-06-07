import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

// Public read of the curated "Field Dispatch" feed — only admin-approved
// polaroids (gusher/hell milestones the admin chose to publish). Served via the
// admin SDK so it works without the firestore rules being deployed, and uses an
// equality-only query (no composite index needed); newest-first sort is done in JS.
export async function GET() {
  try {
    const db = getAdminDb();
    if (!db) return NextResponse.json({ items: [] });

    const snap = await db
      .collection("oilFeed")
      .where("approved", "==", true)
      .limit(200)
      .get();

    const items = snap.docs
      .map((d) => {
        const x = d.data();
        return {
          id: d.id,
          snapshotId: x.snapshotId || null,
          storageUrl: x.storageUrl || null,
          caption: x.caption || null,
          username: x.username || "A Prospector",
          eventType: x.eventType || null,
          col: x.col ?? null,
          row: x.row ?? null,
          createdAtMs: x.createdAtMs || 0,
        };
      })
      .filter((x) => x.storageUrl)
      .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
      .slice(0, 50);

    return NextResponse.json({ items });
  } catch (e) {
    console.error("[oil-feed] failed:", e.message);
    return NextResponse.json({ error: "failed", items: [] }, { status: 500 });
  }
}
