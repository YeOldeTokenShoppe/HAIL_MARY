#!/usr/bin/env node
// RL80 R-cana — Playtest 3: ONE MONEY (PLAYTEST3.md). A sim-only prototype, forked from
// playtest2/pt2-sim.js on 2026-11-16. Playtest 2 is untouched.
//
// Money is money. There is one currency, cash, counted in $M, and your cash is your score.
// An Asset counts for nothing until you sell it. First to $1B.
//
// How the fork does it with the Playtest 2 card set (designs.js is shared and unedited):
//   · every Liquidity number on a card — cost, income, "collect N" — is worth RULES.rate $M
//   · every Prosperity number is already $M: "bank 100" is "collect $100M"
//   · p.cash is the one pool. p.liq and p.pros still exist, as VIEWS of it, so the Playtest 2
//     rules text runs unchanged: p.liq is cash counted in old coins, p.pros is the score (cash;
//     with --assets, cash plus the portfolio at its sale price)
//   · an Asset has one sale price (its old Prosperity value); only a gamble keeps a second,
//     safe price. The winner is decided at the end of a turn, not the instant money lands.
//
//   node pt3-sim.js --games 2000              (two players, the default; --players 3 or 4 for more)
//   node pt3-sim.js --rate 10 --goal 1000 --start 5      (the knobs; see RULES)
//   node pt3-sim.js --verbose --seed 7
export function makeRng(seed) { let s = seed >>> 0 || 1; return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ── The set's designs live in src/game/rcana/set/designs.js — the one source of truth ──
// pt2-build.js inlines that file here for the browser table; Node imports it directly.
import { DESIGNS, titleOf } from '../rcana/set/designs.js';
import { TRINITY, ATTRS, ETHOS_UNIT, MARKET } from '../rcana/set/trinity.js';
// THE BAR (rules.bar, 2026-11-26): fuel for the Traders, as a temptation. Once on your turn you may order one drink, or none; never the
// same one two turns running. Each gives a kick now and a comedown on your next turn; a Trader's own drink (`prefers` on the design)
// has no comedown. The Octobot does not drink: it takes the same three as power boosts (`boost` is the name it sees).
export const DRINKS = { // `menu`: the two short halves the bar's menu prints (kick · after). Three since 2026-11-26: coffee, an energy drink, or a stiff drink (Champagne and Whiskey in one glass; Sugar Rush was the Energy Drink again). The key `espresso` is Coffee.
  espresso: { name: 'Coffee', boost: 'Overclock', kick: 'Everything you sell this turn brings $30M more', comedown: 'Next turn you draw one card fewer, and cannot buy', menu: ['sales +$30M this turn', 'next turn, 1 card fewer and no buying'], amount: 30 },
  energy:   { name: 'Energy Drink', boost: 'Power Surge', kick: 'Two more actions this turn, and you may sell what you buy this turn', comedown: 'Next turn you draw one card fewer, cannot buy, and your Trader’s ability is off', menu: ['2 more actions; sell what you buy', 'next turn, 1 card fewer, no buying, ability off'], actions: 2 },
  alcohol:  { name: 'Stiff Drink', boost: 'Firewall', kick: 'This turn your gambles win on two more faces of the die, and no Calamity can be played on you until your next turn', comedown: 'Next turn your Trader’s ability is off', menu: ['gambles +2 faces; no Calamity hits you', 'next turn, ability off'], faces: 2 },
};
const SET_BONUS = 50; // $M more on each sale of an Asset while its holder has another of the same set (designs.js: `set`)
const GOD_CANDLE_BONUS = 100; // flat Prosperity bonus per sale while The God Candle burns
// The game calls every card what the CARD calls itself: a design's printed
// name (the lotería La Máquina over the engine's Enigma Machine) becomes its
// name here, so the table, the gallery and the log all match the print.
for (const d of DESIGNS) d.name = titleOf(d); // the printed title, by EDITION (designs.js)
// Playtest 3's own card values, layered over the shared set so designs.js (and Playtest 2) stay as they are.
export const PT3 = {
  // THE TRINITY, as three printed numbers (2026-11-16): Liquidity (liq, and cost = liq), Credibility (halo:
  // what good standing pays) and Equanimity (eq). The values live in ../rcana/set/trinity.js, which the
  // code-drawn card frame reads too, so the card and the engine cannot drift apart.
  ...Object.fromEntries(Object.entries(TRINITY).map(([k, t]) => [k, { liq: t.liq, cost: 0 /* Traders are free since 2026-11-24: liq is income only */, halo: t.cred, eq: t.eq }])),
};
// No halo and no composure: the devil lives on his wager, which is a plain money bet now — heads collect 3.
// (Heads paid 3 until 2026-11-20: with a full set of attributes as well, he opened at 62%.)
Object.assign(PT3.diablito, { wager: 2, wagerLoss: 0, text: 'At the start of your turn, roll the die: 5 or higher, collect 2 Liquidity' });
// THE DEGEN LEADS (2026-11-24): Connor, The Prospector and The Gambler are who a Degen plays as; Eugene is the deck's wild card.
// Connor's wager pays $30M (it was $20M); The Prospector's Assets cost $20M less (it was $10M); The Gambler's Lucky Streak covers
// every die she rolls (lucky(), below); Eugene's Spectacle adds $25M an Asset (it was $50M), and Degen carries one of him.
Object.assign(PT3.prospector, { discount: 2 });
// TRADE ONLY (2026-11-24): with no salary, the abilities that pay money each turn are the only steady income, so they were
// re-set: Connor's wager back to $20M (at $30M he opened at 60%), Saint GR80's Vow $15M a candle (it was $25M), and Eugene's
// Spectacle back to $50M an Asset (he had been cut to $25M that morning, and opened at 43% without it).
Object.assign(PT3.monje, { vow: 15 });
// SPEED (The Octobot, 2026-11-24): a bot sees an opportunity and takes it before anyone else can. Whoever opens as The Octobot
// takes the first turn, and it draws two cards a turn. It has no religious observances: no candle lights for it, and a Grace
// in its hand is sold for $30M. This replaces Eight Arms (`arms`). Tried and set aside: two main actions a turn (`speed`), which
// it had too few cards to use (a player staying as it won 36%); both together (89%); selling the turn it buys (`fastSell`, +3).
// EIGHT ARMS, the same day: the eight is its signature. It opens with eight cards and holds eight (everyone else five and
// seven), on top of the first turn and two cards a turn. The bigger hand is not the engine (alone, a player staying as it won
// 31% to 36%); the two cards a turn are. Together: 53%. `arms` below is the old Eight Arms, an extra Asset bought or sold: off.
// THE MARKET (2026-11-24). A bull run happens to everybody, so the cards that paid one player for it are Fates now, and they
// move the price of every Asset for the round they are turned (`market`, in $M; Game.market, read by saleBonus()):
// Bull Run, Full Moon and Short Squeeze are bull Fates (+$50M a sale); Token Unlock (supply floods in) and Flash Crash are
// bear Fates (-$50M; Flash Crash still takes its quarter of the cash). The God Candle's +$100M is the same thing, larger.
// They were "pay $20M, collect $100M at once": free at the net amount played identically, so the price did nothing.
for (const [k, m] of Object.entries(MARKET)) PT3[k] = k === 'crash' ? { market: m } : { played: false, cost: 0, market: m, pros: 0, perHaz: 0, rivalsCollect: 0, text: `${m > 0 ? 'Bull' : 'Bear'} market: this round, every Asset sells for $${Math.abs(m)}M ${m > 0 ? 'more' : 'less'}` }; // MARKET is in ../rcana/set/trinity.js, shared with the card frame
Object.assign(PT3.bot, { speed: false, arms: false, draws: 2, opens: 8, holds: 8, fastSell: false, first: true, graceSale: 3, abilityName: 'Eight Arms' });
export const byKey = Object.fromEntries(DESIGNS.map((d) => [d.key, { ...d, ...(PT3[d.key] || {}) }]));
// A card's printed title, for the log: N('gato') is its name, U('gato') the same in capitals.
const N = (key) => byKey[key].name; const U = (key) => N(key).toUpperCase();
// CREDIBILITY IS A STATE, NOT A COUNT (2026-11-16). A Trader is IN GOOD STANDING or IN SCANDAL.
//   · in good standing they earn +1 income (the old full-Credibility bonus)
//   · a strike (any Calamity landing on you, Fall From Grace) puts them in scandal
//   · a second strike while in scandal DISCREDITS them — unless a Saving Face card or the Shroud is spent
//   · a candle, the Press Release, the Tattoo or the Confession puts them back in good standing; while a
//     Scandal card still sits on you, only the Press Release (which clears it) and the Confession can
// The engine keeps the state in the old fields: cred is 2 for every Trader, credNow 2 = good standing,
// 1 = in scandal, 0 = discredited. Nothing is counted at the table.
for (const d of Object.values(byKey)) if (d.type === 'trader') d.cred = 2;
const standing = (t) => (t.credNow == null || t.credNow >= t.cred ? 'in good standing' : 'in scandal');
// Two 40-card starter recipes: Devotion (deeds, remedies, slow money) and Degen
// (hazards, gambles, the Unicorn's compounding). Deck identity is the collectible premise.
export const RECIPES = {
  devotion: [['monje', 2], ['gato', 1], ['celebridad', 1], ['general', 1],
    // THE MARKET (2026-11-24): Bull Run x2 and Short Squeeze x2 became Fates. In their place: a second Tech Stock and Cellar, a
    // Savings Bond and a Stablecoin (modest Assets: with Ethos 4 on every sale, strong ones gave Devotion 58% to 67%).
    ['tech', 2], ['goldbar', 1] /* Diamond Hands' place (2026-11-26) */, ['cava', 2], ['plata', 1], ['bono', 1], ['stablecoin', 1], ['nacimiento', 1], ['catedral', 1], /* The Black Swan and Tech Rekt left for THE FATES (2026-11-24); Tax Collector and Paper Hands came in */ ['taxman', 1], ['index', 1] /* Paper Hands' place (2026-11-26) */, ['bluechip', 1], ['semilla', 1], ['investigadora', 1],
    ['bear', 1], ['rug', 1],
    ['junk', 1] /* The Bell's place (2026-11-26) */, ['tortilla', 2], ['skull', 1], ['ofrenda', 1], // Saint's Skull where The Press Release was (2026-11-23)
    ['heart', 1], ['pawn', 1], ['talisman', 1], /* Pawn Shop where The Halo was (2026-11-23) */ ['rosary', 1], ['grail', 1], ['dashboard', 1], ['tattoo', 1], ['fineart', 1] /* Sacred Geom8ry's place (2026-11-26) */,
    ['cherub', 1], ['fountain', 1], ['confession', 1], ['anima', 1], ['visitor', 1]], // The Visitor where The Tears was (2026-11-23); // Coin-op Confession where The Cleansing was (2026-11-22)
  degen: [['diablito', 2], ['unicornio', 1], ['prospector', 1], ['abuela', 1], ['garth', 1] /* Garth Raider for the second Gambler (2026-11-26) */, ['bot', 1], // one Eugene and a second Gambler since 2026-11-24
    // THE MARKET: Bull Run, Full Moon and Token Unlock became Fates. In their place: Real Estate, a second Blue Chip, a third Tech Stock.
    ['meme', 1], ['tech', 3], ['racehorse', 1] /* Paper Hands' place (2026-11-26) */, ['predict', 1], ['perp', 1], ['bluechip', 2], ['realestate', 1], ['jardin', 1], ['ponzi', 1], ['catacumbas', 1],
    // THE FATES (2026-11-24): The Whale, The Wheel, Mardi Gras, God Candle, Fire Horse, The Illumin80 and Fall From Grace left for
    // the shared deck. In their place: Oil Field Claim, Bull Run, Full Moon, Tax Collector, and a second Bear Market, Rug Pull
    // and Exit Scam. Seven money cards in their place gave Degen 57% to 68%; none at all, 42%; this mix, 51%.
    ['oil', 1], ['taxman', 1],
    ['bear', 2], ['rug', 2], ['hack', 1], ['scam', 2], ['escandalo', 1], ['infierno', 1], ['trap', 1],
    ['tortilla', 1],
    ['heart', 1], ['stablecoin', 1], ['porkbellies', 1] /* the Enigma Machine's place (2026-11-26) */, // a Stablecoin where The Skull was (2026-11-21): the deck had lost two earning Assets that day
    ['rideordie', 1], ['lottery', 1], ['motherboard', 1],
    ['ofrenda', 1]],
};
// THE GENERAL SHUFFLE (2026-11-20, a third mode for testing): no starter decks. Every card in the set, one
// copy each, in ONE deck that both players draw from, with one shared discard pile. When every player's
// recipe is 'shuffle' the Game deals it that way (Game.shared).
RECIPES.shuffle = DESIGNS.map((d) => [d.key, 1]);
export const STARTER = RECIPES.devotion;
export const HAIL_DIE_SIDES = 8;
export const MIRACLE_MAX = 3; // Miracles a player may hold at once
// The knobs of the one-money economy.
//   rate   $M per old Liquidity coin (costs, income, every "collect N")
//   goal   net worth that wins, in $M (1000 = $1B)
//   start  opening cash, in old coins (× rate)
//   crash  the share of their cash a Flash Crash takes from anyone holding 8+ coins' worth (was half)
//   rugFreezes  true: a Rug Pull also takes the victim's portfolio out of their net worth until cleared
//   countAssets false (the rule since 2026-11-16): CASH ONLY — an unsold Asset counts for nothing, you sell to score.
//               true (--assets) is the first draft, where the portfolio counted at its sale price
//   calamityStrikes true (the rule since 2026-11-16): any Calamity that lands on you is a strike (--nostrikes: only Scandal and the Fall)
//   die 8 (the rule since 2026-11-16): ONE DIE, a d8, for every roll in the game. 6 (--d6) is Playtest 2's mix:
//               a d6 for everything but the Hail Mary. On the d8 each target moves up one to keep its odds close:
//               gambles 5+ -> 6+ and 3+ -> 4+, El Gato 4+ -> 5+; El Gallo and the Lottery Ticket pay on an 8
//   earnedHalo  true (the rule since 2026-11-16; --nohalo turns it off): a Trader can EARN a halo by helping the
//               rival — offering them a card, which they may refuse (a refused offer still uses the turn),
//               or clearing a Calamity off their table. One halo at most: +1 income while in good standing,
//               knocked off by a strike. candleHalo (--candlehalo) adds your first candle as a third way.
//               giftBlind (--blind): the rival draws the card at random from your hand and cannot refuse it
//   scandalFuse  trial, off: a Scandal left on you for a full round is a second strike (--fuse)
//   finishRound true (the rule): the round is played out before the win is read, so everyone has had the same
//               number of turns. false (--sudden) ends the game on the turn someone gets there: going first then wins 56%
//   income      false (the rule since 2026-11-24): TRADE ONLY. A Trader earns nothing each turn; players open with more cash
//               (start: 10) and Ethos pays on each sale (ethosBonus). true (--income) is the old salary: liq + Ethos a turn, start 5
//   prayer      THE OPENING PRAYER (2026-11-24). Nobody starts with money. Before the first turn each player rolls the die, a
//               prayer for a windfall: the highest roll starts with `windfall` coins, everyone else with `rest` coins and
//               `candles` candles already lit (capital for one, grace for the other). A tie is rolled again. Plain rolls: no
//               Trader's ability touches them. null (--noprayer): everyone opens with `start` coins, as before
//   slots, draws THE FULLER TURN (2026-11-24). A turn is no longer one main action. You draw `draws` cards (2), then may do up to
//               `slots` things (3), one of each kind, in any order: BUY one Asset, SELL one Asset (or uncork one), and take one
//               MAIN ACTION (any other card, a gift, paying a Calamity off, the Hail Mary). Passing ends the turn. An apparition
//               and The Singular80 add free actions of any kind after those. slots: 0, draws: 1 (--oneaction) is the old turn.
//               More to do needed more cards: with one card a turn the slots went unused (1.45 actions a turn, openers 36-78%).
//   fates       THE FATES (2026-11-24). The Events that fire for the whole table are no longer in anyone's deck: they are one shared
//               deck, and one is turned at the start of each round (`per: 'turn'`, a trial: at the start of every turn). The
//               player it is turned FOR alternates by round: they witness an apparition, roll The Black Swan, are initiated by
//               The Illumin80, and their Enigma Machine may intercept it. The Singular80 is in it only in the General shuffle
//               (`skip`), as before. null (--nofates): such Events are drawn from the decks they are in, and fire on the draw
//   bar         THE BAR (2026-11-26): one optional drink a turn, a kick now and a comedown after (DRINKS, above). false (--nobar): no bar
//   trade       TRADING WITH THE RIVAL (2026-11-26). Once on your turn you may offer your rival one card at a price you name: an Asset
//               from your portfolio, or any card from your hand. They take it or leave it. `min`: the bots only offer a card worth
//               at least that many $M more to the buyer than to themselves (at $20M they traded three times a game and the
//               starters tilted; at $50M about once, nearly always for a companion or a set). null (--notrade): no trading
//   recycle     true (the rule since 2026-11-26): a sold Asset goes to its seller's discard pile and comes round again when the deck is
//               reshuffled. false: it leaves the game, as before; then the supply of Assets is finite, and once Fire Horse stopped
//               handing out money a table could run dry with nobody at the goal (PLAYTEST3.md)
//   disgrace    'stay' (the rule since 2026-11-24): a second strike DISGRACES the Trader. They stay at the desk, since a Trader is
//               who you play as, with no ability, no Ethos bonus, no Pathos and a blind draw, until they are back in good
//               standing (a candle, The Confession, The Press Release). null (--leave): they are discarded, as before
export const RULES = { bar: true, trade: { min: 50 }, recycle: true, disgrace: 'stay', fates: { per: 'round', skip: ['singular'] }, slots: 3, draws: 2, prayer: { windfall: 20, rest: 10, candles: 2 }, income: false, rate: 10, goal: 1000, start: 10, crash: 0.25, rugFreezes: false, countAssets: false, finishRound: true, calamityStrikes: true, scandalFuse: false, die: 8, earnedHalo: true, candleHalo: false, giftsAlwaysTaken: false, giftKeen: 1, giftBlind: false, attrs: true, apparitionGift: 'action+miracle' };
export const ODDS = [1, 2, 3, 4, 5]; // winning faces, by recorded deeds (cap 3); the fifth rung is only reached by The Fountain
// The starting Trader (2026-11-16): before the deal, every player chooses one Trader from their deck
// and seats them, free. Only a junior may open at the desk — cost STARTER_MAX_COST or less; the
// stars are played from the hand at their price. Set it to null to let any Trader open.
export const STARTER_MAX_COST = null; // any Trader may open (2026-11-24, when Traders became free); it was 2, the juniors
export function starterChoices(recipe) {
  const traders = [...new Set((RECIPES[recipe] || []).map(([k]) => k))].map((k) => byKey[k]).filter((d) => d && d.type === 'trader');
  const juniors = STARTER_MAX_COST == null ? traders : traders.filter((d) => d.cost <= STARTER_MAX_COST);
  if (juniors.length) return juniors;
  const cheapest = Math.min(...traders.map((d) => d.cost)); // a deck with no junior opens with its cheapest Trader
  return traders.filter((d) => d.cost === cheapest);
}

// A Remedy's `clears` is one Calamity's key, a list of keys, or 'any' (designs.js).
const clearsHaz = (c, h) => c.clears === 'any' || (Array.isArray(c.clears) ? c.clears.includes(h.key) : h.key === c.clears);
export class Game {
  constructor({ players, seed = 1, verbose = false, rules = {}, maxTurns = 300 }) {
    this.rng = makeRng(seed); this.verbose = verbose; this.lines = []; this.rules = { ...RULES, ...rules }; this.winAt = this.rules.goal; this.maxTurns = maxTurns;
    this.fx = {}; this.dealing = true;
    this.players = players.map((cfg, idx) => ({ idx, name: cfg.name, policy: cfg.policy, trader: null, recipe: cfg.recipe || 'devotion',
      deck: this.shuffle(RECIPES[cfg.recipe || 'devotion'].flatMap(([k, n]) => Array.from({ length: n }, () => ({ ...byKey[k] })))),
      hand: [], discard: [], invest: [], seeds: [], shorts: [], artifacts: [], location: null, hazards: [], deeds: 0, hailUsed: false, miracles: 0,
      stats: { plays: 0, hires: 0, disgraces: 0, sells: 0, sellCash: 0, sellPros: 0, hazPlayed: 0, hazCleared: 0, remedyRival: 0, candles: 0, hail: 0, hailWon: 0, passes: 0, discards: 0, turns: 0, hazTurns: 0 } }));
    this.shared = this.players.length > 1 && this.players.every((p) => p.recipe === 'shuffle');
    if (this.shared) { const deck = this.players[0].deck; const discard = []; for (const p of this.players) { p.deck = deck; p.discard = discard; } } // one deck, one discard pile, held by everyone
    // LOGOS · ETHOS · PATHOS (rules.attrs, the rule since 2026-11-20; --noattrs for the old three numbers): the three attributes take over from Credibility and Equanimity.
    // Pathos is the d8 roll (eq), Ethos is what good standing pays at $5M a point (halo, in coins), Logos is read in turnDraw.
    if (this.rules.attrs) for (const p of this.players) for (const c of p.deck) { const A = c.type === 'trader' && ATTRS[c.key]; if (A) { c.ethos = A.ethos; c.eq = A.pathos; c.halo = A.ethos * (this.rules.income ? 5 : ETHOS_UNIT) / this.rules.rate; c.logos = A.logos; } }
    if (this.rules.fates) { const F = this.rules.fates; const fate = (c) => c.type === 'event' && !c.played; const seen = new Set();
      for (const p of this.players) { if (seen.has(p.deck)) continue; seen.add(p.deck); for (let i = p.deck.length - 1; i >= 0; i--) if (fate(p.deck[i])) p.deck.splice(i, 1); } // any still in a deck go to the shared one
      const skip = this.shared ? [] : (F.skip || []);
      this.fates = this.shuffle(RECIPES.shuffle.map(([k]) => byKey[k]).filter((d) => d && fate(d) && !skip.includes(d.key)).map((d) => ({ ...d }))); this.fatesGone = []; this.fateNow = null; }
    for (const p of this.players) this.oneMoney(p);
    // draw() is async, but while dealing no Event fires, so each call mutates
    // before its first await and the hands are full when the constructor returns.
    this.turnNo = 0; this.over = false; this.winner = null;
    // The starting Trader: the player's choice (cfg.starter) or, for a bot, one of its deck's
    // juniors at random. They leave the deck for the desk before the deal, free, so the game is
    // played from 39 cards and nobody begins with an empty seat. (This replaces the morning's
    // opening rule, the redeal of a hand with no Trader: with the seat filled it has nothing to do.)
    // A player's own choice is seated before a random one, and a Trader already taken from a shared deck is no longer on offer.
    players.map((cfg, i) => [cfg, i]).sort((a, b) => !!b[0].starter - !!a[0].starter).forEach(([cfg, i]) => {
      const p = this.players[i]; const choices = starterChoices(p.recipe).filter((d) => p.deck.some((c) => c.key === d.key)); if (!choices.length) return;
      const key = choices.some((d) => d.key === cfg.starter) ? cfg.starter : choices[Math.floor(this.rng() * choices.length)].key;
      const t = p.deck.find((c) => c.key === key); p.deck.splice(p.deck.indexOf(t), 1);
      t.credNow = t.cred; p.trader = t; p.starter = t.key; this.order = null;
      this.log(`${p.name} opens with ${t.name} at the desk (income ${this.m(t.liq)} · in good standing · ${this.rules.attrs ? 'Pathos' : 'Equanimity'} ${t.eq || 0})`);
    });
    for (const p of this.players) for (let i = 0; i < ((p.trader && p.trader.opens) || 5); i++) this.draw(p, true); // EIGHT ARMS: The Octobot opens with eight
    this.dealing = false;
  }
  // ONE MONEY. p.cash ($M) is all the money a player has. p.liq reads it in old coins and p.pros
  // reads NET WORTH, so "spend 3", "collect 1" and "bank 100" all move the same pool.
  // Money for the log: coins (the old unit the engine still counts cards in) as $M.
  m(coins) { return `$${Math.round(coins * this.rules.rate)}M`; }
  oneMoney(p) {
    const g = this; p.cash = (this.rules.prayer ? 0 : this.rules.start) * this.rules.rate; // with the opening prayer, nobody starts with money
    Object.defineProperty(p, 'liq', { get() { return this.cash / g.rules.rate; }, set(v) { this.cash = Math.round(v * g.rules.rate); } });
    Object.defineProperty(p, 'pros', { get() { return g.netWorth(this); }, set(v) { this.cash += Math.round(v - g.netWorth(this)); } });
  }
  // What an Asset is worth on paper: its sale price today. A gamble counts at its safe price.
  paperValue(a) { return a.gamble ? a.cash * this.rules.rate : this.prosOf(a); }
  // THE SPECTACLE (Eugene, 2026-11-20; named The Narrative until 2026-11-23, and `narrative` is still its flag): while he is seated and in good standing, his player's unsold Assets count
  // toward the billion at their sale price. Everyone else has to sell to score; he only has to be believed.
  narrative(p) { const t = p.trader; return !!t && !!t.narrative && this.abilityOn(p) && (t.credNow == null || t.credNow >= t.cred); }
  portfolioValue(p) { return !(this.rules.countAssets || this.narrative(p)) || (this.rules.rugFreezes && this.hasHaz(p, 'rug')) ? 0 : p.invest.reduce((s, a) => s + this.paperValue(a) + (this.narrative(p) ? p.trader.premium || 0 : 0), 0); } // `premium`: what the story adds to each Asset, in $M
  netWorth(p) { return p.cash + this.portfolioValue(p); }
  // The win is read when the round is complete (RULES.finishRound): anyone at the goal, the richest of
  // them takes it (the player whose turn it was breaks a tie).
  checkWin(active) {
    if (this.over) return; this.settleShorts();
    const there = this.players.filter((q) => this.netWorth(q) >= this.winAt).sort((x, y) => this.netWorth(y) - this.netWorth(x) || (x === active ? -1 : y === active ? 1 : 0));
    if (there.length) { this.over = true; this.winner = there[0]; this.log(`*** ${this.winner.name} WINS with a net worth of $${this.netWorth(this.winner)}M ***`); }
  }
  async turn(p) { await this.takeTurn(p); while (p.extraTurns > 0 && !this.over) { p.extraTurns--; this.log(`✦ ${p.name} takes another turn`); await this.takeTurn(p); } if (!this.rules.finishRound || p === this.order[this.order.length - 1]) this.checkWin(p); }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  log(t) { if (this.verbose) this.lines.push(`[T${this.turnNo}] ${t}`); }
  rivals(p) { return this.players.filter((q) => q !== p); }
  abilityOn(p) { return !(p.cdNow && p.cdNow.abilityOff) /* a comedown: whiskey, an energy drink */ && !(p.trader && p.trader.disgraced) && !(p.hazards.some((h) => h.key === 'hack') && !p.artifacts.some((a) => a.key === 'halo')); }
  is(p, key) { return !!p.trader && p.trader.key === key && this.abilityOn(p); }
  // LUCKY STREAK (The Gambler, widened 2026-11-24): every die her player rolls counts one in their favour. A gamble and a market
  // bet need one less, the Hail Mary has one more winning face, her Pathos blocks on one more, Mardi Gras pays one more point,
  // The Lottery Ticket wins on the top two faces, and The Black Swan she draws moves one face her way.
  lucky(p) { return this.is(p, 'abuela') ? 1 : 0; }
  // SPEED, as knobs on the Trader (The Octobot): `opens` and `holds` its opening hand and hand limit · `speed` one more main action a turn · `fastSell` an Asset may be sold on the
  // turn it is bought · `draws` cards drawn for the turn · `first` whoever opens as this Trader takes the first turn ·
  // `graceSale` no religious observances: a Grace in hand may be sold for that many coins (the Trader still cannot pray).
  speedy(p) { return this.is(p, 'bot') && !!p.trader.speed; }
  quick(p, a) { return p.wiredTurn === this.turnNo /* an energy drink */ || (!!p.trader && this.abilityOn(p) && !!p.trader.fastSell) || !!(a && (this.comp(p, a.key) || {}).fast); } // or The Octobot's companion, its Tech Stock
  handLimit(p) { return (p.trader && p.trader.holds) || 7; } // EIGHT ARMS: a card for each
  drawsOf(p) { return Math.max(1, Math.max(this.rules.draws || 1, p.trader && this.abilityOn(p) && p.trader.draws ? p.trader.draws : 1) - (p.cdNow && p.cdNow.drawLess ? 1 : 0)); } // less one in a comedown
  mainActions(p) { return (this.accelerated ? 2 : 1) + (this.speedy(p) ? 1 : 0); }
  hasHaz(p, key) { return p.hazards.some((h) => h.key === key); }
  // A Relic with `wards` (The Keys, The Audit): the listed Calamities cannot be played on its holder.
  // The Octobot cannot pray: its Graces go unheard (`prays` on the design lifts that, for testing).
  soulless(p) { return this.is(p, 'bot') && !p.trader.prays; }
  warded(p, key) { return p.artifacts.some((a) => a.wards && a.wards.includes(key)); }
  // Can this Calamity be played on t? A condition, if t does not already have it; a hit (a fraud), if there
  // is something for it to take. Never through a Relic that wards it.
  canHit(t, c) {
    if (t.shield) return false; // whiskey: nothing lands until their next turn
    if (this.warded(t, c.key)) return false;
    if (!c.hit) return !this.hasHaz(t, c.key);
    return c.key === 'rug' ? this.exposed(t).length > 0 : t.cash > 0;
  }
  // The three frauds. Returns the line for the log.
  resolveHit(p, t, c) {
    if (c.key === 'rug') { const a = this.exposed(t).pop(); t.invest.splice(t.invest.indexOf(a), 1); t.discard.push(a); t.stats.rugged = (t.stats.rugged || 0) + 1; t.lastFraud = { name: c.name, by: p, asset: a }; return `${t.name}'s ${a.name} goes to zero and is discarded`; }
    if (c.steal) { const n = Math.min(c.steal, t.cash); t.cash -= n; p.cash += n; t.lastFraud = { name: c.name, by: p, amount: n, stolen: true }; return `${p.name} takes $${n}M from ${t.name}`; }
    const n = Math.min(c.loss || 0, t.cash); t.cash -= n; t.lastFraud = { name: c.name, by: p, amount: n }; return `${t.name} loses $${n}M`;
  }
  // A strike from a Calamity. The Halo (noStrikes) turns it aside.
  async strike(t, why) {
    if (t.trader && t.trader.ironclad && this.abilityOn(t)) { this.log(`${t.trader.name} has no soul for it to grip: no strike (${why})`); return; } // a knob for The Octobot: no strike touches it
    if (t.trader && t.artifacts.some((a) => a.noStrikes)) { this.log(`THE HALO holds: ${t.trader.name} takes no strike (${why})`); return; }
    await this.credDamage(t, 1, why);
  }
  // Async: an on-draw Event can ask a player a question (SAVING FACE on a Fall).
  async draw(p, silent = false) {
    if (!p.deck.length && p.discard.length) { p.deck.push(...this.shuffle(p.discard.splice(0))); this.log(`${p.name} reshuffles`); } // in place: a shared deck stays shared
    const c = p.deck.shift(); if (!c) return null;
    if (c.type === 'event' && !c.played) {
      if (this.dealing) { p.deck.push(c); return await this.draw(p, silent); } // no weather before the game starts
      p.discard.push(c);
      const machine = p.artifacts.find((a) => a.key === 'enigma'); // Intercept: the Machine can cancel weather on its owner's draw
      if (machine && await p.policy.useEnigma(this, p, c)) { p.artifacts.splice(p.artifacts.indexOf(machine), 1); p.discard.push(machine); this.log(`✦ ${c.name} is drawn by ${p.name} — the ENIGMA MACHINE intercepts it: the message never goes out`); return await this.draw(p, silent); }
      this.witness(p, c); await this.event(p, c); return await this.draw(p, silent); // the market speaks, then you draw a replacement
    }
    if (c.type === 'trader') { delete c.credNow; delete c.earned; delete c.disgraced; }
    p.hand.push(c);
    if (!silent) this.hooks?.onDraw?.(p, c);
    if (!silent) this.log(`${p.name} draws${p.policy && p.policy.human ? ' ' + c.name : ''}`);
    return c;
  }
  // REWIND takes the last card to reach your discard pile that can be held again: not an Event that fired on the
  // draw (it never was in a hand) and not a Rewind.
  rewindable(p) { for (let i = p.discard.length - 1; i >= 0; i--) { const x = p.discard[i]; if (!x.rewind && !(x.type === 'event' && !x.played)) return x; } return null; }
  async event(p, c) {
    this.log(`✦ EVENT — ${c.name} (drawn by ${p.name}): ${c.text}`);
    for (const q of this.players) for (const a of this.hot(q)) if (a.wither) { /* Yield Farm's old rule; Dividend Stock (the same key, jardin) does not wither */ q.invest.splice(q.invest.indexOf(a), 1); q.discard.push(a); this.log(`${q.name}'s YIELD FARM is wiped by the weather`); }
    if (c.key === 'godcandle') this.fx[c.key] = { owner: p.idx };
    // THE SINGULAR80 (2026-11-20): from here to the end of the game, every player takes two main actions a turn (turn(), below).
    if (c.key === 'singular') { if (this.accelerated) this.log('THE SINGULAR80 — time has already folded; nothing more happens'); else { this.accelerated = true; this.log('THE SINGULAR80 — time folds: from now on, every player takes two main actions each turn'); } }
    if (c.key === 'fall') for (const q of this.players) if (q.trader) await this.strike(q, 'the FALL FROM GRACE');
    if (c.key === 'feast') { this.log('THE FEAST OF PERPETUAL PROFIT — every player lights a candle'); for (const q of this.players) await this.lightCandle(q, 'the Feast'); }
    // THE HOLY ROLLER (2026-11-26): she rolls for the market. `marketRoll.bull` or higher is a bull round, lower a bear round. A plain roll: no Trader's ability touches it.
    if (c.key === 'holyroller' && c.marketRoll) { if (c.marketRoll.draw) for (const q of this.players) for (let i = 0; i < c.marketRoll.draw; i++) await this.draw(q, true); /* a knob: she still deals everyone a card */ const r = this.roll(), n = c.marketRoll.amount; this.market = r >= c.marketRoll.bull ? n : -n; this.fateRoll = { key: c.key, roll: r };
      this.log(`THE HOLY ROLLER rolls through — the die shows ${r}: a ${this.market > 0 ? 'BULL' : 'BEAR'} market, every Asset sells for $${n}M ${this.market > 0 ? 'more' : 'less'} this round`); }
    else if (c.key === 'holyroller') { for (const q of this.players) { this.collect(q, 1); await this.draw(q, true); } this.log(`THE HOLY ROLLER rolls through — every player draws a card and collects ${this.m(1)}`); }
    if (c.key === 'fuego' && c.market) this.log(`${U('fuego')} rides through the market`); // a bull Fate since 2026-11-26: flipFate has set the market from c.market
    else if (c.key === 'fuego') { this.log(`${U('fuego')} rides through the market`); for (const q of this.players) { this.bank(q, 75, N('fuego')); if (this.over) break; } }
    if (c.key === 'virtual') { for (const q of this.players) { const n = q.hand.length; q.deck.push(...q.hand.splice(0)); q.deck = this.shuffle(q.deck); for (let i = 0; i < n; i++) await this.draw(q, true); this.log(`THE VIRTUAL MARY flickers — ${q.name} shuffles ${n} back and draws ${n}`); } }
    if (c.key === 'techwreck') { let hit = 0;
      // TECH REKT. What is wrecked depends on c.wreck: unset, every Tech Stock (the first rule); 'best', each player's most
      // valuable Asset; 'last', the Asset each bought most recently; 'most', the best Asset of whoever holds the most.
      const value = (a) => this.paperValue(a), H = (q) => this.exposed(q) /* cold storage and an Index Fund are out of reach */, best = (q) => H(q).sort((x, y) => value(y) - value(x))[0];
      const doomed = (q) => !c.wreck ? H(q).filter((a) => a.tech) : !H(q).length ? [] : c.wreck === 'best' ? [best(q)] : c.wreck === 'last' ? [H(q).pop()]
        : c.wreck === 'most' ? (H(q).length === Math.max(...this.players.map((x) => H(x).length)) ? [best(q)] : []) : [];
      for (const q of this.players) for (const a of doomed(q)) { q.invest.splice(q.invest.indexOf(a), 1); q.discard.push(a); this.collect(q, 1); hit++; q.stats.rekt = (q.stats.rekt || 0) + 1; this.log(`${q.name}'s ${a.name.toUpperCase()} is wrecked — scrapped for ${this.m(1)}`); } for (const q of this.players) if (q.location && q.location.tech) { this.log(`${q.name}'s ${q.location.name.toUpperCase()} burns down`); q.discard.push(q.location); q.location = null; hit++; }
      if (!hit) this.log('TECH WRECK — no tech on the table; the bubble bursts over nobody'); }
    if (c.key === 'crash') for (const q of this.players) {
      if (q.invest.some((a) => a.silver)) { this.log(`${q.name} holds ${U('plata')} — flight to safety`); this.bank(q, 25, N('plata')); continue; }
      if (q.liq >= 8) { const lost = Math.floor(q.liq * this.rules.crash); q.liq -= lost; this.log(`${q.name} loses ${this.m(lost)} in the crash`); } }
    if (c.key === 'ballena') {
      const worth = (q) => this.hot(q).reduce((s2, a2) => s2 + this.prosOf(a2), 0); // what the Whale can reach: cold storage is not
      const sorted = [...this.players].sort((a2, b2) => worth(b2) - worth(a2));
      for (const q of sorted) { if (this.rideOrDie(q) && q.invest.length) this.log(`RIDE OR DIE: THE WHALE passes ${q.name}'s portfolio by`); }
      const givers = sorted.filter((q) => !this.rideOrDie(q));
      const rich = givers[0], poor = sorted[sorted.length - 1];
      if (rich && rich !== poor && this.hot(rich).length && worth(rich) > worth(poor)) {
        const best = this.hot(rich).sort((a2, b2) => this.prosOf(b2) - this.prosOf(a2))[0];
        rich.invest.splice(rich.invest.indexOf(best), 1); poor.invest.push(best);
        this.log(`THE WHALE moves ${best.name} from ${rich.name} to ${poor.name}`);
      }
    }
    if (c.key === 'moralhazard') {
      const byLiq = [...this.players].sort((a2, b2) => a2.liq - b2.liq);
      const poor = byLiq[0], rich = byLiq[byLiq.length - 1];
      if (poor !== rich && rich.liq > poor.liq) { this.collect(poor, 5); rich.liq = Math.max(0, rich.liq - 2); this.log(`TOO BIG TO FAIL: ${poor.name} is bailed out (+${this.m(5)}); ${rich.name} pays for prudence (-${this.m(2)})`); }
    }
    if (c.key === 'rueda') {
      const seats = this.players.filter((q) => !this.rideOrDie(q)); const held = this.players.filter((q) => this.rideOrDie(q));
      const n = seats.length; const invs = seats.map((q) => this.hot(q)); const kept = seats.map((q) => q.invest.filter((a) => this.isCold(q, a))); // cold storage stays where it is
      for (let i = 0; i < n; i++) seats[i].invest = [...kept[i], ...invs[(i + n - 1) % n]];
      this.log(n > 1 ? (n === 2 ? 'THE WHEEL turns — the two players swap portfolios' : 'THE WHEEL turns — every portfolio rotates one seat') : 'THE WHEEL turns — but nobody\'s portfolio moves');
      for (const q of held) this.log(`RIDE OR DIE: THE WHEEL passes ${q.name}'s portfolio by`);
    }
    if (c.key === 'swan') {
      // THE BLACK SWAN, the long tail (c.tails: { low, high } how many faces at each end count, and what happens there):
      // the drawer rolls. At the low end the richest player (each, if tied) loses; at the high end the poorest gains;
      // on any other face nothing happens. `lose` and `gain` are a share of their cash (0.5, 1 = half, double) or, with
      // `flat`, an amount in coins. Without c.tails it is the first rule: the richest loses c.swan coins.
      const cash = this.players.map((q) => q.cash), top = Math.max(...cash), bottom = Math.min(...cash);
      if (!c.tails) { for (const q of this.players.filter((x) => x.cash === top)) { const n = Math.min(c.swan * this.rules.rate, q.cash); q.cash -= n; q.stats.swanLost = (q.stats.swanLost || 0) + n; this.log(`THE BLACK SWAN — ${q.name}, the richest, loses $${n}M`); } }
      else { const T = c.tails; let roll = this.roll(); p.stats.swanRolls = (p.stats.swanRolls || 0) + 1;
        if (this.lucky(p) && top !== bottom && ((p.cash === top && roll === (T.low ?? 1)) || (p.cash === bottom && roll === this.rules.die - (T.high ?? 1)))) { roll++; this.log(`LUCKY STREAK — ${p.name}'s die counts as ${roll}`); }
        if (roll <= (T.low ?? 1)) for (const q of this.players.filter((x) => x.cash === top)) { const n = T.flat ? Math.min(T.lose * this.rules.rate, q.cash) : Math.round(q.cash * T.lose); q.cash -= n; q.stats.swanLost = (q.stats.swanLost || 0) + n; this.swanHit = { idx: q.idx, kind: 'lost' }; this.log(`THE BLACK SWAN — the die shows ${roll}: ${q.name}, the richest, loses $${n}M`); }
        else if (roll > this.rules.die - (T.high ?? 1)) for (const q of this.players.filter((x) => x.cash === bottom)) { const n = T.flat ? T.gain * this.rules.rate : Math.round(q.cash * T.gain); q.cash += n; q.stats.swanWon = (q.stats.swanWon || 0) + n; this.swanHit = { idx: q.idx, kind: 'won' }; this.log(`THE BLACK SWAN — the die shows ${roll}: ${q.name}, the poorest, gains $${n}M`); }
        else this.log(`THE BLACK SWAN — the die shows ${roll}: the market shrugs`); } }
    if (c.key === 'moneda') { // THE AIRDROP (2026-11-25): it goes to holders. Every player with at least one Asset (cold storage counts) collects $20M.
      const got = this.players.filter((q) => q.invest.length); for (const q of got) this.collect(q, 2);
      this.log(got.length ? `THE AIRDROP — ${got.map((q) => q.name).join(' and ')} hold${got.length === 1 ? 's' : ''} an Asset and collect${got.length === 1 ? 's' : ''} ${this.m(2)}` : 'THE AIRDROP — nobody holds an Asset: it falls on no one'); }
    const eventResult = {};
    if (c.key === 'mardigras') {
      eventResult.rolls = this.players.map(player => {
        const roll = Math.min(this.rules.die, this.roll() + this.lucky(player)); // Lucky Streak: one more point
        const collected = this.collect(player, roll);
        return { player, roll, collected };
      });
      this.log('MARDI GRAS — ' + eventResult.rolls.map(({player, roll, collected}) =>
        `${player.name} rolled ${roll}: ${collected ? '+' + this.m(collected) : this.m(roll) + ' to the Liquidity Trap'}`).join(' · '));
    }
    if (c.key === 'illuminati') {
      const transfers = eventResult.transfers = [];
      for (const from of this.rivals(p)) {
        if (!from.hand.length) {
          transfers.push({ from, card: null });
          continue;
        }
        const [card] = from.hand.splice(Math.floor(this.rng() * from.hand.length), 1);
        p.hand.push(card);
        transfers.push({ from, card });
        const visible = from.policy.human || p.policy.human;
        this.log(`THE ILLUMIN80 — ${from.name} passed ${visible ? card.name : 'a card'} to ${p.name}`);
      }
    }
    if (this.hooks?.onEvent) await this.hooks.onEvent(p, c, eventResult);
  }
  celebrityBankBonus(p, n, bearProof = false) {
    return this.is(p, 'celebridad') && p.liq >= 1 && (bearProof || !this.hasHaz(p, 'bear')) && !(this.hasHaz(p, 'bear') && n + 25 > 75) ? 25 : 0;
  }
  bank(p, n, src, allowBonus = true, bearProof = false) {
    if (this.hasHaz(p, 'bear') && src !== 'hail' && !bearProof) { if (n > 75) return false; // larger payouts cannot be chosen
      p.pros += n; } else {
      if (allowBonus && src !== 'hail' && this.celebrityBankBonus(p, n, bearProof)) { p.liq -= 1; n += 25; }
      p.pros += n;
    }
    this.log(`${p.name} collects $${n}M (${src}) → net worth $${p.pros}M`);
    return true;
  }
  async lightCandle(p, why) {
    if (this.soulless(p)) { this.log(`${p.trader.name} has no religious observances — the candle (${why}) goes unlit`); return false; }
    if (p.deeds >= 3) return false;
    p.deeds += 1; p.stats.candles++;
    if (this.rules.candleHalo && p.deeds === 1) this.earnHalo(p, 'candle');
    if (this.is(p, 'monje')) this.bank(p, p.trader.vow ?? 25, N('monje'));
    this.restoreStanding(p, 'the candlelight');
    if (p.artifacts.some((a) => a.key === 'rosary')) await this.draw(p);
    this.log(`🕯 ${p.name} lights a candle (${why}) → ${p.deeds} of 3`);
    for (const q of this.players) if (q.location && q.location.key === 'catedral') { this.log(`a green candle in ${U('catedral')}`); this.bank(q, 25, N('catedral')); }
    return true;
  }
  // A gift cuts both ways: the taker gets a card, the giver gets a halo. These two estimates let a bot weigh one
  // against the other — as taker (is the card worth more to me than the halo is to them?) and as giver.
  roundsLeft() { const top = Math.max(...this.players.map((q) => this.netWorth(q))); return Math.max(1, Math.min(6, Math.ceil((this.winAt - top) / 90))); }
  haloWorth(p) { const good = p.trader && (p.trader.credNow == null || p.trader.credNow >= p.trader.cred); return good && !p.trader.earned ? this.rules.rate * Math.max(0, this.roundsLeft() - 1) * (this.rules.income ? 0.75 : 0.25) : 0; } // trade only: a halo is one more point of Ethos, paid on a sale, about one turn in four
  giftValue(to, c) {
    const R = this.rules.rate, price = this.costOf(to, c) * R;
    if (c.type === 'event') return this.hasHaz(to, 'scam') ? 0 : Math.max(0, this.eventPayout(to, c) * (c.bloom ? 0.6 : 1) - price);
    if (c.type === 'asset') return Math.max(0, (c.perp ? c.pros * 2 : c.pros) - price) + (c.income || 0) * R * 3;
    if (c.type === 'trader') return to.trader && c.liq + (c.halo ?? 1) <= to.trader.liq + (to.trader.halo ?? 1) ? 0 : 30;
    if (c.type === 'remedy') return to.hazards.some((h) => clearsHaz(c, h)) ? 45 : c.refresh ? 15 : 8;
    if (c.type === 'grace') return to.deeds >= 3 || to.hailUsed || this.soulless(to) ? 0 : 20;
    if (c.type === 'location') return to.location ? 0 : 20;
    return this.relicsHeld(to).length >= this.relicSlots(to) ? 5 : 18; // a Relic
  }
  // THE EARNED HALO: a good deed puts a halo marker on your seated Trader. One at most.
  earnHalo(p, why) {
    if (!this.rules.earnedHalo || !p.trader || p.trader.earned) return false;
    p.trader.earned = true; p.stats.halos = (p.stats.halos || 0) + 1; p.stats['halo_' + why] = (p.stats['halo_' + why] || 0) + 1;
    this.log(`◯ ${p.trader.name} earns a HALO (${why}) — +${this.m(1)} a turn while in good standing`); return true;
  }
  // Back in good standing. A Scandal card still on the table blocks it, unless the cure says otherwise.
  restoreStanding(p, why, evenUnderScandal = false) {
    const t = p.trader; if (!t || t.credNow == null || t.credNow >= t.cred) return false;
    if (!evenUnderScandal && this.hasHaz(p, 'escandalo')) return false;
    t.credNow = t.cred; delete t.disgraced; p.stats.restored = (p.stats.restored || 0) + 1; this.log(`${why}: ${t.name} is back in good standing`); return true;
  }
  // Credibility damage. At zero the Trader is discredited — unless the Shroud is on the
  // table, or a card with SAVING FACE is spent from the hand (the policy picks).
  async credDamage(p, n, why) {
    if (!p.trader) return;
    // (Until 2026-11-20 a Scandal could not touch The Octobot; with Eight Arms its card no longer says so.)
    p.trader.credNow = (p.trader.credNow == null ? p.trader.cred : p.trader.credNow) - 1; p.stats.strikes = (p.stats.strikes || 0) + 1;
    if (p.trader.earned) { p.trader.earned = false; p.stats.halosLost = (p.stats.halosLost || 0) + 1; this.log(`${p.trader.name}'s earned halo is knocked off`); }
    if (p.trader.credNow > 0) this.log(`${p.trader.name} is IN SCANDAL (${why})`);
    if (p.trader.credNow <= 0) {
      const shroud = p.artifacts.find((a) => a.key === 'shroud');
      if (shroud) { p.artifacts.splice(p.artifacts.indexOf(shroud), 1); p.discard.push(shroud); p.trader.credNow = 1; this.log(`✝ THE SHROUD is spent — ${p.trader.name} stays at ${p.name}'s desk, still in scandal`); }
      else {
        const saviours = p.hand.filter((c) => c.savingGrace);
        const pick = saviours.length ? await p.policy.useSavingGrace(this, p, saviours) : null;
        if (pick && saviours.includes(pick)) { p.hand.splice(p.hand.indexOf(pick), 1); p.discard.push(pick); p.trader.credNow = 1; p.stats.savingGrace = (p.stats.savingGrace || 0) + 1; this.log(`✝ SAVING FACE — ${p.name} gives up ${pick.name}: ${p.trader.name} stays at the desk, still in scandal`); }
        else if (this.rules.disgrace === 'stay') { if (!p.trader.disgraced) { p.trader.disgraced = true; p.stats.disgraces++; this.log(`☠ ${p.trader.name} is DISGRACED (${why}): no ability, no Ethos, no Pathos until back in good standing`); } p.trader.credNow = 0; }
        else { this.log(`☠ ${p.trader.name} is DISCREDITED and leaves ${p.name}'s desk`); p.discard.push(p.trader); p.trader = null; p.stats.disgraces++;
          const cult = p.artifacts.find((x) => x.cult); if (cult) { p.artifacts.splice(p.artifacts.indexOf(cult), 1); p.discard.push(cult); this.log(`the CULT OF PERSONAL80 disbands: it goes to ${p.name}'s discard pile`); } }
      }
    }
  }
  // The God Candle: a flat bonus on every Prosperity sale while it burns (was ×2 — a 500 swing in a race to 1,000).
  saleBonus() { return (this.fx.godcandle ? GOD_CANDLE_BONUS : 0) + (this.market || 0); } // what the round adds to (or takes off) every sale
  saleLabel() { const m = this.market || 0; return (this.fx.godcandle ? ` · GOD CANDLE +${GOD_CANDLE_BONUS}` : '') + (m ? ` · ${m > 0 ? 'BULL MARKET +' : 'BEAR MARKET -'}${Math.abs(m)}` : ''); }
  // What the round adds for THIS seller and Asset. A bear market RAISES the price of a safe haven (Gold Bar: `haven`) and of
  // everything Garth Raider sells (`bearish` on the Trader), by the amount it lowers everyone else's.
  saleBonusFor(p, a) { let m = this.market || 0; if (m < 0 && ((a && a.haven) || (p && p.trader && p.trader.bearish && this.abilityOn(p)))) m = -m; return (this.fx.godcandle ? GOD_CANDLE_BONUS : 0) + m + (p && p.buzzTurn === this.turnNo ? DRINKS.espresso.amount : 0) - ((p && p.saleLess) || 0); } // and an espresso's kick, and champagne's comedown
  saleValue(a) { const o = this.players.find((q) => q.invest.includes(a)); return Math.max(0, this.prosOf(a) + this.saleBonusFor(o, a)); }
  // THE NEXT FATE lies face down on the deck. A Trader with Logos 4, in good standing, reads it (insight is knowing what is
  // coming): Marisol and The Octobot. sellTiming is what waiting a round for it is worth to a sale, for the bots.
  nextFate() { return this.fates && this.fates.length ? this.fates[0] : null; }
  foresees(p) { const t = p.trader; return !!this.fates && !!t && this.abilityOn(p) && (t.credNow == null || t.credNow >= t.cred) && (!!t.reads || (t.logos || 1) >= (this.rules.foresight ?? 4)); }
  sellTiming(p) { const n = this.foresees(p) && this.nextFate(); return n ? (this.market || 0) - (n.market || 0) - (n.key === 'godcandle' ? GOD_CANDLE_BONUS : 0) : 0; }
  eventPayout(p, c) { return c.pros + (c.perHaz ? c.perHaz * p.hazards.length : 0) + (c.perRivalAsset ? c.perRivalAsset * this.rivals(p).reduce((s, q) => s + q.invest.length, 0) : 0) + (p.artifacts.some((a) => a.key === 'geometry') ? 25 : 0); }
  rideOrDie(q) { return q.invest.some((x) => x.key === 'rideordie'); }
  // THE CATACOMBS, cold storage (2026-11-24). An Asset sent down stays in its owner's portfolio with `cold` set. While the
  // Catacombs stand nothing reaches it (Rug Pull, Tech Rekt, The Whale, The Wheel, Paper Hands, a Bear's liquidation, the
  // weather on a Yield Farm) and it cannot be sold or uncorked. It still ages, pays its income and counts for Eugene.
  // hot(q) is what the market can reach. If the Catacombs close, everything is hot again.
  isCold(q, a) { return !!a.cold && !!q.location && !!q.location.vault; }
  hot(q) { return q.invest.filter((a) => !this.isCold(q, a)); }
  // COMPANIONS AND SETS (2026-11-26; designs.js). comp(): the seated Trader's companion entry if `key` is their card, else null.
  comp(q, key) { const t = q && q.trader; return t && t.companion && t.companion.card === key && this.abilityOn(q) ? t.companion : null; }
  setMate(q, a) { return !!a.set && q.invest.some((x) => x !== a && x.set === a.set); }
  pairBonus(a) { const o = this.players.find((q) => q.invest.includes(a)); if (!o) return 0; const c = this.comp(o, a.key); return (c && c.kind === 'sale' ? c.amount : 0) + (c && c.growth && a.grow && a.bornTurn != null ? (c.growth - 1) * a.grow * Math.max(0, Math.floor((this.turnNo - a.bornTurn) / this.players.length)) : 0) /* Byzantine General's companion: his Savings Bond grows faster */ + (this.setMate(o, a) ? SET_BONUS : 0); }
  exposed(q) { return this.hot(q).filter((a) => !a.diversified); } // what a Rug Pull or Tech Rekt can take: not cold storage, not an Index Fund
  async coldStorage(p) {
    const loc = p.location; if (!loc || !loc.vault || !p.invest.length || !p.policy.coldMove) return;
    const a = await p.policy.coldMove(this, p, loc); if (!a || !p.invest.includes(a)) return;
    if (this.isCold(p, a)) { delete a.cold; p.stats.thawed = (p.stats.thawed || 0) + 1; this.log(`${p.name} brings ${a.name} up from ${U('catacumbas')}`); }
    else { a.cold = true; p.stats.stored = (p.stats.stored || 0) + 1; this.log(`${p.name} sends ${a.name} down into ${U('catacumbas')}: cold storage`); }
    if (this.hooks && this.hooks.render) await this.hooks.render();
  }
  // CULT OF PERSONAL80: while it is equipped and a Trader is seated, no other Trader can be played over them.
  cultBound(p) { return !!p.trader && p.artifacts.some((a) => a.cult); }
  // Relic slots: two, three with the Motherboard — which sits outside the count.
  relicSlots(p) { return 2 + (p.artifacts.some((a) => a.slots) ? 1 : 0); }
  relicsHeld(p) { return p.artifacts.filter((a) => !a.slots && !a.noSlot); }
  // DIAMOND HANDS: an Asset its holder has kept three rounds or more is worth that much more.
  diamondOf(a) { if (a.bornTurn == null || this.turnNo - a.bornTurn < 3) return 0; const o = this.players.find((q) => q.invest.includes(a)); const d = o && o.artifacts.find((x) => x.diamond); return d ? d.diamond : 0; }
  // THE PREDICTION MARKET, a Location. The face contract i needs: The Gambler's are one lower, except the
  // long shot (the top face is the top face for everyone).
  marketNeed(p, loc, i) { const face = loc.market[i][0]; return face >= this.rules.die ? face : Math.max(2, face - this.lucky(p)); }
  // The contracts open to p right now: none without the stake; under a Bear Market, none that pays over 75.
  marketOffers(p) { const loc = p.location; if (!loc || !loc.market || p.liq < loc.stake) return []; return loc.market.map((m, i) => i).filter((i) => !(this.hasHaz(p, 'bear') && loc.market[i][1] > 75)); }
  // One bet a turn, before the main action: stake, name the odds, roll. A Miracle can roll a miss again.
  // PAWN SHOP: once on your turn, before the main action, a card from the hand goes to the discard pile for cash.
  async pawnShop(p) {
    const loc = p.location; if (!loc || !loc.pawn || !p.hand.length || !p.policy.pawnCard) return;
    const c = await p.policy.pawnCard(this, p, loc); if (!c || !p.hand.includes(c)) return;
    p.hand.splice(p.hand.indexOf(c), 1); p.discard.push(c); this.collect(p, loc.pawn); p.stats.pawned = (p.stats.pawned || 0) + 1;
    this.log(`${p.name} pawns ${c.name} at the ${loc.name} for ${this.m(loc.pawn)}`);
    if (this.hooks && this.hooks.render) await this.hooks.render();
  }
  async marketBet(p) {
    const offers = this.marketOffers(p); if (!offers.length || !p.policy.placeBet) return;
    const i = await p.policy.placeBet(this, p, p.location, offers); if (i == null || !offers.includes(i)) return;
    const loc = p.location, pay = loc.market[i][1], need = this.marketNeed(p, loc, i);
    p.liq -= loc.stake; p.stats.marketCalls = (p.stats.marketCalls || 0) + 1; p.stats['marketCall' + i] = (p.stats['marketCall' + i] || 0) + 1;
    let roll = this.roll();
    if (roll < need && await this.miracle(p, { kind: 'gamble', name: loc.name, roll })) roll = this.roll();
    if (roll >= need) { p.stats.marketWins = (p.stats.marketWins || 0) + 1; this.bank(p, pay, `${loc.name} — ${p.name} staked ${this.m(loc.stake)} on ${need >= this.rules.die ? 'an ' + need : need + '+'}, the die shows ${roll}: IT RESOLVES YES`, false); }
    else this.log(`${loc.name} — ${p.name} staked ${this.m(loc.stake)} on ${need >= this.rules.die ? 'an ' + need : need + '+'}, the die shows ${roll}: it resolves NO, and the stake is lost`);
    if (this.hooks && this.hooks.render) await this.hooks.render();
  }
  prosOf(a) { return this.baseProsOf(a) + this.diamondOf(a) + this.pairBonus(a); }
  baseProsOf(a) {
    if (a.gem) { const o = this.players.find((q) => q.invest.includes(a)); return o && o.deeds >= 3 ? a.gem : a.pros; }
    if (a.ripe) { const held = this.turnNo - a.bornTurn; return held < 2 ? 50 : Math.max(0, 150 - 50 * (held - 2)); }
    if (a.perp) return a.pros * 2;
    if (a.bloom && this.turnNo - a.bornTurn >= 4) return a.bloom; if (a.grow) return a.pros + a.grow * Math.max(0, Math.floor((this.turnNo - a.bornTurn) / this.players.length)); return a.pros; }
  clearHazard(victim, h, by, why) {
    this.releaseTrap(victim, h);
    victim.hazards.splice(victim.hazards.indexOf(h), 1); h.owner.discard.push(h); victim.stats.hazCleared++;
    this.log(`${why}: ${h.name} off ${victim.name}`);
  }
  // La Investigadora's open book: the card her player can see, and the once-a-turn burial.
  // LOGOS: insight. With the attributes on, a Trader in good standing looks at the top Logos cards of the
  // deck and draws one of them; the rest stay on top in their order. A Trader in scandal draws blind.
  logos(p) { const far = (p.location && p.location.foresight) || 0; /* BACK TO THE 80s: one more card, whoever is at the desk */ const t = p.trader; if (!this.rules.attrs || !t) return 1 + far; const good = t.credNow == null || t.credNow >= t.cred; return (good ? t.logos || 1 : 1) + far; }
  async turnDraw(p) {
    const n = Math.min(this.logos(p), p.deck.length);
    if (n > 1) { const seen = p.deck.slice(0, n); const pick = p.policy.pickDraw ? await p.policy.pickDraw(this, p, seen) : seen[0];
      if (pick && pick !== seen[0] && seen.includes(pick)) { p.deck.splice(p.deck.indexOf(pick), 1); p.deck.unshift(pick); p.stats.logosPicks = (p.stats.logosPicks || 0) + 1; }
      p.stats.logosLooks = (p.stats.logosLooks || 0) + 1;
      // DUE DILIGENCE (Marisol): what she looked at and did not take goes to the bottom, so her next look is all new.
      if (this.is(p, 'investigadora')) p.deck.push(...p.deck.splice(1, n - 1)); }
    return await this.draw(p);
  }
  // What a card on top of the deck is worth to the player about to draw it (the bots' Logos choice).
  drawWorth(p, c) {
    if (c.type === 'event' && !c.played) return c.subtype === 'Calamity' ? -80 : c.subtype === 'Ambiguity' ? 5 : 25; // it fires, and a replacement is drawn
    if (c.type === 'hazard') return this.rivals(p).some((r) => this.canHit(r, c)) ? 35 : 5;
    return this.giftValue(p, c);
  }
  // (With the attributes on, Marisol's insight is her Logos, and her ability works on that draw: see turnDraw.)
  topCard(p) { return !this.rules.attrs && this.is(p, 'investigadora') ? p.deck[0] || null : null; }
  canBury(p) { return !this.rules.attrs && this.is(p, 'investigadora') && this.active === p && !p.buriedThisTurn && p.deck.length > 1; }
  bury(p) {
    if (!this.canBury(p)) return false;
    const top = p.deck.shift(); p.deck.push(top); p.buriedThisTurn = true; p.stats.buries = (p.stats.buries || 0) + 1;
    this.log(`DUE DILIGENCE — ${p.name} reads the tape and sends ${top.name} to the bottom`); return true;
  }
  // One die for the whole game (RULES.die). The targets printed for a d6 move up one on the d8.
  roll() { return 1 + Math.floor(this.rng() * this.rules.die); }
  d8() { return this.rules.die === 8 ? 1 : 0; }
  // THE TRACK: an Asset with a `venue` wins on more faces while its holder has that Location open (Racehorse at the Prediction Market).
  atVenue(p, a) { return a.venue && p && p.location && p.location.key === a.venue.location ? a.venue.n : 0; }
  gambleNeed(p, a) { const c = this.comp(p, a.key); return (a.gambleOn || 5) + this.d8() - this.lucky(p) - (c && c.kind === 'gamble' ? c.n : 0) - this.atVenue(p, a) - (p.champTurn === this.turnNo ? DRINKS.alcohol.faces : 0); }
  gambleOdds(p, a) { return (this.rules.die + 1 - this.gambleNeed(p, a)) / this.rules.die; }
  spend(p, n) { if (p.liq < n) return false; p.liq -= n; return true; }
  // Income, not refunds: under a LIQUIDITY TRAP the coins pile on the card instead.
  collect(p, n) {
    if (!(n > 0)) return 0;
    const trap = p.hazards.find((h) => h.key === 'trap');
    if (trap) { trap.pile = (trap.pile || 0) + n; this.log(`${p.name}'s ${this.m(n)} falls into the LIQUIDITY TRAP (${this.m(trap.pile)} trapped)`); return 0; }
    p.liq += n; return n;
  }
  releaseTrap(victim, h) { if (h.key === 'trap' && h.pile) { victim.liq += h.pile; this.log(`the trap springs open: ${victim.name} recovers ${this.m(h.pile)}`); h.pile = 0; } }
  costOf(p, c) { let n = c.cost; { const k = this.comp(p, c.key); if (k && k.kind === 'cost') n = Math.max(0, n - k.off); } // Marisol's companion: a Blue Chip costs her less
    if (c.type === 'asset' && this.is(p, 'prospector')) n = Math.max(0, n - (p.trader.discount ?? 1)); if (c.type === 'asset' && this.sale) n = Math.max(0, n - this.sale); if (c.type === 'asset' && this.saleRate) n = n * (1 - this.saleRate); return n; } // SPECIAL OFFER: a round's sale comes off every Asset, on top of the Prospector's own
  odds(p) { const lit = this.hasHaz(p, 'virtue') ? 0 : Math.min(3, p.deeds); return Math.min(HAIL_DIE_SIDES, ODDS[Math.min(ODDS.length - 1, lit + (p.fountain || 0))] + this.lucky(p)); }

  // ── the main actions ──
  async playCard(p, c, choice = {}) {
    const cost = this.costOf(p, c); if (!this.spend(p, cost)) return false;
    p.hand.splice(p.hand.indexOf(c), 1); p.stats.plays++;
    switch (c.type) {
      case 'asset': c.bornTurn = this.turnNo; p.invest.push(c); this.log(`${p.name} invests in ${c.name}`);
        break;
      case 'event': { // a played Event (Bull Run, Full Moon, The Inheritance); fired ones never reach a hand
        if (c.short) { // THE SHORT (2026-11-26): a position against one Asset a rival holds. It waits with its player (p.shorts) until that Asset leaves their portfolio: settleShorts()
          const list = this.shortable(p); const pick = choice.asset || (p.policy.shortPick ? await p.policy.shortPick(this, p, list) : list.length ? list[list.length - 1].a : null); const on = list.find((x) => x.a === pick);
          if (!on) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; }
          c.on = on.a; c.onPlayer = on.q; c.bornTurn = this.turnNo; on.a.shortBy = p.idx; c.pays = c.short + ((this.comp(p, c.key) || {}).more || 0); /* Garth Raider's companion: his Shorts pay more */ p.shorts.push(c); p.stats.shorts = (p.stats.shorts || 0) + 1;
          this.log(`${p.name} plays ${c.name} on ${on.q.name}'s ${on.a.name}`); break; }
        if (c.bloom) { c.bornTurn = this.turnNo - ((this.comp(p, c.key) || {}).sooner || 0); /* Eugene's companion: his Seed Round is that many rounds along already */ p.seeds.push(c); this.log(`${p.name} plants ${c.name} — it blooms in ${c.bloom} rounds`); break; }
        if (c.choice && choice.cash) { this.collect(p, c.cash); p.discard.push(c); p.stats.inheritCash = (p.stats.inheritCash || 0) + 1; this.log(`${p.name} cashes ${c.name} for ${this.m(c.cash)}`); }
        // THE INHERITANCE in trust (c.trust, in rounds): not taken now, it is set aside like a planted seed and pays c.pros when it matures
        else if (c.choice && c.trust) { c.bornTurn = this.turnNo; p.seeds.push(c); p.stats.inheritTrust = (p.stats.inheritTrust || 0) + 1; this.log(`${p.name} puts ${c.name} in trust — it pays $${c.pros}M in ${c.trust} rounds`); }
        else { const n = this.eventPayout(p, c); const ok = this.bank(p, n, c.name + (c.perHaz && p.hazards.length ? ` · ${p.hazards.length} Calamit${p.hazards.length === 1 ? 'y' : 'ies'} squeezed` : '') + (p.artifacts.some((a) => a.key === 'geometry') ? ' · SACRED GEOMETRY +25' : ''), true, !!c.bearProof); if (!ok) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; } /* banked cards leave the deck */
          if (c.rivalsCollect) { for (const q of this.rivals(p)) this.collect(q, c.rivalsCollect); this.log(`${c.name.toUpperCase()}: every rival collects ${this.m(c.rivalsCollect)}`); } }
        break; }
      case 'hazard': {
        const t = choice.target; c.landed = false; if (!t || !this.canHit(t, c)) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; }
        // reaction: Sacred Heart
        const heart = t.artifacts.find((a) => a.key === 'heart');
        if (heart && await t.policy.useHeart(this, t, c, p)) { t.artifacts.splice(t.artifacts.indexOf(heart), 1); t.discard.push(heart); p.discard.push(c); this.log(`${t.name} spent ${heart.name} to block ${c.name}. ${c.name} went to ${p.policy.human ? 'your' : p.name + "’s"} discard pile.`); return true; }
        // EQUANIMITY: a seated Trader's composure. The Calamity fails on a roll of eq or lower — a stat, so a Quantum Hack does not switch it off.
        const eq = t.trader && !t.trader.disgraced ? (t.trader.eq || 0) + t.artifacts.reduce((n, x) => n + (x.pathos || 0), 0) + this.lucky(t) : 0; // THE TALISMAN: one more Pathos
        if (eq > 0) { let roll = this.roll();
          if (roll > eq && await this.miracle(t, { kind: 'pathos', name: `${t.trader.name}'s roll against ${c.name}`, roll })) roll = this.roll();
          if (roll <= eq) { p.discard.push(c); this.log(`${t.name} blocked ${c.name}. ${t.trader.name} rolled ${roll} on a d${this.rules.die}. ${this.rules.attrs ? 'Pathos' : 'Equanimity'} ${eq} blocks on ${eq} or lower. ${c.name} went to ${p.policy.human ? 'your' : p.name + "’s"} discard pile.`); t.stats.eqSaves = (t.stats.eqSaves || 0) + 1;
            if (this.is(t, 'general')) { this.collect(t, 1); this.log(`FAULT TOLERANCE — ${t.name} collects ${this.m(1)}`); } return true; }
          this.log(`the die shows ${roll} against ${this.rules.attrs ? 'PATHOS' : 'EQUANIMITY'} ${eq} — ${c.name} lands`); }
        if (c.hit) { // a fraud: it happens once and is over — nothing stays on the table
          p.stats.hazPlayed++; c.landed = true; c.hitLine = this.resolveHit(p, t, c); this.log(`${p.name} plays ${c.name} on ${t.name}: ${c.hitLine}`); p.discard.push(c);
          if (this.rules.calamityStrikes) await this.strike(t, c.name);
          break; }
        c.owner = p; c.by = p.idx; t.hazards.push(c); p.stats.hazPlayed++;
        this.log(`${p.name} plays ${c.name} on ${t.name}`);
        if (c.key === 'bear') for (const a of this.hot(t)) if (a.perp) { t.invest.splice(t.invest.indexOf(a), 1); t.discard.push(a); this.log(`${t.name}'s ${a.name} is LIQUIDATED by the Bear`); }
        if (c.key === 'escandalo') await this.strike(t, 'the SCANDAL breaks');
        else if (this.rules.calamityStrikes) await this.strike(t, c.name); // any Calamity that lands is a strike
        break; }
      case 'remedy': {
        if (choice.refresh) { // Horchata: discard up to c.refresh, draw that many plus one
          const picked = (choice.discards || []).filter((x) => x !== c && p.hand.includes(x)).slice(0, c.refresh);
          for (const x of picked) { p.hand.splice(p.hand.indexOf(x), 1); p.discard.push(x); }
          p.discard.push(c); const drawn = []; for (let i = 0; i <= picked.length; i++) { const d = await this.draw(p, true); if (d) drawn.push(d); }
          this.log(`${p.name} drinks ${c.name.toUpperCase()} — lets go of ${picked.length} and draws ${drawn.length}`); break; }
        if (c.rewind) { // REWIND: the last card you discarded comes back to your hand
          const back = this.rewindable(p); if (!back) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; }
          p.discard.splice(p.discard.lastIndexOf(back), 1); if (back.type === 'trader') { delete back.credNow; delete back.earned; }
          p.hand.push(back); p.discard.push(c); p.stats.rewinds = (p.stats.rewinds || 0) + 1;
          this.log(`${p.name} plays ${c.name}: ${back.name} is back in hand`); break; }
        // THE WHISTLEBLOWER (any Calamity since 2026-11-25): on a fraud, it is undone (this branch); on any other Calamity played on
        // you, it is cleared (below). Either way the rival who played it takes a strike.
        if (c.whistle && (choice.whistle || !choice.hazard)) {
          const f = p.lastFraud; if (!f) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; }
          let got = 'nothing was left to take back';
          if (f.asset) { const k = p.discard.indexOf(f.asset); if (k >= 0) { p.discard.splice(k, 1); p.invest.push(f.asset); got = `${f.asset.name} is back in ${p.name}'s portfolio`; } }
          else if (f.stolen) { const n = Math.min(f.amount, f.by.cash); f.by.cash -= n; p.cash += n; got = `${p.name} takes $${n}M back from ${f.by.name}`; }
          else { p.cash += f.amount; got = `${p.name} is made whole: $${f.amount}M`; }
          p.lastFraud = null; p.discard.push(c); p.stats.whistles = (p.stats.whistles || 0) + 1;
          this.log(`${p.name} plays ${c.name} on ${f.name}: ${got}`);
          await this.strike(f.by, 'THE WHISTLEBLOWER');
          break; }
        if (choice.polish) { this.restoreStanding(p, 'THE PRESS RELEASE'); p.discard.push(c); break; }
        const t = choice.target || p; const h = choice.hazard || t.hazards.find((x) => clearsHaz(c, x));
        if (!h) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; }
        const back = c.bounce && h.owner !== t && !this.hasHaz(h.owner, h.key) && !this.warded(h.owner, h.key) ? h.owner : null;
        if (back) { this.releaseTrap(t, h); t.hazards.splice(t.hazards.indexOf(h), 1); t.stats.hazCleared++; back.hazards.push(h); this.log(`${p.name} plays ${c.name}: ${h.name} off ${t.name} — kicked back onto ${back.name}`); }
        else this.clearHazard(t, h, p, `${p.name} plays ${c.name}`);
        if (c.whistle && h.owner && h.owner !== p) { p.stats.whistles = (p.stats.whistles || 0) + 1; await this.strike(h.owner, 'THE WHISTLEBLOWER'); }
        if (c.key === 'publicista' && h.key === 'escandalo') this.restoreStanding(t, 'THE PRESS RELEASE');
        p.discard.push(c);
        if (t !== p) { p.stats.remedyRival++; this.earnHalo(p, 'remedy'); }
        break; }
      case 'location': {
        if (p.location) { p.discard.push(p.location); this.log(`${p.name} tears down ${p.location.name}`); }
        for (const a of p.invest) delete a.cold; // a new place: nothing is in cold storage yet
        c.figures = 0; p.location = c; this.log(`${p.name} builds ${c.name}`); break; }
      case 'artifact': {
        if (!c.slots && this.relicsHeld(p).length >= this.relicSlots(p)) { const drop = choice.drop || this.relicsHeld(p)[0]; p.artifacts.splice(p.artifacts.indexOf(drop), 1); p.discard.push(drop); this.log(`${p.name} unequips ${drop.name}`); }
        p.artifacts.push(c); this.log(`${p.name} equips ${c.name}`); if ((this.comp(p, c.key) || {}).candle) await this.lightCandle(p, `${c.name}, in his own hands`); /* Saint GR80's companion */ break; }
      case 'trader': {
        if (p.trader) {
          this.log(`${p.name} discards ${p.trader.name} to seat ${c.name}`);
          p.discard.push(p.trader);
        }
        c.credNow ??= c.cred;
        p.trader = c;
        p.stats.hires++;
        this.log(`${p.name} seats ${c.name} at the desk (income ${this.m(c.liq)} · ${standing(c)} · ${this.rules.attrs ? 'Pathos' : 'Equanimity'} ${c.eq || 0})`);
        if (c.key === 'gato' && p.hazards.length && this.abilityOn(p)) {
          this.clearHazard(p, choice.hazard || p.hazards[0], p, `${U('gato')} knocks it off the table`);
        }
        break; }
      case 'grace': {
        if (c.key === 'rose') {
          const t = choice.target; if (!t) { p.liq += cost; p.hand.push(c); p.stats.plays--; return false; }
          this.log(`${p.name} offers THE ROSE to ${t.name}`);
          if (await t.policy.acceptRose(this, t, p)) { c.bornTurn = this.turnNo; t.invest.push(c); this.log(`${t.name} accepts the Rose`); await this.lightCandle(p, 'the Rose, accepted'); }
          else { p.hand.push(c); this.log(`${t.name} declines the Rose`); }
          break; }
        if (c.key === 'fountain') { p.fountain = (p.fountain || 0) + 1; this.log(`${p.name} tosses a coin in THE FOUNTAIN — Hail Mary odds rise to ${this.odds(p)}/${HAIL_DIE_SIDES}`); break; }
        // the card itself is the offering: it leaves the game for the shrine
        this.log(`${p.name} places ${c.name} at Our Lady’s shrine`);
        await this.lightCandle(p, c.name);
        if (c.key === 'cherub') await this.draw(p);
        if (c.visit) { // THE VISITOR: she arrives (draw two) or she departs (a card comes back from the discard pile)
          const back = p.discard.filter((x) => !(x.type === 'event' && !x.played));
          const pick = p.policy.visit ? await p.policy.visit(this, p, back) : null;
          if (pick && back.includes(pick)) { p.discard.splice(p.discard.lastIndexOf(pick), 1); if (pick.type === 'trader') { delete pick.credNow; delete pick.earned; } p.hand.push(pick); p.stats.departs = (p.stats.departs || 0) + 1; this.log(`THE VISITOR departs — and ${pick.name} is back in ${p.name}'s hand`); }
          else { p.stats.arrives = (p.stats.arrives || 0) + 1; const n = c.visit === true ? 2 : c.visit; this.log(`THE VISITOR arrives — ${p.name} draws ${n === 1 ? 'a card' : n + ' cards'}`); for (let k = 0; k < n; k++) await this.draw(p); } }
        if (c.abduct) { // THE VISITOR, a trial rule (unset on the design): a seated Trader goes back to its owner's hand, restored
          const seats = this.players.filter((q) => q.trader && (c.abduct === 'any' || (c.abduct === 'own' ? q === p : q !== p)));
          const who = seats.length && p.policy.abduct ? await p.policy.abduct(this, p, seats) : null;
          if (who && seats.includes(who)) { const t = who.trader; who.trader = null; delete t.credNow; delete t.earned; who.hand.push(t); p.stats.abducted = (p.stats.abducted || 0) + 1; if (who === p) p.stats.abductedOwn = (p.stats.abductedOwn || 0) + 1;
            this.log(`THE VISITOR — ${t.name} is taken up from ${who.name}'s desk, and set down in ${who === p ? 'their own' : who.name + "'s"} hand`); } }
        if (c.key === 'limpia' && p.hazards.length) this.clearHazard(p, choice.hazard || p.hazards[0], p, 'LA LIMPIA sweeps it away');
        if (c.key === 'anima') { const back = [...p.discard].reverse().find((x) => x.type === 'trader'); if (back) { p.discard.splice(p.discard.indexOf(back), 1); back.credNow = 1; if (p.trader) p.hand.push(back); else p.trader = back; this.log(`${U('anima')} — ${back.name} returns from purgatory to ${p.name}'s ${p.trader === back ? 'desk' : 'hand'}, in scandal`); } else this.log(`${U('anima')} — nobody to bring back`); }
        if (c.key === 'confession') { this.restoreStanding(p, 'THE CONFESSION absolves', true); const hell = p.hazards.find((h) => h.key === 'infierno'); if (hell) this.clearHazard(p, hell, p, 'THE CONFESSION absolves'); }
        break; }
    }
    this.witness(p, c); // an apparition card played from the hand
    return true;
  }
  // ETHOS, trade only: a better price. Each point of the seated Trader's Ethos (and an earned halo, which is one more point)
  // adds ETHOS_UNIT $M to an Asset they sell while in good standing. A forced sale (Paper Hands) is not theirs, and pays none.
  ethosBonus(p) { const t = p.trader; if (this.rules.income || !t || !this.abilityOn(p) || !(t.credNow == null || t.credNow >= t.cred)) return 0; return ((t.ethos || 0) + (t.earned ? 1 : 0)) * (this.rules.ethosSale ?? ETHOS_UNIT); }
  async sell(p, a, wantPros) {
    const held = p.invest.includes(a), bonus = this.ethosBonus(p); const ok = await this.sellAsset(p, a, wantPros);
    if (held && !p.invest.includes(a) && bonus) { this.collect(p, bonus / this.rules.rate); p.stats.ethosPaid = (p.stats.ethosPaid || 0) + bonus; this.log(`${p.trader.name}'s good name: ${p.name} collects $${bonus}M more on the sale`); }
    return ok;
  }
  async sellAsset(p, a, wantPros) {
    if (this.hasHaz(p, 'rug')) return false; if (a.bornTurn === this.turnNo && !this.quick(p, a)) return false; if (this.isCold(p, a)) return false; if (a.bullOnly && !(this.saleBonus() > 0)) return false; // FINE ART: a bull market only
    const base = this.prosOf(a), diamond = this.diamondOf(a);
    p.invest.splice(p.invest.indexOf(a), 1); p.stats.sells++; a.soldAt = { turn: this.turnNo, bull: this.saleBonus() > 0 }; // The Short reads how it was sold
    // SAINT'S SKULL: its holder takes a cut of each sale (`cut`, in old coins); of a rival's only, or of their own too (`cutAll`).
    for (const q of this.players) { const sk = q.artifacts.find((x) => x.key === 'skull'); if (sk && (q !== p || sk.cutAll)) { const n = sk.cut ?? 1; this.collect(q, n); q.stats.skullCut = (q.stats.skullCut || 0) + n * this.rules.rate; this.log(`${q.name} holds the SAINT’S SKULL: +${this.m(n)} from ${q === p ? 'their own' : p.name + "'s"} sale`); } }
    if (wantPros && a.gamble) {
      let roll = this.roll(); p.stats.sellPros++;
      const need = this.gambleNeed(p, a);
      if (roll < need && await this.miracle(p, { kind: 'gamble', name: a.name, roll })) roll = this.roll();
      if (roll >= need) { const ok = this.bank(p, Math.max(0, a.pros + this.saleBonusFor(p, a) + diamond), `${a.name} — the die shows ${roll}: IT ${a.gambleOn ? 'GUSHES' : 'MOONS'}${this.saleLabel()}`); if (!ok) { p.invest.push(a); p.stats.sells--; p.stats.sellPros--; return false; } }
      else if (a.bust) { p.discard.push(a); this.bank(p, a.bust, `${a.name} — the die shows ${roll}: it runs dry`); }
      else { p.discard.push(a); this.log(`${p.name} sells ${a.name}… the die shows ${roll}: it goes to zero`); }
      this.recycle(p, a); await this.mapDraw(p);
      return true;
    }
    if (wantPros) { const bonus = this.saleBonusFor(p, a); const ok = this.bank(p, Math.max(0, base + bonus), a.name + (a.bloom && base === a.bloom ? ' IN BLOOM' : '') + this.saleLabel(), true, !!a.bearProof); if (!ok) { p.invest.push(a); p.stats.sells--; return false; } p.stats.sellPros++; /* banked */ }
    else { this.collect(p, a.cash); p.discard.push(a); p.stats.sellCash++; this.log(`${p.name} sells ${a.name} for ${this.m(a.cash)}`); }
    this.recycle(p, a); await this.mapDraw(p);
    return true;
  }
  // ── THE BAR (rules.bar; DRINKS) ──
  drinkName(p, k) { return p.trader && p.trader.key === 'bot' ? DRINKS[k].boost : DRINKS[k].name; }
  ownDrink(p, k) { return !!(p.trader && p.trader.prefers === k); }
  canDrink(p, k) { return !!this.rules.bar && !!DRINKS[k] && this.active === p && !this.over && p.drankTurn !== this.turnNo && !(p.lastDrink === k && p.lastDrinkTurn === this.turnNo - 1); }
  async drink(p, k) {
    if (!this.canDrink(p, k)) return false; const d = DRINKS[k], own = this.ownDrink(p, k); p.drankTurn = this.turnNo; p.lastDrink = k; p.lastDrinkTurn = this.turnNo; p.stats.drinks = (p.stats.drinks || 0) + 1;
    if (k === 'espresso') { p.buzzTurn = this.turnNo; if (!own) { p.cdNext.drawLess = true; p.cdNext.noBuy = true; } }
    if (k === 'energy') { p.extraActions = (p.extraActions || 0) + d.actions; p.wiredTurn = this.turnNo; if (!own) { p.cdNext.drawLess = true; p.cdNext.noBuy = true; p.cdNext.abilityOff = true; } }
    if (k === 'alcohol') { if (d.faces) p.champTurn = this.turnNo; if (d.shield !== false) p.shield = true; if (!own) p.cdNext.abilityOff = true; } // `faces: 0` or `shield: false` on the drink turns one half off
    if (k === 'sugar') { for (let i = 0; i < d.cards; i++) await this.draw(p, true); if (!own) p.cdEnd = true; }
    p.kick = { k, own }; if (!own) p.cdNext.from = k;
    this.log(`${p.name} ${p.trader && p.trader.key === 'bot' ? 'runs' : 'orders'} ${this.drinkName(p, k)}: ${d.kick[0].toLowerCase() + d.kick.slice(1)}${own ? ' (their own: no comedown)' : ''}`); return true;
  }
  async barStep(p) { if (!this.rules.bar || !p.policy.orderDrink) return; const k = await p.policy.orderDrink(this, p); if (k) await this.drink(p, k); }
  // ── TRADING WITH THE RIVAL (rules.trade) ──
  // What an Asset would fetch for q if q held it and sold it, in $M: its price, q's companion and set bonuses, q's Ethos, a gamble at q's odds.
  assetWorth(q, a) {
    let base = a.bornTurn != null && (a.ripe || a.grow) ? this.baseProsOf(a) : a.gem ? (q.deeds >= 3 ? a.gem : a.pros) : a.perp ? a.pros * 2 : a.ripe ? 100 : a.pros;
    if (a.bullOnly) base *= 0.6;
    const c = this.comp(q, a.key);
    if (a.gamble) { const need = (a.gambleOn || 5) + this.d8() - this.lucky(q) - (c && c.kind === 'gamble' ? c.n : 0) - this.atVenue(q, a); const P = Math.max(0, Math.min(1, (this.rules.die + 1 - need) / this.rules.die)); base = Math.max(a.cash * this.rules.rate, P * a.pros + (1 - P) * (a.bust || 0)); }
    return base + (c && c.kind === 'sale' ? c.amount : 0) + (c && c.kind !== 'sale' && c.kind !== 'gamble' ? 25 : 0) + (a.set && q.invest.some((x) => x !== a && x.set === a.set) ? SET_BONUS : 0) + this.ethosBonus(q) + (a.income ? a.income * this.rules.rate * 2 : 0);
  }
  // What a card is worth to q, in $M: `held` in the portfolio (what it would sell for), or in the hand (less what it costs q to play).
  tradeWorth(q, c, held) {
    const R = this.rules.rate, k = this.comp(q, c.key);
    if (c.type === 'asset') { const w = this.assetWorth(q, c); return held ? w : Math.max(0, w - this.costOf(q, c) * R); }
    if (c.short) return Math.max(0, 0.5 * (c.short + ((k || {}).more || 0)) * R - this.costOf(q, c) * R);
    return this.giftValue(q, c) + (k ? 25 : 0);
  }
  tradeable(p) { return [...this.hot(p).map((c) => ({ c, held: true })), ...p.hand.map((c) => ({ c, held: false }))]; }
  canOffer(p) { return !!this.rules.trade && p.offeredTurn !== this.turnNo && this.rivals(p).length > 0; }
  // The offer: true if the rival bought it, false if they refused or could not pay, null if no offer could be made.
  async offerSale(p, c, price) {
    const r = this.rivals(p)[0], held = p.invest.includes(c); if (!this.canOffer(p) || !r || !(held ? !this.isCold(p, c) : p.hand.includes(c)) || !(price >= 0)) return null;
    p.offeredTurn = this.turnNo; p.stats.offersMade = (p.stats.offersMade || 0) + 1; const seen = p.policy.human || r.policy.human || held ? c.name : 'a card';
    if (r.cash < price) { this.log(`${p.name} offers ${seen} to ${r.name} for $${price}M — they cannot pay it`); return false; }
    if (!(r.policy.acceptTrade && await r.policy.acceptTrade(this, r, p, c, price, held))) { this.log(`${p.name} offers ${seen} to ${r.name} for $${price}M — declined`); return false; }
    r.cash -= price; p.cash += price;
    if (held) { p.invest.splice(p.invest.indexOf(c), 1); delete c.cold; r.invest.push(c); } else { p.hand.splice(p.hand.indexOf(c), 1); if (c.type === 'trader') { delete c.credNow; delete c.earned; } r.hand.push(c); }
    p.stats.tradesSold = (p.stats.tradesSold || 0) + 1; p.stats.tradeMoney = (p.stats.tradeMoney || 0) + price; this.log(`${p.name} sells ${c.name} to ${r.name} for $${price}M`);
    this.settleShorts(); return true; // a sale to the rival is a way of leaving the portfolio: a Short on it pays
  }
  async tradeStep(p) { if (!this.canOffer(p) || !p.policy.proposeTrade) return; const o = await p.policy.proposeTrade(this, p); if (o && o.c) await this.offerSale(p, o.c, o.price); }
  // A SOLD ASSET goes to its seller's discard pile (rules.recycle), so the Assets never run out.
  recycle(p, a) { p.saleLess = 0; if (a.gamble) p.champ = false; /* a sale has been made: champagne's comedown, or its kick, is spent */ if (this.rules.recycle && !this.players.some((q) => q.invest.includes(a) || q.discard.includes(a))) { delete a.cold; p.discard.push(a); } }
  // THE SHORT. What can be shorted: a rival's Asset that is not in cold storage and has no Short on it yet.
  shortable(p) { return this.rivals(p).flatMap((q) => this.hot(q).filter((a) => a.shortBy == null).map((a) => ({ q, a }))); }
  // A Short is settled when its Asset is no longer in that rival's portfolio, however it left: it pays `short` coins, unless the
  // rival sold it in a round when the market adds to sale prices (a bull Fate, The God Candle). Called after every action, after
  // each Fate, after the start-of-turn effects, and before the win is read.
  settleShorts() {
    for (const p of this.players) for (const c of [...(p.shorts || [])]) { const q = c.onPlayer, a = c.on; if (q.invest.includes(a)) continue;
      p.shorts.splice(p.shorts.indexOf(c), 1); p.discard.push(c); delete a.shortBy; delete c.on; delete c.onPlayer;
      if (a.soldAt && a.soldAt.turn === this.turnNo && a.soldAt.bull) { p.stats.shortsLost = (p.stats.shortsLost || 0) + 1; this.log(`${q.name} sold ${a.name} in a bull market: ${p.name}'s ${c.name} is lost`); }
      else { const n = c.pays ?? c.short; this.collect(p, n); p.stats.shortsPaid = (p.stats.shortsPaid || 0) + 1; this.log(`${c.name.toUpperCase()} pays: ${a.name} has left ${q.name}'s portfolio, and ${p.name} collects ${this.m(n)}`); } }
  }
  async mapDraw(p) { if (p.artifacts.some((a) => a.key === 'map')) { await this.draw(p); this.log(`${p.name} follows ${U('map')} and draws a card`); } }
  payClear(p, h) { if (!this.spend(p, 3)) return false; this.clearHazard(p, h, p, `${p.name} pays 3`); return true; }
  // The Dashboard Mary: when a die fails you, she may be spent for one more
  // roll. The policy decides (a human is asked); returns true when she was spent.
  // APPARITIONS AND MIRACLES (2026-11-20). Whoever reveals a card with Our Lady's image witnesses an apparition
  // and takes a Miracle, three at most. A Miracle is spent to roll one of your own dice again.
  witness(p, c) {
    if (!c.apparition || this.rules.miracles === false) return;
    p.stats.witnessed = (p.stats.witnessed || 0) + 1;
    // THE APPARITION'S GIFT (rules.apparitionGift; 'action+miracle' since 2026-11-22): one more main action, taken on the
    // witness's own turn (this one, or their next if the card was revealed on a rival's), and a Miracle as before.
    // The other settings were tried in 8,000 games each and are kept for trials: 'turn' (another whole turn: whoever
    // saw more apparitions won 67%), 'action' alone, '' (the Miracle alone), and either with '+miracle'.
    const gift = this.rules.apparitionGift || '';
    if (gift.startsWith('turn')) { p.extraTurns = (p.extraTurns || 0) + 1; p.stats.extraTurns = (p.stats.extraTurns || 0) + 1; this.log(`✦ ${p.name} witnesses an apparition (${c.name}): ANOTHER TURN`); }
    if (gift.startsWith('action')) { p.extraActions = (p.extraActions || 0) + 1; p.stats.extraActions = (p.stats.extraActions || 0) + 1; this.log(`✦ ${p.name} witnesses an apparition (${c.name}): ONE MORE ACTION`); }
    if (gift && !gift.endsWith('+miracle')) return;
    if (p.miracles >= MIRACLE_MAX) { this.log(`✦ ${p.name} witnesses an apparition (${c.name}) and already holds ${MIRACLE_MAX} Miracles`); return; }
    p.miracles++; this.log(`✦ ${p.name} witnesses an apparition (${c.name}): a MIRACLE, ${p.miracles} held`); this.hooks?.onMiracle?.(p, c);
  }
  async miracle(p, w) {
    if (!(p.miracles > 0) || !p.policy.useMiracle || !(await p.policy.useMiracle(this, p, w))) return false;
    p.miracles--; p.stats.miraclesSpent = (p.stats.miraclesSpent || 0) + 1;
    this.log(`${w.kind === 'hail' ? 'the Hail Mary' : w.name} shows ${w.roll} — ${p.name} spends a MIRACLE: roll again`); return true;
  }
  async hailMary(p) {
    p.hailUsed = true; p.stats.hail++; const winningFaces = this.odds(p);
    const rolls = [1 + Math.floor(this.rng() * HAIL_DIE_SIDES)];
    if (rolls[0] > winningFaces && await this.miracle(p, { kind: 'hail', roll: rolls[0] })) {
      rolls.push(1 + Math.floor(this.rng() * HAIL_DIE_SIDES));
    }
    const roll = rolls[rolls.length - 1];
    const before = p.pros;
    const cleared = roll <= winningFaces ? p.hazards.map(h => h.name) : [];
    const ok = roll <= winningFaces;
    this.log(`✝ ${p.name} attempts the HAIL MARY at ${winningFaces}/${HAIL_DIE_SIDES} with ${p.deeds} candle${p.deeds === 1 ? '' : 's'}… the die shows ${roll}: ${ok ? 'ANSWERED' : 'unanswered'}`);
    if (ok) { for (const h of [...p.hazards]) this.clearHazard(p, h, p, 'grace'); p.stats.hailWon++; this.bank(p, 200, 'hail'); }
    await this.hooks?.onHailResult?.(p, { rolls, winningFaces, ok, banked: p.pros - before, cleared });
    return ok;
  }

  // Which of the turn's three kinds an action is (RULES.slots): buying an Asset, selling one, or the main action.
  catOf(a) { return a.t === 'play' && a.c.type === 'asset' ? 'buy' : a.t === 'sell' || a.t === 'uncork' ? 'sell' : 'main'; }
  legalActions(p) { const A = this.legalActionsAll(p); return this.slots ? A.filter((a) => a.t === 'pass' || !this.slots[this.catOf(a)]) : A; }
  legalActionsAll(p) {
    const A = [];
    for (const c of p.hand) {
      if (c.type === 'asset' && p.cdNow && p.cdNow.noBuy && this.active === p) continue; // a comedown: no buying this turn
      const cost = this.costOf(p, c); if (p.liq < cost) continue;
      if (c.type === 'trader' && this.cultBound(p)) continue; // CULT OF PERSONAL80: no other Trader may take the seat
      if (c.type === 'asset' || c.type === 'artifact' || c.type === 'location' || c.type === 'trader') A.push({ t: 'play', c });
      else if (c.short) { if (this.shortable(p).length) A.push({ t: 'play', c }); } // THE SHORT needs a rival's Asset within reach
      else if (c.type === 'event' && c.played) { if (this.hasHaz(p, 'scam')) continue; if (!c.choice) { if (c.bearProof || c.bloom || !(this.hasHaz(p, 'bear') && this.eventPayout(p, c) > 75)) A.push({ t: 'play', c }); } else { A.push({ t: 'play', c, choice: { cash: true } }); if (!(this.hasHaz(p, 'bear') && c.pros > 75)) A.push({ t: 'play', c, choice: {} }); } }
      else if (c.type === 'hazard') { for (const r of this.rivals(p)) if (this.canHit(r, c)) A.push({ t: 'play', c, choice: { target: r } }); }
      else if (c.type === 'remedy') { for (const q of this.players) for (const h of q.hazards) if (clearsHaz(c, h) && !(c.whistle && q !== p)) A.push({ t: 'play', c, choice: { target: q, hazard: h } }); /* The Whistleblower answers only what was played on her own player */ if (c.key === 'publicista' && p.trader && p.trader.credNow != null && p.trader.credNow < p.trader.cred) A.push({ t: 'play', c, choice: { polish: true } }); if (c.refresh) A.push({ t: 'play', c, choice: { refresh: true } }); if (c.whistle && p.lastFraud) A.push({ t: 'play', c, choice: { whistle: true, target: p } }); if (c.rewind && this.rewindable(p)) A.push({ t: 'play', c, choice: { rewind: this.rewindable(p), target: p } }); }
      else if (c.type === 'grace' && this.soulless(p) && p.trader.graceSale) A.push({ t: 'sellgrace', c }); // no religious observances: it sells them
      else if (c.type === 'grace') { const absolves = c.key === 'confession' && this.hasHaz(p, 'infierno'); /* the one Grace The Inferno cannot stop */ if (this.soulless(p) || (this.hasHaz(p, 'infierno') && !absolves)) continue; if (c.key === 'fountain') { if (!p.hailUsed) A.push({ t: 'play', c }); } else if (p.deeds < 3 || absolves) { if (c.key === 'rose') { for (const r of this.rivals(p)) A.push({ t: 'play', c, choice: { target: r } }); } else A.push({ t: 'play', c }); } }
    }
    for (const a of p.invest) if (a.uncork && !this.isCold(p, a) && p.deeds < 3 && !this.soulless(p)) A.push({ t: 'uncork', a });
    for (const a of p.invest) { if (this.hasHaz(p, 'rug') || (a.bornTurn === this.turnNo && !this.quick(p, a)) || this.isCold(p, a) || (a.bullOnly && !(this.saleBonus() > 0))) continue;
      if (a.gamble) A.push({ t: 'sell', a, pros: false }); if (a.bearProof || !(this.hasHaz(p, 'bear') && this.saleValue(a) > 75)) A.push({ t: 'sell', a, pros: true }); }
    if (this.rules.earnedHalo && p.trader && !p.trader.earned) { if (this.rules.giftBlind) { if (p.hand.length) A.push({ t: 'gift', c: null }); } else for (const c of p.hand) if (c.type !== 'hazard') A.push({ t: 'gift', c }); }
    if (p.liq >= 3) for (const h of p.hazards) A.push({ t: 'payclear', h });
    if (!p.hailUsed && !this.hasHaz(p, 'infierno')) A.push({ t: 'hail' });
    A.push({ t: 'pass' });
    if (this.armsOnly) return A.filter((a) => a.t === 'sell' || a.t === 'pass' || (p.trader && p.trader.armsBuy && a.t === 'play' && a.c.type === 'asset')); // Eight Arms: the second action is a sale, or nothing (armsBuy, a knob: or buying an Asset)
    return A;
  }
  async act(p, a) { const r = await this.act0(p, a); this.settleShorts(); return r; }
  async act0(p, a) {
    switch (a.t) {
      case 'play': return this.playCard(p, a.c, a.choice || {});
      case 'sell': return this.sell(p, a.a, a.pros);
      case 'sellgrace': { const c = a.c; p.hand.splice(p.hand.indexOf(c), 1); p.discard.push(c); this.collect(p, p.trader.graceSale); p.stats.gracesSold = (p.stats.gracesSold || 0) + 1; this.log(`${p.name} has no religious observances: ${c.name} is sold for ${this.m(p.trader.graceSale)}`); return true; }
      case 'uncork': { const w = a.a; p.invest.splice(p.invest.indexOf(w), 1); p.discard.push(w); this.log(`${p.name} uncorks ${w.name}`); await this.lightCandle(p, N('cava')); return true; }
      case 'gift': { // give a card from your hand to your rival; if they take it, your Trader earns a halo
        const to = a.target || [...this.rivals(p)].sort((x, y) => this.netWorth(x) - this.netWorth(y))[0];
        const blind = !a.c; const c = a.c || p.hand[Math.floor(this.rng() * p.hand.length)]; // giftBlind: the rival draws one at random, and cannot refuse
        this.log(`${p.name} offers ${to.policy.human || p.policy.human ? c.name : 'a card'} to ${to.name}`); p.stats.offers = (p.stats.offers || 0) + 1;
        if (!blind && to.policy.acceptGift && !(await to.policy.acceptGift(this, to, c, p))) { this.log(`${to.name} declines the gift`); return true; }
        p.hand.splice(p.hand.indexOf(c), 1); if (c.type === 'trader') { delete c.credNow; delete c.earned; } to.hand.push(c); p.stats.gifts = (p.stats.gifts || 0) + 1;
        this.earnHalo(p, 'gift'); return true; }
      case 'payclear': return this.payClear(p, a.h);
      case 'hail': return this.hailMary(p);
      case 'pass': p.stats.passes++; this.log(`${p.name} passes`); return true;
    }
  }
  async takeTurn(p) {
    p.cdNow = p.cdNext || {}; p.cdNext = {}; p.shield = false; p.kick = null; // THE BAR: last turn's drink is paid for now
    p.peekedThisTurn = false; p.buriedThisTurn = false; p.stats.turns++; if (p.hazards.length) p.stats.hazTurns++;
    for (const k of Object.keys(this.fx)) if (this.fx[k].owner === p.idx) { delete this.fx[k]; this.log(`${byKey[k].name} blows over`); }
    // Compound Interest belongs to the active, enabled Trader. Resolve it
    // through bank() so Calamities and the victory check still apply.
    // CLEAN SWEEP (2026-11-16): the cat no longer swats only on arrival. While he sits, each turn
    // starts with a roll — 4+ and he knocks one Calamity off the table (his pick, not yours). It gives
    // him something to do when he opens the game at a clean desk. A Quantum Hack on the seat stops him.
    if (this.is(p, 'gato') && p.hazards.length) { const r = this.roll();
      if (r >= 4 + this.d8()) this.clearHazard(p, p.hazards[Math.floor(this.rng() * p.hazards.length)], p, `${U('gato')} rolls ${r} and knocks it off the table`);
      else this.log(`${U('gato')} rolls ${r} — he only looks at it`); }
    // COMPOUND INTEREST, with its knobs on the design: ciMin (the cash you must hold), ciPay, ciLead (only while you hold more
    // cash than every rival), ciGood (only in good standing).
    if (this.is(p, 'unicornio') && !p.trader.narrative && p.pros >= (p.trader.ciMin ?? 100) && (!p.trader.ciLead || this.rivals(p).every((r) => p.cash > r.cash)) && (!p.trader.ciGood || p.trader.credNow == null || p.trader.credNow >= p.trader.cred)) {
      this.bank(p, p.trader.ciPay ?? 25, 'Compound Interest');
      if (this.over) {
        if (this.hooks && this.hooks.render) await this.hooks.render();
        return;
      }
    }
    if (p.artifacts.some((a) => a.key === 'tattoo')) this.restoreStanding(p, 'THE TATTOO');
    for (const g of [...p.invest]) if (g.rooster) { let r = this.roll();
      if (r === 1 && await this.miracle(p, { kind: 'rooster', name: g.name, roll: r })) r = this.roll();
      if (r === this.rules.die) { this.collect(p, 2); this.log(`${U('gallo')} wins the fight — ${p.name} collects ${this.m(2)}`); }
      else if (r === 1) { p.invest.splice(p.invest.indexOf(g), 1); p.discard.push(g); this.log(`${U('gallo')} rolls a 1 — he is dead, and ${p.name} gets nothing`); }
      else this.log(`${U('gallo')} rolls ${r} — he lives to fight again`); }
    const ticket = p.artifacts.find((a) => a.key === 'lottery');
    if (ticket) {
      const roll = this.roll();
      if (roll < this.rules.die - this.lucky(p)) this.log(`${p.name} scratches THE LOTTERY TICKET — the die shows ${roll}: not this time`);
      else if (this.bank(p, 150, `THE LOTTERY TICKET — the die shows ${roll}: a WINNER`)) { p.artifacts.splice(p.artifacts.indexOf(ticket), 1); p.discard.push(ticket); }
      else this.log(`${p.name} scratches THE LOTTERY TICKET — the top face! but the BEAR MARKET caps the prize; the Ticket is held`);
      if (this.over) { if (this.hooks && this.hooks.render) await this.hooks.render(); return; }
    }
    if (this.is(p, 'diablito')) {
      const wagerRoll = this.roll(); // the game's own die, split down the middle: the top half wins (even odds, as the coin was)
      if (wagerRoll > this.rules.die / 2) {
        const stake = (p.trader.wager ?? 1) * (p.invest.reduce((m, a) => Math.max(m, (this.comp(p, a.key) || {}).wager || 1), 1)); // Connor's companion: Perpetuals, held, multiply the wager
        this.collect(p, stake);
        this.log(`DEVIL'S WAGER — the die shows ${wagerRoll}: ${p.name} collects ${this.m(stake)}`);
      } else {
        if (p.trader.wagerLoss != null) { const lost = Math.min(p.liq, p.trader.wagerLoss); p.liq -= lost; this.log(`DEVIL'S WAGER — the die shows ${wagerRoll}: ${lost ? p.name + ' pays ' + this.m(lost) : 'nothing this turn'}`); }
        // tails costs him his good standing, never his seat: the devil cannot fall twice
        else if (p.trader.credNow == null || p.trader.credNow >= p.trader.cred) { p.trader.credNow = 1; this.log(`DEVIL'S WAGER — the die shows ${wagerRoll}: ${N('diablito')} is in scandal`); }
        else this.log(`DEVIL'S WAGER — the die shows ${wagerRoll}: nothing left to lose`);
      }
    }
    // EL NACIMIENTO: a figure a turn; the third brings the Niño, and the scene is packed away.
    // THE MISSION: alms for whoever starts the turn with less cash than every rival.
    { const sk = p.artifacts.find((x) => x.key === 'skull' && x.tithe); // SAINT'S SKULL, the tithe (a trial rule): each rival pays its holder at the start of the holder's turn
      if (sk) for (const q of this.rivals(p)) { const n = Math.min(sk.tithe * this.rules.rate, q.cash); if (n > 0) { q.cash -= n; p.cash += n; p.stats.skullCut = (p.stats.skullCut || 0) + n; this.log(`${q.name} pays the SAINT’S SKULL its tithe: $${n}M to ${p.name}`); } } }
    if (p.location && p.location.alms && this.rivals(p).every((r) => p.cash < r.cash)) { this.collect(p, p.location.alms); p.stats.alms = (p.stats.alms || 0) + 1; this.log(`${p.location.name} looks after its own — ${p.name} is behind, and collects ${this.m(p.location.alms)}`); }
    if (p.location && p.location.key === 'nacimiento') {
      const nac = p.location; nac.figures = (nac.figures || 0) + 1;
      if (nac.figures < 3) this.log(`${p.name} places a figure in ${U('nacimiento')} (${nac.figures} of 3)`);
      else { this.log(`midnight at ${U('nacimiento')} — the Niño arrives for ${p.name}`); await this.lightCandle(p, N('nacimiento')); this.bank(p, 75, N('nacimiento')); nac.figures = 0; p.location = null; p.discard.push(nac); this.log(`${p.name} packs the Nativity away`);
        if (this.over) { if (this.hooks && this.hooks.render) await this.hooks.render(); return; } }
    }
    // SEED ROUND: a planted Event blooms after its rounds; a Bear Market holds the harvest until it is cleared.
    for (const sd of [...p.seeds]) { if (this.turnNo - sd.bornTurn < (sd.bloom ?? sd.trust)) continue;
      const ok = this.bank(p, this.eventPayout(p, sd), `${sd.name} IN BLOOM` + (p.artifacts.some((a) => a.key === 'geometry') ? ' · SACRED GEOMETRY +25' : ''));
      if (ok) { p.seeds.splice(p.seeds.indexOf(sd), 1); p.discard.push(sd); } else this.log(`${p.name}'s ${sd.name} is in bloom, but the BEAR MARKET holds the harvest`);
      if (this.over) { if (this.hooks && this.hooks.render) await this.hooks.render(); return; } }
    if (this.rules.scandalFuse && p.trader && this.hasHaz(p, 'escandalo') && p.scandalSeen) await this.credDamage(p, 1, 'the Scandal was left to burn'); // trial: a Scandal left on the table for a full round is a second strike
    p.scandalSeen = this.hasHaz(p, 'escandalo');
    const employed = p.trader && this.abilityOn(p);
    const spotless = employed && (p.trader.credNow == null || p.trader.credNow === p.trader.cred);
    const tithe = employed && p.trader.tithe ? p.trader.tithe * p.deeds : 0; // El Monje (Playtest 3): income for every candle lit
    const faithful = employed && !spotless && p.artifacts.some((a) => a.cult); // CULT OF PERSONAL80: in scandal, and paid anyway
    const halo = spotless || faithful ? (p.trader.halo ?? 1) + (p.trader.earned ? 1 : 0) : 0; // CREDIBILITY, the printed number: what good standing pays this Trader
    const cultCard = employed && p.artifacts.find((a) => a.cult), flock = cultCard ? cultCard.flock || 0 : 0; // CULT OF PERSONAL80: the faithful pay in, every turn
    if (this.rules.income) this.collect(p, employed ? p.trader.liq + halo + tithe + flock : 1);
    else if (employed && tithe + flock) this.collect(p, tithe + flock); // trade only: no salary, and no Ethos pay here (it is paid on a sale)
    if (flock) this.log(`the faithful pay in — ${p.name} collects +${this.m(flock)} from the CULT OF PERSONAL80`);
    if (tithe) this.log(`${p.trader.name}'s candles pay ${p.name} +${this.m(tithe)}`);
    if (halo && faithful) { p.stats.cultPaid = (p.stats.cultPaid || 0) + 1; this.log(`${p.trader.name} is in scandal, and the CULT OF PERSONAL80 pays anyway — ${p.name} collects +${this.m(halo)}`); }
    else if (halo && this.rules.income) this.log(`${p.trader.name} is in good standing — ${p.name} collects +${this.m(halo)}`);
    if (!employed && this.rules.income) this.log(`${p.name} is between Traders — collects only ${this.m(1)}`);
    if (this.hasHaz(p, 'taxman') && p.liq > 0) { p.liq -= 1; this.log(`${p.name} pays ${this.m(1)} to the TAX COLLECTOR`); }
    // PAPER HANDS: the Asset bought most recently is sold at its cash price. Diamond Hands, equipped since, holds.
    if (this.hasHaz(p, 'paperhands') && this.hot(p).length) {
      if (p.artifacts.some((x) => x.diamond)) this.log(`${p.name} has DIAMOND HANDS: nothing is sold`);
      else { const a = this.hot(p).pop(); p.invest.splice(p.invest.indexOf(a), 1); this.collect(p, a.cash); p.discard.push(a); p.stats.paperSold = (p.stats.paperSold || 0) + 1; this.log(`PAPER HANDS — ${p.name} panics and sells ${a.name} for ${this.m(a.cash)}`); } }
    for (const a of this.hot(p).filter((x) => x.junk)) { const r = this.roll(); if (r <= a.junk) { p.invest.splice(p.invest.indexOf(a), 1); p.discard.push(a); p.stats.defaults = (p.stats.defaults || 0) + 1; this.log(`${a.name.toUpperCase()} — the die shows ${r}: it defaults, and ${p.name} discards it`); } } // JUNK BOND
    const yield2 = p.invest.reduce((s2, a2) => s2 + (a2.income || 0) + ((this.comp(p, a2.key) || {}).rent || 0) /* Virgil's companion: Real Estate pays him rent */, 0);
    if (yield2) { this.collect(p, yield2); this.log(`${p.name} collects ${this.m(yield2)} from investments`); }
    // DUE DILIGENCE is an open book (2026-11-16): while La Investigadora sits, the top card of her
    // player's deck is face up to them, and once on their turn they may bury it (bury(), below).
    // Nobody is asked anything: a human uses the Bury button at the table, before or after the draw;
    // a bot decides here, before it draws. An empty deck is reshuffled first so there is a card to read.
    if (this.is(p, 'investigadora') && !p.deck.length && p.discard.length) { p.deck.push(...this.shuffle(p.discard.splice(0))); this.log(`${p.name} reshuffles`); }
    this.settleShorts(); // a panic sale (Paper Hands) at the start of the turn settles a Short on that Asset
    await this.tradeStep(p); // a bot makes its offer here, before it draws; a person uses the button during their turn
    if (p.policy.beforeDraw) await p.policy.beforeDraw(this, p);
    if (this.canBury(p) && p.policy.dueDiligence && await p.policy.dueDiligence(this, p, p.deck[0])) this.bury(p);
    await this.turnDraw(p);
    for (let k = 1; k < this.drawsOf(p) && !this.over; k++) await this.turnDraw(p); // SPEED: The Octobot sees more of the market
    if (!this.over) await this.barStep(p); // THE BAR: a bot orders here, after the draw; a person uses the button during their turn
    if (!this.over) await this.marketBet(p); // THE PREDICTION MARKET
    if (!this.over) await this.pawnShop(p);
    if (!this.over) await this.coldStorage(p); // THE CATACOMBS
    // One main action; two once THE SINGULAR80 has fired (this.accelerated). The second is a full main action, and is skipped when there is nothing to do with it.
    const S0 = this.rules.slots || 0; // the fuller turn: S0 kinds of action, then the free ones (The Singular80, Speed, an apparition)
    for (let n = 0; n < (S0 ? S0 + this.mainActions(p) - 1 : this.mainActions(p)) + (p.extraActions || 0) && !this.over; n++) {
      this.slots = S0 && n < S0 ? (this.slots || {}) : null;
      this.secondAction = S0 ? n >= S0 : n > 0; this.bonusAction = n >= (S0 ? S0 + this.mainActions(p) - 1 : this.mainActions(p)); // bonusAction: this one is an apparition's gift
      this.speedAction = !S0 && n > 0 && !this.bonusAction && this.speedy(p) && n === this.mainActions(p) - 1; // the one Speed adds
      if (n > 0 && !this.legalActions(p).some((a) => a.t !== 'pass')) break;
      const action = await p.policy.main(this, p) || { t: 'pass' };
      const before = this.hooks?.beforeAction?.();
      const result = await this.act(p, action); if (action.t !== 'pass') p.stats.acts = (p.stats.acts || 0) + 1;
      if (this.slots) { if (action.t === 'pass') { n = S0 - 1; this.slots = null; } else this.slots[this.catOf(action)] = true; } // a pass ends the three; free actions may follow
      if ((S0 ? n >= S0 : n > 0) && action.t !== 'pass') p.stats.secondActions = (p.stats.secondActions || 0) + 1;
      await this.hooks?.onAction?.(p, action, before, result);
    }
    this.slots = null; this.secondAction = false; this.bonusAction = false; this.speedAction = false; p.extraActions = 0; p.stats.myTurns = (p.stats.myTurns || 0) + 1;
    // EIGHT ARMS (The Octobot, 2026-11-20): after its main action it may also buy or sell one Asset (armsBuy on the design; without it, sell only).
    if (!this.over && this.is(p, 'bot') && p.trader.arms !== false) {
      this.armsOnly = true;
      if (this.legalActions(p).some((a) => a.t !== 'pass')) { const extra = await p.policy.main(this, p) || { t: 'pass' };
        if (extra.t !== 'pass') { const b2 = this.hooks?.beforeAction?.(); const r2 = await this.act(p, extra); p.stats.armsSells = (p.stats.armsSells || 0) + 1; await this.hooks?.onAction?.(p, extra, b2, r2); } }
      this.armsOnly = false;
    }
    if (p.cdEnd) { p.cdEnd = false; if (p.hand.length) { const d = await p.policy.discardOne(this, p); p.hand.splice(p.hand.indexOf(d), 1); p.discard.push(d); this.log(`${p.name} comes down from the sugar and discards a card`); } }
    while (p.hand.length > this.handLimit(p)) { const d = await p.policy.discardOne(this, p); p.hand.splice(p.hand.indexOf(d), 1); p.discard.push(d); p.stats.discards++; }
    if (this.hooks && this.hooks.render) await this.hooks.render();
  }
  // Who goes first: the players in their seats, unless exactly one of them opened as a Trader with `first` (The Octobot).
  // Becoming that Trader later changes nothing.
  seatOrder() { const fast = this.players.filter((q) => q.trader && q.trader.first); if (fast.length !== 1 || fast[0] === this.players[0]) return [...this.players]; const i = this.players.indexOf(fast[0]); this.log(`${fast[0].trader.name} is quicker: ${fast[0].name} takes the first turn`); return [...this.players.slice(i), ...this.players.slice(0, i)]; }
  // THE FATES: turn the top card of the shared deck for player d, and let it happen to the table.
  async flipFate(d) { await this.flipFate0(d); this.settleShorts(); }
  async flipFate0(d) {
    if (!this.fates.length) { this.fates = this.shuffle(this.fatesGone.splice(0)); if (!this.fates.length) return; this.log('THE FATES are shuffled again'); }
    const c = this.fates.shift(); this.fatesGone.push(c); this.fateCount = (this.fateCount || 0) + 1; this.fateNow = { card: c, for: d.idx }; this.market = 0; this.sale = 0; this.saleRate = 0; // last round's market, and any sale, is over
    this.log(`THE FATES turn ${c.name.toUpperCase()} for ${d.name}`);
    if (this.hooks && this.hooks.onFate) await this.hooks.onFate(this.fateNow, d); // the table turns the card over before anything happens
    const machine = d.artifacts.find((a) => a.key === 'enigma'); // Intercept: the Machine can cancel the Fate turned for its owner
    if (machine && await d.policy.useEnigma(this, d, c)) { d.artifacts.splice(d.artifacts.indexOf(machine), 1); d.discard.push(machine); this.fateNow.cancelled = true; this.log(`✦ the ENIGMA MACHINE intercepts ${c.name}: the message never goes out`); if (this.hooks && this.hooks.render) await this.hooks.render(); return; }
    this.market = c.market || 0; if (this.market) this.log(`THE MARKET turns ${this.market > 0 ? 'BULL' : 'BEAR'}: every Asset sells for $${Math.abs(this.market)}M ${this.market > 0 ? 'more' : 'less'} this round`);
    this.sale = c.sale || 0; this.saleRate = c.saleRate || 0; if (this.sale) this.log(`SPECIAL OFFER: every Asset costs ${this.m(this.sale)} less to buy this round`); if (this.saleRate) this.log(`SPECIAL OFFER: every Asset is ${Math.round(this.saleRate * 100)}% off this round`); // a sale lasts the round, like a market
    this.witness(d, c); await this.event(d, c);
    if (this.hooks && this.hooks.render) await this.hooks.render();
  }
  async openingPrayer() {
    const P = this.rules.prayer, rounds = []; let praying = [...this.players];
    while (praying.length > 1) { const rolls = praying.map((q) => ({ idx: q.idx, roll: this.roll() })); rounds.push(rolls); const top = Math.max(...rolls.map((r) => r.roll)); praying = praying.filter((q) => rolls.find((r) => r.idx === q.idx).roll === top); }
    const blessed = praying[0];
    for (const q of this.players) { if (q === blessed) q.cash = P.windfall * this.rules.rate; else { q.cash = P.rest * this.rules.rate; q.deeds = Math.min(3, P.candles || 0); } }
    this.prayed = { rounds, blessed: blessed.idx, windfall: P.windfall * this.rules.rate, rest: P.rest * this.rules.rate, candles: P.candles || 0 };
    this.log(`THE OPENING PRAYER — ${rounds.map((r) => r.map((x) => `${this.players[x.idx].name} ${x.roll}`).join(', ')).join(' · again: ')}. ${blessed.name}'s prayer is answered: $${this.prayed.windfall}M. The rest begin with $${this.prayed.rest}M and ${this.prayed.candles} candles lit`);
    if (this.hooks && this.hooks.onPrayer) await this.hooks.onPrayer(this.prayed);
    if (this.hooks && this.hooks.render) await this.hooks.render();
  }
  async run() {
    this.order = this.order || this.seatOrder();
    if (this.rules.prayer && !this.prayed) await this.openingPrayer();
    while (!this.over && this.turnNo < this.maxTurns) { this.turnNo++; if (this.rules.fates && this.rules.fates.per !== 'turn') { await this.flipFate(this.order[(this.turnNo - 1) % this.order.length]); this.checkWin(null); } for (const p of this.order) { if (this.over) break; this.active = p; if (this.rules.fates && this.rules.fates.per === 'turn') await this.flipFate(p); if (this.over) break; if (this.hooks && this.hooks.render) await this.hooks.render(); await this.turn(p); } }
    if (this.verbose) { this.lines.forEach((l) => console.log(l)); console.log(`END turn ${this.turnNo}: ${this.players.map((q) => `${q.name} $${q.pros}M net ($${q.cash}M cash)/${q.deeds}d`).join(' · ')}`); }
    return { winner: this.winner ? this.winner.name : null, winnerIdx: this.winner ? this.winner.idx : -1, turns: this.turnNo,
      players: this.players.map((q) => ({ name: q.name, recipe: q.recipe, trader: q.trader ? q.trader.key : null, starter: q.starter || null, pros: q.pros, cash: q.cash, paper: q.invest.reduce((s, a) => s + this.paperValue(a), 0), ...q.stats })) };
  }
}

