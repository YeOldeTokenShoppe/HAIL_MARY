'use client'

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import CarouselComponent from '@/components/carousel/Carousel'
import CyberGlitchButton from '@/components/carousel/CyberGlitchButton'
import ThirdwebBuyModal from '@/components/ThirdwebBuyModal'
import CyberNav from '@/components/CyberNav'
import NavControlsHome from '@/components/NavControlsHome'
import Link from 'next/link'
import { useUser, SignInButton, UserButton } from '@clerk/nextjs'
import { useMusic } from '@/components/MusicContext'
import CoinLoader from '@/components/CoinLoader'
import UnifiedShrine from '@/components/UnifiedShrine'

function CarouselPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useUser()
  const { 
    play, 
    pause, 
    isPlaying: contextIsPlaying, 
    nextTrack,
    is80sMode: context80sMode, 
    setIs80sMode: setContext80sMode
  } = useMusic()
  const [showMusicControls, setShowMusicControls] = useState(contextIsPlaying)
  const [isMobileView, setIsMobileView] = useState(false)
  const [isMobileDevice, setIsMobileDevice] = useState(false)
  const [fontLoaded, setFontLoaded] = useState(false)
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [isPageLoading, setIsPageLoading] = useState(false) // Start with false to show content immediately
  const [imagesLoaded, setImagesLoaded] = useState(true) // Default to true
  const [carouselReady, setCarouselReady] = useState(true) // Default to true
  const [hasNavigated, setHasNavigated] = useState(false)
  const loadingTimeoutRef = useRef(null)
  const isTogglingRef = useRef(false)
  const is80sMode = context80sMode
  const [emoji, setEmoji] = useState("😇")
  
  // State for offerings data shared between CandleShrine and HandsGLTFScene
  const [hoveredOffering, setHoveredOffering] = useState(null)
  const [justLitOffering, setJustLitOffering] = useState(null)
  const [priceChange, setPriceChange] = useState(0)
  const candleShrineRef = useRef(null) // Reference to CandleShrine component // Track market price change
  
  // Mock offerings data - this would come from your database
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

  // Check if we navigated from another page - REMOVED FOR NOW

  // Simplified image preloading - don't block page display
  useEffect(() => {
    // Preload images in background without blocking
    const imagesToPreload = [
      '/virginRecords.jpg',
      '/carousel_images/img1.jpg',
      '/carousel_images/img2.jpg',
      '/carousel_images/img3.jpg',
      '/carousel_images/img4.jpg',
      '/carousel_images/img5.jpg',
      '/carousel_images/img6.jpg',
      '/carousel_images/img7.jpg',
      '/carousel_images/img8.jpg',
    ];

    imagesToPreload.forEach(src => {
      const img = new Image();
      img.src = src; // Just preload, don't wait
    });
  }, []);

  // REMOVED complex loading logic - page shows immediately

  // Carousel ready callback - simplified
  const handleCarouselReady = useCallback(() => {
    // No longer needed
  }, []);

  // Alternate emoji for sign-in button
  useEffect(() => {
    const emojiInterval = setInterval(() => {
      setEmoji((prevEmoji) => (prevEmoji === "😇" ? "😈" : "😇"));
    }, 3000);

    return () => clearInterval(emojiInterval);
  }, []);

  // Check if font is loaded
  useEffect(() => {
    const checkFont = async () => {
      try {
        await document.fonts.load("1em 'UnifrakturMaguntia'");
        setFontLoaded(true);
        document.body.classList.add('fonts-loaded');
        document.documentElement.classList.add('fonts-loaded');
      } catch (e) {
        setTimeout(() => {
          setFontLoaded(true);
          document.body.classList.add('fonts-loaded');
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

  // Sync showMusicControls with playing state
  useEffect(() => {
    if (contextIsPlaying && !showMusicControls) {
      setShowMusicControls(true);
    }
  }, [contextIsPlaying, showMusicControls]);
  
  // Listen for openBuyModal event
  useEffect(() => {
    const handleOpenBuyModal = () => {
      setShowBuyModal(true);
    };
    
    window.addEventListener('openBuyModal', handleOpenBuyModal);
    return () => window.removeEventListener('openBuyModal', handleOpenBuyModal);
  }, []);

  const handleMusicToggle = useCallback((show) => {
    setShowMusicControls(show);
    if (show && !contextIsPlaying) {
      play();
    }
  }, [contextIsPlaying, play]);

  const toggle80sMode = useCallback((newMode) => {
    if (isTogglingRef.current) return;
    isTogglingRef.current = true;
    
    if (setContext80sMode) {
      setContext80sMode(newMode);
    }
    
    // Start music when 80s mode is enabled, stop when disabled
    if (newMode) {
      setShowMusicControls(true);  // Show music controls
      play();
    } else {
      setShowMusicControls(false); // Hide music controls
      pause();
    }
    
    setTimeout(() => {
      isTogglingRef.current = false;
    }, 500);
  }, [setContext80sMode, play, pause]);
  
  // Initialize current view - default to carousel
  const [currentView, setCurrentView] = useState('carousel');
  
  // State for CyberNav menu
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Cleanup refs for view transitions
  const cleanupTimeoutsRef = useRef([])
  
  // Cleanup function for view transitions
  const cleanupBeforeViewChange = useCallback(() => {
    // Clear any pending timeouts
    cleanupTimeoutsRef.current.forEach(timeout => clearTimeout(timeout))
    cleanupTimeoutsRef.current = []
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc()
    }
  }, [])
  
  // State to force remount of components
  const [componentKey, setComponentKey] = useState(0)
  
  // Update URL when view changes
  const handleViewChange = useCallback((newView) => {
    // Cleanup before switching views
    cleanupBeforeViewChange()
    
    // Force component remount by changing key
    setComponentKey(prev => prev + 1)
    
    // Add a small delay to allow cleanup
    const timeoutId = setTimeout(() => {
      setCurrentView(newView)
      // Update URL without page reload
      const url = new URL(window.location.href)
      url.searchParams.set('view', newView)
      router.push(url.pathname + url.search, { scroll: false })
    }, 100)
    
    cleanupTimeoutsRef.current.push(timeoutId)
  }, [router, cleanupBeforeViewChange]);
  
  // Handle URL parameters on mount and changes
  useEffect(() => {
    const view = searchParams.get('view')
    console.log('URL view parameter:', view, 'Current view:', currentView)
    if (view === 'shrine') {
      setCurrentView('shrine')
    } else if (view === 'carousel' || !view) {
      setCurrentView('carousel')
    }
  }, [searchParams, currentView]);
  
  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      // Clear all timeouts
      cleanupTimeoutsRef.current.forEach(timeout => clearTimeout(timeout))
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current)
      }
      
      // Cleanup WebGL contexts
      cleanupBeforeViewChange()
    }
  }, [cleanupBeforeViewChange]);

  return (
    <>
      {/* CoinLoader - Removed since we're showing content immediately */}
      
      {/* Main content - Always visible */}
      <div style={{
        opacity: 1,
        visibility: 'visible',
      }}>
      
      {/* Add inline keyframes for font and spinning animation */}
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
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}} />
      
      {/* Cyber Toggle Switch for Views */}
      <div style={{
        position: isMobileDevice ? "absolute" : "fixed",
        top: isMobileDevice ? "100px" : "auto", 
        bottom: isMobileDevice ? "auto" : "30px",
        left: isMobileDevice ? "auto" : "50%",
        right: isMobileDevice ? "10px" : "auto",
        transform: isMobileDevice ? "none" : "translateX(-50%)",
        zIndex: 998, // Below stats and button
      }}>
        <div 
          style={{
            position: 'relative',
            width: isMobileDevice ? '160px' : '240px',
            height: isMobileDevice ? '35px' : '50px',
            background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
            border: '2px solid #9945ff',
            borderRadius: '25px',
            overflow: 'hidden',
            cursor: 'pointer',
            boxShadow: '0 0 20px rgba(153, 69, 255, 0.3), inset 0 0 20px rgba(0, 0, 0, 0.8)',
          }}
          onClick={() => handleViewChange(currentView === 'carousel' ? 'shrine' : 'carousel')}
        >
          {/* Toggle slider */}
          <div style={{
            position: 'absolute',
            top: isMobileDevice ? '2px' : '3px',
            left: currentView === 'carousel' ? (isMobileDevice ? '2px' : '3px') : (isMobileDevice ? '82px' : '123px'),
            width: isMobileDevice ? '76px' : '114px',
            height: isMobileDevice ? '31px' : '44px',
            background: `linear-gradient(135deg, ${currentView === 'carousel' ? '#00ff66' : '#9945ff'} 0%, ${currentView === 'carousel' ? '#00cc44' : '#7c37d0'} 100%)`,
            borderRadius: '22px',
            transition: 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
            boxShadow: `0 0 15px ${currentView === 'carousel' ? 'rgba(0, 255, 102, 0.6)' : 'rgba(153, 69, 255, 0.6)'}, inset 0 0 10px rgba(255, 255, 255, 0.2)`,
          }} />
          
          {/* Icons */}
          <span style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: isMobileDevice ? '16px' : '20px',
            transition: 'all 0.3s ease',
            pointerEvents: 'none',
            userSelect: 'none',
            left: '8px',
            opacity: currentView === 'carousel' ? '1' : '0.3',
            filter: currentView === 'carousel' ? 'drop-shadow(0 0 3px rgba(0, 255, 102, 0.8))' : 'none',
          }}></span>
          
          {/* Labels */}
          <span style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            fontFamily: "'Courier New', monospace",
            fontWeight: 'bold',
            fontSize: isMobileDevice ? '11px' : '14px',
            letterSpacing: isMobileDevice ? '0.5px' : '1px',
            textTransform: 'uppercase',
            transition: 'all 0.3s ease',
            pointerEvents: 'none',
            userSelect: 'none',
            left: isMobileDevice ? '25px' : '35px',
            color: currentView === 'carousel' ? '#000' : '#00ff66',
            textShadow: currentView === 'carousel' ? '0 0 5px rgba(0, 255, 102, 0.8)' : '0 0 10px rgba(0, 255, 102, 0.8), 0 0 20px rgba(0, 255, 102, 0.4)',
          }}>Lore</span>
          
          <span style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            fontFamily: "'Courier New', monospace",
            fontWeight: 'bold',
            fontSize: isMobileDevice ? '10px' : '12px',
            letterSpacing: isMobileDevice ? '0.3px' : '0.8px',
            textTransform: 'uppercase',
            transition: 'all 0.3s ease',
            pointerEvents: 'none',
            userSelect: 'none',
            right: isMobileDevice ? '10px' : '18px',
            color: currentView === 'shrine' ? '#fff' : '#00ff66',
            textShadow: currentView === 'shrine' ? '0 0 5px rgba(153, 69, 255, 0.8)' : '0 0 10px rgba(0, 255, 102, 0.8), 0 0 20px rgba(0, 255, 102, 0.4)',
          }}>Luminarium</span>
          
          <span style={{
            position: 'absolute',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: isMobileDevice ? '16px' : '20px',
            transition: 'all 0.3s ease',
            pointerEvents: 'none',
            userSelect: 'none',
            right: isMobileDevice ? '6px' : '8px',
            opacity: currentView === 'shrine' ? '1' : '0.3',
            filter: currentView === 'shrine' ? 'drop-shadow(0 0 3px rgba(153, 69, 255, 0.8))' : 'none',
          }}></span>
          
          {/* Circuit lines */}
          <div style={{
            position: 'absolute',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, #00ffff, transparent)',
            opacity: '0.3',
            top: '0',
            left: '0',
            right: '0',
          }} />
          
          <div style={{
            position: 'absolute',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, #00ffff, transparent)',
            opacity: '0.3',
            bottom: '0',
            left: '0',
            right: '0',
          }} />
        </div>
      </div>
      
      {/* Animated Views Container */}
      <AnimatePresence 
        mode="wait"
        onExitComplete={() => {
          // Additional cleanup after exit animation
          if (window.gc) {
            window.gc()
          }
        }}
      >
        {/* Carousel View - Always render if not explicitly shrine */}
        {currentView !== 'shrine' && (
          <motion.div
            key="carousel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            style={{
              width: "100%",
              height: "100vh",
              position: "absolute",
              top: 0,
              left: 0
            }}
          >
            <CarouselComponent key={`carousel-${componentKey}`} onReady={handleCarouselReady} disableScrollControls={false} />
            
            {/* Nav Controls Mobile (for both mobile and desktop) - Top Right */}
            <div style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              zIndex: 300
            }}>
              <NavControlsHome 
                isPlaying={contextIsPlaying}
                onPlayMusic={() => play()}
                onStopMusic={() => pause()}
                onSkipTrack={() => nextTrack()}
                onMenuClick={() => setIsMenuOpen(!isMenuOpen)}
                onUserClick={() => {
                  // Handle user click if needed
                }}
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
              showButton={false}  // Hide CyberNav's own hamburger button
            />
          </motion.div>
        )}
        
        {/* Shrine View */}
        {currentView === 'shrine' && (
          <motion.div
            key="shrine"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100vh",
              overflow: "hidden"
            }}
          >
            {/* Unified Scene with both candles and hands */}
            <div style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              zIndex: 1
            }}>
              <UnifiedShrine 
                key={`shrine-${componentKey}`}
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
            </div>
            
            {/* Nav Controls Mobile (for both mobile and desktop) - Top Right */}
            <div style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              zIndex: 300
            }}>
              <NavControlsHome 
                isPlaying={contextIsPlaying}
                onPlayMusic={() => play()}
                onStopMusic={() => pause()}
                onSkipTrack={() => nextTrack()}
                onMenuClick={() => setIsMenuOpen(!isMenuOpen)}
                onUserClick={() => {
                  // Handle user click if needed
                }}
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
              showButton={false}  // Hide CyberNav's own hamburger button
            />
            
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* RL80 Logo - Top Left */}
      {fontLoaded && (
        <div style={{
          position: "fixed",
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
              fontSize: isMobileView ? "3rem" : "4rem",
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
              
              // Create color strings
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
      
      {/* CyberNav - Top Right */}
     
     
      
      
      <div
        style={{
          position: "fixed",
          top: "100px",
          right: "85px",
          zIndex: 290
        }}
      >
      </div>
      
      {/* Thirdweb Buy Modal */}
      <ThirdwebBuyModal 
        isOpen={showBuyModal} 
        onClose={() => setShowBuyModal(false)}
      />
      </div>
    </>
  )
}

export default function CarouselPage() {
  return (
    <Suspense fallback={<CoinLoader loading={true} />}>
      <CarouselPageContent />
    </Suspense>
  )
}