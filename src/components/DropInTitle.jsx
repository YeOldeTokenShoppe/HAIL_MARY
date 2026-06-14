'use client';

import React, { useEffect, useRef, useMemo } from 'react';
import { gsap } from 'gsap';

export default function DropInTitle({
  lines = ["Prosper80", "for All", "Human80!"],
  colors = ["#e55643", "#2b9f5e", "#f1c83c"],
  fontSize = { mobile: "2.5rem", desktop: "4rem" },
  isMobile = false,
  onAnimationComplete = () => {},
  triggerAnimation = true,
  // Hold the title hidden for a beat after the trigger fires. The
  // trigger fires ~100-200px BEFORE the title is actually on screen
  // (positive observer rootMargin + framer useInView margin), so on a
  // quick scroll the drop-in can play out off-screen and be missed. The
  // fromTo's immediate render snaps the letters to their hidden start
  // state right away (they're CSS opacity:0 already, so no flash), then
  // this delay waits before dropping them in — letting the scroll catch
  // up so the effect plays while the title is in view.
  delay = 0.25,
  instanceId
}) {
  const stableId = useMemo(() => {
    if (instanceId) return instanceId;
    const contentHash = lines.join('').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `dropin-${contentHash}`;
  }, [instanceId, lines]);
  const containerRef = useRef(null);
  // Edge-triggered replay latch. Two visibility signals drive playback:
  // the `triggerAnimation` prop (framer-motion useInView in callers) and
  // the internal IntersectionObserver below. We WANT the title to replay
  // each time it scrolls back into view, but NOT to re-fire while it's
  // sitting in view — both signals can pulse repeatedly mid-scroll (and
  // the observer effect can re-attach if a dependency identity churns),
  // and an unguarded play stacks GSAP timelines so the title visibly
  // keeps re-animating. So we latch on the off-screen → on-screen edge:
  // play once when it becomes visible, ignore further play calls until it
  // leaves view, then release the latch so the next entry replays.
  const inViewLatchRef = useRef(false);
  const timelineRef = useRef(null);
  // Pinned ref for the consumer's onComplete so playAnimation never
  // recaptures an identity-churning inline callback (the default
  // `() => {}` is a new function every render).
  const onCompleteRef = useRef(onAnimationComplete);
  useEffect(() => {
    onCompleteRef.current = onAnimationComplete;
  }, [onAnimationComplete]);
  const playAnimation = () => {
    if (!containerRef.current) return;
    if (inViewLatchRef.current) return; // already played for this visit
    inViewLatchRef.current = true;
    timelineRef.current?.kill();
    const tl = gsap.timeline({
      delay,
      onComplete: () => onCompleteRef.current?.()
    });
    timelineRef.current = tl;
    tl.fromTo(containerRef.current.querySelectorAll('.title-letter'),
      {
        opacity: 0,
        bottom: -80
      },
      {
        opacity: 1,
        bottom: 0,
        duration: 0.5,
        ease: "back.out(1.7)",
        stagger: 0.05
      }
    );
  };

  // Release the latch when the title leaves view so the next entry
  // replays. Calling this while still in view is a no-op-equivalent —
  // the latch only matters on the next play call.
  const releaseForReplay = () => {
    inViewLatchRef.current = false;
  };

  useEffect(() => {
    if (triggerAnimation) playAnimation();
    else releaseForReplay();
  }, [triggerAnimation]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) playAnimation();
        else releaseForReplay();
      },
      { threshold: 0.1, rootMargin: "100px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    timelineRef.current?.kill();
  }, []);
  
  return (
    <div ref={containerRef} style={{
      position: 'relative',
      display: 'inline-block',
      width: '100%',
      textAlign: 'center',
    }}>
      <style jsx>{`
        @font-face {
          font-family: 'Fjalla One';
          src: url('/fonts/FjallaOne-Regular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        
        .title-letter-${stableId} {
          transform: skew(-10deg);
          display: block;
          float: left;
          font-family: 'Fjalla One', sans-serif !important;
        text-shadow: rgba(83, 61, 74, 0.8) 1px 1px,
                       rgba(83, 61, 74, 0.8) 2px 2px,
                       rgba(83, 61, 74, 0.8) 3px 3px,
                       rgba(83, 61, 74, 0.8) 4px 4px,
                       rgba(83, 61, 74, 0.8) 5px 5px,
                       rgba(83, 61, 74, 0.8) 6px 6px;
          min-width: 10px;
          min-height: 10px;
          position: relative;
          opacity: 0;
          filter: brightness(1.1);
        }
      `}</style>
      <h1 style={{
        color: '#fff',
        textTransform: 'uppercase',
        fontSize: isMobile ? fontSize.mobile : fontSize.desktop,
        margin: 0,
        lineHeight: 1.12,
        letterSpacing: '2px',
        fontFamily: "'Fjalla One', sans-serif",
      }}>
        {lines.map((line, lineIndex) => (
          <div
            key={`line-${lineIndex}`}
            style={{
              display: 'flex',
              justifyContent: 'center',
              transform: 'rotate(-10deg)',
              margin: '0 auto',
              width: 'fit-content',
            }}
          >
            {line.split('').map((char, charIndex) => (
              <span 
                key={`${lineIndex}-${charIndex}`}
                className={`title-letter title-letter-${stableId}`}
                style={{ 
                  color: colors[lineIndex % colors.length],
                  fontFamily: "'Fjalla One', sans-serif"
                }}
              >
                {char === ' ' ? '\u00A0' : char}
              </span>
            ))}
          </div>
        ))}
      </h1>
      
      {/* Optional replay button */}
     
    </div>
  );
}