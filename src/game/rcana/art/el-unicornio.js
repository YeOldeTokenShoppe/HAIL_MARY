// El Unicornio — the biker unicorn, a Trader. Five planes, every one of them
// behind the plate (+44) so the window crops the whole stack: the desert
// road, the rider on the back half of the bike, the front wheel and fork,
// the dust kicked up behind, and the roadside rocks nearest the viewer.
//
// The front wheel joins the bike at the fork, but it is the nearest part of
// the bike and reads flat sitting on the rider's rung, so it gets 22px of its
// own ahead of the subject: enough to lift on tilt without tearing the fork
// off the frame. The dust and rocks are loose, so they stack ahead of it,
// still short of the plate.
//
// No paths: each layer's image is public/TCG/rcana/el-unicornio/<id>.webp
// by convention (see artPath in cardFace.js). prop1..3 are not ART_PLANES
// keys, so each names its own z.
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The scene's sky, for the sliver past its edge on tilt.
  backdrop: "linear-gradient(180deg,#1f4fb8 0%,#3b82d6 35%,#e0923a 100%)",

  layers: [
    // Far: the road and mesas. Opaque across the window.
    { id: "scene", scale: 1.04 },

    // The rider, inside the window on the ordinary subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // Front wheel + fork — clearly ahead of the rider, still joined at the fork.
    { id: "prop3", z: ART_PLANES.subject + 22, scale: 1 },

    // Dust trail off the back wheel, loose, between the bike and the rocks.
    { id: "prop2", z: 14, scale: 1 },

    // Roadside rocks, the nearest plane — still under the plate (+44).
    { id: "prop1", z: 30, scale: 1 },
  ],
};
