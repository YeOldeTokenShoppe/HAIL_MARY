"use client";

// The browser half of episode ratings and comments.
//
// EVERYTHING GOES THROUGH /api/lt-tv/*, reads included. The obvious
// alternative — reading the tally and the comments straight out of Firestore,
// which would make them live — needs a security rule granting public read on
// those collections, and a rule only takes effect when somebody runs a deploy
// for it. That is a command nobody should have to remember before a feature
// works. Through the route, the admin SDK does the reading and the comments
// are simply there when the site redeploys.
//
// The cost is that a second viewer's comment appears on the next refresh
// rather than as it is typed, which is how comments under a video behave
// anyway. Writes refresh the feed themselves.

import { validateComment, validateRating } from "./ltTv/reactions.mjs";

// COMING BACK FROM A SIGN-IN. Signing in navigates, so the half-written
// comment in the box and the fact that the comments were even open are gone by
// the time the viewer is back. The address bar remembers the episode (see
// src/lib/ltTv/watchUrl.mjs); this remembers the rest, in sessionStorage,
// which is per tab and survives the round trip.
//
// Every access is wrapped: a browser with storage blocked must lose the draft,
// not break the comments.
const RETURN_KEY = "lttv:signin-return";
const RETURN_TTL_MS = 30 * 60 * 1000;

export function rememberBeforeSignIn(episodeId, { draft = "", rating = null } = {}) {
  if (typeof window === "undefined" || !episodeId) return;
  try {
    window.sessionStorage.setItem(
      RETURN_KEY,
      JSON.stringify({ episodeId, draft: draft || "", rating: rating ?? null, at: Date.now() }),
    );
  } catch {
    // Storage blocked; the sign-in still works, what was in hand just does not
    // survive it.
  }
}

/** What was in hand before the sign-in — the draft, and the star they had
 *  just clicked — without consuming it. */
export function peekSignInReturn() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(RETURN_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved?.episodeId) return null;
    // A day-old draft is not what the viewer is in the middle of.
    if (!saved.at || Date.now() - saved.at > RETURN_TTL_MS) {
      clearSignInReturn();
      return null;
    }
    return {
      episodeId: saved.episodeId,
      draft: saved.draft || "",
      rating: Number.isInteger(saved.rating) ? saved.rating : null,
    };
  } catch {
    return null;
  }
}

export function clearSignInReturn() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(RETURN_KEY);
  } catch {
    // Nothing to do; it will expire on its own.
  }
}

export const EMPTY_STATS = { count: 0, sum: 0, average: 0, commentCount: 0 };

/** The episode's tally and its comments, newest first. No sign-in needed. */
export async function fetchEpisodeReactions(episodeId) {
  if (!episodeId) return { ok: true, stats: EMPTY_STATS, comments: [] };
  try {
    const res = await fetch(
      `/api/lt-tv/comments?episodeId=${encodeURIComponent(episodeId)}`,
      { cache: "no-store" },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, stats: EMPTY_STATS, comments: [] };
    return {
      ok: true,
      stats: { ...EMPTY_STATS, ...(data.stats || {}) },
      comments: Array.isArray(data.comments) ? data.comments : [],
    };
  } catch (error) {
    console.warn("[lt-tv reactions] feed failed:", error);
    return { ok: false, stats: EMPTY_STATS, comments: [] };
  }
}

async function call(path, method, body, getToken) {
  if (typeof getToken !== "function") return { ok: false, reason: "Sign in first." };
  let token = null;
  try {
    token = await getToken();
  } catch {
    token = null;
  }
  if (!token) return { ok: false, reason: "Sign in first." };
  try {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, reason: data?.reason || "That didn't land." };
    return { ok: true, ...data };
  } catch (error) {
    console.warn("[lt-tv reactions] request failed:", error);
    return { ok: false, reason: "That didn't land." };
  }
}

/** The star this viewer already gave, or null. Signed out is not an error. */
export async function fetchMyRating(episodeId, getToken) {
  if (!episodeId || typeof getToken !== "function") return { ok: true, rating: null };
  let token = null;
  try {
    token = await getToken();
  } catch {
    token = null;
  }
  if (!token) return { ok: true, rating: null };
  try {
    const res = await fetch(
      `/api/lt-tv/ratings?episodeId=${encodeURIComponent(episodeId)}`,
      { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, reason: data?.reason || "Couldn't read your rating." };
    return { ok: true, rating: data.rating ?? null };
  } catch (error) {
    console.warn("[lt-tv reactions] rating read failed:", error);
    return { ok: false, reason: "Couldn't read your rating." };
  }
}

/** Set this viewer's rating. Pass null to take it back. */
export async function saveRating(episodeId, rating, getToken) {
  const v = validateRating(rating === undefined ? null : rating);
  if (!v.ok) return v;
  return call("/api/lt-tv/ratings", "POST", { episodeId, rating: v.rating }, getToken);
}

export async function postComment({ episodeId, text, displayName, avatarUrl, getToken }) {
  const v = validateComment(text);
  if (!v.ok) return v;
  return call(
    "/api/lt-tv/comments",
    "POST",
    { episodeId, text: v.text, displayName, avatarUrl },
    getToken,
  );
}

export async function editComment({ episodeId, id, text, getToken }) {
  const v = validateComment(text);
  if (!v.ok) return v;
  return call("/api/lt-tv/comments", "PATCH", { episodeId, id, text: v.text }, getToken);
}

export async function deleteComment({ episodeId, id, getToken }) {
  return call("/api/lt-tv/comments", "DELETE", { episodeId, id }, getToken);
}
