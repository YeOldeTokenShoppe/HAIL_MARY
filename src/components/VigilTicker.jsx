"use client";

import React, { useEffect, useMemo, useState } from "react";
import { intentionText } from "@/lib/intentions";

// Slim chyron pinned to the top edge of the viewport: recent candle
// lightings from the shrineCandles feed, interleaved with a live RL80
// price tick and scrolled like a stock ticker. Prayer intentions
// formatted as market data — the site's whole register in one strip.
//
// Renders nothing until there's something real to show (no skeletons, no
// fake entries): the Firestore subscription and price feed are client-only,
// so the server render and first client render both produce null, which
// also keeps hydration clean.

// Mostly the plain phrase, with the occasional irreverent variant. Picked
// deterministically per doc id so entries don't reshuffle on every
// snapshot or timer tick.
const PHRASES = [
  "  lit a candle",
  "  lit a candle",
  "  lit a candle",
  "  lit a candle for their bags",
  "  keeps a flame burning",
  // "tends the vigil",
];

function phraseFor(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return PHRASES[Math.abs(h) % PHRASES.length];
}

// Compact token amounts for burn flexes — full precision is noise at
// memecoin scale.
function fmtTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function timeAgo(ms, now) {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Coarse remaining-time for the personal flame item. The ticker's clock
// only ticks every 30s, so minute precision is the honest floor.
function fmtRemaining(ms) {
  const m = Math.floor(ms / 60_000);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  if (m >= 1) return `${m}m`;
  return "<1m";
}

// Token prices live far below $1, and toPrecision emits scientific
// notation ($1.73e-8) at RL80's scale — so deep-decimal values use the
// DEX-style subscript-zero shorthand instead: $0.0₇173 = seven zeros,
// then the three significant digits.
const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
function fmtPrice(p) {
  if (p >= 1) return p.toFixed(2);
  if (p >= 0.01) return p.toPrecision(3);
  const exponent = Math.floor(Math.log10(p));
  let zeros = -exponent - 1;
  // Three significant digits of the mantissa (e.g. 1.73e-8 → 173).
  let mantissa = Math.round((p / Math.pow(10, exponent)) * 100);
  // Rounding can carry over (9.996 → 1000): shift a zero out instead of
  // printing a four-digit mantissa.
  if (mantissa >= 1000) {
    mantissa = 100;
    zeros -= 1;
  }
  // Few enough zeros to just print them.
  if (zeros <= 2) return p.toFixed(zeros + 3);
  const zeroCount = String(zeros)
    .split("")
    .map((d) => SUBSCRIPT_DIGITS[+d])
    .join("");
  return `0.0${zeroCount}${mantissa}`;
}

export default function VigilTicker({
  candles = [],
  latestPrice = null,
  priceChange24h = null,
  // The local user's burning candle ({ litAtMs, meltDurationMs }) or
  // null. Pinned at the head of the loop as "your flame burns · 4h 58m
  // left" — the candle's countdown lives here, in flame context, rather
  // than as a ring around the BUY button where it read as a purchase
  // deadline.
  myFlame = null,
}) {
  // Re-render on a slow clock so the relative timestamps stay honest
  // while the marquee loops.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const hasPrice =
    typeof latestPrice === "number" && Number.isFinite(latestPrice);
  const hasChange =
    typeof priceChange24h === "number" && Number.isFinite(priceChange24h);

  const items = useMemo(() => {
    const priceItem = hasPrice
      ? {
          kind: "price",
          price: fmtPrice(latestPrice),
          change: hasChange ? priceChange24h : null,
        }
      : null;
    const out = [];
    if (myFlame?.litAtMs) {
      const remaining = myFlame.litAtMs + myFlame.meltDurationMs - now;
      if (remaining > 0) {
        out.push({ kind: "mine", key: "mine", remaining });
      }
    }
    if (candles.length > 0) {
      out.push({ kind: "count", key: "count", n: candles.length });
    }
    if (priceItem) out.push({ ...priceItem, key: "price-0" });
    candles.slice(0, 12).forEach((c, i) => {
      const id = c.id || `c${i}`;
      // A user-picked dedication (preset key on the doc) beats the
      // synthesized phrase; unknown/missing keys fall back gracefully.
      const dedicated = intentionText(c.intention);
      // Verified burnt offering (admin-SDK-written by /api/burn-offering;
      // client writes of this field are blocked in firestore.rules) —
      // outranks the candle phrases: sacrifice buys the flex.
      const burned =
        typeof c.tokensBurned === "number" && c.tokensBurned > 0;
      out.push({
        kind: "intention",
        key: id,
        name: c.displayName || "a pilgrim",
        burned,
        phrase: burned
          ? `burned ${fmtTokens(c.tokensBurned)} RL80${dedicated ? ` ${dedicated}` : ""}`
          : dedicated
            ? `  lit a candle ${dedicated}`
            : phraseFor(id),
        when: timeAgo(c.litAtMs, now),
      });
      // Re-insert the price tick every few intentions so it's never far
      // off-screen on long feeds.
      if (priceItem && (i + 1) % 4 === 0 && i + 1 < Math.min(candles.length, 12)) {
        out.push({ ...priceItem, key: `price-${i + 1}` });
      }
    });
    return out;
  }, [candles, hasPrice, hasChange, latestPrice, priceChange24h, now, myFlame]);

  if (items.length === 0) return null;

  const renderItem = (item) => {
    if (item.kind === "mine") {
      return (
        <span className="vigil-mine">
          your flame burns · {fmtRemaining(item.remaining)} left
        </span>
      );
    }
    if (item.kind === "count") {
      return (
        <>
          {item.n} flame{item.n === 1 ? "" : "s"} burning at the shrine
        </>
      );
    }
    if (item.kind === "price") {
      const up = item.change == null || item.change >= 0;
      return (
        <span className={up ? "vigil-up" : "vigil-down"}>
          RL80 ${item.price}
          {item.change != null && (
            <>
              {" "}
              {up ? "▲" : "▼"} {Math.abs(item.change).toFixed(1)}%
            </>
          )}
        </span>
      );
    }
    return (
      <>
        <span className="vigil-name">{item.name}</span>{" "}
        {item.burned ? (
          <span className="vigil-burn">{item.phrase} 🔥</span>
        ) : (
          item.phrase
        )}{" "}
        · {item.when}
      </>
    );
  };

  return (
    <div className="vigil-ticker" aria-label="Recent candle lightings">
      <div
        className="vigil-ticker-track"
        // Speed scales with content so a short feed doesn't whip past.
        style={{ animationDuration: `${Math.max(30, items.length * 7)}s` }}
      >
        {/* Two identical copies side by side; the keyframes slide the
            track by exactly one copy's width (-50%) for a seamless loop. */}
        {[0, 1].map((copy) => (
          <div
            className="vigil-ticker-copy"
            key={copy}
            aria-hidden={copy === 1}
          >
            {items.map((item) => (
              <span className="vigil-ticker-item" key={`${copy}-${item.key}`}>
                {renderItem(item)}
                <span className="vigil-ticker-sep" aria-hidden="true">
                  ✦
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
      <style>{`
        .vigil-ticker {
          position: fixed;
          left: 0;
          right: 0;
          top: 0;
          /* Keep the strip's content below a notch/Dynamic Island when
             the site runs as a standalone PWA. */
          padding-top: env(safe-area-inset-top, 0px);
          z-index: 900; /* under the MusicButton (1000) and nav (10000) */
          overflow: hidden;
          background: rgba(8, 6, 18, 0.78);
          border-top: 1px solid rgba(212, 168, 84, 0.12);
          border-bottom: 1px solid rgba(212, 168, 84, 0.25);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          font-family: 'Courier New', monospace;
          font-size: 0.78rem;
          letter-spacing: 0.12em;
          color: rgba(222, 180, 98, 0.95);
        }
        .vigil-ticker-track {
          display: flex;
          width: max-content;
          animation-name: vigilTickerScroll;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .vigil-ticker:hover .vigil-ticker-track {
          animation-play-state: paused;
        }
        .vigil-ticker-copy {
          display: flex;
          padding: 8px 0;
        }
        .vigil-ticker-item {
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
        }
        .vigil-ticker-sep {
          margin: 0 14px;
          opacity: 0.4;
        }
        .vigil-name {
          color: rgba(42, 214, 238);
        }
        .vigil-mine {
          color: rgba(255, 196, 120);
        }
        .vigil-burn {
          color: rgba(255, 150, 50, 0.98);
          text-shadow: 0 0 8px rgba(255, 120, 30);
        }
        .vigil-up {
          color: rgba(0, 255, 136);
        }
        .vigil-down {
          color: rgba(255, 80, 80);
        }
        @keyframes vigilTickerScroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .vigil-ticker-track {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
