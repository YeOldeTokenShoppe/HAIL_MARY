"use client";

import { useEffect } from "react";
import { HOW_TO_PLAY_STEPS } from "./HowToPlayPanel";

// Transcript of the intro video's spoken dialogue. Rendered as on-page text so
// browsers' built-in page translation picks it up (a <video> <track> subtitle
// file would NOT be auto-translated). Keep in sync with the recorded dialogue.
const INTRO_TRANSCRIPT = [
  { who: "St. GR80", text: "Welcome, prospector. The field is sealed before anyone plays — its riches hidden even from us. Provably fair." },
  { who: "Connor", text: "Which means nobody knows where the big strike hides… not even you. Delicious, isn't it?" },
  { who: "St. GR80", text: "Hold a little RL80 — that is your key. No spending. Sell whenever you wish." },
  { who: "Connor", text: "But why would you leave? Claim your plot, and the hunt begins." },
  { who: "St. GR80", text: "Your rig drills on its own, day and night. It strikes when the earth decides. Patience." },
  { who: "Connor", text: "Random. Unpredictable. You'll check back again… and again… and again." },
  { who: "St. GR80", text: "The deeper you go, the richer the ground. Bank what you find, and it is yours — safe, and counted." },
  { who: "Connor", text: "Or push deeper for the motherlode… and pray you don't crack a hell pocket. I do love when they crack a hell pocket." },
  { who: "St. GR80", text: "Should one breach, the whole field freezes — and hunters race for the bounty. Keep your cameras watching. Bank often." },
  { who: "Connor", text: "Or don't. Greedy hands make the best stories." },
  { who: "St. GR80", text: "Drill wisely, prospector." },
  { who: "Connor", text: "Push your luck." },
  { who: "St. GR80", text: "Welcome to Hail Mary." },
];

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

        {/* Character greeting — St. GR80 & Connor intro video (recorded
            from the SitePal dialogue; mobile-safe, no live SitePal at runtime). */}
        <div style={{
          position: "relative", width: "100%",
          background: "#000",
          borderTopLeftRadius: 10, borderTopRightRadius: 10,
          overflow: "hidden",
        }}>
          <video
            src="/HMPC_Intro.web.mp4"
            poster="/HMPC_Intro_poster.jpg"
            controls
            playsInline
            preload="metadata"
            style={{ display: "block", width: "100%", height: "auto" }}
          />
        </div>

        {/* Collapsible transcript — on-page text so browser translation covers it. */}
        <details style={{ padding: "10px 18px 0" }}>
          <summary style={{
            cursor: "pointer", listStyle: "revert",
            fontSize: 12, fontWeight: 700, color: c.accent,
            letterSpacing: "0.16em", textTransform: "uppercase", userSelect: "none",
          }}>
            Transcript
          </summary>
          <div style={{ marginTop: 8 }}>
            {INTRO_TRANSCRIPT.map((l, i) => (
              <p key={i} style={{ margin: "0 0 9px", fontSize: 13, lineHeight: 1.5, color: c.muted }}>
                <strong style={{ color: c.text }}>{l.who}:</strong> {l.text}
              </p>
            ))}
          </div>
        </details>

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
                fontSize: 14, fontWeight: 700, color: c.stepNum,
                minWidth: 18, textAlign: "center", lineHeight: "20px",
              }}>
                {s.num}
              </span>
              <div>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: c.text,
                  letterSpacing: "0.12em", marginBottom: 3,
                }}>
                  {s.title}
                </div>
                <div style={{
                  fontSize: 13, color: c.muted, lineHeight: 1.5,
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
