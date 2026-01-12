'use client';

import { useState } from 'react';
import { ConnectButton } from "thirdweb/react";
import { darkTheme } from "thirdweb/react";
import { client } from '@/lib/contract';
import { defineChain } from "thirdweb/chains";
import { inAppWallet } from "thirdweb/wallets/in-app";
import { createWallet } from "thirdweb/wallets";
import { useWalletAuth } from '@/components/WalletAuthProvider';

const chain = defineChain(84532); // Base Sepolia

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

export function WalletConnectionModal({ onClose }) {
  const [connectionType, setConnectionType] = useState(null);
  const { isTestUser, switchToTestWallet, switchToOwnWallet } = useWalletAuth();

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
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            {isTestUser && (
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
            )}
            
            <button 
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                width: '100%',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '500',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              onClick={() => {
                if (isTestUser) {
                  // For test users, save preference for own wallet
                  const user = JSON.parse(localStorage.getItem('clerk-user') || '{}');
                  if (user?.id) {
                    localStorage.setItem(`wallet_preference_${user.id}`, 'own_wallet');
                  }
                }
                setConnectionType('existing');
              }}
            >
              Connect Existing Wallet {isTestUser && '(MetaMask, etc.)'}
            </button>
            
            <button 
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(0, 245, 212, 0.3)',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                width: '100%',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '500',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 245, 212, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(0, 245, 212, 0.5)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 245, 212, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(0, 245, 212, 0.3)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              onClick={() => setConnectionType('new')}
            >
              Create New Wallet
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
            border: '1px solid rgba(0, 245, 212, 0.4)',
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
        
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <div> {/* Extra wrapper to prevent button nesting issues */}
            <ConnectButton
              client={client}
              chain={chain}
              wallets={wallets}
              theme={customTheme}
              connectModal={{
                size: "compact",
                showThirdwebBranding: false,
                titleIcon: "",
              }}
              detailsModal={{
                showThirdwebBranding: false,
              }}
              onConnect={(wallet) => {
                // Don't close here - let the parent component handle it
                // The parent will detect wallet connection and handle modal transitions
              }}
            />
          </div>
        </div>
        <WalletModalStyles />
      </div>
    </div>
  );
}

// Add styles
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