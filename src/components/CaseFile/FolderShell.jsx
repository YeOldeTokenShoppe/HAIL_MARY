'use client';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';

// Manila palette — kept inline because it's the literal color of the
// object, not a new design token (see §13: "Do not add new color tokens").
const MANILA = {
  highlight: '#dbc287',
  base:      '#c8a96b',
  shadow:    '#8a6f3f',
  edge:      '#5a4a2a',
};

// Timing per §10. Centralized so D7 can read from the same constants
// when sequencing the share-bar fade-in (slide + pause + flap + fade
// = 1450ms; share buttons land at 3150ms with the §10 read-pause in
// between, owned by CaseFileScene not this component).
export const FOLDER_TIMELINE_MS = {
  slide:     350,
  pause:     200,
  flap:      600,
  innerFade: 300,
};
export const FOLDER_OPEN_TOTAL_MS =
  FOLDER_TIMELINE_MS.slide +
  FOLDER_TIMELINE_MS.pause +
  FOLDER_TIMELINE_MS.flap +
  FOLDER_TIMELINE_MS.innerFade; // 1450ms — the dossier-visible moment.

// Easing translations from §10 → GSAP named eases:
//   cubic-bezier(0,0,0.2,1)        ≈ "power2.out"   (slide-in, inner fade)
//   cubic-bezier(.34,1.56,.64,1)   ≈ "back.out(1.7)" (flap overshoot)
const EASES = {
  slide:     'power2.out',
  flap:      'back.out(1.7)',
  innerFade: 'power2.out',
};

/**
 * FolderShell — manila case-file folder. Slides in from off-screen right,
 * pauses, then lifts its front cover open to reveal the inner dossier.
 *
 * The flap is hinged at the bottom (the "spine" of a file folder) and
 * rotates up + back via rotateX. transformOrigin '50% 100%' puts the
 * hinge along the bottom edge so the top of the cover swings away from
 * the viewer.
 *
 * Honors prefers-reduced-motion by jumping to final state. Mobile width
 * clamps to 90vw per §10.
 *
 * Children render inside the back panel, beneath the flap while closed.
 * D1 ships with placeholder content; D2 swaps in the real DossierPage.
 */
export default function FolderShell({ children, onOpened, skipAnimation = false }) {
  const folderRef = useRef(null);
  const flapRef = useRef(null);
  const innerRef = useRef(null);
  const onOpenedRef = useRef(onOpened);
  onOpenedRef.current = onOpened;

  useEffect(() => {
    const folderEl = folderRef.current;
    const flapEl = flapRef.current;
    const innerEl = innerRef.current;
    if (!folderEl || !flapEl || !innerEl) return;

    const fireOpened = () => {
      if (typeof onOpenedRef.current === 'function') onOpenedRef.current();
    };

    // §10: "If the user has already seen this exact case before (URL
    // revisit), skip the animation entirely." CaseFileScene passes
    // skipAnimation when sessionStorage flags this caseNumber as seen.
    if (skipAnimation) {
      gsap.set(folderEl, { x: 0 });
      gsap.set(flapEl, { rotationX: 110 });
      gsap.set(innerEl, { opacity: 1 });
      // Defer so the consumer doesn't get the callback during render.
      const t = setTimeout(fireOpened, 0);
      return () => clearTimeout(t);
    }

    const mm = gsap.matchMedia();
    mm.add(
      {
        reduced: '(prefers-reduced-motion: reduce)',
        normal:  '(prefers-reduced-motion: no-preference)',
      },
      (ctx) => {
        const { reduced } = ctx.conditions;
        if (reduced) {
          gsap.set(folderEl, { x: 0 });
          gsap.set(flapEl, { rotationX: 110 });
          gsap.set(innerEl, { opacity: 1 });
          fireOpened();
          return;
        }
        gsap.set(folderEl, { x: '100vw' });
        gsap.set(flapEl, { rotationX: 0 });
        gsap.set(innerEl, { opacity: 0 });
        const t = FOLDER_TIMELINE_MS;
        const tl = gsap.timeline({ onComplete: fireOpened });
        // Slide-in at 0.
        tl.to(folderEl, {
          x: 0,
          duration: t.slide / 1000,
          ease: EASES.slide,
        }, 0);
        // Flap opens after the slide + 200ms pause. Positive rotateX with
        // bottom-edge origin = top of cover swings up + back.
        tl.to(flapEl, {
          rotationX: 110,
          duration: t.flap / 1000,
          ease: EASES.flap,
        }, (t.slide + t.pause) / 1000);
        // Inner page fades in as the flap clears it.
        tl.to(innerEl, {
          opacity: 1,
          duration: t.innerFade / 1000,
          ease: EASES.innerFade,
        }, (t.slide + t.pause + t.flap) / 1000);
      },
    );
    return () => mm.revert();
  }, [skipAnimation]);

  return (
    <div style={styles.stage}>
      <div ref={folderRef} style={styles.folder}>
        {/* Back panel — manila with a tab + the inner dossier slot.
            Stays put through the whole animation; it's what the flap
            uncovers. */}
        <div style={styles.backPanel}>
          <div style={styles.backTab}>CASE FILE — CLASSIFIED</div>
          <div ref={innerRef} style={styles.inner}>
            {children}
          </div>
        </div>
        {/* Front cover (flap) — covers everything while closed. Lifts up
            and back via rotateX. backfaceVisibility:'visible' so the
            interior of the flap remains painted after it passes 90°. */}
        <div ref={flapRef} style={styles.flap}>
          <div style={styles.flapTab}>CASE FILE — CLASSIFIED</div>
          <div style={styles.flapFace} />
        </div>
      </div>
    </div>
  );
}

