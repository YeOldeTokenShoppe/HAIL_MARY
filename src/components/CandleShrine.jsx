import React, { useRef, useMemo, useEffect, useLayoutEffect, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { NewCandleEffectManager } from './NewCandleEffect'

const CANDLE_COUNT = 80
const MAX_ADDITIONAL = 0

// Shared time uniform - all materials reference this single object
const sharedUniforms = {
  uTime: { value: 0 },
  uClickedId: { value: -1 },
  uPriceDirection: { value: 0 },
  uContinuousOffset: { value: 0 }, // Accumulated offset from continuous price movement
  uShortTermPrice: { value: 0 }, // Short-term price change for dynamic movement
  uPulseTime: { value: -1 }, // Time when pulse started, -1 = no pulse
  uPulsePosition: { value: new THREE.Vector3(0, 0, 0) }, // Position of pulse origin
  uHighlightedId: { value: -1 }, // ID of highlighted candle (user's candle)
  uCurrentTime: { value: Date.now() }, // Current time for melting calculations
  // Exclusion zone - box that candles should avoid (pushed out in shader)
  uExclusionCenter: { value: new THREE.Vector3(0, -1, -1.5) }, // Center of exclusion box
  uExclusionHalfSize: { value: new THREE.Vector3(4, 5, 7.5) }, // Half-dimensions (width/2, height/2, depth/2)
  // Head exclusion - sphere around Mary's face
  uHeadCenter: { value: new THREE.Vector3(0, 0.5, -14) }, // Mary's head position (adjust as needed)
  uHeadRadius: { value: 4.0 }, // Radius around head to exclude candles
}

// MEMORY FIX: Export uniforms instead of storing on window to prevent multiple references
export { sharedUniforms }

// Expose globally for pulse triggers (backwards compatibility)
// Only set if not already set to prevent duplicate references
if (typeof window !== 'undefined' && !window.sharedUniforms) {
  window.sharedUniforms = sharedUniforms
}

// Base vertex shader chunk for candle wobble - reused across all materials
// SIMPLIFIED: Use uTime directly - it's guaranteed smooth from Three.js clock
const wobbleVertexChunk = `
#ifndef USE_INSTANCING
  attribute mat4 instanceMatrix;
#endif


  uniform float uTime;
  uniform float uPriceDirection;
  uniform float uContinuousOffset;
  uniform float uShortTermPrice;
  uniform float uPulseTime;
  uniform vec3 uPulsePosition;
  uniform vec3 uExclusionCenter;
  uniform vec3 uExclusionHalfSize;
  uniform vec3 uHeadCenter;
  uniform float uHeadRadius;

  // Fast hash function
  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  // Calculate exclusion offset based on instance center (not per-vertex)
  // Returns an offset to apply uniformly to all vertices of the instance
  vec3 getExclusionOffset(vec3 instanceCenter) {
    vec3 offset = vec3(0.0);

    // Check body corridor exclusion (box)
    vec3 relPos = instanceCenter - uExclusionCenter;
    vec3 absRel = abs(relPos);

    if (absRel.x <= uExclusionHalfSize.x &&
        absRel.y <= uExclusionHalfSize.y &&
        absRel.z <= uExclusionHalfSize.z) {
      // Inside the box - calculate offset to push the whole instance out along X
      float pushDir = relPos.x >= 0.0 ? 1.0 : -1.0;
      float targetX = uExclusionCenter.x + pushDir * (uExclusionHalfSize.x + 0.5);
      offset.x = targetX - instanceCenter.x;
    }

    // Check head exclusion (sphere around Mary's face)
    vec3 toHead = instanceCenter + offset - uHeadCenter;
    float distToHead = length(toHead);

    if (distToHead < uHeadRadius) {
      // Inside head sphere - push outward from head center
      vec3 pushDir = normalize(toHead);
      if (distToHead < 0.01) {
        pushDir = vec3(1.0, 0.0, 0.0); // Default push direction if at center
      }
      vec3 targetPos = uHeadCenter + pushDir * (uHeadRadius + 0.5);
      offset = targetPos - instanceCenter;
    }

    return offset;
  }
  
  // Calculate wobble offset for a candle instance with continuous movement
  vec3 getWobbleOffset(float instanceId, vec3 basePosition) {
    // Each candle gets unique phase offsets
    float phaseX = hash(instanceId) * 6.28318;
    float phaseY = hash(instanceId + 50.0) * 6.28318;
    float phaseZ = hash(instanceId + 100.0) * 6.28318;
    
    // Use uTime directly - guaranteed smooth from Three.js clock
    // Multiply by slow factor to get gentle motion
    float t = uTime * 0.5;
    
    // Each candle has slightly different speeds for organic feel
    float speedX = 0.3 + hash(instanceId + 100.0) * 0.2;
    float speedY = 0.25 + hash(instanceId + 200.0) * 0.15;
    float speedZ = 0.28 + hash(instanceId + 300.0) * 0.18;
    
    // Layer multiple sine waves for complex but smooth motion
    // Primary wave
    float offsetX = sin(t * speedX + phaseX) * 0.35;
    float offsetY = sin(t * speedY + phaseY) * 0.5;
    float offsetZ = sin(t * speedZ + phaseZ) * 0.3;
    
    // Secondary slower wave for drift feel
    offsetX += cos(t * speedX * 0.4 + phaseX) * 0.2;
    offsetY += cos(t * speedY * 0.3 + phaseY) * 0.35;
    offsetZ += sin(t * speedZ * 0.5 + phaseZ + 1.0) * 0.15;
    
    // Tertiary micro-movement
    float microSpeed = 1.5 + hash(instanceId + 400.0) * 0.5;
    offsetX += sin(t * microSpeed + phaseX) * 0.05;
    offsetY += cos(t * microSpeed * 0.9 + phaseY) * 0.08;

    // Price-reactive vertical shift (bounded, not cumulative)
    // uPriceDirection ranges roughly -1 to 1, so max shift is ±0.4 units
    offsetY += uPriceDirection * 0.4;

    // Add pulse effect when a new candle lands
    if (uPulseTime > 0.0) {
      float pulseAge = uTime - uPulseTime;
      if (pulseAge < 1.5) { // Pulse lasts 1.5 seconds
        // Calculate distance from pulse origin
        float dist = distance(basePosition, uPulsePosition);
        
        // Wave travels outward at speed of 15 units per second
        float waveRadius = pulseAge * 15.0;
        float waveWidth = 5.0;
        
        // Check if this candle is within the wave
        float waveDist = abs(dist - waveRadius);
        if (waveDist < waveWidth) {
          // Smooth wave profile
          float waveStrength = 1.0 - (waveDist / waveWidth);
          waveStrength *= 1.0 - (pulseAge / 1.5); // Fade out over time
          
          // Push candles outward from pulse center
          vec3 pushDir = normalize(basePosition - uPulsePosition);
          // Randomize the push slightly per candle
          pushDir.x += (hash(instanceId + 500.0) - 0.5) * 0.3;
          pushDir.y += abs(hash(instanceId + 600.0) - 0.5) * 0.5; // Bias upward
          pushDir.z += (hash(instanceId + 700.0) - 0.5) * 0.3;
          pushDir = normalize(pushDir);
          
          // Apply the pulse displacement
          vec3 pulseOffset = pushDir * waveStrength * 1.5;
          offsetX += pulseOffset.x;
          offsetY += pulseOffset.y;
          offsetZ += pulseOffset.z;
        }
      }
    }
    
    return vec3(offsetX, offsetY, offsetZ);
  }
`

// Create a simple instanced material (wobble now baked into instanceMatrix)
function createWobbleMaterial(baseColor, options = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(baseColor) },
      uOpacity: { value: options.opacity ?? 1.0 },
    },
    vertexShader: `
      void main() {
        // Wobble is now baked into instanceMatrix for accurate raycasting
        vec4 instancePos = instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * instancePos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      
      void main() {
        gl_FragColor = vec4(uColor, uOpacity);
      }
    `,
    transparent: options.transparent ?? false,
    side: options.side ?? THREE.FrontSide,
    depthWrite: options.depthWrite ?? true,
    // Enable instancing support
    defines: { USE_INSTANCING: '' },
  })
}

