'use client';
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import FolderShell, { FOLDER_OPEN_TOTAL_MS } from './FolderShell';
import DossierPage from './DossierPage';

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
// `caseData` is the §7 shape but tolerated as partial so the preview
// route can render without a populated record.
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

  // The dossier "is open" when:
  //   slide entrance: the flap-open completed (landed === true)
  //   drop  entrance: the user clicked the cover (expanded === true)
  const dossierOpen = entrance === 'drop' ? expanded : landed;

  return (
    <div style={sceneStyles.wrap}>
      <FolderShell
        skipAnimation={skipAnimation}
        entrance={entrance}
        onOpened={() => setLanded(true)}
        onExpand={() => setExpanded(true)}
      >
        <DossierPage caseData={caseData} opened={dossierOpen} />
      </FolderShell>
      {entrance === 'drop' && landed && (
        <PlaceholderStamp caseData={caseData} exiting={expanded} />
      )}
    </div>
  );
}

// ── Placeholder stamp (D3 will replace this) ───────────────────────
// Slams onto the folder cover with scale 1.4 → 1.0. Positioned
// absolutely over the folder so it overlays the closed cover. The full
// 10-variant stamp art and grunge texture is D3 work; this is
// choreography only.
function PlaceholderStamp({ caseData, exiting = false }) {
  const ref = useRef(null);
  const verdict = (caseData?.verdict || 'WANTED').replace(/_/g, ' ');

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

export { FOLDER_OPEN_TOTAL_MS };
