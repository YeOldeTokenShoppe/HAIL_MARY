// The Catacombs — the vault under the shrine, a Location (cold storage: an
// Asset sent down is out of the market's reach). Two planes behind the
// plate: the teal vault with its barred gate and the stair down, on the
// scene rung; and the stone arch nearest the window, with the lantern, the
// niches of skulls, the chest and the gold under its cloth, on the subject
// rung. Everything stays under the frame.
//
// No paths: public/TCG/rcana/the-catacombs/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The vault's teal into the dark under the stair, for the sliver past the
  // scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#0e2a30 0%,#183d44 55%,#07161a 100%)",

  layers: [
    // Far: the vault and the gate, over-scaled a touch so no edge shows on tilt.
    // Live card: the gold bar catches the light (`glints`, x, y in % of the
    // layer), and a low cold `mist` slides across the vault floor in front of
    // the gate (x0..x1, y0..y1 the band in % of the layer; `strength` 0-1).
    { id: "scene", z: ART_PLANES.scene, scale: 1.04,
      glints: [{ x: 77.6, y: 39, size: 0.5, color: "rgba(255,220,130,.6)" }, { x: 81, y: 40.4, size: 0.35, color: "rgba(255,220,130,.6)" }],
      mist: { x0: 30, x1: 70, y0: 42, y1: 54, period: 26, strength: 0.5 } },

    // The arch, the lantern and the niches, inside the window on the subject rung.
    // Live card: the lantern burns. It is painted into this layer, so nothing
    // moves; `glows` lays a pool of lamplight on its glass (x, y in % of the
    // layer; r in px of the card) that gutters unevenly.
    { id: "subject", z: ART_PLANES.subject, scale: 1, glows: [{ x: 16, y: 20.8, r: 46, period: 2.3 }] },
  ],
};
