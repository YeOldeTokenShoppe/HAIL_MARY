'use client';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';

// Manila palette — kept inline because it's the literal color of the
// object, not a new design token (see §13: "Do not add new color tokens").
// Lightened from straight manila toward cream/parchment so it reads like
// the WANTED-poster reference: aged, handled, slightly dirty.
const MANILA = {
  highlight: '#e8d4a8',  // cream highlight
  base:      '#d4b683',  // body
  shadow:    '#9a7d4a',  // shadowed wear
  edge:      '#5a4a2a',  // deepest grime / spine fold
};

// Clean manila: a fine cross-hatched fibre noise composed over the base
// gradient. The bigger radial blotches read as dirt and pushed the look
// too far toward "WANTED poster"; this version stays "manila folder."
const PAPER_TEXTURE = `
  repeating-linear-gradient(115deg, rgba(0,0,0,0.035) 0 1px, transparent 1px 3px),
  repeating-linear-gradient(45deg,  rgba(0,0,0,0.025) 0 2px, transparent 2px 5px),
  linear-gradient(160deg, ${MANILA.highlight} 0%, ${MANILA.base} 55%, ${MANILA.shadow} 100%)
`;

// Timing per §10. Centralized so D7 can read from the same constants
// when sequencing the share-bar fade-in. The innerFade beat from §10
// is intentionally absorbed: the flap physically reveals the dossier
// as it sweeps past 90°, so an additional opacity fade just inserted
// a "blank" beat between flap-done and page-visible.
export const FOLDER_TIMELINE_MS = {
  slide: 350,
  pause: 200,
  flap:  600,
};
export const FOLDER_OPEN_TOTAL_MS =
  FOLDER_TIMELINE_MS.slide +
  FOLDER_TIMELINE_MS.pause +
  FOLDER_TIMELINE_MS.flap;  // 1150ms — dossier fully visible.

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
 * The flap is hinged on the left edge (the "spine" of a book-style case
 * file) and rotates around the Y axis. transformOrigin '0% 50%' puts the
 * hinge along the left edge; rotationY -180 swings the right edge
 * toward the viewer and fully over to the left, ending lying flat to
 * the LEFT of the dossier — a book-spread look. The flap's back face
 * is painted the same as the front, so the open cover reads as a
 * mirrored manila panel beside the inner page.
 *
 * Honors prefers-reduced-motion by jumping to final state. Mobile width
 * clamps to 90vw per §10.
 *
 * Children render inside the back panel, beneath the flap while closed.
 * D1 ships with placeholder content; D2 swaps in the real DossierPage.
 */
/**
 * @param {Object}   props
 * @param {React.ReactNode} props.children   — inner dossier content
 * @param {() => void} [props.onOpened]      — fires when the entrance
 *   sequence completes. Slide: flap finishes opening. Drop: folder has
 *   landed (flap still closed).
 * @param {() => void} [props.onExpand]      — drop-mode only. Fires
 *   after the user clicks the landed folder and the flap finishes its
 *   book-spread rotation.
 * @param {boolean} [props.skipAnimation]    — §10 revisit-skip rule
 * @param {'slide'|'drop'} [props.entrance]
 *   'slide' (default): tumbles in from off-screen right, flap opens to
 *      reveal the dossier — the "investigation reveal" sequence.
 *   'drop': drops from above onto the scene with a thud (overshoot bounce
 *      + folder shake), flap stays CLOSED. Used by the summary/share
 *      moment where a verdict stamp slams onto the cover. After landing
 *      the folder is clickable; clicking opens the flap to book-spread.
 */
