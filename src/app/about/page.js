'use client'

import React, { useState, useEffect, Suspense } from 'react'
import dynamic from 'next/dynamic'
import CyberNav from '@/components/CyberNav'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { useMusic } from '@/components/MusicContext'
import ThirdwebBuyModal from '@/components/ThirdwebBuyModal'
import CyberGlitchButton from '@/components/carousel/CyberGlitchButton'
import CoinLoader from '@/components/CoinLoader'
import { useRouter, usePathname } from 'next/navigation'
import { useLanguage } from '@/components/LanguageProvider'
import RetroFuturisticButton from '@/components/RetroFuturisticButton'
import Footer from '@/components/Footer'
// import HolyGrail from '@/components/HolyGrail'

// Dynamic imports with no SSR for consistent loading
const CarouselComponent = dynamic(() => import('@/components/carousel/Carousel'), {
  ssr: false,
  loading: () => <CoinLoader loading={true} />
})

const NavControlsHome = dynamic(() => import('@/components/NavControlsHome'), {
  ssr: false,
  loading: () => null // Don't show loader for nav controls
})

export default function CarouselPage() {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useUser()
  const { t } = useLanguage()
  const { 
    play, 
    pause, 
    isPlaying: contextIsPlaying, 
    nextTrack,
    is80sMode: context80sMode, 
    setIs80sMode: setContext80sMode
  } = useMusic()
  const [isMobileView, setIsMobileView] = useState(false)
  const [fontLoaded, setFontLoaded] = useState(false)
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isMobileDevice, setIsMobileDevice] = useState(false)
  const [deviceDetected, setDeviceDetected] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const is80sMode = context80sMode
  
  // Prefetch illumin80 route on mount for smoother navigation
  useEffect(() => {
    router.prefetch('/illumin80');
  }, [router]);

  // Set mounted state after hydration and handle loading
  useEffect(() => {
    setMounted(true);
    
    // Preload all carousel images
    const imageUrls = [
      '/carousel_images/img1.jpg',
      '/carousel_images/img2.jpg',
      '/carousel_images/img3.jpg',
      '/carousel_images/img4.jpg',
      '/carousel_images/img5.jpg',
      '/carousel_images/img6.jpg',
      '/carousel_images/img7.jpg',
      '/carousel_images/img8.jpg'
    ];
    
    let loadedCount = 0;
    
    const imagePromises = imageUrls.map(url => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          resolve(true);
        };
        img.onerror = () => {
          console.warn(`Failed to load image: ${url}`);
          loadedCount++;
          resolve(false); // Resolve anyway to not block loading
        };
        img.src = url;
      });
    });
    
    // Wait for all images to load (or fail)
    Promise.all(imagePromises).then(() => {
      // Add a small delay for smooth transition
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    });
    
    // Fallback timeout in case images take too long
    const fallbackTimer = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
      }
    }, 10000); // 10 second max wait
    
    return () => clearTimeout(fallbackTimer);
  }, []);

  // Handle resize events for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth
      const height = window.innerHeight
      const isPortrait = height > width
      
      // Detect if it's likely an iPad (including iPad Mini)
      const isIPad = /iPad/.test(navigator.userAgent) || 
                     (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
      
      // For tablets: check if it's in portrait and width is tablet-like (768px)
      const isTabletPortrait = isIPad && isPortrait && width >= 768 && width <= 834
      
      // Phone breakpoint - only true phones, not tablets even in portrait
      const isPhone = width < 480 && !isIPad
      
      // Mobile view for other UI elements
      const isMobileView = width <= 1024 && !isIPad
      
      
      // Only phones get mobile treatment, not tablets even in portrait
      setIsMobileDevice(prevState => {
        if (prevState !== isPhone) {
        }
        return isPhone
      })
      setIsMobileView(isMobileView)
      setDeviceDetected(true)
    }

    // Run immediately
    if (typeof window !== 'undefined') {
      handleResize()
    }
    
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [])



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
  

  
  // Listen for openBuyModal event
  useEffect(() => {
    const handleOpenBuyModal = () => {
      setShowBuyModal(true);
    };
    
    window.addEventListener('openBuyModal', handleOpenBuyModal);
    return () => window.removeEventListener('openBuyModal', handleOpenBuyModal);
  }, []);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      minHeight: '100vh',
      overflowY: 'auto',
      ...(is80sMode && isMobileDevice ? {
        backgroundImage: 'url("/images/retro.webp")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      } : {})
    }}>
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
        
        /* Responsive scaling for smaller viewports */
        @media screen and (max-width: 1400px), screen and (max-height: 800px) {
          .navigation-group {
            transform: scale(1.0) !important;
          }
        }
        
        /* Medium viewports */
        @media screen and (max-width: 1200px), screen and (max-height: 700px) {
          .navigation-group {
            transform: scale(0.85) !important;
          }
        }
        
        /* Prevent overlaps on very small windows */
        @media screen and (max-width: 900px) and (max-height: 600px) {
          .navigation-group {
            transform: scale(0.65) !important;
            bottom: 10px !important;
            right: 10px !important;
          }
        }
        
        #text, .text__copy {
          font-family: 'UnifrakturMaguntia', serif !important;

  
          .cyber-candle-btn {
            position: relative;

          }
          
          .cyber-candle-btn::before {
            content: '';
            position: absolute;
            top: 60%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 150%;
            height: 150%;
            background: radial-gradient(ellipse at center, 
              rgba(153, 69, 255, 0.9) 0%,
              rgba(0, 255, 255, 0.7) 20%,
              rgba(153, 69, 255, 0.4) 40%,
              rgba(0, 255, 255, 0.2) 60%,
              transparent 80%
            );
            filter: blur(30px);
            animation: pulseGlow 2s ease-in-out infinite;
            pointer-events: none;
            z-index: -1;
          }
          
          @keyframes pulseGlow {
            0%, 100% {
              opacity: 0.8;
              transform: translate(-50%, -50%) scale(1);
            }
            50% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1.1);
            }
          }
          
          .cyber-candle-btn:hover::before {
            animation: pulseGlow 1s ease-in-out infinite;
            filter: blur(25px);
            background: radial-gradient(ellipse at center, 
              rgba(153, 69, 255, 0.8) 0%,
              rgba(0, 255, 255, 0.6) 25%,
              rgba(255, 0, 102, 0.3) 50%,
              transparent 70%
            );
          }
          
          .cyber-candle-btn :global(.cybr-btn) {
            --primary: #9945ff;
            --shadow-primary: #00ffff;
            --shadow-secondary-hue: 340;
            --color: white;
            position: relative;
            z-index: 1;
          }
          .cyber-candle-btn :global(.cybr-btn:hover) {
            --primary: #7c37d0;
            --shadow-primary: #00ffff;
            box-shadow: 
              0 0 30px rgba(153, 69, 255, 0.8),
              0 0 60px rgba(0, 255, 255, 0.6),
              0 0 90px rgba(153, 69, 255, 0.4);
          }
          .cyber-candle-btn :global(.cybr-btn:active) {
            --primary: #6b2fb5;
            --shadow-primary: #00ffff;
          }
          .cyber-candle-btn :global(.cybr-btn__glitch) {
            background: linear-gradient(45deg, #00ffff, #9945ff);
            text-shadow: 2px 2px #ff0066, -2px -2px #00ffff;
          }
          .cyber-candle-btn :global(.cybr-label) {
            background: linear-gradient(45deg, #00ffff, #ff0066);
            color: #000;
            font-weight: 900;
          }

        }
      `}} />
      
      {/* Main carousel */}
      <CarouselComponent
        disableScrollControls={false}
      />
      
      
      {/* Navigation Toggle */}
      {/* <div style={{
        position: "fixed",
        bottom: "30px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 998,
      }}>
        <Link href="/shrine" style={{ textDecoration: 'none' }}>
          <div 
            style={{
              position: 'relative',
              width: '240px',
              height: '50px',
              background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
              border: '2px solid #9945ff',
              borderRadius: '25px',
              overflow: 'hidden',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(153, 69, 255, 0.3), inset 0 0 20px rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#00ff66',
              fontFamily: "'Courier New', monospace",
              fontWeight: 'bold',
              fontSize: '14px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            Go to Luminarium →
          </div>
        </Link>
      </div> */}
      
      {/* Purple Buy Button Styling - Consistent across all devices */}
      <style jsx>{`
        .cyber-buy-btn :global(.cybr-btn) {
          --primary: #9945ff !important;
          --shadow-primary: #00ffff !important;
          --shadow-secondary-hue: 340;
          --color: white;
        }
        .cyber-buy-btn :global(.cybr-btn:hover) {
          --primary: #7c37d0 !important;
          --shadow-primary: #00ffff !important;
        }
        .cyber-buy-btn :global(.cybr-btn:active) {
          --primary: #6b2fb5 !important;
          --shadow-primary: #00ffff !important;
        }
        .cyber-buy-btn :global(.cybr-btn:after) {
          background: #9945ff !important;
        }
        .cyber-buy-btn :global(.cybr-btn:hover:after) {
          background: #7c37d0 !important;
        }
        .cyber-buy-btn :global(.cybr-btn:active:after) {
          background: #6b2fb5 !important;
        }
        .cyber-buy-btn :global(.cybr-btn__glitch) {
          background: linear-gradient(45deg, #00ffff, #9945ff);
          text-shadow: 2px 2px #ff0066, -2px -2px #00ffff;
        }
        .cyber-buy-btn :global(.cybr-label) {
          background: linear-gradient(45deg, #00ffff, #ff0066);
          color: #000;
          font-weight: 900;
        }
      `}</style>
      
      {/* Top Right Controls Container */}
      <div style={{
        position: "absolute",
        top: "1rem",
        right: "1rem",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        gap: "1rem"
      }}>
        {/* Buy RL80 Button - top right on non-mobile */}
        {deviceDetected && !isMobileDevice && (
          <div className="cyber-candle-btn" style={{
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.3s',
          }}>
            <RetroFuturisticButton
              onClick={() => setShowBuyModal(true)}
              disabled={isLoading}
              className="my-custom-class"
            >
              BUY RL80
            </RetroFuturisticButton>
          </div>
        )}
        {/* Nav Controls */}
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
      
      
      {/* Buy RL80 Button - bottom right on mobile */}
      {deviceDetected && isMobileDevice && (
        <div className="cyber-candle-btn" style={{
          position: 'absolute',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 300,
          opacity: mounted ? 1 : 0,
          transition: 'opacity 0.3s',
        }}>
          <RetroFuturisticButton
            onClick={() => setShowBuyModal(true)}
            disabled={isLoading}
            className="my-custom-class"
          >
            BUY RL80
          </RetroFuturisticButton>
        </div>
      )}

      {/* RL80 Logo - Mobile Only */}
      {deviceDetected && isMobileDevice && (
        <div style={{
          position: "absolute",
          top: "20px", 
          left: "20px",
          borderRadius: "8px",
          padding: "10px",
          pointerEvents: "auto",
          zIndex: 999,
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
            <Link href="/#final" style={{ textDecoration: 'none', color: 'inherit', display: 'inline-block' }}>
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
                    transform: `translate(${index * 0.1}rem, ${index * 0.1}rem) scale(${1 + index * 0.01})`,
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
    </div>
  )
}