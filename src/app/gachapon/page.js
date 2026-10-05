"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import NavControlsHome from '@/components/NavControlsHome';
import MobileBottomNav from '@/components/MobileBottomNav';
import CyberNav from '@/components/CyberNav';
import BuyModal from '@/components/BuyModal';
import { useUser } from '@clerk/nextjs';
import { useMusic } from '@/components/MusicContext';
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
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  const { user } = useUser();

  // Music context
  const {
    play,
    pause,
    isPlaying: contextIsPlaying,
    nextTrack,
    is80sMode: context80sMode,
    setIs80sMode: setContext80sMode
  } = useMusic();

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

      {/* Nav Controls - Top Right (desktop only) */}
      {!isMobileDevice && (
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
          is80sMode={context80sMode}
          userImage={user?.imageUrl}
          onBuyClick={() => setShowBuyModal(true)}
          isMobile
          show80sButton={false}
          darkMode
        />
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

      {/* CyberNav Menu Panel */}
      <CyberNav
        is80sMode={context80sMode}
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
    </div>
  );
}
