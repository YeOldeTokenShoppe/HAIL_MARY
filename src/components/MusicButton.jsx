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
  // Optional alternate face shown when the music era is "modern" (NOW). Rendered
  // as a round, spinning record (spins only while playing) — a visual cue that
  // the era flipped. Pass a URL like "/virginRecords.jpg". Only used when
  // showModeToggle is on; falls back to `icon` otherwise.
  modernIcon = null,
  // When true, shows a compact "80s | NOW" segmented switch beside the
  // play/pause button that flips the music era (which playlist plays). Off by
  // default so existing drop-ins stay play/pause-only. Don't enable it on pages
  // that pin their own playlist (e.g. the fountain) — the switch wouldn't change
  // anything there.
  showModeToggle = false,
  // When true, the control starts collapsed to a single small music-note button
  // and expands to reveal the era switch + disc face on tap (tapping outside
  // collapses it again). Used to declutter cramped mobile headers.
  collapsible = false,
  // When true, tightens the horizontal footprint of the *expanded* cluster:
  // smaller era-switch text/padding and narrower inter-element gaps. Pair with a
  // smaller `size` on mobile so the toggle + disc (+ skip) don't eat ~half the
  // viewport width. Off by default so existing drop-ins are unaffected.
  compact = false,
}) {
  const { play, pause, isPlaying, isLoadingTrack, nextTrack, musicEra, setMusicEra } = useMusic();

  const label = isLoadingTrack
    ? "Loading music…"
    : isPlaying
    ? "Pause music"
    : "Play music";

  // The active face follows the era when the toggle is shown: the 80s `icon`
  // (synthwave sun) or the modern `modernIcon` (vinyl record).
  const faceSrc = showModeToggle && musicEra === "modern" && modernIcon ? modernIcon : icon;
  const faceIsVideo = /\.(mp4|webm|ogv|mov)$/i.test(faceSrc || "");

  // With the era toggle shown, image faces render as round spinning discs (sun /
  // record). Without it, an icon renders as its plain square self (e.g. the
  // fountain's badge). A video face never renders as a disc.
  const isDisc = showModeToggle && !faceIsVideo && !!faceSrc;

  // Hide the rectangular chrome for self-contained faces (the round record and
  // video faces carry their own visual), so the idle state is just the bare art.
  // Static-image and glyph buttons keep the chrome-on-active behavior.
  const showChrome = isDisc || faceIsVideo ? false : !icon || isPlaying || isLoadingTrack;

  // Drive a video face's playback from the music state: animate while playing,
  // freeze on a frame when paused (mirrors the record's spin-while-playing).
  const videoRef = React.useRef(null);
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) {
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } else {
      v.pause();
    }
  }, [isPlaying, faceIsVideo, faceSrc]);

  // Collapsed mode: render just a music-note button until tapped; expand reveals
  // the full control, and a tap outside collapses it again.
  const containerRef = React.useRef(null);
  const [expanded, setExpanded] = React.useState(false);
  React.useEffect(() => {
    if (!collapsible || !expanded) return;
    const onDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setExpanded(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [collapsible, expanded]);

  const btnStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    // A widescreen video face keeps its native aspect (auto width, fixed
    // height) so it isn't cropped to a square; every other face stays square.
    width: faceIsVideo && !isDisc ? "auto" : size,
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

  // The fixed square that holds non-video faces (image / record / spinner).
  const squareFaceStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: size - 6,
    height: size - 6,
  };

  // Compact two-segment era switch. Active segment is filled with the accent;
  // the inactive one is dimmed. Robust across whatever accent a page passes.
  const segBase = {
    appearance: "none",
    border: "none",
    background: "transparent",
    color: accent,
    fontFamily: "inherit",
    fontSize: compact ? 10 : 11,
    fontWeight: 700,
    letterSpacing: compact ? "0.3px" : "0.5px",
    lineHeight: 1,
    padding: compact ? "4px 6px" : "5px 9px",
    borderRadius: 8,
    cursor: "pointer",
    transition: "background 0.18s ease, color 0.18s ease, opacity 0.18s ease",
  };
  const segStyle = (active) =>
    active
      ? { ...segBase, background: accent, color: "#1b1205", boxShadow: `0 0 8px ${accent}66` }
      : { ...segBase, opacity: 0.55 };

  return (
    <div ref={containerRef} style={{ display: "inline-flex", alignItems: "center", gap: compact ? 4 : 6, ...style }}>
      {collapsible && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          title={title || "Music"}
          aria-label="Show music controls"
          aria-expanded={false}
          style={{
            ...btnStyle,
            width: size,
            background,
            border: `1.5px solid ${borderColor}`,
            boxShadow: isPlaying ? `0 0 10px ${accent}55` : "none",
          }}
        >
          <span
            style={
              isLoadingTrack
                ? { display: "inline-block", animation: "mbSpin 0.9s linear infinite" }
                : undefined
            }
          >
            {isLoadingTrack ? "◌" : "♫"}
          </span>
        </button>
      ) : (
        <>
      {showModeToggle && typeof setMusicEra === "function" && (
        <div
          role="group"
          aria-label="Music era"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            padding: compact ? 2 : 3,
            borderRadius: 10,
            background,
            border: `1.5px solid ${borderColor}`,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setMusicEra("80s")}
            aria-pressed={musicEra !== "modern"}
            title="Play 80s music"
            style={segStyle(musicEra !== "modern")}
          >
            80s
          </button>
          <button
            type="button"
            onClick={() => setMusicEra("modern")}
            aria-pressed={musicEra === "modern"}
            title="Play the mix"
            style={segStyle(musicEra === "modern")}
          >
            MIX
          </button>
        </div>
      )}
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
        {isLoadingTrack ? (
          <span style={squareFaceStyle}>
            <span style={{ display: "inline-block", animation: "mbSpin 0.9s linear infinite" }}>
              ◌
            </span>
          </span>
        ) : faceIsVideo && !isDisc ? (
          // Widescreen clip: fixed height, auto width — the whole frame shows
          // instead of being cropped to a square.
          <video
            ref={videoRef}
            src={faceSrc}
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
            style={{
              height: size - 6,
              width: "auto",
              borderRadius: 8,
              display: "block",
            }}
          />
        ) : (icon || isDisc) ? (
          <span style={squareFaceStyle}>
            {faceIsVideo ? (
              <video
                ref={videoRef}
                src={faceSrc}
                muted
                loop
                playsInline
                preload="auto"
                aria-hidden="true"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  borderRadius: "50%",
                  display: "block",
                  boxShadow: `0 0 0 2px rgba(0,0,0,0.35), 0 0 10px ${accent}55`,
                }}
              />
            ) : isDisc ? (
              <span
                aria-hidden="true"
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  overflow: "hidden",
                  display: "block",
                  backgroundImage: `url('${faceSrc}')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  boxShadow: `0 0 0 2px rgba(0,0,0,0.35), 0 0 10px ${accent}55`,
                  animation: isPlaying ? "mbDisc 4s linear infinite" : "none",
                }}
              />
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
                  animation: isPlaying ? "mbDisc 4s linear infinite" : "none",
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
          style={{ ...btnStyle, width: size, fontSize: 16 }}
        >
          ⏭
        </button>
      )}
        </>
      )}
      <style>{"@keyframes mbSpin{to{transform:rotate(360deg)}}@keyframes mbDisc{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}
