"use client";

import { useEffect, useRef } from "react";

// Gothic lancet — portrait canvas with a pointed-arch outline.
// PAD reserves space so the outer stroke isn't clipped at edges.
const PAD = 10;
const IW = 480;
const IH = 751;
const W = IW + PAD * 2;
const H = IH + PAD * 2;
const ARCH_SPRING = IH * 0.38 + PAD;
const TWO_PI = Math.PI * 2;

function gothicPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(PAD, H - PAD);
  ctx.lineTo(PAD, ARCH_SPRING);
  ctx.bezierCurveTo(
    PAD + IW * 0.10, (ARCH_SPRING - PAD) * 0.10 + PAD,
    PAD + IW * 0.56, PAD + 2,
    W * 0.5, PAD
  );
  ctx.bezierCurveTo(
    PAD + IW * 0.44, PAD + 2,
    PAD + IW * 0.90, (ARCH_SPRING - PAD) * 0.10 + PAD,
    W - PAD, ARCH_SPRING
  );
  ctx.lineTo(W - PAD, H - PAD);
  ctx.closePath();
}

const ROUND_R = W * 0.5 - PAD;
const ROUND_CX = W * 0.5;
const ROUND_CY = H * 0.5;

function roundPath(ctx) {
  ctx.beginPath();
  ctx.arc(ROUND_CX, ROUND_CY, ROUND_R, 0, TWO_PI);
  ctx.closePath();
}

const LEAD = "rgb(8, 6, 12)";
const AMBER = "#f4bf45";

const PANES = [
  [60, 110, 200],  // cobalt
  [40, 80, 180],   // sapphire
  [120, 70, 200],  // royal purple
  [90, 50, 180],   // violet
  [210, 60, 90],   // ruby
  [170, 40, 70],   // wine
  [60, 150, 100],  // emerald
  [240, 175, 60],  // amber accent
];
const PANE_WEIGHTS = [3, 3, 3, 3, 2, 2, 1, 2];

const DELAUNAY_SRC = "https://s3-us-west-2.amazonaws.com/s.cdpn.io/175711/delaunay.js";
const GSAP_SRC = "https://cdnjs.cloudflare.com/ajax/libs/gsap/1.13.2/TweenMax.min.js";

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-shatter="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.dataset.shatter = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

const SUB_DIGITS = ["₀","₁","₂","₃","₄","₅","₆","₇","₈","₉"];
const SUB_SET = new Set(SUB_DIGITS);
const toSubscript = (n) =>
  String(n).split("").map((d) => SUB_DIGITS[+d]).join("");

// Per-character layout so cutout and stroke share positions, and so we can compress
// letter-spacing (canvas has no letter-spacing). `tracking` < 1 tightens the digits.
const PRICE_TRACKING = 0.88;
const PRICE_FONT_MAIN = "900 108px Orbitron, sans-serif";
const PRICE_FONT_SYMBOL = "900 70px Orbitron, sans-serif";

function glyphStyle(ch) {
  if (ch === "$") return { font: PRICE_FONT_SYMBOL, strokeW: 5 };
  if (SUB_SET.has(ch)) return { font: PRICE_FONT_MAIN, strokeW: 4 };
  return { font: PRICE_FONT_MAIN, strokeW: 7 };
}

function measurePriceGlyphs(ctx, str) {
  const glyphs = [];
  let off = 0;
  let lastW = 0;
  for (const ch of str) {
    const style = glyphStyle(ch);
    ctx.font = style.font;
    const w = ctx.measureText(ch).width;
    glyphs.push({ ch, style, offset: off });
    lastW = w;
    off += w * PRICE_TRACKING;
  }
  // visual extent: last glyph's offset + its full width (no tracking shrink on the right)
  const totalWidth = glyphs.length ? glyphs[glyphs.length - 1].offset + lastW : 0;
  return { glyphs, totalWidth };
}

function formatPrice(p) {
  if (p == null || !Number.isFinite(p)) return "—";
  if (p >= 1) return p.toFixed(3);
  if (p >= 0.001) return p.toFixed(4);
  if (p <= 0) return p.toFixed(3);
  // round to 4 significant digits — enough resolution that sub-percent ETH
  // moves flip a visible digit. Math.round handles carry (e.g. 0.0₇9999 → 0.0₆1000)
  const SIG = 4;
  const exp = Math.floor(Math.log10(p));
  const factor = Math.pow(10, SIG - 1 - exp);
  const rounded = Math.round(p * factor) / factor;
  const frac = rounded.toFixed(20).split(".")[1];
  let zeros = 0;
  while (zeros < frac.length && frac[zeros] === "0") zeros++;
  const sig = frac.slice(zeros, zeros + SIG).replace(/0+$/, "") || "0";
  return `0.0${toSubscript(zeros)}${sig}`;
}

function formatMoney(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  // Extra decimals so a 1–2% ETH move (which revalues FDV via the RL80/ETH
  // ratio) actually shifts a displayed digit instead of rounding away.
  if (a >= 1e9) return `$${(a / 1e9).toFixed(3)}B`;
  if (a >= 1e6) return `$${(a / 1e6).toFixed(3)}M`;
  if (a >= 1e3) return `$${(a / 1e3).toFixed(2)}K`;
  return `$${a.toFixed(0)}`;
}

function sumVolume(candles) {
  if (!Array.isArray(candles)) return 0;
  return candles.reduce((a, c) => a + (c.volume || 0), 0);
}

const VIEWS = [
  {
    id: "price",
    eyebrow: () => "R L 8 0   /   U S D",
    main: (p) => (p.loading ? "—" : formatPrice(p.latestPrice)),
    sub: (p) => {
      const pct = Number.isFinite(p.priceChange24h) ? p.priceChange24h : 0;
      const up = pct >= 0;
      return {
        text: (up ? "▲ +" : "▼ ") + Math.abs(pct).toFixed(2) + "%   24H",
        color: up ? "#4ade80" : "#ef4444",
      };
    },
  },
  {
    id: "marketcap",
    eyebrow: () => "M A R K E T   C A P",
    main: (p) => formatMoney(p.marketCap),
    sub: () => ({ text: "Y O U ' R E   E A R L Y", color: AMBER }),
  },
];
const VIEW_ROTATE_MS = 7000;

