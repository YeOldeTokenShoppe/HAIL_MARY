import React from 'react';

// Pie — donut chart primitive for concentration / proportion evidence.
// Drives e.g. Marisol/TOP 10 HOLDERS (71% red wedge) and Barron/TWITTER
// FOLLOWERS (81% botted wedge). One slice is typically `highlight: true` so
// the threat color reads as the dominant visual signal.
//
//   slices: [{ label, value, color?, highlight? }]
//   centerLabel: string  (e.g. "TOP 10")
//   centerMetric: string (e.g. "71%")
//   threat: 'red' | 'amber' | 'green'  → drives highlight color

const TWO_PI = Math.PI * 2;

function arcPath(startAngle, endAngle, innerR, outerR) {
  const x1 = Math.cos(startAngle) * outerR;
  const y1 = Math.sin(startAngle) * outerR;
  const x2 = Math.cos(endAngle) * outerR;
  const y2 = Math.sin(endAngle) * outerR;
  const x3 = Math.cos(endAngle) * innerR;
  const y3 = Math.sin(endAngle) * innerR;
  const x4 = Math.cos(startAngle) * innerR;
  const y4 = Math.sin(startAngle) * innerR;
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return (
    `M ${x1} ${y1} ` +
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} ` +
    `L ${x3} ${y3} ` +
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`
  );
}

export default function Pie({
  slices = [],
  centerLabel = '',
  centerMetric = '',
  threat = 'red',
  radius = 120,
  innerRadius = 62,
}) {
  const accent =
    threat === 'red'   ? '#ff4d6d' :
    threat === 'amber' ? '#ffb84d' :
                         '#4dffaa';

  const total = slices.reduce((s, x) => s + (x.value || 0), 0) || 1;

  let cumulative = 0;
  const arcs = slices.map((slice) => {
    const startAngle = (cumulative / total) * TWO_PI - Math.PI / 2;
    cumulative += slice.value;
    const endAngle = (cumulative / total) * TWO_PI - Math.PI / 2;
    return {
      ...slice,
      startAngle,
      endAngle,
      percentage: (slice.value / total) * 100,
    };
  });

  const viewSize = radius + 90;
  const viewBox = `${-viewSize} ${-viewSize} ${2 * viewSize} ${2 * viewSize}`;

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <defs>
        <style>{`
          .pie-slice-bg { stroke: #050a07; stroke-width: 2; }
          .pie-center-label {
            fill: #6db59a;
            font-family: 'IBM Plex Mono', 'SF Mono', Menlo, monospace;
            font-size: 11px;
            letter-spacing: 0.22em;
            text-anchor: middle;
          }
          .pie-center-metric {
            fill: ${accent};
            font-family: 'Cinzel Decorative', 'Cinzel', serif;
            font-size: 38px;
            font-weight: 700;
            text-anchor: middle;
            filter: drop-shadow(0 0 8px ${accent});
          }
          .pie-slice-label {
            fill: #c8ffe0;
            font-family: 'IBM Plex Mono', 'SF Mono', Menlo, monospace;
            font-size: 11px;
            letter-spacing: 0.02em;
          }
          .pie-slice-percent {
            fill: #6db59a;
            font-family: 'IBM Plex Mono', 'SF Mono', Menlo, monospace;
            font-size: 10px;
          }
          .pie-slice-label-highlight {
            fill: ${accent};
            font-weight: 700;
          }
        `}</style>
      </defs>

      {/* Slices */}
      {arcs.map((arc, i) => {
        const color = arc.highlight
          ? accent
          : (arc.color || 'rgba(109, 181, 154, 0.35)');
        return (
          <path
            key={`slice-${i}`}
            className="pie-slice-bg"
            d={arcPath(arc.startAngle, arc.endAngle, innerRadius, radius)}
            fill={color}
            opacity={arc.highlight ? 1 : 0.82}
            style={arc.highlight ? { filter: `drop-shadow(0 0 10px ${accent})` } : undefined}
          />
        );
      })}

      {/* Center text */}
      {centerLabel && (
        <text className="pie-center-label" dy={-6}>{centerLabel}</text>
      )}
      {centerMetric && (
        <text className="pie-center-metric" dy={28}>{centerMetric}</text>
      )}

      {/* Slice labels around the perimeter */}
      {arcs.map((arc, i) => {
        const mid = (arc.startAngle + arc.endAngle) / 2;
        const labelR = radius + 22;
        const lx = Math.cos(mid) * labelR;
        const ly = Math.sin(mid) * labelR;
        const anchor = lx > 6 ? 'start' : lx < -6 ? 'end' : 'middle';
        return (
          <g key={`lbl-${i}`} transform={`translate(${lx}, ${ly})`}>
            <text
              className={`pie-slice-label${arc.highlight ? ' pie-slice-label-highlight' : ''}`}
              textAnchor={anchor}
              dy={-2}
            >
              {arc.label}
            </text>
            <text className="pie-slice-percent" textAnchor={anchor} dy={12}>
              {arc.percentage.toFixed(0)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}
