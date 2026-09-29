"use client";

// ── v3 CORE SAMPLE — the /space module, one decision per screen ──────────────
// (docs/oil-v2-player-ui-brief.md; structure agreed with Michelle 2026-09-28.)
// Same props as OilCoreSampleV2 — a drop-in — but the data is layered:
//   CORE SAMPLE  the core on the table and nothing else: cylinder, assay lines,
//                notes, two big stats, EXTRACT. Nothing on the table: the
//                cylinder, the pace, the two stats. Quiet.
//   NEXT DOOR    salvage + frontier merged into one short list, best two shown.
//   LEDGER       banked, charges, and every move so far — always open.
// The standing order lives behind a small CREW ORDERS link, not on the screen.
// The core cylinder IS the rack — no glyph strip, no legend. Bands use the
// strata wall's colour schema (decided 2026-09-28): gold = on the table,
// dark = extracted, green = passed (open), violet = a neighbour took it,
// red = hell, grey = dry; undrilled = faint strata hatch.
//
// 2026-09-29: moved onto the HmHud kit — the /space telemetry panel's chrome
// (Michelle: "the displays from /space still look better"): dark glass, gold
// brackets, Orbitron title, the four mono voices, two big stats, the clipped
// button. FIXED PALETTE: the card no longer follows the six console themes
// (`theme` is accepted for the drop-in signature and otherwise unused).

import { useEffect, useMemo, useState } from "react";
import { fmtSpan, HEAT_COPY } from "@/lib/oilLoopV2";
import { HUD, HUD_MONO, HudKeyframes, HudPanel, HudMeta, HudTitle, HudTabs, HudDivider, HudLine, HudCaption, HudStats, HudButton, HudHint, hudSmallBtn } from "@/components/HmHud";

const MONO = HUD_MONO;
// taken = violet (2026-09-29, Michelle: amber sat too close to the pending gold).
const WALL = { pending: "#ffd75e", pendingHi: "#efe0a8", bore: "#2a1d10", goo: "#37f07a", taken: "#c77dff", hell: "#ff3f1f", dry: "#4a4036", capped: "#a1793f", cased: "#8fa3b8" };
const fmtBtr = (n) => Math.round(n || 0).toLocaleString();
const clockOf = (ms) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const untilCopy = (ms, now) => (ms - now > 60000 ? `in ${fmtSpan(ms - now)}` : "any moment now");

/* The core cylinder — the claim's column as a core sample. One band per layer,
   L1 at the top. Fed by buildColumnRack(); callouts for the layer on the table. */
