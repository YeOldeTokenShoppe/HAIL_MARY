"use client";

// RcanaCard3 — the R-cana card with its frame DRAWN IN CODE (2026-11-16).
//
// RcanaCard lays a painted frame image over the art and sets ink into boxes
// printed on that image. This card has no frame image at all: the border, the
// stat badges, the plate, the text box and the name band are shapes and type,
// so one component serves every card type, stays sharp at any size, and can
// change its metal (flat gold, polished gold, rainbow foil) by swapping a fill.
// The only pictures are the card's own art layers and the RL80 seal.
//
// Layout, in a 512 x 710 box (the 1027:1424 card aspect), scaled to fit:
//   top left      what the card costs — a DROP on a Trader (Liquidity: the cost is
//                 also what they earn each turn), a COIN on everything else;
//                 no badge at all on a card that is free or fires when drawn
//   top right     the plate, the card's headline number — Credibility under a
//                 halo on a Trader, the sale price on an Asset, the payout on a
//                 called Event; in the card type's colour
//   bottom left   a d8 for a Trader's Equanimity; a small drop for what an
//                 Asset pays each turn
//   bottom right  the RL80 seal over the collector number
//
// Trader numbers come from src/game/rcana/set/trinity.js (the Playtest 3
// trinity). Money on non-Trader cards is printed in $M: an old cost of 3 is 30.
//
// It keeps RcanaCard's outer class names (.rc-stage, .rc-card[data-ready]) so
// scripts/rcana-render-faces.mjs can screenshot it unchanged.
import React, { useEffect, useId, useRef, useState } from "react";
import { designByKey } from "@/game/rcana/set/designs.js";
import { TRINITY, TRINITY_TEXT, MONEY_UNIT } from "@/game/rcana/set/trinity.js";
import { oneMoney } from "@/game/rcana/set/oneMoney.js";
import { APPARITIONS } from "@/game/rcana/set/apparitions.js";
import { RCANA_SET } from "@/game/rcana/cardFace";

export const RCANA3_METALS = ["flat", "gold", "mirror", "rainbow"];

const W = 512;
const H = 710;
const INK = "#1b1430";       // the dark enamel, and every outline
const GOLD = "#f2b705";
const GOLD_HI = "#ffc928";
const GOLD_LO = "#b97a00";
const GILT = "#ffd84a";      // lettering
const PARCHMENT = "#f6e7b8";
const SEAL = "/TCG/frames/rcana-frame3-seal.webp";
const CLASS_COLOR = { Trader: "#9c1c1c", Asset: "#315c3c", Artifact: "#155b60", Event: "#38477e" };
const NUM = "Anton, 'Bebas Neue', Impact, sans-serif";
const CAPS = "'Bebas Neue', Anton, Impact, sans-serif";
const BODY = "Spectral, 'Crimson Pro', Georgia, serif";
const NAME = "'Grenze Gotisch', Georgia, serif";

const DROP_OUTER = "M50 6 C50 6 16 46 16 72 A34 34 0 0 0 84 72 C84 46 50 6 50 6 Z";
const DROP_INNER = "M50 17 C50 17 22 51 22 72 A28 28 0 0 0 78 72 C78 51 50 17 50 17 Z";
const D8_HULL = "50,5 89,30 91,75 50,96 9,75 11,30";

// Where each badge sits in the card box, and the size of its own drawing box.
const TL = { x: 2, y: 2, s: 1 };                    // coin: 100 x 100
const TL_DROP = { x: 4, y: 0, sx: 0.96, sy: 0.957 }; // drop: 100 x 116
const BL_DIE = { x: 8, y: 598, s: 0.9 };            // d8: 100 x 100
const BL_DROP = { x: 12, y: 596, sx: 0.78, sy: 0.784 };

const FOILS = {
  gold: { x2: 170, y2: 250, sheen: 0.7, stops: [[0, "#9a6400"], [0.16, "#f2b705"], [0.32, "#fff4b8"], [0.5, "#ffd84a"], [0.66, "#b97a00"], [0.84, "#ffe58a"], [1, "#9a6400"]] },
  rainbow: { x2: 230, y2: 310, sheen: 0.55, stops: [[0, "#ff7ac8"], [0.17, "#ffc46b"], [0.33, "#f6ff8a"], [0.5, "#7dffb0"], [0.67, "#6fd8ff"], [0.83, "#b596ff"], [1, "#ff7ac8"]] },
};
const RAINBOW_TEXT = "linear-gradient(105deg, #ff7ac8 0%, #ffc46b 17%, #f6ff8a 33%, #7dffb0 50%, #6fd8ff 67%, #b596ff 83%, #ff7ac8 100%)";

