#!/usr/bin/env node
// Bundles loteria-sim.js into table.html (single file, for the artifact viewer and the app).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
let engine = readFileSync(join(here, 'loteria-sim.js'), 'utf8');
engine = engine.slice(0, engine.indexOf('// ── CLI ──')); // the browser gets the game, not the CLI
engine = engine.replace(/^#!.*\n/, '').replace(/^export /gm, '');
let page = readFileSync(join(here, 'table.src.html'), 'utf8');
page = page.replace('/*__ENGINE__*/', () => engine);
writeFileSync(join(here, 'table.html'), page);
const pub = join(here, '..', '..', '..', 'public', 'loteria'); mkdirSync(pub, { recursive: true });
writeFileSync(join(pub, 'table.html'), '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body style="margin:0">\n' + page + '\n</body>\n</html>\n');
console.log('table.html and public/loteria/table.html written');
