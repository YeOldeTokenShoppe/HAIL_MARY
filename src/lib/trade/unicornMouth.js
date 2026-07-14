// Shared mouth-open level (0..1) bridging the Unicorn's audio analyser
// (playUnicornBeat) to her Jaw-bone rotation in CyborgTempleScene — the
// amplitude-driven "lip-sync" (Path A: jaw flap, no visemes, no Blender).
//
// Same pattern as [[unicornGlow]]: a plain module singleton (NOT React state)
// so the per-frame RMS writes never trigger re-renders. playUnicornBeat writes
// via setUnicornMouth; the scene's useFrame reads unicornMouth.value each frame
// and opens the Jaw bone by that fraction of its max angle.

export const unicornMouth = { value: 0 };

export function setUnicornMouth(v) {
  unicornMouth.value = Math.max(0, Math.min(1, Number(v) || 0));
}
