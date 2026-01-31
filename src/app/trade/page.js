"use client";
import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import CleanCanvas from '@/components/CleanCanvas';
import { OrbitControls, Stats, Cloud, Clouds } from '@react-three/drei';
import ConstellationModel from '@/components/ConstellationModel';
import Aurora from '@/components/Aurora';
import StarField from '@/components/StarField';
import Link from 'next/link';
import PostProcessingEffects from '@/components/PostProcessingEffects';
import CyborgTempleScene from '@/components/CyborgTempleScene';
import { Illumin80ClerkButton } from "@/components/Illumin80Display";
import VideoScreens from "@/components/VideoScreens";
import TickerDisplay3 from "@/components/TickerDisplay3";
import { useMusic } from '@/components/MusicContext';
import { useUser, SignInButton, UserButton, useClerk } from "@clerk/nextjs";
import CyberNav from '@/components/CyberNav';
import NavControls from '@/components/NavControls';
import NavControlsMobile from '@/components/NavControlsMobile';
import SimpleTextLoader from '@/components/SimpleTextLoader';
import SynthSunset from '@/components/SynthSunset';
import FocusedAgentCard from '@/components/FocusedAgentCard';
import InteractiveScroll2 from '@/components/InteractiveScroll2';
import BurningPageEffect from '@/components/BurningPageEffect';
import EmojiBurstEffect from '@/components/EmojiBurstEffect';


