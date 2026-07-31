// generateReviewCase — runtime builder for the /trade Token Review service.
// Returns a case-file-shaped object that the existing game machinery
// (UnifiedShrine state, EvidenceScreens painter, vindication ribbon, etc.)
// can consume the same way it consumes the hand-authored case-001/002/003
// files.
//
// At this stage the inquiries are STUBS — placeholder questions + entries
// that prove the shape works end-to-end. Real generation lands in later
// steps:
//
//   1. (this) funnel + case-shape plumbing  ← we're here
//   2. wire Marisol (marisol) station to real CDP onchain data
//   3. add x402 paywall in front of the "begin" button
//   4. add LLM generation for monk/demon/eugene
//
// Inputs come from the funnel's resolved-token card:
//   chainId — numeric chain id (Base = 8453)
//   address — 0x-prefixed contract address
//   name    — ERC-20 name() result
//   symbol  — ERC-20 symbol() result
//
// The returned object's `id` namespaces it as `review:<chainId>:<address>`
// so case-001/002/003 ids never collide and a future cache layer can
// key on it directly.

const CHAIN_LABEL = {
  1: 'Ethereum',
  8453: 'Base',
  42161: 'Arbitrum',
  10: 'Optimism',
  137: 'Polygon',
  56: 'BNB Chain',
  43114: 'Avalanche',
  59144: 'Linea',
  81457: 'Blast',
  7777777: 'Zora',
};

// Default SitePal voice configs per station. Engine 3 is the default
// neural family; voice IDs are placeholders the operator can tune in
// their SitePal account. monk's config mirrors case-001.js (Acapela
// engine 7 / UK English male). Eugene stays voice-less because she's
// rendered through the on-screen bubble path, not SitePal TTS.
const DEFAULT_STATION_VOICE = {
  monk:    { voice: '9', lang: 1, engine: 7 },
  demon:   { voice: '2', lang: 1, engine: 3 },
  marisol: { voice: '1', lang: 1, engine: 3 },
  eugene:  undefined,
};

// Coerce an LLM-supplied verdictReaction or vindication block down to
// the {text, audio} shape the runtime expects. Audio is always null for
// reviews (no recordings exist for dynamic content).
function asLine(text) {
  if (!text || typeof text !== 'string') return null;
  return { text, audio: null };
}

