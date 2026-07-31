// Which class of device is this, for budgeting purposes?
//
// NOT a width check and NOT a UA sniff: iPadOS Safari reports a desktop user
// agent at a desktop width, which is exactly how an iPad Pro ended up taking
// /trade's full desktop path (unclamped DPR, every painter at desktop cadence).
// Pointer type is what actually correlates with the GPU and memory budget.
//
// Measured on an iPad Pro, /trade was spending ~100 MB/s pushing 2D canvases
// into GPU textures from a dozen independent, uncoordinated timers — the
// clumping showed up as frame-time spikes rather than a lower average.

let cached = null;

/** True for phones and tablets — anything driven by a finger. */
export function isTouchDevice() {
  if (cached !== null) return cached;
  if (typeof window === 'undefined') return false; // SSR: assume desktop
  const coarse = typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false;
  const touch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints || 0) > 1;
  cached = coarse && touch;
  return cached;
}

/**
 * Pick a value per tier. `touch` is what a finger-driven device gets.
 *
 *   const fps = tierValue({ desktop: 30, touch: 12 });
 */
export function tierValue({ desktop, touch }) {
  return isTouchDevice() ? touch : desktop;
}
