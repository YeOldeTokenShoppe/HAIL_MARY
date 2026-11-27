// Pocket Saint — the little monk in his gachapon capsule, a Relic. Four
// planes behind the plate: the sunburst on the scene rung; and, all on the
// subject rung, the capsule's open lid, his halo, and the monk standing in
// its gold base, drawn in that order so the lid opens and the halo stands
// behind him.
//
// No paths: public/TCG/rcana/pocket-saint/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The sunburst's dusk, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#0a2a3a 0%,#2a2040 50%,#3a1a4a 100%)",

  layers: [
    // Far: the sunburst, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The capsule's lid, on the subject rung, drawn BEFORE the monk so it
    // sits open behind him.
    // Live card: `flare`, a glimmer through the clear plastic's own highlights,
    // and the lid FLOATS (`hover`: it rises `rise` px of the 512px card and
    // settles, every `period` seconds), as if the capsule had just popped open.
    // It is the lid that hovers, not the halo, since 2026-11-26.
    { id: "prop", z: ART_PLANES.subject, scale: 1, flare: { period: 5, strength: 0.5 }, hover: { rise: 6, period: 4.4 } },

    // The halo, on the subject rung too, drawn BEFORE the monk so it stands
    // behind his head, the way a painted halo does.
    // Live card: the halo stays put over his head (`rise: 0`) and hums like
    // neon (`hum`, which rides on `hover`), with a green pool of its own light
    // breathing round it (`glows`).
    { id: "prop1", z: ART_PLANES.subject, scale: 1, hover: { rise: 0, period: 3.2, hum: true },
      glows: [{ x: 53.4, y: 12, r: 96, ry: 44, color: "120,255,60", period: 3.2, mode: "breathe", low: 0.3 }] },

    // The monk in the capsule's base, inside the window on the subject rung,
    // drawn last.
    // Live card: his eyes are LEDs (`glows`: a steady light that swells a
    // little; he is a toy, so they do not blink; x, y in % of the layer, r in
    // px of the card), and `glints` spark on his cross and the capsule's gold rim.
    { id: "subject", z: ART_PLANES.subject, scale: 1,
      glows: [
        { x: 45.9, y: 21.7, r: 13, color: "120,200,255", period: 4.2, mode: "breathe", low: 0.55 },
        { x: 56.8, y: 21.7, r: 13, color: "120,200,255", period: 4.2, mode: "breathe", low: 0.55 },
      ],
      glints: [
        { x: 50.9, y: 41.5, size: 0.4, color: "rgba(255,225,140,.6)" },
        { x: 33, y: 46.5, size: 0.45, color: "rgba(255,225,140,.6)" },
        { x: 74, y: 47.5, size: 0.4, color: "rgba(255,225,140,.6)" },
      ] },
  ],
};
