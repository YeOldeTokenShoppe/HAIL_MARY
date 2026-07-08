"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * ApparitionTriptych — the first-visit choice of Our Lady's face.
 *
 * Shown once on /main (no stored preference, no explicit ?char): all of her
 * apparitions appear side by side, like the panels of a folding altarpiece,
 * so no single face reads as "the default" with the others hidden behind
 * carousel arrows. The left-to-right order is shuffled per visit for the same
 * reason — no face is structurally first.
 *
 * Choosing a panel writes the device preference (lib/apparitionPrefs) and the
 * page summons that face; returning seekers skip straight to their Lady.
 *
 * Props:
 *  - apparitions: APPARITIONS roster (lib/apparitions.js)
 *  - onChoose: (index) => void — index into the ORIGINAL roster order
 */
export default function ApparitionTriptych({ apparitions = [], onChoose }) {
  // Below this the row of ovals gets too cramped — stack the panels as
  // horizontal cards instead (oval left, text right).
  const [isNarrow, setIsNarrow] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 700 : false
  );
  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 700);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Shuffled display order, fixed for the visit (Fisher–Yates over indices)
  const order = useMemo(() => {
    const idx = apparitions.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
  }, [apparitions]);

  const ovalW = isNarrow ? 96 : "min(24vw, 210px)";
  const ovalH = isNarrow ? 128 : "min(32vw, 280px)";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        overflowY: "auto",
        background:
          "radial-gradient(ellipse at 50% 30%, rgba(18, 22, 36, 0.97) 0%, rgba(8, 8, 14, 0.995) 72%)",
        fontFamily: "'Cyber', 'Geo', sans-serif",
        animation: "apparitionFadeIn 0.6s ease both",
      }}
    >
      <style>{`
        @keyframes apparitionFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes apparitionRise {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .apparition-panel {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          transition: transform 0.25s ease;
        }
        .apparition-panel:hover,
        .apparition-panel:focus-visible {
          transform: translateY(-6px);
          outline: none;
        }
        .apparition-panel:hover .apparition-oval,
        .apparition-panel:focus-visible .apparition-oval {
          filter: brightness(1.15);
        }
        .apparition-panel:hover .apparition-consult,
        .apparition-panel:focus-visible .apparition-consult {
          opacity: 1;
        }
      `}</style>

      {/* ── Header ── */}
      <div
        style={{
          fontSize: "0.6rem",
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          color: "hsl(183 38% 57%)",
          textShadow: "0 0 8px rgba(0,255,255,0.4)",
          marginBottom: 10,
        }}
      >
        {"// apparition select"}
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: "'Grenze Gotisch', serif",
          fontWeight: 500,
          fontSize: "clamp(1.8rem, 5vw, 2.8rem)",
          color: "transparent",
          WebkitTextStroke: "1.2px #ffedbe",
          textShadow:
            "0 0 2px #fff2cc, 0 0 22px rgba(244,181,63,0.7), 0 0 46px rgba(240,168,44,0.45)",
          textAlign: "center",
        }}
      >
        She Has Many Faces
      </h2>
      <p
        style={{
          margin: "12px 0 30px",
          maxWidth: 560,
          textAlign: "center",
          fontSize: "0.8rem",
          lineHeight: 1.6,
          letterSpacing: "0.06em",
          color: "rgba(200, 230, 235, 0.75)",
        }}
      >
        Our Lady of Perpetual Profit appears to every seeker in a different
        guise. Choose the face you would consult.
      </p>

      {/* ── The panels ── */}
      <div
        style={{
          display: "flex",
          flexDirection: isNarrow ? "column" : "row",
          alignItems: isNarrow ? "stretch" : "flex-start",
          justifyContent: "center",
          gap: isNarrow ? 18 : "clamp(20px, 4vw, 48px)",
          width: "100%",
          maxWidth: 960,
        }}
      >
        {order.map((charIndex, slot) => {
          const a = apparitions[charIndex];
          if (!a) return null;
          const hue = a.frameHue || "#22ccff";
          const oval = (
            <div
              className="apparition-oval"
              style={{
                position: "relative",
                width: ovalW,
                height: ovalH,
                flexShrink: 0,
                borderRadius: "50%",
                overflow: "hidden",
                border: `2px solid ${hue}`,
                boxShadow: `0 0 8px ${hue}, 0 0 26px ${hue}77, inset 0 0 18px ${hue}44`,
                // The hue glow doubles as the portrait fallback: if the cameo
                // is missing (Ubuntu's is an ASSET TODO), the veiled radiance
                // shows instead of a broken image.
                background: `radial-gradient(circle at 50% 38%, ${hue}55 0%, #0b0b13 78%)`,
                transition: "filter 0.25s ease",
              }}
            >
              {a.image && (
                <img
                  src={a.image}
                  alt=""
                  onError={(e) => { e.currentTarget.style.display = "none"; }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center top",
                  }}
                />
              )}
              <div
                className="apparition-consult"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: "7%",
                  textAlign: "center",
                  fontSize: "0.55rem",
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                  color: "#fff",
                  textShadow: `0 0 6px ${hue}, 0 0 14px ${hue}`,
                  opacity: 0,
                  transition: "opacity 0.25s ease",
                  pointerEvents: "none",
                }}
              >
                consult
              </div>
            </div>
          );

          return (
            <button
              key={a.key}
              className="apparition-panel"
              onClick={() => onChoose?.(charIndex)}
              aria-label={`Consult ${a.title || a.name}`}
              style={{
                display: "flex",
                flexDirection: isNarrow ? "row" : "column",
                alignItems: "center",
                textAlign: isNarrow ? "left" : "center",
                gap: isNarrow ? 16 : 14,
                flex: isNarrow ? "none" : "0 1 260px",
                animation: `apparitionRise 0.5s ease ${0.15 + slot * 0.12}s both`,
                fontFamily: "inherit",
              }}
            >
              {oval}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.85rem",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                    color: "hsl(183 38% 57%)",
                    textShadow: "0 0 8px rgba(0,255,255,0.4)",
                  }}
                >
                  {a.name}
                </div>
                <div
                  style={{
                    display: "inline-block",
                    margin: "6px 0 8px",
                    padding: "2px 8px",
                    fontSize: "0.55rem",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: hue,
                    border: `1px solid ${hue}66`,
                    borderRadius: 3,
                  }}
                >
                  {a.langName || "English"}
                </div>
                <div
                  style={{
                    fontStyle: "italic",
                    fontSize: "0.72rem",
                    lineHeight: 1.5,
                    color: "rgba(200, 230, 235, 0.6)",
                    maxWidth: isNarrow ? "none" : 230,
                    margin: isNarrow ? 0 : "0 auto",
                  }}
                >
                  “{(a.greetings && a.greetings[0]) || ""}”
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Footer note ── */}
      <div
        style={{
          marginTop: 34,
          fontSize: "0.6rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "rgba(0, 255, 255, 0.35)",
          textAlign: "center",
        }}
      >
        she remembers your choice — change her face any time beneath the frame
      </div>
    </div>
  );
}
