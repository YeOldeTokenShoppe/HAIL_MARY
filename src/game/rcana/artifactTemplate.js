// Artifact-only printed furniture. The game still uses its existing types;
// the header describes the subtype and the footer describes how it is used.
export { SUBTYPE_HEADER as ARTIFACT_HEADER, SUBTYPE_USAGE_SLOT as ARTIFACT_USAGE_SLOT } from "./subtypeTemplate.js";
export const ARTIFACT_SUBTYPES = { remedy: "Remedy", grace: "Grace", artifact: "Relic" };

const USAGES = {
  "single-use": { label: "Single use", description: "Resolve the effect, then discard this card." },
  equip: { label: "Equip", description: "Place this card in your Artifact area." },
  shrine: { label: "To shrine", description: "Offer this card to the shrine." },
  offer: { label: "Offer", description: "Offer this card to another player." },
  spend: { label: "Spend", description: "Resolve the effect; this card leaves your hand." },
};

export function getArtifactTemplate(card) {
  if ((card.cardClass || card.class) !== "Artifact") return null;
  const subtypeType = card.subClass?.toLowerCase();
  const type = card.type || (subtypeType === "relic" ? "artifact" : subtypeType) || "artifact";
  const design = card.designKey || card.design || card.key;
  let usage = type === "remedy" ? "single-use" : type === "grace" ? "shrine" : type === "artifact" ? "equip" : null;
  // Grace includes two exceptions: the Rose is transferred or returned to
  // hand; the Fountain improves the odds without entering the shrine.
  if (type === "grace" && design === "rose") usage = "offer";
  if (type === "grace" && design === "fountain") usage = "spend";
  return {
    subtype: card.subClass ?? ARTIFACT_SUBTYPES[type] ?? null,
    symbol: type === "remedy" ? "remedy" : type === "grace" ? "grace" : "artifact",
    usage,
    ...USAGES[usage],
  };
}
