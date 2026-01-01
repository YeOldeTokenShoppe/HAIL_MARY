import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom, BrightnessContrast } from '@react-three/postprocessing'
import * as THREE from 'three'
import { NewCandleEffectManager } from './Newcandleeffect'

// Preload the candle model
useGLTF.preload('/models/tinyVotiveOnly.glb')

// ============================================
// CONFIG
// ============================================
const CANDLE_COUNT = 500
const SPREAD = { x: 40, y: 20, z: 15 }  // Increased spread for better distribution with more candles

// Movement config - target-based instead of additive drift
const PRICE_OFFSET_MAX = 10 // Max vertical offset when price is at extreme - increased for more noticeable movement
const DRIFT_SPEED = 0.5 // How fast candles move toward their target
const WOBBLE_SPEED = 0.3
const WOBBLE_AMOUNT = 0.03

// ============================================
// PRICE STATE QUANTIZER
// Returns discrete state to prevent constant re-renders
// ============================================
function quantizePriceState(priceDirection) {
  if (priceDirection < -0.6) return 'STRONG_DOWN'
  if (priceDirection < -0.2) return 'DOWN'
  if (priceDirection < 0.2) return 'NEUTRAL'
  if (priceDirection < 0.6) return 'UP'
  return 'STRONG_UP'
}

// ============================================
// CANDLE GEOMETRY - Using GLTF Model
// ============================================
function CandleGeometry({ isHovered, isClicked }) {
  const { scene } = useGLTF('/models/tinyVotiveOnly.glb')
  const { camera } = useThree()
  const labelRef = useRef()
  const groupRef = useRef()
  
  const clonedScene = useMemo(() => scene.clone(true), [scene])
  
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh && child.name.toLowerCase().includes('senora')) {
        labelRef.current = child
      }
    })
  }, [clonedScene])
  
  useFrame(() => {
    if (labelRef.current) {
      if (!labelRef.current.userData.initialRotation) {
        labelRef.current.userData.initialRotation = labelRef.current.rotation.y
      }
      
      const parentWorldQuaternion = new THREE.Quaternion()
      if (labelRef.current.parent) {
        labelRef.current.parent.getWorldQuaternion(parentWorldQuaternion)
      }
      
      const euler = new THREE.Euler().setFromQuaternion(parentWorldQuaternion)
      const parentRotationY = euler.y
      
      labelRef.current.rotation.y = -parentRotationY + labelRef.current.userData.initialRotation
    }
  })
  
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone()
        
        const meshName = child.name.toLowerCase()
        
        if (meshName.includes('xbase')) {
          child.material.emissive = new THREE.Color('#8bec03')
          child.material.emissiveIntensity = isClicked ? 1.5 : isHovered ? 1.2 : 1.0
        } else if (meshName.includes('senora')) {
          if (!child.material.emissive) {
            child.material.emissive = new THREE.Color('#ffffff')
          }
          child.material.emissiveIntensity = isClicked ? 1.8 : isHovered ? 1.5 : 1.2
          child.material.toneMapped = false
        } else if (meshName.includes('glass')) {
          child.material.emissive = new THREE.Color('#000000')
          child.material.emissiveIntensity = 0
          if (child.material.transparent !== undefined) {
            child.material.transparent = true
            child.material.opacity = child.material.opacity || 0.3
          }
        } else if (meshName.includes('flame') || meshName.includes('wick') || meshName.includes('fire')) {
          child.material.emissive = new THREE.Color('#ffaa00')
          child.material.emissiveIntensity = isClicked ? 3.0 : isHovered ? 2.5 : 2.0
          child.material.toneMapped = false
        }
        
        child.material.needsUpdate = true
      }
    })
  }, [clonedScene, isHovered, isClicked])
  
  const scale = isClicked ? 0.6 : isHovered ? 0.55 : 0.5
  
  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} scale={[scale, scale, scale]} />
      {/* Point light disabled for performance with many candles */}
      {/* Only add lights for hovered/clicked candles to stay under uniform limit */}
      {(isHovered || isClicked) && (
        <pointLight 
          position={[0, 0.3, 0]} 
          color={isClicked ? "#ffffff" : "#ffe8dd"} 
          intensity={isClicked ? 0.4 : 0.25} 
          distance={3} 
        />
      )}
    </group>
  )
}

