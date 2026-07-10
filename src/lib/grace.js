"use client";

// Device-local grace ledger — the seeker's ONE standing grace from Our Lady:
// either a PENANCE (from a confession) or a BLESSING (from a petition).
//
// The rites: speak to her in the Confessional → her JSON reply may carry a
// `penance` or `blessing` inscription (see /api/oracle/route.js) → /main
// mints it here → GraceOfRecord shows it beneath the portrait. A penance
// stands until absolution (her granting it is a later phase); a blessing's
// favor simply runs its course and expires, reopening the rites.
//
// Device-local (like candlePrefs / apparitionPrefs) for now; a wallet-keyed
// Firestore ledger can replace the storage half without touching callers.
// (This module supersedes lib/penance.js's single-rite version.)

export const GRACE_STORAGE_KEY = "rl80:grace";
// Fired on window whenever the standing grace changes, so displays re-read
// storage without prop-drilling through the page.
export const GRACE_EVENT = "rl80:grace-changed";

// Read the standing grace. Expired blessings are cleared on read — her
// favor ran its course, the rites are open again. Penances never expire
// this way; they wait for absolution.
export function readGrace() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GRACE_STORAGE_KEY);
    if (!raw) return null;
    const g = JSON.parse(raw);
    if ((g?.kind !== "penance" && g?.kind !== "blessing") || !g?.until) return null;
    if (g.kind === "blessing" && new Date(g.until) <= new Date()) {
      window.localStorage.removeItem(GRACE_STORAGE_KEY);
      return null;
    }
    return g;
  } catch {
    return null;
  }
}

function mint(record, days) {
  const now = new Date();
  const span = Math.min(7, Math.max(1, Math.round(Number(days) || 3)));
  const g = {
    ...record,
    assignedOn: now.toISOString(),
    // For a penance: when absolution may be sought. For a blessing: when
    // her favor runs out.
    until: new Date(now.getTime() + span * 86400000).toISOString(),
  };
  try {
    window.localStorage.setItem(GRACE_STORAGE_KEY, JSON.stringify(g));
    window.dispatchEvent(new Event(GRACE_EVENT));
  } catch {}
  return g;
}

// Mint from the oracle's inscriptions (shapes validated server-side).
export function mintPenance({ sin, command, days }) {
  return mint({ kind: "penance", sin, command }, days);
}
export function mintBlessing({ petition, boon, days }) {
  return mint({ kind: "blessing", petition, boon }, days);
}

export function clearGrace() {
  try {
    window.localStorage.removeItem(GRACE_STORAGE_KEY);
    window.dispatchEvent(new Event(GRACE_EVENT));
  } catch {}
}

// Whole days until the grace's date (0 = today/past).
export function graceDaysLeft(g) {
  if (!g?.until) return 0;
  return Math.max(0, Math.ceil((new Date(g.until) - new Date()) / 86400000));
}

// Is a penance served and awaiting her absolution?
export function penanceIsDue(g) {
  return g?.kind === "penance" && new Date(g.until) <= new Date();
}
