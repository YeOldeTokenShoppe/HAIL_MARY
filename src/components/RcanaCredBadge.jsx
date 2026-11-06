import React from "react";

const ART = {
  "angel-lateral": { image: "/RL80_CRED_angel_lateral.webp", ratio: "1774 / 887", labelInArt: true },
  angel: { image: "/RL80_CRED_angel.webp", ratio: "1774 / 887", labelInArt: true },
  "angel-plain": { image: "/RL80_CRED_angel_plain.webp", ratio: "1774 / 887", labelInArt: true },
  "angel-jaunty": { image: "/RL80_CRED_angel_jaunty.webp", ratio: "1774 / 887", labelInArt: true },
  "angel-soft-rays": { image: "/RL80_CRED_angel_soft_rays.webp", ratio: "1774 / 887", labelInArt: true },
  heart: { image: "/RL80_CRED_winged_heart.webp", ratio: "1728 / 910" },
  oval: { image: "/RL80_CRED_winged_oval.webp", ratio: "1577 / 997" },
};

// The enamel stays blank in the painting so values remain live. The angel
// carries CRED on its painted extension; the earlier winged shapes use text.
export default function RcanaCredBadge({ value, slot, variant = "angel-plain", hideFrame = false, showLabel = true, label = "Credibility" }) {
  const shape = Object.hasOwn(ART, variant) ? variant : "angel-plain";
  const art = ART[shape];
  return (
    <div className="rc-cred-badge" data-shape={shape} data-label-extension={art.labelInArt || undefined} data-hide-frame={hideFrame || undefined}
      style={slot ? { left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%` } : undefined}
      role="img" aria-label={`${label}: ${value ?? "blank"}`}>
      <span className="rc-cred-mark" style={{ aspectRatio: art.ratio }} aria-hidden="true">
        <img className="rc-cred-art" src={art.image} alt="" draggable={false} />
        <span className="rc-cred-reading">
          <span className="rc-cred-number" data-len={String(value ?? "").length}>{value ?? ""}</span>
          {showLabel && !art.labelInArt && <span className="rc-cred-label">CRED</span>}
        </span>
      </span>
    </div>
  );
}

export const CRED_BADGE_STYLES = `
.rc-cred-badge {
  --rc-cred-height: calc(var(--u) * .094);
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff1cf;
  font-family: "Bebas Neue", "Anton", ui-sans-serif, system-ui;
  font-weight: 400;
  text-align: center;
  text-shadow: 0 calc(var(--u) * .001) calc(var(--u) * .0015) #07102f;
}
.rc-cred-mark {
  position: relative;
  display: block;
  height: var(--rc-cred-height);
  flex: 0 0 auto;
  /* Center in the full stat band and clear both of its horizontal borders. */
  transform: translateY(calc(var(--u) * -.00625));
}
.rc-cred-art { display: block; width: 100%; height: 100%; }
.rc-cred-reading {
  position: absolute;
  left: 49.7%;
  top: 56%;
  transform: translate(-50%, -50%);
  display: grid;
  justify-items: center;
  gap: calc(var(--rc-cred-height) * .014);
}
.rc-cred-number {
  font-size: calc(var(--rc-cred-height) * .355);
  font-variant-numeric: tabular-nums;
  line-height: .9;
}
.rc-cred-number[data-len="3"] { font-size: calc(var(--rc-cred-height) * .280); }
.rc-cred-number[data-len="4"] { font-size: calc(var(--rc-cred-height) * .224); }
.rc-cred-label {
  font-size: calc(var(--rc-cred-height) * .150);
  letter-spacing: .035em;
  line-height: 1;
}
.rc-cred-badge[data-label-extension] .rc-cred-reading {
  /* Center of the round blue head in the 1774 × 887 angel artwork. */
  left: 20.4%;
  top: 58.1%;
}
.rc-cred-badge[data-label-extension] .rc-cred-number { font-size: calc(var(--rc-cred-height) * .44); }
.rc-cred-badge[data-shape="angel-jaunty"] .rc-cred-reading { left: 20.15%; top: 58.23%; }
.rc-cred-badge[data-shape="angel-soft-rays"] .rc-cred-reading { left: 20.35%; top: 63.13%; }
.rc-cred-badge[data-label-extension] .rc-cred-number[data-len="3"] { font-size: calc(var(--rc-cred-height) * .34); }
.rc-cred-badge[data-label-extension] .rc-cred-number[data-len="4"] { font-size: calc(var(--rc-cred-height) * .28); }
.rc-cred-badge[data-hide-frame] .rc-cred-art { visibility: hidden; }
`;
