"use client";

// ── v2 CORE SAMPLE — the extract-or-pass decision surface ────────────────────
// (docs/oil-game.md → "v2 LOOP" client spec + Copy rule.) Renders inside the
// YOUR RIG card when settings.loopV2 is on. Shows the pending layer's assay,
// the charge budget, the standing order (threshold), and the EXTRACT / PASS
// verbs wired to /api/oil-layer-decide. FUNCTIONAL pass only — layout and
// styling are deliberately plain chrome for Michelle's player-UI design pass.
//
// Copy rule: the cost model is always explicit ("EXTRACT banks the full N BTR
// for 1 charge · PASS is free but final") and the threshold is always phrased
// as the crew's standing order — never a bare number.

import { useState } from "react";

const mono = "'Share Tech Mono', monospace";

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
}) {
  const [busy, setBusy] = useState(false);
  const [thrDraft, setThrDraft] = useState(null); // null = mirror server value
  const [note, setNote] = useState("");

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

  const agoMin = pending?.revealedAt ? Math.max(0, Math.round((Date.now() - pending.revealedAt) / 60000)) : null;

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
            crew follows your standing order at the next strike → would {crewWould}.
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
          No core on the table — the next strike pulls one. Your standing order decides it if you're away.
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
