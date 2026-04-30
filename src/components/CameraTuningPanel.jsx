"use client";
import { useEffect, useState, useRef } from "react";
import * as THREE from "three";

/**
 * Dev-only camera tuning panel for CyborgTempleScene.
 *
 * Mount when ?tune=1 is in the URL. Reads/mutates AGENT_CAMERA_SETTINGS in
 * place via window.__cameraTuner (set up inside CyborgTempleScene). Sliders
 * update values live; "Focus" snaps the camera to the current settings;
 * "Log" prints the formatted block to paste back into the source.
 */

const AGENT_IDS = [
  "RL80",
  "Demon",
  "Monk",
  "Tekno",
  "Fluffy",
  "Angel",
  "Screen1",
  "Screen2",
  "Screen3",
  "Screen4",
];

const STORAGE_KEY = "rl80_camera_tuner_overrides_v1";

export default function CameraTuningPanel() {
  const [enabled, setEnabled] = useState(false);
  const [agentId, setAgentId] = useState("RL80");
  const [, forceRender] = useState(0);
  const [tunerReady, setTunerReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.search.includes("tune=1")) return;
    setEnabled(true);

    pollRef.current = setInterval(() => {
      if (window.__cameraTuner) {
        setTunerReady(true);
        clearInterval(pollRef.current);
        pollRef.current = null;
        applyStoredOverrides();
      }
    }, 200);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  if (!enabled || !tunerReady) return null;

  const tuner = window.__cameraTuner;
  const settings = tuner.settings[agentId];

  const setVec = (group, axis, value) => {
    const target = settings[group];
    if (!target) return;
    const num = parseFloat(value);
    if (!isFinite(num)) return;
    target[axis] = num;
    persistOverrides();
    forceRender((n) => n + 1);
    tuner.focusOn(agentId);
  };

  const ensureOrbitCenter = () => {
    if (!settings.orbitCenter) {
      settings.orbitCenter = settings.lookAtPos.clone();
      persistOverrides();
      forceRender((n) => n + 1);
    }
  };

  const clearOrbitCenter = () => {
    settings.orbitCenter = null;
    persistOverrides();
    forceRender((n) => n + 1);
  };

  const persistOverrides = () => {
    try {
      const out = {};
      Object.keys(tuner.settings).forEach((id) => {
        const s = tuner.settings[id];
        out[id] = {
          cameraPos: [s.cameraPos.x, s.cameraPos.y, s.cameraPos.z],
          lookAtPos: [s.lookAtPos.x, s.lookAtPos.y, s.lookAtPos.z],
          orbitCenter: s.orbitCenter
            ? [s.orbitCenter.x, s.orbitCenter.y, s.orbitCenter.z]
            : null,
        };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch {}
  };

  const applyStoredOverrides = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw);
      Object.keys(stored).forEach((id) => {
        const s = window.__cameraTuner.settings[id];
        if (!s) return;
        const o = stored[id];
        if (o.cameraPos) s.cameraPos.set(...o.cameraPos);
        if (o.lookAtPos) s.lookAtPos.set(...o.lookAtPos);
        if (o.orbitCenter)
          s.orbitCenter = new THREE.Vector3(...o.orbitCenter);
        else s.orbitCenter = null;
      });
    } catch {}
  };

  const resetStored = () => {
    if (!confirm("Wipe locally-saved tuning overrides? Reload after to see source defaults.")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  };

  const logFormatted = () => {
    const fmt = (v) => Number(v).toFixed(3).replace(/\.?0+$/, "") || "0";
    const block = Object.keys(tuner.settings)
      .map((id) => {
        const s = tuner.settings[id];
        const cp = `new THREE.Vector3(${fmt(s.cameraPos.x)}, ${fmt(s.cameraPos.y)}, ${fmt(s.cameraPos.z)})`;
        const la = `new THREE.Vector3(${fmt(s.lookAtPos.x)}, ${fmt(s.lookAtPos.y)}, ${fmt(s.lookAtPos.z)})`;
        const oc = s.orbitCenter
          ? `new THREE.Vector3(${fmt(s.orbitCenter.x)}, ${fmt(s.orbitCenter.y)}, ${fmt(s.orbitCenter.z)})`
          : "null";
        return `  ${id}: {\n    cameraPos: ${cp},\n    lookAtPos: ${la},\n    orbitCenter: ${oc},\n  },`;
      })
      .join("\n");
    const text = `export const AGENT_CAMERA_SETTINGS = {\n${block}\n};`;
    console.log("%c[CameraTuner] Paste over AGENT_CAMERA_SETTINGS:", "color:#4dffaa;font-weight:bold");
    console.log(text);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => console.log("[CameraTuner] Copied to clipboard."),
        () => {}
      );
    }
  };

  const VecRow = ({ label, group }) => {
    const v = settings[group];
    if (!v) return null;
    return (
      <div style={S.vecRow}>
        <div style={S.vecLabel}>{label}</div>
        {["x", "y", "z"].map((axis) => (
          <div key={axis} style={S.axisCell}>
            <span style={S.axisLetter}>{axis}</span>
            <input
              type="range"
              min={-3}
              max={3}
              step={0.005}
              value={v[axis]}
              onChange={(e) => setVec(group, axis, e.target.value)}
              style={S.slider}
            />
            <input
              type="number"
              step={0.01}
              value={Number(v[axis].toFixed(3))}
              onChange={(e) => setVec(group, axis, e.target.value)}
              style={S.numInput}
            />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ ...S.root, ...(collapsed ? S.rootCollapsed : null) }}>
      <div style={S.header}>
        <span style={S.title}>📷 CAM TUNER</span>
        <button style={S.headerBtn} onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? "▢" : "—"}
        </button>
      </div>

      {!collapsed && (
        <>
          <div style={S.row}>
            <select
              value={agentId}
              onChange={(e) => {
                setAgentId(e.target.value);
                setTimeout(() => tuner.focusOn(e.target.value), 0);
              }}
              style={S.select}
            >
              {AGENT_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            <button style={S.btn} onClick={() => tuner.focusOn(agentId)}>
              Focus
            </button>
            <button style={S.btn} onClick={() => tuner.clearFocus()}>
              Clear
            </button>
          </div>

          <VecRow label="cameraPos" group="cameraPos" />
          <VecRow label="lookAtPos" group="lookAtPos" />

          <div style={S.row}>
            <span style={S.vecLabel}>orbitCenter</span>
            {settings.orbitCenter ? (
              <button style={S.btn} onClick={clearOrbitCenter}>
                set null
              </button>
            ) : (
              <button style={S.btn} onClick={ensureOrbitCenter}>
                add (= lookAtPos)
              </button>
            )}
          </div>
          {settings.orbitCenter && <VecRow label="" group="orbitCenter" />}

          <div style={{ ...S.row, marginTop: 8, gap: 6 }}>
            <button style={{ ...S.btn, ...S.primaryBtn }} onClick={logFormatted}>
              📋 Log + Copy
            </button>
            <button style={S.btn} onClick={resetStored}>
              Reset
            </button>
          </div>

          <div style={S.hint}>
            Slider range −3..3, step 0.005. Edits save to localStorage and apply on reload.
            "Log + Copy" prints the full settings block to paste over <code>AGENT_CAMERA_SETTINGS</code>.
          </div>
        </>
      )}
    </div>
  );
}

const S = {
  root: {
    position: "fixed",
    bottom: 16,
    right: 16,
    zIndex: 99999,
    width: 360,
    background: "rgba(8, 12, 10, 0.94)",
    border: "1px solid rgba(77, 255, 170, 0.4)",
    borderRadius: 8,
    padding: 10,
    fontFamily: "JetBrains Mono, ui-monospace, monospace",
    fontSize: 11,
    color: "#c8ffe0",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    backdropFilter: "blur(8px)",
  },
  rootCollapsed: {
    width: 140,
    padding: 6,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  title: {
    color: "#4dffaa",
    letterSpacing: 2,
    fontWeight: 700,
    fontSize: 11,
  },
  headerBtn: {
    background: "transparent",
    border: "1px solid rgba(77, 255, 170, 0.3)",
    color: "#4dffaa",
    cursor: "pointer",
    width: 22,
    height: 22,
    borderRadius: 4,
    fontSize: 10,
    lineHeight: 1,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  select: {
    flex: 1,
    background: "rgba(0,0,0,0.5)",
    color: "#c8ffe0",
    border: "1px solid rgba(77, 255, 170, 0.3)",
    padding: "4px 6px",
    borderRadius: 4,
    fontFamily: "inherit",
    fontSize: 11,
  },
  btn: {
    background: "rgba(13, 80, 50, 0.4)",
    color: "#c8ffe0",
    border: "1px solid rgba(77, 255, 170, 0.4)",
    padding: "4px 10px",
    borderRadius: 4,
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 11,
  },
  primaryBtn: {
    background: "rgba(77, 255, 170, 0.18)",
    borderColor: "#4dffaa",
    color: "#8effc4",
    flex: 1,
  },
  vecRow: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    marginBottom: 6,
    padding: "4px 0",
    borderTop: "1px dashed rgba(77, 255, 170, 0.15)",
  },
  vecLabel: {
    color: "#6db59a",
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  axisCell: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  axisLetter: {
    width: 10,
    color: "#4dffaa",
    fontWeight: 700,
  },
  slider: {
    flex: 1,
    accentColor: "#4dffaa",
  },
  numInput: {
    width: 60,
    background: "rgba(0,0,0,0.5)",
    color: "#c8ffe0",
    border: "1px solid rgba(77, 255, 170, 0.3)",
    padding: "2px 4px",
    borderRadius: 3,
    fontFamily: "inherit",
    fontSize: 10,
    textAlign: "right",
  },
  hint: {
    fontSize: 9,
    color: "#3a6b54",
    marginTop: 8,
    lineHeight: 1.4,
  },
};
