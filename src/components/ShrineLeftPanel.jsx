'use client'

import React from 'react'
import Link from 'next/link'
import styles from './Matchstick.module.css'

/**
 * Consolidated left-side panel for the shrine page
 * Combines: Title, CTA text, and Matchstick into one cohesive unit
 */
export default function ShrineLeftPanel({ 
  is80sMode = false, 
  isMobile = false,
  onLightCandle,
  router 
}) {
  
  const handleMatchClick = () => {
    if (onLightCandle) {
      onLightCandle()
    }
  }

  return (
    <>
      {/* Vignette overlay - creates breathing room on the left */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: isMobile ? '100%' : '45%',
        height: '100%',
        background: isMobile 
          ? 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.5) 100%)'
          : 'linear-gradient(90deg, rgba(10,10,20,0.85) 0%, rgba(10,10,20,0.6) 40%, rgba(10,10,20,0.2) 70%, transparent 100%)',
        pointerEvents: 'none',
        zIndex: 3,
      }} />

      {/* Main content container - positioned as one cohesive unit */}
      <div style={{
        position: 'fixed',
        left: isMobile ? '50%' : '40px',
        bottom: isMobile ? '20px' : '12%',
        transform: isMobile ? 'translateX(-50%)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMobile ? 'center' : 'flex-start',
        gap: isMobile ? '16px' : '24px',
        zIndex: 100,
        pointerEvents: 'auto',
      }}>
        
        {/* Title - Desktop only, mobile has separate RL80 logo */}
        {!isMobile && (
          <h1 className='custom-title'
            id="main-title"
            onClick={() => router?.push('/carousel')}
            style={{ 
              color: is80sMode ? "#ffffff" : "#f6f5f1ff",
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
                  0 0 10px rgba(212, 175, 55, 0.8),
                  0 0 20px rgba(212, 175, 55, 0.6),
                  0 0 30px rgba(212, 175, 55, 0.8),
                  6px 6px 16px rgba(0, 0, 0, 1),
                  -2px -2px 8px rgba(255, 192, 203, 0.7),
                  0 0 100px rgba(212, 175, 55, 0.1)
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
        )}

        {/* CTA Text - Clean modern font */}
        <div style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          fontSize: isMobile ? '1.2rem' : '1.4rem',
          fontWeight: 300,
          color: 'rgba(246, 245, 241, 0.95)',
          textShadow: `
            0 0 20px rgba(212, 175, 55, 0.4),
            0 0 40px rgba(212, 175, 55, 0.2),
            2px 2px 4px rgba(0, 0, 0, 0.6)
          `,
          letterSpacing: '0.08em',
          textAlign: isMobile ? 'center' : 'left',
          lineHeight: 1.4,
        }}>
          <span style={{ 
            display: 'block',
            fontWeight: 400,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
          }}>
            Seek Her Favor
          </span>
          <span style={{ 
            display: 'block', 
            fontSize: isMobile ? '0.9rem' : '1rem',
            opacity: 0.8,
            marginTop: '6px',
            fontWeight: 300,
            fontStyle: 'italic',
          }}>
            Light a candle for blessings
          </span>
        </div>

        {/* Matchstick - Integrated with organic glow */}
        <div 
          className={styles.wrapper}
          onClick={handleMatchClick}
          style={{
            marginTop: isMobile ? '8px' : '16px',
          }}
        >
          <div className={styles.container}>
            <input type="checkbox" className={styles.switch} />
            
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
                <p>~~~~~~~~</p>
              </div>
            </div>
            
            <div className={styles.glowingArea}></div>
            <div className={styles.mainGlow}></div>
          </div>
        </div>

      </div>
    </>
  )
}