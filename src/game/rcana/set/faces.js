// R-cana — the PRINTED side of each card: what the face shows that the game
// design does not define. One entry per card in the set.
//
//   id       slug for the face and its art (src/game/rcana/art/<id>.js,
//            public/TCG/rcana/<id>/). Not the design key — "diablito" is the
//            game's name for the card, "el-diablito" the card's own.
//   design   key into designs.js. Name, type, cost and rules text come from
//            there unless overridden here.
//   number   the card's lotería number, unique across the set.
//   rarity   Common | Uncommon | Rare | Mythic | Relic (RARITY_ORDER).
//   halo     printed Grace; hydro printed Liquidity (POINT_TYPES). Both are
//            explicit here for now — the mapping from the design's liq/cred
//            onto the two printed boxes is still a design call, see README.
//   ability  the rules line as printed. Defaults to the design's text, but a
//            printed line is usually shorter than a simulator's.
//   flavor   the character's line (quoted, leading) or narration (following).
//   printed  slots the frame image already prints, so the face leaves blank.
export const FACES = [
  {
    id: "el-diablito",
    design: "diablito",
    number: 7,
    rarity: "Mythic",
    halo: 2,
    hydro: 6,
    // Condensed: the old line carried its own flavour ("the devil keeps the
    // spread either way"), which is the quote's job now.
    ability: "When your offer is refused, take 1 Hydro from the bank.",
    // In his own voice, since a Trader's line is printed as a quotation.
    flavor: "I never lie about the price. Only about the cost.",
    // LOTERIA_FRAME2 prints no text at all — tab cells and banner both come
    // out empty — so every ink slot is live.
    printed: {},
  },
];
