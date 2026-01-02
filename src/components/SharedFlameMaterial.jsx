import React, { useRef, useMemo, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// ============================================
// SINGLE SHARED FLAME MATERIAL
// One material for ALL flames - no uniform limits
// Per-flame variation derived from world position
// ============================================

// Store materials per canvas context to avoid conflicts
const materialStore = new Map()

export function getSharedFlameMaterial(canvasId = 'default') {
  // Get material for specific canvas context
  const existing = materialStore.get(canvasId)
  
  // Check if material still exists and hasn't been disposed
  if (existing && !existing.disposed) {
    return existing
  }
  
  const sharedFlameMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color('#ff4400') },
      uMidColor: { value: new THREE.Color('#ff8800') },
      uTipColor: { value: new THREE.Color('#ffff44') },
      uIntensity: { value: 2.5 }, // Increased intensity
    },
    vertexShader: `
      uniform float uTime;
      
      varying vec2 vUv;
      varying float vHeight;
      varying float vDisplacement;
      varying float vPhase;
      
      // Simple hash function to get pseudo-random value from position
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      
      // Simplex-ish noise
      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float n = i.x + i.y * 57.0 + i.z * 113.0;
        
        return mix(
          mix(
            mix(hash(vec3(n + 0.0, 0.0, 0.0)), hash(vec3(n + 1.0, 0.0, 0.0)), f.x),
            mix(hash(vec3(n + 57.0, 0.0, 0.0)), hash(vec3(n + 58.0, 0.0, 0.0)), f.x),
            f.y
          ),
          mix(
            mix(hash(vec3(n + 113.0, 0.0, 0.0)), hash(vec3(n + 114.0, 0.0, 0.0)), f.x),
            mix(hash(vec3(n + 170.0, 0.0, 0.0)), hash(vec3(n + 171.0, 0.0, 0.0)), f.x),
            f.y
          ),
          f.z
        );
      }
      
      void main() {
        vUv = uv;
        
        // Get world position for this vertex's parent object
        vec4 worldPos = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        
        // Derive unique phase from world position (each candle gets different animation)
        vPhase = hash(worldPos.xyz) * 6.28318; // 0 to 2*PI
        float speed = 0.8 + hash(worldPos.xyz + 100.0) * 0.4; // 0.8 to 1.2
        
        // Normalize height (0 = bottom, 1 = top of flame)
        // Adjust these based on actual flame mesh size
        float minY = 0.0;
        float maxY = 0.1; // Smaller range for tiny candle
        vHeight = clamp((position.y - minY) / (maxY - minY), 0.0, 1.0);
        
        vec3 pos = position;
        
        float time = uTime * speed + vPhase;
        
        // Primary wobble - increases with height
        float wobbleX = noise(vec3(pos.y * 8.0 + vPhase, time * 1.2, worldPos.x)) * 2.0 - 1.0;        
        wobbleX *= 0.02 * vHeight;
        
        float wobbleZ = noise(vec3(pos.y * 8.0 + vPhase + 100.0, time * 1.0, worldPos.z)) * 2.0 - 1.0;        
        wobbleZ *= 0.02 * vHeight;
        
        // Secondary faster flicker
        float flicker = noise(vec3(time * 3.0, vPhase, pos.y * 4.0)) * 2.0 - 1.0;        
        flicker *= 0.02 * vHeight;
        
        // Vertical stretch - flame gets taller when displaced
        float stretch = abs(wobbleX + wobbleZ) * 1.0;
        
        pos.x += wobbleX + flicker;
        pos.z += wobbleZ;
        pos.y += stretch * vHeight;
        
        // Taper at top - pull vertices toward center as they go up
        float taper = 1.0 - vHeight * 0.4;
        pos.x *= taper;
        pos.z *= taper;
        
        vDisplacement = length(vec2(wobbleX, wobbleZ));
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uBaseColor;
      uniform vec3 uMidColor;
      uniform vec3 uTipColor;
      uniform float uIntensity;
      
      varying vec2 vUv;
      varying float vHeight;
      varying float vDisplacement;
      varying float vPhase;
      
      void main() {
        float time = uTime + vPhase;
        
        // Three-color gradient: base (red-orange) -> mid (orange) -> tip (yellow)
        vec3 color;
        if (vHeight < 0.4) {
          color = mix(uBaseColor, uMidColor, vHeight / 0.4);
        } else {
          color = mix(uMidColor, uTipColor, (vHeight - 0.4) / 0.6);
        }
        
        // Intensity flicker
        float flicker = sin(time * 3.0) * sin(time * 8.0 + vPhase) * 0.005;
        float intensity = uIntensity + flicker + vDisplacement * 0.5;
        
        // Brighter core at bottom
        float coreBrightness = 1.0 + (1.0 - vHeight) * 0.4;
        
        // Hot white core at very bottom
        float coreHeat = smoothstep(0.3, 0.0, vHeight);
        color = mix(color, vec3(1.0, 1.0, 0.95), coreHeat * 0.5);
        
        // Edge falloff based on UV (darker at edges)
        float edgeDist = length(vUv - 0.5) * 2.0;
        float edgeFade = 1.0 - smoothstep(0.3, 1.0, edgeDist);
        
        // Final color
        vec3 finalColor = color * intensity * coreBrightness;
        
        // Alpha - more opaque for visibility
        float alpha = (1.0 - vHeight * 0.2) * edgeFade;
        alpha = clamp(alpha, 0.3, 1.0); // Min alpha of 0.3 for visibility
        
        gl_FragColor = vec4(finalColor, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    alphaTest: 0, // Explicitly set to avoid null issues
  })
  
  // Store material for this canvas context
  materialStore.set(canvasId, sharedFlameMaterial)
  
  return sharedFlameMaterial
}

// Update the shared material's time uniform for all canvas contexts
export function updateFlameTime(time, canvasId = 'default') {
  const material = materialStore.get(canvasId)
  if (material && material.uniforms && material.uniforms.uTime) {
    material.uniforms.uTime.value = time
  }
}

// ============================================
// FLAME TIME UPDATER COMPONENT
// Place this once in your scene to update time
// ============================================
export function FlameTimeUpdater({ canvasId = 'default' }) {
  useFrame((state) => {
    updateFlameTime(state.clock.elapsedTime, canvasId)
  })
  return null
}

// ============================================
// SHARED MATERIALS FOR OTHER CANDLE PARTS
// ALL MeshBasicMaterial to minimize uniforms
// ============================================
const sharedCandleMaterials = {
  xbase: null,
  xbaseHovered: null,
  xbaseClicked: null,
  glass: null,
  wick: null,
  default: null,
  senora: null,
  senoraHovered: null,
}

function initSharedCandleMaterials() {
  if (sharedCandleMaterials.xbase) return // Already initialized
  
  // Wax base - BasicMaterial (no lighting, but very cheap)
  sharedCandleMaterials.xbase = new THREE.MeshBasicMaterial({ 
    color: new THREE.Color('#8bec03'),
  })
  
  sharedCandleMaterials.xbaseHovered = new THREE.MeshBasicMaterial({ 
    color: new THREE.Color('#a5ff04'),
  })
  
  sharedCandleMaterials.xbaseClicked = new THREE.MeshBasicMaterial({ 
    color: new THREE.Color('#c0ff20'),
  })
  
  // Glass container
  sharedCandleMaterials.glass = new THREE.MeshBasicMaterial({ 
    color: new THREE.Color('#aaaaaa'),
    transparent: true, 
    opacity: 0.25,
  })
  
  // Wick
  sharedCandleMaterials.wick = new THREE.MeshBasicMaterial({ 
    color: new THREE.Color('#1a1a1a'),
  })
  
  // Default fallback
  sharedCandleMaterials.default = new THREE.MeshBasicMaterial({ 
    color: new THREE.Color('#888888'),
  })
  
  // Senora (label) - will get texture applied later
  sharedCandleMaterials.senora = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ffffff'),
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  })
  
  sharedCandleMaterials.senoraHovered = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ffffcc'),
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  })
}

// ============================================
// CANDLE GEOMETRY WITH SHARED FLAME MATERIAL
// ============================================
export function CandleGeometryWithSharedFlame({ 
  isHovered = false, 
  isClicked = false, 
  modelPath = '/models/tinyVotiveOnly.glb',
  useGLTF,
}) {
  const { scene } = useGLTF(modelPath)
  const groupRef = useRef()
  const labelRef = useRef() // Reference to senora label for billboarding
  const senoraTextureRef = useRef(null)
  const [materialsReady, setMaterialsReady] = useState(false)
  
  // Initialize shared materials
  useEffect(() => {
    initSharedCandleMaterials()
    setMaterialsReady(true)
  }, [])
  
  // Clone scene and apply shared materials
  const clonedScene = useMemo(() => {
    if (!materialsReady) return null
    
    const cloned = scene.clone(true)
    
    // Track if we found a flame mesh
    let foundFlame = false
    
    // Extract senora texture first and apply to shared materials
    cloned.traverse((child) => {
      if (child.isMesh && child.name.toLowerCase() === 'senora' && child.material?.map) {
        senoraTextureRef.current = child.material.map
        // Apply to both shared senora materials
        sharedCandleMaterials.senora.map = child.material.map
        sharedCandleMaterials.senora.needsUpdate = true
        sharedCandleMaterials.senoraHovered.map = child.material.map
        sharedCandleMaterials.senoraHovered.needsUpdate = true
      }
    })
    
    // Apply materials and check for flame
    cloned.traverse((child) => {
      if (!child.isMesh) return
      
      const name = child.name.toLowerCase()
      
      // Check for flame with multiple possible names
      if (name === 'flame' || name.includes('flame') || name.includes('fire')) {
        console.log('Applying shared flame material to:', child.name)
        const flameMat = getSharedFlameMaterial('candle-shrine') // Use specific context
        child.material = flameMat
        child.visible = true // Ensure it's visible
        child.renderOrder = 1 // Render on top
        foundFlame = true
      } else if (name === 'wick' || name.includes('wick')) {
        child.material = sharedCandleMaterials.wick
      } else if (name === 'xbase') {
        child.material = sharedCandleMaterials.xbase
      } else if (name === 'senora') {
        child.material = sharedCandleMaterials.senora
        labelRef.current = child // Store reference for billboarding
      } else if (name === 'glass') {
        child.material = sharedCandleMaterials.glass
      } else {
        child.material = sharedCandleMaterials.default
      }
    })
    
    // If no flame mesh found, create one
    if (!foundFlame) {
      console.log('No flame mesh found, creating one...')
      const flameGeometry = new THREE.ConeGeometry(0.05, 0.15, 8, 1)
      const flameMesh = new THREE.Mesh(flameGeometry, getSharedFlameMaterial('candle-shrine'))
      flameMesh.name = 'flame'
      flameMesh.position.set(0, 0.3, 0) // Position above candle
      cloned.add(flameMesh)
    }
    
    return cloned
  }, [scene, materialsReady])
  
  // Billboarding for senora label
  useFrame((state) => {
    if (labelRef.current && groupRef.current) {
      // Store initial rotation if not set
      if (!labelRef.current.userData.initialRotation) {
        labelRef.current.userData.initialRotation = labelRef.current.rotation.y
      }
      
      // Get the world position of the candle
      const worldPos = new THREE.Vector3()
      groupRef.current.getWorldPosition(worldPos)
      
      // Calculate angle to camera
      const cameraPos = state.camera.position
      const angleToCamera = Math.atan2(
        cameraPos.x - worldPos.x,
        cameraPos.z - worldPos.z
      )
      
      // Get parent's world rotation
      const parentWorldQuaternion = new THREE.Quaternion()
      if (labelRef.current.parent) {
        labelRef.current.parent.getWorldQuaternion(parentWorldQuaternion)
      }
      const euler = new THREE.Euler().setFromQuaternion(parentWorldQuaternion)
      const parentRotationY = euler.y
      
      // Calculate desired rotation to face camera
      let targetRotation = angleToCamera - parentRotationY + Math.PI
      
      // Constrain rotation to prevent backwards facing
      const maxRotation = Math.PI * 0.4 // 72 degrees max rotation
      if (targetRotation > maxRotation) {
        targetRotation = maxRotation
      } else if (targetRotation < -maxRotation) {
        targetRotation = -maxRotation
      }
      
      // Smooth rotation with lerp
      const currentRotation = labelRef.current.rotation.y
      labelRef.current.rotation.y = THREE.MathUtils.lerp(
        currentRotation,
        targetRotation,
        0.1
      )
    }
  })
  
  // Update materials based on hover/click state
  useEffect(() => {
    if (!clonedScene) return
    
    clonedScene.traverse((child) => {
      if (!child.isMesh) return
      
      const name = child.name.toLowerCase()
      
      if (name === 'xbase') {
        if (isClicked) {
          child.material = sharedCandleMaterials.xbaseClicked
        } else if (isHovered) {
          child.material = sharedCandleMaterials.xbaseHovered
        } else {
          child.material = sharedCandleMaterials.xbase
        }
      }
      
      if (name === 'senora') {
        child.material = (isClicked || isHovered) 
          ? sharedCandleMaterials.senoraHovered 
          : sharedCandleMaterials.senora
      }
    })
  }, [clonedScene, isHovered, isClicked])
  
  const scale = isClicked ? 0.6 : isHovered ? 0.55 : 0.5
  
  if (!clonedScene) return null
  
  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} scale={[scale, scale, scale]} />
      <pointLight 
        position={[0, 0.35, 0]} 
        color={isClicked ? "#ffcc00" : isHovered ? "#ff9900" : "#ff6600"} 
        intensity={isClicked ? 0.8 : isHovered ? 0.5 : 0.25} 
        distance={isClicked ? 4 : 2.5} 
      />
    </group>
  )
}

// ============================================
// FULL CANDLE COMPONENT WITH ANIMATION
// ============================================
export function Candle({ 
  index, 
  homePosition, 
  priceDirection = 0, 
  onHover = () => {}, 
  onUnhover = () => {}, 
  onClick = () => {},
  modelPath = '/models/tinyVotiveOnly.glb',
  useGLTF,
}) {
  const ref = useRef()
  const [isHovered, setIsHovered] = useState(false)
  const [isClicked, setIsClicked] = useState(false)
  
  // Per-candle random values for movement
  const randomValues = useMemo(() => ({
    speed: 0.3 + Math.random() * 0.7,
    phase: Math.random() * Math.PI * 2,
    wobbleX: 0.02 + Math.random() * 0.03,
    wobbleZ: 0.02 + Math.random() * 0.03,
    offsetMultiplier: 0.7 + Math.random() * 0.6,
    responseDelay: Math.random() * 0.5,
  }), [])
  
  // Current position for smooth interpolation
  const currentPos = useRef(new THREE.Vector3(...homePosition))
  
  // Movement animation
  useFrame((state, delta) => {
    if (!ref.current) return
    
    const time = state.clock.elapsedTime
    const { speed, phase, wobbleX, wobbleZ, offsetMultiplier, responseDelay } = randomValues
    
    // Target position based on price
    const PRICE_OFFSET_MAX = 5
    const DRIFT_SPEED = 0.5
    
    const priceOffset = priceDirection * PRICE_OFFSET_MAX * offsetMultiplier
    const targetY = homePosition[1] + priceOffset
    const targetX = homePosition[0] + Math.sin(time * speed * 0.3 + phase) * wobbleX * 10
    const targetZ = homePosition[2] + Math.cos(time * speed * 0.3 * 0.7 + phase) * wobbleZ * 10
    
    // Smooth interpolation
    const lerpFactor = 1 - Math.pow(0.1, delta * DRIFT_SPEED * (1 - responseDelay))
    
    currentPos.current.x += (targetX - currentPos.current.x) * lerpFactor
    currentPos.current.y += (targetY - currentPos.current.y) * lerpFactor
    currentPos.current.z += (targetZ - currentPos.current.z) * lerpFactor
    
    ref.current.position.copy(currentPos.current)
    
    // Gentle rotation
    ref.current.rotation.y += delta * 0.1 * speed * (isHovered ? 3 : 1)
  })
  
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
        onClick(index)
        setTimeout(() => setIsClicked(false), 500)
      }}
    >
      <CandleGeometryWithSharedFlame 
        isHovered={isHovered} 
        isClicked={isClicked}
        modelPath={modelPath}
        useGLTF={useGLTF}
      />
    </group>
  )
}

// ============================================
// EXPORTS
// ============================================
export default {
  getSharedFlameMaterial,
  updateFlameTime,
  FlameTimeUpdater,
  CandleGeometryWithSharedFlame,
  Candle,
}