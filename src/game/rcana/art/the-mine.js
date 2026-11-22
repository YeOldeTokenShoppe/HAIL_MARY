// The Mine — the claim that pays the longer you dig, an Asset. Two planes
// behind the plate: the timbered gallery, and the foreground ledges with
// drifting sparks nearest the window. (subject.webp, the ore mound, is still
// in the folder but unused.) This art was authored for Gold; Gold was dropped
// 2026-11-10 and the folder moved here whole.
//
// No paths: public/TCG/rcana/the-mine/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.
  // Rainbow foil by default (2026-11-21), like the other apparitions: the
  // code-drawn frame prints this card in rainbow metal, and the painted frame
  // lays the Terminal Traders rainbow border over it (it was the gold border
  // until today). The binder's and bench's metal controls can still override.
  metalFrame: "rainbow",

  // The mine's indigo, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#0e1240 0%,#1c2060 55%,#0e1240 100%)",

  layers: [
    // Far: the gallery, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // Ledges at the lower corners and sparks in the air, nearest the window
    // but still BEHIND the plate (z < 44): the ledges' cut edges fall below
    // the window, so the banner hides them.
    { id: "prop", z: 24, scale: 1 },
  ],
};
