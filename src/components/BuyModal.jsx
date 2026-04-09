'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useLanguage } from './LanguageProvider';
import { useWalletAuth } from '@/components/WalletAuthProvider';

const BuyModal = ({ isOpen, onClose }) => {
  const [glitchActive, setGlitchActive] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSmallPhone, setIsSmallPhone] = useState(false);
  const [onrampInstance, setOnrampInstance] = useState(null);
  const { t } = useLanguage();
  const { walletAddress } = useWalletAuth();
  const instanceRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
      setIsSmallPhone(window.innerWidth < 400 || window.innerHeight < 700);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        setGlitchActive(false);
        setTimeout(() => setGlitchActive(false), 100);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Initialize Coinbase Onramp when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let destroyed = false;

    const initCoinbaseOnramp = async () => {
      try {
        // Use connected wallet address or fallback placeholder (Coinbase handles it)
        const userAddress = walletAddress || '0x0000000000000000000000000000000000000001';
        const tokenRes = await fetch('/api/onramp-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: userAddress }),
        });
        const tokenData = await tokenRes.json();

        if (!tokenRes.ok || !tokenData.token) {
          console.error('Failed to get session token:', tokenData.error);
          return;
        }

        const { initOnRamp } = await import('@coinbase/cbpay-js');
        initOnRamp({
          appId: process.env.NEXT_PUBLIC_CDP_PROJECT_ID,
          widgetParameters: {
            sessionToken: tokenData.token,
            addresses: { [userAddress]: ['base'] },
            assets: ['ETH', 'USDC'],
            defaultNetwork: 'base',
            defaultExperience: 'buy',
          },
          onSuccess: () => {
            onClose();
          },
          onExit: () => {
            onClose();
          },
          experienceLoggedIn: 'popup',
          experienceLoggedOut: 'popup',
          closeOnExit: true,
          closeOnSuccess: true,
        }, (error, instance) => {
          if (!destroyed && instance) {
            instanceRef.current = instance;
            setOnrampInstance(instance);
          }
        });
      } catch (err) {
        console.error('Failed to initialize Coinbase Onramp:', err);
      }
    };

    initCoinbaseOnramp();

    return () => {
      destroyed = true;
      if (instanceRef.current) {
        instanceRef.current.destroy();
        instanceRef.current = null;
        setOnrampInstance(null);
      }
    };
  }, [isOpen, onClose]);

  const handleBuy = useCallback(() => {
    if (onrampInstance) {
      onrampInstance.open();
    }
  }, [onrampInstance]);

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

        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 20px rgba(0, 229, 114, 0.3), inset 0 0 20px rgba(0, 229, 114, 0.1);
          }
          50% {
            box-shadow: 0 0 40px rgba(0, 229, 114, 0.5), inset 0 0 30px rgba(0, 229, 114, 0.2);
          }
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
          style={{
            position: 'relative',
            background: 'linear-gradient(135deg, #93276a, #3434a7)',
            clipPath: isSmallPhone ? 'none' : 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
            padding: isSmallPhone ? '2.5rem 1rem 1rem' : isMobile ? '3.5rem 1.5rem 2rem' : '3rem',
            maxWidth: '500px',
            width: isSmallPhone ? '95%' : '90%',
            maxHeight: isSmallPhone ? '95vh' : isMobile ? '85vh' : '90vh',
            overflowY: 'auto',
            boxShadow: glitchActive
              ? '5px 5px 0 #ff184c, -5px -5px 0 #00e572, 0 0 50px rgba(139, 0, 255, 0.5)'
              : '3px 3px 0 #fded00, -3px -3px 0 #00e572, 0 0 30px rgba(255, 24, 76, 0.5)',
            transition: 'box-shadow 0.3s',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            className="close-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            style={{
              position: 'absolute',
              top: isSmallPhone ? '8px' : isMobile ? '15px' : '10px',
              right: isSmallPhone ? '8px' : isMobile ? '15px' : '10px',
              background: '#000',
              border: 'none',
              color: '#000',
              fontSize: isSmallPhone ? '20px' : isMobile ? '28px' : '24px',
              width: isSmallPhone ? '36px' : isMobile ? '50px' : '40px',
              height: isSmallPhone ? '36px' : isMobile ? '50px' : '40px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.3s ease',
              zIndex: 100,
              fontWeight: 'bold',
              fontFamily: 'monospace',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.1)';
              e.currentTarget.style.color = '#ff184c';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.color = '#000';
            }}
          >
            ✕
          </button>

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


          {/* Title with Glitch Effect */}
          <h2 className="title-glitch" style={{
            color: '#fff',
            textAlign: 'center',
            marginBottom: isSmallPhone ? '0.75rem' : isMobile ? '1.5rem' : '2rem',
            fontSize: isSmallPhone ? '1.2rem' : isMobile ? '1.5rem' : '2rem',
            fontFamily: 'monospace',
            textTransform: 'uppercase',
            letterSpacing: isSmallPhone ? '2px' : '4px',
            fontWeight: '900',
            position: 'relative',
          }}>
            <span style={{ position: 'relative', zIndex: 2 }}>
              {t('buyModal.title') || 'BUY_RL80_'}
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
                  {t('buyModal.title') || 'BUY_RL80_'}
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
                  {t('buyModal.title') || 'BUY_RL80_'}
                </span>
              </>
            )}
          </h2>

          {/* Buy Content */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: isMobile ? '2px' : '3px',
            position: 'relative',
          }}>
            {/* Corner Accents */}
            <div style={{
              position: 'absolute',
              top: '0',
              left: '-8px',
              width: '20px',
              height: '20px',
              borderTop: '2px solid #fded00',
              borderLeft: '2px solid #fded00',
            }} />
            <div style={{
              position: 'absolute',
              top: '0',
              right: '-8px',
              width: '20px',
              height: '20px',
              borderTop: '2px solid #fded00',
              borderRight: '2px solid #fded00',
            }} />
            <div style={{
              position: 'absolute',
              bottom: '0',
              left: '-8px',
              width: '20px',
              height: '20px',
              borderBottom: '2px solid #00e572',
              borderLeft: '2px solid #00e572',
            }} />
            <div style={{
              position: 'absolute',
              bottom: '0',
              right: '-8px',
              width: '20px',
              height: '20px',
              borderBottom: '2px solid #00e572',
              borderRight: '2px solid #00e572',
            }} />

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: isSmallPhone ? '12px' : '20px',
              padding: isSmallPhone ? '20px 10px' : '30px 20px',
              width: '100%',
            }}>
              {/* Description */}
              <p style={{
                fontFamily: 'monospace',
                fontSize: isSmallPhone ? '11px' : '13px',
                color: 'rgba(255, 255, 255, 0.7)',
                textAlign: 'center',
                lineHeight: '1.6',
                letterSpacing: '0.5px',
                maxWidth: '320px',
              }}>
                {t('buyModal.coinbaseDescription') || 'Purchase ETH or USDC on Base via Coinbase.'}
              </p>

              {/* Buy Button */}
              <button
                onClick={handleBuy}
                disabled={!onrampInstance}
                style={{
                  fontFamily: 'monospace',
                  fontSize: isSmallPhone ? '14px' : '16px',
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: '3px',
                  color: '#000',
                  background: onrampInstance
                    ? 'linear-gradient(135deg, #00e572, #00c85d)'
                    : 'rgba(100, 100, 100, 0.5)',
                  border: 'none',
                  padding: isSmallPhone ? '14px 28px' : '16px 40px',
                  cursor: onrampInstance ? 'pointer' : 'wait',
                  clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
                  transition: 'all 0.3s ease',
                  animation: onrampInstance ? 'pulse-glow 2s infinite' : 'none',
                  position: 'relative',
                  minWidth: isSmallPhone ? '200px' : '240px',
                }}
                onMouseEnter={(e) => {
                  if (onrampInstance) {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 229, 114, 0.6)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                {onrampInstance ? (t('buyModal.buyWithCoinbase') || 'BUY WITH COINBASE') : (t('buyModal.loading') || 'LOADING...')}
              </button>

              {/* Asset Info */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
              }}>
                {['ETH', 'USDC'].map((asset) => (
                  <span key={asset} style={{
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    color: '#fded00',
                    padding: '4px 10px',
                    border: '1px solid rgba(253, 237, 0, 0.3)',
                    letterSpacing: '2px',
                  }}>
                    {asset}
                  </span>
                ))}
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: '#00e572',
                  padding: '4px 10px',
                  border: '1px solid rgba(0, 229, 114, 0.3)',
                  letterSpacing: '2px',
                }}>
                  BASE
                </span>
              </div>

              {/* Divider */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                maxWidth: '320px',
              }}>
                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(253, 237, 0, 0.4))' }} />
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  color: 'rgba(253, 237, 0, 0.6)',
                  letterSpacing: '3px',
                }}>
                  {t('buyModal.orDivider') || 'OR'}
                </span>
                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(253, 237, 0, 0.4), transparent)' }} />
              </div>

              {/* Uniswap Trade Section */}
              <p style={{
                fontFamily: 'monospace',
                fontSize: isSmallPhone ? '11px' : '13px',
                color: 'rgba(255, 255, 255, 0.7)',
                textAlign: 'center',
                lineHeight: '1.6',
                letterSpacing: '0.5px',
                maxWidth: '320px',
              }}>
                {t('buyModal.uniswapDescription') || 'Already have ETH? Swap directly for RL80 on Uniswap.'}
              </p>

              <a
                href="https://app.uniswap.org/swap?outputCurrency=0x30D01555d88c76500a82754A1D53cAc082A6CB75&chain=base"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: 'monospace',
                  fontSize: isSmallPhone ? '14px' : '16px',
                  fontWeight: '900',
                  textTransform: 'uppercase',
                  letterSpacing: '3px',
                  color: '#000',
                  background: 'linear-gradient(135deg, #ff184c, #8B00FF)',
                  border: 'none',
                  padding: isSmallPhone ? '14px 28px' : '16px 40px',
                  cursor: 'pointer',
                  clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
                  transition: 'all 0.3s ease',
                  textDecoration: 'none',
                  display: 'inline-block',
                  textAlign: 'center',
                  minWidth: isSmallPhone ? '200px' : '240px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(255, 24, 76, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                {t('buyModal.tradeOnUniswap') || 'TRADE ON UNISWAP'}
              </a>
            </div>
          </div>

          {/* Info Text */}
          <p style={{
            color: '#00e572',
            textAlign: 'center',
            marginTop: isSmallPhone ? '0.75rem' : '1.5rem',
            fontSize: isSmallPhone ? '8px' : '10px',
            fontFamily: 'monospace',
            letterSpacing: isSmallPhone ? '1px' : '2px',
            textTransform: 'uppercase',
            textShadow: '0 0 10px rgba(0, 229, 114, 0.5)',
          }}>
            {t('buyModal.secureTransaction') || '<SECURE_TRANSACTION_PROTOCOL_ACTIVE>'}
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

export default BuyModal;
