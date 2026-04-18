"use client";

// Anonymous candle persistence — mirrors the Firestore shape used by
// candleRitual.js so the consumer can branch on `userId` without caring
// about the storage backend.

const KEY = "shrineCandle";

export function readLocalCandle() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data?.litAtMs !== "number") return null;
    return data;
  } catch {
    return null;
  }
}

export function writeLocalCandle(litAtMs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ litAtMs }));
  } catch {}
}

export function clearLocalCandle() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
}
