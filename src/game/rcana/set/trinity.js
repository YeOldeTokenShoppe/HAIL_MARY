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
  monje:         { liq: 1, cred: 2, eq: 2 }, // humble income, a bright halo
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

// Rules text that changed with the Playtest 3 rules (one d8, one money, two-state
// Credibility), for the cards whose printed line would otherwise be wrong on the
// new frame and at the Playtest 3 table. Keyed by design key; any card type.
export const TRINITY_TEXT = {
  gato: "When seated, and each turn on a roll of 5+, knock one Calamity off your table.",
  diablito: "At the start of your turn, flip a coin: heads, collect $30M.",
  investigadora: "The top card of your deck is face up to you. Once on your turn, you may put it on the bottom.",
  abuela: "Your gambles pay out on a roll one lower.",
  // Not Traders, but their printed rule changed too: Credibility is two states now, and every roll is a d8.
  escandalo: "A strike when it lands. While it stays, the Trader cannot return to good standing.",
  publicista: "Clear a Scandal — or polish: your seated Trader returns to good standing.",
  shroud: "When your seated Trader would be discredited, discard the Shroud instead: they stay, in scandal.",
  tattoo: "Inked devotion: at the start of your turn, your seated Trader returns to good standing.",
  anima: "Light a candle. The most recently discarded Trader returns, in scandal, to your seat or your hand.",
  confession: "Light a candle. Your seated Trader returns to good standing, even under a Scandal.",
  meme: "On sale, roll: 6+ moons for $125M, else zero. Or take the safe $40M.",
  oil: "On sale, roll: 4+ gushes for $175M, else $25M. Or take the safe $30M.",
  gallo: "Each turn, roll: an 8 collects $20M; a 1 kills him.",
  lottery: "At the start of each turn, roll: an 8 wins $150M, and the Ticket is spent.",
};

// $M per point of Liquidity or Credibility, and per coin of an old cost.
export const MONEY_UNIT = 10;
