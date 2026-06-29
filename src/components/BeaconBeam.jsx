import React, { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// Visible "broadcast beam" rendered as a mesh. The drei SpotLight volumetric
// is too faint to read against the dark scene, so this gives a reliable,
// tunable shaft: a soft additive cone — narrow at the beacon, flaring upward —
// that fades toward the top with a gentle upward energy flow. Follows the
// beacon via `anchorRef` so it stays aligned even when the GLB moves it.
//
// Tunables (all live-editable as props from CyborgTempleScene):
//   color, height, topRadius (flare at top), bottomRadius (at the beacon),
//   opacity. All lengths are in the parent group's local units.
function BeaconBeam({
  anchorRef,
  color = "#35e8ff",
  height = 1.8,
  topRadius = 0.35,
  bottomRadius = 0.05,
  opacity = 0.5,
  yOffset = 0,
}) {
  const meshRef = useRef();
  const tmp = useRef(new THREE.Vector3());

  const geometry = useMemo(
    () => new THREE.CylinderGeometry(topRadius, bottomRadius, height, 36, 1, true),
    [topRadius, bottomRadius, height]
  );

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vNormalW;
          varying vec3 vWorld;
          void main() {
            vUv = uv;
            vNormalW = normalize(mat3(modelMatrix) * normal);
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorld = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uOpacity;
          varying vec2 vUv;
          varying vec3 vNormalW;
          varying vec3 vWorld;
          void main() {
            // uv.y: 0 at the beacon (bottom), 1 at the top.
            float topFade = 1.0 - smoothstep(0.65, 1.0, vUv.y);
            float botFade = smoothstep(0.0, 0.05, vUv.y);
            float vfade = topFade * botFade;
            // Soften the open-cylinder silhouette so there's no hard rim —
            // keep the face-on center brighter than the grazing edges.
            vec3 viewDir = normalize(cameraPosition - vWorld);
            float facing = abs(dot(viewDir, normalize(vNormalW)));
            float edge = mix(0.3, 1.0, facing);
            // Gentle upward energy flow.
            float flow = 0.85 + 0.15 * sin(vUv.y * 16.0 - uTime * 2.5);
            float a = vfade * edge * uOpacity * flow;
            gl_FragColor = vec4(uColor, a);
          }
        `,
      }),
    []
  );

  // Keep uniforms in sync with props without rebuilding the material.
  useEffect(() => {
    material.uniforms.uColor.value.set(color);
    material.uniforms.uOpacity.value = opacity;
  }, [material, color, opacity]);

  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    const m = meshRef.current;
    if (!m) return;
    if (anchorRef?.current && m.parent) {
      m.visible = true;
      anchorRef.current.getWorldPosition(tmp.current);
      m.parent.worldToLocal(tmp.current);
      // Cylinder is centered on its origin, so lift it by height/2 to seat the
      // narrow (bottom) end on the beacon.
      m.position.set(tmp.current.x, tmp.current.y + height / 2 + yOffset, tmp.current.z);
    } else {
      // Hide until the beacon is captured so it doesn't flash at the origin.
      m.visible = false;
    }
  });

  return <mesh ref={meshRef} geometry={geometry} material={material} renderOrder={3} visible={false} />;
}

export default BeaconBeam;
