"use client";

// RcanaRainFall — falling rain for an art layer that names `fall`.
//
// The layer's sheet (rainfall.webp, from scripts/rcana-rain-sheet.py) is a
// tile of VERTICAL streaks that wraps top to bottom. Here it is laid twice:
// once at its own size, and once enlarged and faster for the rain nearer the
// viewer, so the two slide against each other. Each copy is two tiles tall
// and travels exactly one tile per cycle, which is what makes the loop
// seamless. Only `transform` is animated, so the browser can keep both
// copies as textures and the fall costs no repaint.
//
//   fall: true                       the defaults below
//   fall: { duration, angle, near, opacity }
//     duration  seconds for the far rain to fall one card height
//     angle     lean in degrees; positive leans the streaks toward the right
//     near      strength of the nearer copy, 0 to switch it off
//     opacity   strength of the whole layer
//
// `running` false (a thumbnail, a print, reduced motion) leaves it a still.
import React from "react";

const DEFAULTS = { duration: 1.5, angle: 2, near: 0.6, opacity: 1 };
const NEAR_SCALE = 1.6;
const NEAR_SPEED = 0.62;

export const RAIN_FALL_STYLES = `
@keyframes rc-rain-fall { from { transform: translateY(0); } to { transform: translateY(50%); } }
@media (prefers-reduced-motion: reduce) { .rc-rain-fall-sheet { animation: none !important; } }
`;

export default function RcanaRainFall({ src, fall, running = true, style }) {
  const o = { ...DEFAULTS, ...(fall === true ? null : fall) };
  const lean = (o.angle * Math.PI) / 180;
  // Turned, the rectangle no longer covers its own corners; grown by this it does.
  const cover = Math.cos(lean) + Math.abs(Math.sin(lean)) * 1.45;
  const sheet = (seconds, opacity, delay) => (
    <div
      className="rc-rain-fall-sheet"
      style={{
        position: "absolute",
        left: 0,
        top: "-100%",
        width: "100%",
        height: "200%",
        backgroundImage: `url("${src}")`,
        backgroundSize: "100% 50%",
        backgroundRepeat: "repeat",
        opacity,
        animation: running ? `rc-rain-fall ${seconds}s linear ${delay}s infinite` : undefined,
        willChange: running ? "transform" : undefined,
      }}
    />
  );
  return (
    <div
      className="rc-rain-fall"
      aria-hidden="true"
      style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "hidden", pointerEvents: "none", opacity: o.opacity, ...style }}
    >
      <style>{RAIN_FALL_STYLES}</style>
      <div style={{ position: "absolute", inset: 0, transform: `rotate(${o.angle}deg) scale(${cover.toFixed(3)})` }}>
        {sheet(o.duration, 1, 0)}
        {o.near > 0 && (
          <div style={{ position: "absolute", inset: 0, transform: `scale(${NEAR_SCALE})` }}>
            {sheet(o.duration * NEAR_SPEED, o.near, -o.duration * 0.37)}
          </div>
        )}
      </div>
    </div>
  );
}
