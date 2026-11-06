// Illustrated lettering for the compact Trader and Asset headers.
// Both use the same warm ivory paint as the Artifact and Event subtypes.
// View boxes omit transparent padding without altering the source artwork.
import { IVORY_PAINT_MATRIX } from "./wordmarkPaint.js";

export const TYPE_WORDMARKS = {
  Trader: {
    src: "/TCG/labels/type-trader-painted.webp", width: 2172, height: 724,
    viewBox: [64, 162, 2045, 406],
    colorMatrix: IVORY_PAINT_MATRIX,
  },
  Asset: {
    src: "/TCG/labels/type-asset-painted.webp", width: 2172, height: 724,
    viewBox: [174, 139, 1878, 462],
    colorMatrix: IVORY_PAINT_MATRIX,
  },
};
