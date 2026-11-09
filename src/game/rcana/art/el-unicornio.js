// El Unicornio — the disco unicorn, a Trader. Two planes, both behind the
// plate (+44) so the window crops the stack: the dancing unicorn and the
// nearest foreground element (prop1). No scene layer — the backdrop is the
// field behind the subject wherever it does not paint.
//
// No paths: each layer's image is public/TCG/rcana/el-unicornio/<id>.webp
// by convention (see artPath in cardFace.js). prop1 is not an ART_PLANES
// key, so it names its own z.
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The Terminal Traders rainbow border over the Lotería frame, by default
  // (RCANA_METAL_FRAMES id). The bench's Metal frame select starts here and
  // can still override it; the print route takes it as is.
  metalFrame: "rainbow",

  // The club's purple dark — with no scene layer this is the whole field
  // behind the subject, not just a sliver on tilt.
  backdrop: "linear-gradient(180deg,#2a0f4a 0%,#5a1f7a 55%,#c0308a 100%)",

  layers: [
    // The dancer, inside the window on the ordinary subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // Nearest plane — still under the plate (+44).
    { id: "prop1", z: 30, scale: 1 },
  ],
};
