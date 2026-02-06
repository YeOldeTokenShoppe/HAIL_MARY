'use client';

import { useState, useEffect } from 'react';
import { ConnectButton, ConnectEmbed } from "thirdweb/react";
import { darkTheme } from "thirdweb/react";
import { client } from '@/lib/contract';
import { defineChain } from "thirdweb/chains";
import { inAppWallet } from "thirdweb/wallets/in-app";
import { createWallet } from "thirdweb/wallets";
import { useWalletAuth } from '@/components/WalletAuthProvider';

const chain = defineChain(8453); // Base

// Custom theme for the wallet modal
const customTheme = darkTheme({
  colors: {
    primaryButtonBg: "rgba(0, 245, 212, 0.1)",
    primaryButtonText: "#00f5d4",
    modalBg: "rgba(20, 20, 30, 0.98)",
    borderColor: "rgba(0, 245, 212, 0.2)",
    accentText: "#00f5d4",
    primaryText: "#ffffff",
    secondaryText: "rgba(255, 255, 255, 0.6)",
    connectedButtonBg: "rgba(0, 245, 212, 0.1)",
    connectedButtonBgHover: "rgba(0, 245, 212, 0.2)",
  },
  fontFamily: "'Orbitron', monospace",
});

// In-app wallet with social auth options
const socialWallet = inAppWallet({
  auth: {
    options: ["google", "discord", "telegram", "farcaster", "email", "x", "passkey"],
  },
});

// Desktop wallet order - external wallets first
const desktopWallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("walletConnect"),
  socialWallet,
];

// Mobile wallet order - WalletConnect first (main way to connect external wallets on mobile)
const mobileWallets = [
  createWallet("walletConnect"),
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  socialWallet,
];

export function WalletConnectionModal({ onClose }) {
  const { isTestUser, switchToTestWallet } = useWalletAuth();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // For test users, show the test wallet option
  if (isTestUser) {
    return (
      <div
        data-wallet-connection-modal="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000000,
        }}
        onClick={onClose}
      >
        <div
          style={{
            background: 'rgba(20, 20, 30, 0.95)',
            border: '1px solid rgba(138, 43, 226, 0.2)',
            borderRadius: '12px',
            padding: '20px',
            maxWidth: '400px',
            width: '90%',
            position: 'relative',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'transparent',
              color: 'rgba(255, 255, 255, 0.6)',
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'}
            onClick={onClose}
          >×</button>

          <h2 style={{
            color: '#fff',
            fontSize: '18px',
            fontWeight: '600',
            textAlign: 'center',
            marginBottom: '20px',
            fontFamily: "'Orbitron', monospace",
            letterSpacing: '1px',
            textShadow: '0 0 10px rgba(0, 245, 212, 0.3)',
          }}>Connect Wallet</h2>

          {/* Test Wallet Option */}
          <button
            style={{
              background: 'rgba(255, 215, 0, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.3)',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              width: '100%',
              color: '#ffd700',
              fontSize: '14px',
              fontWeight: '500',
              position: 'relative',
              marginBottom: '16px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 215, 0, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.5)';
              e.currentTarget.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 215, 0, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.3)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onClick={() => {
              switchToTestWallet();
              onClose();
            }}
          >
            Use Test Wallet (Pre-funded)
            <span style={{
              position: 'absolute',
              top: '-8px',
              right: '10px',
              background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
              color: '#000',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: 'bold',
            }}>
              RECOMMENDED
            </span>
          </button>

          {/* Divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            margin: '12px 0',
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '12px',
          }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
            <span style={{ padding: '0 12px' }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255, 255, 255, 0.1)' }} />
          </div>

          {/* Thirdweb Connect Button */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ConnectButton
              client={client}
              chain={chain}
              wallets={isMobile ? mobileWallets : desktopWallets}
              theme={customTheme}
              connectModal={{
                size: "compact",
                showThirdwebBranding: false,
                titleIcon: "",
                title: "Choose Wallet",
              }}
              detailsModal={{
                showThirdwebBranding: false,
              }}
              onConnect={() => {
                onClose();
              }}
            />
          </div>
          <WalletModalStyles />
        </div>
      </div>
    );
  }

  // For non-test users, render ConnectEmbed directly in a modal
  return (
    <div
      data-wallet-connection-modal="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgba(20, 20, 30, 0.98)',
          border: '1px solid rgba(0, 245, 212, 0.2)',
          borderRadius: '12px',
          padding: '20px',
          maxWidth: '400px',
          width: '90%',
          position: 'relative',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'transparent',
            color: 'rgba(255, 255, 255, 0.6)',
            width: '24px',
            height: '24px',
            borderRadius: '4px',
            border: 'none',
            fontSize: '18px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s',
            zIndex: 10,
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)'}
          onClick={onClose}
        >×</button>

        <h2 style={{
          color: '#fff',
          fontSize: '18px',
          fontWeight: '600',
          textAlign: 'center',
          marginBottom: '20px',
          fontFamily: "'Orbitron', monospace",
          letterSpacing: '1px',
          textShadow: '0 0 10px rgba(0, 245, 212, 0.3)',
        }}>Connect Wallet</h2>

        {/* ConnectEmbed - inline wallet connection UI */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <ConnectEmbed
            client={client}
            chain={chain}
            wallets={isMobile ? mobileWallets : desktopWallets}
            theme={customTheme}
            showThirdwebBranding={false}
            onConnect={() => {
              onClose();
            }}
          />
        </div>
        <WalletModalStyles />
      </div>
    </div>
  );
}

// Old two-step flow removed - keeping only the simplified version above

// Add styles (moved outside component for better performance)
export const WalletModalStyles = () => (
  <style jsx global>{`
    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700&display=swap');

    /* Style Thirdweb modal components */
    [data-theme="dark"] {
      font-family: 'Orbitron', monospace !important;
    }

    /* Make the wallet details look better */
    .tw-connected-wallet {
      padding: 1.5rem !important;
    }

    /* Add Orbitron font to all Thirdweb components */
    [role="dialog"] {
      font-family: 'Orbitron', monospace !important;
    }

    /* Ensure Thirdweb's modal appears ABOVE our custom WalletConnectionModal */
    /* Thirdweb uses these selectors for their modal */
    [data-rk],
    [data-tw-modal],
    .tw-modal,
    .thirdweb-modal,
    div[role="dialog"][aria-modal="true"] {
      z-index: 2000000 !important;
    }

    /* Thirdweb modal backdrop */
    [data-tw-modal-backdrop],
    .tw-modal-backdrop {
      z-index: 1999999 !important;
    }
  `}</style>
);

// LEGACY CODE BELOW - Two-step flow (REMOVED)
// The following code has been removed to simplify the wallet connection process
// If you need to restore the two-step flow, check git history

/*
OLD IMPLEMENTATION:
- First screen: Choose between "Connect Existing" vs "Create New"
- Second screen: Show Thirdweb ConnectButton
- This created confusion as users saw "2 different modals"

NEW IMPLEMENTATION:
- Single screen with all wallet options combined
- Test wallet option shown at top (if available)
- All wallet connection methods in one Thirdweb button
- Much cleaner UX
*/

