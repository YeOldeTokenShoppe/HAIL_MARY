export { SUBTYPE_HEADER as EVENT_HEADER, SUBTYPE_USAGE_SLOT as EVENT_USAGE_SLOT } from "./subtypeTemplate.js";

// Every Event prints one of three subtypes, sorted by what it does to you:
//   Calamity     a loss — a hazard played on a rival (attached until cleared),
//                or an on-draw event that takes from the table
//   Opportunity  a windfall — a called event (Bull Run, Full Moon), or an
//                on-draw event that gives
//   Ambiguity    a shake-up whose winner is unknown until it resolves — on
//                draw only (The Whale, The Wheel, Moral Hazard)
// The engine's type and `played` flag still control timing and legal actions;
// the subtype is printed furniture. In rules text, "Calamity" keeps its
// narrow meaning — the attached kind that Remedies clear — which the usage
// badge makes visible: attached ones say "Until cleared", one-shots "On draw".
export const EVENT_SUBTYPES = ["Calamity", "Opportunity", "Ambiguity"];

export function getEventSubtype(card) {
  if (card.type === "hazard") return "Calamity";
  if (card.type === "event") {
    if (card.played) return "Opportunity";
    // An on-draw event names its own sort on the design (`subtype`); unnamed,
    // it is a windfall.
    return EVENT_SUBTYPES.includes(card.subtype) ? card.subtype : "Opportunity";
  }
  const subtype = card.subClass === "Hazard" ? "Calamity" : card.subClass;
  return EVENT_SUBTYPES.includes(subtype) ? subtype : null;
}

export function getEventTemplate(card) {
  if ((card.cardClass || card.class) !== "Event") return null;
  // Timing comes from the engine, never from the printed subtype.
  const usage = card.type === "hazard" ? {
    usage: "until-cleared",
    label: "Until cleared",
    description: "Play on a rival. This card stays attached until cleared.",
  } : card.played ? {
    usage: "on-play",
    label: "On play",
    description: "Pay this card's cost and resolve its effect when played.",
  } : {
    usage: "on-draw",
    label: "On draw",
    description: "When drawn, reveal and resolve this card, discard it, then draw a replacement.",
  };
  const override = card.subClass === "Hazard" ? "Calamity" : card.subClass;
  const subtype = (EVENT_SUBTYPES.includes(override) ? override : null) || getEventSubtype(card) || "Opportunity";
  // Calamities carry the red badge whether attached or one-shot.
  const color = subtype === "Calamity" ? "#a4232b" : undefined;
  return { subtype, symbol: subtype.toLowerCase(), ...usage, ...(color ? { color } : {}) };
}
