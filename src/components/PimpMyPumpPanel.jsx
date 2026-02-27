"use client";

import { useState, useCallback, useMemo } from "react";

// ── Zone definitions ─────────────────────────────────────────────────────────
export const PUMP_ZONES = [
  { id: "pad",           label: "PAD",            meshes: ["ground", "ground001"] },
  { id: "foundation",    label: "FOUNDATION",     meshes: ["Under_Pump", "Bottom_Box"] },
  { id: "motorBox",      label: "MOTOR BOX",      meshes: ["Cube", "Wheel_Box"] },
  { id: "crankWheel",    label: "CRANK WHEEL",    meshes: ["Wheel_Back"] },
  { id: "beam",          label: "WALKING BEAM",   meshes: ["Body_Pump"] },
  { id: "counterweight", label: "COUNTERWEIGHTS", meshes: ["Cylinder_Pump", "Cylinder_Pump001"] },
  { id: "horseHead",     label: "HORSE HEAD",     meshes: ["Head_Pump"] },
  { id: "drillPipe",     label: "DRILL PIPE",     meshes: ["Straw", "Cylinder"] },
  { id: "machinePanel",  label: "MACHINE PANEL",  meshes: ["MachinePanel"] },
  { id: "tankScaffold",  label: "TANK SCAFFOLD",  meshes: ["Fuel_Tank_Scaffold"] },
  { id: "signFrame",     label: "SIGN FRAME",     meshes: ["SignFrame", "SignFrame001"] },
  { id: "pipes",          label: "PIPES",           meshes: ["Pipe_01", "Pipe_02", "Pipe_03", "Pipe_Refinery"] },
];

export const MATERIAL_PRESETS = {
  stock:    { label: "STOCK",         roughness: null,  metalness: null, emissive: null,     emissiveIntensity: 0, envMapIntensity: 0 },
  matte:    { label: "MATTE",         roughness: 0.92,  metalness: 0.05, emissive: "#000000", emissiveIntensity: 0, envMapIntensity: 0.1 },
  chrome:   { label: "CHROME",        roughness: 0.0,   metalness: 1.0,  emissive: "#8b8787", emissiveIntensity: 0, envMapIntensity: 3.0, useStandard: true },
  brushed:  { label: "BRUSHED STEEL", roughness: 0.3,   metalness: 0.8,  emissive: "#000000", emissiveIntensity: 0, envMapIntensity: 2.0 },
  rust:     { label: "RUST",          roughness: 0.95,  metalness: 0.2,  emissive: "#000000", emissiveIntensity: 0, envMapIntensity: 0.3 },
  gold:     { label: "GOLD",          roughness: 0.15,  metalness: 0.9,  emissive: "#000000", emissiveIntensity: 0, envMapIntensity: 2.5 },
  neon:     { label: "NEON GLOW",     roughness: 0.5,   metalness: 0.1,  emissive: "auto",   emissiveIntensity: 1.5, envMapIntensity: 0.5 },
};

// ── Add-on catalog & slot positions ──────────────────────────────────────────
export const ADDON_CATALOG = [
  { id: "gravestone",      label: "GRAVESTONE",       color: "#555555", shape: "cross",    model: "/models/addons/gravestone.glb" },
  { id: "skeleton",      label: "HOME DEPOT SKELETON",       color: "#e8dcc8", shape: "cylinder", model: "/models/addons/HDSkeleton.glb" },
  { id: "flamingo",      label: "PINK FLAMINGO",  color: "#ff69b4", shape: "cone",     model: "/models/addons/pinkFlamingo.glb" },
  { id: "bearTrap",      label: "BEAR TRAP",      color: "#888888", shape: "box",      model: "/models/addons/bearTrap.glb" },
  // { id: "dinosaur",      label: "DINOSAUR",       color: "#6b8e23", shape: "cone",     model: "/models/addons/dinosaur.glb" },
  { id: "goldRocks",     label: "GOLD ROCKS",     color: "#ffd700", shape: "sphere",   model: "/models/addons/goldRocks.glb" },
  { id: "palmTree",      label: "PALM TREE",      color: "#2d8a4e", shape: "cylinder", model: "/models/addons/palmTree.glb" },
  { id: "pumpkinPatch",  label: "PUMPKIN PATCH",  color: "#e87530", shape: "sphere",   model: "/models/addons/pumpkinPatch.glb" },
  // { id: "tubeMan",      label: "TUBE MAN",      color: "#cc3333", shape: "sphere",   model: "/models/addons/tubeMan.glb", animated: "tubeMan" },
  { id: "sunflowers",      label: "SUNFLOWERS",      color: "#ffd700", shape: "cone",   model: "/models/addons/Sunflowers.glb" },
  { id: "gnome",      label: "GARDEN GNOME",      color: "#33c2ccff", shape: "cone",   model: "/models/addons/gnome.glb" },
  // { id: "neonSign",      label: "NEON SIGN",      color: "#ff00ff", shape: "box",      emissive: true },
  // { id: "gnome",         label: "GARDEN GNOME",   color: "#33a1ccff", shape: "cone" },
  // { id: "cactus",        label: "COOL CACTUS",    color: "#2d8a4e", shape: "cylinder" },
  // { id: "flowers",       label: "POTTED FLOWERS", color: "#ff69b4", shape: "sphere" },
  // { id: "alienPlants",   label: "ALIEN PLANTS",   color: "#7b2ff7", shape: "cone",     emissive: true },
  // { id: "fountain",      label: "FOUNTAIN",       color: "#4488cc", shape: "cylinder" },
];

