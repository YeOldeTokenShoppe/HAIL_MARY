// The Genesis 80 — single source of truth for the card set (GENESIS.md §2).
//
// GENESIS REVISION PASS applied 2026-07-16 (CASE_TABLE.md §3.2a): the set is
// authored for the Case Table, not the retired 10-round loop.
//   - ACTIONS are investigation tools. Each carries `kit` — role, lens, and
//     kit-first rules text — as its primary identity. Composition (33):
//     16 lens keys (common, 4/lens) · 8 deep scans (uncommon, 2/lens) ·
//     4 cross-references (rare, 4 of the 6 lens pairs) · 1 exit trace (rare) ·
//     1 pundit audit (uncommon) · 2 insurance (shield common / floor
//     uncommon) · 1 wildcard (terminal-foil). The §3.2a "table talk" pair was
//     superseded by Exit Trace + Pundit Audit (§3.2b's deliberate v4
//     deviations); sabotage cards print in a later season when live PvP
//     exists. Legacy `cost`/`effectText`/`effect` survive only as long as
//     classic mode does (§4.8) — do not design against them.
//   - COINS are past cases (§4.6): each `caseRef` is a solved dossier —
//     outcome, pattern archetype, one-line note. This is the lore-native
//     vocabulary for Eugene's patternRefs ("this smells like Ponzi Siren").
//   - MARKETS are docket events (§4.6): each `docket` is the authored
//     between-cases table effect. portfolioAll/payoutMult resolve today
//     (docketRun.js); disableLens/silenceLeans/extraAction/grantShield are
//     authored ahead of the Phase 3 docket-events implementation. `weight`
//     is the event-deck draw weight (tune by sim, §4.7).
//
// Pre-art-lock the set is a live draft (§2.3): ids, tags, and lists may be
// revised freely. At art lock, ids/editions freeze and append-only takes
// over. Genesis Candle demoted FOIL → RARE this pass (§4.6 cleanup) so
// exactly 3 terminal-foils exist.

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

