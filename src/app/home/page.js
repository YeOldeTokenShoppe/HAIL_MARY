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
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [imagesLoaded, setImagesLoaded] = useState(false)
  const [carouselReady, setCarouselReady] = useState(false)
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

  // Preload all critical images including carousel images
  useEffect(() => {
    const imagesToPreload = [
      '/virginRecords.jpg',
      // Carousel images
      '/carousel_images/img1.jpg',
      '/carousel_images/img2.jpg',
      '/carousel_images/img3.jpg',
      '/carousel_images/img4.jpg',
      '/carousel_images/img5.jpg',
      '/carousel_images/img6.jpg',
      '/carousel_images/img7.jpg',
      '/carousel_images/img8.jpg',

    ];

    let loadedCount = 0;
    const totalImages = imagesToPreload.length;

    const imagePromises = imagesToPreload.map(src => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          resolve();
        };
        img.onerror = () => {
          console.warn(`Failed to load image: ${src}`);
          loadedCount++;
          resolve(); // Resolve anyway to not block loading
        };
        img.src = src;
      });
    });

    Promise.all(imagePromises).then(() => {
      setImagesLoaded(true);
    });
  }, []);

  // Check all loading states
  useEffect(() => {
    if (fontLoaded && imagesLoaded && carouselReady) {
      // Small delay to ensure smooth transition and Three.js initialization
      setTimeout(() => {
        setIsPageLoading(false);
      }, 500);
    }
  }, [fontLoaded, imagesLoaded, carouselReady]);

  // Loading timeout fallback
  useEffect(() => {
    loadingTimeoutRef.current = setTimeout(() => {
      setIsPageLoading(false);
    }, 12000); // 12 second timeout for slower connections
    
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  // Carousel ready callback
  const handleCarouselReady = useCallback(() => {
    setCarouselReady(true);
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
    
    setTimeout(() => {
      isTogglingRef.current = false;
    }, 500);
  }, [setContext80sMode]);
  
  // Initialize current view from URL parameter
  const [currentView, setCurrentView] = useState(() => {
    // Check URL param on initial load
    const view = searchParams.get('view')
    return view === 'shrine' ? 'shrine' : 'carousel'
  });
  
  // State for CyberNav menu
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Update URL when view changes
  const handleViewChange = useCallback((newView) => {
    setCurrentView(newView)
    // Update URL without page reload
    const url = new URL(window.location.href)
    url.searchParams.set('view', newView)
    router.push(url.pathname + url.search, { scroll: false })
  }, [router]);
  
  // Handle browser back/forward
  useEffect(() => {
    const view = searchParams.get('view')
    if (view === 'shrine' || view === 'carousel') {
      setCurrentView(view)
    }
  }, [searchParams]);

  return (
    <>
      {/* CoinLoader - Shows while page is loading */}
      <CoinLoader loading={isPageLoading} />

      {/* Main content - Hidden while loading */}
      <div style={{
        opacity: isPageLoading ? 0 : 1,
        visibility: isPageLoading ? 'hidden' : 'visible',
        transition: 'opacity 0.5s ease-in-out',
      }}>
      
      {/* Add inline keyframes for font and spinning animation */}
      <style jsx global>{`
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
      `}</style>
 
      {/* Toggle Button for Views */}
      <div style={{
        position: "fixed",
        bottom: "30px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        display: "flex",
        gap: "10px",
        background: "rgba(0, 0, 0, 0.8)",
        padding: "10px 20px",
        borderRadius: "30px",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255, 255, 255, 0.2)"
      }}>
        <button
          onClick={() => handleViewChange('carousel')}
          style={{
            background: currentView === 'carousel' ? "#00ff66" : "transparent",
            color: currentView === 'carousel' ? "#000" : "#fff",
            border: "none",
            padding: "8px 20px",
            borderRadius: "20px",
            fontFamily: "monospace",
            fontSize: "14px",
            cursor: "pointer",
            transition: "all 0.3s ease"
          }}
        >
          📜 Lore
        </button>
        <button
          onClick={() => handleViewChange('shrine')}
          style={{
            background: currentView === 'shrine' ? "#00ff66" : "transparent",
            color: currentView === 'shrine' ? "#000" : "#fff",
            border: "none",
            padding: "8px 20px",
            borderRadius: "20px",
            fontFamily: "monospace",
            fontSize: "14px",
            cursor: "pointer",
            transition: "all 0.3s ease"
          }}
        >
          🕯️ Shrine
        </button>
      </div>
      
      {/* Animated Views Container */}
      <AnimatePresence mode="wait">
        {/* Carousel View */}
        {currentView === 'carousel' && (
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
            <CarouselComponent onReady={handleCarouselReady} />
            
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
            
            {/* Shrine Heading Overlay */}
            {/* <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
              style={{
                position: "absolute",
                top: "120px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 100,
                textAlign: "center",
                pointerEvents: "none",
                maxWidth: "90%"
              }}
            >
              <h1 style={{
                fontFamily: "'UnifrakturMaguntia', serif",
                fontSize: isMobileView ? "2rem" : "3rem",
                color: "#fff",
                margin: 0,
                textShadow: `
                  0 0 40px rgba(0, 255, 102, 0.8),
                  0 0 80px rgba(0, 255, 102, 0.4),
                  0 0 120px rgba(0, 255, 102, 0.2),
                  2px 2px 4px rgba(0, 0, 0, 0.8)
                `,
                letterSpacing: "0.05em",
                fontWeight: "normal",
                WebkitTextStroke: "1px rgba(0, 255, 102, 0.3)"
              }}>
                Get on Her Watchlist
              </h1>
              <div style={{
                marginTop: "10px",
                fontSize: isMobileView ? "0.9rem" : "1.1rem",
                color: "rgba(255, 255, 255, 0.6)",
                fontFamily: "monospace",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)"
              }}>
                Light a candle • Make an offering
              </div>
            </motion.div> */}
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
            <Link href="/home" style={{ textDecoration: 'none', color: 'inherit', display: 'inline-block' }}>
              RL80
            </Link>
            {Array.from({length: 100}).map((_, i) => {
              const index = i + 1;
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
                    color: is80sMode 
                      ? `rgba(${201 - index * 2}, ${55 - index * 3}, ${256 - index * 2})` 
                      : `rgba(${255 - index * 2}, ${255 - index * 3}, ${255 - index * 2})`,
                    filter: "blur(0.1rem)",
                    transform: `translate(
                      ${index * 0.1}rem, 
                      ${index * 0.1}rem
                    ) scale(${1 + index * 0.01})`,
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
     
     
      
      {/* Control Buttons - Positioned horizontally below CyberNav */}
      {/* Music Button */}
      {/* <div
        style={{
          position: "fixed",
          top: "5rem",
          right: "1rem",
          zIndex: 290
        }}
      >
        {
            !showMusicControls ? (
              <button
                onClick={() => handleMusicToggle(true)}
                style={{
                  width: isMobileDevice ? "3.5rem" : "3.5rem",
                  height: isMobileDevice ? "3.5rem" : "3.5rem",
                  borderRadius: "0.5rem",
                  backgroundColor: is80sMode ? "rgba(217, 70, 239, 0.2)" : "rgba(0, 0, 0, 0.7)",
                  border: is80sMode ? "2px solid #D946EF" : "2px solid rgba(255, 255, 255, 0.2)",
                  color: is80sMode ? "#67e8f9" : "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  backdropFilter: "blur(10px)",
                  boxShadow: "0 0.125rem 0.5rem rgba(0, 0, 0, 0.3)",
                }}
                title="Toggle Music"
              >
                <svg
                  width={isMobileDevice ? "20" : "30"}
                  height={isMobileDevice ? "20" : "30"}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
              </button>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <div
                  style={{
                    width: isMobileDevice ? "3rem" : "3.5rem",
                    height: isMobileDevice ? "3rem" : "3.5rem",
                    borderRadius: "50%",
                    overflow: "hidden",
                    animation: contextIsPlaying ? "spin 4s linear infinite" : "none",
                    cursor: "pointer"
                  }}
                  onClick={() => {
                    if (contextIsPlaying) {
                      pause();
                    } else {
                      play();
                    }
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      backgroundImage: "url('/virginRecords.jpg')",
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    }}
                  />
                </div>
                
                <button
                  onClick={() => nextTrack && nextTrack()}
                  style={{
                    width: isMobileDevice ? "2rem" : "2.5rem",
                    height: isMobileDevice ? "2rem" : "2.5rem",
                    borderRadius: "0.25rem",
                    backgroundColor: is80sMode ? "rgba(217, 70, 239, 0.2)" : "rgba(0, 0, 0, 0.7)",
                    border: is80sMode ? "2px solid #D946EF" : "2px solid rgba(255, 255, 255, 0.2)",
                    color: is80sMode ? "#67e8f9" : "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    backdropFilter: "blur(10px)",
                    boxShadow: "0 0.125rem 0.375rem rgba(0, 0, 0, 0.3)",
                  }}
                  title="Next Track"
                >
                  <svg width={isMobileDevice ? "14" : "18"} height={isMobileDevice ? "14" : "18"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 4 15 12 5 20 5 4"/>
                    <line x1="19" y1="5" x2="19" y2="19"/>
                  </svg>
                </button>
                
                <button
                  onClick={() => {
                    handleMusicToggle(false);
                    pause && pause();
                  }}
                  style={{
                    width: isMobileDevice ? "1.75rem" : "2rem",
                    height: isMobileDevice ? "1.75rem" : "2rem",
                    borderRadius: "0.25rem",
                    backgroundColor: is80sMode ? "rgba(217, 70, 239, 0.2)" : "rgba(0, 0, 0, 0.7)",
                    border: is80sMode ? "1px solid #D946EF" : "1px solid rgba(255, 255, 255, 0.2)",
                    color: is80sMode ? "#67e8f9" : "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    backdropFilter: "blur(10px)",
                    boxShadow: "0 0.125rem 0.375rem rgba(0, 0, 0, 0.3)",
                  }}
                  title="Close Music"
                >
                  <svg width={isMobileDevice ? "12" : "14"} height={isMobileDevice ? "12" : "14"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            )
          }
      </div>
      
      <div
        style={{
          position: "fixed",
          top: "100px",
          right: "85px",
          zIndex: 290
        }}
      >
      </div>
      
      <div
        style={{
          position: "fixed",
          top: "9rem",
          right: "1rem",
          zIndex: 290
        }}
      >
        <button
          onClick={() => toggle80sMode(!is80sMode)}
          style={{
            width: isMobileDevice ? "3.5rem" : "3.5rem",
            height: isMobileDevice ? "3.5rem" : "3.5rem",
            borderRadius: "0.5rem",
            backgroundColor: is80sMode ? "rgba(217, 70, 239, 0.3)" : "rgba(0, 0, 0, 0.7)",
            border: is80sMode ? "2px solid #D946EF" : "2px solid rgba(255, 255, 255, 0.2)",
            color: is80sMode ? "#67e8f9" : "#ffffff",
            display: "flex",
            lineHeight: 0.7,
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.3s ease",
            backdropFilter: "blur(10px)",
            boxShadow: is80sMode 
              ? "0 0 20px rgba(217, 70, 239, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3)" 
              : "0 2px 8px rgba(0, 0, 0, 0.3)",
          }}
          onMouseEnter={(e) => {
            if (is80sMode) {
              e.currentTarget.style.boxShadow = "0 0 30px rgba(217, 70, 239, 0.7), 0 2px 8px rgba(0, 0, 0, 0.3)";
            } else {
              e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
            }
          }}
          onMouseLeave={(e) => {
            if (is80sMode) {
              e.currentTarget.style.boxShadow = "0 0 20px rgba(217, 70, 239, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3)";
            } else {
              e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
            }
          }}
          title={is80sMode ? "Disable 80s Mode" : "Enable 80s Mode"}
        >
          <span style={{
            fontSize: isMobileDevice ? "18px" : "22px",
            fontWeight: "bold",
            color: is80sMode ? "#00ff41" : "#67e8f9",
            textShadow: is80sMode ? "0 0 10px #00ff41" : "none",
            fontFamily: "monospace"
          }}>
            80s<br/>
             <span style={{
            fontSize: isMobileDevice ? "10px" : "12px",
            fontWeight: "bold",
            color: is80sMode ? "#00ff41" : "#67e8f9",
            textShadow: is80sMode ? "0 0 10px #00ff41" : "none",
            fontFamily: "monospace"
          }}>
            mode
          </span>
          </span>
        </button>
      </div>
      
      {!isMobileView && (
        <div style={{
          position: "fixed",
          top: "1rem",
          right: "8rem",
          zIndex: 200,
        }}>
          <CyberGlitchButton 
            text="BUY RL80_"
            onClick={() => {
              const event = new CustomEvent('openBuyModal')
              window.dispatchEvent(event)
            }}
            primaryHue={274}  // Purple (CYBER color)
            primaryShadowHue={180}  // Cyan
            secondaryShadowHue={60}  // Yellow
            label="RP80"
            mobile={false}
          />
        </div>
      )} */}
      
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