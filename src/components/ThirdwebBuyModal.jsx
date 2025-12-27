'use client';

import React, { useEffect, useState } from 'react';
import { BuyWidget } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { defineChain } from "thirdweb/chains";

// Create client with your Client ID
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
});

const ThirdwebBuyModal = ({ isOpen, onClose }) => {
  const [glitchActive, setGlitchActive] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        setGlitchActive(true);
        setTimeout(() => setGlitchActive(false), 200);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);
  
  if (!isOpen) return null;

  return (
    <>
      <style jsx>{`
        @keyframes modalGlitch {
          0%, 100% {
            transform: translate(0);
            filter: hue-rotate(0deg);
          }
          10% {
            transform: translate(-2px, 2px);
            filter: hue-rotate(90deg);
          }
          20% {
            transform: translate(-2px, -2px);
            filter: hue-rotate(180deg);
          }
          30% {
            transform: translate(2px, 2px);
            filter: hue-rotate(270deg);
          }
          40% {
            transform: translate(2px, -2px);
            filter: hue-rotate(360deg);
          }
          50% {
            transform: translate(-1px, 1px);
            filter: hue-rotate(45deg);
          }
        }
        
        @keyframes textGlitch {
          0%, 100% {
            text-shadow: 
              2px 2px #fded00,
              -2px -2px #00e572,
              0 0 20px rgba(255, 24, 76, 0.8);
          }
          25% {
            text-shadow: 
              -2px 2px #00e572,
              2px -2px #fded00,
              0 0 30px rgba(139, 0, 255, 0.8);
          }
          50% {
            text-shadow: 
              2px -2px #ff184c,
              -2px 2px #8B00FF,
              0 0 25px rgba(253, 237, 0, 0.8);
          }
          75% {
            text-shadow: 
              -2px -2px #00e572,
              2px 2px #ff184c,
              0 0 35px rgba(0, 229, 114, 0.8);
          }
        }
        
        .modal-glitch {
          animation: modalGlitch 0.2s ease-out;
        }
        
        .title-glitch {
          animation: textGlitch 3s infinite;
        }
        
        .close-btn {
          --clip: polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%);
          clip-path: var(--clip);
          position: relative;
        }
        
        .close-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #fded00;
          transform: translate(3px, 0);
          clip-path: var(--clip);
          z-index: -1;
        }
        
        .close-btn::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #ff184c;
          clip-path: var(--clip);
          z-index: -2;
        }
      `}</style>
      
      {/* Modal Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          backdropFilter: 'blur(2px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={onClose}
      >
        {/* Glitch Lines Effect */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          opacity: glitchActive ? 0.1 : 0,
          transition: 'opacity 0.1s',
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(255, 24, 76, 0.3) 2px,
            rgba(255, 24, 76, 0.3) 4px
          )`,
        }} />
        
        {/* Modal Content */}
        <div 
          className={glitchActive ? 'modal-glitch' : ''}
          style={{
            position: 'relative',
            background: 'linear-gradient(135deg, #93276a, #3434a7)',
            clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
            padding: '3rem',
            maxWidth: '500px',
            width: '90%',
            boxShadow: glitchActive 
              ? '5px 5px 0 #ff184c, -5px -5px 0 #00e572, 0 0 50px rgba(139, 0, 255, 0.5)'
              : '3px 3px 0 #fded00, -3px -3px 0 #00e572, 0 0 30px rgba(255, 24, 76, 0.5)',
            transition: 'box-shadow 0.3s',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cyber Frame Borders */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #ff184c, transparent)',
              animation: 'scan 3s linear infinite',
            }} />
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #00e572, transparent)',
              animation: 'scan 3s linear infinite reverse',
            }} />
          </div>
          
          {/* Close Button */}
          <button
            className="close-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={{
              position: 'absolute',
              top: '15px',
              right: '15px',
              background: '#1a0a14',
              border: 'none',
              color: '#fff',
              fontSize: '24px',
              width: '40px',
              height: '40px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease',
              zIndex: 10001,
              fontWeight: 'bold',
              fontFamily: 'monospace',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.color = '#ff184c';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.color = '#fff';
            }}
          >
            ✕
          </button>

          {/* Title with Glitch Effect */}
          <h2 className="title-glitch" style={{
            color: '#fff',
            textAlign: 'center',
            marginBottom: '2rem',
            fontSize: '2rem',
            fontFamily: 'monospace',
            textTransform: 'uppercase',
            letterSpacing: '4px',
            fontWeight: '900',
            position: 'relative',
          }}>
            <span style={{ position: 'relative', zIndex: 2 }}>
              BUY_RL80_
            </span>
            {glitchActive && (
              <>
                <span style={{
                  position: 'absolute',
                  top: '2px',
                  left: '2px',
                  color: '#ff184c',
                  zIndex: 1,
                  width: '100%',
                  textAlign: 'center',
                }}>
                  BUY_RL80_
                </span>
                <span style={{
                  position: 'absolute',
                  top: '-2px',
                  left: '-2px',
                  color: '#00e572',
                  zIndex: 0,
                  width: '100%',
                  textAlign: 'center',
                }}>
                  BUY_RL80_
                </span>
              </>
            )}
          </h2>

          {/* Thirdweb Buy Widget Container */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
            padding: '20px',
            background: 'rgba(15, 10, 20, 0.8)',
            border: '1px solid rgba(255, 24, 76, 0.3)',
            clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
            position: 'relative',
          }}>
            {/* Corner Accents */}
            <div style={{
              position: 'absolute',
              top: '0',
              left: '0',
              width: '20px',
              height: '20px',
              borderTop: '2px solid #fded00',
              borderLeft: '2px solid #fded00',
            }} />
            <div style={{
              position: 'absolute',
              top: '0',
              right: '0',
              width: '20px',
              height: '20px',
              borderTop: '2px solid #fded00',
              borderRight: '2px solid #fded00',
            }} />
            <div style={{
              position: 'absolute',
              bottom: '0',
              left: '0',
              width: '20px',
              height: '20px',
              borderBottom: '2px solid #00e572',
              borderLeft: '2px solid #00e572',
            }} />
            <div style={{
              position: 'absolute',
              bottom: '0',
              right: '0',
              width: '20px',
              height: '20px',
              borderBottom: '2px solid #00e572',
              borderRight: '2px solid #00e572',
            }} />
            
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
            color: '#00e572',
            textAlign: 'center',
            marginTop: '1.5rem',
            fontSize: '10px',
            fontFamily: 'monospace',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            textShadow: '0 0 10px rgba(0, 229, 114, 0.5)',
          }}>
            &lt;SECURE_TRANSACTION_PROTOCOL_ACTIVE&gt;
          </p>
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes scan {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </>
  );
};

export default ThirdwebBuyModal;