// XBase material with click glow effect AND price-reactive color AND user highlight
function createXBaseMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
      uBaseColor: { value: new THREE.Color('#88ff88') },    // neutral green
      uBullColor: { value: new THREE.Color('#00ff66') },    // bright green for gains
      uBearColor: { value: new THREE.Color('#ff4444') },    // red for losses
      uGlowColor: { value: new THREE.Color('#ff00ff') },    // purple for clicked
      uUserColor: { value: new THREE.Color('#ffaa00') },    // golden for user's candle
    },
    vertexShader: `
      varying float vInstanceId;

      void main() {
        vInstanceId = float(gl_InstanceID);

        // Wobble is now baked into instanceMatrix for accurate raycasting
        vec4 instancePos = instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * instancePos;
      }
    `,
    fragmentShader: `
      uniform vec3 uBaseColor;
      uniform vec3 uBullColor;
      uniform vec3 uBearColor;
      uniform vec3 uGlowColor;
      uniform vec3 uUserColor;
      uniform float uClickedId;
      uniform float uHighlightedId;
      uniform float uTime;
      uniform float uPriceDirection;
      varying float vInstanceId;
      
      void main() {
        bool isClicked = uClickedId >= 0.0 && abs(uClickedId - vInstanceId) < 1.0;
        bool isHighlighted = uHighlightedId >= 0.0 && abs(uHighlightedId - vInstanceId) < 1.0;
        
        // Price-reactive wax color
        // uPriceDirection roughly ranges from -1 to 1
        float t = smoothstep(-0.5, 0.5, uPriceDirection);
        
        // Two-stage lerp for smooth transitions:
        // bear (red) -> neutral (soft green) -> bull (bright green)
        vec3 priceColor = mix(uBearColor, uBaseColor, smoothstep(0.0, 0.5, t));
        priceColor = mix(priceColor, uBullColor, smoothstep(0.5, 1.0, t));
        
        vec3 color = priceColor;
        float intensity = 1.0;
        
        // User's candle - luminous green glow
        if (isHighlighted) {
          float pulse = sin(uTime * 3.0) * 0.3 + 0.7; // More dramatic pulse
          float fastPulse = sin(uTime * 8.0) * 0.15 + 0.85; // Fast shimmer
          color = vec3(0.0, 1.0, 0.5) * pulse * fastPulse; // Luminous green
          intensity = 5.0; // Very bright to stand out
        }
        
        // Clicked candle override - purple glow effect
        if (isClicked) {
          float pulse = sin(uTime * 4.0) * 0.3 + 0.7;
          color = mix(uGlowColor, vec3(1.0, 0.0, 1.0), pulse);
          intensity = 2.0 + sin(uTime * 6.0) * 0.5;
        }
        
        gl_FragColor = vec4(color * intensity, 1.0);
      }
    `,
    side: THREE.FrontSide,
    depthTest: true,
    depthWrite: true,  // Write depth normally
    // Enable instancing support
    defines: { USE_INSTANCING: '' },
  })
}

// Senora (label) material with texture (wobble now baked into instanceMatrix)
function createSenoraMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;

        // Wobble is now baked into instanceMatrix for accurate raycasting
        vec4 instancePos = instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * instancePos;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec2 vUv;
      
      void main() {
        vec4 texColor = texture2D(uMap, vUv);
        if (texColor.a < 0.5) discard;
        gl_FragColor = texColor;
      }
    `,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
}

// Flame material - flicker animations (wobble now baked into instanceMatrix)
function createFlameMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
    },
    vertexShader: `
      uniform float uTime;

      varying float vHeight;
      varying float vPhase;
      varying float vInstanceId;

      // Hash function for per-instance variation
      float hash(float n) {
        return fract(sin(n) * 43758.5453123);
      }

      void main() {
        float id = float(gl_InstanceID);
        vInstanceId = id;
        vPhase = hash(id) * 6.28318;

        vec3 pos = position;

        // Height normalized 0-1
        vHeight = clamp((pos.y + 0.1) / 0.6, 0.0, 1.0);

        // Flame flicker animation (local to flame, not whole-candle wobble)
        float flameTime = uTime * 3.0 + vPhase;

        // Strong sway side to side
        float sway = sin(flameTime * 1.5) * 0.06 * vHeight * vHeight;
        sway += sin(flameTime * 2.3) * 0.03 * vHeight;
        pos.x += sway;

        // Flicker height
        float flicker = sin(flameTime * 2.0) * 0.04 * vHeight;
        flicker += sin(flameTime * 3.7) * 0.02 * vHeight * vHeight;
        pos.y += flicker;

        // Z wobble (flame-specific, not candle wobble)
        pos.z += cos(flameTime * 1.8) * 0.04 * vHeight * vHeight;

        // Taper at top
        float taper = 1.0 - vHeight * 0.5;
        pos.x *= taper;
        pos.z *= taper;

        // Vertical stretch
        float stretch = 1.0 + sin(flameTime * 2.5) * 0.1 * vHeight;
        pos.y *= stretch;

        // Wobble is now baked into instanceMatrix for accurate raycasting
        vec4 instancePos = instanceMatrix * vec4(pos, 1.0);

        gl_Position = projectionMatrix * modelViewMatrix * instancePos;

        // Clip-space depth bias - shifts flame toward camera in depth buffer
        // This prevents wax from occluding flames while still allowing phone occlusion
        gl_Position.z -= 0.002 * gl_Position.w;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uClickedId;
      uniform float uHighlightedId;
      varying float vHeight;
      varying float vPhase;
      varying float vInstanceId;

      void main() {
        float time = uTime * 3.0 + vPhase;
        bool isClicked = uClickedId >= 0.0 && abs(uClickedId - vInstanceId) < 1.0;
        bool isHighlighted = uHighlightedId >= 0.0 && abs(uHighlightedId - vInstanceId) < 1.0;

        // Base flame colors
        vec3 innerColor = vec3(1.0, 0.95, 0.8);
        vec3 midColor = vec3(1.0, 0.5, 0.0);
        vec3 outerColor = vec3(1.0, 0.2, 0.0);

        // Purple glow for clicked
        vec3 purpleInner = vec3(1.0, 0.0, 1.0);
        vec3 purpleMid = vec3(0.8, 0.0, 1.0);
        vec3 purpleOuter = vec3(0.6, 0.0, 1.0);

        // Cyan/white glow for highlighted (user's candle)
        vec3 highlightInner = vec3(1.0, 1.0, 1.0);
        vec3 highlightMid = vec3(0.0, 1.0, 1.0);
        vec3 highlightOuter = vec3(1.0, 0.8, 0.0);

        vec3 color;
        if (isClicked) {
          if (vHeight < 0.3) {
            color = mix(purpleInner, purpleMid, vHeight / 0.3);
          } else if (vHeight < 0.7) {
            color = mix(purpleMid, purpleOuter, (vHeight - 0.3) / 0.4);
          } else {
            color = mix(purpleOuter, vec3(0.8, 0.4, 1.0), (vHeight - 0.7) / 0.3);
          }
        } else if (isHighlighted) {
          // User's candle - bright cyan/white flame
          if (vHeight < 0.3) {
            color = mix(highlightInner, highlightMid, vHeight / 0.3);
          } else if (vHeight < 0.7) {
            color = mix(highlightMid, highlightOuter, (vHeight - 0.3) / 0.4);
          } else {
            color = mix(highlightOuter, vec3(1.0, 1.0, 0.5), (vHeight - 0.7) / 0.3);
          }
        } else {
          if (vHeight < 0.3) {
            color = mix(innerColor, midColor, vHeight / 0.3);
          } else if (vHeight < 0.7) {
            color = mix(midColor, outerColor, (vHeight - 0.3) / 0.4);
          } else {
            color = mix(outerColor, vec3(1.0, 0.8, 0.0), (vHeight - 0.7) / 0.3);
          }
        }

        float flicker = sin(time * 4.0) * 0.25 + sin(time * 9.0) * 0.15 + 1.0;
        float intensity = isClicked ? 8.0 * flicker : (isHighlighted ? 6.0 * flicker : 3.5 * flicker);
        float alpha = (1.0 - vHeight * 0.5) * (0.8 + flicker * 0.2);

        gl_FragColor = vec4(color * intensity, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthTest: true,    // Re-enabled - using clip space depth bias instead
    depthWrite: false,  // Transparent with additive shouldn't write depth
    toneMapped: true,
    polygonOffset: false,     // Using clip-space depth bias instead
    // Enable instancing support
    defines: { USE_INSTANCING: '' },
  })
}

