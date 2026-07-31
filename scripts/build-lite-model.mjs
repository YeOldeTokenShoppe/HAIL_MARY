#!/usr/bin/env node
/**
 * build-lite-model.mjs — make the "_lite" temple model from an "_opt" build.
 *
 *   node scripts/build-lite-model.mjs public/models/RL80_4anims_v00_opt.glb
 *
 * WHY THIS EXISTS
 * GPU texture memory is driven by texture DIMENSIONS, not file size. The temple
 * export carries ~25 maps, and several of them are 1024x1024 images that
 * compress to 2-8KB on disk because they're nearly flat colour — each one still
 * costs ~5.3MB of VRAM once decoded with mipmaps. Left alone the model resides
 * at ~80MB of texture memory, which is what an iPad cannot afford. Shrinking
 * only the flat ones takes it to ~38MB with no visible change.
 *
 * Run this after EVERY re-export from Blender. If you skip it, the app keeps
 * serving the previous version's _lite file and your new work never ships.
 *
 * Build from the _opt build, never the raw Draco export: _opt carries the
 * dedup/weld pass. Starting from the raw file gives 72,341 verts instead of
 * 64,203 and a ~6.5MB result instead of ~4MB.
 *
 * Which textures get shrunk is derived from the file itself (see TARGET_RULE),
 * so a re-export that renames or re-authors textures is handled automatically.
 * Anything with real detail in it is left at full resolution.
 *
 * The rig is verified before anything is written: vertex/triangle counts, skins
 * and their inverseBindMatrices, animation and channel counts, node/mesh/
 * material counts. A mismatch aborts without touching public/models.
 *
 * Needs network on first run (fetches @gltf-transform/cli via npx). Nothing is
 * added to package.json.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';

const CLI = '@gltf-transform/cli@latest';

// Downscale rule. Disk size at a given dimension is a good proxy for how much
// detail a texture actually carries: a 1024² map that compresses to 3KB is
// flat, and nothing on screen can tell 1024 from 256. Tune here, in one place.
const TARGET_RULE = (w, kb) => {
  if (w >= 1024) return kb <= 8 ? 256 : kb <= 40 ? 512 : w;
  if (w >= 512 && kb <= 8) return 256;
  return w;
};

// ── GLB reading (no deps — we only need the JSON chunk + image headers) ──────

function readGlb(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${path}: not a GLB`);
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.slice(20, 20 + jsonLen).toString('utf8'));
  return { buf, json, binStart: 20 + jsonLen + 8 };
}

function imageSize({ buf, json, binStart }, image) {
  const view = json.bufferViews[image.bufferView];
  const start = binStart + (view.byteOffset || 0);
  const bytes = buf.slice(start, start + view.byteLength);
  let w = 0;
  let h = 0;
  if (bytes.slice(0, 4).toString() === 'RIFF' && bytes.slice(8, 12).toString() === 'WEBP') {
    const chunk = bytes.slice(12, 16).toString();
    if (chunk === 'VP8X') {
      w = (bytes.readUIntLE(24, 3) & 0xffffff) + 1;
      h = (bytes.readUIntLE(27, 3) & 0xffffff) + 1;
    } else if (chunk === 'VP8 ') {
      w = bytes.readUInt16LE(26) & 0x3fff;
      h = bytes.readUInt16LE(28) & 0x3fff;
    } else if (chunk === 'VP8L') {
      const bits = bytes.readUInt32LE(21);
      w = (bits & 0x3fff) + 1;
      h = ((bits >> 14) & 0x3fff) + 1;
    }
  } else if (bytes[0] === 0x89 && bytes.slice(1, 4).toString() === 'PNG') {
    w = bytes.readUInt32BE(16);
    h = bytes.readUInt32BE(20);
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let o = 2;
    while (o < bytes.length) {
      if (bytes[o] !== 0xff) { o++; continue; }
      const marker = bytes[o + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        h = bytes.readUInt16BE(o + 5);
        w = bytes.readUInt16BE(o + 7);
        break;
      }
      o += 2 + bytes.readUInt16BE(o + 2);
    }
  }
  return { w, h, kb: Math.round(view.byteLength / 1024) };
}

/** Everything that must survive the rebuild, plus the numbers we're changing. */
function profile(path) {
  const glb = readGlb(path);
  const { json } = glb;
  let verts = 0;
  let tris = 0;
  for (const mesh of json.meshes || []) {
    for (const prim of mesh.primitives) {
      const pos = json.accessors[prim.attributes.POSITION];
      if (pos) verts += pos.count;
      if (prim.indices != null) tris += json.accessors[prim.indices].count / 3;
    }
  }
  let channels = 0;
  for (const anim of json.animations || []) channels += anim.channels.length;

  let texBytes = 0;
  const images = (json.images || []).map((image, i) => {
    const { w, h, kb } = imageSize(glb, image);
    texBytes += w * h * 4 * 1.33; // RGBA + mipmaps
    return { i, name: image.name || `(unnamed ${i})`, w, h, kb };
  });

  return {
    fileMB: +(glb.buf.length / 1048576).toFixed(2),
    gpuTexMB: +(texBytes / 1048576).toFixed(1),
    images,
    // invariants
    verts,
    tris: Math.round(tris),
    skins: (json.skins || []).length,
    skinsWithIBM: (json.skins || []).filter((s) => s.inverseBindMatrices !== undefined).length,
    animations: (json.animations || []).length,
    channels,
    nodes: (json.nodes || []).length,
    meshes: (json.meshes || []).length,
    materials: (json.materials || []).length,
  };
}

