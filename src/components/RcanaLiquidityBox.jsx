import React, { useId } from "react";
import RcanaCredBadge, { CRED_BADGE_STYLES } from "./RcanaCredBadge.jsx";

const box = ({ x, y, w, h }) => ({ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });

// Ribbon fields match HEADER_COLORS; measured coin centers keep live values
// centered in each painted variant. Trader artwork already uses its red accent.
const RIBBON_ART = {
  Asset: {
    hydro: { image: "/RL80_COST_ribbon_asset.webp", coin: [87.63, 48] },
    prosperity: { image: "/RL80_PROSPERITY_stack_ribbon_asset.webp" },
  },
  Event: {
    hydro: { image: "/RL80_COST_ribbon_event.webp", coin: [86.35, 48] },
    prosperity: { image: "/RL80_PROSPERITY_stack_ribbon_event.webp" },
  },
  Artifact: {
    hydro: { image: "/RL80_COST_ribbon_artifact.webp", coin: [86.9, 48.07] },
  },
};

export function RcanaLiquidityBox({ value, income, slot, hideFrame = false, label = "Cost", ribbon = false, cardClass }) {
  if (income !== undefined) {
    return (
      <div className="rc-liquidity-pair" style={box(slot)} data-hide-frame={hideFrame || undefined} role="group" aria-label="Cost and income">
        <div className="rc-liquidity-bar">
          <span className="rc-bar-value rc-bar-value--cost" data-len={String(value ?? "").length} role="img" aria-label={`Cost: ${value ?? "blank"} Hydro`}>
            <span aria-hidden="true">{value ?? ""}</span>
          </span>
          <span className="rc-bar-value rc-bar-value--income" data-len={String(income ?? "").length} role="img" aria-label={`Income: ${income ?? "blank"} Hydro`}>
            <span aria-hidden="true">{income ?? ""}</span>
          </span>
        </div>
      </div>
    );
  }
  return <RcanaValueBox value={value} slot={slot} hideFrame={hideFrame} label={label} kind="hydro" ribbon={ribbon} cardClass={cardClass} />;
}

export function RcanaValueBox({ value, slot, hideFrame = false, label, showLabel = true, kind, ribbon = false, cardClass, credBadge = "angel-plain" }) {
  const arcId = `rc-stat-${useId().replace(/:/g, "")}`;
  if (kind === "grace" && credBadge !== "ribbon") {
    return <RcanaCredBadge value={value} slot={slot} hideFrame={hideFrame} label={label} showLabel={showLabel} variant={credBadge} />;
  }
  // CRED, PROSPERITY and COST ribbons already have their labels in the art.
  const ribbonBadge = ribbon || kind === "prosperity";
  const printedLabel = kind === "grace" || ribbonBadge;
  const curvedLabel = kind === "hydro" && !ribbonBadge;
  const arcText = label?.replace(/\s*\/\s*/g, "/").toUpperCase();
  const art = ribbonBadge ? RIBBON_ART[cardClass]?.[kind] : undefined;
  const style = {
    ...(slot ? box(slot) : {}),
    ...(art ? { "--rc-ribbon-art": `url("${art.image}")` } : {}),
    ...(art?.coin ? {
      "--rc-coin-x": `${art.coin[0]}%`,
      "--rc-coin-y": `${art.coin[1]}%`,
      // Each 3:1 badge is .1 card-widths tall; align the coin's center.
      "--rc-coin-shift": (50 - art.coin[1]) * .001,
    } : {}),
  };
  return (
    <div className="rc-liquidity" style={style} data-kind={kind} data-ribbon={ribbonBadge || undefined} data-hide-frame={hideFrame || undefined} role="img" aria-label={`${label}: ${value ?? "blank"}${kind === "hydro" && value != null && value !== "—" ? " Hydro" : ""}`}>
      {showLabel && !curvedLabel && !printedLabel && <span className="rc-liquidity-label" aria-hidden="true">{label}</span>}
      <span className="rc-liquidity-value" data-len={String(value ?? "").length} aria-hidden="true">
        {curvedLabel && showLabel && (
          <svg className="rc-stat-label" viewBox="0 0 100 32" focusable="false">
            <defs><path id={arcId} d="M2 30 Q50 -6 98 30" /></defs>
            <text><textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">{arcText}</textPath></text>
          </svg>
        )}
        <span className="rc-liquidity-number">{value ?? ""}</span>
      </span>
    </div>
  );
}

