"use client";

import React, { useState } from 'react';

// ConsensusRibbon — the verdict-screen UI for the Token Review service.
// Replaces the player-grading ribbon (used by case-001/002/003) because
// reviews have no ground truth — the team renders the verdict, not the
// player. Designed to be share-worthy: big headline + four character
// verdicts laid out as a single screenshot-friendly card.

const VERDICT_LABEL = {
  believe: 'BELIEVE',
  doubt:   'DOUBT',
  abstain: 'ABSTAIN',
  dormant: 'DORMANT',
};

const VERDICT_ACCENT = {
  believe: { color: '#8effc4', dim: 'rgba(77,255,170,0.16)', glow: '0 0 16px rgba(77,255,170,0.55)' },
  doubt:   { color: '#ff4d6d', dim: 'rgba(255,77,109,0.16)', glow: '0 0 16px rgba(255,77,109,0.55)' },
  abstain: { color: '#c8ffe0', dim: 'rgba(200,255,224,0.16)', glow: '0 0 12px rgba(200,255,224,0.35)' },
  dormant: { color: '#8ee9ff', dim: 'rgba(142,233,255,0.16)', glow: '0 0 16px rgba(142,233,255,0.45)' },
};

// Leading sigil-color for the consensus headline strip.
function leaningAccent(leaning) {
  if (leaning === 'split') return { color: '#ffcb74', dim: 'rgba(255,184,77,0.20)', glow: '0 0 18px rgba(255,184,77,0.45)' };
  return VERDICT_ACCENT[leaning] || VERDICT_ACCENT.abstain;
}

