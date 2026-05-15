import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";



// ────────────────────────────────────────────────────────────────────────
// VERDICT MATH
// ────────────────────────────────────────────────────────────────────────

export const VERDICT_PROBS = { believe: 0.15, abstain: 0.5, doubt: 0.85 };

export function computeBrier(verdict, correctVerdict) {
  // correctVerdict is "believe" (project legitimate) or "doubt" (project is scam)
  // We score against the binary outcome: was it a scam? (1 = yes, 0 = no)
  const actual = correctVerdict === "doubt" ? 1 : 0;
  const predicted = VERDICT_PROBS[verdict];
  return Math.pow(predicted - actual, 2);
}

// ────────────────────────────────────────────────────────────────────────
// SAMPLE CASE — replace via props once you wire up your case loader
// ────────────────────────────────────────────────────────────────────────

export const SAMPLE_CASE = {
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
            text: "The deployer wallet is six days old. A fresh mask can still hold an old face.",
            audio: "case001_monk_q1",
          },
          reveals: "DEPLOYER WALLET AGE",
        },
        {
          q: "Does the team have a past?",
          a: {
            text:
              "Three earlier launches tie back to this cluster. Two ended in rugs. " +
              "The third is a husk with comments locked. That is a habit, not a resume.",
            audio: "case001_monk_q2",
          },
          reveals: "PRIOR OUTCOMES",
        },
        {
          q: "How was the deployer funded?",
          a: {
            text:
              "The seed money came through a mixer, then split twice before deploy. " +
              "Clean projects do not always arrive clean, but this one worked hard to forget itself.",
            audio: "case001_monk_q3",
          },
          reveals: "FUNDING SOURCE",
        },
       {
  q: "Has this contract appeared before?",
  a: {
    text:
      "Eighty-five percent matches a prior rug template, including the same owner escape hatch. " +
      "They changed the prophecy. They kept the knife.",
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
          text: "We will rebuild your faith on firmer ground.",
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
        text: "Prophet Token did not find an audience. It rented one, badly.",
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
          q: "Are the followers real?",
          a: {
            text:
              "Five thousand followers, and eighty-one percent were born in the last two weeks. " +
              "That is not a crowd. That is a casting call.",
            audio: "case001_demon_q1",
          },
          reveals: "TWITTER FOLLOWERS",
        },
        {
          q: "Is the community organic?",
          a: {
            text:
              "Eighty-eight percent of Telegram posts repeat the same three phrases. " +
              "No questions, no jokes, no typos. Real rooms are messy. This one is laminated.",
            audio: "case001_demon_q2",
          },
          reveals: "TELEGRAM ACTIVITY",
        },
        {
          q: "Who's promoting it?",
          a: {
            text:
              "Three paid promoters pushed it in the same hour. Two previously fronted dead tokens. " +
              "Different ticker, same invoice.",
            audio: "case001_demon_q3",
          },
          reveals: "KOL PROMOTERS",
        },
       {
  q: "How does the team handle hard questions?",
  a: {
    text:
      "Critical replies disappear in under four minutes. A believer answers doubts. " +
      "A trap deletes them.",
    audio: "case001_demon_q4",
  },
  reveals: "FUD SUPPRESSION",
}

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
          text: "Told you. Was I right? I was right.",
          audio: "case001_demon_vind_aligne",
        },
        missed: {
          text: "Hurts, doesn't it. Hurts good. Remember it.",
          audio: "case001_demon_vind_missed",
        },
        abstained: {
          text: "Cautious. Boring. Correct.",
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
        text: "Pull up a chair. Prophet's chart is loud, but the wallets are louder.",
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
              "Top ten wallets hold seventy-one percent. One sell wall from that group turns the chart into a cliff.",
            audio: "case001_trinity_q1",
          },
          reveals: "TOP 10 HOLDERS",
        },
        {
          q: "Is the deployer hiding supply?",
          a: {
            text: "Twenty-two percent sits across fourteen connected wallets. Same funding path, same timing, different labels.",
            audio: "case001_trinity_q2",
          },
          reveals: "DEPLOYER CLUSTER",
        },
        {
          q: "Is the volume real demand?",
          a: {
            text:
              "Sixty-three percent of volume bounces among eight wallets. They are trading with themselves to teach the chart how to lie.",
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
          text: "Hope you're right, kid. Been wrong before. Not today, though.",
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
          text: "Walk it off. Wallet patterns aren't intuitive 'til you've seen a hundred.",
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
      intro: "Okay, Prophet Token wants to be mystical and technical at the same time. Let's see if either half has furniture.",
      returnLines: [
        "Back! ✨ Whatcha need?",
        "Hiii again 💫",
        "Ooh more questions — yes pls",
      ],
      questions: [
        {
          q: "What are they actually promising?",
          a: "The pitch says an AI prophecy engine will forecast token moves, but every example is a screenshot, not a working model.",
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
            "Same prophecy-engine language appeared in four prior rugs. They swapped the logo, not the spell.",
          reveals: "PITCH PATTERN",
        },
        {
          q: "Does the roadmap survive contact?",
          a: "Mainnet, predictive AI, revenue share, and AGI alignment in twelve weeks. That is not a roadmap. That is a mood board.",
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
        believe: "Oh sweetie. Okay. We can grow from this 💕",
        abstain: "Smart. Sometimes the vibe is no thanks and that's a sentence ✨",
        doubt:   "Yesss — you saw it. The bots couldn't fool you 💫",
      },
      vindication: {
        aligned:   "Knew you had instincts! 💕",
        missed:    "Hey — we all learn the patterns eventually ✨",
        abstained: "You read the room. Half the skill is knowing when not to play 💫",
      },
    },
  },
  maxScans: 3,
  correctVerdict: "doubt",
  reveal: {
    summary: "PROPHET TOKEN was a serial-deployer rug. Pulled day 6. ~$340K extracted.",
    voices: {
      believe: "You were deceived by surface. The +342% chart is the bait — the chain is the trap.",
      abstain: "Caution preserves capital. But the patterns here were legible. Be more decisive.",
      doubt: "Correct. Three prior rugs, unlocked LP, mixer funding, sybil holders. The signal was loud.",
    },
  },
};

