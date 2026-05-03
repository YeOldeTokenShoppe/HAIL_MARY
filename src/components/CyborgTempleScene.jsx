import { useEffect, useRef, useState, useMemo } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { Html, SpotLight } from "@react-three/drei";
import AnnotationSystem from "@/components/AnnotationSystem";
import { db, collection, query, orderBy, limit, getDocs } from '@/lib/firebaseClient';
import HolographicStatue3 from "@/components/HolographicStatue3";

// Agent camera focus settings — module-level so the dev tuning panel
// (CameraTuningPanel) can mutate values in place. The click handler reads
// from this object on every focus, so live edits take effect on the next
// agent click without a reload.
//
// Mobile shifts the entire workstation along the Y axis, so on mobile we
// apply a single global Y offset (MOBILE_Y_OFFSET below) to cameraPos /
// lookAtPos / orbitCenter when resolving for a click. Tune via the panel.
export const MOBILE_CAMERA_OFFSET = { y: 0.7 };

export const AGENT_CAMERA_SETTINGS = {
  RL80: {
    cameraPos: new THREE.Vector3(1.91, -0.07, 0.595),
    lookAtPos: new THREE.Vector3(-0.775, -0.73, 0.755),
    orbitCenter: null,
  },
  Demon: {
    cameraPos: new THREE.Vector3(-1.88, -0.02, -0.47),
    lookAtPos: new THREE.Vector3(0.605, -0.235, -2.06),
    // orbitCenter: new THREE.Vector3(-1.554, -0.35, -1.351),
  },
  Monk: {
    cameraPos: new THREE.Vector3(-0.61, -0.31, 1.645),
    lookAtPos: new THREE.Vector3(-1.295, -0.305, 0.085),
    orbitCenter: null,
  },

  Fluffy: {
    cameraPos: new THREE.Vector3(0.54, 0.11, -1.65),
    lookAtPos: new THREE.Vector3(1.87, -1.35, 0.745),
    orbitCenter: null,
  },
  // Granny — placeholder cameraPos/lookAtPos. Tune via the in-app
  // CameraTuningPanel (?tune=1) or by editing here directly.
  Granny: {
    cameraPos: new THREE.Vector3(0.495, -0.215, -1.915),
    lookAtPos: new THREE.Vector3(0.57, -1.075, 1.33),
    orbitCenter: null,
  },
  Angel: {
    cameraPos: new THREE.Vector3(0, 1.8, 1.2),
    lookAtPos: new THREE.Vector3(0, 1.9, 0),
    orbitCenter: null,
  },
  Screen1: {
    cameraPos: new THREE.Vector3(-0.84, -0.655, -0.81),
    lookAtPos: new THREE.Vector3(-0.48, -0.27, 1.445),
    orbitCenter: null,
  },
  Screen2: {
    cameraPos: new THREE.Vector3(-0.81, -0.605, 0.84),
    lookAtPos: new THREE.Vector3(1.57, -0.25, 0.205),
    orbitCenter: null,
  },
  Screen3: {
    cameraPos: new THREE.Vector3(0.73, -0.32, -0.77),
    lookAtPos: new THREE.Vector3(-0.585, -0.305, -0.47),
    orbitCenter: null,
  },
  Screen4: {
    cameraPos: new THREE.Vector3(0.765, -0.36, 0.66),
    lookAtPos: new THREE.Vector3(0.595, -0.35, -0.005),
    orbitCenter: null,
  },
  // ScreenA-D are the secondary (council-chat) monitors. Initial values
  // mirror each character's primary-screen sibling — tune with ?tune=1.
  ScreenA: {
    cameraPos: new THREE.Vector3(-1.27, -0.455, -0.87),
    lookAtPos: new THREE.Vector3(-1.525, -0.34, 0.31),
    orbitCenter: null,
  },
  ScreenB: {
    cameraPos: new THREE.Vector3(-0.92, -0.6, 1.28),
    lookAtPos: new THREE.Vector3(0.47, -0.32, 1.34),
    orbitCenter: null,
  },
  ScreenC: {
    cameraPos: new THREE.Vector3(0.695, -0.22, -1.12),
    lookAtPos: new THREE.Vector3(-0.865, -0.455, -1.525),
    orbitCenter: null,
  },
  ScreenD: {
    cameraPos: new THREE.Vector3(1.005, -0.49, 0.7),
    lookAtPos: new THREE.Vector3(1.615, -0.305, -1.015),
    orbitCenter: null,
  },
};

// Holographic statue (the small floating figure above the workstation).
// Desktop and mobile positions tuned independently — mobile model shifts
// the workstation up so the statue has its own offset.
export const HOLO_STATUE_DESKTOP = {
  position: [-0.085, 0.2, -0.03],
  scale: [0.5, 0.5, 0.5],
  rotation: [0, -Math.PI * 0.2, 0],
};
export const HOLO_STATUE_MOBILE = {
  position: [-0.085, 0.9, -0.03], // placeholder — tune for the mobile shift
  scale: [0.5, 0.5, 0.5],
  rotation: [0, -Math.PI * 0.2, 0],
};

// XZ nudge applied to Angel_Empty so the angel sits centered on the
// altar spotlight when viewed top-down. Y is left to the hover animation.
export const ANGEL_POSITION_OFFSET = { x: -0.10, z: 0.01 };

// Returns the active cameraPos/lookAtPos/orbitCenter for the given agent.
// On mobile, MOBILE_CAMERA_OFFSET.y is added to the Y component of every
// vector to compensate for the workstation model's mobile-only vertical
// shift. Always returns fresh THREE.Vector3 instances safe to mutate.
export function resolveAgentSettings(agentId, isMobile) {
  const base = AGENT_CAMERA_SETTINGS[agentId];
  if (!base) return null;
  const dy = isMobile ? (MOBILE_CAMERA_OFFSET.y || 0) : 0;
  const apply = (v) => {
    if (!v) return null;
    const out = v.clone();
    if (dy) out.y += dy;
    return out;
  };
  return {
    cameraPos: apply(base.cameraPos),
    lookAtPos: apply(base.lookAtPos),
    orbitCenter: apply(base.orbitCenter),
  };
}

// --- Word cluster configuration ---
const WORD_CLUSTER_WORDS = [
  '✨ blessed', '🕯️ light', '🔥 fire', '💫 cosmic', '🌟 shine',
  '⭐ glow', '🌙 luna', '☀️ sol', '💎 gem', '🪐 orbit',
  '🚀 launch', '💥 boom', '🍀 luck', '🦋 morph', '🎯 focus',
  'RL80', 'HODL', 'wagmi', 'gm', 'based',
  'moon', 'degen', 'alpha', 'bullish', 'vibes',
  'candle', 'shrine', 'prayer', 'light it up', 'blessed be',
  'to the moon', 'diamond hands', 'lets go', 'believe', 'manifest',
  'power', 'energy', 'spirit', 'flame', 'radiant',
  'eternal', 'sacred', 'divine', 'cosmic', 'infinite',
  'transcend', 'illuminate', 'ascend', 'harmony', 'unity',
  '🕯️', '🔥', '✨',
];

const WORD_GLOW_COLORS = [
  '#ff66ff', '#66ccff', '#ffd36b', '#ff9966', '#8df59a',
  '#ffa0f8', '#c6a7ff', '#ff4444', '#44ff99', '#99ccff',
];

function createWordTexture(text, colorIndex = 0) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const fontSize = 60;
  const padding = 80; // extra space for glow/shadow
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  const measured = ctx.measureText(text);
  canvas.width = Math.max(512, Math.ceil(measured.width) + padding);
  canvas.height = 128;
  // Re-set font after canvas resize (resets context)
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = WORD_GLOW_COLORS[colorIndex % WORD_GLOW_COLORS.length];
  ctx.shadowBlur = 30;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.userData = { aspect: canvas.width / canvas.height };
  return texture;
}

// --- Floating Word Cluster (adapted from CosmicOrbit for temple scene scale) ---
function FloatingWordCluster({ words = WORD_CLUSTER_WORDS, center = [0, 1.5, 0], clusterScale = 1 }) {
  const groupRef = useRef();

  const wordData = useMemo(() => {
    const n = words.length;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~2.3999 radians
    return words.map((text, i) => {
      const texture = createWordTexture(text, i);
      const aspect = texture.userData?.aspect || 4;
      // Fibonacci sphere for even distribution
      const phi = Math.acos(1 - 2 * (i + 0.5) / n); // polar angle, evenly spaced
      const theta = goldenAngle * i; // azimuthal angle, golden spiral
      // Vary radius slightly per point for depth
      const minR = 3;
      const maxR = 5;
      const r = minR + (maxR - minR) * ((i % 3) / 2.5 + Math.random() * 0.15);
      return {
        texture,
        aspect,
        radius: r,
        phi,
        theta,
        speed: 0.08 + Math.random() * 0.04,
        scale: 0.4 + Math.random() * 0.3,
      };
    });
  }, [words]);

  useEffect(() => {
    return () => {
      wordData.forEach((d) => d.texture.dispose());
    };
  }, [wordData]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.children.forEach((sprite, i) => {
      const d = wordData[i];
      if (!d) return;
      const angle = d.theta + t * d.speed;
      sprite.position.x = d.radius * Math.sin(d.phi) * Math.cos(angle);
      sprite.position.y = d.radius * Math.cos(d.phi);
      sprite.position.z = d.radius * Math.sin(d.phi) * Math.sin(angle);
      sprite.material.opacity = 0.6 + 0.2 * Math.sin(t * 2 + i);
    });
  });

  return (
    <group ref={groupRef} position={center} scale={[clusterScale, clusterScale, clusterScale]}>
      {wordData.map((d, i) => (
        <sprite key={i} scale={[d.scale * d.aspect, d.scale, 1]}>
          <spriteMaterial map={d.texture} transparent opacity={0.6} depthWrite={false} depthTest={true} />
        </sprite>
      ))}
    </group>
  );
}




const CyborgTempleScene = ({ 
  onLoad, 
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1.2, 1.2, 1.2],
  isPlaying = false, 
  currentTrack = null,
  showAnnotations = true,
  is80sMode = false,
  onAnnotationClick = null, // Callback when annotation is clicked
  onAgentClick = null, // Callback when an agent is clicked
  isMobile = false, // Pass this prop to determine device type
  onCoinFaceTap = null, // Callback when a CoinFace is tapped in agents mode (coinIndex)
  templeCandles = [], // Array of claimed candle objects from Firestore templeCandles collection
  disableCandleInteraction = false, // When true, XCandle nodes are not made clickable (no zoom-to-candle, no inspector)
  jackpotOnlyFistPump = false, // When true, FistPump only fires from slotMachineJackpot — removed from Demon's random alternation and the price-poll trigger
  gameStarted = false, // When true, the monk_hail/monk_beckon attention-getter loop is allowed to run. Held off until the user clicks START in GameOverlay.
  showCharacterHints = false, // When true, render small "?" badges over each agent's head as a tap affordance
}) => {
  const groupRef = useRef();
  const { scene, camera, gl } = useThree();
  const hasLoadedRef = useRef(false);
  // Store multiple mixers for each animated character
  const mixersRef = useRef({}); // { characterName: mixer }
  const actionsRef = useRef({}); // { characterName: { animationName: action } }
  const [loadedModel, setLoadedModel] = useState(null);
  const [detectedMobile, setDetectedMobile] = useState(false);
  const xCandleNodesRef = useRef([]); // Sorted array of XCandle01* root nodes
  const cylinderMeshRef = useRef(); // Ref for the specific cylinder mesh
  const object7MeshRef = useRef(); // Ref for Object_5 (was Object_7)
  const cube010MeshRef = useRef(); // Ref for Cube010
  
  // Refs for MOBILE.glb animated objects
  const angelEmptyRef = useRef(); // Parent container for angel and coins
  const angelRef = useRef();
  const angelSpotTarget = useMemo(() => new THREE.Object3D(), []);
  const coin1Ref = useRef();
  const coin2Ref = useRef();
  const coin3Ref = useRef();
  const coin4Ref = useRef();
  const coinSpokeRef = useRef(); // Parent group of all coins — rotate this for carousel

  // Camera focus state
  const [focusTarget, setFocusTarget] = useState(null);
  const ourLadyRef = useRef(); // Reference to RL80 (OurLady) mesh
  const originalCameraPosition = useRef(null); // Store original camera position

  // Dev tuning bridge — lets CameraTuningPanel drive focus directly so values
  // can be dialed in live. Mounted only when ?tune=1 is in the URL.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.search.includes('tune=1')) return;
    window.__cameraTuner = {
      settings: AGENT_CAMERA_SETTINGS,
      mobileOffset: MOBILE_CAMERA_OFFSET,
      // Pass `mobilePreview: true` from the panel to preview the mobile
      // Y-offset without changing the device.
      focusOn: (agentId, mobilePreview = false) => {
        const resolved = resolveAgentSettings(agentId, mobilePreview);
        if (!resolved) return;
        setFocusTarget({
          position: resolved.cameraPos,
          lookAt: resolved.lookAtPos,
          orbitCenter: resolved.orbitCenter,
          agentId,
          agentName: agentId,
        });
      },
      clearFocus: () => setFocusTarget(null),
    };
    return () => {
      if (window.__cameraTuner) delete window.__cameraTuner;
    };
  }, []);
  
  // Hover state for coins
  const [hoveredCoin, setHoveredCoin] = useState(null);
  const coin1OriginalScale = useRef(null);
  const coin1OriginalEmissive = useRef(null);
  const coin2OriginalScale = useRef(null);
  const coin2OriginalEmissive = useRef(null);
  const coin3OriginalScale = useRef(null);
  const coin3OriginalEmissive = useRef(null);
  const coin4OriginalScale = useRef(null);
  const coin4OriginalEmissive = useRef(null);
  
  // Refs for CoinFace avatar meshes — kept for future repurposing (e.g. leaderboard)
  const coinFaceRefs = useRef([null, null, null, null]) // CoinFace1-4
  const topSupporterBannerRefs = useRef([]) // TopText and x_logo meshes

  // Click animation state for coins
  const [clickedCoin, setClickedCoin] = useState(null);
  const coinAnimationState = useRef({
    Coin1: { isAnimating: false, startTime: 0, flutterIntensity: 0 },
    Coin2: { isAnimating: false, startTime: 0, flutterIntensity: 0 },
    Coin3: { isAnimating: false, startTime: 0, flutterIntensity: 0 },
    Coin4: { isAnimating: false, startTime: 0, flutterIntensity: 0 }
  });
  
  // Eye mesh refs for blinking animation
  const leftEyeRef = useRef();
  const rightEyeRef = useRef();
  const blinkStateRef = useRef({
    lastBlinkTime: 0,
    nextBlinkDelay: Math.random() * 3000 + 2000, // Random delay between 2-5 seconds
    isBlinking: false,
    blinkProgress: 0
  });

  // Head bone refs for look-at-camera override
  const demonHeadBoneRef = useRef();
  const demonFocusedRef = useRef(false); // true when camera is zoomed in on Demon
  // Upper-arm bone + flag for the point-at-camera override that runs
  // during the demon_pointing phase of the focus sequence.
  const demonPointingArmBoneRef = useRef();
  const demonArmAimingRef = useRef(false);
  const monkHeadBoneRef = useRef();
  const monkFocusedRef = useRef(false); // true when camera is zoomed in on Monk
  const rl80HeadBoneRef = useRef();
  const rl80FocusedRef = useRef(false); // true when camera is zoomed in on RL80
  const fluffyHeadBoneRef = useRef();
  const grannyHeadBoneRef = useRef();
  // Hint marker group refs (positioned each frame from the head bones)
  const rl80HintRef = useRef();
  const demonHintRef = useRef();
  const monkHintRef = useRef();
  const fluffyHintRef = useRef();
  const grannyHintRef = useRef();
  const fluffyFocusedRef = useRef(false); // true when camera is zoomed in on Fluffy
  const grannyFocusedRef = useRef(false); // true when camera is zoomed in on Granny

  // Demon eye mesh ref and blink state
  const demonEyesRef = useRef();
  const demonBlinkStateRef = useRef({
    lastBlinkTime: 0,
    nextBlinkDelay: Math.random() * 4000 + 3000, // Random delay between 3-7 seconds
    isBlinking: false,
    blinkProgress: 0
  });

  // Granny eye mesh refs and blink state. Mesh-swap blink: Eyes is the open
  // mesh, Closedeyes is a narrower closed shape that takes over for the
  // blink frames. Reads cleaner than fading opacity (no momentary hole).
  const grannyEyesRef = useRef();
  const grannyClosedEyesRef = useRef();
  const grannyBlinkStateRef = useRef({
    lastBlinkTime: 0,
    nextBlinkDelay: Math.random() * 4000 + 3000,
    isBlinking: false,
  });

  // Unicorn eye mesh refs (L_EYE, R_EYE parented to head bone) — opacity blink
  const unicornEyesRef = useRef([]);
  const unicornBlinkStateRef = useRef({
    lastBlinkTime: 0,
    nextBlinkDelay: Math.random() * 4000 + 3000,
    isBlinking: false,
    blinkProgress: 0
  });

  // One-shot Unicorn_waving on focus arrival. Armed when user clicks RL80;
  // fired 2s after the camera lerp converges.
  const unicornWaveStateRef = useRef({ armed: false, timeoutId: null });
  
  // Flame shader material refs (multiple flames in scene)
  const flameMaterialsRef = useRef([]);

  // Demon animation state (uses Root.001|* prefixed animations)
  const demonAnimStateRef = useRef({
    currentAnimation: 'Root.001|Typing',
    lastSwitchTime: 0,
    nextSwitchDelay: Math.random() * 10000 + 8000,
  });

  // RL80 animation state
  const rl80AnimStateRef = useRef({
    currentAnimation: 'Typing',
    lastSwitchTime: 0,
    nextSwitchDelay: Math.random() * 8000 + 12000,
    recentAnimations: [],
    isPlayingSpecial: false,
  });

  // Monk animation state (uses *_monk suffixed animations)
  const monkAnimStateRef = useRef({
    currentAnimation: 'typing_monk',
    lastSwitchTime: 0,
    nextSwitchDelay: Math.random() * 10000 + 15000,
  });

  // Granny animation state — alternates granny_typing (loop) with
  // granny_fistPump (one-shot). Mirrors the Demon alternation shape.
  const grannyAnimStateRef = useRef({
    currentAnimation: 'granny_typing',
    lastSwitchTime: 0,
    nextSwitchDelay: Math.random() * 8000 + 8000,
    isPlayingSpecial: false,
    pumpReturnTimeoutId: null, // setTimeout ID for the post-fistPump return-to-typing
  });

  // Monk attention-getting one-shot (clip name "Pointing_Monk"). Plays
  // every few seconds before the user has clicked the monk for focus — used
  // to attract the user into starting the game flow. Once focused, firing
  // stops permanently for that session.
  const monkWaveStateRef = useRef({
    nextFireTime: 0,           // ms epoch when the next wave should fire
    hasBeenFocused: false,     // becomes true on first focus → no more waves
    everInitialized: false,    // becomes true after the first delay schedule
    hailsUntilBeckon: 4 + Math.floor(Math.random() * 2), // beckon fires every 4–5 hails
    attentionActive: false,    // true while the hail/idle/beckon cycle is running — gates head tracking
  });

  // Tekno animation state
  const teknoAnimStateRef = useRef({
    currentAnimation: 'Typing',
    lastSwitchTime: 0,
    nextSwitchDelay: Math.random() * 10000 + 20000, // Wait 20-30 seconds
  });

  // Price tracking for buy-triggered animations (H80Z/Tekno FistPump on buys)
  const lastPriceRef = useRef(null);
  const priceCheckIntervalRef = useRef(null);

  // Refs for PalmTree meshes - store multiple instances
  const palmTreeRefs = useRef([]);
  
  
  // Detect mobile device on mount
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase()) ||
                             (window.innerWidth <= 768);
      setDetectedMobile(isMobileDevice);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Poll rl80 price to detect buys — trigger H80Z (Demon) FistPump on price increase
  useEffect(() => {
    const triggerH80ZFistPump = () => {
      const demonActions = actionsRef.current['Demon'];
      if (!demonActions) return;

      // Find the FistPump animation (Demon uses Root.001|* prefix)
      const fistPumpKey = Object.keys(demonActions).find(a => /fistpump/i.test(a));
      if (!fistPumpKey) return;

      const demonState = demonAnimStateRef.current;
      // Don't interrupt if already playing a special animation
      if (demonState.isPlayingSpecial) return;

      // Fade out current animation
      if (demonActions[demonState.currentAnimation]) {
        demonActions[demonState.currentAnimation].fadeOut(0.5);
      }

      const fistPump = demonActions[fistPumpKey];
      fistPump.reset();
      fistPump.fadeIn(0.5);
      fistPump.setLoop(THREE.LoopOnce, 1);
      fistPump.clampWhenFinished = true;
      fistPump.play();

      demonState.currentAnimation = fistPumpKey;
      demonState.isPlayingSpecial = true;
      demonState.nextSwitchDelay = 999999;
      demonState.lastSwitchTime = Date.now();

      const animDuration = fistPump.getClip().duration * 1000;
      setTimeout(() => {
        const loopAnims = Object.keys(demonActions).filter(a =>
          /typing|idle|laughing/i.test(a));
        const returnAnim = loopAnims.length > 0
          ? loopAnims[Math.floor(Math.random() * loopAnims.length)]
          : Object.keys(demonActions)[0];
        if (demonActions[returnAnim]) {
          fistPump.fadeOut(0.5);
          demonActions[returnAnim].stop();
          demonActions[returnAnim].reset();
          demonActions[returnAnim].setLoop(THREE.LoopRepeat);
          demonActions[returnAnim].setEffectiveWeight(1);
          demonActions[returnAnim].play();
        }
        demonState.currentAnimation = returnAnim;
        demonState.isPlayingSpecial = false;
        demonState.nextSwitchDelay = Math.random() * 8000 + 6000;
        demonState.lastSwitchTime = Date.now();
      }, Math.max(100, animDuration - 500));
    };

    const checkPrice = async () => {
      try {
        const res = await fetch('/api/rl80-price');
        if (!res.ok) return;
        const data = await res.json();
        if (data.price == null) return;

        const currentPrice = parseFloat(data.price);
        const prevPrice = lastPriceRef.current;
        lastPriceRef.current = currentPrice;

        // If we have a previous price and new price is higher → buy detected.
        // Skipped when FistPump is reserved for slot-machine jackpots only.
        if (prevPrice !== null && currentPrice > prevPrice && !jackpotOnlyFistPump) {
          triggerH80ZFistPump();
        }
      } catch {
        // Silently ignore fetch errors
      }
    };

    // Initial fetch to seed the price (no animation on first load)
    checkPrice();
    // Poll every 15 seconds
    priceCheckIntervalRef.current = setInterval(checkPrice, 15000);

    // Slot machine 3-of-a-kind on /trade also triggers the same fist pump —
    // SlotMachineScreen dispatches this window event on a win.
    const onJackpot = () => triggerH80ZFistPump();
    window.addEventListener('slotMachineJackpot', onJackpot);

    return () => {
      if (priceCheckIntervalRef.current) {
        clearInterval(priceCheckIntervalRef.current);
      }
      window.removeEventListener('slotMachineJackpot', onJackpot);
    };
  }, []);

  // Use prop or detected mobile state
  const isOnMobile = isMobile || detectedMobile;

