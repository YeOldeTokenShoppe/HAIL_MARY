// R-cana — the set, assembled: every printed face merged over its design.
// This is what the bench, the binder and the table read. Nothing here is
// authored by hand — add a card by adding a design (if new), a face entry,
// and an art file; see README.md.
import { DESIGNS, designByKey } from "./designs.js";
import { FACES } from "./faces.js";

// Design type -> printed class. The face has four classes and the game has
// eight types, so this is where they meet. Hazards printing as Events and
// Remedies/Artifacts as Graces is a PLACEHOLDER until the class list grows
// or the rules settle — change it here and every card follows.
// (Literal strings rather than RCANA_CLASSES, so this module never imports
// cardFace.js and cardFace.js can import it without a cycle.)
export const TYPE_CLASS = {
  trader: "Trader",
  asset: "Asset",
  progress: "Asset",
  event: "Event",
  hazard: "Event",
  remedy: "Grace",
  artifact: "Grace",
  grace: "Grace",
};

export function buildFace(face) {
  const design = designByKey[face.design];
  if (!design) throw new Error(`faces.js: "${face.id}" names unknown design "${face.design}"`);
  return {
    id: face.id,
    designKey: design.key,
    number: face.number ?? null,
    cardClass: face.cardClass || TYPE_CLASS[design.type] || "Trader",
    type: design.type,
    cost: design.cost,
    name: face.name || design.name,
    rarity: face.rarity || "Common",
    halo: face.halo ?? null,
    hydro: face.hydro ?? design.liq ?? null,
    ability: face.ability ?? design.text ?? null,
    flavor: face.flavor ?? null,
    flavorQuoted: face.flavorQuoted,
    printed: face.printed || {},
  };
}

export const RCANA_SET = FACES.map(buildFace);
export const faceById = Object.fromEntries(RCANA_SET.map((c) => [c.id, c]));

// Designs that have no printed face yet — the to-do list for the set.
export const UNPRINTED = DESIGNS.filter((d) => !FACES.some((f) => f.design === d.key));
