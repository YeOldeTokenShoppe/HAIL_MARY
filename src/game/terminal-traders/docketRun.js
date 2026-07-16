// Docket Run — the live-table state machine (CASE_TABLE.md §4, v4 ticket).
// Extracted verbatim from the /case-table-dev mock so the UI, the parity
// harness, and any future server-side replay settle a case through ONE
// implementation (guardrail §5.2: payouts stay a monotonic affine transform
// of Brier — casePnl in caseTable.js is the only payout kernel).
//
// Pure except where noted: botRound/finalizeCalls mutate the passed bot
// state (a per-case scratch object — see createBotState), everything else
// returns new values. All randomness is seeded mulberry32 with the exact
// call-site expressions the mock shipped, so a (seed, script) pair replays
// the same table — the trust model §4.7 depends on this.
//
// NOTE: imports ./caseTable, so the scripts/ data:-URL loader can't load
// this file raw — rewrite the import specifier to a data: URL of
// caseTable.js first (see scripts/verify-docket-run.mjs).

import { mulberry32, seatBelief, casePnl, SEAT_MODELS, TABLE_RULES } from "./caseTable";

export const YOU = "you";
export const BASE_ACTIONS = 3;
export const BOT_ROUNDS = 3;

// Station key → canonical Genesis trader id (SEAT_MODELS key). Station keys
// stay monk/demon — they're baked into the authored cases and audio slots.
export const TRADER_BY_STATION = { monk: "gr80", demon: "john-barron", marisol: "marisol", eugene: "eugene" };

// ---- The three-dial position ticket (v4) ----
// Every dial gets its own named line in the Ledger — no unscored controls.
export const MAX_STAKE = 50;
// Sizing debrief: conviction |p-0.5|/0.5 linearly justifies 0..MAX_STAKE.
// Not shown at commit (felt, not computed) — named at the Ledger.
export const justifiedStake = (p) => Math.round((Math.abs(p - 0.5) / 0.5) * MAX_STAKE);
export const SIZING_TOLERANCE = 8;
// Horizon side pot: a timing bet conditional on your rug thesis.
// Terms are public at commit (a bet's terms aren't machinery): hit +10, miss −4.
export const HORIZON = [
  { key: "none", label: "NO CALL", sub: "sit out the side pot" },
  { key: "days", label: "DAYS", sub: "unravels inside a week", test: (d) => d <= 7 },
  { key: "weeks", label: "WEEKS", sub: "unravels inside a month", test: (d) => d > 7 && d <= 30 },
  { key: "months", label: "MONTHS", sub: "unravels inside a quarter", test: (d) => d > 30 && d <= 90 },
];
export const HORIZON_HIT = 10;
export const HORIZON_MISS = -4;
// Neon Stop Loss — floors the whole ticket (stake P&L + side pot).
export const STOP_LOSS_FLOOR = -25;

export const bucket = (p) => (p < 0.4 ? "believe" : p > 0.6 ? "doubt" : "abstain");

// Patron perks (§4.1) — the partner who sponsors your run.
export const PATRONS = {
  monk: { perk: "Blessed Cold Storage", desc: "One crash shield per docket — the first bad market flip bounces off your book." },
  demon: { perk: "Devil's Leverage", desc: "Bold calls (80%+ conviction either way) pay ×1.25 — wins AND losses. He would." },
  marisol: { perk: "Standing Warrant", desc: "Your first question to Marisol each case is free — it costs no action." },
  eugene: { perk: "Déjà Vu", desc: "Once per docket, Eugene mutters where the crack lives — the case's decisive lenses." },
};

// In-character pundit leans — vague direction only; exact calls stay sealed
// until the Ledger (§4.2.3: leans are theater, anti copy-trading).
export const LEAN_LINES = {
  monk: {
    believe: "The ledger reads clean. Cautiously, mind you.",
    abstain: "I will not swear on this one. Not yet.",
    doubt: "The house of the Lord does not chase this.",
  },
  demon: {
    believe: "I've seen worse get standing ovations. I'm in.",
    abstain: "Coin flip. And I hate flipping fair coins.",
    doubt: "Even I can smell the exit from here.",
  },
  marisol: {
    believe: "The chain checks out. That's all you get.",
    abstain: "No chain data, no conviction. I need more.",
    doubt: "Follow the wallets. They're already leaving.",
  },
  eugene: {
    believe: "The pattern rhymes with the good ones.",
    abstain: "The pattern's blurry. Something's off — or nothing is.",
    doubt: "I've seen this chart before. It ended badly.",
  },
};

