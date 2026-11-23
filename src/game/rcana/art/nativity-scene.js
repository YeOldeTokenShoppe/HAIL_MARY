// The Nativity — the crèche set up on the cobbles under the star, a
// Location (the third printed). Four planes behind the plate: the night city,
// a neon skyline under the star with the lamplit cobbles running to the
// window's foot, on the scene rung; the stable with the Holy Family at the
// manger, and the light rising from the manger (glow), both on the subject
// rung; and the front beam with the bull and the bear
// lying down on either side, nearest the window. Everything stays under the
// frame.
//
// No paths: public/TCG/rcana/nativity-scene/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // Rainbow foil by default (2026-11-22): the code-drawn frame prints this card
  // in rainbow metal, and the painted frame lays the Terminal Traders rainbow
  // border over it. The binder's and bench's metal controls can still override.
  metalFrame: "rainbow",

  // No `frame`: the plate follows the card's type.

  // The night's violet into the lamplit cobbles, for the sliver past the
  // scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#1a1040 0%,#4a2a8a 50%,#c8702a 100%)",

  layers: [
    // Far: the city and the star, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The stable, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The light rising from the manger — on the SAME rung as the stable, drawn
    // after it so it lies over the straw, and it stays put on tilt.
    { id: "glow", z: ART_PLANES.subject, scale: 1 },

    // The beam, the bull and the bear — the top layer, nearest the window but
    // still BEHIND the plate (z < 44), so the frame clips it at the edges.
    { id: "prop", z: 24, scale: 1 },
  ],
};
