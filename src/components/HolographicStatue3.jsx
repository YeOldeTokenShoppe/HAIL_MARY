import React, { useEffect, useRef, useMemo, useState } from "react";
import { useLoader, useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import * as THREE from "three";

// Create DRACO loader once, outside the component
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("/draco/");

function HolographicStatue3({
  onLoad,
  position = [0, 1, 0],
  rotation = [0, 0, 0],
  scale = [17, 17, 17],
  hover = false,
  rotate = true,
}) {
  const groupRef = useRef();
  const rotationGroupRef = useRef();
  const mixerRef = useRef();
  const animatedMaterialsRef = useRef([]);
  const haloMasterRef = useRef();
  const initialY = useRef(position[1]);
  const hasInitializedRef = useRef(false);
  
  // Track if onLoad has been called to prevent double-firing
  const onLoadCalledRef = useRef(false);

  // Use R3F's useLoader - it handles caching and Suspense properly
  const gltf = useLoader(GLTFLoader, "/models/CyberpunkMaryHeartRed2.glb", (loader) => {
    loader.setDRACOLoader(dracoLoader);
  });

  // Clone the scene to avoid mutation issues with cached models
  const clonedScene = useMemo(() => {
    return gltf.scene.clone(true);
  }, [gltf]);

  // Memoize shader materials - these never need to change
  const holographicMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        precision: "lowp",
        uniforms: {
          uTime: { value: 0.0 },
          uColor: { value: new THREE.Color(0x00ffff) },
        },
        vertexShader: `
          uniform float uTime;
          varying vec3 vPosition;
          varying vec3 vNormal;
      
          vec2 random2D(vec2 st) {
            st = vec2(dot(st, vec2(127.1, 311.7)),
                     dot(st, vec2(269.5, 183.3)));
            return -1.0 + 2.0 * fract(sin(st) * 43758.5453123);
          }

          void main() {
            vec4 modelPosition = modelMatrix * vec4(position, 1.0);

            float glitchTime = uTime - modelPosition.y;
            float glitchStrength = sin(glitchTime) + sin(glitchTime * 3.45) + sin(glitchTime * 8.76) * 1.1;
            glitchStrength /= 3.0;
            glitchStrength = smoothstep(0.8, 1.0, glitchStrength);
            glitchStrength *= 0.06;
            modelPosition.x += (random2D(modelPosition.xz + uTime).x - 0.5) * glitchStrength;
            modelPosition.z += (random2D(modelPosition.zx + uTime).x - 0.5) * glitchStrength;

            gl_Position = projectionMatrix * viewMatrix * modelPosition;

            vec4 modelNormal = modelMatrix * vec4(normal, 0.0);
            vPosition = modelPosition.xyz;
            vNormal = modelNormal.xyz;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uTime;
          varying vec3 vPosition;
          varying vec3 vNormal;

          void main() {
            vec3 normal = normalize(vNormal);
            if(!gl_FrontFacing)
                normal *= -1.0;

            float stripes = mod((vPosition.y - uTime * 0.02) * 14.0, 1.0);
            stripes = pow(stripes, 3.0);

            vec3 viewDirection = normalize(vPosition - cameraPosition);
            float fresnel = dot(viewDirection, normal) + 1.0;
            fresnel = pow(fresnel, 1.2);

            float falloff = smoothstep(0.8, 0.2, fresnel);

            float holographic = stripes * fresnel;
            holographic += fresnel * 2.25;
            holographic *= falloff;

            gl_FragColor = vec4(uColor, holographic);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: true,
        depthTest: true,
        side: THREE.FrontSide,
      }),
    []
  );

  const heartHolographicMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        precision: "lowp",
        uniforms: {
          uTime: { value: 0.0 },
          uColor: { value: new THREE.Color(0xff69b4) },
          uGlowIntensity: { value: 2.5 },
        },
        vertexShader: `
          uniform float uTime;
          varying vec3 vPosition;
          varying vec3 vNormal;
      
          vec2 random2D(vec2 st) {
            st = vec2(dot(st, vec2(127.1, 311.7)),
                     dot(st, vec2(269.5, 183.3)));
            return -1.0 + 2.0 * fract(sin(st) * 43758.5453123);
          }

          void main() {
            vec4 modelPosition = modelMatrix * vec4(position, 1.0);

            float glitchTime = uTime - modelPosition.y;
            float glitchStrength = sin(glitchTime) + sin(glitchTime * 3.45) + sin(glitchTime * 8.76) * 1.1;
            glitchStrength /= 3.0;
            glitchStrength = smoothstep(0.9, 1.0, glitchStrength);
            glitchStrength *= 0.1;
            modelPosition.x += (random2D(modelPosition.xz + uTime).x - 0.5) * glitchStrength;
            modelPosition.z += (random2D(modelPosition.zx + uTime).x - 0.5) * glitchStrength;

            gl_Position = projectionMatrix * viewMatrix * modelPosition;

            vec4 modelNormal = modelMatrix * vec4(normal, 0.0);
            vPosition = modelPosition.xyz;
            vNormal = modelNormal.xyz;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uTime;
          uniform float uGlowIntensity;
          varying vec3 vPosition;
          varying vec3 vNormal;

          void main() {
            vec3 normal = normalize(vNormal);
            if(!gl_FrontFacing)
                normal *= -1.0;

            float stripes = mod((vPosition.y - uTime * 0.02) * 10.0, 1.0);
            stripes = pow(stripes, 2.5);

            vec3 viewDirection = normalize(vPosition - cameraPosition);
            float fresnel = dot(viewDirection, normal) + 1.0;
            fresnel = pow(fresnel, 1.5);

            float baseGlow = 0.3;
            float falloff = smoothstep(0.8, 0.2, fresnel);
            float pulse = sin(uTime * 3.0) * 0.2 + 0.8;

            float holographic = stripes * fresnel;
            holographic += fresnel * uGlowIntensity * pulse;
            holographic *= falloff;
            holographic = max(holographic, baseGlow);

            vec3 finalColor = uColor;
            finalColor.r += sin(vPosition.y * 3.0 + uTime * 0.5) * 0.1;
            finalColor.b += cos(vPosition.x * 3.0 - uTime * 0.3) * 0.1;

            gl_FragColor = vec4(finalColor, holographic);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: true,
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    []
  );

  // Initialize materials and animations - runs once per clonedScene
  useEffect(() => {
    if (!clonedScene || hasInitializedRef.current) return;
    
    hasInitializedRef.current = true;
    animatedMaterialsRef.current = [];

    // Set up animation mixer
    const mixer = new THREE.AnimationMixer(clonedScene);
    mixerRef.current = mixer;

    // Find and play animations from the original gltf (animations aren't cloned)
    const haloAnimation = gltf.animations.find(
      (anim) => anim.name === "HaloRotation"
    );
    if (haloAnimation) {
      const action = mixer.clipAction(haloAnimation);
      action.play();
    }

    // Apply scale and rotation
    clonedScene.scale.set(scale[0], scale[1], scale[2]);
    clonedScene.rotation.set(rotation[0], rotation[1], rotation[2]);

    // Center the model
    clonedScene.position.set(0, 0, 0);
    clonedScene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clonedScene);
    const center = box.getCenter(new THREE.Vector3());
    clonedScene.position.set(-center.x, -center.y, -center.z);

    // Traverse and apply materials
    clonedScene.traverse((child) => {
      // Find HaloMaster
      if (child.name === "HaloMaster" || child.name.toLowerCase() === "halomaster") {
        haloMasterRef.current = child;
      }

      if (child.isMesh) {
        const meshName = child.name.toLowerCase();

        if (meshName.includes("halotext1") || meshName.includes("halotext2")) {
          child.material = new THREE.MeshStandardMaterial({
            color: child.material.color,
            emissive: child.material.color,
            emissiveIntensity: 1.0,
            metalness: 0.8,
            roughness: 0.2,
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: true,
            depthTest: true,
            blending: THREE.AdditiveBlending,
          });
          child.renderOrder = 2;
        } else if (meshName === "heart3_1" || meshName === "heart3_2") {
          const clonedMaterial = heartHolographicMaterial.clone();
          clonedMaterial.uniforms = {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(0x00ff00) },
            uGlowIntensity: { value: 2.5 },
          };
          clonedMaterial.side = THREE.DoubleSide;
          clonedMaterial.depthTest = false;
          child.material = clonedMaterial;
          child.renderOrder = 3;
          animatedMaterialsRef.current.push(clonedMaterial);
        } else if (
          meshName === "heart4_1" ||
          meshName === "heart4_2" ||
          meshName === "heart4"
        ) {
          const clonedMaterial = heartHolographicMaterial.clone();
          clonedMaterial.uniforms = {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(0xffffff) },
            uGlowIntensity: { value: 2.5 },
          };
          clonedMaterial.side = THREE.DoubleSide;
          clonedMaterial.depthTest = false;
          child.material = clonedMaterial;
          child.renderOrder = 3;
          animatedMaterialsRef.current.push(clonedMaterial);
        } else if (meshName === "heart1" || meshName === "heart") {
          if (meshName === "heart") {
            child.visible = true;
          }
          const clonedMaterial = holographicMaterial.clone();
          clonedMaterial.uniforms = {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(0xff0000) },
          };
          child.material = clonedMaterial;
          animatedMaterialsRef.current.push(clonedMaterial);
        } else {
          const clonedMaterial = holographicMaterial.clone();
          clonedMaterial.uniforms = {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(0x00ffff) },
          };
          child.material = clonedMaterial;
          child.renderOrder = 1;
          animatedMaterialsRef.current.push(clonedMaterial);
        }
      }
    });

    // Call onLoad only once
    if (onLoad && !onLoadCalledRef.current) {
      onLoadCalledRef.current = true;
      onLoad();
    }

    // Cleanup
    return () => {
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }

      // Dispose materials
      animatedMaterialsRef.current.forEach((material) => {
        material.dispose();
      });
      animatedMaterialsRef.current = [];

      // Dispose geometries and materials in the cloned scene
      clonedScene.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });

      hasInitializedRef.current = false;
      onLoadCalledRef.current = false;
      haloMasterRef.current = null;
    };
  }, [clonedScene, gltf.animations, holographicMaterial, heartHolographicMaterial, onLoad, scale, rotation]);

  // Animation frame - keep this lean
  useFrame((state, delta) => {
    // Update animation mixer
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }

    // Rotate HaloMaster
    if (haloMasterRef.current) {
      haloMasterRef.current.rotation.y += delta * 0.1;
    }

    // Hover animation
    if (hover && groupRef.current) {
      groupRef.current.position.y =
        initialY.current + Math.sin(state.clock.elapsedTime * 0.1) * 0.01;
    }

    // Rotation animation
    if (rotate && rotationGroupRef.current) {
      rotationGroupRef.current.rotation.y += delta * 0.0; // Currently disabled (0.0)
    }

    // Update shader time uniforms with wrapping to prevent precision issues
    // Using modulo to keep value in reasonable range
    const TIME_WRAP = Math.PI * 200; // ~628, plenty of range for smooth animation
    for (const material of animatedMaterialsRef.current) {
      if (material.uniforms?.uTime) {
        let newTime = material.uniforms.uTime.value - delta;
        // Wrap when it gets too negative
        if (newTime < -TIME_WRAP) {
          newTime += TIME_WRAP;
        }
        material.uniforms.uTime.value = newTime;
      }
    }
  });

  // Return proper R3F JSX instead of imperative scene manipulation
  return (
    <group ref={groupRef} position={position}>
      <group ref={rotationGroupRef}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}

// Wrap with Suspense boundary in parent component!
// Example:
// <Suspense fallback={null}>
//   <HolographicStatue3 position={[0, 1, 0]} />
// </Suspense>

export default React.memo(HolographicStatue3, (prev, next) => {
  return (
    prev.hover === next.hover &&
    prev.rotate === next.rotate &&
    prev.onLoad === next.onLoad &&
    JSON.stringify(prev.position) === JSON.stringify(next.position) &&
    JSON.stringify(prev.scale) === JSON.stringify(next.scale) &&
    JSON.stringify(prev.rotation) === JSON.stringify(next.rotation)
  );
});