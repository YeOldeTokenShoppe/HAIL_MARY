"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { SignInButton } from "@clerk/nextjs";
import { db, collection, query, orderBy, onSnapshot, doc, setDoc, getDoc, serverTimestamp } from "@/lib/firebaseClient";

const QUALIFICATION_THRESHOLD = 20; // $20 USD worth of RL80

const GRID_TARGETS = [
  { size: 6, plots: 36 },
  { size: 7, plots: 49 },
  { size: 8, plots: 64 },
  { size: 9, plots: 81 },
  { size: 10, plots: 100 },
];

export default function OilQualify({
  theme,
  darkMode,
  isMobile,
  user,
  isAdmin,
  gridSize,
  saveGameSettings,
  setGridSize,
  walletAddress,
  tokenBalance,
  isWalletConnected,
  connectWallet,
}) {
  const [players, setPlayers] = useState([]);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [adminGridSize, setAdminGridSize] = useState(gridSize);
  const [liveCheck, setLiveCheck] = useState(null);
  const [checkingLive, setCheckingLive] = useState(false);
  const [snapshotRunning, setSnapshotRunning] = useState(false);
  const [snapshotResult, setSnapshotResult] = useState(null);
  const [lastSnapshot, setLastSnapshot] = useState(null);
  const [xUsername, setXUsername] = useState("");
  const [xFollowers, setXFollowers] = useState(null); // cached follower usernames
  const [xFollowVerified, setXFollowVerified] = useState(false);
  const [xCheckingFollow, setXCheckingFollow] = useState(false);

  // Subscribe to qualified players collection
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "oilQualified"), orderBy("registeredAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setPlayers(list);
    });
    return () => unsub();
  }, []);

  // Subscribe to last snapshot
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, "oilGame", "lastSnapshot"), (snap) => {
      if (snap.exists()) setLastSnapshot(snap.data());
    });
    return () => unsub();
  }, []);

  // Load X/Twitter followers list for follow verification
  useEffect(() => {
    if (!db) return;
    getDoc(doc(db, "followers", "latest")).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        // usernames array (lowercase) added by cron
        setXFollowers(data.usernames || []);
      }
    }).catch(() => {});
  }, []);

  // Check X follow when username changes
  useEffect(() => {
    if (!xUsername.trim() || !xFollowers) {
      setXFollowVerified(false);
      return;
    }
    const clean = xUsername.trim().replace(/^@/, "").toLowerCase();
    setXFollowVerified(xFollowers.includes(clean));
  }, [xUsername, xFollowers]);

  const qualifiedPlayers = useMemo(
    () => players.filter((p) => p.qualified),
    [players]
  );

  const userRegistered = useMemo(
    () => user && players.some((p) => p.id === user.id),
    [user, players]
  );

  const userPlayer = useMemo(
    () => user && players.find((p) => p.id === user.id),
    [user, players]
  );

  const nearestTarget = useMemo(() => {
    const count = qualifiedPlayers.length;
    return GRID_TARGETS.find((g) => g.plots >= count) || GRID_TARGETS[GRID_TARGETS.length - 1];
  }, [qualifiedPlayers.length]);

  // Live qualification check when wallet connects
  useEffect(() => {
    if (!walletAddress) {
      setLiveCheck(null);
      return;
    }
    let cancelled = false;
    setCheckingLive(true);
    fetch(`/api/oil-qualify?wallet=${walletAddress}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setLiveCheck(data);
          setCheckingLive(false);
        }
      })
      .catch(() => {
        if (!cancelled) setCheckingLive(false);
      });
    return () => { cancelled = true; };
  }, [walletAddress]);

  // Register as qualified player
  const handleRegister = useCallback(async () => {
    if (!user || !walletAddress) return;
    if (!xFollowVerified) {
      setError("You must follow @rl80token on X to qualify.");
      return;
    }
    setRegistering(true);
    setError(null);
    setSuccess(null);
    try {
      await setDoc(doc(db, "oilQualified", user.id), {
        userId: user.id,
        clerkName: user.fullName || user.firstName || "Anonymous",
        clerkAvatar: user.imageUrl || null,
        walletAddress,
        xUsername: xUsername.trim().replace(/^@/, "").toLowerCase(),
        registeredAt: serverTimestamp(),
        qualified: liveCheck?.qualified || false,
        lastSnapshotBalance: liveCheck?.balance || "0",
        lastSnapshotUsdValue: liveCheck?.usdValue || 0,
        lastSnapshotAt: serverTimestamp(),
        plotCol: null,
        plotRow: null,
        pickedAt: null,
      });
      setSuccess("Registration confirmed!");
    } catch (err) {
      setError(err.message);
    } finally {
      setRegistering(false);
    }
  }, [user, walletAddress, liveCheck, xFollowVerified, xUsername]);

  // Admin: run snapshot
  const handleRunSnapshot = useCallback(async () => {
    setSnapshotRunning(true);
    setSnapshotResult(null);
    try {
      const adminPw = localStorage.getItem("oil_admin_pw") || sessionStorage.getItem("oil_admin_pw") || "";
      const res = await fetch("/api/oil-qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPassword: adminPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Snapshot failed");
      setSnapshotResult(data);
    } catch (err) {
      setSnapshotResult({ error: err.message });
    } finally {
      setSnapshotRunning(false);
    }
  }, []);

  const handleLockGrid = useCallback(async () => {
    if (!isAdmin) return;
    await saveGameSettings({
      gamePhase: "grid_locked",
      gridSize: adminGridSize,
    });
    setGridSize(adminGridSize);
  }, [isAdmin, adminGridSize, saveGameSettings, setGridSize]);

  const mono = "'Share Tech Mono', monospace";

  // Format token balance for display
  const displayBalance = tokenBalance ? Number(tokenBalance).toLocaleString() : "0";
  const usdValue = liveCheck?.usdValue ?? null;
  const isQualified = liveCheck?.qualified ?? false;
  const rl80Price = liveCheck?.price ?? null;
  const neededMore = !isQualified && usdValue != null
    ? Math.ceil((QUALIFICATION_THRESHOLD - usdValue) / (rl80Price || 1))
    : 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: theme.bg,
      color: theme.text,
      fontFamily: mono,
    }}>
      {/* Hero Header */}
      <div style={{
        borderBottom: `1px solid ${theme.border}`,
        background: theme.headerBg,
        padding: isMobile ? "32px 16px 24px" : "48px 32px 36px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative corner brackets */}
        <div style={{ position: "absolute", top: 12, left: 12, width: 20, height: 20, borderTop: `2px solid ${theme.gold}44`, borderLeft: `2px solid ${theme.gold}44` }} />
        <div style={{ position: "absolute", top: 12, right: 12, width: 20, height: 20, borderTop: `2px solid ${theme.gold}44`, borderRight: `2px solid ${theme.gold}44` }} />
        <div style={{ position: "absolute", bottom: 12, left: 12, width: 20, height: 20, borderBottom: `2px solid ${theme.gold}44`, borderLeft: `2px solid ${theme.gold}44` }} />
        <div style={{ position: "absolute", bottom: 12, right: 12, width: 20, height: 20, borderBottom: `2px solid ${theme.gold}44`, borderRight: `2px solid ${theme.gold}44` }} />

        <div style={{ fontSize: 10, letterSpacing: "0.4em", color: theme.muted, marginBottom: 8 }}>
          EST. 2026
        </div>
        <h1 style={{
          fontSize: isMobile ? 20 : 28,
          letterSpacing: "0.18em",
          color: theme.textStrong,
          margin: 0,
          fontWeight: 700,
          lineHeight: 1.2,
        }}>
          HAIL MARY<br />PROSPECTING CO.
        </h1>
        <div style={{ width: 40, height: 1, background: theme.gold, margin: "12px auto" }} />
        <div style={{
          fontSize: isMobile ? 12 : 14,
          letterSpacing: "0.35em",
          color: theme.gold,
        }}>
          PLAYER QUALIFICATION
        </div>
        <div style={{
          fontSize: 10,
          color: theme.muted,
          marginTop: 8,
          letterSpacing: "0.1em",
        }}>
          HOLD ${QUALIFICATION_THRESHOLD}+ USD OF RL80 & FOLLOW @RL80TOKEN
        </div>

        {/* Hero image */}
        <div style={{
          margin: "20px auto 0",
          maxWidth: 480,
          aspectRatio: "7 / 8",
          borderRadius: 4,
          border: `1px dashed ${theme.gold}44`,
          background: `linear-gradient(135deg, ${theme.gold}08, ${theme.gold}03)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, opacity: 0.2 }}>&#9881;</div>
            <div style={{ fontSize: 8, letterSpacing: "0.2em", color: theme.muted, marginTop: 4 }}>
              <img src="/ClaimCertificate.webp" alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
          </div>
        </div>

        {/* Sign-in / user badge */}
        <div style={{ marginTop: 20 }}>
          {!user ? (
            <SignInButton mode="modal" forceRedirectUrl="/oil">
              <button style={{
                padding: "10px 28px",
                background: `linear-gradient(180deg, ${theme.gold}, #b8922e)`,
                border: `1px solid ${theme.goldBorder}`,
                borderRadius: 3,
                color: "#fff",
                fontFamily: mono,
                fontSize: 12,
                letterSpacing: "0.15em",
                cursor: "pointer",
              }}>
                SIGN IN TO PARTICIPATE
              </button>
            </SignInButton>
          ) : (
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              border: `1px solid ${theme.border}`,
              borderRadius: 3,
              background: theme.tintBg,
            }}>
              {user.imageUrl && (
                <img src={user.imageUrl} alt="" style={{ width: 22, height: 22, borderRadius: 11 }} />
              )}
              <span style={{ fontSize: 11, color: theme.textStrong }}>
                {user.fullName || user.firstName || "Signed In"}
              </span>
              {userRegistered && (
                <span style={{
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  color: userPlayer?.qualified ? theme.green : theme.warn,
                  padding: "2px 6px",
                  background: userPlayer?.qualified ? `${theme.green}15` : `${theme.warn}15`,
                  border: `1px solid ${userPlayer?.qualified ? theme.green : theme.warn}30`,
                  borderRadius: 2,
                }}>
                  {userPlayer?.qualified ? "QUALIFIED" : "REGISTERED"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: isMobile ? "20px 16px" : "28px 32px",
      }}>
        {/* Qualified Player Counter */}
        <div style={{
          textAlign: "center",
          padding: isMobile ? "24px 16px" : "32px 20px",
          border: `1px solid ${theme.gold}33`,
          borderRadius: 4,
          background: `linear-gradient(180deg, ${theme.gold}06, ${theme.gold}02)`,
          marginBottom: 24,
        }}>
          <div style={{
            fontSize: isMobile ? 52 : 72,
            fontWeight: 700,
            color: theme.gold,
            lineHeight: 1,
          }}>
            {qualifiedPlayers.length}
          </div>
          <div style={{
            fontSize: 11,
            letterSpacing: "0.25em",
            color: theme.muted,
            marginTop: 8,
          }}>
            QUALIFIED PLAYERS
          </div>
          <div style={{
            fontSize: 10,
            color: theme.muted,
            marginTop: 4,
          }}>
            {players.length} registered total
          </div>

          {/* Grid target progress */}
          <div style={{
            display: "flex",
            gap: isMobile ? 4 : 8,
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: 16,
          }}>
            {GRID_TARGETS.map((g) => {
              const reached = qualifiedPlayers.length >= g.plots;
              const nearest = g.size === nearestTarget.size && !reached;
              const pct = Math.min(100, Math.round((qualifiedPlayers.length / g.plots) * 100));
              return (
                <div
                  key={g.size}
                  style={{
                    padding: isMobile ? "6px 8px" : "8px 14px",
                    border: `1px solid ${reached ? theme.gold : nearest ? `${theme.gold}88` : theme.border}`,
                    borderRadius: 3,
                    textAlign: "center",
                    fontFamily: mono,
                    background: reached ? `${theme.gold}18` : "transparent",
                    opacity: reached ? 1 : nearest ? 1 : 0.45,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  {!reached && nearest && (
                    <div style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      width: `${pct}%`,
                      height: 2,
                      background: theme.gold,
                    }} />
                  )}
                  <div style={{ fontSize: isMobile ? 12 : 14, fontWeight: 700, color: reached ? theme.gold : theme.textStrong }}>
                    {g.size}x{g.size}
                  </div>
                  <div style={{ fontSize: 9, color: theme.muted }}>
                    {reached ? "UNLOCKED" : `${g.plots} plots`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* How It Works */}
        <div style={{
          marginBottom: 24,
          padding: isMobile ? 16 : 20,
          border: `1px solid ${theme.border}`,
          borderRadius: 4,
          background: theme.tintBg,
        }}>
          <div style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            color: theme.muted,
            marginBottom: 14,
            paddingBottom: 6,
            borderBottom: `1px solid ${theme.border}`,
          }}>
            HOW IT WORKS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { step: "01", title: "HOLD RL80 & FOLLOW", desc: `Hold at least $${QUALIFICATION_THRESHOLD} USD worth of RL80 tokens and follow @rl80token on X.` },
              { step: "02", title: "REGISTER & GET VERIFIED", desc: "Connect your wallet, enter your X username, and register. Admin runs snapshots to verify balances." },
              { step: "03", title: "PICK YOUR PLOT", desc: "Once the grid is locked, qualified players pick their plot. First come, first served." },
              { step: "04", title: "DRILL FOR OIL", desc: "Each day you drill one layer deeper. Oil deposits are hidden underground, seeded by a verifiable block hash." },
            ].map((item) => (
              <div key={item.step} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: `${theme.gold}66`,
                  lineHeight: 1,
                  minWidth: 28,
                }}>
                  {item.step}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: theme.textStrong, marginBottom: 2 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 11, color: theme.muted, lineHeight: 1.5 }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Brochure Images */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 12,
          marginBottom: 24,
        }}>
          <div style={{
            aspectRatio: "4 / 3",
            borderRadius: 4,
            border: `1px dashed ${theme.gold}33`,
            background: `linear-gradient(160deg, ${theme.gold}06, transparent)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, opacity: 0.15 }}>&#9968;</div>
              <div style={{ fontSize: 8, letterSpacing: "0.15em", color: theme.muted, marginTop: 4 }}>
                <img src="/plotPic1.webp" alt="Oil rig at sunset" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </div>
            </div>
          </div>
          <div style={{
            aspectRatio: "4 / 3",
            borderRadius: 4,
            border: `1px dashed ${theme.gold}33`,
            background: `linear-gradient(160deg, ${theme.gold}06, transparent)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, opacity: 0.15 }}>&#9638;</div>
              <div style={{ fontSize: 8, letterSpacing: "0.15em", color: theme.muted, marginTop: 4 }}>
                <img src="/plotPic4.webp" alt="Oil rig at sunset" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Qualification Section */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            color: theme.muted,
            marginBottom: 12,
            paddingBottom: 6,
            borderBottom: `1px solid ${theme.border}`,
          }}>
            QUALIFY TO PLAY
          </div>

          {!user ? (
            <div style={{
              textAlign: "center",
              padding: "28px 16px",
              border: `1px dashed ${theme.border}`,
              borderRadius: 4,
            }}>
              <div style={{ fontSize: 12, color: theme.muted, marginBottom: 14 }}>
                Sign in to check your qualification
              </div>
              <SignInButton mode="modal" forceRedirectUrl="/oil">
                <button style={{
                  padding: "10px 28px",
                  background: `linear-gradient(180deg, ${theme.gold}, #b8922e)`,
                  border: `1px solid ${theme.goldBorder}`,
                  borderRadius: 3,
                  color: "#fff",
                  fontFamily: mono,
                  fontSize: 12,
                  letterSpacing: "0.12em",
                  cursor: "pointer",
                }}>
                  SIGN IN
                </button>
              </SignInButton>
            </div>
          ) : !isWalletConnected ? (
            <div style={{
              textAlign: "center",
              padding: "28px 16px",
              border: `1px dashed ${theme.border}`,
              borderRadius: 4,
            }}>
              <div style={{ fontSize: 12, color: theme.muted, marginBottom: 14 }}>
                Connect your wallet to check RL80 balance
              </div>
              <button
                onClick={() => connectWallet && connectWallet()}
                style={{
                  padding: "10px 28px",
                  background: `linear-gradient(180deg, ${theme.gold}, #b8922e)`,
                  border: `1px solid ${theme.goldBorder}`,
                  borderRadius: 3,
                  color: "#fff",
                  fontFamily: mono,
                  fontSize: 12,
                  letterSpacing: "0.12em",
                  cursor: "pointer",
                }}
              >
                CONNECT WALLET
              </button>
            </div>
          ) : userRegistered ? (
            <div style={{
              textAlign: "center",
              padding: "20px 16px",
              border: `1px solid ${userPlayer?.qualified ? theme.green : theme.gold}30`,
              borderRadius: 4,
              background: `${userPlayer?.qualified ? theme.green : theme.gold}08`,
            }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>
                {userPlayer?.qualified ? "\u2705" : "\u23F3"}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: userPlayer?.qualified ? theme.green : theme.gold }}>
                {userPlayer?.qualified ? "YOU ARE QUALIFIED" : "REGISTERED — AWAITING SNAPSHOT"}
              </div>
              <div style={{ fontSize: 11, color: theme.muted, marginTop: 4 }}>
                Wallet: {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
              </div>
              {userPlayer?.lastSnapshotUsdValue != null && (
                <div style={{ fontSize: 11, color: theme.muted, marginTop: 2 }}>
                  Last snapshot: ${userPlayer.lastSnapshotUsdValue.toFixed(2)} USD ({userPlayer.lastSnapshotBalance} RL80)
                </div>
              )}
            </div>
          ) : (
            <div style={{
              padding: isMobile ? 14 : 20,
              border: `1px solid ${theme.border}`,
              borderRadius: 4,
              background: theme.panelBg,
            }}>
              {/* Wallet & Balance Info */}
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 10, color: theme.gold, letterSpacing: "0.15em", marginBottom: 10, fontWeight: 700,
                }}>
                  YOUR WALLET
                </div>
                <div style={{
                  padding: 12,
                  background: theme.inputBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 3,
                  fontSize: 11,
                  color: theme.textStrong,
                  wordBreak: "break-all",
                  lineHeight: 1.5,
                }}>
                  {walletAddress}
                </div>
              </div>

              {/* Balance display */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 16,
              }}>
                <div style={{
                  padding: 12,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 3,
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 9, letterSpacing: "0.15em", color: theme.muted, marginBottom: 4 }}>
                    RL80 BALANCE
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: theme.textStrong }}>
                    {checkingLive ? "..." : displayBalance}
                  </div>
                </div>
                <div style={{
                  padding: 12,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 3,
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 9, letterSpacing: "0.15em", color: theme.muted, marginBottom: 4 }}>
                    USD VALUE
                  </div>
                  <div style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: isQualified ? theme.green : theme.textStrong,
                  }}>
                    {checkingLive ? "..." : usdValue != null ? `$${usdValue.toFixed(2)}` : "—"}
                  </div>
                </div>
              </div>

              {/* Threshold bar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 9,
                  color: theme.muted,
                  marginBottom: 4,
                }}>
                  <span>QUALIFICATION THRESHOLD</span>
                  <span>${QUALIFICATION_THRESHOLD} USD</span>
                </div>
                <div style={{
                  height: 6,
                  background: theme.barBg,
                  borderRadius: 3,
                  overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.min(100, ((usdValue || 0) / QUALIFICATION_THRESHOLD) * 100)}%`,
                    background: isQualified
                      ? `linear-gradient(90deg, ${theme.green}, ${theme.green}cc)`
                      : `linear-gradient(90deg, ${theme.gold}, ${theme.gold}cc)`,
                    borderRadius: 3,
                    transition: "width 0.5s ease",
                  }} />
                </div>
              </div>

              {/* X/Twitter Follow Requirement */}
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 10, color: theme.gold, letterSpacing: "0.15em", marginBottom: 10, fontWeight: 700,
                }}>
                  X/TWITTER — FOLLOW @RL80TOKEN
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    flex: 1,
                    padding: "0 12px",
                    background: theme.inputBg,
                    border: `1px solid ${xFollowVerified ? theme.green : theme.border}`,
                    borderRadius: 3,
                  }}>
                    <span style={{ fontSize: 12, color: theme.muted, marginRight: 2 }}>@</span>
                    <input
                      type="text"
                      placeholder="your_x_username"
                      value={xUsername}
                      onChange={(e) => setXUsername(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "10px 0",
                        background: "transparent",
                        border: "none",
                        color: theme.text,
                        fontFamily: mono,
                        fontSize: 11,
                        outline: "none",
                      }}
                    />
                  </div>
                  <a
                    href="https://x.com/rl80token"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: "10px 14px",
                      background: "transparent",
                      border: `1px solid ${theme.border}`,
                      borderRadius: 3,
                      color: theme.muted,
                      fontFamily: mono,
                      fontSize: 10,
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    FOLLOW
                  </a>
                </div>
                {xUsername.trim() && (
                  <div style={{
                    fontSize: 10,
                    marginTop: 6,
                    color: xFollowVerified ? theme.green : theme.warn,
                  }}>
                    {xFollowVerified
                      ? "Verified — you follow @rl80token"
                      : "Not found in @rl80token followers. Follow first, then check back (followers list updates periodically)."}
                  </div>
                )}
              </div>

              {isQualified && xFollowVerified ? (
                <button
                  onClick={handleRegister}
                  disabled={registering}
                  style={{
                    width: "100%",
                    padding: "12px 20px",
                    background: registering
                      ? theme.barBg
                      : `linear-gradient(180deg, ${theme.gold}, #b8922e)`,
                    border: `1px solid ${registering ? theme.border : theme.goldBorder}`,
                    borderRadius: 3,
                    color: registering ? theme.muted : "#fff",
                    fontFamily: mono,
                    fontSize: 12,
                    letterSpacing: "0.12em",
                    cursor: registering ? "default" : "pointer",
                  }}
                >
                  {registering ? "REGISTERING..." : "REGISTER AS QUALIFIED PLAYER"}
                </button>
              ) : isQualified && !xFollowVerified ? (
                <div style={{
                  textAlign: "center",
                  padding: "14px 12px",
                  border: `1px solid ${theme.warn}30`,
                  borderRadius: 3,
                  background: `${theme.warn}08`,
                }}>
                  <div style={{ fontSize: 12, color: theme.warn, fontWeight: 700, marginBottom: 4 }}>
                    FOLLOW @RL80TOKEN TO REGISTER
                  </div>
                  <div style={{ fontSize: 11, color: theme.muted }}>
                    Your RL80 balance qualifies, but you must also follow @rl80token on X
                  </div>
                </div>
              ) : (
                <div style={{
                  textAlign: "center",
                  padding: "14px 12px",
                  border: `1px solid ${theme.warn}30`,
                  borderRadius: 3,
                  background: `${theme.warn}08`,
                }}>
                  <div style={{ fontSize: 12, color: theme.warn, fontWeight: 700, marginBottom: 4 }}>
                    NOT ENOUGH RL80
                  </div>
                  <div style={{ fontSize: 11, color: theme.muted }}>
                    You need ~{neededMore.toLocaleString()} more RL80 to reach ${QUALIFICATION_THRESHOLD}
                  </div>
                  <div style={{ fontSize: 10, color: theme.muted, marginTop: 6 }}>
                    Buy RL80 on{" "}
                    <a
                      href="https://app.uniswap.org/swap?outputCurrency=0x8b6deA2eFE3043C44bA13090FBe3AD3eE0F1c644&chain=base"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: theme.gold }}
                    >
                      Uniswap
                    </a>
                  </div>
                </div>
              )}

              {error && (
                <div style={{
                  color: theme.red, fontSize: 11, marginTop: 10,
                  padding: "8px 10px", background: `${theme.red}10`, borderRadius: 3,
                }}>
                  {error}
                </div>
              )}
              {success && (
                <div style={{
                  color: theme.green, fontSize: 11, marginTop: 10,
                  padding: "8px 10px", background: `${theme.green}10`, borderRadius: 3,
                }}>
                  {success}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Game Details */}
        <div style={{
          marginBottom: 24,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 12,
        }}>
          {[
            { label: "ENTRY", value: `$${QUALIFICATION_THRESHOLD}+ RL80`, sub: "Token balance check" },
            { label: "GRID SIZE", value: `UP TO ${GRID_TARGETS[GRID_TARGETS.length - 1].size}x${GRID_TARGETS[GRID_TARGETS.length - 1].size}`, sub: "Scaled to demand" },
            { label: "DEPTH", value: "20 LAYERS", sub: "Drilled daily" },
            { label: "PRIZE POOL", value: "RL80 TOKENS", sub: "Hidden underground" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: 14,
                border: `1px solid ${theme.border}`,
                borderRadius: 3,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 9, letterSpacing: "0.2em", color: theme.muted, marginBottom: 4 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: theme.textStrong }}>
                {item.value}
              </div>
              <div style={{ fontSize: 9, color: theme.muted, marginTop: 2 }}>{item.sub}</div>
            </div>
          ))}
        </div>

        {/* Registered Players */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            color: theme.muted,
            marginBottom: 12,
            paddingBottom: 6,
            borderBottom: `1px solid ${theme.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span>REGISTERED PLAYERS</span>
            <span style={{ color: theme.textStrong, letterSpacing: "0.05em" }}>
              {qualifiedPlayers.length} qualified / {players.length} total
            </span>
          </div>
          <div style={{
            border: `1px solid ${theme.border}`,
            borderRadius: 3,
            maxHeight: 320,
            overflowY: "auto",
          }}>
            {players.length === 0 ? (
              <div style={{ color: theme.muted, fontSize: 11, padding: 24, textAlign: "center" }}>
                No players registered yet — be the first prospector
              </div>
            ) : (
              players.map((p, i) => {
                const isMe = user && p.id === user.id;
                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderBottom: i < players.length - 1 ? `1px solid ${theme.border}` : "none",
                      background: isMe ? `${theme.gold}08` : "transparent",
                    }}
                  >
                    <div style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: p.qualified ? theme.green : theme.muted,
                      minWidth: 52,
                      letterSpacing: "0.05em",
                    }}>
                      {p.qualified ? "QUALIFIED" : "PENDING"}
                    </div>
                    {p.clerkAvatar ? (
                      <img
                        src={p.clerkAvatar}
                        alt=""
                        style={{ width: 26, height: 26, borderRadius: 13 }}
                      />
                    ) : (
                      <div style={{
                        width: 26, height: 26, borderRadius: 13,
                        background: theme.barBg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, color: theme.muted,
                      }}>
                        ?
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: theme.textStrong }}>
                        {p.clerkName || "Anonymous"}
                        {isMe && (
                          <span style={{ fontSize: 9, color: theme.gold, marginLeft: 6 }}>YOU</span>
                        )}
                      </div>
                      {p.walletAddress && (
                        <div style={{ fontSize: 9, color: theme.muted }}>
                          {p.walletAddress.slice(0, 6)}...{p.walletAddress.slice(-4)}
                        </div>
                      )}
                    </div>
                    {p.lastSnapshotUsdValue != null && (
                      <div style={{ fontSize: 10, color: theme.muted }}>
                        ${p.lastSnapshotUsdValue.toFixed(2)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Panorama image */}
        <div style={{
          marginBottom: 24,
          borderRadius: 4,
          border: `1px dashed ${theme.gold}33`,
          background: `linear-gradient(170deg, ${theme.gold}05, ${theme.gold}0a, ${theme.gold}03)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, opacity: 0.12 }}>&#127956;</div>
            <div style={{ fontSize: 8, letterSpacing: "0.15em", color: theme.muted, marginTop: 4 }}>
              <img src="/plotPic3.webp" alt="Oil rig at sunset" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
          </div>
        </div>

        {/* Rules */}
        <div style={{
          marginBottom: 24,
          padding: isMobile ? 14 : 18,
          border: `1px solid ${theme.border}`,
          borderRadius: 4,
          background: theme.tintBg,
        }}>
          <div style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            color: theme.muted,
            marginBottom: 10,
            paddingBottom: 6,
            borderBottom: `1px solid ${theme.border}`,
          }}>
            RULES
          </div>
          <ul style={{
            margin: 0,
            paddingLeft: 16,
            fontSize: 11,
            color: theme.text,
            lineHeight: 1.8,
          }}>
            <li>Hold at least ${QUALIFICATION_THRESHOLD} USD worth of RL80 tokens and follow @rl80token on X to qualify.</li>
            <li>Admin runs snapshots to verify token balances on-chain.</li>
            <li>Grid size is set by the house based on qualified player count.</li>
            <li>Qualified players pick plots first-come, first-served once the grid is locked.</li>
            <li>Oil distribution is seeded by a verifiable on-chain block hash.</li>
            <li>Each game day, every player drills one layer deeper (20 layers total).</li>
          </ul>
        </div>

        {/* RL80 Price Info */}
        {rl80Price != null && (
          <div style={{
            marginBottom: 24,
            padding: 14,
            border: `1px solid ${theme.border}`,
            borderRadius: 4,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 9, letterSpacing: "0.2em", color: theme.muted, marginBottom: 4 }}>
              CURRENT RL80 PRICE
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: theme.gold }}>
              ${rl80Price.toFixed(6)}
            </div>
            <div style={{ fontSize: 9, color: theme.muted, marginTop: 2 }}>
              via Uniswap V2 on Base
            </div>
          </div>
        )}

        {/* Admin Section */}
        {isAdmin && (
          <div style={{
            marginTop: 8,
            padding: 16,
            border: "1px solid rgba(160,48,48,0.3)",
            borderRadius: 4,
            background: "rgba(160,48,48,0.04)",
          }}>
            <div style={{
              fontSize: 10,
              letterSpacing: "0.2em",
              color: theme.muted,
              marginBottom: 12,
              paddingBottom: 6,
              borderBottom: `1px solid ${theme.border}`,
            }}>
              ADMIN CONTROLS
            </div>

            {/* Run Snapshot */}
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={handleRunSnapshot}
                disabled={snapshotRunning}
                style={{
                  width: "100%",
                  padding: "10px 20px",
                  background: snapshotRunning ? theme.barBg : "rgba(160,48,48,0.15)",
                  border: "1px solid rgba(160,48,48,0.3)",
                  borderRadius: 3,
                  color: snapshotRunning ? theme.muted : theme.textStrong,
                  fontFamily: mono,
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  cursor: snapshotRunning ? "default" : "pointer",
                }}
              >
                {snapshotRunning ? "RUNNING SNAPSHOT..." : "RUN QUALIFICATION SNAPSHOT"}
              </button>

              {snapshotResult && (
                <div style={{
                  marginTop: 8,
                  padding: 10,
                  border: `1px solid ${snapshotResult.error ? theme.red : theme.green}30`,
                  borderRadius: 3,
                  fontSize: 10,
                  color: snapshotResult.error ? theme.red : theme.green,
                  background: `${snapshotResult.error ? theme.red : theme.green}08`,
                }}>
                  {snapshotResult.error
                    ? `Error: ${snapshotResult.error}`
                    : `Snapshot complete: ${snapshotResult.qualifiedCount}/${snapshotResult.totalChecked} qualified at $${snapshotResult.price?.toFixed(6)}/RL80`}
                </div>
              )}

              {lastSnapshot && (
                <div style={{ fontSize: 9, color: theme.muted, marginTop: 6 }}>
                  Last snapshot: {lastSnapshot.qualifiedCount}/{lastSnapshot.totalChecked} qualified
                  {lastSnapshot.timestamp?.toDate && (
                    <> — {lastSnapshot.timestamp.toDate().toLocaleString()}</>
                  )}
                </div>
              )}
            </div>

            {/* Grid size selector */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: theme.muted, marginBottom: 8 }}>
                SET GRID SIZE FOR DRAFT
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[6, 7, 8, 9, 10].map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setAdminGridSize(sz)}
                    style={{
                      padding: "6px 14px",
                      border: `1px solid ${adminGridSize === sz ? theme.gold : theme.border}`,
                      borderRadius: 3,
                      fontFamily: mono,
                      fontSize: 11,
                      cursor: "pointer",
                      background: adminGridSize === sz ? `${theme.gold}22` : "transparent",
                      color: adminGridSize === sz ? theme.gold : theme.text,
                    }}
                  >
                    {sz}x{sz} ({sz * sz})
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleLockGrid}
              disabled={qualifiedPlayers.length === 0}
              style={{
                width: "100%",
                padding: "12px 20px",
                background: qualifiedPlayers.length === 0
                  ? theme.barBg
                  : `linear-gradient(180deg, ${theme.gold}, #b8922e)`,
                border: `1px solid ${qualifiedPlayers.length === 0 ? theme.border : theme.goldBorder}`,
                borderRadius: 3,
                color: qualifiedPlayers.length === 0 ? theme.muted : "#fff",
                fontFamily: mono,
                fontSize: 12,
                letterSpacing: "0.12em",
                cursor: qualifiedPlayers.length === 0 ? "default" : "pointer",
              }}
            >
              LOCK GRID ({adminGridSize}x{adminGridSize}) & START DRAFT
            </button>

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, color: theme.muted, marginBottom: 6 }}>
                PHASE OVERRIDE
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["ticket_sale", "grid_locked", "active", "ended"].map((phase) => (
                  <button
                    key={phase}
                    onClick={() => saveGameSettings({ gamePhase: phase })}
                    style={{
                      padding: "4px 10px",
                      border: `1px solid ${theme.border}`,
                      borderRadius: 3,
                      fontFamily: mono,
                      fontSize: 9,
                      cursor: "pointer",
                      background: "transparent",
                      color: theme.muted,
                    }}
                  >
                    {phase.toUpperCase().replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          textAlign: "center",
          padding: "24px 0 16px",
          fontSize: 9,
          letterSpacing: "0.15em",
          color: theme.muted,
        }}>
          HAIL MARY PROSPECTING CO. — ALL RIGHTS RESERVED
        </div>
      </div>
    </div>
  );
}
