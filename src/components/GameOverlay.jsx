import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";



// ────────────────────────────────────────────────────────────────────────
// VERDICT MATH
// ────────────────────────────────────────────────────────────────────────

// Legacy discrete-verdict probabilities. Retained for back-compat with any
// caller that still submits a bucket string instead of a slider probability.
export const VERDICT_PROBS = { believe: 0.15, abstain: 0.5, doubt: 0.85 };

// Confidence-slider → bucket thresholds. A raw P(scam) value collapses to one
// of three buckets ONLY to choose which character reaction / vindication line /
// reveal glyph to show. The Brier score is always computed on the raw
// probability, never the bucket — that's the whole point of the slider.
export const VERDICT_THRESHOLDS = { believe: 0.34, doubt: 0.66 };

export function probabilityToVerdict(p) {
  if (typeof p !== "number" || Number.isNaN(p)) return "abstain";
  if (p <= VERDICT_THRESHOLDS.believe) return "believe";
  if (p >= VERDICT_THRESHOLDS.doubt) return "doubt";
  return "abstain";
}

export function computeBrier(verdictOrProb, correctVerdict) {
  // correctVerdict is "believe" (project legitimate) or "doubt" (project is scam).
  // We score against the binary outcome: was it a scam? (1 = yes, 0 = no).
  // Accepts either a numeric P(scam) in [0,1] (confidence slider) or a legacy
  // discrete verdict string (believe/abstain/doubt).
  if (correctVerdict == null) return null; // reviews have no ground truth
  const actual = correctVerdict === "doubt" ? 1 : 0;
  const predicted = typeof verdictOrProb === "number"
    ? verdictOrProb
    : VERDICT_PROBS[verdictOrProb];
  if (typeof predicted !== "number" || Number.isNaN(predicted)) return null;
  return Math.pow(predicted - actual, 2);
}

// Short, player-facing lens label for a station, derived from its `role`
// (e.g. "LOGOS · ONCHAIN" → "ONCHAIN"). Used by the post-game coaching note.
export function lensLabel(station) {
  if (!station?.role) return "";
  const parts = String(station.role).split("·");
  return (parts[parts.length - 1] || station.role).trim();
}

// Reflection on investigative breadth — nudges the player to triangulate across
// multiple consultants instead of reading a case through one character's lens.
// Deliberately outcome-agnostic (never scolds a correct call) and independent of
// any "decisive lens" label: it only counts how many *distinct* lenses the player
// actually spent scans on, since most cases have tells that converge across
// several voices. Shared by the desktop reveal (trade/page.js) and the mobile
// RevealScreen so the two can't drift. `investigated` may be a Set or an array of
// station keys. Returns { note, tone } — tone is 'affirm' (breadth), 'nudge'
// (single lens), or null (nothing investigated).
export function coverageNote(caseData, investigated) {
  const inv = investigated instanceof Set ? investigated : new Set(investigated || []);
  const consulted = inv.size;
  const total = caseData?.stations ? Object.keys(caseData.stations).length : 0;
  if (consulted === 0) return { note: null, tone: null };
  if (consulted === 1) {
    return {
      tone: "nudge",
      note: "You read this case through a single voice. The strongest calls come from cross-checking angles — one lens can mislead, but consultants who agree independently rarely do.",
    };
  }
  return {
    tone: "affirm",
    note: `You triangulated across ${consulted}${total ? ` of ${total}` : ""} voices — that's how you tell a real signal from one loud tell.`,
  };
}

// ────────────────────────────────────────────────────────────────────────
// SESSION SCORE — a running scorecard persisted in localStorage so the
// player can watch their calibration improve across cases. Graded (forensic)
// cases only; reviews have no ground truth and never call recordCaseResult.
// ────────────────────────────────────────────────────────────────────────

const SESSION_KEY = "rl80_terminal_session_v1";

function emptyScore() {
  return { count: 0, brierSum: 0, hits: 0, calls: 0, streak: 0, bestStreak: 0, deepReveals: 0 };
}

export function readSessionScore() {
  if (typeof window === "undefined") return emptyScore();
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return emptyScore();
    return { ...emptyScore(), ...JSON.parse(raw) };
  } catch (e) {
    return emptyScore();
  }
}

// Records one graded result and returns the updated scorecard.
//   brier       — the Brier score for this case (lower is better)
//   correct     — did the player's leaning match ground truth? true / false,
//                 or null when the player abstained (mid-band commit).
//   deepReveals — Tier-2 entries the player's kit surfaced this case
//                 (CASE_TABLE.md §3.4 — a counter, never part of the score).
export function recordCaseResult({ brier, correct, deepReveals = 0 }) {
  const s = readSessionScore();
  s.count += 1;
  if (typeof brier === "number") s.brierSum += brier;
  if (typeof deepReveals === "number" && deepReveals > 0) s.deepReveals += deepReveals;
  // Accuracy is measured over decisive calls only. Abstaining neither helps
  // nor hurts the hit rate; it just resets the streak (a miss does too).
  if (correct === true) {
    s.calls += 1;
    s.hits += 1;
    s.streak += 1;
    if (s.streak > s.bestStreak) s.bestStreak = s.streak;
  } else if (correct === false) {
    s.calls += 1;
    s.streak = 0;
  } else {
    s.streak = 0; // abstained
  }
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {}
  }
  return s;
}

export function sessionAvgBrier(s) {
  return s && s.count > 0 ? s.brierSum / s.count : null;
}

export function sessionAccuracy(s) {
  return s && s.calls > 0 ? s.hits / s.calls : null;
}

