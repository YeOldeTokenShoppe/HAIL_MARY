#!/usr/bin/env node
// Bundles pt2-sim.js into pt2-table.html (single file) and copies it to public/playtest2/table.html.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
let engine = readFileSync(join(here, 'pt2-sim.js'), 'utf8');
engine = engine.slice(0, engine.indexOf('// ── CLI ──'));
engine = engine.replace(/^#!.*\n/, '').replace(/^export /gm, '');
let page = readFileSync(join(here, 'pt2-table.src.html'), 'utf8');
page = page.replace('/*__ENGINE__*/', () => engine);
writeFileSync(join(here, 'pt2-table.html'), page);
const pub = join(here, '..', '..', '..', 'public', 'playtest2'); mkdirSync(pub, { recursive: true });
writeFileSync(join(pub, 'table.html'), '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body style="margin:0">\n' + page + '\n</body>\n</html>\n');
console.log('pt2-table.html and public/playtest2/table.html written');
