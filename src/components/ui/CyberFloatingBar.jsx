'use client';

import { useState, useEffect } from 'react';

const CyberFloatingBar = ({ isMobile = false }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [priceFlash, setPriceFlash] = useState(false);
  const [scanlinePos, setScanlinePos] = useState(0);

  useEffect(() => {
    // Show the floating bar when user scrolls down
    const handleScroll = () => {
      // Show bar after scrolling 80% of the viewport height or reaching near bottom
      const scrollPosition = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      // Show if scrolled past 80% of viewport OR near bottom of page
      const scrolledPastThreshold = scrollPosition > windowHeight * 0.8;
      const nearBottom = scrollPosition + windowHeight > documentHeight - 500;
      
      if (scrolledPastThreshold || nearBottom) {
        setIsVisible(true);
      } else {
        setIsVisible(false); // Hide when scrolling back to top
      }
    };

    // Add scroll listener
    window.addEventListener('scroll', handleScroll);
    
    // Check initial scroll position
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    // Animate scanline
    const scanInterval = setInterval(() => {
      setScanlinePos(prev => (prev + 1) % 100);
    }, 50);

    // Flash price periodically
    const priceInterval = setInterval(() => {
      setPriceFlash(true);
      setTimeout(() => setPriceFlash(false), 300);
    }, 5000);

    return () => {
      clearInterval(scanInterval);
      clearInterval(priceInterval);
    };
  }, []);

  const handleBuyClick = () => {
    window.open('https://app.uniswap.org/swap', '_blank');
  };

  const handleStakeClick = () => {
    window.open('/stake', '_blank');
  };

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'linear-gradient(to top, rgba(0, 0, 0, 0.95), rgba(0, 10, 0, 0.9))',
        backdropFilter: 'blur(20px)',
        paddingTop: isMobile ? '12px' : '15px',
        paddingRight: isMobile ? '10px' : '20px',
        paddingBottom: isMobile ? '15px' : '15px',
        paddingLeft: isMobile ? '10px' : '20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: isMobile ? '10px' : '20px',
        borderTop: '2px solid #00ff00',
        boxShadow: '0 -10px 40px rgba(0, 255, 0, 0.2)',
        zIndex: 10000,
        animation: 'slideUp 0.4s ease-out',
        flexDirection: isMobile ? 'column' : 'row',
        overflow: 'hidden',
      }}
    >
      {/* Animated scanline */}
      <div style={{
        position: 'absolute',
        top: `${scanlinePos}%`,
        left: 0,
        right: 0,
        height: '2px',
        background: 'linear-gradient(90deg, transparent, #00ff00, transparent)',
        opacity: 0.3,
        pointerEvents: 'none',
      }} />

      {/* Grid pattern overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 255, 0, 0.02) 2px,
            rgba(0, 255, 0, 0.02) 4px
          )
        `,
        pointerEvents: 'none',
      }} />

      {/* Left corner bracket */}
      <div style={{
        position: 'absolute',
        top: '0',
        left: '0',
        width: '20px',
        height: '20px',
        borderTop: '2px solid #00ff00',
        borderLeft: '2px solid #00ff00',
        opacity: 0.5,
      }} />

      {/* Right corner bracket */}
      <div style={{
        position: 'absolute',
        top: '0',
        right: '0',
        width: '20px',
        height: '20px',
        borderTop: '2px solid #00ff00',
        borderRight: '2px solid #00ff00',
        opacity: 0.5,
      }} />

      {/* Terminal status */}
      <div style={{
        position: 'absolute',
        top: '5px',
        left: '30px',
        fontSize: '10px',
        color: '#00ff00',
        opacity: 0.6,
        fontFamily: 'monospace',
        letterSpacing: '1px',
        display: isMobile ? 'none' : 'block',
      }}>
        [TERMINAL.ACTIVE]
      </div>

      {/* Price ticker with cyber styling */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        marginRight: isMobile ? '0' : '20px',
        marginBottom: isMobile ? '5px' : '0',
      }}>
        <div style={{
          color: '#00ff00',
          fontSize: '11px',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          opacity: 0.8,
        }}>
          RL80.PRICE
        </div>
        
        <div style={{
          position: 'relative',
          padding: '5px 15px',
          background: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid #00ff00',
          transform: 'skewX(-5deg)',
        
          // clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 100%, 8px 100%)',
        }}>
          <span style={{
            fontSize: isMobile ? '18px' : '20px',
            fontWeight: '700',
            color: priceFlash ? '#ffffff' : '#00ff00',
            fontFamily: 'monospace',
            textShadow: '0 0 10px rgba(0, 255, 0, 0.8)',
            transition: 'color 0.3s ease',
        
          }}>
            $0.0048
          </span>
          
          {/* Price change indicator */}
          {/* <span style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            fontSize: '8px',
            color: '#00ff00',
            fontFamily: 'monospace',
          }}>
            ▲ +12%
          </span> */}
        </div>
      </div>
      
      {/* Button container */}
      <div style={{
        display: 'flex',
        gap: isMobile ? '10px' : '15px',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
      }}>
        <button
          onClick={handleBuyClick}
          style={{
            padding: isMobile ? '10px 20px' : '10px 25px',
            fontSize: isMobile ? '12px' : '14px',
            minWidth: '7rem',
            maxWidth: '7rem',
            fontWeight: 'bold',
            fontFamily: 'monospace',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            color: '#000',
            background: 'linear-gradient(135deg, #00ff00, #00cc00)',
            border: '2px solid #00ff00',
            borderRadius: '0',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            position: 'relative',
            transform: 'skewX(-5deg)',
            boxShadow: '0 0 20px rgba(0, 255, 0, 0.4), inset 0 0 10px rgba(0, 255, 0, 0.2)',
            textShadow: '0 0 5px rgba(0, 255, 0, 0.8)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'skewX(-5deg) translateY(-2px) scale(1.05)';
            e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 255, 0, 0.8), inset 0 0 20px rgba(0, 255, 0, 0.4)';
            e.currentTarget.style.border = '2px solid #00ffaa';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'skewX(-5deg)';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 255, 0, 0.4), inset 0 0 10px rgba(0, 255, 0, 0.2)';
            e.currentTarget.style.border = '2px solid #00ff00';
          }}
        >
          BUY_NOW
        </button>
        
        <button
          onClick={handleStakeClick}
          style={{
            padding: isMobile ? '10px 20px' : '10px 25px',
            fontSize: isMobile ? '12px' : '14px',
            minWidth: '7rem',
            maxWidth: '7rem',
            fontWeight: 'bold',
            fontFamily: 'monospace',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            color: '#000',
            background: 'linear-gradient(135deg, #ffd700, #00ff00)',
            border: '2px solid #ffd700',
            borderRadius: '0',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            position: 'relative',
            transform: 'skewX(-5deg)',
            boxShadow: '0 0 20px rgba(255, 215, 0, 0.4), inset 0 0 10px rgba(255, 215, 0, 0.2)',
            textShadow: '0 0 5px rgba(255, 215, 0, 0.8)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'skewX(-5deg) translateY(-2px) scale(1.05)';
            e.currentTarget.style.boxShadow = '0 0 30px rgba(255, 215, 0, 0.8), inset 0 0 20px rgba(255, 215, 0, 0.4)';
            e.currentTarget.style.background = 'linear-gradient(135deg, #00ff00, #ffd700)';
            e.currentTarget.style.border = '2px solid #00ff00';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'skewX(-5deg)';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.4), inset 0 0 10px rgba(255, 215, 0, 0.2)';
            e.currentTarget.style.background = 'linear-gradient(135deg, #ffd700, #00ff00)';
            e.currentTarget.style.border = '2px solid #ffd700';
          }}
        >
          STAKE
        </button>
      </div>

      {/* APY ticker */}
      <div style={{
        display: isMobile ? 'none' : 'flex',
        alignItems: 'center',
        gap: '10px',
        marginLeft: '15px',
        padding: '5px 12px',
        background: 'rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 215, 0, 0.5)',
      }}>
        <span style={{
          fontSize: '10px',
          color: '#ffd700',
          fontFamily: 'monospace',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}>
          APY:
        </span>
        <span style={{
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#ffd700',
          fontFamily: 'monospace',
          textShadow: '0 0 5px rgba(255, 215, 0, 0.5)',
        }}>
          24.5%
        </span>
      </div>

      {/* Status indicators */}
      <div style={{
        position: 'absolute',
        top: '5px',
        right: '30px',
        display: 'flex',
        gap: '15px',
        alignItems: 'center',
      }}>
        <div style={{
          display: isMobile ? 'none' : 'flex',
          alignItems: 'center',
          gap: '5px',
        }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#00ff00',
            boxShadow: '0 0 10px #00ff00',
            animation: 'pulse 2s infinite',
          }} />
          <span style={{
            fontSize: '10px',
            color: '#00ff00',
            fontFamily: 'monospace',
            opacity: 0.7,
          }}>
            MAINNET
          </span>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            box-shadow: 0 0 10px currentColor;
          }
          50% {
            opacity: 0.5;
            box-shadow: 0 0 20px currentColor;
          }
        }
      `}</style>
    </div>
  );
};

export default CyberFloatingBar;