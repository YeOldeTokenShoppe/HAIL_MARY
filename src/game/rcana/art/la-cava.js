// La Cava — the vintage in the tiled niche, an Asset. Two planes behind the
// plate: the terracotta niche with its cobalt tiles, and the bottle of Our
// Lady of Perpetual Profit with its +25 tag beside a lit green candle
// inside the window on the subject rung. Everything stays under the frame.
//
// No paths: public/TCG/rcana/la-cava/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The tiles' cobalt into the niche's terracotta, for the sliver past the
  // scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#212a62 0%,#1a2a80 55%,#c05a22 100%)",

  layers: [
    // Far: the niche, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The bottle and the candle, inside the window on the subject rung.
    {
      id: "subject", z: ART_PLANES.subject, scale: 1,
      candleReveal: {
        width: 1070, height: 1470, sound: "/audio/match.mp3",
        // The unlit silhouette protects the wick, wax and saucer while the halo grows.
        wickX: 768, wickY: 719,
        candleBody: "M765 733 L765 713 Q768 706 771 713 L771 723 Q817 721 823 731 L826 764 L822 815 Q872 816 891 830 L868 879 L850 890 L686 890 L650 834 Q659 818 714 814 L714 768 Q704 774 711 746 L713 730 Q719 721 765 723 Z",
      },
    },
  ],
};
