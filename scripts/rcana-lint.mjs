#!/usr/bin/env node
// rcana-lint — checks the R-cana set before it reaches the bench or the table.
//
//   node scripts/rcana-lint.mjs            # report
//   node scripts/rcana-lint.mjs --strict   # exit 1 on warnings too
//
// Checks, per printed face:
//   - its design exists; its number is set and unique; rarity is a known tier
//   - it has an art file, and every src that art names exists under public/
//   - ability / flavor fit the panel (soft limits; the face auto-fits, but
//     past these it shrinks to unreadable)
//   - each FX facet lands on a bright pixel of its own sheet (needs sharp;
//     skipped with a note if sharp will not load on this machine)
// And for the set:
//   - designs with no printed face yet (informational)
//
// Exit 0 clean, 1 on errors (or warnings with --strict).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = (p) => path.join(root, "public", p.replace(/^\//, ""));
const strict = process.argv.includes("--strict");

const { RCANA_SET, UNPRINTED, RARITY_ORDER, RCANA_ART, toRcanaCard } = await import(
  path.join(root, "src/game/rcana/cardFace.js")
);

// Soft limits for the body panel, in characters. The ability sets at full
// size and the quote a step down; two lines each is the comfortable ceiling.
const MAX_ABILITY = 90;
const MAX_FLAVOR = 80;

let errors = 0, warnings = 0;
const err = (id, m) => { errors++; console.log(`  ✗ ${id}: ${m}`); };
const warn = (id, m) => { warnings++; console.log(`  ! ${id}: ${m}`); };
const ok = (id, m) => console.log(`  ✓ ${id}: ${m}`);

let sharp = null;
try { sharp = (await import("sharp")).default; } catch { /* checked below */ }

const numbers = new Map();
console.log(`R-cana set: ${RCANA_SET.length} printed, ${UNPRINTED.length} unprinted designs\n`);

for (const card of RCANA_SET) {
  const id = card.id;
  if (card.number == null) err(id, "no number");
  else if (numbers.has(card.number)) err(id, `number ${card.number} already used by ${numbers.get(card.number)}`);
  else numbers.set(card.number, id);
  if (!RARITY_ORDER.includes(card.rarity)) err(id, `unknown rarity "${card.rarity}"`);
  if (card.ability && card.ability.length > MAX_ABILITY) warn(id, `ability is ${card.ability.length} chars (soft max ${MAX_ABILITY})`);
  if (card.flavor && card.flavor.length > MAX_FLAVOR) warn(id, `flavor is ${card.flavor.length} chars (soft max ${MAX_FLAVOR})`);

  const art = RCANA_ART[id];
  if (!art) { err(id, "no art file (src/game/rcana/art/<id>.js, registered in art/index.js)"); continue; }

  // Resolve through the converter, so convention-derived paths (a layer with
  // no `src` → /TCG/rcana/<id>/<layer>.webp) are checked as the card sees them.
  const resolved = toRcanaCard(card);
  const srcs = [
    resolved.frameImage,
    resolved.badgeImage,
    ...resolved.artLayers.map((l) => l.src),
    ...resolved.fxLayers.map((l) => l.src),
    ...(typeof art.backdrop === "string" && art.backdrop.startsWith("/") ? [art.backdrop] : []),
  ].filter(Boolean);
  for (const s of srcs) if (!fs.existsSync(pub(s))) err(id, `missing file ${s}`);

  // Facets on bright pixels.
  for (const fx of resolved.fxLayers) {
    const facets = fx.reflection?.facets;
    if (!facets?.length) continue;
    if (!sharp) { warn(id, `facet check skipped for ${path.basename(fx.src)} — sharp did not load here`); continue; }
    if (!fs.existsSync(pub(fx.src))) continue;
    const img = sharp(pub(fx.src)).ensureAlpha();
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const { width: W, height: H, channels: C } = info;
    // Mean luminance×alpha in a small window around the facet centre.
    const lumAt = (fx0, fy0) => {
      const cx = Math.round((fx0 / 100) * W), cy = Math.round((fy0 / 100) * H), r = Math.round(W * 0.03);
      let sum = 0, n = 0;
      for (let y = Math.max(0, cy - r); y < Math.min(H, cy + r); y++)
        for (let x = Math.max(0, cx - r); x < Math.min(W, cx + r); x++) {
          const p = (y * W + x) * C;
          sum += ((0.3 * data[p] + 0.59 * data[p + 1] + 0.11 * data[p + 2]) / 255) * (data[p + 3] / 255);
          n++;
        }
      return n ? sum / n : 0;
    };
    let dark = 0;
    facets.forEach((f, i) => {
      const l = lumAt(f.x, f.y);
      if (l < 0.06) { dark++; err(id, `facet ${i} at (${f.x}, ${f.y}) on ${path.basename(fx.src)} sits on empty sheet (lum ${l.toFixed(2)})`); }
      else if (l < 0.15) warn(id, `facet ${i} at (${f.x}, ${f.y}) is faint (lum ${l.toFixed(2)})`);
    });
    if (!dark) ok(id, `${facets.length} facets all on flame (${path.basename(fx.src)})`);
  }
  if (srcs.every((s) => fs.existsSync(pub(s)))) ok(id, `${srcs.length} files present`);
}

// The Playtest 2 table is a BUILT file carrying its own copy of the designs
// and faces. If its inputs are newer than it, the game is playing a stale set.
{
  const table = path.join(root, "public/playtest2/table.html");
  const inputs = [
    "src/game/rcana/set/designs.js",
    "src/game/rcana/set/faces.js",
    "src/game/playtest2/pt2-table.src.html",
    "src/game/playtest2/pt2-build.js",
    "src/game/playtest2/pt2-sim.js",
  ].map((p) => path.join(root, p));
  if (fs.existsSync(table)) {
    const built = fs.statSync(table).mtimeMs;
    const stale = inputs.filter((p) => fs.existsSync(p) && fs.statSync(p).mtimeMs > built);
    if (stale.length) warn("playtest2", `table.html is older than ${stale.map((p) => path.basename(p)).join(", ")} — run npm run pt2:build`);
    else ok("playtest2", "table.html is up to date with the set");
  }
}

if (UNPRINTED.length) {
  console.log(`\nUnprinted designs (${UNPRINTED.length}):`);
  console.log("  " + UNPRINTED.map((d) => `${d.key} (${d.type})`).join(", "));
}

console.log(`\n${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`);
process.exit(errors || (strict && warnings) ? 1 : 0);
