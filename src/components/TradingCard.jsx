"use client";

import React, { useEffect, useRef, useState } from "react";

const RARITY_ACCENT = {
  Common: "#9cfce9",
  Uncommon: "#53ffd6",
  Rare: "#67c7ff",
  Epic: "#c597ff",
  Legendary: "#ffd166",
  Mythic: "#ff5ec4",
};

const TYPE_ACCENT = {
  Trader: "#ffd166",
  Coin: "#f6d365",
  Action: "#ff7ad9",
  Market: "#67c7ff",
};

const LABEL_GRADIENTS = {
  type:     "linear-gradient(180deg, #ffe27a 0%, #d49b00 55%, #8a5e00 100%)",
  ability:  "linear-gradient(180deg, #ff5454 0%, #c40000 55%, #780000 100%)",
  move:     "linear-gradient(180deg, #5fb8ff 0%, #1b6dbe 55%, #0a3a72 100%)",
  rarity:   "linear-gradient(180deg, var(--r-lite) 0%, var(--r-mid) 55%, var(--r-dark) 100%)",
};

function ObliqueLabel({ variant = "ability", children, style }) {
  return (
    <span
      className={`tc-ob tc-ob--${variant}`}
      style={{ "--label-grad": LABEL_GRADIENTS[variant], ...style }}
    >
      <span className="tc-ob__inner">{children}</span>
    </span>
  );
}

