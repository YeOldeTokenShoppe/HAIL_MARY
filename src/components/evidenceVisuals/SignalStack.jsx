import React from 'react';

// SignalStack — compact evidence cards for "clean but not risk-free" cases.
// Use it when the lesson is not one giant red flag, but a set of small
// corroborating signals: public team, real users, visible criticism, muted
// hype, bounded admin rights.
//
//   title: optional section label
//   items: [{ label, value, sublabel?, tone?: 'red'|'amber'|'green', meter?: 0-100 }]
//   threat: drives the global accent when an item does not specify tone

const TONE = {
  red: {
    color: '#ff4d6d',
    bg: 'rgba(120,0,30,0.14)',
    border: 'rgba(255,77,109,0.72)',
    glyph: '!',
  },
  amber: {
    color: '#ffb84d',
    bg: 'rgba(120,80,0,0.14)',
    border: 'rgba(255,184,77,0.72)',
    glyph: '~',
  },
  green: {
    color: '#4dffaa',
    bg: 'rgba(10,80,40,0.18)',
    border: 'rgba(77,255,170,0.62)',
    glyph: '+',
  },
};

export default function SignalStack({
  title,
  items = [],
  threat = 'green',
}) {
  const fallback = TONE[threat] || TONE.green;

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
      }}
    >
      {title && (
        <div
          style={{
            color: fallback.color,
            fontSize: 10,
            letterSpacing: '0.32em',
            fontWeight: 700,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          // {title}
        </div>
      )}

      {items.map((item, i) => {
        const tone = TONE[item.tone] || fallback;
        const meter = Number.isFinite(item.meter)
          ? Math.max(0, Math.min(100, item.meter))
          : null;

        return (
          <div
            key={`${item.label}-${i}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '30px 1fr auto',
              gap: 12,
              alignItems: 'center',
              padding: '10px 12px',
              background: tone.bg,
              border: `1px solid ${tone.border}`,
              borderLeftWidth: 3,
              borderRadius: 4,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 0 18px rgba(0,0,0,0.18)`,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                display: 'grid',
                placeItems: 'center',
                color: tone.color,
                border: `1px solid ${tone.border}`,
                background: 'rgba(5,10,7,0.62)',
                fontWeight: 800,
                boxShadow: `0 0 10px ${tone.bg}`,
              }}
            >
              {tone.glyph}
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: '#c8ffe0',
                  fontSize: 12,
                  fontWeight: 700,
                  lineHeight: 1.25,
                }}
              >
                {item.label}
              </div>
              {item.sublabel && (
                <div
                  style={{
                    color: '#6db59a',
                    fontSize: 10,
                    fontStyle: 'italic',
                    marginTop: 3,
                    lineHeight: 1.35,
                  }}
                >
                  {item.sublabel}
                </div>
              )}
              {meter !== null && (
                <div
                  style={{
                    height: 4,
                    borderRadius: 999,
                    background: 'rgba(109,181,154,0.16)',
                    overflow: 'hidden',
                    marginTop: 8,
                  }}
                >
                  <div
                    style={{
                      width: `${meter}%`,
                      height: '100%',
                      background: tone.color,
                      boxShadow: `0 0 12px ${tone.color}`,
                    }}
                  />
                </div>
              )}
            </div>

            {item.value && (
              <div
                style={{
                  color: tone.color,
                  fontFamily: "'Cinzel Decorative','Cinzel',serif",
                  fontSize: 19,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  textShadow: `0 0 8px ${tone.color}`,
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
