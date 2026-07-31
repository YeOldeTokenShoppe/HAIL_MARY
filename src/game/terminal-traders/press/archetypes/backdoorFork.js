// ARCHETYPE — "backdoor-fork": honest-looking fork with a latent admin door.
//
// One of the 13 reads in CASE_PATTERNS (cards.js). The coin BlackPalm already
// carries it as a solved dossier: "Forked a blue-chip vault and kept one key
// nobody audited. Drained day 40." MERIDIAN is the same shape.
//
// WHY THIS FILE EXISTS (layer 1, 2026-07-26): the hand-written deal had
// `truth: 1` as a constant, so it was memorisable after two plays — the exact
// "puzzle box, not a game" failure CASE_TABLE.md §10 names. An archetype keeps
// the AUTHORED PROSE (the thing that makes MERIDIAN good) and moves only the
// ground truth, so a session is never a lookup.
//
// THE SHAPE OF THE IDEA
//   • SEVEN claim slots exist; each instance plays SIX (see instanceDeal), so
//     which question shapes are live shifts day to day. The facts he states
//     are fixed — only what he can BACK moves.
//   • The rolled OUTCOME decides which slots are hollow when you press them.
//     A backdoor-fork rug hides an out-of-scope upgrade path and an unexamined
//     prior wind-down. The same protocol, run honestly, has both — audited and
//     written up. Same question, different answer.
//   • EXCEPTION RATE is load-bearing, not flavour. A backdoor-fork-shaped token
//     is usually a rug and sometimes genuinely fine. That is what makes the
//     confidence slider meaningful: a perfect read still shouldn't go to 1.0,
//     because the archetype itself is probabilistic. Remove the exception rate
//     and correct play collapses to binary, and calibration stops being a skill.

import { SHAPES, BACKING, LANES } from "../questions.js";

export const ARCHETYPE_ID = "backdoor-fork";
// WHAT THE PLAYER IS TOLD IT'S CALLED. The id is a code slug — kebab-case,
// fine in a file, and it was leaking straight onto the post-deal screen next to
// a ticker. Naming the pattern is the teaching payload of this whole game, so
// the name has to be plain English and has to describe the MECHANISM, because
// that is the thing that transfers to the next token. (Invariant 6, same catch
// as "the tape".)
export const ARCHETYPE_LABEL = "THE DOOR NOBODY AUDITED";
// THE TELL — the transferable half, and the whole teaching payload of the
// post-deal screen. It replaced a reference to the exemplar COIN, which named a
// second token the player had never met: *"why reference a different project?"*
// (author, 2026-07-28). They just spent four minutes with a concrete case of
// their own; a stranger's is redundant and competes with the one they actually
// have investment in. What they can't get from their own deal is the rule that
// generalises to the next one, which is this.
export const ARCHETYPE_TELL =
  "The audit is real. Ask what it covered, and the answer stops just short of "
  + "the part that can move the money.";
// The Genesis coin that IS this read — its dossier is the canonical example.
// Per CASE_TABLE.md §10.2 the coin defines the ARCHETYPE; a deal is a fresh
// token instantiated from it, so the coin's own `caseRef.outcome` is lore, NOT
// this instance's ground truth. That distinction is what stops the pattern
// library from becoming a lookup table.
export const EXEMPLAR_COIN = "blackpalm";

// Rolled per instance. Tuned so a good reader is well rewarded but never safe.
export const OUTCOMES = [
  { outcome: "rug", truth: 1, weight: 74 },
  { outcome: "legit", truth: 0, weight: 26 },
];

// IDENTITIES MOVED TO ../identities.js (2026-07-28). They were authored here,
// per archetype, with zero overlap between the lists — which made the deal's
// NAME a perfect predictor of its archetype, and therefore of its base rate.
// Harmless while every archetype was ~70% rug; fatal the moment anon-but-real
// landed at 70% legit. The pool is shared now and the name tells you nothing.

export const AUDITORS = ["Trail of Bits", "Spearbit", "OpenZeppelin", "Zellic"];
export const PRIORS = ["ex-Aave", "ex-MakerDAO", "ex-Compound", "ex-Lido"];

