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
  backdrop: "#060519", // the octahedron's was "linear-gradient(180deg,#020308 0%,#060818 55%,#020308 100%)"

  // The live scene for this card (a key of SCENES in RcanaLive3D.jsx).
  // "sacred-lattice" (live3d/sacredLattice.js): RL80's own scene, one lattice of eight ribbons that is a
  // torus knot, a rose window and a lotus in turn; its poster, `lattice`, is the knot, the form it opens on. The first
  // scene, an adaptation of a pen, is still in the repo as a fallback: "sacred-geometry"
  // (live3d/sacredGeometry.js), poster `scene`. To go back, set live3d to "sacred-geometry", the
  // layer's id to "scene", and the backdrop to the gradient noted above.
  live3d: "sacred-lattice",

  layers: [
    // The poster. Opaque across the window; over-scaled a touch so no edge shows on tilt.
    { id: "lattice", z: ART_PLANES.scene, scale: 1.04 },
  ],
};
