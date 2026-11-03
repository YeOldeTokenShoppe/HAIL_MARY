import React from "react";
import { HEADER_COLORS } from "../game/rcana/headerColors.js";
import { TYPE_WORDMARKS } from "../game/rcana/typeWordmarks.js";

export function RcanaTypeHeader({ data, slot, hideFrame = false, classFont = "mosaic" }) {
  const wordmark = classFont === "mosaic" ? TYPE_WORDMARKS[data.cardClass] : null;
  return (
    <div
      className="rc-type-header"
      style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.w}%`, height: `${slot.h}%`, "--type-header-color": HEADER_COLORS[data.cardClass] || HEADER_COLORS.Artifact }}
      data-hide-frame={hideFrame || undefined}
      aria-label={[data.number != null ? `No. ${data.number}` : null, data.cardClass].filter(Boolean).join(", ")}
    >
      <span className="rc-type-number">{data.number ?? ""}</span>
      <span className="rc-type-class" data-font={classFont} data-wordmark={wordmark ? true : undefined}>
        <span className="rc-type-label">
          {wordmark ? (
            <svg className="rc-type-wordmark" viewBox={wordmark.viewBox.join(" ")}
              width={wordmark.viewBox[2]} height={wordmark.viewBox[3]}
              preserveAspectRatio="xMidYMid meet" role="img" aria-label={data.cardClass} focusable="false">
              <image href={wordmark.src} width={wordmark.width} height={wordmark.height} aria-hidden="true" />
            </svg>
          ) : classFont === "bebas" || classFont === "mosaic" ? data.cardClass?.toUpperCase() : data.cardClass}
          {data.tabCost > 0 && <i className="rc-cost" aria-label={`cost ${data.tabCost}`}>{data.tabCost}</i>}
        </span>
      </span>
    </div>
  );
}

export const TYPE_HEADER_STYLES = `
.rc-type-header {
  position: absolute;
  box-sizing: border-box;
  display: flex;
  overflow: hidden;
  border: calc(var(--u) * .0065) solid #1d190f;
  border-radius: calc(var(--u) * .016) 0 calc(var(--u) * .043) 0;
  background: #f7d572;
}
.rc-type-number {
  box-sizing: border-box;
  display: grid;
  place-items: center;
  flex: 0 0 calc(var(--u) * .095);
  width: calc(var(--u) * .095);
  border-right: calc(var(--u) * .004) solid #1d190f;
  padding-top: calc(var(--u) * .003);
  font-family: "Bebas Neue", Impact, sans-serif;
  font-size: calc(var(--u) * .069);
  font-weight: 400;
  line-height: 1;
  color: #1d190f;
}
.rc-type-class {
  display: grid;
  place-items: center;
  flex: 1;
  min-width: 0;
  padding-right: calc(var(--u) * .016);
  background: var(--type-header-color);
  color: #fff0bc;
  border-radius: 0 0 calc(var(--u) * .035) 0;
  box-shadow: inset 0 0 0 calc(var(--u) * .0035) #f4cd61;
  font-family: "Blackletter", "UnifrakturCook", Georgia, serif;
  font-size: calc(var(--u) * .059);
  font-weight: 400;
  line-height: 1;
  white-space: nowrap;
}
.rc-type-class[data-font="bebas"],
.rc-type-class[data-font="mosaic"] {
  font-family: "Bebas Neue", Impact, sans-serif;
  font-size: calc(var(--u) * .055);
  letter-spacing: .1em;
  padding-top: calc(var(--u) * .004);
}
.rc-type-class[data-wordmark] {
  grid-template-columns: minmax(0, 1fr);
  padding: 0 calc(var(--u) * .026) 0 calc(var(--u) * .018);
}
.rc-type-class[data-wordmark] .rc-type-label {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  width: 100%;
}
.rc-type-wordmark {
  display: block;
  flex-shrink: 1;
  width: auto;
  max-width: 100%;
  height: calc(var(--u) * .055);
}
/* "gilt": the ExtraBold struck in gold — hairline light on top, a dark bevel
   under, a soft drop — so the class reads as a stamped gilt letter, the same
   metal as the Nabla name on the banner. The shadow font was tried and
   rejected here: at tab size its hairline interior fills in. */
.rc-type-class[data-font="gilt"] {
  color: #f4cd61;
  text-shadow:
    0 calc(var(--u) * -.0012) 0 #fff6d0,
    0 calc(var(--u) * .002) 0 #6a4a08,
    0 calc(var(--u) * .004) calc(var(--u) * .005) rgba(0, 0, 0, .45);
}
.rc-type-header[data-hide-frame] { background: none; border-color: transparent; }
.rc-type-header[data-hide-frame] .rc-type-number { border-color: transparent; }
.rc-type-header[data-hide-frame] .rc-type-class { background: none; box-shadow: none; }
`;