// Extract geometries from GLB with enhanced error handling
function useClonedGeometries(modelPath) {
  // useGLTF should be called directly - it handles Suspense automatically
  const gltf = useGLTF(modelPath)
  const { scene } = gltf
  
  return useMemo(() => {
    
    if (!scene) {
      return { geometries: {}, textures: {}, localMatrices: {} }
    }
    
    const geometries = {}
    const textures = {}
    const localMatrices = {}
    
    scene.updateWorldMatrix(true, false)
    const rootInverse = new THREE.Matrix4().copy(scene.matrixWorld).invert()
    
    let foundParts = []
    
    scene.traverse((child) => {
      if (!child.isMesh) return
      
      const name = child.name
      foundParts.push(name)
      let key = null
      
      // Map the new model's part names
      if (name === 'Wax') key = 'wax'
      else if (name === 'Wick') key = 'wick'
      else if (name === 'Flame') key = 'flame'
      else if (name === 'Candle_Empty') key = 'candle_empty'
      // Additional mapping for candle body parts
      
      if (key) {
        const clonedGeometry = child.geometry.clone()
        clonedGeometry.computeBoundingSphere()
        clonedGeometry.computeBoundingBox()
        geometries[key] = clonedGeometry
        child.updateWorldMatrix(true, false)
        localMatrices[key] = new THREE.Matrix4().copy(child.matrixWorld).premultiply(rootInverse)
      }
    })
    
    return { geometries, textures, localMatrices }
  }, [scene])
}

// Priority zone configuration for candle placement
// Camera is at [0, 0, 15] looking toward negative Z
// Mary figure is around z=-8 to z=-12
// Hands/phone are around z=-6 (model position)
// Candles should appear IN FRONT of Mary (around her, at negative Z values)
// NOT behind the viewer (positive Z toward camera)
//
// Zone 1: Prime visibility - beside Mary, clearly visible
// Zone 2: Good visibility - wider arc around Mary
// Zone 3: Peripheral - higher/lower, around the scene
// Zone 4: Background - overflow, fill in gaps
const PRIORITY_ZONES = {
  zone1: {
    capacity: 25,  // First 25 candles go here
    // To the sides of Mary, at similar depth - full X range for even distribution
    x: { min: -10, max: 10 },
    y: { min: -2, max: 4 },
    z: { min: -12, max: -6 },  // Around Mary's depth (she's at z=-8 to -10)
    randomizeXSign: false,
  },
  zone2: {
    capacity: 40,  // Next 40 candles
    x: { min: -14, max: 14 },
    y: { min: -3, max: 6 },
    z: { min: -14, max: -4 },  // Wider Z range around Mary
    randomizeXSign: false,
  },
  zone3: {
    capacity: 60,  // Next 60 candles
    x: { min: -18, max: 18 },
    y: { min: -4, max: 10 },
    z: { min: -16, max: -2 },  // Even wider
    randomizeXSign: false,
  },
  zone4: {
    capacity: Infinity,  // Everything else
    x: { min: -20, max: 20 },
    y: { min: -5, max: 12 },   // Raised min from -15 to -5 for better camera angles
    z: { min: -20, max: 0 },   // All in front of phone, not behind viewer
    randomizeXSign: false,
  }
}

// Body corridor exclusion - the zone representing the viewer's body behind the camera
// Camera is at [0,0,0] (Mary's eyes), corridor extends to the phone/hands
// Using box shape to match debug visualization
// Note: Add wobble buffer (~1 unit) since candles drift/wobble in shader
// CORRIDOR_VERSION: Bump this to force position regeneration after changing corridor params
const CORRIDOR_VERSION = 9
const WOBBLE_BUFFER = 1.0  // Candles can drift this far from their base position
const BODY_CORRIDOR = {
  centerX: 0,       // Centered on X axis
  centerY: -1,      // Slightly below center (where body would be)
  zMin: -9,         // Extends forward to reach the phone/hands
  zMax: 6,          // Behind the camera where viewer's body would be
  halfWidth: 3 + WOBBLE_BUFFER,     // Half-width in X direction + wobble buffer
  halfHeight: 4 + WOBBLE_BUFFER,    // Half-height in Y direction + wobble buffer
}

