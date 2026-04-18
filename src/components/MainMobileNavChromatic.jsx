"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import ChromaticButton from "./ChromaticButton";

/**
 * MainMobileNavChromatic — bottom dock navigation rendered with ChromaticButton.
 *
 * Drop-in replacement for MainMobileNav. Same slot API:
 *   left | leftCenter | center | rightCenter | right
 *
 * Visuals: icons are bright glowing white by default; on hover/tap/active,
 * pink + blue chromatic layers slide into place (see ChromaticButton.css).
 * Per-slot color tints from the legacy nav are intentionally dropped —
 * the chromatic effect is the identity.
 *
 * Props:
 *  - onBuyClick, onCommsClick, onMissionClick, onLeaderboardClick, onLoungeClick
 *  - variant           — kept for API parity (currently unused visually)
 *  - overrideSlots     — { left?, leftCenter?, center?, rightCenter?, right? }
 *                        each: { icon, label, onClick, active?, disabled? }
 */
export default function MainMobileNavChromatic({
  onBuyClick,
  onCommsClick,
  onMissionClick,
  onLeaderboardClick,
  onLoungeClick,
  variant = "default",
  overrideSlots = {},
}) {
  const [fabPulse, setFabPulse] = useState(false);
  // Tracks the most-recently-tapped slot so its chromatic split persists
  // until another slot is tapped — mirrors the codepen's `.active` link
  // behavior. Slots that pass an explicit `slot.active` boolean override
  // this (e.g. the candle slot, which follows `candleLit`).
  const [activeKey, setActiveKey] = useState(null);
  const barRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setFabPulse(true);
      setTimeout(() => setFabPulse(false), 600);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const triggerGlow = useCallback(() => {
    const bar = barRef.current;
    if (!bar) return;
    bar.classList.remove("mnc-glow");
    void bar.offsetWidth;
    bar.classList.add("mnc-glow");
  }, []);

  /* ── Icon SVGs (stroke="currentColor" so chromatic layers tint correctly) ── */
  const BuyIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );

  const CommsIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 18h.01" />
      <path d="M7 14a5 5 0 0 1 10 0" />
      <path d="M4 10a9 9 0 0 1 16 0" />
      <rect x="5" y="18" width="14" height="4" rx="1" />
    </svg>
  );

  const LeaderboardIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 6 9 6 9" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 18 9 18 9" />
      <path d="M4 22h16" />
      <path d="M10 22V10a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12" />
      <path d="M20 22V10a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v12" />
      <path d="M14 22V6a2 2 0 0 0-2-2h0a2 2 0 0 0-2 2v16" />
    </svg>
  );

  const LoungeIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 11h1a3 3 0 0 1 0 6h-1" />
      <path d="M7 11H6a3 3 0 0 0 0 6h1" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <rect x="7" y="11" width="10" height="6" rx="1" />
      <path d="M9 21v-2" />
      <path d="M15 21v-2" />
    </svg>
  );

  const ClaimIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999" />
      <path d="M15.973 4.027A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024" />
      <path d="M16.001 11.999a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069" />
      <path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z" />
    </svg>
  );

  /* ── Default slot configs ── */
  const defaults = {
    left:        { icon: <BuyIcon />,         label: "BUY",    onClick: onBuyClick },
    leftCenter:  { icon: <CommsIcon />,       label: "COMMS",  onClick: onCommsClick },
    center:      { icon: <ClaimIcon />,       label: "CLAIM",  onClick: onMissionClick },
    rightCenter: { icon: <LeaderboardIcon />, label: "RANK",   onClick: onLeaderboardClick },
    right:       { icon: <LoungeIcon />,      label: "LOUNGE", onClick: onLoungeClick },
  };

  const slots = {
    left:        overrideSlots.left        || defaults.left,
    leftCenter:  overrideSlots.leftCenter  || defaults.leftCenter,
    center:      overrideSlots.center      || defaults.center,
    rightCenter: overrideSlots.rightCenter || defaults.rightCenter,
    right:       overrideSlots.right       || defaults.right,
  };

  const handleSlot = (key, slot) => (e) => {
    if (slot.disabled) return;
    setActiveKey(key);
    triggerGlow();
    slot.onClick?.(e);
  };

  return (
    <>
      <style>{`
        .mnc-dock {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 10000;
          pointer-events: none;
          font-family: 'PT Sans Narrow', 'Cyber', 'Geo', sans-serif;
        }

        .mnc-bar {
          pointer-events: auto;
          display: flex;
          align-items: flex-end;
          justify-content: space-around;
          padding: 10px 8px calc(10px + env(safe-area-inset-bottom, 0px));
          background: rgba(18, 10, 22, 0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.5);
          position: relative;
          overflow: visible;
          transform: translateZ(0);
          will-change: transform;
          isolation: isolate;
        }

        /* White glow bleed on tap — matches the chromatic identity */
        .mnc-bar::before {
          content: '';
          position: absolute;
          top: -6px;
          left: 0;
          right: 0;
          height: 12px;
          background: rgba(255, 255, 255, 0.6);
          filter: blur(10px);
          opacity: 0;
          pointer-events: none;
          z-index: -1;
        }
        .mnc-bar.mnc-glow::before {
          animation: mncGlowBleed 0.45s ease-out forwards;
        }
        @keyframes mncGlowBleed {
          0%   { opacity: 0.7; filter: blur(8px); }
          100% { opacity: 0;   filter: blur(16px); }
        }

        /* Slot wrapper — holds the ChromaticButton */
        .mnc-slot {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 52px;
        }

        .mnc-slot .chroma-btn {
          --chroma-icon-size: 22px;
          --chroma-offset: 3px;
          -webkit-tap-highlight-color: transparent;
          padding: 4px 2px;
          transition: transform 0.2s ease;
        }
        .mnc-slot .chroma-btn .chroma-btn__label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          margin-top: 4px;
        }
        .mnc-slot .chroma-btn[disabled],
        .mnc-slot .chroma-btn.is-disabled {
          opacity: 0.35;
          pointer-events: none;
        }
        @media (hover: hover) {
          .mnc-slot .chroma-btn:hover {
            transform: translateY(-2px);
          }
        }

        /* Center slot — larger icon for visual hierarchy + optional pulse */
        .mnc-slot--center {
          margin-top: -18px;
        }
        .mnc-slot--center .chroma-btn {
          --chroma-icon-size: 34px;
          --chroma-offset: 4px;
          padding: 8px 10px 4px;
          border-radius: 50%;
          background: radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 70%);
        }
        .mnc-slot--center .chroma-btn .chroma-btn__label {
          font-size: 9px;
          margin-top: 2px;
        }
        .mnc-slot--center.mnc-pulse .chroma-btn .chroma-btn__icon--base {
          animation: mncCenterPulse 0.6s ease;
        }
        @keyframes mncCenterPulse {
          0%, 100% {
            text-shadow:
              0 0 6px rgba(255, 255, 255, 0.95),
              0 0 14px rgba(255, 255, 255, 0.85),
              0 0 24px rgba(255, 255, 255, 0.55);
          }
          50% {
            text-shadow:
              0 0 10px rgba(255, 255, 255, 1),
              0 0 22px rgba(252, 81, 201, 0.7),
              0 0 36px rgba(5, 221, 250, 0.5);
          }
        }
      `}</style>

      <div className="mnc-dock">
        <div className="mnc-bar" ref={barRef}>
          {(["left", "leftCenter", "center", "rightCenter", "right"]).map((key) => {
            const slot = slots[key];
            const isCenter = key === "center";
            // Explicit per-slot `active` wins (e.g. candle slot tracks
            // candleLit); otherwise the last-tapped slot stays active.
            const isActive =
              slot.active !== undefined ? !!slot.active : activeKey === key;
            return (
              <div
                key={key}
                className={`mnc-slot ${isCenter ? "mnc-slot--center" : ""} ${isCenter && fabPulse ? "mnc-pulse" : ""}`}
              >
                <ChromaticButton
                  icon={slot.icon}
                  label={slot.label}
                  active={isActive}
                  onClick={handleSlot(key, slot)}
                  className={slot.disabled ? "is-disabled" : ""}
                  aria-label={slot.label}
                />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
