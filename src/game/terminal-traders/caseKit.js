// Case Kit — the card side of the investigation (CASE_TABLE.md §3, §3.2b).
// Pure and dependency-free, same discipline as engine.js/caseTable.js: case
// signals are passed IN, nothing is imported, so the scripts/ data:-URL
// loader can run it headlessly.
//
// Owns: the First Twelve card definitions (§3.2b — the art-scope subset of
// the §3.2a composition), kit legality (§3.1), and kit-effect resolution.
// Effects are resolved against caseSignals (evidence strength = `w`), which
// is what "strongest evidence" means until Tier-2 deepEntries exist (§3.3).
// LENS_BY_TAG lives in cards.js next to the tag data it maps.

// THE FIRST TWELVE (§3.2b): every kit role, every rarity tier, and every
// ticket dial (read / stake / horizon) has a card that serves it. Playing a
// card IS an investigation action (§4.2). Once each per case.
export const KIT_CARDS = [
  { id: "audit-flare", name: "Audit Flare", rarity: "common", kind: "lensKey", station: "monk", text: "GR80 slides you his 2 strongest evidence cards." },
  { id: "forked-rumor", name: "Forked Rumor", rarity: "common", kind: "lensKey", station: "demon", text: "Barron slides you his 2 strongest evidence cards." },
  { id: "wallet-seance", name: "Wallet Séance", rarity: "common", kind: "lensKey", station: "marisol", text: "Marisol slides you her 2 strongest evidence cards." },
  { id: "mempool-prophecy", name: "Mempool Prophecy", rarity: "common", kind: "lensKey", station: "eugene", text: "Eugene slides you his 2 strongest evidence cards." },
  { id: "cold-wallet", name: "Cold Wallet", rarity: "uncommon", kind: "deepScan", station: "monk", text: "Deep scan — GR80 opens the cold archive: everything he still holds." },
  { id: "chart-exorcism", name: "Chart Exorcism", rarity: "uncommon", kind: "deepScan", station: "marisol", text: "Deep scan — Marisol drags out everything the chain still hides." },
  { id: "oracle-crosscheck", name: "Oracle Crosscheck", rarity: "rare", kind: "crossref", text: "Pull the strongest evidence card from every station you haven't visited." },
  { id: "rug-warning", name: "Rug Warning", rarity: "rare", kind: "trace", text: "Sweep for a fast-exit fingerprint. Finds it only if the rug is days away." },
  { id: "candle-vigil", name: "Candle Vigil", rarity: "common", kind: "shield", text: "Shield: absorb one negative market flip this docket." },
  { id: "neon-stop-loss", name: "Neon Stop Loss", rarity: "uncommon", kind: "stoploss", text: "This case's ticket can't lose more than 25, whatever you staked." },
  { id: "insider-ping", name: "Insider Ping", rarity: "uncommon", kind: "peek", text: "At pundit calls, wiretap one partner and see their exact sealed number." },
  { id: "terminal-foil-moment", name: "Terminal Foil Moment", rarity: "terminal-foil", kind: "wildcard", text: "The desk stops — take two extra actions this case." },
];

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