// Generate a position within a specific zone, avoiding exclusion areas
// All randomness is seeded for deterministic results
function generateZonePosition(zone, exclusionZone, usedPositions = [], seed = 0.5) {
  const maxAttempts = 20

  // Helper to generate seeded random values
  const seededRand = (s) => {
    const x = Math.sin(s * 9999) * 10000
    return x - Math.floor(x)
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Use seeded random for deterministic positioning
    const r1 = seededRand(seed + attempt * 0.1)
    const r2 = seededRand(seed + attempt * 0.2 + 100)
    const r3 = seededRand(seed + attempt * 0.3 + 200)
    const rSign = seededRand(seed + attempt * 0.4 + 300)
    const rOffset = seededRand(seed + attempt * 0.5 + 400)

    let x = zone.x.min + r1 * (zone.x.max - zone.x.min)
    let y = zone.y.min + r2 * (zone.y.max - zone.y.min)
    let z = zone.z.min + r3 * (zone.z.max - zone.z.min)

    // Randomly flip X to left or right side if zone specifies
    if (zone.randomizeXSign) {
      const side = rSign > 0.5 ? 1 : -1
      x = x * side
    }

    // Check body corridor - box zone from hands to viewer
    // Only exclude if within the Z range of the corridor
    if (z >= BODY_CORRIDOR.zMin && z <= BODY_CORRIDOR.zMax) {
      const inXRange = Math.abs(x - BODY_CORRIDOR.centerX) < BODY_CORRIDOR.halfWidth
      const inYRange = Math.abs(y - BODY_CORRIDOR.centerY) < BODY_CORRIDOR.halfHeight

      if (inXRange && inYRange) {
        // Push candle outward in X direction (to the sides) with seeded offset
        const pushDirection = x >= 0 ? 1 : -1
        x = pushDirection * (BODY_CORRIDOR.halfWidth + 1.5 + rOffset * 3)
      }
    }

    // Avoid UI zone (bottom-left)
    const uiCenterX = -12
    const uiCenterY = -8
    const distToUI = Math.sqrt(
      Math.pow((x - uiCenterX) * 0.8, 2) +
      Math.pow((y - uiCenterY) * 1.2, 2)
    )

    if (distToUI < 10) {
      const angle = Math.atan2(y - uiCenterY, x - uiCenterX)
      const pushDist = (10 - distToUI) * 0.9
      x += Math.cos(angle) * pushDist
      y += Math.sin(angle) * pushDist
    }

    // Check minimum distance from other candles (prevents clustering)
    const minDistance = 2.5
    let tooClose = false
    for (const pos of usedPositions) {
      const dist = Math.sqrt(
        Math.pow(x - pos.x, 2) +
        Math.pow(y - pos.y, 2) +
        Math.pow(z - pos.z, 2)
      )
      if (dist < minDistance) {
        tooClose = true
        break
      }
    }

    if (!tooClose) {
      return { x, y, z }
    }
  }

  // Fallback: return a position using seeded random, but still respect personal space
  const rf1 = seededRand(seed + 500)
  const rf2 = seededRand(seed + 600)
  const rf3 = seededRand(seed + 700)
  const rfOffset = seededRand(seed + 800)

  let fallbackX = zone.x.min + rf1 * (zone.x.max - zone.x.min)
  let fallbackY = zone.y.min + rf2 * (zone.y.max - zone.y.min)
  let fallbackZ = zone.z.min + rf3 * (zone.z.max - zone.z.min)

  // Ensure fallback also respects body corridor (box check)
  if (fallbackZ >= BODY_CORRIDOR.zMin && fallbackZ <= BODY_CORRIDOR.zMax) {
    const inXRange = Math.abs(fallbackX - BODY_CORRIDOR.centerX) < BODY_CORRIDOR.halfWidth
    const inYRange = Math.abs(fallbackY - BODY_CORRIDOR.centerY) < BODY_CORRIDOR.halfHeight

    if (inXRange && inYRange) {
      const pushDirection = fallbackX >= 0 ? 1 : -1
      fallbackX = pushDirection * (BODY_CORRIDOR.halfWidth + 1.5 + rfOffset * 3)
    }
  }

  return { x: fallbackX, y: fallbackY, z: fallbackZ }
}

// Determine which zone a candle should be placed in based on its priority index
function getZoneForIndex(index, isUserCandle = false) {
  // User candles get priority placement in front zones
  if (isUserCandle) {
    if (index < PRIORITY_ZONES.zone1.capacity) return PRIORITY_ZONES.zone1
    if (index < PRIORITY_ZONES.zone1.capacity + PRIORITY_ZONES.zone2.capacity) return PRIORITY_ZONES.zone2
    if (index < PRIORITY_ZONES.zone1.capacity + PRIORITY_ZONES.zone2.capacity + PRIORITY_ZONES.zone3.capacity) return PRIORITY_ZONES.zone3
    return PRIORITY_ZONES.zone4
  }

  // Base/ambient candles fill peripheral areas first to leave room for user candles
  // They start from zone 2 outward
  if (index < 30) return PRIORITY_ZONES.zone2
  if (index < 70) return PRIORITY_ZONES.zone3
  return PRIORITY_ZONES.zone4
}

// Generate priority-based positions for user offering candles
function generateOfferingPositions(offerings, exclusionZone = null) {
  const positions = []

  for (let i = 0; i < offerings.length; i++) {
    const offering = offerings[i]

    // If offering has stored position, use it (for persistence)
    if (offering.position?.x !== undefined) {
      positions.push({
        x: offering.position.x,
        y: offering.position.y,
        z: offering.position.z,
      })
      continue
    }

    // Generate new position in appropriate priority zone
    const zone = getZoneForIndex(i, true)
    const pos = generateZonePosition(zone, exclusionZone, positions, i * 0.1234)
    positions.push(pos)
  }

  return positions
}

// Seeded random generator for deterministic values
function seededRandom(seed) {
  const x = Math.sin(seed * 9999) * 10000
  return x - Math.floor(x)
}

// Generate random positions with exclusion zones - now uses zone system for ambient candles
function usePositions(count, exclusionZone = null) {
  return useMemo(() => {
    const positions = []

    for (let i = 0; i < count; i++) {
      // Get appropriate zone for this ambient candle
      const zone = getZoneForIndex(i, false)
      const pos = generateZonePosition(zone, exclusionZone, positions, i * 0.5678)

      // Use index-based seeded random for deterministic values
      positions.push({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        rotation: seededRandom(i + 1) * Math.PI * 2,
        scale: 0.8 + seededRandom(i + 1000) * 0.4, // Vary size between 0.8 and 1.2
        heightScale: 0.5 + seededRandom(i + 2000) * 0.8, // Vary height between 0.5 and 1.3 for visual variety
        litAt: null, // Base candles should NOT melt - only user-lit candles with Firestore litAt should melt
        userId: null, // Will be assigned when user lights a candle
        username: null,
        offering: null,
      })
    }
    return positions
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, exclusionZone, CORRIDOR_VERSION]) // CORRIDOR_VERSION forces regeneration when corridor changes
}

