"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import TradingCard from "./TradingCard";
import "./reliquary.css";

const REST_TILT = { rx: 0, ry: 0, lift: 0 };

function RelicImage({ src, alt }) {
  const wrapRef = useRef(null);
  const [tilt, setTilt] = useState(REST_TILT);

  const applyAt = (clientX, clientY) => {
    if (!wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    const dx = (x - 50) / 50;
    const dy = (y - 50) / 50;
    setTilt({ rx: dy * -10, ry: dx * 12, lift: 1 });
  };

  const handleMouseMove = (e) => applyAt(e.clientX, e.clientY);
  const handleTouch = (e) => {
    const t = e.touches[0];
    if (t) applyAt(t.clientX, t.clientY);
  };
  const handleLeave = () => setTilt(REST_TILT);

  return (
    <div
      ref={wrapRef}
      className="reliquary-image-wrap"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleLeave}
      onTouchStart={handleTouch}
      onTouchMove={handleTouch}
      onTouchEnd={handleLeave}
      onTouchCancel={handleLeave}
      style={{
        "--rx": `${tilt.rx}deg`,
        "--ry": `${tilt.ry}deg`,
        "--lift": tilt.lift,
      }}
    >
      <img className="reliquary-image" src={src} alt={alt} draggable={false} />
    </div>
  );
}

const TCG_PREVIEW = {
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
  overlayImage: "/cardOverlay.webp",
  foilStyle: "v",
};

const FEATURES = [
  {
    id: "freshener-0080",
    kind: "relic",
    status: "live",
    statusLabel: "Available Now",
    description: "Virtual Wallet Freshener",
    image: "/airFreshener6.webp",
  },
  {
    id: "tcg-genesis",
    kind: "card",
    status: "soon",
    statusLabel: "Coming Soon",
    description: "The Trading Card Game",
    card: TCG_PREVIEW,
  },
];

const ROTATE_MS = 7200;

export default function ReliquaryRail() {
  const [mounted, setMounted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const active = FEATURES[activeIndex];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (FEATURES.length < 2) return undefined;
    const id = window.setInterval(() => {
      setActiveIndex((idx) => (idx + 1) % FEATURES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <>
      <aside className="reliquary-rail" aria-label="The Reliquary">
        <article key={active.id} className="reliquary-feature is-entering">
          <span
            className={`reliquary-status reliquary-status--${active.status}`}
          >
            {active.statusLabel}
          </span>

          {active.kind === "relic" ? (
            <RelicImage src={active.image} alt={active.description} />
          ) : (
            <div className="reliquary-card-wrap">
              <div className="reliquary-card-frame">
                <TradingCard data={active.card} scale={0.34} interactive />
              </div>
            </div>
          )}

          {active.description && (
            <p className="reliquary-description">{active.description}</p>
          )}
        </article>

        {FEATURES.length > 1 && (
          <div className="reliquary-controls" aria-label="Feature carousel">
            {FEATURES.map((feat, idx) => (
              <button
                key={feat.id}
                type="button"
                className={`reliquary-dot${
                  idx === activeIndex ? " is-active" : ""
                }`}
                onClick={() => setActiveIndex(idx)}
                aria-label={`Show ${feat.name}`}
                aria-pressed={idx === activeIndex}
              />
            ))}
          </div>
        )}
      </aside>
    </>,
    document.body,
  );
}
