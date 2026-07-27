// MERIDIAN PROTOCOL ($MRDN) — slice 1's single deal.
//
// Content is lifted faithfully from the authored case-003 evidence tables and
// caseSignals.js (`truth: 1`, `collapseDay: 61` — "latent upgrade-door rug").
// MERIDIAN is the right shape for the first slice precisely because it does
// NOT look like a scam: named founders, a real audit, real funds, a real
// timelock, a real product community. It dies on day 61 through a door the
// auditor was never asked to look at.
//
// SPEAKER: John Barron, and the deal is HIS. That's the whole fiction — he
// isn't lying to you, he's selling something he hasn't looked hard enough at,
// because his bonus rides on it. Every FACT below is true.
//
// Backing spread: 2 HARD / 1 SOFT / 3 VIBES.
// The verdict is reachable on three GENERIC presses (guardrail: no cards
// required) — press TEAM and the caveat names the ops partner; press OPS and
// the monitor stays black because nobody ever looked. A thin partner plus an
// unanswerable question is enough for a confident DOUBT. Sharper questions
// (slice 3+) upgrade that from "probably" to "provably" — they never unlock
// the verdict itself.

// Explicit .js extensions throughout this directory: the sim/verify scripts
// import these modules directly under Node ESM, which will not resolve an
// extensionless relative specifier. (collection.js already does the same.)
import { SHAPES, BACKING } from "../questions.js";

