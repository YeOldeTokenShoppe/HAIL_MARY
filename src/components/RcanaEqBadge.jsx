import React from "react";
import { HEADER_COLORS } from "../game/rcana/headerColors.js";

// EQUANIMITY — the third of a Trader's trinity (Liquidity, Credibility,
// Equanimity), printed in the header's free right half as a pill: the value
// in a round gold frame, the word beside it in the CRED badge's lettering.
// The pill is tinted with the class header colour, so it reads as part of
// the Trader's furniture rather than a sticker on the art. No art file: the
// coin is the same /RoundGoldFrame2.png the value boxes use.
export default function RcanaEqBadge({ value, slot, hideFrame = false, cardClass = "Trader", label = "Equanimity" }) {
  return (
    <div
      className="rc-eq-badge"
      data-hide-frame={hideFrame || undefined}
      style={{ ...(slot ? { left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%` } : {}), "--rc-eq-tint": HEADER_COLORS[cardClass] || HEADER_COLORS.Trader }}
      role="img"
      aria-label={`${label}: ${value ?? "blank"}`}
    >
      <span className="rc-eq-pill" aria-hidden="true">
        <span className="rc-eq-number" data-len={String(value ?? "").length}>{value ?? ""}</span>
        <span className="rc-eq-label">{label.toUpperCase()}</span>
      </span>
    </div>
  );
}

export const EQ_BADGE_STYLES = `
.rc-eq-badge {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  color: #fff1cf;
  font-family: "Bebas Neue", "Anton", ui-sans-serif, system-ui;
  font-weight: 400;
  text-shadow: 0 calc(var(--u) * .001) calc(var(--u) * .0015) #07102f;
}
.rc-eq-pill {
  display: inline-flex;
  align-items: center;
  gap: calc(var(--u) * .009);
  height: calc(var(--u) * .064);
  padding: 0 calc(var(--u) * .017) 0 calc(var(--u) * .005);
  border-radius: calc(var(--u) * .04);
  background: linear-gradient(180deg, color-mix(in srgb, var(--rc-eq-tint) 82%, #fff) 0%, var(--rc-eq-tint) 45%, color-mix(in srgb, var(--rc-eq-tint) 70%, #000) 100%);
  box-shadow: 0 0 0 calc(var(--u) * .0036) #e8c76a, 0 calc(var(--u) * .003) calc(var(--u) * .008) #0009;
}
.rc-eq-number {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: calc(var(--u) * .056);
  height: calc(var(--u) * .056);
  background: url("/RoundGoldFrame2.png") center / contain no-repeat;
  color: #1d190f;
  text-shadow: none;
  font-size: calc(var(--u) * .034);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  padding-top: calc(var(--u) * .003);
}
.rc-eq-label {
  font-size: calc(var(--u) * .0255);
  letter-spacing: .07em;
  line-height: 1;
  padding-top: calc(var(--u) * .002);
}
.rc-eq-badge[data-hide-frame] { visibility: hidden; }
`;
