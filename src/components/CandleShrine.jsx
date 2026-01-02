import React, { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { NewCandleEffectManager } from './NewCandleEffect'

const CANDLE_COUNT = 500
const MAX_ADDITIONAL = 100 // Buffer for user-added candles

// Price-reactive gradient background
export function GradientBackground({ priceDirection = 0 }) {
  const meshRef = useRef()
  const { viewport } = useThree()
  
  // Lerp colors smoothly
  const colorsRef = useRef({
    bottom: new THREE.Color('#1a1a2e'),
    top: new THREE.Color('#4a4a6a'),
  })
  
  useFrame(() => {
    if (!meshRef.current) return
    
    // Target colors based on price
    let targetBottom, targetTop
    if (priceDirection > 0.3) {
      targetBottom = new THREE.Color('#0a2d1a')
      targetTop = new THREE.Color('#22ff66')
    } else if (priceDirection < -0.3) {
      targetBottom = new THREE.Color('#2d0a0a')
      targetTop = new THREE.Color('#ff4444')
    } else {
      targetBottom = new THREE.Color('#1a1a2e')
      targetTop = new THREE.Color('#4a4a6a')
    }
    
    // Smooth lerp
    colorsRef.current.bottom.lerp(targetBottom, 0.02)
    colorsRef.current.top.lerp(targetTop, 0.02)
    
    // Update uniforms
    meshRef.current.material.uniforms.uColorBottom.value = colorsRef.current.bottom
    meshRef.current.material.uniforms.uColorTop.value = colorsRef.current.top
  })
  
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uColorBottom: { value: new THREE.Color('#1a1a2e') },
      uColorTop: { value: new THREE.Color('#4a4a6a') },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColorBottom;
      uniform vec3 uColorTop;
      varying vec2 vUv;
      
      void main() {
        float mixFactor = smoothstep(0.0, 1.0, vUv.y);
        vec3 color = mix(uColorBottom, uColorTop, mixFactor);
        
        // Subtle vignette
        vec2 center = vUv - 0.5;
        float vignette = 1.0 - dot(center, center) * 0.5;
        color *= vignette;
        
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    depthWrite: false,
  }), [])
  
  return (
    <mesh ref={meshRef} position={[0, 0, -20]} material={material}>
      <planeGeometry args={[viewport.width * 4, viewport.height * 4]} />
    </mesh>
  )
}

