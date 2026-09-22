"use client";
import { useEffect, useRef, useState } from "react";
import { SHOT_FRAMING, SHOT_NAMES, isSingleShot } from "@/lib/ltTv/shotFraming.mjs";

/**
 * Dev-only framing board for the LT TV camera work.
 *
 * Mount with ?tune=shots on /trade, then open the LT TV tab and enter a
 * studio. It is the camera twin of the lighting board (?tune=lights): every
 * slider writes straight into SHOT_FRAMING, which the shot director in
 * TalkShowScene reads every frame, so the picture changes as you drag. Nothing
 * here is saved to the repo — "Copy values" puts a block on the clipboard to
 * paste back into shotFraming.mjs (or into the thread, and someone else will).
 *
 * HOLD IS THE POINT. In "Follow the show" the director cuts through the shot
 * list as the episode plays, which is no way to fit a shot. Pin one shot with
 * the Hold buttons and dial it in with the episode paused or stopped; "Follow
 * the show" hands it back.
 *
 * THE FACE READOUT is the honest limit on pushing in. Each face is a crop of
 * SitePal's own render, about 195 source pixels tall — past 1.0× the shot is
 * upscaling the face and it softens while everything around it stays sharp.
 *
 * "On air" reads `viewer` whenever a hand is on the camera: the director lets
 * go the moment anyone drags the set and takes it back after "Yield after a
 * drag" seconds, so the orbit never stops working mid-episode.
 */

const STORAGE_KEY = "lt_tv_shot_panel_v1";

function readSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("[LTTvShotPanel] ignoring unreadable saved framing", error);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    return null;
  }
}

// Human labels for the four cameras, in the order the director cuts between them.
const SHOT_LABELS = {
  establish: "Establish · the whole set",
  two: "Two-shot · the pair at the desk",
  direct: "Direct · down the lens, to the viewer",
  single: "Single · the speaker, across the desk",
  close: "Close · punched in on the speaker",
};

// Per-shot fields. A wide is sized by how much of the SET it holds; a single by
// how much of the FRAME the head fills. Everything else is shared shape.
const WIDE_FIELDS = [
  { key: "coverage", label: "Set width in frame", min: 1.5, max: 7, step: 0.1, unit: "m" },
];
const SINGLE_FIELDS = [
  { key: "headShare", label: "Head fills", min: 0.08, max: 0.5, step: 0.01, pct: true },
];
const COMMON_FIELDS = [
  { key: "fov", label: "Lens (FOV)", min: 18, max: 55, step: 1, unit: "°" },
  { key: "azimuth", label: "Angle off front", min: -40, max: 40, step: 1, unit: "°" },
  { key: "height", label: "Lens height", min: -0.4, max: 1.4, step: 0.02, unit: "m" },
  { key: "lookLift", label: "Aim height", min: -0.8, max: 0.6, step: 0.02, unit: "m" },
];

const GLOBAL_FIELDS = [
  { key: "easeLambda", label: "Swing speed", min: 0.6, max: 8, step: 0.1 },
  { key: "drift", label: "Creep per second", min: 0, max: 0.05, step: 0.002 },
  { key: "driftMax", label: "Creep limit", min: 0, max: 0.2, step: 0.01, pct: true },
  { key: "handBackAfter", label: "Yield after a drag", min: 0, max: 60, step: 1, unit: "s" },
];

const round = (n, places = 3) => Number(Number(n).toFixed(places));

