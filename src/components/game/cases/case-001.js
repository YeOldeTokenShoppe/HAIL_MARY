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
  // Covers: (1) the question budget, (2) the verdict trio, (3) both scoring
  // directions — Brier (lower-better, counterintuitive) vs accuracy (higher-better),
  // and (4) the calibration intuition (bold-right wins, bold-wrong loses, abstain spared).
// Separate recording from monk's intro so first-visit players who've
// heard the rules before in a prior session don't get them again. The
// runtime plays this audio FIRST on first visit, then chains to
// `stations.monk.intro.audio` when this one ends. If `rulesHeard` is
// true, this whole audio is skipped and only the intro plays.
rulesIntro: {
  text:
    "Welcome, friend. The rite is simple. You may spend three questions across " +
    "the four of us. Then you render judgment: Trust, Abstain, or Doubt. " +
    "Trust when the evidence holds. Doubt when the pattern breaks faith. " +
    "Abstain when the signal is incomplete. A clear call is rewarded; a false " +
    "one leaves a mark. Choose with care.",
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
      voice: { voice: "9", lang: 1, engine: 7 },
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
          q: "Does the team have a past?",
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
          q: "Has this contract appeared before?",
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
      voice: "2",
      intro: {
        text: "Prophet Token did not find an audience. It rented one. Cheaply. Loudly. Badly.",
        audio: "case001_demon_intro",
        // Voice actor leans on dramatic pauses ("Cheaply. Loudly. Badly.")
        // that the char-pacing fallback can't predict — ProgressiveText /
        // LiveCaption use this duration to spread chunks across the
        // recording instead of racing through it.
        audioDurationMs: 11000,
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
          q: "Are the followers real?",
          a: {
            text:
              "Five thousand followers, and eighty-one percent were born in the last two weeks. " +
              "That is not a crowd. That is inventory.",
            audio: "case001_demon_q1",
            audioDurationMs: 10000,
          },
          reveals: "TWITTER FOLLOWERS",
        },
        {
          q: "Is the community organic?",
          a: {
            text:
              "Yeah, ok. Eighty-eight percent of Telegram posts repeat the same three phrases. " +
              "No questions, no jokes, no typos. Real rooms are messy. This one is shrink-wrapped.",
            audio: "case001_demon_q2",
            audioDurationMs: 14000,
          },
          reveals: "TELEGRAM ACTIVITY",
        },
        {
          q: "Who's promoting it?",
          a: {
            text:
              "Three paid promoters pushed it in the same hour. Two previously fronted dead tokens. " +
              "New ticker, same invoice.",
            audio: "case001_demon_q3",
            audioDurationMs: 10000,
          },
          reveals: "KOL PROMOTERS",
        },
        {
          q: "How does the team handle hard questions?",
          a: {
            text:
              "Critical replies disappear in under four minutes. A real team answers doubts. " +
              "A trap deletes them.",
            audio: "case001_demon_q4",
            audioDurationMs: 9000,
          },
          reveals: "FUD SUPPRESSION",
        },

      ],
      entries: [
        { label: "TWITTER FOLLOWERS", value: "5,200 — 81% under 14 days old", threat: "red" },
        { label: "TELEGRAM ACTIVITY", value: "88% repetitive shill phrases", threat: "red" },
        { label: "KOL PROMOTERS", value: "3 paid KOLs, 2 with rug histories", threat: "red" },
        { label: "FUD SUPPRESSION", value: "Negative comments deleted within ~4 min", threat: "red" },
        { label: "POST CADENCE", value: "Coordinated pumps every 90s across 12 accounts", threat: "red" },
      ],
      summary: "Followers are young, posts are cloned, critics vanish. Sentiment was manufactured.",
      // SitePal 25-char audio-name cap forces truncation on react_believe /
      // react_abstain / vind_aligned / vind_abstained — "demon" eats one
      // more char than "monk", so different slots truncate compared to
      // monk's set. Names below match what SitePal actually stored.
      verdictReaction: {
        believe: {
          text: "You're trusting the applause. That's how the exit liquidity gets a soundtrack.",
          audio: "case001_demon_react_belie",
        },
        abstain: {
          text: "Fine. You stepped out of the crowd before it started running.",
          audio: "case001_demon_react_absta",
        },
        doubt: {
          text: "There it is. When the crowd sounds purchased, don't buy the ticket.",
          audio: "case001_demon_react_doubt",
        },
      },

      vindication: {
        aligned: {
          text: "The rented crowd vanished right on schedule. Funny how that happens.",
          audio: "case001_demon_vind_aligne",
        },
        missed: {
          text: "You trusted the volume. Next time, ask who is making the noise.",
          audio: "case001_demon_vind_missed",
        },
        abstained: {
          text: "Cautious. Boring. Alive to trade another file.",
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
      intro: {
        text: "Pull up a chair. The wallets tell the whole story, if you know how to read them.",
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
              "Top ten wallets hold seventy-one percent. One coordinated sell from that group turns the chart into a cliff.",
            audio: "case001_trinity_q1",
          },
          reveals: "TOP 10 HOLDERS",
        },
        {
          q: "Is the deployer hiding supply?",
          a: {
            text: "Twenty-two percent sits across fourteen connected wallets. Same funding path, same timing, different labels. That is concealment, not distribution.",
            audio: "case001_trinity_q2",
          },
          reveals: "DEPLOYER CLUSTER",
        },
        {
          q: "Is the volume real demand?",
          a: {
            text:
              "Sixty-three percent of volume bounces among eight wallets. They are trading with themselves until the chart learns to lie.",
            audio: "case001_trinity_q3",
          },
          reveals: "WASH TRADING",
        },
        {
          q: "Can liquidity disappear?",
          a: {
            text: "Liquidity is unlocked, and there is no team vesting. The emergency exit is not hidden. It is glowing.",
            audio: "case001_trinity_q4",
          },
          reveals: "LP / VESTING",
        },
      ],
      entries: [
        { label: "TOP 10 HOLDERS", value: "Hold 71% of supply", threat: "red" },
        { label: "DEPLOYER CLUSTER", value: "22% spread across 14 connected wallets", threat: "red" },
        { label: "WASH TRADING", value: "63% of volume bouncing among 8 wallets", threat: "red" },
        { label: "LP / VESTING", value: "LP unlocked. Zero team vesting.", threat: "red" },
        { label: "EXIT-WINDOW PATTERN", value: "Matches 3–7 day rug fingerprint", threat: "red" },
      ],
      summary: "Supply is clustered, volume is circular, liquidity can leave. The exit is already built.",
      // SitePal 25-char cap on audio names — "trinity" (7 chars) drops one
      // more letter from each multi-syllable slot than "monk" (4 chars) or
      // "demon" (5 chars), so react_doubt / vind_missed / vind_aligned all
      // truncate here too (they fit for monk/demon). Names below match what
      // SitePal actually stored.
      verdictReaction: {
        believe: {
          text: "Hope you're right, kid. But the wallets are already reaching for the door.",
          audio: "case001_trinity_react_bel",
        },
        abstain: {
          text: "Smart play. The case isn't always closed when you walk away.",
          audio: "case001_trinity_react_abs",
        },
        doubt: {
          text: "You see it. Most don't, 'til it's gone.",
          audio: "case001_trinity_react_dou",
        },
      },
      vindication: {
        aligned: {
          text: "Good read. The chain gave you the ending before the chart did.",
          audio: "case001_trinity_vind_alig",
        },
        missed: {
          text: "Walk it off. Wallet patterns are not intuitive until you have watched a hundred exits.",
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
      intro: "Okay, Prophet Token wants to be mystical and technical at the same time. Let's see if either half has wiring.",
      returnLines: [
        "Back! ✨ Whatcha need?",
        "Hiii again 💫",
        "Ooh more questions — yes pls",
      ],
      questions: [
        {
          q: "What are they actually promising?",
          a: "The pitch says an AI prophecy engine will forecast token moves. Every example is a screenshot. None is a working model.",
          reveals: "WHITEPAPER",
        },
        {
          q: "Can anyone inspect the AI?",
          a: "No GitHub, no model card, no demo endpoint. The AI is less a product and more a fog machine.",
          reveals: "AI CLAIMS",
        },
        {
          q: "Have we seen this script before?",
          a:
            "Same prophecy-engine language appeared in four prior rugs. They changed the logo, not the spell.",
          reveals: "PITCH PATTERN",
        },
        {
          q: "Does the roadmap survive contact?",
          a: "Mainnet, predictive AI, revenue share, and AGI alignment in twelve weeks. That is not a roadmap. That is a wish list with dates.",
          reveals: "ROADMAP REALISM",
        },
      ],
      entries: [
        { label: "WHITEPAPER", value: "6 pages — tokenomics only, no architecture", threat: "amber" },
        { label: "AI CLAIMS", value: "No GitHub repos, no model card, no demo", threat: "red" },
        { label: "PITCH PATTERN", value: "Identical 'AI prophecy engine' framing to 4 prior rugs", threat: "red" },
        { label: "ROADMAP REALISM", value: "Mainnet → 'AGI alignment' in 12 weeks", threat: "red" },
        { label: "ORIGIN STORY", value: "Founder bio claims MIT lab; lab denies record", threat: "red" },
      ],
      summary: "The narrative promises technical magic while avoiding technical proof.",
      verdictReaction: {
        believe: "Oh sweetie. The fog machine got you. We can grow from this.",
        abstain: "Smart. Sometimes the vibe is no thanks, and that's a complete sentence.",
        doubt:   "Yes. You saw the costume before it finished the song.",
      },
      vindication: {
        aligned:   "Good instincts. You heard the story, then checked the stage props.",
        missed:    "You trusted the story over the proof. It happens. Now you know the shape.",
        abstained: "You read the room. Half the skill is knowing when not to play.",
      },
    },
  },
  maxScans: 3,
  correctVerdict: "doubt",
  reveal: {
    summary: "PROPHET TOKEN was a serial-deployer rug. Pulled day 6. ~$340K extracted.",
    voices: {
      believe: "You trusted the surface. The +342% chart was the bait; the chain was the trap.",
      abstain: "Caution preserves capital. But the patterns here were legible. Be more decisive.",
      doubt: "Correct. Three prior rugs, unlocked LP, mixer funding, sybil holders. The signal was loud.",
    },
  },
};

export default CASE_001;
