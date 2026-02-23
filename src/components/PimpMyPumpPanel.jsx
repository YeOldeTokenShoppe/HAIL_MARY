"use client";

import { useState, useCallback } from "react";

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
];

export const MATERIAL_PRESETS = {
  stock:    { label: "STOCK",         roughness: null,  metalness: null, emissive: null,     emissiveIntensity: 0, envMapIntensity: 0 },
  matte:    { label: "MATTE",         roughness: 0.92,  metalness: 0.05, emissive: "#000000", emissiveIntensity: 0, envMapIntensity: 0.1 },
  chrome:   { label: "CHROME",        roughness: 0.0,   metalness: 1.0,  emissive: "#8b8787ff", emissiveIntensity: 0, envMapIntensity: 3.0, useStandard: true },
  brushed:  { label: "BRUSHED STEEL", roughness: 0.3,   metalness: 0.8,  emissive: "#000000", emissiveIntensity: 0, envMapIntensity: 2.0 },
  rust:     { label: "RUST",          roughness: 0.95,  metalness: 0.2,  emissive: "#000000", emissiveIntensity: 0, envMapIntensity: 0.3 },
  gold:     { label: "GOLD",          roughness: 0.15,  metalness: 0.9,  emissive: "#000000", emissiveIntensity: 0, envMapIntensity: 2.5 },
  neon:     { label: "NEON GLOW",     roughness: 0.5,   metalness: 0.1,  emissive: "auto",   emissiveIntensity: 0.7, envMapIntensity: 0.3 },
};

