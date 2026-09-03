"use client";
// Shared KTX2 / Basis Universal transcoder for GLBs that carry
// KHR_texture_basisu (the mobile-memory optimization: ETC1S/UASTC textures
// stay GPU-compressed instead of decoding to full RGBA, ~4× less GPU memory —
// the fix for iOS Safari killing the tab on texture memory).
//
// Usage:
//   - Call ensureKTX2Support(gl) once inside the Canvas (a child's render is
//     fine) BEFORE any basisu texture transcodes, or KTX2Loader throws.
//   - Pass `extendKTX2` as useGLTF's 4th arg on every call that may load a
//     KTX2 GLB. Harmless on plain GLBs — the GLTFLoader only reaches for the
//     transcoder when a texture actually uses the basisu extension.
import { KTX2Loader } from "three-stdlib";
import { useThree } from "@react-three/fiber";

let _loader = null;
let _supported = false;

export function getKTX2Loader() {
  // One transcoder worker, not the default four. Each worker carries its own
  // wasm heap, and measured in the Safari engine at iPad size the default pool
  // put the KTX2 strip ≈174 MB ABOVE the webp build in the page process while
  // saving ≈99 MB in the GPU process — the wrong direction for iPadOS, which
  // judges the page process. With one worker, released after the strip loads
  // (releaseKTX2Workers), the same measurement came out at parity in the page
  // process (1256 vs 1258 MB) and ≈95 MB lighter in the GPU process. The strip
  // is the only KTX2 asset, and one worker transcodes its 14 textures in well
  // under a second.
  if (!_loader) _loader = new KTX2Loader().setTranscoderPath("/basis/").setWorkerLimit(1);
  return _loader;
}

// Terminate the transcoder worker (and drop its wasm heap) once the only KTX2
// asset is in. A later KTX2 load re-creates the worker on demand.
export function releaseKTX2Workers() {
  if (!_loader) return;
  try { _loader.dispose(); } catch {}
}

// detectSupport reads the renderer's compressed-texture caps. Idempotent and
// synchronous, so it's safe to call every render — the guard makes it a no-op
// after the first success.
export function ensureKTX2Support(gl) {
  if (_supported || !gl) return;
  try { getKTX2Loader().detectSupport(gl); _supported = true; } catch {}
}

export function extendKTX2(loader) {
  loader.setKTX2Loader(getKTX2Loader());
}

// Mount as the FIRST child inside the Canvas so detectSupport runs before the
// GLB Suspense boundaries resolve. Renders nothing.
export function KTX2Init() {
  const gl = useThree((s) => s.gl);
  ensureKTX2Support(gl);
  return null;
}
