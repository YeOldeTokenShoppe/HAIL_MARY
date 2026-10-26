// R-cana card face — the printed layer spec.
//
// A Lotería-style R-cana card is NOT one flat PNG (that was the old
// `loteria.js` print path, where the file IS the card face). It is a stack:
//
//   backdrop    furthest   an opaque floor behind everything, so art layers
//                          carrying real transparency never show the page
//   art[0..n]   far..near  ordered far to near: sky, environment, figure. An
//                          art layer may sit in FRONT of the frame (positive
//                          z) when its own art is drawn to overhang the
//                          border — see ART_PLANES.figureFront
//   frame       near       border, banner, parchment panel, stat boxes, mark
//   ink         near       number, class, name, ability, halo, hydro, rarity
//   fx[0..n]    nearest    overlays in FRONT of the card: flame, thunder, holo
//
// The ink rides at the SAME depth as the frame, because every ink slot is
// positioned against a box printed on the frame. Art sits behind at negative
// depth, which is what produces the parallax when the card tilts. See
// RcanaCard.jsx for the depth math.
//
// Splitting the face this way is what makes 88 cards affordable: the frame is
// shared by every card of a class, so a new card costs its art layers and a
// row of data, not a finished 1064x1478 print.

export const RCANA_DIR = "/TCG/rcana";

// Where a card's images live, by convention: public/TCG/rcana/<id>/<name>.webp.
// An art file that names no `src` for a layer gets this — the scene layer is
// scene.webp, the subject is subject.webp, an fx layer "flame" is
// fx-flame.webp — so the images are only ever touched in public/ and the art
// file never repeats a path. A `src` on the layer still wins (shared sheets
// such as /TCG/fx-overlays/flame3.webp).
export const artPath = (id, name, ext = "webp") => `${RCANA_DIR}/${id}/${name}.${ext}`;

// The frame defines the card's edge, so its aspect is the card's aspect.
// As of the 2026-10-23 re-export every layer — frame, hell2 and Diablito2 —
// is 1024x1422, so the whole stack shares one canvas and object-fit: cover
// trims nothing. Keep new art on that canvas: a layer at a different aspect
// gets cropped to fit and silently falls out of register with the others.
export const RCANA_ASPECT = 1027 / 1424;

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------
export const RCANA_CLASSES = {
  TRADER: "Trader",
  ASSET: "Asset",
  EVENT: "Event",
  ARTIFACT: "Artifact",
};

// Classes that are a person. Their flavour line is something the character
// says, so it sets as a quotation and leads the panel — the card introduces
// who is speaking before it explains what they do. Everything else narrates,
// and narration follows the rules text in the usual place.
export const SPEAKING_CLASSES = [RCANA_CLASSES.TRADER];

export const CLASS_TONE = {
  Trader: { ink: "#1b1206", accent: "#f2c230" },
  Asset: { ink: "#1b1206", accent: "#8fd4a8" },
  Event: { ink: "#1b1206", accent: "#ff8a5c" },
  Artifact: { ink: "#1b1206", accent: "#cdb4ff" },
};

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------
// Halo and Hydro are the PRINTED names for the two Trader stats the rules
// already track: Grace (the halo) and Liquidity (the water drop). The icons
// on the frame are the glyphs for those stats, so the card face and the rules
// stay one vocabulary — a disgraced Trader is one printed at zero halo.
export const POINT_TYPES = {
  // On a Trader the halo is Grace; on an Asset or a called Event it is the
  // card's VALUE — Prosperity on sale or when banked. Same glyph: standing,
  // in a game where profit is piety. The drop is Liquidity on every type.
  halo: { label: "Halo", rule: "Grace", assetRule: "Prosperity", glyph: "halo", box: "left" },
  hydro: { label: "Hydro", rule: "Liquidity", glyph: "drop", box: "right" },
};

