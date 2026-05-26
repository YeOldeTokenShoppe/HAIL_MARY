"use client";

import { useEffect, useMemo, useState } from "react";
import "./stained-price.css";

const SHARDS = [
  {
    symbol: "RL80",
    name: "Reliquary Index",
    price: 0.0842,
    change: 12.8,
    colorA: "#ffd84d",
    colorB: "#ff5a4d",
    points: "214,22 368,76 336,212 108,276 48,126",
    labelX: 212,
    labelY: 138,
    className: "shard-one",
    spin: "30s",
    delay: "0s",
  },
  {
    symbol: "SOL",
    name: "Solana",
    price: 174.23,
    change: -2.4,
    colorA: "#23d7cc",
    colorB: "#4d8dff",
    points: "118,18 356,108 404,292 176,348 66,190",
    labelX: 224,
    labelY: 190,
    className: "shard-two",
    spin: "23s",
    delay: "-5s",
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    price: 107842,
    change: 4.7,
    colorA: "#ff4fc4",
    colorB: "#8157ff",
    points: "210,18 382,250 92,354 30,118",
    labelX: 188,
    labelY: 206,
    className: "shard-three",
    spin: "15s",
    delay: "-2s",
  },
];

function formatPrice(value) {
  if (value >= 1000) {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }

  if (value >= 10) {
    return `$${value.toFixed(2)}`;
  }

  return `$${value.toFixed(4)}`;
}

function nudgePrice(item, tick) {
  const wave = Math.sin(tick / 3 + item.symbol.length) * 0.006;
  const pulse = Math.cos(tick / 4 + item.price) * 0.003;
  const nextPrice = item.price * (1 + wave + pulse);
  const nextChange = item.change + Math.sin(tick / 2 + item.labelX) * 0.35;

  return {
    ...item,
    livePrice: nextPrice,
    liveChange: nextChange,
  };
}

export default function StainedPricePage() {
  const [tick, setTick] = useState(1);
  const [activeSymbol, setActiveSymbol] = useState("RL80");

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1800);
    return () => window.clearInterval(timer);
  }, []);

  const data = useMemo(() => SHARDS.map((item) => nudgePrice(item, tick)), [tick]);
  const active = data.find((item) => item.symbol === activeSymbol) ?? data[0];

  return (
    <main className="stained-price-page">
      <div className="price-scene" aria-hidden="true">
        <div className="scene-plane scene-plane-a" />
        <div className="scene-plane scene-plane-b" />
        <div className="scene-plane scene-plane-c" />
        <div className="scene-orbit orbit-one" />
        <div className="scene-orbit orbit-two" />
      </div>

      <section className="price-stage" aria-label="Stained glass price board">
        <div className="price-copy">
          <p className="eyebrow">Live glass board</p>
          <h1>Prices as colored panes</h1>
          <p className="lede">
            Fake market data is bound to three SVG shards. Each pane can carry a symbol,
            price, movement, and a focused detail state while the background keeps
            the dimensional feel.
          </p>
        </div>

        <div className="glass-shell">
          <svg className="glass-viz" viewBox="0 0 430 380" role="img" aria-labelledby="glass-title">
            <title id="glass-title">Dynamic stained glass price shards</title>
            <defs>
              {data.map((item) => (
                <linearGradient
                  key={item.symbol}
                  id={`gradient-${item.symbol}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor={item.colorA} />
                  <stop offset="58%" stopColor={item.colorB} />
                  <stop offset="100%" stopColor={item.colorA} />
                </linearGradient>
              ))}
              <filter id="glassGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="16" stdDeviation="16" floodColor="#050505" floodOpacity="0.42" />
                <feDropShadow dx="0" dy="0" stdDeviation="9" floodColor="#ffffff" floodOpacity="0.15" />
              </filter>
            </defs>

            <g className="leadwork" filter="url(#glassGlow)">
              {data.map((item) => {
                const isActive = item.symbol === activeSymbol;
                const isUp = item.liveChange >= 0;

                return (
                  <g
                    key={item.symbol}
                    className={`price-shard ${item.className} ${isActive ? "is-active" : ""}`}
                    style={{
                      "--spin-speed": item.spin,
                      "--spin-delay": item.delay,
                    }}
                    onMouseEnter={() => setActiveSymbol(item.symbol)}
                    onFocus={() => setActiveSymbol(item.symbol)}
                    tabIndex="0"
                    role="button"
                    aria-label={`${item.name}: ${formatPrice(item.livePrice)}, ${item.liveChange.toFixed(1)} percent`}
                  >
                    <polygon points={item.points} fill={`url(#gradient-${item.symbol})`} />
                    <path className="shine" d={`M${item.labelX - 82},${item.labelY - 62} l62,-38 l120,124 l-36,22 z`} />
                    <text x={item.labelX} y={item.labelY - 22} className="symbol">
                      {item.symbol}
                    </text>
                    <text x={item.labelX} y={item.labelY + 18} className="price">
                      {formatPrice(item.livePrice)}
                    </text>
                    <text x={item.labelX} y={item.labelY + 48} className={isUp ? "change up" : "change down"}>
                      {isUp ? "+" : ""}
                      {item.liveChange.toFixed(1)}%
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <aside className="price-card" aria-live="polite">
          <span className="card-kicker">{active.symbol}</span>
          <strong>{formatPrice(active.livePrice)}</strong>
          <span className={active.liveChange >= 0 ? "card-change up" : "card-change down"}>
            {active.liveChange >= 0 ? "+" : ""}
            {active.liveChange.toFixed(1)}%
          </span>
          <p>{active.name}</p>
        </aside>
      </section>
    </main>
  );
}
