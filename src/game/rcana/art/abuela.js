// La Abuela — the gambling grandmother. Three planes: El Sol over a blue
// field far back, Abuela at her table with her cards inside the window, and
// her own hand on the felt — glass, rings, chips — nearest.
//
// The subject sheet runs almost edge to edge (the table felt), so it has to
// sit behind the plate for the window to crop it; ahead of the frame it
// painted over the border. The hand IS the prop, and it joins the sleeve at
// the wrist, so the two planes are kept 38px apart rather than putting the
// prop on its full rung (118): enough depth for the chips to lift off the
// table, not enough to pull the hand off the arm on tilt. (figureFront was
// tried, so the chips rode over the border; it crowded the title banner.)
// Paths are by convention: public/TCG/rcana/abuela/<id>.webp.
import { ART_PLANES } from "../artSpec.js";

export default {
  // The scene's blue, for the sliver past its edge on tilt.
  backdrop: "linear-gradient(180deg,#1b5aa0 0%,#2a7cc4 60%,#1b5aa0 100%)",

  layers: [
    { id: "scene", scale: 1.04 },
    // Inside the window, behind the frame, at the size it was exported.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
    // Still short of the plate (+44), so the chips crop at the window too.
    { id: "prop", z: ART_PLANES.subject + 38, scale: 1 },
  ],
};