// ---------------------------------------------------------------------------
// Rarity
// ---------------------------------------------------------------------------
// Rarity reads as a single heart — the favicon's — poured full of a metal.
// Colour alone carries the tier, so there are two: gold from Rare upward,
// red below it. Re-cut the ladder by changing a card's `heart` here; no
// other file needs to know.
// The rarity mark is the whole favicon, heart and arrow. The arrow does cost
// some colour legibility at footer size — it crosses the heart and the two
// can merge at a glance — so the mark is drawn as large as the band allows
// to keep the metal readable. Set false for the heart alone.
export const RARITY_HEART_ARROW = true;

// `holo` swaps the flat metal for the security-hologram treatment: an opaque
// dark substrate with hard-edged spectral bands that walk with the tilt. It is
// on for gold and off for red on purpose — a basic card printed in flat ink
// and a rare one carrying a foil patch is how the hierarchy reads at a glance,
// and the flat red does not wash out against the parchment the way gold did.
export const HEART_METALS = {
  red: { lit: "#ff7a62", mid: "#f7160e", deep: "#9c0b06", sheen: 0.18 },
  // Gold prints as a foil patch rather than as ink. The flat version washed
  // out against the parchment, which is the whole reason for the substrate.
  gold: { lit: "#fff7cf", mid: "#f2bb1b", deep: "#8a5906", sheen: 0.85, holo: true },
};

