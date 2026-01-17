'use client'
import React, { useRef, useState, useEffect, Suspense, useCallback, useMemo, forwardRef, useImperativeHandle, Component } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stats, useGLTF, Html } from '@react-three/drei'
import * as THREE from 'three'
import { HandsModel, CameraController } from './HandsGLTFScene'
// IMPORTANT: Import from the optimized version!
import { CandleCloud, GradientBackground, SceneSetup } from './CandleShrine'
import { NewCandleEffectManager } from './NewCandleEffect'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
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
          color="#ffaa00"
          transparent
          opacity={0.2}
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
        // Keep looking at target after animation from initial position
        camera.lookAt(
          targetPosition.target[0],
          targetPosition.target[1],
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
function SceneRotator({ children, userRotation, onRotationStart, onRotationMove, onRotationEnd }) {
  const groupRef = useRef()
  const [isPointerDown, setIsPointerDown] = useState(false)
  
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = userRotation
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
  onViewReset 
}, ref) {
  // Track if component is mounted for SSR safety
  const [mounted, setMounted] = useState(false)
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false)
  // Focus mode for phone zoom
  const [focusMode, setFocusMode] = useState(false)
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
  
  const [additionalCandles, setAdditionalCandles] = useState([])
  
  // Convert offerings to candle positions for CandleCloud
  const offeringCandles = useMemo(() => {
    if (!offerings || offerings.length === 0) return []
    
    // Simple hash function to generate consistent random values from a string
    const hashCode = (str) => {
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash = hash & hash // Convert to 32bit integer
      }
      return Math.abs(hash)
    }
    
    // Seeded random generator
    const seededRandom = (seed, min = 0, max = 1) => {
      const x = Math.sin(seed) * 10000
      return min + (x - Math.floor(x)) * (max - min)
    }
    
    return offerings.map((offering, index) => {
      // Use offering ID or index as seed for consistent randomness
      const seed = hashCode(offering.id || `offering_${index}`)
      
      // Use stored position from Firestore if available
      const storedPos = offering.position
      const x = storedPos?.x ?? seededRandom(seed + 1, -15, 15)
      const y = storedPos?.y ?? seededRandom(seed + 2, -10, 10)
      const z = storedPos?.z ?? seededRandom(seed + 3, -7.5, 7.5)
      
      return {
        position: [x, y, z],
        x: x,
        y: y,
        z: z,
        rotation: seededRandom(seed + 4, 0, Math.PI * 2),
        scale: seededRandom(seed + 5, 0.8, 1.2),
        offering: offering,
        userId: offering.userId || offering.uid || `user_${index}`,
        username: offering.userName || offering.username || 'Anonymous',
        id: offering.id || `offering_${index}`,
        litAt: offering.litAt || offering.createdAt?.toDate?.()?.getTime?.() || offering.timestamp?.toDate?.()?.getTime?.()
      }
    })
  }, [offerings])
  
  // Cleanup expired candles every minute
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Date.now()
      console.log('🧹 Running candle cleanup check...')
      
      // Find expired offerings
      const expiredOfferings = offerings.filter(offering => {
        const litAtTime = offering.litAt || offering.createdAt?.toDate?.()?.getTime?.() || offering.timestamp?.toDate?.()?.getTime?.()
        
        console.log(`🔍 Offering ${offering.id}: litAt=${offering.litAt}, litAtTime=${litAtTime}, now=${now}`)
        
        if (!litAtTime) {
          console.log(`❌ No litAtTime found for offering ${offering.id}`)
          return false
        }
        
        const elapsed = (now - litAtTime) / 1000
        const isExpired = elapsed >= 299 // Remove at 99.7% melted (just before 5 minutes) - TESTING
        
        console.log(`📏 Offering ${offering.id}: elapsed=${elapsed.toFixed(1)}s, isExpired=${isExpired}`)
        
        if (isExpired) {
          console.log(`⏰ Found expired candle: ${offering.id}, elapsed: ${elapsed.toFixed(1)}s`)
        }
        
        return isExpired
      })
      
      console.log(`📊 Checked ${offerings.length} offerings, found ${expiredOfferings.length} expired`)
      
      // Remove expired offerings from Firestore
      if (expiredOfferings.length > 0) {
        console.log(`🗑️ Removing ${expiredOfferings.length} expired candles`)
        
        for (const offering of expiredOfferings) {
          try {
            // Import deleteDoc and doc from firebaseClient
            const { deleteDoc, doc, db } = await import('@/lib/firebaseClient')
            await deleteDoc(doc(db, 'offerings', offering.id))
            console.log(`✅ Removed expired candle: ${offering.id}`)
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
  const [activeStatsTab, setActiveStatsTab] = useState('price') // 'price', 'staking', 'mood', or 'leaders'
  const [userCandleData, setUserCandleData] = useState(null) // Store user's candle data for tooltip
  const [hoveredCandleId, setHoveredCandleId] = useState(null)
  const [targetCameraPosition, setTargetCameraPosition] = useState(null) // For camera movement
  const [userCandlePosition, setUserCandlePosition] = useState(null) // Store 3D position
  const [resetCameraToDefault, setResetCameraToDefault] = useState(false) // Reset camera flag
  const [overrideCameraControl, setOverrideCameraControl] = useState(false) // Override all camera controls
  const [clickedCandleData, setClickedCandleData] = useState(null) // Data for any clicked candle tooltip
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
          limit(10)
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
    // Override all camera controls
    setOverrideCameraControl(true)
    
    // Save current rotation and reset scene to default rotation
    savedUserRotation.current = userRotationRef.current
    setUserRotation(0)
    
    // Find user's candle directly from the offeringCandles computed in the component
    const userCandleIndex = offeringCandles.findIndex(c => c.userId === currentUserId)
    
    if (userCandleIndex !== -1) {
      const userCandle = offeringCandles[userCandleIndex]
      
      // Calculate the actual instance ID (base candles + offering index)
      // Base candles are 0-299 on mobile, 0-499 on desktop
      const baseCandles = isMobile ? 100 : 100
      const actualInstanceId = baseCandles + userCandleIndex
      

      
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
      const meltPercentage = Math.min(100, (elapsed / 300) * 100).toFixed(1) // 5 minutes test duration
      const formattedDate = `lit ${timeAgo}, ${meltPercentage}% melted`
      setUserCandleData({
        instanceId: actualInstanceId,
        litAt: formattedDate,
        litDate: litAt,
        message: userCandle.offering.message || userCandle.offering.text,
        username: userCandle.offering.name || userCandle.username || 'Anonymous',
        userImageUrl: userCandle.offering.userImageUrl || userCandle.offering.imageUrl || null,
        userId: userCandle.userId
      })
      
      // Don't show tooltip immediately - wait for hover
      // Just store the data for when user hovers
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
    
    // Restore the user's scene rotation
    setUserRotation(0) // First reset to 0 to match initial state
    
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
        effectRef.current.triggerEffect(offering)
        // NOTE: onLightCandle is NOT called here to prevent duplicate Prayer Received
        // The onLightCandle callback should be called by the component that triggers this effect
        
        // Activate ripple state to trigger purple screen and brighter aura
        setIsRippleActive(true)
        setTimeout(() => setIsRippleActive(false), 8000) // Match the justLitOffering duration
      }
    },
    findUserCandle,
    resetView
  }), [findUserCandle, resetView])
  const [userRotation, setUserRotation] = useState(0)
  
  // Keep ref in sync with state
  useEffect(() => {
    userRotationRef.current = userRotation
  }, [userRotation])
  
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, rotation: 0 })
  const hasDraggedEnough = useRef(false) // Track if we've moved enough to start rotating
  const DRAG_THRESHOLD = 5 // Pixels to move before rotation starts
  const hasReachedSection = true // const [hasReachedSection, setHasReachedSection] = useState(true)
  const isInView = true // const [isInView, setIsInView] = useState(true)
  const canvasRef = useRef()
  const [contextLost, setContextLost] = useState(false)
  
  
  // Clean up WebGL context and Three.js resources on unmount
