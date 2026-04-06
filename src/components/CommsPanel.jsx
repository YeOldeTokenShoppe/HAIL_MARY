"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";

/**
 * CommsPanel — retro CRT comms terminal for crew interaction.
 *
 * Props:
 *  - open              — boolean, controls visibility
 *  - onClose           — callback to close the panel
 *  - crew              — array of { id, name, role, image, containerId? }
 *  - activeCrewIndex   — currently selected crew member
 *  - onCrewSelect(i)   — callback when user picks a crew member
 *  - onSend(message, crewMember) — callback when user sends a message
 *  - responseText      — current response text to display
 *  - isTalking         — whether the character is currently speaking
 */
/* ── SitePal embed rendered directly in the comms screen ── */
function SitePalEmbed({ sitepal }) {
  const iframeRef = useRef(null);

  const blobUrl = useMemo(() => {
    if (!sitepal) return null;
    const { account, sceneId, hash } = sitepal;
    const html = `<!DOCTYPE html>
<html><head><style>
  html,body{margin:0;padding:0;overflow:hidden;background:transparent;}
</style>
<script>
(function(){
  var OrigAC = window.AudioContext || window.webkitAudioContext;
  if(OrigAC){
    var PatchedAC = function(){ var ctx = new OrigAC(); ctx.suspend(); return ctx; };
    PatchedAC.prototype = OrigAC.prototype;
    window.AudioContext = PatchedAC;
    window.webkitAudioContext = PatchedAC;
  }
  var origAppend = Element.prototype.appendChild;
  Element.prototype.appendChild = function(child){
    var result = origAppend.call(this, child);
    if(child.tagName === 'AUDIO' || child.tagName === 'VIDEO'){ child.muted = true; child.volume = 0; }
    return result;
  };
})();
</script>
</head><body>
<div id="sitepal-container"></div>
<script type="text/javascript" src="https://vhss-d.oddcast.com/vhost_embed_functions_v4.php?acc=${account}&js=0"></script>
<script type="text/javascript">
  AC_VHost_Embed(${account},600,800,"",1,0,${sceneId},0,1,0,"${hash}",0,1);
  function vh_sceneLoaded(){ try{stopSpeech();}catch(e){} try{setPlayerVolume(0);}catch(e){} }
</script>
</body></html>`;
    return URL.createObjectURL(new Blob([html], { type: "text/html" }));
  }, [sitepal]);

  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [blobUrl]);

  if (!blobUrl) return null;

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      zIndex: 1,
      overflow: "hidden",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>
      <iframe
        ref={iframeRef}
        src={blobUrl}
        title="sitepal-comms"
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: 600,
          height: 800,
          border: "none",
          background: "transparent",
          transform: `translate(calc(-50% + ${sitepal.offsetX || 0}px), -38%) scale(0.5)`,
          transformOrigin: "center center",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

