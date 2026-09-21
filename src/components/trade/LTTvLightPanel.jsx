"use client";
import { useEffect, useRef, useState } from "react";
import {
  STUDIO_LIGHTS,
  HOUSE_AMBIENT,
  HOUSE_PREVIEW,
} from "@/components/trade/TalkShowScene";

/**
 * Dev-only lighting panel for the LT TV set.
 *
 * Mount with ?tune=lights on /trade, then open the LT TV tab. Every slider
 * writes straight into STUDIO_LIGHTS / HOUSE_AMBIENT, which the per-frame sync
 * in TalkShowScene reads every tick, so the set changes as you drag. Nothing
 * here is saved to the repo: "Copy values" puts a block on the clipboard to
 * paste back into TalkShowScene.jsx (or into the thread, and someone else will).
 *
 * THE ON AIR / OFF AIR BUTTONS ARE THE POINT. The rig has two looks and the
 * honest way to reach the first one is to sit through an episode, which is no
 * way to judge lighting. Those buttons pin the state so both can be dialled in
 * side by side; "Follow the show" hands it back to the real playback.
 *
 * Two values can't be tuned live and are marked: `coneLength` and `radiusTop`
 * are baked into the beam geometry when the lights mount, so changing them
 * needs a reload.
 */

const STORAGE_KEY = "lt_tv_light_panel_v1";

function readSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("[LTTvLightPanel] ignoring unreadable saved lighting", error);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    return null;
  }
}

// Which fixture is which, in LAMP_HEAD_NODES order. Named for what they light
// rather than numbered, because "fixture 3" tells you nothing when you are
// looking at the set trying to work out which beam just moved.
const FIXTURES = [
  { label: "Key · GR80 side" },
  { label: "Fill · centre right" },
  { label: "Fill · neon frame" },
  { label: "Key · Connor side" },
];

// Per fixture. `yaw` and `pitch` are DEGREES OFF THE MODELLED AIM, so 0 is
// always whatever Blender authored and there is always a way back.
const FIXTURE_FIELDS = [
  { key: "yaw", label: "Swing", min: -60, max: 60, step: 1, unit: "°" },
  { key: "pitch", label: "Tilt", min: -45, max: 45, step: 1, unit: "°" },
  { key: "intensity", label: "Brightness", min: 0, max: 24, step: 0.5 },
  { key: "opacity", label: "Beam", min: 0, max: 0.5, step: 0.005 },
];

// Shared by all four.
const BEAM_FIELDS = [
  { key: "angle", label: "Spread", min: 0.05, max: 0.7, step: 0.01 },
  { key: "penumbra", label: "Edge softness", min: 0, max: 1, step: 0.05 },
  { key: "decay", label: "Falloff", min: 0, max: 3, step: 0.1 },
  { key: "range", label: "Throw", min: 1, max: 20, step: 0.5 },
  { key: "beamLength", label: "Shaft length", min: 1, max: 12, step: 0.1 },
  { key: "anglePower", label: "Shaft fade", min: 1, max: 12, step: 0.5 },
];

const LEVEL_FIELDS = [
  {
    key: "ambientOn", label: "Room, on air", min: 0, max: 3, step: 0.05,
    get: () => HOUSE_AMBIENT.onAir, set: (v) => { HOUSE_AMBIENT.onAir = v; },
  },
  {
    key: "ambientOff", label: "Room, off air", min: 0, max: 3, step: 0.05,
    get: () => HOUSE_AMBIENT.offAir, set: (v) => { HOUSE_AMBIENT.offAir = v; },
  },
  {
    key: "rigOff", label: "Rig, off air", min: 0, max: 1, step: 0.01,
    get: () => STUDIO_LIGHTS.offAir, set: (v) => { STUDIO_LIGHTS.offAir = v; },
  },
  {
    key: "fade", label: "Fade speed", min: 0.4, max: 8, step: 0.1,
    get: () => STUDIO_LIGHTS.fadeLambda,
    // One rate for both, always — see the note on HOUSE_AMBIENT.fadeLambda.
    set: (v) => { STUDIO_LIGHTS.fadeLambda = v; HOUSE_AMBIENT.fadeLambda = v; },
  },
];

