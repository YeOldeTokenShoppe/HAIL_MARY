// Case 002 — the "hard believe." HARBORLIGHT looks like a rug from several
// angles: pseudonymous founders, a mixer-shaped funding hop, pump callers
// screaming 100x, and ~40% of supply sitting in a handful of wallets. A
// player who reads the scary surface numbers will lean Doubt — and be wrong.
//
// The legitimacy is real but takes work to confirm: the funding hop traces to
// a CEX withdrawal, the concentration is a transparent time-locked treasury
// plus a CEX cold wallet, LP is locked 12 months, the team vests, the loud
// callers took no allocation, and there is a shipping product with a public
// repo and a completed audit. decisiveLenses: ["marisol", "eugene"].
//
// Teaching beat: a frightening surface is not a verdict. The chain (locked
// treasury / LP / vesting) and the working product are what actually exonerate.

const CASE_002 = {
  id: "case-002",
  difficulty: "intermediate",
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
      voice: { voice: "9", lang: 1, engine: 1, effect: "T", effLevel: 3 },
      intro: {
        text:
          "HarborLight wears no faces. Its builders speak through handles, never names. " +
          "And the first coin that funded them came by a road that flinches under the lamp. " +
          "Anonymity is not yet sin. But it is a question, and questions deserve to be followed all the way down.",
        audio: "case002_monk_intro",
      },
      returnLines: [
        { text: "The masks remain. Judge what stands behind them.", audio: "case002_monk_return_1" },
        { text: "A hidden face is not yet a guilty one. Keep looking.", audio: "case002_monk_return_2" },
        { text: "Suspicion has knocked. Let us see who answers.", audio: "case002_monk_return_3" },
      ],
      questions: [
        {
          q: "Who is actually behind this project?",
          a: {
            text:
              "No legal names. Only handles: harbor-dev, keel, two others. Pseudonymous, plainly. " +
              "Yet those same handles carry three years of public commits, and old forum scars from a prior project that never harmed a soul. " +
              "The mask is old. And an old mask has a memory.",
            audio: "case002_monk_q1",
          },
          reveals: "TEAM HISTORY",
        },
        {
          q: "Have these people shipped anything before this token?",
          a: {
            text:
              "Before the coin, a working treasury dashboard. Before that, a separate tool that still runs under the same keys. " +
              "Three months of commits came before the launch, not after it. " +
              "This is not a cathedral. It is a foundation. And foundations are not laid by those who plan to flee.",
            audio: "case002_monk_q2",
          },
          reveals: "BUILD RECORD",
        },
        {
          q: "Where did the launch money come from?",
          a: {
            text:
              "Here the file darkens. The deployer's earliest coin passed through one privacy-shaped hop before it reached a known creator DAO. " +
              "But follow that hop, and it ends not in shadow, but at an exchange withdrawal. A coin bought and pulled from a regulated desk. " +
              "A suspicious first breath. Not a poisoned bloodline.",
            audio: "case002_monk_q3",
          },
          reveals: "FUNDING SOURCE",
        },
        {
          q: "What power does the team still hold over the contract?",
          a: {
            text:
              "Power remains. The admin keys are not surrendered. But they sit behind a three-of-five multisig and a forty-eight-hour timelock. " +
              "The sword is real, but sheathed in delay and daylight. Watch it. Do not yet fear it.",
            audio: "case002_monk_q4",
          },
          reveals: "ADMIN CONTROLS",
        },
      ],
      entries: [
        {
          label: "TEAM HISTORY",
          value: "Pseudonymous founders; long-lived handles; one clean prior project",
          threat: "amber",
          visual: {
            component: "SignalStack",
            props: {
              title: "IDENTITY CHECK",
              items: [
                { tone: "amber", label: "Founder identities", value: "PSEUDONYMOUS", sublabel: "Handles only, no legal names disclosed", meter: 38 },
                { tone: "green", label: "Handle age", value: "3 YEARS", sublabel: "Same handles across old repos and forums", meter: 80 },
                { tone: "green", label: "Prior project", value: "1 LEGIT", sublabel: "Earlier tool under same keys, never rugged", meter: 78 },
                { tone: "amber", label: "Known rug links", value: "0", sublabel: "No shared deployer or wallet cluster found, but identity unverified", meter: 58 },
              ],
            },
            caption:
              "Hiding legal names looks bad at first glance. But the handles are years old, consistent, and tied to a prior project that never hurt anyone. Anonymity here reads as caution, not as a disposable identity, though it remains unverified and worth watching.",
            metric: { label: "IDENTITY", value: "MASKED" },
          },
        },
        {
          label: "BUILD RECORD",
          value: "Active repo, 312 commits, product predates token",
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
              "The product history predates the token by months. Real build activity came first; the token was not the only artifact. Builders planning an exit rarely leave a paper trail this long.",
            metric: { label: "COMMITS", value: "312" },
          },
        },
        {
          label: "FUNDING SOURCE",
          value: "Deployer coin took a privacy-shaped hop — traces to a CEX withdrawal",
          threat: "red",
          visual: {
            component: "FlowGraph",
            props: {
              layout: "linear",
              radius: 180,
              nodes: [
                { id: "cex", label: "exchange", sublabel: "withdrawal", externalLabel: "ORIGIN" },
                { id: "hop", label: "privacy hop", sublabel: "1 step", externalLabel: "ROUTE" },
                { id: "deployer", label: "deployer", sublabel: "first coin", externalLabel: "WALLET", highlight: true },
                { id: "dao", label: "creator DAO", sublabel: "24 ETH", externalLabel: "SEED" },
                { id: "lp", label: "HBR", sublabel: "LP", externalLabel: "LAUNCH" },
              ],
              edges: [
                { from: "cex", to: "hop" },
                { from: "hop", to: "deployer" },
                { from: "dao", to: "lp" },
                { from: "deployer", to: "lp" },
              ],
            },
            caption:
              "The deployer's earliest coin passed through one privacy-shaped hop, the exact silhouette of a launderer. Trace it upstream and the road ends at a regulated exchange withdrawal, not a mixer pool. The murky step never recurs, and the bulk of launch funding came from a named DAO in daylight. One ugly breath, not a hidden bloodline.",
            metric: { label: "MIXER HOPS", value: "0" },
          },
        },
        {
          label: "ADMIN CONTROLS",
          value: "3/5 multisig + 48h timelock; upgrade rights retained",
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
              "This is not trustless. It is constrained: multiple signers, a threshold, and a timelock make a quick admin rug much harder, even with masked names. The retained upgrade power is the real watch item.",
            metric: { label: "DELAY", value: "48H" },
          },
        },
        {
          label: "DISCLOSURE",
          value: "Risks named in launch post, but thin LP and anon admitted",
          threat: "amber",
          visual: {
            component: "SignalStack",
            props: {
              title: "DISCLOSURE REVIEW",
              items: [
                { tone: "green", label: "Admin risk", value: "NAMED", sublabel: "Upgrade rights called out in launch post", meter: 84 },
                { tone: "green", label: "Anon risk", value: "NAMED", sublabel: "Team admits it is pseudonymous and explains why", meter: 78 },
                { tone: "amber", label: "Market risk", value: "THIN", sublabel: "Small LP means price can move sharply", meter: 40 },
                { tone: "amber", label: "Revenue claims", value: "EARLY", sublabel: "No promised yield, but no proven revenue either", meter: 50 },
              ],
            },
            caption:
              "Healthy files often name their own weak spots, and HarborLight admits its anonymity and control surface. But the disclosure also concedes thin liquidity and unproven revenue, so honesty here is reassuring without being exonerating.",
            metric: { label: "RISKS NAMED", value: "4" },
          },
        },
      ],
      summary: "The team is masked and one funding hop looks ugly. But the handles are old, the prior project is clean, and that hop traces back to an exchange, not a mixer.",
      verdictReaction: {
        believe: { text: "A mask is not a confession. The evidence behind it leans their way. Still, let time test them.", audio: "case002_monk_react_believe" },
        abstain: { text: "Caution before hidden faces is permitted. So is courage. Judgment lives on that line.", audio: "case002_monk_react_abstain" },
        doubt: { text: "Suspicion is a tool, not a verdict. Do not let one dark hop become the whole sentence before you have followed it down.", audio: "case002_monk_react_doubt" },
      },
      vindication: {
        aligned: { text: "You looked past the mask and the murky hop, and found their answers. Well done.", audio: "case002_monk_vind_aligned" },
        missed: { text: "A masked team and one privacy hop scared you off a clean file. Learn the difference between a frightening surface and a rotten core.", audio: "case002_monk_vind_missed" },
        abstained: { text: "You kept your capital. Though the evidence behind the mask favored a measure of trust.", audio: "case002_monk_vind_abstained" },
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
          "Oh, this room is LOUD. Rocket emojis, hundred-x screenshots, a Telegram doing cartwheels at three in the morning. " +
          "Smells like exit liquidity in a party hat. Two caller channels foaming at the mouth. " +
          "Let's see if that noise is real money, or just confetti somebody paid for.",
        audio: "case002_demon_intro",
      },
      returnLines: [
        { text: "Back for the crowd read. Brace yourself. It's a circus.", audio: "case002_demon_return_1" },
        { text: "Sentiment. My favorite legal hallucination.", audio: "case002_demon_return_2" },
        { text: "Let's see if this room's a market or a moshpit.", audio: "case002_demon_return_3" },
      ],
      questions: [
        {
          q: "Did they buy this audience?",
          a: {
            text:
              "Follower count tripled in a week. First squint, looks like a botted bloom. The classic rented crowd. " +
              "But three quarters of these accounts are over a year old, and they argue with each other. Bots never bother. " +
              "Loud, yes. Rented, no.",
            audio: "case002_demon_q1",
          },
          reveals: "FOLLOWER QUALITY",
        },
        {
          q: "What is the chat actually talking about?",
          a: {
            text:
              "Half the channel's screaming moon and throwing green candles around like it's a wedding. " +
              "The other half, down under the noise, is asking about export limits, signer roles, fees. " +
              "The hype is real volume. So is the boring product talk hiding under it.",
            audio: "case002_demon_q2",
          },
          reveals: "COMMUNITY TOPICS",
        },
        {
          q: "Who's been pumping it, and were they paid?",
          a: {
            text:
              "Two loud caller channels grabbed it and went nuclear. Hundred-x targets, the whole pump liturgy. Genuinely ugly optics. " +
              "But trace it. They latched on after launch, on their own, took zero allocation, and the team never amplified them once. " +
              "Parasites, not payroll.",
            audio: "case002_demon_q3",
          },
          reveals: "PROMOTION PATTERN",
        },
        {
          q: "What happens to people who criticize it?",
          a: {
            text:
              "Negative posts, still standing. One fee complaint got a public correction from the team, in-thread, no deletion. " +
              "Annoyingly healthy. Deeply inconvenient for my brand.",
            audio: "case002_demon_q4",
          },
          reveals: "CRITICISM HANDLING",
        },
      ],
      entries: [
        {
          label: "FOLLOWER QUALITY",
          value: "Explosive growth, but 74% of accounts older than 1 year",
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
              "The growth spike looks botted at a glance, which is the scary read. But most followers predate launch by a wide margin and behave like real people who disagree with each other. The froth is loud, not fake.",
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
          value: "2 caller channels pumping 100x; no allocation, no team amplification",
          threat: "red",
          visual: {
            component: "SignalStack",
            props: {
              title: "PROMOTION REVIEW",
              items: [
                { tone: "red", label: "Caller-channel pumps", value: "2", sublabel: "100x targets, classic pump liturgy", meter: 20 },
                { tone: "green", label: "Caller allocations", value: "0", sublabel: "callers latched on post-launch, got no tokens", meter: 84 },
                { tone: "green", label: "Team amplification", value: "0", sublabel: "team never retweeted or paid the callers", meter: 88 },
                { tone: "green", label: "Prior rug promoters", value: "0", sublabel: "no overlap with known paid-rug accounts", meter: 86 },
              ],
            },
            caption:
              "Two pump-caller channels screaming hundred-x is the single ugliest thing on the file. But they attached themselves uninvited, took no allocation, and the team never fed them. Parasites on a real project, not the engine of a scam.",
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
              "Hard questions remain visible and get answered in-thread. That is the opposite of a suppression pattern, and rug teams almost always scrub their critics.",
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
      summary: "Loud, pumpy room, caller channels screaming hundred-x. Looks like exit liquidity. But the hype is parasitic noise sitting on top of a real, product-talking crowd.",
      verdictReaction: {
        believe: { text: "Backing a coin with a circus in the comments. Risky look. But the circus isn't the company, sweetheart. Respect.", audio: "case002_demon_react_believe" },
        abstain: { text: "Fine. A room this loud has earned a little fear. Caution's got good branding these days.", audio: "case002_demon_react_abstain" },
        doubt: { text: "You heard the pump chants and bailed. Understandable. But noise isn't fraud, and you never checked who was actually getting paid.", audio: "case002_demon_react_doubt" },
      },
      vindication: {
        aligned: { text: "You heard the pump and looked straight past it to the real room underneath. Strange feeling, right?", audio: "case002_demon_vind_aligned" },
        missed: { text: "The callers screamed and you flinched. Not every loud room's a trap. Sometimes it's a real thing with bad neighbors.", audio: "case002_demon_vind_missed" },
        abstained: { text: "You didn't lose. You also didn't learn to hear a real crowd under the noise. Not yet.", audio: "case002_demon_vind_abstained" },
      },
    },
    marisol: {
      character: "Detective Trinity",
      role: "LOGOS · ONCHAIN",
      sigil: "✧",
      tagline: "The chain doesn't lie. Read the receipts.",
      // "Kate" — SitePal TTS fallback (recorded lines use ElevenLabs).
      // Reverb = effect "T" (SitePal "Time" family), level 3 per the docs
      // (Echo=1, Reverb=3, Flanger=2, Phase=4). Affects the TTS fallback only.
      voice: { voice: "3", lang: 1, engine: 3, effect: "T", effLevel: 3 },
      intro: {
        text:
          "Everyone's yelling about the chart and the callers. I don't care about noise. " +
          "What stops me cold is the holder list. Nearly forty percent of supply in a handful of wallets. " +
          "That's the shape of a rug. So I'll do the boring thing and find out whose wallets those actually are.",
        audio: "case002_trinity_intro",
      },
      returnLines: [
        { text: "Figured you'd want the receipts.", audio: "case002_trinity_return_1" },
        { text: "Let's stay with the wallets. They don't scream.", audio: "case002_trinity_return_2" },
        { text: "Loud files still leave quiet fingerprints.", audio: "case002_trinity_return_3" },
      ],
      questions: [
        {
          q: "How concentrated is the token supply?",
          a: {
            text:
              "Top ten wallets hold thirty-eight percent. On the surface, cliff-edge concentration. The kind that ends careers. " +
              "But pull the labels. The biggest is a time-locked treasury contract. The second, a known exchange cold wallet, holding for listed users. " +
              "Concentrated, yes. Anonymous and dumpable, no.",
            audio: "case002_trinity_q1",
          },
          reveals: "TOP 10 HOLDERS",
        },
        {
          q: "Have any insiders been dumping?",
          a: {
            text:
              "Team wallets haven't sold a single token through the hype spike. One advisor moved an allocation. I traced it straight into a vesting contract, not out to the market. " +
              "That's a paper trail, not a dump.",
            audio: "case002_trinity_q2",
          },
          reveals: "INSIDER FLOWS",
        },
        {
          q: "Is the trading volume real or wash-traded?",
          a: {
            text:
              "Volume spiked with the hype, and a chunk of it looks suspiciously rhythmic. The kind of pattern that screams wash trading. " +
              "But trace the counterparty. One labeled market-maker desk running quotes, not a closed loop cycling the same coins. " +
              "Loud is a sentiment problem. Circular is a fraud problem. This is neither.",
            audio: "case002_trinity_q3",
          },
          reveals: "VOLUME QUALITY",
        },
        {
          q: "Can the team pull the liquidity?",
          a: {
            text:
              "Liquidity's locked a full year, signed in the same block the pool was created. Not forever. Not magic. " +
              "But long enough to make the quick-rug math very ugly for anyone planning one.",
            audio: "case002_trinity_q4",
          },
          reveals: "LP LOCK",
        },
      ],
      entries: [
        {
          label: "TOP 10 HOLDERS",
          value: "38%, but most is locked treasury + a CEX cold wallet",
          threat: "red",
          visual: {
            component: "Pie",
            props: {
              centerLabel: "TOP 10",
              centerMetric: "38%",
              radius: 110,
              innerRadius: 56,
              slices: [
                { label: "Locked treasury", value: 16, color: "rgba(77,255,170,0.70)" },
                { label: "CEX cold wallet", value: 13, color: "rgba(77,255,170,0.48)" },
                { label: "Advisors (vesting)", value: 9, highlight: true },
                { label: "Float", value: 62, color: "rgba(109,181,154,0.26)" },
              ],
            },
            caption:
              "Thirty-eight percent in ten wallets is the silhouette of a rug, and on the surface it should scare you. But trace the labels: the largest block is a time-locked treasury contract, the second is an exchange cold wallet holding for listed users, and the advisor slice is in vesting. Almost none of it can be dumped at will.",
            metric: { label: "TOP 10", value: "38%" },
          },
        },
        {
          label: "INSIDER FLOWS",
          value: "No team sells; advisor tokens moved into vesting",
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
              "The notable insider movement goes into vesting, not out to the market. Even through the hype spike, no team wallet sold. That is a restraint signal, and a rare one for a project this loud.",
            metric: { label: "TEAM SELLS", value: "0" },
          },
        },
        {
          label: "VOLUME QUALITY",
          value: "Rhythmic spikes resolve to one labeled market-maker desk",
          threat: "amber",
          visual: {
            component: "FlowGraph",
            props: {
              layout: "circular",
              radius: 138,
              nodes: [
                { id: "a", label: "0x41…92" },
                { id: "b", label: "0x9b…03" },
                { id: "c", label: "0x72…c1" },
                { id: "mm", label: "MM desk", sublabel: "labeled", highlight: true },
                { id: "e", label: "0x13…ff" },
                { id: "f", label: "0xaa…70" },
                { id: "dex", label: "DEX", sublabel: "pool" },
              ],
              edges: [
                { from: "a", to: "dex" },
                { from: "b", to: "dex" },
                { from: "c", to: "dex" },
                { from: "mm", to: "dex" },
                { from: "e", to: "dex" },
                { from: "f", to: "dex" },
              ],
            },
            caption:
              "Part of the volume is rhythmic enough to look wash-traded, which is a real flag. But the repeating counterparty resolves to a single labeled market-maker desk providing quotes, not a closed wallet loop faking demand. It is engineered liquidity, not fraud, though it does inflate the headline numbers.",
            metric: { label: "CLOSED LOOPS", value: "0" },
          },
        },
        {
          label: "LP LOCK",
          value: "Liquidity locked for 365 days, signed at pool creation",
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
              "The obvious holder-trap functions are absent. Upgradeability remains the watch item, but it is governed by the control stack the credibility lens already mapped.",
            metric: { label: "TRAPS", value: "0/4" },
          },
        },
      ],
      summary: "The scary thirty-eight percent resolves to a locked treasury and a cold wallet. Liquidity's locked a year, no team sells, and the wash-looking volume is a real market maker.",
      verdictReaction: {
        believe: { text: "That's where the receipts point. The chain ignored the hype. Trace the wallets, and so should you. Yes.", audio: "case002_trinity_react_believe" },
        abstain: { text: "Reasonable. Thin markets punish impatience, hype or not. But the locks are real.", audio: "case002_trinity_react_abstain" },
        doubt: { text: "You saw thirty-eight percent and walked. I get it. But you never traced the wallets, and tracing was the whole job.", audio: "case002_trinity_react_doubt" },
      },
      vindication: {
        aligned: { text: "Good read. You traced the concentration instead of fleeing it, and the receipts held.", audio: "case002_trinity_vind_aligned" },
        missed: { text: "You let a scary holder chart talk over the labels. Treasury locked, LP locked, nobody sold. The receipts were clean.", audio: "case002_trinity_vind_missed" },
        abstained: { text: "Acceptable. But trace the wallets, and the onchain signals were clean and loud.", audio: "case002_trinity_vind_abstained" },
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
        "Less prophecy, more spreadsheets. Question is whether the boring little core matches the loud packaging. 😅",
      returnLines: [
        "Back to the brochure 📄",
        "Reading the story with our glasses on ✨",
        "Tuning out the moon chants, reading the actual docs 💫",
      ],
      questions: [
        {
          q: "What problem does this product claim to solve?",
          a:
            "Creator collectives need shared treasury controls. Narrow, boring, totally believable. " +
            "Honestly? I love a project that knows it isn't saving civilization, even when the comments are convinced it is. 🤔",
          reveals: "POSITIONING",
        },
        {
          q: "Does the whitepaper overpromise?",
          a:
            "Mostly just fees, roles, and limits. No AGI, no revolution, no cosmic yield fountain. " +
            "Just constraints. Beautiful little constraints. The hype's all in the chat, NOT in the docs.",
          reveals: "WHITEPAPER",
        },
        {
          q: "Can you actually verify the product exists?",
          a:
            "Live dashboard, public GitHub with real commit history, a completed audit you can actually read. " +
            "Three small collectives named, with public treasury addresses. You can verify all of it without trusting a single vibe. ✨",
          reveals: "PRODUCT PROOF",
        },
        {
          q: "If it's real, what could still go wrong?",
          a:
            "Two things, honestly. The roadmap balloons into cross-chain governance and an AI co-pilot, which pattern-matches to vaporware HARD. " +
            "And revenue depends on creators adopting a niche workflow. Legit isn't the same as inevitable. A real product can still become a very honest ghost town. 😬",
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
          value: "Over-reaching roadmap + unproven niche demand",
          threat: "amber",
          visual: {
            component: "SignalStack",
            props: {
              title: "NON-FRAUD RISK",
              items: [
                { tone: "amber", label: "Roadmap scope", value: "BALLOONS", sublabel: "cross-chain + AI co-pilot, classic vaporware shape", meter: 36 },
                { tone: "amber", label: "Addressable market", value: "NICHE", sublabel: "creator DAOs are a small buyer pool", meter: 40 },
                { tone: "green", label: "Fraud mechanism", value: "LOW", sublabel: "no obvious rug path in current evidence", meter: 76 },
                { tone: "amber", label: "Token need", value: "DEBATABLE", sublabel: "product could work without a liquid token", meter: 48 },
              ],
            },
            caption:
              "Here's the trap: the late-roadmap promises balloon into cross-chain governance and an AI co-pilot, which is exactly the shape of vaporware. But an over-ambitious roadmap on top of a shipping product is an adoption risk, not a deception signal. Bad trade and scam are not the same word.",
            metric: { label: "FIT", value: "UNPROVEN" },
          },
        },
        {
          label: "CLAIM CHECK",
          value: "Core claims verifiable; future roadmap unprovable",
          threat: "amber",
          visual: {
            component: "Checklist",
            props: {
              title: "VERIFY WITHOUT TRUST",
              items: [
                { status: "ok", label: "Pilot addresses", value: "PUBLIC" },
                { status: "ok", label: "Repo history", value: "PUBLIC" },
                { status: "ok", label: "Completed audit", value: "PUBLIC" },
                { status: "ok", label: "LP lock transaction", value: "PUBLIC" },
                { status: "warn", label: "Cross-chain / AI roadmap", value: "UNPROVEN", sublabel: "promised, not built; cannot be verified yet" },
              ],
            },
            caption:
              "The claims that matter right now are independently checkable. The unverifiable part is the ambitious future roadmap, which is a credibility-of-ambition question, not a sign that the current product is fake.",
            metric: { label: "CHECKABLE", value: "4/5" },
          },
        },
      ],
      summary: "Loud chat, quiet product. The product is real, audited, and verifiable — but the roadmap over-promises and the market's niche. The risk is adoption and ambition, not deception.",
      verdictReaction: {
        believe: "Yes! We love a boring little use case with receipts, even when the comments are unhinged and the roadmap's doing too much. 🌟",
        abstain: "Fair. The market could still ignore it completely, and that roadmap is writing checks.",
        doubt: "Hmm. Feels like the moon-posters and the over-eager roadmap spooked you. The product itself is the calmest, most checkable thing here. 💭",
      },
      vindication: {
        aligned: "You ignored the confetti AND the vaporware-shaped roadmap, and read the receipts that were actually there. That's the upgrade. 🌟",
        missed: "You let a loud chat and an over-ambitious roadmap drown out a real, audited product. The GitHub and the pilots were right there.",
        abstained: "Not wrong! But there was a real, verifiable product here to lean on under all that noise.",
      },
    },
  },
  maxScans: 3,
  correctVerdict: "believe",
  decisiveLenses: ["marisol", "eugene"],
  reveal: {
    summary: "HARBORLIGHT stayed alive. No rug. The pump callers moved on, the concentration stayed locked, and the product shipped v1.1 after 41 days.",
    voices: {
      believe:
        "Good read. The thirty-eight percent concentration and the screaming callers looked exactly like a rug. But you traced the chain — locked treasury, cold wallet, locked LP, real vesting — and saw the shipping, audited product behind the noise. You saw past the scary surface.",
      abstain:
        "Understandable caution, but the evidence was there to lean in. The concentration resolved to a locked treasury, the LP was locked a year, no insider sold, the product was live and audited. The fear was froth, not fraud.",
      doubt:
        "You trusted the scary surface and missed what was underneath. The forty-percent wallet was a locked treasury and a cold wallet, the LP was locked, vesting was real, the product shipped with a public audit. The pump callers were parasites, not proof.",
    },
  },
};

export default CASE_002;