export const LIQUIDITY_BOX_STYLES = `
${CRED_BADGE_STYLES}
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
.rc-liquidity[data-kind="grace"] .rc-liquidity-value {
  width: calc(var(--u) * .19);
  height: auto;
  aspect-ratio: 1688 / 932;
  margin-left: calc(var(--u) * .008);
  /* Align the enamel center with the cost/income coins, allowing ribbon overlap. */
  transform: translateY(calc(var(--u) * .008));
  background-image: url("/RL80_CRED_medal_clean.webp");
  font-size: calc(var(--u) * .038);
  color: #fff4d1;
  text-shadow: 0 calc(var(--u) * .001) calc(var(--u) * .0015) rgba(20, 27, 61, .5);
  padding: 0;
}
.rc-liquidity[data-kind="grace"] .rc-liquidity-number {
  position: absolute;
  /* Centre of the blue enamel, not the whole ribbon image. */
  left: 22.7%;
  top: 42.1%;
  transform: translate(-50%, -50%);
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
.rc-liquidity[data-kind="grace"] .rc-liquidity-value[data-len="3"] { font-size: calc(var(--u) * .030); }
.rc-liquidity[data-kind="grace"] .rc-liquidity-value[data-len="4"] { font-size: calc(var(--u) * .0235); }
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
.rc-liquidity[data-ribbon] .rc-liquidity-value {
  /* Equal-width ribbons flank the emblem; the coin artwork faces outward. */
  width: calc(var(--u) * .30);
  height: auto;
  aspect-ratio: 2172 / 724;
  margin-right: calc(var(--u) * .008);
  transform: translateY(calc(var(--u) * var(--rc-coin-shift, .00187)));
  background-image: var(--rc-ribbon-art, url("/RL80_COST_ribbon_wide.webp"));
  font-size: calc(var(--u) * .032);
  color: #3f250e;
  text-shadow: 0 calc(var(--u) * .001) 0 rgba(255, 232, 161, .65);
  padding: 0;
}
.rc-liquidity[data-ribbon] .rc-liquidity-number {
  position: absolute;
  /* Center of the right-hand gold well in the 2172 × 724 artwork. */
  left: var(--rc-coin-x, 86.14%);
  top: var(--rc-coin-y, 48.14%);
  transform: translate(-50%, -50%);
  -webkit-text-stroke: 0;
}
.rc-liquidity[data-ribbon] .rc-liquidity-value[data-len="2"] { font-size: calc(var(--u) * .026); }
.rc-liquidity[data-ribbon] .rc-liquidity-value[data-len="3"] { font-size: calc(var(--u) * .021); }
.rc-liquidity[data-ribbon] .rc-liquidity-value[data-len="4"] { font-size: calc(var(--u) * .018); }
.rc-liquidity[data-kind="prosperity"] .rc-liquidity-value {
  margin-left: calc(var(--u) * .008);
  margin-right: 0;
  transform: translateY(calc(var(--u) * .0022));
  background-image: var(--rc-ribbon-art, url("/RL80_PROSPERITY_stack_ribbon.webp"));
}
.rc-liquidity[data-kind="prosperity"] .rc-liquidity-number {
  /* Blank top face of the three-coin stack, above its visible gold rims. */
  left: 13.05%;
  top: 32.4%;
}
.rc-liquidity[data-kind="prosperity"] .rc-liquidity-value[data-len="3"] { font-size: calc(var(--u) * .030); }
.rc-liquidity[data-kind="prosperity"] .rc-liquidity-value[data-len="4"] { font-size: calc(var(--u) * .0235); }
.rc-liquidity-pair {
  position: absolute;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}
.rc-liquidity-bar {
  position: relative;
  flex: 0 0 auto;
  width: calc(var(--u) * .25);
  aspect-ratio: 2098 / 749;
  background: url("/RL80_COST_INCOME_coin_bar_clean.webp") center / contain no-repeat;
  font-family: "Bebas Neue", "Anton", ui-sans-serif, system-ui;
  font-weight: 400;
  font-size: calc(var(--u) * .032);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  /* Dark engraved numerals contrast with the gold coin centres. */
  color: #3f250e;
  text-shadow: 0 calc(var(--u) * .001) 0 rgba(255, 232, 161, .65);
}
.rc-bar-value {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  /* No thick dark outline: the new number fill already supplies the contrast. */
  -webkit-text-stroke: 0;
}
/* Coordinates follow the two coin centers in the cleaned 2098 × 749 art. */
.rc-bar-value--cost { left: 17%; }
.rc-bar-value--income { left: 83.9%; }
.rc-bar-value[data-len="2"] { font-size: calc(var(--u) * .026); }
.rc-bar-value[data-len="3"] { font-size: calc(var(--u) * .021); }
.rc-bar-value[data-len="4"] { font-size: calc(var(--u) * .018); }
.rc-liquidity-pair[data-hide-frame] .rc-liquidity-bar { background-image: none; }
.rc-liquidity[data-hide-frame] .rc-liquidity-value { background-image: none; }
`;
