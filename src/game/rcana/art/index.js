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
import brentCrude from "./brent-crude.js";
import goldBar from "./gold-bar.js";
import racehorse from "./racehorse.js";
import fineArt from "./fine-art.js";
import junkBond from "./junk-bond.js";
import indexFund from "./index-fund.js";
import porkbellies from "./porkbellies.js";
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
import holyRoller from "./holy-roller.js";
import virtualMary from "./virtual-mary.js";
import fireHorse from "./fire-horse.js";
import animaSola from "./anima-sola.js";
import enigmaMachine from "./enigma-machine.js";
import byzantineGeneral from "./byzantine-general.js";
import octobot from "./octobot.js";
import elGallo from "./el-gallo.js";
import laVaca from "./la-vaca.js";
import elAguacate from "./el-aguacate.js";
import laCava from "./la-cava.js";
import laPlata from "./la-plata.js";
import savingsBond from "./savings-bond.js";
import thePerp from "./the-perp.js";
import elTatuaje from "./el-tatuaje.js";
import shortSqueeze from "./short-squeeze.js";
import godCandle from "./god-candle.js";
import lotteryTicket from "./lottery-ticket.js";
import theKeys from "./the-keys.js";
import sacredGeometry from "./sacred-geometry.js";
import theAudit from "./the-audit.js";
import predictionMarket from "./prediction-market.js";
import confession from "./confession.js";
import theMission from "./the-mission.js";
import nativityScene from "./nativity-scene.js";
import theStimulus from "./the-stimulus.js";
import diamondHands from "./diamond-hands.js";
import paperHands from "./paper-hands.js";
import theInferno from "./the-inferno.js";
import backToThe80s from "./back-to-the-80s.js";
import thePonzi from "./the-ponzi.js";
import theInheritance from "./the-inheritance.js";
import fallFromGrace from "./fall-from-grace.js";
import liquidityTrap from "./liquidity-trap.js";
import blackSwan from "./black-swan.js";
import feast from "./feast.js";
import wheelOfFortune from "./wheel-of-fortune.js";
import theOffering from "./the-offering.js";
import theVotive from "./the-votive.js";
import theVisitor from "./the-visitor.js";
import specialOffer from "./special-offer.js";
import pawnShop from "./pawn-shop.js";
import dashboardFigurine from "./dashboard-figurine.js";
import sacredHeart from "./sacred-heart.js";
import chartCathedral from "./chart-cathedral.js";
import theSingular80 from "./the-singular80.js";
import theCatacombs from "./the-catacombs.js";
import rewind from "./rewind.js";
import motherboard from "./motherboard.js";
import theSellOff from "./the-sell-off.js";
import pocketSaint from "./pocket-saint.js";
import moralHazard from "./moral-hazard.js";
import airdrop from "./airdrop.js";
import theShort from "./the-short.js";
import garthRaider from "./garth-raider.js";

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
  "el-gambusino": elGambusino, // the mine, kept on file: the face moved to brent-crude on 2026-11-26
  "brent-crude": brentCrude,
  "gold-bar": goldBar,
  "racehorse": racehorse,
  "fine-art": fineArt,
  "junk-bond": junkBond,
  "index-fund": indexFund,
  "porkbellies": porkbellies,
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
  "holy-roller": holyRoller,
  "virtual-mary": virtualMary,
  "fire-horse": fireHorse,
  "anima-sola": animaSola,
  "enigma-machine": enigmaMachine,
  "byzantine-general": byzantineGeneral,
  "octobot": octobot,
  "el-gallo": elGallo,
  "la-vaca": laVaca,
  "el-aguacate": elAguacate,
  "la-cava": laCava,
  "la-plata": laPlata,
  "savings-bond": savingsBond,
  "the-perp": thePerp,
  "el-tatuaje": elTatuaje,
  "short-squeeze": shortSqueeze,
  "god-candle": godCandle,
  "lottery-ticket": lotteryTicket,
  "the-keys": theKeys,
  "sacred-geometry": sacredGeometry,
  "the-audit": theAudit,
  "prediction-market": predictionMarket,
  confession,
  "the-mission": theMission,
  "nativity-scene": nativityScene,
  "the-stimulus": theStimulus,
  "diamond-hands": diamondHands,
  "paper-hands": paperHands,
  "the-inferno": theInferno,
  "back-to-the-80s": backToThe80s,
  "the-ponzi": thePonzi,
  "the-inheritance": theInheritance,
  "fall-from-grace": fallFromGrace,
  "liquidity-trap": liquidityTrap,
  "black-swan": blackSwan,
  "feast": feast,
  "wheel-of-fortune": wheelOfFortune,
  "the-offering": theOffering,
  "the-votive": theVotive,
  "the-visitor": theVisitor,
  "special-offer": specialOffer,
  "pawn-shop": pawnShop,
  "dashboard-figurine": dashboardFigurine,
  "sacred-heart": sacredHeart,
  "chart-cathedral": chartCathedral,
  "the-singular80": theSingular80,
  "the-catacombs": theCatacombs,
  "rewind": rewind,
  "motherboard": motherboard,
  "the-sell-off": theSellOff,
  "pocket-saint": pocketSaint,
  "moral-hazard": moralHazard,
  "airdrop": airdrop,
  "the-short": theShort,
  "garth-raider": garthRaider,
};
