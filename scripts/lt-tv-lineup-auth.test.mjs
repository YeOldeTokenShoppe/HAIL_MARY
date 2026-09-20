// Checks on the lineup page's lock. The page is read-only, but it is the
// production slate, so the interesting cases here are the ways in.

import assert from "node:assert";

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  ✗ ${name}`);
    console.log(`      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed += 1;
  }
}

function group(name) {
  console.log(`\n${name}:`);
}

// The module reads process.env at call time, so each block sets it directly.
const auth = await import("../src/lib/ltTv/lineupAuth.mjs");
const { checkPassword, issueToken, tokenIsValid, cookieOptions, SESSION_COOKIE, SESSION_TTL_MS } = auth;

const withPassword = (value, fn) => {
  const before = process.env.ADMIN_PASSWORD;
  if (value === null) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = value;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = before;
  }
};

const SECRET = "correct horse battery staple";

group("The right password gets in, and nothing else does");
withPassword(SECRET, () => {
  check("the password itself", checkPassword(SECRET), true);
  check("a wrong one", checkPassword("hunter2"), false);
  check("the right one with a trailing space", checkPassword(SECRET + " "), false);
  check("a prefix of it", checkPassword(SECRET.slice(0, -1)), false);
  check("an empty string", checkPassword(""), false);
  check("undefined", checkPassword(undefined), false);
  check("null", checkPassword(null), false);
  check("a number", checkPassword(12345), false);
  check("an object that stringifies to the password", checkPassword({ toString: () => SECRET }), false);
  check("an array holding it", checkPassword([SECRET]), false);
});

group("With no password configured, nobody gets in");
withPassword(null, () => {
  check("not the empty string", checkPassword(""), false);
  check("not undefined", checkPassword(undefined), false);
  check("not any guess", checkPassword("admin123"), false);
  check("and no token can be issued", issueToken(), null);
});
withPassword("", () => {
  check("an empty ADMIN_PASSWORD is treated as unset", checkPassword(""), false);
  check("and issues nothing", issueToken(), null);
});

group("A token this server signed verifies, until it expires");
withPassword(SECRET, () => {
  const now = 1_700_000_000_000;
  const token = issueToken(now);
  check("a fresh token is valid", tokenIsValid(token, now + 1000), true);
  check("valid just before expiry", tokenIsValid(token, now + SESSION_TTL_MS - 1), true);
  check("not valid at expiry", tokenIsValid(token, now + SESSION_TTL_MS), false);
  check("not valid long after", tokenIsValid(token, now + SESSION_TTL_MS * 2), false);
  check("a short ttl is honoured", tokenIsValid(issueToken(now, 1000), now + 1001), false);
});

group("Forged and mangled tokens are refused");
withPassword(SECRET, () => {
  const now = 1_700_000_000_000;
  const token = issueToken(now);
  const [exp, mac] = token.split(".");

  check("a later expiry with the old signature", tokenIsValid(`${Number(exp) + 60_000}.${mac}`, now), false);
  check("a made-up signature", tokenIsValid(`${exp}.notarealsignature`, now), false);
  check("no signature", tokenIsValid(`${exp}.`, now), false);
  check("no separator", tokenIsValid(`${exp}${mac}`, now), false);
  check("empty string", tokenIsValid("", now), false);
  check("a bare dot", tokenIsValid(".", now), false);
  check("leading dot", tokenIsValid(`.${mac}`, now), false);
  check("a non-numeric expiry", tokenIsValid(`soon.${mac}`, now), false);
  check("a negative expiry", tokenIsValid(`-1.${mac}`, now), false);
  check("a float expiry", tokenIsValid(`1.5.${mac}`, now), false);
  check("scientific notation", tokenIsValid(`1e99.${mac}`, now), false);
  check("an absurdly long expiry", tokenIsValid(`${"9".repeat(40)}.${mac}`, now), false);
  check("undefined", tokenIsValid(undefined, now), false);
  check("null", tokenIsValid(null, now), false);
  check("a number", tokenIsValid(12345, now), false);
  check("an object", tokenIsValid({}, now), false);
  check("an array", tokenIsValid([token], now), false);
});

group("A token signed with a different password does not carry over");
const now = 1_700_000_000_000;
const foreign = withPassword("a different password", () => issueToken(now));
withPassword(SECRET, () => {
  check("it is refused", tokenIsValid(foreign, now + 1000), false);
});
withPassword(null, () => {
  check("and refused when nothing is configured", tokenIsValid(foreign, now + 1000), false);
});

group("The cookie cannot be read or sent from anywhere it should not be");
check("it is httpOnly, so no script can read it", cookieOptions({ secure: true }).httpOnly, true);
check("it is secure in production", cookieOptions({ secure: true }).secure, true);
check("and not secure for local http", cookieOptions({ secure: false }).secure, false);
check("sameSite lax", cookieOptions({ secure: true }).sameSite, "lax");
check("it expires with the token", cookieOptions({ secure: true }).maxAge, SESSION_TTL_MS / 1000);
check("the name is stable", SESSION_COOKIE, "lt_lineup");

group("The password never appears in what is handed to the browser");
withPassword(SECRET, () => {
  const token = issueToken(now);
  check("not in the token", token.includes(SECRET), false);
  check("not base64 in the token", token.includes(Buffer.from(SECRET).toString("base64url")), false);
  check("the token is only an expiry and a signature", token.split(".").length, 2);
});

group("Guessing is slowed down");
{
  const { recordFailure, isLockedOut, clearFailures, _resetFailures, MAX_ATTEMPTS, ATTEMPT_WINDOW_MS } = auth;
  const t = 1_700_000_000_000;

  _resetFailures();
  check("an unknown source is not locked out", isLockedOut("1.2.3.4", t), false);
  check("an empty id is never locked out", isLockedOut("", t), false);
  check("a non-string id is never locked out", isLockedOut(null, t), false);

  for (let i = 0; i < MAX_ATTEMPTS - 1; i += 1) recordFailure("1.2.3.4", t);
  check("just under the limit is still allowed", isLockedOut("1.2.3.4", t), false);
  recordFailure("1.2.3.4", t);
  check("the limit locks it out", isLockedOut("1.2.3.4", t), true);
  check("another source is unaffected", isLockedOut("5.6.7.8", t), false);

  check("the lock lifts after the window", isLockedOut("1.2.3.4", t + ATTEMPT_WINDOW_MS + 1), false);

  _resetFailures();
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) recordFailure("1.2.3.4", t);
  check("locked again", isLockedOut("1.2.3.4", t), true);
  clearFailures("1.2.3.4");
  check("a correct password clears the count", isLockedOut("1.2.3.4", t), false);

  _resetFailures();
  recordFailure(null, t);
  recordFailure("", t);
  check("bad ids are not tracked", isLockedOut("", t), false);

  _resetFailures();
  for (let i = 0; i < 1200; i += 1) recordFailure(`src-${i}`, t);
  check("tracking is bounded against a flood", isLockedOut("src-1199", t), false);
}

console.log(
  failed === 0
    ? `\nAll checks passed.`
    : `\n${failed} check${failed === 1 ? "" : "s"} failed.`,
);
process.exit(failed === 0 ? 0 : 1);
