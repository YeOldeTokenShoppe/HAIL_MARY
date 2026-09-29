"use client";

// ── HM HUD kit — the /space telemetry-panel language for /hailmary cards ─────
// Michelle (2026-09-28/29): "the displays from /space still look better". This
// is that panel's chrome (SpaceScene.jsx → Goo Analysis Overlay, itself a copy
// of the home page's .prospecting-banner) lifted into small pieces the game's
// cards can share: dark glass, gold corner brackets, Orbitron title, Share Tech
// Mono body in the four line voices (label · data · warn · note), the gradient
// divider, the two-big-stats row and the clipped-corner button.
//
// Fixed palette by design — it is the same in every console theme, and it is
// PNG-safe for the share capture. Sizes are rem so the card scales with the
// page; the /space panel runs 0.5–0.65rem body, 1.05rem title.

export const HUD = {
  gold: "#d4a854",
  goldBright: "#e8c070",
  goldDim: "rgba(212, 168, 84, 0.55)",
  goldFaint: "rgba(212, 168, 84, 0.18)",
  cream: "#e8d9b8",
  muted: "#9a8878",
  panelBg: "rgba(18, 10, 22, 0.65)",
  panelSolid: "#150c1c", // capture background (backdrop-filter does not rasterise)
  orange: "#e87a2b",
  cyan: "#6bc7d1",
  cyanDim: "rgba(107, 199, 209, 0.7)",
  green: "#37f07a",
  violet: "#c77dff",
  red: "#ff3f1f",
};

export const HUD_MONO = '"Share Tech Mono", monospace';
export const HUD_DISPLAY = '"Orbitron", sans-serif';

/* Gold corner bracket — positioned absolutely inside the panel. */
export function Bracket({ position, size = 12, thickness = 2 }) {
  const posStyle = {
    tl: { top: -1, left: -1 }, tr: { top: -1, right: -1 },
    bl: { bottom: -1, left: -1 }, br: { bottom: -1, right: -1 },
  }[position];
  const isTop = position.startsWith("t");
  const isLeft = position.endsWith("l");
  return (
    <span style={{ position: "absolute", width: size, height: size, pointerEvents: "none", ...posStyle }}>
      <span style={{ position: "absolute", [isTop ? "top" : "bottom"]: 0, [isLeft ? "left" : "right"]: 0, width: size, height: thickness, background: HUD.gold }} />
      <span style={{ position: "absolute", [isTop ? "top" : "bottom"]: 0, [isLeft ? "left" : "right"]: 0, width: thickness, height: size, background: HUD.gold }} />
    </span>
  );
}

/* The glass panel with its four brackets. `solid` swaps the glass for the
   capture background (html2canvas cannot rasterise backdrop-filter). */
export function HudPanel({ children, style, solid = false, innerRef }) {
  return (
    <div ref={innerRef} style={{
      position: "relative",
      padding: "0.95rem 1.1rem 0.85rem",
      background: solid ? HUD.panelSolid : HUD.panelBg,
      border: `1px solid ${HUD.goldFaint}`,
      backdropFilter: solid ? undefined : "blur(6px) saturate(140%)",
      WebkitBackdropFilter: solid ? undefined : "blur(6px) saturate(140%)",
      boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 20px 40px -10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(212,168,84,0.08)",
      transform: "translateZ(0)",
      isolation: "isolate",
      ...style,
    }}>
      <Bracket position="tl" /><Bracket position="tr" /><Bracket position="bl" /><Bracket position="br" />
      {children}
    </div>
  );
}

/* Meta row: "07/47 // SPECIMEN ANALYSIS" left, a status lamp right. */
export function HudMeta({ index, label, status = "LIVE", lamp = HUD.orange, blink = true }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      fontFamily: HUD_MONO, fontSize: "0.52rem", letterSpacing: "0.18em", color: HUD.goldDim, textTransform: "uppercase",
      paddingBottom: "0.55rem", marginBottom: "0.7rem", borderBottom: `1px solid ${HUD.goldFaint}`,
    }}>
      <span>
        {index && <span style={{ color: HUD.cyan, textShadow: `0 0 6px ${HUD.cyanDim}` }}>{index}</span>}
        {index ? " // " : ""}{label}
      </span>
      {status && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", color: HUD.gold }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: lamp, boxShadow: `0 0 4px ${lamp}, 0 0 8px ${lamp}80`, animation: blink ? "gooCursorBlink 1.6s ease-in-out infinite" : "none" }} />
          {status}
        </span>
      )}
    </div>
  );
}

/* Title + subtitle. */
export function HudTitle({ title = <>HAIL MARY<br />PROSPECTING CO.</>, subtitle }) {
  return (
    <>
      <h2 style={{ margin: "0 0 0.35rem", fontFamily: HUD_DISPLAY, fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.15, letterSpacing: "0.08em", color: HUD.cream, textShadow: "0 0 14px rgba(212,168,84,0.2)" }}>
        {title}
      </h2>
      {subtitle && (
        <div style={{ fontFamily: HUD_MONO, fontSize: "0.58rem", letterSpacing: "0.15em", color: HUD.gold, textTransform: "uppercase", marginBottom: "0.7rem" }}>{subtitle}</div>
      )}
    </>
  );
}

