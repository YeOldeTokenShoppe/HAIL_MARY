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
    id: "unihood",
    name: "Unihood",
    type: CARD_TYPES.TRADER,
    rarity: RARITIES.MYTHIC,
    handle: "Meme Prophet",
    station: "Unicorn Desk",
    style: "meme",
    color: "#ff7ad9",
    startingCred: 20,
    startingPortfolio: 0,
    abilityName: "Rainbow Candle",
    abilityText: "The first meme coin you buy each game enters with +8 value.",
    quote: "Charts are just vibes with timestamps.",
  },
  {
    id: "det-trinity",
    name: "Det. Trinity",
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
    id: "halo-node",
    name: "Halo Node",
    type: CARD_TYPES.TRADER,
    rarity: RARITIES.MYTHIC,
    handle: "Autonomous Execution Rig",
    station: "Halo Workstation",
    style: "automation",
    color: "#53ffd6",
    startingCred: 20,
    startingPortfolio: 0,
    abilityName: "Cold Wallet Shield",
    abilityText: "The first market crash against you each game is ignored.",
    quote: "Latency is a prayer with a deadline.",
  },
  {
    id: "bullhorn-broker",
    name: "Bullhorn Broker",
    type: CARD_TYPES.TRADER,
    rarity: RARITIES.MYTHIC,
    handle: "Leverage Evangelist",
    station: "Hype Desk",
    style: "hype",
    color: "#ff5b45",
    startingCred: 20,
    startingPortfolio: 0,
    abilityName: "Megaphone Wick",
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
  coin("trinitycoin", "TrinityCoin", "TRIN", "analysis", RARITIES.RARE, 7, 10, 1),
  coin("halo-protocol", "Halo Protocol", "HALO", "automation", RARITIES.RARE, 8, 12, 2),
  coin("bullish-ink", "Bullish Ink", "INK", "hype", RARITIES.COMMON, 5, 8, 4),
  coin("neon-oracle", "Neon Oracle", "NRCL", "analysis", RARITIES.UNCOMMON, 6, 8, 1),
  coin("liquid-saint", "Liquid Saint", "SAINT", "bluechip", RARITIES.UNCOMMON, 7, 10, 2),
  coin("rugproof", "RugProof", "RUGP", "defense", RARITIES.RARE, 6, 8, 0),
  coin("zero-choir", "Zero Choir", "ZCHO", "infra", RARITIES.COMMON, 5, 7, 2),
  coin("ponzi-siren", "Ponzi Siren", "SIREN", "meme", RARITIES.COMMON, 3, 6, 7),
  coin("altar-swap", "AltarSwap", "ALTAR", "defi", RARITIES.UNCOMMON, 6, 9, 3),
  coin("midnight-base", "Midnight Base", "MBASE", "bluechip", RARITIES.RARE, 9, 12, 1),
  coin("candle-index", "Candle Index", "CNDL", "analysis", RARITIES.COMMON, 4, 6, 1),
  coin("syntax-gold", "Syntax Gold", "SGLD", "automation", RARITIES.UNCOMMON, 7, 9, 2),
  coin("vaporwarex", "VaporwareX", "VPRX", "hype", RARITIES.COMMON, 4, 8, 6),
  coin("angel-ledger", "Angel Ledger", "ANGEL", "infra", RARITIES.RARE, 8, 11, 1),
  coin("genesis-terminal", "Genesis Terminal", "GEN", "terminal", RARITIES.FOIL, 10, 16, 3),
];

