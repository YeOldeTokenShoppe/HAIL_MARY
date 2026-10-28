"use client";

import React, { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { fxMaterial } from "../game/terminal-traders/fxMaterials.js";
import {
  RCANA_ASPECT,
  RCANA_LAYOUT,
  RCANA_DEPTHS,
  RCANA_RARITIES,
  HEART_METALS,
  HEART_HOLO,
  RARITY_HEART_ARROW,
  CLASS_TONE,
  DEPTH_FLOOR,
  MAX_TILT,
  behindClip,
} from "../game/rcana/cardFace.js";
import { CurrencyHeart, SigilHeart, HEART, HEART_SHADOW, ARROW, ARROW_SHADOW } from "./CurrencyHeart.jsx";
import { ArtifactHeader, ArtifactUsageBadge } from "./RcanaArtifactTemplate.jsx";
import { EventHeader, EventUsageBadge } from "./RcanaEventTemplate.jsx";
import { SUBTYPE_FURNITURE_STYLES } from "./RcanaSubtypeFurniture.jsx";

import { RcanaLiquidityBox, LIQUIDITY_BOX_STYLES } from "./RcanaLiquidityBox.jsx";
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
  // Typeface for the class label in the tab. "blackletter" — the wordmark's
  // own face, set in title case (caps blackletter is unreadable) — is the
  // default; "bebas" is the condensed caps it replaced, and the other
  // blackletters remain for the bench's comparison switch.
  classFont = "blackletter",
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
    : zPlate;
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

  const box = (slot) => ({
    left: `${slot.x}%`,
    top: `${slot.y}%`,
    width: `${slot.w}%`,
    height: `${slot.h}%`,
  });

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
          style={{ "--z": `${zPlate}px`, "--k": counterScale(zPlate, P) }}
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

          {showSlots && (
            <div className="rc-slots" aria-hidden>
              {Object.entries(L).map(([key, slot]) => (
                <div key={key} className="rc-slotline" style={box(slot)}>
                  <i>{key}</i>
                </div>
              ))}
            </div>
          )}

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
            <ArtifactHeader data={data} hideFrame={hideFrame} />
          ) : data.eventTemplate ? (
            <EventHeader data={data} hideFrame={hideFrame} />
          ) : data.compactTypeHeader ? (
            <RcanaTypeHeader data={data} slot={L.numberTab} hideFrame={hideFrame} classFont={classFont} />
          ) : (
            <>
              <div className="rc-slot rc-number" style={box(L.numberCell)}>
                <span>{data.number ?? ""}</span>
              </div>
              <div className="rc-slot rc-class" style={box(L.classCell)} data-sub={data.subClass ? "1" : undefined} data-font={classFont}>
                <span>
                  {classFont === "bebas" ? (data.cardClass || "").toUpperCase() : data.cardClass || ""}
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
            <div className="rc-slot rc-name" style={box(L.nameBanner)}>
              {/* Sized off the ribbon rather than by eye: at this cap the
                  title fills the band height with a little headroom and its
                  width still clears the flourishes. AutoFit only steps in for
                  a name longer than this one. */}
              <AutoFit max={u * 0.08} min={u * 0.038}>
                {data.name}
              </AutoFit>
            </div>
          )}

          <div className="rc-slot rc-body" style={box(L.bodyPanel)}>
            <AutoFit max={u * 0.0375} min={u * 0.015} block>
              {/* A person's line leads the panel as a quotation; narration
                  keeps its usual place beneath the rules. */}
              {data.flavor && data.flavorQuoted ? (
                <p className="rc-flavor rc-flavor--quote">{"\u201C" + data.flavor + "\u201D"}</p>
              ) : null}
              {data.ability ? <p className="rc-ability">{data.ability}</p> : null}
              {data.flavor && !data.flavorQuoted ? (
                <p className="rc-flavor">{data.flavor}</p>
              ) : null}
            </AutoFit>
          </div>

          {/* data-len steps the size down for three-digit values (100, 125,
              250) so they sit inside the box instead of running out of it. */}
          {data.artifactTemplate && !hideFrame && <ArtifactUsageBadge template={data.artifactTemplate} />}
          {data.eventTemplate && !hideFrame && <EventUsageBadge template={data.eventTemplate} />}
          {/* No left stat on a sealed plate — its seal stands there. */}
          {data.plate !== "sealed" && (
            <div className="rc-slot rc-stat rc-stat--left" style={box(data.plate === "valued" ? L.haloValueValued : L.haloValue)} data-len={String(data.halo ?? "").length}>
              <span>{data.halo ?? ""}</span>
            </div>
          )}
          {data.liquidityBox ? (
            <RcanaLiquidityBox value={data.hydro} slot={data.liquidityBox} hideFrame={hideFrame} />
          ) : (
            <div className="rc-slot rc-stat" style={box(L.hydroValue)} data-len={String(data.hydro ?? "").length}>
              <span>{data.hydro ?? ""}</span>
            </div>
          )}

          {/* The heart sits under the wordmark on every plate — a rarity mark
              should be where the eye learned to find it. */}
          {!printed.rarity && (() => {
            const heartSlot = L.rarity;
            const hf = heartSlot.heightFactor || 0.048;
            return (
              <div className="rc-slot rc-rarity" style={box(heartSlot)}>
                <RarityHeart
                  rarity={rarity}
                  height={u * hf}
                  heightFactor={hf}
                  rx={lrx}
                  ry={HEART_HOLO.style === "sigil" ? tilt.ry : lry}
                  mx={tilt.mx}
                  my={tilt.my}
                  hyp={tilt.hyp}
                  slot={heartSlot}
                />
              </div>
            );
          })()}
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

