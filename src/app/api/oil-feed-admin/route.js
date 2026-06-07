import { NextResponse } from "next/server";
import { getAdminDb, getAdminBucket } from "@/lib/firebaseAdmin";

// Admin moderation for the Field Dispatch feed. Password-gated (ADMIN_PASSWORD).
//   action: "list"    → pending (approved:false) polaroids, newest-first
//   action: "approve" → flip a doc to approved:true (becomes publicly visible)
//   action: "reject"  → delete the doc + best-effort delete its storage blob
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { password, action, id } = body;

    if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: "no_db" }, { status: 503 });

    if (action === "list") {
      // Equality-only query (no composite index); sort newest-first in JS.
      const snap = await db
        .collection("oilFeed")
        .where("approved", "==", false)
        .limit(200)
        .get();
      const items = snap.docs
        .map((d) => {
          const x = d.data();
          return {
            id: d.id,
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
        .slice(0, 60);
      return NextResponse.json({ items });
    }

    if (action === "approve") {
      if (!id) return NextResponse.json({ error: "no_id" }, { status: 400 });
      await db.collection("oilFeed").doc(id).set({ approved: true }, { merge: true });
      return NextResponse.json({ ok: true });
    }

    if (action === "approve_all") {
      const snap = await db.collection("oilFeed").where("approved", "==", false).limit(500).get();
      if (snap.empty) return NextResponse.json({ ok: true, count: 0 });
      const batch = db.batch();
      snap.docs.forEach((d) => batch.set(d.ref, { approved: true }, { merge: true }));
      await batch.commit();
      return NextResponse.json({ ok: true, count: snap.size });
    }

    if (action === "reject") {
      if (!id) return NextResponse.json({ error: "no_id" }, { status: 400 });
      const ref = db.collection("oilFeed").doc(id);
      const snap = await ref.get();
      const storagePath = snap.exists ? snap.data().storagePath : null;
      await ref.delete();
      // Best-effort blob cleanup — failure here must not fail the rejection.
      if (storagePath) {
        try {
          const bucket = getAdminBucket();
          if (bucket) await bucket.file(storagePath).delete();
        } catch (e) {
          console.warn("[oil-feed-admin] storage delete failed:", e.message);
        }
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "bad_action" }, { status: 400 });
  } catch (e) {
    console.error("[oil-feed-admin] failed:", e.message);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
