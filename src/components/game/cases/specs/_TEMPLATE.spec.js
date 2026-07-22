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
//   • every question.reveals must equal one of THAT station's TIER-1 entry
//     labels (never a deep label — decisive evidence stays Tier-1, §3.3)
//   • 1–3 deepEntries per station; labels unique vs that station's Tier-1
//   • lockedQuestion optional per station; its reveals must match a Tier-1
//     OR deep label of that station
//   • connections optional; each lens pair must be one of the four printed
//     crossref pairs (marisol+monk / marisol+eugene / monk+demon /
//     demon+eugene) and its label must not collide at either station
//   • correctVerdict is "believe" or "doubt"
//   • decisiveLenses is a non-empty subset of ["monk","demon","marisol","eugene"]
//
// Tier-2 authoring rules (§3.3): every case stays solvable on 3 free scans —
// deepEntries corroborate, quantify, or exonerate; they NEVER hold the only
// copy of the crack. Advanced cases spread corroborating signal across
// lenses so Cross-Reference cards shine.
//
// Voice in spoken text: spell tickers out ("Prophet Token", not "$PRPHT").
// Eugene is text-only — those lines are never recorded.
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

  // OPTIONAL cross-reference payoff(s) — see RULES above for the four legal
  // lens pairs. Beginner cases may omit or leave empty.
  connections: [
    // { lenses: ["marisol", "monk"], entry: { label: "CONNECTION LABEL", value: "...", threat: "red" } },
  ],

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
  // maps to an entry via `reveals`), 1–3 deepEntries (Tier-2, card-gated),
  // an optional lockedQuestion, a summary, verdictReaction, vindication.
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
      // Tier-2: corroborate/quantify/exonerate — never the only crack.
      deepEntries: [
        { label: "DEEP ENTRY A", value: "...", threat: "amber" },
        { label: "DEEP ENTRY B", value: "...", threat: "red" },
      ],
      // OPTIONAL sealed 4th question (unsealed by a Deep Scan; asking it
      // still costs a scan). Delete on stations without one.
      // lockedQuestion: { q: "Sealed question?", a: "Spoken answer.", reveals: "DEEP ENTRY A" },
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
      deepEntries: [
        { label: "DEEP ENTRY C", value: "...", threat: "amber" },
        { label: "DEEP ENTRY D", value: "...", threat: "green" },
      ],
      summary: "...",
      verdictReaction: { believe: "...", abstain: "...", doubt: "..." },
      vindication:     { aligned: "...", missed: "...", abstained: "..." },
    },

    // Detective Marisol — terse, hardboiled noir.
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
      deepEntries: [
        { label: "DEEP ENTRY E", value: "...", threat: "red" },
        { label: "DEEP ENTRY F", value: "...", threat: "amber" },
      ],
      summary: "...",
      verdictReaction: { believe: "...", abstain: "...", doubt: "..." },
      vindication:     { aligned: "...", missed: "...", abstained: "..." },
    },

    // Eugene — pattern-matcher, rare-find hunter, slightly haunted by charts
    // he's seen before. TEXT-ONLY (never recorded; lockedQuestion `a` is a
    // plain string).
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
      deepEntries: [
        { label: "DEEP ENTRY G", value: "...", threat: "amber" },
        { label: "DEEP ENTRY H", value: "...", threat: "green" },
      ],
      summary: "...",
      verdictReaction: { believe: "...", abstain: "...", doubt: "..." },
      vindication:     { aligned: "...", missed: "...", abstained: "..." },
    },
  },
};