// ============================================
// SINGLE CANDLE - TARGET-BASED MOVEMENT
// ============================================
function Candle({ index, homePosition, priceDirection, onHover, onUnhover, onClick }) {
  const ref = useRef()
  const [isHovered, setIsHovered] = useState(false)
  const [isClicked, setIsClicked] = useState(false)
  
  // Track if this is a newly added candle for smooth integration
  const integrationProgress = useRef(0)
  const isNewCandle = useRef(true)
  
  // Per-candle random values (stable across renders)
  const randomValues = useMemo(() => ({
    speed: 0.3 + Math.random() * 0.7,
    phase: Math.random() * Math.PI * 2,
    wobbleX: 0.02 + Math.random() * 0.03,
    wobbleZ: 0.02 + Math.random() * 0.03,
    // Individual offset multiplier so candles don't all move the same amount
    offsetMultiplier: 0.7 + Math.random() * 0.6,
    // Slight delay in following price (staggered response)
    responseDelay: Math.random() * 0.5,
  }), [])
  
  // Store current position for smooth interpolation
  const currentPos = useRef(new THREE.Vector3(...homePosition))
  
  useFrame((state, delta) => {
    if (!ref.current) return
    
    // Smoothly integrate new candles over 2 seconds
    if (isNewCandle.current) {
      integrationProgress.current = Math.min(1, integrationProgress.current + delta / 2)
      if (integrationProgress.current >= 1) {
        isNewCandle.current = false
      }
    }
    
    const time = state.clock.elapsedTime
    const { speed, phase, wobbleX, wobbleZ, offsetMultiplier, responseDelay } = randomValues
    
    // Calculate target position based on price direction
    // For new candles, gradually apply the price offset
    const integrationFactor = isNewCandle.current ? integrationProgress.current : 1
    const priceOffset = priceDirection * PRICE_OFFSET_MAX * offsetMultiplier * integrationFactor
    
    // Give new candles an initial upward boost that fades over time
    const upwardBoost = isNewCandle.current ? (1 - integrationProgress.current) * 1.5 : 0
    
    const targetY = homePosition[1] + priceOffset + upwardBoost
    const targetX = homePosition[0] + Math.sin(time * speed * WOBBLE_SPEED + phase) * wobbleX * 10 * integrationFactor
    const targetZ = homePosition[2] + Math.cos(time * speed * WOBBLE_SPEED * 0.7 + phase) * wobbleZ * 10 * integrationFactor
    
    // Smoothly interpolate toward target (easing)
    // This creates gentle, organic movement instead of snapping
    const lerpFactor = 1 - Math.pow(0.1, delta * DRIFT_SPEED * (1 - responseDelay))
    
    currentPos.current.x += (targetX - currentPos.current.x) * lerpFactor
    currentPos.current.y += (targetY - currentPos.current.y) * lerpFactor
    currentPos.current.z += (targetZ - currentPos.current.z) * lerpFactor
    
    // Apply position
    ref.current.position.copy(currentPos.current)
    
    // Gentle rotation
    ref.current.rotation.y += delta * 0.1 * speed * (isHovered ? 3 : 1)
  })
  
  const handlePointerOver = (e) => {
    e.stopPropagation()
    setIsHovered(true)
    onHover(index, e.point)
    document.body.style.cursor = 'pointer'
  }
  
  const handlePointerOut = () => {
    setIsHovered(false)
    onUnhover()
    document.body.style.cursor = 'default'
  }
  
  const handleClick = (e) => {
    e.stopPropagation()
    setIsClicked(true)
    onClick && onClick(index)
    setTimeout(() => setIsClicked(false), 500)
  }
  
  return (
    <group
      ref={ref}
      position={homePosition}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <CandleGeometry isHovered={isHovered} isClicked={isClicked} />
    </group>
  )
}

