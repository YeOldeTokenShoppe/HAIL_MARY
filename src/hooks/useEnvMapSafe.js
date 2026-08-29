"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

// Locally-bundled replacements for drei's Environment presets. Drei resolves
// preset names to HDR files fetched from its asset CDN at runtime, and a
// failed fetch throws through Suspense and takes down the whole canvas
// ("Application error: a client-side exception has occurred") — observed on
// /hailmary whenever the connection hiccups mid-load. These are the exact
// files those presets resolve to, served from /public instead.
const PRESET_FILES = {
  sunset: "/hdr/venice_sunset_1k.hdr",
  warehouse: "/hdr/empty_warehouse_01_1k.hdr",
};

// preset name → loaded texture; module-level so theme flips and canvas
// remounts reuse the texture instead of re-reading the file.
const cache = new Map();

// Drop-in replacement for drei's `useEnvironment({ preset })`, loading
// imperatively (no Suspense — house style, same as ParabolumMoon's texture)
// and NEVER throwing: until the HDR arrives — or forever, if it can't — this
// returns null, and materials simply render without reflections. Every
// consumer already tolerates a null envMap.
export default function useEnvMapSafe(preset) {
  const [tex, setTex] = useState(() => cache.get(preset) ?? null);
  useEffect(() => {
    let alive = true;
    const cached = cache.get(preset);
    if (cached) { setTex(cached); return undefined; }
    const url = PRESET_FILES[preset];
    if (!url) { setTex(null); return undefined; }
    new RGBELoader().load(
      url,
      (t) => {
        t.mapping = THREE.EquirectangularReflectionMapping;
        cache.set(preset, t);
        if (alive) setTex(t);
      },
      undefined,
      (err) => {
        // Reflections are a garnish — warn and carry on matte rather than crash.
        console.warn(`useEnvMapSafe: "${preset}" env map failed to load (${url})`, err);
        if (alive) setTex(null);
      }
    );
    return () => { alive = false; };
  }, [preset]);
  return tex;
}
