#!/usr/bin/env node
// Expand a case SPEC (content only) into a full case-NNN.js with all the
// boilerplate: character identities/roles/sigils/voice configs, the
// `audio: null` + `// re-record:` markers (slot names follow the existing
// convention, truncated to SitePal's 25-char cap), eugene's text-only wiring,
// and maxScans.
//
// Usage:
//   node scripts/gen-case.mjs <spec.js> [outFile.js]
// Example:
//   node scripts/gen-case.mjs src/components/game/cases/specs/case-004.spec.js
//
// Then register the case in cases/index.js and re-run gen-rerecord-manifest.mjs.

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

// Constant character identities (the spec never supplies these).
const CHARS = {
  monk:    { name: "Saint GR80",        role: "ETHOS · CREDIBILITY", sigil: "✠", slot: "monk",    tagline: "Trust nothing the team says about itself. Watch what they've already done.", voice: `{ voice: "9", lang: 1, engine: 1, effect: "T", effLevel: 3 }` },
  demon:   { name: "John Barron",       role: "PATHOS · SENTIMENT",  sigil: "✦", slot: "demon",   tagline: "Sentiment is theater. Strip the script and read the cast.", voice: `{ voice: "2", effect: "T", effLevel: 3 }` },
  marisol: { name: "Detective Trinity", role: "LOGOS · ONCHAIN",     sigil: "✧", slot: "trinity", tagline: "The chain doesn't lie. Read the receipts.", voice: `{ voice: "3", lang: 1, engine: 3, effect: "T", effLevel: 3 }` /* "Kate" + reverb (Time fx) */ },
  eugene:  { name: "Eugene",            role: "MYTHOS · NARRATIVE",  sigil: "❖", slot: "eugene",   tagline: "Every rug wears a story. Find the seams.", textOnly: true },
};
const STATION_ORDER = ["monk", "demon", "marisol", "eugene"];
const VALID_THREAT = new Set(["green", "amber", "red"]);
const J = (s) => JSON.stringify(s ?? "");

function fail(msg) { console.error("✗ " + msg); process.exitCode = 1; throw new Error(msg); }

function validate(spec) {
  const errs = [];
  if (!spec.id || !/^case-\d+$/.test(spec.id)) errs.push(`id must look like "case-004" (got ${spec.id})`);
  if (!["believe", "doubt"].includes(spec.correctVerdict)) errs.push(`correctVerdict must be "believe" or "doubt"`);
  if (!Array.isArray(spec.decisiveLenses) || spec.decisiveLenses.length === 0 ||
      !spec.decisiveLenses.every((l) => STATION_ORDER.includes(l)))
    errs.push(`decisiveLenses must be a non-empty subset of ${JSON.stringify(STATION_ORDER)}`);
  if (!spec.reveal?.summary || !spec.reveal?.voices) errs.push(`reveal.summary and reveal.voices required`);
  for (const key of STATION_ORDER) {
    const st = spec.stations?.[key];
    if (!st) { errs.push(`missing station "${key}"`); continue; }
    if (!Array.isArray(st.entries) || st.entries.length !== 5) errs.push(`${key}: need exactly 5 entries`);
    if (!Array.isArray(st.questions) || st.questions.length !== 4) errs.push(`${key}: need exactly 4 questions`);
    const labels = new Set((st.entries || []).map((e) => e.label));
    (st.entries || []).forEach((e, i) => { if (!VALID_THREAT.has(e.threat)) errs.push(`${key}.entries[${i}].threat invalid: ${e.threat}`); });
    (st.questions || []).forEach((q, i) => { if (!labels.has(q.reveals)) errs.push(`${key}.questions[${i}].reveals "${q.reveals}" matches no entry label`); });
    for (const f of ["intro", "summary", "returnLines", "verdictReaction", "vindication"])
      if (st[f] == null) errs.push(`${key}: missing "${f}"`);
  }
  if (errs.length) { errs.forEach((e) => console.error("  ✗ " + e)); fail(`${errs.length} spec error(s)`); }
}

