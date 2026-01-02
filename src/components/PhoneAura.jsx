import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const auraFragmentShader = `
  precision highp float;
  uniform vec3 color;
  uniform float opacity;
  uniform float time;
  varying vec2 vUv;
  
  void main() {
    // Distance from center
    vec2 center = vUv - 0.5;
    float dist = length(center);
    
    // Soft radial gradient - bright center, fades outward
    float glow = 1.0 - smoothstep(0.0, 0.5, dist);
    
    // Add subtle pulse
    float pulse = 0.95 + 0.05 * sin(time * 1.5);
    
    // Soft outer ring for extra definition
    float ring = smoothstep(0.35, 0.4, dist) * (1.0 - smoothstep(0.4, 0.5, dist));
    
    float alpha = (glow * 0.7 + ring * 0.3) * opacity * pulse;
    
    gl_FragColor = vec4(color, alpha);
  }
`

const auraVertexShader = `
  precision highp float;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export function PhoneAura({ 
  phonePosition = [0, -2.31, 0.33],
  color = '#00ffff',
  intensity = 1,
  size = 8,
  opacity = 0.3,
  isActive = false,
  priceDirection = 0
}) {
  const materialRef = useRef()
  const groupRef = useRef()
  
  // Keep color always cyan as requested
  const currentColor = color
  
  const uniforms = useMemo(() => ({
    color: { value: new THREE.Color(currentColor) },
    opacity: { value: opacity },
    time: { value: 0 }
  }), [currentColor, opacity])
  
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.getElapsedTime()
      materialRef.current.uniforms.opacity.value = opacity * (isActive ? 1.4 : 1)
    }
    
    // Subtle scale pulse when active
    if (groupRef.current) {
      const scaleTarget = isActive ? 1.15 : 1
      groupRef.current.scale.lerp(new THREE.Vector3(scaleTarget, scaleTarget, 1), 0.1)
    }
  })
  
  return (
    <group ref={groupRef} position={phonePosition}>
      {/* Main aura disc - positioned behind phone */}
      <mesh position={[0, 0, -1]} rotation={[0, 0, 0]}>
        <planeGeometry args={[size, size * 0.9, 1, 1]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={auraVertexShader}
          fragmentShader={auraFragmentShader}
          uniforms={uniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Subtle point light to catch any 3D emoji geometry */}
      <pointLight
        color={currentColor}
        intensity={intensity * 0.5}
        distance={15}
        decay={2}
        position={[0, 0, 1]}
      />
    </group>
  )
}