function CoreCylinder({ rack, pending, width = 104, height = 236 }) {
  const n = rack.length || 20;
  const tubeX = 26, tubeY = 8, tubeW = 34, tubeH = height - 16;
  const bandH = tubeH / n;
  // Bore head = the deepest layer the rig has reached; everything below is
  // still ground. The marker is what makes "where am I" instant.
  const reached = rack.reduce((m, c) => (c.state !== "undrilled" ? Math.max(m, c.layer + 1) : m), 0);
  const headY = tubeY + bandH * reached;
  const fillFor = (c) => c.state === "pending" ? WALL.pending
    : c.state === "extracted" ? WALL.bore
    : c.state === "passed" ? WALL.goo
    : c.state === "salvaged" ? WALL.taken
    : c.state === "hell" ? WALL.hell
    : c.state === "hell_capped" ? WALL.capped
    : c.state === "cased" ? WALL.cased
    : c.state === "dry" ? WALL.dry
    : c.state === "revealed" ? "rgba(255,255,255,0.10)"
    : "url(#v3-strata)";
  const p = pending && typeof pending.layer === "number" ? pending : null;
  const py = p ? tubeY + bandH * p.layer + bandH / 2 : null;
  // the warning read on the newest core (the pending one, else the last revealed)
  const headCell = rack.find((c) => c.layer === reached - 1);
  const heat = (p && p.heat && p.heat !== "nominal") ? p.heat : headCell?.heat || null;
  const ticks = [0, 4, 9, 14, 19].filter((z) => z < n);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ display: "block", flex: "0 0 auto" }}>
      <defs>
        <pattern id="v3-strata" width="6" height="4" patternUnits="userSpaceOnUse">
          <rect width="6" height="4" fill="rgba(212,168,84,0.05)" />
          <rect width="6" height="1" fill="rgba(212,168,84,0.10)" />
        </pattern>
        <clipPath id="v3-clip"><rect x={tubeX} y={tubeY} width={tubeW} height={tubeH} rx={9} /></clipPath>
        <linearGradient id="v3-heat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={HUD.red} stopOpacity="0.9" /><stop offset="1" stopColor={HUD.orange} stopOpacity="0.15" />
        </linearGradient>
        <filter id="v3-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect x={tubeX} y={tubeY} width={tubeW} height={tubeH} rx={9} fill="rgba(0,0,0,0.28)" />
      <g clipPath="url(#v3-clip)">
        {rack.map((c) => (
          <rect key={c.layer} x={tubeX} y={tubeY + bandH * c.layer} width={tubeW} height={bandH + 0.5} fill={fillFor(c)}
            opacity={c.state === "undrilled" ? 1 : c.state === "extracted" ? 0.95 : 0.9}>
            {c.state === "pending" && <animate attributeName="opacity" values="1;0.55;1" dur="1.6s" repeatCount="indefinite" />}
          </rect>
        ))}
        {rack.filter((c) => c.hasInclusion && c.state !== "pending").map((c) => (
          <circle key={`i${c.layer}`} cx={tubeX + tubeW * 0.5} cy={tubeY + bandH * c.layer + bandH / 2} r="1.6" fill={HUD.orange} opacity="0.85" />
        ))}
      </g>
      {/* heat: the ground under the bore head glows — two bands for "elevated"
          (hot within reach, under you or next door), one hot band for "high" (the
          next layer itself: hell or the motherlode) */}
      {heat && reached > 0 && reached < n && (
        <g clipPath="url(#v3-clip)">
          <rect x={tubeX} y={headY} width={tubeW} height={bandH * (heat === "high" ? 1 : 2)} fill="url(#v3-heat)" opacity={heat === "high" ? 0.95 : 0.7}>
            <animate attributeName="opacity" values={heat === "high" ? "0.95;0.5;0.95" : "0.7;0.35;0.7"} dur={heat === "high" ? "1.1s" : "2.2s"} repeatCount="indefinite" />
          </rect>
        </g>
      )}
      <rect x={tubeX} y={tubeY} width={tubeW} height={tubeH} rx={9} fill="none" stroke={heat === "high" ? HUD.red : HUD.gold} strokeWidth="1" opacity="0.7" />
      <rect x={tubeX + 3} y={tubeY + 4} width={5} height={tubeH - 8} rx={2.5} fill="rgba(255,255,255,0.06)" />
      {reached > 0 && reached < n && (
        <g>
          <line x1={tubeX - 3} y1={headY} x2={tubeX + tubeW + 3} y2={headY} stroke={HUD.gold} strokeWidth="1.5" />
          <polygon points={`${tubeX - 9},${headY - 3.5} ${tubeX - 9},${headY + 3.5} ${tubeX - 3.5},${headY}`} fill={HUD.gold} />
        </g>
      )}
      <g fontFamily={MONO} fontSize="7" fill={HUD.muted} letterSpacing="0.05em">
        {ticks.map((z) => {
          const y = tubeY + bandH * z + bandH / 2;
          return (<g key={z}><line x1={tubeX - 5} y1={y} x2={tubeX} y2={y} stroke={HUD.muted} strokeWidth="0.8" opacity="0.6" /><text x={tubeX - 8} y={y + 2.5} textAnchor="end">L{z + 1}</text></g>);
        })}
      </g>
      {!p && reached > 0 && (
        <g fontFamily={MONO} letterSpacing="0.08em">
          <text x={tubeX + tubeW + 8} y={headY - 3} fontSize="9" fill={HUD.gold} fontWeight="700">L{reached}</text>
          <text x={tubeX + tubeW + 8} y={headY + 7} fontSize="6.5" fill={HUD.muted} letterSpacing="0.14em">BORE HEAD</text>
        </g>
      )}
      {p && (
        <g fontFamily={MONO} letterSpacing="0.08em">
          <line x1={tubeX + tubeW} y1={py} x2={tubeX + tubeW + 10} y2={py} stroke={WALL.pending} strokeWidth="0.8" opacity="0.8" />
          <text x={tubeX + tubeW + 13} y={py - 2} fontSize="8" fill={WALL.pending}>L{p.layer + 1}</text>
          <text x={tubeX + tubeW + 13} y={py + 8} fontSize="7" fill={HUD.cream}>{(p.oil || 0) > 0 ? `${fmtBtr(p.oil)} BTR` : "DRY"}</text>
          {p.hasInclusion && (
            <g filter="url(#v3-glow)">
              <circle cx={tubeX + tubeW * 0.5} cy={py} r="2.4" fill={HUD.orange}>
                <animate attributeName="r" values="2.4;3.4;2.4" dur="1.6s" repeatCount="indefinite" />
              </circle>
              <text x={tubeX + tubeW + 13} y={py + 17} fontSize="6" fill={HUD.orange} letterSpacing="0.15em">ANOM</text>
            </g>
          )}
        </g>
      )}
    </svg>
  );
}

