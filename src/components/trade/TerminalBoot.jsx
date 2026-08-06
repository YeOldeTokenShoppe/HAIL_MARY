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

const CHANNEL_META = {
  lttv: {
    accent: "#ef62dc",
    overline: "NETWORK 80 / LIVE FEED",
    signal: "broadcast",
    telemetry: [["FEED", "LIVE"], ["SIGNAL", "98.4%"], ["LATENCY", "12ms"]],
  },
  vc: {
    accent: "#ffd23a",
    overline: "VENTURE SIGNAL / OPEN",
    signal: "deal",
    telemetry: [["DEAL FLOW", "03"], ["SIGNAL", "94.1%"], ["WINDOW", "OPEN"]],
  },
  neuron: {
    accent: "#4dffaa",
    overline: "BIOELECTRIC ARRAY / ACTIVE",
    signal: "neural",
    telemetry: [["PULSE", "72Hz"], ["NODES", "04"], ["CHARGE", "99.2%"]],
  },
};

// Lightweight, silent channel loops. Keeping this separate from CHANNEL_META
// lets a channel work before its footage exists, and makes adding future feeds
// a one-line change rather than another branch in the tuner markup.
const CHANNEL_PREVIEWS = {
  lttv: { type: "video", src: "/videos/LTTV_clip.mp4", position: "50% 42%" },
  vc: { type: "video", src: "/videos/VC_GAME_clip.mp4", position: "50% 48%" },
  neuron: { type: "image", src: "/neuro.webp", position: "50% 50%" },
};

