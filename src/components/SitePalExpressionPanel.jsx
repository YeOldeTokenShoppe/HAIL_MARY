"use client";

import { useState } from "react";
import { ORACLE_VOICE } from "@/lib/oracleSpeech";

// Dev experiment panel for the SitePal Client API animation controls
// (setFacialExpression / setIdleMovement / setSpeechMovement / setGaze /
// followCursor). Expressions are only supported for 3D characters.

const EXPRESSIONS = [
  "None",
  "ClosedSmile",
  "OpenSmile",
  "Sad",
  "Angry",
  "Fear",
  "Disgust",
  "Surprise",
  "Thinking",
  "Blush",
  "LeftWink",
  "RightWink",
  "Blink",
  "Scream",
];

function call(fn, ...args) {
  if (typeof window !== "undefined" && typeof window[fn] === "function") {
    window[fn](...args);
    return true;
  }
  console.warn(`[ExpressionPanel] window.${fn} not available yet`);
  return false;
}

const cyan = "hsl(183 38% 57%)";

const panelStyle = {
  position: "fixed",
  bottom: 12,
  left: 12,
  zIndex: 400,
  width: 264,
  maxHeight: "80vh",
  overflowY: "auto",
  background: "rgba(0, 0, 0, 0.85)",
  border: "1px solid rgba(0, 255, 255, 0.25)",
  borderRadius: 6,
  padding: 10,
  fontFamily: "'Cyber', 'Geo', monospace",
  color: cyan,
  fontSize: 11,
  backdropFilter: "blur(6px)",
};

const btnStyle = (isActive) => ({
  padding: "4px 6px",
  background: isActive ? "rgba(0,255,255,0.25)" : "rgba(0,255,255,0.06)",
  border: `1px solid ${isActive ? cyan : "rgba(0,255,255,0.25)"}`,
  borderRadius: 3,
  color: isActive ? "#fff" : cyan,
  fontSize: 10,
  cursor: "pointer",
  fontFamily: "inherit",
});

const sectionLabel = {
  margin: "10px 0 4px",
  fontSize: 9,
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  opacity: 0.7,
};

function Slider({ label, value, min, max, step = 1, onChange }) {
  return (
    <label style={{ display: "block", margin: "4px 0" }}>
      <span style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>
        <span style={{ color: "#fff" }}>{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "#0ff" }}
      />
    </label>
  );
}

