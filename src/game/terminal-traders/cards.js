export const CARD_TYPES = {
  TRADER: "trader",
  COIN: "coin",
  ACTION: "action",
  MARKET: "market",
};

export const RARITIES = {
  COMMON: "common",
  UNCOMMON: "uncommon",
  RARE: "rare",
  MYTHIC: "mythic",
  FOIL: "terminal-foil",
};

export const TRADERS = [
  {
    id: "eugene",
    name: "Eugene",
    type: CARD_TYPES.TRADER,
    rarity: RARITIES.MYTHIC,
    handle: "Pattern Prophet",
    station: "Unicorn Desk",
    style: "pattern",
    color: "#ff7ad9",
    startingCred: 20,
    startingPortfolio: 0,
    abilityName: "Déjà Vu",
    abilityText: "The first coin you buy that shares a tag with a coin already in your holdings enters with +8 value.",
    quote: "This chart smells like $ORACL3, day 4.",
  },
  {
    id: "marisol",
    name: "Marisol",
    type: CARD_TYPES.TRADER,
    rarity: RARITIES.MYTHIC,
    handle: "Onchain Investigator",
    station: "Evidence Terminal",
    style: "analysis",
    color: "#f6d365",
    startingCred: 20,
    startingPortfolio: 0,
    abilityName: "Follow the Wallets",
    abilityText: "Start with +2 Cred. Investigation actions gain +3 value.",
    quote: "Every miracle leaves a transaction trail.",
  },
  {
    id: "gr80",
    name: "Saint GR80",
    type: CARD_TYPES.TRADER,
    rarity: RARITIES.MYTHIC,
    handle: "Android Monk",
    station: "Halo Workstation",
    style: "discipline",
    color: "#53ffd6",
    startingCred: 20,
    startingPortfolio: 0,
    abilityName: "Cold Wallet Shield",
    abilityText: "The first market crash against you each game is ignored.",
    quote: "Latency is a prayer with a deadline.",
  },
  {
    id: "john-barron",
    name: "John Barron",
    type: CARD_TYPES.TRADER,
    rarity: RARITIES.MYTHIC,
    handle: "Leverage Evangelist",
    station: "Hype Desk",
    style: "hype",
    color: "#ff5b45",
    startingCred: 20,
    startingPortfolio: 0,
    abilityName: "Double Down",
    abilityText: "Pump actions gain +4 value, but crashes hit this trader for +3.",
    quote: "Confidence is liquidity wearing sunglasses.",
  },
];