const round = (n, places = 3) => Number(n.toFixed(places));

export default function LTTvLightPanel() {
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [fixture, setFixture] = useState(0);
  const [preview, setPreview] = useState("follow");
  const [copied, setCopied] = useState("");
  // The config objects are mutated in place and never re-render anything, so
  // the panel keeps its own tick to redraw its inputs after a write.
  const [, redraw] = useState(0);
  const bump = () => redraw((n) => n + 1);
  const copiedTimer = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.search.includes("tune=lights")) return;
    setVisible(true);

    // Re-apply the last session's tuning so a reload doesn't lose an hour.
    const saved = readSaved();
    if (saved) {
      try {
        if (Array.isArray(saved.plot)) {
          saved.plot.forEach((entry, i) => {
            if (entry && STUDIO_LIGHTS.plot[i]) Object.assign(STUDIO_LIGHTS.plot[i], entry);
          });
        }
        if (saved.lights) Object.assign(STUDIO_LIGHTS, saved.lights);
        if (saved.ambient) Object.assign(HOUSE_AMBIENT, saved.ambient);
      } catch (error) {
        console.warn("[LTTvLightPanel] saved lighting didn't apply", error);
      }
      bump();
    }
    return () => { HOUSE_PREVIEW.force = null; };
  }, []);

  // Preview only ever lives for this page view — it is a tuning aid, not a
  // setting, and a reload that came back holding the set off air would be
  // indistinguishable from the cue being broken.
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  if (!visible) return null;

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        plot: STUDIO_LIGHTS.plot.map((p) => ({ ...p })),
        lights: {
          offAir: STUDIO_LIGHTS.offAir, fadeLambda: STUDIO_LIGHTS.fadeLambda,
          angle: STUDIO_LIGHTS.angle, penumbra: STUDIO_LIGHTS.penumbra,
          decay: STUDIO_LIGHTS.decay, range: STUDIO_LIGHTS.range,
          beamLength: STUDIO_LIGHTS.beamLength, anglePower: STUDIO_LIGHTS.anglePower,
          enabled: STUDIO_LIGHTS.enabled, beams: STUDIO_LIGHTS.beams,
          lens: { ...STUDIO_LIGHTS.lens },
        },
        ambient: { ...HOUSE_AMBIENT },
      }));
    } catch (error) {
      console.warn("[LTTvLightPanel] couldn't save lighting", error);
    }
  };

  const write = (apply) => { apply(); save(); bump(); };

  const setPreviewState = (next) => {
    setPreview(next);
    HOUSE_PREVIEW.force = next === "follow" ? null : next;
  };

  const block = () => {
    const plot = STUDIO_LIGHTS.plot.map((p, i) => {
      const note = FIXTURES[i]?.label ? `    // ${FIXTURES[i].label}\n` : "";
      return `${note}    { intensity: ${round(p.intensity)}, color: "${p.color}", ` +
        `opacity: ${round(p.opacity)}, yaw: ${round(p.yaw || 0)}, pitch: ${round(p.pitch || 0)} },`;
    }).join("\n");
    return [
      "// STUDIO_LIGHTS, in TalkShowScene.jsx",
      `  offAir: ${round(STUDIO_LIGHTS.offAir)},`,
      `  fadeLambda: ${round(STUDIO_LIGHTS.fadeLambda)},`,
      `  angle: ${round(STUDIO_LIGHTS.angle)},`,
      `  penumbra: ${round(STUDIO_LIGHTS.penumbra)},`,
      `  decay: ${round(STUDIO_LIGHTS.decay)},`,
      `  range: ${round(STUDIO_LIGHTS.range)},`,
      `  beamLength: ${round(STUDIO_LIGHTS.beamLength)},`,
      `  anglePower: ${round(STUDIO_LIGHTS.anglePower)},`,
      `  lens: { enabled: ${STUDIO_LIGHTS.lens.enabled}, size: ${round(STUDIO_LIGHTS.lens.size)}, ` +
        `opacity: ${round(STUDIO_LIGHTS.lens.opacity)} },`,
      "  plot: [",
      plot,
      "  ],",
      "",
      "// HOUSE_AMBIENT, same file",
      `  onAir: ${round(HOUSE_AMBIENT.onAir)},`,
      `  offAir: ${round(HOUSE_AMBIENT.offAir)},`,
      `  fadeLambda: ${round(HOUSE_AMBIENT.fadeLambda)},`,
    ].join("\n");
  };

  const copy = async () => {
    const text = block();
    // Logged as well as copied: the clipboard needs a secure context and a
    // real gesture, and neither is guaranteed. The console copy always works.
    console.log(text);
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Copied — paste it into the thread");
    } catch {
      setCopied("Clipboard refused — it's in the browser console");
    }
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(""), 4000);
  };

  const resetFixture = () => write(() => {
    Object.assign(STUDIO_LIGHTS.plot[fixture], { yaw: 0, pitch: 0 });
  });

  const plot = STUDIO_LIGHTS.plot[fixture] || STUDIO_LIGHTS.plot[0];

  if (collapsed) {
    return (
      <div style={S.collapsed}>
        <button type="button" style={S.chip} onClick={() => setCollapsed(false)}>
          Lights ›
        </button>
      </div>
    );
  }

  return (
    <div style={S.panel}>
      <div style={S.head}>
        <b style={S.title}>LT TV lighting</b>
        <button type="button" style={S.chip} onClick={() => setCollapsed(true)} aria-label="Collapse">‹</button>
      </div>

      <div style={S.note}>
        Open the LT TV tab and enter a studio, or none of this is on screen.
      </div>

      <div style={S.group}>
        <div style={S.groupLabel}>Showing</div>
        <div style={S.row}>
          {[["off", "Off air"], ["on", "On air"], ["follow", "Follow the show"]].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPreviewState(value)}
              style={{ ...S.toggle, ...(preview === value ? S.toggleOn : null) }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={S.group}>
        <div style={S.groupLabel}>Levels</div>
        {LEVEL_FIELDS.map((field) => (
          <Slider
            key={field.key}
            label={field.label}
            value={field.get()}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(v) => write(() => field.set(v))}
          />
        ))}
      </div>

      <div style={S.group}>
        <div style={S.groupLabel}>Fixture</div>
        <div style={S.row}>
          {FIXTURES.map((f, i) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setFixture(i)}
              style={{ ...S.toggle, ...(fixture === i ? S.toggleOn : null) }}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div style={S.sub}>{FIXTURES[fixture]?.label}</div>
        {FIXTURE_FIELDS.map((field) => (
          <Slider
            key={field.key}
            label={field.label}
            unit={field.unit}
            value={plot[field.key] || 0}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(v) => write(() => { plot[field.key] = v; })}
          />
        ))}
        <div style={S.row}>
          <input
            type="color"
            value={plot.color}
            onChange={(e) => write(() => { plot.color = e.target.value; })}
            style={S.color}
            aria-label="Fixture colour"
          />
          <span style={S.sub}>{plot.color}</span>
          <button type="button" style={S.chip} onClick={resetFixture}>Re-centre aim</button>
        </div>
      </div>

      <div style={S.group}>
        <div style={S.groupLabel}>Beam, all four</div>
        {BEAM_FIELDS.map((field) => (
          <Slider
            key={field.key}
            label={field.label}
            value={STUDIO_LIGHTS[field.key]}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(v) => write(() => { STUDIO_LIGHTS[field.key] = v; })}
          />
        ))}
        <Slider
          label="Lens glare"
          value={STUDIO_LIGHTS.lens.opacity}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => write(() => { STUDIO_LIGHTS.lens.opacity = v; })}
        />
        <div style={S.row}>
          <Check label="Lights on" checked={STUDIO_LIGHTS.enabled}
            onChange={(v) => write(() => { STUDIO_LIGHTS.enabled = v; })} />
          <Check label="Show beams" checked={STUDIO_LIGHTS.beams}
            onChange={(v) => write(() => { STUDIO_LIGHTS.beams = v; })} />
        </div>
      </div>

      <div style={S.footer}>
        <button type="button" style={S.primary} onClick={copy}>Copy values</button>
        {copied && <span style={S.sub}>{copied}</span>}
        <div style={S.fine}>
          Saved in this browser as you go. Beam shaft thickness and length need
          a reload to change, so they aren&apos;t here.
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, unit = "", onChange }) {
  return (
    <label style={S.field}>
      <span style={S.fieldLabel}>
        {label}
        <b style={S.value}>{Number(value).toFixed(step < 0.1 ? 3 : step < 1 ? 2 : 0)}{unit}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={S.range}
      />
    </label>
  );
}

