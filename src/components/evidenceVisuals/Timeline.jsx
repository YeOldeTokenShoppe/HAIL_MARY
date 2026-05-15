import React, { useState, useEffect } from 'react';

// Timeline — time axis with event markers. Drives multiple case-001
// evidence types: GR80/DEPLOYER WALLET AGE (wallet activity over time),
// Barron/FUD SUPPRESSION (comment-deleted intervals), Eugene/ROADMAP
// REALISM (milestone feasibility).
//
//   events: [{ position: 0-1, label, sublabel?, tone? ('red'|'amber'|'green'), highlight? }]
//   startLabel, endLabel: axis caps
//   threat: 'red' | 'amber' | 'green'  → drives the axis bar accent
//
// Responsive: horizontal SVG on wide viewports (labels alternate above/
// below the axis), vertical stack on narrow viewports (each event gets a
// full row — survives long labels and high event counts without overlap).

const MOBILE_BREAKPOINT = 560;

const TONE_COLOR = {
  red:   '#ff4d6d',
  amber: '#ffb84d',
  green: '#4dffaa',
};

const PADDING_X = 60;

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

export default function Timeline({
  events = [],
  startLabel = 'start',
  endLabel = 'now',
  threat = 'red',
  width = 560,
  height = 240,
}) {
  const accent = TONE_COLOR[threat] || TONE_COLOR.green;
  const isNarrow = useIsNarrow(MOBILE_BREAKPOINT);

  // Sort events by position; both layouts walk start → end.
  const sorted = [...events].sort((a, b) => (a.position || 0) - (b.position || 0));

  if (isNarrow) {
    return (
      <VerticalTimeline
        events={sorted}
        accent={accent}
        startLabel={startLabel}
        endLabel={endLabel}
      />
    );
  }

  return (
    <HorizontalTimeline
      events={sorted}
      accent={accent}
      startLabel={startLabel}
      endLabel={endLabel}
      width={width}
      height={height}
    />
  );
}

// ─── Horizontal (desktop) ───────────────────────────────────────────────
// Original alternating-above/below SVG axis. Labels stay readable when
// there's enough horizontal room (~80px per event).

