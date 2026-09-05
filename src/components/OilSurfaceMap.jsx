"use client";

// Paraboleum — neutral when empty, iridescent opal cyan as density climbs
// (matches the cyan gusher beam + tank liquid).
function getSurfaceColor(value, maxValue, dark) {
  if (value === 0) return dark ? "#101e22" : "#dfe9ea";
  const t = Math.min(value / maxValue, 1);
  if (dark) {
    // dark slate-teal → teal → bright cyan
    if (t < 0.3) return `rgb(${Math.round(30 + t * 25)}, ${Math.round(78 + t * 120)}, ${Math.round(88 + t * 125)})`;
    if (t < 0.6) return `rgb(${Math.round(38 + t * 30)}, ${Math.round(158 + t * 88)}, ${Math.round(170 + t * 82)})`;
    return `rgb(${Math.round(60 + t * 56)}, ${Math.round(220 + t * 38)}, ${Math.round(222 + t * 33)})`;
  }
  // light: pale cyan-grey → deep teal
  if (t < 0.3) return `rgb(${Math.round(196 - t * 120)}, ${Math.round(220 - t * 28)}, ${Math.round(224 - t * 30)})`;
  if (t < 0.6) return `rgb(${Math.round(96 - t * 54)}, ${Math.round(184 - t * 30)}, ${Math.round(192 - t * 34)})`;
  return `rgb(${Math.round(34 - t * 14)}, ${Math.round(150 - t * 55)}, ${Math.round(168 - t * 60)})`;
}