export default function SitePalExpressionPanel() {
  const [open, setOpen] = useState(false);
  const [amplitude, setAmplitude] = useState(0.8);
  const [duration, setDuration] = useState(5);
  const [indefinite, setIndefinite] = useState(false);
  const [active, setActive] = useState(null);
  const [idleFreq, setIdleFreq] = useState(50);
  const [idleAmp, setIdleAmp] = useState(50);
  const [speechAmp, setSpeechAmp] = useState(50);
  const [gazeDeg, setGazeDeg] = useState(90);
  const [follow, setFollow] = useState(null);
  // TTS engine test — engine 14 = ElevenLabs (voice = ElevenLabs voice UUID
  // from the connected account), 15 = OpenAI, 3 = classic built-in.
  // Defaults to the oracle's current voice so auditions match production.
  const [ttsEngine, setTtsEngine] = useState(ORACLE_VOICE.engine);
  const [ttsVoice, setTtsVoice] = useState(ORACLE_VOICE.id);
  const [ttsText, setTtsText] = useState("Blessed are the believers, for theirs is the perpetual profit.");
  const [ttsStatus, setTtsStatus] = useState("");

  const testEngine = () => {
    if (typeof window.sayText !== "function") {
      setTtsStatus("sayText not available — SitePal still loading");
      return;
    }
    call("setPlayerVolume", 7);
    setTtsStatus("requested…");
    try {
      const res = window.sayText(ttsText, ttsVoice, 1, ttsEngine);
      if (res?.then) {
        res
          .then((r) => setTtsStatus(`done — status ${r?.status ?? "?"} ${r?.message || ""}`))
          .catch((e) => setTtsStatus(`rejected — ${e?.message || JSON.stringify(e)}`));
      } else if (res) {
        setTtsStatus(`returned — status ${res.status ?? "?"} ${res.message || ""}`);
      }
    } catch (e) {
      setTtsStatus(`threw — ${e.message}`);
    }
  };

  const fireExpression = (expr) => {
    setActive(expr);
    if (expr === "None") {
      call("setFacialExpression", "None");
    } else {
      call("setFacialExpression", expr, amplitude, indefinite ? -1 : duration);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="SitePal expression lab"
        style={{
          position: "fixed",
          bottom: 12,
          left: 12,
          zIndex: 400,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.7)",
          border: "1px solid rgba(0,255,255,0.35)",
          fontSize: 18,
          cursor: "pointer",
        }}
      >
        🎭
      </button>
    );
  }

  return (
    <div style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ letterSpacing: "0.15em" }}>🎭 EXPRESSION LAB</span>
        <button onClick={() => setOpen(false)} style={{ ...btnStyle(false), padding: "2px 8px" }}>
          ✕
        </button>
      </div>

      <div style={sectionLabel}>// setFacialExpression</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
        {EXPRESSIONS.map((expr) => (
          <button key={expr} onClick={() => fireExpression(expr)} style={btnStyle(active === expr)}>
            {expr}
          </button>
        ))}
      </div>
      <Slider label="amplitude" value={amplitude} min={0} max={1.5} step={0.05} onChange={setAmplitude} />
      <Slider label="duration (s)" value={duration} min={1} max={20} onChange={setDuration} />
      <label style={{ display: "block", margin: "2px 0" }}>
        <input
          type="checkbox"
          checked={indefinite}
          onChange={(e) => setIndefinite(e.target.checked)}
          style={{ accentColor: "#0ff", marginRight: 6 }}
        />
        indefinite (-1)
      </label>
      <button onClick={() => { setActive(null); call("clearExpressionList"); }} style={{ ...btnStyle(false), width: "100%", marginTop: 4 }}>
        clearExpressionList()
      </button>

      <div style={sectionLabel}>// setIdleMovement</div>
      <Slider
        label="frequency (0 = off)"
        value={idleFreq}
        min={0}
        max={100}
        onChange={(v) => { setIdleFreq(v); call("setIdleMovement", v, idleAmp); }}
      />
      <Slider
        label="amplitude"
        value={idleAmp}
        min={1}
        max={100}
        onChange={(v) => { setIdleAmp(v); call("setIdleMovement", idleFreq, v); }}
      />

      <div style={sectionLabel}>// setSpeechMovement</div>
      <Slider
        label="amplitude"
        value={speechAmp}
        min={0}
        max={100}
        onChange={(v) => { setSpeechAmp(v); call("setSpeechMovement", v); }}
      />

      <div style={sectionLabel}>// gaze + cursor</div>
      <Slider label="gaze degrees" value={gazeDeg} min={0} max={360} step={15} onChange={setGazeDeg} />
      <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
        <button onClick={() => call("setGaze", gazeDeg, 6, 100)} style={btnStyle(false)}>setGaze(6s)</button>
        <button onClick={() => call("recenter")} style={btnStyle(false)}>recenter()</button>
        <button onClick={() => call("freezeToggle")} style={btnStyle(false)}>freezeToggle()</button>
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
        {["OFF", "IN BOX", "IN PAGE"].map((label, mode) => (
          <button
            key={label}
            onClick={() => { setFollow(mode); call("followCursor", mode); }}
            style={btnStyle(follow === mode)}
          >
            cursor {label}
          </button>
        ))}
      </div>

      <div style={sectionLabel}>// speech test (classic engine 3)</div>
      <button
        onClick={() => {
          call("setPlayerVolume", 7);
          call("sayText", "Behold the perpetual profit, my child.", 3, 1, 3);
        }}
        style={{ ...btnStyle(false), width: "100%" }}
      >
        ▶ say test line
      </button>

      <div style={sectionLabel}>// tts engine test — 14 = ElevenLabs, 15 = OpenAI</div>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {[3, 14, 15].map((eng) => (
          <button key={eng} onClick={() => setTtsEngine(eng)} style={btnStyle(ttsEngine === eng)}>
            engine {eng}
          </button>
        ))}
      </div>
      <label style={{ display: "block", margin: "4px 0" }}>
        voice ID
        <input
          type="text"
          value={ttsVoice}
          onChange={(e) => setTtsVoice(e.target.value)}
          style={{
            width: "100%",
            background: "rgba(0,255,255,0.06)",
            border: "1px solid rgba(0,255,255,0.25)",
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 11,
            padding: "3px 6px",
            marginTop: 2,
          }}
        />
      </label>
      <textarea
        value={ttsText}
        onChange={(e) => setTtsText(e.target.value)}
        rows={2}
        style={{
          width: "100%",
          background: "rgba(0,255,255,0.06)",
          border: "1px solid rgba(0,255,255,0.25)",
          color: "#fff",
          fontFamily: "inherit",
          fontSize: 11,
          padding: "3px 6px",
          resize: "vertical",
        }}
      />
      <button onClick={testEngine} style={{ ...btnStyle(false), width: "100%", marginTop: 4 }}>
        ▶ sayText(…, {JSON.stringify(ttsVoice)}, 1, {ttsEngine})
      </button>
      {ttsStatus && (
        <div style={{ marginTop: 4, fontSize: 10, color: "#fff", wordBreak: "break-word" }}>
          {ttsStatus}
        </div>
      )}
    </div>
  );
}