// Everything the frame prints, worked out from the card data.
export function rcana3Model(data) {
  const face = RCANA_SET.find((c) => c.id === data.id);
  const key = face?.designKey;
  const design = designByKey[key] || {};
  const cls = data.cardClass || "Artifact";
  const trinity = cls === "Trader" ? TRINITY[key] : null;
  const firesOnDraw = design.type === "event" && !design.played;
  const model = {
    id: data.id,
    cls,
    color: cls === "Trader" ? CLASS_COLOR.Trader : data.keywordColor || CLASS_COLOR[cls] || CLASS_COLOR.Artifact,
    name: data.name || "",
    typeLabel: cls === "Trader" || cls === "Asset" ? cls : data.subClass || cls,
    tab: cls === "Trader" ? data.abilityName || "Trader" : data.keyword || data.subClass || cls,
    text: TRINITY_TEXT[key] || oneMoney(data.ability, cls),
    flavor: data.flavor ? (data.flavorQuoted ? `“${data.flavor}”` : data.flavor) : null,
    collector: data.collector ? `${data.collector.number} / ${data.collector.of}` : null,
    topLeft: null, plate: null, corner: null,
  };
  if (trinity) {
    model.topLeft = { shape: "drop", value: trinity.liq, label: `Liquidity ${trinity.liq}: costs ${trinity.liq} to play, earns ${trinity.liq} a turn` };
    model.plate = { value: trinity.cred, halo: true, label: `Credibility ${trinity.cred}: earns ${trinity.cred} more while in good standing` };
    model.corner = { shape: "die", value: trinity.eq, label: `Equanimity ${trinity.eq}: a Calamity played on you fails on a d8 roll of ${trinity.eq} or lower` };
  } else {
    const cost = Number(data.cost) || 0;
    // No coin means nothing to pay: a card that fires when drawn, or one that is free to play.
    if (!firesOnDraw && cost > 0) model.topLeft = { shape: "coin", value: cost * MONEY_UNIT, label: `Price: $${cost * MONEY_UNIT}M to play` };
    const value = cls === "Asset" ? (design.perp ? design.pros * 2 : design.pros) : design.type === "event" && design.played ? design.pros : null;
    if (value) model.plate = { value, halo: false, label: cls === "Asset" ? `Sells for $${value}M` : `Pays $${value}M` };
    if (!model.text && value) model.text = cls === "Asset" ? `Sell it for $${value}M.` : `Collect $${value}M.`;
    if (design.income) model.corner = { shape: "drop", value: design.income * MONEY_UNIT, label: `Pays $${design.income * MONEY_UNIT}M each turn while held` };
  }
  return model;
}

const plateBox = (value) => { const w = String(value).length === 1 ? 120 : String(value).length === 2 ? 150 : 178; return { w, x: W - 4 - w, cx: (w + 12) / 2 }; };
const pts = (list) => list.map((p) => p.join(",")).join(" ");
const plateShapes = (w) => ({
  hull: pts([[8, 16], [w - 4, 16], [w - 4, 96], [40, 96], [8, 66]]),
  rim: pts([[12, 20], [w - 8, 20], [w - 8, 92], [42, 92], [12, 64]]),
  field: pts([[16, 24], [w - 12, 24], [w - 12, 88], [44, 88], [16, 62]]),
});

