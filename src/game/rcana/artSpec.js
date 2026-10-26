// R-cana art spec — the constants a card's art file is written against:
// depth rungs, FX blend/clip options, the shared flame light response and
// the frame fallbacks. No imports, by design: art files import from here and
// cardFace.js imports the art registry, so anything this file pulled from
// cardFace.js would be a cycle. cardFace.js re-exports everything here, so
// existing `import { ART_PLANES } from "./cardFace.js"` keeps working.

export const ART_PLANES = {
  // Nothing sits behind hell yet; the rung is here for when something does.
  sky: -112, // the far field: whatever is behind the environment
  scene: -68, // the environment the subject stands in
  subject: -22, // a figure that sits inside the window, framed by the border

  // A figure whose own art is drawn past the border. Positive, so it paints
  // in front of the frame and the overhang simply shows — which is how a
  // printed breakout card does it: flat ink over the border, no cut-out, no
  // second copy. It is only a few px ahead of the frame's +44 on purpose:
  // pushed further the figure stops reading as part of the card and starts
  // swimming against the background on tilt.
  figureFront: 52,

  // Loose foreground props — a thrown coin, a spark, a falling card. The
  // frontmost rung there is: ahead of FX_PLANES.near (104), so a prop reads
  // as an object in the air between the viewer and the fire rather than
  // something burning inside it, and under FX_CEILING (130), past which a
  // layer stops reading as part of the card. At 8 degrees it swings 3.1% of
  // the card's width against the figure it was drawn beside, which is the
  // whole point of giving it a rung of its own.
  prop: 118,
};

export const FX_PLANES = {
  near: 104, // just off the card's surface: flame licking over the frame
  far: 72, // hugging the frame: holo, foil, a light dusting
};

// FX carry their own alpha, so they composite as painted by default; a sheet
// meant to read as light rather than as paint opts into a glow blend.
export const FX_BLENDS = ["normal", "screen", "plus-lighter", "overlay", "soft-light"];
export const FX_BLEND_DEFAULT = "normal";

// Where an FX sheet is allowed to paint.
//   "card"   full bleed, over the frame and the text panels alike
//   "window" the art window only, so the body copy and the stat strip stay
//            clean. A sheet dense enough to read as fire is also dense enough
//            to swallow an ability line; this is the setting that lets one
//            sheet work on a card that carries text.
//   "none"   the sheet is drawn for this card — paint it as it is. No
//            feather, no notch, nothing trimmed. Use it when the art already
//            stops short of every edge and clears the printed furniture.
// A "clear" is a soft hole in an fx sheet, so printed ink underneath stays
// readable. The sheet is faded out over the named layout slot and fades back
// in around it: a hard cut through a flame reads as a mistake, a fade reads
// as the fire thinning. `pad` widens the hole past the slot on every side and
// `feather` is the blur radius, both in card percent.
export const FX_CLEAR_PAD = 2.5;
export const FX_CLEAR_FEATHER = 2.0;

export const FX_CLIPS = ["card", "window", "none"];
export const FX_CLIP_DEFAULT = "card";

