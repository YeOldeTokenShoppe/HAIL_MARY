import { CARD_TYPES, GENESIS_SET, LENS_LABELS } from "./cards.js";
import {
  frameForRarity, metaTopForFrame, fxSources, FX_BLEND_DEFAULT, FX_OPACITY_DEFAULT,
} from "./cardFrames.js";

// Single source of truth for finished card art. As the Genesis 80 art run
// lands, add one entry per card id; everything else renders the framed
// no-art variant of the template.
// Every `src` is the .webp (q86, effort 6, encoded from the .png at full
// source resolution); the .png masters stay in /TCG as the re-export source.
export const CARD_ART = {
  // Traders carried a legacy `overlayImage` (an all-in-one 500x700 frame +
  // TRADER badge + holo FX). Retired 2026-07-21: the rarity frames and the FX
  // compositor cover both jobs at 1488px, and stacking them double-framed the
  // card. TradingCard still supports overlayImage — ReliquaryRail uses it.
  "eugene": { src: "/TCG/eugeneFractal.webp", artFocus: "center 28%", artZoom: 1.25, fx: ["Rainbow 1"] },
  "marisol": { src: "/TCG/traderMarisol.webp", artFocus: "center 28%", artZoom: 1.25, fx: ["Abstract 7"] },
  // gr80 + john-barron art shipped long ago but lived only in /card-template's
  // demo constants, so the game rendered both traders art-less. Values carried
  // over from those constants (2026-07-20).
  "gr80": { src: "/TCG/trader_monk.webp", artFocus: "center 30%", artZoom: 1.2, fx: ["Abstract 11"] },
  "john-barron": { src: "/TCG/traderDemon.webp", artFocus: "center 32%", artZoom: 1.2, fx: ["Flame"] },
  // moonpony + pump-signal reimported 2026-07-21 as full 1488×2077 illustrations
  // with the old baked-in frame/text removed, so they crop like every other
  // Genesis card now — artZoom 1.0, no hard zoom into a print card.
  "moonpony": { src: "/TCG/coinCard_MoonPony.webp", artFocus: "center 30%", artZoom: 1.0, fx: ["Rainbow 1", "Rainbow 3", "Rainbow 4"] },
  // The Siren's debut (Batch 2 take 1, 2026-07-21). Take 1 ships with the
  // hourglass tell at ~83% frame height (under the ability box) — inpaint
  // pending; the crop also hides the floor coin pool, so the tail's coins
  // read as flowing UP, as designed.
  "ponzi-siren": { src: "/TCG/coinCard_PonziSiren.webp", artFocus: "center 33%", artZoom: 1.0, fx: ["Rainbow 1"] },
  // Shillbird's debut (Batch 2 take 1, 2026-07-21): coin mid-drop into the
  // back slot + squawk mid-burst = pay-in and pay-out in one frame. Invoice
  // tell sits ~40-52% height — safely inside the art window.
  "bullish-ink": { src: "/TCG/coinCard_BullishInk.webp", artFocus: "center 30%", artZoom: 1.0, fx: ["Abstract 2"] },
  // Gasper's debut (Batch 2 take 1, 2026-07-21). The art is exactly the card's
  // 1488x2076 aspect, so at artZoom 1.0 the crop is 1:1 and artFocus is inert —
  // it stays at 30% for consistency with the batch, and as the value to nudge
  // if this card ever gets zoomed. Tell (untied knot + escaping notes) lands
  // ~50-62% height, well clear of the ability box that ate the Siren's hourglass.
  "goblingas": { src: "/TCG/coinCard_GoblinGas.webp", artFocus: "center 30%", artZoom: 1.0, fx: ["Abstract 11"] },
  // Forklok's debut (Batch 2 take 1, 2026-07-21): golem front-and-center, the
  // mirror behind him showing the back door ajar. The reveal (door + key on a
  // chain + coin trickle) sits ~40-62% height, inside the art window; the
  // fingerprint-whorl easter egg is on the mirror frame at ~55%.
  "blackpalm": { src: "/TCG/coinCard_BlackPalm.webp", artFocus: "center 30%", artZoom: 1.0, fx: ["Abstract 7"], fxBlend: "overlay"  },
  // Vaporina's debut (Batch 2 take 1, 2026-07-21). The set's first full-body
  // standing figure: head ~20%, clothespin ~46%, loop-button tell ~28-40% —
  // all inside the art window; only her heels go under the ability box, which
  // is the price of the pose and reads fine. Rainbow FX because she IS
  // refraction — the overlay is doing character work here, not decoration.
  "vaporwarex": { src: "/TCG/coinCard_VaporwareX.webp", artFocus: "center 30%", artZoom: 1.0, fx: ["Rainbow 3"] },
  // Fomogre's debut (Batch 2 take 1, 2026-07-21). Tells: red crumble-trail
  // ~30-72% on the left, tipped quarter cup ~65-72% — the cup clears the
  // flavor band and lands beside the EFFECT badge, still legible.
  "lucky-capsule": { src: "/TCG/coinCard_LuckyCapsule.webp", artFocus: "center 30%", artZoom: 1.0, fx: ["Abstract 7"], fxBlend: "screen"  },
  // Batch 2's first rogue-less coin (2026-07-21). Composition inverts the
  // VaporwareX problem: subject lives in the upper two-thirds (storm window
  // ~7-36%, ingot ~36-58%, monk-bot ~45-58% right) and the bottom third is
  // altar steps and floor, so both text bands land on furniture.
  "terminal-eth": { src: "/TCG/coinCard_TerminalETH.webp", artFocus: "center 30%", artZoom: 1.0, fx: ["Abstract 1"], fxBlend: "screen" },
  // The wick archive (Batch 2 take 1, 2026-07-22). Exact card aspect →
  // artFocus inert at zoom 1.0: top shelf row clips under the name bar,
  // desk/ledger sit under the text bands — both by design. The archivist-bot
  // + loupe land ~13-25%, inside the window.
  "candle-index": { src: "/TCG/coinCard_CandleIndex.webp", artFocus: "center 30%", artZoom: 1.0, fx: ["Sparkle"] },
  "pump-signal": { src: "/TCG/actionCard_PumpSignal.webp", artFocus: "center 30%", artZoom: 1.0, fx: ["Sparkle"] },
  // artFocus values come from the art-run status table in design_guide.md
  // ("Art run status", §First Twelve) — that table is the source of truth,
  // not the 28% default. artZoom stays 1.0 unless the guide notes otherwise.
  // abilityTone orange: this art is mint/cyan, so the default cyan EFFECT
  // badge and heading read as low contrast against it.
  "audit-flare": { src: "/TCG/actionAuditFlare.webp", artFocus: "center 28%", artZoom: 1.0, abilityTone: "orange", fx: ["Thunder 3"] },
  // guide: 28% in repo; bump to 30-32 if the arrowheads clip.
  "forked-rumor": { src: "/TCG/actionForkedRumor.webp", artFocus: "center 28%", artZoom: 1.0, fx: ["Flame"] },
  "wallet-seance": { src: "/TCG/actionWalletSeance.webp", artFocus: "center 31%", artZoom: 1.0, fx: ["Abstract 16"] },
  // guide: protect the ball's crown.
  "mempool-prophecy": { src: "/TCG/actionMempoolProphecy.webp", artFocus: "center 33%", artZoom: 1.0, fx: ["Abstract 5"], fxBlend: "screen" },
  // abilityTone orange: the ice-vault art is cyan end to end.
  "cold-wallet": { src: "/TCG/actionColdWallet.webp", artFocus: "center 34%", artZoom: 1.0, abilityTone: "orange", fx: ["Ice"], fxBlend: "screen" },
  "chart-exorcism": { src: "/TCG/actionChartExorcism.webp", artFocus: "center 30%", artZoom: 1.0, fx: ["Dark"] },
  // guide: 36% so the V foil lines up with the beam-X.
  "oracle-crosscheck": { src: "/TCG/actionOracleCrosscheck.webp", artFocus: "center 36%", artZoom: 1.0, fx: ["Thunder 4"], fxBlend: "screen" },
  // guide: 34% so the V foil lines up with the rug diagonal.
  "rug-warning": { src: "/TCG/actionRugWarning.webp", artFocus: "center 34%", artZoom: 1.0, fx: ["Abstract 5"], fxBlend: "screen" },
  "candle-vigil": { src: "/TCG/actionCandleVigil.webp", artFocus: "center 34%", artZoom: 1.0, fx: ["Abstract 1"], fxBlend: "plus" },
  // guide: if the starburst clips, try Art Y 70-80% + zoom ~1.08.
  "neon-stop-loss": { src: "/TCG/actionNeonStopLoss.webp", artFocus: "center 32%", artZoom: 1.0, fx: ["Abstract 7"], fxBlend: "plus-lighter" },
  // guide: if the "!" clips under the name bar, go to 32%.
  "insider-ping": { src: "/TCG/actionInsiderPing.webp", artFocus: "center 30%", artZoom: 1.0, fx: ["Thunder 4"] },
  // The set's only Terminal Foil — FOIL_BY_RARITY maps that rarity to the
  // `radiant` foil style, so this is the one card that ships with it.
  "terminal-foil-moment": { src: "/TCG/actionTerminalFoil.webp", artFocus: "center 31%", artZoom: 1.0, fx: ["Rainbow 1"] },
};

