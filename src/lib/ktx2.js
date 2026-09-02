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
  if (!_loader) _loader = new KTX2Loader().setTranscoderPath("/basis/");
  return _loader;
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
