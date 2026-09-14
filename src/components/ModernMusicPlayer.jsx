"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMusic } from "@/components/MusicContext";

// One look for page control buttons (this music player, /fountain's camera),
// taken from the pages' social-stack buttons: dark fill, gold ring, gold glyph.
// Sized in px like those buttons — this site's rem is 18.67px, not 16px, so
// rem-sized controls come out ~17% bigger than their px neighbours.
export const GOLD_CONTROL = {
  background: "rgba(0, 0, 0, 0.5)",
  border: "2px solid rgba(212, 175, 55, 0.65)",
  color: "#d4a854",
  padding: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.3s ease",
};

export const goldHover = {
  onMouseEnter: (e) => {
    e.currentTarget.style.backgroundColor = "rgba(212, 175, 55, 0.15)";
    e.currentTarget.style.boxShadow = "0 0 15px rgba(212, 175, 55, 0.5)";
    e.currentTarget.style.transform = "scale(1.1)";
  },
  onMouseLeave: (e) => {
    e.currentTarget.style.backgroundColor = GOLD_CONTROL.background;
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.transform = "scale(1)";
  },
};

const normalizePath = (p) => (p || "").replace(/^\//, "");

// /old_landing's music player — a music-note button that opens into a spinning
// disc (play/pause), skip, and close — in gold page-control style.
//
// While mounted it keeps playback on the modern `non80sTracks` bucket, so mount
// it on every viewport and use `visible` to hide the buttons (e.g. on phones);
// the playlist rule then holds page-wide. `border` sets the ring to match the
// host page's social buttons.
export default function ModernMusicPlayer({
  visible = true,
  border = GOLD_CONTROL.border,
  className,
  style,
}) {
  const {
    play,
    pause,
    isPlaying,
    nextTrack,
    loadTrack,
    currentTrack,
    isLoadingTrack,
    non80sTracks,
    pagePlaylistOverride,
    setPagePlaylistOverride,
  } = useMusic();

  // The override governs every pick the context makes on its own (first play,
  // skip, auto-advance); a song from another page that's already loaded on
  // arrival is outside its reach, so that case is handled below and in
  // startMusic.
  useEffect(() => {
    setPagePlaylistOverride(non80sTracks);
    return () => setPagePlaylistOverride(null);
  }, [non80sTracks, setPagePlaylistOverride]);

  const isModernTrack = useCallback((track) => {
    const key = normalizePath(track?.path);
    return non80sTracks.some((t) => normalizePath(t.path) === key);
  }, [non80sTracks]);

  const playRandomModernTrack = useCallback(() => {
    loadTrack(Math.floor(Math.random() * non80sTracks.length), true);
  }, [loadTrack, non80sTracks]);

  // An 80s song still playing from another page is swapped for a modern one.
  // Wait until the override is live — loadTrack resolves its index against the
  // current playlist. Once per visit.
  const arrivalSwapDone = useRef(false);
  useEffect(() => {
    if (arrivalSwapDone.current || pagePlaylistOverride !== non80sTracks) return;
    arrivalSwapDone.current = true;
    if (isPlaying && currentTrack && !isModernTrack(currentTrack)) {
      playRandomModernTrack();
    }
  }, [pagePlaylistOverride, non80sTracks, isPlaying, currentTrack, isModernTrack, playRandomModernTrack]);

  const [showControls, setShowControls] = useState(isPlaying);
  useEffect(() => {
    if (isPlaying) setShowControls(true);
  }, [isPlaying]);

  // Resume only a modern track; an 80s song left paused by another page is
  // replaced, so pressing play never brings the 80s bucket back.
  const startMusic = useCallback(() => {
    if (isLoadingTrack) return;
    if (currentTrack && !isModernTrack(currentTrack)) playRandomModernTrack();
    else play();
  }, [isLoadingTrack, currentTrack, isModernTrack, playRandomModernTrack, play]);

  if (!visible) return null;

  const control = { ...GOLD_CONTROL, border };

  return (
    <div className={className} style={style}>
      {/* Own keyframe so the disc spins on any page, whatever that page defines. */}
      <style jsx global>{`
        @keyframes modernMusicPlayerSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      {!showControls ? (
        <button
          type="button"
          onClick={() => {
            setShowControls(true);
            if (!isPlaying) startMusic();
          }}
          {...goldHover}
          style={{
            ...control,
            width: "48px",
            height: "48px",
            borderRadius: "10px",
          }}
          title="Play music"
          aria-label="Play music"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </button>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {/* Spinning album art — play/pause. The ring is drawn over the art's
              edge (border-box origin) so it matches the other rings. */}
          <button
            type="button"
            onClick={() => (isPlaying ? pause() : startMusic())}
            title={isPlaying ? "Pause music" : "Play music"}
            aria-label={isPlaying ? "Pause music" : "Play music"}
            style={{
              width: "48px",
              height: "48px",
              padding: 0,
              border,
              borderRadius: "50%",
              overflow: "hidden",
              animation: isPlaying ? "modernMusicPlayerSpin 4s linear infinite" : "none",
              cursor: "pointer",
              backgroundImage: "url('/virginRecords.jpg')",
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundOrigin: "border-box",
            }}
          />

          {/* Skip Button */}
          <button
            type="button"
            onClick={() => nextTrack()}
            {...goldHover}
            style={{
              ...control,
              width: "36px",
              height: "36px",
              borderRadius: "8px",
            }}
            title="Next Track"
            aria-label="Next track"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 4 15 12 5 20 5 4"/>
              <line x1="19" y1="5" x2="19" y2="19"/>
            </svg>
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={() => {
              setShowControls(false);
              pause();
            }}
            {...goldHover}
            style={{
              ...control,
              width: "30px",
              height: "30px",
              borderRadius: "8px",
            }}
            title="Close Music"
            aria-label="Close music"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
