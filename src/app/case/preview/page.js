'use client';
import { useEffect, useState } from 'react';
import CaseFileScene from '@/components/CaseFile/CaseFileScene';

// /case/preview — D1 developer-facing preview of the folder open
// animation. Not linked from the production nav; reachable directly
// via URL. Lives outside the D5 [caseNumber] route so it works before
// Firestore/case-number infra exists.
//
// Query params:
//   ?reduced=1  — force prefers-reduced-motion path
//   ?skip=1     — skip animation entirely (revisit path per §10)
//   ?replay=1   — replay button shown (default true on this page)

const PLACEHOLDER_CASE = {
  caseNumber: '4-572-RL80',
  token: {
    ticker: 'RL80',
    address: '0x9DD264CE36687f2763285ac30E74530D5B0b6f2b',
    chain: 'base',
    logoUrl: null,
  },
  verdict: 'WANTED',
  // §7 schema + characterId for portrait/role lookup. Quotes are in
  // each character's voice per CHARACTER_PROMPTS so the dossier reads
  // like the four really filed a report.
  investigators: [
    {
      characterId: 'monk',
      quote: 'The deployer wallet is six days old. New wallet, old habits.',
      confidence: 78,
    },
    {
      characterId: 'demon',
      quote: 'Loud where it should be quiet. Cheaply. Loudly. Badly.',
      confidence: 64,
    },
    {
      characterId: 'marisol',
      quote: 'Top wallet holds 41% across 312 holders. Read the receipts.',
      confidence: 86,
    },
    {
      characterId: 'eugene',
      quote: 'I have seen this pitch five times this month. Three are zero.',
      confidence: 71,
    },
  ],
  timestamp: '2026-05-25T18:30:00Z',
  supplicantWallet: null,
  isHolderOfRL80: false,
};

export default function CaseFilePreviewPage() {
  const [skip, setSkip] = useState(false);
  const [entrance, setEntrance] = useState('slide');
  const [mountKey, setMountKey] = useState(0);

  // Read URL flags after mount (client-only) so SSR and hydration agree.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.has('skip')) setSkip(true);
    const mode = params.get('mode');
    if (mode === 'drop' || mode === 'slide') setEntrance(mode);
  }, []);

  const replay = (nextEntrance) => {
    if (nextEntrance) setEntrance(nextEntrance);
    setSkip(false);
    setMountKey((k) => k + 1);
  };

  return (
    <main style={pageStyles.root}>
      <div style={pageStyles.controls}>
        <button
          type="button"
          onClick={() => replay('slide')}
          style={{ ...pageStyles.button, ...(entrance === 'slide' ? pageStyles.buttonActive : null) }}
        >
          ▸ SLIDE
        </button>
        <button
          type="button"
          onClick={() => replay('drop')}
          style={{ ...pageStyles.button, ...(entrance === 'drop' ? pageStyles.buttonActive : null) }}
        >
          ▸ DROP
        </button>
        <button type="button" onClick={() => replay()} style={pageStyles.button}>
          ▸ REPLAY
        </button>
      </div>
      <CaseFileScene
        key={mountKey}
        caseData={PLACEHOLDER_CASE}
        skipAnimation={skip}
        entrance={entrance}
      />
    </main>
  );
}

const pageStyles = {
  root: {
    minHeight: '100vh',
    // Cathedral/Terminal pages render against a near-black backdrop;
    // the manila reads well against deep indigo, which also matches the
    // synth-sunset/cathedral palette without introducing a new token.
    background: 'radial-gradient(ellipse at 50% 30%, #1a0d2e 0%, #0a0612 70%)',
    position: 'relative',
  },
  controls: {
    position: 'fixed',
    top: 16,
    right: 16,
    zIndex: 10,
    display: 'flex',
    gap: 8,
  },
  button: {
    padding: '8px 14px',
    background: 'rgba(13,50,80,0.4)',
    border: '1px solid rgba(142,233,255,0.45)',
    color: '#8ee9ff',
    fontFamily: "'Orbitron', monospace",
    fontSize: 11,
    letterSpacing: '0.2em',
    cursor: 'pointer',
    borderRadius: 4,
  },
  buttonActive: {
    background: 'rgba(13,80,50,0.45)',
    border: '1px solid rgba(77,255,170,0.85)',
    color: '#8effc4',
    boxShadow: '0 0 12px rgba(77,255,170,0.35)',
  },
};