//  [0] [1] [2]
//  [3] PUMP [4]
//  [5] [6] [7]
export const ADDON_SLOTS = [
  { x: -0.25, y: 0, z:  0.25 }, // 0 front-left
  { x:  0.0,  y: 0, z:  0.25 }, // 1 front-center
  { x:  0.25, y: 0, z:  0.25 }, // 2 front-right
  { x: -0.25, y: 0, z:  0.0  }, // 3 mid-left
  { x:  0.25, y: 0, z:  0.0  }, // 4 mid-right
  { x: -0.25, y: 0, z: -0.25 }, // 5 back-left
  { x:  0.0,  y: 0, z: -0.25 }, // 6 back-center
  { x:  0.25, y: 0, z: -0.25 }, // 7 back-right
];

export const FENCE_CATALOG = [
  { id: "chainlink",    label: "CHAIN LINK",    model: "/models/addons/Fence_Chainlink.glb",    scale: 0.1 },
  { id: "iron",         label: "IRON",          model: "/models/addons/Fence_Iron.glb",         scale: 0.1 },
  { id: "whitePicket",  label: "WHITE PICKET",  model: "/models/addons/Fence_WhitePicket.glb",  scale: 0.1 },
  { id: "stone",        label: "STONE",         model: "/models/addons/Fence_Stone.glb",        scale: 0.1 },
];

const MAX_ADDONS = 3;

// Default config: all zones use stock (original model materials)
export function getDefaultPumpConfig() {
  const config = {};
  PUMP_ZONES.forEach((z) => {
    config[z.id] = { color: null, preset: "stock" };
  });
  config.signImageUrl = null;
  config.showCamera = false;
  config.showSign = false;
  config.fenceType = null;
  config.addons = {};
  return config;
}

