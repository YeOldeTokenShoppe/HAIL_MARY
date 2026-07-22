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
//
// ONE STARRING COIN PER ROGUE (2026-07-21). A coin belongs to exactly one
// rogue across every debut/haunt list in this file — co-haunting is reserved
// for MARKET cards, where two rogues sharing a crowd scene is the point. The
// guide had double-booked BlackPalm (Rugula + Forklok) and RugProof (Rugula +
// Vaporina); Forklok's debut art settled BlackPalm, so the pairs are now
// Forklok/BlackPalm, Rugula/RugProof, Vaporina/VaporwareX. Keep it that way:
// a rogue's debut should be the one card that is unmistakably theirs.

export const ROGUES = [
  {
    id: "rugula",
    name: "Rugula",
    pattern: null, // patron rogue — the rug-pull itself
    signatureColor: "#c71585", // red-violet
    status: "debuted",
    debutCardId: "rug-warning",
    // RugProof is his starring coin (the debut card itself is an Action).
    // BlackPalm released to Forklok when his debut art landed.
    hauntCardIds: ["rugproof", "rug-harvest"],
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
    status: "debuted",
    debutCardId: "ponzi-siren",
    hauntCardIds: ["volatility-mass"],
  },
  {
    id: "forklok",
    name: "Forklok",
    pattern: "backdoor-fork",
    signatureColor: "#4682b4", // steel blue
    status: "debuted",
    debutCardId: "blackpalm",
    hauntCardIds: ["protocol-exploit"],
  },
  {
    id: "vaporina",
    name: "Vaporina",
    pattern: "slick-but-broken",
    signatureColor: "#f052ff", // iridescent magenta
    status: "debuted",
    debutCardId: "vaporwarex",
    // RugProof released to Rugula (his starring coin); VaporwareX is hers
    // alone. Her second appearance should be a market cameo, not a coin.
    hauntCardIds: [],
  },
  {
    id: "shillbird",
    name: "Shillbird",
    pattern: "celeb-shill",
    signatureColor: "#ff69b4", // hot pink (+ gold)
    status: "debuted",
    debutCardId: "bullish-ink",
    hauntCardIds: ["demon-desk", "influencer-eclipse"],
  },
  {
    id: "gasper",
    name: "Gasper",
    pattern: "hype-fizzle",
    signatureColor: "#7a9e3b", // swamp green
    status: "debuted",
    debutCardId: "goblingas",
    hauntCardIds: ["wick-street", "dead-chain-hour"],
  },
  {
    id: "fomogre",
    name: "Fomogre",
    pattern: "meme-mania",
    signatureColor: "#3fe07a", // candle green (split with red)
    status: "debuted",
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
