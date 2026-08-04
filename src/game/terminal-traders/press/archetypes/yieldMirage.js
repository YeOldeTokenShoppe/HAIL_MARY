// ARCHETYPE — "yield-mirage": the APY was the product, paid from the door, not
// the vault. CASE_PATTERNS (cards.js); the coin Ponzi Siren carries it.
//
// The deliberate CONTRAST with backdoor-fork. That one hides a mechanism (an
// unaudited door) and the tell is a scope boundary. This one hides an
// ACCOUNTING IDENTITY — the yield is real, it's just being paid out of the
// inflows — and the tell is that nobody can name where the money comes from
// without eventually saying "new deposits". Two different silhouettes, so a
// player who has learned one does not get the other for free.
//
// Same contract as every archetype: facts are always TRUE, the rolled outcome
// only changes what he can PRODUCE when pressed, and the exception rate keeps
// a perfect read short of certainty.

import { SHAPES, BACKING, LANES } from "../questions.js";

export const ARCHETYPE_ID = "yield-mirage";
// The player-facing name. See the note in backdoorFork.js: plain English, and
// it names the MECHANISM rather than the vibe, because the mechanism is what
// transfers to the next token.
export const ARCHETYPE_LABEL = "PAID OUT OF THE INFLOWS";
// The transferable half. See the note in backdoorFork.js for why this replaced
// the exemplar coin on the post-deal screen.
export const ARCHETYPE_TELL =
  "The yield is real and it is being paid. Ask where the money comes from, and "
  + "every answer arrives sooner or later at new deposits.";
export const EXEMPLAR_COIN = "ponzi-siren";

