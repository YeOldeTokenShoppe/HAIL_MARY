"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  db,
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from "@/lib/firebaseClient";
import { Timestamp } from "firebase/firestore";

export default function OilPlotDraft({
  theme,
  darkMode,
  isMobile,
  user,
  isAdmin,
  gridSize,
  saveGameSettings,
}) {
  const [tickets, setTickets] = useState([]);
  const [settings, setSettings] = useState({});
  const [countdown, setCountdown] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState(null);
  const [skipping, setSkipping] = useState(false);
  const intervalRef = useRef(null);

  // Subscribe to tickets
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "oilTickets"), orderBy("purchaseOrder", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setTickets(list);
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

  const currentPickOrder = settings.currentPickOrder || 1;
  const pickDeadline = settings.pickDeadline;
  const totalTickets = tickets.length;

  // How many have already picked
  const pickedCount = useMemo(
    () => tickets.filter((t) => t.plotCol != null).length,
    [tickets]
  );

  // Current picker ticket
  const currentPicker = useMemo(
    () => tickets.find((t) => t.purchaseOrder === currentPickOrder),
    [tickets, currentPickOrder]
  );

  // Is it current user's turn?
  const isMyTurn = useMemo(
    () => user && currentPicker?.userId === user.id,
    [user, currentPicker]
  );

  // Taken plots set
  const takenPlots = useMemo(() => {
    const map = {};
    tickets.forEach((t) => {
      if (t.plotCol != null) {
        map[`${t.plotCol},${t.plotRow}`] = t;
      }
    });
    return map;
  }, [tickets]);

  // My ticket
  const myTicket = useMemo(
    () => user && tickets.find((t) => t.userId === user.id),
    [user, tickets]
  );

  // Countdown timer
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!pickDeadline) {
      setCountdown("");
      return;
    }

    const update = () => {
      const deadline = pickDeadline.toDate ? pickDeadline.toDate() : new Date(pickDeadline);
      const diff = deadline.getTime() - Date.now();
      if (diff <= 0) {
        setCountdown("TIME'S UP");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}h ${m}m ${s}s`);
    };

    update();
    intervalRef.current = setInterval(update, 1000);
    return () => clearInterval(intervalRef.current);
  }, [pickDeadline]);

  // Claim a plot
  const handleClaimPlot = useCallback(
    async (col, row) => {
      if (!user || !isMyTurn || !myTicket) return;
      setClaiming(true);
      setError(null);
      try {
        // Update ticket with plot selection
        const ticketRef = doc(db, "oilTickets", myTicket.id);
        await updateDoc(ticketRef, {
          plotCol: col,
          plotRow: row,
          pickedAt: serverTimestamp(),
        });

        // Advance pick order + set new deadline
        const pickWindowMinutes = settings.pickWindowMinutes || 120;
        const newDeadline = Timestamp.fromDate(
          new Date(Date.now() + pickWindowMinutes * 60 * 1000)
        );
        await saveGameSettings({
          currentPickOrder: currentPickOrder + 1,
          pickDeadline: newDeadline,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setClaiming(false);
      }
    },
    [user, isMyTurn, myTicket, currentPickOrder, settings.pickWindowMinutes, saveGameSettings]
  );

  // Admin: skip current picker
  const handleSkip = useCallback(async () => {
    setSkipping(true);
    setError(null);
    try {
      const adminPassword = localStorage.getItem("oil_admin_password") || "";
      const res = await fetch("/api/oil-draft-skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (err) {
      setError(err.message);
    } finally {
      setSkipping(false);
    }
  }, []);

  // Admin: start game
  const handleStartGame = useCallback(async () => {
    await saveGameSettings({ gamePhase: "active" });
  }, [saveGameSettings]);

  const allPicked = currentPickOrder > totalTickets;
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
            {pickedCount} / {totalTickets}
          </div>
          <div style={s.progressLabel}>PLOTS PICKED</div>
        </div>

        {/* Current picker info */}
        {!allPicked && currentPicker && (
          <div style={s.pickerCard}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              {currentPicker.clerkAvatar && (
                <img
                  src={currentPicker.clerkAvatar}
                  alt=""
                  style={{ width: 32, height: 32, borderRadius: 16 }}
                />
              )}
              <div>
                <div style={{ fontSize: 14, color: theme.textStrong, fontWeight: 700 }}>
                  {currentPicker.clerkName || "Anonymous"}
                </div>
                <div style={{ fontSize: 10, color: theme.muted }}>
                  PICK #{currentPicker.purchaseOrder}
                </div>
              </div>
              {countdown && (
                <div
                  style={{
                    marginLeft: "auto",
                    fontSize: 16,
                    fontWeight: 700,
                    color: countdown === "TIME'S UP" ? theme.red : theme.gold,
                    letterSpacing: "0.05em",
                  }}
                >
                  {countdown}
                </div>
              )}
            </div>
            {isMyTurn && (
              <div style={{ fontSize: 12, color: theme.green, fontWeight: 700 }}>
                IT&apos;S YOUR TURN — CLICK A PLOT BELOW
              </div>
            )}
            {!isMyTurn && user && myTicket && !myTicket.plotCol && (
              <div style={{ fontSize: 11, color: theme.muted }}>
                Waiting for your turn (you are #{myTicket.purchaseOrder})
              </div>
            )}
          </div>
        )}

        {allPicked && (
          <div style={{ ...s.pickerCard, textAlign: "center" }}>
            <div style={{ fontSize: 14, color: theme.green, fontWeight: 700 }}>
              ALL TICKET HOLDERS HAVE PICKED
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
              const canPick = isMyTurn && !taken && !claiming;

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
                      ? `${taken.clerkName} (#${taken.purchaseOrder})`
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
                        #{taken.purchaseOrder}
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
              <button
                onClick={handleSkip}
                disabled={skipping || allPicked}
                style={{
                  ...s.adminBtn,
                  opacity: skipping || allPicked ? 0.5 : 1,
                }}
              >
                {skipping ? "SKIPPING..." : "SKIP CURRENT PICKER"}
              </button>
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
