import React, { useEffect, useRef, useMemo } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

function HolographicStatue3({
  onLoad,
  position = [0.01, 1.37, 0.134],  // Default position if not provided
  rotation = [0, 0, 0],  // Default rotation if not provided
  scale = [0.3, 0.3, 0.3],  // Default scale if not provided
  hover = false,  // Disable hover animation by default
  rotate = true,  // Disable rotation animation by default
  active = true  // When false: hide scene group and skip useFrame work
}) {
  // Detect if we're on a mobile/tablet device
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isTablet = /iPad|Android(?!.*Mobile)|Tablet/i.test(navigator.userAgent);
  const statueRef = useRef();
  const groupRef = useRef();
  const { scene } = useThree();
  const initialY = useRef(position[1]); // Use provided Y position as initial Y
  const mixerRef = useRef();
  const hasLoadedRef = useRef(false);
  const animatedMaterialsRef = useRef([]); // Cache materials that need animation
  const haloMasterRef = useRef(); // Track the HaloMaster object
  const coreAnchorRef = useRef(); // Core sample alternate hologram
  const coreMaterialRef = useRef();

  // Use useMemo to prevent recreating the loader on every render
  const loader = useMemo(() => {
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    gltfLoader.setDRACOLoader(dracoLoader);
    return gltfLoader;
  }, []);

  // Use useMemo to prevent recreating the shader material on every render
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
        glitchStrength = smoothstep(0.3, 1.0, glitchStrength);
        glitchStrength *= 0.003; //adjust this for the vertical movement
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
        fresnel = pow(fresnel, 1.6);

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
        // side: THREE.FrontSide,
      }),
    []
  );

  // Core sample shader — holographic cylinder with geological strata banding.
  // Uses vUv.y (0 at bottom, 1 at top of cylinder) to pick a color from 4 stops:
  //   bedrock (dark) → oil-rich shale (warm amber) → water-bearing (cyan) → surface rock (tan)
  const coreSampleMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        precision: "lowp",
        uniforms: {
          uTime: { value: 0.0 },
          uBandBottom: { value: new THREE.Color(0x1a1a2e) }, // near-black bedrock
          uBandOil:    { value: new THREE.Color(0xff8c1a) }, // warm amber — oil layer (the valuable bit)
          uBandWater:  { value: new THREE.Color(0x3ad6ff) }, // cyan — water-bearing
          uBandTop:    { value: new THREE.Color(0xc9a97a) }, // tan — surface rock
        },
        vertexShader: `
          uniform float uTime;
          varying vec3 vPosition;
          varying vec3 vNormal;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec4 modelPosition = modelMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * viewMatrix * modelPosition;
            vPosition = modelPosition.xyz;
            vNormal = (modelMatrix * vec4(normal, 0.0)).xyz;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uBandBottom;
          uniform vec3 uBandOil;
          uniform vec3 uBandWater;
          uniform vec3 uBandTop;
          varying vec3 vPosition;
          varying vec3 vNormal;
          varying vec2 vUv;
          void main() {
            vec3 normal = normalize(vNormal);
            if (!gl_FrontFacing) normal *= -1.0;

            // Horizontal scan-line stripes (the holographic striation also reads as sediment layers)
            float stripes = mod((vUv.y - uTime * 0.02) * 24.0, 1.0);
            stripes = pow(stripes, 3.0);

            vec3 viewDirection = normalize(vPosition - cameraPosition);
            float fresnel = dot(viewDirection, normal) + 1.0;
            fresnel = pow(fresnel, 1.4);
            float falloff = smoothstep(0.8, 0.2, fresnel);

            // Banded strata — pick color based on vUv.y (0=bottom, 1=top)
            float y = vUv.y;
            vec3 c = mix(uBandBottom, uBandOil,   smoothstep(0.10, 0.35, y));
            c = mix(c,                uBandWater, smoothstep(0.45, 0.65, y));
            c = mix(c,                uBandTop,   smoothstep(0.75, 0.95, y));

            float holographic = stripes * fresnel + fresnel * 2.0;
            holographic *= falloff;
            holographic = max(holographic, 0.25); // base visibility so bands stay readable

            gl_FragColor = vec4(c, holographic);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: true,
        depthTest: true,
        side: THREE.DoubleSide,
      }),
    []
  );

  // Create a special shader for heart objects with enhanced glow
  // COMMENTED OUT FOR DEBUGGING FLASH ISSUE
  // const heartHolographicMaterial = useMemo(
  //   () =>
  //     new THREE.ShaderMaterial({
  //       precision: "lowp",
  //       uniforms: {
  //         uTime: { value: 0.0 },
  //         uColor: { value: new THREE.Color(0xff69b4) }, // Hot pink color for hearts
  //         uGlowIntensity: { value: 2.5 },
  //       },
  //       vertexShader: `
  //     uniform float uTime;
  //     varying vec3 vPosition;
  //     varying vec3 vNormal;
  //
  //     vec2 random2D(vec2 st) {
  //       st = vec2(dot(st, vec2(127.1, 311.7)),
  //                dot(st, vec2(269.5, 183.3)));
  //       return -1.0 + 2.0 * fract(sin(st) * 43758.5453123);
  //     }
  //
  //     void main() {
  //       vec4 modelPosition = modelMatrix * vec4(position, 1.0);
  //
  //       // Match the same glitch pattern as main holographic material
  //       float glitchTime = uTime - modelPosition.y;
  //       float glitchStrength = sin(glitchTime) + sin(glitchTime * 3.45) + sin(glitchTime * 8.76) * 1.1;
  //       glitchStrength /= 3.0;
  //       glitchStrength = smoothstep(0.9, 1.0, glitchStrength);
  //       glitchStrength *= 0.1; // Same as main material
  //       modelPosition.x += (random2D(modelPosition.xz + uTime).x - 0.5) * glitchStrength;
  //       modelPosition.z += (random2D(modelPosition.zx + uTime).x - 0.5) * glitchStrength;
  //
  //       gl_Position = projectionMatrix * viewMatrix * modelPosition;
  //
  //       vec4 modelNormal = modelMatrix * vec4(normal, 0.0);
  //       vPosition = modelPosition.xyz;
  //       vNormal = modelNormal.xyz;
  //     }
  //   `,
  //       fragmentShader: `
  //     uniform vec3 uColor;
  //     uniform float uTime;
  //     uniform float uGlowIntensity;
  //     varying vec3 vPosition;
  //     varying vec3 vNormal;
  //
  //     void main() {
  //       vec3 normal = normalize(vNormal);
  //       if(!gl_FrontFacing)
  //           normal *= -1.0;
  //
  //       // Similar stripes to main material but slightly different speed
  //       float stripes = mod((vPosition.y - uTime * 0.02) * 10.0, 1.0);
  //       stripes = pow(stripes, 2.5);
  //
  //       vec3 viewDirection = normalize(vPosition - cameraPosition);
  //       float fresnel = dot(viewDirection, normal) + 1.0;
  //       fresnel = pow(fresnel, 1.5);
  //
  //       // Base glow
  //       float baseGlow = 0.3; // Minimum visibility
  //
  //       float falloff = smoothstep(0.8, 0.2, fresnel);
  //
  //       // Pulsing glow effect
  //       float pulse = sin(uTime * 3.0) * 0.2 + 0.8;
  //
  //       float holographic = stripes * fresnel;
  //       holographic += fresnel * uGlowIntensity * pulse;
  //       holographic *= falloff;
  //       holographic = max(holographic, baseGlow); // Ensure minimum visibility
  //
  //       // Subtle color variation
  //       vec3 finalColor = uColor;
  //       finalColor.r += sin(vPosition.y * 3.0 + uTime * 0.5) * 0.1;
  //       finalColor.b += cos(vPosition.x * 3.0 - uTime * 0.3) * 0.1;
  //
  //       gl_FragColor = vec4(finalColor, holographic);
  //     }
  //   `,
  //       transparent: true,
  //       blending: THREE.AdditiveBlending,
  //       depthWrite: true, // Allow transparency layering
  //       depthTest: false,
  //       side: THREE.DoubleSide,
  //     }),
  //   []
  // );

  // Create a flame-colored shader for heart1 objects
  // const flameHolographicMaterial = useMemo(
  //   () =>
  //     new THREE.ShaderMaterial({
  //       precision: "lowp",
  //       uniforms: {
  //         uTime: { value: 0.0 },
  //         uColor1: { value: new THREE.Color(0xff4500) }, // Orange-red
  //         uColor2: { value: new THREE.Color(0xffd700) }, // Gold
  //         uGlowIntensity: { value: 3.0 },
  //       },
  //       vertexShader: `
  //     uniform float uTime;
  //     varying vec3 vPosition;
  //     varying vec3 vNormal;
  
  //     vec2 random2D(vec2 st) {
  //       st = vec2(dot(st, vec2(127.1, 311.7)),
  //                dot(st, vec2(269.5, 183.3)));
  //       return -1.0 + 2.0 * fract(sin(st) * 43758.5453123);
  //     }

  //     void main() {
  //       vec4 modelPosition = modelMatrix * vec4(position, 1.0);

  //       // Match the same glitch pattern as main holographic material
  //       float glitchTime = uTime - modelPosition.y;
  //       float glitchStrength = sin(glitchTime) + sin(glitchTime * 3.45) + sin(glitchTime * 8.76) * 1.1;
  //       glitchStrength /= 3.0;
  //       glitchStrength = smoothstep(0.8, 1.0, glitchStrength);
  //       glitchStrength *= 0.02; // Same as main material
  //       modelPosition.x += (random2D(modelPosition.xz + uTime).x - 0.5) * glitchStrength;
  //       modelPosition.z += (random2D(modelPosition.zx + uTime).x - 0.5) * glitchStrength;

  //       gl_Position = projectionMatrix * viewMatrix * modelPosition;

  //       vec4 modelNormal = modelMatrix * vec4(normal, 0.0);
  //       vPosition = modelPosition.xyz;
  //       vNormal = modelNormal.xyz;
  //     }
  //   `,
  //       fragmentShader: `
  //     uniform vec3 uColor1;
  //     uniform vec3 uColor2;
  //     uniform float uTime;
  //     uniform float uGlowIntensity;
  //     varying vec3 vPosition;
  //     varying vec3 vNormal;

  //     void main() {
  //       vec3 normal = normalize(vNormal);
  //       if(!gl_FrontFacing)
  //           normal *= -1.0;

  //       // Flame-like movement in stripes
  //       float flamePattern = sin(vPosition.y * 8.0 - uTime * 4.0) * 0.5 + 0.5;
  //       float stripes = mod((vPosition.y - uTime * 0.03) * 12.0 + flamePattern * 2.0, 1.0);
  //       stripes = pow(stripes, 2.0);

  //       vec3 viewDirection = normalize(vPosition - cameraPosition);
  //       float fresnel = dot(viewDirection, normal) + 1.0;
  //       fresnel = pow(fresnel, 1.5);

  //       // Base glow
  //       float baseGlow = 0.5; // Higher base for flame visibility

  //       float falloff = smoothstep(0.8, 0.2, fresnel);

  //       // Flickering flame effect
  //       float flicker = sin(uTime * 10.0) * 0.1 + sin(uTime * 23.0) * 0.05 + 0.85;

  //       float holographic = stripes * fresnel;
  //       holographic += fresnel * uGlowIntensity * flicker;
  //       holographic *= falloff;
  //       holographic = max(holographic, baseGlow);

  //       // Blend between orange-red and gold based on position and time
  //       float colorMix = sin(vPosition.y * 4.0 + uTime * 2.0) * 0.5 + 0.5;
  //       vec3 finalColor = mix(uColor1, uColor2, colorMix);
        
  //       // Add white hot core
  //       finalColor = mix(finalColor, vec3(1.0, 0.95, 0.8), fresnel * 0.3);

  //       gl_FragColor = vec4(finalColor, holographic);
  //     }
  //   `,
  //       transparent: true,
  //       blending: THREE.AdditiveBlending,
  //       depthWrite: true,
  //       depthTest: false,
  //       side: THREE.DoubleSide,
  //     }),
  //   []
  // );

  const applyHolographicEffect = (model) => {
    model.traverse((child) => {
      if (child.isMesh) {
        child.material = holographicMaterial;
      }
    });
  };

  // const object3 = scene.getObjectByName("Object_3");

  // if (object3) {
  //   const worldPosition = new THREE.Vector3();
  //   object3.getWorldPosition(worldPosition);
  //   // console.log("World Position:", worldPosition);
  // }

  useEffect(() => {
    // Only load if we haven't already
    if (hasLoadedRef.current) return;

    let isCurrentInstance = true; // Flag to track if this effect instance is current

    loader.load("/models/CyberpunkMaryHeartRed2.glb", (gltf) => {
      if (!isCurrentInstance) return; // Don't proceed if this effect is stale

      const statue = gltf.scene;

      // Create and store the animation mixer
      const mixer = new THREE.AnimationMixer(statue);
      mixerRef.current = mixer;

      // Find and play the HaloRotation animation
      const haloAnimation = gltf.animations.find(
        (anim) => anim.name === "HaloRotation"
      );
      if (haloAnimation) {
        const action = mixer.clipAction(haloAnimation);
        action.play();
      } else {
        // console.warn("HaloRotation animation not found in the model");
      }

      // Create an anchor group with initial position
      const anchorGroup = new THREE.Group();
      anchorGroup.name = "HologramAnchor";
      // Use position from props instead of hardcoded position
      anchorGroup.position.set(position[0], position[1], position[2]);
      anchorGroup.visible = active;
      initialY.current = position[1];

      // Create a rotation group
      const rotationGroup = new THREE.Group();

      // Set up the hierarchy
      anchorGroup.add(rotationGroup);
      rotationGroup.add(statue);

      // Store refs
      statueRef.current = statue;
      groupRef.current = { anchor: anchorGroup, rotation: rotationGroup };

      // Apply scale and rotation from props
      statue.scale.set(scale[0], scale[1], scale[2]);
      statue.rotation.set(rotation[0], rotation[1], rotation[2]);

      // Reset any position from the GLTF file before centering
      statue.position.set(0, 0, 0);
      statue.updateMatrixWorld(true);

      // Center the statue in the rotation group
      const box = new THREE.Box3().setFromObject(statue);
      const center = box.getCenter(new THREE.Vector3());
      statue.position.set(-center.x, -center.y, -center.z);

      // Apply materials
      const goldHolographicMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(0xffd700) },
        },
        vertexShader: holographicMaterial.vertexShader,
        fragmentShader: holographicMaterial.fragmentShader,
        transparent: true,
        blending: THREE.NormalBlending,
        depthWrite: true,
        depthTest: true,
        side: THREE.DoubleSide,
      });

      // Clear previous animated materials
      animatedMaterialsRef.current = [];
      
      // Find and store reference to HaloMaster object
      statue.traverse((child) => {
        if (child.name === 'HaloMaster' || child.name.toLowerCase() === 'halomaster') {

          
          // Store direct reference to the HaloMaster object
          // We'll just rotate it as-is and let it rotate around its pivot
          haloMasterRef.current = child;
          
          // Log children names for debugging
          child.traverse((subChild) => {
            if (subChild !== child) {
              // console.log("HaloMaster child found:", subChild.name, "type:", subChild.type);
            }
          });
        }
      });
      
      let bodyRenderOrder = 10; // Incrementing renderOrder for body meshes to prevent sort-order flipping
      statue.traverse((child) => {
        if (child.isMesh) {
          // console.log("Mesh name:", child.name); // Enable debug logging
          const meshName = child.name.toLowerCase();

          if (
            meshName.includes("halotext1") ||
            meshName.includes("halotext2")
          ) {
            child.material = new THREE.MeshStandardMaterial({
              color: child.material.color,
              emissive: child.material.color,
              emissiveIntensity: 1.0,
              metalness: 0.8,
              roughness: 0.2,
              side: THREE.DoubleSide,
              transparent: true,
              depthWrite: false,
              depthTest: true,
              blending: THREE.AdditiveBlending,
              // needsUpdate: true, // Remove this line - it's causing the warning
            });
            child.renderOrder = 100;
          } else if (meshName === "heart3_1" || meshName === "heart3_2") {
            // Heart shader commented out for debugging - hide these meshes
            child.visible = false;
          } else if (meshName === "heart4_1" || meshName === "heart4_2" || meshName === "heart4") {
            // Heart shader commented out for debugging - hide these meshes
            child.visible = false;
          } else if (meshName === "heart1" || meshName === "heart") {
            // Hide heart1 temporarily
            if (meshName === "heart") {
              child.visible = true;
            }
            // Apply red shader to other hearts
            const clonedMaterial = holographicMaterial.clone();
            clonedMaterial.uniforms = {
              uTime: { value: 0 },
              uColor: { value: new THREE.Color(0xff0000) } // Make it bright red so we can see it
            };
            clonedMaterial.depthWrite = false;
            child.material = clonedMaterial;
            child.renderOrder = 150;
            animatedMaterialsRef.current.push(clonedMaterial);
          } else {
            // Main statue parts
            const clonedMaterial = holographicMaterial.clone();
            clonedMaterial.uniforms = {
              uTime: { value: 0 },
              uColor: { value: new THREE.Color(0x00ffff) }
            };
            child.material = clonedMaterial;
            child.renderOrder = bodyRenderOrder++;
            animatedMaterialsRef.current.push(clonedMaterial);
          }
        }
      });

      // Create depth mask clone — renders first to fill depth buffer,
      // so the holographic visual pass depth-tests correctly.
      // Uses the same vertex shader (with glitch displacement) to stay in sync.
      const depthMaterial = new THREE.ShaderMaterial({
        precision: "lowp",
        uniforms: {
          uTime: { value: 0.0 },
        },
        vertexShader: holographicMaterial.vertexShader,
        fragmentShader: `
          uniform float uTime;
          varying vec3 vPosition;
          varying vec3 vNormal;
          void main() {
            // Holographic scan-line stripes (matches the visual shader pattern)
            float stripes = mod((vPosition.y - uTime * 0.02) * 14.0, 1.0);
            stripes = pow(stripes, 3.0);

            // Fresnel — edges are more transparent
            vec3 normal = normalize(vNormal);
            if (!gl_FrontFacing) normal *= -1.0;
            vec3 viewDirection = normalize(vPosition - cameraPosition);
            float fresnel = dot(viewDirection, normal) + 1.0;
            fresnel = pow(fresnel, 1.6);

            // Discard where the holographic effect is strongest
            // (stripe peaks + edges), letting words show through
            float mask = stripes * fresnel + fresnel * 0.3;
            if (mask > 0.01) discard;

            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
          }
        `,
        colorWrite: false,
        depthWrite: true,
        depthTest: true,
        side: THREE.FrontSide,
      });
      // Track for uTime updates in the animation loop
      animatedMaterialsRef.current.push(depthMaterial);

      const depthClone = statue.clone(true);
      depthClone.traverse((child) => {
        if (child.isMesh) {
          child.material = depthMaterial;
          child.renderOrder = 0;
        }
      });

      // Set visual statue renderOrder to 1 so it draws after depth mask
      statue.traverse((child) => {
        if (child.isMesh && child.renderOrder < 1) {
          child.renderOrder = 1;
        }
      });

      // Add depth clone as sibling inside the rotation group
      rotationGroup.add(depthClone);

      // Hot pink fresnel shell — scaled-up back-face clone that brightens at silhouette edges
      const shellMaterial = new THREE.ShaderMaterial({
        precision: "lowp",
        uniforms: {
          uTime: { value: 0.0 },
          uColor: { value: new THREE.Color(0xff1493) },
          uIntensity: { value: 1.4 },
        },
        vertexShader: `
          varying vec3 vPosition;
          varying vec3 vNormal;
          void main() {
            vec4 modelPosition = modelMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * viewMatrix * modelPosition;
            vPosition = modelPosition.xyz;
            vNormal = (modelMatrix * vec4(normal, 0.0)).xyz;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uTime;
          uniform float uIntensity;
          varying vec3 vPosition;
          varying vec3 vNormal;
          void main() {
            vec3 normal = normalize(vNormal);
            vec3 viewDirection = normalize(cameraPosition - vPosition);
            float rim = 1.0 - abs(dot(viewDirection, normal));
            rim = pow(rim, 2.5);
            float pulse = sin(uTime * 1.5) * 0.1 + 0.9;
            float alpha = rim * uIntensity * pulse;
            gl_FragColor = vec4(uColor * alpha, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
        side: THREE.BackSide,
      });
      animatedMaterialsRef.current.push(shellMaterial);

      const shellClone = statue.clone(true);
      shellClone.scale.multiplyScalar(1.06);
      shellClone.traverse((child) => {
        if (child.isMesh) {
          child.material = shellMaterial;
          child.renderOrder = 2;
        }
      });
      rotationGroup.add(shellClone);

      // Diffuse hot pink halo — camera-facing billboard with radial falloff
      const glowMaterial = new THREE.ShaderMaterial({
        precision: "lowp",
        uniforms: {
          uTime: { value: 0.0 },
          uColor: { value: new THREE.Color(0xff1493) }, // hot pink
          uIntensity: { value: 0.9 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            // Billboard: strip rotation from the modelView matrix
            mat4 mv = modelViewMatrix;
            mv[0][0] = 1.0; mv[0][1] = 0.0; mv[0][2] = 0.0;
            mv[1][0] = 0.0; mv[1][1] = 1.0; mv[1][2] = 0.0;
            mv[2][0] = 0.0; mv[2][1] = 0.0; mv[2][2] = 1.0;
            gl_Position = projectionMatrix * mv * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          uniform float uTime;
          uniform float uIntensity;
          varying vec2 vUv;
          void main() {
            float d = length(vUv - 0.5) * 2.0;
            // Soft exponential falloff — diffuse cloud, no hard edge
            float glow = exp(-d * 2.4);
            float pulse = sin(uTime * 1.2) * 0.08 + 0.92;
            float alpha = glow * uIntensity * pulse;
            gl_FragColor = vec4(uColor * alpha, alpha);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: true,
      });
      animatedMaterialsRef.current.push(glowMaterial);

      // Size the billboard based on the statue's bounding box
      const glowSize = box.getSize(new THREE.Vector3());
      const glowRadius = Math.max(glowSize.x, glowSize.y, glowSize.z) * 1.5;
      const glowPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(glowRadius, glowRadius),
        glowMaterial
      );
      glowPlane.renderOrder = -1; // draw behind the statue
      rotationGroup.add(glowPlane);

      // Add the anchor group to the scene
      scene.add(anchorGroup);

      // Build the core sample hologram (alternate "resource" display).
      // Same anchor position as the statue but lives in its own group so its
      // visibility can be toggled opposite to the statue via the `active` prop.
      const coreAnchor = new THREE.Group();
      coreAnchor.position.set(position[0], position[1], position[2]);
      coreAnchor.visible = !active;

      const coreGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.75, 24, 1, true);
      const coreMesh = new THREE.Mesh(coreGeo, coreSampleMaterial);
      coreAnchor.add(coreMesh);

      // Optional end caps so the top/bottom don't look hollow when viewed from above/below.
      const capTop = new THREE.Mesh(new THREE.CircleGeometry(0.05, 24), coreSampleMaterial);
      capTop.rotation.x = -Math.PI / 2;
      capTop.position.y = 0.275;
      const capBottom = new THREE.Mesh(new THREE.CircleGeometry(0.05, 24), coreSampleMaterial);
      capBottom.rotation.x = Math.PI / 2;
      capBottom.position.y = -0.275;
      coreAnchor.add(capTop);
      coreAnchor.add(capBottom);

      coreAnchorRef.current = coreAnchor;
      coreMaterialRef.current = coreSampleMaterial;
      scene.add(coreAnchor);

      hasLoadedRef.current = true;

      // Notify parent that statue is loaded and ready
      if (onLoad) {
        onLoad();
      }
    });

    // Cleanup function
    return () => {
      isCurrentInstance = false; // Mark this effect instance as stale

      // Stop all animations
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }

      // Remove the statue from scene and dispose of resources
      if (groupRef.current?.anchor) {
        // Traverse and dispose of all materials and geometries
        groupRef.current.anchor.traverse((child) => {
          if (child.isMesh) {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((material) => material.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });

        // Remove from scene
        scene.remove(groupRef.current.anchor);
        groupRef.current = null;
      }

      // Clear statue reference
      if (statueRef.current) {
        statueRef.current = null;
      }

      // Dispose core sample
      if (coreAnchorRef.current) {
        coreAnchorRef.current.traverse((child) => {
          if (child.isMesh && child.geometry) child.geometry.dispose();
        });
        scene.remove(coreAnchorRef.current);
        coreAnchorRef.current = null;
      }
      if (coreMaterialRef.current) {
        coreMaterialRef.current.dispose();
        coreMaterialRef.current = null;
      }

      // Reset loaded flag
      hasLoadedRef.current = false;
      
      // Clear animated materials cache
      animatedMaterialsRef.current = [];
    };
  // }, [scene, holographicMaterial, heartHolographicMaterial, flameHolographicMaterial, loader, onLoad, position, rotation, scale, hover, rotate]);
}, [scene, holographicMaterial, loader]); // Only re-load if scene or core materials change


  // Sync scene-graph visibility with `active` so the imperatively-added
  // anchorGroup / coreAnchor can be toggled without unmounting.
  useEffect(() => {
    if (groupRef.current?.anchor) {
      groupRef.current.anchor.visible = active;
    }
    if (coreAnchorRef.current) {
      coreAnchorRef.current.visible = !active;
    }
  }, [active]);

  useFrame((state, delta) => {
    // Core sample update (only when core is visible)
    if (!active) {
      if (coreAnchorRef.current) {
        coreAnchorRef.current.rotation.y += delta * 0.3;
      }
      if (coreMaterialRef.current?.uniforms?.uTime) {
        coreMaterialRef.current.uniforms.uTime.value -= delta;
      }
      return;
    }

    // Update the animation mixer
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }

    // Rotate the HaloMaster object around its own center
    if (haloMasterRef.current) {
      // Simple rotation around local Y axis (vertical)
      haloMasterRef.current.rotation.y += delta * 0.3; // 0.5 radians per second
      
      // Or try rotation around Z axis if preferred
      // haloMasterRef.current.rotation.z += delta * 0.5;
    }

    if (statueRef.current && groupRef.current) {
      // Apply hover animation to the anchor group only if hover is enabled
      if (hover) {
        groupRef.current.anchor.position.y =
          initialY.current + Math.sin(state.clock.elapsedTime * 0.5) * 0.3;
      }

      // Apply rotation to the rotation group only if rotate is enabled
      if (rotate) {
        groupRef.current.rotation.rotation.y += delta * 0.3;
      }

      // Update shader uniforms using cached materials (more efficient)
      for (const material of animatedMaterialsRef.current) {
        if (material.uniforms?.uTime) {
          material.uniforms.uTime.value -= delta;
        }
      }
    }
  });

  return null;
}

export default HolographicStatue3;