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
  // aliases the themed blocks use (THEME_HUD): the /space values by default
  panel: "rgba(18, 10, 22, 0.65)",
  data: "#6bc7d1",
  dataDim: "rgba(107, 199, 209, 0.7)",
  warn: "#e87a2b",
};

export const HUD_MONO = '"Share Tech Mono", monospace';
export const HUD_DISPLAY = '"Orbitron", sans-serif';

// ── Theme-tuned palettes (2026-09-29) ─────────────────────────────────────────
// The kit no longer hard-codes the /space colours: `hudFor(theme)` merges the
// theme's HUD block (THEME_HUD in lib/hailmaryThemes.js — a theme is matched
// by identity or by its `bg`) over the defaults above, and every piece reads
// the palette from context, so a card wraps itself in <HudPanel hud={…}> and
// the rest follows. Pass `hud` explicitly to a piece to override.
import { createContext, useContext } from "react";
import { THEMES, THEME_HUD } from "@/lib/hailmaryThemes";
const HudCtx = createContext(null);
export const useHud = (override) => override || useContext(HudCtx) || HUD;
export function hudFor(theme) {
  if (!theme) return HUD;
  let key = theme.hudKey || null;
  if (!key) for (const [k, t] of Object.entries(THEMES)) { if (t === theme || (t.bg && t.bg === theme.bg)) { key = k; break; } }
  const block = (key && THEME_HUD[key]) || theme.hud || null;
  return block ? { ...HUD, ...block } : HUD;
}

/* The lamp blink the meta row uses (the /space page defines it in its own
   <style>); render once per card so the name resolves on /hailmary too. */
export function HudKeyframes() {
  return <style>{`@keyframes gooCursorBlink { 0%, 100% { opacity: 1 } 50% { opacity: 0.35 } }`}</style>;
}

/* Small bordered action ("Take −1⚡", "Set", "Turn on") in the HUD voice. */
export function hudSmallBtn(accent, disabled = false, hud = HUD) {
  accent = accent || hud.gold;
  return {
    fontFamily: HUD_MONO, fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase", padding: "0.3rem 0.6rem", borderRadius: 2,
    cursor: disabled ? "default" : "pointer", background: "transparent", color: disabled ? hud.muted : accent, border: `1px solid ${disabled ? hud.muted : accent}`, opacity: disabled ? 0.5 : 1,
    whiteSpace: "nowrap",
  };
}

/* Gold corner bracket — positioned absolutely inside the panel. */
export function Bracket({ position, size = 12, thickness = 2, hud: hudProp }) {
  const hud = useHud(hudProp);
  const posStyle = {
    tl: { top: -1, left: -1 }, tr: { top: -1, right: -1 },
    bl: { bottom: -1, left: -1 }, br: { bottom: -1, right: -1 },
  }[position];
  const isTop = position.startsWith("t");
  const isLeft = position.endsWith("l");
  return (
    <span style={{ position: "absolute", width: size, height: size, pointerEvents: "none", ...posStyle }}>
      <span style={{ position: "absolute", [isTop ? "top" : "bottom"]: 0, [isLeft ? "left" : "right"]: 0, width: size, height: thickness, background: hud.gold }} />
      <span style={{ position: "absolute", [isTop ? "top" : "bottom"]: 0, [isLeft ? "left" : "right"]: 0, width: thickness, height: size, background: hud.gold }} />
    </span>
  );
}

/* The glass panel with its four brackets. `solid` swaps the glass for the
   capture background (html2canvas cannot rasterise backdrop-filter). */
/* `brackets={false}` + `flat` = the SECTION form (Michelle, 2026-09-29): inside a
   page section that already has a title row, the card drops its corner brackets
   and its floating shadow and sits as a quiet inset — one title, not two. */
