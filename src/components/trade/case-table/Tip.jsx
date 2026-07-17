// One-time mechanic scaffold (trade-interaction-primitives.md: mechanic
// tutorials show once, ~10s, then never again — un-scored). Self-styled so
// it works on Shell screens and on the dock screens alike (style tags here
// are global, not scoped).
import React from "react";
import { DOCK_H } from "./constants";

export default function Tip({ title, children, onDismiss, float }) {
  return (
    <div className={`ct-tip ${float ? "ct-tip-float" : ""}`}>
      <div className="ct-tip-title">◈ {title}</div>
      <div className="ct-tip-body">{children}</div>
      <button className="ct-tip-btn" onClick={onDismiss}>GOT IT ▸</button>
      <style>{`
        .ct-tip { border: 1px dashed rgba(255,210,58,0.55); background: rgba(16,13,2,0.92); padding: 11px 12px;
          display: flex; flex-direction: column; gap: 6px; font-family: 'Courier New', monospace; }
        .ct-tip-title { color: #ffd23a; font-size: 10.5px; letter-spacing: 0.12em; font-weight: bold; }
        .ct-tip-body { color: #eafff9; font-size: 11.5px; line-height: 1.55; }
        .ct-tip-btn { align-self: flex-end; background: rgba(255,210,58,0.12); border: 1px solid #ffd23a; color: #ffd23a;
          font-family: inherit; font-size: 10.5px; font-weight: bold; letter-spacing: 0.08em; padding: 6px 12px; cursor: pointer; }
        .ct-tip-float { position: absolute; left: 12px; right: 12px; bottom: ${DOCK_H + 12}px; z-index: 10080;
          box-shadow: 0 6px 24px rgba(0,0,0,0.6); }
      `}</style>
    </div>
  );
}
