import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { resolveEntryVisual, THREAT_ACCENT } from './EvidenceOverlay';

// EvidenceScreens — when the player asks a question and `activeAnswer` is set,
// paint a CRT-style "evidence reveal" card onto the focused character's primary
// workstation screen (Screen1-4). The painter sets a flag on the canvas
// (`canvas.dataset.evidenceActive = "true"`) which the ambient CRT painters
// (CRTScreen, DetectiveScreen) check and skip — so when the player taps
// CONTINUE and `activeAnswer` clears, the ambient terminal/leaderboard/scope
// content automatically resumes. No re-wiring of VideoScreens required.
//
// Two painting paths:
//   • Rich path — when resolveEntryVisual returns a registered visualization,
//     mount the same React component into a hidden DOM node, snapshot it with
//     html2canvas, and drawImage onto the screen canvas. The character's
//     workstation screen ends up mirroring the fullscreen overlay the player
//     can pull up via "VIEW ON SCREEN", so the world feels like it's sharing
//     the same information as the player.
//   • Simple path — fallback canvas-drawn card for entries without a
//     registered visual.
//
// Mapping (station key → screen canvas global):
//   monk    → Screen1 (Saint GR80)
//   demon   → Screen2 (Connor)
//   marisol → Screen3 (Detective Marisol)
//   eugene  → Screen4 (Eugene / RL80)

const STATION_TO_CANVAS = {
  monk:    { canvas: '__screen1Canvas', texture: '__screen1Texture' },
  demon:   { canvas: '__screen2Canvas', texture: '__screen2Texture' },
  marisol: { canvas: '__screen3Canvas', texture: '__screen3Texture' },
  eugene:  { canvas: '__screen4Canvas', texture: '__screen4Texture' },
};

const THREAT_COLOR = {
  red:   '#ff4d6d',
  amber: '#ffb84d',
  green: '#4dffaa',
};

const THREAT_GLYPH = {
  red:   '▲',
  amber: '◆',
  green: '○',
};

const THREAT_VERDICT = {
  red:   '⚠ CONFIRMED SIGNAL',
  amber: '⚠ ELEVATED RISK',
  green: '✓ NORMAL',
};

// Draw a single evidence card onto the given canvas. Uses the same phosphor
// palette as CRTScreen so the swap reads as a switch of station mode rather
// than a different aesthetic system entirely.
function drawEvidenceCard(canvas, station, entry) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const accent = THREAT_COLOR[entry.threat] || '#4dffaa';
  const glyph = THREAT_GLYPH[entry.threat] || '○';
  const verdict = THREAT_VERDICT[entry.threat] || '✓ NORMAL';

  // Background — deep phosphor black
  ctx.fillStyle = '#050a07';
  ctx.fillRect(0, 0, W, H);

  // Subtle radial vignette toward the center, so the card reads as a focused readout
  const grad = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, Math.max(W, H) * 0.7);
  grad.addColorStop(0, 'rgba(13, 80, 50, 0.18)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Outer frame
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, W - 20, H - 20);

  // Header band
  ctx.fillStyle = accent;
  ctx.fillRect(10, 10, W - 20, 38);
  ctx.fillStyle = '#050a07';
  ctx.font = 'bold 18px "IBM Plex Mono", "Courier New", monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const headerText = `▸ ${station.role || station.character || '// EVIDENCE'}`;
  ctx.fillText(headerText, 22, 29);
  // Right-aligned case marker so the band reads as a real header
  ctx.textAlign = 'right';
  ctx.fillText('// EVIDENCE', W - 22, 29);
  ctx.textAlign = 'left';

  // Reveal label (small caps, dim)
  ctx.fillStyle = '#6db59a';
  ctx.font = '13px "IBM Plex Mono", "Courier New", monospace';
  ctx.textBaseline = 'top';
  ctx.fillText(`// ${entry.label}`, 26, 64);

  // Entry value (big, wrapped, phosphor)
  ctx.fillStyle = '#c8ffe0';
  ctx.font = '20px "IBM Plex Mono", "Courier New", monospace';
  ctx.textBaseline = 'top';
  const maxWidth = W - 84;
  const words = String(entry.value || '').split(' ');
  let line = '';
  let y = 92;
  const lineHeight = 28;
  const linesDrawn = [];
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      linesDrawn.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) linesDrawn.push(line);
  for (let i = 0; i < linesDrawn.length; i++) {
    ctx.fillText(linesDrawn[i], 26, y + i * lineHeight);
  }
  const valueEndY = y + linesDrawn.length * lineHeight;

  // Big threat glyph on the right
  ctx.fillStyle = accent;
  ctx.font = 'bold 48px "Cinzel Decorative", "Cinzel", serif';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'right';
  ctx.shadowColor = accent;
  ctx.shadowBlur = 18;
  ctx.fillText(glyph, W - 26, 90);
  ctx.shadowBlur = 0;
  ctx.textAlign = 'left';

  // Verdict bar near the bottom
  const barY = Math.max(valueEndY + 16, H - 56);
  ctx.fillStyle = accent;
  ctx.fillRect(10, barY, W - 20, 28);
  ctx.fillStyle = '#050a07';
  ctx.font = 'bold 13px "IBM Plex Mono", "Courier New", monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText(verdict, 22, barY + 14);

  // Scanlines (drawn last so they overlay everything)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  for (let yy = 0; yy < H; yy += 3) {
    ctx.fillRect(0, yy, W, 1);
  }
}

