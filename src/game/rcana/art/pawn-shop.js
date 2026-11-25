// Pawn Shop — the storefront at night, a Location. Four planes behind the
// plate: the shop's lit interior and the wet street before it, on the scene
// rung; the window display, a guitar, a camera, a watch and an Enigma
// machine on red velvet, with the neon 24 HRS sign hung over it, both on the
// subject rung; and the facade itself, the green shopfront with its awning
// and three gold balls, nearest the window, so the display sits behind its
// glass on tilt.
//
// No paths: public/TCG/rcana/pawn-shop/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The night street's blue and the shop's amber, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#0a1a3a 0%,#1a2a5a 50%,#3a2a1a 100%)",

  layers: [
    // Far: the interior and the street, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The window display, and the neon sign over it, on one rung inside the window.
    // `glints`: sparks that flare and die (x, y in % of the layer): the watch,
    // the Enigma's rotors and its gold seal, and the camera's flash, bigger and white.
    { id: "subject", z: ART_PLANES.subject, scale: 1,
      glints: [
        { x: 55.2, y: 52.6, size: 0.4, color: "rgba(255,225,150,.6)" },
        { x: 82.6, y: 48.1, size: 0.38, color: "rgba(255,225,150,.6)" },
        { x: 83.3, y: 44.5, size: 0.3, color: "rgba(255,225,150,.6)" },
        { x: 64.8, y: 42.1, size: 0.7 },
      ] },
    // `neon`: the 24 HRS sign hums. `hang` is where its chains meet the
    // window frame, and it turns `sway` degrees either way about that point.
    // `tube.top`: nothing above this % of the layer glows (the chains).
    // `drop` is the H's box, in % of the layer: that letter fails and catches
    // again every `period` seconds, under an unlit copy with `feather`ed edges. Remove `drop` for a sign that never fails.
    { id: "prop", z: ART_PLANES.subject, scale: 1,
      neon: { hang: { x: 66.2, y: 25.1 }, sway: 0.8, tube: { top: 29.2 }, period: 9,
        drop: { x0: 65, y0: 30.8, x1: 68.4, y1: 35.5, feather: 0.6 } } },

    // The facade — the top layer, nearest the window but still BEHIND the
    // plate (z < 44), so the display shifts behind its glass on tilt.
    // `glints` here are the three gold balls catching the street light.
    { id: "prop1", z: 24, scale: 1,
      glints: [
        { x: 48.2, y: 6, size: 0.45, color: "rgba(255,215,120,.6)" },
        { x: 41.4, y: 11.6, size: 0.4, color: "rgba(255,215,120,.6)" },
        { x: 54.8, y: 11.6, size: 0.4, color: "rgba(255,215,120,.6)" },
      ] },
  ],
};