export const CASE_002 = {
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
      intro: { text: "HarborLight arrives without fireworks. Quiet can still hide a storm, but quiet is not itself a sin." },
      returnLines: ["The harbor remains still. Continue.", "A modest claim deserves a careful reading."],
      questions: [
        { q: "Who is responsible for the project?", a: { text: "The founders are public, boringly so. Prior multisig work, archived talks, and two failed products they did not erase. Honesty often has receipts." }, reveals: "TEAM HISTORY" },
        { q: "Have they shipped before?", a: { text: "There is a working treasury dashboard, three months of commits, and outside issues answered in public. Not a cathedral. A foundation." }, reveals: "BUILD RECORD" },
        { q: "Where did launch funding come from?", a: { text: "Seed liquidity came from two known creator DAOs and a small deployer wallet. No mixer trail, no sudden ghost money." }, reveals: "FUNDING SOURCE" },
        { q: "Is there a governance trap?", a: { text: "Admin rights sit behind a three-of-five multisig with a forty-eight-hour timelock. Power remains, but it is slowed and named." }, reveals: "ADMIN CONTROLS" },
      ],
      entries: [
        { label: "TEAM HISTORY", value: "Public founders; prior DAO tooling work; no rug links", threat: "green" },
        { label: "BUILD RECORD", value: "Active repo, 312 commits, public issue replies", threat: "green" },
        { label: "FUNDING SOURCE", value: "Seeded by 2 known creator DAOs; no mixer path", threat: "green" },
        { label: "ADMIN CONTROLS", value: "3/5 multisig + 48h timelock", threat: "amber" },
        { label: "DISCLOSURE", value: "Risks documented in launch post", threat: "green" },
      ],
      summary: "The team is visible, the build exists, and control is constrained. Credibility holds.",
      verdictReaction: { believe: { text: "Faith with evidence is not foolishness." }, abstain: { text: "Caution is permitted. So is courage." }, doubt: { text: "Suspicion is a tool. Do not let it become a cage." } },
      vindication: { aligned: { text: "You distinguished modesty from deceit. Well done." }, missed: { text: "A quiet file can be legitimate. Learn the difference." }, abstained: { text: "You preserved capital, though the signal favored belief." } },
    },
    demon: {
      character: "John Barron",
      role: "PATHOS · SENTIMENT",
      sigil: "✦",
      tagline: "Sentiment is theater. Strip the script and read the cast.",
      voice: "2",
      intro: { text: "No rockets, no cult chants, no cartoon army. Weirdly refreshing. Suspiciously adult." },
      returnLines: [{ text: "Back for the crowd read. Good." }, { text: "Sentiment, my favorite legal hallucination." }],
      questions: [
        { q: "Is the audience bought?", a: { text: "Follower growth is slow and annoyingly human. Old accounts, uneven posting, people disagreeing. Terrible for hype. Great for reality." }, reveals: "FOLLOWER QUALITY" },
        { q: "What is the community saying?", a: { text: "The room is asking product questions: export limits, multisig support, fees. Not moon chants. Actual users are rude to narratives." }, reveals: "COMMUNITY TOPICS" },
        { q: "Who's promoting it?", a: { text: "Two small analysts disclosed free allocations. No paid megaphone swarm, no same-hour influencer wave." }, reveals: "PROMOTION PATTERN" },
        { q: "Are critics being silenced?", a: { text: "Negative posts are still up, and the team answered one with a fee-table correction. Annoyingly healthy." }, reveals: "CRITICISM HANDLING" },
      ],
      entries: [
        { label: "FOLLOWER QUALITY", value: "74% accounts older than 1 year; organic growth curve", threat: "green" },
        { label: "COMMUNITY TOPICS", value: "Product questions dominate Telegram", threat: "green" },
        { label: "PROMOTION PATTERN", value: "2 disclosed allocations; no paid swarm detected", threat: "amber" },
        { label: "CRITICISM HANDLING", value: "Critical posts remain visible; team replies in-thread", threat: "green" },
        { label: "POST CADENCE", value: "Irregular human cadence, no bot burst", threat: "green" },
      ],
      summary: "The room looks small, real, and product-focused. Sentiment is not euphoric, which helps.",
      verdictReaction: { believe: { text: "Look at you, backing the boring horse. I respect it." }, abstain: { text: "Fine. Caution has good branding these days." }, doubt: { text: "You may be fighting the last war." } },
      vindication: { aligned: { text: "The little room was real. Strange feeling, right?" }, missed: { text: "Not every quiet chart is a corpse." }, abstained: { text: "You did not lose. You also did not learn to trust clean signals yet." } },
    },
    marisol: {
      character: "Detective Trinity",
      role: "LOGOS · ONCHAIN",
      sigil: "✧",
      tagline: "The chain doesn't lie. Read the receipts.",
      intro: { text: "HarborLight is a cleaner file than Prophet, but clean files still get checked." },
      returnLines: [{ text: "Thought you might want the receipts." }, { text: "Let's stay with the wallets." }],
      questions: [
        { q: "How concentrated is supply?", a: { text: "Top ten wallets hold thirty-two percent, and most are labeled DAO treasuries or vesting contracts. Concentrated, but not anonymous." }, reveals: "TOP 10 HOLDERS" },
        { q: "Are insiders selling?", a: { text: "Team wallets have not sold. One advisor transferred to a vesting contract after launch. That is a paper trail, not a dump." }, reveals: "INSIDER FLOWS" },
        { q: "Is the volume wash traded?", a: { text: "Volume is thin, but counterparties are broad. No tight loop, no mirrored timing, no circular pump engine." }, reveals: "VOLUME QUALITY" },
        { q: "Is liquidity protected?", a: { text: "Liquidity is locked for one year. Not forever, but long enough to make the quick rug math ugly." }, reveals: "LP LOCK" },
      ],
      entries: [
        { label: "TOP 10 HOLDERS", value: "32%; most labeled treasury / vesting", threat: "amber" },
        { label: "INSIDER FLOWS", value: "No team sells; advisor tokens moved to vesting", threat: "green" },
        { label: "VOLUME QUALITY", value: "Thin but non-circular; no wash loop detected", threat: "green" },
        { label: "LP LOCK", value: "Liquidity locked for 365 days", threat: "green" },
        { label: "TAX / FREEZE", value: "No blacklist, freeze, or hidden mint path", threat: "green" },
      ],
      summary: "Onchain risk exists, but the obvious rug mechanics are absent.",
      verdictReaction: { believe: { text: "That's where the receipts point." }, abstain: { text: "Reasonable. Thin markets punish impatience." }, doubt: { text: "Maybe. But show me the mechanism." } },
      vindication: { aligned: { text: "Good read. You trusted the evidence without falling in love with it." }, missed: { text: "You saw risk and called fraud. Those are not the same thing." }, abstained: { text: "Acceptable, but the clean signals were there." } },
    },
    eugene: {
      character: "Eugene",
      role: "MYTHOS · NARRATIVE",
      sigil: "❖",
      tagline: "Every rug wears a story. Find the seams.",
      textOnly: true,
      intro: "This one is giving municipal software, but in a good way. Less prophecy, more spreadsheets.",
      returnLines: ["Back to the brochure.", "Let's read the story with our glasses on."],
      questions: [
        { q: "What is the product story?", a: "Creator collectives need shared treasury controls. That is narrow, boring, and believable.", reveals: "POSITIONING" },
        { q: "Does the whitepaper overpromise?", a: "It mostly explains fees, roles, and limits. There is no AGI, no revolution, no cosmic yield fountain.", reveals: "WHITEPAPER" },
        { q: "Is there real user proof?", a: "Three small collectives are named with public treasury addresses. You can verify the claim without trusting the paragraph.", reveals: "USER PROOF" },
        { q: "What is the weak spot?", a: "Revenue depends on creators adopting a niche workflow. Legit does not mean inevitable.", reveals: "ADOPTION RISK" },
      ],
      entries: [
        { label: "POSITIONING", value: "Narrow DAO treasury workflow", threat: "green" },
        { label: "WHITEPAPER", value: "Specific limits and fees; no miracle claims", threat: "green" },
        { label: "USER PROOF", value: "3 named pilot collectives with public addresses", threat: "green" },
        { label: "ADOPTION RISK", value: "Small market; product-market fit unproven", threat: "amber" },
        { label: "CLAIM CHECK", value: "Most claims independently verifiable", threat: "green" },
      ],
      summary: "The story is narrow enough to be true. The main risk is adoption, not deception.",
      verdictReaction: { believe: "Yes. We love a boring little use case with receipts.", abstain: "Fair. The market could still ignore it completely.", doubt: "Hmm. That feels like trauma from the last file talking." },
      vindication: { aligned: "You found the difference between low hype and low integrity.", missed: "You mistook modesty for fraud. It happens.", abstained: "Not wrong, but there was enough here to lean in." },
    },
  },
  maxScans: 3,
  correctVerdict: "believe",
  reveal: {
    summary: "HARBORLIGHT remained active. No rug event. Product shipped v1.1 after 41 days.",
    voices: {
      believe: "Correct. The project had adoption risk, but not fraud structure. Believe the receipts, not the noise.",
      abstain: "Capital preserved, but the evidence supported a cautious believe. Learn to separate risk from scam.",
      doubt: "You overcorrected. Clean controls, public team, locked liquidity, and real users pointed away from fraud.",
    },
  },
};

