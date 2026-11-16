// The Perp — the infinity coaster at the night fair, an Asset. Three planes
// behind the plate: the starry fairground with the big top and the wheel
// lit on the skyline, the figure-eight coaster with its rider cresting the
// loop inside the window on the subject rung, and the ABIERTO 24 HORAS
// ticket booth nearest the window. Everything stays under the frame.
//
// No paths: public/TCG/rcana/the-perp/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The night's deep blue, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#021238 0%,#0a1e5a 60%,#1a1a3a 100%)",

  layers: [
    // Far: the fairground and the sky, over-scaled a touch so no edge shows
    // on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The coaster and its rider, inside the window on the subject rung.
    {
      id: "subject", z: ART_PLANES.subject, scale: 1,
      // Visible marquee bulbs, in travel order on a half-size subject canvas.
      marquee: {
        viewBox: "0 0 535 735",
        bulbs: [
          [99,216], [112,219], [124,225], [135,232], [146,241], [157,250],
          [167,260], [177,270], [187,279], [196,289], [207,298], [218,308],
          [230,317], [279,352], [292,360], [303,368], [317,375], [330,381],
          [344,386], [359,390], [373,392], [386,393], [400,393], [412,392],
          [424,389], [435,386], [446,381], [456,376], [466,370], [475,362],
          [482,354], [489,345], [494,335], [499,323], [501,312], [501,299],
          [499,286], [496,274], [490,263], [482,253], [473,244], [461,236],
          [448,230], [434,226], [420,225], [406,226], [391,230], [376,235],
          [362,243], [350,250], [339,258], [328,265], [318,273], [308,281],
          [299,289], [290,296], [282,303], [273,311], [264,318], [255,326],
          [246,333], [238,339], [228,346], [215,356], [200,365], [187,373],
          [173,379], [159,384], [146,387], [131,389], [117,390], [102,388],
          [89,385], [76,381], [64,374], [53,366], [44,358], [35,347], [27,336],
          [29,258], [36,248], [44,238], [53,229], [64,223], [75,218], [86,216],
        ],
      },
    },

    // The ticket booth — nearest the window but still BEHIND the plate
    // (z < 44), so the frame clips it at the window's edge.
    { id: "prop", z: 24, scale: 1 },
  ],
};