// ── policies ──
export class RandomBot {
  constructor(rng) { this.rng = rng; }
  pickDraw(g, p, seen) { return seen[Math.floor(this.rng() * seen.length)]; }
  useHeart() { return this.rng() < 0.5; }
  acceptRose() { return this.rng() < 0.6; }
  discardOne(g, p) { return p.hand[Math.floor(this.rng() * p.hand.length)]; }
  useMiracle() { return this.rng() < 0.5; }
  placeBet(g, p, loc, offers) { return this.rng() < 0.5 ? offers[Math.floor(this.rng() * offers.length)] : null; }
  pawnCard(g, p) { return this.rng() < 0.3 ? p.hand[Math.floor(this.rng() * p.hand.length)] : null; }
  abduct(g, p, seats) { return this.rng() < 0.7 ? seats[Math.floor(this.rng() * seats.length)] : null; }
  visit(g, p, back) { return back.length && this.rng() < 0.5 ? back[Math.floor(this.rng() * back.length)] : null; }
  useSavingGrace(g, p, cards) { return this.rng() < 0.5 ? cards[Math.floor(this.rng() * cards.length)] : null; }
  coldMove(g, p) { return this.rng() < 0.3 ? p.invest[Math.floor(this.rng() * p.invest.length)] : null; }
  useEnigma() { return this.rng() < 0.5; }
  acceptGift() { return true; }
  dueDiligence() { return this.rng() < 0.5; }
  main(g, p) { const A = g.legalActions(p); return A[Math.floor(this.rng() * A.length)]; }
}
export class GreedyBot {
  constructor() {}
  pickDraw(g, p, seen) { return [...seen].sort((a, b) => g.drawWorth(p, b) - g.drawWorth(p, a))[0]; }
  useHeart() { return true; }
  acceptRose() { return true; }
  // She is saved for the Hail Mary unless that prayer has already been said.
  useMiracle(g, p, w) { return true; } // a failed roll is always worth a second look
  // The Prediction Market: take the contract that would win the game if there is one; otherwise the best
  // average, and only with money to spare for the turn's play.
  placeBet(g, p, loc, offers) {
    const stake = loc.stake * g.rules.rate, P = (i) => (g.rules.die + 1 - g.marketNeed(p, loc, i)) / g.rules.die;
    const winning = offers.filter((i) => p.cash - stake + loc.market[i][1] >= g.winAt).sort((a, b) => P(b) - P(a))[0];
    if (winning != null) return winning;
    if (p.liq < loc.stake + 2) return null;
    const best = [...offers].sort((a, b) => P(b) * loc.market[b][1] - P(a) * loc.market[a][1])[0];
    return P(best) * loc.market[best][1] > stake ? best : null;
  }
  // THE VISITOR's choice: she departs when a card worth more than two unknown ones lies in the discard pile (a called
  // Event to call again, an Asset it can afford, a Trader for an empty desk); otherwise she arrives.
  visit(g, p, back) {
    const worth = (c) => g.costOf(p, c) > p.liq ? 0 : c.type === 'event' ? 75 : c.type === 'asset' ? 50 : c.type === 'trader' ? (p.trader ? 5 : 60) : c.type === 'hazard' ? 35 : 20;
    const best = [...back].sort((a, b) => worth(b) - worth(a))[0];
    return best && worth(best) >= 60 ? best : null;
  }
  // THE VISITOR: takes its own Trader back when it is deep in scandal and can be seated again; otherwise the Trader of the rival who is ahead.
  abduct(g, p, seats) {
    const t = p.trader;
    if (seats.includes(p) && t && t.credNow != null && t.credNow <= t.cred - (seats.length > 1 ? 6 : 3) && p.liq >= g.costOf(p, t) + 1) return p;
    const rivals = seats.filter((q) => q !== p).sort((a, b) => g.netWorth(b) - g.netWorth(a));
    return rivals[0] || null;
  }
  // Pawns a card with nothing left to do: a Remedy with no trouble on the table, a Grace past the third candle, a second
  // Location, a Calamity with nobody to land on, a Trader no better than the one seated. Anything else is worth keeping.
  pawnCard(g, p) {
    const good = p.trader && (p.trader.credNow == null || p.trader.credNow >= p.trader.cred);
    const dead = (c) => (c.type === 'remedy' && !c.refresh && !c.rewind && !g.players.some((q) => q.hazards.length) && !(c.whistle && p.lastFraud))
      || (c.type === 'grace' && (p.deeds >= 3 || p.hailUsed || g.soulless(p)))
      || c.type === 'location'
      || (c.type === 'hazard' && !g.rivals(p).some((r) => g.canHit(r, c)))
      || (c.type === 'trader' && good && (c.liq || 0) <= (p.trader.liq || 0));
    return p.hand.find(dead) || null;
  }
  // Intercepts the weather that is not a plain windfall: Calamities and shake-ups.
  useEnigma(g, p, c) { return c.subtype === 'Calamity' || c.subtype === 'Ambiguity'; }
  // Always saves the Trader, with the card that leaves the most Credibility.
  // The Catacombs. Brings an Asset up on the turn selling it beats everything else on offer; otherwise sends down the
  // most valuable Asset it is not about to sell.
  coldMove(g, p) {
    const sale = (a) => this.score(g, p, { t: 'sell', a, pros: true });
    let best = null, bs = -1; for (const a of g.legalActions(p)) { const s = this.score(g, p, a); if (s > bs) { bs = s; best = a; } }
    const up = p.invest.filter((a) => g.isCold(p, a) && a.bornTurn !== g.turnNo).sort((x, y) => sale(y) - sale(x))[0];
    if (up && sale(up) > bs) return up;
    const selling = best && best.t === 'sell' ? best.a : null;
    return g.hot(p).filter((a) => a !== selling).sort((x, y) => g.paperValue(y) - g.paperValue(x))[0] || null;
  }
  useSavingGrace(g, p, cards) { return [...cards].sort((a, b) => b.savingGrace - a.savingGrace)[0]; }
  // Takes the card only when it is worth more to them than the halo is to the giver (RULES.giftsAlwaysTaken: any card).
  acceptGift(g, p, c, from) { return g.rules.giftsAlwaysTaken || g.giftValue(p, c) >= g.haloWorth(from); }
  // Bottoms the weather that would hurt (the Enigma's rule), a Trader when a spare is already affordable, or a card too dear to play soon.
  dueDiligence(g, p, c) {
    if (c.type === 'event' && !c.played) return c.subtype === 'Calamity' || c.subtype === 'Ambiguity';
    if (c.type === 'trader') return !!p.trader && p.hand.some(c => c.type === 'trader' && g.costOf(p, c) <= p.liq);
    if (c.type === 'location') return !!p.location;
    return c.cost > p.liq + 3;
  }
  discardOne(g, p) { const order = { hazard: 0, remedy: 1, artifact: 2, trader: 3, grace: 4, asset: 5, event: 6 } /* an event in hand is a played one */; return [...p.hand].sort((a, b) => (order[a.type] ?? 9) - (order[b.type] ?? 9))[0]; }
  // ONE MONEY changes what a play is worth, so the bot counts in net worth ($M) now:
  //   · an investment (Asset, called Event) scores what it adds: value minus price, plus what it will earn
  //   · everything else (Calamities, Remedies, Relics, Graces, a switch of Trader) keeps its Playtest 2
  //     weight, less half its price — spending is now paid for out of the score
  //   · selling adds nothing by itself (the Asset already counted); the bot sells to take a bonus, to get
  //     out of something about to lose value, or to raise cash for a card it cannot afford
  // What a Relic is worth to p, in $M, over the `left` rounds the game probably has. Income is counted in
  // full; protection at the odds of the thing it stops (per player and round, from the sims: a Scandal or a
  // Fall about 0.08, a fraud about 0.02, any Calamity about 0.06); a card drawn at about $12M.
  relicWorth(g, p, c, left, earns) {
    const R = g.rules.rate, t = p.trader, pay = t ? (t.halo ?? 1) * R : 0, keep = t ? earns(t) * R : 0;
    const inScandal = !!t && t.credNow != null && t.credNow < t.cred;
    const miracle = c.apparition && (p.miracles || 0) < MIRACLE_MAX ? 12 : 0; // equipping an apparition is a Miracle
    const hand = (f) => p.hand.filter(f).length;
    let w = 0;
    if (c.cult) w = !t ? 5 : p.hand.some((x) => x.type === 'trader' && earns(x) > earns(t) + 0.5) ? 0 : (c.flock || 0) * R * left + (inScandal ? pay * left * 0.6 : 0.08 * left * pay);
    else if (c.key === 'skull') w = c.tithe ? c.tithe * R * left * 1.5 : (c.cut ?? 1) * R * (c.cutAll ? 0.45 : 0.22) * left;    // a player sells about once in five rounds
    else if (c.key === 'lottery') w = 150 * (1 - Math.pow(1 - 1 / g.rules.die, left));
    else if (c.key === 'geometry') w = 25 * hand((x) => x.type === 'event' && x.played) + 6 * left;
    else if (c.diamond) w = 25 * p.invest.length * (left >= 3 ? 1 : 0.4) + 10 * hand((x) => x.type === 'asset') * (left >= 4 ? 1 : 0) + 2;
    else if (c.key === 'rosary') w = p.deeds < 3 ? 12 * hand((x) => x.type === 'grace') + 6 : 0;
    else if (c.key === 'map') w = 12 * (p.invest.length + hand((x) => x.type === 'asset') * 0.5);
    else if (c.key === 'tattoo') w = inScandal && !g.hasHaz(p, 'escandalo') ? pay * left : 0.08 * left * pay * 2;
    else if (c.noStrikes) w = t ? 0.08 * left * (pay * 2 + (inScandal ? keep * 3 : 0)) : 0;
    else if (c.key === 'shroud') w = t ? (inScandal ? 0.08 : 0.02) * left * keep * 3 : 0;
    else if (c.key === 'heart') w = 0.06 * left * 70;
    else if (c.wards) w = 0.02 * left * 70 * c.wards.length * (c.wards.includes('rug') && !p.invest.length ? 0.7 : 1) + (c.pathos && t ? 0.06 * left * 70 * c.pathos / g.rules.die : 0);
    else if (c.key === 'enigma') w = 3 * left;
    else if (c.slots) { const waiting = p.hand.filter((x) => x.type === 'artifact' && !x.slots && !x.noSlot && x !== c); w = g.relicsHeld(p).length >= 2 && waiting.length ? Math.max(...waiting.map((x) => this.relicWorth(g, p, x, left, earns))) : 2; }
    return w + miracle;
  }
  score(g, p, a) {
    const R = g.rules.rate, nw = (q) => g.netWorth(q);
    const counts = g.rules.countAssets || g.narrative(p); // do this player's unsold Assets count toward the goal?
    const lead = [...g.rivals(p)].sort((x, y) => nw(y) - nw(x))[0];
    const left = Math.max(1, Math.min(6, Math.ceil((g.winAt - Math.max(nw(p), nw(lead))) / 90))); // rounds the game probably has left
    const wins = (gain) => (nw(p) + gain >= g.winAt ? 9999 : 0);
    const price = a.t === 'play' ? g.costOf(p, a.c) * R : 0;
    const spend = price * 0.5;
    const earns = (t) => t.liq + (t.halo ?? 1) * 0.75 + (t.narrative ? (t.premium ?? 50) / 20 : t.key === 'unicornio' ? (t.ciPay ?? 25) / g.rules.rate * 0.8 : 0) + (t.key === 'diablito' ? (t.wager || 0) * 0.5 : 0) + (t.key === 'bot' ? (t.speed || t.draws > 1 ? 2.5 : t.arms !== false ? 1.5 : 0) : 0) + (t.key === 'abuela' ? 1 : 0) + (t.key === 'prospector' ? (t.discount ?? 1) * 0.5 : 0) + (t.bearish ? 1 : 0); // what a Trader brings in a turn, abilities that pay included (so the bot does not trade Eugene away for less)
    const winningFaces = g.odds(p); const hailEV = (winningFaces / HAIL_DIE_SIDES) * 200;
    let s = 0;
    if (a.t === 'play' && a.c.type === 'event' && a.c.played) {
      const ev = g.eventPayout(p, a.c);
      const wait = a.c.bloom ?? (a.c.choice && !(a.choice && a.choice.cash) ? a.c.trust : null); // rounds until it pays, if it is planted or put in trust
      const gain = a.choice && a.choice.cash ? a.c.cash * R : wait ? (left >= wait ? ev * 0.75 : 0) - price : ev - price;
      s = gain - (a.c.rivalsCollect ? a.c.rivalsCollect * R * g.rivals(p).length * 0.5 : 0) + (wait ? 0 : wins(gain));
    }
    if (a.t === 'play' && a.c.short) s = 0.6 * a.c.short * R * 0.8 - spend; // THE SHORT: it pays about half the time (PLAYTEST3.md)
    if (a.t === 'uncork') s = p.deeds === 2 && !p.hailUsed ? 52 : 0;
    if (a.t === 'sellgrace') s = 20 + p.trader.graceSale * R * 0.5;
    if (a.t === 'sell') {
      const x = a.a; const paper = g.paperValue(x); const bonus = g.saleBonusFor(p, x);
      const dear = p.hand.some((c) => (c.type === 'asset' || (c.type === 'event' && c.played)) && g.costOf(p, c) * R > p.cash && g.costOf(p, c) * R <= p.cash + paper);
      if (x.gamble && a.pros) { const P = g.gambleOdds(p, x); const edge = P * (x.pros + bonus) + (1 - P) * (x.bust || 0) - paper;
        s = nw(p) - paper + x.pros + bonus >= g.winAt ? 60 + 100 * P : edge > 0 ? 20 + edge : 0; }
      else { const fading = x.ripe && g.turnNo - x.bornTurn >= 2 ? 50 : 0; const earning = ((x.income || 0) * R + (x.grow || 0)) * left;
        s = bonus + fading - earning + (dear ? 22 : 0) + wins(bonus); }
      // CASH ONLY: the Asset counts for nothing until it is sold, so the sale itself is the gain.
      if (!counts) { const cashNow = x.gamble && !a.pros ? x.cash * R : null;
        if (x.gamble && a.pros) { const P = g.gambleOdds(p, x); s = P * (x.pros + bonus) + (1 - P) * (x.bust || 0) + (p.cash + x.pros + bonus >= g.winAt ? 40 * P : 0); }
        else { const v = (cashNow ?? Math.max(0, g.prosOf(x) + bonus)) + g.ethosBonus(p) + g.sellTiming(p); const ripening = x.ripe && g.turnNo - x.bornTurn < 2 ? 100 : 0; const waiting = x.gem && p.deeds < 3 && p.deeds >= 2 ? 100 : 0;
          s = v - 10 - ripening - waiting - Math.min(v * 0.4, ((x.income || 0) * R + (x.grow || 0)) * 1.5) + (p.cash + v >= g.winAt ? 9999 : 0); } }
    }
    if (a.t === 'play' && a.c.type === 'asset') {
      const x = a.c; const now = x.gamble ? x.cash * R : x.ripe ? 50 : x.perp ? x.pros * 2 : x.bullOnly ? x.pros * 0.55 /* Fine Art waits for a bull market */ : x.pros;
      const P = x.gamble ? g.gambleOdds(p, x) : 0;
      const later = (x.income || 0) * R * left + (x.grow || 0) * left + (x.ripe && left >= 2 ? 100 : 0) + (x.gamble ? Math.max(0, P * x.pros + (1 - P) * (x.bust || 0) - now) : 0) + (x.gem && p.deeds >= 2 ? 100 : 0);
      s = counts ? 25 + (now - price) + later * 0.7 + wins(now - price) : 25 + (now - price) * 0.6 + later * 0.7; // cash only: the profit is a second action away
      const cp = g.comp(p, x.key); if (cp) s += cp.kind === 'sale' ? cp.amount * 0.6 : 25; if (x.set && p.invest.some((y) => y.set === x.set)) s += SET_BONUS * 0.6; // a companion, or the second card of a set
    }
    if (a.t === 'play' && a.c.type === 'hazard') s = (a.choice.target === lead && nw(lead) > nw(p) ? 70 + nw(lead) / 20 : 15) - (a.choice.target.trader ? (a.choice.target.trader.eq || 0) * 4 : 0) - spend;
    // A fraud is worth what it takes: the Asset it zeroes, the cash it moves (twice over when it comes to you).
    if (a.t === 'play' && a.c.type === 'hazard' && a.c.hit) { const t = a.choice.target; const take = a.c.key === 'rug' ? g.prosOf(g.exposed(t)[g.exposed(t).length - 1]) * 0.7 : a.c.steal ? Math.min(a.c.steal, t.cash) * 2 : Math.min(a.c.loss || 0, t.cash);
      s = take * (1 - (t.trader ? (t.trader.eq || 0) / g.rules.die : 0)) * 0.7 - spend; }
    if (a.t === 'play' && a.c.key === 'rug') { const hot = g.exposed(a.choice.target), x = hot[hot.length - 1], mine = x && p.shorts.find((c) => c.on === x); if (mine) s += mine.short * R; } // short it, then pull the rug
    if (a.t === 'sell' && a.a.shortBy != null && s < 9000 && !(g.saleBonus() > 0)) s -= 60; // a shorted Asset: selling outside a bull market pays the rival
    const inGood = p.trader && (p.trader.credNow == null || p.trader.credNow >= p.trader.cred);
    const haloWorth = g.rules.earnedHalo && inGood && !p.trader.earned && left >= 3 ? R * (left - 1) * (g.rules.income ? 0.75 : 0.25) : 0; // what an earned halo will pay
    if (a.t === 'play' && a.c.type === 'remedy') { const mine = a.choice.target === p; s = (mine ? 80 : 8 + (haloWorth ? haloWorth - 30 : 0)) - spend; }
    if (a.t === 'play' && a.c.rewind) { const b = a.choice.rewind; // worth what the card it brings back is worth to play again
      s = (b.type === 'event' ? 70 : b.type === 'asset' ? 45 : b.type === 'trader' ? (p.trader ? 5 : 40) : b.type === 'hazard' ? 35 : 20) - spend - g.costOf(p, b) * R * 0.5; }
    if (a.t === 'gift' && !a.c) { const avg = p.hand.reduce((t, c) => t + (c.type === 'event' ? 80 : c.type === 'asset' ? 60 : c.type === 'hazard' ? 40 : 25), 0) / p.hand.length; s = haloWorth ? haloWorth * g.rules.giftKeen - avg * 0.6 : 0; }
    else if (a.t === 'gift') { const c = a.c; const to = [...g.rivals(p)].sort((x, y) => nw(x) - nw(y))[0];
      const dead = (c.type === 'trader' && p.trader && earns(c) <= earns(p.trader) + 0.5) || (c.type === 'remedy' && !c.refresh && !c.rewind && !p.hazards.length && !(c.whistle && p.lastFraud)) || (c.type === 'grace' && (p.deeds >= 3 || p.hailUsed || g.soulless(p))) || (c.type === 'location' && !!p.location) || (c.type === 'artifact' && g.relicsHeld(p).length >= g.relicSlots(p));
      const keep = dead ? 0 : c.type === 'event' ? 80 : c.type === 'asset' ? 60 : 25; // what the card is worth to keep
      const taken = g.rules.giftsAlwaysTaken || g.giftValue(to, c) >= haloWorth; // a refused offer wastes the turn: do not make one
      s = haloWorth && taken ? haloWorth * g.rules.giftKeen - keep - g.giftValue(to, c) * 0.5 : 0; }
    if (a.t === 'play' && a.choice && a.choice.refresh) { const dead = p.hand.filter((c) => c !== a.c && c.type !== 'event' && c.cost > p.liq + 1).slice(0, a.c.refresh); a.choice.discards = dead; s = 28 + 10 * dead.length; }
    // A Relic is worth what it will do over the rounds left (relicWorth, below), scored like an Asset bought
    // for what it will earn. With both slots full it must beat the weakest Relic it would push out.
    if (a.t === 'play' && a.c.type === 'artifact') { const worth = this.relicWorth(g, p, a.c, left, earns);
      if (!a.c.slots && !a.c.noSlot && g.relicsHeld(p).length >= g.relicSlots(p)) { const out = [...g.relicsHeld(p)].sort((x, y) => this.relicWorth(g, p, x, left, earns) - this.relicWorth(g, p, y, left, earns))[0];
        a.choice = { ...(a.choice || {}), drop: out }; s = (worth - this.relicWorth(g, p, out, left, earns) - 15) * 0.7 - spend; }
      else s = 25 + worth * 0.7 - price * 0.6; }
    if (a.t === 'play' && a.c.type === 'location') s = p.location ? 0 : 58 - spend + (a.c.pawn ? 12 : 0); // never tear a standing place down for another
    if (a.t === 'play' && a.c.type === 'grace') s = (!p.hailUsed ? 57 - p.deeds * 4 : 2) - spend + (a.c.abduct && a.c.abduct !== 'own' && g.rivals(p).some((r) => r.trader) ? 22 : 0) + (a.c.visit ? 15 : 0);
    if (a.t === 'play' && a.c.type === 'trader') s = !p.trader ? 72 + earns(a.c) * 3 : (p.trader.credNow < p.trader.cred && (a.c.credNow ?? a.c.cred) > p.trader.credNow ? 46 : earns(a.c) > earns(p.trader) + 0.5 && left >= 3 ? 75 : 0) - spend;
    if (a.t === 'play' && a.c.key === 'escandalo' && a.choice && !a.choice.target.trader) s = 5;
    if (a.t === 'play' && a.choice && a.choice.polish) s = (p.trader && p.trader.credNow < p.trader.cred && !g.hasHaz(p, 'escandalo') ? 42 : 0) - spend;
    if (a.t === 'payclear') s = 66 - 3 * R * 0.5 + (a.h.key === 'trap' ? (a.h.pile || 0) * R : 0);
    if (a.t === 'hail') s = nw(p) + 200 >= g.winAt ? (winningFaces >= 3 ? 90 : 30) : winningFaces >= 4 ? 72 : lead && nw(lead) >= g.winAt - 150 ? 45 : hailEV / 4;
    if (a.t === 'play' && a.c.type !== 'asset' && g.comp(p, a.c.key)) s += 25; // the Trader's own companion card
    if (a.t === 'pass') s = 1;
    if (a.t === 'play' && a.c.apparition && g.active === p && (g.rules.apparitionGift || '').startsWith('action')) s += 18; // an apparition gives its action back
    return s;
  }
  // THE BAR. One drink when there is a use for its kick, never the same one twice running (the engine forbids that anyway).
  orderDrink(g, p) { const r = g.rivals(p)[0]; const want = { alcohol: () => p.invest.some((a) => a.gamble && a.bornTurn !== g.turnNo && !g.isCold(p, a)) || (g.netWorth(p) >= g.netWorth(r) && p.invest.length >= 1),
      espresso: () => g.hot(p).some((a) => a.bornTurn !== g.turnNo && !(a.bullOnly && !(g.saleBonus() > 0))), energy: () => p.hand.length >= 5 };
    return ['alcohol', 'espresso', 'energy'].find((k) => g.canDrink(p, k) && want[k]()) || null; }
  // TRADING. Offer the card that is worth most more to the rival than to me, if the gap is rules.trade.min or more, at the price that
  // splits the gap. Buy when it leaves me a gain, and one no smaller than the seller's: in a race of two, their gain is my loss.
  proposeTrade(g, p) { const r = g.rivals(p)[0], min = g.rules.trade.min ?? 50, R = g.rules.rate; let best = null;
    for (const { c, held } of g.tradeable(p)) { if (c.shortBy != null) continue; const vs = g.tradeWorth(p, c, held), vb = g.tradeWorth(r, c, held), S = vb - vs; if (!(S >= min) || (best && S <= best.S)) continue; const price = Math.round((vs + S / 2) / 10) * 10; if (r.cash >= price + (held ? 0 : g.costOf(r, c) * R)) best = { S, c, price }; }
    return best; }
  acceptTrade(g, p, seller, c, price, held) { const vb = g.tradeWorth(p, c, held), vs = g.tradeWorth(seller, c, held); return vb - price > 0 && vb - price >= price - vs && p.cash >= price + (held ? 0 : g.costOf(p, c) * g.rules.rate); }
  // THE SHORT: which of the rival's Assets. The one a Rug Pull in hand or Paper Hands will take, else a gamble, else the dearest.
  shortPick(g, p, list) { const rug = p.hand.some((c) => c.key === 'rug'); const sc = ({ q, a }) => { const hot = g.exposed(q), last = hot[hot.length - 1] === a; return (last && (g.hasHaz(q, 'paperhands') || (rug && !g.warded(q, 'rug'))) ? 1000 : 0) + (a.gamble ? 200 : 0) + g.paperValue(a); }; return list.length ? [...list].sort((x, y) => sc(y) - sc(x))[0].a : null; }
  main(g, p) {
    const A = g.legalActions(p);
    let best = null, bs = -1;
    for (const a of A) { const s = this.score(g, p, a); if (s > bs) { bs = s; best = a; } }
    return best;
  }
}

