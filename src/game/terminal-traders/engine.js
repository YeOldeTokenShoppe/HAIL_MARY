import { ACTION_CARDS, CARD_TYPES, COIN_CARDS, MARKET_CARDS, TRADERS, getCardById } from "./cards.js";

const WIN_PORTFOLIO = 100;
const MAX_ROUNDS = 10;
const STARTING_HAND_SIZE = 5;

export function createGame({ traderId = "eugene", seed = Date.now(), cardPool = null } = {}) {
  const selectedTrader = TRADERS.find((trader) => trader.id === traderId) || TRADERS[0];
  const playerOrder = [
    selectedTrader,
    ...TRADERS.filter((trader) => trader.id !== selectedTrader.id),
  ];
  // A collection-gated pool that is too small to deal opening hands and feed
  // three bots falls back to the full set rather than producing a dead table.
  const pool = Array.isArray(cardPool) && cardPool.length >= STARTING_HAND_SIZE * 2
    ? cardPool
    : [...COIN_CARDS, ...ACTION_CARDS];
  const drawDeck = shuffle([...pool], seed);
  const marketDeck = shuffle([...MARKET_CARDS], seed + 404);
  const players = playerOrder.map((trader, index) => ({
    id: trader.id,
    traderId: trader.id,
    name: trader.name,
    handle: trader.handle,
    color: trader.color,
    style: trader.style,
    cred: trader.startingCred,
    portfolio: trader.startingPortfolio,
    holdings: [],
    shields: 0,
    isHuman: index === 0,
    abilityUsed: false,
    crashIgnored: false,
  }));

  let state = {
    id: `tt-${seed}`,
    seed,
    cardPool: pool,
    round: 1,
    maxRounds: MAX_ROUNDS,
    activePlayerIndex: 0,
    playsRemaining: 2,
    status: "playing",
    winnerId: null,
    drawDeck,
    discardPile: [],
    marketDeck,
    marketDiscard: [],
    currentMarket: null,
    hand: [],
    players,
    log: [
      `Genesis table opened. ${selectedTrader.name} takes the first terminal.`,
    ],
  };

  state = drawCards(state, STARTING_HAND_SIZE);
  return state;
}

export function drawCards(state, count = 1) {
  const next = cloneState(state);
  for (let i = 0; i < count; i += 1) {
    if (next.drawDeck.length === 0) {
      next.drawDeck = shuffle(next.discardPile, next.seed + next.round + i);
      next.discardPile = [];
    }
    const card = next.drawDeck.shift();
    if (card) next.hand.push(card);
  }
  return next;
}

export function playCard(state, cardId) {
  if (state.status !== "playing") return state;
  if (state.playsRemaining <= 0) return addLog(state, "No plays remaining this turn.");

  const cardIndex = state.hand.findIndex((card) => card.id === cardId);
  if (cardIndex === -1) return state;

  const card = state.hand[cardIndex];
  const player = state.players[0];
  if (card.cost > player.cred) {
    return addLog(state, `${card.name} needs ${card.cost} Cred.`);
  }

  const next = cloneState(state);
  const [playedCard] = next.hand.splice(cardIndex, 1);
  next.players[0].cred -= playedCard.cost;

  applyPlayedCard(next, next.players[0], playedCard);
  next.discardPile.push(playedCard);
  next.playsRemaining -= 1;
  next.log.unshift(`${next.players[0].name} played ${playedCard.name}.`);

  return checkGameEnd(next);
}

export function endTurn(state) {
  if (state.status !== "playing") return state;
  let next = cloneState(state);
  next.log.unshift(`${next.players[0].name} ends the turn.`);

  for (let i = 1; i < next.players.length; i += 1) {
    next = runBotTurn(next, i);
    if (next.status !== "playing") return next;
  }

  next = revealMarket(next);
  next.round += 1;
  next.playsRemaining = 2;
  const refillCount = next.hand.length === 0 ? 3 : 1;
  next = drawCards(next, refillCount);
  next.log.unshift(`Round ${Math.min(next.round, MAX_ROUNDS)} begins. You draw ${refillCount} card${refillCount === 1 ? "" : "s"}.`);
  return checkGameEnd(next);
}

export function recoverHand(state) {
  if (state.status !== "playing") return state;
  if (state.hand.length > 0) return addLog(state, "Recovery is only available when your hand is empty.");

  const next = drawCards(state, 3);
  next.playsRemaining = Math.max(next.playsRemaining, 1);
  next.log.unshift("Emergency refill: you draw 3 cards from the terminal queue.");
  return next;
}

