// R-cana — the set's designs. THE single source of truth for what each card
// does: key, name, type, cost, and its game stats and text.
//
// Lifted verbatim from the Playtest 2 table (public/playtest2/table.html),
// whose build source (src/game/playtest2/) was never committed — until that
// build is restored, this file is the master and the table's inline copy is
// a duplicate to be replaced by an import. The card FACES (number, rarity,
// flavour, art) live beside this in faces.js and the art/ folder; nothing
// printed on a card should restate what is defined here.
//
// Types: trader, asset, event, hazard, remedy, artifact, grace.
// A Trader's hire cost EQUALS their LIQ (income): the card prints one number.
// (An Event with `played: true` is called from the hand instead of firing on draw.)
//
// `printName` is what the CARD prints when it differs from the engine's name.
// The rule: lotería names for FIGURES, devotional objects and classic lotería
// The rule is by ROW: things you hold are lotería — Traders, Artifacts,
// Remedies, Graces (El Monje, La Máquina, La Campana, El Exvoto); the market
// is English — Assets, Events, Hazards (Blue Chip, Bull Run, Rug Pull). Two
// deliberate exception keeps its lotería name: El Naranja (he is a figure).
// Faces never carry a name.

// ── The twenty-four designs of the shared starter ──
// Players are symmetric: nobody IS a character. The Traders are cards in the deck,
// lotería style — you hire one as your main action, and only one sits at your desk.
const D = (key, name, type, cost, o = {}) => ({ key, name, type, cost, ...o });
export const DESIGNS = [
  D('unicornio', 'El Unicornio', 'trader', 3, { liq: 3, cred: 20, text: 'Pure compounding — the best paycheck at the desk' }),
  D('gato', 'El Gato', 'trader', 2, { liq: 2, cred: 16, text: 'When seated, immediately knock one hazard off your table, free' }),
  D('monje', 'El Monje', 'trader', 1, { liq: 1, cred: 22, text: 'When you light a candle, bank 25 Prosperity' }),
  D('diablito', 'El Diablito', 'trader', 2, { liq: 2, cred: 10, text: 'When a hazard you play lands, collect 1 Liquidity' }),
  D('celebridad', 'La Estrella', 'trader', 3, { liq: 3, cred: 8, text: 'The influencer: pay 1 when banking from a card, +25 Prosperity' }),
  D('abuela', 'La Abuela', 'trader', 2, { liq: 2, cred: 18, text: 'The gambling grandmother: your gambles moon on 4+ instead of 5+' }),
  D('pope', 'El Papa', 'trader', 3, { liq: 3, cred: 25, text: 'Once a game, a failed Hail Mary is absolved — you may attempt it again' }),
  D('prospector', 'El Gambusino', 'trader', 2, { liq: 2, cred: 15, text: 'Assets you buy cost 1 less' }),
  // Unseen hands, now a Trader you hire rather than weather that blows through.
  D('illuminati', 'El Ojo', 'trader', 3, { liq: 3, cred: 12, text: 'When hired, each rival passes you one random card' }),
  D('tech', 'Tech Stock', 'asset', 3, { cash: 5, pros: 100 }),
  // The degen asset, and the only gamble: sell safe for cash, or roll the die for
  // Prosperity. (Was two cards — Meme Coin's body with Shitcoin's upside.)
  D('meme', 'Meme Coin', 'asset', 2, { cash: 4, pros: 125, gamble: true, text: 'Sell for Prosperity: a die decides — 5+ moons for 125, else zero' }),
  // Collectibles — the flip that pays in standing more than in cash.
  D('collectibles', 'Collectibles', 'asset', 3, { cash: 5, pros: 125 }),
  // The safe haven: pays in cash, not in standing.
  D('gold', 'Gold', 'asset', 3, { cash: 6, pros: 75 }),
  // Slow and safe: the one pile The Bear cannot cap.
  D('realestate', 'Real Estate', 'asset', 5, { cash: 8, pros: 150, bearProof: true, text: 'While held, immune to The Bear' }),
  // The old Moneda's job — a trickle of income — on a coin that holds its value.
  D('stablecoin', 'Stablecoin', 'asset', 2, { cash: 3, pros: 50, income: 1, text: 'While held: collect 1 Liquidity at the start of your turn' }),
  D('bluechip', 'Blue Chip', 'asset', 6, { cash: 10, pros: 250 }),
  // Events you CALL: played from the hand for their cost, banked on the spot —
  // where the other Events fire the moment they are drawn. `played` is the flag.
  D('bull', 'Bull Run', 'event', 2, { pros: 100, played: true }),
  D('rocket', 'Rocket', 'event', 4, { pros: 200, played: true }),
  D('moon', 'Full Moon', 'event', 4, { pros: 150, played: true }),
  D('inherit', 'The Inheritance', 'event', 0, { cash: 3, pros: 50, choice: true, played: true }),
  D('bear', 'Bear Market', 'hazard', 2, { text: 'Bank at most 75 Prosperity from a single card' }),
  D('hack', 'Quantum Hack', 'hazard', 2, { text: 'Trader ability disabled' }),
  D('rug', 'Rug Pull', 'hazard', 3, { text: 'Cannot sell Assets' }),
  D('taxman', 'Tax Collector', 'hazard', 2, { text: 'Pay 1 to the bank at the start of each turn' }),
  D('escandalo', 'Scandal', 'hazard', 2, { text: 'Scandal: the seated Trader loses 5 Grace when it breaks, 2 more each turn' }),
  D('naranja', 'El Naranja', 'hazard', 3, { text: 'The Orange One takes his cut: whenever the target banks, the hazard’s owner collects 2' }),
  D('scam', 'Exit Scam', 'hazard', 3, { text: 'The target cannot play the Events they call (The Bull, Rocket, Full Moon, The Inheritance) until cleared' }),
  D('bell', 'The Bell', 'remedy', 1, { clears: 'bear', printName: 'La Campana' }),
  D('resist', 'Quantum Resistance', 'remedy', 1, { clears: 'hack', printName: 'La Resistencia' }),
  D('keys', 'The Keys', 'remedy', 1, { clears: 'rug', printName: 'Las Llaves' }),
  D('tortilla', 'Miracle Tortilla', 'remedy', 2, { clears: 'any', printName: 'La Tortilla' }),
  D('publicista', 'El Publicista', 'remedy', 1, { clears: 'escandalo', text: 'Clear a Scandal — or polish: your seated Trader regains 5 Grace' }),
  D('heart', 'Sacred Heart', 'artifact', 2, { text: 'A shield, not a cure: discard to cancel a hazard as it lands', printName: 'El Corazón' }),
  D('halo', 'The Halo', 'artifact', 3, { text: 'Any Trader seated at your desk cannot be disabled', printName: 'La Aureola' }),
  D('rosary', 'The Rosary Beads', 'artifact', 2, { text: 'When you light a candle, draw a card', printName: 'El Rosario' }),
  D('grail', 'The Grail', 'artifact', 3, { text: 'An answered Hail Mary banks 300 instead of 200', printName: 'El Cáliz' }),
  D('enigma', 'Enigma Machine', 'artifact', 2, { text: 'Once a turn: discard up to 3 cards and draw that many', printName: 'La Máquina' }),
  // Exit liquidity, held rather than fired: the Skull's owner is the one every
  // seller pays.
  D('skull', 'The Skull', 'artifact', 2, { text: 'Whenever a rival sells an Asset, collect 1 Liquidity', printName: 'La Calavera' }),
  // The relic that raises the dead: one disgrace, undone.
  D('shroud', 'The Shroud', 'artifact', 2, { text: 'When your seated Trader would be disgraced, discard the Shroud instead: they stay, with 5 Grace', printName: 'El Sudario' }),
  D('ofrenda', 'La Ofrenda', 'grace', 0, { text: 'Offer this card to Our Lady: it goes to the shrine and lights a candle' }),
  D('cherub', 'The Votive', 'grace', 1, { text: 'To the shrine: light a candle, then draw a card', printName: 'El Exvoto' }),
  // Coins in the water: not a candle (the shrine holds three) but a better roll.
  // Absolution: a candle, and the slate wiped clean.
  D('confession', 'The Confession', 'grace', 1, { text: 'To the shrine: light a candle, and your seated Trader’s Grace is restored in full', printName: 'La Confesión' }),
  D('fountain', 'The Fountain', 'grace', 2, { text: 'Toss in 2 Liquidity: your Hail Mary odds rise one step, even past the shrine’s three', printName: 'La Fuente' }),
  D('rose', 'The Rose', 'grace', 0, { pros: 50, cash: 2, text: 'Offer it to a rival: if they accept, they keep it (worth 50 Prosperity) and you light a candle — your Hail Mary odds rise', printName: 'La Rosa' }),
  D('moneda', 'Pay Day', 'event', 0, { text: 'Every player collects 2 Liquidity' }),
  // Yield farming: fat income until the market moves and wipes it.
  D('jardin', 'Yield Farm', 'asset', 4, { cash: 2, pros: 50, income: 2, text: 'While held: collect 2 a turn — but it dies the moment any Event fires' }),
  // Hail Mary Prospecting Co. — three claims:
  // the map leads somewhere (cards), the mine pays the longer you dig, the well is a wildcat.
  D('map', 'Treasure Map', 'asset', 2, { cash: 2, pros: 75, text: 'When sold, draw 2 cards' }),
  D('mine', 'The Mine', 'asset', 4, { cash: 4, pros: 75, grow: 25, text: 'Each round held, worth 25 more Prosperity' }),
  D('oil', 'Oil Field Claim', 'asset', 3, { cash: 3, pros: 175, gamble: true, gambleOn: 3, bust: 25, text: 'Sell for Prosperity: a die decides — 3+ gushes for 175, else it runs dry for 25' }),
  D('semilla', 'Seed Round', 'asset', 1, { cash: 1, pros: 25, bloom: 150, text: 'Sell for 25 Prosperity — or hold four rounds and it blooms to 150' }),
  // Events: the market's own voice. They fire the moment they are drawn, hit the whole
  // table, then the drawer draws a replacement card. Nobody chooses an Event.
  D('crash', 'Flash Crash', 'event', 0, { text: 'Everyone holding 8+ Liquidity loses half' }),
  D('ballena', 'The Whale', 'event', 0, { text: 'The whale surfaces: the richest portfolio’s best Asset moves to the poorest player' }),
  D('rueda', 'The Wheel', 'event', 0, { text: 'Every portfolio rotates one seat' }),
  D('godcandle', 'The God Candle', 'event', 0, { text: 'Until the drawer’s next turn, Prosperity sales pay double' }),

  D('world', 'The World', 'event', 0, { text: 'Every standing effect ends, and everyone draws a card' }),

  D('moralhazard', 'Moral Hazard', 'event', 0, { text: 'The bailout: the poorest player collects 5; the richest loses 2' }),
];

export const DESIGN_TYPES = ["trader", "asset", "event", "hazard", "remedy", "artifact", "grace"];
export const designByKey = Object.fromEntries(DESIGNS.map((d) => [d.key, d]));
