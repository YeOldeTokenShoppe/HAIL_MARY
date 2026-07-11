"use client";

// Device-local favor ledger — the seeker's ONE standing BLESSING from Our
// Lady, granted upon a petition (guidance, intercession, protection, good
// fortune — her Marian offices; she is no confessor and keeps no penances).
//
// The rite: petition her in the Confessional → her JSON reply may carry a
// `blessing` inscription (see /api/oracle/route.js) → /main mints it here →
// GraceOfRecord shows it beneath the portrait. Her favor holds for its
// allotted days, then runs its course and expires — reopening the altar,
// which is the return visit.
//
// Device-local (like candlePrefs / apparitionPrefs) for now; a wallet-keyed
// Firestore ledger can replace the storage half without touching callers.

export const GRACE_STORAGE_KEY = "rl80:grace";
// Fired on window whenever the standing blessing changes, so displays
// re-read storage without prop-drilling through the page.
export const GRACE_EVENT = "rl80:grace-changed";

// Read the standing blessing. Expired (or legacy non-blessing) records are
// cleared on read — her favor ran its course, the altar is open again.
export function readGrace() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GRACE_STORAGE_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw);
    if (g?.kind !== "blessing" || !g?.until || new Date(g.until) <= new Date()) {
      window.localStorage.removeItem(GRACE_STORAGE_KEY);
      return null;
    }
    return g;
  } catch {
    return null;
  }
}

// Mint from the oracle's inscription (shape validated server-side).
export function mintBlessing({ petition, boon, days }) {
  const now = new Date();
  const span = Math.min(7, Math.max(1, Math.round(Number(days) || 3)));
  const g = {
    kind: "blessing",
    petition,
    boon,
    assignedOn: now.toISOString(),
    until: new Date(now.getTime() + span * 86400000).toISOString(), // favor runs out
  };
  try {
    window.localStorage.setItem(GRACE_STORAGE_KEY, JSON.stringify(g));
    window.dispatchEvent(new Event(GRACE_EVENT));
  } catch {}
  return g;
}

export function clearGrace() {
  try {
    window.localStorage.removeItem(GRACE_STORAGE_KEY);
    window.dispatchEvent(new Event(GRACE_EVENT));
  } catch {}
}

// Whole days of favor remaining (0 = expiring today).
export function graceDaysLeft(g) {
  if (!g?.until) return 0;
  return Math.max(0, Math.ceil((new Date(g.until) - new Date()) / 86400000));
}
