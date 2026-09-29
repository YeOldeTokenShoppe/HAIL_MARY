// Theme tokens for /hailmary — the six console palettes the page and every
// panel component draw from. Moved out of hailmary/page.js (2026-09-28) so the
// v2 fixture page and any future preview can render the same tokens without
// importing the page. Pure data: no imports, no side effects.
//
// Keys every component may rely on: bg, text, textStrong, accent, muted,
// border, borderLight, panelBg, headerBg, inputBg, barBg, tintBg, green,
// greenBg, warn, red, gold, goldBorder, btnText, btnBg. The rest are optional
// per theme (panelWash, panelLine, statWash, softShadow, titleCool, map*, select*).

export const THEMES = {
  light: {
    bg: "#f5efe6", text: "#44392c", textStrong: "#2e2010", accent: "#5a4010",
    muted: "#6e6050", border: "#d4c8b4", borderLight: "#c8bfb0",
    panelBg: "rgba(245,239,230,0.95)", headerBg: "rgba(245,239,230,0.97)",
    inputBg: "#f0e8dc", barBg: "#e8e0d4", tintBg: "rgba(180,160,130,0.08)",
    green: "#3a7a20", greenBg: "rgba(90,138,58,0.06)",
    warn: "#903820", red: "#b03030",
    gold: "#d4a854", goldBorder: "#b8922e",
    scanline: "rgba(0,0,0,0.02)",
    statusText: "#4a6a30", seedLabel: "#5e5040", seedValue: "#5e5040",
    rankClaim: "#504030", rankOil: "#44392c", rankBarBg: "#e0d8cc",
    inspectorKey: "#5e5040", depthUndrilled: "#7e7560",
    btnText: "#504030", btnBg: "rgba(180,160,130,0.1)",
    cornerBorder: "rgba(139,105,20,0.3)",
  },
  // Dusk (golden hour) — the light console warmed to terracotta and rose.
  // BENCHED 2026-08-29 while the restored Geode theme (below) trials as the
  // dusk console; kept intact so switching back is a one-line themeKey change.
  duskLight: {
    bg: "#f4e6d6", text: "#503c38", textStrong: "#2e1e1a", accent: "#a34a2e",
    muted: "#7a6258", border: "#dcc0a8", borderLight: "#d0b8a4",
    panelBg: "rgba(244,230,214,0.95)", headerBg: "rgba(244,230,214,0.97)",
    inputBg: "#eeded0", barBg: "#e6d4c2", tintBg: "rgba(196,150,110,0.1)",
    green: "#3f7a2a", greenBg: "rgba(90,138,58,0.07)",
    warn: "#96421e", red: "#b03a28",
    gold: "#d49a4a", goldBorder: "#b8823a",
    scanline: "rgba(60,20,0,0.025)",
    statusText: "#5a6a30", seedLabel: "#6a544a", seedValue: "#6a544a",
    rankClaim: "#5a4438", rankOil: "#503c38", rankBarBg: "#e4d2be",
    inspectorKey: "#6a544a", depthUndrilled: "#8a7060",
    btnText: "#5a4438", btnBg: "rgba(196,150,110,0.12)",
    cornerBorder: "rgba(163,74,46,0.32)",
    panelWash: "linear-gradient(135deg, rgba(255,246,234,0.72) 0%, rgba(250,224,198,0.85) 48%, rgba(238,202,190,0.62) 100%)",
    panelLine: "linear-gradient(90deg, rgba(163,74,46,0.02), rgba(163,74,46,0.16), rgba(212,154,74,0.18), rgba(163,74,46,0.02))",
    statWash: "linear-gradient(135deg, rgba(255,246,230,0.7), rgba(248,214,170,0.22) 55%, rgba(202,142,150,0.12))",
    softShadow: "inset 0 1px 0 rgba(255,252,244,0.7), 0 10px 28px rgba(150,90,40,0.09)",
    // Survey-map paper takes the sunset tint (same mechanism as solsticeLight).
    mapBg: "#f0dcc4", mapEmpty: "#f8ecda",
  },
  // Geode — restored 2026-08-29 from commit 6d4da7ba^ (cut with the old
  // GeodeMode toggle) and now serving as the DUSK console. Mirrors the
  // SpaceScene prospecting-Geode palette: gold/cyan/orange accents floating on
  // a translucent indigo-black panel. Cyan rides on the `green` token (status +
  // positive readouts); orange rides on `warn`.
  Geode: {
    bg: "#0f141c", text: "#aebccb", textStrong: "#e8d9b8", accent: "#d4a854",
    muted: "#7e94a6", border: "rgba(107,199,209,0.24)", borderLight: "rgba(107,199,209,0.14)",
    panelBg: "rgba(15,22,30,0.08)", headerBg: "rgba(13,19,27,0.66)",
    inputBg: "rgba(22,32,42,0.5)", barBg: "rgba(107,199,209,0.12)", tintBg: "rgba(107,199,209,0.06)",
    green: "#6bc7d1", greenBg: "rgba(107,199,209,0.12)",
    warn: "#e87a2b", red: "#e0563c",
    gold: "#d4a854", goldBorder: "#b8922e",
    scanline: "rgba(107,199,209,0.04)",
    statusText: "#6bc7d1", seedLabel: "#7e94a6", seedValue: "#9fc4cf",
    rankClaim: "#8aa0b0", rankOil: "#cbd9e2", rankBarBg: "rgba(107,199,209,0.14)",
    inspectorKey: "#7e94a6", depthUndrilled: "#3a4754",
    btnText: "#bfe0e6", btnBg: "rgba(107,199,209,0.1)",
    cornerBorder: "rgba(107,199,209,0.32)",
    // Cool frosted-glass panel — a cyan-led wash with a gold counterpoint, a
    // cyan/gold accent line, and a cream top-highlight. The low panel opacity
    // lets the sunset bleed through as colored glass, not an opaque brown slab.
    titleCool: "#6bc7d1", titleCoolBorder: "rgba(107,199,209,0.7)",
    panelWash: "linear-gradient(160deg, rgba(107,199,209,0.10) 0%, rgba(170,210,220,0.03) 50%, rgba(212,168,84,0.06) 100%)",
    panelLine: "linear-gradient(90deg, rgba(107,199,209,0.05), rgba(107,199,209,0.40), rgba(212,168,84,0.34), rgba(107,199,209,0.05))",
    statWash: "linear-gradient(150deg, rgba(107,199,209,0.08), rgba(15,22,30,0.16) 55%, rgba(212,168,84,0.05))",
    softShadow: "inset 0 1px 0 rgba(190,224,230,0.10), 0 10px 30px rgba(0,0,0,0.4)",
    // Selection highlight FILL — arcane violet (the cyan border stays via t.green).
    // Used by the surface map + cross-section selected column.
    selectFill: "rgba(176,123,255,0.5)",
    selectOverlay: "rgba(176,123,255,0.22)",
    selectHatch: "rgba(176,123,255,0.45)",
  },
  dark: {
    bg: "#12161c", text: "#b0bcc8", textStrong: "#d4dce4", accent: "#d4a854",
    muted: "#6a7888", border: "#242c38", borderLight: "#1e2630",
    panelBg: "rgba(18,22,28,0.95)", headerBg: "rgba(18,22,28,0.97)",
    inputBg: "#1a2028", barBg: "#1e2630", tintBg: "rgba(80,120,160,0.06)",
    green: "#6aaa6a", greenBg: "rgba(90,138,90,0.1)",
    warn: "#cc7755", red: "#e06060",
    gold: "#d4a854", goldBorder: "#b8922e",
    scanline: "rgba(255,255,255,0.02)",
    statusText: "#7aaa7a", seedLabel: "#6a7888", seedValue: "#7a8898",
    rankClaim: "#8a98a8", rankOil: "#b0bcc8", rankBarBg: "#242c38",
    inspectorKey: "#7a8898", depthUndrilled: "#404a58",
    btnText: "#b0bcc8", btnBg: "rgba(80,120,160,0.12)",
    cornerBorder: "rgba(212,168,84,0.2)",
  },
  solsticeLight: {
    bg: "#f6edce", text: "#4c422e", textStrong: "#241b0c", accent: "#0c7786",
    muted: "#756c55", border: "rgba(156,132,72,0.42)", borderLight: "rgba(78,177,190,0.28)",
    panelBg: "rgba(255,248,222,0.91)", headerBg: "rgba(255,246,215,0.95)",
    inputBg: "rgba(255,253,236,0.82)", barBg: "rgba(210,190,128,0.24)", tintBg: "rgba(47,168,188,0.075)",
    green: "#2f8f55", greenBg: "rgba(47,143,85,0.1)",
    warn: "#b46618", red: "#b64230",
    gold: "#e0ad3c", goldBorder: "#b98218",
    scanline: "rgba(17,109,126,0.025)",
    statusText: "#2f8f55", seedLabel: "#7b693d", seedValue: "#0c7786",
    rankClaim: "#776843", rankOil: "#4c422e", rankBarBg: "rgba(217,196,128,0.32)",
    inspectorKey: "#7b693d", depthUndrilled: "#9e9066",
    btnText: "#315b5f", btnBg: "rgba(47,168,188,0.1)",
    cornerBorder: "rgba(12,119,134,0.35)",
    panelWash: "linear-gradient(135deg, rgba(255,255,245,0.72) 0%, rgba(255,244,199,0.88) 48%, rgba(219,246,231,0.68) 100%)",
    panelLine: "linear-gradient(90deg, rgba(12,119,134,0.02), rgba(12,119,134,0.18), rgba(224,173,60,0.18), rgba(12,119,134,0.02))",
    statWash: "linear-gradient(135deg, rgba(255,255,241,0.72), rgba(255,232,162,0.2) 55%, rgba(83,188,198,0.12))",
    softShadow: "inset 0 1px 0 rgba(255,255,255,0.72), 0 10px 28px rgba(151,116,29,0.08)",
    // Surface-map / cross-section backgrounds — light cyan to match the teal
    // accent font (instead of the default cream). mapBg = container, mapEmpty =
    // undrilled/empty cells. Other themes leave these unset → cream fallback.
    mapBg: "#cfe9eb", mapEmpty: "#e3f4f4",
  },
  // Parabolum (dark) — arcane violet reskin. The "extracted material" stops
  // reading as crude oil and becomes a mysterious glowing fluid; the prospecting
  // UI shifts to a deep-indigo console lit by violet/lilac glow. Independent of
  // the day/dusk/night/hell env presets (toggled separately from time-of-day).
  parabolumDark: {
    bg: "#0c0717", text: "#b9a3d6", textStrong: "#e6d4ff", accent: "#b07bff",
    muted: "#7a6a9c", border: "#2a1d44", borderLight: "#221836",
    panelBg: "rgba(14,8,26,0.95)", headerBg: "rgba(14,8,26,0.97)",
    inputBg: "#1a1030", barBg: "#1e1436", tintBg: "rgba(123,45,214,0.1)",
    green: "#5ad6b0", greenBg: "rgba(90,214,176,0.12)",
    warn: "#e0913c", red: "#ff5c93",
    gold: "#c79bff", goldBorder: "#7b2dd6",
    scanline: "rgba(199,123,255,0.035)",
    statusText: "#8ad6c0", seedLabel: "#8a7aae", seedValue: "#a892c8",
    rankClaim: "#a892c8", rankOil: "#c9b3e6", rankBarBg: "#241836",
    inspectorKey: "#8a7aae", depthUndrilled: "#4a3a66",
    btnText: "#c9b3e6", btnBg: "rgba(123,45,214,0.16)",
    cornerBorder: "rgba(164,92,255,0.3)",
  },
};

