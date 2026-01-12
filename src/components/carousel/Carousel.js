'use client'

// import * as THREE from 'three' // Not needed when using OldsCoolTunnel
import { useRef, useState, Suspense, useMemo, useEffect } from 'react'
// import { Canvas, useFrame, useThree } from '@react-three/fiber' // Not needed when using OldsCoolTunnel
// import { Image, Environment, ScrollControls, useScroll, useTexture, Text } from '@react-three/drei' // Not needed when using OldsCoolTunnel
// import { easing } from 'maath' // Not needed when using OldsCoolTunnel
import './util'
import ExperienceControls from './ExperienceControls'
import { useMusic } from '../MusicContext'
import { useLanguage } from '../LanguageProvider'
import SkewedHeading from '../SkewedHeading'

import MobilePolaroidGallerySimple from './MobilePolaroidGallerySimple'
import OldsCoolTunnel from '../OldsCoolTunnel'

export default function CarouselComponent({ onReady, disableScrollControls = false, buyButton }) {
  const [hoveredCaption, setHoveredCaption] = useState(null)
  const [sceneReady, setSceneReady] = useState(false)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false)
  const [isMobilePhone, setIsMobilePhone] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 480 : false)
  const [isSmallPhone, setIsSmallPhone] = useState(() => typeof window !== 'undefined' ? window.innerHeight <= 700 : false)
  const [isTablet, setIsTablet] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 480 && window.innerWidth <= 1024 : false)
  const [isTabletPortrait, setIsTabletPortrait] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 480 && window.innerWidth <= 1024 && window.innerHeight > window.innerWidth : false)
  const [isTabletLandscape, setIsTabletLandscape] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 768 && window.innerWidth <= 1024 : false)
  const [isLargeTablet, setIsLargeTablet] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 820 && window.innerWidth <= 1024 : false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const { is80sMode } = useMusic()
  const { t } = useLanguage()
  
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth
      setIsMobile(width <= 768)
      // Check specifically for mobile phones (not tablets)
      setIsMobilePhone(width <= 480)
      // Check for tablets
      setIsTablet(width > 480 && width <= 1024)
      setIsTabletPortrait(width > 480 && width <= 1024 && window.innerHeight > width)
      setIsTabletLandscape(width > 768 && width <= 1024)
      setIsLargeTablet(width >= 820 && width <= 1024)
      // Check for small phones like iPhone SE
      setIsSmallPhone(window.innerHeight <= 700)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  // Set scene ready when using OldsCoolTunnel for desktop
  useEffect(() => {
    if (!isMobilePhone) {
      setTimeout(() => setSceneReady(true), 100)
    }
  }, [isMobilePhone])
  
  // Add ESC key handler to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    
    if (!isMobilePhone && isFullscreen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFullscreen, isMobilePhone])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear any pending timers
      if (onReady) {
        onReady = null
      }
    }
  }, [])
  
  useEffect(() => {
    if (sceneReady && onReady) {
      // Give a small delay for final rendering
      const timer = setTimeout(() => {
        onReady()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [sceneReady, onReady])
  
  return (
    <>
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes glow {
          0%, 100% { 
            filter: drop-shadow(0 0 20px rgba(255, 0, 255, 0.6)) 
                    drop-shadow(0 0 40px rgba(0, 255, 255, 0.4));
          }
          50% { 
            filter: drop-shadow(0 0 30px rgba(255, 0, 255, 0.8)) 
                    drop-shadow(0 0 60px rgba(0, 255, 255, 0.6));
          }
        }
      `}</style>
      <div style={{ 
        width: '100%', 
        height: '100vh', 
        backgroundColor: (is80sMode && isMobilePhone) ? 'transparent' : '#000',
        position: 'relative',
        overflow: isMobilePhone ? 'visible' : 'hidden'
      }}>
        {/* Video background for 80s mode - desktop only */}
        {is80sMode && !isMobilePhone && (
          <video
            autoPlay
            loop
            muted
            playsInline
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.8,
              zIndex: 1,
              pointerEvents: 'none',
            }}
          >
            <source src="/videos/84.mp4" type="video/mp4" />
          </video>
        )}
      
      
      {/* Experience Controls - positioned top-right */}
      {!isMobilePhone && <ExperienceControls isMobile={isMobile} />}
      
      {/* Desktop Intro Section - bottom-left overlay */}
      {/* {!isMobilePhone && (
        <div style={{
          position: 'fixed',
          bottom: '8%',
          left: '3%',
          zIndex: 20,
          maxWidth: '380px',
          padding: '10px',
          background: 'rgba(20, 15, 25, 0.85)',
          backdropFilter: 'blur(12px)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 215, 0, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          animation: 'fadeInUp 0.8s ease-out',
        }}>
          <h2 style={{
            fontSize: '26px',
            fontFamily: 'UnifrakturCook, serif',
            color: '#ffd700',
            marginBottom: '10px',
            marginTop: '10px',
            letterSpacing: '0.5px',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)',
          }}>
            {t('carousel.title') || 'Iconography'}
          </h2>
          <p style={{
            fontSize: '14px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            color: 'rgba(255, 255, 255, 0.85)',
            lineHeight: '1.5',
            margin: 0,
          }}>
            {t('carousel.subtitle') || 'A visual canon of Our Lady of Perpetual Profit, from antiquity to the future.'}
          </p>
          <p style={{
            fontSize: '14px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            color: 'rgba(255, 255, 255, 0.85)',
            lineHeight: '1.5',
            marginTop: '10px',
          }}>
            Or read the Techno-Mythic Whitepaper <a href="/philosophy" style={{
              color: '#ffd700',
              textDecoration: 'underline',
            }}>here ↗</a>
          </p>
        </div>
      )} */}
      
      {/* Mobile and Tablet Portrait Portal View */}
      {(isMobilePhone || isTabletPortrait) && !isFullscreen ? (
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: is80sMode ? 'transparent' : 'radial-gradient(ellipse at center, #1a1a2e 0%, #000 100%)',
          zIndex: 2,
        }}>
          {/* Heading */}
          {/* <h2 style={{
            fontFamily: "'UnifrakturMaguntia', serif",
            fontSize: isMobilePhone ? '2.5rem' : '3rem',
            color: '#ffd700',
            textAlign: 'center',
            marginBottom: '2rem',
            marginTop: '-2rem',
            textShadow: '0 0 30px rgba(255, 215, 0, 0.5), 3px 3px 6px rgba(0, 0, 0, 0.9)',
            letterSpacing: '0.08em',
            fontWeight: 'normal',
            animation: 'glow 3s ease-in-out infinite'
          }}>
            An Icon for the Ages
          </h2> */}
          <div style={{ marginBottom: (isMobilePhone || isTabletPortrait) ? '1.5rem' : '0' }}>
            <SkewedHeading
              lines={["A TIMELESS", "ICON FOR THE", "DIGITAL AGE"]}
              fontSize={isSmallPhone ? "1.6rem" : isMobilePhone ? "2.2rem" : isLargeTablet ? "3rem" : isTabletPortrait ? "2.5rem" : "3.5rem"}
              color="#00ff9d"
              skewAngle={-2}
              shadowColor="#000"
            />
          </div>
          
          {/* Sub-heading */}
          <p style={{
            fontFamily: "'Courier New', monospace",
            fontSize: isSmallPhone ? '0.7rem' : isMobilePhone ? '0.9rem' : isLargeTablet ? '1.2rem' : isTabletPortrait ? '1rem' : '1.2rem',
            color: '#ffd700',
            textAlign: 'center',
            marginTop: isSmallPhone ? '0.3rem' : isTabletPortrait ? '0.8rem' : '0.5rem',
            marginBottom: isSmallPhone ? '0.8rem' : isTabletPortrait ? '2rem' : '1rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            opacity: 0.9,
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)'
          }}>
            Journey Through Her Illustrious History
          </p>
          
          {/* Portal Preview Container with Frame Image */}
          <div 
            onClick={() => setIsFullscreen(true)}
            style={{
              position: 'relative',
              width: '90%',
              maxWidth: isSmallPhone ? '280px' : isMobilePhone ? '380px' : isLargeTablet ? '550px' : isTabletPortrait ? '450px' : '450px',
              aspectRatio: '4/3',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              transform: `perspective(1000px) rotateX(5deg) scale(${isSmallPhone ? 0.85 : 1})`,
              filter: 'drop-shadow(0 0 30px rgba(255, 215, 0, 0.5))'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'perspective(1000px) rotateX(2deg) scale(1.05)'
              e.currentTarget.style.filter = 'drop-shadow(0 0 60px rgba(255, 215, 0, 0.9)) brightness(1.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'perspective(1000px) rotateX(5deg) scale(1)'
              e.currentTarget.style.filter = 'drop-shadow(0 0 40px rgba(255, 215, 0, 0.6)) brightness(1)'
            }}
          >
            {/* Portal frame image */}
            <img 
              src="/images/timePortal.webp"
              alt="Time Portal"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                zIndex: 2,
                pointerEvents: 'none'
              }}
            />
            
            {/* OldsCoolTunnel animation inside the frame with perspective */}
            <div style={{
              position: 'absolute',
              top: '7%',  // Fine-tuned to center in frame
              left: '13%',  // Fine-tuned to center in frame
              width: '75%',  // Smaller to fit better
              height: '75%',  // Smaller to fit better
              overflow: 'hidden',
              background: is80sMode ? 'rgba(0, 0, 0, 0.7)' : '#000',
              borderRadius: '2px',
              boxShadow: 'inset 0 0 50px rgba(0, 0, 0, 0.8)',
              transformStyle: 'preserve-3d',
              perspective: '800px'
            }}>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '300%',  // Wider to show more of the tunnel
                height: '300%',  // Taller to show more of the tunnel
                // Combine all transforms in the correct order
                transform: `
                  translate(-50%, -50%)
                  rotateX(349deg)
                  rotateY(4deg)
                  rotateZ(356deg)
                  scale(0.3)
                `,
                transformOrigin: 'center center'
              }}>
                <OldsCoolTunnel isFullscreen={false} />
              </div>
            </div>
            
            {/* Portal Text Overlay */}
            <div style={{
              position: 'absolute',
              bottom: '-60px',
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              pointerEvents: 'none'
            }}>
              <h3 style={{
                fontFamily: "'UnifrakturMaguntia', serif",
                fontSize: '1.8rem',
                color: '#ffd700',
                margin: '0 0 5px 0',
                textShadow: '0 0 30px rgba(255, 215, 0, 0.8), 2px 2px 4px rgba(0, 0, 0, 0.8)',
                animation: 'glow 2s ease-in-out infinite',
                letterSpacing: '0.05em'
              }}>
                {/* ENTER THE TIME PORTAL */}
              </h3>
              {/* <p style={{
                fontFamily: "'Courier New', monospace",
                fontSize: '0.9rem',
                color: '#fff',
                margin: 0,
                textShadow: '0 0 10px rgba(255, 255, 255, 0.6), 1px 1px 2px rgba(0, 0, 0, 0.8)'
              }}>
                Tap to explore RL80 through the ages
              </p> */}
            </div>
          </div>
          
          {/* Additional info below portal */}
          <p style={{
            marginTop: '1rem',
            marginBottom: '1rem',
            fontFamily: "'Courier New', monospace",
            fontSize: isMobilePhone ? '0.75rem' : '0.9rem',
            color: '#888',
            textAlign: 'center',
            lineHeight: '1.4',
            
          }}>
            <span style={{            
            color: '#01ff00',
            textAlign: 'center',
            // fontFamily: 'monospace',
            animation: 'pulse 2s ease-in-out infinite',
}}>Tap to enter</span> • <a href="/philosophy" style={{ color: '#ffff00', textDecoration: 'underline' }}>Read whitepaper</a>
          </p>
        </div>
      ) : (isMobilePhone || isTabletPortrait) && isFullscreen ? (
        /* Fullscreen mobile view */
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh', 
          zIndex: 9999,
          pointerEvents: 'auto'
        }}>
          <OldsCoolTunnel isFullscreen={true} />
          
          {/* Exit fullscreen button */}
          <button
            onClick={() => setIsFullscreen(false)}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.8)',
              border: '2px solid #00ffff',
              color: '#00ffff',
              fontSize: '24px',
              cursor: 'pointer',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 255, 0.2)'
              e.currentTarget.style.transform = 'scale(1.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)'
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            ✕
          </button>
        </div>
      ) : !isFullscreen && !isTabletPortrait ? (
        /* Desktop and Tablet Landscape Portal View - 2-column layout */
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100vh',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: isTabletLandscape ? '2rem' : isTabletPortrait ? '1.5rem' : '5rem',
          padding: isTabletLandscape ? '0 3%' : isTabletPortrait ? '0 2%' : '0 5%',
          ...(is80sMode ? {
            backgroundImage: 'url("/images/retro.webp")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          } : {
            background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #000 100%)'
          }),
          zIndex: 2
        }}>
          {/* Left Column - Portal and Whitepaper Link */}
          <div style={{
            flex: isTabletPortrait ? '0 0 45%' : '1 1 50%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-end',
            gap: isTablet ? '1rem' : '2rem',
            top: '5%',
            position: 'relative',
            maxWidth: isTabletLandscape ? '450px' : isTabletPortrait ? '400px' : '650px'
          }}>
            {/* Portal Preview Container with Frame Image */}
            <div 
              onClick={() => setIsFullscreen(true)}
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: isTabletLandscape ? '400px' : isTabletPortrait ? '300px' : '600px',
                aspectRatio: '4/3',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                transform: `perspective(1000px) rotateX(5deg) scale(${isTabletLandscape ? 0.9 : isTabletPortrait ? 0.85 : 1})`,
                filter: 'drop-shadow(0 0 40px rgba(255, 215, 0, 0.6))'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'perspective(1000px) rotateX(2deg) scale(1.05)'
                e.currentTarget.style.filter = 'drop-shadow(0 0 80px rgba(255, 215, 0, 1)) brightness(1.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'perspective(1000px) rotateX(5deg) scale(1)'
                e.currentTarget.style.filter = 'drop-shadow(0 0 40px rgba(255, 215, 0, 0.6)) brightness(1)'
              }}
            >
              {/* Portal frame image */}
              <img 
                src="/images/timePortal.webp"
                alt="Time Portal"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  zIndex: 2,
                  pointerEvents: 'none'
                }}
              />
              
              {/* OldsCoolTunnel animation inside the frame */}
              <div style={{
                position: 'absolute',
                top: '9%',
                left: '13%',
                width: '75%',
                height: '73%',
                overflow: 'hidden',
                background: is80sMode ? 'rgba(0, 0, 0, 0.7)' : '#000',
                borderRadius: '2px',
                boxShadow: 'inset 0 0 50px rgba(0, 0, 0, 0.8)',
                transformStyle: 'preserve-3d',
                perspective: '800px'
              }}>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: '300%',
                  height: '300%',
                  // Combine all transforms in the correct order
                  transform: `
                    translate(-50%, -50%)
                    rotateX(2deg)
                    rotateY(358deg)
                    rotateZ(351deg)
                    scale(0.3)
                  `,
                  transformOrigin: 'center center'
                }}>
                  <OldsCoolTunnel isFullscreen={false} />
                </div>
              </div>
            </div>
             <div style={{
              transform: 'rotate(-11deg)',
              display: 'inline-block',
                  position: 'relative',
                top: '-3rem',
                // left: '-1rem'
                alignContent: 'center'
            }}>
              <p style={{
            
                fontFamily: "'Courier New', monospace",
                fontSize: '1rem',
                color: '#01ff00',
                animation: 'pulse 2s ease-in-out infinite',
              }}>
                Click the portal to enter
              </p>
            {/* </div> */}
            {/* Link to whitepaper - Under the portal */}
            <p style={{
              fontFamily: "'Courier New', monospace",
              fontSize: isTablet ? '0.85rem' : '1rem',
              color: '#888',
              textAlign: 'center',
              width: '100%',
              maxWidth: isTabletLandscape ? '400px' : isTabletPortrait ? '300px' : '600px'
            }}>
              📜 Read the <a href="/philosophy" style={{ 
                color: '#ffff00', 
                textDecoration: 'none',
                borderBottom: '1px solid #ffff00',
                transition: 'all 0.3s ease' 
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff'
                e.currentTarget.style.borderBottomColor = '#fff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#ffff00'
                e.currentTarget.style.borderBottomColor = '#ffff00'
              }}
              >Techno-Mythic Whitepaper</a>
            </p>
          </div>
          </div>
          
          {/* Right Column - Text Content */}
          <div style={{
            flex: isTabletPortrait ? '1 1 50%' : '1 1 50%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            maxWidth: isTabletLandscape ? '450px' : isTabletPortrait ? '400px' : '550px',
            paddingLeft: isTabletLandscape ? '1rem' : '2rem',
            paddingTop: '0',
  
          }}>
            {/* Heading for desktop */}
            <SkewedHeading
              lines={["A TIMELESS", "ICON FOR THE", "DIGITAL AGE"]}
              fontSize={isTabletLandscape ? "2.5rem" : isTabletPortrait ? "3rem" : "3.5rem"}
              color="#00ff9d"
              skewAngle={-2}
              shadowColor="#000"
            />
            
            {/* Sub-heading */}
            <p style={{
              fontFamily: "'Courier New', monospace",
              fontSize: isTabletLandscape ? '1rem' : isTabletPortrait ? '0.9rem' : '1.2rem',
              color: '#ffd700',
              textAlign: 'center',
              // marginTop: isTablet ? '1rem' : '1.5rem',
              // marginBottom: isTablet ? '1.5rem' : '2rem',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              opacity: 0.9,
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)'
            }}>
              Journey Through Her Illustrious History
            </p>
            
            {/* Description text */}
            <p style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize: isTabletLandscape ? '0.95rem' : isTabletPortrait ? '0.9rem' : '1.1rem',
              color: 'rgba(255, 255, 255, 0.85)',
              lineHeight: '1.6',
              marginBottom: isTablet ? '1.5rem' : '2rem',
              maxWidth: '450px',
              textAlign: 'center'
            }}>
              Explore the visual canon of Our Lady of Perpetual Profit, 
              from antiquity to the future. Witness her eternal presence 
              across millennia of human achievement.
            </p>
            
            {/* Click instruction */}
            
            {/* Buy Button for Desktop */}
            {buyButton}
          </div>
        </div>
      ) : (
        /* Desktop Fullscreen view */
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh', 
          zIndex: 9999,
          background: is80sMode ? 'transparent' : '#000'
        }}>
          <OldsCoolTunnel isFullscreen={true} />
          
          {/* Exit fullscreen button - styled for desktop */}
          <button
            onClick={() => setIsFullscreen(false)}
            style={{
              position: 'absolute',
              top: '30px',
              right: '30px',
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.8)',
              border: '2px solid #00ffff',
              color: '#00ffff',
              fontSize: '28px',
              cursor: 'pointer',
              zIndex: 10000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 255, 0.2)'
              e.currentTarget.style.transform = 'scale(1.1) rotate(90deg)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.8)'
              e.currentTarget.style.transform = 'scale(1) rotate(0deg)'
            }}
          >
            ✕
          </button>
          
          {/* Optional: Add "Press ESC to exit" hint */}
          {/* <div style={{
            position: 'absolute',
            bottom: '30px',
            left: '50%',
            transform: 'translateX(-50%)',
            color: '#00ffff',
            fontSize: '14px',
            fontFamily: "'Courier New', monospace",
            opacity: 0.7,
            textShadow: '0 0 10px rgba(0, 255, 255, 0.5)'
          }}>
            Press ESC to exit fullscreen
          </div> */}
        </div>
      )}
      
      </div>
    </>
  )
}
