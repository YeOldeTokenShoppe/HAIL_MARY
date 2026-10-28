import React from "react";

const box = ({ x, y, w, h }) => ({ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });

export function RcanaLiquidityBox({ value, slot, hideFrame = false }) {
  return (
    <div className="rc-liquidity" style={box(slot)} data-hide-frame={hideFrame || undefined} role="img" aria-label={value == null ? "Liquidity" : `Liquidity: ${value}`}>
      <span className="rc-liquidity-icon" aria-hidden="true">
        <svg viewBox="0 0 40 56" focusable="false">
          <path d="M20 4C16 14 5 25 5 35a15 15 0 0 0 30 0C35 25 24 14 20 4Z" fill="#245fa4" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="rc-liquidity-value" data-len={String(value ?? "").length} aria-hidden="true">{value ?? ""}</span>
    </div>
  );
}

export const LIQUIDITY_BOX_STYLES = `
.rc-liquidity {
  position: absolute;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 54% 46%;
  align-items: center;
  border: calc(var(--u) * .006) solid #1d190f;
  border-radius: calc(var(--u) * .016);
  background: #155b60;
  color: #fff0bc;
}
.rc-liquidity::before {
  content: "";
  position: absolute;
  inset: calc(var(--u) * .0025);
  border: calc(var(--u) * .0015) solid #f4cd61;
  border-radius: calc(var(--u) * .008);
  pointer-events: none;
}
.rc-liquidity::after {
  content: "";
  position: absolute;
  left: 54%;
  top: 16%;
  bottom: 16%;
  width: calc(var(--u) * .0015);
  background: #f4cd61;
}
.rc-liquidity-icon { display: grid; place-items: center; }
.rc-liquidity-icon svg {
  display: block;
  width: calc(var(--u) * .062);
  height: calc(var(--u) * .084);
}
.rc-liquidity-value {
  text-align: center;
  font-family: "Bebas Neue", "Anton", ui-sans-serif, system-ui;
  font-weight: 400;
  font-size: calc(var(--u) * .068);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  padding-top: calc(var(--u) * .004);
}
.rc-liquidity-value[data-len="3"] { font-size: calc(var(--u) * .05); }
.rc-liquidity-value[data-len="4"] { font-size: calc(var(--u) * .038); }
.rc-liquidity[data-hide-frame] { background: none; border-color: transparent; color: #1d190f; }
.rc-liquidity[data-hide-frame]::before,
.rc-liquidity[data-hide-frame]::after,
.rc-liquidity[data-hide-frame] .rc-liquidity-icon { visibility: hidden; }
`;
