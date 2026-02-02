'use client'

import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react'
import Link from 'next/link'
import styles from './Matchstick.module.css'
import { useStaking } from '@/hooks/useStaking'
import SkewedHeading from './SkewedHeading'
import { useLanguage } from './LanguageProvider'

/**
 * Consolidated left-side panel for the shrine page
 * Combines: Title, CTA text, and Matchstick into one cohesive unit
 */
const ShrineLeftPanel = forwardRef(({
  is80sMode = false,
  isMobile = false,
  onLightCandle,
  onStakeClick,
  router,
  onFindCandle,
  onResetView,
  isHighlighting = false,
  hasActiveCandle = false
}, ref) => {
  const { t } = useLanguage()
  const [isLit, setIsLit] = useState(false)
  const [hasLitCandleThisSession, setHasLitCandleThisSession] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isHoveringMatchstick, setIsHoveringMatchstick] = useState(false)
  const [isHoveringStake, setIsHoveringStake] = useState(false)
  const [isConstrainedHeight, setIsConstrainedHeight] = useState(() => typeof window !== 'undefined' ? window.innerHeight < 900 : false)
  const { stakedBalance } = useStaking()
  const hasStakedTokens = parseFloat(stakedBalance || 0) > 0

  // Set mounted state after component mounts
  useEffect(() => {
    setMounted(true)
  }, [])

  // Detect constrained viewport heights
  useEffect(() => {
    const checkHeight = () => {
      setIsConstrainedHeight(window.innerHeight < 900)
    }
    checkHeight()
    window.addEventListener('resize', checkHeight)
    return () => window.removeEventListener('resize', checkHeight)
  }, [])
  
  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    resetMatchstick: () => {
      // Don't reset if user has lit a candle this session
      if (!hasLitCandleThisSession) {
        setIsLit(false)
      }
    },
    lightMatchstick: () => {
      // Light the matchstick and mark session as having lit a candle
      setIsLit(true)
      setHasLitCandleThisSession(true)
    }
  }), [hasLitCandleThisSession])
  
  const handleMatchClick = () => {
    // Don't light immediately - only trigger the candle lighting flow
    if (onLightCandle) {
      onLightCandle()
    }
  }

  // Don't render on mobile (phones), but keep for tablets and desktop
  if (isMobile) {
    return null
  }

  return (
    <>
      {/* CSS animations for the matchstick button */}
      <style jsx>{`
        @keyframes buttonPulse {
          0%, 100% {
            box-shadow:
              0 0 0 0 ${is80sMode ? 'rgba(255, 0, 255, 0.4)' : 'rgba(212, 175, 55, 0.4)'},
              0 0 10px 2px ${is80sMode ? 'rgba(255, 0, 255, 0.2)' : 'rgba(212, 175, 55, 0.2)'};
            border-color: ${is80sMode ? 'rgba(255, 0, 255, 0.2)' : 'rgba(212, 175, 55, 0.15)'};
          }
          50% {
            box-shadow:
              0 0 0 6px ${is80sMode ? 'rgba(255, 0, 255, 0)' : 'rgba(212, 175, 55, 0)'},
              0 0 20px 4px ${is80sMode ? 'rgba(255, 0, 255, 0.4)' : 'rgba(212, 175, 55, 0.3)'};
            border-color: ${is80sMode ? 'rgba(255, 0, 255, 0.4)' : 'rgba(212, 175, 55, 0.3)'};
          }
        }

        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 0; }
          100% { transform: scale(1.4); opacity: 0; }
        }

        @keyframes inviteGlow {
          0%, 100% {
            box-shadow:
              0 0 0 0 ${is80sMode ? 'rgba(255, 0, 255, 0)' : 'rgba(212, 175, 55, 0)'},
              0 0 10px 2px ${is80sMode ? 'rgba(255, 0, 255, 0.2)' : 'rgba(212, 175, 55, 0.2)'};
          }
          50% {
            box-shadow:
              0 0 0 8px ${is80sMode ? 'rgba(255, 0, 255, 0)' : 'rgba(212, 175, 55, 0)'},
              0 0 20px 4px ${is80sMode ? 'rgba(255, 0, 255, 0.4)' : 'rgba(212, 175, 55, 0.3)'};
          }
        }

        @keyframes slideIn {
          from {
            transform: translateY(-50%) translateX(-20px);
            opacity: 0;
          }
          to {
            transform: translateY(-50%) translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      
      {/* Vignette overlay - creates breathing room on the left */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '45%',
        height: '100%',
        background: 'linear-gradient(90deg, rgba(10,10,20,0.85) 0%, rgba(10,10,20,0.6) 40%, rgba(10,10,20,0.2) 70%, transparent 100%)',
        pointerEvents: 'none',
        zIndex: 3,
      }} />
   <h1 className='custom-title'
          id="main-title"
          style={{
            position: 'fixed',
            left:  '40px',
            top:  '40px',
            pointerEvents: 'auto',
            color: is80sMode ? "#ffffff" : "#d4af37",
            fontFamily: 'UnifrakturCook, serif',
            textShadow: is80sMode
              ? `
                0 0 20px rgba(201, 55, 255, 0.9),
                0 0 40px rgba(201, 55, 255, 0.8),
                0 0 60px rgba(201, 55, 255, 0.7),
                4px 4px 12px rgba(201, 55, 255, 1),
                -2px -2px 8px rgba(255, 0, 255, 0.8),
                0 0 100px rgba(201, 55, 255, 0.5)
              `
              : `
                rgba(83, 61, 74, 0.9) 1px 1px,
                rgba(83, 61, 74, 0.9) 2px 2px,
                rgba(83, 61, 74, 0.8) 3px 3px,
                rgba(83, 61, 74, 0.8) 4px 4px,
                rgba(83, 61, 74, 0.7) 5px 5px,
                rgba(83, 61, 74, 0.7) 6px 6px,
                rgba(83, 61, 74, 0.6) 7px 7px,
                rgba(83, 61, 74, 0.6) 8px 8px,
                rgba(255, 192, 203, 0.4) -1px -1px 5px,
                rgba(0, 0, 0, 0.8) 10px 10px 15px
              `,
            fontSize: isConstrainedHeight ? "2.4rem" : "3rem",
            fontWeight: 900,
            lineHeight: 0.75,
            transform: "rotate(-8deg) skew(-15deg)",
            cursor: 'pointer',
            margin: 0,
            zIndex: 100,
          }}
          onClick={() => router?.push('/about')}
        >
          <span className="title-line" style={{ display: 'block', position: 'relative' }}>Our Lady</span>
          <span className="title-line" style={{ display: 'block', position: 'relative' }}>
            <span style={{ fontSize: isConstrainedHeight ? "1.3rem" : "1.6rem" }}>of    </span>
            Perpetual
          </span>
          <span className="title-line" style={{ display: 'block', marginLeft: isConstrainedHeight ? "2.4rem" : "3rem", position: 'relative' }}>Profit</span>
        </h1>
     

      {/* Main content container - centered elements */}
      <div style={{
        position: 'fixed',
        left: '40px',
        top: isConstrainedHeight ? '55%' : '60%',
        transform: isConstrainedHeight ? 'translateY(-40%)' : 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isConstrainedHeight ? '10px' : '15px',
        zIndex: 100,
        pointerEvents: 'none',  // Allow clicks to pass through to canvas
        maxHeight: '90vh',  // Ensure it doesn't overflow viewport
      }}>
               {mounted && (
              <SkewedHeading 
                lines={[t('illumin80.watchlistLine1'), t('illumin80.watchlistLine2')]}
                // colors={["#d4af37", "#f4e4c1", "#ffd700"]}
                colors={["#f0f4f0ff"]}
                fontSize="1.5rem" 
                // isMobile={isMobile}
              />
            )}

        {/* CTA Text - Clean modern font */}
       

        {/* Stake Token Frame - Duplicate style below matchstick */}
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: isMobile ? '1rem' : '1rem',
          fontWeight: 300,
          color: is80sMode ? '#00ffff' : 'rgba(246, 245, 241, 0.95)',
          textShadow: is80sMode
            ? `
              0 0 20px rgba(255, 0, 255, 0.6),
              0 0 40px rgba(0, 255, 255, 0.4),
              2px 2px 4px rgba(0, 0, 0, 0.6)
            `
            : `
              0 0 20px rgba(212, 175, 55, 0.4),
              0 0 40px rgba(212, 175, 55, 0.2),
              2px 2px 4px rgba(0, 0, 0, 0.6)
            `,
          letterSpacing: '0.06em',
          textAlign: 'center',
          lineHeight: 1.2,
          maxWidth: isMobile ? '260px' : '280px',
          alignSelf: 'center',
          marginTop: '0.5rem'
        }}>
          <span style={{ 
            display: 'block',
            fontWeight: 400,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontSize: '0.95rem',
          }}>
            STAKE RL80
          </span>
          {/* <span style={{ 
            display: 'block', 
            fontSize: isMobile ? '0.9rem' : '0.9rem',
            opacity: 0.8,
            marginTop: '6px',
            fontWeight: 300,
            fontStyle: 'italic',
          }}>
            Earn rewards
          </span> */}
          {/* <span style={{ 
            display: 'block', 
            fontSize: '0.65rem',
            opacity: 0.5,
            marginTop: '0.5rem',
            fontWeight: 300,
            fontStyle: 'italic',
          }}>
            Sign in + hold RL80 to participate
          </span> */}
        </div>
        
        {/* Stake button - circular background matching matchstick style */}
        <div
          onClick={() => {
            if (onStakeClick) {
              onStakeClick()
            }
          }}
          style={{
            pointerEvents: 'auto',  // Enable clicks on the stake button
            width: '5.5rem',
            height: '5.5rem',
            borderRadius: '50%',
            background: is80sMode ? 'rgba(255, 0, 255, 0.1)' : 'rgba(212, 175, 55, 0.1)',
            border: is80sMode ? '1.5px solid rgba(255, 0, 255, 0.2)' : '1.5px solid rgba(212, 175, 55, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: is80sMode ? '0 0 0 0 rgba(255, 0, 255, 0)' : '0 0 0 0 rgba(212, 175, 55, 0)',
            animation: 'buttonPulse 2s ease-in-out infinite',
            position: 'relative',
            overflow: 'visible',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
          onMouseEnter={(e) => {
            setIsHoveringStake(true);
            e.currentTarget.style.animation = 'none';
            e.currentTarget.style.background = is80sMode ? 'rgba(255, 0, 255, 0.2)' : 'rgba(212, 175, 55, 0.15)';
            e.currentTarget.style.border = is80sMode ? '1.5px solid rgba(255, 0, 255, 0.4)' : '1.5px solid rgba(212, 175, 55, 0.25)';
            e.currentTarget.style.boxShadow = is80sMode ? '0 0 20px rgba(255, 0, 255, 0.4), 0 0 40px rgba(0, 255, 255, 0.2)' : '0 0 20px rgba(212, 175, 55, 0.3)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            setIsHoveringStake(false);
            e.currentTarget.style.animation = 'buttonPulse 2s ease-in-out infinite';
            e.currentTarget.style.background = is80sMode ? 'rgba(255, 0, 255, 0.1)' : 'rgba(212, 175, 55, 0.1)';
            e.currentTarget.style.border = is80sMode ? '1.5px solid rgba(255, 0, 255, 0.2)' : '1.5px solid rgba(212, 175, 55, 0.15)';
            e.currentTarget.style.boxShadow = is80sMode ? '0 0 0 0 rgba(255, 0, 255, 0)' : '0 0 0 0 rgba(212, 175, 55, 0)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {/* Hover text that slides out for staking */}
          {isHoveringStake && (
            <div style={{
              position: 'absolute',
              left: '110%',
              top: '50%',
              whiteSpace: 'nowrap',
              backgroundColor: is80sMode ? 'rgba(20, 0, 40, 0.95)' : 'rgba(10, 10, 20, 0.9)',
              padding: '10px 20px',
              borderRadius: '8px',
              border: is80sMode ? '1px solid rgba(255, 0, 255, 0.4)' : '1px solid rgba(212, 175, 55, 0.3)',
              boxShadow: is80sMode ? '0 4px 12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 0, 255, 0.2)' : '0 4px 12px rgba(0, 0, 0, 0.5)',
              animation: 'slideIn 0.3s ease-out forwards',
              pointerEvents: 'none',
              zIndex: 1000,
            }}>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '0.9rem',
                fontWeight: 300,
                color: is80sMode ? '#00ffff' : 'rgba(246, 245, 241, 0.95)',
                textShadow: is80sMode ? '0 0 10px rgba(0, 255, 255, 0.5)' : '0 0 10px rgba(212, 175, 55, 0.3)',
                letterSpacing: '0.05em',
                lineHeight: 1.4,
              }}>
                <div style={{ marginBottom: '4px' }}>Lock RL80 and earn Eth.</div>
              </div>
            </div>
          )}
          <img 
            src="/images/stakeIcon.webp"
            alt="Stake Tokens"
            style={{
              width: '70%',
              height: '70%',
              objectFit: 'contain',
              opacity: 0.9,
              filter: 'brightness(1.1)',
              pointerEvents: 'none',
            }}
          />
          
          {/* Subtle glow ring animation */}
          <div style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            boxShadow: is80sMode ? '0 0 0 0 rgba(255, 0, 255, 0.4)' : '0 0 0 0 rgba(212, 175, 55, 0.4)',
            animation: 'inviteGlow 3s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        </div>

        {/* "Or" divider between Stake and Get Lit */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          margin: '0.75rem 0',
          width: '100%',
          maxWidth: '120px',
        }}>
          <div style={{
            flex: 1,
            height: '1px',
            background: is80sMode
              ? 'linear-gradient(to right, transparent, rgba(255, 0, 255, 0.5))'
              : 'linear-gradient(to right, transparent, rgba(212, 175, 55, 0.4))',
          }} />
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: '0.85rem',
            color: is80sMode ? 'rgba(0, 255, 255, 0.8)' : 'rgba(212, 175, 55, 0.7)',
            textTransform: 'lowercase',
            letterSpacing: '0.1em',
            fontStyle: 'italic',
            textShadow: is80sMode ? '0 0 10px rgba(0, 255, 255, 0.5)' : 'none',
          }}>
            or
          </span>
          <div style={{
            flex: 1,
            height: '1px',
            background: is80sMode
              ? 'linear-gradient(to left, transparent, rgba(255, 0, 255, 0.5))'
              : 'linear-gradient(to left, transparent, rgba(212, 175, 55, 0.4))',
          }} />
        </div>

        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: isMobile ? '1rem' : '1.1rem',
          fontWeight: 300,
          color: is80sMode ? '#00ffff' : 'rgba(246, 245, 241, 0.95)',
          textShadow: is80sMode
            ? `
              0 0 20px rgba(255, 0, 255, 0.6),
              0 0 40px rgba(0, 255, 255, 0.4),
              2px 2px 4px rgba(0, 0, 0, 0.6)
            `
            : `
              0 0 20px rgba(212, 175, 55, 0.4),
              0 0 40px rgba(212, 175, 55, 0.2),
              2px 2px 4px rgba(0, 0, 0, 0.6)
            `,
          letterSpacing: '0.06em',
          textAlign: 'center',
          lineHeight: 1.2,
          maxWidth: isMobile ? '260px' : '280px',
          alignSelf: 'center',
        }}>
          <span style={{
            display: 'block',
            fontWeight: 400,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontSize: '0.95rem',
          }}>
            Get Lit
          </span>
          {/* <span style={{ 
            display: 'block', 
            fontSize: '0.65rem',
            opacity: 0.5,
            marginTop: '0.5rem',
            fontWeight: 300,
            fontStyle: 'italic',
          }}>
            Sign in + hold RL80 to participate
          </span> */}
        </div>

        {/* Matchstick with circular background - matching mobile style */}
        <div
          onClick={handleMatchClick}
          onMouseEnter={(e) => {
            setIsHoveringMatchstick(true);
            if (!isLit) {
              e.currentTarget.style.animation = 'none';
              e.currentTarget.style.background = is80sMode ? 'rgba(255, 0, 255, 0.2)' : 'rgba(212, 175, 55, 0.15)';
              e.currentTarget.style.border = is80sMode ? '1.5px solid rgba(255, 0, 255, 0.4)' : '1.5px solid rgba(212, 175, 55, 0.25)';
              e.currentTarget.style.boxShadow = is80sMode ? '0 0 20px rgba(255, 0, 255, 0.4), 0 0 40px rgba(0, 255, 255, 0.2)' : '0 0 20px rgba(212, 175, 55, 0.3)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }
          }}
          onMouseLeave={(e) => {
            setIsHoveringMatchstick(false);
            if (!isLit) {
              e.currentTarget.style.animation = 'buttonPulse 2s ease-in-out infinite';
              e.currentTarget.style.background = is80sMode ? 'rgba(255, 0, 255, 0.1)' : 'rgba(212, 175, 55, 0.1)';
              e.currentTarget.style.border = is80sMode ? '1.5px solid rgba(255, 0, 255, 0.2)' : '1.5px solid rgba(212, 175, 55, 0.15)';
              e.currentTarget.style.boxShadow = is80sMode ? '0 0 0 0 rgba(255, 0, 255, 0)' : '0 0 0 0 rgba(212, 175, 55, 0)';
              e.currentTarget.style.transform = 'scale(1)';
            } else {
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
          style={{
            pointerEvents: 'auto',  // Enable clicks on the matchstick
            width: '5.5rem',
            height: '5.5rem',
            borderRadius: '50%',
            background: isLit
              ? 'radial-gradient(circle, rgba(255, 149, 0, 0.2) 0%, rgba(255, 100, 0, 0.05) 70%, transparent 100%)'
              : (is80sMode ? 'rgba(255, 0, 255, 0.1)' : 'rgba(212, 175, 55, 0.1)'),
            border: isLit
              ? '1.5px solid rgba(255, 149, 0, 0.4)'
              : (is80sMode ? '1.5px solid rgba(255, 0, 255, 0.2)' : '1.5px solid rgba(212, 175, 55, 0.15)'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: isLit
              ? '0 0 15px rgba(255, 149, 0, 0.3)'
              : (is80sMode ? '0 0 0 0 rgba(255, 0, 255, 0)' : '0 0 0 0 rgba(212, 175, 55, 0)'),
            animation: isLit
              ? 'none'
              : 'buttonPulse 2s ease-in-out infinite',
            position: 'relative',
            overflow: 'visible',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          {/* Hover text that slides out */}
          {isHoveringMatchstick && (
            <div style={{
              position: 'absolute',
              left: '110%',
              top: '50%',
              whiteSpace: 'nowrap',
              backgroundColor: is80sMode ? 'rgba(20, 0, 40, 0.95)' : 'rgba(10, 10, 20, 0.9)',
              padding: '10px 20px',
              borderRadius: '8px',
              border: is80sMode ? '1px solid rgba(255, 0, 255, 0.4)' : '1px solid rgba(212, 175, 55, 0.3)',
              boxShadow: is80sMode ? '0 4px 12px rgba(0, 0, 0, 0.5), 0 0 20px rgba(255, 0, 255, 0.2)' : '0 4px 12px rgba(0, 0, 0, 0.5)',
              animation: 'slideIn 0.3s ease-out forwards',
              pointerEvents: 'none',
              zIndex: 1000,
            }}>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: '0.9rem',
                fontWeight: 300,
                color: is80sMode ? '#00ffff' : 'rgba(246, 245, 241, 0.95)',
                textShadow: is80sMode ? '0 0 10px rgba(0, 255, 255, 0.5)' : '0 0 10px rgba(212, 175, 55, 0.3)',
                letterSpacing: '0.05em',
                lineHeight: 1.4,
              }}>
                <div style={{ marginBottom: '4px' }}>Light a green candle.</div>
                <div style={{
                  fontSize: '0.8rem',
                  opacity: 0.8,
                  color: is80sMode ? 'rgba(255, 0, 255, 0.9)' : 'rgba(212, 175, 55, 0.9)',
                  textShadow: is80sMode ? '0 0 8px rgba(255, 0, 255, 0.5)' : 'none',
                }}>RL80 tokens required.</div>
              </div>
            </div>
          )}
          <img
            src="/images/torchIcon.webp"
            alt="Light Candle"
            style={{
              width: '70%',
              height: '70%',
              objectFit: 'contain',
              opacity: isLit ? 1 : 0.9,
              filter: isLit ? 'brightness(1.3) drop-shadow(0 0 10px rgba(255, 149, 0, 0.6))' : 'brightness(1.1)',
              pointerEvents: 'none',
              transition: 'all 0.3s ease',
            }}
          />
          
          {/* Pulse animation overlay */}
          {isLit ? (
            // Pulse for lit state
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: '2px solid rgba(255, 149, 0, 0.6)',
              animation: 'pulse 2s infinite',
              pointerEvents: 'none',
            }} />
          ) : (
            // Subtle glow ring for unlit state
            <div style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              boxShadow: is80sMode ? '0 0 0 0 rgba(255, 0, 255, 0.4)' : '0 0 0 0 rgba(212, 175, 55, 0.4)',
              animation: 'inviteGlow 3s ease-in-out infinite',
              pointerEvents: 'none',
            }} />
          )}
        </div>
        {/* Find My Candle button - only visible when user has an active lit candle */}
        {onFindCandle && !isHighlighting && hasActiveCandle && (
          <button
            onClick={() => onFindCandle?.()}
            style={{
              background: 'rgba(0, 20, 20, 0.7)',
              border: '1px solid rgba(0, 255, 136, 0.4)',
              borderRadius: '8px',
              padding: '10px 16px',
              color: '#00ff88',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.3s ease',
              marginTop: '1rem',
              pointerEvents: 'auto',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.02)'
              e.currentTarget.style.borderColor = 'rgba(0, 255, 136, 0.7)'
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 255, 136, 0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.borderColor = 'rgba(0, 255, 136, 0.4)'
              e.currentTarget.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)'
            }}
          >
            🔍 {t('illumin80.findMyCandle')}
          </button>
        )}

      </div>
    </>
  )
})

ShrineLeftPanel.displayName = 'ShrineLeftPanel'
export default ShrineLeftPanel