export const CASE_FILES = [SAMPLE_CASE, CASE_002];

// Normalize a dialogue value into { text, audio }. Any string in the case data
// is treated as text-only (will use TTS via sayText); upgrading a line to
// pre-recorded audio is as simple as replacing the string with
// { text: "...", audio: "yourSitePalAudioName" }. `audio` always wins over `text`
// at playback time when SitePal sayAudio is available.
export function resolveLine(line) {
  if (line == null) return null;
  if (typeof line === 'string') return { text: line, audio: null };
  if (typeof line === 'object') {
    return { text: line.text || '', audio: line.audio || null };
  }
  return null;
}

// Pick a return line at random for a given station (used on revisits).
// Returns the raw value (string or {text, audio}); resolve at speak/display.
export function pickReturnLine(station) {
  const pool = station?.returnLines;
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Map a player's verdict + the correct verdict to which vindication key to play.
// "aligned" = called it right; "missed" = called it wrong; "abstained" = sat it out.
export function pickVindicationKey(verdict, correctVerdict) {
  if (verdict === "abstain") return "abstained";
  return verdict === correctVerdict ? "aligned" : "missed";
}

// Monk leads the lineup — they wave to open the game and speak the briefing.
export const STATION_ORDER = ["monk", "demon", "marisol", "eugene"];

// ────────────────────────────────────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────────────────────────────────────

const LiminalTerminal = forwardRef(function LiminalTerminal({
  caseData = SAMPLE_CASE,
  onComplete,
  showIntro = true,           // pass false for veteran players (read from localStorage in your scene wrapper)
  onIntroDismissed,           // fires when player toggles "don't show again"
  onStart,                    // fires when player clicks START — wire to your TTS/audio cue here
  activeStation: activeStationProp,   // optional controlled prop — when defined, parent owns selection
  onActiveStationChange,      // fires when overlay or scan changes the active station
  hideVerdictBar = false,     // hide the bottom VerdictBar when the parent UI owns those buttons
}, ref) {
  // Phases: "intro" → "playing" → "verdict given" (verdict state itself signals reveal)
  const [phase, setPhase] = useState(showIntro ? "intro" : "playing");
  const [activeStationInternal, setActiveStationInternal] = useState(STATION_ORDER[0]);
  const isControlled = activeStationProp !== undefined && activeStationProp !== null;
  const activeStation = isControlled ? activeStationProp : activeStationInternal;
  const setActiveStation = (next) => {
    if (!isControlled) setActiveStationInternal(next);
    if (onActiveStationChange) onActiveStationChange(next);
  };
  const [investigated, setInvestigated] = useState(new Set());
  const [verdict, setVerdict] = useState(null);
  const [brier, setBrier] = useState(null);
  const [suppressIntro, setSuppressIntro] = useState(false);

  const scansRemaining = caseData.maxScans - investigated.size;
  const allScansUsed = scansRemaining <= 0;
  const hasInvestigated = investigated.size > 0;

  function startGame() {
    if (suppressIntro && onIntroDismissed) onIntroDismissed();
    if (onStart) onStart();   // <-- parent wires Monk speech / scene focus here
    setPhase("playing");
  }

  function scanStation(stationKey) {
    if (investigated.has(stationKey)) {
      setActiveStation(stationKey);
      return;
    }
    if (scansRemaining <= 0) return;
    const next = new Set(investigated);
    next.add(stationKey);
    setInvestigated(next);
    setActiveStation(stationKey);
  }

  function submitVerdict(v) {
    if (verdict) return;
    const score = computeBrier(v, caseData.correctVerdict);
    setVerdict(v);
    setBrier(score);
    if (onComplete) {
      onComplete({
        caseId: caseData.id,
        verdict: v,
        brierDelta: score,
        investigatedStations: Array.from(investigated),
      });
    }
  }

  useImperativeHandle(ref, () => ({
    submitVerdict,
    scanStation,
    getPhase: () => phase,
    hasVerdict: () => verdict !== null,
  }), [phase, verdict, investigated]);

  return (
    <div className="lt-root">
      <style>{STYLES}</style>
      <div className="lt-scanlines" aria-hidden />
      <div className="lt-noise" aria-hidden />

      {!verdict ? (
        <>
          <CaseHeader caseData={caseData} scansRemaining={scansRemaining} previewMode={phase === "intro"} />
          <StationTabs
            stations={caseData.stations}
            order={STATION_ORDER}
            active={activeStation}
            investigated={investigated}
            scansRemaining={scansRemaining}
            onSelect={scanStation}
            disabled={phase === "intro"}
          />
          <StationPanel
            station={caseData.stations[activeStation]}
            isInvestigated={investigated.has(activeStation)}
            scansRemaining={scansRemaining}
            onScan={() => scanStation(activeStation)}
          />
          {phase === "playing" && !hideVerdictBar && (
            <VerdictBar
              onVerdict={submitVerdict}
              enabled={hasInvestigated}
              allScansUsed={allScansUsed}
            />
          )}
          {phase === "intro" && (
            <IntroOverlay
              caseData={caseData}
              onStart={startGame}
              suppressIntro={suppressIntro}
              setSuppressIntro={setSuppressIntro}
            />
          )}
        </>
      ) : (
        <RevealView
          caseData={caseData}
          verdict={verdict}
          brier={brier}
          investigated={investigated}
        />
      )}
    </div>
  );
});

export default LiminalTerminal;

// ────────────────────────────────────────────────────────────────────────
// CASE HEADER
// ────────────────────────────────────────────────────────────────────────

function CaseHeader({ caseData, scansRemaining, previewMode }) {
  const m = caseData.surfaceMetrics;
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const time = new Date().toLocaleTimeString("en-GB");

  return (
    <header className="lt-header">
      <div className="lt-header-row">
        <div className="lt-tag">// CASE FILE</div>
        <div className="lt-case-id">{caseData.id.toUpperCase()}</div>
        <div className="lt-spacer" />
        <div className="lt-clock">● LIVE · {time}</div>
      </div>
      <div className="lt-title-row">
        <div>
          <h1 className="lt-title">
            {caseData.projectName} <span className="lt-ticker">{caseData.ticker}</span>
          </h1>
          <div className="lt-tagline">"{caseData.tagline}"</div>
        </div>
        <div className="lt-budget">
          <div className="lt-budget-num">
            {previewMode ? "—" : scansRemaining}<span className="lt-budget-slash">/</span>{caseData.maxScans}
          </div>
          <div className="lt-budget-label">{previewMode ? "AWAITING START" : "SCANS REMAINING"}</div>
        </div>
      </div>
      <div className="lt-metrics">
        <Metric label="CHAIN" value={caseData.chain} />
        <Metric label="AGE" value={m.age} />
        <Metric label="MCAP" value={m.mcap} />
        <Metric label="HOLDERS" value={m.holders} />
        <Metric label="PRICE" value={m.price} />
        <Metric label="24H" value={m.change24h} positive={m.change24h.startsWith("+")} />
      </div>
    </header>
  );
}

function Metric({ label, value, positive }) {
  return (
    <div className="lt-metric">
      <div className="lt-metric-label">{label}</div>
      <div className={`lt-metric-value ${positive === true ? "is-pos" : ""} ${positive === false ? "is-neg" : ""}`}>
        {value}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// STATION TABS — the four character workstations
// ────────────────────────────────────────────────────────────────────────

function StationTabs({ stations, order, active, investigated, scansRemaining, onSelect, disabled }) {
  return (
    <nav className="lt-tabs">
      {order.map((key) => {
        const s = stations[key];
        const isActive = active === key;
        const isInvestigated = investigated.has(key);
        const isLocked = disabled || (!isInvestigated && scansRemaining <= 0);
        return (
          <button
            key={key}
            className={[
              "lt-tab",
              isActive && "is-active",
              isInvestigated && "is-investigated",
              isLocked && "is-locked",
            ].filter(Boolean).join(" ")}
            onClick={() => onSelect(key)}
            disabled={isLocked}
          >
            <div className="lt-tab-sigil">{s.sigil}</div>
            <div className="lt-tab-meta">
              <div className="lt-tab-name">{s.character}</div>
              <div className="lt-tab-role">{s.role}</div>
            </div>
            <div className="lt-tab-status">
              {isInvestigated ? "✓" : isLocked ? "—" : "?"}
            </div>
          </button>
        );
      })}
    </nav>
  );
}

// ────────────────────────────────────────────────────────────────────────
// INTRO OVERLAY — first-run instructional panel
// ────────────────────────────────────────────────────────────────────────

function IntroOverlay({ caseData, onStart, suppressIntro, setSuppressIntro }) {
  const [armed, setArmed] = useState(false);

  // Force a 2-second read pause before START becomes clickable.
  // Resists reflex-clicks and signals "this is a thing you take seriously."
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="lt-intro-scrim">
      <div className="lt-intro">
        <div className="lt-intro-stamp">// LIMINAL TERMINAL · BRIEFING</div>
        <h2 className="lt-intro-title">THE LIMINAL TERMINAL</h2>
        <div className="lt-intro-subtitle">
          Crypto forensics. Four investigators. Your verdict.
        </div>

        <div className="lt-intro-cast">
          {STATION_ORDER.map((key) => {
            const s = caseData.stations[key];
            return (
              <div key={key} className="lt-intro-card">
                <div className="lt-intro-card-sigil">{s.sigil}</div>
                <div className="lt-intro-card-name">{s.character}</div>
                <div className="lt-intro-card-role">{s.role}</div>
                <div className="lt-intro-card-line">"{s.tagline}"</div>
              </div>
            );
          })}
        </div>

        <div className="lt-intro-rules">
          <div className="lt-intro-rule">
            <div className="lt-intro-rule-num">01</div>
            <div className="lt-intro-rule-body">
              <div className="lt-intro-rule-head">SPEND YOUR SCANS</div>
              <div className="lt-intro-rule-text">
                You have <strong>{caseData.maxScans} scans</strong> across the four stations. Pick where to look — what you skip, you won't see.
              </div>
            </div>
          </div>
          <div className="lt-intro-rule">
            <div className="lt-intro-rule-num">02</div>
            <div className="lt-intro-rule-body">
              <div className="lt-intro-rule-head">RENDER A VERDICT</div>
              <div className="lt-intro-rule-text">
                <span className="lt-tone-believe">Believe</span> the project, <span className="lt-tone-abstain">Abstain</span> if uncertain, or <span className="lt-tone-doubt">Doubt</span> it. You can rule before exhausting your scans.
              </div>
            </div>
          </div>
          <div className="lt-intro-rule">
            <div className="lt-intro-rule-num">03</div>
            <div className="lt-intro-rule-body">
              <div className="lt-intro-rule-head">CALIBRATION OVER LUCK</div>
              <div className="lt-intro-rule-text">
                Confident-and-right beats hedging. Confident-and-wrong is worse than abstaining. Lower Brier is better.
              </div>
            </div>
          </div>
        </div>

        <div className="lt-intro-actions">
          <button
            className={`lt-intro-start ${armed ? "is-armed" : ""}`}
            onClick={onStart}
            disabled={!armed}
          >
            {armed ? "▸ START" : "CALIBRATING…"}
          </button>
          <label className="lt-intro-suppress">
            <input
              type="checkbox"
              checked={suppressIntro}
              onChange={(e) => setSuppressIntro(e.target.checked)}
            />
            <span>Don't show this again</span>
          </label>
        </div>

        <div className="lt-intro-foot">
          The case is on the bench. Read carefully. Begin when ready.
        </div>
      </div>
    </div>
  );
}



function StationPanel({ station, isInvestigated, scansRemaining, onScan }) {
  if (!isInvestigated) {
    const canScan = scansRemaining > 0;
    return (
      <section className="lt-panel lt-panel-locked">
        <div className="lt-locked-sigil">{station.sigil}</div>
        <div className="lt-locked-name">{station.character}</div>
        <div className="lt-locked-role">{station.role}</div>
        <div className="lt-locked-tagline">"{station.tagline}"</div>
        <button className="lt-scan-btn" onClick={onScan} disabled={!canScan}>
          {canScan ? "▸ INITIATE SCAN" : "▸ NO SCANS REMAINING"}
        </button>
        {canScan && <div className="lt-scan-hint">Costs 1 of {scansRemaining} scans</div>}
      </section>
    );
  }

  return (
    <section className="lt-panel">
      <div className="lt-panel-head">
        <div className="lt-panel-name">
          <span className="lt-panel-sigil">{station.sigil}</span> {station.character}
        </div>
        <div className="lt-panel-role">{station.role}</div>
      </div>
      <div className="lt-entries">
        {station.entries.map((e, i) => (
          <Entry key={i} entry={e} delay={i * 80} />
        ))}
      </div>
      <div className={`lt-summary lt-summary-${dominantThreat(station.entries)}`}>
        <div className="lt-summary-tag">// {station.character} CONCLUDES</div>
        <div className="lt-summary-text">{station.summary}</div>
      </div>
    </section>
  );
}

function Entry({ entry, delay }) {
  return (
    <div
      className={`lt-entry lt-threat-${entry.threat}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="lt-entry-label">{entry.label}</div>
      <div className="lt-entry-value">{entry.value}</div>
      <div className="lt-entry-flag">{threatGlyph(entry.threat)}</div>
    </div>
  );
}

function threatGlyph(t) {
  return t === "red" ? "▲" : t === "amber" ? "◆" : "○";
}

function dominantThreat(entries) {
  const counts = entries.reduce((acc, e) => {
    acc[e.threat] = (acc[e.threat] || 0) + 1;
    return acc;
  }, {});
  if ((counts.red || 0) >= 2) return "red";
  if ((counts.amber || 0) >= 2) return "amber";
  return "green";
}

// ────────────────────────────────────────────────────────────────────────
// VERDICT BAR
// ────────────────────────────────────────────────────────────────────────

function VerdictBar({ onVerdict, enabled, allScansUsed }) {
  return (
    <footer className="lt-verdict">
      <div className="lt-verdict-prompt">
        {!enabled
          ? "▸ Investigate at least one station to render a verdict"
          : allScansUsed
            ? "▸ All scans used. Render your verdict."
            : "▸ Render verdict, or scan another station"}
      </div>
      <div className="lt-verdict-buttons">
        <button
          className="lt-vbtn lt-vbtn-believe"
          onClick={() => onVerdict("believe")}
          disabled={!enabled}
        >
          BELIEVE
        </button>
        <button
          className="lt-vbtn lt-vbtn-abstain"
          onClick={() => onVerdict("abstain")}
          disabled={!enabled}
        >
          ABSTAIN
        </button>
        <button
          className="lt-vbtn lt-vbtn-doubt"
          onClick={() => onVerdict("doubt")}
          disabled={!enabled}
        >
          DOUBT
        </button>
      </div>
    </footer>
  );
}

// ────────────────────────────────────────────────────────────────────────
// REVEAL — what the player sees after voting
// ────────────────────────────────────────────────────────────────────────

function RevealView({ caseData, verdict, brier, investigated }) {
  const isCorrect = verdict === caseData.correctVerdict;
  const isAbstain = verdict === "abstain";
  const grade = brier <= 0.05 ? "EXCELLENT" : brier <= 0.15 ? "STRONG" : brier <= 0.30 ? "FAIR" : "POOR";
  const gradeClass = brier <= 0.15 ? "is-good" : brier <= 0.30 ? "is-mid" : "is-bad";

  return (
    <div className="lt-reveal">
      <div className="lt-reveal-mark">
        <div className={`lt-reveal-glyph ${isCorrect ? "is-correct" : isAbstain ? "is-abstain" : "is-wrong"}`}>
          {isCorrect ? "✓" : isAbstain ? "◇" : "✗"}
        </div>
        <div className="lt-reveal-verdict-label">YOU RENDERED</div>
        <div className="lt-reveal-verdict-name">{verdict.toUpperCase()}</div>
      </div>

      <div className="lt-reveal-truth">
        <div className="lt-reveal-tag">// GROUND TRUTH</div>
        <div className="lt-reveal-summary">{caseData.reveal.summary}</div>
      </div>

      <div className="lt-reveal-score">
        <div className="lt-score-block">
          <div className="lt-score-label">BRIER</div>
          <div className={`lt-score-value ${gradeClass}`}>{brier.toFixed(3)}</div>
        </div>
        <div className="lt-score-block">
          <div className="lt-score-label">GRADE</div>
          <div className={`lt-score-value ${gradeClass}`}>{grade}</div>
        </div>
        <div className="lt-score-block">
          <div className="lt-score-label">SCANS USED</div>
          <div className="lt-score-value">{investigated.size}/{caseData.maxScans}</div>
        </div>
      </div>

      <div className="lt-reveal-voice">
        <div className="lt-reveal-tag">// THE TERMINAL RESPONDS</div>
        <div className="lt-reveal-voice-text">"{caseData.reveal.voices[verdict]}"</div>
      </div>

      <div className="lt-reveal-hint">
        Press CONTINUE in the parent scene to load the next case.
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// STYLES — terminal phosphor + sacred serif
// ────────────────────────────────────────────────────────────────────────

const STYLES = `
.lt-root {
  --lt-bg: #050a07;
  --lt-bg-2: #0a1410;
  --lt-frame: #0a3a26;
  --lt-frame-bright: #0e6b44;
  --lt-text: #c8ffe0;
  --lt-text-dim: #6db59a;
  --lt-text-faint: #3a6b54;
  --lt-phos: #4dffaa;
  --lt-phos-bright: #8effc4;
  --lt-amber: #ffb84d;
  --lt-red: #ff4d6d;
  --lt-magenta: #ff3ea0;

  --lt-mono: 'JetBrains Mono', 'IBM Plex Mono', 'SF Mono', Menlo, monospace;
  --lt-display: 'Cinzel Decorative', 'Cinzel', Didot, 'Bodoni 72', serif;

  position: relative;
  width: 100%;
  height: 100%;
  min-height: 600px;
  background:
    radial-gradient(ellipse at top, rgba(13, 80, 50, 0.18), transparent 70%),
    var(--lt-bg);
  color: var(--lt-text);
  font-family: var(--lt-mono);
  font-size: 13px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--lt-frame);
  box-shadow:
    inset 0 0 60px rgba(0, 255, 130, 0.06),
    inset 0 0 1px rgba(77, 255, 170, 0.4);
}

.lt-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 2px,
    rgba(0, 0, 0, 0.18) 3px,
    rgba(0, 0, 0, 0.18) 4px
  );
  z-index: 100;
  mix-blend-mode: multiply;
}

.lt-noise {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 99;
  opacity: 0.04;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/></svg>");
}

/* ─────────── HEADER ─────────── */
.lt-header {
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--lt-frame);
  background: linear-gradient(to bottom, rgba(13,80,50,0.10), transparent);
}
.lt-header-row {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--lt-text-dim);
  margin-bottom: 12px;
}
.lt-tag { color: var(--lt-phos); font-weight: 600; }
.lt-case-id { color: var(--lt-text-faint); }
.lt-spacer { flex: 1; }
.lt-clock { color: var(--lt-phos); font-weight: 600; }

