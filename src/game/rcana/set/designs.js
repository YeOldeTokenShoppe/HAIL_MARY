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
// Types: trader, asset, progress, event, hazard, remedy, artifact, grace.

// ── The twenty-four designs of the shared starter ──
// Players are symmetric: nobody IS a character. The Traders are cards in the deck,
// lotería style — you hire one as your main action, and only one sits at your desk.
const D = (key, name, type, cost, o = {}) => ({ key, name, type, cost, ...o });
export const DESIGNS = [
  D('unicornio', 'El Unicornio', 'trader', 3, { liq: 3, cred: 20, text: 'Pure compounding — the best paycheck at the desk' }),
  D('gato', 'El Gato', 'trader', 2, { liq: 2, cred: 16, text: 'When seated, immediately knock one hazard off your table, free' }),
  D('monje', 'El Monje', 'trader', 1, { liq: 1, cred: 22, text: 'When you light a candle, collect 2 Liquidity' }),
  D('diablito', 'El Diablito', 'trader', 2, { liq: 2, cred: 10, text: 'When a hazard you play lands, collect 1 Liquidity' }),
  D('celebridad', 'La Estrella', 'trader', 3, { liq: 2, cred: 8, text: 'The influencer: pay 1 when banking from a card, +25 Prosperity' }),
  D('gr80', 'St. GR80', 'trader', 2, { liq: 1, cred: 25, text: 'When you light a candle, bank 25 Prosperity' }),
  D('h80z', 'H80Z', 'trader', 2, { liq: 2, cred: 10, text: 'Hazards you play cost 1 less' }),
  D('eugene', 'Eugene', 'trader', 2, { liq: 1, cred: 14, text: 'Your Hail Mary odds rise one step' }),
  D('abuela', 'La Abuela', 'trader', 2, { liq: 2, cred: 18, text: 'The gambling grandmother: your gambles moon on 4+ instead of 5+' }),
  D('pope', 'The Pope', 'trader', 3, { liq: 1, cred: 25, text: 'Once a game, a failed Hail Mary is absolved — you may attempt it again' }),
  D('prospector', 'The Prospector', 'trader', 2, { liq: 2, cred: 15, text: 'Assets you buy cost 1 less' }),
  D('tech', 'Tech Stock', 'asset', 3, { cash: 5, pros: 100 }),
  D('meme', 'Meme Coin', 'asset', 2, { cash: 4, pros: 75 }),
  D('moon', 'The Moon', 'asset', 4, { cash: 7, pros: 150 }),
  D('shitcoin', 'Shitcoin', 'asset', 1, { cash: 1, pros: 125, gamble: true, text: 'Sell for Prosperity: a die decides — 5+ moons for 125, else zero' }),
  D('bluechip', 'Blue Chip', 'asset', 6, { cash: 10, pros: 250 }),
  D('bull', 'The Bull', 'progress', 2, { pros: 100 }),
  D('rocket', 'Rocket', 'progress', 4, { pros: 200 }),
  D('inherit', 'The Inheritance', 'progress', 0, { cash: 3, pros: 50, choice: true }),
  D('bear', 'The Bear', 'hazard', 2, { text: 'Bank at most 75 Prosperity from a single card' }),
  D('hack', 'Quantum Hack', 'hazard', 2, { text: 'Trader ability disabled' }),
  D('rug', 'Rug Pull', 'hazard', 3, { text: 'Cannot sell Assets' }),
  D('sirena', 'La Sirena', 'hazard', 3, { text: 'The seated Trader walks into the sea; no new hires until cleared' }),
  D('taxman', 'Tax Collector', 'hazard', 2, { text: 'Pay 1 to the bank at the start of each turn' }),
  D('snake', 'The Snake', 'hazard', 3, { text: 'The serpent at the shrine: your candles count as zero' }),
  D('escandalo', 'El Escándalo', 'hazard', 2, { text: 'Scandal: the seated Trader loses 5 Grace when it breaks, 2 more each turn' }),
  D('naranja', 'El Naranja', 'hazard', 3, { text: 'The Orange One takes his cut: whenever the target banks, the hazard’s owner collects 2' }),
  D('bell', 'The Bell', 'remedy', 1, { clears: 'bear' }),
  D('resist', 'Quantum Resistance', 'remedy', 1, { clears: 'hack' }),
  D('keys', 'The Keys', 'remedy', 1, { clears: 'rug' }),
  D('tortilla', 'Miracle Tortilla', 'remedy', 2, { clears: 'any' }),
  D('publicista', 'El Publicista', 'remedy', 1, { clears: 'escandalo', text: 'Clear a Scandal — or polish: your seated Trader regains 5 Grace' }),
  D('heart', 'Sacred Heart', 'artifact', 2, { text: 'A shield, not a cure: discard to cancel a hazard as it lands' }),
  D('halo', 'The Halo', 'artifact', 3, { text: 'Any Trader seated at your desk cannot be disabled' }),
  D('xray', 'X-Ray Glasses', 'artifact', 2, { text: 'Once a turn, study a rival’s entire hand' }),
  D('rosary', 'The Rosary Beads', 'artifact', 2, { text: 'When you light a candle, draw a card' }),
  D('grail', 'The Grail', 'artifact', 3, { text: 'An answered Hail Mary banks 300 instead of 200' }),
  D('enigma', 'Enigma Machine', 'artifact', 2, { text: 'Your hand cannot be peeked' }),
  D('ofrenda', 'La Ofrenda', 'grace', 0, { text: 'Offer this card to Our Lady: it goes to the shrine and lights a candle' }),
  D('cherub', 'Raphael’s Cherub', 'grace', 1, { text: 'To the shrine: light a candle, then draw a card' }),
  D('rose', 'The Rose', 'grace', 0, { pros: 50, cash: 2, text: 'Offer it to a rival: if they accept, they keep it (worth 50 Prosperity) and you light a candle — your Hail Mary odds rise' }),
  D('moneda', 'La Moneda', 'asset', 3, { cash: 3, pros: 50, income: 1, text: 'While held: collect 1 Liquidity at the start of your turn' }),
  D('jardin', 'El Jardín', 'asset', 4, { cash: 2, pros: 50, income: 2, text: 'While held: collect 2 a turn — but it dies the moment any Event fires' }),
  D('semilla', 'La Semilla', 'asset', 1, { cash: 1, pros: 25, bloom: 150, text: 'Sell for 25 Prosperity — or hold four rounds and it blooms to 150' }),
  // Events: the market's own voice. They fire the moment they are drawn, hit the whole
  // table, then the drawer draws a replacement card. Nobody chooses an Event.
  D('halving', 'El Halving', 'event', 0, { text: 'Until the drawer’s next turn, turn income is 1' }),
  D('corrida', 'La Corrida', 'event', 0, { text: 'Until the drawer’s next turn, Assets sold for Prosperity pay +25' }),
  D('crash', 'Flash Crash', 'event', 0, { text: 'Everyone holding 8+ Liquidity loses half' }),
  D('airdrop', 'The Airdrop', 'event', 0, { text: 'Every player draws a card' }),
  D('honeymoon', 'Honeymoon', 'event', 0, { text: 'Until the drawer’s next turn, no hazards can be played' }),
  D('ballena', 'La Ballena', 'event', 0, { text: 'The whale surfaces: the richest portfolio’s best Asset moves to the poorest player' }),
  D('rueda', 'La Rueda', 'event', 0, { text: 'Every portfolio rotates one seat' }),
  D('godcandle', 'The God Candle', 'event', 0, { text: 'Until the drawer’s next turn, Prosperity sales pay double' }),
  D('skull', 'The Skull', 'event', 0, { text: 'Exit liquidity: the biggest seller collects 5; everyone else pays 2' }),
  D('world', 'The World', 'event', 0, { text: 'Every standing effect ends, and everyone draws a card' }),
  D('illuminati', 'The Illuminati', 'event', 0, { text: 'Unseen hands: every player passes one random card to the left' }),
  D('moralhazard', 'Moral Hazard', 'event', 0, { text: 'The bailout: the poorest player collects 5; the richest loses 2' }),
];

export const DESIGN_TYPES = ["trader", "asset", "progress", "event", "hazard", "remedy", "artifact", "grace"];
export const designByKey = Object.fromEntries(DESIGNS.map((d) => [d.key, d]));
