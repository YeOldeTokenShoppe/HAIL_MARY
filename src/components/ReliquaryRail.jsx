"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useInView } from "framer-motion";
import TradingCard from "./TradingCard";
import "./reliquary.css";

const REST_TILT = { rx: 0, ry: 0, lift: 0 };

function RelicImage({ src, backSrc, alt }) {
  const wrapRef = useRef(null);
  const [tilt, setTilt] = useState(REST_TILT);
  const [flipped, setFlipped] = useState(false);

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
  const handleClick = () => {
    if (backSrc) setFlipped((f) => !f);
  };

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
      onClick={handleClick}
      style={{
        "--rx": `${tilt.rx}deg`,
        "--ry": `${tilt.ry}deg`,
        "--lift": tilt.lift,
        "--flip": flipped ? "180deg" : "0deg",
      }}
    >
      <div className="reliquary-image-tilter">
        <div className="reliquary-image-flipper">
          <img
            className="reliquary-image reliquary-image--front"
            src={src}
            alt={alt}
            draggable={false}
            loading="lazy"
            decoding="async"
          />
          {backSrc && (
            <img
              className="reliquary-image reliquary-image--back"
              src={backSrc}
              alt=""
              aria-hidden="true"
              draggable={false}
              loading="lazy"
              decoding="async"
            />
          )}
        </div>
      </div>
    </div>
  );
}

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

const SAINT = {
  name: "Saint GR80",
  subtitle: "The Holo Roller",
  cardType: "Trader",
  style: "Logos",
  rarity: "Legendary",
  edition: "3/80",
  startingCred: 24,
  startingPortfolio: 0,
  ability: {
    name: "Doctrine of Patience",
    badgeImage: "/abilityBadge.png",
    text: "Skip your draw to convert 1 Loss into +6 Cred. The market rewards the faithful.",
  },
  weakness: "Hype Waves",
  resistance: "FUD",
  pivotCost: 2,
  flavorText: "Blessed are the holders, for they shall inherit the bag.",
  backgroundImage: "/TCG/trader_monk.webp",
  artFocus: "center 30%",
  artZoom: 1.2,
  overlayImage: "/cardOverlay_monk.webp",
  foilStyle: "v",
};

const BARRON = {
  name: "John Barron",
  subtitle: "Pit Demon",
  cardType: "Trader",
  style: "Chaos",
  rarity: "Mythic",
  edition: "2/80",
  startingCred: 18,
  startingPortfolio: 0,
  ability: {
    name: "Liquidation Feast",
    badgeImage: "/abilityBadge.png",
    text: "When an opponent gets rugged, gain +4 Cred and draw a Market card.",
  },
  weakness: "Diamond Hands",
  resistance: "Volatility",
  pivotCost: 3,
  flavorText: "Every red candle is a whisper from the pit.",
  backgroundImage: "/TCG/traderDemon.webp",
  artFocus: "center 32%",
  artZoom: 1.2,
  overlayImage: "/cardOverlay_demon.webp",
  foilStyle: "v",
};

// Pool of TCG previews — one is picked at random per page load so
// returning visitors see different faces without us paying for a carousel.
const TCG_POOL = [EUGENE, SAINT, BARRON];

const FEATURES = [
  {
    id: "freshener-0080",
    kind: "relic",
    status: "live",
    statusLabel: "Available Now",
    description: "Virtual Wallet Freshener",
    image: "/airFreshener12.webp",
    backImage: "/airFreshener12_back.webp",
  },
  {
    id: "tcg-preview",
    kind: "card",
    status: "soon",
    statusLabel: "Coming Soon",
    description: "The Trading Card Game",
    tagline: "Eighty traders, one faithful winner.",
  },
];

const ROTATE_MS = 7200;

function ReliquaryRailInner() {
  const [activeIndex, setActiveIndex] = useState(0);
  // Pick once per mount so the same face stays during the rail's lifetime
  // (no swapping mid-rotation), but a fresh face appears on each load.
  // Picked client-side after mount to avoid SSR hydration mismatches.
  const [tcgCard, setTcgCard] = useState(null);
  const [cardFlipped, setCardFlipped] = useState(false);
  const railRef = useRef(null);
  const inView = useInView(railRef, {
    amount: 0.1,
    margin: "120px 0px",
    once: true,
  });
  const active = FEATURES[activeIndex];

  useEffect(() => {
    setTcgCard(TCG_POOL[Math.floor(Math.random() * TCG_POOL.length)]);
  }, []);

  useEffect(() => {
    if (FEATURES.length < 2) return undefined;
    const id = window.setInterval(() => {
      setActiveIndex((idx) => (idx + 1) % FEATURES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  return createPortal(
    <>
      <aside
        ref={railRef}
        className={`reliquary-rail${inView ? " is-revealed" : ""}`}
        aria-label="The Reliquary"
      >
        <h2 className="reliquary-heading">The Reliquary</h2>
        <p className="reliquary-subheading">
          Wares and rites of the order.
        </p>
        <div className="reliquary-feature-stack">
          {FEATURES.map((feat) => {
            const isActive = feat.id === active.id;
            return (
              <article
                key={feat.id}
                className={`reliquary-feature${isActive ? " is-active" : ""}`}
                aria-hidden={!isActive}
              >
                {feat.statusLabel && (
                  <span
                    className={`reliquary-status reliquary-status--${feat.status}`}
                  >
                    {feat.statusLabel}
                  </span>
                )}

                {feat.kind === "relic" ? (
                  <RelicImage
                    src={feat.image}
                    backSrc={feat.backImage}
                    alt={feat.description}
                  />
                ) : (
                  <div className="reliquary-card-wrap">
                    <div className="reliquary-card-frame">
                      <div
                        className={`reliquary-card-flipper${cardFlipped ? " is-flipped" : ""}`}
                        onClick={() => setCardFlipped((f) => !f)}
                        role="button"
                        tabIndex={0}
                        aria-pressed={cardFlipped}
                        aria-label="Flip trading card"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setCardFlipped((f) => !f);
                          }
                        }}
                        style={{ "--card-flip": cardFlipped ? "180deg" : "0deg" }}
                      >
                        <div className="reliquary-card-face reliquary-card-face--front">
                          {tcgCard && (
                            <TradingCard
                              data={tcgCard}
                              scale={0.34}
                              interactive={false}
                            />
                          )}
                        </div>
                        <div className="reliquary-card-face reliquary-card-face--back">
                          <img
                            src="/cardBack.webp"
                            alt=""
                            aria-hidden="true"
                            draggable={false}
                            loading="lazy"
                            decoding="async"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {feat.description && (
                  <p className="reliquary-description">{feat.description}</p>
                )}
                {feat.tagline && (
                  <p className="reliquary-tagline">{feat.tagline}</p>
                )}
              </article>
            );
          })}
        </div>

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

export default function ReliquaryRail() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return <ReliquaryRailInner />;
}
