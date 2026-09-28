"use client";

// ── v3 CORE SAMPLE — the /space module layout, one decision per screen ───────
// (docs/oil-v2-player-ui-brief.md; structure agreed with Michelle 2026-09-28.)
// Same props as OilCoreSampleV2 — a drop-in — but the data is layered instead
// of stacked:
//   CORE       the core on the table and nothing else: cylinder, assay, two big
//              stats, EXTRACT / PASS. When nothing is on the table: the cylinder,
//              the cadence line and the two stats. Quiet.
//   NEXT DOOR  salvage + frontier merged into one short list, best two shown.
//   LEDGER     banked, charges, and every move so far — always open.
// The standing order lives behind a small CREW ORDERS link, not on the screen.
// The core cylinder IS the rack — no glyph strip, no legend. Bands use the
// strata wall's colour schema (decided 2026-09-28): gold = on the table,
// dark = extracted, green = passed (open), amber = a neighbour took it,
// red = hell, grey = dry; undrilled = faint strata hatch.
//
// Still a plain build: the /space skeleton (meta line, title, tabs, typed data
// lines, warn line, notes, big stats, one CTA row, gold corner brackets) in the
// page's theme tokens, with no motion beyond the pending pulse. Colour, type
// weight and motion are the design pass.

import { useEffect, useMemo, useState } from "react";
import { fmtSpan } from "@/lib/oilLoopV2";

