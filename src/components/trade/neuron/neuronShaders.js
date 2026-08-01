// GLSL for the Neural Cathedral channel (see MobileNeuron.jsx).
//
// Ported from the "Bioelectric consciousness engine" CodePen by Techartist,
// MIT licensed: https://codepen.io/VoXelo/pen/xbgpJre
// Copyright (c) 2026 Techartist. The MIT notice ships in LICENSE-neuron.txt
// next to this file.
//
// The shaders are carried over verbatim — they're the value in the original —
// and the mobile work is all on the JS side (tessellation, blending, bloom
// resolution, container scoping). Kept in their own module so the component
// reads as structure rather than a wall of GLSL.

// Ashima simplex noise. Four call sites total across all four shaders, only one
// of them per-fragment (the branch flow), which is why this scene is far
// cheaper than its look suggests.
export const shaderNoise = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
      const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy) );
      vec3 x0 = v - i + dot(i, C.xxx) ;
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute( permute( permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
      float n_ = 0.142857142857;
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
  }
`;

export const somaVertex = /* glsl */ `
  ${shaderNoise}
  uniform float uTime;
  uniform int uPhase;
  uniform float uProgress;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vNoise;

  void main() {
      vec3 pos = position;
      float noise = snoise(pos * 0.5 + uTime * 0.3) * 0.5;
      float burst = 0.0;
      if(uPhase == 2) {
          burst = sin(uProgress * 3.14159) * 0.4;
      }
      pos += normal * (noise + burst);
      vNoise = noise;
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
  }
`;

export const somaFragment = /* glsl */ `
  uniform int uPhase;
  uniform float uProgress;
  uniform float uTime;

  uniform vec3 uColCyan;
  uniform vec3 uColBlue;
  uniform vec3 uColGold;
  uniform vec3 uColMagenta;

  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying float vNoise;

  void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.5);
      vec3 color = mix(uColBlue * 0.2, uColCyan, fresnel);
      color += uColCyan * (vNoise * 0.5 + 0.5) * 0.3;
      if(uPhase == 2) {
          float intensity = sin(uProgress * 3.14159);
          color = mix(color, uColGold * 2.0 + uColCyan, intensity * fresnel * 2.0);
          color += uColGold * intensity * (1.0 - fresnel);
      } else if(uPhase == 4) {
          float intensity = 1.0 - uProgress;
          color = mix(color, uColMagenta, intensity * fresnel * 1.5);
      }
      gl_FragColor = vec4(color, 0.8 * fresnel + 0.2);
  }
`;

export const branchVertex = /* glsl */ `
  ${shaderNoise}
  uniform float uTime;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;

  void main() {
      vUv = uv;
      vec3 pos = position;
      float wiggle = snoise(pos * 0.2 + uTime * 0.5) * 0.1;
      pos += normal * wiggle;
      vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
      vWorldPos = worldPosition.xyz;
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = viewMatrix * worldPosition;
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
  }
`;

export const branchFragment = /* glsl */ `
  ${shaderNoise}
  uniform float uTime;
  uniform int uPhase;
  uniform float uProgress;
  uniform int uIsAxon;

  uniform vec3 uColCyan;
  uniform vec3 uColBlue;
  uniform vec3 uColGold;
  uniform vec3 uColOrange;
  uniform vec3 uColMagenta;
  uniform vec3 uColViolet;

  uniform float uSomaRadius;
  uniform float uMaxDistDendrite;
  uniform float uMaxDistAxon;

  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  varying vec2 vUv;

  void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      float edge = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 2.0);
      float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.0);
      float dist = length(vWorldPos);
      vec3 baseColor = mix(uColBlue * 0.1, uColCyan * 0.5, fresnel * edge);
      vec3 pulseColor = vec3(0.0);
      float flowNoise = snoise(vec3(vUv.x * 20.0 - uTime * 2.0, vUv.y * 10.0, uTime)) * 0.5 + 0.5;
      float axialFlow = 0.65 + 0.35 * sin(vUv.x * 34.0 - uTime * 8.0);
      if (uIsAxon == 0) {
          if (uPhase == 1) {
              float currentWaveDist = mix(uMaxDistDendrite, uSomaRadius, uProgress);
              float head = 1.0 - smoothstep(0.0, 2.3, abs(dist - currentWaveDist));
              float outerTrail = step(currentWaveDist, dist) * exp(-(dist - currentWaveDist) * 0.18);
              float mergeGlow = (1.0 - smoothstep(uSomaRadius, uSomaRadius + 8.0, dist)) * smoothstep(0.65, 1.0, uProgress);
              float pulse = max(head * 1.6, outerTrail * 0.65) + mergeGlow * 0.8;
              pulseColor = uColGold * pulse * flowNoise * axialFlow * 3.2;
          }
      } else {
          if (uPhase == 3) {
              float currentWaveDist = mix(uSomaRadius, uMaxDistAxon + 18.0, uProgress);
              float head = 1.0 - smoothstep(0.0, 3.4, abs(dist - currentWaveDist));
              float innerTrail = step(dist, currentWaveDist) * exp(-(currentWaveDist - dist) * 0.1);
              float somaLaunch = (1.0 - smoothstep(uSomaRadius, uSomaRadius + 7.0, dist)) * (1.0 - smoothstep(0.0, 0.28, uProgress));
              float pulse = max(head * 2.0, innerTrail * 0.9) + somaLaunch * 1.2;
              pulseColor = (uColOrange + uColGold * 0.45) * pulse * flowNoise * axialFlow * 4.6;
          }
      }
      if (uPhase == 4) {
          float intensity = 1.0 - uProgress;
          pulseColor += uColViolet * intensity * edge * 1.5;
      }
      gl_FragColor = vec4(baseColor + pulseColor, 1.0);
  }
`;

export const synapseVertex = /* glsl */ `
  attribute float aSize;
  uniform float uTime;
  varying float vSize;
  void main() {
      vSize = aSize;
      vec3 pos = position;
      pos.y += sin(uTime * 2.0 + pos.x) * 0.5;
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = (20.0 + aSize * 15.0) * (100.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
  }
`;

export const synapseFragment = /* glsl */ `
  uniform int uPhase;
  uniform float uProgress;
  uniform vec3 uColCyan;
  uniform vec3 uColGold;
  uniform vec3 uColMagenta;
  varying float vSize;

  void main() {
      vec2 coord = gl_PointCoord - vec2(0.5);
      float dist = length(coord);
      if (dist > 0.5) discard;
      float alpha = (0.5 - dist) * 2.0;
      vec3 color = uColCyan * 0.5;
      if (uPhase == 1 || uPhase == 3) {
          float spark = step(0.8, fract(vSize * 10.0 + uProgress * 5.0));
          color = mix(color, uColGold, spark * 2.0);
      } else if (uPhase == 4) {
          color = mix(color, uColMagenta, (1.0 - uProgress));
      }
      gl_FragColor = vec4(color, alpha);
  }
`;