// The rarity mark: the site's own favicon heart, with its flat red swapped
// for a metal. The paths live in CurrencyHeart.jsx alongside the currency OVD;
// the dark copy behind each shape is the icon's own drop shadow, which is what
// keeps it legible on parchment. The arrow stays brand green at every tier;
// only the heart carries the rarity.
const RarityHeart = React.memo(function RarityHeart({ rarity, height, heightFactor = 0.048, rx, ry, mx, my, hyp, slot }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const metal = HEART_METALS[rarity.heart];
  if (!metal) return null;

  if (metal.holo && HEART_HOLO.style === "sigil") {
    // The mark is centred in its slot, 0.048 card-widths tall and 1.2× as
    // wide, so its box in card percent is known without measuring. Map the
    // pointer into the mark's own viewBox (72×60) for the pool.
    const wPct = heightFactor * 1.2 * 100;
    const hPct = heightFactor * RCANA_ASPECT * 100;
    const cx = slot ? slot.x + slot.w / 2 : 50;
    const cy = slot ? slot.y + slot.h / 2 : 50;
    const px = 36 + (((mx ?? 50) - cx) / wPct) * 72;
    const py = 30 + (((my ?? 50) - cy) / hPct) * 60;
    return (
      <SigilHeart
        uid={uid}
        height={height}
        metal={metal}
        mx={mx}
        my={my}
        px={px}
        py={py}
        hyp={hyp}
        ry={ry}
        arrow={RARITY_HEART_ARROW}
      />
    );
  }

  // -1..1 across the card's travel, so the foil reads the tilt the same way
  // the flame light does.
  const dx = Math.max(-1, Math.min(1, (ry || 0) / MAX_TILT.ry));
  const dy = Math.max(-1, Math.min(1, (rx || 0) / MAX_TILT.rx));

  if (!metal.holo) {
    // Flat ink. A basic card's mark is printed, not struck in foil.
    return (
      <svg className="rc-heart" viewBox="0 0 72 60" width={height * 1.2} height={height} aria-hidden focusable="false">
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor={metal.lit} />
            <stop offset="34%" stopColor={metal.mid} />
            <stop offset="100%" stopColor={metal.deep} />
          </linearGradient>
          <linearGradient id={`${uid}s`} x1="0" y1="0" x2="0.7" y2="1">
            <stop offset="18%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="34%" stopColor="#ffffff" stopOpacity={metal.sheen} />
            <stop offset="48%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g transform="translate(-262.671875,-68.484385) scale(1.333333)">
          <path d={HEART_SHADOW} fill="#1b1724" />
          <path d={HEART} fill={`url(#${uid})`} />
          <path d={HEART} fill={`url(#${uid}s)`} />
          {RARITY_HEART_ARROW && (
            <>
              <path d={ARROW_SHADOW} fill="#1b1724" />
              <path d={ARROW} fill="#64ef07" />
            </>
          )}
        </g>
      </svg>
    );
  }

  // Banknote-style OVD — see CurrencyHeart.jsx. The foil patch below is the
  // older full-colour treatment, kept behind HEART_HOLO.style = "foil".
  if (HEART_HOLO.style === "currency") {
    return <CurrencyHeart uid={uid} height={height} dx={dx} dy={dy} arrow={RARITY_HEART_ARROW} />;
  }

  // --- the foil patch -------------------------------------------------
  // A hologram is not a tinted sheen over whatever is behind it: it is an
  // opaque patch of metallised stock that happens to diffract. So the heart
  // is filled solid first and every colour above it is opaque too — nothing
  // here blends with the parchment, which is what bleached the old gold.
  //
  // The spectrum is struck in HARD bands rather than blended. Each colour
  // gets two stops at the same offset, so the eye sees four or five crisp
  // zones instead of a smudge, and the whole ramp both rotates and slides
  // with the tilt. Sliding is what sells it — a rainbow that only rotates
  // reads as a pinwheel, one that travels reads as diffraction.
  const bands = HEART_HOLO.bands;
  const spin = 64 + dx * 40 + dy * 12;
  const slide = dx * 0.42 + dy * 0.1;

  // Hard stops for the fringes: two per colour at the same offset, so the
  // texture is ruled rather than blended.
  const span = 1 / bands.length;
  const stops = [];
  bands.forEach((c, i) => {
    stops.push(<stop key={`${i}a`} offset={`${i * span * 100}%`} stopColor={c} />);
    stops.push(<stop key={`${i}b`} offset={`${(i + 1) * span * 100}%`} stopColor={c} />);
  });

  // The field is a BAND of colour inside transparency, not a wash over the
  // whole patch. That is the part the reference gets right and a full-bleed
  // ramp cannot: colour lands on one side of the mark and the dark stock
  // shows on the other, and the tilt sweeps the band across. A patch that
  // is coloured everywhere reads as painted; one that is half metal reads
  // as foil. One pass through the spectrum, not out and back — doubling it
  // back halves how far the hue actually travels, which is the effect.
  // The spectrum runs from the field's centre out to `tail`, then fades to
  // nothing by its rim. Opaque at the centre, so a card at rest shows the
  // mark fully coloured; transparent past the tail, so once the field is
  // swung off to one side the far half of the patch falls outside it and
  // goes back to bare stock. An inner transparent edge instead would put a
  // dark hole in the middle of the mark at rest.
  const { reach, radius, tail } = HEART_HOLO.field;
  const fieldStops = [
    ...bands.map((c, i) => (
      <stop key={i} offset={`${((i / (bands.length - 1)) * tail).toFixed(1)}%`} stopColor={c} />
    )),
    <stop key="z" offset="100%" stopColor={bands[bands.length - 1]} stopOpacity="0" />,
  ];

  // The facet grid's two halves, lit against shaded. At dx -1 the upper
  // triangles take the light; at +1 they take the shade; through the middle
  // they cross over, which is the moment the whole patch appears to flip.
  const facet = HEART_HOLO.facet;
  const bias = (dx * 0.72 + dy * 0.28);
  const lo = Math.max(0.03, facet.depth * (0.5 - bias * 0.5) * 2);
  const hi = Math.max(0.03, facet.depth * (0.5 + bias * 0.5) * 2);

  // The glint: a narrow hard-edged bar, the one place the foil goes white.
  // It crosses the patch rather than sitting on it, so it only shows for
  // part of the travel — the rest of the time the patch is pure colour.
  const glint = 50 + dx * 46 - dy * 12;

  return (
    <svg
      className="rc-heart"
      viewBox="0 0 72 60"
      width={height * 1.2}
      height={height}
      aria-hidden
      focusable="false"
    >
      <defs>
        {/* Repeated so the ramp still covers the patch once it is slid. */}
        <linearGradient
          id={`${uid}h`}
          x1="0"
          y1="0"
          x2={HEART_HOLO.period}
          y2="0"
          gradientTransform={`rotate(${spin} 0.5 0.5) translate(${slide} 0)`}
          spreadMethod="repeat"
        >
          {stops}
        </linearGradient>

        {/* A second ramp at a crossing angle, kept faint. One set of fringes
            is a rainbow; two that interfere are a hologram. */}
        <linearGradient
          id={`${uid}x`}
          x1="0"
          y1="0"
          x2={HEART_HOLO.period * 1.7}
          y2="0"
          gradientTransform={`rotate(${spin + 68} 0.5 0.5) translate(${-slide * 0.6} 0)`}
          spreadMethod="repeat"
        >
          {stops}
        </linearGradient>

        {/* The spectral field. Far bigger than the patch and swung well off
            it, so the patch samples a slice and the tilt drags a different
            slice across — the mark changes hue instead of showing bands
            that travel. This is where the colour comes from. */}
        <radialGradient
          id={`${uid}f`}
          cx={0.5 - dx * reach}
          cy={0.44 - dy * reach * 0.7}
          r={radius}
        >
          {fieldStops}
        </radialGradient>

        {/* The embossed facet grid. Two triangles per tile: one takes the
            light, one takes the shade, and the tilt swaps which is which —
            that swap is what a kinegram does and what no amount of moving
            colour can imitate. Rotating the whole grid a little as well
            keeps it from reading as a static screen door. */}
        <pattern
          id={`${uid}p`}
          width={facet.size}
          height={facet.size}
          patternUnits="userSpaceOnUse"
          patternTransform={`rotate(${-18 + dx * 7})`}
        >
          <polygon
            points={`0,0 ${facet.size},0 0,${facet.size}`}
            fill="#ffffff"
            fillOpacity={lo}
          />
          <polygon
            points={`${facet.size},0 ${facet.size},${facet.size} 0,${facet.size}`}
            fill="#000000"
            fillOpacity={hi}
          />
        </pattern>

        {/* Metallised curvature: the patch is not flat stock, it has a dome,
            and without this the bands look like printed stripes. */}
        <radialGradient id={`${uid}d`} cx={0.38 - dx * 0.16} cy={0.3 - dy * 0.14} r="0.78">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.34" />
          <stop offset="38%" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="72%" stopColor="#000000" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.62" />
        </radialGradient>

        {/* The arrow's own fringes, crossing the heart's by 52 degrees and
            running finer, so one patch still reads as two struck shapes. */}
        <linearGradient
          id={`${uid}a`}
          x1="0"
          y1="0"
          x2={HEART_HOLO.period * 0.72}
          y2="0"
          gradientTransform={`rotate(${spin + 52} 0.5 0.5) translate(${slide * 1.3} 0)`}
          spreadMethod="repeat"
        >
          {stops}
        </linearGradient>

        <linearGradient id={`${uid}g`} x1="0" y1="0" x2="0.65" y2="1">
          <stop offset={`${glint - 8}%`} stopColor="#ffffff" stopOpacity="0" />
          <stop offset={`${glint - 2}%`} stopColor="#ffffff" stopOpacity="0.72" />
          <stop offset={`${glint + 2}%`} stopColor="#ffffff" stopOpacity="0.72" />
          <stop offset={`${glint + 8}%`} stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g transform="translate(-262.671875,-68.484385) scale(1.333333)">
        <path d={HEART_SHADOW} fill="#1b1724" />
        {/* Opaque stock, then the diffraction on top of it. */}
        {/* Isolated, so the blend modes inside mix with each other and not
            with the parchment — and saturated afterwards, because two
            semi-transparent ramps of different hues average toward grey,
            which is exactly how the first attempt went pastel. */}
        <g style={{ isolation: "isolate", filter: "saturate(1.6) contrast(1.06)" }}>
          <path d={HEART} fill={HEART_HOLO.substrate} />
          <path d={HEART} fill={`url(#${uid}f)`} />
          {/* Soft-light, so the facets emboss the colour rather than
              bleaching it the way straight white and black would. */}
          <path d={HEART} fill={`url(#${uid}p)`} style={{ mixBlendMode: "soft-light" }} />
          <path d={HEART} fill={`url(#${uid}p)`} opacity="0.55" />
          {/* Overlay keeps the field's hue and adds the ruling on top of it;
              plain alpha would wash both toward the average of the two. */}
          <path
            d={HEART}
            fill={`url(#${uid}h)`}
            opacity={HEART_HOLO.fringe}
            style={{ mixBlendMode: "overlay" }}
          />
          <path
            d={HEART}
            fill={`url(#${uid}x)`}
            opacity={HEART_HOLO.crossing}
            style={{ mixBlendMode: "color-dodge" }}
          />
        </g>
        <path d={HEART} fill={`url(#${uid}d)`} />
        <path d={HEART} fill={`url(#${uid}g)`} />
        {/* A bright rim, so the patch keeps its edge against parchment even
            when the bands facing the viewer happen to be dark. */}
        <path d={HEART} fill="none" stroke={HEART_HOLO.rim} strokeOpacity="0.55" strokeWidth="1.1" />
        {RARITY_HEART_ARROW && (
          <>
            {/* Either way the arrow is keylined against the foil — printed
                green it would otherwise land on a band its own colour, and
                struck in foil it would dissolve into the heart entirely. */}
            <path d={ARROW_SHADOW} fill="#121020" />
            <path d={ARROW} fill="none" stroke="#121020" strokeWidth="2.6" strokeLinejoin="round" />
            {HEART_HOLO.arrow === "foil" ? (
              <>
                <g style={{ isolation: "isolate", filter: "saturate(1.6) contrast(1.06)" }}>
                  <path d={ARROW} fill={HEART_HOLO.substrate} />
                  <path d={ARROW} fill={`url(#${uid}f)`} />
                  <path d={ARROW} fill={`url(#${uid}p)`} style={{ mixBlendMode: "soft-light" }} />
                  <path d={ARROW} fill={`url(#${uid}p)`} opacity="0.55" />
                  <path
                    d={ARROW}
                    fill={`url(#${uid}a)`}
                    opacity={HEART_HOLO.fringe + 0.18}
                    style={{ mixBlendMode: "overlay" }}
                  />
                </g>
                <path d={ARROW} fill={`url(#${uid}g)`} />
              </>
            ) : (
              <path d={ARROW} fill="#7dff14" />
            )}
          </>
        )}
      </g>
    </svg>
  );
});

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