export default function FolderShell({
  children,
  onOpened,
  onExpand,
  skipAnimation = false,
  entrance = 'slide',
}) {
  const folderRef = useRef(null);
  const flapRef = useRef(null);
  const innerRef = useRef(null);
  const onOpenedRef = useRef(onOpened);
  onOpenedRef.current = onOpened;
  const onExpandRef = useRef(onExpand);
  onExpandRef.current = onExpand;
  // Track lifecycle for the drop → click-to-open interaction. Refs (not
  // state) so we don't re-render and don't blow away the running GSAP
  // timeline that mutates the same elements.
  const landedRef = useRef(false);
  const expandedRef = useRef(false);

  const handleCoverClick = () => {
    if (entrance !== 'drop') return;
    if (!landedRef.current || expandedRef.current) return;
    expandedRef.current = true;
    // Fire onExpand IMMEDIATELY (not on animation end) so the parent
    // can start its own coordinated transitions — most importantly
    // fading the verdict stamp out — in lockstep with the flap
    // beginning to rotate. Waiting for the end of the flap tween
    // leaves the stamp lingering on top of the dossier after the
    // cover has already swept away.
    if (typeof onExpandRef.current === 'function') onExpandRef.current();
    gsap.to(flapRef.current, {
      rotationY: -180,
      duration: 0.6,
      ease: 'back.out(1.7)',
    });
  };

  useEffect(() => {
    const folderEl = folderRef.current;
    const flapEl = flapRef.current;
    const innerEl = innerRef.current;
    if (!folderEl || !flapEl || !innerEl) return;

    // Reset lifecycle refs on each effect run (remount/replay).
    landedRef.current = false;
    expandedRef.current = false;

    const fireOpened = () => {
      landedRef.current = true;
      if (typeof onOpenedRef.current === 'function') onOpenedRef.current();
    };

    // §10: "If the user has already seen this exact case before (URL
    // revisit), skip the animation entirely." CaseFileScene passes
    // skipAnimation when sessionStorage flags this caseNumber as seen.
    if (skipAnimation) {
      if (entrance === 'drop') {
        gsap.set(folderEl, { x: 0, y: 0, rotation: 0 });
        gsap.set(flapEl, { rotationY: 0, opacity: 1 });
        // Inner stays opaque even in drop mode — the closed flap covers
        // it, and click-to-open just needs the dossier ready underneath.
        gsap.set(innerEl, { opacity: 1 });
      } else {
        gsap.set(folderEl, { x: 0, y: 0, rotation: 0 });
        gsap.set(flapEl, { rotationY: -180, opacity: 1 });
        gsap.set(innerEl, { opacity: 1 });
      }
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
          if (entrance === 'drop') {
            gsap.set(folderEl, { x: 0, y: 0, rotation: 0 });
            gsap.set(flapEl, { rotationY: 0, opacity: 1 });
            gsap.set(innerEl, { opacity: 1 });
          } else {
            gsap.set(folderEl, { x: 0, y: 0, rotation: 0 });
            gsap.set(flapEl, { rotationY: -180, opacity: 1 });
            gsap.set(innerEl, { opacity: 1 });
          }
          fireOpened();
          return;
        }
        // ── DROP entrance ────────────────────────────────────────
        // Comes from the viewer's perspective: starts oversized + faded
        // (as if close to the camera, out of focus) and shrinks to
        // resting size as it "lands" on the desk. Same scale + opacity +
        // ease as the stamp slam so the two slams feel kindred. Flap
        // stays closed; the stamp follows in CaseFileScene via onOpened.
        if (entrance === 'drop') {
          gsap.set(folderEl, { x: 0, y: 0, rotation: 0, scale: 1.4, opacity: 0 });
          gsap.set(flapEl, { rotationY: 0, opacity: 1 });
          // Dossier is ready underneath the closed flap so a click can
          // immediately rotate the cover away and reveal it.
          gsap.set(innerEl, { opacity: 1 });
          gsap.to(folderEl, {
            scale: 1,
            opacity: 1,
            duration: 0.2,
            ease: 'power3.in',
            onComplete: fireOpened,
          });
          return;
        }
        // ── SLIDE entrance (default) ──────────────────────────────
        // Use pixels not 'vw' — GSAP's CSS plugin can mis-parse viewport
        // units in transform values, leaving the folder parked off-screen.
        const offscreenX = typeof window !== 'undefined' ? window.innerWidth + 100 : 1500;
        // Tumble-in: folder enters from upper-right with a heavy CCW
        // spin + slight upward offset, lands square.
        gsap.set(folderEl, { x: offscreenX, y: -120, rotation: 28 });
        gsap.set(flapEl, { rotationY: 0, opacity: 1 });
        // Inner page is opaque from the start — the flap physically
        // blocks it. The animation is the FLAP rotating away, not the
        // dossier fading in. An explicit fade left a blank beat between
        // "flap done" and "page visible" that read as broken.
        gsap.set(innerEl, { opacity: 1 });
        const t = FOLDER_TIMELINE_MS;
        const flapStart = (t.slide + t.pause) / 1000;
        const flapDur = t.flap / 1000;
        const tl = gsap.timeline({ onComplete: fireOpened });
        // Tumble-in at 0. Position + rotation animate together so the
        // folder spirals in rather than just gliding. Ends square at the
        // origin so the flap-open animation has a clean reference frame.
        tl.to(folderEl, {
          x: 0,
          y: 0,
          rotation: 0,
          duration: t.slide / 1000,
          ease: EASES.slide,
        }, 0);
        // Flap opens 0 → -180° around its left edge (the spine). At
        // -180° the cover lies flat to the LEFT of the dossier with its
        // back face toward the camera — a book-spread look. Stopping
        // earlier (e.g. -110°) leaves a foreshortened sliver because
        // the cover is sitting at an angle the camera can barely see.
        tl.to(flapEl, {
          rotationY: -180,
          duration: flapDur,
          ease: EASES.flap,
        }, flapStart);
      },
    );
    return () => mm.revert();
  }, [skipAnimation, entrance]);

  return (
    <div style={styles.stage}>
      <div
        ref={folderRef}
        // In drop mode the folder is interactive after landing — click
        // to open. handleCoverClick guards on landedRef + expandedRef so
        // pre-land clicks and double-clicks are no-ops.
        onClick={entrance === 'drop' ? handleCoverClick : undefined}
        onKeyDown={entrance === 'drop' ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCoverClick();
          }
        } : undefined}
        role={entrance === 'drop' ? 'button' : undefined}
        tabIndex={entrance === 'drop' ? 0 : undefined}
        aria-label={entrance === 'drop' ? 'Open case file' : undefined}
        style={{
          ...styles.folder,
          cursor: entrance === 'drop' ? 'pointer' : 'default',
        }}
        data-case-folder
      >

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
    // Match the flap's rounding: sharp spine on the left, rounded edges
    // on the right (opening side).
    borderRadius: '4px 18px 18px 4px',
    overflow: 'hidden',
    backgroundImage: PAPER_TEXTURE,
    // multiply pushes the fibre noise into the manila base.
    backgroundBlendMode: 'multiply, multiply, normal',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.35), ' +
      'inset 0 -2px 8px rgba(0,0,0,0.35), ' +
      'inset 0 0 24px rgba(70,45,15,0.18)',
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
    backgroundImage: PAPER_TEXTURE,
    backgroundBlendMode: 'multiply, multiply, normal',
    // Sharper corners on the spine (left) side, rounded on the opening
    // (right) side — matches the visual idiom of a hinged file folder.
    borderRadius: '4px 18px 18px 4px',
    transformOrigin: '0% 50%',       // hinge: left edge (the spine)
    // Keep backface visible — hiding it caused a hard snap at 90° that
    // made the open read as "opens and vanishes simultaneously." We
    // instead tween opacity in the timeline so the flap fades out
    // gracefully as it rotates past vertical, with no sliver left over.
    backfaceVisibility: 'visible',
    boxShadow: '4px 0 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.35)',
    willChange: 'transform, opacity',
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
    // Spine hint (vertical stripe near the left, the hinge side) + a
    // subtle vignette so the flap reads as a physical surface.
    background: `
      radial-gradient(80% 120% at 0% 50%, rgba(0,0,0,0) 60%, rgba(0,0,0,0.18) 100%),
      linear-gradient(to right, transparent 0%, ${MANILA.shadow} 0.6%, ${MANILA.shadow} 1.4%, transparent 2.2%)
    `,
    pointerEvents: 'none',
  },
};
