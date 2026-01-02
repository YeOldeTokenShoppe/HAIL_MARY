import React, { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ============================================
// ANIMATED FLAME SHADER MATERIAL (DEPRECATED - DO NOT USE)
// Keeping for reference but not using due to uniform limits
// ============================================

// DEPRECATED - causes uniform limit errors with many candles
function createFlameShaderMaterial_DEPRECATED(initialPhase = 0, initialSpeed = 1) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPhase: { value: initialPhase },
      uSpeed: { value: initialSpeed },
      uBaseColor: { value: new THREE.Color('#ff6600') },
      uTipColor: { value: new THREE.Color('#ffff00') },
      uIntensity: { value: 2.0 },
      uFlickerStrength: { value: 0.3 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uPhase;
      uniform float uSpeed;
      
      varying vec2 vUv;
      varying float vHeight;
      varying float vDisplacement;
      
      // Simplex noise function for organic movement
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
      
      float snoise(vec3 v) {
        const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
        
        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);
        
        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);
        
        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;
        
        i = mod289(i);
        vec4 p = permute(permute(permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));
        
        float n_ = 0.142857142857;
        vec3 ns = n_ * D.wyz - D.xzx;
        
        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
        
        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);
        
        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);
        
        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);
        
        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));
        
        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
        
        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);
        
        vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;
        
        vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
      }
      
      void main() {
        vUv = uv;
        
        // Normalize height (0 = bottom, 1 = top of flame)
        // Assuming flame mesh has Y from ~0 to ~0.3 or so
        float minY = 0.0;
        float maxY = 0.3; // Adjust based on your flame geometry
        vHeight = clamp((position.y - minY) / (maxY - minY), 0.0, 1.0);
        
        vec3 pos = position;
        
        float time = uTime * uSpeed + uPhase;
        
        // Primary wobble - increases with height
        float wobbleX = snoise(vec3(pos.y * 8.0, time * 3.0, uPhase)) * 0.04 * vHeight;
        float wobbleZ = snoise(vec3(pos.y * 8.0 + 100.0, time * 2.7, uPhase + 50.0)) * 0.04 * vHeight;
        
        // Secondary faster flicker
        float flicker = snoise(vec3(time * 8.0, uPhase, pos.y * 4.0)) * 0.02 * vHeight;
        
        // Vertical stretch - flame gets taller when displaced
        float stretch = abs(wobbleX + wobbleZ) * 2.0;
        
        pos.x += wobbleX + flicker;
        pos.z += wobbleZ;
        pos.y += stretch * vHeight;
        
        // Taper at top - pull vertices toward center as they go up
        float taper = 1.0 - vHeight * 0.3;
        pos.x *= taper;
        pos.z *= taper;
        
        vDisplacement = length(vec2(wobbleX, wobbleZ));
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPhase;
      uniform float uSpeed;
      uniform vec3 uBaseColor;
      uniform vec3 uTipColor;
      uniform float uIntensity;
      uniform float uFlickerStrength;
      
      varying vec2 vUv;
      varying float vHeight;
      varying float vDisplacement;
      
      void main() {
        float time = uTime * uSpeed + uPhase;
        
        // Color gradient from base (orange) to tip (yellow/white)
        vec3 color = mix(uBaseColor, uTipColor, vHeight);
        
        // Intensity flicker based on displacement and time
        float flicker = sin(time * 15.0) * sin(time * 23.0 + uPhase) * uFlickerStrength;
        float intensity = uIntensity + flicker + vDisplacement * 3.0;
        
        // Brighter at center, dimmer at edges (using UV or just vHeight)
        float coreBrightness = 1.0 + (1.0 - vHeight) * 0.5;
        
        // Add hot white core at bottom
        float coreHeat = smoothstep(0.4, 0.0, vHeight);
        color = mix(color, vec3(1.0, 1.0, 0.9), coreHeat * 0.6);
        
        // Final color with intensity
        vec3 finalColor = color * intensity * coreBrightness;
        
        // Alpha - more transparent at top
        float alpha = 1.0 - vHeight * 0.3;
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  })
}

// ============================================
// HOOK TO UPDATE FLAME TIME UNIFORM
// ============================================
export function useFlameAnimation(materialRef) {
  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
    }
  })
}

