"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [fabPulse, setFabPulse] = useState(false);
  const barRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setFabPulse(true);
      setTimeout(() => setFabPulse(false), 600);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const triggerGlow = useCallback((color) => {
    const bar = barRef.current;
    if (!bar) return;
    bar.style.setProperty('--mn-glow-color', color);
    bar.classList.remove('mn-glow');
    void bar.offsetWidth; // force reflow to restart animation
    bar.classList.add('mn-glow');
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
      onClick: onLoungeClick || (() => router.push('/arcade')),
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

  // Aligned to the HUD panel palette: labels stay uniform muted gold so
  // the nav reads as cohesive, but each icon gets a desaturated character
  // tint so the row doesn't feel monotone. Every tint is pulled toward the
  // panel's muted/vintage lightness so none of them pop above the others.
  const glowColors = {
    'mn-buy': '#7fb87a',    // sage green — money
    'mn-comms': '#6bc7d1',  // panel cyan — data/comms
    'mn-rank': '#d4a854',   // panel gold — brand/status
    'mn-lounge': '#c478a0', // muted rose — social/lounge
  };

  const renderItem = (slot, key) => (
    <button
      key={key}
      className={`mn-item ${slot.disabled ? "mn-disabled" : ""} ${slot.active ? "mn-item-active" : ""} ${slot.colorClass || ""}`}
      onClick={(e) => {
        if (slot.disabled) return;
        triggerGlow(glowColors[slot.colorClass] || 'rgba(0, 255, 255, 0.6)');
        slot.onClick?.(e);
      }}
    >
      <div className={`mn-icon ${slot.active ? "mn-active" : ""}`}>
        {slot.icon}
      </div>
      <span className={`mn-label ${slot.active ? "mn-label-active" : ""} ${slot.colorClass || ""}`}>
        {slot.label}
      </span>
      {slot.active && <div className={`mn-active-indicator ${slot.colorClass || ""}`} />}
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
          font-family: 'Cyber', 'Geo', sans-serif;
        }

        .mn-bar {
          pointer-events: auto;
          display: flex;
          align-items: flex-end;
          justify-content: space-around;
          padding: 6px 4px calc(8px + env(safe-area-inset-bottom, 0px));
          background: rgba(18, 10, 22, 0.92);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid rgba(212, 168, 84, 0.2);
          box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.5);
          position: relative;
          overflow: visible;
          /* Force own compositing layer to prevent backdrop-filter flicker
             when an animated canvas repaints underneath. */
          transform: translateZ(0);
          will-change: transform;
          isolation: isolate;
        }

        /* Glow bleed — colored light that bleeds up through bar top edge on tap */
        .mn-bar::before {
          content: '';
          position: absolute;
          top: -6px;
          left: 0;
          right: 0;
          height: 12px;
          background: var(--mn-glow-color, transparent);
          filter: blur(10px);
          opacity: 0;
          transition: opacity 0.15s ease;
          pointer-events: none;
          z-index: -1;
        }

        .mn-bar.mn-glow::before {
          animation: mnGlowBleed 0.4s ease-out forwards;
        }

        @keyframes mnGlowBleed {
          0% { opacity: 0.8; filter: blur(8px); }
          100% { opacity: 0; filter: blur(16px); }
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
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease;
          -webkit-tap-highlight-color: transparent;
          background: transparent;
          border: none;
          min-width: 52px;
          position: relative;
          color: inherit;
        }

        .mn-item.mn-disabled {
          opacity: 0.35;
          pointer-events: none;
        }

        /* ---- Desktop hover effects ---- */
        @media (hover: hover) {
          .mn-item:hover {
            transform: translateY(-2px) scale(1.08);
          }

          .mn-item:hover .mn-icon {
            box-shadow: 0 0 12px rgba(212, 168, 84, 0.3);
          }

          .mn-item:hover .mn-label {
            color: rgba(212, 168, 84, 0.8);
          }

          .mn-item.mn-buy:hover .mn-icon { box-shadow: 0 0 14px rgba(127, 184, 122, 0.35); }
          .mn-item.mn-comms:hover .mn-icon { box-shadow: 0 0 14px rgba(107, 199, 209, 0.35); }
          .mn-item.mn-rank:hover .mn-icon { box-shadow: 0 0 14px rgba(212, 168, 84, 0.35); }
          .mn-item.mn-lounge:hover .mn-icon { box-shadow: 0 0 14px rgba(196, 120, 160, 0.35); }

          .mn-item.mn-buy:hover .mn-label { color: rgba(127, 184, 122, 0.8); }
          .mn-item.mn-comms:hover .mn-label { color: rgba(107, 199, 209, 0.8); }
          .mn-item.mn-rank:hover .mn-label { color: rgba(212, 168, 84, 0.8); }
          .mn-item.mn-lounge:hover .mn-label { color: rgba(196, 120, 160, 0.8); }
        }

        /* Spring bounce on tap */
        @keyframes mnSpringBounce {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.22); }
          55%  { transform: scale(0.94); }
          75%  { transform: scale(1.06); }
          100% { transform: scale(1); }
        }

        .mn-item:active {
          animation: mnSpringBounce 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .mn-item:active .mn-icon {
          box-shadow: 0 0 16px rgba(212, 168, 84, 0.5);
        }

        .mn-item:has(.mn-buy):active .mn-icon {
          box-shadow: 0 0 18px rgba(127, 184, 122, 0.6);
        }

        .mn-item:has(.mn-comms):active .mn-icon {
          box-shadow: 0 0 18px rgba(107, 199, 209, 0.6);
        }

        .mn-item:has(.mn-rank):active .mn-icon {
          box-shadow: 0 0 18px rgba(212, 168, 84, 0.6);
        }

        .mn-item:has(.mn-lounge):active .mn-icon {
          box-shadow: 0 0 18px rgba(196, 120, 160, 0.6);
        }

        /* ---- Active item indicator bar ---- */
        .mn-active-indicator {
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          width: 20px;
          height: 3px;
          border-radius: 2px;
          background: #d4a854;
          box-shadow: 0 0 8px rgba(212, 168, 84, 0.6), 0 0 16px rgba(212, 168, 84, 0.3);
          animation: mnIndicatorIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .mn-active-indicator.mn-buy {
          background: #7fb87a;
          box-shadow: 0 0 8px rgba(127, 184, 122, 0.6), 0 0 16px rgba(127, 184, 122, 0.3);
        }

        .mn-active-indicator.mn-comms {
          background: #6bc7d1;
          box-shadow: 0 0 8px rgba(107, 199, 209, 0.6), 0 0 16px rgba(107, 199, 209, 0.3);
        }

        .mn-active-indicator.mn-rank {
          background: #d4a854;
          box-shadow: 0 0 8px rgba(212, 168, 84, 0.6), 0 0 16px rgba(212, 168, 84, 0.3);
        }

        .mn-active-indicator.mn-lounge {
          background: #c478a0;
          box-shadow: 0 0 8px rgba(196, 120, 160, 0.6), 0 0 16px rgba(196, 120, 160, 0.3);
        }

        @keyframes mnIndicatorIn {
          0%   { width: 0; opacity: 0; }
          60%  { width: 24px; opacity: 1; }
          100% { width: 20px; opacity: 1; }
        }

        /* ---- Active item — breathing glow on icon ---- */
        .mn-item-active .mn-icon {
          animation: mnBreathGlow 2.5s ease-in-out infinite;
        }

        .mn-item-active.mn-buy .mn-icon {
          animation-name: mnBreathGlowGreen;
        }

        .mn-item-active.mn-comms .mn-icon {
          animation-name: mnBreathGlowCyan;
        }

        .mn-item-active.mn-rank .mn-icon {
          animation-name: mnBreathGlowGold;
        }

        .mn-item-active.mn-lounge .mn-icon {
          animation-name: mnBreathGlowRose;
        }

        @keyframes mnBreathGlow {
          0%, 100% { box-shadow: 0 0 6px rgba(212, 168, 84, 0.15); }
          50%      { box-shadow: 0 0 14px rgba(212, 168, 84, 0.4), 0 0 24px rgba(212, 168, 84, 0.15); }
        }

        @keyframes mnBreathGlowGreen {
          0%, 100% { box-shadow: 0 0 6px rgba(127, 184, 122, 0.15); }
          50%      { box-shadow: 0 0 14px rgba(127, 184, 122, 0.4), 0 0 24px rgba(127, 184, 122, 0.15); }
        }

        @keyframes mnBreathGlowCyan {
          0%, 100% { box-shadow: 0 0 6px rgba(107, 199, 209, 0.15); }
          50%      { box-shadow: 0 0 14px rgba(107, 199, 209, 0.4), 0 0 24px rgba(107, 199, 209, 0.15); }
        }

        @keyframes mnBreathGlowGold {
          0%, 100% { box-shadow: 0 0 6px rgba(212, 168, 84, 0.15); }
          50%      { box-shadow: 0 0 14px rgba(212, 168, 84, 0.4), 0 0 24px rgba(212, 168, 84, 0.15); }
        }

        @keyframes mnBreathGlowRose {
          0%, 100% { box-shadow: 0 0 6px rgba(196, 120, 160, 0.15); }
          50%      { box-shadow: 0 0 14px rgba(196, 120, 160, 0.4), 0 0 24px rgba(196, 120, 160, 0.15); }
        }

        /* ---- Active item — boosted icon brightness + label color ---- */
        .mn-item-active .mn-nav-svg {
          filter: brightness(1.3);
          transition: filter 0.3s ease;
        }

        .mn-item-active .mn-label {
          transition: color 0.3s ease;
        }

        .mn-item-active.mn-buy .mn-label { color: #7fb87a; }
        .mn-item-active.mn-comms .mn-label { color: #6bc7d1; }
        .mn-item-active.mn-rank .mn-label { color: #d4a854; }
        .mn-item-active.mn-lounge .mn-label { color: #c478a0; }

        .mn-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          transition: all 0.2s ease, box-shadow 0.3s ease;
          position: relative;
          background: transparent;
        }

        .mn-icon.mn-active {
          background: rgba(212, 168, 84, 0.1);
        }

        .mn-nav-svg {
          width: 22px;
          height: 22px;
          transition: filter 0.2s ease, transform 0.2s ease;
        }

        .mn-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: rgba(212, 168, 84, 0.5);
          line-height: 1;
          white-space: nowrap;
          transition: color 0.2s ease;
        }

        .mn-label.mn-label-active {
          color: #d4a854;
        }

        /* ---- Slot icon tints — characterful but desaturated ----
           Labels are uniform muted gold above; the icons carry the per-slot
           character via desaturated tints that sit at roughly the same
           perceived lightness as the HUD panel's gold/cyan. */
        .mn-buy .mn-nav-svg,
        .mn-item:has(.mn-buy) .mn-nav-svg { color: #7fb87a; }     /* sage green — money */

        .mn-comms .mn-nav-svg,
        .mn-item:has(.mn-comms) .mn-nav-svg { color: #6bc7d1; }   /* panel cyan — data */

        .mn-rank .mn-nav-svg,
        .mn-item:has(.mn-rank) .mn-nav-svg { color: #d4a854; }    /* panel gold — brand */

        .mn-lounge .mn-nav-svg,
        .mn-item:has(.mn-lounge) .mn-nav-svg { color: #c478a0; }  /* muted rose — social */

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
          /* Orange retuned to share DNA with the panel's LED red (#e85c2b). */
          border: 3px solid rgba(232, 92, 43, 0.45);
          background: linear-gradient(145deg, #c0421a 0%, #802010 100%);
          box-shadow: 0 4px 16px rgba(232, 92, 43, 0.3), 0 2px 6px rgba(0, 0, 0, 0.4);
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          -webkit-tap-highlight-color: transparent;
          flex-direction: column;
          gap: 1px;
        }

        @keyframes mnFabSpring {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.18); }
          55%  { transform: scale(0.95); }
          75%  { transform: scale(1.05); }
          100% { transform: scale(1); }
        }

        .mn-fab:active {
          animation: mnFabSpring 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          box-shadow: 0 0 24px rgba(232, 92, 43, 0.7), 0 0 10px rgba(240, 112, 48, 0.5);
        }

        .mn-fab .mn-mission-svg {
          width: 24px;
          height: 24px;
          color: #e8d9b8; /* panel cream */
        }

        .mn-fab-label {
          font-family: 'Cyber', 'Geo', sans-serif;
          font-size: 0.5rem;
          font-weight: 900;
          letter-spacing: 1px;
          color: #e8d9b8;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
          line-height: 1;
        }

        @keyframes mnFabPulse {
          0%, 100% { box-shadow: 0 4px 16px rgba(232, 92, 43, 0.3), 0 2px 6px rgba(0, 0, 0, 0.4); }
          50%      { box-shadow: 0 4px 24px rgba(232, 92, 43, 0.5), 0 2px 6px rgba(0, 0, 0, 0.4), 0 0 40px rgba(232, 92, 43, 0.12); }
        }

        .mn-fab.mn-pulse {
          animation: mnFabPulse 0.6s ease;
        }

        /* Desktop hover on FAB */
        @media (hover: hover) {
          .mn-fab:hover {
            transform: translateY(-3px) scale(1.06);
            box-shadow: 0 6px 24px rgba(232, 92, 43, 0.5), 0 2px 8px rgba(0, 0, 0, 0.4);
            border-color: rgba(232, 92, 43, 0.7);
          }
        }
      `}</style>

      <div className="mn-dock">
        <div className="mn-bar" ref={barRef}>
          {renderItem(slots.left, "left")}
          {renderItem(slots.leftCenter, "leftCenter")}

          {/* Center FAB */}
          <div className="mn-fab-wrapper">
            <button
              className={`mn-fab ${fabPulse ? "mn-pulse" : ""}`}
              onClick={(e) => {
                triggerGlow('#e85c2b');
                slots.center.onClick?.(e);
              }}
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
