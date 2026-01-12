'use client'

import React, { useState, useImperativeHandle, forwardRef } from 'react'
import Link from 'next/link'
import styles from './Matchstick.module.css'
import { useStaking } from '@/hooks/useStaking'

/**
 * Consolidated left-side panel for the shrine page
 * Combines: Title, CTA text, and Matchstick into one cohesive unit
 */
const ShrineLeftPanel = forwardRef(({ 
  is80sMode = false, 
  isMobile = false,
  onLightCandle,
  onStakeClick,
  router 
}, ref) => {
  const [isLit, setIsLit] = useState(false)
  const [hasLitCandleThisSession, setHasLitCandleThisSession] = useState(false)
  const { stakedBalance } = useStaking()
  const hasStakedTokens = parseFloat(stakedBalance || 0) > 0
  
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
              0 0 0 0 rgba(212, 175, 55, 0.4),
              0 0 10px 2px rgba(212, 175, 55, 0.2);
            border-color: rgba(212, 175, 55, 0.15);
          }
          50% {
            box-shadow: 
              0 0 0 6px rgba(212, 175, 55, 0),
              0 0 20px 4px rgba(212, 175, 55, 0.3);
            border-color: rgba(212, 175, 55, 0.3);
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
              0 0 0 0 rgba(212, 175, 55, 0),
              0 0 10px 2px rgba(212, 175, 55, 0.2);
          }
          50% {
            box-shadow: 
              0 0 0 8px rgba(212, 175, 55, 0),
              0 0 20px 4px rgba(212, 175, 55, 0.3);
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

      {/* Main content container - positioned as one cohesive unit */}
      <div style={{
        position: 'fixed',
        left: '40px',
        top: '5%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        zIndex: 100,
        pointerEvents: 'none',  // Allow clicks to pass through to canvas
      }}>
        
        {/* Title */}
        <h1 className='custom-title'
            id="main-title"
            // onClick={() => router?.push('/about')}
            style={{ 
              pointerEvents: 'auto',  // Enable clicks on the title
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
              fontSize: "3rem",
              fontWeight: 900,
              lineHeight: 0.8,
              transform: "rotate(-8deg) skew(-15deg)",
              cursor: 'pointer',
              margin: 0,
              marginBottom: '20px',
            }}
          >
            <span className="title-line" style={{ display: 'block', position: 'relative' }}>Our Lady</span>
            <span className="title-line" style={{ display: 'block', position: 'relative' }}>
              <span style={{ fontSize: "2rem" }}>of    </span>
              Perpetual
            </span>
            <span className="title-line" style={{ display: 'block', marginLeft: "4rem", position: 'relative' }}>Profit</span>
          </h1>

        {/* CTA Text - Clean modern font */}
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: isMobile ? '1.2rem' : '1.4rem',
          fontWeight: 300,
          color: 'rgba(246, 245, 241, 0.95)',
          textShadow: `
            0 0 20px rgba(212, 175, 55, 0.4),
            0 0 40px rgba(212, 175, 55, 0.2),
            2px 2px 4px rgba(0, 0, 0, 0.6)
          `,
          letterSpacing: '0.08em',
          textAlign: 'center',
          lineHeight: 1.4,
          maxWidth: isMobile ? '280px' : '320px',
          alignSelf: 'center',
        }}>
          <span style={{ 
            display: 'block',
            fontWeight: 400,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
          }}>
            Get on Her Watchlist 
          </span>
          <span style={{ 
            display: 'block', 
            fontSize: isMobile ? '0.9rem' : '0.9rem',
            opacity: 0.8,
            marginTop: '6px',
            fontWeight: 300,
            fontStyle: 'italic',
          }}>
            Strike the match to light a green candle!
          </span>
          <span style={{ 
            display: 'block', 
            fontSize: '0.65rem',
            opacity: 0.5,
            marginTop: '0.5rem',
            fontWeight: 300,
            fontStyle: 'italic',
          }}>
            Sign in + hold RL80 to participate
          </span>
        </div>

        {/* Matchstick with circular background - matching mobile style */}
        <div 
          onClick={handleMatchClick}
          style={{
            pointerEvents: 'auto',  // Enable clicks on the matchstick
            width: '8rem',
            height: '8rem',
            borderRadius: '50%',
            background: isLit 
              ? 'radial-gradient(circle, rgba(255, 149, 0, 0.2) 0%, rgba(255, 100, 0, 0.05) 70%, transparent 100%)'
              : 'rgba(212, 175, 55, 0.1)',
            border: isLit 
              ? '1.5px solid rgba(255, 149, 0, 0.4)' 
              : '1.5px solid rgba(212, 175, 55, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: isLit
              ? '0 0 15px rgba(255, 149, 0, 0.3)'
              : '0 0 0 0 rgba(212, 175, 55, 0)',
            animation: isLit
              ? 'none'
              : 'buttonPulse 2s ease-in-out infinite',
            position: 'relative',
            overflow: 'hidden',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          <div className={styles.wrapper} style={{
            transform: 'scale(0.75)',  // Just scale, no translation needed
            pointerEvents: 'none',
          }}>
            <div className={styles.container}>
              <input type="checkbox" className={styles.switch} checked={isLit} readOnly />
              
              {/* Organic ambient glow - replaces the harsh circle */}
              <div className={styles.ambientGlow} />
              
              <div className={styles.flameContainer}>
                <div className={`${styles.flame} ${styles.red}`}></div>
                <div className={`${styles.flame} ${styles.orange}`}></div>
                <div className={`${styles.flame} ${styles.yellow}`}></div>
                <div className={`${styles.flame} ${styles.white}`}></div>
                <div className={`${styles.circle} ${styles.black}`}></div>
              </div>
              
              <div className={styles.woodWrapper}>
                <div className={styles.tip}></div>
                <div className={styles.wood}>
                  <p>b</p>
                </div>
              </div>
              
              <div className={styles.glowingArea}></div>
              <div className={styles.mainGlow}></div>
            </div>
          </div>
          
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
              boxShadow: '0 0 0 0 rgba(212, 175, 55, 0.4)',
              animation: 'inviteGlow 3s ease-in-out infinite',
              pointerEvents: 'none',
            }} />
          )}
        </div>

        {/* Stake Token Frame - Duplicate style below matchstick */}
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: isMobile ? '1.2rem' : '1.4rem',
          fontWeight: 300,
          color: 'rgba(246, 245, 241, 0.95)',
          textShadow: `
            0 0 20px rgba(212, 175, 55, 0.4),
            0 0 40px rgba(212, 175, 55, 0.2),
            2px 2px 4px rgba(0, 0, 0, 0.6)
          `,
          letterSpacing: '0.08em',
          textAlign: 'center',
          lineHeight: 1.4,
          maxWidth: isMobile ? '280px' : '320px',
          alignSelf: 'center',
        }}>
          <span style={{ 
            display: 'block',
            fontWeight: 400,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
          }}>
            STAKE RL80
          </span>
          <span style={{ 
            display: 'block', 
            fontSize: isMobile ? '0.9rem' : '0.9rem',
            opacity: 0.8,
            marginTop: '6px',
            fontWeight: 300,
            fontStyle: 'italic',
          }}>
            Earn rewards
          </span>
          <span style={{ 
            display: 'block', 
            fontSize: '0.65rem',
            opacity: 0.5,
            marginTop: '0.5rem',
            fontWeight: 300,
            fontStyle: 'italic',
          }}>
            Sign in + hold RL80 to participate
          </span>
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
            width: '8rem',
            height: '8rem',
            borderRadius: '50%',
            background: 'rgba(212, 175, 55, 0.1)',
            border: '1.5px solid rgba(212, 175, 55, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: '0 0 0 0 rgba(212, 175, 55, 0)',
            animation: 'buttonPulse 2s ease-in-out infinite',
            position: 'relative',
            overflow: 'hidden',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.animation = 'none';
            e.currentTarget.style.background = 'rgba(212, 175, 55, 0.15)';
            e.currentTarget.style.border = '1.5px solid rgba(212, 175, 55, 0.25)';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(212, 175, 55, 0.3)';
            e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.animation = 'buttonPulse 2s ease-in-out infinite';
            e.currentTarget.style.background = 'rgba(212, 175, 55, 0.1)';
            e.currentTarget.style.border = '1.5px solid rgba(212, 175, 55, 0.15)';
            e.currentTarget.style.boxShadow = '0 0 0 0 rgba(212, 175, 55, 0)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <img 
            src="/images/stakeIcon.webp"
            alt="Stake Tokens"
            style={{
              width: '60%',
              height: '60%',
              objectFit: 'contain',
              opacity: 0.9,
              filter: 'brightness(1.1)',
              pointerEvents: 'none',
            }}
          />
          {/* Indicator for staked tokens */}
          {hasStakedTokens && (
            <div style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
              color: '#000',
              boxShadow: '0 2px 8px rgba(255, 215, 0, 0.5)',
              animation: 'pulse 2s infinite',
              zIndex: 1,
            }}>
              ✓
            </div>
          )}
          
          {/* Subtle glow ring animation */}
          <div style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            boxShadow: '0 0 0 0 rgba(212, 175, 55, 0.4)',
            animation: 'inviteGlow 3s ease-in-out infinite',
            pointerEvents: 'none',
          }} />
        </div>
   

      </div>
    </>
  )
})

ShrineLeftPanel.displayName = 'ShrineLeftPanel'
export default ShrineLeftPanel