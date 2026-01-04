'use client'

import React, { useState, useEffect, useRef, Suspense } from 'react'
import { createPortal } from 'react-dom'
import NavControlsHome from '@/components/NavControlsHome'
import CyberNav from '@/components/CyberNav'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { useMusic } from '@/components/MusicContext'
import UnifiedShrine from '@/components/UnifiedShrine'
import ThirdwebBuyModal from '@/components/ThirdwebBuyModal'
import { useRouter } from 'next/navigation'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// Tiny Votive Model Component

export default function ShrinePage() {
  const router = useRouter()
  const { user } = useUser()
  const { 
    play, 
    pause, 
    isPlaying: contextIsPlaying, 
    nextTrack,
    is80sMode: context80sMode, 
    setIs80sMode: setContext80sMode
  } = useMusic()
  const [isMobileView, setIsMobileView] = useState(false)
  const [isMobileDevice, setIsMobileDevice] = useState(false)
  const [fontLoaded, setFontLoaded] = useState(false)
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [currentView, setCurrentView] = useState('shrine')
  const is80sMode = context80sMode
  
  // State for offerings data
  const [hoveredOffering, setHoveredOffering] = useState(null)
  const [justLitOffering, setJustLitOffering] = useState(null)
  const [priceChange, setPriceChange] = useState(0)
  
  // Mock offerings data
  const [mockOfferings, setMockOfferings] = useState([
    { 
      name: 'chelleville', 
      type: 'petition', 
      message: 'May my bags pump eternally', 
      tokensBurned: 1000,
      timestamp: '2m ago'
    },
    { 
      name: 'degen_mike', 
      type: 'appreciation', 
      message: 'Thanks for the 10x Our Lady 🚀', 
      tokensBurned: 5000,
      timestamp: '5m ago'
    },
    { 
      name: 'cryptopriest', 
      type: 'confession', 
      message: 'I sold the bottom... forgive me', 
      tokensBurned: 2500,
      timestamp: '12m ago'
    },
    { 
      name: 'hodlqueen', 
      type: 'petition', 
      message: 'Deliver us from paper hands', 
      tokensBurned: 10000,
      timestamp: '1h ago'
    },
    { 
      name: 'anonymous', 
      type: 'appreciation', 
      message: null, 
      tokensBurned: 500,
      timestamp: '2h ago'
    },
  ])

  // Check if font is loaded and add fonts-loaded class
  useEffect(() => {
    const checkFont = async () => {
      try {
        await document.fonts.load("1em 'UnifrakturMaguntia'");
        setFontLoaded(true);
        // Add the fonts-loaded class to make the font visible
        document.documentElement.classList.add('fonts-loaded');
      } catch (e) {
        setTimeout(() => {
          setFontLoaded(true);
          document.documentElement.classList.add('fonts-loaded');
        }, 100);
      }
    };
    checkFont();
  }, []);

  // Check if mobile view and device
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth <= 768;
      setIsMobileView(isMobile);
      setIsMobileDevice(isMobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Listen for openBuyModal event
  useEffect(() => {
    const handleOpenBuyModal = () => {
      setShowBuyModal(true);
    };
    
    window.addEventListener('openBuyModal', handleOpenBuyModal);
    return () => window.removeEventListener('openBuyModal', handleOpenBuyModal);
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @font-face {
          font-family: 'UnifrakturMaguntia';
          src: url('/fonts/UnifrakturMaguntia-Regular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        
        #text, .text__copy {
          font-family: 'UnifrakturMaguntia', serif !important;
        }
      `}} />
      
      {/* Unified Shrine Scene */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 1
      }}>
        <UnifiedShrine 
          offerings={mockOfferings}
          onSelectOffering={setHoveredOffering}
          onLightCandle={(offering) => {
            setMockOfferings(prev => [offering, ...prev])
            setJustLitOffering(offering)
            setTimeout(() => setJustLitOffering(null), 3000)
          }}
          onPriceChange={setPriceChange}
          is80sMode={is80sMode}
          hoveredOffering={hoveredOffering}
          justLitOffering={justLitOffering}
          onJustLitComplete={() => setJustLitOffering(null)}
        />
      </div>
      
      
      {/* Navigation Toggle */}
      {/* <div style={{
        position: "fixed",
        bottom: "30px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 998,
      }}>
        <Link href="/carousel" style={{ textDecoration: 'none' }}>
          <div 
            style={{
              position: 'relative',
              width: '240px',
              height: '50px',
              background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
              border: '2px solid #00ff66',
              borderRadius: '25px',
              overflow: 'hidden',
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(0, 255, 102, 0.3), inset 0 0 20px rgba(0, 0, 0, 0.8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9945ff',
              fontFamily: "'Courier New', monospace",
              fontWeight: 'bold',
              fontSize: '14px',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            ← Back to Lore
          </div>
        </Link>
      </div> */}
      
      {/* RL80 Logo - Top Left */}
      {fontLoaded && (
        <div style={{
          position: "fixed",
          top: "20px", 
          left: "20px",
          borderRadius: "8px",
          padding: "10px",
          pointerEvents: "auto",
          zIndex: 10,
        }}>
          <div 
            id="text"
            style={{
              position: "relative",
              fontFamily: "'UnifrakturMaguntia', serif",
              fontSize: isMobileView ? "3rem" : "4rem",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            <Link href="/home" style={{ textDecoration: 'none', color: 'inherit', display: 'inline-block' }}>
              RL80
            </Link>
            {Array.from({length: 100}).map((_, i) => {
              const index = i + 1;
              const r80s = 201 - index * 2;
              const g80s = 55 - index * 3;
              const b80s = 256 - index * 2;
              const rNormal = 255 - index * 2;
              const gNormal = 255 - index * 3;
              const bNormal = 255 - index * 2;
              const translateX = index * 0.1;
              const translateY = index * 0.1;
              const scale = 1 + index * 0.01;
              
              const color80s = 'rgba(' + r80s + ', ' + g80s + ', ' + b80s + ')';
              const colorNormal = 'rgba(' + rNormal + ', ' + gNormal + ', ' + bNormal + ')';
              const transformStr = 'translate(' + translateX + 'rem, ' + translateY + 'rem) scale(' + scale + ')';
              
              return (
                <div
                  key={index}
                  className="text__copy"
                  style={{
                    position: "absolute",
                    pointerEvents: "none",
                    zIndex: -1,
                    top: 0,
                    left: 0,
                    color: is80sMode ? color80s : colorNormal,
                    filter: "blur(0.1rem)",
                    transform: transformStr,
                    opacity: (1 / index) * 1.5,
                  }}
                >
                  RL80
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Nav Controls - Top Right */}
      <div style={{
        position: "absolute",
        top: "1rem",
        right: "1rem",
        zIndex: 300
      }}>
        <NavControlsHome 
          isPlaying={contextIsPlaying}
          onPlayMusic={() => play()}
          onStopMusic={() => pause()}
          onSkipTrack={() => nextTrack()}
          onMenuClick={() => setIsMenuOpen(!isMenuOpen)}
          onUserClick={() => {}}
          isUserSignedIn={!!user}
          isMenuOpen={isMenuOpen}
          is80sMode={is80sMode}
          onToggle80sMode={() => setContext80sMode(!is80sMode)}
          userImage={user?.imageUrl}
        />
      </div>
      
      {/* CyberNav Menu Panel */}
      <CyberNav 
        is80sMode={is80sMode}
        position="fixed"
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        showButton={false}
      />
      
      {/* Thirdweb Buy Modal */}
      <ThirdwebBuyModal 
        isOpen={showBuyModal} 
        onClose={() => setShowBuyModal(false)}
      />
      
      {/* RL80 Logo - Top Left - Using Portal to ensure it's on top */}
      {typeof document !== 'undefined' && createPortal(
        <div style={{
          position: "fixed",
          top: "20px", 
          left: "20px",
          borderRadius: "8px",
          padding: "10px",
          pointerEvents: "auto",
          zIndex: 99999,
        }}>
          <div 
            id="text"
            style={{
              position: "relative",
              fontFamily: "'UnifrakturMaguntia', serif",
              fontSize: isMobileView ? "3rem" : "4rem",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            <Link href="/home" style={{ textDecoration: 'none', color: 'inherit', display: 'inline-block' }}>
              RL80
            </Link>
            {Array.from({length: 100}).map((_, i) => {
              const index = i + 1;
              return (
                <div
                  key={index}
                  className="text__copy"
                  style={{
                    position: "absolute",
                    pointerEvents: "none",
                    zIndex: -1,
                    top: 0,
                    left: 0,
                    color: is80sMode 
                      ? `rgba(${201 - index * 2}, ${55 - index * 3}, ${256 - index * 2})` 
                      : `rgba(${255 - index * 2}, ${255 - index * 3}, ${255 - index * 2})`,
                    filter: "blur(0.1rem)",
                    transform: `translate(${index * 0.1}rem, ${index * 0.1}rem) scale(${1 + index * 0.01})`,
                    opacity: (1 / index) * 1.5,
                  }}
                >
                  RL80
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}