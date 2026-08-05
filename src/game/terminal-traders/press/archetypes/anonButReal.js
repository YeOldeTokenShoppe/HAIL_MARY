// ANON-BUT-REAL — the third archetype, and the first one that is USUALLY FINE.
//
// WHY THIS ONE, AND WHY NOW. With only backdoor-fork (74% rug) and yield-mirage
// (68% rug), RECOGNISING THE ARCHETYPE WAS WORTH ALMOST NOTHING — and that is a
// game whose stated skill doesn't pay. Measured in expected P&L per deal, over
// 8000 seeds:
//
//                       base    blind (reports    knows the      EDGE FROM
//                       rate    the base rate)    archetype      RECOGNITION
//     2 archetypes      71.5%       +4.61           +4.71           +0.10
//     3 archetypes      57.3%       +0.54           +4.62           +4.08
//
// A fortieth of a point, against four. This one runs 70% LEGIT — the inverse of
// the other two — so identifying it swings your prior ~44 points instead of the
// six that separated 74 from 68. It is what turns the archetype collection from
// a completion set into a set of PRIORS you actually hold.
//
// Note the other column: blind play got WORSE, 4.61 -> 0.54. A lopsided world
// is easy to score in once you know it's lopsided. So this made the game harder
// for the uninformed and more rewarding for the informed at the same time.
//
// A CORRECTION WORTH KEEPING, because it is an easy mistake to make twice: the
// original argument for this archetype was "blind SHORT is correct on 71% of
// deals". That is a HIT RATE, and hit rate is not the score. `casePnl` is an
// affine transform of Brier, so always-short-with-conviction earns **-16.83**
// per deal — the worst strategy available, not an exploit. Under a proper
// scoring rule, being directionally right most of the time is worth almost
// nothing if you can't say how confident to be. Measure expected P&L, never
// how often a heuristic points the right way.
//
// Two things the old argument got right for the wrong reason, and they still
// hold: the dominant heuristic was "be suspicious", which is a bad lesson; and
// the LONG side of the slider had no archetype where it was confidently correct.
//
// THE SHAPE. Everything alarming about it is on the surface: nobody is named,
// the founders are handles, the résumés are claimed rather than shown. Every
// alarming thing also has a verifiable answer underneath, and pressing produces
// it. The 30% rug is the case where the anonymity is doing real work — the
// handles are new, and the people vouching for them are each other.
//
// THE TELL IS THE INVERSION, and it is the thing worth learning here:
// anonymity is not evidence. Unverifiability is. Two teams can both decline to
// give you names and be in completely different businesses.
//
// AUTHORING NOTES, inherited from the other two:
//   - `backing` is SLOT-LEVEL and never per-branch. A claim either has a
//     receipt to be had or it doesn't; that's a property of the claim. (§8)
//   - `generic` is hoisted to the slot so the seller's shallow answer CANNOT
//     differ by branch. Only the loadBearing slot keeps a per-branch generic,
//     because invariant 1 requires it stay reachable on a free press.
//   - `vouch` carries a NULL sharp receipt in the rug branch only. That is what
//     produces NOTHING ON FILE, the one way this game proves a negative, and it
//     is legitimate precisely because the hoisted generic still answers.
//
// LANE BUDGET: SOCIAL x2, CHAIN x2, RECORD x2, CHART x1. Seven slots, six
// played. CHART is a single-slot lane so the mustKeep guard pins it; the drop
// always comes out of a lane that has two, so no specialist is ever left
// without a deep target and at least two lanes always keep a real choice.

import { SHAPES, BACKING, LANES } from "../questions.js";

export const ARCHETYPE_ID = "anon-but-real";
export const ARCHETYPE_LABEL = "NO NAMES, BUT RECEIPTS";
// The transferable half. Deliberately phrased as a correction, because the
// player arrives at this one already primed to short it.
export const ARCHETYPE_TELL =
  "Anonymous is not the tell — unverifiable is. Stop asking who they are and "
  + "start asking what can be checked without them.";

