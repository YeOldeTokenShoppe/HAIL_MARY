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
import SimpleTextLoader from '@/components/SimpleTextLoader';
import SynthSunset from '@/components/SynthSunset';


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
  const [isCandleModalOpen, setIsCandleModalOpen] = useState(false);
  const [focusedAgent, setFocusedAgent] = useState(null);
  const [useAurora, setUseAurora] = useState(true);
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [showCyberNav, setShowCyberNav] = useState(false);
  
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
      const modelToPreload = isMobile ? '/models/MOBILE.glb' : '/models/RL80_4anims.glb';
        
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
      
      // Suppress WebGL context lost errors when intentionally unmounting
      const handleContextLost = (e) => {
        if (isCandleModalOpen) {
          e.preventDefault();
          console.log('WebGL context disposed for memory optimization');
        }
      };
      
      const canvas = document.querySelector('canvas');
      if (canvas) {
        canvas.addEventListener('webglcontextlost', handleContextLost);
      }
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
    
    // Only enable TickerDisplay3 on desktop
    if (!isMobileView) {
      // console.log('🎯 Enabling TickerDisplay3 rendering');
      setTickerReady(true);
    }
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
    return <SimpleTextLoader loading={true} progress={0} message="Loading" />;
  }

  // Removed inline handler - using global listener instead

  return (
    <>
      {/* Loading Screen */}
      <SimpleTextLoader 
        loading={isSceneLoading} 
        progress={loadingProgress}
        message={loadingMessage}
      />
          
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
          // Allow touch events to pass through when collapsed
          pointerEvents: "auto",
        }}>
        </div>
        {/* Aurora Background - Only render when Aurora is selected AND (not in 80s mode OR on mobile) */}
        {canvasReady && useAurora && !isCandleModalOpen && (!context80sMode || isMobileView) && (
          <div style={{ 
            position: 'absolute', 
            inset: 0, 
            zIndex: 1 
          }}>
            <Aurora />
          </div>
        )}

        {/* Main Canvas - Unmounted when modal is open for memory optimization */}
        {canvasReady && !isCandleModalOpen && (
        <CleanCanvas
          key="temple-canvas"
          camera={{ 
            position: isMobileView ? [0, 0, 2] : [0, 0.5, 6.5], 
            fov: isMobileView ? 35 : 50 
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
              position={isMobileView ? [0, -1.2, 0] : [0, -1.5, 0]}
              scale={[1.2, 1.2, 1.2]}
              rotation={[0, 0, 0]}
              isPlaying={false}
              onLoad={handleSceneLoad}
              showAnnotations={true}
              is80sMode={context80sMode}
              isMobile={isMobileView}
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

            {/* TickerDisplay3 - Only load on desktop with RL80_4anims.glb model */}
            {!isMobileView && tickerReady && !isCandleModalOpen && (
              <TickerDisplay3 modelRef={null} onLoad={handleTickerLoad} />
            )}

          
            {/* Constellation */}
            <ConstellationModel  
              groupScale={[10, 10, 10]} 
              groupPosition={[0, 15, -80]} 
              isVisible={true} 
            />

            {/* Using optimized version with single video texture */}
            <VideoScreens is80sMode={context80sMode} />

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
            
            {/* OrbitControls - Disabled on mobile */}
            {!isMobileView && (
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
                autoRotate={true}
                autoRotateSpeed={0.2}
                target={[0, 0, 0]}
              />
            )}
          </Suspense>
          {/* <Stats className="stats-monitor" /> */}
        </CleanCanvas>
        )}
        

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
            

          </>
        )}
      </div>
    </div>
    </>
  );
}