"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useUser, SignInButton, UserButton } from '@clerk/nextjs';
import { useMusic } from '@/components/MusicContext';
import CoinLoader from '@/components/CoinLoader';
import CyberNav from '@/components/CyberNav';
import CompactCandleModal from '@/components/CompactCandleModal';
import NavControlsHome from '@/components/NavControlsHome';
import MobileBottomNav from '@/components/MobileBottomNav';
import ThirdwebBuyModal from '@/components/ThirdwebBuyModal';

const Philosophy = dynamic(() => import('@/components/Philosophy'), {
  ssr: false,
  loading: () => <CoinLoader loading={true} />
});

export default function ModelViewerPage() {
  const { user, isSignedIn } = useUser();
  const [isMobileDevice, setIsMobileDevice] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  const { 
    play, 
    pause, 
    isPlaying: contextIsPlaying, 
    nextTrack, 
    currentTrack, 
    is80sMode: context80sMode, 
    setIs80sMode: setContext80sMode
  } = useMusic();
  const [showCandleModal, setShowCandleModal] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const is80sMode = context80sMode;

  
  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth <= 768;
      setIsMobileDevice(isMobile);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Prevent scroll on this page
  // useEffect(() => {
  //   document.body.style.overflow = "hidden";
  //   document.documentElement.style.overflow = "hidden";
  //   return () => {
  //     document.body.style.overflow = "";
  //     document.documentElement.style.overflow = "";
  //   };
  // }, []);


  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh' }}>
      <Philosophy
        modelPath="/models/saint_robot2.glb"
        onLoadingChange={setIsPageLoading}
        is80sMode={is80sMode}
      />
      
      {/* Nav Controls */}
      {!isPageLoading && (
        <>
          {/* Desktop: full NavControlsHome top-right */}
          {!isMobileDevice && (
            <div style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              zIndex: 10000,
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

          {/* Mobile: 80s mode button top-right + bottom nav bar */}
          {isMobileDevice && (
            <>
              <button
                onClick={() => setContext80sMode(!is80sMode)}
                title={is80sMode ? "Disable 80s Mode" : "Enable 80s Mode"}
                style={{
                  position: "absolute",
                  top: "calc(1rem + env(safe-area-inset-top))",
                  right: "1rem",
                  zIndex: 10000,
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
                darkMode
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
          <ThirdwebBuyModal
            isOpen={showBuyModal}
            onClose={() => setShowBuyModal(false)}
          />
        </>
      )}

      {/* Buy Token FAB (optional - uncomment if needed) */}
      {/* <div onClick={() => setShowCandleModal(true)}>
        <BuyTokenFAB is80sMode={is80sMode} />
      </div> */}

      {/* Candle Modal - Hidden while loading */}
      {!isPageLoading && showCandleModal && (
        <CompactCandleModal
          isOpen={showCandleModal}
          onClose={() => setShowCandleModal(false)}
        />
      )}

      {/* Animation Styles */}
      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}