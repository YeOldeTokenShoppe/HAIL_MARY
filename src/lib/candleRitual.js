"use client";

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

export async function lightCandle(userId, { displayName, avatarUrl } = {}) {
  if (!db || !userId) return;
  try {
    await setDoc(doc(db, COLLECTION, userId), {
      userId,
      displayName: displayName ?? null,
      avatarUrl: avatarUrl ?? null,
      litAt: serverTimestamp(),
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
