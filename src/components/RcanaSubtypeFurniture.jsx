import React from "react";
import { SUBTYPE_HEADER, SUBTYPE_USAGE_SLOT } from "../game/rcana/subtypeTemplate.js";
import { HEADER_COLORS } from "../game/rcana/headerColors.js";

const box = ({ x, y, w, h }) => ({ left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });

function SubtypeSymbol({ kind }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {kind === "remedy" ? <>
        <path d="M12 3h8M13 3v9a10 10 0 1 0 6 0V3M7 21h18" />
        <circle cx="13" cy="18" r="1" fill="currentColor" stroke="none" />
      </> : kind === "grace" ? <>
        <path d="M11 17h10v12H11zM8 29h16M16 3c-1 4-5 5-5 8a5 5 0 0 0 10 0c0-3-4-4-5-8Z" />
      </> : kind === "hazard" ? <>
        <path d="M10 27v-5a11 11 0 1 1 12 0v5H10ZM14 24v3M18 24v3" />
        <circle cx="11.5" cy="15" r="2" /><circle cx="20.5" cy="15" r="2" />
        <path d="m16 19-1 2h2Z" fill="currentColor" stroke="none" />
      </> : kind === "opportunity" ? <>
        <path d="m13 5 3 8 8 3-8 3-3 8-3-8-8-3 8-3ZM25 2v6M22 5h6M25 24v6M22 27h6" />
      </> : kind === "market" ? <>
        <circle cx="16" cy="16" r="13" /><ellipse cx="16" cy="16" rx="6" ry="13" /><path d="M3 16h26" />
      </> : <path d="M7 10h18v17H7zM5 6h22v5H5zM16 6v21" />}
    </svg>
  );
}

export function RcanaSubtypeHeader({ data, template, hideFrame = false }) {
  if (!template) return null;
  return (
    <div className={`rc-subtype-header rc-${data.cardClass.toLowerCase()}-header`} style={{ ...box(SUBTYPE_HEADER), "--subtype-enamel": HEADER_COLORS[data.cardClass] }} data-class={data.cardClass} data-hide-frame={hideFrame || undefined} data-subtype={template.subtype || undefined} aria-label={[data.number != null ? `No. ${data.number}` : null, template.subtype, data.cardClass].filter(Boolean).join(", ")}>
      <span className="rc-subtype-number">{data.number ?? ""}</span>
      {template.subtype && (
        <span className="rc-subtype-field">
          <span className="rc-subtype-icon"><SubtypeSymbol kind={template.symbol} /></span>
          <span className="rc-subtype-label" data-long={template.subtype.length > 9 || undefined}>{template.subtype}</span>
        </span>
      )}
      <span className="rc-subtype-class">{data.cardClass}</span>
    </div>
  );
}

function UsageSymbol({ kind }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {kind === "single-use" || kind === "spend" ? <>
        <g transform="rotate(-12 33 17)"><rect x="24" y="4" width="19" height="26" rx="2" /><path d="M29 11h9M29 16h6" /></g>
        <path d="M33 34v9m-5-5 5 5 5-5M11 50l21-6 21 6-21 7-21-7Zm0 7 21 6 21-6" />
      </> : kind === "equip" ? <>
        <rect x="22" y="7" width="20" height="35" rx="2" />
        <path d="M27 15h10M27 21h10M13 28v28h38V28M18 31v19h28V31" />
      </> : kind === "offer" ? <>
        <rect x="8" y="16" width="22" height="34" rx="2" /><path d="M14 24h10M14 31h10M38 33h18m-7-8 8 8-8 8" />
      </> : kind === "until-cleared" ? <>
        <rect x="12" y="8" width="40" height="48" rx="3" />
        <path d="M25 18h14l-2 10 7 7H20l7-7-2-10ZM32 35v12" />
      </> : kind === "on-draw" ? <>
        <rect x="10" y="28" width="27" height="30" rx="2" /><path d="M15 23h27v30M20 18h27v30M44 31V5m-8 8 8-8 8 8" />
      </> : <>
        <path d="M10 56V32c0-11 11-20 22-26 11 6 22 15 22 26v24M6 58h52M24 55h16M27 34h10v18H27z" />
        <path d="M32 18c-1 5-5 7-5 10a5 5 0 0 0 10 0c0-3-4-5-5-10Z" fill="currentColor" stroke="none" />
      </>}
    </svg>
  );
}