// The spectrum the foil patch diffracts, and the dark metallised stock it is
// struck on. These are the brand's holo colours taken down in lightness and
// up in saturation: at 73% they read as pastel and vanish into parchment,
// which was the original complaint. Bands are drawn hard-edged, not blended
// — at the size this prints, a smooth rainbow reads as a smudge, while four
// crisp zones read as a security hologram.
export const HEART_HOLO = {
  substrate: "#130e1c",
  rim: "#f6eaff",

  // The patch gets its COLOUR from a spectral field far larger than itself,
  // anchored off the shape and swung a long way by the tilt. Because the
  // field dwarfs the patch, the patch only ever samples a slice of it, and
  // turning the card drags a different slice across — so the whole mark
  // changes hue rather than showing bands that slide past. That is the
  // difference between a foil that tilts to colour and a printed rainbow.
  //
  // `reach` is how far the field's centre travels, in patch widths, from
  // one end of the tilt to the other. Under about 0.6 the hue barely moves;
  // over about 1.6 the patch falls off the end of the spectrum and goes
  // flat at the extremes.
  // `reach` is how far the field's centre swings, in patch widths; `radius`
  // how wide the whole field is; `tail` how far out along it the spectrum
  // runs before fading to nothing. Centred, the patch is inside the colour
  // and reads fully iridescent. Swung to one end, half the patch falls past
  // the tail and goes back to bare stock — which is the half of the effect
  // a full-bleed ramp can never show.
  field: { reach: 0.85, radius: 1.15, tail: 55 },

  // The embossed micro-structure the field lights. This is what a hologram
  // actually is and what colour alone never gets to: a ruled field of tiny
  // facets, each catching the light on one half and shading on the other,
  // so the patch has grain and depth before any colour touches it. `size`
  // is the tile in the favicon's own units — the mark is about 54 of them
  // across, so 8 gives roughly seven facets edge to edge. `depth` is how
  // hard the two halves part; past about 0.4 it stops reading as embossing
  // and starts reading as a checkerboard.
  //
  // Which half is lit FLIPS with the tilt. That flip is the kinegram, the
  // part that makes a security hologram look alive rather than printed.
  facet: { size: 8, depth: 0.28 },

  // Fringes are a second texture over the field — the ruling, finer than
  // the facets and running across them.
  period: 0.3,
  fringe: 0.4,
  // A second ramp crossing the first at 68 degrees. One set of fringes is a
  // rainbow; two that interfere are a hologram.
  crossing: 0.22,

  bands: [
    "hsl(2 100% 62%)",
    "hsl(42 100% 57%)",
    "hsl(93 92% 50%)",
    "hsl(176 100% 50%)",
    "hsl(228 100% 62%)",
    "hsl(283 100% 66%)",
  ],

  // "ink" keeps the favicon's green arrow printed over the foil; "foil"
  // strikes the arrow in the same stock, at a crossing angle so it still
  // separates from the heart behind it.
  arrow: "ink",

  // How the patch is struck. "foil" is the full-colour patch described
  // above. "currency" is a banknote OVD: mirror-silver stock, engraved with
  // concentric diffraction rings, a hard spectral band sweeping across, a
  // latent numeral that only resolves at one angle, and a ring of
  // microtext. Nothing in it is a painted rainbow — the colour lives in the
  // engraving, and the tilt is what lights it.
  style: "sigil",

  // "sigil" is the card body's motif foil, applied to the mark: the heart's
  // silhouette is the MASK over a pastel diffraction ramp and the iridescent
  // texture, screen-blended, and a second radial mask pools the light around
  // the cursor — so the heart sits printed in its metal at rest and lights
  // up as the pointer nears, the same way the tiled sigils do. Mirrors the
  // [data-bg-foil="motif"] .tc-bg-holo rule in TradingCard.jsx.
  sigil: {
    // The six angles a diffraction grating throws — TradingCard's --sun-1..6.
    sun: [
      "hsl(2, 100%, 73%)",
      "hsl(53, 100%, 69%)",
      "hsl(93, 100%, 69%)",
      "hsl(176, 100%, 76%)",
      "hsl(228, 100%, 74%)",
      "hsl(283, 100%, 73%)",
    ],
    texture: "/TCG/foils/rl80-iri.webp",
    // What the mark is at rest. "metal": printed in the tier's gold, the
    // foil pooling over it. "ghost": no metal at all — a watermark-weight
    // heart in the parchment, exactly like a body sigil, that only exists
    // once the light finds it. `ghost` is the watermark's own tone and depth.
    base: "ghost",
    // Warm, so the watermark reads as printed into the parchment rather
    // than as a greyed-out icon — the fill is a sienna the paper already
    // has in it, and the edge carries more of the shape than the fill does.
    ghost: { fill: "#5a3a12", opacity: 0.12, rim: "#fff6dc", rimOpacity: 0.7, shadow: 0.12 },
    // The pool, in favicon viewBox units (the mark is 72 wide, so one unit
    // is about 0.6px on a full-size card). `radius` is where the light
    // reaches zero; `core` the fraction of it that is fully lit; `mid` the
    // opacity at half radius. Matches the body's 6% / 38%:.4 / 74% pool
    // scaled down so the mark can still be half-lit when the cursor is on
    // its edge.
    pool: { radius: 560, core: 0.07, mid: 0.4 },
    // Brightness and strength, each `rest` at centre and `rest + lift` at
    // the card's edge — the body uses .34 + .34·hyp and .42 + .45·lift.
    brightness: { rest: 0.5, lift: 0.4 },
    strength: { rest: 0.55, lift: 0.4 },
    contrast: 1.35,
    saturate: 1.25,
    // How far the ramp slides with the pointer, in mark widths (the body's
    // 220% ramp travels 1.2 of its box). Rotation per degree of tilt too.
    slide: 1.2,
    spin: 2,
    // Ramp period in mark widths. The body's ramp is 2.2 cards long, which
    // on a 6%-wide mark would be a single flat hue; ~0.9 puts two or three
    // bands across the heart so it reads as iridescent, not tinted.
    period: 0.9,
    // Screen over saturated gold goes yellow — the body's sigils sit on pale
    // parchment, which is why they go pastel. This is a normal-blend pass of
    // the ramp laid under the screen pass, inside the same pool, which does
    // the parchment's job: it lifts the metal toward the ramp's own hue.
    tint: 0.55,
    // The strike: one hard glint that runs the length of the arrow, and only
    // while the card's Y tilt passes through `angle` ± `window` degrees —
    // the one flash the mark has, found by tilting, never repeating on its
    // own. `angle` sits a little off centre so a card at rest never shows
    // it. `width` is the glint's length as a share of the arrow.
    strike: { angle: 3, window: 1.6, width: 0.14, color: "#ffffff", peak: 0.95 },
  },

  currency: {
    // The mirror. Several light/dark stops rather than two, because chrome
    // reflects a striped room, not a smooth sky; the whole ramp rotates and
    // slides with the tilt so the stock itself visibly moves.
    silver: ["#f9f9fd", "#c4c7d3", "#63667a", "#dcdee7", "#7f8292", "#eeeff4", "#9a9dad"],

    // The sweeping band: one pass of the spectrum, hard-edged, crossing the
    // patch diagonally. `sweep` is its strength over the silver.
    sweep: 0.6,
    // Half-width of the band, in % of the patch. ±11 is a stripe; ±17 floods.
    sweepWidth: 11,
    // Half-width of the lit annulus on each ring set, as a fraction of the
    // set's radius. Narrow lights a few rings at a time and the light
    // visibly travels outward; wide floods the field and it stops pulsing.
    band: 0.15,

    // Engraved rings, centred on the heart, in the favicon's own path
    // units (the mark is about 50 wide). `engrave` is how dark the cut
    // reads when unlit, so the grating is there at rest too.
    rings: { centre: [221.6, 70.5], from: 2.2, to: 38, step: 2.4, width: 0.72, engrave: 0.2 },
    // A second rosette, off-centre and at a different pitch — two rulings
    // that beat against each other is what makes guilloché, and the moiré
    // shifts as the two lit annuli move in opposite directions.
    rosette: { centre: [229.5, 63.5], from: 3, to: 34, step: 3.1, width: 0.5, engrave: 0.1, opacity: 0.62 },

    // The latent image: the denomination, invisible straight on and
    // resolving as the card tilts right — banknote style.
    latent: { text: "80", size: 24, y: 83 },
    // Microtext on a circle, brightest when the card tilts left.
    microtext: { text: "RL80 · OUR LADY OF PERPETUAL PROFIT · RL80 · OUR LADY OF PERPETUAL PROFIT · ", size: 3.6, radius: 18 },
    font: "Georgia, 'Times New Roman', serif",
  },
};

