"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useUser, SignInButton, UserButton } from '@clerk/nextjs';
import { useMusic } from '@/components/MusicContext';
import CoinLoader from '@/components/CoinLoader';
import CyberNav from '@/components/CyberNav';
import CompactCandleModal from '@/components/CompactCandleModal';
import NavControlsHome from '@/components/NavControlsHome';
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


  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <Philosophy
        modelPath="/models/saint_robot3.glb"
        onLoadingChange={setIsPageLoading}
        is80sMode={is80sMode}
      />
      
      {/* Nav Controls */}
      {!isPageLoading && (
        <>
          <div style={{
            position: "absolute",
            top: isMobileDevice ? "calc(1rem + env(safe-area-inset-top))" : "1rem",
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
              isMobile={isMobileDevice}
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