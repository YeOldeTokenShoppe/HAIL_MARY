'use client'
import React, { useRef, useState, useEffect, Suspense, useCallback, useMemo, forwardRef, useImperativeHandle, Component } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stats, useGLTF, Html, OrbitControls } from '@react-three/drei'
import { useLanguage } from './LanguageProvider'

// DEBUG MODE - Set to true to see zones from bird's eye view
const DEBUG_MODE = false
const CANDLE_DURATION_SECONDS = 86400 // 1 day

// Debug visualization component - shows exclusion zones
function DebugZoneVisualization() {
  if (!DEBUG_MODE) return null

  // Body corridor: box from z=-9 to z=6, with wobble buffer
  // halfWidth = 3 + 1 = 4, halfHeight = 4 + 1 = 5
  const corridorDepth = 6 - (-9) // 15 units along Z
  const corridorCenterZ = (-9 + 6) / 2 // z = -1.5
  const corridorWidth = 8 // 2 * halfWidth (3 + 1 wobble buffer)
  const corridorHeight = 10 // 2 * halfHeight (4 + 1 wobble buffer)

  return (
    <group>
      {/* Body corridor - translucent cyan box (no rotation needed) */}
      <mesh position={[0, -1, corridorCenterZ]}>
        <boxGeometry args={[corridorWidth, corridorHeight, corridorDepth]} />
        <meshBasicMaterial color="#00ffff" transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>


      {/* Camera position marker - yellow sphere */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.5, 16, 8]} />
        <meshBasicMaterial color="#ffff00" />
      </mesh>

      {/* Hands/phone position marker - green sphere */}
      <mesh position={[0, -1, -6]}>
        <sphereGeometry args={[0.5, 16, 8]} />
        <meshBasicMaterial color="#00ff00" />
      </mesh>

      {/* Origin marker - red sphere */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.3, 16, 8]} />
        <meshBasicMaterial color="#ff0000" />
      </mesh>

      {/* Axis lines */}
      {/* X axis - red */}
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={2} array={new Float32Array([-20, 0, 0, 20, 0, 0])} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color="#ff0000" />
      </line>

      {/* Y axis - green */}
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={2} array={new Float32Array([0, -20, 0, 0, 20, 0])} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color="#00ff00" />
      </line>

      {/* Z axis - blue */}
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={2} array={new Float32Array([0, 0, -20, 0, 0, 20])} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color="#0000ff" />
      </line>

      {/* Labels */}
      <Html position={[0, 0, 0]} center>
        <div style={{ color: 'yellow', fontSize: '12px', whiteSpace: 'nowrap' }}>Camera [0,0,0]</div>
      </Html>
      <Html position={[0, -1, -6]} center>
        <div style={{ color: 'lime', fontSize: '12px', whiteSpace: 'nowrap' }}>Hands [0,-1,-6]</div>
      </Html>
    </group>
  )
}
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { HandsModel, CameraController } from './HandsGLTFScene'
// IMPORTANT: Import from the optimized version!
import { CandleCloud, GradientBackground, SceneSetup } from './CandleShrine'
import { NewCandleEffectManager } from './NewCandleEffect'
import PostProcessingEffects from './PostProcessingEffects'
import { useStaking } from '@/hooks/useStaking'
import { useReadContract } from 'thirdweb/react'
import { totalSupply } from 'thirdweb/extensions/erc20'
import { erc20Contract } from '@/lib/contract'
import CongregationSentiment from './SentimentData'
import { db, collection, query, orderBy, limit, getDocs } from '@/lib/firebaseClient'




// Simple error boundary for Canvas
class CanvasErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error) {
    console.warn('Canvas render error:', error)
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Canvas error details:', {
      error,
      errorInfo,
      componentStack: errorInfo.componentStack
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)',
          color: '#666',
          textAlign: 'center'
        }}>
          <p>WebGL context temporarily unavailable</p>
          <button onClick={() => window.location.reload()} style={{
            marginTop: '10px',
            padding: '8px 16px',
            background: '#333',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>
            Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// Flickering flame shader material for tiny votive (non-instanced version)
function createTinyFlameMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      varying float vHeight;

      void main() {
        vec3 pos = position;

        // Height normalized 0-1
        vHeight = clamp((pos.y + 0.1) / 0.6, 0.0, 1.0);

        // Flame flicker animation
        float flameTime = uTime * 3.0;

        // Sway side to side
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

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying float vHeight;

      void main() {
        float time = uTime * 3.0;

        // Base flame colors
        vec3 innerColor = vec3(1.0, 0.95, 0.8);
        vec3 midColor = vec3(1.0, 0.5, 0.0);
        vec3 outerColor = vec3(1.0, 0.2, 0.0);

        vec3 color;
        if (vHeight < 0.3) {
          color = mix(innerColor, midColor, vHeight / 0.3);
        } else if (vHeight < 0.7) {
          color = mix(midColor, outerColor, (vHeight - 0.3) / 0.4);
        } else {
          color = mix(outerColor, vec3(1.0, 0.8, 0.0), (vHeight - 0.7) / 0.3);
        }

        float flicker = sin(time * 4.0) * 0.25 + sin(time * 9.0) * 0.15 + 1.0;
        float intensity = 3.5 * flicker;
        float alpha = (1.0 - vHeight * 0.5) * (0.8 + flicker * 0.2);

        gl_FragColor = vec4(color * intensity, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
}

// Tiny votive model for Illumin80 trophy display with custom avatar texture
function TinyVotiveModel({ imageUrl }) {
  const { scene } = useGLTF('/models/tinyVotiveIllumin80.glb')
  const flameMaterialRef = useRef(null)
  const senoraMeshRef = useRef(null)
  const textureRef = useRef(null)
  const prevImageUrlRef = useRef(null)

  // Clone scene and set up materials (only once)
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true)

    // Clone materials so each instance is independent
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone()
      }
    })

    return clone
  }, [scene])

  // Set up flame material once
  useEffect(() => {
    if (!clonedScene) return

    const flameMaterial = createTinyFlameMaterial()
    flameMaterialRef.current = flameMaterial

    clonedScene.traverse((child) => {
      if (child.isMesh) {
        if (child.name === 'Flame') {
          child.material = flameMaterial
        }
        if (child.name === 'senora') {
          senoraMeshRef.current = child
          // Hide initially until texture loads
          child.visible = false
        }
      }
    })

    return () => {
      flameMaterial.dispose()
    }
  }, [clonedScene])

  // Handle texture loading separately - only when imageUrl changes
  useEffect(() => {
    const senoraMesh = senoraMeshRef.current
    if (!senoraMesh || !imageUrl) return

    // Skip if same URL
    if (imageUrl === prevImageUrlRef.current) return
    prevImageUrlRef.current = imageUrl

    const textureLoader = new THREE.TextureLoader()
    textureLoader.crossOrigin = 'anonymous'
    textureLoader.load(imageUrl, (texture) => {
      texture.flipY = false
      texture.colorSpace = THREE.SRGBColorSpace
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter

      // Dispose of old texture if it exists
      if (textureRef.current) {
        textureRef.current.dispose()
      }

      // Update or create material with new texture
      if (senoraMesh.material.isMeshBasicMaterial) {
        senoraMesh.material.map = texture
        senoraMesh.material.needsUpdate = true
      } else {
        senoraMesh.material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          alphaTest: 0.1,
          side: THREE.FrontSide
        })
      }

      // Show the mesh now that texture is ready
      senoraMesh.visible = true
      textureRef.current = texture
    })

    return () => {
      if (textureRef.current) {
        textureRef.current.dispose()
      }
    }
  }, [imageUrl])

  // Animate the flame
  useFrame((state) => {
    if (flameMaterialRef.current) {
      flameMaterialRef.current.uniforms.uTime.value = state.clock.elapsedTime
    }
  })

  return <primitive object={clonedScene} scale={1} position={[0, 0.3, 0]} />
}

// Spinning wrapper for votive model transitions
function SpinningVotive({ imageUrl, spinTrigger }) {
  const groupRef = useRef()
  const spinProgress = useRef(0)
  const isSpinning = useRef(false)
  const lastTrigger = useRef(spinTrigger)

  useFrame((state, delta) => {
    if (!groupRef.current) return

    // Detect trigger change to start spin
    if (spinTrigger !== lastTrigger.current) {
      lastTrigger.current = spinTrigger
      isSpinning.current = true
      spinProgress.current = 0
    }

    // Animate spin
    if (isSpinning.current) {
      spinProgress.current += delta * 4 // ~0.5 second for full rotation
      const progress = Math.min(spinProgress.current, 1)

      // Ease out cubic for smooth deceleration
      const eased = 1 - Math.pow(1 - progress, 3)
      groupRef.current.rotation.y = eased * Math.PI * 2

      if (progress >= 1) {
        isSpinning.current = false
        groupRef.current.rotation.y = 0
      }
    }
  })

  return (
    <group ref={groupRef}>
      <TinyVotiveModel imageUrl={imageUrl} />
    </group>
  )
}

// Scrollable message for candle prayers - fixed height on mobile
function ExpandableMessage({ message, isMobile }) {
  return (
    <div style={{
      fontSize: isMobile ? '10px' : '11px',
      color: 'rgba(255, 255, 255, 0.7)',
      fontStyle: 'italic',
      padding: '8px',
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '6px',
      lineHeight: '1.4',
      maxHeight: isMobile ? '3.6em' : '5em',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      "{message}"
    </div>
  )
}

// Leaderboard Trophy Carousel
function LeaderboardCarousel({ leaderboardData, isMobile, sortMode = 'topBurners' }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [spinTrigger, setSpinTrigger] = useState(0)
  const [freshAvatars, setFreshAvatars] = useState({})

  // Reset index when data changes (e.g., sort mode switch)
  useEffect(() => {
    setCurrentIndex(0)
  }, [sortMode])

  // Fetch fresh avatar URLs from Clerk via API
  useEffect(() => {
    const fetchAvatars = async () => {
      const avatarPromises = leaderboardData.map(async (leader) => {
        if (!leader.userId) return { id: leader.id, imageUrl: leader.userImageUrl }

        try {
          const res = await fetch(`/api/user-avatar/${leader.userId}`)
          if (res.ok) {
            const data = await res.json()
            return { id: leader.id, imageUrl: data.imageUrl }
          }
        } catch (err) {
          console.warn('Failed to fetch avatar for', leader.userId, err)
        }
        // Fallback to stored URL
        return { id: leader.id, imageUrl: leader.userImageUrl }
      })

      const results = await Promise.all(avatarPromises)
      const avatarMap = {}
      results.forEach(r => { avatarMap[r.id] = r.imageUrl })
      setFreshAvatars(avatarMap)
    }

    if (leaderboardData.length > 0) {
      fetchAvatars()
    }
  }, [leaderboardData])

  const currentLeader = leaderboardData[currentIndex]

  // Use fresh avatar if available, fallback to stored
  const currentAvatarUrl = currentLeader
    ? (freshAvatars[currentLeader.id] || currentLeader.userImageUrl)
    : null

  const goNext = () => {
    setSpinTrigger(prev => prev + 1)
    setCurrentIndex((prev) => (prev + 1) % leaderboardData.length)
  }

  const goPrev = () => {
    setSpinTrigger(prev => prev + 1)
    setCurrentIndex((prev) => (prev - 1 + leaderboardData.length) % leaderboardData.length)
  }

  const formatBurned = (amount) => {
    if (amount >= 1000000000) return `${(amount / 1000000000).toFixed(1)}B`
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`
    return amount?.toLocaleString() || '0'
  }

  const getRankDisplay = (index) => {
    // if (sortMode === 'recent') return '🕯️'
    // if (index === 0) return '👑'
    // if (index === 1) return '🥈'
    // if (index === 2) return '🥉'
    // return `#${index + 1}`
  }

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return ''
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  if (!currentLeader) return null

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 4], fov: 35 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[2, 2, 2]} intensity={1} color="#ff9500" />
        <pointLight position={[-2, -1, 1]} intensity={0.5} color="#ff6600" />
        <Suspense fallback={null}>
          <SpinningVotive
            imageUrl={currentAvatarUrl
              ? `${currentAvatarUrl}?width=512&height=512`
              : null
            }
            spinTrigger={spinTrigger}
          />
        </Suspense>
        <OrbitControls enableZoom={false} enablePan={false} autoRotate={false} />
        <EffectComposer>
          <Bloom
            intensity={1.5}
            luminanceThreshold={0.4}
            luminanceSmoothing={0.9}
            blendFunction={BlendFunction.SCREEN}
          />
        </EffectComposer>
      </Canvas>

      {/* Navigation Arrows */}
      {leaderboardData.length > 1 && (
        <>
          <button
            onClick={goPrev}
            style={{
              position: 'absolute',
              left: '4px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(255, 149, 0, 0.3)',
              border: '1px solid rgba(255, 149, 0, 0.5)',
              borderRadius: '50%',
              width: isMobile ? '24px' : '28px',
              height: isMobile ? '24px' : '28px',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isMobile ? '12px' : '14px',
              zIndex: 10
            }}
          >
            ‹
          </button>
          <button
            onClick={goNext}
            style={{
              position: 'absolute',
              right: '4px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(255, 149, 0, 0.3)',
              border: '1px solid rgba(255, 149, 0, 0.5)',
              borderRadius: '50%',
              width: isMobile ? '24px' : '28px',
              height: isMobile ? '24px' : '28px',
              color: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: isMobile ? '12px' : '14px',
              zIndex: 10
            }}
          >
            ›
          </button>
        </>
      )}

      {/* User Info Overlay */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '8px',
        padding: isMobile ? '4px 10px' : '6px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        border: '1px solid rgba(255, 149, 0, 0.3)',
        zIndex: 10
      }}>
        <span style={{
          fontSize: isMobile ? '14px' : '16px',
          fontWeight: 'bold',
          color: currentIndex === 0 ? '#ffd700' : currentIndex === 1 ? '#c0c0c0' : currentIndex === 2 ? '#cd7f32' : '#fff'
        }}>
          {getRankDisplay(currentIndex)}
        </span>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}>
          <span style={{
            fontSize: isMobile ? '11px' : '13px',
            color: (!currentLeader.username || currentLeader.username === 'Anonymous') ? '#ffaa00' : '#fff',
            fontWeight: 'bold',
          }}>
            {(!currentLeader.username || currentLeader.username === 'Anonymous') ? 'St. GR80' : currentLeader.username}
          </span>
          <span style={{
            fontSize: isMobile ? '9px' : '10px',
            color: sortMode === 'recent' ? '#00f5d4' : '#ff9500',
            fontFamily: 'monospace',
            fontWeight: 'bold'
          }}>
            {sortMode === 'recent' ? getTimeAgo(currentLeader.litAt) : formatBurned(currentLeader.totalBurned)}
          </span>
        </div>
      </div>

      {/* Position Counter */}
      {leaderboardData.length > 1 && (
        <div style={{
          position: 'absolute',
          top: '6px',
          right: '8px',
          background: 'rgba(0, 0, 0, 0.5)',
          borderRadius: '10px',
          padding: '2px 8px',
          fontSize: isMobile ? '9px' : '10px',
          color: 'rgba(255, 255, 255, 0.6)',
          fontFamily: 'monospace',
          zIndex: 10
        }}>
          {currentIndex + 1}/{leaderboardData.length}
        </div>
      )}
    </div>
  )
}