export default function TradingCard({
  data,
  scale = 1,
  interactive = true,
  cornerBadge = null,
}) {
  const cardRef = useRef(null);
  const interactingRef = useRef(false);
  const [tilt, setTilt] = useState({
    rx: 0, ry: 0, mx: 50, my: 50, posx: 50, posy: 50, hyp: 0, lift: 0,
  });

  const rarityAccent = RARITY_ACCENT[data.rarity] || "#ffd166";
  const typeAccent = TYPE_ACCENT[data.cardType] || "#ffd166";
  const foilTier =
    data.foilStyle ||
    (["Mythic", "Legendary"].includes(data.rarity) ? "hero" : "subtle");

  const applyAt = (clientX, clientY) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    const dx = (x - 50) / 50;
    const dy = (y - 50) / 50;
    const hyp = Math.min(1, Math.sqrt(dx * dx + dy * dy));
    setTilt({
      mx: x, my: y, posx: x, posy: y, hyp,
      rx: dy * -7,
      ry: dx * 9,
      lift: 1,
    });
  };

  const handleMove = (event) => {
    if (!interactive) return;
    interactingRef.current = true;
    applyAt(event.clientX, event.clientY);
  };

  const handleTouch = (event) => {
    if (!interactive) return;
    interactingRef.current = true;
    const t = event.touches[0];
    if (t) applyAt(t.clientX, t.clientY);
  };

  const handleLeave = () => {
    interactingRef.current = false;
    setTilt({ rx: 0, ry: 0, mx: 50, my: 50, posx: 50, posy: 50, hyp: 0, lift: 0 });
  };

  useEffect(() => {
    // Skip the 60fps resting Lissajous when the card is non-interactive
    // (e.g. small Reliquary preview). Every tick re-renders the multi-layer
    // foil (mix-blend-mode + 4 background gradients) and was pushing iOS
    // Safari past its GPU ceiling when the card was also wrapped in a
    // second 3D context for flipping.
    if (!interactive) return undefined;
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      if (!interactingRef.current) {
        const t = (now - start) / 1000;
        // virtual cursor traces a slow Lissajous so the foil sways with the tilt
        const x = 50 + Math.sin(t * 0.7) * 28;
        const y = 50 + Math.sin(t * 0.45 + Math.PI / 3) * 22;
        const dx = (x - 50) / 50;
        const dy = (y - 50) / 50;
        const hyp = Math.min(1, Math.sqrt(dx * dx + dy * dy));
        setTilt({
          mx: x, my: y, posx: x, posy: y, hyp,
          rx: dy * -3.5,
          ry: dx * 4.5,
          lift: 0.35,
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [interactive]);

  return (
    <div
      className="tc-stage"
      style={{
        "--scale": scale,
        "--rarity": rarityAccent,
        "--type": typeAccent,
        "--r-lite": shade(rarityAccent, 35),
        "--r-mid": rarityAccent,
        "--r-dark": shade(rarityAccent, -45),
      }}
    >
      <style>{CARD_STYLES}</style>

      <div
        ref={cardRef}
        className={`tc-card${data.overlayImage ? " is-overlaid" : ""}`}
        data-foil={foilTier}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        onTouchStart={handleTouch}
        onTouchMove={handleTouch}
        onTouchEnd={handleLeave}
        onTouchCancel={handleLeave}
        style={{
          "--rx": `${tilt.rx}deg`,
          "--ry": `${tilt.ry}deg`,
          "--mx": `${tilt.mx}%`,
          "--my": `${tilt.my}%`,
          "--posx": `${tilt.posx}%`,
          "--posy": `${tilt.posy}%`,
          "--hyp": tilt.hyp,
          "--lift": tilt.lift,
        }}
      >
        <div className="tc-body-fill" />

        {data.overlayImage && (
          <img
            className="tc-overlay"
            src={data.overlayImage}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
          />
        )}

        <div className="tc-frame">
          {/* ───── ART WINDOW (image + foil + floating overlays live here) ───── */}
          <div className="tc-art-window">
            {data.backgroundImage && (
              <img
                className="tc-art"
                src={data.backgroundImage}
                alt={`${data.name} artwork`}
                draggable={false}
                loading="lazy"
                decoding="async"
                style={{
                  objectPosition: data.artFocus || "center 38%",
                  transform: `scale(${data.artZoom || 1.55}) translate(
                    ${(50 - (tilt.mx ?? 50)) * 0.05}px,
                    ${(50 - (tilt.my ?? 50)) * 0.05}px
                  )`,
                }}
              />
            )}
            <div className="tc-art-inner-vignette" />
            <div className="tc-foil" />
            <div className="tc-shine" />

            {/* Corner brackets */}
            <div className="tc-art-corner tc-art-corner--tl" />
            <div className="tc-art-corner tc-art-corner--tr" />
            <div className="tc-art-corner tc-art-corner--bl" />
            <div className="tc-art-corner tc-art-corner--br" />

            {/* ───── FLOATING TOP OVERLAY (no panel — elements float on art) ───── */}
            <div className="tc-art-top">
              <div className="tc-cardtype-slot">
                {data.cardTypeBadgeImage ? (
                  <img
                    className="tc-cardtype-badge-img"
                    src={data.cardTypeBadgeImage}
                    alt={data.cardType}
                    draggable={false}
                  />
                ) : (
                  <ObliqueLabel variant="type">{data.cardType}</ObliqueLabel>
                )}
              </div>

              <div className="tc-title">
                <h1>{data.name}</h1>
                {data.subtitle && (
                  <span className="tc-subtitle">{data.subtitle}</span>
                )}
              </div>

              <div className="tc-stat-pair">
                <div className="tc-cred" title="Cred — spend to play cards">
                  <span>CRED</span>
                  <strong>{data.startingCred}</strong>
                </div>
                <div className="tc-portfolio" title="Portfolio Value — first to 100 wins">
                  <span>PV</span>
                  <strong>
                    {data.startingPortfolio}
                    <em>/100</em>
                  </strong>
                </div>
              </div>
            </div>

            {/* ───── FLOATING BOTTOM OVERLAY (rarity tag only) ───── */}
            <div className="tc-art-bottom">
              <ObliqueLabel variant="rarity">{data.rarity}</ObliqueLabel>
            </div>

            <div className="tc-art-inset" />
          </div>

          {/* ───── ABILITY (image badge OR oblique-label fallback) ───── */}
          <section className="tc-ability">
            <div className="tc-ability-badge">
              {data.ability.badgeImage ? (
                <img
                  className="tc-ability-badge-img"
                  src={data.ability.badgeImage}
                  alt="Ability"
                  draggable={false}
                />
              ) : (
                <ObliqueLabel variant="ability">Ability</ObliqueLabel>
              )}
            </div>
            <div className="tc-ability-body">
              <h2>{data.ability.name}</h2>
              <p>{data.ability.text}</p>
            </div>
          </section>

          {/* ───── FLAVOR (sits just below the Ability) ───── */}
          {data.flavorText && (
            <p className="tc-flavor">&ldquo;{data.flavorText}&rdquo;</p>
          )}

          {/* ───── SIGNATURE MOVE (renders only if data.signatureMove is set) ───── */}
          {data.signatureMove && (
            <section className="tc-move">
              <div className="tc-move-cost" aria-label={`Cost ${data.signatureMove.cost} Cred`}>
                {Array.from({ length: data.signatureMove.cost }).map((_, i) => (
                  <span key={i} className="tc-bolt">⚡</span>
                ))}
              </div>
              <div className="tc-move-body">
                <div className="tc-move-head">
                  <ObliqueLabel variant="move">Signature Move</ObliqueLabel>
                  <h3>{data.signatureMove.name}</h3>
                </div>
                <p>{data.signatureMove.text}</p>
              </div>
              <div className="tc-move-value">
                <span>GAIN</span>
                <strong>{data.signatureMove.gain || "+6"}</strong>
              </div>
            </section>
          )}

          {/* ───── BATTLE STRIP (pushed below the flavor quote) ───── */}
          <footer className="tc-battle">
            <div className="tc-battle-stat">
              <span>weakness</span>
              <strong>{data.weakness}</strong>
            </div>
            <div className="tc-battle-sep" />
            <div className="tc-battle-stat">
              <span>resistance</span>
              <strong>{data.resistance}</strong>
            </div>
            <div className="tc-battle-sep" />
            <div className="tc-battle-stat">
              <span>pivot cost</span>
              <strong className="tc-battle-bolts">
                {Array.from({ length: data.pivotCost }).map((_, i) => (
                  <span key={i}>⚡</span>
                ))}
              </strong>
            </div>
          </footer>

          <div className="tc-meta">
            <span>
              <em>Edition</em>
              <b>{data.edition}</b>
            </span>
            <span>
              <em>Style</em>
              <b>{data.style}</b>
            </span>
            <span className="tc-meta-rarity" style={{ "--r": rarityAccent }}>
              <em>Rarity</em>
              <b>{data.rarity}</b>
            </span>
            <span>
              <em>Set</em>
              <b>Genesis</b>
            </span>
          </div>
        </div>

        <div className="tc-edge" />

        {cornerBadge && (
          <div className="tc-corner-badge" aria-hidden="true">
            <span>{cornerBadge}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* Simple lighten/darken for rarity color stops */
function shade(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return `rgb(${r}, ${g}, ${b})`;
}

const CARD_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Lilita+One&family=Bowlby+One&family=Russo+One&family=Anton&family=Concert+One&display=swap');

  .tc-stage {
    --w: 744px;
    --h: 1038px;
    width: calc(var(--w) * var(--scale, 1));
    height: calc(var(--h) * var(--scale, 1));
    perspective: 1400px;
    perspective-origin: 50% 35%;
    font-family: "IBM Plex Sans", "Inter", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .tc-card {
    position: relative;
    width: var(--w);
    height: var(--h);
    /* Let the browser handle vertical scroll past the card; route the
       rest (horizontal + idle finger movement) to our tilt JS. */
    touch-action: pan-y;
    transform-origin: top left;
    transform:
      scale(var(--scale, 1))
      translateZ(0)
      rotateX(var(--rx, 0))
      rotateY(var(--ry, 0));
    transform-style: preserve-3d;
    transition: transform 180ms cubic-bezier(.2,.7,.2,1), box-shadow 220ms ease;
    border-radius: 32px;
    overflow: hidden;
    isolation: isolate;
    color: #effff9;
    box-shadow:
      0 calc(28px + 24px * var(--lift, 0)) calc(60px + 50px * var(--lift, 0)) rgba(0,0,0,.55),
      0 0 0 1px rgba(255,255,255,.04),
      0 0 0 12px #1a1207,
      0 0 0 13px #d9b44a,
      0 0 0 14px #8a6a1a,
      0 0 60px color-mix(in srgb, var(--rarity) calc(22% + 18% * var(--lift, 0)), transparent);
  }

  .tc-body-fill {
    position: absolute;
    inset: 0;
    z-index: 0;
    background:
      radial-gradient(circle at 18% 12%, color-mix(in srgb, var(--rarity) 28%, transparent), transparent 38%),
      radial-gradient(circle at 84% 88%, color-mix(in srgb, var(--type) 18%, transparent), transparent 42%),
      linear-gradient(180deg, #110a04 0%, #0a0805 38%, #050306 100%);
  }

  .tc-edge {
    position: absolute;
    inset: 0;
    z-index: 9;
    pointer-events: none;
    border-radius: inherit;
    box-shadow:
      inset 0 0 0 1px rgba(255,255,255,.08),
      inset 0 0 0 4px rgba(0,0,0,.55),
      inset 0 0 0 5px color-mix(in srgb, var(--rarity) 60%, #d9b44a 40%),
      inset 0 0 80px rgba(0,0,0,.5);
  }

  /* Diagonal corner stamp ("COMING SOON" / "PROMO" / etc).
     Sits inside .tc-card so it inherits the card's tilt + scale; the
     parent's overflow:hidden + 32px border-radius clip the tail. */
  .tc-corner-badge {
    position: absolute;
    top: 70px;
    right: -130px;
    z-index: 10;
    width: 440px;
    padding: 16px 0;
    transform: rotate(45deg);
    transform-origin: center;
    text-align: center;
    background: linear-gradient(
      180deg,
      #3a1f5c 0%,
      #2a1542 55%,
      #1a0b2e 100%
    );
    border-top: 1px solid rgba(241, 215, 122, 0.55);
    border-bottom: 1px solid rgba(197, 151, 255, 0.45);
    box-shadow:
      0 6px 18px rgba(0, 0, 0, 0.6),
      0 0 32px rgba(197, 151, 255, 0.35);
    pointer-events: none;
    user-select: none;
  }

  .tc-corner-badge span {
    display: inline-block;
    font-family: "Cinzel", serif;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 4px;
    text-transform: uppercase;
    color: #f1d77a;
    text-shadow:
      0 1px 0 rgba(0, 0, 0, 0.85),
      0 0 12px rgba(241, 215, 122, 0.55);
  }

  /* ───── Full-card overlay PNG (decorative frame + cosmic FX + ABILITY badge) ───── */
  .tc-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 7;
    pointer-events: none;
    user-select: none;
    object-fit: fill;
    border-radius: inherit;
  }

  .tc-frame {
    position: absolute;
    inset: 0;
    z-index: 5;
    padding: 28px 32px 26px;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto auto auto auto auto;
    gap: 12px;
  }

  /* ───── Overlay-mode cleanup ───── */
  /* When the overlay PNG is active, it brings its own frame edges,
     corner brackets, and ABILITY badge — hide ours, and let our live
     text + scoreboards float above it. */
  .tc-card.is-overlaid .tc-frame { z-index: auto; }
  .tc-card.is-overlaid .tc-edge { display: none; }
  .tc-card.is-overlaid .tc-art-corner { display: none; }
  .tc-card.is-overlaid .tc-art-inset { display: none; }
  .tc-card.is-overlaid .tc-art-window {
    background: transparent;
    border-color: transparent;
    box-shadow: none;
  }
  .tc-card.is-overlaid .tc-ability {
    background: transparent;
    border-color: transparent;
    box-shadow: none;
  }
  .tc-card.is-overlaid .tc-move {
    background: transparent;
    border-color: transparent;
    box-shadow: none;
  }
  .tc-card.is-overlaid .tc-battle {
    background: linear-gradient(180deg, rgba(0,0,0,.72), rgba(0,0,0,.85));
    border-color: rgba(217,180,74,.55);
    box-shadow: 0 4px 14px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.05);
  }
  .tc-card.is-overlaid .tc-flavor {
    background: transparent;
  }
  .tc-card.is-overlaid .tc-art-top,
  .tc-card.is-overlaid .tc-art-bottom,
  .tc-card.is-overlaid .tc-ability,
  .tc-card.is-overlaid .tc-move,
  .tc-card.is-overlaid .tc-flavor,
  .tc-card.is-overlaid .tc-battle,
  .tc-card.is-overlaid .tc-meta {
    position: relative;
    z-index: 8;
  }

  /* Type slot — wraps either the oblique TRADER label OR a custom badge image */
  .tc-cardtype-slot {
    display: inline-flex;
    align-items: center;
  }

  .tc-cardtype-badge-img {
    display: block;
    max-height: 72px;
    max-width: 260px;
    height: auto;
    width: auto;
    object-fit: contain;
    filter: drop-shadow(0 4px 10px rgba(0,0,0,.55));
  }

  /* TRADER + MYTHIC are baked into the overlay PNG — hide the live ones.
     Lock title and stat-pair to their columns so the title stays centered. */
  .tc-card.is-overlaid .tc-cardtype-slot,
  .tc-card.is-overlaid .tc-art-bottom {
    display: none;
  }
  .tc-card.is-overlaid .tc-art-top .tc-title { grid-column: 2; }
  .tc-card.is-overlaid .tc-art-top .tc-stat-pair { grid-column: 3; }

  /* Shift CRED+PV scoreboard inward */
  .tc-card.is-overlaid .tc-stat-pair {
    transform: translateX(-24px);
  }

  /* Pull the ABILITY badge image up so it sits inline with MEAN MEME GAME */
  .tc-card.is-overlaid .tc-ability-badge-img {
    transform: translateY(-14px);
  }

  /* Pull description left so it lines up under MEAN MEME GAME instead of indenting */
  .tc-card.is-overlaid .tc-ability-body p {
    margin-left: -180px;
  }


  /* ───── ART WINDOW ───── */
  .tc-art-window {
    // position: relative;
    min-height: 0;
    border-radius: 14px;
    // overflow: hidden;
    background: #050707;
    border: 1px solid color-mix(in srgb, var(--rarity) 38%, rgba(0,0,0,.6));
    box-shadow:
      inset 0 0 0 2px rgba(0,0,0,.65),
      inset 0 0 0 3px color-mix(in srgb, var(--rarity) 60%, #d9b44a 40%),
      inset 0 0 60px rgba(0,0,0,.5),
      0 12px 32px rgba(0,0,0,.55);
  }

  .tc-art {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    user-select: none;
    pointer-events: none;
    transform-origin: center 35%;
    transition: transform 300ms ease;
  }

  .tc-art-inner-vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(120% 90% at 50% 38%, transparent 50%, rgba(0,0,0,.45) 100%),
      linear-gradient(180deg, rgba(0,0,0,.45) 0%, transparent 18%, transparent 65%, rgba(0,0,0,.55) 100%);
    mix-blend-mode: multiply;
  }

  /* ── Simey-style multi-layer holo foil ── */
  /* ── Simey "rare holo" recipe: fine 2px diffraction grating + smooth
        rainbow + etched bars + cursor glare. The L1 grating alternates
        2px color stripes with 2px BLACK stripes — that's what reads as
        shimmer rather than visible vertical color banding. ── */
  .tc-foil {
    --space: 2px;
    --h: 21;
    --s: 70%;
    --l: 50%;
    --bars: 24px;
    --bar-color: rgba(255,255,255,.6);
    --bar-bg: rgb(10,10,10);

    position: absolute;
    inset: 0;
    pointer-events: none;
    mix-blend-mode: color-dodge;
    opacity: calc(.28 + .55 * var(--lift, 0));
    transition: opacity 240ms ease;

    background-image:
      /* L1: 2px diffraction grating — 16 hues alternating with 2px black */
      repeating-linear-gradient(
        90deg,
        hsl(calc(var(--h) * 0),  var(--s), var(--l)) calc(var(--space) * 0),
        hsl(calc(var(--h) * 0),  var(--s), var(--l)) calc(var(--space) * 1),
        black calc(var(--space) * 1.001),
        black calc(var(--space) * 1.999),
        hsl(calc(var(--h) * 1),  var(--s), var(--l)) calc(var(--space) * 2),
        hsl(calc(var(--h) * 1),  var(--s), var(--l)) calc(var(--space) * 3),
        black calc(var(--space) * 3.001),
        black calc(var(--space) * 3.999),
        hsl(calc(var(--h) * 2),  var(--s), var(--l)) calc(var(--space) * 4),
        hsl(calc(var(--h) * 2),  var(--s), var(--l)) calc(var(--space) * 5),
        black calc(var(--space) * 5.001),
        black calc(var(--space) * 5.999),
        hsl(calc(var(--h) * 3),  var(--s), var(--l)) calc(var(--space) * 6),
        hsl(calc(var(--h) * 3),  var(--s), var(--l)) calc(var(--space) * 7),
        black calc(var(--space) * 7.001),
        black calc(var(--space) * 7.999),
        hsl(calc(var(--h) * 4),  var(--s), var(--l)) calc(var(--space) * 8),
        hsl(calc(var(--h) * 4),  var(--s), var(--l)) calc(var(--space) * 9),
        black calc(var(--space) * 9.001),
        black calc(var(--space) * 9.999),
        hsl(calc(var(--h) * 5),  var(--s), var(--l)) calc(var(--space) * 10),
        hsl(calc(var(--h) * 5),  var(--s), var(--l)) calc(var(--space) * 11),
        black calc(var(--space) * 11.001),
        black calc(var(--space) * 11.999),
        hsl(calc(var(--h) * 6),  var(--s), var(--l)) calc(var(--space) * 12),
        hsl(calc(var(--h) * 6),  var(--s), var(--l)) calc(var(--space) * 13),
        black calc(var(--space) * 13.001),
        black calc(var(--space) * 13.999),
        hsl(calc(var(--h) * 7),  var(--s), var(--l)) calc(var(--space) * 14),
        hsl(calc(var(--h) * 7),  var(--s), var(--l)) calc(var(--space) * 15),
        black calc(var(--space) * 15.001),
        black calc(var(--space) * 15.999),
        hsl(calc(var(--h) * 8),  var(--s), var(--l)) calc(var(--space) * 16),
        hsl(calc(var(--h) * 8),  var(--s), var(--l)) calc(var(--space) * 17),
        black calc(var(--space) * 17.001),
        black calc(var(--space) * 17.999),
        hsl(calc(var(--h) * 9),  var(--s), var(--l)) calc(var(--space) * 18),
        hsl(calc(var(--h) * 9),  var(--s), var(--l)) calc(var(--space) * 19),
        black calc(var(--space) * 19.001),
        black calc(var(--space) * 19.999),
        hsl(calc(var(--h) * 10), var(--s), var(--l)) calc(var(--space) * 20),
        hsl(calc(var(--h) * 10), var(--s), var(--l)) calc(var(--space) * 21),
        black calc(var(--space) * 21.001),
        black calc(var(--space) * 21.999),
        hsl(calc(var(--h) * 11), var(--s), var(--l)) calc(var(--space) * 22),
        hsl(calc(var(--h) * 11), var(--s), var(--l)) calc(var(--space) * 23),
        black calc(var(--space) * 23.001),
        black calc(var(--space) * 23.999),
        hsl(calc(var(--h) * 12), var(--s), var(--l)) calc(var(--space) * 24),
        hsl(calc(var(--h) * 12), var(--s), var(--l)) calc(var(--space) * 25),
        black calc(var(--space) * 25.001),
        black calc(var(--space) * 25.999),
        hsl(calc(var(--h) * 13), var(--s), var(--l)) calc(var(--space) * 26),
        hsl(calc(var(--h) * 13), var(--s), var(--l)) calc(var(--space) * 27),
        black calc(var(--space) * 27.001),
        black calc(var(--space) * 27.999),
        hsl(calc(var(--h) * 14), var(--s), var(--l)) calc(var(--space) * 28),
        hsl(calc(var(--h) * 14), var(--s), var(--l)) calc(var(--space) * 29),
        black calc(var(--space) * 29.001),
        black calc(var(--space) * 29.999),
        hsl(calc(var(--h) * 15), var(--s), var(--l)) calc(var(--space) * 30),
        hsl(calc(var(--h) * 15), var(--s), var(--l)) calc(var(--space) * 31),
        black calc(var(--space) * 31.001),
        black calc(var(--space) * 31.999)
      ),
      /* L2: smooth 6-color rainbow — provides the wide color foundation */
      repeating-linear-gradient(
        90deg,
        #c929f1, #0dbde9, #21e985, #eedf10, #f80e7b, #c929f1
      ),
      /* L3: sparse etched bars */
      repeating-linear-gradient(
        90deg,
        var(--bar-bg) calc(var(--bars) * 2),
        var(--bar-color) calc(var(--bars) * 3),
        var(--bar-bg) calc(var(--bars) * 3.5),
        var(--bar-color) calc(var(--bars) * 4),
        var(--bar-bg) calc(var(--bars) * 5),
        var(--bar-bg) calc(var(--bars) * 12)
      ),
      /* L4: cursor glare */
      radial-gradient(
        farthest-corner circle at var(--mx, 50%) var(--my, 50%),
        rgba(230,230,230,.85) 0%,
        rgba(200,200,200,.10) 25%,
        rgb(0,0,0) 90%
      );

    background-blend-mode: soft-light, soft-light, screen, overlay;

    background-size:
      100% 100%,
      200% 200%,
      237% 237%,
      120% 120%;

    background-position:
      center,
      calc(((50% - var(--posx, 50%)) * 25) + 50%) center,
      calc(var(--posx, 50%) * -1.2) var(--posy, 50%),
      center;

    filter:
      brightness(calc((var(--hyp, 0) + 0.7) * 0.7))
      contrast(3.2)
      saturate(0.66);
  }

  /* Hero rarities (Mythic / Legendary) — stronger foil */
  .tc-card[data-foil="hero"] .tc-foil {
    opacity: calc(.45 + .50 * var(--lift, 0));
  }

  /* Subtle rarities — gentle */
  .tc-card[data-foil="subtle"] .tc-foil {
    opacity: calc(.15 + .30 * var(--lift, 0));
    filter:
      brightness(calc((var(--hyp, 0) + 0.7) * 0.7))
      contrast(2.0)
      saturate(0.55);
  }

  /* Counter-shimmer pass — reverse parallax under exclusion blend */
  .tc-foil::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    mix-blend-mode: exclusion;
    opacity: calc(.18 + .42 * var(--lift, 0));
    background-image: inherit;
    background-blend-mode: inherit;
    background-size: inherit;
    background-position:
      center,
      calc(((50% - var(--posx, 50%)) * -25) + 50%) calc(((50% - var(--posy, 50%)) * -10) + 50%),
      calc(var(--posx, 50%) * 1.2) calc(var(--posy, 50%) * -1),
      center;
    filter: brightness(1) contrast(2) saturate(1);
  }

  /* ───── V CARD FOIL (horizontal rainbow + diagonal metallic streaks) ───── */
  .tc-card[data-foil="v"] .tc-foil {
    --space: 5%;
    --angle: 133deg;
    --imgsize: 500px;
    --grain: url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1MDAiIGhlaWdodD0iNTAwIj48ZmlsdGVyIGlkPSJuIj48ZmVUdXJidWxlbmNlIHR5cGU9ImZyYWN0YWxOb2lzZSIgYmFzZUZyZXF1ZW5jeT0iLjciIG51bU9jdGF2ZXM9IjEwIiBzdGl0Y2hUaWxlcz0ic3RpdGNoIi8+PC9maWx0ZXI+PHJlY3Qgd2lkdGg9IjUwMCIgaGVpZ2h0PSI1MDAiIGZpbGw9IiMwMDAiLz48cmVjdCB3aWR0aD0iNTAwIiBoZWlnaHQ9IjUwMCIgZmlsdGVyPSJ1cmwoI24pIiBvcGFjaXR5PSIuMyIvPjwvc3ZnPg==");

    opacity: calc(.5 + .4 * var(--lift, 0));

    background-image:
      /* L1: noise grain */
      var(--grain),
      /* L2: HORIZONTAL rainbow stripes (0deg) — the V signature */
      repeating-linear-gradient(
        0deg,
        rgb(255,119,115)  calc(var(--space) * 1),
        rgb(255,237,95)   calc(var(--space) * 2),
        rgb(168,255,95)   calc(var(--space) * 3),
        rgb(131,255,247)  calc(var(--space) * 4),
        rgb(120,148,255)  calc(var(--space) * 5),
        rgb(216,117,255)  calc(var(--space) * 6),
        rgb(255,119,115)  calc(var(--space) * 7)
      ),
      /* L3: diagonal metallic streaks at 133° — the V "etched" look */
      repeating-linear-gradient(
        var(--angle),
        #0e152e 0%,
        hsl(180,10%,60%) 3.8%,
        hsl(180,29%,66%) 4.5%,
        hsl(180,10%,60%) 5.2%,
        #0e152e 10%,
        #0e152e 12%
      ),
      /* L4: cursor DARKENING (not lightening) */
      radial-gradient(
        farthest-corner circle at var(--mx, 50%) var(--my, 50%),
        rgba(0,0,0,.1) 12%,
        rgba(0,0,0,.15) 20%,
        rgba(0,0,0,.25) 120%
      );

    background-blend-mode: screen, hue, hard-light;
    background-size: var(--imgsize), 200% 700%, 300%, 200%;
    background-position:
      center,
      0% var(--posy, 50%),
      var(--posx, 50%) var(--posy, 50%),
      var(--posx, 50%) var(--posy, 50%);

    filter: brightness(.8) contrast(2.95) saturate(.5);
  }

  .tc-card[data-foil="v"] .tc-foil::after {
    background-size: var(--imgsize), 200% 400%, 195%, 200%;
    background-position:
      center,
      0% var(--posy, 50%),
      calc(var(--posx, 50%) * -1) calc(var(--posy, 50%) * -1),
      var(--posx, 50%) var(--posy, 50%);
    mix-blend-mode: soft-light;
    filter: brightness(1) contrast(2.5) saturate(1.75);
  }

  /* ───── RADIANT FOIL (criss-cross argyle + diagonal rainbow) ───── */
  .tc-card[data-foil="radiant"] .tc-foil {
    --barwidth: 1.2%;
    --space: 200px;

    /* Subtler than simey's reference — gated heavily on cursor lift so the
       artwork dominates at rest and the criss-cross only comes alive on hover. */
    opacity: calc(((var(--hyp, 0) * .45) + .10) * (.4 + .6 * var(--lift, 0)));
    mix-blend-mode: color-dodge;

    background-image:
      /* L1: 55° diagonal pastel rainbow */
      repeating-linear-gradient(
        55deg,
        rgb(255,161,158) calc(var(--space) * 1),
        rgb(85,178,255)  calc(var(--space) * 2),
        rgb(255,199,146) calc(var(--space) * 3),
        rgb(130,255,213) calc(var(--space) * 4),
        rgb(253,170,240) calc(var(--space) * 5),
        rgb(148,241,255) calc(var(--space) * 6),
        rgb(255,161,158) calc(var(--space) * 7)
      ),
      /* L2: +45° silver bars */
      repeating-linear-gradient(
        45deg,
        hsl(0,0%,10%) 0%,
        hsl(0,0%,10%) var(--barwidth),
        hsl(0,0%,20%) calc(var(--barwidth) + .01%),
        hsl(0,0%,20%) calc(var(--barwidth) * 2),
        hsl(0,0%,35%) calc(var(--barwidth) * 2 + .01%),
        hsl(0,0%,35%) calc(var(--barwidth) * 3),
        hsl(0,0%,42.5%) calc(var(--barwidth) * 3 + .01%),
        hsl(0,0%,42.5%) calc(var(--barwidth) * 4),
        hsl(0,0%,50%) calc(var(--barwidth) * 4 + .01%),
        hsl(0,0%,50%) calc(var(--barwidth) * 5),
        hsl(0,0%,42.5%) calc(var(--barwidth) * 5 + .01%),
        hsl(0,0%,42.5%) calc(var(--barwidth) * 6),
        hsl(0,0%,35%) calc(var(--barwidth) * 6 + .01%),
        hsl(0,0%,35%) calc(var(--barwidth) * 7),
        hsl(0,0%,20%) calc(var(--barwidth) * 7 + .01%),
        hsl(0,0%,20%) calc(var(--barwidth) * 8),
        hsl(0,0%,10%) calc(var(--barwidth) * 8 + .01%),
        hsl(0,0%,10%) calc(var(--barwidth) * 9),
        hsl(0,0%,0%)  calc(var(--barwidth) * 9 + .01%),
        hsl(0,0%,0%)  calc(var(--barwidth) * 10)
      ),
      /* L3: -45° silver bars (mirror — creates the criss-cross) */
      repeating-linear-gradient(
        -45deg,
        hsl(0,0%,10%) 0%,
        hsl(0,0%,10%) var(--barwidth),
        hsl(0,0%,20%) calc(var(--barwidth) + .01%),
        hsl(0,0%,20%) calc(var(--barwidth) * 2),
        hsl(0,0%,35%) calc(var(--barwidth) * 2 + .01%),
        hsl(0,0%,35%) calc(var(--barwidth) * 3),
        hsl(0,0%,42.5%) calc(var(--barwidth) * 3 + .01%),
        hsl(0,0%,42.5%) calc(var(--barwidth) * 4),
        hsl(0,0%,50%) calc(var(--barwidth) * 4 + .01%),
        hsl(0,0%,50%) calc(var(--barwidth) * 5),
        hsl(0,0%,42.5%) calc(var(--barwidth) * 5 + .01%),
        hsl(0,0%,42.5%) calc(var(--barwidth) * 6),
        hsl(0,0%,35%) calc(var(--barwidth) * 6 + .01%),
        hsl(0,0%,35%) calc(var(--barwidth) * 7),
        hsl(0,0%,20%) calc(var(--barwidth) * 7 + .01%),
        hsl(0,0%,20%) calc(var(--barwidth) * 8),
        hsl(0,0%,10%) calc(var(--barwidth) * 8 + .01%),
        hsl(0,0%,10%) calc(var(--barwidth) * 9),
        hsl(0,0%,0%)  calc(var(--barwidth) * 9 + .01%),
        hsl(0,0%,0%)  calc(var(--barwidth) * 10)
      );

    background-size: 400% 400%, 210% 210%, 210% 210%;
    background-position:
      calc(((var(--posx, 50%) - 50%) * -2.5) + 50%) calc(((var(--posy, 50%) - 50%) * -2.5) + 50%),
      calc(((var(--posx, 50%) - 50%) *  1.5) + 50%) calc(((var(--posy, 50%) - 50%) *  1.5) + 50%),
      calc(((var(--posx, 50%) - 50%) *  1.5) + 50%) calc(((var(--posy, 50%) - 50%) *  1.5) + 50%);

    background-blend-mode: exclusion, darken, color-dodge;
    filter: brightness(.85) contrast(2) saturate(.4);
  }

  /* Radiant ::after — disable the inherited counter-shimmer, the criss-cross
     already carries the visual complexity. */
  .tc-card[data-foil="radiant"] .tc-foil::after {
    display: none;
  }

  .tc-shine {
    position: absolute;
    inset: 0;
    pointer-events: none;
    mix-blend-mode: screen;
    opacity: calc(.20 + .42 * var(--lift, 0));
    background:
      radial-gradient(circle at var(--mx, 50%) var(--my, 50%),
        rgba(255,255,255,.55) 0%,
        rgba(255,255,255,.12) 14%,
        transparent 40%),
      linear-gradient(
        calc(115deg + var(--ry, 0deg) * 4),
        transparent 30%,
        rgba(255,255,255,.06) 44%,
        rgba(255,255,255,.28) 50%,
        rgba(255,255,255,.06) 56%,
        transparent 70%);
    transition: opacity 200ms ease;
  }

  .tc-art-corner {
    position: absolute;
    width: 24px;
    height: 24px;
    border: 2px solid color-mix(in srgb, var(--rarity) 80%, #ffe9a8 20%);
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--rarity) 60%, transparent));
    pointer-events: none;
    z-index: 4;
  }
  .tc-art-corner--tl { top: 10px; left: 10px; border-right: 0; border-bottom: 0; border-top-left-radius: 6px; }
  .tc-art-corner--tr { top: 10px; right: 10px; border-left: 0; border-bottom: 0; border-top-right-radius: 6px; }
  .tc-art-corner--bl { bottom: 10px; left: 10px; border-right: 0; border-top: 0; border-bottom-left-radius: 6px; }
  .tc-art-corner--br { bottom: 10px; right: 10px; border-left: 0; border-top: 0; border-bottom-right-radius: 6px; }

  .tc-art-inset {
    position: absolute;
    inset: 6px;
    pointer-events: none;
    border-radius: 10px;
    box-shadow:
      inset 0 0 0 1px rgba(255,255,255,.06),
      inset 0 0 0 2px rgba(0,0,0,.55);
    z-index: 3;
  }

  /* ───── FLOATING OVERLAYS (no panels — elements drop directly on art) ───── */
  .tc-art-top {
    position: absolute;
    top: 22px;
    left: 22px;
    right: 22px;
    z-index: 6;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 14px;
    align-items: start;
    pointer-events: none;
  }

  .tc-art-bottom {
    position: absolute;
    bottom: 22px;
    left: 22px;
    right: 22px;
    z-index: 6;
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 12px;
    pointer-events: none;
  }

  .tc-title {
    text-align: center;
    align-self: center;
    /* slight nudge down so the title baseline lands under the type label cap */
    padding-top: 2px;
  }

  .tc-title h1 {
    margin: 0;
    font-family: "Bebas Neue", "Oswald", Impact, sans-serif;
    font-size: 70px;
    line-height: .82;
    font-weight: 900;
    letter-spacing: .03em;
    color: #d9ef13;
    // text-transform: uppercase;
    -webkit-text-stroke: 4px #ffffff;
    paint-order: stroke fill;
    text-shadow:
      0 4px 10px rgba(0,0,0,.55),
      0 0 22px rgba(0,0,0,.45);
  }

  .tc-subtitle {
    display: inline-block;
    margin-top: 7px;
    padding: 4px 14px;
    font-family: "IBM Plex Mono", "SF Mono", Menlo, monospace;
    font-size: 16px;
    letter-spacing: .26em;
    text-transform: uppercase;
    color: #ffe9a8;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--rarity) 50%, rgba(255,255,255,.1));
    backdrop-filter: blur(4px);
    text-shadow: 0 1px 4px rgba(0,0,0,.8);
  }

  /* CRED + PORTFOLIO — paired live scoreboard */
  .tc-stat-pair {
    display: flex;
    gap: 8px;
    pointer-events: auto;
  }

  .tc-cred,
  .tc-portfolio {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    border-radius: 14px;
    background:
      radial-gradient(circle at 30% 25%, rgba(255,255,255,.22), transparent 60%),
      linear-gradient(180deg, #1f1408, #060403);
    border: 3px solid;
  }

  .tc-cred span,
  .tc-portfolio span {
    font-family: "IBM Plex Mono", monospace;
    font-size: 9px;
    letter-spacing: .28em;
    text-transform: uppercase;
  }

  .tc-cred strong,
  .tc-portfolio strong {
    font-family: "Bebas Neue", Impact, sans-serif;
    font-size: 30px;
    line-height: 1;
    color: #fff7ce;
    text-shadow: 0 2px 0 rgba(0,0,0,.55);
  }

  /* CRED — gold */
  .tc-cred {
    border-color: #d9b44a;
    box-shadow:
      inset 0 0 0 1px rgba(255,255,255,.18),
      0 6px 18px rgba(0,0,0,.7),
      0 0 22px color-mix(in srgb, #d9b44a 38%, transparent);
  }
  .tc-cred span { color: #ffd166; }

  /* PORTFOLIO — teal/cyan (win condition color) */
  .tc-portfolio {
    border-color: #53ffd6;
    box-shadow:
      inset 0 0 0 1px rgba(255,255,255,.18),
      0 6px 18px rgba(0,0,0,.7),
      0 0 24px color-mix(in srgb, #53ffd6 50%, transparent);
  }
  .tc-portfolio span { color: #7df5dc; }
  .tc-portfolio strong {
    color: #effff9;
    text-shadow:
      0 2px 0 rgba(0,0,0,.55),
      0 0 14px color-mix(in srgb, #53ffd6 50%, transparent);
  }
  /* /100 goal indicator next to the PV value */
  .tc-portfolio strong em {
    font-family: "IBM Plex Mono", monospace;
    font-style: normal;
    font-weight: 600;
    font-size: 10px;
    letter-spacing: .04em;
    color: #7df5dc;
    opacity: .7;
    margin-left: 1px;
    text-shadow: none;
    vertical-align: 8px;
  }

  /* ───── OBLIQUE LABELS (parallelogram, leaning right) ───── */
  .tc-ob {
    position: relative;
    display: inline-block;
    padding: 2px;
    background: linear-gradient(180deg, #fafafa 0%, #b8b8b8 40%, #6a6a6a 75%, #2c2c2c 100%);
    clip-path: polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%);
    filter: drop-shadow(0 2px 3px rgba(0,0,0,.55));
    pointer-events: auto;
  }

  .tc-ob__inner {
    display: inline-flex;
    align-items: center;
    padding: 5px 22px 5px 22px;
    background: var(--label-grad);
    clip-path: polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%);
    color: #fff;
    font-family: "IBM Plex Sans Condensed", "Oswald", "Bebas Neue", sans-serif;
    font-style: italic;
    font-weight: 900;
    font-size: 14px;
    letter-spacing: .08em;
    text-transform: uppercase;
    text-shadow: 0 1px 0 rgba(0,0,0,.55), 0 2px 3px rgba(0,0,0,.4);
    box-shadow:
      inset 0 2px 0 rgba(255,255,255,.5),
      inset 0 -2px 0 rgba(0,0,0,.4);
  }

  /* Variants — text size tweaks */
  .tc-ob--type .tc-ob__inner    { padding: 11px 38px; font-size: 21px; letter-spacing: .2em; }
  .tc-ob--ability .tc-ob__inner { padding: 5px 22px; font-size: 13px; letter-spacing: .14em; }
  .tc-ob--move .tc-ob__inner    { padding: 4px 20px; font-size: 11px; letter-spacing: .16em; }
  .tc-ob--rarity .tc-ob__inner  { padding: 5px 22px; font-size: 13px; letter-spacing: .18em; }

  /* ───── ABILITY (pin + body) ───── */
  .tc-ability {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 18px;
    align-items: center;
    padding: 14px 20px 16px;
    background: linear-gradient(180deg, rgba(30,6,12,.96), rgba(14,3,6,.98));
    border-radius: 14px;
    border: 1px solid rgba(255,94,196,.28);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.06),
      0 10px 24px rgba(0,0,0,.5);
  }

  /* Image badge slot — falls back to parallelogram ObliqueLabel */
  .tc-ability-badge {
    display: grid;
    place-items: center;
    min-width: 110px;
    flex-shrink: 0;
  }

  .tc-ability-badge-img {
    display: block;
    max-height: 88px;
    max-width: 160px;
    height: 30px;
    width: auto;
    object-fit: contain;
    filter:
      drop-shadow(0 4px 10px rgba(0,0,0,.55))
      drop-shadow(0 0 6px color-mix(in srgb, var(--rarity) 32%, transparent));
  }

  .tc-ability-body {
    min-width: 0;
    padding-top: 28px;
  }

  .tc-style-chip {
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px;
    letter-spacing: .3em;
    color: rgba(255,255,255,.7);
    text-transform: uppercase;
    padding: 4px 10px;
    border: 1px solid rgba(255,255,255,.16);
    border-radius: 6px;
  }

  .tc-ability h2 {
    margin: 0 0 8px;
    /* Swap the first family to try alternatives:
       "Lilita One" | "Bowlby One" | "Russo One" | "Anton" | "Concert One" */
    font-family: "Lilita One", "Bebas Neue", Impact, sans-serif;
    font-size: 36px;
    line-height: 1;
    color: #e30005;
    letter-spacing: .01em;
    -webkit-text-stroke: 3.5px #ffffff;
    paint-order: stroke fill;
  }

  .tc-ability p {
    margin: 0;
    padding: 4px 10px;
    font-size: 20px;
    line-height: 1.35;
    color: #f4e9d8;
    background: linear-gradient(90deg, transparent, rgba(0,0,0,.42) 30%, rgba(0,0,0,.42) 70%, transparent);
    text-shadow: 0 1px 3px rgba(0,0,0,.7);
  }

  /* ───── SIGNATURE MOVE ───── */
  .tc-move {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 16px;
    align-items: center;
    padding: 12px 16px;
    background: linear-gradient(180deg, rgba(2,14,16,.96), rgba(2,8,10,.98));
    border-radius: 12px;
    border: 1px solid rgba(83,255,214,.28);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.05),
      0 8px 22px rgba(0,0,0,.45);
  }

  .tc-move-cost {
    display: flex;
    gap: 2px;
    padding: 7px 10px;
    border-radius: 9px;
    background: radial-gradient(circle at 30% 30%, rgba(255,255,255,.2), transparent 60%), #050907;
    border: 1px solid rgba(255,255,255,.14);
  }

  .tc-bolt {
    font-size: 22px;
    line-height: 1;
    color: #ffe066;
    text-shadow: 0 0 6px #ffd166, 0 0 12px rgba(255,200,80,.7);
  }

  .tc-move-head {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .tc-move h3 {
    margin: 0;
    font-family: "Bebas Neue", Impact, sans-serif;
    font-size: 28px;
    line-height: 1;
    color: #fff7ce;
    letter-spacing: .02em;
  }

  .tc-move-body p {
    margin: 4px 0 0;
    font-size: 13px;
    line-height: 1.35;
    color: rgba(244,233,216,.85);
  }

  .tc-move-value {
    display: grid;
    place-items: center;
    padding: 6px 14px;
    border-radius: 10px;
    background:
      radial-gradient(circle at 30% 30%, rgba(255,255,255,.22), transparent 60%),
      linear-gradient(180deg, #ffd166, #c98b00);
    color: #1a1207;
    border: 1px solid rgba(0,0,0,.3);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.5), 0 4px 12px rgba(201,139,0,.4);
  }

  .tc-move-value span {
    font-family: "IBM Plex Mono", monospace;
    font-size: 9px;
    letter-spacing: .3em;
    font-weight: 800;
  }

  .tc-move-value strong {
    font-family: "Bebas Neue", Impact, sans-serif;
    font-size: 30px;
    line-height: 1;
  }

  /* ───── FLAVOR ───── */
  .tc-flavor {
    margin: 0;
    bottom: 20px;
    padding: 6px 14px 16px;
    font-family: "Georgia", "Times New Roman", serif;
    font-style: italic;
    font-weight: 600;
    font-size: 28px;
    line-height: 1.35;
    color: #ffe9a8;
    text-align: center;
    background: linear-gradient(90deg, transparent, rgba(0,0,0,.65) 30%, rgba(0,0,0,.65) 70%, transparent);
    text-shadow: 0 1px 4px rgba(0,0,0,.75);
  }

  /* ───── BATTLE STRIP ───── */
  .tc-battle {
    display: grid;
    top: -34px;
    grid-template-columns: 1fr auto 1fr auto 1fr;
    align-items: center;
    gap: 8px;
    padding: 5px 14px;
    // margin: 0 36px;
    background: linear-gradient(180deg, rgba(0,0,0,.85), rgba(0,0,0,.95));
    border-top: 4px solid rgba(217,180,74,.6);
    border-bottom: 4px solid rgba(217,180,74,.6);
    border-radius: 8px;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.06);
  }

  .tc-battle-stat {

    display: grid;
    gap: 4px;
    text-align: center;
  }

  .tc-battle-stat span {
  
    font-family: "IBM Plex Mono", monospace;
    font-size: 13px;
    letter-spacing: .3em;
    color: rgba(255,255,255,.78);
    text-transform: lowercase;
  }

  .tc-battle-stat strong {
    font-family: Impact, sans-serif;
    font-size: 16px;
    line-height: 0.8;
    color: #fff7ce;
    letter-spacing: .02em;
  }

  .tc-battle-bolts {
    color: #ffe066 !important;
  }

  .tc-battle-bolts span {
    display: inline-block;
    font-size: 16px;
    color: #ffe066;
    text-shadow: 0 0 6px rgba(255,200,80,.6);
  }

  .tc-battle-sep {
    width: 1px;
    height: 36px;
    background: linear-gradient(180deg, transparent, rgba(255,255,255,.3), transparent);
  }

  /* ───── META ───── */
  .tc-meta {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 2px 4px;
  }

  .tc-meta span {
    display: flex;
    align-items: baseline;
    gap: 7px;
    font-family: "IBM Plex Mono", monospace;
    font-size: 13px;
    letter-spacing: .1em;
  }

  .tc-meta em {
    font-style: normal;
    color: rgba(255,255,255,.58);
    text-transform: uppercase;
  }

  .tc-meta b {
    color: rgba(255,255,255,.82);
    font-weight: 700;
  }

  .tc-meta-rarity b {
    color: var(--r) !important;
    text-shadow: 0 0 8px color-mix(in srgb, var(--r) 50%, transparent);
  }
`;
