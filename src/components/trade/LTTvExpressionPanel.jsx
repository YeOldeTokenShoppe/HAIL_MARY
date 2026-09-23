"use client";
import { useEffect, useRef, useState } from "react";
import {
  TALKSHOW_PROJECTION_CONFIG,
  TALKSHOW_PORTALS,
  HOUSE_PREVIEW,
} from "@/components/trade/TalkShowScene";

/**
 * Dev-only expression board for the LT TV faces.
 *
 * Mount with ?tune=faces on /trade, then open the LT TV tab and enter a set.
 * Each button calls SitePal's `setFacialExpression(expression, amplitude,
 * duration)` (docs/sitepal.md, Animation Control Functions) on ONE
 * character's portal — the same iframe their face on the set is cropped from —
 * so the result shows on the Face2 mesh, not in some other player.
 *
 * THE QUESTION IT ANSWERS is not whether SitePal can make the face: the API
 * says it can. It is whether the expression SURVIVES THE CROP. The face on the
 * set is one fixed rectangle of SitePal's render (`paintCrop`), fitted to a
 * neutral face, so a wide open mouth or a raised brow can land outside it, and
 * a subtle one can vanish into a 512² texture on a mesh across the desk. Only
 * an eye on the set can tell, so the board records a verdict per character per
 * expression and "Copy verdicts" hands them back for the thread.
 *
 * Nothing here plays speech or costs a call — expressions run on the idle
 * face. "Lights up" pins the house on air while the board is open, because
 * off air the faces are dimmed to a quarter and nothing reads.
 */

const STORAGE_KEY = "lt_tv_expression_panel_v1";

// The reference's thirteen, in its order, less two Michelle ruled out on
// 2026-09-23 as never useful on the show: Blink (SitePal already blinks on its
// own) and Scream. "None" is the way back.
const EXPRESSIONS = [
  "ClosedSmile", "OpenSmile", "Sad", "Angry", "Fear", "Disgust", "Surprise",
  "Thinking", "Blush", "LeftWink", "RightWink",
];

const VERDICTS = [
  { key: "reads", label: "Reads" },
  { key: "faint", label: "Too faint" },
  { key: "breaks", label: "Breaks the face" },
];

// The registry keys are the rig names; this is who a viewer meets.
const NAMES = { Monk: "GR80", Connor: "Connor", Holly: "Holly" };
const nameOf = (key) => NAMES[key] || key;

function readSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn("[LTTvExpressionPanel] ignoring unreadable saved verdicts", error);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    return null;
  }
}

function portalWindow(key) {
  const portal = TALKSHOW_PORTALS.current?.[key];
  if (!portal?.ready) return null;
  try {
    return portal.frame?.contentWindow || null;
  } catch {
    return null;
  }
}

