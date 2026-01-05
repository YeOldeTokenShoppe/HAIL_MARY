'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import NavControlsHome from '@/components/NavControlsHome'
import CyberNav from '@/components/CyberNav'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { useMusic } from '@/components/MusicContext'
import UnifiedShrine from '@/components/UnifiedShrine'
import ThirdwebBuyModal from '@/components/ThirdwebBuyModal'
import CoinLoader from '@/components/CoinLoader'
import { useRouter } from 'next/navigation'
import ShrineLeftPanel from '@/components/ShrineLeftPanel'
import styles from '@/components/Matchstick.module.css'

// Tiny Votive Model Component

export default function ShrinePage() {
  const router = useRouter()
  const { user } = useUser()
  const unifiedShrineRef = useRef()
  const { 
    play, 
    pause, 
    isPlaying: contextIsPlaying, 
    nextTrack,
    is80sMode: context80sMode, 
    setIs80sMode: setContext80sMode
  } = useMusic()
  const [isMobileView, setIsMobileView] = useState(false)
  const [isMobileDevice, setIsMobileDevice] = useState(false)
  const [fontLoaded, setFontLoaded] = useState(false)
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [currentView, setCurrentView] = useState('shrine')
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [mobileMatchstickLit, setMobileMatchstickLit] = useState(false)
  const is80sMode = context80sMode
  
  // State for offerings data
  const [hoveredOffering, setHoveredOffering] = useState(null)
  const [justLitOffering, setJustLitOffering] = useState(null)
  const [priceChange, setPriceChange] = useState(0)
  
  // Mock offerings data
  const [mockOfferings, setMockOfferings] = useState([
    { 
      name: 'chelleville', 
      type: 'petition', 
      message: 'May my bags pump eternally', 
      tokensBurned: 1000,
      timestamp: '2m ago'
    },
    { 
      name: 'degen_mike', 
      type: 'appreciation', 
      message: 'Thanks for the 10x Our Lady 🚀', 
      tokensBurned: 5000,
      timestamp: '5m ago'
    },
    { 
      name: 'cryptopriest', 
      type: 'confession', 
      message: 'I sold the bottom... forgive me', 
      tokensBurned: 2500,
      timestamp: '12m ago'
    },
    { 
      name: 'hodlqueen', 
      type: 'petition', 
      message: 'Deliver us from paper hands', 
      tokensBurned: 10000,
      timestamp: '1h ago'
    },
    { 
      name: 'anonymous', 
      type: 'appreciation', 
      message: null, 
      tokensBurned: 500,
      timestamp: '2h ago'
    },
  ])

  // Set mounted state after hydration and handle loading
  useEffect(() => {
    setMounted(true);
    
    // Preload critical shrine assets
    const assetsToPreload = [
      '/images/retro.webp', // Background image for 80s mode
      '/images/3ACES_TATTOO.webp' // Button image
    ];
    
    // Note: The 3D model (/models/tinyVotiveOnly.glb) will be loaded by Three.js
    // and we'll rely on the Suspense fallback for that
    
    let loadedCount = 0;
    const totalAssets = assetsToPreload.length;
    
    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount >= totalAssets) {
        // Add a small delay for smooth transition
        setTimeout(() => {
          setIsLoading(false);
        }, 500);
      }
    };
    
    // Preload images
    assetsToPreload.forEach(url => {
      const img = new Image();
      img.onload = checkAllLoaded;
      img.onerror = () => {
        console.warn(`Failed to load asset: ${url}`);
        checkAllLoaded(); // Continue anyway
      };
      img.src = url;
    });
    
    // Fallback timeout in case assets take too long
    const fallbackTimer = setTimeout(() => {
      if (isLoading) {
        console.warn('Asset loading timeout - proceeding anyway');
        setIsLoading(false);
      }
    }, 10000); // 10 second max wait
    
    return () => clearTimeout(fallbackTimer);
  }, []);

  // Check if font is loaded and add fonts-loaded class
  useEffect(() => {
    const checkFont = async () => {
      try {
        await document.fonts.load("1em 'UnifrakturMaguntia'");
        setFontLoaded(true);
        // Add the fonts-loaded class to make the font visible
        document.documentElement.classList.add('fonts-loaded');
      } catch (e) {
        setTimeout(() => {
          setFontLoaded(true);
          document.documentElement.classList.add('fonts-loaded');
        }, 100);
      }
    };
    checkFont();
  }, []);

  // Check if mobile view and device
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth <= 768;
      setIsMobileView(isMobile);
      setIsMobileDevice(isMobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Listen for openBuyModal event
  useEffect(() => {
    const handleOpenBuyModal = () => {
      setShowBuyModal(true);
    };
    
    window.addEventListener('openBuyModal', handleOpenBuyModal);
    return () => window.removeEventListener('openBuyModal', handleOpenBuyModal);
  }, []);

  return (
    <>
      {/* CoinLoader */}
      <CoinLoader loading={isLoading} />
      
      <style dangerouslySetInnerHTML={{ __html: `
        @font-face {
          font-family: 'UnifrakturMaguntia';
          src: url('/fonts/UnifrakturMaguntia-Regular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        
        #text, .text__copy {
          font-family: 'UnifrakturMaguntia', serif !important;
        }
      `}} />
      
      {/* Unified Shrine Scene */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 1,
        pointerEvents: 'auto'
      }}>
        <Suspense fallback={
          <div style={{
            width: '100%',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #4a4a6a 100%)',
            color: '#ffffff',
            fontSize: '1.5rem'
          }}>
            Loading shrine...
          </div>
        }>
          <UnifiedShrine 
            ref={unifiedShrineRef}
            key="shrine-scene"
            offerings={mockOfferings}
            onSelectOffering={setHoveredOffering}
            onLightCandle={(offering) => {
              setMockOfferings(prev => [offering, ...prev])
              setJustLitOffering(offering)
              setTimeout(() => setJustLitOffering(null), 3000)
            }}
            onPriceChange={setPriceChange}
            is80sMode={is80sMode}
            hoveredOffering={hoveredOffering}
            justLitOffering={justLitOffering}
            onJustLitComplete={() => setJustLitOffering(null)}
          />
        </Suspense>
      </div>
      <ShrineLeftPanel 
        is80sMode={is80sMode}
        isMobile={isMobileView}
        onLightCandle={() => {
          // Create a new offering
          const messages = [
            'Please pump my bags to the moon 🚀',
            'Grant me diamond hands in these trying times',
            'May the green candles be ever in my favor',
          ]
          const names = ['anon_trader', 'crypto_believer', 'hodl_warrior']
          const types = ['petition', 'confession', 'appreciation']
          
          const newOffering = {
            name: names[Math.floor(Math.random() * names.length)],
            type: types[Math.floor(Math.random() * types.length)],
            message: messages[Math.floor(Math.random() * messages.length)],
            tokensBurned: Math.floor(Math.random() * 10000) + 500,
            timestamp: 'just now'
          }
          
          // Add offering to the list
          setMockOfferings(prev => [newOffering, ...prev])
          setJustLitOffering(newOffering)
          setTimeout(() => setJustLitOffering(null), 3000)
          
          // Trigger the candle launch animation
          if (unifiedShrineRef.current) {
            unifiedShrineRef.current.triggerCandleEffect(newOffering)
          }
        }}
        router={router}
      />
      
      {/* Mobile CTA and Matchstick */}
      {isMobileView && (
        <>
          {/* CTA Text for Mobile - Centered */}
          <div style={{
            position: 'absolute',
            bottom: '1.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '1.2rem',
            fontWeight: 300,
            color: 'rgba(246, 245, 241, 0.95)',
            textShadow: `
              0 0 20px rgba(212, 175, 55, 0.4),
              0 0 40px rgba(212, 175, 55, 0.2),
              2px 2px 4px rgba(0, 0, 0, 0.6)
            `,
            letterSpacing: '0.08em',
            textAlign: 'center',
            lineHeight: 1.4,
          }}>
            <span style={{ 
              display: 'block',
              fontWeight: 400,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
            }}>
              Get on Her Watchlist
            </span>
            <span style={{ 
              display: 'block', 
              fontSize: '0.9rem',
              opacity: 0.8,
              marginTop: '6px',
              fontWeight: 300,
              fontStyle: 'italic',
            }}>
              Light a candle for price pumps
            </span>
          </div>
          
          {/* Matchstick - Positioned at 60% left */}
          <div 
            className={styles.wrapper}
            onClick={() => {
              if (!mobileMatchstickLit) {
                // Create a new offering
                const messages = [
                  'Please pump my bags to the moon 🚀',
                  'Grant me diamond hands in these trying times',
                  'May the green candles be ever in my favor',
                ]
                const names = ['anon_trader', 'crypto_believer', 'hodl_warrior']
                const types = ['petition', 'confession', 'appreciation']
                
                const newOffering = {
                  name: names[Math.floor(Math.random() * names.length)],
                  type: types[Math.floor(Math.random() * types.length)],
                  message: messages[Math.floor(Math.random() * messages.length)],
                  tokensBurned: Math.floor(Math.random() * 10000) + 500,
                  timestamp: 'just now'
                }
                
                // Add offering to the list
                setMockOfferings(prev => [newOffering, ...prev])
                setJustLitOffering(newOffering)
                setTimeout(() => setJustLitOffering(null), 3000)
                
                // Trigger the candle launch animation
                if (unifiedShrineRef.current) {
                  unifiedShrineRef.current.triggerCandleEffect(newOffering)
                }
                
                setMobileMatchstickLit(true)
              }
              setMobileMatchstickLit(!mobileMatchstickLit)
            }}
            style={{
              position: 'absolute',
              bottom: '-7rem',
              left: '60%',
              transform: 'translateX(-50%)',
              zIndex: 100,
            }}
          >
            <div className={styles.container}>
              <input type="checkbox" className={styles.switch} checked={mobileMatchstickLit} readOnly />
              
              {/* Organic ambient glow - replaces the harsh circle */}
              <div className={styles.ambientGlow} />
              
              <div className={styles.flameContainer}>
                <div className={`${styles.flame} ${styles.red}`}></div>
                <div className={`${styles.flame} ${styles.orange}`}></div>
                <div className={`${styles.flame} ${styles.yellow}`}></div>
                <div className={`${styles.flame} ${styles.white}`}></div>
                <div className={`${styles.circle} ${styles.black}`}></div>
              </div>
              
              <div className={styles.woodWrapper}>
                <div className={styles.tip}></div>
                <div className={styles.wood}>
                  <p>b</p>
                </div>
              </div>
              
              <div className={styles.glowingArea}></div>
              <div className={styles.mainGlow}></div>
            </div>
          </div>
        </>
      )}
      
      {/* Tiny Candle Button with Glowing Arrow - Bottom Right - Desktop Only */}
      {!isMobileView && (
        <>
          {/* Bottom-Right Corner Vignette - layered for smooth blending */}
          {/* Outer soft layer */}
          <div style={{
            position: "fixed",
            bottom: "-50px",
            right: "-50px",
            width: "500px",
            height: "350px",
            zIndex: 3,
            pointerEvents: "none",
            background: `radial-gradient(
              circle at 100% 100%,
              rgba(10,10,20,0.5) 0%,
              rgba(10,10,20,0.35) 30%,
              rgba(10,10,20,0.2) 50%,
              rgba(10,10,20,0.1) 70%,
              transparent 90%
            )`,
            filter: "blur(20px)",
          }} />
          
          {/* Middle layer */}
          <div style={{
            position: "fixed",
            bottom: "-20px",
            right: "-20px",
            width: "420px",
            height: "280px",
            zIndex: 3,
            pointerEvents: "none",
            background: `radial-gradient(
              ellipse 450px 300px at 100% 100%,
              rgba(10,10,20,0.7) 0%,
              rgba(10,10,20,0.55) 25%,
              rgba(10,10,20,0.35) 45%,
              rgba(10,10,20,0.2) 65%,
              transparent 85%
            )`,
            filter: "blur(8px)",
          }} />
          
          {/* Inner focused layer */}
          <div style={{
            position: "fixed",
            bottom: 0,
            right: 0,
            width: "350px",
            height: "220px",
            zIndex: 3,
            pointerEvents: "none",
            background: `radial-gradient(
              ellipse at 100% 100%,
              rgba(10,10,20,0.9) 0%,
              rgba(10,10,20,0.7) 30%,
              rgba(10,10,20,0.4) 55%,
              transparent 80%
            )`,
            filter: "blur(2px)",
          }} />

          <div 
            className="candle-button"
            style={{
              position: "fixed",
              bottom: "30px",
              right: "30px",
              width: "80px",
              height: "80px",
              zIndex: 297,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "transform 0.3s ease, filter 0.3s ease",
            }}
            onClick={() => router.push('/trade')}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.15) rotate(-5deg)";
              e.currentTarget.style.filter = "drop-shadow(0 0 20px #ff9500)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1) rotate(0deg)";
              e.currentTarget.style.filter = "none";
            }}
          >
            <img 
              src="/images/3ACES_TATTOO.webp"
              alt="Tiny Candle Button"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          </div>
          
          {/* Glowing Arrow with Text */}
          <svg
            className="luminarium-arrow"
            style={{
              position: "fixed",
              bottom: "20px",
              right: "20px",
              width: "300px",
              height: "150px",
              zIndex: 296,
              pointerEvents: "auto",
              cursor: "pointer",
            }}
            viewBox="0 0 300 150"
            onClick={() => router.push('/trade')}
        onMouseEnter={(e) => {
          const text = e.currentTarget.querySelector('text');
          const arrow = e.currentTarget.querySelector('#arrowPath');
          const arrowHead = e.currentTarget.querySelector('.arrow-head');
          if (text) {
            text.style.fontSize = '32';
            text.style.fill = '#ffffff';
            text.style.filter = 'url(#glow) drop-shadow(0 0 10px #ffcc00)';
          }
          if (arrow) {
            arrow.style.strokeWidth = '3.5';
            arrow.style.filter = 'url(#glow) drop-shadow(0 0 15px #ff9500)';
          }
          if (arrowHead) {
            arrowHead.style.strokeWidth = '3.5';
          }
        }}
        onMouseLeave={(e) => {
          const text = e.currentTarget.querySelector('text');
          const arrow = e.currentTarget.querySelector('#arrowPath');
          const arrowHead = e.currentTarget.querySelector('.arrow-head');
          if (text) {
            text.style.fontSize = '28';
            text.style.fill = '#ffcc00';
            text.style.filter = 'url(#candleGlow)';
          }
          if (arrow) {
            arrow.style.strokeWidth = '2.5';
            arrow.style.filter = 'url(#glow)';
          }
          if (arrowHead) {
            arrowHead.style.strokeWidth = '2.5';
          }
        }}
      >
        {/* Define gradients and filters */}
        <defs>
          <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#ffcc00" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ff9500" stopOpacity="1" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="candleGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feFlood floodColor="#ff9500" floodOpacity="0.4"/>
            <feComposite in2="coloredBlur" operator="in"/>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Curved arrow path */}
        <path
          id="arrowPath"
          d="M 20 100 Q 100 40, 200 60"
          stroke="url(#arrowGradient)"
          strokeWidth="2.5"
          fill="none"
          filter="url(#glow)"
          strokeLinecap="round"
          opacity="0.9"
        >
          <animate
            attributeName="stroke-opacity"
            values="0.6;1;0.6"
            dur="2.5s"
            repeatCount="indefinite"
          />
        </path>
        
        {/* Invisible path for text (offset above the arrow) */}
        <path
          id="textPath"
          d="M 20 85 Q 100 25, 200 45"
          fill="none"
          stroke="none"
        />
        
        {/* Arrow head */}
        <path
          className="arrow-head"
          d="M 195 55 L 205 60 L 195 65"
          stroke="url(#arrowGradient)"
          strokeWidth="2.5"
          fill="none"
          filter="url(#glow)"
          strokeLinecap="round"
        >
          <animate
            attributeName="stroke-opacity"
            values="0.6;1;0.6"
            dur="2.5s"
            repeatCount="indefinite"
          />
        </path>
        
        {/* Text along path - placeholder for user to update */}
        <text
          fill="#ffcc00"
          fontSize="28"
          fontFamily="'UnifrakturMaguntia', cursive"
          filter="url(#candleGlow)"
          style={{ transition: "all 0.3s ease" }}
        >
          <textPath href="#textPath" startOffset="5%">
            Trade School
          </textPath>
          <animate
            attributeName="fill-opacity"
            values="0.7;1;0.7"
            dur="3s"
            repeatCount="indefinite"
          />
        </text>
        
        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <circle
            key={i}
            r="1.5"
            fill="#ffcc00"
            filter="url(#glow)"
          >
            <animateMotion
              dur={`${4 + i}s`}
              repeatCount="indefinite"
              path="M 20 100 Q 100 40, 200 60"
            >
              <mpath href="#arrowPath" />
            </animateMotion>
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur={`${4 + i}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values="0.5;2;0.5"
              dur={`${4 + i}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
          </svg>
        </>
      )}
      
      {/* Navigation Toggle */}
      {/* <div style={{
        position: "fixed",
        bottom: "30px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 998,
      }}>
        <Link href="/carousel" style={{ textDecoration: 'none' }}>
          <div 
            style={{
              position: 'relative',
              width: '240px',
              height: '50px',
              background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
              border: '2px solid #00ff66',
              borderRadius: '25px',
              overflow: 'hidden',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(0, 255, 102, 0.3), inset 0 0 20px rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9945ff',
              fontFamily: "'Courier New', monospace",
              fontWeight: 'bold',
              fontSize: '14px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            ← Back to Lore
          </div>
        </Link>
      </div> */}
      
      
      {/* RL80 Logo - Mobile Only */}
      {fontLoaded && isMobileView && (
        <div style={{
          position: "absolute",
          top: "20px", 
          left: "20px",
          borderRadius: "8px",
          padding: "10px",
          pointerEvents: "auto",
          zIndex: 10,
        }}>
          <div 
            id="text"
            style={{
              position: "relative",
              fontFamily: "'UnifrakturMaguntia', serif",
              fontSize: "3rem",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            <Link href="/carousel" style={{ textDecoration: 'none', color: 'inherit', display: 'inline-block' }}>
              RL80
            </Link>
            {Array.from({length: 100}).map((_, i) => {
              const index = i + 1;
              const r80s = 201 - index * 2;
              const g80s = 55 - index * 3;
              const b80s = 256 - index * 2;
              const rNormal = 255 - index * 2;
              const gNormal = 255 - index * 3;
              const bNormal = 255 - index * 2;
              const translateX = index * 0.1;
              const translateY = index * 0.1;
              const scale = 1 + index * 0.01;
              
              const color80s = 'rgba(' + r80s + ', ' + g80s + ', ' + b80s + ')';
              const colorNormal = 'rgba(' + rNormal + ', ' + gNormal + ', ' + bNormal + ')';
              const transformStr = 'translate(' + translateX + 'rem, ' + translateY + 'rem) scale(' + scale + ')';
              
              return (
                <div
                  key={index}
                  className="text__copy"
                  style={{
                    position: "absolute",
                    pointerEvents: "none",
                    zIndex: -1,
                    top: 0,
                    left: 0,
                    color: is80sMode ? color80s : colorNormal,
                    filter: "blur(0.1rem)",
                    transform: transformStr,
                    opacity: (1 / index) * 1.5,
                  }}
                >
                  RL80
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Nav Controls - Top Right */}
      <div style={{
        position: "absolute",
        top: "1rem",
        right: "1rem",
        zIndex: 10000,
        pointerEvents: 'auto'
      }}>
        <NavControlsHome 
          isPlaying={contextIsPlaying}
          onPlayMusic={() => play()}
          onStopMusic={() => pause()}
          onSkipTrack={() => nextTrack()}
          onMenuClick={() => setIsMenuOpen(!isMenuOpen)}
          onUserClick={() => {}}
          isUserSignedIn={!!user}
          isMenuOpen={isMenuOpen}
          is80sMode={is80sMode}
          onToggle80sMode={() => setContext80sMode(!is80sMode)}
          userImage={user?.imageUrl}
        />
      </div>
      
      {/* CyberNav Menu Panel */}
      <CyberNav 
        is80sMode={is80sMode}
        position="fixed"
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        showButton={false}
      />
      
      {/* Thirdweb Buy Modal */}
      <ThirdwebBuyModal 
        isOpen={showBuyModal} 
        onClose={() => setShowBuyModal(false)}
      />
      
    </>
  )
}