export const RCANA_RARITIES = {
  Common: { label: "COMMON", ink: "#6b5a38", foil: 0, heart: "red" },
  Uncommon: { label: "UNCOMMON", ink: "#3f7a58", foil: 0.15, heart: "red" },
  Rare: { label: "RARE", ink: "#2f6391", foil: 0.4, heart: "gold" },
  Mythic: { label: "MYTHIC", ink: "#8a4ea8", foil: 0.7, heart: "gold" },
  Relic: { label: "RELIC", ink: "#a8741b", foil: 1, heart: "gold" },
};

export const RARITY_ORDER = ["Common", "Uncommon", "Rare", "Mythic", "Relic"];

// ---------------------------------------------------------------------------
// Slot geometry
// ---------------------------------------------------------------------------
// Measured off LOTERIA_FRAME2 (1024x1422), as percentages of the card box, so
// they survive a re-export at any resolution. The bench's "Slot outlines"
// toggle paints these as labelled rectangles over the frame.
export const RCANA_LAYOUT = {
  // Number and class, in the gold tab. The frame prints the tab and its
  // divider rule; both cells are empty, so both are drawn.
  numberTab: { x: 4.28, y: 3.05, w: 30.68, h: 6.3 },
  numberCell: { x: 4.39, y: 3.31, w: 7.04, h: 6.04 },
  classCell: { x: 11.62, y: 3.31, w: 23.15, h: 6.04 },

  // The opening's BOUNDING BOX. Layers behind the frame are clipped to this:
  // they are only ever seen through the hole, so clipping there costs nothing
  // and guarantees their edges can never swing outside the card on tilt.
  window: { x: 4.48, y: 3.16, w: 90.85, h: 65.1 },

  // The opening as it actually reads across the middle of the card. The bbox
  // above only reaches 68.57% beside the banner's pointed tails; through the
  // centre the frame closes at 62.9%. An FX sheet sits in FRONT of the frame,
  // so clipped to the bbox it draws a hard horizontal cut across the banner —
  // it uses this, with a feathered bottom, instead.
  fxWindow: { x: 4.48, y: 3.16, w: 90.85, h: 59.48 },

  // The black ribbon's flat field, measured between the innermost gold
  // ornaments (which end at 21.58% and resume at 78.03%). The slot used to
  // run 19-81%, wider than the clear field, so a long name could have run
  // under the flourishes before AutoFit stepped in.
  nameBanner: { x: 21.6, y: 64.14, w: 56.4, h: 7.8 },

  // Parchment between the ribbon's tails and the stat boxes. The ribbon's
  // pointed tails hang to 78.09% out at the sides and the stat boxes now
  // close in at 87.01%, so the band that is clear across the full width is
  // 78.09%-86.87%. The panel starts above that, at 75.8%: the first line is
  // the centred quote, which never reaches the width the tails occupy.
  // Width stays at 7-93%: the tails pinch to 7.21% at y=78%, so widening
  // into the parchment's full 4.48-95.6% would put the panel's own edge
  // inside a tail.
  //
  // `h` is the CONTENT height: .rc-body adds 1.6% padding, and a vertical
  // padding percentage resolves against the WIDTH, so each edge adds
  // 1.6 * RCANA_ASPECT = 1.15% of the card's height. Text therefore runs
  // from 76.95% to 76.95% + h, and has to stop above the boxes at 87.01%,
  // which caps h at 10.06. The previous 10.4 ran 1.15% INTO the stat boxes,
  // where the frame — one depth rung ahead of the ink — simply cut the last
  // line in half. Against the old boxes the honest cap was 9.25%, so the
  // smaller boxes are worth about 9% more text.
  bodyPanel: { x: 7.0, y: 75.8, w: 86.0, h: 10.0 },

  // Bottom strip, re-measured against the boxes as redrawn smaller again.
  // Each box prints a glyph, a divider rule, then an empty value cell — only
  // the value cell is drawn. Measured on the FILL, not the black border, the
  // same way the previous pass was, so the numbers compare directly: both
  // boxes lost about 2.7% of width and 0.6% of height, and their shared top
  // dropped from 86.71% to 87.60%, which is what the body panel gains.
  // Their dividers still sit at different fractions — 64.2% of the halo box
  // against 56.2% of the hydro — so each cell is measured, not reflected.
  haloBox: { x: 10.61, y: 87.6, w: 18.21, h: 7.3 },
  hydroBox: { x: 71.86, y: 87.6, w: 18.11, h: 7.3 },
  // The numeral areas, measured off each plate's divider and box edge at the
  // strip's centre line (y 90.5%), so a value sits dead centre of its half.
  //   halo plate   left box: divider 22.3% → edge 29.0% (the divider sits
  //                further right than the value plate's; the halo is wider)
  //   value plate  left box: divider 20.8% → edge 29.3%
  //   both         drop box: divider 82.4% → edge 90.3%
  haloValue: { x: 22.3, y: 87.6, w: 6.7, h: 7.3 },
  haloValueValued: { x: 20.8, y: 87.6, w: 8.5, h: 7.3 },
  hydroValue: { x: 82.4, y: 87.6, w: 7.9, h: 7.3 },

  // Rarity mark, in the one clear band the footer leaves: under the RL80
  // wordmark, between the flourish tips, above the bottom border. Measured
  // across the full 33-67% the band is only 93.3%-96.7%, but the flourishes
  // are what close it in at the sides — directly under the mark, at 44-56%,
  // it runs 92.63% to 96.77%. The mark is 5.8% of the card wide, so that
  // narrower reading is the one that governs, and the slot sits high in it:
  // the heart lands 92.79%-96.25%, clear of the border by 0.59% instead of
  // the 0.14% it had when it was centred on the wider band.
  rarity: { x: 33.0, y: 92.72, w: 34.0, h: 3.6 },
};

