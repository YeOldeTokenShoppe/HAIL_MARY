import { useEffect, useRef, useState, useMemo } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import AnnotationSystem from "@/components/AnnotationSystem";
import { db, collection, query, orderBy, limit, getDocs } from '@/lib/firebaseClient';

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
  onSwapCoinsReady = null, // Callback that receives a function to trigger coin swap
  onCoinFaceTap = null, // Callback when a CoinFace is tapped in agents mode (coinIndex)
  templeCandles = [], // Array of claimed candle objects from Firestore templeCandles collection
  disableCandleInteraction = false, // When true, XCandle nodes are not made clickable (no zoom-to-candle, no inspector)
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
  const coin1Ref = useRef();
  const coin2Ref = useRef();
  const coin3Ref = useRef();
  const coin4Ref = useRef();
  const coinSpokeRef = useRef(); // Parent group of all coins — rotate this for carousel

  // Camera focus state
  const [focusTarget, setFocusTarget] = useState(null);
  const ourLadyRef = useRef(); // Reference to RL80 (OurLady) mesh
  const originalCameraPosition = useRef(null); // Store original camera position
  
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
  
  // Refs for CoinFace avatar meshes (desktop RL80_4anims.glb)
  const coinFaceRefs = useRef([null, null, null, null]) // CoinFace1-4
  const coinFaceTexturesRef = useRef([null, null, null, null])
  const coinBackTexturesRef = useRef([null, null, null, null]) // Character textures for flip back
  const coinAgentNameTexturesRef = useRef([null, null, null, null]) // Agent name textures for flip back
  const coinColoredBackTexturesRef = useRef([null, null, null, null]) // Colored back textures for flip
  const coinFaceFlipState = useRef({
    CoinFace1: { isFlipped: false, currentRotation: 0, targetRotation: 0, originalScale: null, lastFlipTime: 0 },
    CoinFace2: { isFlipped: false, currentRotation: 0, targetRotation: 0, originalScale: null, lastFlipTime: 0 },
    CoinFace3: { isFlipped: false, currentRotation: 0, targetRotation: 0, originalScale: null, lastFlipTime: 0 },
    CoinFace4: { isFlipped: false, currentRotation: 0, targetRotation: 0, originalScale: null, lastFlipTime: 0 },
  })
  // Carousel animation state for angel-triggered swap
  const carouselState = useRef({
    isAnimating: false,
    currentAngle: 0,
    targetAngle: 0,
    showingCharacters: true,
    textureSwapped: false,
    initialPositions: [], // Store each CoinFace's starting position
    lastTriggerTime: 0,
    // Per-coin staggered angles for elastic effect (coin 4 leads, coin 1 last)
    coinAngles: [0, 0, 0, 0],
    coinStartAngles: [0, 0, 0, 0],
  })
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
  const monkHeadBoneRef = useRef();
  const monkFocusedRef = useRef(false); // true when camera is zoomed in on Monk
  const rl80HeadBoneRef = useRef();
  const rl80FocusedRef = useRef(false); // true when camera is zoomed in on RL80
  const fluffyHeadBoneRef = useRef();
  const fluffyFocusedRef = useRef(false); // true when camera is zoomed in on Fluffy

  // Demon eye mesh ref and blink state
  const demonEyesRef = useRef();
  const demonBlinkStateRef = useRef({
    lastBlinkTime: 0,
    nextBlinkDelay: Math.random() * 4000 + 3000, // Random delay between 3-7 seconds
    isBlinking: false,
    blinkProgress: 0
  });
  
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

        // If we have a previous price and new price is higher → buy detected
        if (prevPrice !== null && currentPrice > prevPrice) {
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

  // Expose coin swap trigger to parent via callback
  useEffect(() => {
    if (onSwapCoinsReady) {
      onSwapCoinsReady(() => {
        const cs = carouselState.current
        const now = Date.now()
        if (!cs.isAnimating && now - cs.lastTriggerTime > 600) {
          cs.isAnimating = true
          cs.targetAngle = cs.currentAngle + Math.PI * 2
          cs.textureSwapped = false
          cs.lastTriggerTime = now
          cs.coinStartAngles = [...cs.coinAngles]
        }
      })
    }
  }, [onSwapCoinsReady])

  // Create a circular coin-back texture with username + @handle
  const createNameBackTexture = (username, handle) => {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    // Circular clip mask
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()

    // Flip canvas so text reads correctly with flipY=false
    ctx.translate(size / 2, size / 2)
    ctx.scale(-1, -1)
    ctx.translate(-size / 2, -size / 2)

    // Dark radial gradient background
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, '#1a1a2e')
    gradient.addColorStop(1, '#0a0a1a')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)

    // Gold ring border
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.7)'
    ctx.lineWidth = 6
    ctx.stroke()

    // Username (bold white)
    const nameText = username || 'anon'
    ctx.fillStyle = '#e7e9ea'
    ctx.font = `bold 42px -apple-system, BlinkMacSystemFont, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(nameText, size / 2, handle ? size / 2 - 20 : size / 2)

    // @handle (muted gold)
    if (handle) {
      ctx.fillStyle = 'rgba(255, 215, 0, 0.7)'
      ctx.font = `32px -apple-system, BlinkMacSystemFont, sans-serif`
      ctx.fillText(`@${handle}`, size / 2, size / 2 + 24)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.flipY = false
    texture.colorSpace = THREE.SRGBColorSpace
    texture.center.set(0.5, 0.5)
    texture.rotation = -40 * (Math.PI / 180)
    texture.needsUpdate = true

    return texture
  }

  // Create colored back textures for coin flip — one per coin with distinct colors
  const createCoinColoredBacks = () => {
    const colors = [
      { inner: '#2a0a3a', outer: '#0a0a1a', ring: 'rgba(180, 100, 255, 0.8)' },  // Purple
      { inner: '#0a2a3a', outer: '#0a0a1a', ring: 'rgba(100, 200, 255, 0.8)' },  // Cyan
      { inner: '#3a2a0a', outer: '#0a0a1a', ring: 'rgba(255, 180, 50, 0.8)' },   // Gold
      { inner: '#0a3a1a', outer: '#0a0a1a', ring: 'rgba(100, 255, 150, 0.8)' },  // Green
    ]
    colors.forEach((color, i) => {
      const size = 512
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')

      // Circular clip
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()

      // Flip canvas so it reads correctly with flipY=false
      ctx.translate(size / 2, size / 2)
      ctx.scale(-1, -1)
      ctx.translate(-size / 2, -size / 2)

      // Radial gradient background
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
      gradient.addColorStop(0, color.inner)
      gradient.addColorStop(1, color.outer)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, size, size)

      // Decorative ring
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2)
      ctx.strokeStyle = color.ring
      ctx.lineWidth = 4
      ctx.stroke()

      // Inner ring
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, size / 3, 0, Math.PI * 2)
      ctx.strokeStyle = color.ring
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.4
      ctx.stroke()
      ctx.globalAlpha = 1.0

      // Center cross/star pattern
      ctx.strokeStyle = color.ring
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.3
      for (let a = 0; a < 8; a++) {
        const angle = (a / 8) * Math.PI * 2
        ctx.beginPath()
        ctx.moveTo(size / 2, size / 2)
        ctx.lineTo(size / 2 + Math.cos(angle) * size / 3, size / 2 + Math.sin(angle) * size / 3)
        ctx.stroke()
      }
      ctx.globalAlpha = 1.0

      const texture = new THREE.CanvasTexture(canvas)
      texture.flipY = false
      texture.colorSpace = THREE.SRGBColorSpace
      texture.center.set(0.5, 0.5)
      texture.rotation = -40 * (Math.PI / 180)
      texture.needsUpdate = true
      coinColoredBackTexturesRef.current[i] = texture
    })
  }

  // Create a back-face mesh for a CoinFace (shown when flipped on mobile)
  // Character thumbnail paths for coin back-faces (index 0-2 = agents, index 3 = follower list)
  const coinBackImages = ['/rl80_thumbnail.png', '/gr80_thumbnail.png', '/h80z_thumbnail.png']
  const coinAgentNames = [
    { username: 'Our Lady', handle: null },
    { username: 'St. GR80', handle: null },
    { username: 'H80Z', handle: null },
    { username: 'TBD', handle: null },
  ]

  // Load character textures for coin back-faces on mobile
  const loadCoinBackTextures = () => {
    const size = 512

    coinBackImages.forEach((src, i) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')

        // Circular clip mask
        ctx.beginPath()
        ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2)
        ctx.closePath()
        ctx.clip()

        // Draw the thumbnail image to fill the circle
        const imgAspect = img.width / img.height
        let drawW, drawH, drawX, drawY
        if (imgAspect > 1) {
          drawH = size
          drawW = size * imgAspect
          drawX = (size - drawW) / 2
          drawY = 0
        } else {
          drawW = size
          drawH = size / imgAspect
          drawX = 0
          drawY = (size - drawH) / 2
        }
        ctx.drawImage(img, drawX, drawY, drawW, drawH)

        // Gold ring border
        ctx.beginPath()
        ctx.arc(size/2, size/2, size/2 - 3, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.7)'
        ctx.lineWidth = 6
        ctx.stroke()

        const texture = new THREE.CanvasTexture(canvas)
        texture.flipY = false
        texture.colorSpace = THREE.SRGBColorSpace
        texture.center.set(0.5, 0.5)
        texture.rotation = -40 * (Math.PI / 180)
        texture.needsUpdate = true
        coinBackTexturesRef.current[i] = texture

        // If starting in agents mode, apply this texture to the coin now that it's loaded
        if (carouselState.current.showingCharacters) {
          const mesh = coinFaceRefs.current[i]
          if (mesh) {
            mesh.material.map = texture
            mesh.material.needsUpdate = true
          }
        }
      }
      img.src = src
    })

    // Coin 4 — placeholder
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2)
    gradient.addColorStop(0, '#1a1a2e')
    gradient.addColorStop(1, '#0a0a1a')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(size/2, size/2, size/2 - 3, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('MORE', size/2, size/2 - 14)
    ctx.font = '22px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillStyle = 'rgba(255, 215, 0, 0.8)'
    ctx.fillText('SUPPORTERS', size/2, size/2 + 18)

    const texture = new THREE.CanvasTexture(canvas)
    texture.flipY = false
    texture.colorSpace = THREE.SRGBColorSpace
    texture.center.set(0.5, 0.5)
    texture.rotation = -40 * (Math.PI / 180)
    texture.needsUpdate = true
    coinBackTexturesRef.current[3] = texture

    // Generate agent name textures for coin flip backs
    coinAgentNames.forEach((agent, i) => {
      coinAgentNameTexturesRef.current[i] = createNameBackTexture(agent.username, agent.handle)
    })
  }

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
  const annotations = [
    {
      text: "RL80 - A virtuous and autonomous AI agent serving her followers and token holders.",
      attachTo: object7MeshRef, // Attach to Object_7 mesh
      offset: [0, 1.9, 0], // Position slightly above the object center
      textOffset: [0, 0.2, -0.5], // Position text panel above and back
      customCamera: {
        position: [2, -0.8, -0.5], // Camera moved right and lower
        lookAt: [0, -0.5, 0], // Look outward toward the characters
        distance: 1.5 // Slightly increased distance for better framing
      }
    },
    // {
    //   position: [2, 0, -2], // Right side
    //   text: "Digital Offering Station\nPlace virtual candles here"
    // },

 {
      text: "RL80 Holder Neural Network - live display of holders online right now.",
      attachTo: cylinderMeshRef, // Attach to the cylinder mesh
      offset: [0, 0.5, 0], // Position at cylinder center
      textOffset: [0, 0.2, -1], // Position text panel 1.5 units up and 1 unit back
      customCamera: {
        position: [-2, -0.7, 3.3], // Camera moved right and lower
        lookAt: [1, -0.7, -0.1], // Look outward toward the characters
        distance: 1.2 // Slightly increased distance for better framing
      }
    },
    {
      text: "The 3 Wise Mechs - RL80's council: Demon, Monk, and Tekno.",
      attachTo: cube010MeshRef, // Attach to Cube010 mesh
      offset: [-1.8, 1.1, 0.5], // Position above the cube center
      textOffset: [0.1, 0, -0.4], // Position text panel above and back
      customCamera: {
        position: [0.2, -1.3, -0.3], // Camera moved right and lower
        lookAt: [-2.7, -1, 0.3], // Look outward toward the characters
        distance: 2.5 // Slightly increased distance for better framing
      }
    },
  ];
  

  useEffect(() => {
    if (hasLoadedRef.current) return;
    
    // Small delay to ensure the ref is attached after first render
    const timer = setTimeout(() => {
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

    // Using the same desktop model on both mobile and desktop until a trimmed
    // mobile scene is ready.
    let modelPath = "/models/RL80_4anims_v2.glb";
    const fallbackModelPath = "/models/RL80_4anims_v2.glb";
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
      anchorGroup.position.set(0, 0, 0);
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
        else if (child.name === 'Demon_empty') {
          animatedCharacters['Demon'] = child;
          // Find head bone in Demon skeleton for look-at-camera
          child.traverse((bone) => {
            if (bone.isBone && /head/i.test(bone.name)) {
              demonHeadBoneRef.current = bone;
            }
          });
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

          // Demon animations (Pelvis-based skeleton)
          if (firstTrackBone === 'Pelvis') {
            targetCharacters = ['Demon'];
          }
          // Monk animations (Root_2-based skeleton or *_monk named)
          else if (firstTrackBone === 'Root_2' || animName.endsWith('_monk')) {
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
              const cleanedAnimation = cleanAnimationTracks(animation, cleanRoot);
              
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
            if (charActions['Root.001|Typing']) {
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
          }
          
          if (defaultAnimName && charActions[defaultAnimName]) {
            defaultAnim = charActions[defaultAnimName];
            
            // Add some timing variation for visual interest
            if (charName === 'Monk' || charName === 'Tekno' || charName === 'Demon' || charName === 'Fluffy') {
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
            }
          } else {
            console.error(`[Play] ERROR: Could not find a default animation for ${charName}`);
          }
        });
        
        // Restore original console.warn after animation setup
        console.warn = originalWarn;
      }
      
      // Create grid ground
      const gridHelper = new THREE.GridHelper(50, 50, 0x00ff41, 0x00ff41);
      gridHelper.material.opacity = 0.3;
      gridHelper.material.transparent = true;
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
            child.name === 'Monk_empty' || child.name === 'SK_Chr_Monk_01' ||
            child.name === 'Tekno' || child.name === 'Tekno_Empty' ||
            child.name === 'Fluffy_Empty') {

          // Normalize agentId to consistent names
          let agentId = child.name;
          if (child.name === 'Demon' || child.name === 'Demon_empty') agentId = 'Demon';
          else if (child.name === 'Monk_empty' || child.name === 'SK_Chr_Monk_01') agentId = 'Monk';
          else if (child.name === 'Tekno' || child.name === 'Tekno_Empty') agentId = 'Tekno';
          else if (child.name === 'Fluffy_Empty') agentId = 'Fluffy';

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
        
        // Make the four screens clickable
        if (child.name === 'Screen1' || child.name === 'Screen2' || child.name === 'Screen3' || child.name === 'Screen4') {
          
          const setScreenClickableData = (obj) => {
            obj.userData.clickable = true;
            obj.userData.agentId = child.name;
            obj.userData.agentName = child.name;
            obj.userData.targetObject = child; // Store reference to the actual object
            
            // Also apply to all children if it's a group
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

        // Find angel and coin objects for MOBILE.glb animations
        if (isOnMobile) {
          if (child.name === 'Angel_Empty') {
            angelEmptyRef.current = child;
          }
          if (child.name === 'angel' || child.name === 'Angel') {
            angelRef.current = child;
          }
          
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

        // Make Angel and CoinFace meshes clickable for zoom
        if (child.name === 'Angel' || child.name === 'angel' || child.name === 'Angel_Empty') {
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

      // Store local start positions for all coin meshes (needed for staggered carousel orbit around Z-axis)
      const coinMeshRefs = [coin1Ref, coin2Ref, coin3Ref, coin4Ref]
      coinFaceRefs.current.forEach((mesh, i) => {
        if (!mesh) return
        mesh.userData.localStartX = mesh.position.x
        mesh.userData.localStartY = mesh.position.y
      })
      coinMeshRefs.forEach((ref, i) => {
        if (!ref.current) return
        ref.current.userData.localStartX = ref.current.position.x
        ref.current.userData.localStartY = ref.current.position.y
      })

      // On mobile, load character textures, hide Coin meshes, and set up flip animation
      if (isOnMobile) {
        loadCoinBackTextures()
        createCoinColoredBacks()
        // Hide the Coin meshes behind CoinFaces
        coinMeshRefs.forEach(ref => {
          if (ref.current) ref.current.visible = false
        })
        coinFaceRefs.current.forEach((mesh, i) => {
          if (!mesh) return
          // Make the material double-sided so the back is visible when flipped
          mesh.material.side = THREE.DoubleSide
          // Store original scale for the scale pulse during flip
          const flipState = coinFaceFlipState.current[`CoinFace${i + 1}`]
          if (flipState) {
            flipState.originalScale = mesh.scale.clone()
          }
          const worldPos = new THREE.Vector3()
          mesh.getWorldPosition(worldPos)
          carouselState.current.initialPositions[i] = worldPos.clone()
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
      
      // Retry logic with full URL fallback and desktop model fallback for mobile
      if (retryCount < maxRetries) {
        retryCount++;
        const useFullUrl = retryCount >= 2; // Try full URL on second retry
        
        // On last retry for mobile, try the desktop model as fallback
        if (retryCount === maxRetries && isOnMobile && !usingFallback) {
          console.warn(`[CyborgTempleScene] Mobile model failed, attempting fallback to desktop model...`);
          modelPath = fallbackModelPath;
          usingFallback = true;
          retryCount = maxRetries - 1; // Give one more chance with desktop model
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
      if (!demonActions) return;
      const demonState = demonAnimStateRef.current;
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
      const rl80Actions = actionsRef.current['RL80'];
      if (!rl80Actions) return;
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

    // Helper: restore all characters from focus
    const restoreAllFromFocus = () => {
      restoreDemonFromFocus();
      restoreMonkFromFocus();
      restoreRL80FromFocus();
      restoreFluffyFromFocus();
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
            lookAt: new THREE.Vector3(0, 0, 0),
            agentId: null,
            agentName: 'Reset'
          };
          setFocusTarget(resetTarget);
          
          setTimeout(() => {
            setFocusTarget(null);
            // Clear the stored position after reset
            originalCameraPosition.current = null;
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
            onCoinFaceTap(coinIndex, carouselState.current.showingCharacters);
          }
          break;
        }

        // Handle Angel touch on mobile — trigger carousel animation
        if (isOnMobile && object.userData.clickable && object.userData.agentId === 'Angel' && !object.name?.startsWith('CoinFace')) {
          touchedSomething = true;
          if (event.cancelable) {
            event.preventDefault();
          }
          const cs = carouselState.current;
          const now = Date.now();
          if (!cs.isAnimating && now - cs.lastTriggerTime > 600) {
            cs.isAnimating = true;
            cs.targetAngle = cs.currentAngle + Math.PI * 2;
            cs.textureSwapped = false;
            cs.lastTriggerTime = now;
            cs.coinStartAngles = [...cs.coinAngles];
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

          // On mobile (MOBILE2.glb), CoinFace flips and Angel does nothing
          if (isOnMobile) {
            // CoinFace click — fire callback to show related info
            if (object.name && object.name.startsWith('CoinFace')) {
              if (onCoinFaceTap) {
                const coinIndex = parseInt(object.name.replace('CoinFace', '')) - 1;
                onCoinFaceTap(coinIndex, carouselState.current.showingCharacters);
              }
              break;
            }

            // Angel click — trigger carousel animation
            if (object.userData.agentId === 'Angel' && !object.name?.startsWith('CoinFace')) {
              const cs = carouselState.current
              const now = Date.now()
              if (!cs.isAnimating && now - cs.lastTriggerTime > 600) {
                cs.isAnimating = true
                cs.targetAngle = cs.currentAngle + Math.PI * 2
                cs.textureSwapped = false
                cs.lastTriggerTime = now
                cs.coinStartAngles = [...cs.coinAngles]
              }
              break;
            }
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
              // First click — zoom camera to candle
              if (!focusTarget) {
                originalCameraPosition.current = camera.position.clone();
              }
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
                lookAt: new THREE.Vector3(0, 0, 0),
                agentId: null,
                agentName: 'Reset'
              });
              setTimeout(() => {
                setFocusTarget(null);
                originalCameraPosition.current = null;
              }, 1000);
            } else {
              setFocusTarget(null);
            }
            break;
          }

          // Store the current camera position BEFORE any animation
          // But only if we're not already focused on something
          if (!focusTarget) {
            originalCameraPosition.current = camera.position.clone();
          }

          // Get the target object's world position
          const targetObject = object.userData.targetObject || object;
          const objectWorldPos = new THREE.Vector3();
          targetObject.getWorldPosition(objectWorldPos);
          
          const agentSettings = {
            'RL80': { 
              // RL80 at (1.704, -1.652, 1.476)
              // Camera should be closer to center (opposite side)
              cameraPos: new THREE.Vector3(1, -0.4, 0.7),  // Positioned toward center, looking outward
              lookAtPos: new THREE.Vector3(1.804, -0.7, 2)  // Look at upper body
            },
            'Demon': {
              // Demon at (-1.554, -1.719, -1.351)
              // Camera positioned on opposite side (toward center)
              cameraPos: new THREE.Vector3(-0.9, -0.5, -0.7),  // Positioned toward center, looking outward
              lookAtPos: new THREE.Vector3(-1.3, -0.6,  -1.351)  // Look at upper body
            },
            'Monk': {
              // Monk at (-1.315, -1.672, 1.636)
              // Camera positioned on opposite side (toward center)
              cameraPos: new THREE.Vector3(-0.5, -0.5, 1.3),  // Positioned toward center, looking outward
              lookAtPos: new THREE.Vector3(-1.515, -0.7, 1.636)  // Look at upper body
            },
            'Tekno': { 
              // Tekno at (1.512, -1.625, -1.575)
              // Camera positioned on opposite side (toward center)
              cameraPos: new THREE.Vector3(0.7, -0.3, -1.3),  // Positioned toward center, looking outward
              lookAtPos: new THREE.Vector3(0.9, -0.4,  -1.351)  // Look at upper body
            },
            // Screen positions from console:
            // Screen1: (-0.632, 0.593, -0.682)
            // Screen2: (-0.766, 0.593, 0.975)
            // Screen3: (0.995, 0.614, -1.027)
            // Screen4: (0.770, 0.614, 0.552)
            
            'Fluffy': {
              // Fluffy - opposite side of Monk
              cameraPos: new THREE.Vector3(0.55, -0.6, -1.65),
              lookAtPos: new THREE.Vector3(1.615, -0.7, -1.736)
            },
            'Angel': {
              // Angel at top of scene, above the screens
              cameraPos: new THREE.Vector3(0, 1.8, 1.2),
              lookAtPos: new THREE.Vector3(0, 1.9, 0)
            },
            'Screen1': {
              // Screen1 at (-0.632, 0.593, -0.682)
              // Position camera in front of screen
              cameraPos: new THREE.Vector3(-1.932, 0.563, -1.9),  // Move camera forward (positive Z)
              lookAtPos: new THREE.Vector3(0.732, 0.693, 0.482)  // Look at screen center
            },
            'Screen2': {
              // Screen2 at (-0.766, 0.593, 0.975)
              // Position camera in front of screen
              cameraPos: new THREE.Vector3(-1.866, 0.393, 2.2),  // Move camera forward (positive Z)
              lookAtPos: new THREE.Vector3(-0.766, 0.593, 0.975)  // Look at screen center
            },
            'Screen3': {
              // Screen3 at (0.995, 0.614, -1.027)
              // Position camera in front of screen
              cameraPos: new THREE.Vector3(1.9, 0.564, -2.3),  // Move camera forward (positive Z)
              lookAtPos: new THREE.Vector3(1.4, 0.614, -1.7)  // Look at screen center
            },
            'Screen4': {
              // Screen4 at (0.770, 0.614, 0.552)
              // Position camera in front of screen
              cameraPos: new THREE.Vector3(1.90, 0.314, 1.6),  // Move camera forward (positive Z)
              lookAtPos: new THREE.Vector3(0.470, 0.714, .352)  // Look at screen center
            },
          };
          
          const settings = agentSettings[object.userData.agentId];
          
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
            // Use absolute positions for known agents
            setFocusTarget({
              position: settings.cameraPos.clone(),
              lookAt: settings.lookAtPos.clone(),
              agentId: object.userData.agentId,
              agentName: object.userData.agentName
            });
          }
          
          // When focusing on a character, switch to idle animation and enable head tracking
          if (object.userData.agentId === 'Demon') {
            demonFocusedRef.current = true;
            const demonActions = actionsRef.current['Demon'];
            if (demonActions) {
              const idleKey = Object.keys(demonActions).find(a => /sit_idle_demon/i.test(a));
              if (idleKey) {
                const demonState = demonAnimStateRef.current;
                if (demonActions[demonState.currentAnimation]) {
                  demonActions[demonState.currentAnimation].fadeOut(0.5);
                }
                const idleAction = demonActions[idleKey];
                idleAction.reset();
                idleAction.setLoop(THREE.LoopRepeat);
                idleAction.setEffectiveWeight(1);
                idleAction.fadeIn(0.5);
                idleAction.play();
                demonState.currentAnimation = idleKey;
                demonState.isPlayingSpecial = true;
                demonState.nextSwitchDelay = 999999;
                demonState.lastSwitchTime = Date.now();
              } else {
                console.warn('[Demon] sit_idle_demon animation not found. Available:', Object.keys(demonActions));
              }
            }
          } else if (object.userData.agentId === 'Monk') {
            monkFocusedRef.current = true;
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
          } else if (object.userData.agentId === 'Fluffy') {
            fluffyFocusedRef.current = true;
            // Pause the animation so the cat sits still — eliminates loop seam glitch
            const fluffyActions = actionsRef.current['Fluffy'];
            if (fluffyActions) {
              Object.values(fluffyActions).forEach(action => {
                action.paused = true;
              });
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
            lookAt: new THREE.Vector3(0, 0, 0),
            agentId: null,
            agentName: 'Reset'
          });
          setTimeout(() => {
            setFocusTarget(null);
            originalCameraPosition.current = null;
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

          // Handle CoinFace touch on mobile — fire callback
          if (isOnMobile && object.name && object.name.startsWith('CoinFace')) {
            touchedSomething = true;
            event.preventDefault();
            if (onCoinFaceTap) {
              const coinIndex = parseInt(object.name.replace('CoinFace', '')) - 1;
              onCoinFaceTap(coinIndex, carouselState.current.showingCharacters);
            }
            break;
          }

          // Handle Angel touch on mobile — trigger carousel animation
          if (isOnMobile && object.userData.clickable && object.userData.agentId === 'Angel' && !object.name?.startsWith('CoinFace')) {
            touchedSomething = true;
            event.preventDefault();
            const cs = carouselState.current;
            const now = Date.now();
            if (!cs.isAnimating && now - cs.lastTriggerTime > 600) {
              cs.isAnimating = true;
              cs.targetAngle = cs.currentAngle + Math.PI * 2;
              cs.textureSwapped = false;
              cs.lastTriggerTime = now;
              cs.coinStartAngles = [...cs.coinAngles];
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
          lookAt: new THREE.Vector3(0, 0, 0),
          agentId: null,
          agentName: 'Reset'
        });
        setTimeout(() => {
          setFocusTarget(null);
          originalCameraPosition.current = null;
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

        // Demon animations use Root.001|* prefix — classify by suffix
        const loopAnimations = availableAnimations.filter(a =>
          /typing|idle|laughing/i.test(a));
        const specialAnimations = availableAnimations.filter(a =>
          /fistpump|disbelief|clap/i.test(a));

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

        if (demonActions[demonState.currentAnimation]) {
          demonActions[demonState.currentAnimation].fadeOut(0.5);
        }

        if (demonActions[nextAnimation]) {
          const nextAction = demonActions[nextAnimation];
          nextAction.reset();
          nextAction.fadeIn(0.5);

          if (specialAnimations.includes(nextAnimation)) {
            nextAction.setLoop(THREE.LoopOnce, 1);
            nextAction.clampWhenFinished = true;
            demonState.isPlayingSpecial = true;

            const animDuration = nextAction.getClip().duration * 1000;
            setTimeout(() => {
              const returnAnim = loopAnimations.length > 0
                ? loopAnimations[Math.floor(Math.random() * loopAnimations.length)]
                : availableAnimations[0];
              if (demonActions[returnAnim]) {
                const returnAction = demonActions[returnAnim];
                returnAction.stop();
                returnAction.reset();
                returnAction.setLoop(THREE.LoopRepeat);
                returnAction.setEffectiveWeight(1);
                returnAction.fadeIn(0.5);
                returnAction.play();
                nextAction.fadeOut(0.5);
                demonState.currentAnimation = returnAnim;
                demonState.isPlayingSpecial = false;
                demonState.nextSwitchDelay = Math.random() * 8000 + 6000;
                demonState.lastSwitchTime = Date.now();
              } else {
                demonState.isPlayingSpecial = false;
              }
            }, Math.max(100, animDuration - 500));
          } else {
            nextAction.setLoop(THREE.LoopRepeat);
          }

          nextAction.play();
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
      dummy.lookAt(camera.position);
      // lookAt aligns -Z with target. The face likely points a different direction.
      // Apply 180° Y correction so face (+Z) points at camera instead of back of head
      // Correction angle: adjust to make head face camera (tune this value)
      // 0 = looks left, PI = looks right, PI/2 = should be straight at camera
      const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 1.8);
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

    // Monk head look-at-camera override (only when focused on Monk)
    if (monkFocusedRef.current && monkHeadBoneRef.current) {
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

      const maxHeadAngle = 1.2;
      const angleBetween = monkHeadBoneRef._baseWorldQuat.angleTo(dummy.quaternion);
      const clampedBlend = angleBetween > 0 ? Math.min(maxHeadAngle / angleBetween, 0.8) : 0;
      const blendedWorldQuat = monkHeadBoneRef._baseWorldQuat.clone().slerp(dummy.quaternion, clampedBlend);

      const parentWorldQuat = new THREE.Quaternion();
      head.parent.getWorldQuaternion(parentWorldQuat);
      const targetQuat = parentWorldQuat.clone().invert().multiply(blendedWorldQuat);

      if (!monkHeadBoneRef._smoothedQuat) {
        monkHeadBoneRef._smoothedQuat = head.quaternion.clone();
      }
      monkHeadBoneRef._smoothedQuat.slerp(targetQuat, 0.08);

      head.quaternion.copy(monkHeadBoneRef._smoothedQuat);
    } else if (monkHeadBoneRef._smoothedQuat) {
      monkHeadBoneRef._smoothedQuat = null;
      monkHeadBoneRef._baseQuat = null;
      monkHeadBoneRef._baseWorldQuat = null;
      monkHeadBoneRef._dummy = null;
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
            // Set orbit target once, then OrbitControls owns it
            if (state.controls && state.controls.target) {
              state.controls.target.copy(focusTarget.lookAt);
              state.controls.update();
            }
          }
        }
        // Once _arrived, do nothing — OrbitControls take over
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
      
      // Coin animations - subtle individual hovering
      const time = state.clock.getElapsedTime();
      
      // Helper function for individual coin hovering with click effects
      const hoverCoin = (coinRef, coinName, phaseOffset, speed = 1.2, amplitude = 0.01) => {
        if (!coinRef.current) return;
        
        const animState = coinAnimationState.current[coinName];
        
        // Store initial Y position if not set
        if (coinRef.current.userData.initialY === undefined) {
          coinRef.current.userData.initialY = coinRef.current.position.y;
        }
        
        // Calculate base hover
        let yOffset = Math.sin(time * speed + phaseOffset) * amplitude;
        
        // Add flutter animation if coin was clicked
        if (animState && animState.isAnimating) {
          const elapsed = (Date.now() - animState.startTime) / 1000; // Convert to seconds
          const flutterDecay = Math.exp(-elapsed * 2); // Slower decay over time
          
          // Remove the vertical bounce - just keep the base hover
          // yOffset is already set from the base hover calculation above
          
          // Add rotation tilt on Y-axis - back and forth a couple times
          if (coinRef.current.rotation) {
            // Use a moderate speed for a nice spin effect
            const tiltSpeed = 6; // Speed of the rotation oscillation
            const tiltAmount = 0.6; // About 34 degrees max tilt - more pronounced
            // Sin wave creates smooth back and forth motion that decays
            coinRef.current.rotation.y = Math.sin(elapsed * tiltSpeed) * tiltAmount * flutterDecay;
            
            // Optional: Add a slight continuous spin as well
            // coinRef.current.rotation.y += elapsed * 2 * flutterDecay; // Continuous spin overlay
          }
          
          // Add glow effect by modifying emissive
          coinRef.current.traverse((child) => {
            if (child.isMesh && child.material) {
              if (!child.material.userData.originalEmissive) {
                child.material.userData.originalEmissive = child.material.emissive ? 
                  child.material.emissive.clone() : new THREE.Color(0x000000);
                child.material.userData.originalIntensity = child.material.emissiveIntensity || 0;
              }
              
              // Pulse the emissive glow
              const glowIntensity = 5 * flutterDecay * (0.5 + 0.5 * Math.sin(elapsed * 10));
              const colors = {
                'Coin1': 0x00ff00, // Green
                'Coin2': 0x00ffff, // Cyan
                'Coin3': 0xff00ff, // Magenta
                'Coin4': 0xffdd00  // Gold
              };
              
              if (child.material.emissive) {
                child.material.emissive = new THREE.Color(colors[coinName] || 0xffdd00);
              }
              child.material.emissiveIntensity = child.material.userData.originalIntensity + glowIntensity;
            }
          });
        } else {
          // Reset rotation when not animating
          if (coinRef.current.rotation) {
            coinRef.current.rotation.y *= 0.95; // Smooth return to zero on Y-axis
          }
          
          // Reset emissive if not hovering
          if (!hoveredCoin || hoveredCoin !== coinName) {
            coinRef.current.traverse((child) => {
              if (child.isMesh && child.material && child.material.userData.originalEmissive) {
                child.material.emissive = child.material.userData.originalEmissive;
                child.material.emissiveIntensity = child.material.userData.originalIntensity;
              }
            });
          }
        }
        
        // Apply position with special handling for Group coins
        if (coinRef.current.name === 'Coin3' && coinRef.current.type === 'Group') {
          // Use much smaller amplitude for the Group
          coinRef.current.position.y = coinRef.current.userData.initialY + yOffset * 0.1;
        } else {
          // Normal handling for Mesh coins
          coinRef.current.position.y = coinRef.current.userData.initialY + yOffset;
        }
      };
      
      // Skip coin hover animations on mobile — Coin meshes are hidden, CoinFaces handle display

      // === Carousel animation (angel tap) — staggered elastic orbit around CoinSpoke Z-axis ===
      const cs = carouselState.current
      if (cs.isAnimating && coinSpokeRef.current) {
        // Staggered lerp speeds — coin 0 reacts fastest, coin 3 trails behind
        const lerpSpeeds = [0.07, 0.055, 0.04, 0.03]
        const coinMeshRefs = [coin1Ref, coin2Ref, coin3Ref, coin4Ref]
        let allDone = true

        for (let i = 0; i < 4; i++) {
          const diff = cs.targetAngle - cs.coinAngles[i]
          if (Math.abs(diff) > 0.005) {
            allDone = false
            cs.coinAngles[i] += diff * lerpSpeeds[i]
          } else {
            cs.coinAngles[i] = cs.targetAngle
          }

          // Orbit the angle difference from the start angle
          const angleDelta = cs.coinAngles[i] - cs.coinStartAngles[i]

          // Reposition CoinFace mesh by orbiting its start position around Z-axis (XY plane)
          const cfMesh = coinFaceRefs.current[i]
          if (cfMesh && cfMesh.userData.localStartX !== undefined) {
            const startX = cfMesh.userData.localStartX
            const startY = cfMesh.userData.localStartY
            const cosA = Math.cos(angleDelta)
            const sinA = Math.sin(angleDelta)
            cfMesh.position.x = startX * cosA - startY * sinA
            cfMesh.position.y = startX * sinA + startY * cosA
          }

          // Reposition Coin mesh (visible on desktop) the same way
          const coinRef = coinMeshRefs[i]
          if (coinRef && coinRef.current && coinRef.current.userData.localStartX !== undefined) {
            const startX = coinRef.current.userData.localStartX
            const startY = coinRef.current.userData.localStartY
            const cosA = Math.cos(angleDelta)
            const sinA = Math.sin(angleDelta)
            coinRef.current.position.x = startX * cosA - startY * sinA
            coinRef.current.position.y = startX * sinA + startY * cosA
          }
        }

        // Track lead coin (fastest) for texture swap timing
        const leadAngle = cs.coinAngles[0]
        cs.currentAngle = leadAngle

        // Swap textures when lead coin is ~25% through its rotation
        const fullProgress = (leadAngle - (cs.targetAngle - Math.PI * 2)) / (Math.PI * 2)
        if (fullProgress > 0.25 && !cs.textureSwapped) {
          cs.textureSwapped = true
          cs.showingCharacters = !cs.showingCharacters
          coinFaceRefs.current.forEach((mesh, i) => {
            if (!mesh) return
            const backTex = coinBackTexturesRef.current[i]
            const frontTex = coinFaceTexturesRef.current[i]
            if (cs.showingCharacters && backTex) {
              mesh.material.map = backTex
              mesh.material.needsUpdate = true
            } else if (!cs.showingCharacters && frontTex) {
              mesh.material.map = frontTex
              mesh.material.needsUpdate = true
            }
            // Reset individual flip state
            const flipState = coinFaceFlipState.current[`CoinFace${i + 1}`]
            if (flipState) {
              flipState.isFlipped = false
              flipState.showingBack = false
              flipState.currentRotation = 0
              flipState.targetRotation = 0
            }
          })
        }

        if (allDone) {
          // Animation complete — all coins have reached target
          cs.currentAngle = cs.targetAngle
          cs.isAnimating = false
          // Update stored start positions to current positions for next animation
          coinFaceRefs.current.forEach((mesh, i) => {
            if (!mesh) return
            mesh.userData.localStartX = mesh.position.x
            mesh.userData.localStartZ = mesh.position.z
            const flipState = coinFaceFlipState.current[`CoinFace${i + 1}`]
            if (flipState) {
              flipState.currentRotation = 0
              flipState.targetRotation = 0
            }
          })
          coinMeshRefs.forEach((ref) => {
            if (!ref.current) return
            ref.current.userData.localStartX = ref.current.position.x
            ref.current.userData.localStartZ = ref.current.position.z
          })
        }
      }

    }
  });

  // Always return the group that contains the model  
  return (
    <group ref={groupRef} visible={true} position={position} scale={scale} rotation={rotation}>
      {/* The 3D model is added dynamically in useEffect */}
    </group>
  );
};

CyborgTempleScene.displayName = 'CyborgTempleScene';

export default CyborgTempleScene;