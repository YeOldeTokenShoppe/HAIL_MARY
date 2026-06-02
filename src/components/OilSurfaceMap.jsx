"use client";

// Paraboleum — neutral when empty, phosphorescent green as density climbs.
function getSurfaceColor(value, maxValue, dark) {
  if (value === 0) return dark ? "#1a241e" : "#e2e8e2";
  const t = Math.min(value / maxValue, 1);
  if (dark) {
    // dark slate-green → green → neon green
    if (t < 0.3) return `rgb(${Math.round(40 + t * 30)}, ${Math.round(70 + t * 120)}, ${Math.round(52 + t * 40)})`;
    if (t < 0.6) return `rgb(${Math.round(46 + t * 40)}, ${Math.round(150 + t * 90)}, ${Math.round(70 + t * 50)})`;
    return `rgb(${Math.round(70 + t * 60)}, ${Math.round(215 + t * 40)}, ${Math.round(110 + t * 50)})`;
  }
  // light: pale green-grey → deep green
  if (t < 0.3) return `rgb(${Math.round(200 - t * 120)}, ${Math.round(216 - t * 40)}, ${Math.round(202 - t * 100)})`;
  if (t < 0.6) return `rgb(${Math.round(110 - t * 60)}, ${Math.round(180 - t * 30)}, ${Math.round(120 - t * 60)})`;
  return `rgb(${Math.round(40 - t * 20)}, ${Math.round(150 - t * 60)}, ${Math.round(70 - t * 30)})`;
}

export default function OilSurfaceMap({
  claimTotals,
  maxClaimTotal,
  selectedClaimIndex,
  onSelectClaim,
  theme,
  gridX = 10,
  gridY = 10,
  allPlotsMap = {},
  claimJumpMode = false,
  onClaimJump,
  currentUserId,
  parabolum = false,
}) {
  // Dark-theme bgs: dark (#12161c), parabolumDark (#0c0717), hud (#0f141c).
  const dark = theme?.bg === "#12161c" || theme?.bg === "#0c0717" || theme?.bg === "#0f141c";
  const t = theme || { muted: "#9e8e78", inputBg: "#f0e8dc", borderLight: "#c8bfb0", green: "#5a8a3a", accent: "#7a5a1a" };

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
        fontSize: 9, color: t.inspectorKey || t.muted, marginBottom: 8,
        textAlign: "center", letterSpacing: "0.08em",
      }}>
        {claimJumpMode ? "CLAIM JUMP \u2014 Click an unclaimed cell" : "SURFACE VIEW \u2014 Total oil per claim"}
      </div>
      {/* X axis labels along top */}
      <div style={{
        display: "grid", gridTemplateColumns: `14px repeat(${gridX}, 1fr)`,
        gap: 2, paddingRight: 8, marginBottom: 1,
      }}>
        <div style={{ width: 14 }} />
        {Array.from({ length: gridX }, (_, x) => (
          <span key={x} style={{
            fontSize: 7, color: t.muted, textAlign: "center", lineHeight: 1,
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
                fontSize: 7, color: t.muted, textAlign: "center", lineHeight: 1,
                display: "flex", alignItems: "center", justifyContent: "center", flex: 1,
              }}>{y + 1}</span>
            );
          })}
        </div>
        <div style={{
          display: "grid", gridTemplateColumns: `repeat(${gridX}, 1fr)`,
          gap: 2, padding: 8,
          background: t.mapBg || t.inputBg, border: `1px solid ${t.borderLight}`, flex: 1,
        }}>
          {claimTotals.map((claim, i) => {
            const plotKey = `${claim.x}_${claim.y}`;
            const plotData = allPlotsMap[plotKey];
            const isOwned = plotData?.currentOwnerId != null;
            const isMine = !!currentUserId && plotData?.currentOwnerId === currentUserId;
            const isDQ = plotData?.disqualified && !isOwned;
            const isUnclaimed = !isOwned;
            const hasDrillHistory = plotData?.drillDay > 0;

            // In claim jump mode, unclaimed cells are clickable targets
            const isJumpTarget = claimJumpMode && isUnclaimed;

            // Determine cell background
            let bg;
            if (claim.index === selectedClaimIndex) {
              bg = t.selectFill || (dark ? "rgba(122,170,90,0.7)" : "rgba(90, 138, 58, 0.7)");
            } else if (isMine) {
              bg = dark ? "rgba(90,138,58,0.3)" : "rgba(90,138,58,0.2)";
            } else if (isOwned) {
              bg = dark ? "rgba(100,100,120,0.3)" : "rgba(130,130,140,0.2)";
            } else if (isDQ && hasDrillHistory) {
              bg = dark ? "rgba(180,140,60,0.2)" : "rgba(180,140,60,0.15)";
            } else if (isJumpTarget) {
              bg = dark ? "rgba(212,168,84,0.15)" : "rgba(212,168,84,0.12)";
            } else if (claim.total === 0 && t.mapEmpty) {
              bg = t.mapEmpty;
            } else {
              bg = getSurfaceColor(claim.total, maxClaimTotal, dark, parabolum);
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
                  background: bg,
                  border: claim.index === selectedClaimIndex
                    ? `2px solid ${t.green}`
                    : isMine
                    ? `2px solid ${t.green}88`
                    : isOwned
                    ? `1px solid ${dark ? "#555" : "#aaa"}`
                    : `1px solid ${t.borderLight}`,
                  boxShadow: claim.index === selectedClaimIndex ? `0 0 8px rgba(90, 138, 58, 0.4)` : "none",
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
                {isMine ? (
                  <div style={{ fontSize: 8, fontWeight: 700, color: t.green }}>YOU</div>
                ) : isOwned ? (
                  <div style={{ fontSize: 7, color: dark ? "#888" : "#999" }}>&#9632;</div>
                ) : (
                  <div style={{ fontWeight: "bold" }}>{claim.index + 1}</div>
                )}
                {isJumpTarget && (
                  <div style={{ fontSize: "6px", color: t.gold || t.accent, marginTop: "1px" }}>JUMP</div>
                )}
                {!isJumpTarget && claim.total > 0 && !isOwned && (
                  <div style={{ fontSize: "7px", color: "rgba(255,255,255,0.7)", marginTop: "1px" }}>
                    {(claim.total / 1000).toFixed(1)}k
                  </div>
                )}
                {isDQ && hasDrillHistory && (
                  <div style={{ fontSize: "6px", color: t.warn || "#cc7755" }}>D{plotData.drillDay}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{
        fontSize: 7, color: t.muted, textAlign: "center",
        letterSpacing: "0.1em", marginTop: 2, paddingLeft: 14,
      }}>X &rarr;</div>
      <div style={{
        position: "absolute", left: 1, top: "50%",
        fontSize: 7, color: t.muted, letterSpacing: "0.1em",
      }}>Y &darr;</div>
    </div>
  );
}
