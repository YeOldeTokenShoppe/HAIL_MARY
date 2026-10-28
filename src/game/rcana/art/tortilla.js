// La Tortilla — the miracle in the basket. A courtyard far back, the basket
// in the window behind the frame (the sill crops the serape's fringe), and
// the steam nearest of all.
//
// The steam is mounted as an FX SHEET rather than an art prop: it is
// translucent, it rises over the frame to the card's top edge, and it would
// otherwise haze the number tab — an fx sheet can be cleared over the tab,
// an art layer cannot. No light response; it is steam, not fire.
// Paths are by convention: public/TCG/rcana/tortilla/<id>.webp; the steam
// names its file since it lives as prop.webp, not fx-steam.webp.
import { ART_PLANES } from "../artSpec.js";

export default {
  // The courtyard's sky, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#1f7fc4 0%,#5fb3e6 55%,#d9b27a 100%)",

  layers: [
    { id: "scene", scale: 1.04 },
    { id: "subject", z: ART_PLANES.subject, scale: 1 },
  ],

  fx: [
    {
      id: "steam",
      src: "/TCG/rcana/tortilla/prop.webp",
      blend: "normal",
      opacity: 1,
      clip: "none",
      clear: ["numberTab"],
    },
  ],
};
