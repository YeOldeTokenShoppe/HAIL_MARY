"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fxMaterial } from "../game/terminal-traders/fxMaterials.js";
import { FRAMES } from "../game/terminal-traders/cardFrames.js";
import HoloFoilFrame from "./HoloFoilFrame.jsx";
import {
  RCANA_ASPECT,
  RCANA_LAYOUT,
  RCANA_DEPTHS,
  RCANA_RARITIES,
  CLASS_TONE,
  DEPTH_FLOOR,
  MAX_TILT,
  behindClip,
} from "../game/rcana/cardFace.js";
import { ArtifactHeader } from "./RcanaArtifactTemplate.jsx";
import { WORDMARK_CLASS_FONTS } from "../game/rcana/wordmarkFontStyles.js";
import { EventHeader } from "./RcanaEventTemplate.jsx";
import { SUBTYPE_FURNITURE_STYLES } from "./RcanaSubtypeFurniture.jsx";

import { RcanaLiquidityBox, RcanaValueBox, LIQUIDITY_BOX_STYLES } from "./RcanaLiquidityBox.jsx";
import { RcanaTypeHeader, TYPE_HEADER_STYLES } from "./RcanaTypeHeader.jsx";
import RcanaMedallion, { MEDALLION_STYLES } from "./RcanaMedallion.jsx";

// `lift` is 1 while a pointer or finger (or the gyro) is driving the tilt
// and 0 at rest — the frame shine fades up on it, the way TradingCard's
// does, so a card on the table is not permanently lit.
const REST = { rx: 0, ry: 0, mx: 50, my: 50, hyp: 0, lift: 0 };

// Card box in CSS px at scale 1. Every slot is a percentage of this, so the
// card re-renders identically at any scale — nothing is measured in px except
// the parallax depths, which are deliberately absolute (a 90px push should
// read as 90px of depth whether the card is a thumbnail or full bleed is
// false — so depth scales with the card, see depthFor()).
// The Terminal Traders rarity frames (cardFrames.js): stamped-metal borders
// with a transparent centre and a foil plate that masks the shine to the
// metal, plus the two live holo foils, which are WebGL (HoloFoilFrame).
export const RCANA_METAL_FRAMES = FRAMES;
const HOLO_SRC = /^holo:/;
// The live foil is cut out over windows it is given; the Terminal card's
// three slots do not apply here. The opening runs to the MIDDLE of the
// Lotería frame's inner black line (x 36–45px of 1027, y 36–44px of 1424),
// so the foil sits flush against the art window and the cream footer panel
// with half the line left as their outline — the panel has no side or
// bottom border of its own, the frame draws it. Stopping short of the line
// (as the printed metals' 3.5% band does) read as a dark channel between
// foil and panel. The shader unions its windows, which is how the opening
// gets two corner radii: the top pair concentric with the art window's
// corner (r ≈ 20px/1424 at the line's inner edge), the bottom pair
// concentric with the footer panel's .025u corner.
const RCANA_HOLO_WINDOWS = [
  { x0: 0.040, y0: 0.028, x1: 0.960, y1: 0.90, r: 0.0175 },  // top corners
  { x0: 0.040, y0: 0.10, x1: 0.960, y1: 0.972, r: 0.020 },   // bottom corners
];
// The Lotería frame's own corner, measured off LOTERIA_FRAME2.webp's alpha
// (50px of 1424). HoloFoilFrame's default is the Terminal card's 32/1038,
// a tighter corner, which left the foil's outer corner poking out past
// the printed card's rounder one.
const RCANA_HOLO_CORNER = 50 / 1424;

const CARD_W = 744;

// A layer at translateZ(z) under perspective P appears scaled by P/(P-z).
// Counter-scaling by (P-z)/P cancels that exactly, so at rest every layer
// measures one card and the stack looks like a single flat print. Depth only
// becomes visible when rotateX/rotateY shear the stack apart — which is the
// whole point: a parallax you can only see by moving the card.
const counterScale = (z, p) => (p - z) / p;

// A luminance mask that softly clears an fx sheet over one or more boxes, so
// the ink under it stays readable. White shows, black hides. The rects are
// blurred rather than cut: a hard corner taken out of a flame reads as a
// mistake, a fade reads as the fire thinning. Boxes are in card percent, and
// preserveAspectRatio="none" maps the 0-100 viewBox straight onto them.
// Mirrors the .rc-fx[data-clip="window"] .rc-fx-light rule, so a sheet that
// is both window-clipped and cleared keeps its bottom fade.
const FADE_OUT = "linear-gradient(to bottom, #000 0%, #000 72%, transparent 100%)";

