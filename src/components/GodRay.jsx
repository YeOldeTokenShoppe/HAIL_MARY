import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GodrayBuilder } from "./GodRayBuilder";

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormalWorld;
  varying vec3 vPositionWorld;
  varying vec3 vNormalLocal;

  void main() {
    vUv = uv;
    vNormalLocal = normal;
    vNormalWorld = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vPositionWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uNoiseScale;
  uniform vec3 uColor;
  uniform float uTimeSpeed;
  uniform float uSmoothTop;
  uniform float uSmoothBottom;
  uniform float uFresnelPower;

  varying vec2 vUv;
  varying vec3 vNormalWorld;
  varying vec3 vPositionWorld;
  varying vec3 vNormalLocal;

  // Worley noise (cellular noise)
  vec3 hash3(vec3 p) {
    p = vec3(
      dot(p, vec3(127.1, 311.7, 74.7)),
      dot(p, vec3(269.5, 183.3, 246.1)),
      dot(p, vec3(113.5, 271.9, 124.6))
    );
    return fract(sin(p) * 43758.5453123);
  }

  float worley(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    float minDist = 1.0;
    for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <= 1; y++) {
        for (int z = -1; z <= 1; z++) {
          vec3 neighbor = vec3(float(x), float(y), float(z));
          vec3 point = hash3(i + neighbor);
          vec3 diff = neighbor + point - f;
          float dist = length(diff);
          minDist = min(minDist, dist);
        }
      }
    }
    return minDist;
  }

  void main() {
    // Animated noise based on local normal
    vec3 noiseCoord = vNormalLocal * uNoiseScale + uTime * uTimeSpeed;
    float noise = worley(noiseCoord);

    // Vertical smooth falloff
    float smoothFade = smoothstep(0.0, uSmoothBottom, vUv.y)
                     * smoothstep(1.001, uSmoothTop, vUv.y);

    // Fresnel — more transparent when facing camera, visible at edges
    vec3 viewDir = normalize(cameraPosition - vPositionWorld);
    float fresnel = pow(abs(dot(vNormalWorld, viewDir)), uFresnelPower);

    float alpha = noise * fresnel * smoothFade;

    gl_FragColor = vec4(uColor, alpha);
  }
`;

export const Godray = ({ settings = {}, debug = false, ...props }) => {
  const [
    {
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      color: godrayColor = "white",
      timeSpeed = 0.01,
      noiseScale = 5,
      topRadius = 1,
      bottomRadius = 3,
      height = 10,
      smoothBottom = 0.1,
      smoothTop = 0.9,
      fresnelPower = 5,
    },
    setSettings,
  ] = useState(settings);

  const materialRef = useRef();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uNoiseScale: { value: noiseScale },
      uColor: { value: new THREE.Color(godrayColor) },
      uTimeSpeed: { value: timeSpeed },
      uSmoothTop: { value: smoothTop },
      uSmoothBottom: { value: smoothBottom },
      uFresnelPower: { value: fresnelPower },
    }),
    []
  );

  useEffect(() => {
    if (!materialRef.current) return;
    const u = materialRef.current.uniforms;
    u.uNoiseScale.value = noiseScale;
    u.uTimeSpeed.value = timeSpeed;
    u.uSmoothTop.value = smoothTop;
    u.uSmoothBottom.value = smoothBottom;
    u.uFresnelPower.value = fresnelPower;
    if (godrayColor) u.uColor.value.set(godrayColor);
  }, [noiseScale, godrayColor, timeSpeed, smoothTop, smoothBottom, fresnelPower]);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
    }
  });

  return (
    <>
      {debug && <GodrayBuilder settings={settings} onChange={setSettings} />}
      <mesh {...props} position={position} rotation={rotation}>
        <cylinderGeometry args={[topRadius, bottomRadius, height, 64, 1, true]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
};
