import React, { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

/* ────────────────────────────────────────────────────────────
   FluidNeonSphere — Fluid neon fractal shader mapped onto a
   sphere, auto-positioned above the Table in SpaceScene
   (same placement strategy as HologooR3F).

   The shader is adapted from a 2D fullscreen CodePen by
   sabosugi. Instead of screen-space coords it uses the
   sphere's UV → spherical mapping so the effect wraps
   seamlessly around the geometry.
   ──────────────────────────────────────────────────────────── */

const VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uBgColor;
  uniform float uSpeed;
  uniform float uComplexity;
  uniform float uDensity;
  uniform float uIntensity;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPos;

  mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
  }

  void main() {
    // Map sphere UVs to centered coordinates (-1..1 range)
    vec2 p = (vUv - 0.5) * 2.0;

    vec3 finalColor = vec3(0.0);
    float time = uTime * uSpeed * 0.5;

    p *= rot(0.2);

    // Iterative fractal fluid
    float iterations = floor(uComplexity);
    for (float i = 1.0; i <= 20.0; i++) {
      if (i > iterations) break;

      p *= rot(sin(time * 0.05) * 0.1 + 0.08);

      vec2 q = p;
      float dist = length(p);
      q *= rot(dist * uDensity * 0.25 - time * 0.3);

      float freq = uDensity * 0.8;

      q.x += sin(q.y * freq + time * 0.5 + i * 0.15) * 0.5;
      q.y += cos(q.x * freq - time * 0.5 - i * 0.15) * 0.5;

      vec2 r = q;
      r.x += sin(q.y * freq * 2.0 - time * 0.8) * 0.25;
      r.y += cos(q.x * freq * 2.0 + time * 0.8) * 0.25;

      float wave = sin(r.x * freq * 1.5 + time) * 0.6
                 + cos(r.y * freq * 0.5 - time * 0.7) * 0.4;

      float d = abs(r.y - wave);

      float core = 0.005 / max(d, 0.002);
      float soft1 = exp(-d * 8.0) * 0.6;
      float soft2 = exp(-d * 2.0) * 0.2;

      float mixFactor = sin(r.x * 3.0 + r.y * 2.0 + time + i * 1.6) * 0.5 + 0.5;
      vec3 layerColor = mix(uColor1, uColor2, mixFactor);

      float attenuation = 1.0 / (i * 0.6 + 1.0);
      finalColor += layerColor * (core + soft1 + soft2) * uIntensity * attenuation * 30.0;

      p = r * 1.05;
    }

    // Background tint
    finalColor += uBgColor * 0.5;

    // Fresnel rim glow — makes the sphere edges pop
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = 1.0 - abs(dot(viewDir, vNormal));
    fresnel = pow(fresnel, 2.5);
    finalColor += mix(uColor1, uColor2, 0.5) * fresnel * 0.6;

    // ACES tone mapping
    finalColor = finalColor * (2.51 * finalColor + 0.03)
               / (finalColor * (2.43 * finalColor + 0.59) + 0.14);

    // Alpha: let the fluid glow drive opacity, with fresnel rim
    float alpha = clamp(length(finalColor) * 0.8 + fresnel * 0.4, 0.0, 1.0);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export default function FluidNeonSphere({
  color1 = "#0055ff",
  color2 = "#ff00aa",
  bgColor = "#05030a",
  speed = 0.3,
  complexity = 8,
  density = 3.2535,
  intensity = 0.03758,
  sphereRadius = 0.5,
  sizeScale = 0.25,
  heightOffset = 0.55,
}) {
  const groupRef = useRef();
  const matRef = useRef();
  const tableFoundRef = useRef(false);
  const { scene } = useThree();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uColor1: { value: new THREE.Color(color1) },
      uColor2: { value: new THREE.Color(color2) },
      uBgColor: { value: new THREE.Color(bgColor) },
      uSpeed: { value: speed },
      uComplexity: { value: complexity },
      uDensity: { value: density },
      uIntensity: { value: intensity },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Find Table and auto-position (same approach as HologooR3F)
  useEffect(() => {
    if (tableFoundRef.current) return;
    const findTable = () => {
      const table = scene.getObjectByName("Table");
      if (!table || !groupRef.current) return false;
      scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(table);
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      const tableTop = box.max.y;
      const tableRadius = Math.max(size.x, size.z) * 0.5;

      groupRef.current.position.set(
        center.x,
        tableTop + tableRadius * heightOffset,
        center.z
      );
      const groupScale = tableRadius * 2 * sizeScale;
      groupRef.current.scale.setScalar(groupScale);

      tableFoundRef.current = true;
      return true;
    };
    if (!findTable()) {
      const interval = setInterval(() => {
        if (findTable()) clearInterval(interval);
      }, 500);
      return () => clearInterval(interval);
    }
  }, [scene, sizeScale, heightOffset]);

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[sphereRadius, 64, 64]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={VERT}
          fragmentShader={FRAG}
          uniforms={uniforms}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