// ---------------------------------------------------------------------------
// Depth
// ---------------------------------------------------------------------------
// Depths are in px against the stage perspective. Negative is further from
// the viewer. Every layer is counter-scaled so that at rest it measures
// exactly one card — depth only shows when the card tilts. The one exception
// is the breakout, which keeps its magnification on purpose.
//
// The floor is not arbitrary. An art layer is inset by 2.4% and the frame's
// printed border covers that margin; past roughly -120 the layer's own edge
// drifts out from under the border at the top of the window, where the cover
// is thinnest. DEPTH_FLOOR is where that happens.
export const RCANA_DEPTHS = {
  perspective: 1600,
  plate: 44, // frame + ink, together
};

// Max tilt, in degrees. Exported because the clipping maths below depends on
// it: every margin on this card scales with how far it can turn.
export const MAX_TILT = { ry: 8, rx: 8 };

const REF_W = 744; // the width depths are quoted against
const REF_H = REF_W / RCANA_ASPECT;
// How far one px of depth moves a layer, as a percentage of the card.
const SHIFT_X = (Math.sin((MAX_TILT.ry * Math.PI) / 180) / REF_W) * 100;
const SHIFT_Y = (Math.sin((MAX_TILT.rx * Math.PI) / 180) / REF_H) * 100;
// Where the frame's own silhouette starts, measured off LOTERIA_FRAME2.
const SILHOUETTE = { x: 0.1, y: 0.21 };