function rr(min, max) { return min + (max - min) * Math.random(); }
function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
function sgn(x) { return x < 0 ? -1 : 1; }

function pickPane() {
  let total = 0;
  for (let i = 0; i < PANE_WEIGHTS.length; i++) total += PANE_WEIGHTS[i];
  let r = Math.random() * total;
  for (let j = 0; j < PANES.length; j++) {
    r -= PANE_WEIGHTS[j];
    if (r <= 0) return PANES[j];
  }
  return PANES[0];
}

function createGlassTexture() {
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const tctx = c.getContext("2d");
  const img = tctx.createImageData(W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 35;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 16 + Math.random() * 14;
  }
  tctx.putImageData(img, 0, 0);
  return c;
}

function drawRosette(ctx, cx, cy, radius, spokes) {
  for (let i = 0; i < spokes; i++) {
    const a0 = (i / spokes) * TWO_PI - Math.PI / 2;
    const a1 = ((i + 1) / spokes) * TWO_PI - Math.PI / 2;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * radius, cy + Math.sin(a0) * radius);
    ctx.arc(cx, cy, radius, a0, a1);
    ctx.closePath();

    const pane = pickPane();
    const j = 0.88 + Math.random() * 0.24;
    const pr = Math.min(255, Math.round(pane[0] * j * 1.15));
    const pg = Math.min(255, Math.round(pane[1] * j * 1.15));
    const pb = Math.min(255, Math.round(pane[2] * j * 1.15));

    const midA = (a0 + a1) / 2;
    const gx = cx + Math.cos(midA) * radius * 0.45;
    const gy = cy + Math.sin(midA) * radius * 0.45;
    const grad = ctx.createRadialGradient(gx, gy, 0, cx, cy, radius);
    grad.addColorStop(0, `rgba(${Math.min(255, pr + 50)},${Math.min(255, pg + 50)},${Math.min(255, pb + 35)},0.6)`);
    grad.addColorStop(1, `rgba(${pr},${pg},${pb},0.3)`);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = LEAD;
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }

  const hubR = radius * 0.22;
  ctx.beginPath();
  ctx.arc(cx, cy, hubR, 0, TWO_PI);
  const hp = pickPane();
  const hg = ctx.createRadialGradient(cx, cy - hubR * 0.3, 0, cx, cy, hubR);
  hg.addColorStop(0, `rgba(${Math.min(255, hp[0] + 60)},${Math.min(255, hp[1] + 60)},${Math.min(255, hp[2] + 40)},0.65)`);
  hg.addColorStop(1, `rgba(${hp[0]},${hp[1]},${hp[2]},0.4)`);
  ctx.fillStyle = hg;
  ctx.fill();
  ctx.strokeStyle = LEAD;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TWO_PI);
  ctx.strokeStyle = LEAD;
  ctx.lineWidth = 5;
  ctx.stroke();
}

function drawBurningHeart(ctx, cx, cy, radius) {
  // RL80 favicon heart — ruby heart with emerald chart-arrow, in lead came

  const s = radius * 1.6 / 49;
  const ox = cx - 24.5 * s;
  const oy = cy - 22 * s;

  function heartPath(c) {
    c.beginPath();
    c.moveTo(ox + 48.281 * s, oy + 9.414 * s);
    c.bezierCurveTo(ox + 46.75 * s, oy + 4.211 * s, ox + 41.805 * s, oy + 0.113 * s, ox + 35.957 * s, oy + 0.113 * s);
    c.bezierCurveTo(ox + 31.051 * s, oy + 0.113 * s, ox + 26.785 * s, oy + 2.883 * s, ox + 24.629 * s, oy + 6.949 * s);
    c.bezierCurveTo(ox + 22.473 * s, oy + 2.883 * s, ox + 18.211 * s, oy + 0.113 * s, ox + 13.301 * s, oy + 0.113 * s);
    c.bezierCurveTo(ox + 7.188 * s, oy + 0.113 * s, ox + 1.836 * s, oy + 4.211 * s, ox + 0.785 * s, oy + 10.164 * s);
    c.bezierCurveTo(ox - 1.875 * s, oy + 25.254 * s, ox + 15.004 * s, oy + 37.066 * s, ox + 24.668 * s, oy + 44.129 * s);
    c.bezierCurveTo(ox + 33.602 * s, oy + 37.598 * s, ox + 52.66 * s, oy + 24.285 * s, ox + 48.281 * s, oy + 9.414 * s);
    c.closePath();
  }

  function arrowPath(c) {
    c.beginPath();
    c.moveTo(ox + 0.754 * s, oy + 37.027 * s);
    c.lineTo(ox + 18.555 * s, oy + 19.133 * s);
    c.lineTo(ox + 21.633 * s, oy + 23.582 * s);
    c.lineTo(ox + 38.797 * s, oy + 6.418 * s);
    c.lineTo(ox + 30.867 * s, oy + 5.598 * s);
    c.lineTo(ox + 52.406 * s, oy + 1.641 * s);
    c.lineTo(ox + 47.238 * s, oy + 18.453 * s);
    c.lineTo(ox + 46.32 * s, oy + 11.461 * s);
    c.lineTo(ox + 20.387 * s, oy + 30.273 * s);
    c.lineTo(ox + 17.414 * s, oy + 26.605 * s);
    c.closePath();
  }

  // Render heart+arrow on a temp canvas
  const tmp = document.createElement("canvas");
  tmp.width = W; tmp.height = H;
  const tc = tmp.getContext("2d");

  // Heart body — ruby glass
  heartPath(tc);
  const ruby = [210, 40, 60];
  const hGrad = tc.createRadialGradient(cx, cy - radius * 0.1, 0, cx, cy, radius * 0.8);
  hGrad.addColorStop(0, `rgba(${ruby[0] + 45},${ruby[1] + 30},${ruby[2] + 25},0.65)`);
  hGrad.addColorStop(0.6, `rgba(${ruby[0]},${ruby[1]},${ruby[2]},0.50)`);
  hGrad.addColorStop(1, `rgba(${ruby[0] - 40},${ruby[1]},${ruby[2] - 10},0.30)`);
  tc.fillStyle = hGrad;
  tc.fill();

  // Heart specular
  heartPath(tc);
  const hSpec = tc.createRadialGradient(cx - radius * 0.15, cy - radius * 0.2, 0, cx, cy, radius * 0.5);
  hSpec.addColorStop(0, "rgba(255,255,250,0.16)");
  hSpec.addColorStop(1, "rgba(255,255,240,0)");
  tc.fillStyle = hSpec;
  tc.fill();

  // Heart lead came + outer ring — drawn before the punch so they get cut too
  heartPath(tc);
  tc.strokeStyle = LEAD;
  tc.lineWidth = 4;
  tc.stroke();

  tc.beginPath();
  tc.arc(cx, cy, radius, 0, TWO_PI);
  tc.strokeStyle = LEAD;
  tc.lineWidth = 5;
  tc.stroke();

  // Punch arrow out of heart + ring + lead
  tc.save();
  tc.globalCompositeOperation = "destination-out";
  tc.fillStyle = "#000";
  arrowPath(tc);
  tc.fill();
  tc.restore();

  // Arrow — emerald glass
  arrowPath(tc);
  const emerald = [60, 200, 40];
  const aGrad = tc.createRadialGradient(cx + radius * 0.1, cy - radius * 0.15, 0, cx, cy, radius * 0.7);
  aGrad.addColorStop(0, `rgba(${emerald[0] + 40},${emerald[1] + 30},${emerald[2] + 20},0.65)`);
  aGrad.addColorStop(1, `rgba(${emerald[0]},${emerald[1]},${emerald[2]},0.35)`);
  tc.fillStyle = aGrad;
  tc.fill();

  // Arrow lead came
  arrowPath(tc);
  tc.strokeStyle = LEAD;
  tc.lineWidth = 3;
  tc.stroke();

  // Stamp the composited heart+arrow+ring onto the main context
  ctx.drawImage(tmp, 0, 0);
}

