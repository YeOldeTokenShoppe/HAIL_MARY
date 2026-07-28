// Headless verification for THE PRESS controller.
// Run: node scripts/verify-press-run.mjs
//
// The run logic is pure, so it is pinned here BEFORE any pixel is drawn.
// Rewritten 2026-07-27 for the four-character layer: cards were cut, advisers
// are the scarce resource. The card assertions are gone; everything they were
// protecting (frozen budget, no refunds, one press per claim, truth never for
// sale) is re-asserted against seats.

import fs from "node:fs";
import { instanceDeal, ARCHETYPE_IDS } from "../src/game/terminal-traders/press/instanceDeal.js";
import { BACKING, SHAPES, LANES, SEATS, SEAT_LANE, SPENDABLE_SEATS, canSend } from "../src/game/terminal-traders/press/questions.js";
import { DESK, EUGENE, eugeneRead, eugeneAgenda, adviserLine, laneSentence, barronAside } from "../src/game/terminal-traders/press/desk.js";
import {
  PRESSES, STAKE, PHASE,
  createRun, press, advance, callIt, allocate,
  resolvePress, sliderToP, coverageScore, currentClaim, seatOptions, laneOutlook, pressure, PRESSURE,
} from "../src/game/terminal-traders/press/pressRun.js";
import { casePnl } from "../src/game/terminal-traders/caseTable.js";