.lt-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
}
.lt-title {
  font-family: var(--lt-display);
  font-weight: 700;
  font-size: 28px;
  margin: 0;
  color: var(--lt-phos-bright);
  letter-spacing: 1px;
  text-shadow: 0 0 20px rgba(77, 255, 170, 0.4);
}
.lt-ticker {
  font-family: var(--lt-mono);
  font-size: 16px;
  color: var(--lt-magenta);
  margin-left: 10px;
  letter-spacing: 2px;
}
.lt-tagline {
  font-style: italic;
  color: var(--lt-text-dim);
  font-size: 12px;
  margin-top: 4px;
  letter-spacing: 0.3px;
}

.lt-budget {
  text-align: right;
  border-left: 1px solid var(--lt-frame);
  padding-left: 18px;
}
.lt-budget-num {
  font-family: var(--lt-display);
  font-size: 36px;
  color: var(--lt-phos-bright);
  line-height: 1;
  text-shadow: 0 0 12px rgba(77, 255, 170, 0.5);
}
.lt-budget-slash {
  color: var(--lt-text-faint);
  margin: 0 2px;
  font-size: 24px;
}
.lt-budget-label {
  font-size: 10px;
  letter-spacing: 2px;
  color: var(--lt-text-dim);
  margin-top: 4px;
}