function drawStar(ctx, cx, cy, radius) {
  const points = 6;
  const outerR = radius * 0.88;
  const innerR = outerR * 0.5;

  function starPath(c) {
    c.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const a = (i / (points * 2)) * TWO_PI - Math.PI / 2;
      const r = i % 2 === 0 ? outerR : innerR;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    c.closePath();
  }

  // Each triangle section as a separate glass pane
  for (let i = 0; i < points * 2; i++) {
    const a0 = (i / (points * 2)) * TWO_PI - Math.PI / 2;
    const a1 = ((i + 1) / (points * 2)) * TWO_PI - Math.PI / 2;
    const r0 = i % 2 === 0 ? outerR : innerR;
    const r1 = (i + 1) % 2 === 0 ? outerR : innerR;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0);
    ctx.lineTo(cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1);
    ctx.closePath();

    const pane = pickPane();
    const j = 0.88 + Math.random() * 0.24;
    const pr = Math.min(255, Math.round(pane[0] * j * 1.15));
    const pg = Math.min(255, Math.round(pane[1] * j * 1.15));
    const pb = Math.min(255, Math.round(pane[2] * j * 1.15));

    const midA = (a0 + a1) / 2;
    const midR = (r0 + r1) / 2;
    const gx = cx + Math.cos(midA) * midR * 0.45;
    const gy = cy + Math.sin(midA) * midR * 0.45;
    const grad = ctx.createRadialGradient(gx, gy, 0, cx, cy, outerR);
    grad.addColorStop(0, `rgba(${Math.min(255, pr + 50)},${Math.min(255, pg + 50)},${Math.min(255, pb + 35)},0.6)`);
    grad.addColorStop(1, `rgba(${pr},${pg},${pb},0.3)`);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = LEAD;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Star outline
  starPath(ctx);
  ctx.strokeStyle = LEAD;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TWO_PI);
  ctx.strokeStyle = LEAD;
  ctx.lineWidth = 5;
  ctx.stroke();
}

function drawTrefoil(ctx, cx, cy, radius) {
  const lobeR = radius * 0.45;
  const dist = radius * 0.38;
  const lobeAngles = [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6];
  const positions = lobeAngles.map((a) => [
    cx + Math.cos(a) * dist,
    cy + Math.sin(a) * dist,
  ]);

  // Single glass color — all lobes merge into one unified shape
  const pane = pickPane();
  const j = 0.88 + Math.random() * 0.24;
  const pr = Math.min(255, Math.round(pane[0] * j * 1.15));
  const pg = Math.min(255, Math.round(pane[1] * j * 1.15));
  const pb = Math.min(255, Math.round(pane[2] * j * 1.15));

  // Fill union as one flat shape: opaque mask, then gradient clipped to it
  const fillTmp = document.createElement("canvas");
  fillTmp.width = W; fillTmp.height = H;
  const fc = fillTmp.getContext("2d");

  // Step 1: fill the union shape as a solid mask
  fc.fillStyle = "#fff";
  positions.forEach(([lx, ly]) => {
    fc.beginPath();
    fc.arc(lx, ly, lobeR, 0, TWO_PI);
    fc.fill();
  });

  // Step 2: paint gradient only where the mask exists
  fc.globalCompositeOperation = "source-in";
  const grad = fc.createRadialGradient(cx, cy - radius * 0.15, 0, cx, cy, radius * 0.8);
  grad.addColorStop(0, `rgba(${Math.min(255, pr + 50)},${Math.min(255, pg + 50)},${Math.min(255, pb + 35)},0.6)`);
  grad.addColorStop(1, `rgba(${pr},${pg},${pb},0.3)`);
  fc.fillStyle = grad;
  fc.fillRect(0, 0, W, H);

  ctx.drawImage(fillTmp, 0, 0);

  // Union outline: fill expanded circles, punch contracted circles
  const tmp = document.createElement("canvas");
  tmp.width = W; tmp.height = H;
  const tc = tmp.getContext("2d");

  tc.fillStyle = LEAD;
  positions.forEach(([lx, ly]) => {
    tc.beginPath();
    tc.arc(lx, ly, lobeR + 2, 0, TWO_PI);
    tc.fill();
  });

  tc.save();
  tc.globalCompositeOperation = "destination-out";
  tc.fillStyle = "#000";
  positions.forEach(([lx, ly]) => {
    tc.beginPath();
    tc.arc(lx, ly, lobeR - 2, 0, TWO_PI);
    tc.fill();
  });
  tc.restore();

  ctx.drawImage(tmp, 0, 0);

  // Outer ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TWO_PI);
  ctx.strokeStyle = LEAD;
  ctx.lineWidth = 5;
  ctx.stroke();
}

