'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import CarouselComponent from '@/components/carousel/Carousel'
import CyberGlitchButton from '@/components/carousel/CyberGlitchButton'
import ThirdwebBuyModal from '@/components/ThirdwebBuyModal'
import CyberNav from '@/components/CyberNav'
import Link from 'next/link'
import { useUser, SignInButton, UserButton } from '@clerk/nextjs'
import { useMusic } from '@/components/MusicContext'
import CoinLoader from '@/components/CoinLoader'

export default function CarouselPage() {
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

      <CarouselComponent onReady={handleCarouselReady} />
      
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
      <div
        style={{
          position: "fixed",
          top: "1rem",
          right: "1rem",
          zIndex: 300
        }}
      >
        <CyberNav 
          is80sMode={is80sMode}
          position="fixed"
        />
      </div>
      
      {/* Control Buttons - Positioned horizontally below CyberNav */}
      {/* Music Button */}
      <div
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
                {/* Spinning Album Art */}
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
                
                {/* Skip Button */}
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
                
                {/* Close Button */}
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
      
      {/* User Button - Next to Music Button */}
      <div
        style={{
          position: "fixed",
          top: "100px",
          right: "85px",
          zIndex: 290
        }}
      >
      </div>
      
      {/* 80s Mode Button - Next to User Button */}
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
      
      {/* Cyber Glitch Button - Desktop only (mobile shows in carousel) */}
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
              // Trigger ThirdwebBuyModal
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
      )}
      
      {/* Thirdweb Buy Modal */}
      <ThirdwebBuyModal 
        isOpen={showBuyModal} 
        onClose={() => setShowBuyModal(false)}
      />
      
      </div>
    </>
  )
}