export const ACTION_CARDS = [
  action("pump-signal", "Pump Signal", "pump", RARITIES.COMMON, 2, "+10 portfolio. Unihood and Bullhorn get extra edge.", { portfolio: 10 }),
  action("diamond-hands", "Diamond Hands", "defense", RARITIES.COMMON, 2, "Gain +3 portfolio and +1 Cred.", { portfolio: 3, cred: 1 }),
  action("terminal-hack", "Terminal Hack", "hack", RARITIES.UNCOMMON, 3, "Gain +8 portfolio. Bots lose a little tempo.", { portfolio: 8, opponentPortfolio: -2 }),
  action("rug-warning", "Rug Warning", "investigation", RARITIES.UNCOMMON, 2, "Gain +5 portfolio and +3 extra as Det. Trinity.", { portfolio: 5 }),
  action("leverage-spiral", "Leverage Spiral", "risk", RARITIES.RARE, 1, "Gain +15 portfolio, then lose 3 Cred.", { portfolio: 15, cred: -3 }),
  action("insider-ping", "Insider Ping", "investigation", RARITIES.COMMON, 1, "Gain +2 Cred and +4 portfolio.", { portfolio: 4, cred: 2 }),
  action("cold-wallet", "Cold Wallet", "defense", RARITIES.UNCOMMON, 2, "Gain +6 portfolio and reduce crash pressure.", { portfolio: 6, shield: 1 }),
  action("botnet-arbitrage", "Botnet Arbitrage", "automation", RARITIES.RARE, 3, "Gain +12 portfolio. Halo Node gains +3 more.", { portfolio: 12 }),
  action("meme-blessing", "Meme Blessing", "meme", RARITIES.UNCOMMON, 2, "Gain +9 portfolio. Unihood gains +4 more.", { portfolio: 9 }),
  action("short-the-noise", "Short the Noise", "analysis", RARITIES.UNCOMMON, 2, "Gain +7 portfolio and +1 Cred.", { portfolio: 7, cred: 1 }),
  action("liquidity-ladder", "Liquidity Ladder", "defi", RARITIES.COMMON, 2, "Gain +4 Cred.", { cred: 4 }),
  action("market-sermon", "Market Sermon", "hype", RARITIES.COMMON, 1, "Gain +6 portfolio. Bullhorn gains +4 more.", { portfolio: 6 }),
  action("audit-flare", "Audit Flare", "investigation", RARITIES.RARE, 3, "Gain +10 portfolio and +2 Cred.", { portfolio: 10, cred: 2 }),
  action("flash-fill", "Flash Fill", "automation", RARITIES.COMMON, 1, "Gain +5 portfolio.", { portfolio: 5 }),
  action("whale-wake", "Whale Wake", "bluechip", RARITIES.RARE, 3, "Gain +11 portfolio.", { portfolio: 11 }),
  action("limit-order-prayer", "Limit Order Prayer", "defense", RARITIES.COMMON, 1, "Gain +2 Cred and +2 portfolio.", { portfolio: 2, cred: 2 }),
  action("chart-exorcism", "Chart Exorcism", "analysis", RARITIES.UNCOMMON, 2, "Gain +8 portfolio.", { portfolio: 8 }),
  action("airdrop-ambush", "Airdrop Ambush", "meme", RARITIES.COMMON, 0, "Gain +3 portfolio and draw momentum.", { portfolio: 3, draw: 1 }),
  action("gasless-miracle", "Gasless Miracle", "automation", RARITIES.UNCOMMON, 0, "Gain +5 portfolio without spending Cred.", { portfolio: 5 }),
  action("exit-liquidity", "Exit Liquidity", "risk", RARITIES.RARE, 1, "Gain +14 portfolio. Lose 2 Cred.", { portfolio: 14, cred: -2 }),
  action("compliance-siren", "Compliance Siren", "investigation", RARITIES.COMMON, 2, "Gain +6 portfolio.", { portfolio: 6 }),
  action("neon-stop-loss", "Neon Stop Loss", "defense", RARITIES.COMMON, 1, "Gain +1 shield and +2 portfolio.", { portfolio: 2, shield: 1 }),
  action("forked-rumor", "Forked Rumor", "hype", RARITIES.UNCOMMON, 2, "Gain +9 portfolio.", { portfolio: 9 }),
  action("server-room-alpha", "Server Room Alpha", "automation", RARITIES.RARE, 3, "Gain +13 portfolio.", { portfolio: 13 }),
  action("oracle-crosscheck", "Oracle Crosscheck", "analysis", RARITIES.COMMON, 1, "Gain +5 portfolio and +1 Cred.", { portfolio: 5, cred: 1 }),
  action("terminal-foil-moment", "Terminal Foil Moment", "terminal", RARITIES.FOIL, 4, "Gain +18 portfolio. This is the table-stopper.", { portfolio: 18 }),
];

export const MARKET_CARDS = [
  market("bull-run", "Bull Run", RARITIES.UNCOMMON, "Everyone gains +8 portfolio.", { portfolioAll: 8 }),
  market("meme-season", "Meme Season", RARITIES.RARE, "Meme traders gain +10 portfolio. Others gain +3.", { styleBonus: { meme: 10 }, portfolioAll: 3 }),
  market("liquidity-drain", "Liquidity Drain", RARITIES.COMMON, "Everyone loses 2 Cred.", { credAll: -2 }),
  market("protocol-exploit", "Protocol Exploit", RARITIES.UNCOMMON, "Automation traders lose 6 portfolio. Others lose 2.", { stylePenalty: { automation: -6 }, portfolioAll: -2 }),
  market("regulator-sweep", "Regulator Sweep", RARITIES.RARE, "Hype traders lose 6 portfolio. Analysis traders gain 5.", { styleBonus: { analysis: 5 }, stylePenalty: { hype: -6 } }),
  market("midnight-listing", "Midnight Listing", RARITIES.UNCOMMON, "Everyone gains +3 Cred.", { credAll: 3 }),
  market("stablecoin-weather", "Stablecoin Weather", RARITIES.COMMON, "Everyone gains +4 portfolio and +1 Cred.", { portfolioAll: 4, credAll: 1 }),
  market("volatility-mass", "Volatility Mass", RARITIES.RARE, "High-risk traders gain +9 portfolio and lose 2 Cred.", { styleBonus: { meme: 9, hype: 9 }, styleCred: { meme: -2, hype: -2 } }),
  market("dead-chain-hour", "Dead Chain Hour", RARITIES.COMMON, "Everyone loses 4 portfolio unless shielded.", { portfolioAll: -4, crash: true }),
  market("genesis-candle", "Genesis Candle", RARITIES.FOIL, "Everyone gains +12 portfolio. The market remembers.", { portfolioAll: 12 }),
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
