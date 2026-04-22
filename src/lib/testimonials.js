"use client";

import {
  db,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "./firebaseClient";

const COLLECTION = "shrineTestimonials";
const MAX_LEN = 200;

// Mirrors the server validator in /api/testimonials. Kept client-side so
// we can give instant feedback in the modal; the server re-validates
// (plus runs AI moderation + rate limits) and is the real gate.
const BAD_WORDS = [
  "nigger", "nigga", "faggot", "fag", "tranny", "retard", "retarded",
  "kike", "spic", "chink", "gook", "wetback", "cunt", "cock",
  "rape", "raping", "kys", "kill yourself",
];
const URL_RE =
  /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|xyz|co|link|app|finance|fun|lol|cash|gift|money|ai|gg|club|shop|to|me)\b/i;

export function validateTestimonial(text) {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { ok: false, reason: "Speak something, faithful." };
  if (trimmed.length > MAX_LEN)
    return { ok: false, reason: `Max ${MAX_LEN} characters.` };
  if (URL_RE.test(trimmed))
    return { ok: false, reason: "Links are not welcome here." };
  const lower = trimmed.toLowerCase();
  for (const word of BAD_WORDS) {
    if (lower.includes(word))
      return { ok: false, reason: "Your words were struck down." };
  }
  return { ok: true, text: trimmed };
}

async function callApi(method, body, getToken) {
  if (typeof getToken !== "function")
    return { ok: false, reason: "Sign in to speak." };
  let token;
  try {
    token = await getToken();
  } catch {
    token = null;
  }
  if (!token) return { ok: false, reason: "Sign in to speak." };
  try {
    const res = await fetch("/api/testimonials", {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      return { ok: false, reason: data?.reason || "Your witness was lost in transit." };
    return { ok: true, ...data };
  } catch (err) {
    console.warn("[testimonials] api call failed:", err);
    return { ok: false, reason: "Your witness was lost in transit." };
  }
}

export async function postTestimonial({
  displayName,
  avatarUrl,
  text,
  lit,
  getToken,
}) {
  const v = validateTestimonial(text);
  if (!v.ok) return v;
  return callApi(
    "POST",
    { text: v.text, displayName, avatarUrl, lit: !!lit },
    getToken,
  );
}

export async function updateTestimonial(id, { text, displayName, avatarUrl, getToken }) {
  if (!id) return { ok: false, reason: "Nothing to update." };
  const patch = { id };
  if (typeof text === "string") {
    const v = validateTestimonial(text);
    if (!v.ok) return v;
    patch.text = v.text;
  }
  if (typeof displayName === "string") patch.displayName = displayName;
  if (typeof avatarUrl === "string" || avatarUrl === null)
    patch.avatarUrl = avatarUrl;
  if (Object.keys(patch).length <= 1)
    return { ok: false, reason: "Nothing to update." };
  return callApi("PATCH", patch, getToken);
}

export async function deleteTestimonial(id, { getToken } = {}) {
  if (!id) return { ok: false, reason: "Nothing to delete." };
  return callApi("DELETE", { id }, getToken);
}

// Realtime feed, newest first. Returns unsubscribe fn.
export function subscribeTestimonials(onChange, max = 30) {
  if (!db) return () => {};
  const q = query(
    collection(db, COLLECTION),
    orderBy("createdAt", "desc"),
    limit(max),
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAtMs: data.createdAt?.toMillis?.() ?? Date.now(),
      };
    });
    onChange(items);
  });
}

// Subscribe to a single user's testimonies for the edit/delete UI in the
// modal. No orderBy (would require a composite index) — we sort
// client-side after receiving the snapshot.
export function subscribeUserTestimonials(userId, onChange, max = 20) {
  if (!db || !userId) {
    onChange([]);
    return () => {};
  }
  const q = query(
    collection(db, COLLECTION),
    where("userId", "==", userId),
    limit(max),
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAtMs: data.createdAt?.toMillis?.() ?? Date.now(),
        };
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
    onChange(items);
  });
}
