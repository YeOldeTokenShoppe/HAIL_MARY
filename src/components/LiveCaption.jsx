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
const MIN_CHUNK_MS = 900;
const TICK_MS = 120;

function splitIntoChunks(text) {
  if (!text) return [];
  const parts = text.match(/[^.!?—]+[.!?—]+\s*|[^.!?—]+$/g) || [text];
  return parts.map((s) => s.trim()).filter(Boolean);
}

export default function LiveCaption({ text, isPlaying, style, onDone }) {
  const chunks = useMemo(() => splitIntoChunks(text), [text]);
  const [index, setIndex] = useState(0);
  const startRef = useRef(null);
  const elapsedRef = useRef(0);
  const tickRef = useRef(null);

  // Reset when the text changes.
  useEffect(() => {
    setIndex(0);
    startRef.current = null;
    elapsedRef.current = 0;
  }, [chunks]);

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
    tickRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = elapsedRef.current + (now - (startRef.current ?? now));
      let cumulative = 0;
      for (let i = 0; i < chunks.length; i++) {
        cumulative += Math.max(MIN_CHUNK_MS, chunks[i].length * MS_PER_CHAR);
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
  }, [isPlaying, chunks, onDone]);

  if (!chunks.length) return null;
  return <div style={style}>{chunks[index]}</div>;
}
