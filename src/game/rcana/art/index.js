// The art registry: one file per card, keyed by the card's face id. Adding a
// card is one import line here plus its file — nothing in cardFace.js moves.
// (An explicit list rather than a glob, so the bundler can tree-shake and the
// lint can read it.)
import elDiablito from "./el-diablito.js";
import elToro from "./el-toro.js";
import elMonje from "./el-monje.js";
import elOso from "./el-oso.js";
import techStock from "./tech-stock.js";
import abuela from "./abuela.js";
import tortilla from "./tortilla.js";
import laCampana from "./la-campana.js";

export const RCANA_ART = {
  "el-diablito": elDiablito,
  "el-toro": elToro,
  "el-monje": elMonje,
  "el-oso": elOso,
  "tech-stock": techStock,
  abuela,
  tortilla,
  "la-campana": laCampana,
};