// Slightly kinder than backdoor-fork: a high-yield product CAN be real, and
// the game should reward the player who checks rather than the one who assumes.
export const OUTCOMES = [
  { outcome: "rug", truth: 1, weight: 68 },
  { outcome: "legit", truth: 0, weight: 32 },
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
    // The decisive thread, and it is HARD in both branches — you can always
    // reach the verdict with a free press. What differs is what the honest
    // answer IS.
    id: "source",
    lane: LANES.CHAIN,
    subject: "WHERE IT COMES FROM",
    shape: SHAPES.UNSOURCED,
    loadBearing: true,
    fact: (v) => `Yield's been paid every day for ${v.days} days straight.`,
    spin: "It pays. It's paid every single day. At some point you stop asking why and start asking why you're not in.",
    // backing is slot-level: identical in both branches by construction.
    backing: BACKING.HARD,
    rug: {
      generic: {
        line: "Where's it from? Basis trade, mostly. Some market-making. And— fine, and inflows, in the thin months. That's normal in the ramp.",
        receipt: { title: "YIELD SOURCE", rows: [["Basis trade", "PARTIAL"], ["Market making", "PARTIAL"], ["New deposits", "YES — 'IN THIN MONTHS'"]] },
      },
      sharp: {
        line: "What share is inflows? …I've asked. I get a range. The range moves. Last quarter I'd have said a third, and I'd have been guessing.",
        receipt: { title: "SOURCE SPLIT", rows: [["Disclosed split", "NONE"], ["Estimate stability", "MOVES"], ["Inflow share", "UNKNOWN"]] },
      },
    },
    legit: {
      generic: {
        line: "Basis trade and market-making fees, split published monthly. Zero from deposits — they publish that line specifically because everyone asks.",
        receipt: { title: "YIELD SOURCE", rows: [["Basis trade", "62%"], ["Market making", "38%"], ["New deposits", "0%"]] },
      },
      sharp: {
        line: "Published monthly, audited quarterly, and the deposits line is a hard zero. That's the whole reason I'll put my name on it.",
        receipt: { title: "SOURCE SPLIT", rows: [["Disclosed split", "MONTHLY"], ["Deposit-funded", "0%"], ["Independent check", "QUARTERLY"]] },
      },
    },
  },

  {
    id: "apy",
    lane: LANES.CHART,
    subject: "THE HEADLINE",
    shape: SHAPES.SELECTIVE_WINDOW,
    loadBearing: false,
    fact: (v) => `${v.apy}% APY, net of fees.`,
    spin: "Show me where else you're getting that. I'll wait.",
    // BACKING IS SLOT-LEVEL. A claim either has a receipt to be had or it
    // does not; that is a property of the claim, not of whether the deal is
    // rotten. Authored per branch it WAS the leak: resolvePress zeroes every
    // receipt on VIBES, so a VIBES-in-rug slot returned nothing to anyone.
    backing: BACKING.SOFT,
    // THE SELLER'S SCRIPT, hoisted to the slot so it CANNOT differ by branch.
    // Confident, technically true, and stopping exactly short of the question
    // that would settle it. Only a loadBearing slot may keep this per-branch.
    generic: {
      line: "That's the live number, trailing thirty, net. It's on the dashboard, it updates hourly, and it's what the thing actually paid — I'm not quoting you a forecast.",
      receipt: { title: "HEADLINE RATE", partial: true, rows: [["Window", "TRAILING 30D"], ["Net of fees", "CONFIRMED"], ["Source", "LIVE DASHBOARD"]] },
    },
    rug: {
      // THE ESCALATION — the only press that moves your call on a rug.
      sharp: {
        line: "You want the whole tape? There isn't one. Thirty days is the window they publish, and it is the only window they have ever published — no since-launch series, no quarterly prints, nothing behind it. The thirty is real. It is also all there is.",
        receipt: { title: "RATE HISTORY", partial: true, rows: [["Published window", "30D ONLY"], ["Since-launch series", "NEVER PUBLISHED"], ["Quarterly prints", "NONE"]] },
      },
    },
    legit: {
      sharp: {
        line: "Pull whatever you like, it's all posted back to day one. Since launch it runs high teens, worst quarter was single digits, and they printed the bad quarter themselves. Nobody prints the bad quarter.",
        receipt: { title: "RATE HISTORY", rows: [["Published window", "SINCE LAUNCH"], ["Since-launch rate", "HIGH TEENS"], ["Worst quarter", "SINGLE DIGITS"]] },
      },
    },
  },

  {
    id: "withdrawals",
    lane: LANES.CHAIN,
    subject: "GETTING OUT",
    shape: SHAPES.SURVIVORSHIP,
    loadBearing: false,
    fact: "Deposits are up every month since launch.",
    spin: "Nobody's leaving. That's not a queue, that's conviction.",
    // BACKING IS SLOT-LEVEL. A claim either has a receipt to be had or it
    // does not; that is a property of the claim, not of whether the deal is
    // rotten. Authored per branch it WAS the leak: resolvePress zeroes every
    // receipt on VIBES, so a VIBES-in-rug slot returned nothing to anyone.
    backing: BACKING.HARD,
    // THE SELLER'S SCRIPT, hoisted to the slot so it CANNOT differ by branch.
    // Confident, technically true, and stopping exactly short of the question
    // that would settle it. Only a loadBearing slot may keep this per-branch.
    generic: {
      line: "Withdrawals are open and they're onchain — go and look. Nobody's come to me with a problem, and I'd be the first call they made. People come and go. That's a market.",
      receipt: { title: "WITHDRAWALS", rows: [["Withdrawals", "OPEN"], ["Onchain", "PUBLIC"], ["Complaints to me", "ZERO"]] },
    },
    rug: {
      // THE ESCALATION — the only press that moves your call on a rug.
      sharp: {
        line: "Eleven days on the biggest one — and it cleared. Late isn't never. The money that cleared it came in that week, which is what a book is for.",
        receipt: { title: "LARGEST EXIT", rows: [["Requested", "DAY 0"], ["Settled", "DAY 11"], ["Funded by", "SAME-WEEK DEPOSITS"]] },
      },
    },
    legit: {
      sharp: {
        line: "Biggest single exit cleared same-day, no haircut, straight out of the reserve wallet. You want the tx, I'll find you the tx — check the one under it while you're in there.",
        receipt: { title: "LARGEST EXIT", rows: [["Settled", "SAME DAY"], ["Haircut", "NONE"], ["Funded by", "RESERVES"], ["Onchain", "VERIFIABLE"]] },
      },
    },
  },

  {
    id: "audit",
    lane: LANES.RECORD,
    subject: "THE AUDIT",
    shape: SHAPES.BORROWED_CREDIBILITY,
    loadBearing: false,
    fact: (v) => `${v.auditor} looked at the contracts.`,
    spin: "Audited. By a name you know. Next question.",
    // BACKING IS SLOT-LEVEL. A claim either has a receipt to be had or it
    // does not; that is a property of the claim, not of whether the deal is
    // rotten. Authored per branch it WAS the leak: resolvePress zeroes every
    // receipt on VIBES, so a VIBES-in-rug slot returned nothing to anyone.
    backing: BACKING.SOFT,
    // THE SELLER'S SCRIPT, hoisted to the slot so it CANNOT differ by branch.
    // Confident, technically true, and stopping exactly short of the question
    // that would settle it. Only a loadBearing slot may keep this per-branch.
    generic: {
      line: "They signed it. Published report, no criticals, everything they flagged closed out before launch — that's a firm that turns work down, they don't put the name on a mess.",
      receipt: { title: "AUDIT REPORT", partial: true, rows: [["Contracts", "REVIEWED"], ["Report", "PUBLISHED"], ["Criticals", "0"], ["Remediation", "CLOSED"]] },
    },
    rug: {
      // THE ESCALATION — the only press that moves your call on a rug.
      sharp: {
        line: "Scope. Right. Of course it's scope. They read the code and the code does exactly what it says it does — where the money comes from was never a thing anyone hired them to look at.",
        receipt: { title: "WHAT WAS EXAMINED", partial: true, rows: [["Contract logic", "IN SCOPE"], ["Fund flows", "OUT OF SCOPE"], ["Solvency", "NOT EXAMINED"]] },
      },
    },
    legit: {
      sharp: {
        line: "Go and pull the scope page then. Contracts by one firm, reserves by a different one, quarterly, both published — two questions, two firms. I did say it was checked.",
        receipt: { title: "WHAT WAS EXAMINED", rows: [["Contract logic", "IN SCOPE"], ["Fund flows", "VERIFIED QUARTERLY"], ["Verifier", "SECOND FIRM, INDEPENDENT"]] },
      },
    },
  },

  {
    id: "sustain",
    lane: LANES.SOCIAL,
    subject: "WHY IT KEEPS WORKING",
    shape: SHAPES.UNFALSIFIABLE,
    loadBearing: false,
    fact: "The strategy scales with volume, and volume is up.",
    spin: "It works in every market. Up, down, sideways — the basis is always there.",
    // backing is slot-level: identical in both branches by construction.
    backing: BACKING.VIBES,
    rug: {
      generic: { line: "It works. It's been working. It works in chop, it works in a rally, I don't know what else to tell you.", receipt: null },
      sharp: { line: "What would make me get out? Nothing— I mean, obviously if it stopped paying. But it hasn't stopped paying.", receipt: null },
    },
    legit: {
      generic: { line: "It works. It's been working. Look, I'm not going to pretend I've stress-tested it myself.", receipt: null },
      sharp: { line: "What would get me out? Reserves slipping below the published floor two quarters running. It's a real number, I watch it.", receipt: null },
    },
  },

  {
    id: "team",
    lane: LANES.SOCIAL,
    subject: "THE DESK",
    shape: SHAPES.UNSOURCED,
    loadBearing: false,
    fact: (v) => `Desk of four. Two out of ${v.priorA}, one out of ${v.priorB}.`,
    spin: "These are real trading people. They've run size before.",
    // BACKING IS SLOT-LEVEL. A claim either has a receipt to be had or it
    // does not; that is a property of the claim, not of whether the deal is
    // rotten. Authored per branch it WAS the leak: resolvePress zeroes every
    // receipt on VIBES, so a VIBES-in-rug slot returned nothing to anyone.
    backing: BACKING.HARD,
    // THE SELLER'S SCRIPT, hoisted to the slot so it CANNOT differ by branch.
    // Confident, technically true, and stopping exactly short of the question
    // that would settle it. Only a loadBearing slot may keep this per-branch.
    generic: {
      line: "They've run size. The pedigree's public — same names, same desks, you can look every one of them up. Nobody here appeared last year.",
      receipt: { title: "PEDIGREE", rows: [["Desk size", "4"], ["Prior desks", "CONFIRMED"], ["Public profiles", "MATCH DECK"]] },
    },
    rug: {
      // THE ESCALATION — the only press that moves your call on a rug.
      sharp: {
        line: "So it traces back to the same two mouths. It's a small industry — everybody was introduced by somebody. You won't find a desk on earth that passes that test.",
        // NULL ON PURPOSE — this is the NOTHING ON FILE beat. A specialist went
        // and looked and found a proven absence, which is strictly stronger than
        // a board staying dark and is the only way this game can prove a negative.
        // It still discriminates: the legit branch returns a real receipt here.
        receipt: null,
      },
    },
    legit: {
      sharp: {
        line: "You went and rang them yourself. Then you heard what I heard — nobody set those calls up, and every one of them gets to risk discipline before they get to returns. That's the part I was buying.",
        receipt: { title: "WHO VOUCHES", rows: [["Endorsements traced", "11"], ["First-hand sources", "6"], ["Via warm intro", "NONE"], ["Praised for", "RISK DISCIPLINE"]] },
      },
    },
  },

  {
    id: "stake",
    lane: LANES.CHAIN,
    subject: "HIS POSITION",
    shape: SHAPES.POSITIONED,
    loadBearing: false,
    fact: "My own money's in the vault.",
    spin: "I eat here. That's the only credential that's ever mattered.",
    // BACKING IS SLOT-LEVEL. A claim either has a receipt to be had or it
    // does not; that is a property of the claim, not of whether the deal is
    // rotten. Authored per branch it WAS the leak: resolvePress zeroes every
    // receipt on VIBES, so a VIBES-in-rug slot returned nothing to anyone.
    backing: BACKING.HARD,
    // THE SELLER'S SCRIPT, hoisted to the slot so it CANNOT differ by branch.
    // Confident, technically true, and stopping exactly short of the question
    // that would settle it. Only a loadBearing slot may keep this per-branch.
    generic: {
      line: "Same vault as yours, same product, and I've not taken a penny back out since the day it went in. That's onchain. Count it yourself.",
      receipt: { title: "HIS DEPOSIT", rows: [["Same vault", "YES"], ["Deposit", "ONCHAIN"], ["Withdrawn to date", "NONE"]] },
    },
    rug: {
      // THE ESCALATION — the only press that moves your call on a rug.
      sharp: {
        line: "Seven days against the depositors' thirty, and yes, the desk can lift it — they can lift anyone's, it's a standard clause. Queue's first asked, first paid. None of that's hidden. Nobody had asked.",
        receipt: { title: "EXIT TERMS", rows: [["Depositor lock", "30 DAYS"], ["His lock", "7 DAYS"], ["Waiver", "DESK DISCRETION"], ["Redemption order", "FIRST ASKED"]] },
      },
    },
    legit: {
      sharp: {
        line: "Ninety days against their thirty, no waiver clause in mine, and I'm paid out behind every depositor in the book. I had that written in. Without it the claim's worth nothing.",
        receipt: { title: "EXIT TERMS", rows: [["Depositor lock", "30 DAYS"], ["His lock", "90 DAYS"], ["Waiver", "NONE"], ["Redemption order", "HIM LAST"]] },
      },
    },
  },
];

