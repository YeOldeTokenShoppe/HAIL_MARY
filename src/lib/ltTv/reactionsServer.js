// The server half of episode ratings and comments.
//
// WHY EVERY WRITE GOES THROUGH A ROUTE rather than straight from the browser
// to Firestore: the viewer is signed in with CLERK, and Clerk is not Firebase
// Auth, so `request.auth` in a security rule is null for them. A rule could
// therefore only say "anybody may write", which is not a rule. Instead the
// route verifies the Clerk session token, and the admin SDK does the write;
// firestore.rules refuses client writes to all three collections outright.
//
// That is the same shape as /api/testimonials, and deliberately NOT the shape
// of the old /admin page, which compares a password in the browser and then
// believes a localStorage flag.

import { verifyToken } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getAdminDb, FieldValue } from "@/lib/firebaseAdmin";
import { EPISODES_BY_ID } from "@/content/lt-tv";
import {
  COMMENTS_SUBCOLLECTION,
  EPISODES_COLLECTION,
  RATINGS_SUBCOLLECTION,
  isKnownEpisode,
} from "@/lib/ltTv/reactions.mjs";

export { FieldValue };

export function err(status, reason) {
  return NextResponse.json({ ok: false, reason }, { status });
}

/** The Clerk user id behind this request, or null. Never throws. */
export async function viewerId(request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const payload = await verifyToken(match[1], {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    return payload?.sub || null;
  } catch (e) {
    console.warn("[lt-tv reactions] token verify failed:", e.message);
    return null;
  }
}

/** The episode ids that actually exist on the slate, read at request time. */
export function slateIds() {
  return Object.keys(EPISODES_BY_ID);
}

export function checkEpisode(episodeId) {
  return isKnownEpisode(episodeId, slateIds());
}

export function episodeRef(db, episodeId) {
  return db.collection(EPISODES_COLLECTION).doc(episodeId);
}

export function ratingRef(db, episodeId, userId) {
  return episodeRef(db, episodeId).collection(RATINGS_SUBCOLLECTION).doc(userId);
}

export function commentsRef(db, episodeId) {
  return episodeRef(db, episodeId).collection(COMMENTS_SUBCOLLECTION);
}

export function db() {
  return getAdminDb();
}

// OpenAI moderation, same call and same permissiveness as the shrine's — this
// audience writes in the same dark-humour register, so a tight threshold
// would reject half the honest comments. Missing key means moderation is
// skipped rather than everything being refused; the word and link guards in
// reactions.mjs still run either way.
export async function moderate(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[lt-tv reactions] OPENAI_API_KEY missing — moderation skipped");
    return { ok: true };
  }
  try {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey });
    const res = await openai.moderations.create({
      model: "omni-moderation-latest",
      input: text,
    });
    const result = res?.results?.[0];
    if (!result) return { ok: true };
    const cats = result.categories || {};
    const scores = result.category_scores || {};
    const hard = [
      "sexual/minors",
      "hate/threatening",
      "harassment/threatening",
      "violence/graphic",
    ];
    if (hard.some((c) => cats[c])) return { ok: false, reason: "That comment was held back." };
    if ((scores.hate || 0) > 0.5) return { ok: false, reason: "That comment was held back." };
    return { ok: true };
  } catch (e) {
    // A moderation outage must not take the comments section down with it.
    console.warn("[lt-tv reactions] moderation failed open:", e.message);
    return { ok: true };
  }
}