// 70/30. The inverse of the other two, and the reason the slider's LONG side
// finally means something. Still not deterministic: an anon team IS sometimes
// exactly what you feared, and a read that goes to 100% is a read that has
// stopped being calibrated.
export const OUTCOMES = [
  { outcome: "legit", truth: 0, weight: 70 },
  { outcome: "rug", truth: 1, weight: 30 },
];

// IDENTITIES MOVED TO ../identities.js (2026-07-28). They were authored here,
// per archetype, with zero overlap between the lists — which made the deal's
// NAME a perfect predictor of its archetype, and therefore of its base rate.
// Harmless while every archetype was ~70% rug; fatal the moment anon-but-real
// landed at 70% legit. The pool is shared now and the name tells you nothing.

// PRIORS AND AUDITORS WENT THE SAME WAY (2026-08-03), and for the same reason.
// They were still authored per archetype, and yield-mirage's list was DISJOINT
// from the other two's — trading desks there, protocols here — so a prior role
// in the deal sheet identified the archetype outright. The identity fix of
// 2026-07-28 simply had not been carried through to the other visible pool.
// Both are shared now; see ../identities.js.
export { PRIORS, AUDITORS } from "../identities.js";

export const SLOTS = [
  {
    id: "handles",
    lane: LANES.SOCIAL,
    subject: "THE TEAM",
    shape: SHAPES.UNSOURCED,
    loadBearing: true, // the decisive thread, always free-press reachable
    lead: "The team is the first thing you'll want to push on, so let me lead with it.",
    fact: (v) => `Three founders, all pseudonymous. Two claim prior roles — ${v.priorA}, ${v.priorB}. Neither is verifiable by name.`,
    spin: "Half of everything you use was built by people you can't name. Anon isn't a red flag any more, it's Tuesday. Judge the work.",
    backing: BACKING.HARD,
    legit: {
      // Per-branch generic is legal ONLY here: invariant 1 requires the
      // decisive claim stay reachable on a free press, so it must discriminate.
      generic: {
        line: "The handles are old. Years old, continuous, same voice, same repos, commit history you can walk back to 2021. I can't tell you their names because I don't know their names. I can tell you those accounts have been the same three people for four years.",
        receipt: { title: "HANDLE HISTORY", rows: [["Oldest handle", "4Y 2M"], ["Newest handle", "3Y 7M"], ["Continuity gaps", "NONE"], ["Named identity", "UNKNOWN"]] },
      },
      sharp: {
        line: "He's right and it's checkable. Four years of continuous history on all three, and — this is the part he undersold — two of the seed funds will put their own names next to the handles. They know who these people are. They're just not the ones telling you.",
        receipt: { title: "HANDLE HISTORY", rows: [["Oldest handle", "4Y 2M"], ["Continuity gaps", "NONE"], ["Named backers vouching", "2 FUNDS"], ["Identity known to", "INVESTORS"]] },
      },
    },
    rug: {
      generic: {
        line: "The handles are established. Active, posting, shipping. Look, I'm not going to pretend I've had a video call with them — nobody has. But the accounts are real accounts and the code is real code.",
        receipt: { title: "HANDLE HISTORY", rows: [["Oldest handle", "7 MONTHS"], ["Newest handle", "4 MONTHS"], ["Continuity gaps", "2"], ["Named identity", "UNKNOWN"]] },
      },
      sharp: {
        line: "Seven months on the oldest one. And the prior-role claims trace to exactly one source: the handles themselves, in their own launch thread. Nobody who was actually at those places has ever confirmed it.",
        receipt: { title: "HANDLE HISTORY", rows: [["Oldest handle", "7 MONTHS"], ["Continuity gaps", "2"], ["Prior roles confirmed by", "NOBODY"], ["Source of claim", "SELF"]] },
      },
    },
  },

  {
    id: "vouch",
    lane: LANES.SOCIAL,
    subject: "WHO BACKS THEM",
    shape: SHAPES.BORROWED_CREDIBILITY,
    loadBearing: false,
    lead: "If you can't check the founders directly, you check who backed them.",
    fact: "Three funds are in, and two of them have said so publicly.",
    spin: "Serious money did the diligence you're worried about doing. They met these people. That's what a lead investor is for.",
    backing: BACKING.HARD,
    generic: {
      line: "Two public announcements, one quiet. Real funds, real names, you can read the posts yourself. Whether they did a background check on a pseudonym is between them and their LPs — I'd assume yes, that's the job.",
      receipt: { title: "INVESTORS", rows: [["Funds in", "3"], ["Publicly confirmed", "2"], ["Lead investor", "NAMED"]] },
    },
    legit: {
      sharp: {
        line: "I called them. The lead confirmed directly — they hold identity documents on all three founders and have since the seed. They won't publish, and they don't have to. Somebody who is accountable knows exactly who these people are.",
        receipt: { title: "REFERENCE CHECK", rows: [["Lead confirms KYC", "YES"], ["Documents held since", "SEED"], ["Willing to be quoted", "YES"], ["Identity escrow", "IN PLACE"]] },
      },
    },
    rug: {
      // NULL SHARP RECEIPT, ONE BRANCH ONLY. This is what produces NOTHING ON
      // FILE — an absence somebody independently looked for, which is strictly
      // stronger than the seller's screen simply staying dark, and the only way
      // this game can prove a negative. Legitimate here because the hoisted
      // generic above still supplies the shallow answer.
      sharp: {
        line: "I went to all three funds. Two never answered. The one that did has never met them either — they came in off the second fund's recommendation, and that fund came in off the first one's. Nobody at the bottom of that stack has seen a face.",
        receipt: null,
      },
    },
  },

  {
    id: "treasury",
    lane: LANES.CHAIN,
    subject: "THE TREASURY",
    shape: SHAPES.UNSOURCED,
    loadBearing: false,
    lead: "Custody next — the question that decides whether anything else matters.",
    fact: "Treasury is a multisig. The signer set is public onchain.",
    spin: "You can't rug from a multisig without the other signers noticing. That's the whole point of a multisig.",
    backing: BACKING.HARD,
    generic: {
      line: "Five signers, threshold's on the contract, anybody can read it. I'm not going to sit here and pretend I've personally identified five pseudonymous keys — but the structure is the structure, and the structure is sound.",
      receipt: { title: "TREASURY", rows: [["Type", "MULTISIG"], ["Signers", "5"], ["Threshold", "ON-CHAIN"]] },
    },
    legit: {
      sharp: {
        line: "Five signers, three-of-five, and here's what he skipped: two of those keys belong to the investors, not the team. The founders cannot move that treasury alone even if all three of them wanted to.",
        receipt: { title: "SIGNER SET", rows: [["Signers", "5"], ["Threshold", "3 OF 5"], ["Team-controlled keys", "3"], ["Investor-controlled keys", "2"], ["Team can move alone", "NO"]] },
      },
    },
    rug: {
      sharp: {
        line: "Five signers, two-of-five. And all five keys were funded from the same wallet inside the same hour, eleven months ago. That's not five people. That's one person with five keys.",
        receipt: { title: "SIGNER SET", rows: [["Signers", "5"], ["Threshold", "2 OF 5"], ["Funded from", "ONE WALLET"], ["Funded within", "58 MINUTES"], ["Independent signers", "UNPROVEN"]] },
      },
    },
  },

  {
    id: "funding",
    lane: LANES.CHAIN,
    subject: "THE MONEY",
    shape: SHAPES.POSITIONED,
    loadBearing: false,
    lead: "On where the money came from, and how it arrived.",
    fact: (v) => `$${v.seed}M raised. The receiving address has no mixer hops.`,
    spin: "Clean money, clean path, and it's all still sitting there. Look at the chain yourself, it's the most honest thing in this business.",
    // THE DELIBERATE ZERO. Identical in both branches at both depths — the
    // impressive-sounding claim that tells you nothing. Every archetype needs
    // one, because scoring coverage of the DISCRIMINATING claims is what
    // teaches that a salesman disguises materiality on purpose.
    backing: BACKING.HARD,
    generic: {
      line: "Straight in from the funds, no hops, no mixers, still ninety-plus percent unspent. That's not a claim, that's a block explorer.",
      receipt: { title: "TREASURY FLOW", rows: [["Inbound", "FROM FUNDS"], ["Mixer hops", "0"], ["Unspent", "91%"]] },
    },
    legit: {
      sharp: {
        line: "Confirmed. Clean in, mostly unspent, burn rate consistent with the headcount they claim. The money is exactly what he says it is.",
        receipt: { title: "TREASURY FLOW", rows: [["Mixer hops", "0"], ["Unspent", "91%"], ["Monthly burn", "CONSISTENT"]] },
      },
    },
    rug: {
      sharp: {
        line: "Confirmed. Clean in, mostly unspent, burn rate consistent with the headcount they claim. The money is exactly what he says it is. It usually is — that's why it's the thing they show you.",
        receipt: { title: "TREASURY FLOW", rows: [["Mixer hops", "0"], ["Unspent", "91%"], ["Monthly burn", "CONSISTENT"]] },
      },
    },
  },

  {
    id: "audit",
    lane: LANES.RECORD,
    subject: "THE AUDIT",
    shape: SHAPES.BORROWED_CREDIBILITY,
    loadBearing: false,
    lead: "They had the contracts reviewed before anyone deposited.",
    fact: (v) => `${v.auditor} audited it. The report is public.`,
    spin: "A real firm put its name on this. They don't do that for anonymous scams — their name is the only thing they've got.",
    backing: BACKING.HARD,
    generic: {
      line: "Public report, real firm, no criticals. Clean within scope. Scope's in section one, it's a public document, I'm not hiding it from you.",
      receipt: { title: "AUDIT", rows: [["Firm", "TIER 1"], ["Criticals", "0"], ["Report", "PUBLIC"]] },
    },
    legit: {
      sharp: {
        line: "I have read it. The scope covers the vault, the router and the upgrade path — all three. That last one is the one that usually isn't in there, and here it is, section four.",
        receipt: { title: "AUDIT SCOPE", rows: [["Vault logic", "IN SCOPE"], ["Router", "IN SCOPE"], ["Upgrade path", "IN SCOPE"], ["Criticals", "0"], ["Excluded", "NOTHING MATERIAL"]] },
      },
    },
    rug: {
      sharp: {
        line: "I have read it. The scope covers the vault and the router. The upgrade path is listed under excluded, on the last page, in the same type as everything else. The report is honest. The summary he is quoting is not the report.",
        receipt: { title: "AUDIT SCOPE", rows: [["Vault logic", "IN SCOPE"], ["Router", "IN SCOPE"], ["Upgrade path", "EXCLUDED"], ["Criticals", "0"], ["Excluded", "SEE P.41"]] },
      },
    },
  },

  {
    id: "keys",
    lane: LANES.RECORD,
    subject: "THE ADMIN KEYS",
    shape: SHAPES.UNFALSIFIABLE,
    loadBearing: false,
    lead: "Admin power is the part a careful desk always asks about.",
    fact: "Admin functions sit behind a timelock. The delay is set in the contract.",
    spin: "If they ever touch anything you get advance notice and you get out. Anonymity doesn't matter when the contract won't let them move fast.",
    backing: BACKING.HARD,
    generic: {
      line: "There's a timelock, the delay is on-chain, go and read it. I'm not going to speculate about what they might do with keys they haven't used.",
      receipt: { title: "ADMIN", rows: [["Timelock", "PRESENT"], ["Delay", "ON-CHAIN"], ["Times used", "0"]] },
    },
    legit: {
      sharp: {
        line: "Forty-eight hours, and it is wired to every admin function including the upgrade. I checked each one individually rather than taking the summary's word for it. There is no path that skips it.",
        receipt: { title: "TIMELOCK COVERAGE", rows: [["Delay", "48H"], ["Admin functions", "9"], ["Behind timelock", "9 OF 9"], ["Bypass path", "NONE"]] },
      },
    },
    rug: {
      sharp: {
        line: "Forty-eight hours on eight of the nine admin functions. The ninth is the upgrade, and it answers to the multisig directly. The timelock is real. It simply does not stand in front of the door that matters.",
        receipt: { title: "TIMELOCK COVERAGE", rows: [["Delay", "48H"], ["Admin functions", "9"], ["Behind timelock", "8 OF 9"], ["Excluded", "UPGRADE"], ["Bypass path", "MULTISIG"]] },
      },
    },
  },

  {
    id: "chart",
    lane: LANES.CHART,
    subject: "THE PRICE",
    shape: SHAPES.SELECTIVE_WINDOW,
    loadBearing: false,
    lead: "The market has formed its own view, for whatever that's worth.",
    fact: (v) => `Up ${v.pump} percent since launch.`,
    spin: "The market has had months to decide these people are frauds and it has decided the opposite. That's thousands of wallets doing diligence you don't have to repeat.",
    // VIBES: nobody can settle this one at any depth. Price movement is not
    // evidence, and no receipt exists for that at any depth — which is the
    // honest place for "nobody can settle this" to live. (§3)
    backing: BACKING.VIBES,
    generic: {
      line: "Up is up. You want me to apologise for a chart going the right way? Thousands of wallets, months of trading, and every one of them could read the same anonymous team page you did.",
      receipt: null,
    },
    legit: { sharp: { line: "It's a real chart and it means nothing. A crowd that can't identify the founders either isn't diligence, it's a bigger version of the same guess.", receipt: null } },
    rug: { sharp: { line: "It's a real chart and it means nothing. A crowd that can't identify the founders either isn't diligence, it's a bigger version of the same guess.", receipt: null } },
  },
];

