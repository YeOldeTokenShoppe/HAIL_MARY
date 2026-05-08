"use client";
import { useEffect, useRef, useState } from "react";
import {
  DEMON_SITEPAL_CROP,
  DEMON_SITEPAL_FILTER,
  DETECTIVE_SITEPAL_CROP,
  DETECTIVE_SITEPAL_FILTER,
} from "@/components/CyborgTempleScene";

/**
 * Dev-only SitePal crop tuning panel.
 *
 * Mount when ?tune=sitepal is in the URL. Mutates each character's
 * CROP/FILTER objects in place — the per-frame compositor in
 * CyborgTempleScene reads each field every tick, so edits take effect
 * on the next frame without a reload. Values persist per-character to
 * localStorage; "Log" prints a formatted block to paste back into the
 * source.
 *
 * The active character is selected via the top-row buttons. To see
 * your edits live, click that character in the 3D scene first so the
 * SitePal swap activates and the per-frame compositor starts painting
 * onto their Face2 mesh.
 */

const STORAGE_KEY = "rl80_sitepal_crop_overrides_v2";

const CROP_FIELDS = [
  { key: "cropX", min: 0, max: 600, step: 1 },
  { key: "cropY", min: 0, max: 800, step: 1 },
  { key: "cropW", min: 1, max: 600, step: 1 },
  { key: "cropH", min: 1, max: 800, step: 1 },
  { key: "rotateZ", min: -180, max: 180, step: 1 },
  { key: "rotateX", min: -90, max: 90, step: 1 },
];

const FILTER_FIELDS = [
  { key: "saturate", min: 0, max: 300, step: 1 },
  { key: "contrast", min: 0, max: 200, step: 1 },
  { key: "brightness", min: 0, max: 200, step: 1 },
  { key: "hueRotate", min: -180, max: 180, step: 1 },
  { key: "sepia", min: 0, max: 100, step: 1 },
];

// Per-character tuning targets. Add a new entry here to wire up
// another character — the panel auto-renders a tab for each.
const CHARACTERS = [
  {
    id: "Demon",
    label: "Demon",
    crop: DEMON_SITEPAL_CROP,
    filter: DEMON_SITEPAL_FILTER,
    cropConstName: "DEMON_SITEPAL_CROP",
    filterConstName: "DEMON_SITEPAL_FILTER",
    cropDefaults: { cropX: 190, cropY: 117, cropW: 125, cropH: 180, rotateZ: 0, rotateX: 0 },
    filterDefaults: { saturate: 145, contrast: 108, brightness: 105, hueRotate: 0, sepia: 10 },
  },
  {
    id: "Detective",
    label: "Detective",
    crop: DETECTIVE_SITEPAL_CROP,
    filter: DETECTIVE_SITEPAL_FILTER,
    cropConstName: "DETECTIVE_SITEPAL_CROP",
    filterConstName: "DETECTIVE_SITEPAL_FILTER",
    cropDefaults: { cropX: 190, cropY: 117, cropW: 125, cropH: 180, rotateZ: 0, rotateX: 0 },
    filterDefaults: { saturate: 145, contrast: 108, brightness: 105, hueRotate: 0, sepia: 10 },
  },
];

