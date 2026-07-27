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

import { SHAPES, BACKING } from "../questions.js";

export const ARCHETYPE_ID = "backdoor-fork";
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

// Instances differ by surface identity so the player can't pattern-match on
// the name. Same archetype, different masks.
export const IDENTITIES = [
  { name: "MERIDIAN PROTOCOL", ticker: "$MRDN", chain: "Base", blurb: "institutional-grade onchain yield strategies" },
  { name: "HARBORLIGHT", ticker: "$HRBR", chain: "Base", blurb: "onchain treasury tools for creator collectives" },
  { name: "KEYSTONE VAULT", ticker: "$KEYS", chain: "Base", blurb: "a forked blue-chip vault with a fee rebate" },
  { name: "NORTHWIND FINANCE", ticker: "$NRTH", chain: "Base", blurb: "delta-neutral strategies for treasuries" },
  { name: "ALDERMAN", ticker: "$ALDR", chain: "Base", blurb: "permissioned lending for onchain funds" },
];

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
    shape: SHAPES.UNSOURCED,
    loadBearing: true, // the decisive thread, always free-press reachable
    fact: (v) => `Three named founders. Two with verifiable prior roles — ${v.priorA}, ${v.priorB}.`,
    spin: "These are real people with real résumés. You can look them up. That isn't nothing, that's the whole ballgame.",
    rug: {
      backing: BACKING.HARD,
      generic: {
        line: "Fine — conference talks, public github, eleven unrelated commentators citing them. Founders A and B, verified. The third one's… thinner. Ops partner. Newer, quieter.",
        receipt: { title: "FOUNDERS", rows: [["Founder A", "VERIFIED"], ["Founder B", "VERIFIED"], ["Ops partner", "THIN FOOTPRINT"], ["Direct references", "A, B ONLY"]] },
      },
      sharp: {
        line: "Named references vouch for A and B. Nobody vouches for the third one directly. I noticed that. I moved on.",
        receipt: { title: "REFERENCE CHECK", rows: [["Founder A", "VOUCHED"], ["Founder B", "VOUCHED"], ["Ops partner", "NOBODY"]] },
      },
      miss: { line: "Do I know them personally? No. I've never met them. I'm not in this because of a friendship, I'm in it because the résumés check out.", receipt: null },
    },
    legit: {
      backing: BACKING.HARD,
      generic: {
        line: "Conference talks, public github, eleven unrelated commentators. All three, including the ops partner — he's quieter but he's vouched for by two of the seed funds directly.",
        receipt: { title: "FOUNDERS", rows: [["Founder A", "VERIFIED"], ["Founder B", "VERIFIED"], ["Ops partner", "VERIFIED"], ["Direct references", "ALL THREE"]] },
      },
      sharp: {
        line: "Every one of them has someone putting their name next to his. That's rarer than you'd think and it's the reason I'm in.",
        receipt: { title: "REFERENCE CHECK", rows: [["Founder A", "VOUCHED"], ["Founder B", "VOUCHED"], ["Ops partner", "VOUCHED ×2"]] },
      },
      miss: { line: "Do I know them personally? No. I've never met them. That's not how this works.", receipt: null },
    },
  },

  {
    id: "audit",
    shape: SHAPES.BORROWED_CREDIBILITY,
    loadBearing: false,
    fact: (v) => `${v.auditor}. The audit came back clean.`,
    spin: "Gold-standard firm, clean report. What more do you want, a notarised prophecy?",
    rug: {
      backing: BACKING.SOFT,
      generic: {
        line: "Clean within scope. Scope's in the report, section one point three. I didn't read section one point three.",
        receipt: { title: "AUDIT", partial: true, rows: [["Finding", "CLEAN — IN SCOPE"], ["Scope boundary", "NOT READ"]] },
      },
      // THE ESCALATION — the only press that moves your call on a rug.
      sharp: {
        line: "…Section one point three. Fine. Strategy contracts in. Vault accounting in. Fee router in. Governance in. Proxy admin slot — out of scope. Upgrade path — not reviewed. That's what clean meant.",
        receipt: { title: "AUDIT SCOPE", rows: [["Strategy contracts", "IN"], ["Vault accounting", "IN"], ["Fee router", "IN"], ["Governance module", "IN"], ["Proxy admin slot", "OUT"], ["Upgrade path", "NOT REVIEWED"]] },
      },
      miss: { line: "It's a real firm. You want the PDF? I'll send you the PDF right now.", receipt: { title: "AUDITOR", rows: [["Report", "PUBLISHED"]] } },
    },
    legit: {
      backing: BACKING.HARD,
      generic: {
        line: "Clean, and I did read the scope this time. Everything's in it — including the upgrade path, which is the bit people forget to check.",
        receipt: { title: "AUDIT SCOPE", rows: [["Strategy contracts", "IN"], ["Vault accounting", "IN"], ["Governance module", "IN"], ["Proxy admin slot", "IN"], ["Upgrade path", "IN"]] },
      },
      sharp: {
        line: "Whole surface. Proxy admin in scope, upgrade path in scope, no carve-outs. That's the part I'd have led with if I were smarter.",
        receipt: { title: "SCOPE CARVE-OUTS", rows: [["Excluded items", "NONE"]] },
      },
      miss: { line: "It's a real firm. You want the PDF? I'll send you the PDF right now.", receipt: { title: "AUDITOR", rows: [["Report", "PUBLISHED"]] } },
    },
  },

  {
    id: "funding",
    shape: SHAPES.UNSOURCED,
    loadBearing: false,
    fact: (v) => `$${v.seed}M seed. Named funds. Multisig treasury. Zero mixer hops.`,
    spin: "Smart money already did this diligence for you. You're free-riding on their lawyers.",
    // Clean in BOTH branches. Not every press is a gotcha — if pressing always
    // found rot, pressing would stop being a decision worth making.
    rug: {
      backing: BACKING.HARD,
      generic: { line: "Three funds, all named, all reachable. Three-of-five treasury multisig. Zero mixer hops, and I did check that one.", receipt: { title: "FUNDING", rows: [["Seed", "3 NAMED FUNDS"], ["Treasury", "3/5 MULTISIG"], ["Mixer hops", "0"]] } },
      sharp: { line: "Traced it myself, which I don't do often. Seed to treasury, treasury to LP. No hops, no bridges. This part is genuinely fine.", receipt: { title: "FUND TRACE", rows: [["Seed → treasury", "DIRECT"], ["Anomalies", "NONE"]] } },
      miss: { line: "Three funds. I can spell all three. That's not the interesting part and you know it.", receipt: null },
    },
    legit: {
      backing: BACKING.HARD,
      generic: { line: "Three funds, all named, all reachable. Three-of-five treasury multisig. Zero mixer hops, and I did check that one.", receipt: { title: "FUNDING", rows: [["Seed", "3 NAMED FUNDS"], ["Treasury", "3/5 MULTISIG"], ["Mixer hops", "0"]] } },
      sharp: { line: "Traced it myself. Seed to treasury, treasury to LP. No hops, no bridges. This part is genuinely fine.", receipt: { title: "FUND TRACE", rows: [["Seed → treasury", "DIRECT"], ["Anomalies", "NONE"]] } },
      miss: { line: "Three funds. I can spell all three. That's not the interesting part and you know it.", receipt: null },
    },
  },

  {
    id: "chart",
    shape: SHAPES.SELECTIVE_WINDOW,
    loadBearing: false,
    fact: (v) => `Up ${v.pump} percent in seven days.`,
    spin: "It's working. The market has already voted and you're still reading.",
    // Hollow either way — a cherry-picked window is a cherry-picked window even
    // when the token is fine. Good tokens are sold badly too.
    rug: {
      backing: BACKING.VIBES,
      generic: { line: "Look at the candles! What do you want me to do, apologise for it?", receipt: null },
      sharp: { line: "Seven days because seven days is the number that looks like something. Don't make me pull thirty.", receipt: null },
      miss: { line: "Am I holding? Obviously I'm holding, it's my deal. That's not a scandal, that's alignment.", receipt: null },
    },
    legit: {
      backing: BACKING.VIBES,
      generic: { line: "Look at the candles! What do you want me to do, apologise for it?", receipt: null },
      sharp: { line: "Seven days because seven days is the number that looks like something. Thirty's flatter. It's still a good book.", receipt: null },
      miss: { line: "Am I holding? Obviously I'm holding, it's my deal. That's not a scandal, that's alignment.", receipt: null },
    },
  },

  {
    id: "timelock",
    shape: SHAPES.UNFALSIFIABLE,
    loadBearing: false,
    fact: "Three-of-five multisig on governance. Twenty-four hour timelock on parameter changes.",
    spin: "Nobody can pull anything. There's a timelock. You'd see it coming a day out.",
    rug: {
      backing: BACKING.VIBES,
      generic: { line: "It's timelocked. Twenty-four hours. That's — look, that's what a timelock is for.", receipt: null },
      sharp: { line: "What would change my mind? What kind of question is that? Nothing. Nothing would. It's timelocked.", receipt: null },
      miss: { line: "Twenty-four hours. It's twenty-four. I can read a number off a page.", receipt: { title: "TIMELOCK", rows: [["Delay", "24H"], ["Covers", "—"]] } },
    },
    legit: {
      backing: BACKING.HARD,
      generic: { line: "Twenty-four hours, and it covers the upgrade path as well as parameters. Which is the question you were about to ask.", receipt: { title: "TIMELOCK", rows: [["Delay", "24H"], ["Covers", "PARAMS + UPGRADE"]] } },
      sharp: { line: "What would change my mind? An upgrade landing without the delay. It can't, and I've watched for it.", receipt: { title: "UPGRADE GUARD", rows: [["Bypass path", "NONE FOUND"]] } },
      miss: { line: "Twenty-four hours. It's twenty-four. I can read a number off a page.", receipt: { title: "TIMELOCK", rows: [["Delay", "24H"]] } },
    },
  },

  {
    id: "ops",
    shape: SHAPES.SURVIVORSHIP,
    loadBearing: false,
    fact: "One of them co-launched something earlier that wound down.",
    spin: "Everybody's got a graveyard behind them. Around here we call that experience.",
    rug: {
      backing: BACKING.VIBES,
      generic: { line: "I don't— it wound down. Quietly. No blow-up, no thread, nobody made noise. That's the whole story as far as anyone's written it.", receipt: null },
      // The best black monitor in the deck: a matched press proves the absence
      // is STRUCTURAL. There is no post-mortem, which is why it's still walking.
      sharp: { line: "The one that wound down. Right. There's no post-mortem. Nobody wrote it up, nobody asked, there is genuinely nothing to read. …Which I'm now hearing out loud.", receipt: null },
      miss: { line: "He's a real person, if that's what you're asking. Lives in Lisbon. I've had dinner with him.", receipt: null },
    },
    legit: {
      backing: BACKING.HARD,
      generic: { line: "It wound down and they wrote it up — full post-mortem, returned what was left to depositors. You can read it. I did.", receipt: { title: "PRIOR OUTCOME", rows: [["Post-mortem", "PUBLISHED"], ["Depositors", "MADE WHOLE"]] } },
      sharp: { line: "Every project he's touched has an ending you can go read. That's the opposite of the thing you're worried about.", receipt: { title: "PRIOR OUTCOMES", rows: [["Projects", "2"], ["Unexplained exits", "0"]] } },
      miss: { line: "He's a real person, if that's what you're asking. Lives in Lisbon. I've had dinner with him.", receipt: null },
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
  shape: SHAPES.POSITIONED,
  loadBearing: false,
  fact: "I'm in this myself. Same terms as you'd get.",
  spin: "I don't pitch what I don't hold. That should tell you everything.",
  rug: {
    // He IS positioned — that's true. What he won't tell you is the shape of
    // it, which is the part that would actually inform you.
    backing: BACKING.VIBES,
    generic: { line: "I'm in. Obviously I'm in. You think I'd bring you something I wasn't in?", receipt: null },
    sharp: { line: "How much and since when? …Enough. Early. Look, my size isn't the story here, the protocol is the story.", receipt: null },
    miss: { line: "Am I— it's a real position, it's onchain, you could go and look it up yourself if you cared to.", receipt: null },
  },
  legit: {
    backing: BACKING.HARD,
    generic: { line: "In since the seed, same lockup as the funds, and I can't sell before you can. That's the point of telling you.", receipt: { title: "HIS POSITION", rows: [["Entry", "SEED ROUND"], ["Lockup", "SAME AS FUNDS"], ["Can exit first", "NO"]] } },
    sharp: { line: "Size, entry, unlock date — all of it's onchain and none of it lets me out ahead of you. Go and check.", receipt: { title: "ALIGNMENT", rows: [["Unlock", "AFTER PUBLIC"], ["Early exit path", "NONE"]] } },
    miss: { line: "Am I— it's a real position, it's onchain, you could go and look it up yourself if you cared to.", receipt: null },
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