/* Tab strip: [{ id, label }], active id, onSelect. */
export function HudTabs({ tabs, active, onSelect }) {
  return (
    <div style={{ display: "flex", marginBottom: "0.7rem", border: `1px solid ${HUD.goldFaint}`, fontFamily: HUD_MONO, fontSize: "0.58rem", letterSpacing: "0.18em", textTransform: "uppercase", userSelect: "none" }}>
      {tabs.map((t, i) => {
        const isActive = t.id === active;
        return (
          <button key={t.id} onClick={() => onSelect && onSelect(t.id)} style={{
            flex: 1, padding: "0.4rem 0", border: "none", borderRight: i < tabs.length - 1 ? `1px solid ${HUD.goldFaint}` : "none",
            background: isActive ? "rgba(107,199,209,0.14)" : "transparent", color: isActive ? HUD.cyan : HUD.muted,
            textShadow: isActive ? `0 0 6px ${HUD.cyanDim}` : "none", fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit", textTransform: "inherit",
            cursor: isActive ? "default" : "pointer", transition: "background 0.25s ease, color 0.25s ease",
          }}>{t.label}</button>
        );
      })}
    </div>
  );
}

export function HudDivider({ margin = "0 0 0.6rem" }) {
  return <div style={{ height: 1, background: `linear-gradient(to right, transparent, ${HUD.goldFaint} 15%, ${HUD.goldFaint} 85%, transparent)`, margin }} />;
}

/* One typed-body line. type: label · data · warn · note · blank · plain.
   Labels are padded to `pad` characters so "SAMPLE    HM-GOO-7741" columns
   line up in the monospace face, exactly as the /space body does. */
export function HudLine({ type = "data", label, text, pad = 10, children }) {
  if (type === "blank") return <div style={{ height: 10 }} />;
  const voice = {
    label: { color: HUD.goldDim },
    data: { color: HUD.cyan, textShadow: `0 0 6px ${HUD.cyanDim}` },
    warn: { color: HUD.orange, fontWeight: "bold", textShadow: "0 0 8px rgba(232,122,43,0.5)" },
    note: { color: HUD.muted, fontStyle: "italic" },
    plain: { color: HUD.cream },
  }[type] || {};
  const body = label != null ? `${String(label).padEnd(pad)}${text ?? ""}` : text;
  return (
    <div style={{ fontFamily: HUD_MONO, fontSize: "0.64rem", lineHeight: 1.55, letterSpacing: "0.05em", whiteSpace: label != null ? "pre-wrap" : "normal", ...voice }}>
      {body}{children}
    </div>
  );
}

/* Section caption above the stats ("RIG ID: HM-09 HORIZON — EXTRACTION BAY"). */
export function HudCaption({ children }) {
  return <div style={{ fontFamily: HUD_MONO, fontSize: "0.54rem", letterSpacing: "0.2em", color: HUD.goldDim, textTransform: "uppercase", marginBottom: "0.65rem" }}>{children}</div>;
}

/* Two (or more) big stats with a hairline between. stats: [{ value, label, color }] */
export function HudStats({ stats }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
      {stats.map((s, i) => (
        <div key={i} style={{ display: "contents" }}>
          {i > 0 && <div style={{ width: 1, height: 22, background: HUD.goldFaint, flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: HUD_DISPLAY, fontWeight: 700, fontSize: "1rem", color: s.color || HUD.cyan, letterSpacing: "0.03em", lineHeight: 1, textShadow: `0 0 8px ${(s.color || HUD.cyan)}66`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.value}</div>
            <div style={{ fontFamily: HUD_MONO, fontSize: "0.5rem", letterSpacing: "0.22em", color: HUD.muted, textTransform: "uppercase", marginTop: "0.2rem" }}>{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* The clipped-corner gold button ("Open Claim?"). No external CSS. */
export function HudButton({ children, onClick, disabled, accent = HUD.gold, style }) {
  const cut = 8;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      position: "relative", minWidth: 170, padding: "0.65rem 1.4rem", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1,
      background: "transparent", border: "none", color: accent, fontFamily: HUD_DISPLAY, fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.14em", textTransform: "uppercase",
      textShadow: `0 0 8px ${accent}66`, ...style,
    }}>
      {/* border drawn as a clipped backdrop so the corners read cut, like .cyber-btn */}
      <span aria-hidden style={{
        position: "absolute", inset: 0, background: accent, opacity: 0.9,
        clipPath: `polygon(0 0, calc(100% - ${cut}px) 0, 100% ${cut}px, 100% 100%, ${cut}px 100%, 0 calc(100% - ${cut}px))`,
      }} />
      <span aria-hidden style={{
        position: "absolute", inset: 1, background: HUD.panelSolid,
        clipPath: `polygon(0 0, calc(100% - ${cut - 1}px) 0, 100% ${cut - 1}px, 100% 100%, ${cut - 1}px 100%, 0 calc(100% - ${cut - 1}px))`,
      }} />
      <span style={{ position: "relative" }}>{children}</span>
    </button>
  );
}

/* The faint hint under a panel ("[ click panel to dismiss ]"). */
export function HudHint({ children, onClick }) {
  return (
    <div onClick={onClick} style={{ marginTop: "0.7rem", fontFamily: HUD_MONO, fontSize: "0.48rem", letterSpacing: "0.2em", color: HUD.goldDim, textAlign: "center", textTransform: "uppercase", opacity: 0.7, cursor: onClick ? "pointer" : "default" }}>
      {children}
    </div>
  );
}
