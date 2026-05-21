"use client";

import React, { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import "./holyTrin.css";

const PILLARS = [
  {
    id: "secur80",
    label: "Secur80",
    tagline: "incorrupt",
    color: "#2ad6ee",
    description:
      "Contract renounced. Sealed on Base. No admin keys, no upgrades — the contract is the doctrine.",
  },
  {
    id: "util80",
    label: "Util80",
    tagline: "in use",
    color: "#d4af37",
    description:
      "Lights candles, mints relics, deals cards. The token of every rite.",
  },
  {
    id: "liquid80",
    label: "Liquid80",
    tagline: "ever flowing",
    color: "#d92db0",
    description:
      "100% burned.",
  },
];

export default function HolyTrinSection() {
  const ref = useRef(null);
  const inView = useInView(ref, {
    amount: 0.15,
    margin: "120px 0px",
    once: true,
  });
  const [activeId, setActiveId] = useState(null);
  const active = PILLARS.find((p) => p.id === activeId) || null;

  useEffect(() => {
    if (!activeId) return undefined;
    const handler = (e) => {
      const target = e.target;
      if (
        target.closest(".holy-trin-corner") ||
        target.closest(".holy-trin-tooltip")
      ) {
        return;
      }
      setActiveId(null);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [activeId]);

  return (
    <section
      ref={ref}
      className={`holy-trin${inView ? " is-revealed" : ""}`}
      aria-label="The Holy Trin80"
    >
      <h2 className="holy-trin-heading">The Holy Trin80</h2>

      <div className="holy-trin-diagram">
        <svg
          className="holy-trin-svg"
          viewBox="0 0 300 280"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="trin-stroke" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2ad6ee" />
              <stop offset="50%" stopColor="#d4af37" />
              <stop offset="100%" stopColor="#d92db0" />
            </linearGradient>
            <filter id="trin-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Spokes from center to each vertex */}
          <g
            className="holy-trin-spokes"
            stroke="rgba(241, 215, 122, 0.32)"
            strokeWidth="1"
            strokeDasharray="3 4"
          >
            <line x1="150" y1="173" x2="150" y2="40" />
            <line x1="150" y1="173" x2="40" y2="240" />
            <line x1="150" y1="173" x2="260" y2="240" />
          </g>

          {/* Outer triangle */}
          <polygon
            className="holy-trin-path"
            points="150,40 40,240 260,240"
            fill="none"
            stroke="url(#trin-stroke)"
            strokeWidth="2"
            strokeLinejoin="round"
            filter="url(#trin-glow)"
          />

          {/* Center medallion */}
          <circle
            className="holy-trin-medallion"
            cx="150"
            cy="173"
            r="24"
            fill="rgba(18, 5, 32, 0.92)"
            stroke="url(#trin-stroke)"
            strokeWidth="1.5"
            filter="url(#trin-glow)"
          />

          {/* Vertex dots */}
          <g className="holy-trin-vertices" fill="url(#trin-stroke)" filter="url(#trin-glow)">
            <circle cx="150" cy="40" r="4" />
            <circle cx="40" cy="240" r="4" />
            <circle cx="260" cy="240" r="4" />
          </g>
        </svg>

        <div className="holy-trin-center">RL80</div>

        {PILLARS.map((p) => {
          const isActive = activeId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              className={`holy-trin-corner holy-trin-corner--${p.id}${
                isActive ? " is-active" : ""
              }`}
              style={{ "--corner-color": p.color }}
              onClick={() => setActiveId((cur) => (cur === p.id ? null : p.id))}
              aria-expanded={isActive}
              aria-label={`${p.label} — ${p.description}`}
            >
              <span className="holy-trin-label">{p.label}</span>
              <span className="holy-trin-tagline">{p.tagline}</span>
            </button>
          );
        })}
      </div>

      <div
        className={`holy-trin-tooltip${active ? " is-visible" : ""}`}
        role="status"
        aria-live="polite"
        style={active ? { "--tooltip-color": active.color } : undefined}
      >
        {active && (
          <>
            <span className="holy-trin-tooltip-title">{active.label}</span>
            <span className="holy-trin-tooltip-text">{active.description}</span>
          </>
        )}
      </div>
    </section>
  );
}
