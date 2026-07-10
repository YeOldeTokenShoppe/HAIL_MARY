"use client";

import { useEffect, useState } from "react";
import { readGrace, graceDaysLeft, penanceIsDue, GRACE_EVENT } from "@/lib/grace";

// GraceOfRecord — the visitor's ONE standing grace, beneath the portrait.
// Bimodal rites: PETITION (ask her favor → a blessing that holds N days)
// or CONFESSION (own a market sin → a penance, absolution on return).
// Both are administered in the Confessional conversation; the buttons here
// open it with a seeded opening line so the seeker knows the register.
//
// States: none (the call to the rites), blessed (boon + favor countdown),
// penance assigned (command + absolution countdown), penance due (return
// to her). The absolution CEREMONY — her granting it in conversation,
// flipping the ledger — is the next phase; so is the real parish tally
// (the absolved/lapsed row below is still MOCK).

const MOCK_PARISH = [true, true, false, true, true, true, false, true, true, false, true, true];
const MOCK_LEDGER = { absolved: 24, lapsed: 8 };

// Liturgical numerals for the countdowns.
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

const goldItalic = {
  margin: 0,
  fontStyle: "italic",
  fontSize: "0.82rem",
  lineHeight: 1.65,
  color: "#ffedbe",
  textShadow: "0 0 12px rgba(244, 181, 63, 0.25)",
};

const riteButton = {
  background: "none",
  border: "1px solid rgba(0,255,255,0.3)",
  color: "hsl(183 38% 57%)",
  fontFamily: "inherit",
  fontSize: "0.55rem",
  letterSpacing: "0.25em",
  textTransform: "uppercase",
  padding: "6px 14px",
  cursor: "pointer",
  clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)",
};

export default function GraceOfRecord({ onPetition, onConfess }) {
  // Read after mount (SSR has no localStorage) and re-read whenever the
  // ledger changes — /main mints graces out of the oracle conversation
  // and lib/grace fires GRACE_EVENT.
  const [grace, setGrace] = useState(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const sync = () => setGrace(readGrace());
    sync();
    setMounted(true);
    window.addEventListener(GRACE_EVENT, sync);
    return () => window.removeEventListener(GRACE_EVENT, sync);
  }, []);

  if (!mounted) return null;

  const isBlessing = grace?.kind === "blessing";
  const due = penanceIsDue(grace);
  const daysLeft = grace ? graceDaysLeft(grace) : 0;
  const total = MOCK_LEDGER.absolved + MOCK_LEDGER.lapsed;

  const chip = !grace
    ? { text: "the rites are open", color: "rgba(0, 255, 255, 0.55)", border: "rgba(0, 255, 255, 0.3)" }
    : isBlessing
      ? { text: "blessed", color: "#ffd9f2", border: "rgba(255, 150, 220, 0.45)" }
      : due
        ? { text: "absolution awaits", color: "#8dffb0", border: "rgba(141, 255, 176, 0.45)" }
        : { text: "penance assigned", color: "#f1d77a", border: "rgba(241, 215, 122, 0.4)" };

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
            {isBlessing ? "// your blessing" : grace ? "// your penance" : "// the rites"}
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

        {grace ? (
          <>
            {/* What was brought to her — dim, set apart from her voice */}
            <div style={{ ...label, fontSize: "0.6rem", letterSpacing: "0.12em", lineHeight: 1.6, marginBottom: 8, textTransform: "none" }}>
              {isBlessing ? `upon your petition for ${grace.petition} —` : `for the sin of ${grace.sin} —`}
            </div>

            {/* Her pronouncement */}
            <p style={goldItalic}>“{isBlessing ? grace.boon : grace.command}”</p>

            {/* Countdown */}
            <div
              style={{
                marginTop: 10,
                fontSize: "0.55rem",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: due ? "#8dffb0" : isBlessing ? "#ffd9f2" : "rgba(0, 255, 255, 0.55)",
              }}
            >
              {due
                ? "your penance is served — return to her"
                : isBlessing
                  ? `her favor holds ${roman(daysLeft)} day${daysLeft === 1 ? "" : "s"} more`
                  : `absolution in ${roman(daysLeft)} day${daysLeft === 1 ? "" : "s"}`}
            </div>
          </>
        ) : (
          <>
            {/* No grace stands — the call to the rites. This is where the
                shrine SOLICITS: each button opens the Confessional with a
                seeded opening line, and she takes it from there. */}
            <p style={goldItalic}>
              “Come with a petition or a confession, seeker. Our Lady dispenses
              blessings, penances, and the occasional light roasting. All
              grace is final.”
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button onClick={onPetition} style={riteButton}>
                petition
              </button>
              <button onClick={onConfess} style={riteButton}>
                confess
              </button>
            </div>
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