// ============================================
// COMPONENT: Apply flame material to a mesh
// ============================================
export function AnimatedFlameMesh({ 
  geometry, 
  phase = 0, 
  speed = 1,
  baseColor = '#ff6600',
  tipColor = '#ffff00',
  intensity = 2.0,
  flickerStrength = 0.3,
  ...props 
}) {
  const materialRef = useRef()
  
  const material = useMemo(() => {
    // Use basic material instead of shader for performance
    const mat = new THREE.MeshBasicMaterial({ 
      color: new THREE.Color(baseColor || '#ff6600'), 
      // MeshBasicMaterial doesn't support emissive properties
      transparent: true,
      opacity: 0.9
    })
    return mat
  }, [phase, speed, baseColor, tipColor, intensity, flickerStrength])
  
  useEffect(() => {
    materialRef.current = material
  }, [material])
  
  useFlameAnimation(materialRef)
  
  return (
    <mesh geometry={geometry} material={material} {...props} />
  )
}

// ============================================
// HELPER: Process candle model and replace flame material
// Use this in your CandleGeometry component
// ============================================
export function applyFlameMaterial(scene, phase = 0, speed = 1, materialsRef = null) {
  // Use basic material instead of shader
  const flameMaterial = new THREE.MeshBasicMaterial({ 
    color: '#ff6600', 
    emissive: '#ff6600',
    emissiveIntensity: 2.0 
  })
  
  scene.traverse((child) => {
    if (child.isMesh && child.name.toLowerCase() === 'flame') {
      child.material = flameMaterial
      
      // Store reference for animation updates
      if (materialsRef) {
        materialsRef.current = materialsRef.current || []
        materialsRef.current.push(flameMaterial)
      }
    }
  })
  
  return flameMaterial
}

// ============================================
// UPDATED CANDLE GEOMETRY WITH ANIMATED FLAME
// Replace your existing CandleGeometry with this
// ============================================
// Shared materials to reduce uniforms
const sharedMaterials = {
  flame: null,
  xbase: null,
  xbaseHovered: null,
  xbaseClicked: null,
  senora: null,
  senoraHovered: null,
  senoraClicked: null,
  glass: null,
  default: null  // For any other materials not specifically named
}

// Initialize shared materials once - use simpler materials to avoid uniform limits
if (!sharedMaterials.flame) {
  // Use a simple basic material for flames instead of shader to avoid uniform limits
  sharedMaterials.flame = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ffaa00'), // Bright orange-yellow
    transparent: true,
    opacity: 0.95,
    // Make it unlit (not affected by scene lighting)
    toneMapped: false
  })
  
  // Use MeshBasicMaterial instead of MeshPhysicalMaterial to reduce uniforms
  sharedMaterials.xbase = new THREE.MeshBasicMaterial({ 
    color: new THREE.Color('#8bec03')
  })
  sharedMaterials.xbaseHovered = new THREE.MeshBasicMaterial({ 
    color: new THREE.Color('#a0ff04')
  })
  sharedMaterials.xbaseClicked = new THREE.MeshBasicMaterial({ 
    color: new THREE.Color('#c0ff05')
  })
  
  // Senora needs to preserve texture, so we'll handle it specially
  // But provide fallback materials in case texture isn't loaded yet
  sharedMaterials.senora = new THREE.MeshBasicMaterial({ 
    color: new THREE.Color('#ffffff'),
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide
  })
  sharedMaterials.senoraHovered = new THREE.MeshBasicMaterial({ 
    color: new THREE.Color('#ffff88'),
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide
  })
  sharedMaterials.senoraClicked = new THREE.MeshBasicMaterial({ 
    color: new THREE.Color('#ffff00'),
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide
  })
  
  sharedMaterials.glass = new THREE.MeshBasicMaterial({ 
    transparent: true, 
    opacity: 0.3,
    color: new THREE.Color('#888888')
  })
  
  // Default material for any unnamed materials
  sharedMaterials.default = new THREE.MeshBasicMaterial({ 
    color: new THREE.Color('#cccccc')
  })
}