// Docket events (simplified MARKET_CARDS stand-ins — same odds as the sim's
// private table in caseTable.js; unify there when markets become authored
// docket events, §3.2a). `effect` is the player-facing consequence line —
// every event states what it did to the books, including "nothing".
export const EVENTS = [
  { id: "crash", p: 0.3, label: "DEAD CHAIN HOUR", text: "Liquidity evaporates.", effect: "ALL BOOKS −10 · APPLIED ABOVE", portfolioAll: -10 },
  { id: "boost", p: 0.2, label: "BULL RUN", text: "The tide lifts.", effect: "NEXT CASE PAYS ×1.25", payoutMult: 1.25 },
  { id: "calm", p: 0.5, label: "STABLECOIN WEATHER", text: "Nothing moves. The desk breathes.", effect: "NO EFFECT ON ANY BOOK" },
];

export function rollEvent(rand) {
  let roll = rand();
  for (const event of EVENTS) {
    roll -= event.p;
    if (roll <= 0) return event;
  }
  return EVENTS[EVENTS.length - 1];
}

// Each partner's signature play (round 3, ~70%) — readable tells. `mod`
// merges into the seat's belief model at finalizeCalls (botShield is
// settle-side: GR80's own cold storage).
export const BOT_SIG = {
  monk: { card: "COLD WALLET", line: "GR80 plays COLD WALLET — his book goes to cold storage.", mod: { botShield: true } },
  demon: { card: "MARKET SERMON", line: "Barron plays MARKET SERMON — he's talking himself into it.", mod: { overconf: 1.5 } },
  marisol: { card: "WALLET SÉANCE", line: "Marisol plays WALLET SÉANCE — the chain speaks to her.", mod: { lensMult: 1.9 } },
  eugene: { card: "MEMPOOL PROPHECY", line: "Eugene plays MEMPOOL PROPHECY — the pattern sharpens.", mod: { noise: 0.45 } },
};

// Per-case scratch state for the four partner seats. Passed to botRound /
// finalizeCalls, which mutate it; reset it with the rest of the
// investigation state between cases.
export function createBotState() {
  return { roundsDone: 0, scanned: {}, mods: {}, shield: {} };
}

const surname = (meta, k) => meta[k].name.split(" ").pop();

/**
 * Advance the partners one round (they move every time the player spends an
 * action; catch-up runs happen at finalizeCalls). Mutates `bt`.
 *
 * @param {object} bt   createBotState() scratch
 * @param {object} opts { seed, caseIndex, order, meta } — order is the
 *   station keys in table order, meta is CHARACTER_META-shaped
 *   ({ name, role } per station) for the desk-feed lines.
 * @returns {string[]} desk-feed log lines for this round (empty if done)
 */
export function botRound(bt, { seed, caseIndex, order, meta }) {
  if (bt.roundsDone >= BOT_ROUNDS) return [];
  const logs = [];
  const round = bt.roundsDone + 1;
  order.forEach((k, i) => {
    const rand = mulberry32(seed * 61 + caseIndex * 101 + round * 13 + i * 7);
    const scanned = (bt.scanned[k] ||= []);
    if (round === 1) {
      scanned.push(k);
      logs.push(`R${round} · ${surname(meta, k)} works ${meta[k].role}`);
    } else if (round === 2) {
      const rest = order.filter((s) => !scanned.includes(s));
      const pick = rest[Math.floor(rand() * rest.length)];
      scanned.push(pick);
      logs.push(`R${round} · ${surname(meta, k)} cross-reads ${meta[pick].role}`);
    } else if (rand() < 0.7) {
      const sig = BOT_SIG[k];
      bt.mods[k] = { ...(bt.mods[k] || {}), ...sig.mod };
      if (sig.mod.botShield) bt.shield[k] = true;
      logs.push(`R${round} · ${sig.line}`);
    } else {
      logs.push(`R${round} · ${surname(meta, k)} sits back and watches you work.`);
    }
  });
  bt.roundsDone = round;
  return logs;
}

/**
 * Close the investigation: run any bot rounds the player's pace skipped,
 * then fix each partner's exact sealed call. Mutates `bt` (catch-up).
 *
 * @returns {{ final: object, logs: string[] }} final = { stationKey:
 *   { p, scanned } } — the sealed numbers the Ledger unseals.
 */
export function finalizeCalls(bt, { seed, caseIndex, signals, order, meta }) {
  const logs = [];
  while (bt.roundsDone < BOT_ROUNDS) logs.push(...botRound(bt, { seed, caseIndex, order, meta }));
  const final = {};
  order.forEach((k, i) => {
    const { botShield, ...beliefMods } = bt.mods[k] || {};
    const model = { ...SEAT_MODELS[TRADER_BY_STATION[k]], ...beliefMods };
    const rand = mulberry32(seed * 31 + caseIndex * 101 + i * 7 + 1);
    final[k] = { p: seatBelief(signals, model, bt.scanned[k] || [k], rand), scanned: bt.scanned[k] || [k] };
  });
  return { final, logs };
}