// ────────────────────────────────────────────────────────────────────────
// CASE FILES — case bodies live in src/components/game/cases/*.js
// Add a new case by dropping a `case-NNN.js` next to the others and
// appending it to `CASE_FILES` in `cases/index.js`.
// ────────────────────────────────────────────────────────────────────────

export { SAMPLE_CASE, CASE_002, CASE_FILES, CASES } from "./game/cases";

// Normalize a dialogue value into { text, audio }. Any string in the case data
// is treated as text-only (will use TTS via sayText); upgrading a line to
// pre-recorded audio is as simple as replacing the string with
// { text: "...", audio: "yourSitePalAudioName" }. `audio` always wins over `text`
// at playback time when SitePal sayAudio is available.
export function resolveLine(line) {
  if (line == null) return null;
  if (typeof line === 'string') return { text: line, audio: null, audioDurationMs: null, spoken: null };
  if (typeof line === 'object') {
    return {
      text: line.text || '',
      audio: line.audio || null,
      // Optional per-line override: when set, the reveal components pace
      // chunks proportionally across this duration so text and voice
      // land together. Without it they fall back to char-count pacing,
      // which can lag behind slow-spoken or heavily-paused lines.
      audioDurationMs: typeof line.audioDurationMs === 'number' ? line.audioDurationMs : null,
      // Optional spoken variant for TTS characters authored for on-screen
      // reading (Eugene): the bubble shows `text`, but her ElevenLabs voice
      // speaks `spoken` when present. Both are run through speechify() before
      // TTS; this just lets the writer supply exact phrasing where the auto
      // normalizer isn't enough. Falls back to `text` when absent.
      spoken: typeof line.spoken === 'string' ? line.spoken : null,
    };
  }
  return null;
}

