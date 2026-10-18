// Lotería — the set's pre-rendered print cards. Unlike the Genesis 80, where
// the template composes art + frame + text + FX at render time, a Lotería
// card arrives finished: the PNG IS the card face, and every card shares one
// printed back. The template therefore renders these in its `print` layout —
// one full-bleed image, no frame, no text layers — and ships them with every
// overlay effect off (`effects: "off"`), since holo, shine, glare and FX
// sheets would only fog a flat print.
//
// Masters are 1064×1478 (0.720) against the card's 744×1038 (0.717), so
// object-fit: cover trims ~0.4% off the sides and nothing off the top.
const LOTERIA_DIR = "/TCG/loteria";

export const LOTERIA_BACK = `${LOTERIA_DIR}/cardBack.png`;

export const LOTERIA_CARDS = [
  { id: "loteria-marisol", name: "Marisol", src: `${LOTERIA_DIR}/Marisol.png` },
  { id: "loteria-el-diablito", name: "El Diablito", src: `${LOTERIA_DIR}/El_Diablito.png` },
];

// Template-card shape for a Lotería print, parallel to toTemplateCard() in
// templateCard.js. Only the fields the print layout reads are meaningful;
// the rest are set so the template's shared chrome (frame, set badge, FX)
// stays off unless the caller overrides it.
export function toLoteriaCard(card, index = -1) {
  return {
    id: card.id,
    name: card.name,
    cardType: "Lotería",
    style: "Lotería",
    rarity: card.rarity || "Print",
    edition: index === -1 ? "promo" : `${index + 1}/${LOTERIA_CARDS.length}`,
    layout: "print",
    printImage: card.src,
    backImage: card.back || LOTERIA_BACK,
    effects: "off",
    foilStyle: "subtle",
    backgroundImage: null,
    frameImage: null,
    frameMetaTop: null,
    fxOverlays: [],
    fxReflection: null,
    setBadge: null,
    ability: null,
    flavorText: null,
    statPair: null,
  };
}