// Expose the loaded model and camera control functions through ref
  /* useImperativeHandle(ref, () => ({
    current: loadedModel,
    focusOnAgent: (agentId) => {
      // Focus on a specific agent programmatically
      let targetRef = null;
      
      if (agentId === 'RL80' && ourLadyRef.current) {
        targetRef = ourLadyRef.current;
      } else if (agentId === 'Mike' && cube010MeshRef.current) {
        targetRef = cube010MeshRef.current;
      }
      
      if (targetRef) {
        const objectWorldPos = new THREE.Vector3();
        targetRef.getWorldPosition(objectWorldPos);
        
        // Calculate camera position relative to the object
        const cameraOffset = new THREE.Vector3(2, 0.5, 3);
        const cameraPosition = objectWorldPos.clone().add(cameraOffset);
        
        setFocusTarget({
          position: cameraPosition,
          lookAt: objectWorldPos,
          agentId: agentId,
          agentName: agentId
        });
      }
    },
    resetCamera: () => {
      // Reset camera to original position
      setFocusTarget(null);
      if (originalCameraPosition.current) {
        camera.position.copy(originalCameraPosition.current);
        camera.lookAt(0, 0, 0);
      }
    }
  }), [loadedModel, camera]); */

  // Define annotation points - adjust positions based on your temple scene
  

  useEffect(() => {
    if (hasLoadedRef.current) return;
    
    // Small delay to ensure the ref is attached after first render
    const timer = setTimeout(async () => {
      if (!groupRef.current) {
        console.error('[CyborgTempleScene] groupRef.current is still null after mount');
        return;
      }

      hasLoadedRef.current = true;
      const currentGroupRef = groupRef.current; // Capture the ref value

    // Temporarily suppress THREE.js warnings during model loading
    const originalWarn = console.warn;
    const suppressAnimationWarnings = (message) => {
      if (typeof message === 'string' && 
          message.includes('THREE.PropertyBinding') && 
          message.includes('No target node found')) {
        return; // Suppress animation binding warnings
      }
      return originalWarn.apply(console, arguments);
    };

    const gltfLoader = new GLTFLoader();
    
    // Always use DRACO loader since both models may have compression
    const dracoLoader = new DRACOLoader();
    // Use full URL for Draco decoder in production to avoid path issues
    const dracoPath = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? `${window.location.origin}/draco/`
      : "/draco/";
   
    dracoLoader.setDecoderPath(dracoPath);
    gltfLoader.setDRACOLoader(dracoLoader);
    // Required for the optimized V2 model — gltf-transform re-encodes its
    // meshes with EXT_meshopt_compression instead of Draco. Await
    // MeshoptDecoder.ready so the WASM module is fully initialized before
    // load() runs; on Android Chrome the load can otherwise race the WASM
    // init and silently fail (no callback fires, model never appears).
    // Bound the await with a 5s timeout so a hung WASM init doesn't hang
    // the entire page — the un-opt fallback model doesn't need Meshopt.
    try {
      await Promise.race([
        MeshoptDecoder.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('MeshoptDecoder.ready timeout (5s)')), 5000)),
      ]);
    } catch (e) {
      console.warn('[CyborgTempleScene] MeshoptDecoder init failed/timed out:', e?.message || e);
    }
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    // V2 model further optimized via gltf-transform (Meshopt + WebP textures
    // + dedup/weld) — ~3 MB instead of ~5 MB so mobile cellular completes the
    // download before iOS Safari times out. Falls back to the un-optimized
    // V2 if the opt build is missing on the deploy.
    let modelPath = "/models/RL80_4anims_v03_opt.glb";
    const fallbackModelPath = "/models/RL80_4anims_v03.glb";
    let usingFallback = false;
    const startTime = performance.now();
    
    // Log detailed information about the loading attempt
    
    // First, verify the model file is accessible
    fetch(modelPath, { 
      method: 'HEAD',
      mode: 'cors',
      cache: 'no-cache' // Bypass cache to ensure we get fresh response
    })
      .then(response => {
        // console.log(`[CyborgTempleScene] HEAD request response:`, {
        //   ok: response.ok,
        //   status: response.status,
        //   statusText: response.statusText,
        //   headers: Object.fromEntries(response.headers.entries())
        // });
        if (!response.ok) {
          throw new Error(`Model file not accessible: ${response.status} ${response.statusText}`);
        }
      })
      .catch(error => {
        console.error(`[CyborgTempleScene] Failed to verify model file:`, error);
        console.error(`[CyborgTempleScene] This may indicate a server configuration issue in production.`);
      });
    
    let retryCount = 0;
    const maxRetries = 3;
    
    const loadModel = (attemptFullUrl = false) => {
      // In production, sometimes relative paths fail, so we try with full URL as fallback
      const urlToLoad = attemptFullUrl && typeof window !== 'undefined' 
        ? `${window.location.origin}${modelPath}`
        : modelPath;
        
      
      gltfLoader.load(
      urlToLoad, 
      (gltf) => {
        const loadTime = performance.now() - startTime;
        
        // Log successful load
        if (usingFallback) {
          console.warn(`[CyborgTempleScene] Successfully loaded fallback desktop model on mobile device`);
        } else {
          // console.log(`[CyborgTempleScene] Successfully loaded ${isOnMobile ? 'mobile' : 'desktop'} model in ${loadTime.toFixed(0)}ms`);
        }
        
        const templeScene = gltf.scene;
      
      // Store the loaded model in state for external access
      setLoadedModel(templeScene);
      
      // Create an anchor group for positioning — same desktop model on both
      // mobile and desktop for now.
      const anchorGroup = new THREE.Group();
      anchorGroup.position.set(0, 0.3, 0);
      anchorGroup.rotation.set(0, 0, 0);
      anchorGroup.scale.set(1, 1, 1);
      
      // Add the temple scene to the anchor group
      anchorGroup.add(templeScene);
      
      // First, identify all animated characters and create mixers for each
      const animatedCharacters = {};
      
      // Find all animated objects in the scene
      templeScene.traverse((child) => {
        if (child.name === 'RL80_Empty' || child.name === 'Unicorn_Empty') {
          animatedCharacters['RL80'] = child;
          // Find head bone in skeleton for look-at-camera (works for both
          // the original RL80 rig and the unicorn rig).
          child.traverse((bone) => {
            if (bone.isBone && /head/i.test(bone.name) && !rl80HeadBoneRef.current) {
              rl80HeadBoneRef.current = bone;
            }
          });
          // V2 model: the unicorn's mesh sits under Unicorn_Empty but its
          // Mixamo armature (Root_1, with mixamorig* bones) is a SIBLING in
          // the scene root — so we wire its descendant meshes to the click
          // pipeline as RL80 here, and the mixer is anchored at the scene
          // root below so it can reach the bones.
          if (child.name === 'Unicorn_Empty') {
            child.traverse((obj) => {
              if (obj.isMesh) {
                obj.userData.clickable = true;
                obj.userData.agentId = 'RL80';
                obj.userData.agentName = 'RL80';
                if (!ourLadyRef.current) ourLadyRef.current = obj;
              }
            });
          }
        }
        else if (child.name === 'Devil_empty' || child.name === 'Devil_Empty') {
          animatedCharacters['Demon'] = child;
          // Find head bone + lower spine bone (spine_01) in the Demon
          // skeleton. The pointing override rotates the torso rather than
          // a single arm bone so the entire pointing gesture (shoulder →
          // elbow → wrist → hand) stays intact and just gets reaimed.
          const spineCandidates = [];
          child.traverse((bone) => {
            if (!bone.isBone) return;
            if (/head/i.test(bone.name)) {
              demonHeadBoneRef.current = bone;
            }
            if (/spine/i.test(bone.name)) {
              spineCandidates.push(bone);
            }
          });
          // Prefer spine_01 (or spine.001 / Spine_01 variants); fall back
          // to any spine bone if naming differs.
          demonPointingArmBoneRef.current =
            spineCandidates.find(b => /spine[._-]?0*1$/i.test(b.name)) ||
            spineCandidates.find(b => /spine[._-]?1$/i.test(b.name)) ||
            spineCandidates[0] ||
            null;
          if (!demonPointingArmBoneRef.current) {
            console.warn('[Demon] No spine bone found for point-at-camera override.');
          }
        }
        else if (child.name === 'Monk_empty') {
          animatedCharacters['Monk'] = child;
          // Find head bone in Monk skeleton for look-at-camera
          child.traverse((bone) => {
            if (bone.isBone && /head/i.test(bone.name) && !monkHeadBoneRef.current) {
              monkHeadBoneRef.current = bone;
            }
          });
        }
        else if (child.name === 'Tekno_Empty') {
          animatedCharacters['Tekno'] = child;
        }
        else if (child.name === 'Fluffy_Empty') {
          animatedCharacters['Fluffy'] = child;
          // Find head bone in Fluffy skeleton for look-at-camera
          child.traverse((obj) => {
            if (obj.isBone && obj.name === 'head_1' && !fluffyHeadBoneRef.current) {
              fluffyHeadBoneRef.current = obj;
            }
          });
        }
        else if (child.name === 'GrannyEmpty') {
          animatedCharacters['Granny'] = child;
          // Find head bone (for orbit-center derivation) plus the open/closed
          // eye meshes. Two-pass to be deterministic regardless of traversal
          // order: gather all meshes first, then resolve refs from the list.
          const meshes = [];
          child.traverse((obj) => {
            if (obj.isBone && /head/i.test(obj.name) && !grannyHeadBoneRef.current) {
              grannyHeadBoneRef.current = obj;
            }
            if (obj.isMesh) meshes.push(obj);
          });
          // Open eyes: prefer exact "Eyes", fall back to anything matching
          // "eyes" but not "closed" (handles names like "Eyes_2").
          let openEyes = meshes.find((m) => /^eyes$/i.test(m.name || ''));
          if (!openEyes) {
            openEyes = meshes.find((m) =>
              /eye/i.test(m.name || '') && !/closed/i.test(m.name || '')
            );
          }
          // Closed eyes: prefer exact "Closedeyes", fall back to anything
          // with "closed" in the name, then to a different eye-ish mesh
          // (handles "Eyes.001" naming when mesh-data names leak through).
          let closedEyes = meshes.find((m) => /^closedeyes(\.\d+)?$/i.test(m.name || ''));
          if (!closedEyes) {
            closedEyes = meshes.find((m) => /closed/i.test(m.name || ''));
          }
          if (!closedEyes && openEyes) {
            closedEyes = meshes.find((m) =>
              m !== openEyes && /eye/i.test(m.name || '')
            );
          }
          if (openEyes) grannyEyesRef.current = openEyes;
          if (closedEyes) {
            grannyClosedEyesRef.current = closedEyes;
            closedEyes.visible = false;
          }
        }
        // Point.003 sits near the angel — tinted to match the altar
        // spotlight color so the angel surface picks up a green cast.
        else if (child.isLight && child.name === 'Point003') {
          child.color.setHex(0x0bcd2e);
          child.intensity = 0.5;
        }
        // Point.006 was meant to be red in Blender but the GLB exports it as
        // white (color [1,1,1]) — override on the JS side.
        else if (child.isLight && child.name === 'Point006') {
          child.color.setHex(0xff0000);
          child.intensity = 0.3;
        }
                else if (child.isLight && child.name === 'Point00') {
          child.color.setHex(0x17FFF7);
          child.intensity = 0.3;
        }
      });
      
      // Create separate mixers for each character. For the V2 unicorn rig the
      // bones (mixamorigHips and friends) live under a sibling Armature
      // (Root_1) — not under Unicorn_Empty — so anchor that mixer at the
      // scene root to keep PropertyBinding's name lookup working.
      Object.entries(animatedCharacters).forEach(([charName, charObject]) => {
        const mixerRoot = (charObject.name === 'Unicorn_Empty') ? templeScene : charObject;
        const mixer = new THREE.AnimationMixer(mixerRoot);
        mixersRef.current[charName] = mixer;
        actionsRef.current[charName] = {};
      });

      // Helper function to clean animation tracks - only remove truly problematic tracks
      const cleanAnimationTracks = (animation, targetObject) => {
        // Get all bone names in the target object, including nested paths
        const availableBones = new Set();
        const collectBoneNames = (obj, path = '') => {
          if (obj.name) {
            availableBones.add(obj.name);
            // Also add the full path for nested bones
            if (path) {
              availableBones.add(`${path}/${obj.name}`);
            }
          }
          if (obj.children) {
            obj.children.forEach(child => {
              collectBoneNames(child, path ? `${path}/${obj.name}` : obj.name);
            });
          }
        };
        collectBoneNames(targetObject);
        
        // Known problematic bones that cause warnings (including _1 and _2 variants)
        // Only include bones that are genuinely missing, not leg bones that exist
        const problematicBones = new Set([
          // These bones don't exist in the model and should be filtered
          'Armature001', 'Armature002', 'Armature003'
          // Removed leg bones as they DO exist and are needed for proper animation
        ]);
        
        // Filter out only the truly problematic tracks
        const validTracks = animation.tracks.filter(track => {
          const boneName = track.name.split('.')[0];
          // Only remove if it's in our known problematic list AND not available
          if (problematicBones.has(boneName) && !availableBones.has(boneName)) {
            return false; // Remove this track
          }
          return true; // Keep all other tracks
        });
        
        // Only create a new clip if we removed any tracks
        if (validTracks.length < animation.tracks.length) {
          const cleanedAnimation = new THREE.AnimationClip(
            animation.name,
            animation.duration,
            validTracks
          );
          return cleanedAnimation;
        }
        
        return animation;
      };

      // Play specific animations based on character
      if (gltf.animations.length > 0) {
        // Suppress warnings during animation setup
        console.warn = suppressAnimationWarnings;
        
        // Analyze animations to understand their structure
        gltf.animations.forEach((animation) => {
          
          // Track names follow pattern: BoneName.property (e.g., Root.position)
          // This helps identify which bone hierarchy each animation targets
        });
        
        // Assign animations based on bone structure:
        // - Pelvis-based → Demon
        // - Root_2-based → Monk
        // - Root-based → RL80, Tekno

        gltf.animations.forEach((animation) => {
          const animName = animation.name;
          const firstTrackBone = animation.tracks[0]?.name.split('.')[0] || '';

          let targetCharacters = [];

          // Granny animations — match "granny" anywhere in the clip name or
          // first-track bone name. Checked before bone-based rules in case
          // Granny shares a Pelvis/Root skeleton with another character.
          // Blender often exports as `Armature.NNN|granny_typing` when there
          // are multiple armatures, so we substring-match instead of anchoring.
          if (/granny/i.test(animName) || /granny/i.test(firstTrackBone)) {
            targetCharacters = ['Granny'];
          }
          // Demon animations — match "demon" anywhere in the clip name or
          // first-track bone, since newer exports renamed clips to
          // demon_typing / demon_idle / demon_fistPump / demon_pointing
          // and may use a different skeleton root than the original Pelvis.
          else if (/demon/i.test(animName) || /demon/i.test(firstTrackBone)) {
            targetCharacters = ['Demon'];
          }
          // Demon animations (legacy Pelvis-based skeleton)
          else if (firstTrackBone === 'Pelvis') {
            targetCharacters = ['Demon'];
          }
          // Monk animations (Root_2-based skeleton, *_monk / *_Monk suffix,
          // or monk_* prefix).
          else if (firstTrackBone === 'Root_2' || /_monk$|^monk_/i.test(animName)) {
            targetCharacters = ['Monk'];
          }
          // Standard Root-based animations for RL80 and Tekno only
          // (Demon uses Root.001|* / Pelvis animations, Monk uses *_monk animations)
          // Fluffy animations (sit_idle, or any _fluffy suffixed)
          else if (animName === 'sit_idle' || animName.endsWith('_fluffy')) {
            targetCharacters = ['Fluffy'];
          }
          // V2 model: unicorn rig clips (Typing_Unicorn, Unicorn_Idle, etc.)
          // → RL80 slot. Accept "unicorn" anywhere in the clip name or first
          // track bone, regardless of naming order.
          else if (/unicorn/i.test(animName) || /unicorn/i.test(firstTrackBone)) {
            targetCharacters = ['RL80'];
          }
          else if (firstTrackBone === 'Root' ||
                   animName === 'Typing' || animName === 'Idle' ||
                   animName === 'Disbelief' || animName === 'FistPump' ||
                   animName === 'Clap' || animName === 'Victory' || animName === 'Cheer') {
            targetCharacters = ['RL80', 'Tekno'];
          }


          
          // Apply animation to target characters with track cleaning
          targetCharacters.forEach(charName => {
            if (animatedCharacters[charName] && mixersRef.current[charName]) {
              const mixer = mixersRef.current[charName];

              // For unicorn (mixer rooted at the scene), check the scene's
              // bone universe so legitimate Mixamo tracks aren't stripped.
              const cleanRoot = (animatedCharacters[charName].name === 'Unicorn_Empty')
                ? templeScene
                : animatedCharacters[charName];
              // Clean animation tracks to remove references to non-existent bones
              let cleanedAnimation = cleanAnimationTracks(animation, cleanRoot);

              // Unicorn_waving: keep only arm-bone quaternion tracks (drop
              // any position/scale and any non-arm rotation tracks left over
              // from earlier exports). Stays in regular blend mode — the
              // wave plays alongside the still-running idle, dominating arm
              // bones via a high effective weight set in the trigger.
              if (charName === 'RL80' && /wav/i.test(animName)) {
                const armBoneRe = /mixamorig(Left|Right)(Shoulder|Arm|ForeArm|Hand)/i;
                cleanedAnimation.tracks = cleanedAnimation.tracks.filter(t => {
                  return /\.quaternion$/i.test(t.name) && armBoneRe.test(t.name);
                });
              }


              const action = mixer.clipAction(cleanedAnimation);
              
              if (!actionsRef.current[charName]) {
                actionsRef.current[charName] = {};
              }
              
              actionsRef.current[charName][animName] = action;
            }
          });
        });



        // Play initial animations for each character
        Object.entries(actionsRef.current).forEach(([charName, charActions]) => {
          const availableAnims = Object.keys(charActions);

          if (availableAnims.length === 0) {
            console.error(`[Play] ERROR: ${charName} has no animations! Character will be in T-pose.`);
            return;
          }
          
          // Find a suitable default animation for each character
          let defaultAnimName = null;
          let defaultAnim = null;
          
          if (charName === 'RL80') {
            // Prefer any unicorn typing/idle (V2 rig — handles both
            // Typing_Unicorn and Unicorn_Typing naming), then the original
            // Typing/Idle clips, then anything available.
            const unicornTyping = availableAnims.find(a => /unicorn/i.test(a) && /typing/i.test(a));
            const unicornIdle = availableAnims.find(a => /unicorn/i.test(a) && /idle/i.test(a));
            if (unicornTyping) {
              defaultAnimName = unicornTyping;
            } else if (unicornIdle) {
              defaultAnimName = unicornIdle;
            } else if (charActions['Typing']) {
              defaultAnimName = 'Typing';
            } else if (charActions['Idle']) {
              defaultAnimName = 'Idle';
            } else {
              defaultAnimName = availableAnims[0];
            }
          } else if (charName === 'Demon') {
            // Newer export uses demon_typing / demon_idle naming; tolerate
            // the legacy Root.001|* names for older models still in use.
            const demonTyping = availableAnims.find(a => /demon.*typ/i.test(a));
            const demonIdle = availableAnims.find(a => /demon.*idle/i.test(a));
            if (demonTyping) {
              defaultAnimName = demonTyping;
            } else if (demonIdle) {
              defaultAnimName = demonIdle;
            } else if (charActions['Root.001|Typing']) {
              defaultAnimName = 'Root.001|Typing';
            } else if (charActions['Root.001|Disbelief']) {
              defaultAnimName = 'Root.001|Disbelief';
            } else {
              defaultAnimName = availableAnims[0];
            }
          } else if (charName === 'Monk') {
            if (charActions['typing_monk']) {
              defaultAnimName = 'typing_monk';
            } else if (charActions['idle_monk']) {
              defaultAnimName = 'idle_monk';
            } else {
              defaultAnimName = availableAnims[0];
            }
          } else if (charName === 'Tekno') {
            if (charActions['Typing']) {
              defaultAnimName = 'Typing';
            } else if (charActions['Idle']) {
              defaultAnimName = 'Idle';
            } else {
              defaultAnimName = availableAnims[0];
            }
          } else if (charName === 'Fluffy') {
            if (charActions['sit_idle']) {
              defaultAnimName = 'sit_idle';
            } else {
              defaultAnimName = availableAnims[0];
            }
          } else if (charName === 'Granny') {
            // Tolerate armature-prefixed names from Blender exports.
            const typingKey = availableAnims.find(a => /granny.*typ/i.test(a));
            defaultAnimName = typingKey || availableAnims[0];
          }
          
          if (defaultAnimName && charActions[defaultAnimName]) {
            defaultAnim = charActions[defaultAnimName];
            
            // Add some timing variation for visual interest
            if (charName === 'Monk' || charName === 'Tekno' || charName === 'Demon' || charName === 'Fluffy' || charName === 'Granny') {
              defaultAnim.time = Math.random() * defaultAnim.getClip().duration * 0.5;
            }
            defaultAnim.setLoop(THREE.LoopRepeat);
            defaultAnim.play();

            // Update the current animation state
            if (charName === 'RL80') {
              rl80AnimStateRef.current.currentAnimation = defaultAnimName;
            } else if (charName === 'Demon') {
              demonAnimStateRef.current.currentAnimation = defaultAnimName;
            } else if (charName === 'Monk') {
              monkAnimStateRef.current.currentAnimation = defaultAnimName;
            } else if (charName === 'Tekno') {
              teknoAnimStateRef.current.currentAnimation = defaultAnimName;
            } else if (charName === 'Granny') {
              grannyAnimStateRef.current.currentAnimation = defaultAnimName;
            }
          } else {
            console.error(`[Play] ERROR: Could not find a default animation for ${charName}`);
          }
        });
        
        // Restore original console.warn after animation setup
        console.warn = originalWarn;
      }
      
      // Create grid ground — square grid lines clipped to a circular boundary
      // so the floor reads as a disc rather than a square plane. Same look as
      // the previous GridHelper, just bounded.
      const gridRadius = 25;
      const gridDivisions = 50;
      const gridStep = (2 * gridRadius) / gridDivisions;
      const gridPositions = [];
      // Lines parallel to Z (constant X): clip to circle x² + z² = r²
      for (let i = 0; i <= gridDivisions; i++) {
        const x = -gridRadius + i * gridStep;
        const dz2 = gridRadius * gridRadius - x * x;
        if (dz2 <= 0) continue;
        const z = Math.sqrt(dz2);
        gridPositions.push(x, 0, -z, x, 0, z);
      }
      // Lines parallel to X (constant Z)
      for (let i = 0; i <= gridDivisions; i++) {
        const z = -gridRadius + i * gridStep;
        const dx2 = gridRadius * gridRadius - z * z;
        if (dx2 <= 0) continue;
        const x = Math.sqrt(dx2);
        gridPositions.push(-x, 0, z, x, 0, z);
      }
      // Boundary circle outline
      const circleSegments = 96;
      for (let i = 0; i < circleSegments; i++) {
        const a0 = (i / circleSegments) * Math.PI * 2;
        const a1 = ((i + 1) / circleSegments) * Math.PI * 2;
        gridPositions.push(
          gridRadius * Math.cos(a0), 0, gridRadius * Math.sin(a0),
          gridRadius * Math.cos(a1), 0, gridRadius * Math.sin(a1),
        );
      }
      const gridGeometry = new THREE.BufferGeometry();
      gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
      const gridMaterial = new THREE.LineBasicMaterial({
        color: 0x00ff41,
        opacity: 0.3,
        transparent: true,
      });
      const gridHelper = new THREE.LineSegments(gridGeometry, gridMaterial);
      gridHelper.position.y = -0.06;
      anchorGroup.add(gridHelper);
      
      // Add the anchor group to our captured group ref
      // Using the captured ref to avoid closure issues
      if (currentGroupRef) {
        currentGroupRef.add(anchorGroup);
        // Ensure everything is visible
        anchorGroup.visible = true;
        templeScene.visible = true;
        
        // Force update
        anchorGroup.updateMatrix();
        anchorGroup.updateMatrixWorld(true);
      } else {
        // This shouldn't happen but as a fallback, add to scene
        console.error('[CyborgTempleScene] currentGroupRef is null, falling back to scene');
        scene.add(anchorGroup);
      }
      
      // Find the specific meshes and add click handlers
      templeScene.traverse((child) => {

        // Target all cylinder meshes (the glowing rings around coins)
        if (child.name && child.name.startsWith('Cylinder') && child.isMesh) {
          // Enhance the emissive glow for cylinder rings
          if (child.material) {
            child.material.emissiveIntensity = 4.5; // Increase from 1.4 to 4.5
            child.material.toneMapped = false; // CRITICAL - prevents tone mapping from dimming
            child.material.needsUpdate = true;

            // If emissive color isn't set, give it a cyan glow
            if (!child.material.emissive || child.material.emissive.getHex() === 0x000000) {
              child.material.emissive = new THREE.Color(0x00ffff);
            }
          }
        }

        if (child.name === 'Cylinder043_0') {
          cylinderMeshRef.current = child;
        }
        if (child.name === 'Object_5') {
          object7MeshRef.current = child;
        }
        
        // Find PalmTree meshes - they have names like PalmTree001, PalmTree002, etc
        if (child.name && child.name.startsWith('PalmTree')) {
          palmTreeRefs.current.push(child);
          // Set initial visibility based on is80sMode
          child.visible = is80sMode;
        }
        
        // Find eye meshes for blinking animation
        if (child.name === 'L_eye' || child.name === 'L_Eye' || child.name === 'LeftEye' || child.name === 'left_eye') {
          leftEyeRef.current = child;
        }
        if (child.name === 'R_eye' || child.name === 'R_Eye' || child.name === 'RightEye' || child.name === 'right_eye') {
          rightEyeRef.current = child;
        }

        // Find demon eyes mesh for blinking (opacity-based)
        if (child.name === 'demon_eyes') {
          demonEyesRef.current = child;
          if (child.material) {
            child.material.transparent = true;
            child.material.needsUpdate = true;
          }
        }

        // Glasses lenses — Blender's alpha doesn't survive the GLB export,
        // so force semi-transparency on the JS side. Match by material name.
        if (child.isMesh) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          let touchedLens = false;
          mats.forEach((m) => {
            if (!m || !/lens/i.test(m.name || '')) return;
            m.transparent = true;
            m.opacity = 0.25;
            m.depthWrite = false;
            m.side = THREE.DoubleSide;
            m.needsUpdate = true;
            touchedLens = true;
          });
          // Render lenses after the head/eyes so transparent fragments blend
          // correctly against what's behind them.
          if (touchedLens) child.renderOrder = 3;
        }

        // Unicorn eye meshes. In the GLB the node names are Unicorn_L_EYE /
        // Unicorn_R_EYE (the geometry names L_EYE/R_EYE are not what the
        // resulting Three.js Mesh.name takes — the node name wins).
        // Opacity-based blink mirroring the Demon, synchronized across both.
        // The eyes share material index 39 with the body mesh, so clone the
        // material per eye — otherwise opacity mutations fade the whole unicorn.
        if (child.isMesh && (child.name === 'Unicorn_L_EYE' || child.name === 'Unicorn_R_EYE')) {
          if (child.material) {
            child.material = child.material.clone();
            child.material.transparent = true;
            child.material.side = THREE.DoubleSide;
            child.material.polygonOffset = true;
            child.material.polygonOffsetFactor = -1;
            child.material.polygonOffsetUnits = -1;
            child.material.needsUpdate = true;
          }
          child.renderOrder = 1;
          // The eyes are parented to the head bone, but three.js's frustum
          // culling uses the rest-pose bounding sphere — when the head moves
          // the actual eye position can fall outside that rest sphere, and
          // the renderer skips drawing the mesh from angles where the rest
          // sphere isn't in view. Disable frustum culling so they always draw.
          child.frustumCulled = false;
          unicornEyesRef.current.push(child);
        }

        // Apply flickering flame shader to Flame mesh
        if (child.isMesh && (child.name === 'Flame' || child.name.startsWith('Flame'))) {
          const flameMat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } },
            vertexShader: `
              uniform float uTime;
              varying float vHeight;
              void main() {
                vec3 pos = position;
                vHeight = clamp((pos.y + 0.1) / 0.6, 0.0, 1.0);
                float flameTime = uTime * 3.0;
                pos.x += sin(flameTime * 1.5) * 0.06 * vHeight * vHeight + sin(flameTime * 2.3) * 0.03 * vHeight;
                pos.y += sin(flameTime * 2.0) * 0.04 * vHeight + sin(flameTime * 3.7) * 0.02 * vHeight * vHeight;
                pos.z += cos(flameTime * 1.8) * 0.04 * vHeight * vHeight;
                float taper = 1.0 - vHeight * 0.5;
                pos.x *= taper;
                pos.z *= taper;
                pos.y *= 1.0 + sin(flameTime * 2.5) * 0.1 * vHeight;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
              }
            `,
            fragmentShader: `
              uniform float uTime;
              varying float vHeight;
              void main() {
                float time = uTime * 3.0;
                vec3 innerColor = vec3(1.0, 0.95, 0.8);
                vec3 midColor = vec3(1.0, 0.5, 0.0);
                vec3 outerColor = vec3(1.0, 0.2, 0.0);
                vec3 color;
                if (vHeight < 0.3) {
                  color = mix(innerColor, midColor, vHeight / 0.3);
                } else if (vHeight < 0.7) {
                  color = mix(midColor, outerColor, (vHeight - 0.3) / 0.4);
                } else {
                  color = mix(outerColor, vec3(1.0, 0.8, 0.0), (vHeight - 0.7) / 0.3);
                }
                float flicker = sin(time * 4.0) * 0.25 + sin(time * 9.0) * 0.15 + 1.0;
                float intensity = 3.5 * flicker;
                float alpha = (1.0 - vHeight * 0.5) * (0.8 + flicker * 0.2);
                gl_FragColor = vec4(color * intensity, alpha);
              }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          child.material = flameMat;
          flameMaterialsRef.current.push(flameMat);
        }

        // Find OurLady (RL80) and make it clickable
        if (child.name === 'OurLady' || child.name === 'Object_7' || child.name === 'RL80') {
          

          
          ourLadyRef.current = child;
          
          // Set clickable data on this object and all its children
          const setClickableData = (obj) => {
            obj.userData.clickable = true;
            obj.userData.agentId = 'RL80';
            obj.userData.agentName = 'RL80';
            obj.userData.targetObject = child; // Store reference to the actual object
            
            // Also apply to all children if it's a group
            if (obj.children && obj.children.length > 0) {
              obj.children.forEach(setClickableData);
            }
          };
          
          setClickableData(child);
        }
        
        // Make the council characters clickable
        if (child.name === 'Demon' || child.name === 'Demon_empty' ||
            child.name === 'Devil_empty' || child.name === 'Devil_Empty' ||
            child.name === 'Monk_empty' || child.name === 'SK_Chr_Monk_01' ||
            child.name === 'Tekno' || child.name === 'Tekno_Empty' ||
            child.name === 'Fluffy_Empty' ||
            child.name === 'GrannyEmpty') {

          // Normalize agentId to consistent names
          let agentId = child.name;
          if (child.name === 'Demon' || child.name === 'Demon_empty' ||
              child.name === 'Devil_empty' || child.name === 'Devil_Empty') agentId = 'Demon';
          else if (child.name === 'Monk_empty' || child.name === 'SK_Chr_Monk_01') agentId = 'Monk';
          else if (child.name === 'Tekno' || child.name === 'Tekno_Empty') agentId = 'Tekno';
          else if (child.name === 'Fluffy_Empty') agentId = 'Fluffy';
          else if (child.name === 'GrannyEmpty') agentId = 'Granny';

          const setMechClickableData = (obj) => {
            obj.userData.clickable = true;
            obj.userData.agentId = agentId;
            obj.userData.agentName = agentId;
            obj.userData.targetObject = child;

            if (obj.children && obj.children.length > 0) {
              obj.children.forEach(setMechClickableData);
            }
          };

          setMechClickableData(child);
        }
        
        // Make the screens clickable. Screen1-4 are the primary monitors
        // (each character's main feed). ScreenA-D are the secondary monitors
        // (the council group-chat displays). They are *separate* meshes —
        // each gets its own agentId so clicking either zooms to that
        // specific screen.
        const isPrimaryScreen = child.name === 'Screen1' || child.name === 'Screen2' || child.name === 'Screen3' || child.name === 'Screen4';
        const isSecondaryScreen = child.name === 'ScreenA' || child.name === 'ScreenB' || child.name === 'ScreenC' || child.name === 'ScreenD';
        if (isPrimaryScreen || isSecondaryScreen) {
          const setScreenClickableData = (obj) => {
            obj.userData.clickable = true;
            obj.userData.agentId = child.name;
            obj.userData.agentName = child.name;
            obj.userData.targetObject = child;

            if (obj.children && obj.children.length > 0) {
              obj.children.forEach(setScreenClickableData);
            }
          };

          setScreenClickableData(child);
        }
        
        // Collect and make XCandle objects clickable (skip click wiring when
        // candle interaction is disabled — e.g. on /trade)
        if (child.name && child.name.startsWith('XCandle01')) {
          // Large candles (XCandle01.009–013) have scale ~0.078 vs ~0.070 for small ones
          const isLarge = child.scale && child.scale.x > 0.075;
          // Store in collection array (will sort after traversal)
          xCandleNodesRef.current.push(child);
          if (!disableCandleInteraction) {
            const setCandleClickable = (obj) => {
              obj.userData.clickable = true;
              obj.userData.agentId = 'XCandle';
              obj.userData.agentName = 'XCandle';
              obj.userData.isLargeCandle = isLarge;
              if (obj.children && obj.children.length > 0) {
                obj.children.forEach(setCandleClickable);
              }
            };
            setCandleClickable(child);
          }
          // On the main shrine, candles start hidden and the templeCandles
          // useEffect lights up claimed ones. When candle interaction is
          // disabled (e.g. /trade) there's no claim/light pipeline at all, so
          // just show every candle.
          child.visible = disableCandleInteraction;
        }

        // Capture Angel_Empty on every device so we can billboard it toward
        // the camera regardless of the mobile/desktop split below.
        if (child.name === 'Angel_Empty') {
          angelEmptyRef.current = child;
          child.position.x += ANGEL_POSITION_OFFSET.x;
          child.position.z += ANGEL_POSITION_OFFSET.z;
        }

        // Capture the angel mesh on every device — the desktop and mobile
        // GLBs both ship with a visible angel and we want focus to work in
        // both contexts.
        if (child.name === 'angel' || child.name === 'Angel') {
          angelRef.current = child;
          // Swap unlit MeshBasicMaterial for MeshStandardMaterial so the
          // altar spotlight actually illuminates the angel surface.
          child.traverse((obj) => {
            if (obj.isMesh && obj.material && obj.material.isMeshBasicMaterial) {
              const oldMat = obj.material;
              const baseColor = oldMat.color ? oldMat.color.clone() : new THREE.Color(0xffffff);
              obj.material = new THREE.MeshStandardMaterial({
                map: oldMat.map || null,
                color: baseColor,
                transparent: oldMat.transparent,
                opacity: oldMat.opacity,
                roughness: 0.6,
                metalness: 0.1,
                emissive: new THREE.Color(0x0bcd2e),
                emissiveMap: oldMat.map || null,
                emissiveIntensity: 0.25,
              });
              oldMat.dispose?.();
            }
          });
        }

        // Find coin objects for MOBILE.glb animations
        if (isOnMobile) {
          if (child.name === 'CoinSpoke') {
            coinSpokeRef.current = child;
          }

          // Coins only exist in MOBILE.glb, so only set them up on mobile
          if (child.name === 'Coin1') {
            coin1Ref.current = child;
            
            // Make Coin1 clickable - maps to Demon
            const setCoin1ClickableData = (obj) => {
              obj.userData.clickable = true;
              obj.userData.agentId = 'Demon';
              obj.userData.agentName = 'Demon';
              obj.userData.targetObject = child;
              obj.userData.isCoin = true; // Mark as coin for special handling
              
              // Also apply to all children if it's a group
              if (obj.children && obj.children.length > 0) {
                obj.children.forEach(setCoin1ClickableData);
              }
            };
            
            setCoin1ClickableData(child);
          }
          if (child.name === 'Coin2') {
            coin2Ref.current = child;
            
            // Make Coin2 clickable - maps to Tekno
            const setCoin2ClickableData = (obj) => {
              obj.userData.clickable = true;
              obj.userData.agentId = 'Tekno';
              obj.userData.agentName = 'Tekno';
              obj.userData.targetObject = child;
              obj.userData.isCoin = true;
              
              if (obj.children && obj.children.length > 0) {
                obj.children.forEach(setCoin2ClickableData);
              }
            };
            
            setCoin2ClickableData(child);
          }
          if (child.name === 'Coin3') {
            coin3Ref.current = child;
            
            // Make Coin3 clickable - maps to Monk
            const setCoin3ClickableData = (obj) => {
              obj.userData.clickable = true;
              obj.userData.agentId = 'Monk';
              obj.userData.agentName = 'Monk';
              obj.userData.targetObject = child;
              obj.userData.isCoin = true;
              
              if (obj.children && obj.children.length > 0) {
                obj.children.forEach(setCoin3ClickableData);
              }
            };
            
            setCoin3ClickableData(child);
          }
          if (child.name === 'Coin4') {
            coin4Ref.current = child;
            
            // Make Coin4 clickable - maps to RL80
            const setCoin4ClickableData = (obj) => {
              obj.userData.clickable = true;
              obj.userData.agentId = 'RL80';
              obj.userData.agentName = 'RL80';
              obj.userData.targetObject = child;
              obj.userData.isCoin = true;
              
              if (obj.children && obj.children.length > 0) {
                obj.children.forEach(setCoin4ClickableData);
              }
            };
            
            setCoin4ClickableData(child);
          }
        }

        // Hide TopText and x_logo banner until Angel is clicked
        if (child.name === 'TopText' || child.name === 'x_logo') {
          child.visible = false;
          topSupporterBannerRefs.current.push(child);
        }

        // Find CoinFace avatar meshes
        if (child.name === 'CoinFace1') coinFaceRefs.current[0] = child;
        if (child.name === 'CoinFace2') coinFaceRefs.current[1] = child;
        if (child.name === 'CoinFace3') coinFaceRefs.current[2] = child;
        if (child.name === 'CoinFace4') coinFaceRefs.current[3] = child;

        // Make Angel and CoinFace meshes clickable for zoom. Match any mesh
        // whose name contains "angel" (case-insensitive) so the desktop and
        // mobile GLBs both wire up regardless of exact naming variations.
        if (child.name && /angel/i.test(child.name)) {
          const setAngelClickable = (obj) => {
            obj.userData.clickable = true;
            obj.userData.agentId = 'Angel';
            obj.userData.agentName = 'Angel';
            obj.userData.targetObject = child;
            if (obj.children && obj.children.length > 0) {
              obj.children.forEach(setAngelClickable);
            }
          };
          setAngelClickable(child);
        }
        if (child.name && child.name.startsWith('CoinFace')) {
          child.userData.clickable = true;
          child.userData.agentId = 'Angel';
          child.userData.agentName = 'Angel';
          child.userData.targetObject = child;
        }
      });

      // On mobile, hide the Coin meshes behind CoinFaces (CoinFaces are the visible avatars there)
      if (isOnMobile) {
        const coinMeshRefs = [coin1Ref, coin2Ref, coin3Ref, coin4Ref]
        coinMeshRefs.forEach(ref => {
          if (ref.current) ref.current.visible = false
        })
      }

      // Sort collected XCandle nodes by name for consistent indexing
      xCandleNodesRef.current.sort((a, b) => a.name.localeCompare(b.name));
      // Store candleIndex on each node's userData for click handler
      xCandleNodesRef.current.forEach((node, idx) => {
        const setIndex = (obj) => {
          obj.userData.candleIndex = idx;
          if (obj.children) obj.children.forEach(setIndex);
        };
        setIndex(node);
      });

      // Call onLoad callback if provided
      if (onLoad) {
        setTimeout(() => {
          onLoad();
        }, 100);
      }
    },
    // Progress callback
    () => {
      // Progress tracking available if needed
    },
    // Error callback
    (error) => {
      console.error(`[CyborgTempleScene] Error loading model ${urlToLoad}:`, error);
      console.error(`[CyborgTempleScene] Error details:`, {
        message: error.message,
        stack: error.stack,
        modelPath: modelPath,
        urlUsed: urlToLoad,
        isOnMobile: isOnMobile,
        userAgent: navigator.userAgent,
        windowWidth: window.innerWidth,
        attemptNumber: retryCount + 1
      });
      
      // Check if it's a 404 error
      if (error.message && error.message.includes('404')) {
        console.error(`[CyborgTempleScene] Model file not found at path: ${modelPath}`);
        console.error('[CyborgTempleScene] Please ensure the file exists at: public' + modelPath);
      }
      
      // Any error on the optimized model — 404, decode failure, WASM
      // init race, etc. — falls back to the un-optimized GLB immediately.
      // Decode errors are the typical Android Chrome failure mode for
      // Meshopt/WebP-compressed models, so we don't want to burn retries
      // hitting the same broken file.
      if (!usingFallback && modelPath !== fallbackModelPath) {
        console.warn('[CyborgTempleScene] Opt model failed — falling back to un-optimized model immediately. Error:', error?.message || error);
        modelPath = fallbackModelPath;
        usingFallback = true;
        retryCount = 0;
        setTimeout(() => loadModel(false), 50);
        return;
      }

      // Retry logic with full URL fallback for non-404 errors
      if (retryCount < maxRetries) {
        retryCount++;
        const useFullUrl = retryCount >= 2; // Try full URL on second retry

        // On last retry, fall back to un-optimized GLB. Applies to both
        // desktop and mobile (no longer mobile-gated since we now use the
        // same source GLB everywhere — mobile just gets the smaller opt build).
        if (retryCount === maxRetries && !usingFallback && modelPath !== fallbackModelPath) {
          console.warn(`[CyborgTempleScene] Optimized model failed, attempting fallback to un-optimized model...`);
          modelPath = fallbackModelPath;
          usingFallback = true;
          retryCount = maxRetries - 1; // Give one more chance with fallback
        }

        console.warn(`[CyborgTempleScene] Retrying model load (attempt ${retryCount}/${maxRetries})${useFullUrl ? ' with full URL' : ''}${usingFallback ? ' using fallback model' : ''}...`);
        setTimeout(() => {
          loadModel(useFullUrl);
        }, 1000 * retryCount); // Exponential backoff
      } else {
        console.error(`[CyborgTempleScene] Failed to load model after ${maxRetries} attempts`);
        console.error('[CyborgTempleScene] Model loading is REQUIRED. Page will not proceed.');
        
        // Don't call onLoad when model fails - this prevents the page from loading
        // Instead, show an error message to the user
        if (typeof window !== 'undefined') {
          // Create an error overlay
          const errorDiv = document.createElement('div');
          errorDiv.style.position = 'fixed';
          errorDiv.style.top = '50%';
          errorDiv.style.left = '50%';
          errorDiv.style.transform = 'translate(-50%, -50%)';
          errorDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.9)';
          errorDiv.style.color = 'white';
          errorDiv.style.padding = '20px';
          errorDiv.style.borderRadius = '10px';
          errorDiv.style.zIndex = '100000';
          errorDiv.style.textAlign = 'center';
          errorDiv.style.maxWidth = '80%';
          errorDiv.innerHTML = `
            <h2>Failed to Load 3D Model</h2>
            <p>Unable to load the required 3D model (${modelPath}).</p>
            <p>Please refresh the page or try again later.</p>
            <button onclick="window.location.reload()" style="
              margin-top: 10px;
              padding: 10px 20px;
              background: white;
              color: black;
              border: none;
              border-radius: 5px;
              cursor: pointer;
            ">Refresh Page</button>
          `;
          document.body.appendChild(errorDiv);
        }
      }
    });
    };
    
    // Start loading the model
    loadModel();

    }, 100); // 100ms delay to ensure ref is attached
    
    // Cleanup function
    return () => {
      clearTimeout(timer);
      if (groupRef.current) {
        // Clear the group's children
        while (groupRef.current.children.length > 0) {
          groupRef.current.remove(groupRef.current.children[0]);
        }
        
        // Dispose of materials and geometries
        groupRef.current.traverse((child) => {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      }
    };
  }, []); // Empty dependency array - only run once on mount

  // Store initial camera position only once
  useEffect(() => {
    if (!originalCameraPosition.current && camera) {
      originalCameraPosition.current = camera.position.clone();
    }
  }, [camera]);

  // Resting orbit pivot — sits near the workstation/character cluster so
  // OrbitControls rotates around the visible center of the model rather than
  // world origin. Mirrors the model's position offset between mobile/desktop.
  const restingOrbitCenter = useMemo(
    () => new THREE.Vector3(0, isMobile ? 0.0 : -0.5, 0),
    [isMobile]
  );
  const orbitTargetInitedRef = useRef(false);
  
  // Update PalmTree visibility when is80sMode changes
  useEffect(() => {
    if (palmTreeRefs.current && palmTreeRefs.current.length > 0) {
      palmTreeRefs.current.forEach(palmTree => {
        if (palmTree) {
          palmTree.visible = is80sMode;
        }
      });
    }
  }, [is80sMode]);

  // Apply claimed candle data: brighten node + swap senora texture with user image
  useEffect(() => {
    if (!xCandleNodesRef.current.length || !templeCandles.length) return;
    const textureLoader = new THREE.TextureLoader();
    templeCandles.forEach((candle) => {
      const node = xCandleNodesRef.current[candle.candleIndex];
      if (!node) return;
      // Show the claimed candle
      node.visible = true;
      // Swap senora mesh texture with user image
      if (candle.userImageUrl) {
        node.traverse((descendant) => {
          if (!descendant.isMesh) return;
          const isSenora = descendant.name === 'senora' || descendant.name === 'Senora' ||
            (descendant.material && (
              descendant.material.name === 'senora' || descendant.material.name === 'senora.001' ||
              descendant.material.name === 'Senora' || descendant.material.name === 'Material.001'
            )) ||
            (descendant.parent && descendant.parent.name === 'senora');
          if (!isSenora) return;
          textureLoader.load(candle.userImageUrl, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.flipY = false;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            if (!descendant.material.userData?.cloned) {
              descendant.material = descendant.material.clone();
              descendant.material.userData = { cloned: true };
            }
            descendant.material.map = texture;
            descendant.material.transparent = true;
            descendant.material.opacity = 1;
            descendant.material.alphaTest = 0.1;
            descendant.material.needsUpdate = true;
          });
        });
      }
    });
  }, [templeCandles]);

  // Add raycaster for click detection and keyboard shortcuts
  useEffect(() => {
    if (!groupRef.current || !gl) return;
    
    
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Helper: restore demon to normal animation rotation when leaving focus
    const restoreDemonFromFocus = () => {
      if (!demonFocusedRef.current) return;
      demonFocusedRef.current = false;
      const demonActions = actionsRef.current['Demon'];
      const demonMixer = mixersRef.current['Demon'];
      const demonState = demonAnimStateRef.current;
      // Cancel any in-flight focus sequence (the 2s idle→pointing handoff
      // and the 'finished' listener that swaps back to idle).
      if (demonState.focusSequenceTimers) {
        demonState.focusSequenceTimers.forEach(clearTimeout);
        demonState.focusSequenceTimers = [];
      }
      if (demonState.focusSequenceListener && demonMixer) {
        demonMixer.removeEventListener('finished', demonState.focusSequenceListener);
        demonState.focusSequenceListener = null;
      }
      demonArmAimingRef.current = false;
      if (!demonActions) return;
      const loopAnims = Object.keys(demonActions).filter(a => /typing|idle|laughing/i.test(a) && !/sit_idle/i.test(a));
      const returnAnim = loopAnims.length > 0 ? loopAnims[0] : Object.keys(demonActions)[0];
      if (demonActions[demonState.currentAnimation]) {
        demonActions[demonState.currentAnimation].fadeOut(0.5);
      }
      if (demonActions[returnAnim]) {
        const returnAction = demonActions[returnAnim];
        returnAction.reset();
        returnAction.setLoop(THREE.LoopRepeat);
        returnAction.setEffectiveWeight(1);
        returnAction.fadeIn(0.5);
        returnAction.play();
        demonState.currentAnimation = returnAnim;
      }
      demonState.isPlayingSpecial = false;
      demonState.nextSwitchDelay = Math.random() * 8000 + 6000;
      demonState.lastSwitchTime = Date.now();
    };

    // Helper: restore monk to normal animation rotation when leaving focus
    const restoreMonkFromFocus = () => {
      if (!monkFocusedRef.current) return;
      monkFocusedRef.current = false;
      const monkActions = actionsRef.current['Monk'];
      if (!monkActions) return;
      const monkState = monkAnimStateRef.current;
      const loopAnims = Object.keys(monkActions).filter(a => /typing|idle|laughing/i.test(a) && !/idle_monk/i.test(a));
      const returnAnim = loopAnims.length > 0 ? loopAnims[0] : Object.keys(monkActions)[0];
      if (monkActions[monkState.currentAnimation]) {
        monkActions[monkState.currentAnimation].fadeOut(0.5);
      }
      if (monkActions[returnAnim]) {
        const returnAction = monkActions[returnAnim];
        returnAction.reset();
        returnAction.setLoop(THREE.LoopRepeat);
        returnAction.setEffectiveWeight(1);
        returnAction.fadeIn(0.5);
        returnAction.play();
        monkState.currentAnimation = returnAnim;
      }
      monkState.isPlayingSpecial = false;
      monkState.nextSwitchDelay = Math.random() * 8000 + 6000;
      monkState.lastSwitchTime = Date.now();
    };

    // Helper: restore RL80 to normal animation rotation when leaving focus
    const restoreRL80FromFocus = () => {
      if (!rl80FocusedRef.current) return;
      rl80FocusedRef.current = false;
      // Cancel any pending Unicorn_waving trigger / its post-wave fade-back.
      if (unicornWaveStateRef.current.timeoutId) {
        clearTimeout(unicornWaveStateRef.current.timeoutId);
        unicornWaveStateRef.current.timeoutId = null;
      }
      unicornWaveStateRef.current.armed = false;
      const rl80Actions = actionsRef.current['RL80'];
      if (!rl80Actions) return;
      // Fade out the additive wave action if still running — it's not tracked
      // via rl80State.currentAnimation, so the loop-anim restore below
      // wouldn't otherwise touch it.
      const waveKey = Object.keys(rl80Actions).find(a => /wav/i.test(a));
      if (waveKey && rl80Actions[waveKey].isRunning && rl80Actions[waveKey].isRunning()) {
        rl80Actions[waveKey].fadeOut(0.4);
      }
      const rl80State = rl80AnimStateRef.current;
      const loopAnims = Object.keys(rl80Actions).filter(a => /typing|idle/i.test(a) && a !== 'sit_idle');
      const returnAnim = loopAnims.length > 0 ? loopAnims[0] : Object.keys(rl80Actions)[0];
      const prevAction = rl80Actions[rl80State.currentAnimation];
      const returnAction = rl80Actions[returnAnim];

      // No-op if already on the target clip — avoids a bind-pose flash.
      if (returnAction && returnAction !== prevAction) {
        if (prevAction) prevAction.fadeOut(0.5);
        // Skip the bind-pose first frame so the cross-fade doesn't pop the
        // unicorn through neutral on un-zoom.
        const clipDur = returnAction.getClip().duration;
        returnAction.reset();
        returnAction.time = clipDur * 0.1;
        returnAction.setLoop(THREE.LoopRepeat);
        returnAction.fadeIn(0.5);
        returnAction.play();
        rl80State.currentAnimation = returnAnim;
      }
      rl80State.isPlayingSpecial = false;
      rl80State.nextSwitchDelay = Math.random() * 8000 + 6000;
      rl80State.lastSwitchTime = Date.now();
    };

    // Helper: restore Fluffy to normal when leaving focus
    const restoreFluffyFromFocus = () => {
      if (!fluffyFocusedRef.current) return;
      fluffyFocusedRef.current = false;
      // Unpause the animation
      const fluffyActions = actionsRef.current['Fluffy'];
      if (fluffyActions) {
        Object.values(fluffyActions).forEach(action => {
          action.paused = false;
        });
      }
    };

    // Helper: restore Granny to normal when leaving focus. Cross-fades
    // granny_idle → granny_typing and resets the pump timer so she doesn't
    // immediately fist-pump on un-zoom.
    const restoreGrannyFromFocus = () => {
      if (!grannyFocusedRef.current) return;
      grannyFocusedRef.current = false;
      const grannyActions = actionsRef.current['Granny'];
      const grannyState = grannyAnimStateRef.current;
      if (grannyActions) {
        const typingKey = Object.keys(grannyActions).find(a => /granny.*typ/i.test(a));
        if (grannyActions[grannyState.currentAnimation]) {
          grannyActions[grannyState.currentAnimation].fadeOut(0.5);
        }
        if (typingKey && grannyActions[typingKey]) {
          const typingAction = grannyActions[typingKey];
          typingAction.reset();
          typingAction.setLoop(THREE.LoopRepeat);
          typingAction.setEffectiveWeight(1);
          typingAction.fadeIn(0.5);
          typingAction.play();
          grannyState.currentAnimation = typingKey;
        }
      }
      grannyState.isPlayingSpecial = false;
      grannyState.nextSwitchDelay = Math.random() * 8000 + 8000;
      grannyState.lastSwitchTime = Date.now();
    };

    // Helper: restore all characters from focus
    const restoreAllFromFocus = () => {
      restoreDemonFromFocus();
      restoreMonkFromFocus();
      restoreRL80FromFocus();
      restoreFluffyFromFocus();
      restoreGrannyFromFocus();
    };

    // Handle escape key to reset camera
    const handleKeyDown = (event) => {
      // Debug: Press 'P' to log all character positions
      if (event.key === 'p' || event.key === 'P') {
        
        // Find and log each character's position
        if (groupRef.current) {
          groupRef.current.traverse((child) => {
            // Check various possible names
            if (child.name === 'OurLady' || child.name === 'Object_7' || child.name === 'RL80') {
              const pos = new THREE.Vector3();
              child.getWorldPosition(pos);
            }
            
            if (child.name === 'Demon' || child.name === 'Monk_empty' || child.name === 'Tekno' || child.name === 'Fluffy_Empty') {
              const pos = new THREE.Vector3();
              child.getWorldPosition(pos);
            }
            
            if (child.name === 'Mike' || child.name === 'Cube010') {
              const pos = new THREE.Vector3();
              child.getWorldPosition(pos);
            }
            
            // Log screen positions
            if (child.name === 'Screen1' || child.name === 'Screen2' || 
                child.name === 'Screen3' || child.name === 'Screen4') {
              const pos = new THREE.Vector3();
              child.getWorldPosition(pos);
            }
          });
        }
      }
      
      
      if (event.key === 'Escape' && focusTarget) {

        restoreAllFromFocus();

        // Notify parent that focus is cleared
        if (onAgentClick) {
          onAgentClick(null);
        }
        
        if (originalCameraPosition.current) {
          const resetTarget = {
            position: originalCameraPosition.current.clone(),
            lookAt: restingOrbitCenter.clone(),
            agentId: null,
            agentName: 'Reset'
          };
          setFocusTarget(resetTarget);
          
          setTimeout(() => {
            setFocusTarget(null);
            // Keep originalCameraPosition pinned to the page-load position
            // so subsequent focus/un-focus cycles return here too.
          }, 1000);
        } else {
          setFocusTarget(null);
        }
      }
    };
    
    // Touch events for mobile and tablets
    const handleTouchStart = (event) => {
      // Don't prevent default for better touch compatibility
      // event.preventDefault();

      // Safety check for groupRef
      if (!groupRef.current) return;

      // For touchend events, use changedTouches instead of touches
      const touch = event.touches ? event.touches[0] : event.changedTouches[0];
      if (!touch) return; // Safety check

      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(groupRef.current.children, true);

      let touchedSomething = false;

      for (let i = 0; i < intersects.length; i++) {
        const object = intersects[i].object;

        if (object.userData.isCoin) {
          touchedSomething = true;
          // Prevent default only when we're actually interacting with a coin and it's cancelable
          if (event.cancelable) {
            event.preventDefault();
          }

          // Trigger coin animation
          const coinName = object.userData.agentId;
          triggerCoinAnimation(coinName);

          // Also trigger the card display
          if (onAgentClick) {
            onAgentClick(coinName);
          }
          break;
        }

        // Handle CoinFace touch on mobile — fire callback
        if (isOnMobile && object.name && object.name.startsWith('CoinFace')) {
          touchedSomething = true;
          if (event.cancelable) {
            event.preventDefault();
          }
          if (onCoinFaceTap) {
            const coinIndex = parseInt(object.name.replace('CoinFace', '')) - 1;
            onCoinFaceTap(coinIndex);
          }
          break;
        }
      }

    };

    // Function to trigger coin click animation
    const triggerCoinAnimation = (coinName) => {
      const animState = coinAnimationState.current[coinName];
      if (animState) {
        animState.isAnimating = true;
        animState.startTime = Date.now();
        animState.flutterIntensity = 1.0;
        setClickedCoin(coinName);
        
        // Reset after animation completes
        setTimeout(() => {
          animState.isAnimating = false;
          animState.flutterIntensity = 0;
          setClickedCoin(null);
        }, 1500); // 1.5 second animation
      }
    };
    
    // Also set up hover detection for visual feedback
    const handlePointerMove = (event) => {
      // Safety check for groupRef
      if (!groupRef.current) return;

      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(groupRef.current.children, true);
      
      // Change cursor if hovering over clickable object and handle coin hover
      let foundClickable = false;
      let foundCoin = null;
      
      for (let i = 0; i < intersects.length; i++) {
        const object = intersects[i].object;
        if (object.userData.clickable) {
          foundClickable = true;
          
          // Check if it's a coin
          if (object.userData.isCoin) {
            foundCoin = object.userData.agentId;
          }
          break;
        }
      }
      
      // Handle coin hover effects
      if (foundCoin && hoveredCoin !== foundCoin) {
        // Start hovering on a coin
        setHoveredCoin(foundCoin);
        
        // Get the appropriate coin ref and scale/emissive refs
        let coinRef, scaleRef, emissiveRef;
        switch(foundCoin) {
          case 'Coin1':
            coinRef = coin1Ref;
            scaleRef = coin1OriginalScale;
            emissiveRef = coin1OriginalEmissive;
            break;
          case 'Coin2':
            coinRef = coin2Ref;
            scaleRef = coin2OriginalScale;
            emissiveRef = coin2OriginalEmissive;
            break;
          case 'Coin3':
            coinRef = coin3Ref;
            scaleRef = coin3OriginalScale;
            emissiveRef = coin3OriginalEmissive;
            break;
          case 'Coin4':
            coinRef = coin4Ref;
            scaleRef = coin4OriginalScale;
            emissiveRef = coin4OriginalEmissive;
            break;
        }
        
        if (coinRef && coinRef.current) {
          // Store original values if not already stored
          if (!scaleRef.current) {
            scaleRef.current = coinRef.current.scale.clone();
          }
          
          // Find the mesh material and store original emissive
          coinRef.current.traverse((child) => {
            if (child.isMesh && child.material) {
              if (!emissiveRef.current) {
                emissiveRef.current = {
                  color: child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0x000000),
                  intensity: child.material.emissiveIntensity || 0
                };
              }
              // Set hover emissive with different colors for each coin
              if (child.material.emissive) {
                const colors = {
                  'Coin1': 0x00ff00, // Green
                  'Coin2': 0x00ffff, // Cyan
                  'Coin3': 0xff00ff, // Magenta
                  'Coin4': 0xffdd00  // Gold
                };
                child.material.emissive = new THREE.Color(colors[foundCoin] || 0xffdd00);
              }
              child.material.emissiveIntensity = 3; // Increased emission for better visibility
            }
          });
          
          // Scale up more noticeably
          coinRef.current.scale.multiplyScalar(1.2);
        }
      } else if (!foundCoin && hoveredCoin) {
        // Stop hovering on any coin
        
        // Get the appropriate coin ref and scale/emissive refs
        let coinRef, scaleRef, emissiveRef;
        switch(hoveredCoin) {
          case 'Coin1':
            coinRef = coin1Ref;
            scaleRef = coin1OriginalScale;
            emissiveRef = coin1OriginalEmissive;
            break;
          case 'Coin2':
            coinRef = coin2Ref;
            scaleRef = coin2OriginalScale;
            emissiveRef = coin2OriginalEmissive;
            break;
          case 'Coin3':
            coinRef = coin3Ref;
            scaleRef = coin3OriginalScale;
            emissiveRef = coin3OriginalEmissive;
            break;
          case 'Coin4':
            coinRef = coin4Ref;
            scaleRef = coin4OriginalScale;
            emissiveRef = coin4OriginalEmissive;
            break;
        }
        
        if (coinRef && coinRef.current) {
          // Restore original scale
          if (scaleRef.current) {
            coinRef.current.scale.copy(scaleRef.current);
          }
          
          // Restore original emissive
          coinRef.current.traverse((child) => {
            if (child.isMesh && child.material && emissiveRef.current) {
              child.material.emissive = emissiveRef.current.color;
              child.material.emissiveIntensity = emissiveRef.current.intensity;
            }
          });
        }
        
        setHoveredCoin(null);
      }
      
      gl.domElement.style.cursor = foundClickable ? 'pointer' : 'default';
    };
    
    const handleClick = (event) => {
      // Prevent default to avoid any interference
      event.preventDefault();
      event.stopPropagation();

      // Safety check for groupRef
      if (!groupRef.current) return;

      // Calculate mouse position in normalized device coordinates
      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;


      // Update the picking ray with the camera and mouse position
      raycaster.setFromCamera(mouse, camera);

      // Calculate objects intersecting the picking ray
      const intersects = raycaster.intersectObjects(groupRef.current.children, true);
      
      let clickedOnAgent = false;

      for (let i = 0; i < intersects.length; i++) {
        const object = intersects[i].object;

        if (object.userData.clickable) {
          clickedOnAgent = true;

          // Special handling for coins - trigger animation and show FocusedAgentCard
          if (object.userData.isCoin) {

            // Trigger the coin animation
            triggerCoinAnimation(object.userData.agentId);

            // Call the parent callback to show FocusedAgentCard
            if (onAgentClick) {
              onAgentClick(object.userData.agentId); // This will trigger the FocusedAgentCard to show
            }
            break; // Exit early for coins
          }

          // On mobile, CoinFace tap fires callback for parent to handle
          if (isOnMobile && object.name && object.name.startsWith('CoinFace')) {
            if (onCoinFaceTap) {
              const coinIndex = parseInt(object.name.replace('CoinFace', '')) - 1;
              onCoinFaceTap(coinIndex);
            }
            break;
          }

          // Show TopText/x_logo banner when clicking Angel area
          if (object.userData.agentId === 'Angel') {
            topSupporterBannerRefs.current.forEach(mesh => {
              if (mesh) mesh.visible = true;
            });
          }

          // XCandle click — first click zooms in, second click opens inspector
          if (object.userData.agentId === 'XCandle') {
            const candleIndex = object.userData.candleIndex ?? -1;
            const isAlreadyFocused = focusTarget && focusTarget.agentId === 'XCandle' && focusTarget.candleIndex === candleIndex;

            if (isAlreadyFocused) {
              // Second click — show info overlay (stay zoomed)
              window.dispatchEvent(new CustomEvent('xCandleClicked', {
                detail: {
                  candleIndex,
                  isLargeCandle: object.userData.isLargeCandle ?? false,
                }
              }));
            } else {
              // First click — zoom camera to candle. Don't overwrite
              // originalCameraPosition here; it was captured once at mount and
              // represents the page-load camera position the user expects to
              // return to on un-focus.
              const targetObj = object.userData.targetObject || object;
              const candleWorldPos = new THREE.Vector3();
              targetObj.getWorldPosition(candleWorldPos);
              // Position camera slightly in front and above the candle
              const cameraOffset = new THREE.Vector3(0, 0.3, 1.2);
              const cameraPos = candleWorldPos.clone().add(cameraOffset);
              setFocusTarget({
                position: cameraPos,
                lookAt: candleWorldPos,
                agentId: 'XCandle',
                agentName: 'XCandle',
                candleIndex,
              });
            }
            break;
          }

          // If already focused on this screen, unfocus (toggle behavior)
          if (focusTarget && focusTarget.agentId === object.userData.agentId) {
            restoreAllFromFocus();
            if (onAgentClick) onAgentClick(null);
            if (originalCameraPosition.current) {
              setFocusTarget({
                position: originalCameraPosition.current.clone(),
                lookAt: restingOrbitCenter.clone(),
                // Restore the default FOV on un-focus (mobile widens during
                // focus; this lerps it back).
                fov: isMobile ? 55 : 50,
                agentId: null,
                agentName: 'Reset'
              });
              setTimeout(() => {
                setFocusTarget(null);
                // Keep originalCameraPosition pinned — it represents the
                // page-load overview position, not the most recent un-focus.
              }, 1000);
            } else {
              setFocusTarget(null);
            }
            break;
          }

          // originalCameraPosition was captured once at mount (line ~1535)
          // and stays pinned to the page-load camera position. Don't refresh
          // it here — that would mean the user returns to wherever they were
          // mid-orbit before clicking, instead of the original overview.

          // Get the target object's world position
          const targetObject = object.userData.targetObject || object;
          const objectWorldPos = new THREE.Vector3();
          targetObject.getWorldPosition(objectWorldPos);
          
          const settings = resolveAgentSettings(object.userData.agentId, isOnMobile);

          if (!settings) {
            // Fallback: calculate a reasonable position based on object location
            const cameraPosition = new THREE.Vector3(
              objectWorldPos.x + 2,
              objectWorldPos.y + 0.5,
              objectWorldPos.z + 3
            );
            const lookAtTarget = objectWorldPos.clone();
            lookAtTarget.y += 0.5;

            setFocusTarget({
              position: cameraPosition,
              lookAt: lookAtTarget,
              agentId: object.userData.agentId,
              agentName: object.userData.agentName
            });
          } else {
            // Use absolute positions for known agents. resolveAgentSettings()
            // already merged any mobile overrides on top of the desktop values.
            // On mobile we additionally widen the FOV during focus so the
            // subject reads smaller in the portrait viewport without changing
            // camera position.
            setFocusTarget({
              position: settings.cameraPos,
              lookAt: settings.lookAtPos,
              // Optional override: where OrbitControls revolves around after
              // the fly-in arrives. Defaults to lookAt when not provided.
              orbitCenter: settings.orbitCenter,
              fov: isMobile ? 75 : undefined,
              agentId: object.userData.agentId,
              agentName: object.userData.agentName
            });
          }
          
          // When focusing on a character, switch to idle animation and enable head tracking
          if (object.userData.agentId === 'Demon') {
            demonFocusedRef.current = true;
            const demonActions = actionsRef.current['Demon'];
            const demonMixer = mixersRef.current['Demon'];
            if (demonActions && demonMixer) {
              const idleKey = Object.keys(demonActions).find(a => /demon.*idle/i.test(a));
              const pointingKey = Object.keys(demonActions).find(a => /demon.*pointing/i.test(a));
              const demonState = demonAnimStateRef.current;

              const playIdle = (fadeIn = 0.5) => {
                if (demonState.currentAnimation && demonActions[demonState.currentAnimation] && demonState.currentAnimation !== idleKey) {
                  demonActions[demonState.currentAnimation].fadeOut(0.3);
                }
                const idleAction = demonActions[idleKey];
                idleAction.reset();
                idleAction.setLoop(THREE.LoopRepeat);
                idleAction.setEffectiveWeight(1);
                idleAction.fadeIn(fadeIn);
                idleAction.play();
                demonState.currentAnimation = idleKey;
              };

              if (idleKey) {
                // Mark special so the random-alternation poller leaves us alone.
                demonState.isPlayingSpecial = true;
                demonState.nextSwitchDelay = 999999;
                demonState.lastSwitchTime = Date.now();
                demonState.focusSequenceTimers = demonState.focusSequenceTimers || [];

                // Stage 1: fade in idle immediately.
                playIdle(0.5);

                if (pointingKey) {
                  // Stage 2: after 2s, play pointing once, then return to idle.
                  const t1 = setTimeout(() => {
                    if (!demonFocusedRef.current) return;
                    const pointingAction = demonActions[pointingKey];
                    const idleAction = demonActions[idleKey];

                    pointingAction.reset();
                    pointingAction.setLoop(THREE.LoopOnce);
                    // Hold the last pointing pose at full weight until the
                    // crossfade to idle actually pulls it down — otherwise
                    // pointing's weight snaps to 0 the instant 'finished'
                    // fires, and the bones briefly fall to T-pose.
                    pointingAction.clampWhenFinished = true;
                    pointingAction.setEffectiveWeight(1);
                    idleAction.fadeOut(0.3);
                    pointingAction.fadeIn(0.3);
                    pointingAction.play();
                    demonState.currentAnimation = pointingKey;
                    // Override the upper-arm rotation each frame to aim at
                    // the camera while pointing is playing.
                    demonArmAimingRef.current = true;

                    const onFinished = (e) => {
                      if (e.action !== pointingAction) return;
                      demonMixer.removeEventListener('finished', onFinished);
                      demonState.focusSequenceListener = null;
                      demonArmAimingRef.current = false;
                      if (!demonFocusedRef.current) return;
                      // Stage 3: back to idle for the remainder of focus.
                      playIdle(0.3);
                    };
                    demonMixer.addEventListener('finished', onFinished);
                    demonState.focusSequenceListener = onFinished;
                  }, 2000);
                  demonState.focusSequenceTimers.push(t1);
                }
              } else {
                console.warn('[Demon] demon_idle animation not found. Available:', Object.keys(demonActions));
              }
            }
          } else if (object.userData.agentId === 'Monk') {
            monkFocusedRef.current = true;
            // Stop the attention-getting waving_over loop forever — user has
            // engaged with the monk; the game flow takes over from here.
            monkWaveStateRef.current.hasBeenFocused = true;
            monkWaveStateRef.current.attentionActive = false;
            const monkActions = actionsRef.current['Monk'];
            if (monkActions) {
              const idleKey = Object.keys(monkActions).find(a => /idle_monk/i.test(a));
              if (idleKey) {
                const monkState = monkAnimStateRef.current;
                if (monkActions[monkState.currentAnimation]) {
                  monkActions[monkState.currentAnimation].fadeOut(0.5);
                }
                const idleAction = monkActions[idleKey];
                idleAction.reset();
                idleAction.setLoop(THREE.LoopRepeat);
                idleAction.setEffectiveWeight(1);
                idleAction.fadeIn(0.5);
                idleAction.play();
                monkState.currentAnimation = idleKey;
                monkState.isPlayingSpecial = true;
                monkState.nextSwitchDelay = 999999;
                monkState.lastSwitchTime = Date.now();
              } else {
                console.warn('[Monk] idle_monk animation not found. Available:', Object.keys(monkActions));
              }
            }
          } else if (object.userData.agentId === 'RL80') {
            rl80FocusedRef.current = true;
            const rl80Actions = actionsRef.current['RL80'];
            if (rl80Actions) {
              const rl80State = rl80AnimStateRef.current;
              const animKeys = Object.keys(rl80Actions);
              // Prefer an Idle animation; fall back to Typing. Match the
              // keyword at start or after an underscore so both Typing_Unicorn
              // and Unicorn_Typing-style names resolve.
              const idleKey = animKeys.find(a => /(?:^|_)idle/i.test(a))
                || animKeys.find(a => /(?:^|_)typing/i.test(a));
              const prevAction = rl80Actions[rl80State.currentAnimation];
              const idleAction = idleKey ? rl80Actions[idleKey] : null;

              // No-op if we'd be transitioning to the same clip (avoids a
              // bind-pose flash from reset()).
              if (idleAction && idleAction !== prevAction) {
                if (prevAction) prevAction.fadeOut(0.5);
                // Skip the bind-pose first frame so the cross-fade doesn't
                // jump the unicorn through neutral.
                const clipDur = idleAction.getClip().duration;
                idleAction.reset();
                idleAction.time = clipDur * 0.1;
                idleAction.setLoop(THREE.LoopRepeat);
                idleAction.fadeIn(0.5);
                idleAction.play();
                rl80State.currentAnimation = idleKey;
              }
              rl80State.isPlayingSpecial = true;
              rl80State.nextSwitchDelay = 999999;
              rl80State.lastSwitchTime = Date.now();
              if (!idleAction) {
                console.warn('[RL80] Idle animation not found. Available:', animKeys);
              }
            }
            // Arm one-shot Unicorn_waving — fires 2s after camera arrival.
            if (unicornWaveStateRef.current.timeoutId) {
              clearTimeout(unicornWaveStateRef.current.timeoutId);
              unicornWaveStateRef.current.timeoutId = null;
            }
            unicornWaveStateRef.current.armed = true;
          } else if (object.userData.agentId === 'Fluffy') {
            fluffyFocusedRef.current = true;
            // Pause the animation so the cat sits still — eliminates loop seam glitch
            const fluffyActions = actionsRef.current['Fluffy'];
            if (fluffyActions) {
              Object.values(fluffyActions).forEach(action => {
                action.paused = true;
              });
            }
          } else if (object.userData.agentId === 'Granny') {
            grannyFocusedRef.current = true;
            const grannyState = grannyAnimStateRef.current;
            // Cancel any pending pump-return setTimeout so a queued
            // typing.play() doesn't slam over the idle we're about to start.
            if (grannyState.pumpReturnTimeoutId) {
              clearTimeout(grannyState.pumpReturnTimeoutId);
              grannyState.pumpReturnTimeoutId = null;
            }
            // Cross-fade whatever is playing → granny_idle while focused so
            // the close-up reads as attentive instead of mid-keystroke.
            const grannyActions = actionsRef.current['Granny'];
            if (grannyActions) {
              const idleKey = Object.keys(grannyActions).find(a => /granny.*idle/i.test(a));
              if (idleKey) {
                // Fade out ALL currently-running clips, not just whichever
                // grannyState.currentAnimation thinks is current — covers
                // the case where a pump just started typing back behind us.
                Object.values(grannyActions).forEach((action) => {
                  if (action && action.isRunning && action.isRunning()) {
                    action.fadeOut(0.5);
                  }
                });
                const idleAction = grannyActions[idleKey];
                idleAction.reset();
                idleAction.setLoop(THREE.LoopRepeat);
                idleAction.setEffectiveWeight(1);
                idleAction.fadeIn(0.5);
                idleAction.play();
                grannyState.currentAnimation = idleKey;
                grannyState.isPlayingSpecial = true;
                grannyState.nextSwitchDelay = 999999;
                grannyState.lastSwitchTime = Date.now();
              }
            }
          }

          // Call the parent callback if provided
          if (onAgentClick) {
            onAgentClick(object.userData.agentId);
          }

          // Dispatch custom event for screens to handle video toggle
          if (object.userData.agentId && object.userData.agentId.startsWith('Screen')) {
            window.dispatchEvent(new CustomEvent('screenClicked', {
              detail: { screenName: object.userData.agentId }
            }));

            // For Screen3 (TeknoScreen), also dispatch UV coordinates for button clicks
            if (object.userData.agentId === 'Screen3' && intersects[i].uv) {
              window.dispatchEvent(new CustomEvent('screen3Click', {
                detail: { uv: intersects[i].uv }
              }));
            }
          }
          
          break; // Stop after first clickable object
        }
      }
      
      // Single click away no longer unfocuses — use double-click or Escape instead
    };
    
    // Listen for screenGoBack event (from on-screen buttons)
    const handleScreenGoBack = () => {
      if (focusTarget) {
        topSupporterBannerRefs.current.forEach(mesh => {
          if (mesh) mesh.visible = false;
        });
        if (onAgentClick) onAgentClick(null);
        if (originalCameraPosition.current) {
          setFocusTarget({
            position: originalCameraPosition.current.clone(),
            lookAt: restingOrbitCenter.clone(),
            agentId: null,
            agentName: 'Reset'
          });
          setTimeout(() => {
            setFocusTarget(null);
            // Don't null originalCameraPosition — keep page-load anchor.
          }, 1000);
        } else {
          setFocusTarget(null);
        }
      }
    };
    window.addEventListener('screenGoBack', handleScreenGoBack);

    gl.domElement.addEventListener('click', handleClick);
    gl.domElement.addEventListener('pointermove', handlePointerMove);
    gl.domElement.addEventListener('touchstart', handleTouchStart);
    
    // Also add touchend as a backup
    gl.domElement.addEventListener('touchend', (event) => {
      handleTouchStart(event);
    });
    
    // Add pointer events for better tablet support
    const handlePointerDown = (event) => {
      // Safety check for groupRef
      if (!groupRef.current) return;

      // Only handle if it's a touch/pen input (not mouse)
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        const rect = gl.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(groupRef.current.children, true);

        let touchedSomething = false;

        for (let i = 0; i < intersects.length; i++) {
          const object = intersects[i].object;

          if (object.userData.isCoin) {
            touchedSomething = true;
            event.preventDefault();
            const coinName = object.userData.agentId;
            triggerCoinAnimation(coinName);

            if (onAgentClick) {
              onAgentClick(coinName);
            }
            break;
          }

        }

      }
    };

    // Double-click to unfocus and return to default view
    const handleDblClick = () => {
      if (!focusTarget) return;

      restoreDemonFromFocus();

      // Hide banner
      topSupporterBannerRefs.current.forEach(mesh => {
        if (mesh) mesh.visible = false;
      });

      if (onAgentClick) onAgentClick(null);

      if (originalCameraPosition.current) {
        setFocusTarget({
          position: originalCameraPosition.current.clone(),
          lookAt: restingOrbitCenter.clone(),
          agentId: null,
          agentName: 'Reset'
        });
        setTimeout(() => {
          setFocusTarget(null);
          // Don't null originalCameraPosition — keep page-load anchor.
        }, 1000);
      } else {
        setFocusTarget(null);
      }
    };

    gl.domElement.addEventListener('pointerdown', handlePointerDown);
    gl.domElement.addEventListener('dblclick', handleDblClick);

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      gl.domElement.removeEventListener('click', handleClick);
      gl.domElement.removeEventListener('pointermove', handlePointerMove);
      gl.domElement.removeEventListener('touchstart', handleTouchStart);
      gl.domElement.removeEventListener('touchend', handleTouchStart);
      gl.domElement.removeEventListener('pointerdown', handlePointerDown);
      gl.domElement.removeEventListener('dblclick', handleDblClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('screenGoBack', handleScreenGoBack);
      gl.domElement.style.cursor = 'default';
    };
  }, [gl, camera, onAgentClick, loadedModel, focusTarget, originalCameraPosition, hoveredCoin, 
      coin1OriginalScale, coin1OriginalEmissive, coin2OriginalScale, coin2OriginalEmissive,
      coin3OriginalScale, coin3OriginalEmissive, coin4OriginalScale, coin4OriginalEmissive, 
      isOnMobile, clickedCoin, onCoinFaceTap]); // Added dependencies

  

  // Animation loop
  useFrame((state, delta) => {
    // Update flame shader time for all flame meshes
    flameMaterialsRef.current.forEach(mat => {
      mat.uniforms.uTime.value = state.clock.elapsedTime;
    });

    // One-shot: nudge OrbitControls' initial pivot from world origin to the
    // workstation center so resting rotation feels centered on the model.
    if (!orbitTargetInitedRef.current && state.controls && state.controls.target) {
      state.controls.target.copy(restingOrbitCenter);
      state.controls.update();
      orbitTargetInitedRef.current = true;
    }

    // Skip the bind-pose region of looping unicorn (RL80) clips before
    // the mixer evaluates them. Mixamo-style clips anchor a bind pose at
    // frame 0 and the last frame; on loop wrap the mixer briefly hits
    // those, causing a one-frame T-pose flash. Pre-empting the wrap
    // (and forcing a minimum time at clip start) avoids it without
    // mutating the clip data, so position tracks stay intact.
    const rl80Actions = actionsRef.current?.['RL80'];
    if (rl80Actions) {
      const safeFrac = 0.05; // 5% inset on both ends
      Object.keys(rl80Actions).forEach((name) => {
        if (!/typ|idle/i.test(name) || /wav/i.test(name)) return;
        const action = rl80Actions[name];
        if (!action.isRunning() || action.paused) return;
        const dur = action.getClip().duration;
        const safe = dur * safeFrac;
        const advance = delta * (action.getEffectiveTimeScale?.() ?? action.timeScale ?? 1);
        if (action.time < safe) {
          action.time = safe;
        } else if (action.time + advance >= dur - safe) {
          // Pre-empt the loop wrap so the trailing bind frame is skipped
          // AND the next frame lands safely past the leading bind frame.
          action.time = safe;
        }
      });
    }

    // Update all character mixers independently
    if (mixersRef.current) {
      Object.values(mixersRef.current).forEach(mixer => {
        if (mixer) {
          mixer.update(delta);
        }
      });
    }
    
    // Handle Demon animation alternation — mostly typing/idle, occasional fistpump/disbelief
    if (!isOnMobile && actionsRef.current['Demon']) {
      const currentTime = Date.now();
      const demonState = demonAnimStateRef.current;

      if (demonState.lastSwitchTime === 0) {
        demonState.lastSwitchTime = currentTime;
      }

      if (!demonState.isPlayingSpecial && currentTime - demonState.lastSwitchTime > demonState.nextSwitchDelay) {
        const demonActions = actionsRef.current['Demon'];
        const availableAnimations = Object.keys(demonActions);

        // Demon animations use Root.001|* prefix — classify by suffix.
        // When `jackpotOnlyFistPump` is on, FistPump is reserved for
        // slot-machine jackpots and excluded from the random rotation.
        const loopAnimations = availableAnimations.filter(a =>
          /typing|idle|laughing/i.test(a));
        const specialPattern = jackpotOnlyFistPump
          ? /disbelief|clap/i
          : /fistpump|disbelief|clap/i;
        const specialAnimations = availableAnimations.filter(a =>
          specialPattern.test(a));

        if (availableAnimations.length === 0) return;

        let nextAnimation;

        if (loopAnimations.includes(demonState.currentAnimation)) {
          if (specialAnimations.length > 0 && Math.random() < 0.3) {
            nextAnimation = specialAnimations[Math.floor(Math.random() * specialAnimations.length)];
          } else if (loopAnimations.length > 1) {
            const others = loopAnimations.filter(a => a !== demonState.currentAnimation);
            nextAnimation = others[Math.floor(Math.random() * others.length)];
          } else {
            nextAnimation = loopAnimations[0];
          }
        } else {
          nextAnimation = loopAnimations.length > 0
            ? loopAnimations[Math.floor(Math.random() * loopAnimations.length)]
            : availableAnimations[0];
        }

        const currentAction = demonActions[demonState.currentAnimation];
        const nextAction = demonActions[nextAnimation];

        if (nextAction) {
          nextAction.reset();
          if (specialAnimations.includes(nextAnimation)) {
            nextAction.setLoop(THREE.LoopOnce, 1);
            nextAction.clampWhenFinished = true;
            demonState.isPlayingSpecial = true;
          } else {
            nextAction.setLoop(THREE.LoopRepeat);
          }
          nextAction.setEffectiveWeight(1);
          nextAction.play();

          // Use crossFadeTo so the fade-out and fade-in are scheduled
          // against the same mixer time — prevents the brief T-pose
          // flash from per-frame weight desync between separate
          // fadeOut/fadeIn calls.
          if (currentAction && currentAction !== nextAction) {
            currentAction.crossFadeTo(nextAction, 0.5, false);
          } else {
            nextAction.fadeIn(0.5);
          }

          if (specialAnimations.includes(nextAnimation)) {
            const animDuration = nextAction.getClip().duration * 1000;
            setTimeout(() => {
              const returnAnim = loopAnimations.length > 0
                ? loopAnimations[Math.floor(Math.random() * loopAnimations.length)]
                : availableAnimations[0];
              const returnAction = demonActions[returnAnim];
              if (returnAction) {
                returnAction.reset();
                returnAction.setLoop(THREE.LoopRepeat);
                returnAction.setEffectiveWeight(1);
                returnAction.play();
                nextAction.crossFadeTo(returnAction, 0.5, false);
                demonState.currentAnimation = returnAnim;
                demonState.isPlayingSpecial = false;
                demonState.nextSwitchDelay = Math.random() * 8000 + 6000;
                demonState.lastSwitchTime = Date.now();
              } else {
                demonState.isPlayingSpecial = false;
              }
            }, Math.max(100, animDuration - 500));
          }
        }

        demonState.currentAnimation = nextAnimation;

        if (loopAnimations.includes(nextAnimation)) {
          demonState.nextSwitchDelay = /idle/i.test(nextAnimation)
            ? Math.random() * 3000 + 4000
            : Math.random() * 10000 + 8000;
        } else {
          demonState.nextSwitchDelay = 999999;
        }

        demonState.lastSwitchTime = currentTime;
      }
    }

    // Handle Granny animation alternation — typing loop with periodic
    // one-shot fist pumps. Mirrors the Demon special-anim handoff shape but
    // simplified to two clips. Paused during focus so she doesn't pump mid
    // close-up.
    if (!grannyFocusedRef.current && actionsRef.current['Granny']) {
      const currentTime = Date.now();
      const grannyState = grannyAnimStateRef.current;

      if (grannyState.lastSwitchTime === 0) {
        grannyState.lastSwitchTime = currentTime;
      }

      if (
        !grannyState.isPlayingSpecial &&
        currentTime - grannyState.lastSwitchTime > grannyState.nextSwitchDelay
      ) {
        const grannyActions = actionsRef.current['Granny'];
        // Tolerate Blender's armature-prefixed names (e.g.
        // "Armature.001|granny_typing") by matching on substring.
        const typingKey = Object.keys(grannyActions).find(k => /granny.*typ/i.test(k));
        const fistPumpKey = Object.keys(grannyActions).find(k => /granny.*fist/i.test(k));
        const typing = typingKey && grannyActions[typingKey];
        const fistPump = fistPumpKey && grannyActions[fistPumpKey];

        if (typing && fistPump) {
          typing.fadeOut(0.4);
          fistPump.reset();
          fistPump.setLoop(THREE.LoopOnce, 1);
          fistPump.clampWhenFinished = true;
          fistPump.fadeIn(0.4);
          fistPump.play();

          grannyState.isPlayingSpecial = true;
          grannyState.currentAnimation = 'granny_fistPump';

          const animDuration = fistPump.getClip().duration * 1000;
          // Track the timeout ID so focus can cancel it — otherwise a
          // pending pump-return fires during focus and slams typing back in
          // over the idle we just faded to.
          grannyState.pumpReturnTimeoutId = setTimeout(() => {
            grannyState.pumpReturnTimeoutId = null;
            // Bail if focus engaged after we were scheduled — the focus
            // handler is already driving granny_idle.
            if (grannyFocusedRef.current) return;
            typing.stop();
            typing.reset();
            typing.setLoop(THREE.LoopRepeat);
            typing.setEffectiveWeight(1);
            typing.fadeIn(0.4);
            typing.play();
            fistPump.fadeOut(0.4);

            grannyState.currentAnimation = typingKey;
            grannyState.isPlayingSpecial = false;
            grannyState.nextSwitchDelay = Math.random() * 8000 + 8000;
            grannyState.lastSwitchTime = Date.now();
          }, Math.max(100, animDuration - 400));
        } else {
          // Either clip is missing — back off so we don't busy-loop.
          grannyState.nextSwitchDelay = 30000;
          grannyState.lastSwitchTime = currentTime;
        }
      }
    }

    // Handle RL80 animation alternation
    if (!isOnMobile && actionsRef.current['RL80']) {
      const currentTime = Date.now();
      const rl80State = rl80AnimStateRef.current;
      
      // Initialize lastSwitchTime if it's 0
      if (rl80State.lastSwitchTime === 0) {
        rl80State.lastSwitchTime = currentTime;
      }
      
      if (!rl80State.isPlayingSpecial && currentTime - rl80State.lastSwitchTime > rl80State.nextSwitchDelay) {
        const rl80Actions = actionsRef.current['RL80'];

        // Get available animations for RL80
        const availableAnimations = Object.keys(rl80Actions);

        // Filter animations based on what's actually available.
        // Original RL80 rig: Idle, Typing, Clap, Disbelief, FistPump.
        // Unicorn rig (V2): supports both Typing_Unicorn and Unicorn_Typing
        // naming styles. Match the keyword at the start or after an
        // underscore so all conventions resolve correctly.
        const isLoopAnim = (anim) => /(?:^|_)(typing|idle|clap)/i.test(anim);
        const isSpecialAnim = (anim) => /(?:^|_)(disbelief|fistpump)/i.test(anim);
        const loopAnimations = availableAnimations.filter(isLoopAnim);
        const specialAnimations = availableAnimations.filter(isSpecialAnim);

        // If we don't have any animations, skip
        if (availableAnimations.length === 0) {
          console.warn('[RL80] No animations available, skipping switch');
          return;
        }

        // Nothing to alternate to (e.g. unicorn rig only ships Typing_Unicorn).
        // Fading the same clip out and in causes a momentary T-pose between
        // weight=0 and the fade-in — bail before that happens.
        if (loopAnimations.length <= 1 && specialAnimations.length === 0) {
          rl80State.lastSwitchTime = currentTime;
          rl80State.nextSwitchDelay = 60000;
          return;
        }
        
        let nextAnimation;
        
        // If we're on a loop animation, pick next animation
        if (loopAnimations.includes(rl80State.currentAnimation)) {
          // Initialize recentAnimations if it doesn't exist
          if (!rl80State.recentAnimations) {
            rl80State.recentAnimations = [];
          }
          
          // 70% chance to stay with loop animations, 30% for special
          if (Math.random() < 0.7 && loopAnimations.length > 0) {
            // If we have multiple loop animations, switch between them
            if (loopAnimations.length > 1) {
              const otherLoops = loopAnimations.filter(anim => anim !== rl80State.currentAnimation);
              nextAnimation = otherLoops[0];
            } else {
              // Only one loop animation (Typing), keep using it
              nextAnimation = loopAnimations[0];
            }
          } else if (specialAnimations.length > 0) {
            // Pick a special animation
            let availableSpecials = specialAnimations.filter(anim => 
              !rl80State.recentAnimations.includes(anim)
            );
            
            if (availableSpecials.length === 0) {
              availableSpecials = specialAnimations;
              rl80State.recentAnimations = [];
            }
            
            nextAnimation = availableSpecials[Math.floor(Math.random() * availableSpecials.length)];
            rl80State.recentAnimations.push(nextAnimation);
            
            if (rl80State.recentAnimations.length > 1) {
              rl80State.recentAnimations.shift();
            }
          } else {
            // No special animations available, keep current or use first available
            nextAnimation = rl80State.currentAnimation;
          }
        } else {
          // Return from special animation to a loop animation
          nextAnimation = loopAnimations.length > 0 ? 
            loopAnimations[Math.floor(Math.random() * loopAnimations.length)] : 
            availableAnimations[0];
        }
        
        
        const prevAction = rl80Actions[rl80State.currentAnimation];
        const action = rl80Actions[nextAnimation];

        // Skip the swap entirely if we'd be transitioning to the same clip —
        // a fadeOut+fadeIn on one action drops weight to zero in between.
        if (prevAction && action === prevAction) {
          rl80State.currentAnimation = nextAnimation;
          rl80State.lastSwitchTime = currentTime;
          return;
        }

        // Play the next animation
        if (action) {
          const isSpecialAnimation = isSpecialAnim(nextAnimation);

          // Fade the outgoing clip — both branches do this.
          if (prevAction) prevAction.fadeOut(0.5);

          if (isSpecialAnimation) {
            action.reset();
            action.fadeIn(0.5);
          } else {
            // Loop → loop crossfade. Skip the first ~10% of the incoming clip
            // because Mixamo clips frequently start at near-bind-pose, which
            // would briefly leak through during the 0.5s blend.
            const clipDur = action.getClip().duration;
            action.reset();
            action.time = clipDur * 0.1;
            action.setLoop(THREE.LoopRepeat);
            action.fadeIn(0.5);
            action.play();
          }

          if (isSpecialAnimation) {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            action.play();

            // Calculate when to start transitioning back
            const animDuration = action.getClip().duration * 1000;
            const transitionStartTime = Math.max(100, animDuration - 500);

            // Start transition back to a loop animation — same crossFadeTo
            // approach so we don't pop into bind pose on the way back.
            setTimeout(() => {
              const availableLoops = Object.keys(rl80Actions).filter(isLoopAnim);
              const returnAnimation = availableLoops.length > 0
                ? availableLoops[Math.floor(Math.random() * availableLoops.length)]
                : Object.keys(rl80Actions)[0];
              const loopAction = rl80Actions[returnAnimation];
              if (loopAction) {
                action.fadeOut(0.5);
                const clipDur = loopAction.getClip().duration;
                loopAction.reset();
                loopAction.time = clipDur * 0.1;
                loopAction.setLoop(THREE.LoopRepeat);
                loopAction.fadeIn(0.5);
                loopAction.play();
              }

              rl80State.currentAnimation = returnAnimation;
              rl80State.nextSwitchDelay = Math.random() * 8000 + 12000;
              rl80State.lastSwitchTime = Date.now();
            }, transitionStartTime);
          }
        }
        
        rl80State.currentAnimation = nextAnimation;
        
        // Set appropriate delay based on animation type
        if (/(?:^|_)typing/i.test(nextAnimation)) {
          rl80State.nextSwitchDelay = Math.random() * 8000 + 12000; // 12-20 seconds for typing
        } else if (/(?:^|_)(idle|clap)/i.test(nextAnimation)) {
          // For other loop animations, set reasonable delays
          rl80State.nextSwitchDelay = Math.random() * 5000 + 5000; // 5-10 seconds
        } else {
          // For special animations (Disbelief, FistPump), wait for them to finish
          rl80State.nextSwitchDelay = 999999; // Large number to prevent switching during animation
        }
        
        rl80State.lastSwitchTime = currentTime;
      }
    }
    
    // Monk attention-getting wave (waving_over) — fires every 5–9s on a
    // one-shot, returns to the monk's regular loop. Stops once the user has
    // focused on the monk (game flow takes over from there). Held off until
    // the user clicks START in GameOverlay (gameStarted prop).
    if (gameStarted && actionsRef.current['Monk'] && !monkWaveStateRef.current.hasBeenFocused && !monkFocusedRef.current) {
      const monkActions = actionsRef.current['Monk'];
      // Attention-getter cycle: hail → idle (head still tracks camera) → hail
      // → idle → … → beckon (every 4–5 hails) → idle → repeat. Loops until
      // the user clicks the monk (hasBeenFocused).
      const hailKey = Object.keys(monkActions).find(a => /monk_hail/i.test(a));
      const beckonKey = Object.keys(monkActions).find(a => /monk_beckon/i.test(a));
      const idleKey = Object.keys(monkActions).find(a => /idle_monk/i.test(a));
      if (hailKey) {
        const wState = monkWaveStateRef.current;
        const now = Date.now();
        if (!wState.everInitialized) {
          // Initial delay before first sequence so the page settles in first.
          wState.nextFireTime = now + 3000;
          wState.everInitialized = true;
        }
        const monkState = monkAnimStateRef.current;
        if (now >= wState.nextFireTime && !monkState.isPlayingSpecial) {
          const hail = monkActions[hailKey];
          const prev = monkActions[monkState.currentAnimation];
          const isRetrigger = prev === hail;
          if (prev && !isRetrigger) prev.fadeOut(0.5);
          hail.reset();
          hail.setLoop(THREE.LoopOnce, 1);
          hail.clampWhenFinished = true;
          // On retrigger, skip fadeIn — it would drop weight to 0 momentarily
          // and (with no other action playing) the mixer would fall back to
          // bind pose, causing a T-pose flash between hail loops. Keep weight
          // at 1 by jumping straight to play.
          if (!isRetrigger) hail.fadeIn(0.5);
          else hail.setEffectiveWeight(1);
          hail.play();
          monkState.currentAnimation = hailKey;
          monkState.isPlayingSpecial = true;
          wState.attentionActive = true;
          wState.hailsUntilBeckon -= 1;
          const hailDurMs = hail.getClip().duration * 1000;

          // Helper: cross-fade into idle_monk for one playthrough, then
          // re-arm so the outer block retriggers hail on the next frame.
          // Falls back to immediate retrigger if idle_monk isn't available.
          const playIdleInterlude = (fromAction) => {
            if (monkWaveStateRef.current.hasBeenFocused) return;
            if (!idleKey) {
              monkState.isPlayingSpecial = false;
              monkWaveStateRef.current.nextFireTime = Date.now();
              return;
            }
            const idle = monkActions[idleKey];
            if (fromAction && fromAction !== idle) fromAction.fadeOut(0.5);
            idle.reset();
            idle.setLoop(THREE.LoopOnce, 1);
            idle.clampWhenFinished = true;
            idle.fadeIn(0.5);
            idle.play();
            monkState.currentAnimation = idleKey;
            const idleDurMs = idle.getClip().duration * 1000;
            setTimeout(() => {
              if (monkWaveStateRef.current.hasBeenFocused) return;
              monkState.isPlayingSpecial = false;
              monkWaveStateRef.current.nextFireTime = Date.now();
            }, Math.max(100, idleDurMs - 500));
          };

          // Step 2: just before hail ends, either cross-fade into monk_beckon
          // (every 4–5 hails) or play an idle interlude before the next hail.
          setTimeout(() => {
            if (monkWaveStateRef.current.hasBeenFocused) return;
            const wState2 = monkWaveStateRef.current;
            const shouldBeckon = beckonKey && wState2.hailsUntilBeckon <= 0;
            if (!shouldBeckon) {
              playIdleInterlude(hail);
              return;
            }
            // Reset the counter for the next beckon (4–5 hails away).
            wState2.hailsUntilBeckon = 4 + Math.floor(Math.random() * 2);
            const beckon = monkActions[beckonKey];
            hail.fadeOut(0.5);
            beckon.reset();
            beckon.setLoop(THREE.LoopOnce, 1);
            beckon.clampWhenFinished = true;
            beckon.fadeIn(0.5);
            beckon.play();
            monkState.currentAnimation = beckonKey;
            const beckonDurMs = beckon.getClip().duration * 1000;

            // Step 3: just before beckon ends, play an idle interlude before
            // the next hail cycle.
            setTimeout(() => {
              playIdleInterlude(beckon);
            }, Math.max(100, beckonDurMs - 500));
          }, Math.max(100, hailDurMs - 500));
        }
      }
    }

    // Handle Monk animation alternation — mostly typing/idle, occasional disbelief/fistpump
    if (!isOnMobile && actionsRef.current['Monk']) {
      const currentTime = Date.now();
      const monkState = monkAnimStateRef.current;

      if (monkState.lastSwitchTime === 0) {
        monkState.lastSwitchTime = currentTime;
      }

      if (!monkState.isPlayingSpecial && currentTime - monkState.lastSwitchTime > monkState.nextSwitchDelay) {
        const monkActions = actionsRef.current['Monk'];
        const availableAnimations = Object.keys(monkActions);

        // Monk animations use *_monk suffix — classify by name
        // Exclude disapproval from rotation for now
        const filteredAnimations = availableAnimations.filter(a =>
          !/disapproval/i.test(a));
        const loopAnimations = filteredAnimations.filter(a =>
          /typing|idle|laughing/i.test(a));
        const specialAnimations = filteredAnimations.filter(a =>
          /disbelief|clap|fistpump/i.test(a));

        if (availableAnimations.length === 0) return;

        let nextAnimation;

        if (loopAnimations.includes(monkState.currentAnimation)) {
          if (specialAnimations.length > 0 && Math.random() < 0.25) {
            nextAnimation = specialAnimations[Math.floor(Math.random() * specialAnimations.length)];
          } else if (loopAnimations.length > 1) {
            const others = loopAnimations.filter(a => a !== monkState.currentAnimation);
            nextAnimation = others[Math.floor(Math.random() * others.length)];
          } else {
            nextAnimation = loopAnimations[0];
          }
        } else {
          nextAnimation = loopAnimations.length > 0
            ? loopAnimations[Math.floor(Math.random() * loopAnimations.length)]
            : availableAnimations[0];
        }

        if (monkActions[monkState.currentAnimation]) {
          monkActions[monkState.currentAnimation].fadeOut(0.5);
        }

        if (monkActions[nextAnimation]) {
          const nextAction = monkActions[nextAnimation];
          nextAction.reset();
          nextAction.fadeIn(0.5);

          if (specialAnimations.includes(nextAnimation)) {
            nextAction.setLoop(THREE.LoopOnce, 1);
            nextAction.clampWhenFinished = true;
            monkState.isPlayingSpecial = true;

            const animDuration = nextAction.getClip().duration * 1000;
            setTimeout(() => {
              const returnAnim = loopAnimations.length > 0
                ? loopAnimations[Math.floor(Math.random() * loopAnimations.length)]
                : availableAnimations[0];
              if (monkActions[returnAnim]) {
                const returnAction = monkActions[returnAnim];
                returnAction.stop();
                returnAction.reset();
                returnAction.setLoop(THREE.LoopRepeat);
                returnAction.setEffectiveWeight(1);
                returnAction.fadeIn(0.5);
                returnAction.play();
                nextAction.fadeOut(0.5);
                monkState.currentAnimation = returnAnim;
                monkState.isPlayingSpecial = false;
                monkState.nextSwitchDelay = Math.random() * 10000 + 10000;
                monkState.lastSwitchTime = Date.now();
              } else {
                monkState.isPlayingSpecial = false;
              }
            }, Math.max(100, animDuration - 500));
          } else {
            nextAction.setLoop(THREE.LoopRepeat);
          }

          nextAction.play();
        }

        monkState.currentAnimation = nextAnimation;

        if (loopAnimations.includes(nextAnimation)) {
          monkState.nextSwitchDelay = /idle/i.test(nextAnimation)
            ? Math.random() * 3000 + 5000
            : Math.random() * 10000 + 12000;
        } else {
          monkState.nextSwitchDelay = 999999;
        }

        monkState.lastSwitchTime = currentTime;
      }
    }
    
    // Handle Tekno animation alternation
    if (!isOnMobile && actionsRef.current['Tekno']) {
      const currentTime = Date.now();
      const teknoState = teknoAnimStateRef.current;
      
      if (teknoState.lastSwitchTime === 0) {
        teknoState.lastSwitchTime = currentTime;
      }
      
      if (currentTime - teknoState.lastSwitchTime > teknoState.nextSwitchDelay) {
        const teknoActions = actionsRef.current['Tekno'];
        
        // Get available animations for Tekno
        const availableAnimations = Object.keys(teknoActions);
        
        // Filter animations based on what's actually available
        // Tekno has Idle, Typing, Clap, and Pray.001/Pray001 as loop animations
        const loopAnimations = availableAnimations.filter(anim => 
          anim === 'Typing' || anim === 'Idle' || anim === 'Clap');
        const specialAnimations = availableAnimations.filter(anim => 
          anim === 'Disbelief' || anim === '');
        
        // If we don't have any animations, skip
        if (availableAnimations.length === 0) {
          console.warn('[Tekno] No animations available, skipping switch');
          return;
        }
        
        let nextAnimation;
        
        if (loopAnimations.includes(teknoState.currentAnimation)) {
          if (Math.random() < 0.8) { // 80% chance for loop animations
            nextAnimation = teknoState.currentAnimation === 'Typing' ? 'Idle' : 'Typing';
          } else {
            nextAnimation = specialAnimations[Math.floor(Math.random() * specialAnimations.length)];
          }
        } else {
          nextAnimation = loopAnimations[Math.floor(Math.random() * loopAnimations.length)];
        }
        
        if (teknoActions[teknoState.currentAnimation]) {
          teknoActions[teknoState.currentAnimation].fadeOut(0.5);
        }
        
        if (teknoActions[nextAnimation]) {
          const action = teknoActions[nextAnimation];
          action.reset();
          action.fadeIn(0.5);
          
          if (specialAnimations.includes(nextAnimation)) {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            
            const animDuration = action.getClip().duration * 1000;
            setTimeout(() => {
              const returnAnim = loopAnimations[Math.floor(Math.random() * loopAnimations.length)];
              if (teknoActions[returnAnim]) {
                action.fadeOut(0.5);
                teknoActions[returnAnim].stop();
                teknoActions[returnAnim].reset();
                teknoActions[returnAnim].setLoop(THREE.LoopRepeat);
                teknoActions[returnAnim].setEffectiveWeight(1);
                teknoActions[returnAnim].play();
              }
              teknoState.currentAnimation = returnAnim;
              teknoState.nextSwitchDelay = Math.random() * 10000 + 20000;
              teknoState.lastSwitchTime = Date.now();
            }, Math.max(100, animDuration - 500));
          } else {
            action.setLoop(THREE.LoopRepeat);
          }
          
          action.play();
        }
        
        teknoState.currentAnimation = nextAnimation;
        
        if (loopAnimations.includes(nextAnimation)) {
          teknoState.nextSwitchDelay = Math.random() * 10000 + 20000; // 20-30 seconds
        } else {
          teknoState.nextSwitchDelay = 999999;
        }
        
        teknoState.lastSwitchTime = currentTime;
      }
    }
    
    // Blinking animation for RL80's eyes

    if (leftEyeRef.current && rightEyeRef.current) {
      const currentTime = state.clock.getElapsedTime() * 1000;
      const blinkState = blinkStateRef.current;

      // Store original positions if not already stored
      if (!leftEyeRef.current.userData.originalPosition) {
        leftEyeRef.current.userData.originalPosition = leftEyeRef.current.position.clone();
        leftEyeRef.current.userData.originalScale = leftEyeRef.current.scale.clone();
      }
      if (!rightEyeRef.current.userData.originalPosition) {
        rightEyeRef.current.userData.originalPosition = rightEyeRef.current.position.clone();
        rightEyeRef.current.userData.originalScale = rightEyeRef.current.scale.clone();
      }

      // Check if it's time to blink
      if (!blinkState.isBlinking && currentTime - blinkState.lastBlinkTime > blinkState.nextBlinkDelay) {
        blinkState.isBlinking = true;
        blinkState.blinkProgress = 0;
        blinkState.lastBlinkTime = currentTime;
        blinkState.nextBlinkDelay = Math.random() * 3000 + 2000;
      }

      // Animate the blink (close 100ms, hold 80ms, open 120ms)
      if (blinkState.isBlinking) {
        const closeTime = 100;
        const holdTime = 80;
        const openTime = 120;
        const totalDuration = closeTime + holdTime + openTime;
        const timeSinceBlinkStart = currentTime - blinkState.lastBlinkTime;

        if (timeSinceBlinkStart < totalDuration) {
          let progress;

          if (timeSinceBlinkStart < closeTime) {
            // Closing
            progress = timeSinceBlinkStart / closeTime;
          } else if (timeSinceBlinkStart < closeTime + holdTime) {
            // Holding closed
            progress = 1;
          } else {
            // Opening
            progress = 1 - ((timeSinceBlinkStart - closeTime - holdTime) / openTime);
          }

          const eyeScale = 1 - (progress * 0.95);

          leftEyeRef.current.scale.set(
            leftEyeRef.current.userData.originalScale.x,
            leftEyeRef.current.userData.originalScale.y * eyeScale,
            leftEyeRef.current.userData.originalScale.z
          );
          rightEyeRef.current.scale.set(
            rightEyeRef.current.userData.originalScale.x,
            rightEyeRef.current.userData.originalScale.y * eyeScale,
            rightEyeRef.current.userData.originalScale.z
          );

        } else {
          blinkState.isBlinking = false;
          leftEyeRef.current.scale.copy(leftEyeRef.current.userData.originalScale);
          rightEyeRef.current.scale.copy(rightEyeRef.current.userData.originalScale);
        }
      }
    }

    // Blinking animation for Demon's eyes (opacity-based for flat image plane)
    if (demonEyesRef.current && demonEyesRef.current.material) {
      const currentTime = state.clock.getElapsedTime() * 1000;
      const demonBlink = demonBlinkStateRef.current;
      const demonState = demonAnimStateRef.current;

      // Check if playing disbelief — keep eyes closed for the duration
      const isDisbelief = demonState.isPlayingSpecial &&
        /disbelief/i.test(demonState.currentAnimation);

      if (isDisbelief) {
        // Smoothly close eyes during disbelief
        const target = 0;
        const current = demonEyesRef.current.material.opacity;
        demonEyesRef.current.material.opacity = current + (target - current) * 0.15;
        // Skip normal blinking while in disbelief
      } else {
        // If returning from disbelief, smoothly reopen
        if (demonEyesRef.current.material.opacity < 0.95 && !demonBlink.isBlinking) {
          const current = demonEyesRef.current.material.opacity;
          demonEyesRef.current.material.opacity = current + (1 - current) * 0.1;
          if (demonEyesRef.current.material.opacity > 0.99) {
            demonEyesRef.current.material.opacity = 1;
          }
        }

        // Normal blinking
        // Check if it's time to blink
        if (!demonBlink.isBlinking && currentTime - demonBlink.lastBlinkTime > demonBlink.nextBlinkDelay) {
          demonBlink.isBlinking = true;
          demonBlink.lastBlinkTime = currentTime;
          demonBlink.nextBlinkDelay = Math.random() * 4000 + 3000;
        }

        // Animate the blink (fade out 100ms, hold 120ms, fade in 140ms)
        if (demonBlink.isBlinking) {
          const closeTime = 100;
          const holdTime = 120;
          const openTime = 140;
          const totalDuration = closeTime + holdTime + openTime;
          const timeSinceBlinkStart = currentTime - demonBlink.lastBlinkTime;

          if (timeSinceBlinkStart < totalDuration) {
            let opacity;

            if (timeSinceBlinkStart < closeTime) {
              opacity = 1 - (timeSinceBlinkStart / closeTime);
            } else if (timeSinceBlinkStart < closeTime + holdTime) {
              opacity = 0;
            } else {
              opacity = (timeSinceBlinkStart - closeTime - holdTime) / openTime;
            }

            demonEyesRef.current.material.opacity = opacity;
          } else {
            demonBlink.isBlinking = false;
            demonEyesRef.current.material.opacity = 1;
          }
        }
      }
    }

    // Granny eye blink (mesh-swap: Eyes ↔ Closedeyes).
    if (grannyEyesRef.current) {
      const currentTime = state.clock.getElapsedTime() * 1000;
      const blink = grannyBlinkStateRef.current;
      const closed = grannyClosedEyesRef.current;

      if (!blink.isBlinking && currentTime - blink.lastBlinkTime > blink.nextBlinkDelay) {
        blink.isBlinking = true;
        blink.lastBlinkTime = currentTime;
        blink.nextBlinkDelay = Math.random() * 4000 + 3000;
        grannyEyesRef.current.visible = false;
        if (closed) closed.visible = true;
      } else if (blink.isBlinking) {
        const blinkDuration = 150;
        if (currentTime - blink.lastBlinkTime > blinkDuration) {
          blink.isBlinking = false;
          grannyEyesRef.current.visible = true;
          if (closed) closed.visible = false;
        }
      }
    }

    // Unicorn eye blink (opacity-based, synchronized across L_EYE + R_EYE)
    if (unicornEyesRef.current.length > 0) {
      const currentTime = state.clock.getElapsedTime() * 1000;
      const blink = unicornBlinkStateRef.current;

      if (!blink.isBlinking && currentTime - blink.lastBlinkTime > blink.nextBlinkDelay) {
        blink.isBlinking = true;
        blink.lastBlinkTime = currentTime;
        blink.nextBlinkDelay = Math.random() * 4000 + 3000;
      }

      if (blink.isBlinking) {
        const closeTime = 100;
        const holdTime = 120;
        const openTime = 140;
        const totalDuration = closeTime + holdTime + openTime;
        const t = currentTime - blink.lastBlinkTime;

        let opacity;
        if (t < totalDuration) {
          if (t < closeTime) {
            opacity = 1 - (t / closeTime);
          } else if (t < closeTime + holdTime) {
            opacity = 0;
          } else {
            opacity = (t - closeTime - holdTime) / openTime;
          }
        } else {
          blink.isBlinking = false;
          opacity = 1;
        }

        for (const eye of unicornEyesRef.current) {
          if (eye.material) eye.material.opacity = opacity;
        }
      }
    }

    // Demon head look-at-camera override (only when focused on Demon)
    if (demonFocusedRef.current && demonHeadBoneRef.current) {
      const head = demonHeadBoneRef.current;

      // Capture the animation's base head rotation once (avoids loop seam flick)
      if (!demonHeadBoneRef._baseQuat) {
        demonHeadBoneRef._baseQuat = head.quaternion.clone();
        // Also capture the world quaternion of the head in rest pose for reference
        head.updateWorldMatrix(true, false);
        demonHeadBoneRef._baseWorldQuat = new THREE.Quaternion();
        head.getWorldQuaternion(demonHeadBoneRef._baseWorldQuat);
      }

      // Get head world position
      head.updateWorldMatrix(true, false);
      const headWorldPos = new THREE.Vector3();
      head.getWorldPosition(headWorldPos);

      // Compute desired world quaternion: face the camera
      // Use a dummy to do lookAt in world space
      if (!demonHeadBoneRef._dummy) {
        demonHeadBoneRef._dummy = new THREE.Object3D();
      }
      const dummy = demonHeadBoneRef._dummy;
      dummy.position.copy(headWorldPos);
      // Aim slightly above the camera so the demon's gaze lands on the
      // viewer's face rather than below it. Increase to look higher.
      const demonGazeTarget = camera.position.clone();
      demonGazeTarget.y += 0.8;
      dummy.lookAt(demonGazeTarget);
      // lookAt aligns -Z with target. The face likely points a different direction.
      // Apply 180° Y correction so face (+Z) points at camera instead of back of head
      // Correction angle: adjust to make head face camera (tune this value)
      // 0 = looks left, PI = looks right, PI/2 = should be straight at camera
      // Base flip (-Math.PI / 1.8) was empirically tuned to combine with
      // the 80% base-blend below. During pointing the spine yaws, which
      // pulls the head's world rotation along with it; the boost rotates
      // the lookAt target to compensate so the gaze stays on camera.
      const pointingFlipBoost = demonArmAimingRef.current ? Math.PI / 9 + Math.PI / 36 + Math.PI / 36 : 0;
      const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 1.8 + pointingFlipBoost);
      dummy.quaternion.multiply(flip);

      // Clamp the angle between base pose and lookAt to prevent unnatural rotation
      const maxHeadAngle = 1.2; // radians, ~70 degrees
      const angleBetween = demonHeadBoneRef._baseWorldQuat.angleTo(dummy.quaternion);
      const clampedBlend = angleBetween > 0 ? Math.min(maxHeadAngle / angleBetween, 0.8) : 0;
      const blendedWorldQuat = demonHeadBoneRef._baseWorldQuat.clone().slerp(dummy.quaternion, clampedBlend);

      // Convert blended world quaternion to bone-local space
      const parentWorldQuat = new THREE.Quaternion();
      head.parent.getWorldQuaternion(parentWorldQuat);
      const targetQuat = parentWorldQuat.clone().invert().multiply(blendedWorldQuat);

      // Smooth transition
      if (!demonHeadBoneRef._smoothedQuat) {
        demonHeadBoneRef._smoothedQuat = head.quaternion.clone();
      }
      demonHeadBoneRef._smoothedQuat.slerp(targetQuat, 0.08);

      head.quaternion.copy(demonHeadBoneRef._smoothedQuat);
    } else if (demonHeadBoneRef._smoothedQuat) {
      demonHeadBoneRef._smoothedQuat = null;
      demonHeadBoneRef._baseQuat = null;
      demonHeadBoneRef._baseWorldQuat = null;
      demonHeadBoneRef._dummy = null;
    }

    // Demon spine point-at-camera override — runs only during the
    // demon_pointing phase of the focus sequence. Mirrors Blender's
    // "rotate spine on Y" workflow: we override only the spine's local
    // Y (yaw) component each frame to face the viewer horizontally,
    // preserving any pitch/lean the animation provides.
    //
    // RIG_FORWARD_OFFSET_RAD compensates for the rig's authored forward
    // direction. The spine's bone-local +Z usually doesn't line up with
    // the chest-forward axis exactly; this offset rotates the target yaw
    // to put the chest on the camera. Tune to taste — common values:
    //   ±Math.PI / 6   (~30° off)
    //   ±Math.PI / 2   (90° off — rig exported "side-facing")
    //   Math.PI        (back-to-camera)
    // If the character turns the wrong way, flip the sign.
    const RIG_FORWARD_OFFSET_RAD = -Math.PI / 3 - Math.PI / 18;
    if (demonArmAimingRef.current && demonPointingArmBoneRef.current) {
      const spine = demonPointingArmBoneRef.current;

      spine.updateWorldMatrix(true, false);
      const spineWorldPos = new THREE.Vector3();
      spine.getWorldPosition(spineWorldPos);

      // Direction from spine to camera, projected to the horizontal plane.
      const toCamera = new THREE.Vector3().subVectors(camera.position, spineWorldPos);
      toCamera.y = 0;

      // Express that direction in the spine's PARENT local frame so the
      // yaw value is something we can drop straight into the spine's
      // local Euler.y.
      const parentWorldQuat = new THREE.Quaternion();
      spine.parent.getWorldQuaternion(parentWorldQuat);
      const toCameraInParent = toCamera.clone().applyQuaternion(parentWorldQuat.clone().invert());
      toCameraInParent.y = 0;
      if (toCameraInParent.lengthSq() > 1e-6) {
        toCameraInParent.normalize();
        const targetYaw = Math.atan2(toCameraInParent.x, toCameraInParent.z) + RIG_FORWARD_OFFSET_RAD;

        // Decompose the animation's current spine local quat into Euler
        // (YXZ so yaw is the first applied rotation), override yaw, and
        // recompose. Pitch (X) and roll (Z) from the animation survive.
        const animEuler = new THREE.Euler().setFromQuaternion(spine.quaternion, 'YXZ');
        animEuler.y = targetYaw;
        const targetLocal = new THREE.Quaternion().setFromEuler(animEuler);

        if (!demonPointingArmBoneRef._smoothedQuat) {
          demonPointingArmBoneRef._smoothedQuat = spine.quaternion.clone();
        }
        // Slow slerp so the torso turn reads as deliberate.
        demonPointingArmBoneRef._smoothedQuat.slerp(targetLocal, 0.08);
        spine.quaternion.copy(demonPointingArmBoneRef._smoothedQuat);
      }
    } else if (demonPointingArmBoneRef._smoothedQuat) {
      demonPointingArmBoneRef._smoothedQuat = null;
      demonPointingArmBoneRef._dummy = null;
    }

    // Monk head look-at-camera override — active when focused on the Monk
    // OR while the attention-getter cycle is running, so the monk appears
    // to address the user across hail → idle → hail → beckon transitions.
    const monkIsPointing = monkWaveStateRef.current.attentionActive;
    if ((monkFocusedRef.current || monkIsPointing) && monkHeadBoneRef.current) {
      const head = monkHeadBoneRef.current;

      if (!monkHeadBoneRef._baseQuat) {
        monkHeadBoneRef._baseQuat = head.quaternion.clone();
        head.updateWorldMatrix(true, false);
        monkHeadBoneRef._baseWorldQuat = new THREE.Quaternion();
        head.getWorldQuaternion(monkHeadBoneRef._baseWorldQuat);
      }

      head.updateWorldMatrix(true, false);
      const headWorldPos = new THREE.Vector3();
      head.getWorldPosition(headWorldPos);

      if (!monkHeadBoneRef._dummy) {
        monkHeadBoneRef._dummy = new THREE.Object3D();
      }
      const dummy = monkHeadBoneRef._dummy;
      dummy.position.copy(headWorldPos);
      dummy.lookAt(camera.position);
      // Correction rotation — tuned for Monk skeleton orientation
      const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 0.5);
      dummy.quaternion.multiply(flip);

      // ~110° max turn so the monk can track the camera further around to
      // the right (was 1.2 rad ≈ 69°).
      const maxHeadAngle = 1.92;
      const angleBetween = monkHeadBoneRef._baseWorldQuat.angleTo(dummy.quaternion);
      const clampedBlend = angleBetween > 0 ? Math.min(maxHeadAngle / angleBetween, 0.9) : 0;
      const blendedWorldQuat = monkHeadBoneRef._baseWorldQuat.clone().slerp(dummy.quaternion, clampedBlend);

      const parentWorldQuat = new THREE.Quaternion();
      head.parent.getWorldQuaternion(parentWorldQuat);
      const targetQuat = parentWorldQuat.clone().invert().multiply(blendedWorldQuat);

      if (!monkHeadBoneRef._smoothedQuat) {
        monkHeadBoneRef._smoothedQuat = head.quaternion.clone();
      }
      monkHeadBoneRef._smoothedQuat.slerp(targetQuat, 0.08);

      head.quaternion.copy(monkHeadBoneRef._smoothedQuat);
    } else if (monkHeadBoneRef._smoothedQuat && monkHeadBoneRef.current) {
      // Symmetric release — slerp the smoothedQuat toward whatever the
      // animation wants right now at the same 0.08-per-frame rate the
      // engagement used, so the head rotates back as naturally as it
      // engaged instead of snapping. head.quaternion at this point is the
      // animation's intended pose since the mixer has already run.
      const head = monkHeadBoneRef.current;
      const animQuat = head.quaternion.clone();
      monkHeadBoneRef._smoothedQuat.slerp(animQuat, 0.08);
      head.quaternion.copy(monkHeadBoneRef._smoothedQuat);
      // Once close enough to the anim pose, stop overriding.
      if (monkHeadBoneRef._smoothedQuat.angleTo(animQuat) < 0.01) {
        monkHeadBoneRef._smoothedQuat = null;
        monkHeadBoneRef._baseQuat = null;
        monkHeadBoneRef._baseWorldQuat = null;
        monkHeadBoneRef._dummy = null;
      }
    }

    // RL80 head look-at-camera override (only when focused on RL80)
    if (rl80FocusedRef.current && rl80HeadBoneRef.current) {
      const head = rl80HeadBoneRef.current;

      if (!rl80HeadBoneRef._baseQuat) {
        rl80HeadBoneRef._baseQuat = head.quaternion.clone();
        head.updateWorldMatrix(true, false);
        rl80HeadBoneRef._baseWorldQuat = new THREE.Quaternion();
        head.getWorldQuaternion(rl80HeadBoneRef._baseWorldQuat);
      }

      head.updateWorldMatrix(true, false);
      const headWorldPos = new THREE.Vector3();
      head.getWorldPosition(headWorldPos);

      if (!rl80HeadBoneRef._dummy) {
        rl80HeadBoneRef._dummy = new THREE.Object3D();
      }
      const dummy = rl80HeadBoneRef._dummy;
      dummy.position.copy(headWorldPos);
      dummy.lookAt(camera.position);
      // Same skeleton as Monk — start with same correction, tune if needed
      const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 0.5);
      dummy.quaternion.multiply(flip);

      const maxHeadAngle = 1.2;
      const angleBetween = rl80HeadBoneRef._baseWorldQuat.angleTo(dummy.quaternion);
      const clampedBlend = angleBetween > 0 ? Math.min(maxHeadAngle / angleBetween, 0.8) : 0;
      const blendedWorldQuat = rl80HeadBoneRef._baseWorldQuat.clone().slerp(dummy.quaternion, clampedBlend);

      const parentWorldQuat = new THREE.Quaternion();
      head.parent.getWorldQuaternion(parentWorldQuat);
      const targetQuat = parentWorldQuat.clone().invert().multiply(blendedWorldQuat);

      if (!rl80HeadBoneRef._smoothedQuat) {
        rl80HeadBoneRef._smoothedQuat = head.quaternion.clone();
      }
      rl80HeadBoneRef._smoothedQuat.slerp(targetQuat, 0.08);

      head.quaternion.copy(rl80HeadBoneRef._smoothedQuat);
    } else if (rl80HeadBoneRef._smoothedQuat) {
      rl80HeadBoneRef._smoothedQuat = null;
      rl80HeadBoneRef._baseQuat = null;
      rl80HeadBoneRef._baseWorldQuat = null;
      rl80HeadBoneRef._dummy = null;
    }

    // Granny head look-at-camera override — mirrors the RL80 setup.
    // The flip-axis correction below is rig-specific; if Granny ends up
    // looking the wrong way, tune the angle (try Math.PI, -Math.PI / 1.8,
    // or Math.PI / 0.5).
    if (grannyFocusedRef.current && grannyHeadBoneRef.current) {
      const head = grannyHeadBoneRef.current;

      if (!grannyHeadBoneRef._baseQuat) {
        grannyHeadBoneRef._baseQuat = head.quaternion.clone();
        head.updateWorldMatrix(true, false);
        grannyHeadBoneRef._baseWorldQuat = new THREE.Quaternion();
        head.getWorldQuaternion(grannyHeadBoneRef._baseWorldQuat);
      }

      head.updateWorldMatrix(true, false);
      const headWorldPos = new THREE.Vector3();
      head.getWorldPosition(headWorldPos);

      if (!grannyHeadBoneRef._dummy) {
        grannyHeadBoneRef._dummy = new THREE.Object3D();
      }
      const dummy = grannyHeadBoneRef._dummy;
      dummy.position.copy(headWorldPos);
      dummy.lookAt(camera.position);
      const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 0.5);
      dummy.quaternion.multiply(flip);

      const maxHeadAngle = 1.2; // ~70° clamp
      const angleBetween = grannyHeadBoneRef._baseWorldQuat.angleTo(dummy.quaternion);
      const clampedBlend = angleBetween > 0 ? Math.min(maxHeadAngle / angleBetween, 0.8) : 0;
      const blendedWorldQuat = grannyHeadBoneRef._baseWorldQuat.clone().slerp(dummy.quaternion, clampedBlend);

      const parentWorldQuat = new THREE.Quaternion();
      head.parent.getWorldQuaternion(parentWorldQuat);
      const targetQuat = parentWorldQuat.clone().invert().multiply(blendedWorldQuat);

      if (!grannyHeadBoneRef._smoothedQuat) {
        grannyHeadBoneRef._smoothedQuat = head.quaternion.clone();
      }
      grannyHeadBoneRef._smoothedQuat.slerp(targetQuat, 0.08);

      head.quaternion.copy(grannyHeadBoneRef._smoothedQuat);
    } else if (grannyHeadBoneRef._smoothedQuat) {
      grannyHeadBoneRef._smoothedQuat = null;
      grannyHeadBoneRef._baseQuat = null;
      grannyHeadBoneRef._baseWorldQuat = null;
      grannyHeadBoneRef._dummy = null;
    }

    // Fluffy (cat) head look-at-camera override
    // Animation is paused, so we use world-space lookAt with no loop-seam concerns
    if (fluffyFocusedRef.current && fluffyHeadBoneRef.current) {
      const head = fluffyHeadBoneRef.current;

      // Capture the base local quaternion once
      if (!fluffyHeadBoneRef._baseQuat) {
        fluffyHeadBoneRef._baseQuat = head.quaternion.clone();
      }

      // Restore base quat before computing world matrices to avoid feedback loop
      head.quaternion.copy(fluffyHeadBoneRef._baseQuat);
      head.updateWorldMatrix(true, false);

      const headWorldPos = new THREE.Vector3();
      head.getWorldPosition(headWorldPos);
      const baseWorldQuat = new THREE.Quaternion();
      head.getWorldQuaternion(baseWorldQuat);

      // Compute desired world quaternion facing camera
      if (!fluffyHeadBoneRef._dummy) {
        fluffyHeadBoneRef._dummy = new THREE.Object3D();
      }
      const dummy = fluffyHeadBoneRef._dummy;
      dummy.position.copy(headWorldPos);
      dummy.lookAt(camera.position);
      // Cat face forward correction — X-axis rotation to tilt from "up" to "forward"
      const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2.5);
      dummy.quaternion.multiply(flip);

      // Clamp rotation range
      const maxHeadAngle = 2.0;
      const angleBetween = baseWorldQuat.angleTo(dummy.quaternion);
      const clampedBlend = angleBetween > 0 ? Math.min(maxHeadAngle / angleBetween, 0.95) : 0;
      const blendedWorldQuat = baseWorldQuat.clone().slerp(dummy.quaternion, clampedBlend);

      // Convert to bone-local space
      const parentWorldQuat = new THREE.Quaternion();
      head.parent.getWorldQuaternion(parentWorldQuat);
      const targetQuat = parentWorldQuat.clone().invert().multiply(blendedWorldQuat);

      // Smooth transition
      if (!fluffyHeadBoneRef._smoothedQuat) {
        fluffyHeadBoneRef._smoothedQuat = targetQuat.clone();
      }
      fluffyHeadBoneRef._smoothedQuat.slerp(targetQuat, 0.1);

      head.quaternion.copy(fluffyHeadBoneRef._smoothedQuat);
    } else if (fluffyHeadBoneRef._smoothedQuat) {
      fluffyHeadBoneRef._smoothedQuat = null;
      fluffyHeadBoneRef._baseQuat = null;
      fluffyHeadBoneRef._dummy = null;
    }

    // Camera focus animation
    if (focusTarget) {
      // Lerp camera FOV toward focusTarget.fov when set — used on mobile so
      // the subject reads smaller in portrait without moving the camera
      // through the center console.
      if (typeof focusTarget.fov === 'number' && Math.abs(camera.fov - focusTarget.fov) > 0.05) {
        camera.fov += (focusTarget.fov - camera.fov) * 0.08;
        camera.updateProjectionMatrix();
      }

      // For XCandle focus: lerp to position then release control to OrbitControls
      if (focusTarget.agentId === 'XCandle') {
        if (!focusTarget._arrived) {
          camera.position.lerp(focusTarget.position, 0.08);
          camera.lookAt(focusTarget.lookAt);
          const dist = camera.position.distanceTo(focusTarget.position);
          if (dist < 0.1) {
            focusTarget._arrived = true;
            // Update OrbitControls target so it orbits around the candle, not the origin
            if (state.controls && state.controls.target) {
              state.controls.target.copy(focusTarget.lookAt);
              state.controls.update();
            }
          }
        }
        // Once _arrived is set, do nothing — OrbitControls take over
      } else if (focusTarget.agentName === 'Reset') {
        // Reset: smoothly return camera, keep forcing lookAt
        camera.position.lerp(focusTarget.position, 0.05);
        camera.lookAt(focusTarget.lookAt);
        if (state.controls && state.controls.target) {
          state.controls.target.lerp(focusTarget.lookAt, 0.05);
        }
      } else {
        // Character/screen focus: lerp to position, then hand off to OrbitControls
        if (!focusTarget._arrived) {
          camera.position.lerp(focusTarget.position, 0.05);
          camera.lookAt(focusTarget.lookAt);

          const dist = camera.position.distanceTo(focusTarget.position);
          if (dist < 0.1) {
            focusTarget._arrived = true;
            // Initial orbit target = fly-in lookAt so there's no snap when
            // OrbitControls takes over (its update() calls camera.lookAt on
            // its target, which would otherwise jump the view).
            if (state.controls && state.controls.target) {
              state.controls.target.copy(focusTarget.lookAt);
              state.controls.update();
            }
            // If no explicit orbitCenter was provided, derive one from the
            // focused character's head bone so OrbitControls revolves around
            // the actual character once it takes over.
            if (!focusTarget.orbitCenter) {
              const headBoneByAgent = {
                RL80: rl80HeadBoneRef,
                Demon: demonHeadBoneRef,
                Monk: monkHeadBoneRef,
                Fluffy: fluffyHeadBoneRef,
                Granny: grannyHeadBoneRef,
              };
              const boneRef = headBoneByAgent[focusTarget.agentId];
              if (boneRef && boneRef.current) {
                const pivot = new THREE.Vector3();
                boneRef.current.getWorldPosition(pivot);
                // Drop pivot toward chest height so orbit feels balanced
                // around the body rather than spinning around the head.
                pivot.y -= 0.25;
                focusTarget.orbitCenter = pivot;
              }
            }
            // Fire one-shot Unicorn_waving 2s after the camera settles in
            // front of him. The wave clip is additive (see clip-loading
            // section), so it layers on top of the running idle/typing
            // action without replacing it — the body stays seated while the
            // arm waves. Idle is NOT faded out here.
            if (focusTarget.agentId === 'RL80' && unicornWaveStateRef.current.armed) {
              unicornWaveStateRef.current.armed = false;
              unicornWaveStateRef.current.timeoutId = setTimeout(() => {
                unicornWaveStateRef.current.timeoutId = null;
                if (!rl80FocusedRef.current) return;
                const rl80Actions = actionsRef.current['RL80'];
                if (!rl80Actions) return;
                const waveKey = Object.keys(rl80Actions).find(a => /wav/i.test(a));
                if (!waveKey) return;
                const wave = rl80Actions[waveKey];
                // Slow the wave playback a bit (0.75× = ~33% longer reads
                // more deliberate). Schedule timing uses the *played*
                // duration, not the intrinsic clip duration.
                const timeScale = 0.75;
                const clipDurMs = wave.getClip().duration * 1000;
                const playedDurMs = clipDurMs / timeScale;
                const fadeInMs = Math.min(200, clipDurMs * 0.25);
                const fadeOutMs = 500; // longer hang on the way out
                const fadeInS = fadeInMs / 1000;
                const fadeOutS = fadeOutMs / 1000;

                // Regular blending. Idle stays at weight 1 controlling the
                // body; wave runs at a high base weight so it dominates the
                // arm bones (idle wins on body bones since the wave clip has
                // no tracks for them). The mixer's effective weight is
                // base_weight × fade_interpolant — by setting base = 10 and
                // using the standard fadeIn (interpolant 0→1) / fadeOut
                // (interpolant 1→0), effective weight smoothly ramps 0→10
                // and 10→0 without snapping.
                wave.reset();
                wave.setLoop(THREE.LoopOnce, 1);
                wave.clampWhenFinished = true;
                wave.setEffectiveTimeScale(timeScale);
                wave.setEffectiveWeight(10);
                wave.fadeIn(fadeInS);
                wave.play();

                unicornWaveStateRef.current.timeoutId = setTimeout(() => {
                  unicornWaveStateRef.current.timeoutId = null;
                  if (!rl80FocusedRef.current) return;
                  wave.fadeOut(fadeOutS);
                }, Math.max(50, playedDurMs - fadeOutMs));
              }, 2000);
            }
          }
        } else if (!focusTarget._orbitSettled && focusTarget.orbitCenter) {
          // After arrival, smoothly slide the orbit pivot from the fly-in
          // lookAt to the explicit orbitCenter (e.g. Demon's chest). Done as
          // a lerp so the camera doesn't snap and the user can start dragging
          // immediately — their input just orbits a slowly-moving pivot for
          // ~0.5s until it settles.
          if (state.controls && state.controls.target) {
            state.controls.target.lerp(focusTarget.orbitCenter, 0.08);
            state.controls.update();
            if (state.controls.target.distanceTo(focusTarget.orbitCenter) < 0.02) {
              state.controls.target.copy(focusTarget.orbitCenter);
              state.controls.update();
              focusTarget._orbitSettled = true;
            }
          }
        }
        // Once arrived AND orbit settled, OrbitControls fully owns the view
      }
    }
    
    // Y-axis billboard: rotate Angel_Empty so its forward axis always points
    // at the camera horizontally (keeps the angel upright; coins/children
    // ride along since they're descendants of Angel_Empty).
    if (angelEmptyRef.current) {
      const angelEmpty = angelEmptyRef.current;
      const angelWorldPos = new THREE.Vector3();
      angelEmpty.getWorldPosition(angelWorldPos);

      // Project camera onto the angel's horizontal plane so only the Y axis rotates.
      const targetWorld = new THREE.Vector3(camera.position.x, angelWorldPos.y, camera.position.z);

      // Compute the desired world quaternion via a dummy lookAt, then convert
      // to local space so it composes correctly with parent transforms.
      if (!angelEmpty.userData._billboardDummy) {
        angelEmpty.userData._billboardDummy = new THREE.Object3D();
      }
      const dummy = angelEmpty.userData._billboardDummy;
      dummy.position.copy(angelWorldPos);
      dummy.lookAt(targetWorld);
      // Correction: model's forward axis isn't -Z. Rotate around world up so
      // the front of the angel faces the camera. Flip the sign if it ends up
      // showing the back instead.
      const billboardYOffset = Math.PI / 2;
      dummy.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), billboardYOffset)
      );

      const parentWorldQuat = new THREE.Quaternion();
      if (angelEmpty.parent) {
        angelEmpty.parent.getWorldQuaternion(parentWorldQuat);
        angelEmpty.quaternion.copy(parentWorldQuat.invert().multiply(dummy.quaternion));
      } else {
        angelEmpty.quaternion.copy(dummy.quaternion);
      }
    }

    // Add subtle animations for mobile objects
    if (isOnMobile) {
      // Angel_Empty hover animation - subtle up and down motion for the entire group
      if (angelEmptyRef.current) {
        const time = state.clock.getElapsedTime();
        // Store original Y position if not already stored
        if (angelEmptyRef.current.userData.originalY === undefined) {
          angelEmptyRef.current.userData.originalY = angelEmptyRef.current.position.y;
        }
        // Apply hover animation relative to original position
        angelEmptyRef.current.position.y = angelEmptyRef.current.userData.originalY + Math.sin(time * 0.8) * 0.01; // Gentle hover with 0.05 units amplitude
      }
      

    }

    // Pin character hint markers above each agent's head bone (world space)
    // if (showCharacterHints) {
    //   const hintPairs = [
    //     [rl80HeadBoneRef.current, rl80HintRef.current],
    //     [demonHeadBoneRef.current, demonHintRef.current],
    //     [monkHeadBoneRef.current, monkHintRef.current],
    //     [fluffyHeadBoneRef.current, fluffyHintRef.current],
    //   ];
    //   for (const [bone, marker] of hintPairs) {
    //     if (bone && marker) {
    //       bone.getWorldPosition(marker.position);
    //       marker.position.y += 0.18;
    //     }
    //   }
    // }
  });

  // Always return the group that contains the model
  return (
    <>
      <group ref={groupRef} visible={true} position={position} scale={scale} rotation={rotation}>
        {/* The 3D model is added dynamically in useEffect */}
        {(() => {
          const cfg = isOnMobile ? HOLO_STATUE_MOBILE : HOLO_STATUE_DESKTOP;
          return (
            <>
              {/* <HolographicStatue3
                position={cfg.position}
                scale={cfg.scale}
                rotation={cfg.rotation}
                hover={false}
                rotate={true}
              /> */}
              <primitive
                object={angelSpotTarget}
                position={[cfg.position[0], cfg.position[1] + 15, cfg.position[2]]}
              />
                                                                     
  <SpotLight                                                                                                                                                
    position={[-0.05, 1.52, 0]}                          
    target={angelSpotTarget}
    angle={0.35}
    castShadow                                                                                                                                              
    intensity={1}
    penumbra={0.1}                                                                                                                                          
    color={'#0bcd2e'}                                    
    distance={15}
    opacity={0.2}
    // attenuation={12}                                                                                                                                        
    // anglePower={8}
  />              
            </>
          );
        })()}
      </group>
      {showCharacterHints && [
        { id: 'RL80', ref: rl80HintRef },
        { id: 'Demon', ref: demonHintRef },
        { id: 'Monk', ref: monkHintRef },
        { id: 'Fluffy', ref: fluffyHintRef },
        { id: 'Granny', ref: grannyHintRef },
      ].map(({ id, ref }) => (
        <group key={id} ref={ref} position={[0, 9999, 0]}>
          <Html center occlude zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
            <button
              onPointerDown={(e) => { e.stopPropagation(); onAgentClick && onAgentClick(id); }}
              aria-label={`Tap to meet ${id}`}
              style={{
                background: 'transparent',
                border: 'none',
                position: 'relative',
                top: '-1rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                cursor: 'pointer',
                pointerEvents: 'auto',
                fontSize: '2rem',
                lineHeight: 1,
                filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.85)) drop-shadow(0 0 6px rgba(0, 0, 0, 0.6))',
                animation: 'characterHintIconPulse 2.4s ease-in-out infinite',
              }}
            >
              <span role="img" aria-hidden="true">💬</span>
            </button>
          </Html>
        </group>
      ))}
    </>
  );
};

CyborgTempleScene.displayName = 'CyborgTempleScene';

export default CyborgTempleScene;