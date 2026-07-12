"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CHAT, SPEAKERS } from "./CouncilChatScreens";
import ScrambleText from "./ScrambleText";

/**
 * FullscreenChatOverlay
 *
 * Fullscreen view that surfaces the council group chat (the same thread
 * painted onto ScreenA-D in the trade scene) in a readable bubble layout —
 * and, since the live-channel update, lets the visitor JOIN the chat:
 *
 * - Watching: the scripted CHAT thread drips in as ambience, exactly as
 *   before (typing indicator → line lands → gap → repeat, wrapping into
 *   "replaying archive" mode when it runs out).
 * - Joining: a footer CTA generates a wallet-style handle (persisted in
 *   localStorage), announces "<handle> has joined the channel" in the feed,
 *   fires a `councilUserJoined` window event (CouncilChatScreens repaints the
 *   3D screens' header with it), and asks /api/council-chat for the
 *   council's in-character reaction.
 * - Chatting: user messages go to /api/council-chat, which returns 1-3
 *   in-character lines; they drip in through the same typing-indicator
 *   machinery. While a live exchange is pending the ambient scripted drip
 *   holds (holdUntilRef) so the council never talks over its own reply.
 *
 * The feed is a single chronological array (scripted + live + system lines)
 * so live messages interleave correctly; it's trimmed to FEED_CAP so a long
 * session doesn't grow the DOM without bound.
 *
 * UX mirrors FullscreenCRTOverlay: fade in over the dark scrim, tap outside
 * the feed to dismiss, parent handles the screenGoBack dispatch.
 */

// Older lines render instantly so the thread reads as already-in-progress;
// the tail drips in with a typing indicator between each line.
const PRE_FILLED = Math.max(0, CHAT.length - 8);
// When the script runs out, the channel goes quiet for a while, then the
// WHOLE archive replays from the top at a slower cadence — so the memorable
// beats (the gas-refunder reveal) recur every ~5 minutes, not every few
// seconds like the old rewind-to-tail loop did.
const WRAP_PAUSE_MS = 120_000;
const REPLAY_PACE = 3;
const FEED_CAP = 80;
const USER_COLOR = "#ffd166"; // visitor gold — distinct from the four council colors
const MAX_DRAFT = 240;

