// Card art wiring check. Run: node scripts/verify-card-art.mjs
//
// design_guide.md's "Art run status" table is the source of truth for which
// pieces are approved and what artFocus each one wires at. CARD_ART in
// templateCard.js is a hand-maintained second copy of those numbers, so the
// two drift silently — that is exactly how eight cards ended up wired at a
// 28% default while the guide specified 31-36% (2026-07-20).
//
// Asserts, for every row of the table:
//   - approved rows have a CARD_ART entry, pending rows do not
//   - the wired artFocus matches the guide's value
//   - the wired src exists on disk
// Also flags CARD_ART entries whose file is missing, and art files in
// /public/TCG that nothing references.
//
// Loads the REAL sources via data: modules (repo convention, see
// verify-docket-run.mjs / sim-case-table.mjs): templateCard.js imports
// ./cards, so that specifier is rewritten to a data: URL of the import.
import { readFileSync, existsSync, readdirSync } from "node:fs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
const dataUrl = (src) => "data:text/javascript;charset=utf-8," + encodeURIComponent(src);
const load = (src) => import(dataUrl(src));

const cardsSrc = read("../src/game/terminal-traders/cards.js");
const framesSrc = read("../src/game/terminal-traders/cardFrames.js");
const { CARD_ART } = await load(
  read("../src/game/terminal-traders/templateCard.js")
    .replace('from "./cards.js"', `from ${JSON.stringify(dataUrl(cardsSrc))}`)
    .replace('from "./cardFrames.js"', `from ${JSON.stringify(dataUrl(framesSrc))}`)
);
const { ACTION_CARDS } = await load(cardsSrc);

const guide = read("../src/game/terminal-traders/design_guide.md");
const TCG_DIR = new URL("../public/TCG/", import.meta.url);

// The guide names cards in prose ("Wallet Séance"); CARD_ART keys them by id.
// Map through cards.js so the id list stays single-sourced.
const ID_BY_NAME = new Map(ACTION_CARDS.map((c) => [c.name.toLowerCase(), c.id]));

// Rows look like: | Wallet Séance | approved | center 31% |
const ROW = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/;
const rows = guide
  .split("\n")
  .map((line) => line.match(ROW))
  .filter(Boolean)
  .map((m) => ({ name: m[1].trim(), status: m[2].trim(), focus: m[3].trim() }))
  .filter((r) => ID_BY_NAME.has(r.name.toLowerCase()));

if (!rows.length) {
  console.error("FAIL  no art-run rows parsed from design_guide.md — table format changed?");
  process.exit(1);
}

const problems = [];
const note = (msg) => problems.push(msg);

for (const row of rows) {
  const id = ID_BY_NAME.get(row.name.toLowerCase());
  const art = CARD_ART[id];
  const approved = /approved/i.test(row.status);

  if (!approved) {
    if (art) note(`${id}: guide says "${row.status}" but CARD_ART wires ${art.src}`);
    continue;
  }
  if (!art) {
    note(`${id}: approved in the guide but has no CARD_ART entry`);
    continue;
  }

  // "center 31%" / "center 28% in repo; check arrowheads, 30-32 if clipped" —
  // take the first percentage as the prescribed value, ignore the commentary.
  const want = row.focus.match(/(\d+(?:\.\d+)?)\s*%/);
  const got = String(art.artFocus || "").match(/(\d+(?:\.\d+)?)\s*%/);
  if (want && got && want[1] !== got[1]) {
    note(`${id}: artFocus is ${got[1]}% but the guide says ${want[1]}%  (${row.focus})`);
  } else if (want && !got) {
    note(`${id}: guide says ${want[1]}% but CARD_ART has no artFocus`);
  }
}

for (const [id, art] of Object.entries(CARD_ART)) {
  const file = art.src.replace(/^\/TCG\//, "");
  if (!existsSync(new URL(file, TCG_DIR))) note(`${id}: src ${art.src} does not exist on disk`);
}

// Orphans: an art file nothing points at. Three kinds are expected and not
// reported: a .png whose .webp IS wired (the retained master), the card back,
// and `-v2`/`-v3` drafts — only the unsuffixed export is ever canonical, so
// suffixed files are working versions the art run leaves behind by design.
const DRAFT = /-v\d+\.(png|webp)$/;
const wired = new Set(Object.values(CARD_ART).map((a) => a.src.replace(/^\/TCG\//, "")));
const all = readdirSync(TCG_DIR).filter((f) => /\.(png|webp)$/.test(f));
const drafts = all.filter((f) => DRAFT.test(f));
const orphans = all
  .filter((f) => !DRAFT.test(f))
  .filter((f) => !wired.has(f))
  .filter((f) => !wired.has(f.replace(/\.png$/, ".webp")))
  .filter((f) => !/^cardBack/.test(f));

// A draft with no canonical sibling means the art run wired nothing for it.
for (const d of drafts) {
  const canonical = d.replace(/-v\d+(\.\w+)$/, "$1");
  if (!wired.has(canonical) && !wired.has(canonical.replace(/\.png$/, ".webp"))) {
    note(`${d}: draft has no wired unsuffixed counterpart`);
  }
}

const approvedCount = rows.filter((r) => /approved/i.test(r.status)).length;
console.log(`art run: ${approvedCount}/${rows.length} approved, ${Object.keys(CARD_ART).length} CARD_ART entries wired`);
if (drafts.length) console.log(`drafts on disk (ignored, unsuffixed is canonical): ${drafts.length}`);
if (orphans.length) console.log(`unreferenced files in /TCG: ${orphans.join(", ")}`);

if (problems.length) {
  console.error(`\nFAIL  ${problems.length} problem(s):`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log("OK    CARD_ART matches design_guide.md");
