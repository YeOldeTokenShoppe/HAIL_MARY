// The Wheel — the prize wheel on the sunset stage, an Ambiguity. Six planes
// behind the plate: the stage and the evening sky, on the scene rung; the
// stand, the wheel and its flapper and hub, all on one rung just behind the
// window; and the hostess presenting, cut out on her own, drawn over it all
// but moving with the stage.
//
// No paths: public/TCG/rcana/wheel-of-fortune/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // No `frame`: the plate follows the card's type.

  // The sky's dusk, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#3a1a6a 0%,#c85a7a 50%,#4a2a4a 100%)",

  layers: [
    // Far: the stage and the sky, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The apparatus, all on one rung so it turns as one on tilt, BEHIND the
    // plate (z < 44). Back to front: the stand, the wheel, the hub over its
    // axle, and the flapper.
    { id: "prop1", z: 24, scale: 1 },
    // The wheel alone. On the live card it is thrown about its axle, runs down
    // and rests on a wedge; it throws itself every few seconds, and a click
    // or tap on the wheel throws it at once (and does not turn the card over).
    // spin: x, y the axle in % of the layer, measured from the rim; squash,
    // the painted disc is 1.2% taller than wide, and this makes it a true
    // circle before it turns, so it does not wobble; r, its radius in % of
    // the layer's width, for the click. Keep scale 1.
    { id: "subject", z: 24, scale: 1, spin: { x: 52.24, y: 35.29, squash: 0.9883, r: 30.5 } },
    // The hub, still while the wheel turns under it.
    { id: "prop", z: 24, scale: 1 },
    // The flapper alone. On the live card each peg knocks it aside as it
    // passes (tick: x, y its pivot in % of the layer), timed from the throw.
    { id: "prop3", z: 24, scale: 1, tick: { x: 52.25, y: 12.7 } },

    // The hostess again, cut out on her own: drawn last, over the wheel, but
    // on the scene's rung, so she slides with the stage on tilt while the
    // wheel moves against her. Scale 1, not the scene's 1.04, so she sits
    // exactly over her copy on the stand at rest.
    { id: "prop2", z: ART_PLANES.scene, scale: 1 },
  ],
};