// ---------------------------------------------------------------------------
// The claim slots. `fact`/`spin` never change — Barron says true things and
// sells an inference. Only `rug` / `legit` differ, and they differ in what he
// can PRODUCE when pressed. That's the whole mechanism.
// ---------------------------------------------------------------------------
export const SLOTS = [
  {
    id: "team",
    lane: LANES.SOCIAL,
    subject: "THE TEAM",
    shape: SHAPES.UNSOURCED,
    loadBearing: true, // the decisive thread, always free-press reachable
    fact: (v) => `Three named founders. Two with verifiable prior roles — ${v.priorA}, ${v.priorB}.`,
    spin: "These are real people with real résumés. You can look them up. That isn't nothing, that's the whole ballgame.",
    // backing is slot-level: identical in both branches by construction.
    backing: BACKING.HARD,
    rug: {
      generic: {
        line: "Fine — conference talks, public github, eleven unrelated commentators citing them. Founders A and B, verified. The third one's… thinner. Ops partner. Newer, quieter.",
        receipt: { title: "FOUNDERS", rows: [["Founder A", "VERIFIED"], ["Founder B", "VERIFIED"], ["Ops partner", "THIN FOOTPRINT"], ["Direct references", "A, B ONLY"]] },
      },
      sharp: {
        line: "Named references vouch for A and B. Nobody vouches for the third one directly. I noticed that. I moved on.",
        receipt: { title: "REFERENCE CHECK", rows: [["Founder A", "VOUCHED"], ["Founder B", "VOUCHED"], ["Ops partner", "NOBODY"]] },
      },
    },
    legit: {
      generic: {
        line: "Conference talks, public github, eleven unrelated commentators. All three, including the ops partner — he's quieter but he's vouched for by two of the seed funds directly.",
        receipt: { title: "FOUNDERS", rows: [["Founder A", "VERIFIED"], ["Founder B", "VERIFIED"], ["Ops partner", "VERIFIED"], ["Direct references", "ALL THREE"]] },
      },
      sharp: {
        line: "Every one of them has someone putting their name next to his. That's rarer than you'd think and it's the reason I'm in.",
        receipt: { title: "REFERENCE CHECK", rows: [["Founder A", "VOUCHED"], ["Founder B", "VOUCHED"], ["Ops partner", "VOUCHED ×2"]] },
      },
    },
  },

  {
    id: "audit",
    lane: LANES.RECORD,
    subject: "THE AUDIT",
    shape: SHAPES.BORROWED_CREDIBILITY,
    loadBearing: false,
    fact: (v) => `${v.auditor}. The audit came back clean.`,
    spin: "Gold-standard firm, clean report. What more do you want, a notarised prophecy?",
    // BACKING IS SLOT-LEVEL. A claim either has a receipt to be had or it
    // does not; that is a property of the claim, not of whether the deal is
    // rotten. Authored per branch it WAS the leak: resolvePress zeroes every
    // receipt on VIBES, so a VIBES-in-rug slot returned nothing to anyone.
    backing: BACKING.HARD,
    // THE SELLER'S SCRIPT, hoisted to the slot so it CANNOT differ by branch.
    // Confident, technically true, and stopping exactly short of the question
    // that would settle it. Only a loadBearing slot may keep this per-branch.
    generic: {
      line: "Clean. Page one, no criticals, no highs, gold-standard firm. Clean within scope — which is what every audit ever written says, it's the standard sentence, don't read a face into it. Scope's section one point three. The finding is the finding.",
      receipt: { title: "AUDIT REPORT", rows: [["Finding", "CLEAN — IN SCOPE"], ["Criticals / highs", "0 / 0"], ["Report", "PUBLISHED"], ["Scope defined in", "SECTION 1.3"]] },
    },
    rug: {
      // THE ESCALATION — the only press that moves your call on a rug.
      sharp: {
        line: "…Section one point three. Fine, you read it, congratulations. Strategy contracts in, vault accounting in, fee router in, governance in. Proxy admin slot's out. Upgrade path wasn't reviewed. Clean is still clean. It's clean of what they were asked to look at.",
        receipt: { title: "AUDIT SCOPE", rows: [["Core contracts", "IN"], ["Proxy admin slot", "OUT"], ["Upgrade path", "NOT REVIEWED"], ["Carve-outs", "2"]] },
      },
    },
    legit: {
      sharp: {
        line: "Section one point three, since we're all reading together now. Strategy, vault, fee router, governance — in. Proxy admin slot, in. Upgrade path, in. Nothing carved out, not one line. That's the part I'd have led with if I were smarter.",
        receipt: { title: "AUDIT SCOPE", rows: [["Core contracts", "IN"], ["Proxy admin slot", "IN"], ["Upgrade path", "IN"], ["Carve-outs", "NONE"]] },
      },
    },
  },

  {
    id: "funding",
    lane: LANES.CHAIN,
    subject: "THE MONEY",
    shape: SHAPES.UNSOURCED,
    loadBearing: false,
    fact: (v) => `$${v.seed}M seed. Named funds. Multisig treasury. Zero mixer hops.`,
    spin: "Smart money already did this diligence for you. You're free-riding on their lawyers.",
    // Clean in BOTH branches. Not every press is a gotcha — if pressing always
    // found rot, pressing would stop being a decision worth making.
    // backing is slot-level: identical in both branches by construction.
    backing: BACKING.HARD,
    rug: {
      generic: { line: "Three funds, all named, all reachable. Three-of-five treasury multisig. Zero mixer hops, and I did check that one.", receipt: { title: "FUNDING", rows: [["Seed", "3 NAMED FUNDS"], ["Treasury", "3/5 MULTISIG"], ["Mixer hops", "0"]] } },
      sharp: { line: "Traced it myself, which I don't do often. Seed to treasury, treasury to LP. No hops, no bridges. This part is genuinely fine.", receipt: { title: "FUND TRACE", rows: [["Seed → treasury", "DIRECT"], ["Anomalies", "NONE"]] } },
    },
    legit: {
      generic: { line: "Three funds, all named, all reachable. Three-of-five treasury multisig. Zero mixer hops, and I did check that one.", receipt: { title: "FUNDING", rows: [["Seed", "3 NAMED FUNDS"], ["Treasury", "3/5 MULTISIG"], ["Mixer hops", "0"]] } },
      sharp: { line: "Traced it myself. Seed to treasury, treasury to LP. No hops, no bridges. This part is genuinely fine.", receipt: { title: "FUND TRACE", rows: [["Seed → treasury", "DIRECT"], ["Anomalies", "NONE"]] } },
    },
  },

  {
    id: "chart",
    lane: LANES.CHART,
    subject: "THE CHART",
    shape: SHAPES.SELECTIVE_WINDOW,
    loadBearing: false,
    fact: (v) => `Up ${v.pump} percent in seven days.`,
    spin: "It's working. The market has already voted and you're still reading.",
    // Hollow either way — a cherry-picked window is a cherry-picked window even
    // when the token is fine. Good tokens are sold badly too.
    // backing is slot-level: identical in both branches by construction.
    backing: BACKING.VIBES,
    rug: {
      generic: { line: "Look at the candles! What do you want me to do, apologise for it?", receipt: null },
      sharp: { line: "Seven days because seven days is the number that looks like something. Don't make me pull thirty.", receipt: null },
    },
    legit: {
      generic: { line: "Look at the candles! What do you want me to do, apologise for it?", receipt: null },
      sharp: { line: "Seven days because seven days is the number that looks like something. Thirty's flatter. It's still a good book.", receipt: null },
    },
  },

  {
    id: "timelock",
    lane: LANES.CHAIN,
    subject: "THE TIMELOCK",
    shape: SHAPES.UNFALSIFIABLE,
    loadBearing: false,
    fact: "Three-of-five multisig on governance. Twenty-four hour timelock on parameter changes.",
    spin: "Nobody can pull anything. There's a timelock. You'd see it coming a day out.",
    // BACKING IS SLOT-LEVEL. A claim either has a receipt to be had or it
    // does not; that is a property of the claim, not of whether the deal is
    // rotten. Authored per branch it WAS the leak: resolvePress zeroes every
    // receipt on VIBES, so a VIBES-in-rug slot returned nothing to anyone.
    backing: BACKING.HARD,
    // THE SELLER'S SCRIPT, hoisted to the slot so it CANNOT differ by branch.
    // Confident, technically true, and stopping exactly short of the question
    // that would settle it. Only a loadBearing slot may keep this per-branch.
    generic: {
      line: "It's timelocked. Twenty-four hours, onchain, and the queue is public — you can sit and watch a pending change age without taking my word for any of it. That's a parameter, not a promise.",
      receipt: { title: "TIMELOCK", rows: [["Delay", "24H"], ["Contract", "ONCHAIN"], ["Pending queue", "PUBLIC"]] },
    },
    rug: {
      // THE ESCALATION — the only press that moves your call on a rug.
      sharp: {
        line: "Alright — the delay covers parameter changes. The proxy admin is a separate role, it doesn't queue, it was never built to queue. Twenty-four hours is still twenty-four hours on everything I said it was.",
        receipt: { title: "TIMELOCK SCOPE", rows: [["Parameter changes", "DELAYED 24H"], ["Proxy admin slot", "NO DELAY"], ["Upgrade call", "EXECUTES SAME BLOCK"]] },
      },
    },
    legit: {
      sharp: {
        line: "Alright — pull the whole role list, go on. Parameters queue. Upgrades queue. The admin slot is owned by the timelock itself, so there's nothing on that contract that lands same-block. You could have opened with that question.",
        receipt: { title: "TIMELOCK SCOPE", rows: [["Parameter changes", "DELAYED 24H"], ["Upgrade call", "DELAYED 24H"], ["Proxy admin owner", "TIMELOCK"], ["Bypass roles", "NONE"]] },
      },
    },
  },

  {
    id: "ops",
    lane: LANES.RECORD,
    subject: "TRACK RECORD",
    shape: SHAPES.SURVIVORSHIP,
    loadBearing: false,
    fact: "One of them co-launched something earlier that wound down.",
    spin: "Everybody's got a graveyard behind them. Around here we call that experience.",
    // BACKING IS SLOT-LEVEL. A claim either has a receipt to be had or it
    // does not; that is a property of the claim, not of whether the deal is
    // rotten. Authored per branch it WAS the leak: resolvePress zeroes every
    // receipt on VIBES, so a VIBES-in-rug slot returned nothing to anyone.
    backing: BACKING.HARD,
    // THE SELLER'S SCRIPT, hoisted to the slot so it CANNOT differ by branch.
    // Confident, technically true, and stopping exactly short of the question
    // that would settle it. Only a loadBearing slot may keep this per-branch.
    generic: {
      line: "The earlier one. Yes — it wound down. Quietly. There's a notice, there's a date, positions closed. No blow-up, no thread, nobody chasing anybody across the internet. If it were a story you'd have heard the story.",
      receipt: { title: "PRIOR PROJECT", rows: [["Status", "WOUND DOWN"], ["Wind-down notice", "PUBLIC, DATED"], ["Public dispute", "NONE FILED"]] },
    },
    rug: {
      // THE ESCALATION — the only press that moves your call on a rug.
      sharp: {
        line: "The post-mortem. That's what you went digging for. There isn't one — nobody filed it, nobody asked for it, and the depositor side of the ledger just stops mid-page. That's not a finding, that's a gap. …It's a loud gap, I'll give you that.",
        // NULL ON PURPOSE — this is the NOTHING ON FILE beat. A specialist went
        // and looked and found a proven absence, which is strictly stronger than
        // a board staying dark and is the only way this game can prove a negative.
        // It still discriminates: the legit branch returns a real receipt here.
        receipt: null,
      },
    },
    legit: {
      sharp: {
        line: "The post-mortem, fine — it's published. Nine days after the notice, signed, balances in an appendix, depositors paid out before the wallets closed. Go and read it. It's dull. That's the nicest thing I can say about an ending.",
        receipt: { title: "PRIOR WIND-DOWN", rows: [["Post-mortem", "PUBLISHED — 9 DAYS"], ["Depositors", "REPAID IN FULL"], ["Final balances", "SIGNED APPENDIX"], ["Unexplained exits", "0"]] },
      },
    },
  },
];

