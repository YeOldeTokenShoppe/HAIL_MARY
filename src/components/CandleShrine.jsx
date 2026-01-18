import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { NewCandleEffectManager } from './NewCandleEffect'

const CANDLE_COUNT = 100
const MAX_ADDITIONAL = 500

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
  
  // Fast hash function
  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
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

// Create a material with wobble animation baked in
function createWobbleMaterial(baseColor, options = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
      uColor: { value: new THREE.Color(baseColor) },
      uOpacity: { value: options.opacity ?? 1.0 },
    },
    vertexShader: `
      ${wobbleVertexChunk}
      
      void main() {
        float id = float(gl_InstanceID);
        vec4 instancePos = instanceMatrix * vec4(position, 1.0);
        
        // Apply wobble offset
        vec3 wobble = getWobbleOffset(id, instancePos.xyz);
        instancePos.xyz += wobble;
        
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
      ${wobbleVertexChunk}
      
      varying float vInstanceId;
      
      void main() {
        float id = float(gl_InstanceID);
        vInstanceId = id;
        
        vec4 instancePos = instanceMatrix * vec4(position, 1.0);
        vec3 wobble = getWobbleOffset(id, instancePos.xyz);
        instancePos.xyz += wobble;
        
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
        
        // User's candle - bright green emissive glow
        if (isHighlighted) {
          float pulse = sin(uTime * 2.0) * 0.1 + 0.9; // Subtle pulse
          color = vec3(0.0, 1.0, 0.2) * pulse; // Bright green
          intensity = 3.0; // Very bright emissive
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
    // Enable instancing support
    defines: { USE_INSTANCING: '' },
  })
}

// Senora (label) material with texture
function createSenoraMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
      uMap: { value: texture },
    },
    vertexShader: `
      ${wobbleVertexChunk}
      
      varying vec2 vUv;
      
      void main() {
        vUv = uv;
        float id = float(gl_InstanceID);
        
        vec4 instancePos = instanceMatrix * vec4(position, 1.0);
        vec3 wobble = getWobbleOffset(id, instancePos.xyz);
        instancePos.xyz += wobble;
        
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

// Flame material - most complex shader with flicker + wobble
function createFlameMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
    },
    vertexShader: `
      ${wobbleVertexChunk}
      
      varying float vHeight;
      varying float vPhase;
      varying float vInstanceId;
      
      void main() {
        float id = float(gl_InstanceID);
        vInstanceId = id;
        vPhase = hash(id) * 6.28318;
        
        vec3 pos = position;
        
        // Height normalized 0-1
        vHeight = clamp((pos.y + 0.1) / 0.6, 0.0, 1.0);
        
        // Flame flicker animation
        float flameTime = uTime * 3.0 + vPhase;
        
        // Strong sway side to side
        float sway = sin(flameTime * 1.5) * 0.06 * vHeight * vHeight;
        sway += sin(flameTime * 2.3) * 0.03 * vHeight;
        pos.x += sway;
        
        // Flicker height
        float flicker = sin(flameTime * 2.0) * 0.04 * vHeight;
        flicker += sin(flameTime * 3.7) * 0.02 * vHeight * vHeight;
        pos.y += flicker;
        
        // Z wobble
        pos.z += cos(flameTime * 1.8) * 0.04 * vHeight * vHeight;
        
        // Taper at top
        float taper = 1.0 - vHeight * 0.5;
        pos.x *= taper;
        pos.z *= taper;
        
        // Vertical stretch
        float stretch = 1.0 + sin(flameTime * 2.5) * 0.1 * vHeight;
        pos.y *= stretch;
        
        // Apply instance transform first, then wobble
        vec4 instancePos = instanceMatrix * vec4(pos, 1.0);
        vec3 wobble = getWobbleOffset(id, instancePos.xyz);
        instancePos.xyz += wobble;
        
        gl_Position = projectionMatrix * modelViewMatrix * instancePos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uClickedId;
      varying float vHeight;
      varying float vPhase;
      varying float vInstanceId;
      
      void main() {
        float time = uTime * 3.0 + vPhase;
        bool isClicked = uClickedId >= 0.0 && abs(uClickedId - vInstanceId) < 1.0;
        
        // Base flame colors
        vec3 innerColor = vec3(1.0, 0.95, 0.8);
        vec3 midColor = vec3(1.0, 0.5, 0.0);
        vec3 outerColor = vec3(1.0, 0.2, 0.0);
        
        // Purple glow for clicked
        vec3 purpleInner = vec3(1.0, 0.0, 1.0);
        vec3 purpleMid = vec3(0.8, 0.0, 1.0);
        vec3 purpleOuter = vec3(0.6, 0.0, 1.0);
        
        vec3 color;
        if (isClicked) {
          if (vHeight < 0.3) {
            color = mix(purpleInner, purpleMid, vHeight / 0.3);
          } else if (vHeight < 0.7) {
            color = mix(purpleMid, purpleOuter, (vHeight - 0.3) / 0.4);
          } else {
            color = mix(purpleOuter, vec3(0.8, 0.4, 1.0), (vHeight - 0.7) / 0.3);
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
        float intensity = isClicked ? 8.0 * flicker : 3.5 * flicker;
        float alpha = (1.0 - vHeight * 0.5) * (0.8 + flicker * 0.2);
        
        gl_FragColor = vec4(color * intensity, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: true,
    toneMapped: true,
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
      console.error('[useClonedGeometries] No scene found in GLTF')
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

// Generate random positions with exclusion zones
function usePositions(count, exclusionZone = null) {
  return useMemo(() => {
    const positions = []
    
    for (let i = 0; i < count; i++) {
      let x = (Math.random() - 0.5) * 40
      let y = (Math.random() - 0.5) * 30
      let z = (Math.random() - 0.5) * 20 - 5
      
      // Check if position is within exclusion cylinder (for hands model)
      if (exclusionZone) {
        const { center, radius, height } = exclusionZone
        const distFromCenter = Math.sqrt(
          Math.pow(x - center[0], 2) + 
          Math.pow(z - center[2], 2)
        )
        const withinHeight = Math.abs(y - center[1]) < height / 2
        
        // If inside exclusion cylinder, push outside
        if (distFromCenter < radius && withinHeight) {
          const angle = Math.atan2(z - center[2], x - center[0])
          const pushDistance = radius + 2 // Push outside radius + margin
          x = center[0] + Math.cos(angle) * pushDistance
          z = center[2] + Math.sin(angle) * pushDistance
        }
      }
      
      // Calculate "danger" level based on proximity to UI zone (bottom-left)
      const uiCenterX = -12
      const uiCenterY = -8
      const distToUI = Math.sqrt(
        Math.pow((x - uiCenterX) * 0.8, 2) + 
        Math.pow((y - uiCenterY) * 1.2, 2)
      )
      
      // If too close to UI zone, probabilistically push away
      const dangerThreshold = 12
      if (distToUI < dangerThreshold) {
        const pushChance = 1 - (distToUI / dangerThreshold)
        
        if (Math.random() < pushChance * 0.8) {
          // Push away from UI center
          const angle = Math.atan2(y - uiCenterY, x - uiCenterX)
          const pushDist = (dangerThreshold - distToUI) * 0.8
          x += Math.cos(angle) * pushDist
          y += Math.sin(angle) * pushDist
        }
      }
      
      positions.push({
        x,
        y,
        z,
        rotation: Math.random() * Math.PI * 2,
        scale: 0.8 + Math.random() * 0.4, // Vary size between 0.8 and 1.2
        heightScale: 0.5 + Math.random() * 0.8, // Vary height between 0.5 and 1.3 for visual variety
        litAt: null, // Base candles should NOT melt - only user-lit candles with Firestore litAt should melt
        userId: null, // Will be assigned when user lights a candle
        username: null,
        offering: null,
      })
    }
    return positions
  }, [count, exclusionZone])
}

// InstancedPart with melting animation
function InstancedPart({ geometry, material, positions, localMatrix, scale = 0.9, maxCount, onCandleClick, onCandleHover, onCandleLeave, enableMelting = false }) {
  const meshRef = useRef()
  const actualCount = positions.length
  const capacity = maxCount || actualCount
  
  // Update matrices per frame for melting effect
  useFrame(() => {
    if (!meshRef.current || !enableMelting) return
    
    
    const now = Date.now()
    const tempMatrix = new THREE.Matrix4()
    const tempPosition = new THREE.Vector3()
    const tempQuaternion = new THREE.Quaternion()
    const tempScale = new THREE.Vector3()
    
    let candlesWithLitAt = 0
    for (let i = 0; i < actualCount; i++) {
      const pos = positions[i]
      if (pos.litAt) {
        candlesWithLitAt++
        const elapsed = (now - pos.litAt) / 1000 // seconds
        const meltProgress = Math.min(elapsed / 300, 1.0) // 0-1.0 over 5 minutes (300 seconds) - TESTING
        const yScale = Math.max(0.01, 1.0 - meltProgress) // Scale down to almost nothing when melted
        
        const instanceScale = pos.scale || scale
        
        tempPosition.set(pos.x, pos.y, pos.z)
        tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pos.rotation)
        tempScale.set(instanceScale, instanceScale * yScale, instanceScale)
        
        tempMatrix.compose(tempPosition, tempQuaternion, tempScale)
        if (localMatrix) {
          tempMatrix.multiply(localMatrix)
        }
        meshRef.current.setMatrixAt(i, tempMatrix)
      }
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
  useEffect(() => {
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
      renderOrder={-5}
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
  
  // Combine positions
  const positions = useMemo(() => {
    const additional = additionalCandles.map(c => ({
      x: c.position ? c.position[0] : c.x,
      y: c.position ? c.position[1] : c.y,
      z: c.position ? c.position[2] : c.z,
      rotation: c.rotation || Math.random() * Math.PI * 2,
      scale: c.scale || 1.0,
      litAt: c.litAt,
      userId: c.userId,
      username: c.username,
      offering: c.offering
    }))
    return [...basePositions, ...additional]
  }, [basePositions, additionalCandles])
  
  // Create materials ONCE
  const materials = useMemo(() => ({
    wax: createXBaseMaterial(),  // Now price-reactive!
    wick: createWobbleMaterial('#222222'),
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
      
      <InstancedPart geometry={geometries.wax} material={materials.wax} positions={positions} localMatrix={localMatrices.wax} maxCount={maxCount} onCandleClick={onCandleClick} onCandleHover={onCandleHover} onCandleLeave={onCandleLeave} enableMelting={true} />
      <InstancedPart geometry={geometries.wick} material={materials.wick} positions={positions} localMatrix={localMatrices.wick} maxCount={maxCount} enableMelting={true} />
      <InstancedPart geometry={geometries.flame} material={materials.flame} positions={positions} localMatrix={localMatrices.flame} maxCount={maxCount} enableMelting={true} />
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
  
  // Cleanup expired candles every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setAdditionalCandles(prev => prev.filter(candle => {
        if (!candle.litAt) return true
        const elapsed = (now - candle.litAt) / 1000
        return elapsed < 300 // Keep if less than 5 minutes old - TESTING
      }))
    }, 60000) // Check every minute
    
    return () => clearInterval(interval)
  }, [])
  
  // Find and focus on user's candle
  const findUserCandle = useCallback(() => {
    console.log('🔍 Finding candle for userId:', currentUserId)
    console.log('📊 Total positions:', allPositions.length)
    console.log('🕯️ Positions with litAt:', allPositions.filter(p => p.litAt).length)
    
    const userCandleIndex = allPositions.findIndex(p => p.userId === currentUserId)
    if (userCandleIndex !== -1) {
      const candle = allPositions[userCandleIndex]
      console.log('✅ Found user candle at index:', userCandleIndex)
      console.log('🕯️ Candle data:', { userId: candle.userId, litAt: candle.litAt, hasLitAt: !!candle.litAt })
      
      setHighlightedCandleId(userCandleIndex)
      setSelectedCandle({ ...candle, instanceId: userCandleIndex })
      
      // Update shader uniform to highlight the candle
      sharedUniforms.uHighlightedId.value = userCandleIndex
      console.log('🎯 Set highlighted candle ID to:', userCandleIndex)
    } else {
      // No candle found
      console.log('❌ No candle found for userId:', currentUserId)
      console.log('📋 Available userIds:', allPositions.map(p => p.userId).filter(Boolean))
      sharedUniforms.uHighlightedId.value = -1
      setHighlightedCandleId(-1)
      setSelectedCandle(null)
      alert(`No candle found for user: ${currentUserId}. Check that your Firestore offering has a matching userId field.`)
    }
  }, [allPositions, currentUserId])
  
  const handleNewCandle = (position, offering) => {
    const newCandle = {
      position,
      offering,
      id: Date.now(),
      rotation: Math.random() * Math.PI * 2,
      scale: 0.8 + Math.random() * 0.4,
      litAt: Date.now(),
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
  
  // Convert Firestore offerings to candles
  useEffect(() => {
    if (offerings && offerings.length > 0) {
      const candlesFromOfferings = offerings.map((offering, index) => {
        // Use stored position from Firestore if available, otherwise generate random
        const storedPos = offering.position
        const x = storedPos?.x ?? (Math.random() - 0.5) * 30
        const y = storedPos?.y ?? (Math.random() - 0.5) * 20  
        const z = storedPos?.z ?? (Math.random() - 0.5) * 15
        
        return {
          x: x,
          y: y,
          z: z,
          rotation: Math.random() * Math.PI * 2,
          scale: 0.8 + Math.random() * 0.4,
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
  }, [offerings])
  
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
          {selectedCandle.username && (
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
                Remaining: {Math.max(0, 300 - (Date.now() - selectedCandle.litAt) / 1000).toFixed(1)} seconds ({Math.max(0, 100 * (1 - (Date.now() - selectedCandle.litAt) / (1000 * 300))).toFixed(1)}%)
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
      {allPositions.some(p => p.userId === currentUserId && p.litAt && (Date.now() - p.litAt) / 1000 < 300) && (
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