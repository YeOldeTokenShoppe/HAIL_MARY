// Headless verification for THE PRESS controller.
// Run: node scripts/verify-press-run.mjs
//
// Mirrors the discipline of scripts/verify-docket-run.mjs — the run logic is
// pure, so it is pinned here before any pixel is drawn.

import MRDN from "../src/game/terminal-traders/press/deals/mrdn.js";
import { ANY, BACKING, SHAPES } from "../src/game/terminal-traders/press/questions.js";
import {
  PRESSES, STAKE, PHASE,
  createRun, press, advance, callIt, allocate, toAutopsy,
  resolvePress, sliderToP, callReadout, readScore, currentClaim,
} from "../src/game/terminal-traders/press/pressRun.js";
import { HAND } from "../src/game/terminal-traders/press/hand.js";
import { casePnl } from "../src/game/terminal-traders/caseTable.js";

// Convenience: play a card at whatever claim is currently on the floor.
const doPressCard = (run, card) => press(run, MRDN, card.shape, card.id);

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`); }
};
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

console.log("\n── content lint ─────────────────────────────────────────────");
{
  const c = MRDN.claims;
  ok("six claims", c.length === 6, `got ${c.length}`);
  const counts = c.reduce((m, x) => ({ ...m, [x.backing]: (m[x.backing] || 0) + 1 }), {});
  ok("backing spread is 2 HARD / 1 SOFT / 3 VIBES",
    counts.HARD === 2 && counts.SOFT === 1 && counts.VIBES === 3, JSON.stringify(counts));
  ok("every claim has a shape", c.every((x) => Object.values(SHAPES).includes(x.shape)));
  // A5: decisive evidence must be reachable on a free press.
  ok("A5 — no loadBearing claim is weaker than HARD",
    c.every((x) => !x.loadBearing || x.backing === BACKING.HARD));
  ok("at least one loadBearing claim exists", c.some((x) => x.loadBearing));
  ok("every claim has a generic press response", c.every((x) => x.press?.generic?.line));
  // The verdict must be reachable with zero cards.
  const freeReachable = c.filter((x) => x.backing === BACKING.HARD && x.loadBearing);
  ok("guardrail 1 — verdict reachable on generic presses alone", freeReachable.length >= 1);
}

console.log("\n── press resolution ─────────────────────────────────────────");
{
  const team = MRDN.claims.find((c) => c.id === "team");
  const chart = MRDN.claims.find((c) => c.id === "chart");
  const audit = MRDN.claims.find((c) => c.id === "audit");

  const rTeam = resolvePress(team, ANY);
  ok("HARD press stamps a receipt", !!rTeam.receipt);
  ok("HARD receipt names the ops partner",
    JSON.stringify(rTeam.receipt).includes("Ops partner"));

  const rChart = resolvePress(chart, ANY);
  ok("VIBES press leaves the monitor black", rChart.receipt === null);
  ok("VIBES press still returns a spoken line", !!rChart.line);

  const rAudit = resolvePress(audit, ANY);
  ok("SOFT press returns a partial receipt", rAudit.receipt?.partial === true);

  // Slice 3+ behaviour, authored but unreachable today.
  const rSharpMiss = resolvePress(chart, SHAPES.POSITIONED);
  ok("wrong-shape press is marked wasted", rSharpMiss.wasted === true);
  const rSharpHit = resolvePress(chart, SHAPES.SELECTIVE_WINDOW);
  ok("right-shape press on VIBES names it but stays black",
    rSharpHit.named === SHAPES.SELECTIVE_WINDOW && rSharpHit.receipt === null);
}

console.log("\n── press budget is frozen ───────────────────────────────────");
{
  let run = createRun(MRDN);
  ok("starts with exactly 3", run.pressesLeft === PRESSES && PRESSES === 3);
  let spent = 0;
  for (let i = 0; i < MRDN.claims.length; i++) {
    const before = run.pressesLeft;
    run = press(run, MRDN, ANY);
    if (run.pressesLeft < before) spent++;
    run = advance(run, MRDN);
  }
  ok("cannot spend more than 3 across six claims", spent === 3, `spent ${spent}`);
  ok("budget floors at 0, never negative", run.pressesLeft === 0);
  ok("run reached the allocation phase", run.phase === PHASE.ALLOCATION);
  ok("all six claims landed as chips", run.chips.length === 6, `got ${run.chips.length}`);
}

console.log("\n── double-press and off-phase are no-ops ────────────────────");
{
  let run = createRun(MRDN);
  run = press(run, MRDN, ANY);
  const after = run.pressesLeft;
  run = press(run, MRDN, ANY); // same claim again
  ok("second press on the same claim is a no-op", run.pressesLeft === after);
  run = callIt(run, MRDN);
  const budget = run.pressesLeft;
  run = press(run, MRDN, ANY); // off the floor
  ok("pressing after the call is a no-op", run.pressesLeft === budget);
  ok("unspent presses are kept, not refunded into anything", budget === 2);
}

console.log("\n── the hand: cards are questions ────────────────────────────");
{
  // Every card must have a live target in this deal, or it's a dead draw the
  // player can only ever waste — which is a content bug, not a hard choice.
  const shapes = new Set(MRDN.claims.map((c) => c.shape));
  ok("every card in the hand can hit something in this deal",
    HAND.every((c) => shapes.has(c.shape)),
    HAND.filter((c) => !shapes.has(c.shape)).map((c) => c.name).join(", "));
  ok("no two cards ask the same question", new Set(HAND.map((c) => c.shape)).size === HAND.length);
  ok("every card carries its question as player-facing text",
    HAND.every((c) => typeof c.question === "string" && c.question.length > 4));
  ok("the hand reads no collection/ownership field",
    HAND.every((c) => !("owned" in c) && !("rarity" in c) && !("count" in c)));

  // Every claim must answer all three ways, or a card play falls back to the
  // generic line and the beat silently degrades.
  ok("all six claims author a sharp response", MRDN.claims.every((c) => c.press?.sharp?.line));
  ok("all six claims author a miss response", MRDN.claims.every((c) => c.press?.miss?.line));

  // THE ESCALATION — the only press in the deal that moves your call.
  const audit = MRDN.claims.find((c) => c.id === "audit");
  const esc = resolvePress(audit, SHAPES.BORROWED_CREDIBILITY);
  ok("matched card on a SOFT claim escalates to a full receipt",
    !!esc.receipt && esc.receipt.partial !== true && esc.receipt.rows.length > 3);
  ok("the escalation is what exposes the upgrade path",
    JSON.stringify(esc.receipt).includes("NOT REVIEWED"));

  // A sharp question can never manufacture a fact.
  const ops = MRDN.claims.find((c) => c.id === "ops");
  const named = resolvePress(ops, SHAPES.SURVIVORSHIP);
  ok("matched card on a VIBES claim still leaves the board black", named.receipt === null);
  ok("...but classifies the hollowness", named.named === SHAPES.SURVIVORSHIP);
  ok("...and its line differs from the generic one",
    named.line !== resolvePress(ops, ANY).line);

  // The confident denial — the beat slice 2 exists to test.
  const miss = resolvePress(ops, SHAPES.BORROWED_CREDIBILITY);
  ok("wrong card gets a real, confident, useless answer", miss.wasted === true && !!miss.line);
  ok("a wasted press never reveals the shape", miss.named === null);
}

console.log("\n── card economy: no free lunches ────────────────────────────");
{
  let run = createRun(MRDN);
  const card = HAND[0];
  run = doPressCard(run, card);
  ok("playing a card costs a press, same as the generic move", run.pressesLeft === PRESSES - 1);
  ok("the card is marked spent", run.cardsSpent.includes(card.id));

  // Replaying a spent card must be impossible even on a fresh claim.
  run = advance(run, MRDN);
  const before = run.pressesLeft;
  run = doPressCard(run, card);
  ok("a spent card cannot be replayed", run.pressesLeft === before && run.cardsSpent.length === 1);

  // NO REFUND ON A MISS. This is the rule that keeps cards an edge you can
  // misuse rather than a strictly-better button.
  let r2 = createRun(MRDN); // claim 0 = team (UNSOURCED); play the scope card = miss
  const scope = HAND.find((c) => c.shape === SHAPES.BORROWED_CREDIBILITY);
  r2 = press(r2, MRDN, scope.shape, scope.id);
  ok("a MISSED card is still consumed", r2.cardsSpent.includes(scope.id));
  ok("a MISSED card still costs the press", r2.pressesLeft === PRESSES - 1);
  ok("the miss is recorded as wasted", r2.outcomes.team.wasted === true);

  // Cards must never widen the information firehose.
  let r3 = createRun(MRDN);
  let spent = 0;
  for (let i = 0; i < MRDN.claims.length; i++) {
    const c = HAND[i % HAND.length];
    const b = r3.pressesLeft;
    r3 = press(r3, MRDN, c.shape, c.id);
    if (r3.pressesLeft < b) spent++;
    r3 = advance(r3, MRDN);
  }
  ok("a full hand still cannot exceed 3 presses", spent === 3, `spent ${spent}`);
}

console.log("\n── the call ─────────────────────────────────────────────────");
{
  ok("slider -100 -> p=1 (hardest SHORT)", near(sliderToP(-100), 1));
  ok("slider +100 -> p=0 (hardest LONG)", near(sliderToP(100), 0));
  ok("slider 0 -> p=0.5 (FLAT)", near(sliderToP(0), 0.5));

  // MRDN.truth === 1 (it IS a rug), so a full SHORT is the perfect call.
  let run = allocate(callIt(createRun(MRDN), MRDN), MRDN, -100);
  ok("perfect SHORT on a rug pays +STAKE", near(run.call.pnl, STAKE), `${run.call.pnl}`);
  ok("book moves by exactly the P&L", near(run.book, 100 + STAKE));
  ok("direction reads SHORT", run.call.direction === "SHORT");

  run = allocate(callIt(createRun(MRDN), MRDN), MRDN, 100);
  ok("full LONG on a rug loses 3x STAKE", near(run.call.pnl, -3 * STAKE), `${run.call.pnl}`);

  run = allocate(callIt(createRun(MRDN), MRDN), MRDN, 0);
  ok("FLAT settles at exactly zero", near(run.call.pnl, 0));

  ok("settlement matches casePnl by hand",
    near(allocate(callIt(createRun(MRDN), MRDN), MRDN, -60).call.pnl,
      casePnl(sliderToP(-60), 1, STAKE)));
}

console.log("\n── PROPERNESS (the design theorem) ──────────────────────────");
{
  // For any true belief q, the slider position that maximises expected P&L
  // must be the HONEST one. If this fails, the game rewards lying to itself.
  let worst = 0;
  for (let qi = 0; qi <= 20; qi++) {
    const q = qi / 20;
    let bestV = null, bestE = -Infinity;
    for (let v = -100; v <= 100; v++) {
      const p = sliderToP(v);
      const E = q * casePnl(p, 1, STAKE) + (1 - q) * casePnl(p, 0, STAKE);
      if (E > bestE) { bestE = E; bestV = v; }
    }
    const honestV = Math.round((1 - 2 * q) * 100);
    worst = Math.max(worst, Math.abs(bestV - honestV));
  }
  ok("honest reporting maximises expected P&L at every belief", worst === 0,
    `max deviation ${worst} slider points`);

  // Guard against the coupled-stake form the plan originally specified.
  // stake = S|u| makes the optimum 4/3 too extreme — proving the correction.
  let coupledWorst = 0;
  for (let qi = 1; qi < 20; qi++) {
    const q = qi / 20;
    let bestV = null, bestE = -Infinity;
    for (let v = -100; v <= 100; v++) {
      const p = sliderToP(v), s = STAKE * Math.abs(v) / 100;
      const E = q * casePnl(p, 1, s) + (1 - q) * casePnl(p, 0, s);
      if (E > bestE) { bestE = E; bestV = v; }
    }
    coupledWorst = Math.max(coupledWorst, Math.abs(bestV - Math.round((1 - 2 * q) * 100)));
  }
  ok("(control) the rejected coupled-stake form IS improper", coupledWorst > 5,
    `deviation ${coupledWorst} — confirms why fixed stake was chosen`);
}

console.log("\n── readouts ─────────────────────────────────────────────────");
{
  const r = callReadout(-80);
  ok("readout names the direction in plain language", /rug/.test(r.saying), r.saying);
  ok("readout states the downside up front", /lose/.test(r.risk), r.risk);
  ok("no finance jargon in the readout",
    !/brier|calibration|expected value|ev\b/i.test(r.saying + r.risk));
  ok("FLAT readout is honest about paying nothing", /nothing/.test(callReadout(0).risk));

  let run = createRun(MRDN);
  run = press(run, MRDN, ANY);            // team  — HARD
  run = advance(run, MRDN);
  run = advance(run, MRDN);               // skip audit
  run = advance(run, MRDN);               // skip funding
  run = press(run, MRDN, ANY);            // chart — VIBES
  const rs = readScore(run, MRDN);
  ok("READ counts presses that found give", rs.hit === 1 && rs.spent === 2, JSON.stringify(rs));
}

console.log("\n── full scripted session ────────────────────────────────────");
{
  let run = createRun(MRDN);
  // The intended slice-1 path: press the strongest claim, learn about the ops
  // partner, then press the ops claim and watch the monitor stay black.
  run = press(run, MRDN, ANY); run = advance(run, MRDN);   // team -> receipt
  run = advance(run, MRDN);                                 // audit, untouched
  run = advance(run, MRDN);                                 // funding
  run = advance(run, MRDN);                                 // chart
  run = advance(run, MRDN);                                 // timelock
  run = press(run, MRDN, ANY);                              // ops -> black
  run = advance(run, MRDN);                                 // -> allocation
  ok("reached allocation with 1 press unspent", run.pressesLeft === 1, `${run.pressesLeft}`);
  ok("team receipt is on the board", !!run.outcomes.team.receipt);
  ok("ops monitor stayed black", run.outcomes.ops.receipt === null);

  run = allocate(run, MRDN, -70);
  ok("a well-informed SHORT is profitable", run.call.pnl > 0, `${run.call.pnl.toFixed(1)}`);
  run = toAutopsy(run);
  ok("session finishes in autopsy", run.phase === PHASE.AUTOPSY && run.finished);
  ok("autopsy copy exists for every claim",
    MRDN.claims.every((c) => typeof MRDN.autopsy[c.id] === "string"));
}

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