function buildGlass() {
  // daylight backdrop — subtle warm tint, mostly transparent so the dark
  // page behind bleeds through the panes like real backlit stained glass
  const daylight = document.createElement("canvas");
  daylight.width = W; daylight.height = H;
  const dctx = daylight.getContext("2d");
  dctx.save();
  gothicPath(dctx);
  dctx.clip();
  const back = dctx.createRadialGradient(W * 0.5, H * 0.38, IW * 0.05, W * 0.5, H * 0.42, IW * 0.7);
  back.addColorStop(0, "rgba(255, 248, 225, 0.20)");
  back.addColorStop(0.3, "rgba(255, 242, 210, 0.12)");
  back.addColorStop(0.6, "rgba(255, 235, 195, 0.06)");
  back.addColorStop(1, "rgba(247, 228, 184, 0.02)");
  dctx.fillStyle = back;
  dctx.fillRect(0, 0, W, H);
  dctx.restore();

  // pane layer — clipped to the arch, pattern chosen randomly
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.save();
  gothicPath(ctx);
  ctx.clip();

  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  function fillPane(ctx, x, y, w, h) {
    const pane = pickPane();
    const jitter = 0.88 + Math.random() * 0.24;
    const pr = Math.min(255, Math.round(pane[0] * jitter * 1.15));
    const pg = Math.min(255, Math.round(pane[1] * jitter * 1.15));
    const pb = Math.min(255, Math.round(pane[2] * jitter * 1.15));

    const pcx = x + w / 2, pcy = y + h / 2;
    const pr2 = Math.sqrt(w * w + h * h) * 0.55;

    // Radial gradient — bright center (backlit), dark edges near lead
    const base = ctx.createRadialGradient(
      pcx + rr(-w * 0.08, w * 0.08), pcy - h * 0.12, pr2 * 0.05,
      pcx, pcy, pr2
    );
    base.addColorStop(0, `rgba(${Math.min(255, pr + 45)},${Math.min(255, pg + 45)},${Math.min(255, pb + 30)},0.62)`);
    base.addColorStop(0.5, `rgba(${pr},${pg},${pb},0.48)`);
    base.addColorStop(1, `rgba(${Math.max(0, pr - 35)},${Math.max(0, pg - 35)},${Math.max(0, pb - 20)},0.28)`);
    ctx.fillStyle = base;
    ctx.fillRect(x, y, w, h);

    // Specular highlight — small bright spot offset upper-left
    const specX = pcx - w * 0.15 + rr(-w * 0.05, w * 0.05);
    const specY = pcy - h * 0.22 + rr(-h * 0.05, h * 0.05);
    const spec = ctx.createRadialGradient(specX, specY, 0, specX, specY, pr2 * 0.4);
    spec.addColorStop(0, "rgba(255,255,250,0.14)");
    spec.addColorStop(0.5, "rgba(255,255,245,0.05)");
    spec.addColorStop(1, "rgba(255,255,240,0)");
    ctx.fillStyle = spec;
    ctx.fillRect(x, y, w, h);

    // Edge shadow near the lead
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = "rgba(30, 20, 12, 0.30)";
    ctx.lineWidth = 10;
    ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
    ctx.restore();

    ctx.strokeStyle = LEAD;
    ctx.lineWidth = 5;
    ctx.strokeRect(x, y, w, h);
  }

  function fillDiamond(ctx, cx, cy, halfDW, halfDH) {
    const pane = pickPane();
    const jitter = 0.88 + Math.random() * 0.24;
    const pr = Math.min(255, Math.round(pane[0] * jitter * 1.15));
    const pg = Math.min(255, Math.round(pane[1] * jitter * 1.15));
    const pb = Math.min(255, Math.round(pane[2] * jitter * 1.15));

    function diamondPath() {
      ctx.beginPath();
      ctx.moveTo(cx, cy - halfDH);
      ctx.lineTo(cx + halfDW, cy);
      ctx.lineTo(cx, cy + halfDH);
      ctx.lineTo(cx - halfDW, cy);
      ctx.closePath();
    }

    const dr = Math.sqrt(halfDW * halfDW + halfDH * halfDH);

    // Radial gradient — backlit glass effect
    diamondPath();
    const base = ctx.createRadialGradient(
      cx + rr(-halfDW * 0.1, halfDW * 0.1), cy - halfDH * 0.15, dr * 0.05,
      cx, cy, dr * 0.8
    );
    base.addColorStop(0, `rgba(${Math.min(255, pr + 45)},${Math.min(255, pg + 45)},${Math.min(255, pb + 30)},0.62)`);
    base.addColorStop(0.5, `rgba(${pr},${pg},${pb},0.48)`);
    base.addColorStop(1, `rgba(${Math.max(0, pr - 35)},${Math.max(0, pg - 35)},${Math.max(0, pb - 20)},0.28)`);
    ctx.fillStyle = base;
    ctx.fill();

    // Specular highlight
    diamondPath();
    const specX = cx - halfDW * 0.15 + rr(-halfDW * 0.05, halfDW * 0.05);
    const specY = cy - halfDH * 0.25 + rr(-halfDH * 0.05, halfDH * 0.05);
    const spec = ctx.createRadialGradient(specX, specY, 0, specX, specY, dr * 0.35);
    spec.addColorStop(0, "rgba(255,255,250,0.14)");
    spec.addColorStop(0.5, "rgba(255,255,245,0.05)");
    spec.addColorStop(1, "rgba(255,255,240,0)");
    ctx.fillStyle = spec;
    ctx.fill();

    // Edge shadow near lead
    diamondPath();
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = "rgba(30, 20, 12, 0.30)";
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.restore();

    // Lead came
    diamondPath();
    ctx.strokeStyle = LEAD;
    ctx.lineWidth = 5;
    ctx.stroke();
  }

  const pattern = [0, 1, 3][Math.floor(Math.random() * 3)];

  if (pattern === 0) {
    // Diamond lattice (diaper pattern)
    const DW = 148, DH = 196;
    const halfDW = DW / 2, halfDH = DH / 2;
    const jStart = Math.floor(-DH / (DH / 2)) - 1;
    const jEnd = Math.ceil((H + DH) / (DH / 2)) + 1;
    for (let j = jStart; j <= jEnd; j++) {
      const offsetX = j % 2 === 0 ? 0 : halfDW;
      const iStart = Math.floor((-DW - offsetX) / DW) - 1;
      const iEnd = Math.ceil((W + DW - offsetX) / DW) + 1;
      for (let i = iStart; i <= iEnd; i++) {
        fillDiamond(ctx, offsetX + i * DW, j * halfDH, halfDW, halfDH);
      }
    }
  } else if (pattern === 1) {
    // Mullion + transom — gridded upper band, tall lower panels
    const cols = 5;
    const pw = IW / cols;
    const splitY = IH * 0.35;
    const topRows = 3;
    const th = splitY / topRows;
    for (let r = 0; r < topRows; r++) {
      for (let cc = 0; cc < cols; cc++) {
        fillPane(ctx, PAD + cc * pw, PAD + r * th, pw, th);
      }
    }
    for (let cc = 0; cc < cols; cc++) {
      fillPane(ctx, PAD + cc * pw, PAD + splitY, pw, IH - splitY);
    }
    // Transom — heavy horizontal lead line capping the tall panels
    ctx.beginPath();
    ctx.moveTo(PAD, PAD + splitY);
    ctx.lineTo(W - PAD, PAD + splitY);
    ctx.strokeStyle = LEAD;
    ctx.lineWidth = 7;
    ctx.stroke();
  } else if (pattern === 2) {
    // Vertical bars — tall narrow panels
    const cols = 4;
    const pw = IW / cols;
    for (let cc = 0; cc < cols; cc++) {
      fillPane(ctx, PAD + cc * pw, PAD, pw, IH);
    }
  } else {
    // Triple lancet tracery — three pointed sub-arches
    const lancets = 3;
    const gap = 8;
    const lw = (IW - gap * (lancets - 1)) / lancets;
    const lSpring = H * 0.50;
    // fill background pane behind the tracery
    fillPane(ctx, PAD, PAD, IW, IH);
    // draw each lancet as a filled colored arch with lead outline
    const tipY = PAD + IH * 0.03;
    const archSpan = lSpring - tipY;

    function lancetPath(c, lx, lcx) {
      c.beginPath();
      c.moveTo(lx, H - PAD);
      c.lineTo(lx, lSpring);
      c.bezierCurveTo(
        lx + lw * 0.02, tipY + archSpan * 0.20,
        lx + lw * 0.35, tipY + archSpan * 0.02,
        lcx, tipY
      );
      c.bezierCurveTo(
        lx + lw * 0.65, tipY + archSpan * 0.02,
        lx + lw * 0.98, tipY + archSpan * 0.20,
        lx + lw, lSpring
      );
      c.lineTo(lx + lw, H - PAD);
      c.closePath();
    }

    for (let n = 0; n < lancets; n++) {
      const lx = PAD + n * (lw + gap);
      const lcx = lx + lw / 2;
      const pane = pickPane();
      const jitter = 0.88 + Math.random() * 0.24;
      const pr = Math.min(255, Math.round(pane[0] * jitter));
      const pg = Math.min(255, Math.round(pane[1] * jitter));
      const pb = Math.min(255, Math.round(pane[2] * jitter));

      lancetPath(ctx, lx, lcx);

      // Radial gradient — backlit glass
      const lGrad = ctx.createRadialGradient(lcx, lSpring * 0.55, 0, lcx, H * 0.5, lw * 1.2);
      lGrad.addColorStop(0, `rgba(${Math.min(255, pr + 55)},${Math.min(255, pg + 55)},${Math.min(255, pb + 40)},0.62)`);
      lGrad.addColorStop(0.5, `rgba(${pr},${pg},${pb},0.48)`);
      lGrad.addColorStop(1, `rgba(${Math.max(0, pr - 30)},${Math.max(0, pg - 30)},${Math.max(0, pb - 20)},0.28)`);
      ctx.fillStyle = lGrad;
      ctx.fill();

      // Specular highlight
      ctx.save();
      ctx.clip();
      const specX = lcx - lw * 0.1 + rr(-lw * 0.05, lw * 0.05);
      const specY = tipY + archSpan * 0.4;
      const lSpec = ctx.createRadialGradient(specX, specY, 0, specX, specY, lw * 0.5);
      lSpec.addColorStop(0, "rgba(255,255,250,0.14)");
      lSpec.addColorStop(0.5, "rgba(255,255,245,0.05)");
      lSpec.addColorStop(1, "rgba(255,255,240,0)");
      ctx.fillStyle = lSpec;
      ctx.fillRect(lx, PAD, lw, IH);
      ctx.restore();

      // re-trace for lead stroke
      lancetPath(ctx, lx, lcx);

      // Visible stone under-stroke so arch curves read against dark areas
      ctx.strokeStyle = "rgba(170, 150, 110, 0.75)";
      ctx.lineWidth = 12;
      ctx.stroke();

      ctx.strokeStyle = LEAD;
      ctx.lineWidth = 6;
      ctx.stroke();
    }

  }

  // Glass texture overlay — subtle grain for physical depth
  ctx.save();
  ctx.globalCompositeOperation = "overlay";
  ctx.drawImage(createGlassTexture(), 0, 0);
  ctx.restore();

  // Tracery in the arch apex — rendered offscreen then stamped to avoid overlap
  const traceryY = PAD + IH * 0.20;
  const traceryR = IW * 0.20;

  const traceryOff = document.createElement("canvas");
  traceryOff.width = W; traceryOff.height = H;
  const tOctx = traceryOff.getContext("2d");

  // Opaque dark base so the tracery fully covers the pattern underneath
  tOctx.beginPath();
  tOctx.arc(W * 0.5, traceryY, traceryR, 0, TWO_PI);
  tOctx.fillStyle = "rgb(10, 8, 14)";
  tOctx.fill();

  // Glass fill on top of the dark base
  const basePn = pickPane();
  const bj = 0.88 + Math.random() * 0.24;
  const bpr = Math.min(255, Math.round(basePn[0] * bj * 1.15));
  const bpg = Math.min(255, Math.round(basePn[1] * bj * 1.15));
  const bpb = Math.min(255, Math.round(basePn[2] * bj * 1.15));
  const baseGrad = tOctx.createRadialGradient(W * 0.5, traceryY - traceryR * 0.15, 0, W * 0.5, traceryY, traceryR);
  baseGrad.addColorStop(0, `rgba(${Math.min(255, bpr + 40)},${Math.min(255, bpg + 40)},${Math.min(255, bpb + 25)},0.55)`);
  baseGrad.addColorStop(1, `rgba(${bpr},${bpg},${bpb},0.35)`);
  tOctx.beginPath();
  tOctx.arc(W * 0.5, traceryY, traceryR, 0, TWO_PI);
  tOctx.fillStyle = baseGrad;
  tOctx.fill();

  const traceryRoll = Math.random();
  if (traceryRoll < 0.25) {
    drawBurningHeart(tOctx, W * 0.5, traceryY, traceryR);
  } else if (traceryRoll < 0.50) {
    drawTrefoil(tOctx, W * 0.5, traceryY, traceryR);
  } else if (traceryRoll < 0.75) {
    drawStar(tOctx, W * 0.5, traceryY, traceryR);
  } else {
    drawRosette(tOctx, W * 0.5, traceryY, traceryR, 8);
  }

  // Stamp the tracery on top (opaque base covers pattern underneath)
  ctx.drawImage(traceryOff, 0, 0);

  // Inner arch border — beveled stone molding
  const G = 22;
  const iL = PAD + G;
  const iR = W - PAD - G;
  const iT = PAD + G;
  const iB = H - PAD - G;
  const iSpring = ARCH_SPRING + G * 0.3;
  const iW = IW - G * 2;

  function innerArchPath() {
    ctx.beginPath();
    ctx.moveTo(iL, iB);
    ctx.lineTo(iL, iSpring);
    ctx.bezierCurveTo(
      iL + iW * 0.01, (iSpring - iT) * 0.22 + iT,
      iL + iW * 0.34, iT + IH * 0.004,
      W * 0.5, iT
    );
    ctx.bezierCurveTo(
      iL + iW * 0.66, iT + IH * 0.004,
      iL + iW * 0.99, (iSpring - iT) * 0.22 + iT,
      iR, iSpring
    );
    ctx.lineTo(iR, iB);
    ctx.closePath();
  }

  innerArchPath();
  ctx.strokeStyle = "rgba(80, 65, 45, 0.4)";
  ctx.lineWidth = 6;
  ctx.stroke();

  innerArchPath();
  ctx.strokeStyle = LEAD;
  ctx.lineWidth = 3;
  ctx.stroke();

  innerArchPath();
  ctx.strokeStyle = "rgba(160, 140, 100, 0.15)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();

  return { daylight, panes: c };
}