export function HudPanel({ children, style, solid = false, innerRef, hud: hudProp, brackets = true, flat = false }) {
  const hud = useHud(hudProp);
  return (
    <HudCtx.Provider value={hud}>
    <div ref={innerRef} style={{
      position: "relative",
      padding: flat ? "0.8rem 0.95rem 0.75rem" : "0.95rem 1.1rem 0.85rem",
      background: solid ? hud.panelSolid : (hud.panel || hud.panelBg),
      border: `1px solid ${hud.goldFaint}`,
      borderRadius: flat ? 3 : 0,
      backdropFilter: solid ? undefined : "blur(6px) saturate(140%)",
      WebkitBackdropFilter: solid ? undefined : "blur(6px) saturate(140%)",
      boxShadow: flat
        ? (hud.light ? "inset 0 1px 0 rgba(255,255,255,0.45)" : `inset 0 1px 0 ${hud.goldFaint}`)
        : hud.light
          ? `0 1px 0 ${hud.goldFaint}, 0 10px 24px -14px rgba(60,40,10,0.35), inset 0 1px 0 rgba(255,255,255,0.5)`
          : `0 0 0 1px rgba(0,0,0,0.35), 0 20px 40px -10px rgba(0,0,0,0.45), inset 0 1px 0 ${hud.goldFaint}`,
      transform: "translateZ(0)",
      isolation: "isolate",
      ...style,
    }}>
      {brackets && <><Bracket position="tl" /><Bracket position="tr" /><Bracket position="bl" /><Bracket position="br" /></>}
      {children}
    </div>
    </HudCtx.Provider>
  );
}

/* The status cluster for a page section's title row ("PLOT (6, 9) · 01/20 ● LIVE"):
   what the card's meta row used to say, moved up so the section has one title.
   Drawn in the page theme, not the HUD palette — it lives in the title row. */
export function HudTitleStatus({ theme, plot, index, note, status = "LIVE", live = true }) {
  const lamp = live ? (theme?.warn || "#e87a2b") : (theme?.gold || "#d4a854");
  return (
    // Wraps piece by piece when the column is narrow (the row overlapped the
    // title on a phone-width column, 2026-09-29); each piece stays whole.
    <span style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end", rowGap: 2, columnGap: 8, color: theme?.muted, letterSpacing: "0.08em", fontWeight: 400, minWidth: 0 }}>
      {plot && <span style={{ whiteSpace: "nowrap" }}>{plot}</span>}
      {index && <span style={{ color: theme?.accent || theme?.text, whiteSpace: "nowrap" }}>{index}</span>}
      {note && <span style={{ color: theme?.accent || theme?.text, whiteSpace: "nowrap" }}>{note}</span>}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: theme?.gold, whiteSpace: "nowrap" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: lamp, boxShadow: `0 0 4px ${lamp}`, animation: live ? "gooCursorBlink 1.6s ease-in-out infinite" : "none" }} />
        {status}
      </span>
    </span>
  );
}

/* Label over value — for the narrow column beside the core cylinder, where a
   padded "SAMPLE    L1 of 20" line wraps word by word (Michelle, 2026-09-28/29).
   voice: "label" (gold caption, cream value) | "data" (cream caption, bright value). */
export function HudField({ label, value, voice = "data", color, hud: hudProp }) {
  const hud = useHud(hudProp);
  const valueColor = color || (voice === "data" ? hud.data : hud.cream);
  return (
    <div style={{ marginBottom: "0.32rem", minWidth: 0 }}>
      <div style={{ fontFamily: HUD_MONO, fontSize: "0.48rem", letterSpacing: "0.2em", textTransform: "uppercase", color: voice === "data" ? hud.muted : hud.goldDim, lineHeight: 1.3 }}>{label}</div>
      <div style={{ fontFamily: HUD_MONO, fontSize: "0.66rem", letterSpacing: "0.04em", lineHeight: 1.3, color: valueColor, textShadow: voice === "data" && !color && !hud.light ? `0 0 6px ${hud.dataDim}` : "none", overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}

/* Meta row: "07/47 // SPECIMEN ANALYSIS" left, a status lamp right. */
export function HudMeta({ index, label, status = "LIVE", lamp, blink = true, hud: hudProp }) {
  const hud = useHud(hudProp);
  const lampColor = lamp || hud.orange || hud.warn;
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      fontFamily: HUD_MONO, fontSize: "0.52rem", letterSpacing: "0.18em", color: hud.goldDim, textTransform: "uppercase",
      paddingBottom: "0.55rem", marginBottom: "0.7rem", borderBottom: `1px solid ${hud.goldFaint}`,
    }}>
      <span>
        {index && <span style={{ color: hud.data, textShadow: hud.light ? "none" : `0 0 6px ${hud.dataDim}` }}>{index}</span>}
        {index ? " // " : ""}{label}
      </span>
      {status && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", color: hud.gold }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: lampColor, boxShadow: `0 0 4px ${lampColor}, 0 0 8px ${lampColor}80`, animation: blink ? "gooCursorBlink 1.6s ease-in-out infinite" : "none" }} />
          {status}
        </span>
      )}
    </div>
  );
}