export const COIN_CARDS = [
  coin("moonpony", "MoonPony", "MPONY", "meme", RARITIES.RARE, 7, 12, 5),
  coin("terminal-eth", "TerminalETH", "TETH", "bluechip", RARITIES.UNCOMMON, 8, 11, 2),
  coin("blackpalm", "BlackPalm", "PALM", "defi", RARITIES.UNCOMMON, 6, 9, 3),
  coin("chainseraph", "ChainSeraph", "SERA", "infra", RARITIES.RARE, 9, 13, 2),
  coin("goblingas", "GoblinGas", "GAS", "meme", RARITIES.COMMON, 4, 7, 6),
  coin("marisolcoin", "MarisolCoin", "MRSL", "analysis", RARITIES.RARE, 7, 10, 1),
  coin("halo-protocol", "Halo Protocol", "HALO", "discipline", RARITIES.RARE, 8, 12, 2),
  coin("bullish-ink", "Bullish Ink", "INK", "hype", RARITIES.COMMON, 5, 8, 4),
  coin("neon-oracle", "Neon Oracle", "NRCL", "pattern", RARITIES.UNCOMMON, 6, 8, 1),
  coin("liquid-saint", "Liquid Saint", "SAINT", "bluechip", RARITIES.UNCOMMON, 7, 10, 2),
  coin("rugproof", "RugProof", "RUGP", "defense", RARITIES.RARE, 6, 8, 0),
  coin("zero-choir", "Zero Choir", "ZCHO", "infra", RARITIES.COMMON, 5, 7, 2),
  coin("ponzi-siren", "Ponzi Siren", "SIREN", "meme", RARITIES.COMMON, 3, 6, 7),
  coin("altar-swap", "AltarSwap", "ALTAR", "defi", RARITIES.UNCOMMON, 6, 9, 3),
  coin("midnight-base", "Midnight Base", "MBASE", "bluechip", RARITIES.RARE, 9, 12, 1),
  coin("candle-index", "Candle Index", "CNDL", "analysis", RARITIES.COMMON, 4, 6, 1),
  coin("syntax-gold", "Syntax Gold", "SGLD", "discipline", RARITIES.UNCOMMON, 7, 9, 2),
  coin("vaporwarex", "VaporwareX", "VPRX", "hype", RARITIES.COMMON, 4, 8, 6),
  coin("angel-ledger", "Angel Ledger", "ANGEL", "infra", RARITIES.RARE, 8, 11, 1),
  coin("genesis-terminal", "Genesis Terminal", "GEN", "terminal", RARITIES.FOIL, 10, 16, 3),
  coin("wick-street", "Wick Street", "WICK", "hype", RARITIES.COMMON, 4, 7, 5),
  coin("votive-chain", "Votive Chain", "VOTV", "infra", RARITIES.COMMON, 4, 6, 1),
  coin("monk-stack", "Monk Stack", "MONK", "defense", RARITIES.UNCOMMON, 6, 8, 0),
  coin("oil-standard", "Oil Standard", "OIL", "bluechip", RARITIES.UNCOMMON, 7, 10, 1),
  coin("lucky-capsule", "Lucky Capsule", "LUCK", "pattern", RARITIES.UNCOMMON, 5, 9, 5),
  coin("demon-desk", "Demon Desk", "DMON", "hype", RARITIES.RARE, 8, 13, 6),
  coin("prophet-margin", "Prophet Margin", "PRFT", "analysis", RARITIES.RARE, 8, 11, 1),
  coin("our-lady-rl80", "Our Lady RL80", "RL80", "terminal", RARITIES.FOIL, 9, 14, 4),
];

