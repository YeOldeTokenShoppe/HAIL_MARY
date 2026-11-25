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
//   top left      what the card costs — a COIN on every card (on a Trader it is their
//                 Money: the cost is also what they make each turn);
//                 no badge at all on a card that is free or fires when drawn
//   top right     the plate, the card's headline number — Credibility under a
//                 halo on a Trader, the sale price on an Asset, the payout on a
//                 called Event; in the card type's colour
//   bottom left   a d8 for a Trader's Equanimity; a small drop for what an
//                 Asset pays each turn
//   bottom right  the RL80 seal over the collector number
//
// Trader numbers come from src/game/rcana/set/trinity.js (the Playtest 3
// trinity). All money is printed in $M: an old cost of 3 is 30, and a Trader's
// Liquidity 2 is 20. Equanimity is a d8 target and stays a single digit.
//
// It keeps RcanaCard's outer class names (.rc-stage, .rc-card[data-ready]) so
// scripts/rcana-render-faces.mjs can screenshot it unchanged.
import React, { useEffect, useId, useRef, useState } from "react";
import { designByKey } from "@/game/rcana/set/designs.js";
import { TRINITY, TRINITY_TEXT, MONEY_UNIT, ATTRS, ETHOS_UNIT, TRADER_INCOME, MARKET } from "@/game/rcana/set/trinity.js";
import { oneMoney } from "@/game/rcana/set/oneMoney.js";
import { APPARITIONS } from "@/game/rcana/set/apparitions.js";
import { RCANA_SET } from "@/game/rcana/cardFace";
import RcanaLive3D from "./RcanaLive3D";

export const RCANA3_METALS = ["flat", "gold", "mirror", "rainbow"];
// The metals an art file's `metalFrame` carries into this frame. Only rainbow:
// the painted frame's "gold" is a border laid over a lotería frame, and this
// frame is gold already, so it means nothing here.
export const RCANA3_CARD_METALS = ["rainbow"];
// The metal a card is drawn in: the caller's choice if it made one, else the
// card's own (the Lowrider and the Fire Horse ship rainbow), else the fallback.
// So a binder or print route can pass null to mean "whatever the card says".
export const rcana3MetalFor = (data, chosen, fallback = "flat") =>
  (RCANA3_METALS.includes(chosen) ? chosen : null)
  ?? (RCANA3_CARD_METALS.includes(data?.metalFrame) ? data.metalFrame : null)
  ?? fallback;

// THE TRINITY TRIANGLE (2026-11-20). A Trader's three attributes as one figure: Ethos at the top, Pathos
// bottom left, Logos bottom right, the numerals on the corners. The filled shape reaches toward each
// corner by that attribute (1-4), so a Trader's lean shows before a number is read. Drawn for parchment.
// What each attribute means, in plain words, for the corner's tooltip. ONE GLOSSARY everywhere (card, table,
// rules): Logos is insight, Ethos is character, Pathos is nerve.
export const attrTip = (k, n) => ({
  logos: ["Insight", n > 1 ? `When you draw for your turn, look at ${n} cards and keep one.` : "You draw the top card of the deck, unseen."],
  ethos: ["Character", TRADER_INCOME ? `In good standing, you make $${n * ETHOS_UNIT}M more each turn.` : `In good standing, each Asset you sell pays $${n * ETHOS_UNIT}M more.`],
  pathos: ["Nerve", `A Calamity played on you fails on a d8 roll of ${n} or lower.`],
}[k]);
// Hover, focus or tap a corner: its circle inverts (gold with an ink numeral) and `tipBox`, a rectangle in
// card units beside the triangle, shows what that attribute is and does. A still render shows neither.
function Trinity({ at, color, style, tipBox }) {
  const [tip, setTip] = useState(null);
  const V = { ethos: [65, 34], pathos: [24, 104], logos: [106, 104] }; const C = [65, 80.7];
  const reach = (k) => { const t = Math.min(1, at[k] / 4); return [C[0] + (V[k][0] - C[0]) * t, C[1] + (V[k][1] - C[1]) * t]; };
  const P = (list) => list.map((p) => p.join(",")).join(" ");
  const name = { fontFamily: CAPS, fontSize: 10.5, letterSpacing: "0.16em", fill: "#4a3520", textAnchor: "middle" };
  const keys = ["ethos", "pathos", "logos"];
  const label = (k) => k[0].toUpperCase() + k.slice(1);
  return (
    <>
      <svg role="group" aria-label={`Ethos ${at.ethos}, Pathos ${at.pathos}, Logos ${at.logos}`} viewBox="0 0 130 130" style={style}>
        <polygon points={P(keys.map((k) => V[k]))} fill="#ecdba6" stroke="#b9892f" strokeWidth="2" strokeLinejoin="round" />
        {keys.map((k) => <line key={k} x1={C[0]} y1={C[1]} x2={V[k][0]} y2={V[k][1]} stroke="#b9892f" strokeWidth="1" strokeOpacity=".55" />)}
        <polygon points={P(keys.map(reach))} fill={color} fillOpacity=".8" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
        {keys.map((k) => { const on = tip === k; return (
          <g key={k} role="button" tabIndex={0} aria-label={`${label(k)} ${at[k]}: ${attrTip(k, at[k]).join(". ")}`} style={{ cursor: "help", outline: "none" }}
            onMouseEnter={() => setTip(k)} onMouseLeave={() => setTip(null)} onFocus={() => setTip(k)} onBlur={() => setTip(null)}
            onClick={(e) => { e.stopPropagation(); setTip(on ? null : k); }} onPointerDown={(e) => e.stopPropagation()}>
            <circle cx={V[k][0]} cy={V[k][1]} r="18" fill="transparent" />
            <circle cx={V[k][0]} cy={V[k][1]} r="13" fill={on ? GILT : INK} stroke={on ? INK : "#b9892f"} strokeWidth="2" style={{ transition: "fill 120ms, stroke 120ms" }} />
            <text x={V[k][0]} y={V[k][1] + 6.5} style={{ fontFamily: NUM, fontSize: 18, fill: on ? INK : GILT, textAnchor: "middle", transition: "fill 120ms", pointerEvents: "none" }}>{at[k]}</text>
          </g>
        ); })}
        <text x={V.ethos[0]} y="15" style={name}>ETHOS</text><text x={V.pathos[0] + 4} y="128" style={name}>PATHOS</text><text x={V.logos[0] - 2} y="128" style={name}>LOGOS</text>
      </svg>
      {tip && tipBox && (
        <div role="tooltip" style={{ position: "absolute", margin: 0, ...tipBox, boxSizing: "border-box", padding: "10px 14px", borderRadius: 8, background: INK, border: `1.5px solid ${GOLD}`, display: "flex", flexDirection: "column", justifyContent: "center", gap: 6, textAlign: "center", pointerEvents: "none" }}>
          <p style={{ margin: 0, fontFamily: CAPS, fontSize: 19, letterSpacing: "0.14em", lineHeight: 1, color: GILT, textTransform: "uppercase" }}>{label(tip)} {at[tip]} · {attrTip(tip, at[tip])[0]}</p>
          <p style={{ margin: 0, fontFamily: BODY, fontSize: 14.5, lineHeight: 1.35, color: "#f6e7b8" }}>{attrTip(tip, at[tip])[1]}</p>
        </div>
      )}
    </>
  );
}

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
  // A FATE (2026-11-24): an Event that happens to the whole table. It is turned from the shared deck, never played from a hand,
  // so it has no price and no payout plate, and its tab reads FATE. The market cards (MARKET) are Fates too.
  const firesOnDraw = (design.type === "event" && !design.played) || MARKET[key] != null;
  const model = {
    id: data.id,
    cls,
    color: cls === "Trader" ? CLASS_COLOR.Trader : data.keywordColor || CLASS_COLOR[cls] || CLASS_COLOR.Artifact,
    name: data.name || "",
    typeLabel: cls === "Trader" || cls === "Asset" ? cls : data.subClass || cls,
    tab: cls === "Trader" ? data.abilityName || "Trader" : firesOnDraw ? "Fate" : data.keyword || data.subClass || cls,
    text: TRINITY_TEXT[key] || oneMoney(data.ability, cls),
    flavor: data.flavor ? (data.flavorQuoted ? `“${data.flavor}”` : data.flavor) : null,
    collector: data.collector ? `${data.collector.number} / ${data.collector.of}` : null,
    apparition: !!design.apparition, // one of the cards with Our Lady's image: an eight-pointed star by the type line
    // The keyword badge at the head of the text box. An apparition wears Radi8; a card with Saving Face (it may be given up
    // from the hand to keep a Trader from disgrace) wears that. No card has both.
    keyword: design.apparition ? { ...APPARITION_KEYWORD, star: true } : design.savingGrace ? SAVING_FACE_KEYWORD : null,
    topLeft: null, plate: null, corner: null, attrs: null,
  };
  if (trinity) {
    // MONEY in the coin, like every other card's price: what the Trader costs to play and makes each turn.
    // Their character is the trinity triangle in the text box (ATTRS in trinity.js), not badges in the corners.
    const liqM = trinity.liq * MONEY_UNIT;
    // Trade only (2026-11-24): a Trader is free and earns no salary, so there is no coin on a Trader card.
    if (TRADER_INCOME) model.topLeft = { shape: "coin", value: liqM, label: `Money: makes $${liqM}M a turn` };
    model.attrs = ATTRS[key] || null;
  } else {
    const cost = Number(data.cost) || 0;
    // No coin means nothing to pay: a card that fires when drawn, or one that is free to play.
    if (!firesOnDraw && cost > 0) model.topLeft = { shape: "coin", value: cost * MONEY_UNIT, label: `Price: $${cost * MONEY_UNIT}M to play` };
    // A card with a choice of now or later (The Inheritance: cash at once, or more in trust) shows the SURE amount, the one paid at once.
    const sure = design.type === "event" && design.choice && design.trust ? design.cash * MONEY_UNIT : null;
    const value = sure ?? (cls === "Asset" ? (design.perp ? design.pros * 2 : design.pros) : design.type === "event" && design.played && !firesOnDraw ? design.pros : null);
    if (value) model.plate = { value, halo: false, label: sure ? `Pays $${value}M at once, or more in trust` : cls === "Asset" ? `Sells for $${value}M` : `Pays $${value}M` };
    if (!model.text && value) model.text = cls === "Asset" ? `Sell it for $${value}M.` : `Collect $${value}M.`;
    if (design.income) model.corner = { shape: "drop", value: design.income * MONEY_UNIT, label: `Pays $${design.income * MONEY_UNIT}M each turn while held` };
  }
  return model;
}

// The numeral in the top-left drop: two digits ($M) sit smaller and a touch higher than one.
const dropNum = (value) => (String(value).length > 1 ? { size: 40, y: 91 } : { size: 50, y: 94 });
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
// LIQUID METAL (layer.liquid): quicksilver standing in a vessel, drawn live over the layer's own painted liquid.
//   mask   an image the size of the layer, opaque wherever liquid could be (the inside of the vessel)
//   box    { x, y, w, h } the part of the layer the mask's shape occupies, in %: only that much is drawn
//   level  where the surface rests, in % of the layer's height; cx, rx its middle and half-width there, in %
// It is a small simulation, not a loop: the surface is a spring that leans the way the card is tipped (the liquid
// keeps to its own level, as in a spirit level), overshoots and settles, and ripples while it is moving. The metal is
// painted each frame: a steel gradient, bright and dark bands that drift like reflections on chrome, the room's red
// on one side and a cold blue on the other, and the bright ellipse of the surface seen from just above.
function LiquidMetal({ spec, slide, scale }) {
  const ref = useRef(null);
  const bx = (spec.box.x / 100) * W, by = (spec.box.y / 100) * H, bw = (spec.box.w / 100) * W, bh = (spec.box.h / 100) * H;
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const stage = cv.closest(".rc-stage"), ctx = cv.getContext("2d");
    const dpr = Math.min(2, (typeof window !== "undefined" && window.devicePixelRatio) || 1);
    cv.width = Math.round(bw * dpr); cv.height = Math.round(bh * dpr);
    const y0 = ((spec.level - spec.box.y) / 100) * H, cx = ((spec.cx - spec.box.x) / 100) * W, rx = (spec.rx / 100) * W, LIMIT = spec.lean ?? 0.14;
    let a = 0, v = 0, last = performance.now(), raf = 0;
    // A band is laid down in four coats, a little wider than its core to narrow: a crisp, bright middle (what
    // makes it read as polished metal) with one soft step at the edge. Seven wide coats blended better and went milky.
    const band = (yc, amp, freq, phase, thick, rgb, alpha) => {
      const color = `rgba(${rgb},${(alpha * 0.8).toFixed(3)})`;
      for (let pass = 0; pass < 4; pass++) { const th = thick * (1.22 - pass * 0.27); ctx.beginPath();
        for (let x = -4; x <= bw + 4; x += 6) { const y = yc + amp * Math.sin(x * freq + phase) + amp * 0.45 * Math.sin(x * freq * 2.3 - phase * 1.7); if (x < 0) ctx.moveTo(x, y - th / 2); else ctx.lineTo(x, y - th / 2); }
        for (let x = bw + 4; x >= -4; x -= 6) { const y = yc + amp * Math.sin(x * freq + phase) + amp * 0.45 * Math.sin(x * freq * 2.3 - phase * 1.7); ctx.lineTo(x, y + th / 2 + th * 0.35 * Math.sin(x * 0.03 + phase)); }
        ctx.closePath(); ctx.fillStyle = color; ctx.fill(); }
    };
    const draw = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000); last = now; const t = now / 1000;
      const tx = stage ? parseFloat(stage.style.getPropertyValue("--tx")) || 0 : 0;
      v += (-(a - -tx * LIMIT * 0.8) * 46 - v * 2.6) * dt; a += v * dt; a = Math.max(-LIMIT, Math.min(LIMIT, a)); // a slow, heavy slosh
      const amp = Math.min(3.2, Math.abs(v) * 16 + 0.35), slope = Math.tan(a);
      const surf = (x) => y0 + slope * (x - cx) + amp * Math.sin(x * 0.05 + t * 5.1) + amp * 0.55 * Math.sin(x * 0.11 - t * 7.3);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, bw, bh);
      ctx.save(); ctx.beginPath(); ctx.moveTo(-2, surf(-2)); for (let x = 4; x <= bw + 6; x += 6) ctx.lineTo(x, surf(x)); ctx.lineTo(bw + 2, bh + 2); ctx.lineTo(-2, bh + 2); ctx.closePath(); ctx.clip();
      const g = ctx.createLinearGradient(0, y0 - 14, 0, bh);
      g.addColorStop(0, "#f2f6fa"); g.addColorStop(0.1, "#98a2b0"); g.addColorStop(0.32, "#2b313c"); g.addColorStop(0.6, "#0e1117"); g.addColorStop(0.85, "#566170"); g.addColorStop(1, "#aab4c0");
      ctx.fillStyle = g; ctx.fillRect(-2, -2, bw + 4, bh + 4);
      const span = bh - y0, drift = t * 0.55 + tx * 1.6;
      ctx.globalCompositeOperation = "screen";
      band(y0 + span * 0.22, 9, 0.021, drift, span * 0.13, "235,242,250", 0.30);
      band(y0 + span * 0.52, 12, 0.017, -drift * 0.8 + 2, span * 0.09, "200,214,230", 0.22);
      band(y0 + span * 0.83, 7, 0.026, drift * 1.3 + 4, span * 0.10, "245,248,252", 0.30);
      const red = ctx.createRadialGradient(cx + rx * (0.62 - tx * 0.2), y0 + span * 0.45, 2, cx + rx * (0.62 - tx * 0.2), y0 + span * 0.45, rx * 0.75);
      red.addColorStop(0, "rgba(255,40,66,.55)"); red.addColorStop(1, "rgba(255,40,66,0)"); ctx.fillStyle = red; ctx.fillRect(0, 0, bw, bh);
      const blue = ctx.createRadialGradient(cx - rx * (0.66 + tx * 0.2), y0 + span * 0.5, 2, cx - rx * (0.66 + tx * 0.2), y0 + span * 0.5, rx * 0.6);
      blue.addColorStop(0, "rgba(110,185,255,.40)"); blue.addColorStop(1, "rgba(110,185,255,0)"); ctx.fillStyle = blue; ctx.fillRect(0, 0, bw, bh);
      ctx.globalCompositeOperation = "multiply";
      band(y0 + span * 0.36, 10, 0.019, drift * 0.9 + 1, span * 0.10, "40,46,60", 0.55);
      band(y0 + span * 0.69, 8, 0.023, -drift * 1.1 + 3, span * 0.08, "40,46,60", 0.50);
      ctx.globalCompositeOperation = "source-over"; ctx.restore();
      // the surface, seen from just above: a bright ellipse that leans with the liquid
      ctx.save(); ctx.translate(cx, y0 + amp * 0.3 * Math.sin(t * 5.1)); ctx.rotate(a);
      const top = ctx.createLinearGradient(0, -7, 0, 7); top.addColorStop(0, "#8e99a8"); top.addColorStop(0.45, "#eef3f8"); top.addColorStop(1, "#c3ccd7");
      ctx.beginPath(); ctx.ellipse(0, 0, rx * 1.04, 6.5, 0, 0, Math.PI * 2); ctx.fillStyle = top; ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-rx * 0.2 + tx * rx * 0.25, -0.5, rx * 0.42, 2.2, 0, 0, Math.PI * 2); ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.fill();
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [spec, bw, bh]);
  const mask = { WebkitMaskImage: `url("${spec.mask}")`, maskImage: `url("${spec.mask}")`, WebkitMaskSize: `${W}px ${H}px`, maskSize: `${W}px ${H}px`, WebkitMaskPosition: `${-bx}px ${-by}px`, maskPosition: `${-bx}px ${-by}px`, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat" };
  return (
    <div aria-hidden="true" style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", transform: `${slide} scale(${scale})`, transition: "transform var(--ease, 500ms) ease-out" }}>
      <canvas ref={ref} style={{ position: "absolute", left: bx, top: by, width: bw, height: bh, ...mask }} />
    </div>
  );
}
// THE NAME'S SIZE. A short name (nine letters or fewer) is set at 54. A longer one is set as large as will run
// about 272px, between 28 and 46, by its real width and not its letter count: "Lottery Ticket" is all narrow
// letters and "Enigma Machine" is not, though both are fourteen long. The widths are Grenze Gotisch 800's, in em,
// measured from the set's own titles (within 5% on every one).
const NAME_EM = { space: 0.174, narrow: 0.303, wide: 0.702, upper: 0.464, digit: 0.493, other: 0.482 };
function nameSizeFor(name) {
  const text = String(name || "");
  if (text.length <= 9) return 54;
  let em = 0;
  for (const c of text) em += c === " " ? NAME_EM.space : "iljtfrI'’.-/".includes(c) ? NAME_EM.narrow : "mwMW".includes(c) ? NAME_EM.wide : /[0-9]/.test(c) ? NAME_EM.digit : c !== c.toLowerCase() ? NAME_EM.upper : NAME_EM.other;
  return Math.max(28, Math.min(46, Math.round(272 / em)));
}
// THE APPARITION KEYWORD: the name on the badge every apparition card wears, and the reminder beside it.
// One place to rename it.
// THE WHEEL (layer.spin, layer.tick). A throw turns the wheel from one angle to another along one eased curve; the
// pegs sit on the wedge lines, 45 degrees apart, so the moments a peg passes the flapper follow from the same numbers:
// at each one the flapper is pushed aside and drops back, fast at the throw and slower as the wheel runs down.
const SPIN_EASE = [0.16, 0.55, 0.12, 1];
function tickFrames(from, to) {
  const bez = (t, a, b) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  const when = (y) => { let lo = 0, hi = 1; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (bez(mid, SPIN_EASE[1], SPIN_EASE[3]) < y) lo = mid; else hi = mid; } return bez((lo + hi) / 2, SPIN_EASE[0], SPIN_EASE[2]); };
  const at = [];
  for (let deg = Math.ceil((from - 22.5) / 45) * 45 + 22.5; deg < to; deg += 45) if (deg > from) at.push(when((deg - from) / (to - from)));
  const out = [{ offset: 0, rotate: "0deg" }];
  at.forEach((p, i) => { const before = i ? p - at[i - 1] : p, after = i < at.length - 1 ? at[i + 1] - p : 1 - p;
    const pre = Math.min(before * 0.45, 0.06), post = Math.min(after * 0.3, 0.0125), push = Math.min(19, 9 + before * 240);
    out.push({ offset: p - pre, rotate: "0deg" }, { offset: p, rotate: `${(-push).toFixed(1)}deg` }, { offset: p + post, rotate: "0deg" }); });
  out.push({ offset: 1, rotate: "0deg" });
  return out;
}