const clearMask = (boxes) => {
  if (!boxes || !boxes.length) return null;
  const feather = Math.max(...boxes.map((b) => b.feather));
  const rects = boxes
    .map(
      (b) =>
        `<rect x='${b.x}' y='${b.y}' width='${b.w}' height='${b.h}' rx='1.5' fill='%23000'/>`
    )
    .join("");
  // The holes are cut INSIDE the SVG (an SVG mask on the white sheet), so
  // the image that reaches CSS is transparent where the ink should show.
  // An earlier version painted the boxes black on white and relied on
  // `mask-mode: luminance` to read that as a hole — WebKit ignores
  // mask-mode and masks by alpha, and black is as opaque as white, so on
  // Safari (iPad included) the sheet was never cleared. Alpha works in
  // every engine, so the luminance dependence is gone altogether.
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>` +
    `<filter id='f' filterUnits='userSpaceOnUse' x='-20' y='-20' width='140' height='140'>` +
    `<feGaussianBlur stdDeviation='${feather}'/></filter>` +
    `<mask id='m' maskUnits='userSpaceOnUse' x='0' y='0' width='100' height='100'>` +
    `<rect width='100' height='100' fill='%23fff'/>` +
    `<g filter='url(%23f)'>${rects}</g></mask>` +
    `<rect width='100' height='100' fill='%23fff' mask='url(%23m)'/></svg>`;
  return `url("data:image/svg+xml,${svg}")`;
};

export default function RcanaCard({
  data,
  scale = 1,
  interactive = true,
  // 0 flattens the stack into a print. 1 is the tuned depth; above 1
  // exaggerates, which is useful on the bench and silly on the table.
  depth = 1,
  // Paints the layout slots as labelled outlines. Bench only.
  showSlots = false,
  // Draws each FX sheet's light facets as ellipses over the sheet, numbered
  // in facet order. Bench only — this is how a mis-traced facet (one sitting
  // on empty sheet) is seen before it ships. `npm run rcana:lint` checks the
  // same thing without eyes.
  showFacets = false,
  // Hides the frame so the art layers can be checked on their own.
  hideFrame = false,
  // FX sheets in front of the card. Off for a thumbnail, where a flame
  // sheet is just noise over a 90px card.
  showFx = true,
  // Draws the ink above the FX sheets instead of under them. Physically the
  // fire is in front of the whole card, but a dense sheet over the ability
  // line costs more than the illusion buys; this is the escape hatch.
  inkOnTop = false,
  // Resting sway, so a card sitting alone still shows its depth. It costs a
  // React render per frame PER CARD, which is fine for one hero and ruinous
  // for a grid: twelve swaying cards measured 6fps against 60 with it off.
  // So it is opt-in, and even then only runs while the card is on screen.
  sway = false,
  // Whether a finger on the card tilts it INSTEAD of scrolling the page.
  // Right for a hero card someone is meant to play with; wrong in a binder,
  // where a card-sized dead zone in the scroll is a trap. Defaults to
  // following `sway`, which marks the same distinction.
  captureTouch = sway,
  // Mosaic wordmarks identify compact types and subtypes; the secondary
  // Artifact/Event class labels remain condensed capitals.
  // Earlier text-only treatments remain available on the bench.
  // "mosaic" is the wordmark bar (Trader/Asset type bar, Artifact/Event
  // subtype bar). Its lettering is picked by the same prop: "tourney"
  // (Tourney Italic, what plain "mosaic" means), "bungee" (Bungee Spice)
  // or "painted" (the webp images). See wordmarkFontStyles.js.
  classFont = "mosaic",
  // The ring around the wordmark letters: "ink", "cream" or "none".
  wordmarkOutline = "ink",
  // A Terminal Traders metal border laid over the Lotería frame: an id from
  // RCANA_METAL_FRAMES ("gold", "silver", "polished silver", "rainbow",
  // "polished grey", "holo", "holo gold") or null for the printed frame
  // alone. A printed frame's two divider lines near the foot are clipped
  // out, since here they would cut across the rules panel, and its shine is
  // masked by the frame's plate. The holo pair are drawn live by
  // HoloFoilFrame over RCANA_HOLO_WINDOWS.
  metalFrame = null,
  // The frame's shine, a port of TradingCard's card-level holo confined to
  // the metal frame's plate (printed metals only; the live foils light
  // themselves). frameShine: "off" | "soft" | "on". frameShineBlend:
  // "dodge" (diffraction ramp + iridescence + glitter grain, color-dodge),
  // "mirror" (one broad rainbow, overlay — chromes the light border),
  // "glitter" (embedded flakes, gold frame only — falls back to mirror).
  // frameShineStrength: 0..1 master dial. See the frame-shine CSS block.
  frameShine = "on",
  frameShineBlend = "mirror",
  frameShineStrength = 1,
  // Typeface for the name on the ribbon. "gilt" is blackletter struck in gold.
  // "nabla" is the chromatic 3D sans it replaced; it stays for foils and
  // alt-arts, where loud is the job. (Nabla is a COLRv1 font: engines
  // without COLRv1 paint its flat fallback colour.)
  nameFont = "gilt",
  // The rules line's furniture: one named ABIL80 for Traders, one type-colored
  // timing/usage badge for every other type, bold game terms, and a
  // hairline before the flavor. One switch, so the bench can compare the
  // plain line against the dressed one.
  keywordBadges = true,
  // The "19 / 80" in the bottom margin.
  collectorLine = true,
  // Confined to the medallion's inner disc. The bench can compare the
  // holographic stock with the original enamel; static prints use rest.
  medallionHolo = true,
  // Angel CRED badge; earlier designs remain available on the bench.
  credBadge = "angel-plain",
  // Tilt from the device's own orientation, phones and tablets. Off by
  // default: iOS only grants the sensor behind a user gesture, so the page
  // asks (see RcanaBench's "Tilt with device") and turns this on when
  // allowed. The angle the device is held at when it turns on is "flat".
  gyro = false,
}) {
  const cardRef = useRef(null);
  const interactingRef = useRef(false);
  const [tilt, setTilt] = useState(REST);
  const [reducedMotion, setReducedMotion] = useState(true);
  const motionEnabled = interactive && !reducedMotion;

  // A card scrolled out of view has no depth to show, so it should not be
  // paying for an animation frame. Without IntersectionObserver, assume on.
  const [onScreen, setOnScreen] = useState(false);
  useEffect(() => {
    if (!sway) return undefined;
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setOnScreen(true);
      return undefined;
    }
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), {
      threshold: 0.1,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [sway]);

  const swayEnabled = motionEnabled && sway && onScreen;

  // The card's transform is cheap — the compositor moves it. The FX light is
  // not: it repaints two full-card layers of stacked gradients, one of them
  // blurred and both masked by the flame, and measured on its own it is the
  // whole of this card's frame cost (49fps without it, 10 with). So the
  // light runs on a coarser clock than the tilt. Rounding the angles to a
  // degree gives about a third the repaints through a sway, which the eye
  // cannot pick out of gradients this soft, and holds the light perfectly
  // still whenever the card is.
  // (lrx/lry are computed below, once `coarse` is known.)

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // A touch device has a phone's GPU behind it. The FX light is the only
  // thing on the card that costs real fill — a full-card blur per frame —
  // so there it runs on a coarser clock (2° steps instead of 1°) and with a
  // smaller bloom radius. Neither is visible in gradients this soft.
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: none)");
    const sync = () => setCoarse(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const lightStep = coarse ? 2 : 1;
  const lrx = Math.round(tilt.rx / lightStep) * lightStep;
  const lry = Math.round(tilt.ry / lightStep) * lightStep;

  // Device orientation → tilt. beta is front-back, gamma left-right, both
  // in degrees; the pose at enable time is the rest pose, so a phone held
  // the way people hold phones reads as a flat card. ±22° of hand movement
  // runs the full tilt. Paused while a finger is on the card.
  useEffect(() => {
    if (!gyro || !motionEnabled || typeof window === "undefined") return undefined;
    let base = null;
    const SPAN = 22;
    const onOrient = (e) => {
      if (e.beta == null || e.gamma == null) return;
      if (!base) base = { b: e.beta, g: e.gamma };
      if (interactingRef.current) return;
      const dx = Math.max(-1, Math.min(1, (e.gamma - base.g) / SPAN));
      const dy = Math.max(-1, Math.min(1, (e.beta - base.b) / SPAN));
      setTilt({
        mx: 50 + dx * 50,
        my: 50 + dy * 50,
        hyp: Math.min(1, Math.hypot(dx, dy)),
        lift: 1,
        rx: dy * -MAX_TILT.rx,
        ry: dx * MAX_TILT.ry,
      });
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, [gyro, motionEnabled]);

  const applyAt = (clientX, clientY) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100));
    const dx = (x - 50) / 50;
    const dy = (y - 50) / 50;
    setTilt({
      mx: x,
      my: y,
      hyp: Math.min(1, Math.hypot(dx, dy)),
      lift: 1,
      // From MAX_TILT, because the clip bleed is sized against it: turn the
      // card further than this and the clip edges start to show.
      rx: dy * -MAX_TILT.rx,
      ry: dx * MAX_TILT.ry,
    });
  };

  const onMove = (e) => {
    if (!motionEnabled) return;
    interactingRef.current = true;
    applyAt(e.clientX, e.clientY);
  };
  const onTouch = (e) => {
    if (!motionEnabled) return;
    interactingRef.current = true;
    const t = e.touches[0];
    if (t) applyAt(t.clientX, t.clientY);
  };
  const onLeave = () => {
    interactingRef.current = false;
    setTilt(REST);
  };

  // Resting sway, so a card sitting on the table still shows its depth.
  useEffect(() => {
    if (!swayEnabled) {
      interactingRef.current = false;
      setTilt(REST);
      return undefined;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      if (!interactingRef.current) {
        const t = (now - start) / 1000;
        const x = 50 + Math.sin(t * 0.6) * 26;
        const y = 50 + Math.sin(t * 0.41 + Math.PI / 3) * 20;
        const dx = (x - 50) / 50;
        const dy = (y - 50) / 50;
        setTilt({
          mx: x,
          my: y,
          hyp: Math.min(1, Math.hypot(dx, dy)),
          rx: dy * -MAX_TILT.rx * 0.4,
          ry: dx * MAX_TILT.ry * 0.42,
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [swayEnabled]);

  if (!data) return null;

  const d = motionEnabled ? depth : 0;
  const P = RCANA_DEPTHS.perspective;
  // Depths scale with the card so a thumbnail does not tilt like a billboard.
  const zPlate = RCANA_DEPTHS.plate * d * scale;
  const artLayers = data.artLayers || [];
  // Split on the layer's own depth, not the tilt-scaled one: with motion off
  // every scaled z collapses to 0 and the test would say "behind" for all of
  // them — which is how the figure ended up under the frame, and the window
  // clip stopped applying, whenever reduced-motion was on.
  const behindArt = artLayers.filter((l) => l.z < RCANA_DEPTHS.plate);
  const frontArt = artLayers.filter((l) => l.z >= RCANA_DEPTHS.plate);
  const fxLayers = showFx ? data.fxLayers || [] : [];
  // Ink normally travels with the frame it is printed against. Lifted, it
  // clears the highest FX sheet by a hair so the text stays readable.
  // Lifting the ink clears everything in front of the card — the FX sheets
  // and any art layer that rides ahead of the frame. A figure overhanging
  // the banner is the effect working, but it is also the card's name under
  // a thumb, and which of those you want is a per-card call, not a rule.
  const zInk = inkOnTop
    ? Math.max(
        zPlate,
        ...fxLayers.map((f) => f.z * d * scale),
        ...artLayers.map((l) => l.z * d * scale)
      ) +
      6 * (d || 1) * scale
    // Keep ink just above the paper even in flat/reduced-motion mode.
    // Coplanar transparent marks can lose glyphs to the plate in Chromium.
    // counterScale keeps this subpixel separation invisible at rest.
    : zPlate + 0.1 * scale;
  const W = RCANA_LAYOUT.window;
  const FW = RCANA_LAYOUT.fxWindow;

  // The clear masks are per-FX-layer and never change with the tilt, so they
  // are built once, keyed on the spec rather than on the array's identity. Rebuilt every frame they would defeat React.memo on the
  // light, which is the point of the quantised clock above.
  const fxClearKey = fxLayers
    .map((f) => `${f.id}|${f.clip}|${(f.clear || []).map((c) => `${c.x},${c.y},${c.w},${c.h},${c.feather}`).join(";")}`)
    .join("~");
  const fxClear = useMemo(
    () =>
      fxLayers.map((fx) => {
        const clear = clearMask(fx.clear);
        if (!clear) return { cleared: null, litClear: null };
        const cleared = {
          WebkitMaskImage: clear,
          maskImage: clear,
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
          maskRepeat: "no-repeat",
        };
        // The light's bottom fade is a stylesheet rule on window-clipped
        // sheets; an inline mask would silently replace it, so the two are
        // composited here instead.
        const litClear =
          fx.clip === "window"
            ? {
                ...cleared,
                WebkitMaskImage: `${FADE_OUT}, ${clear}`,
                maskImage: `${FADE_OUT}, ${clear}`,
                maskComposite: "intersect",
                WebkitMaskComposite: "source-in",
              }
            : cleared;
        return { cleared, litClear };
      }),
    [fxClearKey]
  );
  const TAB = RCANA_LAYOUT.numberTab;
  // `inset` MUST come first: it is a shorthand for top/right/bottom/left, so
  // listed last it silently wipes the left/top set beside it and the box
  // lands at the card's top-left corner instead of the slot.
  const pctBox = (slot) => ({
    inset: "auto",
    left: `${slot.x}%`,
    top: `${slot.y}%`,
    width: `${slot.w}%`,
    height: `${slot.h}%`,
  });
  // The number tab is an opaque island inside the opening. Expressed relative
  // to the FX box so the sheet can be notched around it and read as passing
  // behind the tab rather than over the card's number.
  const notchX = ((TAB.x + TAB.w - FW.x) / FW.w) * 100 + 1.2;
  const notchY = ((TAB.y + TAB.h - FW.y) / FW.h) * 100 + 1.4;

  // A behind-frame layer is BOXED at the opening so its edge can never swing
  // past the card border, but its image is then positioned to span the whole
  // card inside that box. Without this the art is scaled into the opening and
  // nothing lands where it was drawn: on this frame the figure rode ~0.9%
  // high and the background lost 28% of its height to the cover crop.
  // Puts the image back on the card rect inside whatever box clips it, so a
  // percent offset means the same thing on every layer.
  const cardSpan = (b) => ({
    position: "absolute",
    left: `${-(b.x / b.w) * 100}%`,
    top: `${-(b.y / b.h) * 100}%`,
    width: `${10000 / b.w}%`,
    height: `${10000 / b.h}%`,
  });
  // The backdrop has to sit BEHIND the deepest art plane. Left at z 0 it is
  // in front of every negative-z layer and hides the art it was meant to
  // back. Its counter-scale is > 1 (a layer pushed back is scaled up to
  // measure the same), so at inset 0 its own edges already fall outside the
  // card and can never drift into view.
  // Behind the deepest art, but never past the floor: the backdrop is the
  // one layer with no art of its own to hide behind, so it is the first to
  // show its edge outside the card on tilt.
  const zBack = Math.max(
    DEPTH_FLOOR * d * scale,
    Math.min(0, ...artLayers.map((l) => l.z * d * scale)) - 24 * (d || 1) * scale
  );

  // One type unit = the card's rendered width. Every printed size below is a
  // fraction of it, so the face keeps its proportions at thumbnail or poster.
  const u = CARD_W * scale;

  const rarity = RCANA_RARITIES[data.rarity] || RCANA_RARITIES.Common;
  const metal = metalFrame ? RCANA_METAL_FRAMES.find((f) => f.id === metalFrame) || null : null;
  const metalPrinted = Boolean(metal && !HOLO_SRC.test(metal.src));
  // Glitter is a gold-frame treatment (as on TradingCard); elsewhere it
  // falls back to mirror so a caller can set it unconditionally.
  const shineBlend =
    frameShineBlend === "glitter" && !/frame_gold/.test(String(metal?.src || "")) ? "mirror" : frameShineBlend;
  // Stable per-card sparkle seed: the glitter flake field and the texture
  // tiling are offset by it, so two cards side by side never sparkle in the
  // same places, and a given card sparkles the same way on every render.
  const foilSeed = useMemo(() => {
    const key = `${data.number ?? ""}|${data.name ?? ""}`;
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
    return { x: (h % 1000) / 1000, y: ((h >>> 10) % 1000) / 1000 };
  }, [data.number, data.name]);
  const tone = CLASS_TONE[data.cardClass] || CLASS_TONE.Trader;
  const printed = data.printed || {};
  const L = data.layout || RCANA_LAYOUT;
  // The wordmark class fonts collapse to "mosaic" for the headers, which
  // take the lettering as a separate prop.
  const wordmarkFont = WORDMARK_CLASS_FONTS[classFont];
  const headerClassFont = wordmarkFont ? "mosaic" : classFont;
  const categoryFont = headerClassFont === "mosaic" ? "bebas" : classFont;

  const box = (slot) => ({
    left: `${slot.x}%`,
    top: `${slot.y}%`,
    width: `${slot.w}%`,
    height: `${slot.h}%`,
  });

  // A stable rules component keeps tilt renders from rerunning text layout.
  const rulesPanel = <RcanaRulesPanel data={data} slot={L.bodyPanel} u={u} keywordBadges={keywordBadges} />;

  // One art layer, used for both passes. `behind` decides whether it is
  // boxed at the opening (and its image stretched back out to the card) or
  // drawn at full card size so an authored overhang can show.
  const renderArt = (layer) => {
    const behind = layer.z < RCANA_DEPTHS.plate;
    // Bled outward past the opening by however far this layer and the frame
    // slide against each other at full tilt.
    const clip = behind ? behindClip(layer.z) : null;
    const z = layer.z * d * scale;
    return (
      <div
        key={layer.id}
        className="rc-layer rc-depth"
        data-layer={layer.id}
        style={{
          "--z": `${z}px`,
          "--k": counterScale(z, P),
          // Behind the frame: box at the opening, which is the clip. A layer
          // pushed back is counter-scaled UP and swings sideways on tilt, so
          // clipped to the card it eventually shows its own edge past the
          // border — clipped to the hole it cannot.
          ...(clip ? pctBox(clip) : null),
        }}
      >
        {layer.src ? (
          <img
            src={layer.src}
            alt=""
            draggable={false}
            decoding="async"
            style={{
              // Puts the image back on the card rect inside that box, so a
              // percent offset means the same thing on either kind of layer.
              ...(clip ? cardSpan(clip) : null),
              transform: `translate(${layer.offset.x}%, ${layer.offset.y}%) scale(${layer.scale})`,
              // Per-layer treatment from the art file — a soft far plane is
              // depth of field, and sells the parallax harder than the
              // parallax does. Written against --u so it scales with the card.
              ...(layer.filter ? { filter: layer.filter } : null),
            }}
          />
        ) : (
          <div className="rc-missing">{layer.id}</div>
        )}
      </div>
    );
  };

  return (
    <div
      className="rc-stage"
      style={{
        "--p": P,
        "--cw": u,
        "--u": `${u}px`,
        "--ratio": RCANA_ASPECT,
      }}
    >
      <div
        ref={cardRef}
        className="rc-card"
        data-metal={metal ? (HOLO_SRC.test(metal.src) ? "holo" : "printed") : undefined}
        data-shine={metalPrinted ? frameShine : undefined}
        data-shine-blend={metalPrinted ? shineBlend : undefined}
        data-flat={d === 0 || undefined}
        data-plate={data.plate}
        data-template={data.artifactTemplate ? "artifact" : undefined}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        onTouchStart={onTouch}
        onTouchMove={onTouch}
        onTouchEnd={onLeave}
        onTouchCancel={onLeave}
        style={{
          // `none` means a finger here tilts instead of scrolling; the
          // default lets the page scroll through the card.
          touchAction: captureTouch && motionEnabled ? "none" : undefined,
          "--rx": `${tilt.rx}deg`,
          "--ry": `${tilt.ry}deg`,
          "--mx": `${tilt.mx}%`,
          "--my": `${tilt.my}%`,
          "--hyp": tilt.hyp,
          // Frame-shine inputs, named as TradingCard names them so its
          // recipes port verbatim. --posx/--posy are the pointer in %,
          // --pointer-from-left/top the same normalised 0..1: the texture
          // layers drift by these at a different rate than the gradients
          // do, which is what sells them as separate depths.
          "--lift": tilt.lift ?? 0,
          "--posx": `${tilt.mx}%`,
          "--posy": `${tilt.my}%`,
          "--pointer-from-left": tilt.mx / 100,
          "--pointer-from-top": tilt.my / 100,
          "--seedx": foilSeed.x,
          "--seedy": foilSeed.y,
          "--shine-strength": frameShineStrength,
        }}
      >
        {/* ---------------- backdrop: the floor ----------------
            Flat against the card, no depth of its own: it exists so the art
            layers' real transparency has something to show instead of the
            page. Art that covers the window hides it entirely. */}
        {data.backdrop && (
          <div
            className="rc-layer rc-backdrop"
            style={{
              "--z": `${zBack}px`,
              "--k": counterScale(zBack, P),
              ...pctBox(behindClip(zBack / ((d || 1) * scale))),
              background: /^(url|linear|radial|conic|#|rgb|hsl)/.test(data.backdrop)
                ? data.backdrop
                : `url("${data.backdrop}") center/cover`,
            }}
          />
        )}

        {/* ---------------- art stack: far to near ----------------
            One plane per authored layer. A combined plate has none, because
            its figure is already inside the frame image. */}
        {behindArt.map(renderArt)}

        {/* ---------------- plate: frame + ink, one depth ---------------- */}
        <div
          className="rc-layer rc-plate"
          style={{ "--z": `${zPlate}px`, "--k": counterScale(zPlate, P), "--ink": tone.ink, "--accent": tone.accent }}
        >
          {data.frameImage && !hideFrame && (
            <img
              className="rc-frame"
              src={data.frameImage}
              alt=""
              draggable={false}
              decoding="async"
            />
          )}
          {/* The type seal rides on the plate at the frame's own depth — it
              is printed on the card, not floating in front of it. */}
          {data.badgeImage && !hideFrame && (
            <img className="rc-frame rc-badge" src={data.badgeImage} alt="" draggable={false} decoding="async" />
          )}

          {/* The editable paper covers the old painted logo, seal and stat
              boxes while keeping the illustration, ribbon and outer frame. */}
          {metal && !HOLO_SRC.test(metal.src) && !hideFrame && <div className="rc-footer-gutter" aria-hidden />}
          {!hideFrame && <div className="rc-footer-paper" aria-hidden />}
          {!hideFrame && !data.templateOnly && (
            <div className="rc-footer-panel" style={box(L.footerPanel)} aria-hidden="true" />
          )}

          {showSlots && (
            <div className="rc-slots" aria-hidden>
              {Object.entries(L).map(([key, slot]) => (
                <div key={key} className="rc-slotline" style={box(slot)}>
                  <i>{key}</i>
                </div>
              ))}
            </div>
          )}

          {!inkOnTop && rulesPanel}

          {/* Sheen rides the plate so it reads as light on the card's own
              surface, not on the art behind the window. */}
          {!data.templateOnly && <div className="rc-gloss" style={{ "--foil": rarity.foil }} aria-hidden />}

          {/* Metal border over the printed frame, then its shine, masked to
              the plate so only the stamped metal catches the light. */}
          {metal && !hideFrame && (HOLO_SRC.test(metal.src) ? (
            <HoloFoilFrame
              className="rc-metal rc-metal--holo"
              tilt={tilt}
              scale={scale}
              options={{ ...(metal.holo || {}), windows: RCANA_HOLO_WINDOWS, cornerRadius: RCANA_HOLO_CORNER }}
            />
          ) : (
            <>
              <img className="rc-metal" src={metal.src} alt="" draggable={false} decoding="async" />
              {metal.plate && (
                <>
                  <div className="rc-metal-shine" style={{ "--metal-plate": `url("${metal.plate}")` }} aria-hidden />
                  <div className="rc-metal-glare" style={{ "--metal-plate": `url("${metal.plate}")` }} aria-hidden />
                </>
              )}
            </>
          ))}
        </div>


        {/* ---------------- art in front of the frame ----------------
            After the plate in the DOM as well as above it in z, so that with
            motion off — where every layer is coplanar and paint order is all
            that is left — the overhang still lands on top of the border. */}
        {frontArt.map(renderArt)}

        {/* ---------------- ink ----------------
            Its own plane, so it can be lifted above the FX when a sheet
            would otherwise sit on the ability line. At rest it is exactly
            coplanar with the frame it is printed against. */}
        <div
          className="rc-layer rc-ink"
          style={{
            "--z": `${zInk}px`,
            "--k": counterScale(zInk, P),
            "--ink": tone.ink,
            "--accent": tone.accent,
          }}
        >
          {!printed.numberTab && (data.artifactTemplate ? (
            <ArtifactHeader data={data} hideFrame={hideFrame} classFont={headerClassFont} wordmarkFont={wordmarkFont} wordmarkOutline={wordmarkOutline} />
          ) : data.eventTemplate ? (
            <EventHeader data={data} hideFrame={hideFrame} classFont={headerClassFont} wordmarkFont={wordmarkFont} wordmarkOutline={wordmarkOutline} />
          ) : data.compactTypeHeader ? (
            <RcanaTypeHeader data={data} slot={L.numberTab} hideFrame={hideFrame} classFont={headerClassFont} wordmarkFont={wordmarkFont} wordmarkOutline={wordmarkOutline} />
          ) : (
            <>
              <div className="rc-slot rc-number" style={box(L.numberCell)}>
                <span>{data.number ?? ""}</span>
              </div>
              <div className="rc-slot rc-class" style={box(L.classCell)} data-sub={data.subClass ? "1" : undefined} data-font={categoryFont}>
                <span>
                  {categoryFont === "bebas" ? (data.cardClass || "").toUpperCase() : data.cardClass || ""}
                  {/* A coin after the class, only when a face sets tabCost —
                      no card does by default, since a Trader's play cost is
                      their income and the drop box carries it. */}
                  {data.tabCost > 0 && <i className="rc-cost" aria-label={`cost ${data.tabCost}`}>{data.tabCost}</i>}
                </span>
                {data.subClass && <small>{data.subClass.toUpperCase()}</small>}
              </div>
            </>
          ))}

          {!printed.name && (
            <div className="rc-slot rc-name" style={box(L.nameBanner)} data-font={nameFont}>
              {/* Sized off the ribbon rather than by eye: at this cap the
                  title fills the band height with a little headroom and its
                  width still clears the flourishes. AutoFit only steps in for
                  a name longer than this one. */}
              <AutoFit max={u * 0.08} min={u * 0.038}>
                {data.name}
              </AutoFit>
            </div>
          )}

          {inkOnTop && rulesPanel}

          {/* Sealed cards identify usage in the body and omit the value box. */}
          {data.plate !== "sealed" && (
            <RcanaValueBox value={data.halo} slot={L.standingBox} hideFrame={hideFrame} cardClass={data.cardClass} credBadge={credBadge}
              kind={data.plate === "valued" ? "prosperity" : "grace"}
              label={data.plate === "valued" ? "Prosperity" : "Credibility"} />
          )}
          {data.liquidityBox ? (
            <RcanaLiquidityBox
              cardClass={data.cardClass}
              value={data.cardClass === "Trader" ? data.cost ?? data.hydro : data.hydro}
              income={data.cardClass === "Trader" ? data.hydro : undefined}
              ribbon={data.cardClass === "Asset" || data.cardClass === "Event" || data.cardClass === "Artifact"}
              slot={data.liquidityBox} hideFrame={hideFrame} />
          ) : (
            <div className="rc-slot rc-stat" style={box(L.hydroValue)} data-len={String(data.hydro ?? "").length}>
              <span>{data.hydro ?? ""}</span>
            </div>
          )}

          {/* The collection number stays in the bottom-right gold margin. */}
          {collectorLine && data.collector && !printed.collector && !hideFrame && (
            <div className="rc-slot rc-collector" style={box(L.collector)} aria-label={`Card ${data.collector.number} of ${data.collector.of}`}>
              <span>{data.collector.number}<i>/</i>{data.collector.of}</span>
            </div>
          )}

          {!printed.rarity && (
            <div className="rc-slot rc-emblem" style={box(L.rarity)}>
              <RcanaMedallion holo={medallionHolo}
                dx={motionEnabled ? tilt.ry / MAX_TILT.ry : 0}
                dy={motionEnabled ? -tilt.rx / MAX_TILT.rx : 0} />
            </div>
          )}
        </div>

        {/* ---------------- fx: in front of everything ----------------
            Nearest plane on the card. Nothing covers its drift, so the
            sheet is feathered at its edges and its depth is capped. */}
        {fxLayers.map((fx, fxi) => {
          const z = fx.z * d * scale;
          // Masked on the image and the light, never on their container: a
          // mask makes a stacking context, and the sheet's screen blend has
          // to reach the card behind it, not stop at its own wrapper.
          const { cleared, litClear } = fxClear[fxi];
          return (
            <div
              key={fx.id}
              className="rc-layer rc-fx"
              data-fx={fx.id}
              data-clip={fx.clip}
              style={{
                "--z": `${z}px`,
                "--k": counterScale(z, P),
                // A window-clipped sheet is positioned to the art window
                // rather than the card, so the body panel and the stat strip
                // stay clear of it. preserve-3d forbids overflow clipping, so
                // the box IS the clip, exactly as the art layers do it.
                // "card" and "none" both paint at full card size; only the
                // window mode is boxed and notched.
                ...(fx.clip === "window"
                  ? {
                      ...pctBox(FW),
                      // Hard notch around the number tab, so the sheet reads
                      // as passing behind it.
                      clipPath: `polygon(${notchX}% 0, 100% 0, 100% 100%, 0 100%, 0 ${notchY}%, ${notchX}% ${notchY}%)`,
                    }
                  : null),
              }}
            >
              <img
                src={fx.src}
                alt=""
                draggable={false}
                decoding="async"
                style={{
                  mixBlendMode: fx.blend,
                  opacity: fx.opacity,
                  transform: `scale(${fx.scale})`,
                  ...cleared,
                }}
              />
              {/* Inside the sheet's own box, so it inherits the window clip
                  and the notch around the number tab. */}
              {fx.reflection && motionEnabled && (
                <FxLight
                  reflection={fx.reflection}
                  src={fx.src}
                  rx={lrx}
                  ry={lry}
                  unit={u}
                  clearStyle={litClear}
                  lite={coarse}
                />
              )}
              {showFacets && fx.reflection?.facets && (
                <svg className="rc-facets" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                  {fx.reflection.facets.map((f, i) => (
                    <g key={i}>
                      <ellipse cx={f.x} cy={f.y} rx={f.radius[0]} ry={f.radius[1]} />
                      <text x={f.x} y={f.y}>{i}</text>
                    </g>
                  ))}
                </svg>
              )}
            </div>
          );
        })}
      </div>

      <style>{RCANA_STYLES}{SUBTYPE_FURNITURE_STYLES}{LIQUIDITY_BOX_STYLES}{TYPE_HEADER_STYLES}{MEDALLION_STYLES}</style>
    </div>
  );
}


// Light anchored to an FX texture. Each facet faces its own direction, so a
// tilt sweeps past them one at a time and individual curls flare instead of
// the whole sheet brightening together. Both passes are masked by the
// texture's own luminance, so no light can float free of the flame.
//
// Ported from the Terminal Traders card, which shares the material and the
// asset. One difference: there the sheet is stretched to the card, here it
// is covered into the window, so the mask is sized to match the image
// rather than to the box.
const FxLight = React.memo(function FxLight({ reflection, src, rx, ry, unit, clearStyle, lite = false }) {
  // `tune` lets one card push its own material without editing the shared
  // one: FX_MATERIALS.fire is also the Terminal Traders flame, and this
  // card's light should not reach across and change that one.
  const material = { ...fxMaterial(reflection.material), ...(reflection.tune || null) };
  const strength = Math.max(0, Math.min(1.5, reflection.strength ?? 1));
  if (!strength) return null;

  const dx = ry / 9;
  const dy = -rx / 7;
  let peak = 0;

  // A facet that is not facing the light contributes a gradient nobody can
  // see, and every one of those still costs a rasterisation — twice over,
  // because the bloom pass is blurred as well. With the angles spread along
  // the arc only a few are lit at any tilt, so the dark ones are dropped
  // here rather than drawn and then not seen.
  //
  // The test is the facet's RESPONSE, not its alpha: alpha carries a
  // constant ambient term, so every facet clears any alpha floor worth
  // setting and nothing would ever be culled.
  const CORE_FLOOR = 0.1;
  const BLOOM_FLOOR = 0.04;

  const surfaces = reflection.facets.map(({ x, y, radius, axis, angle, roughness, hue }) => {
    const facing = dx * axis[0] + dy * axis[1];
    const distance = (facing - angle) / roughness;
    const flash = Math.exp(-0.5 * distance * distance);
    const sheen = Math.exp(-0.5 * (distance / 3) ** 2);
    peak = Math.max(peak, flash);
    const bound = (v) =>
      material.hueRange ? Math.max(material.hueRange[0], Math.min(material.hueRange[1], v)) : v;
    const color = bound(hue + facing * material.hueTravel);
    const lightness =
      material.coreLightness[0] + flash * (material.coreLightness[1] - material.coreLightness[0]);
    const alpha = Math.min(1, strength * material.emissionGain * (0.08 + sheen * 0.2 + flash * 0.72));
    const rim = Math.min(1, strength * material.emissionGain * (0.06 + sheen * 0.15 + flash * 0.45));
    const glow = Math.min(1, strength * material.bloomGain * flash);
    const region = `ellipse ${radius[0]}% ${radius[1]}% at ${x}% ${y}%`;
    return {
      response: flash + sheen * 0.28,
      glow,
      x,
      y,
      radius,
      color,
      core: `radial-gradient(${region},
        hsl(${color} 100% ${lightness}% / ${alpha}) 0%,
        hsl(${bound(color + material.rimHueOffset)} 100% ${material.rimLightness}% / ${rim}) 38%,
        hsl(${bound(color + material.edgeHueOffset)} 100% ${material.edgeLightness}% / ${rim * 0.35}) 68%,
        transparent 100%)`,
    };
  });

  // Keep at least one of each so the layers never go empty, which would make
  // the light pop out and back in at the moment the card crosses a threshold.
  const pick = (list, key, floor) => {
    const kept = list.filter((f) => f[key] >= floor);
    return kept.length ? kept : [list.reduce((a, c) => (c[key] > a[key] ? c : a))];
  };
  const lit = pick(surfaces, "response", CORE_FLOOR);

  // The bloom is blurred by tens of pixels before anyone sees it, so its
  // fine structure is thrown away — eight gradients under that blur look
  // exactly like one. It is collapsed to a single wash at the glow-weighted
  // centre of the lit facets, which is both what the eye reads and the
  // difference between this layer costing 40% of the frame and costing
  // almost nothing. The core pass keeps its per-facet detail, because that
  // one is sharp and the detail is the whole point of it.
  const hot = surfaces.filter((f) => f.glow >= BLOOM_FLOOR);
  const mass = hot.reduce((a, f) => a + f.glow, 0);
  const bloom = (() => {
    const lead = surfaces.reduce((a, c) => (c.glow > a.glow ? c : a));
    if (!mass) return null;
    const cx = hot.reduce((a, f) => a + f.x * f.glow, 0) / mass;
    const cy = hot.reduce((a, f) => a + f.y * f.glow, 0) / mass;
    // Wide enough to cover the facets it stands in for, not just the hottest.
    const spread = 1 + 0.5 * (hot.length - 1);
    const rx = Math.min(60, lead.radius[0] * spread);
    const ry = Math.min(40, lead.radius[1] * spread);
    const g = Math.min(1, lead.glow);
    return `radial-gradient(ellipse ${rx}% ${ry}% at ${cx}% ${cy}%,
      rgb(${material.bloomColor} / ${g}) 0%,
      hsl(${lead.color} 100% ${material.bloomLightness}% / ${g * 0.7}) 35%, transparent 85%)`;
  })();

  // Bloom radius is quoted against the reference card width, so it has to
  // scale or a thumbnail gets a blur the size of its own artwork.
  const [r0, r1] = material.bloomRadius;
  // 30% smaller on touch devices: the blur's cost is its radius squared.
  const blur = (r0 + peak * (r1 - r0)) * (unit / 744) * (lite ? 0.7 : 1);

  return (
    <div
      className="rc-fx-light"
      aria-hidden
      style={{
        // Same hole as the sheet, so the glow does not relight the tab the
        // sheet was just thinned off. A window-clipped sheet already masks
        // this element from the stylesheet, so the caller folds that fade
        // into clearStyle rather than letting the inline rule drop it.
        ...clearStyle,
        "--fx-mask": `url("${src}")`,
        "--fx-emission": lit.map((f) => f.core).join(","),
        "--fx-bloom": bloom || "none",
        "--fx-blur": `${blur}px`,
        "--fx-bright": material.bloomBrightness,
      }}
    >
      {bloom && (
        <div className="rc-fx-bloom">
          <div className="rc-fx-mat" />
        </div>
      )}
      <div className="rc-fx-mat" />
    </div>
  );
});

// The same coin as the cost badge, scaled to the rules text.
function CoinGlyph() {
  return <img className="rc-coin" src="/GoldCoin.png" alt="" aria-hidden="true" draggable={false} />;
}

// Game nouns the rules text may name. Bold where they appear, so the eye
// can pick the mechanic out of the sentence at table distance; a Hydro or
// Liquidity count also gets the coin in front of it, so "1 Hydro" and the
// footer badge read as the same currency. Explicit signs on printed payouts
// stay with the count after the coin; costs and sale prices stay unsigned.
const RULE_TERMS =
  /([+-]?\d+\s+)?(Hydro|Liquidity|Prosperity|Grace|CRED|Assets?|Calamit(?:y|ies)|Events?|Traders?|Artifacts?|Remedy|Remedies|Hail Mary|Good Deeds?)\b/g;

// A rules line that opens with its own keyword ("Until cleared, the target
// banks…") would print it twice once the badge carries it, so the badge
// takes the words and the sentence restarts on a capital.
function stripKeyword(text, keyword) {
  if (!text || !keyword) return text;
  const re = new RegExp(`^${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[,:—–-]\\s*`, "i");
  if (!re.test(text)) return text;
  const rest = text.replace(re, "");
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

function RulesText({ text }) {
  const out = [];
  let last = 0;
  let m;
  RULE_TERMS.lastIndex = 0;
  while ((m = RULE_TERMS.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const count = m[1] || "";
    const term = m[2];
    const hydro = /^(Hydro|Liquidity)$/.test(term) && count;
    out.push(
      <b key={m.index} className={hydro ? "rc-term rc-term--hydro" : "rc-term"}>
        {hydro ? <CoinGlyph /> : null}
        {count}{term}
      </b>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return <>{out}</>;
}

// Rules are printed together on the parchment. Tilt changes the card transform,
// not this component's layout; content, scale and furniture changes still refit it.
const RcanaRulesPanel = React.memo(function RcanaRulesPanel({ data, slot, u, keywordBadges }) {
  const abilityLabel = data.cardClass === "Trader";
  return (
    <div className="rc-slot rc-body" data-named-ability={data.abilityName ? true : undefined} style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%` }}>
      {/* All classes share a text scale and one primary badge. Named Trader
          powers add a title; usage cards lead straight into their effect. */}
      <AutoFit max={u * 0.038} min={u * 0.029} block>
        {keywordBadges && (abilityLabel || data.keyword) && (
          <div className="rc-rules-labels" style={{ "--kw": data.keywordColor }}>
            {abilityLabel && (
              <span className="rc-ability-heading">
                <b className="rc-kw rc-kw--ability" aria-label="ABIL80 — Ability">ABIL80</b>
                {data.abilityName && <span className="rc-ability-name rc-ability-name--inline">{data.abilityName}</span>}
              </span>
            )}
            {!abilityLabel && data.keyword && <b className="rc-kw rc-kw--usage">
              {data.keyword}
            </b>}
          </div>
        )}
        {data.abilityName && !(keywordBadges && abilityLabel) && <p className="rc-ability-name">{data.abilityName}</p>}
        {data.ability ? (
          <p className="rc-ability">
            {keywordBadges ? <RulesText text={stripKeyword(data.ability, data.keyword)} /> : data.ability}
          </p>
        ) : null}
        {data.flavor ? (
          <p className="rc-flavor">{data.flavorQuoted ? `“${data.flavor}”` : data.flavor}</p>
        ) : null}
      </AutoFit>
    </div>
  );
});

