"use client";

import localFont from 'next/font/local';

const plainBlack = localFont({ src: '../../public/fonts/PlainBlack/Plain_Black.woff2', weight: '400', style: 'normal', display: 'swap' });
const interItalic = localFont({ src: '../../public/fonts/Inter-Italic-Variable.ttf', weight: '100 900', style: 'italic', display: 'swap' });

export default function DriveTitles({ moment }) {
  return <div className="drive-titles">
    <div className={`title opening ${moment === 'opening' ? 'visible' : ''}`} aria-hidden={moment !== 'opening'}>
      <div className={`opening-headline lettering ${plainBlack.className}`}>
        <span className="opening-first">If character</span>
        <span className="opening-second">is Destiny</span>
      </div>
      <div className={`tagline opening-subheading ${interItalic.className}`}>get in the car, let's go</div>
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
      .lettering { font-size: clamp(32px, 5.8vw, 84px); font-weight: 400; line-height: 1.12; letter-spacing: .015em; color: #000; -webkit-text-stroke: 2.5px #fff; paint-order: stroke fill; text-shadow: 4px 4px 8px rgba(74,74,74,.8); }
      /* Reserve each phrase's space so the stack stays still as the lines appear. */
      .opening-headline { line-height: 1.02; letter-spacing: 0; }
      .opening-first, .opening-second { display: block; opacity: 0; }
      .opening-first { white-space: nowrap; margin-bottom: .28em; }
      .opening-second { font-size: .8em; }
      /* Give the scene two extra seconds before the first phrase enters. */
      .opening.visible .opening-first { animation: titleFadeIn .6s ease 0.7s both; }
      .opening.visible .opening-second { animation: titleFadeIn .8s ease 3.3s both; }
      /* The second phrase settles at 6.1s, then gets a full 1.3s of silence. */
      .opening.visible .opening-subheading { animation: titleFadeIn 1.1s ease 5.4s both; }
      .tagline { font-size: clamp(20px, 2vw, 28px); font-weight: 400; font-style: italic; line-height: 1.45; color: #fff4e8; text-shadow: 0 2px 3px rgba(0,0,0,.95), 0 4px 10px rgba(0,0,0,.8); margin-top: clamp(18px, 2vw, 28px); text-wrap: balance; }
      .opening-subheading, .finale-subheading { opacity: 0; }
      .finale { right: 4vw; top: 35%; width: 31vw; max-width: 440px; text-align: center; }
      .finale .lettering { font-size: clamp(28px, 4.5vw, 64px); line-height: 1; letter-spacing: 0; }
      .finale-prefix { display: block; font-size: .72em; line-height: 1.08; margin-bottom: .08em; }
      .finale .finale-subheading { margin-top: clamp(12px, 1.2vw, 18px); }
      .finale.visible .lettering { animation: titleFadeIn .85s ease .4s both; }
      .finale.visible .finale-subheading { animation: titleFadeIn .9s ease 1.6s both; }
      @keyframes titleFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @media (max-aspect-ratio: 1/1) {
        .opening { left: 4%; top: 20%; width: 92%; }
        .opening .lettering { font-size: clamp(30px, 10.5vw, 80px); }
        .finale { top: auto; bottom: max(20%, 150px); right: 5%; width: 90%; max-width: none; }
        .finale .lettering { font-size: clamp(32px, 10.5vw, 66px); }
        .tagline { font-size: clamp(18px, 5vw, 26px); margin-top: 18px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .title { transition: none; }
        .opening-first, .opening-second { opacity: 1; }
        .opening.visible .opening-first, .opening.visible .opening-second,
        .opening.visible .opening-subheading, .finale.visible .lettering,
        .finale.visible .finale-subheading { animation: none; opacity: 1; }
      }
    `}</style>
  </div>;
}
