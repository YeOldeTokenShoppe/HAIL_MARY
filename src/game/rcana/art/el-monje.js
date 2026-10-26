// El Monje — the robot friar in the mission courtyard. Two planes, no prop, no FX:
// the courtyard far back and softened (depth of field — a blurred far plane
// reads as distance before the card even moves), the monk between it and the
// frame, cropped by the window.
//
// The subject is authored full-canvas and shown full-canvas: he is a portrait
// in the window, not a figure standing on the banner.
// Paths are by convention: public/TCG/rcana/el-monje/<id>.webp.
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type (FRAME_BY_BOXES).

  // The courtyard's own sky, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#3f8fe0 0%,#8ec6f2 50%,#f1d9b0 100%)",

  layers: [
    // Lifted so the window shows the facade, door and fountain rather than
    // mostly sky; the plane still covers the window with the tilt's drift.
    { id: "scene", scale: 1.06, offset: { y: -9 }, blur: 4 },
    // Behind the frame, between it and the courtyard, at the size he was
    // exported: the window crops him like a portrait, the banner takes the
    // rest. scale 1 (not the 1.06 default) so he lands exactly as drawn.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
  ],
};
