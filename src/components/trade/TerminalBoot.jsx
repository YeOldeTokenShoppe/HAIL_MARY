"use client";
import React, { useEffect, useState } from "react";

// Boot / login screen — the entry to the Liminal Terminal (replaces the old
// credo). Types a "Welcome … verifying credentials … access granted" sequence,
// then reveals the HUB menu (Learning Modules / Case Files / …). Tap to skip the
// typing. Options are passed in so the hub is data-driven.
const BOOT_LINES = [
  { t: "LIMINAL TERMINAL v1.0", c: "dim" },
  { t: "ESTABLISHING SECURE LINK", c: "cmd", ok: true },
  { t: "Welcome to the Liminal Terminal.", c: "hi" },
  { t: "VERIFYING CREDENTIALS", c: "cmd", ok: true },
  { t: "ACCESS GRANTED — guest clearance.", c: "ok" },
  { t: "SELECT A MODULE", c: "gold" },
];

export default function TerminalBoot({ options = [], onSelect, onExit }) {
  const [lineIdx, setLineIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (lineIdx >= BOOT_LINES.length) { setDone(true); return; }
    const full = BOOT_LINES[lineIdx].t;
    setTyped("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) {
        clearInterval(id);
        setTimeout(() => setLineIdx((x) => x + 1), 240);
      }
    }, 26);
    return () => clearInterval(id);
  }, [lineIdx]);

  const skip = () => { if (!done) { setLineIdx(BOOT_LINES.length); setDone(true); } };

  const shown = BOOT_LINES.slice(0, lineIdx);
  const current = lineIdx < BOOT_LINES.length ? BOOT_LINES[lineIdx] : null;
  const pfx = (l) => (l.c === "hi" || l.c === "gold" ? "" : "> ");

  return (
    <div className="tb-root" onClick={skip}>
      <div className="tb-header">
        <span className="tb-title">LIMINAL // RL80</span>
        <span className="tb-live"><i className="tb-dot" />SECURE</span>
      </div>

      <div className="tb-body">
        {shown.map((l, i) => (
          <div key={i} className={`tb-line tb-${l.c}`}>{pfx(l)}{l.t}{l.ok ? "  ✓" : ""}</div>
        ))}
        {current && (
          <div className={`tb-line tb-${current.c}`}>{pfx(current)}{typed}<span className="tb-cur">▋</span></div>
        )}

        {done && (
          <>
            <div className="tb-menu" onClick={(e) => e.stopPropagation()}>
              {options.map((o) => (
                <button key={o.key} className="tb-opt" onClick={() => onSelect?.(o.key)} disabled={o.disabled}>
                  <span className="tb-opt-mark">▸</span>
                  <span className="tb-opt-col">
                    <span className="tb-opt-label">{o.label}{o.disabled ? "  · SOON" : ""}</span>
                    {o.sub && <span className="tb-opt-sub">{o.sub}</span>}
                  </span>
                </button>
              ))}
            </div>

            {/* Intro video placeholder — for a character intro / how-to transmission.
                Later this holds a <video> or a SitePal intro feed. */}
            <div className="tb-video" onClick={(e) => e.stopPropagation()}>
              <span className="tb-video-tag">▶ INTRO FEED</span>
              <span className="tb-video-play">▶</span>
              <span className="tb-video-sub">TRANSMISSION · STANDBY</span>
            </div>
          </>
        )}
      </div>

      {done && (
        <button className="tb-exit" onClick={(e) => { e.stopPropagation(); onExit?.(); }}>◀ DISCONNECT</button>
      )}

      <style>{`
        .tb-root {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          background: radial-gradient(120% 80% at 50% 20%, rgba(10,40,38,0.4), transparent), #02100e;
          color: #2fd6d6; font-family: 'Courier New', monospace; overflow: hidden; user-select: none;
        }
        .tb-root::after {
          content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 9;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0 1px, transparent 1px 3px),
                      radial-gradient(130% 100% at 50% 50%, transparent 60%, rgba(0,0,0,0.55));
          mix-blend-mode: multiply;
        }
        .tb-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 14px 10px; font-size: 13px; letter-spacing: 0.05em;
        }
        .tb-title { color: #5ff2f2; font-weight: bold; }
        .tb-live { display: inline-flex; align-items: center; gap: 6px; }
        .tb-dot { width: 7px; height: 7px; border-radius: 50%; background: #4dffaa; box-shadow: 0 0 6px #4dffaa; }

        .tb-body { flex: 1; min-height: 0; overflow-y: auto; padding: 10px 16px 16px; z-index: 6; }
        .tb-line { font-size: 13.5px; line-height: 1.85; letter-spacing: 0.02em; }
        .tb-dim { color: #2fd6d6; opacity: 0.55; }
        .tb-cmd { color: #2fd6d6; }
        .tb-ok { color: #4dffaa; }
        .tb-hi { color: #f4fffb; font-size: 19px; font-weight: bold; margin: 8px 0; text-shadow: 0 0 10px rgba(47,214,214,0.4); }
        .tb-gold { color: #ffd23a; letter-spacing: 0.14em; margin-top: 8px; }
        .tb-cur { color: #5ff2f2; }

        .tb-menu { display: flex; flex-direction: column; gap: 9px; margin-top: 16px; }
        .tb-opt {
          display: flex; align-items: flex-start; gap: 10px; text-align: left;
          background: #061a18; border: 1px solid color-mix(in srgb, #2fd6d6 45%, transparent);
          color: #eafff9; font: inherit; padding: 13px 13px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 11px) 0, 100% 11px, 100% 100%, 11px 100%, 0 calc(100% - 11px));
          transition: box-shadow 0.15s ease, transform 0.1s ease;
        }
        .tb-opt:not(:disabled):active { transform: scale(0.99); }
        .tb-opt:not(:disabled):hover { box-shadow: inset 0 0 22px color-mix(in srgb, #2fd6d6 18%, transparent); }
        .tb-opt:disabled { opacity: 0.45; cursor: default; }
        .tb-opt-mark { color: #2fd6d6; font-size: 15px; line-height: 1.2; }
        .tb-opt-col { display: flex; flex-direction: column; gap: 2px; }
        .tb-opt-label { font-size: 15px; font-weight: bold; letter-spacing: 0.04em; }
        .tb-opt-sub { font-size: 11px; color: #2fd6d6; opacity: 0.85; letter-spacing: 0.04em; }

        .tb-video {
          position: relative; margin-top: 16px; aspect-ratio: 16 / 9;
          border: 1px solid color-mix(in srgb, #2fd6d6 38%, transparent);
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0 1px, transparent 1px 3px), #04140f;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px;
          clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
          cursor: pointer;
        }
        .tb-video-tag { position: absolute; top: 8px; left: 11px; font-size: 10px; letter-spacing: 0.1em; color: #ffd23a; }
        .tb-video-play { font-size: 30px; color: #2fd6d6; text-shadow: 0 0 14px color-mix(in srgb, #2fd6d6 70%, transparent); }
        .tb-video-sub { font-size: 10.5px; letter-spacing: 0.12em; color: #2fd6d6; opacity: 0.7; }

        .tb-exit {
          margin: 8px 14px calc(env(safe-area-inset-bottom, 0px) + 14px); z-index: 6;
          background: none; border: 1px solid color-mix(in srgb, #2fd6d6 45%, transparent);
          color: #2fd6d6; font: inherit; font-size: 12px; letter-spacing: 0.06em; padding: 10px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
        }
      `}</style>
    </div>
  );
}