export default function ConsensusRibbon({ consensus, stations, token, isMobileView, onClose }) {
  const leaning = consensus?.leaning || 'abstain';
  const accent = leaningAccent(leaning);
  const headline = consensus?.headline || 'Team reading compiled.';

  const stationOrder = ['monk', 'demon', 'marisol', 'eugene'];
  // Track which character card is expanded. Click a clamped card to
  // reveal the full summary; click again (or another card) to collapse.
  const [expandedKey, setExpandedKey] = useState(null);

  return (
    <>
      <div
        className="reveal-ribbon"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(960px, calc(100vw - 24px))',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: '14px 16px',
          background: 'linear-gradient(180deg, rgba(4,12,8,0.94), rgba(2,5,8,0.9))',
          border: `1px solid ${accent.color}`,
          borderRadius: 10,
          boxShadow: `0 0 32px ${accent.dim}, inset 0 0 60px rgba(0,0,0,0.25)`,
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          color: '#c8ffe0',
          fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
          pointerEvents: 'auto',
        }}
      >
        {/* Title strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 10,
            paddingBottom: 8,
            borderBottom: `1px solid ${accent.dim}`,
          }}
        >
          <div>
            <div style={{
              fontSize: 9,
              letterSpacing: '0.28em',
              color: '#6db59a',
              marginBottom: 4,
            }}>
              // TEAM VERDICT
            </div>
            <div
              style={{
                fontFamily: "'Cinzel Decorative','Cinzel',serif",
                fontSize: isMobileView ? 18 : 22,
                color: accent.color,
                textShadow: accent.glow,
                letterSpacing: '0.05em',
                lineHeight: 1.1,
              }}
            >
              {headline}
            </div>
          </div>
          {token?.ticker && (
            <div style={{ textAlign: 'right', minWidth: 0 }}>
              <div style={{ fontSize: 9, letterSpacing: '0.22em', color: '#6db59a' }}>
                // TOKEN
              </div>
              <div
                style={{
                  fontFamily: "'Cinzel Decorative','Cinzel',serif",
                  fontSize: isMobileView ? 14 : 16,
                  color: '#c8ffe0',
                  letterSpacing: '0.06em',
                  lineHeight: 1.1,
                  marginTop: 4,
                }}
              >
                {token.ticker}
              </div>
            </div>
          )}
        </div>

        {/* Four character cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobileView ? '1fr 1fr' : 'repeat(4, 1fr)',
            gap: isMobileView ? 6 : 10,
          }}
        >
          {stationOrder.map((key) => {
            const station = stations?.[key];
            if (!station) return null;
            const v = station.characterVerdict || 'abstain';
            const cAccent = VERDICT_ACCENT[v] || VERDICT_ACCENT.abstain;
            const expanded = expandedKey === key;
            const handleToggle = () => setExpandedKey(expanded ? null : key);
            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                onClick={handleToggle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleToggle();
                  }
                }}
                aria-expanded={expanded}
                aria-label={`${station.character || key} — ${expanded ? 'collapse' : 'expand'} verdict`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  padding: isMobileView ? '8px 9px' : '10px 12px',
                  background: expanded ? 'rgba(2,5,8,0.75)' : 'rgba(2,5,8,0.55)',
                  border: `1px solid ${cAccent.dim}`,
                  borderLeft: `2px solid ${cAccent.color}`,
                  borderRadius: 6,
                  minWidth: 0,
                  cursor: 'pointer',
                  // Lift the expanded card slightly so the grid doesn't
                  // re-flow neighbors aggressively — it just gets taller
                  // in place.
                  gridColumn: expanded && !isMobileView ? 'span 2' : undefined,
                  transition: 'background 0.18s ease',
                  outline: 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{
                      fontFamily: "'Cinzel Decorative','Cinzel',serif",
                      fontSize: isMobileView ? 16 : 18,
                      color: cAccent.color,
                      textShadow: cAccent.glow,
                      lineHeight: 1,
                      flex: '0 0 auto',
                    }}>
                      {station.sigil || '◌'}
                    </span>
                    <span style={{
                      fontSize: isMobileView ? 9 : 10,
                      letterSpacing: '0.16em',
                      color: '#88c4b2',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {station.character || key.toUpperCase()}
                    </span>
                  </div>
                  <span
                    style={{
                      fontFamily: "'Orbitron','IBM Plex Mono',monospace",
                      fontSize: isMobileView ? 9 : 10,
                      fontWeight: 900,
                      letterSpacing: '0.12em',
                      color: cAccent.color,
                      textShadow: cAccent.glow,
                      flex: '0 0 auto',
                    }}
                  >
                    {VERDICT_LABEL[v] || v.toUpperCase()}
                  </span>
                </div>
                {station.summary && (
                  <div
                    style={{
                      fontSize: isMobileView ? 10 : 11,
                      lineHeight: 1.35,
                      color: '#c8ffe0',
                      fontStyle: 'italic',
                      opacity: 0.92,
                      // 3-line clamp keeps the grid uniform by default;
                      // tap toggles to the full prose.
                      ...(expanded
                        ? { whiteSpace: 'normal' }
                        : {
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }),
                    }}
                  >
                    {station.summary}
                  </div>
                )}
                <div
                  aria-hidden="true"
                  style={{
                    fontSize: 8,
                    letterSpacing: '0.18em',
                    color: cAccent.color,
                    opacity: 0.55,
                    marginTop: 2,
                  }}
                >
                  {expanded ? '▴ TAP TO COLLAPSE' : '▾ TAP TO READ'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer — disclaimer + exit. Single exit since reviews are one-off (no NEXT CASE flow). */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            paddingTop: 8,
            borderTop: `1px solid ${accent.dim}`,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontStyle: 'italic',
              color: '#6db59a',
              lineHeight: 1.4,
            }}
          >
            Not financial advice. The team reads patterns; the patterns can lie.
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(110,181,154,0.55)',
              color: '#8fd4b6',
              padding: '8px 14px',
              fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
              fontSize: 10,
              letterSpacing: '0.22em',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            ▸ RETURN
          </button>
        </div>
      </div>
    </>
  );
}
