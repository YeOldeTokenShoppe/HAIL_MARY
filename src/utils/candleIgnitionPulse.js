// Shared ignition signal between the candle altar and the holographic
// statue. The altar fires `fireCandleIgnitionPulse()` on every unlit→lit
// transition; the statue's useFrame reads `getCandleIgnitionMs()` each
// frame and briefly boosts its rim shell + halo glow uIntensity so the
// statue visibly acknowledges the lighting moment.
//
// A module-level timestamp avoids prop-drilling through StarfieldStatueScene
// (the altar and statue are siblings in the R3F scene tree, not parent/
// child). Mirrors the existing _cctvState pattern in Pumpjack.
let lastIgnitionMs = 0;

export function fireCandleIgnitionPulse() {
  if (typeof performance === "undefined") return;
  lastIgnitionMs = performance.now();
}

export function getCandleIgnitionMs() {
  return lastIgnitionMs;
}
