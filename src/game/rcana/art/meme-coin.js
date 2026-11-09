// Meme Coin — the pony on the crescent moon, an Asset.
// Two planes behind the plate, the starfield and the pony on the moon, and
// the rainbow sweep as a prop in front of the frame.
//
// The sweep was authored on the card's own canvas, already sized to the art
// window, so it is a plain art layer (scale 1, no clip) rather than an FX
// sheet: it lands where it was drawn and composites with its own alpha. On
// the prop rung (+118) it swings against the pony on tilt, which is what a
// trail of light should do.
//
// No paths: public/TCG/rcana/meme-coin/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The scene's deep night, for the sliver past its edge on tilt.
  backdrop: "linear-gradient(180deg,#050a2e 0%,#1a1252 60%,#4a2a8a 100%)",

  layers: [
    // Far: the starfield and clouds. Opaque across the window.
    { id: "scene", scale: 1.04 },

    // The pony on her moon, inside the window on the subject rung.
    { id: "subject", z: ART_PLANES.subject, scale: 1 },

    // The rainbow sweep and stars — in front of the frame, nearest the viewer.
    { id: "prop", z: ART_PLANES.prop, scale: 1 },
  ],
};