function ChannelSignal({ type }) {
  if (type === "deal") {
    return (
      <div className="tb-signal-art tb-signal-deal" aria-hidden="true">
        <span className="tb-deal-card tb-deal-card-a" />
        <span className="tb-deal-card tb-deal-card-b" />
        <span className="tb-deal-card tb-deal-card-c" />
        <span className="tb-deal-mark">$</span>
      </div>
    );
  }

  if (type === "neural") {
    return (
      <div className="tb-signal-art tb-signal-neural" aria-hidden="true">
        <span className="tb-neural-line tb-neural-line-a" />
        <span className="tb-neural-line tb-neural-line-b" />
        <span className="tb-neural-line tb-neural-line-c" />
        <span className="tb-neural-node tb-neural-node-a" />
        <span className="tb-neural-node tb-neural-node-b" />
        <span className="tb-neural-node tb-neural-node-c" />
        <span className="tb-neural-node tb-neural-node-d" />
      </div>
    );
  }

  return (
    <div className="tb-signal-art tb-signal-broadcast" aria-hidden="true">
      <span className="tb-air-ring tb-air-ring-a" />
      <span className="tb-air-ring tb-air-ring-b" />
      <span className="tb-air-core" />
      <span className="tb-air-beam tb-air-beam-l" />
      <span className="tb-air-beam tb-air-beam-r" />
    </div>
  );
}

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
  const touchX = useRef(null);

  const count = options.length;
  const tuned = options[Math.min(channel, Math.max(0, count - 1))];
  const channelMeta = CHANNEL_META[tuned?.key] || {
    accent: "#2fd6d6",
    overline: "LIMINAL TRANSMISSION / READY",
    signal: "broadcast",
    telemetry: [["FEED", "LIVE"], ["SIGNAL", "97.0%"], ["STATUS", "READY"]],
  };
  const channelPreview = CHANNEL_PREVIEWS[tuned?.key] || null;

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

  // Once authenticated, the transcript compresses into the status rail below.
  // It remains a cinematic entry without competing with the tuner afterward.
  const shown = BOOT_LINES.slice(0, lineIdx);
  const current = lineIdx < BOOT_LINES.length ? BOOT_LINES[lineIdx] : null;
  const pfx = (l) => (l.c === "hi" || l.c === "gold" ? "" : "> ");

  return (
    <div className="tb-root" onClick={skip}>
      <div className="tb-header">
        <div className="tb-brand">
          <span className="tb-title">LIMINAL // RL80</span>
          <span className="tb-version">TERMINAL v1.0</span>
        </div>
        <div className="tb-header-actions">
          <span className="tb-live"><i className="tb-dot" />SECURE</span>
          <button
            className="tb-header-exit"
            onClick={(e) => { e.stopPropagation(); onExit?.(); }}
            aria-label="Exit Liminal Terminal"
          >
            <span aria-hidden="true">×</span> EXIT
          </button>
        </div>
      </div>

      <div className={`tb-body ${done ? "is-ready" : "is-booting"}`}>
        {!done && (
          <div className="tb-boot-log">
            {shown.map((l, i) => (
              <div key={i} className={`tb-line tb-${l.c}`}>{pfx(l)}{l.t}{l.ok ? "  ✓" : ""}</div>
            ))}
            {current && (
              <div className={`tb-line tb-${current.c}`}>{pfx(current)}{typed}<span className="tb-cur">▋</span></div>
            )}
            <div className="tb-skip">TAP ANYWHERE TO COMPLETE BOOT</div>
          </div>
        )}

        {done && tuned && (
          /* THE HUB IS A TUNER. The modules were a list of two thin buttons
             above a dead 16:9 placeholder; the terminal is already a CRT and LT TV is
             already a channel, so the placeholder BECAME the screen rather than
             a new one being added beside it. Channels are still driven by
             `options`, so adding a module adds a channel and nothing here needs
             to know what the modules are. */
          <div
            className="tb-tuner"
            onClick={(e) => e.stopPropagation()}
            style={{
              "--tb-channel": channelMeta.accent,
            }}
          >
            <div className="tb-auth" aria-label="Terminal connection status">
              <span><b>AUTH</b> GUEST</span>
              <span><b>LINK</b> SECURE</span>
              <span><b>BAND</b> {count} CHANNELS</span>
            </div>

            <div className="tb-section-head">
              <span>SELECT A CHANNEL</span>
              <span className="tb-counter">{String(channel + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}</span>
            </div>

            <div className="tb-console">
              <div className="tb-bezel">
                <div
                  className="tb-crt"
                  onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
                  onTouchEnd={(e) => {
                    if (touchX.current == null) return;
                    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchX.current;
                    touchX.current = null;
                    if (Math.abs(dx) > 30) tune(dx < 0 ? 1 : -1);
                  }}
                >
                  <div className="tb-crt-head">
                    <span className="tb-ch">CH {String(channel + 1).padStart(2, "0")} // {tuned.key.toUpperCase()}</span>
                    <span className="tb-sig">
                      {tuned.disabled ? "○ OFF AIR" : "● SIGNAL LOCKED"}
                    </span>
                  </div>

                  {channelPreview && (
                    channelPreview.type === "image" ? (
                      <img
                        className="tb-preview-media"
                        src={channelPreview.src}
                        style={{ "--tb-preview-position": channelPreview.position }}
                        alt=""
                        aria-hidden="true"
                        draggable="false"
                      />
                    ) : (
                      <video
                        className="tb-preview-media"
                        src={channelPreview.src}
                        style={{ "--tb-preview-position": channelPreview.position }}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        disablePictureInPicture
                        aria-hidden="true"
                        onLoadedData={(e) => {
                          if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
                            e.currentTarget.pause();
                          }
                        }}
                      />
                    )
                  )}

                  <div
                    className={`tb-card ${channelPreview ? "has-preview" : ""}`}
                    key={channel}
                    aria-live="polite"
                  >
                    {!channelPreview && <ChannelSignal type={channelMeta.signal} />}
                    {/* <div className="tb-card-overline">{channelMeta.overline}</div> */}
                    <div className="tb-card-title">{tuned.label}</div>
                    {tuned.sub && <div className="tb-card-sub">{tuned.sub}</div>}
                    {tuned.disabled && <div className="tb-card-soon">TRANSMISSION PENDING</div>}
                  </div>

                  <div className="tb-scan" aria-hidden="true" />
                  <div className="tb-track" aria-hidden="true" />
                  <div className="tb-glass" aria-hidden="true" />
                  {burst && <div className="tb-static" aria-hidden="true" />}
                </div>
              </div>

              <div className="tb-lattice" aria-hidden="true">
                <i /><i /><i />
              </div>

              <div className="tb-market-rail">
                <div className="tb-terminal-mark">
                  <strong>RL80 // MARKET</strong>
                  <span>INTELLIGENCE TERMINAL // LIMINAL</span>
                </div>

                <div className="tb-feed-live">
                  <i />
                  <span>{tuned.disabled ? "FEED HALTED" : "FEED LIVE"}</span>
                </div>

                {count > 1 && (
                  <div className="tb-function-keys" aria-label="Channel navigation">
                    <button
                      className="tb-softkey"
                      onClick={() => tune(-1)}
                      aria-label="Previous channel"
                    >
                      <span>F1</span><b>‹ PREV</b>
                    </button>
                    <button
                      className="tb-softkey"
                      onClick={() => tune(1)}
                      aria-label="Next channel"
                    >
                      <span>F2</span><b>NEXT ›</b>
                    </button>
                  </div>
                )}
              </div>

              {/* <div className="tb-telemetry" aria-label={`${tuned.label} live telemetry`}>
                {channelMeta.telemetry.map(([label, value]) => (
                  <div className="tb-metric" key={label}>
                    <span>{label}</span>
                    <strong>{value}</strong>
                    <i aria-hidden="true" />
                  </div>
                ))}
              </div> */}

              <button
                className="tb-enter"
                onClick={() => onSelect?.(tuned.key)}
                disabled={tuned.disabled}
              >
                {tuned.disabled ? (
                  "○ OFF AIR"
                ) : (
                  <>
                    <span className="tb-enter-command">▸ TUNE IN</span>
                    <span className="tb-enter-label">CH {String(channel + 1).padStart(2, "0")} // {tuned.label}</span>
                  </>
                )}
              </button>

              <div className="tb-presets-label">
                <span>CHANNEL MATRIX</span>
                <span>SWIPE DISPLAY OR USE F-KEYS</span>
              </div>

              {/* The whole slate at a glance. Flipping alone reads as sparse at
                  two or three channels, and this also lets you jump straight to
                  one instead of cycling past the others. */}
              <div className="tb-strip" role="group" aria-label="Channel presets">
                {options.map((o, i) => (
                  <button
                    key={o.key}
                    className={`tb-strip-item ${i === channel ? "is-on" : ""}`}
                    onClick={() => jump(i)}
                    style={{ "--tb-item-accent": (CHANNEL_META[o.key] || channelMeta).accent }}
                    aria-current={i === channel ? "true" : undefined}
                    aria-label={`Channel ${String(i + 1).padStart(2, "0")}: ${o.label}${o.disabled ? ", off air" : ""}`}
                  >
                    <span className="tb-strip-no">{String(i + 1).padStart(2, "0")}</span>
                    <span className="tb-strip-label">
                      {o.label}{o.disabled ? " · SOON" : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .tb-root {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          container: terminal / size;
          --tb-cyan: #37e3e3; --tb-green: #4dffaa; --tb-gold: #ffd23a;
          --tb-ink: #eafff9; --tb-muted: #9fd8d0; --tb-void: #010807;
          background:
            radial-gradient(100% 62% at 50% 30%, rgba(8,38,34,0.34), transparent 72%),
            linear-gradient(180deg, #020d0b 0%, var(--tb-void) 66%, #000403 100%);
          color: var(--tb-cyan); font-family: 'IoskeleyMono', 'Courier New', monospace;
          overflow: hidden; user-select: none;
        }
        .tb-root::after {
          content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 9;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.09) 0 1px, transparent 1px 5px),
                      radial-gradient(130% 100% at 50% 50%, transparent 62%, rgba(0,0,0,0.48));
          mix-blend-mode: multiply;
        }
        .tb-header {
          display: flex; align-items: center; justify-content: space-between;
          min-height: 54px; padding: max(5px, env(safe-area-inset-top, 0px)) 12px 5px 15px;
          border-bottom: 1px solid rgba(55,227,227,0.14);
          background: rgba(1,12,10,0.56); z-index: 10;
          font-size: 12px; letter-spacing: 0.05em;
        }
        .tb-brand { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .tb-title { color: #72ffff; font-weight: 700; font-size: 13px; }
        .tb-version { color: #5c9e98; font-size: 8px; letter-spacing: 0.16em; }
        .tb-header-actions { display: flex; align-items: center; gap: 10px; }
        .tb-live { display: inline-flex; align-items: center; gap: 6px; }
        .tb-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--tb-green); box-shadow: 0 0 7px var(--tb-green); }
        .tb-header-exit {
          min-width: 58px; min-height: 44px; border: 1px solid rgba(55,227,227,0.28);
          background: rgba(4,25,21,0.68); color: #95d9d3; font: inherit;
          font-size: 10px; letter-spacing: 0.08em; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 7px 100%, 0 calc(100% - 7px));
        }
        .tb-header-exit:active { color: var(--tb-ink); background: rgba(55,227,227,0.15); }

        .tb-body { flex: 1; min-height: 0; overflow-y: auto; padding: 18px 16px calc(env(safe-area-inset-bottom, 0px) + 18px); z-index: 6; }
        .tb-body.is-booting { display: flex; align-items: flex-start; }
        .tb-body.is-ready {
          display: flex; padding: 10px 8px calc(env(safe-area-inset-bottom, 0px) + 9px);
        }
        .tb-boot-log { width: 100%; padding-top: min(7vh, 52px); }
        .tb-line { font-size: 13.5px; line-height: 1.85; letter-spacing: 0.02em; }
        .tb-dim { color: #2fd6d6; opacity: 0.55; }
        .tb-cmd { color: #2fd6d6; }
        .tb-ok { color: #4dffaa; }
        .tb-hi { color: #f4fffb; font-size: 19px; font-weight: bold; margin: 8px 0; text-shadow: 0 0 10px rgba(47,214,214,0.4); }
        .tb-gold { color: #ffd23a; letter-spacing: 0.14em; margin-top: 8px; }
        .tb-cur { color: #5ff2f2; }
        .tb-skip {
          margin-top: 32px; color: #4d827e; font-size: 9px; letter-spacing: 0.15em;
          animation: tbSkipPulse 1.6s ease-in-out infinite;
        }
        @keyframes tbSkipPulse { 50% { opacity: 0.42; } }

        /* ---- TUNER ---- */
        .tb-tuner {
          width: 100%; max-width: 520px; min-height: 100%; margin: 0 auto;
          display: flex; flex: 1; flex-direction: column; gap: 8px;
          animation: tbTunerIn 0.42s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes tbTunerIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: none; }
        }
        .tb-auth {
          display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
          border: 1px solid rgba(55,227,227,0.17);
          background: rgba(5,29,25,0.62);
          color: #87bdb8; font-size: 9px; letter-spacing: 0.07em;
        }
        .tb-auth span { min-width: 0; padding: 8px 7px; text-align: center; white-space: nowrap; }
        .tb-auth span + span { border-left: 1px solid rgba(55,227,227,0.13); }
        .tb-auth b { color: var(--tb-green); font-weight: 400; margin-right: 3px; }
        .tb-section-head {
          display: flex; justify-content: space-between; align-items: baseline;
          padding: 4px 2px 1px; color: var(--tb-gold);
          font-size: 12px; letter-spacing: 0.14em;
        }
        .tb-counter { color: #6daaa4; font-size: 9px; letter-spacing: 0.12em; }

        /* Full-height market console: the viewport is an instrument surface,
           but it reads as spectral glass and data architecture, not furniture. */
        .tb-console {
          position: relative; isolation: isolate; flex: 1;
          display: flex; flex-direction: column; gap: 8px; min-height: 0;
          padding: 10px 10px 11px;
          border: 1px solid rgba(99,196,178,0.38);
          background:
            linear-gradient(rgba(55,227,227,0.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(55,227,227,0.018) 1px, transparent 1px),
            radial-gradient(85% 55% at 50% 18%, color-mix(in srgb, var(--tb-channel) 11%, transparent), transparent 70%),
            linear-gradient(155deg, rgba(11,48,42,0.94), rgba(5,29,25,0.98));
          background-size: 30px 30px, 30px 30px, auto, auto;
          box-shadow:
            inset 0 1px 0 rgba(179,255,235,0.06),
            inset 0 0 36px rgba(0,0,0,0.16),
            0 0 28px color-mix(in srgb, var(--tb-channel) 9%, transparent);
          clip-path: polygon(0 0, calc(100% - 13px) 0, 100% 13px, 100% 100%, 13px 100%, 0 calc(100% - 13px));
          overflow: hidden;
        }
        .tb-console::after {
          content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none;
          background:
            linear-gradient(135deg, var(--tb-channel), transparent 16%) top left / 54px 1px no-repeat,
            linear-gradient(315deg, var(--tb-channel), transparent 16%) bottom right / 54px 1px no-repeat;
          opacity: 0.68;
        }
        .tb-bezel {
          position: relative; padding: 10px;
          border: 1px solid color-mix(in srgb, var(--tb-channel) 34%, #237f72);
          background:
            linear-gradient(135deg, rgba(27,78,69,0.72), rgba(2,13,11,0.94) 42%, rgba(11,50,43,0.72));
          box-shadow:
            inset 0 1px 0 rgba(191,255,239,0.1),
            inset 0 0 20px rgba(0,0,0,0.48),
            0 0 24px color-mix(in srgb, var(--tb-channel) 14%, transparent);
          clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
        }
        .tb-crt {
          position: relative; height: clamp(246px, 38dvh, 330px); overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--tb-channel) 68%, transparent);
          background:
            linear-gradient(90deg, color-mix(in srgb, var(--tb-channel) 3%, transparent), transparent 25% 75%, color-mix(in srgb, var(--tb-channel) 3%, transparent)),
            radial-gradient(92% 68% at 50% 48%, rgba(6,27,25,0.45), transparent 76%),
            #000706;
          display: flex; align-items: center; justify-content: center;
          touch-action: pan-y;
          box-shadow:
            inset 0 0 58px rgba(0,0,0,0.72),
            0 0 12px color-mix(in srgb, var(--tb-channel) 22%, transparent),
            0 0 30px color-mix(in srgb, var(--tb-channel) 12%, transparent);
        }
        .tb-crt::after {
          content: ""; position: absolute; inset: 0; z-index: 8; pointer-events: none;
          box-shadow: inset 9px 0 18px rgba(0,0,0,0.28), inset -9px 0 18px rgba(0,0,0,0.28),
                      inset 0 8px 17px rgba(0,0,0,0.2), inset 0 -8px 17px rgba(0,0,0,0.3);
        }
        .tb-crt-head {
          position: absolute; top: 8px; left: 11px; right: 11px; z-index: 6;
          display: flex; justify-content: space-between; align-items: center;
          font-size: 10px; letter-spacing: 0.1em;
        }
        .tb-ch { color: var(--tb-gold); font-weight: bold; }
        .tb-sig { color: #4dffaa; opacity: 0.85; }

        .tb-preview-media {
          position: absolute; inset: 0; z-index: 1;
          width: 100%; height: 100%; object-fit: cover;
          object-position: var(--tb-preview-position, 50% 50%);
          opacity: 0.92; pointer-events: none;
          filter: saturate(0.88) contrast(1.08) brightness(0.78);
        }

        .tb-card {
          position: relative; z-index: 5; width: 100%; text-align: center; padding: 26px 54px 10px;
          /* Re-keyed on channel change, so this replays as the tune-in settle. */
          animation: tbCardIn 0.34s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .tb-card.has-preview {
          align-self: stretch; height: 100%;
          display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-start;
          padding: 72px 17px 15px; text-align: left;
          background: linear-gradient(180deg, transparent 42%, rgba(0,7,6,0.15) 58%, rgba(0,7,6,0.9) 100%);
        }
        .tb-card.has-preview .tb-card-overline {
          margin: 0 0 4px; padding: 3px 5px 2px;
          background: rgba(0,7,6,0.66); backdrop-filter: blur(3px);
        }
        .tb-card.has-preview .tb-card-title {
          font-size: clamp(18px, 5.6vw, 24px); line-height: 1;
        }
        .tb-card.has-preview .tb-card-sub {
          max-width: 260px; margin: 5px 0 0; font-size: 9px; line-height: 1.3;
          color: rgba(226,248,243,0.82);
        }
        .tb-card-overline {
          margin: 12px 0 6px; color: var(--tb-channel);
          font-size: 9px; letter-spacing: 0.16em;
        }
        .tb-card-title {
          font-family: 'Orbitron', 'IoskeleyMono', monospace;
          font-size: clamp(23px, 8vw, 34px); font-weight: 700; letter-spacing: 0.06em; color: #f4fffb;
          /* Chromatic split — the magenta half also ties the terminal to LT TV's
             network colour without putting magenta on any small type. */
          text-shadow: -1.5px 0 rgba(239,98,220,0.55), 1.5px 0 rgba(47,214,214,0.55);
        }
        .tb-card-sub {
          max-width: 300px; margin: 8px auto 0; font-size: 12px; line-height: 1.45;
          color: #b7ded9; letter-spacing: 0.025em;
        }
        .tb-card-soon {
          margin-top: 9px; font-size: 9.5px; letter-spacing: 0.18em; color: #ffd23a; opacity: 0.8;
        }
        @keyframes tbCardIn {
          0%   { opacity: 0; transform: translateY(6px) scaleY(1.25); filter: blur(1.5px); }
          60%  { opacity: 1; transform: translateY(0) scaleY(0.97); filter: blur(0); }
          100% { opacity: 1; transform: none; }
        }

        /* Each station gets a signal diagram derived from its content: broadcast
           propagation, stacked deal sheets, or a firing neural network. */
        .tb-signal-art {
          position: relative; width: 88px; height: 68px; margin: 0 auto;
          color: var(--tb-channel); filter: drop-shadow(0 0 8px color-mix(in srgb, var(--tb-channel) 45%, transparent));
        }
        .tb-signal-art span { position: absolute; display: block; }
        .tb-air-ring {
          left: 50%; top: 50%; border: 1px solid currentColor; border-radius: 50%;
          transform: translate(-50%, -50%);
        }
        .tb-air-ring-a { width: 52px; height: 52px; opacity: 0.35; animation: tbAir 2.4s ease-out infinite; }
        .tb-air-ring-b { width: 30px; height: 30px; opacity: 0.6; animation: tbAir 2.4s 1.2s ease-out infinite; }
        .tb-air-core {
          left: 50%; top: 50%; width: 8px; height: 8px; border-radius: 50%;
          background: currentColor; transform: translate(-50%, -50%); box-shadow: 0 0 12px currentColor;
        }
        .tb-air-beam { bottom: 7px; width: 1px; height: 34px; background: currentColor; transform-origin: bottom; opacity: 0.65; }
        .tb-air-beam-l { left: 43px; transform: rotate(-28deg); }
        .tb-air-beam-r { right: 43px; transform: rotate(28deg); }
        @keyframes tbAir {
          from { transform: translate(-50%, -50%) scale(0.45); opacity: 0.8; }
          to { transform: translate(-50%, -50%) scale(1.35); opacity: 0; }
        }
        .tb-deal-card {
          width: 43px; height: 52px; border: 1px solid currentColor;
          background: rgba(4,20,15,0.72); clip-path: polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 0 100%);
        }
        .tb-deal-card::before, .tb-deal-card::after {
          content: ""; position: absolute; left: 8px; right: 8px; height: 1px; background: currentColor; opacity: 0.38;
        }
        .tb-deal-card::before { top: 13px; }
        .tb-deal-card::after { top: 20px; }
        .tb-deal-card-a { left: 8px; top: 10px; transform: rotate(-10deg); opacity: 0.38; }
        .tb-deal-card-b { right: 8px; top: 10px; transform: rotate(10deg); opacity: 0.38; }
        .tb-deal-card-c { left: 23px; top: 5px; }
        .tb-deal-mark {
          left: 50%; top: 50%; z-index: 2; transform: translate(-50%, -48%);
          font: 700 22px/1 'IoskeleyMono', monospace; text-shadow: 0 0 8px currentColor;
        }
        .tb-neural-line { left: 16px; top: 33px; width: 56px; height: 1px; background: currentColor; transform-origin: center; opacity: 0.48; }
        .tb-neural-line-a { transform: rotate(25deg); }
        .tb-neural-line-b { transform: rotate(-28deg); }
        .tb-neural-line-c { transform: rotate(90deg); }
        .tb-neural-node {
          width: 11px; height: 11px; border: 1px solid currentColor; border-radius: 50%;
          background: #04140f; box-shadow: 0 0 7px currentColor;
        }
        .tb-neural-node-a { left: 10px; top: 28px; }
        .tb-neural-node-b { right: 10px; top: 28px; animation: tbNode 1.8s 0.45s ease-in-out infinite; }
        .tb-neural-node-c { left: 39px; top: 3px; animation: tbNode 1.8s 0.9s ease-in-out infinite; }
        .tb-neural-node-d { left: 39px; bottom: 3px; animation: tbNode 1.8s 1.35s ease-in-out infinite; }
        @keyframes tbNode { 50% { background: currentColor; transform: scale(1.25); } }

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
        .tb-glass {
          position: absolute; top: 5px; left: 7px; z-index: 7; pointer-events: none;
          width: 46%; height: 31%; border-radius: 4px 4px 0 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012) 54%, transparent);
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

        .tb-lattice {
          position: absolute; left: 50%; top: 47%; z-index: -1; width: 190px; height: 190px;
          transform: translate(-50%, -50%) rotate(45deg); opacity: 0.12; pointer-events: none;
          border: 1px solid var(--tb-channel); animation: tbLattice 14s linear infinite;
        }
        .tb-lattice::before, .tb-lattice::after, .tb-lattice i {
          content: ""; position: absolute; border: 1px solid var(--tb-channel);
        }
        .tb-lattice::before { inset: 22px; }
        .tb-lattice::after { inset: 53px; border-radius: 50%; }
        .tb-lattice i:nth-child(1) { left: 50%; top: -22px; bottom: -22px; width: 1px; border-width: 0 0 0 1px; }
        .tb-lattice i:nth-child(2) { top: 50%; left: -22px; right: -22px; height: 1px; border-width: 1px 0 0; }
        .tb-lattice i:nth-child(3) { inset: 78px; border-radius: 50%; box-shadow: 0 0 18px var(--tb-channel); }
        @keyframes tbLattice {
          to { transform: translate(-50%, -50%) rotate(405deg); }
        }

        .tb-market-rail {
          min-height: 62px; display: grid; grid-template-columns: minmax(0,1fr) auto auto;
          align-items: center; gap: 10px; padding: 4px 3px 2px;
          border-bottom: 1px solid rgba(55,227,227,0.1);
        }
        .tb-terminal-mark { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .tb-terminal-mark strong {
          color: rgba(200,244,234,0.62); font: 700 11px/1 'Orbitron', 'IoskeleyMono', monospace;
          letter-spacing: 0.1em;
        }
        .tb-terminal-mark span { color: #4b7a73; font-size: 8px; letter-spacing: 0.08em; }
        .tb-feed-live {
          display: flex; align-items: center; gap: 6px; color: #71958f; font-size: 8px; letter-spacing: 0.11em;
        }
        .tb-feed-live i {
          width: 7px; height: 7px; border-radius: 50%; background: var(--tb-channel);
          box-shadow: 0 0 7px var(--tb-channel); animation: tbOnAir 2s ease-in-out infinite;
        }
        @keyframes tbOnAir { 50% { opacity: 0.38; } }
        .tb-function-keys { display: flex; gap: 6px; }
        .tb-softkey {
          min-width: 63px; height: 44px; display: flex; flex-direction: column;
          align-items: flex-start; justify-content: center; gap: 3px; padding: 5px 8px;
          border: 1px solid color-mix(in srgb, var(--tb-channel) 48%, #2fd6d6);
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--tb-channel) 13%, transparent), transparent 42%),
            linear-gradient(180deg, rgba(16,62,55,0.94), rgba(3,23,20,0.96));
          color: #d8f6ef; font: inherit; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%);
          box-shadow:
            inset 0 0 0 1px rgba(177,255,239,0.045),
            inset 0 -10px 18px rgba(0,0,0,0.2);
          transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
        }
        .tb-softkey span {
          color: var(--tb-channel); font-size: 7px; letter-spacing: 0.12em;
          text-shadow: 0 0 7px color-mix(in srgb, var(--tb-channel) 42%, transparent);
        }
        .tb-softkey b { color: #effffb; font-size: 9px; letter-spacing: 0.06em; font-weight: 400; }
        .tb-softkey:hover {
          border-color: color-mix(in srgb, var(--tb-channel) 76%, #7fffee);
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--tb-channel) 20%, transparent), transparent 48%),
            linear-gradient(180deg, rgba(18,72,64,0.98), rgba(4,29,25,0.98));
        }
        .tb-softkey:active { background: color-mix(in srgb, var(--tb-channel) 17%, #031411); }

        .tb-telemetry {
          display: grid; grid-template-columns: repeat(3, minmax(0,1fr));
          border: 1px solid rgba(55,227,227,0.13); background: rgba(0,10,8,0.44);
        }
        .tb-metric {
          position: relative; min-width: 0; padding: 7px 9px 8px;
          display: flex; flex-direction: column; gap: 3px; overflow: hidden;
        }
        .tb-metric + .tb-metric { border-left: 1px solid rgba(55,227,227,0.11); }
        .tb-metric span { color: #527e77; font-size: 7px; letter-spacing: 0.11em; white-space: nowrap; }
        .tb-metric strong {
          color: var(--tb-channel); font: 700 13px/1 'IoskeleyMono', monospace;
          letter-spacing: 0.04em; text-shadow: 0 0 8px color-mix(in srgb, var(--tb-channel) 48%, transparent);
        }
        .tb-metric i {
          position: absolute; left: 0; right: 0; bottom: 0; height: 1px;
          background: linear-gradient(90deg, transparent, var(--tb-channel), transparent);
          opacity: 0.5;
        }

        /* THE STRUCK GOLD BAR — the same object as the briefing's REVIEW THIS
           DEAL (PressFlat's .pf-start .pf-btn.primary), and deliberately the ONLY
           button on this screen that gets it (author, 2026-08-05).

           WHAT WAS WRONG. This was a dark bar with a hairline channel-tinted
           border on a screen where the three channel tiles below it are lit
           panels with gradients and inset glow. The one committing action was
           the quietest control on its own screen — you tune with the tiles, and
           the thing that actually takes you INTO a channel looked like a caption.
           The tuner is glass and light; the button has to be metal for the eye to
           separate "the instrument" from "the switch."

           WHY GOLD AND NOT var(--tb-channel), which is the tuner's whole colour
           system. Gold is ALREADY this terminal's action colour independent of
           channel — SELECT A CHANNEL, the CH 01 readout and every preset number
           are --tb-gold on all three channels — so a gold CTA joins a family that
           exists rather than fighting the tuner. A channel-tinted bar would also
           make the button change identity three times on a screen whose entire
           job is that the CHANNEL changes and the ACT does not. Channel identity
           stays where it is legible: the CRT header, the bezel glow, the strip.
           (If this is ever wanted per-channel, it is one token — swap --tb-gold
           for var(--tb-channel) in the gradient and the border.)

           NOT THE SOFTKEYS AND NOT THE PRESETS. F1/F2 are navigation and the
           strip carries each channel's own accent, which is the one thing on the
           screen that must stay keyed to --tb-channel. Gold on all of them would
           spend the emphasis it exists to create. */
        .tb-enter {
          position: relative; overflow: hidden;
          min-height: 54px; display: flex; align-items: baseline; justify-content: center; gap: 10px;
          background: linear-gradient(90deg, #3a2d05, var(--tb-gold) 48%, #3a2d05);
          border: 1px solid rgba(255,210,58,0.8);
          /* DARK INK ON METAL. The old #eafff9 was light-on-dark and there is no
             version of it that reads on a lit gold bar. */
          color: #07100d;
          font-family: 'Orbitron', 'IoskeleyMono', monospace; font-weight: 700;
          padding: 13px; cursor: pointer;
          text-shadow: 0 1px rgba(255,255,255,0.25);
          box-shadow: 0 0 20px rgba(255,210,58,0.2), inset 0 0 18px rgba(255,255,255,0.14);
          clip-path: polygon(0 0, calc(100% - 11px) 0, 100% 11px, 100% 100%, 11px 100%, 0 calc(100% - 11px));
          transition: box-shadow 0.15s ease, transform 0.1s ease;
        }
        /* The struck inner rule — what makes it read as stamped stock rather than
           as a rectangle with a gradient. Inset 4px, same as the briefing's. */
        .tb-enter::after {
          content: ""; position: absolute; inset: 4px; pointer-events: none;
          border: 1px solid rgba(5,15,12,0.23);
        }
        .tb-enter-command { color: #07100d; font-size: 14px; letter-spacing: 0.1em; }
        /* The readout stays MONO while the verb goes Orbitron — "CH 01 // LT TV"
           is machine output and the slashes and digits are what that face is for.
           Dimmed ink rather than a second colour: it is the button's subtitle. */
        .tb-enter-label {
          font-family: 'IoskeleyMono', 'Courier New', monospace; font-weight: 400;
          color: rgba(7,16,13,0.7); font-size: 10px; letter-spacing: 0.08em;
        }
        .tb-enter:not(:disabled):active { transform: scale(0.99); }
        .tb-enter:not(:disabled):hover {
          box-shadow: 0 0 26px rgba(255,210,58,0.34), inset 0 0 18px rgba(255,255,255,0.22);
        }
        /* OFF AIR IS DEAD METAL, not a faded gold one. opacity:0.4 on a lit bar
           leaves a glowing ghost that still reads as pressable; this strikes the
           gradient out entirely, which is what "no signal" should look like. */
        .tb-enter:disabled {
          background: #25312e; border-color: rgba(142,171,165,0.28); color: #6d8781;
          box-shadow: none; text-shadow: none; cursor: default;
        }
        .tb-enter:disabled::after { border-color: rgba(255,255,255,0.05); }

        .tb-presets-label {
          display: flex; align-items: center; justify-content: space-between;
          padding: 2px 2px 0; color: #57827c; font-size: 8px; letter-spacing: 0.1em;
        }
        .tb-presets-label span:last-child { color: #365c57; }
        .tb-strip {
          display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px;
        }
        .tb-strip-item {
          min-width: 0; min-height: 62px; display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 6px;
          background:
            linear-gradient(145deg, rgba(17,58,52,0.82), rgba(5,24,21,0.96) 58%);
          border: 1px solid color-mix(in srgb, #2fd6d6 43%, transparent);
          color: #dff9f3; font: inherit; font-size: 10px; line-height: 1.15; padding: 8px 7px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px));
          box-shadow:
            inset 0 0 0 1px rgba(182,255,241,0.035),
            inset 0 -16px 28px rgba(0,0,0,0.2);
          transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
        }
        .tb-strip-item.is-on {
          border-color: color-mix(in srgb, var(--tb-item-accent) 88%, #eafff9); color: #ffffff;
          background:
            linear-gradient(145deg, color-mix(in srgb, var(--tb-item-accent) 23%, #10332e), rgba(5,24,21,0.98) 64%);
          box-shadow:
            inset 0 0 0 1px color-mix(in srgb, var(--tb-item-accent) 18%, transparent),
            inset 0 0 22px color-mix(in srgb, var(--tb-item-accent) 18%, transparent);
        }
        .tb-strip-item:not(.is-on):hover {
          border-color: color-mix(in srgb, var(--tb-item-accent) 64%, #2fd6d6);
          background:
            linear-gradient(145deg, color-mix(in srgb, var(--tb-item-accent) 12%, #123b35), rgba(5,27,24,0.98) 62%);
        }
        .tb-strip-no { color: #ffd23a; font-size: 10px; letter-spacing: 0.1em; }
        .tb-strip-label { min-width: 0; overflow-wrap: anywhere; text-align: left; }
        .tb-strip-item.is-on .tb-strip-no { color: var(--tb-item-accent); }

        button:focus-visible {
          outline: 2px solid var(--tb-ink); outline-offset: 2px;
        }

        /* The rolling band and the static are the two things that read as
           motion sickness triggers here; the card settle is short enough to
           keep, but it loses the scale/blur part. */
        @media (prefers-reduced-motion: reduce) {
          .tb-track, .tb-static, .tb-skip, .tb-air-ring, .tb-neural-node, .tb-feed-live i, .tb-lattice { animation: none; }
          .tb-static { opacity: 0.5; }
          .tb-card, .tb-tuner { animation-duration: 0.01s; }
          .tb-preview-media { opacity: 0.78; }
        }

        @container terminal (max-height: 650px) {
          .tb-body.is-ready { padding-top: 7px; padding-bottom: 7px; }
          .tb-tuner { gap: 6px; }
          .tb-auth span { padding-block: 6px; }
          .tb-console { gap: 6px; padding-block: 8px; }
          .tb-bezel { padding: 8px; }
          .tb-crt { height: 200px; min-height: 200px; }
          .tb-signal-art { width: 76px; height: 56px; transform: scale(0.84); margin-bottom: -5px; }
          .tb-card-overline { margin-top: 6px; }
          .tb-card.has-preview { padding: 58px 13px 10px; }
          .tb-card.has-preview .tb-card-sub { display: none; }
          .tb-market-rail { min-height: 54px; }
          .tb-softkey { height: 42px; min-width: 58px; }
          .tb-metric { padding-block: 6px; }
          .tb-strip-item { min-height: 48px; }
        }

        @media (max-width: 350px) {
          .tb-body.is-ready { padding-inline: 5px; }
          .tb-live { display: none; }
          .tb-auth { font-size: 8px; }
          .tb-auth span { padding-inline: 3px; }
          .tb-card { padding-inline: 22px; }
          .tb-market-rail { gap: 7px; }
          .tb-terminal-mark strong { font-size: 9px; }
          .tb-terminal-mark span { font-size: 7px; }
          .tb-feed-live { display: none; }
          .tb-function-keys { gap: 4px; }
          .tb-softkey { min-width: 54px; padding-inline: 6px; }
          .tb-strip-item { grid-template-columns: 1fr; gap: 2px; text-align: center; }
          .tb-strip-label { text-align: center; font-size: 9px; }
          .tb-enter { gap: 6px; }
          .tb-presets-label span:last-child { display: none; }
        }
      `}</style>
    </div>
  );
}
