// Docket Run engine parity check. Run: node scripts/verify-docket-run.mjs
//
// Replays a scripted case-001 through the extracted engine (caseKit.js +
// docketRun.js) and asserts it reproduces the fingerprint captured from the
// /case-table-dev mock BEFORE the logic moved out of the UI (two identical
// browser runs, 2026-07-16): seed 1337, patron demon, five kit plays —
// Rug Warning, Candle Vigil, Terminal Foil Moment, Insider Ping, Neon Stop
// Loss — then pundit calls and a 90% / stake-50 / DAYS ticket. The settle
// numbers are asserted against independent arithmetic (§4.3 payout rule).
//
// Loads the REAL sources via data: modules (repo convention, see
// sim-case-table.mjs). docketRun.js imports ./caseTable and caseKit.js
// imports ./cards — data: modules can't resolve relative specifiers, so
// each import is rewritten to a data: URL of the imported source.
import { readFileSync } from "node:fs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
const dataUrl = (src) => "data:text/javascript;charset=utf-8," + encodeURIComponent(src);
const load = (src) => import(dataUrl(src));

const caseTableSrc = read("../src/game/terminal-traders/caseTable.js");
const cardsSrc = read("../src/game/terminal-traders/cards.js");
const { CASE_SIGNALS } = await load(read("../src/game/terminal-traders/caseSignals.js"));
const { KIT_CARDS, resolveKitPlay, isKitLegal, pickBasicKit } = await load(
  read("../src/game/terminal-traders/caseKit.js")
    .replace('from "./cards"', `from ${JSON.stringify(dataUrl(cardsSrc))}`)
);
const {
  createBotState, botRound, finalizeCalls, settleCase, bucket, YOU,
} = await load(
  read("../src/game/terminal-traders/docketRun.js")
    .replace('from "./caseTable"', `from ${JSON.stringify(dataUrl(caseTableSrc))}`)
);
const { casePnl } = await load(caseTableSrc);

// characterMeta.js lives in components/ (imports images etc. transitively on
// some bundlers) — the engine only needs name + role, so mirror those here.
const META = {
  monk: { name: "Saint GR80", role: "ETHOS" },
  demon: { name: "John Barron", role: "PATHOS" },
  marisol: { name: "Detective Marisol", role: "LOGOS" },
  eugene: { name: "Eugene", role: "MYTHOS" },
};
const ORDER = ["monk", "demon", "marisol", "eugene"];
const shortName = (k) => META[k].name.split(" ").pop();

let failures = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
};

// ---- the scripted case: seed 1337, case-001, patron demon ----
const seed = 1337;
const caseIndex = 0;
const signals = CASE_SIGNALS["case-001"];
const bt = createBotState();

const card = (id) => KIT_CARDS.find((c) => c.id === id);
const ctx = { signals, revealed: {}, visited: [], order: ORDER, shortName };

const plays = ["rug-warning", "candle-vigil", "terminal-foil-moment", "insider-ping", "neon-stop-loss"]
  .map((id) => {
    const play = resolveKitPlay(card(id), ctx);
    botRound(bt, { seed, caseIndex, order: ORDER, meta: META });
    return play;
  });

check("all five plays resolve", plays.map((p) => p.ok), [true, true, true, true, true]);
check("Rug Warning finds the day-6 fast exit", plays[0].log.includes("FAST-EXIT FINGERPRINT FOUND"), true);
check("Candle Vigil grants a shield", plays[1].grants, { shields: 1 });
check("Terminal Foil grants +2 actions", plays[2].grants, { bonusActions: 2 });
check("Insider Ping arms the wiretap", plays[3].grants, { peek: true });
check("Neon Stop Loss arms the floor", plays[4].grants, { stopLoss: true });

const { final } = finalizeCalls(bt, { seed, caseIndex, signals, order: ORDER, meta: META });

// Browser-captured fingerprint (identical across two independent runs).
check("GR80 read ETHOS + MYTHOS", bt.scanned.monk, ["monk", "eugene"]);
check("Barron read PATHOS + MYTHOS", bt.scanned.demon, ["demon", "eugene"]);
check("Marisol read LOGOS + ETHOS", bt.scanned.marisol, ["marisol", "monk"]);
check("Eugene read MYTHOS + LOGOS", bt.scanned.eugene, ["eugene", "marisol"]);
check("all four played their signature cards", ORDER.map((k) => !!bt.mods[k]), [true, true, true, true]);
check("GR80's cold-wallet shield is up", bt.shield.monk, true);
check("leans doubt/believe/doubt/believe", ORDER.map((k) => bucket(final[k].p)), ["doubt", "believe", "doubt", "believe"]);
check("wiretap unseals GR80 at 85%", Math.round(final.monk.p * 100), 85);

