"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useHelper } from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import * as THREE from "three";
import { Godray } from "./GodRay";
// import GPGPUParticleTransition from "./GPGPUParticleTransition";

/** Recursively dispose all geometries, materials, and textures in a scene graph */
function disposeObject(obj) {
  obj.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => {
        if (!m) return;
        Object.values(m).forEach((v) => { if (v instanceof THREE.Texture) v.dispose(); });
        m.dispose();
      });
    }
  });
}

/* ── Camera zoom for small characters (e.g. cat idle) ── */
const _v3A = new THREE.Vector3();
const _v3B = new THREE.Vector3();
const SETTLED_THRESHOLD = 0.01;
function CameraZoom({ active, targetPos, cameraPos, lerpSpeed = 2, controlsRef }) {
  const defaultCam = useRef(null);
  const defaultTarget = useRef(null);
  const prevActive = useRef(active);
  const transitioning = useRef(false);

  // Kick off a transition whenever `active` changes
  useEffect(() => {
    if (active !== prevActive.current) {
      // Snapshot current orbit position as the "default" to return to
      if (active && controlsRef?.current) {
        defaultCam.current = controlsRef.current.object.position.clone();
        defaultTarget.current = controlsRef.current.target.clone();
      }
      transitioning.current = true;
      prevActive.current = active;
    }
  }, [active, controlsRef]);

  useFrame((state, delta) => {
    if (!transitioning.current) return;
    const controls = controlsRef?.current;
    if (!controls) return;

    // Capture defaults on very first frame if not yet set
    if (!defaultCam.current) {
      defaultCam.current = state.camera.position.clone();
      defaultTarget.current = controls.target.clone();
    }

    const goalCam = active ? _v3A.set(...cameraPos) : defaultCam.current;
    const goalTarget = active ? _v3B.set(...targetPos) : defaultTarget.current;
    const t = 1 - Math.exp(-lerpSpeed * delta);

    state.camera.position.lerp(goalCam, t);
    controls.target.lerp(goalTarget, t);
    controls.update();

    // Stop transitioning once we're close enough
    const camDist = state.camera.position.distanceTo(goalCam);
    const tgtDist = controls.target.distanceTo(goalTarget);
    if (camDist < SETTLED_THRESHOLD && tgtDist < SETTLED_THRESHOLD) {
      transitioning.current = false;
    }
  });

  return null;
}

/* ── Debug spotlight with helper + proper target ── */
function DebugSpotLight({ position, targetPosition = [0, 0, 0], color = "#ffffff", intensity = 2, angle = 0.4, penumbra = 0.5, distance = 15, debug = true }) {
  const lightRef = useRef();
  useHelper(debug && lightRef, THREE.SpotLightHelper, color);
  useEffect(() => {
    if (lightRef.current) {
      lightRef.current.target.position.set(...targetPosition);
      lightRef.current.target.updateMatrixWorld();
    }
  }, [targetPosition]);
  return (
    <spotLight
      ref={lightRef}
      position={position}
      angle={angle}
      penumbra={penumbra}
      intensity={intensity}
      color={color}
      distance={distance}
      castShadow={false}
    />
  );
}

