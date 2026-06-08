import { NextResponse } from "next/server";
import { getAdminDb, getAdminBucket } from "@/lib/firebaseAdmin";
import { creditBonusDrills } from "@/lib/oilBonus";

// Award the social-share depth bonus to a feed post's owner, once. The admin
// approval IS the anti-sybil gate (a vetted, shareable moment). Idempotent via a
// `depthCredited` flag on the doc; only marks once a real rig was credited (so a
// post made before the player claimed can still pay out on a later approval).
async function creditShareBonus(db, ref, data) {
  if (!data.userId || data.depthCredited) return 0;
  try {
    const res = await creditBonusDrills(db, data.userId, "share");
    if (res.credited > 0 || res.reason === "capped") {
      await ref.set({ depthCredited: true }, { merge: true });
    }
    return res.credited;
  } catch (e) {
    console.warn("[oil-feed-admin] share bonus failed:", e.message);
    return 0;
  }
}

// Admin moderation for the Field Dispatch feed. Password-gated (ADMIN_PASSWORD).
//   action: "list"    → pending (approved:false) polaroids, newest-first
//   action: "approve" → flip a doc to approved:true (becomes publicly visible)
//                       + award the poster the social-share depth bonus (once)
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
      const ref = db.collection("oilFeed").doc(id);
      const snap = await ref.get();
      if (!snap.exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
      await ref.set({ approved: true }, { merge: true });
      const depthCredited = await creditShareBonus(db, ref, snap.data());
      return NextResponse.json({ ok: true, depthCredited });
    }

    if (action === "approve_all") {
      const snap = await db.collection("oilFeed").where("approved", "==", false).limit(500).get();
      if (snap.empty) return NextResponse.json({ ok: true, count: 0 });
      // Per-doc (not a single batch) so each post's owner can be credited the
      // share bonus in its own transaction.
      let depthCredited = 0;
      for (const d of snap.docs) {
        await d.ref.set({ approved: true }, { merge: true });
        depthCredited += await creditShareBonus(db, d.ref, d.data());
      }
      return NextResponse.json({ ok: true, count: snap.size, depthCredited });
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
