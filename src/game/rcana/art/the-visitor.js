// The Visitor — Our Lady beamed down over the desert highway, a Grace and the
// twelfth apparition. Four planes behind the plate: the highway running to
// the mesas under a violet dusk, on the scene rung; the saucer and, as her
// own file, Our Lady descending beneath it, together on the subject rung;
// and the beam of light itself, nearest the window, drawn over her so she
// reads as standing inside it.
//
// No paths: public/TCG/rcana/the-visitor/<id>.webp by convention (artPath).
import { ART_PLANES } from "../artSpec.js";

export default {
  // Rainbow foil by default (2026-11-25), like the other apparitions: the
  // code-drawn frame prints this card in rainbow metal, and the painted frame
  // lays the Terminal Traders rainbow border over it. The binder's and bench's
  // metal controls can still override.
  metalFrame: "rainbow",

  // No `frame`: the plate follows the card's type.

  // The dusk's violet over the desert's orange, for the sliver past the scene's edge on tilt.
  backdrop: "linear-gradient(180deg,#2a0a6a 0%,#7a2a8a 55%,#d8783a 100%)",

  layers: [
    // Far: the highway and the sky, over-scaled a touch so no edge shows on tilt.
    { id: "scene", z: ART_PLANES.scene, scale: 1.04 },

    // The saucer, and Our Lady beneath it, on one rung inside the window:
    // split into two files (2026-11-25) but moving together on tilt.
    // `lamps`: the three rim lights, chasing left to right (x, y in % of the
    // layer; r in px of the card). `lampPeriod` is one lap, in seconds.
    { id: "subject", z: ART_PLANES.subject, scale: 1, lampPeriod: 2.4,
      lamps: [{ x: 27.1, y: 10.7, r: 11 }, { x: 49.8, y: 9.4, r: 12 }, { x: 72.3, y: 11, r: 11 }] },

    // `visit`: THE TILT DECIDES. Tip the card back and she rises toward the
    // saucer's lamp (x, y), smaller, fainter and in coarse blocks: she departs.
    // Tip it forward and she comes down whole and sharp: she arrives. At rest
    // she hangs between, in fine blocks. Dials: `rise`/`fall` her travel in %
    // of the layer, `shrink` how much smaller at the top, `rest` her opacity
    // at rest.
    { id: "prop", z: ART_PLANES.subject, scale: 1,
      visit: { x: 49.8, y: 14.5, rise: 4, fall: 3, shrink: 0.45, rest: 0.8,
        // `pixels`: her block size, in whole steps, by the tilt. `min` when
        // tipped fully forward (1 = the picture itself), `rest` at rest,
        // `max` tipped fully back. Sizes are px of the 512px card.
        pixels: { min: 1, max: 20, rest: 4 },
        // `tear`: mid-departure her red, green and blue come apart sideways in
        // bands (`amp` px of the card; `bands` how fine, bigger = thinner).
        // `stutter`: the same tear, harder, for a blink every so many seconds
        // (false = never). `tear: false` turns both off.
        tear: { amp: 16, bands: 0.055 }, stutter: 7 } },

    // The beam — the top layer, nearest the window but still BEHIND the
    // plate (z < 44), so the light swings ahead of her on tilt. It breathes,
    // and carries `motes`: dust in the cone (top and bottom of the cone in %
    // of the layer, w the half-width), rising when she rises, falling when
    // she falls, both ways at rest. (`blend` still works here: any CSS
    // mix-blend-mode, or "negation".)
    // `tractor`: the beam answers the tilt too, from its source (x, y: the
    // lamp). Tipped back it pinches (`pinch`) to a thin column, turns cold
    // (`cold`, 0 = stays gold) and its rings run UP; tipped forward it opens
    // (`widen`), brightens (`flood`) and the rings run DOWN. `gap` is the
    // rings' spacing in px of the card, `speed` seconds per gap, `ring` their
    // strength, `idle` how much of them shows at rest.
    { id: "prop1", z: 24, scale: 1, breathe: { low: 0.72, period: 4.2 },
      tractor: { x: 49.8, y: 15.4, pinch: 0.55, widen: 0.14, flood: 0.3, cold: 0.9, gap: 48, speed: 1.5, ring: 0.6, idle: 0.1 },
      motes: { n: 16, travel: 90, top: { x: 49.8, y: 15.4, w: 9 }, bottom: { x: 49.8, y: 59.7, w: 25 } } },
  ],
};
