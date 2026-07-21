import { CARD_TYPES, GENESIS_SET, LENS_LABELS } from "./cards.js";
import { frameForRarity } from "./cardFrames.js";

// Single source of truth for finished card art. As the Genesis 80 art run
// lands, add one entry per card id; everything else renders the framed
// no-art variant of the template.
// Every `src` is the .webp (q86, effort 6, encoded from the .png at full
// source resolution); the .png masters stay in /TCG as the re-export source.
export const CARD_ART = {
  "eugene": { src: "/TCG/eugeneFractal.webp", artFocus: "center 28%", artZoom: 1.25, overlayImage: "/cardOverlay.webp" },
  "marisol": { src: "/TCG/traderMarisol.webp", artFocus: "center 28%", artZoom: 1.25 },
  // gr80 + john-barron art shipped long ago but lived only in /card-template's
  // demo constants, so the game rendered both traders art-less. Values carried
  // over from those constants (2026-07-20).
  "gr80": { src: "/TCG/trader_monk.webp", artFocus: "center 30%", artZoom: 1.2, overlayImage: "/cardOverlay_monk.webp" },
  "john-barron": { src: "/TCG/traderDemon.webp", artFocus: "center 32%", artZoom: 1.2, overlayImage: "/cardOverlay_demon.webp" },
  // moonpony + pump-signal assets are legacy pre-rendered full cards (frame
  // and text baked in), so the template crops hard into their art area.
  // Replace with raw artwork during the Genesis 80 art run.
  "moonpony": { src: "/TCG/coinCard_MoonPony.webp", artFocus: "center 30%", artZoom: 2.1 },
  "pump-signal": { src: "/TCG/actionCard_PumpSignal.webp", artFocus: "center 30%", artZoom: 2.1 },
  // artFocus values come from the art-run status table in design_guide.md
  // ("Art run status", §First Twelve) — that table is the source of truth,
  // not the 28% default. artZoom stays 1.0 unless the guide notes otherwise.
  "audit-flare": { src: "/TCG/actionAuditFlare.webp", artFocus: "center 28%", artZoom: 1.0 },
  // guide: 28% in repo; bump to 30-32 if the arrowheads clip.
  "forked-rumor": { src: "/TCG/actionForkedRumor.webp", artFocus: "center 28%", artZoom: 1.0 },
  "wallet-seance": { src: "/TCG/actionWalletSeance.webp", artFocus: "center 31%", artZoom: 1.0 },
  // guide: protect the ball's crown.
  "mempool-prophecy": { src: "/TCG/actionMempoolProphecy.webp", artFocus: "center 33%", artZoom: 1.0 },
  "cold-wallet": { src: "/TCG/actionColdWallet.webp", artFocus: "center 34%", artZoom: 1.0 },
  "chart-exorcism": { src: "/TCG/actionChartExorcism.webp", artFocus: "center 30%", artZoom: 1.0 },
  // guide: 36% so the V foil lines up with the beam-X.
  "oracle-crosscheck": { src: "/TCG/actionOracleCrosscheck.webp", artFocus: "center 36%", artZoom: 1.0 },
  // guide: 34% so the V foil lines up with the rug diagonal.
  "rug-warning": { src: "/TCG/actionRugWarning.webp", artFocus: "center 34%", artZoom: 1.0 },
  "candle-vigil": { src: "/TCG/actionCandleVigil.webp", artFocus: "center 34%", artZoom: 1.0 },
  // guide: if the starburst clips, try Art Y 70-80% + zoom ~1.08.
  "neon-stop-loss": { src: "/TCG/actionNeonStopLoss.webp", artFocus: "center 32%", artZoom: 1.0 },
  // guide: if the "!" clips under the name bar, go to 32%.
  "insider-ping": { src: "/TCG/actionInsiderPing.webp", artFocus: "center 30%", artZoom: 1.0 },
  // The set's only Terminal Foil — FOIL_BY_RARITY maps that rarity to the
  // `radiant` foil style, so this is the one card that ships with it.
  "terminal-foil-moment": { src: "/TCG/actionTerminalFoil.webp", artFocus: "center 31%", artZoom: 1.0 },
};

export function getCardArt(cardId) {
  return CARD_ART[cardId]?.src || null;
}

const RARITY_LABELS = {
  "common": "Common",
  "uncommon": "Uncommon",
  "rare": "Rare",
  "mythic": "Mythic",
  "terminal-foil": "Terminal Foil",
};

const FOIL_BY_RARITY = {
  "terminal-foil": "radiant",
  "mythic": "hero",
  "rare": "v",
};

const TYPE_LABELS = {
  [CARD_TYPES.TRADER]: "Trader",
  [CARD_TYPES.COIN]: "Coin",
  [CARD_TYPES.ACTION]: "Action",
  [CARD_TYPES.MARKET]: "Market",
};

