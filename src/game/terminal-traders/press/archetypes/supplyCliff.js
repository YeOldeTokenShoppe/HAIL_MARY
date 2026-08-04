// ARCHETYPE — "bad-tokenomics": a real product strangled by its own schedule.
// One of the 13 reads in CASE_PATTERNS (cards.js), and the fourth built.
//
// WHY THIS ONE, AND WHY IT IS NOT A FOURTH WAY TO BE CHEATED.
//
// The first three all resolve as a project surviving or not, so `legit` quietly
// came to mean *succeeded* and the only way to lose money was to be cheated —
// which VC_GAME.md §7 item 7 has called false about the world since 2026-07-28.
// This one is the counter-example that makes the axis say what it always meant:
// THE PRODUCT WORKS, THE TEAM SHIPS, NOBODY STEALS ANYTHING, AND THE TOKEN
// STILL GOES TO A FIFTH OF WHAT YOU PAID — because 48% of supply lands on one
// day into a book that can hold 6%, on a schedule that was published a year in
// advance and that nobody read.
//
// THE AXIS THAT ADMITS IT (2026-08-03, and the rule for archetypes 5–13):
//
//     The binary is "was funding this the right call ON WHAT WAS CHECKABLE AT
//     THE TABLE" — not "did the project survive", and not "did it make money".
//
// The admission test for any bad branch is one question: COULD A SPECIALIST AT
// THAT DESK HAVE FOUND IT BEFORE YOU CALLED? A vesting cliff, a lock date, an
// LP concentration and a fee line are all present facts with receipts, and
// Marisol's lane names `unlocks` explicitly — so this one passes. A played-out
// premise does not, and must never be authored as a bad branch: `[A§16]` says
// nobody at that desk can tell you whether the market will show up, and §7 item
// 7 already files "market never showed" as LEGIT-branch narration, still a
// correct FUND call. Pricing returns needs power-law payoffs, and power-law
// payoffs end properness (invariant 2).
//
// The branch keys are still `rug` / `legit` because the engine reads those two
// strings. Nothing is rugged here. That gap between the key and the meaning is
// the point of this file.
//
// THE BASE RATE IS 25%, AND IT WAS MEASURED, NOT CHOSEN.
// `scripts/sim-press-edge.mjs` reproduces §4's table and then prints what a
// fourth archetype does at each candidate rate. The edge has a closed form —
// `4·STAKE·VAR(base rates)`, i.e. recognition is worth ONLY the spread of the
// priors — so a fourth archetype anywhere between 35% and 79% makes the game
// WORSE by diluting the spread that the first three carry:
//
//       x       world     blind     knows      edge    vs baseline
//     20%       48.0%     +0.04     +5.50     +5.46        +1.66
//     25%       49.3%     +0.01     +4.81     +4.81        +1.01   <- here
//     30%       50.5%     +0.00     +4.25     +4.25        +0.45
//     50%       55.5%     +0.30     +3.25     +2.95        -0.85   FAILS
//     74%       61.5%     +1.32     +4.65     +3.37        -0.43   FAILS
//
// So a HIGH-rug illiquidity archetype — the intuitive version, where the thin
// book usually kills you — would have failed the §4 gate outright. 25% keeps it
// clear of anon-but-real's 30% (two archetypes at one rate are one prior wearing
// two costumes) and clear of the near-deterministic end, where §4's exception
// rate stops doing its job.
//
// AND THAT INVERSION IS THE POINT, NOT A CONCESSION. The complaint this
// archetype answers is that the deal file prints HOLDERS and MCAP, so a player
// can reason "1,985 holders on a $4.1M cap, I could never exit this", FUD an
// honest project, and be marked wrong — good reasoning, punished. The fix is
// NOT to make that read correct. It is to make it CHECKABLE: the surface number
// stays uncorrelated noise (invariant 5 is untouched — nothing here reads
// `deal.surface`), and underneath it sits a specialist who can settle what the
// number actually means. The player who FUDs on the holder count alone is still
// usually wrong. The player who spends Marisol on it is right three quarters of
// the time and knows why. That converts a punished instinct into a press, which
// is the only thing this game has ever been about. [A§13]: copy could not have
// done it.
//
// THE SILHOUETTE, and it is deliberately unlike the other three. Backdoor-fork
// hides a MECHANISM, yield-mirage an ACCOUNTING IDENTITY, anon-but-real hides
// NOTHING and dares you to mistake anonymity for evidence. This one hides a
// SCHEDULE — nothing is concealed, every number is published, and the case is
// pure arithmetic about a date that hasn't arrived. Learning any of the other
// three does not give you this one, because there is no tell to find: there is
// only a multiplication nobody did.
//
// AUTHORING RULES, inherited (VC_GAME.md §4, reasoning in `[A§8]`):
//   - `backing` is SLOT-LEVEL and never per-branch.
//   - `generic` is hoisted to the slot, so the pitcher's shallow answer cannot
//     differ by branch. Only `unlock` keeps a per-branch generic, because
//     invariant 1 requires the decisive claim stay reachable on a free press —
//     press the bot for nothing and you learn whether there is a cliff at all.
//   - `commission` is the DELIBERATE ZERO: identical receipts in both branches
//     at both depths. Every archetype needs one, because scoring coverage of the
//     DISCRIMINATING claims is what teaches that a salesman disguises
//     materiality on purpose. It is also the POSITIONED slot, and it is authored
//     the way §3 says the other two should be rewritten — the bot's interest is
//     in THE CLOSE, never in owning any of this. A commissioned agent has no
//     money in the vault.
//   - PRIORS and AUDITORS come from ../identities.js. They were per-archetype
//     until this file was written and yield-mirage's list was disjoint, which
//     made a trading-desk prior a free archetype read. See that file.
//
// LANE BUDGET: CHAIN x3, RECORD x2, CHART x1, SOCIAL x1. Seven slots, six
// played. CHART and SOCIAL are single-slot lanes, so `mustKeep` pins both and
// the drop always comes out of CHAIN or RECORD — each of which keeps at least
// one. No specialist is ever without a deep target, and CHAIN keeps a real
// choice of two every session, which is where Virgil's agenda earns its keep.