// Set mark printed on every Genesis card, the way a TCG prints its set logo
// over the art. Set `setBadge: null` on a card to suppress it.
export const SET_BADGE = "/TCG/badges/genesis-edition-badge.webp";

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
    // Per-card EFFECT tone — set on cards whose art is cyan enough that the
    // default cyan badge/heading reads as low contrast.
    abilityTone: art.abilityTone || null,
    // Rarity frame rides on the card like foilStyle does, so the game, the
    // collection grid and the template all get it without extra wiring.
    frameImage: frameForRarity(card.rarity),
    frameMetaTop: metaTopForFrame(frameForRarity(card.rarity)),
    // Per-card FX overlays, wired by label in CARD_ART (`fx: ["Thunder 2"]`).
    // Max 3, composited over art AND frame. Blend/opacity are per-card because
    // the same overlay needs a lighter hand on pale art than on dark art.
    fxOverlays: fxSources(art.fx),
    fxBlend: art.fxBlend || FX_BLEND_DEFAULT,
    fxOpacity: art.fxOpacity ?? FX_OPACITY_DEFAULT,
    setBadge: art.setBadge === null ? null : SET_BADGE,
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
    return { name: card.abilityName, text: card.abilityText };
  }
  if (card.type === CARD_TYPES.COIN) {
    return { name: "Market Entry", text: card.effectText };
  }
  if (card.type === CARD_TYPES.MARKET) {
    // Docket-event identity (§4.6): the printed card describes the table flip.
    if (card.docket) {
      return { name: "Docket Event", text: `${card.docket.text} ${card.docket.banner}.` };
    }
    return { name: "Market Event", text: card.effectText };
  }
  if (card.kit) {
    return { name: kitAbilityName(card.kit), text: card.kit.text };
  }
  return { name: styleLabel(card.tag), text: card.effectText };
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
