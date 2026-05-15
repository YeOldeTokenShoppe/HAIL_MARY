import React, { useState, useEffect } from 'react';

// FlowGraph — reusable SVG primitive for node-and-arrow evidence visuals.
// Drives multiple case-001 evidence types: wash-trading loop (circular),
// funding trace (linear), deployer cluster (radial), KOL ring (radial).
//
// Inputs are intentionally minimal — node positions are computed from the
// `layout` mode; callers supply only logical node ids + edge connections.
//
//   layout: 'circular' | 'linear' | 'radial'
//   nodes: [{ id, label, sublabel?, badge?, highlight? }]
//   edges: [{ from, to, weight?, dashed?: true (default) }]
//   threat: 'red' | 'amber' | 'green'  → drives accent color
//   centerNode: only for 'radial' — id of the center node (others orbit it)
//   highlightId: optional id to render with stronger emphasis
//
// All edges animate (stroke-dashoffset marching) so the graph reads as
// "live data flow" rather than a static diagram.
//
// Responsive: `linear` flows rotate 90° on narrow viewports — nodes flow
// top-to-bottom in a tall viewBox so the column uses screen height, and
// external labels move to the right of each node (otherwise they'd sit
// directly on the arrows between adjacent nodes).

const NODE_RADIUS = 22;
const PADDING = 80;
const MOBILE_BREAKPOINT = 560;

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

function computePositions({ nodes, layout, radius, centerNode, vertical }) {
  if (layout === 'circular') {
    return nodes.map((node, i) => {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      return {
        ...node,
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      };
    });
  }
  if (layout === 'linear') {
    // Evenly spaced along a single axis — horizontal by default, vertical
    // when the container demands it (mobile).
    const step = nodes.length === 1 ? 0 : (radius * 2) / (nodes.length - 1);
    return nodes.map((node, i) => {
      const offset = -radius + step * i;
      return {
        ...node,
        x: vertical ? 0 : offset,
        y: vertical ? offset : 0,
      };
    });
  }
  if (layout === 'radial') {
    const orbiters = nodes.filter((n) => n.id !== centerNode);
    const center = nodes.find((n) => n.id === centerNode);
    const positioned = [];
    if (center) positioned.push({ ...center, x: 0, y: 0 });
    orbiters.forEach((node, i) => {
      const angle = (i / orbiters.length) * Math.PI * 2 - Math.PI / 2;
      positioned.push({
        ...node,
        x: radius * Math.cos(angle),
        y: radius * Math.sin(angle),
      });
    });
    return positioned;
  }
  return nodes.map((n) => ({ ...n, x: 0, y: 0 }));
}

// Shorten an edge by the node radius at both ends so the arrowhead sits just
// outside each node circle (instead of overlapping the node fill).
function shortenEdge(x1, y1, x2, y2, shorten) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  return {
    x1: x1 + nx * shorten,
    y1: y1 + ny * shorten,
    x2: x2 - nx * shorten,
    y2: y2 - ny * shorten,
  };
}

