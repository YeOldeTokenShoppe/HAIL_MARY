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
    
    // Soft edge falloff - fade to zero before reaching edge of geometry
    float edgeFade = 1.0 - smoothstep(0.3, 0.5, dist);
    
    // Soft radial gradient - bright center, fades outward
    float glow = 1.0 - smoothstep(0.0, 0.25, dist);
    
    // Add subtle pulse
    float pulse = 0.95 + 0.05 * sin(time * 1.5);
    
    // Very soft, blurred concentric rings with wider transitions
    float ring1 = smoothstep(0.1, 0.25, dist) * (1.0 - smoothstep(0.25, 0.35, dist));
    float ring2 = smoothstep(0.25, 0.38, dist) * (1.0 - smoothstep(0.38, 0.48, dist));
    float ring3 = smoothstep(0.35, 0.45, dist) * (1.0 - smoothstep(0.45, 0.5, dist));
    
    // Very soft animated ring expansion
    float expandOffset = mod(time * 0.2, 0.5);
    float expandingRing = smoothstep(expandOffset - 0.15, expandOffset, dist) * 
                         (1.0 - smoothstep(expandOffset, expandOffset + 0.15, dist)) * 
                         (1.0 - expandOffset * 1.6); // Gradual fade out before edge
    
    // Combine with reduced ring visibility for softer look
    float rings = ring1 * 0.25 + ring2 * 0.2 + ring3 * 0.15 + expandingRing * 0.3;
    float alpha = (glow * 0.6 + rings) * opacity * pulse * edgeFade;
    
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
  phoneRotation = [0, 0, 0],
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
    <group ref={groupRef} position={phonePosition} rotation={phoneRotation}>
      {/* Layer 1: Furthest back, largest */}
      <mesh 
        position={[0, 0, -0.8]} 
        rotation={[0, 0, 0]} 
        renderOrder={1}
        raycast={() => null} // Ignore raycasts - let clicks pass through
      >
        <circleGeometry args={[size * 0.7, 64]} />
        <shaderMaterial
          vertexShader={auraVertexShader}
          fragmentShader={auraFragmentShader}
          uniforms={uniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Layer 2: Middle layer */}
      <mesh 
        position={[0, 0, -0.5]} 
        rotation={[0, 0, 0]} 
        renderOrder={2}
        raycast={() => null} // Ignore raycasts - let clicks pass through
      >
        <circleGeometry args={[size * 0.5, 64]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={auraVertexShader}
          fragmentShader={auraFragmentShader}
          uniforms={uniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Layer 3: Closest to phone but still behind */}
      <mesh 
        position={[0, 0, -0.2]} 
        rotation={[0, 0, 0]} 
        renderOrder={3}
        raycast={() => null} // Ignore raycasts - let clicks pass through
      >
        <circleGeometry args={[size * 0.35, 64]} />
        <shaderMaterial
          vertexShader={auraVertexShader}
          fragmentShader={auraFragmentShader}
          uniforms={uniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          depthTest={false}
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