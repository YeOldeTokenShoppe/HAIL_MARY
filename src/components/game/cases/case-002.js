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
          "HarborLight wears no faces. The founders speak through handles, not names. " +
          "An early coin came to them through a path that flinches under the light. " +
          "Anonymity is not yet a sin, but it is a question that demands an answer.",
        audio: null, // re-record: case002_monk_intro
      },
      returnLines: [
        "The masks remain. Continue, and judge what is behind them.",
        "A hidden face is not yet a guilty one. Keep looking.",
        "Suspicion has knocked. Let us see if anyone answers.",
      ],
      questions: [
        {
          q: "Who is responsible for the project?",
          a: {
            text:
              "No legal names. Only handles: harbor-dev, keel, and two more. " +
              "Pseudonymous, yes. But the same handles carry three years of public commits and old forum scars. The mask is old, and it has a memory.",
            audio: null, // re-record: case002_monk_q1
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
              "Here the file darkens. The earliest deployer coin arrived through a privacy hop before it reached a known creator DAO. " +
              "One murky step, then daylight. A suspicious first breath, not a poisoned bloodline.",
            audio: null, // re-record: case002_monk_q3
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
          value: "Pseudonymous founders; long-lived handles; no rug links",
          threat: "amber",
          visual: {
            component: "SignalStack",
            props: {
              title: "IDENTITY CHECK",
              items: [
                { tone: "amber", label: "Founder identities", value: "PSEUDONYMOUS", sublabel: "Handles only, no legal names disclosed", meter: 40 },
                { tone: "green", label: "Handle age", value: "3 YEARS", sublabel: "Same handles across old repos and forums", meter: 80 },
                { tone: "green", label: "Prior work", value: "2 TOOLS", sublabel: "Multisig exporter and contributor payout module", meter: 78 },
                { tone: "green", label: "Known rug links", value: "0", sublabel: "No shared deployer, promoter, or wallet cluster found", meter: 96 },
              ],
            },
            caption:
              "The team hides its legal names, which looks bad at a glance. But the handles are old and consistent, with no link to any prior rug. Anonymity here reads as caution, not as a disposable identity.",
            metric: { label: "IDENTITY", value: "MASKED" },
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
          value: "Deployer coin took a privacy hop before a known DAO seed",
          threat: "red",
          visual: {
            component: "FlowGraph",
            props: {
              layout: "linear",
              radius: 180,
              nodes: [
                { id: "mixer", label: "privacy hop", sublabel: "1 step", externalLabel: "ORIGIN" },
                { id: "deployer", label: "deployer", sublabel: "first coin", externalLabel: "WALLET", highlight: true },
                { id: "dao", label: "creator DAO", sublabel: "24 ETH", externalLabel: "SEED" },
                { id: "lp", label: "$HBR", sublabel: "LP", externalLabel: "LAUNCH" },
              ],
              edges: [
                { from: "mixer", to: "deployer" },
                { from: "dao", to: "lp" },
                { from: "deployer", to: "lp" },
              ],
            },
            caption:
              "The deployer's earliest coin passed through one privacy hop, which is exactly the silhouette of a launderer. But the bulk of launch funding came from a named DAO in daylight, and the murky step never recurs. One suspicious breath, not a hidden bloodline.",
            metric: { label: "MIXER HOPS", value: "1" },
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
                { status: "ok", label: "Signer labels", value: "5/5", sublabel: "pseudonymous but consistent handles" },
              ],
            },
            caption:
              "This is not trustless. It is constrained: multiple signers, a threshold, and a timelock make a quick admin rug much harder, even with masked names.",
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
                { tone: "green", label: "Anon risk", value: "NAMED", sublabel: "Team admits it is pseudonymous and explains why", meter: 80 },
                { tone: "amber", label: "Market risk", value: "THIN", sublabel: "Small LP means price can move sharply", meter: 45 },
                { tone: "green", label: "Revenue claims", value: "MODEST", sublabel: "No promised yield or guaranteed buybacks", meter: 76 },
              ],
            },
            caption:
              "Healthy files often name their own weak spots. HarborLight admits its anonymity, its control surface, and its thin liquidity instead of hiding them behind hype.",
            metric: { label: "RISKS NAMED", value: "4" },
          },
        },
      ],
      summary: "The team is masked and one funding hop looks ugly, but the handles are old, the links are clean, and the scary signals all have answers.",
      verdictReaction: {
        believe: { text: "A mask is not a confession. The evidence behind it favors them. Time must still test them." },
        abstain: { text: "Caution before hidden faces is permitted. So is courage. Judgment lives on that line." },
        doubt: { text: "Suspicion is a tool. Do not let a single dark hop become the whole verdict." },
      },
      vindication: {
        aligned: { text: "You looked past the mask and the murky hop, and saw they had answers. Well done." },
        missed: { text: "Anonymity and one privacy hop frightened you off a clean file. Learn the difference between a scary surface and a rotten core." },
        abstained: { text: "You preserved capital, though the evidence behind the mask favored trust." },
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
          "Oh, this room is LOUD. Rocket emojis, hundred-x screenshots, a Telegram doing cartwheels at three in the morning. " +
          "Smells like exit liquidity in a party hat. Let's see if the noise is real money or just confetti.",
        audio: null, // re-record: case002_demon_intro
      },
      returnLines: [
        { text: "Back for the crowd read. Brace yourself, it's a circus." },
        { text: "Sentiment, my favorite legal hallucination." },
        { text: "Let's see if this room is a market or a moshpit." },
      ],
      questions: [
        {
          q: "Is the audience bought?",
          a: {
            text:
              "Follower count tripled in a week. Looks like a botted bloom at first squint. " +
              "But three quarters of those accounts are over a year old and argue with each other. Loud, yes. Rented, no.",
            audio: null, // re-record: case002_demon_q1
          },
          reveals: "FOLLOWER QUALITY",
        },
        {
          q: "What is the community saying?",
          a: {
            text:
              "Half the channel is screaming moon and posting green candles. " +
              "The other half, underneath the noise, is asking about export limits and fees. The hype is real volume. So is the product talk hiding under it.",
            audio: null, // re-record: case002_demon_q2
          },
          reveals: "COMMUNITY TOPICS",
        },
        {
          q: "Who's promoting it?",
          a: {
            text:
              "Two loud caller channels grabbed it and went nuclear, hundred-x targets, the whole pump liturgy. " +
              "Ugly optics. But they latched on after launch on their own, got no allocation, and the team never amplified them.",
            audio: null, // re-record: case002_demon_q3
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
          value: "Explosive growth, but 74% accounts older than 1 year",
          threat: "amber",
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
              "The growth spike looks botted at a glance, which is the scary read. But most followers predate launch by a wide margin and behave like real people. The froth is loud, not fake.",
            metric: { label: "OLD ACCTS", value: "74%" },
          },
        },
        {
          label: "COMMUNITY TOPICS",
          value: "Moon chatter on top, product questions underneath",
          threat: "amber",
          visual: {
            component: "Checklist",
            props: {
              title: "MESSAGE SAMPLE",
              items: [
                { status: "warn", label: "Moon / 100x phrases", value: "x41", sublabel: "loud hype layer on top of the channel" },
                { status: "ok", label: "Can we export CSV from a Safe?", value: "x14", sublabel: "implementation question" },
                { status: "ok", label: "How are signer roles mapped?", value: "x9", sublabel: "workflow question" },
                { status: "ok", label: "Fee table clarification", value: "x6", sublabel: "pricing discussion" },
                { status: "warn", label: "When listings?", value: "x18", sublabel: "market chatter, high volume" },
              ],
            },
            caption:
              "The surface layer is pure hype, the exact noise a pump makes. Dig under it and there is a steady seam of product questions a fake room would not bother to fake.",
            metric: { label: "HYPE Qs", value: "58%" },
          },
        },
        {
          label: "PROMOTION PATTERN",
          value: "2 caller channels pumping; no allocation, no team amplification",
          threat: "red",
          visual: {
            component: "SignalStack",
            props: {
              title: "PROMOTION REVIEW",
              items: [
                { tone: "red", label: "Caller-channel pumps", value: "2", sublabel: "100x targets, classic pump liturgy", meter: 22 },
                { tone: "green", label: "Caller allocations", value: "0", sublabel: "callers latched on post-launch, got no tokens", meter: 84 },
                { tone: "green", label: "Team amplification", value: "0", sublabel: "team never retweeted or paid the callers", meter: 88 },
                { tone: "green", label: "Prior rug promoters", value: "0", sublabel: "no overlap with known paid-rug accounts", meter: 86 },
              ],
            },
            caption:
              "Two pump-caller channels screaming 100x is the single ugliest thing on the file. But they attached themselves uninvited, took no allocation, and the team never fed them. Parasites on a real project, not the engine of a scam.",
            metric: { label: "PAID SHILLS", value: "0" },
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
          value: "Frothy bursts around price, but team posts track product",
          threat: "amber",
          visual: {
            component: "Timeline",
            props: {
              startLabel: "launch",
              endLabel: "d+22",
              events: [
                { position: 0.05, label: "Launch post", sublabel: "d+0", tone: "green" },
                { position: 0.20, label: "Pump spike", sublabel: "d+3", tone: "amber" },
                { position: 0.41, label: "Bugfix thread", sublabel: "d+9", tone: "green" },
                { position: 0.60, label: "Caller blast", sublabel: "d+13", tone: "amber" },
                { position: 0.86, label: "Fee update", sublabel: "d+20", tone: "green", highlight: true },
              ],
            },
            caption:
              "The community's bursts pulse around price spikes, which looks pumpy. But the team's own posts track product events, not the candles. Two different rhythms sharing one channel.",
            metric: { label: "PUMP SPIKES", value: "2" },
          },
        },
      ],
      summary: "The room is loud and pumpy, with caller channels screaming 100x, which looks like exit liquidity. But the hype is parasitic noise on a real, product-talking crowd.",
      verdictReaction: {
        believe: { text: "Backing a coin with a circus in the comments. Risky look. But the circus isn't the company. Respect." },
        abstain: { text: "Fine. A room this loud has earned a little fear. Caution has good branding these days." },
        doubt: { text: "You heard the pump chants and bailed. Understandable. But noise is not the same as fraud, sweetheart." },
      },
      vindication: {
        aligned: { text: "You heard the pump and looked past it to the real room. Strange feeling, right?" },
        missed: { text: "The callers screamed and you flinched. Not every loud room is a trap. Sometimes it's a real thing with bad neighbors." },
        abstained: { text: "You did not lose. You also did not learn to hear a real crowd under the noise yet." },
      },
    },
    marisol: {
      character: "Detective Trinity",
      role: "LOGOS · ONCHAIN",
      sigil: "✧",
      tagline: "The chain doesn't lie. Read the receipts.",
      intro: {
        text:
          "Everyone's yelling about the chart and the callers. I don't care about the noise. " +
          "I care about the wallets, the locks, and the doors nobody mentions. The chain doesn't get excited.",
      },
      returnLines: [
        { text: "Thought you might want the receipts." },
        { text: "Let's stay with the wallets. They don't scream." },
        { text: "Loud files still leave quiet fingerprints." },
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
              "Volume spiked with the hype, but counterparties are broad. No tight loop, no mirrored timing, no circular pump engine. " +
              "Loud is a sentiment problem. Circular is a fraud problem. This is not circular.",
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
              "The notable insider movement goes into vesting, not out to the market. Even through the hype spike, no team wallet sold. That is a restraint signal.",
            metric: { label: "TEAM SELLS", value: "0" },
          },
        },
        {
          label: "VOLUME QUALITY",
          value: "Hype-driven but non-circular; no wash loop detected",
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
              "The volume spike came from many independent counterparties hitting the pool, not from the same closed wallet loop cycling tokens. A real crowd buying, not a wash-trade engine faking it.",
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
              "A verifiable one-year LP lock, signed in the same block the pool was created. It does not remove all risk, but it blocks the fast pull that defines most rug files.",
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
      summary: "Onchain, the obvious rug mechanics are absent: locked liquidity, real vesting, distributed holders, and organic volume under the noise.",
      verdictReaction: {
        believe: { text: "That's where the receipts point. The chain ignored the hype, and so should you. Yes." },
        abstain: { text: "Reasonable. Thin markets punish impatience, hype or not." },
        doubt: { text: "Maybe. But show me the mechanism. The noise isn't a body. Suspicion still needs one." },
      },
      vindication: {
        aligned: { text: "Good read. You trusted the receipts over the screaming." },
        missed: { text: "You let a loud room and a masked team talk over the chain. The receipts were clean." },
        abstained: { text: "Acceptable, but the onchain signals were clean and loud." },
      },
    },
    eugene: {
      character: "Eugene",
      role: "MYTHOS · NARRATIVE",
      sigil: "❖",
      tagline: "Every rug wears a story. Find the seams.",
      textOnly: true,
      intro:
        "Okay so the Telegram is doing the MOST right now, but the actual product? Giving municipal software, in a good way. " +
        "Less prophecy, more spreadsheets. The question is whether the boring core matches the loud packaging.",
      returnLines: [
        "Back to the brochure 📄",
        "Let's read the story with our glasses on ✨",
        "Tuning out the moon chants, reading the actual docs 💫",
      ],
      questions: [
        {
          q: "What is the product story?",
          a:
            "Creator collectives need shared treasury controls. That is narrow, boring, and believable. " +
            "Honestly, I love a project that knows it is not saving civilization, even when the comments think it is. 😅",
          reveals: "POSITIONING",
        },
        {
          q: "Does the whitepaper overpromise?",
          a:
            "It mostly explains fees, roles, and limits. There is no AGI, no revolution, no cosmic yield fountain. " +
            "Just constraints. Beautiful little constraints. The hype is in the chat, NOT in the docs.",
          reveals: "WHITEPAPER",
        },
        {
          q: "Is there real working product?",
          a:
            "There's a live dashboard, a public GitHub with real commits, and a completed audit you can actually read. " +
            "Three small collectives are named with public treasury addresses. You can verify all of it without trusting a single vibe. ✨",
          reveals: "PRODUCT PROOF",
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
              "The pitch is narrow enough to test. It names a specific workflow instead of promising to remake finance, no matter what the moon-posters say.",
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
              "The document spends its space on boring product constraints. The hype lives in the chat, not in the docs. That gap is reassuring, not alarming.",
            metric: { label: "MIRACLES", value: "0" },
          },
        },
        {
          label: "PRODUCT PROOF",
          value: "Live product, public GitHub, completed audit, 3 named pilots",
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
              "The product is live, the GitHub is public with real commit history, the audit is completed and readable, and the pilot users are tied to public treasury addresses. The whole story can be checked without trusting a single testimonial.",
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
              "This is the key lesson: a project can be legitimate and still be a bad trade. Adoption risk is not the same thing as fraud, and neither is a noisy fanbase.",
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
                { status: "ok", label: "Completed audit", value: "PUBLIC" },
                { status: "ok", label: "LP lock transaction", value: "PUBLIC" },
                { status: "warn", label: "Future adoption", value: "UNKNOWN", sublabel: "cannot be proven at launch" },
              ],
            },
            caption:
              "The strongest claims are independently checkable. The uncertain part is future demand, which is a market risk rather than a deception signal.",
            metric: { label: "CHECKABLE", value: "4/5" },
          },
        },
      ],
      summary: "Loud chat, quiet product. The story is narrow enough to be true, with a live product and a real audit behind it. The main risk is adoption, not deception.",
      verdictReaction: {
        believe: "Yes. We love a boring little use case with receipts, even when the comments are unhinged.",
        abstain: "Fair. The market could still ignore it completely.",
        doubt: "Hmm. That feels like the moon-posters spooked you. The product itself is the calmest thing here.",
      },
      vindication: {
        aligned: "You ignored the confetti and read the receipts. That's the upgrade.",
        missed: "You let a loud chat drown out a real product. The audit and the GitHub were right there.",
        abstained: "Not wrong, but there was a real product here to lean on.",
      },
    },
  },
  maxScans: 3,
  correctVerdict: "believe",
  decisiveLenses: ["marisol", "eugene"],
  reveal: {
    summary: "HARBORLIGHT remained active. No rug event. The pump callers moved on; the product shipped v1.1 after 41 days.",
    voices: {
      believe: "Correct. The loud crowd and the masked team looked like a pump, but the chain and the working product told the truth. Trust the receipts, not the noise.",
      abstain: "Capital preserved, but the evidence supported a cautious trust. The hype was froth, not fraud. Learn to read the chain under the chatter.",
      doubt: "You overcorrected. Locked liquidity, real vesting, distributed holders, a live product, and a public audit all pointed away from fraud. The pump callers were parasites, not proof.",
    },
  },
};

export default CASE_002;
