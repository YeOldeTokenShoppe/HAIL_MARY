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
// sim-case-table.mjs). docketRun.js imports ./caseTable, which data:
// modules can't resolve — the import specifier is rewritten to a data: URL
// of caseTable.js itself.
import { readFileSync } from "node:fs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
const dataUrl = (src) => "data:text/javascript;charset=utf-8," + encodeURIComponent(src);
const load = (src) => import(dataUrl(src));

const caseTableSrc = read("../src/game/terminal-traders/caseTable.js");
const { CASE_SIGNALS } = await load(read("../src/game/terminal-traders/caseSignals.js"));
const { KIT_CARDS, resolveKitPlay, isKitLegal } = await load(read("../src/game/terminal-traders/caseKit.js"));
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

if (failures) {
  console.error(`\n${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll parity checks passed.");
