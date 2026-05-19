"use client";

import React, { useEffect, useState } from "react";
import TradingCard from "@/components/TradingCard";

const EUGENE = {
  name: "Eugene",
  subtitle: "Unihood",
  cardType: "Trader",
  style: "Meme",
  rarity: "Mythic",
  edition: "1/80",
  startingCred: 20,
  startingPortfolio: 0,
  ability: {
    name: "Mean Meme Game",
    icon: "\u{1F680}",
    badgeImage: "/abilityBadge.png",
    text: "First Meme Coin bought each game enters with +8 Portfolio.",
  },
  weakness: "Rug Pulls",
  resistance: "Meme Season",
  pivotCost: 2,
  flavorText: "Charts are just vibes with timestamps.",
  backgroundImage: "/TCG/traderUnicorn.webp",
  artFocus: "center 28%",
  artZoom: 1.25,
};

const MARISOL = {
  name: "Marisol",
  subtitle: "Det. Trinity",
  cardType: "Trader",
  style: "Logos",
  rarity: "Legendary",
  edition: "12/80",
  startingCred: 22,
  startingPortfolio: 0,
  ability: {
    name: "Cold Read",
    icon: "\u{1F50D}",
    badgeImage: "/abilityBadge.png",
    text: "Once per round, peek the top of the Market deck and reorder it.",
  },
  weakness: "Hype Waves",
  resistance: "Audits",
  pivotCost: 3,
  flavorText: "Every wallet leaves a fingerprint.",
  backgroundImage: "/TCG/traderUnicorn.webp",
  artFocus: "center 28%",
  artZoom: 1.25,
};

const NO_ART = {
  ...EUGENE,
  backgroundImage: null,
  edition: "demo",
};

