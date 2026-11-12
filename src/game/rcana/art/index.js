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
import rosario from "./rosario.js";
import laCalavera from "./la-calavera.js";
import elUnicornio from "./el-unicornio.js";
import elGato from "./el-gato.js";
import memeCoin from "./meme-coin.js";
import laRosa from "./la-rosa.js";
import theWhale from "./the-whale.js";
import laFuente from "./la-fuente.js";
import laInvestigadora from "./la-investigadora.js";
import elGambusino from "./el-gambusino.js";
import theIllumin80 from "./the-illumin80.js";
import theCelebrity from "./the-celebrity.js";
import collectibles from "./collectibles.js";
import theMine from "./the-mine.js";
import realEstate from "./real-estate.js";
import treasureMap from "./treasure-map.js";
import oilField from "./oil-field.js";
import rideOrDie from "./ride-or-die.js";
import taxCollector from "./tax-collector.js";
import seedRound from "./seed-round.js";
import flashCrash from "./flash-crash.js";
import rugPull from "./rug-pull.js";
import quantumHack from "./quantum-hack.js";
import mardiGras from "./mardi-gras.js";
import laHorchata from "./la-horchata.js";
import stablecoin from "./stablecoin.js";
import yieldFarm from "./yield-farm.js";
import blueChip from "./blue-chip.js";
import scandal from "./scandal.js";
import exitScam from "./exit-scam.js";
import techWreck from "./tech-wreck.js";
import fullMoon from "./full-moon.js";

export const RCANA_ART = {
  "el-diablito": elDiablito,
  "el-toro": elToro,
  "el-monje": elMonje,
  "el-oso": elOso,
  "tech-stock": techStock,
  abuela,
  tortilla,
  "la-campana": laCampana,
  rosario,
  "la-calavera": laCalavera,
  "el-unicornio": elUnicornio,
  "el-gato": elGato,
  "meme-coin": memeCoin,
  "la-rosa": laRosa,
  "the-whale": theWhale,
  "la-fuente": laFuente,
  "la-investigadora": laInvestigadora,
  "el-gambusino": elGambusino,
  "the-illumin80": theIllumin80,
  "the-celebrity": theCelebrity,
  collectibles,
  "the-mine": theMine,
  "real-estate": realEstate,
  "treasure-map": treasureMap,
  "oil-field": oilField,
  "ride-or-die": rideOrDie,
  "tax-collector": taxCollector,
  "seed-round": seedRound,
  "flash-crash": flashCrash,
  "rug-pull": rugPull,
  "quantum-hack": quantumHack,
  "mardi-gras": mardiGras,
  "la-horchata": laHorchata,
  "stablecoin": stablecoin,
  "yield-farm": yieldFarm,
  "blue-chip": blueChip,
  "scandal": scandal,
  "exit-scam": exitScam,
  "tech-wreck": techWreck,
  "full-moon": fullMoon,
};