// ============================================
// CANDLE CLOUD
// ============================================
function CandleCloud({ priceDirection, offerings, onSelectOffering, additionalCandles = [], newCandleAdded }) {
  const [candleCount, setCandleCount] = useState(CANDLE_COUNT)
  
  // Generate stable home positions for base candles
  const basePositions = useMemo(() => {
    return Array.from({ length: CANDLE_COUNT }, () => [
      (Math.random() - 0.5) * SPREAD.x * 2,
      (Math.random() - 0.5) * SPREAD.y * 1.5, // Slightly less vertical spread
      (Math.random() - 0.5) * SPREAD.z * 2 - 5
    ])
  }, [])
  
  // Combine base positions with additional candles
  const allCandles = useMemo(() => {
    const base = basePositions.map((pos, i) => ({
      position: pos,
      offering: offerings[i % offerings.length],
      id: `base-${i}`
    }))
    const added = additionalCandles.map(candle => ({
      ...candle,
      id: candle.id || `added-${Date.now()}-${Math.random()}`
    }))
    return [...base, ...added]
  }, [basePositions, additionalCandles, offerings])
  
  // Legacy code for old newCandleAdded prop - can be removed later
  const [homePositions, setHomePositions] = useState(basePositions)
  useEffect(() => {
    if (newCandleAdded && newCandleAdded > 0) {
      const side = Math.random() > 0.5 ? 1 : -1
      const newPosition = [
        side * (3 + Math.random() * 2),
        0.5 + Math.random() * 0.5,
        1 + Math.random()
      ]
      setHomePositions(prev => [newPosition, ...prev])
      setCandleCount(prev => prev + 1)
      
      console.log('🕯️ New candle added at position:', newPosition)
    }
  }, [newCandleAdded])
  
  const handleHover = (index, point) => {
    if (offerings && offerings.length > 0) {
      const randomOffering = offerings[Math.floor(Math.random() * offerings.length)]
      onSelectOffering(randomOffering)
    }
  }
  
  const handleUnhover = () => {
    onSelectOffering(null)
  }
  
  const handleClick = (index) => {
    if (offerings && offerings.length > 0) {
      const specialOffering = {
        ...offerings[index % offerings.length],
        message: `✨ Your light has been added to the shrine ✨`
      }
      onSelectOffering(specialOffering)
      setTimeout(() => onSelectOffering(null), 2000)
    }
  }
  
  return (
    <group>
      {allCandles.map((candle, i) => (
        <Candle
          key={candle.id}
          index={i}
          homePosition={candle.position}
          priceDirection={priceDirection}
          onHover={handleHover}
          onUnhover={handleUnhover}
          onClick={handleClick}
        />
      ))}
    </group>
  )
}

