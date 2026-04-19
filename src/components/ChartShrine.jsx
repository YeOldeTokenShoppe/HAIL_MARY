"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

const PALETTES = {
  classic: {
    bgStops: ["#0f0608", "#120307", "#0a0204"],
    bgOpacity: 1,
    bgTint: "#2a0c10",
    bgTintOpacity: 0.12,
    waxUpStops: ["#6ba585", "#4d8b6e", "#315a48"],
    waxDownStops: ["#c86a56", "#b04e3d", "#7a2e22"],
    wickUp: "#cfe4d5",
    wickDown: "#f3c2b4",
    strokeUp: "#2f5c48",
    strokeDown: "#6e2a1f",
    flameUpStops: ["#fff4c2", "#ffc36a", "#ff8a3a"],
    flameDownStops: ["#fff4c2", "#ffc36a", "#ff8a3a"],
    flameInner: "#fff4c2",
    flameTip: "#ffd96b",
    haloStops: [
      { offset: "0%", color: "#ffe5a0", opacity: 0.65 },
      { offset: "45%", color: "#ffb347", opacity: 0.25 },
      { offset: "100%", color: "#ffb347", opacity: 0 },
    ],
    frameStops: ["#c9a35a", "#f1d77a", "#9a7a35", "#d6b762"],
    accent: "#f1d77a",
    accentSoft: "#a89970",
    accentDark: "#4a3a2a",
    priceUpColor: "#8ec89e",
    priceDownColor: "#d07764",
    cartoucheFill: "#1a0f12",
    cartoucheText: "#e9d48d",
    rosetteCenter: "#3a2a10",
    wickStub: "#1e140a",
  },
  neon: {
    bgStops: ["#04080f", "#020509", "#000000"],
    bgOpacity: 1,
    bgTint: "#0a1a2a",
    bgTintOpacity: 0,
    waxUpStops: ["#8ef9ff", "#2ad6ee", "#0a6b88"],
    waxDownStops: ["#ff7de0", "#d92db0", "#6a0e52"],
    wickUp: "#d6faff",
    wickDown: "#ffc6ef",
    strokeUp: "#0a5a70",
    strokeDown: "#5a1245",
    flameUpStops: ["#ffffff", "#9ff0ff", "#2ad6ee"],
    flameDownStops: ["#ffffff", "#ffb0e8", "#d92db0"],
    flameInner: "#ffffff",
    flameTip: "#c6f7ff",
    haloStops: [
      { offset: "0%", color: "#d6faff", opacity: 0.7 },
      { offset: "45%", color: "#2ad6ee", opacity: 0.3 },
      { offset: "100%", color: "#2ad6ee", opacity: 0 },
    ],
    frameStops: ["#2ad6ee", "#d6faff", "#d92db0", "#ff7de0"],
    accent: "#d6faff",
    accentSoft: "#6fa8c4",
    accentDark: "#1a3a4a",
    priceUpColor: "#6ff1ff",
    priceDownColor: "#ff5dd6",
    cartoucheFill: "#060a12",
    cartoucheText: "#d6faff",
    rosetteCenter: "#050a14",
    wickStub: "#060a12",
  },
  chrome: {
    // classic wax / wicks / flames / smoke — only chrome (frame, text, grid, bg) is neon
    bgStops: ["#04080f", "#020509", "#000000"],
    bgOpacity: 0.65,
    bgTint: "#0a1a2a",
    bgTintOpacity: 0,
    waxUpStops: ["#6ba585", "#4d8b6e", "#315a48"],
    waxDownStops: ["#c86a56", "#b04e3d", "#7a2e22"],
    wickUp: "#cfe4d5",
    wickDown: "#f3c2b4",
    strokeUp: "#2f5c48",
    strokeDown: "#6e2a1f",
    flameUpStops: ["#fff4c2", "#ffc36a", "#ff8a3a"],
    flameDownStops: ["#fff4c2", "#ffc36a", "#ff8a3a"],
    flameInner: "#fff4c2",
    flameTip: "#ffd96b",
    haloStops: [
      { offset: "0%", color: "#ffe5a0", opacity: 0.65 },
      { offset: "45%", color: "#ffb347", opacity: 0.25 },
      { offset: "100%", color: "#ffb347", opacity: 0 },
    ],
    frameStops: ["#2ad6ee", "#d6faff", "#d92db0", "#ff7de0"],
    accent: "#d6faff",
    accentSoft: "#6fa8c4",
    accentDark: "#1a3a4a",
    priceUpColor: "#8ec89e",
    priceDownColor: "#d07764",
    cartoucheFill: "#060a12",
    cartoucheText: "#d6faff",
    rosetteCenter: "#050a14",
    wickStub: "#1e140a",
  },
};