function shortAddr(addr) {
  if (!addr || typeof addr !== 'string') return '???';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function ageFromDeployedAt(deployedAt) {
  if (!deployedAt) return null;
  const then = new Date(deployedAt).getTime();
  if (Number.isNaN(then)) return null;
  const elapsedMs = Date.now() - then;
  if (elapsedMs < 0) return 'just deployed';
  const days = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  if (days < 1) {
    const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
    return `${hours}h old`;
  }
  if (days < 60) return `${days}d old`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months}mo old`;
  const years = Math.floor(days / 365);
  return `${years}y old`;
}

// Concentration → threat tier. Mirrors the case-001 heuristics: top-10
// owning >80% reads as a red flag, 50-80% amber, under 30% green.
function concentrationThreat(bps) {
  if (bps == null) return 'amber';
  if (bps >= 8000) return 'red';
  if (bps >= 5000) return 'amber';
  if (bps >= 3000) return 'amber';
  return 'green';
}

function buildMarisolFromOnchain({ ticker, address, onchain }) {
  const tickerLabel = ticker ? `$${ticker}` : 'this token';
  const deployer = onchain?.deployer?.address || null;
  const deployedAt = onchain?.deployer?.deployedAt || null;
  const age = ageFromDeployedAt(deployedAt);
  const top10ShareBps = onchain?.top10ShareBps ?? null;
  const top10SharePct = top10ShareBps == null ? null : (top10ShareBps / 100).toFixed(1);
  const concentrationTier = concentrationThreat(top10ShareBps);
  const topHolder = onchain?.topHolders?.[0] || null;

  const questions = [];
  const entries = [];

  if (deployer) {
    questions.push({
      q: 'Who deployed this and when?',
      a: {
        text:
          age
            ? `The deployer is ${shortAddr(deployer)}. The contract is ${age}. ` +
              `New does not mean bad, but new is when the patterns are easiest to read.`
            : `The deployer is ${shortAddr(deployer)}. Note it. We will trace it.`,
        audio: null,
      },
      reveals: 'DEPLOYER',
    });
    entries.push({
      label: 'DEPLOYER',
      value: `${shortAddr(deployer)}${age ? ` · ${age}` : ''}`,
      threat: 'amber',
    });
  }

  if (top10ShareBps != null) {
    const threat = concentrationTier;
    const flavor =
      threat === 'red'
        ? 'When the top ten own this much, the float is a costume. Anyone in that ring can move the price by yawning.'
        : threat === 'amber'
        ? 'Concentration is uncomfortable but not unusual. Watch what those wallets do, not what they say.'
        : 'Distribution looks healthy. Plenty of hands at this table.';
    questions.push({
      q: 'How concentrated is the holder base?',
      a: {
        text: `Top ten wallets hold ${top10SharePct}% of supply. ${flavor}`,
        audio: null,
      },
      reveals: 'TOP-10 CONCENTRATION',
    });
    entries.push({
      label: 'TOP-10 CONCENTRATION',
      value: `${top10SharePct}% of supply held by top 10 wallets`,
      threat,
    });
  }

  if (topHolder) {
    questions.push({
      q: "Who's the biggest holder?",
      a: {
        text: `One wallet — ${shortAddr(topHolder.address)} — sits on top. Could be the LP. Could be the founder. Look it up before you trust the rest.`,
        audio: null,
      },
      reveals: 'TOP HOLDER',
    });
    entries.push({
      label: 'TOP HOLDER',
      value: shortAddr(topHolder.address),
      threat: 'amber',
    });
  }

  // If onchain returned but yielded no usable data (e.g. token has no
  // Transfer history yet — fresh deploy with zero activity), fall back
  // to a single explanatory question so the station isn't empty.
  if (questions.length === 0) {
    questions.push({
      q: 'What does the chain say?',
      a: {
        text: `${tickerLabel} at ${shortAddr(address)} has no usable Transfer history yet. Either freshly deployed, or the indexer has not caught up.`,
        audio: null,
      },
      reveals: 'NO ACTIVITY',
    });
    entries.push({
      label: 'NO ACTIVITY',
      value: 'No Transfer events indexed for this token yet',
      threat: 'amber',
    });
  }

  return { questions, entries };
}

// Build a single station's stub. Each character keeps their character
// name + role + tagline + sigil from the case-001 baseline so the
// railway, vindication ribbon, and EvidenceOverlay header all render
// correctly. The audio fields stay null because there are no recordings
// for dynamic content yet — the runtime falls back to SitePal TTS via
// the per-station `voice` config.
// Merge an LLM character payload onto the station's baseline. Falls
// back to the placeholder block when the field is missing so a partial
// LLM failure still produces a playable case.
function applyCharacterPayload(base, payload) {
  if (!payload) return base;
  const next = { ...base };
  if (payload.intro) next.intro = { text: payload.intro, audio: null };
  if (Array.isArray(payload.questions) && payload.questions.length > 0) {
    next.questions = payload.questions.map((q) => ({
      q: q.q,
      a: { text: q.a, audio: null },
      reveals: q.reveals,
    }));
  }
  if (Array.isArray(payload.entries) && payload.entries.length > 0) {
    next.entries = payload.entries.map((e) => ({
      label: e.label,
      value: e.value,
      threat: ['red', 'amber', 'green'].includes(e.threat) ? e.threat : 'amber',
    }));
  }
  if (payload.summary) next.summary = payload.summary;
  // Stash the character's own verdict on the station so the verdict
  // screen / consensus meter can find it without round-tripping through
  // caseData.consensus. DORMANT is treated as a first-class verdict
  // here — separate from ABSTAIN — because the framing on the verdict
  // screen depends on it.
  if (['believe', 'doubt', 'abstain', 'dormant'].includes(payload.verdict)) {
    next.characterVerdict = payload.verdict;
  }
  return next;
}

function buildStation({ character, role, sigil, tagline, voice, ticker, name, address }) {
  const tickerLabel = ticker ? `$${ticker}` : 'this token';
  const projectLabel = name || 'this project';
  return {
    character,
    role,
    sigil,
    tagline,
    voice,
    intro: {
      text: `Looking at ${projectLabel} — ${tickerLabel}. Ask me what I see.`,
      audio: null,
    },
    returnLines: [
      'Back for more?',
      'What else do you want to know?',
    ],
    questions: [
      {
        q: 'What can you tell me about this token?',
        a: {
          text: `Pending: my read on ${tickerLabel} will land here once the live analysis is wired up.`,
          audio: null,
        },
        reveals: 'PLACEHOLDER',
      },
    ],
    entries: [
      {
        label: 'PLACEHOLDER',
        value: `Stub entry for ${tickerLabel} at ${address?.slice(0, 6)}…${address?.slice(-4)}`,
        threat: 'amber',
      },
    ],
    summary: `Placeholder summary for ${tickerLabel}.`,
    // Tier-2 slot (CASE_TABLE.md §3.3) — reviews ship none today; richer
    // CDP pulls that don't fit Marisol's Tier-1 cards are the follow-up.
    deepEntries: [],
    verdictReaction: {
      believe: { text: 'Noted.',   audio: null },
      abstain: { text: 'Wise.',    audio: null },
      doubt:   { text: 'Careful.', audio: null },
    },
    vindication: {
      aligned:   { text: 'Read it well.',                   audio: null },
      missed:    { text: 'Live and learn.',                 audio: null },
      abstained: { text: 'Sometimes the right call is no.', audio: null },
    },
  };
}

export default function generateReviewCase({
  chainId,
  address,
  name,
  symbol,
  onchain = null,
  // Output of /api/review/characters — when present, each station's
  // intro/questions/entries/summary/verdict come from Claude. When
  // absent, the case falls back to either onchain-derived (Marisol)
  // or the buildStation placeholder copy (everyone else).
  characters = null,
}) {
  const ticker = (symbol || '').replace(/^\$/, '');
  const tickerLabel = ticker ? `$${ticker}` : 'TOKEN';
  const projectName = name || 'UNKNOWN TOKEN';
  const chainLabel = CHAIN_LABEL[chainId] || `Chain ${chainId}`;
  const marisolReal = onchain ? buildMarisolFromOnchain({ ticker, address, onchain }) : null;
  const charactersPayload = characters?.characters || characters || null;

  return {
    id: `review:${chainId}:${address?.toLowerCase()}`,
    difficulty: 'review',
    projectName: projectName.toUpperCase(),
    ticker: tickerLabel,
    chain: chainLabel,
    // Surface metrics fill in from real data once the data layer lands.
    // Empty values keep the HUD strip honest until then.
    surfaceMetrics: {
      age: '—',
      mcap: '—',
      holders: '—',
      price: '—',
      change24h: '—',
      socialScore: '—',
    },
    // No rules speech for reviews — players who reached this service have
    // already seen the rules in case-001.

    stations: {
      monk: applyCharacterPayload(
        buildStation({
          character: 'Saint GR80',
          role: 'ETHOS · CREDIBILITY',
          sigil: '✠',
          tagline: 'Trust nothing the team says about itself. Watch what they have already done.',
          voice: DEFAULT_STATION_VOICE.monk,
          ticker, name: projectName, address,
        }),
        charactersPayload?.monk,
      ),
      demon: applyCharacterPayload(
        buildStation({
          character: 'Connor',
          role: 'PATHOS · HYPE',
          sigil: '◬',
          tagline: 'The story is loud. Loud means cheap.',
          voice: DEFAULT_STATION_VOICE.demon,
          ticker, name: projectName, address,
        }),
        charactersPayload?.demon,
      ),
      marisol: (() => {
        const base = buildStation({
          character: 'Detective Marisol',
          role: 'LOGOS · ONCHAIN',
          sigil: '✧',
          tagline: 'The chain does not lie. Read the receipts.',
          voice: DEFAULT_STATION_VOICE.marisol,
          ticker, name: projectName, address,
        });
        // Layer order matters. Onchain data first (gives Marisol real
        // numbers even on a partial LLM failure); LLM payload last so
        // when Claude is up, her voice takes precedence — her LLM call
        // already saw the same onchain data via the user message.
        let next = base;
        if (marisolReal) {
          next = {
            ...next,
            intro: {
              text: `${tickerLabel} on ${chainLabel}. I have the wallets pulled up. Ask me what you want to see.`,
              audio: null,
            },
            questions: marisolReal.questions,
            entries: marisolReal.entries,
            summary: 'Onchain readout compiled from indexed Transfer events.',
          };
        }
        return applyCharacterPayload(next, charactersPayload?.marisol);
      })(),
      eugene: applyCharacterPayload(
        buildStation({
          character: 'Eugene',
          role: 'MYTHOS · STORY',
          sigil: '⟁',
          tagline: 'Every coin is a myth. Some myths sell tickets.',
          voice: DEFAULT_STATION_VOICE.eugene,
          ticker, name: projectName, address,
        }),
        charactersPayload?.eugene,
      ),
    },

    maxScans: 3,
    // No ground-truth verdict for live reviews — there is no "right
    // answer" against a real token. The verdict screen treats every
    // outcome as `abstained` (no aligned/missed split). The reveal copy
    // softens accordingly.
    correctVerdict: null,
    // No ground truth → no decisive-lens coaching for reviews.
    decisiveLenses: [],
    // No authored cross-lens payoffs for dynamic reviews (§3.3).
    connections: [],
    reveal: {
      summary: `Review compiled for ${tickerLabel} on ${chainLabel}. This is your team's read — not financial advice.`,
      voices: {
        believe: 'You see something promising. Size accordingly.',
        abstain: 'No call is a call. Keep watching.',
        doubt:   'The signal is loud enough to pass.',
      },
    },

    // Team consensus — populated when the /api/review/characters call
    // returned. Drives the share-worthy "3 of 4 say DOUBT" card on the
    // verdict screen (rendering lands in a follow-up pass).
    consensus: characters?.consensus || null,

    // Provenance — useful for cache keys, audit, and future telemetry.
    review: {
      chainId,
      address,
      generatedAt: Date.now(),
      onchain: onchain || null,
      llmModel: characters?.model || null,
    },
  };
}