// SEVEN slots, six played per instance (see instanceDeal). Two reasons:
//   1. Which questions are LIVE varies by day, so no card in the pool is
//      permanently dead. Insider Ping was whiffing on every single seed before
//      this slot existed, and a reliably-useless card is worse than none.
//   2. It varies the session even when the outcome repeats.
SLOTS.push({
  id: "stake",
    lane: LANES.CHAIN,
    subject: "HIS POSITION",
  shape: SHAPES.POSITIONED,
  loadBearing: false,
  // "Same terms as you'd get" pre-answered the question the deep look exists to
  // settle, and was false in the rug branch. The FACT may only assert what the
  // seller's shared script asserts; alignment is the INFERENCE being sold.
  fact: "I'm in this myself. Entered at the seed, at the price the funds paid.",
  spin: "I don't pitch what I don't hold. That should tell you everything.",
  // BACKING IS SLOT-LEVEL. A claim either has a receipt to be had or it
  // does not; that is a property of the claim, not of whether the deal is
  // rotten. Authored per branch it WAS the leak: resolvePress zeroes every
  // receipt on VIBES, so a VIBES-in-rug slot returned nothing to anyone.
  backing: BACKING.HARD,
  // THE SELLER'S SCRIPT, hoisted to the slot so it CANNOT differ by branch.
  // Confident, technically true, and stopping exactly short of the question
  // that would settle it. Only a loadBearing slot may keep this per-branch.
  generic: {
    line: "I'm in. Since the seed, at the price the funds paid. It's onchain, it's got a name on it, go and pull the entry block yourself — I'll wait. I don't pitch what I'm not standing in.",
    receipt: { title: "HIS POSITION", rows: [["Entry", "SEED ROUND"], ["Price paid", "SAME AS FUNDS"], ["Wallet", "PUBLIC ONCHAIN"]] },
  },
  rug: {
    // THE ESCALATION — the only press that moves your call on a rug.
    sharp: {
      line: "She pulled the vesting contract. Fine — my allocation sits on its own schedule. Thirty-day cliff on mine, twelve months on the funds'. That is how placement gets paid, that is standard, and it is not the story here.",
      receipt: { title: "UNLOCK SCHEDULE", rows: [["His tranche", "SEPARATE CONTRACT"], ["His cliff", "DAY 30"], ["Fund lockup", "12 MONTHS"], ["Can exit first", "YES"]] },
    },
  },
  legit: {
    sharp: {
      line: "She pulled the vesting contract. Good — one schedule, mine sitting inside it with the funds'. Twelve months, no cliff of my own, no side letter. I get out after you or I don't get out. I'd have led with it if I thought you'd take my word for it.",
      receipt: { title: "UNLOCK SCHEDULE", rows: [["His tranche", "SAME CONTRACT"], ["His cliff", "NONE"], ["Fund lockup", "12 MONTHS"], ["Can exit first", "NO"]] },
    },
  },
});

