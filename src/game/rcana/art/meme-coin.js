// Meme Coin — the pony on the crescent moon, an Asset.
// Three planes behind the plate: the starfield, the pony on the moon, and
// the rainbow sweep nearest the window.
//
// The sweep was authored on the card's own canvas, already sized to the art
// window, so it is a plain art layer (scale 1, no clip) rather than an FX
// sheet: it lands where it was drawn and composites with its own alpha.
// Ahead of the pony but still BEHIND the plate (z < 44), so the window clips
// it at the frame's edge while it still swings against her on tilt.
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

    // The rainbow sweep and stars — nearest the window, under the frame.
    { id: "prop", z: 24, scale: 1 },
  ],
};
