"use client";

import localFont from 'next/font/local';

const plainBlack = localFont({ src: '../../public/fonts/PlainBlack/Plain_Black.woff2', weight: '400', style: 'normal', display: 'swap' });
const interItalic = localFont({ src: '../../public/fonts/Inter-Italic-Variable.ttf', weight: '100 900', style: 'italic', display: 'swap' });

export default function DriveTitles({ moment }) {
  return <div className="drive-titles">
    <div className={`title opening ${moment === 'opening' ? 'visible' : ''}`} aria-hidden={moment !== 'opening'}>
      <div className={`opening-headline lettering ${plainBlack.className}`}>
        <span className="opening-first">Fortune</span>
        <span className="opening-second">favors</span>
        <span className="opening-third"><span className="opening-the">the</span>{' '}<span className="opening-fun">fun</span></span>
      </div>
      <div className={`tagline opening-subheading ${interItalic.className}`}>Adventures in the attention economy.</div>
    </div>
    <div className={`title finale ${moment === 'final' ? 'visible' : ''}`} aria-hidden={moment !== 'final'}>
      <div className={`lettering ${plainBlack.className}`}>
        <span className="finale-prefix">Our Lady of</span>
        Perpetual<br />Profit
      </div>
      <div className={`tagline finale-subheading ${interItalic.className}`}>Get on Her Watchlist.</div>
    </div>
    <style jsx>{`
      .drive-titles { pointer-events: none; position: fixed; inset: 0; z-index: 1000; }
      .title { position: absolute; opacity: 0; transition: opacity .65s ease; }
      .title.visible { opacity: 1; }
      .opening { left: 6vw; top: 28%; width: min(44vw, 650px); text-align: center; }
      .lettering { font-size: clamp(32px, 5.8vw, 84px); font-weight: 400; line-height: 1.12; letter-spacing: .015em; color: #fff4e8; -webkit-text-stroke: 3px #171019; paint-order: stroke fill; text-shadow: 3px 4px 0 #171019; }
      /* A compact, alternating stack; each line keeps its space during the reveal. */
      .opening-headline {
        width: max-content;
        margin-inline: auto;
        text-align: left;
        line-height: .94;
        letter-spacing: 0;
        color: #fff4e8;
        -webkit-text-stroke: 3px #171019;
        text-shadow: 3px 4px 0 #171019;
      }
      .opening-first, .opening-second, .opening-third { display: block; width: max-content; white-space: nowrap; opacity: 0; }
      .opening-first { position: relative; z-index: 1; }
      .opening-second { font-size: .9em; margin-left: .72em; }
      .opening-third { font-size: 1.05em; margin-left: .18em; }
      .opening-the { font-size: .7em; }
      .opening-fun { font-size: 1.25em; }
      .opening.visible .opening-first { animation: titleFadeIn .45s ease .7s both; }
      .opening.visible .opening-second { animation: titleFadeIn .45s ease 1.05s both; }
      .opening.visible .opening-third { animation: titleFadeIn .5s ease 1.4s both; }
      .tagline { font-size: clamp(20px, 2vw, 28px); font-weight: 400; font-style: italic; line-height: 1.45; color: #fff4e8; text-shadow: 0 2px 3px rgba(0,0,0,.95), 0 4px 10px rgba(0,0,0,.8); margin-top: clamp(18px, 2vw, 28px); text-wrap: balance; }
      .opening .opening-subheading, .finale .finale-subheading {
        font-size: clamp(18px, 1.5vw, 22px);
        margin: 20px auto 0;
        max-width: 30ch;
        padding-inline: 8px;
        text-shadow: 0 2px 4px rgba(23,16,25,.85);
        opacity: 0;
      }
      .opening.visible .opening-subheading { animation: titleFadeIn .65s ease 2.4s both; }
      .finale-subheading { opacity: 0; }
      .finale { right: 4vw; top: 35%; width: 31vw; max-width: 440px; text-align: center; }
      .finale .lettering { font-size: clamp(28px, 4.5vw, 64px); line-height: 1; letter-spacing: 0; }
      .finale-prefix { display: block; font-size: .72em; line-height: 1.08; margin-bottom: .08em; }
      .finale.visible .lettering { animation: titleFadeIn .85s ease .4s both; }
      .finale.visible .finale-subheading { animation: titleFadeIn .9s ease 1.6s both; }
      @keyframes titleFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @media (max-aspect-ratio: 1/1) {
        .opening { left: 4%; top: 20%; width: 92%; }
        .opening .lettering, .finale .lettering { -webkit-text-stroke-width: 2.5px; text-shadow: 2px 3px 0 #171019; }
        .opening .lettering { font-size: clamp(48px, 18vw, 110px); }
        .finale { top: auto; bottom: max(34%, 230px); right: 5%; width: 90%; max-width: none; }
        .finale .lettering { font-size: clamp(40px, 14vw, 84px); }
        .tagline { font-size: clamp(18px, 5vw, 26px); margin-top: 18px; }
        .opening .opening-subheading, .finale .finale-subheading { font-size: clamp(19px, 5.4vw, 26px); }
        /* The finale tagline sits over the heart's bloom; a dark halo keeps it legible. */
        .finale .finale-subheading { margin-top: 14px; text-shadow: 0 1px 2px #171019, 0 2px 6px rgba(23,16,25,.9), 0 0 16px rgba(23,16,25,.75); }
      }
      @media (prefers-reduced-motion: reduce) {
        .title { transition: none; }
        .opening-first, .opening-second, .opening-third { opacity: 1; }
        .opening.visible .opening-first, .opening.visible .opening-second,
        .opening.visible .opening-third, .opening.visible .opening-subheading,
        .finale.visible .lettering,
        .finale.visible .finale-subheading { animation: none; opacity: 1; }
      }
    `}</style>
  </div>;
}
