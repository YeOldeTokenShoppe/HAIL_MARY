"use client";

import { useEffect, useState } from "react";
import { readPenance, penanceDaysLeft, penanceIsDue, PENANCE_EVENT } from "@/lib/penance";

// PenanceOfRecord — the visitor's standing penance, beneath the portrait.
// The sacramental loop: confess your positions in the Confessional → she
// assigns penance (a `penance` object in the oracle reply, minted to the
// device ledger by /main) → return when it's served to receive absolution.
// The return visit is required by the rite itself.
//
// States: none (a call to confession), assigned (countdown), due (return to
// her). The absolution CEREMONY — her granting it in conversation when the
// seeker returns, flipping the ledger to absolved — is the next phase; so is
// the real parish tally (the absolved/lapsed row below is still MOCK).

const MOCK_PARISH = [true, true, false, true, true, true, false, true, true, false, true, true];
const MOCK_LEDGER = { absolved: 24, lapsed: 8 };

// Liturgical numerals for the countdown.
function roman(n) {
  if (n <= 0) return "0";
  const table = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, s] of table) while (n >= v) { out += s; n -= v; }
  return out;
}

const label = {
  fontSize: "0.5rem",
  letterSpacing: "0.22em",
  textTransform: "uppercase",
  color: "rgba(200, 230, 235, 0.45)",
};

export default function PenanceOfRecord({ onConfess }) {
  // Read after mount (SSR has no localStorage) and re-read whenever the
  // ledger changes — /main mints a penance out of the oracle conversation
  // and fires PENANCE_EVENT.
  const [penance, setPenance] = useState(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const sync = () => setPenance(readPenance());
    sync();
    setMounted(true);
    window.addEventListener(PENANCE_EVENT, sync);
    return () => window.removeEventListener(PENANCE_EVENT, sync);
  }, []);

  if (!mounted) return null;

  const due = penanceIsDue(penance);
  const daysLeft = penance ? penanceDaysLeft(penance) : 0;
  const total = MOCK_LEDGER.absolved + MOCK_LEDGER.lapsed;

  const chip = !penance
    ? { text: "none stands", color: "rgba(0, 255, 255, 0.55)", border: "rgba(0, 255, 255, 0.3)" }
    : due
      ? { text: "absolution awaits", color: "#8dffb0", border: "rgba(141, 255, 176, 0.45)" }
      : { text: "assigned", color: "#f1d77a", border: "rgba(241, 215, 122, 0.4)" };

  return (
    <div style={{ padding: "14px 16px 0", fontFamily: "'Cyber', 'Geo', sans-serif" }}>
      <div
        style={{
          border: "1px solid rgba(0, 255, 255, 0.14)",
          background: "rgba(255, 255, 255, 0.02)",
          clipPath:
            "polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)",
          padding: "12px 14px 10px",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <span
            style={{
              fontSize: "0.55rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "hsl(183 38% 57%)",
              textShadow: "0 0 8px rgba(0,255,255,0.35)",
            }}
          >
            {"// your penance"}
          </span>
          <span
            style={{
              fontSize: "0.5rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              padding: "2px 7px",
              color: chip.color,
              border: `1px solid ${chip.border}`,
              borderRadius: 3,
            }}
          >
            {chip.text}
          </span>
        </div>

        {penance ? (
          <>
            {/* The confessed sin — dim, set apart from her voice */}
            <div style={{ ...label, fontSize: "0.6rem", letterSpacing: "0.12em", lineHeight: 1.6, marginBottom: 8, textTransform: "none" }}>
              for the sin of {penance.sin} —
            </div>

            {/* Her command */}
            <p
              style={{
                margin: 0,
                fontStyle: "italic",
                fontSize: "0.82rem",
                lineHeight: 1.65,
                color: "#ffedbe",
                textShadow: "0 0 12px rgba(244, 181, 63, 0.25)",
              }}
            >
              “{penance.command}”
            </p>

            {/* Countdown / call to return */}
            <div
              style={{
                marginTop: 10,
                fontSize: "0.55rem",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: due ? "#8dffb0" : "rgba(0, 255, 255, 0.55)",
              }}
            >
              {due
                ? "your penance is served — return to her"
                : `absolution in ${roman(daysLeft)} day${daysLeft === 1 ? "" : "s"}`}
            </div>
          </>
        ) : (
          <>
            {/* No penance — the call to confession. This is where the rite
                SOLICITS: the button opens the Confessional, and she takes
                it from there in conversation. */}
            <p
              style={{
                margin: 0,
                fontStyle: "italic",
                fontSize: "0.82rem",
                lineHeight: 1.65,
                color: "#ffedbe",
                textShadow: "0 0 12px rgba(244, 181, 63, 0.25)",
              }}
            >
              “No penance stands against you, seeker. Confess your positions —
              the mirror has heard worse than yours.”
            </p>
            <button
              onClick={onConfess}
              style={{
                marginTop: 10,
                background: "none",
                border: "1px solid rgba(0,255,255,0.3)",
                color: "hsl(183 38% 57%)",
                fontFamily: "inherit",
                fontSize: "0.55rem",
                letterSpacing: "0.25em",
                textTransform: "uppercase",
                padding: "6px 14px",
                cursor: "pointer",
                clipPath:
                  "polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)",
              }}
            >
              confess
            </button>
          </>
        )}

        {/* Divider */}
        <div
          style={{
            height: 1,
            margin: "10px 0 8px",
            background:
              "linear-gradient(90deg, rgba(0,255,255,0.18), rgba(0,255,255,0.02))",
          }}
        />

        {/* The parish — recent penitents as votive stars: lit = absolved,
            hollow = lapsed. MOCK until the Firestore ledger exists. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span style={label}>the faithful</span>
          <span style={{ fontSize: "0.7rem", letterSpacing: "0.18em" }} aria-hidden>
            {MOCK_PARISH.map((absolved, i) => (
              <span
                key={i}
                style={{
                  color: absolved ? "#f1d77a" : "rgba(200, 230, 235, 0.25)",
                  textShadow: absolved ? "0 0 6px rgba(241, 215, 122, 0.5)" : "none",
                }}
              >
                {absolved ? "✦" : "✧"}
              </span>
            ))}
          </span>
          <span style={label}>
            {MOCK_LEDGER.absolved} of {total} absolved
          </span>
        </div>
      </div>
    </div>
  );
}