const STYLE_LABELS = {
  defi: "DeFi",
};

export function toTemplateCard(card) {
  const art = CARD_ART[card.id] || {};
  const index = GENESIS_SET.findIndex((entry) => entry.id === card.id);

  return {
    name: card.name,
    subtitle: subtitleFor(card),
    cardType: TYPE_LABELS[card.type] || "Card",
    style: styleLabel(card.tag || card.style),
    rarity: RARITY_LABELS[card.rarity] || card.rarity,
    foilStyle: FOIL_BY_RARITY[card.rarity] || "subtle",
    edition: index === -1 ? "promo" : `${index + 1}/${GENESIS_SET.length}`,
    ability: abilityFor(card),
    // Coins print their solved dossier (§4.6) as flavor when no quote exists.
    flavorText: card.quote || card.caseRef?.note || null,
    statPair: statPairFor(card),
    startingCred: card.type === CARD_TYPES.TRADER ? card.startingCred : null,
    startingPortfolio: card.type === CARD_TYPES.TRADER ? card.startingPortfolio : null,
    backgroundImage: art.src || null,
    artFocus: art.artFocus || "center 38%",
    artZoom: art.artZoom || 1.2,
    overlayImage: art.overlayImage || null,
    // Rarity frame rides on the card like foilStyle does, so the game, the
    // collection grid and the template all get it without extra wiring.
    frameImage: frameForRarity(card.rarity),
  };
}

function subtitleFor(card) {
  if (card.type === CARD_TYPES.TRADER) return card.handle;
  if (card.type === CARD_TYPES.COIN) return `$${card.ticker}`;
  if (card.type === CARD_TYPES.MARKET) return "Genesis Market";
  return styleLabel(card.tag);
}

// Kit role → the ability-box label printed on the card (§3.2a: card text is
// written kit-first; the legacy effectText renders only when no kit exists).
const KIT_ROLE_LABELS = {
  lensKey: "Lens Key",
  deepScan: "Deep Scan",
  crossref: "Cross-Reference",
  trace: "Exit Trace",
  peek: "Wiretap",
  shield: "Shield",
  stoploss: "Stop Loss",
  wildcard: "Wildcard",
};

function kitAbilityName(kit) {
  const base = KIT_ROLE_LABELS[kit.role] || "Kit";
  if (kit.lenses) return `${base} · ${kit.lenses.map((l) => LENS_LABELS[l]).join(" + ")}`;
  if (kit.lens) return `${base} · ${LENS_LABELS[kit.lens]}`;
  return base;
}

function abilityFor(card) {
  if (card.type === CARD_TYPES.TRADER) {
    return { name: card.abilityName, text: card.abilityText, badgeImage: "/abilityBadge.png" };
  }
  if (card.type === CARD_TYPES.COIN) {
    return { name: "Market Entry", text: card.effectText, badgeImage: "/abilityBadge.png" };
  }
  if (card.type === CARD_TYPES.MARKET) {
    // Docket-event identity (§4.6): the printed card describes the table flip.
    if (card.docket) {
      return { name: "Docket Event", text: `${card.docket.text} ${card.docket.banner}.`, badgeImage: "/abilityBadge.png" };
    }
    return { name: "Market Event", text: card.effectText, badgeImage: "/abilityBadge.png" };
  }
  if (card.kit) {
    return { name: kitAbilityName(card.kit), text: card.kit.text, badgeImage: "/abilityBadge.png" };
  }
  return { name: styleLabel(card.tag), text: card.effectText, badgeImage: "/abilityBadge.png" };
}

function statPairFor(card) {
  if (card.type === CARD_TYPES.COIN) {
    return [
      { label: "COST", value: card.cost, title: "Cred cost to buy" },
      { label: "VAL", value: `+${card.baseValue}`, title: "Portfolio value on entry" },
    ];
  }
  if (card.type === CARD_TYPES.ACTION) {
    return [
      { label: "COST", value: card.cost, title: "Cred cost to play" },
      { label: "GAIN", ...primaryGain(card), title: "Main effect when played" },
    ];
  }
  return null;
}

function primaryGain(card) {
  const effect = card.effect || {};
  if (effect.portfolio) return { value: `+${effect.portfolio}` };
  if (effect.cred) return { value: `+${effect.cred}`, suffix: " CR" };
  if (effect.shield) return { value: `+${effect.shield}`, suffix: " SH" };
  if (effect.draw) return { value: `+${effect.draw}`, suffix: " DRAW" };
  return { value: "—" };
}

function styleLabel(tag) {
  if (!tag) return "Genesis";
  if (STYLE_LABELS[tag]) return STYLE_LABELS[tag];
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}
