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
    // `gloss`: the Spanish title in English, for the viewer caption, the
    // binder label and the table's enlarged view. It never prints on the
    // face — lotería names stay in Spanish on the card.
    gloss: "The Little Devil",
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
    gloss: "The Monk",
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
    gloss: "The Grandmother",
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
    gloss: "The Bell",
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
    gloss: "The Rosary",
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
    gloss: "The Skull",
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
    gloss: "The Unicorn",
    // PROVISIONAL number and rarity.
    number: 20,
    rarity: "Rare",
    // halo/hydro come from the design (cred 20 / liq 3). Shorter than the
    // simulator's line; the trigger and the payout on their own lines.
    ability: "In good standing, each unsold Asset counts\ntoward your billion at sale price plus $50M.",
    // A Trader speaks, so the line prints as a quotation.
    flavor: "I don't sell. I tell.",
    printed: {},
  },
  {
    id: "el-gato",
    design: "gato",
    gloss: "The Cat",
    // PROVISIONAL number and rarity.
    number: 21,
    rarity: "Uncommon",
    // halo/hydro come from the design (cred 16 / liq 2). The trigger and
    // the outcome on their own lines.
    ability: "When seated, and each turn on a\nroll of 4+, knock one Calamity\noff your table.",
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
    gloss: "The Rose",
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
    gloss: "The Fountain",
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
    gloss: "The Investigator",
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
    gloss: "The Prospector",
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
    design: "celebridad", // prints as "La Influencer" — the design's print name (was La Celebridad until 2026-11-12)
    gloss: "The Influencer",
    // PROVISIONAL number and rarity.
    number: 29,
    rarity: "Uncommon",
    // The fee and the bonus; the design's line is a simulator's.
    ability: "Pay 1 when banking from a card:\n+25 Prosperity.",
    // A Trader speaks; the quotation follows the rules and flourish.
    flavor: "Every eye on me is a dollar in the bank.",
    printed: {},
  },
  {
    id: "collectibles", // the art id: the velvet case of graded cards in the vault
    design: "grail", // prints as "The Holy Grail" — the design's name
    // PROVISIONAL number and rarity. The collector's grail: the one card
    // you chase. Number inherited from the retired El Cáliz Relic.
    number: 68,
    rarity: "Rare",
    // An Asset's line says what it sells for; the boxes print value (100)
    // and cost (3), so the text carries the cash option and the gem price.
    ability: "Sell for 5 coins, or bank 100 —\n250 while three candles burn.",
    // An Asset narrates, so the flavor follows the rule unquoted.
    flavor: "Worth exactly what the next buyer says it is.",
    printed: {},
  },
  {
    id: "the-mine",
    design: "mine", // prints as "The Mine" — the design's name
    // PROVISIONAL number and rarity. (Inherited from Gold, whose art this is.)
    number: 31,
    rarity: "Common",
    // An Asset's line says what it sells for; the boxes print value (75)
    // and cost (4), so the text carries the cash option and the growth.
    ability: "Sell for 4 coins, or bank 75 Prosperity.\nEach round held: worth 25 more.",
    // An Asset narrates, so the flavor follows the rule unquoted.
    flavor: "Nobody strikes the mother lode on the first day.",
    printed: {},
  },
  {
    id: "real-estate",
    design: "realestate", // prints as "Real Estate" — the design's name
    // PROVISIONAL number and rarity.
    number: 32,
    rarity: "Rare",
    // An Asset's line says what it sells for; the boxes print value (150)
    // and cost (5), so the text carries the cash option and the bear-proofing.
    ability: "Sell for 8 coins, or bank 150 Prosperity.\nBear Market cannot cap it.",
    // An Asset narrates, so the flavor follows the rule unquoted.
    flavor: "They are not making any more of it.",
    printed: {},
  },
  {
    id: "treasure-map",
    design: "map", // prints as "El Mapa" — the design's printName
    // PROVISIONAL number and rarity.
    number: 33,
    rarity: "Uncommon",
    // A Relic: held, never sold. The box prints its cost (2).
    ability: "X marks the spot:\nwhenever you sell an Asset,\ndraw a card.",
    flavor: "Untold riches. Approximate directions.",
    printed: {},
  },
  {
    id: "oil-field",
    design: "oil", // prints as "Oil Field Claim" — the design's name
    // PROVISIONAL number and rarity.
    number: 34,
    rarity: "Rare",
    // An Asset's line says what it sells for. The boxes print value (175)
    // and cost (3); the text carries the cash option and the gamble.
    ability: "Sell for 3 coins, or roll:\n3+ gushes 175 Prosperity, else 25.",
    // An Asset narrates, so the flavor follows the rule unquoted.
    flavor: "Every dry hole was a sure thing on paper.",
    printed: {},
  },
  {
    id: "ride-or-die",
    design: "rideordie", // prints as "The Lowrider" — the design's name
    // PROVISIONAL number and rarity.
    number: 35,
    rarity: "Rare",
    // An Asset since 2026-11-15: the boxes print value (100) and cost (3);
    // the caption painted on the car opens the rules line.
    ability: "Ride or die: your Assets stay with you.\nThe Whale and The Wheel pass you by.",
    flavor: "Nobody gets out of the car.",
    printed: {},
  },
  {
    id: "tax-collector",
    design: "taxman", // prints as "Tax Collector" — the design's name
    // PROVISIONAL number and rarity.
    number: 36,
    rarity: "Uncommon",
    // A Calamity narrates (the line follows the rule).
    ability: "Until cleared, the target pays 1\nto the bank at the start of each turn.",
    flavor: "He always finds the door. He never knocks.",
    printed: {},
  },
  {
    id: "seed-round",
    design: "semilla", // prints as "Seed Round" — the design's name
    // PROVISIONAL number and rarity.
    number: 37,
    rarity: "Common",
    // A called Event you plant: the boxes print value (150) and cost (1);
    // the text carries the wait.
    ability: "Plant it: four rounds on,\nit blooms — bank 150.",
    flavor: "Everything that blooms was buried first.",
    printed: {},
  },
  {
    id: "flash-crash",
    design: "crash", // prints as "Flash Crash" — the design's name
    // PROVISIONAL number and rarity.
    number: 38,
    rarity: "Uncommon",
    // A Calamity narrates (the line follows the rule).
    ability: "Everyone holding 8 or more Liquidity\nloses half of it.",
    flavor: "The bottom is wherever the last bid was.",
    printed: {},
  },
  {
    id: "rug-pull",
    design: "rug", // prints as "Rug Pull" — the design's name
    // PROVISIONAL number and rarity.
    number: 39,
    rarity: "Uncommon",
    // A Calamity narrates (the line follows the rule).
    ability: "Your rival discards the Asset\nthey bought most recently.",
    flavor: "Nobody checks who is holding the other end.",
    printed: {},
  },
  {
    id: "quantum-hack",
    design: "hack", // prints as "Quantum Hack" — the design's name
    // PROVISIONAL number and rarity.
    number: 40,
    rarity: "Uncommon",
    // A Calamity narrates (the line follows the rule).
    ability: "Take $40M from your rival.",
    flavor: "The lock held. The math did not.",
    printed: {},
  },
  {
    id: "mardi-gras",
    design: "mardigras", // prints as "Mardi Gras" — the design's name
    // PROVISIONAL number and rarity.
    number: 41,
    rarity: "Uncommon",
    // The throws, then Ash Wednesday; the design's line is a simulator's.
    ability: "Everyone rolls and collects that much.\nNext turn their Trader repents half, in CRED.",
    // An Event narrates; the line follows the rule.
    flavor: "Party now. Repent later.",
    printed: {},
  },
  {
    id: "la-horchata",
    design: "horchata", // prints as "La Horchata" — the design's printName
    gloss: "The Rice Drink",
    // PROVISIONAL number and rarity.
    number: 42,
    rarity: "Common",
    // The refresh; the design's line is a simulator's.
    ability: "Discard up to 2 cards,\nthen draw that many plus one.",
    // A Remedy narrates; the line follows the rule.
    flavor: "Time for something refreshing.",
    printed: {},
  },
  {
    id: "stablecoin",
    design: "stablecoin", // prints as "Stablecoin" — the design's name
    // PROVISIONAL number and rarity.
    number: 43,
    rarity: "Common",
    // An Asset's line says what it sells for. The boxes print value (50)
    // and cost (2); the text carries the cash option and the yield.
    ability: "Sell for 3 coins, or bank 50 Prosperity.\nWhile held: collect 1 Liquidity each turn.",
    // An Asset narrates, so the flavor follows the rule unquoted.
    flavor: "It never moons. It never has to.",
    printed: {},
  },
  {
    id: "yield-farm",
    design: "jardin", // prints as "Yield Farm" — the design's name
    // PROVISIONAL number and rarity.
    number: 44,
    rarity: "Uncommon",
    // An Asset's line says what it sells for. The boxes print value (50)
    // and cost (4); the text carries the cash option, the yield and the
    // catch — the design discards it when any Event fires on draw.
    ability: "Sell for 2 coins, or bank 50 Prosperity.\nCollect 2 Liquidity a turn; an Event discards it.",
    // An Asset narrates, so the flavor follows the rule unquoted.
    flavor: "Fat harvests, right up until the weather turns.",
    printed: {},
  },
  {
    id: "blue-chip",
    design: "bluechip", // prints as "Blue Chip" — the design's name
    // PROVISIONAL number and rarity.
    number: 45,
    rarity: "Rare",
    // An Asset's line says what it sells for. The boxes print value (250)
    // and cost (6); the text carries the cash option. No yield — it just
    // holds.
    ability: "Sell for 10 coins, or bank 250 Prosperity.",
    // An Asset narrates, so the flavor follows the rule unquoted.
    flavor: "It was here before you. It will be here after.",
    printed: {},
  },
  {
    id: "scandal",
    design: "escandalo", // prints as "Scandal" — the design's name
    // PROVISIONAL number and rarity.
    number: 46,
    rarity: "Uncommon",
    // A Calamity narrates (the line follows the rule). The design: the seated
    // Trader loses 5 Credibility when it breaks, then 2 more each turn until cleared.
    ability: "Until cleared, the seated Trader\nloses 5 Credibility now, then 2 each turn.",
    flavor: "The ink was dry before the story was.",
    printed: {},
  },
  {
    id: "exit-scam",
    design: "scam", // prints as "Exit Scam" — the design's name
    // PROVISIONAL number and rarity.
    number: 47,
    rarity: "Uncommon",
    // A Calamity narrates (the line follows the rule). A one-time hit since 2026-11-20.
    ability: "Your rival loses $75M.",
    flavor: "The sign says closed. The money says gone.",
    printed: {},
  },
  {
    id: "tech-wreck",
    design: "techwreck", // prints as "Tech Wreck" — the design's name
    // PROVISIONAL number and rarity.
    number: 48,
    rarity: "Uncommon",
    // A Calamity narrates (the line follows the rule). The design: every Tech
    // Stock on the table, whoever holds it, is scrapped for 1 Liquidity.
    ability: "Every Tech Stock on the table is wrecked:\nits holder scraps it for 1 Liquidity.",
    flavor: "The next big thing is a pile by the road.",
    printed: {},
  },
  {
    id: "full-moon",
    design: "moon", // prints as "Full Moon" — the design's name
    // PROVISIONAL number and rarity.
    number: 49,
    rarity: "Uncommon",
    // The design has no rules text of its own (it is a flat 150 Prosperity,
    // played from the hand), so the printed line is written here.
    ability: "Bank 150 Prosperity.",
    // An Event narrates; the line follows the rule.
    flavor: "Held close enough, any coin is the moon.",
    printed: {},
  },
  {
    id: "holy-roller",
    design: "holyroller", // prints as "The Holy Roller" — the design's name
    // Number per set/numbers.js; rarity PROVISIONAL (Common until tiers are set).
    number: 52,
    rarity: "Common",
    // An on-draw Event; the design's line is a simulator's, so the printed
    // one is written here.
    ability: "She rolls through: every player\ndraws a card and collects 1 Liquidity.",
    // An Event narrates; the line follows the rule.
    flavor: "She stops for nobody and leaves nobody out.",
    printed: {},
  },
  {
    id: "virtual-mary",
    design: "virtual", // prints as "The Virtual Mary" — the design's name
    // Number per set/numbers.js; rarity PROVISIONAL (Common until tiers are set).
    number: 54,
    rarity: "Common",
    // An on-draw Event (an Ambiguity: it reshuffles every hand, and whether
    // that helps is not known until it fires); the printed line is the
    // effect alone.
    ability: "Every player shuffles their hand\ninto their deck and draws that many.",
    // An Event narrates; the line follows the rule.
    flavor: "Every screen shows her. None of them agree.",
    printed: {},
  },
  {
    id: "fire-horse",
    design: "fuego", // prints as "Nuestra Señora del Fuego" — the design's name
    gloss: "Our Lady on Fire",
    // Number per set/numbers.js; rarity PROVISIONAL (Common until tiers are set).
    number: 53,
    rarity: "Common",
    // An on-draw Event; the design's line is a simulator's, so the printed
    // one is written here.
    ability: "She rides the fire horse through the market:\nevery player banks 75 Prosperity.",
    // An Event narrates; the line follows the rule.
    flavor: "Everything she rides through catches.",
    printed: {},
  },
  {
    id: "anima-sola",
    design: "anima", // prints as "Ánima Sola" — the design's name
    gloss: "The Lonely Soul",
    // Number per set/numbers.js; rarity PROVISIONAL (Common until tiers are set).
    number: 79,
    rarity: "Common",
    // The candle and who it brings back; the design's line is a simulator's.
    ability: "Light a candle. A discredited Trader\nreturns from your discard with 5 Credibility.",
    // A Grace narrates; the line follows the rule.
    flavor: "No one is left in the fire for good.",
    printed: {},
  },
  {
    id: "enigma-machine",
    design: "enigma", // prints as "El Enigma" — the design's printName
    gloss: "The Enigma",
    // Number per set/numbers.js; rarity PROVISIONAL (Common until tiers are set).
    number: 69,
    rarity: "Common",
    // A Relic equips; the printed line is the intercept, shorter than the
    // design's simulator line.
    ability: "Discard it when an Event fires on your draw:\nthat Event is cancelled for everyone.",
    // A Relic narrates; the line follows the rule.
    flavor: "Every message was read. Not one was received.",
    printed: {},
  },
  {
    id: "byzantine-general",
    design: "general", // prints as "El General" — the design's printName
    gloss: "The General",
    // Number per set/numbers.js; rarity PROVISIONAL (Common until tiers are set).
    number: 1,
    rarity: "Common",
    // Equanimity 3 is his stat; the ability rewards the fail.
    ability: "When a Calamity fails against\nyour Equanimity, collect 1 coin.",
    // A Trader speaks; the quotation follows the rules and flourish.
    flavor: "Two of my generals say no. Then it is no.",
    printed: {},
  },
  {
    id: "octobot",
    design: "bot", // prints as "El Octobot" — the design's printName
    gloss: "The Octobot",
    // Number per set/numbers.js; rarity PROVISIONAL (Common until tiers are set).
    number: 2,
    rarity: "Common",
    // Eight Arms (2026-11-20): a second action, a sale; and still no prayers.
    ability: "After your main action, you may also\nbuy or sell one Asset. It cannot pray.",
    // A Trader speaks; the quotation follows the rules and flourish.
    flavor: "I do not pray. I execute.",
    printed: {},
  },
  {
    id: "el-gallo",
    design: "gallo", // prints as "El Gallo" — the design's name
    gloss: "The Rooster",
    // Number per set/numbers.js; rarity PROVISIONAL (Common until tiers are set).
    number: 81,
    rarity: "Common",
    // An Asset's line says what it sells for. The boxes print value (75)
    // and cost (2); the text carries the cash option and the fight.
    ability: "Sell for 2 coins, or bank 75 Prosperity.\nEach turn, roll: a 6 collects 2; a 1 kills him.",
    // An Asset narrates, so the flavor follows the rule unquoted.
    flavor: "He crows every morning. One of them is his last.",
    printed: {},
  },
  {
    id: "la-vaca",
    design: "vaca", // prints as "La Vaca" — the design's name
    gloss: "The Cow",
    // Number per set/numbers.js; rarity PROVISIONAL (Common until tiers are set).
    number: 82,
    rarity: "Common",
    // An Asset's line says what it sells for. The boxes print value (75)
    // and cost (3); the text carries the meat price and the milk.
    ability: "Sell for 6 coins, or bank 75 Prosperity.\nMilk: collect 1 Liquidity each turn.",
    // An Asset narrates, so the flavor follows the rule unquoted.
    flavor: "Milk her every morning, or sell her once.",
    printed: {},
  },
  {
    id: "el-aguacate",
    design: "aguacate", // prints as "El Aguacate" — the design's name
    gloss: "The Avocado",
    // Number per set/numbers.js; rarity PROVISIONAL (Common until tiers are set).
    number: 83,
    rarity: "Common",
    // An Asset's line says what it sells for. The boxes print value (50)
    // and cost (3); the text carries the cash option and the ripening —
    // 50 green, 150 on the second round held, then 50 less each round.
    ability: "Sell for 2 coins, or bank 50 Prosperity.\nRipe on round two: 150. Then 50 less a round.",
    // An Asset narrates, so the flavor follows the rule unquoted.
    flavor: "There is one perfect day. It is never today.",
    printed: {},
  },
  {
    id: "la-cava",
    design: "cava", // prints as "La Cava" — the design's name
    gloss: "The Cellar",
    // Number per set/numbers.js; rarity PROVISIONAL (Common until tiers are set).
    number: 3,
    rarity: "Common",
    // An Asset's line says what it sells for. The boxes print value (50)
    // and cost (3); the text carries the cash option, the vintage's growth
    // and the uncorking (discard it to light a candle).
    ability: "Sell for 3 coins, or bank 50 Prosperity.\nWorth 25 more a round. Uncork: light a candle.",
    // An Asset narrates, so the flavor follows the rule unquoted.
    flavor: "It gets better every year you do not open it.",
    printed: {},
  },
  {
    id: "la-plata",
    design: "plata", // prints as "La Plata" — the design's name
    gloss: "The Silver",
    // Number per set/numbers.js; rarity PROVISIONAL (Common until tiers are set).
    number: 85,
    rarity: "Common",
    // An Asset's line says what it sells for. The boxes print value (125)
    // and cost (3); the text carries the cash option and the flight to
    // safety.
    ability: "Sell for 3 coins, or bank 125 Prosperity.\nIn a Flash Crash you lose nothing and bank 25.",
    // An Asset narrates, so the flavor follows the rule unquoted.
    flavor: "When everything else falls, it only gets heavier.",
    printed: {},
  },
  {
    id: "savings-bond",
    design: "bono", // prints as "The Savings Bond" — the design's name
    // Number per set/numbers.js; rarity PROVISIONAL (Common until tiers are set).
    number: 84,
    rarity: "Common",
    // An Asset's line says what it sells for. The boxes print value (25)
    // and cost (2); the text carries the cash option, the growth and the
    // immunity to The Bear.
    ability: "Sell for 2 coins, or bank 25 Prosperity,\n+25 each round held. The Bear cannot touch it.",
    // An Asset narrates, so the flavor follows the rule unquoted.
    flavor: "She bought it the day you were born.",
    printed: {},
  },
  {
    id: "the-perp",
    design: "perp", // prints as "Perpetuals" — the design's name (was The Perp)
    // Number per set/numbers.js; rarity PROVISIONAL (Common until tiers are set).
    number: 86,
    rarity: "Common",
    // An Asset's line says what it sells for. The boxes print value (75)
    // and cost (4); the text carries the cash option, the leverage and the
    // liquidation (a Bear Market played on its holder discards it).
    ability: "Sell for 4 coins, or bank 75 Prosperity.\nLeverage: sells double; the Bear liquidates it.",
    // An Asset narrates, so the flavor follows the rule unquoted.
    flavor: "The ride never stops. The rider sometimes does.",
    printed: {},
  },
  {
    id: "el-tatuaje",
    design: "tattoo", // prints as "El Tatuaje" — the design's printName
    gloss: "The Tattoo",
    // Number per set/numbers.js; rarity PROVISIONAL (Common until tiers are set).
    number: 73,
    rarity: "Common",
    // A Relic equips; the printed line is the design's upkeep heal.
    ability: "Inked devotion: at the start of your turn,\nyour seated Trader regains 1 Credibility.",
    // A Relic narrates; the line follows the rule.
    flavor: "It does not wash off. Neither does she.",
    printed: {},
  },
  {
    id: "short-squeeze",
    design: "squeeze", // prints as "Short Squeeze" — the design's name
    // Number per set/numbers.js; rarity PROVISIONAL (Common until tiers are set).
    number: 9,
    rarity: "Common",
    // A played Event: the boxes print value (100) and cost (3); the text
    // carries the per-Calamity bonus and the immunity to The Bear's cap.
    ability: "Bank 100 Prosperity, +50 for each\nCalamity on you. The Bear cannot cap it.",
    // An Event narrates; the line follows the rule.
    flavor: "Every exit was bought. The only way left is up.",
    printed: {},
  },
  {
    id: "god-candle",
    design: "godcandle", // prints as "The God Candle" — the design's name
    // Number per set/numbers.js; rarity PROVISIONAL (a windfall, so Rare for now).
    number: 57,
    rarity: "Rare",
    // An on-draw Opportunity: it resolves as drawn, then leaves its bonus on
    // the table until the drawer's next turn.
    ability: "Until your next turn,\nevery Prosperity sale pays 100 more.",
    // An Event narrates; the line follows the rule.
    flavor: "One wick, and the whole sky bought in.",
    printed: {},
  },
  {
    id: "lottery-ticket",
    design: "lottery", // prints as "The Lottery Ticket" — the design's name ("El Boleto" in the Lotería edition)
    gloss: "The Ticket",
    // Number per set/numbers.js; rarity PROVISIONAL (Common until tiers are set).
    number: 71,
    rarity: "Common",
    // A Relic equips; the printed line is the design's per-turn scratch.
    ability: "Scratch at the start of each turn: roll.\nA 6 wins 150 Prosperity, and the Ticket is spent.",
    // A Relic narrates; the line follows the rule.
    flavor: "Somebody has to win. Nobody said when.",
    printed: {},
  },
  {
    id: "the-keys",
    design: "keys", // prints as "The Keys" — the design's name ("Las Llaves" in the Lotería edition)
    gloss: "The Keys",
    // Number per set/numbers.js; rarity PROVISIONAL (Uncommon, beside La Campana).
    number: 63,
    rarity: "Uncommon",
    // A Relic since 2026-11-20: self-custody, so the two frauds that take cash cannot be played on you.
    ability: "Quantum Hack and Exit Scam\ncannot be played on you.",
    // A Relic narrates; the line follows the rule. The proverb, answered.
    flavor: "Not your keys, not your coins. These are yours.",
    printed: {},
  },
  {
    id: "the-audit",
    design: "audit", // prints as "The Audit" — the design's name (a market name, no lotería title)
    // Number per set/numbers.js; rarity PROVISIONAL (Uncommon, beside The Keys among the protections).
    number: 87,
    rarity: "Uncommon",
    // A Relic equips; a protection: the one Calamity it wards cannot be played on you.
    ability: "Rug Pull cannot be played on you.",
    // A Relic narrates; the line follows the rule.
    flavor: "She read the fine print. There was no rug.",
    printed: {},
  },
];
