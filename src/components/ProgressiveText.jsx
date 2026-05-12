import React, { useState, useEffect, useMemo, useRef } from 'react';

// ProgressiveText — reveals a paragraph in sentence-sized chunks, one at a
// time, with timing matched to natural speaking pace. Used in the unified
// widget's speech-beat view so the player reads along with the audio
// instead of getting the whole transcript at once.
//
// Chunks split on `.`, `!`, `?`, and `—` (em-dash) — the same places the
// voice actor naturally pauses. Each chunk fades in via a one-shot CSS
// animation (`@keyframes progressiveTextFadeIn` in globals.css); the next
// chunk's reveal is scheduled proportionally to the previous chunk's
// character count, so longer sentences get more time on screen.
//
// Render strategy: we mount only the chunks that have been revealed so far.
// Earlier we rendered all chunks with `opacity: 0` for unrevealed — that
// caused `scrollHeight` to include the invisible chunks, which broke the
// windowed-mode auto-translate (the calculation pushed content too far up
// from the very first chunk). With visible-only render the layout height
// matches what's actually shown, so translation tracks correctly.
//
// Props:
//   text — the paragraph to reveal.
//   onComplete — fires when the last chunk has been revealed.
//   maxVisibleLines — when set, clips the visible area to N line-heights
//     and translates the content upward as it grows, so the newest text
//     stays pinned to the bottom (teleprompter scroll). The top edge fades
//     via a CSS mask.
//   approxLineHeight — must match the parent's line-height for the clip
//     height to land on a sentence boundary.

const MS_PER_CHAR = 70;       // ~natural speaking pace
const MIN_CHUNK_MS = 900;     // floor so very short chunks don't strobe
const FADE_DURATION_MS = 420; // each chunk's opacity transition
const SCROLL_DURATION_MS = 420;

function splitIntoChunks(text) {
  if (!text) return [];
  // Match: any run of non-terminator chars followed by one or more
  // terminators (with optional trailing whitespace), OR a trailing run
  // with no terminator (final chunk in a paragraph with no period).
  const parts = text.match(/[^.!?—]+[.!?—]+\s*|[^.!?—]+$/g) || [text];
  return parts.map((s) => s.trim()).filter(Boolean);
}

export default function ProgressiveText({
  text,
  onComplete,
  maxVisibleLines,
  approxLineHeight = 1.5,
}) {
  const chunks = useMemo(() => splitIntoChunks(text), [text]);
  const [revealedCount, setRevealedCount] = useState(0);
  const contentRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (chunks.length === 0) {
      setRevealedCount(0);
      return;
    }
    // First chunk shows immediately so there's no awkward empty pause.
    setRevealedCount(1);

    if (chunks.length === 1) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    const timers = [];
    let cumulative = 0;
    for (let i = 1; i < chunks.length; i++) {
      const prevLen = chunks[i - 1].length;
      const delay = Math.max(MIN_CHUNK_MS, prevLen * MS_PER_CHAR);
      cumulative += delay;
      timers.push(
        setTimeout(() => {
          setRevealedCount(i + 1);
          if (i === chunks.length - 1 && typeof onComplete === 'function') {
            onComplete();
          }
        }, cumulative)
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [chunks, onComplete]);

  // Windowed mode: container is capped at maxVisibleLines (via maxHeight, so
  // short content doesn't reserve dead space) and made scrollable. On each
  // new chunk we auto-scroll to the bottom so the latest line stays pinned to
  // the visible window — but the user can scroll up at any time to re-read
  // anything that's already been revealed (the previous clip-and-translate
  // approach hid earlier chunks permanently).
  useEffect(() => {
    if (!maxVisibleLines) return;
    if (!containerRef.current) return;
    const el = containerRef.current;
    el.scrollTop = el.scrollHeight;
  }, [revealedCount, maxVisibleLines, text]);

  // Render ONLY revealed chunks. Each newly-mounted span runs the CSS
  // keyframe `progressiveTextFadeIn` (in globals.css) once on mount, with
  // `both` fill mode so it starts at opacity 0 before paint. Earlier-mounted
  // spans don't re-animate (key-stable).
  const visibleChunks = chunks.slice(0, revealedCount);

  const chunkSpans = visibleChunks.map((chunk, i) => (
    <span
      key={i}
      style={{
        animation: `progressiveTextFadeIn ${FADE_DURATION_MS}ms ease both`,
      }}
    >
      {chunk}{i < chunks.length - 1 ? ' ' : ''}
    </span>
  ));

  if (!maxVisibleLines) {
    return <>{chunkSpans}</>;
  }

  return (
    <div
      ref={containerRef}
      style={{
        maxHeight: `${maxVisibleLines * approxLineHeight}em`,
        overflowY: 'auto',
        scrollBehavior: 'smooth',
        // Soft fade at the top edge so older chunks dissolve out rather
        // than getting hard-cropped. Tight band (90%→100%) so almost the
        // full visible area is readable; the fade is a hint of dissolve,
        // not a translucent veil. Mask works in all modern browsers;
        // -webkit- variant for Safari.
        maskImage: 'linear-gradient(to top, black 92%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to top, black 92%, transparent 100%)',
      }}
    >
      <div ref={contentRef}>
        {chunkSpans}
      </div>
    </div>
  );
}
