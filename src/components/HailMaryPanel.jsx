"use client";

// Shared section chrome for the /hailmary side column. Every panel — the page's
// inline sections and the standalone components — draws its container, title
// row, chevron and icon from here, fed by the page theme, so colour, rule and
// spacing cannot drift between panels. (Six components used to carry their own
// light/dark palettes; measured in one column that gave three title colours and
// three divider colours.)

const MONO = "'Share Tech Mono', monospace";

// Style objects — also consumed by the page's getStyles()/getMobileStyles(), so
// inline sections and components share one definition.
export function panelChrome(t, isMobile = false) {
  return {
    section: {
      padding: isMobile ? "12px 12px" : "12px 14px",
      borderBottom: `1px solid ${t.border}`,
      background: t.panelLine ? `${t.panelLine} left bottom / 100% 1px no-repeat` : "transparent",
    },
    title: {
      margin: "0 0 10px",
      fontSize: 11,
      fontWeight: 600,
      color: t.titleCool || t.accent,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontFamily: MONO,
    },
  };
}

export function PanelSection({ theme, isMobile = false, tint = false, style, children }) {
  const c = panelChrome(theme, isMobile);
  return (
    <div style={{ ...c.section, ...(tint ? { background: theme.tintBg } : {}), ...style }}>
      {children}
    </div>
  );
}

// Title row. `icon` is a 24-grid line icon (PANEL_ICONS) drawn in the title
// colour. `right` renders at the far end of the row. With `onToggle` the whole
// row is the collapse control and draws the ▾/▴ chevron after `right`;
// `open` says which way. A collapsed row keeps no bottom margin.
export function PanelTitle({ theme, isMobile = false, icon, right, onToggle, open = true, style, children }) {
  const c = panelChrome(theme, isMobile);
  const toggle = typeof onToggle === "function";
  return (
    <h3
      onClick={toggle ? onToggle : undefined}
      style={{
        ...c.title,
        margin: toggle && !open ? 0 : c.title.margin,
        justifyContent: "space-between",
        cursor: toggle ? "pointer" : undefined,
        userSelect: toggle ? "none" : undefined,
        ...style,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        {icon && <PanelIcon path={icon} />}
        {children}
      </span>
      {(right || toggle) && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexShrink: 0, fontWeight: 400, letterSpacing: "0.08em", textTransform: "none" }}>
          {right}
          {toggle && <span style={{ fontSize: 10, color: theme.muted }}>{open ? "▴" : "▾"}</span>}
        </span>
      )}
    </h3>
  );
}

export function PanelIcon({ path, size = 13 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }} aria-hidden="true"
    >
      {path}
    </svg>
  );
}

// 24-grid line icons for the column's panels (lucide-style strokes). One per
// panel, all the same weight, all in the title colour — no emoji.
export const PANEL_ICONS = {
  rig: <><path d="M9 22 12 4l3 18" /><path d="M7 12h10" /><path d="M8 17h8" /><path d="M4 22h16" /></>,
  core: <><path d="M12 2v20" /><path d="M2 12h4" /><path d="M18 12h4" /><circle cx="12" cy="12" r="3" /><path d="M4.93 4.93l2.83 2.83" /><path d="M16.24 16.24l2.83 2.83" /></>,
  artifacts: <><path d="M6 3h12l4 6-10 13L2 9z" /><path d="M2 9h20" /><path d="m9 3 3 6 3-6" /></>,
  activity: <><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></>,
  leaderboard: <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></>,
  survey: <><path d="m12 2 10 5-10 5L2 7z" /><path d="m2 12 10 5 10-5" /><path d="m2 17 10 5 10-5" /></>,
  messages: <><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" /><rect x="2" y="4" width="20" height="16" rx="2" /></>,
  pump: <><rect width="16" height="6" x="2" y="2" rx="2" /><path d="M10 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect width="4" height="6" x="8" y="16" rx="1" /></>,
  dispatch: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></>,
};