const MONO = "'Share Tech Mono', monospace";
const DISPLAY = "'Orbitron', 'Share Tech Mono', monospace";
const WALL = { pending: "#ffd75e", pendingHi: "#efe0a8", bore: "#2a1d10", goo: "#37f07a", taken: "#ffb84d", hell: "#ff3f1f", dry: "#4a4036", capped: "#a1793f" };
const fmtBtr = (n) => Math.round(n || 0).toLocaleString();
const clockOf = (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const untilCopy = (ms, now) => (ms - now > 60000 ? `in ${fmtSpan(ms - now)}` : "any moment now");

/* Gold corner bracket (from /space). */
function Bracket({ pos, color }) {
  const s = 12, t = 2;
  const top = pos[0] === "t", left = pos[1] === "l";
  const at = { [top ? "top" : "bottom"]: -1, [left ? "left" : "right"]: -1 };
  return (
    <span style={{ position: "absolute", width: s, height: s, pointerEvents: "none", ...at }}>
      <span style={{ position: "absolute", [top ? "top" : "bottom"]: 0, [left ? "left" : "right"]: 0, width: s, height: t, background: color }} />
      <span style={{ position: "absolute", [top ? "top" : "bottom"]: 0, [left ? "left" : "right"]: 0, width: t, height: s, background: color }} />
    </span>
  );
}

/* The core cylinder — the claim's column as a core sample. One band per layer,
   L1 at the top. Fed by buildColumnRack(); callouts for the layer on the table. */
function CoreCylinder({ rack, pending, theme, width = 118, height = 236 }) {
  const n = rack.length || 20;
  const tubeX = 30, tubeY = 8, tubeW = 40, tubeH = height - 16;
  const bandH = tubeH / n;
  const fillFor = (c) => c.state === "pending" ? WALL.pending
    : c.state === "extracted" ? WALL.bore
    : c.state === "passed" ? WALL.goo
    : c.state === "salvaged" ? WALL.taken
    : c.state === "hell" ? WALL.hell
    : c.state === "hell_capped" ? WALL.capped
    : c.state === "dry" ? WALL.dry
    : c.state === "revealed" ? "rgba(255,255,255,0.10)"
    : "url(#v3-strata)";
  const p = pending && typeof pending.layer === "number" ? pending : null;
  const py = p ? tubeY + bandH * p.layer + bandH / 2 : null;
  const ticks = [0, 4, 9, 14, 19].filter((z) => z < n);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ display: "block", flex: "0 0 auto" }}>
      <defs>
        <pattern id="v3-strata" width="6" height="4" patternUnits="userSpaceOnUse">
          <rect width="6" height="4" fill="rgba(255,255,255,0.03)" />
          <rect width="6" height="1" fill="rgba(255,255,255,0.06)" />
        </pattern>
        <clipPath id="v3-clip"><rect x={tubeX} y={tubeY} width={tubeW} height={tubeH} rx={9} /></clipPath>
        <filter id="v3-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect x={tubeX} y={tubeY} width={tubeW} height={tubeH} rx={9} fill="rgba(0,0,0,0.35)" />
      <g clipPath="url(#v3-clip)">
        {rack.map((c) => (
          <rect key={c.layer} x={tubeX} y={tubeY + bandH * c.layer} width={tubeW} height={bandH + 0.5} fill={fillFor(c)}
            opacity={c.state === "undrilled" ? 1 : c.state === "extracted" ? 0.95 : 0.9}>
            {c.state === "pending" && <animate attributeName="opacity" values="1;0.55;1" dur="1.6s" repeatCount="indefinite" />}
          </rect>
        ))}
        {/* inclusion flags on non-pending layers: a small dot */}
        {rack.filter((c) => c.hasInclusion && c.state !== "pending").map((c) => (
          <circle key={`i${c.layer}`} cx={tubeX + tubeW * 0.5} cy={tubeY + bandH * c.layer + bandH / 2} r="1.6" fill={theme.warn || "#e87a2b"} opacity="0.8" />
        ))}
      </g>
      <rect x={tubeX} y={tubeY} width={tubeW} height={tubeH} rx={9} fill="none" stroke={theme.gold} strokeWidth="1" opacity="0.7" />
      <rect x={tubeX + 3} y={tubeY + 4} width={5} height={tubeH - 8} rx={2.5} fill="rgba(255,255,255,0.06)" />
      {/* depth ticks, in layers */}
      <g fontFamily={MONO} fontSize="7" fill={theme.muted} letterSpacing="0.05em">
        {ticks.map((z) => {
          const y = tubeY + bandH * z + bandH / 2;
          return (<g key={z}><line x1={tubeX - 5} y1={y} x2={tubeX} y2={y} stroke={theme.muted} strokeWidth="0.8" opacity="0.6" /><text x={tubeX - 8} y={y + 2.5} textAnchor="end">L{z + 1}</text></g>);
        })}
      </g>
      {/* the layer on the table: leader + label + ANOM dot */}
      {p && (
        <g fontFamily={MONO} letterSpacing="0.08em">
          <line x1={tubeX + tubeW} y1={py} x2={tubeX + tubeW + 10} y2={py} stroke={WALL.pending} strokeWidth="0.8" opacity="0.8" />
          <text x={tubeX + tubeW + 13} y={py - 2} fontSize="8" fill={WALL.pending}>L{p.layer + 1}</text>
          <text x={tubeX + tubeW + 13} y={py + 8} fontSize="7" fill={theme.text}>{(p.oil || 0) > 0 ? `${fmtBtr(p.oil)} BTR` : "DRY"}</text>
          {p.hasInclusion && (
            <g filter="url(#v3-glow)">
              <circle cx={tubeX + tubeW * 0.5} cy={py} r="2.4" fill={theme.warn || "#e87a2b"}>
                <animate attributeName="r" values="2.4;3.4;2.4" dur="1.6s" repeatCount="indefinite" />
              </circle>
              <text x={tubeX + tubeW + 13} y={py + 17} fontSize="6" fill={theme.warn || "#e87a2b"} letterSpacing="0.15em">ANOM</text>
            </g>
          )}
        </g>
      )}
    </svg>
  );
}

