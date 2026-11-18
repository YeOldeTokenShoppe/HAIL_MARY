#!/usr/bin/env node
// Builds the Playtest 3 table (single file) — one money in $M, first to $1 billion — from:
//   pt3-sim.js                      the engine; its DESIGNS import is replaced by the set
//   src/game/rcana/set/designs.js   the one source of truth for what every card does
//   src/game/rcana/set/faces.js     + the art registry (via cardFace.js): the printed faces
//   src/game/rcana/set/trinity.js   the Traders' three numbers (inlined beside the designs)
// and writes pt3-table.html beside this file plus public/playtest3/table.html.
//
//   npm run pt3:build
//   npm run pt3:build -- --old-frame   keep the painted frame even where a face3.webp exists
//   npm run pt3:build -- --metal gold     the enlarged card's metal (default mirror, which shimmers on tilt)
//
// A card whose code-drawn face has been rendered (npm run rcana:faces -- --frame 3
// writes face3.webp beside face.webp) is shown in that frame; the rest keep the old one.
//
// Re-run after editing the engine, the table source, designs.js, faces.js, an art
// file, or after rendering faces (npm run rcana:faces). rcana-lint warns when stale.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');

// Designs: the module source with its `export`s stripped, so the table's inline
// script gets the exact same literal the Node engine imports.
const designs = readFileSync(join(root, 'src/game/rcana/set/designs.js'), 'utf8').replace(/^export /gm, '').trim();

// Engine: drop the shebang and the CLI tail, un-export, and inline the designs where
// the engine imports them.
let engine = readFileSync(join(here, 'pt3-sim.js'), 'utf8');
engine = engine.slice(0, engine.indexOf('// ── CLI ──'));
engine = engine.replace(/^#!.*\n/, '').replace(/^export /gm, '');
const importLine = /^import \{ DESIGNS \} from '\.\.\/rcana\/set\/designs\.js';\n/m;
if (!importLine.test(engine)) throw new Error('pt3-sim.js no longer imports DESIGNS from the set; update pt3-build.js');
engine = engine.replace(importLine, () => designs + '\n');
// The trinity is a second import; inline it the same way.
const trinity = readFileSync(join(root, 'src/game/rcana/set/trinity.js'), 'utf8').replace(/^export /gm, '').trim();
const trinityLine = /^import \{ TRINITY \} from '\.\.\/rcana\/set\/trinity\.js';\n/m;
if (!trinityLine.test(engine)) throw new Error('pt3-sim.js no longer imports TRINITY from the set; update pt3-build.js');
engine = engine.replace(trinityLine, () => trinity + '\n');

// Faces: resolved through the real modules so the mapping cannot drift.
const { RCANA_SET, RCANA_ART, TYPE_CLASS } = await import(join(root, 'src/game/rcana/cardFace.js'));
const { DESIGNS: cardDesigns } = await import(join(root, 'src/game/rcana/set/designs.js'));
const { getEventSubtype } = await import(join(root, 'src/game/rcana/eventTemplate.js'));
const eventSubtypes = Object.fromEntries(cardDesigns.map((c) => [c.key, getEventSubtype(c)]).filter(([, subtype]) => subtype));
const oldFrame = process.argv.includes('--old-frame');
// --metal gold|mirror|rainbow: the metal the enlarged, live card wears (match what the faces were rendered with).
const metalAt = process.argv.indexOf('--metal');
const frameMetal = metalAt >= 0 && ['flat', 'gold', 'mirror', 'rainbow'].includes(process.argv[metalAt + 1]) ? process.argv[metalAt + 1] : 'mirror';
const faces = {};
for (const c of RCANA_SET) {
  const art = RCANA_ART[c.id] || {};
  const face3Path = `/TCG/rcana/${c.id}/face3.webp`;
  const frame3 = !oldFrame && existsSync(join(root, 'public', face3Path));
  const facePath = frame3 ? face3Path : `/TCG/rcana/${c.id}/face.webp`;
  const subject = (art.layers || []).find((l) => l.id === 'subject')?.src || null;
  faces[c.designKey] = {
    id: c.id,
    name: c.name,
    gloss: c.gloss ?? null,
    number: c.number,
    rarity: c.rarity,
    face: existsSync(join(root, 'public', facePath)) ? facePath : null,
    frame: frame3 ? 3 : 1,
    metal: frame3 ? frameMetal : null,
    art: subject,
  };
}
// The printed class per engine type, so the table groups and labels cards the
// way the cards themselves do; the engine keeps playing by type.
const facesSrc = `const FACES = ${JSON.stringify(faces, null, 2)};\nconst TYPE_CLASS = ${JSON.stringify(TYPE_CLASS)};\nconst EVENT_SUBTYPES = ${JSON.stringify(eventSubtypes)};`;

const confetti = readFileSync(join(root, 'node_modules/canvas-confetti/dist/confetti.browser.js'), 'utf8');
let page = readFileSync(join(here, 'pt3-table.src.html'), 'utf8');
for (const [slot, src] of [['/*__CONFETTI__*/', confetti], ['/*__ENGINE__*/', engine], ['/*__FACES__*/', facesSrc]]) {
  if (!page.includes(slot)) throw new Error(`pt3-table.src.html is missing its ${slot} slot`);
  page = page.replace(slot, () => src);
}
writeFileSync(join(here, 'pt3-table.html'), page);
const pub = join(root, 'public', 'playtest3'); mkdirSync(pub, { recursive: true });
writeFileSync(join(pub, 'table.html'), '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body style="margin:0">\n' + page + '\n</body>\n</html>\n');
const printed = Object.values(faces).filter((f) => f.face).length;
const inFrame3 = Object.values(faces).filter((f) => f.frame === 3).length;
console.log(`pt3-table.html and public/playtest3/table.html written — ${Object.keys(faces).length} faces mapped, ${printed} with a rendered image, ${inFrame3} in the code-drawn frame`);
