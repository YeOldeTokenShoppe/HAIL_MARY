#!/usr/bin/env node
// Wire recorded SitePal clips into the case data: convert
//   audio: null, // re-record: <slot>           -> audio: "<slot>",
//   { ..., audio: null }, // re-record: <slot>  -> { ..., audio: "<slot>" },
// so the game plays the uploaded clip (sayAudio) instead of the TTS fallback.
//
// Only run this for lines whose clip is ACTUALLY uploaded to SitePal under the
// exact slot name — sayAudio does NOT fall back to TTS if a clip is missing.
//
// Usage:
//   node scripts/wire-audio.mjs            # wire every re-record marker
//   node scripts/wire-audio.mjs trinity    # only slots containing "trinity"
//   node scripts/wire-audio.mjs case002    # only case-002 slots
// After running, re-run: node scripts/gen-rerecord-manifest.mjs

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CASES_DIR = path.join(ROOT, "src/components/game/cases");
const filter = process.argv[2] || "";
const RE = /audio: null( \})?, \/\/ re-record: ([A-Za-z0-9_]+)/g;

const ids = [...fs.readFileSync(path.join(CASES_DIR, "index.js"), "utf8")
  .matchAll(/from\s+["']\.\/(case-\d+)["']/g)].map((m) => m[1]);

let total = 0;
for (const id of ids) {
  const f = path.join(CASES_DIR, `${id}.js`);
  let src = fs.readFileSync(f, "utf8");
  let n = 0;
  src = src.replace(RE, (m, brace, slot) => {
    if (filter && !slot.includes(filter)) return m;
    n++;
    return `audio: "${slot}"${brace || ""},`;
  });
  if (n) { fs.writeFileSync(f, src); total += n; console.log(`  ${id}: wired ${n}`); }
}
console.log(`Total wired: ${total}${filter ? ` (filter "${filter}")` : ""}`);
if (total) console.log("Next: node scripts/gen-rerecord-manifest.mjs");