// Wallet-style anon handle, sticky per browser so the council "recognizes"
// returning visitors across sessions.
function loadHandle() {
  try {
    let h = localStorage.getItem("council_handle");
    if (!h || !/^0x[0-9A-F]{4}$/.test(h)) {
      const bytes =
        typeof crypto !== "undefined" && crypto.getRandomValues
          ? crypto.getRandomValues(new Uint8Array(2))
          : [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
      h = "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
      localStorage.setItem("council_handle", h);
    }
    return h;
  } catch {
    return "0xGUEST";
  }
}

export default function FullscreenChatOverlay({
  isActive,
  onClose,
  tapToReturnLabel = "> tap anywhere to return",
}) {
  const [isVisible, setIsVisible] = useState(false);
  // Unified chronological feed: {id, kind: 'chat'|'user'|'sys', s?, t}
  const [feed, setFeed] = useState([]);
  const [typingFor, setTypingFor] = useState(null);
  const [replaying, setReplaying] = useState(false);
  // Live-channel state. `joined` + `handle` survive close/reopen within the
  // page session (component stays mounted); the feed itself reseeds.
  const [joined, setJoined] = useState(false);
  const [handle, setHandle] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const idRef = useRef(0);
  const scriptIdxRef = useRef(PRE_FILLED);
  // Mirrors `replaying` for the drip closure (state would be stale there).
  const replayingRef = useRef(false);
  // Ambient scripted drip pauses while Date.now() < holdUntilRef.current —
  // set whenever a live exchange is in flight or just landed.
  const holdUntilRef = useRef(0);
  const cancelledRef = useRef(true);
  const timersRef = useRef(new Set());
  const abortRef = useRef(null);
  // API-shaped history for /api/council-chat (user text + tagged council lines).
  const convoRef = useRef([]);

  const wait = useCallback((ms, fn) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id);
      if (!cancelledRef.current) fn();
    }, ms);
    timersRef.current.add(id);
  }, []);

  const sleep = useCallback((ms) => new Promise((resolve) => wait(ms, resolve)), [wait]);

  const appendFeed = useCallback((item) => {
    setFeed((prev) => [...prev, { id: ++idRef.current, ...item }].slice(-FEED_CAP));
  }, []);

  useEffect(() => {
    if (isActive) {
      const t = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(t);
    }
    setIsVisible(false);
    return undefined;
  }, [isActive]);

  // Session start/stop: seed the feed with the thread already-in-progress and
  // run the ambient drip loop. The loop defers politely (without landing a
  // line) while a live exchange holds the channel.
  useEffect(() => {
    if (!isActive) return undefined;

    cancelledRef.current = false;
    idRef.current = 0;
    setFeed(
      CHAT.slice(0, PRE_FILLED)
        .slice(-FEED_CAP)
        .map((m) => ({ id: ++idRef.current, kind: "chat", s: m.s, t: m.t }))
    );
    scriptIdxRef.current = PRE_FILLED;
    holdUntilRef.current = 0;
    replayingRef.current = false;
    setTypingFor(null);
    setReplaying(false);
    setSending(false);

    const step = () => {
      if (holdUntilRef.current > Date.now()) {
        wait(600, step);
        return;
      }
      const idx = scriptIdxRef.current;
      if (idx >= CHAT.length) {
        // Script exhausted: long quiet beat, then replay the whole archive
        // from the top (slower — see REPLAY_PACE) so nothing recycles fast.
        wait(WRAP_PAUSE_MS, () => {
          replayingRef.current = true;
          setReplaying(true);
          scriptIdxRef.current = 0;
          wait(800, step);
        });
        return;
      }
      const next = CHAT[idx];
      const pace = replayingRef.current ? REPLAY_PACE : 1;
      const typingMs = (480 + Math.min(900, next.t.length * 14)) * pace;
      setTypingFor(next.s);
      wait(typingMs, () => {
        // A live exchange grabbed the channel mid-typing — back off cleanly.
        if (holdUntilRef.current > Date.now()) {
          setTypingFor(null);
          wait(600, step);
          return;
        }
        setTypingFor(null);
        appendFeed({ kind: "chat", s: next.s, t: next.t });
        scriptIdxRef.current = idx + 1;
        wait((280 + Math.random() * 240) * pace, step);
      });
    };
    wait(550, step);

    const timers = timersRef.current;
    return () => {
      cancelledRef.current = true;
      timers.forEach(clearTimeout);
      timers.clear();
      abortRef.current?.abort();
    };
  }, [isActive, wait, appendFeed]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [feed, typingFor, sending]);

  // Send a user turn to the council and drip its reply lines through the
  // same typing-indicator machinery as the scripted thread.
  const requestCouncil = useCallback(
    async (userContent) => {
      convoRef.current = [...convoRef.current, { role: "user", content: userContent }].slice(-12);
      setSending(true);
      holdUntilRef.current = Date.now() + 20_000;
      try {
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        const res = await fetch("/api/council-chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: convoRef.current, handle: loadHandle() }),
          signal: ctrl.signal,
        });
        const data = await res.json().catch(() => null);
        const lines = Array.isArray(data?.lines) ? data.lines : [];
        if ((!res.ok && res.status !== 429) || !lines.length) {
          throw new Error(`council-chat ${res.status}`);
        }
        // Rate-limit rebuffs are delivered in character but kept out of the
        // transcript so the council doesn't loop on its own scolding.
        if (res.status !== 429) {
          convoRef.current = [
            ...convoRef.current,
            { role: "assistant", content: lines.map((l) => `[${SPEAKERS[l.s]?.name || l.s}] ${l.t}`).join("\n") },
          ].slice(-12);
        }
        for (const line of lines) {
          if (cancelledRef.current) return;
          holdUntilRef.current = Date.now() + 20_000;
          setTypingFor(line.s);
          await sleep(420 + Math.min(900, line.t.length * 12));
          if (cancelledRef.current) return;
          setTypingFor(null);
          appendFeed({ kind: "chat", s: line.s, t: line.t });
          await sleep(260 + Math.random() * 200);
        }
      } catch (err) {
        if (!cancelledRef.current && err?.name !== "AbortError") {
          appendFeed({ kind: "sys", t: "interference on the channel · transmission lost" });
        }
      } finally {
        if (!cancelledRef.current) {
          setSending(false);
          // Give the exchange a beat of silence before the archive resumes.
          holdUntilRef.current = Date.now() + 6000;
        }
      }
    },
    [appendFeed, sleep],
  );

  const joinChannel = useCallback(() => {
    const h = loadHandle();
    setHandle(h);
    setJoined(true);
    appendFeed({ kind: "sys", t: `${h} has joined the channel` });
    // Let the 3D screens (CouncilChatScreens) repaint their header strip.
    try {
      window.dispatchEvent(new CustomEvent("councilUserJoined", { detail: { handle: h } }));
    } catch {
      /* non-fatal */
    }
    requestCouncil(`*${h} has joined the channel*`);
    wait(80, () => inputRef.current?.focus());
  }, [appendFeed, requestCouncil, wait]);

  const sendDraft = useCallback(
    (e) => {
      e?.preventDefault?.();
      const text = draft.trim().slice(0, MAX_DRAFT);
      if (!text || sending) return;
      setDraft("");
      appendFeed({ kind: "user", t: text });
      requestCouncil(text);
    },
    [draft, sending, appendFeed, requestCouncil],
  );

  if (!isActive) return null;

  const typingSpeaker = typingFor ? SPEAKERS[typingFor] : null;
  // Five council accounts (four desks + Our Lady), plus the visitor.
  const participants = joined ? 6 : 5;

  return (
    <div
      onClick={() => onClose?.()}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background:
          "radial-gradient(ellipse at center, #0a0612 0%, #000000 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "1.25rem 0.75rem 1.5rem",
        fontFamily: "ui-monospace, 'JetBrains Mono', 'Courier New', monospace",
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.4s ease-in-out",
      }}
    >
      {/* Scanlines */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0px, rgba(0,0,0,0.18) 1px, transparent 1px, transparent 3px)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "560px",
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          zIndex: 3,
        }}
      >
        {/* Header strip */}
        <div
          style={{
            padding: "0.5rem 0.75rem",
            borderBottom: "1px solid rgba(77, 255, 170, 0.25)",
            color: "#4dffaa",
            fontSize: "0.7rem",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            opacity: 0.85,
          }}
        >
          <span>{"// COUNCIL CHANNEL"}</span>
          <span style={{ opacity: 0.65 }}>{participants} PARTICIPANTS · LIVE</span>
        </div>

        {/* Replay ribbon — only after the feed wraps */}
        {replaying && (
          <div
            style={{
              padding: "0.3rem 0.75rem",
              color: "#ffae5c",
              fontSize: "0.6rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              borderBottom: "1px solid rgba(255,174,92,0.2)",
              background: "rgba(255,174,92,0.05)",
              animation: "councilReplayPulse 2.4s ease-in-out infinite",
            }}
          >
            {"// replaying archive — ch 04"}
          </div>
        )}

        {/* Roster — dot pulses for whoever is currently typing */}
        <div
          style={{
            padding: "0.45rem 0.75rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.4rem 0.6rem",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          {Object.entries(SPEAKERS).map(([key, sp]) => {
            const active = typingFor === key;
            return (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontSize: "0.65rem",
                  letterSpacing: "0.08em",
                  color: active
                    ? "rgba(255,255,255,0.95)"
                    : "rgba(255,255,255,0.55)",
                  transition: "color 0.2s",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: sp.color,
                    boxShadow: active
                      ? `0 0 12px ${sp.color}, 0 0 4px ${sp.color}`
                      : `0 0 4px ${sp.color}66`,
                    opacity: active ? 1 : 0.55,
                    transition: "opacity 0.2s, box-shadow 0.2s",
                  }}
                />
                {sp.name}
              </div>
            );
          })}
          {joined && handle && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                fontSize: "0.65rem",
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.75)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: USER_COLOR,
                  boxShadow: `0 0 6px ${USER_COLOR}`,
                  opacity: 0.8,
                }}
              />
              {handle}
            </div>
          )}
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "0.85rem 0.5rem 1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.65rem",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {feed.map((msg) => {
            if (msg.kind === "sys") {
              return (
                <div
                  key={msg.id}
                  style={{
                    textAlign: "center",
                    fontSize: "0.65rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: `${USER_COLOR}aa`,
                    padding: "0.15rem 0",
                    animation: "councilChatLineIn 0.35s ease-out",
                  }}
                >
                  — {msg.t} —
                </div>
              );
            }
            const isUser = msg.kind === "user";
            const speaker = isUser
              ? { name: handle || "YOU", color: USER_COLOR }
              : SPEAKERS[msg.s];
            if (!speaker) return null;
            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.2rem",
                  animation: "councilChatLineIn 0.35s ease-out",
                }}
              >
                <div
                  style={{
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    color: speaker.color,
                    textShadow: `0 0 6px ${speaker.color}55`,
                  }}
                >
                  [{speaker.name}]
                </div>
                <div
                  style={{
                    fontSize: "0.95rem",
                    lineHeight: 1.45,
                    color: "#dceadf",
                    background: "rgba(20, 26, 28, 0.72)",
                    border: `1px solid ${speaker.color}33`,
                    borderRadius: 8,
                    padding: "0.55rem 0.75rem",
                    boxShadow: `inset 0 0 14px ${speaker.color}10`,
                    wordBreak: "break-word",
                  }}
                >
                  {isUser ? (
                    msg.t
                  ) : (
                    <ScrambleText
                      as="span"
                      duration={420 + Math.min(700, msg.t.length * 12)}
                      revealRate={28}
                      settleRate={18}
                      replayOnHover={false}
                    >
                      {msg.t}
                    </ScrambleText>
                  )}
                </div>
              </div>
            );
          })}

          {typingSpeaker && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.2rem",
                animation: "councilChatLineIn 0.2s ease-out",
              }}
            >
              <div
                style={{
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  color: typingSpeaker.color,
                  textShadow: `0 0 6px ${typingSpeaker.color}55`,
                }}
              >
                [{typingSpeaker.name}]
              </div>
              <div
                style={{
                  alignSelf: "flex-start",
                  background: "rgba(20, 26, 28, 0.5)",
                  border: `1px dashed ${typingSpeaker.color}55`,
                  borderRadius: 8,
                  padding: "0.55rem 0.85rem",
                  display: "inline-flex",
                  gap: "0.32rem",
                  alignItems: "center",
                }}
              >
                {[0, 0.18, 0.36].map((delay) => (
                  <span
                    key={delay}
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: typingSpeaker.color,
                      boxShadow: `0 0 6px ${typingSpeaker.color}`,
                      animation: `councilTypingPulse 1.2s ease-in-out ${delay}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Neutral routing indicator between send and the council's reply */}
          {sending && !typingSpeaker && (
            <div
              style={{
                alignSelf: "flex-start",
                display: "inline-flex",
                gap: "0.32rem",
                alignItems: "center",
                padding: "0.35rem 0.2rem",
              }}
            >
              {[0, 0.18, 0.36].map((delay) => (
                <span
                  key={delay}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.35)",
                    animation: `councilTypingPulse 1.2s ease-in-out ${delay}s infinite`,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer — join CTA before joining, input bar after */}
        {!joined ? (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: "0.65rem 0.75rem 0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.55rem",
            }}
          >
            <button
              type="button"
              onClick={joinChannel}
              style={{
                background: "rgba(255, 209, 102, 0.06)",
                border: `1px solid ${USER_COLOR}66`,
                borderRadius: 6,
                color: USER_COLOR,
                fontFamily: "inherit",
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                padding: "0.55rem 1.2rem",
                cursor: "pointer",
                textShadow: `0 0 8px ${USER_COLOR}66`,
                boxShadow: `0 0 14px ${USER_COLOR}22`,
              }}
            >
              ⚡ join the channel
            </button>
            <div
              style={{
                color: "#4dffaa",
                fontSize: "0.7rem",
                opacity: 0.7,
                letterSpacing: "0.08em",
                textAlign: "center",
              }}
            >
              {tapToReturnLabel}
            </div>
          </div>
        ) : (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: "0.65rem 0.75rem 0",
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
            }}
          >
            <form
              onSubmit={sendDraft}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <span
                style={{
                  color: USER_COLOR,
                  fontSize: "0.62rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  whiteSpace: "nowrap",
                }}
              >
                {handle}
              </span>
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={MAX_DRAFT}
                placeholder="transmit to the council…"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                style={{
                  flex: 1,
                  minWidth: 0,
                  background: "rgba(20, 26, 28, 0.72)",
                  border: `1px solid ${USER_COLOR}44`,
                  borderRadius: 8,
                  color: "#dceadf",
                  fontFamily: "inherit",
                  // 16px floor prevents iOS Safari's focus-zoom
                  fontSize: "16px",
                  lineHeight: 1.4,
                  padding: "0.5rem 0.7rem",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                aria-label="Send"
                style={{
                  background: "transparent",
                  border: `1px solid ${USER_COLOR}66`,
                  borderRadius: 8,
                  color: USER_COLOR,
                  fontFamily: "inherit",
                  fontSize: "0.9rem",
                  padding: "0.45rem 0.75rem",
                  cursor: !draft.trim() || sending ? "default" : "pointer",
                  opacity: !draft.trim() || sending ? 0.35 : 0.9,
                  transition: "opacity 0.2s",
                }}
              >
                ▶
              </button>
            </form>
            <div
              style={{
                color: "#4dffaa",
                fontSize: "0.6rem",
                opacity: 0.5,
                letterSpacing: "0.08em",
                textAlign: "center",
              }}
            >
              {sending ? "> routing transmission…" : "> tap outside the feed to return"}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes councilChatLineIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes councilTypingPulse {
          0%,
          60%,
          100% {
            opacity: 0.25;
            transform: scale(0.85);
          }
          30% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes councilReplayPulse {
          0%,
          100% {
            opacity: 0.55;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