export default function OilCoreSampleV3({
  theme, // accepted for the drop-in signature; the card runs the fixed HUD palette
  pending, chargesRemaining, chargesCap, threshold,
  onDecide, onSetThreshold, salvage = [], onLateral, frontier = [], onWildcat, onWalk,
  cadence = null, rack = [], ledger = null,
  ended = false,      // settings.gameEnded — the ONLY thing that says "season closed"
  // CREW ORDERS (option B, 2026-09-28): LATERAL EXTRACT = auto-take a neighbour's
  // pass at or above the line; AUTO-PILOT = keep everything once charges cover
  // the layers left. Same settings the rig panel's toggle and key flip.
  orders = { autopilot: false, salvage: false, caseOnHeat: false },
  onSetOrders = null, // async ({ salvage?, autopilot?, caseNext?, caseOnHeat? }) => void
  // CASING (2026-09-29): strings in supply and whether one is armed for the next
  // strike. Armed = the next layer is drilled behind steel, whatever it holds.
  casing = 0,
  casingArmed = false,
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
  const n = rack.length || 20;
  const revealedCount = rack.filter((c) => c.state !== "undrilled").length;
  // Hell warning on the newest core: the pending one, else the deepest revealed.
  const reachedZ = rack.reduce((m, c) => (c.state !== "undrilled" ? Math.max(m, c.layer + 1) : m), 0);
  const heat = (pending?.heat && pending.heat !== "nominal") ? pending.heat : (rack.find((c) => c.layer === reachedZ - 1)?.heat || null);
  const heatCopy = HEAT_COPY[heat || "nominal"];
  const deadline = !cadence || seasonOver || clockOut || columnDone ? null : { at: clockOf(cadence.latestMs), until: untilCopy(cadence.latestMs, nowMs) };
  // How far into the current reveal window we are (0..1). The strike lands
  // somewhere inside it; full = the latest it can land. Shown as a thin bar,
  // never as digits counting down — the moment stays unguessable.
  const windowFrac = cadence && cadence.latestMs && cadence.windowStartMs != null && cadence.latestMs > cadence.windowStartMs
    ? Math.min(1, Math.max(0, (nowMs - cadence.windowStartMs) / (cadence.latestMs - cadence.windowStartMs))) : null;
  const nextCoreLive = cadence && !seasonOver && !clockOut && !columnDone;
  const cadenceLine = seasonOver ? "Season closed"
    : !cadence ? "Field extraction report"
    : clockOut ? "Season clock run out · the buzzer settles the table"
    : columnDone ? "Column fully revealed"
    : `Next core before ${clockOf(cadence.latestMs)} · ${untilCopy(cadence.latestMs, nowMs)}`;

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

  // ── pieces ──
  const PAD = 8; // label column beside the cylinder: "SAMPLE  L5 of 20"
  const meta = { fontFamily: MONO, fontSize: "0.5rem", letterSpacing: "0.22em", color: HUD.muted, textTransform: "uppercase", lineHeight: 1.5 };
  const noteText = { fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.05em", lineHeight: 1.55, color: HUD.muted };
  const windowBar = nextCoreLive && windowFrac != null && (
    <div title="the reveal window — the next core lands somewhere in here, no later than the end" style={{ marginTop: "0.5rem", height: 3, background: HUD.goldFaint, overflow: "hidden" }}>
      <div style={{ width: `${Math.round(windowFrac * 100)}%`, height: "100%", background: HUD.gold, opacity: 0.85, transition: "width 1s linear" }} />
    </div>
  );
  const noteLineEl = note && <HudLine type="data" text={note} />;
  // CASING: the hot-zone decision. Shown whenever a string is armed or the
  // reading is hot; the button arms/disarms the next strike.
  const casingBlock = (heat || casingArmed) && onSetOrders && !seasonOver && (
    <div style={{ marginTop: "0.6rem", padding: "0.5rem 0.6rem", border: `1px solid ${casingArmed ? HUD.orange : HUD.goldFaint}`, background: casingArmed ? "rgba(232,122,43,0.08)" : "transparent" }}>
      <HudLine type="label" pad={PAD} label="CASING" text={casingArmed ? "ARMED — the next layer is drilled behind steel" : casing > 0 ? `${casing} string${casing === 1 ? "" : "s"} on the rig` : "none on the rig"} />
      <HudLine type="note" text={casingArmed
        ? "Whatever the next layer holds is sealed off: hell never breaches, a motherlode is never produced. No charge, no core on the table."
        : heat === "high" ? "Case the next layer and lose whatever it is. Or ride it: the motherlode, or a breach."
        : "Casing seals the NEXT layer only. Arm it when the reading is HIGH — the hot cell is directly below then."} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: "0.35rem" }}>
        <button style={hudSmallBtn(casingArmed ? HUD.red : HUD.orange, busy || (!casingArmed && casing <= 0))} disabled={busy || (!casingArmed && casing <= 0)}
          onClick={() => run(() => onSetOrders({ caseNext: !casingArmed }), casingArmed ? "casing disarmed — the next layer comes to the table" : "✔ casing armed — the next layer is drilled behind steel")}>
          {casingArmed ? "Disarm casing" : "Case the next layer"}
        </button>
        {orders?.caseOnHeat && <span style={noteText}>CASE ON HEAT is on: the crew arms it on a HIGH reading.</span>}
      </div>
    </div>
  );

  // ── CORE SAMPLE tab ──
  const core = pending ? (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <CoreCylinder rack={rack} pending={pending} />
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <HudLine type="label" pad={PAD} label="SAMPLE" text={`L${pending.layer + 1} of ${n}`} />
          <HudLine type="label" pad={PAD} label="CLASS" text={dry ? "Dry shale" : pending.hasInclusion ? "Wet · anomalous" : "Wet core"} />
          <HudLine type="blank" />
          <HudLine type="data" pad={PAD} label="Assay" text={dry ? "dry" : `${fmtBtr(oil)} BTR`} />
          <HudLine type="data" pad={PAD} label="Temp" text={heatCopy.temp} />
          <HudLine type="data" pad={PAD} label="Crew" text={`would ${crewWould.toLowerCase()}`} />
          <HudLine type="data" pad={PAD} label="By" text={deadline ? `${deadline.at} · ${deadline.until}` : columnDone || seasonOver || clockOut ? "the buzzer" : "the next strike"} />
          <HudLine type="data" pad={PAD} label="Charges" text={`${chargesRemaining} of ${chargesCap}`} />
        </div>
      </div>
      <HudLine type="blank" />
      <HudLine type="warn" text={heatCopy.warn || (pending.hasInclusion ? "!! ANOMALOUS INCLUSION !!" : dry ? "!! DRY — NOTHING TO KEEP !!" : crewWould === "EXTRACT" ? "!! ABOVE YOUR LINE — CREW WOULD KEEP IT !!" : "!! BELOW YOUR LINE — CREW WOULD PASS !!")} />
      {heatCopy.warn && pending.hasInclusion && <HudLine type="warn" text="!! ANOMALOUS INCLUSION !!" />}
      <HudLine type="blank" />
      {heat && <HudLine type="note" text={heat === "high" ? "The next layer is hot: a hell pocket or the motherlode." : "Something hot within two cells — under you or next door. Hell, or the big one."} />}
      {casingBlock}
      {(dry
        ? ["Passing is free. Extracting nothing wastes a charge.", "Do nothing: the crew passes."]
        : [`Extract keeps the full ${fmtBtr(oil)} BTR for 1 charge.`, `Do nothing: the crew ${crewWould === "EXTRACT" ? "keeps it" : "passes it"} at the next strike.`, "A pass is final — it opens to next door."]
      ).concat(pending.hasInclusion ? ["The inclusion is only recovered on extract."] : []).map((t, i) => <HudLine key={i} type="note" text={t} />)}
      {noteLineEl}
      <HudDivider margin="0.6rem 0 0.5rem" />
      <HudCaption>ON THE TABLE · L{pending.layer + 1}</HudCaption>
      <HudStats stats={[
        { value: dry ? "DRY" : `${fmtBtr(oil)} BTR`, label: "assay", color: dry ? HUD.muted : HUD.cyan },
        { value: `${chargesRemaining}/${chargesCap}`, label: "charges", color: chargesRemaining > 0 ? HUD.orange : HUD.red },
      ]} />
      {/* ONE BUTTON (Michelle, 2026-09-28): EXTRACT keeps it now. Doing nothing
          hands the layer to the crew's orders at the next strike. No pass
          control on the card (2026-09-29). */}
      <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "center" }}>
        <HudButton accent={HUD.green} disabled={busy || chargesRemaining <= 0}
          onClick={() => run(() => onDecide("extract"), (d) => oil > 0 ? `✔ extracted — ${fmtBtr(oil)} BTR banked${d?.inclusion ? " · inclusion → ARTIFACTS" : ""}` : d?.inclusion ? "✔ dug it up — inclusion → ARTIFACTS" : "✔ extracted — the layer was dry")}>
          Extract −1⚡
        </HudButton>
      </div>
    </>
  ) : (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <CoreCylinder rack={rack} pending={null} />
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <HudLine type="label" pad={PAD} label="BORE" text={`L${revealedCount} of ${n}`} />
          <HudLine type="label" pad={PAD} label="TABLE" text="nothing on it" />
          <HudLine type="blank" />
          <HudLine type="data" pad={PAD} label="Banked" text={`${fmtBtr(ledger?.banked || 0)} BTR`} />
          {heat && <HudLine type="data" pad={PAD} label="Temp" text={heatCopy.temp} />}
          {nextCoreLive && <HudLine type="data" pad={PAD} label="Pace" text={`a core every ${fmtSpan(cadence.intervalMs)}`} />}
          <HudLine type="data" pad={PAD} label="Charges" text={`${chargesRemaining} of ${chargesCap}`} />
        </div>
      </div>
      <HudLine type="blank" />
      {(seasonOver ? ["!! SEASON CLOSED !!"] : clockOut ? ["!! SEASON CLOCK RUN OUT !!"] : columnDone ? ["!! COLUMN FULLY REVEALED !!"] : heatCopy.warn && !seasonOver ? [heatCopy.warn] : []).map((t) => <HudLine key={t} type="warn" text={t} />)}
      {heat && !seasonOver && !clockOut && !columnDone && <HudLine type="note" text={heat === "high" ? "The next layer is hot: a hell pocket or the motherlode." : "Something hot within two cells — under you or next door. Hell, or the big one."} />}
      {!clockOut && !columnDone && casingBlock}
      {(seasonOver ? ["The reckoning is below."]
        : clockOut ? ["The buzzer settles anything on the table."]
        : columnDone ? ["Charges left still work next door."]
        : ["The next strike pulls a core.", "Away? The crew follows your orders."]).map((t, i) => <HudLine key={i} type="note" text={t} />)}
      {noteLineEl}
      <HudDivider margin="0.6rem 0 0.5rem" />
      <HudCaption>{nextCoreLive ? `NEXT CORE · BEFORE ${clockOf(cadence.latestMs)}` : "YOUR RIG"}</HudCaption>
      <HudStats stats={[
        nextCoreLive
          ? { value: cadence.latestMs - nowMs > 60000 ? `≤ ${fmtSpan(cadence.latestMs - nowMs)}` : "ANY MOMENT", label: "next core", color: HUD.cyan }
          : { value: `${fmtBtr(ledger?.banked || 0)} BTR`, label: "banked", color: HUD.cyan },
        { value: `${chargesRemaining}/${chargesCap}`, label: "charges", color: chargesRemaining > 0 ? HUD.orange : HUD.red },
      ]} />
      {windowBar}
    </>
  );

  // ── NEXT DOOR tab ──
  const nextTab = (
    <>
      <HudLine type="note" text="Salvage takes a layer a neighbour passed — first lateral wins." />
      <HudLine type="note" text="Wildcat drills unclaimed ground blind, at your bore's reach." />
      <HudLine type="blank" />
      {nextDoor.length === 0 && <HudLine type="plain" text="Nothing open next door yet. Passed layers and unclaimed ground in reach show here." />}
      {shown.map((r) => (
        <div key={`${r.kind}_${r.col}_${r.row}_${r.layer}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "0.35rem 0", borderBottom: `1px solid ${HUD.goldFaint}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...meta, color: r.kind === "salvage" ? HUD.green : HUD.gold }}>{r.kind === "salvage" ? "SALVAGE" : "WILDCAT"} · ({r.col + 1},{r.row + 1}) · L{r.layer + 1}</div>
            <div style={{ fontFamily: MONO, fontSize: "0.64rem", letterSpacing: "0.05em", color: HUD.cyan, textShadow: `0 0 6px ${HUD.cyanDim}` }}>
              {r.kind === "salvage" ? (r.oil > 0 ? `${fmtBtr(r.oil)} BTR` : "dry") : "assay unknown"}{r.hasInclusion && <span style={{ color: HUD.orange }}> · inclusion</span>}
            </div>
          </div>
          <button style={hudSmallBtn(r.kind === "salvage" ? HUD.green : HUD.gold, busy || chargesRemaining <= 0)} disabled={busy || chargesRemaining <= 0}
            onClick={() => r.kind === "salvage"
              ? run(() => onLateral(r), (x) => `✔ salvaged (${r.col + 1},${r.row + 1}) L${r.layer + 1}${x?.inclusion ? " · inclusion → ARTIFACTS" : r.oil > 0 ? ` — ${fmtBtr(r.oil)} BTR banked` : ""}`)
              : run(() => onWildcat(r), (x) => x?.hell ? (x.tonicCapped ? "☠ hit hell — tonic capped it" : "☠ woke a demon") : x?.oil > 0 ? `✔ struck — ${fmtBtr(x.oil)} BTR banked` : x?.inclusion ? "✔ dry… but an inclusion → ARTIFACTS" : "✗ dry hole — the charge is spent")}>
            {r.kind === "salvage" ? "Take −1⚡" : "Wildcat −1⚡"}
          </button>
        </div>
      ))}
      {nextDoor.length > 2 && (
        <button style={{ ...hudSmallBtn(HUD.muted, false), marginTop: "0.5rem" }} onClick={() => setSeeAll((v) => !v)}>{seeAll ? "Show fewer" : `See all (${nextDoor.length})`}</button>
      )}
      {onWalk && <div style={{ marginTop: "0.6rem", display: "flex", alignItems: "center", gap: 8 }}><button style={hudSmallBtn(HUD.gold, busy)} onClick={onWalk}>🥾 Walk the field</button><span style={noteText}>E digs frontier · ESC returns</span></div>}
      {noteLineEl}
      <HudDivider margin="0.6rem 0 0.5rem" />
      <HudCaption>BEYOND YOUR FENCE</HudCaption>
      <HudStats stats={[
        { value: String(salvage.length), label: "open pockets", color: salvage.length ? HUD.green : HUD.muted },
        { value: String(frontier.length), label: "frontier in reach", color: frontier.length ? HUD.cyan : HUD.muted },
      ]} />
    </>
  );

  // ── LEDGER tab ──
  const L = ledger;
  const ledgerTab = !L ? <HudLine type="plain" text="No ledger yet." /> : (
    <>
      <HudLine type="data" pad={10} label="Extracted" text={`${fmtBtr(L.extractedOwn)} BTR from your column`} />
      <HudLine type="data" pad={10} label="Passed" text={`${fmtBtr(L.passedTotal)} BTR${L.passedTotal > 0 ? ` — ${fmtBtr(L.takenByRivals)} taken, ${fmtBtr(L.leftOpen)} open` : ""}`} />
      {L.salvagedIn > 0 && <HudLine type="data" pad={10} label="Salvaged" text={`+${fmtBtr(L.salvagedIn)} BTR next door`} />}
      {(L.wildcatIn > 0 || L.wildcatDry > 0 || L.wildcatHell > 0) && <HudLine type="data" pad={10} label="Wildcats" text={`+${fmtBtr(L.wildcatIn)} BTR${L.wildcatDry ? ` · ${L.wildcatDry} dry` : ""}${L.wildcatHell ? ` · ${L.wildcatHell} hell` : ""}`} />}
      <HudLine type="blank" />
      <div style={{ borderTop: `1px solid ${HUD.goldFaint}`, paddingTop: "0.35rem" }}>
        {L.rows.length === 0 ? <HudLine type="note" text="Nothing yet — the first strike puts a core on the table." />
          : L.rows.map((r, i) => (
            <div key={`${r.kind}_${r.col ?? "o"}_${r.row ?? "o"}_${r.layer}_${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontFamily: MONO, fontSize: "0.6rem", letterSpacing: "0.05em", lineHeight: 1.6 }}>
              <span style={{ color: HUD.cream }}>
                {r.kind === "extract" && `L${r.layer + 1} · extract`}
                {r.kind === "pass" && `L${r.layer + 1} · pass${r.takenBy ? " · a neighbour took it" : r.oil > 0 ? " · still open" : " · dry"}`}
                {r.kind === "cased" && `L${r.layer + 1} · cased through${r.hell ? " · hell, sealed" : r.oil > 0 ? " · a pay zone, cased off" : " · shale"}`}
                {r.kind === "salvage" && `salvage (${r.col + 1},${r.row + 1}) L${r.layer + 1}`}
                {r.kind === "wildcat" && `wildcat (${r.col + 1},${r.row + 1}) L${r.layer + 1}${r.hell ? " · hell" : r.oil > 0 ? "" : " · dry hole"}`}
              </span>
              <span style={{ color: r.kind === "cased" ? WALL.cased : r.kind === "pass" ? (r.takenBy ? HUD.violet : HUD.muted) : r.oil > 0 ? HUD.green : HUD.muted, whiteSpace: "nowrap" }}>
                {r.kind === "cased" ? (r.hell ? "sealed" : `${fmtBtr(r.oil)} behind steel`) : r.kind === "pass" ? `${fmtBtr(r.oil)} let go` : `${r.oil > 0 ? `+${fmtBtr(r.oil)}` : "+0"} · −${r.charge}⚡`}
              </span>
            </div>
          ))}
      </div>
      {noteLineEl}
      <HudDivider margin="0.6rem 0 0.5rem" />
      <HudCaption>SEASON TO DATE</HudCaption>
      <HudStats stats={[
        { value: `${fmtBtr(L.banked)} BTR`, label: "banked", color: HUD.cyan },
        { value: `${L.chargesSpent}/${chargesCap}`, label: "charges spent", color: HUD.orange },
      ]} />
    </>
  );

  // ── SPECTATOR ──
  if (spectator) {
    const sp = spectator;
    const extractedN = rack.filter((c) => c.state === "extracted").length;
    const openN = rack.filter((c) => c.state === "passed").length;
    const takenN = rack.filter((c) => c.state === "salvaged").length;
    const hellN = rack.filter((c) => c.state === "hell" || c.state === "hell_capped").length;
    const hasPlot = sp.col != null && sp.row != null;
    return (
      <div style={{ margin: "8px 0" }}>
        <HudKeyframes />
        <HudPanel>
          <HudMeta index={`${String(revealedCount).padStart(2, "0")}/${n}`} label="Field view" status={seasonOver ? "CLOSED" : "LIVE"} lamp={seasonOver ? HUD.gold : HUD.orange} blink={!seasonOver} />
          <HudTitle subtitle={hasPlot ? `Plot (${sp.col + 1},${sp.row + 1}) · ${sp.owner ? sp.owner : "unclaimed"}` : "Select a plot on the field"} />
          <HudDivider />
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <CoreCylinder rack={rack} pending={null} />
            <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
              <HudLine type="label" pad={PAD} label="OWNER" text={hasPlot ? (sp.owner || "nobody yet") : "—"} />
              <HudLine type="label" pad={PAD} label="BORE" text={`L${revealedCount} of ${n}`} />
              <HudLine type="blank" />
              <HudLine type="data" pad={PAD} label="Kept" text={`${extractedN} layer${extractedN === 1 ? "" : "s"}`} />
              <HudLine type="data" pad={PAD} label="Open" text={`${openN} pocket${openN === 1 ? "" : "s"}${takenN ? ` · ${takenN} taken` : ""}`} />
              {hellN > 0 && <HudLine type="data" pad={PAD} label="Hell" text={`${hellN} pocket${hellN === 1 ? "" : "s"}`} />}
              {rack.some((c) => c.state === "cased") && <HudLine type="data" pad={PAD} label="Cased" text={`${rack.filter((c) => c.state === "cased").length} layer${rack.filter((c) => c.state === "cased").length === 1 ? "" : "s"}`} />}
            </div>
          </div>
          <HudLine type="blank" />
          {heatCopy.warn && <HudLine type="warn" text={heatCopy.warn} />}
          {openN > 0 && <HudLine type="warn" text={`!! ${openN} POCKET${openN === 1 ? "" : "S"} OPEN TO NEIGHBOURS !!`} />}
          {(hasPlot
            ? ["This is the field's view of the column.", "Open pockets are what a neighbour could salvage.", "Claim a plot to drill your own."]
            : ["Tap a plot to read its column.", "Claim one to drill your own."]).map((t, i) => <HudLine key={i} type="note" text={t} />)}
          {noteLineEl}
          <HudDivider margin="0.6rem 0 0.5rem" />
          <HudCaption>{hasPlot ? `PLOT (${sp.col + 1},${sp.row + 1}) — HAIL MARY FIELD` : "HAIL MARY FIELD"}</HudCaption>
          <HudStats stats={[
            { value: `${revealedCount}/${n}`, label: "revealed", color: HUD.cyan },
            { value: String(openN), label: "open pockets", color: openN ? HUD.green : HUD.muted },
          ]} />
          {/* CLAIM — present only when the page says the server would accept it
              (registration pre-anchor for players; testers while testing is on).
              Same handler as STAKE YOUR CLAIM. Otherwise one line says why not. */}
          {sp.claim && (
            <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "center" }}>
              <HudButton disabled={busy || !!sp.claim.disabled} onClick={() => run(() => sp.claim.onClaim(), "✔ claimed — your rig is going up")}>{sp.claim.label || "Claim this plot?"}</HudButton>
            </div>
          )}
          {sp.claim?.note && <HudHint>{sp.claim.note}</HudHint>}
          {!sp.claim && sp.claimNote && <HudHint>{sp.claimNote}</HudHint>}
        </HudPanel>
      </div>
    );
  }

  return (
    <div style={{ margin: "8px 0" }}>
      <HudKeyframes />
      <HudPanel>
        <HudMeta index={`${String(revealedCount).padStart(2, "0")}/${n}`} label="Field extraction report" status={seasonOver ? "CLOSED" : "LIVE"} lamp={seasonOver ? HUD.gold : HUD.orange} blink={!seasonOver} />
        <HudTitle subtitle={cadenceLine} />
        <HudTabs
          tabs={[{ id: "core", label: "Core sample" }, { id: "next", label: `Next door${nextDoor.length ? ` · ${nextDoor.length}` : ""}` }, { id: "ledger", label: "Ledger" }]}
          active={tab} onSelect={setTab} />
        <HudDivider />
        <div style={{ minHeight: 140 }}>
          {tab === "core" ? core : tab === "next" ? nextTab : ledgerTab}
        </div>
        {/* crew orders — behind a hint line */}
        <HudHint onClick={() => setOrdersOpen((o) => !o)}>
          [ crew orders · keep ≥ {fmtBtr(T)} BTR · lateral extract {orders?.salvage ? "on" : "off"} · {orders?.autopilot ? "auto-pilot" : "orders"} {ordersOpen ? "▴" : "▾"} ]
        </HudHint>
        {ordersOpen && (
          <div style={{ marginTop: "0.5rem", borderTop: `1px solid ${HUD.goldFaint}`, paddingTop: "0.5rem" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <span style={noteText}>while you&apos;re away, keep anything ≥</span>
              <input value={thrDraft ?? String(Math.round(T))} inputMode="numeric" onChange={(e) => setThrDraft(e.target.value.replace(/[^\d]/g, ""))}
                style={{ fontFamily: MONO, fontSize: "0.64rem", width: 64, padding: "3px 5px", background: "rgba(0,0,0,0.35)", color: HUD.cyan, border: `1px solid ${HUD.goldFaint}`, borderRadius: 2 }} />
              <span style={noteText}>BTR</span>
              <button style={hudSmallBtn(HUD.gold, busy || thrDraft == null)} disabled={busy || thrDraft == null}
                onClick={() => { const v = Number(thrDraft); if (!Number.isFinite(v) || v < 0) return; run(() => onSetThreshold(v).then(() => setThrDraft(null)), `✔ crew orders set: keep ≥ ${fmtBtr(v)}`); }}>Set</button>
            </div>
            {onSetOrders && [
              ["salvage", "LATERAL EXTRACT", "take a neighbour's passed layer at or above your line, for 1 charge. Neighbours with the order take turns — longest wait goes first."],
              ["autopilot", "AUTO-PILOT", "once you can afford every layer left in your column, the crew keeps each wet one as it comes up, above your line or not. Dry layers still pass free. Off = ORDERS: the crew follows your line on every layer, and runs lateral extract if it's on. Nothing more."],
              ["caseOnHeat", "CASE ON HEAT", "when a core reads HIGH (a hot cell directly below) and a casing string is on the rig, the crew drills the next layer behind steel. Hell never breaches; a motherlode is cased off. Off = you arm the casing yourself."],
            ].map(([key, name, desc]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "0.4rem 0", borderTop: `1px solid ${HUD.goldFaint}`, marginTop: "0.4rem" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...meta, color: orders?.[key] ? HUD.gold : HUD.cream }}>{name} · {orders?.[key] ? "ON" : "OFF"}</div>
                  <div style={noteText}>{desc}</div>
                </div>
                <button style={hudSmallBtn(orders?.[key] ? HUD.red : HUD.gold, busy)} disabled={busy}
                  onClick={() => run(() => onSetOrders({ [key]: !orders?.[key] }), `✔ ${name.toLowerCase()} ${orders?.[key] ? "off" : "on"}`)}>
                  {orders?.[key] ? "Turn off" : "Turn on"}
                </button>
              </div>
            ))}
          </div>
        )}
      </HudPanel>
    </div>
  );
}