/**
 * Settle one case for all five seats and roll the between-cases docket
 * event. Pure: returns next books/busted/briers plus the Ledger rows.
 *
 * @param {object} opts
 *   signals      — the case's caseSignals entry (truth, collapseDay)
 *   order        — station keys in table order (seats = [YOU, ...order])
 *   books/busted/briers — current docket state maps (keyed by seat)
 *   punditFinal  — finalizeCalls().final
 *   botState     — the bot scratch (GR80's settle-side shield)
 *   pHuman       — your P(scam), 0..1 (dial 1)
 *   stakeYou     — your stake (dial 2; the council benchmarks TABLE_RULES.stake)
 *   horizonIdx   — index into HORIZON (dial 3; 0 = no call)
 *   patron       — sponsoring station key (Devil's Leverage checks "demon")
 *   payoutMult   — carried multiplier from last case's event
 *   shields      — your unspent shield count (docket-event absorption)
 *   stopLossArmed— Neon Stop Loss armed this case
 *   youScanned   — station keys you actually pressed (Ledger row context)
 *   caseIndex/docketLength/seed — event roll (no event after the last case)
 * @returns {{ rows, books, busted, briers, event, payoutMult, shieldSpent }}
 *   rows       — Ledger rows in seat order ({ seat, out } for busted seats)
 *   payoutMult — multiplier for the NEXT case
 *   shieldSpent— true if your shield absorbed this event (caller decrements)
 */
export function settleCase({
  signals, order, books, busted, briers, punditFinal, botState,
  pHuman, stakeYou, horizonIdx, patron, payoutMult, shields, stopLossArmed,
  youScanned, caseIndex, docketLength, seed,
}) {
  const seats = [YOU, ...order];
  const truth = signals.truth;
  const rows = [];
  const nextBooks = { ...books };
  const nextBusted = { ...busted };
  const nextBriers = { ...briers };

  seats.forEach((k) => {
    if (busted[k]) { rows.push({ seat: k, out: true }); return; }
    const isYou = k === YOU;
    const p = isYou ? pHuman : punditFinal[k].p;
    const stake = isYou ? stakeYou : TABLE_RULES.stake; // the council benchmarks flat
    let pnl = casePnl(p, truth, stake) * payoutMult;
    let bold = false;
    if (isYou && patron === "demon" && Math.abs(p - 0.5) >= 0.3) {
      pnl *= 1.25; bold = true; // Devil's Leverage — both ways
    }

    // Dial 3 — horizon side pot (you only, opt-in): pays only if the token
    // rugs inside your window. A call on a token that holds always loses.
    let horizon = null;
    if (isYou && horizonIdx > 0) {
      const day = signals.collapseDay;
      const hit = truth === 1 && day != null && !!HORIZON[horizonIdx].test?.(day);
      const delta = hit ? HORIZON_HIT : HORIZON_MISS;
      pnl += delta;
      horizon = { idx: horizonIdx, hit, delta, day };
    }

    // Neon Stop Loss — floors the whole ticket (stake P&L + side pot).
    let stopLoss = null;
    if (isYou && stopLossArmed && pnl < STOP_LOSS_FLOOR) {
      stopLoss = { from: Math.round(pnl) };
      pnl = STOP_LOSS_FLOOR;
    }

    // Dial 2 — sizing debrief (you only): stake vs conviction-justified.
    let sizing = null;
    if (isYou) {
      const justified = justifiedStake(pHuman);
      sizing = {
        justified,
        verdict: justified === 0
          ? "centered"
          : stake > justified + SIZING_TOLERANCE
            ? "oversized"
            : stake < justified - SIZING_TOLERANCE
              ? "undersized"
              : "sized",
      };
    }

    const brier = (p - truth) ** 2;
    nextBooks[k] = Math.max(0, nextBooks[k] + pnl);
    nextBriers[k] = [...(nextBriers[k] || []), brier];
    if (nextBooks[k] <= 0) nextBusted[k] = true;
    rows.push({
      seat: k, p, pnl, brier, bold, stake, horizon, sizing, stopLoss,
      book: nextBooks[k],
      justBusted: nextBooks[k] <= 0,
      scanned: isYou ? youScanned : punditFinal[k].scanned,
    });
  });

  let event = null;
  let nextMult = 1;
  let shieldSpent = false;
  if (caseIndex < docketLength - 1) {
    event = rollEvent(mulberry32(seed * 131 + caseIndex * 17 + 5));
    if (event.portfolioAll) {
      seats.forEach((k) => {
        if (nextBusted[k]) return;
        if (event.portfolioAll < 0) {
          if (k === YOU && shields > 0) { shieldSpent = true; return; }
          if (k !== YOU && botState.shield[k]) return; // GR80's own cold storage
        }
        nextBooks[k] = Math.max(0, nextBooks[k] + event.portfolioAll);
        if (nextBooks[k] <= 0) nextBusted[k] = true;
      });
    }
    if (event.payoutMult) nextMult = event.payoutMult;
  }

  return { rows, books: nextBooks, busted: nextBusted, briers: nextBriers, event, payoutMult: nextMult, shieldSpent };
}