// Steps the font size down until the content stops overflowing its slot.
// Cheaper and more predictable than measuring text metrics, and it reruns on
// content change, which is what a programmatic ability line needs.
function AutoFit({ children, max, min, block = false }) {
  const ref = useRef(null);
  const [size, setSize] = useState(max);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let active = true;
    // Measure against the SLOT, not against this element. A line-height
    // below 1 makes the glyphs overflow their own line box at every size, so
    // comparing the element with itself is permanently true and the text
    // collapses to the minimum however much room the slot has.
    const slot = el.parentElement;
    // Rules keep their natural height: a centered, oversized block can clip
    // at BOTH edges, so measure its full height rather than the slot's scroll.
    // Ribbon titles retain their tight line box and existing slot measurement.
    const fits = () => block
      ? el.scrollHeight <= slot.clientHeight && el.scrollWidth <= slot.clientWidth
      : slot.scrollHeight <= slot.clientHeight + 1 && slot.scrollWidth <= slot.clientWidth + 1;
    const fit = () => {
      if (!active) return;
      let s = max;
      el.style.fontSize = `${s}px`;
      let guard = 0;
      // Refit after web fonts settle as well as after content changes.
      while (guard++ < 60 && s > min && !fits()) {
        s = Math.max(min, s * 0.96);
        el.style.fontSize = `${s}px`;
      }
      setSize(s);
    };
    fit();
    document.fonts?.ready.then(fit);
    document.fonts?.addEventListener("loadingdone", fit);
    return () => {
      active = false;
      document.fonts?.removeEventListener("loadingdone", fit);
    };
  }, [children, max, min, block]);

  return (
    <div
      ref={ref}
      className={block ? "rc-fit rc-fit--block" : "rc-fit"}
      style={{ fontSize: `${size}px` }}
    >
      {children}
    </div>
  );
}

