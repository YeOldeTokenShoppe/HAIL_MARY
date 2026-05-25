"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const NOISE_VERT = `
varying vec2 vUv;
varying vec3 vPos;
void main() {
  vUv = uv;
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const NOISE_FRAG = `
#define PI 3.14159265358979323846
uniform float time;
uniform float scale;
uniform vec3 palette[8];
varying vec2 vUv;
varying vec3 vPos;

vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1. + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

void main() {
  float n = (snoise(vec3(vPos * scale + time)) + 1.0) / 2.0;
  float light = (1.0 - cos(n * 15.0 * 2.0 * PI)) * 0.5;
  float t = clamp(light, 0.0, 0.9999) * 7.0;
  int idx = int(floor(t));
  float frac = fract(t);
  vec3 fg = mix(palette[idx], palette[idx + 1], frac);
  gl_FragColor = vec4(fg, 1.0);
}`;

const PALETTE = [
  new THREE.Vector3(0.165, 0.043, 0.176),
  new THREE.Vector3(0.851, 0.176, 0.690),
  new THREE.Vector3(0.831, 0.686, 0.216),
  new THREE.Vector3(0.165, 0.839, 0.933),
  new THREE.Vector3(0.831, 0.686, 0.216),
  new THREE.Vector3(0.851, 0.176, 0.690),
  new THREE.Vector3(0.165, 0.043, 0.176),
  new THREE.Vector3(0.165, 0.839, 0.933),
];

function Sphere() {
  const meshRef = useRef();
  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      scale: { value: 1.0 },
      palette: { value: PALETTE },
    }),
    []
  );

  useFrame((_, delta) => {
    uniforms.time.value += delta * 0.08;
    meshRef.current.rotation.y += delta * 0.15;
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.6, 64, 64]} />
      <shaderMaterial
        vertexShader={NOISE_VERT}
        fragmentShader={NOISE_FRAG}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export default function NoiseSphere({ className }) {
  return (
    <div className={className} style={{ width: "100%", aspectRatio: "1" }}>
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <Sphere />
      </Canvas>
    </div>
  );
}
