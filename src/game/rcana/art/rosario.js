// El Rosario — the praying hands and rosary against a sunburst. Both
// planes stay behind the frame, with the subject at its exported size.
import { ART_PLANES } from "../artSpec.js";

export default {
  backdrop: "#089eb8",
  layers: [
    { id: "scene", scale: 1.04 },
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
  ],
};