export function CandleGeometryWithAnimatedFlame({ 
  isHovered, 
  isClicked, 
  flamePhase = 0,
  flameSpeed = 1,
  modelPath = '/models/tinyVotiveOnly.glb',
  useGLTF 
}) {
  const { scene } = useGLTF(modelPath)
  const groupRef = useRef()
  
  // Clone the scene and immediately replace ALL materials with shared ones
  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true)
    
    // Store the original texture before replacing materials
    let senoraTexture = null
    cloned.traverse((child) => {
      if (child.isMesh && child.name.toLowerCase() === 'senora' && child.material?.map) {
        senoraTexture = child.material.map
      }
    })
    
    // Update shared senora materials with texture if found
    // Use MeshBasicMaterial to minimize uniforms
    if (senoraTexture) {
      // Update the existing materials with the texture
      sharedMaterials.senora.map = senoraTexture
      sharedMaterials.senora.needsUpdate = true
      
      sharedMaterials.senoraHovered.map = senoraTexture
      sharedMaterials.senoraHovered.needsUpdate = true
      
      sharedMaterials.senoraClicked.map = senoraTexture
      sharedMaterials.senoraClicked.needsUpdate = true
    }
    
    // Now replace all materials
    cloned.traverse((child) => {
      if (child.isMesh) {
        const meshName = child.name
        
        // Assign shared materials based on mesh name (case-insensitive check)
        if (meshName.toLowerCase() === 'flame') {
          child.material = sharedMaterials.flame
        } else if (meshName.toLowerCase() === 'wick') {
          // Wick gets a simple black material, no animation
          child.material = new THREE.MeshBasicMaterial({ color: '#1a1a1a' })
        } else if (meshName === 'XBase') {
          child.material = sharedMaterials.xbase
        } else if (meshName.toLowerCase() === 'senora') {
          child.material = sharedMaterials.senora || sharedMaterials.default
        } else if (meshName.toLowerCase() === 'glass') {
          child.material = sharedMaterials.glass
        } else {
          // Replace ALL other materials with default
          child.material = sharedMaterials.default
        }
      }
    })
    
    return cloned
  }, [scene])
  
  // No longer need flame material reference since we're not using shader uniforms
  
  // Update materials based on hover/click state
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        const meshName = child.name
        
        if (meshName.toLowerCase() === 'flame' || meshName.toLowerCase() === 'wick') {
          // Flame and wick materials don't need special handling here
          
        } else if (meshName === 'XBase') {
          // Update XBase materials based on state
          if (isClicked) {
            child.material = sharedMaterials.xbaseClicked
          } else if (isHovered) {
            child.material = sharedMaterials.xbaseHovered
          } else {
            child.material = sharedMaterials.xbase
          }
          
        } else if (meshName.toLowerCase() === 'senora') {
          // Update senora materials based on state
          if (isClicked) {
            child.material = sharedMaterials.senoraClicked
          } else if (isHovered) {
            child.material = sharedMaterials.senoraHovered
          } else {
            child.material = sharedMaterials.senora
          }
        }
        // glass and default materials don't change with state
      }
    })
  }, [clonedScene, isHovered, isClicked])
  
  // Animate flame using time offset for variation instead of individual materials
  useFrame((state) => {
    // Add comprehensive null checks
    if (!clonedScene || !state || !state.clock) return
    
    // Find the flame mesh in the cloned scene
    clonedScene.traverse((child) => {
      // Comprehensive null checks for child and properties
      if (!child || !child.isMesh || !child.name) return
      
      if (child.name.toLowerCase().includes('flame')) {
        // Create a simple animated effect for flames
        const time = state.clock.elapsedTime || 0
        const animTime = time * flameSpeed + flamePhase
        
        // Multiple sine waves for organic flicker
        const flicker1 = Math.sin(animTime * 5) * 0.3
        const flicker2 = Math.sin(animTime * 8) * 0.2
        const flicker3 = Math.sin(animTime * 13) * 0.1
        const combinedFlicker = flicker1 + flicker2 + flicker3
        
        // Animate color and brightness - only if material exists
        if (child.material) {
          // Check for color property before accessing
          if (child.material.color && typeof child.material.color.setHSL === 'function') {
            // Oscillate between orange and bright yellow
            const hue = 0.05 + combinedFlicker * 0.03 // Orange (0.05) to yellow (0.11)
            const saturation = 1.0
            const lightness = 0.65 + combinedFlicker * 0.15 + (isHovered ? 0.1 : 0)
            
            // Set the color
            child.material.color.setHSL(hue, saturation, lightness)
          }
          
          // Ensure visibility
          if (child.visible !== undefined) {
            child.visible = true
          }
          
          // Only animate transform properties if they exist
          if (child.scale && typeof child.scale.set === 'function') {
            // Animate scale for pulsing effect (less dramatic to stay on wick)
            const scaleFactor = 1 + combinedFlicker * 0.15 // Moderate scale variation
            const scaleY = 1.2 + combinedFlicker * 0.3 // Vertical stretch for flame shape
            child.scale.set(scaleFactor, scaleY, scaleFactor)
          }
          
          if (child.rotation) {
            // Add wavering rotation for realistic flame movement (reduced to prevent separation)
            const waveX = Math.sin(animTime * 3) * 0.15 // Gentle forward/back tilt
            const waveZ = Math.cos(animTime * 4) * 0.1 // Gentle side-to-side sway
            const waveY = Math.sin(animTime * 2) * 0.05 // Subtle twist
            if (child.rotation.x !== undefined) child.rotation.x = waveX
            if (child.rotation.z !== undefined) child.rotation.z = waveZ
            if (child.rotation.y !== undefined) child.rotation.y = waveY
          }
          
          if (child.position) {
            // Very subtle vertical bobbing (flames don't move much vertically)
            const bobY = Math.sin(animTime * 6) * 0.01 // Tiny vertical movement
            child.position.y = bobY
          }
          
          // Remove horizontal drift - flames should stay centered on wick
          // child.position.x = 0
          // child.position.z = 0
        }
      }
    })
  })
  
  const scale = isClicked ? 0.6 : isHovered ? 0.55 : 0.5
  
  // Don't render if scene hasn't loaded yet
  if (!clonedScene) {
    return null
  }
  
  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} scale={[scale, scale, scale]} />
      <pointLight 
        position={[0, 0.3, 0]} 
        color={isClicked ? "#ffaa00" : isHovered ? "#ff8800" : "#ff6600"} 
        intensity={isClicked ? 0.6 : isHovered ? 0.4 : 0.2} 
        distance={isClicked ? 3 : 2} 
      />
    </group>
  )
}

