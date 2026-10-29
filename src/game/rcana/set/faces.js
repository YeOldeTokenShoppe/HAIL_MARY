// R-cana — the PRINTED side of each card: what the face shows that the game
// design does not define. One entry per card in the set.
//
//   id       slug for the face and its art (src/game/rcana/art/<id>.js,
//            public/TCG/rcana/<id>/). Not the design key — "diablito" is the
//            game's name for the card, "el-diablito" the card's own.
//   design   key into designs.js (e.g. "bull") — never the card's name. Type,
//            cost and rules text come from there unless overridden here.
//            The printed name comes from the design too (`printName`).
//   number   the card's lotería number, unique across the set.
//   rarity   Common | Uncommon | Rare | Mythic (RARITY_ORDER).
//   halo / hydro   the two boxes, filled from the design by type: a Trader's
//            Grace and LIQ; an Asset's Prosperity and Liquidity on sale; a
//            called Event's Prosperity. Others print blank. Set them only to
//            override deliberately. Cost prints in the tab automatically.
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
    // halo/hydro come from the design (cred 10 / liq 2); set them here only
    // to print something other than what the game plays.
    // Condensed: the old line carried its own flavour ("the devil keeps the
    // spread either way"), which is the quote's job now.
    ability: "When your offer is refused, take 1 Hydro from the bank.",
    // In his own voice, since a Trader's line is printed as a quotation.
    flavor: "I never lie about the price. Only about the cost.",
    // LOTERIA_FRAME2 prints no text at all — tab cells and banner both come
    // out empty — so every ink slot is live.
    printed: {},
  },
  {
    id: "el-toro",
    design: "bull", // prints as "El Toro" — the design's printName
    // PROVISIONAL number and rarity — set deliberately before the set grows.
    number: 11,
    rarity: "Common",
    // The design has no rules text of its own (it is a flat 100 Prosperity),
    // so the printed line is written here. Progress cards narrate rather
    // than speak, so the flavor follows the rule.
    ability: "Bank 100 Prosperity.",
    flavor: "Up and to the right, and nothing in its way.",
    printed: {},
  },
  {
    id: "el-monje",
    design: "monje",
    // PROVISIONAL number and rarity.
    number: 12,
    rarity: "Uncommon",
    // Printed in the face's own vocabulary (Hydro = Liquidity).
    ability: "When you light a candle, bank 25 Prosperity.",
    // A Trader speaks; the line prints as a quotation and leads the panel.
    flavor: "The Lord provides. I merely set the rate.",
    printed: {},
  },
  {
    id: "el-oso",
    design: "bear",
    // PROVISIONAL number and rarity.
    number: 13,
    rarity: "Uncommon",
    // A Hazard narrates (the line follows the rule).
    ability: "Until cleared, the target banks at most 75 from a single card.",
    flavor: "The market only ever remembers one direction.",
    printed: {},
  },
  {
    id: "tech-stock",
    design: "tech",
    // PROVISIONAL number and rarity.
    number: 14,
    rarity: "Common",
    // An Asset's line says what it sells for; the boxes print value (100)
    // and cost (3), so the text carries the cash option.
    ability: "Sell for 5 Hydro, or bank 100 Prosperity.",
    flavor: "It only goes up, until the day it does not.",
    printed: {},
  },
  {
    id: "abuela",
    design: "abuela",
    // PROVISIONAL number and rarity.
    number: 15,
    rarity: "Rare",
    ability: "Your gambles moon on 4+ instead of 5+.",
    // A Trader speaks; prints as a quotation and leads the panel.
    flavor: "I have buried two husbands and a bear market, mijo.",
    printed: {},
  },
  {
    id: "tortilla",
    design: "tortilla",
    // PROVISIONAL number and rarity.
    number: 16,
    rarity: "Rare",
    ability: "Clear any one hazard.",
    // A Remedy narrates; the line follows the rule.
    flavor: "She appeared at breakfast. The spread closed by noon.",
    printed: {},
  },
  {
    id: "la-campana",
    design: "bell",
    // PROVISIONAL number and rarity.
    number: 17,
    rarity: "Uncommon",
    ability: "Clear Bear Market.",
    flavor: "When it rings, the bear goes back to the hills.",
    printed: {},
  },
  {
    id: "rosario",
    design: "rosary",
    // PROVISIONAL number and rarity.
    number: 18,
    rarity: "Uncommon",
    ability: "When you light a candle, draw a card.",
    flavor: "A prayer for every bead. An answer in every hand.",
    printed: {},
  },
  {
    id: "la-calavera",
    design: "skull",
    // PROVISIONAL number and rarity.
    number: 19,
    rarity: "Uncommon",
    ability: "Whenever a rival sells an Asset, collect 1 Hydro.",
    flavor: "Even the dead take their cut.",
    printed: {},
  },
];
