import React, { useRef, useMemo, useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// ============================================
// CONFIG
// ============================================
const ANIMATION_DURATION = 2.5 // seconds
const TRAIL_PARTICLE_COUNT = 30 // Increased for more sparkle
const TRAIL_LIFETIME = 1.2 // Particles live longer for better trail
const ARC_HEIGHT = 3 // How high the arc goes above the midpoint
const MOBILE_ARC_HEIGHT = 1.5 // Lower arc for mobile visibility
const MOBILE_BREAKPOINT = 768 // px
const BRIGHT_GLOW_DURATION = 5.0 // How long the candle stays bright after landing (seconds)

// Arctic Rings config - enhanced for more fanfare
const RING_COUNT = 7  // More rings for bigger impact
const RING_COLORS = [
  new THREE.Color(0x00ffff),  // Cyan
  new THREE.Color(0x87ceeb),  // Sky blue
  new THREE.Color(0xffffff),  // White
  new THREE.Color(0x00ff66),  // Bright green
  new THREE.Color(0xff00ff)   // Magenta for extra pop
]

// Easing function - ease out cubic for smooth deceleration
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)

// Easing function - ease in out for smooth movement
const easeInOutCubic = (t) => 
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

// ============================================
// ARCTIC RINGS EFFECT
// Expanding icy rings on candle arrival
// Faithful port of vanilla Three.js version
// ============================================
export function ArcticRingsEffect({ position, isActive, onComplete, onBloomPulse, onRingsStart }) {
  const groupRef = useRef()
  const flashRef = useRef()
  const hasStartedRef = useRef(false)
  const hasCompletedRef = useRef(false)
  const bloomFlashRef = useRef(0)
  
  // Initialize rings when activated
  useEffect(() => {
    if (isActive && groupRef.current && !hasStartedRef.current) {
      hasStartedRef.current = true
      hasCompletedRef.current = false
      
      // Clear any existing rings
      while (groupRef.current.children.length > 0) {
        const child = groupRef.current.children[0]
        if (child.geometry) child.geometry.dispose()
        if (child.material) child.material.dispose()
        groupRef.current.remove(child)
      }
      
      // Trigger bloom flash
      bloomFlashRef.current = 1.0
      onBloomPulse?.(4.0) // Start at peak intensity
      onRingsStart?.() // Notify that rings animation has started
      
      // Create rings with subtle, ethereal parameters
      for (let r = 0; r < RING_COUNT; r++) {
        const ringGeo = new THREE.RingGeometry(
          0.8 + r * 0.4,  // inner radius - start further out
          0.85 + r * 0.4,  // outer radius - very thin rings (0.05 thickness)
          48              // more segments for smoother rings
        )
        const col = RING_COLORS[r % RING_COLORS.length]
        const mat = new THREE.MeshBasicMaterial({
          color: col,
          transparent: true,
          opacity: 0.6,  // More subtle initial opacity
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
          toneMapped: false  // Critical for bloom to work!
        })
        const ring = new THREE.Mesh(ringGeo, mat)
        ring.rotation.x = Math.PI / 2
        ring.userData.speed = 0.04 + r * 0.02  // Faster expansion for more ethereal feel
        ring.userData.life = 1.0  // Standard life
        
        groupRef.current.add(ring)
      }
    }
    
    // Reset when deactivated so it can fire again
    if (!isActive) {
      hasStartedRef.current = false
    }
  }, [isActive, onBloomPulse])
  
  useFrame(() => {
    if (!groupRef.current) return
    
    // Animate bloom flash decay - ~30 frames (~500ms at 60fps) like original setTimeout
    if (bloomFlashRef.current > 0) {
      bloomFlashRef.current -= 0.033
      if (bloomFlashRef.current <= 0) {
        bloomFlashRef.current = 0
        onBloomPulse?.(1.2) // Back to base intensity
      } else {
        // Lerp from 4.0 down to base intensity (1.2)
        const currentIntensity = 1.2 + (4.0 - 1.2) * bloomFlashRef.current
        onBloomPulse?.(currentIntensity)
      }
    }
    
    // Animate the central flash mesh
    if (flashRef.current && hasStartedRef.current) {
      const flashOpacity = Math.max(0, bloomFlashRef.current * 0.9)
      flashRef.current.material.opacity = flashOpacity
      const flashScale = 1 + (1 - bloomFlashRef.current) * 5
      flashRef.current.scale.setScalar(flashScale)
    }
    
    // Nothing to animate
    if (groupRef.current.children.length === 0) {
      // Fire completion once when all rings are gone
      if (hasStartedRef.current && !hasCompletedRef.current) {
        hasCompletedRef.current = true
        onComplete?.()
      }
      return
    }
    
    // Iterate backwards for safe removal - exactly like original
    for (let i = groupRef.current.children.length - 1; i >= 0; i--) {
      const ring = groupRef.current.children[i]
      
      // Scale up - same as original
      ring.scale.x += ring.userData.speed
      ring.scale.y += ring.userData.speed
      
      // Decrease life - frame-based like original (0.01 per frame)
      ring.userData.life -= 0.01
      
      // Update opacity directly
      ring.material.opacity = ring.userData.life
      
      // Remove dead rings
      if (ring.userData.life <= 0) {
        ring.geometry.dispose()
        ring.material.dispose()
        groupRef.current.remove(ring)
      }
    }
  })
  
  // Always render the group - let the rings live out their full animation
  return (
    <>
      <group ref={groupRef} position={position} />
      
      {/* Bright central flash disc - helps trigger bloom */}
      <mesh ref={flashRef} position={position} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2, 32]} />
        <meshBasicMaterial
          color={0x00ffff}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </>
  )
}

