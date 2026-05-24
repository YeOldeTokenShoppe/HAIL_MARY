"use client";

import React, { useEffect, useRef } from "react";
import { animate, scrambleText } from "animejs";

// Wraps a text node and runs anime.js's scrambleText helper when it
// scrolls into view (once) and optionally on hover. Final rendered text
// is the `children` string — we set the element's text content from that
// and let the animation drive innerHTML during playback.
//
// Note: keep children to plain strings (no nested elements) — scrambleText
// rewrites innerHTML each tick, so any child markup would be wiped.
export default function ScrambleText({
  children,
  as: Tag = "span",
  className,
  style,
  duration = 750,
  perturbation = 0.2,
  cursor = "░▒▓█",
  delay = 0,
  // Sweep direction — 'left' is good for body text so the eye can read
  // already-settled characters while the tail continues to scramble.
  from = "auto",
  // Lower-level scrambleText knobs (ms per char) — useful for long body
  // copy where the default rates make scrambling feel chaotic.
  revealDelay,
  revealRate,
  settleDuration,
  settleRate,
  chars,
  replayOnHover = true,
  // If true, animation fires once when scrolled into view. If false, the
  // text just renders statically — useful for honoring reduced-motion.
  animateOnView = true,
}) {
  const elRef = useRef(null);
  const playedRef = useRef(false);

  useEffect(() => {
    const el = elRef.current;
    if (!el || typeof window === "undefined") return undefined;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Build the scrambleText param object — only include knobs that were
    // explicitly set, so anime.js's defaults still apply for omitted ones.
    const scrambleParams = { duration, perturbation, cursor, delay, from };
    if (revealDelay !== undefined) scrambleParams.revealDelay = revealDelay;
    if (revealRate !== undefined) scrambleParams.revealRate = revealRate;
    if (settleDuration !== undefined)
      scrambleParams.settleDuration = settleDuration;
    if (settleRate !== undefined) scrambleParams.settleRate = settleRate;
    if (chars !== undefined) scrambleParams.chars = chars;

    const play = () => {
      if (prefersReduced) return;
      animate(el, { innerHTML: scrambleText(scrambleParams) });
    };

    if (animateOnView) {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting && !playedRef.current) {
              playedRef.current = true;
              play();
              io.disconnect();
              return;
            }
          }
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
      );
      io.observe(el);

      return () => io.disconnect();
    }

    return undefined;
  }, [
    animateOnView,
    duration,
    perturbation,
    cursor,
    delay,
    from,
    revealDelay,
    revealRate,
    settleDuration,
    settleRate,
    chars,
  ]);

  const handleHover = () => {
    if (!replayOnHover) return;
    const el = elRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const replayParams = { duration, perturbation, cursor, from };
    if (revealRate !== undefined) replayParams.revealRate = revealRate;
    if (settleRate !== undefined) replayParams.settleRate = settleRate;
    animate(el, { innerHTML: scrambleText(replayParams) });
  };

  return (
    <Tag
      ref={elRef}
      className={className}
      style={style}
      onPointerEnter={handleHover}
    >
      {children}
    </Tag>
  );
}
