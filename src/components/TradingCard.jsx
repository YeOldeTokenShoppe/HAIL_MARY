"use client";

import React, { useEffect, useRef, useState } from "react";
import { fxMaterial } from "../game/terminal-traders/fxMaterials.js";

const REST_TILT = { rx: 0, ry: 0, mx: 50, my: 50, posx: 50, posy: 50, hyp: 0, lift: 0 };

// Which frames may carry the glitter shine. Matched against the frame's src,
// so it survives the frame registry being reordered or relabelled.
const GLITTER_FRAMES = /frame_gold/;

const RARITY_ACCENT = {
  Common: "#9cfce9",
  Uncommon: "#53ffd6",
  Rare: "#67c7ff",
  Epic: "#c597ff",
  Legendary: "#ffd166",
  Mythic: "#ff5ec4",
  "Terminal Foil": "#ffe27a",
};

// EFFECT badge + heading tones. Cyan is the RL80 default, seeded on #07ddf0:
// the base cyan is the gradient's TOP stop so it actually shows, while the mid
// stop — the one under the white label text — is darkened to 3.84:1, since
// #07ddf0 itself measures only 1.67:1 against white.
//
// `orange` is the escape hatch for cards whose art is itself cyan (Cold
// Wallet's ice vault), where the default would read as low contrast. Opt a
// card in with `abilityTone: "orange"` on its CARD_ART entry.
const EFFECT_TONES = {
  cyan: {
    grad: "linear-gradient(180deg, #07ddf0 0%, #05909c 55%, #024248 100%)",
    ink: "#07ddf0",
  },
  orange: {
    grad: "linear-gradient(180deg, #ffb056 0%, #f07307 55%, #8f3d00 100%)",
    ink: "#f07307",
  },
};

// The type badge follows the frame metal: gold frame → gold badge, everything
// else → silver. Override per card with `data.badgeTone`.
const BADGE_TONE = {
  Common: "silver",
  Uncommon: "silver",
  Rare: "silver",
  Mythic: "gold",
  "Terminal Foil": "gold",
};

const TYPE_ACCENT = {
  Trader: "#ffd166",
  Coin: "#f6d365",
  Action: "#ff7ad9",
  Market: "#67c7ff",
};

const LABEL_GRADIENTS = {
  type:     "linear-gradient(180deg, #ffe27a 0%, #d49b00 55%, #8a5e00 100%)",
  // Silver twin of `type`, for cards whose frame isn't gold. The mid stop
  // carries the label text, so it is matched to gold's luminance rather than
  // to the frame's brightness — an earlier #aeb8c4 measured 2.0:1 against the
  // white text (gold's #d49b00 is 2.5:1) and read as washed out.
  typeSilver: "linear-gradient(180deg, #f2f5f8 0%, #8b97a5 55%, #3a424d 100%)",
  // Default EFFECT tone — see EFFECT_TONES below.
  ability:  "linear-gradient(180deg, #07ddf0 0%, #05909c 55%, #024248 100%)",
  move:     "linear-gradient(180deg, #5fb8ff 0%, #1b6dbe 55%, #0a3a72 100%)",
  rarity:   "linear-gradient(180deg, var(--r-lite) 0%, var(--r-mid) 55%, var(--r-dark) 100%)",
};

// Badge vocabulary (2026-10-16). "oblique" = the original Pokémon-style
// parallelogram chips; "ticket" = the inked time-stamps a trade ticket
// collects on the floor — one for the card type (rarity ink), one beside the
// ability line (lens ink), one for the rarity. This is a markets TCG, not the
// Case Table, so the words are desk vocabulary. Flip here to compare.
const BADGE_STYLE = "ticket";

// Type stamp word, keyed by the lower-cased TYPE_LABELS value.
const TICKET_LABELS = {
  trader: "Trader",
  coin: "Asset",
  action: "Order",
  market: "Macro",
};
// Stamp word beside the ability, per card type. Never a generic "Effect".
const STAMP_LABELS = {
  trader: "ABIL80",
  coin: "Listed",
  action: "Filled",
  market: "Printed",
};

// Rarity glyph: a silhouette icon (public/images, white-on-transparent) used
// as a CSS mask so the tier metal pours through it, plus a grail for the
// terminal foils. Count and metal climb like star systems: 1 silver common,
// 2 silver uncommon, 1 gold rare, 2 gold mythic, golden grail for the
// terminal foils. Metal colours are fixed (not the
// rarity ink) so the tier reads the same inside every stamp; the footer
// still prints the rarity word, so this carries no text.
// Swap the icon here: "/images/flame.png" | "/images/lightning.png".
const RARITY_ICON = "/images/flame.png";

const RARITY_GLYPHS = {
  "Common": { count: 1, metal: "silver" },
  "Uncommon": { count: 2, metal: "silver" },
  "Rare": { count: 1, metal: "gold" },
  "Mythic": { count: 2, metal: "gold" },
  "Terminal Foil": { grail: true, metal: "gold" },
};
const GLYPH_METALS = {
  silver: { lit: "#f4f7fa", shade: "#aab5c1", side: "#4a535d" },
  gold:   { lit: "#ffe58a", shade: "#d9a21b", side: "#6e4f0c" },
};

// Masked icon: ::before is the dark extruded copy, ::after the metal face.
function IconGlyph({ metal, size = 26 }) {
  const m = GLYPH_METALS[metal];
  return (
    <span
      className="tc-ricon"
      style={{
        "--icon": `url(${RARITY_ICON})`,
        "--lit": m.lit, "--shade": m.shade, "--side": m.side,
        width: size, height: size,
      }}
    />
  );
}

// Chalice in a 16x22 box, extruded, rainbow glint on the bowl.
function GrailGlyph({ metal, id }) {
  const m = GLYPH_METALS[metal];
  const bowl = "M1 2 H15 C15 8.5 12 11.5 8 11.5 C4 11.5 1 8.5 1 2 Z";
  const stem = "M6.8 11.5 H9.2 V16 H6.8 Z";
  const foot = "M3 18.4 C3 16.8 5.3 16 8 16 C10.7 16 13 16.8 13 18.4 C13 19.6 10.7 20 8 20 C5.3 20 3 19.6 3 18.4 Z";
  return (
    <svg className="tc-rgrail" viewBox="0 0 17 23" width="19" height="26" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff6b6b" stopOpacity=".6" />
          <stop offset=".5" stopColor="#53ffd6" stopOpacity=".6" />
          <stop offset="1" stopColor="#c597ff" stopOpacity=".6" />
        </linearGradient>
      </defs>
      <g transform="translate(0.9 1.2)" fill={m.side}>
        <path d={bowl} /><path d={stem} /><path d={foot} />
      </g>
      <path d={bowl} fill={m.lit} />
      <path d="M8 2 H15 C15 8.5 12 11.5 8 11.5 Z" fill={m.shade} />
      <path d={stem} fill={m.shade} />
      <path d={foot} fill={m.lit} />
      <path d="M2.5 3.5 H13.5 C13.2 5.5 12.4 7 11.4 8 H4.6 C3.6 7 2.8 5.5 2.5 3.5 Z" fill={`url(#${id})`} />
    </svg>
  );
}

function RarityGlyph({ rarity }) {
  const spec = RARITY_GLYPHS[rarity] || RARITY_GLYPHS.Common;
  const key = String(rarity).replace(/\s+/g, "-");
  return (
    <span className="tc-rglyph" role="img" aria-label={rarity}>
      {spec.grail
        ? <GrailGlyph metal={spec.metal} id={`grail-glint-${key}`} />
        : Array.from({ length: spec.count }, (_, i) => <IconGlyph key={i} metal={spec.metal} />)}
    </span>
  );
}

function TimeStamp({ children, style, small = false, tilt }) {
  const cls = ["tc-stamp", small && "tc-stamp--small", tilt === "left" && "tc-stamp--tilt-left"].filter(Boolean).join(" ");
  return (
    <span className={cls} style={style}>
      <span className="tc-stamp__inner">{children}</span>
    </span>
  );
}

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

// Optional scenery + transparent subject share the same crop and zoom. Keep
// the original illustration until both files load, and use it for thumbnails.
function CardArtwork({ data, tilt, interactive, motionEnabled, className, defaultZoom }) {
  const [loaded, setLoaded] = useState({ background: null, character: null });
  const layers = interactive ? data.artLayers : null;
  const hasLayers = Boolean(layers?.background && layers?.character);
  const ready = hasLayers && loaded.background === layers.background && loaded.character === layers.character;
  const zoom = data.artZoom || defaultZoom;
  const depth = motionEnabled ? Math.max(0, Math.min(1.5, data.artDepth ?? 1)) : 0;
  // A little overscan protects the edges even at the zoom slider's minimum.
  // Both layers use it so their neutral positions continue to line up.
  const layerZoom = Math.max(zoom, 1 + (16 * depth) / 744);
  const dx = tilt.ry / 9;
  const dy = -tilt.rx / 7;

  return (
    <>
      {!ready && data.backgroundImage && (
        <img
          key={data.backgroundImage}
          className={className}
          src={data.backgroundImage}
          alt={`${data.name} artwork`}
          draggable={false}
          loading="lazy"
          decoding="async"
          style={{
            objectPosition: data.artFocus || "center 38%",
            transform: `scale(${zoom}) translate(${(50 - tilt.mx) * 0.05}px, ${(50 - tilt.my) * 0.05}px)`,
          }}
        />
      )}
      {hasLayers && [
        { id: "background", src: layers.background, travel: -6 },
        { id: "character", src: layers.character, travel: 8 },
      ].map(({ id, src, travel }) => (
        <img
          key={`${id}:${src}`}
          className={`${className || ""} tc-art-layer tc-art-layer--${id}`}
          src={src}
          alt={id === "character" ? `${data.name} artwork` : ""}
          draggable={false}
          decoding="async"
          onLoad={() => setLoaded((previous) => ({ ...previous, [id]: src }))}
          style={{
            visibility: ready ? "visible" : "hidden",
            objectPosition: data.artFocus || "center 38%",
            transform: `translate3d(${dx * travel * depth}px, ${dy * travel * depth}px, 0) scale(${layerZoom})`,
          }}
        />
      ))}
    </>
  );
}

// A material response, anchored to the texture: each region catches light at
// a different angle. Narrow peaks create a brief flash during a tilt, while
// the texture's luminance keeps the bright core and bloom on the artwork.
function FxReflection({ reflection, tilt, planeStyle, opacity }) {
  const material = fxMaterial(reflection.material);
  const strength = Math.max(0, Math.min(1.5, reflection.strength ?? 1));
  const dx = tilt.ry / 9;
  const dy = -tilt.rx / 7;
  if (strength === 0) return null;

  let peak = 0;
  const surfaces = reflection.facets.map(({ x, y, radius, axis, angle, roughness, hue }) => {
    const facing = dx * axis[0] + dy * axis[1];
    const distance = (facing - angle) / roughness;
    const flash = Math.exp(-0.5 * distance * distance);
    const sheen = Math.exp(-0.5 * (distance / 3) ** 2);
    peak = Math.max(peak, flash);
    const boundHue = (value) => material.hueRange
      ? Math.max(material.hueRange[0], Math.min(material.hueRange[1], value)) : value;
    const color = boundHue(hue + facing * material.hueTravel);
    const lightness = material.coreLightness[0]
      + flash * (material.coreLightness[1] - material.coreLightness[0]);
    const alpha = Math.min(1, strength * material.emissionGain * (0.08 + sheen * 0.2 + flash * 0.72));
    const rim = Math.min(1, strength * material.emissionGain * (0.06 + sheen * 0.15 + flash * 0.45));
    const glow = Math.min(1, strength * material.bloomGain * flash);
    const region = `ellipse ${radius[0]}% ${radius[1]}% at ${x}% ${y}%`;
    return {
      core: `radial-gradient(${region},
        hsl(${color} 100% ${lightness}% / ${alpha}) 0%,
        hsl(${boundHue(color + material.rimHueOffset)} 100% ${material.rimLightness}% / ${rim}) 38%,
        hsl(${boundHue(color + material.edgeHueOffset)} 100% ${material.edgeLightness}% / ${rim * 0.35}) 68%, transparent 100%)`,
      bloom: `radial-gradient(${region},
        rgb(${material.bloomColor} / ${glow}) 0%,
        hsl(${color} 100% ${material.bloomLightness}% / ${glow * 0.7}) 35%, transparent 85%)`,
    };
  });

  return (
    <div
      className="tc-fx-reflection"
      aria-hidden="true"
      style={{
        ...planeStyle,
        "--fx-mask": `url("${reflection.src}")`,
        "--fx-emission": surfaces.map((surface) => surface.core).join(","),
        "--fx-bloom": surfaces.map((surface) => surface.bloom).join(","),
        "--fx-bloom-radius": `${material.bloomRadius[0] + peak * (material.bloomRadius[1] - material.bloomRadius[0])}px`,
        "--fx-bloom-brightness": material.bloomBrightness,
        opacity,
      }}
    >
      <div className="tc-fx-bloom"><div className="tc-fx-material" /></div>
      <div className="tc-fx-material" />
    </div>
  );
}