// Animated material that moves vertices in shader
function createAnimatedMaterial(color, options = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: options.opacity ?? 1.0 },
    },
    vertexShader: `
      uniform float uTime;
      
      float hash(float n) {
        return fract(sin(n) * 43758.5453123);
      }
      
      void main() {
        float id = float(gl_InstanceID);
        float phase = hash(id) * 6.28318;
        float speed = 0.2 + hash(id + 100.0) * 0.3;
        
        float time = uTime * speed + phase;
        
        // Gentle wobble
        float wobbleX = sin(time * 0.15) * 0.2;
        float wobbleY = sin(time * 0.1) * 0.1;
        float wobbleZ = cos(time * 0.12) * 0.2;
        
        vec4 instancePos = instanceMatrix * vec4(position, 1.0);
        instancePos.x += wobbleX;
        instancePos.y += wobbleY;
        instancePos.z += wobbleZ;
        
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
  })
}

// Senora material with texture support
function createSenoraMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uMap: { value: texture },
    },
    vertexShader: `
      uniform float uTime;
      
      varying vec2 vUv;
      
      float hash(float n) {
        return fract(sin(n) * 43758.5453123);
      }
      
      void main() {
        vUv = uv;
        
        float id = float(gl_InstanceID);
        float phase = hash(id) * 6.28318;
        float speed = 0.2 + hash(id + 100.0) * 0.3;
        
        float time = uTime * speed + phase;
        
        float wobbleX = sin(time * 0.15) * 0.2;
        float wobbleY = sin(time * 0.1) * 0.1;
        float wobbleZ = cos(time * 0.12) * 0.2;
        
        vec4 instancePos = instanceMatrix * vec4(position, 1.0);
        instancePos.x += wobbleX;
        instancePos.y += wobbleY;
        instancePos.z += wobbleZ;
        
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

// Flame material with color gradient
function createFlameMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      
      varying float vHeight;
      varying float vPhase;
      
      float hash(float n) {
        return fract(sin(n) * 43758.5453123);
      }
      
      void main() {
        float id = float(gl_InstanceID);
        float phase = hash(id) * 6.28318;
        float speed = 0.2 + hash(id + 100.0) * 0.3;
        vPhase = hash(id + 300.0) * 6.28318;
        
        // Height for color gradient
        vHeight = clamp(position.y / 0.5, 0.0, 1.0);
        
        vec3 pos = position;
        
        // Flame sway
        float flameTime = uTime * 0.5 + vPhase;
        pos.x += sin(flameTime * 0.8) * 0.01 * vHeight * vHeight;
        pos.z += cos(flameTime * 0.6) * 0.008 * vHeight * vHeight;
        
        float time = uTime * speed + phase;
        
        // Cloud wobble (matches other parts)
        float wobbleX = sin(time * 0.15) * 0.2;
        float wobbleY = sin(time * 0.1) * 0.1;
        float wobbleZ = cos(time * 0.12) * 0.2;
        
        vec4 instancePos = instanceMatrix * vec4(pos, 1.0);
        instancePos.x += wobbleX;
        instancePos.y += wobbleY;
        instancePos.z += wobbleZ;
        
        gl_Position = projectionMatrix * modelViewMatrix * instancePos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying float vHeight;
      varying float vPhase;
      
      void main() {
        float time = uTime + vPhase;
        
        vec3 baseColor = vec3(1.0, 0.3, 0.0);
        vec3 tipColor = vec3(1.0, 0.9, 0.3);
        vec3 color = mix(baseColor, tipColor, vHeight);
        
        // Hot core
        float core = smoothstep(0.3, 0.0, vHeight);
        color = mix(color, vec3(1.0, 1.0, 0.9), core * 0.5);
        
        float pulse = sin(time * 3.0) * 0.1 + 1.0;
        float alpha = (1.0 - vHeight * 0.4) * pulse;
        
        gl_FragColor = vec4(color * 2.0 * pulse, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
}

// Extract and CLONE all geometries from GLB, including local transforms
function useClonedGeometries(modelPath) {
  const { scene } = useGLTF(modelPath)
  
  return useMemo(() => {
    const geometries = {}
    const textures = {}
    const localMatrices = {}
    
    console.log('=== Loading candle model ===')
    scene.updateWorldMatrix(true, false)
    const rootInverse = new THREE.Matrix4().copy(scene.matrixWorld).invert()
    
    scene.traverse((child) => {
      if (child.isMesh) {
        console.log('Found mesh:', child.name, 'Geometry:', child.geometry, 'Material:', child.material?.name)
      }
      if (!child.isMesh) return
      
      const name = child.name.toLowerCase()
      let key = null
      
      if (name.includes('xbase') || name.includes('base')) {
        key = 'xbase'
      } else if (name.includes('glass')) {
        key = 'glass'
      } else if (name.includes('wick')) {
        key = 'wick'
      } else if (name.includes('senora')) {
        key = 'senora'
        if (child.material?.map) {
          textures.senora = child.material.map
        }
      } else if (name.includes('flame')) {
        key = 'flame'
      }
      
      if (key) {
        const clonedGeometry = child.geometry.clone()
        // Ensure bounding sphere is computed for raycasting
        clonedGeometry.computeBoundingSphere()
        clonedGeometry.computeBoundingBox()
        geometries[key] = clonedGeometry
        child.updateWorldMatrix(true, false)
        localMatrices[key] = new THREE.Matrix4().copy(child.matrixWorld).premultiply(rootInverse)
        console.log(`Stored ${key} geometry with bounds:`, clonedGeometry.boundingSphere)
      }
    })
    
    return { geometries, textures, localMatrices }
  }, [scene])
}

function usePositions(count) {
  return useMemo(() => {
    const positions = []
    for (let i = 0; i < count; i++) {
      positions.push({
        x: (Math.random() - 0.5) * 40,
        y: (Math.random() - 0.5) * 15,
        z: (Math.random() - 0.5) * 20 - 5,
        rotation: Math.random() * Math.PI * 2,
      })
    }
    return positions
  }, [count])
}

function InstancedPart({ geometry, material, positions, localMatrix, scale = 0.5, timeRef, priceRef, maxCount, onCandleClick }) {
  const meshRef = useRef()
  const actualCount = positions.length
  const capacity = maxCount || actualCount
  const [hovered, setHovered] = useState(false)
  
  // Recalculate base matrices when positions change
  const baseMatrices = useMemo(() => {
    const matrices = []
    const tempMatrix = new THREE.Matrix4()
    const tempPosition = new THREE.Vector3()
    const tempQuaternion = new THREE.Quaternion()
    const tempScale = new THREE.Vector3(scale, scale, scale)
    const hiddenMatrix = new THREE.Matrix4().makeTranslation(0, -10000, 0) // Hide unused
    
    for (let i = 0; i < capacity; i++) {
      if (i < positions.length) {
        const pos = positions[i]
        tempPosition.set(pos.x, pos.y, pos.z)
        tempQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), pos.rotation)
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
  
  // Set up dynamic usage once
  useEffect(() => {
    if (!meshRef.current) return
    meshRef.current.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  }, [])
  
  // Animate every frame
  useFrame(() => {
    if (!meshRef.current) return
    
    const time = timeRef.current
    const priceDirection = priceRef.current
    const tempMatrix = new THREE.Matrix4()
    
    for (let i = 0; i < actualCount; i++) {
      const pos = positions[i]
      const phase = pos.x * 0.1 + pos.y * 0.2 + pos.z * 0.15
      const speed = 0.5 + Math.abs(Math.sin(pos.x * 0.5)) * 0.3
      const t = time * speed + phase
      
      const priceResponse = 0.7 + Math.abs(Math.sin(pos.x * 0.3 + pos.z * 0.2)) * 0.6
      
      const offsetX = Math.sin(t * 0.4) * 0.3
      const offsetY = Math.sin(t * 0.3) * 0.2 + priceDirection * 3.0 * priceResponse
      const offsetZ = Math.cos(t * 0.35) * 0.3
      
      tempMatrix.copy(baseMatrices[i])
      tempMatrix.elements[12] += offsetX
      tempMatrix.elements[13] += offsetY
      tempMatrix.elements[14] += offsetZ
      
      meshRef.current.setMatrixAt(i, tempMatrix)
    }
    
    // Hide any unused slots
    const hiddenMatrix = new THREE.Matrix4().makeTranslation(0, -10000, 0)
    for (let i = actualCount; i < capacity; i++) {
      meshRef.current.setMatrixAt(i, hiddenMatrix)
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true
  })
  
  if (!geometry) return null
  
  // Enable cursor change on hover
  useEffect(() => {
    if (hovered && typeof document !== 'undefined') {
      document.body.style.cursor = 'pointer'
    } else if (typeof document !== 'undefined') {
      document.body.style.cursor = 'auto'
    }
  }, [hovered])

  // Debug log on mount and ensure matrices are initialized
  useEffect(() => {
    if (meshRef.current && geometry) {
      console.log(`InstancedMesh created for ${material.type || 'unknown'} with ${actualCount} instances, capacity ${capacity}`)
      console.log('Geometry bounds:', geometry.boundingBox, geometry.boundingSphere)
      
      // Initialize instance matrices for raycasting to work
      const tempMatrix = new THREE.Matrix4()
      for (let i = 0; i < capacity; i++) {
        if (i < actualCount) {
          tempMatrix.copy(baseMatrices[i])
        } else {
          tempMatrix.makeTranslation(0, -10000, 0) // Hide unused instances
        }
        meshRef.current.setMatrixAt(i, tempMatrix)
      }
      meshRef.current.instanceMatrix.needsUpdate = true
      meshRef.current.computeBoundingSphere() // Important for raycasting
    }
  }, [geometry, actualCount, capacity, material, baseMatrices])

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, capacity]}
      frustumCulled={false}
      onPointerOver={(event) => {
        event.stopPropagation()
        console.log('Hovering over candle instance:', event.instanceId)
        setHovered(true)
      }}
      onPointerOut={(event) => {
        event.stopPropagation()
        setHovered(false)
      }}
      onClick={(event) => {
        event.stopPropagation()
        console.log('InstancedPart clicked - instanceId:', event.instanceId, 'Material:', material)
        if (onCandleClick && event.instanceId !== undefined) {
          const instanceId = event.instanceId
          if (instanceId < positions.length) {
            onCandleClick(instanceId, positions[instanceId])
          }
        }
      }}
    />
  )
}

export function CandleCloud({ count = CANDLE_COUNT, priceDirection = 0, additionalCandles = [], onCandleClick, clickedCandleId }) {
  const { geometries, textures, localMatrices } = useClonedGeometries('/models/tinyVotiveOnly.glb')
  const basePositions = usePositions(count)
  const timeRef = useRef(0)
  const priceRef = useRef(priceDirection)
  
  // Combine base positions with additional candles
  const positions = useMemo(() => {
    const additional = additionalCandles.map(c => ({
      x: c.position[0],
      y: c.position[1],
      z: c.position[2],
      rotation: c.rotation || Math.random() * Math.PI * 2
    }))
    return [...basePositions, ...additional]
  }, [basePositions, additionalCandles])
  
  // Update priceRef when prop changes
  useEffect(() => {
    priceRef.current = priceDirection
  }, [priceDirection])
  
  // Create simple materials - only flame gets a shader
  const flameMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uClickedId: { value: -1 }, // ID of clicked candle for purple glow
    },
    vertexShader: `
      precision highp float;
      uniform float uTime;
      attribute float instanceId;
      
      varying float vHeight;
      varying float vPhase;
      varying float vInstanceId;
      
      float hash(float n) {
        return fract(sin(n) * 43758.5453123);
      }
      
      void main() {
        float id = float(gl_InstanceID);
        vInstanceId = float(gl_InstanceID);
        vPhase = hash(id) * 6.28318;
        
        // Height normalized 0-1
        vHeight = clamp((position.y + 0.1) / 0.6, 0.0, 1.0);
        
        // Flame flicker animation - MORE DRAMATIC
        float flameTime = uTime * 3.0 + vPhase;
        vec3 pos = position;
        
        // Strong sway side to side
        float sway = sin(flameTime * 1.5) * 0.06 * vHeight * vHeight;
        sway += sin(flameTime * 2.3) * 0.03 * vHeight; // secondary wobble
        pos.x += sway;
        
        // Flicker height - makes flame "dance"
        float flicker = sin(flameTime * 2.0) * 0.04 * vHeight;
        flicker += sin(flameTime * 3.7) * 0.02 * vHeight * vHeight;
        pos.y += flicker;
        
        // Z wobble too
        pos.z += cos(flameTime * 1.8) * 0.04 * vHeight * vHeight;
        
        // Taper at top - flame gets thinner
        float taper = 1.0 - vHeight * 0.5;
        pos.x *= taper;
        pos.z *= taper;
        
        // Stretch vertically when flickering up
        float stretch = 1.0 + sin(flameTime * 2.5) * 0.1 * vHeight;
        pos.y *= stretch;
        
        vec4 instancePos = instanceMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * instancePos;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uTime;
      uniform float uClickedId;
      varying float vHeight;
      varying float vPhase;
      varying float vInstanceId;
      
      void main() {
        float time = uTime * 3.0 + vPhase;
        
        // Check if this is the clicked candle - more lenient matching
        bool isClicked = false;
        if (uClickedId >= 0.0) {
          // Check if this instance matches the clicked ID
          float diff = abs(uClickedId - vInstanceId);
          isClicked = (diff < 1.0);
        }
        
        // Base flame colors
        vec3 innerColor = vec3(1.0, 0.95, 0.8);   // Hot white center
        vec3 midColor = vec3(1.0, 0.5, 0.0);      // Orange
        vec3 outerColor = vec3(1.0, 0.2, 0.0);    // Deep red-orange
        
        // Purple glow colors for clicked candle - more dramatic
        vec3 purpleInner = vec3(1.0, 0.0, 1.0);   // Bright magenta
        vec3 purpleMid = vec3(0.8, 0.0, 1.0);     // Deep purple
        vec3 purpleOuter = vec3(0.6, 0.0, 1.0);   // Purple
        
        vec3 color;
        if (isClicked) {
          // Purple flame for clicked candle
          if (vHeight < 0.3) {
            color = mix(purpleInner, purpleMid, vHeight / 0.3);
          } else if (vHeight < 0.7) {
            color = mix(purpleMid, purpleOuter, (vHeight - 0.3) / 0.4);
          } else {
            color = mix(purpleOuter, vec3(0.8, 0.4, 1.0), (vHeight - 0.7) / 0.3);
          }
        } else {
          // Normal flame colors
          if (vHeight < 0.3) {
            color = mix(innerColor, midColor, vHeight / 0.3);
          } else if (vHeight < 0.7) {
            color = mix(midColor, outerColor, (vHeight - 0.3) / 0.4);
          } else {
            color = mix(outerColor, vec3(1.0, 0.8, 0.0), (vHeight - 0.7) / 0.3);
          }
        }
        
        // Rapid flicker intensity
        float flicker = sin(time * 4.0) * 0.25 + sin(time * 9.0) * 0.15 + 1.0;
        
        // Much brighter intensity for clicked candle
        float intensity = isClicked ? 8.0 * flicker : 3.5 * flicker;
        
        // Alpha: solid at bottom, fade at top with flicker
        float alpha = 1.0 - vHeight * 0.5;
        alpha *= (0.8 + flicker * 0.2);
        
        gl_FragColor = vec4(color * intensity, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  }), [])
  
  // Create XBase material with purple glow effect
  const xbaseMaterial = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uClickedId: { value: -1 },
      uBaseColor: { value: new THREE.Color('#8bec03') },
      uGlowColor: { value: new THREE.Color('#ff00ff') }
    },
    vertexShader: `
      precision highp float;
      varying float vInstanceId;
      
      void main() {
        vInstanceId = float(gl_InstanceID);
        vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform vec3 uBaseColor;
      uniform vec3 uGlowColor;
      uniform float uClickedId;
      uniform float uTime;
      varying float vInstanceId;
      
      void main() {
        // Check if this is the clicked candle
        bool isClicked = false;
        if (uClickedId >= 0.0) {
          float diff = abs(uClickedId - vInstanceId);
          isClicked = (diff < 1.0);
        }
        
        vec3 color = uBaseColor;
        float intensity = 1.0;
        
        if (isClicked) {
          // Pulsing purple glow
          float pulse = sin(uTime * 4.0) * 0.3 + 0.7;
          color = mix(uGlowColor, vec3(1.0, 0.0, 1.0), pulse);
          intensity = 2.0 + sin(uTime * 6.0) * 0.5;
        }
        
        gl_FragColor = vec4(color * intensity, 1.0);
      }
    `,
    side: THREE.FrontSide,
  }), [])

  const materials = useMemo(() => ({
    xbase: xbaseMaterial,
    glass: new THREE.MeshBasicMaterial({ color: '#888888', transparent: true, opacity: 0.3 }),
    wick: new THREE.MeshBasicMaterial({ color: '#222222' }),
    senora: new THREE.MeshBasicMaterial({ map: textures.senora, transparent: true, side: THREE.DoubleSide }),
    flame: flameMaterial,
  }), [textures, flameMaterial, xbaseMaterial])
  
  // Update clicked candle ID in both flame and xbase materials
  useEffect(() => {
    const idToSet = clickedCandleId !== null ? clickedCandleId : -1
    
    if (flameMaterial.uniforms) {
      flameMaterial.uniforms.uClickedId.value = idToSet
    }
    
    if (xbaseMaterial.uniforms) {
      xbaseMaterial.uniforms.uClickedId.value = idToSet
    }
    
    console.log('Setting clicked candle ID in shaders:', idToSet)
  }, [clickedCandleId, flameMaterial, xbaseMaterial])
  
  // Update time ref for all animations
  useFrame((state) => {
    timeRef.current = state.clock.elapsedTime
    if (flameMaterial.uniforms) {
      flameMaterial.uniforms.uTime.value = state.clock.elapsedTime
    }
    if (xbaseMaterial.uniforms) {
      xbaseMaterial.uniforms.uTime.value = state.clock.elapsedTime
    }
  })
  
  const maxCount = CANDLE_COUNT + MAX_ADDITIONAL
  
  // Log what geometries we have
  useEffect(() => {
    console.log('Available geometries:', Object.keys(geometries))
    console.log('Glass geometry:', geometries.glass)
  }, [geometries])

  return (
    <group>
      {/* All parts should be clickable */}
      <InstancedPart geometry={geometries.xbase} material={materials.xbase} positions={positions} localMatrix={localMatrices.xbase} timeRef={timeRef} priceRef={priceRef} maxCount={maxCount} onCandleClick={onCandleClick} />
      <InstancedPart geometry={geometries.wick} material={materials.wick} positions={positions} localMatrix={localMatrices.wick} timeRef={timeRef} priceRef={priceRef} maxCount={maxCount} onCandleClick={onCandleClick} />
      <InstancedPart geometry={geometries.senora} material={materials.senora} positions={positions} localMatrix={localMatrices.senora} timeRef={timeRef} priceRef={priceRef} maxCount={maxCount} onCandleClick={onCandleClick} />
      <InstancedPart geometry={geometries.flame} material={materials.flame} positions={positions} localMatrix={localMatrices.flame} timeRef={timeRef} priceRef={priceRef} maxCount={maxCount} onCandleClick={onCandleClick} />
      {/* Glass last for click priority */}
      <InstancedPart geometry={geometries.glass} material={materials.glass} positions={positions} localMatrix={localMatrices.glass} timeRef={timeRef} priceRef={priceRef} maxCount={maxCount} onCandleClick={onCandleClick} />
    </group>
  )
}

useGLTF.preload('/models/tinyVotiveOnly.glb')

// Demo price simulator component
export function PriceSimulator({ onPriceChange }) {
  useFrame((state) => {
    // Simulate price movement: slow wave with occasional spikes
    const t = state.clock.elapsedTime
    const baseWave = Math.sin(t * 0.2) * 0.5
    const spike = Math.sin(t * 0.7) * Math.sin(t * 0.3) * 0.3
    const price = baseWave + spike
    onPriceChange(price)
  })
  return null
}

export default function CandleShrine({ offerings = [], onSelectOffering, onLightCandle, onPriceChange, is80sMode }) {
  const [priceDirection, setPriceDirection] = useState(0)
  const [additionalCandles, setAdditionalCandles] = useState([])
  const pricePercent = (priceDirection * 5).toFixed(2) // Convert to percentage
  const effectManagerRef = useRef()
  const [clickedCandleId, setClickedCandleId] = useState(null) // Track which candle was clicked
  
  const handleNewCandle = (position, offering) => {
    console.log('New candle added at:', position)
    setAdditionalCandles(prev => [...prev, {
      position,
      offering,
      id: Date.now(),
      rotation: Math.random() * Math.PI * 2
    }])
  }
  
  const triggerNewCandle = () => {
    if (effectManagerRef.current) {
      effectManagerRef.current.triggerEffect({ name: 'Test User', type: 'petition' })
    }
  }
  
  const handleCandleClick = (instanceId, position) => {
    console.log('Candle clicked:', instanceId, position)
    
    // Set the clicked candle ID for visual feedback
    setClickedCandleId(instanceId)
    
    // Clear the glow after 2 seconds
    setTimeout(() => {
      setClickedCandleId(null)
    }, 2000)
    
    // Select a random offering to display on phone screen
    if (offerings && offerings.length > 0) {
      const randomIndex = Math.floor(Math.random() * offerings.length)
      const selectedOffering = offerings[randomIndex]
      console.log('Selected offering:', selectedOffering)
      if (onSelectOffering) {
        onSelectOffering(selectedOffering)
      }
    }
  }
  
  return (
    <div style={{ width: '100%', height: '100vh', background: '#000', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 0, 15], fov: 60 }}
        dpr={2}
        gl={{ 
          antialias: true,
          powerPreference: "high-performance",
        }}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <GradientBackground priceDirection={priceDirection} />
        <CandleCloud count={CANDLE_COUNT} priceDirection={priceDirection} additionalCandles={additionalCandles} onCandleClick={handleCandleClick} clickedCandleId={clickedCandleId} />
        <PriceSimulator onPriceChange={(price) => {
          setPriceDirection(price)
          if (onPriceChange) {
            onPriceChange(price * 5) // Convert to percentage
          }
        }} />
        <NewCandleEffectManager
          ref={effectManagerRef}
          phonePosition={[0, -3, 5]}
          cloudBounds={{ x: 20, y: 10, z: 10 }}
          onNewCandle={handleNewCandle}
          candleModelPath="/models/tinyVotiveOnly.glb"
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
      
      {/* Stats overlay */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: '12px',
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
      
      {/* Light a candle button */}
      <button
        onClick={triggerNewCandle}
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          background: 'linear-gradient(135deg, #00ff66 0%, #00aa44 100%)',
          border: 'none',
          borderRadius: '8px',
          padding: '16px 32px',
          color: '#000',
          fontFamily: 'monospace',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 0 30px rgba(0, 255, 100, 0.4)',
        }}
      >
        🕯️ Light a Candle
      </button>
      
      {/* Test button to trigger candle click */}
      <button
        onClick={() => {
          // Simulate clicking on candle with ID 10
          handleCandleClick(10, { x: 0, y: 0, z: 0 })
        }}
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          background: 'linear-gradient(135deg, #aa66ff 0%, #6633cc 100%)',
          border: 'none',
          borderRadius: '8px',
          padding: '16px 32px',
          color: '#fff',
          fontFamily: 'monospace',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 0 30px rgba(170, 102, 255, 0.4)',
          zIndex: 1000
        }}
      >
        🔮 Test Candle Click
      </button>
    </div>
  )
}