// The flapper's sound: one short wooden click for each peg, made here (no sound file), each set for the moment its peg
// passes (`times`, in seconds from now). Only a throw the player makes is heard: a browser plays nothing until the page
// has been clicked, and a card that clicked away by itself would be a nuisance. Returns how to silence what is left.
let wheelAudio = null, wheelNoise = null;
function wheelClicks(times) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    const ctx = wheelAudio || (wheelAudio = new AC()); if (ctx.state === "suspended") ctx.resume();
    if (!wheelNoise) { wheelNoise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.03), ctx.sampleRate); const d = wheelNoise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); }
    const out = ctx.createGain(); out.gain.value = 0.45; out.connect(ctx.destination);
    const t0 = ctx.currentTime + 0.03;
    times.forEach((s, i) => { const t = t0 + s, f = 1250 + ((i * 7) % 5) * 60;
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = "triangle"; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.5, t + 0.03);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.06);
      const n = ctx.createBufferSource(), band = ctx.createBiquadFilter(), ng = ctx.createGain(); n.buffer = wheelNoise; band.type = "bandpass"; band.frequency.value = 2600; band.Q.value = 1.2; ng.gain.value = 0.7;
      n.connect(band); band.connect(ng); ng.connect(out); n.start(t); });
    return () => { try { out.gain.value = 0; out.disconnect(); } catch { /* already gone */ } };
  } catch { return null; }
}

export const APPARITION_KEYWORD = { name: "Radi8", gift: "One more action, and a Miracle" };
export const SAVING_FACE_KEYWORD = { name: "Saving Face", gift: "Discard it to stop a disgrace" };
// FULL ART (data.fullArt, from the card's art file): the picture fills the frame from top to bottom. There
// is no text box: the rules, the flavor line and the name are set straight on the art, in white (the name in
// gold) with a dark outline, over a shade that deepens toward the foot of the card so they always read.
const FULL_ART_H = 678; // the window's height on a full-art card (470 on the others)
// The gold lettering (the name, the type) may be a clipped gradient, which an outline would cover: it gets a dark edge as a shadow.
const ON_ART_GILT = "drop-shadow(0 0 1.5px #0a0613) drop-shadow(0 0 1.5px #0a0613) drop-shadow(0 2px 4px rgba(5,3,12,.9))";
const ON_ART = { WebkitTextStroke: "3.2px #0a0613", paintOrder: "stroke fill", textShadow: "0 1px 5px rgba(5,3,12,.9)" };
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
function metalMaskMarkup(model, fullArt = false) {
  const plate = model.plate ? plateBox(model.plate.value) : null;
  const shapes = plate ? plateShapes(plate.w) : null;
  const drop = (at) => `<g transform="translate(${at.x},${at.y}) scale(${at.sx},${at.sy})"><path d="${DROP_OUTER}" fill="#000" stroke="#000" stroke-width="9" stroke-linejoin="round"/><path d="${DROP_OUTER}" fill="#fff"/></g>`;
  return [
    `<rect x="0" y="0" width="${W}" height="${H}" fill="#000"/>`,
    `<rect x="0" y="0" width="${W}" height="${H}" rx="24" fill="#fff"/>`,
    `<rect x="5" y="5" width="502" height="700" rx="19" fill="#000"/>`,
    // A full-art card has one window, the height of the card, and no text box.
    ...(fullArt ? [`<rect x="15" y="15" width="482" height="${FULL_ART_H + 2}" rx="11" fill="none" stroke="#fff" stroke-width="2"/>`] : [
    `<rect x="15" y="15" width="482" height="472" rx="11" fill="none" stroke="#fff" stroke-width="2"/>`,
    `<rect x="28" y="440" width="456" height="154" rx="12" fill="#000"/>`,
    `<rect x="29" y="441" width="454" height="152" rx="11" fill="none" stroke="#fff" stroke-width="2"/>`]),
    filigreeMarkup(model, "#fff"),
    model.topLeft?.shape === "drop" ? drop(TL_DROP) : "",
    model.topLeft?.shape === "coin" ? `<g transform="translate(${TL.x},${TL.y})"><circle cx="50" cy="50" r="49" fill="#000"/><circle cx="50" cy="50" r="45" fill="#fff"/></g>` : "",
    plate ? `<g transform="translate(${plate.x},0)"><polygon points="${shapes.hull}" fill="#000"/><polygon points="${shapes.rim}" fill="#fff"/><polygon points="${shapes.field}" fill="#000"/>${model.plate.halo ? `<ellipse cx="${plate.cx}" cy="20" rx="30" ry="8" fill="none" stroke="#000" stroke-width="10"/><ellipse cx="${plate.cx}" cy="20" rx="30" ry="8" fill="none" stroke="#fff" stroke-width="5"/>` : ""}</g>` : "",
    model.corner?.shape === "drop" ? drop(BL_DROP) : "",
  ].join("");
}
// The same mask as a CSS image: opaque where the metal is, clear elsewhere.
function metalMaskUrl(model, fullArt = false) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">${metalMaskMarkup(model, fullArt)}</mask></defs><rect width="${W}" height="${H}" fill="#fff" mask="url(#m)"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

// Parallax: how far a layer slides against the lean, as a % of the card, from
// the depth its art file gives it (z, negative = further back; the scene sits
// at about -68, the subject at about -22, props up to +118). The window is a box the
// art sits behind, so the deepest layer travels furthest. Kept inside the
// slack the art has past the window's edge (3%, plus the scene's overscale).
// Props in front of the window (positive z) slide the other way.
// LIGHTNING (layer.bolts: { cx, cy, rx, ry } an ellipse in % of the layer, with optional count and color): forks
// that leap outward from the ellipse's edge, each on its own clock. Drawn from a seeded sequence, so every
// render of the card draws the same forks. In px of the card (the layer covers it).
function boltPaths(spec) {
  let seed = 88; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const cx = (spec.cx / 100) * W, cy = (spec.cy / 100) * H, rx = (spec.rx / 100) * W, ry = (spec.ry / 100) * H, n = spec.count || 14;
  return Array.from({ length: n }, (_, i) => {
    const a = ((i + rnd() * 0.7) / n) * Math.PI * 2, ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
    let x = cx + rx * ux * (0.94 + rnd() * 0.1), y = cy + ry * uy * (0.94 + rnd() * 0.1);
    const len = 58 + rnd() * 72, steps = 5; let d = `M${x.toFixed(1)} ${y.toFixed(1)}`, fork = "";
    for (let k = 1; k <= steps; k++) {
      const j = (rnd() - 0.5) * 22; x += (ux * len) / steps + px * j; y += (uy * len) / steps + py * j; d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      if (k === 2) { const t = rnd() < 0.5 ? 0.6 : -0.6, fx = ux * Math.cos(t) - uy * Math.sin(t), fy = ux * Math.sin(t) + uy * Math.cos(t), fl = len * 0.42;
        fork = `M${x.toFixed(1)} ${y.toFixed(1)} L${(x + fx * fl * 0.5 + (rnd() - 0.5) * 9).toFixed(1)} ${(y + fy * fl * 0.5 + (rnd() - 0.5) * 9).toFixed(1)} L${(x + fx * fl).toFixed(1)} ${(y + fy * fl).toFixed(1)}`; }
    }
    const period = 1.7 + rnd() * 2.3;
    return { d: `${d} ${fork}`, period, delay: -rnd() * period };
  });
}
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
  // `open`: the glint's ring is left open at the foot, over that many degrees, so it runs round her head and down to
  // her shoulders but does not cross her throat and chest, where there is no ring painted for it to ride.
  const half = (app.open || 0) / 2, gap = half ? `, conic-gradient(from 180deg, transparent ${Math.max(0, half - 12)}deg, #000 ${half + 12}deg, #000 ${360 - half - 12}deg, transparent ${Math.min(360, 360 - half + 12)}deg)` : "";
  const glint = app.glint === false ? null : (
    <div aria-hidden="true" style={{ ...disc(r * 1.35), opacity: "calc(.1 + var(--lit, 0) * .9)", WebkitMaskImage: ring + gap, maskImage: ring + gap, ...(gap ? { WebkitMaskComposite: "source-in", maskComposite: "intersect" } : null),
      backgroundImage: "conic-gradient(from calc(var(--ry, 0deg) * 11 + var(--rx, 0deg) * 11), transparent 0deg, rgba(255,255,255,.95) 26deg, transparent 62deg, transparent 180deg, rgba(255,255,255,.8) 206deg, transparent 242deg, transparent 360deg)" }} />
  );
  // `over`: she is painted INTO the layer (a silhouette in the scene, a scorch on a tortilla), so the light goes on top of it.
  return app.over ? { glow: null, glint: <>{glow}{glint}</> } : { glow, glint };
}

// How far the card leans, in degrees: under a mouse it follows the pointer's place on the card; under a
// finger or a pen it is DRAGGED, and turns much further, because a finger covers the card it is turning
// and there is no hover to explore with. A phone or tablet that reports its own tilt turns the card too.
const MAX_TILT = 18;        // mouse: the pointer at the card's edge
const MAX_TILT_TOUCH = 34;  // finger or pen: a full drag
const MAX_TILT_GYRO = 26;   // the device itself, tipped about 25 degrees
// Steering the card by tipping the phone or tablet is OFF (2026-11-23): it never came alive on a real iPad or
// iPhone, and the finger drag does the job. The code is kept; set this true to try it again (iOS will ask the
// person for motion access on their first tap of a live card).
const DEVICE_TILT = false;
const clamp1 = (v) => Math.max(-1, Math.min(1, v));
const MIRROR_TEXT = "repeating-linear-gradient(115deg, #b97a00 0%, #ffd84a 14%, #fff6c4 22%, #ffd84a 30%, #b97a00 46%, #ffe58a 60%, #b97a00 76%)";

