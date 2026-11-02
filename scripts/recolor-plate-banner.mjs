#!/usr/bin/env node
// Recolour the name banner's border on a Lotería plate.
//
//   node scripts/recolor-plate-banner.mjs <in.webp> <out.webp> <#hex> [rows]
//
// The border is a bevel — near-black up through the bright red, with soft
// edges into the gold and the black field — so a flat colour replace either
// leaves a red fringe or flattens the bevel. This keeps every pixel's own
// brightness and softness and swaps only the hue and saturation: pixels are
// weighted by how red they are (hue distance, saturation), and each one is
// moved to the target hue with its value scaled by target/reference, so the
// shading lands where it was painted.
//
// `rows` limits the pass to the banner's rows ("850-1200" by default, on the
// 1027x1424 plate); the RL80 rosette in the signature strip below is red too
// and must stay that way. The small red diamonds inside the banner's fleur
// ornaments sit in those rows and take the new colour with the border.
import sharp from "sharp";

const [, , inPath, outPath, hex, rowsArg = "850-1200"] = process.argv;
if (!inPath || !outPath || !/^#[0-9a-f]{6}$/i.test(hex || "")) {
  console.error("usage: recolor-plate-banner.mjs <in> <out> <#rrggbb> [y0-y1]");
  process.exit(1);
}
const [Y0, Y1] = rowsArg.split("-").map(Number);
const REFERENCE = "#b20d19"; // the red the plate was painted with

const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const rgbHsv = (r, g, b) => {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6; if (h < 0) h += 1;
  }
  return [h, max ? d / max : 0, max];
};
const hsvRgb = (h, s, v) => {
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
};
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const hueDist = (a, b) => { const d = Math.abs(a - b); return Math.min(d, 1 - d); };

const [th, ts, tv] = rgbHsv(...hexRgb(hex));
const [rh, rs, rv] = rgbHsv(...hexRgb(REFERENCE));

const img = sharp(inPath).ensureAlpha();
const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
let touched = 0;
for (let y = Math.max(0, Y0); y < Math.min(height, Y1); y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * channels;
    const a = data[i + 3];
    if (a < 4) continue;
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const [h, s, v] = rgbHsv(r, g, b);
    if (v < 0.08) continue; // the black field and the ink outlines
    // How red is it: full weight inside 0.035 of the reference hue, gone by
    // 0.085 (gold sits at ~0.11, so a red/gold edge pixel gets part weight);
    // and faded in over saturation so grey-ish anti-aliasing is left alone.
    const wh = 1 - clamp01((hueDist(h, rh) - 0.035) / 0.05);
    const ws = clamp01((s - 0.3) / 0.3);
    const w = wh * ws;
    if (w <= 0) continue;
    const nv = clamp01(v * (tv / rv));
    const ns = clamp01(s * (ts / rs));
    const [nr, ng, nb] = hsvRgb(th, ns, nv);
    data[i] = Math.round((r + (nr - r) * w) * 255);
    data[i + 1] = Math.round((g + (ng - g) * w) * 255);
    data[i + 2] = Math.round((b + (nb - b) * w) * 255);
    touched++;
  }
}
await sharp(data, { raw: { width, height, channels } })
  .webp({ quality: 92, alphaQuality: 100, effort: 6 })
  .toFile(outPath);
console.log(`${outPath}: ${touched} px recoloured to ${hex} in rows ${Y0}-${Y1}`);
