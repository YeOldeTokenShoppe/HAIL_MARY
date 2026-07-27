// instanceDeal — roll a playable deal from an archetype. Pure and seeded.
//
// LAYER 1 (2026-07-26). Replaces the hand-written constant deal, whose
// `truth: 1` made the session a lookup after two plays. Same seed always
// produces the same deal, so a daily session is identical for every player
// (fair leaderboard, no reroll-fishing) while nothing is memorisable across
// days. Uses the repo's existing PRNG so replays and sims match the rest of
// the engine.

import { mulberry32 } from "../caseTable.js";
import * as BACKDOOR from "./archetypes/backdoorFork.js";
import * as MIRAGE from "./archetypes/yieldMirage.js";
import { getCardById } from "../cards.js";
import { getCardArt } from "../templateCard.js";

export const ARCHETYPES = {
  [BACKDOOR.ARCHETYPE_ID]: BACKDOOR,
  [MIRAGE.ARCHETYPE_ID]: MIRAGE,
};
export const ARCHETYPE_IDS = Object.keys(ARCHETYPES);

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const between = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));

function rollOutcome(rand, outcomes) {
  const total = outcomes.reduce((s, o) => s + o.weight, 0);
  let r = rand() * total;
  for (const o of outcomes) { r -= o.weight; if (r <= 0) return o; }
  return outcomes[outcomes.length - 1];
}

/**
 * @param {number} seed          deterministic; in production this is the UTC date
 * @param {string} archetypeId   which read this deal is an instance of
 * @returns a deal object in exactly the shape pressRun.js already consumes
 */
export function instanceDeal(seed = 1, archetypeId = null) {
  const rand = mulberry32(seed >>> 0);
  // Which READ you're facing is itself part of the shuffle. Pass an id to pin
  // one (tests/tuning); otherwise the seed picks.
  const pickedId = archetypeId || ARCHETYPE_IDS[Math.floor(rand() * ARCHETYPE_IDS.length)];
  const A = ARCHETYPES[pickedId];
  if (!A) throw new Error(`unknown archetype: ${pickedId}`);

  const rolled = rollOutcome(rand, A.OUTCOMES);
  const branch = rolled.outcome; // "rug" | "legit"
  const id = pick(rand, A.IDENTITIES);
  // Two DISTINCT prior roles — "ex-Aave, ex-Aave" reads as a bug, not a founder.
  const priorA = pick(rand, A.PRIORS);
  const priorB = pick(rand, A.PRIORS.filter((p) => p !== priorA));

  // Surface numbers. Deliberately NOT correlated with the outcome — the tape
  // and the listing stats must never leak ground truth, or the whole game
  // becomes "read the mcap". Only what the analysts can PRODUCE differs.
  const vars = {
    ...id,
    priorA,
    priorB,
    auditor: pick(rand, A.AUDITORS),
    seed: (between(rand, 8, 24) / 10).toFixed(1),   // $0.8M – $2.4M
    pump: between(rand, 18, 62),
    days: between(rand, 90, 420),          // yield-mirage: days paid without a miss
    apy: between(rand, 14, 41),            // yield-mirage: headline APY
    collapseDay: between(rand, 41, 88),
    age: `${between(rand, 22, 61)} days`,
    mcap: `$${(between(rand, 18, 92) / 10).toFixed(1)}M`,
    holders: String(between(rand, 900, 6400)),
    price: `$0.0${between(rand, 11, 89)}`,
    change24h: `+${between(rand, 2, 14)}%`,
    social: `${(between(rand, 55, 88) / 10).toFixed(1)}/10`,
  };

  const resolve = (v) => (typeof v === "function" ? v(vars) : v);

  // Play SIX of the archetype's slots. loadBearing slots are always in (a deal
  // must stay solvable cardless); the rest are a seeded pick, so which question
  // shapes are live shifts day to day and no pool card is permanently dead.
  const PLAYED = 6;
  const forced = A.SLOTS.filter((s) => s.loadBearing);
  const optional = A.SLOTS.filter((s) => !s.loadBearing);
  for (let i = optional.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [optional[i], optional[j]] = [optional[j], optional[i]];
  }
  const chosen = new Set([...forced, ...optional.slice(0, Math.max(0, PLAYED - forced.length))].map((s) => s.id));
  // Keep authored order — the pitch has a rhythm and shuffling it reads wrong.
  const played = A.SLOTS.filter((s) => chosen.has(s.id));

  const claims = played.map((slot) => {
    const b = slot[branch];
    return {
      id: slot.id,
      speaker: "demon",
      shape: slot.shape,
      // loadBearing only means anything when there IS something to find.
      loadBearing: !!slot.loadBearing,
      fact: resolve(slot.fact),
      spin: resolve(slot.spin),
      backing: b.backing,
      press: { generic: b.generic, sharp: b.sharp, miss: b.miss },
    };
  });

  return {
    id: `${pickedId}:${seed}`,
    archetype: pickedId,
    // The pattern library entry this deal is an instance of. Art + dossier are
    // shown at the autopsy — that's where the archetype gets NAMED, so the
    // player leaves with a read they can reuse rather than one token's answer.
    exemplar: (() => {
      const coin = getCardById(A.EXEMPLAR_COIN);
      return coin ? { id: coin.id, name: coin.name, ticker: coin.ticker,
        note: coin.caseRef?.note || "", art: getCardArt(coin.id) } : null;
    })(),
    ticker: vars.ticker,
    name: vars.name,
    chain: vars.chain,
    truth: rolled.truth,          // 1 = rug, 0 = legit
    outcome: branch,
    collapseDay: branch === "rug" ? vars.collapseDay : null,
    verdictLabel: branch === "rug" ? "SHORT" : "LONG",
    surface: {
      age: vars.age, mcap: vars.mcap, holders: vars.holders,
      price: vars.price, change24h: vars.change24h, social: vars.social,
    },
    claims,
    autopsy: A.AUTOPSY[branch],
    resolution: A.RESOLUTION[branch](vars),
  };
}

/** UTC date seed — the daily deal, identical for everyone. */
export function dailySeed(d = null) {
  const now = d || new Date();
  return Number(
    `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`
  );
}