function leadText(ctx, str, x, y, strokeW) {
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = LEAD;
  ctx.lineWidth = strokeW;
  ctx.strokeText(str, x, y);
  ctx.fillText(str, x, y);
}

function makeFragment(v0, v1, v2, src, clipFn) {
  const xMin = Math.min(v0[0], v1[0], v2[0]);
  const xMax = Math.max(v0[0], v1[0], v2[0]);
  const yMin = Math.min(v0[1], v1[1], v2[1]);
  const yMax = Math.max(v0[1], v1[1], v2[1]);
  const box = { x: xMin, y: yMin, w: xMax - xMin, h: yMax - yMin };
  const centroid = [(v0[0]+v1[0]+v2[0])/3, (v0[1]+v1[1]+v2[1])/3];
  const c = document.createElement("canvas");
  c.width = box.w; c.height = box.h;
  c.style.position = "absolute";
  c.style.width = box.w + "px";
  c.style.height = box.h + "px";
  c.style.left = box.x + "px";
  c.style.top = box.y + "px";
  c.style.opacity = "0.7";
  const ctx = c.getContext("2d");
  ctx.translate(-box.x, -box.y);

  ctx.save();
  (clipFn || gothicPath)(ctx);
  ctx.clip();

  ctx.beginPath();
  ctx.moveTo(v0[0], v0[1]);
  ctx.lineTo(v1[0], v1[1]);
  ctx.lineTo(v2[0], v2[1]);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.drawImage(src, 0, 0);
  ctx.restore();

  // triangle outline still within the gothic clip — lead stops at the arch edge
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = LEAD;
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.restore();
  return { canvas: c, centroid, box };
}

