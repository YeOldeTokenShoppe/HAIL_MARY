const CASE_002 = {
  id: "case-002",
  difficulty: "beginner",
  projectName: "HARBORLIGHT",
  ticker: "$HBR",
  chain: "Base",
  tagline: "Onchain treasury tools for creator collectives",
  surfaceMetrics: {
    age: "22 days",
    mcap: "$780K",
    holders: "1,904",
    price: "$0.018",
    change24h: "-18%",
    socialScore: "5.6/10",
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
          "HarborLight arrives without fireworks. No prophecy. No promised riches. " +
          "Only a small tool, a smaller market, and a team asking to be trusted. " +
          "Quiet can still hide a storm, but quiet is not itself a sin.",
      },
      returnLines: [
        "The harbor remains still. Continue.",
        "A modest claim deserves a careful reading.",
        "Not every candle is a confession. Let us keep looking.",
      ],
      questions: [
        {
          q: "Who is responsible for the project?",
          a: {
            text:
              "The founders are public, almost inconveniently so. Old talks, old repos, " +
              "and two failed products they did not scrub from the record. That is not sainthood. It is continuity.",
          },
          reveals: "TEAM HISTORY",
        },
        {
          q: "Have they built anything real?",
          a: {
            text:
              "There is a working treasury dashboard, three months of commits, and public issue replies. " +
              "Not a cathedral. A foundation. Foundations matter.",
          },
          reveals: "BUILD RECORD",
        },
        {
          q: "Where did launch funding come from?",
          a: {
            text:
              "Seed liquidity came from two known creator DAOs into a multisig, then into the pool. " +
              "No mixer trail. No sudden ghost money. The path has names.",
          },
          reveals: "FUNDING SOURCE",
        },
        {
          q: "Can governance still harm holders?",
          a: {
            text:
              "Yes. Admin power remains. But it sits behind a three-of-five multisig and a forty-eight-hour timelock. " +
              "The sword is still there. It is sheathed in procedure.",
          },
          reveals: "ADMIN CONTROLS",
        },
      ],
      entries: [
        {
          label: "TEAM HISTORY",
          value: "Public founders; prior DAO tooling work; no rug links",
          threat: "green",
          visual: {
            component: "SignalStack",
            props: {
              title: "IDENTITY CHECK",
              items: [
                { tone: "green", label: "Founder identities", value: "PUBLIC", sublabel: "Linked talks, old repos, and DAO forum history", meter: 92 },
                { tone: "green", label: "Prior work", value: "2 TOOLS", sublabel: "Multisig exporter and contributor payout module", meter: 78 },
                { tone: "amber", label: "Failed products", value: "2", sublabel: "Still visible; postmortems were not deleted", meter: 44 },
                { tone: "green", label: "Known rug links", value: "0", sublabel: "No shared deployer, promoter, or wallet cluster found", meter: 96 },
              ],
            },
            caption:
              "The founders are not anonymous, and their older failures are still inspectable. That does not guarantee success, but it argues against a disposable identity.",
            metric: { label: "IDENTITY", value: "VISIBLE" },
          },
        },
        {
          label: "BUILD RECORD",
          value: "Active repo, 312 commits, public issue replies",
          threat: "green",
          visual: {
            component: "Timeline",
            props: {
              startLabel: "d-94",
              endLabel: "now",
              events: [
                { position: 0.04, label: "Repo opened", sublabel: "d-94", tone: "green" },
                { position: 0.25, label: "Treasury beta", sublabel: "d-61", tone: "green" },
                { position: 0.42, label: "Audit issue fixed", sublabel: "d-39", tone: "green" },
                { position: 0.58, label: "Public demo", sublabel: "d-27", tone: "green" },
                { position: 0.75, label: "Token launch", sublabel: "d-22", tone: "amber" },
                { position: 0.93, label: "312 commits", sublabel: "today", tone: "green", highlight: true },
              ],
            },
            caption:
              "The product history predates the token launch. Real build activity came first; the token was not the only artifact.",
            metric: { label: "COMMITS", value: "312" },
          },
        },
        {
          label: "FUNDING SOURCE",
          value: "Seeded by 2 known creator DAOs; no mixer path",
          threat: "green",
          visual: {
            component: "FlowGraph",
            props: {
              layout: "linear",
              radius: 180,
              nodes: [
                { id: "dao1", label: "DAO A", sublabel: "24 ETH", externalLabel: "SEED" },
                { id: "dao2", label: "DAO B", sublabel: "18 ETH", externalLabel: "SEED" },
                { id: "multi", label: "3/5", sublabel: "multisig", externalLabel: "TREASURY", highlight: true },
                { id: "lp", label: "$HBR", sublabel: "LP", externalLabel: "LAUNCH" },
              ],
              edges: [
                { from: "dao1", to: "multi" },
                { from: "dao2", to: "multi" },
                { from: "multi", to: "lp" },
              ],
            },
            caption:
              "Launch funds came from named DAO treasuries into a multisig, then into the LP. There is no mixer hop or fresh-wallet laundering path.",
            metric: { label: "MIXER HOPS", value: "0" },
          },
        },
        {
          label: "ADMIN CONTROLS",
          value: "3/5 multisig + 48h timelock",
          threat: "amber",
          visual: {
            component: "Checklist",
            props: {
              title: "CONTROL SURFACE",
              items: [
                { status: "ok", label: "Admin holder", value: "3/5", sublabel: "multisig, not single EOA" },
                { status: "ok", label: "Execution delay", value: "48H", sublabel: "changes visible before execution" },
                { status: "warn", label: "Upgrade rights", value: "YES", sublabel: "power remains; monitor governance" },
                { status: "ok", label: "Signer labels", value: "5/5", sublabel: "public DAO / founder identities" },
              ],
            },
            caption:
              "This is not trustless. It is constrained: named signers, a multisig threshold, and a timelock make a quick admin rug much harder.",
            metric: { label: "DELAY", value: "48H" },
          },
        },
        {
          label: "DISCLOSURE",
          value: "Risks documented in launch post",
          threat: "green",
          visual: {
            component: "SignalStack",
            props: {
              title: "DISCLOSURE REVIEW",
              items: [
                { tone: "green", label: "Admin risk", value: "NAMED", sublabel: "Upgrade rights called out in launch post", meter: 88 },
                { tone: "green", label: "Adoption risk", value: "NAMED", sublabel: "Niche creator workflow; no mass-market claim", meter: 82 },
                { tone: "amber", label: "Market risk", value: "THIN", sublabel: "Small LP means price can move sharply", meter: 45 },
                { tone: "green", label: "Revenue claims", value: "MODEST", sublabel: "No promised yield or guaranteed buybacks", meter: 76 },
              ],
            },
            caption:
              "Healthy files often name their own weak spots. HarborLight admits control, liquidity, and adoption risk instead of hiding them behind hype.",
            metric: { label: "RISKS NAMED", value: "4" },
          },
        },
      ],
      summary: "The team is visible, the build predates the token, and control is constrained. Credibility holds.",
      verdictReaction: {
        believe: { text: "Trust, then, but not worship. Evidence supports them. Time must still test them." },
        abstain: { text: "Caution is permitted. So is courage. The line between them is where judgment lives." },
        doubt: { text: "Suspicion is a tool. Do not let it become a cage." },
      },
      vindication: {
        aligned: { text: "You distinguished modesty from deceit. Well done." },
        missed: { text: "A quiet file can be legitimate. Learn the difference between absence of hype and absence of truth." },
        abstained: { text: "You preserved capital, though the signal favored trust." },
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
          "No rockets. No cult chants. No cartoon army screaming one hundred x. " +
          "It's weirdly refreshing. Suspiciously adult. I hate how much I don't hate it.",
      },
      returnLines: [
        { text: "Back for the crowd read. Good." },
        { text: "Sentiment, my favorite legal hallucination." },
        { text: "Let's see if the room is real or just expensive wallpaper." },
      ],
      questions: [
        {
          q: "Is the audience bought?",
          a: {
            text:
              "Follower growth is slow and annoyingly human. Old accounts, uneven posting, people disagreeing in public. " +
              "Terrible for hype. Excellent for reality.",
          },
          reveals: "FOLLOWER QUALITY",
        },
        {
          q: "What is the community saying?",
          a: {
            text:
              "The room is asking product questions: export limits, multisig support, fees. " +
              "Not moon chants. Actual users are very rude to narratives.",
          },
          reveals: "COMMUNITY TOPICS",
        },
        {
          q: "Who's promoting it?",
          a: {
            text:
              "Two small analysts got free allocations and said so. That's still incentive, sweetheart. " +
              "But it is not a paid megaphone swarm pretending to be destiny.",
          },
          reveals: "PROMOTION PATTERN",
        },
        {
          q: "Are critics being silenced?",
          a: {
            text:
              "Negative posts are still up. One fee complaint got a correction from the team, in public. " +
              "Annoyingly healthy. Deeply inconvenient for my brand.",
          },
          reveals: "CRITICISM HANDLING",
        },
      ],
      entries: [
        {
          label: "FOLLOWER QUALITY",
          value: "74% accounts older than 1 year; organic growth curve",
          threat: "green",
          visual: {
            component: "Pie",
            props: {
              centerLabel: "OLDER",
              centerMetric: "74%",
              radius: 110,
              innerRadius: 56,
              slices: [
                { label: ">1 year", value: 74, highlight: true },
                { label: "90d-1y", value: 17, color: "rgba(109,181,154,0.38)" },
                { label: "<90d", value: 9, color: "rgba(255,184,77,0.44)" },
              ],
            },
            caption:
              "Most followers predate launch by a wide margin. A small young-account tail is normal; an audience made entirely yesterday is not.",
            metric: { label: "OLD ACCTS", value: "74%" },
          },
        },
        {
          label: "COMMUNITY TOPICS",
          value: "Product questions dominate Telegram",
          threat: "green",
          visual: {
            component: "Checklist",
            props: {
              title: "MESSAGE SAMPLE",
              items: [
                { status: "ok", label: "Can we export CSV from a Safe?", value: "x14", sublabel: "implementation question" },
                { status: "ok", label: "How are signer roles mapped?", value: "x9", sublabel: "workflow question" },
                { status: "ok", label: "Fee table clarification", value: "x6", sublabel: "pricing discussion" },
                { status: "warn", label: "When listings?", value: "x3", sublabel: "market chatter, low volume" },
                { status: "missing", label: "Moon / 100x phrases", value: "x0", sublabel: "no coordinated chant detected" },
              ],
            },
            caption:
              "The community is talking about product limits, signer roles, and fees. That is less exciting than hype, but much harder to fake at scale.",
            metric: { label: "PRODUCT Qs", value: "78%" },
          },
        },
        {
          label: "PROMOTION PATTERN",
          value: "2 disclosed allocations; no paid swarm detected",
          threat: "amber",
          visual: {
            component: "SignalStack",
            props: {
              title: "PROMOTION REVIEW",
              items: [
                { tone: "amber", label: "Analyst allocations", value: "2", sublabel: "free token grants disclosed in posts", meter: 38 },
                { tone: "green", label: "Same-hour shill wave", value: "0", sublabel: "no synchronized influencer blast", meter: 92 },
                { tone: "green", label: "Prior rug promoters", value: "0", sublabel: "no overlap with known paid-rug accounts", meter: 88 },
                { tone: "amber", label: "Incentive clarity", value: "MIXED", sublabel: "allocations are disclosed, but still incentives", meter: 48 },
              ],
            },
            caption:
              "Promotion is not perfectly clean: allocations create incentives. The important distinction is disclosure plus no paid megaphone swarm.",
            metric: { label: "DISCLOSED", value: "2" },
          },
        },
        {
          label: "CRITICISM HANDLING",
          value: "Critical posts remain visible; team replies in-thread",
          threat: "green",
          visual: {
            component: "Timeline",
            props: {
              startLabel: "09:00",
              endLabel: "14:00",
              events: [
                { position: 0.08, label: "Fee complaint", sublabel: "09:18", tone: "amber" },
                { position: 0.18, label: "Team reply", sublabel: "09:31", tone: "green" },
                { position: 0.38, label: "Admin-risk question", sublabel: "10:42", tone: "amber" },
                { position: 0.48, label: "Docs linked", sublabel: "10:57", tone: "green" },
                { position: 0.74, label: "Post still visible", sublabel: "12:46", tone: "green", highlight: true },
              ],
            },
            caption:
              "Hard questions remain visible and get answered in-thread. That is the opposite of a suppression pattern.",
            metric: { label: "DELETIONS", value: "0" },
          },
        },
        {
          label: "POST CADENCE",
          value: "Irregular human cadence, no bot burst",
          threat: "green",
          visual: {
            component: "Timeline",
            props: {
              startLabel: "launch",
              endLabel: "d+22",
              events: [
                { position: 0.05, label: "Launch post", sublabel: "d+0", tone: "green" },
                { position: 0.22, label: "Quiet gap", sublabel: "d+4", tone: "green" },
                { position: 0.41, label: "Bugfix thread", sublabel: "d+9", tone: "green" },
                { position: 0.63, label: "DAO pilot", sublabel: "d+14", tone: "green" },
                { position: 0.86, label: "Fee update", sublabel: "d+20", tone: "green", highlight: true },
              ],
            },
            caption:
              "Posts arrive around product events with uneven gaps. Bot campaigns tend to pulse on a schedule; this looks like a small team communicating when something changes.",
            metric: { label: "BOT BURSTS", value: "0" },
          },
        },
      ],
      summary: "The room looks small, real, and product-focused. Sentiment is restrained, which helps.",
      verdictReaction: {
        believe: { text: "Look at you, backing the boring horse. Honestly? I respect it." },
        abstain: { text: "Fine. Caution has good branding these days." },
        doubt: { text: "You may be fighting the last war. This crowd is quiet, not fake." },
      },
      vindication: {
        aligned: { text: "The little room was real. Strange feeling, right?" },
        missed: { text: "Not every quiet chart is a corpse. Sometimes it is just a room without fireworks." },
        abstained: { text: "You did not lose. You also did not learn to trust clean signals yet." },
      },
    },
    marisol: {
      character: "Detective Trinity",
      role: "LOGOS · ONCHAIN",
      sigil: "✧",
      tagline: "The chain doesn't lie. Read the receipts.",
      intro: {
        text:
          "HarborLight is a cleaner file than Prophet. Cleaner does not mean cleared. " +
          "We still check the wallets, the locks, and the doors nobody mentions.",
      },
      returnLines: [
        { text: "Thought you might want the receipts." },
        { text: "Let's stay with the wallets." },
        { text: "Clean files still leave fingerprints." },
      ],
      questions: [
        {
          q: "How concentrated is supply?",
          a: {
            text:
              "Top ten wallets hold thirty-two percent. That is not nothing. But most are labeled treasury or vesting contracts. " +
              "Concentrated, yes. Anonymous, no.",
          },
          reveals: "TOP 10 HOLDERS",
        },
        {
          q: "Are insiders selling?",
          a: {
            text:
              "Team wallets have not sold. One advisor moved tokens into vesting after launch. " +
              "That is a paper trail, not a dump.",
          },
          reveals: "INSIDER FLOWS",
        },
        {
          q: "Is the volume wash traded?",
          a: {
            text:
              "Volume is thin, but counterparties are broad. No tight loop, no mirrored timing, no circular pump engine. " +
              "Thin is a liquidity problem. Circular is a fraud problem.",
          },
          reveals: "VOLUME QUALITY",
        },
        {
          q: "Is liquidity protected?",
          a: {
            text:
              "Liquidity is locked for one year. Not forever, and not magic. " +
              "But long enough to make the quick-rug math ugly.",
          },
          reveals: "LP LOCK",
        },
      ],
      entries: [
        {
          label: "TOP 10 HOLDERS",
          value: "32%; most labeled treasury / vesting",
          threat: "amber",
          visual: {
            component: "Pie",
            props: {
              centerLabel: "TOP 10",
              centerMetric: "32%",
              radius: 110,
              innerRadius: 56,
              slices: [
                { label: "Treasury", value: 12, color: "rgba(77,255,170,0.70)" },
                { label: "Vesting", value: 11, color: "rgba(77,255,170,0.48)" },
                { label: "Advisors", value: 9, highlight: true },
                { label: "Float", value: 68, color: "rgba(109,181,154,0.26)" },
              ],
            },
            caption:
              "The top-ten share is worth monitoring, but most of it is labeled treasury or vesting supply rather than anonymous dump wallets.",
            metric: { label: "TOP 10", value: "32%" },
          },
        },
        {
          label: "INSIDER FLOWS",
          value: "No team sells; advisor tokens moved to vesting",
          threat: "green",
          visual: {
            component: "FlowGraph",
            props: {
              layout: "linear",
              radius: 180,
              nodes: [
                { id: "advisor", label: "advisor", sublabel: "2.4M", externalLabel: "ALLOC" },
                { id: "vesting", label: "vesting", sublabel: "12 mo", externalLabel: "LOCK", highlight: true },
                { id: "team", label: "team", sublabel: "0 sells", externalLabel: "HOLD" },
                { id: "market", label: "DEX", sublabel: "none", externalLabel: "SELLS" },
              ],
              edges: [
                { from: "advisor", to: "vesting" },
                { from: "team", to: "vesting" },
              ],
            },
            caption:
              "The notable insider movement goes into vesting, not out to the market. That is a restraint signal.",
            metric: { label: "TEAM SELLS", value: "0" },
          },
        },
        {
          label: "VOLUME QUALITY",
          value: "Thin but non-circular; no wash loop detected",
          threat: "green",
          visual: {
            component: "FlowGraph",
            props: {
              layout: "circular",
              radius: 138,
              nodes: [
                { id: "a", label: "0x41…92" },
                { id: "b", label: "0x9b…03" },
                { id: "c", label: "0x72…c1" },
                { id: "d", label: "0xe4…8a" },
                { id: "e", label: "0x13…ff" },
                { id: "f", label: "0xaa…70" },
                { id: "dex", label: "DEX", sublabel: "pool", highlight: true },
              ],
              edges: [
                { from: "a", to: "dex" },
                { from: "b", to: "dex" },
                { from: "c", to: "dex" },
                { from: "d", to: "dex" },
                { from: "e", to: "dex" },
                { from: "f", to: "dex" },
              ],
            },
            caption:
              "Trades converge on the pool from many counterparties instead of cycling through the same closed wallet loop.",
            metric: { label: "CLOSED LOOPS", value: "0" },
          },
        },
        {
          label: "LP LOCK",
          value: "Liquidity locked for 365 days",
          threat: "green",
          visual: {
            component: "Timeline",
            props: {
              startLabel: "launch",
              endLabel: "365d",
              events: [
                { position: 0.02, label: "LP created", sublabel: "d+0", tone: "green" },
                { position: 0.06, label: "Lock tx", sublabel: "same block", tone: "green", highlight: true },
                { position: 0.33, label: "Quarter check", sublabel: "90d", tone: "green" },
                { position: 0.66, label: "Halfway", sublabel: "180d", tone: "green" },
                { position: 0.98, label: "Unlock", sublabel: "365d", tone: "amber" },
              ],
            },
            caption:
              "A one-year LP lock does not remove all risk, but it blocks the fast pull that defines most beginner rug files.",
            metric: { label: "LOCK", value: "365D" },
          },
        },
        {
          label: "TAX / FREEZE",
          value: "No blacklist, freeze, or hidden mint path",
          threat: "green",
          visual: {
            component: "Checklist",
            props: {
              title: "CONTRACT SCAN",
              items: [
                { status: "ok", label: "Blacklist function", value: "NONE" },
                { status: "ok", label: "Freeze transfers", value: "NONE" },
                { status: "ok", label: "Hidden mint", value: "NONE" },
                { status: "ok", label: "Sell-tax setter", value: "NONE" },
                { status: "warn", label: "Upgradeable proxy", value: "YES", sublabel: "mitigated by multisig + timelock" },
              ],
            },
            caption:
              "The obvious holder-trap functions are absent. Upgradeability remains the watch item, but it is governed by the control stack shown elsewhere.",
            metric: { label: "TRAPS", value: "0/4" },
          },
        },
      ],
      summary: "Onchain risk exists, but the obvious rug mechanics are absent.",
      verdictReaction: {
        believe: { text: "That's where the receipts point. Keep your eyes open, but yes." },
        abstain: { text: "Reasonable. Thin markets punish impatience." },
        doubt: { text: "Maybe. But show me the mechanism. Suspicion still needs a body." },
      },
      vindication: {
        aligned: { text: "Good read. You trusted the evidence without falling in love with it." },
        missed: { text: "You saw risk and called fraud. Those are not the same thing." },
        abstained: { text: "Acceptable, but the clean signals were there." },
      },
    },
    eugene: {
      character: "Eugene",
      role: "MYTHOS · NARRATIVE",
      sigil: "❖",
      tagline: "Every rug wears a story. Find the seams.",
      textOnly: true,
      intro:
        "This one is giving municipal software, but in a good way. Less prophecy, more spreadsheets. " +
        "The question is whether boring means honest, or just better disguised.",
      returnLines: [
        "Back to the brochure.",
        "Let's read the story with our glasses on.",
        "The vibes are wearing a cardigan. Suspicious, but cozy.",
      ],
      questions: [
        {
          q: "What is the product story?",
          a:
            "Creator collectives need shared treasury controls. That is narrow, boring, and believable. " +
            "Honestly, I love a project that knows it is not saving civilization.",
          reveals: "POSITIONING",
        },
        {
          q: "Does the whitepaper overpromise?",
          a:
            "It mostly explains fees, roles, and limits. There is no AGI, no revolution, no cosmic yield fountain. " +
            "Just constraints. Beautiful little constraints.",
          reveals: "WHITEPAPER",
        },
        {
          q: "Is there real user proof?",
          a:
            "Three small collectives are named with public treasury addresses. You can verify the claim without trusting the paragraph. " +
            "That is the good kind of boring.",
          reveals: "USER PROOF",
        },
        {
          q: "What is the weak spot?",
          a:
            "Revenue depends on creators adopting a niche workflow. Legit does not mean inevitable. " +
            "A real product can still become a very honest ghost town.",
          reveals: "ADOPTION RISK",
        },
      ],
      entries: [
        {
          label: "POSITIONING",
          value: "Narrow DAO treasury workflow",
          threat: "green",
          visual: {
            component: "SignalStack",
            props: {
              title: "STORY SHAPE",
              items: [
                { tone: "green", label: "Target user", value: "CLEAR", sublabel: "creator collectives with shared treasuries", meter: 84 },
                { tone: "green", label: "Use case", value: "NARROW", sublabel: "export, roles, signer visibility", meter: 78 },
                { tone: "green", label: "Revenue model", value: "FEES", sublabel: "plain subscription + usage fees", meter: 72 },
                { tone: "amber", label: "Market size", value: "SMALL", sublabel: "legit does not mean inevitable", meter: 42 },
              ],
            },
            caption:
              "The pitch is narrow enough to test. It names a specific workflow instead of promising to remake finance.",
            metric: { label: "SCOPE", value: "NARROW" },
          },
        },
        {
          label: "WHITEPAPER",
          value: "Specific limits and fees; no miracle claims",
          threat: "green",
          visual: {
            component: "Checklist",
            props: {
              title: "DOCUMENT CHECK",
              items: [
                { status: "ok", label: "Fee table", value: "YES" },
                { status: "ok", label: "Role permissions", value: "YES" },
                { status: "ok", label: "Export limits", value: "YES" },
                { status: "ok", label: "Admin risks", value: "YES" },
                { status: "missing", label: "Guaranteed yield", value: "NONE" },
                { status: "missing", label: "AI miracle claim", value: "NONE" },
              ],
            },
            caption:
              "The document spends its space on boring product constraints. That is a good sign in a market full of miracle language.",
            metric: { label: "MIRACLES", value: "0" },
          },
        },
        {
          label: "USER PROOF",
          value: "3 named pilot collectives with public addresses",
          threat: "green",
          visual: {
            component: "Comparison",
            props: {
              direction: "row",
              panels: [
                {
                  title: "North Pier",
                  subtitle: "pilot",
                  tone: "green",
                  lines: [
                    { text: "safe: 0x71c2...a941" },
                    { text: "exports: 18" },
                    { text: "last use: d-2", color: "#8effc4" },
                  ],
                },
                {
                  title: "Glasshouse",
                  subtitle: "pilot",
                  tone: "green",
                  lines: [
                    { text: "safe: 0x0e44...bb10" },
                    { text: "exports: 7" },
                    { text: "last use: d-5", color: "#8effc4" },
                  ],
                },
                {
                  title: "Minor Keys",
                  subtitle: "pilot",
                  tone: "green",
                  lines: [
                    { text: "safe: 0x95aa...0d6e" },
                    { text: "exports: 11" },
                    { text: "last use: d-1", color: "#8effc4" },
                  ],
                },
              ],
            },
            caption:
              "The pilot users are named and tied to public treasury addresses. The claim can be checked without trusting a testimonial.",
            metric: { label: "PILOTS", value: "3" },
          },
        },
        {
          label: "ADOPTION RISK",
          value: "Small market; product-market fit unproven",
          threat: "amber",
          visual: {
            component: "SignalStack",
            props: {
              title: "NON-FRAUD RISK",
              items: [
                { tone: "amber", label: "Addressable market", value: "NICHE", sublabel: "creator DAOs are a small buyer pool", meter: 38 },
                { tone: "amber", label: "Revenue proof", value: "EARLY", sublabel: "pilots active, paid conversion unknown", meter: 42 },
                { tone: "green", label: "Fraud mechanism", value: "LOW", sublabel: "no obvious rug path in current evidence", meter: 76 },
                { tone: "amber", label: "Token need", value: "DEBATABLE", sublabel: "product could work without a liquid token", meter: 50 },
              ],
            },
            caption:
              "This is the key lesson: a project can be legitimate and still be a bad trade. Adoption risk is not the same thing as fraud.",
            metric: { label: "FIT", value: "UNPROVEN" },
          },
        },
        {
          label: "CLAIM CHECK",
          value: "Most claims independently verifiable",
          threat: "green",
          visual: {
            component: "Checklist",
            props: {
              title: "VERIFY WITHOUT TRUST",
              items: [
                { status: "ok", label: "Pilot addresses", value: "PUBLIC" },
                { status: "ok", label: "Repo history", value: "PUBLIC" },
                { status: "ok", label: "LP lock transaction", value: "PUBLIC" },
                { status: "ok", label: "Multisig signers", value: "PUBLIC" },
                { status: "warn", label: "Future adoption", value: "UNKNOWN", sublabel: "cannot be proven at launch" },
              ],
            },
            caption:
              "The strongest claims are independently checkable. The uncertain part is future demand, which is a market risk rather than a deception signal.",
            metric: { label: "CHECKABLE", value: "4/5" },
          },
        },
      ],
      summary: "The story is narrow enough to be true. The main risk is adoption, not deception.",
      verdictReaction: {
        believe: "Yes. We love a boring little use case with receipts.",
        abstain: "Fair. The market could still ignore it completely.",
        doubt: "Hmm. That feels like trauma from the last file talking.",
      },
      vindication: {
        aligned: "You found the difference between low hype and low integrity.",
        missed: "You mistook modesty for fraud. It happens.",
        abstained: "Not wrong, but there was enough here to lean in.",
      },
    },
  },
  maxScans: 3,
  correctVerdict: "believe",
  reveal: {
    summary: "HARBORLIGHT remained active. No rug event. Product shipped v1.1 after 41 days.",
    voices: {
      believe: "Correct. HarborLight had adoption risk, but not fraud structure. Trust the receipts, not the noise.",
      abstain: "Capital preserved, but the evidence supported a cautious trust. Learn to separate risk from scam.",
      doubt: "You overcorrected. Clean controls, public team, locked liquidity, and real users pointed away from fraud.",
    },
  },
};

export default CASE_002;
