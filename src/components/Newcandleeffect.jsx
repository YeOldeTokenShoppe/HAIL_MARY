import React, { useRef, useMemo, useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// ============================================
// CONFIG
// ============================================
const ANIMATION_DURATION = 2.5 // seconds
const TRAIL_PARTICLE_COUNT = 20
const TRAIL_LIFETIME = 0.8 // How long each particle lives
const ARC_HEIGHT = 3 // How high the arc goes above the midpoint

// Easing function - ease out cubic for smooth deceleration
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

// Easing function - ease in out for smooth movement
const easeInOutCubic = (t) => 
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

// ============================================
// MAIN EFFECT COMPONENT
// ============================================
export function NewCandleEffect({
  startPosition = [0, 0, 0], // Phone screen position
  endPosition = [5, 2, -3],   // Target in candle cloud
  onComplete = () => {},
  candleModelPath = '/models/tinyVotiveOnly.glb',
  isActive = true
}) {
  const groupRef = useRef()
  const trailRef = useRef()
  const [phase, setPhase] = useState('emerging') // 'emerging' | 'traveling' | 'arriving' | 'complete'
  const progressRef = useRef(0)
  const trailParticles = useRef([])
  
  // Calculate arc path control point
  const controlPoint = useMemo(() => {
    const mid = [
      (startPosition[0] + endPosition[0]) / 2,
      Math.max(startPosition[1], endPosition[1]) + ARC_HEIGHT,
      (startPosition[2] + endPosition[2]) / 2
    ]
    return new THREE.Vector3(...mid)
  }, [startPosition, endPosition])
  
  const startVec = useMemo(() => new THREE.Vector3(...startPosition), [startPosition])
  const endVec = useMemo(() => new THREE.Vector3(...endPosition), [endPosition])
  
  // Quadratic bezier curve for smooth arc
  const getPointOnCurve = (t) => {
    const point = new THREE.Vector3()
    // Quadratic bezier: (1-t)²P0 + 2(1-t)tP1 + t²P2
    const t1 = 1 - t
    point.x = t1 * t1 * startVec.x + 2 * t1 * t * controlPoint.x + t * t * endVec.x
    point.y = t1 * t1 * startVec.y + 2 * t1 * t * controlPoint.y + t * t * endVec.y
    point.z = t1 * t1 * startVec.z + 2 * t1 * t * controlPoint.z + t * t * endVec.z
    return point
  }
  
  // Reset when activated
  useEffect(() => {
    if (isActive) {
      progressRef.current = 0
      setPhase('emerging')
      trailParticles.current = []
    }
  }, [isActive])
  
  useFrame((state, delta) => {
    if (!isActive || phase === 'complete' || !groupRef.current) return
    
    const time = state.clock.elapsedTime
    
    // Update progress
    progressRef.current += delta / ANIMATION_DURATION
    const rawProgress = Math.min(progressRef.current, 1)
    const easedProgress = easeInOutCubic(rawProgress)
    
    // Update phase
    if (rawProgress < 0.1) {
      setPhase('emerging')
    } else if (rawProgress < 0.9) {
      setPhase('traveling')
    } else if (rawProgress < 1) {
      setPhase('arriving')
    } else {
      setPhase('complete')
      onComplete()
      return
    }
    
    // Calculate position on curve
    const currentPos = getPointOnCurve(easedProgress)
    groupRef.current.position.copy(currentPos)
    
    // Scale animation
    // Start small (emerging from phone), grow during travel, full size at end
    let scale
    if (rawProgress < 0.15) {
      // Emerge: 0 -> 0.6
      scale = easeOutCubic(rawProgress / 0.15) * 0.6
    } else if (rawProgress < 0.85) {
      // Travel: 0.6 -> 0.9
      const travelProgress = (rawProgress - 0.15) / 0.7
      scale = 0.6 + travelProgress * 0.3
    } else {
      // Arrive: 0.9 -> 1.0 with slight overshoot
      const arriveProgress = (rawProgress - 0.85) / 0.15
      scale = 0.9 + easeOutCubic(arriveProgress) * 0.15
      // Add slight "plop" overshoot
      if (arriveProgress < 0.5) {
        scale += Math.sin(arriveProgress * Math.PI) * 0.1
      }
    }
    groupRef.current.scale.setScalar(scale)
    
    // Rotation - gentle spin during travel
    groupRef.current.rotation.y += delta * (phase === 'traveling' ? 2 : 0.5)
    
    // Wobble during travel
    if (phase === 'traveling') {
      groupRef.current.rotation.z = Math.sin(time * 8) * 0.1
      groupRef.current.rotation.x = Math.cos(time * 6) * 0.05
    } else {
      // Settle rotation at the end
      groupRef.current.rotation.z *= 0.9
      groupRef.current.rotation.x *= 0.9
    }
    
    // Update trail particles
    if (phase === 'traveling' || phase === 'emerging') {
      // Spawn new particle
      if (Math.random() < 0.6) { // 60% chance each frame
        trailParticles.current.push({
          position: currentPos.clone(),
          birth: time,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 0.5
          ),
          size: 0.05 + Math.random() * 0.1
        })
      }
    }
    
    // Clean up old particles
    trailParticles.current = trailParticles.current.filter(
      p => time - p.birth < TRAIL_LIFETIME
    )
    
    // Update trail mesh
    if (trailRef.current) {
      const positions = trailRef.current.geometry.attributes.position
      const sizes = trailRef.current.geometry.attributes.size
      const opacities = trailRef.current.geometry.attributes.opacity
      
      for (let i = 0; i < TRAIL_PARTICLE_COUNT; i++) {
        const particle = trailParticles.current[i]
        if (particle) {
          const age = time - particle.birth
          const life = age / TRAIL_LIFETIME
          
          // Update position with velocity
          const pos = particle.position.clone().add(
            particle.velocity.clone().multiplyScalar(age)
          )
          
          positions.setXYZ(i, pos.x, pos.y, pos.z)
          sizes.setX(i, particle.size * (1 - life * 0.5)) // Shrink over time
          opacities.setX(i, 1 - life) // Fade out
        } else {
          // Hide unused particles
          positions.setXYZ(i, 0, -1000, 0)
          sizes.setX(i, 0)
          opacities.setX(i, 0)
        }
      }
      
      positions.needsUpdate = true
      sizes.needsUpdate = true
      opacities.needsUpdate = true
    }
  })
  
  if (!isActive) return null
  
  return (
    <group>
      {/* Main candle */}
      <group ref={groupRef} position={startPosition}>
        <CandleModel 
          modelPath={candleModelPath} 
          phase={phase}
        />
        
        {/* Glow sphere around candle */}
        <mesh>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial
            color="#00ff66"
            transparent
            opacity={phase === 'arriving' ? 0.3 : 0.15}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        
        {/* Point light that follows */}
        <pointLight
          color="#00ff66"
          intensity={phase === 'arriving' ? 2 : 1}
          distance={3}
        />
      </group>
      
      {/* Particle trail */}
      <points ref={trailRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={TRAIL_PARTICLE_COUNT}
            array={new Float32Array(TRAIL_PARTICLE_COUNT * 3)}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-size"
            count={TRAIL_PARTICLE_COUNT}
            array={new Float32Array(TRAIL_PARTICLE_COUNT)}
            itemSize={1}
          />
          <bufferAttribute
            attach="attributes-opacity"
            count={TRAIL_PARTICLE_COUNT}
            array={new Float32Array(TRAIL_PARTICLE_COUNT)}
            itemSize={1}
          />
        </bufferGeometry>
        <TrailParticleMaterial />
      </points>
    </group>
  )
}

// ============================================
// TRAIL PARTICLE SHADER MATERIAL
// ============================================
function TrailParticleMaterial() {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color('#00ff66') }
      },
      vertexShader: `
        attribute float size;
        attribute float opacity;
        varying float vOpacity;
        
        void main() {
          vOpacity = opacity;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vOpacity;
        
        void main() {
          // Circular particle with soft edges
          vec2 center = gl_PointCoord - vec2(0.5);
          float dist = length(center);
          if (dist > 0.5) discard;
          
          float alpha = smoothstep(0.5, 0.0, dist) * vOpacity;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  }, [])
  
  return <primitive object={material} attach="material" />
}

// ============================================
// CANDLE MODEL FOR THE EFFECT
// ============================================
function CandleModel({ modelPath, phase }) {
  const { scene } = useGLTF(modelPath)
  const clonedScene = useMemo(() => scene.clone(true), [scene])
  
  // Boost emission based on phase
  useEffect(() => {
    const emissionIntensity = 
      phase === 'emerging' ? 1.5 :
      phase === 'traveling' ? 2.0 :
      phase === 'arriving' ? 3.0 : 1.0
    
    clonedScene.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone()
        
        const meshName = child.name.toLowerCase()
        
        if (meshName.includes('xbase')) {
          child.material.emissive = new THREE.Color('#8bec03')
          child.material.emissiveIntensity = emissionIntensity
        } else if (meshName.includes('flame') || meshName.includes('fire')) {
          child.material.emissive = new THREE.Color('#ffaa00')
          child.material.emissiveIntensity = emissionIntensity * 1.5
          child.material.toneMapped = false
        }
        
        child.material.needsUpdate = true
      }
    })
  }, [clonedScene, phase])
  
  return <primitive object={clonedScene} scale={[0.5, 0.5, 0.5]} />
}

// ============================================
// ARRIVAL BURST EFFECT
// Triggers when candle reaches destination
// ============================================
export function ArrivalBurst({ position, isActive, onComplete }) {
  const groupRef = useRef()
  const [particles, setParticles] = useState([])
  const progressRef = useRef(0)
  
  const BURST_DURATION = 0.8
  const PARTICLE_COUNT = 12
  
  // Generate burst particles on activation
  useEffect(() => {
    if (isActive) {
      progressRef.current = 0
      const newParticles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2
        const speed = 1 + Math.random() * 0.5
        return {
          velocity: new THREE.Vector3(
            Math.cos(angle) * speed,
            (Math.random() - 0.3) * speed,
            Math.sin(angle) * speed
          ),
          size: 0.08 + Math.random() * 0.08,
          position: new THREE.Vector3(0, 0, 0)
        }
      })
      setParticles(newParticles)
    }
  }, [isActive])
  
  useFrame((state, delta) => {
    if (!isActive || !groupRef.current) return
    
    progressRef.current += delta / BURST_DURATION
    
    if (progressRef.current >= 1) {
      onComplete?.()
      return
    }
    
    const progress = progressRef.current
    
    // Update particle positions
    setParticles(prev => prev.map(p => ({
      ...p,
      position: p.velocity.clone().multiplyScalar(progress * 2)
    })))
  })
  
  if (!isActive) return null
  
  const opacity = 1 - progressRef.current
  
  return (
    <group ref={groupRef} position={position}>
      {/* Central flash */}
      <mesh scale={[1 + progressRef.current * 2, 1 + progressRef.current * 2, 1]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial
          color="#00ff66"
          transparent
          opacity={opacity * 0.5}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Burst particles */}
      {particles.map((p, i) => (
        <mesh key={i} position={p.position}>
          <sphereGeometry args={[p.size * (1 - progressRef.current * 0.5), 8, 8]} />
          <meshBasicMaterial
            color="#00ff66"
            transparent
            opacity={opacity}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      
      {/* Expanding ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[
          progressRef.current * 2,
          progressRef.current * 2 + 0.1,
          32
        ]} />
        <meshBasicMaterial
          color="#00ff66"
          transparent
          opacity={opacity * 0.3}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

// ============================================
// COMBINED EFFECT MANAGER
// Handles the full sequence
// ============================================
export const NewCandleEffectManager = forwardRef(({
  phonePosition = [0, 0, 0],
  cloudBounds = { x: 20, y: 15, z: 10 },
  onNewCandle,
  candleModelPath = '/models/tinyVotiveOnly.glb'
}, ref) => {
  const [effectState, setEffectState] = useState({
    isActive: false,
    startPosition: [0, 0, 0],
    endPosition: [0, 0, 0]
  })
  const [showBurst, setShowBurst] = useState(false)
  const [burstPosition, setBurstPosition] = useState([0, 0, 0])
  
  // Call this to trigger a new candle effect
  const triggerEffect = (offering) => {
    // Random target position in cloud
    const target = [
      (Math.random() - 0.5) * cloudBounds.x,
      (Math.random() - 0.5) * cloudBounds.y,
      (Math.random() - 0.5) * cloudBounds.z - 5
    ]
    
    setEffectState({
      isActive: true,
      startPosition: phonePosition,
      endPosition: target,
      offering
    })
  }
  
  const handleEffectComplete = () => {
    // Show burst at final position
    setBurstPosition(effectState.endPosition)
    setShowBurst(true)
    
    // Notify parent to add permanent candle
    onNewCandle?.(effectState.endPosition, effectState.offering)
    
    // Reset effect state
    setEffectState(prev => ({ ...prev, isActive: false }))
  }
  
  const handleBurstComplete = () => {
    setShowBurst(false)
  }
  
  // Expose trigger function via ref
  useImperativeHandle(ref, () => ({
    triggerEffect
  }), [phonePosition, cloudBounds])
  
  // Also attach to window for easy testing
  useEffect(() => {
    window.triggerNewCandle = triggerEffect
    return () => { delete window.triggerNewCandle }
  }, [phonePosition])
  
  return (
    <>
      <NewCandleEffect
        startPosition={effectState.startPosition}
        endPosition={effectState.endPosition}
        isActive={effectState.isActive}
        onComplete={handleEffectComplete}
        candleModelPath={candleModelPath}
      />
      
      <ArrivalBurst
        position={burstPosition}
        isActive={showBurst}
        onComplete={handleBurstComplete}
      />
    </>
  )
})

export default NewCandleEffect