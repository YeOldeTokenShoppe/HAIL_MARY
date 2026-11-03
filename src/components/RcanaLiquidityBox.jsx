import React, { useId } from "react";

const box = ({ x, y, w, h }) => ({ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });

export function RcanaLiquidityBox({ value, income, slot, hideFrame = false, label = "Cost" }) {
  if (income !== undefined) {
    return (
      <div className="rc-liquidity-pair" style={box(slot)} role="group" aria-label="Cost and income">
        <RcanaValueBox value={value} hideFrame={hideFrame} label="Cost" kind="hydro" />
        <RcanaValueBox value={income} hideFrame={hideFrame} label="Income" kind="hydro" />
      </div>
    );
  }
  return <RcanaValueBox value={value} slot={slot} hideFrame={hideFrame} label={label} kind="hydro" />;
}

export function RcanaValueBox({ value, slot, hideFrame = false, label, showLabel = true, kind }) {
  const arcId = `rc-stat-${useId().replace(/:/g, "")}`;
  const curvedLabel = kind === "grace" || kind === "hydro" || kind === "prosperity";
  const arcText = kind === "grace" ? "CRED" : label?.replace(/\s*\/\s*/g, "/").toUpperCase();
  return (
    <div className="rc-liquidity" style={slot ? box(slot) : undefined} data-kind={kind} data-hide-frame={hideFrame || undefined} role="img" aria-label={`${label}: ${value ?? "blank"}${kind === "hydro" && value != null && value !== "—" ? " Hydro" : ""}`}>
      {showLabel && !curvedLabel && <span className="rc-liquidity-label" aria-hidden="true">{label}</span>}
      <span className="rc-liquidity-value" data-len={String(value ?? "").length} aria-hidden="true">
        {curvedLabel && showLabel && (
          <svg className="rc-stat-label" viewBox={kind === "prosperity" ? "0 0 140 32" : "0 0 100 32"} focusable="false">
            <defs><path id={arcId} d={kind === "prosperity" ? "M2 30 Q70 -6 138 30" : kind === "hydro" ? "M2 30 Q50 -6 98 30" : "M15 25 Q50 -1 85 25"} /></defs>
            <text><textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">{arcText}</textPath></text>
          </svg>
        )}
        <span className="rc-liquidity-number">{value ?? ""}</span>
      </span>
    </div>
  );
}

