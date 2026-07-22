// The Rogues of the Liminal Terminal — machine-readable villain index.
//
// Transcribed from design_guide.md §"The gallery (one rogue per crooked
// pattern)". Rogues are NOT a card type: their cards live inside the normal
// type groups (Rug Warning is an Action), and this index is a cross-cutting
// view over those same cards — it must never enter the type-count math.
//
// `pattern` is a CASE_PATTERNS id (cards.js); Rugula alone carries null —
// he's the patron rogue of the whole gallery, the rug-pull itself.
// `status` flips "pending" → "debuted" when a rogue's debut art lands; that
// one field change lights up their gallery slot at /card-template.
// `debutCardId` is the card that debuts (or will debut) the rogue — null
// while no coin exists yet for the pattern. `hauntCardIds` are the rogue's
// other canon appearances (coins + market cameos) from the guide's Haunts
// lines; market cameos print last, once the debut look is locked.
// `signatureColor` is the guide's prose color pinned to a hex for the
// silhouette-slot glow — tune freely, the prose name is the canon.

export const ROGUES = [
  {
    id: "rugula",
    name: "Rugula",
    pattern: null, // patron rogue — the rug-pull itself
    signatureColor: "#c71585", // red-violet
    status: "debuted",
    debutCardId: "rug-warning",
    hauntCardIds: ["blackpalm", "rugproof", "rug-harvest"],
  },
  {
    id: "deploydra",
    name: "Deploydra",
    pattern: "serial-deployer",
    signatureColor: "#b6f22e", // toxic lime
    status: "pending",
    debutCardId: null, // waits for a serial-deployer coin
    hauntCardIds: [], // "cameo potential on any new-listing market" — not yet canon
  },
  {
    id: "the-siren",
    name: "The Siren",
    pattern: "yield-mirage",
    signatureColor: "#1fb8a6", // sea-teal (+ gold)
    status: "pending",
    debutCardId: "ponzi-siren",
    hauntCardIds: ["volatility-mass"],
  },
  {
    id: "forklok",
    name: "Forklok",
    pattern: "backdoor-fork",
    signatureColor: "#4682b4", // steel blue
    status: "pending",
    debutCardId: "blackpalm",
    hauntCardIds: ["protocol-exploit"],
  },
  {
    id: "vaporina",
    name: "Vaporina",
    pattern: "slick-but-broken",
    signatureColor: "#f052ff", // iridescent magenta
    status: "pending",
    debutCardId: "vaporwarex",
    hauntCardIds: ["rugproof"],
  },
  {
    id: "shillbird",
    name: "Shillbird",
    pattern: "celeb-shill",
    signatureColor: "#ff69b4", // hot pink (+ gold)
    status: "pending",
    debutCardId: "bullish-ink",
    hauntCardIds: ["demon-desk", "influencer-eclipse"],
  },
  {
    id: "gasper",
    name: "Gasper",
    pattern: "hype-fizzle",
    signatureColor: "#7a9e3b", // swamp green
    status: "pending",
    debutCardId: "goblingas",
    hauntCardIds: ["wick-street", "dead-chain-hour"],
  },
  {
    id: "fomogre",
    name: "Fomogre",
    pattern: "meme-mania",
    signatureColor: "#3fe07a", // candle green (split with red)
    status: "pending",
    debutCardId: "lucky-capsule",
    hauntCardIds: ["meme-season"],
  },
  {
    id: "emissio",
    name: "Emissio",
    pattern: "bad-tokenomics",
    signatureColor: "#8672c8", // waterlogged violet
    status: "pending",
    debutCardId: null, // waits for a bad-tokenomics coin
    hauntCardIds: [],
  },
];

export const ROGUES_BY_ID = Object.fromEntries(ROGUES.map((r) => [r.id, r]));

export function debutedRogueCount() {
  return ROGUES.filter((r) => r.status === "debuted").length;
}