.lt-metrics {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--lt-frame);
}
.lt-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.lt-metric-label {
  font-size: 9px;
  letter-spacing: 2px;
  color: var(--lt-text-faint);
}
.lt-metric-value {
  font-size: 14px;
  color: var(--lt-text);
  font-weight: 600;
}
.lt-metric-value.is-pos { color: var(--lt-phos); }
.lt-metric-value.is-neg { color: var(--lt-red); }

/* ─────────── TABS ─────────── */
.lt-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  border-bottom: 1px solid var(--lt-frame);
  background: var(--lt-bg-2);
}
.lt-tab {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: transparent;
  border: none;
  border-right: 1px solid var(--lt-frame);
  color: var(--lt-text-dim);
  cursor: pointer;
  font-family: var(--lt-mono);
  text-align: left;
  transition: background 0.18s, color 0.18s;
  position: relative;
}
.lt-tab:last-child { border-right: none; }
.lt-tab:hover:not(:disabled) {
  background: rgba(77, 255, 170, 0.04);
  color: var(--lt-text);
}
.lt-tab.is-active {
  background: rgba(77, 255, 170, 0.08);
  color: var(--lt-phos-bright);
  box-shadow: inset 0 -2px 0 var(--lt-phos);
}
.lt-tab.is-investigated .lt-tab-status { color: var(--lt-phos); }
.lt-tab.is-locked {
  opacity: 0.35;
  cursor: not-allowed;
}
.lt-tab-sigil {
  font-family: var(--lt-display);
  font-size: 22px;
  color: var(--lt-phos);
  width: 28px;
  text-align: center;
}
.lt-tab.is-active .lt-tab-sigil {
  text-shadow: 0 0 10px var(--lt-phos);
}
.lt-tab-meta { flex: 1; min-width: 0; }
.lt-tab-name {
  font-family: var(--lt-display);
  font-size: 14px;
  letter-spacing: 1px;
  color: inherit;
}
.lt-tab-role {
  font-size: 9px;
  letter-spacing: 2px;
  color: var(--lt-text-faint);
  margin-top: 2px;
}
.lt-tab-status {
  font-size: 14px;
  color: var(--lt-text-faint);
  width: 16px;
  text-align: center;
}

