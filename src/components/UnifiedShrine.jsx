'use client'
import React, { useRef, useState, useEffect, Suspense, useCallback, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { HandsModel } from './HandsGLTFScene'
import { CandleCloud, GradientBackground, PriceSimulator, SceneSetup } from './CandleShrine'
import { NewCandleEffectManager } from './NewCandleEffect'
import CyberGlitchButton from './carousel/CyberGlitchButton'
// PhoneLightRays now rendered inside HandsGLTFScene attached to phoneCase

// Unified scene combining candles and hands in one Canvas
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
  const [priceDirection, setPriceDirection] = useState(0)
  const [additionalCandles, setAdditionalCandles] = useState([])
  const [clickedCandleId, setClickedCandleId] = useState(null)
  const effectManagerRef = useRef()
  const newCandleTriggerRef = useRef()
  const [userRotation, setUserRotation] = useState(0)
  const isDragging = useRef(false)
  const dragStart = useRef({ x: 0, rotation: 0 })
  const [isMobile, setIsMobile] = useState(false)
  const [hasReachedSection, setHasReachedSection] = useState(true)
  const [isInView, setIsInView] = useState(true)
  
  // Price tracking states
  const [tokenPrice, setTokenPrice] = useState(0.000420)
  const [priceChange, setPriceChange] = useState(0)
  const [volume24h, setVolume24h] = useState(1234567)
  const [marketCap, setMarketCap] = useState(42069000)
  const [priceHistory, setPriceHistory] = useState(
    Array(20).fill(0).map((_, i) => 0.00042 + Math.random() * 0.00001 - 0.000005)
  )

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
      return () => window.removeEventListener('resize', checkMobile)
    }
  }, [])

  const handleCandleClick = useCallback((instanceId, position) => {
    console.log('Candle clicked in unified scene:', instanceId, position)
    
    // Set the clicked candle ID for visual feedback
    setClickedCandleId(instanceId)
    
    // Clear the glow after 2 seconds
    setTimeout(() => {
      setClickedCandleId(null)
    }, 2000)
    
    // Select a random offering to display on phone screen
    if (offerings && offerings.length > 0) {
      const randomIndex = Math.floor(Math.random() * offerings.length)
      const selectedOffering = offerings[randomIndex]
      console.log('Selected offering:', selectedOffering)
      if (onSelectOffering) {
        onSelectOffering(selectedOffering)
      }
    }
  }, [offerings, onSelectOffering])

  const handleNewCandle = (position, offering) => {
    console.log('New candle added at:', position)
    setAdditionalCandles(prev => [...prev, {
      position,
      offering,
      id: Date.now(),
      rotation: Math.random() * Math.PI * 2
    }])
    
    if (onLightCandle) {
      onLightCandle(offering)
    }
  }

  const handlePointerDown = useCallback((event) => {
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
      const newRotation = dragStart.current.rotation + deltaX
      setUserRotation(newRotation)
    }
  }, [])

  const handlePointerUp = useCallback(() => {
    isDragging.current = false
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.cursor = 'auto'
    }
  }, [])

  const handleLightCandleClick = () => {
    // Create a new offering with randomized data
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
    
    console.log('🕯️ New candle lit:', newOffering)
    
    // Call the callback to show on phone screen
    if (onLightCandle) {
      onLightCandle(newOffering)
    }
    
    // Trigger new candle animation
    if (effectManagerRef.current?.triggerEffect) {
      effectManagerRef.current.triggerEffect(newOffering)
    }
  }

  return (
    <div style={{ width: '100%', height: '100vh', background: '#000', position: 'relative' }}>
      {/* Retro image background for 80s mode */}
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
      >
        <SceneSetup is80sMode={is80sMode} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <pointLight position={[10, 10, 10]} intensity={0.5} />
        <pointLight position={[-10, -10, -10]} intensity={1} />
        
        {/* Background gradient */}
        <GradientBackground priceDirection={priceDirection} is80sMode={is80sMode} />
        
        {/* Candles in the background - pushed further back */}
        <group position={[0, 2, -8]}>
          <CandleCloud 
            count={500} 
            priceDirection={priceDirection} 
            additionalCandles={additionalCandles} 
            onCandleClick={handleCandleClick} 
            clickedCandleId={clickedCandleId} 
          />
        </group>
        
        {/* Hands in the foreground - scaled up for better visibility */}
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
              priceChange={priceDirection * 5}
              hasActiveClick={clickedCandleId !== null}
              is80sMode={is80sMode}
              onLoad={() => console.log('Hands loaded in unified scene')}
            />
          </group>
        </Suspense>
        
        {/* Light rays are now attached to phoneCase inside HandsModel */}
        
        {/* Price simulator */}
        <PriceSimulator onPriceChange={(price) => {
          setPriceDirection(price)
          const changePercent = price * 5
          setPriceChange(changePercent)
          
          // Update token price based on change
          const newPrice = 0.000420 * (1 + changePercent / 100)
          setTokenPrice(newPrice)
          
          // Update price history
          setPriceHistory(prev => [...prev.slice(1), newPrice])
          
          if (onPriceChange) {
            onPriceChange(changePercent)
          }
        }} />
        
        {/* Candle effect manager */}
        <NewCandleEffectManager
          ref={effectManagerRef}
          phonePosition={[0, -3, 5]}
          cloudBounds={{ x: 20, y: 10, z: 10 }}
          onNewCandle={handleNewCandle}
          candleModelPath="/models/tinyVotiveOnly.glb"
        />
        
        {/* Post-processing effects */}
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
      
      {/* Price Ticker */}
      <div style={{
        position: 'absolute',
        top: isMobile ? '150px' : '195px',
        right: isMobile ? '10px' : '20px',
        background: 'rgba(0, 0, 0, 0.8)',
        border: `2px solid ${priceChange >= 0 ? '#00ff66' : '#ff4444'}`,
        borderRadius: '12px',
        padding: isMobile ? '12px' : '16px',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: isMobile ? '12px' : '14px',
        backdropFilter: 'blur(10px)',
        boxShadow: `0 0 20px ${priceChange >= 0 ? 'rgba(0, 255, 100, 0.3)' : 'rgba(255, 68, 68, 0.3)'}`,
        zIndex: 1000,
        width: isMobile ? '160px' : '240px'
      }}>
        <div style={{ 
          fontSize: isMobile ? '18px' : '24px', 
          fontWeight: 'bold',
          color: priceChange >= 0 ? '#00ff66' : '#ff4444',
          marginBottom: isMobile ? '4px' : '8px'
        }}>
          ${tokenPrice.toFixed(6)}
        </div>
        <div style={{
          fontSize: isMobile ? '14px' : '18px',
          color: priceChange >= 0 ? '#00ff66' : '#ff4444',
          marginBottom: isMobile ? '8px' : '12px',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '4px' : '8px'
        }}>
          <span>{priceChange >= 0 ? '▲' : '▼'}</span>
          <span>{Math.abs(priceChange).toFixed(2)}%</span>
        </div>
        <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#888', marginBottom: '4px' }}>
          Vol 24h: ${isMobile ? (volume24h / 1000000).toFixed(1) + 'M' : volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
        <div style={{ fontSize: isMobile ? '10px' : '12px', color: '#888' }}>
          MCap: ${isMobile ? (marketCap / 1000000).toFixed(1) + 'M' : marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
        
        {/* Mini chart */}
        <div style={{
          marginTop: isMobile ? '8px' : '12px',
          height: isMobile ? '30px' : '40px',
          display: isMobile ? 'none' : 'flex',  // Hide chart on mobile to save space
          alignItems: 'flex-end',
          gap: '1px'
        }}>
          {priceHistory.slice(-20).map((price, i) => {
            const min = Math.min(...priceHistory.slice(-20))
            const max = Math.max(...priceHistory.slice(-20))
            const range = max - min || 1
            const height = ((price - min) / range) * 35 + 5
            return (
              <div
                key={i}
                style={{
                  width: '8px',
                  height: `${height}px`,
                  background: i === 19 ? (priceChange >= 0 ? '#00ff66' : '#ff4444') : '#444',
                  borderRadius: '2px'
                }}
              />
            )
          })}
        </div>
      </div>
      
      {/* Stats overlay (below price ticker on right) */}
      <div style={{
        position: 'absolute',
        top: isMobile ? '250px' : '380px',  // Adjust position for mobile
        right: isMobile ? '10px' : '20px',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: isMobile ? '10px' : '12px',
        background: 'rgba(0, 0, 0, 0.8)',
        border: `2px solid ${priceChange >= 0 ? '#00ff66' : '#ff4444'}`,
        padding: isMobile ? '12px' : '16px',
        borderRadius: '12px',
        backdropFilter: 'blur(10px)',
        boxShadow: `0 0 20px ${priceChange >= 0 ? 'rgba(0, 255, 100, 0.3)' : 'rgba(255, 68, 68, 0.3)'}`,
        width: isMobile ? '160px' : '240px',
        zIndex: 999,  // Ensure proper layering
      }}>
        <div style={{ 
          color: priceChange >= 0 ? '#00ff66' : '#ff4444',
          fontSize: isMobile ? '16px' : '24px',
          fontWeight: 'bold',
          marginBottom: isMobile ? '4px' : '8px'
        }}>
          {priceChange >= 0 ? '↑' : '↓'} {priceChange.toFixed(2)}%
        </div>
        <div style={{ color: '#888', fontSize: isMobile ? '10px' : '12px' }}>
          🕯️ {(500 + additionalCandles.length).toLocaleString()} candles
        </div>
      </div>
      
      {/* Light a Candle Button with Cyber Glitch Style */}
      <div style={{
        position: 'absolute',
        bottom: isMobile ? '20px' : '80px',
        right: isMobile ? '50%' : '20px',
        transform: isMobile ? 'translateX(50%)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 2000,  // Ensure button is above everything else
      }}>
        <div style={{
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: isMobile ? '1.5rem' : '2.5rem',
          fontFamily: "'UnifrakturMaguntia', serif",
          letterSpacing: '1px',
          marginBottom: isMobile ? '8px' : '12px',
          textAlign: 'center',
          textShadow: '0 0 2rem rgba(147, 69, 255, 0.9), 0 8px 16px rgba(0, 0, 0, 0.9)',
        }}>
          Get on Her {!isMobile && <br/>}Watchlist
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
            top: 3px !important;  /* Move down slightly */
            right: 15% !important;  /* Move left to keep it on the button */
          }
        `}</style>
        <div className="cyber-candle-btn">
          <CyberGlitchButton
            text="GET LIT"
            onClick={handleLightCandleClick}
            label="RL80"
            mobile={isMobile}
          />
        </div>
      </div>
    </div>
  )
}