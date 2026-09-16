"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import PalmTreeDrive from '@/components/PalmTreeDrive';
import DriveSocialLinks from '@/components/DriveSocialLinks';
import { useMusic } from '@/components/MusicContext';
import CyberNav from '@/components/CyberNav';
import CoinLoader from '@/components/CoinLoader';
import LanguageSwitcher from '@/components/LanguageSwitcher';




export default function Home() {
  
  const [isSceneLoading, setIsSceneLoading] = useState(true);
  const [hasEntered, setHasEntered] = useState(false);
  const [introComplete, setIntroComplete] = useState(false);
  const revealSceneUI = useCallback(() => setIntroComplete(true), []);
  const [entryAudioReady, setEntryAudioReady] = useState(false);
  const [entryAudioError, setEntryAudioError] = useState('');
  const [entryStarting, setEntryStarting] = useState(false);
  const entryStartingRef = useRef(false);
  const [titleMoment, setTitleMoment] = useState('opening');
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
    is80sMode,
    isLoadingTrack,
    loadTrackByPath,
    audioRef,
    setIsPlaying,
    loadTrack,
    non80sTracks,
    setPagePlaylistOverride
  } = useMusic();

  // Keep skip, auto-advance and the first-play fallback on the modern bucket
  // (same rule as ModernMusicPlayer).
  useEffect(() => {
    setPagePlaylistOverride(non80sTracks);
    return () => setPagePlaylistOverride(null);
  }, [non80sTracks, setPagePlaylistOverride]);
  
  // Show music controls if music is already playing
  const [showMusicControls, setShowMusicControls] = useState(contextIsPlaying);
  
  // Sync showMusicControls with playing state when it changes
  useEffect(() => {
    if (contextIsPlaying && !showMusicControls) {
      setShowMusicControls(true);
    }
  }, [contextIsPlaying]);

  const musicOptOut = useRef(false);
  // Resume only a modern track; an 80s song another page left loaded is replaced.
  const startMusic = useCallback(() => {
    const key = (currentTrack?.path || '').replace(/^\//, '');
    const isModern = !currentTrack || non80sTracks.some(t => t.path.replace(/^\//, '') === key);
    if (isModern) play();
    else loadTrack(Math.floor(Math.random() * non80sTracks.length), true);
  }, [currentTrack, non80sTracks, play, loadTrack]);

  const handleMusicToggle = useCallback((show) => {
    musicOptOut.current = !show;
    setShowMusicControls(show);
    if (show && !contextIsPlaying) startMusic();
    if (!show) pause();
  }, [contextIsPlaying, startMusic, pause]);

  const prepareEntryAudio = useCallback(async () => {
    setEntryAudioReady(false);
    setEntryAudioError('');
    const ready = await loadTrackByPath('audio/05 Feel It Still (Flatbush Zombies Remix).m4a', 'Feel It Still (Flatbush Zombies Remix)', 100, 0, { autoplay: false });
    setEntryAudioReady(Boolean(ready));
    if (!ready) setEntryAudioError('Music couldn’t load. Try again or enter without sound.');
  }, [loadTrackByPath]);

  const entryAudioRequested = useRef(false);
  useEffect(() => {
    if (entryAudioRequested.current) return;
    entryAudioRequested.current = true;
    prepareEntryAudio();
  }, [prepareEntryAudio]);

  useEffect(() => {
    if (hasEntered) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    return () => { document.body.style.overflow = previousOverflow; };
  }, [hasEntered]);

  const enterSite = async (event) => {
    event.stopPropagation();
    if (entryStartingRef.current || isSceneLoading || !entryAudioReady) return;
    entryStartingRef.current = true;
    setEntryStarting(true);
    setEntryAudioError('');
    try {
      // Call play directly in the click handler, before any asynchronous work.
      const audio = audioRef.current;
      if (!audio) throw new Error('Audio unavailable');
      audio.currentTime = 0;
      await audio.play();
      setIsPlaying(true);
      musicOptOut.current = false;
      setShowMusicControls(true);
      setHasEntered(true);
    } catch {
      setEntryAudioError('Sound couldn’t start. Tap Enter site to retry, or enter without sound.');
    } finally {
      entryStartingRef.current = false;
      setEntryStarting(false);
    }
  };

  const enterWithoutSound = (event) => {
    event.stopPropagation();
    musicOptOut.current = true;
    pause();
    setShowMusicControls(false);
    setHasEntered(true);
  };

  // Honor an off click even if an earlier track request finishes afterward.
  useEffect(() => {
    if (contextIsPlaying && musicOptOut.current) pause();
  }, [contextIsPlaying, pause]);

  // Check if font is loaded
  useEffect(() => {
    const checkFont = async () => {
      try {
        await document.fonts.load("1em 'UnifrakturMaguntia'");
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
  // useEffect(() => {
  //   console.log('RL80 Logo Debug:', {
  //     isSceneLoading,
  //     fontLoaded,
  //     shouldShowLogo: !isSceneLoading && fontLoaded
  //   });
  // }, [isSceneLoading, fontLoaded]);

  return (
    <div style={{ width: '100vw', minHeight: '100vh' }}>
      {/* Language Switcher for debugging */}
      {introComplete && <LanguageSwitcher />}
      
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
      
      <div inert={!hasEntered}>
      <PalmTreeDrive 
        hasEntered={hasEntered}
        onLoadingChange={setIsSceneLoading}
        onTitleMomentChange={setTitleMoment}
        onIntroComplete={revealSceneUI}
      />
      </div>
      
      {!hasEntered && !isSceneLoading && (
        <div className="entry-gate" role="group" aria-label="Enter site"
          onTouchStart={event => event.stopPropagation()}
          onPointerDown={event => event.stopPropagation()}
          onKeyDown={event => event.stopPropagation()}
          onWheel={event => event.stopPropagation()}>
          <div className="entry-card">
            <button className="entry-button" onClick={enterSite} disabled={!entryAudioReady || entryStarting}>
              {entryStarting ? 'Starting…' : entryAudioReady ? 'Enter site' : 'Preparing music…'}
            </button>
            <span className="entry-caption">Enter with sound</span>
            {entryAudioError && <p role="status" className="entry-error">{entryAudioError}</p>}
            {entryAudioError && !entryAudioReady && <button className="entry-secondary" onClick={prepareEntryAudio}>Retry music</button>}
            <button className="entry-secondary" onClick={enterWithoutSound} disabled={entryStarting}>Enter without sound</button>
          </div>
        </div>
      )}
      <style jsx>{`
        .entry-gate { position: fixed; inset: 0; z-index: 100001; display: flex; align-items: flex-end; justify-content: center; padding: 24px 24px max(7vh, env(safe-area-inset-bottom)); color: #fff5e9; pointer-events: none; }
        .entry-card { width: min(100%, 260px); text-align: center; pointer-events: auto; }
        .entry-button { min-width: 150px; min-height: 44px; padding: 10px 24px; border: 1px solid rgba(243,64,185,.75); border-radius: 4px; background: rgba(24,10,29,.8); color: #fff5e9; font: 500 15px/1.3 Arial,sans-serif; cursor: pointer; }
        .entry-button:disabled { opacity: .6; cursor: wait; }
        .entry-button:focus-visible, .entry-secondary:focus-visible { outline: 2px solid #ffbb36; outline-offset: 4px; }
        .entry-caption { display: block; margin: 8px 0 0; font-size: 11px; color: #b5a4b2; }
        .entry-secondary { display: block; margin: 0 auto; padding: 12px; border: 0; background: transparent; color: #b5a4b2; font-size: 12px; text-decoration: underline; cursor: pointer; min-height: 44px; }
        .entry-card .entry-error { margin: 12px 0 4px; font-size: 13px; }
      `}</style>

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
      {hasEntered && introComplete && !isSceneLoading && (
        <div aria-hidden={titleMoment === 'opening'} style={{
          position: "fixed",
          top: "20px", 
          left: "20px",
          borderRadius: "8px",
          padding: "10px",
          opacity: titleMoment === 'opening' ? 0 : 1,
          transition: 'opacity 0.7s ease',
          transitionDelay: titleMoment === 'opening' ? '0s' : '0.7s',
          pointerEvents: titleMoment === 'opening' ? 'none' : 'auto',
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
              userSelect: "none",
            }}
            // onClick={(e) => {
            //   e.preventDefault();
            //   e.stopPropagation();
            //   window.location.href = "/about";
            // }}
          >
            RL80
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
      {hasEntered && introComplete && !isSceneLoading && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 100002,
          }}
        >
          {/* <CyberNav 
            is80sMode={is80sMode}
            position="fixed"
            
          /> */}
          <div data-intro-music-controls
        style={{
          position: "fixed",
          top: "1rem",
          right: "1rem",
          zIndex: 100002
        }}
      >
        {
            !showMusicControls ? (
              <button
                onClick={() => handleMusicToggle(true)}
                style={{
                  width: isMobileDevice ? "3.5rem" : "3.5rem",
                  height: isMobileDevice ? "3.5rem" : "3.5rem",
                  borderRadius: "0.5rem",
                  backgroundColor: is80sMode ? "rgba(217, 70, 239, 0.2)" : "transparent",
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
                title="Play music"
                aria-label="Play music"
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
                  style={{
                    width: isMobileDevice ? "3rem" : "3.5rem",
                    height: isMobileDevice ? "3rem" : "3.5rem",
                    borderRadius: "50%",
                    overflow: "hidden",
                    animation: contextIsPlaying ? "spin 4s linear infinite" : "none",
                    cursor: "pointer"
                  }}
                  onClick={() => {
                    if (contextIsPlaying) {
                      musicOptOut.current = true;
                      pause();
                    } else {
                      musicOptOut.current = false;
                      startMusic();
                    }
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      backgroundImage: "url('/virginRecords.jpg')",
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    }}
                  />
                </div>
                
                {/* Skip Button */}
                <button
                  onClick={() => nextTrack && nextTrack()}
                  style={{
                    width: isMobileDevice ? "2rem" : "2.5rem",
                    height: isMobileDevice ? "2rem" : "2.5rem",
                    borderRadius: "0.25rem",
                    backgroundColor: is80sMode ? "rgba(217, 70, 239, 0.2)" : "transparent",
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
                  onClick={() => {
                    handleMusicToggle(false);
                    pause && pause();
                  }}
                  style={{
                    width: isMobileDevice ? "1.75rem" : "2rem",
                    height: isMobileDevice ? "1.75rem" : "2rem",
                    borderRadius: "0.25rem",
                    backgroundColor: is80sMode ? "rgba(217, 70, 239, 0.2)" : "transparent",
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
      </div>
        </div>
      )}

      {hasEntered && introComplete && !isSceneLoading && titleMoment !== 'final' && (
        <div style={{ position: 'fixed', bottom: 'calc(128px + env(safe-area-inset-bottom, 0px))', right: '2rem', zIndex: 1001 }}>
          <DriveSocialLinks vertical />
        </div>
      )}
    </div>
  );
}