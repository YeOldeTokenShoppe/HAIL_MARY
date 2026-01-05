'use client'
import React, { useRef, useState, useEffect, Suspense, useCallback, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Stats } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { HandsModel } from './HandsGLTFScene'
// IMPORTANT: Import from the optimized version!
import { CandleCloud, GradientBackground, SceneSetup } from './CandleShrine'
import { NewCandleEffectManager } from './NewCandleEffect'
import Matchstick from './Matchstick'
import SkewedHeading from './SkewedHeading'

// Optimized PriceSimulator - uses refs instead of state for animation
// Only updates React state at throttled intervals for UI
function OptimizedPriceSimulator({ priceRef, onUIUpdate }) {
  const lastUIUpdate = useRef(0)
  const lastPriceUpdate = useRef(0)
  const currentPrice = useRef(0)
  const targetPrice = useRef(0)
  const UI_UPDATE_INTERVAL = 1000 // Update UI once per second
  const PRICE_CHANGE_INTERVAL = 5000 // Change price every 5 seconds (in production would be 60000 for 1 minute)
  
  useFrame((state) => {
    const now = state.clock.elapsedTime * 1000
    
    // Generate new price target every PRICE_CHANGE_INTERVAL
    if (now - lastPriceUpdate.current > PRICE_CHANGE_INTERVAL) {
      lastPriceUpdate.current = now
      
      // Simulate realistic price movement
      const changePercent = (Math.random() - 0.5) * 0.1 // -5% to +5% change
      targetPrice.current = currentPrice.current + changePercent
      
      // Add occasional larger movements
      if (Math.random() < 0.1) {
        targetPrice.current += (Math.random() - 0.5) * 0.3 // Occasional -15% to +15% spike
      }
    }
    
    // Smoothly interpolate to target price
    currentPrice.current += (targetPrice.current - currentPrice.current) * 0.02
    
    // Update ref immediately (no re-render, used by shaders)
    priceRef.current = currentPrice.current
    
    // Throttle UI updates to prevent excessive re-renders
    if (now - lastUIUpdate.current > UI_UPDATE_INTERVAL) {
      lastUIUpdate.current = now
      onUIUpdate(currentPrice.current)
    }
  })
  
  return null
}





// Memoized gradient that reads from ref
const MemoizedGradientBackground = React.memo(function MemoizedGradientBackground({ priceRef, is80sMode }) {
  const meshRef = useRef()
  const { viewport } = useThree()
  
  const colorsRef = useRef({
    bottom: new THREE.Color('#1a1a2e'),
    top: new THREE.Color('#4a4a6a'),
  })
  
  useFrame(() => {
    if (!meshRef.current) return
    
    const priceDirection = priceRef.current
    
    let targetBottom, targetTop
    if (priceDirection > 0.02) {
      targetBottom = new THREE.Color('#0a2d1a')
      targetTop = new THREE.Color('#22ff66')
    } else if (priceDirection < -0.02) {
      targetBottom = new THREE.Color('#2d0a0a')
      targetTop = new THREE.Color('#ff4444')
    } else {
      targetBottom = new THREE.Color('#1a1a2e')
      targetTop = new THREE.Color('#4a4a6a')
    }
    
    colorsRef.current.bottom.lerp(targetBottom, 0.02)
    colorsRef.current.top.lerp(targetTop, 0.02)
    
    meshRef.current.material.uniforms.uColorBottom.value = colorsRef.current.bottom
    meshRef.current.material.uniforms.uColorTop.value = colorsRef.current.top
  })
  
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uColorBottom: { value: new THREE.Color('#1a1a2e') },
      uColorTop: { value: new THREE.Color('#4a4a6a') },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColorBottom;
      uniform vec3 uColorTop;
      varying vec2 vUv;
      
      void main() {
        float mixFactor = smoothstep(0.0, 1.0, vUv.y);
        vec3 color = mix(uColorBottom, uColorTop, mixFactor);
        vec2 center = vUv - 0.5;
        float vignette = 1.0 - dot(center, center) * 0.5;
        color *= vignette;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    depthWrite: false,
  }), [])
  
  if (is80sMode) return null
  
  return (
    <mesh ref={meshRef} position={[0, 0, -20]} material={material}>
      <planeGeometry args={[viewport.width * 4, viewport.height * 4]} />
    </mesh>
  )
})