function emit(spec) {
  const num = spec.id.match(/(\d+)/)[1];
  const slot = (charSlot, key) => `case${num}_${charSlot}_${key}`.slice(0, 25); // SitePal 25-char cap
  const CONST = spec.id.replace(/-/g, "_").toUpperCase(); // case-004 -> CASE_004

  const entriesBlock = (st) => st.entries.map((e) =>
    `        { label: ${J(e.label)}, value: ${J(e.value)}, threat: ${J(e.threat)} },`).join("\n");

  const voicedStation = (key) => {
    const c = CHARS[key]; const st = spec.stations[key];
    const rl = st.returnLines.map((r, i) =>
      `        { text: ${J(r)}, audio: null }, // re-record: ${slot(c.slot, `return_${i + 1}`)}`).join("\n");
    const qs = st.questions.map((q, i) =>
`        {
          q: ${J(q.q)},
          a: {
            text: ${J(q.a)},
            audio: null, // re-record: ${slot(c.slot, `q${i + 1}`)}
          },
          reveals: ${J(q.reveals)},
        },`).join("\n");
    const react = (k) => `        ${k}: { text: ${J(st.verdictReaction[k])}, audio: null }, // re-record: ${slot(c.slot, `react_${k}`)}`;
    const vind = (k) => `        ${k}: { text: ${J(st.vindication[k])}, audio: null }, // re-record: ${slot(c.slot, `vind_${k}`)}`;
    return `    ${key}: {
      character: ${J(c.name)},
      role: ${J(c.role)},
      sigil: ${J(c.sigil)},
      tagline: ${J(c.tagline)},
      voice: ${c.voice},
      intro: {
        text: ${J(st.intro)},
        audio: null, // re-record: ${slot(c.slot, "intro")}
      },
      returnLines: [
${rl}
      ],
      questions: [
${qs}
      ],
      entries: [
${entriesBlock(st)}
      ],
      summary: ${J(st.summary)},
      verdictReaction: {
${react("believe")}
${react("abstain")}
${react("doubt")}
      },
      vindication: {
${vind("aligned")}
${vind("missed")}
${vind("abstained")}
      },
    },`;
  };

  const eugeneStation = () => {
    const c = CHARS.eugene; const st = spec.stations.eugene;
    const qs = st.questions.map((q) =>
      `        { q: ${J(q.q)}, a: ${J(q.a)}, reveals: ${J(q.reveals)} },`).join("\n");
    return `    eugene: {
      character: ${J(c.name)},
      role: ${J(c.role)},
      sigil: ${J(c.sigil)},
      tagline: ${J(c.tagline)},
      textOnly: true,
      intro: ${J(st.intro)},
      returnLines: [${st.returnLines.map(J).join(", ")}],
      questions: [
${qs}
      ],
      entries: [
${entriesBlock(st)}
      ],
      summary: ${J(st.summary)},
      verdictReaction: { believe: ${J(st.verdictReaction.believe)}, abstain: ${J(st.verdictReaction.abstain)}, doubt: ${J(st.verdictReaction.doubt)} },
      vindication: { aligned: ${J(st.vindication.aligned)}, missed: ${J(st.vindication.missed)}, abstained: ${J(st.vindication.abstained)} },
    },`;
  };

  const sm = spec.surfaceMetrics;
  const rulesIntro = spec.rulesIntro
    ? `  rulesIntro: {\n    text: ${J(spec.rulesIntro)},\n    audio: null, // re-record: ${slot("monk", "rules")}\n  },\n`
    : "";

  return `// Generated from ${spec.id}.spec.js by scripts/gen-case.mjs — edit the spec and regenerate.
const ${CONST} = {
  id: ${J(spec.id)},
  difficulty: ${J(spec.difficulty || "intermediate")},
  projectName: ${J(spec.projectName)},
  ticker: ${J(spec.ticker)},
  chain: ${J(spec.chain || "Base")},
  tagline: ${J(spec.tagline)},
  surfaceMetrics: {
    age: ${J(sm.age)},
    mcap: ${J(sm.mcap)},
    holders: ${J(sm.holders)},
    price: ${J(sm.price)},
    change24h: ${J(sm.change24h)},
    socialScore: ${J(sm.socialScore)},
  },
${rulesIntro}  stations: {
${voicedStation("monk")}
${voicedStation("demon")}
${voicedStation("marisol")}
${eugeneStation()}
  },

  maxScans: 3,
  correctVerdict: ${J(spec.correctVerdict)},
  decisiveLenses: ${JSON.stringify(spec.decisiveLenses)},

  reveal: {
    summary: ${J(spec.reveal.summary)},
    voices: {
      believe: ${J(spec.reveal.voices.believe)},
      abstain: ${J(spec.reveal.voices.abstain)},
      doubt: ${J(spec.reveal.voices.doubt)},
    },
  },
};

export default ${CONST};
`;
}

async function main() {
  const specArg = process.argv[2];
  if (!specArg) fail("usage: node scripts/gen-case.mjs <spec.js> [outFile.js]");
  const specPath = path.resolve(process.cwd(), specArg);
  const spec = (await import(pathToFileURL(specPath).href)).default;
  validate(spec);
  const out = process.argv[3] || path.resolve(process.cwd(), `src/components/game/cases/${spec.id}.js`);
  fs.writeFileSync(out, emit(spec));
  console.log(`✓ wrote ${path.relative(process.cwd(), out)} from ${specArg}`);
  console.log(`  Next: add it to cases/index.js, then run node scripts/gen-rerecord-manifest.mjs`);
}
main().catch(() => process.exit(1));
