"use client";

import { Timestamp } from "firebase/firestore";
import {
  db,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "./firebaseClient";

const COLLECTION = "shrineCandles";
// Separate collection for cosmetic/customization state so it can outlive
// the lit/unlit lifecycle of the shrineCandles doc — a user who signs in
// on a new device should see their saint decal + wax tint even before
// lighting anything. Intentionally keyed by the same userId, so the two
// docs can be read in parallel on sign-in.
const PREFS_COLLECTION = "shrineCandlePrefs";
// Firestore doc size limit is 1,048,576 bytes. Leave headroom for the
// rest of the doc fields (userId, tint, timestamps, etc.) by capping the
// image data URL at ~900KB. If a user's upload exceeds this, we keep it
// local-only and surface a notice via the caller.
export const PREFS_IMAGE_MAX_BYTES = 900_000;

// Read the current user's lit candle (or null). Returns the raw doc data
// plus `litAtMs` so callers don't need to know about Firestore Timestamps.
export async function readCandle(userId) {
  if (!db || !userId) return null;
  try {
    const snap = await getDoc(doc(db, COLLECTION, userId));
    if (!snap.exists()) return null;
    const data = snap.data();
    const litAtMs = data.litAt?.toMillis?.() ?? null;
    return { ...data, litAtMs };
  } catch (err) {
    console.warn("[candleRitual] readCandle failed:", err);
    return null;
  }
}

export async function lightCandle(
  userId,
  { displayName, avatarUrl, litAtMs } = {},
) {
  if (!db || !userId) return;
  try {
    await setDoc(doc(db, COLLECTION, userId), {
      userId,
      displayName: displayName ?? null,
      avatarUrl: avatarUrl ?? null,
      // Preserve a caller-supplied timestamp (e.g. when promoting an
      // anonymous candle that was lit before sign-in) so the melt timer
      // continues from the original ignition instead of resetting.
      litAt:
        typeof litAtMs === "number"
          ? Timestamp.fromMillis(litAtMs)
          : serverTimestamp(),
    });
  } catch (err) {
    console.warn("[candleRitual] lightCandle failed:", err);
  }
}

export async function extinguishCandle(userId) {
  if (!db || !userId) return;
  try {
    await deleteDoc(doc(db, COLLECTION, userId));
  } catch (err) {
    console.warn("[candleRitual] extinguishCandle failed:", err);
  }
}

// ---------- CUSTOMIZATION PREFS ----------
// Cosmetic prefs survive extinguish, so they live in a parallel collection.
// Fields: { variant, votiveImage, votiveTint, updatedAt }. Any field may
// be missing; callers should treat null/undefined as "use default".

export async function readCandlePrefs(userId) {
  if (!db || !userId) return null;
  try {
    const snap = await getDoc(doc(db, PREFS_COLLECTION, userId));
    if (!snap.exists()) return null;
    return snap.data();
  } catch (err) {
    console.warn("[candleRitual] readCandlePrefs failed:", err);
    return null;
  }
}

// Write a subset of prefs fields. `patch` keys override existing doc
// fields; a key explicitly set to null clears that field. Uses merge so
// callers can update one pref at a time without having to re-send the
// whole object. Returns { ok, reason } so UI can surface sync failures
// (e.g. an oversize image) without guessing at the write path.
export async function writeCandlePrefs(userId, patch) {
  if (!db || !userId) return { ok: false, reason: "no-db" };
  // Guard against oversize image payloads — Firestore will reject docs
  // over 1MB, and we'd rather fall back to device-local than see a
  // cryptic write error.
  if (
    typeof patch?.votiveImage === "string" &&
    patch.votiveImage.length > PREFS_IMAGE_MAX_BYTES
  ) {
    return { ok: false, reason: "image-too-large" };
  }
  try {
    await setDoc(
      doc(db, PREFS_COLLECTION, userId),
      { ...patch, userId, updatedAt: serverTimestamp() },
      { merge: true },
    );
    return { ok: true };
  } catch (err) {
    console.warn("[candleRitual] writeCandlePrefs failed:", err);
    return { ok: false, reason: "write-failed" };
  }
}

// Realtime feed of the most recent lit candles — feed a marquee or social
// proof component later. Returns an unsubscribe function.
export function subscribeLitCandles(onChange, max = 20) {
  if (!db) return () => {};
  const q = query(
    collection(db, COLLECTION),
    orderBy("litAt", "desc"),
    limit(max),
  );
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        litAtMs: data.litAt?.toMillis?.() ?? Date.now(),
      };
    });
    onChange(items);
  });
}
