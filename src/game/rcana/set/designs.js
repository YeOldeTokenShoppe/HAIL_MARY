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
// A Trader's play cost EQUALS their LIQ (income).
// (An Event with `played: true` is called from the hand instead of firing on draw.)
//
// `printName` is what the CARD prints when it differs from the engine's name.
// The rule: lotería names for FIGURES, devotional objects and classic lotería
// The rule is by ROW: things you hold are lotería — Traders, Artifacts,
// Remedies, Graces (El Monje, La Máquina, La Campana, El Exvoto); the market
// is English — Assets, Events, Calamities (Blue Chip, Bull Run, Rug Pull).
// (Ride or Die was once the English exception in the lotería row; since
// 2026-11-15 it is The Lowrider, an Asset, and the words are its caption.) El Naranja,
// the exception the other way, was dropped 2026-11-10.
// Faces never carry a name.

// ── The twenty-four designs of the shared starter ──
// Players inhabit one active Trader at a time. Traders are cards in the deck;
// playing one is a main action, to the active slot or the bench.
const D = (key, name, type, cost, o = {}) => ({ key, name, type, cost, ...o });
export const DESIGNS = [
  // The trinity: every Trader carries LIQUIDITY (liq — income a turn),
  // CREDIBILITY (cred — reputation; Scandal erodes it, candles restore it, at
  // zero the Trader is discredited) and EQUANIMITY (eq — composure: a
  // Calamity played on you fails on a die roll of eq or lower). Three things
  // a real trader should hold onto; printed as three "-ity" words.
  D('unicornio', 'El Unicornio', 'trader', 3, { liq: 3, cred: 20, eq: 1, abilityName: 'Compound Interest', text: 'At turn start, if you have at least 100 banked Prosperity, bank 25 more.' }),
  D('gato', 'El Gato', 'trader', 2, { liq: 2, cred: 16, eq: 1, abilityName: 'Clean Sweep', text: 'When seated, immediately knock one Calamity off your table, free' }),
  // The investigator: she reads the tape before the market does. Before her
  // turn's draw she peeks at the top card and may send it to the bottom —
  // the one Trader who can dodge the weather instead of weathering it.
  D('investigadora', 'La Investigadora', 'trader', 3, { liq: 3, cred: 14, eq: 1, abilityName: 'Due Diligence', text: 'Before you draw, look at the top card of your deck; you may put it on the bottom' }),
  D('monje', 'El Monje', 'trader', 1, { liq: 1, cred: 22, eq: 2, abilityName: 'Vow of Prosperity', text: 'When you light a candle, bank 25 Prosperity' }),
  D('diablito', 'El Diablito', 'trader', 2, { liq: 2, cred: 10, eq: 0, abilityName: 'Devil’s Wager', text: 'At the start of your turn, flip a coin: heads, collect 1 Liquidity; tails, El Diablito loses 1 CRED' }),
  D('celebridad', 'The Influencer', 'trader', 3, { liq: 3, cred: 8, eq: 0, abilityName: 'Star Power', text: 'The influencer: pay 1 when banking from a card, +25 Prosperity', printName: 'La Influencer' }),
  D('abuela', 'La Abuela', 'trader', 2, { liq: 2, cred: 18, eq: 1, abilityName: 'Lucky Streak', text: 'The gambling grandmother: your gambles moon on 4+ instead of 5+' }),
  D('prospector', 'El Gambusino', 'trader', 2, { liq: 2, cred: 15, eq: 1, abilityName: 'Prospector’s Eye', text: 'Assets you buy cost 1 less' }),
  // The Byzantine Generals: a Calamity has to reach consensus before it lands.
  D('general', 'Byzantine General', 'trader', 2, { liq: 2, cred: 14, eq: 3, abilityName: 'Fault Tolerance', text: 'When a Calamity fails against your Equanimity, collect 1 Liquidity', printName: 'El General' }),
  // The trading bot: fat income, no soul. Scandal has nothing to grip; the shrine hears nothing.
  D('bot', 'The Bot', 'trader', 3, { liq: 3, cred: 6, eq: 3, abilityName: 'No Soul', text: 'Scandal cannot touch it. It cannot pray: while it sits, your Graces go unheard', printName: 'El Octobot' }),
  D('tech', 'Tech Stock', 'asset', 3, { cash: 5, pros: 100, tech: true }),
  // The degen asset, and the only gamble: sell safe for cash, or roll the die for
  // Prosperity. (Was two cards — Meme Coin's body with Shitcoin's upside.)
  D('meme', 'Meme Coin', 'asset', 2, { cash: 4, pros: 125, gamble: true, text: 'Sell for Prosperity: a die decides — 5+ moons for 125, else zero' }),
  // Collectibles — the flip that pays in standing more than in cash.
  // Slow and safe: the one pile The Bear cannot cap.
  D('realestate', 'Real Estate', 'asset', 5, { cash: 8, pros: 150, bearProof: true, text: 'While held, immune to The Bear' }),
  // The old Moneda's job — a trickle of income — on a coin that holds its value.
  D('stablecoin', 'Stablecoin', 'asset', 2, { cash: 3, pros: 50, income: 1, text: 'While held: collect 1 Liquidity at the start of your turn' }),
  D('bluechip', 'Blue Chip', 'asset', 6, { cash: 10, pros: 250 }),
  D('grail', 'The Holy Grail', 'asset', 3, { cash: 5, pros: 100, gem: 250, text: 'Gem mint: sells for 100 — or 250 while you hold three lit candles' }),
  D('rideordie', 'The Lowrider', 'asset', 3, { cash: 4, pros: 100, text: 'Ride or die: while the Lowrider is in your portfolio, your Assets stay with you — the Whale and the Wheel pass you by' }),
  D('gallo', 'El Gallo', 'asset', 2, { cash: 2, pros: 75, rooster: true, text: 'The fighting rooster: at the start of your turn, roll — a 6 collects 2; a 1, and he is dead' }),
  D('vaca', 'La Vaca', 'asset', 3, { cash: 6, pros: 75, income: 1, text: 'Milk: collect 1 at the start of your turn — or sell her for meat, 6 Liquidity' }),
  D('aguacate', 'El Aguacate', 'asset', 3, { cash: 2, pros: 50, ripe: true, text: 'Green gold: ripe on the second round, worth 150. Green before, 50 — then it rots, 50 less each round' }),
  D('cava', 'La Cava', 'asset', 3, { cash: 3, pros: 50, grow: 25, uncork: true, text: 'Vintage: worth 25 more each round held — or uncork it: discard to light a candle' }),
  D('bono', 'The Savings Bond', 'asset', 2, { cash: 2, pros: 25, grow: 25, bearProof: true, text: 'Grandmother’s gift: worth 25 more each round held, and immune to The Bear' }),
  D('plata', 'La Plata', 'asset', 3, { cash: 3, pros: 125, silver: true, text: 'Flight to safety: in a Flash Crash you lose nothing, and bank 25' }),
  D('perp', 'The Perp', 'asset', 4, { cash: 4, pros: 75, perp: true, text: 'Leverage: sells for double — but a Bear Market played on you while it is held liquidates it' }),
  // Events you CALL: played from the hand for their cost, banked on the spot —
  // where the other Events fire the moment they are drawn. `played` is the flag.
  D('bull', 'Bull Run', 'event', 2, { pros: 100, played: true }),
  D('moon', 'Full Moon', 'event', 4, { pros: 150, played: true }),
  D('inherit', 'The Inheritance', 'event', 0, { cash: 3, pros: 50, choice: true, played: true }),
  // The two that replaced Rocket (2026-11-10). Called Events that care what is on
  // your table: suffering pays for Devotion, the Degen windfall leaks to the room.
  D('squeeze', 'Short Squeeze', 'event', 3, { pros: 100, perHaz: 50, bearProof: true, played: true, text: 'Bank 100, plus 50 for each Calamity on you. Bear Market cannot cap it' }),
  D('ponzi', 'The Ponzi', 'event', 2, { pros: 0, perRivalAsset: 25, rivalsCollect: 1, played: true, text: 'New money pays the old: bank 25 for every Asset your rivals hold — then every rival collects 1' }),
  D('unlock', 'Token Unlock', 'event', 4, { pros: 200, rivalsCollect: 1, played: true, text: 'Bank 200 — and every rival collects 1 Liquidity' }),
  D('bear', 'Bear Market', 'hazard', 2, { text: 'Bank at most 75 Prosperity from a single card' }),
  D('hack', 'Quantum Hack', 'hazard', 2, { text: 'Trader ability disabled' }),
  // Performative piety: the candles are lit, and count for nothing.
  D('virtue', 'The Virtue Signal', 'hazard', 2, { text: 'Performative piety: their candles count for nothing — Hail Mary odds fall to 1 in 12 until cleared' }),
  // Hellfire: a spiritual lock, not damage. Prayers do not leave hell. (Keeps
  // its Spanish name in the English row by the user's choice, like the apparitions.)
  D('infierno', 'El Infierno', 'hazard', 3, { text: 'Hellfire: they cannot attempt the Hail Mary or offer a Grace until cleared' }),
  D('rug', 'Rug Pull', 'hazard', 3, { text: 'Cannot sell Assets' }),
  D('taxman', 'Tax Collector', 'hazard', 2, { text: 'Pay 1 to the bank at the start of each turn' }),
  D('trap', 'Liquidity Trap', 'hazard', 3, { text: 'Trapped: every Liquidity they collect goes under this card instead. Clear it, and the pile is theirs' }),
  D('escandalo', 'Scandal', 'hazard', 2, { text: 'Scandal: the seated Trader loses 5 Credibility when it breaks, 2 more each turn' }),
  D('scam', 'Exit Scam', 'hazard', 3, { text: 'The target cannot play Opportunity Events until cleared' }),
  D('bell', 'The Bell', 'remedy', 1, { clears: 'bear', printName: 'La Campana' }),
  D('keys', 'The Keys', 'remedy', 1, { clears: 'rug', printName: 'Las Llaves' }),
  D('tortilla', 'Miracle Tortilla', 'remedy', 2, { clears: 'any', printName: 'La Tortilla' }),
  // The thing the publicist hands you, not the man: the Remedies row is objects.
  D('publicista', 'The Press Release', 'remedy', 1, { clears: 'escandalo', savingGrace: 2, text: 'Clear a Scandal — or polish: your seated Trader regains 5 Credibility', printName: 'El Comunicado' }),
  // The refreshment: a Remedy that clears nothing. It replaces itself (the +1),
  // so it is never a dead card — the snack-item shape. The one-shot cousin of
  // the Enigma Machine's old cycle, which now decodes the deck instead.
  D('horchata', 'Horchata', 'remedy', 0, { refresh: 2, text: 'Refresh: discard up to 2 cards, then draw that many plus one', printName: 'La Horchata' }),
  // Stubborn: the Calamity comes off, and goes back where it came from.
  D('burro', 'The Burro', 'remedy', 2, { clears: 'any', bounce: true, text: 'Stubborn: clear one Calamity — and kick it back onto the rival who played it', printName: 'El Burro' }),
  D('heart', 'Sacred Heart', 'artifact', 2, { text: 'A shield, not a cure: discard to cancel a Calamity as it lands', printName: 'El Corazón' }),
  D('halo', 'The Halo', 'artifact', 3, { text: 'Any Trader seated at your desk cannot be disabled', printName: 'La Aureola' }),
  D('rosary', 'The Rosary Beads', 'artifact', 2, { text: 'When you light a candle, draw a card', printName: 'El Rosario' }),
  // Intercepted traffic: the market's message is decoded before it is sent.
  D('enigma', 'Enigma Machine', 'artifact', 2, { text: 'Intercept: when an Event fires on your draw, discard the Machine — the Event is cancelled for everyone', printName: 'El Enigma' }),
  // Exit liquidity, held rather than fired: the Skull's owner is the one every
  // seller pays.
  D('skull', 'The Skull', 'artifact', 2, { text: 'Whenever a rival sells an Asset, collect 1 Liquidity', printName: 'La Calavera' }),
  // The relic that raises the dead: one disgrace, undone.
  D('shroud', 'The Shroud', 'artifact', 2, { savingGrace: 5, text: 'When your seated Trader would be discredited, discard the Shroud instead: they stay, with 5 Credibility', printName: 'El Sudario' }),
  // Loyalty through the dip: the one defence for a PORTFOLIO. The Whale and
  // The Wheel are the only effects that move Assets between players; this
  // holder's stay put. Deliberately no printName (see the row rule above).
  // The kitsch dashboard Virgin: a lucky charm for the road. One bad roll, undone.
  // The scratcher: a Relic slot spent on a long shot that usually pays before the game ends.
  D('lottery', 'The Lottery Ticket', 'artifact', 1, { text: 'Scratch it at the start of each turn: roll the die — a 6 wins 150 Prosperity, and the Ticket is spent', printName: 'El Boleto' }),
  // Ink of devotion: a slow, permanent heal for whoever sits at the desk.
  // Everything aligns: the called Events (Bull Run, Full Moon…) pay a little more.
  D('geometry', 'Sacred Geometry', 'artifact', 2, { text: 'Everything aligns: your called Events bank 25 more', printName: 'La Geometría' }),
  // The board that holds it all: the one card that touches the two-slot limit.
  D('motherboard', 'The Motherboard', 'artifact', 2, { slots: true, text: 'Expansion slots: the board takes no Relic slot, and you may hold a third Relic', printName: 'La Placa Madre' }),
  D('map', 'Treasure Map', 'artifact', 2, { text: 'X marks the spot: whenever you sell an Asset, draw a card', printName: 'El Mapa' }),
  D('tattoo', 'The Tattoo', 'artifact', 2, { text: 'Inked devotion: at the start of your turn, your seated Trader regains 1 Credibility', printName: 'El Tatuaje' }),
  D('dashboard', 'Dashboard Figure', 'artifact', 2, { text: 'Our Lady of the Dashboard: when a die fails you — a gamble that busts, an unanswered Hail Mary — discard her and roll again', printName: 'La Virgencita' }),
  D('ofrenda', 'La Ofrenda', 'grace', 0, { savingGrace: 2, text: 'Offer this card to Our Lady: it goes to the shrine and lights a candle' }),
  // SAVING GRACE N (keyword): discard this from your hand when your seated
  // Trader would be discredited — they stay, with N Credibility. Printed as a line
  // under the card's own text; the engine reads `savingGrace`. It gives a
  // Grace a second life once the shrine's three candles are lit.
  D('cherub', 'The Votive', 'grace', 1, { savingGrace: 3, text: 'To the shrine: light a candle, then draw a card', printName: 'El Exvoto' }),
  // Coins in the water: not a candle (the shrine holds three) but a better roll.
  // Absolution: a candle, and the slate wiped clean.
  // Someone prays on your behalf: a candle, and a Calamity lifted.
  D('limpia', 'La Limpia', 'grace', 2, { savingGrace: 3, text: 'To the shrine: light a candle, and the egg sweeps one Calamity off you' }),
  // The lonely soul in the flames: a discredited Trader comes back from purgatory.
  D('anima', 'Ánima Sola', 'grace', 1, { text: 'To the shrine: light a candle, and a discredited Trader returns from your discard to your bench, with 5 Credibility' }),
  // Her tears fall for the fallen: a plain candle, and the strongest rescue in the hand.
  D('lagrimas', 'Las Lágrimas', 'grace', 1, { savingGrace: 4, text: 'To the shrine: light a candle' }),
  D('confession', 'The Confession', 'grace', 1, { savingGrace: 3, text: 'To the shrine: light a candle, and your seated Trader’s Credibility is restored in full', printName: 'La Confesión' }),
  D('fountain', 'The Fountain', 'grace', 2, { text: 'Toss in 2 Liquidity: your Hail Mary odds rise one step, even past the shrine’s three', printName: 'La Fuente' }),
  D('rose', 'The Rose', 'grace', 0, { pros: 50, cash: 2, text: 'Offer it to a rival: if they accept, they keep it (worth 50 Prosperity) and you light a candle — your Hail Mary odds rise', printName: 'La Rosa' }),
  // Locations — places you build. One stands per player, takes no Relic slot, is never sold.
  D('nacimiento', 'The Nativity Scene', 'location', 2, { text: 'Build it: place a figure at the start of each turn. At the third, the Niño arrives at midnight — light a candle and bank 75, then pack it away', printName: 'El Nacimiento' }),
  D('catedral', 'The Chart Cathedral', 'location', 2, { text: 'Green candles: whenever any player lights a candle, bank 25', printName: 'La Catedral' }),
  D('catacumbas', 'The Catacombs', 'location', 2, { text: 'Buried with honors: at the start of your turn you may bury your seated Trader — bank 5 Prosperity per point of Credibility they have left', printName: 'Las Catacumbas' }),
  D('moneda', 'The Airdrop', 'event', 0, { text: 'Free money falls from the sky: every player collects 2 Liquidity' }),
  // Yield farming: fat income until the market moves and wipes it.
  D('jardin', 'Yield Farm', 'asset', 4, { cash: 2, pros: 50, income: 2, text: 'While held: collect 2 a turn. Discard this Asset when any Event fires on draw' }),
  // Hail Mary Prospecting Co. — three claims:
  // the map leads somewhere (cards), the mine pays the longer you dig, the well is a wildcat.
  D('mine', 'The Mine', 'asset', 4, { cash: 4, pros: 75, grow: 25, text: 'Each round held, worth 25 more Prosperity' }),
  D('oil', 'Oil Field Claim', 'asset', 3, { cash: 3, pros: 175, gamble: true, gambleOn: 3, bust: 25, text: 'Sell for Prosperity: a die decides — 3+ gushes for 175, else it runs dry for 25' }),
  D('semilla', 'Seed Round', 'event', 1, { pros: 150, bloom: 4, played: true, text: 'Plant it: four rounds on, it blooms — bank 150' }),
  // Events: the market's own voice. They fire the moment they are drawn, hit the whole
  // table, then the drawer draws a replacement card. Nobody chooses an Event.
  // On-draw events print a subtype by outcome (eventTemplate.js): a windfall
  // is an Opportunity (the default), a loss a Calamity, a shake-up whose
  // winner is unknown an Ambiguity.
  D('crash', 'Flash Crash', 'event', 0, { subtype: 'Calamity', text: 'Everyone holding 8+ Liquidity loses half' }),
  // The dot-com bust: it finds every Tech Stock on the table, whoever holds it.
  // The reputational crash: the Calamity that makes SAVING GRACE matter.
  D('fall', 'Fall From Grace', 'event', 0, { subtype: 'Calamity', text: 'The fall: every seated Trader loses 4 Credibility' }),
  // Apparitions: Our Lady appears to the whole table, unbidden. Each is an
  // on-draw Event named for her; the names are hers, so the Spanish one stays.
  D('holyroller', 'The Holy Roller', 'event', 0, { text: 'She rolls through: every player draws a card and collects 1 Liquidity' }),
  D('fuego', 'Nuestra Señora del Fuego', 'event', 0, { text: 'She rides the fire horse through the market: every player banks 75 Prosperity' }),
  D('virtual', 'The Virtual Mary', 'event', 0, { subtype: 'Ambiguity', text: 'She flickers on every screen: every player shuffles their hand into their deck and draws that many' }),
  // The feast day of the shrine's own saint: the whole table lights a candle.
  D('feast', 'The Feast of Perpetual Profit', 'event', 0, { text: 'Feast day: every player lights a candle' }),
  D('techwreck', 'Tech Wreck', 'event', 0, { subtype: 'Calamity', text: 'The bubble bursts: every Tech Stock on the table is wrecked — scrapped for 1 Liquidity' }),
  D('ballena', 'The Whale', 'event', 0, { subtype: 'Ambiguity', text: 'The whale surfaces: the richest portfolio’s best Asset moves to the poorest player' }),
  // Initiation: the drawer is taken into the society; fires on draw like the
  // other market weather but PRINTS as an Opportunity (the face sets subClass).
  D('illuminati', 'The Illumin80', 'event', 0, { text: 'Unseen hands: the drawer is initiated — each rival passes them one random card' }),
  D('rueda', 'The Wheel', 'event', 0, { subtype: 'Ambiguity', text: 'Every portfolio rotates one seat' }),
  D('godcandle', 'The God Candle', 'event', 0, { text: 'Until the drawer’s next turn, every Prosperity sale pays 100 more' }),

  // A reset, not a windfall: the weather clears and every hand grows. Whom it
  // helps depends on the table, so it prints as an Ambiguity, not an Opportunity.

  D('moralhazard', 'Moral Hazard', 'event', 0, { subtype: 'Ambiguity', text: 'The bailout: the poorest player collects 5; the richest loses 2' }),
  // Fat Tuesday: the throws. Everyone catches something; the die says how much.
  D('mardigras', 'Mardi Gras', 'event', 0, { text: 'Let the good times roll: every player rolls the die and collects that much Liquidity' }),

  // Locations (type 'location'): places you build, not things you hold. One
  // stands per player (a new one replaces the old), no Relic slot, never sold;
  // printed under the Artifact class with their own subtype. The engine and
  // the table support them; the row is empty in Genesis (The Neural Cathedral
  // stood here for an hour on 2026-11-12 and became Las Lágrimas, a Grace).
];

export const DESIGN_TYPES = ["trader", "asset", "event", "hazard", "remedy", "artifact", "grace", "location"];
export const designByKey = Object.fromEntries(DESIGNS.map((d) => [d.key, d]));
