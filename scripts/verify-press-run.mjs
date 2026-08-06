// Headless verification for THE PRESS controller.
// Run: node scripts/verify-press-run.mjs
//
// The run logic is pure, so it is pinned here BEFORE any pixel is drawn.
// Rewritten 2026-07-27 for the four-character layer: cards were cut, advisers
// are the scarce resource. The card assertions are gone; everything they were
// protecting (frozen budget, no refunds, one press per claim, truth never for
// sale) is re-asserted against seats.

import fs from "node:fs";
import { instanceDeal, ARCHETYPES, ARCHETYPE_IDS, backingOf, genericDiscriminates, sharpDiscriminates } from "../src/game/terminal-traders/press/instanceDeal.js";
import { BACKING, SHAPES, LANES, PITCHER, SEATS, SEAT_LANE, SPENDABLE_SEATS, canSend, inLane } from "../src/game/terminal-traders/press/questions.js";
import { DESK, EUGENE, PITCH_BOT, adviserLine, laneSentence, laneOwner, pitcherAside } from "../src/game/terminal-traders/press/desk.js";
import { VIRGIL, virgilRead, agenda as virgilAgenda, shapeTip,
         nextMove as virgilNextMove,
         afterAnswer as virgilAfterAnswer, briefing } from "../src/game/terminal-traders/press/virgil.js";