// Replicate shader wobble calculation on CPU for raycasting accuracy
function calculateWobbleOffset(instanceId, time, basePosition = null) {
  // Hash function matching shader
  const hash = (n) => {
    const x = Math.sin(n) * 43758.5453123
    return x - Math.floor(x)
  }

  // Phase offsets per instance (matching shader)
  const phaseX = hash(instanceId) * 6.28318
  const phaseY = hash(instanceId + 50.0) * 6.28318
  const phaseZ = hash(instanceId + 100.0) * 6.28318

  // Time factor (matching shader: uTime * 0.5)
  const t = time * 0.5

  // Speed variations per instance
  const speedX = 0.3 + hash(instanceId + 100.0) * 0.2
  const speedY = 0.25 + hash(instanceId + 200.0) * 0.15
  const speedZ = 0.28 + hash(instanceId + 300.0) * 0.18

  // Primary wave
  let offsetX = Math.sin(t * speedX + phaseX) * 0.35
  let offsetY = Math.sin(t * speedY + phaseY) * 0.5
  let offsetZ = Math.sin(t * speedZ + phaseZ) * 0.3

  // Secondary slower wave
  offsetX += Math.cos(t * speedX * 0.4 + phaseX) * 0.2
  offsetY += Math.cos(t * speedY * 0.3 + phaseY) * 0.35
  offsetZ += Math.sin(t * speedZ * 0.5 + phaseZ + 1.0) * 0.15

  // Tertiary micro-movement
  const microSpeed = 1.5 + hash(instanceId + 400.0) * 0.5
  offsetX += Math.sin(t * microSpeed + phaseX) * 0.05
  offsetY += Math.cos(t * microSpeed * 0.9 + phaseY) * 0.08

  // Add pulse effect when a new candle lands (matching shader logic)
  if (basePosition && sharedUniforms.uPulseTime.value > 0) {
    const pulseAge = time - sharedUniforms.uPulseTime.value
    if (pulseAge > 0 && pulseAge < 1.5) { // Pulse lasts 1.5 seconds
      const pulsePos = sharedUniforms.uPulsePosition.value

      // Calculate distance from pulse origin
      const dx = basePosition.x - pulsePos.x
      const dy = basePosition.y - pulsePos.y
      const dz = basePosition.z - pulsePos.z
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

      // Wave travels outward at speed of 15 units per second
      const waveRadius = pulseAge * 15.0
      const waveWidth = 5.0

      // Check if this candle is within the wave
      const waveDist = Math.abs(dist - waveRadius)
      if (waveDist < waveWidth) {
        // Smooth wave profile
        let waveStrength = 1.0 - (waveDist / waveWidth)
        waveStrength *= 1.0 - (pulseAge / 1.5) // Fade out over time

        // Push candles outward from pulse center
        let pushDirX = dist > 0.001 ? dx / dist : 1
        let pushDirY = dist > 0.001 ? dy / dist : 0
        let pushDirZ = dist > 0.001 ? dz / dist : 0

        // Randomize the push slightly per candle
        pushDirX += (hash(instanceId + 500.0) - 0.5) * 0.3
        pushDirY += Math.abs(hash(instanceId + 600.0) - 0.5) * 0.5 // Bias upward
        pushDirZ += (hash(instanceId + 700.0) - 0.5) * 0.3

        // Normalize
        const pushLen = Math.sqrt(pushDirX * pushDirX + pushDirY * pushDirY + pushDirZ * pushDirZ)
        if (pushLen > 0.001) {
          pushDirX /= pushLen
          pushDirY /= pushLen
          pushDirZ /= pushLen
        }

        // Apply the pulse displacement
        offsetX += pushDirX * waveStrength * 1.5
        offsetY += pushDirY * waveStrength * 1.5
        offsetZ += pushDirZ * waveStrength * 1.5
      }
    }
  }

  // Price-reactive vertical shift (bounded, not cumulative)
  // uPriceDirection ranges roughly -1 to 1, so max shift is ±0.4 units
  offsetY += sharedUniforms.uPriceDirection.value * 0.4

  return { x: offsetX, y: offsetY, z: offsetZ }
}

// InstancedPart with melting animation and wobble-synced raycasting
function InstancedPart({ geometry, material, positions, localMatrix, scale = 0.9, maxCount, onCandleClick, onCandleHover, onCandleLeave, enableMelting = false, renderOrder = 10 }) {
  const meshRef = useRef()
  const actualCount = positions.length
  const capacity = maxCount || actualCount

  // Update matrices per frame - now includes wobble for accurate raycasting
  useFrame((state) => {
    if (!meshRef.current) return

    const time = state.clock.elapsedTime
    const now = Date.now()
    const tempMatrix = new THREE.Matrix4()
    const tempPosition = new THREE.Vector3()
    const tempQuaternion = new THREE.Quaternion()
    const tempScale = new THREE.Vector3()

    // Update ALL candle positions with wobble for accurate raycasting
    for (let i = 0; i < actualCount; i++) {
      const pos = positions[i]
      const instanceScale = pos.scale || scale

      // Calculate wobble offset (matching shader calculation)
      // Pass base position for pulse/ripple effect
      const basePos = { x: pos.x, y: pos.y, z: pos.z }
      const wobble = calculateWobbleOffset(i, time, basePos)

      // Apply wobble to base position
      tempPosition.set(
        pos.x + wobble.x,
        pos.y + wobble.y,
        pos.z + wobble.z
      )

      tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pos.rotation)

      // Handle melting for candles with litAt
      let yScale = pos.heightScale !== undefined ? pos.heightScale : instanceScale
      if (enableMelting && pos.litAt) {
        const elapsed = (now - pos.litAt) / 1000
        const meltProgress = Math.min(elapsed / 604800, 1.0) // 604800 = 1 week in seconds
        yScale = Math.max(0.01, (pos.heightScale || instanceScale) * (1.0 - meltProgress))
      }

      tempScale.set(instanceScale, yScale, instanceScale)

      tempMatrix.compose(tempPosition, tempQuaternion, tempScale)
      if (localMatrix) {
        tempMatrix.multiply(localMatrix)
      }
      meshRef.current.setMatrixAt(i, tempMatrix)
    }

    meshRef.current.instanceMatrix.needsUpdate = true

    // Update current time uniform for shader effects
    sharedUniforms.uCurrentTime.value = now
  })
  
  // Calculate initial matrices
  const baseMatrices = useMemo(() => {
    const matrices = []
    const tempMatrix = new THREE.Matrix4()
    const tempPosition = new THREE.Vector3()
    const tempQuaternion = new THREE.Quaternion()
    const tempScale = new THREE.Vector3()
    const hiddenMatrix = new THREE.Matrix4().makeTranslation(0, -10000, 0)
    
    for (let i = 0; i < capacity; i++) {
      if (i < positions.length) {
        const pos = positions[i]
        const instanceScale = pos.scale || scale
        // Use heightScale for Y dimension if available (for varied heights on base candles)
        // User candles with litAt will have their Y scale overridden by melting logic in useFrame
        const instanceHeightScale = pos.heightScale !== undefined ? pos.heightScale : instanceScale
        tempPosition.set(pos.x, pos.y, pos.z)
        tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pos.rotation)
        tempScale.set(instanceScale, instanceHeightScale, instanceScale)
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale)
        if (localMatrix) {
          tempMatrix.multiply(localMatrix)
        }
        matrices.push(tempMatrix.clone())
      } else {
        matrices.push(hiddenMatrix.clone())
      }
    }
    return matrices
  }, [positions, localMatrix, scale, capacity])
  
  // Set matrices ONCE on mount or when positions change
  // Use useLayoutEffect to set matrices synchronously before paint, preventing flash of clumped candles
  useLayoutEffect(() => {
    if (!meshRef.current) return

    // Set the actual count of instances to render
    meshRef.current.count = actualCount

    for (let i = 0; i < capacity; i++) {
      meshRef.current.setMatrixAt(i, baseMatrices[i])
    }
    meshRef.current.instanceMatrix.needsUpdate = true

    // Force compute bounding box and sphere for better raycasting
    meshRef.current.computeBoundingBox()
    meshRef.current.computeBoundingSphere()

    // Expand bounding sphere to account for shader wobble
    if (meshRef.current.boundingSphere) {
      meshRef.current.boundingSphere.radius *= 1.5  // Account for movement
    }
  }, [baseMatrices, capacity, actualCount])
  
  if (!geometry) return null
  
  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, capacity]}
      frustumCulled={false}
      renderOrder={renderOrder}
      raycast={THREE.InstancedMesh.prototype.raycast}
      onClick={(event) => {
        event.stopPropagation()
        if (onCandleClick && event.instanceId !== undefined && event.instanceId < positions.length) {
          onCandleClick(event.instanceId, positions[event.instanceId])
        }
      }}
      onPointerOver={(event) => {
        event.stopPropagation()
        if (onCandleHover && event.instanceId !== undefined && event.instanceId < positions.length) {
          onCandleHover(event.instanceId)
        }
      }}
      onPointerOut={(event) => {
        event.stopPropagation()
        if (onCandleLeave) {
          onCandleLeave()
        }
      }}
    />
  )
}

