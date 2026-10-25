#!/usr/bin/env node
// Builds public/playtest2/table.html from pt2-table.src.html, injecting:
//   - DESIGNS from src/game/rcana/set/designs.js (the one source of truth)
//   - FACES  from src/game/rcana/set/faces.js + the art registry, keyed by
//            design key, so the table can show the printed card where one
//            exists and fall back to its text card where one does not.
//
//   npm run pt2:build
//
// Re-run after editing designs.js, faces.js, an art file, or after rendering
// faces (npm run rcana:faces). rcana-lint warns when the table is stale.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..", "..");

// Designs: the module source with its `export`s stripped, so the table's
// inline script gets the exact same literal the game reads.
let designs = readFileSync(join(root, "src/game/rcana/set/designs.js"), "utf8");
designs = designs
  .replace(/^export const DESIGN_TYPES[\s\S]*$/m, "")
  .replace(/^export const designByKey[\s\S]*$/m, "")
  .replace(/^export /gm, "");

// Faces: resolved through the real modules so the mapping cannot drift.
const { RCANA_SET, RCANA_ART } = await import(join(root, "src/game/rcana/cardFace.js"));
const faces = {};
for (const c of RCANA_SET) {
  const art = RCANA_ART[c.id] || {};
  const facePath = `/TCG/rcana/${c.id}/face.webp`;
  const subject = (art.layers || []).find((l) => l.id === "subject")?.src || null;
  faces[c.designKey] = {
    id: c.id,
    number: c.number,
    rarity: c.rarity,
    face: existsSync(join(root, "public", facePath)) ? facePath : null,
    art: subject,
  };
}
const facesSrc = `const FACES = ${JSON.stringify(faces, null, 2)};`;

let page = readFileSync(join(here, "pt2-table.src.html"), "utf8");
page = page.replace("/*__DESIGNS__*/", () => designs.trim()).replace("/*__FACES__*/", () => facesSrc);

const pub = join(root, "public", "playtest2");
mkdirSync(pub, { recursive: true });
writeFileSync(
  join(pub, "table.html"),
  '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body style="margin:0">\n' +
    page +
    "\n</body>\n</html>\n"
);
const printed = Object.values(faces).filter((f) => f.face).length;
console.log(`public/playtest2/table.html written — ${Object.keys(faces).length} faces mapped, ${printed} with a rendered image`);
