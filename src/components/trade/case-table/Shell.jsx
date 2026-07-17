// The scrolling terminal shell + the shared ct- stylesheet for the Case
// Table's full-screen beats (lobby, pundit calls, ticket, ledger,
// standings). Each screen wraps itself in <Shell> — one is mounted at a
// time, so the stylesheet rides along with whichever screen is up.
import React from "react";

export default function Shell({ children }) {
  return (
    <div className="ct-root">
      {children}
      <style>{`
        .ct-root { position: absolute; inset: 0; z-index: 10050; overflow-y: auto;
          background: radial-gradient(120% 80% at 50% 20%, rgba(10,40,38,0.5), transparent), #02100e;
          color: #2fd6d6; font-family: 'Courier New', monospace; }
        .ct-lobby, .ct-talk { display: flex; flex-direction: column; gap: 12px; padding: 22px 18px calc(env(safe-area-inset-bottom, 0px) + 24px); max-width: 560px; margin: 0 auto; }
        .ct-eyebrow { font-size: 11px; letter-spacing: 0.14em; color: #ffd23a; }
        .ct-lobby-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
        .ct-devrow { display: flex; gap: 6px; }
        .ct-dev { background: none; border: 1px dashed rgba(191,238,222,0.35); color: #bfeede; opacity: 0.6;
          font: inherit; font-size: 9.5px; letter-spacing: 0.08em; padding: 4px 8px; cursor: pointer; }
        .ct-dev:hover { opacity: 1; }
        .ct-steps { display: flex; flex-direction: column; gap: 9px; }
        .ct-step { display: flex; gap: 10px; align-items: baseline; font-size: 12px; line-height: 1.55; color: #bfeede; }
        .ct-step b { color: #f4fffb; letter-spacing: 0.04em; }
        .ct-step-n { color: #ffd23a; font-size: 11px; flex-shrink: 0; font-weight: bold; }
        .ct-title { font-size: 21px; line-height: 1.35; color: #f4fffb; font-weight: bold; }
        .ct-sub, .ct-talk-note { font-size: 12px; line-height: 1.55; color: #bfeede; opacity: 0.85; }
        .ct-picks { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px; }
        .ct-pick { background: color-mix(in srgb, var(--cc) 8%, #04140f); border: 1px solid color-mix(in srgb, var(--cc) 55%, transparent);
          color: #f4fffb; font: inherit; padding: 12px 10px; cursor: pointer; text-align: center;
          clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px)); }
        .ct-pick img { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; border: 1.5px solid var(--cc); }
        .ct-pick-name { font-size: 13px; font-weight: bold; margin-top: 7px; color: var(--cc); }
        .ct-pick-perk { font-size: 10.5px; font-weight: bold; letter-spacing: 0.06em; color: #ffd23a; margin-top: 4px; }
        .ct-pick-role { font-size: 10px; line-height: 1.45; color: #bfeede; opacity: 0.8; margin-top: 3px; }
        .ct-strip { display: flex; gap: 6px; justify-content: space-between; margin-bottom: 6px; }
        .ct-seat { flex: 1; text-align: center; padding: 7px 3px; background: rgba(4,20,15,0.7);
          border: 1px solid color-mix(in srgb, var(--cc) 35%, transparent); }
        .ct-seat.you { border-color: var(--cc); box-shadow: 0 0 10px color-mix(in srgb, var(--cc) 30%, transparent); }
        .ct-seat.liq { opacity: 0.4; filter: grayscale(0.8); }
        .ct-seat img { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; }
        .ct-seat-you { position: relative; width: 30px; height: 30px; margin: 0 auto; border-radius: 50%;
          border: 1.5px solid #2fd6d6; color: #2fd6d6; font-size: 15px; line-height: 27px; }
        .ct-patron-chip { position: absolute; right: -6px; bottom: -4px; width: 15px; height: 15px; border-radius: 50%;
          object-fit: cover; border: 1px solid #ffd23a; }
        .ct-seat-name { font-size: 8.5px; letter-spacing: 0.06em; color: var(--cc); margin-top: 4px; }
        .ct-seat-pf { font-size: 12.5px; color: #f4fffb; font-weight: bold; }
        .ct-pnl { font-size: 10.5px; }
        .ct-lean { display: flex; gap: 12px; align-items: center; padding: 10px 12px; background: rgba(4,20,15,0.7);
          border-left: 3px solid var(--cc); }
        .ct-lean img { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 1px solid var(--cc); flex-shrink: 0; }
        .ct-you-badge { width: 44px; height: 44px; border-radius: 50%; border: 1.5px solid #2fd6d6; color: #2fd6d6;
          font-size: 20px; text-align: center; line-height: 41px; flex-shrink: 0; }
        .ct-lean-name { font-size: 12.5px; font-weight: bold; color: var(--cc); }
        .ct-lean-scan { font-weight: normal; font-size: 10.5px; color: #bfeede; opacity: 0.75; letter-spacing: 0.04em; }
        .ct-lean-line { font-size: 12.5px; color: #eafff9; margin-top: 3px; line-height: 1.4; }
        .ct-lean.tappable { cursor: pointer; box-shadow: 0 0 12px color-mix(in srgb, var(--cc) 35%, transparent); }
        .ct-wiretap { font-size: 11.5px; color: #ffd23a; margin-top: 5px; letter-spacing: 0.04em; }
        .ct-ledger-row { flex: 1; display: flex; flex-direction: column; gap: 3px; }
        .ct-ledger-nums { font-size: 13px; font-weight: bold; }
        .ct-dim { color: #bfeede; opacity: 0.7; font-weight: normal; font-size: 11.5px; }
        .ct-rug { color: #ff5454; letter-spacing: 0.08em; font-size: 11px; }
        .ct-debrief { font-size: 11px; color: #bfeede; line-height: 1.45; letter-spacing: 0.03em; }
        .ct-dial { background: rgba(4,20,15,0.7); border-left: 3px solid var(--dc); padding: 11px 13px;
          display: flex; flex-direction: column; gap: 7px; }
        .ct-dial-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
        .ct-dial-name { font-size: 10.5px; letter-spacing: 0.12em; color: #bfeede; opacity: 0.85; }
        .ct-dial-val { font-size: 14px; font-weight: bold; color: var(--dc); text-shadow: 0 0 10px color-mix(in srgb, var(--dc) 50%, transparent); }
        .ct-dial input[type="range"] { width: 100%; accent-color: var(--dc); cursor: pointer; height: 22px; }
        .ct-dial-sub { font-size: 10.5px; line-height: 1.5; color: #bfeede; opacity: 0.75; }
        .ct-truth { font-size: 22px; font-weight: bold; letter-spacing: 0.05em; text-shadow: 0 0 14px currentColor; margin: 2px 0 6px; }
        .ct-event { border: 1px dashed rgba(255,210,58,0.55); padding: 12px; margin-top: 4px; }
        .ct-event-label { color: #ffd23a; font-size: 12px; letter-spacing: 0.1em; font-weight: bold; }
        .ct-event-text { font-size: 12px; color: #eafff9; margin-top: 4px; }
        .ct-event-effect { font-size: 10px; letter-spacing: 0.12em; font-weight: bold; color: #ffd23a; margin-top: 6px; }
        .ct-event--calm { opacity: 0.55; border-style: dotted; }
        .ct-event--calm .ct-event-effect { color: #bfeede; }
        .ct-cta { margin-top: 10px; background: rgba(47,214,214,0.12); border: 1.5px solid #2fd6d6; color: #f4fffb; font: inherit;
          font-weight: bold; letter-spacing: 0.08em; font-size: 14px; padding: 13px; cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
          box-shadow: 0 0 14px rgba(47,214,214,0.25); }
        .ct-ghost { background: none; border: 1px solid rgba(47,214,214,0.4); color: #2fd6d6; font: inherit; font-size: 11.5px;
          letter-spacing: 0.06em; padding: 9px 14px; cursor: pointer; }
      `}</style>
    </div>
  );
}
