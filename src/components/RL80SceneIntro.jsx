"use client";

import { useEffect, useId } from 'react';

export default function RL80SceneIntro({ onComplete }) {
  const id = useId().replace(/:/g, '');
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(onComplete, reduced ? 900 : 6600);
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
  }, [onComplete]);
  const lettering = { fontFamily: 'Arial Black, Arial, sans-serif', fontWeight: 900, fontSize: 'clamp(100px, 24vw, 360px)' };
  return <div className="intro" aria-label="RL80 scene introduction">
    <svg width="100%" height="100%" className="cutout" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-border`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffbb36" />
          <stop offset="55%" stopColor="#f340b9" />
          <stop offset="100%" stopColor="#790caa" />
        </linearGradient>
        <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%" style={{ maskType: 'luminance' }}>
          <rect width="100%" height="100%" fill="white" />
          <text x="50%" y="50%" dy=".35em" textAnchor="middle" textLength="82%" lengthAdjust="spacingAndGlyphs" fill="black" style={lettering}>RL80</text>
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="#050208" mask={`url(#${id}-mask)`} />
      <text x="50%" y="50%" dy=".35em" textAnchor="middle" textLength="82%" lengthAdjust="spacingAndGlyphs" fill="none" stroke={`url(#${id}-border)`} strokeWidth="4" paintOrder="stroke" style={lettering}>RL80</text>
    </svg>
    <style jsx>{`
      .intro { position: fixed; inset: 0; z-index: 100000; overflow: hidden; pointer-events: none; animation: clear-mask 3.6s linear 3s forwards; }
      .cutout { display: block; transform-origin: 50% 50%; animation: open-mask 3.6s cubic-bezier(.65,0,.25,1) 3s forwards; }
      @keyframes open-mask { 0%, 55% { transform: scale(1); } 100% { transform: scale(18); } }
      @keyframes clear-mask { 0%, 75% { opacity: 1; } 100% { opacity: 0; } }
      @media (prefers-reduced-motion: reduce) { .cutout { animation: none; } .intro { animation: clear-mask .9s linear forwards; } }
    `}</style>
  </div>;
}
