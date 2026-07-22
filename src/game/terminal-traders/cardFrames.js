// Frame + FX overlay compositor sources.
//
// Frames are rarity signals, one tier per frame (2026-07-20):
//   common + uncommon → grey. The foil tier does the separation between them
//     (subtle vs the uncommon flourish), so they share a frame on purpose.
//   rare             → silver-etched, pairs with the `v` foil.
//   mythic           → gold, pairs with `hero`.
//   terminal-foil    → rainbow. RESERVED for the set's three terminal foils
//     (genesis-terminal, our-lady-rl80, terminal-foil-moment) — the rainbow
//     frame IS the rainbow-rare signal, so it must never appear on a lower
//     tier or the signal is worthless.
//
// NOTE: the silver-etched file is named frame_mythic_no_badge_transparent —
// that is the asset pack's name, not this set's tier. Confirmed silver → rare.
const FRAME_DIR = "/TCG/frames";

// `metaTop` is where the card's EDITION/STYLE/RARITY/SET line is pinned so it
// lands inside the frame's printed divider slot. Each frame draws that slot at
// a slightly different height — gold sits ~0.75% lower than the other three —
// so this is per-frame data, not one constant. Values are the slot centre less
// half the meta row's height; re-derive by scanning the asset for full-width
// ink bands between 50% and 95% of height if a frame is ever re-exported.
export const FRAMES = [
  { id: "grey", label: "Grey", src: `${FRAME_DIR}/frame_grey.webp`, metaTop: "86.55%" },
  { id: "silver", label: "Silver", src: `${FRAME_DIR}/frame_mythic_no_badge_transparent.webp`, metaTop: "86.45%" },
  { id: "gold", label: "Gold", src: `${FRAME_DIR}/frame_gold.webp`, metaTop: "87.35%" },
  { id: "rainbow", label: "Rainbow", src: `${FRAME_DIR}/frame_rainbow.webp`, metaTop: "86.6%" },
];

const FRAME_SRC = Object.fromEntries(FRAMES.map((f) => [f.id, f.src]));

export function metaTopForFrame(src) {
  return FRAMES.find((f) => f.src === src)?.metaTop || "86.6%";
}

export const FRAME_ID_BY_RARITY = {
  "common": "grey",
  "uncommon": "grey",
  "rare": "silver",
  "mythic": "gold",
  "terminal-foil": "rainbow",
};

export function frameForRarity(rarity) {
  return FRAME_SRC[FRAME_ID_BY_RARITY[rarity]] || null;
}

// FX overlays stack over the art AND the frame. Max 3 at once — past that
// they stop reading as distinct effects and just fog the card.
export const MAX_FX = 3;

const FX_DIR = "/TCG/fx-overlays";
const fx = (file, label, group) => ({ id: file, label, group, src: `${FX_DIR}/${file}` });

export const FX_OVERLAYS = [
  fx("fx-thunder-1-1488.webp", "Thunder 1", "thunder"),
  fx("fx-thunder-2-1488.webp", "Thunder 2", "thunder"),
  fx("fx-thunder-3-1488.webp", "Thunder 3", "thunder"),
  fx("fx-thunder-4-1488.webp", "Thunder 4", "thunder"),
  fx("fx-rainbow-1-1488.webp", "Rainbow 1", "rainbow"),
  fx("fx-rainbow-3-1488.webp", "Rainbow 3", "rainbow"),
  fx("fx-rainbow-4-1488.webp", "Rainbow 4", "rainbow"),
  fx("fx-abstract-5-1488.webp", "Abstract 5", "abstract"),
  fx("fx-abstract-7-1488.webp", "Abstract 7", "abstract"),
  fx("fx-abstract-10-1488.webp", "Abstract 10", "abstract"),
  fx("fx-abstract-11-1488.webp", "Abstract 11", "abstract"),
  fx("fx-abstract-16-1488.webp", "Abstract 16", "abstract"),
  fx("fx-sparkle-2-1488.webp", "Sparkle", "accent"),
  fx("fx-flame-1_1488.webp", "Flame", "accent"),
  fx("fx-rock-1-1488.webp", "Rock", "accent"),
  fx("fx-dark-1-1488.webp", "Dark", "accent"),
];

// screen/plus-lighter suit the glow-on-dark art; normal is there for the
// opaque-ish ones (rock, dark) that are meant to sit ON the card, not in it.
export const FX_BLEND_MODES = ["screen", "plus-lighter", "overlay", "soft-light", "normal"];

// FX sit ON the art at normal blend / full opacity by default (2026-07-21):
// the overlays carry their own alpha, so they composite as painted. A card
// opts into a lighter glow-blend (screen / plus-lighter) per entry in CARD_ART
// only where the effect is meant to read *through* the art rather than over it.
export const FX_BLEND_DEFAULT = "normal";
export const FX_OPACITY_DEFAULT = 1.0;

// Cards wire their FX by label ("Thunder 2"), not by filename, so CARD_ART
// reads like the picker in /card-template. Ids stay accepted so a raw
// filename still resolves.
const FX_BY_KEY = Object.fromEntries(
  FX_OVERLAYS.flatMap((f) => [
    [f.id, f],
    [f.label.toLowerCase(), f],
  ])
);

export function fxSrc(nameOrId) {
  if (!nameOrId) return null;
  const hit = FX_BY_KEY[String(nameOrId).trim().toLowerCase()] || FX_BY_KEY[nameOrId];
  return hit?.src || null;
}

// Unknown names drop out rather than rendering a 404 layer — a typo in
// CARD_ART should cost the effect, not break the card.
export function fxSources(list) {
  if (!list) return [];
  return (Array.isArray(list) ? list : [list])
    .map(fxSrc)
    .filter(Boolean)
    .slice(0, MAX_FX);
}