// Dice targets ("5+") and Calamities read as chips, so the game terms stand out of the sentence.
function RulesText({ text }) {
  const parts = String(text).split(/(\b\d\+|Calamit(?:y|ies))/g);
  return parts.map((part, i) => {
    if (/^\d\+$/.test(part)) {
      return (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "0 8px 0 5px", borderRadius: 6, background: INK, color: GILT, fontFamily: CAPS, fontSize: "0.94em", lineHeight: "1.3em", letterSpacing: "0.04em", verticalAlign: "0.06em" }}>
          <svg aria-hidden="true" viewBox="0 0 100 100" style={{ width: "0.8em", height: "0.8em" }}><polygon points={D8_HULL} fill={GOLD_LO} /><polygon points="50,5 9,75 91,75" fill={GOLD_HI} /></svg>
          {part}
        </span>
      );
    }
    if (/^Calamit/.test(part)) {
      return <span key={i} style={{ padding: "1px 10px", borderRadius: 999, background: "#9c1c1c", color: "#ffe9a6", fontFamily: CAPS, fontSize: "0.9em", letterSpacing: "0.1em", textTransform: "uppercase", verticalAlign: "0.06em" }}>{part}</span>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

// The Virtual Mary has circuit traces; the rest of the set uses flowing scrolls.
function filigreeMarkup(model, metalColor) {
  const corner = model.id === "virtual-mary" ? `
    <g fill="none" stroke="${metalColor}" stroke-linejoin="round" stroke-linecap="round">
      <path stroke-width="1.45" d="M2 40 V18 L17 3 H28 L32 7 H38
        C45 7 47 2 43 1 C39 0 37 4 40 7 C47 14 54 5 61 4 Q65 3 69 4
        M2 30 L7 25 C12 20 19 23 17 28 C15 32 10 31 11 27
        M7 25 C1 36 11 42 6 51 L3 55 V59"/>
      <path stroke-width=".9" d="M2 11 V7 L7 2 H12 M21 12 H27 L31 16 H36"/>
      <circle cx="37.5" cy="16" r="1.5" stroke-width="1"/>
    </g>
    <path fill="${metalColor}" d="M15 9 Q15.5 14.5 20 15 Q15.5 16 15 21 Q14 16 10 15 Q14 14 15 9Z
      M62 4 Q67 0 74 2 Q70 6 62 4Z M3 57 L5 60 L3 63 L1 60Z"/>` : `
    <path d="M72 1 C54 1 46 10 35 8 C26 6 27 0 32 1 C37 2 35 6 32 5 M48 4 C30 15 16 4 8 18 C1 30 12 38 16 30 C18 24 10 22 10 27 M8 18 C0 29 6 46 1 58" fill="none" stroke="${metalColor}" stroke-width="1.35" stroke-linecap="round"/>
    <path d="M4 14 Q4 6 17 3 Q13 11 4 14 Z M22 18 L24 22 L22 26 L20 22 Z" fill="${metalColor}"/>`;
  const at = (transform) => `<g transform="${transform}">${corner}</g>`;
  // Small diamond links sit on the side rails, clear of every badge.
  const link = '<path d="M0 -16 Q0 -7 -3 0 Q0 7 0 16 Q0 7 3 0 Q0 -7 0 -16 Z"/>';
  return [
    model.topLeft ? "" : at("translate(19 19)"),
    model.plate ? "" : at("translate(493 19) scale(-1 1)"),
    model.corner ? "" : at("translate(13 697) scale(.85 -.85)"),
    `<g fill="${metalColor}"><g transform="translate(10 241)">${link}</g><g transform="translate(502 241)">${link}</g></g>`,
  ].join("");
}

// The metal, as one mask: every gold part of the frame, white on black. A foil
// shows through it. Written as markup so the same shapes serve the inline SVG
// <mask> (the still foils) and a CSS mask image (the mirror, which is a div so
// its gradients can follow the tilt).
function metalMaskMarkup(model) {
  const plate = model.plate ? plateBox(model.plate.value) : null;
  const shapes = plate ? plateShapes(plate.w) : null;
  const drop = (at) => `<g transform="translate(${at.x},${at.y}) scale(${at.sx},${at.sy})"><path d="${DROP_OUTER}" fill="#000" stroke="#000" stroke-width="9" stroke-linejoin="round"/><path d="${DROP_OUTER}" fill="#fff"/></g>`;
  return [
    `<rect x="0" y="0" width="${W}" height="${H}" fill="#000"/>`,
    `<rect x="0" y="0" width="${W}" height="${H}" rx="24" fill="#fff"/>`,
    `<rect x="5" y="5" width="502" height="700" rx="19" fill="#000"/>`,
    `<rect x="15" y="15" width="482" height="472" rx="11" fill="none" stroke="#fff" stroke-width="2"/>`,
    `<rect x="28" y="440" width="456" height="154" rx="12" fill="#000"/>`,
    `<rect x="29" y="441" width="454" height="152" rx="11" fill="none" stroke="#fff" stroke-width="2"/>`,
    filigreeMarkup(model, "#fff"),
    model.topLeft?.shape === "drop" ? drop(TL_DROP) : "",
    model.topLeft?.shape === "coin" ? `<g transform="translate(${TL.x},${TL.y})"><circle cx="50" cy="50" r="49" fill="#000"/><circle cx="50" cy="50" r="45" fill="#fff"/></g>` : "",
    plate ? `<g transform="translate(${plate.x},0)"><polygon points="${shapes.hull}" fill="#000"/><polygon points="${shapes.rim}" fill="#fff"/><polygon points="${shapes.field}" fill="#000"/>${model.plate.halo ? `<ellipse cx="${plate.cx}" cy="20" rx="30" ry="8" fill="none" stroke="#000" stroke-width="10"/><ellipse cx="${plate.cx}" cy="20" rx="30" ry="8" fill="none" stroke="#fff" stroke-width="5"/>` : ""}</g>` : "",
    model.corner?.shape === "drop" ? drop(BL_DROP) : "",
  ].join("");
}
// The same mask as a CSS image: opaque where the metal is, clear elsewhere.
function metalMaskUrl(model) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">${metalMaskMarkup(model)}</mask></defs><rect width="${W}" height="${H}" fill="#fff" mask="url(#m)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// Parallax: how far a layer slides against the lean, as a % of the card, from
// the depth its art file gives it (z, negative = further back; the scene sits
// at about -68, the subject at about -22, props up to +118). The window is a box the
// art sits behind, so the deepest layer travels furthest. Kept inside the
// slack the art has past the window's edge (3%, plus the scene's overscale).
// Props in front of the window (positive z) slide the other way.
const parallax = (layer) => +(Math.min(1.1, Math.max(-1.1, -(layer.z ?? 0) / 68)) * 2.6).toFixed(2);

// An apparition's lit halo (src/game/rcana/set/apparitions.js): a glow with
// turning rays behind her layer, and a glint that travels the ring over it.
// Both ride the layer's own parallax (`slide`). Faint at rest; --lit (0 at
// rest, 1 at full lean) brings them up.
function haloLight(app, slide, live) {
  const cx = (app.cx / 100) * W, cy = (app.cy / 100) * H, r = (app.r / 100) * W;
  const tall = app.ry ? ((app.ry / 100) * H) / r : 1; // an oval light (a mandorla) when ry is given
  const rest = app.rest ?? 0.3, peak = app.strength ?? 1;
  const ease = live ? "opacity var(--ease, 500ms) ease-out, transform var(--ease, 500ms) ease-out" : undefined;
  const disc = (R) => ({ position: "absolute", margin: 0, left: cx - R, top: cy - R * tall, width: R * 2, height: R * 2 * tall, borderRadius: "50%", pointerEvents: "none", mixBlendMode: "screen", transform: slide, transition: ease });
  // `hollow`: light only the aureole around her, leaving her figure as painted.
  const fade = app.hollow
    ? "radial-gradient(closest-side, transparent 38%, #000 62%, rgba(0,0,0,.6) 82%, transparent 100%)"
    : "radial-gradient(closest-side, #000 26%, rgba(0,0,0,.55) 60%, transparent 100%)";
  const ring = "radial-gradient(circle, transparent 50%, #000 62%, #000 86%, transparent 97%)";
  const rays = app.rays === false ? "" : `repeating-conic-gradient(from calc(var(--ry, 0deg) * 5 - var(--rx, 0deg) * 5), transparent 0deg, ${app.color} 2.5deg, transparent 5deg, transparent 15deg), `;
  const glow = app.glow === false ? null : (
    <div aria-hidden="true" style={{ ...disc(r * (app.spread ?? 3.4) * 0.7), opacity: `calc(${rest * peak} + var(--lit, 0) * ${(1 - rest) * peak})`, WebkitMaskImage: fade, maskImage: fade,
      backgroundImage: `${rays}radial-gradient(closest-side, ${app.color} 0%, ${app.color}${app.hollow ? "" : "99"} ${app.hollow ? 80 : 37}%, transparent ${app.hollow ? 100 : 88}%)` }} />
  );
  const glint = app.glint === false ? null : (
    <div aria-hidden="true" style={{ ...disc(r * 1.35), opacity: "calc(.1 + var(--lit, 0) * .9)", WebkitMaskImage: ring, maskImage: ring,
      backgroundImage: "conic-gradient(from calc(var(--ry, 0deg) * 11 + var(--rx, 0deg) * 11), transparent 0deg, rgba(255,255,255,.95) 26deg, transparent 62deg, transparent 180deg, rgba(255,255,255,.8) 206deg, transparent 242deg, transparent 360deg)" }} />
  );
  // `over`: she is painted INTO the layer (a silhouette in the scene, a scorch on a tortilla), so the light goes on top of it.
  return app.over ? { glow: null, glint: <>{glow}{glint}</> } : { glow, glint };
}

// How far the card leans under the pointer, in degrees.
const MAX_TILT = 13;
const MIRROR_TEXT = "repeating-linear-gradient(115deg, #b97a00 0%, #ffd84a 14%, #fff6c4 22%, #ffd84a 30%, #b97a00 46%, #ffe58a 60%, #b97a00 76%)";

// `interactive` lets the card lean under the pointer (or a finger). The lean is
// written straight to CSS variables on the stage, never through React state, so
// following the pointer costs no re-render. Every metal tilts; the "mirror"
// metal also moves — its bands slide and a glare follows the pointer.
export default function RcanaCard3({ data, scale = 1, metal = "flat", interactive = false, className = "", style }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [ready, setReady] = useState(false);
  const stageRef = useRef(null);
  const lean = (e) => {
    const el = stageRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    const py = Math.min(1, Math.max(0, (e.clientY - box.top) / box.height));
    el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    el.style.setProperty("--rx", `${((0.5 - py) * 2 * MAX_TILT).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${((px - 0.5) * 2 * MAX_TILT).toFixed(2)}deg`);
    el.style.setProperty("--tx", ((px - 0.5) * 2).toFixed(3));
    el.style.setProperty("--ty", ((py - 0.5) * 2).toFixed(3));
    el.style.setProperty("--lit", Math.min(1, Math.hypot(px - 0.5, py - 0.5) * 2.4).toFixed(3));
    el.style.setProperty("--ease", "60ms");
  };
  const settle = () => {
    const el = stageRef.current;
    if (!el) return;
    el.style.setProperty("--ease", "500ms");
    for (const v of ["--mx", "--my", "--rx", "--ry", "--tx", "--ty", "--lit"]) el.style.removeProperty(v);
  };
  const layers = data?.artLayers || [];
  const sources = layers.map((l) => l.src).filter(Boolean).join("|");

  // Flag the card ready once its pictures have decoded (the face renderer waits for this).
  useEffect(() => {
    let live = true;
    setReady(false);
    const load = (src) => new Promise((resolve) => { const im = new window.Image(); im.onload = im.onerror = resolve; im.src = src; });
    const timer = setTimeout(() => live && setReady(true), 6000);
    Promise.all([...sources.split("|").filter(Boolean), SEAL].map(load)).then(() => { if (live) { clearTimeout(timer); setReady(true); } });
    return () => { live = false; clearTimeout(timer); };
  }, [sources]);

  if (!data) return null;
  const m = rcana3Model(data);
  const cw = 744 * scale;
  const foil = FOILS[metal] || null;
  const mirror = metal === "mirror";
  const apparition = APPARITIONS[data.id] || null;
  const plate = m.plate ? plateBox(m.plate.value) : null;
  const shapes = plate ? plateShapes(plate.w) : null;
  const nameSize = m.name.length <= 9 ? 54 : m.name.length <= 13 ? 44 : m.name.length <= 17 ? 36 : m.name.length <= 19 ? 34 : 30;
  // Rules and flavor are set in spaced capitals, so they run wide: size by length to hold three or four lines.
  const textSize = m.text.length <= 60 ? 17 : m.text.length <= 100 ? 14 : 12.5;
  const giltText = metal === "rainbow" ? { color: "transparent", backgroundImage: RAINBOW_TEXT, WebkitBackgroundClip: "text", backgroundClip: "text" }
    : mirror ? { color: "transparent", backgroundImage: MIRROR_TEXT, backgroundSize: "260% 100%", backgroundPosition: "calc(50% + (50% - var(--mx, 50%)) * 1.6) 50%", WebkitBackgroundClip: "text", backgroundClip: "text" }
    : { color: GILT };
  const abs = { position: "absolute", margin: 0 };
  const num = (size, fill = INK, extra = {}) => ({ fontFamily: NUM, fontSize: size, fill, textAnchor: "middle", ...extra });

  return (
    <div
      ref={stageRef}
      className={`rc-stage rc3-stage ${className}`}
      style={{ position: "relative", width: cw, height: (cw * H) / W, perspective: interactive ? cw * 2.6 : undefined, touchAction: interactive ? "none" : undefined, ...style }}
      onPointerMove={interactive ? lean : undefined}
      onPointerDown={interactive ? lean : undefined}
      onPointerLeave={interactive ? settle : undefined}
      onPointerUp={interactive ? (e) => { if (e.pointerType !== "mouse") settle(); } : undefined}
      onPointerCancel={interactive ? settle : undefined}
    >
      <div style={{ position: "absolute", inset: 0, transform: interactive ? "rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))" : undefined, transition: "transform var(--ease, 500ms) ease-out", willChange: interactive ? "transform" : undefined }}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Grenze+Gotisch:wght@800&family=Spectral:ital,wght@0,400;0,700;1,400&display=swap");`}</style>
      <div
        className="rc-card rc3-card"
        data-ready={ready ? "" : undefined}
        data-frame="3"
        data-metal={metal}
        style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `scale(${cw / W})`, transformOrigin: "0 0", borderRadius: 24, overflow: "hidden", background: GOLD, boxSizing: "border-box", aspectRatio: "auto", transition: "none" }}
      >
        <div style={{ ...abs, left: 5, top: 5, width: 502, height: 700, borderRadius: 19, background: INK }} />

        {/* The art: the card's own layers, placed as they were authored against the whole card, seen through the window. */}
        <div style={{ ...abs, left: 16, top: 16, width: 480, height: 470, borderRadius: 10, overflow: "hidden", background: data.backdrop && /^(url|linear|radial|conic|#|rgb|hsl)/.test(data.backdrop) ? data.backdrop : INK }}>
          <div style={{ ...abs, left: -16, top: -16, width: W, height: H }}>
            {layers.map((layer) => {
              if (!layer.src) return null;
              const slide = `translate(calc(${layer.offset?.x || 0}% - var(--tx, 0) * ${parallax(layer)}%), calc(${layer.offset?.y || 0}% - var(--ty, 0) * ${parallax(layer)}%))`;
              // The light is a small box, so its slide is in px of the card (a % would be of the box itself).
              const slidePx = `translate(calc(${((layer.offset?.x || 0) / 100) * W}px - var(--tx, 0) * ${((parallax(layer) / 100) * W).toFixed(2)}px), calc(${((layer.offset?.y || 0) / 100) * H}px - var(--ty, 0) * ${((parallax(layer) / 100) * H).toFixed(2)}px))`;
              const light = apparition && apparition.layer === layer.id ? haloLight(apparition, slidePx, interactive) : null;
              return (
                <React.Fragment key={layer.id}>
                  {light?.glow}
                  <img src={layer.src} alt="" draggable={false} decoding="async"
                style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", transform: `translate(calc(${layer.offset?.x || 0}% - var(--tx, 0) * ${parallax(layer)}%), calc(${layer.offset?.y || 0}% - var(--ty, 0) * ${parallax(layer)}%)) scale(${layer.scale ?? 1})`, transition: interactive ? "transform var(--ease, 500ms) ease-out" : undefined, filter: layer.filter || undefined }} />
                  {light?.glint}
                  {light && apparition.mask && (
                    <div aria-hidden="true" style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none",
                      transform: `${slide} scale(${layer.scale ?? 1})`, transition: interactive ? "transform var(--ease, 500ms) ease-out, opacity var(--ease, 500ms) ease-out" : undefined,
                      WebkitMaskImage: `url("${apparition.mask}")`, maskImage: `url("${apparition.mask}")`, WebkitMaskSize: "100% 100%", maskSize: "100% 100%",
                      opacity: apparition.maskLight
                        ? `calc(${(apparition.rest ?? 0.05) * (apparition.strength ?? 1)} + var(--lit, 0) * ${(1 - (apparition.rest ?? 0.05)) * (apparition.strength ?? 1)})`
                        : "calc(.12 + var(--lit, 0) * .88)",
                      ...(apparition.maskLight
                        // Light: the masked shape brightens in its own colour, with rays turning inside it.
                        ? { mixBlendMode: "screen", filter: `drop-shadow(0 0 5px ${apparition.color})`,
                            backgroundImage: `repeating-conic-gradient(from calc(var(--ry, 0deg) * 5 - var(--rx, 0deg) * 5) at ${apparition.cx}% ${apparition.cy}%, transparent 0deg, rgba(255,244,190,.5) 3deg, transparent 6deg, transparent 15deg), radial-gradient(circle at ${apparition.cx}% ${apparition.cy}%, #ffe9a0 0px, ${apparition.color} 45px, ${apparition.color} 200px)` }
                        // Embers: the masked shape burns from hot yellow at her out to deep red.
                        : { filter: "drop-shadow(0 0 2px #ff7a1a) drop-shadow(0 0 7px rgba(255, 80, 0, .85))",
                            backgroundImage: `radial-gradient(circle at ${apparition.cx}% ${apparition.cy}%, #ffe45c 0px, #ff8a1a calc(60px + var(--lit, 0) * 40px), #ff4400 calc(95px + var(--lit, 0) * 50px), #d92a00 190px)` }) }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
        <div style={{ ...abs, left: 14, top: 14, width: 480, height: 470, border: `2px solid ${GOLD}`, borderRadius: 12 }} />

        <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} style={{ ...abs, inset: 0, width: W, height: H, pointerEvents: "none" }}
          dangerouslySetInnerHTML={{ __html: filigreeMarkup(m, GILT) }} />

        {/* Top left: what it costs. */}
        {m.topLeft?.shape === "drop" && (
          <svg role="img" aria-label={m.topLeft.label} viewBox="0 0 100 116" style={{ ...abs, left: TL_DROP.x, top: TL_DROP.y, width: 96, height: 111 }}>
            <path d={DROP_OUTER} fill={INK} stroke={INK} strokeWidth="9" strokeLinejoin="round" />
            <path d={DROP_OUTER} fill={GOLD_LO} /><path d={DROP_INNER} fill={GOLD_HI} />
            <text x="50" y="94" style={num(50)}>{m.topLeft.value}</text>
          </svg>
        )}
        {m.topLeft?.shape === "coin" && (
          <svg role="img" aria-label={m.topLeft.label} viewBox="0 0 100 100" style={{ ...abs, left: TL.x, top: TL.y, width: 100, height: 100 }}>
            <circle cx="50" cy="50" r="49" fill={INK} /><circle cx="50" cy="50" r="45" fill={GOLD_LO} /><circle cx="50" cy="50" r="39" fill={GOLD_HI} />
            <circle cx="50" cy="50" r="33" fill="none" stroke={GOLD_LO} strokeWidth="2" />
            <text x="50" y={String(m.topLeft.value).length > 1 ? 69 : 75} style={num(String(m.topLeft.value).length > 2 ? 40 : String(m.topLeft.value).length > 1 ? 50 : 66)}>{m.topLeft.value}</text>
          </svg>
        )}

        {/* Top right: the plate. */}
        {plate && (
          <svg role="img" aria-label={m.plate.label} viewBox={`0 0 ${plate.w} 104`} style={{ ...abs, left: plate.x, top: 0, width: plate.w, height: 104 }}>
            <polygon points={shapes.hull} fill={INK} /><polygon points={shapes.rim} fill={GOLD} /><polygon points={shapes.field} fill={m.color} />
            <text x={plate.cx} y="84" style={num(62, GILT, { stroke: INK, strokeWidth: 6, paintOrder: "stroke", strokeLinejoin: "round" })}>{m.plate.value}</text>
            {m.plate.halo && <><ellipse cx={plate.cx} cy="20" rx="30" ry="8" fill="none" stroke={INK} strokeWidth="10" /><ellipse cx={plate.cx} cy="20" rx="30" ry="8" fill="none" stroke="#ffe066" strokeWidth="5" /></>}
          </svg>
        )}

        {/* The text box: a framed parchment plate, the ability or timing as a tab on its top edge. */}
        <div style={{ ...abs, left: 28, top: 440, width: 456, height: 154, boxSizing: "border-box", border: `2px solid ${GOLD}`, borderRadius: 12, background: PARCHMENT }} />
        <div style={{ ...abs, left: 35, top: 447, width: 442, height: 140, boxSizing: "border-box", border: "1px solid #b9892f", borderRadius: 7 }} />
        <div style={{ ...abs, left: 50, top: 462, width: 412, height: m.flavor ? 74 : 118, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ margin: 0, textAlign: "center", fontFamily: BODY, fontSize: textSize, lineHeight: 1.45, letterSpacing: "0.14em", textTransform: "uppercase", color: "#24160a" }}><RulesText text={m.text} /></p>
        </div>
        {m.flavor && (
          <>
            <svg aria-hidden="true" viewBox="0 0 160 12" style={{ ...abs, left: 176, top: 538, width: 160, height: 12 }}>
              <line x1="0" y1="6" x2="62" y2="6" stroke="#b9892f" strokeWidth="1.5" /><line x1="98" y1="6" x2="160" y2="6" stroke="#b9892f" strokeWidth="1.5" />
              <polygon points="80,1 86,6 80,11 74,6" fill={m.color} /><polygon points="68,3.5 71,6 68,8.5 65,6" fill="#b9892f" /><polygon points="92,3.5 95,6 92,8.5 89,6" fill="#b9892f" />
            </svg>
            <p style={{ ...abs, left: 50, top: 554, width: 412, textAlign: "center", fontFamily: BODY, fontSize: m.flavor.length > 48 ? 10 : 11.5, fontStyle: "italic", lineHeight: 1.3, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4a3520" }}>{m.flavor}</p>
          </>
        )}

        {/* Bottom left: a Trader's d8, or what an Asset pays each turn. */}
        {m.corner?.shape === "die" && (
          <svg role="img" aria-label={m.corner.label} viewBox="0 0 100 100" style={{ ...abs, left: BL_DIE.x, top: BL_DIE.y, width: 90, height: 90 }}>
            <polygon points={D8_HULL} fill={INK} stroke={INK} strokeWidth="8" strokeLinejoin="round" />
            <polygon points="50,5 11,30 9,75" fill="#c98a00" /><polygon points="50,5 89,30 91,75" fill="#a56c00" /><polygon points="9,75 91,75 50,96" fill="#5c3b00" /><polygon points="50,5 9,75 91,75" fill={GOLD_HI} />
            <text x="50" y="70" style={num(40)}>{m.corner.value}</text>
          </svg>
        )}
        {m.corner?.shape === "drop" && (
          <svg role="img" aria-label={m.corner.label} viewBox="0 0 100 116" style={{ ...abs, left: BL_DROP.x, top: BL_DROP.y, width: 78, height: 91 }}>
            <path d={DROP_OUTER} fill={INK} stroke={INK} strokeWidth="9" strokeLinejoin="round" />
            <path d={DROP_OUTER} fill={GOLD_LO} /><path d={DROP_INNER} fill={GOLD_HI} />
            <text x="50" y="90" style={num(38)}>{m.corner.value}</text>
          </svg>
        )}

        {/* The metal: polished gold or rainbow foil through the mask, over the flat gold beneath. */}
        {foil && (
          <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} style={{ ...abs, left: 0, top: 0, width: W, height: H }}>
            <defs>
              <linearGradient id={`${uid}-foil`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={foil.x2} y2={foil.y2} spreadMethod="repeat">
                {foil.stops.map(([offset, color]) => <stop key={offset} offset={offset} stopColor={color} />)}
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="430" y2="190" spreadMethod="repeat">
                <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="0.42" stopColor="#fff" stopOpacity="0" /><stop offset="0.5" stopColor="#fff" stopOpacity={foil.sheen} /><stop offset="0.58" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <mask id={`${uid}-metal`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H} dangerouslySetInnerHTML={{ __html: metalMaskMarkup(m) }} />
            </defs>
            <rect x="0" y="0" width={W} height={H} fill={`url(#${uid}-foil)`} mask={`url(#${uid}-metal)`} />
            <rect x="0" y="0" width={W} height={H} fill={`url(#${uid}-sheen)`} mask={`url(#${uid}-metal)`} />
          </svg>
        )}
        {/* The mirror: polished gold whose bands slide against the lean, under a glare that follows the pointer. */}
        {mirror && (
          <div aria-hidden="true" style={{ ...abs, left: 0, top: 0, width: W, height: H, WebkitMaskImage: metalMaskUrl(m), maskImage: metalMaskUrl(m), WebkitMaskSize: "100% 100%", maskSize: "100% 100%", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat" }}>
            <div style={{ ...abs, inset: 0, backgroundImage: "repeating-linear-gradient(calc(118deg + var(--ry, 0deg) * 1.6), #a06a00 0%, #d39a00 7%, #f2b705 13%, #fff6c4 19%, #ffd84a 25%, #c58600 36%, #a87000 44%, #ffe58a 55%, #fffbe0 59%, #f2b705 68%, #a06a00 100%)", backgroundSize: "320% 320%", backgroundPosition: "calc(50% + (50% - var(--mx, 50%)) * 1.5) calc(50% + (50% - var(--my, 50%)) * 1.5)", transition: "background-position var(--ease, 500ms) ease-out" }} />
            <div style={{ ...abs, inset: 0, mixBlendMode: "screen", backgroundImage: "radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,.95) 0%, rgba(255,246,196,.5) 16%, rgba(255,255,255,0) 42%)" }} />
          </div>
        )}
        {(foil || mirror) && (
          <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} style={{ ...abs, left: 0, top: 0, width: W, height: H }}>
            {/* The numerals the foil covered go back on top, in ink. */}
            {m.topLeft?.shape === "drop" && (
              <g transform={`translate(${TL_DROP.x},${TL_DROP.y}) scale(${TL_DROP.sx},${TL_DROP.sy})`}>
                <path d={DROP_INNER} fill="none" stroke="#3a1c00" strokeOpacity="0.45" strokeWidth="1.6" /><text x="50" y="94" style={num(50)}>{m.topLeft.value}</text>
              </g>
            )}
            {m.topLeft?.shape === "coin" && (
              <g transform={`translate(${TL.x},${TL.y})`}>
                <circle cx="50" cy="50" r="39" fill="none" stroke="#3a1c00" strokeOpacity="0.45" strokeWidth="1.6" />
                <text x="50" y={String(m.topLeft.value).length > 1 ? 69 : 75} style={num(String(m.topLeft.value).length > 2 ? 40 : String(m.topLeft.value).length > 1 ? 50 : 66)}>{m.topLeft.value}</text>
              </g>
            )}
            {m.corner?.shape === "drop" && (
              <g transform={`translate(${BL_DROP.x},${BL_DROP.y}) scale(${BL_DROP.sx},${BL_DROP.sy})`}>
                <path d={DROP_INNER} fill="none" stroke="#3a1c00" strokeOpacity="0.45" strokeWidth="1.6" /><text x="50" y="90" style={num(38)}>{m.corner.value}</text>
              </g>
            )}
          </svg>
        )}

        {/* The tab sits over the foil, so its lettering is never glazed. */}
        <div style={{ ...abs, left: 0, top: 423, width: W, display: "flex", justifyContent: "center" }}>
          <p style={{ margin: 0, height: 34, boxSizing: "border-box", padding: "0 22px", border: `2px solid ${GOLD}`, borderRadius: 8, background: m.color, color: "#ffe9a6", fontFamily: CAPS, fontSize: 21, lineHeight: "30px", letterSpacing: "0.14em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{m.tab}</p>
        </div>

        {/* The name band. */}
        <p style={{ ...abs, left: 0, top: 602, width: W, textAlign: "center", fontFamily: CAPS, fontSize: 15, letterSpacing: "0.34em", lineHeight: 1, textTransform: "uppercase", ...giltText }}>{m.typeLabel}</p>
        <div style={{ ...abs, left: 96, top: 618, width: 320, height: 58, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ margin: 0, whiteSpace: "nowrap", fontFamily: NAME, fontWeight: 800, fontSize: nameSize, lineHeight: 1, ...giltText }}>{m.name}</p>
        </div>

        {/* Bottom right: the seal over the collector number. */}
        <img src={SEAL} alt="The RL80 seal" draggable={false} style={{ ...abs, left: 434, top: 608, width: 60, height: 65, display: "block" }} />
        {m.collector && <p style={{ ...abs, left: 434, top: 678, width: 60, textAlign: "center", fontFamily: CAPS, fontSize: 13, letterSpacing: "0.12em", lineHeight: 1, color: "#e6d3a0" }}>{m.collector}</p>}
      </div>
      </div>
    </div>
  );
}
