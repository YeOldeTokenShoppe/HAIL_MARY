"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  db, collection, query, where, orderBy, limit, addDoc, deleteDoc, serverTimestamp,
  onSnapshot, doc, updateDoc,
} from "@/lib/firebaseClient";

export default function OilChatModal({
  plotKey,
  plotOwnerId,
  currentUserId,
  username,
  onClose,
}) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef(null);
  const listRef = useRef(null);

  // Social links
  const [ownerLinks, setOwnerLinks] = useState({ telegramHandle: "", xHandle: "" });
  const [editingLinks, setEditingLinks] = useState(false);
  const [linkDraft, setLinkDraft] = useState({ telegramHandle: "", xHandle: "" });
  const [savingLinks, setSavingLinks] = useState(false);
  const [replyTarget, setReplyTarget] = useState(null);

  const isOwner = !!currentUserId && currentUserId === plotOwnerId;

  const mono = "'Share Tech Mono', monospace";
  const c = {
    bg: "rgba(18,18,22,0.96)",
    panel: "#1a1a1f",
    border: "#333",
    text: "#c8c0b4",
    accent: "#d4a854",
    muted: "#8a8070",
    activeBg: "#d4a854",
    inputBg: "rgba(40,40,48,0.9)",
    inputBorder: "#555",
    msgBg: "rgba(40,40,48,0.6)",
    msgOwner: "rgba(60,55,40,0.5)",
    link: "#6db3f2",
    green: "#22cc44",
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Load owner social links
  useEffect(() => {
    if (!plotOwnerId || !db) return;
    const unsub = onSnapshot(doc(db, "oilDrills", plotOwnerId), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setOwnerLinks({ telegramHandle: d.telegramHandle || "", xHandle: d.xHandle || "" });
      }
    });
    return unsub;
  }, [plotOwnerId]);

  // Real-time messages
  useEffect(() => {
    if (!plotKey || !db || !currentUserId || !plotOwnerId) return;
    const constraints = [
      where("plotKey", "==", plotKey),
      orderBy("timestamp", "desc"),
      limit(30),
    ];
    if (!isOwner) {
      constraints.splice(1, 0, where("threadUserId", "==", currentUserId));
    }
    const q = query(collection(db, "oilPlotMessages"), ...constraints);
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(msgs.reverse());
    });
    return unsub;
  }, [plotKey, currentUserId, plotOwnerId, isOwner]);

  // Auto-scroll
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  // Cooldown
  useEffect(() => {
    if (cooldown <= 0) return;
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(cooldownRef.current);
  }, [cooldown]);

  // Post message
  const handlePost = useCallback(async (replyToThreadUser) => {
    if (!text.trim() || !currentUserId || !plotKey || !db || cooldown > 0) return;
    setSending(true);
    try {
      const threadUserId = isOwner ? replyToThreadUser : currentUserId;
      if (!threadUserId) return;
      await addDoc(collection(db, "oilPlotMessages"), {
        plotKey,
        fromUserId: currentUserId,
        fromUsername: username || "anon",
        threadUserId,
        text: text.trim().slice(0, 200),
        timestamp: serverTimestamp(),
      });
      setText("");
      setCooldown(30);
    } catch (e) {
      console.error("Failed to post message:", e);
    } finally {
      setSending(false);
    }
  }, [text, currentUserId, plotKey, username, cooldown, isOwner]);

  // Save links
  const handleSaveLinks = useCallback(async () => {
    if (!currentUserId || !db) return;
    setSavingLinks(true);
    try {
      await updateDoc(doc(db, "oilDrills", currentUserId), {
        telegramHandle: linkDraft.telegramHandle.replace(/^@/, "").trim().slice(0, 40),
        xHandle: linkDraft.xHandle.replace(/^@/, "").trim().slice(0, 40),
      });
      setEditingLinks(false);
    } catch (e) {
      console.error("Failed to save social links:", e);
    } finally {
      setSavingLinks(false);
    }
  }, [currentUserId, linkDraft]);

  // Delete message
  const handleDelete = useCallback(async (msgId) => {
    if (!db) return;
    try { await deleteDoc(doc(db, "oilPlotMessages", msgId)); }
    catch (e) { console.error("Failed to delete message:", e); }
  }, []);

  // Thread grouping for owner
  const threads = isOwner
    ? messages.reduce((acc, msg) => {
        const tid = msg.threadUserId;
        if (!acc[tid]) acc[tid] = { threadUserId: tid, threadUsername: null, msgs: [] };
        if (msg.fromUserId !== plotOwnerId) acc[tid].threadUsername = msg.fromUsername;
        acc[tid].msgs.push(msg);
        return acc;
      }, {})
    : null;
  const threadList = threads ? Object.values(threads) : null;

  const hasLinks = ownerLinks.telegramHandle || ownerLinks.xHandle;

  const btnStyle = (bg) => ({
    fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.1em",
    background: bg, color: "#fff", border: "none", borderRadius: 3,
    padding: "5px 14px", cursor: "pointer",
  });

  const inputStyle = {
    fontFamily: mono, fontSize: 11, color: c.text,
    background: c.inputBg, border: `1px solid ${c.inputBorder}`,
    borderRadius: 3, padding: "6px 8px", outline: "none", width: "100%",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: c.panel, border: `1px solid ${c.border}`,
          borderRadius: 8, width: "90%", maxWidth: 420,
          maxHeight: "80vh", display: "flex", flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "14px 16px 12px", borderBottom: `1px solid ${c.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, color: c.green }}>&#9993;</span>
            <span style={{
              fontFamily: mono, fontSize: 13, fontWeight: 600,
              color: c.accent, letterSpacing: "0.15em",
            }}>
              PLOT MESSAGES
            </span>
            <span style={{ fontFamily: mono, fontSize: 11, color: c.muted }}>
              {(() => { const [cx, cy] = plotKey.split("_").map(Number); return `[${cx + 1},${cy + 1}]`; })()}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", color: c.muted,
              fontSize: 18, cursor: "pointer", padding: "0 4px", lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "12px 16px", overflowY: "auto", flex: 1 }}>

          {/* Social links */}
          {hasLinks && (
            <div style={{ marginBottom: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {ownerLinks.telegramHandle && (
                <a href={`https://t.me/${ownerLinks.telegramHandle}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily: mono, fontSize: 11, color: c.link, textDecoration: "none" }}>
                  TG: @{ownerLinks.telegramHandle}
                </a>
              )}
              {ownerLinks.xHandle && (
                <a href={`https://x.com/${ownerLinks.xHandle}`} target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily: mono, fontSize: 11, color: c.link, textDecoration: "none" }}>
                  X: @{ownerLinks.xHandle}
                </a>
              )}
            </div>
          )}

          {/* Edit links (owner) */}
          {isOwner && !editingLinks && (
            <div style={{ marginBottom: 10 }}>
              <button
                onClick={() => { setLinkDraft({ ...ownerLinks }); setEditingLinks(true); }}
                style={{ ...btnStyle(c.activeBg), fontSize: 9, padding: "3px 8px" }}>
                EDIT MY LINKS
              </button>
            </div>
          )}
          {isOwner && editingLinks && (
            <div style={{ marginBottom: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: mono, fontSize: 10, color: c.muted, minWidth: 20 }}>TG</span>
                <input style={inputStyle} placeholder="telegram handle" value={linkDraft.telegramHandle}
                  onChange={(e) => setLinkDraft((d) => ({ ...d, telegramHandle: e.target.value }))} maxLength={40} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: mono, fontSize: 10, color: c.muted, minWidth: 20 }}>X</span>
                <input style={inputStyle} placeholder="x handle" value={linkDraft.xHandle}
                  onChange={(e) => setLinkDraft((d) => ({ ...d, xHandle: e.target.value }))} maxLength={40} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={handleSaveLinks} disabled={savingLinks} style={btnStyle(c.activeBg)}>
                  {savingLinks ? "SAVING..." : "SAVE"}
                </button>
                <button onClick={() => setEditingLinks(false)} style={btnStyle(c.muted)}>CANCEL</button>
              </div>
            </div>
          )}

          {/* Not signed in */}
          {!currentUserId && (
            <p style={{ fontFamily: mono, fontSize: 11, color: c.muted, margin: "20px 0", textAlign: "center" }}>
              Sign in to message this plot owner
            </p>
          )}

          {/* Visitor view */}
          {currentUserId && !isOwner && (
            <div ref={listRef} style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {messages.length === 0 && (
                <p style={{ fontFamily: mono, fontSize: 11, color: c.muted, margin: "20px 0", textAlign: "center" }}>
                  Send a message to this plot owner
                </p>
              )}
              {messages.map((msg) => {
                const isMine = msg.fromUserId === currentUserId;
                const canDelete = isMine || isOwner;
                return (
                  <div key={msg.id} style={{ background: isMine ? c.msgBg : c.msgOwner, borderRadius: 4, padding: "6px 8px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: isMine ? c.accent : c.link }}>
                          {isMine ? "you" : msg.fromUsername}
                        </span>
                        <span style={{ fontFamily: mono, fontSize: 10, color: c.muted, marginLeft: 8 }}>
                          {msg.timestamp?.toDate
                            ? msg.timestamp.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : "..."}
                        </span>
                      </div>
                      {canDelete && (
                        <button onClick={() => handleDelete(msg.id)} style={{
                          background: "none", border: "none", color: c.muted, cursor: "pointer",
                          fontFamily: mono, fontSize: 11, padding: "0 4px", opacity: 0.6,
                        }}>&times;</button>
                      )}
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 11, color: c.text, marginTop: 3, lineHeight: 1.4, wordBreak: "break-word" }}>
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Owner view — grouped threads */}
          {currentUserId && isOwner && (
            <div ref={listRef} style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {(!threadList || threadList.length === 0) && (
                <p style={{ fontFamily: mono, fontSize: 11, color: c.muted, margin: "20px 0", textAlign: "center" }}>
                  No messages on this plot yet
                </p>
              )}
              {threadList && threadList.map((thread) => (
                <div key={thread.threadUserId} style={{
                  border: `1px solid ${replyTarget === thread.threadUserId ? c.accent : c.border}`,
                  borderRadius: 5, padding: "8px 10px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: c.link }}>
                      {thread.threadUsername || "player"}
                    </span>
                    <button
                      onClick={() => setReplyTarget(replyTarget === thread.threadUserId ? null : thread.threadUserId)}
                      style={{ ...btnStyle(replyTarget === thread.threadUserId ? c.accent : c.muted), fontSize: 9, padding: "2px 8px" }}>
                      {replyTarget === thread.threadUserId ? "REPLYING" : "REPLY"}
                    </button>
                  </div>
                  {thread.msgs.map((msg) => {
                    const isMine = msg.fromUserId === currentUserId;
                    return (
                      <div key={msg.id} style={{ background: isMine ? c.msgOwner : c.msgBg, borderRadius: 3, padding: "4px 6px", marginBottom: 3 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 600, color: isMine ? c.accent : c.link }}>
                              {isMine ? "you" : msg.fromUsername}
                            </span>
                            <span style={{ fontFamily: mono, fontSize: 9, color: c.muted, marginLeft: 6 }}>
                              {msg.timestamp?.toDate
                                ? msg.timestamp.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                : "..."}
                            </span>
                          </div>
                          <button onClick={() => handleDelete(msg.id)} style={{
                            background: "none", border: "none", color: c.muted, cursor: "pointer",
                            fontFamily: mono, fontSize: 10, padding: "0 4px", opacity: 0.6,
                          }}>&times;</button>
                        </div>
                        <div style={{ fontFamily: mono, fontSize: 11, color: c.text, marginTop: 2, lineHeight: 1.3, wordBreak: "break-word" }}>
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — input */}
        {currentUserId && (
          <div style={{ padding: "10px 16px 14px", borderTop: `1px solid ${c.border}` }}>
            {isOwner && !replyTarget && threadList && threadList.length > 0 ? (
              <p style={{ fontFamily: mono, fontSize: 10, color: c.muted, margin: 0, textAlign: "center" }}>
                Tap REPLY on a thread to respond
              </p>
            ) : (
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder={isOwner ? "Reply..." : "Message plot owner..."}
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 200))}
                  maxLength={200}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handlePost(isOwner ? replyTarget : undefined);
                    }
                  }}
                  disabled={sending || cooldown > 0}
                  autoFocus
                />
                <button
                  onClick={() => handlePost(isOwner ? replyTarget : undefined)}
                  disabled={sending || cooldown > 0 || !text.trim()}
                  style={{
                    ...btnStyle(cooldown > 0 ? c.muted : c.activeBg),
                    opacity: (sending || cooldown > 0 || !text.trim()) ? 0.5 : 1,
                    minWidth: 56,
                  }}>
                  {cooldown > 0 ? `${cooldown}s` : "SEND"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