// Station key → the lens it reads (display vocabulary; CASE_TABLE.md §2.2).
export const LENS_LABELS = {
  monk: "ETHOS",
  demon: "PATHOS",
  marisol: "LOGOS",
  eugene: "MYTHOS",
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
    quote: "I don't predict. I remember.",
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

// The case-pattern archetypes (CASE_TABLE.md §4.4) — the shared vocabulary
// between coin dossiers (caseRef.pattern), Eugene's patternRefs, and the
// case-authoring ladder. Add sparingly; each id is a teachable read.
export const CASE_PATTERNS = {
  "serial-deployer": "fresh wallet, mixer funding, cloned contract — the assembly-line rug",
  "doxxed-clean": "public team, boring books — the real thing",
  "anon-but-real": "anonymous builders, verifiable product",
  "slick-but-broken": "beautiful pitch, hollow mechanics",
  "meme-mania": "pure crowd momentum, no floor",
  "backdoor-fork": "honest-looking fork with a latent admin door",
  "redemption-arc": "died once, rebuilt honestly",
  "bad-tokenomics": "real product strangled by its own emissions",
  "stealth-launch": "no promo; found by on-chain archaeologists",
  "celeb-shill": "rented influence, borrowed trust",
  "yield-mirage": "the APY was the product — paid from the door, not the vault",
  "infra-grind": "unsexy plumbing that quietly ships",
  "hype-fizzle": "loud launch, slow leak — no rug, just an empty room",
};

export const COIN_CARDS = [
  coin("moonpony", "MoonPony", "MPONY", "meme", RARITIES.RARE, 7, 12, 5,
    caseRef("legit", "meme-mania", "The meme that refused to die — three cycles, still galloping.")),
  coin("terminal-eth", "TerminalETH", "TETH", "bluechip", RARITIES.UNCOMMON, 8, 11, 2,
    caseRef("legit", "doxxed-clean", "The reserve asset of the Terminal — dull as scripture, solvent as sin.")),
  coin("blackpalm", "BlackPalm", "PALM", "defi", RARITIES.UNCOMMON, 6, 9, 3,
    caseRef("rug", "backdoor-fork", "Forked a blue-chip vault and kept one key nobody audited. Drained day 40.")),
  coin("chainseraph", "ChainSeraph", "SERA", "infra", RARITIES.RARE, 9, 13, 2,
    caseRef("legit", "infra-grind", "Six angels of uptime. The bridge that never made headlines because it never broke.")),
  coin("goblingas", "GoblinGas", "GAS", "meme", RARITIES.COMMON, 4, 7, 6,
    caseRef("zombie", "hype-fizzle", "Gas fees as a joke token. The joke got old before the liquidity did.")),
  coin("marisolcoin", "MarisolCoin", "MRSL", "analysis", RARITIES.RARE, 7, 10, 1,
    caseRef("legit", "doxxed-clean", "Community token of the Evidence Terminal. Every mint has a receipt.")),
  coin("halo-protocol", "Halo Protocol", "HALO", "discipline", RARITIES.RARE, 8, 12, 2,
    caseRef("legit", "doxxed-clean", "Custody with a halo — GR80's cold vaults, audited thrice.")),
  coin("bullish-ink", "Bullish Ink", "INK", "hype", RARITIES.COMMON, 5, 8, 4,
    caseRef("zombie", "celeb-shill", "Signed by every influencer of the season. The ink outlived the signatures.")),
  coin("neon-oracle", "Neon Oracle", "NRCL", "pattern", RARITIES.UNCOMMON, 6, 8, 1,
    caseRef("legit", "anon-but-real", "Nobody knows who runs the feeds. The feeds have never lied.")),
  coin("liquid-saint", "Liquid Saint", "SAINT", "bluechip", RARITIES.UNCOMMON, 7, 10, 2,
    caseRef("legit", "redemption-arc", "Depegged once in the great cascade; recollateralized and canonized.")),
  coin("rugproof", "RugProof", "RUGP", "defense", RARITIES.RARE, 6, 8, 0,
    caseRef("rug", "slick-but-broken", "Sold rug insurance. The actuary was the rug. Day 88.")),
  coin("zero-choir", "Zero Choir", "ZCHO", "infra", RARITIES.COMMON, 5, 7, 2,
    caseRef("legit", "stealth-launch", "Launched silent as a vow; found by archaeologists, priced by believers.")),
  coin("ponzi-siren", "Ponzi Siren", "SIREN", "meme", RARITIES.COMMON, 3, 6, 7,
    // Flavor settled 2026-07-21 (placeholder-grade, revisit welcome): echoes
    // the yield-mirage pattern line on purpose — it's also literally the
    // debut art (open empty vault, her beckoning at the door).
    caseRef("rug", "yield-mirage", "The textbook. Paid from the door, not the vault. Day 12.")),
  coin("altar-swap", "AltarSwap", "ALTAR", "defi", RARITIES.UNCOMMON, 6, 9, 3,
    caseRef("legit", "anon-but-real", "The swap desk of the temple — anonymous priests, immaculate pools.")),
  coin("midnight-base", "Midnight Base", "MBASE", "bluechip", RARITIES.RARE, 9, 12, 1,
    caseRef("legit", "stealth-launch", "Shipped at 3am with no announcement. The chain noticed anyway.")),
  coin("candle-index", "Candle Index", "CNDL", "analysis", RARITIES.COMMON, 4, 6, 1,
    caseRef("legit", "infra-grind", "An index of every wick since genesis. Boring, priceless.")),
  coin("syntax-gold", "Syntax Gold", "SGLD", "discipline", RARITIES.UNCOMMON, 7, 9, 2,
    caseRef("legit", "doxxed-clean", "Code so clean it audits itself. Almost.")),
  coin("vaporwarex", "VaporwareX", "VPRX", "hype", RARITIES.COMMON, 4, 8, 6,
    caseRef("rug", "slick-but-broken", "The demo was a video. The video was the product. Day 19.")),
  coin("angel-ledger", "Angel Ledger", "ANGEL", "infra", RARITIES.RARE, 8, 11, 1,
    caseRef("legit", "infra-grind", "Every grant, every burn, every wing-beat — notarized.")),
  coin("genesis-terminal", "Genesis Terminal", "GEN", "terminal", RARITIES.FOIL, 10, 16, 3,
    caseRef("legit", "stealth-launch", "Block one of the Liminal chain. Everything since is commentary.")),
  coin("wick-street", "Wick Street", "WICK", "hype", RARITIES.COMMON, 4, 7, 5,
    caseRef("zombie", "meme-mania", "Every candle told a story; every story ended at open.")),
  coin("votive-chain", "Votive Chain", "VOTV", "infra", RARITIES.COMMON, 4, 6, 1,
    caseRef("legit", "stealth-launch", "A chain of lit candles — proof-of-prayer, oddly durable.")),
  coin("monk-stack", "Monk Stack", "MONK", "defense", RARITIES.UNCOMMON, 6, 8, 0,
    caseRef("legit", "doxxed-clean", "GR80's personal stack. Never sold; never will.")),
  coin("oil-standard", "Oil Standard", "OIL", "bluechip", RARITIES.UNCOMMON, 7, 10, 1,
    caseRef("legit", "redemption-arc", "Backed by the fountain's oil. Repriced after the schism; never broke again.")),
  coin("lucky-capsule", "Lucky Capsule", "LUCK", "pattern", RARITIES.UNCOMMON, 5, 9, 5,
    caseRef("zombie", "meme-mania", "Every capsule a coin flip. The crowd ran out of quarters.")),
  coin("demon-desk", "Demon Desk", "DMON", "hype", RARITIES.RARE, 8, 13, 6,
    caseRef("rug", "celeb-shill", "Barron's desk seeded it; Barron's desk exited it. He calls it tuition. Day 30.")),
  coin("prophet-margin", "Prophet Margin", "PRFT", "analysis", RARITIES.RARE, 8, 11, 1,
    caseRef("legit", "anon-but-real", "Traded on prophecy spreads. The margins kept being right.")),
  coin("our-lady-rl80", "Our Lady RL80", "RL80", "terminal", RARITIES.FOIL, 9, 14, 4,
    caseRef("legit", "redemption-arc", "The mother token. Burned, blessed, reborn — the whole liturgy.")),
];

// The 33 actions, ordered by kit role: lens keys (by station), deep scans
// (by station), cross-references, then the specialists. Kit text is the
// card's rules text; the twelve marked in caseKit.js FIRST_TWELVE are live
// at the table today (mock effects until Tier-2 deepEntries land, §3.3).
export const ACTION_CARDS = [
  // ── Lens keys — common · "the next look costs less than the mistake" ──
  action("audit-flare", "Audit Flare", "discipline", RARITIES.COMMON, 3, "Gain +10 portfolio and +2 Cred.", { portfolio: 10, cred: 2 },
    kit("lensKey", "monk", "GR80 slides you his 2 strongest evidence cards.")),
  action("diamond-hands", "Diamond Hands", "defense", RARITIES.COMMON, 2, "Gain +3 portfolio and +1 Cred.", { portfolio: 3, cred: 1 },
    kit("lensKey", "monk", "GR80 slides you his 2 strongest evidence cards.")),
  action("limit-order-prayer", "Limit Order Prayer", "defense", RARITIES.COMMON, 1, "Gain +2 Cred and +2 portfolio.", { portfolio: 2, cred: 2 },
    kit("lensKey", "monk", "GR80 slides you his 2 strongest evidence cards.")),
  action("gasless-miracle", "Gasless Miracle", "discipline", RARITIES.COMMON, 0, "Gain +5 portfolio without spending Cred.", { portfolio: 5 },
    kit("lensKey", "monk", "GR80 slides you his 2 strongest evidence cards.")),
  action("forked-rumor", "Forked Rumor", "hype", RARITIES.COMMON, 2, "Gain +9 portfolio.", { portfolio: 9 },
    kit("lensKey", "demon", "Barron slides you his 2 strongest evidence cards.")),
  action("market-sermon", "Market Sermon", "hype", RARITIES.COMMON, 1, "Gain +6 portfolio. John Barron gains +4 more.", { portfolio: 6 },
    kit("lensKey", "demon", "Barron slides you his 2 strongest evidence cards.")),
  action("fomo-cascade", "FOMO Cascade", "pump", RARITIES.COMMON, 3, "Gain +12 portfolio. John Barron gets extra edge.", { portfolio: 12 },
    kit("lensKey", "demon", "Barron slides you his 2 strongest evidence cards.")),
  action("copium-drip", "Copium Drip", "meme", RARITIES.COMMON, 1, "Gain +4 portfolio and +1 Cred.", { portfolio: 4, cred: 1 },
    kit("lensKey", "demon", "Barron slides you his 2 strongest evidence cards.")),
  action("wallet-seance", "Wallet Séance", "investigation", RARITIES.COMMON, 2, "Gain +7 portfolio and +1 Cred.", { portfolio: 7, cred: 1 },
    kit("lensKey", "marisol", "Marisol slides you her 2 strongest evidence cards.")),
  action("compliance-siren", "Compliance Siren", "investigation", RARITIES.COMMON, 2, "Gain +6 portfolio.", { portfolio: 6 },
    kit("lensKey", "marisol", "Marisol slides you her 2 strongest evidence cards.")),
  action("short-the-noise", "Short the Noise", "analysis", RARITIES.COMMON, 2, "Gain +7 portfolio and +1 Cred.", { portfolio: 7, cred: 1 },
    kit("lensKey", "marisol", "Marisol slides you her 2 strongest evidence cards.")),
  action("liquidity-ladder", "Liquidity Ladder", "defi", RARITIES.COMMON, 2, "Gain +4 Cred.", { cred: 4 },
    kit("lensKey", "marisol", "Marisol slides you her 2 strongest evidence cards.")),
  action("mempool-prophecy", "Mempool Prophecy", "pattern", RARITIES.COMMON, 2, "Gain +6 portfolio and draw a card.", { portfolio: 6, draw: 1 },
    kit("lensKey", "eugene", "Eugene slides you his 2 strongest evidence cards.")),
  action("pattern-rosary", "Pattern Rosary", "pattern", RARITIES.COMMON, 1, "Gain +4 portfolio and +1 Cred.", { portfolio: 4, cred: 1 },
    kit("lensKey", "eugene", "Eugene slides you his 2 strongest evidence cards.")),
  action("candle-palmistry", "Candle Palmistry", "pattern", RARITIES.COMMON, 2, "Gain +7 portfolio.", { portfolio: 7 },
    kit("lensKey", "eugene", "Eugene slides you his 2 strongest evidence cards.")),
  action("origin-story", "Origin Story", "pattern", RARITIES.COMMON, 1, "Gain +5 portfolio.", { portfolio: 5 },
    kit("lensKey", "eugene", "Eugene slides you his 2 strongest evidence cards.")),

  // ── Deep scans — uncommon · "a level deeper than any question reaches" ──
  action("cold-wallet", "Cold Wallet", "defense", RARITIES.UNCOMMON, 2, "Gain +6 portfolio and reduce crash pressure.", { portfolio: 6, shield: 1 },
    kit("deepScan", "monk", "Deep scan — GR80 opens the cold archive: everything he still holds.")),
  action("server-room-alpha", "Server Room Alpha", "discipline", RARITIES.UNCOMMON, 3, "Gain +13 portfolio.", { portfolio: 13 },
    kit("deepScan", "monk", "Deep scan — GR80 walks you into the racks: everything he still holds.")),
  action("pump-signal", "Pump Signal", "pump", RARITIES.UNCOMMON, 2, "+10 portfolio. John Barron gets extra edge.", { portfolio: 10 },
    kit("deepScan", "demon", "Deep scan — Barron traces the pump to its source: everything the hype still hides.")),
  action("exit-liquidity", "Exit Liquidity", "risk", RARITIES.UNCOMMON, 1, "Gain +14 portfolio. Lose 2 Cred.", { portfolio: 14, cred: -2 },
    kit("deepScan", "demon", "Deep scan — Barron maps the exits: everything the sellers still hide.")),
  action("chart-exorcism", "Chart Exorcism", "analysis", RARITIES.UNCOMMON, 2, "Gain +8 portfolio.", { portfolio: 8 },
    kit("deepScan", "marisol", "Deep scan — Marisol drags out everything the chain still hides.")),
  action("terminal-hack", "Terminal Hack", "hack", RARITIES.UNCOMMON, 3, "Gain +8 portfolio. Bots lose a little tempo.", { portfolio: 8, opponentPortfolio: -2 },
    kit("deepScan", "marisol", "Deep scan — Marisol pulls the raw calldata: everything the chain still hides.")),
  action("prophecy-backtest", "Prophecy Backtest", "pattern", RARITIES.UNCOMMON, 2, "Gain +8 portfolio.", { portfolio: 8 },
    kit("deepScan", "eugene", "Deep scan — Eugene backtests the whole story: every chart he remembers, laid over this one.")),
  action("apocrypha-dive", "Apocrypha Dive", "pattern", RARITIES.UNCOMMON, 2, "Gain +6 portfolio and draw a card.", { portfolio: 6, draw: 1 },
    kit("deepScan", "eugene", "Deep scan — Eugene digs the apocrypha: everything the story still hides.")),

  // ── Cross-references — rare · the dots connect ACROSS lenses (§3.2) ──
  action("oracle-crosscheck", "Oracle Crosscheck", "pattern", RARITIES.RARE, 1, "Gain +5 portfolio and +1 Cred.", { portfolio: 5, cred: 1 },
    kitPair(["marisol", "monk"], "Pull the strongest evidence card from every station you haven't visited.")),
  action("ledger-vs-legend", "Ledger vs Legend", "analysis", RARITIES.RARE, 3, "Gain +11 portfolio.", { portfolio: 11 },
    kitPair(["marisol", "eugene"], "Cross-reference — work LOGOS and MYTHOS, then lay the chain over the story and read the seam.")),
  action("faith-audit", "Faith Audit", "discipline", RARITIES.RARE, 3, "Gain +10 portfolio and +2 Cred.", { portfolio: 10, cred: 2 },
    kitPair(["monk", "demon"], "Cross-reference — work ETHOS and PATHOS, then check the crowd's fervor against the team's record.")),
  action("choir-vs-canon", "Choir vs Canon", "hype", RARITIES.RARE, 2, "Gain +9 portfolio.", { portfolio: 9 },
    kitPair(["demon", "eugene"], "Cross-reference — work PATHOS and MYTHOS, then read what the choir sings against what the scripture promises.")),

  // ── Specialists — the ticket-dial and table cards (§3.2b) ──
  action("rug-warning", "Rug Warning", "investigation", RARITIES.RARE, 2, "Gain +5 portfolio and +3 extra as Marisol.", { portfolio: 5 },
    kit("trace", null, "Sweep for a fast-exit fingerprint. Finds it only if the rug is days away.")),
  action("insider-ping", "Insider Ping", "investigation", RARITIES.UNCOMMON, 1, "Gain +2 Cred and +4 portfolio.", { portfolio: 4, cred: 2 },
    kit("peek", null, "At pundit calls, wiretap one partner and see their exact sealed number.")),
  action("candle-vigil", "Candle Vigil", "defense", RARITIES.COMMON, 1, "Gain +3 portfolio and +1 shield.", { portfolio: 3, shield: 1 },
    kit("shield", null, "Shield: absorb one negative market flip this docket.")),
  action("neon-stop-loss", "Neon Stop Loss", "defense", RARITIES.UNCOMMON, 1, "Gain +1 shield and +2 portfolio.", { portfolio: 2, shield: 1 },
    kit("stoploss", null, "This case's ticket can't lose more than 25, whatever you staked.")),
  action("terminal-foil-moment", "Terminal Foil Moment", "terminal", RARITIES.FOIL, 4, "Gain +18 portfolio. This is the table-stopper.", { portfolio: 18 },
    kit("wildcard", null, "The desk stops — take two extra actions this case.")),
];

export const MARKET_CARDS = [
  market("bull-run", "Bull Run", RARITIES.UNCOMMON, "Everyone gains +8 portfolio.", { portfolioAll: 8 },
    docket(2, "The tide lifts every book on the desk.", "NEXT CASE PAYS ×1.25", { payoutMult: 1.25 })),
  market("meme-season", "Meme Season", RARITIES.RARE, "Hype traders gain +10 portfolio. Others gain +3.", { styleBonus: { hype: 10 }, portfolioAll: 3 },
    docket(1, "Everything with a dog on it is up. Barron looks smug.", "NEXT CASE PAYS ×1.25", { payoutMult: 1.25 })),
  market("liquidity-drain", "Liquidity Drain", RARITIES.COMMON, "Everyone loses 2 Cred.", { credAll: -2 },
    docket(3, "The pools thin out. Every book bleeds a little.", "ALL BOOKS −5 · SHIELDS APPLY", { portfolioAll: -5 })),
  market("protocol-exploit", "Protocol Exploit", RARITIES.UNCOMMON, "Disciplined traders lose 6 portfolio. Others lose 2.", { stylePenalty: { discipline: -6 }, portfolioAll: -2 },
    docket(2, "Someone found the key under the mat.", "ALL BOOKS −10 · SHIELDS APPLY", { portfolioAll: -10 })),
  market("regulator-sweep", "Regulator Sweep", RARITIES.RARE, "Hype traders lose 6 portfolio. Analysis traders gain 5.", { styleBonus: { analysis: 5 }, stylePenalty: { hype: -6 } },
    docket(1, "Subpoenas for the hype desk. Barron takes the fifth.", "PATHOS KIT CARDS DISABLED NEXT CASE", { disableLens: "demon" })),
  market("midnight-listing", "Midnight Listing", RARITIES.UNCOMMON, "Everyone gains +3 Cred.", { credAll: 3 },
    docket(2, "A quiet 3am listing. Nothing moves that matters.", "NO EFFECT ON ANY BOOK", {})),
  market("stablecoin-weather", "Stablecoin Weather", RARITIES.COMMON, "Everyone gains +4 portfolio and +1 Cred.", { portfolioAll: 4, credAll: 1 },
    docket(3, "Nothing moves. The desk breathes.", "NO EFFECT ON ANY BOOK", {})),
  market("volatility-mass", "Volatility Mass", RARITIES.RARE, "High-risk traders gain +9 portfolio and lose 2 Cred.", { styleBonus: { hype: 9 }, styleCred: { hype: -2 } },
    docket(1, "High mass at the vol altar: pain now, spoils next case.", "ALL BOOKS −5 · NEXT CASE PAYS ×1.25", { portfolioAll: -5, payoutMult: 1.25 })),
  market("dead-chain-hour", "Dead Chain Hour", RARITIES.COMMON, "Everyone loses 4 portfolio unless shielded.", { portfolioAll: -4, crash: true },
    docket(3, "Liquidity evaporates.", "ALL BOOKS −10 · SHIELDS APPLY", { portfolioAll: -10 })),
  market("genesis-candle", "Genesis Candle", RARITIES.RARE, "Everyone gains +12 portfolio. The market remembers.", { portfolioAll: 12 },
    docket(1, "The first candle relights. The market remembers.", "NEXT CASE PAYS ×1.5", { payoutMult: 1.5 })),
  market("airdrop-monsoon", "Airdrop Monsoon", RARITIES.COMMON, "Everyone gains +2 portfolio and +2 Cred.", { portfolioAll: 2, credAll: 2 },
    docket(3, "It rains tokens on the just and unjust alike.", "ALL BOOKS +5", { portfolioAll: 5 })),
  market("influencer-eclipse", "Influencer Eclipse", RARITIES.COMMON, "Hype traders lose 4 portfolio and 1 Cred.", { stylePenalty: { hype: -4 }, styleCred: { hype: -1 } },
    docket(3, "The influencers go dark mid-sentence.", "NO PUNDIT LEANS NEXT CASE", { silenceLeans: true })),
  market("rug-harvest", "Rug Harvest", RARITIES.UNCOMMON, "Everyone loses 3 portfolio unless shielded.", { portfolioAll: -3, crash: true },
    docket(2, "Rug season. The floors roll up everywhere.", "ALL BOOKS −8 · SHIELDS APPLY", { portfolioAll: -8 })),
  market("halving-eve", "Halving Eve", RARITIES.RARE, "Disciplined traders gain +8 portfolio. Others gain +2.", { styleBonus: { discipline: 8 }, portfolioAll: 2 },
    docket(1, "The halving concentrates every mind on the desk.", "+1 ACTION FOR EVERYONE NEXT CASE", { extraAction: 1 })),
  market("our-lady-appears", "Our Lady Appears", RARITIES.RARE, "Analysis and pattern traders gain +6 portfolio.", { styleBonus: { analysis: 6, pattern: 6 } },
    docket(1, "She passes the desk; every book feels lighter.", "EVERY BOOK GAINS A SHIELD", { grantShield: 1 })),
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

function coin(id, name, ticker, tag, rarity, cost, value, volatility, caseRefData) {
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
    caseRef: caseRefData,
  };
}

// A coin's solved dossier (§4.6): what the token turned out to be.
// outcome: "rug" (it pulled) | "legit" (it held) | "zombie" (it just died).
function caseRef(outcome, pattern, note) {
  return { outcome, pattern, note };
}

function action(id, name, tag, rarity, cost, effectText, effect, kitData) {
  return {
    id,
    name,
    type: CARD_TYPES.ACTION,
    tag,
    rarity,
    cost,
    effectText,
    effect,
    kit: kitData,
  };
}

// Kit identity (§3.2a) — the card's primary rules. `lens` is the station the
// effect reads (null for lens-agnostic specialists).
function kit(role, lens, text) {
  return lens ? { role, lens, text } : { role, text };
}

// Cross-references name a lens PAIR: both stations must be worked before the
// card connects the dots (§3.2 — the case-003 moment, made mechanical).
function kitPair(lenses, text) {
  return { role: "crossref", lenses, text };
}

function market(id, name, rarity, effectText, effect, docketData) {
  return {
    id,
    name,
    type: CARD_TYPES.MARKET,
    rarity,
    effectText,
    effect,
    docket: docketData,
  };
}

// The market card's docket-event identity (§4.6): what flips between cases
// at the table. `weight` is the event-deck draw weight. Mechanics beyond
// portfolioAll/payoutMult are authored ahead of the Phase 3 resolver.
function docket(weight, text, banner, mech) {
  return { weight, text, banner, ...mech };
}
