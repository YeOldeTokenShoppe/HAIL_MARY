import * as THREE from "three";

// HOLOGRAPHIC TREATMENT FOR THE PITCH BOT.
//
// The look is lifted from HolographicStatue3 — fresnel rim, travelling
// scanlines, cyan tint, additive glow — but NOT the implementation, and the
// reason is load-bearing:
//
//   HolographicStatue3 assigns a raw ShaderMaterial whose vertex shader does
//   `modelMatrix * vec4(position, 1.0)` with NO skinning chunks. The statue can
//   afford that because its motion is object-level (hover / rotate). The pitch
//   bot's body is a SkinnedMesh with a 50-joint skeleton, so the same material
//   would render it FROZEN IN BIND POSE while the mixer happily drove the bones
//   — animation silently gone, no error anywhere.
//
// So we patch the existing MeshStandardMaterial through onBeforeCompile instead.
// three keeps every chunk it already generated — skinning, normals, fog — and we
// only add appearance on top. That is also why this survives a three upgrade
// better than a hand-written vertex shader would.
//
// TWO DELIBERATE DEPARTURES FROM THE STATUE:
//
//   1. depthTest STAYS ON. The statue floats in open air above the altar and
//      draws over everything. The bot stands among desks and monitors — with
//      depthTest off it shows straight through them.
//   2. THE FACE SHIELD IS EXCLUDED BY DEFAULT. That plate is the display for
//      pressure() (four bands, four textures), and dissolving it into the same
//      cyan wash as the body is how you lose the one surface that has to read as
//      a screen. It keeps its own emissive material.

export const PITCH_BOT_HOLO = {
  color: 0x66f7ff,   // matches HologramCard's projector cyan
  tint: 0.72,        // 0 = original albedo, 1 = pure cyan
  glow: 1.35,        // fresnel rim strength
  scan: 9.0,         // scanline frequency
  scanSpeed: 0.35,   // scanline drift
  opacity: 0.88,
  floor: 0.22,       // minimum alpha, so the silhouette never fully vanishes
  /** Material names that keep their own look. The face plate is the pressure
   *  display; see the note above. */
  exclude: ["lambert2.003"],
};

const registry = [];

/** Clear the registry. Call on unmount, or stale uniforms tick forever. */
export function disposePitchBotHolo() {
  registry.length = 0;
}

/**
 * Turn a loaded pitch-bot into a projection.
 *
 * @param root the loaded gltf.scene (bot + easel + page — all of it)
 * @param cfg  overrides for PITCH_BOT_HOLO
 * @returns how many materials were patched
 */
export function applyPitchBotHolo(root, cfg = {}) {
  const o = { ...PITCH_BOT_HOLO, ...cfg };
  const color = new THREE.Color(o.color);
  let patched = 0;

  root.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const mats = Array.isArray(node.material) ? node.material : [node.material];

    const next = mats.map((src) => {
      if (o.exclude.includes(src.name)) return src;

      // CLONE, so the easel and the body can diverge later and so we never
      // mutate a material the temple model might share. Then SCRUB userData:
      // Material.clone() JSON-round-trips userData, and a Texture living in
      // there comes back as a plain object that crashes on the next frame.
      // (Documented gotcha in this repo — it has bitten before.)
      const m = src.clone();
      m.userData = {};

      m.transparent = true;
      m.depthWrite = false;   // transparent additive-ish surfaces shouldn't occlude
      m.depthTest = true;     // ...but they must still be occluded BY the desks
      m.side = THREE.DoubleSide;
      m.opacity = o.opacity;

      m.onBeforeCompile = (shader) => {
        shader.uniforms.uHoloTime = { value: 0 };
        shader.uniforms.uHoloColor = { value: color };
        shader.uniforms.uHoloTint = { value: o.tint };
        shader.uniforms.uHoloGlow = { value: o.glow };
        shader.uniforms.uHoloScan = { value: o.scan };
        shader.uniforms.uHoloScanSpeed = { value: o.scanSpeed };
        shader.uniforms.uHoloFloor = { value: o.floor };

        shader.fragmentShader = shader.fragmentShader.replace(
          "void main() {",
          `uniform float uHoloTime;
           uniform vec3  uHoloColor;
           uniform float uHoloTint;
           uniform float uHoloGlow;
           uniform float uHoloScan;
           uniform float uHoloScanSpeed;
           uniform float uHoloFloor;
           void main() {`,
        );

        // Appended at the very END of the fragment program, so every lighting
        // chunk three generated has already run and we are only re-grading the
        // result. `vViewPosition` and `normal` are both in scope here for
        // MeshStandardMaterial.
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <dithering_fragment>",
          `#include <dithering_fragment>
           {
             vec3 vDir = normalize(vViewPosition);
             float fres = 1.0 - abs(dot(normalize(normal), vDir));
             fres = pow(clamp(fres, 0.0, 1.0), 1.6);
             float stripes = pow(
               mod((-vViewPosition.y + uHoloTime * uHoloScanSpeed) * uHoloScan, 1.0),
               2.5);
             gl_FragColor.rgb = mix(gl_FragColor.rgb, uHoloColor, uHoloTint);
             gl_FragColor.rgb += uHoloColor * fres * uHoloGlow * 0.55;
             gl_FragColor.a *= clamp(
               max(uHoloFloor, fres * uHoloGlow + stripes * 0.3), 0.0, 1.0);
           }`,
        );

        registry.push(shader.uniforms);
      };

      m.needsUpdate = true;
      patched += 1;
      return m;
    });

    node.material = Array.isArray(node.material) ? next : next[0];
  });

  return patched;
}

/** Drive the scanlines. Call once per frame with elapsed seconds. */
export function tickPitchBotHolo(elapsed) {
  for (let i = 0; i < registry.length; i++) {
    const u = registry[i];
    if (u.uHoloTime) u.uHoloTime.value = elapsed;
  }
}
