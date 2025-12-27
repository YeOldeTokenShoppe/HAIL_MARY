"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMusic } from '@/components/MusicContext';
import CoinLoader from '@/components/CoinLoader';
import CyberNav from '@/components/CyberNav';
import { useUser, SignInButton, UserButton } from '@clerk/nextjs';

// Dynamic import for the FountainFrame component
const FountainFrame = dynamic(() => import('@/components/FountainFrame'), {
  ssr: false,
  loading: () => <CoinLoader loading={true} />
});

export default function FountainPage() {
  // Get user from Clerk
  const { user, isSignedIn } = useUser();
  
  const { play, pause, isPlaying: contextIsPlaying, nextTrack, is80sMode: context80sMode, setIs80sMode: setContext80sMode } = useMusic();
  const [isLoading, setIsLoading] = useState(true);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [showMusicControls, setShowMusicControls] = useState(contextIsPlaying);
  const [isMobileView, setIsMobileView] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const is80sMode = context80sMode;
  const isToggling80sRef = useRef(false);
  const [emoji, setEmoji] = useState("😇");
  const iframeRef = useRef(null);
  const loadingTimeoutRef = useRef(null);

  // Alternate emoji for sign-in button
  useEffect(() => {
    const emojiInterval = setInterval(() => {
      setEmoji((prevEmoji) => (prevEmoji === "😇" ? "😈" : "😇"));
    }, 3000);

    return () => clearInterval(emojiInterval);
  }, []);
  
  // Check if mobile - run immediately on mount
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth <= 768;
      setIsMobileView(isMobile);
      setIsMobileDevice(isMobile);
    };
    // Run immediately
    if (typeof window !== 'undefined') {
      checkMobile();
    }
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  // Check if font is loaded
  useEffect(() => {
    const checkFont = async () => {
      try {
        await document.fonts.load("1em 'UnifrakturMaguntia'");
        setFontLoaded(true);
        // Add fonts-loaded class to html to show the logo
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

  // Sync music controls
  useEffect(() => {
    if (contextIsPlaying && !showMusicControls) {
      setShowMusicControls(true);
    }
  }, [contextIsPlaying]);

  // Handle fountain ready signal from iframe
  const handleFountainReady = useCallback(() => {
    console.log('Fountain ready signal received');
    setIsLoading(false);
    // Clear the fallback timeout if it exists
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
  }, []);

  // Loading timeout fallback (increased to 10 seconds for model loading)
  useEffect(() => {
    loadingTimeoutRef.current = setTimeout(() => {
      console.log('Loading timeout reached, hiding loader as fallback');
      setIsLoading(false);
    }, 10000);
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  const handleMusicToggle = useCallback((show) => {
    setShowMusicControls(show);
    if (show && !contextIsPlaying) {
      play();
    }
  }, [contextIsPlaying, play]);

  const toggle80sMode = useCallback(() => {
    if (isToggling80sRef.current) return;
    isToggling80sRef.current = true;
    const newMode = !is80sMode;
    setContext80sMode(newMode);
    
    // Send message to iframe to update button styles
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'toggle80sMode', enabled: newMode }, '*');
    }
    
    setTimeout(() => {
      isToggling80sRef.current = false;
    }, 100);
  }, [is80sMode, setContext80sMode]);

  return (
    <div style={{
      backgroundColor: "#000000",
      height: "100vh",
      width: "100vw",
      margin: 0,
      padding: 0,
      position: "fixed",
      left: 0,
      top: 0,
      overflow: "hidden",
    }}>
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

      {/* Loader */}
      {isLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#000',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <CoinLoader loading={isLoading} />
        </div>
      )}

      {/* The Fountain iframe */}
      <FountainFrame is80sMode={is80sMode} ref={iframeRef} onFullyLoaded={handleFountainReady} />

      {/* UI Overlay - RL80 Logo */}
      <div style={{
        position: "fixed",
        top: "20px",
        left: "20px",
        borderRadius: "8px",
        padding: "10px",
        pointerEvents: "auto",
        opacity: fontLoaded ? 1 : 0,
        transition: "opacity 0.3s ease-in-out",
        zIndex: 10001,
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
          {Array.from({ length: 100 }).map((_, i) => {
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

      {/* CyberNav with integrated buttons */}
      <div
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          zIndex: 9999
        }}
      >
        <CyberNav 
          is80sMode={is80sMode}
          position="fixed"
         
        />
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

      </div>

      {/* Buy Token FAB */}
      {/* <div onClick={() => setShowCandleModal(true)}>
        <BuyTokenFAB is80sMode={is80sMode} />
      </div> */}

      {/* Candle Modal */}
      {/* <CompactCandleModal
        isOpen={showCandleModal}
        onClose={() => setShowCandleModal(false)}
        onCandleCreated={(candle) => {
          console.log('New candle created:', candle);
        }}
      /> */}
    </div>
  );
}