// Oil Field Claim — the pumpjack with its gusher, an Asset. Three planes
// behind the plate: the synthwave sunset, the rig on the sand, and the claim
// certificate nearest the window. (prop1.webp, a thrown splash of crude
// drawn for the front of the frame, is still in the folder but unused.)
//
// No paths: public/TCG/rcana/oil-field/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The sunset's coral to amber, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#f27a6a 0%,#f6a060 55%,#e8a040 100%)",

  layers: [
    // Far: the sunset, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The rig, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The claim certificate at lower-left. Ahead of the rig but still BEHIND
    // the plate (z < 44), so the window clips it at the frame's edge and the
    // banner covers its foot.
    { id: "prop", z: 24, scale: 1 },
  ],
};
