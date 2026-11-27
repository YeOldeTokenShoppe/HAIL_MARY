// Rewind — the VHS tape, a Remedy (the eighties card). Two planes behind the
// plate: the video store's neon wall on the scene rung, and the tape itself
// inside the window.
//
// No paths: public/TCG/rcana/rewind/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The video store's neon dusk, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#0a1a3a 0%,#122a70 50%,#3a0a3a 100%)",

  layers: [
    // Far: the store wall, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The tape, inside the window on the subject rung.
    // Live card: the tape REWINDS. The cassette's two windows are cut clear,
    // and `reels` draws what is behind them: `windows` are the two openings
    // (% of the layer, a little oversize; the cassette's own edges trim
    // them), `left`/`right` the hubs, `hub`/`min`/`max` the hub's radius and
    // the tape pack's when empty and full (px of the 512px card). One
    // `period` is: play slowly, stop, rewind fast, rest.
    { id: "subject", z: ART_PLANES.subject, scale: 1,
      reels: { period: 13, hub: 21, min: 29, max: 72,
        // Measured from the cassette with the RL80 label (2026-11-25): its right window sits further out than the first cut's.
        left: { x: 23.4, y: 37.2 }, right: { x: 79.2, y: 39.4 },
        windows: [{ x0: 11.2, y0: 28.7, x1: 32.5, y1: 46 }, { x0: 70, y0: 30.7, x1: 91.7, y1: 48 }] } },
  ],
};
