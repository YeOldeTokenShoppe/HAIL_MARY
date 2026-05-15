import React, { useState, useEffect, useMemo, useRef } from 'react';

// LiveCaption — renders one sentence at a time as a subtitle, paced by
// elapsed character count over the audio's playback. Splits on the same
// terminators ProgressiveText uses so visual chunks match natural pauses.
//
// Props:
//   text       — full line being spoken. Caption resets when this changes.
//   isPlaying  — boolean from parent (e.g. speechActive). The timer only
//                advances while true. Pausing freezes on the current chunk.
//   style      — outer container style (lets the parent position it).
//   onDone     — optional callback fired when the last chunk has elapsed.

const MS_PER_CHAR = 70;
// Match ProgressiveText's floor — raised again from 1500ms because short
// chunks like Barron's "Cheaply. Loudly. Badly." were still finishing
// before the voice acting on mobile.
const MIN_CHUNK_MS = 2200;
const TICK_MS = 120;

function splitIntoChunks(text) {
  if (!text) return [];
  const parts = text.match(/[^.!?—]+[.!?—]+\s*|[^.!?—]+$/g) || [text];
  return parts.map((s) => s.trim()).filter(Boolean);
}

export default function LiveCaption({ text, isPlaying, style, onDone, audioDurationMs = null }) {
  const chunks = useMemo(() => splitIntoChunks(text), [text]);
  const [index, setIndex] = useState(0);
  // Tracks whether the audio for THIS line ever started. Lets us
  // distinguish "audio hasn't begun yet" (initial isPlaying=false; show
  // the first chunk so the player has something to read while the 900ms
  // camera fly-in lands) from "audio just finished" (isPlaying flipped
  // false after being true; hide the caption so the last word — e.g.
  // "Badly." — doesn't sit on screen indefinitely).
  const [hasPlayed, setHasPlayed] = useState(false);
  const startRef = useRef(null);
  const elapsedRef = useRef(0);
  const tickRef = useRef(null);

  // Reset when the text changes.
  useEffect(() => {
    setIndex(0);
    setHasPlayed(false);
    startRef.current = null;
    elapsedRef.current = 0;
  }, [chunks]);

  useEffect(() => {
    if (isPlaying) setHasPlayed(true);
  }, [isPlaying]);

  // Tick while playing. Pausing accumulates elapsedRef so we resume
  // from the same chunk on the next start.
  useEffect(() => {
    if (!isPlaying || chunks.length === 0) {
      if (startRef.current != null) {
        elapsedRef.current += Date.now() - startRef.current;
        startRef.current = null;
      }
      return;
    }
    startRef.current = Date.now();
    if (tickRef.current) clearInterval(tickRef.current);
    // Precompute per-chunk delays so the tick loop just compares elapsed
    // against a static cumulative table. When `audioDurationMs` is set,
    // distribute proportionally to char counts so chunks land in sync
    // with the actual recording. Otherwise use the char-pacing math.
    const totalChars = chunks.reduce((sum, c) => sum + c.length, 0) || 1;
    const useDuration = audioDurationMs && audioDurationMs > 0;
    tickRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = elapsedRef.current + (now - (startRef.current ?? now));
      let cumulative = 0;
      for (let i = 0; i < chunks.length; i++) {
        cumulative += useDuration
          ? (chunks[i].length / totalChars) * audioDurationMs
          : Math.max(MIN_CHUNK_MS, chunks[i].length * MS_PER_CHAR);
        if (elapsed < cumulative) {
          setIndex(i);
          return;
        }
      }
      setIndex(chunks.length - 1);
      if (typeof onDone === 'function') onDone();
      clearInterval(tickRef.current);
      tickRef.current = null;
    }, TICK_MS);
    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [isPlaying, chunks, audioDurationMs, onDone]);

  if (!chunks.length) return null;
  // Once the audio has played and stopped, drop the caption — otherwise
  // the last chunk (often a 1-word punchline like "Badly.") sits alone
  // at the top of the screen indefinitely after the voice actor
  // finishes.
  if (hasPlayed && !isPlaying) return null;
  return <div style={style}>{chunks[index]}</div>;
}
