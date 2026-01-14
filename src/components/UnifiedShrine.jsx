'use client'
import React, { useRef, useState, useEffect, Suspense, useCallback, useMemo, forwardRef, useImperativeHandle, Component } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Stats, useGLTF } from '@react-three/drei'
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
import CongregationSentiment from './SentimentData';




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

  componentDidCatch(_error, errorInfo) {
    console.warn('Canvas error details:', errorInfo)
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
  is80sMode,
  hoveredOffering,
  justLitOffering,
  onJustLitComplete,
  user = null 
}, ref) {
  // Track if component is mounted for SSR safety
  const [mounted, setMounted] = useState(false)
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
  const [clickedCandleId, setClickedCandleId] = useState(null)
  const [isRippleActive, setIsRippleActive] = useState(false)
  const [activeStatsTab, setActiveStatsTab] = useState('price') // 'price', 'staking', or 'mood'
  
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
  
  // Expose method to trigger candle effect
  useImperativeHandle(ref, () => ({
    triggerCandleEffect: (offering) => {
      if (effectRef.current) {
        effectRef.current.triggerEffect(offering)
        // Immediately show on phone when effect starts
        if (onLightCandle) {
          onLightCandle(offering)
        }
        // Activate ripple state to trigger purple screen and brighter aura
        setIsRippleActive(true)
        setTimeout(() => setIsRippleActive(false), 8000) // Match the justLitOffering duration
      }
    }
  }), [onLightCandle])
  const [userRotation, setUserRotation] = useState(0)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, rotation: 0 })
  const hasDraggedEnough = useRef(false) // Track if we've moved enough to start rotating
  const DRAG_THRESHOLD = 5 // Pixels to move before rotation starts
  const [isMobile, setIsMobile] = useState(false)
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
  const [displayedCandleCount, setDisplayedCandleCount] = useState(500)
  const [displayedBurnTotal, setDisplayedBurnTotal] = useState(0) // Will be updated with real data
  const [candleCountAnimation, setCandleCountAnimation] = useState(false)
  const [showLatestPolaroid, setShowLatestPolaroid] = useState(true) // Always show polaroids
  
  // Calculate real stats from offerings
  const realCandleCount = useMemo(() => {
    // Use totalOfferingsCount if provided, otherwise fall back to offerings.length
    const offeringsCount = totalOfferingsCount > 0 ? totalOfferingsCount : offerings.length
    const count = 500 + offeringsCount
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
    console.log('Total Supply from contract:', totalSupplyData)
    console.log('Is Loading Supply:', isLoadingSupply)
    
    if (totalSupplyData !== undefined && totalSupplyData !== null) {
      // Convert BigInt to number and calculate burned amount
      const currentSupply = Number(totalSupplyData / BigInt(10 ** 18)) // Convert from wei to tokens
      const burnedFromContract = INITIAL_SUPPLY - currentSupply
      
      console.log('Current Supply:', currentSupply)
      console.log('Burned from contract:', burnedFromContract)
      
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
    // Mount immediately - don't delay
    setMounted(true)
    // Generate random initial values only on client side
    setPriceHistory(Array(20).fill(0).map(() => 0.00042 + Math.random() * 0.00001 - 0.000005))
    
    return () => {
      // Cleanup on unmount
      setMounted(false)
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

  const handleCandleClick = useCallback((instanceId) => {
    if (timeoutRefs.current[instanceId]) {
      clearTimeout(timeoutRefs.current[instanceId])
      delete timeoutRefs.current[instanceId]
    }
    
    setClickedCandleId(instanceId)
    
    timeoutRefs.current[instanceId] = setTimeout(() => {
      setClickedCandleId(null)
      delete timeoutRefs.current[instanceId]
    }, 2000)
    
    if (offerings?.length > 0 && onSelectOffering) {
      const randomIndex = Math.floor(Math.random() * offerings.length)
      const selectedOffering = offerings[randomIndex]
      console.log('[UnifiedShrine] Candle clicked, selecting offering:', {
        randomIndex,
        totalOfferings: offerings.length,
        selectedId: selectedOffering?.id,
        selectedName: selectedOffering?.name,
        selectedMessage: selectedOffering?.message?.substring(0, 50)
      })
      onSelectOffering(selectedOffering)
    }
  }, [offerings, onSelectOffering])

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
          background: is80sMode ? 'transparent' : '#000'
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

        
        
        {/* Rotatable scene content */}
        <SceneRotator 
          userRotation={userRotation}
          onRotationStart={handlePointerDown}
          onRotationMove={handlePointerMove}
          onRotationEnd={handlePointerUp}
        >
          {/* Combined group for hands and surrounding candles */}
          <group position={[0, 0, 0]}>
            <Suspense fallback={null}>
              <CandleCloud
                count={isMobile ? 300 : 500}
                priceRef={priceRef}
                shortTermPriceRef={shortTermPriceRef}
                continuousOffsetRef={continuousOffsetRef}
                additionalCandles={additionalCandles}
                onCandleClick={handleCandleClick}
                clickedCandleId={clickedCandleId}
                isMobile={isMobile}
                exclusionZone={exclusionZone}
              />
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
        
            {/* Camera controller for focus mode */}
            <CameraController focusMode={focusMode} />
            
     

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
      
      
      {/* CSS for candle count animation */}
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
    `}</style>
      
      {/* Unified Stats Box with Tabs */}
      <div style={unifiedStatsStyle}>
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
              color: activeStatsTab === 'price' ? '#d4af37' : '#888',
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
              color: activeStatsTab === 'staking' ? '#00f5d4' : '#888',
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
            Staking
          </button>
          <button
            onClick={() => setActiveStatsTab('mood')}
            style={{
              flex: 1,
              padding: isMobile ? '4px 4px' : '6px 8px',
              background: activeStatsTab === 'mood' ? 'rgba(167, 139, 250, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: activeStatsTab === 'mood' ? '2px solid #a78bfa' : '2px solid transparent',
              color: activeStatsTab === 'mood' ? '#a78bfa' : '#888',
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
              maxHeight: isMobile ? '350px' : 'auto',
              overflowY: isMobile ? 'auto' : 'visible',
              overflowX: 'hidden'
            }}>
              <CongregationSentiment />
            </div>
          </>
        ) : null}
      </div>
      
    </div>
  )
})

export default UnifiedShrine