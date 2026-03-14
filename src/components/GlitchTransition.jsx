"use client";

import { useEffect, useState, useRef, useCallback } from "react";

/**
 * GlitchTransition — fullscreen cyberpunk glitch/scanline overlay.
 *
 * Props:
 *  - active: boolean — triggers the glitch sequence
 *  - onMidpoint: () => void — called at the peak of the glitch (swap model here)
 *  - onComplete: () => void — called when the full animation finishes
 *  - duration: number — total duration in ms (default 800)
 */
export default function GlitchTransition({
  active,
  onMidpoint,
  onComplete,
  duration = 800,
}) {
  const [phase, setPhase] = useState("idle"); // idle | glitching | resolving
  const callbacksRef = useRef({ onMidpoint, onComplete });
  callbacksRef.current = { onMidpoint, onComplete };

  useEffect(() => {
    if (!active) {
      // Reset when active goes false
      setPhase("idle");
      return;
    }

    setPhase("glitching");

    // Fire model swap early (30%) so it has time to load + settle behind the overlay
    const mid = setTimeout(() => {
      callbacksRef.current.onMidpoint?.();
    }, duration * 0.3);

    // Switch to resolving phase at 55%
    const resolve = setTimeout(() => {
      setPhase("resolving");
    }, duration * 0.55);

    // Complete — clear overlay (give extra time for model to settle)
    const end = setTimeout(() => {
      setPhase("idle");
      callbacksRef.current.onComplete?.();
    }, duration);

    return () => {
      clearTimeout(mid);
      clearTimeout(resolve);
      clearTimeout(end);
    };
  }, [active, duration]);

  if (phase === "idle") return null;

  const isGlitching = phase === "glitching";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* Scanlines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 255, 255, 0.03) 2px,
            rgba(0, 255, 255, 0.03) 4px
          )`,
          animation: isGlitching
            ? "glitch-scanlines 0.1s steps(8) infinite"
            : "glitch-scanlines-fade 0.3s ease-out forwards",
        }}
      />

      {/* Horizontal glitch bars */}
      {isGlitching && (
        <>
          <GlitchBar top={15} height={8} delay={0} />
          <GlitchBar top={35} height={4} delay={0.05} />
          <GlitchBar top={55} height={12} delay={0.1} />
          <GlitchBar top={72} height={6} delay={0.07} />
          <GlitchBar top={88} height={3} delay={0.15} />
        </>
      )}

      {/* Flash overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: isGlitching
            ? "rgba(0, 255, 255, 0.15)"
            : "transparent",
          transition: "background 0.15s ease-out",
        }}
      />

      {/* RGB shift overlay */}
      {isGlitching && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            animation: "glitch-rgb 0.08s steps(3) infinite",
            mixBlendMode: "screen",
            opacity: 0.4,
          }}
        />
      )}

      {/* Center flash beam */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: isGlitching ? "120vw" : "0",
          height: isGlitching ? "4px" : "0",
          background:
            "linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.8), white, rgba(0, 255, 255, 0.8), transparent)",
          transition: isGlitching
            ? "none"
            : "width 0.2s ease-out, height 0.2s ease-out, opacity 0.2s ease-out",
          opacity: phase === "resolving" ? 0 : 1,
          boxShadow:
            "0 0 30px rgba(0, 255, 255, 0.6), 0 0 60px rgba(0, 255, 255, 0.3)",
        }}
      />

      <style>{`
        @keyframes glitch-scanlines {
          0% { transform: translateY(0); }
          100% { transform: translateY(4px); }
        }
        @keyframes glitch-scanlines-fade {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes glitch-bar {
          0%, 100% { transform: translateX(0); opacity: 0.7; }
          20% { transform: translateX(-8px); opacity: 1; }
          40% { transform: translateX(12px); opacity: 0.5; }
          60% { transform: translateX(-4px); opacity: 0.9; }
          80% { transform: translateX(6px); opacity: 0.6; }
        }
        @keyframes glitch-rgb {
          0% {
            box-shadow: -2px 0 rgba(255, 0, 0, 0.3), 2px 0 rgba(0, 0, 255, 0.3);
            background: transparent;
          }
          33% {
            box-shadow: 2px 0 rgba(255, 0, 0, 0.3), -2px 0 rgba(0, 0, 255, 0.3);
            background: rgba(0, 255, 255, 0.02);
          }
          66% {
            box-shadow: -1px 0 rgba(255, 0, 0, 0.3), 1px 0 rgba(0, 0, 255, 0.3);
            background: transparent;
          }
        }
      `}</style>
    </div>
  );
}

function GlitchBar({ top, height, delay }) {
  return (
    <div
      style={{
        position: "absolute",
        top: `${top}%`,
        left: 0,
        right: 0,
        height: `${height}px`,
        background: `linear-gradient(90deg,
          transparent 0%,
          rgba(0, 255, 255, 0.1) 10%,
          rgba(0, 255, 255, 0.25) 30%,
          rgba(255, 255, 255, 0.15) 50%,
          rgba(0, 255, 255, 0.2) 70%,
          transparent 100%
        )`,
        animation: "glitch-bar 0.15s steps(4) infinite",
        animationDelay: `${delay}s`,
      }}
    />
  );
}