export default function LTTvShotPanel() {
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [shot, setShot] = useState("two");
  const [copied, setCopied] = useState("");
  const [, redraw] = useState(0);
  const bump = () => redraw((n) => n + 1);
  const copiedTimer = useRef(null);
  // The readout is written by the director every frame onto SHOT_FRAMING; poll
  // it so the panel shows the live shot and face resolution without a re-render
  // storm from the frame loop itself.
  const [live, setLive] = useState({ current: null, facePixels: 0, faceRatio: 0 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.search.includes("tune=shots")) return;
    setVisible(true);

    const saved = readSaved();
    if (saved) {
      try {
        if (saved.shots) {
          Object.entries(saved.shots).forEach(([name, values]) => {
            if (SHOT_FRAMING.shots[name]) Object.assign(SHOT_FRAMING.shots[name], values);
          });
        }
        // `enabled` is deliberately NOT restored: a reload that came back with
        // the operator switched off would be indistinguishable from the camera
        // work having broken. Same reason the lighting board never persists its
        // on-air/off-air pin.
        ["easeLambda", "drift", "driftMax", "cut", "handBackAfter", "minDistance", "maxDistance"]
          .forEach((k) => {
            if (saved[k] !== undefined) SHOT_FRAMING[k] = saved[k];
          });
      } catch (error) {
        console.warn("[LTTvShotPanel] saved framing didn't apply", error);
      }
      bump();
    }
    const poll = setInterval(() => {
      setLive({
        current: SHOT_FRAMING.current,
        facePixels: SHOT_FRAMING.facePixels || 0,
        faceRatio: SHOT_FRAMING.faceRatio || 0,
      });
    }, 200);
    return () => {
      clearInterval(poll);
      SHOT_FRAMING.hold = "auto";
      SHOT_FRAMING.enabled = true;
    };
  }, []);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  if (!visible) return null;

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        shots: Object.fromEntries(
          Object.entries(SHOT_FRAMING.shots).map(([name, v]) => [name, { ...v }]),
        ),
        easeLambda: SHOT_FRAMING.easeLambda,
        drift: SHOT_FRAMING.drift,
        driftMax: SHOT_FRAMING.driftMax,
        cut: SHOT_FRAMING.cut,
        handBackAfter: SHOT_FRAMING.handBackAfter,
        minDistance: SHOT_FRAMING.minDistance,
        maxDistance: SHOT_FRAMING.maxDistance,
      }));
    } catch (error) {
      console.warn("[LTTvShotPanel] couldn't save framing", error);
    }
  };

  const write = (apply) => { apply(); save(); bump(); };

  const setHold = (next) => write(() => { SHOT_FRAMING.hold = next; });

  const block = () => {
    const shotLines = SHOT_NAMES.map((name) => {
      const s = SHOT_FRAMING.shots[name];
      const size = isSingleShot(name)
        ? `headShare: ${round(s.headShare)}`
        : `coverage: ${round(s.coverage)}`;
      const extra = name === "direct" ? ", directToCamera: true" : "";
      return `    ${name}: { ${size}, fov: ${round(s.fov)}, azimuth: ${round(s.azimuth)}, ` +
        `height: ${round(s.height)}, lookLift: ${round(s.lookLift)}${extra} },`;
    }).join("\n");
    return [
      "// SHOT_FRAMING, in src/lib/ltTv/shotFraming.mjs",
      `  cut: ${SHOT_FRAMING.cut},`,
      `  handBackAfter: ${round(SHOT_FRAMING.handBackAfter)},`,
      `  easeLambda: ${round(SHOT_FRAMING.easeLambda)},`,
      `  drift: ${round(SHOT_FRAMING.drift)},`,
      `  driftMax: ${round(SHOT_FRAMING.driftMax)},`,
      "  shots: {",
      shotLines,
      "  },",
    ].join("\n");
  };

  const copy = async () => {
    const text = block();
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

  const s = SHOT_FRAMING.shots[shot] || SHOT_FRAMING.shots.two;
  const sizeFields = isSingleShot(shot) ? SINGLE_FIELDS : WIDE_FIELDS;
  const ratio = live.faceRatio || 0;
  const ratioTone = ratio > 1.15 ? "#ff8a8a" : ratio > 1.0 ? "#ffcf4d" : "#8fe3a0";

  if (collapsed) {
    return (
      <div style={S.collapsed}>
        <button type="button" style={S.chip} onClick={() => setCollapsed(false)}>Shots ›</button>
      </div>
    );
  }

  return (
    <div style={S.panel}>
      <div style={S.head}>
        <b style={S.title}>LT TV camera</b>
        <button type="button" style={S.chip} onClick={() => setCollapsed(true)} aria-label="Collapse">‹</button>
      </div>

      <div style={S.note}>
        Open the LT TV tab and enter a studio, or none of this is on screen.
      </div>

      <div style={S.group}>
        <div style={S.groupLabel}>Hold a shot</div>
        <div style={S.row}>
          <button
            type="button"
            onClick={() => setHold("auto")}
            style={{ ...S.toggle, ...(SHOT_FRAMING.hold === "auto" ? S.toggleOn : null) }}
          >
            Follow the show
          </button>
        </div>
        <div style={S.row}>
          {SHOT_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => { setShot(name); setHold(name); }}
              style={{ ...S.toggle, ...(SHOT_FRAMING.hold === name ? S.toggleOn : null) }}
            >
              {name}
            </button>
          ))}
        </div>
        <div style={S.readout}>
          <span style={S.sub}>On air: <b style={{ color: "#fff" }}>{live.current || "—"}</b></span>
          <span style={S.sub}>
            Face: <b style={{ color: ratioTone }}>{live.facePixels}px · {ratio.toFixed(2)}×</b>
          </span>
        </div>
        <div style={S.fine}>
          Above 1.0× the face is being enlarged past its source and softens.
          Fit each shot with Hold, then set Follow the show.
        </div>
      </div>

      <div style={S.group}>
        <div style={S.groupLabel}>Shot</div>
        <div style={S.row}>
          {SHOT_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setShot(name)}
              style={{ ...S.toggle, ...(shot === name ? S.toggleOn : null) }}
            >
              {name}
            </button>
          ))}
        </div>
        <div style={S.sub}>{SHOT_LABELS[shot]}</div>
        {[...sizeFields, ...COMMON_FIELDS].map((field) => (
          <Slider
            key={field.key}
            label={field.label}
            unit={field.unit}
            pct={field.pct}
            value={s[field.key] ?? 0}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(v) => write(() => { s[field.key] = v; })}
          />
        ))}
      </div>

      <div style={S.group}>
        <div style={S.groupLabel}>Motion, all shots</div>
        <div style={S.row}>
          <Check
            label="Camera operator on"
            checked={SHOT_FRAMING.enabled}
            onChange={(v) => write(() => { SHOT_FRAMING.enabled = v; })}
          />
        </div>
        <div style={S.fine}>
          Off gives the viewer the old single fixed shot and the orbit back for
          good. On, the operator still lets go the moment anyone drags the set,
          and takes it back after the delay below.
        </div>
        <div style={S.row}>
          <Check
            label="Hard cuts"
            checked={SHOT_FRAMING.cut}
            onChange={(v) => write(() => { SHOT_FRAMING.cut = v; })}
          />
          <span style={S.sub}>{SHOT_FRAMING.cut ? "cut" : "swing between shots"}</span>
        </div>
        {GLOBAL_FIELDS.map((field) => (
          <Slider
            key={field.key}
            label={field.label}
            pct={field.pct}
            value={SHOT_FRAMING[field.key]}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(v) => write(() => { SHOT_FRAMING[field.key] = v; })}
          />
        ))}
      </div>

      <div style={S.footer}>
        <button type="button" style={S.primary} onClick={copy}>Copy values</button>
        {copied && <span style={S.sub}>{copied}</span>}
        <div style={S.fine}>
          Saved in this browser as you go — except the operator on/off, which
          comes back on after a reload so a switched-off camera can never be
          mistaken for a broken one.
        </div>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, unit = "", pct = false, onChange }) {
  const shown = pct ? `${Math.round(value * 100)}%` : `${Number(value).toFixed(step < 0.1 ? 3 : step < 1 ? 2 : 0)}${unit}`;
  return (
    <label style={S.field}>
      <span style={S.fieldLabel}>
        {label}
        <b style={S.value}>{shown}</b>
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
  // LEFT-HAND SIDE, unlike the lighting board on the right — the two boards
  // can be open together without overlapping.
  panel: {
    position: "fixed", top: 12, left: 64, zIndex: 100000, width: 268,
    maxHeight: "calc(100vh - 24px)", overflowY: "auto",
    background: "rgba(6, 8, 14, 0.94)", border: "1px solid rgba(150,170,200,0.35)",
    borderRadius: 10, padding: "10px 12px 12px",
    font: "12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace", color: "#cfe3ff",
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
  },
  collapsed: { position: "fixed", top: 12, left: 64, zIndex: 100000 },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { color: "#ffcf4d", letterSpacing: "0.08em", fontSize: 12 },
  note: { color: "#8aa0bd", margin: "6px 0 10px", fontSize: 11 },
  group: { borderTop: "1px solid rgba(150,170,200,0.18)", paddingTop: 8, marginTop: 8 },
  groupLabel: { color: "#8aa0bd", textTransform: "uppercase", letterSpacing: "0.1em", fontSize: 10, marginBottom: 6 },
  row: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", margin: "6px 0" },
  readout: { display: "flex", justifyContent: "space-between", gap: 8, margin: "6px 0 2px" },
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
  check: { display: "flex", alignItems: "center", gap: 5, color: "#cfe3ff", cursor: "pointer" },
  primary: {
    background: "#ffcf4d", color: "#10131b", cursor: "pointer", fontWeight: 700,
    border: 0, borderRadius: 6, padding: "6px 10px", font: "inherit",
  },
  footer: { borderTop: "1px solid rgba(150,170,200,0.18)", paddingTop: 10, marginTop: 10 },
};