// ============================================
// GRADIENT BACKGROUND - QUANTIZED STATE
// ============================================
function GradientBackground({ priceDirection }) {
  const meshRef = useRef()
  const { viewport } = useThree()
  
  // Quantize price to discrete state
  const priceState = useMemo(() => quantizePriceState(priceDirection), [priceDirection])
  
  // Only recalculate colors when state changes (not on every price tick)
  const [currentState, setCurrentState] = useState(priceState)
  const targetColorsRef = useRef({ bottom: null, top: null })
  
  // Debounce state changes - wait for sustained change
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (priceState !== currentState) {
        setCurrentState(priceState)
      }
    }, 500) // Wait 500ms before committing to new state
    
    return () => clearTimeout(timeout)
  }, [priceState, currentState])
  
  // Calculate target colors based on quantized state
  const targetColors = useMemo(() => {
    const colorSchemes = {
      STRONG_DOWN: {
        bottom: new THREE.Color('#3d0a0a'),
        top: new THREE.Color('#ff2222')
      },
      DOWN: {
        bottom: new THREE.Color('#2d0f1a'),
        top: new THREE.Color('#aa4466')
      },
      NEUTRAL: {
        bottom: new THREE.Color('#1a1a2e'),
        top: new THREE.Color('#4a4a6a')
      },
      UP: {
        bottom: new THREE.Color('#0f2d1a'),
        top: new THREE.Color('#44aa66')
      },
      STRONG_UP: {
        bottom: new THREE.Color('#0a3d1a'),
        top: new THREE.Color('#22ff66')
      }
    }
    return colorSchemes[currentState]
  }, [currentState])
  
  // Store current colors for interpolation
  const currentColorsRef = useRef({
    bottom: targetColors.bottom.clone(),
    top: targetColors.top.clone()
  })
  
  // Shader uniforms
  const uniforms = useMemo(() => ({
    uColorBottom: { value: currentColorsRef.current.bottom },
    uColorTop: { value: currentColorsRef.current.top },
  }), [])
  
  // Animate color transitions in the render loop (smooth lerp)
  useFrame((state, delta) => {
    if (!meshRef.current) return
    
    const lerpSpeed = delta * 0.5 // Slow, smooth transition
    
    currentColorsRef.current.bottom.lerp(targetColors.bottom, lerpSpeed)
    currentColorsRef.current.top.lerp(targetColors.top, lerpSpeed)
    
    // Update uniforms
    meshRef.current.material.uniforms.uColorBottom.value = currentColorsRef.current.bottom
    meshRef.current.material.uniforms.uColorTop.value = currentColorsRef.current.top
  })
  
  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `
  
  const fragmentShader = `
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
  `
  
  return (
    <mesh ref={meshRef} position={[0, 0, -15]} scale={[viewport.width * 3, viewport.height * 3, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  )
}

// ============================================
// OFFERING TOOLTIP
// ============================================
function OfferingTooltip({ offering }) {
  if (!offering) return null
  
  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0, 0, 0, 0.85)',
      border: '1px solid rgba(0, 255, 100, 0.3)',
      borderRadius: '8px',
      padding: '12px 20px',
      color: '#fff',
      fontFamily: 'monospace',
      fontSize: '14px',
      pointerEvents: 'none',
      backdropFilter: 'blur(10px)',
      boxShadow: '0 0 20px rgba(0, 255, 100, 0.2)',
    }}>
      <div style={{ color: '#00ff66', marginBottom: '4px' }}>
        {offering.name || 'Anonymous'}
      </div>
      <div style={{ color: '#888', fontSize: '12px' }}>
        {offering.type === 'petition' && '🙏 Petition'}
        {offering.type === 'confession' && '🖤 Confession'}
        {offering.type === 'appreciation' && '✨ Appreciation'}
      </div>
      {offering.message && (
        <div style={{ marginTop: '8px', fontStyle: 'italic', maxWidth: '300px' }}>
          "{offering.message}"
        </div>
      )}
      <div style={{ color: '#666', fontSize: '10px', marginTop: '8px' }}>
        🔥 Burned {offering.tokensBurned?.toLocaleString() || '???'} RL80
      </div>
    </div>
  )
}

// ============================================
// STATS DISPLAY
// ============================================
function ShrineStats({ totalCandles, totalBurned, priceChange }) {
  return (
    <div style={{
      position: 'absolute',
      top: '350px',  // Closer to the price ticker (was 420px)
      right: '20px',  // Moved to right side
      background: 'rgba(0, 0, 0, 0.8)',
      border: `2px solid ${priceChange >= 0 ? '#00ff66' : '#ff4444'}`,  // Same border color as price ticker
      borderRadius: '12px',
      padding: '16px',
      color: '#fff',
      fontFamily: 'monospace',
      fontSize: '12px',
      backdropFilter: 'blur(10px)',
      boxShadow: `0 0 20px ${priceChange >= 0 ? 'rgba(0, 255, 100, 0.3)' : 'rgba(255, 68, 68, 0.3)'}`,
      width: '240px'  // Same width as price ticker
    }}>
      <div style={{ 
        color: priceChange >= 0 ? '#00ff66' : '#ff4444',
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '8px'
      }}>
        {priceChange >= 0 ? '↑' : '↓'} {Math.abs(priceChange).toFixed(2)}%
      </div>
      <div style={{ color: '#ccc', marginBottom: '4px' }}>
        🕯️ {totalCandles.toLocaleString()} candles burning
      </div>
      <div style={{ color: '#888' }}>
        🔥 {totalBurned.toLocaleString()} RL80 sacrificed
      </div>
    </div>
  )
}

// ============================================
// LEGACY NEW CANDLE GLB COMPONENT - REPLACED BY NewCandleEffectManager
// Keeping for reference but not using anymore
// ============================================
function NewCandleGLB_LEGACY({ triggered }) {
  const { scene } = useGLTF('/models/tinyVotiveOnly.glb')
  const [candles, setCandles] = useState([])
  const groupRef = useRef()
  
  useEffect(() => {
    if (triggered && triggered > 0) {
      // Add a new candle instance
      const side = Math.random() > 0.5 ? 1 : -1
      const newCandle = {
        id: Date.now(),
        position: [
          side * (3 + Math.random() * 2),  // Left or right side
          -2,  // Start below ground
          1 + Math.random() * 2  // Medium distance
        ],
        targetY: -0.5 + Math.random() * 0.5,  // Final height
        scale: 1.2 + Math.random() * 0.4,  // Bigger size
        startTime: Date.now(),
        glowIntensity: 5  // Start with strong glow
      }
      setCandles(prev => [...prev, newCandle])
      console.log('🕯️ New GLB candle added:', newCandle)
    }
  }, [triggered])
  
  // Animate candles rising, glowing, and drifting to center
  useFrame((state) => {
    setCandles(prev => prev.map(candle => {
      const elapsed = (Date.now() - candle.startTime) / 1000
      let updatedCandle = { ...candle }
      
      // Phase 1: Rising animation (0-3 seconds)
      if (elapsed < 3) {
        const y = -2 + (candle.targetY + 2) * Math.min(elapsed / 3, 1)
        updatedCandle.position = [candle.position[0], y, candle.position[2]]
      }
      // Phase 2: Drift toward center (3-10 seconds)
      else if (elapsed >= 3 && elapsed < 10) {
        const driftProgress = (elapsed - 3) / 7  // 0 to 1 over 7 seconds
        const targetX = (Math.random() - 0.5) * 4  // Random position in center cloud
        const targetZ = -3 + Math.random() * 2  // Deeper into scene
        
        // Smooth interpolation toward center
        updatedCandle.position = [
          candle.position[0] * (1 - driftProgress) + targetX * driftProgress,
          candle.targetY + Math.sin(state.clock.elapsedTime * 2) * 0.1,  // Add wobble
          candle.position[2] * (1 - driftProgress) + targetZ * driftProgress
        ]
        
        // Store final position for later use
        if (!candle.finalPosition) {
          candle.finalPosition = [targetX, candle.targetY, targetZ]
        }
      }
      // Phase 3: Join the main candle cloud
      else if (elapsed >= 10 && candle.finalPosition) {
        // Now it's part of the cloud, add gentle floating
        const time = state.clock.elapsedTime
        updatedCandle.position = [
          candle.finalPosition[0] + Math.sin(time + candle.id) * 0.1,
          candle.finalPosition[1] + Math.sin(time * 0.5 + candle.id) * 0.05,
          candle.finalPosition[2] + Math.cos(time * 0.3 + candle.id) * 0.1
        ]
      }
      
      // Pulsing glow for first 10 seconds
      if (elapsed < 10) {
        updatedCandle.glowIntensity = 3 + Math.sin(elapsed * 3) * 2
      } else {
        updatedCandle.glowIntensity = Math.max(0, candle.glowIntensity - 0.02)
      }
      
      return updatedCandle
    }))
  })
  
  return (
    <group ref={groupRef}>
      {candles.map(candle => {
        const clonedScene = scene.clone()
        
        // Apply emissive material to all meshes for glow
        clonedScene.traverse((child) => {
          if (child.isMesh) {
            child.material = child.material.clone()
            child.material.emissive = new THREE.Color(0xffaa00)
            child.material.emissiveIntensity = candle.glowIntensity
          }
        })
        
        return (
          <group key={candle.id} position={candle.position}>
            <primitive
              object={clonedScene}
              scale={[candle.scale, candle.scale, candle.scale]}
            />
            
            {/* Glow sphere around new candles */}
            {candle.glowIntensity > 0.5 && (
              <>
                <mesh>
                  <sphereGeometry args={[1.5, 16, 16]} />
                  <meshBasicMaterial
                    color="#ffff00"
                    transparent
                    opacity={candle.glowIntensity * 0.05}
                    depthWrite={false}
                  />
                </mesh>
                
                {/* Point light for extra glow */}
                <pointLight
                  color="#ffaa00"
                  intensity={candle.glowIntensity}
                  distance={8}
                />
              </>
            )}
          </group>
        )
      })}
    </group>
  )
}


// ============================================
// MAIN SHRINE SCENE
// ============================================
function ShrineScene({ priceChange = 2.5, offerings = [], totalCandles = 847, totalBurned = 1250000, onSelectOffering, onLightCandle, newCandleTrigger, phonePosition = [-8, 0, 2], addedCandles = [], onNewCandle }) {
  const [selectedOffering, setSelectedOffering] = useState(null)
  
  // Pass selection to parent component
  useEffect(() => {
    if (onSelectOffering) {
      onSelectOffering(selectedOffering)
    }
  }, [selectedOffering, onSelectOffering])
  
  // Convert price change percentage to direction (-1 to 1)
  const priceDirection = Math.max(-1, Math.min(1, priceChange / 5))
  
  // Debug log to check if price is changing
  useEffect(() => {
    console.log('Price change:', priceChange, '% -> Direction:', priceDirection)
  }, [priceChange, priceDirection])
  
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative', background: '#000' }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        gl={{ 
          antialias: true, 
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.5
        }}
      >
        <ambientLight intensity={0.4} color="#ffffff" />
        <pointLight position={[10, 10, 10]} intensity={0.5} color="#ffffff" />
        <pointLight position={[0, -5, 5]} color="#8bec03" intensity={0.3} />
        <pointLight position={[-5, 0, 3]} color="#8bec03" intensity={0.2} />
        <pointLight position={[5, 0, 3]} color="#8bec03" intensity={0.2} />
        
        <GradientBackground priceDirection={priceDirection} />
        
        <CandleCloud
          priceDirection={priceDirection}
          offerings={offerings}
          onSelectOffering={setSelectedOffering}
          additionalCandles={addedCandles}
          newCandleAdded={false}
        />
        
        {/* New candle effect manager with smooth animation */}
        <NewCandleEffectManager
          phonePosition={phonePosition}
          cloudBounds={{ x: SPREAD.x, y: SPREAD.y, z: SPREAD.z }}
          onNewCandle={onNewCandle}
          candleModelPath="/models/tinyVotiveOnly.glb"
          ref={newCandleTrigger}
        />
        
        <fog attach="fog" args={['#1a1a2e', 15, 40]} />
        
        <EffectComposer>
          <Bloom
            intensity={1}
            luminanceThreshold={0.2}
            luminanceSmoothing={0.9}
            mipmapBlur
            radius={0.8}
          />
          <BrightnessContrast
            brightness={0.1}
            contrast={0.2}
          />
        </EffectComposer>
      </Canvas>
      
      <ShrineStats
        totalCandles={totalCandles}
        totalBurned={totalBurned}
        priceChange={priceChange}
      />
      
      {/* Tooltip disabled - now showing on phone screen instead */}
      {/* <OfferingTooltip offering={selectedOffering} /> */}
    </div>
  )
}

// ============================================
// EXAMPLE USAGE WITH MOCK DATA
// ============================================
export default function CandleShrine({ offerings: externalOfferings, onSelectOffering, onLightCandle }) {
  const [tokenPrice, setTokenPrice] = useState(0.042)
  const [priceChange, setPriceChange] = useState(2.0)
  const [priceHistory, setPriceHistory] = useState([0.042])
  const [volume24h, setVolume24h] = useState(125000)
  const [marketCap, setMarketCap] = useState(4200000)
  const newCandleTriggerRef = useRef() // Reference to trigger new candle effect
  const [addedCandles, setAddedCandles] = useState([]) // Track dynamically added candles
  
  // Handle new candle being added to the scene permanently
  const handleNewCandle = (position, offering) => {
    console.log('Adding permanent candle at:', position, offering)
    setAddedCandles(prev => [...prev, { position, offering, id: Date.now() }])
    // Here you could also persist to Firebase or other storage
  }
  
  const mockOfferings = [
    { name: 'chelleville', type: 'petition', message: 'May my bags pump eternally', tokensBurned: 1000 },
    { name: 'degen_mike', type: 'appreciation', message: 'Thanks for the 10x Our Lady', tokensBurned: 5000 },
    { name: 'cryptopriest', type: 'confession', message: 'I sold the bottom...', tokensBurned: 2500 },
    { name: 'hodlqueen', type: 'petition', message: 'Deliver us from paper hands', tokensBurned: 10000 },
    { name: 'anonymous', type: 'appreciation', message: null, tokensBurned: 500 },
  ]
  
  // Simulate price movements with momentum
  useEffect(() => {
    let momentum = 0
    
    const interval = setInterval(() => {
      setTokenPrice(prev => {
        // Random walk with momentum
        const noise = (Math.random() - 0.5) * 0.01
        momentum = momentum * 0.95 + noise // Decay momentum, add noise
        
        // Occasional larger moves
        if (Math.random() < 0.05) {
          momentum += (Math.random() - 0.5) * 0.05
        }
        
        const newPrice = Math.max(0.001, prev * (1 + momentum))
        
        // Calculate 24h change (simplified)
        const percentChange = ((newPrice - 0.042) / 0.042) * 100
        setPriceChange(percentChange)
        
        setPriceHistory(history => [...history.slice(-49), newPrice])
        setVolume24h(v => v * (0.98 + Math.random() * 0.04))
        setMarketCap(newPrice * 100000000)
        
        return newPrice
      })
    }, 2000) // Update every 2 seconds (less frequent)
    
    return () => clearInterval(interval)
  }, [])
  
  // Use external offerings if provided, otherwise use mock data
  const actualOfferings = externalOfferings || mockOfferings
  
  return (
    <>
      {/* Price Ticker */}
      <div style={{
        position: 'absolute',
        top: '160px',  // Moved down to avoid overlapping with other UI
        right: '20px',
        background: 'rgba(0, 0, 0, 0.8)',
        border: `2px solid ${priceChange >= 0 ? '#00ff66' : '#ff4444'}`,
        borderRadius: '12px',
        padding: '16px',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: '14px',
        backdropFilter: 'blur(10px)',
        boxShadow: `0 0 20px ${priceChange >= 0 ? 'rgba(0, 255, 100, 0.3)' : 'rgba(255, 68, 68, 0.3)'}`,
        zIndex: 1000,
        width: '240px'  // Fixed width instead of minWidth
      }}>
        <div style={{ 
          fontSize: '24px', 
          fontWeight: 'bold',
          color: priceChange >= 0 ? '#00ff66' : '#ff4444',
          marginBottom: '8px'
        }}>
          ${tokenPrice.toFixed(6)}
        </div>
        <div style={{
          fontSize: '18px',
          color: priceChange >= 0 ? '#00ff66' : '#ff4444',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>{priceChange >= 0 ? '▲' : '▼'}</span>
          <span>{Math.abs(priceChange).toFixed(2)}%</span>
        </div>
        <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>
          Vol 24h: ${volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
        <div style={{ fontSize: '12px', color: '#888' }}>
          MCap: ${marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
        
        {/* Mini chart */}
        <div style={{
          marginTop: '12px',
          height: '40px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '1px'
        }}>
          {priceHistory.slice(-20).map((price, i) => {
            const min = Math.min(...priceHistory.slice(-20))
            const max = Math.max(...priceHistory.slice(-20))
            const range = max - min || 1
            const height = ((price - min) / range) * 35 + 5
            return (
              <div
                key={i}
                style={{
                  width: '8px',
                  height: `${height}px`,
                  background: i === 19 ? (priceChange >= 0 ? '#00ff66' : '#ff4444') : '#444',
                  borderRadius: '2px'
                }}
              />
            )
          })}
        </div>
      </div>
      
      <ShrineScene
        priceChange={priceChange}
        offerings={actualOfferings}
        totalCandles={847}
        totalBurned={1250000}
        onSelectOffering={onSelectOffering}
        onLightCandle={onLightCandle}
        newCandleTrigger={newCandleTriggerRef}
        phonePosition={[-8, 0, 2]}
        addedCandles={addedCandles}
        onNewCandle={handleNewCandle}
      />
      
      {/* Light a Candle Button with Heading */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '200px', // Fixed width for both text and button
      }}>
        <div style={{
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: '1.1rem',
          fontFamily: "'UnifrakturMaguntia', serif",
        //   textTransform: 'uppercase',
          letterSpacing: '1px',
          marginBottom: '12px',
          textAlign: 'center',
          width: '100%',
          textShadow: '0 0 20px rgba(0, 255, 102, 0.6), 0 2px 4px rgba(0, 0, 0, 0.8)',
        }}>
          Get on Her Watchlist
        </div>
        <button
          style={{
            width: '100%', // Full width of container
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
        onClick={() => {
          // Create a new offering with randomized data for testing
          const messages = [
            'Please pump my bags to the moon 🚀',
            'Grant me diamond hands in these trying times',
            'May the green candles be ever in my favor',
            'Bless this dip for I shall slurp',
            'Forgive me for selling the bottom',
            'Thank you for this glorious pump',
            'Guide me through the bear market darkness'
          ]
          const names = ['anon_trader', 'crypto_believer', 'hodl_warrior', 'defi_degen', 'moon_boy', 'whale_watcher']
          const types = ['petition', 'confession', 'appreciation']
          
          const newOffering = {
            name: names[Math.floor(Math.random() * names.length)],
            type: types[Math.floor(Math.random() * types.length)],
            message: messages[Math.floor(Math.random() * messages.length)],
            tokensBurned: Math.floor(Math.random() * 10000) + 500,
            timestamp: 'just now'
          }
          
          console.log('🕯️ New candle lit:', newOffering)
          
          // Call the callback to show on phone screen
          if (onLightCandle) {
            onLightCandle(newOffering)
          }
          
          // Trigger new candle animation using the smooth effect
          if (newCandleTriggerRef.current?.triggerEffect) {
            newCandleTriggerRef.current.triggerEffect(newOffering)
          }
        }}
      >
        🕯️ Light a Candle
      </button>
      </div>
    </>
  )
}