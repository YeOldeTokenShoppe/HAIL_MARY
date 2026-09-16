import * as THREE from 'three';

// Heart2 is a flat Synty heart sprite, so it has no real facets to catch light. This overlay
// shares its quad and adds a gem glint on top: a shine band sweeping corner to corner (brighter
// over the painted light facets) followed by star twinkles on the painted highlights, all masked
// by the sprite's alpha. Callers put the returned overlay on the bloom layer so only the glint flares.

// Painted highlight centres in glTF UV space (v runs down from the top of the sprite image).
const TWINKLE_UVS = [
  new THREE.Vector2(0.395, 0.23),  // left lobe, top facet
  new THREE.Vector2(0.699, 0.246), // right lobe, top facet
  new THREE.Vector2(0.496, 0.723), // lower centre facet
];

export function createHeartSparkle(heart, { time, glintStart = 0, period = 3 }) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      heartMap: { value: heart.material.map },
      sparkleTime: time,
      glintStart: { value: glintStart },
      glintPeriod: { value: period },
      twinkleA: { value: TWINKLE_UVS[0] },
      twinkleB: { value: TWINKLE_UVS[1] },
      twinkleC: { value: TWINKLE_UVS[2] },
    },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D heartMap;
      uniform float sparkleTime;
      uniform float glintStart;
      uniform float glintPeriod;
      uniform vec2 twinkleA;
      uniform vec2 twinkleB;
      uniform vec2 twinkleC;
      varying vec2 vUv;

      const float SWEEP_SECONDS = 0.6;

      // 0 at the heart's upper-left, ~1 at its lower-right.
      float along(vec2 uv) { return dot(uv - vec2(0.13), vec2(0.781, 0.625)); }

      float twinkle(vec2 uv, vec2 centre, float t) {
        float popAt = (along(centre) + 0.15) / 1.3 * SWEEP_SECONDS + 0.05; // just after the band passes
        float age = t - popAt;
        float life = smoothstep(0.0, 0.05, age) * (1.0 - smoothstep(0.05, 0.45, age));
        vec2 d = (uv - centre) / 0.08;
        float rays = max(0.0, 1.0 - abs(d.x * d.y) * 24.0) * (1.0 - smoothstep(0.1, 1.0, length(d)));
        float core = exp(-dot(d, d) * 40.0);
        return (rays + core) * life;
      }

      void main() {
        vec4 sprite = texture2D(heartMap, vUv);
        float t = mod(sparkleTime - glintStart, glintPeriod);
        float head = t / SWEEP_SECONDS * 1.3 - 0.15;
        float band = (along(vUv) - head) / 0.05;
        float facet = smoothstep(0.1, 0.6, dot(sprite.rgb, vec3(0.2126, 0.7152, 0.0722)));
        float shine = exp(-band * band) * (0.25 + 0.75 * facet);
        float stars = twinkle(vUv, twinkleA, t) + twinkle(vUv, twinkleB, t) + twinkle(vUv, twinkleC, t);
        gl_FragColor = vec4(vec3(1.0, 0.92, 0.95) * (0.9 * shine + 1.6 * stars) * sprite.a, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: heart.material.side,
  });
  const overlay = new THREE.Mesh(heart.geometry, material);
  overlay.name = `${heart.name}Sparkle`;
  overlay.renderOrder = heart.renderOrder + 1;
  heart.add(overlay);
  return overlay;
}
