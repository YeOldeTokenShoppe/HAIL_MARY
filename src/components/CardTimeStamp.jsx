import React from "react";

// The same ticket stamp is used by Eugene and the R-cana Trader abilities.
export default function TimeStamp({ children, style, small = false, tilt }) {
  const cls = ["tc-stamp", small && "tc-stamp--small", tilt === "left" && "tc-stamp--tilt-left"].filter(Boolean).join(" ");
  return (
    <span className={cls} style={style}>
      <span className="tc-stamp__inner">{children}</span>
    </span>
  );
}

export const TIME_STAMP_STYLES = `
  /* Double-ruled ink box, worn with the original radial mask. */
  .tc-stamp {
    display: inline-block;
    padding: 3px;
    border: 2.5px solid var(--effect-ink, #07ddf0);
    border-radius: 6px;
    transform: rotate(-5deg);
    background: rgba(0,0,0,.28);
    box-shadow: 0 3px 8px rgba(0,0,0,.45);
    -webkit-mask-image: radial-gradient(120% 90% at 42% 55%, #000 55%, rgba(0,0,0,.55) 100%);
            mask-image: radial-gradient(120% 90% at 42% 55%, #000 55%, rgba(0,0,0,.55) 100%);
  }
  .tc-stamp__inner {
    display: block;
    padding: 4px 16px;
    border: 1px solid var(--effect-ink, #07ddf0);
    border-radius: 3px;
    font-family: "IBM Plex Mono", "SF Mono", Menlo, monospace;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: .26em;
    text-transform: uppercase;
    color: var(--effect-ink, #07ddf0);
    text-shadow: 0 0 6px rgba(0,0,0,.6);
  }

  .tc-stamp--tilt-left { transform: rotate(-3deg); }
  .tc-stamp--small {
    transform: rotate(3deg);
    border-width: 2px;
    padding: 2px;
  }
  .tc-stamp--small .tc-stamp__inner {
    padding: 2px 10px;
    font-size: 13px;
    letter-spacing: .22em;
  }
`;
