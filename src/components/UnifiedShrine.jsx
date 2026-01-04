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
import CyberGlitchButton from './carousel/CyberGlitchButton'
import SkewedHeading from './SkewedHeading'

// Optimized PriceSimulator - uses refs instead of state for animation
// Only updates React state at throttled intervals for UI
function OptimizedPriceSimulator({ priceRef, onUIUpdate }) {
  const lastUIUpdate = useRef(0)
  const UI_UPDATE_INTERVAL = 100 // Update UI 10 times per second, not 60
  
  useFrame((state) => {
    const t = state.clock.elapsedTime
    
    // Calculate price (runs every frame for smooth animation)
    const baseWave = Math.sin(t * 0.15) * 0.5
    const trend = Math.sin(t * 0.08) * 0.3
    const gentleVolatility = Math.sin(t * 1.0) * 0.15
    const crashCycle = Math.sin(t * 0.1) < -0.8 ? -0.6 : 0
    const pumpCycle = Math.sin(t * 0.15 + 2) > 0.8 ? 0.5 : 0
    
    const price = baseWave + trend + gentleVolatility + crashCycle + pumpCycle
    
    // Update ref immediately (no re-render, used by shaders)
    priceRef.current = price
    
    // Throttle UI updates to prevent excessive re-renders
    const now = state.clock.elapsedTime * 1000
    if (now - lastUIUpdate.current > UI_UPDATE_INTERVAL) {
      lastUIUpdate.current = now
      onUIUpdate(price)
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
    if (priceDirection > 0.3) {
      targetBottom = new THREE.Color('#0a2d1a')
      targetTop = new THREE.Color('#22ff66')
    } else if (priceDirection < -0.3) {
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
        setIsMobile(window.innerWidth < 768)
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Object.values(timeoutRefs.current).forEach(clearTimeout)
      timeoutRefs.current = {}
      if (typeof document !== 'undefined' && document.body) {
        document.body.style.cursor = 'auto'
      }
      isDragging.current = false
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
    <div style={{ width: '100%', height: '100vh', background: '#000', position: 'relative' }}>
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
      
      <Canvas
        camera={{ position: [0, -0.5, 9], fov: 50 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
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
        // Limit frame rate if needed - uncomment for testing
        // frameloop="demand"
      >
        <SceneSetup is80sMode={is80sMode} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <pointLight position={[-10, -10, -10]} intensity={1} />
        
        {/* Background gradient - reads from ref */}
        <MemoizedGradientBackground priceRef={priceRef} is80sMode={is80sMode} />
        
        {/* Candles - pushed back, reads from ref for smooth animation */}
        <group position={[0, 2, -8]}>
          <CandleCloud
            count={500}
            priceRef={priceRef}
            additionalCandles={additionalCandles}
            onCandleClick={handleCandleClick}
            clickedCandleId={clickedCandleId}
          />
            <Stats className="stats-monitor" />
        </group>
        
        {/* Only show Stats in development */}
        {process.env.NODE_ENV === 'development' && <Stats className="stats-monitor" />}
        
        {/* Hands model */}
        <Suspense fallback={null}>
          <group scale={1.8} position={[0, -0.5, 0]}>
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
        
        {/* Mini chart */}
        <div style={{
          marginBottom: isMobile ? '8px' : '12px',
          height: '40px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: '1px'
        }}>
          {priceChartBars}
        </div>
        
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
        right: isMobile ? '50%' : '20px',
        transform: isMobile ? 'translateX(50%)' : 'none',
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
          .cyber-candle-btn :global(.cybr-btn) {
            --primary: #9945ff;
            --shadow-primary: #00ffff;
            --shadow-secondary-hue: 340;
            --color: white;
          }
          .cyber-candle-btn :global(.cybr-btn:hover) {
            --primary: #7c37d0;
            --shadow-primary: #00ffff;
          }
          .cyber-candle-btn :global(.cybr-btn:active) {
            --primary: #00ffff;
            --shadow-primary: #ff0066;
          }
          .cyber-candle-btn :global(.cybr-btn__glitch) {
            background: linear-gradient(45deg, #00ffff, #9945ff);
            text-shadow: 2px 2px #ff0066, -2px -2px #00ffff;
          }
          .cyber-candle-btn :global(.cybr-label) {
            background: linear-gradient(45deg, #00ffff, #ff0066);
            color: #000;
            font-weight: 900;
            top: 3px !important;
            right: 15% !important;
          }
        `}</style>
        <div className="cyber-candle-btn">
          <CyberGlitchButton
            text="LIght"
            text2="one up"
            onClick={handleLightCandleClick}
            label="RL80"
            mobile={isMobile}
          />
        </div>
      </div>
    </div>
  )
}