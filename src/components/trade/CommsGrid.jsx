"use client";
import React, { useState } from "react";
import { CHARACTER_META, CHARACTER_ORDER } from "@/components/CaseFile/characterMeta";

// Mobile "COUNCIL" comms grid — the Liminal Terminal's video-conference roster.
// On mobile you don't walk among the consultants (desktop); you operate the
// terminal and dial into them. This is the channel-selection screen: four CRT
// "feeds" (one per lens), tinted in each character's color (the same palette as
// the desktop beacon strands + the mobile SIGNAL knot). Tap a feed → open that
// channel (handled by the parent via onSelectChannel).
//
// Prototype scope: selection grid only, wired to CHARACTER_META. Voice / the
// in-channel Q&A / verdict come next.
export default function CommsGrid({
  caseInfo = { project: "PROPHET TOKEN", ticker: "$PRPHT", chain: "Base" },
  scansUsed = 0,
  scansMax = 3,
  visited = [],
  onSelectChannel,
  onExit,
  exitLabel = "◀ DISCONNECT",
}) {
  const [active, setActive] = useState(null);
  const visitedSet = new Set(visited);

  const select = (key) => {
    setActive(key);
    onSelectChannel?.(key);
  };

  const scanDots = Array.from({ length: scansMax }, (_, i) => i < scansMax - scansUsed);

  return (
    <div className="cg-root">
      {/* header */}
      <div className="cg-header">
        <span className="cg-title">LIMINAL // COUNCIL</span>
        <span className="cg-case">{caseInfo.ticker} · {caseInfo.chain}</span>
        <span className="cg-live"><i className="cg-dot" />4 CHANNELS</span>
      </div>

      {/* the 2×2 feed grid */}
      <div className="cg-grid">
        {CHARACTER_ORDER.map((key, i) => {
          const c = CHARACTER_META[key];
          const isVisited = visitedSet.has(key);
          return (
            <button
              key={key}
              className={`cg-tile${active === key ? " cg-tile--active" : ""}`}
              style={{ "--cgc": c.color }}
              onClick={() => select(key)}
            >
              <span className="cg-feed">
                <img className="cg-portrait" src={c.portrait} alt={c.name} draggable={false} />
                <span className="cg-tint" />
                <span className="cg-scan" />
              </span>

              {/* feed chrome */}
              <span className="cg-ch">CH-{i + 1}</span>
              <span className="cg-status">
                <i className="cg-dot cg-dot--sm" />{isVisited ? "CONSULTED" : "ONLINE"}
              </span>
              <span className="cg-sigil">{c.sigil}</span>

              {/* name plate */}
              <span className="cg-plate">
                <span className="cg-name">{c.name}</span>
                <span className="cg-role">{c.role} · {c.roleSub}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* footer */}
      <div className="cg-footer">
        {onExit
          ? <button className="cg-exit" onClick={onExit}>{exitLabel}</button>
          : <span className="cg-hint">▸ OPEN A CHANNEL TO CONSULT</span>}
        <span className="cg-scans">
          SCANS&nbsp;
          {scanDots.map((on, i) => (
            <i key={i} className={`cg-pip${on ? " cg-pip--on" : ""}`} />
          ))}
        </span>
      </div>

      <style>{`
        .cg-root {
          position: absolute; inset: 0;
          display: flex; flex-direction: column;
          background:
            radial-gradient(120% 80% at 50% 35%, rgba(10,40,38,0.35), rgba(2,16,14,0.0)),
            #02100e;
          color: #2fd6d6;
          font-family: 'Courier New', monospace;
          padding: 14px 12px calc(env(safe-area-inset-bottom, 0px) + 14px);
          overflow: hidden;
          user-select: none;
        }
        /* global CRT scanlines + vignette over everything */
        .cg-root::after {
          content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 5;
          background:
            repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0 1px, transparent 1px 3px),
            radial-gradient(130% 100% at 50% 50%, transparent 60%, rgba(0,0,0,0.55) 100%);
          mix-blend-mode: multiply;
        }
        .cg-header {
          display: flex; align-items: center; justify-content: space-between;
          font-size: 13px; letter-spacing: 0.04em; padding-bottom: 12px;
        }
        .cg-title { color: #5ff2f2; font-weight: bold; }
        .cg-case { color: #ffd23a; opacity: 0.9; }
        .cg-live { display: inline-flex; align-items: center; gap: 6px; color: #2fd6d6; }
        .cg-dot {
          width: 7px; height: 7px; border-radius: 50%; background: #ff4040;
          box-shadow: 0 0 6px #ff4040; animation: cgblink 1.1s steps(1) infinite;
        }
        .cg-dot--sm { width: 5px; height: 5px; }
        @keyframes cgblink { 50% { opacity: 0.25; } }

        .cg-grid {
          flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: 1fr;
          gap: 10px; min-height: 0;
        }
        .cg-tile {
          position: relative; overflow: hidden; cursor: pointer;
          border: 1.5px solid color-mix(in srgb, var(--cgc) 70%, transparent);
          background: #061a18;
          clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
          box-shadow: inset 0 0 22px color-mix(in srgb, var(--cgc) 22%, transparent),
                      0 0 0 1px rgba(0,0,0,0.4);
          padding: 0; color: inherit; font: inherit; text-align: left;
          transition: box-shadow 0.18s ease, transform 0.12s ease;
        }
        .cg-tile:active { transform: scale(0.985); }
        .cg-tile--active {
          box-shadow: inset 0 0 30px color-mix(in srgb, var(--cgc) 40%, transparent),
                      0 0 16px color-mix(in srgb, var(--cgc) 55%, transparent);
          border-color: var(--cgc);
        }
        /* the "feed" — portrait under a CRT degrade */
        .cg-feed { position: absolute; inset: 0; overflow: hidden; }
        .cg-portrait {
          width: 100%; height: 100%; object-fit: cover; object-position: 50% 22%;
          filter: grayscale(0.45) contrast(1.12) brightness(0.82);
          animation: cgflicker 5.5s ease-in-out infinite;
        }
        @keyframes cgflicker { 0%,97%,100% { opacity: 1; } 98% { opacity: 0.78; } 99% { opacity: 0.92; } }
        .cg-tint {
          position: absolute; inset: 0;
          background: linear-gradient(180deg, transparent 35%, rgba(2,16,14,0.92) 100%),
                      var(--cgc);
          mix-blend-mode: color; opacity: 0.5;
        }
        .cg-scan {
          position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0 1px, transparent 1px 3px);
        }
        .cg-ch {
          position: absolute; top: 8px; left: 10px; z-index: 2;
          font-size: 11px; letter-spacing: 0.08em; color: var(--cgc);
          text-shadow: 0 0 6px color-mix(in srgb, var(--cgc) 60%, transparent);
        }
        .cg-status {
          position: absolute; top: 8px; right: 10px; z-index: 2;
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 10px; letter-spacing: 0.06em; color: #bfeede;
        }
        .cg-status .cg-dot { background: #4dffaa; box-shadow: 0 0 6px #4dffaa; animation: none; }
        .cg-sigil {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -60%);
          z-index: 2; font-size: 46px; line-height: 1; color: var(--cgc);
          opacity: 0.55; text-shadow: 0 0 16px color-mix(in srgb, var(--cgc) 70%, transparent);
          pointer-events: none;
        }
        .cg-plate {
          position: absolute; left: 0; right: 0; bottom: 0; z-index: 3;
          display: flex; flex-direction: column; gap: 1px; padding: 8px 10px 9px;
        }
        .cg-name {
          font-size: 14px; font-weight: bold; color: #f4fffb; letter-spacing: 0.02em;
          text-shadow: 0 0 8px color-mix(in srgb, var(--cgc) 65%, transparent);
        }
        .cg-role { font-size: 10px; letter-spacing: 0.12em; color: var(--cgc); opacity: 0.95; }

        .cg-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding-top: 12px; font-size: 12px; letter-spacing: 0.05em;
        }
        .cg-hint { color: #2fd6d6; opacity: 0.85; }
        .cg-exit { background: none; border: 1px solid color-mix(in srgb, #2fd6d6 50%, transparent); color: #2fd6d6; font: inherit; font-size: 12px; letter-spacing: 0.05em; padding: 4px 10px; cursor: pointer; clip-path: polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 7px 100%, 0 calc(100% - 7px)); }
        .cg-scans { display: inline-flex; align-items: center; color: #ffd23a; gap: 4px; }
        .cg-pip { width: 9px; height: 9px; border: 1.5px solid #ffd23a; opacity: 0.4; }
        .cg-pip--on { background: #ffd23a; opacity: 1; box-shadow: 0 0 6px #ffd23a; }
      `}</style>
    </div>
  );
}