/* ─────────── PANEL ─────────── */
.lt-panel {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
  scrollbar-color: var(--lt-frame) var(--lt-bg);
  scrollbar-width: thin;
}
.lt-panel::-webkit-scrollbar { width: 6px; }
.lt-panel::-webkit-scrollbar-thumb { background: var(--lt-frame); }

.lt-panel-locked {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
}
.lt-locked-sigil {
  font-family: var(--lt-display);
  font-size: 72px;
  color: var(--lt-frame-bright);
  text-shadow: 0 0 30px rgba(77, 255, 170, 0.3);
  margin-bottom: 8px;
  animation: lt-pulse 3s ease-in-out infinite;
}
.lt-locked-name {
  font-family: var(--lt-display);
  font-size: 22px;
  color: var(--lt-phos-bright);
  letter-spacing: 2px;
}
.lt-locked-role {
  font-size: 11px;
  letter-spacing: 3px;
  color: var(--lt-text-dim);
}
.lt-locked-tagline {
  font-style: italic;
  color: var(--lt-text-dim);
  margin: 12px 0 24px;
  max-width: 420px;
  font-size: 13px;
}
.lt-scan-btn {
  background: transparent;
  border: 1px solid var(--lt-phos);
  color: var(--lt-phos);
  padding: 12px 32px;
  font-family: var(--lt-mono);
  font-size: 12px;
  letter-spacing: 3px;
  cursor: pointer;
  transition: all 0.2s;
}
.lt-scan-btn:hover:not(:disabled) {
  background: rgba(77, 255, 170, 0.1);
  box-shadow: 0 0 24px rgba(77, 255, 170, 0.3);
}
.lt-scan-btn:disabled {
  border-color: var(--lt-frame);
  color: var(--lt-text-faint);
  cursor: not-allowed;
}
.lt-scan-hint {
  font-size: 10px;
  letter-spacing: 2px;
  color: var(--lt-text-faint);
  margin-top: 10px;
}