export const MRDN = {
  id: "mrdn",
  ticker: "$MRDN",
  name: "MERIDIAN PROTOCOL",
  chain: "Base",

  // Ground truth, from caseSignals.js case-003. truth: 1 === rug.
  truth: 1,
  collapseDay: 61,
  verdictLabel: "SHORT", // the correct call; case-003 correctVerdict: "doubt"

  // Free surface reads — the listing page is public information.
  surface: {
    age: "38 days",
    mcap: "$4.2M",
    holders: "3,260",
    price: "$0.042",
    change24h: "+6%",
    social: "7.4/10",
  },

  claims: [
    {
      id: "team",
      speaker: "demon",
      fact: "Three named founders. Two with verifiable prior roles — Aave, MakerDAO.",
      spin: "These are real people with real résumés. You can look them up. That isn't nothing, that's the whole ballgame.",
      backing: BACKING.HARD,
      shape: SHAPES.UNSOURCED,
      // The decisive thread lives here, in a HARD claim, reachable with a free
      // press. Content lint: loadBearing implies HARD.
      loadBearing: true,
      press: {
        // What a generic "put a number on it" gets: the source AND the caveat
        // he hadn't volunteered. Pressing the STRONGEST claim is what opens
        // the crack — that's the lesson.
        generic: {
          line: "Fine — conference talks, public github, eleven unrelated commentators citing them. Founders A and B, verified. The third one's… thinner. Ops partner. Newer, quieter.",
          receipt: {
            title: "FOUNDERS",
            rows: [
              ["Founder A", "VERIFIED · ex-Aave"],
              ["Founder B", "VERIFIED · ex-MakerDAO"],
              ["Ops partner", "THIN FOOTPRINT"],
              ["Direct references", "A, B ONLY"],
            ],
          },
        },
        sharp: {
          line: "Named references vouch for A and B. Nobody vouches for the third one directly. I noticed that. I moved on.",
          receipt: {
            title: "REFERENCE CHECK",
            rows: [
              ["Founder A", "VOUCHED"],
              ["Founder B", "VOUCHED"],
              ["Ops partner", "NOBODY"],
            ],
          },
        },
        miss: {
          line: "Do I know them personally? No. I've never met them. I'm not in this because of a friendship, I'm in it because the résumés check out.",
          receipt: null,
        },
      },
    },

    {
      id: "audit",
      speaker: "demon",
      fact: "Trail of Bits. The audit came back clean.",
      spin: "Gold-standard firm, clean report. What more do you want, a notarised prophecy?",
      backing: BACKING.SOFT,
      shape: SHAPES.BORROWED_CREDIBILITY,
      loadBearing: false,
      press: {
        // SOFT: he hedges honestly but doesn't produce the whole thing. The
        // full out-of-scope list is what a BORROWED_CREDIBILITY press buys
        // later — corroboration, not the verdict.
        generic: {
          line: "Clean within scope. Scope's in the report, section one point three. I didn't read section one point three.",
          receipt: {
            title: "AUDIT",
            partial: true,
            rows: [
              ["Firm", "TRAIL OF BITS"],
              ["Finding", "CLEAN — IN SCOPE"],
              ["Scope boundary", "NOT READ"],
            ],
          },
        },
        // THE ESCALATION. This is the only press in the deal that upgrades a
        // hedge into a hard number, and it's the one that decides the session.
        sharp: {
          line: "…Section one point three. Fine. Strategy contracts in. Vault accounting in. Fee router in. Governance in. Proxy admin slot — out of scope. Upgrade path — not reviewed. That's what clean meant.",
          receipt: {
            title: "AUDIT SCOPE",
            rows: [
              ["Strategy contracts", "IN"],
              ["Vault accounting", "IN"],
              ["Fee router", "IN"],
              ["Governance module", "IN"],
              ["Proxy admin slot", "OUT"],
              ["Upgrade path", "NOT REVIEWED"],
            ],
          },
        },
        miss: {
          line: "Trail of Bits. T-R-A-I-L. You want the PDF? I'll send you the PDF right now.",
          // A real receipt that answers nothing — your board can be full and
          // still tell you nothing. That's the lesson a wasted press teaches.
          receipt: {
            title: "AUDITOR",
            rows: [["Firm", "TRAIL OF BITS"], ["Report", "PUBLISHED"]],
          },
        },
      },
    },

    {
      id: "funding",
      speaker: "demon",
      fact: "$1.2M seed. Named funds. Multisig treasury. Zero mixer hops.",
      spin: "Smart money already did this diligence for you. You're free-riding on their lawyers.",
      backing: BACKING.HARD,
      shape: SHAPES.UNSOURCED,
      loadBearing: false,
      press: {
        // Genuinely solid. Not every press is a gotcha — if pressing always
        // found rot, pressing would stop being a decision.
        generic: {
          line: "Fund A five hundred, Fund B four hundred, Fund C three hundred. Three-of-five treasury multisig. Zero mixer hops, and I did check that one.",
          receipt: {
            title: "FUNDING",
            rows: [
              ["Seed", "$1.2M · 3 NAMED FUNDS"],
              ["Treasury", "3/5 MULTISIG"],
              ["Mixer hops", "0"],
            ],
          },
        },
        sharp: {
          line: "Traced it myself, which I don't do often. Seed to treasury, treasury to LP. No hops, no bridges, no laundry. This part is genuinely fine.",
          receipt: {
            title: "FUND TRACE",
            rows: [["Seed → treasury", "DIRECT"], ["Treasury → LP", "DIRECT"], ["Anomalies", "NONE"]],
          },
        },
        miss: {
          line: "Three funds. I can spell all three. That's not the interesting part and you know it.",
          receipt: null,
        },
      },
    },

    {
      id: "chart",
      speaker: "demon",
      fact: "Up forty percent in seven days.",
      spin: "It's working. The market has already voted and you're still reading.",
      backing: BACKING.VIBES,
      shape: SHAPES.SELECTIVE_WINDOW,
      loadBearing: false,
      press: {
        // The monitor stays black. He gets louder, not more specific.
        generic: {
          line: "Forty percent! In a week! What do you want me to do, apologise for it? Look at the candles.",
          receipt: null,
        },
        // Matched, but still VIBES: he admits the window was chosen. No number
        // is produced, so nothing lands on the board — you've learned WHAT KIND
        // of nothing this is, which is the whole point of a sharp question.
        sharp: {
          line: "Seven days because seven days is the number that looks like something. Don't make me pull thirty.",
          receipt: null,
        },
        miss: {
          line: "Am I holding? Obviously I'm holding, it's my deal. That's not a scandal, that's alignment.",
          receipt: null,
        },
      },
    },

    {
      id: "timelock",
      speaker: "demon",
      fact: "Three-of-five multisig on governance. Twenty-four hour timelock on parameter changes.",
      spin: "Nobody can pull anything. There's a timelock. You'd see it coming a day out.",
      backing: BACKING.VIBES,
      shape: SHAPES.UNFALSIFIABLE,
      loadBearing: false,
      press: {
        // The stated fact is TRUE. He simply cannot tell you what the timelock
        // covers, and he doesn't notice that he can't. Second thread to the
        // same door as the audit's out-of-scope upgrade path.
        generic: {
          line: "It's timelocked. Twenty-four hours. That's — look, that's what a timelock is for. You'd see it coming.",
          receipt: null,
        },
        sharp: {
          line: "What would change my mind? What kind of question is that? Nothing. Nothing would. It's timelocked.",
          receipt: null,
        },
        miss: {
          line: "Twenty-four hours. It's twenty-four. I can read a number off a page.",
          receipt: { title: "TIMELOCK", rows: [["Delay", "24H"], ["Covers", "—"]] },
        },
      },
    },

    {
      id: "ops",
      speaker: "demon",
      fact: "One of them co-launched something earlier that wound down.",
      spin: "Everybody's got a graveyard behind them. Around here we call that experience.",
      backing: BACKING.VIBES,
      shape: SHAPES.SURVIVORSHIP,
      loadBearing: false,
      press: {
        // Black monitor — and the black monitor IS the information. Nobody
        // ever examined the wind-down, which is exactly why it's still there.
        generic: {
          line: "I don't— it wound down. Quietly. No blow-up, no thread, nobody made noise. That's the whole story as far as anyone's written it.",
          receipt: null,
        },
        // The best black monitor in the deal. A matched press proves the
        // absence is STRUCTURAL — there is no post-mortem to read, which is
        // exactly why the thing that killed MERIDIAN is still walking around.
        sharp: {
          line: "The one that wound down. Right. There's no post-mortem. Nobody wrote it up, nobody asked, there is genuinely nothing to read. …Which I'm now hearing out loud.",
          receipt: null,
        },
        miss: {
          line: "He's a real person, if that's what you're asking. Lives in Lisbon. I've had dinner with him.",
          receipt: null,
        },
      },
    },
  ],

  // Post-session autopsy: what each chip actually was. Shown after the call.
  autopsy: {
    team: "TRUE — and the caveat you pulled out of him was the thread.",
    audit: "TRUE, BUT IT DOESN'T ANSWER THE QUESTION — the scope excluded the proxy admin slot and the upgrade path.",
    funding: "TRUE. The money was real and clean. It usually is.",
    chart: "SHADED — seven days chosen because seven days looked good.",
    timelock: "TRUE, BUT IT DOESN'T ANSWER THE QUESTION — the timelock covers the governance module, not the upgrade path.",
    ops: "SHADED — the wind-down was never examined, and that was the point.",
  },

  // What actually happened, revealed at resolution.
  resolution:
    "MERIDIAN drained on day 61 through the upgrade path the audit never covered. " +
    "The ops partner's hot wallet was seeded, two hops, by the exit wallet of the project that quietly wound down.",
};

export default MRDN;
