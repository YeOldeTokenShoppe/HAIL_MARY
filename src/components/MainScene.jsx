"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import * as THREE from "three";
import { Godray } from "./GodRay";
// import GPGPUParticleTransition from "./GPGPUParticleTransition";

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
      <meshStandardMaterial transparent opacity={0.9} />
    </mesh>
  );
}

/* ── Drifting environment particles ── */
function DriftingParticles({ count = 120, speed = 1.5, isWalking = true }) {
  const pointsRef = useRef();
  const positionsRef = useRef();

  useEffect(() => {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 16;       // x spread
      positions[i * 3 + 1] = Math.random() * 5 + 0.1;      // y height
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;   // z spread
    }
    positionsRef.current = positions;
    if (pointsRef.current) {
      pointsRef.current.geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );
    }
  }, [count]);

  useFrame((_, delta) => {
    if (!positionsRef.current || !pointsRef.current || !isWalking) return;
    const pos = positionsRef.current;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 2] += speed * delta;
      // Wrap around when past camera
      if (pos[i * 3 + 2] > 10) {
        pos[i * 3 + 2] = -10;
        pos[i * 3] = (Math.random() - 0.5) * 16;
        pos[i * 3 + 1] = Math.random() * 5 + 0.1;
      }
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry />
      <pointsMaterial
        size={0.03}
        color="#8ab4f8"
        transparent
        opacity={0.4}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
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
          groupRef.current.remove(groupRef.current.children[0]);
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

/* ── Scrolling palm trees along both sides ── */
function ScrollingTrees({ speed = 0.8, isWalking = true, spacing = 4, count = 8, xOffset = 3 }) {
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
          const z = -stripLen / 2 + i * spacing;
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
          groupRef.current.remove(groupRef.current.children[0]);
        }
      }
    };
  }, [count, spacing, xOffset, stripLen]);

  useFrame((_, delta) => {
    if (!isWalking || treesRef.current.length === 0) return;
    const halfStrip = stripLen / 2;
    for (const tree of treesRef.current) {
      tree.mesh.position.z -= speed * delta;
      // Wrap around when tree passes behind
      if (tree.mesh.position.z < -halfStrip) {
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
      // SitePal renders into a canvas or video inside the container
      const el =
        container.querySelector("canvas") ||
        container.querySelector("video");
      if (el) {
        resolve(el);
        return;
      }
      // Also check iframes — SitePal may use one
      const iframe = container.querySelector("iframe");
      if (iframe) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          const iframeEl =
            iframeDoc.querySelector("canvas") ||
            iframeDoc.querySelector("video");
          if (iframeEl) {
            resolve(iframeEl);
            return;
          }
        } catch (e) {
          // cross-origin iframe, can't access
        }
      }
      if (Date.now() - start > timeout) {
        reject(new Error("SitePal render element not found"));
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}


function FortuneTellerModel({ videoSrc = "", useSitePal = false, sitePalContainerId = "sitepal-container", activeAnim, onClipsLoaded, modelRef, modelUrl = "/models/fortuneTeller_not3.glb" }) {
  const groupRef = useRef();
  const videoRef = useRef(null);
  const mixerRef = useRef(null);
  const textureRef = useRef(null);
  const actionsRef = useRef({});
  const pendingModelRef = useRef(null); // model hidden until mixer ticks
  const pendingFrameCount = useRef(0);

  // Eye mesh refs for blinking animation
  const leftEyeRef = useRef();
  const rightEyeRef = useRef();
  const leftEyeTextRef = useRef();
  const rightEyeTextRef = useRef();
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
      // --- SitePal mode: find the render element and use as texture ---
      const container = document.getElementById(sitePalContainerId);
      if (!container) return;

      // Create an intermediary canvas to crop the SitePal face
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = 512;
      cropCanvas.height = 512;
      const cropCtx = cropCanvas.getContext("2d");

      waitForSitePalElement(container).then((el) => {
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
    } else {
      // --- Video file mode ---
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
          } else if (child.name === "SmartPhone") {
            smartPhoneRef.current = child;
          }
        });

        // Set up animations
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          mixerRef.current = mixer;
          const clipNames = [];
          gltf.animations.forEach((clip) => {
            const action = mixer.clipAction(clip);
            actionsRef.current[clip.name] = action;
            clipNames.push(clip.name);
          });
          if (onClipsLoaded) onClipsLoaded(clipNames);
          // Play the first clip by default
          if (clipNames.length > 0) {
            const first = activeAnim || clipNames[0];
            if (actionsRef.current[first]) {
              actionsRef.current[first].play();
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
      if (textureRef.current) textureRef.current.dispose();
      if (mixerRef.current) mixerRef.current.stopAllAction();
      // Clear old model from group on reload
      if (groupRef.current) {
        while (groupRef.current.children.length) {
          groupRef.current.remove(groupRef.current.children[0]);
        }
      }
    };
  }, [videoSrc, useSitePal, sitePalContainerId, modelUrl]);

  // Switch animation when activeAnim changes
  useEffect(() => {
    if (!activeAnim || !mixerRef.current) return;
    const actions = actionsRef.current;
    // Fade out all, fade in selected
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

  const cropControls = { cropX: 230, cropY: 110, cropW: 200, cropH: 230, rotateZ: 0, rotateX: 0 };
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

    // Smoothly rotate character to face camera when talking
    if (groupRef.current) {
      const isTalkingNow = activeAnim === "Talking";
      if (isTalkingNow) {
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
    // Talking mode: show Face2 (SitePal target), hide Face
    if (face2MeshRef.current) face2MeshRef.current.visible = isTalking;
    if (faceMeshRef.current) faceMeshRef.current.visible = !isTalking;

    // Hide SmartPhone during Praying and Talking
    if (smartPhoneRef.current) smartPhoneRef.current.visible = activeAnim !== "Praying" && activeAnim !== "Talking";

    // Pick active eye materials for blink
    const activeMats = [];
    if (useTextEyes) {
      if (leftEyeText?.material) activeMats.push(leftEyeText.material);
      if (rightEyeText?.material) activeMats.push(rightEyeText.material);
    } else {
      if (leftEye?.material) activeMats.push(leftEye.material);
      if (rightEye?.material) activeMats.push(rightEye.material);
    }

    if (activeMats.length === 2) {
      if (activeAnim === "Pose" || isTalking) {
        // No blink in Pose
        activeMats.forEach(m => m.opacity = 1);
        blinkStateRef.current.isBlinking = false;
      } else {
        // Blink animation
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

  return <group ref={groupRef} />;
}

export default function MainScene({ onLoaded, useSitePal = false, onAnimChange, characterModel, glitchIntensity = 0 }) {
  const [clipNames, setClipNames] = useState([]);
  const [activeAnim, setActiveAnim] = useState(null);
  const characterModelRef = useRef(null);


  const handleClipsLoaded = useCallback((names) => {
    setClipNames(names);
    if (names.length > 0) setActiveAnim(names[0]);
  }, []);

  const handleCreated = () => {
    if (onLoaded) onLoaded();
  };

  // Chromatic aberration offset scales with glitch intensity
  const caOffset = useMemo(() => new THREE.Vector2(0, 0), []);
  caOffset.set(glitchIntensity * 0.02, glitchIntensity * 0.01);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Temp animation selector */}
      {clipNames.length > 0 && (
        <select
          value={activeAnim || ""}
          onChange={(e) => { setActiveAnim(e.target.value); if (onAnimChange) onAnimChange(e.target.value); }}
          style={{
            position: "absolute",
            bottom: 12,
            left: 12,
            zIndex: 10,
            padding: "6px 10px",
            background: "rgba(0,0,0,0.7)",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.3)",
            borderRadius: 6,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          {clipNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      )}
      {activeAnim === "Talking" && (
        <button
          onClick={() => {
            try {
              // Get the scene's assigned audio and play it
              if (typeof window.getSceneAttributes === "function") {
                const attr = window.getSceneAttributes();
                if (attr?.audioName && typeof window.sayAudio === "function") {
                  window.sayAudio(attr.audioName);
                  return;
                }
              }
              if (typeof window.sayAudio === "function") {
                window.sayAudio("");
              }
            } catch (e) {
              // SitePal speak error
            }
          }}
          style={{
            position: "absolute",
            top: 12,
            left: 200,
            zIndex: 10,
            padding: "8px 16px",
            background: "rgba(0,0,0,0.7)",
            color: "#ffd36b",
            border: "1px solid rgba(255,215,0,0.4)",
            borderRadius: 6,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Speak
        </button>
      )}
    <Canvas
      camera={{ position: [-1.5, 1.5, 3], fov: 50 }}
      onCreated={handleCreated}
      style={{ width: "100%", height: "100%" }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
    >
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[0, 2, 2]} intensity={0.8} color="#ffd36b" />
      <FortuneTellerModel useSitePal={useSitePal} activeAnim={activeAnim} onClipsLoaded={handleClipsLoaded} modelRef={characterModelRef} modelUrl={characterModel} />
      {/* Transition effect handled by page-level GlitchTransition overlay */}
      <SynthwaveSun position={[10, 3, -15]} scale={1} />
      {/* Scrolling environment — always mounted, stops when not walking */}
      <ScrollingGround speed={0.3} isWalking={activeAnim === "textWalk" || activeAnim === "Walk" || activeAnim === "walk"} />
      <DriftingParticles count={120} speed={1.5} isWalking={activeAnim === "textWalk" || activeAnim === "Walk" || activeAnim === "walk"} />
      <ScrollingTrees speed={1.5} isWalking={activeAnim === "textWalk" || activeAnim === "Walk" || activeAnim === "walk"} spacing={4} count={8} xOffset={3} />
      <fog attach="fog" args={["#0a0a0f", 5, 25]} />
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
      <spotLight
        position={[-0.6, 4.6, 1.3]}
        target-position={[0, 0.5, 0]}
        angle={0.3}
        penumbra={0.8}
        intensity={2}
        color="#c4bdae"
        distance={15}
        castShadow={false}
      />
      <OrbitControls
        target={[0, 1.2, 0]}
        minDistance={1.5}
        maxDistance={4}
        enablePan={false}
        // zoomToCursor
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
