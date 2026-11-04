"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fxMaterial } from "../game/terminal-traders/fxMaterials.js";
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
import { EventHeader } from "./RcanaEventTemplate.jsx";
import { SUBTYPE_FURNITURE_STYLES, UsageSymbol } from "./RcanaSubtypeFurniture.jsx";

import { RcanaLiquidityBox, RcanaValueBox, LIQUIDITY_BOX_STYLES } from "./RcanaLiquidityBox.jsx";
import { RcanaTypeHeader, TYPE_HEADER_STYLES } from "./RcanaTypeHeader.jsx";

const REST = { rx: 0, ry: 0, mx: 50, my: 50, hyp: 0 };

// Card box in CSS px at scale 1. Every slot is a percentage of this, so the
// card re-renders identically at any scale — nothing is measured in px except
// the parallax depths, which are deliberately absolute (a 90px push should
// read as 90px of depth whether the card is a thumbnail or full bleed is
// false — so depth scales with the card, see depthFor()).
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
  classFont = "mosaic",
  // Typeface for the name on the ribbon. "gilt" is blackletter struck in gold.
  // "nabla" is the chromatic 3D sans it replaced; it stays for foils and
  // alt-arts, where loud is the job. (Nabla is a COLRv1 font: engines
  // without COLRv1 paint its flat fallback colour.)
  nameFont = "gilt",
  // The rules line's furniture: an ABIL80 (Ability) pill for Traders,
  // timing/usage badges for other types,
  // trait pills, bold game terms with the drop glyph on Hydro, and a
  // hairline before the flavor. One switch, so the bench can compare the
  // plain line against the dressed one.
  keywordBadges = true,
  // The "19 / 80" in the bottom margin.
  collectorLine = true,
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
  const tone = CLASS_TONE[data.cardClass] || CLASS_TONE.Trader;
  const printed = data.printed || {};
  const L = data.layout || RCANA_LAYOUT;
  const categoryFont = classFont === "mosaic" ? "bebas" : classFont;

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
            <ArtifactHeader data={data} hideFrame={hideFrame} classFont={classFont} />
          ) : data.eventTemplate ? (
            <EventHeader data={data} hideFrame={hideFrame} classFont={classFont} />
          ) : data.compactTypeHeader ? (
            <RcanaTypeHeader data={data} slot={L.numberTab} hideFrame={hideFrame} classFont={classFont} />
          ) : (
            <>
              <div className="rc-slot rc-number" style={box(L.numberCell)}>
                <span>{data.number ?? ""}</span>
              </div>
              <div className="rc-slot rc-class" style={box(L.classCell)} data-sub={data.subClass ? "1" : undefined} data-font={categoryFont}>
                <span>
                  {categoryFont === "bebas" ? (data.cardClass || "").toUpperCase() : data.cardClass || ""}
                  {/* A coin after the class, only when a face sets tabCost —
                      no card does by default, since a Trader's hire cost is
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

          {/* Sealed cards put usage beside its label above the rule. */}
          {data.plate !== "sealed" && (
            <RcanaValueBox value={data.halo} slot={L.standingBox} hideFrame={hideFrame} cardClass={data.cardClass}
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
              <img
                src="/RL80_Mosaic_Medallion.webp"
                alt="RL80 heart-and-arrow medallion"
                width={1254}
                height={1254}
                draggable={false}
              />
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

      <style>{RCANA_STYLES}{SUBTYPE_FURNITURE_STYLES}{LIQUIDITY_BOX_STYLES}{TYPE_HEADER_STYLES}</style>
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
  const usage = data.artifactTemplate || data.eventTemplate;
  const abilityLabel = data.cardClass === "Trader" && Boolean(data.ability);
  return (
    <div className="rc-slot rc-body" data-named-ability={data.abilityName ? true : undefined} style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%` }}>
      <AutoFit max={u * 0.043} min={u * 0.036} block alignAbilityCap={keywordBadges && abilityLabel}>
        {keywordBadges && (abilityLabel || data.keyword || data.traits?.length > 0) && (
          <div className="rc-rules-labels" data-corner-cap={abilityLabel || undefined} style={{ "--kw": data.keywordColor }}>
            {abilityLabel && (
              <span className="rc-ability-heading">
                <b className="rc-kw rc-kw--ability" aria-label="ABIL80 — Ability">ABIL80</b>
                {data.abilityName && <span className="rc-ability-name rc-ability-name--inline">{data.abilityName}</span>}
              </span>
            )}
            {data.keyword && <b className="rc-kw">
              {usage?.usage && <UsageSymbol kind={usage.usage} />}
              {data.keyword}
            </b>}
            {(data.traits || []).map((t) => <b key={t} className="rc-kw rc-kw--trait">{t}</b>)}
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

// A Range on the live card returns perspective-transformed screen coordinates.
// Measure a hidden copy at the same local width and font instead, so the cap's
// layout offset cannot drift when fonts settle or content changes during tilt.
function firstLineOffset(ability) {
  const style = getComputedStyle(ability);
  const copy = ability.cloneNode(true);
  copy.setAttribute("aria-hidden", "true");
  Object.assign(copy.style, {
    position: "fixed", left: "0", top: "0", margin: "0",
    visibility: "hidden", pointerEvents: "none", transform: "none",
    width: style.width, fontFamily: style.fontFamily, fontSize: style.fontSize,
    fontWeight: style.fontWeight, fontStyle: style.fontStyle,
    lineHeight: style.lineHeight, letterSpacing: style.letterSpacing,
    wordSpacing: style.wordSpacing,
  });
  document.body.appendChild(copy);
  try {
    const range = document.createRange();
    range.selectNodeContents(copy);
    const firstLine = range.getClientRects()[0];
    return firstLine ? firstLine.left - copy.getBoundingClientRect().left : 0;
  } finally {
    copy.remove();
  }
}

// Steps the font size down until the content stops overflowing its slot.
// Cheaper and more predictable than measuring text metrics, and it reruns on
// content change, which is what a programmatic ability line needs.
function AutoFit({ children, max, min, block = false, alignAbilityCap = false }) {
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
    // The SLOT's scroll size, not this element's. `.rc-fit` carries
    // max-height: 100%, which clamps its own box — so its scrollHeight tops
    // out at the slot's height and reports a fit however much text is really
    // there. The slot, clipping at overflow: hidden, reports the truth.
    const fits = () =>
      slot.scrollHeight <= slot.clientHeight + 1 && slot.scrollWidth <= slot.clientWidth + 1;
    const fit = () => {
      if (!active) return;
      el.style.removeProperty("--ability-cap-left");
      let s = max;
      el.style.fontSize = `${s}px`;
      let guard = 0;
      // Refit after web fonts settle as well as after content changes.
      while (guard++ < 60 && s > min && !fits()) {
        s = Math.max(min, s - Math.max(0.5, s * 0.04));
        el.style.fontSize = `${s}px`;
      }
      if (alignAbilityCap) {
        // The centered paragraph can wrap differently on each card. Anchor
        // its cap to the rendered first line after the font has settled.
        const ability = el.querySelector(".rc-ability");
        const cap = el.querySelector(".rc-ability-heading");
        if (ability && cap) {
          const left = firstLineOffset(ability);
          const room = Math.max(0, ability.clientWidth - cap.offsetWidth);
          el.style.setProperty("--ability-cap-left", `${Math.max(0, Math.min(left, room))}px`);
        }
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
  }, [children, max, min, alignAbilityCap]);

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
.rc-fit--block { text-align: center; line-height: 1.22; }

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
/* Named abilities lead with a bold title, followed by regular-weight rules.
   Unnamed rules keep their Medium weight. Flavor is a smaller true italic. */
.rc-ability {
  margin: 0;
  text-align: center;
  text-wrap: balance;
  white-space: pre-line;
  font-family: "IBM Plex Serif", Georgia, serif;
  font-weight: 500;
  color: #241a0a;
}
.rc-body[data-named-ability] .rc-ability { font-size: .92em; font-weight: 400; }
.rc-flavor {
  box-sizing: border-box;
  width: fit-content;
  max-width: 96%;
  margin: .16em auto 0;
  padding: 0 .4em;
  text-wrap: balance;
  font-family: "IBM Plex Serif", Georgia, serif;
  font-style: italic;
  font-weight: 400;
  color: #5a4524;
  font-size: .72em;
  text-align: center;
}
.rc-body[data-named-ability] .rc-flavor { margin-top: .08em; }
.rc-flavor::before {
  content: "";
  display: block;
  width: 6em;
  height: .75em;
  max-width: 90%;
  margin: 0 auto .12em;
  /* Crop only the asset's transparent vertical padding; keep the flourish
     at its original proportions in a single centered bar above the quote. */
  background: url("/HorizontalBar3.png") center / 100% auto no-repeat;
}
.rc-ability-name { margin: 0 0 .12em; font-family: "IBM Plex Serif", Georgia, serif; font-size: 1.12em; font-weight: 700; }
.rc-ability-heading { display: inline-flex; align-items: center; gap: .35em; }
.rc-ability-name--inline { margin: 0; line-height: 1; color: #241a0a; }

/* ---------------- rules furniture ----------------
   Everything here is in em, so AutoFit scales the badges with the line.
   An ABIL80 corner cap labels Trader abilities; timing badges follow the
   type accent. Traits use an outlined pill in the same accent color. */
.rc-rules-labels { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: .25em; margin-bottom: .22em; }
.rc-rules-labels[data-corner-cap] {
  justify-content: flex-start;
  padding-left: var(--ability-cap-left, 0px);
}
.rc-kw {
  display: inline-flex;
  align-items: center;
  gap: .3em;
  padding: .15em .65em .12em .4em;
  border-radius: .15em .15em .65em .15em;
  background: var(--kw, #155b60);
  color: #fff0bc;
  font-family: "Bebas Neue", Impact, sans-serif;
  font-weight: 400;
  font-style: normal;
  font-size: .60em;
  letter-spacing: .07em;
  line-height: 1.05;
  text-transform: uppercase;
  white-space: nowrap;
  box-shadow: inset 0 0 0 .07em #f4cd61, 0 0 0 .06em #1d190f;
}
.rc-kw svg { flex: 0 0 1.05em; width: 1.05em; height: 1.05em; }
.rc-kw--ability {
  --kw: #07536b;
  margin-top: .08em;
  padding-left: .65em;
}
.rc-kw--trait {
  background: #fff6d6;
  color: var(--kw, #155b60);
  box-shadow: inset 0 0 0 .08em var(--kw, #155b60);
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
.rc-emblem > img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
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