// Light response for flame3.webp. The material is shared with the Terminal
// Traders fire, but the facets are this sheet's own: they sit on its six hot
// spots — the two upper curls and four along the lower arc — found by
// peak-picking its luminance. Facets tuned for another sheet would light
// empty space, since each one only shows where that image is bright.
export const FLAME3_REFLECTION = {
  material: "fire",
  // Over 1 the core alpha saturates and the bloom carries the rest, which is
  // what makes a flare read as heat rather than as a brighter picture.
  strength: 1.3,

  // Pushed past the shared `fire` material, for this card only: the Terminal
  // Traders flame uses the same entry and should not move with this one.
  tune: {
    coreLightness: [50, 100], // lower floor, white-hot peak: more contrast
    emissionGain: 1.3,
    bloomGain: 1.45,
    bloomRadius: [8, 30],
    bloomBrightness: 2.0,
    rimLightness: 72,
  },

  // Traced along the sheet's own ridge, so every facet sits on a real curl.
  // Positions are the luminance peaks of flame3.webp itself (blurred 22px,
  // greedy-picked with a 9% exclusion), not inherited from an earlier sheet
  // — an inherited set had six of eight facets over empty space, which is
  // why only the right tail ever flared.
  //
  // The sheet is an ARCH: a crescent up the left, a thick band across the
  // top, trailing off at the top right. The arch facets share one axis, so
  // they all read the same number off the tilt, and their `angle`s run in
  // order from left to right: a left-right tilt walks that number through
  // the list and the highlight travels along the arch instead of the whole
  // thing swelling at once. The axis leans upward (negative y) so tilting
  // toward the top of the card also lights it — that is where the mass is.
  // Spacing is 0.25 against a roughness of 0.28, so neighbours overlap and
  // the band slides rather than blinking; at rest the crown of the arch
  // (angle 0) is lit, which is the thickest flame on the card.
  //
  // Facet count is a frame-rate decision as much as a visual one. The card
  // turns in 3D, which forces the light's masked layers to re-rasterise
  // every frame whatever is in them, so cost tracks gradient AREA almost
  // exactly: measured on one swaying card, 1 facet ran 33fps, 6 ran 21 and
  // 12 ran 10. The renderer drops whichever are unlit at the tilt, and with
  // this spacing about four of the ten are lit at once. Buy more flare with
  // `strength` and the tune, not with more facets.
  //
  // The tail and the tuft keep axes of their own, so they flare on their
  // own schedule and the card never looks like one animation.
  facets: [
    // the arch, left crescent to top right
    { x: 11, y: 19, radius: [10, 12], axis: [0.92, -0.38], angle: -0.75, roughness: 0.28, hue: 30 },
    { x: 19, y: 10, radius: [11, 9], axis: [0.92, -0.38], angle: -0.50, roughness: 0.28, hue: 34 },
    { x: 31, y: 5, radius: [13, 8], axis: [0.92, -0.38], angle: -0.25, roughness: 0.28, hue: 40 },
    { x: 44, y: 4, radius: [13, 8], axis: [0.92, -0.38], angle: 0.00, roughness: 0.28, hue: 44 },
    { x: 58, y: 3, radius: [13, 8], axis: [0.92, -0.38], angle: 0.25, roughness: 0.28, hue: 42 },
    { x: 72, y: 6, radius: [12, 8], axis: [0.92, -0.38], angle: 0.50, roughness: 0.28, hue: 38 },
    { x: 82, y: 10, radius: [10, 8], axis: [0.92, -0.38], angle: 0.75, roughness: 0.28, hue: 34 },

    // the right tail — the flare that was already working, kept on schedule
    { x: 91, y: 46, radius: [9, 12], axis: [1.00, 0.10], angle: 0.55, roughness: 0.26, hue: 50 },
    { x: 83, y: 55, radius: [12, 9], axis: [0.99, 0.17], angle: 0.30, roughness: 0.26, hue: 46 },

    // the small tuft at the left margin
    { x: 15, y: 46, radius: [11, 6], axis: [-0.90, 0.44], angle: 0.45, roughness: 0.26, hue: 32 },
  ],
};

// ---------------------------------------------------------------------------
// Art registry
// ---------------------------------------------------------------------------
// The frame a card falls back to when it names none of its own. Per-class
// frames do not exist yet, so all four resolve to the Lotería plate: a card
// added without a `frame` gets a real frame rather than a broken image. Give
// a class its own art by replacing just that entry.
export const DEFAULT_FRAME = "/TCG/frames/LOTERIA_FRAME2.webp";

// Three plates. The stat boxes and their glyphs are painted INTO the plate:
//   "boxed"   halo box left, drop box right — Trader
//   "valued"  the halo swapped for the INGOT (Prosperity) — Asset, called Event
//   "sealed"  the halo box healed over and the TYPE SEAL drawn there instead,
//             drop box kept — Hazard, Remedy, Artifact, Grace, fired Event
// The drop box always holds "the Liquidity on this card": what you pay for
// it on every type but Traders, where it is what they pay YOU (their income —
// the one type that generates water). A Trader's hire cost prints as a coin
// in the tab instead, the one place that coin appears.
export const PLATES = {
  // halo + drop: a Trader's Grace and income
  boxed: "/TCG/frames/LOTERIA_FRAME2.webp",
  // ingot + drop: an Asset's or a called Event's value (Prosperity) and cost
  valued: "/TCG/frames/LOTERIA_FRAME2_value.webp",
  // type seal + drop: everything else, and its cost
  sealed: "/TCG/frames/LOTERIA_FRAME2_sealed.webp",
};

// The type seal on a sealed plate: a full-canvas overlay (1024x1422, seal in
// place at the left of the signature strip, centre ≈ 18% across, 90% down),
// one per type. "event" is the seal for FIRED Events; a called Event is on
// the boxed plate and prints its value instead.
export const TYPE_BADGE = {
  event: "/TCG/badges/event.webp",
  hazard: "/TCG/badges/hazard.webp",
  remedy: "/TCG/badges/remedy.webp",
  artifact: "/TCG/badges/artifact.webp",
  grace: "/TCG/badges/grace.webp",
};

export const CLASS_FRAME = {
  Trader: DEFAULT_FRAME,
  Asset: DEFAULT_FRAME,
  Event: DEFAULT_FRAME,
  Artifact: DEFAULT_FRAME,
};

// Each card names its art planes far to near. `z` defaults to the ART_PLANES
// rung matching the layer id, so most cards only name a file.
//
// Every layer is drawn 1:1 with the card: art authored on the frame's own
// 1024x1422 canvas lands exactly where it was drawn, whatever the layer's
// depth or clipping. `scale` over-scales a layer about the card's centre so a
// deep one's drift never pulls its artwork short of the window edge, and
// `offset` nudges it in percent of the card — positive y moves it down.
