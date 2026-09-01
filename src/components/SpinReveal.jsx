"use client";

// SpinReveal — the DAILY TICKET's click-and-spin cover (after George Park's
// emoji scratch card, codepen.io/GeorgePark/pen/WgGmPq). Like the pen, the
// cover is a glyph, not a disc: a 💰 sits over the cell, and a tap sends it
// visibly whirling away — rotate(-600°) while it shrinks (a symmetric foil
// disc hid the rotation; a glyph shows it) — as the symbol pops in with the
// pen's springy overshoot. Controlled the way ScratchReveal was: `revealed`
// owns the state and `onReveal` reports the tap, so REVEAL ALL and settled
// replays come through the same prop and animate (or, under
// prefers-reduced-motion, simply cut) identically. A real <button>, so
// Enter/Space reveal without any extra wiring.

const SPIN_MS = 800;
const POP_EASE = "cubic-bezier(0.22, 0.64, 0.69, 1.3)"; // the pen's overshoot

export default function SpinReveal({ revealed = false, onReveal, cover = "💰", coverSize = 34, label = "tap to reveal", style, children }) {
  const reduceMotion = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={revealed}
      onClick={() => { if (!revealed) onReveal?.(); }}
      style={{
        position: "relative", display: "block", width: "100%", padding: 0, margin: 0,
        border: "none", background: "none", overflow: "hidden",
        cursor: revealed ? "default" : "pointer", userSelect: "none", WebkitUserSelect: "none",
        WebkitTapHighlightColor: "transparent",
        ...style,
      }}
    >
      {/* the symbol — mounted underneath the whole time, pops in as the cover leaves */}
      <div style={{
        position: "absolute", inset: 0,
        transform: revealed ? "scale(1)" : "scale(0)",
        transition: reduceMotion ? "none" : `transform ${SPIN_MS}ms ${POP_EASE}`,
      }}>
        {children}
      </div>
      {/* the 💰 — whirls off on reveal */}
      <div aria-hidden="true" style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: coverSize, lineHeight: 1,
        transform: revealed ? "rotate(-600deg) scale(0)" : "none",
        transition: reduceMotion ? "none" : `transform ${SPIN_MS}ms`,
        pointerEvents: "none",
      }}>{cover}</div>
    </button>
  );
}