export function RcanaUsageBadge({ template, cardClass }) {
  if (!template?.usage) return null;
  return (
    <div className={`rc-subtype-usage rc-${cardClass.toLowerCase()}-usage`} style={{ ...box(SUBTYPE_USAGE_SLOT), "--usage-enamel": template.color || HEADER_COLORS[cardClass] }} data-usage={template.usage} role="img" aria-label={`${template.label}: ${template.description}`}>
      <div className="rc-subtype-medallion"><UsageSymbol kind={template.usage} /></div>
      <span>{template.label}</span>
    </div>
  );
}

export const SUBTYPE_FURNITURE_STYLES = `
.rc-subtype-header {
  --subtype-ink: #1d190f;
  --subtype-gold: #f4cd61;
  --subtype-paper: #ffe395;
  --subtype-enamel: #155b60;
  position: absolute;
  box-sizing: border-box;
  display: flex;
  align-items: stretch;
  overflow: hidden;
  line-height: 1;
  color: var(--subtype-ink);
  background: linear-gradient(110deg, var(--subtype-paper), var(--subtype-gold));
  border: calc(var(--u) * .0065) solid var(--subtype-ink);
  border-radius: calc(var(--u) * .024) calc(var(--u) * .024) calc(var(--u) * .015) calc(var(--u) * .002);
}
.rc-subtype-number {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 10%;
  font-family: "Bebas Neue", Impact, sans-serif;
  font-size: calc(var(--u) * .07);
  font-weight: 400;
  padding-top: calc(var(--u) * .003);
  border-right: calc(var(--u) * .004) solid var(--subtype-ink);
}
.rc-subtype-field {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  gap: calc(var(--u) * .018);
  padding: 0 calc(var(--u) * .07) 0 calc(var(--u) * .03);
  background: var(--subtype-enamel);
  color: #fff0bc;
  font-family: "Arial Narrow", "Roboto Condensed", Arial, sans-serif;
  font-size: calc(var(--u) * .057);
  font-weight: 700;
  letter-spacing: calc(var(--u) * -.001);
  border-radius: 0 0 calc(var(--u) * .08) 0;
  border-right: calc(var(--u) * .004) solid var(--subtype-ink);
  border-bottom: calc(var(--u) * .003) solid var(--subtype-ink);
  box-shadow: inset 0 0 0 calc(var(--u) * .0035) var(--subtype-gold);
}
.rc-subtype-label { white-space: nowrap; }
.rc-subtype-label[data-long] { font-size: calc(var(--u) * .049); }
.rc-subtype-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 calc(var(--u) * .064);
  width: calc(var(--u) * .064);
  height: calc(var(--u) * .064);
}
.rc-subtype-icon svg { width: 100%; height: 100%; overflow: visible; }
.rc-subtype-class {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 30%;
  margin-left: auto;
  padding: 0 calc(var(--u) * .018) 0 calc(var(--u) * .007);
  font-family: "Blackletter", "UnifrakturCook", serif;
  font-weight: 400;
  font-size: calc(var(--u) * .055);
  white-space: nowrap;
}
.rc-subtype-header[data-hide-frame] { background: none; border-color: transparent; }
.rc-subtype-header[data-class="Event"] .rc-subtype-class { flex-basis: 25%; }
.rc-subtype-header[data-hide-frame] .rc-subtype-number { border-color: transparent; }
.rc-subtype-header[data-hide-frame] .rc-subtype-field { background: none; border-color: transparent; box-shadow: none; }
.rc-subtype-usage {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: calc(var(--u) * .003);
  color: #1d190f;
}
.rc-subtype-medallion {
  display: grid;
  place-items: center;
  box-sizing: border-box;
  width: calc(var(--u) * .077);
  height: calc(var(--u) * .077);
  flex: 0 0 auto;
  border-radius: 50%;
  border: calc(var(--u) * .002) solid var(--usage-enamel);
  background: var(--usage-enamel);
  color: #fff0bc;
  box-shadow: inset 0 0 0 calc(var(--u) * .0015) #fff0bc, inset 0 0 0 calc(var(--u) * .005) var(--usage-enamel), inset 0 0 0 calc(var(--u) * .006) #fff0bc;
}
.rc-subtype-medallion svg { width: 70%; height: 70%; }
.rc-subtype-usage > span {
  font-family: "Bebas Neue", Impact, sans-serif;
  font-size: calc(var(--u) * .022);
  font-weight: 400;
  line-height: 1;
  letter-spacing: calc(var(--u) * .0006);
  white-space: nowrap;
  text-transform: uppercase;
}
`;
