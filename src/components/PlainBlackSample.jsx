"use client";

import { useEffect, useState } from 'react';
import localFont from 'next/font/local';

const plainBlack = localFont({ src: '../../public/fonts/PlainBlack/Plain_Black.woff2', weight: '400', style: 'normal', display: 'swap' });

export default function PlainBlackSample() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(new URLSearchParams(window.location.search).get('fontSample') === '1');
  }, []);
  if (!visible) return null;
  return (
    <aside aria-label="PlainBlack font sample" className="plainblack-preview">
      <div className="sample-label">
        PlainBlack Normal · 90px
        <button type="button" onClick={() => setVisible(false)} aria-label="Close font sample">×</button>
      </div>
      <div className={`sample-lettering ${plainBlack.className}`}>Perpetual<br />Profit</div>
      <style jsx>{`
        .plainblack-preview {
          position: fixed;
          left: 5vw;
          top: 27vh;
          z-index: 100001;
          pointer-events: none;
        }
        .sample-label {
          display: flex;
          align-items: center;
          gap: 20px;
          width: fit-content;
          padding: 5px 10px;
          border-radius: 6px;
          background: rgba(0,0,0,.72);
          color: white;
          font: 12px system-ui, sans-serif;
          margin-bottom: 16px;
        }
        button {
          pointer-events: auto;
          color: white;
          background: transparent;
          border: 0;
          cursor: pointer;
          font: 22px system-ui, sans-serif;
        }
        .sample-lettering {
          font-size: 90px;
          font-weight: 400;
          line-height: 1.06;
          color: #000;
          -webkit-text-stroke: 3px #fff;
          paint-order: stroke fill;
          text-shadow: 4px 4px 8px rgba(74,74,74,0.8);
        }
        @media (max-width: 480px) {
          .sample-lettering { font-size: 64px; }
        }
      `}</style>
    </aside>
  );
}