/* ── Scrolling ground plane ── */
function ScrollingGround({ speed = 0.8, isWalking = true }) {
  const meshRef = useRef();
  const textureRef = useRef();

  useEffect(() => {
    // Create a procedural grid texture
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    // Dark ground with subtle grid lines
    ctx.fillStyle = "#0d0d14";
    ctx.fillRect(0, 0, size, size);

    // Grid lines
    ctx.strokeStyle = "rgba(100, 180, 255, 0.07)";
    ctx.lineWidth = 1;
    const gridSize = 64;
    for (let i = 0; i <= size; i += gridSize) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(size, i);
      ctx.stroke();
    }

    // Slightly brighter intersection dots
    ctx.fillStyle = "rgba(100, 180, 255, 0.12)";
    for (let x = 0; x <= size; x += gridSize) {
      for (let y = 0; y <= size; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(20, 20);
    textureRef.current = tex;

    if (meshRef.current) {
      meshRef.current.material.map = tex;
      meshRef.current.material.needsUpdate = true;
    }

    return () => tex.dispose();
  }, []);

  useFrame((_, delta) => {
    if (textureRef.current && isWalking) {
      textureRef.current.offset.y -= speed * delta;
    }
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[60, 60]} />
      <meshStandardMaterial transparent opacity={0.99} />
    </mesh>
  );
}

/* ── Drifting environment particles ── */

/* ── Dusky sky dome ── */
function DuskySky() {
  const materialRef = useRef();

  const uniforms = useMemo(() => ({
    uTopColor: { value: new THREE.Color("#050510") },       // near-black at zenith
    uMidColor: { value: new THREE.Color("#140c24") },       // deep dusky purple
    uHorizonColor: { value: new THREE.Color("#4a2028") },   // warm dusky glow at horizon
    uLowColor: { value: new THREE.Color("#1a0a10") },       // dark below horizon
  }), []);

  const vertexShader = `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 uTopColor;
    uniform vec3 uMidColor;
    uniform vec3 uHorizonColor;
    uniform vec3 uLowColor;

    varying vec3 vWorldPosition;

    void main() {
      vec3 dir = normalize(vWorldPosition);
      float y = dir.y;

      // 4-stop gradient: low -> thin horizon -> purple -> dark top
      vec3 color;
      if (y < -0.02) {
        color = mix(uLowColor, uHorizonColor, smoothstep(-0.15, -0.02, y));
      } else if (y < 0.1) {
        color = mix(uHorizonColor, uMidColor, smoothstep(-0.02, 0.1, y));
      } else {
        color = mix(uMidColor, uTopColor, smoothstep(0.1, 0.4, y));
      }

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[50, 32, 32]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}

/* ── Synthwave sun backdrop ── */
function SynthwaveSun({ position = [20, 8, -20], scale = 1 }) {
  const groupRef = useRef();

  useEffect(() => {
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    const dracoPath =
      typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? `${window.location.origin}/draco/`
        : "/draco/";
    dracoLoader.setDecoderPath(dracoPath);
    gltfLoader.setDRACOLoader(dracoLoader);

    gltfLoader.load("/models/Sun.glb", (gltf) => {
      const model = gltf.scene;
      // Make sun immune to fog so it stays visible in the background
      model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.fog = false;
        }
      });
      if (groupRef.current) {
        groupRef.current.add(model);
      }
    });

    return () => {
      if (groupRef.current) {
        while (groupRef.current.children.length) {
          const child = groupRef.current.children[0];
          groupRef.current.remove(child);
          disposeObject(child);
        }
      }
    };
  }, []);

  // Billboard: always face the camera
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.lookAt(state.camera.position);
    }
  });

  const s = typeof scale === "number" ? [scale, scale, scale] : scale;
  return <group ref={groupRef} position={position} scale={s} />;
}

/* ── Skyline backdrop ── */
function Skyline({ position = [0, 0, 30], scale = 0.5 }) {
  const groupRef = useRef();

  useEffect(() => {
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    const dracoPath =
      typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? `${window.location.origin}/draco/`
        : "/draco/";
    dracoLoader.setDecoderPath(dracoPath);
    gltfLoader.setDRACOLoader(dracoLoader);

    gltfLoader.load("/models/skyline2.glb", (gltf) => {
      const model = gltf.scene;
      model.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.fog = false;
        }
      });
      if (groupRef.current) {
        groupRef.current.add(model);
      }
    });

    return () => {
      if (groupRef.current) {
        while (groupRef.current.children.length) {
          const child = groupRef.current.children[0];
          groupRef.current.remove(child);
          disposeObject(child);
        }
      }
    };
  }, []);

  const s = typeof scale === "number" ? [scale, scale, scale] : scale;
  return <group ref={groupRef} position={position} scale={s} />;
}

/* ── Scrolling palm trees along both sides ── */
function ScrollingTrees({ speed = 0.8, isWalking = true, spacing = 6, count = 8, xOffset = 3, zOffset = 0 }) {
  const groupRef = useRef();
  const treesRef = useRef([]); // array of { mesh, startZ }
  const modelRef = useRef(null);

  // Total length of the looping strip
  const stripLen = spacing * count;

  useEffect(() => {
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    const dracoPath =
      typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? `${window.location.origin}/draco/`
        : "/draco/";
    dracoLoader.setDecoderPath(dracoPath);
    gltfLoader.setDRACOLoader(dracoLoader);

    gltfLoader.load("/models/wireframePalmTree.glb", (gltf) => {
      modelRef.current = gltf.scene;
      if (!groupRef.current) return;

      const trees = [];
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < count; i++) {
          const clone = gltf.scene.clone();
          const z = -stripLen / 2 + i * spacing + zOffset;
          clone.position.set(side * xOffset, 0, z);
          // Slight random rotation for variety
          clone.rotation.y = Math.random() * Math.PI * 2;
          groupRef.current.add(clone);
          trees.push({ mesh: clone, baseZ: z });
        }
      }
      treesRef.current = trees;
    });

    return () => {
      // cleanup clones
      if (groupRef.current) {
        while (groupRef.current.children.length) {
          const child = groupRef.current.children[0];
          groupRef.current.remove(child);
          disposeObject(child);
        }
      }
      treesRef.current = [];
    };
  }, [count, spacing, xOffset, zOffset, stripLen]);

  useFrame((_, delta) => {
    if (!isWalking || treesRef.current.length === 0) return;
    const halfStrip = stripLen / 1.2;
    for (const tree of treesRef.current) {
      tree.mesh.position.z -= speed * delta;
      // Wrap around when tree passes behind, accounting for zOffset
      if (tree.mesh.position.z < -halfStrip + zOffset) {
        tree.mesh.position.z += stripLen;
      }
    }
  });

  return <group ref={groupRef} />;
}

// Polls a container for a <canvas> or <video> element created by SitePal
function waitForSitePalElement(container, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      // SitePal creates multiple canvases — the animated one is the last.
      // Wait until at least 2 appear, then grab the last one.
      const canvases = container.querySelectorAll("canvas");
      if (canvases.length >= 2) {
        resolve(canvases[canvases.length - 1]);
        return;
      }
      // Fallback: single video element
      const video = container.querySelector("video");
      if (video) {
        resolve(video);
        return;
      }
      // Also check iframes — SitePal may use one
      const iframe = container.querySelector("iframe");
      if (iframe) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          const iframeCanvases = iframeDoc.querySelectorAll("canvas");
          if (iframeCanvases.length >= 2) {
            resolve(iframeCanvases[iframeCanvases.length - 1]);
            return;
          }
          const iframeVideo = iframeDoc.querySelector("video");
          if (iframeVideo) {
            resolve(iframeVideo);
            return;
          }
        } catch (e) {
          // cross-origin iframe, can't access
        }
      }
      if (Date.now() - start > timeout) {
        // Fall back to whatever canvas exists
        if (canvases.length > 0) {
          resolve(canvases[canvases.length - 1]);
          return;
        }
        reject(new Error("SitePal render element not found"));
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}


function FortuneTellerModel({ videoSrc = "", useSitePal = false, sitePalContainerId = "sitepal-container", activeAnim, defaultAnim, onClipsLoaded, modelRef, modelUrl = "/models/fortuneTeller_not3.glb", zOffset = 0 }) {
  const groupRef = useRef();
  const videoRef = useRef(null);
  const mixerRef = useRef(null);
  const textureRef = useRef(null);
  const actionsRef = useRef({});
  const pendingModelRef = useRef(null); // model hidden until mixer ticks
  const pendingFrameCount = useRef(0);
  const defaultAnimRef = useRef(defaultAnim);
  defaultAnimRef.current = defaultAnim;

  // Skateboard + root bone refs for programmatic sync
  const skateboardRef = useRef(null);
  const rootBoneRef = useRef(null);
  const skateboardBasePos = useRef(null);
  const skateboardReparented = useRef(false);
  const _boneWorldVec = useMemo(() => new THREE.Vector3(), []);

  // Eye mesh refs for blinking animation
  const leftEyeRef = useRef();
  const rightEyeRef = useRef();
  const leftEyeTextRef = useRef();
  const rightEyeTextRef = useRef();
  const demonEyesRef = useRef(); // H80Z single "demon_eyes" mesh
  const demonEyesDefaultTexRef = useRef(null);  // original base color texture
  const demonEyesDefaultEmissiveRef = useRef(null); // original emissive texture
  const demonEyesHalfTexRef = useRef(null);    // half-lidded texture for walkText
  const demonBlinkStateRef = useRef({
    lastBlinkTime: 0,
    nextBlinkDelay: Math.random() * 4000 + 3000,
    isBlinking: false,
  });
  const smartPhoneRef = useRef();
  const faceMeshRef = useRef();
  const face2MeshRef = useRef();
  const blinkStateRef = useRef({
    lastBlinkTime: 0,
    nextBlinkDelay: Math.random() * 3000 + 2000,
    isBlinking: false,
    blinkProgress: 0
  });

  useEffect(() => {
    let videoTexture;
    let cleanupFns = [];

    if (useSitePal) {
      // --- SitePal mode: poll for container (may mount after scene is ready) ---
      let cancelled = false;
      const pollForContainer = () => {
        if (cancelled) return;
        const container = document.getElementById(sitePalContainerId);
        if (!container) {
          setTimeout(pollForContainer, 200);
          return;
        }

        // Create an intermediary canvas to crop the SitePal face
        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = 512;
        cropCanvas.height = 512;
        const cropCtx = cropCanvas.getContext("2d");

        waitForSitePalElement(container).then((el) => {
          if (cancelled) return;
          // Store source element for per-frame cropping
          videoRef.current = el;

          videoTexture = new THREE.CanvasTexture(cropCanvas);
          videoTexture.minFilter = THREE.LinearFilter;
          videoTexture.magFilter = THREE.LinearFilter;
          videoTexture.colorSpace = THREE.SRGBColorSpace;
          videoTexture.flipY = false;
          videoTexture.wrapS = THREE.ClampToEdgeWrapping;
          videoTexture.wrapT = THREE.ClampToEdgeWrapping;
          textureRef.current = videoTexture;

          // Store crop context for useFrame
          cropCanvas._ctx = cropCtx;
          cropCanvas._source = el;
          textureRef.current._cropCanvas = cropCanvas;
        }).catch(() => {});
      };
      pollForContainer();
      cleanupFns.push(() => { cancelled = true; });
    } else if (videoSrc) {
      // --- Video file mode (only when a valid source is provided) ---
      const video = document.createElement("video");
      video.src = videoSrc;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      videoRef.current = video;

      videoTexture = new THREE.VideoTexture(video);
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;
      videoTexture.colorSpace = THREE.SRGBColorSpace;
      videoTexture.flipY = false;
      videoTexture.wrapS = THREE.ClampToEdgeWrapping;
      videoTexture.wrapT = THREE.ClampToEdgeWrapping;
      textureRef.current = videoTexture;

      video.addEventListener("canplay", () => {
        video.play().catch(() => {
          const resume = () => {
            video.play();
            window.removeEventListener("click", resume);
            window.removeEventListener("touchstart", resume);
          };
          window.addEventListener("click", resume);
          window.addEventListener("touchstart", resume);
        });
      });
      video.load();

      const unmute = () => {
        video.muted = false;
        window.removeEventListener("click", unmute);
        window.removeEventListener("touchstart", unmute);
      };
      window.addEventListener("click", unmute);
      window.addEventListener("touchstart", unmute);
      cleanupFns.push(() => {
        video.pause();
        video.src = "";
        window.removeEventListener("click", unmute);
        window.removeEventListener("touchstart", unmute);
      });
    }

    // Load GLB
    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    const dracoPath =
      typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? `${window.location.origin}/draco/`
        : "/draco/";
    dracoLoader.setDecoderPath(dracoPath);
    gltfLoader.setDRACOLoader(dracoLoader);

    gltfLoader.load(
      modelUrl,
      (gltf) => {
        const model = gltf.scene;

        let foundFace = false;
        model.traverse((child) => {
          if (child.isMesh) {
            if (child.name === "Face") {
              foundFace = true;
              faceMeshRef.current = child;
              // Face mesh stays always visible with its original material
            }

            if (child.name === "Face2") {
              face2MeshRef.current = child;
              const face2Mat = new THREE.MeshBasicMaterial({
                map: textureRef.current || null,
                toneMapped: false,
                side: THREE.DoubleSide,
              });
              child.material = face2Mat;
              child.userData.faceMaterial = face2Mat;
              child.visible = false; // Shown only in Talking mode
            }

          }

          // Find eye meshes — default pair and textWalk pair
          // Clone material for _Text eyes so they don't share opacity with default eyes
          if (child.name === "EyeL") {
            leftEyeRef.current = child;
            if (child.material) { child.material.transparent = true; child.material.needsUpdate = true; }
          } else if (child.name === "EyeR") {
            rightEyeRef.current = child;
            if (child.material) { child.material.transparent = true; child.material.needsUpdate = true; }
          } else if (child.name === "EyeL_Text") {
            leftEyeTextRef.current = child;
            if (child.material) { child.material = child.material.clone(); child.material.transparent = true; child.material.needsUpdate = true; }
            child.visible = false;
          } else if (child.name === "EyeR_Text") {
            rightEyeTextRef.current = child;
            if (child.material) { child.material = child.material.clone(); child.material.transparent = true; child.material.needsUpdate = true; }
            child.visible = false;
          } else if (child.name === "demon_eyes") {
            demonEyesRef.current = child;
            if (child.material) {
              child.material.transparent = true;
              child.material.needsUpdate = true;
              // Store original textures and preload half-lidded variant
              demonEyesDefaultTexRef.current = child.material.map;
              demonEyesDefaultEmissiveRef.current = child.material.emissiveMap;
              new THREE.TextureLoader().load("/images/demonEyes_half2.webp", (tex) => {
                tex.flipY = child.material.map ? child.material.map.flipY : false;
                tex.colorSpace = THREE.SRGBColorSpace;
                demonEyesHalfTexRef.current = tex;
              });
            }
          } else if (child.name === "SmartPhone" || child.name === "phone") {
            smartPhoneRef.current = child;
          }

          // Skateboard and root bone for programmatic sync
          if (child.name === "SM_Prop_Skateboard_01") {
            skateboardRef.current = child;
            const basePos = child.position.clone();
            basePos._origRot = child.rotation.clone();
            skateboardBasePos.current = basePos;
          }
          if (child.isBone && child.name === "Foot_L" && !rootBoneRef.current) {
            rootBoneRef.current = child;
          }
        });


        // Set up animations
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          mixerRef.current = mixer;
          const clipNames = [];
          gltf.animations.forEach((clip) => {
            // Strip any tracks targeting Face/Face2 meshes so animations
            // don't override programmatic visibility/scale control
            clip.tracks = clip.tracks.filter(
              (t) => !t.name.startsWith("Face.") && !t.name.startsWith("Face2.")
            );
            // Strip root motion (X/Z) from Pelvis position track so character stays in place
            const pelvisTrack = clip.tracks.find(t => t.name === "Pelvis.position");
            if (pelvisTrack) {
              const values = pelvisTrack.values;
              const initX = values[0];
              const initZ = values[2];
              for (let i = 0; i < values.length; i += 3) {
                values[i] = initX;       // lock X
                values[i + 2] = initZ;   // lock Z
                // values[i+1] (Y) stays for vertical bobbing
              }
            }
            const action = mixer.clipAction(clip);
            actionsRef.current[clip.name] = action;
            clipNames.push(clip.name);
          });
          if (onClipsLoaded) onClipsLoaded(clipNames);
          // Play the default walk animation, or fall back to first clip
          if (clipNames.length > 0) {
            let first = defaultAnimRef.current || activeAnim || clipNames[0];
            if (first === "skateSequence" && actionsRef.current["skate2"]) {
              first = "skate2";
            }
            if (actionsRef.current[first]) {
              actionsRef.current[first].play();
            } else {
              actionsRef.current[clipNames[0]].play();
            }
          }
        }

        if (groupRef.current) {
          // Scale to zero until mixer settles (prevents T-pose flash)
          model.scale.set(0, 0, 0);
          groupRef.current.add(model);
          pendingModelRef.current = model;
          pendingFrameCount.current = 0;
        }
        // Expose model group for particle transition
        if (modelRef) modelRef.current = groupRef.current;
      },
      undefined,
      undefined
    );

    return () => {
      cleanupFns.forEach((fn) => fn());
      if (textureRef.current) { textureRef.current.dispose(); textureRef.current = null; }
      if (mixerRef.current) { mixerRef.current.stopAllAction(); mixerRef.current.uncacheRoot(mixerRef.current.getRoot()); }
      actionsRef.current = {};
      skateboardRef.current = null;
      rootBoneRef.current = null;
      skateboardReparented.current = false;
      faceMeshRef.current = null;
      face2MeshRef.current = null;
      leftEyeRef.current = null;
      rightEyeRef.current = null;
      leftEyeTextRef.current = null;
      rightEyeTextRef.current = null;
      demonEyesRef.current = null;
      if (demonEyesHalfTexRef.current) { demonEyesHalfTexRef.current.dispose(); demonEyesHalfTexRef.current = null; }
      demonEyesDefaultTexRef.current = null;
      demonEyesDefaultEmissiveRef.current = null;
      smartPhoneRef.current = null;
      cropCanvasRef.current = null;
      cropCtxRef.current = null;
      sitePalSourceRef.current = null;
      // Dispose and remove old models from group
      if (groupRef.current) {
        while (groupRef.current.children.length) {
          const child = groupRef.current.children[0];
          groupRef.current.remove(child);
          disposeObject(child);
        }
      }
      dracoLoader.dispose();
    };
  }, [videoSrc, useSitePal, sitePalContainerId, modelUrl]);

  // Skate sequence refs
  const skateListenerRef = useRef(null);

  // Switch animation when activeAnim changes
  useEffect(() => {
    if (!activeAnim || !mixerRef.current) return;
    const actions = actionsRef.current;
    const mixer = mixerRef.current;

    // Clean up any previous skate sequence listener
    if (skateListenerRef.current) {
      mixer.removeEventListener("loop", skateListenerRef.current);
      skateListenerRef.current = null;
    }

    // Skate sequence: alternate 2x skate2 → 3x skate3 with crossfade blending
    if (activeAnim === "skateSequence" && actions["skate2"] && actions["skate3"]) {
      const FADE = 1.2;
      // Stop everything except skate2
      Object.entries(actions).forEach(([name, action]) => {
        if (name !== "skate2") action.stop();
      });

      const skate2 = actions["skate2"];
      const skate3 = actions["skate3"];
      let phase = "skate2";
      let loopCount = 0;

      // Let clips loop naturally — no manual restarting
      skate2.reset().setLoop(THREE.LoopRepeat, Infinity).play();

      const onLoop = (e) => {
        if (phase === "skate2" && e.action === skate2) {
          loopCount++;
          if (loopCount >= 2) {
            // Crossfade to skate3
            phase = "skate3";
            loopCount = 0;
            skate3.reset().setLoop(THREE.LoopRepeat, Infinity).play();
            skate2.crossFadeTo(skate3, FADE, false);
          }
        } else if (phase === "skate3" && e.action === skate3) {
          loopCount++;
          if (loopCount >= 3) {
            // Crossfade back to skate2
            phase = "skate2";
            loopCount = 0;
            skate2.reset().setLoop(THREE.LoopRepeat, Infinity).play();
            skate3.crossFadeTo(skate2, FADE, false);
          }
        }
      };

      mixer.addEventListener("loop", onLoop);
      skateListenerRef.current = onLoop;
      return;
    }

    // Default: fade out all, fade in selected
    Object.entries(actions).forEach(([name, action]) => {
      if (name === activeAnim) {
        action.reset().fadeIn(0.3).play();
      } else {
        action.fadeOut(0.3);
      }
    });
  }, [activeAnim]);

  // Control SitePal volume via its API based on Talking mode
  useEffect(() => {
    if (!useSitePal) return;
    const isTalking = activeAnim === "Talking";

    // Use SitePal's setPlayerVolume API (0 = mute, 7 = default)
    const trySetVolume = () => {
      if (typeof window.setPlayerVolume === "function") {
        window.setPlayerVolume(isTalking ? 7 : 0);
        return true;
      }
      return false;
    };

    // SitePal API may not be ready yet, poll briefly
    if (!trySetVolume()) {
      const poll = setInterval(() => {
        if (trySetVolume()) clearInterval(poll);
      }, 300);
      const stop = setTimeout(() => clearInterval(poll), 5000);
      return () => { clearInterval(poll); clearTimeout(stop); };
    }
  }, [activeAnim, useSitePal]);

  const cropControls = { cropX: 215, cropY: 60, cropW: 170, cropH: 210, rotateZ: 0, rotateX: 0 };
  const videoControls = { repeatX: 0.75, repeatY: 0.5, offsetX: 0.185, offsetY: 0.165 };

  const cropCanvasRef = useRef(null);
  const cropCtxRef = useRef(null);
  const sitePalSourceRef = useRef(null);

  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }

    // Restore model scale after mixer has settled into the pose
    if (pendingModelRef.current) {
      pendingFrameCount.current++;
      if (pendingFrameCount.current >= 8) {
        pendingModelRef.current.scale.set(1, 1, 1);
        pendingModelRef.current = null;

      }
    }

    // Sync skateboard to foot bone — XZ tracks laterally, Y follows bone so
    // the board stays under the foot even when animations have different heights
    if (skateboardRef.current && rootBoneRef.current && skateboardBasePos.current) {
      const boneWorld = _boneWorldVec;
      rootBoneRef.current.getWorldPosition(boneWorld);
      // Convert to skateboard's parent local space
      if (skateboardRef.current.parent) {
        skateboardRef.current.parent.worldToLocal(boneWorld);
      }
      skateboardRef.current.position.x = boneWorld.x;
      skateboardRef.current.position.z = boneWorld.z;
      skateboardRef.current.position.y = boneWorld.y - 0.18;
      // Keep original rotation so it stays flat
      skateboardRef.current.rotation.set(
        skateboardBasePos.current._origRot?.x ?? 0,
        skateboardBasePos.current._origRot?.y ?? 0,
        skateboardBasePos.current._origRot?.z ?? 0,
   
      );
    }

    // Only show skateboard during skate animations
    // Check activeAnim prop, plus what the mixer is actually playing (covers
    // the frames before React state propagates after model load)
    if (skateboardRef.current) {
      const skateAnims = ["skateSequence", "skate1", "skate2", "skate3"];
      let mixerPlaying = false;
      if (mixerRef.current && actionsRef.current) {
        mixerPlaying = ["skate2", "skate3"].some(
          (name) => actionsRef.current[name]?.isRunning()
        );
      }
      const isSkating = skateAnims.includes(activeAnim) || mixerPlaying;
      skateboardRef.current.visible = isSkating;
    }

    // Smoothly rotate character to face camera when talking
    if (groupRef.current) {
      const shouldFaceCamera = activeAnim === "Talking" || activeAnim === "Idle" || activeAnim === "idle";
      if (shouldFaceCamera) {
        // Calculate angle from model to camera
        const cam = state.camera.position;
        const targetY = Math.atan2(cam.x - groupRef.current.position.x, cam.z - groupRef.current.position.z);
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetY, 3 * delta);
      } else {
        // Lerp back to default forward rotation
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, 0, 3 * delta);
      }
    }

    // Grab refs from the texture once available
    if (useSitePal && textureRef.current?._cropCanvas && !cropCanvasRef.current) {
      cropCanvasRef.current = textureRef.current._cropCanvas;
      cropCtxRef.current = cropCanvasRef.current._ctx;
      sitePalSourceRef.current = cropCanvasRef.current._source;
    }

    // SitePal mode: crop source into our texture canvas each frame
    if (useSitePal && cropCtxRef.current && sitePalSourceRef.current) {
      const ctx = cropCtxRef.current;
      const src = sitePalSourceRef.current;
      const canvas = cropCanvasRef.current;
      const { cropX, cropY, cropW, cropH, rotateZ, rotateX } = cropControls;
      // Fill with skin tone first so edges blend
      ctx.fillStyle = "#9F7854";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      try {
        ctx.save();
        // Apply rotations around center
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotateZ * Math.PI) / 180);
        // Simulate X rotation with a vertical scale
        const xScale = Math.cos((rotateX * Math.PI) / 180);
        ctx.scale(1, xScale);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
        ctx.drawImage(src, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      } catch (e) {
        // source may not be ready yet
      }
      if (textureRef.current) textureRef.current.needsUpdate = true;
    } else if (!useSitePal && textureRef.current) {
      // Video mode: use repeat/offset
      textureRef.current.needsUpdate = true;
      textureRef.current.repeat.set(videoControls.repeatX, videoControls.repeatY);
      textureRef.current.offset.set(videoControls.offsetX, videoControls.offsetY);
    }

    // Eye/Face animation — toggle between eye sets and Face mesh
    const leftEye = leftEyeRef.current;
    const rightEye = rightEyeRef.current;
    const leftEyeText = leftEyeTextRef.current;
    const rightEyeText = rightEyeTextRef.current;
    const isTalking = activeAnim === "Talking";
    const useTextEyes = !isTalking && (activeAnim === "textWalk" || activeAnim === "Praying");
    const useDefaultEyes = !isTalking && !useTextEyes;

    // Toggle visibility: Talking hides all eyes and shows Face; otherwise Face hidden
    if (leftEye) leftEye.visible = useDefaultEyes;
    if (rightEye) rightEye.visible = useDefaultEyes;
    if (leftEyeText) leftEyeText.visible = useTextEyes;
    if (rightEyeText) rightEyeText.visible = useTextEyes;
    // Talking mode: show Face2 (SitePal target), hide Face — but only if texture is ready
    const face2Ready = isTalking && face2MeshRef.current?.userData?.faceMaterial?.map;
    if (face2MeshRef.current) face2MeshRef.current.visible = !!face2Ready;
    if (faceMeshRef.current) faceMeshRef.current.visible = !face2Ready;

    // SmartPhone only visible during texting-walk animations
    if (smartPhoneRef.current) smartPhoneRef.current.visible = activeAnim === "textWalk" || activeAnim === "walkText";

    // Swap demon_eyes texture: half-lidded during walkText, default otherwise
    // Image is connected to both BaseColor (map) and Emission (emissiveMap) in Blender
    if (demonEyesRef.current?.material && demonEyesHalfTexRef.current) {
      const wantHalf = activeAnim === "walkText";
      const targetTex = wantHalf ? demonEyesHalfTexRef.current : demonEyesDefaultTexRef.current;
      const targetEmissive = wantHalf ? demonEyesHalfTexRef.current : demonEyesDefaultEmissiveRef.current;
      if (demonEyesRef.current.material.map !== targetTex) {
        demonEyesRef.current.material.map = targetTex;
        demonEyesRef.current.material.emissiveMap = targetEmissive;
        demonEyesRef.current.material.needsUpdate = true;
      }
    }

    // Demon eyes blink (H80Z — opacity-based, slower cadence matching CyborgTempleScene)
    if (demonEyesRef.current?.material) {
      const currentTime = state.clock.getElapsedTime() * 1000;
      const demonBlink = demonBlinkStateRef.current;

      if (!demonBlink.isBlinking && currentTime - demonBlink.lastBlinkTime > demonBlink.nextBlinkDelay) {
        demonBlink.isBlinking = true;
        demonBlink.lastBlinkTime = currentTime;
        demonBlink.nextBlinkDelay = Math.random() * 4000 + 3000;
      }

      if (demonBlink.isBlinking) {
        const closeTime = 100, holdTime = 120, openTime = 140;
        const totalDuration = closeTime + holdTime + openTime;
        const t = currentTime - demonBlink.lastBlinkTime;
        if (t < totalDuration) {
          let opacity;
          if (t < closeTime) opacity = 1 - (t / closeTime);
          else if (t < closeTime + holdTime) opacity = 0;
          else opacity = (t - closeTime - holdTime) / openTime;
          demonEyesRef.current.material.opacity = opacity;
        } else {
          demonBlink.isBlinking = false;
          demonEyesRef.current.material.opacity = 1;
        }
      }
    }

    // RL80 eye blink (separate L/R eyes, opacity-based)
    if (!demonEyesRef.current) {
      const activeMats = [];
      if (useTextEyes) {
        if (leftEyeText?.material) activeMats.push(leftEyeText.material);
        if (rightEyeText?.material) activeMats.push(rightEyeText.material);
      } else {
        if (leftEye?.material) activeMats.push(leftEye.material);
        if (rightEye?.material) activeMats.push(rightEye.material);
      }

      if (activeMats.length > 0) {
        if (activeAnim === "Pose" || isTalking) {
          activeMats.forEach(m => m.opacity = 1);
          blinkStateRef.current.isBlinking = false;
        } else {
          const currentTime = state.clock.getElapsedTime() * 1000;
          const blinkState = blinkStateRef.current;
          if (!blinkState.isBlinking && currentTime - blinkState.lastBlinkTime > blinkState.nextBlinkDelay) {
            blinkState.isBlinking = true;
            blinkState.lastBlinkTime = currentTime;
            blinkState.nextBlinkDelay = Math.random() * 3000 + 2000;
          }
          if (blinkState.isBlinking) {
            const closeTime = 100, holdTime = 80, openTime = 120;
            const totalDuration = closeTime + holdTime + openTime;
            const t = currentTime - blinkState.lastBlinkTime;
            if (t < totalDuration) {
              let opacity;
              if (t < closeTime) opacity = 1 - (t / closeTime);
              else if (t < closeTime + holdTime) opacity = 0;
              else opacity = (t - closeTime - holdTime) / openTime;
              activeMats.forEach(m => m.opacity = opacity);
            } else {
              blinkState.isBlinking = false;
              activeMats.forEach(m => m.opacity = 1);
            }
          }
        }
      }
    }

    // Late-bind texture to face material (for SitePal async load)
    if (groupRef.current && textureRef.current) {
      groupRef.current.traverse((child) => {
        if (child.userData?.faceMaterial && textureRef.current) {
          if (!child.userData.faceMaterial.map) {
            child.userData.faceMaterial.map = textureRef.current;
            child.userData.faceMaterial.needsUpdate = true;
          }
        }
      });
    }
  });

  return <group ref={groupRef} position={[0, 0, zOffset]} />;
}

/* ── Per-character speech config ── */
const CHARACTER_SPEECH = {
  // Our Lady — walks in texting, then notices the viewer
  "fortuneTeller": {
    delay: 3000,           // ms after clips load before switching to Talking
    text: "Oh, hello!",
    voice: 3,
    lang: 1,
    engine: 3,
    linger: 3000,          // ms to stay in Talking after speech ends
  },
  // Add more characters here as needed:
  // "GR80": { delay: 4000, text: "...", voice: 3, lang: 1, engine: 3 },
};

/** Match a model URL to its speech config key */
function getSpeechConfig(modelUrl) {
  if (!modelUrl) return null;
  for (const key of Object.keys(CHARACTER_SPEECH)) {
    if (modelUrl.includes(key)) return CHARACTER_SPEECH[key];
  }
  return null;
}

export default function MainScene({ onLoaded, useSitePal = false, onAnimChange, characterModel, defaultAnim, characterZOffset = 0, glitchIntensity = 0, isMobile = false, holdTalking = false }) {
  const [clipNames, setClipNames] = useState([]);
  const [activeAnim, setActiveAnim] = useState(null);
  const characterModelRef = useRef(null);
  const controlsRef = useRef(null);
  const speechTimerRef = useRef(null);
  const hasSpokeRef = useRef(false);

  // Detect if current character is the cat (small/low to ground)
  const isCat = characterModel?.includes("fluffyCat");
  const isCatIdle = isCat && (activeAnim === "idle" || activeAnim === "Idle");

  // H80Z alternates between skateSequence and walkText each appearance
  const isH80Z = characterModel?.includes("H80Z");
  const h80zVisitCount = useRef(0);
  // GR80 alternates between walk, walkText, and pray each appearance
  const isGR80 = characterModel?.includes("GR80");
  const gr80VisitCount = useRef(0);
  const GR80_ANIMS = ["walk", "walkText", "pray"];

  const resolvedAnimRef = useRef(defaultAnim);

  // Track character visits and resolve the actual animation to use
  useEffect(() => {
    if (isH80Z) {
      h80zVisitCount.current++;
      const anim = h80zVisitCount.current % 2 === 0 ? "walkText" : "skateSequence";
      console.log("[MainScene] H80Z visit:", h80zVisitCount.current, "→", anim);
      resolvedAnimRef.current = anim;
    } else if (isGR80) {
      gr80VisitCount.current++;
      const anim = GR80_ANIMS[gr80VisitCount.current % GR80_ANIMS.length];
      console.log("[MainScene] GR80 visit:", gr80VisitCount.current, "→", anim);
      resolvedAnimRef.current = anim;
    } else {
      resolvedAnimRef.current = defaultAnim;
    }
  }, [characterModel]);

  // When defaultAnim changes, apply it (for non-alternating characters)
  useEffect(() => {
    if (!isH80Z && !isGR80 && defaultAnim && clipNames.includes(defaultAnim)) {
      setActiveAnim(defaultAnim);
    }
  }, [defaultAnim]);

  const handleClipsLoaded = useCallback((names) => {
    // Add virtual "skateSequence" if this model has both skate clips
    const allNames = names.includes("skate2") && names.includes("skate3") && !names.includes("skateSequence")
      ? ["skateSequence", ...names]
      : names;
    setClipNames(allNames);
    const anim = resolvedAnimRef.current;
    if (allNames.length > 0) {
      const initial = anim && allNames.includes(anim) ? anim : allNames[0];
      console.log("[MainScene] clipsLoaded, resolvedAnim:", anim, "→ initial:", initial);
      setActiveAnim(initial);
    }
  }, []);

  // Keep parent in sync with animation state
  useEffect(() => {
    if (onAnimChange) onAnimChange(activeAnim);
  }, [activeAnim, onAnimChange]);

  // ── Speech trigger: disabled for now — characters continue their default anim.
  //    Re-enable when UI-driven interaction is added. ──
  useEffect(() => {
    if (speechTimerRef.current) {
      clearTimeout(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    if (lingerTimerRef.current) {
      clearTimeout(lingerTimerRef.current);
      lingerTimerRef.current = null;
    }
    hasSpokeRef.current = false;
  }, [characterModel]);

  useEffect(() => {
    // Speech trigger intentionally disabled — will be re-enabled with interaction UI
    return () => {
      if (speechTimerRef.current) {
        clearTimeout(speechTimerRef.current);
        speechTimerRef.current = null;
      }
    };
  }, [clipNames, characterModel]);

  // ── vh_talkEnded: when SitePal finishes speaking, linger then return to walk ──
  const lingerTimerRef = useRef(null);
  const holdTalkingRef = useRef(holdTalking);
  holdTalkingRef.current = holdTalking;

  useEffect(() => {
    const revert = () => {
      // Don't revert if chat drawer is open
      if (holdTalkingRef.current) return;
      const fallback = resolvedAnimRef.current || defaultAnim || clipNames[0];
      if (fallback && clipNames.includes(fallback)) {
        setActiveAnim(fallback);
      }
    };

    const onTalkEnded = () => {
      if (!hasSpokeRef.current || activeAnim !== "Talking") return;

      const speech = getSpeechConfig(characterModel);
      const lingerMs = speech?.linger ?? 0;

      if (holdTalkingRef.current) return; // chat is open, stay in Talking

      if (lingerMs > 0) {
        lingerTimerRef.current = setTimeout(revert, lingerMs);
      } else {
        revert();
      }
    };

    window.vh_talkEnded = onTalkEnded;
    return () => {
      if (window.vh_talkEnded === onTalkEnded) {
        window.vh_talkEnded = undefined;
      }
      if (lingerTimerRef.current) {
        clearTimeout(lingerTimerRef.current);
        lingerTimerRef.current = null;
      }
    };
  }, [activeAnim, clipNames, defaultAnim, characterModel]);

  // holdTalking: keep character in Talking while chat is active, revert when released
  useEffect(() => {
    if (holdTalking && hasSpokeRef.current && activeAnim !== "Talking" && clipNames.includes("Talking")) {
      // Chat is active but she drifted away — snap back to Talking
      setActiveAnim("Talking");
    } else if (!holdTalking && hasSpokeRef.current && activeAnim === "Talking") {
      // Chat dismissed — revert to walk
      const fallback = resolvedAnimRef.current || defaultAnim || clipNames[0];
      if (fallback && clipNames.includes(fallback)) {
        setActiveAnim(fallback);
      }
    }
  }, [holdTalking, activeAnim]);

  const handleCreated = () => {
    if (onLoaded) onLoaded();
  };

  // Chromatic aberration offset scales with glitch intensity
  const caOffset = useMemo(() => new THREE.Vector2(0, 0), []);
  caOffset.set(glitchIntensity * 0.02, glitchIntensity * 0.01);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
    <Canvas
      camera={{ position: isMobile ? [-0.5, 0.8, 3.2] : [-1.5, 1.0, 3], fov: isMobile ? 55 : 50 }}
      onCreated={(state) => {
        // Recover from WebGL context loss (e.g. SitePal stealing context)
        const canvas = state.gl.domElement;
        canvas.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
        });
        canvas.addEventListener("webglcontextrestored", () => {
          state.gl.forceContextRestore?.();
        });
        handleCreated();
      }}
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <DuskySky />
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[0, 2, 2]} intensity={0.8} color="#ffd36b" />
      {/* Front spotlight on character */}
      <DebugSpotLight
        position={[0, 3, 4]}
        targetPosition={[0, 1, 0]}
        angle={0.4}
        penumbra={0.6}
        intensity={3}
        color="#ffe0c0"
        distance={12}
        debug={false}
      />
      <FortuneTellerModel useSitePal={useSitePal} activeAnim={activeAnim} defaultAnim={defaultAnim} onClipsLoaded={handleClipsLoaded} modelRef={characterModelRef} modelUrl={characterModel} zOffset={characterZOffset} />
      {/* Transition effect handled by page-level GlitchTransition overlay */}
      <SynthwaveSun position={[10, 3, -15]} scale={1} />
      <Skyline position={[0, -0.5, 30]} rotation={[0, 0, 0]} scale={0.25} />
      {/* Scrolling environment — always mounted, stops when not walking */}
      {(() => {
        const isSkate = activeAnim === "skateSequence" || activeAnim === "sequence" || activeAnim === "skate1" || activeAnim === "skate2" || activeAnim === "skate3";
        const isMoving = activeAnim === "textWalk" || activeAnim === "walkText" || activeAnim === "Walk" || activeAnim === "walk" || isSkate;
        const groundSpeed = isSkate ? 0.9 : 0.3;
        const treeSpeed = isSkate ? 4.5 : 1.5;
        return (
          <>
            <ScrollingGround speed={groundSpeed} isWalking={isMoving} />
            <ScrollingTrees speed={treeSpeed} isWalking={isMoving} spacing={4} count={16} xOffset={3} zOffset={20} />
          </>
        );
      })()}
      <fog attach="fog" args={["#1a0e14", 8, 28]} />
      {/* <Godray
        debug={true}
        settings={{
          position: [-0.6, 4.6, 1.3],
          rotation: [-3.06, -1.02, -0.23],
          color: "#c4bdae",
          topRadius: 1,
          bottomRadius: 0.1,
          height: 15.1,
          timeSpeed: 1.11,
          noiseScale: 12.3,
          smoothBottom: 0,
          smoothTop: 0.85,
          fresnelPower: 1,
        }}
      /> */}
      <DebugSpotLight
        position={[-0.6, 4.6, 1.3]}
        targetPosition={[0, 0.5, 0]}
        angle={0.35}
        penumbra={0.7}
        intensity={100.5}
        color="#c4bdae"
        distance={15}
        debug={false}
      />
      <OrbitControls
        ref={controlsRef}
        target={isMobile ? [0.1, 0.8, 0] : [1, 1.2, 0]}
        minDistance={1.5}
        maxDistance={4}
        enablePan={false}
        zoomToCursor
      />
      <CameraZoom
        active={isCat}
        cameraPos={isMobile ? [0, 0.4, 2.0] : [0, 0.5, 2.2]}
        targetPos={[0, 0.3, 0]}
        lerpSpeed={2}
        controlsRef={controlsRef}
      />
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.8}
          luminanceSmoothing={0.3}
          radius={0.2}
          intensity={1.5 + glitchIntensity * 3}
          mipmapBlur
        />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={caOffset}
          radialModulation={false}
          modulationOffset={0.5}
        />
      </EffectComposer>
    </Canvas>
    </div>
  );
}