export default function CyborgTemple() {
  const modelRef = useRef(null); // Reference to the 3D model for candle extraction
  const [isMobileView, setIsMobileView] = useState(false);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [showMusicControls, setShowMusicControls] = useState(false);
  const [emoji, setEmoji] = useState("😇");
  const [mounted, setMounted] = useState(false);
  const [isSceneLoading, setIsSceneLoading] = useState(true);
  const [sceneReady, setSceneReady] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [tickerReady, setTickerReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [modelLoadStartTime] = useState(Date.now()); // Track when loading started
  const [isCandleModalOpen, setIsCandleModalOpen] = useState(false);
  const [shouldRenderCanvas, setShouldRenderCanvas] = useState(true);
  const [focusedAgent, setFocusedAgent] = useState(null); // Track which agent is focused
  const [showAgentCard, setShowAgentCard] = useState(false); // Track card visibility separately
  const [useAurora, setUseAurora] = useState(true); // Toggle between Aurora and StarField
  const [userHasInteracted, setUserHasInteracted] = useState(false); // Track if user has clicked around
  const [isMobileDevice, setIsMobileDevice] = useState(false)
  const [showCyberNav, setShowCyberNav] = useState(false); // Track CyberNav visibility
  const isTogglingRef = useRef(false); // Add ref for toggle state
  const [showScroll, setShowScroll] = useState(false); // Show InteractiveScroll when Coin1 tapped
  const [showBurning, setShowBurning] = useState(false); // Show burning effect when Coin2 tapped
  const [showEmojiBurst, setShowEmojiBurst] = useState(false); // Show emoji burst when Coin4 tapped
  const [emojiBurstOrigin, setEmojiBurstOrigin] = useState({ x: null, y: null }); // Origin point for emoji burst
  
  // Get music context
  const { 
    play, 
    pause, 
    isPlaying: contextIsPlaying, 
    nextTrack,
    currentTrack,
    is80sMode: context80sMode, 
    setIs80sMode: setContext80sMode
  } = useMusic();
    


    // Emoji animation
    useEffect(() => {
      const emojiInterval = setInterval(() => {
        setEmoji((prevEmoji) => (prevEmoji === "😇" ? "😈" : "😇"));
      }, 3000);
      return () => clearInterval(emojiInterval);
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
  
    // Sync showMusicControls with playing state
    useEffect(() => {
      if (contextIsPlaying && !showMusicControls) {
        setShowMusicControls(true);
      }
    }, [contextIsPlaying, showMusicControls]);

  // Initialize mounted and scene ready states
  useEffect(() => {
    setMounted(true);
    setFontLoaded(true);
    // Give the scene a moment to initialize before showing
    const timer = setTimeout(() => {
      setSceneReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Handle coin tap from CyborgTempleScene
  const handleCoinTap = useCallback((coinName, position) => {
    if (coinName === 'Coin1') {
      setShowScroll(true);
    } else if (coinName === 'Coin2') {
      setShowBurning(true);
    } else if (coinName === 'Coin4') {
      setEmojiBurstOrigin({ x: position?.x, y: position?.y });
      setShowEmojiBurst(true);
    }
    // Add handlers for other coins here as needed
  }, []);

  // Get user context and auth functions
  const { isSignedIn, user } = useUser();
  const { openSignIn, openUserProfile, signOut } = useClerk();


  // Sync showMusicControls with playing state
  useEffect(() => {
    if (contextIsPlaying && !showMusicControls) {
      setShowMusicControls(true);
    }
  }, [contextIsPlaying, showMusicControls]);



 





  // Removed inline handler - using global listener instead

  return (
    <>
  
          
      <div 
        style={{ 
        width: '100vw', 
        height: '100vh', 
        margin: 0, 
        padding: 0, 
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0,
        backgroundColor: '#000',
        opacity: sceneReady ? 1 : 0,
        transition: 'opacity 0.8s ease-in-out',
        visibility: sceneReady ? 'visible' : 'hidden'
      }}>
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
        
        /* Force RL80 logo to always be visible */
        .rl80-logo-container,
        .rl80-logo-text,
        .rl80-logo-container *,
        .rl80-logo-text * {
          opacity: 1 !important;
          visibility: visible !important;
        }
        
        /* Override any extension rules targeting UnifrakturMaguntia */
        [style*="UnifrakturMaguntia"] {
          opacity: 1 !important;
          visibility: visible !important;
        }
        
        /* Override h3 color for mainnet readiness heading */
        .mainnet-readiness-heading {
          color: #00FFB8 !important;
        }
        
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        } 
        
        @keyframes pulse {
          0% {
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
          100% {
            opacity: 0.6;
            transform: scale(1);
          }
        }
        
        .spinning-record {
          animation: spin 3s linear infinite;
        }
        
        .stats-monitor {
          position: fixed !important;
          top: 0 !important;
          left: 100px !important;
          right: auto !important;
        }
      `}</style>
      
      <div style={{
        width: "100%",
        height: "100vh",
        background: "#000",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* RL80 Title and Description */}
        <div style={{
          position: "fixed",
          top: "20px", 
         left: isMobileView ? "2rem" : "5rem",
          borderRadius: "8px",
          padding: "10px",
          pointerEvents: "auto",
          opacity: fontLoaded ? 1 : 0,
          transition: "opacity 0.3s ease-in-out",
          zIndex: 10000,
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
            <Link href="/about" style={{ textDecoration: 'none', color: 'inherit', display: 'inline-block' }}>
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
                    color: `rgba(${255 - index * 2}, ${255 - index * 3}, ${255 - index * 2})`,
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
        
       
            
            
            
         
    
          <div style={{ 
            position: 'absolute', 
            inset: 0, 
            zIndex: 1 
          }}>
            <Aurora />
          </div>
    

  
        <CleanCanvas
          key="temple-canvas"
          camera={{ 
            position:[-0.3, -0.8, 2] , 
            fov: 35
          }}
          gl={{ 
            antialias: !isMobileView,
            alpha: true,
            powerPreference: isMobileView ? "low-power" : "high-performance",
            precision: isMobileView ? "mediump" : "highp",
            stencil: false,
            depth: true,
            preserveDrawingBuffer: true
          }}
          dpr={isMobileView ? 
            (typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1) : 
            (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
          }
          performance={{ min: 0.5 }}
          frameloop="always"
          style={{ 
            background: useAurora ? 'transparent' : '#000', 
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 2
          }}
        >
          <fog attach="fog" args={context80sMode ? ['#1a0033', 50, 300] : ['#000000', 20, 200]} />
          <Suspense fallback={null}>
            <ambientLight intensity={0.3} />
            <PostProcessingEffects is80sMode={context80sMode} />
            
            {/* Synthwave sunset for 80s mode - desktop only */}
            {context80sMode && !isMobileView && (
              <>
                {/* Gradient skybox sphere */}
                <mesh scale={[500, 500, 500]}>
                  <sphereGeometry args={[1, 32, 32]} />
                  <shaderMaterial
                    side={1}  // BackSide - render inside of sphere
                    depthWrite={false}
                    vertexShader={`
                      varying vec3 vWorldPosition;
                      void main() {
                        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                        vWorldPosition = worldPosition.xyz;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                      }
                    `}
                    fragmentShader={`
                      varying vec3 vWorldPosition;
                      void main() {
                        // Normalize height from -1 to 1
                        float height = normalize(vWorldPosition).y;
                        
                        // Define gradient colors - subtle horizon glow
                        vec3 bottomColor = vec3(0.15, 0.05, 0.2);   // Dark purple (below horizon)
                        vec3 horizonGlow = vec3(0.4, 0.15, 0.0);    // Muted orange glow at horizon line
                        vec3 lowerSky = vec3(0.15, 0.0, 0.25);      // Purple just above horizon
                        vec3 midColor = vec3(0.1, 0.0, 0.2);        // Medium purple
                        vec3 topColor = vec3(0.02, 0.0, 0.1);       // Very dark purple
                        
                        vec3 color;
                        
                        if (height < -0.1) {
                          // Well below horizon - dark purple
                          color = bottomColor;
                        } else if (height < 0.0) {
                          // Just below horizon - transition to glow
                          float t = (height + 0.1) / 0.1;
                          color = mix(bottomColor, horizonGlow, t);
                        } else if (height < 0.1) {
                          // Just above horizon - orange glow fading to purple
                          float t = height / 0.1;
                          color = mix(horizonGlow, lowerSky, t);
                        } else if (height < 0.5) {
                          // Lower to mid sky
                          float t = (height - 0.1) / 0.4;
                          color = mix(lowerSky, midColor, t);
                        } else {
                          // Upper sky
                          float t = (height - 0.5) / 0.5;
                          color = mix(midColor, topColor, t);
                        }
                        
                        gl_FragColor = vec4(color, 1.0);
                      }
                    `}
                  />
                </mesh>
                
  
                
               
              </>
            )}
            
            
            
            {/* CyborgTempleScene with the RL80 model */}
            <CyborgTempleScene
              position={[-0.05, -0.3, 0] }
              scale={[1, 1, 1]}
              rotation={[0, 0, 0]}
              isPlaying={false}
              is80sMode={context80sMode}
              isMobile={isMobileView}
              onCoinTap={handleCoinTap}
            />





            
         
              <OrbitControls 
                makeDefault
                enabled={!focusedAgent}  // Disable when focusing on an agent
                enablePan={true}
                enableZoom={true}
                zoomSpeed={0.2}
                enableDamping={true}
                dampingFactor={0.1}
                minDistance={0.1}
                maxDistance={10}
                zoomToCursor={true}
               
                target={[0, 0, 0]}
              />
   
          </Suspense>
          {/* <Stats className="stats-monitor" /> */}
        </CleanCanvas>
     

        

        {/* Top Controls Container - Music, User, and Nav */}
        {mounted && (
          <>
           
            
            {/* Nav Controls - Desktop vs Mobile */}
            <div
              style={{
                position: "fixed",
                top: "1rem",
                right: "1rem",
                zIndex: 1001,
              }}
            >
              {isMobileView ? (
                <NavControlsMobile 
                  isPlaying={contextIsPlaying}
                  onPlayMusic={() => play()}
                  onStopMusic={() => pause()}
                  onSkipTrack={() => nextTrack()}
                  onUserClick={() => {
                    if (isSignedIn) {
                      openUserProfile();
                    } else {
                      openSignIn({ forceRedirectUrl: "/trade" });
                    }
                  }}
                  onMenuClick={() => setShowCyberNav(!showCyberNav)}
                  isUserSignedIn={isSignedIn}
                  isMenuOpen={showCyberNav}
                  userImage={user?.imageUrl}
                />
              ) : (
                <NavControls 
                  auroraOn={useAurora}
                  setAuroraOn={setUseAurora}
                  is80s={context80sMode}
                  setIs80s={setContext80sMode}
                  isPlaying={contextIsPlaying}
                  onPlayMusic={() => play()}
                  onStopMusic={() => pause()}
                  onSkipTrack={() => nextTrack()}
                  onMenuClick={() => setShowCyberNav(!showCyberNav)}
                  isUserSignedIn={isSignedIn}
                  isMenuOpen={showCyberNav}
                />
              )}
            </div>
            
            {/* CyberNav Menu - Show when toggled */}
            <CyberNav 
              is80sMode={context80sMode} 
              position="fixed"
              isOpen={showCyberNav}
              onClose={() => setShowCyberNav(false)}
              showButton={false}
            />
            
            {/* Music controls are now integrated into NavControls */}
            <div style={{ display: "none" }}>
                    {
                        !showMusicControls ? (
                          <button
                            onClick={() => handleMusicToggle(true)}
                            style={{
                              width: isMobileDevice ? "3.5rem" : "3.5rem",
                              height: isMobileDevice ? "3.5rem" : "3.5rem",
                              borderRadius: "0.5rem",
                              backgroundColor: context80sMode ? "rgba(217, 70, 239, 0.2)" : "rgba(0, 0, 0, 0.7)",
                              border: context80sMode ? "2px solid #D946EF" : "2px solid rgba(255, 255, 255, 0.2)",
                              color: context80sMode ? "#67e8f9" : "#ffffff",
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
                                  pause();
                                } else {
                                  play();
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
                                backgroundColor: context80sMode ? "rgba(217, 70, 239, 0.2)" : "rgba(0, 0, 0, 0.7)",
                                border: context80sMode ? "2px solid #D946EF" : "2px solid rgba(255, 255, 255, 0.2)",
                                color: context80sMode ? "#67e8f9" : "#ffffff",
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
                                backgroundColor: context80sMode ? "rgba(217, 70, 239, 0.2)" : "rgba(0, 0, 0, 0.7)",
                                border: context80sMode ? "1px solid #D946EF" : "1px solid rgba(255, 255, 255, 0.2)",
                                color: context80sMode ? "#67e8f9" : "#ffffff",
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
                  
            
                  
             
                 
          

          </>
        )}
        
        
      </div>
    </div>

    {/* Burning page effect when Coin2 is tapped */}
    {showBurning && (
      <BurningPageEffect
        targetUrl="/illumin80"
        duration={5000}
      />
    )}

    {/* Emoji burst effect when Coin4 is tapped */}
    {showEmojiBurst && (
      <EmojiBurstEffect
        targetUrl="/ride"
        navigateDelay={3000}
        emojisPerBurst={5}
        burstInterval={400}
        originX={emojiBurstOrigin.x}
        originY={emojiBurstOrigin.y}
      />
    )}

    {/* InteractiveScroll overlay when Coin1 is tapped */}
    {showScroll && (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 10000,
          background: 'rgba(0, 0, 0, 0.9)',
        }}
      >
        <button
          onClick={() => setShowScroll(false)}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            zIndex: 10001,
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            color: '#fff',
            fontSize: '20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
        <InteractiveScroll2 onClose={() => setShowScroll(false)} />
      </div>
    )}
    </>
  );
}