// THE TELEVISION (layer.screen): an advertisement, drawn live on a layer that is only a set's screen glass. The layer's own
// shape is the mask, so the picture keeps to the curved tube. `box` is the glass in % of the layer; `ad` is the copy:
// { kicker, kicker2, price, sub, burst, phone, name, lines: [..], fine }. The picture is laid out at 400 x 300 and scaled
// to the box. On the live card it runs a 15 second spot (the offer; "but wait"; the order screen; a blink of snow) under
// tape grain, scan lines, a tracking bar and a colour fringe. On a still it shows the offer, and nothing moves.
// After "But Wait!" by Gymnase (CodePen): the phases and the VHS overlays are that pen's idea; the code and copy are ours.
const AD_NOISE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";
const AD_BURST = "polygon(50% 0%, 58% 15%, 72% 5%, 72% 22%, 89% 19%, 82% 34%, 99% 39%, 86% 50%, 99% 61%, 82% 66%, 89% 81%, 72% 78%, 72% 95%, 58% 85%, 50% 100%, 42% 85%, 28% 95%, 28% 78%, 11% 81%, 18% 66%, 1% 61%, 14% 50%, 1% 39%, 18% 34%, 11% 19%, 28% 22%, 28% 5%, 42% 15%)";
function AdScreen({ spec, src, live, uid, w, h }) {
  const ad = spec.ad || {}, box = spec.box || { x: 0, y: 0, w: 100, h: 100 }, T = spec.period || 15;
  const ink = "#f3e39a", shade = "#0b0820", fill = { position: "absolute", inset: 0 };
  const on = (name, shown) => ({ opacity: shown ? 1 : 0, ...(live ? { animation: `${name} ${T}s steps(1, end) infinite` } : null) });
  const txt = { position: "absolute", margin: 0, width: "100%", textAlign: "center", textTransform: "uppercase", textShadow: `.06em .07em 0 ${shade}`, whiteSpace: "nowrap" };
  return (
    <div aria-hidden="true" style={{ ...fill, WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" }}>
      <style>{`@keyframes rc3-ad-a { 0% { opacity: 1; } 58% { opacity: 0; } }
        @keyframes rc3-ad-k1 { 0% { opacity: 1; } 33% { opacity: 0; } }
        @keyframes rc3-ad-k2 { 0% { opacity: 0; } 33% { opacity: 1; } 58% { opacity: 0; } }
        @keyframes rc3-ad-burst { 0% { opacity: 0; } 25% { opacity: 1; } 33% { opacity: 0; } }
        @keyframes rc3-ad-b { 0% { opacity: 0; } 58% { opacity: 1; } 94% { opacity: 0; } }
        @keyframes rc3-ad-snow { 0% { opacity: 0; } 94% { opacity: 1; } }
        @keyframes rc3-ad-throb { from { scale: .94; } to { scale: 1.08; } }
        @keyframes rc3-ad-grain { to { background-position: 560px 360px; } }
        @keyframes rc3-ad-track { 0%, 84% { translate: 0 304px; opacity: 0; } 85%, 97% { opacity: .9; } 100% { translate: 0 -16px; opacity: 0; } }
        @keyframes rc3-ad-jitter { 12% { translate: 0 1px; } 13%, 30% { translate: 0 0; } 31% { translate: .6px 0; } 33%, 71% { translate: 0 0; } 72% { translate: -.5px .3px; } 73% { translate: 0 0; } }
        @keyframes rc3-ad-glow { 0%, 100% { opacity: .55; } 8% { opacity: .9; } 21% { opacity: .5; } 37% { opacity: .85; } 52% { opacity: .6; } 68% { opacity: 1; } 81% { opacity: .5; } }`}</style>
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter id={`${uid}tape`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation=".7 .12" result="soft" />
          <feColorMatrix in="soft" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" /><feGaussianBlur stdDeviation="1.4 0" /><feOffset dx="1.4" result="red" />
          <feColorMatrix in="soft" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" /><feGaussianBlur stdDeviation="1.1 0" /><feOffset dx="-.8" result="blue" />
          <feColorMatrix in="soft" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="green" />
          <feBlend in="red" in2="green" mode="screen" /><feBlend in2="blue" mode="screen" />
        </filter>
      </svg>
      <div style={{ position: "absolute", left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`, overflow: "hidden", background: "#01035e" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 400, height: 300, transformOrigin: "0 0", transform: `scale(${((box.w / 100) * w / 400).toFixed(4)}, ${((box.h / 100) * h / 300).toFixed(4)})`, overflow: "hidden",
          fontFamily: '"Anton", "Arial Narrow", Arial, sans-serif', color: ink, letterSpacing: ".02em" }}>
          <div style={{ ...fill, filter: `url(#${uid}tape) saturate(1.4) contrast(.92) brightness(1.06)`, ...(live ? { animation: "rc3-ad-jitter 3.3s steps(1) infinite" } : null) }}>
            {/* The offer. */}
            <div style={{ ...fill, background: "radial-gradient(ellipse 70% 62% at 50% 42%, #3243f4, #1020d8 42%, #040ba8 72%, #01035e)", ...on("rc3-ad-a", true) }}>
              <p style={{ ...txt, top: 20, fontSize: 21, ...on("rc3-ad-k1", true) }}>{ad.kicker}</p>
              <p style={{ ...txt, top: 20, fontSize: 21, ...on("rc3-ad-k2", false) }}>{ad.kicker2}</p>
              <p style={{ ...txt, top: 62, fontSize: 104, lineHeight: 1, letterSpacing: 0 }}>{ad.price}</p>
              <p style={{ ...txt, top: 186, fontSize: 30 }}>{ad.sub}</p>
              <p style={{ ...txt, bottom: 16, padding: "5px 0 6px", fontSize: 17, fontFamily: '"Bebas Neue", "Anton", sans-serif', letterSpacing: ".06em", background: "linear-gradient(90deg, transparent, rgba(0,0,0,.55) 18% 82%, transparent)" }}>Call now <b style={{ fontSize: "1.45em", marginLeft: ".3em" }}>{ad.phone}</b></p>
              <div style={{ position: "absolute", top: 34, left: 262, width: 126, height: 126, rotate: "-12deg", ...on("rc3-ad-burst", false) }}>
                <div style={{ ...fill, display: "grid", placeItems: "center", ...(live ? { animation: "rc3-ad-throb .5s ease-in-out infinite alternate" } : null) }}>
                  <div style={{ ...fill, background: "radial-gradient(#ff3b22, #d8150f 70%)", clipPath: AD_BURST }} />
                  <p style={{ position: "relative", margin: 0, fontSize: 30, lineHeight: .95, textAlign: "center", textTransform: "uppercase", fontStyle: "italic", textShadow: `.06em .07em 0 ${shade}` }}>{(ad.burst || "But wait!").split(" ").map((wd, i) => <React.Fragment key={i}>{i ? <br /> : null}{wd}</React.Fragment>)}</p>
                </div>
              </div>
            </div>
            {/* The order screen. */}
            <div style={{ ...fill, background: "linear-gradient(#0b16dc, #0610d6 60%, #0208c4)", ...on("rc3-ad-b", false) }}>
              <p style={{ ...txt, top: 18, fontSize: 30 }}>{ad.name}</p>
              {(ad.lines || []).map((ln, i) => <p key={i} style={{ ...txt, top: 62 + i * 26, fontSize: 19, fontFamily: '"Bebas Neue", "Anton", sans-serif', letterSpacing: ".07em" }}>{ln}</p>)}
              <p style={{ ...txt, top: 142, fontSize: 60, lineHeight: 1, letterSpacing: 0 }}>{ad.phone}</p>
              <p style={{ ...txt, top: 216, fontSize: 20, fontFamily: '"Bebas Neue", "Anton", sans-serif', letterSpacing: ".07em" }}>Not available in stores</p>
              <p style={{ ...txt, top: 242, fontSize: 10, lineHeight: 1.35, whiteSpace: "normal", padding: "0 52px", boxSizing: "border-box", fontFamily: "Arial, sans-serif", fontWeight: 700, letterSpacing: 0 }}>{ad.fine}</p>
            </div>
          </div>
          {/* Between spots: snow. */}
          <div style={{ ...fill, background: "#6f737c", filter: "contrast(5) brightness(.85)", ...on("rc3-ad-snow", false) }}>
            <div style={{ ...fill, background: `${AD_NOISE} 0 0 / 96px`, ...(live ? { animation: "rc3-ad-grain .2s steps(4) infinite" } : null) }} />
          </div>
          {/* Tape: grain, a tracking bar that climbs the picture now and then, the head-switch noise along the bottom. */}
          {live && <div style={{ ...fill, background: `${AD_NOISE} 0 0 / 220px`, opacity: .24, mixBlendMode: "hard-light", animation: "rc3-ad-grain .48s steps(6) infinite" }} />}
          {live && <div style={{ ...fill, bottom: "auto", height: 12, background: `linear-gradient(transparent, rgba(255,255,255,.55) 35%, rgba(255,40,210,.45) 55%, transparent), ${AD_NOISE} 0 0 / 56px`, mixBlendMode: "screen", opacity: 0, animation: "rc3-ad-track 8.4s linear infinite" }} />}
          {live && <div style={{ ...fill, top: "auto", height: 6, background: `linear-gradient(transparent, rgba(255,255,255,.2) 40%, rgba(0,0,0,.5)), ${AD_NOISE} 0 0 / 48px`, mixBlendMode: "screen" }} />}
          {/* The tube: scan lines, a soft reflection, and the dark of the corners. */}
          <div style={{ ...fill, background: "repeating-linear-gradient(rgba(0,0,0,.24) 0 1.2px, transparent 1.2px 2.6px)" }} />
          <div style={{ ...fill, background: "radial-gradient(ellipse 50% 32% at 30% 16%, rgba(255,255,255,.1), transparent), radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,.7))" }} />
        </div>
      </div>
    </div>
  );
}


// `interactive` lets the card lean under the pointer (or a finger). The lean is
// written straight to CSS variables on the stage, never through React state, so
// following the pointer costs no re-render. Every metal tilts; the "mirror"
// metal also moves — its bands slide and a glare follows the pointer.
export default function RcanaCard3({ data, scale = 1, metal: metalProp = null, interactive = false, className = "", style }) {
  const metal = rcana3MetalFor(data, metalProp, "flat");
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [ready, setReady] = useState(false);
  // LIVE 3D ART (data.live3d): mounted the first time the card is interactive, the one live card; paused
  // (not torn down) while it is turned over. A still card never opens a 3D canvas: it shows the poster layer.
  const [wasLive, setWasLive] = useState(false);
  useEffect(() => { if (interactive && data?.live3d) setWasLive(true); }, [interactive, data?.live3d]);
  const stageRef = useRef(null);
  // One place sets the pose: nx, ny run -1..1 (left..right, top..bottom) and `max` is the lean at 1.
  const pose = (nx, ny, max, ease) => {
    const el = stageRef.current;
    if (!el) return;
    el.style.setProperty("--mx", `${(50 + nx * 50).toFixed(1)}%`);
    el.style.setProperty("--my", `${(50 + ny * 50).toFixed(1)}%`);
    el.style.setProperty("--rx", `${(-ny * max).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(nx * max).toFixed(2)}deg`);
    el.style.setProperty("--tx", nx.toFixed(3));
    el.style.setProperty("--ty", ny.toFixed(3));
    el.style.setProperty("--lit", Math.min(1, Math.hypot(nx, ny) * 1.2).toFixed(3));
    el.style.setProperty("--ease", ease);
    at.current = { ax: nx * max, ay: ny * max };
  };
  const at = useRef({ ax: 0, ay: 0 }); // the lean now showing, in degrees: a drag picks up from it
  const drag = useRef(null);   // a finger or pen turning the card: { id, x, y, nx, ny, moved }
  const resting = useRef({ nx: 0, ny: 0 }); // where a drag leaves off, so the next one picks up from there
  const gyro = useRef(false);  // the device's own tilt is steering
  const released = useRef(false); // a drag has just ended with the device steering: its next pose glides in
  const lean = (e) => {
    const el = stageRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    if (e.pointerType === "mouse") { // the pointer's place on the card
      pose(clamp1(((e.clientX - box.left) / box.width - 0.5) * 2), clamp1(((e.clientY - box.top) / box.height - 0.5) * 2), MAX_TILT, "60ms");
      return;
    }
    if (e.type === "pointerdown") { // a finger or pen: start a drag, and keep it even when it leaves the card
      // It starts from the lean now showing (the device's own tilt may have set it), so the card does not jump under the finger.
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, nx: clamp1(at.current.ax / MAX_TILT_TOUCH), ny: clamp1(at.current.ay / MAX_TILT_TOUCH), moved: false };
      try { el.setPointerCapture(e.pointerId); } catch {}
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.hypot(dx, dy) > 8) d.moved = true;
    resting.current = { nx: clamp1(d.nx + dx / (box.width * 0.5)), ny: clamp1(d.ny + dy / (box.height * 0.5)) }; // half the card's width is a full turn
    // The pose is written once a frame, with NO easing: the finger already moves the card a frame at a time, and an
    // eased transition restarted on every touch event keeps WebKit (every iPad browser) animating without pause,
    // which it draws at reduced quality and stalls on as the tilted card's size on screen changes.
    if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; if (drag.current && drag.current.id != null) pose(resting.current.nx, resting.current.ny, MAX_TILT_TOUCH, "0ms"); });
  };
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const settle = (e) => {
    const el = stageRef.current;
    if (!el) return;
    if (e && e.pointerType !== "mouse" && e.type === "pointerleave" && drag.current) return; // a captured drag is still going
    drag.current = drag.current && e && e.type === "pointerup" ? { ...drag.current, id: null } : null;
    cancelAnimationFrame(frame.current); frame.current = 0;
    resting.current = { nx: 0, ny: 0 };
    if (gyro.current) { released.current = true; return; } // the device's tilt takes it from here, gently
    at.current = { ax: 0, ay: 0 };
    el.style.setProperty("--ease", "700ms");
    for (const v of ["--mx", "--my", "--rx", "--ry", "--tx", "--ty", "--lit"]) el.style.removeProperty(v);
  };
  // A drag that turned the card is not a tap: it must not also flip the card over.
  // THE WHEEL (layer.spin on the disc, layer.tick on its flapper). It is thrown, runs down and rests on a wedge; left
  // alone it throws itself again after a few seconds, and a click or tap on the wheel throws it at once, from wherever
  // it is, with the flapper's clicks heard (spin.sound: false for a silent wheel). Each throw is its own animation (the browser's animate()), so a new one can start mid-spin.
  const wheels = interactive && (data?.artLayers || []).some((l) => l.spin);
  const throwWheel = useRef(null);
  useEffect(() => {
    const root = stageRef.current, disc = root?.querySelector("[data-spin]"), flap = root?.querySelector("[data-tick]");
    if (!wheels || !disc || !disc.animate) return;
    let angle = 0, run = null, ticking = null, hush = null, timer = 0, alive = true;
    const sound = (data?.artLayers || []).find((l) => l.spin)?.spin.sound !== false;
    const showing = () => { const m = /(-?[\d.]+)deg/.exec(getComputedStyle(disc).rotate || ""); return m ? parseFloat(m[1]) : angle; };
    const toss = (hard) => {
      clearTimeout(timer);
      const from = (((run ? showing() : angle) % 360) + 360) % 360;
      run?.cancel(); ticking?.cancel(); hush?.(); hush = null;
      const to = Math.round((from + ((hard ? 2.6 : 1.9) + Math.random() * 1.2) * 360) / 45) * 45; // rests on a wedge
      const ms = 2600 + (to - from) * 2.6;
      disc.style.rotate = `${to % 360}deg`; // where it rests once the throw is over
      const mine = run = disc.animate([{ rotate: `${from}deg` }, { rotate: `${to}deg` }], { duration: ms, easing: `cubic-bezier(${SPIN_EASE.join(",")})` });
      const ticks = tickFrames(from, to);
      if (flap) ticking = flap.animate(ticks, { duration: ms, easing: "linear" });
      if (hard && sound) hush = wheelClicks(ticks.filter((k) => k.rotate !== "0deg").map((k) => (k.offset * ms) / 1000));
      angle = to % 360;
      mine.onfinish = () => { if (!alive || run !== mine) return; run = null; timer = setTimeout(() => toss(false), 3200 + Math.random() * 2600); };
    };
    throwWheel.current = () => toss(true);
    timer = setTimeout(() => toss(false), 900);
    return () => { alive = false; clearTimeout(timer); run?.cancel(); ticking?.cancel(); hush?.(); throwWheel.current = null; disc.style.rotate = ""; };
  }, [wheels, data?.id]);
  // A click that ends a drag is not a click. A click on the wheel throws the wheel, and goes no further (so it does
  // not turn the card over, RcanaFlipCard); a click anywhere else on the card passes on as before.
  const swallowDragClick = (e) => { const d = drag.current; drag.current = null; if (d && d.moved) { e.stopPropagation(); e.preventDefault(); return; }
    const hit = throwWheel.current && stageRef.current?.querySelector("[data-spin-hit]");
    if (hit) { const b = hit.getBoundingClientRect(); if (Math.hypot(e.clientX - (b.left + b.width / 2), e.clientY - (b.top + b.height / 2)) <= b.width / 2) { e.stopPropagation(); throwWheel.current(); } } };
  // A BOBBLE (layer.bobble: { x, y } the foot of the spring, in % of the layer): a head on a spring. It is a real
  // spring, stepped each frame and written to --bob on the stage: the head leans the way the card is tipped,
  // overshoots, and wobbles to rest; left alone, it takes a small nod every few seconds. Live card only.
  const bobbles = interactive && (data?.artLayers || []).some((l) => l.bobble);
  useEffect(() => {
    const el = stageRef.current;
    if (!bobbles || !el) return;
    const calm = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let a = 0, v = 0, last = performance.now(), nextNod = last + 1200, raf = 0;
    const step = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      const tx = parseFloat(el.style.getPropertyValue("--tx")) || 0;
      if (!calm && now > nextNod) { v += (Math.random() < 0.5 ? -1 : 1) * (26 + Math.random() * 22); nextNod = now + 2600 + Math.random() * 3200; }
      v += (-(a - tx * 9) * 120 - v * 3.4) * dt; a += v * dt; // stiffness 120, damping 3.4: about 1.7 swings a second, at rest in two
      el.style.setProperty("--bob", `${a.toFixed(2)}deg`);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); el.style.removeProperty("--bob"); };
  }, [bobbles]);
  // THE VISIT'S PIXELS (layer.visit.pixels: { min, max, rest }): her block size follows the tilt in whole steps, from min
  // (tipped fully forward: sharp) through rest to max (tipped fully back). One filter, re-cut here whenever the step
  // changes; the tilt is eased first so the steps are walked through, never jumped.
  const visits = interactive ? (data?.artLayers || []).filter((l) => l.visit && l.visit.pixels) : [];
  const visitKey = visits.map((l) => l.id).join(",");
  useEffect(() => {
    const el = stageRef.current;
    if (!visitKey || !el) return;
    let ty = 0, raf = 0; const shown = {};
    const step = () => {
      const want = parseFloat(el.style.getPropertyValue("--ty")) || 0;
      ty += (want - ty) * 0.12;
      for (const l of visits) {
        const q = l.visit.pixels, min = q.min ?? 1, max = q.max ?? 20, rest = q.rest ?? 4, reach = q.reach ?? 0.5;
        const size = Math.round(ty < 0 ? rest + (max - rest) * Math.min(1, -ty / (q.back ?? 0.8)) : rest + (min - rest) * Math.min(1, ty / reach));
        if (shown[l.id] === size) continue;
        shown[l.id] = size;
        const f = el.querySelector(`[data-visit-pix="${l.id}"]`), img = el.querySelector(`[data-visit-img="${l.id}"]`);
        if (!f || !img) { shown[l.id] = null; continue; }
        const [flood, tile, , , grow] = f.children;
        flood.setAttribute("x", size / 2 - 0.5); flood.setAttribute("y", size / 2 - 0.5);
        tile.setAttribute("width", size); tile.setAttribute("height", size); grow.setAttribute("radius", size / 2);
        img.style.filter = size <= 1 ? "none" : `url(#${f.id})`; // one-pixel blocks are the picture itself
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [visitKey]);
  // FACETS (layer.facets): light that rolls round a layer, after the first frame's flame on Connor's card. Each facet is a
  // patch of the layer that faces its own way (its place round the layer's middle). A light circles slowly on its own, and the
  // tilt pushes it; a facet flares as the light comes round to face it and dies as it passes, so the glow travels from
  // tongue to tongue instead of the whole layer brightening at once.
  const faceted = interactive ? (data?.artLayers || []).filter((l) => l.facets) : [];
  const facetKey = faceted.map((l) => l.id).join(",");
  useEffect(() => {
    const el = stageRef.current;
    if (!facetKey || !el) return;
    const calm = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, tx = 0, ty = 0; const t0 = performance.now();
    const step = (now) => {
      tx += ((parseFloat(el.style.getPropertyValue("--tx")) || 0) - tx) * 0.15; ty += ((parseFloat(el.style.getPropertyValue("--ty")) || 0) - ty) * 0.15;
      for (const l of faceted) { const F = l.facets, turn = calm ? 0 : ((now - t0) / 1000 / (F.period || 4.5)) * Math.PI * 2, idle = F.idle ?? 0.62;
        const lx = Math.cos(turn) * idle + tx * (F.tilt ?? 1), ly = Math.sin(turn) * idle + ty * (F.tilt ?? 1);
        el.querySelectorAll(`[data-facet="${l.id}"]`).forEach((n) => { const d = (lx * +n.dataset.ax + ly * +n.dataset.ay - (F.peak ?? 0.62)) / (F.rough ?? 0.3);
          n.style.opacity = ((F.rest ?? 0.06) + Math.exp(-0.5 * d * d) * (F.strength ?? 1)).toFixed(3); }); }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [facetKey]);
  // A finger on the live card turns the card; it must not scroll the page under it. touch-action: none on
  // the stage says so, but WebKit loses that inside the flip card's 3D-transformed faces, so the touch
  // moves are also refused outright (a non-passive listener; React's own touch handlers are passive).
  useEffect(() => {
    const el = stageRef.current;
    if (!interactive || !el) return;
    const hold = (ev) => { if (ev.cancelable) ev.preventDefault(); };
    el.addEventListener("touchmove", hold, { passive: false });
    return () => el.removeEventListener("touchmove", hold);
  }, [interactive]);
  // THE DEVICE'S OWN TILT (phones and tablets): tipping the device leans the card, about its resting hold,
  // which drifts slowly to wherever the device is being held. A drag overrides it while it lasts. Browsers
  // that ask permission for motion (iOS Safari) are asked on the first touch of a live card; a refusal, or
  // a device with no sensor, simply leaves the drag.
  useEffect(() => {
    if (!DEVICE_TILT || !interactive || typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return;
    if (!window.matchMedia || !window.matchMedia("(pointer: coarse)").matches) return;
    // Three things keep the card calm in the hand. The readings are smoothed, because a sensor at rest still
    // jitters by a fraction of a degree and every jitter would redraw the card. Near the resting hold there is a
    // dead zone (about a degree and a half) where the card sits exactly flat: flat is the one pose the browser
    // draws pin-sharp, and a card forever a hair off flat looks soft. And the resting hold itself drifts only
    // very slowly while the card is tipped (over half a minute), so a tilt that is held stays held instead of
    // creeping back to the middle; close to flat it follows faster, which keeps flat where the hands are.
    let base = null, smooth = null, shown = { nx: 0, ny: 0 }, live = true;
    const DEAD = 0.06, DRIFT = 0.0005, DRIFT_FLAT = 0.004, SMOOTH = 0.22;
    const onTilt = (ev) => {
      if (ev.gamma == null || ev.beta == null) return;
      const turned = ((window.screen?.orientation?.angle ?? window.orientation ?? 0) + 360) % 360; // landscape swaps the axes
      const lr = turned === 90 ? ev.beta : turned === 270 ? -ev.beta : ev.gamma, fb = turned === 90 ? -ev.gamma : turned === 270 ? ev.gamma : ev.beta;
      if (!base) { base = { lr, fb }; smooth = { lr, fb }; }
      smooth.lr += (lr - smooth.lr) * SMOOTH; smooth.fb += (fb - smooth.fb) * SMOOTH;
      const drift = Math.hypot(smooth.lr - base.lr, smooth.fb - base.fb) / 25 < DEAD * 2 ? DRIFT_FLAT : DRIFT; // within about three degrees of flat, settle to flat in a few seconds
      base.lr += (smooth.lr - base.lr) * drift; base.fb += (smooth.fb - base.fb) * drift;
      gyro.current = true;
      if (drag.current && drag.current.id != null) return;
      let nx = (smooth.lr - base.lr) / 25, ny = (smooth.fb - base.fb) / 25;
      const m = Math.hypot(nx, ny);
      if (m < DEAD) { nx = 0; ny = 0; } else { const k = Math.min(1, (m - DEAD) / (1 - DEAD)) / m; nx *= k; ny *= k; } // the dead zone, eased out of so there is no step at its edge
      nx = clamp1(nx); ny = clamp1(ny);
      if (!released.current && Math.abs(nx - shown.nx) < 0.004 && Math.abs(ny - shown.ny) < 0.004) return; // nothing worth a redraw
      shown = { nx, ny };
      pose(nx, ny, MAX_TILT_GYRO, released.current ? "450ms" : "0ms"); released.current = false; // already smoothed above: no easing to restart every reading
    };
    const listen = () => { if (live) window.addEventListener("deviceorientation", onTilt); };
    const DOE = window.DeviceOrientationEvent;
    // Browsers that ask permission for motion (every iPhone and iPad browser) only let a page ask from inside a
    // finished tap: the END of a touch or a click. A touch that has only just begun does not count, and asking
    // then is refused without the person ever seeing the question. So the card asks when a touch on it ends, and
    // keeps asking on later taps until the browser has put the question (granted or denied); a refusal for want
    // of a gesture is not an answer.
    let ask = null; const el = stageRef.current; const ASK_ON = ["touchend", "pointerup", "click"];
    const stopAsking = () => { if (ask) for (const t of ASK_ON) el?.removeEventListener(t, ask); };
    if (typeof DOE.requestPermission === "function") {
      let asking = false;
      ask = () => {
        if (asking) return; asking = true;
        let answer; try { answer = DOE.requestPermission(); } catch { asking = false; return; }
        Promise.resolve(answer).then((state) => { stopAsking(); if (state === "granted") listen(); }).catch(() => { asking = false; });
      };
      for (const t of ASK_ON) el?.addEventListener(t, ask);
    } else listen();
    return () => { live = false; gyro.current = false; window.removeEventListener("deviceorientation", onTilt); stopAsking(); };
  }, [interactive]);
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
  // With a triangle in the text box, the rules sit in a narrower column to its right.
  const tri = !!m.attrs; const tx = tri ? 162 : 50, tw = tri ? 304 : 412;
  const cw = 744 * scale;
  const foil = FOILS[metal] || null;
  const mirror = metal === "mirror";
  const apparition = APPARITIONS[data.id] || null;
  const fullArt = !!data.fullArt, artH = fullArt ? FULL_ART_H : 470;
  const plate = m.plate ? plateBox(m.plate.value) : null;
  const shapes = plate ? plateShapes(plate.w) : null;
  const nameSize = nameSizeFor(m.name);
  // Rules and flavor are set in spaced capitals, so they run wide: size by length to hold three or four lines.
  const textSize = (m.text.length <= 60 ? 17 : m.text.length <= 100 ? 14 : 12.5) * (tri ? 0.9 : 1);
  const giltText = metal === "rainbow" ? { color: "transparent", backgroundImage: RAINBOW_TEXT, WebkitBackgroundClip: "text", backgroundClip: "text" }
    : mirror ? { color: "transparent", backgroundImage: MIRROR_TEXT, backgroundSize: "260% 100%", backgroundPosition: "calc(50% + (50% - var(--mx, 50%)) * 1.6) 50%", WebkitBackgroundClip: "text", backgroundClip: "text" }
    : { color: GILT };
  const abs = { position: "absolute", margin: 0 };
  const num = (size, fill = INK, extra = {}) => ({ fontFamily: NUM, fontSize: size, fill, textAnchor: "middle", ...extra });

  return (
    <div
      ref={stageRef}
      className={`rc-stage rc3-stage ${className}`}
      style={{ position: "relative", width: cw, height: (cw * H) / W, perspective: interactive ? cw * 2.6 : undefined, touchAction: interactive ? "none" : undefined,
        // A finger resting on the card must not start a text selection, the image callout or the tap highlight: on iOS each one stalls the drag.
        ...(interactive ? { userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent" } : null), ...style }}
      onPointerMove={interactive ? lean : undefined}
      onPointerDown={interactive ? lean : undefined}
      onPointerLeave={interactive ? settle : undefined}
      onPointerUp={interactive ? (e) => { if (e.pointerType !== "mouse") settle(e); } : undefined}
      onPointerCancel={interactive ? settle : undefined}
      onClickCapture={interactive ? swallowDragClick : undefined}
    >
      <div style={{ position: "absolute", inset: 0, transform: interactive ? "rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))" : undefined, transition: "transform var(--ease, 500ms) ease-out", willChange: interactive ? "transform" : undefined }}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Anton&family=Bebas+Neue&family=Grenze+Gotisch:wght@800&family=Spectral:ital,wght@0,400;0,700;1,400&display=swap");
        @keyframes rc3-flicker { 0%, 100% { scale: 1 1; rotate: 0deg; opacity: .93; filter: brightness(1); } 13% { scale: 1.03 1.07; rotate: -1.5deg; opacity: 1; filter: brightness(1.12); } 27% { scale: .98 .95; rotate: 1deg; opacity: .86; filter: brightness(.95); } 41% { scale: 1.02 1.05; rotate: 2deg; opacity: 1; filter: brightness(1.08); } 58% { scale: .99 .97; rotate: -1deg; opacity: .9; filter: brightness(1); } 74% { scale: 1.04 1.09; rotate: .5deg; opacity: 1; filter: brightness(1.15); } 88% { scale: .98 .96; rotate: -2deg; opacity: .88; filter: brightness(.97); } }
        @keyframes rc3-glint { 0%, 100% { scale: 0; rotate: -20deg; opacity: 0; } 5% { opacity: 1; } 12% { scale: 1; rotate: 12deg; opacity: 1; } 26% { scale: 0; rotate: 40deg; opacity: 0; } }
        @keyframes rc3-bolt { 0%, 100% { opacity: 0; } 2% { opacity: 1; } 4% { opacity: .35; } 6% { opacity: 1; } 11% { opacity: .85; } 16% { opacity: 0; } }
        @keyframes rc3-crackle { 0%, 100% { filter: brightness(1); } 6% { filter: brightness(1.22); } 8% { filter: brightness(1); } 31% { filter: brightness(1); } 33% { filter: brightness(1.16); } 36% { filter: brightness(1.02); } 60% { filter: brightness(1); } 62% { filter: brightness(1.28); } 64% { filter: brightness(1.04); } 66% { filter: brightness(1.2); } 70% { filter: brightness(1); } }
        @keyframes rc3-blaze { 0%, 100% { scale: 1 1; filter: brightness(1) saturate(1); } 11% { scale: 1.012 1.03; filter: brightness(1.14) saturate(1.1); } 24% { scale: .995 .985; filter: brightness(.93) saturate(1); } 39% { scale: 1.02 1.045; filter: brightness(1.2) saturate(1.15); } 53% { scale: 1 1.01; filter: brightness(.98) saturate(1); } 68% { scale: 1.015 1.035; filter: brightness(1.16) saturate(1.1); } 84% { scale: .99 .98; filter: brightness(.9) saturate(.97); } }
        @keyframes rc3-flare { 0%, 100% { opacity: .08; } 9% { opacity: .95; } 15% { opacity: .3; } 21% { opacity: .8; } 34% { opacity: .1; } 55% { opacity: .15; } 63% { opacity: 1; } 70% { opacity: .2; } 86% { opacity: .55; } }
        @keyframes rc3-ripple { 0% { scale: .12; opacity: 0; } 10% { opacity: .75; } 60% { opacity: .3; } 100% { scale: 1.55; opacity: 0; } }
        @keyframes rc3-sway { 0%, 100% { scale: 1 1; translate: 0 0; } 30% { scale: 1.004 1.012; translate: .25% 0; } 65% { scale: 1 1.02; translate: -.3% 0; } }
        @keyframes rc3-glitch { 0%, 100% { translate: 0 0; opacity: var(--go); filter: var(--gp); clip-path: none; } 11% { translate: calc(var(--gs) * -1) 0; opacity: calc(var(--go) * .6); filter: var(--gp) brightness(1.5) saturate(.4); clip-path: none; } 12.5% { translate: var(--gs) 0; opacity: var(--go); filter: var(--gp) hue-rotate(40deg); clip-path: inset(calc(var(--gt) + var(--gh) * 0.22) 0 calc(100% - var(--gt) - var(--gh) * 0.71) 0); } 14% { translate: 0 0; opacity: var(--go); filter: var(--gp); clip-path: none; } 47% { translate: 0 0; opacity: calc(var(--go) * .35); filter: var(--gp) brightness(1.8) blur(1px); clip-path: none; } 48.5% { translate: calc(var(--gs) * .6) 0; opacity: calc(var(--go) * .8); filter: var(--gp); clip-path: inset(calc(var(--gt) + var(--gh) * 0) 0 calc(100% - var(--gt) - var(--gh) * 0.58) 0); } 50% { translate: 0 0; opacity: var(--go); filter: var(--gp); clip-path: none; } 78% { translate: calc(var(--gs) * -.5) 0; opacity: calc(var(--go) * .7); filter: var(--gp) saturate(.3) brightness(1.3); clip-path: none; } 79.5% { translate: 0 0; opacity: var(--go); filter: var(--gp); clip-path: none; } }
        @keyframes rc3-glitch-ghost { 0%, 100% { opacity: 0; translate: 0 0; clip-path: none; } 11% { opacity: .85; translate: calc(var(--gs) * 2) 0; clip-path: inset(calc(var(--gt) + var(--gh) * 0.08) 0 calc(100% - var(--gt) - var(--gh) * 0.3) 0); } 12.5% { opacity: .7; translate: calc(var(--gs) * -2.4) 0; clip-path: inset(calc(var(--gt) + var(--gh) * 0.55) 0 calc(100% - var(--gt) - var(--gh) * 0.8) 0); } 14% { opacity: 0; translate: 0 0; clip-path: none; } 47% { opacity: .8; translate: calc(var(--gs) * -1.6) 0; clip-path: inset(calc(var(--gt) + var(--gh) * 0.34) 0 calc(100% - var(--gt) - var(--gh) * 0.5) 0); } 48.5% { opacity: .75; translate: calc(var(--gs) * 3) 0; clip-path: inset(calc(var(--gt) + var(--gh) * 0.7) 0 calc(100% - var(--gt) - var(--gh) * 0.96) 0); } 50% { opacity: 0; translate: 0 0; clip-path: none; } 78% { opacity: .6; translate: calc(var(--gs) * 1.2) 0; clip-path: inset(calc(var(--gt) + var(--gh) * 0.02) 0 calc(100% - var(--gt) - var(--gh) * 0.2) 0); } 79.5% { opacity: 0; translate: 0 0; clip-path: none; } }
        @keyframes rc3-scan { from { background-position: 0 0; } to { background-position: 0 12px; } }
        @keyframes rc3-mote { 0% { translate: 0 0; opacity: 0; } 18% { opacity: 1; } 80% { opacity: 1; } 100% { translate: var(--mdx, 0px) calc(var(--mdy, 100px) * -1); opacity: 0; } }
        @keyframes rc3-lamp { 0%, 100% { opacity: .12; scale: .8; } 12% { opacity: 1; scale: 1.25; } 34% { opacity: .12; scale: .8; } }
        @keyframes rc3-breathe { 0%, 100% { opacity: var(--b0, .78); } 50% { opacity: 1; } }
        @keyframes rc3-rings { from { background-position: 0 0; } to { background-position: 0 var(--rp, -48px); } }
        @keyframes rc3-tear-on { 0%, 44%, 54%, 100% { opacity: 0; } 45%, 53% { opacity: 1; } }
        @keyframes rc3-tear-off { 0%, 44%, 54%, 100% { opacity: 1; } 45%, 53% { opacity: .12; } }
        @keyframes rc3-neon-buzz { 0%, 100% { opacity: 1; } 7% { opacity: .93; } 9% { opacity: 1; } 31% { opacity: .96; } 33% { opacity: 1; } 58% { opacity: .9; } 59% { opacity: 1; } 84% { opacity: .95; } }
        @keyframes rc3-neon-drop { 0%, 100% { opacity: 0; } 61% { opacity: 1; } 62.5% { opacity: 0; } 63.5% { opacity: 1; } 64% { opacity: .15; } 65% { opacity: 1; } 78% { opacity: 0; } 79% { opacity: 1; } 80% { opacity: 0; } }
        @keyframes rc3-neon-sway { from { rotate: calc(var(--sw, .8deg) * -1); } to { rotate: var(--sw, .8deg); } }
        @keyframes rc3-beat { 0%, 100% { filter: brightness(1) saturate(1); } 6% { filter: brightness(1.22) saturate(1.15); } 14% { filter: brightness(1.02) saturate(1); } 22% { filter: brightness(1.14) saturate(1.1); } 36% { filter: brightness(1) saturate(1); } }
        @keyframes rc3-roll { from { background-position: 0 0; } to { background-position: var(--nx, 0px) var(--ny, -160px); } }
        @keyframes rc3-ember { 0%, 100% { opacity: .62; scale: 1; } 9% { opacity: .9; scale: 1.04; } 17% { opacity: .55; scale: .97; } 31% { opacity: .82; scale: 1.02; } 44% { opacity: .6; scale: .98; } 58% { opacity: 1; scale: 1.06; } 66% { opacity: .7; scale: 1; } 83% { opacity: .88; scale: 1.03; } }
        @keyframes rc3-mist { from { background-position: 0 0; } to { background-position: var(--nx, 300px) 0; } }
        @keyframes rc3-flash { 0% { background-size: 0% 0%; opacity: 0; } 10% { opacity: 1; } 55% { opacity: .85; } 100% { background-size: 280% 280%; opacity: 0; } }`}</style>
      <div
        className="rc-card rc3-card"
        data-ready={ready ? "" : undefined}
        data-frame="3"
        data-metal={metal}
        style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `scale(${cw / W})`, transformOrigin: "0 0", borderRadius: 24, overflow: "hidden", background: GOLD, boxSizing: "border-box", aspectRatio: "auto", transition: "none" }}
      >
        <div style={{ ...abs, left: 5, top: 5, width: 502, height: 700, borderRadius: 19, background: INK }} />

        {/* The art: the card's own layers, placed as they were authored against the whole card, seen through the window. */}
        <div style={{ ...abs, left: 16, top: 16, width: 480, height: artH, borderRadius: 10, overflow: "hidden", background: data.backdrop && /^(url|linear|radial|conic|#|rgb|hsl)/.test(data.backdrop) ? data.backdrop : INK }}>
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
                  {layer.blend === "negation" && (
                    <div aria-hidden="true" style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", WebkitBackdropFilter: "invert(1)", backdropFilter: "invert(1)" }} />
                  )}
                  <img src={layer.src} alt="" draggable={false} decoding="async" data-spin={layer.spin && interactive ? "" : undefined} data-tick={layer.tick && interactive ? "" : undefined}
                style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", transform: `translate(calc(${layer.offset?.x || 0}% - var(--tx, 0) * ${parallax(layer)}%), calc(${layer.offset?.y || 0}% - var(--ty, 0) * ${parallax(layer)}%)) scale(${layer.scale ?? 1})`, transition: interactive ? "transform var(--ease, 500ms) ease-out" : undefined, filter: layer.filter || undefined,
                  // A flame that flickers (layer.flicker: where its base is, in % of the layer): it stretches, leans and
                  // dims a little about that point, on the live card only. `scale` and `rotate` are their own
                  // properties, so the animation leaves the tilt's transform alone.
                  ...(layer.flicker && interactive ? { transformOrigin: `${layer.flicker.x}% ${layer.flicker.y}%`, animation: `rc3-flicker ${layer.flicker.period || 1.9}s ease-in-out infinite` } : null),
                  // A blaze (layer.blaze: where the fire starts, in % of the layer): a big fire that surges and gutters
                  // from that point. And a crackle (layer.crackle): the layer flares, the way lightning lights a scene.
                  // A gaze (layer.gaze: { x, y } how far it may travel, in px of the card): the layer slides a little toward
                  // wherever the card is tipped. On a layer that is only a portrait's irises, the eyes follow the viewer.
                  ...(layer.gaze && interactive ? { translate: `calc(var(--tx, 0) * ${layer.gaze.x ?? 3}px) calc(var(--ty, 0) * ${layer.gaze.y ?? 2}px)`, transition: "transform var(--ease, 500ms) ease-out, translate 260ms ease-out" } : null),
                  // Water (layer.ripple): the layer breathes, a slow stretch from its top edge, so a reflection in it wavers.
                  // A wheel (layer.spin: { x, y } its axle in % of the layer; squash, the height to give it so a disc painted
                  // a touch out of round is a true circle before it turns; r, its radius in % of the layer's width, for the
                  // click). The tilt's slide moves to `translate`, which is applied after `rotate`: left in `transform` it
                  // would be turned with the wheel, and the wheel would swing off its axle whenever the card is tipped.
                  ...((layer.spin || layer.tick) && interactive ? { transform: "none", translate: `calc(${layer.offset?.x || 0}% - var(--tx, 0) * ${parallax(layer)}%) calc(${layer.offset?.y || 0}% - var(--ty, 0) * ${parallax(layer)}%)`, transition: "translate var(--ease, 500ms) ease-out",
                    transformOrigin: `${(layer.spin || layer.tick).x}% ${(layer.spin || layer.tick).y}%`, ...(layer.spin ? { scale: `1 ${layer.spin.squash || 1}` } : null) } : null),
                  ...(layer.ripple && interactive ? { transformOrigin: "50% 0%", animation: `rc3-sway ${(layer.ripple.period || 5) * 1.3}s ease-in-out infinite` } : null),
                  // Several flames on one layer (layer.flames): the layer itself is not shown on the live card; each flame is
                  // drawn from it below, in its own small window, so each can flicker about its own wick.
                  ...(layer.flames && interactive ? { visibility: "hidden" } : null),
                  ...(layer.bobble && interactive ? { transformOrigin: `${layer.bobble.x}% ${layer.bobble.y}%`, rotate: layer.bobble.gain != null ? `calc(var(--bob, 0deg) * ${layer.bobble.gain})` : "var(--bob, 0deg)" } : null), // gain: a stiffer or looser spring than the one shared swing
                  // A glitch (layer.glitch: { top, height } the figure's band in % of the layer; optional period in seconds,
                  // fade its steady opacity, shift the jump in % of the card): a bad signal. The layer holds a little faint, then
                  // jumps sideways, drops to a band of itself and blows out, in short bursts. Ghost copies and scan lines are below.
                  // Pixelate (layer.pixelate: the block size in px of the card): the layer is redrawn in square blocks. On the live card
                  // only; the filter itself is drawn below. With a glitch, the glitch carries it (--gp), since both animate `filter`.
                  ...(layer.pixelate && interactive ? { "--gp": `url(#${uid}pix${layer.id})`, filter: `url(#${uid}pix${layer.id})` } : { "--gp": "opacity(1)" }),
                  // A blend (layer.blend: any CSS mix-blend-mode, or "negation"): how the layer mixes with what is under it.
                  // Negation is 1 - |1 - a - b|; CSS has no such mode, so it is built in three steps: a pane that inverts everything
                  // under the layer, the layer laid on by difference (here), and a second pane that inverts the result. Where the
                  // layer is clear the two inversions cancel, so a soft edge stays soft.
                  ...(layer.blend ? { mixBlendMode: layer.blend === "negation" ? "difference" : layer.blend } : null),
                  ...(layer.glitch && interactive ? { "--gt": `${layer.glitch.top ?? 0}%`, "--gh": `${layer.glitch.height ?? 100}%`, "--go": layer.glitch.fade ?? 0.88, "--gs": `${layer.glitch.shift ?? 1.4}%`,
                    opacity: layer.glitch.fade ?? 0.88, animation: `rc3-glitch ${layer.glitch.period || 4.6}s steps(1, end) infinite` } : null),
                  // A tractor beam (layer.tractor: { x, y } its source in % of the layer): the beam answers the tilt. Tipped back it
                  // pinches toward a thin column and loses its colour; tipped forward it opens and brightens. The cold copy and the
                  // rings are drawn below.
                  ...(layer.tractor && interactive ? { transformOrigin: `${layer.tractor.x ?? 50}% ${layer.tractor.y ?? 0}%`, transition: "transform var(--ease, 500ms) ease-out, scale 600ms ease-out, filter 600ms ease-out",
                    scale: `calc(1 + min(var(--ty, 0), 0) * ${layer.tractor.pinch ?? 0.55} + max(var(--ty, 0), 0) * ${layer.tractor.widen ?? 0.14}) 1`,
                    filter: `saturate(calc(1 + min(var(--ty, 0), 0) * 0.85)) brightness(calc(1 + max(var(--ty, 0), 0) * ${layer.tractor.flood ?? 0.3}))` } : null),
                  // A neon sign (layer.neon): on the live card the layer itself is not shown; the lit sign is drawn below.
                  ...(layer.neon && interactive ? { visibility: "hidden" } : null),
                  // A visit (layer.visit): on the live card the layer itself is not shown; she is drawn below, rising or descending with the tilt.
                  ...(layer.visit && interactive ? { visibility: "hidden" } : null),
                  // Breathing (layer.breathe: true, or { low, period }): the layer's light swells and sinks, slowly.
                  ...(layer.breathe && interactive ? { "--b0": layer.breathe.low ?? 0.78, animation: `rc3-breathe ${layer.breathe.period || 4.2}s ease-in-out infinite` } : null),
                  // A heartbeat (layer.beat: true, or { period } seconds): the layer's light thumps twice and rests. Nothing moves.
                  ...(layer.beat && interactive ? { animation: `rc3-beat ${layer.beat.period || 1.6}s ease-in-out infinite` } : null),
                  ...(layer.blaze && interactive ? { transformOrigin: `${layer.blaze.x}% ${layer.blaze.y}%`, animation: `rc3-blaze ${layer.blaze.period || 1.5}s ease-in-out infinite` } : null),
                  ...(layer.crackle && interactive ? { animation: `rc3-crackle ${layer.crackle === true ? 2.6 : layer.crackle}s linear infinite` } : null) }} />
                  {/* A flare (layer.flare): the layer's own highlights flash, and nothing moves. Two hot, high-contrast
                      copies of the picture are screened over it, each showing through its own slanted bands and flashing on
                      its own clock, so the light runs along the fire and never lifts the whole sheet at once. A turn of
                      the card brightens it. */}
                  {layer.flare && interactive && [0, 1].map((k) => (
                    <div key={`flare${k}`} aria-hidden="true" style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", mixBlendMode: "screen",
                      transform: `${slide} scale(${layer.scale ?? 1})`, transition: "transform var(--ease, 500ms) ease-out", opacity: `calc((.7 + var(--lit, 0) * .3) * ${layer.flare.strength ?? 1})` /* flare.strength: 1 is a fire's flash; well under 1 is a glimmer */,
                      WebkitMaskImage: `repeating-linear-gradient(${k ? 62 : 118}deg, #000 0%, #000 ${k ? 5 : 7}%, transparent ${k ? 11 : 14}%, transparent ${k ? 23 : 29}%)`, maskImage: `repeating-linear-gradient(${k ? 62 : 118}deg, #000 0%, #000 ${k ? 5 : 7}%, transparent ${k ? 11 : 14}%, transparent ${k ? 23 : 29}%)` }}>
                      <img src={layer.src} alt="" draggable={false} decoding="async" style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", filter: "brightness(1.55) contrast(1.9) saturate(1.25)",
                        animation: `rc3-flare ${((layer.flare.period || 2.3) * (k ? 0.73 : 1)).toFixed(2)}s linear ${k ? -0.9 : 0}s infinite` }} />
                    </div>
                  ))}
                  {/* Liquid metal (layer.liquid): drawn over the layer inside its mask, then the layer once more, faintly, so
                      the glass keeps its shine over the metal. */}
                  {layer.liquid && interactive && <LiquidMetal spec={layer.liquid} slide={slide} scale={layer.scale ?? 1} />}
                  {layer.liquid && interactive && (
                    <img src={layer.src} alt="" aria-hidden="true" draggable={false} decoding="async" style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", mixBlendMode: "screen", opacity: layer.liquid.shine ?? 0.32,
                      transform: `${slide} scale(${layer.scale ?? 1})`, transition: "transform var(--ease, 500ms) ease-out", WebkitMaskImage: `url("${layer.liquid.mask}")`, maskImage: `url("${layer.liquid.mask}")`, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" }} />
                  )}
                  {/* Eyes that follow (layer.eyes). The layer's own picture is the WHITES of the eyes, the shape of each
                      opening; the irises are drawn here, inside that shape, so they slide under the lids, and they drift
                      toward wherever the card is tipped, a moment late. irises: [{ x, y, r }] their place at rest in %
                      of the layer and their radius in px of the card; travel: { x, y } how far they may go, in px. Drawn
                      on every card, live or not (at rest when it is not), since they are the portrait's eyes. */}
                  {layer.eyes && (
                    <div aria-hidden="true" style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", transform: `${slide} scale(${layer.scale ?? 1})`, transition: interactive ? "transform var(--ease, 500ms) ease-out" : undefined,
                      WebkitMaskImage: `url("${layer.src}")`, maskImage: `url("${layer.src}")`, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" }}>
                      <div style={{ position: "absolute", inset: 0, translate: interactive ? `calc(var(--tx, 0) * ${layer.eyes.travel?.x ?? 1.6}px) calc(var(--ty, 0) * ${layer.eyes.travel?.y ?? 0.9}px)` : undefined, transition: "translate 320ms ease-out" }}>
                        {layer.eyes.irises.map((e, ei) => (
                          <div key={ei} style={{ position: "absolute", left: `${e.x}%`, top: `${e.y}%`, width: e.r * 2, height: e.r * 2, marginLeft: -e.r, marginTop: -e.r, borderRadius: "50%",
                            background: `radial-gradient(circle at 34% 30%, rgba(255,255,255,.95) 0, rgba(255,255,255,.95) 9%, transparent 12%), radial-gradient(circle, #0d0705 0, #0d0705 36%, ${layer.eyes.color || "#6b3f1c"} 40%, ${layer.eyes.color || "#6b3f1c"} 74%, #2a160a 82%, #2a160a 100%)` }} />
                        ))}
                      </div>
                      {/* the lid's shadow across the top of each eye */}
                      <div style={{ position: "absolute", inset: 0, background: layer.eyes.irises.map((e) => `radial-gradient(ellipse ${e.r * 3.2}px ${e.r * 1.5}px at ${e.x}% calc(${e.y}% - ${e.r * 1.25}px), rgba(45,24,12,.6) 0, rgba(45,24,12,0) 100%)`).join(", ") }} />
                    </div>
                  )}
                  {/* Ripples (layer.ripple: { x, y } where they start, in % of the layer; rx their widest half-width in %;
                      period, seconds): rings that open across the water one after another and fade, seen at a low angle
                      so they are flat ellipses. Kept inside the layer's own shape, so they stop at the waterline. */}
                  {layer.ripple && interactive && (
                    <div aria-hidden="true" style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", mixBlendMode: "screen", transform: `${slide} scale(${layer.scale ?? 1})`, transition: "transform var(--ease, 500ms) ease-out",
                      WebkitMaskImage: `url("${layer.src}")`, maskImage: `url("${layer.src}")`, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" }}>
                      {[0, 1, 2, 3].map((k) => { const w = ((layer.ripple.rx || 46) / 100) * W * 2, h = w * (layer.ripple.flat || 0.24), period = layer.ripple.period || 5;
                        return <div key={k} style={{ position: "absolute", left: `${layer.ripple.x}%`, top: `${layer.ripple.y}%`, width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, borderRadius: "50%", boxSizing: "border-box",
                          border: `2px solid ${layer.ripple.color || "rgba(200,255,238,.6)"}`, boxShadow: `0 0 10px ${layer.ripple.color || "rgba(170,255,230,.35)"}, inset 0 0 8px ${layer.ripple.color || "rgba(170,255,230,.2)"}`,
                          opacity: 0, animation: `rc3-ripple ${period}s cubic-bezier(.2,.6,.4,1) ${(-(k * period) / 4).toFixed(2)}s infinite` }} />; })}
                    </div>
                  )}
                  {layer.pixelate && interactive && (
                    <svg aria-hidden="true" width="0" height="0" style={{ position: "absolute" }}>
                      <filter id={`${uid}pix${layer.id}`} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
                        <feFlood x={layer.pixelate / 2 - 0.5} y={layer.pixelate / 2 - 0.5} width="1" height="1" />
                        <feComposite width={layer.pixelate} height={layer.pixelate} />
                        <feTile result="grid" />
                        <feComposite in="SourceGraphic" in2="grid" operator="in" />
                        <feMorphology operator="dilate" radius={layer.pixelate / 2} />
                      </filter>
                    </svg>
                  )}
                  {layer.blend === "negation" && (
                    <div aria-hidden="true" style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", WebkitBackdropFilter: "invert(1)", backdropFilter: "invert(1)" }} />
                  )}
                  {/* layer.glitch, the rest of it: two tinted copies of the layer that show only in the bursts, each a thin band thrown
                      sideways (the colours of a signal coming apart), and scan lines that crawl down the figure, cut to its own shape. */}
                  {layer.glitch && interactive && !layer.visit && (() => { const g = layer.glitch, period = g.period || 4.6;
                    const vars = { "--gt": `${g.top ?? 0}%`, "--gh": `${g.height ?? 100}%`, "--gs": `${g.shift ?? 1.4}%` };
                    const lay = { ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", transform: `${slide} scale(${layer.scale ?? 1})`, transition: "transform var(--ease, 500ms) ease-out" };
                    return (
                      <React.Fragment key="glitch">
                        {[["hue-rotate(150deg) saturate(2.2) brightness(1.25)", 0], ["hue-rotate(-70deg) saturate(2.2) brightness(1.25)", -0.37]].map(([tint, lag], gi) => (
                          <img key={gi} src={layer.src} alt="" aria-hidden="true" draggable={false} decoding="async" style={{ ...lay, ...vars, opacity: 0, mixBlendMode: "screen", filter: layer.pixelate ? `url(#${uid}pix${layer.id}) ${tint}` : tint,
                            animation: `rc3-glitch-ghost ${period}s steps(1, end) ${(lag * period).toFixed(2)}s infinite` }} />
                        ))}
                        {g.scan !== false && <div aria-hidden="true" style={{ ...lay, opacity: g.scan ?? 0.45, WebkitMaskImage: `url(${layer.src})`, maskImage: `url(${layer.src})`, WebkitMaskSize: "100% 100%", maskSize: "100% 100%",
                          background: "repeating-linear-gradient(0deg, rgba(20,0,60,.7) 0 1px, rgba(20,0,60,0) 1px 3px)", animation: "rc3-scan 1.4s linear infinite" }} />}
                      </React.Fragment>
                    ); })()}
                  {/* A visit (layer.visit: { x, y } the point she is drawn up toward, in % of the layer; rise and fall, how far she travels
                      in % of the layer; shrink, how much smaller she is at the top; fine and coarse, two pixel sizes in px of the card).
                      The tilt decides whether she is arriving or leaving. Tip the card back (--ty < 0) and she rises toward that
                      point, smaller, fainter, breaking into coarse blocks. Tip it forward and she comes down, whole and sharp. At
                      rest she hangs between, in fine blocks. Three copies of the layer (sharp, fine, coarse) cross-fade to do it.
                      A glitch on the same layer becomes a stutter of the whole figure. */}
                  {layer.visit && interactive && (() => { const v = layer.visit, fine = v.fine ?? 3, coarse = v.coarse ?? 8, g = layer.glitch;
                    const up = "min(var(--ty, 0), 0)", down = "max(var(--ty, 0), 0)", full = { ...abs, left: 0, top: 0, width: "100%", height: "100%" };
                    const pix = (id, size) => (
                      <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
                        <feFlood x={size / 2 - 0.5} y={size / 2 - 0.5} width="1" height="1" /><feComposite width={size} height={size} /><feTile result="grid" />
                        <feComposite in="SourceGraphic" in2="grid" operator="in" /><feMorphology operator="dilate" radius={size / 2} />
                      </filter>);
                    // A tear (visit.tear: { amp } px of the card, bands the noise's vertical frequency): her red, green and blue come apart
                    // sideways in bands, each channel pushed its own way by the same slow noise, which is re-dealt a few times a
                    // second. Transparency is kept (each channel carries the layer's alpha). It shows mid-departure, between the
                    // fine blocks and the coarse, and, as visit.stutter (seconds), for a blink every so often.
                    const tear = v.tear === false ? null : (v.tear || {}), stutter = tear && v.stutter !== false ? (v.stutter || 7) : 0;
                    const tearFilter = (id, amp, dur) => (
                      <filter id={id} x="-15%" y="0" width="130%" height="100%" colorInterpolationFilters="sRGB">
                        <feTurbulence type="fractalNoise" baseFrequency={`0.0015 ${tear.bands ?? 0.055}`} numOctaves="1" seed="2">
                          <animate attributeName="seed" values="2;11;5;17;8;3" dur={`${dur}s`} calcMode="discrete" repeatCount="indefinite" />
                        </feTurbulence>
                        <feColorMatrix values="1 0 0 0 0  0 0 0 0 .5  0 0 1 0 0  0 0 0 1 0" result="n" />
                        <feColorMatrix in="SourceGraphic" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" /><feDisplacementMap in2="n" scale={amp} xChannelSelector="R" yChannelSelector="G" result="r" />
                        <feColorMatrix in="SourceGraphic" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" /><feDisplacementMap in2="n" scale={-amp * 0.6} xChannelSelector="B" yChannelSelector="G" result="g" />
                        <feColorMatrix in="SourceGraphic" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" /><feDisplacementMap in2="n" scale={-amp * 1.3} xChannelSelector="R" yChannelSelector="G" result="b" />
                        <feBlend in="r" in2="g" mode="screen" result="rg" /><feBlend in="rg" in2="b" mode="screen" />
                      </filter>);
                    const ease = "translate 600ms ease-out, scale 600ms ease-out, opacity 600ms ease-out";
                    return (
                      <div key="visit" aria-hidden="true" style={{ ...full, pointerEvents: "none", transform: `${slide} scale(${layer.scale ?? 1})`, transition: "transform var(--ease, 500ms) ease-out" }}>
                        <svg width="0" height="0" style={{ position: "absolute" }}>{pix(`${uid}vf${layer.id}`, fine)}{pix(`${uid}vc${layer.id}`, coarse)}{tear && tearFilter(`${uid}vt${layer.id}`, tear.amp ?? 16, 0.9)}{tear && stutter && tearFilter(`${uid}vs${layer.id}`, (tear.amp ?? 16) * 1.8, 0.35)}</svg>
                        <div style={{ ...full, transformOrigin: `${v.x ?? 50}% ${v.y ?? 0}%`, transition: ease,
                          translate: `0 calc(${up} * ${v.rise ?? 4}% + ${down} * ${v.fall ?? 3}%)`, scale: `calc(1 + ${up} * ${v.shrink ?? 0.45} + ${down} * ${v.grow ?? 0.06})`,
                          opacity: `clamp(${v.faint ?? 0.12}, calc(${v.rest ?? 0.8} + var(--ty, 0) * 0.75), 1)` }}>
                          {stutter > 0 && <img src={layer.src} alt="" draggable={false} decoding="async" style={{ ...full, opacity: 0, filter: `url(#${uid}vs${layer.id})`, animation: `rc3-tear-on ${stutter}s steps(1, end) infinite` }} />}
                          <div style={{ ...full, ...(stutter > 0 ? { animation: `rc3-tear-off ${stutter}s steps(1, end) infinite` } : null), ...(g ? { "--gt": `${g.top ?? 0}%`, "--gh": `${g.height ?? 100}%`, "--go": 1, "--gp": "opacity(1)", "--gs": `${g.shift ?? 0.8}%`, animation: `rc3-glitch ${g.period || 7}s steps(1, end) infinite` } : null) }}>
                            {v.pixels ? (
                              <>
                                <svg width="0" height="0" style={{ position: "absolute" }}><filter id={`${uid}vq${layer.id}`} data-visit-pix={layer.id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
                                  <feFlood x="1.5" y="1.5" width="1" height="1" /><feComposite width="4" height="4" /><feTile result="grid" />
                                  <feComposite in="SourceGraphic" in2="grid" operator="in" /><feMorphology operator="dilate" radius="2" />
                                </filter></svg>
                                <img data-visit-img={layer.id} src={layer.src} alt="" draggable={false} decoding="async" style={{ ...full, transition: "opacity 600ms ease-out",
                                  opacity: tear ? `clamp(0.3, max((var(--ty, 0) + 0.4) * 3.2, (var(--ty, 0) + 0.4) * -3.2), 1)` : 1 }} />
                              </>
                            ) : (<>
                            <img src={layer.src} alt="" draggable={false} decoding="async" style={{ ...full, transition: "opacity 600ms ease-out", opacity: `clamp(0, calc(var(--ty, 0) * 2.4 + 0.15), 1)` }} />
                            <img src={layer.src} alt="" draggable={false} decoding="async" style={{ ...full, transition: "opacity 600ms ease-out", filter: `url(#${uid}vf${layer.id})`, opacity: `clamp(0, calc(1 - max(var(--ty, 0) * 2.6, var(--ty, 0) * -1.7)), 1)` }} />
                            <img src={layer.src} alt="" draggable={false} decoding="async" style={{ ...full, transition: "opacity 600ms ease-out", filter: `url(#${uid}vc${layer.id})`, opacity: tear ? `clamp(0, calc(var(--ty, 0) * -2.6 - 0.75), 1)` : `clamp(0, calc(var(--ty, 0) * -1.9 - 0.12), 1)` }} />
                            </>)}
                            {tear && <img src={layer.src} alt="" draggable={false} decoding="async" style={{ ...full, transition: "opacity 600ms ease-out", filter: `url(#${uid}vt${layer.id})`, opacity: `clamp(0, calc(1 - max((var(--ty, 0) + 0.4) * 3.2, (var(--ty, 0) + 0.4) * -3.2)), 1)` }} />}
                          </div>
                        </div>
                      </div>
                    ); })()}
                  {/* layer.tractor, the rest of it. A cold copy of the beam (blue-white) fades in as she leaves, so the light turns from
                      gold to cold. And rings: bands of light, cut to the beam's own shape, running up the cone when the card is tipped
                      back and down it when tipped forward; faint, both ways, at rest. Both pinch and open with the beam. */}
                  {layer.tractor && interactive && (() => { const t = layer.tractor, gap = t.gap || 48, speed = t.speed || 1.5;
                    const lay = { ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", transform: `${slide} scale(${layer.scale ?? 1})`, transformOrigin: `${t.x ?? 50}% ${t.y ?? 0}%`,
                      scale: `calc(1 + min(var(--ty, 0), 0) * ${t.pinch ?? 0.55} + max(var(--ty, 0), 0) * ${t.widen ?? 0.14}) 1`, transition: "transform var(--ease, 500ms) ease-out, scale 600ms ease-out, opacity 600ms ease-out" };
                    const mask = { WebkitMaskImage: `url(${layer.src})`, maskImage: `url(${layer.src})`, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" };
                    const band = `repeating-linear-gradient(180deg, rgba(255,246,214,0) 0, rgba(255,246,214,0) ${gap * 0.55}px, rgba(255,248,224,${t.ring ?? 0.6}) ${gap * 0.8}px, rgba(255,246,214,0) ${gap}px)`;
                    return (
                      <React.Fragment key="tractor">
                        {t.cold !== false && <img src={layer.src} alt="" aria-hidden="true" draggable={false} decoding="async" style={{ ...lay, filter: "hue-rotate(175deg) saturate(1.3) brightness(1.25)", opacity: `clamp(0, calc(var(--ty, 0) * ${-(t.cold ?? 0.9)}), 1)` }} />}
                        {[["up", -gap, `clamp(0, calc(${t.idle ?? 0.1} - var(--ty, 0) * 1.2), 1)`], ["down", gap, `clamp(0, calc(${t.idle ?? 0.1} + var(--ty, 0) * 1.2), 1)`]].map(([k, to, op]) => (
                          <div key={k} aria-hidden="true" style={{ ...lay, ...mask, mixBlendMode: "screen", opacity: op, background: band, "--rp": `${to}px`, animation: `rc3-rings ${speed}s linear infinite` }} />
                        ))}
                      </React.Fragment>
                    ); })()}
                  {/* Motes (layer.motes: { n, top: { x, y, w }, bottom: { x, y, w } } a cone in % of the layer, w its half-width; travel in
                      px of the card): dust in a beam. Two sets, one rising and one falling; the tilt fades one up and the other
                      down, so at rest they drift both ways. */}
                  {layer.motes && interactive && (() => { const m = layer.motes, n = m.n || 16, travel = m.travel || 90, rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
                    const set = (rising) => (
                      <div key={rising ? "up" : "down"} style={{ position: "absolute", inset: 0, transition: "opacity 700ms ease-out", opacity: rising ? "clamp(0, calc(0.55 - var(--ty, 0) * 1.6), 1)" : "clamp(0, calc(0.55 + var(--ty, 0) * 1.6), 1)" }}>
                        {Array.from({ length: n }, (_, i) => { const k = rising ? 1 : 2, t = 0.2 + rnd(i, k) * 0.75, w = m.top.w + (m.bottom.w - m.top.w) * t, period = 5 + rnd(i, k + 2) * 5, size = 1.6 + rnd(i, k + 4) * 2.2;
                          return <div key={i} style={{ position: "absolute", left: `${m.top.x + (m.bottom.x - m.top.x) * t + (rnd(i, k + 6) - 0.5) * 1.7 * w}%`, top: `${m.top.y + (m.bottom.y - m.top.y) * t}%`, width: size, height: size, marginLeft: -size / 2, borderRadius: "50%",
                            background: "radial-gradient(circle, rgba(255,250,225,1) 0, rgba(255,225,150,.7) 45%, rgba(255,210,120,0) 75%)", boxShadow: "0 0 4px 1px rgba(255,225,150,.55)", opacity: 0,
                            "--mdx": `${((rnd(i, k + 8) - 0.5) * 14).toFixed(1)}px`, "--mdy": `${(travel * (0.6 + rnd(i, k + 10) * 0.6)).toFixed(0)}px`,
                            animation: `rc3-mote ${period.toFixed(2)}s linear ${(-rnd(i, k + 12) * period).toFixed(2)}s infinite ${rising ? "normal" : "reverse"}` }} />; })}
                      </div>);
                    return (
                      <div key="motes" aria-hidden="true" style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", mixBlendMode: "screen", transform: `${slide} scale(${layer.scale ?? 1})`, transition: "transform var(--ease, 500ms) ease-out, scale 600ms ease-out",
                        ...(layer.tractor ? { transformOrigin: `${layer.tractor.x ?? 50}% ${layer.tractor.y ?? 0}%`, scale: `calc(1 + min(var(--ty, 0), 0) * ${layer.tractor.pinch ?? 0.55} + max(var(--ty, 0), 0) * ${layer.tractor.widen ?? 0.14}) 1` } : null) }}>
                        {set(true)}{set(false)}
                      </div>
                    ); })()}
                  {/* Lamps (layer.lamps: [{ x, y, r }] in % of the layer, r in px of the card; lampPeriod seconds): running lights. Each
                      swells in its turn, so the light chases from the first to the last. */}
                  {layer.lamps && interactive && (
                    <div aria-hidden="true" style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", mixBlendMode: "screen", transform: `${slide} scale(${layer.scale ?? 1})`, transition: "transform var(--ease, 500ms) ease-out" }}>
                      {layer.lamps.map((l, li) => { const period = layer.lampPeriod || 2.4, r = l.r || 9;
                        return <div key={li} style={{ position: "absolute", left: `${l.x}%`, top: `${l.y}%`, width: r * 2, height: r * 1.3, marginLeft: -r, marginTop: -r * 0.65, borderRadius: "50%", opacity: 0.12,
                          background: `radial-gradient(ellipse, ${l.color || "rgba(255,244,200,.95)"} 0, rgba(255,190,70,.55) 40%, rgba(255,160,40,0) 72%)`, animation: `rc3-lamp ${period}s ease-in-out ${(-period + (li * period) / layer.lamps.length).toFixed(2)}s infinite` }} />; })}
                    </div>
                  )}
                  {/* layer.screen: a television's picture, drawn on the layer (AdScreen, above), and layer.screen.glow: { x, y, w, h } in % of
                      the layer, the light the screen throws on what is under it, flickering with the picture. Drawn on stills too. */}
                  {layer.screen && (
                    <div aria-hidden="true" style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", transform: `${slide} scale(${layer.scale ?? 1})`, transition: interactive ? "transform var(--ease, 500ms) ease-out" : undefined }}>
                      <AdScreen spec={layer.screen} src={layer.src} live={interactive} uid={uid} w={W} h={H} />
                      {layer.screen.glow && interactive && <div style={{ position: "absolute", left: `${layer.screen.glow.x}%`, top: `${layer.screen.glow.y}%`, width: `${layer.screen.glow.w}%`, height: `${layer.screen.glow.h}%`, borderRadius: "50%", mixBlendMode: "screen",
                        background: "radial-gradient(ellipse, rgba(120,150,255,.75) 0, rgba(60,90,255,.35) 45%, rgba(40,60,255,0) 72%)", animation: "rc3-ad-glow 2.7s steps(1) infinite" }} />}
                    </div>
                  )}
                  {/* A neon sign (layer.neon: { hang: { x, y } where it hangs from, in % of the layer; sway degrees; tube: { top } the % of
                      the layer above which nothing is lit (chains); drop: { x0, y0, x1, y1, feather } one letter's box in % of the
                      layer; period seconds between that letter's failures). The sign hums: its light wavers a hair, a soft halo of
                      its own colours breathes round it, it turns a little on its chains, and one letter keeps failing and catching
                      again. The failure is an unlit copy of the layer laid over that letter, its edges feathered (two gradients,
                      intersected), so no box shows against the glow the letters share. */}
                  {layer.neon && interactive && (() => { const n = layer.neon, d = n.drop, full = { ...abs, left: 0, top: 0, width: "100%", height: "100%" };
                    const f = d ? (d.feather ?? 0.6) : 0, fy = f * (W / H);
                    const fade = d ? `linear-gradient(90deg, transparent ${d.x0 - f}%, #000 ${d.x0 + f}%, #000 ${d.x1 - f}%, transparent ${d.x1 + f}%), linear-gradient(180deg, transparent ${d.y0 - fy}%, #000 ${d.y0 + fy}%, #000 ${d.y1 - fy}%, transparent ${d.y1 + fy}%)` : undefined;
                    return (
                      <div key="neon" aria-hidden="true" style={{ ...full, pointerEvents: "none", transform: `${slide} scale(${layer.scale ?? 1})`, transition: "transform var(--ease, 500ms) ease-out" }}>
                        <div style={{ ...full, transformOrigin: `${n.hang?.x ?? 50}% ${n.hang?.y ?? 0}%`, "--sw": `${n.sway ?? 0.8}deg`, animation: n.sway === 0 ? undefined : `rc3-neon-sway ${n.swing || 3.4}s ease-in-out infinite alternate` }}>
                          <img src={layer.src} alt="" draggable={false} decoding="async" style={{ ...full, mixBlendMode: "screen", filter: `blur(${n.halo ?? 7}px) brightness(1.5) saturate(1.4)`, clipPath: `inset(${n.tube?.top ?? 0}% 0 0 0)`, opacity: .8, animation: "rc3-breathe 2.9s ease-in-out infinite", "--b0": .55 }} />
                          <img src={layer.src} alt="" draggable={false} decoding="async" style={{ ...full, animation: "rc3-neon-buzz 1.7s steps(1, end) infinite" }} />
                          {d && <img src={layer.src} alt="" draggable={false} decoding="async" style={{ ...full, opacity: 0, filter: `grayscale(1) brightness(${d.dim ?? 0.38})`, WebkitMaskImage: fade, maskImage: fade, WebkitMaskComposite: "source-in", maskComposite: "intersect",
                            animation: `rc3-neon-drop ${n.period || 9}s steps(1, end) infinite` }} />}
                        </div>
                      </div>
                    ); })()}
                  {/* A tumbling glow (layer.roll: { top, bottom } the band of the layer it fills, in %; period seconds; strength 0-1; size, the
                      patches' scale in px of the card; color "r,g,b"). Soft patches of light, cut to the layer's own shape, drift up
                      through it: two sheets of the same slow noise, one climbing to the left and one to the right at different
                      speeds, so the bright patches form, cross and break up. Heat turning over in a flame. Nothing moves. */}
                  {layer.roll && interactive && (() => { const r = layer.roll, top = r.top ?? 0, bottom = r.bottom ?? 100, size = r.size || 150, c = (r.color || "255,205,96").split(","), period = r.period || 3.2;
                    const noise = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.016 .024' numOctaves='2' seed='7' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${(c[0] / 255).toFixed(2)}  0 0 0 0 ${(c[1] / 255).toFixed(2)}  0 0 0 0 ${(c[2] / 255).toFixed(2)}  4.2 0 0 0 -2.2'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`)}")`;
                    const sheet = (k, sz, dx, dur) => <div key={k} style={{ position: "absolute", left: 0, right: 0, top: `${top}%`, height: `${bottom - top}%`, opacity: r.strength ?? 0.8, mixBlendMode: "screen",
                      background: `${noise} 0 0 / ${sz}px ${sz}px`, "--nx": `${dx * sz}px`, "--ny": `${-sz}px`, animation: `rc3-roll ${dur.toFixed(2)}s linear infinite` }} />;
                    return (
                      <div key="roll" aria-hidden="true" style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", mixBlendMode: "screen", transform: `${slide} scale(${layer.scale ?? 1})`, transition: "transform var(--ease, 500ms) ease-out",
                        WebkitMaskImage: `url(${layer.src})`, maskImage: `url(${layer.src})`, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" }}>
                        {sheet("a", size, 1, period)}{sheet("b", size * 0.62, -1, period * 0.71)}
                      </div>
                    ); })()}
                  {/* layer.facets: { at: [{ x, y, r }] the patches, in % of the layer, r in px of the card; cx, cy the layer's middle, which
                      each patch faces away from; period seconds per circuit; idle, the circling light's reach; strength }. The light
                      itself is worked out each frame (above); here are the patches, white-hot at the core, cut to the layer's shape. */}
                  {layer.facets && interactive && (
                    <div aria-hidden="true" style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", mixBlendMode: "screen", transform: `${slide} scale(${layer.scale ?? 1})`, transition: "transform var(--ease, 500ms) ease-out",
                      WebkitMaskImage: `url(${layer.src})`, maskImage: `url(${layer.src})`, WebkitMaskSize: "100% 100%", maskSize: "100% 100%" }}>
                      {layer.facets.at.map((f, fi) => { const dx = (f.x - (layer.facets.cx ?? 50)) * W, dy = (f.y - (layer.facets.cy ?? 50)) * H, n = Math.hypot(dx, dy) || 1, r = f.r || 26;
                        return <div key={fi} data-facet={layer.id} data-ax={(dx / n).toFixed(3)} data-ay={(dy / n).toFixed(3)} style={{ position: "absolute", left: `${f.x}%`, top: `${f.y}%`, width: r * 2, height: r * 2.6, marginLeft: -r, marginTop: -r * 1.3, borderRadius: "50%", opacity: 0,
                          background: "radial-gradient(ellipse, rgba(255,255,236,.95) 0, rgba(255,232,140,.8) 30%, rgba(255,170,50,.4) 60%, rgba(255,140,30,0) 78%)" }} />; })}
                    </div>
                  )}
                  {/* Lamplight (layer.glows: [{ x, y, r, color? "r,g,b", period? }] in % of the layer, r in px of the card): a flame behind
                      glass that is painted into a bigger layer. A warm pool of light sits on it and gutters, unevenly; the paint under
                      it does not move. */}
                  {layer.glows && interactive && (
                    <div aria-hidden="true" style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", mixBlendMode: "screen", transform: `${slide} scale(${layer.scale ?? 1})`, transition: "transform var(--ease, 500ms) ease-out" }}>
                      {layer.glows.map((g, gi) => { const r = g.r || 40, c = g.color || "255,196,96", period = g.period || 2.3;
                        return <div key={gi} style={{ position: "absolute", left: `${g.x}%`, top: `${g.y}%`, width: r * 2, height: r * 2, marginLeft: -r, marginTop: -r, borderRadius: "50%",
                          background: `radial-gradient(circle, rgba(255,246,214,.85) 0, rgba(${c},.6) 16%, rgba(${c},.22) 42%, rgba(${c},0) 70%)`, animation: `rc3-ember ${period}s ease-in-out ${(-gi * 0.7).toFixed(1)}s infinite` }} />; })}
                    </div>
                  )}
                  {/* Mist (layer.mist: { x0, x1, y0, y1 } a band of the layer in %; period seconds; strength 0-1; color "r,g,b"): low fog.
                      Two sheets of slow noise slide across the band, one each way, and fade out at its edges. */}
                  {layer.mist && interactive && (() => { const m = layer.mist, c = (m.color || "170,235,240").split(","), period = m.period || 26;
                    const noise = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='300' height='120'><filter id='n' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.012 .035' numOctaves='2' seed='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${(c[0] / 255).toFixed(2)}  0 0 0 0 ${(c[1] / 255).toFixed(2)}  0 0 0 0 ${(c[2] / 255).toFixed(2)}  3 0 0 0 -1.15'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`)}")`;
                    const fade = "linear-gradient(90deg, transparent, #000 22%, #000 78%, transparent), linear-gradient(180deg, transparent, #000 45%, #000 70%, transparent)";
                    return (
                      <div key="mist" aria-hidden="true" style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", transform: `${slide} scale(${layer.scale ?? 1})`, transition: "transform var(--ease, 500ms) ease-out" }}>
                        <div style={{ position: "absolute", left: `${m.x0}%`, width: `${m.x1 - m.x0}%`, top: `${m.y0}%`, height: `${m.y1 - m.y0}%`, opacity: m.strength ?? 0.5, filter: "blur(2px)",
                          WebkitMaskImage: fade, maskImage: fade, WebkitMaskComposite: "source-in", maskComposite: "intersect" }}>
                          <div style={{ position: "absolute", inset: 0, background: `${noise} 0 0 / 300px 100%`, "--nx": "300px", animation: `rc3-mist ${period}s linear infinite` }} />
                          <div style={{ position: "absolute", inset: 0, background: `${noise} 90px 0 / 210px 100%`, "--nx": "-210px", opacity: .7, animation: `rc3-mist ${(period * 0.63).toFixed(1)}s linear infinite` }} />
                        </div>
                      </div>
                    ); })()}
                  {/* layer.flames: [{ x, y, r }] the foot of each flame (its wick) in % of the layer, and r, the reach of
                      the window cut around it, in px of the card. Each is the layer again, clipped to that one flame,
                      flickering on its own clock about its own wick, with a soft glow that breathes behind it. */}
                  {layer.flames && interactive && layer.flames.map((f, fi) => { const period = 1.5 + ((fi * 5) % 4) * 0.23, delay = -((fi * 0.618) % 1) * period, r = f.r || 14;
                    return (
                      <React.Fragment key={`flame${fi}`}>
                        <div aria-hidden="true" style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", mixBlendMode: "screen", transform: `${slide} scale(${layer.scale ?? 1})`, transition: "transform var(--ease, 500ms) ease-out" }}>
                          <div style={{ position: "absolute", left: `${f.x}%`, top: `${f.y}%`, width: r * 5, height: r * 5, marginLeft: -r * 2.5, marginTop: -r * 3.1, borderRadius: "50%",
                            background: "radial-gradient(circle, rgba(255,214,120,.5) 0, rgba(255,170,60,.2) 35%, rgba(255,150,40,0) 70%)", animation: `rc3-flicker ${(period * 1.7).toFixed(2)}s ease-in-out ${delay.toFixed(2)}s infinite` }} />
                        </div>
                        <img src={layer.src} alt="" aria-hidden="true" draggable={false} decoding="async" style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none",
                          transform: `${slide} scale(${layer.scale ?? 1})`, transition: "transform var(--ease, 500ms) ease-out", clipPath: `circle(${r}px at ${f.x}% calc(${f.y}% - ${r * 0.62}px))`,
                          transformOrigin: `${f.x}% ${f.y}%`, animation: `rc3-flicker ${period.toFixed(2)}s ease-in-out ${delay.toFixed(2)}s infinite` }} />
                      </React.Fragment>
                    ); })}
                  {/* Where a click counts as a click on the wheel: its disc, sliding with it. Nothing is drawn. */}
                  {layer.spin && interactive && <div data-spin-hit="" aria-hidden="true" style={{ position: "absolute", left: `${layer.spin.x}%`, top: `${layer.spin.y}%`, width: ((layer.spin.r || 30) / 100) * W * 2, height: ((layer.spin.r || 30) / 100) * W * 2, marginLeft: -((layer.spin.r || 30) / 100) * W, marginTop: -((layer.spin.r || 30) / 100) * W, borderRadius: "50%", pointerEvents: "none", transform: slidePx }} />}
                  {layer.bolts && interactive && (
                    <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", mixBlendMode: "screen", overflow: "visible",
                      transform: `${slide} scale(${layer.scale ?? 1})`, transition: "transform var(--ease, 500ms) ease-out", filter: `drop-shadow(0 0 2px #fff) drop-shadow(0 0 5px ${layer.bolts.color || "#59c2ff"}) drop-shadow(0 0 12px ${layer.bolts.color || "#59c2ff"})` }}>
                      {boltPaths(layer.bolts).map((b, bi) => <path key={bi} d={b.d} fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round"
                        style={{ opacity: 0, animation: `rc3-bolt ${b.period.toFixed(2)}s linear ${b.delay.toFixed(2)}s infinite` }} />)}
                    </svg>
                  )}
                  {light?.glint}
                  {/* Glints (layer.glints: points in % of the layer, each { x, y, size? }): four-pointed sparks that
                      flare and die one after another, each on its own clock, riding the layer as it slides. On the
                      live card only; a turn of the card brightens them. */}
                  {layer.glints && interactive && (
                    <div aria-hidden="true" style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", mixBlendMode: "screen",
                      transform: `${slide} scale(${layer.scale ?? 1})`, transition: "transform var(--ease, 500ms) ease-out", opacity: "calc(.75 + var(--lit, 0) * .25)" }}>
                      {layer.glints.map((g, gi) => {
                        const size = (g.size || 1) * 66, period = 2.1 + ((gi * 7) % 5) * 0.45;
                        return <div key={gi} style={{ position: "absolute", left: `${g.x}%`, top: `${g.y}%`, width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2,
                          animation: `rc3-glint ${period}s ease-in-out ${(-((gi * 0.618) % 1) * period).toFixed(2)}s infinite`, scale: "0",
                          background: `radial-gradient(circle, #fff 0, rgba(255,255,255,.95) 7%, ${g.color || "rgba(190,220,255,.55)"} 18%, transparent 38%), linear-gradient(90deg, transparent 4%, rgba(255,255,255,.95) 50%, transparent 96%) center / 100% 7% no-repeat, linear-gradient(0deg, transparent 4%, rgba(255,255,255,.95) 50%, transparent 96%) center / 7% 100% no-repeat` }} />;
                      })}
                    </div>
                  )}
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
                  {/* A flash along the masked lines (apparition.flash, its period in seconds): a ring of light that runs
                      out from her through the mask, over and over, on the live card only. Brighter as the card tilts. */}
                  {light && apparition.mask && apparition.flash && interactive && (
                    <div aria-hidden="true" style={{ ...abs, left: 0, top: 0, width: "100%", height: "100%", pointerEvents: "none", mixBlendMode: "screen",
                      transform: `${slide} scale(${layer.scale ?? 1})`, transition: "transform var(--ease, 500ms) ease-out, opacity var(--ease, 500ms) ease-out",
                      WebkitMaskImage: `url("${apparition.mask}")`, maskImage: `url("${apparition.mask}")`, WebkitMaskSize: "100% 100%", maskSize: "100% 100%",
                      opacity: "calc(.45 + var(--lit, 0) * .55)", filter: `drop-shadow(0 0 4px ${apparition.color})` }}>
                      <div style={{ position: "absolute", inset: 0, backgroundRepeat: "no-repeat", backgroundPosition: `${apparition.cx}% ${apparition.cy}%`,
                        backgroundImage: `radial-gradient(circle at ${apparition.cx}% ${apparition.cy}%, transparent 0%, transparent 7%, rgba(255,253,235,1) 10%, rgba(255,238,170,.75) 12%, transparent 16%)`,
                        animation: `rc3-flash ${apparition.flash}s ease-out infinite` }} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
          {wasLive && data.live3d && <RcanaLive3D key={data.id} kind={data.live3d} paused={!interactive} style={{ position: "absolute", left: 0, top: 0, width: 480, height: 470 }} />}
          {/* Full art: the shade the words stand on. A soft pool behind the rules, widest in the middle and thinning
              to almost nothing at the sides so the picture's corners stay bright, over a band at the foot for the name. */}
          {fullArt && <div aria-hidden="true" style={{ ...abs, left: 0, top: 380, width: 480, height: artH - 380, pointerEvents: "none",
            background: "radial-gradient(ellipse 58% 44% at 50% 50%, rgba(10,6,19,.66) 0%, rgba(10,6,19,.5) 50%, rgba(10,6,19,0) 100%), linear-gradient(180deg, rgba(10,6,19,0) 0%, rgba(10,6,19,0) 58%, rgba(10,6,19,.6) 80%, rgba(10,6,19,.88) 100%)" }} />}
        </div>
        <div style={{ ...abs, left: 14, top: 14, width: 480, height: artH, border: `2px solid ${GOLD}`, borderRadius: 12 }} />

        <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} style={{ ...abs, inset: 0, width: W, height: H, pointerEvents: "none" }}
          dangerouslySetInnerHTML={{ __html: filigreeMarkup(m, GILT) }} />

        {/* Top left: what it costs. */}
        {m.topLeft?.shape === "drop" && (
          <svg role="img" aria-label={m.topLeft.label} viewBox="0 0 100 116" style={{ ...abs, left: TL_DROP.x, top: TL_DROP.y, width: 96, height: 111 }}>
            <path d={DROP_OUTER} fill={INK} stroke={INK} strokeWidth="9" strokeLinejoin="round" />
            <path d={DROP_OUTER} fill={GOLD_LO} /><path d={DROP_INNER} fill={GOLD_HI} />
            <text x="50" y={dropNum(m.topLeft.value).y} style={num(dropNum(m.topLeft.value).size)}>{m.topLeft.value}</text>
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
        {!fullArt && <div style={{ ...abs, left: 28, top: 440, width: 456, height: 154, boxSizing: "border-box", border: `2px solid ${GOLD}`, borderRadius: 12, background: PARCHMENT }} />}
        {!fullArt && <div style={{ ...abs, left: 35, top: 447, width: 442, height: 140, boxSizing: "border-box", border: "1px solid #b9892f", borderRadius: 7 }} />}
        {/* THE APPARITION KEYWORD (APPARITION_KEYWORD, below the imports): every card that carries Our Lady's image wears
            the badge at the head of its text box, a dark pill in a rainbow rim with her eight-pointed star, and beside
            it what witnessing her gives. The rules sit a little lower to make room. */}
        {m.keyword && (
          <div style={{ ...abs, left: tx, top: 459, width: tw, height: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, whiteSpace: "nowrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 18, boxSizing: "border-box", padding: "0 8px 0 6px", borderRadius: 9, border: "1.5px solid transparent",
              background: `linear-gradient(${INK}, ${INK}) padding-box, ${m.keyword.star ? 'linear-gradient(90deg, #ff5f6d, #ffc371, #f9f871, #5ee7a0, #4facfe, #b98cff, #ff5f6d)' : `linear-gradient(90deg, ${GOLD_LO}, ${GOLD_HI}, ${GOLD_LO})`} border-box`,
              fontFamily: CAPS, fontSize: 12, lineHeight: 1, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ffe9a6" }}>
              {!m.keyword.star && <svg aria-hidden="true" viewBox="-10 -10 20 20" style={{ width: 10, height: 10, flex: "none" }}><ellipse cx="0" cy="-1" rx="8" ry="3.4" fill="none" stroke="#ffd95a" strokeWidth="2.4" /></svg>}
              {m.keyword.star && <svg aria-hidden="true" viewBox="-10 -10 20 20" style={{ width: 10, height: 10, flex: "none" }}>
                <polygon fill="#ffd95a" points={Array.from({ length: 16 }, (_, k) => { const r = k % 2 ? 4 : 9.6; const a = (k * Math.PI) / 8 - Math.PI / 2; return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`; }).join(" ")} />
              </svg>}
              {m.keyword.name}
            </span>
            <span style={{ fontFamily: CAPS, fontSize: 11, lineHeight: 1, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7a4f00", ...(fullArt ? { color: "#ffe08a", ...ON_ART, WebkitTextStroke: "2.4px #0a0613" } : null) }}>{m.keyword.gift}</span>
          </div>
        )}
        <div style={{ ...abs, left: tx, top: m.keyword ? 476 : 462, width: tw, height: (m.flavor ? 74 : 118) - (m.keyword ? 13 : 0), display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ margin: 0, textAlign: "center", fontFamily: BODY, fontSize: textSize, lineHeight: 1.45, letterSpacing: "0.14em", textTransform: "uppercase", color: "#24160a", textWrap: "balance" /* lines of even length: no word left alone at a line's end */, ...(fullArt ? { color: "#fff", fontWeight: 700, ...ON_ART } : null) }}><RulesText text={m.text} /></p>
        </div>
        {m.flavor && (
          <>
            <svg aria-hidden="true" viewBox="0 0 160 12" style={{ ...abs, left: tx + tw / 2 - 80, top: 538, width: 160, height: 12 }}>
              <line x1="0" y1="6" x2="62" y2="6" stroke={fullArt ? GILT : "#b9892f"} strokeWidth="1.5" /><line x1="98" y1="6" x2="160" y2="6" stroke={fullArt ? GILT : "#b9892f"} strokeWidth="1.5" />
              <polygon points="80,1 86,6 80,11 74,6" fill={m.color} /><polygon points="68,3.5 71,6 68,8.5 65,6" fill="#b9892f" /><polygon points="92,3.5 95,6 92,8.5 89,6" fill="#b9892f" />
            </svg>
            <p style={{ ...abs, left: tx, top: 554, width: tw, textAlign: "center", fontFamily: BODY, fontSize: m.flavor.length > (tri ? 40 : 48) ? 10 : 11.5, fontStyle: "italic", lineHeight: 1.3, letterSpacing: "0.14em", textTransform: "uppercase", color: "#4a3520", ...(fullArt ? { color: "#f4ecd8", ...ON_ART, WebkitTextStroke: "2.4px #0a0613" } : null) }}>{m.flavor}</p>
          </>
        )}

        {tri && <><Trinity at={m.attrs} color={m.color} style={{ ...abs, left: 36, top: 449, width: 124, height: 124 }} tipBox={{ left: 162, top: 452, width: 308, height: 130 }} /><div style={{ ...abs, left: 156, top: 458, width: 1, height: 118, background: "#b9892f", opacity: 0.6 }} /></>}
        {/* Bottom left: what an Asset pays each turn. (The d8 was a Trader's Equanimity until 2026-11-20.) */}
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
          <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} style={{ ...abs, left: 0, top: 0, width: W, height: H, pointerEvents: "none" }}>
            <defs>
              <linearGradient id={`${uid}-foil`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={foil.x2} y2={foil.y2} spreadMethod="repeat">
                {foil.stops.map(([offset, color]) => <stop key={offset} offset={offset} stopColor={color} />)}
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="430" y2="190" spreadMethod="repeat">
                <stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset="0.42" stopColor="#fff" stopOpacity="0" /><stop offset="0.5" stopColor="#fff" stopOpacity={foil.sheen} /><stop offset="0.58" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
              <mask id={`${uid}-metal`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H} dangerouslySetInnerHTML={{ __html: metalMaskMarkup(m, fullArt) }} />
            </defs>
            <rect x="0" y="0" width={W} height={H} fill={`url(#${uid}-foil)`} mask={`url(#${uid}-metal)`} />
            <rect x="0" y="0" width={W} height={H} fill={`url(#${uid}-sheen)`} mask={`url(#${uid}-metal)`} />
          </svg>
        )}
        {/* The mirror: polished gold whose bands slide against the lean, under a glare that follows the pointer. */}
        {mirror && (
          <div aria-hidden="true" style={{ ...abs, left: 0, top: 0, width: W, height: H, pointerEvents: "none", WebkitMaskImage: metalMaskUrl(m, fullArt), maskImage: metalMaskUrl(m, fullArt), WebkitMaskSize: "100% 100%", maskSize: "100% 100%", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat" }}>
            <div style={{ ...abs, inset: 0, backgroundImage: "repeating-linear-gradient(calc(118deg + var(--ry, 0deg) * 1.6), #a06a00 0%, #d39a00 7%, #f2b705 13%, #fff6c4 19%, #ffd84a 25%, #c58600 36%, #a87000 44%, #ffe58a 55%, #fffbe0 59%, #f2b705 68%, #a06a00 100%)", backgroundSize: "320% 320%", backgroundPosition: "calc(50% + (50% - var(--mx, 50%)) * 1.5) calc(50% + (50% - var(--my, 50%)) * 1.5)", transition: "background-position var(--ease, 500ms) ease-out" }} />
            <div style={{ ...abs, inset: 0, mixBlendMode: "screen", backgroundImage: "radial-gradient(circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,.95) 0%, rgba(255,246,196,.5) 16%, rgba(255,255,255,0) 42%)" }} />
          </div>
        )}
        {(foil || mirror) && (
          <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} style={{ ...abs, left: 0, top: 0, width: W, height: H, pointerEvents: "none" }}>
            {/* The numerals the foil covered go back on top, in ink. */}
            {m.topLeft?.shape === "drop" && (
              <g transform={`translate(${TL_DROP.x},${TL_DROP.y}) scale(${TL_DROP.sx},${TL_DROP.sy})`}>
                <path d={DROP_INNER} fill="none" stroke="#3a1c00" strokeOpacity="0.45" strokeWidth="1.6" /><text x="50" y={dropNum(m.topLeft.value).y} style={num(dropNum(m.topLeft.value).size)}>{m.topLeft.value}</text>
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
        <div style={{ ...abs, left: 0, top: 423, width: W, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
          <p style={{ margin: 0, height: 34, boxSizing: "border-box", padding: "0 22px", border: `2px solid ${GOLD}`, borderRadius: 8, background: m.color, color: "#ffe9a6", fontFamily: CAPS, fontSize: 21, lineHeight: "30px", letterSpacing: "0.14em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{m.tab}</p>
        </div>

        {/* The name band. */}
        <p style={{ ...abs, left: 0, top: 602, width: W, textAlign: "center", fontFamily: CAPS, fontSize: 15, letterSpacing: "0.34em", lineHeight: 1, textTransform: "uppercase", ...giltText, ...(fullArt ? { filter: ON_ART_GILT } : null) }}>{m.typeLabel}</p>
        {m.apparition && (
          <svg role="img" aria-label="Apparition (Radi8): revealing this card grants one more action and a Miracle" viewBox="-10 -10 20 20" style={{ ...abs, left: W / 2 - String(m.typeLabel).length * 5.6 - 20, top: 600, width: 15, height: 15 }}>
            <polygon fill={GILT} stroke={INK} strokeWidth="0.8" points={Array.from({ length: 16 }, (_, k) => { const r = k % 2 ? 4 : 9.4; const a = (k * Math.PI) / 8 - Math.PI / 2; return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`; }).join(" ")} />
          </svg>
        )}
        <div style={{ ...abs, left: 96, top: 618, width: 320, height: 58, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ margin: 0, whiteSpace: "nowrap", fontFamily: NAME, fontWeight: 800, fontSize: nameSize, lineHeight: 1, ...giltText, ...(fullArt ? { filter: ON_ART_GILT } : null) }}>{m.name}</p>
        </div>

        {/* Bottom right: the seal over the collector number. */}
        <img src={SEAL} alt="The RL80 seal" draggable={false} style={{ ...abs, left: 434, top: 608, width: 60, height: 65, display: "block" }} />
        {m.collector && <p style={{ ...abs, left: 434, top: 678, width: 60, textAlign: "center", fontFamily: CAPS, fontSize: 13, letterSpacing: "0.12em", lineHeight: 1, color: "#e6d3a0", ...(fullArt ? { ...ON_ART, WebkitTextStroke: "2px #0a0613" } : null) }}>{m.collector}</p>}
      </div>
      </div>
    </div>
  );
}
