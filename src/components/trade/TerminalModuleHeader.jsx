"use client";
import React from "react";

/**
 * Shared channel chrome for the mobile terminal modules. The content inside
 * each channel can be wildly different; this is the persistent machine around
 * it that makes every channel feel like part of one system.
 */
export default function TerminalModuleHeader({
  channel,
  mode,
  code,
  accent = "#2fd6d6",
  active = false,
  onBack,
}) {
  return (
    <header className="tmh-root" style={{ "--tmh-accent": accent }}>
      <div className="tmh-brand">
        <div className="tmh-channel">
          <span>{channel}</span>
          <i aria-hidden="true">//</i>
          <b>{mode}</b>
        </div>
        <div className="tmh-network">LIMINAL // RL80</div>
      </div>

      <div className="tmh-actions">
        <div className={`tmh-status ${active ? "is-active" : ""}`}>
          <i aria-hidden="true" />
          <span>{code}</span>
        </div>
        <button
          className="tmh-return"
          type="button"
          onClick={onBack}
          aria-label="Return to terminal"
        >
          <span aria-hidden="true">‹</span>
          <b>TERM</b>
        </button>
      </div>

      <style>{`
        .tmh-root {
          --tmh-accent: #2fd6d6;
          position: relative; z-index: 6; flex: 0 0 auto;
          min-height: 58px; display: flex; align-items: stretch;
          justify-content: space-between; padding-left: 14px;
          border-bottom: 1px solid color-mix(in srgb, #2fd6d6 22%, transparent);
          background:
            linear-gradient(90deg, color-mix(in srgb, var(--tmh-accent) 4%, transparent), transparent 42%),
            rgba(0, 10, 9, 0.96);
          font-family: 'IoskeleyMono', 'Courier New', monospace;
        }
        .tmh-root::after {
          content: ""; position: absolute; left: 0; right: 0; bottom: -4px;
          height: 3px; pointer-events: none;
          background: linear-gradient(90deg, var(--tmh-accent), #2fd6d6 42%, transparent 78%);
          opacity: 0.13;
        }
        .tmh-brand {
          min-width: 0; display: flex; flex-direction: column;
          justify-content: center; gap: 3px; padding: 9px 8px 8px 0;
        }
        .tmh-channel {
          min-width: 0; display: flex; align-items: baseline; gap: 7px;
          font-family: 'Orbitron', 'IoskeleyMono', monospace;
          font-size: 11px; line-height: 1; letter-spacing: 0.09em;
          white-space: nowrap;
        }
        .tmh-channel span {
          color: var(--tmh-accent); font-weight: 800;
          text-shadow: 0 0 11px color-mix(in srgb, var(--tmh-accent) 45%, transparent);
        }
        .tmh-channel i { color: #59eeec; font-style: normal; font-weight: 600; }
        .tmh-channel b {
          overflow: hidden; color: #d8f5ef; font-size: 8px;
          font-weight: 500; letter-spacing: 0.13em; text-overflow: ellipsis;
        }
        .tmh-network { color: #5a9690; font-size: 7px; letter-spacing: 0.22em; }
        .tmh-actions { flex: 0 0 auto; display: flex; align-items: stretch; }
        .tmh-status {
          display: flex; align-items: center; gap: 6px; padding: 0 10px;
          color: #74aaa4; font-size: 8px; letter-spacing: 0.15em;
        }
        .tmh-status i {
          width: 6px; height: 6px; border-radius: 50%;
          background: #24564f; box-shadow: 0 0 0 1px rgba(77,255,170,0.1);
        }
        .tmh-status.is-active i {
          background: #4dffaa; box-shadow: 0 0 9px rgba(77,255,170,0.75);
        }
        .tmh-return {
          position: relative; min-width: 60px; display: flex; align-items: center;
          justify-content: center; gap: 5px; padding: 0 10px;
          border: 0; border-left: 1px solid color-mix(in srgb, #2fd6d6 34%, transparent);
          background: rgba(2, 24, 22, 0.72); color: #a9d7d1; cursor: pointer;
          font: inherit; font-size: 13px;
          clip-path: polygon(0 0, calc(100% - 9px) 0, 100% 9px, 100% 100%, 9px 100%, 0 calc(100% - 9px));
        }
        .tmh-return::after {
          content: ""; position: absolute; inset: 5px;
          border: 1px solid color-mix(in srgb, var(--tmh-accent) 16%, transparent);
          pointer-events: none;
        }
        .tmh-return b { font-size: 8px; font-weight: 500; letter-spacing: 0.14em; }
        .tmh-return:hover, .tmh-return:focus-visible {
          outline: none; color: #effffc;
          background: color-mix(in srgb, var(--tmh-accent) 10%, #021816);
          box-shadow: inset 0 0 18px color-mix(in srgb, var(--tmh-accent) 10%, transparent);
        }
        @media (max-width: 340px) {
          .tmh-status { display: none; }
          .tmh-channel { gap: 5px; }
        }
      `}</style>
    </header>
  );
}
