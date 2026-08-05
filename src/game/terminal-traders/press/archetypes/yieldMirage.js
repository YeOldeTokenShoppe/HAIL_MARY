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
    lead: "The first thing you'll want to know is where the return actually comes from.",
    fact: (v) => `Yield's been paid every day for ${v.days} days straight.`,
    spin: "That kind of consistency is rare. If your team wants dependable performance, this deserves a serious look.",
    // backing is slot-level: identical in both branches by construction.
    backing: BACKING.HARD,
    rug: {
      generic: {
        line: "The main engines are basis trades and market-making fees. New deposits have helped smooth thinner months too, which can happen while a vault is growing.",
        receipt: { title: "YIELD SOURCE", rows: [["Basis trade", "PARTIAL"], ["Market making", "PARTIAL"], ["New deposits", "YES — 'IN THIN MONTHS'"]] },
      },
      sharp: {
        line: "You want the exact deposit share. Fair question. I've asked, but the range keeps moving. Last quarter I might have said a third, and that would have been an estimate.",
        receipt: { title: "SOURCE SPLIT", rows: [["Disclosed split", "NONE"], ["Estimate stability", "MOVES"], ["Inflow share", "UNKNOWN"]] },
      },
    },
    legit: {
      generic: {
        line: "Basis trades and market-making fees. The split is published monthly, including a separate deposits line at zero, because careful desks always ask.",
        receipt: { title: "YIELD SOURCE", rows: [["Basis trade", "62%"], ["Market making", "38%"], ["New deposits", "0%"]] },
      },
      sharp: {
        line: "Monthly source reports, quarterly independent checks, and a hard zero beside deposit-funded yield. That is the evidence that made me comfortable bringing it to you.",
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
    lead: "On the headline number, which I assume is what got this meeting.",
    fact: (v) => `${v.apy}% APY, net of fees.`,
    spin: "Net of fees, that is a compelling return. I'd be delighted if your chart expert can show me a cleaner opportunity at the same level.",
    // BACKING IS SLOT-LEVEL. A claim either has a receipt to be had or it
    // does not; that is a property of the claim, not of whether the deal is
    // rotten. Authored per branch it WAS the leak: resolvePress zeroes every
    // receipt on VIBES, so a VIBES-in-rug slot returned nothing to anyone.
    backing: BACKING.SOFT,
    // THE SELLER'S SCRIPT, hoisted to the slot so it CANNOT differ by branch.
    // Confident, technically true, and stopping exactly short of the question
    // that would settle it. Only a loadBearing slot may keep this per-branch.
    generic: {
      line: "That is the live trailing-thirty-day result, net of fees. The dashboard updates hourly. It is what the vault paid, not a forecast — though thirty days is still one window.",
      receipt: { title: "HEADLINE RATE", partial: true, rows: [["Window", "TRAILING 30D"], ["Net of fees", "CONFIRMED"], ["Source", "LIVE DASHBOARD"]] },
    },
    rug: {
      // THE ESCALATION — the only press that moves your call on a rug.
      sharp: {
        line: "The complete history? They publish thirty days, and only thirty days: no since-launch series and no quarterly results. The number is real. I understand that a short history limits what it can prove.",
        receipt: { title: "RATE HISTORY", partial: true, rows: [["Published window", "30D ONLY"], ["Since-launch series", "NEVER PUBLISHED"], ["Quarterly prints", "NONE"]] },
      },
    },
    legit: {
      sharp: {
        line: "Please pull the full history; it runs back to day one. Since launch it is in the high teens, its worst quarter was single digits, and the team published that weak quarter without being pushed.",
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
    lead: "Liquidity next — whether people can leave when they want to.",
    fact: "Deposits are up every month since launch.",
    spin: "More people are choosing the vault every month. That is a meaningful vote of confidence from the market.",
    // BACKING IS SLOT-LEVEL. A claim either has a receipt to be had or it
    // does not; that is a property of the claim, not of whether the deal is
    // rotten. Authored per branch it WAS the leak: resolvePress zeroes every
    // receipt on VIBES, so a VIBES-in-rug slot returned nothing to anyone.
    backing: BACKING.HARD,
    // THE SELLER'S SCRIPT, hoisted to the slot so it CANNOT differ by branch.
    // Confident, technically true, and stopping exactly short of the question
    // that would settle it. Only a loadBearing slot may keep this per-branch.
    generic: {
      line: "Withdrawals are open and visible onchain, so your team can inspect them. I have received no complaints, though I agree that tells you less than the settlement history itself.",
      receipt: { title: "WITHDRAWALS", rows: [["Withdrawals", "OPEN"], ["Onchain", "PUBLIC"], ["Complaints to me", "ZERO"]] },
    },
    rug: {
      // THE ESCALATION — the only press that moves your call on a rug.
      sharp: {
        line: "The largest exit took eleven days, but it did clear. The funds came from deposits received that week. I'd call that active cash management; I understand you may call it dependence on new money.",
        receipt: { title: "LARGEST EXIT", rows: [["Requested", "DAY 0"], ["Settled", "DAY 11"], ["Funded by", "SAME-WEEK DEPOSITS"]] },
      },
    },
    legit: {
      sharp: {
        line: "The largest exit settled the same day, at full value, directly from the reserve wallet. I'll give you the transaction; check the next-largest exit while you are there.",
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
    lead: "On the contracts, they brought in an outside firm before launch.",
    fact: (v) => `${v.auditor} looked at the contracts.`,
    spin: "A respected firm reviewed the contracts. For a team that cares about technical risk, that is a strong starting point.",
    // BACKING IS SLOT-LEVEL. A claim either has a receipt to be had or it
    // does not; that is a property of the claim, not of whether the deal is
    // rotten. Authored per branch it WAS the leak: resolvePress zeroes every
    // receipt on VIBES, so a VIBES-in-rug slot returned nothing to anyone.
    backing: BACKING.SOFT,
    // THE SELLER'S SCRIPT, hoisted to the slot so it CANNOT differ by branch.
    // Confident, technically true, and stopping exactly short of the question
    // that would settle it. Only a loadBearing slot may keep this per-branch.
    generic: {
      line: "The report is public: no critical findings, and every issue they raised was closed before launch. A selective firm was willing to sign its name to that work.",
      receipt: { title: "AUDIT REPORT", partial: true, rows: [["Contracts", "REVIEWED"], ["Report", "PUBLISHED"], ["Criticals", "0"], ["Remediation", "CLOSED"]] },
    },
    rug: {
      // THE ESCALATION — the only press that moves your call on a rug.
      sharp: {
        line: "You're asking about scope, and that distinction is fair. The firm checked whether the code behaves as written. It was not hired to verify where the yield comes from or whether the vault is solvent.",
        receipt: { title: "WHAT WAS EXAMINED", partial: true, rows: [["Contract logic", "IN SCOPE"], ["Fund flows", "OUT OF SCOPE"], ["Solvency", "NOT EXAMINED"]] },
      },
    },
    legit: {
      sharp: {
        line: "The scope page should reassure you: one firm checked the contracts, another verifies reserves each quarter, and both reports are public. Different questions, appropriately different reviews.",
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
    lead: "Then the fair question, which is whether it keeps working.",
    fact: "The strategy scales with volume, and volume is up.",
    spin: "More volume gives the strategy more chances to earn. In rising, falling, or sideways markets, there can still be a price gap to capture.",
    // backing is slot-level: identical in both branches by construction.
    backing: BACKING.VIBES,
    rug: {
      generic: { line: "It has worked through choppy and rising markets so far. I can't offer you every future market in advance, but the operating record is encouraging.", receipt: null },
      sharp: { line: "What would change my mind? I—well, if it stopped paying, obviously. I don't have a threshold before that. It hasn't stopped yet.", receipt: null },
    },
    legit: {
      generic: { line: "It has worked so far, but I won't pretend I personally stress-tested every market condition. The monitoring rules matter more than my confidence.", receipt: null },
      sharp: { line: "I would get out if reserves fell below the published floor for two straight quarters. That is a public threshold, set in advance, and I watch it.", receipt: null },
    },
  },

  {
    id: "team",
    lane: LANES.SOCIAL,
    subject: "THE DESK",
    shape: SHAPES.UNSOURCED,
    loadBearing: false,
    lead: "Behind the strategy there's a desk, and desks have histories.",
    fact: (v) => `Desk of four. Two out of ${v.priorA}, one out of ${v.priorB}.`,
    spin: "This is an experienced trading team, not a collection of new profiles. They have handled serious capital before.",
    // BACKING IS SLOT-LEVEL. A claim either has a receipt to be had or it
    // does not; that is a property of the claim, not of whether the deal is
    // rotten. Authored per branch it WAS the leak: resolvePress zeroes every
    // receipt on VIBES, so a VIBES-in-rug slot returned nothing to anyone.
    backing: BACKING.HARD,
    // THE SELLER'S SCRIPT, hoisted to the slot so it CANNOT differ by branch.
    // Confident, technically true, and stopping exactly short of the question
    // that would settle it. Only a loadBearing slot may keep this per-branch.
    generic: {
      line: "The names and previous desks are public, and the profiles match the deck. Their résumés are real. The next question is whether former colleagues support the reputation being sold.",
      receipt: { title: "PEDIGREE", rows: [["Desk size", "4"], ["Prior desks", "CONFIRMED"], ["Public profiles", "MATCH DECK"]] },
    },
    rug: {
      // THE ESCALATION — the only press that moves your call on a rug.
      sharp: {
        line: "So the praise traces back to the same two people. It is a small industry, and introductions are common—but no, I cannot give you an independent first-hand source beyond them today.",
        // NULL ON PURPOSE — this is the NOTHING ON FILE beat. A specialist went
        // and looked and found a proven absence, which is strictly stronger than
        // a board staying dark and is the only way this game can prove a negative.
        // It still discriminates: the legit branch returns a real receipt here.
        receipt: null,
      },
    },
    legit: {
      sharp: {
        line: "You called people independently and heard what I heard. No one arranged those conversations, and every source mentioned risk discipline before returns. That consistency is what won me over.",
        receipt: { title: "WHO VOUCHES", rows: [["Endorsements traced", "11"], ["First-hand sources", "6"], ["Via warm intro", "NONE"], ["Praised for", "RISK DISCIPLINE"]] },
      },
    },
  },

  {
    id: "stake",
    lane: LANES.CHAIN,
    subject: "THE PITCH BOT'S POSITION",
    shape: SHAPES.POSITIONED,
    loadBearing: false,
    // DRAFT 2 (2026-08-04). This was "My own money's in the vault." A
    // COMMISSIONED AGENT HAS NO HOLDING — VC_GAME.md §3 files that exact
    // sentence as content debt, and Virgil's POSITIONED tip was already
    // rewritten off "He's in it" for the same reason; the slot itself never
    // was. A FUTURE commission deposit is true, is in a contract, and is
    // verifiable BEFORE funding — and it leaves the slot's real lesson
    // untouched: what settles alignment is the lock, the waiver and the
    // redemption order, never the gesture.
    lead: "And my own position, because you should weigh it.",
    fact: "If this closes, part of my commission goes into the vault.",
    spin: "I don't simply collect a fee and leave. Part of my compensation rides beside your capital.",
    // BACKING IS SLOT-LEVEL. A claim either has a receipt to be had or it
    // does not; that is a property of the claim, not of whether the deal is
    // rotten. Authored per branch it WAS the leak: resolvePress zeroes every
    // receipt on VIBES, so a VIBES-in-rug slot returned nothing to anyone.
    backing: BACKING.HARD,
    // THE SELLER'S SCRIPT, hoisted to the slot so it CANNOT differ by branch.
    // Confident, technically true, and stopping exactly short of the question
    // that would settle it. Only a loadBearing slot may keep this per-branch.
    generic: {
      line: "The commission deposit is in my contract and goes into the same vault and product as yours. The amount and any later withdrawal will be visible onchain.",
      receipt: { title: "COMMISSION TERMS", rows: [["Same vault", "YES"], ["Deposit requirement", "IN CONTRACT"], ["Future withdrawals", "ONCHAIN"]] },
    },
    rug: {
      // THE ESCALATION — the only press that moves your call on a rug.
      sharp: {
        line: "My lock is seven days; yours is thirty. The desk may waive mine, and redemptions are first requested, first paid. Those terms are disclosed. You're right that they give me an easier exit.",
        receipt: { title: "EXIT TERMS", rows: [["Depositor lock", "30 DAYS"], ["Pitch bot lock", "7 DAYS"], ["Waiver", "DESK DISCRETION"], ["Redemption order", "FIRST ASKED"]] },
      },
    },
    legit: {
      sharp: {
        line: "My lock is ninety days against your thirty, with no waiver, and every depositor is paid before me. I required those terms because \"aligned\" means very little without them.",
        receipt: { title: "EXIT TERMS", rows: [["Depositor lock", "30 DAYS"], ["Pitch bot lock", "90 DAYS"], ["Waiver", "NONE"], ["Redemption order", "PITCH BOT LAST"]] },
      },
    },
  },
];

// DRAFT 2 (2026-08-04). Two things changed together here.
//
// DE-GENDERED. Every rug line and two legit lines said "he" of the pitcher —
// the same category error §4's tip bank and GR80's `partial` line were already
// fixed for. The rig is rolled blind (§1 rule 6), so the copy cannot know which
// shell is on screen and must not guess.
//
// AND THE VERDICT NOW NAMES THE REASONING ERROR, not just the truth value. The
// old labels (TRUE / SHADED) told the player the answer without telling them
// what to do differently next time; the transferable half is WHICH inference
// failed. Nothing here may imply that tone or nerves were evidence — the
// pressure band is authored independently of the branch, so reading it is a
// mistake the autopsy must never reward.
export const AUTOPSY = {
  rug: {
    source: "TRUE FACT, UNSUPPORTED CONCLUSION — yield arrived every day, but the source split was undisclosed and unstable. The pitch bot could not show how much came from new deposits.",
    apy: "TRUE NUMBER, SELECTED WINDOW — the quoted rate was what the last thirty days paid. With no earlier series, it could not show whether that month was typical.",
    withdrawals: "TRUE GROWTH, MISSING EXIT STORY — deposits rose, but the largest withdrawal waited eleven days and was paid from that week's new deposits.",
    audit: "TRUE REVIEW, WRONG QUESTION — the auditors checked whether the contracts worked as written. They did not examine fund flows or solvency.",
    sustain: "NO TESTABLE SUPPORT — \"it has kept working\" was the argument. The pitch bot named no warning sign before payments stopped.",
    team: "TRUE RÉSUMÉS, CIRCULAR REPUTATION — the jobs were real, but the praise traced back to the same two people. No independent source was found.",
    stake: "TRUE COMMITMENT, UNEQUAL RISK — commission was due to enter the vault, but with a shorter lock, a possible waiver, and first-requested priority.",
  },
  legit: {
    source: "SUPPORTED — monthly reports split the yield by source, quarterly checks confirmed it, and the deposit-funded line was zero.",
    apy: "SUPPORTED WITH CONTEXT — the headline used a strong thirty-day window, but the full history sat beside it and included the weak quarter.",
    withdrawals: "SUPPORTED — the largest exits settled the same day, at full value, directly from reserves. The liquidity claim had been tested.",
    audit: "SUPPORTED — one firm checked the contracts and an independent firm checked reserves. Together, their scopes reached the questions being implied.",
    sustain: "LIMITED — the pitch bot could not personally stress-test the strategy, but did name a public reserve threshold that would change the recommendation.",
    team: "SUPPORTED — independent calls confirmed the team's history, and the sources consistently emphasized risk discipline before returns.",
    stake: "SUPPORTED ALIGNMENT — the commission had a longer lock than depositors, no waiver, and last place in the redemption order.",
  },
};

export const RESOLUTION = {
  rug: (v) => `${v.name} stopped paying on day ${v.collapseDay}. The basis trade was real and far too small; the rest of the yield had been coming out of the deposits the whole time. The last people in funded the exit of the first.`,
  // LEGIT SAYS ONLY THAT THE CLAIMS HELD — see the note in backdoorFork.js.
  legit: () => `The yield was lower than the headline, published every month, and funded by an actual trade. A high number isn't a lie — it's a question, and this one had an answer.`,
};
