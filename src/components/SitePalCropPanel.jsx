"use client";
import { useEffect, useRef, useState } from "react";
import { DEMON_SITEPAL_CROP, DEMON_SITEPAL_FILTER } from "@/components/CyborgTempleScene";

/**
 * Dev-only SitePal crop tuning panel.
 *
 * Mount when ?tune=sitepal is in the URL. Mutates DEMON_SITEPAL_CROP
 * in place — the per-frame compositor in CyborgTempleScene reads each
 * field every tick, so edits take effect on the next frame without a
 * reload. Values persist to localStorage; "Log" prints a formatted
 * block to paste back into the source.
 */

const STORAGE_KEY = "rl80_sitepal_crop_overrides_v1";

const FIELDS = [
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

export default function SitePalCropPanel() {
  const [enabled, setEnabled] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [, forceRender] = useState(0);
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.search.includes("tune=sitepal")) return;
    setEnabled(true);

    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const stored = JSON.parse(raw);
          FIELDS.forEach(({ key }) => {
            if (typeof stored[key] === "number") DEMON_SITEPAL_CROP[key] = stored[key];
          });
          if (stored.filter) {
            FILTER_FIELDS.forEach(({ key }) => {
              if (typeof stored.filter[key] === "number") DEMON_SITEPAL_FILTER[key] = stored.filter[key];
            });
          }
          forceRender((n) => n + 1);
        }
      } catch {}
    }
  }, []);

  if (!enabled) return null;

  const persist = () => {
    try {
      const out = { filter: {} };
      FIELDS.forEach(({ key }) => { out[key] = DEMON_SITEPAL_CROP[key]; });
      FILTER_FIELDS.forEach(({ key }) => { out.filter[key] = DEMON_SITEPAL_FILTER[key]; });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch {}
  };

  const setField = (key, val) => {
    DEMON_SITEPAL_CROP[key] = val;
    persist();
    forceRender((n) => n + 1);
  };
  const setFilterField = (key, val) => {
    DEMON_SITEPAL_FILTER[key] = val;
    persist();
    forceRender((n) => n + 1);
  };

  const reset = () => {
    const cropDefaults = { cropX: 190, cropY: 117, cropW: 125, cropH: 180, rotateZ: 0, rotateX: 0 };
    const filterDefaults = { saturate: 145, contrast: 108, brightness: 105, hueRotate: 0, sepia: 10 };
    Object.assign(DEMON_SITEPAL_CROP, cropDefaults);
    Object.assign(DEMON_SITEPAL_FILTER, filterDefaults);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    forceRender((n) => n + 1);
  };

  const logBlock = () => {
    const lines = [
      "export const DEMON_SITEPAL_CROP = {",
      ...FIELDS.map(({ key }) => `  ${key}: ${DEMON_SITEPAL_CROP[key]},`),
      "};",
      "export const DEMON_SITEPAL_FILTER = {",
      ...FILTER_FIELDS.map(({ key }) => `  ${key}: ${DEMON_SITEPAL_FILTER[key]},`),
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
        minWidth: collapsed ? 0 : 240,
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
          {FIELDS.map(({ key, min, max, step }) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ width: 70, color: "#a5f3fc" }}>{key}</span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={DEMON_SITEPAL_CROP[key]}
                onChange={(e) => setField(key, Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={DEMON_SITEPAL_CROP[key]}
                onChange={(e) => setField(key, Number(e.target.value))}
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
                value={DEMON_SITEPAL_FILTER[key]}
                onChange={(e) => setFilterField(key, Number(e.target.value))}
                style={{ flex: 1 }}
              />
              <input
                type="number"
                min={min}
                max={max}
                step={step}
                value={DEMON_SITEPAL_FILTER[key]}
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
