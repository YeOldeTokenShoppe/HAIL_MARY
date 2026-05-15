import React, { useState, useEffect } from 'react';

// Comparison — layout primitive for side-by-side or stacked panels of
// "look at how similar these are" content. Drives multiple case-001
// evidence types:
//   • Monk/PRIOR OUTCOMES        — 4 mini-sparklines (3 cliffs + 1 ?)
//   • Monk/CONTRACT ORIGINALITY  — 2 code diff panels (template vs $PRPHT)
//   • Eugene/PITCH PATTERN       — 5 landing-page mockup rows
//
//   panels: [{ title, subtitle?, tone?: 'red'|'amber'|'green', lines?, sparkline?, body? }]
//   direction: 'row' | 'column'  (default 'row')
//   threat: drives the overall accent (used when a panel has no tone)
//
// Each panel renders: title bar (with optional subtitle) → optional
// sparkline → optional text lines → optional freeform body node.
//
// Responsive: row-direction layouts force-stack to a single column on
// narrow viewports. Without this, 4-panel rows squeeze each panel to
// ~75px wide on mobile, which pushes sparkline peaks into the title row.

const MOBILE_BREAKPOINT = 560;

const TONE_BG = {
  red:   'rgba(120,0,30,0.14)',
  amber: 'rgba(120,80,0,0.12)',
  green: 'rgba(10,80,40,0.16)',
};
const TONE_BORDER = {
  red:   '#ff4d6d',
  amber: '#ffb84d',
  green: '#4dffaa',
};
const TONE_TITLE = {
  red:   '#ff4d6d',
  amber: '#ffb84d',
  green: '#8effc4',
};
// Translucent variants used for the in-panel divider that separates the
// title row from the sparkline below. Solid border-color collides with the
// sparkline fill (same hue) and reads as a chart peak instead of a rule.
const TONE_DIVIDER = {
  red:   'rgba(255,77,109,0.30)',
  amber: 'rgba(255,184,77,0.30)',
  green: 'rgba(77,255,170,0.30)',
};

function useIsNarrow(breakpoint) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const check = () => setNarrow(window.innerWidth < breakpoint);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [breakpoint]);
  return narrow;
}

// Inline SVG sparkline — a small price/value cliff. Stretches to fill
// horizontally so it reads as a "mini chart" inside the panel.
function Sparkline({ points = [], color = '#ff4d6d', fillTone = null }) {
  if (points.length < 2) return null;
  const W = 200;
  const H = 50;
  const maxY = Math.max(...points);
  const minY = Math.min(...points);
  const range = maxY - minY || 1;
  const stepX = W / (points.length - 1);
  // Leave a 4-unit headroom at the top so the peak doesn't kiss the
  // chart's upper edge (and, by extension, the title row above it).
  const TOP_PAD = 4;
  const segs = points.map((y, i) => {
    const x = i * stepX;
    const ny = H - ((y - minY) / range) * (H - TOP_PAD - 1) - 1;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ny.toFixed(1)}`;
  }).join(' ');
  const fill = fillTone || 'none';
  const fillPath = fillTone ? `${segs} L ${W} ${H} L 0 ${H} Z` : null;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ width: '100%', height: 44, marginTop: 2, display: 'block' }}
    >
      {fillPath && <path d={fillPath} fill={fill} opacity={0.32} />}
      <path d={segs} stroke={color} strokeWidth="1.6" fill="none" />
    </svg>
  );
}

export default function Comparison({
  panels = [],
  direction = 'row',
  threat = 'red',
}) {
  const isNarrow = useIsNarrow(MOBILE_BREAKPOINT);
  // Row-direction layouts collapse to a single column on narrow viewports.
  const isColumn = direction === 'column' || isNarrow;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isColumn ? 'column' : 'row',
        flexWrap: 'wrap',
        gap: 10,
        padding: '8px 12px',
        height: '100%',
        overflow: 'auto',
        fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
      }}
    >
      {panels.map((panel, i) => {
        const tone = panel.tone || threat;
        const bg = TONE_BG[tone] || 'rgba(10,58,38,0.18)';
        const border = TONE_BORDER[tone] || '#4dffaa';
        const titleColor = TONE_TITLE[tone] || '#c8ffe0';
        const divider = TONE_DIVIDER[tone] || 'rgba(200,255,224,0.20)';
        return (
          <div
            key={i}
            style={{
              flex: isColumn ? '0 0 auto' : 1,
              minWidth: 0,
              minHeight: isColumn ? 0 : 100,
              background: bg,
              border: `1px solid ${border}`,
              borderLeftWidth: 2,
              padding: '10px 12px 12px',
              color: '#c8ffe0',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              borderRadius: 3,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                gap: 8,
                paddingBottom: 6,
                borderBottom: `1px solid ${divider}`,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  color: titleColor,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textShadow: `0 0 6px ${divider}`,
                }}
              >
                {panel.title}
              </div>
              {panel.subtitle && (
                <div
                  style={{
                    fontSize: 9,
                    color: '#6db59a',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                  }}
                >
                  {panel.subtitle}
                </div>
              )}
            </div>
            {panel.sparkline && (
              <Sparkline
                points={panel.sparkline.points}
                color={border}
                fillTone={panel.sparkline.fill ? border : null}
              />
            )}
            {panel.lines &&
              panel.lines.map((line, j) => (
                <div
                  key={j}
                  style={{
                    fontSize: 11,
                    color: line.color || '#c8ffe0',
                    lineHeight: 1.4,
                    fontFamily: line.serif
                      ? "'Cinzel Decorative','Cinzel',serif"
                      : "'IBM Plex Mono','SF Mono',Menlo,monospace",
                    fontStyle: line.italic ? 'italic' : 'normal',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {line.text}
                </div>
              ))}
            {panel.body}
          </div>
        );
      })}
    </div>
  );
}
