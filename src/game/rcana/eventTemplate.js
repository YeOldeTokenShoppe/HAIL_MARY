export { SUBTYPE_HEADER as EVENT_HEADER, SUBTYPE_USAGE_SLOT as EVENT_USAGE_SLOT } from "./subtypeTemplate.js";

// Printed subtypes describe existing behavior; the engine's types and
// `played` flag continue to control timing and legal actions.
export function getEventSubtype(card) {
  if (card.type === "hazard") return "Hazard";
  if (card.type === "event") return card.played ? "Opportunity" : "Market";
  return ["Hazard", "Opportunity", "Market"].includes(card.subClass) ? card.subClass : null;
}

export function getEventTemplate(card) {
  if ((card.cardClass || card.class) !== "Event") return null;
  const subtype = getEventSubtype(card) || "Market";
  const usage = subtype === "Hazard" ? {
    usage: "until-cleared",
    label: "Until cleared",
    description: "Play on a rival. This card stays attached until cleared.",
    color: "#a4232b",
  } : subtype === "Market" ? {
    usage: "on-draw",
    label: "On draw",
    description: "When drawn, reveal and resolve this card, discard it, then draw a replacement.",
  } : { usage: null }; // Opportunities retain their Prosperity value box.
  return { subtype: card.subClass ?? subtype, symbol: subtype.toLowerCase(), ...usage };
}