export const ACTION_CARDS = [
  action("pump-signal", "Pump Signal", "pump", RARITIES.COMMON, 2, "+10 portfolio. John Barron gets extra edge.", { portfolio: 10 }),
  action("diamond-hands", "Diamond Hands", "defense", RARITIES.COMMON, 2, "Gain +3 portfolio and +1 Cred.", { portfolio: 3, cred: 1 }),
  action("terminal-hack", "Terminal Hack", "hack", RARITIES.UNCOMMON, 3, "Gain +8 portfolio. Bots lose a little tempo.", { portfolio: 8, opponentPortfolio: -2 }),
  action("rug-warning", "Rug Warning", "investigation", RARITIES.UNCOMMON, 2, "Gain +5 portfolio and +3 extra as Marisol.", { portfolio: 5 }),
  action("leverage-spiral", "Leverage Spiral", "risk", RARITIES.RARE, 1, "Gain +15 portfolio, then lose 3 Cred.", { portfolio: 15, cred: -3 }),
  action("insider-ping", "Insider Ping", "investigation", RARITIES.COMMON, 1, "Gain +2 Cred and +4 portfolio.", { portfolio: 4, cred: 2 }),
  action("cold-wallet", "Cold Wallet", "defense", RARITIES.UNCOMMON, 2, "Gain +6 portfolio and reduce crash pressure.", { portfolio: 6, shield: 1 }),
  action("botnet-arbitrage", "Botnet Arbitrage", "discipline", RARITIES.RARE, 3, "Gain +12 portfolio. Saint GR80 gains +3 more.", { portfolio: 12 }),
  action("meme-blessing", "Meme Blessing", "meme", RARITIES.UNCOMMON, 2, "Gain +9 portfolio. John Barron gains +4 more.", { portfolio: 9 }),
  action("short-the-noise", "Short the Noise", "analysis", RARITIES.UNCOMMON, 2, "Gain +7 portfolio and +1 Cred.", { portfolio: 7, cred: 1 }),
  action("liquidity-ladder", "Liquidity Ladder", "defi", RARITIES.COMMON, 2, "Gain +4 Cred.", { cred: 4 }),
  action("market-sermon", "Market Sermon", "hype", RARITIES.COMMON, 1, "Gain +6 portfolio. John Barron gains +4 more.", { portfolio: 6 }),
  action("audit-flare", "Audit Flare", "investigation", RARITIES.RARE, 3, "Gain +10 portfolio and +2 Cred.", { portfolio: 10, cred: 2 }),
  action("flash-fill", "Flash Fill", "discipline", RARITIES.COMMON, 1, "Gain +5 portfolio.", { portfolio: 5 }),
  action("whale-wake", "Whale Wake", "bluechip", RARITIES.RARE, 3, "Gain +11 portfolio.", { portfolio: 11 }),
  action("limit-order-prayer", "Limit Order Prayer", "defense", RARITIES.COMMON, 1, "Gain +2 Cred and +2 portfolio.", { portfolio: 2, cred: 2 }),
  action("chart-exorcism", "Chart Exorcism", "analysis", RARITIES.UNCOMMON, 2, "Gain +8 portfolio.", { portfolio: 8 }),
  action("airdrop-ambush", "Airdrop Ambush", "meme", RARITIES.COMMON, 0, "Gain +3 portfolio and draw momentum.", { portfolio: 3, draw: 1 }),
  action("gasless-miracle", "Gasless Miracle", "discipline", RARITIES.UNCOMMON, 0, "Gain +5 portfolio without spending Cred.", { portfolio: 5 }),
  action("exit-liquidity", "Exit Liquidity", "risk", RARITIES.RARE, 1, "Gain +14 portfolio. Lose 2 Cred.", { portfolio: 14, cred: -2 }),
  action("compliance-siren", "Compliance Siren", "investigation", RARITIES.COMMON, 2, "Gain +6 portfolio.", { portfolio: 6 }),
  action("neon-stop-loss", "Neon Stop Loss", "defense", RARITIES.COMMON, 1, "Gain +1 shield and +2 portfolio.", { portfolio: 2, shield: 1 }),
  action("forked-rumor", "Forked Rumor", "hype", RARITIES.UNCOMMON, 2, "Gain +9 portfolio.", { portfolio: 9 }),
  action("server-room-alpha", "Server Room Alpha", "discipline", RARITIES.RARE, 3, "Gain +13 portfolio.", { portfolio: 13 }),
  action("oracle-crosscheck", "Oracle Crosscheck", "pattern", RARITIES.COMMON, 1, "Gain +5 portfolio and +1 Cred.", { portfolio: 5, cred: 1 }),
  action("terminal-foil-moment", "Terminal Foil Moment", "terminal", RARITIES.FOIL, 4, "Gain +18 portfolio. This is the table-stopper.", { portfolio: 18 }),
  action("candle-vigil", "Candle Vigil", "defense", RARITIES.COMMON, 1, "Gain +3 portfolio and +1 shield.", { portfolio: 3, shield: 1 }),
  action("copium-drip", "Copium Drip", "meme", RARITIES.COMMON, 1, "Gain +4 portfolio and +1 Cred.", { portfolio: 4, cred: 1 }),
  action("tithe-rebate", "Tithe Rebate", "defi", RARITIES.COMMON, 0, "Gain +3 Cred.", { cred: 3 }),
  action("fomo-cascade", "FOMO Cascade", "pump", RARITIES.UNCOMMON, 3, "Gain +12 portfolio. John Barron gets extra edge.", { portfolio: 12 }),
  action("wallet-seance", "Wallet Séance", "investigation", RARITIES.UNCOMMON, 2, "Gain +7 portfolio and +1 Cred.", { portfolio: 7, cred: 1 }),
  action("mempool-prophecy", "Mempool Prophecy", "pattern", RARITIES.RARE, 2, "Gain +6 portfolio and draw a card.", { portfolio: 6, draw: 1 }),
  action("rug-pull-reversal", "Rug Pull Reversal", "hack", RARITIES.RARE, 3, "Gain +9 portfolio. Every rival loses 3.", { portfolio: 9, opponentPortfolio: -3 }),
];