// ============================================
// MAIN EFFECT COMPONENT
// ============================================
export function NewCandleEffect({
  startPosition = [0, 0, 0], // Phone screen position
  endPosition = [5, 2, -3],   // Target in candle cloud
  onComplete = () => {},
  onFullyComplete = () => {},
  candleModelPath = '/models/tinyJapCanOnly.glb',
  isActive = true,
  isMobile = false,
  offering = null, // Pass offering data for metadata
  onHover = () => {}, // Hover callback
  onClick = () => {} // Click callback
}) {
  const groupRef = useRef()
  const trailRef = useRef()
  const [phase, setPhase] = useState('emerging') // 'emerging' | 'traveling' | 'arriving' | 'glowing' | 'complete'
  const progressRef = useRef(0)
  const trailParticles = useRef([])
  const glowTimeRef = useRef(0) // Track how long we've been glowing
  const hasTriggeredRipple = useRef(false) // Track if ripple has been triggered
  
  // Calculate arc path control point
  const controlPoint = useMemo(() => {
    const arcHeight = isMobile ? MOBILE_ARC_HEIGHT : ARC_HEIGHT
    const mid = [
      (startPosition[0] + endPosition[0]) / 2,
      Math.max(startPosition[1], endPosition[1]) + arcHeight,
      (startPosition[2] + endPosition[2]) / 2
    ]
    return new THREE.Vector3(...mid)
  }, [startPosition, endPosition, isMobile])
  
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
      glowTimeRef.current = 0
      setPhase('emerging')
      trailParticles.current = []
      hasTriggeredRipple.current = false // Reset ripple trigger
    }
  }, [isActive])
  
  useFrame((state, delta) => {
    if (!isActive || phase === 'complete' || !groupRef.current) return
    
    const time = state.clock.elapsedTime
    
    // Handle glowing phase separately
    if (phase === 'glowing') {
      glowTimeRef.current += delta
      
      // Pulsing effect during glow
      const pulseIntensity = 1 + Math.sin(glowTimeRef.current * 3) * 0.2
      groupRef.current.scale.setScalar(1.1 * pulseIntensity)
      
      // Continue gentle rotation
      groupRef.current.rotation.y += delta * 0.5
      
      // After glow duration, complete
      if (glowTimeRef.current >= BRIGHT_GLOW_DURATION) {
        setPhase('complete')
        // onComplete already called when landing, don't call again
        // But do call onFullyComplete to signal the effect is truly done
        onFullyComplete()
      }
      // Don't return early - let trail particles continue updating below
    }
    
    // Only update travel progress if not glowing
    let currentPos = groupRef.current.position.clone()
    let easedProgress = 1
    
    if (phase !== 'glowing') {
      // Update progress for travel phases
      progressRef.current += delta / ANIMATION_DURATION
      const rawProgress = Math.min(progressRef.current, 1)
      easedProgress = easeInOutCubic(rawProgress)
      
      // Update phase
      if (rawProgress < 0.1) {
        setPhase('emerging')
      } else if (rawProgress < 0.9) {
        setPhase('traveling')
      } else if (rawProgress < 1) {
        setPhase('arriving')
      } else {
        // Instead of completing, enter glowing phase
        setPhase('glowing')
        glowTimeRef.current = 0
        
        // Trigger the ripple effect immediately when candle lands (only once)
        if (!hasTriggeredRipple.current) {
          hasTriggeredRipple.current = true
          onComplete()
        }
        return
      }
      
      // Calculate position on curve
      currentPos = getPointOnCurve(easedProgress)
      groupRef.current.position.copy(currentPos)
    }
    
    // Scale animation - skip if glowing (already handled above)
    if (phase !== 'glowing') {
      const rawProgress = progressRef.current
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
    }
    
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
    
    // Update trail particles - including during glowing phase
    if (phase === 'traveling' || phase === 'emerging' || phase === 'arriving' || phase === 'glowing') {
      // Spawn new particle - more particles during arrival and glowing for fanfare
      const spawnChance = (phase === 'arriving' || phase === 'glowing') ? 0.9 : 0.7
      // MEMORY FIX: Hard cap to prevent unbounded array growth
      if (Math.random() < spawnChance && trailParticles.current.length < TRAIL_PARTICLE_COUNT) {
        trailParticles.current.push({
          position: currentPos.clone(),
          birth: time,
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * ((phase === 'arriving' || phase === 'glowing') ? 0.8 : 0.5),
            (Math.random() - 0.5) * ((phase === 'arriving' || phase === 'glowing') ? 0.8 : 0.5),
            (Math.random() - 0.5) * ((phase === 'arriving' || phase === 'glowing') ? 0.8 : 0.5)
          ),
          size: (phase === 'arriving' || phase === 'glowing') ? 0.08 + Math.random() * 0.15 : 0.05 + Math.random() * 0.1,
          color: (phase === 'arriving' || phase === 'glowing') ?
            (Math.random() > 0.5 ? '#00ff66' : '#00ffff') : '#00ff66'
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

      // MEMORY FIX: Reuse vector objects instead of cloning every frame
      const tempPos = new THREE.Vector3()
      const tempVel = new THREE.Vector3()

      for (let i = 0; i < TRAIL_PARTICLE_COUNT; i++) {
        const particle = trailParticles.current[i]
        if (particle) {
          const age = time - particle.birth
          const life = age / TRAIL_LIFETIME

          // Update position with velocity (reuse temp vectors)
          tempVel.copy(particle.velocity).multiplyScalar(age)
          tempPos.copy(particle.position).add(tempVel)

          positions.setXYZ(i, tempPos.x, tempPos.y, tempPos.z)
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
          offering={offering}
          onHover={onHover}
          onClick={onClick}
        />
        
        {/* No glow spheres - let the candle model itself and the light provide the glow */}
        
        {/* Point light that follows - extra bright during glow */}
        <pointLight
          color={phase === 'glowing' ? '#00ffff' : '#00ff66'}
          intensity={
            phase === 'glowing' ? 3 + Math.sin(glowTimeRef.current * 3) :
            phase === 'arriving' ? 2 : 1
          }
          distance={phase === 'glowing' ? 5 : 3}
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
        precision highp float;
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
        precision highp float;
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
function CandleModel({ modelPath, phase, offering, onHover, onClick }) {
  const { scene } = useGLTF(modelPath)
  const clonedScene = useMemo(() => scene.clone(true), [scene])
  
  // Boost emission based on phase
  useEffect(() => {
    const emissionIntensity = 
      phase === 'emerging' ? 1.5 :
      phase === 'traveling' ? 2.0 :
      phase === 'arriving' ? 3.0 :
      phase === 'glowing' ? 4.0 : 1.0
    
    clonedScene.traverse((child) => {
      // Skip the parent empty object
      if (child.name === 'Candle_Empty') return
      
      if (child.isMesh && child.material) {
        // Clone material to avoid affecting other instances
        child.material = child.material.clone()
        
        // Get exact mesh name (case-sensitive)
        const meshName = child.name
        
        // Check for Wax mesh
        if (meshName === 'Wax') {
          // Bright cyan-green glow for candle wax body
          child.material.emissive = new THREE.Color('#00ffcc')
          child.material.emissiveIntensity = emissionIntensity * 1.5
          child.material.toneMapped = false
          // Add extra properties for better glow
          if (child.material.metalness !== undefined) {
            child.material.metalness = 0.2
            child.material.roughness = 0.6
          }
        }
        // Check for Flame mesh
        else if (meshName === 'Flame') {
          // Bright orange-yellow glow for flame
          child.material.emissive = new THREE.Color('#ffcc00')
          child.material.emissiveIntensity = emissionIntensity * 3.0
          child.material.toneMapped = false
          // Make flame extra bright during glowing phase
          if (phase === 'glowing') {
            child.material.emissiveIntensity = emissionIntensity * 4.0
            child.material.emissive = new THREE.Color('#ffff00')
          }
          // Make flame material more emissive
          if (child.material.metalness !== undefined) {
            child.material.metalness = 0
            child.material.roughness = 0
          }
        }
        // Check for Wick mesh
        else if (meshName === 'Wick') {
          // Dark orange glow for wick
          child.material.emissive = new THREE.Color('#ff6600')
          child.material.emissiveIntensity = emissionIntensity * 1.5
          child.material.toneMapped = false
        }
        
        // Ensure material updates
        child.material.needsUpdate = true
        
        // Store complete offering and user data on the mesh for raycasting
        if (offering) {
          child.userData.offering = offering
          child.userData.isNewCandleEffect = true // Flag to identify this is from the effect
          
          // Store user-specific data for avatar/name display
          child.userData.userId = offering.userId || offering.uid
          child.userData.userName = offering.name || offering.userName || offering.username || 'Anonymous'
          child.userData.userImageUrl = offering.userImageUrl || offering.userImage || offering.avatar || null
          child.userData.message = offering.message || offering.text || ''
          child.userData.type = offering.type || 'petition'
          child.userData.tokensBurned = offering.tokensBurned || 0
          child.userData.recipientName = offering.recipientName || offering.prayerFor || ''
          child.userData.createdAt = offering.createdAt || offering.timestamp || new Date()
        }
      }
    })
  }, [clonedScene, phase, offering])
  
  return (
    <primitive 
      object={clonedScene} 
      scale={[0.5, 0.5, 0.5]}
      onPointerOver={(e) => {
        e.stopPropagation()
        if (offering) {
          // Pass the complete user data structure
          const enrichedOffering = {
            ...offering,
            userName: offering.name || offering.userName || offering.username || 'Anonymous',
            userImageUrl: offering.userImageUrl || offering.userImage || offering.avatar || null,
            userId: offering.userId || offering.uid,
            message: offering.message || offering.text || '',
            type: offering.type || 'petition'
          }
          onHover?.(e, enrichedOffering)
        }
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        onHover?.(null)
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (offering) {
          // Pass the complete user data structure for display
          const enrichedOffering = {
            ...offering,
            userName: offering.name || offering.userName || offering.username || 'Anonymous',
            userImageUrl: offering.userImageUrl || offering.userImage || offering.avatar || null,
            userId: offering.userId || offering.uid,
            message: offering.message || offering.text || '',
            type: offering.type || 'petition',
            tokensBurned: offering.tokensBurned || 0,
            recipientName: offering.recipientName || offering.prayerFor || '',
            createdAt: offering.createdAt || offering.timestamp || new Date()
          }
          onClick?.(e, enrichedOffering)
        }
      }}
    />
  )
}

// ============================================
// ARRIVAL BURST EFFECT (Original - kept for reference)
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
  
  useFrame((_state, delta) => {
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
// Handles the full sequence with Arctic Rings
// ============================================
export const NewCandleEffectManager = forwardRef(({
  phonePosition = [0, 0, 0],
  cloudBounds = { x: 20, y: 15, z: 10 },
  onNewCandle,
  candleModelPath = '/models/tinyJapCanOnly.glb',
  useArcticRings = true, // Toggle between Arctic Rings and original burst
  onBloomPulse, // Callback to update bloom intensity: (intensity) => setBloomIntensity(intensity)
  onCandlePulse, // Callback to trigger pulse effect in candle cloud: (position) => triggerPulse(position)
  onHover, // Hover handler for metadata display
  onClick // Click handler for metadata display
}, ref) => {
  const [effectState, setEffectState] = useState({
    isActive: false,
    startPosition: [0, 0, 0],
    endPosition: [0, 0, 0]
  })
  const [showBurst, setShowBurst] = useState(false)
  const [burstPosition, setBurstPosition] = useState([0, 0, 0])
  const [isMobile, setIsMobile] = useState(false)
  
  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  // Call this to trigger a new candle effect
  const triggerEffect = (offering) => {
    // Random target position in cloud - constrained for mobile
    let target;
    if (isMobile) {
      // For mobile, keep the target offset from center to avoid phone blocking view
      // Randomly choose left or right side
      const side = Math.random() > 0.5 ? 1 : -1;
      // Offset from center: minimum 2 units, maximum 4 units to avoid going off-screen
      const xOffset = side * (2 + Math.random() * 2); // ±(2 to 4)

      target = [
        xOffset, // Left or right of center, avoiding the phone
        1.5 + Math.random() * 0.5, // Consistent Y around eye level (1.5 to 2.0)
        Math.random() * cloudBounds.z * 0.15 - 10 // Further in front (-10 to -11.5)
      ]
    } else {
      // Desktop - offset from center to avoid phone blocking view
      // Randomly choose left or right side
      const side = Math.random() > 0.5 ? 1 : -1;
      // Offset from center: minimum 3 units, with random variation
      const xOffset = side * (2 + Math.random() * cloudBounds.x * 0.25); // ±(3 to 3+30% of bounds)

      target = [
        xOffset, // Left or right of center, avoiding the phone
        0 + Math.random() * -1.0, // Consistent Y near viewer level (0 to 1.0)
        Math.random() * cloudBounds.z * 0.2 - 12 // Further in front (-12 to -14)
      ]
    }

    setEffectState({
      isActive: true,
      startPosition: isMobile ? [0, -2, 4] : phonePosition, // Adjust start position for mobile too
      endPosition: target,
      offering
    })
  }
  
  const handleEffectComplete = () => {
    // Show burst at final position
    setBurstPosition(effectState.endPosition)
    setShowBurst(true)
    
    // DON'T add permanent candle yet - wait until after glow phase
    // Store the position and offering for later
    setEffectState(prev => ({ 
      ...prev, 
      pendingCandle: { position: effectState.endPosition, offering: effectState.offering }
    }))
    
    // DON'T reset isActive here - let the glowing phase complete first
    // The NewCandleEffect will handle its own completion after glowing
  }
  
  const handleBurstComplete = () => {
    setShowBurst(false)
  }
  
  // Expose trigger function via ref
  useImperativeHandle(ref, () => ({
    triggerEffect
  }), [phonePosition, cloudBounds, isMobile])
  
  // Also attach to window for easy testing
  useEffect(() => {
    window.triggerNewCandle = triggerEffect
    return () => { delete window.triggerNewCandle }
  }, [phonePosition, isMobile])
  
  return (
    <>
      <NewCandleEffect
        startPosition={effectState.startPosition}
        endPosition={effectState.endPosition}
        isActive={effectState.isActive}
        offering={effectState.offering}
        onComplete={handleEffectComplete}
        onFullyComplete={() => {
          // Add the permanent candle now that glow is done
          if (effectState.pendingCandle) {
            onNewCandle?.(effectState.pendingCandle.position, effectState.pendingCandle.offering)
          }
          // Now reset the effect state
          setEffectState(prev => ({ ...prev, isActive: false, pendingCandle: null }))
        }}
        candleModelPath={candleModelPath}
        isMobile={isMobile}
        onHover={onHover}
        onClick={onClick}
      />
      
      {/* Arctic Rings or original burst based on prop */}
      {useArcticRings ? (
        <ArcticRingsEffect
          position={burstPosition}
          isActive={showBurst}
          onComplete={handleBurstComplete}
          onBloomPulse={onBloomPulse}
          onRingsStart={() => onCandlePulse?.(burstPosition)}
        />
      ) : (
        <ArrivalBurst
          position={burstPosition}
          isActive={showBurst}
          onComplete={handleBurstComplete}
        />
      )}
    </>
  )
})

export default NewCandleEffect