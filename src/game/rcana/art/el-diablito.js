// El Diablito — art planes, far to near, plus the flame sheet in front.
// See art/README.md for how a card's art file is laid out.
import { ART_PLANES, FLAME3_REFLECTION } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type (FRAME_BY_BOXES).

  // ---- THE BACKGROUND BEHIND EVERYTHING ----
  // Swap this line to change the sky. It takes either a CSS value (a
  // gradient or a flat colour) or a path to an image, which is then
  // covered and centred:
  //
  //   backdrop: "/TCG/loteria/background_layer/sky.webp",
  //   backdrop: "#1a0a0e",
  //
  // hell2.webp is clean — real alpha, no baked checkerboard — and leaves a
  // wide opening through its middle, so this shows through as the sky
  // behind the flames rather than only at the edges. It carries more of
  // the card than the backdrop did under the old scene.
  backdrop: "linear-gradient(180deg,#160a10 0%,#3a1410 44%,#7d2708 76%,#c2490b 100%)",

  layers: [
    { id: "scene", src: "/TCG/loteria/background_layer/hell2.webp", scale: 1.04 },

    // Drawn with the hand past the banner's top edge, so it rides in FRONT
    // of the frame and the overhang shows on its own.
    {
      id: "subject",
      src: "/TCG/loteria/Diablito2.webp",
      scale: 1.1,
      z: ART_PLANES.figureFront,
      // Nudge in percent of the card; positive y is down.
      offset: { x: 0, y: -1.0 },
    },

    // A thrown coin, in front of everything — figure, frame and flame alike.
    // Authored
    // on the frame's own canvas, so scale 1 and no offset land it exactly
    // where it was drawn. It is deliberately NOT in register with the
    // figure, which is over-scaled to 1.1: the coin reads as its own
    // object in its own airspace, which is what the rung is for.
    {
      id: "coin",
      src: "/TCG/loteria/Diablito_Coin.webp",
      scale: 1,
      z: ART_PLANES.prop,
    },
  ],

  fx: [
    {
      id: "flame",
      // Drawn for this card: 612x850 at the card's own aspect, content
      // stopping short of all four edges and of the banner below.
      src: "/TCG/fx-overlays/flame3.webp",
      blend: "screen",
      opacity: 0.95,
      // Nothing to trim: this sheet puts no ink below the window or at
      // any edge, so it is painted as drawn.
      clip: "none",
      // The sheet runs over the whole card, so it crosses the number tab.
      // Thin it there and "7 TRADER" reads through the fire.
      clear: ["numberTab"],
      // Light anchored to the flame itself. Each facet catches the light
      // at its own angle, so curls flare as the card turns rather than
      // the whole sheet brightening at once.
      reflection: FLAME3_REFLECTION,
    },
  ],
};