export function bankCred(state) {
  if (state.status !== "playing") return state;
  if (state.playsRemaining <= 0) return addLog(state, "No plays remaining this turn.");
  if (hasPlayableCard(state)) return addLog(state, "You still have a playable card.");

  const next = cloneState(state);
  next.players[0].cred += 3;
  next.playsRemaining -= 1;
  next.log.unshift("You bank 3 Cred while waiting for a playable setup.");
  return next;
}

export function hasPlayableCard(state) {
  if (!state || state.status !== "playing" || state.playsRemaining <= 0) return false;
  const player = state.players[0];
  return state.hand.some((card) => card.cost <= player.cred);
}

export function revealMarket(state) {
  const next = cloneState(state);
  if (next.marketDeck.length === 0) {
    next.marketDeck = shuffle(next.marketDiscard, next.seed + next.round + 900);
    next.marketDiscard = [];
  }

  const market = next.marketDeck.shift();
  if (!market) return next;

  if (next.currentMarket) next.marketDiscard.push(next.currentMarket);
  next.currentMarket = market;
  applyMarket(next, market);
  next.log.unshift(`Market flips: ${market.name}. ${market.effectText}`);
  return next;
}

export function chooseTrader(state, traderId) {
  return createGame({
    traderId,
    seed: state?.seed || Date.now(),
    cardPool: state?.cardPool || null,
  });
}

export function getWinner(state) {
  if (!state.winnerId) return null;
  return state.players.find((player) => player.id === state.winnerId) || null;
}

function runBotTurn(state, playerIndex) {
  const next = cloneState(state);
  const player = next.players[playerIndex];
  const botDraws = [];

  for (let i = 0; i < 2; i += 1) {
    if (next.drawDeck.length === 0) {
      next.drawDeck = shuffle(next.discardPile, next.seed + next.round + playerIndex);
      next.discardPile = [];
    }
    const card = next.drawDeck.shift();
    if (card) botDraws.push(card);
  }

  const playable = botDraws
    .filter((card) => card.cost <= player.cred)
    .sort((a, b) => scoreBotCard(b, player) - scoreBotCard(a, player))[0];

  if (playable) {
    player.cred -= playable.cost;
    applyPlayedCard(next, player, playable);
    next.discardPile.push(...botDraws);
    next.log.unshift(`${player.name} played ${playable.name}.`);
  } else {
    player.cred += 1;
    next.discardPile.push(...botDraws);
    next.log.unshift(`${player.name} held position and gained 1 Cred.`);
  }

  return checkGameEnd(next);
}

function applyPlayedCard(state, player, card) {
  if (card.type === CARD_TYPES.COIN) {
    let value = card.baseValue;
    if (player.id === "eugene" && card.tag === "meme" && !player.abilityUsed) {
      value += 8;
      player.abilityUsed = true;
      state.log.unshift("Eugene's Rainbow Candle adds +8 to a meme coin.");
    }
    player.holdings.push({ cardId: card.id, name: card.name, value, tag: card.tag });
    player.portfolio += value;
    return;
  }

  if (card.type !== CARD_TYPES.ACTION) return;

  let portfolioDelta = card.effect?.portfolio || 0;
  let credDelta = card.effect?.cred || 0;

  if (player.id === "marisol" && card.tag === "investigation") portfolioDelta += 3;
  if (player.id === "halo-node" && card.tag === "automation") portfolioDelta += 3;
  if (player.id === "eugene" && card.tag === "meme") portfolioDelta += 4;
  if (player.id === "bullhorn-broker" && (card.tag === "hype" || card.tag === "pump")) portfolioDelta += 4;

  player.portfolio += portfolioDelta;
  player.cred += credDelta;
  player.shields += card.effect?.shield || 0;

  if (card.effect?.draw && player.isHuman) {
    const drawn = drawCards(state, card.effect.draw);
    state.drawDeck = drawn.drawDeck;
    state.hand = drawn.hand;
    state.discardPile = drawn.discardPile;
  }

  if (card.effect?.opponentPortfolio) {
    state.players.forEach((other) => {
      if (other.id !== player.id) {
        other.portfolio = Math.max(0, other.portfolio + card.effect.opponentPortfolio);
      }
    });
  }
}

