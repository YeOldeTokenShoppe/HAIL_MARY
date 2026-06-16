"use client";

import React from "react";
import { useMusic } from "@/components/MusicContext";

/**
 * Shared play/pause music control. Drives the single global audio instance
 * (window.__globalAudioInstance) via MusicContext, so it stays in sync across
 * every page and survives navigation. Drop it into any page header:
 *
 *   <MusicButton accent={theme.accent} />
 *
 * Pages don't need to wire up useMusic themselves — this owns the context.
 */
export default function MusicButton({
  accent = "#d4a854",
  background = "rgba(212, 175, 55, 0.05)",
  borderColor = "rgba(212, 175, 55, 0.2)",
  size = 40,
  style = {},
  title,
  // Optional image used as the button face on BOTH play and pause states.
  // Deliberately left as a bare, unlabeled "easter egg" — no play/pause
  // glyph over it. The control reveals its chrome (border + background)
  // only once active (playing or loading) so a click gives feedback
  // without cluttering the idle state. Pass a URL like "/icon80.svg".
  // When omitted, the button falls back to ♫ / ⏸ glyphs.
  icon = null,
}) {
  const { play, pause, isPlaying, isLoadingTrack, nextTrack } = useMusic();

  const label = isLoadingTrack
    ? "Loading music…"
    : isPlaying
    ? "Pause music"
    : "Play music";

  // For an icon-faced button, hide the chrome until the control is active
  // so the idle state is just the bare image. Glyph-only buttons keep their
  // chrome at all times (the glyph alone reads as too faint without it).
  const showChrome = !icon || isPlaying || isLoadingTrack;

  const btnStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: size,
    height: size,
    borderRadius: 10,
    background: showChrome ? background : "transparent",
    border: `1.5px solid ${showChrome ? borderColor : "transparent"}`,
    color: accent,
    cursor: isLoadingTrack ? "wait" : "pointer",
    padding: 0,
    flexShrink: 0,
    fontSize: 20,
    fontFamily: "inherit",
    transition: "background 0.2s ease, border-color 0.2s ease",
  };

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, ...style }}>
      <button
        onClick={() => {
          if (isLoadingTrack) return;
          isPlaying ? pause() : play();
        }}
        title={title || label}
        aria-label={label}
        aria-busy={isLoadingTrack || undefined}
        disabled={isLoadingTrack}
        style={btnStyle}
      >
        {icon ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: size - 6,
              height: size - 6,
            }}
          >
            {isLoadingTrack ? (
              <span style={{ display: "inline-block", animation: "mbSpin 0.9s linear infinite" }}>
                ◌
              </span>
            ) : (
              <img
                src={icon}
                alt=""
                aria-hidden="true"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  borderRadius: 8,
                  display: "block",
                }}
              />
            )}
          </span>
        ) : (
          <span
            style={
              isLoadingTrack
                ? { display: "inline-block", animation: "mbSpin 0.9s linear infinite" }
                : undefined
            }
          >
            {isLoadingTrack ? "◌" : isPlaying ? "⏸" : "♫"}
          </span>
        )}
      </button>
      {isPlaying && typeof nextTrack === "function" && (
        <button
          onClick={() => {
            if (isLoadingTrack) return;
            nextTrack();
          }}
          title="Skip track"
          aria-label="Skip to next track"
          disabled={isLoadingTrack}
          style={{ ...btnStyle, fontSize: 16 }}
        >
          ⏭
        </button>
      )}
      <style>{"@keyframes mbSpin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}