// Highlighted candle with attached label
function HighlightedCandleGroup({ position, userData, visible }) {
  if (!position) return null
  
  // Format the date nicely
  const formatDate = (date) => {
    if (!date) return 'Unknown'
    
    // Handle Firestore Timestamp objects
    let d
    if (date && typeof date.toDate === 'function') {
      d = date.toDate()
    } else if (date instanceof Date) {
      d = date
    } else if (typeof date === 'string' || typeof date === 'number') {
      d = new Date(date)
    } else {
      return 'Unknown'
    }
    
    // Check if date is valid
    if (isNaN(d.getTime())) return 'Unknown'
    
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
    return d.toLocaleDateString()
  }

  return (
    <group position={position}>
      {/* Subtle highlight ring at ground level */}
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 2, 32, 1]} />
        <meshBasicMaterial
          color="#00ff88"
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Html label attached to candle group */}
      {userData && visible && (
        <Html
          position={[0, 1.2, 0]}
          center
          style={{
            transition: 'opacity 0.2s',
            opacity: visible ? 1 : 0,
            pointerEvents: 'none',
            transform: 'scale(0.8)'
          }}
        >
          <div style={{
            background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.95), rgba(40, 40, 40, 0.95))',
            color: '#fff',
            padding: '8px 10px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontSize: '11px',
            width: '120px',
            border: '1px solid rgba(255, 215, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)'
          }}>
            {/* User info header */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
            }}>
              {/* Avatar */}
              {userData.userImageUrl ? (
                <img 
                  src={userData.userImageUrl} 
                  alt={userData.username}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: '2px solid rgba(255, 215, 0, 0.5)',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #ffaa00, #ff8800)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#fff',
                  border: '2px solid rgba(255, 215, 0, 0.5)'
                }}>
                  {userData.username?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              
              {/* Name and time */}
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontWeight: 'bold', 
                  fontSize: '11px',
                  color: '#ffcc00'
                }}>
                  {userData.username}
                </div>
                <div style={{ 
                  fontSize: '9px', 
                  opacity: 0.7,
                  marginTop: '2px'
                }}>
                  Lit {formatDate(userData.litDate)}
                </div>
              </div>
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

// Camera animator for smooth look-at transitions and reset to default
function CameraAnimator({ targetPosition, resetToDefault, isMobile }) {
  const { camera } = useThree()
  const startQuaternion = useRef(null)
  const startPosition = useRef(null)
  const targetQuaternion = useRef(new THREE.Quaternion())
  const targetPositionVec = useRef(new THREE.Vector3())
  const tempMatrix = useRef(new THREE.Matrix4())
  const progress = useRef(0)
  const isResetting = useRef(false)
  const initialCameraState = useRef(null)
  const startFOV = useRef(null)
  const targetFOV = useRef(null)
  
  // Store the initial camera state on first render
  useEffect(() => {
    if (!initialCameraState.current) {
      initialCameraState.current = {
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
        fov: camera.fov
      }
    }
  }, [camera])
  
  // Default camera settings (fallback if initial state not captured)
  const defaultPosition = initialCameraState.current?.position || new THREE.Vector3(0, 0, isMobile ? 2 : 0)
  const defaultQuaternion = initialCameraState.current?.quaternion || new THREE.Quaternion()
  
  useEffect(() => {
    if (resetToDefault && initialCameraState.current) {
      // Reset to initial camera position and rotation
      startPosition.current = camera.position.clone()
      startQuaternion.current = camera.quaternion.clone()
      startFOV.current = camera.fov
      
      // Use the stored initial camera state
      targetQuaternion.current.copy(initialCameraState.current.quaternion)
      targetPositionVec.current.copy(initialCameraState.current.position)
      targetFOV.current = initialCameraState.current.fov
      
      progress.current = 0
      isResetting.current = true
    } else if (targetPosition && initialCameraState.current) {
      // First move camera to initial position, then look at candle
      startPosition.current = camera.position.clone()
      startQuaternion.current = camera.quaternion.clone()
      startFOV.current = camera.fov
      
      // Keep camera at initial position but look at candle
      targetPositionVec.current.copy(initialCameraState.current.position)
      
      // Calculate rotation to look at candle from initial position
      const lookAtPos = new THREE.Vector3(
        targetPosition.target[0],
        targetPosition.target[1] + 1,  // Look slightly above the candle base
        targetPosition.target[2]
      )
      
      tempMatrix.current.lookAt(initialCameraState.current.position, lookAtPos, camera.up)
      targetQuaternion.current.setFromRotationMatrix(tempMatrix.current)
      
      // Modest zoom in by reducing FOV when looking at candle
      targetFOV.current = isMobile ? 50 : 45  // Less aggressive zoom
      
      progress.current = 0
      isResetting.current = false
    }
  }, [targetPosition, resetToDefault, camera, isMobile])
  
  useFrame((state, delta) => {
    if ((targetPosition || isResetting.current) && startQuaternion.current) {
      if (progress.current < 1) {
        // Animate over 1.5 seconds
        progress.current = Math.min(progress.current + delta * 0.67, 1)
        
        const easeProgress = 1 - Math.pow(1 - progress.current, 3) // Ease out cubic
        
        // Always interpolate rotation
        camera.quaternion.slerpQuaternions(
          startQuaternion.current,
          targetQuaternion.current,
          easeProgress
        )
        
        // Always interpolate position (for both reset and look-at)
        if (startPosition.current) {
          camera.position.lerpVectors(
            startPosition.current,
            targetPositionVec.current,
            easeProgress
          )
        }
        
        // Interpolate FOV for zoom effect
        if (startFOV.current && targetFOV.current) {
          camera.fov = THREE.MathUtils.lerp(startFOV.current, targetFOV.current, easeProgress)
        }
        
        camera.updateProjectionMatrix()
      } else if (targetPosition && !isResetting.current) {
        // Keep looking at target after animation (same offset as animation target)
        camera.lookAt(
          targetPosition.target[0],
          targetPosition.target[1] + 1,  // Same +1 offset used during animation
          targetPosition.target[2]
        )
        camera.updateProjectionMatrix()
      } else if (isResetting.current && initialCameraState.current) {
        // Ensure we're at initial position after reset
        camera.position.copy(initialCameraState.current.position)
        camera.quaternion.copy(initialCameraState.current.quaternion)
        camera.updateProjectionMatrix()
        isResetting.current = false
      }
    } else if (!targetPosition) {
      // Smoothly reset to look at center
      const center = new THREE.Vector3(0, 0, 0)
      const currentLookAt = new THREE.Vector3(0, 0, -1)
      currentLookAt.applyQuaternion(camera.quaternion)
      currentLookAt.add(camera.position)
      
      currentLookAt.lerp(center, 0.05)
      camera.lookAt(currentLookAt)
      camera.updateProjectionMatrix()
    }
  })
  
  return null
}

// Candle label component - shows info on hover
function CandleLabel({ position, data, visible }) {
  if (!visible || !position || !data) return null
  
  // Format the date nicely
  const formatDate = (date) => {
    if (!date) return 'Unknown'
    
    // Handle Firestore Timestamp objects
    let d
    if (date && typeof date.toDate === 'function') {
      d = date.toDate()
    } else if (date instanceof Date) {
      d = date
    } else if (typeof date === 'string' || typeof date === 'number') {
      d = new Date(date)
    } else {
      return 'Unknown'
    }
    
    // Check if date is valid
    if (isNaN(d.getTime())) return 'Unknown'
    
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
    return d.toLocaleDateString()
  }
  
  // Position the label above the candle with better spacing
  const adjustedPosition = Array.isArray(position) 
    ? [position[0], position[1] + 0.8, position[2]]
    : [position.x, position.y + 0.8, position.z]
  
  return (
    <Html
      position={adjustedPosition}
      sprite
      center
      distanceFactor={25}
      style={{
        transition: 'opacity 0.2s',
        opacity: visible ? 1 : 0,
        pointerEvents: 'none',
        zIndex: 1000,
        transform: 'scale(0.8)'
      }}
    >
        <div style={{
          background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.95), rgba(40, 40, 40, 0.95))',
          color: '#fff',
          padding: '8px 10px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.8)',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: '11px',
          width: '120px',
          border: '1px solid rgba(255, 215, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)'
        }}>
          {/* User info header */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            // marginBottom: '12px',
            // paddingBottom: '12px',
            // borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            {/* Avatar */}
            {data.userImageUrl ? (
              <img 
                src={data.userImageUrl} 
                alt={data.username}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  border: '2px solid rgba(255, 215, 0, 0.5)',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ffaa00, #ff8800)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#fff',
                border: '2px solid rgba(255, 215, 0, 0.5)'
              }}>
                {data.username?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            
            {/* Name and time */}
            <div style={{ flex: 1 }}>
              <div style={{ 
                fontWeight: 'bold', 
                fontSize: '11px',
                color: '#ffcc00'
              }}>
                {data.username}
              </div>
              <div style={{ 
                fontSize: '9px', 
                opacity: 0.7,
                marginTop: '2px'
              }}>
{data.litAt}
              </div>
            </div>
          </div>
          
          {/* Message */}
          {/* {data.message && (
            <div style={{ 
              fontSize: '13px', 
              fontStyle: 'italic',
              opacity: 0.9,
              lineHeight: '1.4'
            }}>
              "{data.message}"
            </div>
          )} */}
        </div>
      </Html>
  )
}

// Scene rotation controller - handles rotation without blocking clicks
function SceneRotator({ children, userRotation, userVerticalRotation = 0, smoothTransition = false, onRotationStart, onRotationMove, onRotationEnd }) {
  const groupRef = useRef()
  const [isPointerDown, setIsPointerDown] = useState(false)

  useFrame(() => {
    if (groupRef.current) {
      if (smoothTransition) {
        // Lerp toward target for smooth reset animation
        groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, userRotation, 0.08)
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, userVerticalRotation, 0.08)
      } else {
        // Snap immediately during active dragging
        groupRef.current.rotation.y = userRotation
        groupRef.current.rotation.x = userVerticalRotation
      }
    }
  })
  
  return (
    <>
      {/* Invisible background plane for rotation - render first so it's behind everything */}
      <mesh
        position={[0, 0, 0]}
        onPointerDown={(e) => {
          e.stopPropagation()
          setIsPointerDown(true)
          onRotationStart(e)
        }}
        onPointerMove={(e) => {
          if (isPointerDown) {
            e.stopPropagation()
            onRotationMove(e)
          }
        }}
        onPointerUp={(e) => {
          e.stopPropagation()
          setIsPointerDown(false)
          onRotationEnd()
        }}
        onPointerLeave={(e) => {
          if (isPointerDown) {
            e.stopPropagation()
            setIsPointerDown(false)
            onRotationEnd()
          }
        }}
        onPointerCancel={(e) => {
          e.stopPropagation()
          setIsPointerDown(false)
          onRotationEnd()
        }}
      >
  <planeGeometry args={[1000, 1000]} />
  <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
        </mesh>
      
      {/* Actual scene content that rotates */}
      <group ref={groupRef}>{children}</group>
    </>
  )
}

