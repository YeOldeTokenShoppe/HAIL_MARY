// La Vaca — the milk cow in the ranch yard, an Asset. Two depths behind
// the plate: the ochre yard with its red wall, the agaves and the blue
// hills under a sunset sky, and on the subject rung the cow, the coin
// emerging from behind her, and the milk pail catching it. Everything stays under the frame.
//
// No paths: public/TCG/rcana/la-vaca/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The sunset's peach into the yard's ochre, for the sliver past the
  // scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#c49e8d 0%,#e88a68 50%,#c8782a 100%)",

  layers: [
    // Far: the yard and the hills, over-scaled a touch so no edge shows on
    // tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The falling coin, on the subject rung too.
    {
      id: "prop1", z: ART_PLANES.subject, scale: 1,
      drop: { origin: "65.1% 48.9%", start: "-6%", travel: "4.8%", sound: "/coinPlink.mp3" },
    },

    // The cow, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The pail, on the subject rung with the cow so the two stand on the
    // same ground on tilt. Listed after the coin so it paints over it.
    { id: "prop", z: ART_PLANES.subject, scale: 1 },
  ],
};
