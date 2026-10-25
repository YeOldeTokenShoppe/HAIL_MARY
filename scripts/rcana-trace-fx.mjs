#!/usr/bin/env node
// rcana-trace-fx — trace light facets for an FX sheet.
//
//   node scripts/rcana-trace-fx.mjs public/TCG/fx-overlays/flame3.webp
//   node scripts/rcana-trace-fx.mjs <sheet> --max 10 --sep 9 --blur 22 --min 0.08 --axis 0.92,-0.38
//
// The FX light (RcanaCard.jsx FxLight) is masked by the sheet's own luminance,
// so a facet placed over transparent pixels lights nothing. This finds where
// the sheet is actually bright — blur the luminance, greedily pick the
// brightest point, exclude a radius around it, repeat — and prints a facet
// block in asset-space percent, ready to paste into the card's art file.
//
// Facets come out ordered left-to-right with `angle` stepping evenly across
// the tilt range, which is what makes a left-right tilt WALK a highlight
// along the shape rather than swell the whole sheet. Tune by hand after:
//   axis       which tilt lights the facet (x,y in -1..1; negative y = toward
//              the top of the card). One shared axis for one ridge.
//   roughness  how wide the response is; spacing/roughness ≈ 0.9 overlaps.
//   radius     the ellipse, in percent of the sheet.
//   hue        the facet's own warmth; the material bounds it.
//
// Also prints each facet's local luminance, so a weak one is visible before
// it is shipped. Needs sharp (already a Next dependency).
import sharp from "sharp";
import path from "node:path";

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: rcana-trace-fx <sheet.webp|png> [--max N] [--sep %] [--blur px] [--min 0..1] [--axis x,y] [--json]");
  process.exit(1);
}
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const MAX = +opt("max", 10);
const SEP = +opt("sep", 9); // exclusion radius, % of width
const BLUR = +opt("blur", 22); // px at the sheet's own size
const MIN = +opt("min", 0.08); // lowest peak worth a facet
const AXIS = opt("axis", "0.92,-0.38").split(",").map(Number);
const JSON_OUT = args.includes("--json");

const img = sharp(file).ensureAlpha();
const { width: W, height: H } = await img.metadata();
const raw = await img.raw().toBuffer();

// Luminance × alpha: what the mask sees.
const lum = new Float32Array(W * H);
for (let i = 0, p = 0; i < W * H; i++, p += 4) {
  lum[i] = ((0.3 * raw[p] + 0.59 * raw[p + 1] + 0.11 * raw[p + 2]) / 255) * (raw[p + 3] / 255);
}
// Blur via sharp on a grey image of the luminance.
const grey = Buffer.alloc(W * H);
for (let i = 0; i < W * H; i++) grey[i] = Math.round(lum[i] * 255);
// sharp may hand the blurred result back with more than one channel, so the
// channel count is read from the result rather than assumed.
const { data: blurred, info: binfo } = await sharp(grey, { raw: { width: W, height: H, channels: 1 } })
  .blur(BLUR / 2) // sharp's sigma ≈ radius / 2
  .raw()
  .toBuffer({ resolveWithObject: true });
const bc = binfo.channels;
const sm = new Float32Array(W * H);
for (let i = 0; i < W * H; i++) sm[i] = blurred[i * bc] / 255;

const peaks = [];
const work = Float32Array.from(sm);
const r2 = (SEP / 100 * W) ** 2;
for (let n = 0; n < MAX; n++) {
  let best = -1, bi = -1;
  for (let i = 0; i < work.length; i++) if (work[i] > best) { best = work[i]; bi = i; }
  if (best < MIN) break;
  const px = bi % W, py = (bi / W) | 0;
  peaks.push({ x: px / W * 100, y: py / H * 100, lum: best });
  const x0 = Math.max(0, px - Math.ceil(Math.sqrt(r2))), x1 = Math.min(W - 1, px + Math.ceil(Math.sqrt(r2)));
  const y0 = Math.max(0, py - Math.ceil(Math.sqrt(r2))), y1 = Math.min(H - 1, py + Math.ceil(Math.sqrt(r2)));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if ((x - px) ** 2 + (y - py) ** 2 < r2) work[y * W + x] = 0;
  }
}
if (!peaks.length) {
  console.error("no peaks above --min; is the sheet mostly transparent?");
  process.exit(2);
}

// Order along x so the angles walk the ridge, and spread the angles across
// the usable tilt range (±0.75 covers an 8° card without clipping).
peaks.sort((a, b) => a.x - b.x);
const n = peaks.length;
const facets = peaks.map((p, i) => {
  const angle = n === 1 ? 0 : -0.75 + (1.5 * i) / (n - 1);
  // Radius from the local bright area: sample how far the blurred field
  // stays above half the peak, horizontally and vertically.
  const px = Math.round(p.x / 100 * W), py = Math.round(p.y / 100 * H);
  const half = p.lum * 0.5;
  const reach = (dx, dy) => {
    let d = 0;
    while (true) {
      const x = px + dx * d, y = py + dy * d;
      if (x < 0 || y < 0 || x >= W || y >= H || sm[y * W + x] < half) return d;
      d++;
    }
  };
  const rx = Math.max(6, Math.min(16, ((reach(1, 0) + reach(-1, 0)) / 2 / W) * 100 * 1.3));
  const ry = Math.max(5, Math.min(14, ((reach(0, 1) + reach(0, -1)) / 2 / H) * 100 * 1.3));
  // Warmer where brighter — the material clamps it to its hueRange anyway.
  const hue = Math.round(30 + p.lum * 30);
  return {
    x: +p.x.toFixed(0), y: +p.y.toFixed(0),
    radius: [+rx.toFixed(0), +ry.toFixed(0)],
    axis: AXIS, angle: +angle.toFixed(2), roughness: 0.28, hue,
    lum: +p.lum.toFixed(2),
  };
});

if (JSON_OUT) {
  console.log(JSON.stringify(facets.map(({ lum, ...f }) => f), null, 2));
} else {
  console.log(`// ${path.basename(file)} — ${W}x${H}, ${n} facets, blur ${BLUR}px, sep ${SEP}%`);
  console.log("facets: [");
  for (const f of facets) {
    const ax = f.axis.map((v) => v.toFixed(2)).join(", ");
    console.log(
      `  { x: ${f.x}, y: ${f.y}, radius: [${f.radius}], axis: [${ax}], angle: ${f.angle.toFixed(2).padStart(5)}, roughness: ${f.roughness}, hue: ${f.hue} }, // lum ${f.lum}`
    );
  }
  console.log("],");
}
