// Shared focus signal between Our Lady's chamber (MaryChamber) and the
// hero canvas's CraneShotCamera. Clicking the phone in the chamber sets
// a focus framing; the crane camera, which normally derives its position
// purely from scroll, glides to it through its existing lerp smoothing.
// Clearing hands control back to the scroll choreography.
//
// Module-level state instead of prop-drilling, mirroring the
// candleIgnitionPulse pattern — the chamber and the camera are distant
// cousins in the tree (page → scene → canvas internals).
let state = { active: false, position: null, target: null };

export function setChamberFocus(position, target) {
  state = { active: true, position, target };
}

export function clearChamberFocus() {
  state = { active: false, position: null, target: null };
}

export function getChamberFocus() {
  return state;
}
