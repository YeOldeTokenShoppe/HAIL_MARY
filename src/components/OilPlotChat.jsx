"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useOilApiFetch } from "@/lib/oilApiClient";
import {
  db, collection, query, where, orderBy, limit, onSnapshot, doc,
} from "@/lib/firebaseClient";

export default function OilPlotChat({
  plotKey,
  plotOwnerId,
  plotOwnerName,
  currentUserId,
  username,
  darkMode = false,
  isMobile = false,
  defaultExpanded = false,
  hasMessages = false,
  onRead,
  onTransferPlot,
  unlockedItems,
  claimJumpOption,
  isPlayer = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const listRef = useRef(null);
  const initialLoadRef = useRef(true);

  // Social links state
  const [ownerLinks, setOwnerLinks] = useState({ telegramHandle: "", xHandle: "" });
  const [editingLinks, setEditingLinks] = useState(false);
  const [linkDraft, setLinkDraft] = useState({ telegramHandle: "", xHandle: "" });
  const [savingLinks, setSavingLinks] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);

  // Transfer plot state
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferUsername, setTransferUsername] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [transferUpgrades, setTransferUpgrades] = useState(false);

  const isOwner = !!currentUserId && currentUserId === plotOwnerId;
  const oilApiFetch = useOilApiFetch();

  const c = darkMode
    ? {
        text: "#c8c0b4", accent: "#d4a854", muted: "#8a8070",
        panelBg: "rgba(26,26,31,0.95)", sectionBorder: "#444",
        activeBg: "#d4a854", inputBg: "rgba(40,40,48,0.9)",
        inputBorder: "#555", msgBg: "rgba(40,40,48,0.6)",
        msgOwner: "rgba(60,55,40,0.5)", link: "#6db3f2",
      }
    : {
        text: "#504030", accent: "#5a4010", muted: "#6e6050",
        panelBg: "rgba(245,239,230,0.95)", sectionBorder: "#d4c8b4",
        activeBg: "#b8922e", inputBg: "rgba(255,255,255,0.9)",
        inputBorder: "#c8bfb0", msgBg: "rgba(0,0,0,0.03)",
        msgOwner: "rgba(180,146,46,0.08)", link: "#2a6cb6",
      };

  const mono = "'Share Tech Mono', monospace";

  // ── Load owner social links ───────────────────────────────────────────────
  useEffect(() => {
    if (!plotOwnerId || !db) return;
    const unsub = onSnapshot(doc(db, "oilDrills", plotOwnerId), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setOwnerLinks({
          telegramHandle: d.telegramHandle || "",
          xHandle: d.xHandle || "",
        });
      } else {
        setOwnerLinks({ telegramHandle: "", xHandle: "" });
      }
    });
    return unsub;
  }, [plotOwnerId]);

  // ── Real-time messages ────────────────────────────────────────────────────
  // Owner sees ALL messages on their plot.
  // Visitor sees only their own thread (threadUserId == their id).
  useEffect(() => {
    if (!plotKey || !db || !currentUserId || !plotOwnerId) {
      setMessages([]); setHasUnread(false); return;
    }
    setHasUnread(false);

    const constraints = [
      where("plotKey", "==", plotKey),
      orderBy("timestamp", "desc"),
      limit(30),
    ];

    // Visitors only see their own conversation thread
    if (!isOwner) {
      constraints.splice(1, 0, where("threadUserId", "==", currentUserId));
    }

    const q = query(collection(db, "oilPlotMessages"), ...constraints);

    initialLoadRef.current = true;
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs.reverse()); // chronological
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
      } else {
        setHasUnread((prev) => prev || !expanded);
      }
    });
    return unsub;
  }, [plotKey, currentUserId, plotOwnerId, isOwner]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Post message ──────────────────────────────────────────────────────────
  // Server-authoritative: the route derives the sender from the Clerk session
  // and enforces the thread, so the client only sends the plot, target thread,
  // and text. (oilPlotMessages is locked to server-only writes.)
  const handlePost = useCallback(async (replyToThreadUser) => {
    if (!text.trim() || !currentUserId || !plotKey || sending) return;
    setSending(true);
    try {
      // For owner replies, name the thread; visitors always post to their own.
      const threadUserId = isOwner ? replyToThreadUser : currentUserId;
      if (!threadUserId) return;

      const res = await oilApiFetch("/api/oil-message", {
        method: "POST",
        body: JSON.stringify({ plotKey, threadUserId, text: text.trim().slice(0, 200) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setText("");
    } catch (e) {
      console.error("Failed to post message:", e);
    } finally {
      setSending(false);
    }
  }, [text, currentUserId, plotKey, sending, isOwner, oilApiFetch]);

  // ── Save social links ─────────────────────────────────────────────────────
  const handleSaveLinks = useCallback(async () => {
    if (!currentUserId) return;
    setSavingLinks(true);
    try {
      // Server writes the SESSION user's own profile (handles normalized server-side).
      const res = await oilApiFetch("/api/oil-profile", {
        method: "POST",
        body: JSON.stringify({ telegramHandle: linkDraft.telegramHandle, xHandle: linkDraft.xHandle }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setEditingLinks(false);
    } catch (e) {
      console.error("Failed to save social links:", e);
    } finally {
      setSavingLinks(false);
    }
  }, [currentUserId, linkDraft, oilApiFetch]);

  // ── Delete message ──────────────────────────────────────────────────────
  // Server gates deletes to the message author or the plot owner.
  const handleDelete = useCallback(async (msgId) => {
    try {
      await oilApiFetch("/api/oil-message", {
        method: "DELETE",
        body: JSON.stringify({ msgId }),
      });
    } catch (e) { console.error("Failed to delete message:", e); }
  }, [oilApiFetch]);

  // ── Transfer plot ──────────────────────────────────────────────────────────
  const handleTransfer = useCallback(async () => {
    if (!onTransferPlot || !transferUsername.trim()) return;
    setTransferring(true);
    setTransferError("");
    setTransferSuccess(false);
    try {
      const result = await onTransferPlot(transferUsername.trim(), transferUpgrades);
      if (result?.error) {
        setTransferError(result.error);
      } else {
        setTransferSuccess(true);
        setTransferUsername("");
        setTimeout(() => { setShowTransfer(false); setTransferSuccess(false); }, 2500);
      }
    } catch (e) {
      setTransferError("Transfer failed");
    } finally {
      setTransferring(false);
    }
  }, [onTransferPlot, transferUsername, transferUpgrades]);

  // ── No plot selected ──────────────────────────────────────────────────────
  if (!plotKey) {
    return (
      <div style={{ padding: isMobile ? "12px 12px" : "12px 14px", borderBottom: `1px solid ${c.sectionBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c.activeBg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
          <span style={{ fontFamily: mono, fontSize: isMobile ? 12 : 11, fontWeight: 600, color: c.accent, letterSpacing: "0.2em" }}>
            MESSAGES
          </span>
        </div>
        <p style={{ fontFamily: mono, fontSize: 10, color: c.muted, margin: "8px 0 0" }}>
          Select a plot to message
        </p>
      </div>
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const hasLinks = ownerLinks.telegramHandle || ownerLinks.xHandle;

  const btnStyle = (bg) => ({
    fontFamily: mono, fontSize: 10, fontWeight: 600, letterSpacing: "0.1em",
    background: bg, color: "#fff", border: "none", borderRadius: 3,
    padding: "4px 10px", cursor: "pointer",
  });

  const inputStyle = {
    fontFamily: mono, fontSize: 10, color: c.text,
    background: c.inputBg, border: `1px solid ${c.inputBorder}`,
    borderRadius: 3, padding: "4px 6px", outline: "none", width: "100%",
  };

  // For the owner view, group messages by threadUserId to show conversation threads
  const threads = isOwner
    ? messages.reduce((acc, msg) => {
        const tid = msg.threadUserId;
        if (!acc[tid]) acc[tid] = { threadUserId: tid, threadUsername: null, msgs: [] };
        // Use the non-owner username for the thread label
        if (msg.fromUserId !== plotOwnerId) acc[tid].threadUsername = msg.fromUsername;
        acc[tid].msgs.push(msg);
        return acc;
      }, {})
    : null;

  const threadList = threads ? Object.values(threads) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: isMobile ? "12px 12px" : "12px 14px", borderBottom: `1px solid ${c.sectionBorder}` }}>
      {/* Header / accordion toggle */}
      <div
        onClick={() => { setExpanded((e) => { if (!e && plotKey) setTimeout(() => onRead?.(plotKey), 0); return !e; }); setHasUnread(false); }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
      >
        <h3 style={{
          margin: 0, fontSize: isMobile ? 12 : 11, fontWeight: 600,
          color: c.accent, letterSpacing: "0.2em", textTransform: "uppercase",
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: mono,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={(hasMessages || hasUnread) ? "#22cc44" : c.activeBg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
          MESSAGES
          {(hasMessages || (hasUnread && !expanded)) && (
            <span style={{
              display: "inline-block", width: 6, height: 6, borderRadius: "50%",
              background: "#22cc44", marginLeft: 2, flexShrink: 0,
            }} />
          )}
          <span style={{ fontSize: 9, fontWeight: 400, color: c.muted, letterSpacing: "0.05em" }}>
            {(() => { const [cx, cy] = plotKey.split("_").map(Number); return `[${cx + 1},${cy + 1}]`; })()}
          </span>
        </h3>
        <span style={{ fontSize: 10, color: c.muted }}>{expanded ? "\u25B4" : "\u25BE"}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 10 }}>

          {/* ── Owner social links ──────────────────────────────────── */}
          {hasLinks && (
            <div style={{ marginBottom: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {ownerLinks.telegramHandle && (
                <a
                  href={`https://t.me/${ownerLinks.telegramHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontFamily: mono, fontSize: 10, color: c.link, textDecoration: "none" }}
                >
                  TG: @{ownerLinks.telegramHandle}
                </a>
              )}
              {ownerLinks.xHandle && (
                <a
                  href={`https://x.com/${ownerLinks.xHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontFamily: mono, fontSize: 10, color: c.link, textDecoration: "none" }}
                >
                  X: @{ownerLinks.xHandle}
                </a>
              )}
            </div>
          )}

          {/* ── Edit My Links (owner only) ─────────────────────────── */}
          {isOwner && !editingLinks && (
            <div style={{ marginBottom: 8 }}>
              <button
                onClick={(e) => { e.stopPropagation(); setLinkDraft({ ...ownerLinks }); setEditingLinks(true); }}
                style={{ ...btnStyle(c.activeBg), fontSize: 9, padding: "3px 8px" }}
              >
                EDIT MY LINKS
              </button>
            </div>
          )}

          {isOwner && editingLinks && (
            <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontFamily: mono, fontSize: 9, color: c.muted, minWidth: 20 }}>TG</span>
                <input
                  style={inputStyle}
                  placeholder="telegram handle"
                  value={linkDraft.telegramHandle}
                  onChange={(e) => setLinkDraft((d) => ({ ...d, telegramHandle: e.target.value }))}
                  maxLength={40}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontFamily: mono, fontSize: 9, color: c.muted, minWidth: 20 }}>X</span>
                <input
                  style={inputStyle}
                  placeholder="x handle"
                  value={linkDraft.xHandle}
                  onChange={(e) => setLinkDraft((d) => ({ ...d, xHandle: e.target.value }))}
                  maxLength={40}
                />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={handleSaveLinks} disabled={savingLinks} style={btnStyle(c.activeBg)}>
                  {savingLinks ? "SAVING..." : "SAVE"}
                </button>
                <button onClick={() => setEditingLinks(false)} style={btnStyle(c.muted)}>
                  CANCEL
                </button>
              </div>
            </div>
          )}

          {/* ── Transfer Plot (owner only) ────────────────────────── */}
          {isOwner && onTransferPlot && !showTransfer && (
            <div style={{ marginBottom: 8 }}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowTransfer(true); setTransferError(""); setTransferSuccess(false); setTransferUsername(""); }}
                style={{ ...btnStyle("#8b4513"), fontSize: 9, padding: "3px 8px" }}
              >
                TRANSFER PLOT
              </button>
            </div>
          )}

          {isOwner && onTransferPlot && showTransfer && (
            <div style={{ marginBottom: 10, padding: "8px", border: `1px solid #8b4513`, borderRadius: 4, background: darkMode ? "rgba(60,30,10,0.3)" : "rgba(139,69,19,0.06)" }}>
              <div style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, color: "#8b4513", letterSpacing: "0.1em", marginBottom: 6 }}>
                TRANSFER PLOT
              </div>
              <input
                style={{ ...inputStyle, marginBottom: 6 }}
                placeholder="recipient username"
                value={transferUsername}
                onChange={(e) => { setTransferUsername(e.target.value.slice(0, 40)); setTransferError(""); }}
                maxLength={40}
                disabled={transferring}
              />
              {unlockedItems && unlockedItems.size > 0 && (
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: mono, fontSize: 9, color: c.text, marginBottom: 6, cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={transferUpgrades}
                    onChange={(e) => setTransferUpgrades(e.target.checked)}
                    disabled={transferring}
                    style={{ margin: 0, cursor: "pointer" }}
                  />
                  Include purchased upgrades
                </label>
              )}
              {transferUsername.trim() && !transferSuccess && (
                <p style={{ fontFamily: mono, fontSize: 9, color: "#c44", margin: "0 0 6px", lineHeight: 1.3 }}>
                  This will transfer your plot to <strong>{transferUsername.trim()}</strong>. You will lose ownership.
                </p>
              )}
              {transferError && (
                <p style={{ fontFamily: mono, fontSize: 9, color: "#c44", margin: "0 0 6px", fontWeight: 600 }}>
                  {transferError}
                </p>
              )}
              {transferSuccess && (
                <p style={{ fontFamily: mono, fontSize: 9, color: "#2a2", margin: "0 0 6px", fontWeight: 600 }}>
                  Plot transferred!
                </p>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={handleTransfer}
                  disabled={transferring || !transferUsername.trim() || transferSuccess}
                  style={{ ...btnStyle("#c44"), opacity: (transferring || !transferUsername.trim() || transferSuccess) ? 0.5 : 1 }}
                >
                  {transferring ? "TRANSFERRING..." : "CONFIRM TRANSFER"}
                </button>
                <button
                  onClick={() => { setShowTransfer(false); setTransferError(""); setTransferUsername(""); }}
                  style={btnStyle(c.muted)}
                  disabled={transferring}
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}

          {/* ── Not signed in ──────────────────────────────────────── */}
          {!currentUserId && (
            <p style={{ fontFamily: mono, fontSize: 10, color: c.muted, margin: 0 }}>
              Sign in to message this plot owner
            </p>
          )}

          {/* ── Unclaimed plot — nobody to message; offer claim jump ─── */}
          {currentUserId && !plotOwnerId && (
            <div>
              <p style={{ fontFamily: mono, fontSize: 10, color: c.muted, margin: 0 }}>
                This plot is unclaimed — no owner to message yet.
              </p>
              {claimJumpOption && (
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={() => { if (!claimJumpOption.disabled) claimJumpOption.onClaim(); }}
                    disabled={claimJumpOption.disabled}
                    style={{
                      ...btnStyle(c.activeBg),
                      opacity: claimJumpOption.disabled ? 0.5 : 1,
                      cursor: claimJumpOption.disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    {claimJumpOption.label}
                  </button>
                  {claimJumpOption.note && (
                    <p style={{ fontFamily: mono, fontSize: 9, color: c.muted, margin: "5px 0 0" }}>
                      {claimJumpOption.note}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Signed in but not a player — messaging is players-only ── */}
          {currentUserId && !isOwner && plotOwnerId && !isPlayer && (
            <p style={{ fontFamily: mono, fontSize: 10, color: c.muted, margin: 0 }}>
              Only players can message plot owners.
            </p>
          )}

          {/* ── Visitor view: single thread with plot owner ────────── */}
          {currentUserId && !isOwner && plotOwnerId && isPlayer && (
            <>
              <div
                ref={listRef}
                style={{
                  maxHeight: 180, overflowY: "auto", marginBottom: 8,
                  display: "flex", flexDirection: "column", gap: 4,
                }}
              >
                {messages.length === 0 && (
                  <p style={{ fontFamily: mono, fontSize: 10, color: c.muted, margin: 0 }}>
                    Send a message to this plot owner
                  </p>
                )}
                {messages.map((msg) => {
                  const isMine = msg.fromUserId === currentUserId;
                  const canDelete = isMine || isOwner;
                  return (
                    <div key={msg.id} style={{
                      background: isMine ? c.msgBg : c.msgOwner,
                      borderRadius: 3, padding: "4px 6px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: isMine ? c.accent : c.link }}>
                            {isMine ? "you" : msg.fromUsername}
                          </span>
                          <span style={{ fontFamily: mono, fontSize: 9, color: c.muted, marginLeft: 6 }}>
                            {msg.timestamp?.toDate
                              ? msg.timestamp.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : "..."}
                          </span>
                        </div>
                        {canDelete && (
                          <button onClick={() => handleDelete(msg.id)} style={{
                            background: "none", border: "none", color: c.muted, cursor: "pointer",
                            fontFamily: mono, fontSize: 9, padding: "0 2px", opacity: 0.6,
                          }}>&times;</button>
                        )}
                      </div>
                      <div style={{ fontFamily: mono, fontSize: 10, color: c.text, marginTop: 2, lineHeight: 1.3, wordBreak: "break-word" }}>
                        {msg.text}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", gap: 4 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="Message plot owner..."
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 200))}
                  maxLength={200}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePost(); } }}
                  disabled={sending}
                />
                <button
                  onClick={() => handlePost()}
                  disabled={sending || !text.trim()}
                  style={{
                    ...btnStyle(c.activeBg),
                    opacity: (sending || !text.trim()) ? 0.5 : 1,
                    minWidth: 50,
                  }}
                >
                  SEND
                </button>
              </div>
            </>
          )}

          {/* ── Owner view: all threads grouped by sender ──────────── */}
          {currentUserId && isOwner && (
            <>
              <div
                ref={listRef}
                style={{
                  maxHeight: 220, overflowY: "auto", marginBottom: 8,
                  display: "flex", flexDirection: "column", gap: 6,
                }}
              >
                {(!threadList || threadList.length === 0) && (
                  <p style={{ fontFamily: mono, fontSize: 10, color: c.muted, margin: 0 }}>
                    No messages on this plot yet
                  </p>
                )}
                {threadList && threadList.map((thread) => (
                  <div key={thread.threadUserId} style={{
                    border: `1px solid ${replyTarget === thread.threadUserId ? c.accent : c.inputBorder}`,
                    borderRadius: 4, padding: "5px 6px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: c.link }}>
                        {thread.threadUsername || "player"}
                      </span>
                      <button
                        onClick={() => setReplyTarget(replyTarget === thread.threadUserId ? null : thread.threadUserId)}
                        style={{
                          ...btnStyle(replyTarget === thread.threadUserId ? c.accent : c.muted),
                          fontSize: 8, padding: "2px 6px",
                        }}
                      >
                        {replyTarget === thread.threadUserId ? "REPLYING" : "REPLY"}
                      </button>
                    </div>
                    {thread.msgs.map((msg) => {
                      const isMine = msg.fromUserId === currentUserId;
                      return (
                        <div key={msg.id} style={{
                          background: isMine ? c.msgOwner : c.msgBg,
                          borderRadius: 3, padding: "3px 5px", marginBottom: 2,
                        }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                              <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 600, color: isMine ? c.accent : c.link }}>
                                {isMine ? "you" : msg.fromUsername}
                              </span>
                              <span style={{ fontFamily: mono, fontSize: 8, color: c.muted, marginLeft: 4 }}>
                                {msg.timestamp?.toDate
                                  ? msg.timestamp.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                  : "..."}
                              </span>
                            </div>
                            <button onClick={() => handleDelete(msg.id)} style={{
                              background: "none", border: "none", color: c.muted, cursor: "pointer",
                              fontFamily: mono, fontSize: 8, padding: "0 2px", opacity: 0.6,
                            }}>&times;</button>
                          </div>
                          <div style={{ fontFamily: mono, fontSize: 10, color: c.text, marginTop: 1, lineHeight: 1.3, wordBreak: "break-word" }}>
                            {msg.text}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {replyTarget && (
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    placeholder="Reply..."
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, 200))}
                    maxLength={200}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePost(replyTarget); } }}
                    disabled={sending}
                  />
                  <button
                    onClick={() => handlePost(replyTarget)}
                    disabled={sending || !text.trim()}
                    style={{
                      ...btnStyle(c.activeBg),
                      opacity: (sending || !text.trim()) ? 0.5 : 1,
                      minWidth: 50,
                    }}
                  >
                    SEND
                  </button>
                </div>
              )}
              {!replyTarget && threadList && threadList.length > 0 && (
                <p style={{ fontFamily: mono, fontSize: 9, color: c.muted, margin: 0 }}>
                  Tap REPLY on a thread to respond
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
