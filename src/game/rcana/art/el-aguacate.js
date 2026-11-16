// El Aguacate — the avocado with the peso seed on the market counter, an
// Asset. Two planes behind the plate: the stall front with its awning, the
// teal wall and the blue doorway over the terracotta counter, and the
// avocado beside its price counter inside the window on the subject rung.
// Everything stays under the frame.
//
// No paths: public/TCG/rcana/el-aguacate/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The wall's teal into the counter's terracotta, for the sliver past the
  // scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#a8b07d 0%,#2aa8a0 45%,#b8502a 100%)",

  layers: [
    // Far: the stall, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The avocado and its counter, inside the window on the subject rung.
    {
      id: "subject", z: ART_PLANES.subject, scale: 1,
      // Positions on the assembled subject.webp canvas.
      priceReveal: {
        width: 1070, height: 1470,
        digit: { x: 690, y: 727, width: 41, height: 81 },
        pit: { x: 406, y: 594, rx: 136, ry: 110, angle: 48 },
        sound: "/audio/toggleButton.mp3",
      },
    },
  ],
};
