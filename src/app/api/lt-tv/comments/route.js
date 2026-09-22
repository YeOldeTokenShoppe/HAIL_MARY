// EPISODE COMMENTS. Signed in to write, anyone may read.
//
// PUBLIC, unlike the studio routes in this folder — see the note at the top of
// ../ratings/route.js.
//
// A comment and the episode's comment count move together in one transaction,
// so the number on the console is the number of comments underneath it.
// Editing and deleting are restricted to the comment's own author by comparing
// the stored Clerk user id with the one on the verified token; nothing about
// that check happens in the browser.

import { NextResponse } from "next/server";
import {
  COMMENT_RATE_COLLECTION,
  applyCommentDelta,
  normaliseName,
  validateComment,
} from "@/lib/ltTv/reactions.mjs";
import {
  FieldValue,
  checkEpisode,
  commentsRef,
  db,
  episodeRef,
  err,
  moderate,
  viewerId,
} from "@/lib/ltTv/reactionsServer";

export const dynamic = "force-dynamic";

const MAX_PER_HOUR = 5;
const FEED_LIMIT = 100;
const MAX_PER_DAY = 30;

// Same counter shape as the shrine's: a list of post times per viewer, pruned
// to a day. Cheap, and it survives a cold start because it is in Firestore
// rather than in this container's memory.
async function checkAndRecordRate(store, userId) {
  const ref = store.collection(COMMENT_RATE_COLLECTION).doc(userId);
  try {
    await store.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const now = Date.now();
      const dayAgo = now - 24 * 60 * 60 * 1000;
      const hourAgo = now - 60 * 60 * 1000;
      const prev = snap.exists ? snap.data().posts || [] : [];
      const recent = prev.filter((t) => t > dayAgo);
      if (recent.filter((t) => t > hourAgo).length >= MAX_PER_HOUR) throw new Error("RATE_HOUR");
      if (recent.length >= MAX_PER_DAY) throw new Error("RATE_DAY");
      recent.push(now);
      tx.set(ref, { posts: recent.slice(-MAX_PER_DAY), updatedAt: FieldValue.serverTimestamp() });
    });
    return { ok: true };
  } catch (e) {
    if (e.message === "RATE_HOUR")
      return { ok: false, reason: "Slow down — that's five comments this hour." };
    if (e.message === "RATE_DAY")
      return { ok: false, reason: "You've hit today's comment limit. Come back tomorrow." };
    throw e;
  }
}

/**
 * The episode's comments, newest first, with its tally. PUBLIC — no token,
 * because anybody may read an episode's comments.
 *
 * READS COME THROUGH HERE rather than from the browser straight to Firestore.
 * They could have gone direct and been live, but that needs a rule granting
 * public read on these collections, and a rules change only takes effect when
 * somebody deploys it — so the feature would look broken on the site until a
 * separate command was run. Through the route, the admin SDK reads it and the
 * comments are there the moment the site redeploys.
 */
export async function GET(request) {
  const episodeId = new URL(request.url).searchParams.get("episodeId");
  if (!checkEpisode(episodeId)) return err(400, "No such episode.");

  const store = db();
  if (!store) return err(500, "Comments are unreachable right now.");

  try {
    const [episodeSnap, feed] = await Promise.all([
      episodeRef(store, episodeId).get(),
      commentsRef(store, episodeId).orderBy("createdAt", "desc").limit(FEED_LIMIT).get(),
    ]);
    const stats = episodeSnap.exists ? episodeSnap.data() : {};
    return NextResponse.json({
      ok: true,
      stats: {
        count: stats.count || 0,
        sum: stats.sum || 0,
        average: stats.average || 0,
        commentCount: stats.commentCount || 0,
      },
      comments: feed.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId || null,
          displayName: data.displayName || "Viewer",
          avatarUrl: data.avatarUrl || null,
          text: data.text || "",
          edited: !!data.edited,
          // Milliseconds, so the browser needs nothing from the Firestore SDK
          // to say how long ago a comment was written.
          createdAt: data.createdAt?.toMillis?.() ?? null,
        };
      }),
    });
  } catch (e) {
    console.error("[lt-tv comments] feed failed:", e);
    return err(500, "Comments are unreachable right now.");
  }
}