// ============================================
// UPDATED CANDLE COMPONENT
// Pass unique phase/speed per candle
// ============================================
export function CandleWithAnimatedFlame({ 
  index, 
  homePosition, 
  priceDirection, 
  onHover, 
  onUnhover, 
  onClick,
  modelPath = '/models/tinyVotiveOnly.glb',
  useGLTF
}) {
  const ref = useRef()
  const [isHovered, setIsHovered] = useState(false)
  const [isClicked, setIsClicked] = useState(false)
  
  // Per-candle random values - INCLUDE FLAME VARIATION
  const randomValues = useMemo(() => ({
    speed: 0.3 + Math.random() * 0.7,
    phase: Math.random() * Math.PI * 2,
    wobbleX: 0.02 + Math.random() * 0.03,
    wobbleZ: 0.02 + Math.random() * 0.03,
    offsetMultiplier: 0.7 + Math.random() * 0.6,
    responseDelay: Math.random() * 0.5,
    // Flame-specific randomness
    flamePhase: Math.random() * Math.PI * 2,
    flameSpeed: 0.8 + Math.random() * 0.4, // 0.8 to 1.2
  }), [])
  
  // ... rest of your existing Candle useFrame logic ...
  
  return (
    <group
      ref={ref}
      position={homePosition}
      onPointerOver={(e) => {
        e.stopPropagation()
        setIsHovered(true)
        onHover(index, e.point)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setIsHovered(false)
        onUnhover()
        document.body.style.cursor = 'default'
      }}
      onClick={(e) => {
        e.stopPropagation()
        setIsClicked(true)
        onClick?.(index)
        setTimeout(() => setIsClicked(false), 500)
      }}
    >
      <CandleGeometryWithAnimatedFlame 
        isHovered={isHovered} 
        isClicked={isClicked}
        flamePhase={randomValues.flamePhase}
        flameSpeed={randomValues.flameSpeed}
        modelPath={modelPath}
        useGLTF={useGLTF}
      />
    </group>
  )
}

// ============================================
// EXPORT FOR EASY IMPORT
// ============================================
export default {
  // createFlameShaderMaterial_DEPRECATED, // Don't export deprecated function
  useFlameAnimation,
  AnimatedFlameMesh,
  applyFlameMaterial,
  CandleGeometryWithAnimatedFlame,
  CandleWithAnimatedFlame,
}