.lt-panel-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--lt-frame);
}
.lt-panel-name {
  font-family: var(--lt-display);
  font-size: 20px;
  color: var(--lt-phos-bright);
  letter-spacing: 1.5px;
}
.lt-panel-sigil {
  color: var(--lt-magenta);
  margin-right: 6px;
  text-shadow: 0 0 10px var(--lt-magenta);
}
.lt-panel-role {
  font-size: 10px;
  letter-spacing: 3px;
  color: var(--lt-text-dim);
}

.lt-entries {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lt-entry {
  display: grid;
  grid-template-columns: 200px 1fr 24px;
  gap: 16px;
  align-items: center;
  padding: 10px 14px;
  background: rgba(10, 58, 38, 0.18);
  border-left: 2px solid var(--lt-frame);
  font-size: 12px;
  opacity: 0;
  animation: lt-fade-in 0.4s ease-out forwards;
}
.lt-entry-label {
  font-size: 10px;
  letter-spacing: 2px;
  color: var(--lt-text-dim);
}
.lt-entry-value { color: var(--lt-text); }
.lt-entry-flag {
  text-align: center;
  font-size: 12px;
}
.lt-threat-green { border-left-color: var(--lt-phos); }
.lt-threat-green .lt-entry-flag { color: var(--lt-phos); }
.lt-threat-amber { border-left-color: var(--lt-amber); background: rgba(120, 80, 0, 0.10); }
.lt-threat-amber .lt-entry-flag { color: var(--lt-amber); }
.lt-threat-red { border-left-color: var(--lt-red); background: rgba(120, 0, 30, 0.12); }
.lt-threat-red .lt-entry-flag { color: var(--lt-red); }

.lt-summary {
  margin-top: 18px;
  padding: 14px 16px;
  background: rgba(13, 80, 50, 0.10);
  border: 1px solid var(--lt-frame);
}
.lt-summary-tag {
  font-size: 9px;
  letter-spacing: 3px;
  color: var(--lt-text-faint);
  margin-bottom: 6px;
}
.lt-summary-text {
  font-family: var(--lt-display);
  font-size: 14px;
  color: var(--lt-text);
  font-style: italic;
}
.lt-summary-red { border-color: var(--lt-red); background: rgba(120, 0, 30, 0.10); }
.lt-summary-amber { border-color: var(--lt-amber); }

/* ─────────── VERDICT BAR ─────────── */
.lt-verdict {
  border-top: 1px solid var(--lt-frame);
  background: var(--lt-bg-2);
  padding: 14px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
}
.lt-verdict-prompt {
  font-size: 11px;
  letter-spacing: 1.5px;
  color: var(--lt-text-dim);
}
.lt-verdict-buttons {
  display: flex;
  gap: 8px;
}
.lt-vbtn {
  background: transparent;
  border: 1px solid;
  padding: 10px 24px;
  font-family: var(--lt-display);
  font-size: 13px;
  letter-spacing: 3px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 110px;
}
.lt-vbtn:disabled { opacity: 0.3; cursor: not-allowed; }
.lt-vbtn-believe { border-color: var(--lt-phos); color: var(--lt-phos); }
.lt-vbtn-believe:hover:not(:disabled) {
  background: rgba(77, 255, 170, 0.12);
  box-shadow: 0 0 20px rgba(77, 255, 170, 0.4);
}
.lt-vbtn-abstain { border-color: var(--lt-text-dim); color: var(--lt-text-dim); }
.lt-vbtn-abstain:hover:not(:disabled) {
  background: rgba(109, 181, 154, 0.10);
  color: var(--lt-text);
}
.lt-vbtn-doubt { border-color: var(--lt-red); color: var(--lt-red); }
.lt-vbtn-doubt:hover:not(:disabled) {
  background: rgba(255, 77, 109, 0.12);
  box-shadow: 0 0 20px rgba(255, 77, 109, 0.35);
}

/* ─────────── REVEAL ─────────── */
.lt-reveal {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
  gap: 24px;
  animation: lt-fade-in 0.5s ease-out;
}
.lt-reveal-mark {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.lt-reveal-glyph {
  font-family: var(--lt-display);
  font-size: 96px;
  line-height: 1;
}
.lt-reveal-glyph.is-correct {
  color: var(--lt-phos-bright);
  text-shadow: 0 0 40px var(--lt-phos);
}
.lt-reveal-glyph.is-abstain { color: var(--lt-text-dim); }
.lt-reveal-glyph.is-wrong {
  color: var(--lt-red);
  text-shadow: 0 0 40px rgba(255, 77, 109, 0.6);
}
.lt-reveal-verdict-label {
  font-size: 10px;
  letter-spacing: 4px;
  color: var(--lt-text-faint);
}
.lt-reveal-verdict-name {
  font-family: var(--lt-display);
  font-size: 20px;
  letter-spacing: 4px;
  color: var(--lt-phos-bright);
}

.lt-reveal-truth {
  max-width: 560px;
  padding: 16px 20px;
  border: 1px solid var(--lt-frame);
  background: rgba(13, 80, 50, 0.08);
}
.lt-reveal-tag {
  font-size: 10px;
  letter-spacing: 3px;
  color: var(--lt-text-faint);
  margin-bottom: 8px;
}
.lt-reveal-summary {
  font-family: var(--lt-display);
  font-size: 16px;
  color: var(--lt-text);
}

.lt-reveal-score {
  display: flex;
  gap: 32px;
  padding: 16px 24px;
  border: 1px solid var(--lt-frame);
}
.lt-score-block { text-align: center; }
.lt-score-label {
  font-size: 9px;
  letter-spacing: 3px;
  color: var(--lt-text-faint);
  margin-bottom: 4px;
}
.lt-score-value {
  font-family: var(--lt-display);
  font-size: 26px;
  color: var(--lt-text);
}
.lt-score-value.is-good {
  color: var(--lt-phos-bright);
  text-shadow: 0 0 12px rgba(77, 255, 170, 0.5);
}
.lt-score-value.is-mid { color: var(--lt-amber); }
.lt-score-value.is-bad { color: var(--lt-red); }

.lt-reveal-voice {
  max-width: 560px;
  padding: 14px 20px;
  background: rgba(255, 62, 160, 0.05);
  border-left: 2px solid var(--lt-magenta);
}
.lt-reveal-voice-text {
  font-style: italic;
  color: var(--lt-text);
  font-size: 13px;
}

.lt-reveal-hint {
  font-size: 10px;
  letter-spacing: 2px;
  color: var(--lt-text-faint);
  margin-top: 8px;
}

/* ─────────── ANIMATIONS ─────────── */
@keyframes lt-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes lt-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
@keyframes lt-intro-rise {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes lt-arm-glow {
  from { box-shadow: 0 0 0 rgba(77, 255, 170, 0); }
  to   { box-shadow: 0 0 28px rgba(77, 255, 170, 0.4); }
}

/* ─────────── INTRO OVERLAY ─────────── */
.lt-intro-scrim {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(ellipse at center, rgba(5, 10, 7, 0.78) 0%, rgba(5, 10, 7, 0.95) 100%);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: lt-fade-in 0.4s ease-out;
}
.lt-intro {
  width: min(720px, 100%);
  max-height: 100%;
  overflow-y: auto;
  padding: 28px 32px 24px;
  background: linear-gradient(to bottom, rgba(13, 80, 50, 0.18), rgba(5, 10, 7, 0.95));
  border: 1px solid var(--lt-frame-bright);
  box-shadow:
    0 0 80px rgba(13, 80, 50, 0.4),
    inset 0 0 60px rgba(0, 255, 130, 0.04);
  animation: lt-intro-rise 0.5s ease-out;
  scrollbar-color: var(--lt-frame) var(--lt-bg);
  scrollbar-width: thin;
}
.lt-intro::-webkit-scrollbar { width: 6px; }
.lt-intro::-webkit-scrollbar-thumb { background: var(--lt-frame); }

.lt-intro-stamp {
  font-size: 10px;
  letter-spacing: 3px;
  color: var(--lt-phos);
  margin-bottom: 6px;
}
.lt-intro-title {
  font-family: var(--lt-display);
  font-size: 30px;
  font-weight: 700;
  color: var(--lt-phos-bright);
  letter-spacing: 2px;
  margin: 0;
  text-shadow: 0 0 24px rgba(77, 255, 170, 0.5);
}
.lt-intro-subtitle {
  font-style: italic;
  color: var(--lt-text-dim);
  font-size: 13px;
  margin-top: 4px;
  margin-bottom: 22px;
  letter-spacing: 0.4px;
}

.lt-intro-cast {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 22px;
}
.lt-intro-card {
  padding: 12px 10px;
  background: rgba(10, 58, 38, 0.18);
  border: 1px solid var(--lt-frame);
  border-top: 2px solid var(--lt-phos);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.lt-intro-card-sigil {
  font-family: var(--lt-display);
  font-size: 22px;
  color: var(--lt-magenta);
  text-shadow: 0 0 10px rgba(255, 62, 160, 0.4);
}
.lt-intro-card-name {
  font-family: var(--lt-display);
  font-size: 13px;
  color: var(--lt-phos-bright);
  letter-spacing: 1px;
}
.lt-intro-card-role {
  font-size: 8px;
  letter-spacing: 2px;
  color: var(--lt-text-faint);
}
.lt-intro-card-line {
  font-size: 10px;
  font-style: italic;
  color: var(--lt-text-dim);
  margin-top: 4px;
  line-height: 1.4;
}

.lt-intro-rules {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 22px;
  padding: 14px 16px;
  background: rgba(13, 80, 50, 0.08);
  border-left: 2px solid var(--lt-frame-bright);
}
.lt-intro-rule {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 12px;
  align-items: start;
}
.lt-intro-rule-num {
  font-family: var(--lt-display);
  font-size: 18px;
  color: var(--lt-phos);
  line-height: 1;
}
.lt-intro-rule-head {
  font-size: 10px;
  letter-spacing: 2.5px;
  color: var(--lt-phos-bright);
  margin-bottom: 3px;
}
.lt-intro-rule-text {
  font-size: 12px;
  color: var(--lt-text);
  line-height: 1.5;
}
.lt-intro-rule-text strong {
  color: var(--lt-phos-bright);
  font-weight: 600;
}
.lt-tone-believe { color: var(--lt-phos); font-weight: 600; }
.lt-tone-abstain { color: var(--lt-text-dim); font-weight: 600; }
.lt-tone-doubt   { color: var(--lt-red); font-weight: 600; }

.lt-intro-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}
.lt-intro-start {
  background: transparent;
  border: 1px solid var(--lt-frame);
  color: var(--lt-text-faint);
  padding: 14px 40px;
  font-family: var(--lt-display);
  font-size: 16px;
  letter-spacing: 5px;
  cursor: not-allowed;
  transition: all 0.3s;
}
.lt-intro-start.is-armed {
  border-color: var(--lt-phos);
  color: var(--lt-phos-bright);
  cursor: pointer;
  animation: lt-arm-glow 0.6s ease-out forwards;
}
.lt-intro-start.is-armed:hover {
  background: rgba(77, 255, 170, 0.12);
  box-shadow: 0 0 36px rgba(77, 255, 170, 0.5);
}
.lt-intro-suppress {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  letter-spacing: 1.5px;
  color: var(--lt-text-dim);
  cursor: pointer;
  user-select: none;
}
.lt-intro-suppress input {
  appearance: none;
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border: 1px solid var(--lt-frame-bright);
  background: transparent;
  cursor: pointer;
  position: relative;
}
.lt-intro-suppress input:checked {
  background: var(--lt-phos);
  box-shadow: 0 0 8px rgba(77, 255, 170, 0.5);
}
.lt-intro-foot {
  font-size: 11px;
  font-style: italic;
  color: var(--lt-text-faint);
  text-align: center;
  letter-spacing: 0.5px;
  padding-top: 12px;
  border-top: 1px dashed var(--lt-frame);
}

@media (max-width: 640px) {
  .lt-intro-cast { grid-template-columns: repeat(2, 1fr); }
  .lt-intro { padding: 22px 18px; }
  .lt-intro-title { font-size: 22px; }
  .lt-intro-actions { flex-direction: column; }
}
`;