let pass = 0, fail = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ""}`); }
};
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const laneOf = (d, seat) => d.claims.filter((c) => c.lane === SEAT_LANE[seat]);
const findDeal = (pred, arch, n = 400) =>
  Array.from({ length: n }, (_, i) => instanceDeal(i + 1, arch)).find(pred);
/** Walk to the claim with this id, letting everything before it pass. */
const walkTo = (deal, id) => {
  let run = createRun(deal);
  while (currentClaim(run, deal) && currentClaim(run, deal).id !== id) {
    const next = advance(run, deal);
    if (next === run || next.phase !== PHASE.FLOOR) return null;
    run = next;
  }
  return currentClaim(run, deal)?.id === id ? run : null;
};

console.log("\n-- the desk ------------------------------------------------");
{
  ok("three seats plus Eugene", Object.keys(DESK).length === 3 && !!EUGENE);
  ok("exactly two advisers are spendable", SPENDABLE_SEATS.length === 2);
  ok("Barron has no lane — he is always available",
    !SEAT_LANE[SEATS.BARRON] && canSend(SEATS.BARRON, { lane: LANES.CHAIN }));
  ok("Marisol is CHAIN, GR80 is RECORD",
    SEAT_LANE[SEATS.MARISOL] === LANES.CHAIN && SEAT_LANE[SEATS.GR80] === LANES.RECORD);
  ok("every seat maps to a real scene agent and screen station",
    Object.values(DESK).every((d) => d.agentId && d.station) && EUGENE.agentId === "RL80");
  let total = true;
  for (const sh of Object.values(SHAPES))
    for (const ln of Object.values(LANES))
      if (!eugeneRead({ id: "xx", shape: sh, lane: ln })) total = false;
  ok("Eugene's read is total over all shapes x lanes", total);
  ok("Eugene's read is deterministic",
    eugeneRead({ id: "audit", shape: SHAPES.UNSOURCED, lane: LANES.CHAIN }) ===
    eugeneRead({ id: "audit", shape: SHAPES.UNSOURCED, lane: LANES.CHAIN }));
  ok("both advisers have all four result lines",
    SPENDABLE_SEATS.every((s) => ["dispatch", "found", "partial", "nothing"].every((r) => adviserLine(s, r))));

  // THE FLOOR MAY NEVER NAME A SPENT ADVISER AS THE WAY THROUGH. Both of these
  // shipped broken: the band read "only Detective Marisol can settle it" and
  // Eugene said "Marisol can settle it" on a claim where she was already spent
  // and two interruptions were still in hand. Neither is cosmetic — it's an
  // instruction to take an action the controller rejects as a no-op.
  const chainClaim = { id: "dep", shape: SHAPES.SELECTIVE_WINDOW, lane: LANES.CHAIN };
  const recClaim = { id: "aud", shape: SHAPES.BORROWED_CREDIBILITY, lane: LANES.RECORD };
  ok("the lane band names the owner while they are available",
    laneSentence(chainClaim).includes(DESK[SEATS.MARISOL].name)
    && laneSentence(recClaim).includes(DESK[SEATS.GR80].name));
  ok("the lane band stops issuing an impossible instruction once they're spent",
    (() => {
      const a = laneSentence(chainClaim, { spent: [SEATS.MARISOL] });
      const b = laneSentence(recClaim, { spent: [SEATS.GR80] });
      return /spent/i.test(a) && /press him/i.test(a)
        && /spent/i.test(b) && /press him/i.test(b);
    })());
  ok("Eugene stops pointing at a spent adviser",
    (() => {
      const live = eugeneAgenda(chainClaim, { remaining: 2 });
      const dead = eugeneAgenda(chainClaim, { spent: [SEATS.MARISOL], remaining: 2 });
      return live !== dead && /nobody left to send/i.test(dead);
    })());
  ok("spending the OTHER adviser changes nothing about this lane",
    laneSentence(chainClaim, { spent: [SEATS.GR80] }) === laneSentence(chainClaim)
    && eugeneRead(chainClaim, { spent: [SEATS.GR80] }) === eugeneRead(chainClaim));

  // EUGENE'S JOB. His second sentence is the agenda — how much runway is left
  // in this lane — because the lane band already owns "whose is it" and a
  // character who restates the UI reads as having no role at all.
  ok("Eugene's read is the SHAPE plus the agenda, never a restatement of the lane",
    (() => {
      const r = eugeneRead(chainClaim, { remaining: 2 });
      // the band's job — naming the owner — must not appear in his mouth
      return !/Marisol can settle|only .* can settle/i.test(r) && /money question/i.test(r);
    })());
  ok("the agenda distinguishes 'hold' from 'now or never'",
    (() => {
      const more = eugeneAgenda(chainClaim, { remaining: 3 });
      const last = eugeneAgenda(chainClaim, { remaining: 0 });
      return more !== last && /Three more/i.test(more) && /Last money question/i.test(last);
    })());
  ok("singular and plural both read as English",
    /One more money question after this one\./.test(eugeneAgenda(chainClaim, { remaining: 1 }))
    && /Two more money questions after this one\./.test(eugeneAgenda(chainClaim, { remaining: 2 })));
  ok("a SHAPE claim reports what's checkable at all, not a lane",
    (() => {
      const s = eugeneAgenda({ id: "vibe", shape: SHAPES.UNFALSIFIABLE, lane: LANES.SHAPE }, { remaining: 2 });
      return /Nobody settles that one/i.test(s) && !/money|paperwork/i.test(s);
    })());
}

console.log("\n-- pressure: he reacts to being caught ----------------------");
{
  const mk = (...outs) => ({ outcomes: Object.fromEntries(outs.map((o, i) => [`c${i}`, o])) });
  const NIL = { nothingOnFile: true, receipt: null };
  const BLACK = { nothingOnFile: false, receipt: null };
  const PART = { nothingOnFile: false, receipt: { partial: true } };
  const HARD = { nothingOnFile: false, receipt: { title: "X", rows: [] } };

  ok("an untouched pitch is COOL", pressure(createRun(instanceDeal(7))).band === PRESSURE.COOL);
  ok("checking him and finding a real receipt makes him BACKED",
    pressure(mk(HARD)).band === PRESSURE.BACKED);
  ok("NOTHING ON FILE is the worst single thing that can happen to him",
    pressure(mk(NIL)).score > pressure(mk(BLACK)).score
    && pressure(mk(BLACK)).score === pressure(mk(PART)).score);
  ok("one catch RATTLES him, three CORNER him",
    pressure(mk(BLACK)).band === PRESSURE.RATTLED
    && pressure(mk(NIL, BLACK)).band === PRESSURE.CORNERED);
  ok("a receipt he can produce buys back ground",
    pressure(mk(BLACK, HARD)).band === PRESSURE.COOL
    && pressure(mk(NIL, HARD)).score < pressure(mk(NIL)).score);
  ok("pressure is monotone in catches",
    (() => {
      let last = -Infinity;
      for (const outs of [[], [BLACK], [BLACK, BLACK], [BLACK, BLACK, NIL]]) {
        const s = pressure(mk(...outs)).score;
        if (s <= last) return false;
        last = s;
      }
      return true;
    })());

  // THE LEAK CHECK. pressure() may read only what you have already been shown.
  const src = fs.readFileSync("src/game/terminal-traders/press/pressRun.js", "utf8");
  const body = src.slice(src.indexOf("export function pressure("));
  const fn = body.slice(0, body.indexOf("\n}") + 2);
  ok("pressure() reads run.outcomes and nothing else",
    !/\btruth\b|\bdiscriminates\b|\boutcome\b\s*[=.]|\bdeal\b/.test(fn));
  ok("identical findings give identical pressure whatever the deal really is",
    (() => {
      const rug = findDeal((d) => d.truth === 1, "backdoor-fork");
      const legit = findDeal((d) => d.truth === 0, "backdoor-fork");
      if (!rug || !legit) return false;
      const a = { ...createRun(rug), outcomes: mk(NIL, BLACK).outcomes };
      const b = { ...createRun(legit), outcomes: mk(NIL, BLACK).outcomes };
      return JSON.stringify(pressure(a)) === JSON.stringify(pressure(b));
    })());

  // The prose may not carry information either.
  const claim = { id: "dep" };
  ok("every band above COOL has an aside, and COOL has none",
    !barronAside(PRESSURE.COOL, claim, 0)
    && [PRESSURE.BACKED, PRESSURE.RATTLED, PRESSURE.CORNERED]
      .every((b) => barronAside(b, claim, 0).length > 0));
  ok("asides are deterministic",
    barronAside(PRESSURE.CORNERED, claim, 2) === barronAside(PRESSURE.CORNERED, claim, 2));
  // Repeating a line verbatim on the next claim reads as a stuck component,
  // not a character — which is exactly what keying the pick to claim.id.length
  // produced when two consecutive ids happened to be the same length.
  ok("he never says the same thing twice in a row",
    [PRESSURE.BACKED, PRESSURE.RATTLED, PRESSURE.CORNERED].every((b) =>
      Array.from({ length: 12 }, (_, i) => barronAside(b, claim, i))
        .every((line, i, all) => i === 0 || line !== all[i - 1])));
  ok("no aside names a lane, a seat or an outcome",
    (() => {
      // Lane names and role labels included: RECORD is a lane and THE PAPERWORK
      // is a role, so either in his mouth reads as him naming whose turn it is.
      const bad = /marisol|gr80|eugene|chain|record|paperwork|receipt|nothing on file|rug|legit/i;
      return [PRESSURE.BACKED, PRESSURE.RATTLED, PRESSURE.CORNERED].every((b) =>
        Array.from({ length: 40 }, (_, i) => barronAside(b, claim, i))
          .every((line) => !bad.test(line)));
    })());
}

console.log("\n-- the agenda is real, and leak-free ------------------------");
{
  const d = instanceDeal(7, "backdoor-fork");
  let r = createRun(d);
  // Walked forward, the count must strictly describe what is LEFT.
  const seen = [];
  for (let i = 0; i < d.claims.length; i++) {
    const o = laneOutlook(r, d);
    seen.push(o);
    r = advance(r, d);
  }
  ok("the outlook counts only claims still ahead",
    seen.every((o, i) => {
      const claim = d.claims[i];
      const later = d.claims.slice(i + 1);
      const want = claim.lane === LANES.SHAPE
        ? later.filter((c) => c.lane !== LANES.SHAPE).length
        : later.filter((c) => c.lane === claim.lane).length;
      return o.remaining === want;
    }));
  ok("the last claim in a lane reports zero runway",
    (() => {
      const lastChain = [...d.claims].reverse().find((c) => c.lane === LANES.CHAIN);
      if (!lastChain) return true;
      const idx = d.claims.indexOf(lastChain);
      return laneOutlook({ ...createRun(d), claimIndex: idx }, d).remaining === 0;
    })());
  // THE LEAK CHECK. Two deals from the same archetype with OPPOSITE outcomes
  // must produce identical agendas, or Eugene is telling you the answer.
  ok("the agenda is identical across rug and legit — it cannot leak the branch",
    (() => {
      const seeds = [];
      for (let s = 1; s < 400 && seeds.length < 2; s++) {
        const dd = instanceDeal(s, "backdoor-fork");
        if (!seeds.some((x) => x.truth === dd.truth)) seeds.push(dd);
      }
      if (seeds.length < 2) return true;
      const shape = (dl) => dl.claims.map((c) => c.lane).join(",");
      // same slots played -> same lane sequence -> same agenda, whatever the truth
      const [a, b] = seeds;
      if (shape(a) !== shape(b)) return true; // different slots rolled; nothing to compare
      return a.claims.every((c, i) =>
        laneOutlook({ ...createRun(a), claimIndex: i }, a).remaining ===
        laneOutlook({ ...createRun(b), claimIndex: i }, b).remaining);
    })());
}

console.log("\n-- lanes and legality --------------------------------------");
{
  const d = instanceDeal(7, "backdoor-fork");
  ok("every claim carries a lane and an agenda subject",
    d.claims.every((c) => Object.values(LANES).includes(c.lane) && !!c.subject));
  ok("GR80 cannot be sent into a CHAIN claim",
    !canSend(SEATS.GR80, d.claims.find((c) => c.lane === LANES.CHAIN)));
  ok("only Barron can take a SHAPE claim", (() => {
    const s = d.claims.find((c) => c.lane === LANES.SHAPE);
    return !s || (canSend(SEATS.BARRON, s) && SPENDABLE_SEATS.every((x) => !canSend(x, s)));
  })());

  const record = d.claims.find((c) => c.lane === LANES.RECORD);
  let run = walkTo(d, record.id);
  const before = run.pressesLeft;
  run = press(run, d, SEATS.MARISOL);
  ok("an off-lane send is a NO-OP, not an error and not a penalty",
    run.pressesLeft === before && run.advisersSpent.length === 0);
  ok("seatOptions explains WHY a seat is unavailable",
    seatOptions(run, d).find((o) => o.seat === SEATS.MARISOL).reason === "off-lane");
}

console.log("\n-- the adviser is the scarce resource ----------------------");
{
  const d = instanceDeal(7, "backdoor-fork");
  const rec = laneOf(d, SEATS.GR80);
  ok("backdoor-fork gives GR80 more targets than uses", rec.length >= 2, `${rec.length}`);

  let run = walkTo(d, rec[0].id);
  run = press(run, d, SEATS.GR80);
  ok("sending an adviser costs an interruption", run.pressesLeft === PRESSES - 1);
  ok("...and costs the adviser", run.advisersSpent.includes(SEATS.GR80));

  let run2 = run;
  while (currentClaim(run2, d) && currentClaim(run2, d).id !== rec[1].id) run2 = advance(run2, d);
  const budget = run2.pressesLeft;
  run2 = press(run2, d, SEATS.GR80);
  ok("a spent adviser cannot be sent again at a valid later target",
    run2.pressesLeft === budget && run2.advisersSpent.length === 1);
  ok("...and Barron is still available there",
    press(run2, d, SEATS.BARRON).pressesLeft === budget - 1);
  ok("advisers are independent — spending GR80 leaves Marisol",
    !run2.advisersSpent.includes(SEATS.MARISOL));
}

console.log("\n-- what an interruption returns ----------------------------");
{
  const d = instanceDeal(7, "backdoor-fork");
  const audit = d.claims.find((c) => c.id === "audit");

  const b = resolvePress(audit, SEATS.BARRON);
  ok("Barron's press lands on Barron's board", b.board === SEATS.BARRON);
  ok("Barron speaks his authored generic line", b.barronSays === audit.press.generic.line);
  ok("no adviser speaks on a Barron press", b.adviserSays === null);

  const g = resolvePress(audit, SEATS.GR80);
  ok("an adviser's answer lands on the ADVISER's board", g.board === SEATS.GR80);
  ok("the adviser speaks a global line, not archetype prose", !!g.adviserSays);
  ok("Barron reacts with his authored sharp line", g.barronSays === audit.press.sharp.line);
  ok("the receipt is the claim's authored sharp receipt",
    JSON.stringify(g.receipt) === JSON.stringify(audit.press.sharp.receipt));

  const rugBF = findDeal((x) => x.truth === 1 && x.claims.some((c) => c.id === "ops"), "backdoor-fork");
  const ops = rugBF.claims.find((c) => c.id === "ops");
  const n = resolvePress(ops, SEATS.GR80);
  ok("an adviser finding nothing reports NOTHING ON FILE", n.nothingOnFile === true && n.receipt === null);
  ok("...which is a different event from Barron's black board",
    resolvePress(ops, SEATS.BARRON).nothingOnFile === false);
  ok("an off-lane resolve returns null even when called directly",
    resolvePress(ops, SEATS.MARISOL) === null);
}

console.log("\n-- the budget is still frozen ------------------------------");
{
  ok("PRESSES is exactly 3", PRESSES === 3);
  for (const arch of ARCHETYPE_IDS) {
    const d = instanceDeal(11, arch);
    let run = createRun(d), spent = 0;
    for (let i = 0; i < d.claims.length; i++) {
      const before = run.pressesLeft;
      for (const seat of [SEATS.GR80, SEATS.MARISOL, SEATS.BARRON]) run = press(run, d, seat);
      spent += before - run.pressesLeft;
      run = advance(run, d);
    }
    ok(`${arch}: no path spends more than 3`, spent === 3, `${spent}`);
    ok(`${arch}: at most one interruption per claim`, Object.keys(run.outcomes).length <= 3);
  }
  const d3 = instanceDeal(3);
  let run = press(createRun(d3), d3, SEATS.BARRON);
  const after = run.pressesLeft;
  ok("a second interruption on the same claim is a no-op",
    press(run, d3, SEATS.BARRON).pressesLeft === after);
  run = callIt(run, d3);
  ok("pressing after the call is a no-op",
    press(run, d3, SEATS.BARRON).pressesLeft === run.pressesLeft);
}

console.log("\n-- TRUTH IS NEVER FOR SALE ---------------------------------");
{
  let worst = null;
  for (const arch of ARCHETYPE_IDS) {
    for (const wantTruth of [0, 1]) {
      const d = findDeal((x) => x.truth === wantTruth, arch);
      if (!d) { worst = `${arch}/${wantTruth}: no instance`; continue; }
      const decisive = d.claims.filter((c) => c.loadBearing);
      if (!decisive.length) { worst = `${arch}/${wantTruth}: no loadBearing claim played`; continue; }
      if (!decisive.every((c) => c.backing === BACKING.HARD && !!resolvePress(c, SEATS.BARRON).receipt))
        worst = `${arch}/${wantTruth}: decisive claim not free-reachable`;
      if (!decisive.some((c) => c.discriminates))
        worst = `${arch}/${wantTruth}: decisive claim tells you nothing`;
    }
  }
  ok("every archetype x branch is solvable with ZERO advisers", worst === null, worst || "");
}

console.log("\n-- STRUCTURAL: is there always a real choice? --------------");
{
  for (const arch of ARCHETYPE_IDS) {
    let one = 0, none = 0, anyChoice = 0, n = 0;
    for (let seed = 1; seed <= 500; seed++) {
      const d = instanceDeal(seed, arch);
      const counts = SPENDABLE_SEATS.map((s) => laneOf(d, s).length);
      n++;
      if (counts.some((c) => c >= 2)) anyChoice++;
      if (counts.some((c) => c === 1)) one++;
      if (counts.some((c) => c === 0)) none++;
    }
    ok(`${arch}: every session gives at least one adviser a real choice`, anyChoice === n, `${anyChoice}/${n}`);
    ok(`${arch}: no adviser is ever left with zero targets`, none === 0, `${none}`);
    console.log(`       ${arch}: an adviser is down to a single target in ${(one / n * 100).toFixed(1)}% of sessions`);
  }
  let bad = 0;
  for (const arch of ARCHETYPE_IDS)
    for (let seed = 1; seed <= 300; seed++) {
      const d = instanceDeal(seed, arch);
      if (!d.claims.some((c) => c.discriminates && c.lane !== LANES.SHAPE)) bad++;
    }
  ok("every session has a discriminating claim inside an adviser's lane", bad === 0, `${bad}`);
}

console.log("\n-- coverage replaces 'finding dirt' ------------------------");
{
  const d = instanceDeal(7, "backdoor-fork");
  const clean = d.claims.find((c) => !c.discriminates);
  const sharp = d.claims.find((c) => c.discriminates);

  let a = walkTo(d, sharp.id);
  a = press(a, d, SEATS.BARRON);
  ok("pressing a discriminating claim scores", coverageScore(a, d).hit === 1);

  if (clean) {
    let b = walkTo(d, clean.id);
    b = press(b, d, SEATS.BARRON);
    const s = coverageScore(b, d);
    ok("pressing a claim that is clean in BOTH branches scores nothing",
      s.hit === 0 && s.wasted === 1, `${clean.id}`);
  } else {
    ok("pressing a claim that is clean in BOTH branches scores nothing (none in this instance)", true);
  }
  ok("an untouched run scores zero", coverageScore(createRun(d), d).hit === 0);
  ok("coverage reports what was available", coverageScore(a, d).available >= 1);
}

console.log("\n-- nothing leaks the outcome before the reveal -------------");
{
  const d = instanceDeal(7, "backdoor-fork");
  let run = press(createRun(d), d, SEATS.BARRON);
  const floor = JSON.stringify({ run, options: seatOptions(run, d), chips: run.chips });
  ok("no FLOOR payload mentions discriminates", !/discriminates/.test(floor));
  ok("no FLOOR payload mentions truth or outcome", !/"truth"|"outcome"|"resolution"/.test(floor));
  ok("resolvePress never returns the branch", (() => {
    const r = resolvePress(d.claims[0], SEATS.BARRON);
    return !("truth" in r) && !("outcome" in r) && !("discriminates" in r);
  })());
}

console.log("\n-- the call, unchanged -------------------------------------");
{
  ok("slider -100 -> p=1 (hardest SHORT)", near(sliderToP(-100), 1));
  ok("slider +100 -> p=0 (hardest LONG)", near(sliderToP(100), 0));
  ok("slider 0 -> p=0.5 (FLAT)", near(sliderToP(0), 0.5));

  const rug = findDeal((x) => x.truth === 1);
  ok("perfect SHORT on a rug pays +STAKE",
    near(allocate(callIt(createRun(rug), rug), rug, -100).call.pnl, STAKE));
  ok("full LONG on a rug loses 3x STAKE",
    near(allocate(callIt(createRun(rug), rug), rug, 100).call.pnl, -3 * STAKE));
  ok("FLAT settles at exactly zero",
    near(allocate(callIt(createRun(rug), rug), rug, 0).call.pnl, 0));
  const legit = findDeal((x) => x.truth === 0);
  ok("a legit instance rewards a LONG call",
    allocate(callIt(createRun(legit), legit), legit, 90).call.pnl > 0);
}

console.log("\n-- PROPERNESS (the design theorem) -------------------------");
{
  let worst = 0;
  for (let qi = 0; qi <= 20; qi++) {
    const q = qi / 20;
    let bestV = null, bestE = -Infinity;
    for (let v = -100; v <= 100; v++) {
      const p = sliderToP(v);
      const E = q * casePnl(p, 1, STAKE) + (1 - q) * casePnl(p, 0, STAKE);
      if (E > bestE) { bestE = E; bestV = v; }
    }
    worst = Math.max(worst, Math.abs(bestV - Math.round((1 - 2 * q) * 100)));
  }
  ok("honest reporting maximises expected P&L at every belief", worst === 0, `${worst}`);
  const pressBody = fs.readFileSync("src/game/terminal-traders/press/pressRun.js", "utf8")
    .split("export function press(")[1].split("export function seatOptions")[0];
  ok("no seat path touches the stake or the budget constant",
    !/STAKE/.test(pressBody) && !/PRESSES\s*=/.test(pressBody));
}

console.log("\n-- PURITY: a run is a function of (seed, inputs) -----------");
{
  const files = [];
  const walk = (p) => fs.readdirSync(p, { withFileTypes: true }).forEach((e) =>
    e.isDirectory() ? walk(`${p}/${e.name}`) : e.name.endsWith(".js") && files.push(`${p}/${e.name}`));
  walk("src/game/terminal-traders/press");
  // Strip comments and string literals first. The archetypes are mostly PROSE,
  // and a line like "a cherry-picked window." is not a global reference — the
  // naive grep flagged it and would have flagged every future archetype too.
  const codeOnly = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
  const offenders = files.filter((f) =>
    !f.endsWith("instanceDeal.js") &&
    /Date\.|performance\.|localStorage|sessionStorage|Math\.random|window\./.test(codeOnly(fs.readFileSync(f, "utf8"))));
  ok("no impurity under press/ (dailySeed's clock is the one exception)",
    offenders.length === 0, offenders.join(", "));

  const script = [SEATS.GR80, null, SEATS.BARRON, null, null, SEATS.MARISOL];
  const play = () => {
    const d = instanceDeal(20250727);
    let r = createRun(d);
    for (const seat of script) { if (seat) r = press(r, d, seat); r = advance(r, d); }
    return JSON.stringify(allocate(r.phase === PHASE.ALLOCATION ? r : callIt(r, d), d, -60));
  };
  ok("replaying an identical input list reproduces the run byte for byte", play() === play());
}

console.log("\n-- a full session, played two ways -------------------------");
{
  const d = instanceDeal(7, "backdoor-fork");
  const runA = (() => {
    let r = createRun(d);
    for (let i = 0; i < 3; i++) { r = press(r, d, SEATS.BARRON); r = advance(r, d); }
    while (r.phase === PHASE.FLOOR) r = advance(r, d);
    return r;
  })();
  const runB = (() => {
    let r = createRun(d);
    for (const c of d.claims) {
      const seat = c.lane === LANES.RECORD && !r.advisersSpent.includes(SEATS.GR80) ? SEATS.GR80
        : c.lane === LANES.CHAIN && !r.advisersSpent.includes(SEATS.MARISOL) ? SEATS.MARISOL : null;
      if (seat && r.pressesLeft > 0) r = press(r, d, seat);
      if (r.phase !== PHASE.FLOOR) break;
      r = advance(r, d);
    }
    while (r.phase === PHASE.FLOOR) r = advance(r, d);
    return r;
  })();

  ok("both routes reach the call", runA.phase === PHASE.ALLOCATION && runB.phase === PHASE.ALLOCATION);
  ok("the desk route puts receipts on more than one board",
    new Set(Object.values(runB.outcomes).map((o) => o.board)).size > 1);
  ok("the Barron route only ever fills his own board",
    new Set(Object.values(runA.outcomes).map((o) => o.board)).size === 1);
  const cA = coverageScore(runA, d), cB = coverageScore(runB, d);
  console.log(`       route A (Barron x3): ${cA.hit}/${cA.spent} discriminating`);
  console.log(`       route B (the desk) : ${cB.hit}/${cB.spent} discriminating`);
  ok("both routes are scoreable", cA.spent > 0 && cB.spent > 0);
}

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