// A behind-frame layer is clipped to the opening, and that clip sits at the
// layer's depth while the opening sits at the frame's — so on tilt the two
// slide past each other by (|z| + plate) and the clip's edge drifts into
// view. `behindClip` gives the box that bleed, so the edge stays hidden
// under the border however far the card turns.
export function behindClip(z) {
  const reach = (Math.abs(z) + RCANA_DEPTHS.plate);
  const bx = reach * SHIFT_X;
  const by = reach * SHIFT_Y;
  const w = RCANA_LAYOUT.window;
  return { x: w.x - bx, y: w.y - by, w: w.w + 2 * bx, h: w.h + 2 * by };
}

// How far back a layer may sit. Derived, not guessed. Bleeding the clip
// outward to hide its inner edge pushes its OUTER edge toward the card's
// rim, and that same edge also swings with the tilt, so both demands come
// out of one budget:
//
//     (2|z| + plate) * SHIFT  <=  window edge - silhouette
//
// At 10 degrees of yaw with the scene at -68 the two sides are equal to the
// decimal, which is why the clip edge showed as a hairline rather than a
// gap. MARGIN is what keeps it off that knife edge.
const MARGIN = { x: 0.6, y: 0.5 };
const depthBudget = (available, shift, margin) =>
  Math.floor((((available - margin) / shift) - RCANA_DEPTHS.plate) / 2);

export const DEPTH_FLOOR = -Math.min(
  depthBudget(RCANA_LAYOUT.window.x - SILHOUETTE.x, SHIFT_X, MARGIN.x),
  depthBudget(RCANA_LAYOUT.window.y - SILHOUETTE.y, SHIFT_Y, MARGIN.y)
);

// The ceiling has the opposite cause. A plane in front of the frame has
// nothing covering its drift, so pushed too far it visibly unsticks from the
// card it is meant to be sitting on.
export const FX_CEILING = 130;

// ---------------------------------------------------------------------------
// Art spec + registry
// ---------------------------------------------------------------------------
// The depth rungs, FX options, flame light and frame fallbacks live in
// artSpec.js (no imports, so art files can use them without a cycle), and
// each card's art lives in art/<id>.js, collected by art/index.js. Both are
// re-exported here so every existing importer keeps its path.
export * from "./artSpec.js";
export { RCANA_ART } from "./art/index.js";
import {
  ART_PLANES, FX_PLANES, DEFAULT_FRAME, CLASS_FRAME, PLATES, TYPE_BADGE,
  FX_BLEND_DEFAULT, FX_CLIP_DEFAULT, FX_CLEAR_PAD, FX_CLEAR_FEATHER,
} from "./artSpec.js";
import { RCANA_ART } from "./art/index.js";


// The set itself lives in set/ (designs + faces, merged by set/index.js).
// RCANA_DEMO is the old name for it, kept for the bench and anything else
// that still imports it.
export { RCANA_SET, RCANA_SET as RCANA_DEMO, UNPRINTED, TYPE_CLASS } from "./set/index.js";