export default function LTTvExpressionPanel() {
  const keys = Object.keys(TALKSHOW_PROJECTION_CONFIG);
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [who, setWho] = useState(keys[0]);
  const [amplitude, setAmplitude] = useState(0.8);
  const [duration, setDuration] = useState(4);
  const [hold, setHold] = useState(false);
  const [lightsUp, setLightsUp] = useState(true);
  const [last, setLast] = useState(null);
  const [verdicts, setVerdicts] = useState({});
  const [status, setStatus] = useState({});
  const [copied, setCopied] = useState("");
  const copiedTimer = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.search.includes("tune=faces")) return;
    setVisible(true);
    const saved = readSaved();
    if (saved?.verdicts) setVerdicts(saved.verdicts);
    if (typeof saved?.amplitude === "number") setAmplitude(saved.amplitude);
    if (typeof saved?.duration === "number") setDuration(saved.duration);
    if (saved?.who && TALKSHOW_PROJECTION_CONFIG[saved.who]) setWho(saved.who);
    return () => clearTimeout(copiedTimer.current);
  }, []);

  // Which portals are up and can take an expression. Polled because the set
  // loads long after the board mounts and says nothing when it does.
  useEffect(() => {
    if (!visible) return;
    const check = () => {
      const next = {};
      keys.forEach((key) => {
        const w = portalWindow(key);
        if (!w) next[key] = "loading";
        else if (typeof w.setFacialExpression !== "function") next[key] = "no-api";
        else if (typeof w.is3D === "function" && w.is3D() === false) next[key] = "2d";
        else next[key] = "ready";
      });
      setStatus(next);
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lights up only while the board is open, and only ever for this page view:
  // a reload that came back holding the set on air would look like a broken cue.
  useEffect(() => {
    if (!visible) return;
    HOUSE_PREVIEW.force = lightsUp ? "on" : null;
    return () => { HOUSE_PREVIEW.force = null; };
  }, [visible, lightsUp]);

  useEffect(() => {
    if (!visible) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ verdicts, amplitude, duration, who }));
    } catch {}
  }, [visible, verdicts, amplitude, duration, who]);

  if (!visible) return null;

  const targets = who === "*" ? keys : [who];

  const fire = (expression) => {
    const secs = hold ? -1 : duration;
    const reached = [];
    targets.forEach((key) => {
      const w = portalWindow(key);
      if (typeof w?.setFacialExpression !== "function") return;
      try {
        if (expression === "None") {
          w.setFacialExpression("None");
          w.clearExpressionList?.();
        } else {
          w.setFacialExpression(expression, amplitude, secs);
        }
        reached.push(key);
      } catch (error) {
        console.warn(`[LTTvExpressionPanel] ${nameOf(key)} refused ${expression}`, error);
      }
    });
    setLast({ expression, reached: reached.map(nameOf) });
  };

  const judge = (expression, verdict) => {
    if (who === "*") return;
    setVerdicts((prev) => {
      const mine = { ...(prev[who] || {}) };
      if (mine[expression] === verdict) delete mine[expression];
      else mine[expression] = verdict;
      return { ...prev, [who]: mine };
    });
  };

  const copy = async () => {
    const lines = [`LT TV expressions, amplitude ${amplitude}`];
    keys.forEach((key) => {
      const mine = verdicts[key] || {};
      const by = (v) => EXPRESSIONS.filter((e) => mine[e] === v);
      const parts = VERDICTS
        .map((v) => (by(v.key).length ? `${v.label.toLowerCase()}: ${by(v.key).join(", ")}` : null))
        .filter(Boolean);
      const untried = EXPRESSIONS.filter((e) => !mine[e]);
      if (untried.length) parts.push(`not judged: ${untried.join(", ")}`);
      lines.push(`${nameOf(key)} — ${parts.join("; ")}`);
    });
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied("Copied — paste it into the thread");
    } catch {
      console.log(text);
      setCopied("Clipboard blocked — printed to the console");
    }
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(""), 4000);
  };

  if (collapsed) {
    return (
      <div style={S.collapsed}>
        <button type="button" style={S.chip} onClick={() => setCollapsed(false)}>
          Faces ›
        </button>
      </div>
    );
  }

  const mine = who === "*" ? {} : verdicts[who] || {};
  const stateLabel = {
    loading: "portal still loading",
    "no-api": "player has no expressions",
    "2d": "2D scene, no expressions",
    ready: "ready",
  };

  return (
    <div style={S.panel}>
      <div style={S.head}>
        <b style={S.title}>LT TV faces</b>
        <button type="button" style={S.chip} onClick={() => setCollapsed(true)} aria-label="Collapse">‹</button>
      </div>
      <div style={S.note}>
        Press an expression and watch the face on the set. Then mark whether it
        reads through the projection.
      </div>

      <div style={S.group}>
        <div style={S.groupLabel}>Who</div>
        <div style={S.row}>
          {keys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setWho(key)}
              style={{ ...S.toggle, ...(who === key ? S.toggleOn : null) }}
            >
              {nameOf(key)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setWho("*")}
            style={{ ...S.toggle, ...(who === "*" ? S.toggleOn : null) }}
          >
            Everyone
          </button>
        </div>
        {keys.map((key) => (
          <div key={key} style={S.sub}>
            {nameOf(key)}: <span style={status[key] === "ready" ? S.ok : S.warn}>{stateLabel[status[key]] || "…"}</span>
          </div>
        ))}
      </div>

      <div style={S.group}>
        <div style={S.groupLabel}>Strength and length</div>
        <Slider label="Amplitude" value={amplitude} min={0.1} max={1.5} step={0.05} onChange={setAmplitude} />
        {!hold && (
          <Slider label="Duration" value={duration} min={1} max={10} step={0.5} unit="s" onChange={setDuration} />
        )}
        <div style={S.row}>
          <Check label="Hold until None" checked={hold} onChange={setHold} />
          <Check label="Lights up" checked={lightsUp} onChange={setLightsUp} />
        </div>
      </div>

      <div style={S.group}>
        <div style={S.groupLabel}>Expressions</div>
        {EXPRESSIONS.map((expression) => (
          <div key={expression} style={S.exprRow}>
            <button
              type="button"
              style={{ ...S.toggle, ...(last?.expression === expression ? S.toggleOn : null), minWidth: 96 }}
              onClick={() => fire(expression)}
            >
              {expression}
            </button>
            {who !== "*" && VERDICTS.map((v) => (
              <button
                key={v.key}
                type="button"
                title={v.label}
                onClick={() => judge(expression, v.key)}
                style={{ ...S.verdict, ...(mine[expression] === v.key ? S.verdictOn[v.key] : null) }}
              >
                {v.key === "reads" ? "✓" : v.key === "faint" ? "~" : "✗"}
              </button>
            ))}
          </div>
        ))}
        <div style={S.row}>
          <button type="button" style={S.chip} onClick={() => fire("None")}>None · back to neutral</button>
        </div>
        {last && (
          <div style={S.sub}>
            {last.reached.length
              ? `${last.expression} sent to ${last.reached.join(" and ")}`
              : `${last.expression} reached nobody — no portal is ready`}
          </div>
        )}
        <div style={S.fine}>
          A character only shows on a set with a seat for them, so Holly is on
          the news desk and not in the lounge.
        </div>
        <div style={S.fine}>✓ reads · ~ too faint to see · ✗ breaks the face (mouth or eyes slide out of the crop)</div>
      </div>

      <div style={S.footer}>
        <button type="button" style={S.primary} onClick={copy}>Copy verdicts</button>
        {copied && <span style={S.sub}> {copied}</span>}
        <div style={S.fine}>
          Saved in this browser as you go. A new expression interrupts the one
          before it rather than queueing, which is how a script cue would behave.
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
        <b style={S.value}>{Number(value).toFixed(step < 1 ? 2 : 0)}{unit}</b>
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
    // Right-hand side like the lighting board, clear of the LT TV console on
    // the left. The two are not meant to be open together.
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
  exprRow: { display: "flex", alignItems: "center", gap: 4, margin: "3px 0" },
  sub: { color: "#8aa0bd", fontSize: 11 },
  ok: { color: "#7fe0a0" },
  warn: { color: "#ffb86b" },
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
  verdict: {
    background: "rgba(20,26,38,0.9)", color: "#8aa0bd", cursor: "pointer", width: 26,
    border: "1px solid rgba(150,170,200,0.25)", borderRadius: 6, padding: "3px 0", font: "inherit",
  },
  verdictOn: {
    reads: { background: "#2f8f55", color: "#fff", borderColor: "#2f8f55" },
    faint: { background: "#8a7a2a", color: "#fff", borderColor: "#8a7a2a" },
    breaks: { background: "#9a3434", color: "#fff", borderColor: "#9a3434" },
  },
  chip: {
    background: "rgba(20,26,38,0.9)", color: "#cfe3ff", cursor: "pointer",
    border: "1px solid rgba(150,170,200,0.3)", borderRadius: 6, padding: "3px 8px", font: "inherit",
  },
  primary: {
    background: "#ffcf4d", color: "#10131b", cursor: "pointer", fontWeight: 700,
    border: 0, borderRadius: 6, padding: "6px 10px", font: "inherit",
  },
  check: { display: "flex", alignItems: "center", gap: 5, color: "#cfe3ff", cursor: "pointer" },
  footer: { borderTop: "1px solid rgba(150,170,200,0.18)", paddingTop: 10, marginTop: 10 },
};