// ---- settle: p=0.90, stake 50, horizon DAYS, patron demon ----
const result = settleCase({
  signals, order: ORDER, books: { you: 100, monk: 100, demon: 100, marisol: 100, eugene: 100 },
  busted: {}, briers: {}, punditFinal: final, botState: bt,
  pHuman: 0.9, stakeYou: 50, horizonIdx: 1, patron: "demon",
  payoutMult: 1, shields: 1, stopLossArmed: true,
  youScanned: [], caseIndex, docketLength: 3, seed,
});
const you = result.rows.find((r) => r.seat === YOU);

// Independent arithmetic: casePnl(0.9, rug, 50) = 50·(1−4·0.01) = 48,
// ×1.25 Devil's Leverage = 60, +10 horizon hit (day 6 ≤ 7) = 70.
check("your ticket settles at +70", Math.round(you.pnl), 70);
check("Devil's Leverage marked bold", you.bold, true);
check("horizon DAYS hits on day 6", { hit: you.horizon.hit, day: you.horizon.day, delta: you.horizon.delta }, { hit: true, day: 6, delta: 10 });
check("stop loss stays out of a winning ticket", you.stopLoss, null);
check("sizing debrief: 90% justifies 40, staked 50 → oversized", you.sizing, { justified: 40, verdict: "oversized" });
check("your book lands on 170", Math.round(you.book), 170);
check("your Brier is 0.01", +you.brier.toFixed(4), 0.01);

// Council settles at the flat benchmark stake through the same payout kernel.
for (const k of ORDER) {
  const row = result.rows.find((r) => r.seat === k);
  check(`${shortName(k)}'s book = 100 + casePnl(p, rug, 25)`,
    +row.book.toFixed(6), +(100 + casePnl(final[k].p, 1, 25)).toFixed(6));
}

// The docket event is seeded off (seed, caseIndex) — pinned so refactors
// that disturb the RNG call sites fail loudly.
check("event after case 1 is STABLECOIN WEATHER", { id: result.event.id, shieldSpent: result.shieldSpent }, { id: "calm", shieldSpent: false });
check("kit legality: the First Twelve is not a legal kit (12 > 5)", isKitLegal(KIT_CARDS), false);
check("kit legality: 4 commons + 1 rare is legal", isKitLegal(["audit-flare", "forked-rumor", "wallet-seance", "mempool-prophecy", "oracle-crosscheck"].map(card)), true);

// ---- Tier-2 effects (Phase 2, §3.2/§3.3) — synthetic fixture so these pins
// don't churn when the real 001-003 deep content is tuned. Fresh ctx per
// check: resolveKitPlay is pure but the ctx objects are shared references.
const FIX_SIGNALS = {
  truth: 1,
  collapseDay: 5,
  stations: {
    monk: [
      { label: "M1", dir: "scam", w: 3 },
      { label: "M2", dir: "scam", w: 2 },
      { label: "M3", dir: "legit", w: 1 },
    ],
    demon: [{ label: "D1", dir: "legit", w: 2 }],
    marisol: [{ label: "L1", dir: "scam", w: 2 }],
    eugene: [{ label: "E1", dir: "legit", w: 1 }],
  },
};
const FIX_CASE = {
  stations: {
    monk: {
      entries: [{ label: "M1" }, { label: "M2" }, { label: "M3" }],
      deepEntries: [
        { label: "M-DEEP-1", value: "", threat: "red" },
        { label: "M-DEEP-2", value: "", threat: "amber" },
      ],
      lockedQuestion: { q: "Sealed?", a: { text: "Unsealed.", audio: null }, reveals: "M-DEEP-1" },
    },
    marisol: { entries: [{ label: "L1" }], deepEntries: [] },
  },
  connections: [
    { lenses: ["marisol", "monk"], entry: { label: "X-LINK", value: "", threat: "red" } },
  ],
};
const fixCtx = (over = {}) => ({
  signals: FIX_SIGNALS, caseData: FIX_CASE, revealed: {}, unlocked: {},
  visited: [], order: ORDER, shortName, ...over,
});

const lensPlay = resolveKitPlay(card("audit-flare"), fixCtx());
check("lensKey slides the 2 strongest Tier-1, never deep labels",
  lensPlay.reveals, { monk: ["M1", "M2"] });
check("lensKey returns no deepReveals", lensPlay.deepReveals, undefined);