import {
  PRESSES, STAKE, PHASE, PRESS_COST, stakeFor, stakeNote, callReadout, callVerdict, betRestated,
  createRun, press, advance, callIt, allocate,
  resolvePress, sliderToP, coverageScore, currentClaim, seatOptions, laneOutlook, pressure, PRESSURE,
  settlementNote,
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
  /* A SEAT MUST NOT CHANGE VOICE DEPENDING ON WHETHER ITS PLAYER LOADED.
     Each seat with a SitePal portal reaches the SAME ElevenLabs voice two ways:
     api/counsel-voice when we play the audio ourselves, and engine 14 when the
     portal plays it and lip-syncs. Which one runs is a RUNTIME accident — did
     the iframe register sayText in time — so if the two ids drift, the
     character sounds like a different person for reasons the player cannot see.
     That is not hypothetical: GR80 shipped as SitePal Gilbert on one /main
     layout and ElevenLabs on the other, and it took a while to notice because
     each layout was self-consistent. Read the route's source rather than
     importing it — it is a server route with env fallbacks, and the literal is
     what a human would edit. */
  {
    const route = fs.readFileSync(
      new URL("../src/app/api/counsel-voice/route.js", import.meta.url), "utf8");
    const routeIds = Object.fromEntries(
      [...route.matchAll(/(\w+):\s*\{\s*(?:\/\/[^\n]*\n\s*)*id:\s*process\.env\.\w+\s*\|\|\s*"([^"]+)"/g)]
        .map((m) => [m[1], m[2]]));
    let lockstep = true;
    const drift = [];
    for (const seat of Object.keys(DESK)) {
      const cfg = DESK[seat].sitepal;
      if (!cfg) continue;                       // Eugene has a drawn mouth, no portal
      const want = routeIds[DESK[seat].voice];
      if (!want || want !== cfg.voice.voice) {
        lockstep = false;
        drift.push(`${DESK[seat].name}: route=${want} portal=${cfg.voice.voice}`);
      }
      // Engine 14 is what makes it ElevenLabs rather than a SitePal built-in.
      if (cfg.voice.engine !== 14) { lockstep = false; drift.push(`${DESK[seat].name}: engine ${cfg.voice.engine}`); }
    }
    ok("a seat's portal voice matches its api/counsel-voice id", lockstep);
    if (drift.length) console.log("       " + drift.join("\n       "));

    /* VIRGIL IS NOT A SEAT, so the sweep above skipped him — and he is the one
       character whose two ids have actually been edited by hand twice in a day.
       virgil.js carries the rule in a comment ("If the id moves in
       api/counsel-voice, move it here in the same commit") and nothing enforced
       it, which is precisely the silent failure that file warns about: a route
       and a portal that disagree don't error, they just make the cat sound like
       two different animals depending on which path got there first. */
    ok("Virgil's portal voice matches his api/counsel-voice id",
      !!routeIds[VIRGIL.voice] && routeIds[VIRGIL.voice] === VIRGIL.sitepal?.voice?.voice,
      `route=${routeIds[VIRGIL.voice]} portal=${VIRGIL.sitepal?.voice?.voice}`);
    ok("Virgil speaks through ElevenLabs, not a SitePal built-in",
      VIRGIL.sitepal?.voice?.engine === 14);
  }
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
  // TESTS THE PROPERTY, NOT THE WORDING. This used to require the literal
  // "deepest", which is a phrasing rather than a rule — and it failed the day
  // the sentence moved into Virgil's voice and became "this is Marisol's
  // specialty" (2026-08-04), which satisfies the rule completely. What the
  // assertion is actually protecting is that the line describes a CAPABILITY
  // and never a PERMISSION, because the permission version ("only Marisol can
  // settle it") is an instruction the controller rejects — anyone may be asked
  // anything, the lane only decides depth. So: it must name the owner, and it
  // must contain no permission language, whatever verb it reaches for.
  const permissionish = /\bonly\b|\bcan settle\b|\bmust ask\b|\bnot allowed\b|\bpermitted\b/i;
  ok("the lane band names who goes deepest, not who is permitted",
    laneSentence(chainClaim).includes(DESK[SEATS.MARISOL].name)
    && !permissionish.test(laneSentence(chainClaim))
    && !permissionish.test(laneSentence(chainClaim, { spent: [SEATS.MARISOL] }))
    && laneSentence(recClaim).includes(DESK[SEATS.GR80].name));
  ok("the lane band stops issuing an impossible instruction once they're spent",
    (() => {
      // Capped, not closed: everyone else still answers, just shallowly.
      const a = laneSentence(chainClaim, { spent: [SEATS.MARISOL] });
      const b = laneSentence(recClaim, { spent: [SEATS.GR80] });
      // WORDING UPDATED 2026-08-05, property unchanged. This pinned the literal
      // word "spent", which is copy and not behaviour — the sentence now reads
      // "…Marisol's specialty, and that use is gone" to stop naming the seat
      // twice in one sentence. What must hold is that the spent branch DIFFERS
      // from the unspent one and still says every other seat answers shallowly;
      // pin that instead, so the next rewording is caught only if it drops the
      // fact rather than merely the word.
      return a !== laneSentence(chainClaim) && /shallow/i.test(a)
        && b !== laneSentence(recClaim) && /shallow/i.test(b);
    })());
  ok("Virgil stops pointing at a spent adviser",
    (() => {
      const live = virgilAgenda(chainClaim, { owner: laneOwner(chainClaim), remaining: 2 });
      const dead = virgilAgenda(chainClaim, { owner: laneOwner(chainClaim), spent: [SEATS.MARISOL], remaining: 2 });
      // WORDING UPDATED FOR DRAFT 2 (2026-08-04), property unchanged: once the
      // owner is spent the agenda must say the lane is CAPPED, not closed. Was
      // "shallow looks left"; the same idea is now "a surface view".
      return live !== dead && /surface view/i.test(dead) && /already taken a deep look/i.test(dead);
    })());
  /* THE LANE RUNWAY CLAUSE (author, 2026-08-05: three consecutive Marisol claims,
     "of course i could only consult with her on the first question"). The game is
     which claim inside a lane deserves the one use — a timing decision the player
     could not make, because nothing said more of the lane was coming. */
  ok("the lane band says how many more of this lane are coming",
    (() => {
      const two = laneSentence(chainClaim, { remaining: 2, earlier: 0 });
      const one = laneSentence(chainClaim, { remaining: 1, earlier: 0 });
      // The COUNT has to be there, and it has to agree with itself.
      return /\btwo more\b/i.test(two) && /\bone more\b/i.test(one)
        && /questions\b/i.test(two) && /question\b/i.test(one)
        && two !== one;
    })());
  ok("the runway clause pluralises its verb with its count",
    /follows it/i.test(laneSentence(chainClaim, { remaining: 1 }))
    && /follow it/i.test(laneSentence(chainClaim, { remaining: 3 }))
    && !/follows it/i.test(laneSentence(chainClaim, { remaining: 3 })));
  // "The LAST money question you'll get" asserts earlier ones. On a lane holding
  // a single claim that is a false statement about the running order — and it is
  // the common case, not the corner: four of six claims on seed 4.
  ok("a lane with one claim is never called the LAST one",
    (() => {
      const solo = laneSentence(chainClaim, { remaining: 0, earlier: 0 });
      const last = laneSentence(chainClaim, { remaining: 0, earlier: 2 });
      return !/\blast\b/i.test(solo) && /\blast\b/i.test(last) && solo !== last;
    })());
  ok("laneOutlook reports the lane behind you as well as ahead",
    (() => {
      const d = instanceDeal(4);   // CHAIN CHAIN CHAIN RECORD CHART SOCIAL
      const at = (i) => laneOutlook({ ...createRun(d), claimIndex: i }, d);
      return at(0).remaining === 2 && at(0).earlier === 0
        && at(2).remaining === 0 && at(2).earlier === 2
        && at(3).remaining === 0 && at(3).earlier === 0;
    })());
  // Invariant 8 in the copy's own terms: the floor may not issue an instruction
  // the controller rejects. A count of claims is not an instruction, so it may
  // never bring permission language in with it.
  ok("the runway clause introduces no permission language",
    [0, 1, 2, 3].every((r) => [0, 2].every((e) =>
      !permissionish.test(laneSentence(chainClaim, { remaining: r, earlier: e })))));

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
  /* THE NUDGE NAMES THE MOVES AND NEVER INSTRUCTS AN IMPOSSIBLE ONE. Same rule
     the lane band learned the hard way: copy that points at a spent resource is
     an instruction the controller rejects as a no-op. */
  {
    const withBudget = Array.from({ length: 8 }, (_, i) => virgilNextMove({ pressesLeft: 2, index: i }));
    const spent = Array.from({ length: 8 }, (_, i) => virgilNextMove({ pressesLeft: 0, index: i }));
    ok("with follow-ups left, the nudge names BOTH moves",
      withBudget.every((l) => /teammate|team\b/i.test(l) && /pitch bot/i.test(l)));
    ok("with none left, it stops offering a follow-up",
      spent.every((l) => !/press the pitch bot|ask (one of )?your|send a teammate/i.test(l))
      && spent.every((l) => /left|gone/i.test(l)));
    ok("the nudge never repeats itself twice running",
      [2, 0].every((p) =>
        Array.from({ length: 12 }, (_, i) => virgilNextMove({ pressesLeft: p, index: i }))
          .every((l, i, all) => i === 0 || l !== all[i - 1])));
    ok("the nudge never names a lane, a seat by name, or an outcome",
      [...withBudget, ...spent].every((l) =>
        !/marisol|gr80|eugene|connor|chain|record|paperwork|rug|legit/i.test(l)));
    // It is flavour+controls, not the resource readout, so the mute switch takes
    // it — "Virgil stops chiming in" has to mean he stops.
    ok("muting the tips mutes the nudge, and never the agenda",
      (() => {
        const c = { id: "dep", shape: SHAPES.SELECTIVE_WINDOW, lane: LANES.CHAIN };
        const on = virgilRead(c, { owner: laneOwner(c), remaining: 2, tips: true, pressesLeft: 2 });
        const off = virgilRead(c, { owner: laneOwner(c), remaining: 2, tips: false, pressesLeft: 2 });
        return on.nextMove && !off.nextMove && off.agenda === on.agenda;
      })());
  }

  /* THE POST-ANSWER LINE CLOSES THE BEAT AND JUDGES NOTHING. It fires the moment
     a finding lands, which is exactly the moment a guide must not have an
     opinion — the player's whole job is to weigh what came back, and grading it
     for them would also require seeing the outcome, which is autopsy-only. */
  {
    const more = Array.from({ length: 6 }, (_, i) => virgilAfterAnswer({ lastClaim: false, index: i }));
    const last = Array.from({ length: 6 }, (_, i) => virgilAfterAnswer({ lastClaim: true, index: i }));
    ok("it points at NEXT POINT while points remain, and at the call on the last",
      more.every((l) => /next point/i.test(l))
      && last.every((l) => !/next point/i.test(l) && /call it|your call/i.test(l)));
    ok("it never grades the finding it just heard",
      [...more, ...last].every((l) =>
        !/concerning|worrying|clean|solid|suspicious|bad|good|damning|fine\b|reassuring/i.test(l)));
    ok("it never names a lane, a seat or an outcome",
      [...more, ...last].every((l) =>
        !/marisol|gr80|eugene|connor|chain|record|paperwork|rug|legit|receipt/i.test(l)));
    ok("it never repeats itself twice running",
      [false, true].every((lc) =>
        Array.from({ length: 12 }, (_, i) => virgilAfterAnswer({ lastClaim: lc, index: i }))
          .every((l, i, all) => i === 0 || l !== all[i - 1])));
  }

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
      // WORDING UPDATED FOR DRAFT 2 (2026-08-04), property unchanged: a SHAPE
      // claim must report that NOBODY specialises in it, and must not name a
      // lane while doing so. Was "Nobody's the expert on that one".
      return /Nobody owns this kind of check/i.test(s) && !/money|paperwork|chart|story/i.test(s);
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
  // The seller was Connor then and is the pitch bot now (2026-07-29). The
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

    // A DEEP TARGET IS NOT THE SAME AS A USEFUL ONE (2026-08-03). The assertion
    // above only proves the lane is non-empty. A lane can survive the cut
    // holding nothing but a slot that returns the SAME receipt in both branches
    // — the deliberate zero (§4 rule 7) or a VIBES slot — and then the seat is
    // sendable, says its line, and could never have moved the call. Measured
    // before instanceDeal pinned the last discriminating slot in a lane:
    // yield-mirage stranded Eugene in 26% of seeds, anon-but-real stranded
    // Marisol in 19%.
    //
    // EXEMPT: a lane whose slots are ALL non-discriminating in the archetype as
    // authored. backdoor-fork and anon-but-real give CHART a single VIBES slot
    // on purpose — there is no discriminating slot in that lane to pin, and
    // Barron's job there is to say price movement is not evidence (`[A§15]`).
    // That is an authoring choice; this assertion catches the cut destroying a
    // lane that HAD one.
    {
      const A = ARCHETYPES[arch];
      const authored = new Set(
        A.SLOTS.filter((s) => genericDiscriminates(s) || sharpDiscriminates(s)).map((s) => s.lane));
      let stranded = 0, worst = null;
      for (let seed = 1; seed <= 500; seed++) {
        const d = instanceDeal(seed, arch);
        for (const lane of authored) {
          const inLaneClaims = d.claims.filter((c) => c.lane === lane);
          if (inLaneClaims.length && !inLaneClaims.some((c) => c.discriminates)) {
            stranded++; worst ??= `seed ${seed}, ${lane}`;
          }
        }
      }
      ok(`${arch}: no lane is cut down to claims that cannot settle anything`,
        stranded === 0, worst ? `${stranded} lane-sessions, first at ${worst}` : "");
    }
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

  // AND AT EVERY PRESS COUNT. The stake is scaled by the questions already spent
  // (stakeFor), and the whole reason that scaling is a factor on `stake` rather
  // than a term on either branch is that a positive scalar leaves the argmax
  // alone. This pins it: shrink the win alone and this block fails immediately,
  // because the optimum slides off honest reporting toward under-confidence.
  let worstPriced = 0;
  for (let used = 0; used <= PRESSES; used++) {
    const stake = stakeFor({ advisersSpent: Array.from({ length: used }, (_, i) => i) });
    for (let qi = 0; qi <= 20; qi++) {
      const q = qi / 20;
      let bestV = null, bestE = -Infinity;
      for (let v = -100; v <= 100; v++) {
        const p = sliderToP(v);
        const E = q * casePnl(p, 1, stake) + (1 - q) * casePnl(p, 0, stake);
        if (E > bestE) { bestE = E; bestV = v; }
      }
      worstPriced = Math.max(worstPriced, Math.abs(bestV - Math.round((1 - 2 * q) * 100)));
    }
  }
  ok("the press price keeps the rule proper at every press count", worstPriced === 0, `${worstPriced}`);
  // THE REVEAL NAMES CONFIDENCE, NOT DIRECTION. The old headline was
  // `pnl >= 0`, which under casePnl is exactly |p - truth| <= 0.5 — a hit rate.
  // These pin the two calls it got wrong.
  {
    const rugDeal = { truth: 1 };
    const mk = (v) => ({ call: { v, p: sliderToP(v), pnl: casePnl(sliderToP(v), 1, STAKE) },
                         advisersSpent: [], pressesLeft: 3 });
    ok("an abstain is named an abstain, not a correct read",
      callVerdict(mk(0), rugDeal).key === "pass"
      && casePnl(0.5, 1, STAKE) === 0);
    ok("a timid right-side call is not told it read it right",
      callVerdict(mk(-30), rugDeal).key === "timid");
    ok("a confident right-side call is",
      callVerdict(mk(-90), rugDeal).key === "well");
    ok("a confident wrong-side call is named wrong",
      callVerdict(mk(90), rugDeal).key === "wrong");
    ok("the abstain restates no bet", betRestated(mk(0), rugDeal) === null);
    ok("a real call restates its own stake",
      /paid \d+ if you were right and cost \d+/.test(betRestated(mk(-90), rugDeal)));
  }

  ok("spending questions shrinks the stake and never inverts it",
    stakeFor({ advisersSpent: [] }) === STAKE
    && stakeFor({ advisersSpent: [1, 2, 3] }) < STAKE
    && stakeFor({ advisersSpent: [1, 2, 3] }) > 0
    // the pitcher is free of SIZE — Virgil says so on the floor.
    && stakeFor({ advisersSpent: [], pressesLeft: 0 }) === STAKE);
  /* THE DECAY HAS TO BE LEGIBLE, not merely correct (author, 2026-08-05: "i do
     see the different win/loss values, but… i don't know how i got to those
     values"). It was applied silently for a week — a proper scoring rule the
     player could not see the terms of. */
  ok("the call screen can say where the size went, spent or not",
    (() => {
      const none = stakeNote({ advisersSpent: [] });
      const some = stakeNote({ advisersSpent: [1, 2] });
      // The zero case must still teach the rule — it is the one that can still
      // change a decision — so it may not be empty, and the two must differ.
      return !!none && !!some && none !== some
        && none.includes(String(STAKE))
        // The spent case has to show the arithmetic: both ends, and the count.
        && some.includes(String(STAKE)) && some.includes("20") && /\b2\b/.test(some);
    })());
  /* AND THE PLAYER IS TOLD BEFORE THEY SPEND (author, 2026-08-05: "we should
     add a line about this mechanic in virgil's intro"). Every other readout of
     the decay reports it while it is happening; the briefing is the only place
     that can change a decision instead of explaining a disappointment. Both
     versions, because "same contract" is the short one's whole job. */
  ok("Virgil's briefing states the price of a teammate",
    (() => {
      const pct = String(Math.round(PRESS_COST * 100));
      const long = briefing().join(" ");
      const short = briefing(true).join(" ");
      const priced = (s) => s.includes(pct) && /stake/i.test(s);
      // The pitcher exception travels with it: free-of-size is the entire reason
      // the compromised source is worth pressing, and stakeFor keys on
      // advisersSpent purely to keep that true.
      return priced(long) && priced(short)
        && /free/i.test(long) && /free/i.test(short);
    })());
  ok("the briefing's price is templated, not typed in",
    // A name that drifts reads as a different character; a NUMBER that drifts is
    // the briefing lying about the rules the resolver is running.
    !fs.readFileSync("src/game/terminal-traders/press/virgil.js", "utf8")
      .split("export const BRIEFING")[1].split("export function briefing")[0]
      .match(/\b10 percent\b/));

  ok("the stake note counts SPECIALISTS, not questions",
    // Same reason stakeFor keys on advisersSpent: pressing the pitcher is free
    // of size, and Virgil says so out loud on the floor.
    stakeNote({ advisersSpent: [], pressesLeft: 0 }) === stakeNote({ advisersSpent: [] }));
  /* THE FLOOR MAY NOT QUOTE A FIGURE THE CALL SCREEN CONTRADICTS (author,
     2026-08-05: "Top indicator said 'playing for 23' before I asked any
     questions. I went to 'make the call' and the slider showed an upside of
     25"). The deleted pressPrice quoted casePnl at a fixed reference conviction,
     which disagrees with wherever the player actually puts the slider — see the
     note where it used to live. What the meter shows now is the stake itself,
     and the property that makes that safe is that the call screen's own numbers
     are derived from it. */
  ok("the meter's stake is the number the call screen is built from",
    (() => {
      const run = { pressesLeft: 3, advisersSpent: ["a"] };
      const stake = stakeFor(run);            // what the meter prints
      // At full conviction the upside IS the stake — casePnl(p,p,stake) = stake.
      const risk = callReadout(100, stake).risk;
      return risk.includes(String(Math.round(stake)))
        // …and the note on the call screen names the same number.
        && stakeNote(run).includes(String(stake));
    })());
  ok("passing on a deal is not called taking it on faith",
    (() => {
      const d = instanceDeal(4);
      const base = { ...createRun(d), outcomes: {} };
      // Same empty question budget, opposite plays: dead centre is p = 0.5 and
      // casePnl is exactly 0 there, so FLAT is the absence of a bet, not a small
      // one. The two must not share a sentence.
      const flat = coverageScore({ ...base, call: { v: 0, direction: "FLAT" } }, d);
      const bet = coverageScore({ ...base, call: { v: 80, direction: "LONG" } }, d);
      return flat.note !== bet.note
        && /faith/i.test(bet.note) && !/faith/i.test(flat.note)
        // Both still report the same coverage — only the sentence differs.
        && flat.spent === bet.spent && flat.hit === bet.hit;
    })());
  ok("the stake readout never claims a symmetric payoff",
    (() => {
      // "±23" promised a symmetry that exists at no setting of the control:
      // casePnl is quadratic in the error, so the loss outruns the gain
      // everywhere off the resting position. Pinned so nobody reinstates ±.
      const s = STAKE;
      const win = Math.abs(Math.round(casePnl(sliderToP(100), 0, s)));
      const lose = Math.abs(Math.round(casePnl(sliderToP(100), 1, s)));
      return win !== lose && lose > win;
    })());

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
  // TWO EXEMPT FILES, AND THEY ARE EXEMPT FOR THE SAME REASON: both PRODUCE a
  // roll rather than consuming one. instanceDeal has rollSeed/dailySeed;
  // pitchers.js has rollPitcher and the `?pitchbot=` override, which are how
  // VC_GAME.md §1 rule 6 gets the rig drawn AT TEMPLE LOAD, before the deal
  // exists. A file-level exemption is too blunt on its own, so each one is
  // followed below by an assertion on what must stay pure inside it.
  const EXEMPT = ["instanceDeal.js", "pitchers.js"];
  const offenders = files.filter((f) =>
    !EXEMPT.some((e) => f.endsWith(e)) &&
    IMPURE.test(codeOnly(fs.readFileSync(f, "utf8"))));
  ok("no impurity under press/ (the two seed/roll producers are the exceptions)",
    offenders.length === 0, offenders.join(", "));

  // THE RIG ROLL CANNOT SEE THE DEAL — VC_GAME.md §1 rule 6. With three or four
  // rigs against three archetypes, a bot keyed to the case pattern would be
  // close to a lookup table, read before a word is spoken. The independence is
  // meant to be STRUCTURAL rather than a promise, so pin it: the module must
  // never name an archetype, an outcome or a deal, and the thing that produces
  // deals must not import it.
  {
    const src = codeOnly(fs.readFileSync("src/game/terminal-traders/press/pitchers.js", "utf8"));
    ok("the pitcher roll cannot see the archetype, the branch or the deal",
      !/\barchetype|\boutcome\b|\btruth\b|\bdeal\b|\bclaims\b/i.test(src));
    ok("nothing that builds a deal imports the pitcher roster",
      !/pitchers/.test(codeOnly(fs.readFileSync("src/game/terminal-traders/press/instanceDeal.js", "utf8")))
      && !/pitchers/.test(codeOnly(fs.readFileSync("src/game/terminal-traders/press/pressRun.js", "utf8"))));
  }

  /* THE PREMISE CANNOT NAME THE PATTERN — the same rule as the name pool, and it
     is the reason `sector` lives in identities.js rather than on an archetype.
     A premise authored per archetype would reopen exactly the leak IDENTITIES
     was created to close (see its header: identifying the archetype is worth a
     ~44 point swing). Three things to pin. */
  {
    const idsrc = codeOnly(fs.readFileSync("src/game/terminal-traders/press/identities.js", "utf8"));
    ok("the sector pool is shared and names no archetype",
      /SECTORS/.test(idsrc)
      && !/yield|mirage|fork|backdoor|tokenomics|anon|ponzi|rug/i.test(
        idsrc.split("export const SECTORS")[1]?.split("]")[0] ?? ""));

    // No archetype may author its own premise — that is the leak, restated.
    const files = fs.readdirSync("src/game/terminal-traders/press/archetypes")
      .map((f) => `src/game/terminal-traders/press/archetypes/${f}`);
    ok("no archetype authors its own sector",
      files.every((f) => !/\bsector\b/i.test(codeOnly(fs.readFileSync(f, "utf8")))));

    // And it must actually be uncorrelated: across many seeds, every archetype
    // has to be able to turn up on every premise. A sector that only ever
    // appears on one pattern IS the lookup table, however it got there.
    const seen = {};
    for (let s = 1; s <= 600; s++) {
      const d = instanceDeal(s);
      (seen[d.sector] ||= new Set()).add(d.archetype);
    }
    const pool = Object.keys(seen);
    ok("every sector is reachable, and each carries every archetype",
      pool.length >= 5 && pool.every((k) => seen[k].size === ARCHETYPE_IDS.length),
      pool.map((k) => `${k}:${seen[k].size}`).join(" "));
  }

  /* EVERY CLAIM OPENS WITH A FRAMING LINE, and it may not differ by branch.
     The lead is deck language, not evidence — printed above the fact so the
     point is introduced before it is argued. Authored at SLOT level, which is
     what makes the branch-independence structural; this pins that it stayed
     that way and that nobody left a slot without one. */
  {
    const missing = [];
    for (const id of ARCHETYPE_IDS) {
      for (const s of [0, 1]) {
        const d = instanceDeal(11 + s * 977, id);
        d.claims.forEach((c) => { if (!c.lead) missing.push(`${id}/${c.id}`); });
      }
    }
    ok("every claim carries a lead", missing.length === 0, missing.join(", "));

    const drift = [];
    for (const id of ARCHETYPE_IDS) {
      const rug = findDeal((d) => d.truth === 1, id);
      const legit = findDeal((d) => d.truth === 0, id);
      if (!rug || !legit) continue;
      const byId = Object.fromEntries(legit.claims.map((c) => [c.id, c.lead]));
      rug.claims.forEach((c) => {
        if (byId[c.id] !== undefined && byId[c.id] !== c.lead) drift.push(`${id}/${c.id}`);
      });
    }
    ok("a lead never differs between the branches", drift.length === 0, drift.join(", "));
  }

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

console.log("\n-- FATES: a good call can still have a bad outcome ----------");
{
  // §7 item 7 / [A§16]. Until fates.js, `legit` meant *succeeded* and §1's
  // headline — "a good decision and a bad outcome are not the same mistake" —
  // described something the game could not produce. These assertions exist to
  // stop it quietly becoming untrue again.

  // THE REGRESSION GUARD ON THE PROSE. Each archetype's own legit line must say
  // only that the CLAIMS held; what became of the venture comes from the shared
  // fate. Three of the four opened with "is still running" / "is still paying"
  // before 2026-08-03, which is exactly how `legit` came to mean succeeded.
  for (const arch of ARCHETYPE_IDS) {
    const line = ARCHETYPES[arch].RESOLUTION.legit({ name: "TESTCO", collapseDay: 57 });
    ok(`${arch}: the legit line claims nothing about survival`,
      !/still (running|paying|there|alive)|survived|thriving/i.test(line), line.slice(0, 60));
  }

  let legit = 0, failed = 0, rugWithFate = 0, noteOnRug = 0, noteOnStanding = 0;
  let paidTheCall = 0, failedTotal = 0;
  for (let seed = 1; seed <= 4000; seed++) {
    const d = instanceDeal(seed);
    if (d.truth === 1) { if (d.fate) rugWithFate++; continue; }
    legit++;
    if (d.fate?.failed) failed++;

    // The resolution must actually contain the fate's sentence — a fate that
    // rolls and is never printed is the whole feature failing silently.
    const composed = d.resolution.includes(d.fate.line(d.name));
    if (!composed) { console.log(`  FAIL fate not composed at seed ${seed}`); fail++; break; }
  }
  ok("a rug deal never carries a fate — it already has its ending", rugWithFate === 0);
  const share = failed / legit;
  ok(`legit deals fail sometimes, but not often (${(share * 100).toFixed(1)}%)`,
    share > 0.2 && share < 0.4, `${failed}/${legit}`);
  // §7 forbids modelling the real 1-in-10 survival rate: power-law payoffs end
  // properness (invariant 2). This pins the direction, not just the band.
  ok("surviving is still the common case for a legit deal", share < 0.5);

  // THE PAYOUT IS UNTOUCHED BY THE FATE. This is the assertion that matters
  // most: a fate is narration, and if it ever reaches casePnl the scoring rule
  // has stopped being proper.
  for (let seed = 1; seed <= 4000; seed++) {
    const d = instanceDeal(seed);
    if (d.truth !== 0 || !d.fate?.failed) continue;
    failedTotal++;
    let r = createRun(d);
    while (r.phase === PHASE.FLOOR) r = advance(r, d);
    r = allocate(r, d, 80); // a confident FUND
    if (r.call.pnl > 0) paidTheCall++;
    if (settlementNote(r, d) === null) { console.log(`  FAIL no note at seed ${seed}`); fail++; break; }
  }
  ok("a legit deal that FAILED still pays a confident FUND call",
    failedTotal > 0 && paidTheCall === failedTotal, `${paidTheCall}/${failedTotal}`);

  // The note is only ever the explanation of a genuine disagreement.
  for (let seed = 1; seed <= 1500; seed++) {
    const d = instanceDeal(seed);
    let r = createRun(d);
    while (r.phase === PHASE.FLOOR) r = advance(r, d);
    r = allocate(r, d, 80);
    if (d.truth === 1 && settlementNote(r, d)) noteOnRug++;
    if (d.truth === 0 && !d.fate.failed && settlementNote(r, d)) noteOnStanding++;
  }
  ok("no settlement note on a rug", noteOnRug === 0);
  ok("no settlement note when it held up AND survived", noteOnStanding === 0);
  ok("the note speaks to all three calls",
    (() => {
      const d = Array.from({ length: 4000 }, (_, i) => instanceDeal(i + 1))
        .find((x) => x.truth === 0 && x.fate?.failed);
      const at = (v) => { let r = createRun(d); while (r.phase === PHASE.FLOOR) r = advance(r, d); return settlementNote(allocate(r, d, v), d); };
      const [fund, fud, flat] = [at(80), at(-80), at(0)];
      return fund && fud && flat && new Set([fund, fud, flat]).size === 3;
    })());

  // ARCHETYPE-AGNOSTIC, like desk.js — archetypes 5-13 must cost nothing here.
  {
    const src = fs.readFileSync("src/game/terminal-traders/press/fates.js", "utf8");
    ok("fates.js names no archetype and no branch",
      !ARCHETYPE_IDS.some((id) => src.includes(`"${id}"`)) && !/\brug\b/.test(src.split("*/").pop()));
    // An IMPORT, not the word — the archetypes cite ../fates.js in a comment on
    // purpose, so that whoever next edits a legit RESOLUTION finds out why it
    // may not say "is still running".
    const files = fs.readdirSync("src/game/terminal-traders/press/archetypes");
    ok("no archetype imports fates.js — the fate layer is theirs to cite, not to use",
      files.every((f) =>
        !/^\s*import[^;]*["']\.\.\/fates(\.js)?["']/m.test(
          fs.readFileSync(`src/game/terminal-traders/press/archetypes/${f}`, "utf8"))));
    ok("the resolver does not import fates.js — it reads deal.fate and nothing more",
      !fs.readFileSync("src/game/terminal-traders/press/pressRun.js", "utf8").includes('from "./fates'));
  }

  // The fate rides its own stream, so it must not have shifted the deal rolls.
  ok("the fate roll did not disturb the deal sequence",
    instanceDeal(7, "backdoor-fork").claims.map((c) => c.id).join() ===
    instanceDeal(7, "backdoor-fork").claims.map((c) => c.id).join()
    && instanceDeal(99).ticker === instanceDeal(99).ticker);
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