export default function CardTemplatePage() {
  const [scale, setScale] = useState(0.75);
  const [active, setActive] = useState("eugene");
  const [artFocusY, setArtFocusY] = useState(28);
  const [artZoom, setArtZoom] = useState(1.25);
  const [useOverlay, setUseOverlay] = useState(true);
  const [foilStyle, setFoilStyle] = useState("hero");
  const base = active === "eugene" ? EUGENE : active === "marisol" ? MARISOL : NO_ART;
  const card = {
    ...base,
    artFocus: base.backgroundImage ? `center ${artFocusY}%` : null,
    artZoom: base.backgroundImage ? artZoom : 1,
    overlayImage: useOverlay ? "/cardOverlay.webp" : null,
    foilStyle,
  };

  useEffect(() => {
    const adjust = () => {
      const w = window.innerWidth;
      if (w < 820) setScale(Math.max(0.36, (w - 60) / 744));
      else if (w < 1200) setScale(0.65);
      else setScale(0.85);
    };
    adjust();
    window.addEventListener("resize", adjust);
    return () => window.removeEventListener("resize", adjust);
  }, []);

  return (
    <main className="ct-shell">
      <style>{PAGE_STYLES}</style>
      <div className="ct-grid" aria-hidden />

      <header className="ct-top">
        <div>
          <p className="ct-kicker">Terminal Traders // Card Template</p>
          <h1>Trading Card Overlay</h1>
          <p className="ct-sub">
            Move your mouse over the card to tilt it. Same dimensions (744 ×
            1038) for every card type; swap <code>backgroundImage</code> per card.
          </p>
        </div>

        <div className="ct-controls">
          <button
            className={active === "eugene" ? "is-active" : ""}
            onClick={() => setActive("eugene")}
          >
            Eugene — Mythic
          </button>
          <button
            className={active === "marisol" ? "is-active" : ""}
            onClick={() => setActive("marisol")}
          >
            Marisol — Legendary
          </button>
          <button
            className={active === "noart" ? "is-active" : ""}
            onClick={() => setActive("noart")}
          >
            No artwork
          </button>
          <button
            className={useOverlay ? "is-active" : ""}
            onClick={() => setUseOverlay(!useOverlay)}
            title="Toggle cardOverlay.png"
          >
            Overlay {useOverlay ? "ON" : "OFF"}
          </button>
          <div className="ct-foil-group" role="radiogroup" aria-label="Foil style">
            {[
              { id: "hero", label: "Holo" },
              { id: "v", label: "V" },
              { id: "radiant", label: "Radiant" },
              { id: "subtle", label: "Subtle" },
            ].map((f) => (
              <button
                key={f.id}
                role="radio"
                aria-checked={foilStyle === f.id}
                className={foilStyle === f.id ? "is-active" : ""}
                onClick={() => setFoilStyle(f.id)}
                title={`Foil: ${f.label}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label>
            Scale
            <input
              type="range"
              min="0.4"
              max="1"
              step="0.01"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
            />
            <span>{scale.toFixed(2)}×</span>
          </label>
          <label>
            Art Y
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={artFocusY}
              onChange={(e) => setArtFocusY(parseInt(e.target.value, 10))}
            />
            <span>{artFocusY}%</span>
          </label>
          <label>
            Art Zoom
            <input
              type="range"
              min="1"
              max="2.6"
              step="0.05"
              value={artZoom}
              onChange={(e) => setArtZoom(parseFloat(e.target.value))}
            />
            <span>{artZoom.toFixed(2)}×</span>
          </label>
        </div>
      </header>

      <section className="ct-stage">
        <TradingCard data={card} scale={scale} />
      </section>

      <aside className="ct-notes">
        <div>
          <strong>744 × 1038</strong>
          <span>standard print</span>
        </div>
        <div>
          <strong>1488 × 2076</strong>
          <span>retina export</span>
        </div>
        <div>
          <strong>JSON-driven</strong>
          <span>swap <code>cardType</code>, <code>rarity</code>, art</span>
        </div>
        <div>
          <strong>Holo foil</strong>
          <span>scales with cursor lift</span>
        </div>
      </aside>
    </main>
  );
}

const PAGE_STYLES = `
  .ct-shell {
    min-height: 100vh;
    padding: 32px 32px 80px;
    background:
      radial-gradient(circle at 14% 20%, rgba(255,94,196,.14), transparent 32%),
      radial-gradient(circle at 84% 24%, rgba(83,255,214,.12), transparent 30%),
      linear-gradient(135deg, #04060a 0%, #0a0d12 50%, #04060a 100%);
    color: #effff9;
    font-family: "IBM Plex Sans", "Inter", system-ui, sans-serif;
    position: relative;
    overflow-x: hidden;
  }

  .ct-grid {
    position: fixed;
    inset: 0;
    z-index: 0;
    opacity: .18;
    pointer-events: none;
    background-image:
      linear-gradient(rgba(83,255,214,.22) 1px, transparent 1px),
      linear-gradient(90deg, rgba(83,255,214,.22) 1px, transparent 1px);
    background-size: 60px 60px;
    transform: perspective(700px) rotateX(58deg) translateY(-200px) scale(2);
    transform-origin: top center;
  }

  .ct-top {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 28px;
    margin-bottom: 28px;
    flex-wrap: wrap;
  }

  .ct-kicker {
    margin: 0;
    color: #53ffd6;
    font-family: "IBM Plex Mono", monospace;
    font-size: 12px;
    letter-spacing: .3em;
    text-transform: uppercase;
  }

  .ct-top h1 {
    margin: 6px 0 6px;
    font-family: "Bebas Neue", Impact, sans-serif;
    font-size: clamp(38px, 5vw, 64px);
    line-height: .9;
    color: #fff7ce;
    letter-spacing: .02em;
  }

  .ct-sub {
    margin: 0;
    max-width: 540px;
    color: rgba(239,255,249,.72);
    line-height: 1.45;
    font-size: 14px;
  }

  .ct-sub code {
    font-family: "IBM Plex Mono", monospace;
    font-size: 12px;
    color: #ffd166;
    padding: 1px 6px;
    background: rgba(255,209,102,.08);
    border-radius: 4px;
  }

  .ct-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .ct-controls button {
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,.16);
    background: rgba(255,255,255,.04);
    color: #effff9;
    font-family: "IBM Plex Mono", monospace;
    font-size: 12px;
    letter-spacing: .14em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 160ms ease;
  }

  .ct-controls button:hover {
    border-color: #53ffd6;
    background: rgba(83,255,214,.08);
  }

  .ct-controls button.is-active {
    border-color: #ffd166;
    color: #ffd166;
    background: rgba(255,209,102,.1);
    box-shadow: 0 0 18px rgba(255,209,102,.25);
  }

  .ct-controls label {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,.12);
    background: rgba(0,0,0,.4);
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px;
    letter-spacing: .2em;
    text-transform: uppercase;
    color: rgba(239,255,249,.7);
  }

  .ct-controls input {
    width: 100px;
    accent-color: #53ffd6;
  }

  .ct-controls label span {
    color: #fff7ce;
    min-width: 38px;
    text-align: right;
  }

  .ct-stage {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: center;
    padding: 30px 0 40px;
  }

  .ct-notes {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    max-width: 880px;
    margin: 0 auto;
  }

  .ct-notes > div {
    padding: 14px 16px;
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 10px;
    background: rgba(0,0,0,.34);
    backdrop-filter: blur(10px);
  }

  .ct-notes strong {
    display: block;
    font-family: "Bebas Neue", Impact, sans-serif;
    font-size: 22px;
    color: #fff7ce;
    letter-spacing: .04em;
  }

  .ct-notes span {
    display: block;
    margin-top: 4px;
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px;
    letter-spacing: .22em;
    text-transform: uppercase;
    color: rgba(239,255,249,.55);
  }

  .ct-notes code {
    font-size: 10px;
    color: #ffd166;
  }
`;
