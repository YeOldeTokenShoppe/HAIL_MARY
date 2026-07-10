import { CARD_TYPES, GENESIS_SET } from "./cards.js";

// Single source of truth for finished card art. As the Genesis 80 art run
// lands, add one entry per card id; everything else renders the framed
// no-art variant of the template.
export const CARD_ART = {
  "eugene": { src: "/TCG/eugeneFractal.png", artFocus: "center 28%", artZoom: 1.25, overlayImage: "/cardOverlay.webp" },
  "marisol": { src: "/TCG/traderMarisol.webp", artFocus: "center 28%", artZoom: 1.25 },
  // moonpony + pump-signal assets are legacy pre-rendered full cards (frame
  // and text baked in), so the template crops hard into their art area.
  // Replace with raw artwork during the Genesis 80 art run.
  "moonpony": { src: "/TCG/coinCard_MoonPony.png", artFocus: "center 30%", artZoom: 2.1 },
  "pump-signal": { src: "/TCG/actionCard_PumpSignal.png", artFocus: "center 30%", artZoom: 2.1 },
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
    flavorText: card.quote || null,
    statPair: statPairFor(card),
    startingCred: card.type === CARD_TYPES.TRADER ? card.startingCred : null,
    startingPortfolio: card.type === CARD_TYPES.TRADER ? card.startingPortfolio : null,
    backgroundImage: art.src || null,
    artFocus: art.artFocus || "center 38%",
    artZoom: art.artZoom || 1.2,
    overlayImage: art.overlayImage || null,
  };
}

function subtitleFor(card) {
  if (card.type === CARD_TYPES.TRADER) return card.handle;
  if (card.type === CARD_TYPES.COIN) return `$${card.ticker}`;
  if (card.type === CARD_TYPES.MARKET) return "Genesis Market";
  return styleLabel(card.tag);
}

function abilityFor(card) {
  if (card.type === CARD_TYPES.TRADER) {
    return { name: card.abilityName, text: card.abilityText, badgeImage: "/abilityBadge.png" };
  }
  if (card.type === CARD_TYPES.COIN) {
    return { name: "Market Entry", text: card.effectText, badgeImage: "/abilityBadge.png" };
  }
  if (card.type === CARD_TYPES.MARKET) {
    return { name: "Market Event", text: card.effectText, badgeImage: "/abilityBadge.png" };
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
