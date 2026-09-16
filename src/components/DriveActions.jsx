import localFont from 'next/font/local';

const anton = localFont({ src: '../../public/fonts/Anton-Regular.ttf', weight: '400', style: 'normal', display: 'swap' });

import DriveSocialLinks from './DriveSocialLinks';

export default function DriveActions({ onBuy, onExplore }) {
  return <div className="actions">
    <div className={`buttons ${anton.className}`}>
      <button type="button" className="buy" onClick={onBuy}>Buy RL80</button>
      <button type="button" className="explore" onClick={onExplore}>Explore <span aria-hidden="true">→</span></button>
    </div>
    <DriveSocialLinks />
    <style jsx>{`
      .actions { position: fixed; right: 4vw; top: 69%; width: 31vw; z-index: 1001; pointer-events: auto; display: flex; flex-direction: column; align-items: center; gap: 24px; animation: action-reveal .7s ease both; }
      .buttons { display: flex; align-items: center; gap: 18px; width: 100%; max-width: 380px; }
      button { flex: 1; min-width: 0; min-height: 50px; padding: 12px 16px; white-space: nowrap; font-family: inherit; font-size: 18px; font-weight: 400; line-height: 1.2; letter-spacing: .025em; border: 2px solid transparent; border-radius: 2px; cursor: pointer; transition: transform .16s ease, background .16s ease, box-shadow .16s ease; }
      .buy { color: #171310; background: #fff4e8; border-color: #171310; box-shadow: 4px 4px 0 #171310; }
      .buy:hover { background: #fffaf3; transform: translate(-1px, -2px); box-shadow: 5px 6px 0 #171310; }
      .buy:active { transform: translate(3px, 3px); box-shadow: 1px 1px 0 #171310; }
      .explore { color: #fff4e8; background: transparent; text-shadow: 0 2px 3px #171310, 0 0 10px #17131080; }
      .explore span { display: inline-block; margin-left: 8px; transition: transform .16s ease; }
      .explore:hover { background: #17131020; }
      .explore:hover span, .explore:focus-visible span { transform: translateX(4px); }
      button:focus-visible { outline: 3px solid #fff4e8; outline-offset: 6px; }
      @keyframes action-reveal { from { opacity: 0; } to { opacity: 1; } }
      @media (max-aspect-ratio: 1/1) { .actions { top: auto; bottom: max(4vh, env(safe-area-inset-bottom)); right: 5%; width: 90%; gap: 12px; } button { font-size: 17px; } }
      @media (prefers-reduced-motion: reduce) { .actions { animation: none; } button, .explore span { transition: none; } .buy:hover, .buy:active, .explore:hover span, .explore:focus-visible span { transform: none; } }
    `}</style>
  </div>;
}
