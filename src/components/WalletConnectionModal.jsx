'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useConnect } from "thirdweb/react";
import { client } from '@/lib/contract';
import { defineChain } from "thirdweb/chains";
import { inAppWallet } from "thirdweb/wallets/in-app";
import { createWallet } from "thirdweb/wallets";

const chain = defineChain(8453); // Base

// Clerk provider → thirdweb strategy mapping
const clerkToThirdweb = {
  google: 'google', oauth_google: 'google',
  discord: 'discord', oauth_discord: 'discord',
  oauth_x: 'x', x: 'x',
  oauth_farcaster: 'farcaster', farcaster: 'farcaster',
  oauth_telegram: 'telegram', telegram: 'telegram',
};
const providerLabels = {
  google: 'Google', discord: 'Discord', x: 'X',
  farcaster: 'Farcaster', telegram: 'Telegram',
};

export function WalletConnectionModal({ onClose }) {
  const { user } = useUser();
  const { connect } = useConnect();
  const [isMobile, setIsMobile] = useState(false);
  const [connectingMethod, setConnectingMethod] = useState(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const connectSocial = useCallback(async (strategy) => {
    setConnectingMethod(strategy);
    try {
      const wallet = inAppWallet();
      await connect(async () => {
        await wallet.connect({ client, chain, strategy });
        return wallet;
      });
      onClose();
    } catch (e) {
      if (e?.message) console.warn('Social connect cancelled:', e.message);
    } finally {
      setConnectingMethod(null);
    }
  }, [connect, onClose]);

  const connectExternal = useCallback(async (walletId) => {
    setConnectingMethod(walletId);
    try {
      const wallet = createWallet(walletId);
      await connect(async () => {
        await wallet.connect({ client, chain });
        return wallet;
      });
      onClose();
    } catch (e) {
      if (e?.message) console.warn('Wallet connect cancelled:', e.message);
    } finally {
      setConnectingMethod(null);
    }
  }, [connect, onClose]);

  // Detect Clerk provider for smart wallet-creation suggestion
  const clerkProvider = user?.externalAccounts?.[0]?.provider;
  const primaryStrategy = clerkToThirdweb[clerkProvider] || null;
  const primaryLabel = primaryStrategy ? providerLabels[primaryStrategy] : null;

  const walletOptions = isMobile
    ? [
        { id: 'walletConnect', label: 'WalletConnect' },
        { id: 'io.metamask', label: 'MetaMask' },
        { id: 'com.coinbase.wallet', label: 'Coinbase' },
      ]
    : [
        { id: 'io.metamask', label: 'MetaMask' },
        { id: 'com.coinbase.wallet', label: 'Coinbase' },
        { id: 'walletConnect', label: 'WalletConnect' },
      ];

  const btnBase = {
    background: 'rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(0, 245, 212, 0.25)',
    borderRadius: '10px',
    padding: '14px 16px',
    color: '#fff',
    fontSize: '13px',
    fontFamily: "'Orbitron', monospace",
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    textAlign: 'left',
  };

  return (
    <div
      data-wallet-connection-modal="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgba(20, 20, 30, 0.98)',
          border: '1px solid rgba(0, 245, 212, 0.2)',
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
          position: 'relative',
          boxShadow: '0 20px 60px rgba(0, 245, 212, 0.15)',
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
            width: '28px',
            height: '28px',
            borderRadius: '6px',
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
          fontSize: '16px',
          fontWeight: '600',
          textAlign: 'center',
          marginBottom: '20px',
          fontFamily: "'Orbitron', monospace",
          letterSpacing: '1px',
          textShadow: '0 0 10px rgba(0, 245, 212, 0.3)',
        }}>Connect Wallet</h2>

        {/* External wallet options — front and center */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {walletOptions.map(({ id, label }) => (
            <button
              key={id}
              style={{
                ...btnBase,
                opacity: connectingMethod && connectingMethod !== id ? 0.5 : 1,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(0, 245, 212, 0.5)'; e.currentTarget.style.background = 'rgba(0, 245, 212, 0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0, 245, 212, 0.25)'; e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)'; }}
              onClick={() => connectExternal(id)}
              disabled={!!connectingMethod}
            >
              <span style={{ flex: 1, fontWeight: 500 }}>{connectingMethod === id ? 'Connecting...' : label}</span>
            </button>
          ))}

          {/* Divider + new-to-wallets helper */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            margin: '6px 0 2px',
            color: 'rgba(255,255,255,0.25)',
            fontSize: '10px',
          }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ padding: '0 10px', fontFamily: "'Orbitron', monospace", letterSpacing: '1px' }}>
              NEW TO WALLETS?
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
          </div>

          <p style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '12px',
            lineHeight: '1.5',
            margin: 0,
            textAlign: 'center',
          }}>
            {primaryLabel
              ? `A wallet will be created for you using your ${primaryLabel} sign-in.`
              : 'A wallet will be created for you automatically.'}
          </p>

          {/* Primary create-wallet button matching their Clerk auth */}
          <button
            style={{
              background: 'linear-gradient(135deg, #00f5d4, #00bbff)',
              border: 'none',
              borderRadius: '10px',
              padding: '13px 16px',
              color: '#000',
              fontSize: '13px',
              fontWeight: '600',
              fontFamily: "'Orbitron', monospace",
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              opacity: connectingMethod && connectingMethod !== (primaryStrategy || 'google') ? 0.5 : 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 245, 212, 0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
            onClick={() => connectSocial(primaryStrategy || 'google')}
            disabled={!!connectingMethod}
          >
            {connectingMethod === (primaryStrategy || 'google')
              ? 'Creating wallet...'
              : `Create Wallet${primaryLabel ? ` with ${primaryLabel}` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// Keep the export for backwards compatibility (used by other components)
export const WalletModalStyles = () => null;
