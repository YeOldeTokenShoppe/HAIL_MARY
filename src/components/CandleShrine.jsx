import React, { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { NewCandleEffectManager } from './NewCandleEffect'

const CANDLE_COUNT = 500
const MAX_ADDITIONAL = 100

// Shared time uniform - all materials reference this single object
const sharedUniforms = {
  uTime: { value: 0 },
  uClickedId: { value: -1 },
  uPriceDirection: { value: 0 },
}

// Base vertex shader chunk for candle wobble - reused across all materials
const wobbleVertexChunk = `
  uniform float uTime;
  uniform float uPriceDirection;
  
  // Fast hash function
  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }
  
  // Calculate wobble offset for a candle instance
  vec3 getWobbleOffset(float instanceId, vec3 basePosition) {
    float phase = hash(instanceId) * 6.28318;
    float speed = 0.2 + hash(instanceId + 100.0) * 0.3;
    float priceResponse = 0.7 + abs(sin(instanceId * 0.3)) * 0.6;
    
    float t = uTime * speed + phase;
    
    // Smooth floating motion
    float offsetX = sin(t * 0.4) * 0.3;
    float offsetY = sin(t * 0.3) * 0.2 + uPriceDirection * 3.0 * priceResponse;
    float offsetZ = cos(t * 0.35) * 0.3;
    
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
  })
}

// XBase material with click glow effect
function createXBaseMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...sharedUniforms,
      uBaseColor: { value: new THREE.Color('#8bec03') },
      uGlowColor: { value: new THREE.Color('#ff00ff') },
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
      uniform vec3 uGlowColor;
      uniform float uClickedId;
      uniform float uTime;
      varying float vInstanceId;
      
      void main() {
        bool isClicked = uClickedId >= 0.0 && abs(uClickedId - vInstanceId) < 1.0;
        
        vec3 color = uBaseColor;
        float intensity = 1.0;
        
        if (isClicked) {
          float pulse = sin(uTime * 4.0) * 0.3 + 0.7;
          color = mix(uGlowColor, vec3(1.0, 0.0, 1.0), pulse);
          intensity = 2.0 + sin(uTime * 6.0) * 0.5;
        }
        
        gl_FragColor = vec4(color * intensity, 1.0);
      }
    `,
    side: THREE.FrontSide,
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
        
        // Height normalized 0-1
        vHeight = clamp((position.y + 0.1) / 0.6, 0.0, 1.0);
        
        // Flame flicker animation
        float flameTime = uTime * 3.0 + vPhase;
        vec3 pos = position;
        
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
    depthWrite: false,
    toneMapped: false,
  })
}

