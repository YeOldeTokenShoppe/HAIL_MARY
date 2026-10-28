// R-cana — the set, assembled: every printed face merged over its design.
// This is what the bench, the binder and the table read. Nothing here is
// authored by hand — add a card by adding a design (if new), a face entry,
// and an art file; see README.md.
import { DESIGNS, designByKey } from "./designs.js";
import { FACES } from "./faces.js";
import { ARTIFACT_SUBTYPES } from "../artifactTemplate.js";
import { getEventSubtype } from "../eventTemplate.js";

// Design type -> printed class. The face has four classes and the game has
// seven types, so this is where they meet. The printed class is what the
// card SAYS it is; the type and `played` flag determine how it PLAYS.
// Events print a Hazard, Opportunity or Market subtype without changing
// their engine type or timing.
// Artifacts print as Remedy, Grace or Relic while retaining their engine type.
// (Literal strings rather than RCANA_CLASSES, so this module never imports
// cardFace.js and cardFace.js can import it without a cycle.)
export const TYPE_CLASS = {
  trader: "Trader",
  asset: "Asset",
  event: "Event",
  hazard: "Event",
  remedy: "Artifact",
  artifact: "Artifact",
  grace: "Artifact",
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
    played: !!design.played,
    // Subtypes appear beside the class in the swept header.
    subClass: face.subClass ?? getEventSubtype(design) ?? ARTIFACT_SUBTYPES[design.type] ?? null,
    cost: design.cost,
    name: face.name || design.printName || design.name,
    rarity: face.rarity || "Common",
    // The two printed boxes, by type (POINT_TYPES): the drop is always
    // Liquidity; the halo is standing — Grace on a Trader, Prosperity on an
    // Asset or a called Event. Everything else prints blank boxes. A face
    // may override either.
    //   Trader  halo = cred (Grace)        hydro = liq (income)
    //   Asset   halo = pros (sale value)   hydro = cash (sale value)
    //   Event   halo = pros (if called)    hydro = —
    // Which plate (PLATES): boxed for Traders, valued for Assets and called
    // Events, sealed for the rest. The halo box is Grace on a Trader and VALUE (Prosperity) on an
    // Asset or a called Event; the drop box is "the Liquidity on this card" —
    // the cost to play on every type but Traders, where it is their income.
    plate: face.plate ?? (design.type === "trader" ? "boxed" : design.type === "asset" || (design.type === "event" && design.played) ? "valued" : "sealed"),
    halo: face.halo ?? (design.type === "trader" ? design.cred : design.pros) ?? null,
    // A fired Event is never played, so it has no cost to print: a dash, not a
    // zero (a zero means "free to play", as on La Ofrenda).
    hydro: face.hydro ?? (design.type === "trader" ? design.liq : design.type === "event" && !design.played ? "—" : design.cost) ?? null,
    // No tab coin any more: a Trader's hire cost equals their income, so the
    // drop box's one number is both. Kept as an override hook only.
    tabCost: face.tabCost ?? null,
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