// ── Fun preset themes (full rig presets) ─────────────────────────────────────
const THEME_PRESETS = {
  stock: { label: "FACTORY DEFAULT", build: () => getDefaultPumpConfig() },
  goldRush: {
    label: "GOLD RUSH",
    build: () => {
      const c = getDefaultPumpConfig();
      c.beam          = { color: "#FFD700", preset: "gold" };
      c.horseHead     = { color: "#FFD700", preset: "gold" };
      c.counterweight = { color: "#DAA520", preset: "gold" };
      c.crankWheel    = { color: "#B8860B", preset: "brushed" };
      c.motorBox      = { color: "#8B7355", preset: "matte" };
      c.drillPipe     = { color: "#CD853F", preset: "brushed" };
      c.machinePanel  = { color: "#8B7355", preset: "gold" };
      c.tankScaffold  = { color: "#B8860B", preset: "brushed" };
      c.signFrame     = { color: "#DAA520", preset: "gold" };
      c.pipes         = { color: "#CD853F", preset: "gold" };
      return c;
    },
  },
  murdered: {
    label: "MURDERED OUT",
    build: () => {
      const c = getDefaultPumpConfig();
      PUMP_ZONES.forEach((z) => {
        c[z.id] = { color: "#1a1a1a", preset: "chrome" };
      });
      c.pad = { color: "#0a0a0a", preset: "matte" };
      return c;
    },
  },
  cyberpunk: {
    label: "CYBERPUNK",
    build: () => {
      const c = getDefaultPumpConfig();
      c.beam          = { color: "#00e5ff", preset: "neon" };   // electric cyan — hero
      c.horseHead     = { color: "#ff2a6d", preset: "neon" };   // hot pink accent
      c.counterweight = { color: "#00e5ff", preset: "neon" };   // cyan to match beam
      c.crankWheel    = { color: "#ff2a6d", preset: "neon" };   // hot pink
      c.motorBox      = { color: "#1a1028", preset: "brushed" };// dark violet steel
      c.foundation    = { color: "#1a1028", preset: "brushed" };// dark violet steel
      c.drillPipe     = { color: "#b030ff", preset: "neon" };   // purple glow
      c.pad           = { color: "#0c0814", preset: "matte" };  // near-black violet
      c.machinePanel  = { color: "#ff2a6d", preset: "neon" };   // hot pink
      c.tankScaffold  = { color: "#1a1028", preset: "brushed" };// dark violet steel
      c.signFrame     = { color: "#00e5ff", preset: "neon" };   // cyan
      c.pipes         = { color: "#b030ff", preset: "neon" };   // purple glow
      return c;
    },
  },
  rusty: {
    label: "ABANDONED FIELD",
    build: () => {
      const c = getDefaultPumpConfig();
      c.beam          = { color: "#8B4513", preset: "rust" };
      c.horseHead     = { color: "#A0522D", preset: "rust" };
      c.counterweight = { color: "#6B3410", preset: "rust" };
      c.motorBox      = { color: "#704214", preset: "rust" };
      c.crankWheel    = { color: "#5C3317", preset: "rust" };
      c.foundation    = { color: "#4A3728", preset: "matte" };
      c.drillPipe     = { color: "#7A4A2A", preset: "rust" };
      c.pad           = { color: "#3E2723", preset: "matte" };
      c.machinePanel  = { color: "#704214", preset: "rust" };
      c.tankScaffold  = { color: "#5C3317", preset: "rust" };
      c.signFrame     = { color: "#4A3728", preset: "rust" };
      c.pipes         = { color: "#6B3410", preset: "rust" };
      return c;
    },
  },
  chrome: {
    label: "FULL CHROME",
    build: () => {
      const c = getDefaultPumpConfig();
      PUMP_ZONES.forEach((z) => {
        c[z.id] = { color: "#d8d8d8", preset: "chrome" };
      });
      c.pad = { color: "#b0b0b0", preset: "brushed" };
      c.counterweight = { color: "#e8e8e8", preset: "chrome" };
      c.horseHead = { color: "#e8e8e8", preset: "chrome" };
      c.crankWheel = { color: "#c8c8c8", preset: "chrome" };
      return c;
    },
  },
};

// ── Panel component ──────────────────────────────────────────────────────────

