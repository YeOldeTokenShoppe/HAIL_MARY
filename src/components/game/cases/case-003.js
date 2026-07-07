// Case 003 — the "sophisticated rug" case. No single lens screams danger.
// MERIDIAN PROTOCOL looks genuinely legit: reputable team, completed audit,
// locked LP, distributed-looking holders, coherent roadmap. The danger is
// SUBTLE and SPREAD across lenses — each red flag is individually dismissible.
//
// Teaching beat: a confident TRUST is the trap. The exit was pre-built and the
// credentials are all REAL. The case only cracks if the player connects dots
// ACROSS lenses: a proxy-admin upgrade path that the audit excluded (Marisol),
// plus a co-founder/admin-key with a quietly-funded prior-soft-rug history
// (GR80). Either alone is dismissible; together they describe a planned exit.
// With only 3 scans, WHICH lenses you pick decides whether you see it.
// decisiveLenses: ["marisol", "monk"]. The ideal play is a measured lean-doubt.

const CASE_003 = {
  id: "case-003",
  difficulty: "advanced",
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
      voice: { voice: "9", lang: 1, engine: 1, effect: "T", effLevel: 3 },
      intro: {
        text:
          "Meridian arrives in proper robes. Real names, a real audit, real investors. " +
          "Most of this congregation has clean hands. Most. " +
          "The lie, if there is one, will not stand at the pulpit. It sits quietly in a back pew. Look there.",
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
              "Three founders, all named, all visible. Two carry clean histories at established yield protocols. " +
              "The third is newer, runs operations, keeps a quieter footprint. The roster, on its face, is respectable.",
            audio: "case003_monk_q1",
          },
          reveals: "TEAM IDENTITY",
        },
        {
          q: "Was the contract audited?",
          a: {
            text:
              "Trail of Bits delivered a public report. Three lows, one medium, all marked resolved. An honest audit, by an honest firm. " +
              "But read the scope, not only the verdict. A report tells you what it looked at. And just as quietly, what it did not.",
            audio: "case003_monk_q2",
          },
          reveals: "AUDIT",
        },
        {
          q: "Where did the funding come from?",
          a: {
            text:
              "One point two million in seed, from named DeFi funds, routed through a treasury multisig before the launch pool. " +
              "The public capital has clean parentage. But not every wallet with a key came through the front door. One arrived another way.",
            audio: "case003_monk_q3",
          },
          reveals: "FUNDING",
        },
        {
          q: "Has anyone here failed before?",
          a: {
            text:
              "Two founders have shipped serious work. The operations partner once co-launched a yield project that quietly wound down. Depositors made whole on paper, the cause never examined. No charges, no headlines. " +
              "A footnote, not a verdict. But footnotes are where patterns hide.",
            audio: "case003_monk_q4",
          },
          reveals: "PRIOR OUTCOMES",
        },
      ],
      entries: [
        {
          label: "TEAM IDENTITY",
          value: "3 named founders; 2 with verifiable prior roles",
          threat: "green",
          visual: {
            component: "SignalStack",
            props: {
              title: "IDENTITY CHECK",
              items: [
                { tone: "green", label: "Founder identities", value: "PUBLIC", sublabel: "LinkedIn + conference talks + public github", meter: 90 },
                { tone: "green", label: "Prior protocols", value: "VERIFIED", sublabel: "Ex-Aave and ex-MakerDAO contribution history", meter: 84 },
                { tone: "green", label: "Reputation overlap", value: "BROAD", sublabel: "Cited by 11 unrelated DeFi commentators", meter: 78 },
                { tone: "amber", label: "Ops partner footprint", value: "THIN", sublabel: "Newer, quieter, fewer public traces than the other two", meter: 50 },
              ],
            },
            caption:
              "Two of three founders are visible and traceable to real prior work. The third is real but lightly documented. Identity is not the headline lie here.",
            metric: { label: "IDENTITY", value: "VISIBLE" },
          },
        },
        {
          label: "AUDIT",
          value: "Trail of Bits — clean within scope; scope excludes upgrade path",
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
                { status: "warn", label: "Proxy admin slot", value: "OUT", sublabel: "Marked out of scope — see report section one point three" },
                { status: "warn", label: "Upgrade path", value: "OUT", sublabel: "Not reviewed by the auditor" },
              ],
            },
            caption:
              "The audit is real and clean for what it covered. It also names two things it did not look at. The most important lines in a report are sometimes the ones describing what it skipped.",
            metric: { label: "OUT OF SCOPE", value: "2" },
          },
        },
        {
          label: "FUNDING",
          value: "$1.2M public seed from named DeFi funds; multisig route",
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
                { id: "lp", label: "MRDN", sublabel: "LP", externalLabel: "LAUNCH" },
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
          label: "PRIOR OUTCOMES",
          value: "Ops partner co-launched a project that quietly wound down; never examined",
          threat: "red",
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
                    { text: "clean exit history" },
                    { text: "public talks: 6", color: "#8effc4" },
                  ],
                },
                {
                  title: "Founder B",
                  subtitle: "ex-MakerDAO",
                  tone: "green",
                  lines: [
                    { text: "237 merged PRs" },
                    { text: "clean exit history" },
                    { text: "forum posts: 89", color: "#8effc4" },
                  ],
                },
                {
                  title: "Ops Partner",
                  subtitle: "prior: wound-down yield project",
                  tone: "red",
                  lines: [
                    { text: "1 prior launch" },
                    { text: "soft wind-down, d~60" },
                    { text: "no charges · no inquiry", color: "#ff8d8d" },
                  ],
                },
              ],
            },
            caption:
              "Two founders have spotless histories. The operations partner has one prior launch that wound down softly — depositors nominally repaid, the cause never investigated. Dismissible alone. It only matters if someone else holds a matching door open.",
            metric: { label: "FLAGGED", value: "1/3" },
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
      summary: "The names, the audit, the named capital all hold. One founder has a soft prior failure no one examined. A footnote — unless another lens names the door he could reuse.",
      verdictReaction: {
        believe: { text: "Trust offered to the proven is reason. Trust offered to the unexamined is hope wearing reason's robe.", audio: "case003_monk_react_believ" },
        abstain: { text: "An audit you did not finish reading is a warning you did not finish hearing. Caution is not cowardice.", audio: "case003_monk_react_abstai" },
        doubt:   { text: "Doubt aimed at clean names is harsh. Doubt aimed at the one quiet name, and the door the audit skipped — that is wisdom.", audio: "case003_monk_react_doubt" },
      },
      vindication: {
        aligned:   { text: "You did not let two clean men vouch for the third. The footnote was the warning. You read it.", audio: "case003_monk_vind_aligned" },
        missed:    { text: "Honest names can shelter one quiet hand. The work is to ask which door that hand already knows how to open.", audio: "case003_monk_vind_missed" },
        abstained: { text: "Caution before a faint signal is acceptable. One more reading, on the right page, would have made you certain.", audio: "case003_monk_vind_abstain" },
      },
    },

    demon: {
      character: "John Barron",
      role: "PATHOS · SENTIMENT",
      sigil: "✦",
      tagline: "Sentiment is theater. Strip the script and read the cast.",
      voice: { voice: "2", effect: "T", effLevel: 3 },
      intro: {
        text:
          "I came in ready to gut this one. Big name, big audit, shiny landing page. Classic exit-liquidity bait. " +
          "Then I looked at the crowd, and it's annoyingly grown-up. Real people, real arguments, no rocket emojis. " +
          "Almost too clean. The earliest fans are a little TOO in sync for strangers. Probably nothing. Probably. Continue.",
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
              "Sixty-eight percent of followers are over a year old. DeFi natives, pseudonyms with histories, real reply patterns, some genuinely boring people. " +
              "This is not a rented audience. You can't fake this without a year of patience.",
            audio: "case003_demon_q1",
          },
          reveals: "AUDIENCE QUALITY",
        },
        {
          q: "What is the community actually saying?",
          a: {
            text:
              "Strategy parameter questions, fee-split debates, one thread roasting the dashboard. Product talk, not chant. " +
              "If this is a script, it's the most boring script ever written. Believable in a way that almost insults me.",
            audio: "case003_demon_q2",
          },
          reveals: "DISCOURSE",
        },
        {
          q: "Who hyped this the earliest?",
          a: {
            text:
              "Here's the thing that itches. A dozen of the very first 'organic' supporters all started posting inside the same eighteen-hour window, before any coverage, with oddly similar framing. " +
              "Could be a private group of early adopters who found it together. Could be a seeded crowd built to look grassroots. I genuinely can't tell. And that bothers me.",
            audio: "case003_demon_q3",
          },
          reveals: "EARLY SEEDING",
        },
        {
          q: "How are critics handled?",
          a: {
            text:
              "A pinned skeptic thread questioning the emissions schedule, still up. Team replied, didn't win, didn't delete. " +
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
          label: "EARLY SEEDING",
          value: "12 'organic' first-movers clustered in an 18h pre-coverage window",
          threat: "amber",
          visual: {
            component: "Timeline",
            props: {
              startLabel: "pre-launch",
              endLabel: "d+3",
              events: [
                { position: 0.06, label: "First supporter posts begin", sublabel: "h+0", tone: "amber" },
                { position: 0.10, label: "11 more, similar framing", sublabel: "h+0 to h+18", tone: "amber", highlight: true },
                { position: 0.40, label: "First neutral coverage", sublabel: "d+2", tone: "green" },
                { position: 0.70, label: "Organic growth continues", sublabel: "d+3", tone: "green" },
              ],
            },
            caption:
              "A dozen of the earliest 'organic' voices appeared in one tight window with matching framing, before any press. It reads like either a private early-adopter group or a seeded crowd dressed as grassroots. Dismissible as enthusiasm — unless something else says the founders plan to leave.",
            metric: { label: "CLUSTERED", value: "12" },
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
          value: "Mostly human cadence; one suspiciously tidy opening burst",
          threat: "amber",
          visual: {
            component: "Timeline",
            props: {
              startLabel: "launch",
              endLabel: "d+38",
              events: [
                { position: 0.04, label: "Coordinated opening burst", sublabel: "d+0", tone: "amber" },
                { position: 0.18, label: "Quiet gap", sublabel: "d+7", tone: "green" },
                { position: 0.36, label: "Strategy update", sublabel: "d+14", tone: "green" },
                { position: 0.58, label: "Audit republish", sublabel: "d+22", tone: "green" },
                { position: 0.92, label: "Roadmap thread", sublabel: "d+35", tone: "green", highlight: true },
              ],
            },
            caption:
              "After day zero the cadence is human and uneven — clearly real people. But the opening burst is tidier than organic launches usually are, matching the early-supporter cluster. One coordinated push, then genuine momentum.",
            metric: { label: "SEEDED BURST", value: "1" },
          },
        },
      ],
      summary: "The crowd is grown, the discourse is technical, the critics are alive. But the earliest 'organic' fans moved like they were told to. Enthusiasm, or a seeded launch. Can't call it from here alone.",
      verdictReaction: {
        believe: { text: "Trusting a quiet room full of adults. Healthy. Possibly right. Just don't forget who clapped first.", audio: "case003_demon_react_belie" },
        abstain: { text: "Caution on a clean room with one weird opening act. Bold. Slightly cowardly. I respect it.", audio: "case003_demon_react_absta" },
        doubt:   { text: "Doubt on a crowd this calm? Maybe you clocked the seeded first-movers too. Or maybe you're fighting the last war.", audio: "case003_demon_react_doubt" },
      },
      vindication: {
        aligned: { text: "Good crowd, planted front row. The real fans were real. The cheerleaders were hired. You felt the seam.", audio: "case003_demon_vind_aligne" },
        missed:  { text: "Real audiences can be wrong, sweetheart. Most of the room was honest. The opening act was paid to look like them.", audio: "case003_demon_vind_missed" },
        abstained: { text: "You sat out a crowd that was mostly clean and one-twelfth staged. Reasonable hedge. Not quite a read.", audio: "case003_demon_vind_abstai" },
      },
    },

    marisol: {
      character: "Detective Marisol",
      role: "LOGOS · ONCHAIN",
      sigil: "✧",
      tagline: "The chain doesn't lie. Read the receipts.",
      // "Kate" — SitePal TTS fallback (recorded lines use ElevenLabs).
      // Reverb = effect "T" (SitePal "Time" family), level 3 per the docs
      // (Echo=1, Reverb=3, Flanger=2, Phase=4). Affects the TTS fallback only.
      voice: { voice: "3", lang: 1, engine: 3, effect: "T", effLevel: 3 },
      intro: {
        text:
          "Meridian wants you to admire the lobby. Marble floors, named doormen, framed audit on the wall. Honestly? The lobby checks out. " +
          "Locked liquidity, real multisig, distribution that looks broad. I'm here for the basement. The wiring nobody put on the brochure.",
        audio: "case003_trinity_intro",
      },
      returnLines: [
        { text: "Thought you might come back.", audio: "trinity_return_1" },
        { text: "What've you got?", audio: "trinity_return_2" },
      ],
      questions: [
        {
          q: "Is the liquidity actually locked?",
          a: {
            text:
              "It is. Third-party locker, twelve-month term, verifiable on chain. The LP isn't going anywhere by the obvious route. " +
              "On the front door, this protocol's bolted tight. That part's genuinely good news.",
            audio: "case003_trinity_q1",
          },
          reveals: "LP LOCK",
        },
        {
          q: "Is the holder distribution actually broad?",
          a: {
            text:
              "Surface counts look diverse. Three thousand holders, top ten under thirty percent. Clean by the headline. " +
              "But cluster analysis ties about nineteen percent of supply to a handful of wallets that share one funding source and move in lockstep. Labeled 'community.' Behaves like one hand. Not damning on its own. Worth a flag.",
            audio: "case003_trinity_q2",
          },
          reveals: "HOLDER CLUSTER",
        },
        {
          q: "Who can actually change the contract?",
          a: {
            text:
              "Here's the basement. The governance module has the three-of-five multisig everyone points at. But the proxy admin slot — the address that can replace the entire implementation — is a single externally-owned wallet. No timelock. " +
              "And that's exactly the slot the audit marked out of scope. The lobby has five doormen. This door has one, and nobody inspected it.",
            audio: "case003_trinity_q3",
          },
          reveals: "PROXY ADMIN",
        },
        {
          q: "Has that admin key been used yet?",
          a: {
            text:
              "Not yet. The implementation hasn't been swapped since launch, so today, nothing's wrong. That's what makes this hard. " +
              "But a single key, no timelock, controlling an upgrade the auditors never reviewed — that's not a problem until the second it is. Whether it stays unused depends entirely on whose hand holds it.",
            audio: "case003_trinity_q4",
          },
          reveals: "UPGRADE PATH",
        },
      ],
      entries: [
        {
          label: "LP LOCK",
          value: "Third-party locker; 12-month term; verifiable",
          threat: "green",
          visual: {
            component: "Checklist",
            props: {
              title: "LIQUIDITY STATUS",
              items: [
                { status: "ok", label: "LP locked", value: "YES" },
                { status: "ok", label: "Locker", value: "THIRD-PARTY" },
                { status: "ok", label: "Term", value: "12 MONTHS" },
                { status: "ok", label: "On-chain verifiable", value: "YES" },
              ],
            },
            caption:
              "Liquidity is genuinely locked through a reputable third-party locker. By the obvious exit — pulling the pool — holders are protected. This is a real positive, and it's also exactly what makes the protocol look safe.",
            metric: { label: "LP LOCK", value: "REAL" },
          },
        },
        {
          label: "HOLDER CLUSTER",
          value: "~19% of supply in one lockstep cluster labeled 'community'",
          threat: "amber",
          visual: {
            component: "Pie",
            props: {
              centerLabel: "CLUSTER",
              centerMetric: "19%",
              radius: 110,
              innerRadius: 56,
              slices: [
                { label: "Lockstep cluster", value: 19, highlight: true },
                { label: "VC allocation", value: 14, color: "rgba(255,184,77,0.30)" },
                { label: "Treasury", value: 8, color: "rgba(109,181,154,0.38)" },
                { label: "Public float", value: 59, color: "rgba(109,181,154,0.26)" },
              ],
            },
            caption:
              "Headline distribution looks broad. But a slice labeled 'community' shares one funding origin and moves together — one hand wearing a costume. Nineteen percent isn't a controlling stake on its own. Pair it with a one-key upgrade path and it stops being a coincidence.",
            metric: { label: "ONE HAND", value: "19%" },
          },
        },
        {
          label: "PROXY ADMIN",
          value: "Single EOA; no timelock; can swap implementation; audit-excluded",
          threat: "red",
          visual: {
            component: "FlowGraph",
            props: {
              layout: "linear",
              radius: 180,
              nodes: [
                { id: "users", label: "users", sublabel: "MRDN holders", externalLabel: "FUNDS" },
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
              "User funds flow through the proxy to the audited implementation. The proxy admin — a single key, no timelock — can swap that implementation at will. And it's the precise slot the Trail of Bits report excluded from scope. The one door nobody checked.",
            metric: { label: "ADMIN KEYS", value: "1" },
          },
        },
        {
          label: "UPGRADE PATH",
          value: "Unused so far; LP lock is bypassable via implementation swap",
          threat: "red",
          visual: {
            component: "SignalStack",
            props: {
              title: "IF THE KEY EVER MOVES",
              items: [
                { tone: "amber", label: "Implementation swapped yet?", value: "NO", sublabel: "nothing malicious has happened on-chain to date", meter: 30 },
                { tone: "red", label: "Transfer hook injection", value: "POSSIBLE", sublabel: "a new impl could route or block transfers", meter: 90 },
                { tone: "red", label: "Balance rewrite", value: "POSSIBLE", sublabel: "a new impl could zero holder balances", meter: 88 },
                { tone: "red", label: "LP lock relevance", value: "NONE", sublabel: "an upgrade drains holders without touching the locked pool", meter: 92 },
              ],
            },
            caption:
              "The danger is latent, not active — which is exactly why a chain-only read says 'fine.' A stealth upgrade can drain holders without ever touching the locked LP. The lock is the front door; this is the floor. Whether the floor opens depends on the hand on the key.",
            metric: { label: "STATE", value: "LATENT" },
          },
        },
        {
          label: "AUDIT SCOPE",
          value: "Audit excluded the proxy admin & upgrade authorization",
          threat: "amber",
          visual: {
            component: "Checklist",
            props: {
              title: "WHAT THE AUDIT DIDN'T COVER",
              items: [
                { status: "ok", label: "Strategy & vault logic", value: "REVIEWED", sublabel: "clean within scope" },
                { status: "warn", label: "Proxy admin slot", value: "EXCLUDED", sublabel: "stated in report section one point three" },
                { status: "warn", label: "Upgrade authorization", value: "EXCLUDED", sublabel: "outside engagement scope" },
                { status: "warn", label: "Audit recency", value: "PRE-DEPLOY", sublabel: "implementation could be swapped post-audit" },
              ],
            },
            caption:
              "The report is real and rigorous within scope. The scope just happens to stop right at the one slot that controls everything else. A reasonable reader trusts the audit; a careful one reads what it declined to cover.",
            metric: { label: "EXCLUDED", value: "2" },
          },
        },
      ],
      summary: "Lobby's real — LP locked, multisig genuine. But there's a one-key upgrade door the audit skipped, and a costumed cluster behind it. Nothing's been pulled yet. The risk is who holds that key.",
      verdictReaction: {
        believe: { text: "Today the chain backs you, kid. Nothing's been swapped. Just know the basement door's unlocked, and unwatched.", audio: "case003_trinity_react_bel" },
        abstain: { text: "Reasonable. Nothing's happened on-chain yet. But 'yet' is doing a lot of work in that sentence.", audio: "case003_trinity_react_abs" },
        doubt:   { text: "Yeah. LP's locked, audit's real, and there's a one-key door they never reviewed. Name whose key it is, and you've got it.", audio: "case003_trinity_react_dou" },
      },
      vindication: {
        aligned:   { text: "Good read. The locked LP fooled three of us. You went to the basement and found the one door without a guard.", audio: "case003_trinity_vind_alig" },
        missed:    { text: "Audit scope is the most important page in any report. The one slot they skipped is the one that mattered. Read it next time.", audio: "case003_trinity_vind_miss" },
        abstained: { text: "You walked away from a loaded gun that hadn't fired yet. Smart enough. Next time, read the chamber and call it.", audio: "case003_trinity_vind_abst" },
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
        "It's the kind of story that says 'I'm too boring to be a scam' really, really often. Which... is also a thing scams have learned to say. 🤔",
      returnLines: [
        "Back to the brochure ✨",
        "Hiii — wanna re-read the pitch?",
        "Okay, one more chapter 💫",
      ],
      questions: [
        {
          q: "What is the product story?",
          a:
            "Auto-rebalancing vault across blue-chip yield strategies — Aave, Compound, Curve. " +
            "Honestly? Sensible. Boring in a good way. The story isn't trying to sell you a miracle. ✨",
          reveals: "POSITIONING",
        },
        {
          q: "Does the whitepaper hold up?",
          a:
            "It explains strategies, fee splits, withdrawal mechanics, rebalance triggers. Real math, real diagrams, no AGI. " +
            "If they're lying, they're lying through competent writing. Which is rare, and a little impressive.",
          reveals: "WHITEPAPER",
        },
        {
          q: "Have you seen this story shape before?",
          a:
            "Okay, this is the part that gives me a tiny chill. The structure — conservative-yield framing, audit-forward, named-VC social proof, restrained roadmap — matches a template I've seen on a couple of 'sophisticated' exits, almost beat for beat. " +
            "Could just be that good projects converge on good messaging. Could be a playbook. I can't prove which. 😬",
          reveals: "TEMPLATE MATCH",
        },
        {
          q: "Is anything missing from the narrative?",
          a:
            "Hmm. The pitch talks A LOT about the audit, the multisig, the timelock, the named investors. " +
            "It never once mentions the proxy admin or the upgrade path. For a story this thorough, that's a weird thing to leave out. Could be nothing. Could be the seam. 💭",
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
          label: "TEMPLATE MATCH",
          value: "Messaging mirrors a known sophisticated-rug playbook",
          threat: "amber",
          visual: {
            component: "Comparison",
            props: {
              direction: "row",
              panels: [
                {
                  title: "Meridian pitch",
                  subtitle: "observed",
                  tone: "amber",
                  lines: [
                    { text: "conservative-yield framing" },
                    { text: "audit-forward messaging" },
                    { text: "named-VC social proof", color: "#ffb84d" },
                  ],
                },
                {
                  title: "Known soft-exit template",
                  subtitle: "2 prior 'sophisticated' rugs",
                  tone: "amber",
                  lines: [
                    { text: "conservative-yield framing" },
                    { text: "audit-forward messaging" },
                    { text: "named-VC social proof", color: "#ffb84d" },
                  ],
                },
              ],
            },
            caption:
              "The story's structure lines up beat-for-beat with a template seen on a couple of polished exits. It might just be that credible projects converge on credible messaging. But 'too perfectly on-template' is itself a faint tell.",
            metric: { label: "BEAT MATCH", value: "HIGH" },
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
      ],
      summary: "The story behaves perfectly — maybe too perfectly. It mirrors a known soft-exit template and stays silent on the one control that matters: the upgrade path.",
      verdictReaction: {
        believe: "Sure! Clean brochure, receipts check out. Just remember the brochure picks what to print — and this one reads like a brochure that's been printed before. 💭",
        abstain: "Fair. A story this tidy and just a little too on-template isn't proof — but it isn't nothing either.",
        doubt:   "Bold. The story's good. If you're doubting, you're trusting the template echo and the missing paragraph over the pretty words. I respect a girl with sources. 🌟",
      },
      vindication: {
        aligned:   "You read the absence AND the echo, not just the words. That's the upgrade. 🌟",
        missed:    "The story was real — and reused. Always ask what the brochure didn't print, and whether you've read this exact brochure before.",
        abstained: "You smelled the polish without naming the seam. Half the lesson. 💫",
      },
    },
  },

  maxScans: 3,
  correctVerdict: "doubt",
  // No single lens cracks this one. The case-making evidence is SPREAD: the
  // audit-excluded one-key upgrade path (Marisol) plus a co-founder/ops-partner
  // with a quietly-funded prior soft rug (GR80). Either alone is dismissible;
  // together they describe a pre-built exit with a hand that's done it before.
  // Sentiment's seeded first-movers and narrative's template echo are
  // corroborating but not load-bearing. Drives the post-game lens-coaching note.
  decisiveLenses: ["marisol", "monk"],

  reveal: {
    summary:
      "MERIDIAN PROTOCOL rugged on day 61, through the proxy-admin upgrade path the audit never covered. " +
      "A stealth implementation swap rewrote holder balances and routed funds to the admin wallet — the same hand tied to the ops partner's prior soft wind-down. " +
      "~$3.1M extracted. The Trail of Bits report, the named team, the multisig, and the 12-month LP lock all stayed technically intact. Every credential was real. The exit was pre-built.",
    voices: {
      believe:
        "You trusted the credentials, and the credentials were real — the names, the audit, the LP lock all held. The rug happened anyway, because the door they left themselves wasn't in the audit, and the hand on its key had opened one before.",
      doubt:
        "Good read. Three clean-looking lenses — locked LP, real audit, grown-up crowd. But the dots connected: an audit-excluded one-key upgrade path, an ops partner with a buried prior exit, a costumed 'community' cluster, a seeded launch. None of it screamed. Together it whispered a planned exit, and you heard it.",
      abstain:
        "Fair — the signal was faint and spread thin, and no single lens shouted. One more scan on the right lens — the onchain upgrade path, or the team's prior outcomes — would have tipped a measured doubt into a confident one.",
    },
  },
};

export default CASE_003;
