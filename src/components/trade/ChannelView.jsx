"use client";
import React, { useEffect, useRef, useState } from "react";
import { CHARACTER_META } from "@/components/CaseFile/characterMeta";
import SitePalFeed from "@/components/trade/SitePalFeed";
import EvidenceOverlay, { hasRichVisual } from "@/components/EvidenceOverlay";

// Mobile CHANNEL view — what opens when you tap a consultant in the COUNCIL
// comms grid. The consultant's "feed" fills the CRT (portrait + scanlines +
// lens-color tint + a transmitting equalizer), their line types out as a
// caption, and their case questions sit below as tappable rows that each spend
// 1 of the shared 3 scans and reveal an evidence card.
//
// Presentational: the parent owns the game state (scansUsed, asked, revealed)
// and passes it down — same shape the real /trade page.js will drive. Voice is
// stubbed by the typed transcript for now (Web Speech TTS optional via `tts`).
const THREAT_COLORS = { red: "#ff5454", amber: "#ffb13a", green: "#4dffaa" };

export default function ChannelView({
  stationKey,
  station,            // caseData.stations[stationKey]
  caseId,             // e.g. "case-001" — used to resolve rich evidence visuals
  scansUsed = 0,
  scansMax = 3,
  asked = [],         // question indices already asked of THIS station
  revealed = [],      // evidence labels revealed so far for THIS station
  onAsk,              // (qIndex) => void
  onBack,
  onVerdict,
  tts = false,
  useSitePal = false,   // live SitePal avatar in the feed (Monk channel test)
  sitePalSceneId = 2774449,
  compact = false,      // desk (Case Table) layout: small fitted portrait card,
                        // caption beside it, centered column — mobile keeps the
                        // full-bleed hero when false
}) {
  const meta = CHARACTER_META[stationKey] || {};
  const color = meta.color || "#37e3e3";
  const scansLeft = scansMax - scansUsed;

  // Current line = the last-asked answer, else the intro.
  const lastAsked = asked.length ? asked[asked.length - 1] : null;
  const currentLine = lastAsked != null
    ? station.questions[lastAsked]?.a?.text || ""
    : station.intro?.text || "";

  // Line payload for the live SitePal feed (pre-recorded sayAudio preferred,
  // live TTS via the station voice as fallback). `key` changes per line so the
  // feed re-speaks on intro → each answer.
  const lineObj = useSitePal ? {
    key: lastAsked == null ? "intro" : `q${lastAsked}`,
    audio: lastAsked == null ? station.intro?.audio : station.questions[lastAsked]?.a?.audio,
    text: currentLine,
    voice: station.voice,
  } : null;

  // Live SitePal drives its own speaking state via talk callbacks
  // (vh_talkStarted → 'speaking', vh_talkEnded → 'ready'); the static portrait
  // path falls back to the typewriter as the speaking proxy.
  const [feedStatus, setFeedStatus] = useState("connecting");
  // SitePal's built-in caption text, mirrored up from SitePalFeed. It's perfectly
  // audio-synced, so when SitePal is driving we show THIS in the body caption below
  // (SitePal's on-video overlay is hidden), falling back to the typewriter only
  // until SitePal emits text for the current line.
  const [sitePalCaption, setSitePalCaption] = useState("");
  // Evidence entry currently expanded into the fullscreen EvidenceOverlay.
  const [evidenceEntry, setEvidenceEntry] = useState(null);

  // Caption typewriter (fallback when SitePal isn't supplying synced text). For the live SitePal feed we ANCHOR the caption to the
  // avatar's real speech instead of racing ahead on a fixed timer: it holds at
  // empty until talk actually begins ('speaking'), types at roughly speech pace,
  // and snaps to the full line the instant talk ends ('ready') so it never lags
  // the audio's finish. The static-portrait / Web-Speech path types immediately.
  const CHAR_MS = 108; // ~21 chars/sec — near natural speech, a hair ahead of it
  const [typed, setTyped] = useState("");
  const typedRef = useRef(0);

  // Reset the caption (and kick optional Web-Speech TTS) on each new line.
  useEffect(() => {
    typedRef.current = 0;
    setTyped("");
    setSitePalCaption("");
    if (!useSitePal && tts && typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(currentLine));
      } catch (e) {}
    }
  }, [currentLine, tts, useSitePal]);

  // When SitePal speech ends, snap to the full line so the caption can't trail
  // behind the audio finishing.
  useEffect(() => {
    if (useSitePal && feedStatus === "ready" && typedRef.current > 0 && typedRef.current < currentLine.length) {
      typedRef.current = currentLine.length;
      setTyped(currentLine);
    }
  }, [feedStatus, useSitePal, currentLine]);

  // Run the typewriter. For SitePal, only advance while the avatar is actually
  // speaking; the static path types straight away.
  useEffect(() => {
    const active = useSitePal ? feedStatus === "speaking" : true;
    if (!active || typedRef.current >= currentLine.length) return;
    const id = setInterval(() => {
      typedRef.current += 1;
      setTyped(currentLine.slice(0, typedRef.current));
      if (typedRef.current >= currentLine.length) clearInterval(id);
    }, CHAR_MS);
    return () => clearInterval(id);
  }, [currentLine, feedStatus, useSitePal]);

  const speaking = typed.length < currentLine.length;
  const isSpeaking = useSitePal ? feedStatus === "speaking" : speaking;
  // Prefer SitePal's perfectly-synced caption when it's driving; fall back to the
  // typewriter (non-SitePal, or before SitePal emits text for this line).
  const captionText = useSitePal ? (sitePalCaption || typed) : typed;
  const xmitLabel = useSitePal
    ? (feedStatus === "connecting" ? "CONNECTING" : feedStatus === "speaking" ? "TRANSMITTING" : "LISTENING")
    : (speaking ? "TRANSMITTING" : "STANDBY");

  // Evidence entries for the revealed labels, in reveal order.
  const evidence = revealed
    .map((label) => station.entries?.find((e) => e.label === label))
    .filter(Boolean);

  // translate="no": the caption is a live, rapidly-mutating text node that
  // mirrors the avatar's ENGLISH audio. Letting Chrome/Google translate
  // rewrite it (it wraps text in <font> tags) races React's updates and
  // throws "removeChild ... not a child of this node". Excluding it also
  // keeps the subtitle in sync with the spoken voice.
  const captionBlock = (
    <div className="cv-caption" translate="no">
      <span className="cv-caption-text notranslate">{captionText}</span>
      <span className="cv-cursor">{isSpeaking ? "▋" : ""}</span>
    </div>
  );

  const feedBlock = (
    <div className="cv-feed">
      {useSitePal ? (
        <SitePalFeed sceneId={sitePalSceneId} line={lineObj} onStatus={setFeedStatus} onCaption={setSitePalCaption} />
      ) : (
        <>
          <img className="cv-portrait" src={meta.portrait} alt={meta.name} draggable={false} />
          <span className="cv-tint" />
          <span className="cv-scan" />
        </>
      )}
      {!compact && (
        <span className="cv-feedtop">
          <span className="cv-name">{meta.name}</span>
          <span className="cv-xmit"><i className={`cv-dot${isSpeaking ? "" : " cv-dot--listen"}`} />{xmitLabel}</span>
        </span>
      )}
      {!compact && (
        <span className="cv-role">{meta.role} · {meta.roleSub} <span className="cv-sigil">{meta.sigil}</span></span>
      )}
      <span className={`cv-eq${isSpeaking ? " cv-eq--on" : ""}`}>
        {Array.from({ length: 9 }, (_, i) => <i key={i} style={{ animationDelay: `${i * 0.08}s` }} />)}
      </span>
    </div>
  );

  return (
    <div className={`cv-root${compact ? " cv-root--compact" : ""}`} style={{ "--cvc": color }}>
      {/* header */}
      <div className="cv-header">
        <button className="cv-back" onClick={onBack}>◀ COUNCIL</button>
        <span className="cv-scans">SCANS {Array.from({ length: scansMax }, (_, i) => (
          <i key={i} className={`cv-pip${i < scansLeft ? " cv-pip--on" : ""}`} />
        ))}</span>
      </div>

      {/* the feed — compact mode seats the fitted portrait card beside the
          caption; mobile keeps the full-bleed hero */}
      {compact ? (
        <div className="cv-hero">
          {feedBlock}
          <div className="cv-herotext">
            <div className="cv-herohead">
              <span className="cv-name">{meta.name}</span>
              <span className="cv-role-inline">{meta.role} · {meta.roleSub} <span className="cv-sigil">{meta.sigil}</span></span>
              <span className="cv-xmit"><i className={`cv-dot${isSpeaking ? "" : " cv-dot--listen"}`} />{xmitLabel}</span>
            </div>
            {captionBlock}
          </div>
        </div>
      ) : (
        feedBlock
      )}

      {/* scrollable body */}
      <div className="cv-body">
        {!compact && captionBlock}

        {evidence.length > 0 && (
          <div className="cv-evidence">
            {evidence.map((e) => (
              <div key={e.label} className="cv-card" style={{ "--th": THREAT_COLORS[e.threat] || color }}>
                <span className="cv-card-label">▣ {e.label}</span>
                <span className="cv-card-value">{e.value}</span>
                {hasRichVisual(caseId, stationKey, e) && (
                  <button className="cv-card-view" onClick={() => setEvidenceEntry(e)}>▸ VIEW EVIDENCE</button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="cv-qhead">INTERROGATE {scansLeft > 0 ? `· ${scansLeft} SCANS LEFT` : "· NO SCANS LEFT"}</div>
        <div className="cv-questions">
          {station.questions.map((q, i) => {
            const isAsked = asked.includes(i);
            const disabled = isAsked || scansLeft <= 0;
            return (
              <button
                key={i}
                className={`cv-q${isAsked ? " cv-q--asked" : ""}`}
                disabled={disabled}
                onClick={() => !disabled && onAsk?.(i)}
              >
                <span className="cv-q-mark">{isAsked ? "▣" : "▸"}</span>
                <span className="cv-q-text">{q.q}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* footer — hidden when the parent hasn't opened the verdict phase yet
          (the Case Table gates it until all actions are spent) */}
      {onVerdict && <button className="cv-verdict" onClick={onVerdict}>RENDER VERDICT ▸</button>}

      {/* Fullscreen "monitor view" of a revealed evidence card — same overlay
          the desktop VIEW EVIDENCE button opens. position:fixed, so it escapes
          the channel and covers the viewport. */}
      <EvidenceOverlay
        isActive={!!evidenceEntry}
        caseId={caseId}
        stationKey={stationKey}
        station={station}
        entry={evidenceEntry}
        onClose={() => setEvidenceEntry(null)}
      />

      <style>{`
        .cv-root {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          background: radial-gradient(120% 80% at 50% 30%, rgba(10,40,38,0.35), transparent), #02100e;
          color: #2fd6d6; font-family: 'Courier New', monospace; overflow: hidden; user-select: none;
        }
        .cv-root::after {
          content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 8;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0 1px, transparent 1px 3px),
                      radial-gradient(130% 100% at 50% 50%, transparent 62%, rgba(0,0,0,0.5));
          mix-blend-mode: multiply;
        }
        .cv-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 12px 8px; font-size: 12px; letter-spacing: 0.05em; z-index: 6;
        }
        .cv-back {
          background: none; border: 1px solid color-mix(in srgb, var(--cvc) 55%, transparent);
          color: var(--cvc); font: inherit; padding: 4px 10px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
        }
        .cv-scans { color: #ffd23a; display: inline-flex; align-items: center; gap: 4px; }
        .cv-pip { width: 8px; height: 8px; border: 1.5px solid #ffd23a; opacity: 0.4; }
        .cv-pip--on { background: #ffd23a; opacity: 1; box-shadow: 0 0 5px #ffd23a; }

        .cv-feed {
          /* Scale with the viewport so the feed never eats the whole screen on
             shorter phones — it shrinks to keep room for the caption, evidence
             and INTERROGATE questions below, and caps at 420px on tall screens.
             (plain-vh line is a fallback for browsers without dvh support.) */
          position: relative; margin: 0 12px; overflow: hidden; flex-shrink: 0;
          height: clamp(220px, 42vh, 420px);
          height: clamp(220px, 42dvh, 420px);
          border: 1.5px solid var(--cvc);
          clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 16px 100%, 0 calc(100% - 16px));
          box-shadow: inset 0 0 30px color-mix(in srgb, var(--cvc) 28%, transparent);
        }
        .cv-portrait {
          width: 100%; height: 100%; object-fit: cover; object-position: 50% 18%;
          filter: grayscale(0.4) contrast(1.12) brightness(0.85);
        }
        .cv-tint { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 45%, rgba(2,16,14,0.9)), var(--cvc); mix-blend-mode: color; opacity: 0.5; }
        .cv-scan { position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(0,0,0,0.26) 0 1px, transparent 1px 3px); }
        .cv-feedtop { position: absolute; top: 8px; left: 10px; right: 10px; z-index: 3; display: flex; align-items: center; justify-content: space-between; }
        .cv-name { font-size: 15px; font-weight: bold; color: #f4fffb; text-shadow: 0 0 8px color-mix(in srgb, var(--cvc) 60%, transparent); }
        .cv-xmit { font-size: 10px; letter-spacing: 0.06em; color: var(--cvc); display: inline-flex; align-items: center; gap: 5px; }
        .cv-dot { width: 6px; height: 6px; border-radius: 50%; background: #ff4040; box-shadow: 0 0 6px #ff4040; animation: cvblink 1s steps(1) infinite; }
        @keyframes cvblink { 50% { opacity: 0.25; } }
        .cv-dot--listen { background: #4dffaa; box-shadow: 0 0 6px #4dffaa; animation: none; }
        .cv-role { position: absolute; bottom: 8px; left: 10px; z-index: 3; font-size: 10px; letter-spacing: 0.12em; color: var(--cvc); }
        .cv-sigil { font-size: 13px; }
        .cv-eq { position: absolute; bottom: 8px; right: 10px; z-index: 3; display: flex; align-items: flex-end; gap: 2px; height: 16px; opacity: 0.35; }
        .cv-eq i { width: 3px; height: 4px; background: var(--cvc); }
        .cv-eq--on { opacity: 1; }
        .cv-eq--on i { animation: cveq 0.6s ease-in-out infinite alternate; }
        @keyframes cveq { to { height: 16px; } }

        .cv-body { flex: 1; min-height: 0; overflow-y: auto; padding: 12px; z-index: 6; }
        .cv-caption {
          /* SitePal feeds at most ~2 lines at a time, so the box only needs to
             reserve 2 lines (it still grows if a line wraps longer). */
          min-height: 38px; font-size: 13.5px; line-height: 1.4; color: #d6fff6;
          text-align: center; padding: 4px 12px 6px; margin-bottom: 10px;
          text-shadow: 0 0 6px rgba(47,214,214,0.25);
        }
        .cv-cursor { color: var(--cvc); }
        .cv-evidence { display: flex; flex-direction: column; gap: 7px; margin-bottom: 14px; }
        .cv-card {
          border: 1px solid var(--th); padding: 7px 9px; background: color-mix(in srgb, var(--th) 9%, #04140f);
          display: flex; flex-direction: column; gap: 2px;
          clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
        }
        .cv-card-label { font-size: 10.5px; letter-spacing: 0.08em; color: var(--th); text-shadow: 0 0 6px color-mix(in srgb, var(--th) 50%, transparent); }
        .cv-card-value { font-size: 12.5px; color: #eafff9; }
        .cv-card-view {
          margin-top: 7px; align-self: flex-start;
          background: color-mix(in srgb, var(--th) 12%, transparent);
          border: 1px solid var(--th); color: var(--th);
          font: inherit; font-size: 10px; letter-spacing: 0.2em; padding: 5px 11px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px));
        }
        .cv-card-view:active { transform: scale(0.98); }

        .cv-qhead { font-size: 10.5px; letter-spacing: 0.12em; color: #ffd23a; opacity: 0.85; margin-bottom: 8px; }
        .cv-questions { display: flex; flex-direction: column; gap: 7px; }
        .cv-q {
          display: flex; align-items: flex-start; gap: 8px; text-align: left;
          background: #061a18; border: 1px solid color-mix(in srgb, var(--cvc) 38%, transparent);
          color: #cdeee6; font: inherit; font-size: 12.5px; line-height: 1.35; padding: 9px 10px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
        }
        .cv-q:active { transform: scale(0.99); }
        .cv-q-mark { color: var(--cvc); }
        .cv-q--asked { opacity: 0.5; cursor: default; }
        .cv-q--asked .cv-q-mark { color: #4dffaa; }
        .cv-q:disabled { cursor: default; }

        .cv-verdict {
          margin: 8px 12px calc(env(safe-area-inset-bottom, 0px) + 12px); z-index: 6;
          background: color-mix(in srgb, var(--cvc) 16%, #04140f);
          border: 1.5px solid var(--cvc); color: #eafff9; font: inherit; font-weight: bold;
          letter-spacing: 0.08em; padding: 12px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
          box-shadow: 0 0 14px color-mix(in srgb, var(--cvc) 35%, transparent);
        }

        /* --- compact (desk / Case Table) variant --- */
        .cv-root--compact .cv-header,
        .cv-root--compact .cv-body,
        .cv-root--compact .cv-verdict,
        .cv-hero {
          width: 100%; max-width: 1000px; margin-left: auto; margin-right: auto; box-sizing: border-box;
        }
        .cv-hero { display: flex; gap: 16px; padding: 0 12px; align-items: stretch; z-index: 6; }
        .cv-root--compact .cv-feed {
          width: 168px; height: 224px; margin: 0; flex-shrink: 0;
          clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
        }
        .cv-herotext { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 9px; }
        .cv-herohead { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
        .cv-role-inline { font-size: 10px; letter-spacing: 0.12em; color: var(--cvc); }
        .cv-root--compact .cv-caption { text-align: left; padding: 0; margin: 0; min-height: 0; }
      `}</style>
    </div>
  );
}
