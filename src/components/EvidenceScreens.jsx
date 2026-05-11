import { useEffect } from 'react';

// EvidenceScreens — when the player asks a question and `activeAnswer` is set,
// paint a CRT-style "evidence reveal" card onto the focused character's primary
// workstation screen (Screen1-4). The painter sets a flag on the canvas
// (`canvas.dataset.evidenceActive = "true"`) which the ambient CRT painters
// (CRTScreen, DetectiveScreen) check and skip — so when the player taps
// CONTINUE and `activeAnswer` clears, the ambient terminal/leaderboard/scope
// content automatically resumes. No re-wiring of VideoScreens required.
//
// Mapping (station key → screen canvas global):
//   monk    → Screen1 (Saint GR80)
//   demon   → Screen2 (John Barron)
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

export default function EvidenceScreens({ activeAnswer, caseData }) {
  useEffect(() => {
    // Always clear flags first so a stale character's flag doesn't keep
    // CRTScreen frozen when the player asks a question of a different
    // consultant (or clears the answer entirely).
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

  // Unmount cleanup — clear flags so a navigation away from /trade doesn't
  // leave the ambient painters silenced.
  useEffect(() => {
    return () => clearAllEvidenceFlags();
  }, []);

  return null;
}
