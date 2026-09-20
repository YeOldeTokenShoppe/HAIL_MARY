// THE LOCK ON THE LINEUP PAGE.
//
// The lineup is read-only — it shows what is on air and what is planned — but
// it is still the production slate, so it asks for the admin password.
//
// EVERY CHECK HERE HAPPENS ON THE SERVER, deliberately. The repo's older
// /admin page compares NEXT_PUBLIC_ADMIN_PASSWORD in the browser and then
// trusts a localStorage flag, which means the password ships in the page
// source and the flag can simply be typed into a console. Do not copy that
// pattern. The password below never leaves the server; what reaches the
// browser is a signed, expiring cookie that proves a correct password was
// given and carries nothing else.
//
// Fails closed: with ADMIN_PASSWORD unset, no password is accepted and no
// token verifies, so a misconfigured deploy locks everyone out rather than
// letting everyone in.

import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "lt_lineup";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const SIGNING_PREFIX = "lt-tv-lineup:";

function secret() {
  const value = process.env.ADMIN_PASSWORD;
  return typeof value === "string" && value.length > 0 ? value : null;
}

// Compares two strings without leaking, through timing, how much of a guess
// was right. Both sides are hashed first so the comparison is over two
// fixed-length buffers — timingSafeEqual throws on a length mismatch, and
// returning early on one would leak the password's length.
function sameSecretly(a, b) {
  const digest = (value) =>
    createHmac("sha256", "lt-tv-lineup-compare").update(String(value)).digest();
  return timingSafeEqual(digest(a), digest(b));
}

function sign(expiresAt, key) {
  return createHmac("sha256", key)
    .update(SIGNING_PREFIX + expiresAt)
    .digest("base64url");
}

/** True only for the configured admin password. */
export function checkPassword(given) {
  const key = secret();
  if (!key) return false;
  if (typeof given !== "string" || given.length === 0) return false;
  return sameSecretly(given, key);
}

/** A signed token that expires, or null when no password is configured. */
export function issueToken(now = Date.now(), ttlMs = SESSION_TTL_MS) {
  const key = secret();
  if (!key) return null;
  const expiresAt = now + ttlMs;
  return `${expiresAt}.${sign(expiresAt, key)}`;
}

/** True for a token this server signed that has not expired. */
export function tokenIsValid(token, now = Date.now()) {
  const key = secret();
  if (!key) return false;
  if (typeof token !== "string") return false;

  const split = token.indexOf(".");
  if (split <= 0) return false;

  const expiresRaw = token.slice(0, split);
  const mac = token.slice(split + 1);
  if (!/^\d{1,15}$/.test(expiresRaw) || mac.length === 0) return false;

  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;

  return sameSecretly(mac, sign(expiresAt, key));
}

/** Cookie settings for the session. Secure everywhere but local http. */
export function cookieOptions({ secure } = { secure: true }) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: Boolean(secure),
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

// ── Brute force ──────────────────────────────────────────────────────────
//
// A password endpoint on the open internet gets guessed at. This slows that
// down; it does not stop it. The counters live in memory on one instance, so
// a deploy clears them and a second instance keeps its own — best effort, and
// worth having anyway, because the realistic attacker is a single script.
// Real protection would be a shared store, which is not worth it for a page
// that only reads the slate.

export const MAX_ATTEMPTS = 10;
export const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_TRACKED = 1000;

const failures = new Map();

function prune(now) {
  for (const [id, record] of failures) {
    if (record.until <= now) failures.delete(id);
  }
  // A flood of spoofed sources must not grow this without limit. Oldest out.
  while (failures.size > MAX_TRACKED) {
    const oldest = failures.keys().next();
    if (oldest.done) break;
    failures.delete(oldest.value);
  }
}

export function recordFailure(id, now = Date.now()) {
  if (typeof id !== "string" || id.length === 0) return;
  prune(now);
  const record = failures.get(id);
  if (!record || record.until <= now) {
    failures.set(id, { count: 1, until: now + ATTEMPT_WINDOW_MS });
    return;
  }
  record.count += 1;
}

export function isLockedOut(id, now = Date.now()) {
  if (typeof id !== "string" || id.length === 0) return false;
  const record = failures.get(id);
  if (!record) return false;
  if (record.until <= now) {
    failures.delete(id);
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

export function clearFailures(id) {
  if (typeof id === "string") failures.delete(id);
}

/** Only for tests. */
export function _resetFailures() {
  failures.clear();
}
