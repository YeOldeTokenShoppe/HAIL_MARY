'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { createPortal } from 'react-dom'
import CarouselComponent from '@/components/carousel/Carousel'
import NavControlsHome from '@/components/NavControlsHome'
import CyberNav from '@/components/CyberNav'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { useMusic } from '@/components/MusicContext'
import ThirdwebBuyModal from '@/components/ThirdwebBuyModal'
import CyberGlitchButton from '@/components/carousel/CyberGlitchButton'
import CoinLoader from '@/components/CoinLoader'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/components/LanguageProvider'

export default function CarouselPage() {
  const router = useRouter()
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
      height: '100vh',
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
        
        #text, .text__copy {
          font-family: 'UnifrakturMaguntia', serif !important;

  
          .cyber-candle-btn {
            position: relative;
          }
          
          .cyber-candle-btn::before {
            content: '';
            position: absolute;
            top: 50%;
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
      <CarouselComponent disableScrollControls={false} />
      
      {/* Buy RL80 Button */}
      {deviceDetected && (
        <div style={{
          position: "fixed",
          top: isMobileDevice ? "85%" : "6rem",
          right: isMobileDevice ? "67%" : "1.5rem",
          zIndex: 298,
          marginTop: '0rem',
          overflow: 'visible',

        }}>

          <div className="cyber-candle-btn" style={{ 
            opacity: mounted ? 1 : 0, 
            transition: 'opacity 0.3s',
            position: 'relative',
            display: 'inline-block'
          }}>
            <CyberGlitchButton
              key={`button-${isMobileDevice}`}
              text={t('buttons.buy') || 'Buy'}
              text2="RL80"
              onClick={() => setShowBuyModal(true)}
              label="RL80"
              mobile={isMobileDevice}
            />
          </div>
        </div>
      )}
      
      {/* Tiny Candle Button with Glowing Arrow - Bottom Right */}
      <div 
        className="candle-button"
        style={{
          position: "fixed",
          bottom: isMobileDevice ? "40px" : "30px",
          right: isMobileDevice ? "20px" : "30px",
          width: isMobileDevice ? "50px" : "80px",
          height: isMobileDevice ? "50px" : "80px",
          zIndex: 297,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "transform 0.3s ease, filter 0.3s ease",
        }}
        onClick={() => window.location.href = '/illumin80'}
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
          src="/images/SKULL_TATTOO.webp"
          alt="Tiny Candle Button"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      </div>
      
      {/* Glowing Arrow with Luminarium Text */}
      <svg
        className="luminarium-arrow"
        style={{
          position: "fixed",
          bottom: isMobileDevice ? "20px" : "20px",
          right: isMobileDevice ? "10px" : "20px",
          width: isMobileDevice ? "220px" : "300px",
          height: isMobileDevice ? "100px" : "150px",
          zIndex: 296,
          pointerEvents: "auto",
          cursor: "pointer",
        }}
        viewBox="0 0 300 150"
        onClick={() => window.location.href = '/illumin80'}
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
        
        {/* Text along path */}
        <text
          fill="#ffcc00"
          fontSize="28"
          fontFamily="'UnifrakturMaguntia', cursive"
          filter="url(#candleGlow)"
          style={{ 
            transition: "all 0.3s ease",
            textShadow: "2px 2px 8px rgba(0, 0, 0, 0.9), 4px 4px 12px rgba(0, 0, 0, 0.7)",
            filter: "url(#candleGlow) drop-shadow(3px 3px 6px rgba(0, 0, 0, 0.8))"
          }}
        >
          <textPath href="#textPath" startOffset="0">
            The Illumin80
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
      
      {/* Our Lady of Perpetual Profit Logo - Top Left (Desktop/Tablet) - Using Portal to ensure it's on top */}
      {typeof document !== 'undefined' && deviceDetected && !isMobileDevice && createPortal(
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100vh',
          zIndex: 99999,
          pointerEvents: 'none',
        }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            // flexDirection: 'column',
            width: '100%',
            paddingTop: '3rem',
            minHeight: '100vh',
            pointerEvents: 'none',
          }}>
            
            <h1 className='custom-title footer-title'
              id="main-title"
              onClick={() => router.push('/#final')}
              style={{ 
              position: "relative",
              // left: isMobile ? "5%" : "10%",
              color: is80sMode ? "#ffffff" : "#d4af37",
              textShadow: is80sMode 
                ? `
                  0 0 20px rgba(201, 55, 255, 0.9),
                  0 0 40px rgba(201, 55, 255, 0.8),
                  0 0 60px rgba(201, 55, 255, 0.7),
                  4px 4px 12px rgba(201, 55, 255, 1),
                  -2px -2px 8px rgba(255, 0, 255, 0.8),
                  0 0 100px rgba(201, 55, 255, 0.5)
                `
                : `
                  rgba(83, 61, 74, 0.9) 1px 1px,
                  rgba(83, 61, 74, 0.9) 2px 2px,
                  rgba(83, 61, 74, 0.8) 3px 3px,
                  rgba(83, 61, 74, 0.8) 4px 4px,
                  rgba(83, 61, 74, 0.7) 5px 5px,
                  rgba(83, 61, 74, 0.7) 6px 6px,
                  rgba(83, 61, 74, 0.6) 7px 7px,
                  rgba(83, 61, 74, 0.6) 8px 8px,
                  rgba(255, 192, 203, 0.4) -1px -1px 5px,
                  rgba(0, 0, 0, 0.8) 10px 10px 15px
                `,
              fontSize:  "3.5rem",
              fontFamily: "'UnifrakturCook', serif",
              fontWeight: 900,
              lineHeight: 0.8,
              transform: isMobileDevice ? "rotate(-5deg)" : "rotate(-8deg) skew(-15deg)",
              zIndex: 10,
              whiteSpace: isMobileDevice ? 'normal' : 'nowrap',
              cursor: 'pointer',
              margin: 0,
              pointerEvents: 'auto',
            }}>
              <span  style={{ display: 'block',  marginLeft: isMobileDevice ? "0rem" : "-2rem",position: 'relative' }}>{t('heading.ourLady') || 'Our Lady'}</span>
              <span  style={{ display: 'block', position: 'relative' }}>
                {t('heading.of') && t('heading.of') !== 'heading.of' && (
                  <span style={{ fontSize: isMobileDevice ? "1.2rem" : "1.3rem" }}>{t('heading.of')}    </span>
                )}
                {t('heading.perpetual') || 'Perpetual'}
              </span>
              {t('heading.profit') && t('heading.profit') !== 'heading.profit' && (
                <span  style={{ display: 'block', marginLeft: isMobileDevice ? "0rem" : "0rem", position: 'relative' }}>{t('heading.profit')}</span>
              )}
            </h1>

          </div>
        </div>,
        document.body
      )}
      
      {/* RL80 Logo - Mobile Only - Using Portal */}
      {typeof document !== 'undefined' && deviceDetected && isMobileDevice && createPortal(
        <div style={{
          position: "fixed",
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
        </div>,
        document.body
      )}
    </div>
  )
}