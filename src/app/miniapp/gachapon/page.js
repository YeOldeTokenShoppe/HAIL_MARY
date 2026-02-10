"use client";

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAccount } from 'wagmi';
import { useFarcasterContext } from '@/lib/farcaster/FarcasterProvider';
import { useWeeklyPrizeFarcaster } from '@/hooks/useWeeklyPrizeFarcaster';
import CoinLoader from '@/components/CoinLoader';
import sdk from '@farcaster/miniapp-sdk';

// Dynamic import for the VendingMachine scene (avoid SSR with Three.js)
const VendingMachineCanvas = dynamic(
  () => import('@/components/VendingMachine').then(mod => {
    // We need both the default export's Canvas setup and the named exports
    // Return a wrapper component that uses the named exports
    const { VendingSceneInner, PrizeStatusBar, ClaimSuccessModal } = mod;
    const { Canvas } = require('@react-three/fiber');
    const { Suspense } = require('react');

    function MiniappVendingScene({
      onToyClick,
      onZoomComplete,
      resetKey,
      modelPath,
      disabled,
      currentPrize,
      claimStatus,
      remainingClaims,
      eligibilityDetails,
      showClaimButton,
      showSuccessModal,
      claimedPrize,
      onSuccessClose,
      isClaimLoading,
      onSharePrize,
      onModelReady,
    }) {
      return (
        <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <style>{`
            @keyframes claimButtonPulse {
              0%, 100% {
                transform: scale(1);
                box-shadow: 0 0 30px rgba(0, 245, 212, 0.5), 0 0 60px rgba(0, 245, 212, 0.3);
              }
              50% {
                transform: scale(1.02);
                box-shadow: 0 0 40px rgba(0, 245, 212, 0.7), 0 0 80px rgba(0, 245, 212, 0.4);
              }
            }
          `}</style>

          {/* Main vending machine canvas */}
          <div style={{ flex: 1, position: 'relative' }}>
            <Canvas
              shadows
              gl={{ antialias: true, alpha: true }}
              camera={{
                fov: 45,
                position: [0, 0.4, 2.1],
                near: 0.1,
                far: 500
              }}
              style={{
                width: '100%',
                height: '100%',
                background: 'transparent',
              }}
            >
              <Suspense fallback={null}>
                <VendingSceneInner
                  onToyClick={onToyClick}
                  onZoomComplete={onZoomComplete}
                  resetKey={resetKey}
                  capsuleColorIndex={0}
                  modelPath={modelPath}
                  disabled={disabled}
                  onModelReady={onModelReady}
                />
              </Suspense>
            </Canvas>

            {/* Click to Claim button */}
            {showClaimButton && claimStatus === 'available' && (
              <div style={{
                position: 'absolute',
                bottom: '20%',
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'auto',
                zIndex: 10,
              }}>
                <button
                  onClick={onToyClick}
                  disabled={isClaimLoading}
                  style={{
                    padding: '1rem 2.5rem',
                    background: 'linear-gradient(135deg, #00f5d4, #00bbf9)',
                    border: 'none',
                    borderRadius: '50px',
                    color: '#000',
                    fontFamily: "'Orbitron', monospace",
                    fontSize: '1rem',
                    fontWeight: '700',
                    cursor: isClaimLoading ? 'wait' : 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    boxShadow: '0 0 30px rgba(0, 245, 212, 0.5), 0 0 60px rgba(0, 245, 212, 0.3)',
                    animation: 'claimButtonPulse 2s ease-in-out infinite',
                    opacity: isClaimLoading ? 0.7 : 1,
                  }}
                >
                  {isClaimLoading ? 'Claiming...' : 'Click to Claim'}
                </button>
              </div>
            )}

            {/* Claimed overlay */}
            {disabled && claimStatus === 'claimed' && (
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <div style={{
                  background: 'rgba(0, 255, 136, 0.1)',
                  border: '1px solid rgba(0, 255, 136, 0.3)',
                  borderRadius: '10px',
                  padding: '1rem 2rem',
                  color: '#00ff88',
                  fontFamily: "'Orbitron', monospace",
                  fontSize: '0.9rem',
                  textAlign: 'center',
                }}>
                  Prize Collected!
                </div>
              </div>
            )}
          </div>

          {/* Prize status bar */}
          <PrizeStatusBar
            currentPrize={currentPrize}
            claimStatus={claimStatus}
            remainingClaims={remainingClaims}
            eligibilityDetails={eligibilityDetails}
            onSignIn={() => {}} // No-op in Farcaster (auto-signed in)
            onConnectWallet={() => {}} // No-op in Farcaster (auto-connected)
          />

          {/* Success modal with share */}
          <ClaimSuccessModal
            isOpen={showSuccessModal}
            prize={claimedPrize}
            onClose={onSuccessClose}
            isMiniApp={true}
          />

          {/* Share button overlay when success modal is showing */}
          {showSuccessModal && claimedPrize && (
            <div style={{
              position: 'fixed',
              bottom: '100px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10001,
            }}>
              <button
                onClick={onSharePrize}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
                  border: '2px solid rgba(139, 92, 246, 0.5)',
                  borderRadius: '50px',
                  color: '#fff',
                  fontFamily: "'Orbitron', monospace",
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px',
                  boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>&#9993;</span>
                Share on Warpcast
              </button>
            </div>
          )}
        </div>
      );
    }

    return MiniappVendingScene;
  }),
  {
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
  }
);

