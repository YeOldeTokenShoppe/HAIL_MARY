import React from 'react';

// Image — display a pre-rendered evidence asset (typically a .webp
// screenshot of a faux tweet, Telegram chat, block-explorer view, contract
// source pane, etc). Use this when the diegetic "this is a real artifact
// the player found" effect matters more than data binding or theming.
//
// File convention: store assets at `/public/evidence/case-NNN/<slug>.webp`
// and reference them as `/evidence/case-NNN/<slug>.webp` in `props.src`.
//
//   src:    asset URL — required
//   alt:    accessible description. Text baked into the image itself does
//           not translate; if i18n matters, prefer a procedural primitive.
//   fit:    "contain" (default) preserves aspect ratio with letterbox;
//           "cover" fills the frame and may crop.
//   threat: subtle inner-border tint so the asset still threads the
//           red/amber/green threat aesthetic of the surrounding overlay.

const THREAT_BORDER = {
  red:   'rgba(255,77,109,0.45)',
  amber: 'rgba(255,184,77,0.45)',
  green: 'rgba(77,255,170,0.30)',
};

export default function Image({
  src,
  alt = '',
  fit = 'contain',
  threat = 'green',
}) {
  if (!src) return null;
  return (
    <div
      style={{
        padding: 14,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        draggable={false}
        style={{
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: fit,
          borderRadius: 4,
          border: `1px solid ${THREAT_BORDER[threat] || THREAT_BORDER.green}`,
          boxShadow: '0 0 24px rgba(0,0,0,0.6)',
          // Light phosphor lift so flat screenshots sit a hair closer to
          // the CRT palette without obviously filtering the content.
          filter: 'contrast(1.04) saturate(1.05)',
        }}
      />
    </div>
  );
}
