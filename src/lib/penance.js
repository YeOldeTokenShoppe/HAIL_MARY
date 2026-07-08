"use client";

// Device-local penance ledger — the seeker's standing penance from Our Lady.
//
// The rite: the seeker CONFESSES in the Confessional → the oracle's JSON
// reply may carry a `penance` object (sin, command, days — see
// /api/oracle/route.js) → the client mints it here → PenanceOfRecord shows
// it beneath the portrait with a countdown → when the date passes the
// penance is DUE and absolution awaits her granting on the seeker's return.
//
// Device-local (like candlePrefs / apparitionPrefs) for now; a wallet-keyed
// Firestore ledger can replace the storage half without touching callers.
// The parish-wide absolved/lapsed tally lives server-side in that future
// version — nothing here aggregates across seekers.

export const PENANCE_STORAGE_KEY = "rl80:penance";
// Fired on window whenever the standing penance changes, so displays
// re-read storage without prop-drilling through the page.
export const PENANCE_EVENT = "rl80:penance-changed";

export function readPenance() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENANCE_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.sin !== "string" || typeof p?.command !== "string" || !p?.absolutionOn) {
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

// Mint a fresh penance from the oracle's { sin, command, days } and persist
// it. Returns the stored record.
export function mintPenance({ sin, command, days }) {
  const now = new Date();
  const span = Math.min(7, Math.max(1, Math.round(Number(days) || 3)));
  const record = {
    sin,
    command,
    assignedOn: now.toISOString(),
    absolutionOn: new Date(now.getTime() + span * 86400000).toISOString(),
    status: "assigned",
  };
  try {
    window.localStorage.setItem(PENANCE_STORAGE_KEY, JSON.stringify(record));
    window.dispatchEvent(new Event(PENANCE_EVENT));
  } catch {}
  return record;
}

export function clearPenance() {
  try {
    window.localStorage.removeItem(PENANCE_STORAGE_KEY);
    window.dispatchEvent(new Event(PENANCE_EVENT));
  } catch {}
}

// Whole days until absolution (0 = due today/past due).
export function penanceDaysLeft(p) {
  if (!p?.absolutionOn) return 0;
  return Math.max(0, Math.ceil((new Date(p.absolutionOn) - new Date()) / 86400000));
}

// Is the penance served and awaiting her absolution?
export function penanceIsDue(p) {
  return !!p && new Date(p.absolutionOn) <= new Date();
}