export default function FlowGraph({
  nodes = [],
  edges = [],
  layout = 'circular',
  threat = 'red',
  centerNode = null,
  highlightId = null,
  radius = 140,
}) {
  const isNarrow = useIsNarrow(MOBILE_BREAKPOINT);
  const isLinearVertical = layout === 'linear' && isNarrow;

  const accent =
    threat === 'red'   ? '#ff4d6d' :
    threat === 'amber' ? '#ffb84d' :
                         '#4dffaa';
  const accentDim =
    threat === 'red'   ? 'rgba(255,77,109,0.18)' :
    threat === 'amber' ? 'rgba(255,184,77,0.18)' :
                         'rgba(77,255,170,0.18)';

  const positioned = computePositions({ nodes, layout, radius, centerNode, vertical: isLinearVertical });
  const positionMap = Object.fromEntries(positioned.map((n) => [n.id, n]));

  // Square viewBox for most layouts; tall-and-narrow for linear-vertical
  // so the rotated column uses the full available height on mobile. Width
  // budget allows for external labels to the right of each node.
  let viewBox;
  if (isLinearVertical) {
    const halfW = NODE_RADIUS + 70;
    const halfH = radius + PADDING;
    viewBox = `${-halfW} ${-halfH} ${2 * halfW} ${2 * halfH}`;
  } else {
    const viewBoxRadius = radius + PADDING;
    viewBox = `${-viewBoxRadius} ${-viewBoxRadius} ${2 * viewBoxRadius} ${2 * viewBoxRadius}`;
  }

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <defs>
        <marker
          id="fg-arrow"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L6,3 z" fill={accent} />
        </marker>
        <style>{`
          .fg-edge {
            stroke: ${accent};
            stroke-width: 1.6;
            fill: none;
            opacity: 0.78;
            stroke-dasharray: 5 4;
            animation: fgFlow 1.6s linear infinite;
          }
          @keyframes fgFlow {
            to { stroke-dashoffset: -18; }
          }
          .fg-node-bg {
            fill: #050a07;
            stroke: ${accent};
            stroke-width: 2;
          }
          .fg-node-bg-highlight {
            fill: ${accent};
            stroke: ${accent};
            stroke-width: 2;
            filter: drop-shadow(0 0 6px ${accent});
          }
          .fg-node-glow {
            fill: ${accentDim};
            stroke: none;
          }
          .fg-node-label {
            fill: #c8ffe0;
            font-family: 'IBM Plex Mono', 'SF Mono', Menlo, monospace;
            font-size: 9px;
            text-anchor: middle;
            letter-spacing: 0.04em;
          }
          .fg-node-sublabel {
            fill: ${accent};
            font-family: 'IBM Plex Mono', 'SF Mono', Menlo, monospace;
            font-size: 7px;
            text-anchor: middle;
            opacity: 0.75;
          }
          .fg-node-badge {
            fill: ${accent};
            font-family: 'Cinzel Decorative', serif;
            font-size: 14px;
            text-anchor: middle;
            font-weight: bold;
          }
        `}</style>
      </defs>

      {/* Edges (drawn first so nodes sit on top) */}
      {edges.map((edge, i) => {
        const from = positionMap[edge.from];
        const to = positionMap[edge.to];
        if (!from || !to) return null;
        const { x1, y1, x2, y2 } = shortenEdge(from.x, from.y, to.x, to.y, NODE_RADIUS + 4);
        return (
          <line
            key={`e-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className="fg-edge"
            markerEnd="url(#fg-arrow)"
          />
        );
      })}

      {/* Nodes */}
      {positioned.map((node) => {
        const isHighlight = node.id === highlightId || node.highlight;
        return (
          <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
            <circle r={NODE_RADIUS + 8} className="fg-node-glow" />
            <circle
              r={NODE_RADIUS}
              className={isHighlight ? 'fg-node-bg-highlight' : 'fg-node-bg'}
            />
            {node.badge && (
              <text className="fg-node-badge" dy="4">{node.badge}</text>
            )}
            {!node.badge && (
              <text
                className="fg-node-label"
                dy={node.sublabel ? -1 : 3}
                style={isHighlight ? { fill: '#050a07', fontWeight: 700 } : undefined}
              >
                {node.label}
              </text>
            )}
            {node.sublabel && !node.badge && (
              <text className="fg-node-sublabel" dy={9}>{node.sublabel}</text>
            )}
            {/* External label: below the node horizontally, to the right
                of the node when the linear flow has been rotated vertical
                (otherwise it would collide with the arrow to the next node). */}
            {node.externalLabel && (
              <text
                className="fg-node-label"
                dx={isLinearVertical ? NODE_RADIUS + 14 : 0}
                dy={isLinearVertical ? 3 : NODE_RADIUS + 16}
                style={{
                  fontSize: 8,
                  textAnchor: isLinearVertical ? 'start' : 'middle',
                }}
              >
                {node.externalLabel}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
