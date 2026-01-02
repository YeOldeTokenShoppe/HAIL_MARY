import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function PhoneLightRays({ 
  phonePosition = [0, -3, 5],
  color = '#00ffff',
  intensity = 1,
  rayCount = 12,
  spread = 8,
  opacity = 0.15,
  isActive = false,
  priceDirection = 0
}) {
  const groupRef = useRef()
  const time = useRef(0)
  
  // Create ray data emanating from behind phone using quaternions
  const rays = useMemo(() => {
  const raysArray = []
  
  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2
    const x = Math.cos(angle) * spread
    const y = Math.sin(angle) * spread * 0.7
    
    const direction = new THREE.Vector3(x * 1.5, y * 1.5, -2).normalize()
    
    const quaternion = new THREE.Quaternion()
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
    
    const rayLength = 20
    const rayWidth = 0.8 + Math.sin(angle * 3) * 0.2
    
    const startOffset = new THREE.Vector3(0, 0, -3)
    
    raysArray.push({
      id: i,
      position: startOffset.clone().add(direction.clone().multiplyScalar(rayLength / 2)),
      quaternion: quaternion,
      scale: [rayWidth, rayLength, 1],
      opacity: opacity * (0.6 + Math.random() * 0.4),
      pulseSpeed: 0.5 + Math.random() * 0.5,
      pulsePhase: (i / rayCount) * Math.PI * 2
    })
  }
  return raysArray
}, [rayCount, spread, opacity])
  
  // Animate the rays
  useFrame((state) => {
    if (!groupRef.current) return
    
    time.current = state.clock.getElapsedTime()
    
    // No rotation - keep rays fixed
    // groupRef.current.rotation.y = time.current * 0.1
    
    // Pulse intensity based on price direction
    const pulseFactor = 1 + Math.sin(time.current * 3) * 0.2
    const intensityFactor = isActive ? 1.5 : (1 + Math.abs(priceDirection) * 0.3)
    
    // Update individual ray opacities
    groupRef.current.children.forEach((child, index) => {
      if (child.material) {
        const ray = rays[index % rays.length]
        const pulse = Math.sin(time.current * ray.pulseSpeed + ray.pulsePhase) * 0.3 + 0.7
        child.material.opacity = ray.opacity * pulse * pulseFactor * intensityFactor
        
        // Keep color always cyan
        child.material.color = new THREE.Color(color) // Always cyan
      }
    })
    
    // Scale effect when active
    const scaleTarget = isActive ? 1.3 : 1
    groupRef.current.scale.lerp(new THREE.Vector3(scaleTarget, scaleTarget, scaleTarget), 0.1)
  })
  
  return (
    <group ref={groupRef} position={phonePosition}>
      {/* Light rays emanating from behind phone */}
      {rays.map((ray) => (
        <mesh
          key={ray.id}
          position={ray.position}
          quaternion={ray.quaternion}
          scale={ray.scale}
        >
          <coneGeometry args={[1, 1, 4, 1, true]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={ray.opacity}
            side={THREE.DoubleSide}
            depthWrite={false}
            depthTest={true}  // Keep depth test on so rays go behind objects
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      
      {/* Additional point light for actual illumination */}
      <pointLight
        color={color}  // Always cyan
        intensity={intensity * (isActive ? 2 : 1)}
        distance={30}
        decay={2}
      />
    </group>
  )
}