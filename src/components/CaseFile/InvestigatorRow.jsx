'use client';
import { CHARACTER_META } from './characterMeta';

// One investigator row in the dossier. Three columns on desktop —
// portrait | name + role + quote | confidence — collapsing to a
// portrait + content row with confidence pinned to the right at
// narrower widths. Designed to live on aged paper (sepia text),
// with the role's neon accent applied sparingly so it doesn't
// fight the manila reading surface.
//
// Expected investigator shape (per §7 of the brief, with one added
// field):
//   {
//     characterId: 'monk' | 'demon' | 'marisol' | 'eugene',
//     name?: string,           // optional override; otherwise meta.name
//     quote: string,           // one-sentence in-voice line
//     confidence: number,      // 0-100
//   }
export default function InvestigatorRow({ investigator }) {
  const meta = CHARACTER_META[investigator?.characterId];
  if (!meta) return null;
  const confidence = clampPct(investigator.confidence);
  const displayName = investigator.name || meta.name;
  return (
    <div style={styles.row}>
      <div style={styles.portraitFrame}>
        <img src={meta.portrait} alt={displayName} style={styles.portrait} />
        <div style={styles.portraitGrain} />
      </div>
      <div style={styles.body}>
        <div style={styles.headline}>
          <span style={styles.sigil} aria-hidden>{meta.sigil}</span>
          <span style={styles.name}>{displayName}</span>
          <span style={{
            ...styles.roleTag,
            color: meta.color,
            borderColor: meta.color,
          }}>
            {meta.role} · {meta.roleSub}
          </span>
        </div>
        <div style={styles.quote}>“{investigator.quote}”</div>
      </div>
      <div style={styles.confidence} aria-label={`Confidence ${confidence}%`}>
        <div style={styles.confidenceNumber}>
          {confidence}<span style={styles.confidencePct}>%</span>
        </div>
        <div style={styles.confidenceLabel}>CONFIDENCE</div>
        <div style={styles.confidenceTrack}>
          <div style={{
            ...styles.confidenceFill,
            width: `${confidence}%`,
            background: meta.color,
          }} />
        </div>
      </div>
    </div>
  );
}

function clampPct(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

const styles = {
  row: {
    display: 'grid',
    gridTemplateColumns: '56px 1fr 86px',
    gap: 12,
    alignItems: 'flex-start',
    padding: '10px 0',
    borderTop: '1px dashed rgba(138,111,63,0.4)',
  },
  portraitFrame: {
    position: 'relative',
    width: 56,
    height: 70,
    overflow: 'hidden',
    background: '#2a2520',
    borderRadius: 2,
    // The "stapled into the file" feel: thin sepia border + a paper-color
    // outer hairline so it reads like a stamped ID photo on the dossier.
    boxShadow:
      '0 0 0 1px rgba(244,236,210,0.85), ' +
      '0 0 0 2px #5a4a2a, ' +
      '0 2px 3px rgba(0,0,0,0.25)',
  },
  portrait: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    // Slight sepia desaturation so the cyberpunk portraits read as
    // "evidence photos" inside the manila file rather than fighting
    // the warm paper palette.
    filter: 'sepia(0.18) contrast(1.05) brightness(0.96)',
  },
  portraitGrain: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    background: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.05) 0 1px, transparent 1px 3px)',
    mixBlendMode: 'multiply',
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    minWidth: 0,
  },
  headline: {
    display: 'flex',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
  },
  sigil: {
    fontFamily: "'Pirata One', 'Special Elite', serif",
    fontSize: 14,
    color: '#5a4a2a',
    lineHeight: 1,
  },
  name: {
    fontFamily: "'Pirata One', 'Special Elite', serif",
    fontSize: 'clamp(13px, 2vw, 16px)',
    color: '#2a2520',
    letterSpacing: '0.02em',
  },
  roleTag: {
    fontFamily: "'Orbitron', 'Special Elite', monospace",
    fontSize: 8,
    letterSpacing: '0.22em',
    padding: '2px 6px',
    border: '1px solid currentColor',
    borderRadius: 2,
    // Subtle paper-tint backdrop so the neon color doesn't fight the
    // sepia field — desaturated by the multiply blend below.
    background: 'rgba(244,236,210,0.6)',
    mixBlendMode: 'multiply',
  },
  quote: {
    fontSize: 12,
    lineHeight: 1.45,
    color: '#3a3128',
    fontStyle: 'italic',
  },
  confidence: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 2,
    minWidth: 86,
  },
  confidenceNumber: {
    fontFamily: "'Orbitron', 'Special Elite', monospace",
    fontSize: 22,
    fontWeight: 800,
    color: '#2a2520',
    lineHeight: 1,
    letterSpacing: '0.02em',
  },
  confidencePct: {
    fontSize: 12,
    color: '#8a6f3f',
    marginLeft: 1,
  },
  confidenceLabel: {
    fontSize: 7,
    letterSpacing: '0.24em',
    color: '#8a6f3f',
    fontFamily: "'Orbitron', 'Special Elite', monospace",
  },
  confidenceTrack: {
    width: '100%',
    height: 3,
    background: 'rgba(138,111,63,0.25)',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 2,
  },
  confidenceFill: {
    height: '100%',
    transition: 'width 0.6s ease-out',
    mixBlendMode: 'multiply',
  },
};