// ---------------------------------------------------------------------------
// Converter
// ---------------------------------------------------------------------------
// Engine card -> face shape. Mirrors toTemplateCard()/toLoteriaCard() so the
// three card paths read the same from a page's point of view.
export function toRcanaCard(card, overrides = {}) {
  if (!card) return null;
  const art = RCANA_ART[card.id] || {};
  const cls = card.cardClass || card.class || RCANA_CLASSES.TRADER;
  const layers = art.layers || [];

  return {
    id: card.id,
    number: card.number ?? null,
    cardClass: cls,
    subClass: card.subClass ?? null,
    cost: card.cost ?? null,
    // The coin in the tab: a Trader's hire cost (its boxes hold Grace and income).
    tabCost: card.tabCost ?? null,
    name: card.name,
    rarity: card.rarity || "Common",

    // Ink
    ability: card.ability ?? null,
    flavor: card.flavor ?? null,
    // A person's line is quoted and leads; narration follows the rules.
    flavorQuoted: card.flavorQuoted ?? SPEAKING_CLASSES.includes(cls),
    halo: card.halo ?? card.grace ?? null,
    hydro: card.hydro ?? card.liquidity ?? null,

    // An opaque floor. Art layers carry real transparency, so without this
    // the page shows through wherever the art does not paint.
    backdrop: art.backdrop ?? null,

    // An art file may pin a frame; otherwise the plate follows the type.
    plate: card.plate || "boxed",
    frameImage: art.frame || PLATES[card.plate || "boxed"] || CLASS_FRAME[cls] || DEFAULT_FRAME,
    // The type seal, on sealed plates only (it stands where the halo box was).
    badgeImage: card.plate === "sealed" ? TYPE_BADGE[card.type] || null : null,
    // "combined" means the figure is inside the frame image, not that the
    // card has no depth: such a card still takes the planes behind it.
    combinedPlate: !!art.combinedPlate,

    // Far to near, each resolved to an explicit depth. Authoring order is the
    // stacking order, so a card reads top-down the way its art was built.
    artLayers: layers.map((l, i) => ({
      id: l.id || `layer-${i}`,
      src: l.src || artPath(card.id, l.id || `layer-${i}`),
      scale: l.scale ?? 1.06,
      offset: { x: 0, y: 0, ...l.offset },
      // Optional CSS filter for the layer. `blur` is a shorthand: a number in
      // thousandths of the card width, so blur: 4 is 3px on a 744px card and
      // stays the same softness on a thumbnail or a 4K print.
      filter: l.filter || (l.blur ? `blur(calc(var(--u) * ${l.blur / 1000}))` : null),
      // Clamped at both ends: too far back and the layer's edge drifts out
      // from under the border, too far forward and it unsticks from the card.
      z: Math.min(
        FX_CEILING,
        Math.max(DEPTH_FLOOR, l.z ?? ART_PLANES[l.id] ?? ART_PLANES.scene)
      ),
    })),

    // Nearest to the viewer, drawn over the frame and the ink alike.
    fxLayers: (art.fx || []).map((l, i) => ({
      id: l.id || `fx-${i}`,
      src: l.src || artPath(card.id, `fx-${l.id || i}`),
      blend: l.blend || FX_BLEND_DEFAULT,
      clip: l.clip || FX_CLIP_DEFAULT,
      reflection: l.reflection || null,
      // Resolved to boxes here so the renderer never looks up slots. Each
      // entry is a slot name, or { slot, pad, feather } to tune one hole.
      clear: (l.clear || [])
        .map((c) => {
          const spec = typeof c === "string" ? { slot: c } : c;
          const box = RCANA_LAYOUT[spec.slot];
          if (!box) return null;
          const pad = spec.pad ?? FX_CLEAR_PAD;
          return {
            x: box.x - pad,
            y: box.y - pad,
            w: box.w + pad * 2,
            h: box.h + pad * 2,
            feather: spec.feather ?? FX_CLEAR_FEATHER,
          };
        })
        .filter(Boolean),
      opacity: l.opacity ?? 1,
      scale: l.scale ?? 1,
      z: Math.min(FX_CEILING, l.z ?? FX_PLANES[l.id] ?? FX_PLANES.near),
    })),

    // Which slots the frame already carries. A per-card frame bakes the name
    // and tab in; a shared class frame leaves them to the ink layer.
    printed: card.printed || {},

    ...overrides,
  };
}