// Pick a return line at random for a given station (used on revisits).
// Returns the raw value (string or {text, audio}); resolve at speak/display.
export function pickReturnLine(station) {
  const pool = station?.returnLines;
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Map a player's verdict + the correct verdict to which vindication key to play.
// "aligned" = called it right; "missed" = called it wrong; "abstained" = sat it out.
// When `correctVerdict` is null (Token Review service — no ground truth)
// every outcome falls through to "abstained" so the case doesn't grade
// the player against a non-existent answer key.
export function pickVindicationKey(verdict, correctVerdict) {
  if (verdict === "abstain") return "abstained";
  if (correctVerdict == null) return "abstained";
  return verdict === correctVerdict ? "aligned" : "missed";
}

// Monk leads the lineup — they wave to open the game and speak the briefing.
export const STATION_ORDER = ["monk", "demon", "marisol", "eugene"];

// ────────────────────────────────────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────────────────────────────────────

const LiminalTerminal = forwardRef(function LiminalTerminal({
  caseData = SAMPLE_CASE,
  onComplete,
  showIntro = true,           // pass false for veteran players (read from localStorage in your scene wrapper)
  onIntroDismissed,           // fires when player toggles "don't show again"
  onStart,                    // fires when player clicks START — wire to your TTS/audio cue here
  activeStation: activeStationProp,   // optional controlled prop — when defined, parent owns selection
  onActiveStationChange,      // fires when overlay or scan changes the active station
  hideVerdictBar = false,     // hide the bottom VerdictBar when the parent UI owns those buttons
}, ref) {
  // Phases: "intro" → "playing" → "verdict given" (verdict state itself signals reveal)
  const [phase, setPhase] = useState(showIntro ? "intro" : "playing");
  const [activeStationInternal, setActiveStationInternal] = useState(STATION_ORDER[0]);
  const isControlled = activeStationProp !== undefined && activeStationProp !== null;
  const activeStation = isControlled ? activeStationProp : activeStationInternal;
  const setActiveStation = (next) => {
    if (!isControlled) setActiveStationInternal(next);
    if (onActiveStationChange) onActiveStationChange(next);
  };
  const [investigated, setInvestigated] = useState(new Set());
  const [verdict, setVerdict] = useState(null);
  const [brier, setBrier] = useState(null);
  const [suppressIntro, setSuppressIntro] = useState(false);

  const scansRemaining = caseData.maxScans - investigated.size;
  const allScansUsed = scansRemaining <= 0;
  const hasInvestigated = investigated.size > 0;

  function startGame() {
    if (suppressIntro && onIntroDismissed) onIntroDismissed();
    if (onStart) onStart();   // <-- parent wires Monk speech / scene focus here
    setPhase("playing");
  }

  function scanStation(stationKey) {
    if (investigated.has(stationKey)) {
      setActiveStation(stationKey);
      return;
    }
    if (scansRemaining <= 0) return;
    const next = new Set(investigated);
    next.add(stationKey);
    setInvestigated(next);
    setActiveStation(stationKey);
  }

  function submitVerdict(v) {
    if (verdict) return;
    const score = computeBrier(v, caseData.correctVerdict);
    setVerdict(v);
    setBrier(score);
    if (onComplete) {
      onComplete({
        caseId: caseData.id,
        verdict: v,
        brierDelta: score,
        investigatedStations: Array.from(investigated),
      });
    }
  }

  useImperativeHandle(ref, () => ({
    submitVerdict,
    scanStation,
    getPhase: () => phase,
    hasVerdict: () => verdict !== null,
  }), [phase, verdict, investigated]);

  return (
    <div className="lt-root">
      <style>{STYLES}</style>
      <div className="lt-scanlines" aria-hidden />
      <div className="lt-noise" aria-hidden />

      {!verdict ? (
        <>
          <CaseHeader caseData={caseData} scansRemaining={scansRemaining} previewMode={phase === "intro"} />
          <StationTabs
            stations={caseData.stations}
            order={STATION_ORDER}
            active={activeStation}
            investigated={investigated}
            scansRemaining={scansRemaining}
            onSelect={scanStation}
            disabled={phase === "intro"}
          />
          <StationPanel
            station={caseData.stations[activeStation]}
            isInvestigated={investigated.has(activeStation)}
            scansRemaining={scansRemaining}
            onScan={() => scanStation(activeStation)}
          />
          {phase === "playing" && !hideVerdictBar && (
            <VerdictBar
              onVerdict={submitVerdict}
              enabled={hasInvestigated}
              allScansUsed={allScansUsed}
            />
          )}
          {phase === "intro" && (
            <IntroOverlay
              caseData={caseData}
              onStart={startGame}
              suppressIntro={suppressIntro}
              setSuppressIntro={setSuppressIntro}
            />
          )}
        </>
      ) : (
        <RevealView
          caseData={caseData}
          verdict={verdict}
          brier={brier}
          investigated={investigated}
        />
      )}
    </div>
  );
});

export default LiminalTerminal;

// ────────────────────────────────────────────────────────────────────────
// CASE HEADER
// ────────────────────────────────────────────────────────────────────────

function CaseHeader({ caseData, scansRemaining, previewMode }) {
  const m = caseData.surfaceMetrics;
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const time = new Date().toLocaleTimeString("en-GB");

  return (
    <header className="lt-header">
      <div className="lt-header-row">
        <div className="lt-tag">// CASE FILE</div>
        <div className="lt-case-id">{caseData.id.toUpperCase()}</div>
        <div className="lt-spacer" />
        <div className="lt-clock">● LIVE · {time}</div>
      </div>
      <div className="lt-title-row">
        <div>
          <h1 className="lt-title">
            {caseData.projectName} <span className="lt-ticker">{caseData.ticker}</span>
          </h1>
          <div className="lt-tagline">"{caseData.tagline}"</div>
        </div>
        <div className="lt-budget">
          <div className="lt-budget-num">
            {previewMode ? "—" : scansRemaining}<span className="lt-budget-slash">/</span>{caseData.maxScans}
          </div>
          <div className="lt-budget-label">{previewMode ? "AWAITING START" : "SCANS REMAINING"}</div>
        </div>
      </div>
      <div className="lt-metrics">
        <Metric label="CHAIN" value={caseData.chain} />
        <Metric label="AGE" value={m.age} />
        <Metric label="MCAP" value={m.mcap} />
        <Metric label="HOLDERS" value={m.holders} />
        <Metric label="PRICE" value={m.price} />
        <Metric label="24H" value={m.change24h} positive={m.change24h.startsWith("+")} />
      </div>
    </header>
  );
}

function Metric({ label, value, positive }) {
  return (
    <div className="lt-metric">
      <div className="lt-metric-label">{label}</div>
      <div className={`lt-metric-value ${positive === true ? "is-pos" : ""} ${positive === false ? "is-neg" : ""}`}>
        {value}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// STATION TABS — the four character workstations
// ────────────────────────────────────────────────────────────────────────

function StationTabs({ stations, order, active, investigated, scansRemaining, onSelect, disabled }) {
  return (
    <nav className="lt-tabs">
      {order.map((key) => {
        const s = stations[key];
        const isActive = active === key;
        const isInvestigated = investigated.has(key);
        const isLocked = disabled || (!isInvestigated && scansRemaining <= 0);
        return (
          <button
            key={key}
            className={[
              "lt-tab",
              isActive && "is-active",
              isInvestigated && "is-investigated",
              isLocked && "is-locked",
            ].filter(Boolean).join(" ")}
            onClick={() => onSelect(key)}
            disabled={isLocked}
          >
            <div className="lt-tab-sigil">{s.sigil}</div>
            <div className="lt-tab-meta">
              <div className="lt-tab-name">{s.character}</div>
              <div className="lt-tab-role">{s.role}</div>
            </div>
            <div className="lt-tab-status">
              {isInvestigated ? "✓" : isLocked ? "—" : "?"}
            </div>
          </button>
        );
      })}
    </nav>
  );
}

// ────────────────────────────────────────────────────────────────────────
// INTRO OVERLAY — first-run instructional panel
// ────────────────────────────────────────────────────────────────────────

function IntroOverlay({ caseData, onStart, suppressIntro, setSuppressIntro }) {
  const [armed, setArmed] = useState(false);

  // Force a 2-second read pause before START becomes clickable.
  // Resists reflex-clicks and signals "this is a thing you take seriously."
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="lt-intro-scrim">
      <div className="lt-intro">
        <div className="lt-intro-stamp">// LIMINAL TERMINAL · BRIEFING</div>
        <h2 className="lt-intro-title">THE LIMINAL TERMINAL</h2>
        <div className="lt-intro-subtitle">
          Crypto forensics. Four investigators. Your verdict.
        </div>

        <div className="lt-intro-cast">
          {STATION_ORDER.map((key) => {
            const s = caseData.stations[key];
            return (
              <div key={key} className="lt-intro-card">
                <div className="lt-intro-card-sigil">{s.sigil}</div>
                <div className="lt-intro-card-name">{s.character}</div>
                <div className="lt-intro-card-role">{s.role}</div>
                <div className="lt-intro-card-line">"{s.tagline}"</div>
              </div>
            );
          })}
        </div>

        <div className="lt-intro-rules">
          <div className="lt-intro-rule">
            <div className="lt-intro-rule-num">01</div>
            <div className="lt-intro-rule-body">
              <div className="lt-intro-rule-head">SPEND YOUR SCANS</div>
              <div className="lt-intro-rule-text">
                You have <strong>{caseData.maxScans} scans</strong> across the four stations. Pick where to look — what you skip, you won't see.
              </div>
            </div>
          </div>
          <div className="lt-intro-rule">
            <div className="lt-intro-rule-num">02</div>
            <div className="lt-intro-rule-body">
              <div className="lt-intro-rule-head">SET YOUR CONFIDENCE</div>
              <div className="lt-intro-rule-text">
                Render judgment on a dial: slide toward <span className="lt-tone-believe">Trust</span> (legit) or <span className="lt-tone-doubt">Doubt</span> (scam), or leave it centered to <span className="lt-tone-abstain">Abstain</span>. You can rule before exhausting your scans.
              </div>
            </div>
          </div>
          <div className="lt-intro-rule">
            <div className="lt-intro-rule-num">03</div>
            <div className="lt-intro-rule-body">
              <div className="lt-intro-rule-head">CALIBRATION OVER LUCK</div>
              <div className="lt-intro-rule-text">
                Confident-and-right beats hedging. Confident-and-wrong is worse than abstaining. Lower Brier is better.
              </div>
            </div>
          </div>
        </div>

        <div className="lt-intro-actions">
          <button
            className={`lt-intro-start ${armed ? "is-armed" : ""}`}
            onClick={onStart}
            disabled={!armed}
          >
            {armed ? "▸ START" : "CALIBRATING…"}
          </button>
          <label className="lt-intro-suppress">
            <input
              type="checkbox"
              checked={suppressIntro}
              onChange={(e) => setSuppressIntro(e.target.checked)}
            />
            <span>Don't show this again</span>
          </label>
        </div>

        <div className="lt-intro-foot">
          The case is on the bench. Read carefully. Begin when ready.
        </div>
      </div>
    </div>
  );
}



function StationPanel({ station, isInvestigated, scansRemaining, onScan }) {
  if (!isInvestigated) {
    const canScan = scansRemaining > 0;
    return (
      <section className="lt-panel lt-panel-locked">
        <div className="lt-locked-sigil">{station.sigil}</div>
        <div className="lt-locked-name">{station.character}</div>
        <div className="lt-locked-role">{station.role}</div>
        <div className="lt-locked-tagline">"{station.tagline}"</div>
        <button className="lt-scan-btn" onClick={onScan} disabled={!canScan}>
          {canScan ? "▸ INITIATE SCAN" : "▸ NO SCANS REMAINING"}
        </button>
        {canScan && <div className="lt-scan-hint">Costs 1 of {scansRemaining} scans</div>}
      </section>
    );
  }

  return (
    <section className="lt-panel">
      <div className="lt-panel-head">
        <div className="lt-panel-name">
          <span className="lt-panel-sigil">{station.sigil}</span> {station.character}
        </div>
        <div className="lt-panel-role">{station.role}</div>
      </div>
      <div className="lt-entries">
        {station.entries.map((e, i) => (
          <Entry key={i} entry={e} delay={i * 80} />
        ))}
      </div>
      <div className={`lt-summary lt-summary-${dominantThreat(station.entries)}`}>
        <div className="lt-summary-tag">// {station.character} CONCLUDES</div>
        <div className="lt-summary-text">{station.summary}</div>
      </div>
    </section>
  );
}

function Entry({ entry, delay }) {
  return (
    <div
      className={`lt-entry lt-threat-${entry.threat}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="lt-entry-label">{entry.label}</div>
      <div className="lt-entry-value">{entry.value}</div>
      <div className="lt-entry-flag">{threatGlyph(entry.threat)}</div>
    </div>
  );
}

function threatGlyph(t) {
  return t === "red" ? "▲" : t === "amber" ? "◆" : "○";
}

function dominantThreat(entries) {
  const counts = entries.reduce((acc, e) => {
    acc[e.threat] = (acc[e.threat] || 0) + 1;
    return acc;
  }, {});
  if ((counts.red || 0) >= 2) return "red";
  if ((counts.amber || 0) >= 2) return "amber";
  return "green";
}

// ────────────────────────────────────────────────────────────────────────
// VERDICT BAR
// ────────────────────────────────────────────────────────────────────────

function VerdictBar({ onVerdict, enabled, allScansUsed }) {
  return (
    <footer className="lt-verdict">
      <div className="lt-verdict-prompt">
        {!enabled
          ? "▸ Investigate at least one station to render a verdict"
          : allScansUsed
            ? "▸ All scans used. Render your verdict."
            : "▸ Render verdict, or scan another station"}
      </div>
      <div className="lt-verdict-buttons">
        <button
          className="lt-vbtn lt-vbtn-believe"
          onClick={() => onVerdict("believe")}
          disabled={!enabled}
        >
          BELIEVE
        </button>
        <button
          className="lt-vbtn lt-vbtn-abstain"
          onClick={() => onVerdict("abstain")}
          disabled={!enabled}
        >
          ABSTAIN
        </button>
        <button
          className="lt-vbtn lt-vbtn-doubt"
          onClick={() => onVerdict("doubt")}
          disabled={!enabled}
        >
          DOUBT
        </button>
      </div>
    </footer>
  );
}

// ────────────────────────────────────────────────────────────────────────
// REVEAL — what the player sees after voting
// ────────────────────────────────────────────────────────────────────────

function RevealView({ caseData, verdict, brier, investigated }) {
  const isCorrect = verdict === caseData.correctVerdict;
  const isAbstain = verdict === "abstain";
  const grade = brier <= 0.05 ? "EXCELLENT" : brier <= 0.15 ? "STRONG" : brier <= 0.30 ? "FAIR" : "POOR";
  const gradeClass = brier <= 0.15 ? "is-good" : brier <= 0.30 ? "is-mid" : "is-bad";

  return (
    <div className="lt-reveal">
      <div className="lt-reveal-mark">
        <div className={`lt-reveal-glyph ${isCorrect ? "is-correct" : isAbstain ? "is-abstain" : "is-wrong"}`}>
          {isCorrect ? "✓" : isAbstain ? "◇" : "✗"}
        </div>
        <div className="lt-reveal-verdict-label">YOU RENDERED</div>
        <div className="lt-reveal-verdict-name">{verdict.toUpperCase()}</div>
      </div>

      <div className="lt-reveal-truth">
        <div className="lt-reveal-tag">// GROUND TRUTH</div>
        <div className="lt-reveal-summary">{caseData.reveal.summary}</div>
      </div>

      <div className="lt-reveal-score">
        <div className="lt-score-block">
          <div className="lt-score-label">BRIER</div>
          <div className={`lt-score-value ${gradeClass}`}>{brier.toFixed(3)}</div>
        </div>
        <div className="lt-score-block">
          <div className="lt-score-label">GRADE</div>
          <div className={`lt-score-value ${gradeClass}`}>{grade}</div>
        </div>
        <div className="lt-score-block">
          <div className="lt-score-label">SCANS USED</div>
          <div className="lt-score-value">{investigated.size}/{caseData.maxScans}</div>
        </div>
      </div>

      <div className="lt-reveal-voice">
        <div className="lt-reveal-tag">// THE TERMINAL RESPONDS</div>
        <div className="lt-reveal-voice-text">"{caseData.reveal.voices[verdict]}"</div>
      </div>

      <div className="lt-reveal-hint">
        Press CONTINUE in the parent scene to load the next case.
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// STYLES — terminal phosphor + sacred serif
// ────────────────────────────────────────────────────────────────────────

const STYLES = `
.lt-root {
  --lt-bg: #050a07;
  --lt-bg-2: #0a1410;
  --lt-frame: #0a3a26;
  --lt-frame-bright: #0e6b44;
  --lt-text: #c8ffe0;
  --lt-text-dim: #6db59a;
  --lt-text-faint: #3a6b54;
  --lt-phos: #4dffaa;
  --lt-phos-bright: #8effc4;
  --lt-amber: #ffb84d;
  --lt-red: #ff4d6d;
  --lt-magenta: #ff3ea0;

  --lt-mono: 'JetBrains Mono', 'IBM Plex Mono', 'SF Mono', Menlo, monospace;
  --lt-display: 'Cinzel Decorative', 'Cinzel', Didot, 'Bodoni 72', serif;

  position: relative;
  width: 100%;
  height: 100%;
  min-height: 600px;
  background:
    radial-gradient(ellipse at top, rgba(13, 80, 50, 0.18), transparent 70%),
    var(--lt-bg);
  color: var(--lt-text);
  font-family: var(--lt-mono);
  font-size: 13px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--lt-frame);
  box-shadow:
    inset 0 0 60px rgba(0, 255, 130, 0.06),
    inset 0 0 1px rgba(77, 255, 170, 0.4);
}

.lt-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0px,
    transparent 2px,
    rgba(0, 0, 0, 0.18) 3px,
    rgba(0, 0, 0, 0.18) 4px
  );
  z-index: 100;
  mix-blend-mode: multiply;
}

.lt-noise {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 99;
  opacity: 0.04;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.6'/></svg>");
}

/* ─────────── HEADER ─────────── */
.lt-header {
  padding: 18px 24px 14px;
  border-bottom: 1px solid var(--lt-frame);
  background: linear-gradient(to bottom, rgba(13,80,50,0.10), transparent);
}
.lt-header-row {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--lt-text-dim);
  margin-bottom: 12px;
}
.lt-tag { color: var(--lt-phos); font-weight: 600; }
.lt-case-id { color: var(--lt-text-faint); }
.lt-spacer { flex: 1; }
.lt-clock { color: var(--lt-phos); font-weight: 600; }

.lt-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
}
.lt-title {
  font-family: var(--lt-display);
  font-weight: 700;
  font-size: 28px;
  margin: 0;
  color: var(--lt-phos-bright);
  letter-spacing: 1px;
  text-shadow: 0 0 20px rgba(77, 255, 170, 0.4);
}
.lt-ticker {
  font-family: var(--lt-mono);
  font-size: 16px;
  color: var(--lt-magenta);
  margin-left: 10px;
  letter-spacing: 2px;
}
.lt-tagline {
  font-style: italic;
  color: var(--lt-text-dim);
  font-size: 12px;
  margin-top: 4px;
  letter-spacing: 0.3px;
}