/* Title + subtitle. */
/* Title + subtitle. `title={null}` drops the heading (Michelle, 2026-09-29:
   the company name on every card was noise — the page section already names
   the card), leaving the gold line as the card's one heading. */
export function HudTitle({ title = <>HAIL MARY<br />PROSPECTING CO.</>, subtitle, hud: hudProp }) {
  const hud = useHud(hudProp);
  return (
    <>
      {title && (
        <h2 style={{ margin: "0 0 0.35rem", fontFamily: HUD_DISPLAY, fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.15, letterSpacing: "0.08em", color: hud.cream, textShadow: hud.light ? "none" : `0 0 14px ${hud.goldFaint}` }}>
          {title}
        </h2>
      )}
      {subtitle && (
        <div style={{ fontFamily: HUD_MONO, fontSize: title ? "0.58rem" : "0.66rem", letterSpacing: "0.15em", color: hud.gold, textTransform: "uppercase", marginBottom: "0.7rem", lineHeight: 1.4 }}>{subtitle}</div>
      )}
    </>
  );
}

/* Tab strip: [{ id, label }], active id, onSelect. */
/* variant "boxed" = the /space strip; "underline" = document tabs (a hairline
   under the row, the active tab underlined in the data colour) — the section
   form on the page, where a boxed strip was the last boxed thing on the card. */
export function HudTabs({ tabs, active, onSelect, hud: hudProp, variant = "boxed" }) {
  const hud = useHud(hudProp);
  if (variant === "underline") {
    return (
      <div style={{ display: "flex", gap: "1.1rem", marginBottom: "0.7rem", borderBottom: `1px solid ${hud.goldFaint}`, fontFamily: HUD_MONO, fontSize: "0.58rem", letterSpacing: "0.18em", textTransform: "uppercase", userSelect: "none" }}>
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button key={t.id} onClick={() => onSelect && onSelect(t.id)} style={{
              padding: "0.35rem 0 0.45rem", border: "none", borderBottom: `2px solid ${isActive ? hud.data : "transparent"}`, marginBottom: -1,
              background: "transparent", color: isActive ? hud.data : hud.muted, fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit", textTransform: "inherit",
              cursor: isActive ? "default" : "pointer", transition: "color 0.2s ease, border-color 0.2s ease", whiteSpace: "nowrap",
            }}>{t.label}</button>
          );
        })}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", marginBottom: "0.7rem", border: `1px solid ${hud.goldFaint}`, fontFamily: HUD_MONO, fontSize: "0.58rem", letterSpacing: "0.18em", textTransform: "uppercase", userSelect: "none" }}>
      {tabs.map((t, i) => {
        const isActive = t.id === active;
        return (
          <button key={t.id} onClick={() => onSelect && onSelect(t.id)} style={{
            flex: 1, padding: "0.4rem 0", border: "none", borderRight: i < tabs.length - 1 ? `1px solid ${hud.goldFaint}` : "none",
            background: isActive ? `${hud.data}24` : "transparent", color: isActive ? hud.data : hud.muted,
            textShadow: isActive && !hud.light ? `0 0 6px ${hud.dataDim}` : "none", fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit", textTransform: "inherit",
            cursor: isActive ? "default" : "pointer", transition: "background 0.25s ease, color 0.25s ease",
          }}>{t.label}</button>
        );
      })}
    </div>
  );
}

export function HudDivider({ margin = "0 0 0.6rem", hud: hudProp }) {
  const hud = useHud(hudProp);
  return <div style={{ height: 1, background: `linear-gradient(to right, transparent, ${hud.goldFaint} 15%, ${hud.goldFaint} 85%, transparent)`, margin }} />;
}

/* One typed-body line. type: label · data · warn · note · blank · plain.
   Labels are padded to `pad` characters so "SAMPLE    HM-GOO-7741" columns
   line up in the monospace face, exactly as the /space body does. */
