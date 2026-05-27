'use client';

import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { gsap } from 'gsap';

export default function DropInTitle({
  lines = ["Prosper80", "for All", "Human80!"],
  colors = ["#e55643", "#2b9f5e", "#f1c83c"],
  fontSize = { mobile: "2.5rem", desktop: "4rem" },
  isMobile = false,
  onAnimationComplete = () => {},
  triggerAnimation = true,
  instanceId
}) {
  const stableId = useMemo(() => {
    if (instanceId) return instanceId;
    const contentHash = lines.join('').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `dropin-${contentHash}`;
  }, [instanceId, lines]);
  const containerRef = useRef(null);
  const playAnimation = useCallback(() => {
    if (!containerRef.current) return;

    const tl = gsap.timeline({
      onComplete: onAnimationComplete
    });

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
  }, [onAnimationComplete]);

  useEffect(() => {
    if (triggerAnimation) {
      playAnimation();
    }
  }, [triggerAnimation, playAnimation]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          playAnimation();
        }
      },
      { threshold: 0.1, rootMargin: "100px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [playAnimation]);
  
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