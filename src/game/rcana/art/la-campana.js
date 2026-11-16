// La Campana — the bell and its flower-covered arch share a depth so the
// hinge stays attached on tilt.
import { ART_PLANES } from "../artSpec.js";

const hinge = "54.9% 29.1%"; // Iron hinge above the bell crown.

export default {
  backdrop: "#29b1e2",

  layers: [
    { id: "scene", scale: 1.04 },
    { id: "arch", z: ART_PLANES.subject, scale: 1 },
    {
      id: "bell", src: "/TCG/rcana/la-campana/shell.webp", z: ART_PLANES.subject, scale: 1,
      swingOrigin: hinge,
      swingSound: "/audio/churchBell.mp3",
    },
    {
      id: "clapper", z: ART_PLANES.subject, scale: 1,
      swingOrigin: hinge,
      clapperRestAngle: "-19deg", // Leaves the painted shaft just right of vertical.
      clapperOrigin: "51.3% 49.8%", // Pin inside the bell mouth.
    },
  ],
};
