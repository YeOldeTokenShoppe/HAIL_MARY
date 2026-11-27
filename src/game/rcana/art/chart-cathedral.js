// La Catedral — the Chart Cathedral, a Location. FULL ART: the picture fills
// the frame top to bottom and the words are set on it (RcanaCard3: fullArt).
// Two planes behind the plate: the nave itself, the great window a stained
// glass candlestick chart under the flaming heart, the saint in his side
// light and the polished floor throwing it all back, on the scene rung; and
// the candle stand on the floor before it, green candles and red, nearest
// the window.
//
// No paths: public/TCG/rcana/chart-cathedral/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // Full art: no text box; the rules, flavor and name sit on the picture.
  fullArt: true,

  // The words stay centred. (`textBox: { dx, w }` can slide and narrow them;
  // stepping them left of the candle stand was tried and looked off balance, 2026-11-25.)

  // No `frame`: the plate follows the card's type.

  // The nave's green and gold, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#0a2a1a 0%,#1a5a3a 50%,#0a2a1a 100%)",

  layers: [
    // Far: the nave, over-scaled a touch so no edge shows on tilt.
    // Live card: the chart in the great window LIGHTS, candle by candle, left
    // to right (`lamps`: x, y in % of the layer; r, ry the light's half-width
    // and half-height in px of the card; green or red by `tint`). One pass
    // takes `lampPeriod` seconds.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04, lampPeriod: 4.8,
      lamps: [
        { x: 41.1, y: 54.1, r: 9, ry: 20, tint: "90,255,120", color: "rgba(225,255,225,.9)" },
        { x: 44.8, y: 48.5, r: 9, ry: 24, tint: "90,255,120", color: "rgba(225,255,225,.9)" },
        { x: 49.6, y: 49.1, r: 8, ry: 12, tint: "255,80,70", color: "rgba(255,225,215,.9)" },
        { x: 54.8, y: 45.4, r: 9, ry: 26, tint: "90,255,120", color: "rgba(225,255,225,.9)" },
        { x: 59.8, y: 44.9, r: 8, ry: 12, tint: "255,80,70", color: "rgba(255,225,215,.9)" },
        { x: 64.6, y: 41.6, r: 9, ry: 26, tint: "90,255,120", color: "rgba(225,255,225,.9)" },
        { x: 69.6, y: 40.7, r: 8, ry: 12, tint: "255,80,70", color: "rgba(255,225,215,.9)" },
        { x: 74, y: 35.6, r: 9, ry: 26, tint: "90,255,120", color: "rgba(225,255,225,.9)" },
      ] },

    // The candle stand — the top layer, nearest the window but still
    // BEHIND the plate (z < 44), so it stands ahead of the nave on tilt.
    // Live card: the three green candles burn. Their flames are painted into
    // this layer with the stand, so nothing moves; `glows` lays a small pool
    // of light on each flame (x, y in % of the layer; r in px of the card)
    // that gutters on its own clock. The red candles stay dark.
    { id: "prop", z: 24, scale: 1,
      glows: [{ x: 68.2, y: 52.8, r: 17, period: 2.1 }, { x: 80.7, y: 49.9, r: 19, period: 2.6 }, { x: 87.1, y: 52.7, r: 17, period: 1.9 }] },
  ],
};
