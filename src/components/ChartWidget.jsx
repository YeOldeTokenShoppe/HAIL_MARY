"use client";

import { useEffect, useRef } from "react";

// Gothic lancet — portrait canvas with a pointed-arch outline.
// PAD reserves space so the outer stroke isn't clipped at edges.
const PAD = 10;
const IW = 480;
const IH = 660;
const W = IW + PAD * 2;
const H = IH + PAD * 2;
const ARCH_SPRING = IH * 0.46 + PAD;
const TWO_PI = Math.PI * 2;

function gothicPath(ctx) {
  ctx.beginPath();
  ctx.moveTo(PAD, H - PAD);
  ctx.lineTo(PAD, ARCH_SPRING);
  ctx.bezierCurveTo(
    PAD + IW * 0.01, (ARCH_SPRING - PAD) * 0.20 + PAD,
    PAD + IW * 0.34, IH * 0.004 + PAD,
    W * 0.5, PAD
  );
  ctx.bezierCurveTo(
    PAD + IW * 0.66, IH * 0.004 + PAD,
    PAD + IW * 0.99, (ARCH_SPRING - PAD) * 0.20 + PAD,
    W - PAD, ARCH_SPRING
  );
  ctx.lineTo(W - PAD, H - PAD);
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
  // round to 3 significant digits — Math.round handles carry (e.g. 0.0₇999 → 0.0₆100)
  const SIG = 3;
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
  if (a >= 1e9) return `$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(a / 1e3).toFixed(1)}K`;
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
    sub: () => ({ text: "F U L L Y   D I L U T E D", color: AMBER }),
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

function buildGlass() {
  // daylight backdrop — subtle warm tint, mostly transparent so the dark
  // page behind bleeds through the panes like real backlit stained glass
  const daylight = document.createElement("canvas");
  daylight.width = W; daylight.height = H;
  const dctx = daylight.getContext("2d");
  dctx.save();
  gothicPath(dctx);
  dctx.clip();
  const back = dctx.createLinearGradient(0, 0, 0, H);
  back.addColorStop(0, "rgba(255, 244, 216, 0.12)");
  back.addColorStop(1, "rgba(247, 228, 184, 0.06)");
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

  // helper: fill a rect pane with color + crystalline highlight + lead came
  function fillPane(ctx, x, y, w, h) {
    const pane = pickPane();
    const jitter = 0.88 + Math.random() * 0.24;
    const pr = Math.min(255, Math.round(pane[0] * jitter * 1.15));
    const pg = Math.min(255, Math.round(pane[1] * jitter * 1.15));
    const pb = Math.min(255, Math.round(pane[2] * jitter * 1.15));

    ctx.fillStyle = `rgba(${pr},${pg},${pb},0.45)`;
    ctx.fillRect(x, y, w, h);

    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = "rgba(40, 30, 20, 0.25)";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();

    ctx.strokeStyle = LEAD;
    ctx.lineWidth = 5;
    ctx.strokeRect(x, y, w, h);
  }

  // helper: fill a diamond pane with color + crystalline highlight + lead came
  function fillDiamond(ctx, cx, cy, halfDW, halfDH) {
    const pane = pickPane();
    const jitter = 0.88 + Math.random() * 0.24;
    const pr = Math.min(255, Math.round(pane[0] * jitter * 1.15));
    const pg = Math.min(255, Math.round(pane[1] * jitter * 1.15));
    const pb = Math.min(255, Math.round(pane[2] * jitter * 1.15));

    ctx.beginPath();
    ctx.moveTo(cx, cy - halfDH);
    ctx.lineTo(cx + halfDW, cy);
    ctx.lineTo(cx, cy + halfDH);
    ctx.lineTo(cx - halfDW, cy);
    ctx.closePath();
    ctx.fillStyle = `rgba(${pr},${pg},${pb},0.45)`;
    ctx.fill();


    ctx.beginPath();
    ctx.moveTo(cx, cy - halfDH);
    ctx.lineTo(cx + halfDW, cy);
    ctx.lineTo(cx, cy + halfDH);
    ctx.lineTo(cx - halfDW, cy);
    ctx.closePath();

    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = "rgba(40, 30, 20, 0.25)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

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
    // Rectangular grid — mullions + transoms
    const cols = 3, rows = 5;
    const pw = IW / cols, ph = IH / rows;
    for (let r = 0; r < rows; r++) {
      for (let cc = 0; cc < cols; cc++) {
        fillPane(ctx, PAD + cc * pw, PAD + r * ph, pw, ph);
      }
    }
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
    for (let n = 0; n < lancets; n++) {
      const lx = PAD + n * (lw + gap);
      const lcx = lx + lw / 2;
      const pane = pickPane();
      const jitter = 0.88 + Math.random() * 0.24;
      const pr = Math.min(255, Math.round(pane[0] * jitter));
      const pg = Math.min(255, Math.round(pane[1] * jitter));
      const pb = Math.min(255, Math.round(pane[2] * jitter));

      // lancet path
      ctx.beginPath();
      ctx.moveTo(lx, H - PAD);
      ctx.lineTo(lx, lSpring);
      ctx.bezierCurveTo(
        lx + lw * 0.02, lSpring * 0.35,
        lx + lw * 0.30, PAD + IH * 0.06,
        lcx, PAD + IH * 0.03
      );
      ctx.bezierCurveTo(
        lx + lw * 0.70, PAD + IH * 0.06,
        lx + lw * 0.98, lSpring * 0.35,
        lx + lw, lSpring
      );
      ctx.lineTo(lx + lw, H - PAD);
      ctx.closePath();

      ctx.fillStyle = `rgba(${pr},${pg},${pb},0.55)`;
      ctx.fill();

      // highlight
      ctx.save();
      ctx.clip();
      const glow = ctx.createRadialGradient(lcx, lSpring * 0.6, 0, lcx, H * 0.5, lw);
      glow.addColorStop(0, `rgba(${Math.min(255, pr + 80)},${Math.min(255, pg + 80)},${Math.min(255, pb + 60)},0.35)`);
      glow.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(lx, PAD, lw, IH);
      ctx.restore();

      // re-trace for lead stroke
      ctx.beginPath();
      ctx.moveTo(lx, H - PAD);
      ctx.lineTo(lx, lSpring);
      ctx.bezierCurveTo(
        lx + lw * 0.02, lSpring * 0.35,
        lx + lw * 0.30, PAD + IH * 0.06,
        lcx, PAD + IH * 0.03
      );
      ctx.bezierCurveTo(
        lx + lw * 0.70, PAD + IH * 0.06,
        lx + lw * 0.98, lSpring * 0.35,
        lx + lw, lSpring
      );
      ctx.lineTo(lx + lw, H - PAD);
      ctx.closePath();

      ctx.strokeStyle = LEAD;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
  }


  // Inner arch border — uniformly inset from the outer gothic path
  const G = 22;
  const iL = PAD + G;
  const iR = W - PAD - G;
  const iT = PAD + G;
  const iB = H - PAD - G;
  const iSpring = ARCH_SPRING + G * 0.3;
  const iW = IW - G * 2;
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
  ctx.strokeStyle = LEAD;
  ctx.lineWidth = 3;
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

function makeFragment(v0, v1, v2, src) {
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

  // outer gothic clip — corner shards that fall outside the lancet stay invisible
  ctx.save();
  gothicPath(ctx);
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

    function renderTicker() {
      const c = document.createElement("canvas");
      c.width = W; c.height = H;
      c.style.position = "absolute";
      c.style.cursor = "pointer";
      const ctx = c.getContext("2d");

      ctx.drawImage(glassBgRef.current.daylight, 0, 0);

      const view = VIEWS[viewIndexRef.current];
      const props = propsRef.current;
      const eyebrowText = view.eyebrow(props);
      const mainStr = view.main(props);
      const subSpec = view.sub(props);

      // cut the main value out of a clone of the pane layer
      const panesLayer = document.createElement("canvas");
      panesLayer.width = W; panesLayer.height = H;
      const pctx = panesLayer.getContext("2d");
      pctx.drawImage(glassBgRef.current.panes, 0, 0);

      pctx.textAlign = "left";
      const { glyphs, totalWidth } = measurePriceGlyphs(pctx, mainStr);
      const mainX = (W - totalWidth) / 2;
      const mainY = H * 0.58;

      pctx.globalCompositeOperation = "destination-out";
      for (const g of glyphs) {
        pctx.font = g.style.font;
        pctx.fillText(g.ch, mainX + g.offset, mainY);
      }
      pctx.globalCompositeOperation = "source-over";

      ctx.drawImage(panesLayer, 0, 0);

      // fill the cutout with white so the price is legible over the dark page
      ctx.textAlign = "left";
      ctx.fillStyle = AMBER;
      for (const g of glyphs) {
        ctx.font = g.style.font;
        ctx.fillText(g.ch, mainX + g.offset, mainY);
      }

      // lead came around each glyph
      ctx.textAlign = "left";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeStyle = LEAD;
      for (const g of glyphs) {
        ctx.font = g.style.font;
        ctx.lineWidth = g.style.strokeW;
        ctx.strokeText(g.ch, mainX + g.offset, mainY);
      }

      // outer lead frame — gothic outline instead of strokeRect
      gothicPath(ctx);
      ctx.strokeStyle = LEAD;
      ctx.lineWidth = 12;
      ctx.stroke();

      // eyebrow — centered, sits just below the apex where the arch is wide enough
      ctx.textAlign = "center";
      ctx.fillStyle = AMBER;
      ctx.font = "800 22px Orbitron, sans-serif";
      leadText(ctx, eyebrowText, W * 0.5, H * 0.30, 5);

      // sub (change %, label) — centered below the price
      ctx.textAlign = "center";
      ctx.fillStyle = subSpec.color;
      ctx.font = "800 22px Orbitron, sans-serif";
      leadText(ctx, subSpec.text, W * 0.5, H * 0.72, 5);

      // hint — bottom center
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(80, 50, 20, 0.7)";
      ctx.font = "800 10px Orbitron, sans-serif";
      leadText(ctx, "C L I C K   T O   S H A T T E R", W * 0.5, H - PAD - 50, 3);

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
      vertices.forEach((p) => {
        p[0] = clamp(p[0], 0, W);
        p[1] = clamp(p[1], 0, H);
      });
      indices = window.Delaunay.triangulate(vertices);
    }

    function shatter() {
      shatteringRef.current = true;
      const ticker = tickerRef.current;
      const tl0 = new window.TimelineMax({ onComplete: shatterComplete });
      for (let i = 0; i < indices.length; i += 3) {
        const p0 = vertices[indices[i]], p1 = vertices[indices[i+1]], p2 = vertices[indices[i+2]];
        const f = makeFragment(p0, p1, p2, ticker);
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
        glassBgRef.current = buildGlass();
        placeTicker(true);
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

    Promise.all([loadScript(DELAUNAY_SRC), loadScript(GSAP_SRC)])
      .then(() => {
        if (cancelled) return;
        window.TweenMax.set(container, { perspective: 500 });
        glassBgRef.current = buildGlass();
        placeTicker(false);
        resetRotateTimer();
      })
      .catch((err) => console.error("[ChartWidget]", err));

    return () => {
      cancelled = true;
      replaceFnRef.current = null;
      ro.disconnect();
      if (rotateId) clearInterval(rotateId);
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
