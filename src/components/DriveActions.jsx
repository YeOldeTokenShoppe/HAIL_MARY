import DriveSocialLinks from './DriveSocialLinks';

export default function DriveActions({ onBuy, onExplore }) {
  return <div className="actions">
    <div className="buttons">
      <button className="buy" onClick={onBuy}>Buy RL80</button>
      <button onClick={onExplore}>Explore <span aria-hidden="true">→</span></button>
    </div>
    <DriveSocialLinks />
    <style jsx>{`
      .actions { position: fixed; right: 4vw; top: 72%; width: 31vw; z-index: 1001; pointer-events: auto; display: flex; flex-direction: column; align-items: center; gap: 20px; animation: action-reveal .7s ease both; }
      .buttons { display: flex; gap: 12px; width: 100%; max-width: 380px; }
      button { flex: 1; min-height: 48px; padding: 12px 18px; white-space: nowrap; font: 600 17px/1.2 "Arial Narrow", "Helvetica Neue", Arial, sans-serif; color: #fff4e8; background: #160e2066; border: 1px solid #ffffff55; border-radius: 6px; cursor: pointer; transition: background .2s, border-color .2s, box-shadow .2s; }
      .buy { background: #211329ed; border-color: #e54bd1; box-shadow: 0 0 10px #e54bd118; }
      button:hover { background: #32183e; border-color: #ec54d5; }
      button:focus-visible { outline: 2px solid #ec54d5; outline-offset: 4px; }
      @keyframes action-reveal { from { opacity: 0; } to { opacity: 1; } }
      @media (max-aspect-ratio: 1/1) { .actions { top: auto; bottom: max(2vh, env(safe-area-inset-bottom)); right: 5%; width: 90%; gap: 12px; } button { font-size: 16px; } }
      @media (prefers-reduced-motion: reduce) { .actions { animation: none; } }
    `}</style>
  </div>;
}
