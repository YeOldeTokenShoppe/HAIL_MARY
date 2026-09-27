"use client";

// ── v2 CORE SAMPLE — the extract-or-pass decision surface ────────────────────
// (docs/oil-game.md → "v2 LOOP" client spec + Copy rule.) Renders inside the
// YOUR RIG card when settings.loopV2 is on. Shows the pending layer's assay,
// the charge budget, the standing order (threshold), and the EXTRACT / PASS
// verbs wired to /api/oil-layer-decide. FUNCTIONAL pass only — layout and
// styling are deliberately plain chrome for Michelle's player-UI design pass.
//
// 2026-09-27 — the mock's remaining requirements are plumbed (still plain):
//   • cadence line   — "a reveal every 9.6 h · next lands before 14:32"
//   • countdown      — the pending layer's auto-resolve deadline. This is the
//                      END OF THE WINDOW (lib/oilStrikeClock revealWindow),
//                      never the strike target: the exact moment stays
//                      unguessable by design (the engagement engine).
//   • core rack      — the claim's column, every layer, always visible
//   • running ledger — every charge spent and every layer let go, with totals
// Data for all four is built in lib/oilLoopV2 (buildColumnRack / buildLedger)
// from server reveals and public plot docs — nothing here touches the seed.
//
// Copy rule: the cost model is always explicit ("EXTRACT banks the full N BTR
// for 1 charge · PASS is free but final") and the threshold is always phrased
// as the crew's standing order — never a bare number.

import { useEffect, useState } from "react";
import { fmtSpan } from "@/lib/oilLoopV2";

