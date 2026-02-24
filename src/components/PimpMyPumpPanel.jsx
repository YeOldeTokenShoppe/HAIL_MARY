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

// ── Add-on catalog & slot positions ──────────────────────────────────────────
export const ADDON_CATALOG = [
  { id: "cemetery",      label: "CEMETERY",       color: "#555555", shape: "cross",    model: "/models/addons/cemetery.glb" },
  { id: "skeleton",      label: "HOME DEPOT SKELETON",       color: "#e8dcc8", shape: "cylinder", model: "/models/addons/HDSkeleton.glb" },
  { id: "flamingo",      label: "PINK FLAMINGO",  color: "#ff69b4", shape: "cone",     model: "/models/addons/pinkFlamingo.glb" },
  { id: "bearTrap",      label: "BEAR TRAP",      color: "#888888", shape: "box",      model: "/models/addons/bearTrap.glb" },
  { id: "dinosaur",      label: "DINOSAUR",       color: "#6b8e23", shape: "cone",     model: "/models/addons/dinosaur.glb" },
  { id: "goldRocks",     label: "GOLD ROCKS",     color: "#ffd700", shape: "sphere",   model: "/models/addons/goldRocks.glb" },
  { id: "palmTree",      label: "PALM TREE",      color: "#2d8a4e", shape: "cylinder", model: "/models/addons/palmTree.glb" },
  { id: "pumpkinPatch",  label: "PUMPKIN PATCH",  color: "#e87530", shape: "sphere",   model: "/models/addons/pumpkinPatch.glb" },
  { id: "neonSign",      label: "NEON SIGN",      color: "#ff00ff", shape: "box",      emissive: true },
  { id: "gnome",         label: "GARDEN GNOME",   color: "#cc3333", shape: "cone" },
  { id: "cactus",        label: "COOL CACTUS",    color: "#2d8a4e", shape: "cylinder" },
  { id: "flowers",       label: "POTTED FLOWERS", color: "#ff69b4", shape: "sphere" },
  { id: "alienPlants",   label: "ALIEN PLANTS",   color: "#7b2ff7", shape: "cone",     emissive: true },
  { id: "fountain",      label: "FOUNTAIN",       color: "#4488cc", shape: "cylinder" },
];

