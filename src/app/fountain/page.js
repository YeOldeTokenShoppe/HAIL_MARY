"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMusic } from '@/components/MusicContext';
import CoinLoader from '@/components/CoinLoader';
import CyberNav from '@/components/CyberNav';
import NavControlsHome from '@/components/NavControlsHome';
import MobileBottomNav from '@/components/MobileBottomNav';
import FountainDonationModal from '@/components/FountainDonationModal';
import BuyModal from '@/components/BuyModal';
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
  const [isMobileView, setIsMobileView] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [preselectedCharity, setPreselectedCharity] = useState(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const is80sMode = context80sMode;
  const iframeRef = useRef(null);
  const loadingTimeoutRef = useRef(null);

  
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


  // Handle fountain ready signal from iframe
  const handleFountainReady = useCallback(() => {

    setIsLoading(false);
    // Clear the fallback timeout if it exists
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
  }, []);

  // Loading timeout fallback (increased to 10 seconds for model loading)
  useEffect(() => {
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
    }, 10000);
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);


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
      <FountainFrame
        is80sMode={is80sMode}
        ref={iframeRef}
        onFullyLoaded={handleFountainReady}
        onDonateClick={(charity) => {
          setPreselectedCharity(charity);
          setShowDonationModal(true);
        }}
      />

      {/* UI Overlay - Our Lady of Perpetual Profit Logo (Desktop) / RL80 (Mobile) */}
      {fontLoaded && !isMobileView && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          minHeight: '100vh',
          zIndex: 10001,
          pointerEvents: 'none',
          opacity: fontLoaded ? 1 : 0,
          transition: 'opacity 0.5s ease-in-out',
        }}>
          <div style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            // paddingTop: '2rem',
            minHeight: '100vh',
            pointerEvents: 'none',
          }}>
            
            <h1 className='custom-title'
                id="main-title"
                style={{ 
                position: "relative",
                left: "2rem",
                top: "-2rem",
                color: is80sMode ? "#ffffff" : "#f6f5f1ff",
                fontFamily: 'UnifrakturCook, serif',
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
                    0 0 10px rgba(212, 175, 55, 0.8),
                    0 0 20px rgba(212, 175, 55, 0.6),
                    0 0 30px rgba(212, 175, 55, 0.8),
                    6px 6px 16px rgba(0, 0, 0, 1),
                    -2px -2px 8px rgba(255, 192, 203, 0.7),
                    0 0 100px rgba(212, 175, 55, 0.1)
                  `,
                fontSize: "3.5rem",
                fontWeight: 900,
                lineHeight: 0.8,
                transform: "rotate(-8deg) skew(-15deg)",
                zIndex: 1000,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                marginTop: '1rem',
                pointerEvents: 'auto',
              }}
              // onClick={() => window.location.href = '/about'}
            >
              <span className="title-line" style={{ display: 'block', position: 'relative' }}>Our Lady</span>
              <span className="title-line" style={{ display: 'block', position: 'relative' }}>
                <span style={{ fontSize: "2rem" }}>of    </span>
                Perpetual
              </span>
              <span className="title-line" style={{ display: 'block', marginLeft: "4rem", position: 'relative' }}>Profit</span>
            </h1>

          </div>
        </div>
      )}
      
      {/* RL80 Logo - Mobile Only */}
      {fontLoaded && isMobileView && (
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
              fontSize: "3rem",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            <Link href="/about" style={{ textDecoration: 'none', color: 'inherit', display: 'inline-block' }}>
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
      )}

      {/* Nav Controls - Top Right (desktop only) */}
      {!isMobileDevice && (
        <div style={{
          position: "absolute",
          top: "1rem",
          right: "1rem",
          zIndex: 30000,
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
            onBuyClick={() => setShowBuyModal(true)}
          />
        </div>
      )}

      {/* Mobile: 80s button top-right + bottom nav */}
      {isMobileDevice && (
        <>
          <button
            onClick={() => setContext80sMode(!is80sMode)}
            title={is80sMode ? "Disable 80s Mode" : "Enable 80s Mode"}
            style={{
              position: "absolute",
              top: "calc(1rem + env(safe-area-inset-top))",
              right: "1rem",
              zIndex: 30000,
              width: "auto",
              height: 40,
              minWidth: 40,
              minHeight: 40,
              padding: "0 8px",
              borderRadius: 10,
              background: is80sMode
                ? "rgba(255, 0, 255, 0.1)"
                : "rgba(212, 175, 55, 0.05)",
              border: `1.5px solid ${is80sMode ? "rgba(255, 0, 255, 0.4)" : "rgba(212, 175, 55, 0.2)"}`,
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: is80sMode
                ? "0 0 15px rgba(255, 0, 255, 0.3)"
                : "none",
            }}
          >
            <span style={{
              fontSize: 12,
              fontWeight: "bold",
              color: is80sMode ? "#00ff41" : "#67e8f9",
              textShadow: is80sMode ? "0 0 10px #00ff41" : "none",
              fontFamily: "'Orbitron', monospace",
              lineHeight: 0.9,
            }}>80s</span>
            <span style={{
              fontSize: "0.5rem",
              fontWeight: "bold",
              color: is80sMode ? "#00ff41" : "#67e8f9",
              textShadow: is80sMode ? "0 0 10px #00ff41" : "none",
              fontFamily: "'Orbitron', monospace",
            }}>MODE</span>
          </button>

          <MobileBottomNav
            isPlaying={contextIsPlaying}
            onPlayMusic={() => play()}
            onStopMusic={() => pause()}
            onSkipTrack={() => nextTrack()}
            onMenuClick={() => setIsMenuOpen(!isMenuOpen)}
            onUserClick={() => {}}
            isUserSignedIn={!!user}
            isMenuOpen={isMenuOpen}
            is80sMode={is80sMode}
            userImage={user?.imageUrl}
            onBuyClick={() => setShowBuyModal(true)}
            isMobile
            show80sButton={false}
          />
        </>
      )}
      
      {/* CyberNav Menu Panel */}
      <CyberNav
        is80sMode={is80sMode}
        position="fixed"
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        showButton={false}
      />

      {/* Thirdweb Buy Modal */}
      <BuyModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
      />

      {/* Donation Modal */}
      <FountainDonationModal
        isOpen={showDonationModal}
        onClose={() => {
          setShowDonationModal(false);
          setPreselectedCharity(null);
        }}
        preselectedCharity={preselectedCharity}
        onDonationComplete={(donation) => {
          // Optionally notify the iframe about the successful donation
          if (iframeRef.current) {
            try {
              iframeRef.current.contentWindow.postMessage(
                { type: 'donationComplete', donation },
                '*'
              );
            } catch (e) {
            }
          }
        }}
      />

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