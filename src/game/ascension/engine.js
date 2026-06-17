// The Ascension — pure race engine.
//
// No DOM, no three.js. Every mutation returns a NEW state plus an `events`
// array describing what just happened; the R3F layer turns those events into
// animations (run / fall / rise / Our Lady's intervention / victory). Keeping
// this pure makes it unit-testable and makes the "feel" tunable in isolation.
//
// Two views of the same number: a racer's `step` is BOTH its position on the
// flat track AND the latest point of its price chart. Each turn that targets a
// racer appends a candle to that racer's `history`; `activeId` marks whose chart
// lights up vividly this turn (the others render muted).
//
// State shape:
//   {
//     status: 'racing' | 'won',
//     turn: number,
//     grace: number,
//     activeId: null | id,                 // racer targeted this turn
//     racers: { [id]: {
//       id, slot, name, model, lane, advance,
//       step, state, downTurns,
//       history: [{ step, kind }],         // kind: 'start'|'up'|'down'|'flat'|'miracle'
//     } },
//     deck: Card[],
//     pendingPrayer: null | { prayerId, targetId, expiresTurn },
//     winner: null | id,
//     events: Event[],   // from the LAST call only — consume per call
//   }
//
// Racer.state: 'idle' | 'running' | 'falling' | 'down' | 'rising' | 'celebrating'

import { TRACK_LENGTH, GRACE_START, RACER_SLOTS } from "./config.js";
import { CARD_TYPES, SLICE_DECK, getPrayer } from "./cards.js";

export function createRace({
  slots = RACER_SLOTS,
  deck = SLICE_DECK,
  grace = GRACE_START,
} = {}) {
  const racers = {};
  for (const s of slots) {
    racers[s.id] = {
      id: s.id,
      slot: s.slot,
      name: s.name,
      model: s.model,
      lane: s.lane,
      advance: s.advance,
      color: s.color,
      step: 0,
      state: "idle",
      downTurns: 0,
      history: [{ t: 0, step: 0, kind: "start" }],
    };
  }
  return {
    status: "racing",
    turn: 0,
    grace,
    activeId: null,
    racers,
    deck,
    pendingPrayer: null,
    winner: null,
    events: [],
  };
}

// Shallow-clone the bits we mutate; deep-copy each racer's history array so a
// push() never leaks back into the previous state. Reset events for the call.
function fork(state) {
  const racers = {};
  for (const [id, r] of Object.entries(state.racers)) {
    racers[id] = { ...r, history: [...r.history] };
  }
  return {
    ...state,
    racers,
    pendingPrayer: state.pendingPrayer ? { ...state.pendingPrayer } : null,
    events: [],
  };
}

function checkWin(s) {
  for (const r of Object.values(s.racers)) {
    if (r.step >= TRACK_LENGTH) {
      s.status = "won";
      s.winner = r.id;
      r.state = "celebrating";
      s.events.push({ type: "win", racerId: r.id });
      return;
    }
  }
}

export function resolveTurn(state) {
  if (state.status === "won") return fork(state);
  const s = fork(state);
  const card = s.deck[s.turn];
  if (!card) return s; // deck exhausted → no-op (UI should stop calling)

  const racer = s.racers[card.targetId];
  s.activeId = racer.id;

  if (card.type === CARD_TYPES.PUMP) {
    if (racer.downTurns > 0) {
      // Still getting up — the pump is wasted. The penalty for not praying.
      racer.downTurns -= 1;
      racer.state = racer.downTurns > 0 ? "down" : "rising";
      racer.history.push({ t: s.turn + 1, step: racer.step, kind: "flat" });
      s.events.push({
        type: "recover",
        racerId: racer.id,
        downTurns: racer.downTurns,
      });
    } else {
      const from = racer.step;
      racer.step = from + racer.advance;
      racer.state = "running";
      racer.history.push({ t: s.turn + 1, step: racer.step, kind: "up" });
      s.events.push({
        type: "move",
        racerId: racer.id,
        from,
        to: racer.step,
        card: card.label,
      });
    }
  } else if (card.type === CARD_TYPES.RUG) {
    const from = racer.step;
    racer.step = Math.max(0, from - (card.knockback ?? 2));
    racer.downTurns = 1;
    racer.state = "falling";
    racer.history.push({ t: s.turn + 1, step: racer.step, kind: "down" });
    s.pendingPrayer = {
      prayerId: "resurrection",
      targetId: racer.id,
      expiresTurn: s.turn + 2,
    };
    s.events.push({
      type: "fall",
      racerId: racer.id,
      from,
      to: racer.step,
      card: card.label,
    });
    s.events.push({
      type: "prayerOffer",
      prayerId: "resurrection",
      targetId: racer.id,
    });
  }

  s.turn += 1;
  checkWin(s);
  return s;
}

export function canPray(state, prayerId, targetId) {
  const prayer = getPrayer(prayerId);
  return !!(
    prayer &&
    state.status !== "won" &&
    state.pendingPrayer &&
    state.pendingPrayer.prayerId === prayerId &&
    state.pendingPrayer.targetId === targetId &&
    state.grace >= prayer.cost
  );
}

export function pray(state, prayerId, targetId) {
  if (!canPray(state, prayerId, targetId)) return fork(state);
  const s = fork(state);
  const prayer = getPrayer(prayerId);
  const racer = s.racers[targetId];

  s.grace -= prayer.cost;
  racer.downTurns = 0;
  racer.step += prayer.restore;
  racer.state = "rising";
  racer.history.push({ t: s.turn + 1, step: racer.step, kind: "miracle" });
  s.activeId = targetId;
  s.pendingPrayer = null;
  s.events.push({
    type: "intervene",
    prayerId,
    targetId,
    caption: prayer.caption,
  });
  s.events.push({ type: "rise", racerId: targetId, to: racer.step });
  return s;
}

export function getWinner(state) {
  return state.winner ?? null;
}