// Main component
export default function UnifiedShrine({ 
  offerings = [], 
  onSelectOffering, 
  onLightCandle, 
  onPriceChange, 
  is80sMode,
  hoveredOffering,
  justLitOffering,
  onJustLitComplete 
}) {
  // Use ref for real-time price (no re-renders)
  const priceRef = useRef(0)
  
  // State only for UI display (throttled updates)
  const [displayPrice, setDisplayPrice] = useState({
    direction: 0,
    change: 0,
    tokenPrice: 0.000420,
  })
  
  const [additionalCandles, setAdditionalCandles] = useState([])
  const [clickedCandleId, setClickedCandleId] = useState(null)
  const effectManagerRef = useRef()
  const [userRotation, setUserRotation] = useState(0)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, rotation: 0 })
  const [isMobile, setIsMobile] = useState(false)
  const [hasReachedSection, setHasReachedSection] = useState(true)
  const [isInView, setIsInView] = useState(true)
  const canvasRef = useRef()
  const [contextLost, setContextLost] = useState(false)
  const [matchstickClicked, setMatchstickClicked] = useState(false)
  
  // Price history - update much less frequently
  const [priceHistory, setPriceHistory] = useState(() =>
    Array(20).fill(0).map(() => 0.00042 + Math.random() * 0.00001 - 0.000005)
  )
  const lastHistoryUpdate = useRef(0)
  const HISTORY_UPDATE_INTERVAL = 500 // Update chart every 500ms
  
  // Static values that don't need to update
  const volume24h = 1234567
  const marketCap = 42069000

  // Store timeout refs for cleanup
  const timeoutRefs = useRef({})

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth <= 768)
      }
    }
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

  // Throttled UI update handler
  const handleUIUpdate = useCallback((price) => {
    const changePercent = price * 5
    const newTokenPrice = 0.000420 * (1 + changePercent / 100)
    
    setDisplayPrice({
      direction: price,
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
  }, [onPriceChange])

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

  const handlePointerDown = useCallback((event) => {
    event.stopPropagation()
    isDragging.current = true
    dragStart.current = {
      x: event.clientX || event.nativeEvent?.clientX || 0,
      rotation: userRotation
    }
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.cursor = 'grabbing'
    }
  }, [userRotation])

  const handlePointerMove = useCallback((event) => {
    if (isDragging.current) {
      const clientX = event.clientX || event.nativeEvent?.clientX || 0
      const deltaX = (clientX - dragStart.current.x) * 0.01
      setUserRotation(dragStart.current.rotation + deltaX)
    }
  }, [])

  const handlePointerUp = useCallback(() => {
    isDragging.current = false
    if (typeof document !== 'undefined' && document.body) {
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
  
  // Memoize styles
  const unifiedStatsStyle = useMemo(() => ({
    position: 'absolute',
    top: isMobile ? '100px' : '105px',
    right: isMobile ? '10px' : '20px',
    background: 'rgba(0, 0, 0, 0.8)',
    border: `2px solid ${displayPrice.change >= 0 ? '#00ff66' : '#ff4444'}`,
    borderRadius: '12px',
    padding: isMobile ? '10px 12px' : '18px',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: isMobile ? '11px' : '14px',
    backdropFilter: 'blur(10px)',
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
  
  const handleLightCandleClick = useCallback(() => {
    setMatchstickClicked(true)
    const messages = [
      'Please pump my bags to the moon 🚀',
      'Grant me diamond hands in these trying times',
      'May the green candles be ever in my favor',
      'Bless this dip for I shall slurp',
      'Forgive me for selling the bottom',
      'Thank you for this glorious pump',
      'Guide me through the bear market darkness'
    ]
    const names = ['anon_trader', 'crypto_believer', 'hodl_warrior', 'defi_degen', 'moon_boy', 'whale_watcher']
    const types = ['petition', 'confession', 'appreciation']
    
    const newOffering = {
      name: names[Math.floor(Math.random() * names.length)],
      type: types[Math.floor(Math.random() * types.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
      tokensBurned: Math.floor(Math.random() * 10000) + 500,
      timestamp: 'just now'
    }
    
    if (onLightCandle) {
      onLightCandle(newOffering)
    }
    
    if (effectManagerRef.current?.triggerEffect) {
      effectManagerRef.current.triggerEffect(newOffering)
    }
  }, [onLightCandle])

  return (
    <div style={{ width: '100%', height: isMobile ? '120vh' : '100vh', background: '#000', position: 'relative' }}>
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
      
      <div ref={canvasRef} style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [0, isMobile ? -1 : -0.5, isMobile ? 11 : 9], fov: isMobile ? 55 : 50 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        dpr={isMobile ? 1 : (typeof window !== 'undefined' ? window.devicePixelRatio : 1)}
        gl={{ 
          alpha: true, 
          antialias: true,
          powerPreference: "high-performance",
          preserveDrawingBuffer: false,
          failIfMajorPerformanceCaveat: false,
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 2,
          background: 'transparent',
        }}
        onCreated={({ gl, scene }) => {
          // Enable context recovery
          const ext = gl.getContext().getExtension('WEBGL_lose_context')
          
          // Store references for cleanup
          canvasRef.current.gl = gl
          canvasRef.current.scene = scene
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
        <MemoizedGradientBackground priceRef={priceRef} is80sMode={is80sMode} />
        
        {/* Candles - pushed back, reads from ref for smooth animation */}
        <group position={[0, 2, -8]}>
          <CandleCloud
            count={isMobile ? 150 : 500}
            priceRef={priceRef}
            additionalCandles={additionalCandles}
            onCandleClick={handleCandleClick}
            clickedCandleId={clickedCandleId}
            isMobile={isMobile}
          />
        </group>
        
        {/* Only show Stats in development */}
        <Stats className="stats-monitor" />
        
        {/* Hands model */}
        <Suspense fallback={null}>
          <group scale={1.8} position={[0, -1, 0]}>
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
        
        {/* Optimized price simulator - updates ref every frame, state throttled */}
        <OptimizedPriceSimulator 
          priceRef={priceRef} 
          onUIUpdate={handleUIUpdate} 
        />
        
        {/* Candle effect manager */}
        <NewCandleEffectManager
          ref={effectManagerRef}
          phonePosition={[0, -3, 5]}
          cloudBounds={{ x: 20, y: 10, z: 10 }}
          onNewCandle={handleNewCandle}
          candleModelPath="/models/tinyVotiveOnly.glb"
        />
        
        {/* Post-processing - skip on mobile */}
        {!isMobile && (
          <EffectComposer>
            <Bloom 
              intensity={1.0}
              luminanceThreshold={0.2}
              luminanceSmoothing={0.9}
              mipmapBlur
              radius={0.8}
            />
          </EffectComposer>
        )}
      </Canvas>
      </div>
      
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
      
      {/* Light a Candle Button */}
      <div style={{
        position: 'absolute',
        bottom: isMobile ? '20px' : '80px',
        left: isMobile ? '45%' : '20px',
        transform: isMobile ? 'translateX(-50%)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 2000,
      }}>
        <div style={{
          marginBottom: isMobile ? '8px' : '12px',
          textAlign: 'center',
        }}>
          <SkewedHeading 
            lines={["Get on Her", "Watchlist"]}
            colors={["#00ff00"]}
            fontSize={{ mobile: "2.1rem", desktop: "3rem" }}
            isMobile={isMobile}
          />
        </div>
        <style jsx>{`
          @keyframes glow-pulse {
            0%, 100% { 
              box-shadow: 0 0 20px rgba(255, 94, 0, 0.3),
                          0 0 40px rgba(255, 94, 0, 0.2),
                          inset 0 0 20px rgba(255, 94, 0, 0.1);
            }
            50% { 
              box-shadow: 0 0 30px rgba(255, 94, 0, 0.5),
                          0 0 60px rgba(255, 94, 0, 0.3),
                          inset 0 0 30px rgba(255, 94, 0, 0.2);
            }
          }
          
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          
          .matchstick-container {
            animation: glow-pulse 2s ease-in-out infinite;
          }
          
          
          @keyframes arrow-bounce {
            0%, 100% { transform: translateX(0); }
            50% { transform: translateX(10px); }
          }
          
          .arrow-indicator {
            animation: arrow-bounce 1.5s ease-in-out infinite;
          }
        `}</style>
        <div className="matchstick-container" style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: isMobile ? '0' : '0.5rem',
          padding: isMobile ? '0.2rem' : '1rem',
          background: 'radial-gradient(ellipse at center, rgba(255, 94, 0, 0.15) 0%, transparent 60%)',
          borderRadius: '50%',
          border: 'px solid rgba(255, 94, 0, 0.4)',
          backdropFilter: 'blur(18px)',
          position: 'relative',
          maxWidth: isMobile ? '100px' : '250px',
          maxHeight: isMobile ? '100px' : 'none',
          overflow: 'hidden',
        }}>
          {!isMobile && (
            <div className="cta-text" style={{
              color: '#ffcc00',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              textShadow: '0 0 10px rgba(255, 94, 0, 0.5)',
              marginBottom: '1rem',
              marginTop: '2rem'
            }}>
              Light Me
            </div>
          )}
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
          }}>
            {isMobile && !matchstickClicked && (
              <div style={{
                position: 'absolute',
                left: '18%',
                top: '15%',
                transform: 'translateY(-50%)',
                color: '#ff5e00',
                fontSize: '0.6rem',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                letterSpacing: '0.1px',
                textShadow: '0 0 4px rgba(255, 204, 0, 0.9)',
                zIndex: 10,
              }}>
                Click to Light
              </div>
            )}
            <Matchstick onLight={handleLightCandleClick} />
          </div>
          {/* {!isMobile && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '0.85rem',
              marginTop: '-0.5rem',
            }}>
              <span className="arrow-indicator" style={{
                fontSize: '1.2rem',
                color: '#ff5e00',
              }}>→</span>
              <span>Click to offer</span>
              <span className="arrow-indicator" style={{
                fontSize: '1.2rem',
                color: '#ff5e00',
                transform: 'scaleX(-1)',
              }}>→</span>
            </div>
          )} */}
        </div>
      </div>
    </div>
  )
}