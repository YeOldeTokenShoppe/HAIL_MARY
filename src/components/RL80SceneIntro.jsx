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

// [char, x, baseline y, textLength] in the 400×600 portrait viewBox.
const STACKED = [['R', 8, 215, 272], ['L', 178, 340, 207], ['8', 8, 465, 244], ['0', 172, 590, 218]];

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
  const wide = props => <text className="wide-letters" x="50%" y="50%" dy=".35em" textAnchor="middle" textLength="82%" lengthAdjust="spacingAndGlyphs" {...props} style={{ ...lettering, ...props.style }}>RL80</text>;
  const stacked = props => <svg className="stacked-letters" x="2%" y="6%" width="96%" height="66%" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid meet">
    {STACKED.map(([char, x, y, len]) => <text key={char} x={x} y={y} textLength={len} lengthAdjust="spacingAndGlyphs" style={stackedLettering} {...props}>{char}</text>)}
  </svg>;
  // GTA-style double border (after the Vice City "VI" codepen): a gold→pink band hugging
  // each glyph, wrapped in a deep-purple band. Strokes are centred on the glyph edge and
  // masked to the outside, so each band's visible width is half its stroke width.
  const outer = `url(#${id}-outer)`;
  const inner = `url(#${id}-inner)`;
  return <div className="intro" style={{ animationPlayState: started ? 'running' : 'paused' }} aria-label="RL80 scene introduction">
    <svg width="100%" height="100%" className="cutout" style={{ animationPlayState: started ? 'running' : 'paused' }} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-outer`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#370254" />
          <stop offset="100%" stopColor="#870287" />
        </linearGradient>
        <linearGradient id={`${id}-inner`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eaa714" />
          <stop offset="50%" stopColor="#e607a1" />
          <stop offset="90%" stopColor="#870287" />
        </linearGradient>
        <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%" style={{ maskType: 'luminance' }}>
          <rect width="100%" height="100%" fill="white" />
          {wide({ fill: 'black' })}
          {stacked({ fill: 'black' })}
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="#050208" mask={`url(#${id}-mask)`} />
      <g mask={`url(#${id}-mask)`} fill="none" strokeLinejoin="miter">
        {/* All outer bands before any inner band, so a neighbour's purple never covers gold. */}
        {wide({ stroke: outer, style: { strokeWidth: '0.1em' } })}
        {wide({ stroke: inner, style: { strokeWidth: '0.05em' } })}
        {stacked({ stroke: outer, strokeWidth: 26 })}
        {stacked({ stroke: inner, strokeWidth: 13 })}
      </g>
    </svg>
    <div className="curtain" aria-hidden="true" />
    <style jsx>{`
      .intro { position: fixed; inset: 0; z-index: 100000; overflow: hidden; pointer-events: none; animation: clear-mask 4.5s linear forwards; }
      .cutout { display: block; transform-origin: 50% 50%; animation: open-mask 4.5s cubic-bezier(.75,0,.9,.4) forwards; }
      @keyframes open-mask { from { transform: scale(1); } to { transform: scale(18); } }
      @keyframes clear-mask { 0%, 60% { opacity: 1; } 100% { opacity: 0; } }
      /* Codepen reveal: a dark curtain slides down off the logo on arrival. Runs on mount,
         independent of the started prop, so the logo is revealed while waiting for entry. */
      .curtain { position: absolute; inset: -20% 0 0; background: linear-gradient(transparent, #050208 18%); animation: reveal 1.8s cubic-bezier(.55,0,.35,1) forwards; }
      @keyframes reveal { to { transform: translateY(120%); } }
      .intro :global(.stacked-letters) { display: none; }
      @media (max-width: 600px) and (orientation: portrait) {
        .intro :global(.wide-letters) { display: none; }
        .intro :global(.stacked-letters) { display: block; }
        .cutout { transform-origin: 50% 44%; }
      }
      @media (prefers-reduced-motion: reduce) { .cutout { animation: none; } .curtain { display: none; } .intro { animation: clear-mask 0.3s linear forwards; } }
    `}</style>
  </div>;
}
