#!/usr/bin/env node
// Bundles the engine modules into table.html so the page has no files to fetch.
// Each module becomes a scoped function registered in a tiny module table.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ORDER = ['cards.js', 'engine.js', 'tarot.js', 'tarot-engine.js', 'tarot-bots.js', 'tarot-sim.js', 'v2.js', 'v2-engine.js', 'v2-sim.js'];

function importToConst(line) {
  // import { a, b as c } from './x.js';  →  const { a, b: c } = __m['./x.js'];
  return line.replace(/^import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?/, (_, names, file) => `const {${names.replace(/\s+as\s+/g, ': ')}} = __m['${file}'];`);
}
function wrapModule(name) {
  const src = readFileSync(join(here, name), 'utf8');
  const exportsList = [];
  const body = src.split('\n').map((line) => {
    if (/^#!/.test(line)) return '';
    if (/^import\s/.test(line)) return importToConst(line);
    const m = line.match(/^export\s+(?:async\s+function|function|class|const|let)\s+([A-Za-z_$][\w$]*)/);
    if (m) { exportsList.push(m[1]); return line.replace(/^export\s+/, ''); }
    if (/^export\s*\{/.test(line)) throw new Error(`unsupported export form in ${name}: ${line}`);
    return line;
  }).join('\n');
  // async so the simulators' guarded top-level awaits stay legal; the page script awaits each module in order
  return `__m['./${name}'] = await (async () => {\n${body}\nreturn { ${exportsList.join(', ')} };\n})();\n`;
}
const bundle = `const __m = {};\n` + ORDER.map(wrapModule).join('\n');
let page = readFileSync(join(here, 'table.src.html'), 'utf8');
// inline the stylesheet so the built page stays a single file
page = page.replace('<link rel="stylesheet" href="table.css">', '<style>\n' + readFileSync(join(here, 'table.css'), 'utf8') + '\n</style>');
// replace the page's own imports with lookups, and inject the bundle at the top of its module script
page = page.replace(/^\s*import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?$/gm, (l) => '  ' + importToConst(l.trim()));
page = page.replace('<script type="module">\n', '<script type="module">\n' + bundle + '\n');
writeFileSync(join(here, 'table.html'), page);
console.log(`table.html written: ${(page.length / 1024).toFixed(0)} KB, modules: ${ORDER.join(', ')}`);