export const AUTOPSY = {
  rug: {
    team: "TRUE — and the caveat you pulled out of him was the thread.",
    stake: "TRUE — he was in. He just wouldn't say how far in, or when he could leave.",
    audit: "TRUE, BUT IT DOESN'T ANSWER THE QUESTION — the scope excluded the upgrade path.",
    funding: "TRUE. The money was real and clean. It usually is.",
    chart: "SHADED — seven days chosen because seven days looked good.",
    timelock: "TRUE, BUT IT DOESN'T ANSWER THE QUESTION — the timelock never covered the upgrade path.",
    ops: "SHADED — the wind-down was never examined, and that was the point.",
  },
  legit: {
    team: "TRUE — all three, and the references held.",
    stake: "TRUE — and locked behind you, which is the version of that claim that means something.",
    audit: "TRUE — and this time the scope actually covered the door.",
    funding: "TRUE. The money was real and clean.",
    chart: "SHADED — a cherry-picked window. Good tokens get sold badly too.",
    timelock: "TRUE — and it covered the upgrade path, which is the part that matters.",
    ops: "TRUE — the failure was written up. A published post-mortem is a green flag.",
  },
};

export const RESOLUTION = {
  rug: (v) => `${v.name} drained on day ${v.collapseDay} through the upgrade path the audit never covered. The ops partner's hot wallet was seeded, two hops, by the exit wallet of the project that quietly wound down.`,
  legit: (v) => `${v.name} is still running. The upgrade path was audited, the prior failure was public, and the boring answer was the right one. Not every fork is a trapdoor.`,
};