// Single animation controller - updates shared uniforms once per frame
// Accepts either refs (for smooth updates) or values (for static/slow updates)
function AnimationController({ priceDirection, priceRef, shortTermPriceRef, continuousOffsetRef, isMobile }) {
  useFrame((state) => {
    // Update time - this is the ONLY thing that drives candle position
    // state.clock.elapsedTime is guaranteed smooth by Three.js
    sharedUniforms.uTime.value = state.clock.elapsedTime
    
    // Price direction still used for color changes (not position)
    sharedUniforms.uPriceDirection.value = priceRef?.current ?? priceDirection ?? 0
  })
  return null
}

export const CandleCloud = React.memo(function CandleCloud({ count = CANDLE_COUNT, priceDirection = 0, priceRef, shortTermPriceRef, continuousOffsetRef, additionalCandles = [], onCandleClick, onCandleHover, onCandleLeave, clickedCandleId, isMobile = false, exclusionZone = null }) {
  
  // ALL HOOKS MUST BE CALLED UNCONDITIONALLY - NO EARLY RETURNS BEFORE ALL HOOKS
  
  // Reset uniforms on mount to ensure clean state
  useEffect(() => {
    
    // Force complete reset of all uniforms
    const resetUniforms = () => {
      sharedUniforms.uTime.value = 0
      sharedUniforms.uClickedId.value = -1
      sharedUniforms.uPriceDirection.value = 0
      sharedUniforms.uContinuousOffset.value = 0
      sharedUniforms.uShortTermPrice.value = 0
      sharedUniforms.uPulseTime.value = -1
      sharedUniforms.uPulsePosition.value.set(0, 0, 0)
      sharedUniforms.uHighlightedId.value = -1
      sharedUniforms.uCurrentTime.value = Date.now()
    }
    
    // Immediate reset
    resetUniforms()
    
    // Additional reset after small delay to ensure clean state
    const resetTimer = setTimeout(resetUniforms, 100)
    
    return () => {
      clearTimeout(resetTimer)
      // Final cleanup on unmount
      resetUniforms()
    }
  }, [])
  
  // Load geometries - must be called unconditionally (Rules of Hooks)
  const { geometries, textures, localMatrices } = useClonedGeometries('/models/tinyJapCanOnly.glb')
  
  const basePositions = usePositions(count, exclusionZone)
  
  // Clean up cloned geometries on unmount
  useEffect(() => {
    return () => {
      // Dispose cloned geometries when component unmounts
      if (geometries) {
        Object.values(geometries).forEach(geometry => {
          if (geometry && geometry.dispose) {
            geometry.dispose()
          }
        })
      }
    }
  }, [geometries])
  
  // Combine positions - apply exclusion to additional candles too
  // Use stable random values based on candle id to prevent position shifts on re-render
  const positions = useMemo(() => {
    const additional = additionalCandles.map(c => {
      let x = c.position ? c.position[0] : c.x
      let y = c.position ? c.position[1] : c.y
      let z = c.position ? c.position[2] : c.z

      // Use candle id for deterministic "random" offset
      const idSeed = (c.id || 0) % 1000 / 1000

      // Apply body corridor exclusion to additional candles
      if (z >= BODY_CORRIDOR.zMin && z <= BODY_CORRIDOR.zMax) {
        const inXRange = Math.abs(x - BODY_CORRIDOR.centerX) < BODY_CORRIDOR.halfWidth
        const inYRange = Math.abs(y - BODY_CORRIDOR.centerY) < BODY_CORRIDOR.halfHeight

        if (inXRange && inYRange) {
          const pushDirection = x >= 0 ? 1 : -1
          x = pushDirection * (BODY_CORRIDOR.halfWidth + 0.5 + idSeed * 3)
        }
      }

      return {
        x,
        y,
        z,
        rotation: c.rotation !== undefined ? c.rotation : (idSeed * Math.PI * 2),
        scale: c.scale || 1.0,
        litAt: c.litAt,
        userId: c.userId,
        username: c.username,
        offering: c.offering
      }
    })
    return [...basePositions, ...additional]
  }, [basePositions, additionalCandles])
  
  // Create materials ONCE
  const materials = useMemo(() => ({
    wax: createXBaseMaterial(),  // Now price-reactive!
    wick: createWobbleMaterial('#222222'),  // Normal depth writing
    flame: createFlameMaterial(),  // Or createFlameMaterialPriceReactive() for tinted flames
    candle_empty: createWobbleMaterial('#ffddaa'), // Candle body material
  }), [])
  
  // Clean up materials on unmount
  useEffect(() => {
    return () => {
      // Dispose materials when component unmounts
      if (materials.wax) materials.wax.dispose()
      if (materials.wick) materials.wick.dispose()
      if (materials.flame) materials.flame.dispose()
      if (materials.candle_empty) materials.candle_empty.dispose()
    }
  }, [materials])
  
  // Update clicked ID in shared uniforms
  useEffect(() => {
    sharedUniforms.uClickedId.value = clickedCandleId ?? -1
  }, [clickedCandleId])
  
  // ALL HOOKS CALLED - useGLTF with Suspense handles loading automatically
  
  // Now continue with the main render logic
  const maxCount = CANDLE_COUNT + MAX_ADDITIONAL



  // Geometries are guaranteed to be ready at this point due to the check above

  return (
    <group>
      {/* Single animation controller for ALL parts - uses refs for smooth updates */}
      <AnimationController 
        priceDirection={priceDirection} 
        priceRef={priceRef}
        shortTermPriceRef={shortTermPriceRef}
        continuousOffsetRef={continuousOffsetRef}
        isMobile={isMobile} 
      />
      
      {/* Standard render order with flames last. Flames use polygonOffset to avoid being occluded by wax while still being occluded by phone */}
      {geometries.wax && <InstancedPart geometry={geometries.wax} material={materials.wax} positions={positions} localMatrix={localMatrices.wax} maxCount={maxCount} onCandleClick={onCandleClick} onCandleHover={onCandleHover} onCandleLeave={onCandleLeave} enableMelting={true} renderOrder={10} />}
      {geometries.wick && <InstancedPart geometry={geometries.wick} material={materials.wick} positions={positions} localMatrix={localMatrices.wick} maxCount={maxCount} enableMelting={true} renderOrder={10} />}
      {geometries.flame && <InstancedPart geometry={geometries.flame} material={materials.flame} positions={positions} localMatrix={localMatrices.flame} maxCount={maxCount} enableMelting={true} renderOrder={15} />}
      {geometries.candle_empty && <InstancedPart geometry={geometries.candle_empty} material={materials.candle_empty} positions={positions} localMatrix={localMatrices.candle_empty} maxCount={maxCount} enableMelting={true} />}
    </group>
  )
})

