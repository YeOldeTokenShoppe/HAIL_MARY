"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLanguage } from './LanguageProvider';
import { useRouter } from 'next/navigation';
// import SynthwaveText from './SynthwaveText';
import DriveTitles from './DriveTitles';
import DriveActions from './DriveActions';
import RL80SceneIntro from './RL80SceneIntro';
import BuyModal from './BuyModal';
import CyberNav from './CyberNav';
import HorizontalRoadmap from './HorizontalRoadmap';
import { createLowRider, LOW_RIDER_MODEL_URL } from '@/lib/palmTreeDriveCar.mjs';
import { applyIllustratedStyle } from '@/lib/palmTreeDriveIllustrated.mjs';
import { createCandyEmeraldPaint } from '@/lib/palmTreeDrivePaint.mjs';
import { createPalmTreeDriveCameraHelper } from '@/lib/palmTreeDriveCameraHelper.mjs';
import { DESKTOP_CAMERA_SHOTS, DESKTOP_CAMERA_SECONDS, sampleResponsiveCamera as sampleCameraVariant } from '@/lib/palmTreeDriveCameraPath.mjs';



// MusicPlayer3 removed - using global instance from _app.jsx

// Register GSAP ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);




const PalmsScene = ({ onLoadingChange, onTitleMomentChange }) => {
  const { t, locale } = useLanguage();
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const composerRef = useRef(null);
  const bloomComposerRef = useRef(null);
  const materialShadersRef = useRef([]);
  const clockRef = useRef(null);
  // Cinematic states removed for production
  const [isSceneLoadingInternal, setIsSceneLoadingInternal] = useState(true); // Loading state
  const [modelsLoadState, setModelsLoadState] = useState({
    palm: 'loading', // 'loading', 'loaded', 'error'
    sign: 'loading',
    sun: 'loading', 
    car: 'loading'
  });



  // Define text blocks for transitions using translations
  const textBlocks = [
    [
      t('palmTreeDrive.stage1.line1'),
      t('palmTreeDrive.stage1.line2'),
      t('palmTreeDrive.stage1.line3')
    ],
    [
      t('palmTreeDrive.stage2.line1'),
      t('palmTreeDrive.stage2.line2'),
      t('palmTreeDrive.stage2.line3')
    ],
    [
      t('palmTreeDrive.stage3.line1'),
      t('palmTreeDrive.stage3.line2'),
      t('palmTreeDrive.stage3.line3')
    ],
    [
      t('palmTreeDrive.stage4.line1'),
      t('palmTreeDrive.stage4.line2'),
      t('palmTreeDrive.stage4.line3')
    ],
    [
      t('palmTreeDrive.stage5.line1'),
      t('palmTreeDrive.stage5.line2'),
      t('palmTreeDrive.stage5.line3')
    ]
  ];

  
  // Wrapper to update both internal state and parent
  const setIsSceneLoading = useCallback((loading) => {
    setIsSceneLoadingInternal(loading);
    if (onLoadingChange) {
      onLoadingChange(loading);
    }
  }, [onLoadingChange]);
  
  const isSceneLoading = isSceneLoadingInternal; // Use internal state for reading
  
  // Check if all models are loaded or have errors
  useEffect(() => {
    const allResolved = Object.values(modelsLoadState).every(state => 
      state === 'loaded' || state === 'error'
    );
    const anyLoaded = Object.values(modelsLoadState).some(state => 
      state === 'loaded'
    );
    
    if (allResolved && anyLoaded) {
      setIsSceneLoading(false);
    } else if (allResolved && !anyLoaded) {
      console.error('[PalmTreeDrive] All models failed to load:', modelsLoadState);
      setIsSceneLoading(false); // Show scene anyway to avoid infinite loader
    }
  }, [modelsLoadState, setIsSceneLoading]);
  // Cinematic reverse removed
  const scrollCameraActive = true; // Scroll camera always active
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);
  const [titleMoment, setTitleMoment] = useState('opening');
  useEffect(() => {
    onTitleMomentChange?.(titleMoment);
  }, [titleMoment, onTitleMomentChange]);
  const [currentCameraStage, setCurrentCameraStage] = useState(0); // Track which camera position we're at
  const [showEnterButton, setShowEnterButton] = useState(true); // Show "Take me there" button immediately
  const [hideLastText, setHideLastText] = useState(false); // Hide the last text block after delay
  const [shouldMorph, setShouldMorph] = useState(false); // Trigger morph animation
  const [showBuyModal, setShowBuyModal] = useState(false); // Control BuyModal visibility
  const [isCyberNavOpen, setIsCyberNavOpen] = useState(false); // Control CyberNav menu visibility
  const [hasScrolled, setHasScrolled] = useState(false); // Track if user has started scrolling
  // Music player states
  const [isMobile, setIsMobile] = useState(false);
  const [isVerySmallScreen, setIsVerySmallScreen] = useState(false); // For iPhone 13 mini and similar
  
  
  // Add refs for lights
  const carSpotlightRef = useRef(null);
  const rimLightRef = useRef(null);
  const underglowLightRef = useRef(null);
  const headlightLeftRef = useRef(null);
  const headlightRightRef = useRef(null);

  // Add ref for new light
  const carAccentLightRef = useRef(null);
  
  // Camera authoring controls are opt-in via ?cameraHelper=1.
  
  // Add ref for controls
  const controlsRef = useRef(null);
  
  // Add ref for GSAP timeline
  const cinematicTimelineRef = useRef(null);
  
  // Add refs for 3D card effect
  const cameraRef = useRef(null);
  
  // Add refs for text animation
  const textSectionRef = useRef(null);
  
  // Refs for scroll camera
  const scrollCameraEnabledRef = useRef(true); // Initialize as true to match state
  const scrollProgressRef = useRef(0); // Start at 0 for aerial view
  const animationFrameRef = useRef(null); // Track animation frame ID for cleanup
  const hasScrolledRef = useRef(false); // Track if user has started scrolling
  const animationSkippedRef = useRef(false); // Track if user clicked Skip
  const autoPlayTweenRef = useRef(null); // Track auto-play GSAP tween
  const autoPlayTimeoutRef = useRef(null); // Track auto-play delay timeout
  const autoPlayCancelRef = useRef(null); // Track cancel function for cleanup
  const scrollTriggerRef = useRef(null); // Track ScrollTrigger instance for auto-play toggle
  const scrollTimelineRef = useRef(null); // Track scroll animation timeline

  // Force initial scroll position on mount and page load
  useEffect(() => {
    // Scroll to top immediately
    window.scrollTo(0, 0);
    
    // Also handle page refresh/reload
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    
    // Force scroll to top after a small delay to ensure DOM is ready
    const resetScroll = () => {
      window.scrollTo(0, 0);
      setCurrentCameraStage(0);
      setTitleMoment('opening');
      scrollProgressRef.current = 0;
      setHasScrolled(false);
      hasScrolledRef.current = false;
    };
    
    // Reset on component mount
    resetScroll();
    
    // Also reset after a small delay to catch any browser restoration
    setTimeout(resetScroll, 10);
    setTimeout(resetScroll, 100);
    
    // Handle page visibility changes (tab switching back)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        resetScroll();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Re-enable scroll restoration on unmount
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'auto';
      }
    };
  }, []);
  
  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      // Check if it's a phone specifically (not just narrow screen)
      const userAgent = navigator.userAgent.toLowerCase();
      const isPhone = /iphone|android.*mobile/.test(userAgent);
      const isNarrowScreen = window.innerWidth <= 768;
      const mobileDetected = isPhone && isNarrowScreen;
      setIsMobile(mobileDetected);
      // Detect very small screens (iPhone 13 mini, SE, etc.) for CJK text sizing
      setIsVerySmallScreen(window.innerWidth <= 380);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Detect device performance capabilities
  useEffect(() => {
    const detectDevicePerformance = () => {
      let isLowEnd = false;
      
      // Check for mobile device
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      // Check hardware concurrency (number of CPU cores)
      const cores = navigator.hardwareConcurrency || 1;
      if (cores <= 2) isLowEnd = true;
      
      // Check device memory if available
      if ('deviceMemory' in navigator) {
        // @ts-ignore - deviceMemory might not be in TypeScript definitions
        if (navigator.deviceMemory <= 4) isLowEnd = true;
      }
      
      // Check connection speed if available
      if ('connection' in navigator) {
        // @ts-ignore - connection might not be in TypeScript definitions
        const connection = navigator.connection;
        if (connection && connection.effectiveType) {
          if (connection.effectiveType === 'slow-2g' || 
              connection.effectiveType === '2g' || 
              connection.effectiveType === '3g') {
            isLowEnd = true;
          }
        }
      }
      
      // Check screen size for very small devices
      if (window.screen.width < 400 || window.screen.height < 400) {
        isLowEnd = true;
      }
      
      // For iOS devices, check older models
      if (/iPhone/.test(navigator.userAgent)) {
        // Check for older iPhone models (rough detection)
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            // Older PowerVR GPUs indicate older iPhones
            if (renderer.includes('PowerVR')) isLowEnd = true;
          }
        }
      }
      
      // Combine mobile + limited resources
      if (isMobileDevice && cores <= 4) isLowEnd = true;
      
    };
    
    detectDevicePerformance();
  }, []);
  
  // Handle text transitions when camera stage changes
  useEffect(() => {
    if (previousCameraStage.current !== currentCameraStage && scrollCameraActive) {
      const lines = gsap.utils.toArray('.scroll-text-line');
      
      // Animate text transition
      if (lines.length > 0) {
        gsap.fromTo(lines, 
          {
            opacity: 0,
            y: 20,
            filter: 'blur(10px)'
          },
          {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            duration: 0.6,
            stagger: 0.05,
            ease: "power2.out"
          }
        );
      }
      
      previousCameraStage.current = currentCameraStage;
    }
  }, [currentCameraStage, scrollCameraActive]);
  
  // Let the final title settle before revealing the action buttons.
  useEffect(() => {
    setShouldMorph(false);
    if (titleMoment !== 'final') return;
    const timer = setTimeout(() => setShouldMorph(true), 1800);
    return () => clearTimeout(timer);
  }, [titleMoment]);
  
  const carModelRef = useRef(null);
  const intersectionRef = useRef(null);
  const maryMeshRef = useRef(null);
  const maryLightRef = useRef(null);
  const [maryGlowing, setMaryGlowing] = useState(false);
  const maryGlowingRef = useRef(false);
  const router = useRouter();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const previousCameraStage = useRef(0);
  
  // Skip animation function
  const skipAnimation = useCallback(() => {
    // Kill auto-play if running
    if (autoPlayTimeoutRef.current) {
      clearTimeout(autoPlayTimeoutRef.current);
      autoPlayTimeoutRef.current = null;
    }
    if (autoPlayTweenRef.current) {
      autoPlayTweenRef.current.kill();
      autoPlayTweenRef.current = null;
    }

    // First, ensure scrolling is enabled on the body and html
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.height = 'auto';
    
    setIntroDone(true);
    // Immediately set to final stage
    setCurrentCameraStage(4);
    setTitleMoment('final');
    scrollProgressRef.current = 1;
    
    // Mark as scrolled to hide the button
    setHasScrolled(true);
    hasScrolledRef.current = true;

    // Mark animation as skipped so ScrollTrigger callbacks won't reset the stage
    animationSkippedRef.current = true;

    // Get all ScrollTriggers, jump to end, then kill them so scroll events
    // can no longer drag the animation back to the start
    const triggers = ScrollTrigger.getAll();
    triggers.forEach(trigger => {
      if (trigger.animation) {
        // Jump the timeline to the end
        trigger.animation.progress(1);
        trigger.animation.pause();
      }
      trigger.kill();
    });
    
    // Detect if mobile for scroll distance
    const userAgent = navigator.userAgent.toLowerCase();
    const isIPhone = /iphone/i.test(userAgent);
    const isAndroid = /android/i.test(userAgent) && /mobile/i.test(userAgent);
    const hasSmallScreen = window.innerWidth < 600 || window.innerHeight < 600;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isMobileDevice = (isIPhone || isAndroid) && hasSmallScreen && hasTouch;
    
    // Get the actual scroll container and calculate its height
    const scrollContainer = document.getElementById('scroll-container');
    let targetScroll;
    
    if (scrollContainer) {
      // Use the actual height of the scroll container
      const containerHeight = scrollContainer.offsetHeight;
      targetScroll = containerHeight - window.innerHeight;
    } else {
      // Fallback to calculated height
      const viewportHeight = window.innerHeight;
      targetScroll = isMobileDevice ? (viewportHeight * 7) : (viewportHeight * 3);
    }
    
    
    // Instant scroll to the end
    window.scrollTo(0, targetScroll);
    document.documentElement.scrollTop = targetScroll;
    document.body.scrollTop = targetScroll;
    
  }, [setShouldMorph]);
  
  // Detect if device is mobile for routing
  const detectMobileDevice = useCallback(() => {
    const userAgent = navigator.userAgent;
    const lowerUA = userAgent.toLowerCase();
    
    const isIPhone = /iphone/i.test(lowerUA);
    const isAndroid = /android/i.test(lowerUA);
    const hasMobileKeyword = /mobile/i.test(lowerUA);
    
    const innerWidth = window.innerWidth;
    const innerHeight = window.innerHeight;
    const pixelRatio = window.devicePixelRatio || 1;
    const physicalWidth = window.screen.width / pixelRatio;
    const physicalHeight = window.screen.height / pixelRatio;
    
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isPhoneUA = isIPhone || (isAndroid && hasMobileKeyword);
    const hasPhoneSize = Math.min(innerWidth, innerHeight) < 600 || 
                        Math.min(physicalWidth, physicalHeight) < 400;
    
    return isPhoneUA && hasTouch && hasPhoneSize;
  }, []);

  

  
  
  // Light settings
  const lightSettings = {
    carSpotlight: {
      color: '#ff00ff',
      intensity: 3,
      distance: 50,
      angle: Math.PI,
      penumbra: 0.225,
      position: { x: 0.02, y: 0.49, z: 5.93 }
    },
    rimLight: {
      color: '#00ffff',
      intensity: 1.32,
      position: { x: -0.12, y: 2.48, z: -5.64 }
    },
    carAccentLight: {
      color: '#f4f1f4',
      intensity: 2.39,
      distance: 50,
      angle: Math.PI,
      penumbra: 0.225,
      position: { x: 0.02, y: 0.79, z: 6.78 }
    },
    underglow: {
      color: '#ff00ff',
      intensity: 2,
      distance: 5,
      position: { x: 0, y: -0.5, z: 7 }
    },
    headlights: {
      color: '#ffffff',
      intensity: 1,
      distance: 30,
      angle: Math.PI / 6,
      penumbra: 0.3
    }
  };

  useEffect(() => {
    if (!mountRef.current) return;
    const ending = new URLSearchParams(window.location.search).get('ending') === 'statue' ? 'statue' : 'heart';
    const sampleResponsiveCamera = (progress, aspect, output = {}) => sampleCameraVariant(progress, aspect, output, ending);

    let carPaint = null;

    // Create a fresh clock for this mount
    clockRef.current = new THREE.Clock();
    
    // Reset material shaders array
    materialShadersRef.current = [];
    
    // Reveal the scene only when the model callbacks have resolved.
    setIsSceneLoading(true);
    setModelsLoadState({ palm: 'loading', sign: 'loading', sun: 'loading', car: 'loading' });

    // Noise shader function
    const noise = `
    vec3 mod289(vec3 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 mod289(vec4 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 permute(vec4 x) {
         return mod289(((x*34.0)+1.0)*x);
    }

    vec4 taylorInvSqrt(vec4 r)
    {
      return 1.79284291400159 - 0.85373472095314 * r;
    }

    float snoise(vec3 v)
      { 
      const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

    // First corner
      vec3 i  = floor(v + dot(v, C.yyy) );
      vec3 x0 =   v - i + dot(i, C.xxx) ;

    // Other corners
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );

      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;

    // Permutations
      i = mod289(i); 
      vec4 p = permute( permute( permute( 
                 i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
               + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

      float n_ = 0.142857142857;
      vec3  ns = n_ * D.wyz - D.xzx;

      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );

      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);

      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );

      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));

      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);

      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;

      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                    dot(p2,x2), dot(p3,x3) ) );
    }
    `;

    const materialShaders = [];
    let lowRider = null;
    let disposed = false;
    let startCameraSequence = null;
    let cameraSequenceStarted = false;
    let cameraHelper = null;
    const cameraHelperEnabled = new URLSearchParams(window.location.search).get('cameraHelper') === '1';
    const retryTimers = new Set();
    const resolvedModelNames = new Set();
    const speed = 15; // Increased from 10 to make the car appear faster
    
    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    // DISABLED CINEMATIC - Set a simple starting position instead
    // const initialKeyframes = recordedKeyframesRef.current.length > 0 ? recordedKeyframesRef.current : defaultCinematicKeyframes;
    // camera.position.copy(initialKeyframes[0].position);
    // camera.lookAt(initialKeyframes[0].target);
    
    // Detect if device is mobile for initial camera position
    const isMobileDevice = (() => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isIPhone = /iphone/i.test(userAgent);
      const isAndroid = /android/i.test(userAgent) && /mobile/i.test(userAgent);
      const hasSmallScreen = window.innerWidth < 600 || window.innerHeight < 600;
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      return (isIPhone || isAndroid) && hasSmallScreen && hasTouch;
    })();
    
    // Every viewport starts at the same captured opening shot.
    camera.position.set(DESKTOP_CAMERA_SHOTS[0].x, DESKTOP_CAMERA_SHOTS[0].y, DESKTOP_CAMERA_SHOTS[0].z);
    camera.lookAt(DESKTOP_CAMERA_SHOTS[0].targetX, DESKTOP_CAMERA_SHOTS[0].targetY, DESKTOP_CAMERA_SHOTS[0].targetZ);
    camera.fov = sampleResponsiveCamera(0, camera.aspect).fov;
    camera.updateProjectionMatrix();
    cameraRef.current = camera;
    
    // Check for WebGL support
    const canvas = document.createElement('canvas');
    const webglContext = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!webglContext) {
      console.error('WebGL is not supported in this browser');
      // Show fallback message
      const fallbackMessage = document.createElement('div');
      fallbackMessage.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-size: 20px;
        text-align: center;
        padding: 20px;
        background: rgba(0, 0, 0, 0.8);
        border-radius: 10px;
      `;
      fallbackMessage.innerHTML = 'WebGL is not available.<br/>Please enable hardware acceleration in your browser settings.';
      mountRef.current.appendChild(fallbackMessage);
      return;
    }
    
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ 
        antialias: !isMobileDevice, // Disable antialiasing on mobile for performance
        powerPreference: isMobileDevice ? "low-power" : "high-performance",
        failIfMajorPerformanceCaveat: false // Allow software rendering as fallback
      });
    } catch (error) {
      console.error('Failed to create WebGL renderer:', error);
      // Show fallback message
      const fallbackMessage = document.createElement('div');
      fallbackMessage.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        font-size: 20px;
        text-align: center;
        padding: 20px;
        background: rgba(0, 0, 0, 0.8);
        border-radius: 10px;
      `;
      fallbackMessage.innerHTML = 'Unable to initialize 3D graphics.<br/>Please try refreshing the page.';
      mountRef.current.appendChild(fallbackMessage);
      return;
    }
    // Reduce pixel ratio on mobile for better performance
    const pixelRatio = isMobileDevice ? Math.min(window.devicePixelRatio, 1.5) : window.devicePixelRatio;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    rendererRef.current = renderer;
    
    // Clear any existing children before adding the new renderer
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }
    mountRef.current.appendChild(renderer.domElement);

    // --- Selective Bloom Setup ---
    const BLOOM_LAYER = 1;
    const bloomLayer = new THREE.Layers();
    bloomLayer.set(BLOOM_LAYER);

    const renderWidth = mountRef.current.clientWidth;
    const renderHeight = mountRef.current.clientHeight;

    // Bloom composer — renders only bloom-layer objects
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(renderWidth, renderHeight),
      1.0,   // strength
      0.1,   // radius
      0.8    // threshold
    );

    // Store bloom layer index for later use
    renderer.userData = { BLOOM_LAYER, bloomLayer };

    // Dark material to hide non-bloom objects during bloom pass
    const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const storedMaterials = {};

    function darkenNonBloomed(obj) {
      if (obj.isMesh && !bloomLayer.test(obj.layers)) {
        storedMaterials[obj.uuid] = obj.material;
        obj.material = darkMaterial;
      }
    }
    function restoreMaterials(obj) {
      if (storedMaterials[obj.uuid]) {
        obj.material = storedMaterials[obj.uuid];
        delete storedMaterials[obj.uuid];
      }
    }

    // Bloom-only composer
    const bloomComposer = new EffectComposer(renderer);
    bloomComposer.renderToScreen = false;
    bloomComposer.addPass(new RenderPass(scene, camera));
    bloomComposer.addPass(bloomPass);
    bloomComposerRef.current = bloomComposer;

    // Final composite shader — blends bloom on top of base render
    const compositeShader = {
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D baseTexture;
        uniform sampler2D bloomTexture;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv);
        }
      `,
    };

    const finalComposer = new EffectComposer(renderer);
    finalComposer.addPass(new RenderPass(scene, camera));
    const compositePass = new ShaderPass(new THREE.ShaderMaterial(compositeShader), 'baseTexture');
    compositePass.needsSwap = true;
    finalComposer.addPass(compositePass);
    finalComposer.addPass(new ShaderPass(GammaCorrectionShader));
    composerRef.current = finalComposer;

    // Store helpers on renderer for use in render loop
    renderer.userData.darkenNonBloomed = darkenNonBloomed;
    renderer.userData.restoreMaterials = restoreMaterials;
    renderer.userData.bloomComposer = bloomComposer;
    renderer.userData.finalComposer = finalComposer;

    // Create sunset gradient background
    const gradientCanvas = document.createElement('canvas');
    gradientCanvas.width = 512;
    gradientCanvas.height = 512;
    const gradientCtx = gradientCanvas.getContext('2d');
    
    // Create sunset gradient - traditional orange sunset
    const gradient = gradientCtx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#001a33');      // Dark blue at top
    gradient.addColorStop(0.3, '#ff6b35');    // Orange
    gradient.addColorStop(0.4, '#ff8c42');    // Bright orange
    gradient.addColorStop(1, '#ffa500');      // Golden orange at bottom
    
    gradientCtx.fillStyle = gradient;
    gradientCtx.fillRect(0, 0, 512, 512);
    
    const gradientTexture = new THREE.CanvasTexture(gradientCanvas);
    scene.background = gradientTexture;
    // Adjustable fog settings - increase distances to reduce white-out effect
    // Parameters: (color, near distance, far distance)
    // Near: where fog starts to appear
    // Far: where fog becomes fully opaque
    scene.fog = new THREE.Fog(0xff7f50, 50, 100); // Increased distances for less white-out
    
    // Sunset environment lighting
    // Warm ambient light with orange/pink tones
    const ambientLight = new THREE.AmbientLight(0xffa07a, 0.9); // Light salmon color - increased for more even lighting
    scene.add(ambientLight);
    
    // Main sun light - strong directional light from the horizon
    const sunLight = new THREE.DirectionalLight(0xff6b35, 1.2); // Warm orange
    sunLight.position.set(0, 5, -50); // Low on horizon, behind the scene
    sunLight.castShadow = true;
    scene.add(sunLight);
    
    // Secondary fill light - purple/pink from opposite side
    const fillLight = new THREE.DirectionalLight(0x9370db, 0.5); // Medium purple
    fillLight.position.set(20, 10, 20); // Moved to right side to balance lighting
    scene.add(fillLight);
    
    // Add a balancing light from the left
    const balanceLight = new THREE.DirectionalLight(0xffa500, 0.4); // Orange
    balanceLight.position.set(-20, 8, 10);
    scene.add(balanceLight);
    
    // Hemisphere light for sky/ground color variation
    const hemiLight = new THREE.HemisphereLight(
      0xff7f50, // Sky color - coral
      0x4b0082, // Ground color - indigo
      0.6
    );
    scene.add(hemiLight);
    
    // Rim lighting effect - cyan accent from behind
    const rimLight = new THREE.DirectionalLight(0x00ffff, 0.2);
    rimLight.position.set(0, 15, -30);
    scene.add(rimLight);

    // Add car-specific lighting immediately (before model loads)
    // This prevents the scene from appearing dark if rendering starts before car loads
    const carSpotlight = new THREE.SpotLight(
      lightSettings.carSpotlight.color,
      lightSettings.carSpotlight.intensity,
      lightSettings.carSpotlight.distance,
      lightSettings.carSpotlight.angle,
      lightSettings.carSpotlight.penumbra
    );
    carSpotlight.position.set(
      lightSettings.carSpotlight.position.x + 2.5, // Account for car position offset
      lightSettings.carSpotlight.position.y,
      lightSettings.carSpotlight.position.z + 25.6
    );
    carSpotlightRef.current = carSpotlight;
    scene.add(carSpotlight);

    // Add car accent light
    const carAccentLight = new THREE.SpotLight(
      lightSettings.carAccentLight.color,
      lightSettings.carAccentLight.intensity,
      lightSettings.carAccentLight.distance,
      lightSettings.carAccentLight.angle,
      lightSettings.carAccentLight.penumbra
    );
    carAccentLight.position.set(
      lightSettings.carAccentLight.position.x + 2.5,
      lightSettings.carAccentLight.position.y,
      lightSettings.carAccentLight.position.z + 25.6
    );
    carAccentLightRef.current = carAccentLight;
    scene.add(carAccentLight);

    // Add rim lighting from behind for car
    const carRimLight = new THREE.DirectionalLight(
      lightSettings.rimLight.color,
      lightSettings.rimLight.intensity
    );
    carRimLight.position.set(
      lightSettings.rimLight.position.x,
      lightSettings.rimLight.position.y,
      lightSettings.rimLight.position.z
    );
    rimLightRef.current = carRimLight;
    scene.add(carRimLight);

    // Add OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = true; // Allow panning in screen space
    controls.minDistance = 0.1;
    controls.maxDistance = 0;
    controls.maxPolarAngle = Math.PI * 0.5; // Initial limit - will be dynamic
    controls.minPolarAngle = 0; // Prevent camera from flipping
    controls.target.set(DESKTOP_CAMERA_SHOTS[0].targetX, DESKTOP_CAMERA_SHOTS[0].targetY, DESKTOP_CAMERA_SHOTS[0].targetZ);
    controls.zoomToCursor = true;
    controls.enabled = false; // Start with controls disabled since scroll camera is active
    // Don't call controls.update() here - it repositions the camera even when disabled
    controlsRef.current = controls; // Store ref for access in event handlers
    
    camera.position.set(DESKTOP_CAMERA_SHOTS[0].x, DESKTOP_CAMERA_SHOTS[0].y, DESKTOP_CAMERA_SHOTS[0].z);
    camera.lookAt(DESKTOP_CAMERA_SHOTS[0].targetX, DESKTOP_CAMERA_SHOTS[0].targetY, DESKTOP_CAMERA_SHOTS[0].targetZ);
    camera.updateProjectionMatrix();

    // Ground and road
    // Extend only the rear (+Z) terrain, retaining the original front edge.
    const planeGeom = new THREE.PlaneGeometry(100, 220, 200, 440);
    planeGeom.rotateX(-Math.PI * 0.5);
    planeGeom.translate(0, 0, 60); // z=-50 through z=170
    // Preserve the existing hill pattern and grid density on the original land.
    const terrainPositions = planeGeom.attributes.position;
    const terrainUVs = planeGeom.attributes.uv;
    for (let i = 0; i < terrainPositions.count; i++) {
      terrainUVs.setXY(i, terrainPositions.getX(i) / 100 + 0.5, 0.5 - terrainPositions.getZ(i) / 100);
    }
    terrainUVs.needsUpdate = true;
    
    // Create shader material
    const planeMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        contactShadowsReady: { value: 0 },
        tireContacts: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
        chassisContact: { value: new THREE.Vector4() },
        fogColor: { value: scene.fog.color },
        fogNear: { value: scene.fog.near },
        fogFar: { value: scene.fog.far }
      },
      vertexShader: `
        precision highp float;
        uniform float time;
        varying vec3 vPos;
        varying vec2 vUv;
        ${noise}
        
        void main() {
          vUv = uv;
          vec3 transformed = position;
          
          vec2 tuv = uv;
          float t = time * 0.01 * ${speed}.;
          tuv.y += t;
          transformed.y = snoise(vec3(tuv * 5., 0.)) * 5.;
          transformed.y *= smoothstep(5., 15., abs(transformed.x));
          vPos = transformed;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float time;
        uniform vec3 fogColor;
        uniform float fogNear;
        uniform float fogFar;
        uniform float contactShadowsReady;
        uniform vec4 tireContacts[4];
        uniform vec4 chassisContact;
        varying vec3 vPos;
        varying vec2 vUv;
        
        float line(vec3 position, float width, vec3 step) {
          vec3 tempCoord = position / step;
          vec2 coord = tempCoord.xz;
          coord.y -= time * ${speed}. / 2.;
          vec2 grid = abs(fract(coord - 0.5) - 0.5) / (fwidth(coord) * width);
          float line = min(grid.x, grid.y);
          return min(line, 1.0);
        }
        
        float dashLine(vec3 position) {
          // Create dashed center line
          float centerDist = abs(position.x); // Distance from road center (x=0)
          float lineWidth = 0.2;
          float dashLength = 3.0;
          float dashGap = 2.0;
          
          // Create dashes along Z (with animated motion)
          float animatedZ = position.z - time * ${speed}. / 2.;
          float dashPattern = step(0.5, fract(animatedZ / (dashLength + dashGap)));
          
          // Line mask
          float lineMask = 1.0 - smoothstep(0.0, lineWidth, centerDist);
          
          return lineMask * dashPattern;
        }
        
        void main() {
          float l = line(vPos, 1.0, vec3(2.0));
          vec3 base = mix(vec3(0.0, 0.75, 1.0), vec3(0.0), smoothstep(5., 7.5, abs(vPos.x)));
          vec3 baseColor = vec3(1.0, 0.0, 0.933); // #ff00ee
          vec3 roadColor = mix(baseColor, base, l);
          
          // Add dashed center line
          float centerLine = dashLine(vPos);
          vec3 lineColor = vec3(1.0, 1.0, 1.0); // White
          vec3 c = mix(roadColor, lineColor, centerLine * 0.8);

          // Analytic contact shadows stay attached to the parked car while the
          // road markings move. No shadow map, texture download, or extra pass.
          if (contactShadowsReady > 0.5) {
            vec2 bodyOffset = (vPos.xz - chassisContact.xy) / chassisContact.zw;
            // Violet chassis underglow spreads onto the procedural road;
            // standard Three.js lights cannot illuminate this custom shader.
            float glow = exp(-0.95 * dot(bodyOffset, bodyOffset));
            c = mix(c, vec3(0.48, 0.025, 1.15), 0.75 * glow);
            float shade = 0.30 * exp(-2.0 * dot(bodyOffset, bodyOffset));
            for (int i = 0; i < 4; i++) {
              vec2 offset = (vPos.xz - tireContacts[i].xy) / tireContacts[i].zw;
              shade = max(shade, 0.82 * exp(-2.5 * dot(offset, offset)));
            }
            c *= 1.0 - shade;
          }
          
          // Apply fog
          float depth = gl_FragCoord.z / gl_FragCoord.w;
          float fogFactor = smoothstep(fogNear, fogFar, depth);
          c = mix(c, fogColor, fogFactor);
          
          gl_FragColor = vec4(c, 1.0);
        }
      `,
      fog: true
    });
    
    materialShaders.push(planeMat);
    
    const plane = new THREE.Mesh(planeGeom, planeMat);
    scene.add(plane);


    // Create loading manager to track all assets
    const loadingManager = new THREE.LoadingManager();
    let modelsToLoad = 0;
    let modelsLoaded = 0;
    
    // Retry configuration
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    const retryCount = {};
    
    loadingManager.onStart = () => {
      modelsToLoad++;
    };
    
    
    loadingManager.onError = (url) => {
      console.error(`[CRITICAL] Failed to load model: ${url}`);
      // A failed request may be retried. Only the final failure callback
      // resolves a model's loading state.

      // Log additional debug info for production issues
      console.error('[Debug] Failed URL:', url);
      console.error('[Debug] Current origin:', window.location.origin);
      console.error('[Debug] Full path attempted:', new URL(url, window.location.origin).href);
    };
    
    // Set up DRACO loader for compressed models
    const dracoLoader = new DRACOLoader();
    // Use explicit path that works in production
    const dracoPath = '/draco/';
    dracoLoader.setDecoderPath(dracoPath);
    dracoLoader.setWorkerLimit(2);
    dracoLoader.preload(); // Use the bundled WASM decoder when available.
    
    const loader = new GLTFLoader(loadingManager);
    loader.setDRACOLoader(dracoLoader);
    
    
    // Helper function to load models with retry logic
    const loadModelWithRetry = (path, onSuccess, onProgress, onError, modelName) => {
      const attemptKey = `${modelName}_${path}`;
      if (!retryCount[attemptKey]) {
        retryCount[attemptKey] = 0;
      }
      
      const attemptLoad = () => {
        if (disposed) return;
        loader.load(
          path,
          (gltf) => {
            if (disposed) return;
            onSuccess(gltf);
            resolvedModelNames.add(modelName);
            startCameraSequence?.();
          },
          onProgress,
          (error) => {
            if (disposed) return;
            retryCount[attemptKey]++;
            // console.error(`[PalmTreeDrive] Error loading ${modelName} (attempt ${retryCount[attemptKey]}):`, error);
            
            if (retryCount[attemptKey] <= maxRetries) {
              const timer = setTimeout(() => { retryTimers.delete(timer); attemptLoad(); }, retryDelay);
              retryTimers.add(timer);
            } else {
              // console.error(`[PalmTreeDrive] Failed to load ${modelName} after ${maxRetries} retries`);
              onError(error);
              resolvedModelNames.add(modelName);
              startCameraSequence?.();
            }
          }
        );
      };
      
      attemptLoad();
    };

    // Helper function for smooth step (used by both palm and sign animations)
    function smoothstep(edge0, edge1, x) {
      const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
      return t * t * (3 - 2 * t);
    }

    // Load Palm Tree GLB with error handling and retry
    const palmPath = '/models/palm2.glb';
    loadModelWithRetry(palmPath, (gltf) => {
      const palmModel = gltf.scene;
      
      // Mark palm model as loaded
      setModelsLoadState(prev => ({ ...prev, palm: 'loaded' }));
      

      
      // Find all meshes for debugging
      const allMeshes = [];
      palmModel.traverse((child) => {

        if (child.isMesh) {
          allMeshes.push(child);
        }
      });
      
      
      // Use the first mesh or try to use the whole scene
      let palmMesh = allMeshes[0];
      

      
      // Get geometry and material from the loaded model
      let palmGeometry, palmMaterial;
      
      if (palmMesh.isMesh) {
        palmGeometry = palmMesh.geometry.clone();
        palmMaterial = palmMesh.material.clone();
        

        
        // Ensure material is visible
        palmMaterial.transparent = false;
        palmMaterial.opacity = 1;
        palmMaterial.side = THREE.DoubleSide;
      } else {
        console.error('Selected object is not a mesh, cannot extract geometry');
        return;
      }
      
      // Allow one extra 20-unit pair into the horizon, fading whole instances
      // without shrinking trees or changing the repeating intervals.
      palmMaterial.alphaHash = true;
      const originalPalmCompile = palmMaterial.onBeforeCompile;
      const originalPalmKey = palmMaterial.customProgramCacheKey();
      palmMaterial.onBeforeCompile = function(shader, renderer) {
        originalPalmCompile.call(this, shader, renderer);
        shader.vertexShader = 'varying float vPalmLandFade;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
          #include <begin_vertex>
          vec4 palmRoot = vec4(0.0, 0.0, 0.0, 1.0);
          #ifdef USE_INSTANCING
            palmRoot = instanceMatrix * palmRoot;
          #endif
          float palmRootZ = (modelMatrix * palmRoot).z;
          // Keep the approved forward horizon. Rear trees now extend over land
          // and fade beyond the scene fog, instead of dissolving near the car.
          float forwardFade = smoothstep(-62.0, -45.0, palmRootZ);
          float rearFade = 1.0 - smoothstep(130.0, 160.0, palmRootZ);
          vPalmLandFade = forwardFade * rearFade;
        `);
        shader.fragmentShader = 'varying float vPalmLandFade;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
          #include <color_fragment>
          if (vPalmLandFade <= 0.0) discard;
          diffuseColor.a *= vPalmLandFade;
        `);
      };
      palmMaterial.customProgramCacheKey = () => `${originalPalmKey}|palm-land-fade-v5`;

      // Keep trunks outside the low camera orbit (x=-6.42 through x=8).
      // Fixed wider rows also prevent moving palms from crossing the lens.
      const palmPositions = [];
      for (let i = 0; i < 20; i++) {
        palmPositions.push(-11, 0, i * 20 - 10 - 50);
        palmPositions.push(11, 0, i * 20 - 50);
      }
      
      // Debug geometry bounds
      palmGeometry.computeBoundingBox();
      const bbox = palmGeometry.boundingBox;

      
      // Create instanced mesh
      const instanceCount = palmPositions.length / 3;
      const palms = new THREE.InstancedMesh(palmGeometry, palmMaterial, instanceCount);
      
      // Set up transform matrices for each instance
      const dummy = new THREE.Object3D();
      const matrix = new THREE.Matrix4();
      
      // Calculate appropriate scale based on geometry size
      const size = new THREE.Vector3().subVectors(bbox.max, bbox.min);
      const maxDimension = Math.max(size.x, size.y, size.z);
      const targetHeight = 14; // Desired height for palm trees
      const scaleFactor = targetHeight / maxDimension;
      
      
      for (let i = 0; i < instanceCount; i++) {
        const x = palmPositions[i * 3];
        const y = palmPositions[i * 3 + 1];
        const z = palmPositions[i * 3 + 2];
        
        dummy.position.set(x, y, z);
        dummy.scale.set(scaleFactor, scaleFactor, scaleFactor); // Auto-scale based on model size
        
        // Mirror palm trees on the left side
        if (x < 0) {
          dummy.scale.x = -scaleFactor;
        }
        
        // Add slight rotation variation
        dummy.rotation.y = Math.random() * Math.PI * 2;
        
        dummy.updateMatrix();
        
        palms.setMatrixAt(i, dummy.matrix);
      }
      
      // A longer repeating lattice preserves the 20-unit intervals. Both ends
      // stay well beyond the 100-unit fog range, including during the rear sweep.
      const rowLength = 400;
      let palmTravel = 0;
      palms.frustumCulled = false;
      const animatePalms = (_time, delta = 0) => {
        palmTravel = (palmTravel + Math.min(Math.max(delta, 0), 0.1) * speed) % rowLength;
        const rearBoundary = camera.position.z - rowLength / 2;
        for (let i = 0; i < instanceCount; i++) {
          const baseX = palmPositions[i * 3];
          const offset = palmPositions[i * 3 + 2] + palmTravel - rearBoundary;
          const z = rearBoundary + ((offset % rowLength) + rowLength) % rowLength;
          dummy.position.set(baseX, palmPositions[i * 3 + 1], z);
          dummy.scale.set(baseX < 0 ? -scaleFactor : scaleFactor, scaleFactor, scaleFactor);
          dummy.rotation.y = Math.PI * 2 * ((i * 0.618) % 1);
          dummy.updateMatrix();
          palms.setMatrixAt(i, dummy.matrix);
        }
        palms.instanceMatrix.needsUpdate = true;
      };
      animatePalms(0, 0);

      // Add animation update function to materialShaders
      materialShaders.push({ update: animatePalms });
      
      scene.add(palms);
    }, 
    (progress) => {
    },
    (error) => {
      console.error('[CRITICAL] Palm tree model failed after all retries:', error);
      setModelsLoadState(prev => ({ ...prev, palm: 'error' }));
    }, 'palm');
    
    // Load Road Sign model with retry
    const signPath = '/models/sign2.glb';
    loadModelWithRetry(signPath, (gltf) => {
      const signModel = gltf.scene;
      
      // Mark sign model as loaded
      setModelsLoadState(prev => ({ ...prev, sign: 'loaded' }));
      
      // Find the first mesh in the sign model
      let signMesh = null;
      signModel.traverse((child) => {
        if (child.isMesh && !signMesh) {
          signMesh = child;
        }
      });
      
      if (!signMesh) {
        console.error('No mesh found in road sign GLB model');
        return;
      }
      
      // Get geometry and material from the loaded model
      const signGeometry = signMesh.geometry.clone();
      const signMaterial = signMesh.material.clone();
      
      // Set up road sign positions (less frequent than palm trees)
      const signPositions = [];
      // Only place signs on the right side, spaced 80 units apart
      // Starting at -40 to be between palm trees
      signPositions.push(6, 4, -40);   // First sign
      signPositions.push(6, 4, 40);    // Second sign, 80 units later
      
      // Create instanced mesh for signs
      const signCount = signPositions.length / 3;
      const signs = new THREE.InstancedMesh(signGeometry, signMaterial, signCount);
      
      // Set up transform matrices for each sign
      const signDummy = new THREE.Object3D();
      
      for (let i = 0; i < signCount; i++) {
        const x = signPositions[i * 3];
        const y = signPositions[0];
        const z = signPositions[i * 3 + 2];
        
        signDummy.position.set(x, y, z);
        signDummy.scale.set(1, 1, 1); // Make signs larger
        
        // Set rotation order to prevent unwanted tilting
        signDummy.rotation.order = 'XYZ';
        
        // Try no rotation first to see default orientation
        signDummy.rotation.x = 0; // No rotation to see original orientation
        
        // Then rotate signs to face the road
        // if (x < 0) {
        //   signDummy.rotation.y = Math.PI * 0.25; // Face slightly toward road from left
        // } else {
        //   signDummy.rotation.y = -Math.PI * 0.25; // Face slightly toward road from right
        // }
        
        // Ensure no Z rotation
        signDummy.rotation.z = 0;
        
        signDummy.updateMatrix();
        signs.setMatrixAt(i, signDummy.matrix);
      }
      
      // Store initial positions for animation
      const initialSignPositions = new Float32Array(signPositions);
      
      // Animation function for road signs
      const animateSigns = (time) => {
        for (let i = 0; i < signCount; i++) {
          const baseX = initialSignPositions[i * 3];
          const baseY = initialSignPositions[i * 3 + 1];
          const baseZ = initialSignPositions[i * 3 + 2];
          
          // Animate position along Z axis (same speed as palm trees)
          // Signs are 80 units apart, so loop every 160 units (2 signs * 80 units)
          const animatedZ = ((baseZ + time * speed + 80) % 160) - 80;
          
          // Scale based on distance (signs visible from further away)
          const scaleFactor = 0.6 + smoothstep(60, 50, Math.abs(animatedZ)) * 0.8;
          
          signDummy.position.set(baseX, 0, animatedZ);
          signDummy.scale.set(scaleFactor * 1, scaleFactor * 1, scaleFactor * 1);
          
          // Set rotation order
          signDummy.rotation.order = 'XYZ';
          
          // Maintain upright rotation
          signDummy.rotation.x = 0; // No rotation to match initial setup
          
          signDummy.rotation.z = 0;
          
          signDummy.updateMatrix();
          signs.setMatrixAt(i, signDummy.matrix);
        }
        signs.instanceMatrix.needsUpdate = true;
      };
      
      // Add sign animation to material shaders
      materialShaders.push({ update: animateSigns });
      
      scene.add(signs);
    },
    (progress) => {
    },
    (error) => {
      console.error('[CRITICAL] Road sign model failed after all retries:', error);
      setModelsLoadState(prev => ({ ...prev, sign: 'error' }));
    }, 'sign');

    // Load Synthwave Sun model with retry
    const sunPath = '/models/synthSunset.glb';
    loadModelWithRetry(sunPath, (gltf) => {
      const sun = gltf.scene;
      
      // Mark sun model as loaded
      setModelsLoadState(prev => ({ ...prev, sun: 'loaded' }));
      
      // Position and scale the sun
      sun.position.set(190, -110, 100);
      sun.scale.set(250, 250, 250);
      
      // Preserve original materials but make them emissive and unaffected by fog
      sun.traverse((child) => {
        if (child.isMesh) {
          child.material = child.material.clone();
          child.material.fog = false;
          child.material.transparent = true;
          child.material.side = THREE.DoubleSide;
        }
      });
      
      scene.add(sun);

      // A distant skyline sits in front of the lower sun, behind the road scenery.
      // Optional scenery loads separately so it cannot advance the required-model gate.
      loader.load('/models/skyline.glb', ({ scene: skyline }) => {
        if (disposed) {
          skyline.traverse(child => {
            child.geometry?.dispose();
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.filter(Boolean).forEach(material => { material.map?.dispose(); material.dispose(); });
          });
          return;
        }
        skyline.name = 'DistantSynthSkyline';
        const skylineMaterials = [];
        skyline.updateMatrixWorld(true);
        const sourceBounds = new THREE.Box3().setFromObject(skyline, true);
        const sourceSize = sourceBounds.getSize(new THREE.Vector3());
        skyline.scale.multiplyScalar(600 / Math.max(sourceSize.x, 0.001));
        skyline.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(skyline, true);
        const center = bounds.getCenter(new THREE.Vector3());
        skyline.position.add(new THREE.Vector3(-30 - center.x, -12 - bounds.min.y, -760 - center.z));
        skyline.traverse(child => {
          if (!child.isMesh) return;
          const silhouette = source => {
            const material = new THREE.MeshBasicMaterial({
              map: source.map, color: 0x86778f, alphaTest: 0.08,
              transparent: true, opacity: 0, depthWrite: false,
              side: THREE.DoubleSide, fog: false, toneMapped: false,
            });
            skylineMaterials.push(material);
            source.dispose();
            return material;
          };
          child.material = Array.isArray(child.material) ? child.material.map(silhouette) : silhouette(child.material);
          child.castShadow = false;
          child.receiveShadow = false;
        });
        const updateSkyline = () => {
          // Hide the cutout base from the high opening angle; reveal near road level.
          const visibility = 1 - THREE.MathUtils.smoothstep(camera.position.y, 1.8, 3.5);
          skyline.visible = visibility > 0.001;
          skylineMaterials.forEach(material => { material.opacity = visibility; });
        };
        updateSkyline();
        materialShaders.push({ update: updateSkyline });
        scene.add(skyline);
      }, undefined, error => console.warn('Optional skyline could not load:', error));

    }, 
    (progress) => {
    },
    (error) => {
      console.error('[CRITICAL] Sun model failed after all retries:', error);
      setModelsLoadState(prev => ({ ...prev, sun: 'error' }));
    }, 'sun');
    
    // Keep animation placement separate from the imported rig hierarchy.
    loadModelWithRetry(LOW_RIDER_MODEL_URL, (gltf) => {
      if (disposed) return;
      lowRider = createLowRider(gltf, { roadSpeed: speed / 2 });
      const carScene = lowRider.car;
      carScene.updateMatrixWorld(true);
      const tireEnvelope = new THREE.Box3();
      lowRider.wheels.forEach((wheel, index) => {
        const bounds = new THREE.Box3().setFromObject(wheel.pivot);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        tireEnvelope.union(bounds);
        planeMat.uniforms.tireContacts.value[index].set(
          center.x, center.z, Math.max(size.x * 0.9, 0.28), Math.max(size.z * 0.55, 0.36)
        );
      });
      if (!tireEnvelope.isEmpty()) {
        const center = tireEnvelope.getCenter(new THREE.Vector3());
        const size = tireEnvelope.getSize(new THREE.Vector3());
        planeMat.uniforms.chassisContact.value.set(center.x, center.z, size.x * 0.48, size.z * 0.52);
        planeMat.uniforms.contactShadowsReady.value = 1;
      }
      materialShaders.push({ update: (_time, delta) => lowRider?.update(delta) });

      const candyPaint = createCandyEmeraldPaint(renderer);
      carPaint = candyPaint;
      materialShaders.push({ update: () => candyPaint.update(camera) });
      carScene.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
        candyPaint.apply(child);
        // Skinned characters must remain visible throughout their animation.
        if (child.isSkinnedMesh) child.frustumCulled = false;
        if (/^(headlights|taillights)/i.test(child.name)) {
          // Keep Blender's emissive color/strength and include these meshes
          // in the scene's selective bloom pass.
          child.layers.enable(renderer.userData.BLOOM_LAYER);
        }
        if (child.name === 'Halo') {
          child.material = child.material.clone();
          child.material.emissive = new THREE.Color(0xaaff88);
          child.material.emissiveIntensity = 1;
          child.layers.enable(renderer.userData.BLOOM_LAYER);
        }
      });

      // Keep the illustrated experiment opt-in so normal visits match the original preview.
      if (new URLSearchParams(window.location.search).get('sceneStyle') === 'illustrated') {
        applyIllustratedStyle(carScene);
      }


      // A broad, feathered spotlight lifts the face from just above the viewer.
      // The frontal angle avoids the harsh grazing highlights of the earlier rig.
      const maryKey = new THREE.SpotLight(0xfff4e8, 0.32, 0.95, 0.48, 1, 2);
      maryKey.name = 'MaryPortraitKey';
      maryKey.position.set(2.45, 1.42, 24.78);
      maryKey.target.position.set(2.45, 1.31, 24.35);
      scene.add(maryKey, maryKey.target);

      // A transparent aura behind Mary adds atmosphere without lighting her surface.
      const statue = carScene.getObjectByName('statue');
      if (statue) {
        const bounds = new THREE.Box3().setFromObject(statue, true);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const auraMaterial = new THREE.ShaderMaterial({
          uniforms: { opacity: { value: 0 } },
          vertexShader: `varying vec2 vUv;
            void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
          fragmentShader: `varying vec2 vUv; uniform float opacity;
            void main() {
              float r = length((vUv - 0.5) * 2.0);
              float glow = exp(-4.0 * r * r) * (1.0 - smoothstep(0.65, 1.0, r));
              gl_FragColor = vec4(0.80, 0.85, 1.0, glow * opacity);
            }`,
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        const aura = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 2.1, size.y * 1.35), auraMaterial);
        aura.name = 'MarySoftAura';
        aura.layers.enable(renderer.userData.BLOOM_LAYER);
        scene.add(aura);
        const towardCamera = new THREE.Vector3();
        materialShaders.push({ update: () => {
          towardCamera.subVectors(camera.position, center).normalize();
          aura.position.copy(center).addScaledVector(towardCamera, -size.z * 0.8 - 0.015);
          aura.quaternion.copy(camera.quaternion);
          auraMaterial.uniforms.opacity.value = 0.18 * (1 - THREE.MathUtils.smoothstep(camera.position.distanceTo(center), 0.3, 2.0));
        } });
      }

      const heartCandles = carScene.getObjectByName('Heart3');
      const chaseTime = { value: 0 };
      if (heartCandles) {
        carScene.updateMatrixWorld(true);
        const candleBounds = new THREE.Box3().setFromObject(heartCandles, true);
        const chaseBounds = { value: new THREE.Vector2(candleBounds.min.x, Math.max(candleBounds.max.x - candleBounds.min.x, 0.00001)) };
        heartCandles.traverse(child => {
          if (!child.isMesh) return;
          const makeCandleGlow = source => {
            const material = source.clone();
            material.emissive = new THREE.Color(0x65ff87);
            material.emissiveIntensity = 1;
            const previousCompile = source.onBeforeCompile;
            const previousKey = source.customProgramCacheKey();
            material.onBeforeCompile = function(shader, renderer) {
              previousCompile.call(this, shader, renderer);
              shader.uniforms.heartChaseTime = chaseTime;
              shader.uniforms.heartChaseBounds = chaseBounds;
              shader.vertexShader = 'varying float vHeartChaseX;\n' + shader.vertexShader;
              shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
                vHeartChaseX = (modelMatrix * vec4(transformed, 1.0)).x;
                #include <project_vertex>
              `);
              shader.fragmentShader = 'varying float vHeartChaseX; uniform float heartChaseTime; uniform vec2 heartChaseBounds;\n' + shader.fragmentShader;
              shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
                #include <emissivemap_fragment>
                float across = (vHeartChaseX - heartChaseBounds.x) / heartChaseBounds.y;
                float head = fract(heartChaseTime / 3.0) * 1.5 - 0.25;
                float distanceToHead = (across - head) / 0.12;
                float chase = exp(-distanceToHead * distanceToHead);
                totalEmissiveRadiance *= 0.12 + 1.05 * chase;
              `);
            };
            material.customProgramCacheKey = () => `${previousKey}|heart-chase-v1`;
            return material;
          };
          child.material = Array.isArray(child.material) ? child.material.map(makeCandleGlow) : makeCandleGlow(child.material);
          child.layers.enable(renderer.userData.BLOOM_LAYER);
        });
        materialShaders.push({ update: (_time, delta) => {
          chaseTime.value += Math.min(Math.max(delta || 0, 0), 0.1);
        } });
      }

      // Update existing car spotlight target to point at the loaded car
      if (carSpotlightRef.current) {
        carSpotlightRef.current.target = carScene;
        scene.add(carSpotlightRef.current.target); // Add target to scene
      }
      
      // Update car accent light to follow the car if needed
      if (carAccentLightRef.current) {
        carAccentLightRef.current.target = carScene;
        scene.add(carAccentLightRef.current.target);
      }
      
      // Add underglow effect
      const underglowLight = new THREE.PointLight(
        lightSettings.underglow.color,
        lightSettings.underglow.intensity,
        lightSettings.underglow.distance
      );
      // Place the light beneath the actual new chassis in car-local space.
      const underglowCenter = tireEnvelope.getCenter(new THREE.Vector3());
      underglowCenter.y = 0.16;
      underglowLight.position.copy(carScene.worldToLocal(underglowCenter));
      underglowLight.color.set('#9b35ff');
      underglowLightRef.current = underglowLight;
      carScene.add(underglowLight);
      
      // Add headlights
      const headlightLeft = new THREE.SpotLight(
        lightSettings.headlights.color,
        lightSettings.headlights.intensity,
        lightSettings.headlights.distance,
        lightSettings.headlights.angle,
        lightSettings.headlights.penumbra
      );
      headlightLeft.position.set(-0.5, 0.5, 1);
      headlightLeft.target.position.set(-0.5, 0, 10);
      headlightLeftRef.current = headlightLeft;
      carScene.add(headlightLeft);
      carScene.add(headlightLeft.target);
      
      const headlightRight = new THREE.SpotLight(
        lightSettings.headlights.color,
        lightSettings.headlights.intensity,
        lightSettings.headlights.distance,
        lightSettings.headlights.angle,
        lightSettings.headlights.penumbra
      );
      headlightRight.position.set(0.5, 0.5, 1);
      headlightRight.target.position.set(0.5, 0, 10);
      headlightRightRef.current = headlightRight;
      carScene.add(headlightRight);
      carScene.add(headlightRight.target);
      
      scene.add(carScene);
      carModelRef.current = carScene; // Save reference for potential scroll-based animations
      
      setModelsLoadState(prev => ({ ...prev, car: 'loaded' }));
      startCameraSequence?.();

    }, 
    // Progress callback (optional)
    (progress) => {
    },
    // Error callback (only called after all retries fail)
    (error) => {
      console.error('[CRITICAL] Car model failed after all retries:', error);
      setModelsLoadState(prev => ({ ...prev, car: 'error' }));
    }, 'car');
    

    materialShadersRef.current = materialShaders;

    
    
    // Track if component is in view
    let isInView = false;
    
    // Use intersection observer just to detect if component is in view
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -20% 0px', // Only trigger when component is in the middle 60% of viewport
      threshold: 0.5
    };
    
    const handleIntersection = (entries) => {
      entries.forEach(entry => {
        const rect = entry.boundingClientRect;
        const viewportHeight = window.innerHeight;
        
        // Only activate when component is well-centered in viewport
        const componentCenter = rect.top + rect.height / 2;
        const viewportCenter = viewportHeight / 2;
        const distanceFromCenter = Math.abs(componentCenter - viewportCenter);
        
        // Activate only when component center is within 30% of viewport center
        isInView = entry.isIntersecting && (distanceFromCenter < viewportHeight * 0.3);
      });
    };
    
    const observer = new IntersectionObserver(handleIntersection, observerOptions);
    
    // Also trigger Mary glow effect
    setMaryGlowing(true);
    maryGlowingRef.current = true;
    
    // Simple scroll-based camera animation using GSAP ScrollTrigger
    // Create a virtual scroll container for smooth animation
    const setupScrollAnimation = () => {

      
      if (!cameraRef.current || !controlsRef.current) {
        setTimeout(setupScrollAnimation, 500);
        return;
      }
      
      // Kill any existing ScrollTriggers first
      ScrollTrigger.getAll().forEach(t => t.kill());
      
      // Reset to initial state - ensure we're at the start
      window.scrollTo(0, 0);
      scrollProgressRef.current = 0;
      setCurrentCameraStage(0);
      setTitleMoment('opening');
      setHasScrolled(false);
      hasScrolledRef.current = false;
      
      // Detect if device is mobile (phone, not tablet)
      const isMobile = (() => {
        const userAgent = navigator.userAgent.toLowerCase();
        const isIPhone = /iphone/i.test(userAgent);
        const isAndroid = /android/i.test(userAgent) && /mobile/i.test(userAgent);
        const hasSmallScreen = window.innerWidth < 600 || window.innerHeight < 600;
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        return (isIPhone || isAndroid) && hasSmallScreen && hasTouch;
      })();
      
      
      // Shared captures prevent mobile and desktop tours from drifting apart.
      const initialPos = sampleResponsiveCamera(0, camera.aspect);
      const initialTarget = { x: initialPos.targetX, y: initialPos.targetY, z: initialPos.targetZ };

      const initialFov = initialPos.fov;
      
      cameraRef.current.position.set(initialPos.x, initialPos.y, initialPos.z);
      cameraRef.current.lookAt(initialTarget.x, initialTarget.y, initialTarget.z);
      cameraRef.current.fov = initialFov;
      cameraRef.current.updateProjectionMatrix();
      
      if (controlsRef.current) {
        controlsRef.current.target.set(initialTarget.x, initialTarget.y, initialTarget.z);
      }
      
      // Create a simple timeline for camera movement
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        paused: true // Ensure timeline doesn't auto-play
      });
      scrollTimelineRef.current = tl;
      
      // Mary is a small dashboard assembly centered near (2.45, 1.29, 24.35).
      // Approach from above the open cabin, then look forward from behind her.
      // Share the final pose with onComplete so Skip Intro lands on the same shot.
      const maryShot = sampleResponsiveCamera(1, camera.aspect);

      // Define camera path from aerial to the dashboard statue
      const cameraPath = {
        // Starting values (aerial view) - must match initialPos/Target above
        x: initialPos.x,
        y: initialPos.y,
        z: initialPos.z,
        targetX: initialTarget.x,
        targetY: initialTarget.y,
        targetZ: initialTarget.z,
        fov: initialFov
      };
      
      const desktopSweep = { progress: 0 };

      // Both touch scrolling and desktop autoplay follow the same smooth sweep.
      tl.to(desktopSweep, { progress: 1, duration: 1, ease: "none" });

      // Single onUpdate for the entire timeline
      tl.eventCallback("onUpdate", () => {
        setTitleMoment(desktopSweep.progress >= 0.985 ? 'final' : desktopSweep.progress < 0.22 ? 'opening' : 'hidden');
        sampleResponsiveCamera(desktopSweep.progress, camera.aspect, cameraPath);
        if (camera) {
          // Always update camera during scroll animation, regardless of controls state
          camera.position.set(cameraPath.x, cameraPath.y, cameraPath.z);
          camera.lookAt(cameraPath.targetX, cameraPath.targetY, cameraPath.targetZ);
          camera.fov = cameraPath.fov;
          camera.updateProjectionMatrix();
          
          // Also update the ref for consistency
          if (cameraRef.current && cameraRef.current !== camera) {

            cameraRef.current.position.copy(camera.position);
            cameraRef.current.fov = camera.fov;
            cameraRef.current.updateProjectionMatrix();
          }
          
          if (controlsRef.current) {
            // Keep controls disabled during scroll animation
            controlsRef.current.enabled = false;
            controlsRef.current.target.set(cameraPath.targetX, cameraPath.targetY, cameraPath.targetZ);
            // Don't call update() during animation to prevent interference
            // controlsRef.current.update();
          }
        }
      });
      
      // Add completion callback to ensure final position is set
      tl.eventCallback("onComplete", () => {

        if (camera) {
          const finalPos = maryShot;
          const finalTarget = { x: maryShot.targetX, y: maryShot.targetY, z: maryShot.targetZ };
          const finalFov = maryShot.fov;

          camera.position.set(finalPos.x, finalPos.y, finalPos.z);
          camera.lookAt(finalTarget.x, finalTarget.y, finalTarget.z);
          camera.fov = finalFov;
          camera.updateProjectionMatrix();
          
          if (controlsRef.current) {
            controlsRef.current.target.set(finalTarget.x, finalTarget.y, finalTarget.z);
            // Don't call update() here as controls should stay disabled
          }
        }
        
        // Show the "Take me there" button after a short delay
        setTimeout(() => {

          setShowEnterButton(true);
        }, 1500); // 1.5 second delay after reaching the final view
      });
      
      // Create ScrollTrigger - track the document scroll with touch support
      const st = ScrollTrigger.create({
        trigger: "#scroll-container",
        start: "top top",
        end: "bottom bottom",
        scrub: isMobile ? 0.3 : 0.5, // Lower scrub for more responsive mobile animation
        animation: tl,
        markers: false, // Hide markers for cleaner view
        immediateRender: false, // Don't jump to end
        normalizeScroll: isMobile ? true : false, // Enable for mobile to handle touch properly
        anticipatePin: 0, // Reduce this to see if it helps
        preventOverlaps: true, // Prevent scroll conflicts
        fastScrollEnd: false, // Disable for better touch response
        ignoreMobileResize: true, // Ignore resize events on mobile
        onUpdate: (self) => {
          // If user already skipped, don't let scroll events reset the animation
          if (animationSkippedRef.current) return;

          scrollProgressRef.current = self.progress;
          
          // Mark that user has scrolled if progress > 0
          if (self.progress > 0 && !hasScrolledRef.current) {
            hasScrolledRef.current = true;
            setHasScrolled(true);
          }
          
          // Update camera stage based on progress for text changes
          let stage = 0;
          // Use the same stage calculation for both mobile and desktop
          if (self.progress < 0.2) stage = 0;        // Initial to first waypoint
          else if (self.progress < 0.4) stage = 1;   // First to second waypoint
          else if (self.progress < 0.6) stage = 2;   // Second to third waypoint
          else if (self.progress < 0.8) stage = 3;   // Third to fourth waypoint
          else stage = 4;                             // Fourth to final waypoint (80% and above)
          
          setCurrentCameraStage(stage);
          

          
          // Show button when we reach final stage on mobile
          if (isMobile && stage === 4 && !window.mobileButtonTriggered) {
            window.mobileButtonTriggered = true;
            setTimeout(() => {
              setShowEnterButton(true);
            }, 1500);
          }
          
          // Show button when we're very close to the end (desktop)
          if (!isMobile && self.progress >= 0.95 && !window.buttonTriggered) {
            window.buttonTriggered = true;
            setTimeout(() => {
              setShowEnterButton(true);
            }, 1500);
          }
          
          // Additional fallback: Check if animation is nearly complete (99% or higher)
          if (self.progress >= 0.99 && !window.completeButtonTriggered) {
            window.completeButtonTriggered = true;
            setTimeout(() => {

              setShowEnterButton(true);
            }, 1500);
          }
          
          // Secondary fallback for high progress
          if (self.progress >= 0.95 && !window.highProgressTriggered) {
            window.highProgressTriggered = true;
            setTimeout(() => {
              setShowEnterButton(true);
            }, 1500);
          }
        }
      });

      scrollTriggerRef.current = st;

      // Log the first few timeline tweens to verify they exist
      const children = tl.getChildren();
      if (children.length > 0) {
      }
      
      // Force timeline to start at beginning
      tl.progress(0);
      tl.pause();
      
      // Force camera back to initial position after ScrollTrigger creation
      cameraRef.current.position.set(initialPos.x, initialPos.y, initialPos.z);
      cameraRef.current.lookAt(initialTarget.x, initialTarget.y, initialTarget.z);
      cameraRef.current.fov = initialFov;
      cameraRef.current.updateProjectionMatrix();
      
      // Force refresh to ensure proper initialization
      st.refresh();
      ScrollTrigger.refresh();

      if (cameraHelperEnabled) {
        cameraHelper?.dispose();
        cameraHelper = createPalmTreeDriveCameraHelper({
          camera, controls: controlsRef.current, canvas: renderer.domElement,
          timeline: tl, trigger: st, setStage: setCurrentCameraStage,
          freezeTour: () => {
            clearTimeout(autoPlayTimeoutRef.current);
            autoPlayTimeoutRef.current = null;
            autoPlayTweenRef.current?.kill();
            autoPlayTweenRef.current = null;
          },
        });
        return;
      }

      // --- Hybrid auto-play: desktop only, if user doesn't scroll within 4s, drive timeline directly ---
      if (isMobile) return;
      const cancelAutoPlay = autoPlayCancelRef.current = () => {
        if (autoPlayTimeoutRef.current) {
          clearTimeout(autoPlayTimeoutRef.current);
          autoPlayTimeoutRef.current = null;
        }
        if (autoPlayTweenRef.current) {
          autoPlayTweenRef.current.kill();
          autoPlayTweenRef.current = null;
        }
        // Re-enable ScrollTrigger so user can scroll manually from current position
        if (scrollTriggerRef.current && scrollTimelineRef.current) {
          // Sync scroll position to match current timeline progress
          const scrollContainer = document.getElementById('scroll-container');
          if (scrollContainer) {
            const maxScroll = scrollContainer.offsetHeight - window.innerHeight;
            const currentProgress = scrollTimelineRef.current.progress();
            window.scrollTo(0, currentProgress * maxScroll);
          }
          // Delay re-enable so browser settles scroll position first
          setTimeout(() => {
            if (scrollTriggerRef.current) {
              scrollTriggerRef.current.enable();
              ScrollTrigger.refresh();
            }
          }, 100);
        }
        // Remove the cancel listeners once cancelled
        window.removeEventListener('wheel', cancelAutoPlay);
        window.removeEventListener('touchstart', cancelAutoPlay);
        window.removeEventListener('keydown', cancelAutoPlayOnKey);
      };

      const cancelAutoPlayOnKey = (e) => {
        // Only cancel on navigation keys (arrows, space, page up/down)
        if (['ArrowDown', 'ArrowUp', 'Space', 'PageDown', 'PageUp', ' '].includes(e.key)) {
          cancelAutoPlay();
        }
      };

      // Listen for user interaction to cancel auto-play
      window.addEventListener('wheel', cancelAutoPlay, { passive: true });
      window.addEventListener('touchstart', cancelAutoPlay, { passive: true });
      window.addEventListener('keydown', cancelAutoPlayOnKey, { passive: true });

      autoPlayTimeoutRef.current = setTimeout(() => {
        // Only auto-play if user hasn't scrolled yet
        if (hasScrolledRef.current || animationSkippedRef.current) {
          cancelAutoPlay();
          return;
        }

        // Disable ScrollTrigger so it doesn't fight with direct timeline control
        if (scrollTriggerRef.current) {
          scrollTriggerRef.current.disable();
        }

        // Drive the timeline directly — no scroll middleman, buttery smooth
        autoPlayTweenRef.current = gsap.to(tl, {
          progress: 1,
          duration: isMobile ? 30 : DESKTOP_CAMERA_SECONDS,
          ease: "none",
          onUpdate: () => {
            const p = tl.progress();
            scrollProgressRef.current = p;

            // Mark as scrolled to hide hint
            if (p > 0 && !hasScrolledRef.current) {
              hasScrolledRef.current = true;
              setHasScrolled(true);
            }

            // Stage detection (same logic as ScrollTrigger onUpdate)
            let stage = 0;
            if (p < 0.2) stage = 0;
            else if (p < 0.4) stage = 1;
            else if (p < 0.6) stage = 2;
            else if (p < 0.8) stage = 3;
            else stage = 4;
            setCurrentCameraStage(stage);

            // Trigger enter button at final stage
            if (stage === 4 && !window.autoPlayButtonTriggered) {
              window.autoPlayButtonTriggered = true;
              setTimeout(() => setShowEnterButton(true), 1500);
            }
          },
          onComplete: () => {
            autoPlayTweenRef.current = null;
            // Animation complete — user is at final stage with CTA visible.
            // Don't re-enable ScrollTrigger to avoid it snapping the timeline back.
            // Clean up listeners
            window.removeEventListener('wheel', cancelAutoPlay);
            window.removeEventListener('touchstart', cancelAutoPlay);
            window.removeEventListener('keydown', cancelAutoPlayOnKey);
          }
        });
      }, 5000); // Allow the mask reveal and opening title to settle before the sweep.
    };

    // Both initial setup and the car loader call this. Start only once the
    // car has actually been attached, rather than racing a fixed timeout.
    startCameraSequence = () => {
      if (disposed || !lowRider || resolvedModelNames.size < 4 || cameraSequenceStarted) return;
      cameraSequenceStarted = true;
      // Enable ScrollTrigger for mobile with better touch handling
      ScrollTrigger.config({
        ignoreMobileResize: true,
        autoRefreshEvents: "visibilitychange,DOMContentLoaded,load,resize",
        // Force ScrollTrigger to recognize touch events
        touch: true, // Enable touch-scrolling (use boolean true)
        syncInterval: 20, // Sync more frequently for smoother updates
        force3D: true, // Force hardware acceleration
        limitCallbacks: true // Optimize performance
      });
      
      // Ensure the page is scrollable on mobile
      if (isMobile) {
        // Configure body and html for proper touch scrolling
        document.body.style.overscrollBehavior = 'auto';
        document.documentElement.style.overscrollBehavior = 'auto';
        document.body.style.touchAction = 'manipulation'; // Better than pan-y for general touch
        document.body.style.webkitOverflowScrolling = 'touch';
        document.body.style.overflow = 'auto';
        document.body.style.height = 'auto';
        document.body.style.position = 'relative';
        
        // Also configure HTML element
        document.documentElement.style.overflow = 'auto';
        document.documentElement.style.height = 'auto';
        document.documentElement.style.touchAction = 'manipulation';
        
        // Ensure the scroll container is touch-enabled
        const scrollContainer = document.getElementById('scroll-container');
        if (scrollContainer) {
          scrollContainer.style.webkitOverflowScrolling = 'touch';
          scrollContainer.style.touchAction = 'manipulation';
        }
      }
      
      setupScrollAnimation();
    };
    startCameraSequence();
    

    
    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      // Get delta time once per frame
      const delta = clockRef.current.getDelta();
      const time = clockRef.current.getElapsedTime();
      
      materialShadersRef.current.forEach(m => {
        if (m.uniforms && m.uniforms.time) {
          m.uniforms.time.value = time;
        } else if (m.material && m.material.uniforms && m.material.uniforms.time) {
          // Handle ShaderMaterial
          m.material.uniforms.time.value = time;
        } else if (m.isShaderMaterial && m.uniforms && m.uniforms.time) {
          // Direct ShaderMaterial
          m.uniforms.time.value = time;
        } else if (m.update) {
          // Handle custom update functions (like animations)
          m.update(time, delta);
        }
      });
      
      // Scroll camera animation
      
      // Handle scroll-based camera movement
      if (cameraHelper?.isEditing) {
        controls.update();
      } else if (scrollCameraEnabledRef.current) {
        // Scroll camera is enabled - this handles the camera movement
        // The actual camera updates happen in the handleScroll function
      } else {
        // Only update controls if scroll camera is NOT enabled
        // Dynamic maxPolarAngle based on camera distance
        // Calculate current distance from camera to target
        const cameraDistance = camera.position.distanceTo(controls.target);
        
        // Adjust maxPolarAngle based on distance
        // When close (distance < 5), allow lower angles for dashboard view
        // When far (distance > 20), restrict to prevent seeing below road
        if (cameraDistance < 5) {
          // Very close - allow almost horizontal view for dashboard
          controls.maxPolarAngle = Math.PI * 0.55; // ~153 degrees
        } else if (cameraDistance < 10) {
          // Medium distance - moderate restriction
          controls.maxPolarAngle = Math.PI * 0.55; // ~117 degrees
        } else {
          // Far distance - restrict to prevent seeing below road
          controls.maxPolarAngle = Math.PI * 0.45; // ~81 degrees
        }
        
        // Only update orbit controls if they're enabled (not during scroll animation)
        if (controls.enabled) {
          controls.update();
        }
      }
      
      // Render with selective bloom
      if (renderer.userData.bloomComposer && renderer.userData.finalComposer) {
        // 1. Darken non-bloom objects, hide background+fog for bloom pass
        const savedBackground = scene.background;
        const savedFog = scene.fog;
        scene.background = null;
        scene.fog = null;
        scene.traverse(renderer.userData.darkenNonBloomed);
        renderer.userData.bloomComposer.render();
        // 2. Restore materials, background, and fog, render final composite
        scene.traverse(renderer.userData.restoreMaterials);
        scene.background = savedBackground;
        scene.fog = savedFog;
        renderer.userData.finalComposer.render();
      } else {
        renderer.render(scene, camera);
      }
    };

    // Handle resize
    const handleResize = () => {
      if (mountRef.current && rendererRef.current) {
        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        rendererRef.current.setSize(width, height, false);
        if (bloomComposerRef.current) bloomComposerRef.current.setSize(width, height);
        if (composerRef.current) composerRef.current.setSize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Call resize initially to ensure proper sizing
    
    // Handle mouse move for hover effect
    const handleMouseMove = (event) => {
      if (cameraHelperEnabled) return;
      
      const rect = mountRef.current.getBoundingClientRect();
      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Update raycaster
      raycaster.current.setFromCamera(mouse.current, camera);
      
      // Check for intersection with Mary
      if (maryMeshRef.current) {
        const intersects = raycaster.current.intersectObject(maryMeshRef.current, true);
        
        if (intersects.length > 0) {
          mountRef.current.style.cursor = 'pointer';
          // Increase glow intensity on hover
          if (maryLightRef.current) {
            gsap.to(maryLightRef.current, {
              intensity: 3,
              duration: 0.3
            });
          }
          if (maryMeshRef.current.material) {
            gsap.to(maryMeshRef.current.material, {
              emissiveIntensity: 2.5,
              duration: 0.3
            });
          }
        } else {
          mountRef.current.style.cursor = 'default';
          // Return to normal glow
          if (maryLightRef.current) {
            gsap.to(maryLightRef.current, {
              intensity: 3,
              duration: 0.3
            });
          }
          if (maryMeshRef.current.material) {
            gsap.to(maryMeshRef.current.material, {
              emissiveIntensity: 1.5,
              duration: 0.3
            });
          }
        }
      }
    };
    
    // Handle click on Mary
    const handleClick = (event) => {
      if (cameraHelperEnabled) return;
      // Don't handle 3D clicks when Buy modal is open
      if (showBuyModal) return;
      
      if (!maryGlowingRef.current || !mountRef.current) return;
      
      const rect = mountRef.current.getBoundingClientRect();
      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Update raycaster
      raycaster.current.setFromCamera(mouse.current, camera);
      
      // Check for intersection with Mary or the entire car (as fallback)
      if (maryMeshRef.current) {
        const intersects = raycaster.current.intersectObject(maryMeshRef.current, true);
        
        if (intersects.length > 0) {
          const isMobile = detectMobileDevice();
          const destination = isMobile ? '/about' : '/arcade';
          
          // Add fade out transition before navigating
          gsap.to(mountRef.current, {
            opacity: 0,
            duration: 1.5,
            ease: "power2.inOut",
            onComplete: () => {
              router.push(destination);
            }
          });
          return;
        }
      }
      
      // Fallback: check intersection with entire car model
      if (carModelRef.current) {
        const carIntersects = raycaster.current.intersectObject(carModelRef.current, true);
        
        // Check if any of the intersected objects is near Mary's position
        if (carIntersects.length > 0) {
          const maryPos = new THREE.Vector3(1.1811263369229998, 0.9999999999999805, 12.355272021071679);
          for (const intersect of carIntersects) {
            const distance = intersect.point.distanceTo(maryPos);
            if (distance < 2) { // Within 2 units of Mary's position
              const isMobile = detectMobileDevice();
              const destination = isMobile ? '/about' : '/arcade';

              // Add fade out transition before navigating
              gsap.to(mountRef.current, {
                opacity: 0,
                duration: 1.5,
                ease: "power2.inOut",
                onComplete: () => {
                  router.push(destination);
                }
              });
              return;
            }
          }
        }
      }
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);
    animate();

    // Cleanup
    return () => {
      disposed = true;
      lowRider?.dispose();
      lowRider = null;
      carModelRef.current = null;
      cameraHelper?.dispose();
      retryTimers.forEach(clearTimeout);
      retryTimers.clear();
      dracoLoader.dispose();
      
      // Cancel animation frame to stop the animation loop
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Kill auto-play tween, timeout, and event listeners
      if (autoPlayCancelRef.current) {
        autoPlayCancelRef.current();
        autoPlayCancelRef.current = null;
      }

      // Kill all ScrollTriggers
      ScrollTrigger.getAll().forEach(t => t.kill());
      
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      // window.removeEventListener('keydown', handleKeyPress);

      // Kill GSAP timeline
      if (cinematicTimelineRef.current) {
        cinematicTimelineRef.current.kill();
      }
      
      // Clean up Mary's light
      if (maryLightRef.current && sceneRef.current) {
        sceneRef.current.remove(maryLightRef.current);
        maryLightRef.current.dispose();
      }
      
      if (intersectionRef.current) {
        observer.unobserve(intersectionRef.current);
      }
      observer.disconnect();
      
      // Check if renderer exists before cleanup
      if (rendererRef.current && mountRef.current) {
        if (rendererRef.current.domElement && rendererRef.current.domElement.parentNode === mountRef.current) {
          mountRef.current.removeChild(rendererRef.current.domElement);
        }
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      if (bloomComposerRef.current) {
        bloomComposerRef.current.dispose();
        bloomComposerRef.current = null;
      }
      if (composerRef.current) {
        composerRef.current.dispose();
        composerRef.current = null;
      }
      
      carPaint?.dispose();

      // Dispose of scene objects
      if (sceneRef.current) {
        sceneRef.current.traverse((object) => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(mat => mat.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
        sceneRef.current.clear();
      }
      
      // Dispose controls if they exist
      if (controlsRef.current) {
        controlsRef.current.dispose();
        controlsRef.current = null;
      }
      
      // Clear refs
      sceneRef.current = null;
      rendererRef.current = null;
      clockRef.current = null;
      materialShadersRef.current = [];
    };
  }, []);


  return (
    <div ref={intersectionRef} style={{ position: 'relative', width: '100%', minHeight: '100vh', backgroundColor: 'black' }}>
      <style jsx global>{`
        @font-face {
          font-family: 'UnifrakturMaguntia';
          src: url('/fonts/UnifrakturMaguntia-Regular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        
        @keyframes simpleFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        .scroll-text-line {
          display: inline-block;
          transition: all 0.3s ease;
        }
        .scroll-text-line:hover {
          color: #67e8f9;
          text-shadow: 0 0 30px #67e8f9;
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 0.5;
          }
          50% {
            opacity: 0.8;
          }
        }
        @keyframes scrollBounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
      `}</style>
      {/* Fixed viewport for Three.js scene */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100vh',
        backgroundColor: 'black',
        pointerEvents: 'none', // Allow touch events to pass through to scroll container
        touchAction: 'none' // Disable default touch behavior on this layer
      }}>
        
        {/* Three.js scene container */}
        <div style={{ 
          position: 'absolute', 
          width: '100%', 
          height: '100%', 
          overflow: 'hidden', 
          backgroundColor: 'black',
          opacity: isSceneLoading ? 0 : 1,
          transition: 'opacity 0.5s ease-in-out',
          pointerEvents: 'none' // Pass through touch events
        }}>
          
        
        <div 
          ref={mountRef} 
          style={{ 
            width: '100%', 
            height: '100%', 
            position: 'absolute', 
            top: 0, 
            left: 0,
            pointerEvents: 'none',  // Pass through touch events
            zIndex: 1
          }}
        />
        

        

      </div>

      {!isSceneLoading && scrollCameraActive && <DriveTitles moment={introDone ? titleMoment : 'hidden'} />}

      {/* Scroll Camera Indicator removed for production */}
      </div>

      {!isSceneLoading && !introDone && <RL80SceneIntro onComplete={finishIntro} />}

      {/* Progress dots and scroll hint - fixed position, separate from text container */}
      {!isSceneLoading && scrollCameraActive && (
        <div
          style={{
            position: 'fixed',
            bottom: isMobile ? '80px' : '50px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            zIndex: 1000,
            pointerEvents: 'none',
            visibility: (currentCameraStage === 4 && shouldMorph) ? 'hidden' : 'visible',
          }}>
          {/* Scroll hint - animated chevrons */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0px',
            opacity: hasScrolled ? 0 : 0.7,
            transition: 'opacity 0.5s ease',
            animation: hasScrolled ? 'none' : 'scrollBounce 1.5s ease-in-out infinite',
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderLeft: '2px solid #01ff00',
              borderBottom: '2px solid #01ff00',
              transform: 'rotate(135deg)',
            }} />
            <div style={{
              width: '24px',
              height: '24px',
              borderLeft: '2px solid #01ff00',
              borderBottom: '2px solid #01ff00',
              transform: 'rotate(135deg)',
              marginTop: '-10px',
              opacity: 0.5,
            }} />
          </div>

          <div
            className="progress-dots"
            style={{
              display: 'flex',
              gap: '8px',
              justifyContent: 'center',
            }}>
            {[0, 1, 2, 3, 4].map((index) => (
              <div
                key={index}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  opacity: index === currentCameraStage ? 1 : 0.3,
                  transition: 'all 0.3s ease',
                  boxShadow: index === currentCameraStage ? '0 0 10px rgba(255, 255, 255, 0.8)' : 'none',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Skip Animation Button - bottom right - Outside pointer-events:none container */}
      {currentCameraStage < 4 && (
        <button
          onClick={skipAnimation}
          style={{
            position: 'fixed',
            bottom: isMobile ? '60px' : '30px',
            right: '30px',
            backgroundColor: 'transparent',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            color: 'white',
            padding: '10px 20px',
            fontSize: '14px',
            fontFamily: 'monospace',
            cursor: 'pointer',
            borderRadius: '4px',
            transition: 'all 0.3s ease',
            opacity: 0.8,
            zIndex: 1,
            backdropFilter: 'blur(5px)',
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.8)';
            e.target.style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = 'transparent';
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
            e.target.style.opacity = '0.8';
          }}
        >
          {isMobile ? t('palmTreeDrive.skip') : t('palmTreeDrive.skipIntro')}
        </button>
      )}
      
      {/* Scroll spacer to enable scrolling - outside fixed viewport */}
      <div 
        id="scroll-container" 
        style={{ 
          height: isMobile ? '800vh' : '400vh', // Even more height on mobile to ensure reaching the end
          position: 'relative',
          width: '100%',
          backgroundColor: 'transparent', // Make it transparent but present
          WebkitOverflowScrolling: 'touch', // Enable momentum scrolling on iOS
          touchAction: 'pan-y', // Allow vertical scrolling on touch
          overscrollBehavior: 'none' // Prevent overscroll bounce on mobile
        }} 
      />
      
      {currentCameraStage === 4 && shouldMorph && (
        <DriveActions onBuy={() => setShowBuyModal(true)} onExplore={() => router.push('/')} />
      )}

      {/* CyberNav Menu */}
      <CyberNav
        isOpen={isCyberNavOpen}
        onClose={() => {
          setIsCyberNavOpen(false);
          // Re-enable ScrollTriggers when closing
          const triggers = ScrollTrigger.getAll();
          triggers.forEach(trigger => trigger.enable());
        }}
        showButton={false}
      />
      <BuyModal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)} />
    </div>
  );
};


export default PalmsScene;