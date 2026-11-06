// Painted lettering with the same cream finish as the Trader wordmark.
// The viewBox trims only empty canvas
// at render time; the generated artwork and its native proportions stay intact.
import { IVORY_PAINT_MATRIX } from "./wordmarkPaint.js";

export const SUBTYPE_WORDMARKS = {
  Remedy: {
    src: "/TCG/labels/subtype-remedy-painted.webp", width: 2172, height: 724,
    viewBox: [56, 162, 2066, 410],
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
  Market: {
    src: "/TCG/labels/subtype-market-painted.webp", width: 2172, height: 724,
    viewBox: [65, 162, 2041, 408],
    colorMatrix: IVORY_PAINT_MATRIX,
  },
};