.lt-budget {
  text-align: right;
  border-left: 1px solid var(--lt-frame);
  padding-left: 18px;
}
.lt-budget-num {
  font-family: var(--lt-display);
  font-size: 36px;
  color: var(--lt-phos-bright);
  line-height: 1;
  text-shadow: 0 0 12px rgba(77, 255, 170, 0.5);
}
.lt-budget-slash {
  color: var(--lt-text-faint);
  margin: 0 2px;
  font-size: 24px;
}
.lt-budget-label {
  font-size: 10px;
  letter-spacing: 2px;
  color: var(--lt-text-dim);
  margin-top: 4px;
}

.lt-metrics {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 14px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--lt-frame);
}
.lt-metric {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.lt-metric-label {
  font-size: 9px;
  letter-spacing: 2px;
  color: var(--lt-text-faint);
}
.lt-metric-value {
  font-size: 14px;
  color: var(--lt-text);
  font-weight: 600;
}
.lt-metric-value.is-pos { color: var(--lt-phos); }
.lt-metric-value.is-neg { color: var(--lt-red); }

/* ─────────── TABS ─────────── */
.lt-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
  border-bottom: 1px solid var(--lt-frame);
  background: var(--lt-bg-2);
}
.lt-tab {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: transparent;
  border: none;
  border-right: 1px solid var(--lt-frame);
  color: var(--lt-text-dim);
  cursor: pointer;
  font-family: var(--lt-mono);
  text-align: left;
  transition: background 0.18s, color 0.18s;
  position: relative;
}
.lt-tab:last-child { border-right: none; }
.lt-tab:hover:not(:disabled) {
  background: rgba(77, 255, 170, 0.04);
  color: var(--lt-text);
}
.lt-tab.is-active {
  background: rgba(77, 255, 170, 0.08);
  color: var(--lt-phos-bright);
  box-shadow: inset 0 -2px 0 var(--lt-phos);
}
.lt-tab.is-investigated .lt-tab-status { color: var(--lt-phos); }
.lt-tab.is-locked {
  opacity: 0.35;
  cursor: not-allowed;
}
.lt-tab-sigil {
  font-family: var(--lt-display);
  font-size: 22px;
  color: var(--lt-phos);
  width: 28px;
  text-align: center;
}
.lt-tab.is-active .lt-tab-sigil {
  text-shadow: 0 0 10px var(--lt-phos);
}
.lt-tab-meta { flex: 1; min-width: 0; }
.lt-tab-name {
  font-family: var(--lt-display);
  font-size: 14px;
  letter-spacing: 1px;
  color: inherit;
}
.lt-tab-role {
  font-size: 9px;
  letter-spacing: 2px;
  color: var(--lt-text-faint);
  margin-top: 2px;
}
.lt-tab-status {
  font-size: 14px;
  color: var(--lt-text-faint);
  width: 16px;
  text-align: center;
}