export default function MiniappGachaponPage() {
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [claimedPrize, setClaimedPrize] = useState(null);
  const [showClaimButton, setShowClaimButton] = useState(false);

  // Farcaster context
  const { context: fcContext } = useFarcasterContext();
  const farcasterFid = fcContext?.user?.fid?.toString();
  const farcasterUsername = fcContext?.user?.username;

  // Wagmi wallet
  const { address: walletAddress } = useAccount();

  // Prize hook (Farcaster-adapted)
  const weeklyPrize = useWeeklyPrizeFarcaster({
    farcasterFid,
    farcasterUsername,
    walletAddress,
  });

  const {
    currentPrize,
    claimStatus,
    remainingClaims,
    claimPrize,
    isClaimLoading,
    eligibilityDetails,
  } = weeklyPrize;

  const isDialDisabled = claimStatus !== 'available';
  const modelPath = currentPrize?.modelPath || '/models/ipadMaryToy.glb';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Font preload
  useEffect(() => {
    const checkFont = async () => {
      try {
        await document.fonts.ready;
        const fontCheck = await document.fonts.load("1em 'UnifrakturCook'");
        if (fontCheck.length > 0) {
          setFontLoaded(true);
          document.documentElement.classList.add('fonts-loaded');
        } else {
          setTimeout(() => {
            setFontLoaded(true);
            document.documentElement.classList.add('fonts-loaded');
          }, 2000);
        }
      } catch {
        setTimeout(() => {
          setFontLoaded(true);
          document.documentElement.classList.add('fonts-loaded');
        }, 2000);
      }
    };
    checkFont();
  }, []);

  // Model ready callback from the 3D scene
  const handleModelReady = useCallback(() => {
    setModelLoaded(true);
  }, []);

  // Fallback timer in case model load callback never fires
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setModelLoaded(true);
    }, 10000);
    return () => clearTimeout(fallbackTimer);
  }, []);

  // Loading complete
  useEffect(() => {
    if (mounted && fontLoaded && modelLoaded) {
      const timer = setTimeout(() => setIsLoading(false), 500);
      return () => clearTimeout(timer);
    }
  }, [mounted, fontLoaded, modelLoaded]);

  const handleZoomComplete = useCallback((isComplete) => {
    setShowClaimButton(isComplete);
  }, []);

  const handleToyClick = useCallback(async () => {
    if (claimStatus !== 'available' || isClaimLoading) {
      setResetKey(prev => prev + 1);
      return;
    }

    try {
      const claim = await claimPrize();
      setClaimedPrize({
        name: currentPrize.name,
        description: currentPrize.description,
        modelPath: currentPrize.modelPath,
        icon: currentPrize.previewConfig?.icon,
        edition: claim?.claimNumber,
        maxEditions: currentPrize.maxClaims || 80,
      });
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Failed to claim prize:', error);
    }

    setResetKey(prev => prev + 1);
  }, [claimStatus, isClaimLoading, claimPrize, currentPrize]);

  const handleSuccessClose = useCallback(() => {
    setShowSuccessModal(false);
    setClaimedPrize(null);
  }, []);

  const handleSharePrize = useCallback(() => {
    if (!claimedPrize) return;

    const edition = weeklyPrize.claimCount;
    const shareUrl = `${window.location.origin}/miniapp/gachapon/share?prize=${encodeURIComponent(currentPrize?.id || '')}&edition=${edition}`;

    sdk.actions.composeCast({
      text: `I claimed "${claimedPrize.name}" #${edition}/80 from the RL80 Gachapon Machine!`,
      embeds: [shareUrl],
    });
  }, [claimedPrize, weeklyPrize.claimCount, currentPrize]);

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
        <CoinLoader loading={isLoading} />

        {/* RL80 Logo - Top Left (hidden during zoom/claim view) */}
        {!isLoading && !showClaimButton && (
          <div style={{
            position: "fixed",
            top: "20px",
            left: "0.5rem",
            borderRadius: "8px",
            padding: "10px",
            pointerEvents: "none",
            zIndex: 10,
          }}>
            <div
              style={{
                position: "relative",
                fontFamily: "'UnifrakturMaguntia', serif",
                fontSize: "3rem",
                color: "#ffffff",
                userSelect: "none",
              }}
            >
              RL80
              {Array.from({length: 100}).map((_, i) => {
                const index = i + 1;
                return (
                  <div
                    key={index}
                    style={{
                      position: "absolute",
                      pointerEvents: "none",
                      zIndex: -1,
                      top: 0,
                      left: 0,
                      color: `rgba(${201 - index * 2}, ${55 - index * 3}, ${256 - index * 2})`,
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

        {!isLoading && (
          <div style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            top: 0,
            left: 0,
          }}>
            <VendingMachineCanvas
              onToyClick={handleToyClick}
              onZoomComplete={handleZoomComplete}
              resetKey={resetKey}
              modelPath={modelPath}
              disabled={isDialDisabled}
              currentPrize={currentPrize}
              claimStatus={claimStatus}
              remainingClaims={remainingClaims}
              eligibilityDetails={eligibilityDetails}
              showClaimButton={showClaimButton}
              showSuccessModal={showSuccessModal}
              claimedPrize={claimedPrize}
              onSuccessClose={handleSuccessClose}
              isClaimLoading={isClaimLoading}
              onSharePrize={handleSharePrize}
              onModelReady={handleModelReady}
            />
          </div>
        )}
      </div>
  );
}
