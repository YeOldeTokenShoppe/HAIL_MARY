"use client";

import { useEffect, useId } from 'react';
import localFont from 'next/font/local';

const logoFont = localFont({
  src: '../../public/fonts/Anton-Regular.ttf',
  weight: '400',
  display: 'block',
  preload: true,
});

export const INTRO_DURATION_MS = 4500;
export const REDUCED_INTRO_DURATION_MS = 300;

export default function RL80SceneIntro({ onComplete, started = true }) {
  const id = useId().replace(/:/g, '');
  useEffect(() => {
    if (!started) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(onComplete, reduced ? REDUCED_INTRO_DURATION_MS : INTRO_DURATION_MS);
    const onKey = event => {
      if (['Escape', 'ArrowDown', 'PageDown', ' '].includes(event.key)) onComplete();
    };
    window.addEventListener('wheel', onComplete, { passive: true, once: true });
    window.addEventListener('touchstart', onComplete, { passive: true, once: true });
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('wheel', onComplete);
      window.removeEventListener('touchstart', onComplete);
      window.removeEventListener('keydown', onKey);
    };
  }, [onComplete, started]);
  const lettering = { fontFamily: logoFont.style.fontFamily, fontWeight: 400, fontSize: 'clamp(100px, 24vw, 360px)' };
  const stackedLettering = { fontFamily: logoFont.style.fontFamily, fontWeight: 400, fontSize: 250, letterSpacing: 0 };
  return <div className="intro" style={{ animationPlayState: started ? 'running' : 'paused' }} aria-label="RL80 scene introduction">
    <svg width="100%" height="100%" className="cutout" style={{ animationPlayState: started ? 'running' : 'paused' }} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-border`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffbb36" />
          <stop offset="55%" stopColor="#f340b9" />
          <stop offset="100%" stopColor="#790caa" />
        </linearGradient>
        <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%" style={{ maskType: 'luminance' }}>
          <rect width="100%" height="100%" fill="white" />
          <text className="wide-letters" x="50%" y="50%" dy=".35em" textAnchor="middle" textLength="82%" lengthAdjust="spacingAndGlyphs" fill="black" style={lettering}>RL80</text>
          <svg className="stacked-letters" x="2%" y="10%" width="96%" height="62%" viewBox="0 0 400 540" preserveAspectRatio="xMidYMid meet">
            <text x="8" y="215" textLength="280" lengthAdjust="spacingAndGlyphs" fill="black" style={stackedLettering}>R</text>
<text x="175" y="325" textLength="210" lengthAdjust="spacingAndGlyphs" fill="black" style={stackedLettering}>L</text>
<text x="8" y="425" textLength="250" lengthAdjust="spacingAndGlyphs" fill="black" style={stackedLettering}>8</text>
<text x="170" y="530" textLength="220" lengthAdjust="spacingAndGlyphs" fill="black" style={stackedLettering}>0</text>
          </svg>
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="#050208" mask={`url(#${id}-mask)`} />
      <text className="wide-letters" x="50%" y="50%" dy=".35em" textAnchor="middle" textLength="82%" lengthAdjust="spacingAndGlyphs" fill="none" stroke={`url(#${id}-border)`} strokeWidth="4" paintOrder="stroke" style={lettering}>RL80</text>
      {/* Clip strokes to the outside of the combined letter cutout. */}
      <g mask={`url(#${id}-mask)`}>
      <svg className="stacked-letters" x="2%" y="10%" width="96%" height="62%" viewBox="0 0 400 540" preserveAspectRatio="xMidYMid meet">
        <text x="8" y="215" textLength="280" lengthAdjust="spacingAndGlyphs" fill="none" stroke={`url(#${id}-border)`} strokeWidth="6" paintOrder="stroke" style={stackedLettering}>R</text>
<text x="175" y="325" textLength="210" lengthAdjust="spacingAndGlyphs" fill="none" stroke={`url(#${id}-border)`} strokeWidth="6" paintOrder="stroke" style={stackedLettering}>L</text>
<text x="8" y="425" textLength="250" lengthAdjust="spacingAndGlyphs" fill="none" stroke={`url(#${id}-border)`} strokeWidth="6" paintOrder="stroke" style={stackedLettering}>8</text>
<text x="170" y="530" textLength="220" lengthAdjust="spacingAndGlyphs" fill="none" stroke={`url(#${id}-border)`} strokeWidth="6" paintOrder="stroke" style={stackedLettering}>0</text>
      </svg>
      </g>
    </svg>
    <style jsx>{`
      .intro { position: fixed; inset: 0; z-index: 100000; overflow: hidden; pointer-events: none; animation: clear-mask 4.5s linear forwards; }
      .cutout { display: block; transform-origin: 50% 50%; animation: open-mask 4.5s cubic-bezier(.75,0,.9,.4) forwards; }
      @keyframes open-mask { from { transform: scale(1); } to { transform: scale(18); } }
      @keyframes clear-mask { 0%, 60% { opacity: 1; } 100% { opacity: 0; } }
      .stacked-letters { display: none; }
      @media (max-width: 600px) and (orientation: portrait) {
        .wide-letters { display: none; }
        .stacked-letters { display: block; }
        .cutout { transform-origin: 50% 44%; }
      }
      @media (prefers-reduced-motion: reduce) { .cutout { animation: none; } .intro { animation: clear-mask 0.3s linear forwards; } }
    `}</style>
  </div>;
}
