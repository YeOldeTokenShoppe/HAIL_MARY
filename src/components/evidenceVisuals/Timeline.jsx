import React from 'react';

// Timeline — horizontal time axis with event markers. Drives multiple
// case-001 evidence types: GR80/DEPLOYER WALLET AGE (wallet activity over
// time), Barron/FUD SUPPRESSION (comment-deleted intervals), Eugene/ROADMAP
// REALISM (milestone feasibility).
//
//   events: [{ position: 0-1, label, sublabel?, tone? ('red'|'amber'|'green'), highlight? }]
//   startLabel, endLabel: axis caps
//   threat: 'red' | 'amber' | 'green'  → drives the axis bar accent
//
// Events alternate above/below the axis to avoid label collisions. The
// highlighted event gets a bigger marker + glow so the eye lands on the
// punchline of the story (e.g. "wallet that's only 6 days old just deployed
// a third token").

const PADDING_X = 60;
const PADDING_Y = 100;

export default function Timeline({
  events = [],
  startLabel = 'start',
  endLabel = 'now',
  threat = 'red',
  width = 560,
  height = 240,
}) {
  const accent =
    threat === 'red'   ? '#ff4d6d' :
    threat === 'amber' ? '#ffb84d' :
                         '#4dffaa';

  const axisY = height / 2;
  const axisX0 = PADDING_X;
  const axisX1 = width - PADDING_X;
  const axisLen = axisX1 - axisX0;

  // Sort events by position (defensive — labels alternate based on index)
  const sorted = [...events].sort((a, b) => (a.position || 0) - (b.position || 0));

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
      {sorted.map((event, i) => {
        const x = axisX0 + axisLen * Math.max(0, Math.min(1, event.position || 0));
        const above = i % 2 === 0;
        const labelY = above ? axisY - 36 : axisY + 50;
        const labelOffset = above ? -8 : 14;
        const markerR = event.highlight ? 8 : 5;
        const toneClass = event.tone ? `tl-marker-${event.tone}` : '';
        const cls = event.highlight ? 'tl-marker-highlight' : `tl-marker ${toneClass}`;
        return (
          <g key={`ev-${i}`}>
            {/* Connector line from marker to label */}
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
