"use client";

import React, { useState, useEffect, useCallback } from "react";

/**
 * MainMobileNav — bottom dock navigation.
 *
 * Default slots: Buy | Comms | Mission Control (center FAB) | Leaderboard | Lounge
 *
 * Props:
 *  - onBuyClick        — opens BuyModal
 *  - onCommsClick      — opens comms panel
 *  - onMissionClick    — opens mission control
 *  - onLeaderboardClick — opens leaderboard
 *  - onLoungeClick     — opens lounge
 *  - variant           — "home" | "space" | "shrine" | "default"
 *  - overrideSlots     — { left?, leftCenter?, center?, rightCenter?, right? }
 *                        each: { icon, label, onClick, active? }
 */
export default function MainMobileNav({
  onBuyClick,
  onCommsClick,
  onMissionClick,
  onLeaderboardClick,
  onLoungeClick,
  variant = "default",
  overrideSlots = {},
}) {
  const [fabPulse, setFabPulse] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFabPulse(true);
      setTimeout(() => setFabPulse(false), 600);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  /* ── Icon SVGs ── */
  const BuyIcon = () => (
    <svg className="mn-nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );

  const CommsIcon = () => (
    <svg className="mn-nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 18h.01" />
      <path d="M7 14a5 5 0 0 1 10 0" />
      <path d="M4 10a9 9 0 0 1 16 0" />
      <rect x="5" y="18" width="14" height="4" rx="1" />
    </svg>
  );

  const LeaderboardIcon = () => (
    <svg className="mn-nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 6 9 6 9" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5C17 4 18 9 18 9" />
      <path d="M4 22h16" />
      <path d="M10 22V10a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12" />
      <path d="M20 22V10a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v12" />
      <path d="M14 22V6a2 2 0 0 0-2-2h0a2 2 0 0 0-2 2v16" />
    </svg>
  );

  const LoungeIcon = () => (
    <svg className="mn-nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 11h1a3 3 0 0 1 0 6h-1" />
      <path d="M7 11H6a3 3 0 0 0 0 6h1" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <rect x="7" y="11" width="10" height="6" rx="1" />
      <path d="M9 21v-2" />
      <path d="M15 21v-2" />
    </svg>
  );

  const MissionIcon = () => (
    <svg className="mn-nav-svg mn-mission-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="2" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="22" />
      <line x1="2" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="22" y2="12" />
    </svg>
  );

  /* ── Default slot configs ── */
  const defaults = {
    left: {
      icon: <BuyIcon />,
      label: "BUY",
      onClick: onBuyClick,
      colorClass: "mn-buy",
    },
    leftCenter: {
      icon: <CommsIcon />,
      label: "COMMS",
      onClick: onCommsClick,
      colorClass: "mn-comms",
    },
    center: {
      icon: <MissionIcon />,
      label: "MISSION",
      onClick: onMissionClick,
    },
    rightCenter: {
      icon: <LeaderboardIcon />,
      label: "RANK",
      onClick: onLeaderboardClick,
      colorClass: "mn-rank",
    },
    right: {
      icon: <LoungeIcon />,
      label: "LOUNGE",
      onClick: onLoungeClick,
      colorClass: "mn-lounge",
    },
  };

  const slots = {
    left: overrideSlots.left || defaults.left,
    leftCenter: overrideSlots.leftCenter || defaults.leftCenter,
    center: overrideSlots.center || defaults.center,
    rightCenter: overrideSlots.rightCenter || defaults.rightCenter,
    right: overrideSlots.right || defaults.right,
  };

  const renderItem = (slot, key) => (
    <button key={key} className="mn-item" onClick={slot.onClick}>
      <div className={`mn-icon ${slot.active ? "mn-active" : ""}`}>
        {slot.icon}
      </div>
      <span className={`mn-label ${slot.active ? "mn-label-active" : ""} ${slot.colorClass || ""}`}>
        {slot.label}
      </span>
    </button>
  );

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

        .mn-nav-svg {
          width: 22px;
          height: 22px;
        }

        .mn-label {
          font-size: 10px;
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

        /* ---- Slot color accents ---- */
        .mn-buy .mn-nav-svg,
        .mn-item:has(.mn-buy) .mn-nav-svg { color: hsl(152, 80%, 45%); }

        .mn-comms .mn-nav-svg,
        .mn-item:has(.mn-comms) .mn-nav-svg { color: hsl(200, 80%, 55%); }

        .mn-rank .mn-nav-svg,
        .mn-item:has(.mn-rank) .mn-nav-svg { color: hsl(45, 90%, 55%); }

        .mn-lounge .mn-nav-svg,
        .mn-item:has(.mn-lounge) .mn-nav-svg { color: hsl(280, 60%, 60%); }

        /* Use parent to color the svg */
        .mn-item .mn-buy { }
        .mn-item .mn-comms { }
        .mn-item .mn-rank { }
        .mn-item .mn-lounge { }

        /* ---- CENTER FAB ---- */
        .mn-fab-wrapper {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          margin-top: -28px;
          z-index: 2;
        }

        .mn-fab {
          width: 58px;
          height: 58px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: 3px solid rgba(255, 140, 0, 0.4);
          background: linear-gradient(145deg, hsl(25, 90%, 35%), hsl(15, 80%, 22%));
          box-shadow: 0 4px 16px rgba(255, 100, 0, 0.3), 0 2px 6px rgba(0, 0, 0, 0.4);
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          -webkit-tap-highlight-color: transparent;
          flex-direction: column;
          gap: 1px;
        }

        .mn-fab:active {
          transform: scale(0.93);
          box-shadow: 0 2px 8px rgba(255, 100, 0, 0.5), 0 1px 3px rgba(0, 0, 0, 0.4);
        }

        .mn-fab .mn-mission-svg {
          width: 24px;
          height: 24px;
          color: rgba(255, 220, 180, 0.9);
        }

        .mn-fab-label {
          font-family: 'Cyber', 'Geo', sans-serif;
          font-size: 0.5rem;
          font-weight: 900;
          letter-spacing: 1px;
          color: rgba(255, 220, 180, 0.9);
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
          line-height: 1;
        }

        @keyframes mnFabPulse {
          0%, 100% { box-shadow: 0 4px 16px rgba(255, 100, 0, 0.3), 0 2px 6px rgba(0, 0, 0, 0.4); }
          50% { box-shadow: 0 4px 24px rgba(255, 100, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.4), 0 0 40px rgba(255, 100, 0, 0.12); }
        }

        .mn-fab.mn-pulse {
          animation: mnFabPulse 0.6s ease;
        }
      `}</style>

      <div className="mn-dock">
        <div className="mn-bar">
          {renderItem(slots.left, "left")}
          {renderItem(slots.leftCenter, "leftCenter")}

          {/* Center FAB */}
          <div className="mn-fab-wrapper">
            <button
              className={`mn-fab ${fabPulse ? "mn-pulse" : ""}`}
              onClick={slots.center.onClick}
            >
              {slots.center.icon}
              <span className="mn-fab-label">{slots.center.label}</span>
            </button>
          </div>

          {renderItem(slots.rightCenter, "rightCenter")}
          {renderItem(slots.right, "right")}
        </div>
      </div>
    </>
  );
}