const INVARIANTS = ['verts', 'tris', 'skins', 'skinsWithIBM', 'animations', 'channels', 'nodes', 'meshes', 'materials'];

// ── build ───────────────────────────────────────────────────────────────────

const source = process.argv[2];
if (!source) {
  console.error('usage: node scripts/build-lite-model.mjs <path/to/MODEL_opt.glb>');
  process.exit(1);
}
if (!existsSync(source)) {
  console.error(`not found: ${source}`);
  process.exit(1);
}
if (!source.includes('_opt')) {
  console.error(`refusing: expected an "_opt" build, got ${basename(source)}`);
  console.error('The _opt build carries the dedup/weld pass; the raw Draco export does not.');
  process.exit(1);
}

const dest = source.replace('_opt.glb', '_lite.glb');
const before = profile(source);

// Group the textures by the size we want them at.
const buckets = new Map();
for (const img of before.images) {
  const target = TARGET_RULE(img.w, img.kb);
  if (target >= img.w) continue;
  if (!buckets.has(target)) buckets.set(target, []);
  buckets.get(target).push(img);
}

console.log(`source  ${basename(source)}  ${before.fileMB}MB  |  ~${before.gpuTexMB}MB decoded textures`);
if (buckets.size === 0) {
  console.log('nothing to downscale — every texture already carries its detail.');
  process.exit(0);
}
for (const [target, imgs] of [...buckets].sort((a, b) => a[0] - b[0])) {
  console.log(`  -> ${target}px: ${imgs.map((t) => `${t.name} (${t.w}px, ${t.kb}KB)`).join(', ')}`);
}
const kept = before.images.filter((t) => TARGET_RULE(t.w, t.kb) >= t.w && t.w >= 1024);
if (kept.length) console.log(`  keep ${kept[0].w}px: ${kept.map((t) => `${t.name} (${t.kb}KB)`).join(', ')}`);

const work = join(tmpdir(), `lite-${process.pid}`);
const step = (n) => `${work}-${n}.glb`;
const gltf = (args) => execFileSync('npx', ['--yes', CLI, ...args], { stdio: ['ignore', 'ignore', 'inherit'] });

let cursor = source;
let n = 0;
try {
  for (const [target, imgs] of [...buckets].sort((a, b) => a[0] - b[0])) {
    // --pattern matches by texture/image NAME. Commas break the CLI's argument
    // parsing, so alternation has to be the extglob form.
    const pattern = `@(${imgs.map((t) => t.name).join('|')})`;
    const out = step(++n);
    console.log(`\nresize -> ${target}px ...`);
    gltf(['resize', cursor, out, '--width', String(target), '--height', String(target), '--pattern', pattern]);
    cursor = out;
  }

  // The resize passes decode EXT_meshopt_compression, so put it back or the
  // file ships ~50% larger than the _opt build it came from.
  const packed = step(++n);
  console.log('\nmeshopt ...');
  gltf(['meshopt', cursor, packed, '--level', 'medium']);
  cursor = packed;

  const after = profile(cursor);
  const broken = INVARIANTS.filter((k) => before[k] !== after[k]);

  console.log('');
  for (const k of INVARIANTS) {
    const flag = before[k] === after[k] ? 'ok' : 'MISMATCH';
    console.log(`  ${k.padEnd(13)} ${String(before[k]).padStart(8)} -> ${String(after[k]).padStart(8)}  ${flag}`);
  }

  if (broken.length) {
    // meshopt logs "prune: Removed types... Skin (19)" on every run — that is
    // dedup churn and the skins DO survive. This check is what proves it.
    console.error(`\nABORTED — the rebuild changed: ${broken.join(', ')}`);
    console.error(`Nothing was written. Inspect ${cursor}`);
    process.exit(1);
  }

  copyFileSync(cursor, dest);
  console.log(`\nwrote ${dest}`);
  console.log(`  ${before.fileMB}MB -> ${after.fileMB}MB file`);
  console.log(`  ~${before.gpuTexMB}MB -> ~${after.gpuTexMB}MB decoded textures`);
  console.log('\nPoint modelPath in CyborgTempleScene.jsx and modelToPreload in');
  console.log('app/trade/page.js at this file, or the app keeps serving the old one.');
} finally {
  for (let i = 1; i <= n; i++) rmSync(step(i), { force: true });
}
