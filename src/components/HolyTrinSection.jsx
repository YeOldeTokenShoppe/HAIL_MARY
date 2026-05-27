"use client";

import React, { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";
import ScrambleText from "./ScrambleText";
import DropInTitle from "./DropInTitle";
import "./holyTrin.css";

const PILLARS = [
    {
    id: "integr80",
    label: "Integr80",
    tagline: "incorrupt",
    color: "#2ad6ee",
    description:
      "Token contract renounced. 80% of supply in the LP. No admin keys, no mint function, no hidden levers.",
  },
  {
    id: "util80",
    label: "Util80",
    tagline: "in use",
    color: "#d4af37",
    description:
      "A share of revenue from x402-powered services flows to stakers through immutable code. Verifiable on Basescan. Plus a growing ecosystem of games, economic zones, and services built on the RL80 cosmology.",
  },

  {
    id: "liquid80",
    label: "Liquid80",
    tagline: "secured",
    color: "#d92db0",
    description:
      "LP tokens burned. Liquidity locked permanently — Small pool, but unruggable.",
  },
];

export default function HolyTrinSection() {
  const ref = useRef(null);
  const inView = useInView(ref, {
    amount: 0.01,
    margin: "200px 0px",
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
      <div className="holy-trin-text">
        <DropInTitle
          lines={["The Holy", "Trin80", "of Tokens"]}
          colors={["#2ad6ee", "#d4af37", "#d92db0"]}
          fontSize={{ mobile: "3rem", desktop: "3.4rem" }}
          isMobile={typeof window !== "undefined" && window.innerWidth <= 900}
          triggerAnimation={inView}
          instanceId="holy-trin-heading"
        />
        {/* <p className="holy-trin-subtitle">
          {PILLARS.map((p, i) => (
            <React.Fragment key={p.id}>
              {i > 0 && <span className="holy-trin-subtitle-sep">·</span>}
              <span
                className="holy-trin-subtitle-name"
                style={{ "--pillar-color": p.color }}
              >
                {p.label}
              </span>
            </React.Fragment>
          ))}
        </p> */}
        <ul className="holy-trin-pillars">
          {PILLARS.map((p) => (
            <li
              key={p.id}
              className="holy-trin-pillar"
              style={{ "--pillar-color": p.color }}
            >
              <span className="holy-trin-pillar-name">{p.label}</span>
         <span
                className="holy-trin-pillar-desc"
                // duration={900}
                // perturbation={0.12}
                // from="left"
                // revealRate={18}
                // settleRate={12}
                // cursor="·"
              >
                {p.description}
         </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="holy-trin-visual">
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
            <radialGradient id="trin-aura" cx="50%" cy="55%" r="55%">
              <stop offset="0%" stopColor="#d92db0" stopOpacity="0.32" />
              <stop offset="45%" stopColor="#d4af37" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#2ad6ee" stopOpacity="0" />
            </radialGradient>
            <filter id="trin-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="trin-soft-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          {/* Pulsing aura behind the whole figure */}
          <circle
            className="holy-trin-aura"
            cx="150"
            cy="155"
            r="180"
            fill="url(#trin-aura)"
          />

          {/* Outer rotating ring — slow clockwise */}
          <g className="holy-trin-orbit holy-trin-orbit--outer">
            <circle
              cx="150"
              cy="155"
              r="145"
              fill="none"
              stroke="url(#trin-stroke)"
              strokeOpacity="0.32"
              strokeWidth="0.8"
              strokeDasharray="2 6"
            />
            <circle
              cx="150"
              cy="155"
              r="138"
              fill="none"
              stroke="url(#trin-stroke)"
              strokeOpacity="0.18"
              strokeWidth="0.6"
              strokeDasharray="6 18"
            />
          </g>

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

          {/* Energy traveling along the triangle perimeter */}
          <polygon
            className="holy-trin-energy"
            points="150,40 40,240 260,240"
            fill="none"
            stroke="url(#trin-stroke)"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#trin-glow)"
          />

          {/* Inner counter-rotating ring around the medallion */}
          <g className="holy-trin-orbit holy-trin-orbit--inner">
            <circle
              cx="150"
              cy="173"
              r="34"
              fill="none"
              stroke="url(#trin-stroke)"
              strokeOpacity="0.55"
              strokeWidth="0.9"
              strokeDasharray="3 5"
            />
          </g>

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

          {/* Vertex halos — pulse behind each vertex dot */}
          <g className="holy-trin-halos" filter="url(#trin-soft-glow)">
            <circle className="holy-trin-halo holy-trin-halo--top" cx="150" cy="40" r="16" fill="#2ad6ee" />
            <circle className="holy-trin-halo holy-trin-halo--bl" cx="40" cy="240" r="16" fill="#d4af37" />
            <circle className="holy-trin-halo holy-trin-halo--br" cx="260" cy="240" r="16" fill="#d92db0" />
          </g>

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
      </div>
    </section>
  );
}
