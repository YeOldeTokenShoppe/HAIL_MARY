// The art registry: one file per card, keyed by the card's face id. Adding a
// card is one import line here plus its file — nothing in cardFace.js moves.
// (An explicit list rather than a glob, so the bundler can tree-shake and the
// lint can read it.)
import elDiablito from "./el-diablito.js";

export const RCANA_ART = {
  "el-diablito": elDiablito,
};
