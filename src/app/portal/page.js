"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useMusic } from '@/components/MusicContext';
import CyberNav from '@/components/CyberNav';
import NavControlsHome from '@/components/NavControlsHome';
import SkewedHeading from '@/components/SkewedHeading';
import { useUser } from '@clerk/nextjs';

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

      {/* Nav Controls - Top Right */}
      <div style={{
        position: "fixed",
        top: isMobile ? "calc(1rem + env(safe-area-inset-top))" : "1rem",
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
            fontSize={isSmallPhone ? "1.6rem" : isMobilePhone ? "2.2rem" : "3rem"}
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