export default function ChartWidget({
  latestPrice,
  priceChange24h,
  marketCap,
  candles,
  loading,
}) {
  const wrapperRef = useRef(null);
  const containerRef = useRef(null);
  const tickerRef = useRef(null);
  const shatteringRef = useRef(false);
  const glassBgRef = useRef(null);
  const glassIndexRef = useRef(0);
  const propsRef = useRef({});
  const viewIndexRef = useRef(0);
  const replaceFnRef = useRef(null);

  propsRef.current = { latestPrice, priceChange24h, marketCap, candles, loading };

  // shatter setup + cleanup
  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    const wrapper = wrapperRef.current;
    if (!container || !wrapper) return;

    let vertices = [], indices = [], fragments = [];
    const clickPosition = [W * 0.5, H * 0.5];
    let sweepRafId = null;
    let sweepCanvasEl = null;

    function renderTicker() {
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      c.style.position = "absolute";
      c.style.cursor = "pointer";
      const ctx = c.getContext("2d");

      // Draw the stained glass image with a backlit glass effect
      const img = glassBgRef.current;
      const clipFn = glassIndexRef.current === 2 ? roundPath : gothicPath;
      if (img.naturalWidth) {
        ctx.save();
        clipFn(ctx);
        ctx.clip();
        const isRound = glassIndexRef.current === 2;
        const fitDim = isRound ? ROUND_R * 2 : null;
        const scale = isRound
          ? Math.max(fitDim / img.naturalWidth, fitDim / img.naturalHeight)
          : Math.max(W / img.naturalWidth, H / img.naturalHeight) * 0.97;
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        const dx = isRound ? ROUND_CX - dw / 2 : (W - dw) / 2;
        const dy = isRound ? ROUND_CY - dh / 2 : (H - dh) / 2;

        // Base image at reduced opacity for translucency
        ctx.globalAlpha = 0.75;
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.globalAlpha = 1.0;

        // Screen pass to brighten — simulates light passing through glass
        ctx.globalCompositeOperation = "screen";
        ctx.globalAlpha = 0.2;
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.globalAlpha = 1.0;
        ctx.globalCompositeOperation = "source-over";

        ctx.restore();
      }

      const view = VIEWS[viewIndexRef.current];
      const props = propsRef.current;
      const eyebrowText = view.eyebrow(props);
      const mainStr = view.main(props);
      const subSpec = view.sub(props);

      ctx.textAlign = "left";
      const { glyphs, totalWidth } = measurePriceGlyphs(ctx, mainStr);
      const mainY = H * 0.58;

      // Shrink-to-fit: long values (e.g. the 4-sig-fig price 0.0₇3856) would
      // crowd the glass, so scale down when wider than the target. Short views
      // (market cap) stay at full size. Drawn around a centered origin so the
      // scale keeps the text optically centered.
      const PRICE_MAX_W = IW * 0.82;
      const fit = totalWidth > PRICE_MAX_W ? PRICE_MAX_W / totalWidth : 1;

      ctx.save();
      ctx.translate(W * 0.5, mainY);
      ctx.scale(fit, fit);

      // price text with lead outline — fill all glyphs, then stroke on top
      ctx.fillStyle = AMBER;
      for (const g of glyphs) {
        ctx.font = g.style.font;
        ctx.fillText(g.ch, -totalWidth / 2 + g.offset, 0);
      }
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = LEAD;
      for (const g of glyphs) {
        ctx.font = g.style.font;
        ctx.lineWidth = g.style.strokeW;
        ctx.strokeText(g.ch, -totalWidth / 2 + g.offset, 0);
      }
      ctx.restore();

      // eyebrow — centered, sits just below the apex where the arch is wide enough
      ctx.textAlign = "center";
      ctx.fillStyle = AMBER;
      ctx.font = "800 22px Orbitron, sans-serif";
      leadText(ctx, eyebrowText, W * 0.5, H * 0.42, 5);

      // sub (change %, label) — centered below the price
      ctx.textAlign = "center";
      ctx.fillStyle = subSpec.color;
      ctx.font = "800 22px Orbitron, sans-serif";
      leadText(ctx, subSpec.text, W * 0.5, H * 0.72, 5);

      // hint — bottom center
      ctx.textAlign = "center";
      ctx.fillStyle = AMBER;
      ctx.font = "800 13px Orbitron, sans-serif";
      leadText(ctx, "C L I C K   T O   S H A T T E R", W * 0.5, H - PAD - 50, 4);

      return c;
    }

    function placeTicker(transitionIn) {
      const c = renderTicker();
      c.addEventListener("click", clickHandler);
      container.appendChild(c);
      tickerRef.current = c;
      if (transitionIn !== false && window.TweenMax) {
        window.TweenMax.fromTo(c, 0.75, { x: -1000 }, { x: 0, ease: window.Back.easeOut });
      }
    }

    function replaceTickerInPlace() {
      if (shatteringRef.current) return;
      const old = tickerRef.current;
      if (!old) return;
      old.removeEventListener("click", clickHandler);
      container.removeChild(old);
      const c = renderTicker();
      c.addEventListener("click", clickHandler);
      container.appendChild(c);
      tickerRef.current = c;
    }
    replaceFnRef.current = replaceTickerInPlace;

    function advanceView() {
      viewIndexRef.current = (viewIndexRef.current + 1) % VIEWS.length;
    }

    function clickHandler(event) {
      if (shatteringRef.current) return;
      const c = tickerRef.current;
      if (!c) return;
      const box = c.getBoundingClientRect();
      // convert display coords (after CSS scale) to canvas design coords
      const sx = c.width / box.width;
      const sy = c.height / box.height;
      clickPosition[0] = (event.clientX - box.left) * sx;
      clickPosition[1] = (event.clientY - box.top) * sy;
      advanceView();
      resetRotateTimer();
      triangulate();
      shatter();
    }

    function autoShatter() {
      if (shatteringRef.current) return;
      if (!tickerRef.current) return;
      clickPosition[0] = W * 0.5;
      clickPosition[1] = H * 0.5;
      advanceView();
      triangulate();
      shatter();
    }

    let rotateId = null;
    function resetRotateTimer() {
      if (rotateId) clearInterval(rotateId);
      rotateId = setInterval(autoShatter, VIEW_ROTATE_MS);
    }

    function triangulate() {
      vertices = []; indices = [];
      const rings = [{r:50,c:12},{r:150,c:12},{r:300,c:12},{r:1200,c:12}];
      const cx = clickPosition[0], cy = clickPosition[1];
      vertices.push([cx, cy]);
      rings.forEach((ring) => {
        const v = ring.r * 0.25;
        for (let i = 0; i < ring.c; i++) {
          const x = Math.cos((i / ring.c) * TWO_PI) * ring.r + cx + rr(-v, v);
          const y = Math.sin((i / ring.c) * TWO_PI) * ring.r + cy + rr(-v, v);
          vertices.push([x, y]);
        }
      });
      const inset = W * 0.04;
      vertices.forEach((p) => {
        p[0] = clamp(p[0], inset, W - inset);
        p[1] = clamp(p[1], inset, H - inset);
      });
      indices = window.Delaunay.triangulate(vertices);
    }

    function shatter() {
      shatteringRef.current = true;
      if (sweepCanvasEl) sweepCanvasEl.style.opacity = "0";
      const ticker = tickerRef.current;
      const tl0 = new window.TimelineMax({ onComplete: shatterComplete });
      for (let i = 0; i < indices.length; i += 3) {
        const p0 = vertices[indices[i]], p1 = vertices[indices[i+1]], p2 = vertices[indices[i+2]];
        const shatterClip = glassIndexRef.current === 2 ? roundPath : gothicPath;
        const f = makeFragment(p0, p1, p2, ticker, shatterClip);
        const dx = f.centroid[0] - clickPosition[0];
        const dy = f.centroid[1] - clickPosition[1];
        const d = Math.sqrt(dx*dx + dy*dy);
        const rx = 30 * sgn(dy), ry = 90 * -sgn(dx);
        const delay = d * 0.003 * rr(0.9, 1.1);
        f.canvas.style.zIndex = Math.floor(d).toString();
        const tl1 = new window.TimelineMax();
        tl1.to(f.canvas, 1, { z: -500, rotationX: rx, rotationY: ry, ease: window.Cubic.easeIn });
        tl1.to(f.canvas, 0.4, { alpha: 0 }, 0.6);
        tl0.insert(tl1, delay);
        fragments.push(f);
        container.appendChild(f.canvas);
      }
      container.removeChild(ticker);
      ticker.removeEventListener("click", clickHandler);
      tickerRef.current = null;
    }

    function shatterComplete() {
      fragments.forEach((f) => {
        if (f.canvas.parentNode === container) container.removeChild(f.canvas);
      });
      fragments = []; vertices = []; indices = [];
      shatteringRef.current = false;
      if (!cancelled) {
        glassIndex = (glassIndex + 1) % glassImages.length;
        glassIndexRef.current = glassIndex;
        glassBgRef.current = glassImages[glassIndex];
        placeTicker(true);
        if (sweepCanvasEl) sweepCanvasEl.style.opacity = "1";
      }
    }

    // size the scaled stage to match the wrapper's current width
    function applyScale() {
      const rect = wrapper.getBoundingClientRect();
      const s = rect.width / W;
      container.style.transform = `scale(${s})`;
    }
    applyScale();
    const ro = new ResizeObserver(applyScale);
    ro.observe(wrapper);

    const GLASS_SRCS = ["/images/SG_GR80.webp", "/images/SG_Crusader.webp", "/images/SG_Round.webp"];
    const glassImages = GLASS_SRCS.map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });
    let glassIndex = 0;
    glassIndexRef.current = 0;

    Promise.all([
      loadScript(DELAUNAY_SRC),
      loadScript(GSAP_SRC),
      ...glassImages.map((img) => new Promise((r) => { img.onload = r; img.onerror = r; })),
    ])
      .then(() => {
        if (cancelled) return;
        window.TweenMax.set(container, { perspective: 500 });
        glassBgRef.current = glassImages[glassIndex];
        placeTicker(false);
        resetRotateTimer();

        // Light sweep — drifting highlight behind the glass
        const sweepCanvas = document.createElement("canvas");
        sweepCanvas.width = W;
        sweepCanvas.height = H;
        sweepCanvas.style.position = "absolute";
        sweepCanvas.style.left = "0";
        sweepCanvas.style.top = "0";
        sweepCanvas.style.pointerEvents = "none";
        sweepCanvas.style.transition = "opacity 0.3s ease";
        container.insertBefore(sweepCanvas, container.firstChild);
        sweepCanvasEl = sweepCanvas;
        let sweepPhase = Math.random() * TWO_PI;
        function animateSweep() {
          if (cancelled) return;
          const sctx = sweepCanvas.getContext("2d");
          sctx.clearRect(0, 0, W, H);
          sctx.save();
          (glassIndexRef.current === 2 ? roundPath : gothicPath)(sctx);
          sctx.clip();
          const bandX = W * 0.5 + Math.sin(sweepPhase) * W * 0.6;
          const bandY = H * 0.3 + Math.cos(sweepPhase * 0.7) * H * 0.15;
          const grad = sctx.createRadialGradient(bandX, bandY, 0, bandX, bandY, W * 0.5);
          grad.addColorStop(0, "rgba(255,250,230,0.10)");
          grad.addColorStop(0.4, "rgba(255,248,225,0.05)");
          grad.addColorStop(0.7, "rgba(255,245,215,0.02)");
          grad.addColorStop(1, "rgba(255,240,200,0)");
          sctx.fillStyle = grad;
          sctx.fillRect(0, 0, W, H);
          sctx.restore();
          sweepPhase += 0.003;
          sweepRafId = requestAnimationFrame(animateSweep);
        }
        sweepRafId = requestAnimationFrame(animateSweep);
      })
      .catch((err) => console.error("[ChartWidget]", err));

    return () => {
      cancelled = true;
      replaceFnRef.current = null;
      ro.disconnect();
      if (rotateId) clearInterval(rotateId);
      if (sweepRafId) cancelAnimationFrame(sweepRafId);
      while (container.firstChild) container.removeChild(container.firstChild);
      shatteringRef.current = false;
      tickerRef.current = null;
    };
  }, []);

  // re-render ticker in place when props change (candles intentionally excluded —
  // array ref changes on every snapshot, would re-render constantly; the auto-rotate
  // tick picks up fresh volume from propsRef each cycle)
  useEffect(() => {
    replaceFnRef.current?.();
  }, [latestPrice, priceChange24h, marketCap, loading]);

  return (
    <div ref={wrapperRef} className="chart-widget">
      <div
        ref={containerRef}
        className="chart-widget__stage"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: W,
          height: H,
          transformOrigin: "top left",
          pointerEvents: "auto",
        }}
      />
    </div>
  );
}