// Scene setup and gradient background unchanged
export function SceneSetup({ is80sMode }) {
  const { scene } = useThree()
  
  useEffect(() => {
    scene.background = is80sMode ? null : new THREE.Color(0x000000)
  }, [is80sMode, scene])
  
  return null
}

export function GradientBackground({ is80sMode = false }) {
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#1a1a2e',
    side: THREE.BackSide,
    depthWrite: false,
  }), [])
  
  if (is80sMode) return null
  
  return (
    <mesh material={material}>
      <sphereGeometry args={[100, 32, 16]} />
    </mesh>
  )
}
export function PriceSimulator({ onPriceChange }) {
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const baseWave = Math.sin(t * 0.15) * 0.5
    const trend = Math.sin(t * 0.08) * 0.3
    const gentleVolatility = Math.sin(t * 1.0) * 0.15
    const crashCycle = Math.sin(t * 0.1) < -0.8 ? -0.6 : 0
    const pumpCycle = Math.sin(t * 0.15 + 2) > 0.8 ? 0.5 : 0
    
    const price = baseWave + trend + gentleVolatility + crashCycle + pumpCycle
    onPriceChange(price)
  })
  return null
}

useGLTF.preload('/models/tinyJapCanOnly.glb')

export default function CandleShrine({ offerings = [], onSelectOffering, onPriceChange, is80sMode, currentUserId = 'testUser123' }) {
  const [priceDirection, setPriceDirection] = useState(0)
  const [additionalCandles, setAdditionalCandles] = useState([])
  const [selectedCandle, setSelectedCandle] = useState(null)
  const [allPositions, setAllPositions] = useState([])
  const [offeringCandles, setOfferingCandles] = useState([])
  const pricePercent = (priceDirection * 5).toFixed(2)
  const effectManagerRef = useRef()
  const [clickedCandleId, setClickedCandleId] = useState(null)

  // Trigger ripple/pulse effect when a new candle lands
  const triggerCandlePulse = useCallback((position) => {
    // Set pulse uniforms to trigger the ripple effect
    sharedUniforms.uPulseTime.value = sharedUniforms.uTime.value
    sharedUniforms.uPulsePosition.value.set(position[0], position[1], position[2])
  }, [])
  
  // Cleanup expired candles every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setAdditionalCandles(prev => prev.filter(candle => {
        if (!candle.litAt) return true
        const elapsed = (now - candle.litAt) / 1000
        return elapsed < 604800 // Keep if less than 1 week old (604800 seconds)
      }))
    }, 60000) // Check every minute
    
    return () => clearInterval(interval)
  }, [])
  
  // Find and focus on user's candle
  const findUserCandle = useCallback(() => {
    
    const userCandleIndex = allPositions.findIndex(p => p.userId === currentUserId)
    if (userCandleIndex !== -1) {
      const candle = allPositions[userCandleIndex]
      
      setHighlightedCandleId(userCandleIndex)
      setSelectedCandle({ ...candle, instanceId: userCandleIndex })
      
      // Update shader uniform to highlight the candle
      sharedUniforms.uHighlightedId.value = userCandleIndex
    } else {
      // No candle found
      sharedUniforms.uHighlightedId.value = -1
      setHighlightedCandleId(-1)
      setSelectedCandle(null)
      alert(`No candle found for user: ${currentUserId}. Check that your Firestore offering has a matching userId field.`)
    }
  }, [allPositions, currentUserId])
  
  const handleNewCandle = (position, offering) => {
    const id = Date.now()
    // Use id-based seeded values for stability
    const seed = (id % 10000) / 10000
    const newCandle = {
      position,
      offering,
      id,
      rotation: seed * Math.PI * 2,
      scale: 0.8 + ((id % 1000) / 1000) * 0.4,
      litAt: id,
      userId: currentUserId,
      username: 'Test User',
      x: position[0],
      y: position[1],
      z: position[2]
    }
    setAdditionalCandles(prev => [...prev, newCandle])
  }
  
  const handleCandleClick = (instanceId) => {
    setClickedCandleId(instanceId)
    setTimeout(() => setClickedCandleId(null), 2000)
    
    const candle = allPositions[instanceId]
    if (candle) {
      setSelectedCandle({ ...candle, instanceId })
      if (candle.offering && onSelectOffering) {
        onSelectOffering(candle.offering)
      }
    } else if (offerings?.length > 0 && onSelectOffering) {
      const randomIndex = Math.floor(Math.random() * offerings.length)
      onSelectOffering(offerings[randomIndex])
    }
  }
  
  // Convert Firestore offerings to candles with priority zone positioning
  // Deduplicates: if a candle already exists in additionalCandles (from effect), skip it
  useEffect(() => {
    if (offerings && offerings.length > 0) {
      // Get userIds already in additionalCandles (from the NewCandleEffect)
      // These candles are already visible, so we don't want duplicates
      const existingUserIds = new Set(
        additionalCandles
          .filter(c => c.userId)
          .map(c => c.userId)
      )

      // Filter out offerings that already have a candle from the effect
      const newOfferings = offerings.filter(offering => {
        const oderId = offering.userId || offering.uid
        return !existingUserIds.has(oderId)
      })

      // Define exclusion zone for position generation
      const exclusionZone = {
        center: [0, 0, 0],
        radius: 12,
        height: 20
      }

      // Generate priority-based positions for filtered offerings
      const generatedPositions = generateOfferingPositions(newOfferings, exclusionZone)

      const candlesFromOfferings = newOfferings.map((offering, index) => {
        // Use stored position from Firestore if available, otherwise use generated priority position
        const storedPos = offering.position
        const genPos = generatedPositions[index]

        // Use offering id or index for seeded random values
        const seedBase = offering.id ? offering.id.charCodeAt(0) + index : index
        const seed1 = (seedBase % 1000) / 1000
        const seed2 = ((seedBase * 7) % 1000) / 1000
        const seed3 = ((seedBase * 13) % 1000) / 1000

        let x = storedPos?.x ?? genPos.x
        let y = storedPos?.y ?? genPos.y
        let z = storedPos?.z ?? genPos.z

        // Apply body corridor exclusion to ALL positions (including stored ones)
        if (z >= BODY_CORRIDOR.zMin && z <= BODY_CORRIDOR.zMax) {
          const inXRange = Math.abs(x - BODY_CORRIDOR.centerX) < BODY_CORRIDOR.halfWidth
          const inYRange = Math.abs(y - BODY_CORRIDOR.centerY) < BODY_CORRIDOR.halfHeight

          if (inXRange && inYRange) {
            // Push candle outward in X direction with seeded offset
            const pushDirection = x >= 0 ? 1 : -1
            x = pushDirection * (BODY_CORRIDOR.halfWidth + 0.5 + seed1 * 3)
          }
        }

        return {
          x: x,
          y: y,
          z: z,
          rotation: seed2 * Math.PI * 2,
          scale: 0.8 + seed3 * 0.4,
          litAt: offering.litAt || offering.createdAt?.toDate?.()?.getTime?.() || offering.timestamp?.toDate?.()?.getTime?.() || Date.now(),
          userId: offering.userId || offering.uid || `user_${index}`,
          username: offering.userName || offering.username || 'Anonymous',
          offering: offering,
          position: [x, y, z],
          id: offering.id || `offering_${index}`
        }
      })
      setOfferingCandles(candlesFromOfferings)
    }
  }, [offerings, additionalCandles])
  
  // Update allPositions when positions change
  useEffect(() => {
    // Combine offering candles and additional candles
    setAllPositions([...offeringCandles, ...additionalCandles])
  }, [offeringCandles, additionalCandles])
  
  return (
    <div style={{ width: '100%', height: '100vh', background: is80sMode ? 'transparent' : '#000', position: 'relative' }}>
      {is80sMode && (
        <img
          src="/images/retro.webp"
          alt="80s retro background"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.8,
            zIndex: 1,
            pointerEvents: 'none',
          }}
        />
      )}
      <Canvas
        camera={{ position: [0, 0, 15], fov: 60 }}
        dpr={2}
        gl={{ 
          antialias: true,
          powerPreference: "high-performance",
          alpha: true,
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 2,
          background: 'transparent',
        }}
      >
        <SceneSetup is80sMode={is80sMode} />
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <GradientBackground priceDirection={priceDirection} is80sMode={is80sMode} />
        <CandleCloud 
          count={CANDLE_COUNT} 
          priceDirection={priceDirection} 
          additionalCandles={allPositions} 
          onCandleClick={handleCandleClick} 
          clickedCandleId={clickedCandleId}
          exclusionZone={{
            center: [0, 0, 0],  // Center of the phone model
            radius: 12,         // Increased radius to clear the phone area
            height: 20          // Cover vertical space
          }}
        />
        <PriceSimulator onPriceChange={(price) => {
          setPriceDirection(price)
          if (onPriceChange) onPriceChange(price * 5)
        }} />

        
        <NewCandleEffectManager
          ref={effectManagerRef}
          phonePosition={[0, -3, 5]}
          cloudBounds={{ x: 20, y: 10, z: 10 }}
          onNewCandle={handleNewCandle}
          onCandlePulse={triggerCandlePulse}
          candleModelPath="/models/tinyJapCanOnly.glb"
        />
        
        <EffectComposer>
          <Bloom
            intensity={1.2}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            mipmapBlur
            radius={0.8}
          />
        </EffectComposer>
      </Canvas>
      
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: '12px',
        zIndex: 3,
      }}>
        <div style={{ 
          color: priceDirection >= 0 ? '#00ff66' : '#ff4444',
          fontSize: '24px',
          fontWeight: 'bold',
          marginBottom: '8px'
        }}>
          {priceDirection >= 0 ? '↑' : '↓'} {pricePercent}%
        </div>
        <div style={{ color: '#888' }}>
          🕯️ {(CANDLE_COUNT + additionalCandles.length).toLocaleString()} candles burning
        </div>
        <div style={{ color: '#666', marginTop: '4px' }}>
          🔥 1,250,000 RL80 sacrificed
        </div>
      </div>
      
      {/* Candle info overlay */}
      {selectedCandle && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          background: 'rgba(0, 0, 0, 0.8)',
          border: '1px solid rgba(255, 170, 0, 0.5)',
          borderRadius: '8px',
          padding: '16px',
          color: '#fff',
          fontFamily: 'monospace',
          fontSize: '12px',
          zIndex: 3,
          minWidth: '200px',
        }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#ffaa00' }}>
            {selectedCandle.userId === currentUserId ? 'Your Candle' : 'Candle Info'}
          </h3>
          {/* Show St. GR80 for anonymous candles, otherwise show user info */}
          {(!selectedCandle.username || selectedCandle.username === 'Anonymous') ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <img
                src="/images/GR80_headshot.webp"
                alt="St. GR80"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid rgba(255, 170, 0, 0.6)',
                }}
              />
              <div>
                <div style={{ fontWeight: 'bold', color: '#ffaa00' }}>St. GR80</div>
                <div style={{ fontSize: '10px', color: '#888' }}>Eternal Flame</div>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: '4px' }}>
              User: {selectedCandle.username}
            </div>
          )}
          {selectedCandle.litAt && (
            <>
              <div style={{ marginBottom: '4px' }}>
                Lit: {new Date(selectedCandle.litAt).toLocaleTimeString()}
              </div>
              <div style={{ marginBottom: '4px', color: '#00ff66' }}>
                Remaining: {(() => {
                  const remaining = Math.max(0, 604800 - (Date.now() - selectedCandle.litAt) / 1000);
                  const days = Math.floor(remaining / 86400);
                  const hours = Math.floor((remaining % 86400) / 3600);
                  const minutes = Math.floor((remaining % 3600) / 60);
                  return `${days}d ${hours}h ${minutes}m`;
                })()} ({Math.max(0, 100 * (1 - (Date.now() - selectedCandle.litAt) / (1000 * 604800))).toFixed(1)}%)
              </div>
            </>
          )}
          {selectedCandle.offering && (
            <div style={{ marginTop: '8px', fontStyle: 'italic' }}>
              "{selectedCandle.offering.text || 'Offering'}"
            </div>
          )}
        </div>
      )}
      
      {/* Find My Candle button - only visible when user has an active lit candle */}
      {allPositions.some(p => p.userId === currentUserId && p.litAt && (Date.now() - p.litAt) / 1000 < 604800) && (
        <button
          onClick={findUserCandle}
          style={{
            position: 'fixed',
            bottom: '120px',
            left: '30px',
            background: 'linear-gradient(135deg, #ffaa00 0%, #ff8800 100%)',
            border: 'none',
            borderRadius: '12px',
            padding: '12px 24px',
            color: '#000',
            fontFamily: 'monospace',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 0 30px rgba(255, 170, 0, 0.4)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          🔍 Find My Candle
        </button>
      )}
    </div>
  )
}