// Optimized PriceSimulator - uses refs instead of state for animation
// Only updates React state at throttled intervals for UI
// FIXED: Constant offset accumulation - price only affects colors, not motion
function OptimizedPriceSimulator({ priceRef, shortTermPriceRef, continuousOffsetRef, onUIUpdate, disabled = false }) {
  const lastUIUpdate = useRef(0)
  const lastPriceUpdate = useRef(0)
  const lastFrameTime = useRef(0)
  const currentPrice = useRef(0)
  const targetPrice = useRef(0)
  const UI_UPDATE_INTERVAL = 1000
  const PRICE_CHANGE_INTERVAL = 5000
  
  useFrame((state) => {
    if (disabled) return
    
    const now = state.clock.elapsedTime * 1000
    const deltaTime = lastFrameTime.current ? (now - lastFrameTime.current) / 1000 : 0.016
    lastFrameTime.current = now
    
    // Generate new price target every PRICE_CHANGE_INTERVAL
    if (now - lastPriceUpdate.current > PRICE_CHANGE_INTERVAL) {
      lastPriceUpdate.current = now
      const changePercent = (Math.random() - 0.5) * 0.1
      targetPrice.current = currentPrice.current + changePercent
      if (Math.random() < 0.1) {
        targetPrice.current += (Math.random() - 0.5) * 0.3
      }
    }
    
    // Smooth price interpolation (for color changes only)
    const priceFactor = 1.0 - Math.exp(-deltaTime * 0.8)
    currentPrice.current += (targetPrice.current - currentPrice.current) * priceFactor
    
    // === KEY: Constant accumulation rate - no price influence ===
    // This guarantees perfectly smooth motion
    const CONSTANT_SPEED = 0.5
    continuousOffsetRef.current += deltaTime * CONSTANT_SPEED
    
    // Wrap the offset to prevent floating point precision issues
    // Keep it within a reasonable range (0-1000) since shaders use modulo anyway
    if (continuousOffsetRef.current > 1000) {
      continuousOffsetRef.current -= 1000
    }
    
    // Update refs for shaders (price still used for colors)
    priceRef.current = currentPrice.current
    if (shortTermPriceRef) shortTermPriceRef.current = 0 // Not used anymore
    
    // Throttle UI updates
    if (now - lastUIUpdate.current > UI_UPDATE_INTERVAL) {
      lastUIUpdate.current = now
      onUIUpdate(currentPrice.current)
    }
  })
  
  return null
}





// Memoized gradient that reads from ref