import { SHAPES, BACKING, LANES } from "../questions.js";

export const ARCHETYPE_ID = "bad-tokenomics";
// Plain English, and it names the MECHANISM rather than the vibe, because the
// mechanism is what transfers to the next token (invariant 6).
export const ARCHETYPE_LABEL = "THE SUPPLY THAT HASN'T LANDED YET";
// The transferable half, and deliberately phrased without a villain — this is
// the archetype where there isn't one.
export const ARCHETYPE_TELL =
  "Nothing here is hidden and nothing here is a lie. Ask what the float is on "
  + "the day the vest lands, not on the day you are pitched — the arithmetic is "
  + "the entire case, and it is published.";
// NO EXEMPLAR_COIN, matching anon-but-real. `deal.exemplar` exists only for the
// cut coin-trophy plan and is the last thing tying instanceDeal to cards.js
// (§7 item 4). A new archetype should not add a fifth reference to it.

// 25% / 75%. Measured — see the sweep in the header. Still not deterministic:
// a schedule this shape SOMETIMES eats the town, and a read that goes to 100%
// has stopped being calibrated.
export const OUTCOMES = [
  { outcome: "legit", truth: 0, weight: 75 },
  { outcome: "rug", truth: 1, weight: 25 },
];

// PRIORS AND AUDITORS ARE SHARED — see ../identities.js. instanceDeal reads
// them off the archetype module, so they are re-exported here rather than
// inlined, and there is deliberately no list in this file to drift.
export { PRIORS, AUDITORS } from "../identities.js";

