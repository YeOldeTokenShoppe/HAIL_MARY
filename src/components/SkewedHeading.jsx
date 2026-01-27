'use client';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import gsap from 'gsap';

// Character sets for scramble effect
const CHAR_SETS = {
  upperCase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowerCase: 'abcdefghijklmnopqrstuvwxyz',
  upperAndLowerCase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  all: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
};

export default function SkewedHeading({
  lines = ['DEFAULT', 'HEADING'],
  colors = ['#fff', '#ffd700', '#00fffbff'],
  fontSize = { mobile: '2.5rem', desktop: '3rem' },
  isMobile = false,
  fontFamily = "'Fjalla One', sans-serif",
  useGradient = false,
  gradientColors = ['#ffd700', '#00fffbff'],
  textAlign = 'center',
  scramble = false // Can be true, false, or options: { trigger: 'hover'|'mount', duration, chars, stagger }
}) {
  const [stableId, setStableId] = useState('default');
  const containerRef = useRef(null);
  const charRefs = useRef([]);
  const isAnimatingRef = useRef(false);

  useEffect(() => {
    setStableId(Math.random().toString(36).substring(2, 9));
  }, []);

  // Get scramble options with defaults
  const getScrambleOptions = useCallback(() => {
    const defaults = {
      trigger: 'hover', // 'hover' or 'mount'
      duration: 0.8,
      chars: 'upperCase',
      stagger: 0.03,
      iterations: 8 // number of random chars before settling
    };
    return scramble === true ? defaults : { ...defaults, ...scramble };
  }, [scramble]);

  // Scramble animation for individual characters
  const runScramble = useCallback(() => {
    if (!scramble || isAnimatingRef.current) return;

    const options = getScrambleOptions();
    const charSet = typeof options.chars === 'string' && CHAR_SETS[options.chars]
      ? CHAR_SETS[options.chars]
      : (typeof options.chars === 'string' ? options.chars : CHAR_SETS.upperCase);

    isAnimatingRef.current = true;

    // Get all character spans
    const allChars = charRefs.current.flat().filter(Boolean);

    allChars.forEach((charEl, index) => {
      const originalChar = charEl.dataset.char || charEl.textContent;
      if (originalChar === ' ' || originalChar === '\u00A0') return;

      const delay = index * options.stagger;
      const iterationDuration = options.duration / options.iterations;

      // Create timeline for this character
      const tl = gsap.timeline({ delay });

      // Scramble through random characters
      for (let i = 0; i < options.iterations; i++) {
        tl.call(() => {
          const randomChar = charSet[Math.floor(Math.random() * charSet.length)];
          charEl.textContent = randomChar;
        }, [], i * iterationDuration);
      }

      // Settle on original character
      tl.call(() => {
        charEl.textContent = originalChar;
        if (index === allChars.length - 1) {
          isAnimatingRef.current = false;
        }
      }, [], options.duration);
    });
  }, [scramble, getScrambleOptions]);

  // Mount trigger
  useEffect(() => {
    if (!scramble) return;
    const options = getScrambleOptions();

    if (options.trigger === 'mount') {
      // Small delay to ensure refs are populated
      const timer = setTimeout(runScramble, 100);
      return () => clearTimeout(timer);
    }
  }, [scramble, stableId, getScrambleOptions, runScramble]);

  // Hover handlers
  const handleMouseEnter = useCallback(() => {
    if (!scramble) return;
    const options = getScrambleOptions();
    if (options.trigger === 'hover') {
      runScramble();
    }
  }, [scramble, getScrambleOptions, runScramble]);

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      translate="no"
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '100%',
        textAlign: textAlign,
        padding: '5px 10px',
        overflow: 'visible',
        cursor: scramble ? 'pointer' : 'default',
      }}
    >
      <style jsx>{`
        @font-face {
          font-family: 'Fjalla One';
          src: url('/fonts/FjallaOne-Regular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }

        .skewed-heading-${stableId} {
          font-size: ${typeof fontSize === 'string' ? fontSize : (isMobile ? fontSize.mobile : fontSize.desktop)} !important;
          margin: 0 !important;
          margin-block-start: 0 !important;
          margin-block-end: 0 !important;
          margin-top: 0 !important;
          margin-bottom: 0 !important;
        }

        .title-letter-${stableId} {
          transform: skew(-10deg);
          display: inline-block;
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
          margin-left: 2px;
          filter: drop-shadow(0 0 2px rgba(0, 255, 0, 0.4));
        }

        .title-letter-${stableId}:first-child {
          margin-left: 0;
        }
      `}</style>
      <h2 className={`skewed-heading-${stableId}`} style={{
        color: '#fff',
        textTransform: 'uppercase',
        fontSize: typeof fontSize === 'string' ? fontSize : (isMobile ? fontSize.mobile : fontSize.desktop),
        margin: '0 !important',
        marginBlockStart: '0 !important',
        marginBlockEnd: '0 !important',
        lineHeight: 1.12,
        letterSpacing: '2px',
        fontFamily: fontFamily,
      }}>
        {lines.map((line, lineIndex) => {
          // Initialize ref array for this line
          if (!charRefs.current[lineIndex]) {
            charRefs.current[lineIndex] = [];
          }

          return (
            <div
              key={`line-${lineIndex}`}
              style={{
                display: 'flex',
                justifyContent: 'center',
                overflow: 'visible',
              }}
            >
              {line.split('').map((char, charIndex) => (
                <span
                  key={`${lineIndex}-${charIndex}`}
                  ref={el => charRefs.current[lineIndex][charIndex] = el}
                  className={`title-letter title-letter-${stableId}`}
                  style={useGradient ? {
                    background: `linear-gradient(135deg, ${gradientColors[0]} 0%, ${gradientColors[1]} 100%)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    position: 'relative',
                    fontFamily: "'Fjalla One', sans-serif",
                  } : {
                    color: colors[lineIndex % colors.length],
                    position: 'relative',
                    fontFamily: "'Fjalla One', sans-serif",
                  }}
                  data-char={char === ' ' ? '\u00A0' : char}
                >
                  {char === ' ' ? '\u00A0' : char}
                </span>
              ))}
            </div>
          );
        })}
      </h2>
    </div>
  );
}