// Steps the font size down until the content stops overflowing its slot.
// Cheaper and more predictable than measuring text metrics, and it reruns on
// content change, which is what a programmatic ability line needs.
function AutoFit({ children, max, min, block = false }) {
  const ref = useRef(null);
  const [size, setSize] = useState(max);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
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
    let s = max;
    el.style.fontSize = `${s}px`;
    let guard = 0;
    // Proportional steps, so the loop converges at any card size instead of
    // running out of its 60 iterations on a large one.
    while (guard++ < 60 && s > min && !fits()) {
      s = Math.max(min, s - Math.max(0.5, s * 0.04));
      el.style.fontSize = `${s}px`;
    }
    setSize(s);
  }, [children, max, min]);

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
/* Blackletter trials for the class label (bench control). Title case, no
   tracking, sized up a little since blackletter x-heights run small. */
.rc-class[data-font="blackletter"] span { font-family: "Blackletter", "UnifrakturCook", serif; font-weight: 400; letter-spacing: .01em; font-size: calc(var(--u) * .058); }
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
.rc-name {
  font-family: "Nabla", "Blackletter", "UnifrakturCook", serif;

  font-variation-settings: "EDPT" var(--name-depth, 120), "EHLT" var(--name-hilite, 12);
  color: #f4cf62;
  padding: 0 2%;
  /* Nabla's bevel extrudes downward, so the glyphs sit optically low in the
     ribbon; this lifts them back onto its centre line. */
  transform: translateY(-2%);
}
.rc-body { padding: 1.6% 2.4%; align-items: start; }
/* The rule is what gets played, so it is the louder line: Medium weight,
   full size. The quote is the character's voice — true italic, a step
   smaller and lighter — so at table distance the eye lands on the mechanic
   first and the line second. */
.rc-ability {
  margin: 0;
  /* A longer ability splits evenly instead of orphaning its last words. */
  text-wrap: balance;
  font-family: "IBM Plex Serif", Georgia, serif;
  font-weight: 500;
  color: #241a0a;
}
.rc-flavor {
  margin: .35em 0 0;
  text-wrap: balance;
  font-family: "IBM Plex Serif", Georgia, serif;
  font-style: italic;
  font-weight: 400;
  color: #5a4524;
  /* .92 rather than .88: on a printed 2.5" card .88 lands near 5pt, the
     floor for an italic serif. Still a clear step under the rule. */
  font-size: .92em;
}
/* Leading the panel, so its spacing sits below rather than above, and a
   shade darker — it is the character speaking, not a footnote. */
.rc-flavor--quote { margin: 0 0 .35em; color: #4f3b1c; }
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
/* The rarity mark is artwork now, not type. */
.rc-heart { display: block; }

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
