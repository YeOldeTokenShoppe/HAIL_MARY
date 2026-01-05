'use client'
import React, { useRef, useState, useEffect, Suspense, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Stats, OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { HandsModel } from './HandsGLTFScene'
// IMPORTANT: Import from the optimized version!
import { CandleCloud, GradientBackground, SceneSetup } from './CandleShrine'
import { NewCandleEffectManager } from './NewCandleEffect'


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
        position={[0, 0, -100]}
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
        <meshBasicMaterial transparent opacity={0} />
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
  onSelectOffering, 
  onLightCandle, 
  onPriceChange, 
  is80sMode,
  hoveredOffering,
  justLitOffering,
  onJustLitComplete 
}, ref) {
  // Track if component is mounted for SSR safety
  const [mounted, setMounted] = useState(false)
  // Use refs for real-time price and movement (no re-renders)
  const priceRef = useRef(0)
  const shortTermPriceRef = useRef(0)
  const continuousOffsetRef = useRef(0)
const [bloomIntensity, setBloomIntensity] = useState(1.2)
  const effectRef = useRef()
  
  
  // State only for UI display (throttled updates)
  const [displayPrice, setDisplayPrice] = useState({
    direction: 0,
    change: 0,
    tokenPrice: 0.000420,
  })
  
  // TEST SLIDER CONTROL - Remove this when done testing
  const [testPriceOverride, setTestPriceOverride] = useState(null)
  const [showTestControls, setShowTestControls] = useState(true)
  
  const [additionalCandles, setAdditionalCandles] = useState([])
  const [clickedCandleId, setClickedCandleId] = useState(null)
  
  // Expose method to trigger candle effect
  useImperativeHandle(ref, () => ({
    triggerCandleEffect: (offering) => {
      if (effectRef.current) {
        effectRef.current.triggerEffect(offering)
      }
    }
  }), [])
  const [userRotation, setUserRotation] = useState(0)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, rotation: 0 })
  const hasDraggedEnough = useRef(false) // Track if we've moved enough to start rotating
  const DRAG_THRESHOLD = 5 // Pixels to move before rotation starts
  const [isMobile, setIsMobile] = useState(false)
  const [hasReachedSection, setHasReachedSection] = useState(true)
  const [isInView, setIsInView] = useState(true)
  const canvasRef = useRef()
  const [contextLost, setContextLost] = useState(false)
  
  // Clean up WebGL context on unmount
  useEffect(() => {
    return () => {
      if (canvasRef.current?.gl) {
        try {
          canvasRef.current.gl.dispose()
          canvasRef.current.gl = null
        } catch (err) {
          console.warn('Error cleaning up WebGL context:', err)
        }
      }
    }
  }, [])
  
  // Price history - update much less frequently
  const [priceHistory, setPriceHistory] = useState(() =>
    Array(20).fill(0.00042) // Start with consistent values for SSR
  )
  const lastHistoryUpdate = useRef(0)
  const HISTORY_UPDATE_INTERVAL = 500 // Update chart every 500ms
  
  // Static values that don't need to update
  const volume24h = 1234567
  const marketCap = 42069000

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
  
  // Initialize random price history after mount to avoid SSR mismatch
  useEffect(() => {
    setMounted(true)
    // Generate random initial values only on client side
    setPriceHistory(Array(20).fill(0).map(() => 0.00042 + Math.random() * 0.00001 - 0.000005))
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
    
    timeoutRefs.current[instanceId] = setTimeout(() => {
      setClickedCandleId(null)
      delete timeoutRefs.current[instanceId]
    }, 2000)
    
    if (offerings?.length > 0 && onSelectOffering) {
      const randomIndex = Math.floor(Math.random() * offerings.length)
      onSelectOffering(offerings[randomIndex])
    }
  }, [offerings, onSelectOffering])

  const handleNewCandle = useCallback((position, offering) => {
    setAdditionalCandles(prev => [...prev, {
      position,
      offering,
      id: Date.now(),
      rotation: Math.random() * Math.PI * 2
    }])
    
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

  // WebGL context lost/restore handlers
  useEffect(() => {
    if (!canvasRef.current) return
    
    const canvas = canvasRef.current.querySelector('canvas')
    if (!canvas) return
    
    const handleContextLost = (event) => {
      event.preventDefault()
      console.warn('WebGL context lost on shrine page')
      setContextLost(true)
      
      // Clear all timeouts and animations
      Object.values(timeoutRefs.current).forEach(clearTimeout)
      timeoutRefs.current = {}
    }
    
    const handleContextRestored = () => {
      console.log('WebGL context restored on shrine page')
      setContextLost(false)
    }
    
    canvas.addEventListener('webglcontextlost', handleContextLost)
    canvas.addEventListener('webglcontextrestored', handleContextRestored)
    
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost)
      canvas.removeEventListener('webglcontextrestored', handleContextRestored)
    }
  }, [canvasRef.current])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach(clearTimeout)
      timeoutRefs.current = {}
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.cursor = 'auto'
      }
      isDragging.current = false
      
      // Dispose of Three.js resources
      if (canvasRef.current) {
        const { gl, scene } = canvasRef.current
        if (scene) {
          scene.traverse((child) => {
            if (child.geometry) child.geometry.dispose()
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.dispose())
              } else {
                child.material.dispose()
              }
            }
          })
        }
        if (gl) {
          gl.dispose()
        }
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
  // Increased radius to better exclude candles from backdrop area
  const exclusionZone = useMemo(() => ({
    center: [0, -1, -7],
    radius: 8,  // Increased from 5 to better clear the backdrop
    height: 8   // Increased from 6 to cover more vertical space
  }), [])

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
    pointerEvents: 'none'
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
    <div style={{ width: '100%', height: isMobile ? '100vh' : '100vh', background: '#000', position: 'relative' }}>
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
      
      {/* {contextLost && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1000,
          background: 'rgba(0, 0, 0, 0.9)',
          padding: '20px',
          borderRadius: '10px',
          color: '#fff',
          textAlign: 'center',
          fontFamily: 'monospace'
        }}>
          <div style={{ fontSize: '18px', marginBottom: '10px' }}>⚠️ Graphics context lost</div>
          <div style={{ fontSize: '14px', opacity: 0.8 }}>Recovering...</div>
        </div>
      )} */}
      
      <div 
        ref={canvasRef} 
        style={{ 
          width: '100%', 
          height: '100%', 
          position: 'relative'
        }}
      >
      {mounted && (
      <Canvas
        camera={{ position: [0, isMobile ? 0 : 0, isMobile ? 2 : 0], fov: isMobile ? 75 : 70 }}
        dpr={isMobile ? 1 : (typeof window !== 'undefined' ? window.devicePixelRatio : 1)}
        gl={{ 
          alpha: true,  // Enable alpha for proper transparency
          antialias: !isMobile,  // Disable antialiasing on mobile
          powerPreference: isMobile ? "low-power" : "high-performance",
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false,
          stencil: false,  // Disable stencil buffer if not needed
          depth: true,
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
        onCreated={({ gl, scene }) => {
          // Store references for cleanup
          canvasRef.current.gl = gl
          canvasRef.current.scene = scene
          
          // Handle context loss
          const canvas = gl.domElement
          canvas.addEventListener('webglcontextlost', (e) => {
            e.preventDefault()
            console.log('WebGL context lost, attempting recovery...')
            setContextLost(true)
          })
          
          canvas.addEventListener('webglcontextrestored', () => {
            console.log('WebGL context restored')
            setContextLost(false)
          })
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
            {/* Candles surrounding the camera/viewer with exclusion zone around hands */}
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
            
            {/* Hands model in front */}
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
                  hasActiveClick={clickedCandleId !== null}
                  is80sMode={is80sMode}
                  onLoad={() => console.log('Hands loaded')}
                />
              </group>
            </Suspense>
          </group>
        </SceneRotator>
        
        {/* Only show Stats in development */}
        <Stats className="stats-monitor" />
        
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
  onBloomPulse={setBloomIntensity}  // Pass the state setter
  onCandlePulse={handleCandlePulse}  // Trigger pulse in candle cloud
/>
        
     
<EffectComposer>
<Bloom 
    intensity={bloomIntensity}
    luminanceThreshold={0.1}  // Lower this (was 0.2) - original uses 0.1
    luminanceSmoothing={0.9}
    mipmapBlur
    radius={0.8}
  />
</EffectComposer>
      </Canvas>
      )}
      </div>
      
      {/* TEST CONTROLS - Remove when done testing */}
      {/* {showTestControls && (
        <div style={{
          position: 'fixed',  // Use fixed positioning to ensure it's above everything
          top: '20px',
          left: '300px',
          background: 'rgba(0, 0, 0, 0.95)',
          border: '2px solid #ff00ff',
          borderRadius: '8px',
          padding: '15px',
          color: '#fff',
          fontFamily: 'monospace',
          fontSize: '12px',
          zIndex: 10000,
          width: '300px',
          backdropFilter: 'blur(10px)',
          pointerEvents: 'auto'
        }}>
          <div style={{ 
            marginBottom: '10px', 
            fontWeight: 'bold',
            color: '#ff00ff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>🧪 TEST CONTROLS</span>
            <button
              onClick={() => setShowTestControls(false)}
              style={{
                background: 'transparent',
                border: '1px solid #ff00ff',
                color: '#ff00ff',
                padding: '2px 8px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              HIDE
            </button>
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', color: '#aaa' }}>
              Price Movement: {testPriceOverride !== null ? `${(testPriceOverride * 5).toFixed(2)}%` : 'Auto'}
            </label>
            <input
              type="range"
              min="-20"
              max="20"
              step="0.1"
              value={testPriceOverride !== null ? testPriceOverride : 0}
              onChange={(e) => setTestPriceOverride(parseFloat(e.target.value))}
              style={{
                width: '100%',
                marginBottom: '5px'
              }}
            />
            <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
              <button
                onClick={() => setTestPriceOverride(-20)}
                style={{
                  flex: 1,
                  background: '#ff4444',
                  border: 'none',
                  color: '#fff',
                  padding: '4px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
              >
                -100%
              </button>
              <button
                onClick={() => setTestPriceOverride(-10)}
                style={{
                  flex: 1,
                  background: '#ff6666',
                  border: 'none',
                  color: '#fff',
                  padding: '4px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
              >
                -50%
              </button>
              <button
                onClick={() => setTestPriceOverride(0)}
                style={{
                  flex: 1,
                  background: '#666',
                  border: 'none',
                  color: '#fff',
                  padding: '4px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
              >
                0%
              </button>
              <button
                onClick={() => setTestPriceOverride(10)}
                style={{
                  flex: 1,
                  background: '#66ff66',
                  border: 'none',
                  color: '#000',
                  padding: '4px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
              >
                +50%
              </button>
              <button
                onClick={() => setTestPriceOverride(20)}
                style={{
                  flex: 1,
                  background: '#00ff00',
                  border: 'none',
                  color: '#000',
                  padding: '4px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '10px'
                }}
              >
                +100%
              </button>
            </div>
          </div>
          
          <div style={{ 
            display: 'flex', 
            gap: '10px',
            borderTop: '1px solid #333',
            paddingTop: '10px',
            marginTop: '10px'
          }}>
            <button
              onClick={() => setTestPriceOverride(null)}
              style={{
                flex: 1,
                background: testPriceOverride === null ? '#ff00ff' : '#333',
                border: '1px solid #ff00ff',
                color: '#fff',
                padding: '6px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 'bold'
              }}
            >
              AUTO MODE
            </button>
            <button
              onClick={() => {
                // Random price between -20 and 20
                const random = (Math.random() - 0.5) * 40
                setTestPriceOverride(random)
              }}
              style={{
                flex: 1,
                background: '#666',
                border: '1px solid #999',
                color: '#fff',
                padding: '6px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 'bold'
              }}
            >
              RANDOM
            </button>
          </div>
          
          <div style={{ 
            marginTop: '10px',
            fontSize: '10px',
            color: '#666',
            textAlign: 'center'
          }}>
            Controls candle movement & colors
          </div>
        </div>
      )} */}
      
      {/* Show test controls button when hidden */}
      {/* {!showTestControls && (
        <button
          onClick={() => setShowTestControls(true)}
          style={{
            position: 'fixed',  // Use fixed to ensure it's clickable
            top: '20px',
            left: '300px',
            background: 'rgba(0, 0, 0, 0.9)',
            border: '1px solid #ff00ff',
            color: '#ff00ff',
            padding: '8px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '10px',
            fontFamily: 'monospace',
            zIndex: 10000,
            backdropFilter: 'blur(10px)',
          }}
        >
          🧪 SHOW TEST CONTROLS
        </button>
      )} */}
      
      {/* Unified Stats Box */}
      <div style={unifiedStatsStyle}>
        <div style={{ 
          fontSize: isMobile ? '16px' : '24px', 
          fontWeight: 'bold',
          color: displayPrice.change >= 0 ? '#00ff66' : '#ff4444',
          marginBottom: isMobile ? '4px' : '8px'
        }}>
          ${displayPrice.tokenPrice.toFixed(7)}
        </div>
        <div style={{
          fontSize: isMobile ? '12px' : '16px',
          color: displayPrice.change >= 0 ? '#00ff66' : '#ff4444',
          marginBottom: isMobile ? '8px' : '12px',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '4px' : '6px'
        }}>
          <span>{displayPrice.change >= 0 ? '▲' : '▼'}</span>
          <span>{displayPrice.change.toFixed(2)}%</span>
        </div>
        
        {/* Volume and Market Cap */}
        <div style={{ 
          fontSize: isMobile ? '10px' : '12px', 
          color: '#999', 
          marginBottom: isMobile ? '8px' : '10px',
          paddingBottom: isMobile ? '8px' : '10px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ marginBottom: '3px' }}>
            Vol 24h: ${isMobile ? (volume24h / 1000000).toFixed(1) + 'M' : volume24h.toLocaleString()}
          </div>
          <div>
            MCap: ${isMobile ? (marketCap / 1000000).toFixed(1) + 'M' : marketCap.toLocaleString()}
          </div>
        </div>
        
        {/* Mini chart - desktop only */}
        {!isMobile && (
          <div style={{
            marginBottom: '12px',
            height: '40px',
            display: 'flex',
            alignItems: 'flex-end',
            gap: '1px'
          }}>
            {priceChartBars}
          </div>
        )}
        
        {/* Candles and Burned Stats */}
        <div style={{ 
          fontSize: isMobile ? '10px' : '12px', 
          color: '#888'
        }}>
          <div style={{ marginBottom: '4px' }}>
            🕯️ {(500 + additionalCandles.length).toLocaleString()} candles
          </div>
          <div>
            🔥 0 tokens burned
          </div>
        </div>
      </div>
      
    </div>
  )
})

export default UnifiedShrine