// Extract geometries from GLB
function useClonedGeometries(modelPath) {
  const { scene } = useGLTF(modelPath)
  
  return useMemo(() => {
    const geometries = {}
    const textures = {}
    const localMatrices = {}
    
    scene.updateWorldMatrix(true, false)
    const rootInverse = new THREE.Matrix4().copy(scene.matrixWorld).invert()
    
    scene.traverse((child) => {
      if (!child.isMesh) return
      
      const name = child.name.toLowerCase()
      let key = null
      
      if (name.includes('xbase') || name.includes('base')) key = 'xbase'
      else if (name.includes('glass')) key = 'glass'
      else if (name.includes('wick')) key = 'wick'
      else if (name.includes('senora')) {
        // Skip senora mesh - we don't want to include it in clones
        return
      }
      else if (name.includes('flame')) key = 'flame'
      
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

// Generate random positions
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

// Simplified InstancedPart - NO per-frame matrix updates!
function InstancedPart({ geometry, material, positions, localMatrix, scale = 0.5, maxCount, onCandleClick }) {
  const meshRef = useRef()
  const actualCount = positions.length
  const capacity = maxCount || actualCount
  
  // Calculate static base matrices ONCE
  const baseMatrices = useMemo(() => {
    const matrices = []
    const tempMatrix = new THREE.Matrix4()
    const tempPosition = new THREE.Vector3()
    const tempQuaternion = new THREE.Quaternion()
    const tempScale = new THREE.Vector3(scale, scale, scale)
    const hiddenMatrix = new THREE.Matrix4().makeTranslation(0, -10000, 0)
    
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
  
  // Set matrices ONCE on mount or when positions change
  useEffect(() => {
    if (!meshRef.current) return
    
    for (let i = 0; i < capacity; i++) {
      meshRef.current.setMatrixAt(i, baseMatrices[i])
    }
    meshRef.current.instanceMatrix.needsUpdate = true
    meshRef.current.computeBoundingSphere()
  }, [baseMatrices, capacity])
  
  if (!geometry) return null
  
  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, capacity]}
      frustumCulled={false}
      onClick={(event) => {
        event.stopPropagation()
        if (onCandleClick && event.instanceId !== undefined && event.instanceId < positions.length) {
          onCandleClick(event.instanceId, positions[event.instanceId])
        }
      }}
    />
  )
}

// Single animation controller - updates shared uniforms once per frame
// Accepts either a ref (for smooth updates) or a value (for static/slow updates)
function AnimationController({ priceDirection, priceRef, isMobile }) {
  const frameCount = useRef(0)
  
  useFrame((state) => {
    frameCount.current++
    
    // On mobile, only update animations every 3 frames
    if (isMobile && frameCount.current % 3 !== 0) return
    
    sharedUniforms.uTime.value = state.clock.elapsedTime
    // Prefer ref for smooth animation, fall back to prop
    sharedUniforms.uPriceDirection.value = priceRef?.current ?? priceDirection ?? 0
  })
  return null
}

export function CandleCloud({ count = CANDLE_COUNT, priceDirection = 0, priceRef, additionalCandles = [], onCandleClick, clickedCandleId, isMobile = false }) {
  const { geometries, textures, localMatrices } = useClonedGeometries('/models/tinyVotiveOnly.glb')
  const basePositions = usePositions(count)
  
  // Combine positions
  const positions = useMemo(() => {
    const additional = additionalCandles.map(c => ({
      x: c.position[0],
      y: c.position[1],
      z: c.position[2],
      rotation: c.rotation || Math.random() * Math.PI * 2
    }))
    return [...basePositions, ...additional]
  }, [basePositions, additionalCandles])
  
  // Create materials ONCE
  const materials = useMemo(() => ({
    xbase: createXBaseMaterial(),
    glass: createWobbleMaterial('#888888', { transparent: true, opacity: 0.3 }),
    wick: createWobbleMaterial('#222222'),
    flame: createFlameMaterial(),
  }), [textures])
  
  // Update clicked ID in shared uniforms
  useEffect(() => {
    sharedUniforms.uClickedId.value = clickedCandleId ?? -1
  }, [clickedCandleId])
  
  const maxCount = CANDLE_COUNT + MAX_ADDITIONAL

  return (
    <group>
      {/* Single animation controller for ALL parts - uses ref for smooth updates */}
      <AnimationController priceDirection={priceDirection} priceRef={priceRef} isMobile={isMobile} />
      
      <InstancedPart geometry={geometries.xbase} material={materials.xbase} positions={positions} localMatrix={localMatrices.xbase} maxCount={maxCount} onCandleClick={onCandleClick} />
      <InstancedPart geometry={geometries.wick} material={materials.wick} positions={positions} localMatrix={localMatrices.wick} maxCount={maxCount} onCandleClick={onCandleClick} />
      <InstancedPart geometry={geometries.flame} material={materials.flame} positions={positions} localMatrix={localMatrices.flame} maxCount={maxCount} onCandleClick={onCandleClick} />
      <InstancedPart geometry={geometries.glass} material={materials.glass} positions={positions} localMatrix={localMatrices.glass} maxCount={maxCount} onCandleClick={onCandleClick} />
    </group>
  )
}

// Scene setup and gradient background unchanged
export function SceneSetup({ is80sMode }) {
  const { scene } = useThree()
  
  useEffect(() => {
    scene.background = is80sMode ? null : new THREE.Color(0x000000)
  }, [is80sMode, scene])
  
  return null
}

export function GradientBackground({ priceDirection = 0, is80sMode = false }) {
  const meshRef = useRef()
  const { viewport } = useThree()
  
  const colorsRef = useRef({
    bottom: new THREE.Color('#1a1a2e'),
    top: new THREE.Color('#4a4a6a'),
  })
  
  useFrame(() => {
    if (!meshRef.current) return
    
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
    
    colorsRef.current.bottom.lerp(targetBottom, 0.02)
    colorsRef.current.top.lerp(targetTop, 0.02)
    
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
        vec2 center = vUv - 0.5;
        float vignette = 1.0 - dot(center, center) * 0.5;
        color *= vignette;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    depthWrite: false,
  }), [])
  
  if (is80sMode) return null
  
  return (
    <mesh ref={meshRef} position={[0, 0, -20]} material={material}>
      <planeGeometry args={[viewport.width * 4, viewport.height * 4]} />
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

useGLTF.preload('/models/tinyVotiveOnly.glb')

export default function CandleShrine({ offerings = [], onSelectOffering, onLightCandle, onPriceChange, is80sMode }) {
  const [priceDirection, setPriceDirection] = useState(0)
  const [additionalCandles, setAdditionalCandles] = useState([])
  const pricePercent = (priceDirection * 5).toFixed(2)
  const effectManagerRef = useRef()
  const [clickedCandleId, setClickedCandleId] = useState(null)
  
  const handleNewCandle = (position, offering) => {
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
    setClickedCandleId(instanceId)
    setTimeout(() => setClickedCandleId(null), 2000)
    
    if (offerings?.length > 0 && onSelectOffering) {
      const randomIndex = Math.floor(Math.random() * offerings.length)
      onSelectOffering(offerings[randomIndex])
    }
  }
  
  return (
    <div style={{ width: '100%', height: '100vh', background: '#000', position: 'relative' }}>
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
          additionalCandles={additionalCandles} 
          onCandleClick={handleCandleClick} 
          clickedCandleId={clickedCandleId} 
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
          zIndex: 3,
        }}
      >
        🕯️ Light a Candle
      </button>
    </div>
  )
}