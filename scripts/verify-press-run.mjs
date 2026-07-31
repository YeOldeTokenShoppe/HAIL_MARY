// Headless verification for THE PRESS controller.
// Run: node scripts/verify-press-run.mjs
//
// The run logic is pure, so it is pinned here BEFORE any pixel is drawn.
// Rewritten 2026-07-27 for the four-character layer: cards were cut, advisers
// are the scarce resource. The card assertions are gone; everything they were
// protecting (frozen budget, no refunds, one press per claim, truth never for
// sale) is re-asserted against seats.

import fs from "node:fs";
import { instanceDeal, ARCHETYPE_IDS, backingOf, genericDiscriminates, sharpDiscriminates } from "../src/game/terminal-traders/press/instanceDeal.js";
import { BACKING, SHAPES, LANES, PITCHER, SEATS, SEAT_LANE, SPENDABLE_SEATS, canSend, inLane } from "../src/game/terminal-traders/press/questions.js";
import { DESK, EUGENE, PITCH_BOT, adviserLine, laneSentence, laneOwner, pitcherAside } from "../src/game/terminal-traders/press/desk.js";
import { VIRGIL, virgilRead, agenda as virgilAgenda, shapeTip } from "../src/game/terminal-traders/press/virgil.js";
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
  ok("four seats, one specialism each", Object.keys(DESK).length === 4 && !!EUGENE);
  ok("every seat owns exactly one lane, and no two share",
    (() => {
      const lanes = Object.values(DESK).map((d) => d.lane);
      return lanes.every(Boolean) && new Set(lanes).size === lanes.length;
    })());
  // THE DESK HAS NO EXCEPTIONS LEFT (2026-07-29). Barron was excluded here for as
  // long as he was the pitcher; the bot took that job, so all four seats are
  // scarce and the special case is gone. The pitcher is not a seat at all.
  ok("all four seats are spendable — the desk is symmetric",
    SPENDABLE_SEATS.length === 4
    && [SEATS.BARRON, SEATS.MARISOL, SEATS.GR80, SEATS.EUGENE].every((s) => SPENDABLE_SEATS.includes(s)));
  ok("the pitcher is not a seat and owns no lane",
    !Object.values(SEATS).includes(PITCHER) && !SEAT_LANE[PITCHER]
    && !SPENDABLE_SEATS.includes(PITCHER));
  ok("Barron owns the chart and can still be asked off-lane",
    SEAT_LANE[SEATS.BARRON] === LANES.CHART && canSend(SEATS.BARRON, { lane: LANES.CHAIN }));
  ok("Marisol CHAIN, GR80 RECORD, Eugene SOCIAL",
    SEAT_LANE[SEATS.MARISOL] === LANES.CHAIN && SEAT_LANE[SEATS.GR80] === LANES.RECORD
    && SEAT_LANE[SEATS.EUGENE] === LANES.SOCIAL);
  ok("every seat maps to a real scene agent and screen station",
    Object.values(DESK).every((d) => d.agentId && d.station) && EUGENE.agentId === "RL80");
  let total = true;
  for (const sh of Object.values(SHAPES))
    for (const ln of Object.values(LANES))
      if (!virgilRead({ id: "xx", shape: sh, lane: ln }, { owner: laneOwner({ lane: ln }) }).agenda) total = false;
  ok("Virgil's read is total over all shapes x lanes", total);
  ok("Virgil's read is deterministic",
    virgilRead({ id: "audit", shape: SHAPES.UNSOURCED, lane: LANES.CHAIN }, { owner: DESK[SEATS.MARISOL] }).tip ===
    virgilRead({ id: "audit", shape: SHAPES.UNSOURCED, lane: LANES.CHAIN }, { owner: DESK[SEATS.MARISOL] }).tip);
  ok("all four seats have every result line, deep and shallow",
    SPENDABLE_SEATS.every((s) => ["dispatch", "found", "partial", "nothing"].every((r) => adviserLine(s, r))
      && adviserLine(s, "found", false)));

  // THE FLOOR MAY NEVER NAME A SPENT ADVISER AS THE WAY THROUGH. Both of these
  // shipped broken: the band read "only Detective Marisol can settle it" and
  // the read (Eugene's at the time) said "Marisol can settle it" on a claim
  // where she was already spent
  // and two interruptions were still in hand. Neither is cosmetic — it's an
  // instruction to take an action the controller rejects as a no-op.
  const chainClaim = { id: "dep", shape: SHAPES.SELECTIVE_WINDOW, lane: LANES.CHAIN };
  const recClaim = { id: "aud", shape: SHAPES.BORROWED_CREDIBILITY, lane: LANES.RECORD };
  ok("the lane band names who goes deepest, not who is permitted",
    laneSentence(chainClaim).includes(DESK[SEATS.MARISOL].name)
    && /deepest/i.test(laneSentence(chainClaim))
    && !/only/i.test(laneSentence(chainClaim))
    && laneSentence(recClaim).includes(DESK[SEATS.GR80].name));
  ok("the lane band stops issuing an impossible instruction once they're spent",
    (() => {
      // Capped, not closed: everyone else still answers, just shallowly.
      const a = laneSentence(chainClaim, { spent: [SEATS.MARISOL] });
      const b = laneSentence(recClaim, { spent: [SEATS.GR80] });
      return /spent/i.test(a) && /shallow/i.test(a)
        && /spent/i.test(b) && /shallow/i.test(b);
    })());
  ok("Virgil stops pointing at a spent adviser",
    (() => {
      const live = virgilAgenda(chainClaim, { owner: laneOwner(chainClaim), remaining: 2 });
      const dead = virgilAgenda(chainClaim, { owner: laneOwner(chainClaim), spent: [SEATS.MARISOL], remaining: 2 });
      return live !== dead && /shallow looks left/i.test(dead);
    })());
  ok("spending the OTHER adviser changes nothing about this lane",
    laneSentence(chainClaim, { spent: [SEATS.GR80] }) === laneSentence(chainClaim)
    && virgilRead(chainClaim, { owner: laneOwner(chainClaim), spent: [SEATS.GR80] }).agenda === virgilRead(chainClaim, { owner: laneOwner(chainClaim) }).agenda);

  // EUGENE'S JOB. His second sentence is the agenda — how much runway is left
  // in this lane — because the lane band already owns "whose is it" and a
  // character who restates the UI reads as having no role at all.
  ok("Virgil's read is the SHAPE plus the agenda, never a restatement of the lane",
    (() => {
      const r = virgilRead(chainClaim, { owner: laneOwner(chainClaim), remaining: 2 }).agenda;
      // the band's job — naming the owner — must not appear in his mouth
      return !/Marisol can settle|only .* can settle/i.test(r) && /money question/i.test(r);
    })());
  ok("the agenda distinguishes 'hold' from 'now or never'",
    (() => {
      const more = virgilAgenda(chainClaim, { owner: laneOwner(chainClaim), remaining: 3 });
      const last = virgilAgenda(chainClaim, { owner: laneOwner(chainClaim), remaining: 0 });
      return more !== last && /Three more/i.test(more) && /Last money question/i.test(last);
    })());
  ok("singular and plural both read as English",
    /One more money question after this one\./.test(virgilAgenda(chainClaim, { owner: laneOwner(chainClaim), remaining: 1 }))
    && /Two more money questions after this one\./.test(virgilAgenda(chainClaim, { owner: laneOwner(chainClaim), remaining: 2 })));
  // EVERY LANE, NOT JUST CHAIN. Both agenda bugs found on 2026-07-28 shipped
  // because every assertion here used `chainClaim` — the one lane whose noun
  // pluralises with a trailing "s" and whose owner is never Eugene. A per-lane
  // sweep is the assertion that would have caught them the day they landed.
  ok("every lane pluralises on its HEAD noun, not its phrase",
    Object.values(LANES).filter((l) => l !== LANES.SHAPE).every((lane) => {
      const two = virgilAgenda({ id: "x", lane }, { owner: laneOwner({ lane }),  remaining: 2 });
      return !/\bs\b|storys|charts\b|questions about the (chart|story)s/.test(two)
        && /questions?/.test(two) && !/question after/.test(two);
    }));
  ok("no lane produces a mangled noun phrase at any count",
    Object.values(LANES).filter((l) => l !== LANES.SHAPE).every((lane) =>
      [0, 1, 2, 3].every((remaining) =>
        [[], [SEATS.MARISOL], [SEATS.GR80], [SEATS.EUGENE], [SEATS.BARRON]].every((spent) => {
          const line = virgilAgenda({ id: "x", lane }, { owner: laneOwner({ lane }),  spent, remaining });
          return line
            && !/storys|charts\b|questions question|more question after/.test(line)
            && /[.!]$/.test(line);
        }))));
  // The free read belongs to VIRGIL now, not to a seat, so the old
  // self-reference problem ("and me was already spent", shipped in 192/400
  // yield-mirage seeds) is structurally gone: a cat is never the lane owner.
  ok("the agenda never refers to the speaker in the first person",
    Object.values(LANES).filter((l) => l !== LANES.SHAPE).every((lane) =>
      [0, 1, 2].every((remaining) =>
        [[], [SEATS.EUGENE], [SEATS.MARISOL]].every((spent) => {
          const line = virgilAgenda({ id: "x", lane }, { owner: laneOwner({ lane }), spent, remaining });
          return !/\bme\b|\bI\b|send me/i.test(line);
        }))));
  ok("Virgil is not a seat and owns no lane",
    !DESK[VIRGIL.id] && !Object.values(DESK).some((d) => d.id === VIRGIL.id));
  ok("the tips can be silenced; the agenda cannot",
    (() => {
      const c = { id: "dep", shape: SHAPES.SELECTIVE_WINDOW, lane: LANES.CHAIN };
      const on = virgilRead(c, { owner: laneOwner(c), remaining: 2, tips: true });
      const off = virgilRead(c, { owner: laneOwner(c), remaining: 2, tips: false });
      return on.tip && !off.tip && on.agenda && off.agenda === on.agenda;
    })());
  ok("a SHAPE claim reports what's checkable at all, not a lane",
    (() => {
      const s = virgilAgenda({ id: "vibe", shape: SHAPES.UNFALSIFIABLE, lane: LANES.SHAPE }, { owner: null, remaining: 2 });
      return /Nobody's the expert/i.test(s) && !/money|paperwork|chart|story/i.test(s);
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
    !pitcherAside(PRESSURE.COOL, claim, 0)
    && [PRESSURE.BACKED, PRESSURE.RATTLED, PRESSURE.CORNERED]
      .every((b) => pitcherAside(b, claim, 0).length > 0));
  ok("asides are deterministic",
    pitcherAside(PRESSURE.CORNERED, claim, 2) === pitcherAside(PRESSURE.CORNERED, claim, 2));
  // Repeating a line verbatim on the next claim reads as a stuck component,
  // not a character — which is exactly what keying the pick to claim.id.length
  // produced when two consecutive ids happened to be the same length.
  ok("he never says the same thing twice in a row",
    [PRESSURE.BACKED, PRESSURE.RATTLED, PRESSURE.CORNERED].every((b) =>
      Array.from({ length: 12 }, (_, i) => pitcherAside(b, claim, i))
        .every((line, i, all) => i === 0 || line !== all[i - 1])));
  ok("no aside names a lane, a seat or an outcome",
    (() => {
      // Lane names and role labels included: RECORD is a lane and THE PAPERWORK
      // is a role, so either in his mouth reads as him naming whose turn it is.
      const bad = /marisol|gr80|eugene|chain|record|paperwork|receipt|nothing on file|rug|legit/i;
      return [PRESSURE.BACKED, PRESSURE.RATTLED, PRESSURE.CORNERED].every((b) =>
        Array.from({ length: 40 }, (_, i) => pitcherAside(b, claim, i))
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
  // must produce identical agendas, or Virgil is telling you the answer.
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

console.log("\n-- THE ACCEPTANCE INVARIANT: the desk must beat the seller ---");
{
  // This section exists because the acceptance test FAILED on 2026-07-28.
  // Measured then: generic and sharp discriminated identically on 14/14 slots,
  // so sending a specialist told you exactly as much about the branch as
  // pressing the seller — and since the seller is unlimited and lane-free while
  // the seats are one-use, three presses on the seller weakly DOMINATED the
  // entire four-seat desk. The mechanic the whole redesign rests on did nothing.
  //
  // The seller was John Barron then and is the pitch bot now (2026-07-29). The
  // asymmetry this section guards against is UNCHANGED by that swap — if
  // anything it matters more, because Barron joining the desk means all four
  // specialists are costed and the free press is the only uncosted move left.
  //
  // The cause was `backing` being authored per branch. resolvePress zeroes the
  // receipt on VIBES, so a VIBES-in-rug / HARD-in-legit slot returned nothing
  // to ANYONE in the rug branch: the signal lived in backing, where depth
  // could not reach it. These four assertions are the ones whose absence let
  // two days of work be built on sand.
  for (const [name, mod] of [
    ["backdoor-fork", await import("../src/game/terminal-traders/press/archetypes/backdoorFork.js")],
    ["yield-mirage", await import("../src/game/terminal-traders/press/archetypes/yieldMirage.js")],
  ]) {
    const S = mod.SLOTS;

    ok(`${name}: backing is a property of the CLAIM, never the branch`,
      S.every((sl) => sl.backing && sl.rug.backing === undefined && sl.legit.backing === undefined),
      S.filter((sl) => !sl.backing).map((sl) => sl.id).join(",") || "branch-level backing still present");

    // THE SELLER MAY NOT LEAK. His shallow answer is the same script in both
    // worlds — that is what selling is. The one exception is the loadBearing
    // slot, which invariant 1 ("truth is never for sale") requires stay
    // reachable on a free press.
    const leaks = S.filter((sl) => !sl.loadBearing && genericDiscriminates(sl));
    ok(`${name}: no non-loadBearing slot lets the seller give away the branch`,
      leaks.length === 0, leaks.map((sl) => sl.id).join(", "));

    ok(`${name}: the loadBearing claim IS still reachable on a free press`,
      S.filter((sl) => sl.loadBearing).every(genericDiscriminates));

    // THE POINT OF THE DESK. Strictly more claims must be settleable by a
    // specialist than by the seller, or the specialists are decoration.
    const g = S.filter(genericDiscriminates).length;
    const sh = S.filter(sharpDiscriminates).length;
    ok(`${name}: specialists settle strictly more than the seller can`,
      sh > g, `sharp ${sh} vs generic ${g}`);

    // A SHALLOW ANSWER MUST ALWAYS EXIST on a non-VIBES slot, or the seller has
    // nothing to say and depth is buying you the whole claim rather than the
    // last mile of it.
    const mute = S.filter((sl) => backingOf(sl) !== BACKING.VIBES
      && !(sl.generic ?? sl.rug.generic)?.receipt);
    ok(`${name}: the seller always has a shallow receipt to offer`,
      mute.length === 0, mute.map((sl) => sl.id).join(", "));

    // A null SHARP receipt in ONE branch is not the old bug — it is the
    // NOTHING ON FILE beat, and it still discriminates because the other branch
    // returns something. The old bug was null in one branch at BOTH depths,
    // which hoisting `backing` now makes unrepresentable.
    const proven = S.filter((sl) => backingOf(sl) !== BACKING.VIBES
      && (!sl.rug.sharp?.receipt || !sl.legit.sharp?.receipt));
    ok(`${name}: at least one claim lets a specialist prove a negative`,
      proven.length >= 1, `slots that can stamp NOTHING ON FILE: ${proven.map((sl) => sl.id).join(", ") || "none"}`);
  }
}

console.log("\n-- lanes decide DEPTH, not legality -------------------------");
{
  const d = instanceDeal(7, "backdoor-fork");
  ok("every claim carries a lane and an agenda subject",
    d.claims.every((c) => Object.values(LANES).includes(c.lane) && !!c.subject));

  // THESE THREE ARE DELIBERATELY THE INVERSE OF WHAT THEY ASSERTED UNTIL
  // 2026-07-28. Under the gate model an off-lane send was rejected as a no-op,
  // which greyed out two of four seats on every claim and made the row read as
  // broken buttons. Expertise is a gradient now: everyone can be sent at
  // everything, and the lane decides how far they get.
  const chain = d.claims.find((c) => c.lane === LANES.CHAIN);
  const record = d.claims.find((c) => c.lane === LANES.RECORD);
  ok("GR80 CAN be sent into a CHAIN claim — it is legal, just shallow",
    canSend(SEATS.GR80, chain) && !inLane(SEATS.GR80, chain));
  ok("in-lane returns the sharp block, off-lane returns the generic one",
    (() => {
      const deep = resolvePress(record, SEATS.GR80);
      const shallow = resolvePress(record, SEATS.MARISOL);
      return deep.deep && !shallow.deep
        && deep.barronSays === record.press.sharp.line
        && shallow.barronSays === record.press.generic.line;
    })());
  ok("an off-lane resolve returns a real answer, never null",
    [PITCHER, ...SPENDABLE_SEATS].every((seat) => {
      const o = resolvePress(record, seat);
      return o && typeof o.barronSays === "string";
    }));

  let run = walkTo(d, record.id);
  const before = run.pressesLeft;
  run = press(run, d, SEATS.MARISOL);
  ok("an off-lane send COSTS a press and spends that colleague",
    run.pressesLeft === before - 1 && run.advisersSpent.includes(SEATS.MARISOL));
  ok("seatOptions marks depth per seat, and never reports an off-lane refusal",
    (() => {
      // before any press on this RECORD claim: everyone live, GR80 deep
      const fresh = seatOptions(walkTo(d, record.id), d);
      const deepOnes = fresh.filter((o) => o.deep).map((o) => o.seat);
      return fresh.every((o) => o.enabled)
        && deepOnes.length === 1 && deepOnes[0] === SEATS.GR80
        && fresh.every((o) => o.reason !== "off-lane");
    })());
  ok("a spent colleague is the only seat-level refusal left",
    (() => {
      // On the ANSWERED claim every seat reads "answered" — and the row is
      // hidden there anyway, so that string never renders. The case that does
      // render is the NEXT claim: she is gone for the session, everyone else
      // is live, and nobody is refused for being in the wrong lane.
      const next = advance(run, d);
      const opts = seatOptions(next, d);
      const m = opts.find((o) => o.seat === SEATS.MARISOL);
      // FIVE options now, not four: the pitcher plus the four symmetric seats.
      // One seat spent leaves four live controls.
      return m.reason === "spent" && !m.enabled
        && opts.length === 5
        && opts.filter((o) => o.enabled).length === 4
        && opts.every((o) => o.reason !== "off-lane");
    })());

  // A SHALLOW LOOK CANNOT PROVE A NEGATIVE. NOTHING ON FILE means a specialist
  // went and found an absence; the wrong specialist finding nothing is a fact
  // about your choice, not about the deal, and must never render as the strong
  // result — that would let you manufacture the game's most damning outcome by
  // deliberately sending the wrong person.
  ok("only a DEEP look by somebody who isn't the pitcher can return NOTHING ON FILE",
    d.claims.every((c) =>
      [PITCHER, ...SPENDABLE_SEATS].every((seat) => {
        const o = resolvePress(c, seat);
        return !o.nothingOnFile || (o.deep && seat !== PITCHER);
      })));
  // The pitcher owns no lane, so it is never `deep` and can never prove an
  // absence. Barron CAN now — that is the point of him becoming a specialist.
  ok("the pitcher never returns NOTHING ON FILE on any claim",
    d.claims.every((c) => !resolvePress(c, PITCHER).nothingOnFile));
  ok("the pitcher is never deep, on any claim, in any archetype",
    ARCHETYPE_IDS.every((id) =>
      instanceDeal(31, id).claims.every((c) => !resolvePress(c, PITCHER).deep)));
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
  ok("...and the pitcher is still available there",
    press(run2, d, PITCHER).pressesLeft === budget - 1);
  ok("advisers are independent — spending GR80 leaves Marisol",
    !run2.advisersSpent.includes(SEATS.MARISOL));
}

console.log("\n-- what an interruption returns ----------------------------");
{
  const d = instanceDeal(7, "backdoor-fork");
  const audit = d.claims.find((c) => c.id === "audit");

  const b = resolvePress(audit, PITCHER);
  ok("the pitcher's press lands on the pitcher's board", b.board === PITCHER);
  ok("the pitcher speaks the authored generic line", b.barronSays === audit.press.generic.line);
  ok("no adviser speaks on a pitcher press", b.adviserSays === null);

  // BARRON IS A SEAT NOW, so he behaves like one: his own board, his own
  // retrieval line, and the pitcher reacting after him.
  const bar = resolvePress(audit, SEATS.BARRON);
  ok("Barron lands on Barron's board and speaks a retrieval line",
    bar.board === SEATS.BARRON && !!bar.adviserSays);
  ok("Barron off-lane gets the shallow line, not silence",
    bar.adviserSays === adviserLine(SEATS.BARRON, "found", false));

  const g = resolvePress(audit, SEATS.GR80);
  ok("an adviser's answer lands on the ADVISER's board", g.board === SEATS.GR80);
  ok("the adviser speaks a global line, not archetype prose", !!g.adviserSays);
  ok("the pitcher reacts with the authored sharp line", g.barronSays === audit.press.sharp.line);
  ok("the receipt is the claim's authored sharp receipt",
    JSON.stringify(g.receipt) === JSON.stringify(audit.press.sharp.receipt));

  const rugBF = findDeal((x) => x.truth === 1 && x.claims.some((c) => c.id === "ops"), "backdoor-fork");
  const ops = rugBF.claims.find((c) => c.id === "ops");
  const n = resolvePress(ops, SEATS.GR80);
  ok("an adviser finding nothing reports NOTHING ON FILE", n.nothingOnFile === true && n.receipt === null);
  ok("...which is a different event from the pitcher's black board",
    resolvePress(ops, PITCHER).nothingOnFile === false);
  ok("a shallow look that finds nothing is NOT NOTHING ON FILE",
    (() => {
      const shallow = resolvePress(ops, SEATS.MARISOL);  // ops is RECORD, she is CHAIN
      return shallow !== null && shallow.deep === false && shallow.nothingOnFile === false;
    })());
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
  let run = press(createRun(d3), d3, PITCHER);
  const after = run.pressesLeft;
  ok("a second interruption on the same claim is a no-op",
    press(run, d3, PITCHER).pressesLeft === after);
  run = callIt(run, d3);
  ok("pressing after the call is a no-op",
    press(run, d3, PITCHER).pressesLeft === run.pressesLeft);
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
      // FREE-REACHABLE MEANS THE PITCHER, NOT BARRON (2026-07-29). Barron is a
      // costed seat now, so asserting this against him would be asserting that
      // the decisive claim is reachable for the price of a specialist — which is
      // the opposite of invariant 1. The free press is the pitcher, and because
      // the pitcher owns no lane that press returns the `generic` block, which is
      // exactly why the loadBearing slot is the one slot allowed a per-branch
      // generic.
      if (!decisive.every((c) => c.backing === BACKING.HARD && !!resolvePress(c, PITCHER).receipt))
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
    // Under the gradient model "zero targets" is impossible — everyone can be
    // sent anywhere. The constraint that actually matters now is that each
    // specialist has at least one claim where their depth is worth spending on,
    // or their lane is decoration for that session.
    ok(`${arch}: every specialist gets at least one deep target`, none === 0, `sessions with a laneless specialist: ${none}`);
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
  a = press(a, d, PITCHER);
  ok("pressing a discriminating claim scores", coverageScore(a, d).hit === 1);

  if (clean) {
    let b = walkTo(d, clean.id);
    b = press(b, d, PITCHER);
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
  let run = press(createRun(d), d, PITCHER);
  const floor = JSON.stringify({ run, options: seatOptions(run, d), chips: run.chips });
  ok("no FLOOR payload mentions discriminates", !/discriminates/.test(floor));
  ok("no FLOOR payload mentions truth or outcome", !/"truth"|"outcome"|"resolution"/.test(floor));
  ok("resolvePress never returns the branch", (() => {
    const r = resolvePress(d.claims[0], PITCHER);
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
  const IMPURE = /Date\.|performance\.|localStorage|sessionStorage|Math\.random|window\./;
  const offenders = files.filter((f) =>
    !f.endsWith("instanceDeal.js") &&
    IMPURE.test(codeOnly(fs.readFileSync(f, "utf8"))));
  ok("no impurity under press/ (instanceDeal's rollSeed is the exception)",
    offenders.length === 0, offenders.join(", "));

  // THE FILE-LEVEL EXEMPTION ABOVE IS TOO BLUNT ON ITS OWN, and it hid a real
  // change: `seedForMode` added Math.random to instanceDeal.js on 2026-07-28
  // and this suite stayed green without noticing, while its own label still
  // claimed the clock was "the one exception".
  //
  // Both helpers are legitimately impure — dailySeed reads the clock,
  // seedForMode rolls a local game — because they PRODUCE a seed. What must
  // stay pure is everything downstream of one: given the same seed,
  // instanceDeal has to return the same deal forever, or replays, the daily
  // deal and every assertion in this file stop meaning anything. So assert on
  // the FUNCTION BODY rather than the file.
  {
    const src = codeOnly(fs.readFileSync("src/game/terminal-traders/press/instanceDeal.js", "utf8"));
    const body = src.split("export function instanceDeal(")[1]?.split("export function rollSeed")[0] ?? "";
    ok("instanceDeal() itself is pure — only its seed helpers may be impure",
      body.length > 0 && !IMPURE.test(body));
  }

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
    for (let i = 0; i < 3; i++) { r = press(r, d, PITCHER); r = advance(r, d); }
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
  ok("the pitcher route only ever fills the pitcher's own board",
    new Set(Object.values(runA.outcomes).map((o) => o.board)).size === 1);
  const cA = coverageScore(runA, d), cB = coverageScore(runB, d);
  console.log(`       route A (pitcher x3): ${cA.hit}/${cA.spent} discriminating`);
  console.log(`       route B (the desk) : ${cB.hit}/${cB.spent} discriminating`);
  ok("both routes are scoreable", cA.spent > 0 && cB.spent > 0);
}

console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
