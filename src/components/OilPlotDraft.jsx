"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  db,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "@/lib/firebaseClient";

export default function OilPlotDraft({
  theme,
  darkMode,
  isMobile,
  user,
  isAdmin,
  gridSize,
  saveGameSettings,
}) {
  const [players, setPlayers] = useState([]);
  const [settings, setSettings] = useState({});
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState(null);

  // Subscribe to qualified players
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "oilQualified"), where("qualified", "==", true));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setPlayers(list);
    });
    return () => unsub();
  }, []);

  // Subscribe to settings for live draft state
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, "oilGame", "settings"), (snap) => {
      if (snap.exists()) setSettings(snap.data());
    });
    return () => unsub();
  }, []);

  const totalPlayers = players.length;

  // How many have already picked
  const pickedCount = useMemo(
    () => players.filter((p) => p.plotCol != null).length,
    [players]
  );

  // Taken plots set
  const takenPlots = useMemo(() => {
    const map = {};
    players.forEach((p) => {
      if (p.plotCol != null) {
        map[`${p.plotCol},${p.plotRow}`] = p;
      }
    });
    return map;
  }, [players]);

  // My player record
  const myPlayer = useMemo(
    () => user && players.find((p) => p.userId === user.id),
    [user, players]
  );

  // Can I pick? (first-come-first-served: any qualified player who hasn't picked yet)
  const canPickPlot = useMemo(
    () => user && myPlayer && myPlayer.plotCol == null,
    [user, myPlayer]
  );

  const allPicked = pickedCount >= totalPlayers;

  // Claim a plot (first-come-first-served)
  const handleClaimPlot = useCallback(
    async (col, row) => {
      if (!user || !myPlayer || myPlayer.plotCol != null) return;
      setClaiming(true);
      setError(null);
      try {
        // Update qualified player doc with plot selection
        const playerRef = doc(db, "oilQualified", user.id);
        await updateDoc(playerRef, {
          plotCol: col,
          plotRow: row,
          pickedAt: serverTimestamp(),
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setClaiming(false);
      }
    },
    [user, myPlayer]
  );

  // Admin: start game
  const handleStartGame = useCallback(async () => {
    await saveGameSettings({ gamePhase: "active" });
  }, [saveGameSettings]);

  const s = draftStyles(theme, darkMode, isMobile);

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerInner}>
          <h1 style={s.title}>HAIL MARY PROSPECTING CO.</h1>
          <div style={s.subtitle}>LAND DRAFT</div>
        </div>
      </div>

      <div style={s.body}>
        {/* Progress */}
        <div style={s.progressCard}>
          <div style={s.progressNumber}>
            {pickedCount} / {totalPlayers}
          </div>
          <div style={s.progressLabel}>PLOTS PICKED</div>
        </div>

        {/* Player status */}
        {!allPicked && (
          <div style={s.pickerCard}>
            {canPickPlot ? (
              <div style={{ fontSize: 12, color: theme.green, fontWeight: 700 }}>
                YOU ARE QUALIFIED — CLICK A PLOT BELOW TO CLAIM IT
              </div>
            ) : myPlayer?.plotCol != null ? (
              <div style={{ fontSize: 12, color: theme.green, fontWeight: 700 }}>
                YOU PICKED PLOT ({myPlayer.plotCol}, {myPlayer.plotRow})
              </div>
            ) : !user ? (
              <div style={{ fontSize: 11, color: theme.muted }}>
                Sign in to pick your plot
              </div>
            ) : !myPlayer ? (
              <div style={{ fontSize: 11, color: theme.muted }}>
                You must be a qualified player to pick a plot
              </div>
            ) : null}
          </div>
        )}

        {allPicked && (
          <div style={{ ...s.pickerCard, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: theme.green, fontWeight: 700 }}>
              ALL PLAYERS HAVE PICKED
            </div>
            {isAdmin && (
              <div style={{ fontSize: 11, color: theme.muted, marginTop: 4 }}>
                Ready to start the game
              </div>
            )}
          </div>
        )}

        {/* Grid */}
        <div style={s.gridContainer}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
              gap: 2,
              width: "100%",
              maxWidth: isMobile ? "100%" : 500,
              margin: "0 auto",
            }}
          >
            {Array.from({ length: gridSize * gridSize }, (_, i) => {
              const col = i % gridSize;
              const row = Math.floor(i / gridSize);
              const key = `${col},${row}`;
              const taken = takenPlots[key];
              const isMine = taken && user && taken.userId === user.id;
              const canPick = canPickPlot && !taken && !claiming;

              return (
                <div
                  key={key}
                  onClick={() => canPick && handleClaimPlot(col, row)}
                  style={{
                    aspectRatio: "1",
                    border: `1px solid ${
                      isMine ? theme.green : taken ? theme.border : theme.borderLight
                    }`,
                    borderRadius: 2,
                    background: isMine
                      ? `${theme.green}22`
                      : taken
                      ? `${theme.muted}15`
                      : canPick
                      ? `${theme.gold}12`
                      : "transparent",
                    cursor: canPick ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: isMobile ? 7 : 9,
                    color: taken ? theme.muted : theme.borderLight,
                    transition: "background 0.15s",
                    position: "relative",
                  }}
                  title={
                    taken
                      ? `${taken.clerkName}`
                      : `(${col}, ${row})`
                  }
                >
                  {taken ? (
                    taken.clerkAvatar ? (
                      <img
                        src={taken.clerkAvatar}
                        alt=""
                        style={{
                          width: "70%",
                          height: "70%",
                          borderRadius: "50%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: isMobile ? 6 : 8 }}>
                        {(taken.clerkName || "?").charAt(0)}
                      </span>
                    )
                  ) : (
                    <span>
                      {col},{row}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div style={s.legend}>
          <span>
            <span style={{ ...s.legendDot, background: `${theme.gold}30` }} /> Available
          </span>
          <span>
            <span style={{ ...s.legendDot, background: `${theme.muted}30` }} /> Taken
          </span>
          <span>
            <span style={{ ...s.legendDot, background: `${theme.green}40` }} /> Yours
          </span>
        </div>

        {error && (
          <div style={{ color: theme.red, fontSize: 11, textAlign: "center", marginTop: 8 }}>
            {error}
          </div>
        )}

        {/* Admin controls */}
        {isAdmin && (
          <div style={s.adminSection}>
            <div style={s.sectionTitle}>ADMIN CONTROLS</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={handleStartGame} style={{ ...s.adminBtn, ...s.startBtn }}>
                START GAME
              </button>
            </div>

            {/* Phase override */}
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: theme.muted, marginBottom: 6 }}>
                PHASE OVERRIDE
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["ticket_sale", "grid_locked", "active", "ended"].map((phase) => (
                  <button
                    key={phase}
                    onClick={() => saveGameSettings({ gamePhase: phase })}
                    style={s.phaseBtn}
                  >
                    {phase.toUpperCase().replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function draftStyles(theme, darkMode, isMobile) {
  const mono = "'Share Tech Mono', monospace";
  return {
    container: {
      minHeight: "100vh",
      background: theme.bg,
      color: theme.text,
      fontFamily: mono,
    },
    header: {
      borderBottom: `1px solid ${theme.border}`,
      background: theme.headerBg,
      padding: isMobile ? "20px 16px" : "28px 32px",
    },
    headerInner: {
      maxWidth: 800,
      margin: "0 auto",
      textAlign: "center",
    },
    title: {
      fontSize: isMobile ? 16 : 22,
      letterSpacing: "0.2em",
      color: theme.textStrong,
      margin: 0,
      fontWeight: 700,
    },
    subtitle: {
      fontSize: isMobile ? 11 : 13,
      letterSpacing: "0.35em",
      color: theme.gold,
      marginTop: 4,
    },
    body: {
      maxWidth: 800,
      margin: "0 auto",
      padding: isMobile ? "16px" : "24px 32px",
    },
    progressCard: {
      textAlign: "center",
      padding: "20px",
      border: `1px solid ${theme.gold}44`,
      borderRadius: 4,
      background: `${theme.gold}08`,
      marginBottom: 16,
    },
    progressNumber: {
      fontSize: 36,
      fontWeight: 700,
      color: theme.gold,
      lineHeight: 1,
    },
    progressLabel: {
      fontSize: 11,
      letterSpacing: "0.2em",
      color: theme.muted,
      marginTop: 6,
    },
    pickerCard: {
      padding: 16,
      border: `1px solid ${theme.border}`,
      borderRadius: 4,
      background: theme.tintBg,
      marginBottom: 16,
    },
    gridContainer: {
      marginBottom: 16,
    },
    legend: {
      display: "flex",
      justifyContent: "center",
      gap: 16,
      fontSize: 10,
      color: theme.muted,
      marginBottom: 16,
    },
    legendDot: {
      display: "inline-block",
      width: 10,
      height: 10,
      borderRadius: 2,
      marginRight: 4,
      verticalAlign: "middle",
    },
    adminSection: {
      marginTop: 24,
      padding: 16,
      border: `1px solid rgba(160,48,48,0.3)`,
      borderRadius: 4,
      background: "rgba(160,48,48,0.04)",
    },
    sectionTitle: {
      fontSize: 10,
      letterSpacing: "0.15em",
      color: theme.muted,
      marginBottom: 12,
      borderBottom: `1px solid ${theme.border}`,
      paddingBottom: 6,
    },
    adminBtn: {
      padding: "8px 16px",
      border: `1px solid ${theme.border}`,
      borderRadius: 3,
      fontFamily: mono,
      fontSize: 11,
      cursor: "pointer",
      background: "transparent",
      color: theme.text,
      letterSpacing: "0.08em",
    },
    startBtn: {
      background: `linear-gradient(180deg, ${theme.gold}, #b8922e)`,
      border: `1px solid ${theme.goldBorder}`,
      color: "#fff",
    },
    phaseBtn: {
      padding: "4px 10px",
      border: `1px solid ${theme.border}`,
      borderRadius: 3,
      fontFamily: mono,
      fontSize: 9,
      cursor: "pointer",
      background: "transparent",
      color: theme.muted,
    },
  };
}
