"use client";

import { useEffect } from "react";
import { HOW_TO_PLAY_STEPS } from "./HowToPlayPanel";
import HowToPlayDialogue from "./HowToPlayDialogue";

// First-visit onboarding overlay for /hailmary. Shows a character greeting video
// up top with the How-to-Play steps below. Re-openable via the "?" help button.
export default function OilWelcomeModal({ isOpen, onClose, darkMode = false }) {
  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const c = darkMode ? {
    text: "#c8c0b4", accent: "#d4a854", muted: "#8a8070",
    panelBg: "rgba(20,20,25,0.98)", border: "#444",
    stepNum: "#d4a854", btnBg: "#d4a854", btnText: "#1a1a1f",
  } : {
    text: "#504030", accent: "#5a4010", muted: "#6e6050",
    panelBg: "rgba(245,239,230,0.99)", border: "#d4c8b4",
    stepNum: "#b8922e", btnBg: "#b8922e", btnText: "#fff",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        // Keep the centered modal clear of the notch / home indicator so its
        // close button and CTA stay reachable.
        padding: "calc(16px + env(safe-area-inset-top, 0px)) 16px calc(16px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          // dvh (not vh) so the modal fits the *visible* viewport on iOS Safari
          // even while the URL bar is showing — otherwise the centered modal
          // overflows past the top and the close button hides under the URL bar.
          width: "100%", maxWidth: 460, maxHeight: "90dvh",
          overflowY: "auto",
          background: c.panelBg,
          border: `1px solid ${c.border}`,
          borderRadius: 10,
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          fontFamily: "'Share Tech Mono', monospace",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute", top: 10, right: 10, zIndex: 2,
            width: 38, height: 38, borderRadius: 8,
            background: "rgba(0,0,0,0.6)", border: `1px solid ${c.border}`,
            color: "#fff", cursor: "pointer", fontSize: 20, lineHeight: 1,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          ×
        </button>

        {/* Character greeting — St. GR80 & John Barron SitePal dialogue */}
        <HowToPlayDialogue darkMode={darkMode} />

        {/* Heading */}
        <div style={{ padding: "16px 18px 4px" }}>
          <h2 style={{
            margin: 0, fontSize: 16, fontWeight: 700,
            color: c.accent, letterSpacing: "0.18em", textTransform: "uppercase",
          }}>
            Welcome, Prospector
          </h2>
          <p style={{
            margin: "6px 0 0", fontSize: 11, color: c.muted,
            letterSpacing: "0.04em", lineHeight: 1.5,
          }}>
            Strike oil, climb the leaderboard. Here's how it works.
          </p>
        </div>

        {/* Steps */}
        <div style={{ padding: "12px 18px 4px" }}>
          {HOW_TO_PLAY_STEPS.map((s) => (
            <div key={s.num} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
              <span style={{
                fontSize: 12, fontWeight: 700, color: c.stepNum,
                minWidth: 18, textAlign: "center", lineHeight: "18px",
              }}>
                {s.num}
              </span>
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: c.text,
                  letterSpacing: "0.12em", marginBottom: 3,
                }}>
                  {s.title}
                </div>
                <div style={{
                  fontSize: 11, color: c.muted, lineHeight: 1.5,
                  letterSpacing: "0.02em",
                }}>
                  {s.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ padding: "8px 18px 18px", position: "sticky", bottom: 0, background: c.panelBg }}>
          <button
            onClick={onClose}
            style={{
              width: "100%", padding: "12px", borderRadius: 6, border: "none",
              background: c.btnBg, color: c.btnText, cursor: "pointer",
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 13, fontWeight: 700, letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            Let's Drill
          </button>
        </div>
      </div>
    </div>
  );
}