export async function POST(request) {
  const userId = await viewerId(request);
  if (!userId) return err(401, "Sign in to comment.");

  let body;
  try {
    body = await request.json();
  } catch {
    return err(400, "Malformed request.");
  }
  const { episodeId, text, displayName, avatarUrl } = body || {};
  if (!checkEpisode(episodeId)) return err(400, "No such episode.");

  const v = validateComment(text);
  if (!v.ok) return err(400, v.reason);

  const m = await moderate(v.text);
  if (!m.ok) return err(400, m.reason);

  const store = db();
  if (!store) return err(500, "Comments are unreachable right now.");

  const rate = await checkAndRecordRate(store, userId);
  if (!rate.ok) return err(429, rate.reason);

  const episode = episodeRef(store, episodeId);
  const doc = commentsRef(store, episodeId).doc();

  try {
    await store.runTransaction(async (tx) => {
      const episodeSnap = await tx.get(episode);
      tx.set(doc, {
        userId,
        episodeId,
        displayName: normaliseName(displayName),
        avatarUrl: typeof avatarUrl === "string" ? avatarUrl : null,
        text: v.text,
        edited: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(
        episode,
        {
          episodeId,
          commentCount: applyCommentDelta(episodeSnap.exists ? episodeSnap.data() : null, 1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    return NextResponse.json({ ok: true, id: doc.id });
  } catch (e) {
    console.error("[lt-tv comments] create failed:", e);
    return err(500, "Your comment didn't land.");
  }
}

export async function PATCH(request) {
  const userId = await viewerId(request);
  if (!userId) return err(401, "Sign in to comment.");

  let body;
  try {
    body = await request.json();
  } catch {
    return err(400, "Malformed request.");
  }
  const { episodeId, id, text } = body || {};
  if (!checkEpisode(episodeId)) return err(400, "No such episode.");
  if (!id || typeof id !== "string") return err(400, "Nothing to update.");

  const v = validateComment(text);
  if (!v.ok) return err(400, v.reason);

  const m = await moderate(v.text);
  if (!m.ok) return err(400, m.reason);

  const store = db();
  if (!store) return err(500, "Comments are unreachable right now.");

  const ref = commentsRef(store, episodeId).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return err(404, "That comment is gone.");
  if (snap.data().userId !== userId) return err(403, "That comment isn't yours to edit.");

  try {
    await ref.update({ text: v.text, edited: true, updatedAt: FieldValue.serverTimestamp() });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[lt-tv comments] update failed:", e);
    return err(500, "Your edit didn't land.");
  }
}

export async function DELETE(request) {
  const userId = await viewerId(request);
  if (!userId) return err(401, "Sign in to comment.");

  let body;
  try {
    body = await request.json();
  } catch {
    return err(400, "Malformed request.");
  }
  const { episodeId, id } = body || {};
  if (!checkEpisode(episodeId)) return err(400, "No such episode.");
  if (!id || typeof id !== "string") return err(400, "Nothing to delete.");

  const store = db();
  if (!store) return err(500, "Comments are unreachable right now.");

  const episode = episodeRef(store, episodeId);
  const ref = commentsRef(store, episodeId).doc(id);

  try {
    await store.runTransaction(async (tx) => {
      const [snap, episodeSnap] = await Promise.all([tx.get(ref), tx.get(episode)]);
      // Already gone is a success: the viewer wanted it not to be there.
      if (!snap.exists) return;
      if (snap.data().userId !== userId) throw new Error("NOT_YOURS");
      tx.delete(ref);
      tx.set(
        episode,
        {
          commentCount: applyCommentDelta(episodeSnap.exists ? episodeSnap.data() : null, -1),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e.message === "NOT_YOURS") return err(403, "That comment isn't yours to delete.");
    console.error("[lt-tv comments] delete failed:", e);
    return err(500, "That comment wouldn't delete.");
  }
}