function applyMarket(state, market) {
  state.players.forEach((player) => {
    const effect = market.effect || {};
    let portfolioDelta = effect.portfolioAll || 0;
    let credDelta = effect.credAll || 0;

    if (effect.styleBonus?.[player.style]) portfolioDelta += effect.styleBonus[player.style];
    if (effect.stylePenalty?.[player.style]) portfolioDelta += effect.stylePenalty[player.style];
    if (effect.styleCred?.[player.style]) credDelta += effect.styleCred[player.style];

    if (portfolioDelta < 0 && player.shields > 0) {
      player.shields -= 1;
      portfolioDelta = 0;
      state.log.unshift(`${player.name}'s shield absorbs the hit.`);
    }

    if (portfolioDelta < 0 && player.id === "halo-node" && !player.crashIgnored && effect.crash) {
      player.crashIgnored = true;
      portfolioDelta = 0;
      state.log.unshift("Halo Node ignores the first crash.");
    }

    if (portfolioDelta < 0 && player.id === "bullhorn-broker") {
      portfolioDelta -= 3;
    }

    player.portfolio = Math.max(0, player.portfolio + portfolioDelta);
    player.cred = Math.max(0, player.cred + credDelta);
  });
}

function checkGameEnd(state) {
  const next = cloneState(state);
  const leader = [...next.players].sort((a, b) => b.portfolio - a.portfolio)[0];
  if (leader?.portfolio >= WIN_PORTFOLIO) {
    next.status = "complete";
    next.winnerId = leader.id;
    next.log.unshift(`${leader.name} hit ${WIN_PORTFOLIO} portfolio value and wins.`);
    return next;
  }

  if (next.round > MAX_ROUNDS) {
    next.status = "complete";
    next.winnerId = leader?.id || null;
    next.log.unshift(`Market closed after ${MAX_ROUNDS} rounds. ${leader?.name} wins.`);
  }

  return next;
}

function scoreBotCard(card, player) {
  const personality = BOT_PERSONALITIES[player.id] || {};
  const preferredTags = personality.preferredTags || [];
  const avoidedTags = personality.avoidedTags || [];
  const styleBonus = card.tag === player.style ? 6 : 0;
  const preferredBonus = preferredTags.includes(card.tag) ? 10 : 0;
  const avoidedPenalty = avoidedTags.includes(card.tag) ? -8 : 0;
  const riskBonus = card.tag === "risk" ? personality.riskBias || 0 : 0;
  const defenseBonus = card.tag === "defense" ? personality.defenseBias || 0 : 0;

  if (card.type === CARD_TYPES.COIN) {
    const volatilityBias = (card.volatility || 0) * (personality.volatilityBias || 0);
    return card.baseValue - card.cost + styleBonus + preferredBonus + avoidedPenalty + volatilityBias;
  }

  return (card.effect?.portfolio || 0)
    + (card.effect?.cred || 0) * 2
    - card.cost
    + styleBonus
    + preferredBonus
    + avoidedPenalty
    + riskBonus
    + defenseBonus;
}

const BOT_PERSONALITIES = {
  "eugene": {
    preferredTags: ["meme", "pump"],
    avoidedTags: ["analysis"],
    volatilityBias: 1.4,
    riskBias: 2,
  },
  "marisol": {
    preferredTags: ["investigation", "analysis", "defense"],
    avoidedTags: ["hype", "risk"],
    volatilityBias: -0.8,
    defenseBias: 4,
  },
  "halo-node": {
    preferredTags: ["automation", "defense", "bluechip"],
    avoidedTags: ["meme", "hype"],
    volatilityBias: -0.4,
    defenseBias: 5,
  },
  "bullhorn-broker": {
    preferredTags: ["hype", "pump", "risk", "meme"],
    avoidedTags: ["defense"],
    volatilityBias: 1,
    riskBias: 6,
  },
};

function addLog(state, message) {
  const next = cloneState(state);
  next.log.unshift(message);
  return next;
}

function cloneState(state) {
  return {
    ...state,
    drawDeck: [...state.drawDeck],
    discardPile: [...state.discardPile],
    marketDeck: [...state.marketDeck],
    marketDiscard: [...state.marketDiscard],
    hand: [...state.hand],
    players: state.players.map((player) => ({
      ...player,
      holdings: [...player.holdings],
    })),
    log: [...state.log],
  };
}

function shuffle(cards, seed) {
  const next = [...cards];
  let value = seed || 1;
  for (let i = next.length - 1; i > 0; i -= 1) {
    value = (value * 9301 + 49297) % 233280;
    const j = Math.floor((value / 233280) * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export const TERMINAL_TRADERS_RULES = {
  winPortfolio: WIN_PORTFOLIO,
  maxRounds: MAX_ROUNDS,
  startingHandSize: STARTING_HAND_SIZE,
};

export function hydrateCard(cardId) {
  return getCardById(cardId);
}
