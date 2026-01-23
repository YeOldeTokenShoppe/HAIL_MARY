'use client'

// import * as THREE from 'three' // Not needed when using OldsCoolTunnel
import { useRef, useState, Suspense, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
// import { Canvas, useFrame, useThree } from '@react-three/fiber' // Not needed when using OldsCoolTunnel
// import { Image, Environment, ScrollControls, useScroll, useTexture, Text } from '@react-three/drei' // Not needed when using OldsCoolTunnel
// import { easing } from 'maath' // Not needed when using OldsCoolTunnel
import './util'
import ExperienceControls from './ExperienceControls'
import { useMusic } from '../MusicContext'
import { useLanguage } from '../LanguageProvider'
import SkewedHeading from '../SkewedHeading'
import DropInTitle from '../DropInTitle'
import RetroFuturisticButton from '@/components/RetroFuturisticButton'
import MobilePolaroidGallerySimple from './MobilePolaroidGallerySimple'
import OldsCoolTunnel from '../OldsCoolTunnel'

import HolyGrail from '@/components/HolyGrail'
import HolyGrailPortal from '@/components/HolyGrailPortal'
import HolyGrailChalice from '@/components/HolyGrailChalice'
import TranslatableDropInTitle from '@/components/TranslatableDropInTitle'
import Footer from '@/components/Footer'

export default function CarouselComponent({ onReady, disableScrollControls = false, buyButton }) {
  const router = useRouter()
  const [hoveredCaption, setHoveredCaption] = useState(null)
  const [sceneReady, setSceneReady] = useState(false)
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 768 : false)
  const [isMobilePhone, setIsMobilePhone] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 480 : false)
  const [isSmallPhone, setIsSmallPhone] = useState(() => typeof window !== 'undefined' ? window.innerHeight <= 700 : false)
  const [isTablet, setIsTablet] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 480 && window.innerWidth <= 1024 : false)
  const [isTabletPortrait, setIsTabletPortrait] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 480 && window.innerWidth <= 1024 && window.innerHeight > window.innerWidth : false)
  const [isTabletLandscape, setIsTabletLandscape] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 768 && window.innerWidth <= 1024 : false)
  const [isPortraitOrientation, setIsPortraitOrientation] = useState(() => typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false)
  const [isLargeTablet, setIsLargeTablet] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 820 && window.innerWidth <= 1024 : false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const { is80sMode } = useMusic()
  const { t, locale } = useLanguage()
  
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
      setIsPortraitOrientation(window.innerHeight > width)
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
        minHeight: '100vh',
        backgroundColor: (is80sMode && isMobilePhone) ? 'transparent' : '#000',
        position: 'relative',
        overflowX: 'hidden',
        overflowY: 'auto'
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
      
      {/* Mobile and Portrait Portal View */}
      {(isMobilePhone || isPortraitOrientation) && !isFullscreen ? (
        <div style={{
          position: 'relative',
          width: '100%',
          minHeight: '100vh',
          top: '3rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: is80sMode ? 'transparent' : 'radial-gradient(ellipse at center, #1a1a2e 0%, #000 100%)',
          zIndex: 2,
          overflowX: 'hidden',
          overflowY: 'auto',
        }}>
          {/* ===== SECTION 1: OldsCoolTunnel Portal ===== */}
          <div style={{
            width: '100%',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobilePhone ? '1rem' : '2rem',
            position: 'relative',
          }}>
          {/* Our Lady of Perpetual Profit Logo - Top Left (Portrait view) */}
          {!isMobilePhone && (
            <h1 className='custom-title'
              id="main-title-portrait"
              style={{ 
                position: 'absolute',
                top: '2rem',
                left: '1.5rem',
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
                fontSize: isTabletPortrait ? "2rem" : "2.5rem",
                fontWeight: 900,
                lineHeight: 0.8,
                transform: "rotate(-8deg) skew(-15deg)",
                cursor: 'pointer',
                margin: 0,
                marginBottom: '20px',
                zIndex: 10
              }}
            >
              <span className="title-line" style={{ display: 'block', position: 'relative' }}>Our Lady</span>
              <span className="title-line" style={{ display: 'block', position: 'relative' }}>
                <span style={{ fontSize: isTabletPortrait ? "1.3rem" : "1.6rem" }}>of    </span>
                Perpetual
              </span>
              <span className="title-line" style={{ display: 'block', marginLeft: isTabletPortrait ? "3rem" : "3.5rem", position: 'relative' }}>Profit</span>
            </h1>
          )}
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
          {/* <div style={{ marginBottom: (isMobilePhone || isTabletPortrait) ? '1.5rem' : '0' }}> */}
            <SkewedHeading
              lines={["A TIMELESS", "ICON FOR THE", "DIGITAL AGE"]}
              fontSize={isSmallPhone ? "1.6rem" : isMobilePhone ? "2.2rem" : isLargeTablet ? "2.5rem" : isTabletPortrait ? "2.5rem" : "3rem"}
              color="#00ff9d"
              skewAngle={0}
              shadowColor="#000"
            />
          {/* </div> */}
          
          {/* Sub-heading */}
          <p style={{
            fontFamily: "'Courier New', monospace",
            fontSize: isSmallPhone ? '0.7rem' : isMobilePhone ? '0.9rem' : isLargeTablet ? '1.2rem' : isTabletPortrait ? '1rem' : '1.2rem',
            color: '#ffd700',
            textAlign: 'center',
            marginTop: isSmallPhone ? '0.3rem' : isTabletPortrait ? '0.8rem' : '0.5rem',
            marginBottom: isSmallPhone ? '0.5rem' : isTabletPortrait ? '1rem' : '0.5rem',
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
            fontSize: isSmallPhone ? '0.8rem' : isMobilePhone ? '0.9rem' : '1rem',
            color: 'rgba(255, 255, 255, 0.85)',
            lineHeight: '1.5',
            marginBottom: isSmallPhone ? '1rem' : '1.5rem',
            maxWidth: isSmallPhone ? '280px' : isMobilePhone ? '340px' : '450px',
            textAlign: 'center',
            padding: '0 1rem',
          }}>
            Take a roller coaster ride through time and see a collection of Our Lady of Perpetual Profit's most iconic moments, from antiquity to the future.
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
                height: 'auto',  // Taller to show more of the tunnel
                // Combine all transforms in the correct order
                transform: `
                  translate(-50%, -50%)
                  rotateX(-5deg)
                  rotateY(2deg)
                  rotateZ(-2deg)
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
            marginTop: '1.5rem',
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
            animation: 'pulse 2s ease-in-out infinite',
}}>Tap to enter</span> • <a href="/philosophy" style={{ color: '#ffff00', textDecoration: 'underline' }}>Read whitepaper</a>
          </p>

          {/* Buy Button for Mobile - at the bottom of Section 1 */}
          <div style={{ marginTop: '1rem', marginBottom: '2rem' }}>
            {buyButton}
          </div>

          </div>
          {/* End of Section 1 */}

          {/* ===== SECTION 2: HolyGrailPortal ===== */}
          <div style={{
            width: '100%',
            minHeight: isMobilePhone ? '80vh' : '90vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobilePhone ? '2rem 1rem' : '3rem 2rem',
            position: 'relative',
          }}>
            {/* Heading */}
            <SkewedHeading
              lines={["PROSPER80", "FOR ALL", "HUMAN80!"]}
              colors={["#00ff00", "#f4e4c1", "#ffd700"]}
              fontSize={{ mobile: isSmallPhone ? "1.6rem" : "2rem", desktop: "2.5rem" }}
              isMobile={true}
              language={locale}
            />

            {/* HolyGrailPortal Canvas */}
            <div style={{
              width: '100%',
              maxWidth: isMobilePhone ? '350px' : '500px',
              height: isMobilePhone ? '400px' : '550px',
              marginTop: '1.5rem',
              filter: 'drop-shadow(0 0 30px rgba(255, 215, 0, 0.4))',
            }}>
              <HolyGrailPortal isMobile={true} />
            </div>

            {/* Description */}
            <p style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize: isMobilePhone ? '0.9rem' : '1rem',
              color: 'rgba(255, 255, 255, 0.85)',
              lineHeight: '1.6',
              marginTop: '1.5rem',
              maxWidth: isMobilePhone ? '320px' : '450px',
              textAlign: 'center',
              padding: '0 1rem',
            }}>
              The Holy Grail of crypto awaits those who believe.
              Our Lady of Perpetual Profit bestows her blessings upon the faithful holders.
            </p>

            {/* Tokenomics Button */}
            <div style={{ marginTop: '1.5rem' }}>
              <Link href="/tokenomics" style={{ textDecoration: 'none' }}>
                <RetroFuturisticButton>
                  TOKENOMICS
                </RetroFuturisticButton>
              </Link>
            </div>

          </div>
          {/* End of Section 2 */}

          {/* ===== SECTION 3: HolyGrailChalice ===== */}
          <div style={{
            width: '100%',
            minHeight: isMobilePhone ? '80vh' : '90vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobilePhone ? '2rem 1rem' : '3rem 2rem',
            position: 'relative',
          }}>
            {/* Heading */}
            <SkewedHeading
              lines={["JOIN THE", "ENLIGHTENMENT", "TODAY"]}
             // colors={["#d4af37", "#f4e4c1", "#ffd700"]}
              fontSize={{ mobile: isSmallPhone ? "1.6rem" : "2rem", desktop: "2.5rem" }}
              isMobile={true}
              language={locale}
            />

            {/* HolyGrailChalice Canvas */}
            <div style={{
              width: '100%',
              maxWidth: isMobilePhone ? '350px' : '500px',
              height: isMobilePhone ? '350px' : '450px',
              marginTop: '1.5rem',
            }}>
              <HolyGrailChalice isMobile={true} />
            </div>

            {/* Description */}
            <p style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              fontSize: isMobilePhone ? '0.9rem' : '1rem',
              color: 'rgba(255, 255, 255, 0.85)',
              lineHeight: '1.6',
              marginTop: '1.5rem',
              maxWidth: isMobilePhone ? '320px' : '450px',
              textAlign: 'center',
              padding: '0 1rem',
            }}>
              Placeholder description text goes here. Replace this with actual content when ready.
            </p>

            {/* Illumin80 Button */}
            <div style={{ marginTop: '1.5rem' }}>
              <Link href="/illumin80" style={{ textDecoration: 'none' }}>
                <RetroFuturisticButton>
                  THE ILLUMIN80
                </RetroFuturisticButton>
              </Link>
            </div>
          </div>
          {/* End of Section 3 */}

          

          {/* Footer */}
          <div style={{marginTop: '-6rem'}}>
          <Footer />
</div>
        </div>
      ) : (isMobilePhone || isPortraitOrientation) && isFullscreen ? (
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
      ) : !isFullscreen && !isPortraitOrientation ? (
        /* Desktop and Tablet Landscape Portal View - Multi-row layout */
        <div style={{
          position: 'relative',
          width: '100%',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
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
          {/* Row 1: Portal and Text */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isTabletLandscape ? '2rem' : isTabletPortrait ? '1.5rem' : '1rem',
            padding: isTabletLandscape ? '0 3%' : isTabletPortrait ? '0 2%' : '0 5%',
            minHeight: '100vh',
            position: 'relative',
          }}>
          {/* Our Lady of Perpetual Profit Logo - Top Left */}
          <h1 className='custom-title'
            id="main-title"
            style={{ 
              position: 'absolute',
              top: '3rem',
              left: '2rem',
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
              fontSize: isTabletLandscape ? "2.5rem" : isTabletPortrait ? "2.2rem" : "3rem",
              fontWeight: 900,
              lineHeight: 0.8,
              transform: "rotate(-8deg) skew(-15deg)",
              cursor: 'pointer',
              margin: 0,
              marginBottom: '20px',
              zIndex: 10
            }}
          >
            <span className="title-line" style={{ display: 'block', position: 'relative' }}>Our Lady</span>
            <span className="title-line" style={{ display: 'block', position: 'relative' }}>
              <span style={{ fontSize: isTabletLandscape ? "1.6rem" : isTabletPortrait ? "1.4rem" : "2rem" }}>of    </span>
              Perpetual
            </span>
            <span className="title-line" style={{ display: 'block', marginLeft: "4rem", position: 'relative' }}>Profit</span>
          </h1>

          {/* Left Column - Text Content */}
          <div style={{
            flex: isTabletPortrait ? '1 1 50%' : '1 1 50%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            maxWidth: isTabletLandscape ? '450px' : isTabletPortrait ? '400px' : '550px',
            paddingRight: isTabletLandscape ? '1rem' : '2rem',
            paddingTop: '10%',

          }}>
            {/* Heading for desktop */}
            <SkewedHeading
              lines={["A TIMELESS", "ICON FOR THE", "DIGITAL AGE"]}
              fontSize={isSmallPhone ? "1.6rem" : isMobilePhone ? "2.2rem" : isLargeTablet ? "3rem" : isTabletPortrait ? "2.5rem" : "3.5rem"}
              color="#00ff9d"
              skewAngle={0}
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
              Take a roller coaster ride through time and see a collection of Our Lady of Perpetual Profit's most iconic moments,
              from antiquity to the future.
            </p>

            {/* Click instruction */}

            {/* Buy Button for Desktop */}
            {buyButton}

          </div>

          {/* Right Column - Portal and Whitepaper Link */}
          <div style={{
            flex: isTabletPortrait ? '0 0 45%' : '1 1 50%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            gap: isTablet ? '1rem' : '2rem',
            top: '3rem',
            right: '-2rem',
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
                  pointerEvents: 'none',
                  transform: 'scaleX(-1)'
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
                  height: 'auto',
                  // Combine all transforms in the correct order
                  transform: `
                    translate(-50%, -50%)
                    rotateX(5deg)
                    rotateY(-12deg)
                    rotateZ(8deg)
                    scale(0.3)
                  `,
                  transformOrigin: 'center center'
                }}>
                  <OldsCoolTunnel isFullscreen={false} />
                </div>
              </div>
            </div>
             <div style={{
              transform: 'rotate(11deg)',
              display: 'inline-block',
                  position: 'relative',
                top: '-3rem',
                right: '-2rem',
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
          </div>
          {/* End of Row 1 */}

          {/* Row 2: DropInTitle on Left, HolyGrail on Right (alternated layout) */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isTabletLandscape ? '2rem' : isTabletPortrait ? '1.5rem' : '1rem',
            padding: isTabletLandscape ? '3% 3%' : isTabletPortrait ? '3% 2%' : '3% 5%',
            minHeight: '90vh',
            position: 'relative',
            overflow: 'visible',
          }}>
            {/* Left Column - HolyGrail Portal (3D pass-through effect) */}
            <div style={{
              flex: isTabletPortrait ? '1 1 55%' : '1 1 55%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              maxWidth: isTabletLandscape ? '600px' : isTabletPortrait ? '550px' : '800px',
              position: 'relative',
              overflow: 'visible',
            }}>
              {/* Portal Container */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: isTabletLandscape ? '550px' : isTabletPortrait ? '500px' : '700px',
                  height: isTabletLandscape ? '600px' : isTabletPortrait ? '550px' : '750px',
                  transition: 'all 0.3s ease',
                  filter: 'drop-shadow(0 0 40px rgba(255, 215, 0, 0.5))',
                  overflow: 'visible',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'drop-shadow(0 0 70px rgba(255, 215, 0, 0.9)) brightness(1.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'drop-shadow(0 0 40px rgba(255, 215, 0, 0.5)) brightness(1)'
                }}
              >
                {/* HolyGrail Portal Canvas */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  overflow: 'visible',
                  pointerEvents: 'auto',
                }}>
                  <HolyGrailPortal isMobile={false} />
                </div>
              </div>
            </div>

            {/* Right Column - Title and Text */}
            <div style={{
              flex: isTabletPortrait ? '0 0 45%' : '1 1 50%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              maxWidth: isTabletLandscape ? '450px' : isTabletPortrait ? '400px' : '550px',
              paddingLeft: isTabletLandscape ? '1rem' : '2rem',
            }}>
              {/* TranslatableDropInTitle */}
              <SkewedHeading
                lines={["PROSPER80", "FOR ALL", "HUMAN80!"]}
              colors={["#00ff00", "#f4e4c1", "#ffd700"]}
                fontSize={{ mobile: "2rem", desktop: isTabletLandscape ? "2.5rem" : "3.5rem" }}
                isMobile={false}
                language={locale}
              />

              {/* Description text */}
              <p style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: isTabletLandscape ? '0.95rem' : isTabletPortrait ? '0.9rem' : '1.1rem',
                color: 'rgba(255, 255, 255, 0.85)',
                lineHeight: '1.6',
                marginTop: '2rem',
                marginBottom: isTablet ? '1.5rem' : '2rem',
                maxWidth: '450px',
                textAlign: 'center'
              }}>
                Deadlights jack lad schooner scallywag dance the hempen jig carouser broadside cable strike colors. Bring a spring upon her cable holystone blow the man down spanker Shiver me timbers to go on account lookout wherry doubloon chase. Belay yo-ho-ho keelhaul squiffy black spot yardarm spyglass sheet transom heave to.
              </p>

              {/* Tokenomics Button */}
              <Link href="/tokenomics" style={{ textDecoration: 'none' }}>
                <RetroFuturisticButton>
                  TOKENOMICS
                </RetroFuturisticButton>
              </Link>
            </div>

          </div>
          {/* End of Row 2 */}

          
          {/* Row 3: Text on Left, Placeholder Component on Right */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isTabletLandscape ? '2rem' : isTabletPortrait ? '1.5rem' : '1rem',
            padding: isTabletLandscape ? '3% 3%' : isTabletPortrait ? '3% 2%' : '3% 5%',
            minHeight: '90vh',
            position: 'relative',
            overflow: 'visible',
          }}>
            {/* Left Column - Text Content */}
            <div style={{
              flex: isTabletPortrait ? '0 0 45%' : '1 1 50%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              maxWidth: isTabletLandscape ? '450px' : isTabletPortrait ? '400px' : '550px',
              paddingRight: isTabletLandscape ? '1rem' : '2rem',
            }}>
              <SkewedHeading
                lines={["JOIN THE", "ENLIGHTENMENT", "TODAY"]}
                colors={["#00ff00", "#f4e4c1", "#ffd700"]}
                fontSize={{ mobile: "2rem", desktop: isTabletLandscape ? "2.5rem" : "3.5rem" }}
                isMobile={false}
                language={locale}
                  //  scramble={true}  
              />
              {/* <SkewedHeading                                                                     
    lines={['WELCOME', 'TO CIRCUS']}                                                 
    scramble={true}                                                                  
  />                                                                                  */}
     

              <p style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                fontSize: isTabletLandscape ? '0.95rem' : isTabletPortrait ? '0.9rem' : '1.1rem',
                color: 'rgba(255, 255, 255, 0.85)',
                lineHeight: '1.6',
                marginTop: '2rem',
                marginBottom: isTablet ? '1.5rem' : '2rem',
                maxWidth: '450px',
                textAlign: 'center'
              }}>
                Devote a green candle to the charts by burning 1 or more RL80 tokens. Top 20% of burners are
                automatically qualified for The Illumin80 - part mystery cult, part trading guild. Illumin80 qualify for special perks, like a custom candle that never melts, plus a 1.25x multiplier for staking rewards.
              </p>

              {/* Illumin80 Button */}
              <Link href="/illumin80" style={{ textDecoration: 'none' }}>
                <RetroFuturisticButton>
                  THE ILLUMIN80
                </RetroFuturisticButton>
              </Link>

            </div>

            {/* Right Column - Placeholder Component */}
            <div style={{
              flex: isTabletPortrait ? '1 1 55%' : '1 1 55%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              maxWidth: isTabletLandscape ? '600px' : isTabletPortrait ? '550px' : '800px',
              position: 'relative',
              overflow: 'visible',
            }}>
              {/* HolyGrail Chalice Canvas */}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: isTabletLandscape ? '550px' : isTabletPortrait ? '500px' : '700px',
                  height: isTabletLandscape ? '500px' : isTabletPortrait ? '450px' : '600px',
                  transition: 'all 0.3s ease',
                  // filter: 'drop-shadow(0 0 40px rgba(255, 215, 0, 0.5))',
                }}
                // onMouseEnter={(e) => {
                //   e.currentTarget.style.filter = 'drop-shadow(0 0 70px rgba(255, 215, 0, 0.9)) brightness(1.1)'
                // }}
                // onMouseLeave={(e) => {
                //   e.currentTarget.style.filter = 'drop-shadow(0 0 40px rgba(255, 215, 0, 0.5)) brightness(1)'
                // }}
              >
                <HolyGrailChalice isMobile={false} />
              </div>

                      {/* Navigation Group - In content flow below buy button */}
            {!isMobilePhone && (
              <div 
                className="navigation-group"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0',
                  transform: 'scale(1.2)',
                  transformOrigin: 'center',
                  marginTop: '15%',
                  justifyContent: 'center',
                  position: 'relative',
                  right: '-35%'
                }}
              >
                {/* Arrow with text */}
                <svg
                  style={{
                    width: '260px',
                    height: '110px',
                    marginRight: '-25%',
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                  }}
                  viewBox="0 0 300 150"
                  onClick={() => router.push('/illumin80')}
                  onMouseEnter={(e) => {
                    const text = e.currentTarget.querySelector('text');
                    const arrow = e.currentTarget.querySelector('#arrowPath');
                    const arrowHead = e.currentTarget.querySelector('.arrow-head');
                    if (text) {
                      text.style.fontSize = '32';
                      text.style.fill = '#ffffff';
                      text.style.filter = 'url(#glow) drop-shadow(0 0 10px #ffcc00)';
                    }
                    if (arrow) {
                      arrow.style.strokeWidth = '3.5';
                      arrow.style.filter = 'url(#glow) drop-shadow(0 0 15px #ff9500)';
                    }
                    if (arrowHead) {
                      arrowHead.style.strokeWidth = '3.5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    const text = e.currentTarget.querySelector('text');
                    const arrow = e.currentTarget.querySelector('#arrowPath');
                    const arrowHead = e.currentTarget.querySelector('.arrow-head');
                    if (text) {
                      text.style.fontSize = '28';
                      text.style.fill = '#ffcc00';
                      text.style.filter = 'url(#candleGlow)';
                    }
                    if (arrow) {
                      arrow.style.strokeWidth = '2.5';
                      arrow.style.filter = 'url(#glow)';
                    }
                    if (arrowHead) {
                      arrowHead.style.strokeWidth = '2.5';
                    }
                  }}
                >
                  {/* Define gradients and filters */}
                  <defs>
                    <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
                      <stop offset="50%" stopColor="#ffcc00" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#ff9500" stopOpacity="1" />
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                    <filter id="candleGlow">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feFlood floodColor="#ff9500" floodOpacity="0.4"/>
                      <feComposite in2="coloredBlur" operator="in"/>
                      <feMerge>
                        <feMergeNode/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>
                  
                  {/* Curved arrow path */}
                  <path
                    id="arrowPath"
                    d="M 20 100 Q 100 40, 200 60"
                    stroke="url(#arrowGradient)"
                    strokeWidth="2.5"
                    fill="none"
                    filter="url(#glow)"
                    strokeLinecap="round"
                    opacity="0.9"
                  >
                    <animate
                      attributeName="stroke-opacity"
                      values="0.6;1;0.6"
                      dur="2.5s"
                      repeatCount="indefinite"
                    />
                  </path>
                  
                  {/* Invisible path for text (offset above the arrow) */}
                  <path
                    id="textPath"
                    d="M 20 85 Q 100 25, 200 45"
                    fill="none"
                    stroke="none"
                  />
                  
                  {/* Arrow head */}
                  <path
                    className="arrow-head"
                    d="M 195 55 L 205 60 L 195 65"
                    stroke="url(#arrowGradient)"
                    strokeWidth="2.5"
                    fill="none"
                    filter="url(#glow)"
                    strokeLinecap="round"
                  >
                    <animate
                      attributeName="stroke-opacity"
                      values="0.6;1;0.6"
                      dur="2.5s"
                      repeatCount="indefinite"
                    />
                  </path>
                  
                  {/* Text along path */}
                  <text
                    fill="#ffcc00"
                    fontSize="28"
                    fontFamily="'UnifrakturMaguntia', cursive"
                    filter="url(#candleGlow)"
                    style={{ 
                      transition: "all 0.3s ease",
                      textShadow: "2px 2px 8px rgba(0, 0, 0, 0.9), 4px 4px 12px rgba(0, 0, 0, 0.7)",
                      filter: "url(#candleGlow) drop-shadow(3px 3px 6px rgba(0, 0, 0, 0.8))"
                    }}
                  >
                    <textPath href="#textPath" startOffset="0">
                      The Illumin80
                    </textPath>
                    <animate
                      attributeName="fill-opacity"
                      values="0.7;1;0.7"
                      dur="3s"
                      repeatCount="indefinite"
                    />
                  </text>
                  
                  {/* Floating particles */}
                  {[...Array(6)].map((_, i) => (
                    <circle
                      key={i}
                      r="1.5"
                      fill="#ffcc00"
                      filter="url(#glow)"
                    >
                      <animateMotion
                        dur={`${4 + i}s`}
                        repeatCount="indefinite"
                        path="M 20 100 Q 100 40, 200 60"
                      >
                        <mpath href="#arrowPath" />
                      </animateMotion>
                      <animate
                        attributeName="opacity"
                        values="0;1;0"
                        dur={`${4 + i}s`}
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="r"
                        values="0.5;2;0.5"
                        dur={`${4 + i}s`}
                        repeatCount="indefinite"
                      />
                    </circle>
                  ))}
                </svg>
                
                {/* Skull button */}
                <div 
                  style={{
                    width: '70px',
                    height: '70px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'transform 0.3s ease, filter 0.3s ease',
                  }}
                  onClick={() => router.push('/illumin80')}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.15) rotate(-5deg)';
                    e.currentTarget.style.filter = 'drop-shadow(0 0 20px #ff9500)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
                    e.currentTarget.style.filter = 'none';
                  }}
                >
                  <img 
                    src="/images/SKULL_TATTOO.webp"
                    alt="Navigate to Illumin80"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                    }}
                  />
                </div>
              </div>
            )}

            </div>
            
          </div>
          {/* End of Row 3 */}

          {/* Footer */}
          <Footer />

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
          
          {/* Our Lady of Perpetual Profit Logo - Top Left (in fullscreen) */}
          <h1 className='custom-title'
            id="main-title-fullscreen"
            style={{ 
              position: 'absolute',
              top: '3rem',
              left: '2rem',
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
              fontSize: isTabletLandscape ? "2.5rem" : isTabletPortrait ? "2.2rem" : "3rem",
              fontWeight: 900,
              lineHeight: 0.8,
              transform: "rotate(-8deg) skew(-15deg)",
              cursor: 'pointer',
              margin: 0,
              marginBottom: '20px',
              zIndex: 10001
            }}
          >
            <span className="title-line" style={{ display: 'block', position: 'relative' }}>Our Lady</span>
            <span className="title-line" style={{ display: 'block', position: 'relative' }}>
              <span style={{ fontSize: isTabletLandscape ? "1.6rem" : isTabletPortrait ? "1.4rem" : "2rem" }}>of    </span>
              Perpetual
            </span>
            <span className="title-line" style={{ display: 'block', marginLeft: "4rem", position: 'relative' }}>Profit</span>
          </h1>
          
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
           <style dangerouslySetInnerHTML={{ __html: `
        @font-face {
          font-family: 'UnifrakturMaguntia';
          src: url('/fonts/UnifrakturMaguntia-Regular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        
        /* Responsive scaling for smaller viewports */
        @media screen and (max-width: 1400px), screen and (max-height: 800px) {
          .navigation-group {
            transform: scale(1.0) !important;
          }
        }
        
        /* Medium viewports */
        @media screen and (max-width: 1200px), screen and (max-height: 700px) {
          .navigation-group {
            transform: scale(0.85) !important;
          }
        }
        
        /* Prevent overlaps on very small windows */
        @media screen and (max-width: 900px) and (max-height: 600px) {
          .navigation-group {
            transform: scale(0.65) !important;
            bottom: 10px !important;
            right: 10px !important;
          }
        }
        
        #text, .text__copy {
          font-family: 'UnifrakturMaguntia', serif !important;

  
          .cyber-candle-btn {
            position: relative;
          }
          
          .cyber-candle-btn::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 150%;
            height: 150%;
            background: radial-gradient(ellipse at center, 
              rgba(153, 69, 255, 0.9) 0%,
              rgba(0, 255, 255, 0.7) 20%,
              rgba(153, 69, 255, 0.4) 40%,
              rgba(0, 255, 255, 0.2) 60%,
              transparent 80%
            );
            filter: blur(30px);
            animation: pulseGlow 2s ease-in-out infinite;
            pointer-events: none;
            z-index: -1;
          }
          
          @keyframes pulseGlow {
            0%, 100% {
              opacity: 0.8;
              transform: translate(-50%, -50%) scale(1);
            }
            50% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1.1);
            }
          }
          
          .cyber-candle-btn:hover::before {
            animation: pulseGlow 1s ease-in-out infinite;
            filter: blur(25px);
            background: radial-gradient(ellipse at center, 
              rgba(153, 69, 255, 0.8) 0%,
              rgba(0, 255, 255, 0.6) 25%,
              rgba(255, 0, 102, 0.3) 50%,
              transparent 70%
            );
          }
          
          .cyber-candle-btn :global(.cybr-btn) {
            --primary: #9945ff;
            --shadow-primary: #00ffff;
            --shadow-secondary-hue: 340;
            --color: white;
            position: relative;
            z-index: 1;
          }
          .cyber-candle-btn :global(.cybr-btn:hover) {
            --primary: #7c37d0;
            --shadow-primary: #00ffff;
            box-shadow: 
              0 0 30px rgba(153, 69, 255, 0.8),
              0 0 60px rgba(0, 255, 255, 0.6),
              0 0 90px rgba(153, 69, 255, 0.4);
          }
          .cyber-candle-btn :global(.cybr-btn:active) {
            --primary: #6b2fb5;
            --shadow-primary: #00ffff;
          }
          .cyber-candle-btn :global(.cybr-btn__glitch) {
            background: linear-gradient(45deg, #00ffff, #9945ff);
            text-shadow: 2px 2px #ff0066, -2px -2px #00ffff;
          }
          .cyber-candle-btn :global(.cybr-label) {
            background: linear-gradient(45deg, #00ffff, #ff0066);
            color: #000;
            font-weight: 900;
          }

        }
      `}} />
      
        </div>
        
      )}
      
      </div>
    </>
  )
}
