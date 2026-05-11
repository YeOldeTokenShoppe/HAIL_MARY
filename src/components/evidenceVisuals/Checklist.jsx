import React from 'react';

// Checklist — labeled rows with status glyphs. Drives multiple case-001
// evidence types:
//   • Eugene/AI CLAIMS       — verification rows, all NONE
//   • Eugene/WHITEPAPER      — 6 "Tokenomics" pages + missing architecture
//   • Marisol/LP / VESTING   — exit-readiness checklist (LP unlocked, 0% vested)
//   • Barron/KOL PROMOTERS   — paid promoters with rug history
//   • Barron/TELEGRAM ACTIVITY — phrase-frequency report
//
//   items: [{ status: 'fail'|'warn'|'ok'|'missing', label, value?, sublabel? }]
//   title: optional section label rendered above the rows
//   threat: drives the overall accent (color of the title)

const STATUS = {
  fail:    { glyph: '✗', color: '#ff4d6d', bg: 'rgba(120,0,30,0.16)',   border: '#ff4d6d' },
  warn:    { glyph: '⚠', color: '#ffb84d', bg: 'rgba(120,80,0,0.16)',   border: '#ffb84d' },
  ok:      { glyph: '✓', color: '#4dffaa', bg: 'rgba(10,80,40,0.20)',   border: '#4dffaa' },
  missing: { glyph: '○', color: '#6db59a', bg: 'rgba(20,30,28,0.30)',   border: '#3a6b54' },
};

export default function Checklist({
  items = [],
  title,
  threat = 'red',
}) {
  const titleColor =
    threat === 'red'   ? '#ff4d6d' :
    threat === 'amber' ? '#ffb84d' :
                         '#8effc4';
  return (
    <div
      style={{
        padding: '14px 18px',
        fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        height: '100%',
        overflow: 'auto',
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.32em',
            color: titleColor,
            marginBottom: 10,
            fontWeight: 600,
          }}
        >
          // {title}
        </div>
      )}
      {items.map((item, i) => {
        const s = STATUS[item.status] || STATUS.missing;
        return (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: '28px 1fr auto',
              gap: 12,
              alignItems: 'center',
              padding: '8px 12px',
              borderLeft: `2px solid ${s.border}`,
              background: s.bg,
              borderRadius: 2,
            }}
          >
            <div
              style={{
                fontSize: 14,
                color: s.color,
                textAlign: 'center',
                fontWeight: 700,
              }}
            >
              {s.glyph}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: '#c8ffe0',
                  fontSize: 12,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {item.label}
              </div>
              {item.sublabel && (
                <div
                  style={{
                    color: '#6db59a',
                    fontSize: 10,
                    marginTop: 2,
                    fontStyle: 'italic',
                  }}
                >
                  {item.sublabel}
                </div>
              )}
            </div>
            {item.value && (
              <div
                style={{
                  color: s.color,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.10em',
                }}
              >
                {item.value}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
