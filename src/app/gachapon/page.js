"use client";

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import NavControlsHome from '@/components/NavControlsHome';
import CyberNav from '@/components/CyberNav';
import { UnifiedAccountModal } from '@/components/UnifiedAccountModal';
import ThirdwebBuyModal from '@/components/ThirdwebBuyModal';
import { useClerk, useUser } from '@clerk/nextjs';
import { useWalletAuth } from '@/components/WalletAuthProvider';
import { useMusic } from '@/components/MusicContext';
import { useWeeklyPrize } from '@/hooks/useWeeklyPrize';
import CoinLoader from '@/components/CoinLoader';


// Dynamic import to avoid SSR issues with Three.js
const VendingMachineScene = dynamic(() => import('@/components/VendingMachine'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontFamily: 'monospace'
    }}>
      Loading...
    </div>
  )
});

export default function GachaponPage() {
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountModalTab, setAccountModalTab] = useState('wallet');
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  const clerk = useClerk();
  const { user } = useUser();
  const { isWalletConnected } = useWalletAuth();
  const wasOpenedForWallet = useRef(false);

  // Music context
  const {
    play,
    pause,
    isPlaying: contextIsPlaying,
    nextTrack,
    is80sMode: context80sMode,
    setIs80sMode: setContext80sMode
  } = useMusic();

  // Weekly prize for new collectible call-out
  // Drops not enabled yet — badge hidden until first drop is live
  const weeklyPrize = useWeeklyPrize();
  const currentPrize = null;
  const claimStatus = 'no_prize';
  const [showCallout, setShowCallout] = useState(true);

  useEffect(() => {
    setMounted(true);
    // Detect mobile device
    const checkMobile = () => {
      setIsMobileDevice(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Check if UnifrakturCook font is loaded
  useEffect(() => {
    const checkFont = async () => {
      try {
        // Wait for all fonts to be ready first
        await document.fonts.ready;
        // Then specifically check for UnifrakturCook
        const fontCheck = await document.fonts.load("1em 'UnifrakturCook'");
        if (fontCheck.length > 0) {
          setFontLoaded(true);
          document.documentElement.classList.add('fonts-loaded');
        } else {
          // Font not found, wait a bit and try again or give up
          setTimeout(() => {
            setFontLoaded(true);
            document.documentElement.classList.add('fonts-loaded');
          }, 2000);
        }
      } catch (e) {
        // Fallback after delay
        setTimeout(() => {
          setFontLoaded(true);
          document.documentElement.classList.add('fonts-loaded');
        }, 2000);
      }
    };
    checkFont();
  }, []);

  // Preload the GLB model
  useEffect(() => {
    let isCancelled = false;

    const preloadModel = async () => {
      try {
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const { DRACOLoader } = await import('three/examples/jsm/loaders/DRACOLoader.js');

        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

        const loader = new GLTFLoader();
        loader.setDRACOLoader(dracoLoader);

        loader.load(
          '/models/toyVENDnft.glb',
          () => {
            // Model loaded successfully
            if (!isCancelled) {
              setModelLoaded(true);
            }
            dracoLoader.dispose();
          },
          undefined,
          (error) => {
            console.warn('Failed to preload model:', error);
            // Still mark as loaded to not block the page
            if (!isCancelled) {
              setModelLoaded(true);
            }
            dracoLoader.dispose();
          }
        );
      } catch (e) {
        console.warn('Error loading GLTFLoader:', e);
        if (!isCancelled) {
          setModelLoaded(true);
        }
      }
    };

    preloadModel();

    // Fallback timeout in case model takes too long
    const fallbackTimer = setTimeout(() => {
      setModelLoaded(true);
    }, 10000); // 10 second max wait

    return () => {
      isCancelled = true;
      clearTimeout(fallbackTimer);
    };
  }, []);

  // Handle loading state - wait for mount, font, AND model
  useEffect(() => {
    if (mounted && fontLoaded && modelLoaded) {
      // Add a small delay for smooth transition
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [mounted, fontLoaded, modelLoaded]);

  // Listen for custom events from VendingMachine to open wallet/sign-in
  useEffect(() => {
    const handleOpenWalletConnection = () => {
      // If wallet is already connected, no need to show the modal
      if (isWalletConnected) {
        return;
      }
      wasOpenedForWallet.current = true;
      setAccountModalTab('wallet');
      setShowAccountModal(true);
    };

    const handleOpenSignIn = () => {
      clerk.openSignIn();
    };

    window.addEventListener('openWalletConnection', handleOpenWalletConnection);
    window.addEventListener('openSignIn', handleOpenSignIn);

    return () => {
      window.removeEventListener('openWalletConnection', handleOpenWalletConnection);
      window.removeEventListener('openSignIn', handleOpenSignIn);
    };
  }, [clerk, isWalletConnected]);

  // Auto-close the modal when wallet becomes connected (if it was opened for wallet connection)
  useEffect(() => {
    if (isWalletConnected && showAccountModal && wasOpenedForWallet.current) {
      setShowAccountModal(false);
      wasOpenedForWallet.current = false;
    }
  }, [isWalletConnected, showAccountModal]);

  return (
    <div style={{
      backgroundColor: "#0a0a0a",
      height: "100dvh",
      width: "100vw",
      margin: 0,
      padding: 0,
      position: "fixed",
      left: 0,
      top: 0,
      overflow: "hidden",
    }}>
      {/* CoinLoader */}
      <CoinLoader loading={isLoading} />

      {/* RL80 Logo - Top Left */}
      <div style={{
        position: "fixed",
        top: "20px",
        left: "0.5rem",
        borderRadius: "8px",
        padding: "10px",
        pointerEvents: "auto",
        zIndex: 10,
      }}>
        <Link href="/about" style={{ textDecoration: 'none' }}>
          <div
            id="text"
            style={{
              position: "relative",
              fontFamily: "'UnifrakturMaguntia', serif",
              fontSize: "3rem",
              color: "#ffffff",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            RL80
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
                    color: `rgba(${201 - index * 2}, ${55 - index * 3}, ${256 - index * 2})`,
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
        </Link>
      </div>

      {/* Nav Controls - Top Right */}
      <div style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 100,
        pointerEvents: "auto",
      }}>
        <NavControlsHome
          isPlaying={contextIsPlaying}
          onPlayMusic={() => play()}
          onStopMusic={() => pause()}
          onSkipTrack={() => nextTrack()}
          onMenuClick={() => setIsMenuOpen(!isMenuOpen)}
          isUserSignedIn={!!user}
          isMenuOpen={isMenuOpen}
          is80sMode={context80sMode}
          onToggle80sMode={() => setContext80sMode(!context80sMode)}
          userImage={user?.imageUrl}
          onBuyClick={() => setShowBuyModal(true)}
          isMobile={isMobileDevice}
          show80sButton={false}
        />
      </div>

      {/* New Collectible Call-out - Simple badge (shown when a prize is actively available) */}
      {showCallout && currentPrize && (claimStatus === 'available' || claimStatus === 'ineligible') && (
        <>
          <style>{`
            @keyframes badgeBounce {
              0%, 100% { transform: translateX(-50%) translateY(0); }
              50% { transform: translateX(-50%) translateY(-4px); }
            }
            @keyframes badgeGlow {
              0%, 100% { box-shadow: 0 0 15px rgba(0, 245, 212, 0.5), 0 4px 15px rgba(0, 0, 0, 0.3); }
              50% { box-shadow: 0 0 25px rgba(0, 245, 212, 0.7), 0 4px 20px rgba(0, 0, 0, 0.4); }
            }
          `}</style>
          <div
            style={{
              position: 'fixed',
              bottom: '100px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 500,
              animation: 'badgeBounce 2s ease-in-out infinite, badgeGlow 2s ease-in-out infinite',
              background: 'linear-gradient(135deg, #00f5d4, #00d4aa)',
              borderRadius: '20px',
              padding: '8px 12px 8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '1rem' }}>✨</span>
            <span style={{
              color: '#000',
              fontFamily: "'Orbitron', monospace",
              fontSize: '0.7rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}>
              New Drop!
            </span>
            <button
              onClick={() => setShowCallout(false)}
              style={{
                background: 'rgba(0, 0, 0, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '18px',
                height: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(0, 0, 0, 0.6)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                transition: 'all 0.2s',
                marginLeft: '2px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)';
                e.currentTarget.style.color = '#000';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.2)';
                e.currentTarget.style.color = 'rgba(0, 0, 0, 0.6)';
              }}
            >
              ×
            </button>
          </div>
        </>
      )}

      {!isLoading && (
        <div style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
        }}>
          <VendingMachineScene />
        </div>
      )}

      {/* Account Modal - for wallet connection from status bar */}
      <UnifiedAccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        initialTab={accountModalTab}
      />

      {/* CyberNav Menu Panel */}
      <CyberNav
        is80sMode={context80sMode}
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
    </div>
  );
}