const deepPlay = resolveKitPlay(card("cold-wallet"), fixCtx());
check("deepScan opens remaining Tier-1", deepPlay.reveals, { monk: ["M1", "M2", "M3"] });
check("deepScan opens the CLASSIFIED entries", deepPlay.deepReveals, { monk: ["M-DEEP-1", "M-DEEP-2"] });
check("deepScan unseals the locked question", deepPlay.unlocks, { monk: true });
check("deepScan log counts entries · CLASSIFIED · sealed",
  deepPlay.log.includes("3 entries · 2 CLASSIFIED · a sealed question unlocks"), true);

const deepWhiff = resolveKitPlay(card("cold-wallet"), fixCtx({
  revealed: { monk: ["M1", "M2", "M3", "M-DEEP-1", "M-DEEP-2"] },
  unlocked: { monk: true },
}));
check("deepScan whiffs when the station is fully open", deepWhiff.ok, false);

const connPlay = resolveKitPlay(card("oracle-crosscheck"), fixCtx({ visited: ["marisol", "monk"] }));
check("crossref with both lenses visited reveals the connection at BOTH stations",
  connPlay.reveals, { marisol: ["X-LINK"], monk: ["X-LINK"] });
check("crossref reports connection metadata",
  connPlay.connection, { label: "X-LINK", lenses: ["marisol", "monk"] });

const sweepPlay = resolveKitPlay(card("oracle-crosscheck"), fixCtx({ visited: ["marisol"] }));
check("crossref before both lenses visited falls back to the sweep",
  { ok: sweepPlay.ok, connection: sweepPlay.connection, monk: sweepPlay.reveals?.monk },
  { ok: true, connection: undefined, monk: ["M1"] });

check("KIT_CARDS crossrefs carry their lens pair",
  card("oracle-crosscheck").lenses, ["marisol", "monk"]);

const basic = pickBasicKit();
check("pickBasicKit: legal — deep scan leads, lenses covered, insurance",
  { legal: isKitLegal(basic), ids: basic.map((c) => c.id) },
  { legal: true, ids: ["cold-wallet", "forked-rumor", "wallet-seance", "mempool-prophecy", "candle-vigil"] });

// ---- Case-file integrity (the repo's stand-in for a content test runner):
// reveals resolve, Tier-2 labels never collide with Tier-1, locked questions
// resolve, connections use printed crossref pairs, signals match entries.
// Tolerates empty deepEntries so this passes between the schema-slot commit
// and the authoring commit.
const CROSSREF_PAIRS = KIT_CARDS.filter((c) => c.kind === "crossref").map((c) => c.lenses)
  .concat([["marisol", "eugene"], ["monk", "demon"], ["demon", "eugene"]]); // full printed set (§3.2a)
const samePair = (a, b) => a.length === 2 && b.length === 2 && a.every((k) => b.includes(k));

for (const caseId of ["case-001", "case-002", "case-003"]) {
  const caseFile = (await load(read(`../src/components/game/cases/${caseId}.js`))).default;
  const problems = [];
  for (const [key, st] of Object.entries(caseFile.stations)) {
    const tier1 = new Set(st.entries.map((e) => e.label));
    const deep = new Set((st.deepEntries || []).map((e) => e.label));
    for (const q of st.questions) {
      if (!tier1.has(q.reveals)) problems.push(`${key} question reveals unknown label "${q.reveals}"`);
    }
    for (const label of deep) {
      if (tier1.has(label)) problems.push(`${key} deep label "${label}" collides with Tier-1`);
    }
    if (st.lockedQuestion && !tier1.has(st.lockedQuestion.reveals) && !deep.has(st.lockedQuestion.reveals)) {
      problems.push(`${key} lockedQuestion reveals unknown label "${st.lockedQuestion.reveals}"`);
    }
    for (const sig of CASE_SIGNALS[caseId].stations[key]) {
      if (!tier1.has(sig.label)) problems.push(`${key} signal "${sig.label}" has no Tier-1 entry`);
    }
  }
  for (const conn of caseFile.connections || []) {
    if (!CROSSREF_PAIRS.some((p) => samePair(p, conn.lenses))) {
      problems.push(`connection pair [${conn.lenses}] matches no printed crossref`);
    }
    for (const k of conn.lenses) {
      const st = caseFile.stations[k];
      if (st.entries.some((e) => e.label === conn.entry.label) ||
          (st.deepEntries || []).some((e) => e.label === conn.entry.label)) {
        problems.push(`connection label "${conn.entry.label}" collides at ${k}`);
      }
    }
  }
  check(`${caseId} content integrity`, problems, []);
}

if (failures) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll parity checks passed.");