export default function OilSurfaceMap({
  claimTotals,
  maxClaimTotal,
  selectedClaimIndex,
  onSelectClaim,
  theme,
  // { col, row } of the summoner's plot while a demon is loose: every other
  // plot dims (the field-wide blockade, made visible where the phone sees the
  // field) and the summoner's burns.
  blockade = null,
  gridX = 10,
  gridY = 10,
  allPlotsMap = {},
  claimJumpMode = false,
  onClaimJump,
  currentUserId,
  parabolum = false,
  // Row the cross-section is slicing — highlighted here so the two views agree.
  sliceY = null,
  // ── The intelligence layer (2026-09-04) ──
  hellMap = {},                // "x_y_z": true — revealed hell layers (from plot docs)
  numberOfDeposits = null,     // the seeded count, for the tally strip
  numberOfHellPockets = null,
  gusherEvents = [],           // active gusher events { col, row, tier }
  plotsWithMessages = {},      // "x_y": true
  verified = false,            // the map's seed has been revealed (provably fair)
  nowMs = null,
}) {
  // Dark-theme bgs: dark (#12161c), parabolumDark (#0c0717), hud (#0f141c).
  const dark = theme?.bg === "#12161c" || theme?.bg === "#0c0717" || theme?.bg === "#0f141c";
  const t = theme || { muted: "#9e8e78", inputBg: "#f0e8dc", borderLight: "#c8bfb0", green: "#2dd6c8", accent: "#7a5a1a" };
  // Cell fills shared by the grid and the legend beneath it.
  const dryFill = dark ? "rgba(74,88,104,0.5)" : "rgba(150,162,178,0.34)";
  const emptyFill = t.mapEmpty || (dark ? "rgba(255,255,255,0.03)" : "rgba(120,108,90,0.06)");
  const ownedBorder = dark ? "#555" : "#aaa";
  const oilGradient = `linear-gradient(90deg, ${getSurfaceColor(0.2, 1, dark)}, ${getSurfaceColor(0.6, 1, dark)}, ${getSurfaceColor(1, 1, dark)})`;
  const hellRed = dark ? "#ff5a3c" : "#d9463a";
  const now = nowMs ?? Date.now();
  const toMs = (v) => (v == null ? null : typeof v === "number" ? v : typeof v.toMillis === "function" ? v.toMillis() : typeof v.seconds === "number" ? v.seconds * 1000 : v instanceof Date ? v.getTime() : null);
  const RECENT_MS = 24 * 3600 * 1000;
  const plotHell = (pd) => !!pd?.hellLayers && Object.values(pd.hellLayers).some(Boolean);
  const plotCapped = (pd) => !!pd?.hellCapped && Object.values(pd.hellCapped).some(Boolean);
  const plotRecent = (pd) => { const ms = toMs(pd?.lastStrikeAt); return ms != null && now - ms < RECENT_MS; };
  const artifactCount = (pd) => (pd?.revealedArtifacts ? Object.keys(pd.revealedArtifacts).length : 0);
  const gusherByPlot = {}; for (const g of gusherEvents || []) if (g && g.col != null) gusherByPlot[`${g.col}_${g.row}`] = g;
  // tallies (real numbers: what the community has revealed vs the seeded totals)
  const tally = (() => {
    let found = 0, hell = 0, claimed = 0, dry = 0, drilled = 0;
    for (const c of claimTotals) {
      const pd = allPlotsMap[`${c.x}_${c.y}`];
      if (c.total > 0) found++;
      if (plotHell(pd)) hell++;
      if (pd?.currentOwnerId != null) claimed++;
      if (pd?.drillDay > 0) { drilled++; if (c.total === 0 && !plotHell(pd)) dry++; }
    }
    return { found, hell, claimed, dry, unexplored: claimTotals.length - drilled, plots: claimTotals.length };
  })();
  // row / column sums of revealed oil, for the margins
  const rowSum = Array.from({ length: gridY }, () => 0), colSum = Array.from({ length: gridX }, () => 0);
  for (const c of claimTotals) { rowSum[c.y] += c.total || 0; colSum[c.x] += c.total || 0; }
  const rowMax = Math.max(1, ...rowSum), colMax = Math.max(1, ...colSum);
  const barFill = dark ? "rgba(96,224,222,0.7)" : "rgba(34,150,168,0.7)";
  const ago = (ms) => { const d = Math.max(0, now - ms); const h = Math.floor(d / 3600000); if (h < 1) return `${Math.max(1, Math.floor(d / 60000))}m ago`; if (h < 48) return `${h}h ago`; return `${Math.floor(h / 24)}d ago`; };
  const selected = selectedClaimIndex != null ? claimTotals.find((c) => c.index === selectedClaimIndex) : null;
  const selPlot = selected ? allPlotsMap[`${selected.x}_${selected.y}`] : null;

  return (
    <div style={{ fontFamily: "'Share Tech Mono', 'Courier New', monospace", color: t.muted, position: "relative" }}>
      {claimJumpMode && (
        <style>{`
          @keyframes claimJumpPulse {
            0%, 100% { box-shadow: 0 0 4px rgba(212,168,84,0.3); }
            50% { box-shadow: 0 0 10px rgba(212,168,84,0.6); }
          }
        `}</style>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4, paddingLeft: 14 }}>
        <div style={{ fontSize: 10, color: t.inspectorKey || t.muted, letterSpacing: "0.08em" }}>
          {claimJumpMode ? "CLAIM JUMP \u2014 Click an open plot" : "SURVEY MAP"}
        </div>
        <span title={verified ? "The map's seed is revealed — anyone can verify every plot" : "The map is sealed to a future block — revealed when the season ends"}
          style={{ fontSize: 7, letterSpacing: "0.12em", padding: "2px 5px", borderRadius: 2, border: `1px solid ${verified ? t.green : t.borderLight}`, color: verified ? t.green : t.muted }}>
          {verified ? "SEED VERIFIED" : "SEALED"}
        </span>
      </div>
      {/* the tally strip — what the field has given up so far, against the seeded totals */}
      <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: "2px 10px", fontSize: 8, letterSpacing: "0.1em", color: t.muted, marginBottom: 6, paddingLeft: 14 }}>
        <span><b style={{ color: t.green }}>{tally.found}</b>{numberOfDeposits != null ? `/${numberOfDeposits}` : ""} DEPOSITS</span>
        <span><b style={{ color: hellRed }}>{tally.hell}</b>{numberOfHellPockets != null ? `/${numberOfHellPockets}` : ""} HELL</span>
        <span><b style={{ color: t.text || t.muted }}>{tally.claimed}</b>/{tally.plots} CLAIMED</span>
        <span><b>{tally.dry}</b> DRY</span>
        <span><b>{tally.unexplored}</b> UNEXPLORED</span>
      </div>
      {/* X axis labels along top */}
      <div style={{
        display: "grid", gridTemplateColumns: `14px repeat(${gridX}, 1fr)`,
        gap: 2, paddingRight: 8, marginBottom: 1,
      }}>
        <div style={{ width: 14 }} />
        {Array.from({ length: gridX }, (_, x) => (
          <span key={x} style={{
            fontSize: 8, color: t.muted, textAlign: "center", lineHeight: 1,
            display: "flex", alignItems: "center", justifyContent: "center", flex: 1,
          }}>{x + 1}</span>
        ))}
      </div>
      <div style={{ display: "flex" }}>
        {/* Y axis labels */}
        <div style={{
          display: "flex", flexDirection: "column", gap: 2,
          paddingTop: 8, paddingBottom: 8, width: 14, flexShrink: 0,
        }}>
          {Array.from({ length: gridY }, (_, i) => {
            const y = gridY - 1 - i;
            return (
              <span key={y} style={{
                fontSize: 8, color: sliceY === y ? t.green : t.muted, fontWeight: sliceY === y ? 700 : 400, textAlign: "center", lineHeight: 1,
                display: "flex", alignItems: "center", justifyContent: "center", flex: 1,
              }}>{y + 1}</span>
            );
          })}
        </div>
        {blockade && (
          <div style={{
            padding: "5px 8px", marginBottom: 4, textAlign: "center",
            fontSize: 10, letterSpacing: "0.18em", fontWeight: 700, color: "#ff4422",
            background: "rgba(140,10,0,0.18)", border: "1px solid rgba(255,34,0,0.45)", borderRadius: 4,
            animation: "demonBannerPulse 2s ease-in-out infinite",
          }}>
            ALL RIGS HALTED — DEMON LOOSE
          </div>
        )}
        <div style={{
          display: "grid", gridTemplateColumns: `repeat(${gridX}, 1fr)`,
          gap: 2, padding: 8,
          background: t.mapBg || t.inputBg, border: `1px solid ${t.borderLight}`, flex: 1,
        }}>
          {claimTotals.map((claim, i) => {
            const plotKey = `${claim.x}_${claim.y}`;
            const isSummonerPlot = !!blockade && blockade.col === claim.x && blockade.row === claim.y;
            const halted = !!blockade && !isSummonerPlot;
            const plotData = allPlotsMap[plotKey];
            const isOwned = plotData?.currentOwnerId != null;
            const isMine = !!currentUserId && plotData?.currentOwnerId === currentUserId;
            const isUnclaimed = !isOwned;
            const hasDrillHistory = plotData?.drillDay > 0;

            // In claim jump mode, unclaimed cells are clickable targets
            const isJumpTarget = claimJumpMode && isUnclaimed;

            // Cell fill encodes SURVEY STATE (the intelligence layer) — ownership
            // moves to the border below. Priority: selection > jump-target >
            // discovered oil (heatmap) > surveyed-dry > unexplored. A drilled-but-
            // dry cell reads distinctly from an unexplored one, so "we checked
            // here, nothing" is legible at a glance.
            let bg;
            if (claim.index === selectedClaimIndex) {
              bg = t.selectFill || (dark ? "rgba(122,170,90,0.7)" : "rgba(90, 138, 58, 0.7)");
            } else if (isJumpTarget) {
              bg = dark ? "rgba(212,168,84,0.15)" : "rgba(212,168,84,0.12)";
            } else if (claim.total > 0) {
              bg = getSurfaceColor(claim.total, maxClaimTotal, dark, parabolum);
            } else if (hasDrillHistory) {
              bg = dryFill;
            } else {
              bg = emptyFill;
            }

            return (
              <div
                key={i}
                onClick={() => {
                  if (isJumpTarget && onClaimJump) {
                    onClaimJump(claim.x, claim.y);
                  } else {
                    onSelectClaim(claim);
                  }
                }}
                style={{
                  aspectRatio: "1",
                  background: isSummonerPlot ? "rgba(255,50,20,0.55)" : bg,
                  // Blockade: every rig but the summoner's is halted — dim them.
                  filter: halted ? "grayscale(0.75) brightness(0.55)" : undefined,
                  border: isSummonerPlot
                    ? "2px solid #ff4422"
                    : claim.index === selectedClaimIndex
                    ? `2px solid ${t.green}`
                    : isMine
                    ? `2px solid ${t.green}88`
                    : isOwned
                    ? `1px solid ${ownedBorder}`
                    : `1px solid ${t.borderLight}`,
                  // The sliced row carries a faint band so the cross-section's row reads on the map.
                  boxShadow: claim.index === selectedClaimIndex ? `0 0 8px rgba(90, 138, 58, 0.4)` : plotRecent(plotData) ? `0 0 0 2px rgba(255,190,90,0.8)` : claim.y === sliceY ? `inset 0 0 0 1px ${t.green}55` : "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  fontSize: "9px",
                  color: claim.total > 0 ? (dark ? "#e8e0d4" : "#f5efe6") : t.muted,
                  position: "relative",
                  transition: "transform 0.15s",
                  animation: isJumpTarget ? "claimJumpPulse 1.5s ease-in-out infinite" : "none",
                }}
              >
                {/* corner marks: hell (top-right, lidded when a tonic capped it), gusher (top-left), messages (bottom-left) */}
                {plotHell(plotData) && (
                  <span aria-label={plotCapped(plotData) ? "hell, capped" : "hell"} style={{ position: "absolute", top: 0, right: 0, width: 0, height: 0, borderTop: `9px solid ${hellRed}`, borderLeft: "9px solid transparent", opacity: plotCapped(plotData) ? 0.55 : 1 }} />
                )}
                {plotCapped(plotData) && <span style={{ position: "absolute", top: 1, right: 1, width: 6, height: 1.5, background: "#fff" }} />}
                {gusherByPlot[plotKey] && <span aria-label="gusher" style={{ position: "absolute", top: 0, left: 1, fontSize: 7, lineHeight: 1, color: t.green }}>▲</span>}
                {plotsWithMessages[plotKey] && <span aria-label="messages" style={{ position: "absolute", bottom: 0, left: 1, fontSize: 6, lineHeight: 1, color: t.gold || t.accent }}>✉</span>}
                {isSummonerPlot && <span aria-label="demon summoned here" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, pointerEvents: "none" }}>🔥</span>}
                {isMine ? (
                  <div style={{ fontSize: 8, fontWeight: 700, color: t.green }}>YOU</div>
                ) : isOwned ? (
                  <div style={{ fontSize: 7, color: dark ? "#888" : "#999" }}>&#9632;</div>
                ) : null}
                {/* The number drawn on a cell is its OIL amount (field units —
                    decoupled from the $ prize pool). A dry-but-drilled cell shows
                    the depth drilled as "D{n}" on a slate fill, and unexplored
                    cells are blank. */}
                {isJumpTarget ? (
                  <div style={{ fontSize: "7px", color: t.gold || t.accent, marginTop: "1px" }}>JUMP</div>
                ) : claim.total > 0 ? (
                  <div style={{ fontSize: "8px", fontWeight: 700, color: dark ? "rgba(255,255,255,0.9)" : "rgba(30,22,10,0.82)" }}>
                    {claim.total >= 1e6 ? `${(claim.total / 1e6).toFixed(1)}M` : claim.total >= 1000 ? `${(claim.total / 1000).toFixed(1)}k` : Math.round(claim.total)}
                  </div>
                ) : hasDrillHistory ? (
                  <div style={{ fontSize: "7px", color: t.muted, marginTop: "1px" }}>D{plotData.drillDay}</div>
                ) : null}
              </div>
            );
          })}
        </div>
        {/* row margin: revealed oil per row */}
        <div aria-label="oil by row" style={{ display: "flex", flexDirection: "column", gap: 2, padding: "8px 0 8px 3px", width: 10, flexShrink: 0 }}>
          {Array.from({ length: gridY }, (_, i) => { const y = gridY - 1 - i; const f = rowSum[y] / rowMax; return (
            <div key={y} title={`Row ${y + 1}: ${Math.round(rowSum[y])} BTR`} style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <div style={{ height: "60%", width: `${Math.max(f > 0 ? 15 : 0, f * 100)}%`, background: barFill, borderRadius: 1 }} />
            </div>); })}
        </div>
      </div>
      {/* column margin: revealed oil per column */}
      <div aria-label="oil by column" style={{ display: "grid", gridTemplateColumns: `repeat(${gridX}, 1fr)`, gap: 2, padding: "2px 8px 0 22px", marginRight: 13, height: 10 }}>
        {colSum.map((v, x) => { const f = v / colMax; return (
          <div key={x} title={`Column ${x + 1}: ${Math.round(v)} BTR`} style={{ display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
            <div style={{ width: "60%", height: `${Math.max(f > 0 ? 15 : 0, f * 100)}%`, background: barFill, borderRadius: 1 }} />
          </div>); })}
      </div>
      <div style={{
        fontSize: 8, color: t.muted, textAlign: "center",
        letterSpacing: "0.1em", marginTop: 2, paddingLeft: 14,
      }}>X &rarr;</div>
      <div style={{
        display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "3px 10px",
        marginTop: 4, paddingLeft: 14, fontSize: 9, letterSpacing: "0.08em",
        color: t.inspectorKey || t.muted,
      }}>
        {[
          ["BTR", { background: oilGradient }],
          ["DRY", { background: dryFill }],
          ["UNEXPLORED", { background: emptyFill, border: `1px solid ${t.borderLight}` }],
          ["YOU", { background: emptyFill, border: `2px solid ${t.green}88` }],
          ["CLAIMED", { background: emptyFill, border: `1px solid ${ownedBorder}` }],
          ["HELL", { background: emptyFill, border: `1px solid ${t.borderLight}`, position: "relative" }],
          ["GUSHER", { background: emptyFill, border: `1px solid ${t.borderLight}` }],
          ["24H", { background: emptyFill, boxShadow: "0 0 0 2px rgba(255,190,90,0.8)" }],
        ].map(([label, swatch]) => (
          <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{
              width: 10, height: 10, borderRadius: 1, flexShrink: 0, boxSizing: "border-box",
              display: "inline-flex", alignItems: "center", justifyContent: "center", ...swatch,
            }}>
              {label === "CLAIMED" && <span style={{ width: 4, height: 4, background: dark ? "#888" : "#999" }} />}
              {label === "HELL" && <span style={{ position: "absolute", top: 0, right: 0, borderTop: `6px solid ${hellRed}`, borderLeft: "6px solid transparent" }} />}
              {label === "GUSHER" && <span style={{ fontSize: 6, color: t.green, lineHeight: 1 }}>▲</span>}
            </span>
            {label}
          </span>
        ))}
      </div>
      <div style={{ fontSize: 7, color: t.muted, textAlign: "center", letterSpacing: "0.08em", marginTop: 3, paddingLeft: 14, opacity: 0.8 }}>
        cell numbers = revealed BTR · D{"{n}"} = drilled dry to depth n · bars = oil by row / column
      </div>
      {/* the selected plot, read out */}
      {selected && (() => {
        const pd = selPlot; const key = `${selected.x}_${selected.y}`;
        const owned = pd?.currentOwnerId != null; const mine = !!currentUserId && pd?.currentOwnerId === currentUserId;
        const last = toMs(pd?.lastStrikeAt); const hellZ = pd?.hellLayers ? Object.keys(pd.hellLayers).filter((z) => pd.hellLayers[z]).map((z) => Number(z) + 1) : [];
        const g = gusherByPlot[key]; const arts = artifactCount(pd); const msgs = !!plotsWithMessages[key];
        const bits = [
          `PLOT (${selected.x + 1}, ${selected.y + 1})`,
          mine ? "YOURS" : owned ? "CLAIMED" : "OPEN",
          pd?.drillDay > 0 ? `D${pd.drillDay}` : "UNDRILLED",
          selected.total > 0 ? `${Math.round(selected.total).toLocaleString()} BTR` : null,
          last != null ? `struck ${ago(last)}` : null,
          hellZ.length ? `🔥 hell at D${hellZ.join(",")}${plotCapped(pd) ? " (capped)" : ""}` : null,
          g ? `▲ ${String(g.tier || "gusher").toUpperCase()}` : null,
          arts ? `◆ ${arts} artifact${arts > 1 ? "s" : ""}` : null,
          msgs ? "✉ messages" : null,
        ].filter(Boolean);
        return <div style={{ marginTop: 6, paddingLeft: 14, fontSize: 8, letterSpacing: "0.08em", color: t.text || t.muted, textAlign: "center", lineHeight: 1.6 }}>{bits.join("  ·  ")}</div>;
      })()}
      <div style={{
        position: "absolute", left: 1, top: "50%",
        fontSize: 8, color: t.muted, letterSpacing: "0.1em",
      }}>Y &darr;</div>
    </div>
  );
}
