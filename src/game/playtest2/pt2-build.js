#!/usr/bin/env node
// Builds the Playtest 2 table (single file) from three inputs:
//   pt2-sim.js                      the engine; its DESIGNS import is replaced by the set
//   src/game/rcana/set/designs.js   the one source of truth for what every card does
//   src/game/rcana/set/faces.js     + the art registry (via cardFace.js): the printed faces
// and writes pt2-table.html beside this file plus public/playtest2/table.html.
//
//   npm run pt2:build
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
let engine = readFileSync(join(here, 'pt2-sim.js'), 'utf8');
engine = engine.slice(0, engine.indexOf('// ── CLI ──'));
engine = engine.replace(/^#!.*\n/, '').replace(/^export /gm, '');
const importLine = /^import \{ DESIGNS \} from '\.\.\/rcana\/set\/designs\.js';\n/m;
if (!importLine.test(engine)) throw new Error('pt2-sim.js no longer imports DESIGNS from the set; update pt2-build.js');
engine = engine.replace(importLine, () => designs + '\n');

// Faces: resolved through the real modules so the mapping cannot drift.
const { RCANA_SET, RCANA_ART } = await import(join(root, 'src/game/rcana/cardFace.js'));
const faces = {};
for (const c of RCANA_SET) {
  const art = RCANA_ART[c.id] || {};
  const facePath = `/TCG/rcana/${c.id}/face.webp`;
  const subject = (art.layers || []).find((l) => l.id === 'subject')?.src || null;
  faces[c.designKey] = {
    id: c.id,
    number: c.number,
    rarity: c.rarity,
    face: existsSync(join(root, 'public', facePath)) ? facePath : null,
    art: subject,
  };
}
const facesSrc = `const FACES = ${JSON.stringify(faces, null, 2)};`;

let page = readFileSync(join(here, 'pt2-table.src.html'), 'utf8');
for (const [slot, src] of [['/*__ENGINE__*/', engine], ['/*__FACES__*/', facesSrc]]) {
  if (!page.includes(slot)) throw new Error(`pt2-table.src.html is missing its ${slot} slot`);
  page = page.replace(slot, () => src);
}
writeFileSync(join(here, 'pt2-table.html'), page);
const pub = join(root, 'public', 'playtest2'); mkdirSync(pub, { recursive: true });
writeFileSync(join(pub, 'table.html'), '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body style="margin:0">\n' + page + '\n</body>\n</html>\n');
const printed = Object.values(faces).filter((f) => f.face).length;
console.log(`pt2-table.html and public/playtest2/table.html written — ${Object.keys(faces).length} faces mapped, ${printed} with a rendered image`);