export const LIQUIDITY_BOX_STYLES = `
.rc-liquidity {
  position: absolute;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: center;
  column-gap: calc(var(--u) * .012);
  color: #1d190f;
}
.rc-liquidity-label {
  color: #5a4524;
  font-family: "Bebas Neue", Impact, sans-serif;
  font-size: calc(var(--u) * .022);
  font-weight: 400;
  line-height: 1.05;
  letter-spacing: .035em;
  text-transform: uppercase;
  white-space: pre-line;
}
.rc-liquidity[data-kind="grace"],
.rc-liquidity[data-kind="prosperity"] { justify-content: flex-start; }
.rc-liquidity[data-kind="hydro"] { justify-content: flex-end; }
.rc-liquidity-value {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  box-sizing: border-box;
  width: calc(var(--u) * .078);
  height: calc(var(--u) * .078);
  background: url("/RoundGoldFrame2.png") center / contain no-repeat;
  text-align: center;
  font-family: "Bebas Neue", "Anton", ui-sans-serif, system-ui;
  font-weight: 400;
  font-size: calc(var(--u) * .043);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  padding-top: calc(var(--u) * .004);
}
.rc-liquidity-value[data-len="3"] { font-size: calc(var(--u) * .034); }
.rc-liquidity-value[data-len="4"] { font-size: calc(var(--u) * .027); }
.rc-liquidity[data-kind="prosperity"] .rc-liquidity-value {
  width: calc(var(--u) * .092);
  height: calc(var(--u) * .092);
}
.rc-liquidity[data-kind="grace"] .rc-liquidity-value {
  width: calc(var(--u) * .092);
  height: calc(var(--u) * .092);
  isolation: isolate;
  background-image: none;
  font-size: calc(var(--u) * .034);
  color: #fff4d1;
  text-shadow: 0 calc(var(--u) * .001) calc(var(--u) * .0015) rgba(20, 27, 61, .5);
  padding-top: 0;
  padding-bottom: calc(var(--u) * .008);
}
.rc-liquidity[data-kind="grace"] .rc-liquidity-value::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background: url("/laurel2.png") center / contain no-repeat;
  /* Keep the supplied shield and its bevel, trimming the heavy baked shadow. */
  clip-path: polygon(50% 7%, 83% 14%, 83% 61%, 50% 94%, 17% 61%, 17% 14%);
}
.rc-stat-label {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: calc(var(--u) * -.009);
  width: calc(var(--u) * .086);
  height: auto;
  overflow: visible;
  fill: #5a4524;
  font-family: "Bebas Neue", Impact, sans-serif;
  font-size: 20px;
  font-weight: 400;
  letter-spacing: 1px;
  text-shadow: none;
}
/* Extend the arc for the longer word while retaining CRED's type scale. */
.rc-liquidity[data-kind="prosperity"] .rc-stat-label { width: calc(var(--u) * .1204); }
.rc-liquidity[data-kind="grace"] .rc-liquidity-value[data-len="3"] { font-size: calc(var(--u) * .027); }
.rc-liquidity[data-kind="grace"] .rc-liquidity-value[data-len="4"] { font-size: calc(var(--u) * .021); }
.rc-liquidity[data-kind="hydro"] .rc-liquidity-value {
  background-image: url("/GoldCoin.png");
  font-size: calc(var(--u) * .034);
  color: #fff4d1;
  text-shadow: 0 calc(var(--u) * .001) calc(var(--u) * .0015) rgba(82, 51, 10, .6);
}
.rc-liquidity[data-kind="hydro"] .rc-liquidity-number {
  -webkit-text-stroke: calc(var(--u) * .003) #3f2b0b;
  paint-order: stroke fill;
}
.rc-liquidity[data-kind="hydro"] .rc-liquidity-value[data-len="2"] { font-size: calc(var(--u) * .028); }
.rc-liquidity[data-kind="hydro"] .rc-liquidity-value[data-len="3"] { font-size: calc(var(--u) * .023); }
.rc-liquidity[data-kind="hydro"] .rc-liquidity-value[data-len="4"] { font-size: calc(var(--u) * .019); }
.rc-liquidity-pair {
  position: absolute;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  isolation: isolate;
}
.rc-liquidity-pair > .rc-liquidity {
  position: relative;
  flex: 0 0 auto;
  height: 100%;
  z-index: 0;
}
/* Overlap the rims only, keeping both labels and numbers fully visible. */
.rc-liquidity-pair > .rc-liquidity + .rc-liquidity {
  margin-left: calc(var(--u) * -.016);
  z-index: 1;
}
.rc-liquidity-pair .rc-liquidity[data-kind="hydro"] .rc-liquidity-value {
  width: calc(var(--u) * .074);
  height: calc(var(--u) * .074);
  font-size: calc(var(--u) * .032);
}
.rc-liquidity-pair .rc-liquidity[data-kind="hydro"] .rc-liquidity-value[data-len="2"] { font-size: calc(var(--u) * .026); }
.rc-liquidity-pair .rc-liquidity[data-kind="hydro"] .rc-liquidity-value[data-len="3"] { font-size: calc(var(--u) * .021); }
.rc-liquidity-pair .rc-liquidity[data-kind="hydro"] .rc-liquidity-value[data-len="4"] { font-size: calc(var(--u) * .018); }
.rc-liquidity[data-hide-frame] .rc-liquidity-value { background-image: none; }
.rc-liquidity[data-hide-frame] .rc-liquidity-value::before { display: none; }
`;
