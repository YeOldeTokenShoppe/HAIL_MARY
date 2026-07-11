"use client";

import { useEffect, useState } from "react";
import { readGrace, graceDaysLeft, GRACE_EVENT } from "@/lib/grace";

// GraceOfRecord — the altar module beneath the portrait.
//
// Featured slot (the gold italic line in the box):
//   • no blessing standing → TODAY'S READING — her one inscribed line for
//     the day (/api/daily-reading: omens-fed, Firestore-archived, in the
//     apparition's tongue), with the PETITION button beneath it. Falls back
//     to the petition invitation if the reading hasn't loaded.
//   • blessing standing → the seeker's boon + favor countdown, with the
//     day's reading tucked quietly below the box instead.
//
// PETITION opens the Confessional seeded in her tongue; she takes it from
// there (guidance, intercession, protection, fortune — no penances: she
// hears sins as a mother, not a confessor).
//
// Per-apparition overrides for HER VOICE come via the `ui` block in
// lib/apparitions.js. Terminal chrome stays English site-wide.

// Liturgical numerals for the countdown.
function roman(n) {
  if (n <= 0) return "0";
  const table = [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [v, s] of table) while (n >= v) { out += s; n -= v; }
  return out;
}

// Fetch the day's inscribed line — server-cached per (day, apparition);
// null (component shows the fallback) on any failure. Returns { reading,
// date } — the SERVER's ledger date, which is what the label must show:
// the ledger runs on UTC, so the client's local date can disagree with the
// day the inscription actually belongs to.
function useDailyReading(apparitionKey) {
  const [daily, setDaily] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setDaily(null);
    fetch(`/api/daily-reading?apparition=${encodeURIComponent(apparitionKey || "classic")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.reading) setDaily({ reading: d.reading, date: d.date });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [apparitionKey]);
  return daily;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

// "2026-07-11" → "july 11" (string parts only — new Date("YYYY-MM-DD")
// parses as UTC midnight and would shift the day right back in western
// timezones, recreating the bug this fixes)
function ledgerDateLine(isoDate) {
  const [, m, d] = String(isoDate || "").split("-").map(Number);
  if (!m || !d) return "";
  return `${MONTHS[m - 1]} ${d}`;
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

export default function GraceOfRecord({ onPetition, ui = {}, apparitionKey = "classic" }) {
  // Read after mount (SSR has no localStorage) and re-read whenever the
  // ledger changes — /main mints blessings out of the oracle conversation
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

  const daily = useDailyReading(apparitionKey);
  const reading = daily?.reading || null;

  if (!mounted) return null;

  const daysLeft = grace ? graceDaysLeft(grace) : 0;
  // The ledger's date, not the client clock — they disagree near midnight UTC
  const dateLine = ledgerDateLine(daily?.date);
  const chip = grace
    ? { text: "blessed", color: "#ffd9f2", border: "rgba(255, 150, 220, 0.45)" }
    : { text: "the altar is open", color: "rgba(0, 255, 255, 0.55)", border: "rgba(0, 255, 255, 0.3)" };

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
            {grace
              ? "// your blessing"
              : reading
                ? `// today's reading · ${dateLine}`
                : "// petitions"}
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
            {/* What was asked of her — dim, set apart from her voice */}
            <div style={{ ...label, fontSize: "0.6rem", letterSpacing: "0.12em", lineHeight: 1.6, marginBottom: 8, textTransform: "none" }}>
              {`${ui.petitionLead || "upon your petition for"} ${grace.petition} —`}
            </div>

            {/* Her boon */}
            <p style={goldItalic}>“{grace.boon}”</p>

            {/* Favor countdown */}
            <div
              style={{
                marginTop: 10,
                fontSize: "0.55rem",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "#ffd9f2",
              }}
            >
              {daysLeft === 0
                ? "her favor wanes tonight — petition anew tomorrow"
                : `her favor holds ${roman(daysLeft)} day${daysLeft === 1 ? "" : "s"} more`}
            </div>
          </>
        ) : (
          <>
            {/* Featured: today's reading (her invitation stands in until it
                arrives — her sass is never advertised either way). */}
            <p style={goldItalic}>
              “{reading ||
                ui.petitionInvitation ||
                "Bring your petition, seeker — protection, fortune, courage, or mercy on a bruised bag. Our Lady hears every prayer. Ask."}”
            </p>
            <button
              onClick={onPetition}
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
              petition
            </button>
          </>
        )}

      </div>

      {/* While a blessing holds the featured slot, the day's reading is
          still on the wall — tucked quietly below the box. */}
      {grace && reading && (
        <div style={{ padding: "10px 14px 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 5,
            }}
          >
            <span style={{ ...label, color: "rgba(0, 255, 255, 0.4)", fontSize: "0.5rem", letterSpacing: "0.25em" }}>
              {"// today's reading"}
            </span>
            <span style={{ ...label, color: "rgba(200, 230, 235, 0.3)" }}>{dateLine}</span>
          </div>
          <p
            style={{
              ...goldItalic,
              fontSize: "0.72rem",
              lineHeight: 1.7,
              color: "rgba(255, 237, 190, 0.75)",
              textShadow: "0 0 10px rgba(244, 181, 63, 0.15)",
            }}
          >
            “{reading}”
          </p>
        </div>
      )}
    </div>
  );
}
