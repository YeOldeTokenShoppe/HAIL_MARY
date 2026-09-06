"use client";
import { INFERNAL } from "@/lib/oilVocab";

const DEPTH_Z = 20;

// Paraboleum — neutral rock when empty, iridescent opal cyan where the substance
// is present (richer = brighter cyan in dark, deeper teal in light). Matches the
// cyan gusher beam + tank liquid.
function getOilColor(value, maxValue, dark) {
  const t = Math.min(value / maxValue, 1);
  if (dark) {
    if (value === 0) return "#101e22";
    if (t < 0.15) { const p = t / 0.15; return `rgb(${Math.round(32 + p * 12)}, ${Math.round(64 + p * 34)}, ${Math.round(72 + p * 36)})`; }
    if (t < 0.35) { const p = (t - 0.15) / 0.2; return `rgb(${Math.round(44 - p * 4)}, ${Math.round(98 + p * 60)}, ${Math.round(108 + p * 55)})`; }
    if (t < 0.6)  { const p = (t - 0.35) / 0.25; return `rgb(${Math.round(43)}, ${Math.round(158 + p * 70)}, ${Math.round(168 + p * 55)})`; }
    if (t < 0.8)  { const p = (t - 0.6) / 0.2; return `rgb(${Math.round(46 + p * 44)}, ${Math.round(228 + p * 27)}, ${Math.round(222 + p * 30)})`; }
    const p = (t - 0.8) / 0.2; return `rgb(${Math.round(92 + p * 28)}, ${Math.round(244 + p * 11)}, ${Math.round(240 + p * 15)})`;
  }
  if (value === 0) return "#dfe9ea";
  if (t < 0.15) { const p = t / 0.15; return `rgb(${Math.round(208 - p * 48)}, ${Math.round(222 - p * 26)}, ${Math.round(226 - p * 28)})`; }
  if (t < 0.35) { const p = (t - 0.15) / 0.2; return `rgb(${Math.round(160 - p * 72)}, ${Math.round(196 - p * 22)}, ${Math.round(198 - p * 30)})`; }
  if (t < 0.6)  { const p = (t - 0.35) / 0.25; return `rgb(${Math.round(88 - p * 54)}, ${Math.round(174 - p * 20)}, ${Math.round(168 - p * 24)})`; }
  if (t < 0.8)  { const p = (t - 0.6) / 0.2; return `rgb(${Math.round(34 - p * 12)}, ${Math.round(154 - p * 40)}, ${Math.round(144 - p * 38)})`; }
  const p = (t - 0.8) / 0.2; return `rgb(${Math.round(22 - p * 8)}, ${Math.round(114 - p * 30)}, ${Math.round(106 - p * 30)})`;
}