function HorizontalTimeline({ events, accent, startLabel, endLabel, width, height }) {
  const axisY = height / 2;
  const axisX0 = PADDING_X;
  const axisX1 = width - PADDING_X;
  const axisLen = axisX1 - axisX0;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <defs>
        <style>{`
          .tl-axis { stroke: ${accent}; stroke-width: 2; opacity: 0.6; }
          .tl-tick { stroke: ${accent}; stroke-width: 1; opacity: 0.4; }
          .tl-cap {
            fill: #6db59a;
            font-family: 'IBM Plex Mono','SF Mono',Menlo,monospace;
            font-size: 10px;
            letter-spacing: 0.18em;
          }
          .tl-marker {
            fill: #050a07;
            stroke: ${accent};
            stroke-width: 2;
          }
          .tl-marker-highlight {
            fill: ${accent};
            stroke: ${accent};
            stroke-width: 2;
            filter: drop-shadow(0 0 8px ${accent});
          }
          .tl-marker-red    { stroke: #ff4d6d; }
          .tl-marker-amber  { stroke: #ffb84d; }
          .tl-marker-green  { stroke: #4dffaa; }
          .tl-marker-line { stroke: ${accent}; stroke-width: 1; opacity: 0.5; stroke-dasharray: 2 2; }
          .tl-label {
            fill: #c8ffe0;
            font-family: 'IBM Plex Mono','SF Mono',Menlo,monospace;
            font-size: 11px;
          }
          .tl-sublabel {
            fill: #6db59a;
            font-family: 'IBM Plex Mono','SF Mono',Menlo,monospace;
            font-size: 9px;
            letter-spacing: 0.06em;
          }
          .tl-label-highlight { fill: ${accent}; font-weight: 700; }
        `}</style>
      </defs>

      {/* Axis */}
      <line className="tl-axis" x1={axisX0} y1={axisY} x2={axisX1} y2={axisY} />
      {/* End caps */}
      <line className="tl-axis" x1={axisX0} y1={axisY - 6} x2={axisX0} y2={axisY + 6} />
      <line className="tl-axis" x1={axisX1} y1={axisY - 6} x2={axisX1} y2={axisY + 6} />
      {/* Cap labels */}
      <text className="tl-cap" x={axisX0} y={axisY + 24} textAnchor="middle">{startLabel}</text>
      <text className="tl-cap" x={axisX1} y={axisY + 24} textAnchor="middle">{endLabel}</text>

      {/* Quartile ticks */}
      {[0.25, 0.5, 0.75].map((q, i) => (
        <line
          key={`tick-${i}`}
          className="tl-tick"
          x1={axisX0 + axisLen * q}
          y1={axisY - 4}
          x2={axisX0 + axisLen * q}
          y2={axisY + 4}
        />
      ))}

      {/* Event markers (alternating above/below) */}
      {events.map((event, i) => {
        const x = axisX0 + axisLen * Math.max(0, Math.min(1, event.position || 0));
        const above = i % 2 === 0;
        const labelY = above ? axisY - 36 : axisY + 50;
        const labelOffset = above ? -8 : 14;
        const markerR = event.highlight ? 8 : 5;
        const toneClass = event.tone ? `tl-marker-${event.tone}` : '';
        const cls = event.highlight ? 'tl-marker-highlight' : `tl-marker ${toneClass}`;
        return (
          <g key={`ev-${i}`}>
            <line
              className="tl-marker-line"
              x1={x}
              y1={axisY}
              x2={x}
              y2={labelY + (above ? 8 : -8)}
            />
            <circle className={cls} cx={x} cy={axisY} r={markerR} />
            <text
              x={x}
              y={labelY + labelOffset}
              className={`tl-label${event.highlight ? ' tl-label-highlight' : ''}`}
              textAnchor="middle"
            >
              {event.label}
            </text>
            {event.sublabel && (
              <text
                x={x}
                y={labelY + labelOffset + 12}
                className="tl-sublabel"
                textAnchor="middle"
              >
                {event.sublabel}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Vertical (mobile) ──────────────────────────────────────────────────
// HTML/CSS so labels render at native font size regardless of how many
// events there are. Events flow top-to-bottom, axis line runs down the
// left through the marker column.

function VerticalTimeline({ events, accent, startLabel, endLabel }) {
  return (
    <div
      style={{
        padding: '14px 18px',
        fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          color: '#6db59a',
          fontSize: 10,
          letterSpacing: '0.18em',
          marginBottom: 14,
          paddingLeft: 32,
          textTransform: 'uppercase',
        }}
      >
        ▸ {startLabel}
      </div>

      <div style={{ position: 'relative' }}>
        {/* Axis runs through the center of the 14px marker column. */}
        <div
          style={{
            position: 'absolute',
            left: 6,
            top: 8,
            bottom: 8,
            width: 2,
            background: accent,
            opacity: 0.55,
          }}
        />

        {events.map((event, i) => {
          const toneColor = TONE_COLOR[event.tone] || accent;
          const borderColor = event.highlight ? accent : toneColor;
          return (
            <div
              key={`ev-${i}`}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                marginBottom: 18,
                position: 'relative',
              }}
            >
              <div
                style={{
                  flex: '0 0 14px',
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: `2px solid ${borderColor}`,
                  background: event.highlight ? accent : '#050a07',
                  boxShadow: event.highlight ? `0 0 10px ${accent}` : 'none',
                  boxSizing: 'border-box',
                  marginTop: 2,
                  zIndex: 1,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: event.highlight ? accent : '#c8ffe0',
                    fontSize: 13,
                    fontWeight: event.highlight ? 700 : 400,
                    lineHeight: 1.3,
                    letterSpacing: event.highlight ? '0.04em' : 'normal',
                  }}
                >
                  {event.label}
                </div>
                {event.sublabel && (
                  <div
                    style={{
                      color: '#6db59a',
                      fontSize: 10,
                      letterSpacing: '0.06em',
                      marginTop: 3,
                      lineHeight: 1.3,
                    }}
                  >
                    {event.sublabel}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          color: '#6db59a',
          fontSize: 10,
          letterSpacing: '0.18em',
          marginTop: 4,
          paddingLeft: 32,
          textTransform: 'uppercase',
        }}
      >
        ▸ {endLabel}
      </div>
    </div>
  );
}