// Clear our `evidenceActive` flag from all screen canvases. Used when
// activeAnswer transitions to null so the ambient CRT painters resume.
function clearAllEvidenceFlags() {
  if (typeof window === 'undefined') return;
  Object.values(STATION_TO_CANVAS).forEach(({ canvas: ck }) => {
    const c = window[ck];
    if (c && c.dataset) c.dataset.evidenceActive = '';
  });
}

// Target dimensions for the snapshot. Matches the on-mesh screen canvases
// (512×320 from VideoScreens.jsx). The hidden mount renders at this size;
// html2canvas's `scale` param oversamples to keep the rasterized result
// sharp when zoomed in. 2× → 1024×640 effective resolution.
const SNAPSHOT_W = 512;
const SNAPSHOT_H = 320;
const SNAPSHOT_SCALE = 2;

// Resolve which (station, entry) the rich path should mirror. Returned
// null when there's no rich visual registered for this entry, in which
// case the basic canvas painter is used.
function resolveRichTarget(activeAnswer, caseData) {
  if (!activeAnswer) return null;
  const { stationKey, reveals } = activeAnswer;
  const station = caseData?.stations?.[stationKey];
  const entry = station?.entries?.find((e) => e.label === reveals);
  if (!station || !entry) return null;
  const config = resolveEntryVisual(caseData?.id, stationKey, entry);
  if (!config) return null;
  return { stationKey, station, entry, config };
}