function Check({ label, checked, onChange }) {
  return (
    <label style={S.check}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

const S = {
  panel: {
    // RIGHT-HAND SIDE, clear of the rail. The LT TV console lives down the
    // left of the page and is what you press Play on — a board parked on
    // top of it would block the one control the tuning is judged against.
    position: "fixed", top: 12, right: 64, zIndex: 100000, width: 268,
    maxHeight: "calc(100vh - 24px)", overflowY: "auto",
    background: "rgba(6, 8, 14, 0.94)", border: "1px solid rgba(150,170,200,0.35)",
    borderRadius: 10, padding: "10px 12px 12px",
    font: "12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace", color: "#cfe3ff",
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
  },
  collapsed: { position: "fixed", top: 12, right: 64, zIndex: 100000 },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { color: "#ffcf4d", letterSpacing: "0.08em", fontSize: 12 },
  note: { color: "#8aa0bd", margin: "6px 0 10px", fontSize: 11 },
  group: { borderTop: "1px solid rgba(150,170,200,0.18)", paddingTop: 8, marginTop: 8 },
  groupLabel: { color: "#8aa0bd", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 10, marginBottom: 6 },
  row: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", margin: "6px 0" },
  sub: { color: "#8aa0bd", fontSize: 11 },
  fine: { color: "#6f83a0", fontSize: 10, marginTop: 8, lineHeight: 1.45 },
  field: { display: "block", margin: "6px 0" },
  fieldLabel: { display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 2 },
  value: { color: "#fff", fontWeight: 600 },
  range: { width: "100%", accentColor: "#ffcf4d" },
  toggle: {
    background: "rgba(20,26,38,0.9)", color: "#cfe3ff", cursor: "pointer",
    border: "1px solid rgba(150,170,200,0.3)", borderRadius: 6, padding: "4px 8px", font: "inherit",
  },
  toggleOn: { background: "#ffcf4d", color: "#10131b", borderColor: "#ffcf4d", fontWeight: 700 },
  chip: {
    background: "rgba(20,26,38,0.9)", color: "#cfe3ff", cursor: "pointer",
    border: "1px solid rgba(150,170,200,0.3)", borderRadius: 6, padding: "3px 8px", font: "inherit",
  },
  primary: {
    background: "#ffcf4d", color: "#10131b", cursor: "pointer", fontWeight: 700,
    border: 0, borderRadius: 6, padding: "6px 10px", font: "inherit",
  },
  color: { width: 34, height: 24, padding: 0, background: "none", border: 0, cursor: "pointer" },
  check: { display: "flex", alignItems: "center", gap: 5, color: "#cfe3ff", cursor: "pointer" },
  footer: { borderTop: "1px solid rgba(150,170,200,0.18)", paddingTop: 10, marginTop: 10 },
};
