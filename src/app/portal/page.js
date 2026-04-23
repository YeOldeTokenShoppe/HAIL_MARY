"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useMusic } from '@/components/MusicContext';
import CyberNav from '@/components/CyberNav';
import NavControlsHome from '@/components/NavControlsHome';
import MobileBottomNav from '@/components/MobileBottomNav';
import SkewedHeading from '@/components/SkewedHeading';
import { useUser } from '@clerk/nextjs';
import Link from "next/link";
import BuyModal from '@/components/BuyModal';


const OldsCoolTunnel = dynamic(() => import('@/components/OldsCoolTunnel'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#000',
      color: '#00ff9d',
      fontFamily: "'Courier New', monospace",
      fontSize: '0.9rem',
    }}>
      Loading portal...
    </div>
  )
});

export default function PortalPage() {
  const { user } = useUser();
  const {
    play,
    pause,
    isPlaying: contextIsPlaying,
    nextTrack,
    is80sMode: context80sMode,
    setIs80sMode: setContext80sMode
  } = useMusic();
  const is80sMode = context80sMode;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobilePhone, setIsMobilePhone] = useState(false);
  const [isSmallPhone, setIsSmallPhone] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [deviceDetected, setDeviceDetected] = useState(false);
  const [isTabletPortrait, setIsTabletPortrait] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 480 && window.innerWidth <= 1024 && window.innerHeight > window.innerWidth : false)
  const [showBuyModal, setShowBuyModal] = useState(false)
  
  
  

  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width <= 768);
      setIsMobilePhone(width <= 480);
      setIsSmallPhone(window.innerHeight <= 700);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
      const handleResize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const isPortrait = height > width;
  
        // Detect if it's likely an iPad (including iPad Mini)
        const isIPad = /iPad/.test(navigator.userAgent) ||
                       (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  
        // Phone breakpoint - only true phones, not tablets even in portrait
        const isPhone = width < 480 && !isIPad;
  
        setIsMobileDevice(isPhone);
        setDeviceDetected(true);
      };
  
      if (typeof window !== 'undefined') {
        handleResize();
      }
  
      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', handleResize);
  
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
      };
    }, []);
  

  return (
    <div style={{
      background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #000 100%)',
      height: '100vh',
      width: '100vw',
      margin: 0,
      padding: 0,
      position: 'fixed',
      left: 0,
      top: 0,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes glow {
          0%, 100% { text-shadow: 0 0 30px rgba(255, 215, 0, 0.5), 2px 2px 4px rgba(0, 0, 0, 0.8); }
          50% { text-shadow: 0 0 60px rgba(255, 215, 0, 0.9), 2px 2px 4px rgba(0, 0, 0, 0.8); }
        }
      `}</style>
      <style dangerouslySetInnerHTML={{ __html: `
        @font-face {
          font-family: 'UnifrakturMaguntia';
          src: url('/fonts/UnifrakturMaguntia-Regular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'UnifrakturCook';
          src: url('/fonts/UnifrakturCook-Bold.ttf') format('truetype');
          font-weight: bold;
          font-style: normal;
          font-display: swap;
        }
        #text, .text__copy {
          font-family: 'UnifrakturMaguntia', serif !important;
        }
      `}} />

      {/* RL80 Logo - Mobile Only */}
      {deviceDetected && isMobileDevice && (
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
        </div>
      )}

      {/* Our Lady of Perpetual Profit Logo - Non-Mobile */}
      {deviceDetected && !isMobileDevice && (
        <h1 className='custom-title'
          style={{
                position: 'absolute',
                top: '2rem',
                left: '1.5rem',
                pointerEvents: 'auto',
                color: is80sMode ? "#ffffff" : "#d4af37",
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
                fontSize: isTabletPortrait ? "2rem" : "2rem",
                fontWeight: 900,
                lineHeight: 0.8,
                transform: "rotate(-8deg) skew(-15deg)",
                cursor: 'pointer',
                margin: 0,
                zIndex: 50
              }}
        >
          <Link href="/#final" style={{ textDecoration: 'none', color: 'inherit' }}>
            <span className="title-line" style={{ display: 'block', position: 'relative' }}>Our Lady</span>
            <span className="title-line" style={{ display: 'block', position: 'relative' }}>
              <span style={{ fontSize: "2rem" }}>of    </span>
              Perpetual
            </span>
            <span className="title-line" style={{ display: 'block', marginLeft: "4rem", position: 'relative' }}>Profit</span>
          </Link>
        </h1>
      )}


      {/* Nav Controls - Top Right (desktop only) */}
      {!isMobileDevice && (
        <div style={{
          position: "fixed",
          top: "1rem",
          right: "1rem",
          zIndex: 300,
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
            show80sButton={false}
          />
        </div>
      )}

      {/* Mobile Bottom Nav */}
      {isMobileDevice && (
        <MobileBottomNav
          isPlaying={contextIsPlaying}
          onPlayMusic={() => play()}
          onStopMusic={() => pause()}
          onSkipTrack={() => nextTrack()}
          onMenuClick={() => setIsMenuOpen(!isMenuOpen)}
          onUserClick={() => {}}
          isUserSignedIn={!!user}
          isMenuOpen={isMenuOpen}
          userImage={user?.imageUrl}
          onBuyClick={() => setShowBuyModal(true)}
          isMobile
          show80sButton={false}
          darkMode
        />
      )}

      {/* CyberNav Menu Panel */}
      <CyberNav
        is80sMode={is80sMode}
        position="fixed"
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        showButton={false}
      />

      {/* Buy Modal */}
      <BuyModal
        isOpen={showBuyModal}
        onClose={() => setShowBuyModal(false)}
      />

      {/* Fullscreen OldsCoolTunnel */}
      {isFullscreen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 9999,
          background: is80sMode ? 'transparent' : '#000',
        }}>
          <OldsCoolTunnel isFullscreen={true} />
          <button
            onClick={() => setIsFullscreen(false)}
            style={{
              position: 'fixed',
              top: '1rem',
              left: '1rem',
              zIndex: 10000,
              background: 'rgba(0,0,0,0.7)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              color: '#fff',
              padding: '8px 16px',
              cursor: 'pointer',
              fontFamily: "'Courier New', monospace",
              fontSize: '0.9rem',
            }}
          >
            ← Back
          </button>
        </div>
      )}

      {/* Main Content */}
      {!isFullscreen && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          padding: '2rem',
          overflow: 'hidden',
        }}>
          {/* Heading */}
          <SkewedHeading
            lines={["A TIMELESS", "ICON FOR THE", "DIGITAL AGE"]}
            fontSize={isSmallPhone ? "1.6rem" : isMobilePhone ? "2.2rem" : "2.5rem"}
            color="#00ff9d"
            skewAngle={0}
            shadowColor="#000"
          />

          {/* Portal Preview Container with Frame Image */}
          <div
            onClick={() => setIsFullscreen(true)}
            style={{
              position: 'relative',
              width: '90%',
              marginTop: '5%',
              minWidth: '18rem',
              maxWidth: isSmallPhone ? 'min(280px, 95vw)' : isMobilePhone ? 'min(380px, 95vw)' : '450px',
              aspectRatio: '4/3',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              transform: `perspective(1000px) rotateX(5deg) scale(${isSmallPhone ? 0.85 : 1})`,
              filter: 'drop-shadow(0 0 30px rgba(255, 215, 0, 0.5))',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'perspective(1000px) rotateX(2deg) scale(1.05)';
              e.currentTarget.style.filter = 'drop-shadow(0 0 60px rgba(255, 215, 0, 0.9)) brightness(1.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'perspective(1000px) rotateX(5deg) scale(1)';
              e.currentTarget.style.filter = 'drop-shadow(0 0 40px rgba(255, 215, 0, 0.6)) brightness(1)';
            }}
          >
            {/* Portal frame image */}
            <img
              src="/images/timePortal.webp"
              alt="Time Portal"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                zIndex: 2,
                pointerEvents: 'none',
              }}
            />

            {/* OldsCoolTunnel animation inside the frame */}
            <div style={{
              position: 'absolute',
              top: '7%',
              left: '13%',
              width: '75%',
              height: '75%',
              overflow: 'hidden',
              background: is80sMode ? 'rgba(0, 0, 0, 0.7)' : '#000',
              borderRadius: '2px',
              boxShadow: 'inset 0 0 50px rgba(0, 0, 0, 0.8)',
              transformStyle: 'preserve-3d',
              perspective: '800px',
            }}>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '300%',
                height: 'auto',
                transform: `
                  translate(-50%, -50%)
                  rotateX(-5deg)
                  rotateY(2deg)
                  rotateZ(-2deg)
                  scale(0.3)
                `,
                transformOrigin: 'center center',
              }}>
                <OldsCoolTunnel isFullscreen={false} />
              </div>
            </div>
          </div>

          {/* Content below portal */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}>
            {/* Tap to enter + whitepaper link */}
            <p style={{
              marginTop: '1.5rem',
              marginBottom: '1rem',
              fontFamily: "'Courier New', monospace",
              fontSize: isMobilePhone ? '1rem' : '0.9rem',
              color: '#888',
              textAlign: 'center',
              lineHeight: '1.4',
            }}>
              <span style={{
                color: '#01ff00',
                textAlign: 'center',
                animation: 'pulse 2s ease-in-out infinite',
              }}>Tap to enter</span> • <a href="/philosophy" style={{ color: '#ffff00', textDecoration: 'underline' }}>Read whitepaper</a>
            </p>

            {/* Description */}
            <p style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize: '1rem',
              color: 'rgba(255, 255, 255, 0.85)',
              lineHeight: '1.3',
              marginTop: '-.5rem',
              maxWidth: isMobilePhone ? '320px' : '450px',
              textAlign: 'center',
              padding: '0 1rem',
            }}>
              Journey through time to see some of Our Lady&apos;s great moments.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
