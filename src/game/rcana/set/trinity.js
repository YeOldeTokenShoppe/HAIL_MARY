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
export const TRINITY = {
  monje:         { liq: 1.5, cred: 2, eq: 2 }, // Money 15 (2026-11-20): at 10 he opened at 39%, at 20 at 59%. His Ethos 4 is what carries him, not his Vow
  gato:          { liq: 2, cred: 1, eq: 2 },
  general:       { liq: 2, cred: 1, eq: 3 }, // the rock
  diablito:      { liq: 2, cred: 0, eq: 0 }, // no halo, no composure: he lives on his wager
  prospector:    { liq: 2, cred: 1, eq: 1 },
  abuela:        { liq: 2, cred: 2, eq: 2 }, // respected, unflappable
  unicornio:     { liq: 3, cred: 1, eq: 1 },
  celebridad:    { liq: 3, cred: 2, eq: 0 }, // pays well, falls at the first Calamity
  investigadora: { liq: 3, cred: 1, eq: 2 },
  bot:           { liq: 4, cred: 0, eq: 3 }, // the grinder: no halo, the best income in the set
};

// ── LOGOS · ETHOS · PATHOS (2026-11-20: `attrs` in the Playtest 3 rules, on by default) ──
// Money is kept apart (it is `liq` above: what a Trader costs and makes), and a Trader's character is
// three attributes that always sum to EIGHT, each 1 to 4, no two Traders alike:
//   logos   REASON   insight: when you draw for your turn, look at this many cards and keep one
//   ethos   CHARACTER  reputation: what good standing pays, $5M a point
//   pathos  FEELING  heart and nerve: a Calamity played on you fails on a d8 roll of this or lower
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
export const ETHOS_UNIT = 5; // $M per point of Ethos while in good standing

// Rules text that changed with the Playtest 3 rules (one d8, one money, two-state
// Credibility), for the cards whose printed line would otherwise be wrong on the
// new frame and at the Playtest 3 table. Keyed by design key; any card type.
export const TRINITY_TEXT = {
  gato: "When seated, and each turn on a roll of 5+, knock one Calamity off your table.",
  diablito: "At the start of your turn, flip a coin: heads, collect $20M.",
  investigadora: "The cards you look at and do not draw go to the bottom of the deck.",
  abuela: "Your gambles pay out on a roll one lower.",
  general: "When a Calamity fails against your Pathos, collect $10M.",
  bot: "After your main action, you may also buy or sell one Asset. It cannot pray.",
  unicornio: "In good standing, each unsold Asset counts toward your billion at its sale price plus $50M.",
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
};

// $M per point of Liquidity or Credibility, and per coin of an old cost.
export const MONEY_UNIT = 10;
