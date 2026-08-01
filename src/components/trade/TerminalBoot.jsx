"use client";
import React, { useEffect, useRef, useState } from "react";

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
  { t: "SELECT A CHANNEL", c: "gold" },
];

// How long the static burst covers a channel change.
const BURST_MS = 280;

export default function TerminalBoot({ options = [], onSelect, onExit, instant = false }) {
  // `instant` skips the welcome typing and jumps straight to the hub menu — used
  // when returning to the terminal so you don't re-watch the login animation.
  const [lineIdx, setLineIdx] = useState(instant ? BOOT_LINES.length : 0);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(instant);
  // Which channel is tuned, and the static burst that covers a change.
  const [channel, setChannel] = useState(0);
  const [burst, setBurst] = useState(false);
  const burstTimer = useRef(null);
  const touchY = useRef(null);

  const count = options.length;
  const tuned = options[Math.min(channel, Math.max(0, count - 1))];

  // Wraps in both directions — a dial with a hard stop reads as a broken dial.
  const tune = (delta) => {
    if (count < 2) return;
    setChannel((c) => (c + delta + count) % count);
    setBurst(true);
    clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setBurst(false), BURST_MS);
  };

  const jump = (i) => {
    if (i === channel) return;
    setChannel(i);
    setBurst(true);
    clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setBurst(false), BURST_MS);
  };

  useEffect(() => () => clearTimeout(burstTimer.current), []);

  useEffect(() => {
    if (instant) return;
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
  }, [lineIdx, instant]);

  const skip = () => { if (!done) { setLineIdx(BOOT_LINES.length); setDone(true); } };

  // On instant return, show only the "SELECT A MODULE" header (skip the verbose
  // login log); otherwise reveal the log progressively as it types.
  const shown = instant ? BOOT_LINES.slice(-1) : BOOT_LINES.slice(0, lineIdx);
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

        {done && tuned && (
          /* THE HUB IS A TUNER. The modules were a list of two thin buttons
             above a dead 16:9 placeholder; the terminal is already a CRT and LT TV is
             already a channel, so the placeholder BECAME the screen rather than
             a new one being added beside it. Channels are still driven by
             `options`, so adding a module adds a channel and nothing here needs
             to know what the modules are. */
          <div className="tb-tuner" onClick={(e) => e.stopPropagation()}>
            <div
              className="tb-crt"
              onTouchStart={(e) => { touchY.current = e.touches[0]?.clientY ?? null; }}
              onTouchEnd={(e) => {
                if (touchY.current == null) return;
                const dy = (e.changedTouches[0]?.clientY ?? 0) - touchY.current;
                touchY.current = null;
                // Swipe up = next channel, matching the ▼ button's direction.
                if (Math.abs(dy) > 30) tune(dy < 0 ? 1 : -1);
              }}
            >
              <div className="tb-crt-head">
                <span className="tb-ch">CH {String(channel + 1).padStart(2, "0")}</span>
                <span className="tb-sig">
                  {tuned.disabled ? "○ OFF AIR" : "● SIGNAL LOCKED"}
                </span>
              </div>

              <div className="tb-card" key={channel} aria-live="polite">
                <div className="tb-card-title">{tuned.label}</div>
                {tuned.sub && <div className="tb-card-sub">{tuned.sub}</div>}
                {tuned.disabled && <div className="tb-card-soon">TRANSMISSION PENDING</div>}
              </div>

              {/* Dressing, all pointer-events:none so the swipe target is the
                  whole screen. */}
              <div className="tb-scan" aria-hidden="true" />
              <div className="tb-track" aria-hidden="true" />
              {burst && <div className="tb-static" aria-hidden="true" />}

              {count > 1 && (
                <>
                  <button
                    className="tb-dial tb-dial-up"
                    onClick={() => tune(-1)}
                    aria-label="Previous channel"
                  >▲</button>
                  <button
                    className="tb-dial tb-dial-dn"
                    onClick={() => tune(1)}
                    aria-label="Next channel"
                  >▼</button>
                </>
              )}
            </div>

            <button
              className="tb-enter"
              onClick={() => onSelect?.(tuned.key)}
              disabled={tuned.disabled}
            >
              {tuned.disabled ? "○ OFF AIR" : "▸ TUNE IN"}
            </button>

            {/* The whole slate at a glance. Flipping alone reads as sparse at
                two or three channels, and this also lets you jump straight to
                one instead of cycling past the others. */}
            <div className="tb-strip" role="list" aria-label="Channels">
              {options.map((o, i) => (
                <button
                  key={o.key}
                  role="listitem"
                  className={`tb-strip-item ${i === channel ? "is-on" : ""}`}
                  onClick={() => jump(i)}
                >
                  <span className="tb-strip-no">{String(i + 1).padStart(2, "0")}</span>
                  <span className="tb-strip-label">
                    {o.label}{o.disabled ? " · SOON" : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {done && (
        <button className="tb-exit" onClick={(e) => { e.stopPropagation(); onExit?.(); }}>◀ EXIT</button>
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

        /* ---- TUNER ---- */
        .tb-tuner { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }

        .tb-crt {
          position: relative; aspect-ratio: 16 / 9; overflow: hidden;
          border: 1px solid color-mix(in srgb, #2fd6d6 38%, transparent);
          background:
            radial-gradient(120% 90% at 50% 45%, rgba(16,60,56,0.5), transparent 70%),
            #04140f;
          display: flex; align-items: center; justify-content: center;
          clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
          touch-action: pan-y;
        }
        .tb-crt-head {
          position: absolute; top: 8px; left: 11px; right: 11px; z-index: 6;
          display: flex; justify-content: space-between; align-items: center;
          font-size: 10px; letter-spacing: 0.12em;
        }
        .tb-ch { color: #ffd23a; font-weight: bold; }
        .tb-sig { color: #4dffaa; opacity: 0.85; }

        .tb-card {
          position: relative; z-index: 5; text-align: center; padding: 0 34px;
          /* Re-keyed on channel change, so this replays as the tune-in settle. */
          animation: tbCardIn 0.34s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .tb-card-title {
          font-size: 26px; font-weight: bold; letter-spacing: 0.06em; color: #f4fffb;
          /* Chromatic split — the magenta half also ties the terminal to LT TV's
             network colour without putting magenta on any small type. */
          text-shadow: -1.5px 0 rgba(239,98,220,0.55), 1.5px 0 rgba(47,214,214,0.55);
        }
        .tb-card-sub {
          margin-top: 7px; font-size: 11.5px; line-height: 1.5;
          color: #9fd8d0; letter-spacing: 0.03em;
        }
        .tb-card-soon {
          margin-top: 9px; font-size: 9.5px; letter-spacing: 0.18em; color: #ffd23a; opacity: 0.8;
        }
        @keyframes tbCardIn {
          0%   { opacity: 0; transform: translateY(6px) scaleY(1.25); filter: blur(1.5px); }
          60%  { opacity: 1; transform: translateY(0) scaleY(0.97); filter: blur(0); }
          100% { opacity: 1; transform: none; }
        }

        .tb-scan {
          position: absolute; inset: 0; z-index: 7; pointer-events: none;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.30) 0 1px, transparent 1px 3px);
        }
        /* Tracking band. transform-animated (compositor-only) rather than
           animating position/height, so it costs nothing per frame. */
        .tb-track {
          position: absolute; left: 0; right: 0; top: 0; height: 58px; z-index: 7;
          pointer-events: none;
          background: linear-gradient(180deg,
            transparent, rgba(255,255,255,0.05) 45%, rgba(255,255,255,0.018) 62%, transparent);
          animation: tbTrack 7.5s linear infinite;
        }
        @keyframes tbTrack {
          0%   { transform: translateY(-60px); }
          100% { transform: translateY(1200%); }
        }

        /* Static burst on channel change. Layered gradients at odd angles,
           jittered by background-position — reads as noise for the ~280ms it's
           up, with none of the cost of per-frame canvas noise. */
        .tb-static {
          position: absolute; inset: 0; z-index: 8; pointer-events: none;
          mix-blend-mode: screen;
          background:
            repeating-linear-gradient(0deg, rgba(255,255,255,0.11) 0 1px, transparent 1px 2px),
            repeating-linear-gradient(90deg, rgba(255,255,255,0.07) 0 1px, transparent 1px 3px),
            repeating-linear-gradient(17deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 5px);
          animation: tbStatic 0.09s steps(2) infinite;
        }
        @keyframes tbStatic {
          0%   { background-position: 0 0, 0 0, 0 0; opacity: 0.9; }
          50%  { background-position: 3px -7px, -5px 4px, 9px 2px; opacity: 0.55; }
          100% { background-position: -6px 5px, 7px -3px, -4px -8px; opacity: 0.85; }
        }

        .tb-dial {
          position: absolute; right: 8px; z-index: 9;
          width: 34px; height: 30px; display: flex; align-items: center; justify-content: center;
          background: rgba(4,20,15,0.72); color: #2fd6d6; font: inherit; font-size: 13px;
          border: 1px solid color-mix(in srgb, #2fd6d6 40%, transparent); cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .tb-dial:active { background: rgba(47,214,214,0.2); }
        .tb-dial-up { top: 26px; }
        .tb-dial-dn { bottom: 10px; }

        .tb-enter {
          background: #061a18; border: 1px solid color-mix(in srgb, #4dffaa 55%, transparent);
          color: #eafff9; font: inherit; font-size: 15px; font-weight: bold;
          letter-spacing: 0.1em; padding: 14px 13px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 11px) 0, 100% 11px, 100% 100%, 11px 100%, 0 calc(100% - 11px));
          transition: box-shadow 0.15s ease, transform 0.1s ease;
        }
        .tb-enter:not(:disabled):active { transform: scale(0.99); }
        .tb-enter:not(:disabled):hover { box-shadow: inset 0 0 22px color-mix(in srgb, #4dffaa 16%, transparent); }
        .tb-enter:disabled { opacity: 0.4; cursor: default; border-color: color-mix(in srgb, #2fd6d6 30%, transparent); }

        .tb-strip {
          display: flex; gap: 6px; overflow-x: auto; -webkit-overflow-scrolling: touch;
          scrollbar-width: none; padding-bottom: 2px;
        }
        .tb-strip::-webkit-scrollbar { display: none; }
        .tb-strip-item {
          flex: 0 0 auto; display: flex; align-items: center; gap: 7px;
          background: #061a18; border: 1px solid color-mix(in srgb, #2fd6d6 22%, transparent);
          color: #cfeee8; font: inherit; font-size: 11px; padding: 8px 11px; cursor: pointer;
          white-space: nowrap;
          clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
        }
        .tb-strip-item.is-on {
          border-color: color-mix(in srgb, #4dffaa 70%, transparent); color: #eafff9;
          box-shadow: inset 0 0 18px color-mix(in srgb, #4dffaa 12%, transparent);
        }
        .tb-strip-no { color: #ffd23a; font-size: 10px; letter-spacing: 0.1em; }
        .tb-strip-item.is-on .tb-strip-no { color: #4dffaa; }

        /* The rolling band and the static are the two things that read as
           motion sickness triggers here; the card settle is short enough to
           keep, but it loses the scale/blur part. */
        @media (prefers-reduced-motion: reduce) {
          .tb-track, .tb-static { animation: none; }
          .tb-static { opacity: 0.5; }
          .tb-card { animation-duration: 0.01s; }
        }

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
