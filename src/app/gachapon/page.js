"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import NavControlsHome from '@/components/NavControlsHome';
import { UnifiedAccountModal } from '@/components/UnifiedAccountModal';
import { useClerk } from '@clerk/nextjs';


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

export default function ToasterPage() {
  const [mounted, setMounted] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountModalTab, setAccountModalTab] = useState('wallet');
  const clerk = useClerk();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Listen for custom events from VendingMachine to open wallet/sign-in
  useEffect(() => {
    const handleOpenWalletConnection = () => {
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
  }, [clerk]);

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
      {/* RL80 Logo - Top Left */}
      <div style={{
        position: "fixed",
        top: "20px",
        left: "20px",
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
          isMenuOpen={isMenuOpen}
          onMenuClick={() => setIsMenuOpen(!isMenuOpen)}
          show80sButton={false}
          hideMusicOnMobile={true}
        />
      </div>

      {mounted && (
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
    </div>
  );
}
