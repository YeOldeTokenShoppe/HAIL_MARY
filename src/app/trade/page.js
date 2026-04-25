"use client";
import React, { Suspense, useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import CleanCanvas from '@/components/CleanCanvas';
import { OrbitControls, Stats, Cloud, Clouds } from '@react-three/drei';
import ConstellationModel from '@/components/ConstellationModel';
import Aurora from '@/components/Aurora';
import StarField from '@/components/StarField';
import Link from 'next/link';
import PostProcessingEffects from '@/components/PostProcessingEffects';
import CyborgTempleScene from '@/components/CyborgTempleScene';
import VideoScreens from "@/components/VideoScreens";
// import VideoScreensOptimized from "@/components/VideoScreensOptimized";
import TickerDisplay3 from "@/components/TickerDisplay3";
import { useMusic } from '@/components/MusicContext';
import { useUser, useClerk } from "@clerk/nextjs";
import CyberNav from '@/components/CyberNav';
import NavControls from '@/components/NavControls';
import NavControlsMobile from '@/components/NavControlsMobile';
import MobileBottomNav from '@/components/MobileBottomNav';
import CoinLoader from '@/components/CoinLoader';
import SynthSunset from '@/components/SynthSunset';
import BuyModal from '@/components/BuyModal';
import { useRouter } from 'next/navigation';


export default function CyborgTemple() {
  const [isMobileView, setIsMobileView] = useState(false);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isSceneLoading, setIsSceneLoading] = useState(true);
  const [sceneReady, setSceneReady] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [tickerLoaded, setTickerLoaded] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [tickerReady, setTickerReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Initializing");
  const [modelLoadStartTime] = useState(Date.now());
  const [focusedAgent, setFocusedAgent] = useState(null);
  const [useAurora, setUseAurora] = useState(false);
  const swapCoinsRef = useRef(null);
  const [coinMode, setCoinMode] = useState('agents'); // 'supporters' or 'agents'
  const [coinVideo, setCoinVideo] = useState(null); // { src, label } when a coin video is playing
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [showCyberNav, setShowCyberNav] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const router = useRouter();
  
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
  
  // Get user context and auth functions
  const { isSignedIn, user } = useUser();
  const { openSignIn, openUserProfile } = useClerk();

  // Suppress WebGL context lost warnings when modal is open
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const originalWarn = console.warn;
      const originalError = console.error;
      
      console.warn = (...args) => {
        // Suppress Three.js context lost warning
        if (typeof args[0] === 'string' && args[0].includes('Context Lost')) {
          // console.log('🎨 3D scene paused for modal display');
          return;
        }
        originalWarn.apply(console, args);
      };
      
      console.error = (...args) => {
        // Also suppress as error in case it comes that way
        if (typeof args[0] === 'string' && args[0].includes('Context Lost')) {
          return;
        }
        originalError.apply(console, args);
      };
      
      return () => {
        console.warn = originalWarn;
        console.error = originalError;
      };
    }
  }, []);

  // Removed auto-collapse timer - only manual interaction collapses the panel

  // Check if mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== 'undefined') {
        const isMobile = window.innerWidth <= 768;
        setIsMobileView(isMobile);
        
        // Preload the appropriate model
      const modelToPreload = '/models/RL80_4anims_v2.glb';
        
        if (!document.querySelector(`link[href="${modelToPreload}"]`)) {
          const link = document.createElement('link');
          link.rel = 'preload';
          link.as = 'fetch';
          link.href = modelToPreload;
          link.crossOrigin = 'anonymous';
          link.type = 'model/gltf-binary';
          document.head.appendChild(link);
          // console.log(`[Temple] Preloading ${modelToPreload}`);
          
          // Also actively fetch the model to warm up the cache
          fetch(modelToPreload, { 
            mode: 'cors',
            cache: 'force-cache'
          })
          .then(response => {
            if (!response.ok) {
              throw new Error(`Failed to preload: ${response.status}`);
            }
            // console.log(`[Temple] Successfully preloaded ${modelToPreload}`);
            return response.blob();
          })
          .then(blob => {
            // console.log(`[Temple] Model size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
          })
          .catch(error => {
            console.error(`[Temple] Failed to preload model:`, error);
          });
        }
      }
    };
    checkMobile();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', checkMobile);
    }
    setMounted(true);
    setLoadingProgress(10);
    setLoadingMessage("Setting up environment");
    
    // Now we can start Canvas immediately since we're using a lightweight loader
    setCanvasReady(true);
    setLoadingProgress(20);
    setLoadingMessage("Loading 3D Model...");
    
    // Don't set tickerReady here - wait for model to load first
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', checkMobile);
      }
    };
  }, []);

  // Check if font is loaded
  useEffect(() => {
    const checkFont = async () => {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        try {
          await document.fonts.load("1em 'UnifrakturMaguntia'");
          setFontLoaded(true);
          setLoadingProgress(prev => Math.min(prev + 10, 100));
        } catch (e) {
          // console.log('Font load failed, using fallback');
          setTimeout(() => {
            setFontLoaded(true);
            setLoadingProgress(prev => Math.min(prev + 10, 100));
          }, 100);
        }
      } else {
        // Server-side fallback
        setFontLoaded(true);
        setLoadingProgress(prev => Math.min(prev + 10, 100));
      }
    };
    checkFont();
  }, []);

  // Handle model loading completion
  const handleSceneLoad = () => {
    // console.log('🎨 CyborgTempleScene loaded - GLB model ready');
    // console.log('ModelRef current:', modelRef.current);
    setModelLoaded(true);
    setLoadingProgress(70);
    setLoadingMessage("Finalizing...");

    // Mobile and desktop now share the same model, so the ticker mesh exists
    // in both. Enable rendering unconditionally.
    setTickerReady(true);
  };

  // Handle ticker loading completion
  const handleTickerLoad = () => {
    // console.log('📊 TickerDisplay3 loaded');
    setTickerLoaded(true);
    setLoadingProgress(90);
    setLoadingMessage("Almost ready");
  };

  // Comprehensive loading coordination
  useEffect(() => {
    // console.log('🔄 Loading state check:', {
    //   fontLoaded,
    //   mounted,
    //   modelLoaded,
    //   tickerReady,
    //   tickerLoaded
    // });
    
    // Only hide loading when everything is ready
    // Model MUST be loaded before proceeding
    if (!modelLoaded) {
      // console.log('⏳ Waiting for model to load...');
      return; // Don't proceed until model is loaded
    }
    
    // Check ticker condition only after model is loaded
    // On mobile, we don't need to wait for ticker at all
    const tickerCondition = isMobileView ? true : (!tickerReady || (tickerReady && tickerLoaded));
    
    // console.log('📋 Ticker condition:', tickerCondition, 'tickerReady:', tickerReady, 'tickerLoaded:', tickerLoaded);
    
    if (fontLoaded && mounted && modelLoaded && tickerCondition) {
      // console.log('✅ All conditions met! Starting scene reveal sequence...');
      
      // Calculate time elapsed since loading started
      const timeElapsed = Date.now() - modelLoadStartTime;
      const minimumLoadTime = 2000; // Minimum 2 seconds to prevent flash
      const remainingTime = Math.max(0, minimumLoadTime - timeElapsed);
      
      setLoadingProgress(100);
      setLoadingMessage("Ready!");
      
      // Add delay to ensure smooth transition
      const timer = setTimeout(() => {
        // console.log('🚀 Setting scene ready!');
        setSceneReady(true);
        setTimeout(() => {
          // console.log('🎬 Hiding loading screen!');
          setIsSceneLoading(false);
        }, 500); // Brief additional delay for smooth transition
      }, remainingTime + (isMobileView ? 500 : 1000)); // Wait for minimum time plus transition
      
      return () => clearTimeout(timer);
    }
  }, [fontLoaded, mounted, modelLoaded, tickerLoaded, tickerReady, isMobileView, modelLoadStartTime]);

  // Fallback timeout to prevent infinite loading
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      if (isSceneLoading && !modelLoaded) {
        // Only force ready if model still hasn't loaded after extended timeout
        console.log('[Temple] Fallback timeout reached, model still not loaded');
        console.log('[Temple] Consider checking network or model file size');
        // Don't reveal the scene - keep showing loader
        // Just log the issue for debugging
      } else if (isSceneLoading && modelLoaded) {
        // If model is loaded but scene is still loading, it's safe to reveal
        console.log('[Temple] Fallback timeout reached but model is loaded, revealing scene');
        setSceneReady(true);
        setIsSceneLoading(false);
      }
    }, isMobileView ? 30000 : 30000); // 30 seconds for both - give model time to load

    return () => clearTimeout(fallbackTimer);
  }, [isSceneLoading, isMobileView, modelLoaded]);

  // Don't render on server-side
  if (!mounted) {
    return <CoinLoader loading={true} />;
  }

  return (
    <>
      {/* Loading Screen */}
      <CoinLoader loading={isSceneLoading} />
          
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

        @keyframes liminalComingSoonPulse {
          0%, 100% {
            opacity: 0.85;
            text-shadow:
              0 0 6px rgba(57, 255, 20, 0.75),
              0 0 14px rgba(57, 255, 20, 0.45),
              0 0 24px rgba(57, 255, 20, 0.2);
          }
          50% {
            opacity: 1;
            text-shadow:
              0 0 10px rgba(57, 255, 20, 0.95),
              0 0 22px rgba(57, 255, 20, 0.65),
              0 0 40px rgba(57, 255, 20, 0.35);
          }
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
        {/* <div style={{
          position: "fixed",
          top: "20px",
          left: isMobileView ? "2rem" : "5rem",
          borderRadius: "8px",
          padding: "10px",
          pointerEvents: focusedAgent?.startsWith('Screen') ? 'none' : 'auto',
          opacity: focusedAgent?.startsWith('Screen') ? 0 : (fontLoaded ? 1 : 0),
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
        </div> */}
         <h1
              className="custom-title"
              style={{
                position: "relative",
                left: "2rem",
                // top: "1.5rem",
                color: "#f6f5f1ff",
                fontFamily: "UnifrakturCook, serif",
                textShadow: "0 0 10px rgba(212, 175, 55, 0.8), 0 0 20px rgba(212, 175, 55, 0.6), 0 0 30px rgba(212, 175, 55, 0.8), 6px 6px 16px rgba(0, 0, 0, 1), -2px -2px 8px rgba(255, 192, 203, 0.7), 0 0 100px rgba(212, 175, 55, 0.1)",
                fontSize: "3rem",
                fontWeight: 900,
                lineHeight: 0.85,
                transform: "rotate(-8deg) skew(-15deg)",
                zIndex: 1000,
                whiteSpace: "nowrap",
                cursor: "pointer",
                marginTop: "0",
                pointerEvents: "auto",
              }}
            >
            <span className="title-line" style={{ display: 'block', position: 'relative' }}>The</span>
            <span className="title-line" style={{ display: 'block', marginLeft: "2rem",position: 'relative' }}>
              <span style={{ fontSize: "2rem" }}></span>
                Liminal
            </span>
            <span className="title-line" style={{ display: 'block', marginLeft: "4rem", position: 'relative' }}>Terminal</span>
          </h1>

          {/* Neon "COMING SOON" subheading — sits under the gothic title to
              telegraph that the Liminal Terminal is a preview. */}
          <div
            style={{
              position: 'relative',
              left: '2.5rem',
              top: '3.0rem',
              marginTop: '1.5rem',
              display: 'inline-block',
              fontFamily: "'Orbitron', 'Courier New', monospace",
              fontSize: isMobileView ? '0.65rem' : '0.8rem',
              fontWeight: 900,
              letterSpacing: '0.45em',
              color: '#39ff14',
              padding: '0.35rem 0.9rem',
              border: '1px solid rgba(57, 255, 20, 0.55)',
              borderRadius: '3px',
              background: 'rgba(6, 20, 8, 0.55)',
              backdropFilter: 'blur(2px)',
              animation: 'liminalComingSoonPulse 2.4s ease-in-out infinite',
              zIndex: 1000,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              textTransform: 'uppercase',
            }}
          >
            · Coming Soon ·
          </div>

        {/* Temple Description Panel - Separate from RL80 logo */}
        <div 
          onClick={() => {
            if (!userHasInteracted) {
              console.log('Panel clicked, collapsing');
              setUserHasInteracted(true);
            }
          }}
          onTouchStart={() => {
            if (!userHasInteracted) {
              console.log('Panel touched, collapsing');
              setUserHasInteracted(true);
            }
          }}
          style={{
          position: "fixed",
          // Mobile: always 5.5rem from bottom
          // Desktop: stays in same position (120px from top) even when collapsed
          top: isMobileView ? "auto" : "120px",
          bottom: isMobileView ? "5.5rem" : "auto",
          left: isMobileView ? "0.625rem" : "1.25rem",
          right: isMobileView ? "0.625rem" : "auto",
          maxWidth: userHasInteracted ? 
            (isMobileView ? "100%" : "350px") : 
            (isMobileView ? "100%" : "380px"),
          padding: isMobileView ? "0.5rem" : "1rem",
          zIndex: 10,
          transition: "all 0.5s ease-in-out",
          cursor: userHasInteracted ? "default" : "pointer",
          // Pass through pointer events when collapsed on mobile (otherwise blocks 3D coin clicks)
          pointerEvents: userHasInteracted ? "none" : "auto",
        }}>
        </div>
        {/* Aurora Background - Only render when Aurora is selected AND (not in 80s mode OR on mobile) */}
        {canvasReady && useAurora && (!context80sMode || isMobileView) && (
          <div style={{ 
            position: 'absolute', 
            inset: 0, 
            zIndex: 1 
          }}>
            <Aurora />
          </div>
        )}

        {/* Main Canvas */}
        {canvasReady && (
        <CleanCanvas
          key="temple-canvas"
          camera={{
            // Mobile was framed for the old compact MOBILE3.glb — now that it loads
            // the full desktop scene, pull back + widen FOV so the whole tableau
            // fits on portrait aspect. Tune z/fov further if it still reads tight.
            position: isMobileView ? [0, 0.5, 9] : [0, 0.5, 6.5],
            fov: isMobileView ? 55 : 50
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
                
                {/* Synthwave sun model */}
                <SynthSunset 
                  position={[0, 8, -20]}
                  scale={[8, 8, 8]}
                  rotation={[0, 0, 0]}
                />
                
                {/* Scattered clouds for 80s atmosphere - avoiding SynthSunset area */}
                <Clouds material={THREE.MeshBasicMaterial}>
                  {/* Clouds positioned to avoid the sunset at [0, 8, -20] */}
                  {/* Far left side clouds */}
                  <Cloud 
                    position={[-45, 16, 0]} 
                    speed={0.18} 
                    opacity={0.26}
                    color="#fb5607"
                    scale={[3.5, 2, 4]}
                  />
                  <Cloud 
                    position={[-40, 11, -35]} 
                    speed={0.22} 
                    opacity={0.32}
                    color="#8338ec"
                    scale={[4, 2.5, 3]}
                  />
                  <Cloud 
                    position={[-50, 19, 20]} 
                    speed={0.14} 
                    opacity={0.24}
                    color="#c233b1"
                    scale={[3, 2, 3.5]}
                  />
                  {/* Far right side clouds */}
                  <Cloud 
                    position={[45, 13, -35]} 
                    speed={0.2} 
                    opacity={0.3}
                    color="#3a86ff"
                    scale={[3.5, 2, 4]}
                  />
                  <Cloud 
                    position={[50, 22, -10]} 
                    speed={0.16} 
                    opacity={0.2}
                    color="#ff006e"
                    scale={[2.8, 1.8, 3]}
                  />
                  <Cloud 
                    position={[40, 18, 10]} 
                    speed={0.1} 
                    opacity={0.2}
                    color="#ffbe0b"
                    scale={[2.5, 1.5, 3]}
                  />
                  {/* Behind/side positions */}
                  <Cloud 
                    position={[25, 10, 35]} 
                    speed={0.25} 
                    opacity={0.35}
                    color="#8338ec"
                    scale={[3.5, 2, 4]}
                  />
                  <Cloud 
                    position={[0, 14, 45]} 
                    speed={0.18} 
                    opacity={0.28}
                    color="#3a86ff"
                    scale={[4, 2.5, 3]}
                  />
                  <Cloud 
                    position={[-30, 20, 30]} 
                    speed={0.12} 
                    opacity={0.22}
                    color="#ff006e"
                    scale={[3, 1.8, 3.5]}
                  />
                  <Cloud 
                    position={[20, 25, 25]} 
                    speed={0.11} 
                    opacity={0.18}
                    color="#8338ec"
                    scale={[4, 2, 3.5]}
                  />
                  {/* High clouds that won't obstruct */}
                  <Cloud 
                    position={[-25, 28, -15]} 
                    speed={0.15} 
                    opacity={0.2}
                    color="#fb5607"
                    scale={[3, 1.5, 2.5]}
                  />
                  <Cloud 
                    position={[30, 30, -25]} 
                    speed={0.13} 
                    opacity={0.18}
                    color="#ff006e"
                    scale={[2.5, 1.5, 3]}
                  />
                </Clouds>
              </>
            )}
            
            {/* Starfield background - only show when Aurora is off AND (not in 80s mode OR on mobile) */}
            {!useAurora && (!context80sMode || isMobileView) && (
              <StarField 
                radius={150} 
                count1={isMobileView ? 200 : 500} 
                count2={isMobileView ? 150 : 300} 
                is80sMode={false} 
              />
            )}
            
            {/* CyborgTempleScene with the RL80 model */}
            <CyborgTempleScene
              position={[0, -1.5, 0]}
              scale={[1.2, 1.2, 1.2]}
              rotation={[0, 0, 0]}
              isPlaying={false}
              onLoad={handleSceneLoad}
              showAnnotations={true}
              is80sMode={context80sMode}
              isMobile={isMobileView}
              disableCandleInteraction
              onSwapCoinsReady={(fn) => { swapCoinsRef.current = fn }}
              onCoinFaceTap={(coinIndex, isCharacters) => {
                if (isCharacters) {
                  // Agent/character coins
                  const coinVideos = [
                    null, // CoinFace1 — Our Lady (no video yet)
                    { src: '/videos/gr80_greetings.mp4', label: 'St. GR80' },
                    null, // CoinFace3 — H80Z (no video yet)
                    null, // CoinFace4 — TBD
                  ]
                  const video = coinVideos[coinIndex]
                  if (video) setCoinVideo(video)
                } else {
                  // Supporter/user coins — handle separately
                  // TODO: show supporter info or profile
                  console.log(`Supporter coin ${coinIndex} tapped`)
                }
              }}
              onAgentClick={(agentId) => {
                if (agentId) {
                  setFocusedAgent(agentId);
                  if (!userHasInteracted) {
                    setTimeout(() => {
                      setUserHasInteracted(true);
                    }, 500);
                  }
                } else {
                  setFocusedAgent(null);
                }
              }}
            />

            {/* TickerDisplay3 — now rendered on both mobile and desktop since
                they share the same GLB model. */}
            {tickerReady && (
              <TickerDisplay3 modelRef={null} onLoad={handleTickerLoad} />
            )}

          
            {/* Constellation */}
            <ConstellationModel  
              groupScale={[10, 10, 10]} 
              groupPosition={[0, 15, -80]} 
              isVisible={true} 
            />

            {/* Liminal Terminal preview — screens render cryptic teasers */}
            <VideoScreens is80sMode={context80sMode} previewMode={true} />

              {/* <NeuralNetworkR3F 
              theme={2}
              opacity={0.8}            // Slightly dimmed
              useNormalBlending={true}
              formation={0}
              density={300}
              position={[0.64, -0.72, 0.37]}
              scale={0.005}
              enableInteraction={true}
              nodeSize={0.06}  
            /> */}
            
            {/* OrbitControls — enabled on both mobile and desktop. Drei's
                controls handle touch (orbit/pinch/pan) natively. */}
            <OrbitControls
              makeDefault
              enablePan={true}
              enableZoom={true}
              zoomSpeed={0.2}
              enableDamping={true}
              dampingFactor={0.1}
              minDistance={0.1}
              maxDistance={10}
              // zoomToCursor={true}
              autoRotate={!focusedAgent}
              autoRotateSpeed={0.2}
            />
          </Suspense>
          {/* <Stats className="stats-monitor" /> */}
        </CleanCanvas>
        )}

        {/* Floating Character Label on Focus */}
        {(() => {
          const agentInfo = {
            RL80: { name: 'Eugene', tagline: 'Unicorn Investor' },
            Demon: { name: 'H80Z', tagline: 'Devil\'s advocate. Short-seller.' },
            Monk: { name: 'St. GR80', tagline: 'The philosopher and ethical adviser.' },
          Fluffy: { name: 'Virgil', tagline: 'The guardian and guide. Nine lives, one mission.' },
          };
          const info = focusedAgent && agentInfo[focusedAgent];
          return (
            <div style={{
              position: 'fixed',
              right: isMobileView ? '2rem' : '25%',
              top: '50%',
              transform: 'translateY(-50%)',
              opacity: info ? 1 : 0,
              transition: 'opacity 0.4s ease',
              pointerEvents: 'none',
              zIndex: 20,
              background: 'rgba(0, 0, 0, 0.7)',
              border: '1px solid rgba(218, 165, 32, 0.5)',
              borderRadius: '8px',
              padding: '1rem 1.5rem',
              maxWidth: '260px',
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{
                fontFamily: "'UnifrakturMaguntia', cursive",
                fontSize: '1.4rem',
                color: '#daa520',
                marginBottom: '0.35rem',
                letterSpacing: '0.5px',
              }}>
                {info?.name}
              </div>
              <div style={{
                fontSize: '0.85rem',
                color: 'rgba(255, 255, 255, 0.7)',
                fontStyle: 'italic',
                lineHeight: 1.4,
              }}>
                {info?.tagline}
              </div>
            </div>
          );
        })()}

        {/* Coin Mode Buttons - Mobile only */}
        {/* {isMobileView && mounted && !isCandleModalOpen && (
          <div style={{
            position: 'fixed',
            bottom: '5.5rem',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            display: 'flex',
            gap: 12,
          }}>
            <button
              onClick={() => {
                if (coinMode !== 'supporters') {
                  swapCoinsRef.current?.()
                  setCoinMode('supporters')
                }
              }}
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: coinMode === 'supporters' ? 'rgba(255, 215, 0, 0.15)' : 'rgba(0, 0, 0, 0.6)',
                border: `2px solid ${coinMode === 'supporters' ? 'rgba(255, 215, 0, 0.8)' : 'rgba(255, 255, 255, 0.2)'}`,
                color: coinMode === 'supporters' ? 'rgba(255, 215, 0, 0.95)' : 'rgba(255, 255, 255, 0.5)',
                fontSize: 10,
                fontFamily: 'monospace',
                fontWeight: coinMode === 'supporters' ? 700 : 400,
                lineHeight: '1.1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                transition: 'all 0.3s ease',
                padding: 4,
              }}
              aria-label="Show top supporters"
            >
              Top<br/>Fans
            </button>
            <button
              onClick={() => {
                if (coinMode !== 'agents') {
                  swapCoinsRef.current?.()
                  setCoinMode('agents')
                }
              }}
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: coinMode === 'agents' ? 'rgba(0, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.6)',
                border: `2px solid ${coinMode === 'agents' ? 'rgba(0, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.2)'}`,
                color: coinMode === 'agents' ? 'rgba(0, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.5)',
                fontSize: 10,
                fontFamily: 'monospace',
                fontWeight: coinMode === 'agents' ? 700 : 400,
                lineHeight: '1.1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                transition: 'all 0.3s ease',
                padding: 4,
              }}
              aria-label="Show project managers"
            >
              Project<br/>Mgrs
            </button>
          </div>
        )} */}

        {/* Coin Video Overlay — expands from coin position */}
        {coinVideo && (
          <div
            onClick={() => setCoinVideo(null)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 2000,
              background: 'rgba(0, 0, 0, 0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '85vw',
                maxWidth: 360,
                borderRadius: 16,
                overflow: 'hidden',
                border: '2px solid rgba(255, 215, 0, 0.6)',
                background: '#0a0a1a',
                boxShadow: '0 0 30px rgba(255, 215, 0, 0.15)',
              }}
            >
              <video
                src={coinVideo.src}
                autoPlay
                playsInline
                controls
                style={{
                  width: '100%',
                  display: 'block',
                }}
              />
              <div style={{
                padding: '10px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <span style={{
                  color: 'rgba(255, 215, 0, 0.9)',
                  fontFamily: 'monospace',
                  fontSize: 14,
                  fontWeight: 700,
                }}>
                  {coinVideo.label}
                </span>
                <button
                  onClick={() => setCoinVideo(null)}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: 8,
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: 12,
                    fontFamily: 'monospace',
                    padding: '4px 12px',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Top Controls Container - Music, User, and Nav */}
        {mounted && (
          <>
            {/* Nav Controls - Desktop only */}
            {!isMobileView && (
              <div
                style={{
                  position: "fixed",
                  top: "1rem",
                  right: "1rem",
                  zIndex: 1001,
                  opacity: focusedAgent?.startsWith('Screen') ? 0 : 1,
                  pointerEvents: focusedAgent?.startsWith('Screen') ? 'none' : 'auto',
                  transition: 'opacity 0.3s ease',
                }}
              >
                {/* <NavControls
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
                /> */}
              </div>
            )}

            {/* Bottom Nav — rendered on both mobile and desktop, mirrors
                /exlibris: 3 slots (LOGIN | CHAT teaser FAB | HOME + BUY). */}
            <MobileBottomNav
                hideWallet
                accountOnLeft
                /* Center FAB teases the upcoming Liminal Terminal chat —
                   rendered disabled until the broadcast goes live. */
                onBuyClick={() => {}}
                centerDisabled
                centerLabel={
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect width="12" height="12" x="2" y="10" rx="2" ry="2" />
                    <path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6" />
                    <path d="M6 18h.01" />
                    <path d="M10 14h.01" />
                    <path d="M15 6h.01" />
                    <path d="M18 9h.01" />
                  </svg>
                }
                centerSubLabel="COMING SOON"
                centerTitle="Chat with the agents — coming soon"
                onMenuClick={() => setShowBuyModal(true)}
                menuIcon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 22, height: 22, color: '#d4a854' }}>
                    <line x1="12" y1="1" x2="12" y2="23" />
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                }
                menuLabel="BUY"
                isUserSignedIn={isSignedIn}
                userImage={user?.imageUrl}
                show80sButton={false}
                isMobile
                neonMode
                onBookClick={() => router.push('/')}
                bookLabel="HOME"
                bookTitle="Return to the shrine"
                bookIcon={
                  <svg
                    className="btm-book-icon-svg"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M9 5v4" />
                    <rect width="4" height="6" x="7" y="9" rx="1" />
                    <path d="M9 15v2" />
                    <path d="M17 3v2" />
                    <rect width="4" height="8" x="15" y="5" rx="1" />
                    <path d="M17 13v3" />
                    <path d="M3 3v16a2 2 0 0 0 2 2h16" />
                  </svg>
                }
              />

            {/* Buy Modal — triggered from the repurposed menu slot */}
            <BuyModal
              isOpen={showBuyModal}
              onClose={() => setShowBuyModal(false)}
            />

            {/* Telegram Feature Box - Desktop only */}
            {/* {!isMobileView && !focusedAgent?.startsWith('Screen') && (
              <a
                href="https://t.me/rl80_chat"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  position: 'fixed',
                  top: '1.5rem',
                  right: '1rem',
                  zIndex: 1001,
                  width: '200px',
                  background: 'rgba(0, 0, 0, 0.7)',
                  border: '1px solid rgba(0, 255, 255, 0.3)',
                  borderRadius: '8px',
                  padding: '10px',
                  textDecoration: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <img
                  src="/groupPhoto.webp"
                  alt="RL80 Team"
                  style={{
                    width: '100%',
                    borderRadius: '6px',
                    objectFit: 'cover',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', }}>
                  <img
                    src="/telegram_blue.svg"
                    alt="Telegram"
                    style={{ width: '32px', height: '32px', flexShrink: 0, }}
                  />
                  <span style={{
                    color: 'rgba(0, 255, 255, 0.8)',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    lineHeight: '1.3',
                    textAlign: 'center',
                  }}>
                    Join us in Telegram!
                  </span>
                </div>
              </a>
            )} */}

            {/* CyberNav Menu - Show when toggled */}
            {/* <CyberNav
              is80sMode={context80sMode} 
              position="fixed"
              isOpen={showCyberNav}
              onClose={() => setShowCyberNav(false)}
              showButton={false}
            /> */}
            

          </>
        )}
      </div>
    </div>
    </>
  );
}