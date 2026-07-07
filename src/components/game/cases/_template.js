// Case template — copy this file to `case-NNN.js`, fill in the values, then
// add it to `CASE_FILES` in `./index.js`. Delete sections you don't need
// (e.g. `rulesIntro` only belongs on the first case in the sequence).
//
// Audio names: SitePal caps audio identifiers at 25 chars. If a name would
// exceed that, truncate the trailing word (e.g. `react_believe` →
// `react_believ`) and make sure the truncated form is what's actually
// uploaded to SitePal. Long station keys eat into the budget — `trinity_*`
// has fewer chars to spare than `monk_*`.
//
// Dialogue shape: any string is treated as text-only (TTS via SitePal
// `sayText`). To use a pre-recorded clip, replace the string with
// `{ text: "...", audio: "yourSitePalAudioName" }`. `audio` wins over `text`
// at playback time; `text` is the TTS fallback + caption source.
//
// Rich evidence visuals (optional): add a `visual` field to any `entry` to
// render a FlowGraph / Pie / Timeline / Comparison / Checklist / Image in
// the fullscreen "VIEW ON SCREEN" overlay. Per-case `entry.visual` wins
// over the legacy global registry in `EvidenceOverlay.jsx`. Without
// `visual`, the overlay falls back to a styled text card showing
// label/value/threat. Examples: "ENTRY LABEL 3" (Pie) and "ENTRY LABEL 5"
// (Image) on the demon station below.
//
// Image assets live at `/public/evidence/case-NNN/<slug>.webp` and are
// referenced with the leading-slash path `/evidence/case-NNN/<slug>.webp`.
// Use Image for diegetic artifacts (faux tweets, Telegram chats, faked
// Etherscan views); use procedural primitives for analytical aggregates
// — they data-bind, theme with threat color, and translate cleanly.

