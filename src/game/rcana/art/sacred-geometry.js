// Sacred Geometry — the octahedron within the octahedron, a Relic. The first card whose art is a LIVE 3D
// object: on the enlarged, tilting card the art window holds a running three.js scene
// (src/game/rcana/live3d/sacredGeometry.js, mounted by src/components/RcanaLive3D.jsx), and the card's
// own tilt turns the construct. Everywhere a card is a picture (hands, the binder, rendered faces) it
// shows `scene`: one frame of that same scene, captured as the poster.
//
// To re-shoot the poster after changing the scene, render mount(canvas, { still: 3.2 }) at 960 x 940
// and paste it at (32, 32) on a 1024 x 1422 canvas filled with the backdrop colour.
//
// No paths: public/TCG/rcana/sacred-geometry/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // The scene's own dark, for the sliver past the poster's edge on tilt.
  backdrop: "linear-gradient(180deg,#020308 0%,#060818 55%,#020308 100%)",

  // The live scene for this card (a key of SCENES in RcanaLive3D.jsx).
  live3d: "sacred-geometry",

  layers: [
    // The poster. Opaque across the window; over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },
  ],
};
