// Case 003 — first lens-trap case. Three lenses (Ethos, Pathos, Mythos) read
// clean; one lens (Logos) catches a stealth proxy-admin backdoor. Player who
// skips Trinity will trust the surface and miss the rug.
//
// Teaching beat: visible governance is not the same as actual control. A 3/5
// multisig on the governance module means nothing if the proxy admin slot is
// a single EOA. The audit didn't cover the admin slot, which is the bridge
// between Monk's amber AUDIT entry and Trinity's red findings.

const CASE_003 = {
  id: "case-003",
  difficulty: "intermediate",
  projectName: "MERIDIAN PROTOCOL",
  ticker: "$MRDN",
  chain: "Base",
  tagline: "Institutional-grade onchain yield strategies, audited end-to-end",
  surfaceMetrics: {
    age: "38 days",
    mcap: "$4.2M",
    holders: "3,260",
    price: "$0.042",
    change24h: "+6%",
    socialScore: "7.4/10",
  },

  stations: {
    monk: {
      character: "Saint GR80",
      role: "ETHOS · CREDIBILITY",
      sigil: "✠",
      tagline: "Trust nothing the team says about itself. Watch what they've already done.",
      voice: { voice: "9", lang: 1, engine: 1 },
      intro: {
        text:
          "Meridian arrives dressed in proper robes. Real names, a real audit, real investors. " +
          "The surface is calm. Calm is sometimes peace. Calm is sometimes the moment before a wave. " +
          "Examine the credentials, but do not let credentials examine you.",
        audio: "case003_monk_intro",
      },
      returnLines: [
        "The credentials still hold. Keep reading them.",
        "Robes are easy to borrow. Continue.",
        "Return with new questions. The file has not moved.",
      ],
      questions: [
        {
          q: "Who is behind the protocol?",
          a: {
            text:
              "Three founders, all named. Two carry visible histories at established yield protocols. " +
              "Conference talks, public commit graphs, professional networks unhidden. The team has decided to be seen.",
            audio: "case003_monk_q1",
          },
          reveals: "TEAM IDENTITY",
        },
        {
          q: "Was the contract audited?",
          a: {
            text:
              "Trail of Bits delivered a public report. Three lows, one medium, all marked resolved. " +
              "An honest audit, by an honest firm. But read the scope, not only the verdict. An audit covers what it is asked to cover.",
            audio: "case003_monk_q2",
          },
          reveals: "AUDIT",
        },
        {
          q: "Where did the funding come from?",
          a: {
            text:
              "One point two million in seed, from named DeFi funds, routed through a treasury multisig before the launch pool. " +
              "The money has a parentage. That is good. Parentage is not destiny.",
            audio: "case003_monk_q3",
          },
          reveals: "FUNDING",
        },
        {
          q: "Have these builders shipped before?",
          a: {
            text:
              "Two of three have shipped serious protocols. Real contribution graphs, real reviews, real production code. " +
              "The hands have worked. The question is what they are working on now.",
            audio: "case003_monk_q4",
          },
          reveals: "BUILD HISTORY",
        },
      ],
      entries: [
        {
          label: "TEAM IDENTITY",
          value: "3 named founders; verifiable prior roles",
          threat: "green",
          visual: {
            component: "SignalStack",
            props: {
              title: "IDENTITY CHECK",
              items: [
                { tone: "green", label: "Founder identities", value: "PUBLIC", sublabel: "LinkedIn + conference talks + public github", meter: 90 },
                { tone: "green", label: "Prior protocols", value: "VERIFIED", sublabel: "Ex-Aave and ex-MakerDAO contribution history", meter: 84 },
                { tone: "green", label: "Known rug links", value: "0", sublabel: "No shared deployer or wallet cluster with prior scams", meter: 92 },
                { tone: "green", label: "Reputation overlap", value: "BROAD", sublabel: "Cited by 11 unrelated DeFi commentators", meter: 78 },
              ],
            },
            caption:
              "The founders are visible and traceable to real prior work. Identity is not the lie here.",
            metric: { label: "IDENTITY", value: "VISIBLE" },
          },
        },
        {
          label: "AUDIT",
          value: "Trail of Bits — scope excludes proxy admin slot",
          threat: "amber",
          visual: {
            component: "Checklist",
            props: {
              title: "AUDIT SCOPE",
              items: [
                { status: "ok", label: "Strategy contracts", value: "IN" },
                { status: "ok", label: "Vault accounting", value: "IN" },
                { status: "ok", label: "Fee router", value: "IN" },
                { status: "ok", label: "Governance module", value: "IN" },
                { status: "warn", label: "Proxy admin slot", value: "OUT", sublabel: "Explicitly out of scope — see report §1.3" },
                { status: "warn", label: "Upgrade path", value: "OUT", sublabel: "Not reviewed by the auditor" },
              ],
            },
            caption:
              "The audit is real, but the report names two things it did not look at. The most dangerous lines in an audit are the ones describing what it skipped.",
            metric: { label: "OUT OF SCOPE", value: "2" },
          },
        },
        {
          label: "FUNDING",
          value: "$1.2M from named DeFi funds; multisig route",
          threat: "green",
          visual: {
            component: "FlowGraph",
            props: {
              layout: "linear",
              radius: 180,
              nodes: [
                { id: "vc1", label: "Fund A", sublabel: "0.5M", externalLabel: "SEED" },
                { id: "vc2", label: "Fund B", sublabel: "0.4M", externalLabel: "SEED" },
                { id: "vc3", label: "Fund C", sublabel: "0.3M", externalLabel: "SEED" },
                { id: "treasury", label: "3/5", sublabel: "treasury", externalLabel: "MULTISIG", highlight: true },
                { id: "lp", label: "$MRDN", sublabel: "LP", externalLabel: "LAUNCH" },
              ],
              edges: [
                { from: "vc1", to: "treasury" },
                { from: "vc2", to: "treasury" },
                { from: "vc3", to: "treasury" },
                { from: "treasury", to: "lp" },
              ],
            },
            caption:
              "Seed capital came from named DeFi funds into a treasury multisig before reaching the LP. No mixer hop, no fresh-wallet laundering — for the public capital, at least.",
            metric: { label: "MIXER HOPS", value: "0" },
          },
        },
        {
          label: "BUILD HISTORY",
          value: "2 of 3 founders with prior protocol commits",
          threat: "green",
          visual: {
            component: "Comparison",
            props: {
              direction: "row",
              panels: [
                {
                  title: "Founder A",
                  subtitle: "ex-Aave",
                  tone: "green",
                  lines: [
                    { text: "412 merged PRs" },
                    { text: "2.5 yrs tenure" },
                    { text: "public talks: 6", color: "#8effc4" },
                  ],
                },
                {
                  title: "Founder B",
                  subtitle: "ex-MakerDAO",
                  tone: "green",
                  lines: [
                    { text: "237 merged PRs" },
                    { text: "1.8 yrs tenure" },
                    { text: "forum posts: 89", color: "#8effc4" },
                  ],
                },
                {
                  title: "Founder C",
                  subtitle: "new",
                  tone: "amber",
                  lines: [
                    { text: "no prior protocol" },
                    { text: "github: 4 mo old" },
                    { text: "role: ops", color: "#ffb84d" },
                  ],
                },
              ],
            },
            caption:
              "Two of three have substantive prior work. The third is newer and runs ops — neither disqualifying nor a smoking gun on its own.",
            metric: { label: "VERIFIED", value: "2/3" },
          },
        },
        {
          label: "GOVERNANCE",
          value: "3/5 multisig on governance module",
          threat: "green",
          visual: {
            component: "Checklist",
            props: {
              title: "GOVERNANCE SURFACE",
              items: [
                { status: "ok", label: "Signer count", value: "3/5" },
                { status: "ok", label: "Signer identities", value: "NAMED" },
                { status: "ok", label: "Execution delay", value: "24H" },
                { status: "ok", label: "Param changes", value: "TIMELOCKED" },
              ],
            },
            caption:
              "The governance module shown to the public is well-formed: named signers, threshold, timelock. This is the part of the contract the team wants you to see.",
            metric: { label: "DELAY", value: "24H" },
          },
        },
      ],
      summary: "Names, audits, and named capital all hold. The credentials are real. Credentials describe the past.",
      verdictReaction: {
        believe: { text: "Trust offered to the proven is not vanity. It is reason.", audio: "case003_monk_react_believ" },
        abstain: { text: "An audit you did not finish reading is a warning you did not finish hearing.", audio: "case003_monk_react_abstai" },
        doubt:   { text: "Doubt aimed at names is harsh. Doubt aimed at scope is wisdom. Be sure which you carry.", audio: "case003_monk_react_doubt" },
      },
      vindication: {
        aligned:   { text: "Credentials describe the past, not the future. You did not confuse the two.", audio: "case003_monk_vind_aligned" },
        missed:    { text: "Honest names can be used as a screen. The work is to ask what the screen is hiding.", audio: "case003_monk_vind_missed" },
        abstained: { text: "Caution before unfinished evidence is acceptable. Aim to be more sure next time.", audio: "case003_monk_vind_abstain" },
      },
    },

    demon: {
      character: "John Barron",
      role: "PATHOS · SENTIMENT",
      sigil: "✦",
      tagline: "Sentiment is theater. Strip the script and read the cast.",
      voice: "2",
      intro: {
        text:
          "I came in ready to gut this one. Big name, big audit, big shiny landing page — classic exit-liquidity bait. " +
          "Then I looked at the crowd. It's annoyingly grown-up. Not a single rocket emoji. I hate it. Continue.",
        audio: "case003_demon_intro",
      },
      returnLines: [
        { text: "You're back. Smart. Very smart.", audio: "demon_return_1" },
        { text: "Good. You're back. I was getting bored.", audio: "demon_return_2" },
        { text: "Round two. Let's go.", audio: "demon_return_3" },
      ],
      questions: [
        {
          q: "Are the followers real?",
          a: {
            text:
              "Sixty-eight percent of followers are over a year old. DeFi natives. Pseudonyms with histories, real reply patterns, even some boring people. " +
              "This is not a rented audience. This is the kind of crowd you cannot fake without a year of patience.",
            audio: "case003_demon_q1",
          },
          reveals: "AUDIENCE QUALITY",
        },
        {
          q: "What is the community actually saying?",
          a: {
            text:
              "Strategy parameter questions. Fee split debates. One thread complaining the dashboard is ugly. " +
              "If this is a script, it is the most boring script ever written. Believable in a way that almost insults me.",
            audio: "case003_demon_q2",
          },
          reveals: "DISCOURSE",
        },
        {
          q: "Is anyone shilling this for money?",
          a: {
            text:
              "A few mid-tier DeFi analysts wrote neutral reviews. No coordinated post wave, no shared talking points, no synchronized launch hour. " +
              "If they paid for promotion, they paid a very disorganized cartel.",
            audio: "case003_demon_q3",
          },
          reveals: "PROMOTION",
        },
        {
          q: "How are critics handled?",
          a: {
            text:
              "There's a pinned skeptic thread questioning the emissions schedule. Still up. Team replied, didn't win the argument, didn't delete it. " +
              "Healthy. Mature. Suspiciously well-adjusted.",
            audio: "case003_demon_q4",
          },
          reveals: "CRITICISM",
        },
      ],
      entries: [
        {
          label: "AUDIENCE QUALITY",
          value: "68% accounts older than 1 year",
          threat: "green",
          visual: {
            component: "Pie",
            props: {
              centerLabel: "OLDER",
              centerMetric: "68%",
              radius: 110,
              innerRadius: 56,
              slices: [
                { label: ">1 year", value: 68, highlight: true },
                { label: "90d-1y", value: 22, color: "rgba(109,181,154,0.38)" },
                { label: "<90d", value: 10, color: "rgba(255,184,77,0.44)" },
              ],
            },
            caption:
              "Most followers predate the launch by months. Mature accounts are harder to spin up than fresh ones, and this curve doesn't show a botted bloom.",
            metric: { label: "OLD ACCTS", value: "68%" },
          },
        },
        {
          label: "DISCOURSE",
          value: "Strategy, fees, ops — not moonshots",
          threat: "green",
          visual: {
            component: "Checklist",
            props: {
              title: "TOPIC SAMPLE",
              items: [
                { status: "ok", label: "Strategy allocation Q's", value: "x22", sublabel: "param-level discussion" },
                { status: "ok", label: "Fee split debate", value: "x14", sublabel: "thoughtful disagreement" },
                { status: "ok", label: "Dashboard complaints", value: "x9", sublabel: "real users hitting UX limits" },
                { status: "warn", label: "Listing speculation", value: "x4", sublabel: "low-volume market chatter" },
                { status: "missing", label: "Moon / 100x phrases", value: "x0", sublabel: "no chant pattern" },
              ],
            },
            caption:
              "The room is having product arguments. Botted rooms repeat slogans; this one repeats specifications.",
            metric: { label: "PRODUCT Qs", value: "82%" },
          },
        },
        {
          label: "PROMOTION",
          value: "Scattered organic coverage; no shill swarm",
          threat: "green",
          visual: {
            component: "SignalStack",
            props: {
              title: "PROMOTION PATTERN",
              items: [
                { tone: "green", label: "Same-hour shill wave", value: "0", sublabel: "no synchronized launch blast", meter: 90 },
                { tone: "green", label: "Prior rug promoters", value: "0", sublabel: "no overlap with known paid-rug accounts", meter: 88 },
                { tone: "amber", label: "Mid-tier analyst posts", value: "5", sublabel: "neutral framing; no shared talking points", meter: 56 },
                { tone: "green", label: "Cadence", value: "ORGANIC", sublabel: "coverage spread over 18 days, not a single burst", meter: 80 },
              ],
            },
            caption:
              "Promotion looks like real journalists doing real reads. The cartel signal — same hour, same script, same accounts — is missing.",
            metric: { label: "SWARM SCORE", value: "0/10" },
          },
        },
        {
          label: "CRITICISM",
          value: "Skeptic threads remain pinned; team responds",
          threat: "green",
          visual: {
            component: "Timeline",
            props: {
              startLabel: "d-18",
              endLabel: "today",
              events: [
                { position: 0.08, label: "Emissions critique", sublabel: "d-18", tone: "amber" },
                { position: 0.16, label: "Team reply", sublabel: "d-17", tone: "green" },
                { position: 0.34, label: "Audit-scope question", sublabel: "d-12", tone: "amber" },
                { position: 0.42, label: "Team links report", sublabel: "d-11", tone: "green" },
                { position: 0.78, label: "Critique still pinned", sublabel: "today", tone: "green", highlight: true },
              ],
            },
            caption:
              "Hard threads stay visible. Including, notably, one questioning the audit scope — which the team answered without removing.",
            metric: { label: "DELETIONS", value: "0" },
          },
        },
        {
          label: "POST CADENCE",
          value: "Irregular human cadence; no bot bursts",
          threat: "green",
          visual: {
            component: "Timeline",
            props: {
              startLabel: "launch",
              endLabel: "d+38",
              events: [
                { position: 0.04, label: "Launch post", sublabel: "d+0", tone: "green" },
                { position: 0.18, label: "Quiet gap", sublabel: "d+7", tone: "green" },
                { position: 0.36, label: "Strategy update", sublabel: "d+14", tone: "green" },
                { position: 0.58, label: "Audit republish", sublabel: "d+22", tone: "green" },
                { position: 0.92, label: "Roadmap thread", sublabel: "d+35", tone: "green", highlight: true },
              ],
            },
            caption:
              "Posts cluster around real product events with uneven gaps. Bot campaigns pulse on schedule; this looks like humans posting when there's something to say.",
            metric: { label: "BOT BURSTS", value: "0" },
          },
        },
      ],
      summary: "The crowd is grown, the discourse is technical, and the critics are alive. Sentiment reads honest.",
      verdictReaction: {
        believe: { text: "Look at you, trusting a quiet room full of adults. Healthy. Possibly correct.", audio: "case003_demon_react_belie" },
        abstain: { text: "Caution about a clean room. Bold. Slightly cowardly. I respect it.", audio: "case003_demon_react_absta" },
        doubt:   { text: "Doubt on a crowd this calm? Either you see something I don't, or you're fighting the last war.", audio: "case003_demon_react_doubt" },
      },
      vindication: {
        aligned: { text: "Good crowd, bad protocol. That's a new shape for you. Remember it.", audio: "case003_demon_vind_aligne" },
        missed:  { text: "Real audiences can be wrong, sweetheart. The room was honest. The contract was not.", audio: "case003_demon_vind_missed" },
        abstained: { text: "You sat out a clean crowd and got lucky on the contract. Don't mistake luck for skill.", audio: "case003_demon_vind_abstai" },
      },
    },

    marisol: {
      character: "Detective Trinity",
      role: "LOGOS · ONCHAIN",
      sigil: "✧",
      tagline: "The chain doesn't lie. Read the receipts.",
      intro: {
        text:
          "Meridian wants you to look at the lobby. Marble floors, named doormen, framed audit on the wall. " +
          "I'm here for the basement. Show me the wiring nobody talks about.",
        audio: "case003_trinity_intro",
      },
      returnLines: [
        { text: "Thought you might come back.", audio: "trinity_return_1" },
        { text: "What've you got?", audio: "trinity_return_2" },
      ],
      questions: [
        {
          q: "Who actually controls the contract?",
          a: {
            text:
              "The governance module has the 3/5 multisig everyone's pointing at. But the proxy admin slot — the address that can replace the entire implementation contract — is a single externally-owned wallet. " +
              "One key. No timelock. The lobby has five doormen. The basement door has one.",
            audio: "case003_trinity_q1",
          },
          reveals: "PROXY ADMIN",
        },
        {
          q: "Where did that admin key come from?",
          a: {
            text:
              "Funded six weeks before launch through a Railgun mixer chain, then split twice. " +
              "The funding pattern matches two prior protocols that exit-rugged via stealth upgrade in the last nine months. Same fingerprints, different gloves.",
            audio: "case003_trinity_q2",
          },
          reveals: "ADMIN FUNDING",
        },
        {
          q: "Is the holder distribution actually broad?",
          a: {
            text:
              "Surface counts look diverse. Cluster analysis ties thirty-eight percent of supply to wallets sharing the proxy admin's funding source. " +
              "The 'community' allocation is wearing a costume. The same hand is holding it.",
            audio: "case003_trinity_q3",
          },
          reveals: "DEPLOYER CLUSTER",
        },
        {
          q: "Doesn't the LP lock protect holders?",
          a: {
            text:
              "Liquidity is locked. It doesn't matter. A stealth upgrade can install a new transfer hook, a new tax, or a balance-rewrite — drain the holders directly and leave the LP standing as decoration. " +
              "The lock is on the front door. The exit is through the floor.",
            audio: "case003_trinity_q4",
          },
          reveals: "UPGRADE PATH",
        },
      ],
      entries: [
        {
          label: "PROXY ADMIN",
          value: "Single EOA; no timelock; can swap implementation",
          threat: "red",
          visual: {
            component: "FlowGraph",
            props: {
              layout: "linear",
              radius: 180,
              nodes: [
                { id: "users", label: "users", sublabel: "$MRDN holders", externalLabel: "FUNDS" },
                { id: "proxy", label: "Proxy", sublabel: "EIP-1967", externalLabel: "CONTRACT" },
                { id: "impl", label: "impl v1", sublabel: "audited", externalLabel: "LOGIC" },
                { id: "admin", label: "0xc4…91", sublabel: "single EOA", externalLabel: "ADMIN", highlight: true },
              ],
              edges: [
                { from: "users", to: "proxy" },
                { from: "proxy", to: "impl" },
                { from: "admin", to: "proxy" },
              ],
            },
            caption:
              "User funds flow through the proxy to the audited implementation. The proxy admin — a single key with no timelock — can swap that implementation out at will.",
            metric: { label: "ADMIN KEYS", value: "1" },
          },
        },
        {
          label: "ADMIN FUNDING",
          value: "Mixer chain; matches 2 prior upgrade-rug fingerprints",
          threat: "red",
          visual: {
            component: "FlowGraph",
            props: {
              layout: "linear",
              radius: 180,
              nodes: [
                { id: "mixer", label: "Railgun", sublabel: "mixer", externalLabel: "ORIGIN" },
                { id: "hop1", label: "0x7a…12", sublabel: "5 wk old", externalLabel: "HOP 1" },
                { id: "hop2", label: "0x2f…b8", sublabel: "split tx", externalLabel: "HOP 2" },
                { id: "admin", label: "0xc4…91", sublabel: "proxy admin", externalLabel: "DESTINATION", highlight: true },
              ],
              edges: [
                { from: "mixer", to: "hop1" },
                { from: "hop1", to: "hop2" },
                { from: "hop2", to: "admin" },
              ],
            },
            caption:
              "The admin key was funded out of a mixer, through two intermediate hops, six weeks before launch. The same pattern preceded two protocols that exit-rugged via stealth upgrade.",
            metric: { label: "PATTERN MATCH", value: "2 PRIORS" },
          },
        },
        {
          label: "DEPLOYER CLUSTER",
          value: "38% of supply tied to admin funding source",
          threat: "red",
          visual: {
            component: "Pie",
            props: {
              centerLabel: "HIDDEN",
              centerMetric: "38%",
              radius: 110,
              innerRadius: 56,
              slices: [
                { label: "Admin cluster", value: 38, highlight: true },
                { label: "VC allocation", value: 14, color: "rgba(255,184,77,0.44)" },
                { label: "Treasury", value: 8, color: "rgba(109,181,154,0.38)" },
                { label: "Public float", value: 40, color: "rgba(109,181,154,0.26)" },
              ],
            },
            caption:
              "Wallets labeled 'community' or 'early supporter' share funding paths with the proxy admin. The headline distribution looks broad; the cluster analysis says one hand holds 38%.",
            metric: { label: "HIDDEN SUPPLY", value: "38%" },
          },
        },
        {
          label: "AUDIT SCOPE",
          value: "Audit explicitly excluded proxy admin & upgrade path",
          threat: "red",
          visual: {
            component: "Checklist",
            props: {
              title: "WHAT THE AUDIT DIDN'T COVER",
              items: [
                { status: "missing", label: "Proxy admin slot", value: "EXCLUDED", sublabel: "Stated in report §1.3" },
                { status: "missing", label: "Upgrade authorization", value: "EXCLUDED", sublabel: "Outside engagement scope" },
                { status: "missing", label: "Storage layout drift", value: "EXCLUDED", sublabel: "Not reviewed across versions" },
                { status: "warn", label: "Audit recency", value: "PRE-DEPLOY", sublabel: "Implementation could be swapped post-audit" },
              ],
            },
            caption:
              "The Trail of Bits report is real and rigorous within its scope. The scope leaves the door the rug walks through.",
            metric: { label: "RUG VECTORS", value: "OPEN" },
          },
        },
        {
          label: "UPGRADE PATH",
          value: "LP lock is bypassable via implementation swap",
          threat: "red",
          visual: {
            component: "SignalStack",
            props: {
              title: "WHY THE LP LOCK FAILS",
              items: [
                { tone: "red", label: "Transfer hook injection", value: "POSSIBLE", sublabel: "new impl can route or block transfers", meter: 92 },
                { tone: "red", label: "Balance rewrite", value: "POSSIBLE", sublabel: "new impl can zero holder balances", meter: 88 },
                { tone: "red", label: "Tax escalator", value: "POSSIBLE", sublabel: "new impl can set sell tax to 99%", meter: 90 },
                { tone: "amber", label: "Detection lag", value: "MINUTES", sublabel: "upgrade tx is public, but reaction window is small", meter: 28 },
              ],
            },
            caption:
              "A stealth contract upgrade can drain holders without ever touching the LP. The locked liquidity is the decoy, not the defense.",
            metric: { label: "LP LOCK", value: "DECOY" },
          },
        },
      ],
      summary: "The lobby is real. The basement has an unmarked door with one key — and that key has a record.",
      verdictReaction: {
        believe: { text: "Hope you're right, kid. But the basement door is still unlocked.", audio: "case003_trinity_react_bel" },
        abstain: { text: "Reasonable. The evidence here doesn't ask for mercy, but it'll forgive caution.", audio: "case003_trinity_react_abs" },
        doubt:   { text: "Yeah. The credentials are real. The exit is also real.", audio: "case003_trinity_react_dou" },
      },
      vindication: {
        aligned:   { text: "Good read. The lobby fooled three of us. You went to the basement.", audio: "case003_trinity_vind_alig" },
        missed:    { text: "Audit scope is the most important page in any audit. Read it next time before you trust the verdict.", audio: "case003_trinity_vind_miss" },
        abstained: { text: "You walked away from a loaded gun. Next time, read the chamber and call it.", audio: "case003_trinity_vind_abst" },
      },
    },

    eugene: {
      character: "Eugene",
      role: "MYTHOS · NARRATIVE",
      sigil: "❖",
      tagline: "Every rug wears a story. Find the seams.",
      textOnly: true,
      intro:
        "Meridian's pitch is so well-behaved it's almost a personality test. Audits, multisigs, conservative yield. " +
        "It's the kind of story that says 'I am too boring to be a scam' really, really often.",
      returnLines: [
        "Back to the brochure ✨",
        "Hiii — wanna re-read the pitch?",
        "Okay, one more chapter 💫",
      ],
      questions: [
        {
          q: "What is the product story?",
          a:
            "Auto-rebalancing vault that allocates across blue-chip yield strategies — Aave, Compound, Curve. " +
            "Honestly? Sensible. Boring in a good way. The story is not trying to sell you a miracle.",
          reveals: "POSITIONING",
        },
        {
          q: "Does the whitepaper hold up?",
          a:
            "It explains strategies, fee splits, withdrawal mechanics, and rebalance triggers. Real math, real diagrams, no AGI. " +
            "If they're lying, they're lying through competent writing — which is rare and a little impressive.",
          reveals: "WHITEPAPER",
        },
        {
          q: "Are users and TVL claims verifiable?",
          a:
            "TVL number on the dashboard matches Dune. Three named pilot DAOs are deposited and you can see their safes. " +
            "The receipts exist. Whether they tell the whole story is a different question.",
          reveals: "USER PROOF",
        },
        {
          q: "Is anything missing from the narrative?",
          a:
            "Hmm. The pitch talks A LOT about the audit, the multisig, the timelock, the named investors. " +
            "It never once mentions the proxy admin or the upgrade path. That's a weird omission for a story this thorough. Could be nothing. Could be the seam.",
          reveals: "NARRATIVE GAPS",
        },
      ],
      entries: [
        {
          label: "POSITIONING",
          value: "Conservative blue-chip yield aggregator",
          threat: "green",
          visual: {
            component: "SignalStack",
            props: {
              title: "STORY SHAPE",
              items: [
                { tone: "green", label: "Target user", value: "CLEAR", sublabel: "DeFi-native depositors seeking auto-rebalance", meter: 80 },
                { tone: "green", label: "Strategy scope", value: "NARROW", sublabel: "Aave / Compound / Curve only", meter: 78 },
                { tone: "green", label: "Yield claims", value: "MODEST", sublabel: "no guaranteed APR, no fountain language", meter: 82 },
                { tone: "green", label: "Miracle index", value: "LOW", sublabel: "no AGI, no DeFi 3.0, no cosmic finance", meter: 90 },
              ],
            },
            caption:
              "The pitch is small, specific, and avoids the miracle vocabulary that usually signals exit-bait. The story behaves itself.",
            metric: { label: "SCOPE", value: "NARROW" },
          },
        },
        {
          label: "WHITEPAPER",
          value: "Specific mechanics, no miracle claims",
          threat: "green",
          visual: {
            component: "Checklist",
            props: {
              title: "DOCUMENT CHECK",
              items: [
                { status: "ok", label: "Strategy math", value: "YES" },
                { status: "ok", label: "Fee table", value: "YES" },
                { status: "ok", label: "Withdrawal mechanics", value: "YES" },
                { status: "ok", label: "Rebalance triggers", value: "YES" },
                { status: "missing", label: "Guaranteed yield", value: "NONE" },
                { status: "missing", label: "AI / AGI claims", value: "NONE" },
              ],
            },
            caption:
              "The whitepaper spends its pages on real mechanics. That doesn't prove honesty — it proves competence at appearing honest.",
            metric: { label: "MIRACLES", value: "0" },
          },
        },
        {
          label: "USER PROOF",
          value: "3 pilot DAOs with visible deposits",
          threat: "green",
          visual: {
            component: "Comparison",
            props: {
              direction: "row",
              panels: [
                {
                  title: "Tidal DAO",
                  subtitle: "pilot",
                  tone: "green",
                  lines: [
                    { text: "safe: 0x84e1…b2c4" },
                    { text: "deposit: 320k" },
                    { text: "active: d-2", color: "#8effc4" },
                  ],
                },
                {
                  title: "Loom Collective",
                  subtitle: "pilot",
                  tone: "green",
                  lines: [
                    { text: "safe: 0x1aa0…ef91" },
                    { text: "deposit: 180k" },
                    { text: "active: d-4", color: "#8effc4" },
                  ],
                },
                {
                  title: "Outpost Labs",
                  subtitle: "pilot",
                  tone: "green",
                  lines: [
                    { text: "safe: 0xd0bb…7710" },
                    { text: "deposit: 240k" },
                    { text: "active: d-1", color: "#8effc4" },
                  ],
                },
              ],
            },
            caption:
              "The pilot users are real and depositing. The product is being used. That tells you a real protocol exists — it doesn't tell you the protocol is safe.",
            metric: { label: "PILOTS", value: "3" },
          },
        },
        {
          label: "NARRATIVE GAPS",
          value: "Upgrade path never mentioned in any public material",
          threat: "amber",
          visual: {
            component: "Checklist",
            props: {
              title: "WHAT THE STORY MENTIONS",
              items: [
                { status: "ok", label: "Audit", value: "x47", sublabel: "mentioned repeatedly across docs" },
                { status: "ok", label: "Governance multisig", value: "x31", sublabel: "featured in landing page hero" },
                { status: "ok", label: "Timelock", value: "x22", sublabel: "called out as a safety feature" },
                { status: "ok", label: "Named investors", value: "x18", sublabel: "logos and quotes" },
                { status: "missing", label: "Proxy admin", value: "x0", sublabel: "never mentioned anywhere public" },
                { status: "missing", label: "Upgrade authorization", value: "x0", sublabel: "absent from all materials" },
              ],
            },
            caption:
              "A story this detail-oriented chooses what to leave out. The two missing topics happen to be the two that control whether the rest of the safeguards matter.",
            metric: { label: "OMITTED", value: "2" },
          },
        },
        {
          label: "TONE",
          value: "Disciplined, restrained, faintly over-rehearsed",
          threat: "green",
          visual: {
            component: "SignalStack",
            props: {
              title: "VOICE READ",
              items: [
                { tone: "green", label: "Hype language", value: "LOW", sublabel: "no 100x / mooning / revolution vocabulary", meter: 86 },
                { tone: "green", label: "Specificity", value: "HIGH", sublabel: "numbers, addresses, concrete mechanics", meter: 80 },
                { tone: "amber", label: "Risk discussion", value: "PARTIAL", sublabel: "covers market risk; silent on admin risk", meter: 48 },
                { tone: "amber", label: "Polish", value: "HEAVY", sublabel: "every sentence is on-message; little human friction", meter: 42 },
              ],
            },
            caption:
              "The voice is grown-up and specific, but it's also unusually polished. Real teams usually leave a few rough edges. This one didn't.",
            metric: { label: "FRICTION", value: "LOW" },
          },
        },
      ],
      summary: "The story behaves perfectly. The only seam is what it never says.",
      verdictReaction: {
        believe: "Sure! The brochure is clean and the receipts check. Just remember the brochure picks what to print.",
        abstain: "Fair. Sometimes a story that's too tidy isn't lying — it's just not telling you everything.",
        doubt:   "Bold. The story is good. If you're doubting, you're trusting a gap more than a paragraph.",
      },
      vindication: {
        aligned:   "You read the absence, not just the words. That's the upgrade.",
        missed:    "The story was real. It was just incomplete. Always ask what the brochure didn't print.",
        abstained: "You smelled the polish without finding the seam. Half the lesson.",
      },
    },
  },

  maxScans: 3,
  correctVerdict: "doubt",

  reveal: {
    summary:
      "MERIDIAN PROTOCOL was upgraded via stealth proxy admin transaction on day 51. " +
      "New implementation rewrote holder balances and routed remaining liquidity to the admin EOA. " +
      "~$1.8M extracted. The Trail of Bits report, the multisig, and the LP lock all remained technically intact.",
    voices: {
      believe:
        "You trusted the credentials. The names were real, the audit was real, and the rug still happened — because the audit scope didn't include the door it walked through.",
      abstain:
        "Capital preserved. The signal was there, but it took the chain to surface it. Learn to spend at least one scan on Trinity when the surface looks too clean.",
      doubt:
        "Correct. Audit scope excluded the proxy admin, the admin key had a mixer-funded history, and the 'community' float was a costume. Three clean lenses can still lose to one onchain finding.",
    },
  },
};

export default CASE_003;
