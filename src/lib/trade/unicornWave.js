// Bridge to fire Eugene's one-shot greeting wave from the /trade page.
//
// The wave animation lives in CyborgTempleScene, but WHICH greeting line Eugene
// speaks is decided in the page (EUGENE_LOBBY_GREETINGS). So the scene registers
// a player here on mount, and the page calls triggerUnicornWave() only when it
// speaks a literal "hello" greeting — keeping the wave tied to the words rather
// than firing on every focus click. A plain module singleton (matches
// unicornGlow), so there's no React wiring or re-renders.

let _play = null;

// CyborgTempleScene calls this on mount with its wave-playing fn; returns an
// unregister for cleanup.
export function registerUnicornWave(fn) {
  _play = fn;
  return () => { if (_play === fn) _play = null; };
}

// The page calls this when Eugene greets with a wave line. No-op if the scene
// hasn't registered yet (e.g. still loading).
export function triggerUnicornWave() {
  if (typeof _play === 'function') _play();
}
