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
//            printed line is usually shorter than a simulator's. Use \n at
//            a clause boundary to keep triggers and outcomes easy to scan.
//   abilityName  optional override of a Trader's named ability in designs.js.
//                The inherited name sits beside its centered ABIL80 badge.
//   flavor   the character's line (quoted) or narration, below the rules.
//   printed  slots the frame image already prints, so the face leaves blank.
export const FACES = [
  {
    id: "el-diablito",
    design: "diablito",
    number: 7,
    rarity: "Mythic",
    // halo/hydro come from the design (cred 10 / liq 2); set them here only
    // to print something other than what the game plays.
    // The coin in his art is the wager: income versus his reputation.
    ability: "At turn start, flip a coin.\nHeads: +1 coin · Tails: -1 CRED.",
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
    // Separate the trigger from its payout; the title has its own alignment.
    ability: "When you light a candle,\nbank 25 Prosperity.",
    // A Trader speaks; the quotation follows the rules and flourish.
    flavor: "The Lord provides. I merely set the rate.",
    printed: {},
  },
  {
    id: "el-oso",
    design: "bear",
    // PROVISIONAL number and rarity.
    number: 13,
    rarity: "Uncommon",
    // A Calamity narrates (the line follows the rule).
    ability: "Until cleared, the target banks\nat most 75 from a single card.",
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
    ability: "Sell for 5 coins,\nor bank 100 Prosperity.",
    flavor: "It only goes up, until the day it does not.",
    printed: {},
  },
  {
    id: "abuela",
    design: "abuela",
    // PROVISIONAL number and rarity.
    number: 15,
    rarity: "Rare",
    // Keep the new threshold and the comparison on two balanced lines.
    ability: "Your gambles moon on 4+\ninstead of 5+.",
    // A Trader speaks; the quotation follows the rules and flourish.
    flavor: "I have buried two husbands and a bear market, mijo.",
    printed: {},
  },
  {
    id: "tortilla",
    design: "tortilla",
    // PROVISIONAL number and rarity.
    number: 16,
    rarity: "Rare",
    ability: "Clear any one Calamity.",
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
    ability: "When you light a candle,\ndraw a card.",
    flavor: "A prayer for every bead. An answer in every hand.",
    printed: {},
  },
  {
    id: "la-calavera",
    design: "skull",
    // PROVISIONAL number and rarity.
    number: 19,
    rarity: "Uncommon",
    ability: "Whenever a rival sells an Asset,\ncollect +1 coin.",
    flavor: "Even the dead take their cut.",
    printed: {},
  },
  {
    id: "el-unicornio",
    design: "unicornio",
    // PROVISIONAL number and rarity.
    number: 20,
    rarity: "Rare",
    // halo/hydro come from the design (cred 20 / liq 3). Shorter than the
    // simulator's line; the trigger and the payout on their own lines.
    ability: "At turn start, with 100+ banked Prosperity,\nbank 25 more.",
    // A Trader speaks, so the line prints as a quotation.
    flavor: "I don't chase the market. It compounds while I dance.",
    printed: {},
  },
  {
    id: "el-gato",
    design: "gato",
    // PROVISIONAL number and rarity.
    number: 21,
    rarity: "Uncommon",
    // halo/hydro come from the design (cred 16 / liq 2). The trigger and
    // the outcome on their own lines.
    ability: "When seated, knock one Calamity\noff your table, free.",
    // A Trader speaks, so the line prints as a quotation.
    flavor: "If it's on the table, it's fair game.",
    printed: {},
  },
  {
    id: "meme-coin",
    design: "meme", // prints as "Meme Coin" — the design's name
    // PROVISIONAL number and rarity.
    number: 22,
    rarity: "Common",
    // An Asset's line says what it sells for. The boxes print value (125)
    // and cost (2); the text carries the cash option and the gamble.
    ability: "Sell for 4 coins, or roll:\n5+ banks 125 Prosperity, else zero.",
    // An Asset narrates, so the flavor follows the rule unquoted.
    flavor: "To the moon, or to nothing. Never in between.",
    printed: {},
  },
  {
    id: "la-rosa",
    design: "rose", // prints as "La Rosa" — the design's printName
    // PROVISIONAL number and rarity.
    number: 23,
    rarity: "Uncommon",
    // The offer and its two outcomes; the design's line is a simulator's.
    ability: "Offer it to a rival. If they accept,\nthey keep 50 Prosperity and you light a candle.",
    // A Grace narrates; the line follows the rule.
    flavor: "Given freely, it is worth more than it costs.",
    printed: {},
  },
  {
    id: "the-whale",
    design: "ballena", // prints as "The Whale" — a market force keeps its market name
    // PROVISIONAL number and rarity.
    number: 24,
    rarity: "Rare",
    // An on-draw Event (an Ambiguity: it moves value, and who gains is not
    // known until it fires); the printed line is the effect alone.
    ability: "The richest portfolio's best Asset\nmoves to the poorest player.",
    // An Event narrates; the line follows the rule.
    flavor: "When it surfaces, the whole sea moves.",
    printed: {},
  },
  {
    id: "la-fuente",
    design: "fountain", // prints as "La Fuente" — the design's printName
    // PROVISIONAL number and rarity.
    number: 25,
    rarity: "Uncommon",
    // The toss and what it buys; the design's line is a simulator's.
    ability: "Toss in 2 Liquidity: your Hail Mary\nodds rise one step, past the shrine's three.",
    // A Grace narrates; the line follows the rule.
    flavor: "Every coin sinks. Every wish floats.",
    printed: {},
  },
  {
    id: "la-investigadora",
    design: "investigadora", // prints as "La Investigadora" — the design's name
    // PROVISIONAL number and rarity.
    number: 26,
    rarity: "Uncommon",
    // The peek and the choice; the design's line is a simulator's.
    ability: "Once a turn, peek at the deck's top card.\nYou may send it to the bottom.",
    // A Trader speaks; the quotation follows the rules and flourish.
    flavor: "Everything is in the ledger. I just read it closer than you.",
    printed: {},
  },
  {
    id: "el-gambusino",
    design: "prospector", // prints as "El Gambusino" — the design's name
    // PROVISIONAL number and rarity.
    number: 27,
    rarity: "Uncommon",
    // The design's line is already a card's length; printed as is.
    ability: "Assets you buy cost 1 less.",
    // A Trader speaks; the quotation follows the rules and flourish.
    flavor: "Gold's where you dig, not where they tell you.",
    printed: {},
  },
  {
    id: "the-illumin80",
    design: "illuminati", // prints as "The Illumin80" — the design's name
    // PROVISIONAL number and rarity.
    number: 28,
    rarity: "Rare",
    // The trigger and the take; the design's line is a simulator's.
    ability: "You are initiated.\nEach rival passes you one random card.",
    // An Event narrates; the line follows the rule.
    flavor: "You never see them buy. You only see the price move.",
    printed: {},
  },
  {
    id: "the-celebrity",
    design: "celebridad", // prints as "La Estrella" — the design's name
    // PROVISIONAL number and rarity.
    number: 29,
    rarity: "Uncommon",
    // The fee and the bonus; the design's line is a simulator's.
    ability: "Pay 1 when banking from a card:\n+25 Prosperity.",
    // A Trader speaks; the quotation follows the rules and flourish.
    flavor: "Every eye on me is a dollar in the bank.",
    printed: {},
  },
];
