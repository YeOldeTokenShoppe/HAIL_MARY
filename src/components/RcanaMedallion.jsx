"use client";

import React, { useId } from "react";

const ART = "/RL80_Mosaic_Medallion.webp";
const SIZE = 1254;
const DISC = { cx: 625, cy: 670, r: 420 };
const RINGS = Array.from({ length: 13 }, (_, i) => 70 + i * 28);
// Broad regions isolate the logo from the surrounding gold rays. The ink
// mask then follows the source pixels, including the holes in R, 8 and 0.
const HEART = "M624 476 C593 398 493 379 427 430 C374 472 379 569 406 617 C450 683 567 740 626 790 C687 737 798 674 834 607 C872 532 849 450 798 422 C727 381 650 409 624 476Z";
const ARROW = "M356 764 L573 545 L616 599 L764 479 L690 457 L922 397 L849 590 L823 528 L601 684 L571 645Z";
const clamp = (n) => Math.max(-1, Math.min(1, n));

// The original mosaic supplies all engraved detail. Its backing stays still;
// the foil moves only inside the heart, arrow and RL80 lettering.
export default React.memo(function RcanaMedallion({ holo = true, dx = 0, dy = 0 }) {
  const uid = `rc-medallion-${useId()}`;
  const id = (part) => `${uid}-${part}`;
  const url = (part) => `url(#${id(part)})`;
  const x = holo ? clamp(dx) : 0;
  const y = holo ? clamp(dy) : 0;
  const lift = Math.min(1, Math.hypot(x, y));
  const hueShift = x * 70 - y * 45;
  const foil = (hue) => `hsl(${hue + hueShift} 85% 58%)`;
  const arrowFoil = (hue) => `hsl(${hue + x * 95 - y * 60} 95% 50%)`;
  // One short flash as the card crosses an oblique angle, not a repeating
  // animation or a permanent white stripe over the lettering.
  const strike = Math.max(0, 1 - Math.abs(x - y * .35 - .28) / .20);

  return (
    <svg className="rc-medallion" viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={SIZE} height={SIZE} preserveAspectRatio="xMidYMid meet"
      role="img" aria-label={holo ? "RL80 medallion with holographic heart, arrow and lettering" : "RL80 heart-and-arrow medallion"}
      focusable="false" data-holo={holo ? "on" : "off"}>
      {holo && (
        <defs>
          <clipPath id={id("disc")}><circle {...DISC} /></clipPath>
          <clipPath id={id("logo-region")}>
            <path d={HEART} />
            <path d={ARROW} />
            <rect x="320" y="774" width="615" height="210" />
          </clipPath>
          <clipPath id={id("arrow-region")}><path d={ARROW} /></clipPath>
          <filter id={id("logo-ink")} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
            {/* Warm/green logo pixels become opaque; blue mosaic, dark
                outlines and transparent source pixels stay out of the mask. */}
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  3 2 -4 0 -.4" />
          </filter>
          <mask id={id("logo")} maskUnits="userSpaceOnUse" x="0" y="0" width={SIZE} height={SIZE} style={{ maskType: "alpha" }}>
            <g clipPath={url("logo-region")}>
              <image href={ART} width={SIZE} height={SIZE} filter={url("logo-ink")} />
            </g>
          </mask>
          <filter id={id("arrow-ink")} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
            {/* Select green arrow tiles, keeping the neighboring red heart
                and the pale engraved highlights out of this stronger tint. */}
            <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -1 3 -2 0 -.35" />
          </filter>
          <mask id={id("arrow")} maskUnits="userSpaceOnUse" x="0" y="0" width={SIZE} height={SIZE} style={{ maskType: "alpha" }}>
            <g clipPath={url("arrow-region")}>
              <image href={ART} width={SIZE} height={SIZE} filter={url("arrow-ink")} />
            </g>
          </mask>
          <mask id={id("inset")} maskUnits="userSpaceOnUse" x="0" y="0" width={SIZE} height={SIZE}>
            <rect width={SIZE} height={SIZE} fill="white" />
            <path d="M546 210 C576 274 594 385 627 442 C661 385 677 274 708 210Z" fill="black" />
          </mask>
          <filter id={id("metal")} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
            <feColorMatrix type="saturate" values=".38" />
            <feComponentTransfer>
              <feFuncR type="gamma" amplitude="1" exponent=".82" offset=".065" />
              <feFuncG type="gamma" amplitude="1" exponent=".82" offset=".055" />
              <feFuncB type="gamma" amplitude="1" exponent=".82" offset=".04" />
            </feComponentTransfer>
          </filter>
          <filter id={id("arrow-metal")} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              {/* Lower the arrow's very bright base so color blending has
                  room for saturated greens instead of near-white pastels. */}
              <feFuncR type="linear" slope=".66" intercept=".07" />
              <feFuncG type="linear" slope=".66" intercept=".07" />
              <feFuncB type="linear" slope=".66" intercept=".07" />
            </feComponentTransfer>
          </filter>
          <linearGradient id={id("mirror")} gradientUnits="userSpaceOnUse" x1="200" y1="250" x2="1050" y2="1080"
            gradientTransform={`rotate(${x * 28 - y * 15} 625 670)`}>
            <stop offset="0" stopColor="#f4eedc" />
            <stop offset=".26" stopColor="#7d7a70" />
            <stop offset=".43" stopColor="#fff2d9" />
            <stop offset=".55" stopColor="#857482" />
            <stop offset=".74" stopColor="#e0d7c6" />
            <stop offset="1" stopColor="#7c7570" />
          </linearGradient>
          {/* Saturated foil is visible even at rest. Gold and rose cross the
              center; tilt shifts both the hue and the reflected bands. */}
          <linearGradient id={id("spectrum")} gradientUnits="userSpaceOnUse" x1="210" y1="380" x2="1040" y2="940"
            gradientTransform={`translate(${x * 130 - y * 60} ${y * 70}) rotate(${x * 22 + y * 18} 625 670)`}>
            <stop offset="0" stopColor={foil(185)} />
            <stop offset=".19" stopColor={foil(150)} />
            <stop offset=".38" stopColor={foil(45)} />
            <stop offset=".55" stopColor={foil(340)} />
            <stop offset=".73" stopColor={foil(275)} />
            <stop offset=".87" stopColor={foil(190)} />
            <stop offset="1" stopColor={foil(48)} />
          </linearGradient>
          <linearGradient id={id("arrow-spectrum")} gradientUnits="userSpaceOnUse" x1="430" y1="720" x2="880" y2="420"
            gradientTransform={`translate(${x * 65} ${y * 45})`}>
            <stop offset="0" stopColor={arrowFoil(100)} />
            <stop offset=".36" stopColor={arrowFoil(140)} />
            <stop offset=".72" stopColor={arrowFoil(155)} />
            <stop offset="1" stopColor={arrowFoil(115)} />
          </linearGradient>
          <linearGradient id={id("flash")} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="900" y2="380"
            gradientTransform={`translate(${x * 600 - y * 190} 250)`}>
            <stop offset=".40" stopColor="#fffde5" stopOpacity="0" />
            <stop offset=".48" stopColor="#ffffff" stopOpacity=".85" />
            <stop offset=".50" stopColor="#ffffff" />
            <stop offset=".52" stopColor="#ffffff" stopOpacity=".85" />
            <stop offset=".60" stopColor="#fffde5" stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      <image href={ART} width={SIZE} height={SIZE} />
      {holo && (
        <g clipPath={url("disc")}>
          <g mask={url("inset")} style={{ isolation: "isolate" }}>
            {/* Warm, static metal gives the colored logo a quiet backdrop. */}
            <image href={ART} width={SIZE} height={SIZE} filter={url("metal")} />
            <rect width={SIZE} height={SIZE} fill="#d8bb83" opacity=".45" style={{ mixBlendMode: "color" }} />
            <g className="rc-medallion-logo" mask={url("logo")} style={{ isolation: "isolate" }}>
              <image href={ART} width={SIZE} height={SIZE} filter={url("metal")} />
              <rect width={SIZE} height={SIZE} fill={url("mirror")} opacity=".30" style={{ mixBlendMode: "soft-light" }} />
              {/* Screen lifts the dark mosaic before color applies the foil.
                  Color alone preserves its darkness and makes the rainbow dull. */}
              <rect width={SIZE} height={SIZE} fill={url("spectrum")}
                opacity={.22 + lift * .10} style={{ mixBlendMode: "screen" }} />
              <rect className="rc-medallion-spectrum" width={SIZE} height={SIZE} fill={url("spectrum")}
                opacity={.76 + lift * .12} style={{ mixBlendMode: "color" }} />
              <g fill="none" stroke={url("spectrum")} strokeWidth="3" opacity={.12 + lift * .25} style={{ mixBlendMode: "screen" }}>
                {RINGS.map((r) => <circle key={r} cx={DISC.cx} cy={DISC.cy} r={r} />)}
              </g>
              <g className="rc-medallion-arrow" mask={url("arrow")} style={{ isolation: "isolate" }}>
                <image href={ART} width={SIZE} height={SIZE} filter={url("arrow-metal")} />
                <rect width={SIZE} height={SIZE} fill={url("mirror")} opacity=".16" style={{ mixBlendMode: "soft-light" }} />
                <rect width={SIZE} height={SIZE} fill={url("arrow-spectrum")} opacity=".96" style={{ mixBlendMode: "color" }} />
              </g>
              <rect className="rc-medallion-flash" width={SIZE} height={SIZE} fill={url("flash")}
                opacity={strike * .48} style={{ mixBlendMode: "screen" }} />
            </g>
          </g>
        </g>
      )}
    </svg>
  );
});

export const MEDALLION_STYLES = `
.rc-medallion {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
`;
