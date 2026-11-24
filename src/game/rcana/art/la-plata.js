// Quicksilver (La Plata; art id "la-plata") — the stoppered flask of mercury on the crypt's table, its collar
// stamped 80 Hg, an Asset. Two planes behind the plate: the dark vault with its red-lit niches and the polished
// table, on the scene rung; and the flask, inside the window on the subject rung. (Until 2026-11-23 this was the
// silver peso on the scale; board-mask.png and dial-mask.png in the folder belong to that picture.)
//
// LIVE CARD: the mercury moves. `liquid` draws it in code over the flask's painted liquid, inside mask.webp (the
// inside of the flask): it keeps its own level as the card is tipped, sloshes, and settles. The painted liquid is
// what the printed face shows.
//   box    the part of the layer the mask's shape occupies, in %
//   level  where the surface rests, in % of the layer's height. It sits a little ABOVE the painted surface (about
//          40) so that the painted liquid never shows past the live one when it leans
//   cx, rx the surface's middle and half-width at that level, in %
//
// No paths: public/TCG/rcana/la-plata/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The vault's near-black into the table, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#07070d 0%,#12131c 60%,#0c0d14 100%)",

  layers: [
    // Far: the vault and the table, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The flask, inside the window on the subject rung.
    {
      id: "subject", z: ART_PLANES.subject, scale: 1,
      liquid: { mask: "/TCG/rcana/la-plata/mask.webp?v=1", box: { x: 25, y: 25, w: 54, h: 31.5 }, level: 36.6, cx: 51.7, rx: 24.6 },
      // Sparks on the stopper and the glass.
      glints: [{ x: 50.5, y: 12.5, size: 0.9 }, { x: 33, y: 31, size: 0.7 }, { x: 71, y: 30, size: 0.6 }],
    },
  ],
};