// Default config: all zones use stock (original model materials)
export function getDefaultPumpConfig() {
  const config = {};
  PUMP_ZONES.forEach((z) => {
    config[z.id] = { color: null, preset: "stock" };
  });
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
      return c;
    },
  },
  murdered: {
    label: "MURDERED OUT",
    build: () => {
      const c = getDefaultPumpConfig();
      Object.keys(c).forEach((k) => {
        c[k] = { color: "#1a1a1a", preset: "chrome" };
      });
      c.pad = { color: "#0a0a0a", preset: "matte" };
      return c;
    },
  },
  cyberpunk: {
    label: "CYBERPUNK",
    build: () => {
      const c = getDefaultPumpConfig();
      c.beam          = { color: "#00ffcc", preset: "neon" };
      c.horseHead     = { color: "#ff00ff", preset: "neon" };
      c.counterweight = { color: "#ff3300", preset: "neon" };
      c.crankWheel    = { color: "#ffff00", preset: "neon" };
      c.motorBox      = { color: "#111111", preset: "chrome" };
      c.foundation    = { color: "#111111", preset: "matte" };
      c.drillPipe     = { color: "#0088ff", preset: "neon" };
      c.pad           = { color: "#0a0a12", preset: "matte" };
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
      return c;
    },
  },
  chrome: {
    label: "FULL CHROME",
    build: () => {
      const c = getDefaultPumpConfig();
      Object.keys(c).forEach((k) => {
        c[k] = { color: "#d8d8d8", preset: "chrome" };
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

export default function PimpMyPumpPanel({ config, onChange, isMobile, hasSelection }) {
  const [expanded, setExpanded] = useState(false);
  const [activeZone, setActiveZone] = useState(null);

  const updateZone = useCallback((zoneId, updates) => {
    onChange({ ...config, [zoneId]: { ...config[zoneId], ...updates } });
  }, [config, onChange]);

  const applyTheme = useCallback((themeKey) => {
    const newConfig = THEME_PRESETS[themeKey].build();
    onChange(newConfig);
    setActiveZone(null);
  }, [onChange]);

  const sectionStyle = isMobile ? mStyles.section : styles.section;
  const titleStyle = isMobile ? mStyles.title : styles.title;

  return (
    <div style={sectionStyle}>
      {/* Header — click to expand/collapse */}
      <div
        onClick={() => setExpanded((e) => !e)}
        style={styles.header}
      >
        <h3 style={titleStyle}>
          <span style={styles.icon}>&#9881;</span>
          PIMP MY PUMP
        </h3>
        <span style={styles.chevron}>{expanded ? "\u25B4" : "\u25BE"}</span>
      </div>

      {expanded && (
        <div style={styles.body}>
          {!hasSelection && (
            <div style={styles.selectHint}>
              Click a rig on the grid to select it, then customize below
            </div>
          )}

          {/* Theme presets */}
          <div style={{ ...styles.themesRow, opacity: hasSelection ? 1 : 0.4, pointerEvents: hasSelection ? "auto" : "none" }}>
            <span style={styles.presetLabel}>THEMES</span>
            <div style={styles.themeButtons}>
              {Object.entries(THEME_PRESETS).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => applyTheme(key)}
                  style={styles.themeBtn}
                  title={theme.label}
                >
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          <div style={styles.divider} />

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
                      background: isActive ? "rgba(212,168,84,0.12)" : "transparent",
                    }}
                  >
                    {/* Color swatch */}
                    <div
                      style={{
                        ...styles.swatch,
                        background: zoneConfig.color || "#8b7d6b",
                        boxShadow: hasCustom ? "0 0 4px rgba(184,146,46,0.5)" : "none",
                      }}
                    />
                    <span style={styles.zoneName}>{zone.label}</span>
                    <span style={styles.zonePreset}>
                      {MATERIAL_PRESETS[zoneConfig.preset]?.label || "STOCK"}
                    </span>
                    <span style={styles.zoneChevron}>{isActive ? "\u25B4" : "\u25BE"}</span>
                  </div>

                  {/* Expanded zone editor */}
                  {isActive && (
                    <div style={styles.zoneEditor}>
                      {/* Color picker */}
                      <div style={styles.editorRow}>
                        <span style={styles.editorLabel}>COLOR</span>
                        <div style={styles.colorPickerWrap}>
                          <input
                            type="color"
                            value={zoneConfig.color || "#8b7d6b"}
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
                        <span style={styles.editorLabel}>FINISH</span>
                        <div style={styles.presetButtons}>
                          {Object.entries(MATERIAL_PRESETS).map(([key, preset]) => (
                            <button
                              key={key}
                              onClick={() => updateZone(zone.id, { preset: key })}
                              style={{
                                ...styles.presetBtn,
                                ...(zoneConfig.preset === key ? styles.presetBtnActive : {}),
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
    fontSize: 9,
    fontWeight: 400,
    color: "#7a5a1a",
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
    fontSize: 9,
    color: "#9e8e78",
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
    fontSize: 7,
    color: "#9e8e78",
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
    color: "#6b5b47",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 7,
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
    fontSize: 9,
    color: "#6b5b47",
    letterSpacing: "0.06em",
    fontFamily: "'Share Tech Mono', monospace",
  },

  zonePreset: {
    fontSize: 7,
    color: "#9e8e78",
    letterSpacing: "0.06em",
    fontFamily: "'Share Tech Mono', monospace",
  },

  zoneChevron: {
    fontSize: 8,
    color: "#9e8e78",
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
    fontSize: 7,
    color: "#9e8e78",
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
    fontSize: 9,
    fontFamily: "'Share Tech Mono', monospace",
    color: "#6b5b47",
    letterSpacing: "0.04em",
  },

  resetBtn: {
    padding: "1px 5px",
    background: "none",
    border: "1px solid #c8bfb0",
    borderRadius: 2,
    color: "#9e8e78",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 7,
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
    color: "#6b5b47",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 7,
    cursor: "pointer",
    transition: "all 0.15s",
    letterSpacing: "0.04em",
  },

  presetBtnActive: {
    background: "#d4a854",
    border: "1px solid #b8922e",
    color: "#3e2e10",
  },
};

const mStyles = {
  section: {
    padding: "12px 12px",
    borderBottom: "1px solid #d4c8b4",
  },
  title: {
    ...styles.title,
  },
};