const mono = "'Share Tech Mono', monospace";
const fmtBtr = (n) => Math.round(n || 0).toLocaleString();
const clockOf = (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
// "in 3.2 h" while the window is open; the cron is 5-minutely, so past the
// window's end the honest line is "any moment now", not a negative number.
const untilCopy = (ms, now) => (ms - now > 60000 ? `in ${fmtSpan(ms - now)}` : "any moment now");

// Core-rack glyphs. One character per state so the strip stays legible at
// 20 cells on a phone; the legend below the rack spells them out.
const RACK = {
  undrilled:   { glyph: "·", label: "not yet drilled" },
  pending:     { glyph: "?", label: "on the table — decide" },
  extracted:   { glyph: "■", label: "extracted (banked)" },
  passed:      { glyph: "□", label: "passed — open to neighbours" },
  salvaged:    { glyph: "▣", label: "passed — a neighbour took it" },
  dry:         { glyph: "✕", label: "dry (passed free)" },
  hell:        { glyph: "☠", label: "hell pocket — demon woke" },
  hell_capped: { glyph: "⛨", label: "hell pocket — tonic capped it" },
  revealed:    { glyph: "○", label: "revealed" },
};

export default function OilCoreSampleV2({
  theme,
  pending,            // { layer, oil, hasInclusion, revealedAt } | null
  chargesRemaining,
  chargesCap,
  threshold,          // number | null (null → 0: extract anything wet)
  onDecide,           // async (action: "extract" | "pass") => void
  onSetThreshold,     // async (btr: number) => void
  salvage = [],       // open pockets next door: [{ col, row, layer, oil, hasInclusion }]
  onLateral,          // async ({ col, row, layer }) => void — spend a charge, take it
  frontier = [],      // unclaimed 8-neighbours: [{ col, row, layer }] — deepest virgin layer in reach
  onWildcat,          // async ({ col, row, layer }) => result — blind dig, spend a charge
  onWalk,             // () => void — enter v1 ground mode (third-person walker)
  cadence = null,     // lib/oilStrikeClock revealWindow(): { intervalMs, latestMs, remainingLayers, seasonEndMs } | null
  rack = [],          // lib/oilLoopV2 buildColumnRack(): [{ layer, state, oil, hasInclusion, takenBy }]
  ledger = null,      // lib/oilLoopV2 buildLedger(): { rows, banked, chargesSpent, passedTotal, takenByRivals, leftOpen, … } | null
}) {
  const [busy, setBusy] = useState(false);
  const [thrDraft, setThrDraft] = useState(null); // null = mirror server value
  const [note, setNote] = useState("");
  const [ledgerOpen, setLedgerOpen] = useState(false);
  // Countdown clock: re-render twice a minute while mounted (no timers when
  // there is nothing to count down to).
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!cadence?.latestMs) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
  }, [cadence?.latestMs]);

  // The cadence line + the pending layer's deadline, from the public window.
  const seasonOver = cadence?.seasonEndMs != null && nowMs >= cadence.seasonEndMs;
  const columnDone = cadence != null && cadence.remainingLayers <= 0;
  const cadenceCopy = !cadence ? null
    : seasonOver ? "SEASON OVER — the buzzer settled what was left."
    : columnDone ? "COLUMN FULLY REVEALED — nothing more comes up; the buzzer settles anything still on the table."
    : `REVEALS every ${fmtSpan(cadence.intervalMs)} · next lands before ${clockOf(cadence.latestMs)} (${untilCopy(cadence.latestMs, nowMs)}) · ${cadence.remainingLayers} layer${cadence.remainingLayers === 1 ? "" : "s"} to go`;
  const deadlineCopy = !cadence || seasonOver ? "at the buzzer"
    : columnDone ? "at the buzzer"
    : `at the next strike — before ${clockOf(cadence.latestMs)} (${untilCopy(cadence.latestMs, nowMs)})`;

  const T = Number(threshold) || 0;
  const oil = pending ? (pending.oil || 0) : 0;
  const dry = pending && oil <= 0;
  const crewWould = !pending ? null
    : chargesRemaining <= 0 ? "PASS"
    : dry ? "PASS"
    : oil >= T ? "EXTRACT" : "PASS";

  const decide = async (action) => {
    if (busy || !pending) return;
    setBusy(true); setNote("");
    try {
      const data = await onDecide(action);
      if (action === "extract") {
        setNote(oil > 0
          ? `✔ extracted — ${Math.round(oil).toLocaleString()} BTR banked${data?.inclusion ? " · inclusion recovered → ARTIFACTS" : ""}`
          : data?.inclusion
            ? "✔ dug it up — inclusion recovered → see ARTIFACTS"
            : "✔ extracted — the layer was dry");
      } else {
        setNote("↷ passed — final");
      }
    } catch (e) {
      setNote(`✗ ${e.message || "failed"}`);
    } finally {
      setBusy(false);
    }
  };

  const saveThreshold = async () => {
    const v = Number(thrDraft);
    if (busy || thrDraft == null || !Number.isFinite(v) || v < 0) return;
    setBusy(true); setNote("");
    try {
      await onSetThreshold(v);
      setThrDraft(null);
      setNote(`✔ standing order set: extract ≥ ${Math.round(v).toLocaleString()}`);
    } catch (e) {
      setNote(`✗ ${e.message || "failed"}`);
    } finally {
      setBusy(false);
    }
  };

  const line = { fontFamily: mono, fontSize: 10, letterSpacing: "0.06em", lineHeight: 1.7, color: theme.text };
  const muted = { ...line, color: theme.muted };
  const btn = (accent, disabled) => ({
    fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
    padding: "5px 10px", borderRadius: 2, cursor: disabled ? "default" : "pointer",
    background: "transparent", color: disabled ? theme.muted : accent,
    border: `1px solid ${disabled ? theme.muted : accent}`, opacity: disabled ? 0.5 : 1,
  });

  const agoMin = pending?.revealedAt ? Math.max(0, Math.round((nowMs - pending.revealedAt) / 60000)) : null;
  const rackFill = (st) => st === "extracted" ? theme.green
    : st === "pending" ? theme.gold
    : st === "hell" ? theme.red
    : st === "hell_capped" ? (theme.warn || theme.red)
    : st === "salvaged" ? "rgba(176,48,48,0.25)"
    : "transparent";
  const rackBorder = (st) => st === "passed" ? theme.gold
    : st === "salvaged" ? theme.red
    : st === "undrilled" ? "rgba(128,128,128,0.25)"
    : st === "dry" || st === "revealed" ? theme.muted
    : rackFill(st);

  return (
    <div style={{
      border: `1px solid ${theme.gold}`, borderRadius: 3, padding: "8px 10px",
      margin: "8px 0", background: "rgba(0,0,0,0.15)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ ...line, color: theme.gold, letterSpacing: "0.14em" }}>CORE SAMPLE — EXTRACT OR PASS</span>
        <span style={{ ...line, color: chargesRemaining > 0 ? theme.text : theme.red }}>
          CHARGES {chargesRemaining}/{chargesCap}
        </span>
      </div>
      {cadenceCopy && <div style={muted}>{cadenceCopy}</div>}

      {rack.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <div style={{ ...muted, letterSpacing: "0.12em" }}>CORE RACK — your column, L1 → L{rack.length}</div>
          <div style={{ display: "flex", gap: 2, marginTop: 3 }}>
            {rack.map((c) => (
              <span
                key={c.layer}
                title={`L${c.layer + 1} · ${RACK[c.state]?.label || c.state}${c.oil > 0 ? ` · ${fmtBtr(c.oil)} BTR` : ""}${c.hasInclusion ? " · inclusion flagged" : ""}${c.takenBy ? " · taken" : ""}`}
                style={{
                  flex: 1, minWidth: 8, height: 18, lineHeight: "16px", textAlign: "center",
                  fontFamily: mono, fontSize: 10, borderRadius: 2, boxSizing: "border-box",
                  border: `1px solid ${rackBorder(c.state)}`,
                  background: rackFill(c.state),
                  color: c.state === "undrilled" ? theme.muted : theme.text,
                }}
              >
                {RACK[c.state]?.glyph || "?"}
              </span>
            ))}
          </div>
          <div style={{ ...muted, fontSize: 9, marginTop: 2 }}>
            ■ extracted · □ passed (open) · ▣ neighbour took it · ✕ dry · ☠ hell · ⛨ capped · ? on the table · · undrilled
          </div>
        </div>
      )}

      {pending ? (
        <>
          <div style={{ ...line, fontSize: 12, marginTop: 4 }}>
            L{pending.layer + 1} · {dry ? "DRY" : `${Math.round(oil).toLocaleString()} BTR`}
            {pending.hasInclusion && <span style={{ color: theme.gold }}> · 🏺 ANOMALOUS INCLUSION</span>}
          </div>
          <div style={muted}>
            {dry
              ? "Dry — passing is free. "
              : `EXTRACT banks the full ${Math.round(oil).toLocaleString()} BTR for 1 charge · PASS is free but final (opens to neighbours). `}
            {pending.hasInclusion && "The inclusion is only recovered on EXTRACT — the crew never gambles on it. "}
            {agoMin != null && `Revealed ${agoMin}m ago · `}
            if you do nothing, the crew follows your standing order {deadlineCopy} → would {crewWould}.
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button
              style={btn(theme.green, busy || chargesRemaining <= 0)}
              disabled={busy || chargesRemaining <= 0}
              onClick={() => decide("extract")}
            >
              EXTRACT −1⚡
            </button>
            <button style={btn(theme.red, busy)} disabled={busy} onClick={() => decide("pass")}>
              PASS · FINAL
            </button>
          </div>
        </>
      ) : (
        <div style={{ ...muted, marginTop: 4 }}>
          {seasonOver ? "No core on the table — the season is over."
            : columnDone ? "No core on the table — your column is fully revealed. Charges left still work next door and on the frontier."
            : "No core on the table — the next strike pulls one. Your standing order decides it if you're away."}
        </div>
      )}

      {salvage.length > 0 && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${theme.muted}`, paddingTop: 6 }}>
          <div style={{ ...line, color: theme.green, letterSpacing: "0.12em" }}>
            SALVAGE BOARD — open next door · first lateral wins
          </div>
          {salvage.slice(0, 4).map((s) => (
            <div key={`${s.col}_${s.row}_${s.layer}`}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginTop: 3 }}>
              <span style={line}>
                ({s.col + 1},{s.row + 1}) L{s.layer + 1} · {s.oil > 0 ? `${Math.round(s.oil).toLocaleString()} BTR` : "dry"}
                {s.hasInclusion && <span style={{ color: theme.gold }}> · 🏺</span>}
              </span>
              <button
                style={btn(theme.green, busy || chargesRemaining <= 0)}
                disabled={busy || chargesRemaining <= 0}
                onClick={async () => {
                  setBusy(true); setNote("");
                  try {
                    const r = await onLateral(s);
                    setNote(`✔ salvaged (${s.col + 1},${s.row + 1}) L${s.layer + 1}${r?.inclusion ? " · inclusion recovered → ARTIFACTS" : s.oil > 0 ? ` — ${Math.round(s.oil).toLocaleString()} BTR banked` : ""}`);
                  } catch (e) {
                    setNote(`✗ ${e.message || "failed"}`);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                TAKE −1⚡
              </button>
            </div>
          ))}
          {salvage.length > 4 && <div style={muted}>+{salvage.length - 4} more open nearby</div>}
        </div>
      )}

      {frontier.length > 0 && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${theme.muted}`, paddingTop: 6 }}>
          <div style={{ ...line, color: theme.gold, letterSpacing: "0.12em" }}>
            FRONTIER — unclaimed ground in reach · blind, first wildcat wins
          </div>
          {frontier.slice(0, 4).map((f) => (
            <div key={`${f.col}_${f.row}`}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginTop: 3 }}>
              <span style={line}>
                ({f.col + 1},{f.row + 1}) · deepest in reach L{f.layer + 1} · 🎲 assay unknown
              </span>
              <button
                style={btn(theme.gold, busy || chargesRemaining <= 0)}
                disabled={busy || chargesRemaining <= 0}
                onClick={async () => {
                  setBusy(true); setNote("");
                  try {
                    const r = await onWildcat(f);
                    setNote(r?.hell
                      ? (r.tonicCapped ? `☠ hit HELL at (${f.col + 1},${f.row + 1}) — tonic capped it` : `☠ WOKE A DEMON at (${f.col + 1},${f.row + 1})`)
                      : r?.oil > 0
                        ? `✔ STRUCK — ${Math.round(r.oil).toLocaleString()} BTR banked${r.inclusion ? " · inclusion → ARTIFACTS" : ""}`
                        : r?.inclusion ? "✔ dry… but dug up an inclusion → ARTIFACTS" : "✗ dry hole — the charge is spent");
                  } catch (e) {
                    setNote(`✗ ${e.message || "failed"}`);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                WILDCAT −1⚡
              </button>
            </div>
          ))}
          {frontier.length > 4 && <div style={muted}>+{frontier.length - 4} more frontier columns</div>}
        </div>
      )}

      {ledger && (
        <div style={{ marginTop: 8, borderTop: `1px solid ${theme.muted}`, paddingTop: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
            <span style={{ ...line, color: theme.gold, letterSpacing: "0.12em" }}>LEDGER</span>
            <button style={btn(theme.gold, false)} onClick={() => setLedgerOpen((o) => !o)}>
              {ledgerOpen ? "HIDE ▴" : `${ledger.rows.length} ENTR${ledger.rows.length === 1 ? "Y" : "IES"} ▾`}
            </button>
          </div>
          <div style={line}>
            BANKED {fmtBtr(ledger.banked)} BTR · {ledger.chargesSpent}/{chargesCap} charges spent
          </div>
          <div style={muted}>
            passed {fmtBtr(ledger.passedTotal)} BTR
            {ledger.passedTotal > 0 && ` — neighbours took ${fmtBtr(ledger.takenByRivals)}, ${fmtBtr(ledger.leftOpen)} still open`}
            {ledger.salvagedIn > 0 && ` · salvaged in ${fmtBtr(ledger.salvagedIn)}`}
            {(ledger.wildcatIn > 0 || ledger.wildcatDry > 0 || ledger.wildcatHell > 0) &&
              ` · wildcats +${fmtBtr(ledger.wildcatIn)}${ledger.wildcatDry ? `, ${ledger.wildcatDry} dry` : ""}${ledger.wildcatHell ? `, ${ledger.wildcatHell} hell` : ""}`}
          </div>
          {ledgerOpen && (ledger.rows.length === 0
            ? <div style={muted}>Nothing yet — the first strike puts a core on the table.</div>
            : ledger.rows.map((r, i) => (
              <div key={`${r.kind}_${r.col ?? "own"}_${r.row ?? "own"}_${r.layer}_${i}`}
                style={{ ...line, display: "flex", justifyContent: "space-between", gap: 6 }}>
                <span>
                  {r.kind === "extract" && `L${r.layer + 1} · EXTRACT`}
                  {r.kind === "pass" && `L${r.layer + 1} · PASS${r.takenBy ? " · a neighbour took it" : r.oil > 0 ? " · still open" : " · dry"}`}
                  {r.kind === "salvage" && `SALVAGE (${r.col + 1},${r.row + 1}) L${r.layer + 1}`}
                  {r.kind === "wildcat" && `WILDCAT (${r.col + 1},${r.row + 1}) L${r.layer + 1}${r.hell ? " · HELL" : r.oil > 0 ? "" : " · dry hole"}`}
                </span>
                <span style={{ color: r.kind === "pass" ? theme.muted : r.oil > 0 ? theme.green : theme.muted, whiteSpace: "nowrap" }}>
                  {r.kind === "pass" ? `${fmtBtr(r.oil)} BTR let go` : `${r.oil > 0 ? `+${fmtBtr(r.oil)} BTR` : "+0"} · −${r.charge}⚡`}
                </span>
              </div>
            )))}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
        <span style={muted}>STANDING ORDER: extract ≥</span>
        <input
          value={thrDraft ?? String(Math.round(T))}
          onChange={(e) => setThrDraft(e.target.value.replace(/[^\d]/g, ""))}
          inputMode="numeric"
          style={{
            fontFamily: mono, fontSize: 10, width: 64, padding: "3px 5px",
            background: "rgba(0,0,0,0.3)", color: theme.text,
            border: `1px solid ${theme.muted}`, borderRadius: 2,
          }}
        />
        <span style={muted}>BTR</span>
        <button style={btn(theme.gold, busy || thrDraft == null)} disabled={busy || thrDraft == null} onClick={saveThreshold}>
          SET
        </button>
      </div>
      {note && <div style={{ ...muted, marginTop: 4, color: theme.gold }}>{note}</div>}
      {onWalk && (
        <div style={{ marginTop: 8 }}>
          <button style={btn(theme.gold, busy)} disabled={busy} onClick={onWalk}>
            🥾 WALK THE FIELD (beta)
          </button>
          <span style={{ ...muted, marginLeft: 6 }}>WASD · E digs frontier · ESC returns</span>
        </div>
      )}
    </div>
  );
}