export const SLOTS = [
  {
    // THE DECISIVE THREAD, and it is HARD in both branches — you can always
    // reach the verdict with a free press on the bot. What differs is what the
    // honest answer IS: whether there is a cliff, or a line.
    id: "unlock",
    lane: LANES.CHAIN,
    subject: "WHAT'S STILL LOCKED",
    shape: SHAPES.SELECTIVE_WINDOW,
    loadBearing: true,
    fact: "Circulating float is 14% of supply. The rest is on a published vesting schedule.",
    spin: "Fourteen percent float. That's why it moves the way it does — there is simply nothing to sell. Scarcity isn't the risk here, it's the thesis.",
    backing: BACKING.HARD,
    legit: {
      // Per-branch generic is legal ONLY here: invariant 1 requires the
      // decisive claim stay reachable on a free press, so it must discriminate.
      generic: {
        line: "Linear, forty-eight months, no cliff — it's a straight line and it started the day it launched. Two tranches have already come out the other side. Schedule's published, same page it's been on since before you'd heard of them.",
        receipt: { title: "VESTING SCHEDULE", rows: [["Float today", "14%"], ["Shape", "LINEAR 48M"], ["Cliff", "NONE"], ["Tranches released", "2"]] },
      },
      sharp: {
        line: "Linear from launch, no cliff, and I checked what it lands into rather than taking the shape on faith. The next twelve months release about six percent of supply against a float of fourteen, and no single day is more than half a percent of it. That's a drip, into a book that has been growing faster than the drip.",
        receipt: { title: "SUPPLY AHEAD", rows: [["Next 12M release", "~6% OF SUPPLY"], ["Against float", "14%"], ["Cliff", "NONE"], ["Largest single day", "0.4% OF FLOAT"]] },
      },
    },
    rug: {
      generic: {
        line: "Published schedule, up since day one, nobody's hiding anything. There's a cliff at month nine — that's standard, that's when the early rounds come free. Anyone who took a nine-month lock is long-term by definition or they wouldn't have taken it.",
        receipt: { title: "VESTING SCHEDULE", rows: [["Float today", "14%"], ["Shape", "CLIFF + LINEAR"], ["Cliff", "MONTH 9"], ["Tranches released", "2"]] },
      },
      sharp: {
        line: "Month nine, and here is the number nobody says out loud: it releases about forty-eight percent of supply into a float of fourteen. Three and a half times everything that currently trades, arriving on one date, to three funds whose locks end on that same date. Not one of them has a staged-sell obligation. I'm not telling you they'll sell. I'm telling you the schedule never asks them not to.",
        receipt: { title: "SUPPLY AHEAD", rows: [["Cliff release", "~48% OF SUPPLY"], ["Against float", "14%"], ["Multiple of float", "3.4x"], ["Recipients", "3 FUNDS, ONE DATE"], ["Staged-sell obligation", "NONE"]] },
      },
    },
  },

  {
    id: "depth",
    lane: LANES.CHAIN,
    subject: "THE FLOOR",
    shape: SHAPES.UNSOURCED,
    loadBearing: false,
    fact: "Liquidity is locked. The lock is a contract and its timestamp is public.",
    spin: "Locked liquidity. Nobody is pulling the floor out from under you — go and read the date yourself, it's the one number in this business that can't be argued with.",
    backing: BACKING.HARD,
    generic: {
      line: "It's locked, it's a contract, the date is on it. I'm not going to sit here and pretend I've priced the book for you — that's your job and you have better tools for it than I do. The floor is bolted down. That part is just a fact.",
      receipt: { title: "LIQUIDITY LOCK", rows: [["Locked", "YES"], ["Contract", "PUBLIC"], ["Unlock date", "ON-CHAIN"]] },
    },
    legit: {
      sharp: {
        line: "Locked, and the date is the part he walked past: it runs eleven months beyond the end of the vest. So the floor is still bolted down on the far side of every release there is. And the depth is what you'd want for the size — I put a real exit through it and came out under two percent.",
        receipt: { title: "BOOK DEPTH", rows: [["Lock expires", "11M AFTER VEST"], ["Test exit", "CLEARED"], ["Slippage at size", "UNDER 2%"], ["LP concentration", "DISPERSED"]] },
      },
    },
    rug: {
      sharp: {
        line: "Locked. Expires three weeks before the cliff. And sixty-one percent of what's in there belongs to one wallet, which also appears on the emission list — so the deepest part of the floor is owned by somebody scheduled to receive more of the token. The lock is completely real. It just comes off first.",
        receipt: { title: "BOOK DEPTH", rows: [["Lock expires", "3 WEEKS BEFORE CLIFF"], ["Largest LP share", "61%"], ["That wallet", "ON EMISSION LIST"], ["Slippage at size", "THIN"]] },
      },
    },
  },

  {
    // THE SURFACE NUMBER, MADE PRESSABLE. `holders` is rolled in instanceDeal
    // and asserted uncorrelated with truth (invariant 5), and it stays that way
    // — this slot does not read it as evidence, it makes what it MEANS the
    // subject of a claim. The holder count is true and rising in both branches.
    id: "float",
    lane: LANES.CHAIN,
    subject: "WHO HOLDS IT",
    shape: SHAPES.SURVIVORSHIP,
    loadBearing: false,
    fact: (v) => `${v.holders} holders, and the count has gone up every week since launch.`,
    spin: "That is not a handful of insiders passing it between themselves. That's a distribution, and it's getting wider every week, not narrower.",
    backing: BACKING.HARD,
    generic: {
      line: "It's an explorer page. Count them yourself — I'm not the source, the chain is. Up every week since launch, and I'd say that's the least controversial line on the whole sheet.",
      receipt: { title: "HOLDERS", rows: [["Trend", "UP EVERY WEEK"], ["Source", "BLOCK EXPLORER"]] },
    },
    legit: {
      sharp: {
        line: "Count's real and the composition holds up under it. Top ten non-team wallets are eighteen percent between them, median wallet is two hundred days old, and the new ones arrive small and constant rather than in blocks. That's people finding it. It isn't a list.",
        receipt: { title: "HOLDER BASE", rows: [["Top 10 non-team", "18%"], ["Median wallet age", "203 DAYS"], ["Arrival pattern", "STEADY"], ["Funded from one source", "NO"]] },
      },
    },
    rug: {
      sharp: {
        line: "The count is real. Fifty-eight percent of those wallets were funded out of two addresses inside a single week, and both addresses are on the emission list. It goes up every week because the schedule makes it go up every week. That's a distribution the way a mailing list is a crowd.",
        receipt: { title: "HOLDER BASE", rows: [["Top 10 non-team", "54%"], ["Wallets from 2 sources", "58%"], ["Those sources", "ON EMISSION LIST"], ["Median wallet age", "31 DAYS"]] },
      },
    },
  },

  {
    id: "policy",
    lane: LANES.RECORD,
    subject: "THE SELLING RULES",
    shape: SHAPES.BORROWED_CREDIBILITY,
    loadBearing: false,
    fact: "The treasury publishes a monthly sales cap, and has never exceeded it.",
    spin: "They told you in advance, in writing, exactly how much they would ever sell, and they have not broken it once. Name me another one that does that.",
    backing: BACKING.HARD,
    generic: {
      line: "Published monthly, never breached — a public document with a public track record sitting behind it. Whether you think the cap is set at the right number is a different conversation, and an honest one to have.",
      receipt: { title: "SALES POLICY", rows: [["Published", "MONTHLY"], ["Breaches to date", "0"], ["Document", "PUBLIC"]] },
    },
    legit: {
      sharp: {
        line: "I have read it. The cap is written as a share of trailing volume rather than a token count — so it tightens on its own when the book thins, which is the version that protects you rather than the version that sounds good. And clause six binds the vest recipients to the same cap. It is not a treasury policy. It is a schedule-wide one.",
        receipt: { title: "WHAT THE CAP COVERS", rows: [["Cap basis", "% OF TRAILING VOLUME"], ["Tightens as book thins", "YES"], ["Binds vest recipients", "YES — CL.6"], ["Breaches", "0"]] },
      },
    },
    rug: {
      sharp: {
        line: "I have read it. The cap is a fixed token count, so as the book thins the same permitted sale becomes a larger share of it — the policy loosens at precisely the moment you would want it to tighten. And it binds the treasury. The three funds standing at the cliff are not party to the document at all. It is an honest policy about the one seller who was never going to be the problem.",
        receipt: { title: "WHAT THE CAP COVERS", rows: [["Cap basis", "FIXED TOKEN COUNT"], ["Tightens as book thins", "NO"], ["Binds vest recipients", "NO"], ["Parties bound", "TREASURY ONLY"]] },
      },
    },
  },

  {
    // THE DELIBERATE ZERO — identical receipts in both branches at both depths.
    // Every archetype needs one: `funding` does this job in backdoor-fork and
    // anon-but-real, and scoring coverage of the DISCRIMINATING claims is what
    // teaches that a salesman disguises materiality on purpose. Pressing this
    // sounds like the sharpest question on the floor and settles nothing.
    //
    // IT IS ALSO THE POSITIONED SLOT, authored the way §3 says the other two
    // want rewriting: the bot's interest is in THE CLOSE and never in owning
    // any of this. A commissioned agent has no money in the vault — which is
    // exactly why its interest is structurally undeniable where an owner's is
    // deniable, and why the honest answer here helps you not at all.
    id: "commission",
    lane: LANES.RECORD,
    subject: "WHAT IT'S PAID",
    shape: SHAPES.POSITIONED,
    loadBearing: false,
    fact: "I'm paid a fee on close. It's clause four of the engagement record you were sent.",
    spin: "You already know what I am, so price it in rather than sitting there wondering about it. It doesn't move a single number on that schedule either way.",
    backing: BACKING.HARD,
    generic: {
      line: "Flat fee on close. No trailer, no carry, nothing that pays me a penny if this thing does well two years from now. Clause four. It's your document — I'd rather you read it than take my word for what's in it.",
      receipt: { title: "ENGAGEMENT", rows: [["Fee", "FLAT, ON CLOSE"], ["Continuing interest", "NONE"], ["Clause", "4"]] },
    },
    legit: {
      sharp: {
        line: "Clause four, and it is exactly what it says it is. Flat, on close, no trailer, no clawback. Which means the thing in the beam gets paid whether that schedule holds or not — and that has been true of every deal it has ever walked in here with.",
        receipt: { title: "ENGAGEMENT", rows: [["Fee", "FLAT, ON CLOSE"], ["Continuing interest", "NONE"], ["Clawback", "NONE"], ["Paid if it fails", "YES"]] },
      },
    },
    rug: {
      sharp: {
        line: "Clause four, and it is exactly what it says it is. Flat, on close, no trailer, no clawback. It gets paid whether that schedule holds or not — which has been true of every deal it has ever walked in here with. It is the most honest line in the file and it will not help you.",
        receipt: { title: "ENGAGEMENT", rows: [["Fee", "FLAT, ON CLOSE"], ["Continuing interest", "NONE"], ["Clawback", "NONE"], ["Paid if it fails", "YES"]] },
      },
    },
  },

  {
    id: "absorbed",
    lane: LANES.CHART,
    subject: "THE LAST TWO",
    shape: SHAPES.UNFALSIFIABLE,
    loadBearing: false,
    fact: "Two tranches have unlocked already. The price is higher now than before either of them.",
    spin: "The market has eaten two of these and gone up. I genuinely don't know what more you want from a test.",
    backing: BACKING.SOFT,
    generic: {
      line: "Both landed, both got absorbed, and the chart is higher than it was before either one. That isn't a projection, it's history — and history is the only kind of evidence anybody in this business ever actually has.",
      receipt: { title: "PRIOR UNLOCKS", partial: true, rows: [["Tranches released", "2"], ["Price vs pre-tranche", "HIGHER"], ["Window", "SINCE LAUNCH"]] },
    },
    legit: {
      sharp: {
        line: "I sized them, which is the bit he left out. Those two were three and four percent of float. What's ahead is six over a year and no single day above half a percent. Same order of magnitude, and the book took the first two with a dent that closed inside a week. The comparison actually holds — that's rarer than it sounds.",
        receipt: { title: "TRANCHE ARITHMETIC", rows: [["Tranche 1", "3% OF FLOAT"], ["Tranche 2", "4% OF FLOAT"], ["Largest day ahead", "0.4% OF FLOAT"], ["Recovery after prior", "UNDER 1 WEEK"]] },
      },
    },
    rug: {
      sharp: {
        line: "I sized them. Three percent of float, then four percent of float. The cliff is three hundred and forty percent of float. He isn't lying to you — the market did absorb two unlocks. It's the same event the way a firecracker is the same event as a quarry blast, and the chart he's showing you is the firecracker.",
        receipt: { title: "TRANCHE ARITHMETIC", rows: [["Tranche 1", "3% OF FLOAT"], ["Tranche 2", "4% OF FLOAT"], ["Cliff", "340% OF FLOAT"], ["Precedent applies", "NO"]] },
      },
    },
  },

  {
    id: "demand",
    lane: LANES.SOCIAL,
    subject: "WHO WANTS IT",
    shape: SHAPES.UNSOURCED,
    loadBearing: false,
    fact: (v) => `Fees are up month on month for ${v.days} days running.`,
    spin: "Emissions only matter if nobody wants the thing. People are paying to use it, and they're paying more of it every month.",
    backing: BACKING.HARD,
    generic: {
      line: "Fee line's on the dashboard and it's up every month. People paying to use a thing is the least ambiguous signal there is — everything else on this sheet is an argument, and that one is a receipt.",
      receipt: { title: "FEES", rows: [["Trend", "UP MONTH ON MONTH"], ["Source", "LIVE DASHBOARD"]] },
    },
    legit: {
      sharp: {
        line: "Fees are up, and I went and looked at who is paying them. Four hundred and ten addresses this month. I ran them against the emission list — eleven overlap, and those eleven are two percent of the fees. The demand is coming from outside the schedule. That was the whole question, and the answer is a good one.",
        receipt: { title: "WHO PAYS THE FEES", rows: [["Paying addresses", "410"], ["On emission list", "11"], ["Their share of fees", "2%"], ["Demand source", "EXTERNAL"]] },
      },
    },
    rug: {
      sharp: {
        line: "Fees are up. Sixty percent of them come from nine addresses and all nine are on the emission list. They are paying fees with tokens they were given, which makes that line a measure of the emissions rather than of anybody wanting this. It goes up because the schedule goes up. Nobody is lying to you. It just isn't demand.",
        receipt: { title: "WHO PAYS THE FEES", rows: [["Paying addresses", "386"], ["Top 9 share of fees", "60%"], ["Those 9", "ON EMISSION LIST"], ["Demand source", "THE SCHEDULE"]] },
      },
    },
  },
];

