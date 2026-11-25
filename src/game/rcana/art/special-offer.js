// Special Offer — the old television, lit and waiting. Three planes behind
// the plate: the dim blue room, wall and floorboards washed in the set's
// glow, on the scene rung; the wooden console set on its stand, on the
// subject rung; and its screen, the teal glass alone, drawn over the bezel on
// that same rung so it never slides out of its frame on tilt.
//
// No paths: public/TCG/rcana/special-offer/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The room's blue, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#0a1a4a 0%,#122a6a 55%,#1a1030 100%)",

  layers: [
    // Far: the room, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The set, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The screen, on the set's own rung so it stays inside the bezel.
    // `screen`: the advertisement, drawn live on the glass. `box` is the glass
    // in % of the layer (x 124..818, y 231..760 of 1027 x 1424); the layer's
    // own shape masks it to the curved tube. `ad` is the copy, and it must
    // say what the card does (designs.js: saleRate). `glow` is the light it
    // throws on the stand. `period` is the length of the spot, in seconds.
    { id: "prop", z: ART_PLANES.subject, scale: 1,
      screen: {
        box: { x: 12.07, y: 16.22, w: 67.58, h: 37.15 }, period: 15,
        glow: { x: 22, y: 57.6, w: 50, h: 3.2 },
        ad: {
          kicker: "Every Asset on the market",
          kicker2: "Your rival saves too!",
          price: "HALF OFF",
          sub: "This round only",
          burst: "But wait!",
          phone: "1-800-ASK-RL80",
          name: "Special Offer",
          lines: ["Cash · Candles · C.O.D.", "Operators are standing by"],
          fine: "Offer ends when the round does. One Asset per player per turn.", // two lines fit under the tube's curve; a third is cut
        },
      } },
  ],
};
