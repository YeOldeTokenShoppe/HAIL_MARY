// toDealCard — render an instanced deal as a PROJECT/TOKEN card.
//
// Third of the three card types (author, 2026-07-26): character cards, question
// cards, project/token cards. This is the third.
//
// Builds the `data` shape TradingCard already consumes, so the prospect gets the
// real Genesis frame, foil and typography with no new renderer.
//
// TWO DELIBERATE CHOICES:
//
// 1. NO ART, and specifically not the exemplar coin's art. Every yield-mirage
//    prospect wearing the Ponzi Siren face would announce the archetype before
//    Barron has said a word, and the read is the game. The exemplar shows up at
//    the AUTOPSY instead, where naming the pattern is the teaching payload.
//
// 2. Marked PROSPECT, not a Genesis card, and edition reads "live deal" rather
//    than n/80. An instanced token is not a collectible — it never joins the
//    set, and the card face shouldn't imply it does. The collectible is the
//    exemplar coin you earn for reading it right.

import { getCardById } from "../cards.js";
import { toTemplateCard } from "../templateCard.js";

const TICKER = (t) => (String(t || "").startsWith("$") ? t : `$${t}`);

/**
 * QUESTION card. Unlike the prospect, these ARE real Genesis cards — all eight
 * in the pool map to a painted action card — so we run them through the normal
 * template and only override the rules box, because on this card the rules text
 * IS the question. That keeps the art, frame, foil and edition number intact
 * while the card says the thing the player is about to say out loud.
 */
export function toQuestionCard(q) {
  if (!q) return null;
  const base = getCardById(q.art);
  if (!base) return null;
  return {
    ...toTemplateCard(base),
    name: q.name,
    ability: { label: "ASK", text: `“${q.question}”` },
    flavorText: q.hint,
  };
}

/**
 * CHARACTER card — who is pitching you. The four traders are Mythic and all
 * painted, so this is a straight pass-through with the role spelled out.
 */
export function toCharacterCard(traderId, role = "PITCHING THIS DEAL") {
  const base = getCardById(traderId);
  if (!base) return null;
  return {
    ...toTemplateCard(base),
    ability: { label: role, text: base.quote || "" },
  };
}

export function toDealCard(deal) {
  if (!deal) return null;
  return {
    name: deal.name,
    subtitle: TICKER(deal.ticker),
    cardType: "Prospect",
    style: deal.chain || "Base",
    rarity: "Live deal",
    foilStyle: "subtle",
    edition: "live deal",

    // The ability box carries the only thing the player owes this card: a call.
    ability: {
      label: "POSITION REQUIRED",
      text: "Long, short, or hold? Work the questions. Then commit.",
    },

    // Public surface reads only. Nothing here correlates with ground truth —
    // that's asserted in the test suite, because the moment the listing page
    // leaks the answer, the analysts stop mattering.
    statPair: [
      { label: "MCAP", value: deal.surface?.mcap ?? "—" },
      { label: "HOLDERS", value: deal.surface?.holders ?? "—" },
    ],
    flavorText: `${deal.surface?.age ?? "—"} old · ${deal.surface?.change24h ?? "—"} 24h · social ${deal.surface?.social ?? "—"}`,

    backgroundImage: null,
    artFocus: "center 38%",
    artZoom: 1.2,
    overlayImage: null,
    abilityTone: null,
    frameImage: null,
    frameMetaTop: null,
    fxOverlays: [],
    setBadge: null,
    startingCred: null,
    startingPortfolio: null,
  };
}

/**
 * The pattern-library card — the Genesis coin this deal is an instance of.
 * Shown at the autopsy. This one DOES carry art, and it's the thing worth
 * owning: the archetype, not the token.
 */
export function toExemplarCard(deal) {
  const ex = deal?.exemplar;
  if (!ex) return null;
  return {
    name: ex.name,
    subtitle: TICKER(ex.ticker),
    cardType: "Pattern",
    style: deal.archetype,
    rarity: "Pattern",
    foilStyle: "v",
    edition: "pattern library",
    ability: { label: "THE READ", text: ex.note || "" },
    flavorText: null,
    statPair: null,
    backgroundImage: ex.art || null,
    artFocus: "center 38%",
    artZoom: 1.2,
    overlayImage: null,
    abilityTone: null,
    frameImage: null,
    frameMetaTop: null,
    fxOverlays: [],
    setBadge: null,
    startingCred: null,
    startingPortfolio: null,
  };
}