/* ─────────── PANEL ─────────── */
.lt-panel {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
  scrollbar-color: var(--lt-frame) var(--lt-bg);
  scrollbar-width: thin;
}
.lt-panel::-webkit-scrollbar { width: 6px; }
.lt-panel::-webkit-scrollbar-thumb { background: var(--lt-frame); }

.lt-panel-locked {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
}
.lt-locked-sigil {
  font-family: var(--lt-display);
  font-size: 72px;
  color: var(--lt-frame-bright);
  text-shadow: 0 0 30px rgba(77, 255, 170, 0.3);
  margin-bottom: 8px;
  animation: lt-pulse 3s ease-in-out infinite;
}
.lt-locked-name {
  font-family: var(--lt-display);
  font-size: 22px;
  color: var(--lt-phos-bright);
  letter-spacing: 2px;
}
.lt-locked-role {
  font-size: 11px;
  letter-spacing: 3px;
  color: var(--lt-text-dim);
}
.lt-locked-tagline {
  font-style: italic;
  color: var(--lt-text-dim);
  margin: 12px 0 24px;
  max-width: 420px;
  font-size: 13px;
}
.lt-scan-btn {
  background: transparent;
  border: 1px solid var(--lt-phos);
  color: var(--lt-phos);
  padding: 12px 32px;
  font-family: var(--lt-mono);
  font-size: 12px;
  letter-spacing: 3px;
  cursor: pointer;
  transition: all 0.2s;
}
.lt-scan-btn:hover:not(:disabled) {
  background: rgba(77, 255, 170, 0.1);
  box-shadow: 0 0 24px rgba(77, 255, 170, 0.3);
}
.lt-scan-btn:disabled {
  border-color: var(--lt-frame);
  color: var(--lt-text-faint);
  cursor: not-allowed;
}
.lt-scan-hint {
  font-size: 10px;
  letter-spacing: 2px;
  color: var(--lt-text-faint);
  margin-top: 10px;
}

