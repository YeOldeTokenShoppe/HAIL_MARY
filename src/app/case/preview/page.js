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
  investigators: [],
  timestamp: new Date().toISOString(),
  supplicantWallet: null,
  isHolderOfRL80: false,
};

export default function CaseFilePreviewPage() {
  const [skip, setSkip] = useState(false);
  const [mountKey, setMountKey] = useState(0);

  // Read URL flags after mount (client-only) so SSR and hydration agree.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.has('skip')) setSkip(true);
  }, []);

  return (
    <main style={pageStyles.root}>
      {/* Dev-only replay control — easier than reloading. Hidden in print. */}
      <button
        type="button"
        onClick={() => { setSkip(false); setMountKey((k) => k + 1); }}
        style={pageStyles.replay}
      >
        ▸ REPLAY
      </button>
      <CaseFileScene key={mountKey} caseData={PLACEHOLDER_CASE} skipAnimation={skip} />
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
  replay: {
    position: 'fixed',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: '8px 14px',
    background: 'rgba(13,50,80,0.4)',
    border: '1px solid rgba(142,233,255,0.6)',
    color: '#8ee9ff',
    fontFamily: "'Orbitron', monospace",
    fontSize: 11,
    letterSpacing: '0.2em',
    cursor: 'pointer',
    borderRadius: 4,
  },
};