function formatTimestamp(timeSec) {
  if (!timeSec) return "";
  const d = new Date(timeSec * 1000);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeframe(tf) {
  if (!tf) return "—";
  const m = String(tf).match(/^(\d+)\s*([a-zA-Z]+)$/);
  if (!m) return tf;
  const [, n, unit] = m;
  const u = unit.toLowerCase();
  const label =
    u === "m" ? "Min" : u === "h" ? "Hour" : u === "d" ? "Day" : unit;
  return `${n} ${label}`;
}

const DIMS_DESKTOP = {
  VIEW_W: 1200,
  VIEW_H: 700,
  FRAME_PAD: 40,
  CHART_PAD_TOP: 90,
  CHART_PAD_BOTTOM: 110,
  CHART_PAD_LEFT: 70,
  CHART_PAD_RIGHT: 110,
  candleCount: 18,
  titleFont: 28,
  subtitleFont: 16,
  priceFont: 28,
  changeFont: 16,
  axisFont: 18,
};

const DIMS_MOBILE = {
  VIEW_W: 600,
  VIEW_H: 720,
  FRAME_PAD: 26,
  CHART_PAD_TOP: 160,
  CHART_PAD_BOTTOM: 110,
  CHART_PAD_LEFT: 38,
  CHART_PAD_RIGHT: 110,
  candleCount: 12,
  titleFont: 32,
  subtitleFont: 20,
  priceFont: 36,
  changeFont: 20,
  axisFont: 19,
};

// `aggregate` multiplies the native CG granularity: days=14 returns 4h candles,
// so aggregate=6 buckets them into 1d candles. `key` disambiguates options
// that share the same `days` (4 Hour vs 1 Day both use days=14).
export const TIMEFRAME_OPTIONS = [
  { key: "30m", days: 1, aggregate: 1, label: "30 Min" },
  { key: "4h", days: 14, aggregate: 1, label: "4 Hour" },
  { key: "1d", days: 14, aggregate: 6, label: "1 Day" },
];

const SUB_DIGITS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
const toSubscript = (n) =>
  String(n)
    .split("")
    .map((d) => SUB_DIGITS[+d])
    .join("");

// Crypto-style compact notation for sub-cent prices: the subscript counts
// leading zeros after the decimal, e.g. 0.00000003352 → $0.0₇3352.
function formatPrice(p) {
  if (p == null || !Number.isFinite(p)) return "—";
  if (p >= 1) return `$${p.toFixed(4)}`;
  if (p >= 0.001) return `$${p.toFixed(5)}`;
  if (p <= 0) return `$${p.toFixed(4)}`;

  const frac = p.toFixed(20).split(".")[1];
  let zeros = 0;
  while (zeros < frac.length && frac[zeros] === "0") zeros++;
  const sig = frac.slice(zeros, zeros + 4).replace(/0+$/, "") || "0";
  return `$0.0${toSubscript(zeros)}${sig}`;
}

function formatMarketCap(v) {
  if (v == null || !Number.isFinite(v) || v <= 0) return "—";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}

function niceTicks(min, max, count = 5) {
  if (!(max > min)) return [min];
  const step = (max - min) / (count - 1);
  const ticks = [];
  for (let i = 0; i < count; i++) ticks.push(min + step * i);
  return ticks;
}

function Candle({
  candle,
  x,
  width,
  slot,
  priceRange,
  volatility,
  isLatest,
  isHovered,
  onHover,
  index,
  p,
}) {
  const { open, high, low, close } = candle;
  const isGreen = close >= open;
  const relMove =
    open > 0 ? Math.abs(close - open) / open : 0;

  const { chartTop, chartBottom, priceMin, priceMax } = priceRange;
  const span = priceMax - priceMin || 1;
  const mapY = (p) =>
    chartTop + ((priceMax - p) / span) * (chartBottom - chartTop);

  const wickTop = mapY(high);
  const wickBottom = mapY(low);
  const bodyTop = mapY(Math.max(open, close));
  const bodyBottom = mapY(Math.min(open, close));
  const bodyHeight = Math.max(bodyBottom - bodyTop, 3);
  const cx = x + width / 2;

  const bodyFill = isGreen ? "url(#waxGreen)" : "url(#waxRedHatch)";
  const bodyStroke = isGreen ? p.strokeUp : p.strokeDown;
  const flameGradId = isGreen ? "flameOuterUp" : "flameOuterDown";

  const flameScale = isGreen
    ? 1 + Math.min(relMove * 25, 1.2)
    : 0.55 + Math.min(relMove * 12, 0.4);
  const flameH = 20 * flameScale;
  const wickStubH = 5;
  const flameBottom = bodyTop - wickStubH;
  const flameTop = flameBottom - flameH;

  // volatility is tiny (stddev of returns, usually 0.002–0.02); scale gently
  const flickerAmp = Math.max(
    0.15,
    Math.min(0.15 + volatility * 15, 0.85),
  );
  const flickerDur = (1.8 + (index % 7) * 0.23).toFixed(2);
  const flickerDelay = ((index * 0.31) % 1.5).toFixed(2);

  const emphasize = isHovered;

  return (
    <g
      onPointerEnter={() => onHover?.(index)}
      onPointerLeave={() => onHover?.(null)}
      onPointerDown={() => onHover?.(index)}
      style={{ cursor: "pointer" }}
    >
      {/* invisible hitbox over the whole slot for easier targeting */}
      <rect
        x={x + width / 2 - slot / 2}
        y={priceRange.chartTop}
        width={slot}
        height={priceRange.chartBottom - priceRange.chartTop}
        fill="transparent"
        pointerEvents="all"
      />
      {/* OHLC wick — high to low */}
      <line
        x1={cx}
        x2={cx}
        y1={wickTop}
        y2={wickBottom}
        stroke={isGreen ? p.wickUp : p.wickDown}
        strokeWidth="1.6"
        opacity="0.9"
        strokeLinecap="round"
      />

      {/* wax body */}
      <rect
        x={x}
        y={bodyTop}
        width={width}
        height={bodyHeight}
        fill={bodyFill}
        stroke={emphasize ? p.accent : bodyStroke}
        strokeWidth={emphasize ? 1.4 : 0.6}
        rx="1.5"
      />
      {/* wax highlight */}
      <rect
        x={x + 1.5}
        y={bodyTop + 1}
        width={Math.max(width * 0.2, 2)}
        height={bodyHeight - 2}
        fill="rgba(255,255,255,0.08)"
        rx="1"
      />

      {/* wick stub above body */}
      <line
        x1={cx}
        x2={cx}
        y1={bodyTop}
        y2={flameBottom}
        stroke={p.wickStub}
        strokeWidth="1.4"
      />

      {/* halo on latest or hovered */}
      {(isLatest || emphasize) && (
        <circle
          cx={cx}
          cy={flameTop + flameH * 0.55}
          r={flameH * (emphasize ? 1.9 : 1.6)}
          fill="url(#haloGrad)"
          className={isLatest && !emphasize ? "shrine-halo" : ""}
        />
      )}

      {/* flame */}
      <g
        className="shrine-flame"
        style={{
          transformOrigin: `${cx}px ${flameBottom}px`,
          transformBox: "fill-box",
          animationDuration: `${flickerDur}s`,
          animationDelay: `${flickerDelay}s`,
          "--flicker-amp": flickerAmp,
        }}
      >
        {/* outer */}
        <ellipse
          cx={cx}
          cy={flameTop + flameH * 0.55}
          rx={flameH * 0.28}
          ry={flameH * 0.55}
          fill={`url(#${flameGradId})`}
          opacity={isGreen ? 0.95 : 0.75}
        />
        {/* inner pale */}
        <ellipse
          cx={cx}
          cy={flameTop + flameH * 0.7}
          rx={flameH * 0.13}
          ry={flameH * 0.38}
          fill={p.flameInner}
          opacity={isGreen ? 0.9 : 0.7}
        />
        {/* tip */}
        <ellipse
          cx={cx}
          cy={flameTop + flameH * 0.22}
          rx={flameH * 0.08}
          ry={flameH * 0.15}
          fill={p.flameTip}
          opacity="0.85"
        />
      </g>

    </g>
  );
}

export default function ChartShrine({
  candles,
  latestPrice,
  priceChange24h,
  marketCap,
  volatility,
  timeframe,
  updatedAt,
  loading,
  error,
  palette = "classic",
  timeframeKey,
  onTimeframeChange,
}) {
  const p = PALETTES[palette] || PALETTES.classic;
  const [hoverIdx, setHoverIdx] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  // Track the SVG's rendered pixel box so the HTML tooltip can be positioned
  // in absolute pixels (honoring the xMidYMid meet letterbox) instead of
  // viewBox-percent, which drifts when the aspect ratio doesn't match.
  const svgRef = useRef(null);
  const [svgBox, setSvgBox] = useState(null);

  useEffect(() => {
    if (!svgRef.current) return;
    const update = () => {
      const r = svgRef.current.getBoundingClientRect();
      setSvgBox({ width: r.width, height: r.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(svgRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 700px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const dims = isMobile ? DIMS_MOBILE : DIMS_DESKTOP;
  const {
    VIEW_W,
    VIEW_H,
    FRAME_PAD,
    CHART_PAD_TOP,
    CHART_PAD_BOTTOM,
    CHART_PAD_LEFT,
    CHART_PAD_RIGHT,
  } = dims;

  const displayCandles = useMemo(
    () => candles.slice(-dims.candleCount),
    [candles, dims.candleCount]
  );

  const priceRange = useMemo(() => {
    if (!displayCandles.length) {
      return {
        chartTop: CHART_PAD_TOP,
        chartBottom: VIEW_H - CHART_PAD_BOTTOM,
        priceMin: 0,
        priceMax: 1,
      };
    }
    let min = Infinity;
    let max = -Infinity;
    for (const c of displayCandles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    }
    const pad = (max - min) * 0.15 || max * 0.05 || 1;
    return {
      chartTop: CHART_PAD_TOP,
      chartBottom: VIEW_H - CHART_PAD_BOTTOM,
      priceMin: min - pad,
      priceMax: max + pad,
    };
  }, [displayCandles, CHART_PAD_TOP, CHART_PAD_BOTTOM, VIEW_H]);

  const ticks = useMemo(
    () => niceTicks(priceRange.priceMin, priceRange.priceMax, 5),
    [priceRange]
  );

  const chartLeft = CHART_PAD_LEFT;
  const chartRight = VIEW_W - CHART_PAD_RIGHT;
  const chartWidth = chartRight - chartLeft;
  const slot = chartWidth / Math.max(displayCandles.length, 1);
  const candleWidth = Math.min(slot * 0.6, 32);

  const priceUp = priceChange24h >= 0;
  const priceColor = priceUp ? p.priceUpColor : p.priceDownColor;
  const arrow = priceUp ? "▲" : "▼";

  const activeTimeframeLabel =
    TIMEFRAME_OPTIONS.find((o) => o.key === timeframeKey)?.label ||
    formatTimeframe(timeframe);

  return (
    <div className="shrine-wrap">
      <svg
        ref={svgRef}
        className="shrine-svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.bgStops[0]} />
            <stop offset="60%" stopColor={p.bgStops[1]} />
            <stop offset="100%" stopColor={p.bgStops[2]} />
          </linearGradient>

          <linearGradient id="waxGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.waxUpStops[0]} />
            <stop offset="50%" stopColor={p.waxUpStops[1]} />
            <stop offset="100%" stopColor={p.waxUpStops[2]} />
          </linearGradient>

          <linearGradient id="waxRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.waxDownStops[0]} />
            <stop offset="50%" stopColor={p.waxDownStops[1]} />
            <stop offset="100%" stopColor={p.waxDownStops[2]} />
          </linearGradient>

          {/* Diagonal hatch over the red gradient — secondary encoding so
              losses stay distinguishable from gains under red-green color
              deficiency. Bloomberg uses the same pattern on down candles. */}
          <pattern
            id="waxRedHatch"
            patternUnits="userSpaceOnUse"
            width="4"
            height="4"
            patternTransform="rotate(45)"
          >
            <rect width="4" height="4" fill="url(#waxRed)" />
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="4"
              stroke="rgba(0,0,0,0.18)"
              strokeWidth="1"
            />
          </pattern>

          <radialGradient id="flameOuterUp" cx="0.5" cy="0.7" r="0.6">
            <stop offset="0%" stopColor={p.flameUpStops[0]} />
            <stop offset="35%" stopColor={p.flameUpStops[1]} />
            <stop offset="75%" stopColor={p.flameUpStops[2]} />
            <stop offset="100%" stopColor={p.flameUpStops[2]} stopOpacity="0" />
          </radialGradient>

          <radialGradient id="flameOuterDown" cx="0.5" cy="0.7" r="0.6">
            <stop offset="0%" stopColor={p.flameDownStops[0]} />
            <stop offset="35%" stopColor={p.flameDownStops[1]} />
            <stop offset="75%" stopColor={p.flameDownStops[2]} />
            <stop offset="100%" stopColor={p.flameDownStops[2]} stopOpacity="0" />
          </radialGradient>

          <radialGradient id="haloGrad" cx="0.5" cy="0.5" r="0.5">
            {p.haloStops.map((s, i) => (
              <stop
                key={i}
                offset={s.offset}
                stopColor={s.color}
                stopOpacity={s.opacity}
              />
            ))}
          </radialGradient>

          <linearGradient id="frameGold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={p.frameStops[0]} />
            <stop offset="40%" stopColor={p.frameStops[1]} />
            <stop offset="60%" stopColor={p.frameStops[2]} />
            <stop offset="100%" stopColor={p.frameStops[3]} />
          </linearGradient>
        </defs>

        {/* background */}
        <rect
          x="0"
          y="0"
          width={VIEW_W}
          height={VIEW_H}
          fill="url(#bgGrad)"
          opacity={p.bgOpacity}
        />
        <rect
          x="0"
          y="0"
          width={VIEW_W}
          height={VIEW_H}
          fill={p.bgTint}
          opacity={p.bgTintOpacity * p.bgOpacity}
        />

        {/* ornate frame */}
        <g>
          <rect
            x={FRAME_PAD / 2}
            y={FRAME_PAD / 2}
            width={VIEW_W - FRAME_PAD}
            height={VIEW_H - FRAME_PAD}
            fill="none"
            stroke="url(#frameGold)"
            strokeWidth="3"
            rx="4"
          />
          <rect
            x={FRAME_PAD / 2 + 8}
            y={FRAME_PAD / 2 + 8}
            width={VIEW_W - FRAME_PAD - 16}
            height={VIEW_H - FRAME_PAD - 16}
            fill="none"
            stroke="url(#frameGold)"
            strokeWidth="1"
            opacity="0.6"
            rx="2"
          />

          {/* corner rosettes */}
          {[
            [FRAME_PAD / 2 + 8, FRAME_PAD / 2 + 8],
            [VIEW_W - FRAME_PAD / 2 - 8, FRAME_PAD / 2 + 8],
            [FRAME_PAD / 2 + 8, VIEW_H - FRAME_PAD / 2 - 8],
            [VIEW_W - FRAME_PAD / 2 - 8, VIEW_H - FRAME_PAD / 2 - 8],
          ].map(([cx, cy], i) => (
            <g key={i}>
              <circle
                cx={cx}
                cy={cy}
                r="6"
                fill="url(#frameGold)"
                stroke={p.rosetteCenter}
                strokeWidth="0.5"
              />
              <circle cx={cx} cy={cy} r="2.5" fill={p.rosetteCenter} />
            </g>
          ))}

          {/* top scallop */}
          <path
            d={`M${FRAME_PAD / 2 + 20} ${FRAME_PAD / 2 + 18}
                Q${VIEW_W / 4} ${FRAME_PAD / 2 + 34}, ${VIEW_W / 2} ${FRAME_PAD / 2 + 22}
                T${VIEW_W - FRAME_PAD / 2 - 20} ${FRAME_PAD / 2 + 18}`}
            fill="none"
            stroke="url(#frameGold)"
            strokeWidth="1.2"
            opacity="0.75"
          />
          {/* bottom scallop */}
          <path
            d={`M${FRAME_PAD / 2 + 20} ${VIEW_H - FRAME_PAD / 2 - 18}
                Q${VIEW_W / 4} ${VIEW_H - FRAME_PAD / 2 - 34}, ${VIEW_W / 2} ${VIEW_H - FRAME_PAD / 2 - 22}
                T${VIEW_W - FRAME_PAD / 2 - 20} ${VIEW_H - FRAME_PAD / 2 - 18}`}
            fill="none"
            stroke="url(#frameGold)"
            strokeWidth="1.2"
            opacity="0.75"
          />
        </g>

        {/* horizontal price grid */}
        {ticks.map((t, i) => {
          const y =
            priceRange.chartTop +
            ((priceRange.priceMax - t) /
              (priceRange.priceMax - priceRange.priceMin)) *
              (priceRange.chartBottom - priceRange.chartTop);
          return (
            <g key={i}>
              <line
                x1={chartLeft}
                x2={chartRight}
                y1={y}
                y2={y}
                stroke={p.accentDark}
                strokeWidth="0.5"
                opacity="0.35"
                strokeDasharray="2 4"
              />
             <text
  x={VIEW_W - FRAME_PAD / 2 - 14}
  y={y + 4}
  fill={p.accentSoft}
  fontSize={dims.axisFont}
  fontFamily="IBM Plex Serif, serif"
  textAnchor="end"
>
  {formatPrice(t)}
</text>
            </g>
          );
        })}

        {/* candles */}
        <g>
          {displayCandles.map((c, i) => (
            <Candle
              key={`${c.time}-${i}`}
              candle={c}
              index={i}
              x={chartLeft + slot * i + (slot - candleWidth) / 2}
              width={candleWidth}
              slot={slot}
              priceRange={priceRange}
              volatility={volatility}
              isLatest={i === displayCandles.length - 1}
              isHovered={hoverIdx === i}
              onHover={setHoverIdx}
              p={p}
            />
          ))}
        </g>

        {/* timeframe toggle — segmented pills in the bottom strip of the frame.
            Rendered only when the parent wires up `onTimeframeChange`.
            Positioned between chartBottom and the bottom scallop. */}
        {onTimeframeChange && (() => {
          const btnW = isMobile ? 92 : 96;
          const btnH = isMobile ? 30 : 32;
          const gap = 6;
          const totalW =
            TIMEFRAME_OPTIONS.length * btnW +
            (TIMEFRAME_OPTIONS.length - 1) * gap;
          const startX = (VIEW_W - totalW) / 2;
          const scallopDip = VIEW_H - FRAME_PAD / 2 - 34;
          const btnY =
            priceRange.chartBottom +
            (scallopDip - priceRange.chartBottom - btnH) / 2;
          return (
            <g>
              {TIMEFRAME_OPTIONS.map((opt, i) => {
                const x = startX + i * (btnW + gap);
                const active = opt.key === timeframeKey;
                return (
                  <g
                    key={opt.key}
                    onClick={() => onTimeframeChange(opt.key)}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x={x}
                      y={btnY}
                      width={btnW}
                      height={btnH}
                      fill={active ? p.accent : "transparent"}
                      stroke={p.accent}
                      strokeWidth="1"
                      opacity={active ? 1 : 0.7}
                      rx="3"
                    />
                    <text
                      x={x + btnW / 2}
                      y={btnY + btnH / 2 + (isMobile ? 5 : 4)}
                      fill={active ? p.cartoucheFill : p.accent}
                      fontSize={isMobile ? 14 : 13}
                      fontFamily="IBM Plex Serif, serif"
                      textAnchor="middle"
                      letterSpacing="1"
                      style={{ pointerEvents: "none" }}
                    >
                      {opt.label}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* hover guide line */}
        {hoverIdx != null && displayCandles[hoverIdx] && (
          <line
            x1={chartLeft + slot * hoverIdx + slot / 2}
            x2={chartLeft + slot * hoverIdx + slot / 2}
            y1={priceRange.chartTop}
            y2={priceRange.chartBottom}
            stroke={p.accent}
            strokeWidth="0.8"
            opacity="0.35"
            strokeDasharray="3 4"
            pointerEvents="none"
          />
        )}

        {/* header: title + price.
            Desktop lays title/subtitle on the left and price/change on the right.
            Mobile stacks them vertically so they don't overlap in the narrower viewBox. */}
        {isMobile ? (
          <g>
            <text
              x={VIEW_W / 2}
              y={46}
              fill={p.accent}
              fontSize={dims.titleFont}
              fontFamily="Pirata One, serif"
              letterSpacing="1"
              textAnchor="middle"
            >
              Our Lady of Perpetual Profit
            </text>
            <text
              x={VIEW_W / 2}
              y={72}
              fill={p.accentSoft}
              fontSize={dims.subtitleFont}
              fontFamily="IBM Plex Serif, serif"
              letterSpacing="2"
              textAnchor="middle"
            >
              RL80 · {activeTimeframeLabel}
              {marketCap != null && ` · MCAP ${formatMarketCap(marketCap)}`}
            </text>
            <text
              x={VIEW_W / 2}
              y={108}
              fill={p.accent}
              fontSize={dims.priceFont}
              fontFamily="IBM Plex Serif, serif"
              textAnchor="middle"
            >
              {formatPrice(latestPrice)}
            </text>
            <text
              x={VIEW_W / 2}
              y={130}
              fill={priceColor}
              fontSize={dims.changeFont}
              fontFamily="IBM Plex Serif, serif"
              textAnchor="middle"
            >
              {arrow} {Math.abs(priceChange24h).toFixed(2)}% · 24h
            </text>
          </g>
        ) : (
          <g>
            <text
              x={CHART_PAD_LEFT}
              y={52}
              fill={p.accent}
              fontSize={dims.titleFont}
              fontFamily="Pirata One, serif"
              letterSpacing="1"
            >
              Our Lady of Perpetual Profit
            </text>
            <text
              x={CHART_PAD_LEFT}
              y={74}
              fill={p.accentSoft}
              fontSize={dims.subtitleFont}
              fontFamily="IBM Plex Serif, serif"
              letterSpacing="2"
            >
              RL80 · {activeTimeframeLabel}
              {marketCap != null && ` · MCAP ${formatMarketCap(marketCap)}`}
            </text>
            <text
              x={VIEW_W - CHART_PAD_RIGHT + 90}
              y={52}
              fill={p.accent}
              fontSize={dims.priceFont}
              fontFamily="IBM Plex Serif, serif"
              textAnchor="end"
            >
              {formatPrice(latestPrice)}
            </text>
            <text
              x={VIEW_W - CHART_PAD_RIGHT + 90}
              y={72}
              fill={priceColor}
              fontSize={dims.changeFont}
              fontFamily="IBM Plex Serif, serif"
              textAnchor="end"
            >
              {arrow} {Math.abs(priceChange24h).toFixed(2)}% · 24h
            </text>
          </g>
        )}

      </svg>

      {hoverIdx != null && displayCandles[hoverIdx] && svgBox && (() => {
        const c = displayCandles[hoverIdx];
        const cx = chartLeft + slot * hoverIdx + slot / 2;
        const bodyTopY =
          priceRange.chartTop +
          ((priceRange.priceMax - Math.max(c.open, c.close)) /
            (priceRange.priceMax - priceRange.priceMin || 1)) *
            (priceRange.chartBottom - priceRange.chartTop);

        // Convert SVG user coordinates → pixels inside .shrine-wrap, accounting
        // for xMidYMid meet letterboxing: the SVG content is scaled uniformly
        // to fit, then centered, leaving equal letterbox padding on the minor
        // axis.
        const wrapW = svgBox.width;
        const wrapH = svgBox.height;
        const scale = Math.min(wrapW / VIEW_W, wrapH / VIEW_H);
        const offsetX = (wrapW - VIEW_W * scale) / 2;
        const offsetY = (wrapH - VIEW_H * scale) / 2;
        const pxLeft = offsetX + cx * scale;
        const pxTop = offsetY + bodyTopY * scale;

        const onRight = pxLeft > wrapW * 0.6;
        const up = c.close >= c.open;
        const change = c.open > 0 ? ((c.close - c.open) / c.open) * 100 : 0;
        return (
          <div
            className="shrine-tooltip"
            style={{
              left: `${pxLeft}px`,
              top: `${pxTop}px`,
              transform: onRight
                ? "translate(-100%, -100%) translate(-14px, -14px)"
                : "translate(0, -100%) translate(14px, -14px)",
            }}
          >
            <div className="tt-time">{formatTimestamp(c.time)}</div>
            <div className="tt-row">
              <span>Open</span>
              <span>{formatPrice(c.open)}</span>
            </div>
            <div className="tt-row">
              <span>High</span>
              <span>{formatPrice(c.high)}</span>
            </div>
            <div className="tt-row">
              <span>Low</span>
              <span>{formatPrice(c.low)}</span>
            </div>
            <div className="tt-row">
              <span>Close</span>
              <span>{formatPrice(c.close)}</span>
            </div>
            <div className={`tt-change ${up ? "up" : "down"}`}>
              {up ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
            </div>
          </div>
        );
      })()}

      {(loading || error) && (
        <div className="shrine-status">
          {loading ? "lighting the candles…" : error ? `⚠ ${error}` : null}
        </div>
      )}
    </div>
  );
}
