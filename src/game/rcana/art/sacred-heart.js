// El Corazón — the Sacred Heart, a Relic. Four planes behind the plate: the
// teal burst of rays, on the scene rung; and the heart itself, a cut ruby,
// with the flame crowning it and the girdle of candlesticks, red and green,
// wound round it like thorns, all three on the subject rung so the heart
// holds together on tilt while the rays wheel behind it.
//
// No paths: public/TCG/rcana/sacred-heart/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The rays' teal, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#063a3a 0%,#0a6a62 50%,#063a3a 100%)",

  layers: [
    // Far: the rays, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The heart, its flame and its girdle, on one rung inside the window.
    // Back to front: the ruby, the flame over its top, the candlesticks over both.
    // Live card: the heart BEATS, in light only (`beat`: two thumps and a
    // rest, every `period` seconds). Nothing moves, so the flame and the
    // candles stay seated on it.
    { id: "subject", z: ART_PLANES.subject, scale: 1, beat: { period: 1.6 } },
    // The flame, with its gold collar. It holds still; its light ROLLS ROUND
    // it, as on Connor's card. `facets.at` are the tongues of the flame (x, y
    // in % of the layer; r in px of the card): a light circles the flame's
    // middle (cx, cy) once every `period` seconds and each tongue flares as
    // the light comes round to it. Tilting the card pushes the light.
    // (Tried and dropped, 2026-11-25: a surging `blaze`, a climbing bar, and
    // drifting patches, `roll`, which read as smoke.)
    { id: "prop", z: ART_PLANES.subject, scale: 1,
      facets: { cx: 50.6, cy: 17.5, period: 4.5, idle: 0.62, strength: 1,
        at: [
          { x: 49.5, y: 6.5, r: 22 }, // the tip
          { x: 59.8, y: 12.6, r: 22 }, // right tongue
          { x: 62.2, y: 19.2, r: 22 }, // right, low
          { x: 51, y: 21.5, r: 26 }, // the front tongue
          { x: 39.5, y: 20.6, r: 22 }, // far left
          { x: 43, y: 16.6, r: 20 }, // left, low
          { x: 45.3, y: 11.2, r: 22 }, // left tongue
        ] } },
    // The string of chart candles. `glints`: a spark on each body in its own
    // colour (x, y in % of the layer), green then red, left to right.
    { id: "prop1", z: ART_PLANES.subject, scale: 1,
      glints: [
        { x: 24.1, y: 37.7, size: 0.42, color: "rgba(120,255,150,.6)" },
        { x: 32.5, y: 40.8, size: 0.42, color: "rgba(255,120,110,.6)" },
        { x: 41.7, y: 38.5, size: 0.42, color: "rgba(120,255,150,.6)" },
        { x: 50.9, y: 42.8, size: 0.42, color: "rgba(255,120,110,.6)" },
        { x: 60.2, y: 40, size: 0.42, color: "rgba(120,255,150,.6)" },
        { x: 68.5, y: 37.1, size: 0.42, color: "rgba(255,120,110,.6)" },
        { x: 77.7, y: 34.7, size: 0.42, color: "rgba(120,255,150,.6)" },
      ] },
  ],
};