export default function PimpMyPumpPanel({ config, onChange, isMobile, darkMode = false, hasSelection, onSave, saving, dirty, isSignedIn, defaultExpanded = false, userId, readOnly = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activeZone, setActiveZone] = useState(null);
  const [pickerSlot, setPickerSlot] = useState(null); // which slot is picking an addon

  // Block all edits when viewing someone else's config
  if (readOnly) onChange = () => {};

  // Dark/light color tokens
  const c = darkMode ? {
    text: "#c8c0b4", textStrong: "#e8e0d4", accent: "#d4a854",
    muted: "#8a8070", border: "#444", borderLight: "#333",
    panelBg: "rgba(26,26,31,0.95)", inputBg: "#252530",
    btnText: "#c8c0b4", btnBg: "rgba(100,90,70,0.2)",
    btnBorder: "#555", activeBg: "#d4a854", activeText: "#1a1a1f",
    activeBorder: "#b8922e", hintText: "#8a8070",
    slotBg: "rgba(100,90,70,0.12)", slotBorder: "#444",
    editorBg: "rgba(100,90,70,0.08)", pickerBg: "rgba(30,30,38,0.98)",
    sectionBorder: "#444", swatchBorder: "rgba(212,168,84,0.4)",
    plusColor: "#666", pumpCellBg: "rgba(212,168,84,0.15)", pumpCellBorder: "#555",
  } : {
    text: "#504030", textStrong: "#2e2010", accent: "#5a4010",
    muted: "#6e6050", border: "#c8bfb0", borderLight: "#d4c8b4",
    panelBg: "rgba(245,239,230,0.95)", inputBg: "#f0e8dc",
    btnText: "#504030", btnBg: "rgba(180,160,130,0.1)",
    btnBorder: "#c8bfb0", activeBg: "#d4a854", activeText: "#2e2010",
    activeBorder: "#b8922e", hintText: "#6e6050",
    slotBg: "rgba(180,160,130,0.06)", slotBorder: "#d4c8b4",
    editorBg: "rgba(180,160,130,0.05)", pickerBg: "rgba(245,239,230,0.98)",
    sectionBorder: "#d4c8b4", swatchBorder: "rgba(139,105,20,0.3)",
    plusColor: "#a09080", pumpCellBg: "rgba(184,146,46,0.1)", pumpCellBorder: "#c8b080",
  };

  const rawAddons = config.addons || {};
  // Normalize: old format was string id, new format is { id, rot }
  const addons = useMemo(() => {
    const out = {};
    for (const [k, v] of Object.entries(rawAddons)) {
      out[k] = typeof v === "string" ? { id: v, rot: 0 } : v;
    }
    return out;
  }, [rawAddons]);
  const addonCount = Object.keys(addons).length;
  const isFull = addonCount >= MAX_ADDONS;

  const updateZone = useCallback((zoneId, updates) => {
    onChange({ ...config, [zoneId]: { ...config[zoneId], ...updates } });
  }, [config, onChange]);

  const applyTheme = useCallback((themeKey) => {
    const newConfig = THEME_PRESETS[themeKey].build();
    newConfig.signImageUrl = config.signImageUrl;
    newConfig.showSign = config.showSign;
    newConfig.showCamera = config.showCamera;
    newConfig.fenceType = config.fenceType;
    newConfig.addons = config.addons || {};
    newConfig.poop = config.poop || false;
    onChange(newConfig);
    setActiveZone(null);
  }, [onChange, config.signImageUrl, config.showSign, config.showCamera, config.fenceType, config.addons]);

  const sectionStyle = { ...(isMobile ? mStyles.section : styles.section), borderBottomColor: c.sectionBorder };
  const titleStyle = { ...(isMobile ? mStyles.title : styles.title), color: c.accent };
  const mFs = isMobile ? 10 : 10;   // base font for labels/buttons
  const mFsLg = isMobile ? 11 : 11; // larger font for zone names/hints

  return (
    <div style={sectionStyle}>
      {/* Header — click to expand/collapse */}
      <div
        onClick={() => setExpanded((e) => !e)}
        style={styles.header}
      >
        <h3 style={titleStyle}>
          <span style={{ ...styles.icon, color: c.activeBg }}>&#9881;</span>
          PIMP MY PUMP
        </h3>
        <span style={{ ...styles.chevron, color: c.muted }}>{expanded ? "\u25B4" : "\u25BE"}</span>
      </div>

      {expanded && (
        <div style={styles.body}>
          {!hasSelection && (
            <div style={{ ...styles.selectHint, fontSize: mFsLg, color: c.hintText }}>
              Click a rig on the grid to select it, then customize below
            </div>
          )}

          {/* Theme presets */}
          <div style={{ ...styles.themesRow, opacity: hasSelection ? 1 : 0.4, pointerEvents: hasSelection ? "auto" : "none" }}>
            <span style={{ ...styles.presetLabel, fontSize: mFs, color: c.muted }}>THEMES</span>
            <div style={styles.themeButtons}>
              {Object.entries(THEME_PRESETS).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => applyTheme(key)}
                  style={{ ...styles.themeBtn, fontSize: mFs, padding: isMobile ? "5px 10px" : "3px 7px", color: c.btnText, borderColor: c.btnBorder, background: c.btnBg }}
                  title={theme.label}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ ...styles.divider, background: c.border }} />

          {/* Accessories 2×2 grid: Sign Visibility + Sign Image | Security Cam + Fence */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: isMobile ? 10 : 6,
            opacity: hasSelection ? 1 : 0.4,
            pointerEvents: hasSelection ? "auto" : "none",
            marginBottom: 8,
          }}>
            {/* Sign visibility toggle */}
            <div>
              <span style={{ ...styles.presetLabel, fontSize: mFs, color: c.muted }}>SIGN VISIBILITY</span>
              <button
                onClick={() => onChange({ ...config, showSign: !config.showSign })}
                style={{
                  padding: isMobile ? "5px 12px" : "3px 10px",
                  background: config.showSign ? c.activeBg : c.btnBg,
                  border: `1px solid ${config.showSign ? c.activeBorder : c.btnBorder}`,
                  borderRadius: 2,
                  color: config.showSign ? c.activeText : c.btnText,
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: mFs,
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                }}
              >
                {config.showSign ? "ON" : "OFF"}
              </button>
            </div>

            {/* Sign image upload — only enabled when sign is visible */}
            <div style={{ opacity: config.showSign ? 1 : 0.35, pointerEvents: config.showSign ? "auto" : "none" }}>
              <span style={{ ...styles.presetLabel, fontSize: mFs, color: c.muted }}>SIGN IMAGE</span>
              <div style={styles.signInputWrap}>
                <label style={{ ...styles.signUploadBtn, fontSize: mFs, padding: isMobile ? "5px 10px" : "3px 7px", color: c.btnText, borderColor: c.btnBorder, background: c.btnBg }}>
                  {config.signImageUrl ? "CHANGE" : "UPLOAD"}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = URL.createObjectURL(file);
                      onChange({ ...config, signImageUrl: url });
                      e.target.value = "";
                    }}
                  />
                </label>
                {config.signImageUrl && (
                  <button
                    onClick={() => {
                      if (config.signImageUrl?.startsWith("blob:")) {
                        URL.revokeObjectURL(config.signImageUrl);
                      }
                      onChange({ ...config, signImageUrl: null });
                    }}
                    style={{ ...styles.resetBtn, fontSize: mFs, color: c.muted, borderColor: c.btnBorder }}
                  >
                    CLEAR
                  </button>
                )}
              </div>
            </div>

            {/* Security camera toggle */}
            <div>
              <span style={{ ...styles.presetLabel, fontSize: mFs, color: c.muted }}>SECURITY CAM</span>
              <button
                onClick={() => onChange({ ...config, showCamera: !config.showCamera })}
                style={{
                  padding: isMobile ? "5px 12px" : "3px 10px",
                  background: config.showCamera ? c.activeBg : c.btnBg,
                  border: `1px solid ${config.showCamera ? c.activeBorder : c.btnBorder}`,
                  borderRadius: 2,
                  color: config.showCamera ? c.activeText : c.btnText,
                  fontFamily: "'Share Tech Mono', monospace",
                  fontSize: mFs,
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                }}
              >
                {config.showCamera ? "ON" : "OFF"}
              </button>
              {config.showCamera && userId && (
                <button
                  onClick={() => window.open(`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || "OilRogueBot"}?start=${userId}`, "_blank")}
                  style={{
                    padding: isMobile ? "5px 12px" : "3px 10px",
                    background: c.btnBg,
                    border: `1px solid ${c.btnBorder}`,
                    borderRadius: 2,
                    color: c.btnText,
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: mFs,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                    marginLeft: 4,
                  }}
                >
                  LINK TELEGRAM
                </button>
              )}
            </div>

            {/* Fence selector */}
            <div>
              <span style={{ ...styles.presetLabel, fontSize: mFs, color: c.muted }}>FENCE</span>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                <button
                  onClick={() => onChange({ ...config, fenceType: null })}
                  style={{
                    padding: isMobile ? "5px 8px" : "3px 8px",
                    background: !config.fenceType ? c.activeBg : c.btnBg,
                    border: `1px solid ${!config.fenceType ? c.activeBorder : c.btnBorder}`,
                    borderRadius: 2,
                    color: !config.fenceType ? c.activeText : c.btnText,
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: mFs - 1,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                  }}
                >
                  NONE
                </button>
                {FENCE_CATALOG.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => onChange({ ...config, fenceType: f.id })}
                    style={{
                      padding: isMobile ? "5px 8px" : "3px 8px",
                      background: config.fenceType === f.id ? c.activeBg : c.btnBg,
                      border: `1px solid ${config.fenceType === f.id ? c.activeBorder : c.btnBorder}`,
                      borderRadius: 2,
                      color: config.fenceType === f.id ? c.activeText : c.btnText,
                      fontFamily: "'Share Tech Mono', monospace",
                      fontSize: mFs - 1,
                      letterSpacing: "0.1em",
                      cursor: "pointer",
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Poop cleanup */}
            {config.poop && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: mFs, color: "#a05030", fontFamily: "'Share Tech Mono', monospace", letterSpacing: "0.1em" }}>POOP DETECTED</span>
                <button
                  onClick={() => onChange({ ...config, poop: false })}
                  style={{
                    padding: isMobile ? "5px 12px" : "3px 10px",
                    background: "#a05030",
                    border: "1px solid #c06040",
                    borderRadius: 2,
                    color: "#fff",
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: mFs,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                  }}
                >
                  CLEAN UP
                </button>
              </div>
            )}
          </div>

          <div style={{ ...styles.divider, background: c.border }} />

          {/* Plot add-ons */}
          <div style={{ opacity: hasSelection ? 1 : 0.4, pointerEvents: hasSelection ? "auto" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ ...styles.presetLabel, fontSize: mFs, color: c.muted }}>PLOT ADD-ONS</span>
              <span style={{
                fontSize: mFs,
                color: isFull ? "#a05030" : c.muted,
                fontFamily: "'Share Tech Mono', monospace",
                letterSpacing: "0.1em",
              }}>
                {addonCount}/{MAX_ADDONS}
              </span>
            </div>

            {/* 3x3 slot grid */}
            <div style={addonStyles.grid}>
              {[
                [0, 1, 2],
                [3, "pump", 4],
                [5, 6, 7],
              ].map((row, ri) => (
                <div key={ri} style={addonStyles.gridRow}>
                  {row.map((cell) => {
                    if (cell === "pump") {
                      return (
                        <div key="pump" style={{ ...addonStyles.pumpCell, width: isMobile ? 48 : 44, height: isMobile ? 36 : 32, background: c.pumpCellBg, borderColor: c.pumpCellBorder, color: c.muted }}>
                          <span style={{ fontSize: isMobile ? 10 : 8, letterSpacing: "0.1em" }}>PUMP</span>
                        </div>
                      );
                    }
                    const slotKey = String(cell);
                    const addonEntry = addons[slotKey];
                    const item = addonEntry ? ADDON_CATALOG.find((c) => c.id === addonEntry.id) : null;
                    const isEmpty = !item;
                    const disabled = isEmpty && isFull;
                    const isPicking = pickerSlot === slotKey;
                    const rot = addonEntry?.rot || 0;
                    const rotLabel = ["", "90°", "180°", "270°"][rot] || "";

                    return (
                      <div
                        key={cell}
                        style={{
                          ...addonStyles.slotCell,
                          width: isMobile ? 48 : 44,
                          height: isMobile ? 36 : 32,
                          background: item
                            ? item.color + "22"
                            : isPicking
                              ? "rgba(212,168,84,0.15)"
                              : c.slotBg,
                          borderColor: item
                            ? item.color + "66"
                            : isPicking
                              ? c.activeBorder
                              : c.slotBorder,
                          cursor: disabled ? "default" : "pointer",
                          opacity: disabled ? 0.35 : 1,
                          position: "relative",
                        }}
                        title={item ? `${item.label} (click to remove)` : disabled ? "Max 3 add-ons" : "Click to add"}
                      >
                        {item ? (
                          <>
                            <div
                              onClick={() => {
                                const next = { ...addons };
                                delete next[slotKey];
                                onChange({ ...config, addons: next });
                              }}
                              style={{ display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer" }}
                            >
                              <div style={{
                                width: 8, height: 8, borderRadius: "50%",
                                background: item.color,
                                boxShadow: item.emissive ? `0 0 4px ${item.color}` : "none",
                              }} />
                              <span style={{ fontSize: isMobile ? 8 : 7, color: c.text, lineHeight: 1 }}>
                                {item.label.split(" ").pop()}
                              </span>
                            </div>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextRot = (rot + 1) % 4;
                                onChange({ ...config, addons: { ...addons, [slotKey]: { ...addonEntry, rot: nextRot } } });
                              }}
                              style={{
                                position: "absolute",
                                bottom: 0,
                                right: 0,
                                fontSize: 8,
                                color: c.muted,
                                cursor: "pointer",
                                padding: "0 2px",
                                lineHeight: 1,
                              }}
                              title={`Rotate (${rot * 90}°)`}
                            >
                              &#8635;
                            </div>
                          </>
                        ) : (
                          <div
                            onClick={() => {
                              if (disabled) return;
                              setPickerSlot(isPicking ? null : slotKey);
                            }}
                            style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", cursor: disabled ? "default" : "pointer" }}
                          >
                            <span style={{ fontSize: isMobile ? 14 : 12, color: c.plusColor }}>+</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Item picker dropdown */}
            {pickerSlot !== null && (
              <div style={{ ...addonStyles.picker, background: c.pickerBg, borderColor: c.pumpCellBorder }}>
                <div style={{ fontSize: mFs, color: c.muted, letterSpacing: "0.1em", marginBottom: 4 }}>
                  SELECT ITEM FOR SLOT {pickerSlot}
                </div>
                <div style={addonStyles.pickerList}>
                  {ADDON_CATALOG.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        onChange({ ...config, addons: { ...addons, [pickerSlot]: { id: item.id, rot: 0 } } });
                        setPickerSlot(null);
                      }}
                      style={{ ...addonStyles.pickerItem, fontSize: mFs, padding: isMobile ? "5px 8px" : "3px 6px", color: c.text }}
                    >
                      <div style={{
                        width: 10, height: 10, borderRadius: 2,
                        background: item.color, flexShrink: 0,
                        boxShadow: item.emissive ? `0 0 4px ${item.color}` : "none",
                      }} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div style={{ ...styles.divider, background: c.border }} />

          {/* Zone list */}
          <div style={{ ...styles.zoneList, opacity: hasSelection ? 1 : 0.4, pointerEvents: hasSelection ? "auto" : "none" }}>
            {PUMP_ZONES.map((zone) => {
              const zoneConfig = config[zone.id] || {};
              const isActive = activeZone === zone.id;
              const hasCustom = zoneConfig.color || zoneConfig.preset !== "stock";

              return (
                <div key={zone.id}>
                  {/* Zone row */}
                  <div
                    onClick={() => setActiveZone(isActive ? null : zone.id)}
                    style={{
                      ...styles.zoneRow,
                      background: isActive ? (darkMode ? "rgba(212,168,84,0.15)" : "rgba(212,168,84,0.12)") : "transparent",
                    }}
                  >
                    {/* Color swatch */}
                    <div
                      style={{
                        ...styles.swatch,
                        background: zoneConfig.color || (darkMode ? "#666" : "#7888a0"),
                        borderColor: c.swatchBorder,
                        boxShadow: hasCustom ? "0 0 4px rgba(184,146,46,0.5)" : "none",
                      }}
                    />
                    <span style={{ ...styles.zoneName, fontSize: mFsLg, color: c.text }}>{zone.label}</span>
                    <span style={{ ...styles.zonePreset, fontSize: mFs, color: c.muted }}>
                      {MATERIAL_PRESETS[zoneConfig.preset]?.label || "STOCK"}
                    </span>
                    <span style={{ ...styles.zoneChevron, fontSize: mFs, color: c.muted }}>{isActive ? "\u25B4" : "\u25BE"}</span>
                  </div>

                  {/* Expanded zone editor */}
                  {isActive && (
                    <div style={styles.zoneEditor}>
                      {/* Color picker */}
                      <div style={styles.editorRow}>
                        <span style={{ ...styles.editorLabel, fontSize: mFs, color: c.muted }}>COLOR</span>
                        <div style={styles.colorPickerWrap}>
                          <input
                            type="color"
                            value={zoneConfig.color || "#7888a0"}
                            onChange={(e) => updateZone(zone.id, { color: e.target.value })}
                            style={styles.colorInput}
                          />
                          <span style={styles.colorHex}>
                            {(zoneConfig.color || "STOCK").toUpperCase()}
                          </span>
                          {zoneConfig.color && (
                            <button
                              onClick={() => updateZone(zone.id, { color: null })}
                              style={styles.resetBtn}
                            >
                              RESET
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Material preset buttons */}
                      <div style={styles.editorRow}>
                        <span style={{ ...styles.editorLabel, fontSize: mFs, color: c.muted }}>FINISH</span>
                        <div style={styles.presetButtons}>
                          {Object.entries(MATERIAL_PRESETS).map(([key, preset]) => (
                            <button
                              key={key}
                              onClick={() => updateZone(zone.id, { preset: key })}
                              style={{
                                ...styles.presetBtn,
                                fontSize: mFs,
                                padding: isMobile ? "4px 8px" : "2px 5px",
                                color: c.btnText,
                                background: darkMode ? c.btnBg : "#e8edf2",
                                borderColor: c.btnBorder,
                                ...(zoneConfig.preset === key ? { background: c.activeBg, borderColor: c.activeBorder, color: c.activeText } : {}),
                              }}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Save button */}
          {isSignedIn && hasSelection && !readOnly && (
            <>
              <div style={{ ...styles.divider, background: c.border }} />
              <button
                onClick={onSave}
                disabled={saving || !dirty}
                style={{
                  ...styles.saveBtn,
                  fontSize: mFsLg,
                  padding: isMobile ? "8px 0" : "6px 0",
                  opacity: (saving || !dirty) ? 0.4 : 1,
                  cursor: (saving || !dirty) ? "default" : "pointer",
                }}
              >
                {saving ? "SAVING..." : dirty ? "SAVE SETTINGS" : "SAVED"}
              </button>
            </>
          )}
          {!isSignedIn && hasSelection && (
            <>
              <div style={{ ...styles.divider, background: c.border }} />
              <div style={{ ...styles.selectHint, fontSize: mFsLg, color: c.hintText }}>Sign in to save your customizations</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  section: {
    padding: "12px 14px",
    borderBottom: "1px solid #d4c8b4",
  },

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    userSelect: "none",
  },

  title: {
    margin: 0,
    fontSize: 11,
    fontWeight: 600,
    color: "#5a4010",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "'Share Tech Mono', monospace",
  },

  icon: {
    fontSize: 12,
    color: "#b8922e",
  },

  chevron: {
    fontSize: 10,
    color: "#9e8e78",
  },

  body: {
    marginTop: 10,
  },

  selectHint: {
    fontSize: 11,
    color: "#6e6050",
    textAlign: "center",
    padding: "8px 0 4px",
    letterSpacing: "0.06em",
    fontFamily: "'Share Tech Mono', monospace",
  },

  // Theme presets row
  themesRow: {
    marginBottom: 8,
  },

  presetLabel: {
    display: "block",
    fontSize: 10,
    color: "#6e6050",
    letterSpacing: "0.15em",
    marginBottom: 5,
    fontFamily: "'Share Tech Mono', monospace",
  },

  themeButtons: {
    display: "flex",
    flexWrap: "wrap",
    gap: 3,
  },

  themeBtn: {
    padding: "3px 7px",
    background: "rgba(180,160,130,0.1)",
    border: "1px solid #c8bfb0",
    borderRadius: 2,
    color: "#504030",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.08em",
    cursor: "pointer",
    transition: "all 0.15s",
  },

  divider: {
    height: 1,
    background: "#d4c8b4",
    margin: "8px 0",
  },

  // Zone list
  zoneList: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },

  zoneRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 4px",
    cursor: "pointer",
    borderRadius: 2,
    transition: "background 0.15s",
  },

  swatch: {
    width: 12,
    height: 12,
    borderRadius: 2,
    border: "1px solid rgba(139,105,20,0.3)",
    flexShrink: 0,
  },

  zoneName: {
    flex: 1,
    fontSize: 11,
    color: "#504030",
    letterSpacing: "0.06em",
    fontFamily: "'Share Tech Mono', monospace",
  },

  zonePreset: {
    fontSize: 10,
    color: "#6e6050",
    letterSpacing: "0.06em",
    fontFamily: "'Share Tech Mono', monospace",
  },

  zoneChevron: {
    fontSize: 10,
    color: "#6e6050",
    width: 10,
    textAlign: "center",
  },

  // Zone editor (expanded)
  zoneEditor: {
    padding: "6px 4px 8px 18px",
    background: "rgba(180,160,130,0.05)",
    borderLeft: "2px solid #d4a854",
    marginBottom: 4,
  },

  editorRow: {
    marginBottom: 6,
  },

  editorLabel: {
    display: "block",
    fontSize: 10,
    color: "#6e6050",
    letterSpacing: "0.15em",
    marginBottom: 3,
    fontFamily: "'Share Tech Mono', monospace",
  },

  colorPickerWrap: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

  colorInput: {
    width: 24,
    height: 18,
    padding: 0,
    border: "1px solid #c8bfb0",
    borderRadius: 2,
    cursor: "pointer",
    background: "none",
  },

  colorHex: {
    fontSize: 11,
    fontFamily: "'Share Tech Mono', monospace",
    color: "#504030",
    letterSpacing: "0.04em",
  },

  resetBtn: {
    padding: "1px 5px",
    background: "none",
    border: "1px solid #c8bfb0",
    borderRadius: 2,
    color: "#6e6050",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    cursor: "pointer",
    letterSpacing: "0.08em",
  },

  presetButtons: {
    display: "flex",
    flexWrap: "wrap",
    gap: 2,
  },

  presetBtn: {
    padding: "2px 5px",
    background: "#f0e8dc",
    border: "1px solid #c8bfb0",
    borderRadius: 2,
    color: "#504030",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    cursor: "pointer",
    transition: "all 0.15s",
    letterSpacing: "0.04em",
  },

  presetBtnActive: {
    background: "#d4a854",
    border: "1px solid #b8922e",
    color: "#3e2e10",
  },

  signSection: {
    marginBottom: 8,
  },

  signInputWrap: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },

  saveBtn: {
    width: "100%",
    padding: "6px 0",
    background: "#d4a854",
    border: "1px solid #b8922e",
    borderRadius: 2,
    color: "#2e2010",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    transition: "all 0.15s",
  },

  signUploadBtn: {
    padding: "3px 7px",
    background: "rgba(180,160,130,0.1)",
    border: "1px solid #b8c4ce",
    borderRadius: 2,
    color: "#3a4a58",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.08em",
    cursor: "pointer",
    transition: "all 0.15s",
  },
};

const addonStyles = {
  grid: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    marginBottom: 6,
  },
  gridRow: {
    display: "flex",
    gap: 2,
    justifyContent: "center",
  },
  pumpCell: {
    width: 36,
    height: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(184,146,46,0.1)",
    border: "1px solid #c8b080",
    borderRadius: 2,
    color: "#5a6a78",
    fontFamily: "'Share Tech Mono', monospace",
  },
  slotCell: {
    width: 36,
    height: 28,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #c4cdd6",
    borderRadius: 2,
    transition: "all 0.15s",
    fontFamily: "'Share Tech Mono', monospace",
  },
  picker: {
    background: "rgba(240,243,246,0.98)",
    border: "1px solid #c8b080",
    borderRadius: 3,
    padding: "6px 8px",
    marginTop: 4,
  },
  pickerList: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    maxHeight: 140,
    overflowY: "auto",
  },
  pickerItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 6px",
    background: "none",
    border: "1px solid transparent",
    borderRadius: 2,
    color: "#3a4a58",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 10,
    letterSpacing: "0.06em",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.1s",
  },
};

const mStyles = {
  section: {
    padding: "12px 12px",
    borderBottom: "1px solid #c4cdd6",
  },
  title: {
    ...styles.title,
    fontSize: 12,
  },
};
