"use client";

import localFont from 'next/font/local';
const plainBlack = localFont({ src: '../../public/fonts/PlainBlack/Plain_Black.woff2', weight: '400', style: 'normal', display: 'swap' });

export default function DriveTitles({ moment }) {
  return <div className="drive-titles">
    <div className={`title opening ${moment === 'opening' ? 'visible' : ''}`} aria-hidden={moment !== 'opening'}>
      <div className={`lettering ${plainBlack.className}`}>Feel It Still</div>
    </div>
    <div className={`title finale ${moment === 'final' ? 'visible' : ''}`} aria-hidden={moment !== 'final'}>
      <div className={`lettering ${plainBlack.className}`}>Perpetual<br />Profit</div>
      <div className="tagline">Keep the faith. Enjoy the ride.</div>
    </div>
    <style jsx>{`
      .drive-titles { pointer-events: none; position: fixed; inset: 0; z-index: 1000; }
      .title { position: absolute; opacity: 0; transform: translateY(12px); transition: opacity .65s ease, transform 1.2s ease; }
      .title.visible { opacity: 1; transform: translateY(0); transition-delay: .7s; }
      .opening { left: 6vw; top: 28%; }
      .finale { right: 4vw; top: 35%; width: 31vw; max-width: 440px; text-align: center; }
      .lettering { font-size: clamp(48px, 6.4vw, 90px); font-weight: 400; line-height: 1.06; color: #000; -webkit-text-stroke: 3px #fff; paint-order: stroke fill; text-shadow: 4px 4px 8px rgba(74,74,74,.8); }
      .tagline { font: 400 clamp(15px, 1.4vw, 20px)/1.5 "Arial Narrow", "Helvetica Neue", Arial, sans-serif; color: #fff4e8; text-shadow: 0 2px 5px #191220; margin-top: 20px; text-wrap: balance; }
      @media (max-aspect-ratio: 1/1) {
        .opening { left: 0; right: 0; top: 23%; text-align: center; }
        .opening .lettering { font-size: clamp(48px, 13vw, 80px); }
        .finale { top: auto; bottom: max(20%, 150px); right: 5%; width: 90%; max-width: none; }
        .finale .lettering { font-size: clamp(38px, 11vw, 66px); line-height: .98; -webkit-text-stroke-width: 2px; }
        .tagline { font-size: 15px; margin-top: 14px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .title, .title.visible { transform: none; transition: opacity .2s; transition-delay: 0s; }
      }
    `}</style>
  </div>;
}
