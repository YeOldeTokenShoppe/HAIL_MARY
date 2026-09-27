"use client";

// ── THE RECKONING — the player's season-end account ──────────────────────────
// (docs/oil-game.md → SEASON ONE → IN #3.) Mounted above the FINAL HAUL share
// card once the season has ended, for every rig — dry ones included; the dry
// player's reckoning is the honest "here is what was under you" moment.
// FUNCTIONAL pass only — plain chrome for Michelle's player-UI design pass
// (which also decides whether this replaces the FINAL HAUL card as the share).
//
// Data: lib/oilLoopV2 buildReckoning(). The column total is only complete once
// the page hands the builder the revealed seed's column (post-gameEnded); until
// then the card says how many layers are still sealed rather than guessing.

import { useState } from "react";
import { reckoningText } from "@/lib/oilLoopV2";

const mono = "'Share Tech Mono', monospace";
const btr = (n) => Math.round(n || 0).toLocaleString();
const usd = (n) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

export default function OilReckoning({ theme, reckoning: r, col, row }) {
  const [note, setNote] = useState("");
  if (!r) return null;

  const line = { fontFamily: mono, fontSize: 10, letterSpacing: "0.06em", lineHeight: 1.7, color: theme.text };
  const muted = { ...line, color: theme.muted };
  const row2 = (label, value, color) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span style={muted}>{label}</span>
      <span style={{ ...line, color: color || theme.text, textAlign: "right", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reckoningText(r, { col, row }));
      setNote("✔ copied");
    } catch {
      setNote("✗ clipboard blocked");
    }
    setTimeout(() => setNote(""), 2500);
  };

  const pct = r.captureRate != null ? ` (${Math.round(r.captureRate * 100)}% of your column)` : "";
  const sealed = r.unknownLayers > 0;

  return (
    <div style={{ padding: "10px 14px", borderBottom: `1px solid ${theme.border || theme.muted}` }}>
      <div style={{ border: `1px solid ${theme.gold}`, borderRadius: 3, padding: "8px 10px", background: "rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ ...line, color: theme.gold, letterSpacing: "0.14em" }}>THE RECKONING — SEASON CLOSED</span>
          {col != null && <span style={muted}>plot ({col + 1},{row + 1})</span>}
        </div>

        <div style={{ ...line, fontSize: 14, marginTop: 4 }}>
          BANKED {btr(r.banked)} BTR <span style={{ color: theme.gold }}>≈ {usd(r.payoutUsd)} USDC</span>
        </div>
        <div style={muted}>real USDC, paid to your wallet on Base at the season&apos;s fixed rate</div>

        <div style={{ marginTop: 8, borderTop: `1px solid ${theme.muted}`, paddingTop: 6 }}>
          <div style={{ ...muted, letterSpacing: "0.12em" }}>YOUR COLUMN</div>
          {row2(sealed ? `under your column (${plural(r.unknownLayers, "layer")} still sealed)` : "under your column",
            `${btr(r.columnTotal)} BTR${r.hellLayers ? ` · ${plural(r.hellLayers, "hell pocket")}${r.hellCapped ? ` (${r.hellCapped} capped)` : ""}` : ""}`)}
          {row2("you extracted", `${btr(r.extractedOwn)} BTR${pct}`, theme.green)}
          {row2("you passed", `${btr(r.passedTotal)} BTR`)}
          {r.passedTotal > 0 && row2("· neighbours took", `${btr(r.takenByRivals)} BTR`, r.takenByRivals > 0 ? theme.red : undefined)}
          {r.passedTotal > 0 && row2("· stayed in the ground", `${btr(r.leftOpen)} BTR`)}
          {row2("never reached", `${plural(r.neverReachedLayers, "layer")}${r.neverReachedOil > 0 ? ` · ${btr(r.neverReachedOil)} BTR` : sealed && r.neverReachedLayers > 0 ? " · sealed" : ""}`)}
          {r.stranded > 0 && row2("stranded — never banked", `${btr(r.stranded)} BTR`, theme.red)}
        </div>

        <div style={{ marginTop: 8, borderTop: `1px solid ${theme.muted}`, paddingTop: 6 }}>
          <div style={{ ...muted, letterSpacing: "0.12em" }}>BEYOND YOUR FENCE</div>
          {row2("salvaged next door", `+${btr(r.salvagedIn)} BTR · ${plural(r.salvageCount, "lateral")}`, r.salvagedIn > 0 ? theme.green : undefined)}
          {row2("wildcats", `+${btr(r.wildcatIn)} BTR · ${r.wildcatCount} dug${r.wildcatDry ? `, ${r.wildcatDry} dry` : ""}${r.wildcatHell ? `, ${r.wildcatHell} hell` : ""}`, r.wildcatIn > 0 ? theme.green : undefined)}
        </div>

        <div style={{ marginTop: 8, borderTop: `1px solid ${theme.muted}`, paddingTop: 6 }}>
          {row2("charges", `${r.chargesSpent}/${r.chargesCap} spent${r.chargesUnspent ? ` · ${r.chargesUnspent} wasted` : ""}`, r.chargesUnspent ? theme.red : undefined)}
          {r.pendingUnresolved && <div style={{ ...muted, color: theme.red }}>a core was still on the table at the buzzer — the crew settles it by your standing order.</div>}
          {sealed && <div style={muted}>The sealed layers fill in when the season&apos;s seed is published — check VERIFY THE MAP.</div>}
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
          <button onClick={copy} style={{
            fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 10px",
            borderRadius: 2, cursor: "pointer", background: "transparent", color: theme.gold, border: `1px solid ${theme.gold}`,
          }}>
            COPY REPORT
          </button>
          {note && <span style={{ ...muted, color: theme.gold }}>{note}</span>}
        </div>
      </div>
    </div>
  );
}
