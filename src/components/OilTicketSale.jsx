"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { SignInButton } from "@clerk/nextjs";
import { db, collection, query, orderBy, onSnapshot } from "@/lib/firebaseClient";

const TICKET_WALLET = process.env.NEXT_PUBLIC_OIL_TICKET_WALLET || "0x...";
const TICKET_PRICE = 10; // $10 USDC

const GRID_TARGETS = [
  { size: 6, plots: 36 },
  { size: 7, plots: 49 },
  { size: 8, plots: 64 },
  { size: 9, plots: 81 },
  { size: 10, plots: 100 },
];

export default function OilTicketSale({
  theme,
  darkMode,
  isMobile,
  user,
  isAdmin,
  gridSize,
  saveGameSettings,
  setGridSize,
}) {
  const [tickets, setTickets] = useState([]);
  const [txHash, setTxHash] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [adminGridSize, setAdminGridSize] = useState(gridSize);
  const [copied, setCopied] = useState(false);

  // Subscribe to tickets collection
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

  const userHasTicket = useMemo(
    () => user && tickets.some((t) => t.userId === user.id),
    [user, tickets]
  );

  const userTicket = useMemo(
    () => user && tickets.find((t) => t.userId === user.id),
    [user, tickets]
  );

  const nearestTarget = useMemo(() => {
    const count = tickets.length;
    return GRID_TARGETS.find((g) => g.plots >= count) || GRID_TARGETS[GRID_TARGETS.length - 1];
  }, [tickets.length]);

  const handleCopyAddress = useCallback(() => {
    navigator.clipboard?.writeText(TICKET_WALLET);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleBuyTicket = useCallback(async () => {
    if (!user || !txHash.trim()) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/oil-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          clerkName: user.fullName || user.firstName || "Anonymous",
          clerkAvatar: user.imageUrl || null,
          txHash: txHash.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to purchase ticket");
      setSuccess(`Ticket #${data.purchaseOrder} confirmed!`);
      setTxHash("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }, [user, txHash]);

  const handleLockGrid = useCallback(async () => {
    if (!isAdmin) return;
    await saveGameSettings({
      gamePhase: "grid_locked",
      gridSize: adminGridSize,
      currentPickOrder: 1,
      pickDeadline: null,
      pickWindowMinutes: 120,
    });
    setGridSize(adminGridSize);
  }, [isAdmin, adminGridSize, saveGameSettings, setGridSize]);

  const mono = "'Share Tech Mono', monospace";

  return (
    <div style={{
      minHeight: "100vh",
      background: theme.bg,
      color: theme.text,
      fontFamily: mono,
    }}>
      {/* ── Hero Header ── */}
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
        <div style={{
          width: 40,
          height: 1,
          background: theme.gold,
          margin: "12px auto",
        }} />
        <div style={{
          fontSize: isMobile ? 12 : 14,
          letterSpacing: "0.35em",
          color: theme.gold,
        }}>
          LAND SALE
        </div>
        <div style={{
          fontSize: 10,
          color: theme.muted,
          marginTop: 8,
          letterSpacing: "0.1em",
        }}>
          SECURE YOUR PLOT BEFORE THE DRILL STARTS
        </div>

        {/* Hero image placeholder */}
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
          {/* Replace with: <img src="/images/oil-hero.jpg" alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, opacity: 0.2 }}>&#9881;</div>
            <div style={{ fontSize: 8, letterSpacing: "0.2em", color: theme.muted, marginTop: 4 }}><img src="/ClaimCertificate.webp" alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
          </div>
        </div>

        {/* Sign-in / user badge in header */}
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
              {userHasTicket && (
                <span style={{
                  fontSize: 9,
                  letterSpacing: "0.1em",
                  color: theme.green,
                  padding: "2px 6px",
                  background: `${theme.green}15`,
                  border: `1px solid ${theme.green}30`,
                  borderRadius: 2,
                }}>
                  TICKET #{userTicket?.purchaseOrder}
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
        {/* ── Ticket Counter ── */}
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
            {tickets.length}
          </div>
          <div style={{
            fontSize: 11,
            letterSpacing: "0.25em",
            color: theme.muted,
            marginTop: 8,
          }}>
            TICKETS SOLD
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
              const reached = tickets.length >= g.plots;
              const nearest = g.size === nearestTarget.size && !reached;
              const pct = Math.min(100, Math.round((tickets.length / g.plots) * 100));
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
                  {/* Fill bar */}
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

        {/* ── How It Works ── */}
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
              { step: "01", title: "BUY A TICKET", desc: `Send $${TICKET_PRICE} USDC on Base to the prospecting wallet. One ticket per person.` },
              { step: "02", title: "DRAFT YOUR PLOT", desc: "Once the grid is locked, ticket holders pick their plot in purchase order. First come, first served." },
              { step: "03", title: "DRILL FOR OIL", desc: "Each day you drill one layer deeper. Oil deposits are hidden underground, seeded by a verifiable block hash." },
              { step: "04", title: "STRIKE IT RICH", desc: "Hit an oil deposit and extract RL80 tokens. The biggest deposits go to the luckiest prospectors." },
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

        {/* ── Brochure Images (2-up) ── */}
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
            {/* Replace with: <img src="/images/oil-rig.jpg" alt="Oil rig at sunset" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> */}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, opacity: 0.15 }}>&#9968;</div>
              <div style={{ fontSize: 8, letterSpacing: "0.15em", color: theme.muted, marginTop: 4 }}> <img src="/plotPic1.webp" alt="Oil rig at sunset" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
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
            {/* Replace with: <img src="/images/oil-grid.jpg" alt="Aerial grid view" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> */}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, opacity: 0.15 }}>&#9638;</div>
              <div style={{ fontSize: 8, letterSpacing: "0.15em", color: theme.muted, marginTop: 4 }}><img src="/plotPic4.webp" alt="Oil rig at sunset" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
            </div>
          </div>
        </div>

        {/* ── Buy Ticket Section ── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            color: theme.muted,
            marginBottom: 12,
            paddingBottom: 6,
            borderBottom: `1px solid ${theme.border}`,
          }}>
            BUY YOUR TICKET
          </div>

          {!user ? (
            <div style={{
              textAlign: "center",
              padding: "28px 16px",
              border: `1px dashed ${theme.border}`,
              borderRadius: 4,
            }}>
              <div style={{ fontSize: 12, color: theme.muted, marginBottom: 14 }}>
                Sign in to purchase your prospecting ticket
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
          ) : userHasTicket ? (
            <div style={{
              textAlign: "center",
              padding: "20px 16px",
              border: `1px solid ${theme.green}30`,
              borderRadius: 4,
              background: `${theme.green}08`,
            }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>&#9745;</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: theme.green }}>
                YOU HAVE TICKET #{userTicket?.purchaseOrder}
              </div>
              <div style={{ fontSize: 11, color: theme.muted, marginTop: 4 }}>
                You&apos;ll pick your plot in position #{userTicket?.purchaseOrder} once the grid is locked
              </div>
            </div>
          ) : (
            <div style={{
              padding: isMobile ? 14 : 20,
              border: `1px solid ${theme.border}`,
              borderRadius: 4,
              background: theme.panelBg,
            }}>
              {/* Step 1: Send payment */}
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 10, color: theme.gold, letterSpacing: "0.15em", marginBottom: 8, fontWeight: 700,
                }}>
                  STEP 1 — SEND ${TICKET_PRICE} USDC ON BASE
                </div>
                <div style={{
                  padding: 12,
                  background: theme.inputBg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 3,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}>
                  <div style={{
                    flex: 1,
                    fontSize: 11,
                    color: theme.textStrong,
                    wordBreak: "break-all",
                    letterSpacing: "0.02em",
                    lineHeight: 1.5,
                  }}>
                    {TICKET_WALLET}
                  </div>
                  <button
                    onClick={handleCopyAddress}
                    style={{
                      padding: "4px 10px",
                      border: `1px solid ${theme.border}`,
                      borderRadius: 2,
                      background: "transparent",
                      color: copied ? theme.green : theme.muted,
                      fontFamily: mono,
                      fontSize: 9,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {copied ? "COPIED" : "COPY"}
                  </button>
                </div>
              </div>

              {/* Step 2: Submit tx hash */}
              <div>
                <div style={{
                  fontSize: 10, color: theme.gold, letterSpacing: "0.15em", marginBottom: 8, fontWeight: 700,
                }}>
                  STEP 2 — PASTE YOUR TRANSACTION HASH
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      background: theme.inputBg,
                      border: `1px solid ${theme.border}`,
                      borderRadius: 3,
                      color: theme.text,
                      fontFamily: mono,
                      fontSize: 11,
                      outline: "none",
                    }}
                  />
                  <button
                    onClick={handleBuyTicket}
                    disabled={submitting || !txHash.trim()}
                    style={{
                      padding: "10px 22px",
                      background: submitting || !txHash.trim()
                        ? theme.barBg
                        : `linear-gradient(180deg, ${theme.gold}, #b8922e)`,
                      border: `1px solid ${submitting || !txHash.trim() ? theme.border : theme.goldBorder}`,
                      borderRadius: 3,
                      color: submitting || !txHash.trim() ? theme.muted : "#fff",
                      fontFamily: mono,
                      fontSize: 11,
                      letterSpacing: "0.1em",
                      cursor: submitting || !txHash.trim() ? "default" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {submitting ? "VERIFYING..." : "SUBMIT"}
                  </button>
                </div>
                <div style={{ fontSize: 10, color: theme.muted, marginTop: 6 }}>
                  We verify your transaction on-chain before issuing the ticket
                </div>
              </div>

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

        {/* ── Game Details ── */}
        <div style={{
          marginBottom: 24,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
          gap: 12,
        }}>
          {[
            { label: "ENTRY FEE", value: `$${TICKET_PRICE} USDC`, sub: "Base network" },
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

        {/* ── Ticket Holders ── */}
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
            <span>TICKET HOLDERS</span>
            <span style={{ color: theme.textStrong, letterSpacing: "0.05em" }}>{tickets.length}</span>
          </div>
          <div style={{
            border: `1px solid ${theme.border}`,
            borderRadius: 3,
            maxHeight: 320,
            overflowY: "auto",
          }}>
            {tickets.length === 0 ? (
              <div style={{ color: theme.muted, fontSize: 11, padding: 24, textAlign: "center" }}>
                No tickets sold yet — be the first prospector
              </div>
            ) : (
              tickets.map((t, i) => {
                const isMe = user && t.userId === user.id;
                return (
                  <div
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderBottom: i < tickets.length - 1 ? `1px solid ${theme.border}` : "none",
                      background: isMe ? `${theme.gold}08` : "transparent",
                    }}
                  >
                    <div style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: theme.gold,
                      minWidth: 32,
                    }}>
                      #{t.purchaseOrder}
                    </div>
                    {t.clerkAvatar ? (
                      <img
                        src={t.clerkAvatar}
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
                        {t.clerkName || "Anonymous"}
                        {isMe && (
                          <span style={{ fontSize: 9, color: theme.gold, marginLeft: 6 }}>YOU</span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: theme.muted }}>
                      {t.purchasedAt?.toDate
                        ? t.purchasedAt.toDate().toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                        : "..."}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Full-width banner image ── */}
        <div style={{
          marginBottom: 24,
          // aspectRatio: isMobile ? "16 / 9" : "21 / 7",
          borderRadius: 4,
          border: `1px dashed ${theme.gold}33`,
          background: `linear-gradient(170deg, ${theme.gold}05, ${theme.gold}0a, ${theme.gold}03)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}>
          {/* Replace with: <img src="/images/oil-panorama.jpg" alt="Panoramic oil field" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> */}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, opacity: 0.12 }}>&#127956;</div>
            <div style={{ fontSize: 8, letterSpacing: "0.15em", color: theme.muted, marginTop: 4 }}><img src="/plotPic3.webp" alt="Oil rig at sunset" style={{ width: "100%", height: "100%", objectFit: "contain" }} /></div>
          </div>
        </div>

        {/* ── Rules ── */}
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
            <li>One ticket per person. Tickets are non-refundable.</li>
            <li>Grid size is set by the house based on ticket sales.</li>
            <li>Plot draft order = ticket purchase order. First buyer picks first.</li>
            <li>You have ~2 hours to pick your plot or you get a random assignment.</li>
            <li>Oil distribution is seeded by a verifiable on-chain block hash.</li>
            <li>Each game day, every player drills one layer deeper (20 layers total).</li>
          </ul>
        </div>

        {/* ── Admin Section ── */}
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
              disabled={tickets.length === 0}
              style={{
                width: "100%",
                padding: "12px 20px",
                background: tickets.length === 0
                  ? theme.barBg
                  : `linear-gradient(180deg, ${theme.gold}, #b8922e)`,
                border: `1px solid ${tickets.length === 0 ? theme.border : theme.goldBorder}`,
                borderRadius: 3,
                color: tickets.length === 0 ? theme.muted : "#fff",
                fontFamily: mono,
                fontSize: 12,
                letterSpacing: "0.12em",
                cursor: tickets.length === 0 ? "default" : "pointer",
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