//  [0] [1] [2]
//  [3] PUMP [4]
//  [5] [6] [7]
export const ADDON_SLOTS = [
  { x: -0.35, y: 0, z:  0.35 }, // 0 front-left
  { x:  0.0,  y: 0, z:  0.35 }, // 1 front-center
  { x:  0.35, y: 0, z:  0.35 }, // 2 front-right
  { x: -0.35, y: 0, z:  0.0  }, // 3 mid-left
  { x:  0.35, y: 0, z:  0.0  }, // 4 mid-right
  { x: -0.35, y: 0, z: -0.35 }, // 5 back-left
  { x:  0.0,  y: 0, z: -0.35 }, // 6 back-center
  { x:  0.35, y: 0, z: -0.35 }, // 7 back-right
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
  config.showFence = false;
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

export default function PimpMyPumpPanel({ config, onChange, isMobile, hasSelection, onSave, saving, dirty, isSignedIn, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activeZone, setActiveZone] = useState(null);
  const [pickerSlot, setPickerSlot] = useState(null); // which slot is picking an addon

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
    newConfig.addons = config.addons || {};
    onChange(newConfig);
    setActiveZone(null);
  }, [onChange, config.signImageUrl]);

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

          {/* Sign image upload */}
          <div style={{ ...styles.signSection, opacity: hasSelection ? 1 : 0.4, pointerEvents: hasSelection ? "auto" : "none" }}>
            <span style={styles.presetLabel}>SIGN IMAGE</span>
            <div style={styles.signInputWrap}>
              <label style={styles.signUploadBtn}>
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
                  style={styles.resetBtn}
                >
                  CLEAR
                </button>
              )}
            </div>
          </div>

          {/* Security camera toggle */}
          <div style={{ ...styles.signSection, opacity: hasSelection ? 1 : 0.4, pointerEvents: hasSelection ? "auto" : "none" }}>
            <span style={styles.presetLabel}>SECURITY CAM</span>
            <button
              onClick={() => onChange({ ...config, showCamera: !config.showCamera })}
              style={{
                padding: "3px 10px",
                background: config.showCamera ? "#d4a854" : "rgba(180,160,130,0.1)",
                border: `1px solid ${config.showCamera ? "#b8922e" : "#c8bfb0"}`,
                borderRadius: 2,
                color: config.showCamera ? "#3e2e10" : "#6b5b47",
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 8,
                letterSpacing: "0.1em",
                cursor: "pointer",
              }}
            >
              {config.showCamera ? "ON" : "OFF"}
            </button>
          </div>

          {/* Sign frame toggle */}
          <div style={{ ...styles.signSection, opacity: hasSelection ? 1 : 0.4, pointerEvents: hasSelection ? "auto" : "none" }}>
            <span style={styles.presetLabel}>SIGN FRAME</span>
            <button
              onClick={() => onChange({ ...config, showSign: !config.showSign })}
              style={{
                padding: "3px 10px",
                background: config.showSign ? "#d4a854" : "rgba(180,160,130,0.1)",
                border: `1px solid ${config.showSign ? "#b8922e" : "#c8bfb0"}`,
                borderRadius: 2,
                color: config.showSign ? "#3e2e10" : "#6b5b47",
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 8,
                letterSpacing: "0.1em",
                cursor: "pointer",
              }}
            >
              {config.showSign ? "ON" : "OFF"}
            </button>
          </div>

          {/* Fence toggle */}
          <div style={{ ...styles.signSection, opacity: hasSelection ? 1 : 0.4, pointerEvents: hasSelection ? "auto" : "none" }}>
            <span style={styles.presetLabel}>CHAIN FENCE</span>
            <button
              onClick={() => onChange({ ...config, showFence: !config.showFence })}
              style={{
                padding: "3px 10px",
                background: config.showFence ? "#d4a854" : "rgba(180,160,130,0.1)",
                border: `1px solid ${config.showFence ? "#b8922e" : "#c8bfb0"}`,
                borderRadius: 2,
                color: config.showFence ? "#3e2e10" : "#6b5b47",
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 8,
                letterSpacing: "0.1em",
                cursor: "pointer",
              }}
            >
              {config.showFence ? "ON" : "OFF"}
            </button>
          </div>

          <div style={styles.divider} />

          {/* Plot add-ons */}
          <div style={{ opacity: hasSelection ? 1 : 0.4, pointerEvents: hasSelection ? "auto" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={styles.presetLabel}>PLOT ADD-ONS</span>
              <span style={{
                fontSize: 7,
                color: isFull ? "#a05030" : "#9e8e78",
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
                        <div key="pump" style={addonStyles.pumpCell}>
                          <span style={{ fontSize: 6, letterSpacing: "0.1em" }}>PUMP</span>
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
                          background: item
                            ? item.color + "22"
                            : isPicking
                              ? "rgba(212,168,84,0.15)"
                              : "rgba(180,160,130,0.06)",
                          borderColor: item
                            ? item.color + "66"
                            : isPicking
                              ? "#b8922e"
                              : "#d4c8b4",
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
                              <span style={{ fontSize: 5, color: "#6b5b47", lineHeight: 1 }}>
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
                                fontSize: 6,
                                color: "#9e8e78",
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
                            <span style={{ fontSize: 8, color: "#c8bfb0" }}>+</span>
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
              <div style={addonStyles.picker}>
                <div style={{ fontSize: 7, color: "#9e8e78", letterSpacing: "0.1em", marginBottom: 4 }}>
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
                      style={addonStyles.pickerItem}
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

          {/* Save button */}
          {isSignedIn && hasSelection && (
            <>
              <div style={styles.divider} />
              <button
                onClick={onSave}
                disabled={saving || !dirty}
                style={{
                  ...styles.saveBtn,
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
              <div style={styles.divider} />
              <div style={styles.selectHint}>Sign in to save your customizations</div>
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
    color: "#3e2e10",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    transition: "all 0.15s",
  },

  signUploadBtn: {
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
    color: "#9e8e78",
    fontFamily: "'Share Tech Mono', monospace",
  },
  slotCell: {
    width: 36,
    height: 28,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #d4c8b4",
    borderRadius: 2,
    transition: "all 0.15s",
    fontFamily: "'Share Tech Mono', monospace",
  },
  picker: {
    background: "rgba(245,239,230,0.98)",
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
    color: "#6b5b47",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 7,
    letterSpacing: "0.06em",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.1s",
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
