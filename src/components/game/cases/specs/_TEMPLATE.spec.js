// ─────────────────────────────────────────────────────────────────────────
// CASE SPEC TEMPLATE
//
// A spec is CONTENT ONLY. Copy this file to `case-NNN.spec.js`, fill it in,
// then run:   node scripts/gen-case.mjs src/components/game/cases/specs/case-NNN.spec.js
// which emits the full `src/components/game/cases/case-NNN.js` with all the
// boilerplate (character identities, roles, sigils, voice configs, the
// `audio: null` + `// re-record:` markers, eugene's text-only wiring, maxScans).
//
// Then register it in `cases/index.js` and re-run the manifest:
//   node scripts/gen-rerecord-manifest.mjs
//
// Design first: pick a fresh combination from docs/trade-case-taxonomy.md and
// run the anti-redundancy checklist before writing.
//
// RULES the generator enforces (it will refuse an invalid spec):
//   • exactly 5 entries and 4 questions per station
//   • every question.reveals must equal one of THAT station's entry labels
//   • correctVerdict is "believe" or "doubt"
//   • decisiveLenses is a non-empty subset of ["monk","demon","marisol","eugene"]
//
// Voice in spoken text: spell tickers out ("Prophet Token", not "$PRPHT").
// Eugene is text-only — her lines are never recorded.
// ─────────────────────────────────────────────────────────────────────────

export default {
  id: "case-NNN",
  difficulty: "intermediate", // beginner | intermediate | advanced
  projectName: "PROJECT NAME",
  ticker: "$TICK",
  chain: "Base",
  tagline: "The one-line pitch the project sells itself with.",
  surfaceMetrics: {
    age: "12 days",
    mcap: "$3.4M",
    holders: "1,820",
    price: "$0.018",
    change24h: "+24%",
    socialScore: "7.1/10",
  },

  correctVerdict: "doubt",          // "believe" | "doubt"
  decisiveLenses: ["marisol"],      // which station(s) hold the case-cracking evidence

  // Played after the verdict commits.
  reveal: {
    summary: "What actually happened to the project (1–2 sentences).",
    voices: {
      believe: "Said when the player leaned Trust.",
      abstain: "Said when the player stayed centered (Abstain).",
      doubt:   "Said when the player leaned Doubt.",
    },
  },

  // ── STATIONS ──────────────────────────────────────────────────────────
  // Each station: intro, 3 returnLines, 5 entries, 4 questions (each answer
  // maps to an entry via `reveals`), a summary, verdictReaction, vindication.
  stations: {
    // GR80 — grave, scriptural, measured.
    monk: {
      intro: "GR80's opening read on this project.",
      returnLines: ["Revisit line 1.", "Revisit line 2.", "Revisit line 3."],
      entries: [
        { label: "DEPLOYER WALLET AGE", value: "e.g. Created 6 days ago", threat: "amber" },
        { label: "TEAM HISTORY",        value: "...",                      threat: "green" },
        { label: "FUNDING SOURCE",      value: "...",                      threat: "green" },
        { label: "PRIOR OUTCOMES",      value: "...",                      threat: "green" },
        { label: "ADMIN CONTROLS",      value: "...",                      threat: "amber" },
      ],
      questions: [
        { q: "What do we know about the team?",   a: "GR80's spoken answer.", reveals: "TEAM HISTORY" },
        { q: "How was the deployer funded?",      a: "...",                   reveals: "FUNDING SOURCE" },
        { q: "Has anyone here failed before?",    a: "...",                   reveals: "PRIOR OUTCOMES" },
        { q: "Who controls the contract?",        a: "...",                   reveals: "ADMIN CONTROLS" },
      ],
      summary: "GR80's one-line conclusion.",
      verdictReaction: { believe: "...", abstain: "...", doubt: "..." },
      vindication:     { aligned: "...", missed: "...", abstained: "..." },
    },

    // John Barron — brash, streetwise, punchy.
    demon: {
      intro: "...",
      returnLines: ["...", "...", "..."],
      entries: [
        { label: "FOLLOWER QUALITY",  value: "...", threat: "green" },
        { label: "COMMUNITY TOPICS",  value: "...", threat: "green" },
        { label: "PROMOTION PATTERN", value: "...", threat: "amber" },
        { label: "CRITICISM HANDLING",value: "...", threat: "green" },
        { label: "POST CADENCE",      value: "...", threat: "amber" },
      ],
      questions: [
        { q: "Are the followers bots?",            a: "...", reveals: "FOLLOWER QUALITY" },
        { q: "What's the community actually like?",a: "...", reveals: "COMMUNITY TOPICS" },
        { q: "Who's promoting it?",                a: "...", reveals: "PROMOTION PATTERN" },
        { q: "Does anyone push back on it?",       a: "...", reveals: "CRITICISM HANDLING" },
      ],
      summary: "...",
      verdictReaction: { believe: "...", abstain: "...", doubt: "..." },
      vindication:     { aligned: "...", missed: "...", abstained: "..." },
    },

    // Detective Trinity — terse, hardboiled noir.
    marisol: {
      intro: "...",
      returnLines: ["...", "...", "..."],
      entries: [
        { label: "TOP 10 HOLDERS", value: "...", threat: "amber" },
        { label: "DEPLOYER HOLDINGS", value: "...", threat: "green" },
        { label: "VOLUME QUALITY", value: "...", threat: "green" },
        { label: "LP / VESTING", value: "...", threat: "green" },
        { label: "CONTRACT FLAGS", value: "...", threat: "amber" },
      ],
      questions: [
        { q: "Who can move the market?",   a: "...", reveals: "TOP 10 HOLDERS" },
        { q: "Is the deployer hiding supply?", a: "...", reveals: "DEPLOYER HOLDINGS" },
        { q: "Is the volume real demand?", a: "...", reveals: "VOLUME QUALITY" },
        { q: "Can liquidity disappear?",   a: "...", reveals: "LP / VESTING" },
      ],
      summary: "...",
      verdictReaction: { believe: "...", abstain: "...", doubt: "..." },
      vindication:     { aligned: "...", missed: "...", abstained: "..." },
    },

    // Eugene — bubbly, warm, emoji. TEXT-ONLY (never recorded).
    eugene: {
      intro: "...",
      returnLines: ["...", "...", "..."],
      entries: [
        { label: "WHITEPAPER",      value: "...", threat: "green" },
        { label: "PRODUCT PROOF",   value: "...", threat: "green" },
        { label: "PITCH PATTERN",   value: "...", threat: "green" },
        { label: "ROADMAP REALISM", value: "...", threat: "amber" },
        { label: "ORIGIN STORY",    value: "...", threat: "amber" },
      ],
      questions: [
        { q: "What are they actually promising?",       a: "...", reveals: "WHITEPAPER" },
        { q: "Is there a working product?",             a: "...", reveals: "PRODUCT PROOF" },
        { q: "Is any of this copied from other projects?", a: "...", reveals: "PITCH PATTERN" },
        { q: "Is the roadmap realistic?",               a: "...", reveals: "ROADMAP REALISM" },
      ],
      summary: "...",
      verdictReaction: { believe: "...", abstain: "...", doubt: "..." },
      vindication:     { aligned: "...", missed: "...", abstained: "..." },
    },
  },
};
