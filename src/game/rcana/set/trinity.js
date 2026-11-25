// R-cana — THE TRINITY: the three fixed numbers every Trader carries (2026-11-16).
// One source for the Playtest 3 engine (src/game/playtest3/pt3-sim.js) and the
// code-drawn card frame (src/components/RcanaCard3.jsx), keyed by design key.
//
//   liq   LIQUIDITY    what they earn each turn, and what they cost to play (cost = liq)
//   cred  CREDIBILITY  what they earn on top while in good standing
//   eq    EQUANIMITY   a Calamity played on you fails on a d8 roll of this or lower
//
// Liquidity runs 1-4, Credibility 0-2, Equanimity 0-3. Each point of the first
// two is $10M. Tuned on the two-player sim until every opener sat within a few
// points of 50% (src/game/playtest3/PLAYTEST3.md).
// 2026-11-24: TRADERS ARE FREE. A Trader is who you are, not something you buy, so `liq` is income only: any
// Trader may open, and seating another from the hand costs the main action and no money. Income now offsets
// character instead of price: the strongest abilities earn least. Band $20M to $30M (it was $15M to $40M).
// 16,000 games: every opener between 48% and 53%, Devotion 50.3%. The notes on the lines below are older.
export const TRINITY = {
  monje:         { liq: 2, cred: 2, eq: 2 }, // Money 15. Set on 2026-11-20 (at 10 he opened at 39%, at 20 at 59%). Tried at 10 on 2026-11-21 against bots that could not value Relics; once they could, 10 opened at 47% and 15 at 52%, so 15 it is. His Ethos 4 is what carries him, not his Vow
  gato:          { liq: 3, cred: 1, eq: 2 },
  general:       { liq: 3, cred: 1, eq: 3 }, // the rock
  diablito:      { liq: 2.5, cred: 0, eq: 0 }, // no halo, no composure: he lives on his wager
  prospector:    { liq: 2.5, cred: 1, eq: 1 },
  abuela:        { liq: 2.5, cred: 2, eq: 2 }, // respected, unflappable
  unicornio:     { liq: 2.5, cred: 1, eq: 1 },
  celebridad:    { liq: 2, cred: 2, eq: 0 }, // pays well, falls at the first Calamity
  investigadora: { liq: 2, cred: 1, eq: 2 },
  bot:           { liq: 3.5, cred: 0, eq: 3 }, // the grinder: no halo, the best income in the set
};

// ── LOGOS · ETHOS · PATHOS (2026-11-20: `attrs` in the Playtest 3 rules, on by default) ──
// Money is kept apart (it is `liq` above: what a Trader costs and makes), and a Trader's character is
// three attributes that always sum to EIGHT, each 1 to 4, no two Traders alike:
//   logos   INSIGHT    when you draw for your turn, look at this many cards and keep one
//   ethos   CHARACTER  what good standing pays, $5M a point
//   pathos  NERVE      a Calamity played on you fails on a d8 roll of this or lower
export const ATTRS = {
  investigadora: { logos: 4, ethos: 3, pathos: 1 }, // Marisol: she reads everything
  bot:           { logos: 4, ethos: 1, pathos: 3 }, // The Octobot: all calculation, no name to lose
  celebridad:    { logos: 3, ethos: 4, pathos: 1 }, // The Influencer: her name is the product
  unicornio:     { logos: 3, ethos: 3, pathos: 2 }, // Eugene
  general:       { logos: 3, ethos: 2, pathos: 3 }, // Byzantine General
  diablito:      { logos: 3, ethos: 1, pathos: 4 }, // Connor: clever, shameless, all appetite
  prospector:    { logos: 2, ethos: 3, pathos: 3 }, // The Prospector
  gato:          { logos: 2, ethos: 2, pathos: 4 }, // Virgil: nothing rattles a cat
  monje:         { logos: 1, ethos: 4, pathos: 3 }, // Saint GR80: faith over analysis
  abuela:        { logos: 1, ethos: 3, pathos: 4 }, // The Gambler: respected, and all heart
};
// TRADE ONLY (2026-11-24, later the same day as free Traders): a Trader earns nothing for sitting at the desk. Money comes
// from trading, and Ethos is a better price: each point adds ETHOS_UNIT $M to every Asset sold in good standing.
// TRADER_INCOME is the switch the card frame and the table read; with it off, `liq` above is history (and --income in the sim).
export const TRADER_INCOME = false;
export const ETHOS_UNIT = 10; // $M per point of Ethos on each Asset sold while in good standing (it was $5M a turn until 2026-11-24)