export default function OilCoreSampleV3({
  theme, pending, chargesRemaining, chargesCap, threshold,
  onDecide, onSetThreshold, salvage = [], onLateral, frontier = [], onWildcat, onWalk,
  cadence = null, rack = [], ledger = null,
  ended = false,      // settings.gameEnded — the ONLY thing that says "season closed"
  // SPECTATOR: a viewer with no rig looks at the SELECTED plot as the field
  // sees it — the public column (reveals, extractions, open pockets, hell),
  // read-only, no verbs, with a nudge to claim. { col, row, owner } | null.
  spectator = null,
}) {
  const [tab, setTab] = useState("core"); // core | next | ledger
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [thrDraft, setThrDraft] = useState(null);
  const [seeAll, setSeeAll] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!cadence?.latestMs) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(id);
  }, [cadence?.latestMs]);

  const T = Number(threshold) || 0;
  const oil = pending ? (pending.oil || 0) : 0;
  const dry = !!pending && oil <= 0;
  const crewWould = !pending ? null : chargesRemaining <= 0 ? "PASS" : dry ? "PASS" : oil >= T ? "EXTRACT" : "PASS";
  // "Season closed" comes from the game flag, never from the clock alone: a
  // test board with a stale start date is past its clock but still live.
  const seasonOver = !!ended;
  const clockOut = !ended && cadence?.seasonEndMs != null && nowMs >= cadence.seasonEndMs;
  const columnDone = cadence != null && cadence.remainingLayers <= 0;
  const revealedCount = rack.filter((c) => c.state !== "undrilled").length;
  const deadline = !cadence || seasonOver || clockOut || columnDone ? null : { at: clockOf(cadence.latestMs), until: untilCopy(cadence.latestMs, nowMs) };
  const cadenceLine = seasonOver ? "season closed"
    : !cadence ? null
    : clockOut ? "season clock has run out · the buzzer settles what is on the table"
    : columnDone ? "column fully revealed"
    : `next core lands before ${clockOf(cadence.latestMs)} · ${untilCopy(cadence.latestMs, nowMs)}`;

  const run = async (fn, okNote) => {
    if (busy) return;
    setBusy(true); setNote("");
    try { const r = await fn(); setNote(typeof okNote === "function" ? okNote(r) : okNote); return r; }
    catch (e) { setNote(`✗ ${e.message || "failed"}`); }
    finally { setBusy(false); }
  };

  // NEXT DOOR: one list, salvage first (richest), then frontier.
  const nextDoor = useMemo(() => [
    ...salvage.map((s) => ({ kind: "salvage", ...s })),
    ...frontier.map((f) => ({ kind: "wildcat", ...f })),
  ], [salvage, frontier]);
  const shown = seeAll ? nextDoor : nextDoor.slice(0, 2);

  // ── styles (theme tokens; the /space HUD proportions) ──
  const gold = theme.gold, cream = theme.textStrong || theme.text, muted = theme.muted, warn = theme.warn || "#e87a2b";
  const mono = (extra) => ({ fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", lineHeight: 1.7, color: theme.text, ...extra });
  const meta = mono({ fontSize: 9, letterSpacing: "0.22em", color: muted, textTransform: "uppercase" });
  const dataRow = (k, v, color) => (
    <div key={k} style={{ display: "flex", gap: 10 }}>
      <span style={mono({ color: muted, minWidth: 64, flex: "0 0 auto" })}>{k}</span>
      <span style={mono({ color: color || theme.text })}>{v}</span>
    </div>
  );
  const noteLine = (s, i) => <div key={i} style={mono({ color: muted, fontSize: 10, lineHeight: 1.6 })}>{s}</div>;
  const stat = (value, label, color) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 700, color: color || gold, lineHeight: 1.1, letterSpacing: "0.04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
      <div style={meta}>{label}</div>
    </div>
  );
  const cta = (text, accent, disabled, onClick, filled) => (
    <button disabled={disabled} onClick={onClick} style={{
      flex: 1, fontFamily: MONO, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", padding: "11px 10px",
      borderRadius: 2, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
      background: filled ? `${accent}22` : "transparent", color: accent, border: `1px solid ${accent}`,
      boxShadow: filled && !disabled ? `inset 0 0 0 1px ${accent}55` : "none",
    }}>{text}</button>
  );
  const tabBtn = (id, label) => (
    <button key={id} onClick={() => setTab(id)} style={{
      flex: 1, fontFamily: MONO, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", padding: "8px 4px",
      background: tab === id ? `${gold}1f` : "transparent", color: tab === id ? cream : muted,
      border: `1px solid ${tab === id ? gold : theme.border || muted}`, cursor: "pointer",
    }}>{label}</button>
  );
  const smallBtn = (accent, disabled) => ({
    fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", padding: "5px 10px", borderRadius: 2,
    cursor: disabled ? "default" : "pointer", background: "transparent", color: disabled ? muted : accent, border: `1px solid ${disabled ? muted : accent}`, opacity: disabled ? 0.5 : 1,
  });

  // ── CORE tab ──
  const core = pending ? (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <CoreCylinder rack={rack} pending={pending} theme={theme} />
        <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
          {dataRow("SAMPLE", `L${pending.layer + 1} of ${rack.length || 20}`)}
          {dataRow("ASSAY", dry ? "dry" : `${fmtBtr(oil)} BTR`, dry ? muted : cream)}
          {pending.hasInclusion && dataRow("FLAG", "anomalous inclusion", warn)}
          {dataRow("CREW", `would ${crewWould}`, crewWould === "EXTRACT" ? theme.green : theme.text)}
          {deadline ? dataRow("BY", `${deadline.at} · ${deadline.until}`) : dataRow("BY", columnDone || seasonOver || clockOut ? "the buzzer" : "the next strike")}
          {pending.hasInclusion && <div style={{ ...mono({ color: warn, letterSpacing: "0.14em" }), marginTop: 8 }}>!! ANOMALOUS INCLUSION !!</div>}
          <div style={{ marginTop: 8 }}>
            {(dry
              ? ["Dry — passing is free.", "Extracting nothing would waste a charge.", "Do nothing: the crew passes."]
              : [`Extract banks the full ${fmtBtr(oil)} BTR for 1 charge.`, "Pass is free but final — opens to neighbours.", `Do nothing: the crew ${crewWould === "EXTRACT" ? "extracts" : "passes"}.`]
            ).concat(pending.hasInclusion ? ["The inclusion is only recovered on extract."] : []).map(noteLine)}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${theme.border || muted}` }}>
        {stat(dry ? "DRY" : `${fmtBtr(oil)} BTR`, `on the table · L${pending.layer + 1}`, dry ? muted : gold)}
        {stat(`${chargesRemaining}/${chargesCap}`, "charges", chargesRemaining > 0 ? cream : theme.red)}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {cta("Extract −1⚡", theme.green, busy || chargesRemaining <= 0, () => run(() => onDecide("extract"), (d) => oil > 0 ? `✔ extracted — ${fmtBtr(oil)} BTR banked${d?.inclusion ? " · inclusion → ARTIFACTS" : ""}` : d?.inclusion ? "✔ dug it up — inclusion → ARTIFACTS" : "✔ extracted — the layer was dry"), true)}
        {cta("Pass · final", theme.red, busy, () => run(() => onDecide("pass"), "↷ passed — final"), false)}
      </div>
    </>
  ) : (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <CoreCylinder rack={rack} pending={null} theme={theme} />
        <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
          {dataRow("TABLE", "nothing on it", muted)}
          {cadence && !seasonOver && !clockOut && !columnDone && dataRow("NEXT CORE", `before ${clockOf(cadence.latestMs)} · ${untilCopy(cadence.latestMs, nowMs)}`)}
          {cadence && !seasonOver && !clockOut && !columnDone && dataRow("PACE", `a core every ${fmtSpan(cadence.intervalMs)}`)}
          {dataRow("REVEALED", `${revealedCount} of ${rack.length || 20}`)}
          <div style={{ marginTop: 8 }}>
            {(seasonOver ? ["Season closed. The reckoning is below."]
              : clockOut ? ["The season clock has run out.", "The buzzer settles anything on the table."]
              : columnDone ? ["Your column is fully revealed.", "Charges left still work next door."]
              : ["The next strike pulls a core.", "Away? The crew follows your orders."]).map(noteLine)}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${theme.border || muted}` }}>
        {stat(`${fmtBtr(ledger?.banked || 0)} BTR`, "banked")}
        {stat(`${chargesRemaining}/${chargesCap}`, "charges", chargesRemaining > 0 ? cream : theme.red)}
      </div>
    </>
  );

  // ── NEXT DOOR tab ──
  const nextTab = (
    <>
      {[ "Salvage takes a layer a neighbour passed — first lateral wins.", "Wildcat drills unclaimed ground blind, at your bore's reach." ].map(noteLine)}
      <div style={{ marginTop: 8 }}>
        {nextDoor.length === 0 && <div style={mono({ color: muted })}>Nothing open next door yet. Passed layers and unclaimed ground in reach show here.</div>}
        {shown.map((r) => (
          <div key={`${r.kind}_${r.col}_${r.row}_${r.layer}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${theme.border || muted}` }}>
            <span style={mono({})}>
              <span style={{ color: r.kind === "salvage" ? WALL.goo : gold, letterSpacing: "0.14em", fontSize: 9 }}>{r.kind === "salvage" ? "SALVAGE" : "WILDCAT"}</span>
              {" "}({r.col + 1},{r.row + 1}) · L{r.layer + 1} · {r.kind === "salvage" ? (r.oil > 0 ? `${fmtBtr(r.oil)} BTR` : "dry") : "assay unknown"}
              {r.hasInclusion && <span style={{ color: warn }}> · inclusion</span>}
            </span>
            <button style={smallBtn(r.kind === "salvage" ? theme.green : gold, busy || chargesRemaining <= 0)} disabled={busy || chargesRemaining <= 0}
              onClick={() => r.kind === "salvage"
                ? run(() => onLateral(r), (x) => `✔ salvaged (${r.col + 1},${r.row + 1}) L${r.layer + 1}${x?.inclusion ? " · inclusion → ARTIFACTS" : r.oil > 0 ? ` — ${fmtBtr(r.oil)} BTR banked` : ""}`)
                : run(() => onWildcat(r), (x) => x?.hell ? (x.tonicCapped ? "☠ hit hell — tonic capped it" : "☠ woke a demon") : x?.oil > 0 ? `✔ struck — ${fmtBtr(x.oil)} BTR banked` : x?.inclusion ? "✔ dry… but an inclusion → ARTIFACTS" : "✗ dry hole — the charge is spent")}>
              {r.kind === "salvage" ? "Take −1⚡" : "Wildcat −1⚡"}
            </button>
          </div>
        ))}
        {nextDoor.length > 2 && (
          <button style={{ ...smallBtn(muted, false), marginTop: 8 }} onClick={() => setSeeAll((v) => !v)}>{seeAll ? "Show fewer" : `See all (${nextDoor.length})`}</button>
        )}
      </div>
      {onWalk && <div style={{ marginTop: 10 }}><button style={smallBtn(gold, busy)} onClick={onWalk}>🥾 Walk the field</button><span style={mono({ color: muted, marginLeft: 8, fontSize: 10 })}>E digs frontier · ESC returns</span></div>}
    </>
  );

  // ── LEDGER tab ──
  const L = ledger;
  const ledgerTab = !L ? <div style={mono({ color: muted })}>No ledger yet.</div> : (
    <>
      <div style={{ display: "flex", gap: 12 }}>
        {stat(`${fmtBtr(L.banked)} BTR`, "banked")}
        {stat(`${L.chargesSpent}/${chargesCap}`, "charges spent", cream)}
      </div>
      <div style={{ marginTop: 10 }}>
        {dataRow("EXTRACTED", `${fmtBtr(L.extractedOwn)} BTR from your column`)}
        {dataRow("PASSED", `${fmtBtr(L.passedTotal)} BTR${L.passedTotal > 0 ? ` — neighbours took ${fmtBtr(L.takenByRivals)}, ${fmtBtr(L.leftOpen)} still open` : ""}`)}
        {L.salvagedIn > 0 && dataRow("SALVAGED", `+${fmtBtr(L.salvagedIn)} BTR next door`, theme.green)}
        {(L.wildcatIn > 0 || L.wildcatDry > 0 || L.wildcatHell > 0) && dataRow("WILDCATS", `+${fmtBtr(L.wildcatIn)} BTR${L.wildcatDry ? ` · ${L.wildcatDry} dry` : ""}${L.wildcatHell ? ` · ${L.wildcatHell} hell` : ""}`)}
      </div>
      <div style={{ marginTop: 10, borderTop: `1px solid ${theme.border || muted}`, paddingTop: 6 }}>
        {L.rows.length === 0 ? <div style={mono({ color: muted })}>Nothing yet — the first strike puts a core on the table.</div>
          : L.rows.map((r, i) => (
            <div key={`${r.kind}_${r.col ?? "o"}_${r.row ?? "o"}_${r.layer}_${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={mono({ fontSize: 10 })}>
                {r.kind === "extract" && `L${r.layer + 1} · extract`}
                {r.kind === "pass" && `L${r.layer + 1} · pass${r.takenBy ? " · a neighbour took it" : r.oil > 0 ? " · still open" : " · dry"}`}
                {r.kind === "salvage" && `salvage (${r.col + 1},${r.row + 1}) L${r.layer + 1}`}
                {r.kind === "wildcat" && `wildcat (${r.col + 1},${r.row + 1}) L${r.layer + 1}${r.hell ? " · hell" : r.oil > 0 ? "" : " · dry hole"}`}
              </span>
              <span style={mono({ fontSize: 10, color: r.kind === "pass" ? muted : r.oil > 0 ? theme.green : muted, whiteSpace: "nowrap" })}>
                {r.kind === "pass" ? `${fmtBtr(r.oil)} let go` : `${r.oil > 0 ? `+${fmtBtr(r.oil)}` : "+0"} · −${r.charge}⚡`}
              </span>
            </div>
          ))}
      </div>
    </>
  );

  if (spectator) {
    const sp = spectator;
    const extractedN = rack.filter((c) => c.state === "extracted").length;
    const openN = rack.filter((c) => c.state === "passed").length;
    const takenN = rack.filter((c) => c.state === "salvaged").length;
    const hellN = rack.filter((c) => c.state === "hell" || c.state === "hell_capped").length;
    const hasPlot = sp.col != null && sp.row != null;
    return (
      <div style={{ position: "relative", border: `1px solid ${theme.border || muted}`, background: theme.panelBg || "rgba(0,0,0,0.2)", padding: "12px 14px 12px", margin: "8px 0" }}>
        {["tl", "tr", "bl", "br"].map((p) => <Bracket key={p} pos={p} color={gold} />)}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={meta}>{String(revealedCount).padStart(2, "0")}/{rack.length || 20} // field view</span>
          <span style={{ ...meta, color: seasonOver ? muted : theme.green }}>● {seasonOver ? "closed" : "live"}</span>
        </div>
        <div style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 700, letterSpacing: "0.12em", color: cream, marginTop: 6, lineHeight: 1.15 }}>HAIL MARY<br />PROSPECTING CO.</div>
        <div style={{ ...meta, color: gold, marginTop: 4 }}>{hasPlot ? `plot (${sp.col + 1},${sp.row + 1}) · ${sp.owner ? sp.owner : "unclaimed"}` : "select a plot on the field"}</div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 12 }}>
          <CoreCylinder rack={rack} pending={null} theme={theme} />
          <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
            {dataRow("OWNER", hasPlot ? (sp.owner || "nobody yet") : "—", sp.owner ? theme.text : muted)}
            {dataRow("REVEALED", `${revealedCount} of ${rack.length || 20}`)}
            {dataRow("EXTRACTED", `${extractedN} layer${extractedN === 1 ? "" : "s"}`)}
            {dataRow("OPEN", `${openN} pocket${openN === 1 ? "" : "s"}${takenN ? ` · ${takenN} taken` : ""}`, openN ? WALL.goo : theme.text)}
            {hellN > 0 && dataRow("HELL", `${hellN} pocket${hellN === 1 ? "" : "s"}`, WALL.hell)}
            <div style={{ marginTop: 8 }}>
              {(hasPlot
                ? ["This is the field's view of the column.", "Open pockets are what a neighbour could salvage.", "Claim a plot to drill your own."]
                : ["Tap a plot to read its column.", "Claim one to drill your own."]).map(noteLine)}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${theme.border || muted}` }}>
          {stat(`${revealedCount}/${rack.length || 20}`, "revealed", cream)}
          {stat(String(openN), "open pockets", openN ? WALL.goo : muted)}
        </div>
        {/* CLAIM — present only when the page says the server would accept it
            (registration pre-anchor for players; testers while testing is on).
            Same handler as STAKE YOUR CLAIM. Otherwise one line says why not. */}
        {sp.claim && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {cta(sp.claim.label || "Claim this plot", gold, busy || !!sp.claim.disabled, () => run(() => sp.claim.onClaim(), "✔ claimed — your rig is going up"), true)}
            </div>
            {sp.claim.note && <div style={{ ...mono({ color: muted, fontSize: 10 }), marginTop: 4, textAlign: "center" }}>{sp.claim.note}</div>}
          </div>
        )}
        {!sp.claim && sp.claimNote && <div style={{ ...mono({ color: muted, fontSize: 10 }), marginTop: 10, textAlign: "center" }}>{sp.claimNote}</div>}
        {note && <div style={{ ...mono({ color: gold, fontSize: 10 }), marginTop: 6 }}>{note}</div>}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", border: `1px solid ${theme.border || muted}`, background: theme.panelBg || "rgba(0,0,0,0.2)", padding: "12px 14px 12px", margin: "8px 0" }}>
      {["tl", "tr", "bl", "br"].map((p) => <Bracket key={p} pos={p} color={gold} />)}
      {/* meta line */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={meta}>{String(revealedCount).padStart(2, "0")}/{rack.length || 20} // field extraction report</span>
        <span style={{ ...meta, color: seasonOver ? muted : theme.green }}>● {seasonOver ? "closed" : "live"}</span>
      </div>
      <div style={{ fontFamily: DISPLAY, fontSize: 15, fontWeight: 700, letterSpacing: "0.12em", color: cream, marginTop: 6, lineHeight: 1.15 }}>HAIL MARY<br />PROSPECTING CO.</div>
      {cadenceLine && <div style={{ ...meta, color: gold, marginTop: 4 }}>{cadenceLine}</div>}
      <div style={{ display: "flex", gap: 0, marginTop: 10 }}>
        {tabBtn("core", "Core")}{tabBtn("next", `Next door${nextDoor.length ? ` · ${nextDoor.length}` : ""}`)}{tabBtn("ledger", "Ledger")}
      </div>
      <div style={{ marginTop: 12 }}>
        {tab === "core" ? core : tab === "next" ? nextTab : ledgerTab}
      </div>
      {note && <div style={{ ...mono({ color: gold, fontSize: 10 }), marginTop: 8 }}>{note}</div>}
      {/* crew orders — behind a link */}
      <div style={{ marginTop: 10, textAlign: "center" }}>
        <button onClick={() => setOrdersOpen((o) => !o)} style={{ background: "none", border: "none", cursor: "pointer", ...meta, color: muted }}>
          [ crew orders · extract ≥ {fmtBtr(T)} BTR {ordersOpen ? "▴" : "▾"} ]
        </button>
        {ordersOpen && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center", marginTop: 6 }}>
            <span style={mono({ color: muted, fontSize: 10 })}>if you&apos;re away, extract anything ≥</span>
            <input value={thrDraft ?? String(Math.round(T))} inputMode="numeric" onChange={(e) => setThrDraft(e.target.value.replace(/[^\d]/g, ""))}
              style={{ fontFamily: MONO, fontSize: 11, width: 64, padding: "3px 5px", background: theme.inputBg || "rgba(0,0,0,0.3)", color: theme.text, border: `1px solid ${theme.border || muted}`, borderRadius: 2 }} />
            <span style={mono({ color: muted, fontSize: 10 })}>BTR</span>
            <button style={smallBtn(gold, busy || thrDraft == null)} disabled={busy || thrDraft == null}
              onClick={() => { const v = Number(thrDraft); if (!Number.isFinite(v) || v < 0) return; run(() => onSetThreshold(v).then(() => setThrDraft(null)), `✔ crew orders set: extract ≥ ${fmtBtr(v)}`); }}>Set</button>
          </div>
        )}
      </div>
    </div>
  );
}