export default function OilCrossSection({
  grid3D,
  maxCellValue,
  sliceY,
  selectedX,
  drillDepth,
  onSelectX,
  theme,
  gridX = 10,
  gridY = 10,
  parabolum = false,
  // When true (desktop side-by-side column), the grid flexes to fill the
  // available height instead of a fixed 280px — so it never gets clipped by a
  // short column. Mobile (tabbed) keeps the fixed height.
  fillHeight = false,
  // ── the row as a race (2026-09-04) ──
  allPlotsMap = {},          // every rig's depth + owner in the row
  hellMap = {},              // "x_y_z": true — revealed hell layers
  gusherEvents = [],         // { col, row, tier }
  onSelectRow,               // row picker (◀ ▶)
  capDepth = null,           // the base depth cap (a dashed line)
  ownCapDepth = null,        // this player's own cap (bonus drills) — drawn on their column
  currentUserId = null,
  verified = false,
}) {
  // Dark-theme bgs: dark (#12161c), parabolumDark (#0c0717), hud (#0f141c).
  const dark = theme?.bg === "#12161c" || theme?.bg === "#0c0717" || theme?.bg === "#0f141c";
  const sliceHasData = Array.from({ length: gridX }, (_, x) => grid3D[x]?.[sliceY] || []).some((col) => col.some((v) => v > 0));
  const hellRed = dark ? "#8c2419" : "#d9463a";
  const rowPlots = Array.from({ length: gridX }, (_, x) => allPlotsMap[`${x}_${sliceY}`] || null);
  const rigsInRow = rowPlots.filter((p) => p?.currentOwnerId != null).length;
  const gusherAt = {}; for (const g of gusherEvents || []) if (g && g.row === sliceY) gusherAt[g.col] = g;
  const stepRow = (d) => onSelectRow?.(((sliceY + d) % gridY + gridY) % gridY);
  const t = theme || { text: "#5a4e3e", muted: "#9e8e78", inputBg: "#f0e8dc", borderLight: "#c8bfb0", accent: "#7a5a1a", gold: "#d4a854", goldBorder: "#b8922e", textStrong: "#3e2e10", inspectorKey: "#8b7d6b", seedLabel: "#8b7355" };

  return (
    <div style={{ fontFamily: "'Share Tech Mono', 'Courier New', monospace", color: t.text, ...(fillHeight ? { height: "100%", display: "flex", flexDirection: "column", minHeight: 0 } : {}) }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 6, fontSize: 10, color: t.inspectorKey || t.muted, letterSpacing: "0.08em" }}>
        {onSelectRow && <button type="button" aria-label="Previous row" onClick={() => stepRow(-1)} style={{ background: "transparent", border: `1px solid ${t.borderLight}`, color: t.muted, borderRadius: 2, padding: "1px 6px", cursor: "pointer", fontSize: 9 }}>◀</button>}
        <span>CROSS-SECTION &mdash; {selectedX !== null ? `Plot (${selectedX + 1}, ${sliceY + 1}) · ` : ""}Row {sliceY + 1}</span>
        {onSelectRow && <button type="button" aria-label="Next row" onClick={() => stepRow(1)} style={{ background: "transparent", border: `1px solid ${t.borderLight}`, color: t.muted, borderRadius: 2, padding: "1px 6px", cursor: "pointer", fontSize: 9 }}>▶</button>}
        <span title={verified ? "Seed revealed — every layer is verifiable" : "Map sealed until the season ends"} style={{ fontSize: 7, letterSpacing: "0.12em", padding: "2px 5px", borderRadius: 2, border: `1px solid ${verified ? t.green : t.borderLight}`, color: verified ? t.green : t.muted }}>{verified ? "VERIFIED" : "SEALED"}</span>
      </div>
      {/* who is in this row: owner tags and gusher marks over each column */}
      <div style={{ marginLeft: 28, display: "grid", gridTemplateColumns: `repeat(${gridX}, 1fr)`, height: 12, marginBottom: 1 }}>
        {rowPlots.map((p, x) => { const owned = p?.currentOwnerId != null; const mine = !!currentUserId && p?.currentOwnerId === currentUserId; return (
          <div key={x} style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 2, fontSize: 7, lineHeight: 1, color: mine ? t.green : t.muted }}>
            {gusherAt[x] && <span title={`gusher · ${gusherAt[x].tier || ""}`} style={{ color: t.green }}>▲</span>}
            {owned && <span title={mine ? "your rig" : "claimed"} style={{ fontWeight: mine ? 700 : 400 }}>{mine ? "YOU" : "■"}</span>}
          </div>); })}
      </div>

      <div style={{
        position: "relative",
        border: `1px solid ${t.borderLight}`,
        background: t.mapBg || t.inputBg,
        marginLeft: 28,
        // Capped so the slice never becomes the tallest thing on screen; the
        // column's spare height stays with the survey map above.
        ...(fillHeight ? { flex: 1, minHeight: 120, maxHeight: 380 } : {}),
      }}>
        <div style={{
          position: "absolute", left: -28, top: 0, height: "100%",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "4px 0",
        }}>
          {[1, 5, 10, 15, 20].map(d => (
            <div key={d} style={{ fontSize: 8, color: t.muted, lineHeight: 1 }}>D{d}</div>
          ))}
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${gridX}, 1fr)`,
          gridTemplateRows: `repeat(${DEPTH_Z}, 1fr)`,
          height: fillHeight ? "100%" : 280,
          minHeight: 0,
          cursor: "crosshair",
          gap: dark ? "0 1px" : 0,
          background: dark ? "#333" : "transparent",
        }}>
          {Array.from({ length: DEPTH_Z }, (_, z) =>
            Array.from({ length: gridX }, (_, x) => {
              const value = grid3D[x][sliceY][z];
              const isSelected = x === selectedX;
              const plot = rowPlots[x]; const owned = plot?.currentOwnerId != null; const mine = !!currentUserId && plot?.currentOwnerId === currentUserId;
              const rigDepth = isSelected ? drillDepth : (plot?.drillDay || 0);
              const isDrilledCell = owned || isSelected ? z < rigDepth : false;
              const isHell = !!hellMap[`${x}_${sliceY}_${z}`];
              const isCapped = isHell && !!plot?.hellCapped?.[z];
              const capHere = capDepth != null && z === capDepth;
              const ownCapHere = ownCapDepth != null && mine && z === ownCapDepth && ownCapDepth !== capDepth;
              // Match the surface-view selection highlight (green) so the two
              // views read as the same selection.
              const selectBorder = t.green || "#2f8f8f";
              // Tint selected column so it's visible even when all values are 0
              const baseBg = isHell ? hellRed : (value === 0 && t.mapEmpty)
                ? t.mapEmpty
                : getOilColor(value, maxCellValue, dark, parabolum);
              const selectedTint = isSelected && value === 0
                ? (t.selectOverlay || (dark ? "rgba(122,170,90,0.1)" : "rgba(90,138,58,0.1)"))
                : baseBg;
              return (
                <div
                  key={`${x}-${z}`}
                  onClick={() => onSelectX(x)}
                  style={{
                    background: value === 0 && isSelected ? selectedTint : baseBg,
                    borderLeft: isSelected ? `2px solid ${selectBorder}` : "none",
                    borderRight: isSelected ? `2px solid ${selectBorder}` : "none",
                    borderTop: isSelected && z === 0 ? `2px solid ${selectBorder}` : isCapped ? "2px solid #fff" : capHere ? `1px dashed ${t.gold || t.accent}` : ownCapHere ? `1px dashed ${selectBorder}` : "none",
                    borderBottom: isSelected && z === DEPTH_Z - 1 ? `2px solid ${selectBorder}` : "none",
                    position: "relative",
                    boxSizing: "border-box",
                  }}
                >
                  {isSelected && (
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      background: t.selectOverlay || (dark ? "rgba(122,170,90,0.18)" : "rgba(90,138,58,0.16)"),
                      pointerEvents: "none",
                    }} />
                  )}
                  {isDrilledCell && (() => { const h = isSelected ? (t.selectHatch || (dark ? "rgba(122,170,90,0.35)" : "rgba(90,138,58,0.3)")) : (dark ? "rgba(200,200,200,0.16)" : "rgba(60,60,60,0.14)"); return (
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      background: `repeating-linear-gradient(45deg, transparent, transparent 2px, ${h} 2px, ${h} 4px)`,
                      pointerEvents: "none",
                    }} />
                  ); })()}
                  {/* every rig's bit: a marker at its depth */}
                  {!isSelected && owned && z === rigDepth && rigDepth > 0 && rigDepth < DEPTH_Z && (
                    <div style={{ position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)", color: mine ? selectBorder : t.muted, fontSize: 7, lineHeight: 1 }}>▾</div>
                  )}
                  {capHere && x === gridX - 1 && (
                    <div style={{ position: "absolute", right: 1, top: 0, fontSize: 6, lineHeight: 1, color: t.gold || t.accent, letterSpacing: "0.06em" }}>CAP</div>
                  )}
                  {isSelected && z === drillDepth && drillDepth > 0 && drillDepth < DEPTH_Z && (
                    <div style={{
                      position: "absolute",
                      bottom: 0,
                      left: "50%",
                      transform: "translateX(-50%)",
                      color: selectBorder,
                      fontSize: "8px",
                      lineHeight: 1,
                    }}>V</div>
                  )}
                </div>
              );
            })
          )}
        </div>
        {/* Players only see layers the community has revealed — say so instead
            of showing an unlabeled empty grid. */}
        {!sliceHasData && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none", padding: "0 28px", textAlign: "center",
            fontSize: 10, lineHeight: 1.5, letterSpacing: "0.06em", color: t.muted,
          }}>
            No strikes on row {sliceY + 1} yet{rigsInRow ? ` — ${rigsInRow} rig${rigsInRow > 1 ? "s" : ""} drilling` : ""}. Layers appear here as rigs hit.
          </div>
        )}
      </div>

      {/* X-axis labels + position — moved OUTSIDE the bordered grid box so the
          fill-height grid can take 100% of the box without overlapping them.
          marginLeft 28 matches the box's offset (for the depth labels). */}
      <div style={{ marginLeft: 28 }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: `repeat(${gridX}, 1fr)`,
          padding: "3px 0", fontSize: 8, color: t.muted, textAlign: "center",
        }}>
          {Array.from({ length: gridX }, (_, x) => (
            <span key={x}>{x + 1}</span>
          ))}
        </div>
        <div style={{
          fontSize: 8, color: t.muted, textAlign: "center",
          letterSpacing: "0.1em", paddingBottom: 2,
        }}>X position &rarr;</div>
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 6, marginTop: 6, fontSize: 8, color: t.inspectorKey || t.muted,
        letterSpacing: "0.1em",
      }}>
        <span>0</span>
        <div style={{ display: "flex", height: 6, width: 120, borderRadius: 1, overflow: "hidden" }}>
          {Array.from({ length: 30 }, (_, i) => (
            <div key={i} style={{
              flex: 1,
              background: getOilColor((i / 30) * maxCellValue, maxCellValue, dark, parabolum),
            }} />
          ))}
        </div>
        <span>{Math.round(maxCellValue || 0).toLocaleString()} BTR</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, marginLeft: 6 }}><span style={{ width: 8, height: 8, background: hellRed, borderRadius: 1 }} />{INFERNAL.plural}</span>
        {capDepth != null && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><span style={{ width: 10, borderTop: `1px dashed ${t.gold || t.accent}` }} />CAP D{capDepth}</span>}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><span>▾</span>RIG DEPTH</span>
      </div>
    </div>
  );
}
