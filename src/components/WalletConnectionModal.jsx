'use client';

import { useState } from 'react';
import { ConnectButton } from "thirdweb/react";
import { client } from '@/lib/contract';
import { defineChain } from "thirdweb/chains";
import { inAppWallet } from "thirdweb/wallets/in-app";
import { createWallet } from "thirdweb/wallets";

const chain = defineChain(84532); // Base Sepolia

export function WalletConnectionModal({ onClose }) {
  const [connectionType, setConnectionType] = useState(null);

  const wallets = connectionType === 'existing' 
    ? [
        createWallet("io.metamask"),
        createWallet("com.coinbase.wallet"),
        createWallet("walletConnect"),
      ]
    : [
        inAppWallet({
          auth: {
            options: ["email", "google", "apple", "facebook"],
          },
        }),
      ];

  if (!connectionType) {
    return (
      <div 
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
          zIndex: 10000,
        }}
        onClick={onClose}
      >
        <div 
          style={{
            background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.98), rgba(30, 20, 40, 0.98))',
            border: '2px solid rgba(138, 43, 226, 0.4)',
            borderRadius: '20px',
            padding: '30px',
            maxWidth: '500px',
            width: '90%',
            position: 'relative',
            boxShadow: '0 0 60px rgba(138, 43, 226, 0.4)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            style={{
              position: 'absolute',
              top: '15px',
              right: '15px',
              background: '#ffee00',
              color: '#000',
              width: '30px',
              height: '30px',
              borderRadius: '4px',
              border: 'none',
              fontSize: '20px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={onClose}
          >×</button>
          
          <h2 style={{
            color: '#fff',
            fontSize: '24px',
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: '30px',
            fontFamily: "'Orbitron', monospace",
            textTransform: 'uppercase',
            letterSpacing: '2px',
            textShadow: '0 0 20px rgba(255, 255, 255, 0.6)',
          }}>Connect Wallet</h2>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '15px',
          }}>
            <button 
              style={{
                background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)',
                border: '2px solid rgba(59, 130, 246, 0.5)',
                borderRadius: '15px',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '15px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                width: '100%',
              }}
              onClick={() => setConnectionType('existing')}
            >
              <div style={{ fontSize: '40px' }}>🔗</div>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ color: '#fff', margin: 0, fontSize: '16px' }}>Connect Existing Wallet</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.7)', margin: '5px 0 0 0', fontSize: '14px' }}>Use MetaMask, Coinbase, or WalletConnect</p>
              </div>
            </button>
            
            <button 
              style={{
                background: 'linear-gradient(135deg, #00f5d4, #00bbf9)',
                border: '2px solid rgba(0, 245, 212, 0.5)',
                borderRadius: '15px',
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '15px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                width: '100%',
              }}
              onClick={() => setConnectionType('new')}
            >
              <div style={{ fontSize: '40px' }}>✨</div>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ color: '#000', margin: 0, fontSize: '16px' }}>Create New Wallet</h3>
                <p style={{ color: 'rgba(0, 0, 0, 0.7)', margin: '5px 0 0 0', fontSize: '14px' }}>Easy setup with email or social login</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
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
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.98), rgba(30, 20, 40, 0.98))',
          border: '2px solid rgba(138, 43, 226, 0.4)',
          borderRadius: '20px',
          padding: '30px',
          maxWidth: '500px',
          width: '90%',
          position: 'relative',
          boxShadow: '0 0 60px rgba(138, 43, 226, 0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          style={{
            position: 'absolute',
            top: '15px',
            left: '15px',
            background: 'transparent',
            color: '#00f5d4',
            border: '1px solid #00f5d4',
            padding: '5px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            cursor: 'pointer',
          }}
          onClick={() => setConnectionType(null)}
        >
          ← Back
        </button>
        <button 
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: '#ffee00',
            color: '#000',
            width: '30px',
            height: '30px',
            borderRadius: '4px',
            border: 'none',
            fontSize: '20px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={onClose}
        >×</button>
        
        <ConnectButton
          client={client}
          chain={chain}
          wallets={wallets}
          connectModal={{
            size: "wide",
            showThirdwebBranding: false,
          }}
          onConnect={(wallet) => {
            // Don't close here - let the parent component handle it
            // The parent will detect wallet connection and handle modal transitions
          }}
        />
      </div>
    </div>
  );
}

// Add styles
export const WalletModalStyles = () => (
  <style jsx global>{`
    .wallet-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    }

    .wallet-modal {
      background: linear-gradient(135deg, rgba(20, 20, 30, 0.98), rgba(30, 20, 40, 0.98));
      border: 2px solid rgba(138, 43, 226, 0.4);
      border-radius: 20px;
      padding: 30px;
      max-width: 500px;
      width: 90%;
      position: relative;
      box-shadow: 0 0 60px rgba(138, 43, 226, 0.4);
    }

    .wallet-modal-close {
      position: absolute;
      top: 15px;
      right: 15px;
      background: #ffee00;
      color: #000;
      width: 30px;
      height: 30px;
      border-radius: 4px;
      border: none;
      font-size: 20px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }

    .wallet-modal-close:hover {
      background: #fff;
      transform: scale(1.1);
    }

    .wallet-modal-back {
      position: absolute;
      top: 15px;
      left: 15px;
      background: transparent;
      color: #00f5d4;
      border: 1px solid #00f5d4;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .wallet-modal-back:hover {
      background: rgba(0, 245, 212, 0.1);
    }

    .wallet-modal-title {
      color: #fff;
      font-size: 24px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 30px;
      font-family: 'Orbitron', monospace;
      text-transform: uppercase;
      letter-spacing: 2px;
      text-shadow: 0 0 20px rgba(255, 255, 255, 0.6);
    }

    .wallet-modal-options {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    .wallet-option-button {
      background: rgba(0, 0, 0, 0.4);
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 20px;
      cursor: pointer;
      transition: all 0.3s;
      width: 100%;
      text-align: left;
    }

    .wallet-option-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }

    .wallet-option-button.existing {
      border-color: rgba(0, 245, 212, 0.4);
    }

    .wallet-option-button.existing:hover {
      background: rgba(0, 245, 212, 0.1);
      border-color: #00f5d4;
    }

    .wallet-option-button.new {
      border-color: rgba(255, 238, 0, 0.4);
    }

    .wallet-option-button.new:hover {
      background: rgba(255, 238, 0, 0.1);
      border-color: #ffee00;
    }

    .wallet-option-icon {
      font-size: 40px;
      width: 60px;
      text-align: center;
    }

    .wallet-option-content h3 {
      color: #fff;
      font-size: 18px;
      margin: 0 0 8px 0;
      font-family: 'Orbitron', monospace;
    }

    .wallet-option-content p {
      color: rgba(255, 255, 255, 0.6);
      font-size: 14px;
      margin: 0;
    }

    .connect-modal {
      max-width: 600px;
    }
  `}</style>
);