export default function EvidenceScreens({ activeAnswer, caseData }) {
  const mountRef = useRef(null);

  const rich = useMemo(
    () => resolveRichTarget(activeAnswer, caseData),
    [activeAnswer, caseData],
  );
  // Stable identity for the snapshot effect — entries are stable within
  // a case file, so {station}:{label} uniquely identifies the rich tree.
  const richKey = rich ? `${rich.stationKey}:${rich.entry.label}` : null;

  // Simple painter path: fires for both no-active-answer (clear flags)
  // AND active-answer-but-no-rich-visual (paint the basic card). The
  // rich path runs as a separate effect below and overwrites the canvas
  // once its snapshot completes.
  useEffect(() => {
    clearAllEvidenceFlags();

    if (!activeAnswer) return;
    if (typeof window === 'undefined') return;

    const { stationKey, reveals } = activeAnswer;
    const target = STATION_TO_CANVAS[stationKey];
    if (!target) return;
    const canvas = window[target.canvas];
    const texture = window[target.texture];
    if (!canvas || !texture) return;

    const station = caseData?.stations?.[stationKey];
    const entry = station?.entries?.find((e) => e.label === reveals);
    if (!entry) return;

    canvas.dataset.evidenceActive = 'true';
    drawEvidenceCard(canvas, station, entry);
    texture.needsUpdate = true;
  }, [activeAnswer, caseData]);

  // Rich-path snapshot. Runs after the hidden mount has rendered (via
  // requestAnimationFrame so layout has settled), rasterizes it, then
  // drawImages onto the matching screen canvas. The basic card painted
  // above lives on the canvas as an instant placeholder until this
  // resolves — typically 100-300ms — then gets overwritten.
  useEffect(() => {
    if (!rich) return;
    if (typeof window === 'undefined') return;
    const node = mountRef.current;
    if (!node) return;

    const target = STATION_TO_CANVAS[rich.stationKey];
    const canvas = window[target?.canvas];
    const texture = window[target?.texture];
    if (!canvas || !texture) return;

    let cancelled = false;

    // Wait one frame so the React tree we just painted into the hidden
    // mount has committed to the DOM and laid out.
    const rafId = requestAnimationFrame(() => {
      html2canvas(node, {
        backgroundColor: '#050a07',
        scale: SNAPSHOT_SCALE,
        width: SNAPSHOT_W,
        height: SNAPSHOT_H,
        logging: false,
        useCORS: true,
      })
        .then((snapshot) => {
          // Bail if a new rich target was selected (or the player
          // dismissed the answer) while html2canvas was working — the
          // effect-cleanup flips `cancelled` to true and the basic
          // painter has already restored the next state's placeholder.
          if (cancelled) return;
          if (!canvas.dataset.evidenceActive) return;

          const ctx = canvas.getContext('2d');
          const W = canvas.width;
          const H = canvas.height;
          ctx.fillStyle = '#050a07';
          ctx.fillRect(0, 0, W, H);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(snapshot, 0, 0, W, H);
          // Scanlines — match the in-overlay scanline overlay so the
          // mesh and the overlay read as the same CRT.
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          for (let yy = 0; yy < H; yy += 3) {
            ctx.fillRect(0, yy, W, 1);
          }
          texture.needsUpdate = true;
        })
        .catch(() => {
          // html2canvas can throw on certain fonts/colors — leave the
          // basic painter's output in place silently.
        });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [richKey]);

  // Unmount cleanup — clear flags so a navigation away from /trade doesn't
  // leave the ambient painters silenced.
  useEffect(() => {
    return () => clearAllEvidenceFlags();
  }, []);

  // Hidden snapshot mount. Lives off-screen at the screen-canvas's
  // native size so html2canvas captures the same dimensions we'll
  // drawImage into. Aria-hidden + pointerEvents: none + transform off
  // the viewport so it never affects layout or screen readers.
  const Visualization = rich?.config?.component || null;
  const visualizationProps = rich?.config
    ? { ...rich.config.props, threat: rich.entry.threat }
    : null;
  const accent = rich ? THREAT_ACCENT[rich.entry.threat] || THREAT_ACCENT.green : null;

  const hiddenMount = (rich && typeof document !== 'undefined')
    ? createPortal(
        <div
          ref={mountRef}
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: '-10000px',
            top: 0,
            width: SNAPSHOT_W,
            height: SNAPSHOT_H,
            pointerEvents: 'none',
            background: '#050a07',
            color: '#c8ffe0',
            fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: `1px solid ${accent.color}`,
          }}
        >
          {/* Header band — mirrors EvidenceOverlay's header */}
          <div style={{
            background: accent.color,
            color: '#050a07',
            padding: '5px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.18em',
          }}>
            <span>▸ {rich.station.character?.toUpperCase()} — {(rich.station.role || '').toUpperCase()}</span>
            <span style={{ opacity: 0.65 }}>// EVIDENCE</span>
          </div>

          {/* Reveal label + metric */}
          <div style={{
            padding: '5px 10px',
            borderBottom: '1px solid rgba(77,255,170,0.18)',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
          }}>
            <div style={{ fontSize: 8, letterSpacing: '0.22em', color: '#6db59a' }}>
              // {rich.entry.label}
            </div>
            {rich.config?.metric && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <div style={{ fontSize: 7, letterSpacing: '0.22em', color: '#6db59a' }}>
                  {rich.config.metric.label}
                </div>
                <div style={{
                  fontFamily: "'Cinzel Decorative','Cinzel',serif",
                  fontSize: 14,
                  color: accent.color,
                }}>
                  {rich.config.metric.value}
                </div>
              </div>
            )}
          </div>

          {/* Visualization */}
          <div style={{
            flex: 1,
            padding: '6px 6px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {Visualization && <Visualization {...visualizationProps} />}
          </div>

          {/* Caption */}
          {rich.config?.caption && (
            <div style={{
              padding: '4px 10px',
              fontSize: 8,
              color: '#c8ffe0',
              fontStyle: 'italic',
              lineHeight: 1.3,
              borderTop: '1px solid rgba(77,255,170,0.18)',
            }}>
              {rich.config.caption}
            </div>
          )}

          {/* Verdict bar */}
          <div style={{
            background: accent.color,
            color: '#050a07',
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 8,
            fontWeight: 700,
            letterSpacing: '0.22em',
          }}>
            <span>{accent.verdict}</span>
            <span style={{ opacity: 0.75, fontWeight: 500 }}>// MIRRORED</span>
          </div>
        </div>,
        document.body,
      )
    : null;

  return hiddenMount;
}
