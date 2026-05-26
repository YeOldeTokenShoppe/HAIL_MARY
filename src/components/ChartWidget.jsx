"use client";

import { useEffect, useRef } from "react";

const W = 768;
const H = 485;
const TWO_PI = Math.PI * 2;

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
const PRICE_FONT_MAIN = "900 168px Orbitron, sans-serif";
const PRICE_FONT_SYMBOL = "900 110px Orbitron, sans-serif";

function glyphStyle(ch) {
  if (ch === "$") return { font: PRICE_FONT_SYMBOL, strokeW: 8 };
  if (SUB_SET.has(ch)) return { font: PRICE_FONT_MAIN, strokeW: 6 };
  return { font: PRICE_FONT_MAIN, strokeW: 11 };
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
        color: up ? "#efffb7" : "#ffd7e6",
      };
    },
  },
  {
    id: "volume",
    eyebrow: () => "V O L U M E   2 4 H",
    main: (p) => formatMoney(sumVolume(p.candles)),
    sub: () => ({ text: "R L 8 0   T R A D E D", color: AMBER }),
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
  // daylight backdrop
  const daylight = document.createElement("canvas");
  daylight.width = W; daylight.height = H;
  const dctx = daylight.getContext("2d");
  const back = dctx.createLinearGradient(0, 0, 0, H);
  back.addColorStop(0, "#fff4d8");
  back.addColorStop(1, "#f7e4b8");
  dctx.fillStyle = back;
  dctx.fillRect(0, 0, W, H);

  // pane layer
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  const pts = [
    [0, 0], [W, 0], [W, H], [0, H],
    [W * 0.36, 0], [W * 0.70, 0],
    [W * 0.30, H], [W * 0.66, H],
    [0, H * 0.52], [W, H * 0.48],
    [W * 0.28, H * 0.34],
    [W * 0.62, H * 0.30],
    [W * 0.46, H * 0.62],
    [W * 0.78, H * 0.66],
  ];

  const idx = window.Delaunay.triangulate(pts);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  for (let k = 0; k < idx.length; k += 3) {
    const a = pts[idx[k]], b = pts[idx[k+1]], d = pts[idx[k+2]];
    const pane = pickPane();
    const jitter = 0.88 + Math.random() * 0.24;
    const pr = Math.min(255, Math.round(pane[0] * jitter));
    const pg = Math.min(255, Math.round(pane[1] * jitter));
    const pb = Math.min(255, Math.round(pane[2] * jitter));

    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.closePath();
    ctx.fillStyle = `rgba(${pr},${pg},${pb},0.85)`;
    ctx.fill();

    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = "rgba(40, 30, 20, 0.25)";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = LEAD;
    ctx.lineWidth = 9;
    ctx.stroke();
  }

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
  ctx.beginPath();
  ctx.moveTo(v0[0], v0[1]);
  ctx.lineTo(v1[0], v1[1]);
  ctx.lineTo(v2[0], v2[1]);
  ctx.closePath();
  ctx.save();
  ctx.clip();
  ctx.drawImage(src, 0, 0);
  ctx.restore();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = LEAD;
  ctx.lineWidth = 5;
  ctx.stroke();
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
      const mainY = 290;

      pctx.globalCompositeOperation = "destination-out";
      for (const g of glyphs) {
        pctx.font = g.style.font;
        pctx.fillText(g.ch, mainX + g.offset, mainY);
      }
      pctx.globalCompositeOperation = "source-over";

      ctx.drawImage(panesLayer, 0, 0);

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

      // outer lead frame
      ctx.strokeStyle = LEAD;
      ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, W - 14, H - 14);

      // eyebrow
      ctx.fillStyle = AMBER;
      ctx.font = "800 24px Orbitron, sans-serif";
      leadText(ctx, eyebrowText, 50, 90, 6);

      // sub (change %, label, etc.)
      ctx.fillStyle = subSpec.color;
      ctx.font = "800 30px Orbitron, sans-serif";
      leadText(ctx, subSpec.text, 50, 360, 7);

      // hint
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(80, 50, 20, 0.7)";
      ctx.font = "800 11px Orbitron, sans-serif";
      leadText(ctx, "C L I C K   T O   S H A T T E R", W - 30, H - 28, 3);

      return c;
    }

    function placeTicker(transitionIn) {
      const c = renderTicker();
      c.addEventListener("click", clickHandler);
      container.appendChild(c);
      tickerRef.current = c;
      if (transitionIn !== false && window.TweenMax) {
        window.TweenMax.fromTo(c, 0.75, { y: -1000 }, { y: 0, ease: window.Back.easeOut });
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
      if (!cancelled) placeTicker(true);
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