// ── HUD palettes: the /space telemetry-panel look, tuned per theme ───────────
// (Michelle, 2026-09-29: the fixed /space palette clashed with the light
// consoles.) The card stays a dark "instrument screen" on every theme — that is
// the vibrancy — but its glass is the theme's own ink, the brackets are the
// theme's gold, and the data colour is a bright that belongs to the theme
// (teal on the warm paper consoles, echoing the survey map's BTR swatch; cyan
// on the blue consoles; mint on the violet one). `hudFor(theme)` in HmHud.jsx
// merges these over the /space defaults, so a theme without a block still
// renders. Keys: panel (glass), panelSolid (capture background), cream (text),
// muted, data, dataDim (glow), warn, green, violet (a rival's mark), red, gold,
// goldDim, goldFaint.
export const THEME_HUD = {
  light: {
    panel: "rgba(46,32,16,0.92)", panelSolid: "#2e2010", cream: "#f5efe6", muted: "#b9a88e",
    data: "#5fd3c4", dataDim: "rgba(95,211,196,0.7)", warn: "#ff9a3c", green: "#7fe07a", violet: "#d3a0ff", red: "#ff5e4a",
    gold: "#d4a854", goldDim: "rgba(212,168,84,0.6)", goldFaint: "rgba(212,168,84,0.22)",
  },
  duskLight: {
    panel: "rgba(46,30,26,0.92)", panelSolid: "#2e1e1a", cream: "#f4e6d6", muted: "#bfa593",
    data: "#6fd6c5", dataDim: "rgba(111,214,197,0.7)", warn: "#ff8a4a", green: "#86e07f", violet: "#d9a3ff", red: "#ff5e4a",
    gold: "#d49a4a", goldDim: "rgba(212,154,74,0.6)", goldFaint: "rgba(212,154,74,0.22)",
  },
  Geode: {
    panel: "rgba(18,10,22,0.65)", panelSolid: "#150c1c", cream: "#e8d9b8", muted: "#9a8878",
    data: "#6bc7d1", dataDim: "rgba(107,199,209,0.7)", warn: "#e87a2b", green: "#37f07a", violet: "#c77dff", red: "#ff3f1f",
    gold: "#d4a854", goldDim: "rgba(212,168,84,0.55)", goldFaint: "rgba(212,168,84,0.18)",
  },
  dark: {
    panel: "rgba(18,22,28,0.85)", panelSolid: "#12161c", cream: "#d4dce4", muted: "#8a96a2",
    data: "#6bc7d1", dataDim: "rgba(107,199,209,0.7)", warn: "#e87a2b", green: "#6adf8a", violet: "#c77dff", red: "#ff5a5a",
    gold: "#d4a854", goldDim: "rgba(212,168,84,0.55)", goldFaint: "rgba(212,168,84,0.18)",
  },
  solsticeLight: {
    panel: "rgba(36,27,12,0.92)", panelSolid: "#241b0c", cream: "#f6edce", muted: "#b8a887",
    data: "#4fd1e0", dataDim: "rgba(79,209,224,0.7)", warn: "#ffb347", green: "#7fe08a", violet: "#d3a0ff", red: "#ff5e4a",
    gold: "#e0ad3c", goldDim: "rgba(224,173,60,0.6)", goldFaint: "rgba(224,173,60,0.22)",
  },
  parabolumDark: {
    panel: "rgba(14,8,26,0.85)", panelSolid: "#0e081a", cream: "#e6d4ff", muted: "#8f7aac",
    data: "#5ad6b0", dataDim: "rgba(90,214,176,0.7)", warn: "#e0913c", green: "#5ad6b0", violet: "#ff5c93", red: "#ff3f1f",
    gold: "#c79bff", goldDim: "rgba(199,155,255,0.6)", goldFaint: "rgba(199,155,255,0.22)",
  },
};