useEffect(() => {
  return () => {
    // Comprehensive cleanup function
    const cleanupResources = () => {
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
    }

    // Defer cleanup to next frame to allow React to finish
    requestAnimationFrame(cleanupResources)
  }
}, [])
  
  // Price history - update much less frequently
  const [priceHistory, setPriceHistory] = useState(() =>
    Array(20).fill(0.00042) // Start with consistent values for SSR
  )
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
    console.log('[UnifiedShrine] Component effect running, setting mounted = true')
    
    // Small delay to ensure parent is fully ready and GLTF is preloaded
    const timer = setTimeout(() => {
      setMounted(true)
      console.log('[UnifiedShrine] mounted state set to true')
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

    // Clear any existing tooltip timeout
    if (timeoutRefs.current['tooltip']) {
      clearTimeout(timeoutRefs.current['tooltip'])
      delete timeoutRefs.current['tooltip']
    }

    setClickedCandleId(instanceId)

    // Check if this is the user's candle
    if (userCandleData && instanceId === userCandleData.instanceId) {
      // Toggle hover state for user's candle
      setHoveredCandleId(prev => prev === instanceId ? null : instanceId)
      setClickedCandleData(null) // Don't show tooltip for user's own candle
    } else {
      // Check if this is an offering candle with real data
      const baseCandles = 100
      if (instanceId >= baseCandles && offeringCandles.length > 0) {
        const offeringIndex = instanceId - baseCandles
        if (offeringIndex < offeringCandles.length) {
          const candle = offeringCandles[offeringIndex]
          const offering = candle.offering

          // Calculate time info
          const litAtTime = candle.litAt || offering?.createdAt?.toDate?.()?.getTime?.() || Date.now()
          const now = Date.now()
          const elapsed = (now - litAtTime) / 1000

          // Format time ago
          let timeAgo
          if (elapsed < 60) {
            timeAgo = `${Math.floor(elapsed)}s ago`
          } else if (elapsed < 3600) {
            timeAgo = `${Math.floor(elapsed / 60)}m ago`
          } else if (elapsed < 86400) {
            timeAgo = `${Math.floor(elapsed / 3600)}h ago`
          } else {
            timeAgo = `${Math.floor(elapsed / 86400)}d ago`
          }

          // Calculate melt percentage
          const meltPercentage = Math.min(100, (elapsed / 300) * 100).toFixed(1)

          setClickedCandleData({
            username: offering?.name || candle.username || 'Anonymous',
            userImageUrl: offering?.userImageUrl || null,
            litAt: `lit ${timeAgo}, ${meltPercentage}% melted`,
            message: offering?.message || null,
            isCurrentUser: candle.userId === currentUserId
          })

          // Auto-dismiss tooltip after 4 seconds
          timeoutRefs.current['tooltip'] = setTimeout(() => {
            setClickedCandleData(null)
            delete timeoutRefs.current['tooltip']
          }, 4000)
        }
      } else {
        // Base candle (no owner data)
        setClickedCandleData({
          username: 'Eternal Flame',
          userImageUrl: null,
          litAt: 'burns forever',
          message: null,
          isCurrentUser: false
        })

        // Auto-dismiss tooltip after 3 seconds
        timeoutRefs.current['tooltip'] = setTimeout(() => {
          setClickedCandleData(null)
          delete timeoutRefs.current['tooltip']
        }, 3000)
      }

      // Clear purple glow after 2 seconds
      timeoutRefs.current[instanceId] = setTimeout(() => {
        setClickedCandleId(null)
        delete timeoutRefs.current[instanceId]
      }, 2000)

      if (offerings?.length > 0 && onSelectOffering) {
        if (instanceId >= baseCandles) {
          const offeringIndex = instanceId - baseCandles
          if (offeringIndex < offerings.length) {
            onSelectOffering(offerings[offeringIndex])
          }
        }
      }
    }
  }, [offerings, onSelectOffering, userCandleData, offeringCandles, currentUserId])

  const handleNewCandle = useCallback((position, offering) => {
    setAdditionalCandles(prev => [...prev, {
      position,
      offering,
      id: Date.now(),
      rotation: Math.random() * Math.PI * 2
    }])
    
    // Show the latest polaroid on the phone screen after a delay
    setTimeout(() => {
      setShowLatestPolaroid(true);
      // Hide it after 8 seconds
      setTimeout(() => {
        setShowLatestPolaroid(false);
      }, 8000);
    }, 2000); // Show after 2 seconds (when burst is complete)
    
    // Stats update automatically from offerings prop
    
    if (onLightCandle) {
      onLightCandle(offering)
    }
  }, [onLightCandle])

  // Trigger pulse in candle cloud when Arctic Rings fire
  const handleCandlePulse = useCallback((position) => {
    if (window.sharedUniforms) {
      window.sharedUniforms.uPulseTime.value = window.sharedUniforms.uTime.value
      window.sharedUniforms.uPulsePosition.value.set(position[0], position[1], position[2])
    }
  }, [])

  const handlePointerDown = useCallback((event) => {
    // Mark potential drag start but don't start rotating yet
    isDragging.current = true
    hasDraggedEnough.current = false
    dragStart.current = {
      x: event.clientX || event.touches?.[0]?.clientX || 0,
      rotation: userRotation,
      startX: event.clientX || event.touches?.[0]?.clientX || 0 // Store initial position
    }
    // Don't change cursor yet - wait for actual drag
  }, [userRotation])

  const handlePointerMove = useCallback((event) => {
    if (isDragging.current) {
      const clientX = event.clientX || event.touches?.[0]?.clientX || 0
      
      // Check if we've moved enough to start rotating
      if (!hasDraggedEnough.current) {
        const distanceMoved = Math.abs(clientX - dragStart.current.startX)
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
        const deltaX = (clientX - dragStart.current.x) * 0.01
        const newRotation = dragStart.current.rotation + deltaX
        
        // Allow full 360 degree rotation
        setUserRotation(newRotation)
      }
    }
  }, [])

  const handlePointerUp = useCallback(() => {
    isDragging.current = false
    hasDraggedEnough.current = false
    // Only reset cursor if we actually started dragging
    if (typeof document !== 'undefined' && document.body && document.body.style.cursor === 'grabbing') {
      document.body.style.cursor = 'auto'
    }
  }, [])

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
    top: isMobile ? '100px' : '105px',
    right: isMobile ? '10px' : '20px',
    // background: 'rgba(0, 0, 0, 0.8)',
    border: `2px solid ${displayPrice.change >= 0 ? '#00ff66' : '#ff4444'}`,
    borderRadius: '12px',
    padding: isMobile ? '10px 12px' : '18px',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: isMobile ? '11px' : '14px',
    backdropFilter: 'blur(20px)',
    boxShadow: `0 0 20px ${displayPrice.change >= 0 ? 'rgba(0, 255, 100, 0.3)' : 'rgba(255, 68, 68, 0.3)'}`,
    zIndex: 1000,
    width: isMobile ? '160px' : '240px',
    pointerEvents: 'auto'
  }), [isMobile, displayPrice.change])
  
  // Memoize price chart bars
  const priceChartBars = useMemo(() => {
    const recentPrices = priceHistory.slice(-20)
    const min = Math.min(...recentPrices)
    const max = Math.max(...recentPrices)
    const range = max - min || 1
    
    return recentPrices.map((price, i) => {
      const height = ((price - min) / range) * 35 + 5
      return (
        <div
          key={i}
          style={{
            width: '8px',
            height: `${height}px`,
            background: i === 19 ? (displayPrice.change >= 0 ? '#00ff66' : '#ff4444') : '#444',
            borderRadius: '2px'
          }}
        />
      )
    })
  }, [priceHistory, displayPrice.change])
  

  return (
    <div style={{ width: '100vw', height: isMobile ? '100vh' : '100vh', background: is80sMode ? 'transparent' : '#000', position: 'fixed'}}>
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
          height: '100vh', 
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

      {/* Fixed screen-space panel for user's candle info */}
      {targetCameraPosition && userCandleData && (
        <div
          style={{
            position: 'absolute',
            top: isMobile ? '120px' : '80px',
            right: isMobile ? '16px' : '24px',
            background: 'rgba(20, 20, 30, 0.98)',
            borderRadius: '24px',
            padding: isMobile ? '1.5rem' : '2rem',
            minWidth: isMobile ? '220px' : '280px',
            maxWidth: isMobile ? '280px' : '320px',
            border: '1px solid rgba(138, 43, 226, 0.4)',
            boxShadow: '0 0 60px rgba(138, 43, 226, 0.3)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 101,
            animation: 'slideInRight 0.4s ease-out',
            pointerEvents: 'none',
            textAlign: 'center',
          }}
        >
          {/* Icon/Avatar */}
          <div style={{ marginBottom: '1rem' }}>
            {userCandleData.userImageUrl ? (
              <img
                src={userCandleData.userImageUrl}
                alt={userCandleData.username}
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  filter: 'drop-shadow(0 0 20px rgba(138, 43, 226, 0.8)) drop-shadow(0 0 40px rgba(138, 43, 226, 0.5))',
                  border: '2px solid rgba(138, 43, 226, 0.6)'
                }}
              />
            ) : (
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #8a2be2, #ff006e)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#fff',
                margin: '0 auto',
                filter: 'drop-shadow(0 0 20px rgba(138, 43, 226, 0.8)) drop-shadow(0 0 40px rgba(138, 43, 226, 0.5))',
                border: '2px solid rgba(138, 43, 226, 0.6)'
              }}>
                {userCandleData.username?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
          </div>

          {/* Title */}
          <h2 style={{
            fontSize: isMobile ? '1rem' : '1.2rem',
            marginBottom: '0.5rem',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            fontFamily: "'Orbitron', monospace",
            color: '#fff'
          }}>
            Your Candle
          </h2>

          {/* Username */}
          <p style={{
            marginBottom: '1rem',
            color: '#00f5d4',
            fontSize: isMobile ? '1rem' : '1.1rem',
            fontWeight: '600',
            lineHeight: '1.5'
          }}>
            {userCandleData.username}
          </p>

          {/* Candle stats */}
          <div style={{
            padding: '0.75rem 1rem',
            background: 'rgba(138, 43, 226, 0.15)',
            borderRadius: '12px',
            border: '1px solid rgba(138, 43, 226, 0.3)',
            marginBottom: userCandleData.message ? '1rem' : '0'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}>
              <span style={{ fontSize: '18px' }}>🕯️</span>
              <span style={{
                fontSize: isMobile ? '0.85rem' : '0.9rem',
                color: '#fff',
                fontFamily: "'Orbitron', monospace",
                letterSpacing: '0.5px'
              }}>
                {userCandleData.litAt}
              </span>
            </div>
          </div>

          {/* Message if present */}
          {userCandleData.message && (
            <div style={{
              padding: '0.75rem 1rem',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '12px',
              fontSize: isMobile ? '0.85rem' : '0.9rem',
              color: 'rgba(255, 255, 255, 0.8)',
              fontStyle: 'italic',
              lineHeight: '1.5',
            }}>
              "{userCandleData.message}"
            </div>
          )}
        </div>
      )}
      
      {mounted && typeof window !== 'undefined' && (
      <CanvasErrorBoundary>
      <Canvas
        camera={{ position: [0, isMobile ? 0 : 0, isMobile ? 2 : 0], fov: isMobile ? 75 : 70 }}
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

        {/* Camera animator for smooth transitions */}
        <CameraAnimator 
          targetPosition={targetCameraPosition} 
          resetToDefault={resetCameraToDefault}
          isMobile={isMobile}
        />
        
        {/* Rotatable scene content */}
        <SceneRotator 
          userRotation={userRotation}
          onRotationStart={handlePointerDown}
          onRotationMove={handlePointerMove}
          onRotationEnd={handlePointerUp}
        >
          {/* Combined group for hands and surrounding candles */}
          <group position={[0, 0, 0]}>
            <Suspense >
              <CandleCloud
                count={isMobile ? 100 : 100}
                priceRef={priceRef}
                shortTermPriceRef={shortTermPriceRef}
                continuousOffsetRef={continuousOffsetRef}
                additionalCandles={[...offeringCandles, ...additionalCandles]}
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
              
              {/* Particle effects for highlighted candle - Removed green ring */}
              {/* {userCandlePosition && targetCameraPosition && (
                <HighlightedCandleParticles position={userCandlePosition} />
              )} */}
            </Suspense> 
            
        
            <Suspense fallback={null}>
              <group scale={1.8} position={[0, -1, -6]}>
                <HandsModel 
                  mousePosition={{ x: 0, y: 0 }}
                  hasReachedSection={hasReachedSection}
                  isInView={isInView}
                  offerings={offerings}
                  hoveredOffering={hoveredOffering}
                  justLitOffering={justLitOffering}
                  onJustLitComplete={onJustLitComplete}
                  userRotation={userRotation}
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
        
<NewCandleEffectManager
  ref={effectRef}
  phonePosition={[0, 0, 5]}
  onNewCandle={handleNewCandle}
  // onBloomPulse={setBloomIntensity}  // Disabled for stability
  onCandlePulse={handleCandlePulse}  // Trigger pulse in candle cloud
/>
        
            {/* Camera controller for focus mode - disabled when overriding camera control */}
            {!overrideCameraControl && <CameraController focusMode={focusMode} />}
            
     

  <Suspense fallback={null}>

      <EffectComposer>
        <Bloom 
          intensity={1.0}
          luminanceThreshold={0.1}
          luminanceSmoothing={0.9}
          mipmapBlur
        radius={0.8}
      />
    </EffectComposer>

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

      {/* Clicked candle tooltip - shows owner info */}
      {clickedCandleData && !targetCameraPosition && (
        <div
          style={{
            position: 'absolute',
            bottom: isMobile ? '100px' : '40px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(20, 20, 30, 0.95)',
            borderRadius: '16px',
            padding: isMobile ? '12px 16px' : '14px 20px',
            minWidth: isMobile ? '200px' : '240px',
            maxWidth: isMobile ? '280px' : '320px',
            border: clickedCandleData.isCurrentUser
              ? '1px solid rgba(0, 245, 212, 0.5)'
              : '1px solid rgba(138, 43, 226, 0.4)',
            boxShadow: clickedCandleData.isCurrentUser
              ? '0 0 40px rgba(0, 245, 212, 0.3)'
              : '0 0 40px rgba(138, 43, 226, 0.3)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 102,
            animation: 'slideUpFade 0.3s ease-out',
            pointerEvents: 'none',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            {/* Avatar */}
            {clickedCandleData.userImageUrl ? (
              <img
                src={clickedCandleData.userImageUrl}
                alt={clickedCandleData.username}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: clickedCandleData.isCurrentUser
                    ? '2px solid rgba(0, 245, 212, 0.6)'
                    : '2px solid rgba(138, 43, 226, 0.6)',
                  flexShrink: 0
                }}
              />
            ) : (
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: clickedCandleData.isCurrentUser
                  ? 'linear-gradient(135deg, #00f5d4, #00b894)'
                  : 'linear-gradient(135deg, #8a2be2, #ff006e)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#fff',
                border: clickedCandleData.isCurrentUser
                  ? '2px solid rgba(0, 245, 212, 0.6)'
                  : '2px solid rgba(138, 43, 226, 0.6)',
                flexShrink: 0
              }}>
                {clickedCandleData.username?.charAt(0).toUpperCase() || '?'}
              </div>
            )}

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontWeight: 'bold',
                fontSize: isMobile ? '14px' : '15px',
                color: clickedCandleData.isCurrentUser ? '#00f5d4' : '#fff',
                fontFamily: "'Orbitron', monospace",
                marginBottom: '2px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {clickedCandleData.username}
                {clickedCandleData.isCurrentUser && (
                  <span style={{
                    fontSize: '10px',
                    marginLeft: '6px',
                    opacity: 0.8,
                    fontWeight: 'normal'
                  }}>
                    (you)
                  </span>
                )}
              </div>
              <div style={{
                fontSize: isMobile ? '11px' : '12px',
                color: 'rgba(255, 255, 255, 0.7)',
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>🕯️</span>
                <span>{clickedCandleData.litAt}</span>
              </div>
            </div>
          </div>

          {/* Message if present */}
          {clickedCandleData.message && (
            <div style={{
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: isMobile ? '12px' : '13px',
              color: 'rgba(255, 255, 255, 0.8)',
              fontStyle: 'italic',
              lineHeight: '1.4',
              textAlign: 'center'
            }}>
              "{clickedCandleData.message}"
            </div>
          )}
        </div>
      )}
      
      {/* Container for Stats Box and Find My Candle button on mobile */}
      {!targetCameraPosition && (
        <div style={{
          position: 'fixed',
          top: isMobile ? '100px' : '105px',
          right: isMobile ? '10px' : '20px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          alignItems: 'flex-end',
        }}>
        {/* Unified Stats Box with Tabs */}
        <div style={{
          ...unifiedStatsStyle,
          position: 'relative',
          top: 0,
          right: 0,
        }}>
        {/* Tab Headers */}
        <div style={{
          display: 'flex',
          gap: isMobile ? '2px' : '4px',
          marginBottom: isMobile ? '8px' : '12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setActiveStatsTab('price')}
            style={{
              flex: 1,
              padding: isMobile ? '4px 4px' : '6px 8px',
              background: activeStatsTab === 'price' ? 'rgba(212, 175, 55, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: activeStatsTab === 'price' ? '2px solid #d4af37' : '2px solid transparent',
              color: activeStatsTab === 'price' ? '#d4af37' : '#ccc',
              fontSize: isMobile ? '10px' : '12px',
              fontFamily: 'monospace',
              fontWeight: activeStatsTab === 'price' ? 'bold' : 'normal',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'all 0.2s',
              marginBottom: '-1px',
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            Price
          </button>
          <button
            onClick={() => setActiveStatsTab('staking')}
            style={{
              flex: 1,
              padding: isMobile ? '4px 4px' : '6px 8px',
              background: activeStatsTab === 'staking' ? 'rgba(0, 245, 212, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: activeStatsTab === 'staking' ? '2px solid #00f5d4' : '2px solid transparent',
              color: activeStatsTab === 'staking' ? '#00f5d4' : '#ccc',
              fontSize: isMobile ? '10px' : '12px',
              fontFamily: 'monospace',
              fontWeight: activeStatsTab === 'staking' ? 'bold' : 'normal',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'all 0.2s',
              marginBottom: '-1px',
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            Stake
          </button>
          <button
            onClick={() => setActiveStatsTab('mood')}
            style={{
              flex: 1,
              padding: isMobile ? '4px 4px' : '6px 8px',
              background: activeStatsTab === 'mood' ? 'rgba(167, 139, 250, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: activeStatsTab === 'mood' ? '2px solid #a78bfa' : '2px solid transparent',
              color: activeStatsTab === 'mood' ? '#a78bfa' : '#ccc',
              fontSize: isMobile ? '10px' : '12px',
              fontFamily: 'monospace',
              fontWeight: activeStatsTab === 'mood' ? 'bold' : 'normal',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'all 0.2s',
              marginBottom: '-1px',
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            Mood
          </button>
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
            background: 'rgba(212, 175, 55, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            textAlign: 'center'
          }}>
            <div style={{ 
              fontSize: isMobile ? '16px' : '16px', 
              fontWeight: 'bold',
              color: '#d4af37',
              marginBottom: '4px'
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
              Candles
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
              Tokens Burned
            </div>
          </div>
        </div>
        
        {/* Mini chart - desktop only */}
        {!isMobile && (
          <div style={{
            height: '30px',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '1px',
            opacity: 0.6
          }}>
            {priceChartBars}
          </div>
        )}
          </>
        ) : activeStatsTab === 'staking' ? (
          <>
            {/* Staking Tab Content - Global Stats */}
            {/* TVL Section - Prominent */}
            <div style={{
              marginBottom: isMobile ? '10px' : '15px',
              padding: isMobile ? '8px' : '12px',
              background: 'rgba(0, 245, 212, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(0, 245, 212, 0.3)'
            }}>
              <div style={{ 
                fontSize: isMobile ? '18px' : '24px', 
                fontWeight: 'bold',
                color: '#00f5d4',
                marginBottom: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>${calculateTVL}</span>
              </div>
              <div style={{
                fontSize: isMobile ? '11px' : '12px',
                color: '#ccc',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Total Value Locked
              </div>
            </div>
            
            {/* APR & Total Rewards - Side by side */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: isMobile ? '8px' : '10px',
              marginBottom: isMobile ? '10px' : '15px'
            }}>
              {/* Current APR */}
              <div style={{
                padding: isMobile ? '8px' : '10px',
                background: 'rgba(0, 255, 102, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(0, 255, 102, 0.3)',
                textAlign: 'center'
              }}>
                <div style={{ 
                  fontSize: isMobile ? '16px' : '16px', 
                  fontWeight: 'bold',
                  color: '#00ff66',
                  marginBottom: '4px'
                }}>
                  {calculateAPR}%
                </div>
                <div style={{
                  fontSize: isMobile ? '10px' : '11px',
                  color: '#ccc',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Current APR
                </div>
              </div>
              
              {/* Total Rewards Paid */}
              <div style={{
                padding: isMobile ? '8px' : '10px',
                background: 'rgba(255, 215, 0, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 215, 0, 0.3)',
                textAlign: 'center'
              }}>
                <div style={{ 
                  fontSize: isMobile ? '14px' : '14px', 
                  fontWeight: 'bold',
                  color: '#ffd700',
                  marginBottom: '4px'
                }}>
                  {totalRewardsPaid}
                </div>
                <div style={{
                  fontSize: isMobile ? '10px' : '11px',
                  color: '#ccc',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Rewards Claimed
                </div>
              </div>
            </div>
            
            {/* Total Staked Tokens */}
            {/* <div style={{
              padding: isMobile ? '8px' : '10px',
              background: 'rgba(138, 43, 226, 0.05)',
              borderRadius: '8px',
              border: '1px solid rgba(138, 43, 226, 0.2)',
              fontSize: isMobile ? '11px' : '12px',
              color: '#ccc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>Total Staked:</span>
              <span style={{ 
                color: '#fff', 
                fontWeight: 'bold' 
              }}>
                {parseFloat(totalStaked || 0).toLocaleString()} RL80
              </span>
            </div> */}
          </>
        ) : activeStatsTab === 'mood' ? (
          <>
            {/* Mood Tab Content */}
            <div style={{
              padding: 0,
              margin: isMobile ? '-6px' : '-10px',
              maxHeight: isMobile ? '400px' : 'auto',
              minHeight: isMobile ? '300px' : '320px',
              overflowY: isMobile ? 'auto' : 'visible',
              overflowX: 'hidden'
            }}>
              <CongregationSentiment />
            </div>
          </>
        ) : activeStatsTab === 'leaders' ? (
          <>
            {/* Leaders Tab Content */}
            <div style={{
              padding: 0,
              margin: isMobile ? '-2px' : '-4px',
            }}>
              {/* Header */}
              <div style={{
                textAlign: 'center',
                marginBottom: isMobile ? '8px' : '12px',
                padding: '8px',
                background: 'rgba(255, 149, 0, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 149, 0, 0.2)'
              }}>
                <div style={{
                  fontSize: isMobile ? '11px' : '12px',
                  color: '#ff9500',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontFamily: "'Orbitron', monospace",
                  fontWeight: 'bold'
                }}>
                  🔥 Illuminati 🔥
                </div>
                <div style={{
                  fontSize: isMobile ? '9px' : '10px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginTop: '2px'
                }}>
                  Top Burners (All Time)
                </div>
              </div>

              {/* Leaderboard List */}
              {leaderboardLoading ? (
                <div style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '12px'
                }}>
                  Loading...
                </div>
              ) : leaderboardData.length === 0 ? (
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
                  display: 'flex',
                  flexDirection: 'column',
                  gap: isMobile ? '4px' : '6px',
                  maxHeight: isMobile ? '200px' : '240px',
                  overflowY: 'auto'
                }}>
                  {leaderboardData.map((leader, index) => (
                    <div
                      key={leader.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: isMobile ? '6px 8px' : '8px 10px',
                        background: index === 0
                          ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 149, 0, 0.1))'
                          : index === 1
                          ? 'linear-gradient(135deg, rgba(192, 192, 192, 0.15), rgba(150, 150, 150, 0.05))'
                          : index === 2
                          ? 'linear-gradient(135deg, rgba(205, 127, 50, 0.15), rgba(180, 100, 40, 0.05))'
                          : 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '8px',
                        border: index < 3
                          ? `1px solid ${index === 0 ? 'rgba(255, 215, 0, 0.4)' : index === 1 ? 'rgba(192, 192, 192, 0.3)' : 'rgba(205, 127, 50, 0.3)'}`
                          : '1px solid rgba(255, 255, 255, 0.05)'
                      }}
                    >
                      {/* Rank */}
                      <div style={{
                        width: '20px',
                        textAlign: 'center',
                        fontSize: index < 3 ? '14px' : '11px',
                        fontWeight: 'bold',
                        color: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : 'rgba(255, 255, 255, 0.5)'
                      }}>
                        {index === 0 ? '👑' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                      </div>

                      {/* Avatar */}
                      {leader.userImageUrl ? (
                        <img
                          src={leader.userImageUrl}
                          alt={leader.username}
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: index < 3 ? '2px solid rgba(255, 149, 0, 0.5)' : '1px solid rgba(255, 255, 255, 0.2)'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #ff9500, #ff6600)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          color: '#fff'
                        }}>
                          {leader.username?.charAt(0).toUpperCase() || '?'}
                        </div>
                      )}

                      {/* Name */}
                      <div style={{
                        flex: 1,
                        fontSize: isMobile ? '11px' : '12px',
                        color: index < 3 ? '#fff' : 'rgba(255, 255, 255, 0.8)',
                        fontWeight: index < 3 ? 'bold' : 'normal',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {leader.username || 'Anonymous'}
                      </div>

                      {/* Burned Amount */}
                      <div style={{
                        fontSize: isMobile ? '10px' : '11px',
                        color: '#ff9500',
                        fontFamily: 'monospace',
                        fontWeight: 'bold'
                      }}>
                        {leader.totalBurned >= 1000000000
                          ? `${(leader.totalBurned / 1000000000).toFixed(1)}B`
                          : leader.totalBurned >= 1000000
                          ? `${(leader.totalBurned / 1000000).toFixed(1)}M`
                          : leader.totalBurned >= 1000
                          ? `${(leader.totalBurned / 1000).toFixed(1)}K`
                          : leader.totalBurned?.toLocaleString() || '0'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
        </div>
        
        {/* Find My Candle button for mobile - positioned below stats box */}
        {isMobile && currentUserId && !targetCameraPosition && (
          <button
            onClick={() => findUserCandle()}
            style={{
              background: 'linear-gradient(135deg, #ffaa00 0%, #ff8800 100%)',
              border: '2px solid rgba(255, 170, 0, 0.3)',
              borderRadius: '12px',
              padding: '10px 16px',
              color: '#000',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: '13px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(255, 170, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              width: '160px', // Match stats box width
            }}
          >
            🔍 <span style={{ fontSize: '11px' }}>FIND MY CANDLE</span>
          </button>
        )}
        </div>
      )}
      
      {/* Removed tooltip - will be added as Html in 3D space */}
      
    </div>
  )
})

export default UnifiedShrine