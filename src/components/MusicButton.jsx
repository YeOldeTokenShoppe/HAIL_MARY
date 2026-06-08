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
}) {
  const { play, pause, isPlaying, isLoadingTrack } = useMusic();

  const label = isLoadingTrack
    ? "Loading music…"
    : isPlaying
    ? "Pause music"
    : "Play music";

  return (
    <button
      onClick={() => {
        if (isLoadingTrack) return;
        isPlaying ? pause() : play();
      }}
      title={title || label}
      aria-label={label}
      aria-busy={isLoadingTrack || undefined}
      disabled={isLoadingTrack}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: 10,
        background,
        border: `1.5px solid ${borderColor}`,
        color: accent,
        cursor: isLoadingTrack ? "wait" : "pointer",
        padding: 0,
        flexShrink: 0,
        fontSize: 20,
        fontFamily: "inherit",
        ...style,
      }}
    >
      <span
        style={
          isLoadingTrack
            ? { display: "inline-block", animation: "mbSpin 0.9s linear infinite" }
            : undefined
        }
      >
        {isLoadingTrack ? "◌" : isPlaying ? "⏸" : "♫"}
      </span>
      <style>{"@keyframes mbSpin{to{transform:rotate(360deg)}}"}</style>
    </button>
  );
}