export const AUTOPSY = {
  legit: {
    handles: "TRUE — and the handles were old, continuous, and known to people who are accountable. That was the thread.",
    vouch: "TRUE — and the lead actually holds their identities. Anonymous to you is not anonymous to everyone.",
    treasury: "TRUE — and two of the five keys weren't theirs, which is the part that made it mean something.",
    funding: "TRUE. The money was real and clean. It usually is.",
    audit: "TRUE — and the scope covered the upgrade path, which is the clause that usually isn't there.",
    keys: "TRUE — and it covered all nine functions. A timelock is only worth what it stands in front of.",
    chart: "SHADED — a crowd that can't identify them either. Never evidence, in this direction or the other.",
  },
  rug: {
    handles: "TRUE, BUT IT DOESN'T ANSWER THE QUESTION — seven months old, and the résumés cited only themselves.",
    vouch: "TRUE, AND HOLLOW — three funds in a circle, none of whom had met them.",
    treasury: "TRUE, BUT IT DOESN'T ANSWER THE QUESTION — five keys, one funder, one hour.",
    funding: "TRUE. The money was real and clean. It usually is — that's why it's what they show you.",
    audit: "TRUE, BUT IT DOESN'T ANSWER THE QUESTION — the upgrade path was excluded on page 41.",
    keys: "TRUE, BUT IT DOESN'T ANSWER THE QUESTION — eight of nine, and the ninth was the only one worth locking.",
    chart: "SHADED — the crowd knew exactly as much as you did.",
  },
};

export const RESOLUTION = {
  // LEGIT SAYS ONLY THAT THE CLAIMS HELD — see the note in backdoorFork.js.
  legit: () =>
    `Nobody ever learned their names. The vault held, the upgrade path stayed audited, and the investors who did know who they were never had to say. `
    + `Anonymity was the only thing wrong with it, and anonymity was never the thing that hurts you.`,
  rug: (v) =>
    `${v.name} drained on day ${v.collapseDay}, through the one admin function the timelock didn't cover. `
    + `The handles went quiet the same afternoon. The funds that vouched for them had been vouching for each other.`,
};