export default function TradingCard({
  data,
  scale = 1,
  interactive = true,
  cornerBadge = null,
  templateStyle = "terminal",
  // Shows data.backImage instead of the face. No-op when the card has no back.
  flipped = false,
}) {
  const cardRef = useRef(null);
  const interactingRef = useRef(false);
  const [tilt, setTilt] = useState(REST_TILT);
  const [reducedMotion, setReducedMotion] = useState(true);
  const motionEnabled = interactive && !reducedMotion;
  // Small collection cards stay flat; 0 also restores the printed FX look.
  const fxDepth = motionEnabled ? Math.max(0, Math.min(1.5, data.fxDepth ?? 1)) : 0;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(preference.matches);
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);

  // `effects: "off"` is the master switch for every overlay effect — art
  // foil, background holo, shine/glare, vignette and the FX sheets — so a
  // flat print (the Lotería cards) renders as ink only. Tilt is interaction,
  // not an overlay, and stays on.
  const plain = data.effects === "off";
  // `layout: "print"` renders data.printImage as the whole face: no frame
  // grid, no text layers. The frame image, set badge and corner badge still
  // apply if the caller sets them.
  const isPrint = data.layout === "print" && Boolean(data.printImage);
  const hasBack = Boolean(data.backImage);
  // Hard cap at 3: past that the effects stop reading as distinct and just
  // fog the card (MAX_FX in cardFrames.js).
  const fxLayers = plain ? [] : (data.fxOverlays || []).filter(Boolean).slice(0, 3);

  const badgeTone = data.badgeTone || BADGE_TONE[data.rarity] || "gold";
  const effectTone = EFFECT_TONES[data.abilityTone] || EFFECT_TONES.cyan;

  const rarityAccent = RARITY_ACCENT[data.rarity] || "#ffd166";
  // Title fit (2026-10-16): the title column is ~359px wide at the card's
  // 744px layout width. Trader and coin names stay on ONE line (a stacked
  // "Saint GR80" under a halo reads wrong, and CamelCase coin names can't
  // wrap anyway) and step down in size by length; action/market names are
  // two words and may stack, so they size by their longest word instead.
  const titleFit = (() => {
    const name = String(data.name || "");
    const type = String(data.cardType || "").toLowerCase();
    const oneLine = type === "trader" || type === "coin";
    const len = oneLine ? name.length : Math.max(...name.split(/\s+/).map((w) => w.length));
    const size = len <= 7 ? 70 : len <= 9 ? 60 : len <= 11 ? 52 : len <= 13 ? 46 : 40;
    return { oneLine, size };
  })();
  const typeAccent = TYPE_ACCENT[data.cardType] || "#ffd166";
  // Overlay PNGs have "TRADER" + "MYTHIC" baked into the art, so they only fit
  // Trader cards. Every other type ignores the overlay and shows the live
  // cardType/rarity labels instead (which read ACTION / COIN / MARKET).
  const overlayImage = data.cardType === "Trader" ? data.overlayImage : null;
  const foilTier =
    data.foilStyle ||
    (["Mythic", "Legendary"].includes(data.rarity) ? "hero" : "subtle");
  // Background foil ("none" | "linear" | "motif" | "cosmos") and the
  // card-level shine/glare pair ("off" | "on" | "soft"). Both default off so
  // every existing caller renders exactly as it did before.
  const bgFoil = plain ? "none" : data.bgFoil || "none";
  // "body" clips the background holo out of the art window, the way a reverse
  // holo stops at the art box. "full" lets it run over the art as well, which
  // is what a patterned holo does on a full-art card — and this template's
  // art is near full-bleed, so "body" alone reads as little more than trim.
  const bgScope = data.bgScope || "body";
  // The frame's foil plate: a full-bleed alpha map of which pixels are stamped
  // metal, generated from the frame asset itself. Masking the shine with it is
  // what keeps the holo on the border instead of flooding the card. Passed in
  // rather than imported so this component stays decoupled from the frame
  // registry; plateForFrame() in cardFrames.js resolves it.
  const foilPlate = data.foilPlate || null;
  const shineMode = plain ? "off" : data.shine || "off";
  // "dodge" brightens every pixel the same way; "mirror" blends with overlay,
  // which pivots on the underlying luminance and so chromes the light frame
  // while leaving the dark artwork alone. See the shine CSS block.
  //
  // "glitter" is a GOLD-FRAME treatment, reserved the way rainbow is reserved
  // for the terminal foils: it reads as the 30th-anniversary classic border,
  // and spending it on silver or grey spends the signal for nothing. Asked for
  // on any other frame it falls back to mirror, so a caller can set it
  // unconditionally and still get something sensible. Widen GLITTER_FRAMES to
  // open it up to more frames.
  const shineBlendAsked = data.shineBlend || "dodge";
  const shineBlend =
    shineBlendAsked === "glitter" && !GLITTER_FRAMES.test(String(data.frameImage || ""))
      ? "mirror"
      : shineBlendAsked;
  // Stable per-card sparkle seed. The glitter field and the motif tiling are
  // offset by it, so two cards side by side never sparkle in the same places
  // — and a given card sparkles the same way on every render, which a
  // Math.random() seed would not.
  // The art window is NOT a containing block (its position:relative is
  // commented out below), so .tc-art spans the whole .tc-frame — there is no
  // exposed card body for a background foil to show through. The background
  // holo therefore paints ABOVE the art and clips the art window back out,
  // and the clip needs the window's real geometry, which the frame's grid
  // decides at layout time. Measure it and publish it as --aw-*.
  const cardElRef = React.useRef(null);
  const artWindowRef = React.useRef(null);
  React.useEffect(() => {
    const win = artWindowRef.current;
    const cardEl = cardElRef.current;
    if (!win || !cardEl) return undefined;
    const measure = () => {
      const a = win.getBoundingClientRect();
      const c = cardEl.getBoundingClientRect();
      if (!c.width || !c.height) return;
      // Both rects carry the same scale() so the ratio cancels it out.
      cardEl.style.setProperty("--aw-x", ((a.left - c.left) / c.width) * 100 + "%");
      cardEl.style.setProperty("--aw-y", ((a.top - c.top) / c.height) * 100 + "%");
      cardEl.style.setProperty("--aw-r", ((a.right - c.left) / c.width) * 100 + "%");
      cardEl.style.setProperty("--aw-b", ((a.bottom - c.top) / c.height) * 100 + "%");
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(win);
    ro.observe(cardEl);
    return () => ro.disconnect();
  });

  const foilSeed = React.useMemo(() => {
    const key = String(data.id || data.name || "rl80");
    let h = 2166136261;
    for (let i = 0; i < key.length; i += 1) {
      h ^= key.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return { x: ((h >>> 0) % 997) / 997, y: ((h >>> 11) % 991) / 991 };
  }, [data.id, data.name]);
  const statPair =
    data.statPair ||
    (data.startingCred != null
      ? [
          { label: "CRED", value: data.startingCred, title: "Cred — spend to play cards" },
          { label: "PV", value: data.startingPortfolio, suffix: "/100", title: "Portfolio Value — first to 100 wins" },
        ]
      : null);

  // Classic template's single headline stat (its "HP" slot): a Trader's Cred
  // resource, else the primary/gain value from the stat pair.
  const headline =
    data.startingCred != null
      ? { label: "CRED", value: data.startingCred }
      : statPair?.length
      ? statPair[statPair.length - 1]
      : null;

  const applyAt = (clientX, clientY) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
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
    if (!motionEnabled) return;
    interactingRef.current = true;
    applyAt(event.clientX, event.clientY);
  };

  const handleTouch = (event) => {
    if (!motionEnabled) return;
    interactingRef.current = true;
    const t = event.touches[0];
    if (t) applyAt(t.clientX, t.clientY);
  };

  const handleLeave = () => {
    interactingRef.current = false;
    setTilt(REST_TILT);
  };

  useEffect(() => {
    // Skip the 60fps resting Lissajous when the card is non-interactive
    // (e.g. small Reliquary preview). Every tick re-renders the multi-layer
    // foil (mix-blend-mode + 4 background gradients) and was pushing iOS
    // Safari past its GPU ceiling when the card was also wrapped in a
    // second 3D context for flipping.
    if (!motionEnabled) {
      interactingRef.current = false;
      setTilt(REST_TILT);
      return undefined;
    }
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
  }, [motionEnabled]);

  return (
    <div
      ref={cardRef}
      className="tc-stage"
      style={{
        "--scale": scale,
        "--rarity": rarityAccent,
        "--type": typeAccent,
        /* Rarity-badge ramp. The mid stop sits under the white label text, so
           it is darkened rather than set to the raw accent: the light accents
           (Common #9cfce9) measured 1.20:1 against white and were unreadable.
           At -50% every rarity clears 4.5:1 while keeping its hue. */
        "--meta-top": data.frameMetaTop || "86.6%",
        "--effect-ink": effectTone.ink,
        "--r-lite": rarityAccent,
        "--r-mid": shade(rarityAccent, -50),
        "--r-dark": shade(rarityAccent, -72),
      }}
    >
      <style>{CARD_STYLES}</style>
      <style>{CLASSIC_STYLES}</style>

      {/* The flip lives on its own wrapper so it can run slow (700ms) while
          the tilt on .tc-card stays snappy. It is a plain div unless the
          card has a back. */}
      <div
        className={`tc-flip${hasBack ? " has-back" : ""}${hasBack && flipped ? " is-flipped" : ""}`}
        style={hasBack ? { "--flip": flipped ? "180deg" : "0deg" } : undefined}
      >
      <div
        ref={cardElRef}
        className={`tc-card tc-card--${templateStyle}${overlayImage ? " is-overlaid" : ""}${data.frameImage ? " is-framed" : ""}${BADGE_STYLE === "ticket" ? " is-ticket" : ""}${plain ? " is-plain" : ""}${isPrint ? " is-print" : ""}${hasBack ? " has-back" : ""}`}
        data-foil={foilTier}
        data-bg-foil={bgFoil}
        data-bg-scope={bgScope}
        data-shine={shineMode}
        data-shine-blend={shineBlend}
        data-plate={foilPlate ? "on" : "off"}
        data-fx-depth={fxDepth > 0 && fxLayers.length > 0}
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
          // Normalised 0..1 pointer position. The background recipes offset
          // their texture layers by these rather than by --mx/--my, so the
          // textures drift at a different rate than the gradients do — that
          // mismatch is what sells the layers as separate depths.
          "--pointer-from-left": tilt.mx / 100,
          "--pointer-from-top": tilt.my / 100,
          "--seedx": foilSeed.x,
          "--seedy": foilSeed.y,
          "--shine-strength": data.shineStrength ?? 1,
          "--foil-plate": foilPlate ? `url("${foilPlate}")` : "none",
        }}
      >
        <div className="tc-card-face">
          {isPrint ? (
            <img
              className="tc-print"
              src={data.printImage}
              alt={data.name || ""}
              draggable={false}
              decoding="async"
            />
          ) : templateStyle === "classic" ? (
            <ClassicFrame
              data={data}
              tilt={tilt}
              interactive={interactive}
              motionEnabled={motionEnabled}
              typeAccent={typeAccent}
              rarityAccent={rarityAccent}
              headline={headline}
            />
          ) : (
          <>
          <div className="tc-body-fill" />
          {/* Background foil. Deliberately at z 2: the frame content sits at
              z 5 and the art window paints its own opaque backing, so this
              shows through only where the card body shows — a reverse holo,
              without a hand-cut clip-path that would need re-cutting every
              time the frame grid reflows. */}
          <div className="tc-bg-holo" />

          {overlayImage && (
            <img
              className="tc-overlay"
              src={overlayImage}
              alt=""
              draggable={false}
              loading="lazy"
              decoding="async"
            />
          )}

          <div className="tc-frame">
            {/* ───── ART WINDOW (image + foil + floating overlays live here) ───── */}
            <div className="tc-art-window" ref={artWindowRef}>
              <CardArtwork
                data={data}
                tilt={tilt}
                interactive={interactive}
                motionEnabled={motionEnabled}
                className="tc-art"
                defaultZoom={1.55}
              />
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
                  ) : BADGE_STYLE === "ticket" ? (
                    <TimeStamp style={{ "--effect-ink": "var(--r-lite)" }} tilt="left">
                      {TICKET_LABELS[String(data.cardType).toLowerCase()] || data.cardType}
                    </TimeStamp>
                  ) : (
                    <ObliqueLabel
                      variant="type"
                      style={badgeTone === "silver" ? { "--label-grad": LABEL_GRADIENTS.typeSilver } : undefined}
                    >
                      {data.cardType}
                    </ObliqueLabel>
                  )}
                </div>

                <div className={`tc-title${titleFit.oneLine ? " tc-title--oneline" : ""}`} style={{ "--title-size": `${titleFit.size}px` }}>
                  <h1>{data.name}</h1>
                  {data.subtitle && (
                    <span className="tc-subtitle">{data.subtitle}</span>
                  )}
                </div>

                {statPair && (
                  <div className="tc-stat-pair">
                    {statPair.map((stat, index) => (
                      <div
                        key={stat.label}
                        className={index === 0 ? "tc-cred" : "tc-portfolio"}
                        title={stat.title}
                      >
                        <span>{stat.label}</span>
                        <strong>
                          {stat.value}
                          {stat.suffix && <em>{stat.suffix}</em>}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ───── FLOATING BOTTOM OVERLAY (rarity tag only) ───── */}
              <div className="tc-art-bottom">
                {BADGE_STYLE === "ticket" ? (
                  <TimeStamp style={{ "--effect-ink": "var(--r-lite)" }} small>
                    <RarityGlyph rarity={data.rarity} />
                  </TimeStamp>
                ) : (
                  <ObliqueLabel variant="rarity">{data.rarity}</ObliqueLabel>
                )}
                {BADGE_STYLE === "ticket" && (
                  /* Collector number: replaces the EDITION/STYLE/RARITY/SET
                     strip (2026-10-16), which was unreadable under the FX.
                     Rarity is the glyph opposite; style/set live in the
                     set badge and the card data. */
                  <span className="tc-collector" title={`${data.style} · Genesis`}>
                    {String(data.edition).toUpperCase()}
                  </span>
                )}
              </div>

              <div className="tc-art-inset" />
            </div>

            {/* ───── ABILITY (image badge OR oblique-label fallback) ───── */}
            {data.ability && (
              <section className={`tc-ability${BADGE_STYLE === "ticket" && !data.ability.badgeImage ? " tc-ability--inline" : ""}`}>
                {/* Ticket style seats the stamp inline, just left of the
                    heading, so the pair reads as one connected mark
                    (2026-10-16). Image badges keep the side column. */}
                {!(BADGE_STYLE === "ticket" && !data.ability.badgeImage) && (
                  <div className="tc-ability-badge">
                    {data.ability.badgeImage ? (
                      <img
                        className="tc-ability-badge-img"
                        src={data.ability.badgeImage}
                        alt="Effect"
                        draggable={false}
                      />
                    ) : (
                      <ObliqueLabel variant="ability" style={{ "--label-grad": effectTone.grad }}>
                        Effect
                      </ObliqueLabel>
                    )}
                  </div>
                )}
                <div className="tc-ability-body">
                  {BADGE_STYLE === "ticket" && !data.ability.badgeImage ? (
                    <div className="tc-ability-head">
                      <TimeStamp style={{ "--label-grad": effectTone.grad }}>
                        {STAMP_LABELS[String(data.cardType).toLowerCase()] || "Filled"}
                      </TimeStamp>
                      <h2>{data.ability.name}</h2>
                    </div>
                  ) : (
                    <h2>{data.ability.name}</h2>
                  )}
                  <p>{data.ability.text}</p>
                </div>
              </section>
            )}

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

            {/* ───── BATTLE STRIP (renders only when battle data is set) ───── */}
            {(data.weakness || data.resistance || data.pivotCost) && (
              <footer className="tc-battle">
                <div className="tc-battle-stat">
                  <span>weakness</span>
                  <strong>{data.weakness || "—"}</strong>
                </div>
                <div className="tc-battle-sep" />
                <div className="tc-battle-stat">
                  <span>resistance</span>
                  <strong>{data.resistance || "—"}</strong>
                </div>
                <div className="tc-battle-sep" />
                <div className="tc-battle-stat">
                  <span>pivot cost</span>
                  <strong className="tc-battle-bolts">
                    {Array.from({ length: data.pivotCost || 0 }).map((_, i) => (
                      <span key={i}>⚡</span>
                    ))}
                  </strong>
                </div>
              </footer>
            )}

            <div className="tc-meta">
              <span>
                <em>Edition</em>
                <b>{data.edition}</b>
              </span>
              <span>
                <em>Style</em>
                <b>{data.style}</b>
              </span>
              <span
                className={`tc-meta-rarity${String(data.rarity || "").length > 8 ? " tc-meta-rarity--long" : ""}`}
                style={{ "--r": rarityAccent }}
              >
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
          </>
          )}

          {/* Set mark, printed over the art like a TCG set logo. */}
          {data.setBadge && (
            <img className="tc-set-badge" src={data.setBadge} alt="" draggable={false} decoding="async" />
          )}

          {/* Rarity frame, then FX on top of it — the frames are borders with a
              transparent centre, so they sit above the art without hiding text.
              Both are outside the template branch so Terminal + Classic share
              them. */}
          {/* NOT lazy: these are absolutely positioned inside the card's
              scale() transform, and Chrome's lazy-load intersection check does
              not fire reliably there — at collection-grid scale the frames
              simply never loaded. Only 4 frame files exist set-wide, so they
              cache after the first card and cost nothing to load eagerly. */}
          {data.frameImage && (
            <img className="tc-cardframe" src={data.frameImage} alt="" draggable={false}
                 decoding="async" />
          )}

          {cornerBadge && (
            <div className="tc-corner-badge" aria-hidden="true">
              <span>{cornerBadge}</span>
            </div>
          )}

          {/* Refraction, then specular. Both sit above every printed layer
              (frame art is z 12, FX z 13) so they read as light landing ON
              the card rather than as ink IN it. */}
          <div className="tc-card-shine" />
          <div className="tc-card-glare" />
        </div>

        {/* Printed back: a second plane rotated 180° behind the face. Both
            planes hide their backface, so the flip wrapper shows exactly one. */}
        {hasBack && (
          <div className="tc-card-back" aria-hidden={!flipped}>
            <img
              className="tc-print"
              src={data.backImage}
              alt=""
              draggable={false}
              decoding="async"
            />
          </div>
        )}

        {/* Unclipped siblings of the printed face: each FX sheet has its own
            depth and follows the tilt, opposite to the artwork's small drift. */}
        {fxLayers.map((fx, i) => {
          const depth = fxDepth * (40 + i * 18);
          const travel = fxDepth * (10 + i * 4);
          const planeStyle = {
            "--fx-z": `${depth}px`,
            "--fx-x": `${(tilt.ry / 9) * travel}px`,
            "--fx-y": `${(-tilt.rx / 7) * travel}px`,
            // Compensate perspective enlargement to keep FX near the border.
            "--fx-scale": 1 - depth / 1400,
            zIndex: 13 + i,
          };
          const reflection = motionEnabled && data.fxReflection?.src === fx && data.fxReflection.facets?.length
            ? data.fxReflection : null;
          const shineStrength = reflection ? Math.max(0, Math.min(1.5, reflection.strength ?? 1)) : 0;
          const material = fxMaterial(reflection?.material);
          const hueRotation = ((tilt.ry / 9) * material.baseHueShift[0]
            + (-tilt.rx / 7) * material.baseHueShift[1]) * shineStrength;
          return (
            <React.Fragment key={`${fx}-${i}`}>
              <img
                className="tc-fx"
                src={fx}
                alt=""
                draggable={false}
                decoding="async"
                style={{
                  ...planeStyle,
                  mixBlendMode: data.fxBlend || "screen",
                  opacity: data.fxOpacity ?? 0.55,
                  // Color belongs to the same FX pixels, even between flashes.
                  filter: hueRotation ? `hue-rotate(${hueRotation}deg)` : undefined,
                }}
              />
              {reflection && (
                <FxReflection
                  reflection={reflection}
                  tilt={tilt}
                  planeStyle={planeStyle}
                  opacity={data.fxOpacity ?? 0.55}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
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
  @import url('https://fonts.googleapis.com/css2?family=Lilita+One&family=Bowlby+One&family=Russo+One&family=Anton&family=Concert+One&family=Cinzel+Decorative:wght@700;900&family=Caesar+Dressing&display=swap');

  .tc-stage {
    --w: 744px;
    --h: 1038px;
    width: calc(var(--w) * var(--scale, 1));
    height: calc(var(--h) * var(--scale, 1));
    perspective: 1400px;
    perspective-origin: 50% 35%;
    /* Contain glow blending at the scene boundary, not on the 3D rotator. */
    isolation: isolate;
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
    transform-style: flat;
    transition: transform 180ms cubic-bezier(.2,.7,.2,1), box-shadow 220ms ease;
    border-radius: 32px;
    color: #effff9;
    box-shadow:
      0 calc(28px + 24px * var(--lift, 0)) calc(60px + 50px * var(--lift, 0)) rgba(0,0,0,.55),
      0 0 0 1px rgba(255,255,255,.04),
      0 0 0 12px #1a1207,
      0 0 0 13px #d9b44a,
      0 0 0 14px #8a6a1a,
      0 0 60px color-mix(in srgb, var(--rarity) calc(22% + 18% * var(--lift, 0)), transparent);
  }

  .tc-card[data-fx-depth="true"] { transform-style: preserve-3d; }

  /* ── Flip ── The wrapper carries the slow half-turn; the card inside keeps
     its fast tilt. Face and back are coplanar with hidden backfaces, so each
     half of the turn shows exactly one of them. Both need preserve-3d from
     the wrapper down, or the back would flatten into a mirrored face. */
  .tc-flip.has-back {
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transform: rotateY(var(--flip, 0deg));
    transition: transform 700ms cubic-bezier(.4, .1, .2, 1);
  }
  .tc-card.has-back { transform-style: preserve-3d; }
  .tc-card.has-back .tc-card-face,
  .tc-card-back {
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
  }
  /* WebKit ignores the hidden backface here (it painted the back, mirrored,
     over the face), so the planes are also separated in depth: the face sits
     2px proud and wins the depth sort until the wrapper turns it away. */
  .tc-card.has-back .tc-card-face { transform: translateZ(2px); }
  /* And a third guard that needs no 3D sorting at all: each plane is only
     visible on its own half of the turn. The wrapper's ease (.4,.1,.2,1)
     passes 90° at ~33% of its 700ms, so the swap is delayed 235ms, not 350,
     to land where both planes are edge-on. Retune if the ease changes. */
  .tc-card.has-back .tc-card-face,
  .tc-card.has-back .tc-fx,
  .tc-card.has-back .tc-fx-reflection,
  .tc-card-back { transition: visibility 0s 235ms; }
  .tc-flip.has-back:not(.is-flipped) .tc-card-back { visibility: hidden; }
  .tc-flip.is-flipped .tc-card-face,
  .tc-flip.is-flipped .tc-fx,
  .tc-flip.is-flipped .tc-fx-reflection { visibility: hidden; }
  .tc-card-back {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    overflow: hidden;
    background: #0a0805;
    transform: rotateY(180deg);
  }

  /* ── Print layout ── the image is the whole face. Same cover crop on the
     back, which shares the master's aspect. */
  .tc-print {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: 1;
    pointer-events: none;
    user-select: none;
  }

  /* ── Plain ── data.effects === "off": every overlay effect gone, ink only.
     Belt and braces with the JS (fxLayers/bgFoil/shine are also zeroed), so
     a stray data-* attribute can't bring a layer back. */
  .tc-card.is-plain .tc-bg-holo,
  .tc-card.is-plain .tc-foil,
  .tc-card.is-plain .tc-shine,
  .tc-card.is-plain .tc-art-inner-vignette,
  .tc-card.is-plain .tc-card-shine,
  .tc-card.is-plain .tc-card-glare,
  .tc-card.is-plain .tc-fx,
  .tc-card.is-plain .tc-fx-reflection { display: none !important; }

  /* Clip and composite the printed card on its own plane. overflow:hidden or
     isolation:isolate on .tc-card would flatten the raised FX back into it. */
  .tc-card-face {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    overflow: hidden;
    isolation: isolate;
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

  /* Frame and FX share the same sizing, but FX live above the printed face.
     Both are object-fit: fill like .tc-overlay, since the frame art is
     1488x2083 against the card's 1488x2076 (a ~7px difference that would
     otherwise letterbox the border). */
  .tc-cardframe,
  .tc-fx,
  .tc-fx-reflection {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: fill;
    pointer-events: none;
    user-select: none;
    border-radius: inherit;
  }

  /* The frame is the OUTERMOST printed layer, above the art window and the
     content layer — like a real card, where everything lives inside the
     frame's window. An earlier version put it below .tc-frame, which meant
     the opaque art window covered all but a ~2px slice of the border band;
     at small scales rounding erased even that and the frame looked absent.
       12 .tc-cardframe — rarity border, over art and content
       13 .tc-fx        — composites over art AND frame, as specced
     Content never collides with it because .is-framed widens the padding
     below to clear the band. */
  .tc-cardframe { z-index: 12; }
  .tc-fx { z-index: 13; }

  .tc-card[data-fx-depth="true"] .tc-fx,
  .tc-card[data-fx-depth="true"] .tc-fx-reflection {
    transform: translate3d(var(--fx-x), var(--fx-y), var(--fx-z)) scale(var(--fx-scale));
    transform-origin: 50% 35%;
    transition: transform 180ms cubic-bezier(.2,.7,.2,1);
  }

  .tc-card[data-fx-depth="true"] .tc-fx {
    /* Feather the sheet edges so moving past the frame never reveals a hard
       rectangular image boundary. Masking is safe here on a leaf element. */
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 2%, #000 98%, transparent),
                        linear-gradient(0deg, transparent, #000 1.5%, #000 98.5%, transparent);
    -webkit-mask-composite: source-in;
    mask-image: linear-gradient(90deg, transparent, #000 2%, #000 98%, transparent),
                linear-gradient(0deg, transparent, #000 1.5%, #000 98.5%, transparent);
    mask-composite: intersect;
  }

  /* Stamp knock-outs (BADGE_STYLE = "ticket"). The FX sheets are raised
     planes (translateZ), so no z-index puts a stamp above them; instead the
     foil is masked out in four soft ellipses where the stamps sit, so flames
     and lightning curl around the ink like a real stamp pressed over foil.
     Centres/radii measured against the card box (2026-10-16): type stamp
     (14%,5.5%), stat pair (85%,7%), ability heading row — stamp + title,
     centred, so a wide band at (50%,72.5%) — rarity stamp (12.5%,95%),
     collector number (90%,95.5%), and a wide band at (50%,87.4%) for the
     flavor quote that now sits in the divider slot. Each
     hole is ~4% larger than its stamp to cover the sheet's parallax drift.
     Feather layers are repeated so this rule fully replaces the depth one. */
  .tc-card.is-ticket .tc-fx {
    -webkit-mask-image:
      linear-gradient(90deg, transparent, #000 2%, #000 98%, transparent),
      linear-gradient(0deg, transparent, #000 1.5%, #000 98.5%, transparent),
      radial-gradient(15% 6.5% at 14% 5.5%, transparent 45%, #000 100%),
      radial-gradient(14% 7% at 85% 7%, transparent 50%, #000 100%),
      radial-gradient(44% 8% at 50% 72.5%, transparent 55%, #000 100%),
      radial-gradient(11% 4.5% at 12.5% 95%, transparent 45%, #000 100%),
      radial-gradient(9% 3.5% at 90% 95.5%, transparent 45%, #000 100%),
      radial-gradient(48% 7% at 50% 87.4%, transparent 72%, #000 100%);
    -webkit-mask-composite: source-in;
    mask-image:
      linear-gradient(90deg, transparent, #000 2%, #000 98%, transparent),
      linear-gradient(0deg, transparent, #000 1.5%, #000 98.5%, transparent),
      radial-gradient(15% 6.5% at 14% 5.5%, transparent 45%, #000 100%),
      radial-gradient(14% 7% at 85% 7%, transparent 50%, #000 100%),
      radial-gradient(44% 8% at 50% 72.5%, transparent 55%, #000 100%),
      radial-gradient(11% 4.5% at 12.5% 95%, transparent 45%, #000 100%),
      radial-gradient(9% 3.5% at 90% 95.5%, transparent 45%, #000 100%),
      radial-gradient(48% 7% at 50% 87.4%, transparent 72%, #000 100%);
    mask-composite: intersect;
  }

  /* Add light to the existing texture. Both passes use its luminance/alpha;
     transparent areas cannot produce a free-floating sparkle. Blur AFTER the
     mask so only light from the texture spreads into its surroundings. */
  .tc-fx-reflection { mix-blend-mode: plus-lighter; }

  .tc-fx-material,
  .tc-fx-bloom {
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }

  .tc-fx-material {
    -webkit-mask-image: var(--fx-mask),
      linear-gradient(90deg, transparent, #000 2%, #000 98%, transparent),
      linear-gradient(0deg, transparent, #000 1.5%, #000 98.5%, transparent);
    -webkit-mask-composite: source-in, source-in;
    mask-image: var(--fx-mask),
      linear-gradient(90deg, transparent, #000 2%, #000 98%, transparent),
      linear-gradient(0deg, transparent, #000 1.5%, #000 98.5%, transparent);
    mask-mode: luminance, alpha, alpha;
    mask-composite: intersect;
    -webkit-mask-size: 100% 100%;
    mask-size: 100% 100%;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    background: var(--fx-emission);
  }

  .tc-fx-bloom {
    filter: blur(var(--fx-bloom-radius)) brightness(var(--fx-bloom-brightness));
  }

  .tc-fx-bloom .tc-fx-material { background: var(--fx-bloom); }

  @media (prefers-reduced-motion: reduce) {
    .tc-card, .tc-art, .tc-art-layer, .tc-fx { transition: none !important; }
    .tc-card { transform: scale(var(--scale, 1)); }
    .tc-fx-reflection { display: none; }
    .tc-card[data-fx-depth="true"] .tc-fx { transform: none; mask-image: none; }
  }

  /* Set mark: right-aligned over the art, above the art window (which sits in
     .tc-frame at z 5) but below the frame border and FX. Width is a % of the
     card so it holds at thumbnail scale; the asset is 2.40:1, so 34% wide
     lands it about 10% tall. */
  .tc-set-badge {
    position: absolute;
    right: 2.2%;
    top: 30%;
    width: 33%;
    height: auto;
    z-index: 8;
    pointer-events: none;
    user-select: none;
    filter: drop-shadow(0 4px 10px rgba(0,0,0,.6));
  }

  /* A framed card draws its border from the frame art, so the template's own
     edge treatments have to stand down — same idea as .is-overlaid. Critically
     .tc-art-window's OUTER drop shadow (0 12px 32px) spreads ~13px past the
     art at render scale and, with .tc-frame above the frame image, blanketed
     the whole ~11px border band. Inset shadows stay; only the outer one goes. */
  .tc-card.is-framed .tc-edge { display: none; }
  .tc-card.is-framed .tc-art-inset { display: none; }
  /* Corner brackets belong to the frameless template; against a frame the
     top-right one poked out from behind the stat boxes as a stray fragment. */
  .tc-card.is-framed .tc-art-corner { display: none; }

  /* The frame art's border band is 55/1488 of the card = ~27.5px at scale 1.
     Content has to clear it or the frame (z 12) paints over it.
     .tc-art-top / .tc-art-bottom are absolutely positioned at 22px and do NOT
     inherit .tc-frame's padding — that 22px sits INSIDE the band, which is
     what clipped the type and rarity badges. Both need their own offsets. */
  /* The frame art prints two divider lines at 85.4-86.0% and 89.1-89.8% of
     card height, with a slot between them. Content is pulled up so the
     ability box ends above the first line and .tc-meta sits inside the slot —
     the arrangement the frame was drawn for. The art row is 1fr, so the extra
     bottom padding is what shrinks it. */
  .tc-card.is-framed .tc-frame {
    padding: 34px 40px 166px;
    /* Only the art row is declared; the rest come from implicit auto rows.
       The base template declares six rows, so a card using three of them
       still paid for the gaps of the three empty ones — which is why the
       effect box ended 1.2% lower on Traders (3 rows) than Actions (2). With
       implicit rows, the last row always ends at the content bottom, so the
       effect lands at the same height on every card type. */
    grid-template-rows: minmax(0, 1fr);
  }

  /* Flavor quote moves above the effect box (2026-07-21) so the effect can
     bottom-anchor just above the frame's divider bars on Traders and Coins,
     matching Actions, which carry no quote. */
  .tc-card.is-framed .tc-ability { order: 1; }
  /* Pinned, not flowed: trader and action cards have different row stacks, so
     a flow-based offset lands the meta line in the slot for one and across a
     divider for the other. Percentage is of the card box (.tc-frame is inset
     0), so this holds at every scale. */
  .tc-card.is-framed .tc-meta {
    position: absolute;
    /* Per-frame: each frame prints its divider slot at a different height
       (see FRAMES[].metaTop in cardFrames.js). */
    top: var(--meta-top, 86.6%);
    left: 40px;
    right: 40px;
    margin: 0;
  }

  /* The frame prints a decorative seam across the divider at 58.0-59.5% of
     card width, which the RARITY label ran straight into. space-between put
     each item at a position that depended on the text widths either side of
     it, so rarity landed anywhere from 51.7% to 58.5% depending on the card.
     Fixed columns pin it past the seam for every card instead. */
  .tc-card.is-framed .tc-meta {
    display: grid;
    grid-template-columns: 26% 36.3% 21.6% 16.1%;
    gap: 0;
  }

  /* One line, always. "Terminal Foil" is long enough to wrap inside its
     column, which doubled the row height and pushed it out of the slot. */
  .tc-card.is-framed .tc-meta > span { white-space: nowrap; }

  /* ...and with wrapping off, that same long name overran into SET. Scoped to
     long rarity names (only the 3 terminal foils) so the other 77 cards keep
     a meta line at one consistent size. Absolute px, not em: .tc-meta span
     sets 13px, but an em here resolves against the card's inherited size and
     computed UP to 14px. */
  .tc-card.is-framed .tc-meta > span.tc-meta-rarity--long { font-size: 10px; }
  .tc-card.is-framed .tc-art-top { top: 36px; left: 40px; right: 40px; }
  .tc-card.is-framed .tc-art-bottom { bottom: 36px; left: 40px; right: 40px; }

  /* Ticket style retires the meta strip; the collector number carries the
     edition in the corner. The frame's printed divider bars stay as a band. */
  .tc-card.is-ticket .tc-meta { display: none; }

  /* The flavor quote takes the strip's slot (2026-10-16): pinned to the
     frame's divider band under the ability block, so the portrait keeps the
     room the quote used to float in. Centred on the slot via translateY;
     the band's bars are being re-exported out of the frame art. */
  .tc-card.is-ticket.is-framed .tc-flavor {
    position: absolute;
    top: calc(var(--meta-top, 86.6%) + 0.8%);
    left: 40px;
    right: 40px;
    bottom: auto;
    transform: translateY(-50%);
    max-width: none;
    width: fit-content;
    margin: 0 auto;
    padding: 6px 22px 8px;
    font-size: 23px;
    line-height: 1.3;
    z-index: 7;
    /* The frame's printed gold bars do the framing here, so the plate is
       stripped to a plain backing: no hairline, no corners, no lift — just a
       dark wash that fades out sideways under the bars. */
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: linear-gradient(90deg, rgba(8,5,2,0) 0%, rgba(8,5,2,.42) 12%, rgba(8,5,2,.42) 88%, rgba(8,5,2,0) 100%);
  }
  .tc-collector {
    font-family: "IBM Plex Mono", "SF Mono", Menlo, monospace;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: .14em;
    color: rgba(247, 239, 220, .88);
    text-shadow:
      0 0 2px rgba(0,0,0,.95),
      0 0 6px rgba(0,0,0,.85),
      0 1px 3px rgba(0,0,0,.8);
    align-self: end;
    padding-bottom: 2px;
  }
  .tc-card.is-framed .tc-art-window {
    box-shadow:
      inset 0 0 0 2px rgba(0,0,0,.65),
      inset 0 0 0 3px color-mix(in srgb, var(--rarity) 60%, #d9b44a 40%),
      inset 0 0 60px rgba(0,0,0,.5);
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
     Sits inside the printed face so it inherits the card's tilt + scale;
     the face's overflow:hidden + 32px border-radius clip the tail. */
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

  .tc-art-layer {
    pointer-events: none;
    user-select: none;
    transition: transform 180ms cubic-bezier(.2,.7,.2,1);
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

    /* ── centerMask, ported from the diamond-foil shader ──────────────────
       The shader keeps the middle of the card clean and lets the foil rule
       the edges: smoothstep(0.12, 0.52, dist) fed through mix(0.4, 1.0, …).
       Same curve here. The gradient's 0→100% spans 52% of the box, so the
       shader's 0.12 inner stop lands at 12/52 ≈ 23% along it.
       Earns more here than it does in the shader: the title, stat pair and
       rarity tag float directly on the art, so this buys text contrast as
       well as a look.
       Centred at 42%, not 50%, because .tc-foil spans the whole .tc-frame —
       .tc-art-window never became a containing block (its position:relative
       is commented out below) — so 50% would land in the ability box
       instead of in the artwork. Applies to every foil tier; the mask is
       independent of the background stack. */
    --foil-center: .4;
    -webkit-mask-image: radial-gradient(
      ellipse 52% 52% at 50% 42%,
      rgba(0,0,0,var(--foil-center)) 23%,
      #000 100%
    );
    mask-image: radial-gradient(
      ellipse 52% 52% at 50% 42%,
      rgba(0,0,0,var(--foil-center)) 23%,
      #000 100%
    );
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
    /* Plain Black has tall ascenders — push the title down so they clear
       the frame's top edge */
    padding-top: 18px;
  }

  @font-face {
    font-family: "Plain Black";
    src: url("/fonts/PlainBlack/Plain_Black.woff2") format("woff2");
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }

  .tc-title--oneline h1 { white-space: nowrap; }

  .tc-title h1 {
    margin: 0;
    font-family: "Plain Black", "Bebas Neue", "Oswald", Impact, sans-serif;
    font-size: var(--title-size, 70px);
    line-height: .82;
    font-weight: 900;
    letter-spacing: .03em;
    /* Ivory on a deep-gold edge (2026-10-16). Was lime #d9ef13 on white —
       once the ability name moved to Nabla's yellow-orange, two warm yellows
       fought for the eye. The title now reads as parchment blackletter and
       cedes the saturated colour to the ability line. */
    color: #f7efdc;
    -webkit-text-stroke: 4px #8a6414;
    paint-order: stroke fill;
    text-shadow:
      0 1px 0 #5a3f0a,
      0 4px 10px rgba(0,0,0,.6),
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

  /* Stat chips as time-stamps (BADGE_STYLE = "ticket"): the same double-
     ruled ink box as the badges, one ink per stat, number set in the ink so
     the whole chip reads as pressed. Tilts mirror each other. */
  .tc-card.is-ticket .tc-cred,
  .tc-card.is-ticket .tc-portfolio {
    width: 66px;
    height: 60px;
    border-radius: 6px;
    border-width: 2.5px;
    background: rgba(0,0,0,.28);
    box-shadow:
      inset 0 0 0 3px transparent,
      inset 0 0 0 4px var(--stamp-ink),
      0 3px 8px rgba(0,0,0,.45);
    -webkit-mask-image: radial-gradient(120% 90% at 42% 55%, #000 55%, rgba(0,0,0,.55) 100%);
            mask-image: radial-gradient(120% 90% at 42% 55%, #000 55%, rgba(0,0,0,.55) 100%);
    row-gap: 0;
  }
  .tc-card.is-ticket .tc-cred      { --stamp-ink: #d9b44a; transform: rotate(-2deg); }
  .tc-card.is-ticket .tc-portfolio { --stamp-ink: #53ffd6; transform: rotate(2deg); }
  .tc-card.is-ticket .tc-cred span,
  .tc-card.is-ticket .tc-portfolio span {
    color: var(--stamp-ink);
    font-weight: 700;
    letter-spacing: .24em;
    padding-top: 4px;
  }
  .tc-card.is-ticket .tc-cred strong,
  .tc-card.is-ticket .tc-portfolio strong {
    font-family: "IBM Plex Mono", "SF Mono", Menlo, monospace;
    font-weight: 700;
    font-size: 24px;
    color: var(--stamp-ink);
    text-shadow: 0 0 6px rgba(0,0,0,.6);
    padding-bottom: 4px;
  }
  .tc-card.is-ticket .tc-portfolio strong em {
    color: var(--stamp-ink);
    opacity: .75;
  }

  /* ───── OBLIQUE LABELS (parallelogram, leaning right) ───── */
  /* ───── TIME-STAMP BADGES (BADGE_STYLE = "ticket") ───── */
  /* Time-stamp: double-ruled ink box, lens-coloured ink, worn with a
     radial mask so it reads as pressed onto the ticket, not printed. */
  .tc-stamp {
    display: inline-block;
    padding: 3px;
    border: 2.5px solid var(--effect-ink, #07ddf0);
    border-radius: 6px;
    transform: rotate(-5deg);
    background: rgba(0,0,0,.28);
    box-shadow: 0 3px 8px rgba(0,0,0,.45);
    -webkit-mask-image: radial-gradient(120% 90% at 42% 55%, #000 55%, rgba(0,0,0,.55) 100%);
            mask-image: radial-gradient(120% 90% at 42% 55%, #000 55%, rgba(0,0,0,.55) 100%);
  }
  .tc-stamp__inner {
    display: block;
    padding: 4px 16px;
    border: 1px solid var(--effect-ink, #07ddf0);
    border-radius: 3px;
    font-family: "IBM Plex Mono", "SF Mono", Menlo, monospace;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: .26em;
    text-transform: uppercase;
    color: var(--effect-ink, #07ddf0);
    text-shadow: 0 0 6px rgba(0,0,0,.6);
  }

  /* Type stamp (top-left): full size, rarity ink, tilted a touch less than
     the ability stamp so the three never line up. */
  .tc-stamp--tilt-left { transform: rotate(-3deg); }

  /* Rarity stamp: same object, smaller, inked in the rarity colour and
     tilted the other way so the stamps don't read as a pattern. */
  .tc-stamp--small {
    transform: rotate(3deg);
    border-width: 2px;
    padding: 2px;
  }
  .tc-stamp--small .tc-stamp__inner {
    padding: 2px 10px;
    font-size: 13px;
    letter-spacing: .22em;
  }
  .tc-rglyph {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 26px;
    margin: 1px 0;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,.7));
  }
  .tc-ricon {
    position: relative;
    display: inline-block;
    flex: none;
  }
  .tc-ricon::before,
  .tc-ricon::after {
    content: "";
    position: absolute;
    inset: 0;
    -webkit-mask: var(--icon) center / contain no-repeat;
            mask: var(--icon) center / contain no-repeat;
  }
  .tc-ricon::before { background: var(--side); transform: translate(1px, 1.4px); }
  .tc-ricon::after  { background: linear-gradient(135deg, var(--lit) 0%, var(--lit) 42%, var(--shade) 58%, var(--shade) 100%); }
  .tc-rgrail { display: block; }

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
  .tc-ob--ability .tc-ob__inner { padding: 8px 30px; font-size: 19px; letter-spacing: .14em; }
  .tc-ob--move .tc-ob__inner    { padding: 4px 20px; font-size: 11px; letter-spacing: .16em; }
  .tc-ob--rarity .tc-ob__inner  { padding: 5px 22px; font-size: 13px; letter-spacing: .18em; }

  /* ───── ABILITY (pin + body) ───── */
  .tc-ability {
    position: relative;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 18px;
    /* Top-aligned, not centred: centring measured the badge against the whole
       body column, so a two-line effect text pushed the badge ~7px below its
       heading while a one-line text sat level. The badge is nudged down by
       .tc-ability-badge's margin instead, which keys off the heading only. */
    align-items: start;
    padding: 14px 20px 16px;
    /* No panel — the ability reads directly on the art (2026-07-21). The
       h2 already carries a white text-stroke and the p its own scrim, so
       both stay legible without a box. */
    background: none;
    border-radius: 14px;
    border: 0;
    box-shadow: none;
  }

  /* Image badge slot — falls back to parallelogram ObliqueLabel */
  .tc-ability-badge {
    display: grid;
    place-items: center;
    min-width: 110px;
    flex-shrink: 0;
    /* Keyed to .tc-ability-body's 28px padding-top, less half the difference
       between the heading's 36px line box and the badge's height. Aligns to
       the heading's FIRST LINE, not its centre — Oracle Crosscheck's
       "Cross-Reference · LOGOS + ETHOS" wraps to two lines, and centring
       against the whole heading pushed the badge 5.5px too high there. */
    margin-top: 27px;
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

  /* Inline stamp + heading, centred as one unit over the description. */
  .tc-ability--inline .tc-ability-body { padding-top: 16px; }
  .tc-ability-head {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    margin: 0 0 8px;
  }
  .tc-ability-head .tc-stamp { flex: none; }
  .tc-ability-head h2 { margin: 0; }

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

  @font-face {
    font-family: "Nabla";
    src: url("/fonts/Nabla-Regular.ttf") format("truetype");
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }

  .tc-ability h2 {
    margin: 0 0 8px;
    /* Centred over the description (2026-10-16). The paragraph below is
       centred by the global p rule, so a left-set heading read as misaligned
       beside the stamp. */
    text-align: center;
    /* Swap the first family to try alternatives:
       "Lilita One" | "Bowlby One" | "Russo One" | "Anton" | "Concert One" */
    /* Caesar Dressing is a single-weight display face; "Cinzel Decorative"
       stays as the fallback so the ivory/gold treatment still lands offline. */
    /* Nabla is a COLRv1 colour font: it paints its own gradient + 3D
       extrusion, so the color and text-stroke below only reach the fallbacks.
       Depth/highlight tune via font-variation-settings (EDPT 0–200, EHLT 0–24). */
    font-family: "Nabla", "Caesar Dressing", "Cinzel Decorative", Georgia, serif;
    font-size: 38px;
    line-height: 1.05;
    font-weight: 400;
    font-variation-settings: "EDPT" 100, "EHLT" 12;
    /* Ivory lettering on a gold outline (2026-10-16). The effect tone no
       longer tints the heading — the EFFECT badge alone carries the lens
       colour — so the ability name reads as engraved plate text instead of
       a second colour chip. Stroke sits behind the fill (paint-order), so
       4px shows ~2px of gold edge. */
    color: #f7efdc;
    letter-spacing: .04em;
    -webkit-text-stroke: 4px #c9972e;
    paint-order: stroke fill;
    /* Tight dark halo so the gold edge still separates on gold-toned art
       (Connor's mosaic); the soft drop keeps the lift on busy flame art. */
    text-shadow:
      0 1px 0 #7a5a12,
      0 0 2px rgba(0,0,0,.95),
      0 0 6px rgba(0,0,0,.85),
      0 3px 10px rgba(0,0,0,.7);
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
    /* Positioned, like .tc-ability. Without this the quote is in-flow static
       content, and every full-card absolutely-positioned layer above it —
       .tc-art (opaque, and it overflows the art window), .tc-art-inner-
       vignette, .tc-foil, .tc-shine — paints over it, so the text was laid
       out correctly and then buried. Positioned siblings paint after
       non-positioned ones in the same stacking context. */
    position: relative;
    /* Sits 14px lower than before (2026-10-16): the quote reads as part of
       the lower text block rather than floating mid-portrait. */
    bottom: 6px;
    width: fit-content;
    max-width: 92%;
    margin: 0 auto;
    padding: 8px 20px 10px;
    font-family: "Georgia", "Times New Roman", serif;
    font-style: italic;
    font-weight: 600;
    font-size: 28px;
    line-height: 1.35;
    color: #ffe9a8;
    text-align: center;
    /* Subtle translucent plate (2026-10-16), replacing the elliptical scrim:
       a soft rounded card of smoked glass that hugs the text, with a blur so
       busy art calms behind it and a hairline so its edge reads as intended
       rather than as a smudge. The lighter text-shadow is now just lift. */
    background: rgba(8, 5, 2, .38);
    border: 1px solid rgba(255, 233, 168, .14);
    border-radius: 14px;
    backdrop-filter: blur(3px);
    -webkit-backdrop-filter: blur(3px);
    box-shadow: 0 4px 14px rgba(0,0,0,.35);
    text-shadow:
      0 1px 3px rgba(0,0,0,.85),
      0 0 10px rgba(0,0,0,.5);
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

  /* ======================================================================
     CARD-LEVEL HOLO SYSTEM
     .tc-foil (above) foils the ARTWORK. These three foil the CARD:

       .tc-bg-holo     z 11  background foil, above the art, under the border
       .tc-card-shine  z 30  refraction - diffraction bands + iridescence
       .tc-card-glare  z 31  the wet specular highlight; nothing blends above

     All three run off the pointer vars the art foil already publishes
     (--mx/--my, --posx/--posy, --hyp, --lift) plus --pointer-from-left/top
     and a stable per-card --seedx/--seedy.

     Everything is display:none until data-bg-foil / data-shine turn it on,
     so cards that don't opt in pay nothing - these are expensive layers and
     the art foil already pushed iOS Safari's GPU ceiling once.

     Textures in public/TCG/foils/ are generated, not lifted from a published
     holo library - those are GPL-3.0 or third-party CDN assets, and neither
     belongs in a commercial brand repo.
     ====================================================================== */

  .tc-card {
    --foil-grain: url("/TCG/foils/rl80-grain.webp");
    --foil-glitter: url("/TCG/foils/rl80-glitter.webp");
    --foil-iri: url("/TCG/foils/rl80-iri.webp");
    --foil-noise: url("/TCG/foils/rl80-noise.webp");
    --foil-flakes: url("/TCG/foils/rl80-flakes.webp");
    /* The flake texture is 512px and the card is 744px wide, so ~69% renders
       it 1:1. Go much below that and the flakes are scaled under a pixel and
       average into flat grey - which looks like no glitter at all, not small
       glitter. Raise it for coarser flakes, never lower it for finer ones. */
    --flake-size: 68%;
    /* Width of the border ring, as a share of the card. Used only as the
       no-plate fallback for glitter. */
    --edge-inset: 4.6%;
    --glitter-warm: #ffd96b;
    --glitter-deep: #7a5410;

    /* Swap for any high-contrast single-shape SVG to change the background
       motif - it is used as a mask, so only its alpha matters. */
    --foil-motif: url("/TCG/frames/money2.svg");
    --foil-motif-size: 28%;
    --foil-motif-tile: 260px;

    /* The six angles a diffraction grating throws. */
    --sun-1: hsl(2, 100%, 73%);
    --sun-2: hsl(53, 100%, 69%);
    --sun-3: hsl(93, 100%, 69%);
    --sun-4: hsl(176, 100%, 76%);
    --sun-5: hsl(228, 100%, 74%);
    --sun-6: hsl(283, 100%, 73%);

    /* Band period for the diffraction ramp. Fixed in px, not %, so the bands
       stay fine at every --scale instead of fanning out on the big preview. */
    --sun-step: 7px;

    /* Art-window rect, written by the measurement effect. The fallbacks are
       the terminal frame's resting geometry, used for the first paint and
       for templates that have no art window at all. */
    --aw-x: 4.3%;
    --aw-y: 2.7%;
    --aw-r: 95.7%;
    --aw-b: 57%;

    /* Master dial, 0..1 - the card-template slider writes this. */
    --shine-strength: 1;
  }

  /* ----- Background foil -------------------------------------------------
     Clipped with a self-intersecting polygon: it walks the card's outer edge
     clockwise, then traces the art window counter-clockwise, which punches
     the window out under the nonzero fill rule. Same trick a reverse holo
     uses on a real card, where the foil stops at the art box. */

  .tc-bg-holo {
    position: absolute;
    inset: 0;
    z-index: 11;
    display: none;
    pointer-events: none;
    border-radius: inherit;
    will-change: background-position, filter, opacity;
    opacity: calc((.26 + .32 * var(--lift, 0)) * var(--shine-strength, 1));
    transition: opacity 240ms ease;
  }

  .tc-card[data-bg-scope="body"] .tc-bg-holo {
    clip-path: polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%,
      0% var(--aw-y),
      var(--aw-x) var(--aw-y),
      var(--aw-x) var(--aw-b),
      var(--aw-r) var(--aw-b),
      var(--aw-r) var(--aw-y),
      var(--aw-x) var(--aw-y),
      0% var(--aw-y)
    );
  }

  .tc-card[data-bg-foil="linear"] .tc-bg-holo,
  .tc-card[data-bg-foil="motif"] .tc-bg-holo,
  .tc-card[data-bg-foil="cosmos"] .tc-bg-holo { display: block; }

  /* LINEAR - the plain reverse-holo sheen. */
  .tc-card[data-bg-foil="linear"] .tc-bg-holo {
    background-image:
      repeating-linear-gradient(
        calc(72deg + var(--ry, 0deg) * 1.4),
        var(--sun-1) 0, var(--sun-2) calc(var(--sun-step) * 1.6),
        var(--sun-3) calc(var(--sun-step) * 3.2), var(--sun-4) calc(var(--sun-step) * 4.8),
        var(--sun-5) calc(var(--sun-step) * 6.4), var(--sun-6) calc(var(--sun-step) * 8),
        var(--sun-1) calc(var(--sun-step) * 9.6)
      ),
      var(--foil-grain);
    background-size: 100% 100%, 300px 300px;
    background-position:
      calc(50% + (50% - var(--posx, 50%)) * 5) calc(50% + (50% - var(--posy, 50%)) * 3),
      calc(var(--seedx, 0) * 400px) calc(var(--seedy, 0) * 400px);
    background-blend-mode: overlay;
    mix-blend-mode: color-dodge;
    filter: brightness(calc(.20 + .20 * var(--hyp, 0))) contrast(1.5) saturate(1.05);
  }

  /* MOTIF - the patterned background holo. The sigil is tiled as a MASK over
     the rainbow rather than drawn as an image: the colour survives only where
     a sigil sits AND where the cursor is near. That second mask is the whole
     trick - without it the pattern sits there like printed wallpaper; with
     it, the sigils light up in a pool that swims across the card as it tilts.
     mask-composite intersect (source-in on WebKit) is what ANDs the two. */
  .tc-card[data-bg-foil="motif"] .tc-bg-holo {
    opacity: calc((.42 + .45 * var(--lift, 0)) * var(--shine-strength, 1));
    background-image:
      linear-gradient(
        calc(45deg + var(--ry, 0deg) * 2),
        var(--sun-4), var(--sun-5), var(--sun-6),
        var(--sun-1), var(--sun-2), var(--sun-3), var(--sun-4)
      ),
      var(--foil-iri);
    background-size: 220% 220%, 160% 160%;
    background-position:
      var(--mx, 50%) var(--my, 50%),
      calc(var(--pointer-from-left, .5) * 100%) calc(var(--pointer-from-top, .5) * 100%);
    background-blend-mode: soft-light;
    mix-blend-mode: screen;
    filter: brightness(calc(.34 + .34 * var(--hyp, 0))) contrast(1.35) saturate(1.2);

    -webkit-mask-image:
      var(--foil-motif),
      radial-gradient(farthest-corner circle at var(--mx, 50%) var(--my, 50%),
        #000 6%, rgba(0, 0, 0, .40) 38%, transparent 74%);
    mask-image:
      var(--foil-motif),
      radial-gradient(farthest-corner circle at var(--mx, 50%) var(--my, 50%),
        #000 6%, rgba(0, 0, 0, .40) 38%, transparent 74%);
    -webkit-mask-size: var(--foil-motif-size) auto, cover;
    mask-size: var(--foil-motif-size) auto, cover;
    -webkit-mask-position:
      calc(var(--seedx, 0) * var(--foil-motif-tile)) calc(var(--seedy, 0) * var(--foil-motif-tile)), center;
    mask-position:
      calc(var(--seedx, 0) * var(--foil-motif-tile)) calc(var(--seedy, 0) * var(--foil-motif-tile)), center;
    -webkit-mask-repeat: repeat, no-repeat;
    mask-repeat: repeat, no-repeat;
    -webkit-mask-composite: source-in;
    mask-composite: intersect;
  }

  /* COSMOS - glitter field over a slow rainbow, for the terminal rarities. */
  .tc-card[data-bg-foil="cosmos"] .tc-bg-holo {
    background-image:
      var(--foil-glitter),
      /* repeating, not plain: a plain gradient driven this far past the box
         clamps to its end colour and lands a hard bar down one edge */
      repeating-linear-gradient(calc(120deg + var(--ry, 0deg) * 3),
        var(--sun-1) 0, var(--sun-3) calc(var(--sun-step) * 9),
        var(--sun-5) calc(var(--sun-step) * 18), var(--sun-1) calc(var(--sun-step) * 27));
    background-size: 38% 38%, 100% 100%;
    background-position:
      calc(var(--seedx, 0) * 500px + (50% - var(--posx, 50%)) * .6)
        calc(var(--seedy, 0) * 500px + (50% - var(--posy, 50%)) * .6),
      calc(50% + (50% - var(--posx, 50%)) * 4) calc(50% + (50% - var(--posy, 50%)) * 2);
    background-blend-mode: color-dodge;
    mix-blend-mode: screen;
    filter: brightness(calc(.55 + .45 * var(--hyp, 0))) contrast(1.5) saturate(1.1);
  }

  /* ----- Shine (refraction) ----------------------------------------------
     Two blend modes, selected by data-shine-blend:

       dodge  (default) - color-dodge. Brightens every pixel it lands on by
                the same rule, so the card lifts uniformly.
       mirror           - overlay, simey's rare-holo pivot. Overlay is a PIVOT
                blend: against light pixels it drives hard toward white and
                saturates, against dark ones it barely moves. Nothing in it
                targets the frame - the frame is simply the lightest pixels on
                the card, so the same rainbow that stays invisible over the
                artwork blows out into chrome on the border. contrast(3) then
                crushes it into hard bright/dark bands, which is what reads as
                polished rather than merely tinted. It needs no plate and no
                measuring; it finds the border by luminance alone.

     Mode tunables live as vars on .tc-card so soft/plate/mirror compose by
     overriding a value rather than re-declaring the whole layer. */

  .tc-card {
    --shine-blend: color-dodge;
    --shine-filter: brightness(calc(.20 + .28 * var(--hyp, 0))) contrast(1.7) saturate(.85);
    --shine-op: calc(.10 + .26 * var(--lift, 0));
  }

  /* SOFT - dialled back for the commons, where a full sweep over the body
     makes the card read as a higher rarity than it is. */
  .tc-card[data-shine="soft"] {
    --shine-op: calc(.05 + .14 * var(--lift, 0));
    --shine-filter: brightness(calc(.16 + .18 * var(--hyp, 0))) contrast(1.4) saturate(.65);
  }

  /* A plated shine lights far less area, so it can run hotter. */
  .tc-card[data-plate="on"][data-shine="on"] {
    --shine-op: calc(.30 + .58 * var(--lift, 0));
    --shine-filter: brightness(calc(.34 + .40 * var(--hyp, 0))) contrast(1.9) saturate(.9);
  }
  .tc-card[data-plate="on"][data-shine="soft"] {
    --shine-op: calc(.14 + .32 * var(--lift, 0));
  }

  .tc-card-shine {
    position: absolute;
    inset: 0;
    z-index: 30;
    display: none;
    pointer-events: none;
    border-radius: inherit;
    overflow: hidden;
    will-change: background-position, filter, opacity;
    mix-blend-mode: var(--shine-blend);
    opacity: calc(var(--shine-op) * var(--shine-strength, 1));
    transition: opacity 240ms ease;

    background-image:
      /* fine diffraction bands - the angle swings with the tilt, which is
         what makes them sweep rather than just slide */
      repeating-linear-gradient(
        calc(100deg + var(--ry, 0deg) * 3),
        var(--sun-1) 0, var(--sun-2) var(--sun-step),
        var(--sun-3) calc(var(--sun-step) * 2), var(--sun-4) calc(var(--sun-step) * 3),
        var(--sun-5) calc(var(--sun-step) * 4), var(--sun-6) calc(var(--sun-step) * 5),
        var(--sun-1) calc(var(--sun-step) * 6)
      ),
      /* broad iridescent smear, parallaxed the other way */
      var(--foil-iri),
      /* glitter, anchored to the card by its seed */
      var(--foil-glitter);

    background-size: 100% 100%, 140% 140%, 26% 26%;
    background-position:
      calc(50% + (50% - var(--posx, 50%)) * 6) calc(50% + (50% - var(--posy, 50%)) * 3),
      calc(var(--pointer-from-left, .5) * 140%) calc(var(--pointer-from-top, .5) * 140%),
      calc(var(--seedx, 0) * 600px + (50% - var(--posx, 50%)) * .8)
        calc(var(--seedy, 0) * 600px + (50% - var(--posy, 50%)) * .8);
    background-blend-mode: overlay, soft-light;
    filter: var(--shine-filter);
  }

  .tc-card[data-shine="on"] .tc-card-shine,
  .tc-card[data-shine="soft"] .tc-card-shine { display: block; }

  /* ----- Mirror mode ----------------------------------------------------- */

  /* Unplated, the overlay covers the whole card. Simey's contrast(3) is
     calibrated for a pale Pokemon card; on RL80's near-black body the same
     numbers blow the frame out to lurid yellow, so unplated runs far gentler
     and reads as a sheen rather than chrome. */
  .tc-card[data-shine-blend="mirror"] {
    --shine-blend: overlay;
    --shine-filter: brightness(1.05) contrast(1.9) saturate(.7);
    --shine-op: calc(.12 + .20 * var(--lift, 0));
  }
  .tc-card[data-shine-blend="mirror"][data-shine="soft"] {
    --shine-op: calc(.06 + .11 * var(--lift, 0));
  }

  /* Plated, only the frame's stamped metal is lit, so it can take the full
     recipe. This is the pairing that gives the mirrored border. */
  .tc-card[data-shine-blend="mirror"][data-plate="on"] {
    --shine-filter: brightness(1.22) contrast(3) saturate(.75);
    --shine-op: calc(.42 + .55 * var(--lift, 0));
  }
  .tc-card[data-shine-blend="mirror"][data-plate="on"][data-shine="soft"] {
    --shine-op: calc(.20 + .30 * var(--lift, 0));
  }

  /* One broad rainbow rather than the dodge stack's fine grating + textures:
     overlay already supplies the contrast, so layering grain and glitter under
     it just muddies the pivot. 400% keeps the bands wide enough to sweep. */
  .tc-card[data-shine-blend="mirror"] .tc-card-shine {
    background-image:
      repeating-linear-gradient(
        calc(10deg + var(--ry, 0deg) * 1.5),
        var(--sun-1), var(--sun-2), var(--sun-3),
        var(--sun-4), var(--sun-5), var(--sun-6), var(--sun-1)
      );
    background-size: 400% 400%;
    background-position:
      calc((50% - var(--posx, 50%)) + 50%) calc((50% - var(--posy, 50%)) + 50%);
    background-blend-mode: normal;
  }

  /* The etched bars: two opposing bar gradients screened together, then
     multiplied over the rainbow inside the shine's own stacking context.
     This is the step that turns a smooth sheen into banded metal - without it
     the border reads as tinted glass rather than polished chrome. */
  .tc-card[data-shine-blend="mirror"] .tc-card-shine::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    /* Simey's bars run a 5% unit with black over most of the period. That
       works on a pale Pokemon card, where the black runs read as the dark
       grooves between highlights. On RL80's near-black body the same runs
       just crush it, and at that period you get one fat stripe rather than
       banding, so: finer unit, and grey instead of black for the gaps. */
    --bars: 1.6%;
    --bar-color: hsla(0, 0%, 78%, 1);
    --bar-bg: hsla(0, 0%, 12%, 1);
    opacity: .5;
    background-image:
      repeating-linear-gradient(calc(var(--ry, 0deg) * 0.5),
        var(--bar-bg) calc(var(--bars) * 2.5),
        var(--bar-color) calc(var(--bars) * 3.25),
        hsla(0, 0%, 75%, .5) calc(var(--bars) * 3.5),
        var(--bar-color) calc(var(--bars) * 3.75),
        var(--bar-bg) calc(var(--bars) * 4.5),
        var(--bar-bg) calc(var(--bars) * 8)
      ),
      repeating-linear-gradient(calc(var(--ry, 0deg) * -0.5),
        var(--bar-bg) calc(var(--bars) * 2.5),
        var(--bar-color) calc(var(--bars) * 3.25),
        hsla(0, 0%, 75%, .5) calc(var(--bars) * 3.5),
        var(--bar-color) calc(var(--bars) * 3.75),
        var(--bar-bg) calc(var(--bars) * 4.5),
        var(--bar-bg) calc(var(--bars) * 8)
      );
    background-position:
      50% calc(var(--posy, 50%) * 1.2),
      50% calc(var(--posy, 50%) * -1.2);
    background-size: 200% 200%, 200% 200%;
    background-blend-mode: screen;
    filter: brightness(1) contrast(2) saturate(.75);
    mix-blend-mode: multiply;
  }

  /* ----- Glitter mode ---------------------------------------------------
     Embedded foil flakes, the 30th-anniversary gold-border look.

     The whole trick is that the flake field is STATIC - anchored to the card
     by its seed, never driven by the pointer - while broad sweeps move across
     it. The sweeps and the flakes are multiplied, then run through a very
     high contrast(), which behaves as a threshold: a flake lights only while
     the sweep happens to be bright enough where that flake sits. So flakes
     pop on and off IN PLACE as the card turns, which is what real glitter
     does. Drive the flake texture's position with the pointer instead and you
     get sliding confetti, which reads as cheap plastic.

     Two sweeps at different rates, so the flakes do not all pop in unison. */

  /* color-dodge: dodging by black is the identity, so the gaps between flakes
     leave the gold exactly as painted, while a lit flake blows straight out of
     it. hard-light also speckles but multiplies the gaps, which crushes a gold
     border to near-black; screen is too weak to show against bright gold at
     all. Dodge is the one that reads as foil embedded IN the metal. */
  .tc-card[data-shine-blend="glitter"] {
    --shine-blend: color-dodge;
    --shine-filter: brightness(1.9) contrast(4.5) saturate(1.05);
    --shine-op: calc(.55 + .40 * var(--lift, 0));
  }
  .tc-card[data-shine-blend="glitter"][data-shine="soft"] {
    --shine-op: calc(.26 + .28 * var(--lift, 0));
    --shine-filter: brightness(1.3) contrast(4.5) saturate(1.15);
  }

  /* The plate rules above are [data-plate][data-shine] = specificity (0,3,1),
     which outranks a bare [data-shine-blend] at (0,2,1) - so a plated card
     would otherwise inherit the plate's filter and lose the glitter threshold
     entirely. Each blend mode needs its own plated pairing to win the cascade. */
  .tc-card[data-shine-blend="glitter"][data-plate="on"] {
    --shine-filter: brightness(1.9) contrast(4.5) saturate(1.05);
    --shine-op: calc(.68 + .30 * var(--lift, 0));
  }
  .tc-card[data-shine-blend="glitter"][data-plate="on"][data-shine="soft"] {
    --shine-filter: brightness(1.3) contrast(4.5) saturate(1.15);
    --shine-op: calc(.30 + .30 * var(--lift, 0));
  }

  .tc-card[data-shine-blend="glitter"] .tc-card-shine {
    background-image:
      /* sweep A - follows the cursor, supplies the gold */
      /* never reaches black: the far side of the border must still carry some
         flakes, just fewer and dimmer than the side facing the light */
      radial-gradient(farthest-corner circle at var(--mx, 50%) var(--my, 50%),
        #ffffff 0%, var(--glitter-warm) 22%, var(--glitter-deep) 60%, #6b5a30 100%),
      /* sweep B - a banded sheet travelling at a different rate and angle */
      /* floors at #5a5a5a, not #000: these sweeps MULTIPLY the flake field, so
         a true-black stop annihilates every flake under it instead of just
         dimming it, and almost nothing survives the threshold. */
      repeating-linear-gradient(calc(28deg + var(--ry, 0deg) * 7),
        #5a5a5a 0%, #ffffff 14%, #5a5a5a 30%),
      /* the flake field - position depends ONLY on the card's seed */
      var(--foil-flakes);
    background-size:
      170% 170%,
      240% 240%,
      var(--flake-size) var(--flake-size);
    background-position:
      center,
      calc(50% + (50% - var(--posx, 50%)) * 5) calc(50% + (50% - var(--posy, 50%)) * 5),
      calc(var(--seedx, 0) * 400px) calc(var(--seedy, 0) * 400px);
    background-blend-mode: multiply, multiply;
  }

  /* No etched bars in glitter mode - the flakes are the texture. */
  .tc-card[data-shine-blend="glitter"] .tc-card-shine::after { display: none; }

  /* Glitter without a plate would flood the whole card, which is never what
     a glitter BORDER means - and a card can lose its plate quietly, e.g. when
     the rarity maps to a frame id that no longer exists, so the frame and its
     plate both resolve to null. Fall back to a plain border ring: the outer
     edge traced clockwise, an inset rect traced counter-clockwise to punch the
     middle out. The plate is still better when present, because it follows the
     frame's real metal rather than a uniform band. */
  .tc-card[data-shine-blend="glitter"][data-plate="off"] .tc-card-shine {
    clip-path: polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
      var(--edge-inset) var(--edge-inset),
      var(--edge-inset) calc(100% - var(--edge-inset)),
      calc(100% - var(--edge-inset)) calc(100% - var(--edge-inset)),
      calc(100% - var(--edge-inset)) var(--edge-inset),
      var(--edge-inset) var(--edge-inset),
      0% 0%
    );
  }

  /* PLATE - confine the shine to the frame's stamped metal. The plate is a
     full-bleed alpha map (white RGB, plate value in alpha) so it masks with
     the default alpha mode; a greyscale plate would need mask-mode: luminance,
     which is patchy, and would otherwise mask to fully solid. Mirror mode
     needs no plate to find the border, but a plate still keeps the shine off
     the body if you want the edge alone. */
  .tc-card[data-plate="on"] .tc-card-shine {
    -webkit-mask-image: var(--foil-plate);
    mask-image: var(--foil-plate);
    -webkit-mask-size: cover;
    mask-size: cover;
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
  }

  /* ----- Glare (specular) ------------------------------------------------ */

  .tc-card-glare {
    position: absolute;
    inset: 0;
    z-index: 31;
    display: none;
    pointer-events: none;
    border-radius: inherit;
    will-change: background-image, opacity;
    mix-blend-mode: overlay;
    opacity: calc((.18 + .34 * var(--lift, 0)) * var(--shine-strength, 1));
    transition: opacity 240ms ease;
    background-image:
      radial-gradient(farthest-corner circle at var(--mx, 50%) var(--my, 50%),
        hsla(0, 0%, 100%, .55) 6%,
        hsla(0, 0%, 100%, .26) 20%,
        hsla(0, 0%, 0%, .45) 74%);
    filter: brightness(.95) contrast(1.25);
  }

  .tc-card[data-shine="on"] .tc-card-glare,
  .tc-card[data-shine="soft"] .tc-card-glare { display: block; }

  .tc-card[data-shine="soft"] .tc-card-glare {
    opacity: calc((.10 + .20 * var(--lift, 0)) * var(--shine-strength, 1));
  }

  @media (prefers-reduced-motion: reduce) {
    .tc-bg-holo,
    .tc-card-shine,
    .tc-card-glare { transition: none; }
  }
`;

/* ─────────────────────────────────────────────────────────────────────
   CLASSIC TEMPLATE — the framed, metallic "trading-binder" skin.
   Same card data, classic-TCG structure (stage tag · headline stat +
   type pip · framed art · Ability box · rule/flavor · weakness /
   resistance / retreat footer), drawn in the RL80 palette. The body tint
   and pip follow --type; flair + retreat follow --rarity.
   ───────────────────────────────────────────────────────────────────── */
function ClassicFrame({ data, tilt, interactive, motionEnabled, rarityAccent, headline }) {
  const pivots = data.pivotCost || 0;
  const hasBattle = data.weakness || data.resistance || pivots;
  return (
    <div className="cc">
      <div className="cc-body">
        <header className="cc-top">
          <span className="cc-stage">{data.cardType}</span>
          <h1 className="cc-name">
            {data.name}
            <em className="cc-flair" style={{ color: rarityAccent }}>◆</em>
          </h1>
          {headline && (
            <div className="cc-hp" title={headline.title}>
              <small>{headline.label}</small>
              <b>
                {headline.value}
                {headline.suffix && <em>{headline.suffix}</em>}
              </b>
              <span className="cc-pip" />
            </div>
          )}
        </header>

        <div className="cc-art">
          <CardArtwork
            data={data}
            tilt={tilt}
            interactive={interactive}
            motionEnabled={motionEnabled}
            defaultZoom={1.1}
          />
          <div className="cc-art-sheen" />
        </div>

        <div className="cc-textzone">
          {data.ability && (
            <section className="cc-ability">
              <span className="cc-ability-pill">Ability</span>
              <h2>{data.ability.name}</h2>
              <p>{data.ability.text}</p>
            </section>
          )}
          {data.flavorText && <div className="cc-rule">{data.flavorText}</div>}
        </div>

        <footer className="cc-footer">
          {hasBattle ? (
            <div className="cc-wr">
              <div>
                <small>weakness</small>
                <b>{data.weakness || "—"}</b>
              </div>
              <div>
                <small>resistance</small>
                <b>{data.resistance || "—"}</b>
              </div>
              <div>
                <small>retreat</small>
                <b className="cc-retreat">{pivots ? "✦".repeat(pivots) : "—"}</b>
              </div>
            </div>
          ) : (
            <span />
          )}
          <div className="cc-set">
            {data.edition} · GENESIS
          </div>
        </footer>
      </div>
    </div>
  );
}

const CLASSIC_STYLES = `
  /* Metallic outer frame — replaces the terminal card's gold-ring chrome. */
  .tc-card--classic {
    border-radius: 30px;
    color: #17110a;
    background:
      linear-gradient(148deg,
        #f5f7f9 0%, #c8cdd5 20%, #eef1f4 38%,
        #a9afb9 60%, #e7eaef 80%, #b6bcc6 100%);
    box-shadow:
      0 calc(28px + 24px * var(--lift, 0)) calc(60px + 50px * var(--lift, 0)) rgba(0,0,0,.55),
      inset 0 0 0 2px rgba(255,255,255,.55),
      inset 0 0 0 7px rgba(0,0,0,.28),
      0 0 55px color-mix(in srgb, var(--type) calc(20% + 16% * var(--lift, 0)), transparent);
  }

  .cc {
    position: absolute;
    inset: 0;
    z-index: 1;
    padding: 22px;                /* metallic frame thickness */
    display: flex;
  }

  .cc-body {
    position: relative;
    flex: 1;
    border-radius: 16px;
    padding: 16px 18px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow: hidden;
    background:
      radial-gradient(circle at 22% 10%, color-mix(in srgb, var(--type) 40%, #ffffff 12%), transparent 55%),
      linear-gradient(180deg,
        color-mix(in srgb, var(--type) 32%, #f4f0e2) 0%,
        color-mix(in srgb, var(--type) 22%, #e9e3cf) 52%,
        color-mix(in srgb, var(--type) 30%, #dcd5bd) 100%);
    box-shadow:
      inset 0 0 0 2px rgba(255,255,255,.4),
      inset 0 0 0 4px color-mix(in srgb, var(--type) 55%, #7a6a2a),
      inset 0 0 70px rgba(0,0,0,.18);
  }

  /* faint paper grain */
  .cc-body::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: radial-gradient(rgba(0,0,0,.05) 1px, transparent 1px);
    background-size: 4px 4px;
    mix-blend-mode: multiply;
    opacity: .5;
  }

  .cc-top {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
  }

  .cc-stage {
    font-family: "Anton", Impact, sans-serif;
    font-size: 20px;
    letter-spacing: .05em;
    color: #2b2317;
    text-transform: uppercase;
    padding: 3px 11px;
    border-radius: 6px;
    background: linear-gradient(180deg, rgba(255,255,255,.65), rgba(255,255,255,.12));
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.28), 0 1px 0 rgba(255,255,255,.4);
    white-space: nowrap;
  }

  .cc-name {
    margin: 0;
    font-family: "Anton", Impact, sans-serif;
    font-size: 42px;
    line-height: .9;
    letter-spacing: .01em;
    color: #191207;
    text-shadow: 0 1px 0 rgba(255,255,255,.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cc-flair {
    font-style: normal;
    margin-left: 8px;
    text-shadow: 0 0 10px currentColor;
  }

  .cc-hp {
    display: flex;
    align-items: baseline;
    gap: 7px;
    white-space: nowrap;
  }

  .cc-hp small {
    font-family: "IBM Plex Mono", monospace;
    font-size: 12px;
    color: #4a3d22;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .cc-hp b {
    font-family: "Anton", Impact, sans-serif;
    font-size: 34px;
    color: #171009;
  }

  .cc-hp b em {
    font-style: normal;
    font-size: 15px;
  }

  .cc-pip {
    position: relative;
    flex: none;
    align-self: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background:
      radial-gradient(circle at 35% 28%, #fff 0%, transparent 42%),
      radial-gradient(circle at 50% 55%,
        color-mix(in srgb, var(--type) 85%, #fff) 0%,
        color-mix(in srgb, var(--type) 72%, #000 14%) 100%);
    box-shadow: inset 0 0 0 2px rgba(255,255,255,.6), 0 1px 3px rgba(0,0,0,.45);
  }

  .cc-pip::after {
    content: "";
    position: absolute;
    inset: 9px;
    border-radius: 4px;
    transform: rotate(45deg);
    background: rgba(255,255,255,.6);
  }

  .cc-art {
    position: relative;
    height: 340px;
    border-radius: 8px;
    overflow: hidden;
    background: #0a0d12;
    box-shadow:
      inset 0 0 0 2px rgba(255,255,255,.42),
      inset 0 0 0 5px #b9922f,
      inset 0 0 0 7px #6c4f16,
      0 5px 16px rgba(0,0,0,.4);
  }

  .cc-art img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 120ms ease-out;
  }

  .cc-art .tc-art-layer {
    transition: transform 180ms cubic-bezier(.2,.7,.2,1);
  }

  .cc-art-sheen {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(
      115deg,
      transparent 40%,
      rgba(255,255,255,calc(.14 * var(--lift, .3))) 50%,
      transparent 60%
    );
    background-position: calc((var(--mx, 50%) - 50%) * 1.4) 0;
  }

  .cc-textzone {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
  }

  .cc-ability {
    position: relative;
  }

  .cc-ability-pill {
    display: inline-block;
    vertical-align: middle;
    font-family: "Anton", Impact, sans-serif;
    font-size: 15px;
    letter-spacing: .07em;
    color: #ffe9c7;
    padding: 3px 15px;
    border-radius: 20px;
    background: linear-gradient(180deg, #ff5454 0%, #c40000 55%, #7a0000 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,.45), 0 2px 4px rgba(0,0,0,.35);
    text-transform: uppercase;
    margin-right: 9px;
  }

  .cc-ability h2 {
    display: inline;
    font-family: "IBM Plex Sans", system-ui, sans-serif;
    font-size: 18px;
    font-weight: 800;
    color: #1c1508;
  }

  .cc-ability p {
    margin: 7px 0 0;
    font-size: 14px;
    line-height: 1.42;
    color: #2c2415;
  }

  .cc-rule {
    margin-top: auto;
    align-self: flex-end;
    max-width: 66%;
    font-size: 12.5px;
    font-style: italic;
    line-height: 1.35;
    color: #2a2312;
    padding: 8px 13px;
    border-radius: 9px 9px 3px 9px;
    background: linear-gradient(180deg, #ffe9a8 0%, #f2cf6b 100%);
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.28), 0 2px 5px rgba(0,0,0,.28);
  }

  .cc-footer {
    position: relative;
    border-top: 2px solid rgba(0,0,0,.28);
    padding-top: 11px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
  }

  .cc-wr {
    display: flex;
    gap: 20px;
  }

  .cc-wr > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .cc-wr small {
    font-family: "IBM Plex Mono", monospace;
    font-size: 10px;
    letter-spacing: .16em;
    text-transform: uppercase;
    color: #4a3d22;
  }

  .cc-wr b {
    font-size: 14px;
    font-weight: 800;
    color: #1c1508;
  }

  .cc-retreat {
    letter-spacing: 3px;
    color: color-mix(in srgb, var(--rarity) 55%, #7a5a10);
  }

  .cc-set {
    font-family: "IBM Plex Mono", monospace;
    font-size: 11px;
    letter-spacing: .1em;
    color: #3a3018;
    white-space: nowrap;
  }
`;
