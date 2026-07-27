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
export const EXEMPLAR_COIN = "ponzi-siren";

// Slightly kinder than backdoor-fork: a high-yield product CAN be real, and
// the game should reward the player who checks rather than the one who assumes.
export const OUTCOMES = [
  { outcome: "rug", truth: 1, weight: 68 },
  { outcome: "legit", truth: 0, weight: 32 },
];

export const IDENTITIES = [
  { name: "SIREN YIELD", ticker: "$SIRN", chain: "Base", blurb: "delta-neutral yield, paid daily" },
  { name: "TIDEWATER", ticker: "$TIDE", chain: "Base", blurb: "market-making returns for depositors" },
  { name: "GOLDEN HOUR", ticker: "$GLDN", chain: "Base", blurb: "structured yield on stablecoin deposits" },
  { name: "PERPETUAL SPRING", ticker: "$SPRG", chain: "Base", blurb: "auto-compounding basis trade" },
];

export const AUDITORS = ["Trail of Bits", "Spearbit", "OpenZeppelin", "Zellic"];
export const PRIORS = ["ex-Jump", "ex-Alameda", "ex-Cumberland", "ex-GSR"];

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
    rug: {
      backing: BACKING.HARD,
      generic: {
        line: "Where's it from? Basis trade, mostly. Some market-making. And— fine, and inflows, in the thin months. That's normal in the ramp.",
        receipt: { title: "YIELD SOURCE", rows: [["Basis trade", "PARTIAL"], ["Market making", "PARTIAL"], ["New deposits", "YES — 'IN THIN MONTHS'"]] },
      },
      sharp: {
        line: "What share is inflows? …I've asked. I get a range. The range moves. Last quarter I'd have said a third, and I'd have been guessing.",
        receipt: { title: "SOURCE SPLIT", rows: [["Disclosed split", "NONE"], ["Estimate stability", "MOVES"], ["Inflow share", "UNKNOWN"]] },
      },
      miss: { line: "Daily. It's paid daily. You can watch it land, that's not in dispute.", receipt: null },
    },
    legit: {
      backing: BACKING.HARD,
      generic: {
        line: "Basis trade and market-making fees, split published monthly. Zero from deposits — they publish that line specifically because everyone asks.",
        receipt: { title: "YIELD SOURCE", rows: [["Basis trade", "62%"], ["Market making", "38%"], ["New deposits", "0%"]] },
      },
      sharp: {
        line: "Published monthly, audited quarterly, and the deposits line is a hard zero. That's the whole reason I'll put my name on it.",
        receipt: { title: "SOURCE SPLIT", rows: [["Disclosed split", "MONTHLY"], ["Deposit-funded", "0%"], ["Independent check", "QUARTERLY"]] },
      },
      miss: { line: "Daily. It's paid daily. You can watch it land, that's not in dispute.", receipt: null },
    },
  },

  {
    id: "apy",
    lane: LANES.SHAPE,
    subject: "THE HEADLINE",
    shape: SHAPES.SELECTIVE_WINDOW,
    loadBearing: false,
    fact: (v) => `${v.apy}% APY, net of fees.`,
    spin: "Show me where else you're getting that. I'll wait.",
    rug: {
      backing: BACKING.VIBES,
      generic: { line: "It's the number on the dashboard. I didn't make it up, it's right there on the dashboard.", receipt: null },
      sharp: { line: "Annualised from the good weeks, if we're being precise about it. Which nobody ever is.", receipt: null },
      miss: { line: "Net of fees. Net. I already said net.", receipt: null },
    },
    legit: {
      backing: BACKING.SOFT,
      generic: { line: "That's the trailing thirty. Twelve-month's lower — high teens. They publish both, which I'll admit is unusual.", receipt: { title: "APY", partial: true, rows: [["Trailing 30d", "HEADLINE"], ["Trailing 12m", "LOWER"]] } },
      sharp: { line: "Trailing thirty is the headline, twelve-month is high teens, worst quarter was single digits. All three are on the page.", receipt: { title: "APY HISTORY", rows: [["30d", "HEADLINE"], ["12m", "HIGH TEENS"], ["Worst quarter", "SINGLE DIGITS"]] } },
      miss: { line: "Net of fees. Net. I already said net.", receipt: null },
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
    rug: {
      backing: BACKING.VIBES,
      generic: { line: "People aren't withdrawing because they don't want to withdraw. Why would you leave something that pays?", receipt: null },
      sharp: { line: "Has anyone taken a large position out? …I don't— I'd have heard. I think I'd have heard.", receipt: null },
      miss: { line: "Up every month. Every single month. That's the chart.", receipt: null },
    },
    legit: {
      backing: BACKING.HARD,
      generic: { line: "Two of the seed funds have fully exited at size, no delay, no haircut. That's the test and it's been run.", receipt: { title: "EXITS", rows: [["Large exits", "2 AT SIZE"], ["Delay", "NONE"], ["Haircut", "NONE"]] } },
      sharp: { line: "Biggest single withdrawal cleared same-day. If you want the tx I'll find you the tx.", receipt: { title: "LARGEST EXIT", rows: [["Settled", "SAME DAY"], ["Onchain", "VERIFIABLE"]] } },
      miss: { line: "Up every month. Every single month. That's the chart.", receipt: null },
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
    rug: {
      backing: BACKING.SOFT,
      generic: { line: "They audited the contracts. The contracts are fine. Whether the strategy makes money isn't a thing an auditor checks.", receipt: { title: "AUDIT", partial: true, rows: [["Contracts", "REVIEWED"], ["Strategy solvency", "NOT IN SCOPE"]] } },
      sharp: { line: "Nobody has audited the yield. That's not a thing that got done. The contracts move the money correctly — where it comes from isn't their department.", receipt: { title: "WHAT WAS CHECKED", rows: [["Contract logic", "YES"], ["Fund flows", "NO"], ["Solvency", "NEVER CHECKED"]] } },
      miss: { line: "A real firm. A name you've heard. I'm not going to defend the concept of audits to you.", receipt: { title: "AUDITOR", rows: [["Report", "PUBLISHED"]] } },
    },
    legit: {
      backing: BACKING.HARD,
      generic: { line: "Contracts audited, and separately there's a quarterly proof-of-reserves from a second firm. Two different questions, two different checks.", receipt: { title: "CHECKS", rows: [["Contract audit", "YES"], ["Proof of reserves", "QUARTERLY"], ["Second firm", "YES"]] } },
      sharp: { line: "Contracts by one firm, reserves by another, quarterly, published. The solvency question has an answer and the answer is on the site.", receipt: { title: "SOLVENCY", rows: [["Reserves verified", "QUARTERLY"], ["Independent", "YES"]] } },
      miss: { line: "A real firm. A name you've heard. I'm not going to defend the concept of audits to you.", receipt: { title: "AUDITOR", rows: [["Report", "PUBLISHED"]] } },
    },
  },

  {
    id: "sustain",
    lane: LANES.SHAPE,
    subject: "WHY IT KEEPS WORKING",
    shape: SHAPES.UNFALSIFIABLE,
    loadBearing: false,
    fact: "The strategy scales with volume, and volume is up.",
    spin: "It works in every market. Up, down, sideways — the basis is always there.",
    rug: {
      backing: BACKING.VIBES,
      generic: { line: "It works. It's been working. It works in chop, it works in a rally, I don't know what else to tell you.", receipt: null },
      sharp: { line: "What would make me get out? Nothing— I mean, obviously if it stopped paying. But it hasn't stopped paying.", receipt: null },
      miss: { line: "Volume's up. That part's just a fact you can go and check.", receipt: null },
    },
    legit: {
      backing: BACKING.VIBES,
      generic: { line: "It works. It's been working. Look, I'm not going to pretend I've stress-tested it myself.", receipt: null },
      sharp: { line: "What would get me out? Reserves slipping below the published floor two quarters running. It's a real number, I watch it.", receipt: null },
      miss: { line: "Volume's up. That part's just a fact you can go and check.", receipt: null },
    },
  },

  {
    id: "team",
    lane: LANES.RECORD,
    subject: "THE DESK",
    shape: SHAPES.UNSOURCED,
    loadBearing: false,
    fact: (v) => `Desk of four. Two out of ${v.priorA}, one out of ${v.priorB}.`,
    spin: "These are real trading people. They've run size before.",
    rug: {
      backing: BACKING.VIBES,
      generic: { line: "They've run size. I've seen the pedigree. It's on the site, the pedigree's on the site.", receipt: null },
      sharp: { line: "Who told me? The deck. The deck told me. I haven't rung anyone, no.", receipt: null },
      miss: { line: "Four of them. It's a small desk. Small desks are efficient.", receipt: null },
    },
    legit: {
      backing: BACKING.HARD,
      generic: { line: "I called two former colleagues at the old desks. Both took the call, both said the same thing.", receipt: { title: "REFERENCES", rows: [["Calls made", "2"], ["Independent", "YES"], ["Corroborated", "YES"]] } },
      sharp: { line: "Two calls, neither of them warm intros, both unprompted on the risk discipline. That's what I was actually buying.", receipt: { title: "REFERENCE CHECK", rows: [["Warm intros", "NO"], ["Unprompted praise", "RISK DISCIPLINE"]] } },
      miss: { line: "Four of them. It's a small desk. Small desks are efficient.", receipt: null },
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
    rug: {
      backing: BACKING.VIBES,
      generic: { line: "I'm in the vault. Of course I'm in the vault. Would I be sat here otherwise?", receipt: null },
      sharp: { line: "Can I withdraw whenever? Yeah. Yeah, I can go any time. That's — that's a feature, that's liquidity.", receipt: null },
      miss: { line: "It's my money in there, same vault, same terms.", receipt: null },
    },
    legit: {
      backing: BACKING.HARD,
      generic: { line: "In the vault, ninety-day lock, and the lock is longer than yours. Deliberately.", receipt: { title: "HIS POSITION", rows: [["In vault", "YES"], ["Lock", "90 DAYS"], ["vs depositors", "LONGER"]] } },
      sharp: { line: "Ninety days, and I can't shorten it. If this breaks I'm in it after you are, which is the arrangement I asked for.", receipt: { title: "ALIGNMENT", rows: [["Can exit first", "NO"], ["Lock shortenable", "NO"]] } },
      miss: { line: "It's my money in there, same vault, same terms.", receipt: null },
    },
  },
];

export const AUTOPSY = {
  rug: {
    source: "TRUE — it did pay every day. He just couldn't say how much of it was other people's deposits.",
    apy: "SHADED — annualised from the good weeks.",
    withdrawals: "SHADED — nobody had tested an exit at size, which is not the same as nobody wanting one.",
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
  legit: (v) => `${v.name} is still paying. Lower than the headline, published every month, funded by an actual trade. A high number isn't a lie — it's a question, and this one had an answer.`,
};