export const AUTOPSY = {
  legit: {
    unlock: "TRUE — a straight line, no cliff, six percent a year into a book growing faster than it. That was the thread.",
    depth: "TRUE — and the lock outlived the vest by eleven months, which is the part that made it worth anything.",
    float: "TRUE — and the wallets were old, small and unrelated. The count meant what it looked like it meant.",
    policy: "TRUE — a cap that tightens as the book thins, and it bound the vest recipients too.",
    commission: "TRUE. It was paid on the close either way. It usually is — that's why it can afford to tell you.",
    absorbed: "TRUE — and this time the two really were the same size as what was coming.",
    demand: "TRUE — four hundred payers, eleven of them on the emission list. Demand from outside the schedule.",
  },
  rug: {
    unlock: "TRUE, AND IT WAS PUBLISHED — month nine, forty-eight percent of supply, 3.4x everything that traded.",
    depth: "TRUE, BUT IT DOESN'T ANSWER THE QUESTION — the lock came off three weeks before the cliff did.",
    float: "TRUE, BUT IT DOESN'T ANSWER THE QUESTION — fifty-eight percent of the wallets, two funders, one week.",
    policy: "TRUE, AND HOLLOW — a real cap, honestly kept, binding the one seller who was never the problem.",
    commission: "TRUE. It was paid on the close either way. It told you so, and it was the only thing that couldn't help you.",
    absorbed: "SHADED — three percent, then four percent, then three hundred and forty. Two of those are a precedent.",
    demand: "TRUE, BUT IT DOESN'T ANSWER THE QUESTION — the fees were the emissions coming back round.",
  },
};

// NOBODY STEALS ANYTHING IN EITHER BRANCH. That is the entire reason this file
// exists, so neither line may reach for a villain, a drain or a disappearance —
// and the rug branch has to state out loud that the project is still running,
// because a player who has met three archetypes arrives expecting a collapse.
export const RESOLUTION = {
  // LEGIT SAYS ONLY THAT THE CLAIMS HELD — see the note in backdoorFork.js.
  legit: () =>
    `The vest ran most of the way through at six percent a year, into a book that grew faster than it did. `
    + `No cliff to survive, and the people paying the fees were never the people being paid in tokens. `
    + `The schedule was the only real risk in the file, and the schedule was survivable — which you could have known, because it was published.`,
  rug: (v) =>
    `${v.name} is still running. The product still works, the team still ships, and nobody ever took anything. `
    + `The cliff landed on day ${v.collapseDay} — forty-eight percent of supply into a book that could hold six — and it went out at a fifth of what you'd have paid. `
    + `Every number that did it was on their own website a year in advance.`,
};