// Rules text that changed with the Playtest 3 rules (one d8, one money, two-state
// Credibility), for the cards whose printed line would otherwise be wrong on the
// new frame and at the Playtest 3 table. Keyed by design key; any card type.
// THE MARKET (2026-11-24): the Fates that move the price of every Asset for the round they are turned, in $M a sale.
// The engine (pt3-sim.js) and the card frame both read this, so a market card prints what it does.
export const MARKET = { bull: 50, moon: 50, squeeze: 50, unlock: -50, crash: -50 };
export const TRINITY_TEXT = {
  gato: "When seated, and each turn on a roll of 5+, knock one Calamity off your table.",
  // The wager is rolled on the game's own die, split down the middle (5 to 8 wins): there is no coin in the box. (It read "flip a coin" until 2026-11-23.)
  diablito: "At the start of your turn, roll the die: 5 or higher, collect $20M.",
  investigadora: "The cards you look at and do not draw go to the bottom of the deck.",
  abuela: "Every die you roll counts one in your favor.", // Lucky Streak, widened on 2026-11-24 (it was gambles only)
  prospector: "Assets you buy cost $20M less.",
  general: "When a Calamity fails against your Pathos, collect $10M.",
  bot: "Goes first. Opens with eight cards and holds eight. No religious observances: sells a Grace for $30M.", // Eight Arms, as speed (2026-11-24); everyone draws two since the fuller turn
  unicornio: "In good standing, each unsold Asset counts toward your billion at its sale price plus $50M.",
  monje: "When you light a candle, collect $15M.",
  // The Fates and the market (2026-11-24): what these cards print now.
  bull: "A bull market: this round, every Asset sells for $50M more.",
  moon: "A bull market: this round, every Asset sells for $50M more.",
  squeeze: "The shorts are squeezed. A bull market: this round, every Asset sells for $50M more.",
  unlock: "Supply floods in. A bear market: this round, every Asset sells for $50M less.",
  crash: "Everyone holding $80M or more loses a quarter of it. A bear market: Assets sell for $50M less this round.",
  enigma: "When you turn a Fate, you may discard this: that Fate is cancelled for everyone.",
  singular: "From now on, every player takes one more action of any kind each turn.",
  geometry: "The Events you play from your hand pay $25M more.",
  anima: "Light a candle. The last Trader discarded returns to your hand, in scandal.",
  // Not Traders, but their printed rule changed too: Credibility is two states now, and every roll is a d8.
  escandalo: "A strike when it lands. While it stays, the Trader cannot return to good standing.",
  publicista: "Clear a Scandal — or polish: your seated Trader returns to good standing.",
  shroud: "When your seated Trader would be discredited, discard the Shroud instead: they stay, in scandal.",
  tattoo: "Inked devotion: at the start of your turn, your seated Trader returns to good standing.",
  anima: "Light a candle. The most recently discarded Trader returns, in scandal, to your seat or your hand.",
  confession: "Light a candle. Your seated Trader returns to good standing, even under a Scandal. It lifts The Inferno, which cannot stop it.",
  meme: "On sale, roll: 6+ moons for $125M, else zero. Or take the safe $40M.",
  oil: "On sale, roll: 4+ gushes for $175M, else $25M. Or take the safe $30M.",
  gallo: "Each turn, roll: an 8 collects $20M; a 1 kills him.",
  lottery: "At the start of each turn, roll: an 8 wins $150M, and the Ticket is spent.",
  // The odds are die faces, not coins: without this line oneMoney pins "3+" and "5+" as Liquidity pills.
  predict: "Once a turn, stake $20M and name your odds: 3+ pays $30M, 5+ pays $50M, an 8 pays $200M. A miss loses the stake.",
};

// $M per point of Liquidity or Credibility, and per coin of an old cost.
export const MONEY_UNIT = 10;