const styles = {
  stage: {
    perspective: 1600,
    perspectiveOrigin: '50% 38%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '24px 16px',
    background: 'transparent',
  },
  folder: {
    position: 'relative',
    // Portrait letter-ish aspect. Caps so it never overflows a desktop
    // viewport; collapses to 90vw on mobile per §10.
    width: 'min(640px, 90vw)',
    aspectRatio: '5 / 7',
    transformStyle: 'preserve-3d',
    filter: 'drop-shadow(0 24px 40px rgba(0,0,0,0.55))',
    willChange: 'transform',
  },
  backPanel: {
    position: 'absolute',
    inset: 0,
    borderRadius: '4px 18px 6px 6px',
    overflow: 'hidden',
    // Manila base + a faint paper grain via repeating gradient.
    backgroundImage: `
      linear-gradient(160deg, ${MANILA.highlight} 0%, ${MANILA.base} 55%, ${MANILA.shadow} 100%),
      repeating-linear-gradient(45deg, rgba(0,0,0,0.025) 0 2px, transparent 2px 4px)
    `,
    backgroundBlendMode: 'multiply',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -2px 6px rgba(0,0,0,0.25)',
  },
  backTab: {
    position: 'absolute',
    top: -22,
    left: '6%',
    padding: '4px 16px 8px',
    background: MANILA.base,
    borderRadius: '6px 6px 0 0',
    fontFamily: "'Special Elite', 'Courier New', monospace",
    fontSize: 11,
    letterSpacing: '0.18em',
    color: MANILA.edge,
    textShadow: '0 1px 0 rgba(255,255,255,0.25)',
    boxShadow: '0 -1px 0 rgba(0,0,0,0.15)',
  },
  inner: {
    position: 'absolute',
    inset: '6% 6% 6% 6%',
    background: '#f4ecd2',
    borderRadius: 2,
    boxShadow: 'inset 0 0 32px rgba(120,80,30,0.18), 0 2px 4px rgba(0,0,0,0.18)',
    overflow: 'auto',
    padding: 'clamp(14px, 3vw, 28px)',
    fontFamily: "'Special Elite', 'Courier New', monospace",
    color: '#2a2520',
  },
  flap: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(170deg, ${MANILA.highlight} 0%, ${MANILA.base} 50%, ${MANILA.shadow} 100%),
      repeating-linear-gradient(45deg, rgba(0,0,0,0.025) 0 2px, transparent 2px 4px)
    `,
    backgroundBlendMode: 'multiply',
    borderRadius: '4px 18px 6px 6px',
    transformOrigin: '50% 100%',     // hinge: bottom edge (the spine)
    backfaceVisibility: 'visible',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.35)',
    willChange: 'transform',
  },
  flapTab: {
    position: 'absolute',
    top: -22,
    left: '6%',
    padding: '4px 16px 8px',
    background: MANILA.base,
    borderRadius: '6px 6px 0 0',
    fontFamily: "'Special Elite', 'Courier New', monospace",
    fontSize: 11,
    letterSpacing: '0.18em',
    color: MANILA.edge,
    textShadow: '0 1px 0 rgba(255,255,255,0.25)',
  },
  flapFace: {
    position: 'absolute',
    inset: 0,
    // Hint of the fold/spine + a subtle vignette so the flap reads as a
    // physical surface rather than a flat tile.
    background: `
      radial-gradient(120% 80% at 50% 0%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.18) 100%),
      linear-gradient(to bottom, transparent 78%, ${MANILA.shadow} 78.4%, ${MANILA.shadow} 78.8%, transparent 79.2%)
    `,
    pointerEvents: 'none',
  },
};
