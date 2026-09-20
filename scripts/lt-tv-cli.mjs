#!/usr/bin/env node
// The two things every LT TV generator needs from its command line.
//
// Kept here rather than copied into each script because the second one exists
// to catch a typo, and a typo-catcher that only some scripts have is worse
// than none: `--check-sources.` — one stray full stop — once quietly generated
// a brief instead of checking anything, and the run looked like a success.

export function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

export function rejectUnknownFlags(known) {
  const unknown = process.argv.slice(2).filter(
    (a) => a.startsWith("--") && !known.includes(a.slice(2)),
  );
  if (!unknown.length) return;
  for (const flag of unknown) {
    // Strip punctuation a shell or a paste may have carried in, so a near
    // miss is named rather than just rejected.
    const bare = flag.slice(2).replace(/[^a-z0-9-]/gi, "");
    const near = known.find((k) => k === bare) ||
      known.find((k) => k.startsWith(bare) || bare.startsWith(k));
    console.error(`Unknown option ${flag}${near ? ` — did you mean --${near}?` : ""}`);
  }
  console.error(`Known options: ${known.map((k) => `--${k}`).join(", ")}`);
  console.error("Values are passed with a space, as in --out path/to/file.json");
  process.exit(2);
}
