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
}) {
  // Dark-theme bgs: dark (#12161c), parabolumDark (#0c0717), hud (#0f141c).
  const dark = theme?.bg === "#12161c" || theme?.bg === "#0c0717" || theme?.bg === "#0f141c";
  const t = theme || { muted: "#9e8e78", inputBg: "#f0e8dc", borderLight: "#c8bfb0", green: "#2dd6c8", accent: "#7a5a1a" };
  // Cell fills shared by the grid and the legend beneath it.
  const dryFill = dark ? "rgba(74,88,104,0.5)" : "rgba(150,162,178,0.34)";
  const emptyFill = t.mapEmpty || (dark ? "rgba(255,255,255,0.03)" : "rgba(120,108,90,0.06)");
  const ownedBorder = dark ? "#555" : "#aaa";
  const oilGradient = `linear-gradient(90deg, ${getSurfaceColor(0.2, 1, dark)}, ${getSurfaceColor(0.6, 1, dark)}, ${getSurfaceColor(1, 1, dark)})`;

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
      <div style={{
        fontSize: 10, color: t.inspectorKey || t.muted, marginBottom: 8,
        textAlign: "center", letterSpacing: "0.08em",
      }}>
        {claimJumpMode ? "CLAIM JUMP \u2014 Click an open plot" : "SURVEY MAP"}
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
                  boxShadow: claim.index === selectedClaimIndex ? `0 0 8px rgba(90, 138, 58, 0.4)` : claim.y === sliceY ? `inset 0 0 0 1px ${t.green}55` : "none",
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
        ].map(([label, swatch]) => (
          <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{
              width: 10, height: 10, borderRadius: 1, flexShrink: 0, boxSizing: "border-box",
              display: "inline-flex", alignItems: "center", justifyContent: "center", ...swatch,
            }}>
              {label === "CLAIMED" && <span style={{ width: 4, height: 4, background: dark ? "#888" : "#999" }} />}
            </span>
            {label}
          </span>
        ))}
      </div>
      <div style={{
        position: "absolute", left: 1, top: "50%",
        fontSize: 8, color: t.muted, letterSpacing: "0.1em",
      }}>Y &darr;</div>
    </div>
  );
}