export const MARKET_CARDS = [
  market("bull-run", "Bull Run", RARITIES.UNCOMMON, "Everyone gains +8 portfolio.", { portfolioAll: 8 }),
  market("meme-season", "Meme Season", RARITIES.RARE, "Hype traders gain +10 portfolio. Others gain +3.", { styleBonus: { hype: 10 }, portfolioAll: 3 }),
  market("liquidity-drain", "Liquidity Drain", RARITIES.COMMON, "Everyone loses 2 Cred.", { credAll: -2 }),
  market("protocol-exploit", "Protocol Exploit", RARITIES.UNCOMMON, "Disciplined traders lose 6 portfolio. Others lose 2.", { stylePenalty: { discipline: -6 }, portfolioAll: -2 }),
  market("regulator-sweep", "Regulator Sweep", RARITIES.RARE, "Hype traders lose 6 portfolio. Analysis traders gain 5.", { styleBonus: { analysis: 5 }, stylePenalty: { hype: -6 } }),
  market("midnight-listing", "Midnight Listing", RARITIES.UNCOMMON, "Everyone gains +3 Cred.", { credAll: 3 }),
  market("stablecoin-weather", "Stablecoin Weather", RARITIES.COMMON, "Everyone gains +4 portfolio and +1 Cred.", { portfolioAll: 4, credAll: 1 }),
  market("volatility-mass", "Volatility Mass", RARITIES.RARE, "High-risk traders gain +9 portfolio and lose 2 Cred.", { styleBonus: { hype: 9 }, styleCred: { hype: -2 } }),
  market("dead-chain-hour", "Dead Chain Hour", RARITIES.COMMON, "Everyone loses 4 portfolio unless shielded.", { portfolioAll: -4, crash: true }),
  market("genesis-candle", "Genesis Candle", RARITIES.FOIL, "Everyone gains +12 portfolio. The market remembers.", { portfolioAll: 12 }),
  market("airdrop-monsoon", "Airdrop Monsoon", RARITIES.COMMON, "Everyone gains +2 portfolio and +2 Cred.", { portfolioAll: 2, credAll: 2 }),
  market("influencer-eclipse", "Influencer Eclipse", RARITIES.COMMON, "Hype traders lose 4 portfolio and 1 Cred.", { stylePenalty: { hype: -4 }, styleCred: { hype: -1 } }),
  market("rug-harvest", "Rug Harvest", RARITIES.UNCOMMON, "Everyone loses 3 portfolio unless shielded.", { portfolioAll: -3, crash: true }),
  market("halving-eve", "Halving Eve", RARITIES.RARE, "Disciplined traders gain +8 portfolio. Others gain +2.", { styleBonus: { discipline: 8 }, portfolioAll: 2 }),
  market("our-lady-appears", "Our Lady Appears", RARITIES.RARE, "Analysis and pattern traders gain +6 portfolio.", { styleBonus: { analysis: 6, pattern: 6 } }),
];

export const GENESIS_SET = [
  ...TRADERS,
  ...COIN_CARDS,
  ...ACTION_CARDS,
  ...MARKET_CARDS,
];

export function getCardById(id) {
  return GENESIS_SET.find((card) => card.id === id) || null;
}

// CASE_TABLE.md §2.2 — every card tag maps to exactly one lens/station.
export const LENS_BY_TAG = {
  defense: "monk",
  discipline: "monk",
  bluechip: "monk",
  infra: "monk",
  hype: "demon",
  pump: "demon",
  risk: "demon",
  meme: "demon",
  investigation: "marisol",
  analysis: "marisol",
  hack: "marisol",
  defi: "marisol",
  pattern: "eugene",
  terminal: "eugene",
};

function coin(id, name, ticker, tag, rarity, cost, value, volatility) {
  return {
    id,
    name,
    ticker,
    type: CARD_TYPES.COIN,
    tag,
    rarity,
    cost,
    baseValue: value,
    volatility,
    effectText: `${ticker} enters your portfolio at ${value} value.`,
  };
}

function action(id, name, tag, rarity, cost, effectText, effect) {
  return {
    id,
    name,
    type: CARD_TYPES.ACTION,
    tag,
    rarity,
    cost,
    effectText,
    effect,
  };
}

function market(id, name, rarity, effectText, effect) {
  return {
    id,
    name,
    type: CARD_TYPES.MARKET,
    rarity,
    effectText,
    effect,
  };
}
