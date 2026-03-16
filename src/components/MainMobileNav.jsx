"use client";

import React, { useState, useEffect, useCallback } from "react";

/**
 * MainMobileNav — bottom dock navigation for the /main page (mobile only).
 *
 * Slots: Music | Character | BUY (center FAB) | Stake | Portfolio
 *
 * Props:
 *  - isPlaying, onPlay, onPause, onSkip  — music controls
 *  - characters        — array of { name, image }
 *  - activeCharIndex   — currently displayed character index
 *  - onCharSelect(i)   — callback when user picks a character
 *  - onBuyClick        — opens BuyModal
 *  - onStakeClick      — navigate to staking
 *  - businesses        — array of { label, icon, live, onProceed }
 */
export default function MainMobileNav({
  isPlaying = false,
  onPlay,
  onPause,
  onSkip,
  characters = [],
  activeCharIndex = 0,
  onCharSelect,
  onBuyClick,
  onStakeClick,
  businesses = [],
}) {
  const [buyPulse, setBuyPulse] = useState(false);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [showCharPicker, setShowCharPicker] = useState(false);

  // Subtle pulse on buy FAB every 8s
  useEffect(() => {
    const interval = setInterval(() => {
      setBuyPulse(true);
      setTimeout(() => setBuyPulse(false), 600);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Close overlays on outside tap
  const closeOverlays = useCallback(() => {
    setShowPortfolio(false);
    setShowCharPicker(false);
  }, []);

  const current = characters[activeCharIndex] || { name: "?", image: null };

  return (
    <>
      <style>{`
        .mn-dock {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 10000;
          pointer-events: none;
          padding-bottom: env(safe-area-inset-bottom, 0px);
          font-family: 'Cyber', 'Geo', sans-serif;
        }

        .mn-bar {
          pointer-events: auto;
          display: flex;
          align-items: flex-end;
          justify-content: space-around;
          padding: 6px 4px 8px;
          background: rgba(5, 5, 15, 0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid rgba(0, 255, 255, 0.15);
          box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.5);
          position: relative;
        }

        /* ---- NAV ITEM ---- */
        .mn-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-end;
          gap: 3px;
          cursor: pointer;
          padding: 6px 2px 2px;
          border-radius: 12px;
          transition: all 0.15s ease;
          -webkit-tap-highlight-color: transparent;
          background: transparent;
          border: none;
          min-width: 52px;
          position: relative;
          color: inherit;
        }

        .mn-item:active {
          transform: scale(0.93);
        }

        .mn-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          transition: all 0.15s ease;
          position: relative;
          background: transparent;
        }

        .mn-icon.mn-active {
          background: rgba(0, 255, 255, 0.1);
        }

        .mn-label {
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: rgba(0, 255, 255, 0.4);
          line-height: 1;
          white-space: nowrap;
        }

        .mn-label.mn-label-active {
          color: hsl(183, 38%, 57%);
        }

        /* ---- MUSIC SPLIT ---- */
        .mn-music-split {
          display: flex;
          gap: 3px;
          width: 36px;
          height: 32px;
        }

        .mn-music-half {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          border-radius: 8px;
          background: rgba(0, 255, 255, 0.08);
          border: none;
          color: hsl(183, 38%, 57%);
          cursor: pointer;
          transition: all 0.12s ease;
        }

        .mn-music-half:active {
          background: rgba(0, 255, 255, 0.2);
          transform: scale(0.92);
        }

        /* ---- CHARACTER CAMEO ---- */
        .mn-char-cameo {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          object-fit: cover;
          border: 1.5px solid rgba(0, 255, 255, 0.3);
          transition: border-color 0.2s;
        }

        /* ---- CENTER BUY FAB ---- */
        .mn-buy-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          margin-top: -28px;
          z-index: 2;
        }

        .mn-buy-fab {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: 3px solid rgba(0, 229, 114, 0.3);
          background: linear-gradient(145deg, hsl(152, 100%, 40%), hsl(152, 80%, 30%));
          box-shadow: 0 4px 16px rgba(0, 229, 114, 0.4), 0 2px 6px rgba(0, 0, 0, 0.4);
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          -webkit-tap-highlight-color: transparent;
        }

        .mn-buy-fab:active {
          transform: scale(0.93);
          box-shadow: 0 2px 8px rgba(0, 229, 114, 0.5), 0 1px 3px rgba(0, 0, 0, 0.4);
        }

        .mn-buy-text {
          font-family: 'Cyber', 'Geo', sans-serif;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 2px;
          color: #fff;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        .mn-buy-label {
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: rgba(0, 229, 114, 0.5);
          margin-top: 3px;
          line-height: 1;
        }

        @keyframes mnFabPulse {
          0%, 100% { box-shadow: 0 4px 16px rgba(0, 229, 114, 0.4), 0 2px 6px rgba(0, 0, 0, 0.4); }
          50% { box-shadow: 0 4px 24px rgba(0, 229, 114, 0.6), 0 2px 6px rgba(0, 0, 0, 0.4), 0 0 40px rgba(0, 229, 114, 0.15); }
        }

        .mn-buy-fab.mn-pulse {
          animation: mnFabPulse 0.6s ease;
        }

        /* ---- STAKE ICON ---- */
        .mn-stake-svg {
          width: 22px;
          height: 22px;
          color: hsl(45, 90%, 55%);
        }

        /* ---- PORTFOLIO ICON ---- */
        .mn-portfolio-svg {
          width: 22px;
          height: 22px;
          color: hsl(183, 38%, 57%);
        }

        /* ---- BOTTOM SHEET OVERLAY ---- */
        .mn-sheet-backdrop {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          pointer-events: auto;
          animation: mnFadeIn 0.2s ease;
        }

        .mn-sheet {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 10001;
          pointer-events: auto;
          background: rgba(10, 10, 20, 0.97);
          border-top: 1px solid rgba(0, 255, 255, 0.15);
          border-radius: 16px 16px 0 0;
          padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
          max-height: 60vh;
          overflow-y: auto;
          animation: mnSlideUp 0.25s ease;
          font-family: 'Cyber', 'Geo', sans-serif;
        }

        .mn-sheet-handle {
          width: 36px;
          height: 4px;
          border-radius: 2px;
          background: rgba(0, 255, 255, 0.2);
          margin: 0 auto 14px;
        }

        .mn-sheet-title {
          font-size: 0.55rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: hsl(183, 38%, 57%);
          margin-bottom: 12px;
        }

        /* ---- SHEET LIST ITEM ---- */
        .mn-biz-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          background: rgba(0, 255, 255, 0.03);
          border: 1px solid rgba(0, 255, 255, 0.08);
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          -webkit-tap-highlight-color: transparent;
          color: hsl(183, 38%, 57%);
          font-family: 'Cyber', 'Geo', sans-serif;
          font-size: 0.85rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .mn-biz-item:active {
          background: rgba(0, 255, 255, 0.08);
          transform: scale(0.98);
        }

        .mn-biz-item.mn-biz-disabled {
          opacity: 0.35;
          pointer-events: none;
        }

        .mn-biz-icon {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        .mn-biz-live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #00e572;
          box-shadow: 0 0 6px rgba(0, 229, 114, 0.8);
          margin-left: auto;
          flex-shrink: 0;
        }

        .mn-biz-soon {
          font-size: 0.4rem;
          letter-spacing: 0.1em;
          color: hsl(40, 100%, 60%);
          margin-left: auto;
          flex-shrink: 0;
        }

        /* ---- CHARACTER PICKER SHEET ---- */
        .mn-char-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
          gap: 12px;
          padding: 4px 0;
        }

        .mn-char-option {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          padding: 8px 4px;
          border-radius: 12px;
          border: 1px solid transparent;
          background: transparent;
          transition: all 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .mn-char-option:active {
          transform: scale(0.95);
        }

        .mn-char-option.mn-char-selected {
          border-color: rgba(0, 255, 255, 0.3);
          background: rgba(0, 255, 255, 0.05);
        }

        .mn-char-option img {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid rgba(0, 255, 255, 0.15);
          transition: border-color 0.2s;
        }

        .mn-char-option.mn-char-selected img {
          border-color: hsl(183, 38%, 57%);
        }

        .mn-char-name {
          font-size: 0.8rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(0, 255, 255, 0.5);
          text-align: center;
          line-height: 1.2;
          font-family: 'Cyber', 'Geo', sans-serif;
        }

        .mn-char-option.mn-char-selected .mn-char-name {
          color: hsl(183, 38%, 57%);
        }

        @keyframes mnFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes mnSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>

      {/* ── Bottom sheet overlays ── */}

      {/* Portfolio sheet */}
      {showPortfolio && (
        <>
          <div className="mn-sheet-backdrop" onClick={closeOverlays} />
          <div className="mn-sheet">
            <div className="mn-sheet-handle" />
            <div className="mn-sheet-title">// Portfolio</div>
            {businesses.map((biz, i) => (
              <div
                key={i}
                className={`mn-biz-item ${!biz.live ? "mn-biz-disabled" : ""}`}
                onClick={() => {
                  if (biz.live && biz.onProceed) {
                    biz.onProceed();
                    setShowPortfolio(false);
                  }
                }}
              >
                <span className="mn-biz-icon">{biz.icon}</span>
                <span>{biz.label}</span>
                {biz.live ? (
                  <span className="mn-biz-live-dot" />
                ) : (
                  <span className="mn-biz-soon">SOON</span>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Character picker sheet */}
      {showCharPicker && (
        <>
          <div className="mn-sheet-backdrop" onClick={closeOverlays} />
          <div className="mn-sheet">
            <div className="mn-sheet-handle" />
            <div className="mn-sheet-title">// Select Character</div>
            <div className="mn-char-grid">
              {characters.map((char, i) => (
                <button
                  key={i}
                  className={`mn-char-option ${i === activeCharIndex ? "mn-char-selected" : ""}`}
                  onClick={() => {
                    if (onCharSelect) onCharSelect(i);
                    setShowCharPicker(false);
                  }}
                >
                  {char.image ? (
                    <img src={char.image} alt={char.name} />
                  ) : (
                    <div style={{
                      width: 48, height: 48, borderRadius: "50%",
                      background: "rgba(0,255,255,0.05)",
                      border: "2px solid rgba(0,255,255,0.15)",
                    }} />
                  )}
                  <span className="mn-char-name">{char.name}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Dock bar ── */}
      <div className="mn-dock">
        <div className="mn-bar">

          {/* 1 — Music */}
          {isPlaying ? (
            <div className="mn-item">
              <div className="mn-icon mn-active">
                <div className="mn-music-split">
                  <button className="mn-music-half" onClick={onPause}>⏹</button>
                  <button className="mn-music-half" onClick={onSkip}>⏭</button>
                </div>
              </div>
              <span className="mn-label mn-label-active">MUSIC</span>
            </div>
          ) : (
            <button className="mn-item" onClick={onPlay}>
              <div className="mn-icon">
                <span style={{ color: "hsl(183, 38%, 57%)", fontSize: 22 }}>♫</span>
              </div>
              <span className="mn-label">MUSIC</span>
            </button>
          )}

          {/* 2 — Character */}
          <button className="mn-item" onClick={() => { setShowCharPicker(true); setShowPortfolio(false); }}>
            <div className="mn-icon">
              {current.image ? (
                <img className="mn-char-cameo" src={current.image} alt={current.name} />
              ) : (
                <span style={{ color: "hsl(183, 38%, 57%)", fontSize: 20 }}>👤</span>
              )}
            </div>
            <span className="mn-label">TEAM</span>
          </button>

          {/* 3 — CENTER BUY FAB */}
          <div className="mn-buy-wrapper">
            <button
              className={`mn-buy-fab ${buyPulse ? "mn-pulse" : ""}`}
              onClick={onBuyClick}
            >
              <span className="mn-buy-text">BUY</span>
            </button>
            <span className="mn-buy-label">RL80</span>
          </div>

          {/* 4 — Stake */}
          <button className="mn-item" onClick={onStakeClick}>
            <div className="mn-icon">
              <svg className="mn-stake-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" />
                <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" />
                <path d="m2 16 6 6" />
                <circle cx="16" cy="9" r="2.9" />
                <circle cx="6" cy="5" r="3" />
              </svg>
            </div>
            <span className="mn-label">STAKE</span>
          </button>

          {/* 5 — Portfolio */}
          <button className="mn-item" onClick={() => { setShowPortfolio(true); setShowCharPicker(false); }}>
            <div className="mn-icon" style={{ position: "relative" }}>
              <svg className="mn-portfolio-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3" />
              </svg>
              {/* Live indicator if any business is live */}
              {businesses.some(b => b.live) && (
                <span style={{
                  position: "absolute", top: 2, right: 2,
                  width: 5, height: 5, borderRadius: "50%",
                  background: "#00e572",
                  boxShadow: "0 0 4px rgba(0,229,114,0.8)",
                }} />
              )}
            </div>
            <span className="mn-label">BIZ</span>
          </button>

        </div>
      </div>
    </>
  );
}
