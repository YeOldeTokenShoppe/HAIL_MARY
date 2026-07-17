// Case Kit — the card side of the investigation (CASE_TABLE.md §3, §3.2b).
// Pure logic, same discipline as engine.js/caseTable.js: case signals are
// passed IN. Card identities come from cards.js (the Genesis set is the
// single source of truth post-§3.2a); the scripts/ data:-URL loader must
// rewrite the ./cards import (see scripts/verify-docket-run.mjs).
//
// Owns: the First Twelve hand order (§3.2b — the art-scope, table-live
// subset of the §3.2a composition), kit legality (§3.1), and kit-effect
// resolution. Effects are resolved against caseSignals (evidence strength =
// `w`), which is what "strongest evidence" means until Tier-2 deepEntries
// exist (§3.3). LENS_BY_TAG lives in cards.js next to the tag data it maps.

import { ACTION_CARDS } from "./cards";

// THE FIRST TWELVE (§3.2b): every kit role, every rarity tier, and every
// ticket dial (read / stake / horizon) has a card that serves it. Playing a
// card IS an investigation action (§4.2). Once each per case. The id list
// fixes the hand's display order; the cards themselves live in cards.js.
const FIRST_TWELVE = [
  "audit-flare", "forked-rumor", "wallet-seance", "mempool-prophecy",
  "cold-wallet", "chart-exorcism", "oracle-crosscheck", "rug-warning",
  "candle-vigil", "neon-stop-loss", "insider-ping", "terminal-foil-moment",
];

const ACTION_BY_ID = Object.fromEntries(ACTION_CARDS.map((c) => [c.id, c]));

export const KIT_CARDS = FIRST_TWELVE.map((id) => {
  const card = ACTION_BY_ID[id];
  return { id, name: card.name, rarity: card.rarity, kind: card.kit.role, station: card.kit.lens, text: card.kit.text };
});

export const KIND_LABEL = {
  lensKey: "LENS KEY", deepScan: "DEEP SCAN", crossref: "CROSS-REF", trace: "EXIT TRACE",
  shield: "SHIELD", stoploss: "STOP LOSS", peek: "WIRETAP", wildcard: "WILDCARD",
};

// §3.1 — the whale guard, for KitSelect: a kit is up to 5 action cards, at
// most 2 rare-or-better, at most 1 foil. (Plays per case are bounded by the
// action economy itself — a card costs an action.) Not yet enforced by the
// dev mock, which deals the full First Twelve.
export const KIT_RULES = { maxCards: 5, maxRareOrBetter: 2, maxFoil: 1 };
const RARE_OR_BETTER = new Set(["rare", "terminal-foil"]);

export function isKitLegal(cards, rules = KIT_RULES) {
  return (
    cards.length <= rules.maxCards &&
    cards.filter((c) => RARE_OR_BETTER.has(c.rarity)).length <= rules.maxRareOrBetter &&
    cards.filter((c) => c.rarity === "terminal-foil").length <= rules.maxFoil
  );
}

// The `count` strongest evidence entries at a station that the player has
// not already seen. `revealed` is the { stationKey: [label] } map the
// investigation accumulates (question reveals and card reveals share it).
export function strongestUnrevealed(signals, stationKey, revealed, count) {
  const already = new Set(revealed[stationKey] || []);
  return [...signals.stations[stationKey]]
    .filter((e) => !already.has(e.label))
    .sort((a, b) => b.w - a.w)
    .slice(0, count)
    .map((e) => e.label);
}

/**
 * Resolve one kit-card play. Pure: returns what happened, the caller applies
 * it. A play that whiffs (nothing left to show) returns ok:false and must
 * NOT consume the card or an action — the table doesn't punish a dead draw.
 *
 * @param {object} card  one of KIT_CARDS
 * @param {object} ctx
 *   signals   — the case's caseSignals entry (evidence weights + collapseDay)
 *   revealed  — { stationKey: [label] } already-revealed evidence
 *   visited   — [stationKey] stations the player has opened (crossref)
 *   order     — station keys in table order (crossref sweep order)
 *   shortName — (stationKey) => display surname for log lines
 * @returns {{ ok: boolean, log: string, reveals?: object, grants?: object }}
 *   reveals — { stationKey: [label] } labels to ADD to `revealed`
 *   grants  — { shields?, bonusActions?, stopLoss?, peek? } flags/increments
 */
export function resolveKitPlay(card, { signals, revealed, visited, order, shortName }) {
  if (card.kind === "lensKey") {
    const labels = strongestUnrevealed(signals, card.station, revealed, 2);
    if (!labels.length) return { ok: false, log: `⟡ ${card.name}: ${shortName(card.station)} has nothing left to show you.` };
    return {
      ok: true,
      reveals: { [card.station]: labels },
      log: `⟡ You play ${card.name} — ${shortName(card.station)} slides you: ${labels.join(" · ")}`,
    };
  }
  if (card.kind === "crossref") {
    const targets = order.filter((k) => !visited.includes(k));
    if (!targets.length) return { ok: false, log: "⟡ Oracle Crosscheck: you've already visited every station." };
    const reveals = {};
    const got = [];
    targets.forEach((k) => {
      const [label] = strongestUnrevealed(signals, k, revealed, 1);
      if (label) { reveals[k] = [label]; got.push(`${label} (${shortName(k)})`); }
    });
    return {
      ok: true,
      reveals,
      log: `⟡ You play ${card.name} — crosscheck pulls: ${got.join(" · ") || "nothing new"}`,
    };
  }
  if (card.kind === "deepScan") {
    const labels = strongestUnrevealed(signals, card.station, revealed, 99);
    if (!labels.length) return { ok: false, log: `⟡ ${card.name}: ${shortName(card.station)} has nothing left to show you.` };
    return {
      ok: true,
      reveals: { [card.station]: labels },
      log: `⟡ You play ${card.name} — deep scan: ${shortName(card.station)} opens everything (${labels.length} more entr${labels.length === 1 ? "y" : "ies"})`,
    };
  }
  if (card.kind === "trace") {
    // Fast-exit fingerprints only: a slow rug and a legit token both read
    // "no fingerprint" — the trace informs HORIZON, never the verdict.
    const day = signals.collapseDay;
    return {
      ok: true,
      log: day != null && day <= 7
        ? "⟡ Rug Warning — FAST-EXIT FINGERPRINT FOUND. If this thing blows, it blows in DAYS."
        : "⟡ Rug Warning — no fast-exit fingerprint. If it dies, it dies slow. Or not at all.",
    };
  }
  if (card.kind === "stoploss") {
    return { ok: true, grants: { stopLoss: true }, log: "⟡ You play Neon Stop Loss — this case's ticket can't lose more than 25." };
  }
  if (card.kind === "shield") {
    return { ok: true, grants: { shields: 1 }, log: `⟡ You play ${card.name} — the next bad market flip bounces off your book.` };
  }
  if (card.kind === "peek") {
    return { ok: true, grants: { peek: true }, log: "⟡ You play Insider Ping — wiretap live. Pick a partner at pundit calls." };
  }
  if (card.kind === "wildcard") {
    return { ok: true, grants: { bonusActions: 2 }, log: "⟡ You play TERMINAL FOIL MOMENT — the desk stops. Two extra actions." };
  }
  return { ok: false, log: `⟡ ${card.name}: nothing happens.` };
}
