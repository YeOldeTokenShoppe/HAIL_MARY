"use client";
import { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// A swirling vortex portal: one unit plane carrying a procedural shader. The
// pattern is drawn in polar space — spiral arms twisted by log(r) so they
// tighten toward the core, value-noise wisps riding the rotation, a hot core
// and a soft, slightly ragged rim that fades to nothing. Opaque through the
// middle (it has to READ as a doorway to somewhere else, not a decal), so it
// uses normal blending over its own dark base rather than additive.
//
// Sized and placed by the parent (scale = [width, height, 1]); the geometry
// is a 1×1 plane whose normal is +Z before rotation.

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec3 uCore;
  uniform vec3 uMid;
  uniform vec3 uEdge;
  uniform float uArms;
  uniform float uTwist;
  uniform float uSpeed;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0)), c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { v += a * vnoise(p); p = p * 2.1 + 7.3; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float ang = atan(p.y, p.x);
    float t = uTime * uSpeed;

    // Spiral coordinate: angle advanced by log-radius so arms wind inward.
    float spiral = ang * uArms - log(r + 0.08) * uTwist + t;
    float arms = 0.5 + 0.5 * sin(spiral);
    arms = pow(arms, 2.4);
    // A second, finer set of arms interleaved with the first — density.
    float arms2 = pow(0.5 + 0.5 * sin(spiral * 2.0 + 1.7), 3.0);

    // Wisps that rotate with the arms and stretch radially as they fall in.
    vec2 np = vec2(ang * 1.5 + t * 0.35, log(r + 0.08) * 2.2 - t * 0.6);
    float wisps = fbm(np * 2.0);
    float detail = fbm(vec2(spiral * 0.5, r * 6.0 - t * 1.5));

    // Depth: brighter and hotter toward the core, deep at the rim.
    float core = smoothstep(0.55, 0.0, r);
    float glow = 0.12 / (r * r + 0.08);

    float energy = arms * (0.5 + 0.5 * wisps) + arms2 * 0.4 + detail * 0.18;
    energy = clamp(energy + glow * 0.3, 0.0, 1.6);

    vec3 col = mix(uEdge, uMid, smoothstep(1.0, 0.35, r));
    col = mix(col, uCore, core * (0.5 + 0.5 * arms));
    // Near-black between the arms so the bands read as dense, not a haze.
    col *= 0.1 + energy;
    col += uCore * glow * 0.6;

    // Soft rim, broken up by noise so the edge is ragged rather than a hard circle.
    float rim = 1.0 - 0.08 * fbm(vec2(ang * 3.0 + t * 0.2, r * 4.0));
    float alpha = smoothstep(rim, rim - 0.2, r);
    alpha *= 0.94 + 0.06 * arms;

    gl_FragColor = vec4(col, alpha);
  }
`;

export default function VortexPortal({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
  core = "#ffe9ff",
  mid = "#d02fd8",
  edge = "#1a0433",
  arms = 3,
  twist = 5,
  speed = 1.2,
  renderOrder = 2,
}) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uCore: { value: new THREE.Color(core) },
      uMid: { value: new THREE.Color(mid) },
      uEdge: { value: new THREE.Color(edge) },
      uArms: { value: arms },
      uTwist: { value: twist },
      uSpeed: { value: speed },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  // Colours and shape are fixed per mount; live changes re-create the material.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [core, mid, edge, arms, twist, speed]);
  useEffect(() => () => material.dispose(), [material]);

  const ref = useRef();
  useFrame((_, dt) => { material.uniforms.uTime.value += Math.min(dt, 0.1); });

  return (
    <mesh ref={ref} position={position} rotation={rotation} scale={scale} material={material} renderOrder={renderOrder} frustumCulled>
      <planeGeometry args={[1, 1, 1, 1]} />
    </mesh>
  );
}
