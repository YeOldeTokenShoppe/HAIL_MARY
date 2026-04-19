"use client";

import {
  db,
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "./firebaseClient";

const COLLECTION = "shrineTestimonials";
const MAX_LEN = 200;

// Client-side profanity list. Not exhaustive — just the common stuff that
// would embarrass the shrine if it appeared in a rotating toast. Expand as
// needed; true safety requires server-side enforcement via Firestore rules
// or a Cloud Function.
const BAD_WORDS = [
  "nigger", "nigga", "faggot", "fag", "tranny", "retard", "retarded",
  "kike", "spic", "chink", "gook", "wetback", "cunt", "cock",
  "rape", "raping", "kys", "kill yourself",
];

// Rejects bare links, TLDs, and common crypto-shill domains so we don't
// end up rotating "0xDEAD...scam.xyz" across the shrine.
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

export async function postTestimonial({
  userId,
  displayName,
  avatarUrl,
  text,
  lit,
}) {
  if (!db) return { ok: false, reason: "The shrine is unreachable." };
  const v = validateTestimonial(text);
  if (!v.ok) return v;
  try {
    await addDoc(collection(db, COLLECTION), {
      userId: userId ?? null,
      displayName: displayName ?? null,
      avatarUrl: avatarUrl ?? null,
      text: v.text,
      lit: !!lit,
      createdAt: serverTimestamp(),
    });
    return { ok: true };
  } catch (err) {
    console.warn("[testimonials] postTestimonial failed:", err);
    return { ok: false, reason: "Your witness was lost in transit." };
  }
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

export async function updateTestimonial(id, { text, displayName, avatarUrl }) {
  if (!db || !id) return { ok: false, reason: "Nothing to update." };
  const patch = {};
  if (typeof text === "string") {
    const v = validateTestimonial(text);
    if (!v.ok) return v;
    patch.text = v.text;
  }
  if (typeof displayName === "string") patch.displayName = displayName;
  if (typeof avatarUrl === "string" || avatarUrl === null)
    patch.avatarUrl = avatarUrl;
  if (!Object.keys(patch).length)
    return { ok: false, reason: "Nothing to update." };
  try {
    await updateDoc(doc(db, COLLECTION, id), patch);
    return { ok: true };
  } catch (err) {
    console.warn("[testimonials] updateTestimonial failed:", err);
    return { ok: false, reason: "Your edit was struck down." };
  }
}

export async function deleteTestimonial(id) {
  if (!db || !id) return { ok: false, reason: "Nothing to delete." };
  try {
    await deleteDoc(doc(db, COLLECTION, id));
    return { ok: true };
  } catch (err) {
    console.warn("[testimonials] deleteTestimonial failed:", err);
    return { ok: false, reason: "Could not retract your witness." };
  }
}