.lt-panel-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--lt-frame);
}
.lt-panel-name {
  font-family: var(--lt-display);
  font-size: 20px;
  color: var(--lt-phos-bright);
  letter-spacing: 1.5px;
}
.lt-panel-sigil {
  color: var(--lt-magenta);
  margin-right: 6px;
  text-shadow: 0 0 10px var(--lt-magenta);
}
.lt-panel-role {
  font-size: 10px;
  letter-spacing: 3px;
  color: var(--lt-text-dim);
}

.lt-entries {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.lt-entry {
  display: grid;
  grid-template-columns: 200px 1fr 24px;
  gap: 16px;
  align-items: center;
  padding: 10px 14px;
  background: rgba(10, 58, 38, 0.18);
  border-left: 2px solid var(--lt-frame);
  font-size: 12px;
  opacity: 0;
  animation: lt-fade-in 0.4s ease-out forwards;
}
.lt-entry-label {
  font-size: 10px;
  letter-spacing: 2px;
  color: var(--lt-text-dim);
}
.lt-entry-value { color: var(--lt-text); }
.lt-entry-flag {
  text-align: center;
  font-size: 12px;
}
.lt-threat-green { border-left-color: var(--lt-phos); }
.lt-threat-green .lt-entry-flag { color: var(--lt-phos); }
.lt-threat-amber { border-left-color: var(--lt-amber); background: rgba(120, 80, 0, 0.10); }
.lt-threat-amber .lt-entry-flag { color: var(--lt-amber); }
.lt-threat-red { border-left-color: var(--lt-red); background: rgba(120, 0, 30, 0.12); }
.lt-threat-red .lt-entry-flag { color: var(--lt-red); }

.lt-summary {
  margin-top: 18px;
  padding: 14px 16px;
  background: rgba(13, 80, 50, 0.10);
  border: 1px solid var(--lt-frame);
}
.lt-summary-tag {
  font-size: 9px;
  letter-spacing: 3px;
  color: var(--lt-text-faint);
  margin-bottom: 6px;
}
.lt-summary-text {
  font-family: var(--lt-display);
  font-size: 14px;
  color: var(--lt-text);
  font-style: italic;
}
.lt-summary-red { border-color: var(--lt-red); background: rgba(120, 0, 30, 0.10); }
.lt-summary-amber { border-color: var(--lt-amber); }

/* ─────────── VERDICT BAR ─────────── */
.lt-verdict {
  border-top: 1px solid var(--lt-frame);
  background: var(--lt-bg-2);
  padding: 14px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
}
.lt-verdict-prompt {
  font-size: 11px;
  letter-spacing: 1.5px;
  color: var(--lt-text-dim);
}
.lt-verdict-buttons {
  display: flex;
  gap: 8px;
}
.lt-vbtn {
  background: transparent;
  border: 1px solid;
  padding: 10px 24px;
  font-family: var(--lt-display);
  font-size: 13px;
  letter-spacing: 3px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 110px;
}
.lt-vbtn:disabled { opacity: 0.3; cursor: not-allowed; }
.lt-vbtn-believe { border-color: var(--lt-phos); color: var(--lt-phos); }
.lt-vbtn-believe:hover:not(:disabled) {
  background: rgba(77, 255, 170, 0.12);
  box-shadow: 0 0 20px rgba(77, 255, 170, 0.4);
}
.lt-vbtn-abstain { border-color: var(--lt-text-dim); color: var(--lt-text-dim); }
.lt-vbtn-abstain:hover:not(:disabled) {
  background: rgba(109, 181, 154, 0.10);
  color: var(--lt-text);
}
.lt-vbtn-doubt { border-color: var(--lt-red); color: var(--lt-red); }
.lt-vbtn-doubt:hover:not(:disabled) {
  background: rgba(255, 77, 109, 0.12);
  box-shadow: 0 0 20px rgba(255, 77, 109, 0.35);
}

/* ─────────── REVEAL ─────────── */
.lt-reveal {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  text-align: center;
  gap: 24px;
  animation: lt-fade-in 0.5s ease-out;
}
.lt-reveal-mark {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.lt-reveal-glyph {
  font-family: var(--lt-display);
  font-size: 96px;
  line-height: 1;
}
.lt-reveal-glyph.is-correct {
  color: var(--lt-phos-bright);
  text-shadow: 0 0 40px var(--lt-phos);
}
.lt-reveal-glyph.is-abstain { color: var(--lt-text-dim); }
.lt-reveal-glyph.is-wrong {
  color: var(--lt-red);
  text-shadow: 0 0 40px rgba(255, 77, 109, 0.6);
}
.lt-reveal-verdict-label {
  font-size: 10px;
  letter-spacing: 4px;
  color: var(--lt-text-faint);
}
.lt-reveal-verdict-name {
  font-family: var(--lt-display);
  font-size: 20px;
  letter-spacing: 4px;
  color: var(--lt-phos-bright);
}

.lt-reveal-truth {
  max-width: 560px;
  padding: 16px 20px;
  border: 1px solid var(--lt-frame);
  background: rgba(13, 80, 50, 0.08);
}
.lt-reveal-tag {
  font-size: 10px;
  letter-spacing: 3px;
  color: var(--lt-text-faint);
  margin-bottom: 8px;
}
.lt-reveal-summary {
  font-family: var(--lt-display);
  font-size: 16px;
  color: var(--lt-text);
}

.lt-reveal-score {
  display: flex;
  gap: 32px;
  padding: 16px 24px;
  border: 1px solid var(--lt-frame);
}
.lt-score-block { text-align: center; }
.lt-score-label {
  font-size: 9px;
  letter-spacing: 3px;
  color: var(--lt-text-faint);
  margin-bottom: 4px;
}
.lt-score-value {
  font-family: var(--lt-display);
  font-size: 26px;
  color: var(--lt-text);
}
.lt-score-value.is-good {
  color: var(--lt-phos-bright);
  text-shadow: 0 0 12px rgba(77, 255, 170, 0.5);
}
.lt-score-value.is-mid { color: var(--lt-amber); }
.lt-score-value.is-bad { color: var(--lt-red); }

.lt-reveal-voice {
  max-width: 560px;
  padding: 14px 20px;
  background: rgba(255, 62, 160, 0.05);
  border-left: 2px solid var(--lt-magenta);
}
.lt-reveal-voice-text {
  font-style: italic;
  color: var(--lt-text);
  font-size: 13px;
}

.lt-reveal-hint {
  font-size: 10px;
  letter-spacing: 2px;
  color: var(--lt-text-faint);
  margin-top: 8px;
}

/* ─────────── ANIMATIONS ─────────── */
@keyframes lt-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes lt-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.55; }
}
@keyframes lt-intro-rise {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes lt-arm-glow {
  from { box-shadow: 0 0 0 rgba(77, 255, 170, 0); }
  to   { box-shadow: 0 0 28px rgba(77, 255, 170, 0.4); }
}

/* ─────────── INTRO OVERLAY ─────────── */
.lt-intro-scrim {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(ellipse at center, rgba(5, 10, 7, 0.78) 0%, rgba(5, 10, 7, 0.95) 100%);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: lt-fade-in 0.4s ease-out;
}
.lt-intro {
  width: min(720px, 100%);
  max-height: 100%;
  overflow-y: auto;
  padding: 28px 32px 24px;
  background: linear-gradient(to bottom, rgba(13, 80, 50, 0.18), rgba(5, 10, 7, 0.95));
  border: 1px solid var(--lt-frame-bright);
  box-shadow:
    0 0 80px rgba(13, 80, 50, 0.4),
    inset 0 0 60px rgba(0, 255, 130, 0.04);
  animation: lt-intro-rise 0.5s ease-out;
  scrollbar-color: var(--lt-frame) var(--lt-bg);
  scrollbar-width: thin;
}
.lt-intro::-webkit-scrollbar { width: 6px; }
.lt-intro::-webkit-scrollbar-thumb { background: var(--lt-frame); }

.lt-intro-stamp {
  font-size: 10px;
  letter-spacing: 3px;
  color: var(--lt-phos);
  margin-bottom: 6px;
}
.lt-intro-title {
  font-family: var(--lt-display);
  font-size: 30px;
  font-weight: 700;
  color: var(--lt-phos-bright);
  letter-spacing: 2px;
  margin: 0;
  text-shadow: 0 0 24px rgba(77, 255, 170, 0.5);
}
.lt-intro-subtitle {
  font-style: italic;
  color: var(--lt-text-dim);
  font-size: 13px;
  margin-top: 4px;
  margin-bottom: 22px;
  letter-spacing: 0.4px;
}

.lt-intro-cast {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 22px;
}
.lt-intro-card {
  padding: 12px 10px;
  background: rgba(10, 58, 38, 0.18);
  border: 1px solid var(--lt-frame);
  border-top: 2px solid var(--lt-phos);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.lt-intro-card-sigil {
  font-family: var(--lt-display);
  font-size: 22px;
  color: var(--lt-magenta);
  text-shadow: 0 0 10px rgba(255, 62, 160, 0.4);
}
.lt-intro-card-name {
  font-family: var(--lt-display);
  font-size: 13px;
  color: var(--lt-phos-bright);
  letter-spacing: 1px;
}
.lt-intro-card-role {
  font-size: 8px;
  letter-spacing: 2px;
  color: var(--lt-text-faint);
}
.lt-intro-card-line {
  font-size: 10px;
  font-style: italic;
  color: var(--lt-text-dim);
  margin-top: 4px;
  line-height: 1.4;
}

.lt-intro-rules {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 22px;
  padding: 14px 16px;
  background: rgba(13, 80, 50, 0.08);
  border-left: 2px solid var(--lt-frame-bright);
}
.lt-intro-rule {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 12px;
  align-items: start;
}
.lt-intro-rule-num {
  font-family: var(--lt-display);
  font-size: 18px;
  color: var(--lt-phos);
  line-height: 1;
}
.lt-intro-rule-head {
  font-size: 10px;
  letter-spacing: 2.5px;
  color: var(--lt-phos-bright);
  margin-bottom: 3px;
}
.lt-intro-rule-text {
  font-size: 12px;
  color: var(--lt-text);
  line-height: 1.5;
}
.lt-intro-rule-text strong {
  color: var(--lt-phos-bright);
  font-weight: 600;
}
.lt-tone-believe { color: var(--lt-phos); font-weight: 600; }
.lt-tone-abstain { color: var(--lt-text-dim); font-weight: 600; }
.lt-tone-doubt   { color: var(--lt-red); font-weight: 600; }

.lt-intro-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}
.lt-intro-start {
  background: transparent;
  border: 1px solid var(--lt-frame);
  color: var(--lt-text-faint);
  padding: 14px 40px;
  font-family: var(--lt-display);
  font-size: 16px;
  letter-spacing: 5px;
  cursor: not-allowed;
  transition: all 0.3s;
}
.lt-intro-start.is-armed {
  border-color: var(--lt-phos);
  color: var(--lt-phos-bright);
  cursor: pointer;
  animation: lt-arm-glow 0.6s ease-out forwards;
}
.lt-intro-start.is-armed:hover {
  background: rgba(77, 255, 170, 0.12);
  box-shadow: 0 0 36px rgba(77, 255, 170, 0.5);
}
.lt-intro-suppress {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  letter-spacing: 1.5px;
  color: var(--lt-text-dim);
  cursor: pointer;
  user-select: none;
}
.lt-intro-suppress input {
  appearance: none;
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border: 1px solid var(--lt-frame-bright);
  background: transparent;
  cursor: pointer;
  position: relative;
}
.lt-intro-suppress input:checked {
  background: var(--lt-phos);
  box-shadow: 0 0 8px rgba(77, 255, 170, 0.5);
}
.lt-intro-foot {
  font-size: 11px;
  font-style: italic;
  color: var(--lt-text-faint);
  text-align: center;
  letter-spacing: 0.5px;
  padding-top: 12px;
  border-top: 1px dashed var(--lt-frame);
}

@media (max-width: 640px) {
  .lt-intro-cast { grid-template-columns: repeat(2, 1fr); }
  .lt-intro { padding: 22px 18px; }
  .lt-intro-title { font-size: 22px; }
  .lt-intro-actions { flex-direction: column; }
}
`;
