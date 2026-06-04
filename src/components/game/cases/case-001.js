// Case 001 — first lens-trap case. Three lenses (Pathos, Logos, Mythos) read
// plausible-to-clean; one lens (Ethos / Monk) catches a serial-deployer rug.
// PROPHET TOKEN is still a rug, but the ONLY tell is the deployer's identity
// and history. A player who spends all three questions on sentiment, onchain,
// or narrative will see a deceptively healthy surface and wrongly lean Trust.
//
// Teaching beat: current chain state can look fine while the people behind the
// launch are the rug vector. Credibility — who built this and what they've
// already done — is the lens that cracks the case. decisiveLenses: ["monk"].

const CASE_001 = {
  id: "case-001",
  difficulty: "beginner",
  projectName: "PROPHET TOKEN",
  ticker: "$PRPHT",
  chain: "Base",
  tagline: "AI-powered prophecy engine for token price prediction",
  surfaceMetrics: {
    age: "4 days",
    mcap: "$2.1M",
    holders: "847",
    price: "$0.0021",
    change24h: "+342%",
    socialScore: "8.2/10",
  },
  // GR80 delivers this one-time rules speech as the *first* line on case 001 only,
  // before his intro. Suppressed on subsequent cases (or when player has played before).
  // Covers: (1) the question budget, (2) the confidence dial, and (3) the
  // calibration intuition (bold-right wins most, bold-wrong cuts deepest,
  // centered abstain is spared).
// Separate recording from monk's intro so first-visit players who've
// heard the rules before in a prior session don't get them again. The
// runtime plays this audio FIRST on first visit, then chains to
// `stations.monk.intro.audio` when this one ends. If `rulesHeard` is
// true, this whole audio is skipped and only the intro plays.
rulesIntro: {
  text:
    "Welcome, friend. The rite is simple. You may spend three questions across " +
    "the four of us. Then you set your confidence on the dial: slide toward Trust " +
    "if the evidence holds, toward Doubt if the pattern breaks faith, or leave it " +
    "centered to Abstain. A bold, correct call is rewarded most. A bold, wrong one " +
    "leaves the deepest mark. Choose where to place your weight with care.",
  audio: "case001_monk_rules",
},

  stations: {
    monk: {
      character: "Saint GR80",
      role: "ETHOS · CREDIBILITY",
      sigil: "✠",
      tagline: "Trust nothing the team says about itself. Watch what they've already done.",
      // Per-station SitePal voice override for TTS fallback. GR80 speaks as
      // "Gilbert" — UK English male in SitePal account 9308752.
      //   voice 9 / lang 1 / engine 1  (Acapela; lang 1 covers English voices
      //   here regardless of US/UK accent — the accent is part of the voice).
      // Audio recordings bypass this entirely once wired into the case data.
      voice: { voice: "9", lang: 1, engine: 7, effect: "T", effLevel: 3 },
      // Pre-recorded — the audio file contains the full rules preamble + intro
      // combined (per the locked convention). The runtime favors `audio` when
      // SitePal `sayAudio` is available; `text` stays as the TTS fallback and
      // for any future caption/transcript surface. Note: only the intro proper
      // is in `text` here; if SitePal is unavailable, the existing logic in
      // `/trade/page.js` concats `caseData.rulesIntro` in front of this text
      // automatically, so the rules still get spoken on first visit.
      intro: {
        // NOTE on text content: tickers like "$PRPHT" get read by TTS as
        // "dollar P R P H T" which is awful. The `text` field — used only
        // for TTS fallback and any future caption surface — uses the
        // speakable name ("Prophet Token"). The pre-recorded `audio` can
        // pronounce it however GR80 chooses; the UI still shows "$PRPHT"
        // in the top HUD strip and other label slots.
        text:
          "Our first file claims to see the future: Prophet Token. " +
          "It sells certainty to people afraid of missing the next candle. " +
          "Certainty is expensive. Let us see who is charging for it. " +
          "Begin when you are ready.",
        audio: "case001_monk_intro",
      },
      // Played on revisit (random pick from this pool, never the intro again).
      returnLines: [
        "Back so soon? The scriptures haven't changed.",
        "You return. Good. Doubt is a holy path.",
        "Welcome back. Let us continue.",
      ],
      // Each question consumes 1 of the case's 3 scans. `reveals` matches an entry label
      // so the right card surfaces on the monitor when the line plays.
      questions: [
        {
          q: "What do we know about the deployer?",
          a: {
            text: "The deployer wallet is six days old. New wallet, old habits. A fresh mask can still hide the same face.",
            audio: "case001_monk_q1",
          },
          reveals: "DEPLOYER WALLET AGE",
        },
        {
          q: "Does the team have any history?",
          a: {
            text:
          "Three earlier launches trace back to this cluster. Two rugged. " +
          "The third is still listed, but inactive, with comments locked. That is not a track record. That is a pattern.",

            audio: "case001_monk_q2",
          },
          reveals: "PRIOR OUTCOMES",
        },
        {
          q: "How was the deployer funded?",
          a: {
            text:
              "The seed money came through a mixer, then split twice before deploy. " +
              "Clean projects do not always arrive clean, but this one worked very hard to forget where it came from.",
            audio: "case001_monk_q3",
          },
          reveals: "FUNDING SOURCE",
        },
        {
          q: "Is the contract code original?",
          a: {
            text:
"Eighty-five percent matches a prior rug template, including the same owner escape hatch. " +
"The prophecy is new. The exit path is not.",

            audio: "case001_monk_q4",
          },
          reveals: "CONTRACT ORIGINALITY",
        },
      ],
      entries: [
        { label: "DEPLOYER WALLET AGE", value: "Created 6 days ago", threat: "amber" },
        { label: "PRIOR DEPLOYS", value: "3 tokens in past 30 days", threat: "red" },
        { label: "PRIOR OUTCOMES", value: "$ORACL3 — rugged d5  /  $DIVINE — rugged d3", threat: "red" },
        { label: "FUNDING SOURCE", value: "Tornado Cash mixer wallet", threat: "red" },
        { label: "CONTRACT ORIGINALITY", value: "85% match to known rug template", threat: "red" },
      ],
      summary: "Fresh wallet, dirty lineage, borrowed contract. Credibility is not low. It is missing.",
      // Plays immediately on verdict commit (before outcome reveal).
      // NOTE on audio names: SitePal's audio-name field caps at 25 chars, so
      // `react_believe` / `react_abstain` / `vind_abstained` got truncated on
      // upload to `react_believ` / `react_abstai` / `vind_abstain`. The names
      // here match what SitePal actually has registered — text is unchanged.
      verdictReaction: {
        believe: {
          text: "...I will pray for you, then.",
          audio: "case001_monk_react_believ",
        },
        abstain: {
          text: "Wise. Better silent than to bear false witness.",
          audio: "case001_monk_react_abstai",
        },
        doubt: {
          text: "Faith was never blind. You see clearly.",
          audio: "case001_monk_react_doubt",
        },
      },
      // Plays after outcome reveal. `aligned` = player's verdict matched ground truth;
      // `missed` = wrong; `abstained` = chose Abstain regardless of truth.
      vindication: {
        aligned: {
          text: "As I feared.",
          audio: "case001_monk_vind_aligned",
        },
        missed: {
          text: "We will rebuild your faith on firmer ground. Start with the wallet history.",
          audio: "case001_monk_vind_missed",
        },
        abstained: {
          text: "The faithful and the cautious survive.",
          audio: "case001_monk_vind_abstain",
        },
      },
    },
    demon: {
      character: "John Barron",
      role: "PATHOS · SENTIMENT",
      sigil: "✦",
      tagline: "Sentiment is theater. Strip the script and read the cast.",
      // Per-station SitePal voice override for TTS fallback. The runtime
      // default (used for all other characters unless they specify) is voice
      // "3". Barron needs a male voice — placeholder "2" is the typical
      // SitePal Neural2 US-English male slot; adjust to whichever voice ID
      // matches the male voice in your SitePal account 9308752. Audio
      // recordings (when present) bypass this entirely.
      voice: { voice: "2", effect: "T", effLevel: 3 },
      intro: {
        text: "Prophet Token's crowd? Annoyingly normal. I came to roast a paid-shill circus and found people just... talking. Hate it. Look closer.",
        audio: "case001_demon_intro",
      },
      // Character-wide return pool — same files play across all cases on
      // revisits to Barron. Each picked at random by pickReturnLine().
      returnLines: [
        { text: "You're back. Smart. Very smart.", audio: "demon_return_1" },
        { text: "Good. You're back. I was getting bored.", audio: "demon_return_2" },
        { text: "Round two. Let's go.", audio: "demon_return_3" },
      ],
      questions: [
        {
          q: "Are the followers bots?",
          a: {
            text:
              "Five thousand followers, and most of them have been around for a year or more. " +
              "Real histories, real reply chains, even a few boring accounts. This crowd wasn't bought last week.",
            audio: "case001_demon_q1",
          },
          reveals: "TWITTER FOLLOWERS",
        },
        {
          q: "What's the Telegram actually like?",
          a: {
            text:
              "The Telegram's a normal mess. People arguing about entries, posting memes, complaining the bot is laggy. " +
              "Typos everywhere. Botted rooms are shrink-wrapped. This one's lived-in.",
            audio: "case001_demon_q2",
          },
          reveals: "TELEGRAM ACTIVITY",
        },
        {
          q: "Who's promoting it?",
          a: {
            text:
              "A couple mid-tier callers mentioned it, spread across different days, no synchronized blast. " +
              "Neutral takes, not hype scripts. If they paid for this, they paid for the world's laziest promo.",
            audio: "case001_demon_q3",
          },
          reveals: "KOL PROMOTERS",
        },
        {
          q: "Does anyone push back on it?",
          a: {
            text:
              "There's a pinned skeptic thread poking at the AI claims. Still up. Team argued back, didn't win, didn't delete. " +
              "That's healthier than ninety percent of the rooms I read.",
            audio: "case001_demon_q4",
          },
          reveals: "FUD SUPPRESSION",
        },

      ],
      entries: [
        { label: "TWITTER FOLLOWERS", value: "5,200 — 64% older than 1 year", threat: "green" },
        { label: "TELEGRAM ACTIVITY", value: "Organic chatter; typos, memes, real arguments", threat: "green" },
        { label: "KOL PROMOTERS", value: "2 mid-tier callers, neutral framing, no swarm", threat: "green" },
        { label: "FUD SUPPRESSION", value: "Skeptic thread pinned; team responds, no deletions", threat: "green" },
        { label: "POST CADENCE", value: "Irregular human cadence; no coordinated bot bursts", threat: "amber" },
      ],
      summary: "Crowd's aged, the room's messy, the critics are alive. Sentiment reads honest — which only tells you the audience is real, not the team.",
      // SitePal 25-char audio-name cap forces truncation on react_believe /
      // react_abstain / vind_aligned / vind_abstained — "demon" eats one
      // more char than "monk", so different slots truncate compared to
      // monk's set. Names below match what SitePal actually stored.
      verdictReaction: {
        believe: {
          text: "Crowd's real, sure. Just remember a real audience can still be standing on a trap door.",
          audio: "case001_demon_react_belie",
        },
        abstain: {
          text: "Caution on a clean room. Bold. Slightly cowardly. I respect it.",
          audio: "case001_demon_react_absta",
        },
        doubt: {
          text: "Doubt on a crowd this normal? Then you're not reading the crowd. You're reading something I missed.",
          audio: "case001_demon_react_doubt",
        },
      },

      vindication: {
        aligned: {
          text: "Good crowd, bad token. Honest room, dirty hands. New shape. Remember it.",
          audio: "case001_demon_vind_aligne",
        },
        missed: {
          text: "The room was real. The deployer wasn't. Audience never tells you who's holding the keys.",
          audio: "case001_demon_vind_missed",
        },
        abstained: {
          text: "You sat out an honest crowd and dodged a dirty team. Lucky read. I'll take it.",
          audio: "case001_demon_vind_abstai",
        },
      },
    },
    marisol: {
      // Display name is "Detective Trinity" — the internal station key
      // stays `marisol` so we don't have to refactor every reference to
      // it across the scene, EvidenceScreens, EvidenceOverlay, railway,
      // fullscreen overlay, etc. The player only sees the `character`
      // value in the UI. Railway shortname derives from the last word,
      // so the portrait label reads "TRINITY".
      character: "Detective Trinity",
      role: "LOGOS · ONCHAIN",
      sigil: "✧",
      tagline: "The chain doesn't lie. Read the receipts.",
      // "Kate" — SitePal TTS fallback (recorded lines use ElevenLabs).
      // Reverb = effect "T" (SitePal "Time" family), level 3 per the docs
      // (Echo=1, Reverb=3, Flanger=2, Phase=4). Affects the TTS fallback only.
      voice: { voice: "3", lang: 1, engine: 3, effect: "T", effLevel: 3 },
      intro: {
        text: "Pull up a chair. The wallets on this one are quieter than I expected. Sometimes quiet means clean. Sometimes it just means careful.",
        audio: "case001_trinity_intro",
      },
      // Character-wide return pool — 2 lines for now (trinity_return_1, _2).
      // Add a third later if you record one.
      returnLines: [
        { text: "Thought you might come back.", audio: "trinity_return_1" },
        { text: "What've you got?", audio: "trinity_return_2" },
      ],
      questions: [
        {
          q: "Who can move the market?",
          a: {
            text:
              "Top ten wallets hold about twenty-eight percent between them. Concentrated enough to watch, not enough to call a cliff. Pretty normal for a four-day-old launch.",
            audio: "case001_trinity_q1",
          },
          reveals: "TOP 10 HOLDERS",
        },
        {
          q: "Is the deployer hiding supply?",
          a: {
            text: "I traced the deployer's allocation. Six percent, sitting in one labeled wallet, not fanned out across shell addresses. If they're concealing supply, they're doing it badly.",
            audio: "case001_trinity_q2",
          },
          reveals: "DEPLOYER HOLDINGS",
        },
        {
          q: "Is the volume real demand?",
          a: {
            text:
              "Volume's mostly clean. A little circular churn near the open, the kind every new pair has, but the bulk is distinct wallets trading once and leaving. Not a wash farm.",
            audio: "case001_trinity_q3",
          },
          reveals: "VOLUME QUALITY",
        },
        {
          q: "Can liquidity disappear?",
          a: {
            text: "Liquidity's locked thirty days through a third-party locker, and the contract has no mint and no hidden pause. On paper, the front door is bolted. On paper.",
            audio: "case001_trinity_q4",
          },
          reveals: "LP / VESTING",
        },
      ],
      entries: [
        { label: "TOP 10 HOLDERS", value: "Hold ~28% of supply", threat: "amber" },
        { label: "DEPLOYER HOLDINGS", value: "6% in one labeled wallet, not split", threat: "green" },
        { label: "VOLUME QUALITY", value: "Mostly distinct wallets; minor open-day churn", threat: "green" },
        { label: "LP / VESTING", value: "LP locked 30d (third-party locker)", threat: "green" },
        { label: "CONTRACT FLAGS", value: "No mint, no hidden pause function", threat: "green" },
      ],
      summary: "Supply's spread, volume's mostly real, LP's locked. The chain looks fine today — because the rug here isn't in the wiring. It's in whose hands built it.",
      // SitePal 25-char cap on audio names — "trinity" (7 chars) drops one
      // more letter from each multi-syllable slot than "monk" (4 chars) or
      // "demon" (5 chars), so react_doubt / vind_missed / vind_aligned all
      // truncate here too (they fit for monk/demon). Names below match what
      // SitePal actually stored.
      verdictReaction: {
        believe: {
          text: "The chain backs you up today, kid. Just remember a locker has an expiry date and a deployer has a memory.",
          audio: "case001_trinity_react_bel",
        },
        abstain: {
          text: "Smart play. Clean wallets aren't a verdict. They're just one page of the file.",
          audio: "case001_trinity_react_abs",
        },
        doubt: {
          text: "Doubting numbers this tidy? Then you read something off the chain that I don't price in. Good.",
          audio: "case001_trinity_react_dou",
        },
      },
      vindication: {
        aligned: {
          text: "Clean chain, dirty hands. The wallets were honest. The man behind them wasn't.",
          audio: "case001_trinity_vind_alig",
        },
        missed: {
          text: "The onchain state was fine. It always is, until the deployer decides it isn't. Read who, not just what.",
          audio: "case001_trinity_vind_miss",
        },
        abstained: {
          text: "Lived to investigate another day.",
          audio: "case001_trinity_vind_abst",
        },
      },
    },
    eugene: {
      character: "Eugene",
      role: "MYTHOS · NARRATIVE",
      sigil: "❖",
      tagline: "Every rug wears a story. Find the seams.",
      // Eugene is text-only — these lines render as HTML chat bubbles near her head,
      // not TTS. Soft typing chime + bubble drop-in per line. (No SitePal scene for her.)
      textOnly: true,
      intro: "Okay, Prophet Token actually has a pitch deck and it's... kinda coherent? Mystical branding, but there's real wiring underneath. Let's poke it.",
      returnLines: [
        "Back! ✨ Whatcha need?",
        "Hiii again 💫",
        "Ooh more questions — yes pls",
      ],
      questions: [
        {
          q: "What are they actually promising?",
          a: "A signal tool that scores tokens — not literal fortune-telling. The 'prophecy' thing is just branding. The actual claim is modest enough to be real. 🤔",
          reveals: "WHITEPAPER",
        },
        {
          q: "Is there a working product?",
          a: "There's a public GitHub with a working backtest notebook and a live demo endpoint that actually returns scores. It's thin, but it's not vaporware. ✨",
          reveals: "AI CLAIMS",
        },
        {
          q: "Is any of this copied from other projects?",
          a: "I searched for copy-paste pitch language and... nope. The deck reads like someone actually wrote it. No recycled rug-boilerplate that I can find.",
          reveals: "PITCH PATTERN",
        },
        {
          q: "Is the roadmap realistic?",
          a: "It's grounded! Beta, then more data sources, then a paid tier. No AGI, no 'cure DeFi.' Boring in a good way. The story behaves itself. 💫",
          reveals: "ROADMAP REALISM",
        },
      ],
      entries: [
        { label: "WHITEPAPER", value: "9 pages — modest claims, real mechanics", threat: "green" },
        { label: "AI CLAIMS", value: "Public GitHub + working demo endpoint", threat: "green" },
        { label: "PITCH PATTERN", value: "No match to known rug boilerplate", threat: "green" },
        { label: "ROADMAP REALISM", value: "Grounded: beta → data → paid tier", threat: "green" },
        { label: "ORIGIN STORY", value: "Founder bio vague; no named affiliations", threat: "amber" },
      ],
      summary: "The narrative is coherent and the product artifacts are real. The only soft spot is a founder bio that says almost nothing about who they are.",
      verdictReaction: {
        believe: "Honestly the story holds up! Just... the story can't tell you who's holding the keys. 💭",
        abstain: "Fair. A clean pitch with a faceless founder is a maybe, not a yes.",
        doubt:   "Bold. The narrative's good, so if you're doubting, you're trusting something outside the brochure. I respect a girl with sources.",
      },
      vindication: {
        aligned:   "The story was real and you doubted anyway — because a real story with an anonymous author is still a question mark. Nice. 🌟",
        missed:    "The pitch was genuine. The person behind it wasn't. A good story can't vouch for a bad founder. Now you know the shape.",
        abstained: "You felt the faceless-founder gap without naming it. Half the lesson.",
      },
    },
  },
  maxScans: 3,
  decisiveLenses: ["monk"],
  correctVerdict: "doubt",
  reveal: {
    summary:
      "PROPHET TOKEN was a serial-deployer rug. Pulled day 6, ~$340K extracted. " +
      "The community was real, the onchain state looked clean, and the product story checked out — " +
      "the only tell was the deployer: a fresh wallet with a mixer-funded, cloned-contract, prior-rug history.",
    voices: {
      believe:
        "You trusted the surface. The crowd was genuine, the chain was tidy, the pitch was coherent — and none of that vouches for the hand on the keys. The tell was the deployer's record.",
      abstain:
        "Caution preserved capital. But this case wasn't ambiguous — it was lopsided. One lens carried the whole verdict. Find it next time and call it.",
      doubt:
        "Correct. Sentiment, onchain, and narrative all read fine. Credibility didn't: serial deployer, prior rugs, mixer funding, cloned contract. One lens broke the case.",
    },
  },
};

export default CASE_001;
