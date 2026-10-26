// El Toro — the charging bull, a Progress card. Three planes and a gold FX sheet:
// scene (meadow and mountains, stopping at the banner line), the bull in the
// window, and the kicked-up rocks out in front as the prop.
//
// No paths: each layer's image is public/TCG/rcana/el-toro/<id>.webp by
// convention (see artPath in cardFace.js). Swap an image by replacing the
// file; this file only says what the layers ARE and how deep they sit.
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type (FRAME_BY_BOXES).

  // Sky, for the sliver that shows past the scene's edge on tilt — the same
  // blue the scene's own sky is painted in, so the seam never reads.
  backdrop: "linear-gradient(180deg,#5aa9ee 0%,#8fcbf5 40%,#cfe9c2 100%)",

  layers: [
    // Far: the meadow. Opaque across the window, so the backdrop is only a
    // safety net.
    { id: "scene", scale: 1.04 },

    // The bull sits inside the window (nothing drawn past the border), so it
    // takes the ordinary subject rung behind the frame.
    { id: "subject", z: ART_PLANES.subject, scale: 1.06 },

    // Rocks thrown ahead of the hooves — in front of the frame, so they swing
    // against the bull on tilt and read as being in the air.
    { id: "prop", z: ART_PLANES.prop, scale: 1.0 },
  ],

  // fx: [
  //   {
  //     id: "gold",
  //     // A shared sheet, so it is named rather than found by convention.
  //     src: "/TCG/fx-overlays/fx-rock-1-1488.webp",
  //     // The nuggets are opaque metal with their own alpha; screen would
  //     // bleach them. Painted as drawn.
  //     blend: "normal",
  //     opacity: 0.95,
  //     // Window-clipped: the sheet carries nuggets down to 95%, which would
  //     // sit on the rules text. The clip also fades the sheet's bottom edge.
  //     // Gold dust and stones thrown up by the charge, over the prop rocks.
  //     clip: "window",
  //     reflection: {
  //       material: "gold",
  //       strength: 1.1,
  //       // Traced from the sheet (npm run rcana:trace). Nuggets and sparkles
  //       // across the sheet, so one shared axis walks a glint through them
  //       // left to right; radii widened from the trace, since a sparkle's
  //       // bright core is tiny but its light should spill past it.
  //       facets: [
  //         { x: 11, y: 30, radius: [8, 6], axis: [0.92, -0.38], angle: -0.75, roughness: 0.28, hue: 46 },
  //         { x: 32, y: 87, radius: [8, 6], axis: [0.92, -0.38], angle: -0.54, roughness: 0.28, hue: 48 },
  //         { x: 42, y: 51, radius: [8, 6], axis: [0.92, -0.38], angle: -0.32, roughness: 0.28, hue: 46 },
  //         { x: 64, y: 36, radius: [8, 6], axis: [0.92, -0.38], angle: -0.11, roughness: 0.28, hue: 46 },
  //         { x: 76, y: 51, radius: [8, 6], axis: [0.92, -0.38], angle: 0.11, roughness: 0.28, hue: 50 },
  //         { x: 80, y: 44, radius: [8, 6], axis: [0.92, -0.38], angle: 0.32, roughness: 0.28, hue: 46 },
  //         { x: 82, y: 27, radius: [8, 6], axis: [0.92, -0.38], angle: 0.54, roughness: 0.28, hue: 46 },
  //         { x: 87, y: 18, radius: [8, 6], axis: [0.92, -0.38], angle: 0.75, roughness: 0.28, hue: 50 },
  //       ],
  //     },
  //   },
  // ],
};
