// The God Candle — the titan raising the green candle over the market, an
// Opportunity. Four planes behind the plate: the storm sky over the
// candlestick ranges, the halo's glow breaking the clouds, the marble titan
// holding the lit green candle inside the window, and the temple steps with
// their fallen column nearest the window. Everything stays under the frame.
//
// No paths: public/TCG/rcana/god-candle/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The storm's violet into the mist over the ranges, for the sliver past the
  // scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#120a2e 0%,#28224f 55%,#3a3350 100%)",

  layers: [
    // Far: the sky and the candlestick mountains, over-scaled a touch so no
    // edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The halo's glow, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The titan and the candle, a step ahead of the glow behind him.
    { id: "prop", z: 8, scale: 1 },

    // The temple steps — the top layer, nearest the window but still BEHIND
    // the plate (z < 44), so the frame clips them at its edge.
    { id: "prop1", z: 24, scale: 1 },
  ],
};