export const AUTOPSY = {
  rug: {
    source: "TRUE — it did pay every day. He just couldn't say how much of it was other people's deposits.",
    apy: "SHADED — annualised from the good weeks.",
    withdrawals: "TRUE, AND IT SETTLED — eleven days, out of that week's deposits. The exit that cleared was funded by the people still arriving.",
    audit: "TRUE, BUT IT DOESN'T ANSWER THE QUESTION — auditors checked the plumbing, never the solvency.",
    sustain: "SHADED — 'it works' was the whole argument, and nothing could have counted against it.",
    team: "SHADED — the pedigree came off the deck. Nobody was called.",
    stake: "TRUE — he was in, and he could leave any time he liked.",
  },
  legit: {
    source: "TRUE — published split, zero from deposits, and they publish it because everyone asks.",
    apy: "TRUE — headline was the good window, but the twelve-month sat right beside it.",
    withdrawals: "TRUE — two exits at size, settled same day. The test had been run.",
    audit: "TRUE — contracts and reserves checked separately, which is the version that means something.",
    sustain: "SHADED — he still couldn't stress-test it himself, and he admitted that.",
    team: "TRUE — he actually made the calls.",
    stake: "TRUE — locked longer than you. That's the claim worth hearing.",
  },
};

export const RESOLUTION = {
  rug: (v) => `${v.name} stopped paying on day ${v.collapseDay}. The basis trade was real and far too small; the rest of the yield had been coming out of the deposits the whole time. The last people in funded the exit of the first.`,
  // LEGIT SAYS ONLY THAT THE CLAIMS HELD — see the note in backdoorFork.js.
  legit: () => `The yield was lower than the headline, published every month, and funded by an actual trade. A high number isn't a lie — it's a question, and this one had an answer.`,
};