const RCANA_STYLES = `
.rc-stage {
  width: calc(var(--cw) * 1px);
  perspective: calc(var(--p) * 1px);
  perspective-origin: 50% 50%;
}
.rc-card {
  position: relative;
  width: 100%;
  aspect-ratio: var(--ratio);
  transform-style: preserve-3d;
  transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
  transition: transform 220ms cubic-bezier(.2,.7,.3,1);
  will-change: transform;
}
.rc-card:active { transition: none; }
/* Print and reduced-motion cards need ordinary paint order. Retaining a
   3D context when every layer collapses to zero lets Chromium occlude
   transparent ink against the paper during screenshot/compositor updates. */
.rc-card[data-flat] { transform-style: flat; transform: none; }
.rc-card[data-flat] .rc-layer { transform: none; }

.rc-layer {
  position: absolute;
  inset: 0;
  /* Flat on purpose. A layer with preserve-3d has its overflow clipping
     ignored, which is what let the background's own edge escape the card on
     tilt. None of these layers has 3D-transformed children, so only the card
     itself needs a 3D context. */
  transform-style: flat;
  transform: translateZ(var(--z, 0)) scale(var(--k, 1));
  transition: transform 220ms cubic-bezier(.2,.7,.3,1);
}
/* Background and subject are inset by the frame's border width, so the drift
   their depth produces stays hidden underneath the printed border instead of
   escaping the card silhouette. preserve-3d forbids overflow clipping, so
   this inset IS the clip. */
.rc-depth { inset: 2.4%; overflow: hidden; border-radius: 3.2%; }
.rc-depth img {
  width: 100%; height: 100%;
  object-fit: cover;
  display: block;
  transform-origin: 50% 45%;
}
.rc-plate img.rc-frame {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: fill;
  display: block;
  pointer-events: none;
}
.rc-missing {
  width: 100%; height: 100%;
  display: grid; place-items: center;
  font: 600 13px/1 ui-sans-serif, system-ui;
  letter-spacing: .18em; text-transform: uppercase;
  color: #4a5560;
  background:
    repeating-conic-gradient(#2a3038 0% 25%, #222830 0% 50%) 50% / 28px 28px;
}
.rc-missing--subject { background: none; color: #7c8894; }

.rc-backdrop { border-radius: 3.2%; }

/* ---------------- fx ----------------
   The sheet is never clipped by the card, because a plane in front of the
   frame has nothing to hide behind. Instead its own edges are feathered, so
   drifting past the border reveals fire thinning out rather than a hard
   rectangular boundary. The blend goes on the image, not on this layer, so
   the element carrying the 3D transform is not also a blend container. */
.rc-fx { pointer-events: none; }
/* A window-clipped sheet sits inside the frame's opening, where the printed
   border already hides its edges, so it needs no feather of its own. */
.rc-fx[data-clip="window"] { border-radius: 2.4%; }
/* Window-clipped: only the bottom edge needs softening, the other three sit
   under the printed border. Without it the sheet ends in a straight line
   along the banner's top edge. A sheet drawn for the card ("none") gets no
   mask at all — its own art already stops short of every edge. */
.rc-fx[data-clip="window"] img {
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 72%, transparent 100%);
  mask-image: linear-gradient(to bottom, #000 0%, #000 72%, transparent 100%);
  -webkit-mask-composite: source-over;
  mask-composite: add;
}
.rc-fx img { width: 100%; height: 100%; object-fit: cover; display: block; }
/* A full-bleed sheet is feathered at all four edges, or drifting past the
   frame reveals its rectangle. */
.rc-fx[data-clip="card"] img {
  -webkit-mask-image:
    linear-gradient(90deg, transparent, #000 2.5%, #000 97.5%, transparent),
    linear-gradient(0deg, transparent, #000 2%, #000 98%, transparent);
  -webkit-mask-composite: source-in;
  mask-image:
    linear-gradient(90deg, transparent, #000 2.5%, #000 97.5%, transparent),
    linear-gradient(0deg, transparent, #000 2%, #000 98%, transparent);
  mask-composite: intersect;
}

/* Light added to the flame, never replacing it: both passes are masked by
   the texture's own luminance, so a transparent part of the sheet cannot
   produce a free-floating glow. The mask is sized to COVER, matching the
   image above it — sized to the box instead, mask and flame would drift
   apart and the light would land off the curls. */
.rc-fx-light {
  position: absolute;
  inset: 0;
  pointer-events: none;
  mix-blend-mode: plus-lighter;
  /* The card turns in 3D, so without a layer of its own this masked,
     blurred subtree is repainted from scratch on every frame of the tilt.
     Promoted, a frame that does not change its content is re-composited
     instead: measured on one swaying card, 14fps against 24. */
  will-change: transform;
  transform: translateZ(0);
}
.rc-fx[data-clip="window"] .rc-fx-light {
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 72%, transparent 100%);
  mask-image: linear-gradient(to bottom, #000 0%, #000 72%, transparent 100%);
}
.rc-fx-mat,
.rc-fx-bloom { position: absolute; inset: 0; }
.rc-fx-mat {
  -webkit-mask-image: var(--fx-mask);
  mask-image: var(--fx-mask);
  mask-mode: luminance;
  -webkit-mask-size: cover;
  mask-size: cover;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  background: var(--fx-emission);
}
/* Blurred AFTER masking, so light spreads out of the flame rather than the
   blur smearing the mask itself. */
.rc-fx-bloom { filter: blur(var(--fx-blur)) brightness(var(--fx-bright)); will-change: filter; }
.rc-fx-bloom .rc-fx-mat { background: var(--fx-bloom); }

@media (prefers-reduced-motion: reduce) {
  .rc-fx-light { display: none; }
}

/* ---------------- ink ---------------- */
.rc-ink { position: absolute; inset: 0; pointer-events: none; }
.rc-slot {
  position: absolute;
  display: grid;
  place-items: center;
  color: var(--ink);
  text-align: center;
  overflow: hidden;
}
.rc-fit { width: 100%; max-height: 100%; line-height: 1.04; }
/* Nabla's line box is far taller than its glyphs, so at a title size the box
   overflows the ribbon and the tops clip while the letters still look small.
   Hugging the glyphs is what buys the size. A one-line ribbon also means a
   long name must shrink, never wrap. */
.rc-name .rc-fit { line-height: 0.78; white-space: nowrap; }
/* The slot is the ribbon's dark field exactly. Clipping there would shave
   the caps, and Nabla's bevel wants a hair more room than its line box, so
   the title is allowed to breathe past the box — AutoFit still holds it to
   the field's width. */
.rc-slot.rc-name { overflow: visible; }
.rc-fit--block { max-height: none; text-align: center; line-height: 1.22; }

/* Bebas Neue ships one weight. Asking for 700 made the browser smear the
   outline into a synthetic bold, which is what was clubbing the corners of
   the 7 and TRADER against the crisp bezel. */
.rc-number, .rc-class {
  font-family: "Bebas Neue", "Anton", ui-sans-serif, system-ui;
  font-weight: 400;
  letter-spacing: .02em;
  color: #120d04;
}
.rc-number { font-size: calc(var(--u) * .070); }
.rc-class  { font-size: calc(var(--u) * .050); letter-spacing: .04em; }
.rc-class[data-font="bebas"] { letter-spacing: .1em; }
/* Blackletter trials for the class label (bench control). Title case, no
   tracking, sized up a little since blackletter x-heights run small. */
.rc-class[data-font="blackletter"] span { font-family: "Blackletter", "UnifrakturCook", serif; font-weight: 400; letter-spacing: .01em; font-size: calc(var(--u) * .058); }
.rc-class[data-font="gilt"] span { font-family: "Blackletter", "UnifrakturCook", serif; font-weight: 400; letter-spacing: .01em; font-size: calc(var(--u) * .058); }
/* "gilt": the ExtraBold struck in gold — hairline light on top, a dark bevel
   under, a soft drop — so the class reads as a stamped gilt letter, the same
   metal as the Nabla name on the banner. The shadow font was tried and
   rejected here: at tab size its hairline interior fills in. */
.rc-class[data-font="gilt"] span {
  color: #f4cd61;
  text-shadow:
    0 calc(var(--u) * -.0012) 0 #fff6d0,
    0 calc(var(--u) * .002) 0 #6a4a08,
    0 calc(var(--u) * .004) calc(var(--u) * .005) rgba(0, 0, 0, .45);
}
.rc-class[data-font="grenze"] span { font-family: "Grenze Gotisch", serif; font-weight: 700; letter-spacing: 0; font-size: calc(var(--u) * .058); }
.rc-class[data-font="unifraktur"] span { font-family: "UnifrakturCook", serif; font-weight: 700; letter-spacing: 0; font-size: calc(var(--u) * .056); }
.rc-class[data-font="pirata"] span { font-family: "Pirata One", serif; font-weight: 400; letter-spacing: .01em; font-size: calc(var(--u) * .058); }
.rc-class[data-font="maguntia"] span { font-family: "UnifrakturMaguntia", serif; font-weight: 400; letter-spacing: 0; font-size: calc(var(--u) * .058); }
/* The cost coin: a small dark disc with the number knocked out, after the
   class word, so TRADER 2 reads as one unit. */
.rc-class .rc-cost {
  display: inline-grid; place-items: center; vertical-align: .12em;
  margin-left: .32em; width: 1.05em; height: 1.05em; border-radius: 50%;
  background: #120d04; color: #f2d26a; font-style: normal; font-size: .78em; letter-spacing: 0;
}
/* A sub-class (ARTIFACT · REMEDY) stacks a smaller line under the class and
   tightens the class so both fit the tab cell. */
.rc-class[data-sub] { display: grid; place-items: center; align-content: center; line-height: .92; font-size: calc(var(--u) * .042); }
.rc-class[data-sub] small { display: block; font-size: calc(var(--u) * .024); letter-spacing: .14em; opacity: .78; }

/* Nabla is a COLRv1 chrome font: it carries its own bevel and palette, so
   the extruded gold comes from the typeface rather than from a text-shadow
   stack. The CSS color only reaches browsers that fall back to the flat outline,
   which is why a readable fallback colour is still set here.
   EDPT is the extrude depth axis; raise it for a heavier bevel. */
@font-face {
  font-family: "Nabla";
  src: url("/fonts/Nabla-Regular.ttf") format("truetype");
  font-display: swap;
}
.rc-name { padding: 0 2%; color: #f4cf62; }
.rc-name[data-font="nabla"] {
  font-family: "Nabla", "Blackletter", "UnifrakturCook", serif;
  font-variation-settings: "EDPT" var(--name-depth, 120), "EHLT" var(--name-hilite, 12);
  /* Nabla's bevel extrudes downward, so the glyphs sit optically low in the
     ribbon; this lifts them back onto its centre line. */
  transform: translateY(-2%);
}
/* The name in the tab's metal: gold ExtraBold with a hairline light on top,
   a bevel under and a soft drop, scaled up from the tab's stack because the
   letter is twice the size. One foil across the card, not two golds. */
.rc-name[data-font="gilt"] {
  font-family: "Blackletter", "UnifrakturCook", serif;
  font-weight: 400;
  letter-spacing: .01em;
  color: #f4cd61;
  text-shadow:
    0 calc(var(--u) * -.0015) 0 #fff6d0,
    0 calc(var(--u) * .0035) 0 #6a4a08,
    0 calc(var(--u) * .007) calc(var(--u) * .007) rgba(0, 0, 0, .55);
}
.rc-footer-paper {
  position: absolute;
  left: 4.5%; top: 78.2%; width: 91%; height: 18.7%;
  background: linear-gradient(to bottom, transparent, #ffdf87 24%, #ffdf87);
  border-radius: 0 0 calc(var(--u) * .025) calc(var(--u) * .025);
}
.rc-body { padding: 0; align-items: center; pointer-events: none; }
/* Every body uses regular-weight rules with selective bold terms.
   Named Trader powers add a bold title; flavor stays smaller and italic. */
.rc-ability {
  margin: 0;
  text-align: center;
  text-wrap: balance;
  white-space: pre-line;
  font-family: "IBM Plex Serif", Georgia, serif;
  font-weight: 400;
  line-height: 1.18;
  color: #241a0a;
}
.rc-flavor {
  box-sizing: border-box;
  width: fit-content;
  max-width: 96%;
  margin: .12em auto 0;
  padding: 0 .2em;
  text-wrap: balance;
  font-family: "IBM Plex Serif", Georgia, serif;
  font-style: italic;
  font-weight: 500;
  color: #5a4524;
  font-size: .8em;
  line-height: 1.22;
  text-align: center;
}
.rc-flavor::before {
  content: "";
  display: block;
  width: 4.8em;
  height: .6em;
  max-width: 90%;
  margin: 0 auto .14em;
  /* Crop only the asset's transparent vertical padding; keep the flourish
     at its original proportions in a single centered bar above the quote. */
  background: url("/HorizontalBar3.png") center / 100% auto no-repeat;
}
.rc-ability-name {
  min-width: 0;
  margin: 0 0 .18em;
  font-family: "IBM Plex Serif", Georgia, serif;
  font-size: 1.08em;
  font-weight: 700;
  line-height: 1.12;
  text-wrap: balance;
  overflow-wrap: anywhere;
  color: #241a0a;
}
.rc-ability-heading { display: inline-flex; max-width: 100%; align-items: center; justify-content: center; gap: .4em; }
.rc-ability-name--inline { margin: 0; }

/* ---------------- rules furniture ----------------
   Everything here is in em, so AutoFit scales the badges with the line.
   ABIL80 uses blue enamel. Usage/timing badges use solid type colors with
   cream lettering and gold trim; Calamities use a red warning field. */
.rc-rules-labels { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: .25em; margin-bottom: .2em; }
.rc-kw {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: .3em;
  padding: .15em .65em .12em .4em;
  border-radius: .15em .15em .65em .15em;
  background: var(--kw, #155b60);
  color: #fff0bc;
  font-family: "Bebas Neue", Impact, sans-serif;
  font-weight: 400;
  font-style: normal;
  font-size: .64em;
  letter-spacing: .07em;
  line-height: 1.05;
  text-transform: uppercase;
  white-space: nowrap;
  box-shadow: inset 0 0 0 .07em #f4cd61, 0 0 0 .06em #1d190f;
}
.rc-kw svg { flex: 0 0 1.05em; width: 1.05em; height: 1.05em; }
.rc-kw--ability {
  --kw: #07536b;
  padding-left: .65em;
}
.rc-kw--usage {
  padding-inline: .65em;
}
.rc-term { font-weight: 600; color: #140f05; white-space: nowrap; }
.rc-coin {
  display: inline-block;
  width: .88em;
  height: .88em;
  margin: 0 .12em 0 .02em;
  vertical-align: -.1em;
  object-fit: contain;
}
/* Collection number in the bottom-right gold margin. Keep it smaller than
   the tier and lighten the slash so both numbers read as a single detail. */
.rc-collector {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  font-family: "Bebas Neue", Impact, sans-serif;
  font-weight: 400;
  font-size: calc(var(--u) * .019);
  letter-spacing: .05em;
  line-height: 1;
  color: #1d190f;
  opacity: .82;
  font-variant-numeric: tabular-nums;
}
.rc-collector i { font-style: normal; opacity: .55; margin: 0 .14em; }
.rc-footer-panel {
  position: absolute;
  box-sizing: border-box;
  /* The card frame supplies the sides and bottom; only the divider is new. */
  border-top: calc(var(--u) * .004) solid #211c10;
  border-radius: 0 0 calc(var(--u) * .025) calc(var(--u) * .025);
  background: linear-gradient(180deg, #fff0bd, #edc66b);
  pointer-events: none;
}
.rc-emblem { display: flex; align-items: center; justify-content: center; }
.rc-stat {
  font-family: "Bebas Neue", "Anton", ui-sans-serif, system-ui;
  font-weight: 400;
  font-size: calc(var(--u) * .064);
  color: #140f05;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
/* Bebas is condensed enough that three digits (100 / 125 / 250) fit the
   numeral area at the same size as a single digit, so every value prints at
   one size and the two boxes match. Four digits would step down; the set
   has none. */
/* The value box on the ingot plate is sage green. Its numeral stays the same
   dark ink as the drop box's, so the two boxes read as a pair; --value-ink is
   the one switch if 100 ever goes muddy at thumbnail size (try #f4e3b0). */
.rc-card[data-plate="valued"] .rc-stat--left { color: var(--value-ink, #140f05); }
.rc-stat[data-len="3"] { letter-spacing: -.02em; }
.rc-stat[data-len="4"] { font-size: calc(var(--u) * .05); letter-spacing: -.04em; }

/* ---------------- sheen ---------------- */
/* The laminate's specular. A sheen, not a spotlight: a broad low-contrast
   wash with a long tail, rather than a bright disc with a hard centre, and
   it tracks the pointer at 0.6, not 1:1 — the reflection of an overhead
   light does slide across a tilting card, but it leads the hand by less
   than the hand moves. Tracking it exactly is what read as a flashlight. */
.rc-gloss {
  position: absolute; inset: 0;
  border-radius: 3.6%;
  pointer-events: none;
  mix-blend-mode: screen;
  opacity: calc(.12 + var(--foil, 0) * .28);
  background:
    radial-gradient(farthest-corner circle
      at calc(50% + (var(--mx, 50%) - 50%) * .6) calc(50% + (var(--my, 50%) - 50%) * .6),
      rgba(255,255,255,.22) 0%,
      rgba(255,230,160,.10) 30%,
      rgba(255,255,255,0) 75%);
}

/* ---------------- metal border ---------------- */
/* The printed metal frames' windows are near-square at the corners (gold
   ~1.4% of height, the rest ~0.6%), and the rainbow/silver bands run in
   to 4.2–4.3% of width — right on the footer panel's edge. Against the
   panel's .025u rounded corner that left a wedge of the Lotería frame's
   dark inner corner showing between the two curves. Under a printed metal
   the panel squares off to match its window. The live foils get their
   own concentric corners (RCANA_HOLO_WINDOWS) and keep the round panel. */
.rc-card[data-metal="printed"] .rc-footer-paper,
.rc-card[data-metal="printed"] .rc-footer-panel {
  border-radius: 0 0 calc(var(--u) * .006) calc(var(--u) * .006);
}
/* The bands' inner edges (gold 3.56% of width / 1.78% of height, rainbow
   4.23 / 2.55, silver 4.30 / 2.78) all stop short of where the paper and
   panel start (4.5% / 4.3%), and the Lotería frame's black inner line
   showed in between as a dark strip. Under a printed metal the paper and
   panel grow out past every band's inner edge (the panel's box is an
   inline slot, hence the !important) and the opaque band covers the
   overlap. The paper's top is a gradient from transparent, there to blend
   the frame's gold into the cream — so what sits UNDER the widened paper
   matters: in the gutter that would be the black line. .rc-footer-gutter,
   rendered before the paper, lays the frame's own side gold (#fbd263,
   measured at x 4.6%) over the line down each side, from where the gold
   footer begins beside the band (76.5%) to the panel's foot. The paper
   then blends over gold in the gutter exactly as it does next to it. An
   opaque cream strip BESIDE the paper was tried first and read as a second
   card layer: its own tone in the gradient zone, a seam, a notch at the
   divider. */
.rc-card[data-metal="printed"] .rc-footer-gutter {
  position: absolute;
  left: 3.2%; width: 93.6%; top: 76.5%; height: 22%;
  pointer-events: none;
  /* 1.3% of the card per side, in this box's 93.6%. */
  background:
    linear-gradient(#fbd263, #fbd263) left / 1.39% 100% no-repeat,
    linear-gradient(#fbd263, #fbd263) right / 1.39% 100% no-repeat;
}
.rc-card[data-metal="printed"] .rc-footer-paper {
  left: 3.2%; width: 93.6%;
}
.rc-card[data-metal="printed"] .rc-footer-panel {
  border-radius: 0 0 calc(var(--u) * .006) calc(var(--u) * .006);
}
.rc-card[data-metal="printed"] .rc-footer-panel {
  left: 3.2% !important; width: 93.6% !important; height: 8.9% !important;
}
/* Same at the top: the art and backdrop are clipped to a 3.2% corner that
   ends past the metal window's edge, so a notch of the card's dark corner
   showed between the art's arc and the band's square inner corner. */
.rc-card[data-metal="printed"] .rc-depth,
.rc-card[data-metal="printed"] .rc-backdrop {
  border-radius: calc(var(--u) * .008);
}
/* The Terminal Traders frame art is 1488x2082 against this card's ratio —
   object-fit: fill, the same way TradingCard stretches it. The evenodd
   polygon punches a hole where the art draws its two divider lines
   (~85% and ~89% of height, inside the band); on this layout they would
   run straight through the rules panel. */
.rc-metal {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: fill;
  display: block;
  pointer-events: none;
}
/* The hole must start INSIDE every band's inner edge (silver 4.30% of
   width is the widest; the lines themselves begin at 4.9%). At 4% it cut
   a sliver off the rainbow and silver bands over the rules zone, and the
   paper showed through as a pale strip — the "extra layer" on the edge. */
img.rc-metal {
  clip-path: polygon(evenodd,
    0 0, 100% 0, 100% 100%, 0 100%, 0 0,
    4.6% 83%, 95.4% 83%, 95.4% 91%, 4.6% 91%, 4.6% 83%);
}
/* The live foil is a canvas sized to the card box; its windows are its
   own cut-out, so no clip. */
.rc-metal--holo { border-radius: 3.2%; }
/* ---------------- frame shine ----------------
   A port of TradingCard's card-level holo (.tc-card-shine / .tc-card-glare,
   see the CARD-LEVEL HOLO SYSTEM block there), confined to the metal
   frame: both layers are masked by the frame's foil plate, so only the
   stamped metal catches light and the Lotería card body stays matte.
   Same three blends, same two levels, same textures and tunables, driven
   by the same pointer vars; the one deliberate difference is --shine-rest:
   TradingCard keeps its rest-state wash in full, which read as milk over
   the rainbow frame here, so at rest the shine runs at a fraction of its
   constant term and fades up with --lift as the pointer arrives. */
.rc-card[data-metal="printed"] {
  --foil-glitter: url("/TCG/foils/rl80-glitter.webp");
  --foil-iri: url("/TCG/foils/rl80-iri.webp");
  --foil-flakes: url("/TCG/foils/rl80-flakes.webp");
  /* 512px texture against a 744px card: ~69% renders the flakes 1:1. Much
     below that they average into flat grey — no glitter, not small glitter. */
  --flake-size: 68%;
  --glitter-warm: #ffd96b;
  --glitter-deep: #7a5410;
  /* The six angles a diffraction grating throws, and the band period
     (px, not %, so the bands stay fine at every scale). */
  --sun-1: hsl(2, 100%, 73%);
  --sun-2: hsl(53, 100%, 69%);
  --sun-3: hsl(93, 100%, 69%);
  --sun-4: hsl(176, 100%, 76%);
  --sun-5: hsl(228, 100%, 74%);
  --sun-6: hsl(283, 100%, 73%);
  --sun-step: 7px;
  --shine-rest: .3;
  /* DODGE (default): color-dodge brightens every pixel the same way, so the
     plate's whole metal lifts uniformly. Plated numbers from TradingCard. */
  --shine-blend: color-dodge;
  --shine-filter: brightness(calc(.34 + .40 * var(--hyp, 0))) contrast(1.9) saturate(.9);
  --shine-op: calc(.30 * var(--shine-rest) + .58 * var(--lift, 0));
}
.rc-card[data-metal="printed"][data-shine="soft"] {
  --shine-op: calc(.14 * var(--shine-rest) + .32 * var(--lift, 0));
}
/* MIRROR: overlay is a pivot blend — against light pixels it drives hard
   to white and saturates, against dark ones it barely moves — and
   contrast(3) crushes the sweep into hard bright/dark bands, which is what
   reads as polished chrome rather than tinted glass. */
.rc-card[data-metal="printed"][data-shine-blend="mirror"] {
  --shine-blend: overlay;
  --shine-filter: brightness(1.22) contrast(3) saturate(.75);
  --shine-op: calc(.42 * var(--shine-rest) + .55 * var(--lift, 0));
}
.rc-card[data-metal="printed"][data-shine-blend="mirror"][data-shine="soft"] {
  --shine-op: calc(.20 * var(--shine-rest) + .30 * var(--lift, 0));
}
/* GLITTER: embedded foil flakes. Dodging by black is the identity, so the
   gaps between flakes leave the gold as painted while a lit flake blows
   straight out of it. */
.rc-card[data-metal="printed"][data-shine-blend="glitter"] {
  --shine-blend: color-dodge;
  --shine-filter: brightness(1.9) contrast(4.5) saturate(1.05);
  --shine-op: calc(.68 * var(--shine-rest) + .30 * var(--lift, 0));
}
.rc-card[data-metal="printed"][data-shine-blend="glitter"][data-shine="soft"] {
  --shine-filter: brightness(1.3) contrast(4.5) saturate(1.15);
  --shine-op: calc(.30 * var(--shine-rest) + .30 * var(--lift, 0));
}

.rc-metal-shine,
.rc-metal-glare {
  position: absolute; inset: 0;
  display: none;
  pointer-events: none;
  overflow: hidden;
  transition: opacity 240ms ease;
  /* The plate is a full-bleed alpha map (white RGB, plate value in alpha),
     so it masks in the default alpha mode. */
  -webkit-mask-image: var(--metal-plate);
  mask-image: var(--metal-plate);
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  /* Same hole the frame art gets, so no light lands where its divider
     lines were cut away over the rules panel. */
  clip-path: polygon(evenodd,
    0 0, 100% 0, 100% 100%, 0 100%, 0 0,
    4.6% 83%, 95.4% 83%, 95.4% 91%, 4.6% 91%, 4.6% 83%);
}
.rc-card[data-shine="on"] .rc-metal-shine,
.rc-card[data-shine="soft"] .rc-metal-shine,
.rc-card[data-shine="on"] .rc-metal-glare,
.rc-card[data-shine="soft"] .rc-metal-glare { display: block; }

/* Refraction: fine diffraction bands whose angle swings with the tilt (so
   they sweep rather than slide), a broad iridescent smear parallaxed the
   other way, and glitter grain anchored to the card by its seed. */
.rc-metal-shine {
  will-change: background-position, filter, opacity;
  mix-blend-mode: var(--shine-blend);
  opacity: calc(var(--shine-op) * var(--shine-strength, 1));
  background-image:
    repeating-linear-gradient(
      calc(100deg + var(--ry, 0deg) * 3),
      var(--sun-1) 0, var(--sun-2) var(--sun-step),
      var(--sun-3) calc(var(--sun-step) * 2), var(--sun-4) calc(var(--sun-step) * 3),
      var(--sun-5) calc(var(--sun-step) * 4), var(--sun-6) calc(var(--sun-step) * 5),
      var(--sun-1) calc(var(--sun-step) * 6)
    ),
    var(--foil-iri),
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
/* Mirror: one broad rainbow instead of the dodge stack — overlay already
   supplies the contrast, so grain and glitter under it just muddy the
   pivot. 400% keeps the bands wide enough to sweep. */
.rc-card[data-shine-blend="mirror"] .rc-metal-shine {
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
   multiplied over the rainbow. This is the step that turns a smooth sheen
   into banded metal. Fine unit and grey gaps (not black), which on a
   near-black body would otherwise crush to one fat stripe. */
.rc-card[data-shine-blend="mirror"] .rc-metal-shine::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
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
/* Glitter: the flake field is STATIC, anchored by the seed, while two
   sweeps at different rates move across it. Sweeps and flakes multiply,
   then the very high contrast() acts as a threshold: a flake lights only
   while a sweep is bright enough where it sits, so flakes pop on and off
   IN PLACE as the card turns — what real glitter does. Sweep B floors at
   grey, not black: a true-black stop would annihilate every flake under it. */
.rc-card[data-shine-blend="glitter"] .rc-metal-shine {
  background-image:
    radial-gradient(farthest-corner circle at var(--mx, 50%) var(--my, 50%),
      #ffffff 0%, var(--glitter-warm) 22%, var(--glitter-deep) 60%, #6b5a30 100%),
    repeating-linear-gradient(calc(28deg + var(--ry, 0deg) * 7),
      #5a5a5a 0%, #ffffff 14%, #5a5a5a 30%),
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
.rc-card[data-shine-blend="glitter"] .rc-metal-shine::after { display: none; }

/* Specular: the wet highlight, on the metal only. */
.rc-metal-glare {
  will-change: background-image, opacity;
  mix-blend-mode: overlay;
  opacity: calc((.18 * var(--shine-rest) + .34 * var(--lift, 0)) * var(--shine-strength, 1));
  background-image:
    radial-gradient(farthest-corner circle at var(--mx, 50%) var(--my, 50%),
      hsla(0, 0%, 100%, .55) 6%,
      hsla(0, 0%, 100%, .26) 20%,
      hsla(0, 0%, 0%, .45) 74%);
  filter: brightness(.95) contrast(1.25);
}
.rc-card[data-shine="soft"] .rc-metal-glare {
  opacity: calc((.10 * var(--shine-rest) + .20 * var(--lift, 0)) * var(--shine-strength, 1));
}
@media (prefers-reduced-motion: reduce) {
  .rc-metal-shine, .rc-metal-glare { transition: none; }
}


/* ---------------- bench overlay ---------------- */
.rc-slots { position: absolute; inset: 0; pointer-events: none; }
.rc-facets {
  position: absolute; inset: 0; width: 100%; height: 100%;
  pointer-events: none; overflow: visible;
}
.rc-facets ellipse { fill: rgba(0, 255, 240, .10); stroke: #07ddf0; stroke-width: .35; vector-effect: non-scaling-stroke; }
.rc-facets text {
  fill: #07ddf0; font: 700 3.2px ui-monospace, monospace; text-anchor: middle; dominant-baseline: central;
  paint-order: stroke; stroke: #000; stroke-width: .6px;
}
.rc-slotline {
  position: absolute;
  outline: 1px dashed rgba(0, 240, 255, .85);
  background: rgba(0, 240, 255, .07);
}
.rc-slotline i {
  position: absolute; top: 0; left: 0;
  font: 500 9px/1.4 ui-monospace, monospace;
  font-style: normal;
  background: rgba(0, 240, 255, .9);
  color: #04202a;
  padding: 1px 3px;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .rc-card, .rc-layer { transition: none; }
}
`;
