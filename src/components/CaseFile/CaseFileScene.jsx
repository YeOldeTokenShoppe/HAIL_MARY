'use client';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import FolderShell, { FOLDER_OPEN_TOTAL_MS } from './FolderShell';

// Orchestrates the case-file experience. Two entrance variants today:
//
//   'slide' (default): the investigation reveal — folder tumbles in
//     from the right, flap opens, dossier visible. D3 slams the
//     verdict stamp onto the open dossier.
//
//   'drop': the summary moment — folder falls onto the scene with a
//     thud, flap stays CLOSED, and a verdict stamp slams onto the
//     cover. Used by share previews and the OG image moment.
//
// `caseData` is the §7 shape but tolerated as partial in D1 so the
// preview route can render without a populated record.
export default function CaseFileScene({
  caseData,
  skipAnimation = false,
  entrance = 'slide',
}) {
  // Drop-mode lifecycle:
  //   landed   — folder has come to rest; stamp slams onto the cover
  //   expanded — user clicked the cover; flap is now open, stamp fades
  const [landed, setLanded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={sceneStyles.wrap}>
      <FolderShell
        skipAnimation={skipAnimation}
        entrance={entrance}
        onOpened={() => setLanded(true)}
        onExpand={() => setExpanded(true)}
      >
        <PlaceholderDossier
          caseData={caseData}
          opened={entrance === 'drop' ? expanded : landed}
        />
      </FolderShell>
      {entrance === 'drop' && landed && (
        <PlaceholderStamp caseData={caseData} exiting={expanded} />
      )}
    </div>
  );
}

// ── Placeholder stamp (D3 will replace this) ───────────────────────
// Slams onto the folder cover with scale 1.4 → 1.0 + a brief shake.
// Positioned absolutely over the folder so it overlays the closed
// cover. The full 10-variant stamp art and grunge texture is D3 work;
// this is choreography only.
function PlaceholderStamp({ caseData, exiting = false }) {
  const ref = useRef(null);
  const verdict = (caseData?.verdict || 'WANTED').replace(/_/g, ' ');

  // Entry: §10 stamp slam — 150ms scale-down ease-in. Runs once on
  // mount. Screen shake belongs to the full D3 stamp; choreography only.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    gsap.set(el, { scale: 1.4, opacity: 0 });
    const tween = gsap.to(el, {
      scale: 1,
      opacity: 1,
      duration: 0.15,
      ease: 'power3.in',
    });
    return () => tween.kill();
  }, []);

  // Exit: fades to nothing as the flap begins to rotate so the stamp
  // doesn't linger on top of the dossier once the cover sweeps away.
  // 250ms total, ending well before the 600ms flap rotation completes.
  useEffect(() => {
    if (!exiting) return;
    const el = ref.current;
    if (!el) return;
    const tween = gsap.to(el, {
      opacity: 0,
      scale: 0.92,
      duration: 0.25,
      ease: 'power2.out',
    });
    return () => tween.kill();
  }, [exiting]);

  return (
    <div style={stampStyles.overlay} aria-hidden>
      <div ref={ref} style={stampStyles.stamp}>
        <div style={stampStyles.text}>{verdict}</div>
      </div>
    </div>
  );
}

// Placeholder dossier for slide mode (existing D1 content).
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

const sceneStyles = {
  wrap: { position: 'relative', minHeight: '100vh' },
};

const stampStyles = {
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 5,
  },
  stamp: {
    padding: '14px 36px',
    border: '5px solid #b8141a',
    borderRadius: 4,
    background: 'rgba(184,20,26,0.06)',
    transform: 'rotate(-6deg)',
    boxShadow: '0 0 0 1px rgba(184,20,26,0.4), 0 6px 18px rgba(0,0,0,0.35)',
  },
  text: {
    fontFamily: "'UnifrakturCook', 'Special Elite', serif",
    fontSize: 'clamp(36px, 7vw, 64px)',
    fontWeight: 900,
    color: '#b8141a',
    letterSpacing: '0.08em',
    textShadow: '1px 1px 0 rgba(0,0,0,0.15)',
    lineHeight: 1,
  },
};

const ph = {
  root: { display: 'flex', flexDirection: 'column', gap: 16, height: '100%', minHeight: 0 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  headerLeft: { display: 'flex', flexDirection: 'column', gap: 4 },
  headerRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
  kicker: { fontSize: 10, letterSpacing: '0.18em', color: '#8a6f3f' },
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
  subtle: { fontSize: 10, color: '#8a6f3f', letterSpacing: '0.1em' },
  divider: { height: 1, background: 'repeating-linear-gradient(to right, #8a6f3f 0 4px, transparent 4px 8px)' },
  body: { display: 'flex', flexDirection: 'column', gap: 8 },
  bodyKicker: { fontSize: 10, letterSpacing: '0.18em', color: '#8a6f3f' },
  bodyText: { fontSize: 13, lineHeight: 1.55, color: '#2a2520', margin: 0 },
  list: { margin: '4px 0 0 0', paddingLeft: 18, fontSize: 12, color: '#3a3128', lineHeight: 1.5 },
  stampSlot: {
    border: '1px dashed #8a6f3f',
    borderRadius: 4,
    minHeight: 120,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
  },
  stampStub: { fontSize: 11, letterSpacing: '0.24em', color: '#8a6f3f' },
  footer: { display: 'flex', justifyContent: 'space-between', fontSize: 10, letterSpacing: '0.2em', color: '#8a6f3f' },
  footerCenter: { letterSpacing: '0.3em' },
};

export { FOLDER_OPEN_TOTAL_MS };
