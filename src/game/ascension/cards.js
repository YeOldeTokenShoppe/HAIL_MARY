// The Ascension — slice deck + prayers.
//
// The slice deck is SCRIPTED (not shuffled) so the prototype always demos the
// same beat: both climb, the Demon eats a rug early (→ prayer window), then the
// race plays out. Whether the player prays changes who reaches the moon first,
// which is exactly the agency we want to prove. Randomized/weighted decks are a
// later phase.

export const CARD_TYPES = {
  PUMP: "pump", // advance the target by its character `advance`
  RUG: "rug", // knock the target back, down them, offer a prayer
};

export const SLICE_DECK = [
  { type: "pump", targetId: "monk", label: "Dollar-Cost Discipline" },
  { type: "pump", targetId: "demon", label: "Degen Leverage" },
  { type: "pump", targetId: "monk", label: "The Patient Climb" },
  { type: "rug", targetId: "demon", knockback: 3, label: "Rug Pull" }, // index 3 — the moment
  { type: "pump", targetId: "demon", label: "Revenge Trade" },
  { type: "pump", targetId: "monk", label: "Steady Hand" },
  { type: "pump", targetId: "demon", label: "All-In" },
  { type: "pump", targetId: "monk", label: "Enlightened Exit" },
  { type: "pump", targetId: "demon", label: "Leveraged Long" },
  { type: "pump", targetId: "monk", label: "Nirvana" },
  { type: "pump", targetId: "demon", label: "Send It" },
  { type: "pump", targetId: "monk", label: "The Long Game" },
  { type: "pump", targetId: "demon", label: "Apes Together" },
  { type: "pump", targetId: "monk", label: "Detachment" },
];

// Prayers are Our Lady of Perpetual Profit's interventions. The slice ships one.
export const PRAYERS = {
  resurrection: {
    id: "resurrection",
    name: "Resurrection",
    invoker: "Our Lady of Perpetual Profit",
    cost: 1, // Grace
    restore: 2, // steps the raised racer regains
    caption: "Our Lady raises the fallen.",
  },
};

export function getPrayer(id) {
  return PRAYERS[id] ?? null;
}
