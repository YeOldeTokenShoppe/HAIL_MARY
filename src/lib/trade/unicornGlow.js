// Shared glow level (0..1) bridging the Unicorn's audio analyser
// (playUnicornBeat) to the horn/aura emissive in CyborgTempleScene.
//
// playUnicornBeat writes via setUnicornGlow; the scene's useFrame reads
// unicornGlow.value each frame. A plain module singleton (NOT React state), so
// the rapid per-frame writes never trigger re-renders.
//
// Wire it: pass `setGlow: setUnicornGlow` into playUnicornBeat's hooks.

export const unicornGlow = { value: 0 };

export function setUnicornGlow(v) {
  unicornGlow.value = Math.max(0, Math.min(1, Number(v) || 0));
}
