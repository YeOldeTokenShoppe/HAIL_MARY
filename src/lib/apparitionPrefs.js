"use client";

// Device-local apparition preference — which of Our Lady's faces this seeker
// consults (see src/lib/apparitions.js). Stored by apparition KEY, not roster
// index, so reordering or extending APPARITIONS never re-faces anyone.
//
// Written on every explicit choice: the first-visit triptych, a medallion or
// arrow switch, or a ?char= deep link. Read on /main load; an explicit ?char
// param still wins over the stored preference for shareable links.

export const APPARITION_STORAGE_KEY = "rl80:apparition";

export function readApparitionKey() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(APPARITION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeApparitionKey(key) {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(APPARITION_STORAGE_KEY, key);
  } catch {}
}
