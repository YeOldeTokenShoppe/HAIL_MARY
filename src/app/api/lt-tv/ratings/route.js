// EPISODE RATINGS. One to five stars, one rating per viewer per episode.
//
// PUBLIC, unlike its neighbours under /api/lt-tv — the studio routes (run,
// script, pitch, room, status) 404 outside development because they drive the
// production pipeline. This one is for viewers, so it runs everywhere. If you
// add a route to this folder, decide which of the two it is.
//
// The rating doc and the episode's tally move together in one transaction, so
// a star average can never count a viewer twice or lose one.

import { NextResponse } from "next/server";
import { applyRating, validateRating } from "@/lib/ltTv/reactions.mjs";
import {
  FieldValue,
  checkEpisode,
  db,
  episodeRef,
  err,
  ratingRef,
  viewerId,
} from "@/lib/ltTv/reactionsServer";

export const dynamic = "force-dynamic";

/** What this viewer gave this episode. The tally itself is read from the
 *  client straight out of Firestore, so this answers only the private half. */
export async function GET(request) {
  const episodeId = new URL(request.url).searchParams.get("episodeId");
  if (!checkEpisode(episodeId)) return err(400, "No such episode.");

  const userId = await viewerId(request);
  if (!userId) return NextResponse.json({ ok: true, rating: null, signedIn: false });

  const store = db();
  if (!store) return err(500, "Ratings are unreachable right now.");

  try {
    const snap = await ratingRef(store, episodeId, userId).get();
    return NextResponse.json({
      ok: true,
      signedIn: true,
      rating: snap.exists ? snap.data().rating ?? null : null,
    });
  } catch (e) {
    console.error("[lt-tv ratings] read failed:", e);
    return err(500, "Ratings are unreachable right now.");
  }
}

/** Set this viewer's rating, or clear it with `rating: null`. */
export async function POST(request) {
  const userId = await viewerId(request);
  if (!userId) return err(401, "Sign in to rate this episode.");

  let body;
  try {
    body = await request.json();
  } catch {
    return err(400, "Malformed request.");
  }
  const { episodeId, rating } = body || {};
  if (!checkEpisode(episodeId)) return err(400, "No such episode.");

  const v = validateRating(rating === undefined ? null : rating);
  if (!v.ok) return err(400, v.reason);

  const store = db();
  if (!store) return err(500, "Ratings are unreachable right now.");

  const episode = episodeRef(store, episodeId);
  const mine = ratingRef(store, episodeId, userId);

  try {
    const tally = await store.runTransaction(async (tx) => {
      const [episodeSnap, mineSnap] = await Promise.all([tx.get(episode), tx.get(mine)]);
      const previous = mineSnap.exists ? mineSnap.data().rating ?? null : null;
      const next = v.rating;
      const stats = applyRating(episodeSnap.exists ? episodeSnap.data() : null, {
        previous,
        next,
      });

      if (next == null) {
        if (mineSnap.exists) tx.delete(mine);
      } else {
        tx.set(
          mine,
          {
            userId,
            episodeId,
            rating: next,
            updatedAt: FieldValue.serverTimestamp(),
            ...(mineSnap.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
          },
          { merge: true },
        );
      }

      tx.set(
        episode,
        {
          episodeId,
          count: stats.count,
          sum: stats.sum,
          average: stats.average,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return stats;
    });

    return NextResponse.json({ ok: true, rating: v.rating, ...tally });
  } catch (e) {
    console.error("[lt-tv ratings] write failed:", e);
    return err(500, "Your rating didn't land.");
  }
}
