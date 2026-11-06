// Header wordmark lettering shared by the Trader/Asset type header and the
// Artifact/Event subtype bar. One source so the two bars can never drift:
// the fonts, the outline ring and the painted-image fallback are all here.
//
//   wordmarkFont:    "tourney" — Tourney Italic, variable wdth/wght (default)
//                    "bungee"  — Bungee Spice, COLRv1 colour font
//                    "painted" — the pre-2026-11-05 webp wordmark images
//   wordmarkOutline: "ink" | "cream" | "none"
//
// The outline is eight zero-blur shadows rather than -webkit-text-stroke,
// which does not paint on a colour font.

export const WORDMARK_FONTS = ["bungee", "tourney", "painted"];
// RcanaCard's classFont values that mean "the wordmark bar", mapped to the
// lettering they ask for. Plain "mosaic" keeps meaning the default.
export const WORDMARK_CLASS_FONTS = { mosaic: "tourney", tourney: "tourney", bungee: "bungee", painted: "painted" };
export const WORDMARK_OUTLINES = ["ink", "cream", "none"];

export const WORDMARK_FONT_FACES = `
@font-face {
  font-family: "Bungee Spice";
  src: url("/fonts/Bungee_Spice/BungeeSpice-Regular.ttf") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
/* Tourney's wdth 75–125 and wght 100–900 both live in the one italic file,
   so the lettering is tuned with font-variation-settings, not static cuts. */
@font-face {
  font-family: "Tourney";
  src: url("/fonts/Tourney/Tourney-Italic-VariableFont_wdth,wght.ttf") format("truetype");
  font-weight: 100 900;
  font-stretch: 75% 125%;
  font-style: italic;
  font-display: swap;
}
`;

// `cls` is the text span's class (".rc-type-wordmark" / ".rc-subtype-wordmark").
export function wordmarkTextStyles(cls) {
  return `
${cls} {
  display: block;
  min-width: 0;
  font-size: calc(var(--u) * .052);
  line-height: 1;
  letter-spacing: .03em;
  text-transform: uppercase;
  /* Ivory is the fill for Tourney and the fallback for Bungee Spice, whose
     orange gradient is baked into the font. */
  color: #fff0bc;
  white-space: nowrap;
  --wordmark-outline: calc(var(--u) * .0028);
  --wordmark-outline-ink: #1d190f;
  text-shadow:
    calc(var(--wordmark-outline) * -1) 0 0 var(--wordmark-outline-ink),
    var(--wordmark-outline) 0 0 var(--wordmark-outline-ink),
    0 calc(var(--wordmark-outline) * -1) 0 var(--wordmark-outline-ink),
    0 var(--wordmark-outline) 0 var(--wordmark-outline-ink),
    calc(var(--wordmark-outline) * -.7) calc(var(--wordmark-outline) * -.7) 0 var(--wordmark-outline-ink),
    calc(var(--wordmark-outline) * .7) calc(var(--wordmark-outline) * -.7) 0 var(--wordmark-outline-ink),
    calc(var(--wordmark-outline) * -.7) calc(var(--wordmark-outline) * .7) 0 var(--wordmark-outline-ink),
    calc(var(--wordmark-outline) * .7) calc(var(--wordmark-outline) * .7) 0 var(--wordmark-outline-ink);
}
${cls}[data-wordmark-font="bungee"] {
  font-family: "Bungee Spice", "Bebas Neue", Impact, sans-serif;
  font-style: normal;
  font-weight: 400;
}
${cls}[data-wordmark-font="tourney"] {
  font-family: "Tourney", "Bebas Neue", Impact, sans-serif;
  font-style: italic;
  font-variation-settings: "wdth" var(--wordmark-wdth, 100), "wght" var(--wordmark-wght, 800);
}
${cls}[data-outline="cream"] { --wordmark-outline-ink: #fff0bc; }
${cls}[data-outline="none"] { text-shadow: none; }
`;
}
