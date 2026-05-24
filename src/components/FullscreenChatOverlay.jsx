"use client";

import React, { useEffect, useRef, useState } from "react";
import { CHAT, SPEAKERS } from "./CouncilChatScreens";
import ScrambleText from "./ScrambleText";

/**
 * FullscreenChatOverlay
 *
 * Mobile-only fullscreen view that surfaces the council group chat (the same
 * thread painted onto ScreenA-D in the trade scene) in a readable bubble
 * layout. Triggered after the camera flies in to one of the secondary screens
 * — at phone resolution the canvas-painted screen is unreadable.
 *
 * UX mirrors FullscreenCRTOverlay: fade in over the dark scrim, tap anywhere
 * to dismiss, parent handles the screenGoBack dispatch.
 */

// Older lines render instantly so the thread reads as already-in-progress;
// the tail drips in with a typing indicator between each line.
const PRE_FILLED = Math.max(0, CHAT.length - 8);

export default function FullscreenChatOverlay({
  isActive,
  onClose,
  tapToReturnLabel = "> tap anywhere to return",
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [shownCount, setShownCount] = useState(0);
  const [typingFor, setTypingFor] = useState(null);
  const [replaying, setReplaying] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (isActive) {
      const t = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(t);
    }
    setIsVisible(false);
    setShownCount(0);
    setTypingFor(null);
    setReplaying(false);
  }, [isActive]);

  // Drip-feed loop: typing indicator → message lands → short gap → repeat.
  // When CHAT runs out, pause, flip to "replaying archive" mode, rewind to
  // PRE_FILLED and continue so the feed never freezes.
  useEffect(() => {
    if (!isActive) return undefined;
    setShownCount(PRE_FILLED);
    setTypingFor(null);

    let cancelled = false;
    const timers = new Set();
    const wait = (ms, fn) => {
      const id = setTimeout(() => {
        timers.delete(id);
        if (!cancelled) fn();
      }, ms);
      timers.add(id);
    };

    const dripFrom = (start) => {
      if (start >= CHAT.length) {
        wait(3000, () => {
          setReplaying(true);
          setShownCount(PRE_FILLED);
          setTypingFor(null);
          wait(800, () => dripFrom(PRE_FILLED));
        });
        return;
      }
      const next = CHAT[start];
      const typingMs = 480 + Math.min(900, next.t.length * 14);
      setTypingFor(next.s);
      wait(typingMs, () => {
        setTypingFor(null);
        setShownCount(start + 1);
        const gapMs = 280 + Math.random() * 240;
        wait(gapMs, () => dripFrom(start + 1));
      });
    };

    wait(550, () => dripFrom(PRE_FILLED));

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [isActive]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [shownCount, typingFor]);

  if (!isActive) return null;

  const visibleMessages = CHAT.slice(0, shownCount);
  const typingSpeaker = typingFor ? SPEAKERS[typingFor] : null;

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
          <span>// COUNCIL CHANNEL</span>
          <span style={{ opacity: 0.65 }}>4 PARTICIPANTS · LIVE</span>
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
            // replaying archive — ch 04
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
          {visibleMessages.map((msg, index) => {
            const speaker = SPEAKERS[msg.s];
            return (
              <div
                key={index}
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
                  <ScrambleText
                    as="span"
                    duration={420 + Math.min(700, msg.t.length * 12)}
                    revealRate={28}
                    settleRate={18}
                    replayOnHover={false}
                  >
                    {msg.t}
                  </ScrambleText>
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
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: "0.65rem 0.75rem 0",
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
