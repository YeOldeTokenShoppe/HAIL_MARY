'use client';
import { useState } from 'react';
import FolderShell, { FOLDER_OPEN_TOTAL_MS } from './FolderShell';

// Orchestrates the case-file experience: folder open animation, dossier
// render, stamp slam (D3), share bar (D7). D1 only wires the folder
// shell + placeholder inner content; later deliverables fill the slots.
//
// `caseData` is the §7 shape but tolerated as partial in D1 so the
// preview route can render without a populated record.
export default function CaseFileScene({ caseData, skipAnimation = false }) {
  // Drives downstream beats (D3 stamp slam, D7 share buttons). D1 only
  // observes it for the placeholder "DOSSIER OPEN" stub.
  const [opened, setOpened] = useState(false);

  return (
    <FolderShell skipAnimation={skipAnimation} onOpened={() => setOpened(true)}>
      <PlaceholderDossier caseData={caseData} opened={opened} />
    </FolderShell>
  );
}

// Placeholder inner content for D1. D2 replaces this with the real
// DossierPage (logo, ticker, address, badges, investigator rows, stamp
// slot). Keep this skeletal — just enough that the folder-open animation
// has something to reveal during review.
function PlaceholderDossier({ caseData, opened }) {
  const ticker = caseData?.token?.ticker || 'PLACEHOLDER';
  const caseNumber = caseData?.caseNumber || '0-000-PLACEHOLDER';
  return (
    <div style={ph.root}>
      <div style={ph.header}>
        <div style={ph.headerLeft}>
          <div style={ph.kicker}>// LIMINAL TERMINAL — FORENSIC FILE</div>
          <div style={ph.title}>CASE {caseNumber}</div>
        </div>
        <div style={ph.headerRight}>
          <div style={ph.ticker}>${ticker}</div>
          <div style={ph.subtle}>D2 fills this header</div>
        </div>
      </div>

      <div style={ph.divider} />

      <div style={ph.body}>
        <div style={ph.bodyKicker}>// EVIDENCE PENDING</div>
        <p style={ph.bodyText}>
          Four investigators have convened. Their reports will appear here in D2 —
          name, one-line in-voice quote, confidence stamp. For D1 this surface
          is a placeholder; what matters is that the folder slid in, paused,
          and the front cover opened to reveal this inner page.
        </p>
        <ul style={ph.list}>
          <li>Slide-in: 350ms · ease-out</li>
          <li>Pause: 200ms</li>
          <li>Flap: 600ms · overshoot bounce</li>
          <li>Inner fade: 300ms · ease-out</li>
        </ul>
      </div>

      <div style={ph.stampSlot} aria-label="stamp slot (D3 lands here)">
        <div style={ph.stampStub}>{opened ? 'STAMP SLOT' : '—'}</div>
      </div>

      <div style={ph.footer}>
        <span>EXHIBIT A</span>
        <span style={ph.footerCenter}>OUR LADY OF PERPETUAL PROFIT</span>
        <span>FILED {new Date().toISOString().slice(0, 10)}</span>
      </div>
    </div>
  );
}

// Inner content is dossier-paper styled, not folder-styled. Keep the
// styling here minimal and isolated; D2 will own the real visual.
const ph = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    height: '100%',
    minHeight: 0,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: 4 },
  headerRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
  kicker: {
    fontSize: 10,
    letterSpacing: '0.18em',
    color: '#8a6f3f',
  },
  title: {
    fontFamily: "'Pirata One', 'Special Elite', serif",
    fontSize: 'clamp(22px, 4vw, 30px)',
    color: '#2a2520',
    letterSpacing: '0.04em',
  },
  ticker: {
    fontFamily: "'Pirata One', 'Special Elite', serif",
    fontSize: 'clamp(22px, 4vw, 30px)',
    color: '#8a1c1c',
  },
  subtle: {
    fontSize: 10,
    color: '#8a6f3f',
    letterSpacing: '0.1em',
  },
  divider: {
    height: 1,
    background: 'repeating-linear-gradient(to right, #8a6f3f 0 4px, transparent 4px 8px)',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  bodyKicker: {
    fontSize: 10,
    letterSpacing: '0.18em',
    color: '#8a6f3f',
  },
  bodyText: {
    fontSize: 13,
    lineHeight: 1.55,
    color: '#2a2520',
    margin: 0,
  },
  list: {
    margin: '4px 0 0 0',
    paddingLeft: 18,
    fontSize: 12,
    color: '#3a3128',
    lineHeight: 1.5,
  },
  stampSlot: {
    border: '1px dashed #8a6f3f',
    borderRadius: 4,
    minHeight: 120,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
  },
  stampStub: {
    fontSize: 11,
    letterSpacing: '0.24em',
    color: '#8a6f3f',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 10,
    letterSpacing: '0.2em',
    color: '#8a6f3f',
  },
  footerCenter: { letterSpacing: '0.3em' },
};

export { FOLDER_OPEN_TOTAL_MS };