// Main component
const UnifiedShrine = forwardRef(function UnifiedShrine({
  offerings = [],
  totalOfferingsCount = 0,
  onSelectOffering,
  onLightCandle,
  onPriceChange,
  currentUserId = 'testUser123',
  is80sMode,
  hoveredOffering,
  justLitOffering,
  onJustLitComplete,
  user = null,
  onViewReset,
  // External help overlay control (optional - uses internal state if not provided)
  showHelpOverlay: externalShowHelp,
  onToggleHelp,
  // Sort and selection props for stats panel
  sortOption = 'topBurners',
  onSortChange,
  selectedCandle = null,
  // Callback to refresh offerings after candle effect completes
  onRefreshOfferings
}, ref) {
  const { t } = useLanguage()
  // Track if component is mounted for SSR safety
  const [mounted, setMounted] = useState(false)
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false)
  // Focus mode for phone zoom
  const [focusMode, setFocusMode] = useState(false)
  // Fresh avatar URL for selected candle (fetched from Clerk API)
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(null)
  const [selectedAvatarFailed, setSelectedAvatarFailed] = useState(false)
  // Use refs for real-time price and movement (no re-renders)
  const priceRef = useRef(0)
  const shortTermPriceRef = useRef(0)
  const continuousOffsetRef = useRef(0)
// const [bloomIntensity, setBloomIntensity] = useState(1.2) // Disabled for stability
  const effectRef = useRef()
  
  
  // State only for UI display (throttled updates)
  const [displayPrice, setDisplayPrice] = useState({
    direction: 0,
    change: 0,
    tokenPrice: 0.000420,
  })
  
  // TEST SLIDER CONTROL - Disabled
  const testPriceOverride = null // const [testPriceOverride, setTestPriceOverride] = useState(null)
  // const [showTestControls, setShowTestControls] = useState(true)
  
  // additionalCandles removed - candles now use stored positions from Firestore
  // The NewCandleEffect flies to the exact position stored with the offering

  // Track previous offering candles to prevent sudden disappearance
  const prevOfferingCandlesRef = useRef([])

  // Convert offerings to candle positions for CandleCloud
  // Uses priority zone system to position candles in front of the camera
  const offeringCandles = useMemo(() => {
    console.log('[UnifiedShrine] offeringCandles useMemo - offerings:', offerings?.length, 'prev:', prevOfferingCandlesRef.current?.length)

    if (!offerings || offerings.length === 0) {
      // If we had candles before but offerings is now empty, this might be a bug
      // Return previous candles to prevent flickering
      if (prevOfferingCandlesRef.current.length > 0) {
        console.warn('[UnifiedShrine] offerings became empty but had candles before - preserving previous candles')
        return prevOfferingCandlesRef.current
      }
      return []
    }

    // Priority zones - candles positioned in front of camera (looking at negative Z)
    // Camera is at [0, 0, 15], Mary is at z=-8 to -12
    const PRIORITY_ZONES = [
      { capacity: 25, x: { min: -6, max: 6 }, y: { min: -1, max: 3 }, z: { min: -8, max: -4 } },      // Zone 1: Tight cluster flanking phone
      { capacity: 40, x: { min: -10, max: 10 }, y: { min: -2, max: 5 }, z: { min: -10, max: -3 } },   // Zone 2: Good visibility
      { capacity: 60, x: { min: -14, max: 14 }, y: { min: -3, max: 8 }, z: { min: -14, max: -2 } },   // Zone 3: Peripheral
      { capacity: Infinity, x: { min: -20, max: 20 }, y: { min: -5, max: 12 }, z: { min: -20, max: 0 } } // Zone 4: Overflow
    ]

    // Body corridor exclusion (viewer's body area)
    const BODY_CORRIDOR = {
      centerX: 0, centerY: -1,
      zMin: -9, zMax: 6,
      halfWidth: 4, halfHeight: 5
    }

    // Simple hash function for consistent random values
    const hashCode = (str) => {
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash
      }
      return Math.abs(hash)
    }

    // Seeded random generator
    const seededRandom = (seed, min = 0, max = 1) => {
      const x = Math.sin(seed) * 10000
      return min + (x - Math.floor(x)) * (max - min)
    }

    // Get appropriate zone for candle index
    const getZone = (index) => {
      let count = 0
      for (const zone of PRIORITY_ZONES) {
        count += zone.capacity
        if (index < count) return zone
      }
      return PRIORITY_ZONES[PRIORITY_ZONES.length - 1]
    }

    const usedPositions = []

    const result = offerings.map((offering, index) => {
      const seed = hashCode(offering.id || `offering_${index}`)

      // Use stored position from Firestore if available
      const storedPos = offering.position
      let x, y, z

      if (storedPos?.x !== undefined) {
        x = storedPos.x
        y = storedPos.y
        z = storedPos.z
      } else {
        // Generate position in appropriate priority zone
        const zone = getZone(index)

        // Try multiple attempts to find non-overlapping position
        for (let attempt = 0; attempt < 10; attempt++) {
          const attemptSeed = seed + attempt * 100
          x = seededRandom(attemptSeed + 1, zone.x.min, zone.x.max)
          y = seededRandom(attemptSeed + 2, zone.y.min, zone.y.max)
          z = seededRandom(attemptSeed + 3, zone.z.min, zone.z.max)

          // Check body corridor exclusion
          if (z >= BODY_CORRIDOR.zMin && z <= BODY_CORRIDOR.zMax) {
            const inXRange = Math.abs(x - BODY_CORRIDOR.centerX) < BODY_CORRIDOR.halfWidth
            const inYRange = Math.abs(y - BODY_CORRIDOR.centerY) < BODY_CORRIDOR.halfHeight
            if (inXRange && inYRange) {
              // Alternate sides based on index + attempt for even distribution
              const pushDir = (index + attempt) % 2 === 0 ? 1 : -1
              x = pushDir * (BODY_CORRIDOR.halfWidth + 0.5 + seededRandom(attemptSeed + 10, 0, 2))
            }
          }

          // Check minimum distance from other candles
          const tooClose = usedPositions.some(pos => {
            const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2 + (z - pos.z) ** 2)
            return dist < 2.0
          })

          if (!tooClose) break
        }
      }

      usedPositions.push({ x, y, z })

      return {
        position: [x, y, z],
        x, y, z,
        rotation: seededRandom(seed + 4, 0, Math.PI * 2),
        scale: seededRandom(seed + 5, 0.8, 1.2),
        offering: offering,
        userId: offering.userId || offering.uid || `user_${index}`,
        username: offering.userName || offering.username || 'Anonymous',
        id: offering.id || `offering_${index}`,
        litAt: offering.litAt || offering.createdAt?.toDate?.()?.getTime?.() || offering.timestamp?.toDate?.()?.getTime?.(),
        isPlaceholder: offering.isPlaceholder || false
      }
    })

    // Store the computed candles to prevent sudden disappearance
    if (result.length > 0) {
      prevOfferingCandlesRef.current = result
    }

    console.log('[UnifiedShrine] offeringCandles computed:', result.length, 'candles')
    return result
  }, [offerings])

  // Fetch fresh avatar when selected candle changes
  useEffect(() => {
    setSelectedAvatarUrl(null)
    setSelectedAvatarFailed(false)
    if (!selectedCandle) return
    const userId = selectedCandle.userId || selectedCandle.uid
    if (!userId || selectedCandle.isPlaceholder) {
      // Use stored URL for placeholders
      setSelectedAvatarUrl(selectedCandle.userImageUrl || null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/user-avatar/${userId}`)
        if (!cancelled && res.ok) {
          const data = await res.json()
          setSelectedAvatarUrl(data.imageUrl || selectedCandle.userImageUrl || null)
          return
        }
      } catch (e) { /* fall through */ }
      // Fallback to stored URL
      if (!cancelled) setSelectedAvatarUrl(selectedCandle.userImageUrl || null)
    })()
    return () => { cancelled = true }
  }, [selectedCandle?.id, selectedCandle?.userId])

  // Recent offerings sorted by time for carousel display
  const recentOfferingsData = useMemo(() => {
    if (!offerings || offerings.length === 0) return []
    const realOfferings = [...offerings].filter(o => !o.isPlaceholder)
    const sorted = realOfferings.sort((a, b) => {
      const aTime = a.litAt || a.createdAt?.toDate?.()?.getTime?.() || a.timestamp?.toDate?.()?.getTime?.() || 0
      const bTime = b.litAt || b.createdAt?.toDate?.()?.getTime?.() || b.timestamp?.toDate?.()?.getTime?.() || 0
      return bTime - aTime // Most recent first
    })
    const result = sorted.map((offering, index) => ({
      id: offering.id,
      rank: index + 1,
      userId: offering.userId || offering.uid,
      username: offering.name || offering.userName || offering.username || 'Anonymous',
      userImageUrl: offering.userImageUrl || offering.userImage || offering.avatar,
      totalBurned: offering.tokensBurned || 0,
      litAt: offering.litAt || offering.createdAt?.toDate?.()?.getTime?.() || offering.timestamp?.toDate?.()?.getTime?.()
    }))
    console.log('[UnifiedShrine] recentOfferingsData:', result.length, 'real offerings out of', offerings.length, 'total')
    return result
  }, [offerings])

  // Debug logging: track candle count changes
  useEffect(() => {
    console.log(`[UnifiedShrine] Candles: ${offeringCandles.length} total`)
    if (offeringCandles.length === 0 && prevOfferingCandlesRef.current.length > 0) {
      console.error('[UnifiedShrine] WARNING: All candles disappeared! Previous count was:', prevOfferingCandlesRef.current.length)
    }
  }, [offeringCandles])

  // Cleanup expired candles every minute
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Date.now()

      // Find expired offerings
      const expiredOfferings = offerings.filter(offering => {
        const litAtTime = offering.litAt || offering.createdAt?.toDate?.()?.getTime?.() || offering.timestamp?.toDate?.()?.getTime?.()
        
        
        if (!litAtTime) {
          return false
        }
        
        const elapsed = (now - litAtTime) / 1000
        const isExpired = elapsed >= (CANDLE_DURATION_SECONDS - 1) // Remove just before fully melted
        
        
        if (isExpired) {
        }
        
        return isExpired
      })
      
      
      // Remove expired offerings from Firestore
      if (expiredOfferings.length > 0) {
        
        for (const offering of expiredOfferings) {
          try {
            // Import deleteDoc and doc from firebaseClient
            const { deleteDoc, doc, db } = await import('@/lib/firebaseClient')
            await deleteDoc(doc(db, 'offerings', offering.id))
          } catch (error) {
            console.error(`❌ Failed to remove expired candle ${offering.id}:`, error)
          }
        }
      }
    }, 10000) // Check every 10 seconds for testing
    
    return () => clearInterval(interval)
  }, [offerings])
  
  const [clickedCandleId, setClickedCandleId] = useState(null)
  const [isRippleActive, setIsRippleActive] = useState(false)
  const [activeStatsTab, setActiveStatsTab] = useState('leaders') // 'leaders', 'price', 'staking', or 'pulse'
  const [internalShowHelp, setInternalShowHelp] = useState(false) // Internal help state (fallback)
  const [statsBoxCollapsed, setStatsBoxCollapsed] = useState(true) // Collapsed stats box - closed by default
  const [activeAnnotationId, setActiveAnnotationId] = useState(null) // Which annotation label is shown

  // Use external help control if provided, otherwise use internal state
  const showHelpOverlay = externalShowHelp !== undefined ? externalShowHelp : internalShowHelp
  const toggleHelpOverlay = onToggleHelp || (() => setInternalShowHelp(prev => !prev))
  const dismissHelpOverlay = () => {
    setActiveAnnotationId(null) // Clear active annotation when dismissing
    if (onToggleHelp && showHelpOverlay) {
      onToggleHelp() // Toggle off if external
    } else {
      setInternalShowHelp(false)
    }
  }
  const [userCandleData, setUserCandleData] = useState(null) // Store user's candle data for tooltip
  const [hoveredCandleId, setHoveredCandleId] = useState(null)
  const [targetCameraPosition, setTargetCameraPosition] = useState(null) // For camera movement
  const [userCandlePosition, setUserCandlePosition] = useState(null) // Store 3D position
  const [resetCameraToDefault, setResetCameraToDefault] = useState(false) // Reset camera flag
  const [overrideCameraControl, setOverrideCameraControl] = useState(false) // Override all camera controls
  const [smoothRotationReset, setSmoothRotationReset] = useState(false) // Smooth lerp back to center
  const [leaderboardData, setLeaderboardData] = useState([]) // Top burners for leaderboard
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboard = async () => {
      if (!db) return
      setLeaderboardLoading(true)
      try {
        const leaderboardQuery = query(
          collection(db, 'userStats'),
          orderBy('totalBurned', 'desc'),
          limit(20)
        )
        const snapshot = await getDocs(leaderboardQuery)
        const leaders = snapshot.docs.map((doc, index) => ({
          id: doc.id,
          rank: index + 1,
          ...doc.data()
        }))
        setLeaderboardData(leaders)
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error)
      } finally {
        setLeaderboardLoading(false)
      }
    }

    fetchLeaderboard()
    // Refresh leaderboard every 60 seconds
    const interval = setInterval(fetchLeaderboard, 60000)
    return () => clearInterval(interval)
  }, [])

  // Get staking data
  const { 
    totalStaked,
    rewardPerToken
  } = useStaking()
  
  // Calculate TVL based on total staked
  const calculateTVL = useMemo(() => {
    // Using the actual token price from displayPrice
    const tokenPrice = displayPrice.tokenPrice || 0.001
    const tvl = (parseFloat(totalStaked || 0) * tokenPrice)
    // Format based on size
    if (tvl >= 1000000) return `${(tvl / 1000000).toFixed(2)}M`
    if (tvl >= 1000) return `${(tvl / 1000).toFixed(2)}K`
    return tvl.toFixed(2)
  }, [totalStaked, displayPrice.tokenPrice])
  
  // Calculate APR based on reward rate
  const calculateAPR = useMemo(() => {
    if (!totalStaked || parseFloat(totalStaked) === 0) return '0.0'
    
    // Base APR calculation - this is a simplified version
    // In production, would need to factor in reward rate from contract
    const rewardRate = parseFloat(rewardPerToken || 0)
    const baseAPR = rewardRate > 0 ? (rewardRate * 365 * 100).toFixed(1) : '15.0' // Default 15% APR
    
    return baseAPR
  }, [totalStaked, rewardPerToken])
  
  // Mock total rewards paid (in production, fetch from contract events)
  const totalRewardsPaid = useMemo(() => {
    // This would be calculated from contract events
    const mockRewards = 0.05 // Mock 0.05 ETH total rewards
    return mockRewards.toFixed(4)
  }, [])
  
  // Store the user's rotation before resetting
  const savedUserRotation = useRef(0)
  const userRotationRef = useRef(0)
  
  // Method to find and highlight user's candle
  const findUserCandle = useCallback(() => {
    // Cancel any in-progress reset so the find animation takes priority
    setResetCameraToDefault(false)

    // Override all camera controls
    setOverrideCameraControl(true)

    // Save current rotation (don't reset - let camera animation handle the transition)
    savedUserRotation.current = userRotationRef.current
    
    // Find user's candle directly from the offeringCandles computed in the component
    const userCandleIndex = offeringCandles.findIndex(c => c.userId === currentUserId)
    
    if (userCandleIndex !== -1) {
      const userCandle = offeringCandles[userCandleIndex]
      
      // Instance ID is simply the index since all candles come from offerings (CANDLE_COUNT = 0)
      const actualInstanceId = userCandleIndex
      

      
      // Use the position from the userCandle (already converted)
      const candlePosition = userCandle.position || [userCandle.x, userCandle.y, userCandle.z]
      
      setUserCandlePosition(candlePosition)
      
      
      // Set camera to look at the candle (rotation only, no position change)
      setTargetCameraPosition({
        target: candlePosition
      })
      
      // Update the highlight uniform with enhanced effect
      if (window.sharedUniforms) {
        // First clear any previous highlight
        window.sharedUniforms.uHighlightedId.value = -1

        // Then set the new highlight after a brief moment to ensure update
        setTimeout(() => {
          window.sharedUniforms.uHighlightedId.value = actualInstanceId
        }, 100)
      }
      
      // Store candle data for tooltip
      const litAt = userCandle.offering.createdAt?.toDate?.() || userCandle.offering.createdAt || new Date()
      const litAtTime = userCandle.litAt || litAt.getTime()
      const now = Date.now()
      const elapsed = (now - litAtTime) / 1000
      
      // Format time ago
      let timeAgo
      if (elapsed < 60) {
        timeAgo = `${Math.floor(elapsed)}s ago`
      } else if (elapsed < 3600) {
        timeAgo = `${Math.floor(elapsed / 60)}m ago`
      } else {
        timeAgo = `${Math.floor(elapsed / 3600)}h ago`
      }
      
      // Calculate melt percentage (how much has melted, not remaining)
      const meltPercentage = Math.min(100, (elapsed / CANDLE_DURATION_SECONDS) * 100).toFixed(1)
      const formattedDate = `lit ${timeAgo}, ${meltPercentage}% melted`
      setUserCandleData({
        instanceId: actualInstanceId,
        litAt: formattedDate,
        litDate: litAt,
        meltPercentage: parseFloat(meltPercentage),
        message: userCandle.offering.message || userCandle.offering.text,
        username: userCandle.offering.name || userCandle.username || 'Anonymous',
        userImageUrl: userCandle.offering.userImageUrl || userCandle.offering.imageUrl || null,
        userId: userCandle.userId
      })

      // Also select this candle in the stats panel
      if (onSelectOffering) {
        onSelectOffering({
          ...userCandle.offering,
          meltPercentage: parseFloat(meltPercentage),
          timeAgo,
          sceneY: userCandle.y,
          isUserCandle: true
        })
      }
    } else {
      // Clear any existing highlight
      if (window.sharedUniforms) {
        window.sharedUniforms.uHighlightedId.value = -1
      }
      setUserCandleData(null)
      alert(`No candle found for user ID: ${currentUserId}\nYou need to light a candle first!`)
    }
  }, [currentUserId, offerings, offeringCandles, isMobile])

  // Method to reset view back to main
  const resetView = useCallback(() => {
    setTargetCameraPosition(null)
    setResetCameraToDefault(true)

    // Reset flags after animation completes
    setTimeout(() => {
      setResetCameraToDefault(false)
      setOverrideCameraControl(false)
    }, 1600)
    if (window.sharedUniforms) {
      window.sharedUniforms.uHighlightedId.value = -1
    }
    setUserCandleData(null)
    setHoveredCandleId(null)
    
    // Notify parent component that view has been reset
    if (onViewReset) {
      onViewReset()
    }
    
  }, [onViewReset])

  // Expose method to trigger candle effect
  useImperativeHandle(ref, () => ({
    triggerCandleEffect: (offering) => {
      if (effectRef.current) {
        // Pass the stored position from the offering to the effect
        effectRef.current.triggerEffect(offering)
        // NOTE: onLightCandle is NOT called here to prevent duplicate Prayer Received
        // The onLightCandle callback should be called by the component that triggers this effect

        // Activate ripple state to trigger purple screen and brighter aura
        setIsRippleActive(true)
        setTimeout(() => setIsRippleActive(false), 8000) // Match the justLitOffering duration

        // Move camera to watch the candle land at its final position
        if (offering?.position) {
          const pos = offering.position
          // Set camera to look at the candle landing spot
          setTargetCameraPosition({
            target: [pos.x, pos.y, pos.z]
          })
          setOverrideCameraControl(true)

          // Reset camera after the effect completes
          setTimeout(() => {
            setTargetCameraPosition(null)
            setResetCameraToDefault(true)
            setTimeout(() => {
              setResetCameraToDefault(false)
              setOverrideCameraControl(false)
            }, 1600)
          }, 12000) // After NewCandleEffect finishes (~10-12 seconds)
        }
      }
    },
    findUserCandle,
    resetView
  }), [findUserCandle, resetView])
  const [userRotation, setUserRotation] = useState(0)
  const [userVerticalRotation, setUserVerticalRotation] = useState(0)

  // Vertical rotation limits (in radians)
  // Negative rotation.x = looking up, Positive = looking down
  const MAX_VERTICAL_ROTATION = 0 // No looking down (horizontal)
  const MIN_VERTICAL_ROTATION = -Math.PI / 6  // ~30° up

  // Keep ref in sync with state
  useEffect(() => {
    userRotationRef.current = userRotation
  }, [userRotation])

  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, rotation: 0, verticalRotation: 0 })
  const hasDraggedEnough = useRef(false) // Track if we've moved enough to start rotating
  const DRAG_THRESHOLD = 5 // Pixels to move before rotation starts
  const hasReachedSection = true // const [hasReachedSection, setHasReachedSection] = useState(true)
  const isInView = true // const [isInView, setIsInView] = useState(true)
  const canvasRef = useRef()
  const [contextLost, setContextLost] = useState(false)
  
  
  // Clean up WebGL context and Three.js resources on unmount
useEffect(() => {
  return () => {
    // MEMORY FIX: Use setTimeout instead of requestAnimationFrame for more reliable cleanup
    // setTimeout with 0 delay is more reliable for cleanup than requestAnimationFrame
    const timeoutId = setTimeout(() => {
      try {
        const canvas = canvasRef.current
        if (!canvas) return

        // Dispose of the entire Three.js scene
        if (canvas.scene) {
          // Traverse and dispose all objects in the scene
          canvas.scene.traverse((child) => {
            if (child.geometry) {
              child.geometry.dispose()
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                  if (mat.map) mat.map.dispose()
                  if (mat.normalMap) mat.normalMap.dispose()
                  if (mat.roughnessMap) mat.roughnessMap.dispose()
                  if (mat.metalnessMap) mat.metalnessMap.dispose()
                  if (mat.alphaMap) mat.alphaMap.dispose()
                  if (mat.emissiveMap) mat.emissiveMap.dispose()
                  mat.dispose()
                })
              } else {
                if (child.material.map) child.material.map.dispose()
                if (child.material.normalMap) child.material.normalMap.dispose()
                if (child.material.roughnessMap) child.material.roughnessMap.dispose()
                if (child.material.metalnessMap) child.material.metalnessMap.dispose()
                if (child.material.alphaMap) child.material.alphaMap.dispose()
                if (child.material.emissiveMap) child.material.emissiveMap.dispose()
                child.material.dispose()
              }
            }
            // Remove from parent
            if (child.parent) {
              child.parent.remove(child)
            }
          })

          // Clear the scene
          while(canvas.scene.children.length > 0) {
            canvas.scene.remove(canvas.scene.children[0])
          }
        }

        // Clean up global uniforms if they exist
        if (window.sharedUniforms) {
          // Reset values but don't delete - other instances might use them
          if (window.sharedUniforms.uTime) window.sharedUniforms.uTime.value = 0
          if (window.sharedUniforms.uClickedId) window.sharedUniforms.uClickedId.value = -1
          if (window.sharedUniforms.uPriceDirection) window.sharedUniforms.uPriceDirection.value = 0
          if (window.sharedUniforms.uContinuousOffset) window.sharedUniforms.uContinuousOffset.value = 0
          if (window.sharedUniforms.uShortTermPrice) window.sharedUniforms.uShortTermPrice.value = 0
          if (window.sharedUniforms.uPulseTime) window.sharedUniforms.uPulseTime.value = -1
          if (window.sharedUniforms.uPulsePosition) window.sharedUniforms.uPulsePosition.value.set(0, 0, 0)
        }

        // Dispose WebGL renderer
        if (canvas.gl) {
          canvas.gl.dispose()
          canvas.gl.forceContextLoss()
          canvas.gl.context = null
          canvas.gl.domElement = null
        }
      } catch (err) {
        console.warn('Cleanup error (non-critical):', err)
      }
    }, 0)

    // Return cleanup function to clear timeout if component remounts before timeout fires
    return () => clearTimeout(timeoutId)
  }
}, [])
  
  // Price history - update much less frequently
  const [priceHistory, setPriceHistory] = useState(() =>
    Array(20).fill(0.00042) // Start with consistent values for SSR
  )

  // 7-day price history for sparkline - mock data until token launches
  const [priceHistory7d] = useState(() => [
    0.000410, // 7 days ago
    0.000425, // 6 days ago
    0.000418, // 5 days ago
    0.000435, // 4 days ago
    0.000428, // 3 days ago
    0.000422, // 2 days ago
    0.000416  // today (matches current price)
  ])
  const lastHistoryUpdate = useRef(0)
  const HISTORY_UPDATE_INTERVAL = 500 // Update chart every 500ms
  
  // Calculate stats from offerings
  const [displayedCandleCount, setDisplayedCandleCount] = useState(100)
  const [displayedBurnTotal, setDisplayedBurnTotal] = useState(0) // Will be updated with real data
  const [candleCountAnimation, setCandleCountAnimation] = useState(false)
  const [showLatestPolaroid, setShowLatestPolaroid] = useState(true) // Always show polaroids
  
  // Calculate real stats from offerings
  const realCandleCount = useMemo(() => {
    // Use totalOfferingsCount if provided, otherwise fall back to offerings.length
    const offeringsCount = totalOfferingsCount > 0 ? totalOfferingsCount : offerings.length
    const count = 100 + offeringsCount
    return count
  }, [totalOfferingsCount, offerings.length])
  // Read total supply from the contract using the proper thirdweb extension
  const { data: totalSupplyData, isLoading: isLoadingSupply } = useReadContract(
    totalSupply,
    { 
      contract: erc20Contract 
    }
  )

  // Calculate real burn total from contract data
  const INITIAL_SUPPLY = 80_000_000_000 // 80 billion initial supply
  const realBurnTotal = useMemo(() => {
    if (totalSupplyData !== undefined && totalSupplyData !== null) {
      // Convert BigInt to number and calculate burned amount
      const currentSupply = Number(totalSupplyData / BigInt(10 ** 18)) // Convert from wei to tokens
      const burnedFromContract = INITIAL_SUPPLY - currentSupply
      
      
      // Add any local offerings burns (for immediate UI feedback)
      const offeringsBurn = offerings.reduce((sum, offering) => sum + (offering.tokensBurned || 0), 0)
      
      return burnedFromContract + offeringsBurn
    }
    
    // Return 0 while loading, no mock data
    return 0
  }, [offerings, totalSupplyData, isLoadingSupply])
  
  // Animate candle count when it increases
  useEffect(() => {
    if (realCandleCount > displayedCandleCount) {
      // Start animation immediately since we're already delayed from page.js
      setCandleCountAnimation(true)
      setDisplayedCandleCount(realCandleCount)
      
      // Keep animation active for longer (1.5 seconds)
      setTimeout(() => setCandleCountAnimation(false), 1500)
    } else {
      setDisplayedCandleCount(realCandleCount)
    }
  }, [realCandleCount, displayedCandleCount])
  
  // Animate burn total
  useEffect(() => {
    setDisplayedBurnTotal(realBurnTotal)
  }, [realBurnTotal])

  // Store timeout refs for cleanup
  const timeoutRefs = useRef({})

  // Mobile detection with SSR safety
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth <= 768)
      }
    }
    // Only run on client side after mount
    checkMobile()
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', checkMobile)
      return () => {
        window.removeEventListener('resize', checkMobile)
        Object.values(timeoutRefs.current).forEach(clearTimeout)
        timeoutRefs.current = {}
      }
    }
  }, [])
  
  // Mount immediately on client-side - no delay that could be interrupted
  useEffect(() => {
    
    // Small delay to ensure parent is fully ready and GLTF is preloaded
    const timer = setTimeout(() => {
      setMounted(true)
    }, 200) // Small delay to let parent preloading complete
    
    // Generate random initial values only on client side
    setPriceHistory(Array(20).fill(0).map(() => 0.00042 + Math.random() * 0.00001 - 0.000005))
    
    // Add ESC key handler for tooltip and view reset
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        // Reset everything
        setHoveredCandleId(null)
        setTargetCameraPosition(null)
        if (window.sharedUniforms) {
          window.sharedUniforms.uHighlightedId.value = -1
        }
      }
    }
    window.addEventListener('keydown', handleEscape)
    
    return () => {
      // Cleanup on unmount
      clearTimeout(timer)
      setMounted(false)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [])

  // Throttled UI update handler
  const handleUIUpdate = useCallback((price) => {
    // Use test override if set, otherwise use simulated price
    const effectivePrice = testPriceOverride !== null ? testPriceOverride : price
    const changePercent = effectivePrice * 5
    const newTokenPrice = 0.000420 * (1 + changePercent / 100)
    
    setDisplayPrice({
      direction: effectivePrice,
      change: changePercent,
      tokenPrice: newTokenPrice,
    })
    
    // Update history even less frequently
    const now = Date.now()
    if (now - lastHistoryUpdate.current > HISTORY_UPDATE_INTERVAL) {
      lastHistoryUpdate.current = now
      setPriceHistory(prev => [...prev.slice(1), newTokenPrice])
    }
    
    if (onPriceChange) {
      onPriceChange(changePercent)
    }
  }, [onPriceChange, testPriceOverride])

  const handleCandleClick = useCallback((instanceId, position) => {
    if (timeoutRefs.current[instanceId]) {
      clearTimeout(timeoutRefs.current[instanceId])
      delete timeoutRefs.current[instanceId]
    }

    setClickedCandleId(instanceId)

    // Switch to Leaders tab to show candle details
    setActiveStatsTab('leaders')
    if (statsBoxCollapsed) setStatsBoxCollapsed(false)

    const baseCandles = 0 // No base candles - all candles are from offerings

    // Check if this is the user's candle
    if (userCandleData && instanceId === userCandleData.instanceId) {
      setHoveredCandleId(prev => prev === instanceId ? null : instanceId)

      // Also show in stats panel
      const offeringIndex = instanceId - baseCandles
      if (offeringIndex >= 0 && offeringIndex < offeringCandles.length) {
        const candle = offeringCandles[offeringIndex]
        const offering = candle.offering
        const litAtTime = candle.litAt || offering?.createdAt?.toDate?.()?.getTime?.() || Date.now()
        const elapsed = (Date.now() - litAtTime) / 1000
        const meltPercentage = parseFloat(Math.min(100, (elapsed / CANDLE_DURATION_SECONDS) * 100).toFixed(1))
        let timeAgo
        if (elapsed < 60) timeAgo = `${Math.floor(elapsed)}s ago`
        else if (elapsed < 3600) timeAgo = `${Math.floor(elapsed / 60)}m ago`
        else if (elapsed < 86400) timeAgo = `${Math.floor(elapsed / 3600)}h ago`
        else timeAgo = `${Math.floor(elapsed / 86400)}d ago`

        if (onSelectOffering) {
          onSelectOffering({
            ...offering,
            meltPercentage,
            timeAgo,
            sceneY: candle.y,
            isUserCandle: true
          })
        }
      }
    } else {
      // Check if this is an offering candle with real data
      if (instanceId >= baseCandles && offeringCandles.length > 0) {
        const offeringIndex = instanceId - baseCandles
        if (offeringIndex < offeringCandles.length) {
          const candle = offeringCandles[offeringIndex]
          const offering = candle.offering

          const litAtTime = candle.litAt || offering?.createdAt?.toDate?.()?.getTime?.() || Date.now()
          const elapsed = (Date.now() - litAtTime) / 1000
          const meltPercentage = parseFloat(Math.min(100, (elapsed / CANDLE_DURATION_SECONDS) * 100).toFixed(1))
          let timeAgo
          if (elapsed < 60) timeAgo = `${Math.floor(elapsed)}s ago`
          else if (elapsed < 3600) timeAgo = `${Math.floor(elapsed / 60)}m ago`
          else if (elapsed < 86400) timeAgo = `${Math.floor(elapsed / 3600)}h ago`
          else timeAgo = `${Math.floor(elapsed / 86400)}d ago`

          if (onSelectOffering) {
            onSelectOffering({
              ...offering,
              meltPercentage,
              timeAgo,
              sceneY: candle.y,
              isUserCandle: candle.userId === currentUserId
            })
          }
        }
      }

      // Clear purple glow after 2 seconds
      timeoutRefs.current[instanceId] = setTimeout(() => {
        setClickedCandleId(null)
        delete timeoutRefs.current[instanceId]
      }, 2000)
    }
  }, [offerings, onSelectOffering, userCandleData, offeringCandles, currentUserId, statsBoxCollapsed])

  // Called when NewCandleEffect completes - candle is already in Firestore with stored position
  const handleNewCandleComplete = useCallback((position, offering) => {
    console.log('[UnifiedShrine] handleNewCandleComplete - candle landed at:', position)

    // Refresh offerings to show the candle at its stored position
    // This ensures the candle appears immediately after the effect ends
    if (onRefreshOfferings) {
      onRefreshOfferings()
    }

    // Show the latest polaroid on the phone screen after a delay
    setTimeout(() => {
      setShowLatestPolaroid(true)
      // Hide it after 8 seconds
      setTimeout(() => {
        setShowLatestPolaroid(false)
      }, 8000)
    }, 2000) // Show after 2 seconds (when burst is complete)

    // Notify parent - candle is already in Firestore, no need to add to local state
    if (onLightCandle) {
      onLightCandle(offering)
    }
  }, [onLightCandle, onRefreshOfferings])

  // Trigger pulse in candle cloud when Arctic Rings fire
  const handleCandlePulse = useCallback((position) => {
    if (window.sharedUniforms) {
      window.sharedUniforms.uPulseTime.value = window.sharedUniforms.uTime.value
      window.sharedUniforms.uPulsePosition.value.set(position[0], position[1], position[2])
    }
  }, [])

  const handlePointerDown = useCallback((event) => {
    // Cancel any in-progress smooth reset so drag feels responsive
    setSmoothRotationReset(false)
    // Mark potential drag start but don't start rotating yet
    isDragging.current = true
    hasDraggedEnough.current = false
    const clientX = event.clientX || event.touches?.[0]?.clientX || 0
    const clientY = event.clientY || event.touches?.[0]?.clientY || 0
    dragStart.current = {
      x: clientX,
      y: clientY,
      rotation: userRotation,
      verticalRotation: userVerticalRotation,
      startX: clientX,
      startY: clientY
    }
    // Don't change cursor yet - wait for actual drag
  }, [userRotation, userVerticalRotation])

  const handlePointerMove = useCallback((event) => {
    if (isDragging.current) {
      const clientX = event.clientX || event.touches?.[0]?.clientX || 0
      const clientY = event.clientY || event.touches?.[0]?.clientY || 0

      // Check if we've moved enough to start rotating
      if (!hasDraggedEnough.current) {
        const distanceMovedX = Math.abs(clientX - dragStart.current.startX)
        const distanceMovedY = Math.abs(clientY - dragStart.current.startY)
        const distanceMoved = Math.sqrt(distanceMovedX ** 2 + distanceMovedY ** 2)
        if (distanceMoved >= DRAG_THRESHOLD) {
          hasDraggedEnough.current = true
          // Now we're actually dragging - update cursor
          if (typeof document !== 'undefined' && document.body) {
            document.body.style.cursor = 'grabbing'
          }
        } else {
          // Haven't moved enough yet, don't rotate
          return
        }
      }

      // Only rotate if we've dragged enough
      if (hasDraggedEnough.current) {
        // Horizontal rotation (unlimited)
        const deltaX = (clientX - dragStart.current.x) * 0.01
        const newRotation = dragStart.current.rotation + deltaX
        setUserRotation(newRotation)

        // Vertical rotation (clamped)
        const deltaY = (clientY - dragStart.current.y) * 0.005 // Less sensitive for vertical
        const newVerticalRotation = Math.max(
          MIN_VERTICAL_ROTATION,
          Math.min(MAX_VERTICAL_ROTATION, dragStart.current.verticalRotation - deltaY)
        )
        setUserVerticalRotation(newVerticalRotation)
      }
    }
  }, [MAX_VERTICAL_ROTATION, MIN_VERTICAL_ROTATION])

  const handlePointerUp = useCallback(() => {
    const wasDragging = hasDraggedEnough.current
    isDragging.current = false
    hasDraggedEnough.current = false
    // Only reset cursor if we actually started dragging
    if (typeof document !== 'undefined' && document.body && document.body.style.cursor === 'grabbing') {
      document.body.style.cursor = 'auto'
    }

    // If it was a click (not a drag) on the background, reset the view
    if (!wasDragging) {
      // Enable smooth lerp, then set target to 0
      setSmoothRotationReset(true)
      setUserRotation(0)
      setUserVerticalRotation(0)
      // Reset camera and clear any highlights
      resetView()
      // Clear smooth flag after lerp completes (~1s at 0.08 per frame)
      setTimeout(() => setSmoothRotationReset(false), 1000)
    }
  }, [resetView])

  // Track reload attempts to prevent infinite loops
  const reloadAttempts = useRef(0)
  const lastContextLostTime = useRef(0)
  
  // Context lost recovery with debouncing
  useEffect(() => {
    let recoveryTimer = null
    
    if (contextLost) {
      const now = Date.now()
      const timeSinceLastLoss = now - lastContextLostTime.current
      lastContextLostTime.current = now
      
      // If losing context repeatedly in quick succession, wait longer
      const waitTime = timeSinceLastLoss < 2000 ? 5000 : 3000
      
      recoveryTimer = setTimeout(() => {
        if (contextLost && reloadAttempts.current < 3) {
          reloadAttempts.current++
          // Disabled automatic reload - let user manually reload if needed
          // window.location.reload()
        } else if (reloadAttempts.current >= 3) {
          console.error('Max reload attempts reached. Please refresh manually.')
        }
      }, waitTime)
    }
    
    return () => {
      if (recoveryTimer) clearTimeout(recoveryTimer)
    }
  }, [contextLost])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach(clearTimeout)
      timeoutRefs.current = {}
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.cursor = 'auto'
      }
      isDragging.current = false
      
      // Call stored cleanup functions if they exist
      if (canvasRef.current?._cleanupListeners) {
        canvasRef.current._cleanupListeners()
      }
    }
  }, [])
  
  // Handle test slider changes
  useEffect(() => {
    if (testPriceOverride !== null) {
      // Normalize the test price for shader (expecting -1 to 1 range)
      const normalizedPrice = testPriceOverride / 20
      
      // Update price ref for color changes
      priceRef.current = normalizedPrice
      
      // Force UI update
      handleUIUpdate(testPriceOverride)
    }
  }, [testPriceOverride, handleUIUpdate])
  
  // Separate effect to continuously update offset even in test mode
  useEffect(() => {
    if (testPriceOverride === null) return
    
    let animationId
    let lastTime = performance.now()
    
    const updateOffset = (currentTime) => {
      const deltaTime = (currentTime - lastTime) / 1000
      lastTime = currentTime
      
      // Constant rate - same as auto mode
      const CONSTANT_SPEED = 0.5
      continuousOffsetRef.current += deltaTime * CONSTANT_SPEED
      
      animationId = requestAnimationFrame(updateOffset)
    }
    
    animationId = requestAnimationFrame(updateOffset)
    return () => cancelAnimationFrame(animationId)
  }, [testPriceOverride])

  // Memoize exclusionZone to prevent CandleCloud re-renders
  // Adjusted to match actual model position and scale
  const exclusionZone = useMemo(() => ({
    center: [0, -1, 3],   // Match the model group position
    radius: isMobile ? 15 : 15,  // Much larger radius to account for scale 1.8 and clear entire area
    height: 30             // Cover full vertical space of the scaled model
  }), [isMobile])

  // Memoize styles
  const unifiedStatsStyle = useMemo(() => ({
    position: 'absolute',  // Use fixed positioning for proper layering
    top: isMobile ? '120px' : '105px',
    right: isMobile ? '10px' : '20px',
    background: isMobile ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.3)',
    border: is80sMode ? '2px solid rgba(255, 0, 255, 0.4)' : '2px solid rgba(212, 175, 55, 0.3)',
    borderRadius: '12px',
    padding: isMobile ? '10px 12px' : '18px',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: isMobile ? '11px' : '14px',
    backdropFilter: 'blur(20px)',
    boxShadow: is80sMode
      ? '0 0 20px 4px rgba(255, 0, 255, 0.3), 0 0 40px 8px rgba(0, 255, 255, 0.15)'
      : '0 0 20px 4px rgba(212, 175, 55, 0.3)',
    zIndex: 1000,
    width: isMobile ? '160px' : '240px',
  }), [isMobile, is80sMode])
  

  // Memoize 7-day price sparkline
  const priceSparkline = useMemo(() => {
    const prices = priceHistory7d
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const range = max - min || 0.000001 // Prevent division by zero

    // Generate SVG points for polyline
    const points = prices.map((price, i) => {
      const x = (i / (prices.length - 1)) * 100
      const y = 30 - ((price - min) / range) * 28 // Invert Y (SVG coords)
      return `${x},${y}`
    }).join(' ')

    return { points, lastY: 30 - ((prices[prices.length - 1] - min) / range) * 28 }
  }, [priceHistory7d])

  // Help overlay annotation positions (screen-space)
  const helpAnnotations = useMemo(() => [
    {
      id: 'stats',
      label: t('illumin80.helpAnnotations.stats.label'),
      description: t('illumin80.helpAnnotations.stats.description'),
      position: { top: isMobile ? '16rem' : '120px', right: isMobile ? '50%' : '50%' },
      pointerDirection: 'right'
    },
    {
      id: 'phone',
      label: t('illumin80.helpAnnotations.phone.label'),
      description: t('illumin80.helpAnnotations.phone.description'),
      position: { top: '50%', left: '40%', transform: 'translate(-50%, -50%)' },
      pointerDirection: 'none'
    },
    // {
    //   id: 'actions',
    //   label: t('illumin80.helpAnnotations.actions.label'),
    //   description: t('illumin80.helpAnnotations.actions.description'),
    //   position: { top: '22%', right: isMobile ? '13rem' : '15rem' },
    //   pointerDirection: 'right'
    // },
    {
      id: 'candles',
      label: t('illumin80.helpAnnotations.candles.label'),
      description: isMobile
        ? 'Light a candle or stake tokens by clicking the stake or match icons below'
        : t('illumin80.helpAnnotations.candles.description'),
      position: { bottom: isMobile ? '29%' : '23%', left: '20%' },
      pointerDirection: 'none'
    }
  ], [isMobile, t])

  return (
    <div style={{ width: '100vw', height: isMobile ? '100dvh' : '100dvh', background: is80sMode ? 'transparent' : '#000', position: 'fixed'}}>
      {/* 80s mode background */}
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
      

      
      <div 
        ref={canvasRef} 
        style={{ 
          width: '100vw', 
          height: '100dvh', 
          position: 'fixed', 
          zIndex: 2,
          background: is80sMode ? 'transparent' : '#000',
          cursor: targetCameraPosition ? 'pointer' : 'auto'
        }}
        onClick={() => {
          // If viewing user's candle, click anywhere to return
          if (targetCameraPosition) {
            resetView()
          }
        }}
      >
      {/* Focus Mode Indicator */}
      {focusMode && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.7)',
            color: '#00ff66',
            padding: '10px 20px',
            borderRadius: '20px',
            fontSize: '14px',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            zIndex: 100,
            pointerEvents: 'none',
            border: '1px solid #00ff66',
            backdropFilter: 'blur(10px)'
          }}
        >
          📱 Focus Mode • Click phone to exit
        </div>
      )}
      
      {/* Hint for returning from candle view */}
      {targetCameraPosition && (
        <div
          style={{
            position: 'absolute',
            top: isMobile ? '70%' : '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0, 0, 0, 0.7)',
            color: '#ffaa00',
            padding: '10px 20px',
            borderRadius: '20px',
            fontSize: '14px',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            zIndex: 100,
            pointerEvents: 'none',
            border: '1px solid rgba(255, 170, 0, 0.5)',
            backdropFilter: 'blur(10px)',
            animation: 'fadeIn 0.5s ease-in'
          }}
        >
          Click anywhere to return
        </div>
      )}

      {/* User candle info now shown in the stats panel instead of a separate overlay */}

      {mounted && typeof window !== 'undefined' && (
      <CanvasErrorBoundary>
      <Canvas
        camera={{
          position: DEBUG_MODE ? [0, 40, 0] : [0, isMobile ? 0 : 0, isMobile ? 2 : 0],
          fov: DEBUG_MODE ? 90 : (isMobile ? 75 : 70),
          near: 0.1,
          far: 200
        }}
        dpr={isMobile ? Math.min(window.devicePixelRatio || 1, 1.5) : Math.min(window.devicePixelRatio || 1, 2)}
        frameloop="always"
        gl={{ 
          antialias: true, // Enable for better quality on all devices
          toneMapping: THREE.ACESFilmicToneMapping, // Use proper tone mapping for better visuals
          powerPreference: isMobile ? "default" : "high-performance",
          alpha: true,
          premultipliedAlpha: false,
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false,
          stencil: false,
          depth: true,
          precision: "highp" // High precision for better quality
        }}
        onError={(error) => {
          console.warn('Canvas error:', error)
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,  // Lower z-index to be behind UI elements
          background: 'transparent'
        }}
        onCreated={({ gl, scene, camera }) => {
          // Store references for cleanup
          if (gl && scene) {
            canvasRef.current = { gl, scene, camera }
            // Set initial state
            setContextLost(false)
            
            // Clear any pending timeouts
            Object.values(timeoutRefs.current).forEach(clearTimeout)
            timeoutRefs.current = {}
            
          }
        }}
        // Limit frame rate if needed - uncomment for testing
        // frameloop="demand"
      >
        <SceneSetup is80sMode={is80sMode} />

        {/* Debug mode - bird's eye view with orbit controls */}
        {DEBUG_MODE && (
          <>
            <OrbitControls
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              target={[0, -1, -6]}
            />
            <DebugZoneVisualization />
            <gridHelper args={[50, 50, '#444444', '#222222']} position={[0, -1, 0]} rotation={[0, 0, 0]} />
          </>
        )}

        <ambientLight intensity={isMobile ? 0.8 : 0.6} />
        {!isMobile && (
          <>
            <directionalLight position={[10, 10, 5]} intensity={1} />
            <pointLight position={[10, 10, 10]} intensity={0.5} />
            <pointLight position={[-10, -10, -10]} intensity={1} />
          </>
        )}
        
        {/* Background gradient - reads from ref */}
        <GradientBackground is80sMode={is80sMode} />

        {/* Camera animator for smooth transitions - disabled in debug mode */}
        {!DEBUG_MODE && (
          <CameraAnimator
            targetPosition={targetCameraPosition}
            resetToDefault={resetCameraToDefault}
            isMobile={isMobile}
          />
        )}
        
        {/* Rotatable scene content */}
        <SceneRotator
          userRotation={DEBUG_MODE ? 0 : userRotation}
          userVerticalRotation={DEBUG_MODE ? 0 : userVerticalRotation}
          smoothTransition={smoothRotationReset}
          onRotationStart={handlePointerDown}
          onRotationMove={handlePointerMove}
          onRotationEnd={handlePointerUp}
        >
          {/* Combined group for hands and surrounding candles */}
          <group position={[0, 0, 0]}>
            <Suspense >
              <CandleCloud
                count={0}  // No base candles - all 80 come from offerings (users + St. GR80)
                priceRef={priceRef}
                shortTermPriceRef={shortTermPriceRef}
                continuousOffsetRef={continuousOffsetRef}
                additionalCandles={offeringCandles}
                onCandleClick={handleCandleClick}
                clickedCandleId={clickedCandleId}
                isMobile={isMobile}
                exclusionZone={exclusionZone}
                onCandleHover={(id) => {
                  // Only show hover for user's candle
                  if (userCandleData && id === userCandleData.instanceId) {
                    setHoveredCandleId(id)
                  }
                }}
                onCandleLeave={() => {
                  setHoveredCandleId(null)
                }}
              />
              
              {/* User candle label moved to fixed screen-space panel below */}
            </Suspense> 
            
        
            <Suspense fallback={null}>
              <group scale={1.8} position={[0, -1, -6]} rotation={[0, 0, 0]}>
                <HandsModel
                  mousePosition={{ x: 0, y: 0 }}
                  hasReachedSection={hasReachedSection}
                  isInView={isInView}
                  offerings={offerings}
                  hoveredOffering={hoveredOffering}
                  justLitOffering={justLitOffering}
                  onJustLitComplete={onJustLitComplete}
                  userRotation={DEBUG_MODE ? 0 : userRotation}
                  isHighlighting={!!targetCameraPosition}
                  priceChange={displayPrice.change}
                  hasActiveClick={clickedCandleId !== null || isRippleActive}
                  user={user}
                  onPhoneClick={() => {
                    setFocusMode(!focusMode);
                  }}
                  is80sMode={is80sMode}
                  showLatestPolaroid={showLatestPolaroid}
                />
              </group>
            </Suspense>

            {/* New candle effect - inside SceneRotator so it rotates with the scene */}
            <NewCandleEffectManager
              ref={effectRef}
              phonePosition={[0, -1, -5]}  // Near phone/hands at [0, -1, -6]
              onNewCandle={handleNewCandleComplete}
              onCandlePulse={handleCandlePulse}
            />
          </group>
        </SceneRotator>
        
        {/* Only show Stats in development */}
        {/* {process.env.NODE_ENV === 'development' && <Stats className="stats-monitor" />} */}
        
        {/* Optimized price simulator - updates refs every frame, state throttled */}
        <OptimizedPriceSimulator 
          priceRef={priceRef}
          shortTermPriceRef={shortTermPriceRef}
          continuousOffsetRef={continuousOffsetRef}
          onUIUpdate={handleUIUpdate}
          disabled={testPriceOverride !== null}  // Disable when test controls are active
        />
        
        
            {/* Camera controller for focus mode - disabled when overriding camera control or in debug mode */}
            {!overrideCameraControl && !DEBUG_MODE && <CameraController focusMode={focusMode} />}
            
     

  <Suspense fallback={null}>
      <PostProcessingEffects is80sMode={is80sMode} />
  </Suspense>

      </Canvas>
      </CanvasErrorBoundary>
      )}
      </div>
      
      
      {/* CSS for animations */}
      <style jsx>{`
        @keyframes pulseScale {
          0% { 
            transform: scale(1);
            filter: brightness(1) drop-shadow(0 0 0px #ffee00);
          }
          25% { 
            transform: scale(1.5);
            filter: brightness(1.8) drop-shadow(0 0 25px #ffee00);
          }
          50% { 
            transform: scale(1.3);
            filter: brightness(1.5) drop-shadow(0 0 15px #ffee00);
          }
          75% { 
            transform: scale(1.4);
            filter: brightness(1.6) drop-shadow(0 0 20px #ffee00);
          }
          100% { 
            transform: scale(1);
            filter: brightness(1) drop-shadow(0 0 0px #ffee00);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateY(-50%) translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(-50%) translateX(0);
          }
        }

        @keyframes slideUpFade {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
    `}</style>

      {/* Candle details now shown in stats panel instead of floating popup */}
      
      {/* Container for Stats Box and Find My Candle button on mobile - rendered via portal to escape stacking context */}
      {!targetCameraPosition && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed',
          top: isMobile ? '9rem' : '160px',
          right: isMobile ? '10px' : '20px',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          alignItems: 'flex-end',
          pointerEvents: 'none',
        }}>


        {/* Unified Stats Box with Tabs */}
        <div style={{
          ...unifiedStatsStyle,
          position: 'relative',
          top: '-1.5rem',
          right: 0,
          transform: statsBoxCollapsed
            ? `translateX(calc(100% + ${isMobile ? '10px' : '20px'}))`
            : 'translateX(0)',
          transition: 'transform 0.3s ease',
          pointerEvents: statsBoxCollapsed ? 'none' : 'auto',
          overflow: 'visible',
        }}>
        {/* Stats Tab - inside panel so it shares the same transform (zero lag) */}
        <button
          onClick={(e) => { e.stopPropagation(); setStatsBoxCollapsed(prev => !prev) }}
          style={{
            position: 'absolute',
            top: isMobile ? '40%' : '80px',
            right: '100%',
            background: is80sMode
              ? (isMobile ? 'rgba(255, 0, 255, 0.35)' : 'rgba(255, 0, 255, 0.2)')
              : (isMobile ? 'rgba(0, 0, 0, 0.35)' : 'rgba(212, 175, 55, 0.2)'),
            borderTop: is80sMode ? '2px solid rgba(255, 0, 255, 0.5)' : '2px solid rgba(212, 175, 55, 0.4)',
            borderBottom: is80sMode ? '2px solid rgba(255, 0, 255, 0.5)' : '2px solid rgba(212, 175, 55, 0.4)',
            borderLeft: is80sMode ? '2px solid rgba(255, 0, 255, 0.5)' : '2px solid rgba(212, 175, 55, 0.4)',
            borderRight: 'none',
            borderRadius: '8px 0 0 8px',
            padding: '12px 8px',
            color: is80sMode ? '#ff00ff' : '#d4af37',
            fontSize: '11px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)',
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            letterSpacing: '2px',
            zIndex: 10,
            boxShadow: is80sMode ? '0 0 15px rgba(255, 0, 255, 0.3)' : 'none',
            textShadow: is80sMode ? '0 0 10px #ff00ff' : 'none',
            pointerEvents: 'auto',
          }}
          title={statsBoxCollapsed ? 'Open stats panel' : 'Collapse stats panel'}
        >
          {t('illumin80.stats.stats')}
        </button>
        {/* Tab Headers */}
        <div style={{
          display: 'flex',
          gap: isMobile ? '2px' : '4px',
          marginBottom: isMobile ? '8px' : '12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
        }}>
          {/* 🔥 Leaders Tab - Now First */}
          <button
            onClick={() => setActiveStatsTab('leaders')}
            style={{
              flex: 1,
              padding: isMobile ? '4px 4px' : '6px 8px',
              background: activeStatsTab === 'leaders' ? 'rgba(255, 149, 0, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: activeStatsTab === 'leaders' ? '2px solid #ff9500' : '2px solid transparent',
              color: activeStatsTab === 'leaders' ? '#ff9500' : '#ccc',
              fontSize: isMobile ? '10px' : '12px',
              fontFamily: 'monospace',
              fontWeight: activeStatsTab === 'leaders' ? 'bold' : 'normal',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'all 0.2s',
              marginBottom: '-1px',
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            🔥
          </button>
          <button
            onClick={() => setActiveStatsTab('price')}
            style={{
              flex: 1,
              padding: isMobile ? '4px 4px' : '6px 8px',
              background: activeStatsTab === 'price'
                ? (is80sMode ? 'rgba(255, 0, 255, 0.2)' : 'rgba(212, 175, 55, 0.2)')
                : 'transparent',
              border: 'none',
              borderBottom: activeStatsTab === 'price'
                ? (is80sMode ? '2px solid #ff00ff' : '2px solid #d4af37')
                : '2px solid transparent',
              color: activeStatsTab === 'price'
                ? (is80sMode ? '#ff00ff' : '#d4af37')
                : '#ccc',
              fontSize: isMobile ? '10px' : '12px',
              fontFamily: 'monospace',
              fontWeight: activeStatsTab === 'price' ? 'bold' : 'normal',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'all 0.2s',
              marginBottom: '-1px',
              minWidth: 0,
              overflow: 'hidden',
              textShadow: activeStatsTab === 'price' && is80sMode ? '0 0 10px #ff00ff' : 'none',
            }}
          >
            {t('illumin80.stats.price')}
          </button>
          <button
            onClick={() => setActiveStatsTab('pulse')}
            style={{
              flex: 1,
              padding: isMobile ? '4px 4px' : '6px 8px',
              background: activeStatsTab === 'pulse' ? 'rgba(167, 139, 250, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: activeStatsTab === 'pulse' ? '2px solid #a78bfa' : '2px solid transparent',
              color: activeStatsTab === 'pulse' ? '#a78bfa' : '#ccc',
              fontSize: isMobile ? '10px' : '12px',
              fontFamily: 'monospace',
              fontWeight: activeStatsTab === 'pulse' ? 'bold' : 'normal',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'all 0.2s',
              marginBottom: '-1px',
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            {t('illumin80.stats.pulse')}
          </button>
        </div>
        
        {/* Tab Content */}
        {activeStatsTab === 'price' ? (
          <>
            {/* Price Tab Content - Original content */}
        {/* Price Action - Prominent */}
        <div style={{
          marginBottom: isMobile ? '10px' : '15px',
          padding: isMobile ? '8px' : '12px',
          background: displayPrice.change >= 0 
            ? 'rgba(0, 255, 102, 0.1)' 
            : 'rgba(255, 68, 68, 0.1)',
          borderRadius: '8px',
          border: `1px solid ${displayPrice.change >= 0 
            ? 'rgba(0, 255, 102, 0.3)' 
            : 'rgba(255, 68, 68, 0.3)'}`
        }}>
          <div style={{ 
            fontSize: isMobile ? '18px' : '24px', 
            fontWeight: 'bold',
            color: displayPrice.change >= 0 ? '#00ff66' : '#ff4444',
            marginBottom: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>{displayPrice.change >= 0 ? '+' : ''}{displayPrice.change.toFixed(2)}%</span>
          </div>
          <div style={{
            fontSize: isMobile ? '12px' : '14px',
            color: '#ccc',
            fontFamily: 'monospace'
          }}>
            ${displayPrice.tokenPrice.toFixed(7)}
          </div>
        </div>
        
        {/* Candles & Burn Stats - Side by side */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: isMobile ? '8px' : '10px',
          marginBottom: isMobile ? '0' : '15px'
        }}>
          {/* Candles */}
          <div style={{
            padding: isMobile ? '8px' : '10px',
            background: is80sMode ? 'rgba(255, 0, 255, 0.1)' : 'rgba(212, 175, 55, 0.1)',
            borderRadius: '8px',
            border: is80sMode ? '1px solid rgba(255, 0, 255, 0.3)' : '1px solid rgba(212, 175, 55, 0.3)',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: isMobile ? '16px' : '16px',
              fontWeight: 'bold',
              color: is80sMode ? '#ff00ff' : '#d4af37',
              marginBottom: '4px',
              textShadow: is80sMode ? '0 0 10px #ff00ff' : 'none',
            }}>
              {/* <img 
                src="/images/GreenCandleIcon.webp"
                alt=""
                style={{
                  width: '1.2em',
                  height: '1.2em',
                  objectFit: 'contain',
                  verticalAlign: 'middle',
                  marginRight: '0.3em',
                  display: 'inline-block'
                }}
              />  */}
              <span 
                style={{
                  display: 'inline-block',
                  animation: candleCountAnimation ? 'pulseScale 1.5s ease-out' : 'none',
                  color: candleCountAnimation ? '#ffee00' : 'inherit'
                }}
              >
                {displayedCandleCount.toLocaleString()}
              </span>
            </div>
            <div style={{
              fontSize: isMobile ? '10px' : '11px',
              color: '#ccc',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {t('illumin80.stats.candles')}
            </div>
          </div>
          
          {/* Burned */}
          <div style={{
            padding: isMobile ? '8px' : '10px',
            background: 'rgba(255, 149, 0, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 149, 0, 0.3)',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: isMobile ? '16px' : '16px', 
              fontWeight: 'bold',
              color: '#ff9500',
              marginBottom: '4px'
            }}>
               {displayedBurnTotal >= 1000000 
                ? `${(displayedBurnTotal / 1000000).toFixed(2)}M`
                : displayedBurnTotal >= 1000 
                ? `${(displayedBurnTotal / 1000).toFixed(1)}K`
                : displayedBurnTotal.toLocaleString()}
            </div>
            <div style={{
              fontSize: isMobile ? '10px' : '11px',
              color: '#ccc',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '-8px'

            }}>
              {t('illumin80.stats.tokensBurned')}
            </div>
          </div>
        </div>
        
        {/* 7-day price sparkline */}
        <div style={{
          marginTop: isMobile ? '8px' : '12px',
          padding: isMobile ? '8px' : '10px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{
            fontSize: isMobile ? '9px' : '10px',
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '6px',
            fontFamily: 'monospace'
          }}>
            7-Day Chart
          </div>
          <svg viewBox="0 0 100 30" style={{ width: '100%', height: '30px' }}>
            <polyline
              fill="none"
              stroke={displayPrice.change >= 0 ? '#4ade80' : '#f87171'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={priceSparkline.points}
            />
            <circle
              cx="100"
              cy={priceSparkline.lastY}
              r="3"
              fill={displayPrice.change >= 0 ? '#4ade80' : '#f87171'}
              style={{
                filter: `drop-shadow(0 0 4px ${displayPrice.change >= 0 ? '#4ade80' : '#f87171'})`
              }}
            />
          </svg>
        </div>
          </>
        ) : activeStatsTab === 'pulse' ? (
          <>
            {/* Pulse Tab Content */}
            <div style={{
              padding: 0,
              margin: isMobile ? '-6px' : '-10px',
              maxHeight: isMobile ? '400px' : 'auto',
              minHeight: isMobile ? '300px' : '320px',
              overflowY: isMobile ? 'auto' : 'visible',
              overflowX: 'hidden'
            }}>
              {/* Info Banner */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.15), rgba(139, 92, 246, 0.1))',
                border: '1px solid rgba(167, 139, 250, 0.3)',
                borderRadius: '6px',
                padding: isMobile ? '6px 8px' : '8px 10px',
                marginBottom: isMobile ? '4px' : '1px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <div style={{
                  fontSize: isMobile ? '14px' : '16px',
                  flexShrink: 0,
                }}>
                  🔮
                </div>
                <div style={{
                  flex: 1,
                }}>
                  <div style={{
                    fontSize: isMobile ? '9px' : '10px',
                    color: '#a78bfa',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '2px',
                    textShadow: '0 0 8px rgba(167, 139, 250, 0.4)',
                  }}>
                    AI Sentiment Analysis
                  </div>
                  <div style={{
                    fontSize: isMobile ? '8px' : '9px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    lineHeight: '1.3',
                    fontFamily: 'monospace',
                  }}>
                    Daily analysis of prayers & candle messages
                  </div>
                </div>
              </div>
              <CongregationSentiment />
            </div>
          </>
        ) : activeStatsTab === 'leaders' ? (
          <>
            {/* Leaders Tab Content - Updated with sort toggle and selected candle */}
            <div style={{
              padding: 0,
              margin: isMobile ? '-2px' : '-4px',
            }}>
              {/* Header with Sort Toggle */}
              <div style={{
                marginBottom: isMobile ? '8px' : '12px',
                padding: '8px',
                background: 'rgba(255, 149, 0, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 149, 0, 0.2)'
              }}>
                <div style={{
                  textAlign: 'center',
                  fontSize: isMobile ? '11px' : '12px',
                  color: '#ff9500',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontFamily: "'Orbitron', monospace",
                  fontWeight: 'bold',
                  marginBottom: '8px'
                }}>
                  🔥 Illumin80 🔥
                </div>

                {/* Sort Toggle Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '6px',
                  justifyContent: 'center'
                }}>
                  <button
                    onClick={() => onSortChange && onSortChange('topBurners')}
                    style={{
                      padding: isMobile ? '4px 10px' : '5px 14px',
                      fontSize: isMobile ? '9px' : '10px',
                      fontFamily: 'monospace',
                      fontWeight: sortOption === 'topBurners' ? 'bold' : 'normal',
                      background: sortOption === 'topBurners' ? 'rgba(255, 149, 0, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                      border: sortOption === 'topBurners' ? '1px solid rgba(255, 149, 0, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: sortOption === 'topBurners' ? '#ff9500' : 'rgba(255, 255, 255, 0.6)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Top Burners
                  </button>
                  <button
                    onClick={() => onSortChange && onSortChange('recent')}
                    style={{
                      padding: isMobile ? '4px 10px' : '5px 14px',
                      fontSize: isMobile ? '9px' : '10px',
                      fontFamily: 'monospace',
                      fontWeight: sortOption === 'recent' ? 'bold' : 'normal',
                      background: sortOption === 'recent' ? 'rgba(0, 245, 212, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                      border: sortOption === 'recent' ? '1px solid rgba(0, 245, 212, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: sortOption === 'recent' ? '#00f5d4' : 'rgba(255, 255, 255, 0.6)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}
                  >
                    Most Recent
                  </button>
                </div>
              </div>

              {/* Selected Candle Display */}
              {selectedCandle ? (
                <div style={{
                  marginBottom: isMobile ? '8px' : '12px',
                  padding: isMobile ? '10px' : '12px',
                  background: selectedCandle.isPlaceholder
                    ? 'rgba(138, 43, 226, 0.1)'
                    : 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '8px',
                  border: selectedCandle.isPlaceholder
                    ? '1px solid rgba(138, 43, 226, 0.3)'
                    : '1px solid rgba(212, 175, 55, 0.5)',
                  boxShadow: selectedCandle.isPlaceholder
                    ? '0 0 12px rgba(138, 43, 226, 0.3), inset 0 0 12px rgba(138, 43, 226, 0.05)'
                    : '0 0 12px rgba(212, 175, 55, 0.25), 0 0 24px rgba(212, 175, 55, 0.1), inset 0 0 12px rgba(212, 175, 55, 0.03)',
                  animation: 'candlePanelGlow 2s ease-in-out infinite alternate',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: selectedCandle.isPlaceholder ? '0' : '8px'
                  }}>
                    {selectedAvatarUrl && !selectedAvatarFailed ? (
                      <img
                        src={selectedAvatarUrl}
                        alt=""
                        onError={() => setSelectedAvatarFailed(true)}
                        style={{
                          width: isMobile ? '32px' : '40px',
                          height: isMobile ? '32px' : '40px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: selectedCandle.isPlaceholder
                            ? '2px solid rgba(138, 43, 226, 0.6)'
                            : '2px solid rgba(212, 175, 55, 0.5)',
                          boxShadow: selectedCandle.isPlaceholder
                            ? '0 0 10px rgba(138, 43, 226, 0.4)'
                            : 'none',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div style={{
                        display: 'flex',
                        width: isMobile ? '32px' : '40px',
                        height: isMobile ? '32px' : '40px',
                        borderRadius: '50%',
                        background: selectedCandle.isPlaceholder
                          ? 'linear-gradient(135deg, rgba(138, 43, 226, 0.4), rgba(138, 43, 226, 0.2))'
                          : 'linear-gradient(135deg, rgba(212, 175, 55, 0.4), rgba(180, 130, 20, 0.2))',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isMobile ? '14px' : '17px',
                        fontWeight: 'bold',
                        color: selectedCandle.isPlaceholder ? '#a78bfa' : '#d4af37',
                        border: selectedCandle.isPlaceholder
                          ? '2px solid rgba(138, 43, 226, 0.5)'
                          : '2px solid rgba(212, 175, 55, 0.5)',
                        flexShrink: 0,
                      }}>
                        {(selectedCandle.name || 'A').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: isMobile ? '12px' : '14px',
                        fontWeight: 'bold',
                        color: selectedCandle.isPlaceholder ? '#a78bfa' : '#d4af37',
                        marginBottom: '2px'
                      }}>
                        {selectedCandle.name || 'Anonymous'}
                      </div>
                      <div style={{
                        fontSize: isMobile ? '10px' : '11px',
                        color: 'rgba(255, 255, 255, 0.6)'
                      }}>
                        {selectedCandle.isPlaceholder
                          ? 'Shrine Keeper'
                          : (selectedCandle.timestamp || 'recently')}
                      </div>
                    </div>
                    {!selectedCandle.isPlaceholder && (
                      <div style={{
                        textAlign: 'right'
                      }}>
                        <div style={{
                          fontSize: isMobile ? '12px' : '14px',
                          fontWeight: 'bold',
                          color: '#ff9500'
                        }}>
                          {(selectedCandle.tokensBurned || 0).toLocaleString()}
                        </div>
                        <div style={{
                          fontSize: isMobile ? '8px' : '9px',
                          color: 'rgba(255, 255, 255, 0.5)',
                          textTransform: 'uppercase'
                        }}>
                          RL80 burned
                        </div>
                      </div>
                    )}
                  </div>
                  {/* User's candle indicator */}
                  {selectedCandle.isUserCandle && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '8px',
                      padding: '6px 10px',
                      background: 'rgba(0, 245, 212, 0.15)',
                      borderRadius: '6px',
                      border: '1px solid rgba(0, 245, 212, 0.3)'
                    }}>
                      <span style={{ fontSize: '12px' }}>✨</span>
                      <span style={{
                        fontSize: isMobile ? '10px' : '11px',
                        color: '#00f5d4',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Your Candle
                      </span>
                    </div>
                  )}

                  {/* Melt percentage bar for user's candle */}
                  {selectedCandle.meltPercentage !== undefined && (
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '4px'
                      }}>
                        <span style={{
                          fontSize: isMobile ? '9px' : '10px',
                          color: 'rgba(255, 255, 255, 0.6)'
                        }}>
                          🕯️ {selectedCandle.timeAgo || selectedCandle.timestamp}
                        </span>
                        <span style={{
                          fontSize: isMobile ? '10px' : '11px',
                          color: selectedCandle.meltPercentage > 80 ? '#ff6b6b' : '#00f5d4',
                          fontWeight: 'bold'
                        }}>
                          {selectedCandle.meltPercentage.toFixed(1)}% melted
                        </span>
                      </div>
                      <div style={{
                        height: '6px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${100 - selectedCandle.meltPercentage}%`,
                          background: selectedCandle.meltPercentage > 80
                            ? 'linear-gradient(90deg, #ff6b6b, #ff9500)'
                            : 'linear-gradient(90deg, #00f5d4, #00d4aa)',
                          borderRadius: '3px',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>
                  )}

                  {selectedCandle.isPlaceholder ? (
                    <div style={{
                      fontSize: isMobile ? '9px' : '10px',
                      color: 'rgba(167, 139, 250, 0.8)',
                      fontStyle: 'italic',
                      marginTop: '6px',
                      textAlign: 'center'
                    }}>
                      This candle awaits a devotee...
                    </div>
                  ) : selectedCandle.message && (
                    <ExpandableMessage message={selectedCandle.message} isMobile={isMobile} />
                  )}
                </div>
              ) : (
                <div style={{
                  marginBottom: isMobile ? '8px' : '12px',
                  padding: isMobile ? '12px' : '16px',
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '8px',
                  border: '1px dashed rgba(255, 255, 255, 0.1)',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: isMobile ? '10px' : '11px',
                    color: 'rgba(255, 255, 255, 0.4)',
                    fontStyle: 'italic'
                  }}>
                    Click a candle to see details
                  </div>
                </div>
              )}

              {/* Trophy Candle Carousel */}
              {leaderboardLoading && sortOption !== 'recent' ? (
                <div style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '12px'
                }}>
                  Loading...
                </div>
              ) : (sortOption === 'recent' ? recentOfferingsData : leaderboardData).length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '12px'
                }}>
                  No data yet. Light a candle to join!
                </div>
              ) : (
                <div style={{
                  height: isMobile ? '140px' : '160px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 149, 0, 0.2)',
                  overflow: 'hidden'
                }}>
                  <LeaderboardCarousel
                  leaderboardData={sortOption === 'recent' ? recentOfferingsData : leaderboardData}
                  isMobile={isMobile}
                  sortMode={sortOption}
                />
                </div>
              )}

              {/* Find My Candle Button - inside stats tab */}
              {currentUserId && offeringCandles.some(c => c.userId === currentUserId) && (
                <button
                  onClick={() => {
                    if (targetCameraPosition) {
                      // Already highlighting - reset view
                      resetView()
                    } else {
                      findUserCandle()
                    }
                  }}
                  style={{
                    width: '100%',
                    marginTop: isMobile ? '8px' : '12px',
                    padding: isMobile ? '10px 12px' : '12px 16px',
                    background: targetCameraPosition
                      ? 'rgba(255, 100, 100, 0.2)'
                      : 'rgba(0, 255, 136, 0.15)',
                    border: targetCameraPosition
                      ? '1px solid rgba(255, 100, 100, 0.4)'
                      : '1px solid rgba(0, 255, 136, 0.4)',
                    borderRadius: '8px',
                    color: targetCameraPosition ? '#ff6b6b' : '#00ff88',
                    fontFamily: 'monospace',
                    fontSize: isMobile ? '11px' : '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.3s ease',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}
                >
                  {targetCameraPosition ? (
                    <>✕ {t('illumin80.resetView')}</>
                  ) : (
                    <>🔍 {t('illumin80.findMyCandle')}</>
                  )}
                </button>
              )}
            </div>
          </>
        ) : null}
        </div>

        {/* Find My Candle button moved inside stats tab */}
        </div>,
        document.body
      )}

      {/* Removed tooltip - will be added as Html in 3D space */}

      {/* Help Overlay with Annotations */}
      {showHelpOverlay && (
        <>
          {/* Dimmed background */}
          <div
            onClick={dismissHelpOverlay}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 900,
              cursor: 'pointer',
            }}
          />

          {/* Annotation Markers */}
          {helpAnnotations.map((annotation) => (
            <div
              key={annotation.id}
              onClick={(e) => {
                e.stopPropagation()
                setActiveAnnotationId(prev => prev === annotation.id ? null : annotation.id)
              }}
              style={{
                position: 'fixed',
                ...annotation.position,
                zIndex: 950,
                pointerEvents: 'auto',
                cursor: 'pointer',
              }}
            >
              {/* Marker dot */}
              <div style={{
                width: isMobile ? '28px' : '32px',
                height: isMobile ? '28px' : '32px',
                borderRadius: '50%',
                background: activeAnnotationId === annotation.id
                  ? (is80sMode ? 'rgba(255, 0, 255, 1)' : 'rgba(212, 175, 55, 1)')
                  : (is80sMode ? 'rgba(255, 0, 255, 0.9)' : 'rgba(212, 175, 55, 0.9)'),
                border: activeAnnotationId === annotation.id
                  ? (is80sMode ? '3px solid #00ffff' : '3px solid #fff')
                  : (is80sMode ? '2px solid rgba(0, 255, 255, 0.8)' : '2px solid rgba(255, 255, 255, 0.8)'),
                boxShadow: activeAnnotationId === annotation.id
                  ? (is80sMode
                      ? '0 0 25px rgba(255, 0, 255, 0.8), 0 0 50px rgba(0, 255, 255, 0.4)'
                      : '0 0 25px rgba(212, 175, 55, 0.8), 0 0 50px rgba(212, 175, 55, 0.4)')
                  : (is80sMode
                      ? '0 0 15px rgba(255, 0, 255, 0.6), 0 0 30px rgba(0, 255, 255, 0.3)'
                      : '0 0 15px rgba(212, 175, 55, 0.5)'),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: is80sMode ? '#00ffff' : '#000',
                fontSize: isMobile ? '14px' : '16px',
                fontWeight: 'bold',
                transition: 'all 0.2s ease',
                animation: activeAnnotationId === annotation.id ? 'none' : 'pulse 2s infinite',
                textShadow: is80sMode ? '0 0 10px #00ffff' : 'none',
              }}>
                ?
              </div>

              {/* Annotation label - only show when active */}
              {activeAnnotationId === annotation.id && (
                <div style={{
                  position: 'absolute',
                  top: annotation.pointerDirection === 'left' ? '50%' :
                       annotation.pointerDirection === 'right' ? '50%' : '100%',
                  left: annotation.pointerDirection === 'left' ? '100%' :
                        annotation.pointerDirection === 'right' ? 'auto' : '50%',
                  right: annotation.pointerDirection === 'right' ? '100%' : 'auto',
                  transform: annotation.pointerDirection === 'left' ? 'translateY(-50%)' :
                             annotation.pointerDirection === 'right' ? 'translateY(-50%)' : 'translateX(-50%)',
                  marginLeft: annotation.pointerDirection === 'left' ? '12px' : 0,
                  marginRight: annotation.pointerDirection === 'right' ? '12px' : 0,
                  marginTop: annotation.pointerDirection === 'none' ? '12px' : 0,
                  background: is80sMode ? 'rgba(20, 0, 40, 0.95)' : 'rgba(0, 0, 0, 0.95)',
                  border: is80sMode ? '2px solid rgba(255, 0, 255, 0.8)' : '2px solid rgba(212, 175, 55, 0.8)',
                  borderRadius: '10px',
                  padding: isMobile ? '10px 14px' : '12px 16px',
                  minWidth: isMobile ? '140px' : '180px',
                  maxWidth: isMobile ? '200px' : '240px',
                  backdropFilter: 'blur(10px)',
                  animation: 'fadeIn 0.2s ease',
                  boxShadow: is80sMode ? '0 0 20px rgba(255, 0, 255, 0.3), 0 0 40px rgba(0, 255, 255, 0.2)' : 'none',
                }}>
                  <div style={{
                    color: is80sMode ? '#ff00ff' : '#d4af37',
                    fontSize: isMobile ? '12px' : '14px',
                    fontWeight: 'bold',
                    marginBottom: '6px',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    textShadow: is80sMode ? '0 0 10px #ff00ff' : 'none',
                  }}>
                    {annotation.label}
                  </div>
                  <div style={{
                    color: is80sMode ? 'rgba(0, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                    fontSize: isMobile ? '11px' : '12px',
                    lineHeight: '1.5',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    textShadow: is80sMode ? '0 0 5px rgba(0, 255, 255, 0.5)' : 'none',
                  }}>
                    {annotation.description}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Dismiss hint */}
          <div style={{
            position: 'fixed',
            bottom: isMobile ? '20px' : '40px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 950,
            background: is80sMode ? 'rgba(20, 0, 40, 0.9)' : 'rgba(0, 0, 0, 0.8)',
            border: is80sMode ? '1px solid rgba(255, 0, 255, 0.5)' : '1px solid rgba(212, 175, 55, 0.4)',
            borderRadius: '20px',
            padding: '8px 16px',
            color: is80sMode ? 'rgba(0, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.7)',
            fontSize: isMobile ? '11px' : '12px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            boxShadow: is80sMode ? '0 0 15px rgba(255, 0, 255, 0.3)' : 'none',
            textShadow: is80sMode ? '0 0 5px rgba(0, 255, 255, 0.5)' : 'none',
          }}>
            Tap markers for info • Tap outside to close
          </div>
        </>
      )}

      {/* Animations for help markers */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes candlePanelGlow {
          0% { box-shadow: 0 0 10px rgba(212, 175, 55, 0.2), 0 0 20px rgba(212, 175, 55, 0.08); }
          100% { box-shadow: 0 0 16px rgba(212, 175, 55, 0.35), 0 0 32px rgba(212, 175, 55, 0.15); }
        }
      `}</style>

    </div>
  )
})

export default UnifiedShrine