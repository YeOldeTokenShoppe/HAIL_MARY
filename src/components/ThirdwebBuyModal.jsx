'use client';

import React from 'react';
import { BuyWidget } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { defineChain } from "thirdweb/chains";

// Create client with your Client ID
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
});

const ThirdwebBuyModal = ({ isOpen, onClose }) => {
  
  if (!isOpen) return null;

  return (
    <>
      {/* Modal Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(10px)',
          zIndex: 10000, // Above nav (9990-9992) but leaves room for Thirdweb modals
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={onClose}
      >
        {/* Modal Content */}
        <div 
          style={{
            position: 'relative',
            background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(0, 0, 0, 0.95))',
            border: '2px solid #ffd700',
            borderRadius: '20px',
            padding: '2rem',
            boxShadow: '0 0 50px rgba(255, 215, 0, 0.5)',
            maxWidth: '500px',
            width: '90%',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'rgba(0, 0, 0, 0.8)',
              border: '2px solid #ffd700',
              color: '#ffd700',
              fontSize: '28px',
              width: '45px',
              height: '45px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              zIndex: 10001, // Higher than modal content
              fontWeight: 'bold',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#ffd700';
              e.currentTarget.style.color = '#000';
              e.currentTarget.style.transform = 'scale(1.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)';
              e.currentTarget.style.color = '#ffd700';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            ✕
          </button>

          {/* Title */}
          <h2 style={{
            color: '#ffd700',
            textAlign: 'center',
            marginBottom: '1.5rem',
            fontSize: '1.8rem',
            fontFamily: '"Pirata One", system-ui',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            textShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
          }}>
            Buy RL80 Tokens
          </h2>

          {/* Thirdweb Buy Widget */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
          }}>
            <BuyWidget
              client={client}
              chain={defineChain(42161)} // Arbitrum One
              // Add your token contract address when ready
              // tokenAddress="0x..." 
              theme="dark"
            />
          </div>

          {/* Info Text */}
          <p style={{
            color: 'rgba(255, 255, 255, 0.7)',
            textAlign: 'center',
            marginTop: '1rem',
            fontSize: '0.9rem',
            fontFamily: 'Courier New, monospace',
          }}>
            Secure purchase options for RL80 tokens
          </p>
        </div>
      </div>
    </>
  );
};

export default ThirdwebBuyModal;