export default function CommsPanel({
  open = false,
  onClose,
  crew = [],
  activeCrewIndex = 0,
  onCrewSelect,
  onSend,
  responseText = "",
  isTalking = false,
}) {
  const [input, setInput] = useState("");
  const [signalStrength, setSignalStrength] = useState(3);
  const inputRef = useRef(null);
  const current = crew[activeCrewIndex] || { name: "OFFLINE", role: "—", image: null };

  // Simulate signal fluctuation
  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      setSignalStrength(Math.floor(Math.random() * 2) + 2); // 2-3 bars
    }, 3000);
    return () => clearInterval(interval);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    if (onSend) onSend(input.trim(), current);
    setInput("");
  }, [input, onSend, current]);

  if (!open) return null;

  return (
    <>
      <style>{`
        /* ── BACKDROP ── */
        .comms-backdrop {
          position: fixed;
          inset: 0;
          z-index: 11000;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          animation: commsFadeIn 0.2s ease;
        }

        /* ── PANEL CONTAINER ── */
        .comms-panel {
          position: fixed;
          bottom: 70px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 11001;
          width: min(380px, calc(100vw - 24px));
          animation: commsSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          font-family: 'Cyber', 'Geo', 'Courier New', monospace;
        }

        /* ── CRT MONITOR FRAME ── */
        .comms-crt {
          background: linear-gradient(145deg, #1a1a2e, #0d0d1a);
          border: 2px solid rgba(0, 255, 255, 0.15);
          border-radius: 16px;
          padding: 3px;
          box-shadow:
            0 0 30px rgba(0, 255, 255, 0.08),
            0 8px 32px rgba(0, 0, 0, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        /* ── SCREEN BEZEL ── */
        .comms-bezel {
          background: linear-gradient(180deg, #0a0a14 0%, #060610 100%);
          border-radius: 13px;
          overflow: hidden;
          position: relative;
        }

        /* ── TOP BAR (status) ── */
        .comms-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: rgba(0, 255, 255, 0.03);
          border-bottom: 1px solid rgba(0, 255, 255, 0.08);
        }

        .comms-title {
          font-size: 0.6rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(0, 255, 255, 0.5);
        }

        .comms-status {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .comms-signal {
          display: flex;
          align-items: flex-end;
          gap: 1.5px;
          height: 12px;
        }

        .comms-signal-bar {
          width: 3px;
          border-radius: 1px;
          background: rgba(0, 255, 255, 0.2);
          transition: background 0.3s, height 0.3s;
        }

        .comms-signal-bar.active {
          background: hsl(152, 80%, 45%);
          box-shadow: 0 0 4px rgba(0, 229, 114, 0.5);
        }

        .comms-close {
          background: none;
          border: 1px solid rgba(255, 100, 100, 0.2);
          color: rgba(255, 100, 100, 0.6);
          width: 22px;
          height: 22px;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          -webkit-tap-highlight-color: transparent;
          line-height: 1;
          padding: 0;
        }

        .comms-close:active {
          background: rgba(255, 100, 100, 0.1);
          transform: scale(0.9);
        }

        /* ── CREW SELECTOR ── */
        .comms-crew-bar {
          display: flex;
          gap: 2px;
          padding: 6px 8px;
          overflow-x: auto;
          scrollbar-width: none;
          border-bottom: 1px solid rgba(0, 255, 255, 0.06);
        }

        .comms-crew-bar::-webkit-scrollbar { display: none; }

        .comms-crew-btn {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          cursor: pointer;
          transition: all 0.15s;
          -webkit-tap-highlight-color: transparent;
        }

        .comms-crew-btn:active {
          transform: scale(0.95);
        }

        .comms-crew-btn.active {
          border-color: rgba(0, 255, 255, 0.2);
          background: rgba(0, 255, 255, 0.05);
        }

        .comms-crew-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          object-fit: cover;
          border: 1.5px solid rgba(0, 255, 255, 0.15);
          transition: border-color 0.2s;
        }

        .comms-crew-btn.active .comms-crew-avatar {
          border-color: hsl(183, 50%, 50%);
          box-shadow: 0 0 8px rgba(0, 255, 255, 0.2);
        }

        .comms-crew-info {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .comms-crew-name {
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(0, 255, 255, 0.4);
          line-height: 1.2;
        }

        .comms-crew-btn.active .comms-crew-name {
          color: hsl(183, 38%, 60%);
        }

        .comms-crew-role {
          font-size: 0.5rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(0, 255, 255, 0.2);
          line-height: 1.2;
        }

        /* ── SCREEN AREA ── */
        .comms-screen {
          position: relative;
          height: 240px;
          background: radial-gradient(ellipse at center, #0a1a1a 0%, #040e0e 70%, #020808 100%);
          overflow: hidden;
        }

        /* Scanlines */
        .comms-screen::before {
          content: '';
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.15) 2px,
            rgba(0, 0, 0, 0.15) 4px
          );
          pointer-events: none;
          z-index: 2;
        }

        /* Screen edge vignette */
        .comms-screen::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.6) 100%);
          pointer-events: none;
          z-index: 3;
        }

        /* Screen glow */
        .comms-screen-glow {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(0, 255, 255, 0.04);
          box-shadow: inset 0 0 60px rgba(0, 255, 255, 0.03);
          pointer-events: none;
          z-index: 1;
        }

        /* Character display area */
        .comms-char-display {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1;
        }

        .comms-char-image {
          max-width: 80%;
          max-height: 90%;
          object-fit: contain;
          filter: brightness(1.1) contrast(1.05);
          opacity: 0.95;
        }

        .comms-char-placeholder {
          color: rgba(0, 255, 255, 0.15);
          font-size: 0.7rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
        }

        /* Talking indicator */
        .comms-talking {
          position: absolute;
          bottom: 8px;
          left: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
          z-index: 4;
        }

        .comms-talking-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: hsl(152, 80%, 50%);
          box-shadow: 0 0 6px rgba(0, 229, 114, 0.8);
          animation: commsTalkPulse 0.6s ease infinite;
        }

        .comms-talking-dot:nth-child(2) { animation-delay: 0.15s; }
        .comms-talking-dot:nth-child(3) { animation-delay: 0.3s; }

        .comms-talking-label {
          font-size: 0.5rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(0, 229, 114, 0.7);
        }

        /* REC indicator */
        .comms-rec {
          position: absolute;
          top: 8px;
          right: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
          z-index: 4;
        }

        .comms-rec-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ff3333;
          box-shadow: 0 0 6px rgba(255, 50, 50, 0.8);
          animation: commsRecBlink 1.5s ease infinite;
        }

        .comms-rec-text {
          font-size: 0.5rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          color: rgba(255, 50, 50, 0.7);
        }

        /* Timestamp */
        .comms-timestamp {
          position: absolute;
          top: 8px;
          left: 12px;
          font-size: 0.5rem;
          letter-spacing: 0.1em;
          color: rgba(0, 255, 255, 0.2);
          z-index: 4;
          font-variant-numeric: tabular-nums;
        }

        /* ── RESPONSE AREA ── */
        .comms-response {
          padding: 8px 12px;
          min-height: 36px;
          max-height: 60px;
          overflow-y: auto;
          border-bottom: 1px solid rgba(0, 255, 255, 0.06);
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 255, 255, 0.1) transparent;
        }

        .comms-response-text {
          font-size: 0.7rem;
          line-height: 1.5;
          color: rgba(0, 255, 255, 0.5);
          letter-spacing: 0.03em;
        }

        .comms-response-text.talking {
          color: hsl(183, 38%, 60%);
        }

        .comms-response-empty {
          font-size: 0.6rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(0, 255, 255, 0.12);
          text-align: center;
          padding: 4px 0;
        }

        /* Typing cursor */
        .comms-cursor {
          display: inline-block;
          width: 6px;
          height: 12px;
          background: rgba(0, 255, 255, 0.5);
          margin-left: 2px;
          animation: commsCursorBlink 0.8s step-end infinite;
          vertical-align: text-bottom;
        }

        /* ── INPUT AREA ── */
        .comms-input-area {
          display: flex;
          gap: 6px;
          padding: 8px;
          align-items: center;
        }

        .comms-input {
          flex: 1;
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid rgba(0, 255, 255, 0.1);
          background: rgba(0, 255, 255, 0.02);
          color: hsl(183, 38%, 65%);
          font-family: 'Cyber', 'Geo', 'Courier New', monospace;
          font-size: 0.8rem;
          letter-spacing: 0.03em;
          outline: none;
          transition: border-color 0.2s;
        }

        .comms-input::placeholder {
          color: rgba(0, 255, 255, 0.15);
        }

        .comms-input:focus {
          border-color: rgba(0, 255, 255, 0.3);
        }

        .comms-send-btn {
          padding: 8px 14px;
          border-radius: 8px;
          border: 1px solid rgba(0, 255, 255, 0.15);
          background: rgba(0, 255, 255, 0.06);
          color: hsl(183, 38%, 55%);
          font-family: 'Cyber', 'Geo', monospace;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.15s;
          -webkit-tap-highlight-color: transparent;
          white-space: nowrap;
        }

        .comms-send-btn:active {
          background: rgba(0, 255, 255, 0.12);
          transform: scale(0.95);
        }

        .comms-send-btn:disabled {
          opacity: 0.3;
          pointer-events: none;
        }

        /* ── BOTTOM STATUS BAR ── */
        .comms-bottom-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 12px 6px;
          border-top: 1px solid rgba(0, 255, 255, 0.04);
        }

        .comms-freq {
          font-size: 0.45rem;
          letter-spacing: 0.15em;
          color: rgba(0, 255, 255, 0.15);
          text-transform: uppercase;
          font-variant-numeric: tabular-nums;
        }

        .comms-encryption {
          font-size: 0.45rem;
          letter-spacing: 0.1em;
          color: rgba(0, 229, 114, 0.3);
          text-transform: uppercase;
        }

        /* ── ANIMATIONS ── */
        @keyframes commsFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes commsSlideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(40px) scale(0.95); }
          to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }

        @keyframes commsTalkPulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }

        @keyframes commsRecBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }

        @keyframes commsCursorBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      <div className="comms-backdrop" onClick={onClose} />

      <div className="comms-panel">
        <div className="comms-crt">
          <div className="comms-bezel">

            {/* ── Top status bar ── */}
            <div className="comms-topbar">
              <span className="comms-title">// Hail Mary Comms</span>
              <div className="comms-status">
                <div className="comms-signal">
                  {[4, 7, 10, 13].map((h, i) => (
                    <div
                      key={i}
                      className={`comms-signal-bar ${i < signalStrength ? "active" : ""}`}
                      style={{ height: h }}
                    />
                  ))}
                </div>
                <button className="comms-close" onClick={onClose}>✕</button>
              </div>
            </div>

            {/* ── Crew selector ── */}
            {crew.length > 1 && (
              <div className="comms-crew-bar">
                {crew.map((member, i) => (
                  <button
                    key={member.id || i}
                    className={`comms-crew-btn ${i === activeCrewIndex ? "active" : ""}`}
                    onClick={() => onCrewSelect && onCrewSelect(i)}
                  >
                    {member.image ? (
                      <img className="comms-crew-avatar" src={member.image} alt={member.name} />
                    ) : (
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: "rgba(0,255,255,0.05)",
                        border: "1.5px solid rgba(0,255,255,0.15)",
                      }} />
                    )}
                    <div className="comms-crew-info">
                      <span className="comms-crew-name">{member.name}</span>
                      <span className="comms-crew-role">{member.role}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ── CRT Screen ── */}
            <div className="comms-screen">
              <div className="comms-screen-glow" />

              <div className="comms-timestamp">
                {new Date().toLocaleTimeString("en-US", { hour12: false })} UTC
              </div>

              <div className="comms-rec">
                <div className="comms-rec-dot" />
                <span className="comms-rec-text">LIVE</span>
              </div>

              <div className="comms-char-display">
                {current.sitepal ? (
                  <SitePalEmbed sitepal={current.sitepal} />
                ) : current.image ? (
                  <img className="comms-char-image" src={current.image} alt={current.name} />
                ) : (
                  <span className="comms-char-placeholder">No Signal</span>
                )}
              </div>

              {isTalking && (
                <div className="comms-talking">
                  <div className="comms-talking-dot" />
                  <div className="comms-talking-dot" />
                  <div className="comms-talking-dot" />
                  <span className="comms-talking-label">Transmitting</span>
                </div>
              )}
            </div>

            {/* ── Response text area ── */}
            <div className="comms-response">
              {responseText ? (
                <span className={`comms-response-text ${isTalking ? "talking" : ""}`}>
                  {responseText}
                  {isTalking && <span className="comms-cursor" />}
                </span>
              ) : (
                <span className="comms-response-empty">Awaiting transmission...</span>
              )}
            </div>

            {/* ── Input area ── */}
            <div className="comms-input-area">
              <input
                ref={inputRef}
                className="comms-input"
                type="text"
                placeholder={`Message ${current.name}...`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
              />
              <button
                className="comms-send-btn"
                onClick={handleSend}
                disabled={!input.trim() || isTalking}
              >
                XMIT
              </button>
            </div>

            {/* ── Bottom status ── */}
            <div className="comms-bottom-bar">
              <span className="comms-freq">FREQ 147.520 MHz</span>
              <span className="comms-encryption">◆ AES-256</span>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
