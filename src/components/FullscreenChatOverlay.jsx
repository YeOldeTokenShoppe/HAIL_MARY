"use client";

import React, { useEffect, useRef, useState } from "react";
import { CHAT, SPEAKERS } from "./CouncilChatScreens";

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
export default function FullscreenChatOverlay({
  isActive,
  onClose,
  tapToReturnLabel = "> tap anywhere to return",
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [shownCount, setShownCount] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (isActive) {
      const t = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(t);
    }
    setIsVisible(false);
    setShownCount(0);
  }, [isActive]);

  // Stagger-reveal messages so the panel feels alive on entry. Cap to a
  // reasonable batch — older lines render instantly so the thread reads as
  // already-in-progress, newer ones drip in.
  useEffect(() => {
    if (!isActive) return;
    const PRE_FILLED = Math.max(0, CHAT.length - 8);
    setShownCount(PRE_FILLED);
    let i = PRE_FILLED;
    const id = setInterval(() => {
      i += 1;
      setShownCount(i);
      if (i >= CHAT.length) clearInterval(id);
    }, 380);
    return () => clearInterval(id);
  }, [isActive]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [shownCount]);

  if (!isActive) return null;

  const visibleMessages = CHAT.slice(0, shownCount);

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

        {/* Roster */}
        <div
          style={{
            padding: "0.45rem 0.75rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.4rem 0.6rem",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          }}
        >
          {Object.values(SPEAKERS).map((sp) => (
            <div
              key={sp.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                fontSize: "0.65rem",
                letterSpacing: "0.08em",
                color: "rgba(255,255,255,0.65)",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: sp.color,
                  boxShadow: `0 0 6px ${sp.color}`,
                }}
              />
              {sp.name}
            </div>
          ))}
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
            const isNew = index === shownCount - 1;
            return (
              <div
                key={index}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.2rem",
                  animation: isNew
                    ? "councilChatLineIn 0.35s ease-out"
                    : "none",
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
                  {msg.t}
                </div>
              </div>
            );
          })}
          {shownCount < CHAT.length && (
            <div
              style={{
                fontSize: "0.7rem",
                color: "rgba(77, 255, 170, 0.5)",
                letterSpacing: "0.12em",
                padding: "0.25rem 0.25rem 0.5rem",
              }}
            >
              ...
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
      `}</style>
    </div>
  );
}
