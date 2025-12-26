"use client";
import React, { Suspense, useState, useEffect, useRef } from 'react';
import CleanCanvas from '@/components/CleanCanvas';
import { OrbitControls, Stats } from '@react-three/drei';
import ConstellationModel from '@/components/ConstellationModel';
import Aurora from '@/components/Aurora';
import StarField from '@/components/StarField';
import Link from 'next/link';
import PostProcessingEffects from '@/components/PostProcessingEffects';
import CyborgTempleScene from '@/components/CyborgTempleScene';

import VideoScreens from "@/components/VideoScreens";
import TickerDisplay3 from "@/components/TickerDisplay3";
import { useMusic } from '@/components/MusicContext';
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import CyberNav from '@/components/CyberNav';
import SimpleTextLoader from '@/components/SimpleTextLoader';
import TradingOverlay from '@/trading/components/overlays/TradingOverlay';
// import { useLighterTrading } from '@/hooks/useLighterTrading'; // Direct Lighter integration
import { useLighterAPI } from '@/hooks/useLighterAPI'; // API-based Lighter integration
// import AgentChatDisplay from '@/components/AgentChatDisplay'; // Using existing Trading Team Chat instead
// import MobileDevTabs from '@/components/MobileDevTabs';
// import RotatingPnL from '@/components/RotatingPnL'; // Replaced with stats panel
import FocusedAgentCard from '@/components/FocusedAgentCard';


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
  const [tickerLoaded, setTickerLoaded] = useState(false);
  const [showTrading, setShowTrading] = useState(true);
  const [triggerSnapshot, setTriggerSnapshot] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [canvasReady, setCanvasReady] = useState(false);
  const [tickerReady, setTickerReady] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("Initializing");
  const [isCandleModalOpen, setIsCandleModalOpen] = useState(false);
  const [shouldRenderCanvas, setShouldRenderCanvas] = useState(true);
  const [focusedAgent, setFocusedAgent] = useState(null); // Track which agent is focused
  const [showAgentCard, setShowAgentCard] = useState(false); // Track card visibility separately
  const [useAurora, setUseAurora] = useState(true); // Toggle between Aurora and StarField
  const [userHasInteracted, setUserHasInteracted] = useState(false); // Track if user has clicked around
  
  // Connect to Lighter features/trading API
  // Initial balance will be fetched from the actual account
  const { 
    isConnected, 
    features, tradingData, 
    initialize
  } = useLighterAPI({
    initialBalance: 0 // Will be replaced with actual balance from API
  });
  
  // Initialize market data fetching after a delay
  useEffect(() => {
    if (!isConnected && mounted) {
      // Defer initialization to not block animations
      const timer = setTimeout(() => {
        // console.log('[Temple] Initializing market data...');
        initialize();
      }, 2000); // 2 second delay
      
      return () => clearTimeout(timer);
    }
  }, [mounted, isConnected, initialize]);

    // Emoji animation
    useEffect(() => {
      const emojiInterval = setInterval(() => {
        setEmoji((prevEmoji) => (prevEmoji === "😇" ? "😈" : "😇"));
      }, 3000);
      return () => clearInterval(emojiInterval);
    }, []);

  // Get music context functions
  const {
    play,
    pause,
    isPlaying: contextIsPlaying,
    nextTrack,
    currentTrack,
    is80sMode
  } = useMusic();

  // Get user context
  const { isSignedIn } = useUser();

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
    setLoadingMessage("Initializing Trading Environment");
    
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
          // console.log('Font loaded successfully');
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

  // Sync showMusicControls with playing state
  useEffect(() => {
    if (contextIsPlaying && !showMusicControls) {
      setShowMusicControls(true);
    }
  }, [contextIsPlaying, showMusicControls]);

  // Handle model loading completion
  const handleSceneLoad = () => {
    // console.log('🎨 CyborgTempleScene loaded - GLB model ready');
    // console.log('ModelRef current:', modelRef.current);
    setModelLoaded(true);
    setLoadingProgress(70);
    setLoadingMessage("Loading features/trading data");
    
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
      setLoadingProgress(100);
      setLoadingMessage("Ready!");
      // Add extra delay to ensure all components are rendered
      const timer = setTimeout(() => {
        // console.log('🚀 Setting scene ready!');
        setSceneReady(true);
        setTimeout(() => {
          // console.log('🎬 Hiding loading screen!');
          setIsSceneLoading(false);
        }, 500); // Brief additional delay for smooth transition
      }, isMobileView ? 500 : 1000); // Reduced delay for mobile
      
      return () => clearTimeout(timer);
    }
  }, [fontLoaded, mounted, modelLoaded, tickerLoaded, tickerReady, isMobileView]);

  // Fallback timeout to prevent infinite loading
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      if (isSceneLoading) {
        console.log('[Temple] Fallback timeout reached, forcing scene ready');
        setSceneReady(true);
        setIsSceneLoading(false);
      }
    }, isMobileView ? 10000 : 20000); // 10 seconds for mobile, 20 for desktop

    return () => clearTimeout(fallbackTimer);
  }, [isSceneLoading, isMobileView]);

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
          {!userHasInteracted && !isMobileView &&(
            <>
              <p style={{
                fontSize: isMobileView ? "1.8rem" : "1rem",
                lineHeight: "1.2",
                color: "rgba(255, 255, 255, 0.95)",
                margin: 0,
                marginBottom: isMobileView ? "0.75rem" : "1rem",
                fontWeight: "700",
                textAlign: "center",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                paddingBottom: isMobileView ? "0.75rem" : "1rem",
                borderBottom: "1px solid rgba(255, 255, 255, 0.2)",
              }}>
                Multi-agent AI trading
              </p>
              
              <p style={{
                fontSize: isMobileView ? "1.1rem" : "0.9rem",
                lineHeight: "1.2",
                color: "rgba(255, 255, 255, 0.8)",
                margin: 0,
                marginBottom: isMobileView ? "0.5rem" : "0.75rem",
                textAlign: "center",
                fontStyle: "italic",
              }}>
                Featuring 𝓞𝖚𝖗 𝕷𝖆𝖉𝖞 𝔬𝔣 𝕻𝖊𝖗𝖕𝖊𝖙𝖚𝖆𝖑 𝕻𝖗𝖔𝖋𝖎𝖙 and the 3 Wise Mechs
              </p>
              
              {!isMobileView && (
                <p style={{
                  fontSize: "0.85rem",
                  lineHeight: "1.4",
                  color: "rgba(255, 255, 255, 0.7)",
                  margin: 0,
                  marginBottom: "1rem",
                }}>
                  The Virtual Mary (more 'trade life' than trad wife) is learning to trade perpetuals. 
                  Once she hits 100+ trades with a 60%+ win rate and keeps drawdown under 
                  15% for 30 days, the team ascends to the mainnet.
                </p>
              )}
                    
              {/* <p style={{
                fontSize: isMobileView ? "0.8rem" : "0.9rem",
                lineHeight: "1.1",
                color: "rgba(255, 255, 255, 0.8)",
                margin: 0,
                marginBottom: isMobileView ? "0.75rem" : "1rem",
                textAlign: isMobileView ? "center" : "left",
              }}>
                {isMobileView ? "Tap agents to view more stats" : "Click on any agent to view their individual performance and features/trading philosophy."}
              </p> */}
            </>
          )}

          {/* Mainnet Readiness Stats - Only show when user hasn't interacted AND not on mobile */}
          {!userHasInteracted && !isMobileView && (
          <div style={{
            backgroundColor: isMobileView ? "transparent" : "rgba(0, 0, 0, 0.3)",
            backdropFilter: isMobileView ? "none" : "blur(12px)",
            WebkitBackdropFilter: isMobileView ? "none" : "blur(12px)",
            border: isMobileView ? "none" : "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: isMobileView ? "0" : "8px",
            padding: isMobileView ? "0" : (userHasInteracted ? "0.75rem" : "1rem"),
            marginTop: isMobileView ? "0" : "0.5rem",
          }}>
            <h3 
              className="mainnet-readiness-heading"
              style={{
              fontSize: userHasInteracted && !isMobileView ? "0.8rem" : (isMobileView ? "0.85rem" : "0.9rem"),
              fontWeight: "500",
              textAlign: userHasInteracted && !isMobileView ? "center" : (isMobileView ? "center" : "center"),
              marginBottom: userHasInteracted ? "0.5rem" : (isMobileView ? "0.75rem" : "1rem"),
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}>
              Mainnet Readiness
            </h3>
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobileView && userHasInteracted ? "repeat(4, 1fr)" : "repeat(2, minmax(130px, 1fr))",
              gap: userHasInteracted ? 
                (isMobileView ? "0.5rem" : "0.75rem") : 
                (isMobileView ? "0.5rem" : "1rem"),
              marginBottom: userHasInteracted ? 0 : (isMobileView ? "0.5rem" : "1rem"),
            }}>
            <div style={{
              textAlign: "center",
              padding: isMobileView && userHasInteracted ? "0.25rem" : "0.5rem",
              borderRadius: "6px",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              background: isMobileView ? "rgba(0, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.05)",
              backdropFilter: isMobileView ? "blur(12px)" : "none",
              WebkitBackdropFilter: isMobileView ? "blur(12px)" : "none",
            }}>
              <div style={{
                fontWeight: "bold",
                marginBottom: "0.1rem",
              }}>
                <span style={{
                  fontSize: "1.5rem",
                  color: "#ffffff",
                }}>47</span>
                <span style={{
                  fontSize: isMobileView && userHasInteracted ? "0.7rem" : (isMobileView ? "0.9rem" : "1rem"),
                  color: "rgba(255, 255, 255, 0.5)",
                }}> / 100</span>
              </div>
              <div style={{
                fontSize: isMobileView && userHasInteracted ? "0.6rem" : (isMobileView ? "0.7rem" : "0.75rem"),
                color: "rgba(255, 255, 255, 0.6)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                Total Trades
              </div>
            </div>
            
            <div style={{
              textAlign: "center",
              padding: isMobileView && userHasInteracted ? "0.25rem" : "0.5rem",
              borderRadius: "6px",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              background: isMobileView ? "rgba(0, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.05)",
              backdropFilter: isMobileView ? "blur(12px)" : "none",
              WebkitBackdropFilter: isMobileView ? "blur(12px)" : "none",
            }}>
              <div style={{
                fontWeight: "bold",
                marginBottom: "0.1rem",
              }}>
                <span style={{
                  fontSize: "1.5rem",
                  color: "#ffffff",
                }}>52%</span>
                <span style={{
                  fontSize: isMobileView && userHasInteracted ? "0.7rem" : (isMobileView ? "0.9rem" : "1rem"),
                  color: "rgba(255, 255, 255, 0.5)",
                }}> / 60%</span>
              </div>
              <div style={{
                fontSize: isMobileView && userHasInteracted ? "0.6rem" : (isMobileView ? "0.7rem" : "0.75rem"),
                color: "rgba(255, 255, 255, 0.6)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                Win Rate
              </div>
            </div>
            
            <div style={{
              textAlign: "center",
              padding: isMobileView && userHasInteracted ? "0.25rem" : "0.5rem",
              borderRadius: "6px",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              background: isMobileView ? "rgba(0, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.05)",
              backdropFilter: isMobileView ? "blur(12px)" : "none",
              WebkitBackdropFilter: isMobileView ? "blur(12px)" : "none",
            }}>
              <div style={{
                fontWeight: "bold",
                marginBottom: "0.1rem",
              }}>
                <span style={{
                  fontSize: "1.5rem",
                  color: "#ffffff",
                }}>8.2%</span>
                <span style={{
                  fontSize: isMobileView && userHasInteracted ? "0.7rem" : (isMobileView ? "0.9rem" : "1rem"),
                  color: "rgba(255, 255, 255, 0.5)",
                }}> / 15%</span>
              </div>
              <div style={{
                fontSize: isMobileView && userHasInteracted ? "0.6rem" : (isMobileView ? "0.7rem" : "0.75rem"),
                color: "rgba(255, 255, 255, 0.6)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                Max Drawdown
              </div>
            </div>
            
            <div style={{
              textAlign: "center",
              padding: isMobileView && userHasInteracted ? "0.25rem" : "0.5rem",
              borderRadius: "6px",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              background: isMobileView ? "rgba(0, 0, 0, 0.3)" : "rgba(255, 255, 255, 0.05)",
              backdropFilter: isMobileView ? "blur(12px)" : "none",
              WebkitBackdropFilter: isMobileView ? "blur(12px)" : "none",
            }}>
              <div style={{
                fontWeight: "bold",
                marginBottom: "0.1rem",
              }}>
                <span style={{
                  fontSize: "1.5rem",
                  color: "#ffffff",
                }}>7</span>
                <span style={{
                  fontSize: isMobileView && userHasInteracted ? "0.7rem" : (isMobileView ? "0.9rem" : "1rem"),
                  color: "rgba(255, 255, 255, 0.5)",
                }}> / 30</span>
              </div>
              <div style={{
                fontSize: isMobileView && userHasInteracted ? "0.6rem" : (isMobileView ? "0.7rem" : "0.75rem"),
                color: "rgba(255, 255, 255, 0.6)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                Days Live
              </div>
            </div>
            </div>
          </div>
          )}
          
          {!userHasInteracted && !isMobileView && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginTop: "0.75rem",
            }}>
              <div style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#00ff00",
                boxShadow: "0 0 10px rgba(0, 255, 0, 0.8)",
                animation: "pulse 2s infinite",
              }}/>
              <span style={{
                fontSize: isMobileView ? "0.75rem" : "0.85rem",
                color: "rgba(255, 255, 255, 0.7)",
                fontStyle: "italic",
              }}>
                Testnet Training Mode
              </span>
            </div>
          )}
        </div>
     {/* <MemoryMonitor show={true} /> */}
        <TradingOverlay 
          show={showTrading} 
          data={features/tradingData} 
          isConnected={isConnected}
          modelRef={null}
          modelLoaded={modelLoaded}
          onModalStateChange={(isOpen) => {
            setIsCandleModalOpen(isOpen);
            // Delay canvas unmounting slightly to avoid context loss error
            if (isOpen) {
              // When opening modal, immediately hide canvas
              setShouldRenderCanvas(false);
            } else {
              // When closing modal, wait a bit before showing canvas again
              setTimeout(() => setShouldRenderCanvas(true), 100);
            }
          }}
          onNavigationClick={() => {
            // Collapse the intro panel when any nav button is clicked
            if (!userHasInteracted) {
              console.log('Navigation button clicked, collapsing panel');
              setUserHasInteracted(true);
            }
          }}
        />
        {/* Aurora Background - Only render when Aurora is selected */}
        {canvasReady && useAurora && !isCandleModalOpen && (
          <div style={{ 
            position: 'absolute', 
            inset: 0, 
            zIndex: 1 
          }}>
            <Aurora />
          </div>
        )}

        {/* Main Canvas - Unmounted when modal is open for memory optimization */}
        {canvasReady && shouldRenderCanvas && !isCandleModalOpen && (
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
          <fog attach="fog" args={['#000000', 20, 200]} />
          <Suspense fallback={null}>
            <ambientLight intensity={0.3} />
            <PostProcessingEffects />
            
            {/* Starfield background - only show when Aurora is off */}
            {!useAurora && (
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
              is80sMode={false}
              isMobile={isMobileView}
              onAgentClick={(agentId) => {
                if (agentId) {
                  console.log('Agent clicked:', agentId);
                  setFocusedAgent(agentId);
                  setShowAgentCard(true);
                  // Also collapse the intro panel when an agent is clicked
                  if (!userHasInteracted) {
                    setTimeout(() => {
                      setUserHasInteracted(true);
                    }, 500); // Delay to allow animation to start
                  }
                } else {
                  // Agent was deselected (clicked on empty space or pressed Escape)
                  setFocusedAgent(null);
                  setShowAgentCard(false);
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

            <VideoScreens />

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
  {/* Dev Panel Only - Chat is in TradingOverlay */}
  {/* <DevModePanel show={true} /> */}
        {/* Removed RotatingPnL - stats are now in the main panel */}
        
        {/* Focused Agent Card - Shows when an agent is clicked */}
        {/* {console.log('[Temple] FocusedAgentCard render check - focusedAgent:', focusedAgent, 'showAgentCard:', showAgentCard)} */}
        {focusedAgent && showAgentCard && (
          <FocusedAgentCard 
            agentId={focusedAgent}
            onClose={() => {
              setShowAgentCard(false);
              setFocusedAgent(null);
            }}
          />
        )}
        

        {/* Top Controls Container - Music, User, and Nav */}
        {mounted && (
          <>
            {/* Aurora Toggle Button - Small toggle style */}
            {sceneReady && !isMobileView && (
              <div
                style={{
                  position: "fixed",
                  top: "1rem",
                  right: "5.5rem",
                  zIndex: 10001,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  backgroundColor: "rgba(0, 0, 0, 0.7)",
                  backdropFilter: "blur(10px)",
                  borderRadius: "2rem",
                  padding: "0.25rem",
                  border: "2px solid rgba(255, 255, 255, 0.2)",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
                }}
              >
                <span style={{
                  fontSize: isMobileView ? "1rem" : "1.2rem",
                  marginLeft: "0.5rem",
                  opacity: !useAurora ? 1 : 0.5,
                  transition: "opacity 0.3s ease",
                }}>
                  ✨
                </span>
                <button
                  onClick={() => setUseAurora(!useAurora)}
                  style={{
                    position: "relative",
                    width: isMobileView ? "2.5rem" : "3rem",
                    height: isMobileView ? "1.5rem" : "1.75rem",
                    borderRadius: "1rem",
                    backgroundColor: useAurora ? "rgba(200, 150, 255, 0.3)" : "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    padding: 0,
                    outline: "none",
                  }}
                  title={`Switch to ${useAurora ? 'StarField' : 'Aurora'} background`}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "2px",
                      left: useAurora ? "calc(100% - 1.3rem)" : "2px",
                      width: isMobileView ? "1.2rem" : "1.4rem",
                      height: isMobileView ? "1.2rem" : "1.4rem",
                      borderRadius: "50%",
                      backgroundColor: useAurora ? "#c896ff" : "rgba(255, 255, 255, 0.8)",
                      transition: "all 0.3s ease",
                      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
                    }}
                  />
                </button>
                <span style={{
                  fontSize: isMobileView ? "1rem" : "1.2rem",
                  marginRight: "0.5rem",
                  opacity: useAurora ? 1 : 0.5,
                  transition: "opacity 0.3s ease",
                }}>
                  🦄
                </span>
              </div>
            )}
            
            {/* CyberNav Menu with integrated buttons */}
            <div
              style={{
                position: "fixed",
                top: "1rem",
                right: "1rem",
                zIndex: 10001,
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
                    width: isMobileView ? "3.5rem" : "3.5rem",
                    height: isMobileView ? "3.5rem" : "3.5rem",
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
                    width={isMobileView ? "20" : "30"}
                    height={isMobileView ? "20" : "30"}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/>
                    <circle cx="18" cy="16" r="3"/>
                  </svg>
                </button>
                  ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: isMobileView ? "flex-end" : "center",
                    flexDirection: isMobileView ? "column" : "row",
                    gap: "0.5rem",
                    position: "relative",
                  }}
                >
                  <div
                    className={contextIsPlaying ? "spinning-record" : ""}
                    style={{
                      width: isMobileView ? "2.5rem" : "3.75rem",
                      height: isMobileView ? "2.5rem" : "3.75rem",
                      borderRadius: "50%",
                      backgroundImage: "url('/virginRecords.jpg')",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      if (contextIsPlaying) {
                        pause();
                      } else {
                        play();
                      }
                    }}
                    title={contextIsPlaying ? "Pause Music" : "Play Music"}
                  />
                  
                  {/* Additional controls container - positioned differently on mobile */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      gap: "0.25rem",
                      position: isMobileView ? "absolute" : "relative",
                      top: isMobileView ? "0" : "auto",
                      right: isMobileView ? "3rem" : "auto",
                      background: isMobileView ? "rgba(0, 0, 0, 0.8)" : "transparent",
                      padding: isMobileView ? "0.25rem" : "0",
                      borderRadius: isMobileView ? "0.5rem" : "0",
                      backdropFilter: isMobileView ? "blur(10px)" : "none",
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (nextTrack) {
                          nextTrack();
                        }
                      }}
                      style={{
                        width: isMobileView ? "2rem" : "2.5rem",
                        height: isMobileView ? "2rem" : "2.5rem",
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
                      <svg width={isMobileView ? "12" : "16"} height={isMobileView ? "12" : "16"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="5 4 15 12 5 20 5 4"/>
                        <line x1="19" y1="5" x2="19" y2="19"/>
                      </svg>
                    </button>
                    
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
                        width: isMobileView ? "2rem" : "2.5rem",
                        height: isMobileView ? "2rem" : "2.5rem",
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
                      <svg width={isMobileView ? "12" : "16"} height={isMobileView ? "12" : "16"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                </div>
                  )
                }
                userButton={
                  isSignedIn ? (
                    <UserButton
                      afterSignOutUrl="/"
                      appearance={{
                        baseTheme: "dark",
                        elements: {
                          avatarBox: {
                            width: isMobileView ? "3rem" : "3.5rem",
                            height: isMobileView ? "3rem" : "3.5rem",
                            borderRadius: "8px",
                            backgroundColor: "rgba(0, 0, 0, 0.7)",
                            backdropFilter: "blur(10px)",
                            border: "2px solid rgba(255, 255, 255, 0.2)",
                            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)"
                          },
                          userButtonPopoverCard: {
                            backgroundColor: "rgba(0, 0, 0, 0.95)",
                            backdropFilter: "blur(20px)",
                            border: "2px solid rgba(0, 255, 0, 0.3)",
                            borderRadius: "12px",
                            boxShadow: "0 0 30px rgba(0, 255, 0, 0.2)"
                          }
                        }
                      }}
                    />
                  ) : (
                    <SignInButton mode="modal" forceRedirectUrl="/trade">
                      <button
                        style={{
                          width: isMobileView ? "3rem" : "3.5rem",
                          height: isMobileView ? "3rem" : "3.5rem",
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
                    title="Sign In"
                  >
                        <span style={{ fontSize: "2.2rem" }}>{emoji}</span>
                      </button>
                    </SignInButton>
                  )
                }
              />
            </div>
            {/* <div style={{ order: isMobileView ? 4 : 3 }}>
              <button
                style={{
                  width: isMobileView ? "2.5rem" : "3.75rem",
                  height: isMobileView ? "2.5rem" : "3.75rem",
                  borderRadius: "0.5rem",
                  backgroundColor: is80sMode ? "rgba(217, 70, 239, 0.2)" : "rgba(0, 0, 0, 0.7)",
                  border: is80sMode ? "2px solid #D946EF" : "2px solid rgba(255, 255, 255, 0.2)",
                  color: is80sMode ? "#67e8f9" : (showAnnotations ? "#ffff00" : "#ffffff"),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  backdropFilter: "blur(10px)",
                  boxShadow: "0 0.125rem 0.5rem rgba(0, 0, 0, 0.3)",
                }}
                aria-label="Toggle Annotations"
                onClick={() => setShowAnnotations(!showAnnotations)}
                title="Toggle Annotations"
              >
                <svg width={isMobileView ? "20" : "30"} height={isMobileView ? "20" : "30"} viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill={showAnnotations ? "currentColor" : "none"}/>
                  <text 
                    x="12" 
                    y="12" 
                    textAnchor="middle" 
                    dominantBaseline="middle" 
                    fontSize="14" 
                    fontWeight="bold"
                    fill={showAnnotations ? "#000" : "currentColor"}
                  >
                    ?
                  </text>
                </svg>
              </button>
            </div> */}

          </>
        )}
        
        {/* Annotations Toggle */}
        {/* {mounted && sceneReady && (
          <button
            style={{
              position: "fixed",
              // top: isMobileView ? "8rem" : "6rem",
              // right: isMobileView ? "1rem" : "1rem",
              zIndex: 10002,
              color: is80sMode ? "#67e8f9" : (showAnnotations ? "#ffff00" : "#ffffff"),
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              border: `1px solid ${showAnnotations ? "#ffff00" : "rgba(255, 255, 255, 0.2)"}`,
              borderRadius: "0.5rem",
              cursor: "pointer",
              padding: "0.5rem",
              transition: "all 0.3s ease",
              backdropFilter: "blur(10px)",
              boxShadow: "0 0.125rem 0.5rem rgba(0, 0, 0, 0.3)"
            }}
            aria-label="Toggle Annotations"
            onClick={() => setShowAnnotations(!showAnnotations)}
          >
            <svg width={isMobileView ? "30" : "40"} height={isMobileView ? "30" : "40"} viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill={showAnnotations ? "currentColor" : "none"}/>
              <text 
                x="12" 
                y="12" 
                textAnchor="middle" 
                dominantBaseline="middle" 
                fontSize="14" 
                fontWeight="bold"
                fill={showAnnotations ? "#000" : "currentColor"}
              >
                ?
              </text>
            </svg>
          </button>
        )} */}
        {/* Snapshot Button */}
        {/* <button
          onClick={() => setTriggerSnapshot(true)}
          style={{
            position: "fixed",
            bottom: "2rem",
            right: "2rem",
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            backdropFilter: "blur(10px)",
            border: "2px solid rgba(255, 255, 255, 0.3)",
            color: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.3s ease",
            boxShadow: "0 4px 15px rgba(0, 0, 0, 0.3)",
            zIndex: 999,
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
            e.target.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
            e.target.style.transform = "scale(1)";
          }}
          title="Take Snapshot"
        >
          <svg
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button> */}

        {/* Polaroid Snapshot Component */}
        {/* <PolaroidSnapshot 
          trigger={triggerSnapshot}
          onComplete={() => setTriggerSnapshot(false)}
          captureElementId="temple-canvas"
          label="Temple Captured!"
        /> */}
      </div>
    </div>
    </>
  );
}