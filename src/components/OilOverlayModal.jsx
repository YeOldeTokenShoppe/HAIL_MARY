"use client";

import { useEffect } from "react";

// Generic centered overlay for /hailmary — wraps any panel content (e.g. the
// leaderboard) in a dismissible, scrollable card. Closes on backdrop click,
// the × button, or Escape.
// `scale` zooms the card (not the backdrop) to match the desktop panel scale;
// the height cap is computed in px so it stays 90% of the real viewport.
export default function OilOverlayModal({ isOpen, onClose, darkMode = false, maxWidth = 420, scale = 1, children }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const c = darkMode
    ? { panelBg: "rgba(20,20,25,0.98)", border: "#444" }
    : { panelBg: "rgba(245,239,230,0.99)", border: "#d4c8b4" };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%", maxWidth,
          maxHeight: scale !== 1 && typeof window !== "undefined" ? Math.round(window.innerHeight * 0.9 / scale) : "90vh",
          zoom: scale,
          overflowY: "auto",
          background: c.panelBg,
          border: `1px solid ${c.border}`,
          borderRadius: 10,
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          fontFamily: "'Share Tech Mono', monospace",
          padding: "8px 14px 14px",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute", top: 8, right: 8, zIndex: 2,
            width: 30, height: 30, borderRadius: 6,
            background: "rgba(0,0,0,0.45)", border: `1px solid ${c.border}`,
            color: "#fff", cursor: "pointer", fontSize: 16, lineHeight: 1,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
