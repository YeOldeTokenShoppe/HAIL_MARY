"use client";

import React, { useState, useEffect } from "react";
import PalmTreeDrive from '@/components/PalmTreeDrive';
import { useMusic } from '@/components/MusicContext';
import Link from 'next/link';
import CyberNav from '@/components/CyberNav';
import CoinLoader from '@/components/CoinLoader';




export default function Home() {
  
  const [isSceneLoading, setIsSceneLoading] = useState(true);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(typeof window !== 'undefined' ? window.innerWidth <= 768 : false);
  
  // Get music context functions
  const { 
    play, 
    pause, 
    isPlaying: contextIsPlaying, 
    nextTrack, 
    currentTrack, 
    is80sMode 
  } = useMusic();
  
  // Show music controls if music is already playing
  const [showMusicControls, setShowMusicControls] = useState(contextIsPlaying);
  
  // Sync showMusicControls with playing state when it changes
  useEffect(() => {
    if (contextIsPlaying && !showMusicControls) {
      setShowMusicControls(true);
    }
  }, [contextIsPlaying]);
  
  // Check if font is loaded
  useEffect(() => {
    const checkFont = async () => {
      try {
        await document.fonts.load("1em 'UnifrakturMaguntia'");
        console.log('Font loaded successfully');
        setFontLoaded(true);
        // Add fonts-loaded class to body and html to reveal hidden font elements
        document.body.classList.add('fonts-loaded');
        document.documentElement.classList.add('fonts-loaded');
      } catch (e) {
        console.log('Font loading error:', e);
        setTimeout(() => {
          setFontLoaded(true);
          // Add fonts-loaded class even on error after timeout
          document.body.classList.add('fonts-loaded');
          document.documentElement.classList.add('fonts-loaded');
        }, 100);
      }
    };
    checkFont();
  }, []);
  
  // Check if mobile view and ensure touch scrolling works
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth <= 768;
      setIsMobileView(isMobile);
      setIsMobileDevice(isMobile);
      
      // Ensure touch scrolling is enabled
      if (isMobile || 'ontouchstart' in window) {
        document.body.style.overflow = 'auto';
        document.body.style.height = 'auto';
        document.body.style.touchAction = 'manipulation';
        document.body.style.WebkitOverflowScrolling = 'touch';
        document.documentElement.style.overflow = 'auto';
        document.documentElement.style.height = 'auto';
        document.documentElement.style.touchAction = 'manipulation';
        document.documentElement.style.WebkitOverflowScrolling = 'touch';
      }
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  
  // Debug logging
  useEffect(() => {
    console.log('RL80 Logo Debug:', {
      isSceneLoading,
      fontLoaded,
      shouldShowLogo: !isSceneLoading && fontLoaded
    });
  }, [isSceneLoading, fontLoaded]);

  return (
    <div style={{ width: '100vw', minHeight: '100vh' }}>
      {/* Show loader when scene is loading */}
      {isSceneLoading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
          zIndex: 9999
        }}>
          <CoinLoader loading={isSceneLoading} />
        </div>
      )}
      
      <PalmTreeDrive 
        onLoadingChange={setIsSceneLoading}
      />
      
      {/* Add inline keyframes for spin animation and font */}
      <style jsx global>{`
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
        
        @keyframes rotateVinyl {
          0% { transform: rotateZ(0deg); }
          100% { transform: rotateZ(360deg); }
        }
        .spinning-record {
          animation: rotateVinyl 3s linear infinite;
          transform: rotateZ(0deg);
        }
      `}</style>
      
      {/* RL80 Logo - Top Left */}
      {!isSceneLoading && (
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
            <Link href="/home3" style={{ textDecoration: 'none', color: 'inherit', display: 'inline-block' }}>
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
                    transform: `translate(
                      ${index * 0.1}rem, 
                      ${index * 0.1}rem
                    ) scale(${1 + index * 0.01})`,
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
      
      {/* CyberNav with integrated Music Controls */}
      {!isSceneLoading && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 9999,
          }}
        >
          <CyberNav 
            is80sMode={is80sMode}
            position="fixed"
            musicButton={
              !showMusicControls ? (
                <button
                  onClick={() => {
                    setShowMusicControls(true);
                    if (!contextIsPlaying) {
                      play();
                    }
                  }}
                  style={{
                    width: isMobileDevice ? "3rem" : "3.5rem",
                    height: isMobileDevice ? "3rem" : "3.5rem",
                    borderRadius: "0.5rem",
                    backgroundColor: is80sMode ? "rgba(217, 70, 239, 0.2)" : "rgba(0, 0, 0, 0.7)",
                    border: is80sMode ? "2px solid #D946EF" : "2px solid rgba(255, 255, 255, 0.2)",
                    color: is80sMode ? "#67e8f9" : "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    backdropFilter: "blur(10px)",
                    boxShadow: "0 0.125rem 0.5rem rgba(0, 0, 0, 0.3)",
                  }}
                  title="Toggle Music"
                >
                  <svg
                    width={isMobileDevice ? "20" : "30"}
                    height={isMobileDevice ? "20" : "30"}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                </button>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  {/* Spinning Album Art */}
                  <div
                    className={contextIsPlaying ? "spinning-record" : ""}
                    style={{
                      width: isMobileDevice ? "3rem" : "3.5rem",
                      height: isMobileDevice ? "3rem" : "3.5rem",
                      borderRadius: "50%",
                      backgroundImage: "url('/virginRecords.jpg')",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      cursor: "pointer"
                    }}
                    onClick={() => contextIsPlaying ? pause() : play()}
                  />
                  
                  {/* Skip Button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (nextTrack) {
                        nextTrack();
                      }
                    }}
                    style={{
                      width: isMobileDevice ? "2rem" : "2.5rem",
                      height: isMobileDevice ? "2rem" : "2.5rem",
                      borderRadius: "0.25rem",
                      backgroundColor: is80sMode ? "rgba(217, 70, 239, 0.2)" : "rgba(0, 0, 0, 0.7)",
                      border: is80sMode ? "2px solid #D946EF" : "2px solid rgba(255, 255, 255, 0.2)",
                      color: is80sMode ? "#67e8f9" : "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      backdropFilter: "blur(10px)",
                      boxShadow: "0 0.125rem 0.375rem rgba(0, 0, 0, 0.3)",
                    }}
                    title="Next Track"
                  >
                    <svg width={isMobileDevice ? "14" : "18"} height={isMobileDevice ? "14" : "18"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 4 15 12 5 20 5 4"/>
                      <line x1="19" y1="5" x2="19" y2="19"/>
                    </svg>
                  </button>
                  
                  {/* Close Button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowMusicControls(false);
                      if (pause) {
                        pause();
                      }
                    }}
                    style={{
                      width: isMobileDevice ? "1.75rem" : "2rem",
                      height: isMobileDevice ? "1.75rem" : "2rem",
                      borderRadius: "0.25rem",
                      backgroundColor: is80sMode ? "rgba(217, 70, 239, 0.2)" : "rgba(0, 0, 0, 0.7)",
                      border: is80sMode ? "1px solid #D946EF" : "1px solid rgba(255, 255, 255, 0.2)",
                      color: is80sMode ? "#67e8f9" : "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      backdropFilter: "blur(10px)",
                      boxShadow: "0 0.125rem 0.375rem rgba(0, 0, 0, 0.3)",
                    }}
                    title="Close Music"
                  >
                    <svg width={isMobileDevice ? "12" : "14"} height={isMobileDevice ? "12" : "14"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              )
            }
          />
        </div>
      )}
    </div>
  );
}