const CASE_TEMPLATE = {
  id: "case-NNN",
  difficulty: "beginner", // "beginner" | "intermediate" | "advanced"
  projectName: "PROJECT NAME",
  ticker: "$TICKER",
  chain: "Base",
  tagline: "One-line pitch as the project markets itself.",

  // Top HUD strip. All strings; format however you like — these are display-only.
  surfaceMetrics: {
    age: "",
    mcap: "",
    holders: "",
    price: "",
    change24h: "",
    socialScore: "",
  },

  // OPTIONAL — only set on the very first case a player sees. Plays before
  // the monk's intro on first visit, then chains into `stations.monk.intro`.
  // Suppressed forever after via the `rulesHeard` flag. Delete this whole
  // block on cases 2+.
  // rulesIntro: {
  //   text: "Welcome, friend. The rite is simple...",
  //   audio: "caseNNN_monk_rules",
  // },

  stations: {
    // ETHOS — credibility / team / contract lineage
    monk: {
      character: "Saint GR80",
      role: "ETHOS · CREDIBILITY",
      sigil: "✠",
      tagline: "Trust nothing the team says about itself. Watch what they've already done.",
      // SitePal voice override for TTS fallback (audio recordings bypass this).
      // GR80 = Gilbert (UK male, Acapela): voice "9", lang 1, engine 7.
      voice: { voice: "9", lang: 1, engine: 7 },
      intro: {
        // TTS reads "$TICKER" as "dollar T I C K E R" — use the spoken name here.
        text: "Opening line for this file.",
        audio: "caseNNN_monk_intro",
      },
      // Random pool on revisits. Never replays `intro`.
      returnLines: [
        "Revisit line 1.",
        "Revisit line 2.",
      ],
      // Each question consumes one of the case's scans. `reveals` must match
      // a label in `entries` below — that's how the right evidence card
      // surfaces on the monitor when the line plays.
      questions: [
        { q: "Question 1?", a: { text: "Answer 1.", audio: "caseNNN_monk_q1" }, reveals: "ENTRY LABEL 1" },
        { q: "Question 2?", a: { text: "Answer 2.", audio: "caseNNN_monk_q2" }, reveals: "ENTRY LABEL 2" },
        { q: "Question 3?", a: { text: "Answer 3.", audio: "caseNNN_monk_q3" }, reveals: "ENTRY LABEL 3" },
        { q: "Question 4?", a: { text: "Answer 4.", audio: "caseNNN_monk_q4" }, reveals: "ENTRY LABEL 4" },
      ],
      entries: [
        { label: "ENTRY LABEL 1", value: "", threat: "green" }, // "green" | "amber" | "red"
        { label: "ENTRY LABEL 2", value: "", threat: "amber" },
        { label: "ENTRY LABEL 3", value: "", threat: "red" },
        { label: "ENTRY LABEL 4", value: "", threat: "red" },
        { label: "ENTRY LABEL 5", value: "", threat: "amber" },
      ],
      summary: "One-line takeaway shown when the station closes.",
      // Plays on verdict commit (before the outcome reveal). Audio name budget
      // for monk: 25 chars total. `react_believe` fits as-is.
      verdictReaction: {
        believe: { text: "", audio: "caseNNN_monk_react_believ" },
        abstain: { text: "", audio: "caseNNN_monk_react_abstai" },
        doubt:   { text: "", audio: "caseNNN_monk_react_doubt" },
      },
      // Plays after outcome reveal. `aligned` = player matched ground truth;
      // `missed` = wrong; `abstained` = chose Abstain regardless of truth.
      vindication: {
        aligned:   { text: "", audio: "caseNNN_monk_vind_aligned" },
        missed:    { text: "", audio: "caseNNN_monk_vind_missed" },
        abstained: { text: "", audio: "caseNNN_monk_vind_abstain" },
      },
    },

    // PATHOS — sentiment / crowd / promotion
    demon: {
      character: "John Barron",
      role: "PATHOS · SENTIMENT",
      sigil: "✦",
      tagline: "Sentiment is theater. Strip the script and read the cast.",
      voice: "2", // SitePal Neural2 US male slot — adjust to your account.
      intro: { text: "", audio: "caseNNN_demon_intro" },
      // Barron's revisit pool is character-wide and reused across cases —
      // these three audio files (`demon_return_1..3`) already exist.
      returnLines: [
        { text: "You're back. Smart. Very smart.", audio: "demon_return_1" },
        { text: "Good. You're back. I was getting bored.", audio: "demon_return_2" },
        { text: "Round two. Let's go.", audio: "demon_return_3" },
      ],
      questions: [
        { q: "?", a: { text: "", audio: "caseNNN_demon_q1" }, reveals: "ENTRY LABEL 1" },
        { q: "?", a: { text: "", audio: "caseNNN_demon_q2" }, reveals: "ENTRY LABEL 2" },
        { q: "?", a: { text: "", audio: "caseNNN_demon_q3" }, reveals: "ENTRY LABEL 3" },
        { q: "?", a: { text: "", audio: "caseNNN_demon_q4" }, reveals: "ENTRY LABEL 4" },
      ],
      entries: [
        { label: "ENTRY LABEL 1", value: "", threat: "green" },
        { label: "ENTRY LABEL 2", value: "", threat: "amber" },
        // Example of an optional rich visual override. `component` is the
        // string name of a primitive from `src/components/evidenceVisuals/`
        // — currently: "FlowGraph" | "Pie" | "Timeline" | "Comparison" |
        // "Checklist". `props` is forwarded to the primitive (the renderer
        // also injects `threat`). `caption` and `metric` are optional.
        {
          label: "ENTRY LABEL 3",
          value: "",
          threat: "red",
          visual: {
            component: "Pie",
            props: {
              slices: [
                // { label, value, color? }
              ],
              centerLabel: "",
              centerMetric: "",
              radius: 110,
              innerRadius: 56,
            },
            caption: "One- or two-sentence explanation of what the visual is showing.",
            metric: { label: "METRIC", value: "" },
          },
        },
        { label: "ENTRY LABEL 4", value: "", threat: "red" },
        // Image override — use this for faux screenshots / artifacts. Text
        // baked into the image won't translate across locales, so reserve
        // this for diegetic content where the look is the whole point.
        {
          label: "ENTRY LABEL 5",
          value: "",
          threat: "amber",
          visual: {
            component: "Image",
            props: {
              src: "/evidence/case-NNN/entry-label-5.webp",
              alt: "Description of what the screenshot shows (also read by screen readers).",
              fit: "contain", // "contain" | "cover"
            },
            caption: "What the player is looking at and why it matters.",
            metric: { label: "SOURCE", value: "TWITTER" },
          },
        },
      ],
      summary: "",
      // "demon" eats one more char than "monk" — `react_believe` and
      // `react_abstain` truncate to `_belie` / `_absta`.
      verdictReaction: {
        believe: { text: "", audio: "caseNNN_demon_react_belie" },
        abstain: { text: "", audio: "caseNNN_demon_react_absta" },
        doubt:   { text: "", audio: "caseNNN_demon_react_doubt" },
      },
      vindication: {
        aligned:   { text: "", audio: "caseNNN_demon_vind_aligne" },
        missed:    { text: "", audio: "caseNNN_demon_vind_missed" },
        abstained: { text: "", audio: "caseNNN_demon_vind_abstai" },
      },
    },

    // LOGOS — onchain / wallets / liquidity
    // Internal station key stays `marisol` (don't rename — referenced across
    // the scene, EvidenceScreens, EvidenceOverlay, railway, etc.). Players
    // only ever see `character`.
    marisol: {
      character: "Detective Marisol",
      role: "LOGOS · ONCHAIN",
      sigil: "✧",
      tagline: "The chain doesn't lie. Read the receipts.",
      intro: { text: "", audio: "caseNNN_trinity_intro" },
      returnLines: [
        { text: "Thought you might come back.", audio: "trinity_return_1" },
        { text: "What've you got?", audio: "trinity_return_2" },
      ],
      questions: [
        { q: "?", a: { text: "", audio: "caseNNN_trinity_q1" }, reveals: "ENTRY LABEL 1" },
        { q: "?", a: { text: "", audio: "caseNNN_trinity_q2" }, reveals: "ENTRY LABEL 2" },
        { q: "?", a: { text: "", audio: "caseNNN_trinity_q3" }, reveals: "ENTRY LABEL 3" },
        { q: "?", a: { text: "", audio: "caseNNN_trinity_q4" }, reveals: "ENTRY LABEL 4" },
      ],
      entries: [
        { label: "ENTRY LABEL 1", value: "", threat: "amber" },
        { label: "ENTRY LABEL 2", value: "", threat: "green" },
        { label: "ENTRY LABEL 3", value: "", threat: "red" },
        { label: "ENTRY LABEL 4", value: "", threat: "amber" },
        { label: "ENTRY LABEL 5", value: "", threat: "green" },
      ],
      summary: "",
      // "trinity" is 7 chars — drops more letters than monk/demon. All four
      // react/vind multi-syllable slots truncate.
      verdictReaction: {
        believe: { text: "", audio: "caseNNN_trinity_react_bel" },
        abstain: { text: "", audio: "caseNNN_trinity_react_abs" },
        doubt:   { text: "", audio: "caseNNN_trinity_react_dou" },
      },
      vindication: {
        aligned:   { text: "", audio: "caseNNN_trinity_vind_alig" },
        missed:    { text: "", audio: "caseNNN_trinity_vind_miss" },
        abstained: { text: "", audio: "caseNNN_trinity_vind_abst" },
      },
    },

    // MYTHOS — narrative / pitch / whitepaper
    // Eugene is text-only: chat-bubble render with typing chime, no SitePal
    // scene. Lines are plain strings, no audio field.
    eugene: {
      character: "Eugene",
      role: "MYTHOS · NARRATIVE",
      sigil: "❖",
      tagline: "Every rug wears a story. Find the seams.",
      textOnly: true,
      intro: "",
      returnLines: [
        "Back! ✨ Whatcha need?",
        "Hiii again 💫",
      ],
      questions: [
        { q: "?", a: "", reveals: "ENTRY LABEL 1" },
        { q: "?", a: "", reveals: "ENTRY LABEL 2" },
        { q: "?", a: "", reveals: "ENTRY LABEL 3" },
        { q: "?", a: "", reveals: "ENTRY LABEL 4" },
      ],
      entries: [
        { label: "ENTRY LABEL 1", value: "", threat: "green" },
        { label: "ENTRY LABEL 2", value: "", threat: "amber" },
        { label: "ENTRY LABEL 3", value: "", threat: "red" },
        { label: "ENTRY LABEL 4", value: "", threat: "amber" },
        { label: "ENTRY LABEL 5", value: "", threat: "green" },
      ],
      summary: "",
      verdictReaction: {
        believe: "",
        abstain: "",
        doubt:   "",
      },
      vindication: {
        aligned:   "",
        missed:    "",
        abstained: "",
      },
    },
  },

  maxScans: 3,             // total questions the player can spend across all 4 stations
  correctVerdict: "doubt", // "believe" | "doubt" — ground truth for scoring
  // DESIGN RULE: keep the evidence MIXED, not overdetermined. Most entries
  // should read green/amber; concentrate the case-cracking flags in one or two
  // lenses so WHICH 3 questions the player asks actually matters. List those
  // station keys here — the post-game coaching note compares them against the
  // stations the player actually scanned. (e.g. ["marisol"] or ["monk","eugene"])
  decisiveLenses: ["marisol"],

  // Played after the player commits their verdict and the case unmasks.
  reveal: {
    summary: "What actually happened to the project.",
    voices: {
      believe: "Said when player called Believe.",
      abstain: "Said when player called Abstain.",
      doubt:   "Said when player called Doubt.",
    },
  },
};

export default CASE_TEMPLATE;
