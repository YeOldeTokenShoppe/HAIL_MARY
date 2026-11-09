// Painted lettering with the same cream finish as the Trader wordmark.
// The viewBox trims only empty canvas
// at render time; the generated artwork and its native proportions stay intact.
import { IVORY_PAINT_MATRIX } from "./wordmarkPaint.js";

export const SUBTYPE_WORDMARKS = {
  Remedy: {
    label: "REM80",
    // Composited from the REMEDY and CALAM80 painted sheets (R-E-M + 8-0);
    // see painted-subtype-wordmarks.prompts.json. subtype-remedy-painted.webp
    // is the earlier full REMEDY lettering.
    src: "/TCG/labels/wordmark-rem80-painted.webp", width: 2172, height: 724,
    viewBox: [252, 162, 1668, 410],
    colorMatrix: IVORY_PAINT_MATRIX,
  },
  Grace: {
    src: "/TCG/labels/subtype-grace-painted.webp", width: 2172, height: 724,
    viewBox: [130, 141, 1910, 467],
    colorMatrix: IVORY_PAINT_MATRIX,
  },
  Relic: {
    src: "/TCG/labels/subtype-relic-painted.webp", width: 2172, height: 724,
    viewBox: [181, 144, 1821, 471],
    colorMatrix: IVORY_PAINT_MATRIX,
  },
  Opportunity: {
    label: "OPPORTUN80",
    src: "/TCG/labels/wordmark-opportun80-painted.webp", width: 2172, height: 724,
    viewBox: [47, 203, 2077, 315],
    colorMatrix: IVORY_PAINT_MATRIX,
  },
  Calamity: {
    label: "CALAM80",
    src: "/TCG/labels/wordmark-calam80-painted.webp", width: 2172, height: 724,
    viewBox: [47, 159, 2072, 406],
    colorMatrix: IVORY_PAINT_MATRIX,
  },
  // No painted sheet yet: the text lettering prints the label, and the
  // painted mode falls back to it. A prompt for the sheet is recorded in
  // set/painted-subtype-wordmarks.prompts.json.
  Ambiguity: {
    label: "AMBIGU80",
  },
};