// ── CLI ──
const ARGV = typeof process !== 'undefined' && process.argv ? process.argv.slice(2) : [];
const args = Object.fromEntries(ARGV.map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : [])).filter((x) => x.length));
export function playOne({ seed = 1, nPlayers = 3, bots = null, decks = null, starters = null, verbose = false, rotate = 0, rules = {} }) {
  const kinds = (bots || 'greedy,greedy,greedy,greedy'.split(',').slice(0, nPlayers).join(',')).split(',').slice(0, nPlayers);
  const recs = (decks || 'devotion,degen,devotion,degen').split(',');
  const sts = starters ? starters.split(',') : [];
  const players = kinds.map((k, i) => ({ name: `${k.toUpperCase()} ${'ABCD'[i]}`, recipe: recs[i % recs.length], starter: sts[i] || null, policy: k === 'random' ? new RandomBot(makeRng(seed * 31 + i)) : new GreedyBot() }));
  for (let r = 0; r < rotate; r++) players.push(players.shift());
  return new Game({ players, seed, verbose, rules });
}
if (typeof process !== 'undefined' && process.argv[1] && process.argv[1].endsWith('pt3-sim.js')) {
  const games = +(args.games || 1000); const seed = +(args.seed || 1); const nPlayers = +(args.players || 2);
  const rules = {}; for (const k of ['rate', 'goal', 'start', 'crash']) if (args[k] != null) rules[k] = +args[k]; if (args.rug) rules.rugFreezes = true; if (args.assets) rules.countAssets = true; if (args.sudden) rules.finishRound = false; if (args.nostrikes) rules.calamityStrikes = false; if (args.noattrs) rules.attrs = false; if (args.noprayer) rules.prayer = null; if (args.nofates) rules.fates = null; if (args.notrade) rules.trade = null; if (args.nobar) rules.bar = false; if (args.leave) rules.disgrace = null; if (args.oneaction) { rules.slots = 0; rules.draws = 1; } if (args.income) { rules.income = true; if (args.start == null) rules.start = 5; } if (args.d6) rules.die = 6; if (args.nohalo) rules.earnedHalo = false; if (args.takeall) rules.giftsAlwaysTaken = true; if (args.blind) rules.giftBlind = true; if (args.keen != null) rules.giftKeen = +args.keen; if (args.candlehalo) { rules.earnedHalo = true; rules.candleHalo = true; } if (args.fuse) rules.scandalFuse = true;
  if (args.verbose) { await playOne({ seed, nPlayers, bots: args.bots, decks: args.decks, starters: args.starters, rules, verbose: true }).run(); process.exit(0); }
  const res = { first: 0, recipeWins: {}, recipeGames: {}, seatWins: [0, 0, 0, 0], turns: [], endTrader: {}, startTrader: {}, s: {}, noWin: 0, wCash: 0, wPaper: 0, n: 0 };
  for (let i = 0; i < games; i++) {
    const r = await playOne({ seed: seed + i, nPlayers, bots: args.bots, decks: args.decks, starters: args.starters, rules, rotate: i % nPlayers }).run();
    for (const p of r.players) res.recipeGames[p.recipe] = (res.recipeGames[p.recipe] || 0) + 1;
    if (!r.winner) { res.noWin++; continue; }
    const wp = r.players.find((p) => p.name === r.winner); res.recipeWins[wp.recipe] = (res.recipeWins[wp.recipe] || 0) + 1; res.wCash += wp.cash; res.wPaper += wp.paper; res.n++;
    res.seatWins[(r.winnerIdx + nPlayers - (i % nPlayers)) % nPlayers]++; res.turns.push(r.turns); if (r.winnerIdx === 0) res.first++;
    for (const p of r.players) { const O = res.startTrader[p.starter || 'none'] = res.startTrader[p.starter || 'none'] || { g: 0, w: 0 }; O.g++; if (r.winner === p.name) O.w++; }
    for (const p of r.players) { const T = res.endTrader[p.trader || 'none'] = res.endTrader[p.trader || 'none'] || { g: 0, w: 0 }; T.g++; if (r.winner === p.name) T.w++;
      for (const k of ['halos', 'halosLost', 'halo_gift', 'halo_remedy', 'halo_candle', 'gifts', 'offers', 'strikes', 'restored', 'savingGrace', 'plays', 'hires', 'disgraces', 'sells', 'hazPlayed', 'hazCleared', 'candles', 'hail', 'hailWon', 'turns', 'hazTurns', 'passes']) res.s[k] = (res.s[k] || 0) + (p[k] || 0); }
  }
  const avg = (x) => (x.reduce((s2, n) => s2 + n, 0) / Math.max(1, x.length)).toFixed(1);
  const R0 = { ...RULES, ...rules };
  console.log(`${games} games · ${nPlayers} players · ONE MONEY: $${R0.rate}M a coin, first to $${R0.goal}M, open with $${R0.start * R0.rate}M${R0.countAssets ? ' · unsold Assets count' : ' · cash only'}`);
  console.log(`the player who goes first wins ${(res.first / Math.max(1, games - res.noWin) * 100).toFixed(1)}% (even is ${(100 / nPlayers).toFixed(0)}%) | no winner ${res.noWin}`);
  console.log(`rounds to win avg ${avg(res.turns)}`);
  console.log('deck recipes:', Object.entries(res.recipeGames).map(([k, g2]) => `${k} wins ${Math.round((res.recipeWins[k] || 0) / Math.max(1, g2) * 100)}% of its seats (${res.recipeWins[k] || 0}/${g2})`).join(' | '));
  console.log(`the winner's $${Math.round((res.wCash + res.wPaper) / Math.max(1, res.n))}M: $${Math.round(res.wCash / Math.max(1, res.n))}M cash + $${Math.round(res.wPaper / Math.max(1, res.n))}M unsold Assets`);
  const s = res.s; const pg = (k) => (s[k] / games).toFixed(2);
  console.log(`Credibility, per game: scandals ${pg('strikes')} · back in good standing ${pg('restored')} · discredited ${pg('disgraces')} · Saving Face spent ${pg('savingGrace')}`);
  if (R0.earnedHalo) console.log(`Earned halos, per game: earned ${pg('halos')} (gift ${pg('halo_gift')} · clearing a rival's Calamity ${pg('halo_remedy')} · first candle ${pg('halo_candle')}) · knocked off ${pg('halosLost')}`);
  console.log(`per game (all players): cards played ${pg('plays')} switches ${pg('hires')} sales ${pg('sells')} calamities ${pg('hazPlayed')} cleared ${pg('hazCleared')} candles ${pg('candles')} hail ${pg('hail')} answered ${pg('hailWon')}`);
  console.log('opening Trader (win rate):', Object.entries(res.startTrader).map(([k, v]) => `${k} ${v.g} seats, ${Math.round(v.w / v.g * 100)}% win`).join(' | '));
  console.log('trader at the desk when the game ended (win rate):', Object.entries(res.endTrader).map(([k, v]) => `${k} ${v.g} seats, ${Math.round(v.w / v.g * 100)}% win`).join(' | '));
}
