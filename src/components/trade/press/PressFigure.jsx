"use client";
import React, { useEffect, useRef, useState } from "react";
import { adviserMouth } from "@/lib/adviserMouth";

// PRESS FIGURE — Barron on a surface with no 3D, talking.
//
// Driven by `adviserMouth`, the module-singleton RMS bridge /main already uses:
// counselSpeech runs an AnalyserNode over the decoded ElevenLabs buffer and
// writes one amplitude scalar per frame; a rAF loop here reads it and picks a
// frame. Not React state — the per-frame writes must never re-render.
//
// WHY THIS EXISTS: mobile has no SitePal (the host embed is gated on
// !isMobileView), so the face-projection lip-sync desktop uses is unavailable.
// But an amplitude scalar is renderer-agnostic — the same signal that rotates
// Eugene's jaw bone in R3F picks a sprite here. The happy consequence is that
// mobile can voice ANY generated line, while desktop is stuck with the clips
// someone hand-uploaded to SitePal's Audio Manager.
//
// TWO FRAMES, NOT THREE. /main's shoulder figures use three transparent mouth
// overlays registered to a body.png. Barron's headshots are full opaque frames
// (closed / open) at identical 1254x1254 registration, so this stacks the two
// whole images and cross-fades opacity instead. Fewer states, but a short
// cross-fade reads smoother than a hard sprite swap at this size.
//
// The grey plate behind him isn't transparent, so rather than fight it the
// figure is framed as a LIVE VIDEO FEED — border, scanlines, ON AIR lamp. In a
// CRT terminal that reads as intentional: you're not in the room with him,
// you're on a call.

const FRAMES = [
  { key: "closed", src: "/barron-headshot.png" },
  { key: "open", src: "/barron-headshot2.png" },
];

// Open at the same level /main opens its mid frame — measured against real
// ElevenLabs output, and paired with counselSpeech.speakingLevel's per-line
// normalisation (95th percentile, not max: one plosive sets a max that makes
// the whole line read as closed).
const OPEN_AT = 0.12;

export default function PressFigure({ speaking = false, voice = "JB", className = "" }) {
  const refs = useRef({});
  // One failed load retires the mouth for the session — a broken-image glyph
  // on his face is far worse than a still portrait.
  const [artBroken, setArtBroken] = useState(false);

  useEffect(() => {
    if (!speaking) return;
    let raf;
    let smoothed = 0;
    const tick = () => {
      // Smoothed past the analyser's own smoothing: raw RMS chatters on
      // sibilants and reads as flicker rather than as speech.
      smoothed += ((adviserMouth[voice] || 0) - smoothed) * 0.45;
      const open = smoothed >= OPEN_AT;
      if (refs.current.open) refs.current.open.style.opacity = open ? "1" : "0";
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      if (refs.current.open) refs.current.open.style.opacity = "0";
    };
  }, [speaking, voice]);

  return (
    <div className={`pf-feed ${speaking ? "live" : ""} ${className}`} aria-hidden="true">
      <style>{CSS}</style>
      <div className="pf-feed-inner">
        {FRAMES.map((f) => (
          <img
            key={f.key}
            ref={(el) => { refs.current[f.key] = el; }}
            className={`pf-frame pf-${f.key}`}
            src={f.src}
            alt=""
            onError={() => { if (f.key === "open") setArtBroken(true); }}
            style={{ opacity: f.key === "closed" ? 1 : 0, display: f.key === "open" && artBroken ? "none" : "block" }}
          />
        ))}
        <span className="pf-scan" />
      </div>
      <span className="pf-lamp">{speaking ? "● ON AIR" : "○ STANDBY"}</span>
      <span className="pf-cap">JOHN BARRON · LIVE</span>
    </div>
  );
}

const CSS = `
.pf-feed { position:relative; height:100%; aspect-ratio:1/1; flex:none;
  border:1px solid rgba(47,214,214,0.35); background:#1c1c1c; overflow:hidden;
  box-shadow:0 0 0 1px rgba(0,0,0,0.5) inset; transition:box-shadow .2s ease; }
.pf-feed.live { border-color:rgba(255,45,111,0.55);
  box-shadow:0 0 22px rgba(255,45,111,0.28), 0 0 0 1px rgba(0,0,0,0.5) inset; }
.pf-feed-inner { position:absolute; inset:0; }
.pf-frame { position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
  object-position:center 44%; pointer-events:none;
  transition:opacity .06s linear;
  /* CROPPED IN ON THE FACE. The source is a head-and-shoulders plate at
     1254x1254; shown whole in a ~200px tile his mouth is a few pixels and the
     talking reads as nothing. Scaling about the face puts the mouth at a size
     you can actually watch, which is the entire point of the rig. */
  transform:scale(1.05); transform-origin:50% 46%; }
.pf-scan { position:absolute; inset:0; pointer-events:none; z-index:3;
  background:repeating-linear-gradient(180deg, rgba(0,0,0,0.22) 0 1px, transparent 1px 3px); }
.pf-lamp { position:absolute; top:7px; right:9px; z-index:4;
  font:bold 9px/1 'Courier New', monospace; letter-spacing:0.12em;
  color:rgba(191,238,222,0.55); }
.pf-feed.live .pf-lamp { color:#ff2d6f; text-shadow:0 0 9px rgba(255,45,111,0.75); }
.pf-cap { position:absolute; left:9px; bottom:7px; z-index:4;
  font:bold 8.5px/1 'Courier New', monospace; letter-spacing:0.12em;
  color:rgba(234,255,249,0.55); }
`;