export function HudLine({ type = "data", label, text, pad = 10, children, hud: hudProp }) {
  const hud = useHud(hudProp);
  if (type === "blank") return <div style={{ height: 10 }} />;
  const warnColor = hud.warn || hud.orange;
  const voice = {
    label: { color: hud.goldDim },
    data: { color: hud.data, textShadow: hud.light ? "none" : `0 0 6px ${hud.dataDim}` },
    warn: { color: warnColor, fontWeight: "bold", textShadow: hud.light ? "none" : `0 0 8px ${warnColor}80` },
    note: { color: hud.muted, fontStyle: "italic" },
    plain: { color: hud.cream },
  }[type] || {};
  const body = label != null ? `${String(label).padEnd(pad)}${text ?? ""}` : text;
  return (
    <div style={{ fontFamily: HUD_MONO, fontSize: "0.64rem", lineHeight: 1.55, letterSpacing: "0.05em", whiteSpace: label != null ? "pre-wrap" : "normal", ...voice }}>
      {body}{children}
    </div>
  );
}

/* Section caption above the stats ("RIG ID: HM-09 HORIZON — EXTRACTION BAY"). */
export function HudCaption({ children, hud: hudProp }) {
  const hud = useHud(hudProp);
  return <div style={{ fontFamily: HUD_MONO, fontSize: "0.54rem", letterSpacing: "0.2em", color: hud.goldDim, textTransform: "uppercase", marginBottom: "0.65rem" }}>{children}</div>;
}

/* Two (or more) big stats with a hairline between. stats: [{ value, label, color }] */
export function HudStats({ stats, hud: hudProp }) {
  const hud = useHud(hudProp);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
      {stats.map((s, i) => (
        <div key={i} style={{ display: "contents" }}>
          {i > 0 && <div style={{ width: 1, height: 22, background: hud.goldFaint, flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: HUD_DISPLAY, fontWeight: 700, fontSize: "1rem", color: s.color || hud.data, letterSpacing: "0.03em", lineHeight: 1, textShadow: hud.light ? "none" : `0 0 8px ${(s.color || hud.data)}66`, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.value}</div>
            <div style={{ fontFamily: HUD_MONO, fontSize: "0.5rem", letterSpacing: "0.22em", color: hud.muted, textTransform: "uppercase", marginTop: "0.2rem" }}>{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* The clipped-corner gold button ("Open Claim?"). No external CSS. */
export function HudButton({ children, onClick, disabled, accent, style, hud: hudProp }) {
  const hud = useHud(hudProp);
  accent = accent || hud.gold;
  const cut = 8;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      position: "relative", minWidth: 170, padding: "0.65rem 1.4rem", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1,
      background: "transparent", border: "none", color: accent, fontFamily: HUD_DISPLAY, fontWeight: 700, fontSize: "0.8rem", letterSpacing: "0.14em", textTransform: "uppercase",
      textShadow: hud.light ? "none" : `0 0 8px ${accent}66`, ...style,
    }}>
      {/* border drawn as a clipped backdrop so the corners read cut, like .cyber-btn */}
      <span aria-hidden style={{
        position: "absolute", inset: 0, background: accent, opacity: 0.9,
        clipPath: `polygon(0 0, calc(100% - ${cut}px) 0, 100% ${cut}px, 100% 100%, ${cut}px 100%, 0 calc(100% - ${cut}px))`,
      }} />
      <span aria-hidden style={{
        position: "absolute", inset: 1, background: hud.panelSolid,
        clipPath: `polygon(0 0, calc(100% - ${cut - 1}px) 0, 100% ${cut - 1}px, 100% 100%, ${cut - 1}px 100%, 0 calc(100% - ${cut - 1}px))`,
      }} />
      <span style={{ position: "relative" }}>{children}</span>
    </button>
  );
}

/* The faint hint under a panel ("[ click panel to dismiss ]"). */
export function HudHint({ children, onClick, hud: hudProp }) {
  const hud = useHud(hudProp);
  return (
    <div onClick={onClick} style={{ marginTop: "0.7rem", fontFamily: HUD_MONO, fontSize: "0.48rem", letterSpacing: "0.2em", color: hud.goldDim, textAlign: "center", textTransform: "uppercase", opacity: 0.7, cursor: onClick ? "pointer" : "default" }}>
      {children}
    </div>
  );
}