export default function SitePalCropPanel() {
  const [enabled, setEnabled] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [activeId, setActiveId] = useState(CHARACTERS[0].id);
  const [, forceRender] = useState(0);
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.search.includes("tune=sitepal")) return;
    setEnabled(true);

    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      try {
        let stored = null;
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          stored = JSON.parse(raw);
        } else {
          // Migration: the v1 schema was a flat object for the Demon
          // only ({ cropX, cropY, ..., filter: {...} }). Lift it into
          // the per-character v2 shape so previously-tuned values
          // aren't lost when this panel adds the character tabs.
          const rawV1 = localStorage.getItem("rl80_sitepal_crop_overrides_v1");
          if (rawV1) {
            const v1 = JSON.parse(rawV1);
            const cropFromV1 = {};
            CROP_FIELDS.forEach(({ key }) => {
              if (typeof v1[key] === "number") cropFromV1[key] = v1[key];
            });
            stored = { Demon: { crop: cropFromV1, filter: v1.filter || {} } };
          }
        }
        if (stored) {
          CHARACTERS.forEach((c) => {
            const slice = stored[c.id];
            if (!slice) return;
            if (slice.crop) {
              CROP_FIELDS.forEach(({ key }) => {
                if (typeof slice.crop[key] === "number") c.crop[key] = slice.crop[key];
              });
            }
            if (slice.filter) {
              FILTER_FIELDS.forEach(({ key }) => {
                if (typeof slice.filter[key] === "number") c.filter[key] = slice.filter[key];
              });
            }
          });
          forceRender((n) => n + 1);
        }
      } catch {}
    }
  }, []);

  if (!enabled) return null;

  const active = CHARACTERS.find((c) => c.id === activeId) || CHARACTERS[0];

  const persist = () => {
    try {
      const out = {};
      CHARACTERS.forEach((c) => {
        const cropOut = {};
        const filterOut = {};
        CROP_FIELDS.forEach(({ key }) => { cropOut[key] = c.crop[key]; });
        FILTER_FIELDS.forEach(({ key }) => { filterOut[key] = c.filter[key]; });
        out[c.id] = { crop: cropOut, filter: filterOut };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch {}
  };

  const setCropField = (key, val) => {
    active.crop[key] = val;
    persist();
    forceRender((n) => n + 1);
  };
  const setFilterField = (key, val) => {
    active.filter[key] = val;
    persist();
    forceRender((n) => n + 1);
  };

  const reset = () => {
    Object.assign(active.crop, active.cropDefaults);
    Object.assign(active.filter, active.filterDefaults);
    persist();
    forceRender((n) => n + 1);
  };

  const logBlock = () => {
    const lines = [
      `export const ${active.cropConstName} = {`,
      ...CROP_FIELDS.map(({ key }) => `  ${key}: ${active.crop[key]},`),
      "};",
      `export const ${active.filterConstName} = {`,
      ...FILTER_FIELDS.map(({ key }) => `  ${key}: ${active.filter[key]},`),
      "};",
    ];
    // eslint-disable-next-line no-console
    console.log(lines.join("\n"));
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 8,
        right: 8,
        zIndex: 99999,
        background: "rgba(0,0,0,0.85)",
        color: "#cffafe",
        font: "11px/1.3 ui-monospace, monospace",
        padding: collapsed ? "4px 8px" : "8px 10px",
        border: "1px solid rgba(0,255,255,0.25)",
        borderRadius: 6,
        minWidth: collapsed ? 0 : 260,
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        userSelect: "none",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", marginBottom: collapsed ? 0 : 6 }}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span style={{ letterSpacing: "0.1em", textTransform: "uppercase", color: "#7dd3fc" }}>
          // sitepal crop
        </span>
        <span style={{ marginLeft: 12, opacity: 0.7 }}>{collapsed ? "+" : "−"}</span>
      </div>
      {!collapsed && (
        <>
          {/* Character tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
            {CHARACTERS.map((c) => {
              const isActive = c.id === activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  style={{
                    flex: 1,
                    background: isActive ? "rgba(0,255,255,0.25)" : "rgba(255,255,255,0.05)",
                    color: isActive ? "#fff" : "#a5f3fc",
                    border: `1px solid ${isActive ? "rgba(0,255,255,0.6)" : "rgba(255,255,255,0.1)"}`,
                    borderRadius: 3,
                    padding: "3px 0",
                    font: "11px/1.3 ui-monospace, monospace",
                    cursor: "pointer",
                    letterSpacing: "0.05em",
                  }}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          {CROP_FIELDS.map(({ key, min, max, step }) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ width: 70, color: "#a5f3fc" }}>{key}</span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={active.crop[key]}
                onChange={(e) => setCropField(key, Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={active.crop[key]}
                onChange={(e) => setCropField(key, Number(e.target.value))}
                style={numInputStyle}
              />
            </div>
          ))}
          <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px dashed rgba(0,255,255,0.15)", color: "#7dd3fc", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
            // color
          </div>
          {FILTER_FIELDS.map(({ key, min, max, step }) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ width: 70, color: "#a5f3fc" }}>{key}</span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={active.filter[key]}
                onChange={(e) => setFilterField(key, Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={active.filter[key]}
                onChange={(e) => setFilterField(key, Number(e.target.value))}
                style={numInputStyle}
              />
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={logBlock} style={btn}>Log</button>
            <button onClick={reset} style={btn}>Reset</button>
          </div>
        </>
      )}
    </div>
  );
}

const numInputStyle = {
  width: 56,
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 3,
  padding: "1px 4px",
  font: "11px/1.3 ui-monospace, monospace",
};

const btn = {
  flex: 1,
  background: "rgba(0,255,255,0.08)",
  color: "#cffafe",
  border: "1px solid rgba(0,255,255,0.3)",
  borderRadius: 3,
  padding: "3px 0",
  font: "11px/1.3 ui-monospace, monospace",
  cursor: "pointer",
};
