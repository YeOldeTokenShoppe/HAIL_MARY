// La Plata — the silver peso on the scale, an Asset. Two planes behind the
// plate: the panelled room with the crashing red chart in its blue window,
// and the silver coin weighing down the brass scale, its needle on +25,
// inside the window on the subject rung. Everything stays under the frame.
//
// No paths: public/TCG/rcana/la-plata/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The chart's blue into the floor's red, for the sliver past the scene's
  // edge on tilt.
  backdrop: "linear-gradient(180deg,#1a2a8a 0%,#8a6a2a 55%,#c04a22 100%)",

  layers: [
    // Far: the room and the chart, over-scaled a touch so no edge shows on
    // tilt.
    {
      id: "scene", z: ART_PLANES.scene, scale: 1.04,
      scaleReveal: { part: "board", patch: "/TCG/rcana/la-plata/board-mask.png" },
    },

    // The coin on the scale, inside the window on the subject rung.
    {
      id: "subject", z: ART_PLANES.subject, scale: 1,
      scaleReveal: { part: "dial", patch: "/TCG/rcana/la-plata/dial-mask.png", sound: "/audio/toggleButton.mp3" },
    },
  ],
};
