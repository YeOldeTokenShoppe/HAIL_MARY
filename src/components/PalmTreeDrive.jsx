"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLanguage } from './LanguageProvider';
import { useRouter } from 'next/navigation';
// import SynthwaveText from './SynthwaveText';
import MorphingWebGLText from './MorphingWebGLText';
import WebGLStandaloneText from '@/components/WebGLStandaloneText';



// MusicPlayer3 removed - using global instance from _app.jsx

// Register GSAP ScrollTrigger plugin
gsap.registerPlugin(ScrollTrigger);




const PalmsScene = ({ onLoadingChange }) => {
  const { t } = useLanguage();
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
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
      t('palmTreeDrive.stage1.line2')
    ],
    [
      t('palmTreeDrive.stage2.line1'),
      t('palmTreeDrive.stage2.line2'),
      t('palmTreeDrive.stage2.line3')
    ],
    [
      t('palmTreeDrive.stage3.line1'),
      t('palmTreeDrive.stage3.line2')
    ],
    [
      t('palmTreeDrive.stage4.line1'),
      t('palmTreeDrive.stage4.line2'),
      t('palmTreeDrive.stage4.line3')
    ],
    [
      t('palmTreeDrive.stage5.line1'),
      t('palmTreeDrive.stage5.line2')
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
  const [currentCameraStage, setCurrentCameraStage] = useState(0); // Track which camera position we're at
  const [showEnterButton, setShowEnterButton] = useState(true); // Show "Take me there" button immediately
  const [hideLastText, setHideLastText] = useState(false); // Hide the last text block after delay
  const [shouldMorph, setShouldMorph] = useState(false); // Trigger morph animation
  // Music player states
  const [isMobile, setIsMobile] = useState(false);
  
  
  // Add refs for lights
  const carSpotlightRef = useRef(null);
  const rimLightRef = useRef(null);
  const underglowLightRef = useRef(null);
  const headlightLeftRef = useRef(null);
  const headlightRightRef = useRef(null);

  // Add ref for new light
  const carAccentLightRef = useRef(null);
  
  // GUI removed for production
  
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
      scrollProgressRef.current = 0;
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
  
  // Effect to trigger morph animation when reaching final stage
  useEffect(() => {
    if (currentCameraStage === 4 && !shouldMorph) {
      const timer = setTimeout(() => {
        setShouldMorph(true);
      }, 1500); // Trigger morph after 1.5 seconds at final stage
      
      return () => clearTimeout(timer);
    }
  }, [currentCameraStage, shouldMorph]);
  
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
      intensity: 5,
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

    // Create a fresh clock for this mount
    clockRef.current = new THREE.Clock();
    
    // Reset material shaders array
    materialShadersRef.current = [];
    
    // Fallback timer to ensure loading completes
    const loadingFallback = setTimeout(() => {
      if (isSceneLoadingInternal) {
        // console.log('Loading fallback triggered - forcing scene to show');
        setIsSceneLoading(false);
      }
    }, 8000); // 8 seconds fallback to match home

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
    
    // Start camera at aerial view position based on device type
    if (isMobileDevice) {
      camera.position.set(15.5605, 12.0910, 60.1540);  // Mobile aerial view - moved back and adjusted X
      camera.lookAt(3.0669, 6.0868, 20.1252);           // Mobile initial target
    } else {
      camera.position.set(16.2711, 5.8264, 40.5498);    // Desktop aerial view
      camera.lookAt(4.3726, 2.1681, 20.7525);           // Desktop initial target
    }
    camera.fov = 45;
    camera.updateProjectionMatrix();
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({ 
      antialias: !isMobileDevice, // Disable antialiasing on mobile for performance
      powerPreference: isMobileDevice ? "low-power" : "high-performance"
    });
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


    // Create sunset gradient background
    const gradientCanvas = document.createElement('canvas');
    gradientCanvas.width = 512;
    gradientCanvas.height = 512;
    const gradientCtx = gradientCanvas.getContext('2d');
    
    // Create sunset gradient - traditional orange sunset
    const gradient = gradientCtx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, '#001a33');      // Dark blue at top
    gradient.addColorStop(0.3, '#ff6b35');    // Orange
    gradient.addColorStop(0.6, '#ff8c42');    // Bright orange
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
    const ambientLight = new THREE.AmbientLight(0xffa07a, 0.6); // Light salmon color - increased for more even lighting
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
    // Set initial target to match the camera's lookAt position based on device
    if (isMobileDevice) {
      controls.target.set(3.0669, 6.0868, 20.1252); // Mobile initial target
    } else {
      controls.target.set(4.3726, 2.1681, 20.7525); // Desktop initial target
    }
    controls.zoomToCursor = true;
    controls.enabled = false; // Start with controls disabled since scroll camera is active
    // Don't call controls.update() here - it repositions the camera even when disabled
    controlsRef.current = controls; // Store ref for access in event handlers
    
    // Re-set camera position after OrbitControls creation to ensure it stays at aerial view
    if (isMobileDevice) {
      camera.position.set(15.5605, 12.0910, 60.1540);  // Mobile aerial view - moved back and adjusted X
      camera.lookAt(3.0669, 6.0868, 20.1252);           // Mobile initial target
    } else {
      camera.position.set(16.2711, 5.8264, 40.5498);    // Desktop aerial view
      camera.lookAt(4.3726, 2.1681, 20.7525);           // Desktop initial target
    }
    camera.updateProjectionMatrix();

    // Ground and road
    const planeGeom = new THREE.PlaneGeometry(100, 100, 200, 200);
    planeGeom.rotateX(-Math.PI * 0.5);
    
    // Create shader material
    const planeMat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        fogColor: { value: scene.fog.color },
        fogNear: { value: scene.fog.near },
        fogFar: { value: scene.fog.far }
      },
      vertexShader: `
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
        uniform float time;
        uniform vec3 fogColor;
        uniform float fogNear;
        uniform float fogFar;
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
      // Set error state to properly track failures
      if (url.includes('palm2')) setModelsLoadState(prev => ({ ...prev, palm: 'error' }));
      if (url.includes('sign2')) setModelsLoadState(prev => ({ ...prev, sign: 'error' }));
      if (url.includes('synthSunset')) setModelsLoadState(prev => ({ ...prev, sun: 'error' }));
      if (url.includes('lambo5k3')) setModelsLoadState(prev => ({ ...prev, car: 'error' }));
      
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
    dracoLoader.setDecoderConfig({ type: 'js' }); // Ensure JS decoder is used
    
    const loader = new GLTFLoader(loadingManager);
    loader.setDRACOLoader(dracoLoader);
    
    console.log('[PalmTreeDrive] Initialized loaders - DRACO path:', dracoPath);
    
    // Helper function to load models with retry logic
    const loadModelWithRetry = (path, onSuccess, onProgress, onError, modelName) => {
      const attemptKey = `${modelName}_${path}`;
      if (!retryCount[attemptKey]) {
        retryCount[attemptKey] = 0;
      }
      
      const attemptLoad = () => {
        console.log(`[PalmTreeDrive] Loading ${modelName} (attempt ${retryCount[attemptKey] + 1}/${maxRetries + 1})`);
        
        loader.load(
          path,
          onSuccess,
          onProgress,
          (error) => {
            retryCount[attemptKey]++;
            console.error(`[PalmTreeDrive] Error loading ${modelName} (attempt ${retryCount[attemptKey]}):`, error);
            
            if (retryCount[attemptKey] <= maxRetries) {
              console.log(`[PalmTreeDrive] Retrying ${modelName} in ${retryDelay}ms...`);
              setTimeout(attemptLoad, retryDelay);
            } else {
              console.error(`[PalmTreeDrive] Failed to load ${modelName} after ${maxRetries} retries`);
              onError(error);
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
      // console.log('[PalmTreeDrive] Palm model loaded');
      setModelsLoadState(prev => ({ ...prev, palm: 'loaded' }));
      

      
      // Find all meshes for debugging
      const allMeshes = [];
      palmModel.traverse((child) => {

        if (child.isMesh) {
          allMeshes.push(child);
        }
      });
      
      // console.log('Total meshes found:', allMeshes.length);
      
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
      
      // Set up instance positions
      const palmPositions = [];
      for (let i = 0; i < 5; i++) {
        palmPositions.push(-6.5, 0, i * 20 - 10 - 50);
        palmPositions.push(6.5, 0, i * 20 - 50);
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
      
      // console.log('Scale factor:', scaleFactor);
      
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
      
      // Store initial positions for animation
      const initialPositions = new Float32Array(palmPositions);
      
      // Animation function to update palm positions
      const animatePalms = (time) => {
        for (let i = 0; i < instanceCount; i++) {
          const baseX = initialPositions[i * 3];
          const baseY = initialPositions[i * 3 + 1];
          const baseZ = initialPositions[i * 3 + 2];
          
          // Animate position along Z axis
          const animatedZ = ((baseZ + time * speed + 50) % 100) - 50;
          
          // Scale based on distance with the base scale factor
          const distanceScale = 0.4 + smoothstep(50, 45, Math.abs(animatedZ)) * 0.6;
          const finalScale = scaleFactor * distanceScale;
          
          dummy.position.set(baseX, baseY, animatedZ);
          dummy.scale.set(finalScale, finalScale, finalScale);
          
          // Mirror palm trees on the left side
          if (baseX < 0) {
            dummy.scale.x = -finalScale;
          }
          
          // Keep rotation variation
          dummy.rotation.y = Math.PI * 2 * ((i * 0.618) % 1); // Golden ratio for varied rotation
          
          dummy.updateMatrix();
          palms.setMatrixAt(i, dummy.matrix);
        }
        palms.instanceMatrix.needsUpdate = true;
      };
      
      // Add animation update function to materialShaders
      materialShaders.push({ update: animatePalms });
      
      scene.add(palms);
    }, 
    (progress) => {
      // console.log('Loading palm tree:', (progress.loaded / progress.total * 100) + '%');
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
      // console.log('[PalmTreeDrive] Sign model loaded');
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
      // console.log('Loading road sign:', (progress.loaded / progress.total * 100) + '%');
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
      // console.log('[PalmTreeDrive] Sun model loaded');
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
    }, 
    (progress) => {
      // console.log('Loading sun:', (progress.loaded / progress.total * 100) + '%');
    },
    (error) => {
      console.error('[CRITICAL] Sun model failed after all retries:', error);
      setModelsLoadState(prev => ({ ...prev, sun: 'error' }));
    }, 'sun');
    
    // Load car model (now includes UFO) with retry
    const carPath = '/models/lambo5k3.glb';
    loadModelWithRetry(carPath, (gltf) => {
      const carScene = gltf.scene;
      
      setModelsLoadState(prev => ({ ...prev, car: 'loaded' }));
      const carParts = [];
      const unknownObjects = [];
      
      // Log all objects in the scene hierarchy
      carScene.traverse((child) => {
        const lowerName = child.name.toLowerCase();
        
        // Check if object name contains car-related keywords
        if (lowerName.includes('wheel') || 
            lowerName.includes('tire') || 
            lowerName.includes('rim') ||
            lowerName.includes('brake') ||
            lowerName.includes('suspension') ||
            lowerName.includes('axle')) {
          // console.log('Found car part:', child.name);
          carParts.push(child);
          // Ensure car parts are visible
          child.visible = true;
        }
        
        // Look for Mary specifically and ensure she's visible
        if (child.name.toLowerCase().includes('mary')) {
          // console.log('Found Mary object:', child);
          // Make sure Mary is visible
          child.visible = true;
          // If it's a mesh, ensure material is properly set
          if (child.isMesh) {
            // Store reference to Mary mesh
            maryMeshRef.current = child;
            
            // Clone the material to avoid affecting other meshes
            child.material = child.material.clone();
            child.material.transparent = true;
            child.material.opacity = 1;
            child.material.needsUpdate = true;
            
            // Store original emissive properties
            child.userData.originalEmissive = child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0x000000);
            child.userData.originalEmissiveIntensity = child.material.emissiveIntensity || 0;
          }
        }
      });
      
      if (unknownObjects.length > 0) {
        // console.log('Unknown objects that were kept visible:');
        unknownObjects.forEach(obj => {
          // console.log(`- ${obj.name} at position (${obj.position.x.toFixed(2)}, ${obj.position.y.toFixed(2)}, ${obj.position.z.toFixed(2)})`);
        });
      }
      
      // Position the car
      carScene.position.set(2.5, 0, 25.6);
      // Rotate 180 degrees so car faces away from camera (same direction we're looking)
      carScene.rotation.y = Math.PI;
      carScene.scale.set(2.7, 2.7, 2.7);
      
      // Set up animations
      const animationMixers = [];
      
      if (gltf.animations && gltf.animations.length > 0) {
        // console.log('Found animations:', gltf.animations.map(a => a.name));
        // console.log('Animation details:');
        gltf.animations.forEach(anim => {
          // console.log(`- ${anim.name}: duration=${anim.duration}s, tracks=${anim.tracks.length}`);
        });
        
        // Create mixer for the scene
        const mixer = new THREE.AnimationMixer(carScene);
        
        // Play ALL animations on a loop
        const actions = [];
        gltf.animations.forEach((clip, index) => {
          // console.log(`Setting up animation ${index}: ${clip.name}`);
          
          // Handle Armature/Mixamo character animations
          if (clip.name.toLowerCase().includes('armature') && 
              !clip.name.toLowerCase().includes('wheel') &&
              clip.name !== 'ArmatureAction.001') { // Don't skip UFO animation
            // console.log(`Setting character to rest pose: ${clip.name}`);
            const action = mixer.clipAction(clip);
            action.play();
            action.paused = true; // Play but immediately pause to hold the first frame
            action.time = 0; // Ensure we're at the first frame (rest pose)
            actions.push(action);
            return; // Skip further processing
          }
          
          const action = mixer.clipAction(clip);
          
          // Check if this is the halo animation
          if (clip.name.toLowerCase().includes('halorotation.001')) {
            // console.log(`Playing halo animation: ${clip.name}`);
            action.loop = THREE.LoopRepeat;
            action.play();
            actions.push(action);
            return;
          }
          
          // Check if this is the wheel animation (now 200 frames)
          if (clip.name.toLowerCase().includes('wheel') || 
              (clip.tracks.length > 0 && Math.abs(clip.duration - 6.67) < 0.1)) { // 200 frames at 30fps = 6.67 seconds
            action.loop = THREE.LoopRepeat;
            action.clampWhenFinished = false;
            // Play from the beginning
            action.time = 0;
            // Adjust speed as needed (1.0 = normal speed, negative = reverse)
            action.timeScale = -9.0; // Increased from -3.0 to match the tripled speed
            action.play();
            // console.log(`Playing wheel animation: ${clip.name}, duration: ${clip.duration}s, frames: ~${Math.round(clip.duration * 30)}, speed: -9x (reversed)`);
          } else if (clip.name === 'ArmatureAction.001') {
            // UFO animation - handle separately for scroll-based trigger
            action.clampWhenFinished = true;
            action.loop = THREE.LoopOnce;
            action.setEffectiveWeight(1);

            // console.log('UFO animation ready:', clip.name);
          } else {
            // Play any other animations on loop
            action.loop = THREE.LoopRepeat;
            action.play();
            // console.log(`Playing animation on loop: ${clip.name}`);
          }
          
          actions.push(action);
        });
        
        // Add mixer to the list for updating
        animationMixers.push(mixer);
        
        // Store reference to mixers for animation updates
        if (!materialShadersRef.current) {
          materialShadersRef.current = [];
        }
        materialShadersRef.current.push({
          update: (time, delta) => {
            mixer.update(delta);
          }
        });
      }
      
      // Create video element and texture
      const video = document.createElement('video');
      video.src = '/videos/stockChart.mp4';
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true;
      
      const videoTexture = new THREE.VideoTexture(video);
      videoTexture.minFilter = THREE.LinearFilter;
      videoTexture.magFilter = THREE.LinearFilter;
      videoTexture.format = THREE.RGBFormat;
      videoTexture.flipY = false; // Flip the video upside down
      
      // Keep original car materials and add emissive to halo
      carScene.traverse((child) => {
        if (child.isMesh) {
          // console.log('Processing mesh:', child.name); // Debug log
          child.castShadow = true;
          child.receiveShadow = true;
          
          
          // Add emissive to halo objects
        
          
          // Add video texture to Display mesh
          if (child.name === 'Display') { // Exact match
            // console.log('Found Display mesh, applying video texture'); 
            child.material = new THREE.MeshBasicMaterial({
              map: videoTexture,
              emissiveMap: videoTexture,
              emissive: new THREE.Color(0xffffff),
              emissiveIntensity: 1,
              transparent: true,
              opacity: 1
            });
            child.material.needsUpdate = true;
          }
        }
      });
      
      // Start playing the video
      video.play().catch(error => {
        // console.warn('Video autoplay failed:', error);
        // Add click handler to start video on user interaction
        const startVideo = () => {
          video.play();
          document.removeEventListener('click', startVideo);
        };
        document.addEventListener('click', startVideo);
      });
      
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
      underglowLight.position.set(
        lightSettings.underglow.position.x,
        lightSettings.underglow.position.y,
        lightSettings.underglow.position.z
      );
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
      
      // GUI initialization removed for production

    }, 
    // Progress callback (optional)
    (progress) => {
      // console.log('Loading car:', (progress.loaded / progress.total * 100) + '%');
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
        console.log('Camera or controls not ready, retrying...');
        setTimeout(setupScrollAnimation, 500);
        return;
      }
      
      // Kill any existing ScrollTriggers first
      ScrollTrigger.getAll().forEach(t => t.kill());
      
      // Reset to initial state - ensure we're at the start
      window.scrollTo(0, 0);
      scrollProgressRef.current = 0;
      setCurrentCameraStage(0);
      
      // Detect if device is mobile (phone, not tablet)
      const isMobile = (() => {
        const userAgent = navigator.userAgent.toLowerCase();
        const isIPhone = /iphone/i.test(userAgent);
        const isAndroid = /android/i.test(userAgent) && /mobile/i.test(userAgent);
        const hasSmallScreen = window.innerWidth < 600 || window.innerHeight < 600;
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        return (isIPhone || isAndroid) && hasSmallScreen && hasTouch;
      })();
      
      
      // Set initial camera position based on device type
      const initialPos = isMobile 
        ? { x: 17.5605, y: 12.0910, z: 55.1540 }  // Mobile aerial view
        : { x: 16.2711, y: 5.8264, z: 40.5498 };   // Desktop aerial view
      
      const initialTarget = isMobile
        ? { x: 3.0669, y: 6.0868, z: 20.1252 }     // Mobile initial target
        : { x: 4.3726, y: 2.1681, z: 20.7525 };    // Desktop initial target
      
      const initialFov = 45;
      
      cameraRef.current.position.set(initialPos.x, initialPos.y, initialPos.z);
      cameraRef.current.lookAt(initialTarget.x, initialTarget.y, initialTarget.z);
      cameraRef.current.fov = initialFov;
      cameraRef.current.updateProjectionMatrix();
      
      if (controlsRef.current) {
        controlsRef.current.target.set(initialTarget.x, initialTarget.y, initialTarget.z);
        controlsRef.current.update();
      }
      
      // Create a simple timeline for camera movement
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        paused: true // Ensure timeline doesn't auto-play
      });
      
      // Define camera path from aerial to Mary's face
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
      
      // Use different camera paths for mobile vs desktop
      if (isMobile) {
        // Mobile camera sequence - using smoother transitions
        // Mobile waypoint 1: Approach from above
        tl.to(cameraPath, {
          x: 1.0987,
          y: 4.8203,
          z: 36.7389,
          targetX: 1.1492,
          targetY: 2.2977,
          targetZ: 23.3133,
          fov: 44.995111,
          duration: 0.2,
          ease: "none"  // Linear for smoother transitions
        })
        // Mobile waypoint 2: Dramatic side angle
        .to(cameraPath, {
          x: -7.7565,
          y: 3.4606,
          z: 9.1109,
          targetX: 0.3402,
          targetY: 0.9371,
          targetZ: 22.4996,
          fov: 44.833105,
          duration: 0.25,
          ease: "none"  // Linear for consistency
        })
        // Mobile waypoint 3: Move closer to interior
        .to(cameraPath, {
          x: 2.8016,
          y: 1.3315,
          z: 19.6750,
          targetX: 2.3361,
          targetY: 1.5058,
          targetZ: 22.1126,
          fov: 44.832617,
          duration: 0.2,
          ease: "none"  // Linear throughout
        })
        // Mobile final: Direct to final position at Mary
        .to(cameraPath, {
          x: 2.4853, y: 1.1738, z: 24.3400, targetX: 2.4593, targetY: 1.1558, targetZ: 24.0773,
          fov: 44.832617,
          duration: 0.3,
          ease: "power2.out"  // Only ease out at the very end
        });
        
        
        ;
      } else {
        // Desktop camera sequence - original path
        // Waypoint 1: Behind and above (first movement from aerial)
        tl.to(cameraPath, {
          x: 0.8114,
          y: 3.8097,
          z: 36.9146,
          targetX: 0.6379,
          targetY: 1.7031,
          targetZ: 23.6150,
          fov: 42.106054,
          duration: 0.2,
          ease: "power2.inOut"
        })
        // Waypoint 2: Side view at car level
        .to(cameraPath, {
          x: -12.6434,
          y: 3.9412,
          z: 20.5192,
          targetX: 0.6205,
          targetY: 1.7849,
          targetZ: 23.5889,
          fov: 42.106054,
          duration: 0.2,
          ease: "power2.inOut"
        })
        // Waypoint 3: Low front angle
        .to(cameraPath, {
          x: -0.7692,
          y: 3.9049,
          z: 10.1399,
          targetX: 0.6226,
          targetY: 1.7644,
          targetZ: 23.5831,
          fov: 42.106054,
          duration: 0.15,
          ease: "power2.inOut"
        })
        // Waypoint 4: Approaching car from behind
        .to(cameraPath, {
          x: 3.2883,
          y: 1.7877,
          z: 26.5226,
          targetX: 1.4980,
          targetY: 1.3718,
          targetZ: 22.9299,
          fov: 38,
          duration: 0.15,
          ease: "power2.inOut"
        })
        // Waypoint 5: Close to dashboard
        .to(cameraPath, {
          x: 2.3730,
          y: 1.1926,
          z: 26.0807,
          targetX: 1.6639,
          targetY: 1.3046,
          targetZ: 22.9043,
          fov: 30,
          duration: 0.15,
          ease: "power2.inOut"
        })
        // Final close-up: Face to face with Mary
        .to(cameraPath, {
          x: 2.5268,
          y: 1.1644,
          z: 24.4943,
          targetX: 2.4119,
          targetY: 1.1506,
          targetZ: 22.2732,
          fov: 31.2576,
          duration: 0.25,  // Longer duration for final position
          ease: "none"  // Linear easing to ensure exact final position
        });
      }
  
      // Single onUpdate for the entire timeline
      tl.eventCallback("onUpdate", () => {
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
          // Force final position - matching the last waypoint for each platform
          const finalPos = isMobile 
            ? { x: 2.4853, y: 1.1738, z: 24.3400 }
            : { x: 2.5268, y: 1.1644, z: 24.4943 };
          
          const finalTarget = isMobile
            ? { x: 2.4593, y: 1.1558, z: 24.0773 }
            : { x: 2.4119, y: 1.1506, z: 22.2732 };
          
          const finalFov = isMobile ? 44.832617 : 31.2576;
          
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
        }, 1500); // 1.5 second delay after reaching Mary
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
          // Debug logging to track scroll progress and timeline
          if (self.progress > 0.9 || self.progress === 0 || Math.abs(self.progress - 0.5) < 0.01 || Math.abs(self.progress - 0.25) < 0.01 || Math.abs(self.progress - 0.75) < 0.01) {
            const tlProg = tl.progress();
            
            // Manually set timeline progress to match scroll (debugging)
            if (Math.abs(tlProg - self.progress) > 0.01) {
              // console.log(`[WARNING] Timeline out of sync! Setting timeline progress to ${self.progress}`);
              tl.progress(self.progress);
            }
          }
          scrollProgressRef.current = self.progress;
          

          
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
            // console.log('[Mobile] Reached final stage 4, showing button');
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
      
      
      // Log the first few timeline tweens to verify they exist
      const children = tl.getChildren();
      if (children.length > 0) {
        // console.log('First tween targets:', children[0].targets());
        // console.log('First tween vars:', children[0].vars);
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
    };
    
    // Set up scroll animation after a short delay to ensure scene is ready
    setTimeout(() => {
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
    }, 100);
    

    
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
      if (scrollCameraEnabledRef.current) {
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
      
      // Render the scene
      renderer.render(scene, camera);
    };

    // Handle resize
    const handleResize = () => {
      if (mountRef.current && rendererRef.current) {
        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        rendererRef.current.setSize(width, height, false);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Call resize initially to ensure proper sizing
    
    // Handle mouse move for hover effect
    const handleMouseMove = (event) => {
      
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
              emissiveIntensity: 0.7,
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
              emissiveIntensity: 0.5,
              duration: 0.3
            });
          }
        }
      }
    };
    
    // Handle click on Mary
    const handleClick = (event) => {
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
          const destination = isMobile ? '/home' : '/home';
          
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
              const destination = isMobile ? '/home' : '/home';

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
      // Clear loading fallback timer
      clearTimeout(loadingFallback);
      
      // Cancel animation frame to stop the animation loop
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
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
      if (mountRef.current) {
        if (renderer.domElement && renderer.domElement.parentNode === mountRef.current) {
          mountRef.current.removeChild(renderer.domElement);
        }
      }
      
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
      
      controls.dispose();
      renderer.dispose();
      
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

      {!isSceneLoading && scrollCameraActive && (
        <div 
          ref={textSectionRef}
          style={{
            position: 'fixed',
            right: isMobile ? '20px' : '15%',
            top: isMobile ? '40%' : '50%',
            transform: 'translateY(-50%)',
            width: isMobile ? '75%' : '50%',
            maxWidth: '600px',
            pointerEvents: 'none',
            zIndex: "1000",
            height: 'auto',
            minHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '20px',
            overflow: 'visible',
          }}
        >
          <div style={{ 
            marginBottom: isMobile ? '0' : '0', 
            position: 'relative', 
            height: '400px',
          }}>
            {/* Use MorphingWebGLText for final stage, WebGLStandaloneText for others */}
            {currentCameraStage === 4 ? (
              <MorphingWebGLText 
                startTextArray={["YOUR", "REAL80"]}
                endText="RL80"
                shouldMorph={shouldMorph}
                morphDelay={500}
                fontSize={isMobile ? 1.8 : 2.8}
                lineHeight={1}
                color="#fdcdf9"
                className="mb-4"
                isMobile={isMobile}
              />
            ) : (
              <WebGLStandaloneText 
                textArray={textBlocks[currentCameraStage] || ["DRIFT"]}
                fontSize={isMobile ? 1.8 : 2.8}
                lineHeight={isMobile ? 1 : 1}
                id={`palmtree-stage-${currentCameraStage}`}
                className="mb-4"
              />
            )}
          </div>
          <div 
            className="progress-dots"
            style={{
              display: 'flex',
              gap: '8px',
              marginTop: '1rem',
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
          
          {/* Scroll hint - fades out at end of sequence */}
          <div style={{
            marginTop: '1rem',
            fontSize: '12px',
            color: '#01ff00',
            opacity: currentCameraStage === 4 ? 0 : 0.5,
            textAlign: 'center',
            fontFamily: 'monospace',
            animation: currentCameraStage === 4 ? 'none' : 'pulse 2s ease-in-out infinite',
            transition: 'opacity 0.5s ease',
          }}>
            scroll up to continue
          </div>
        </div>
      )}
      
      {/* Scroll Camera Indicator removed for production */}
      </div>
      
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
      
      {/* Enter Button - positioned under the pagination dots, appears after morph completes */}
      {currentCameraStage === 4 && shouldMorph && (
        <div style={{
          position: 'fixed',
          right: isMobile ? '20px' : '15%',
          top: '55%',
          transform: 'translateY(calc(-50% + 150px))', // Position below the text section
          width: isMobile ? '75%' : '50%',
          maxWidth: '600px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 999999,
          pointerEvents: 'auto',
          animation: 'simpleFadeIn 1s ease-in',
        }}>
          <button
            onClick={() => {
              const isMobile = detectMobileDevice();
              const destination = isMobile ? '/home' : '/home';
              router.push(destination);
            }}
            style={{
              padding: isMobile ? '10px 25px' : '15px 40px',
              fontSize: isMobile ? "1.3rem" : "1.8rem",
              fontFamily: "'UnifrakturMaguntia', serif",
              backgroundColor: "#000000",
              color: "#ff00ee",
              border: "2px solid #ff00ee",
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.3s ease",
              boxShadow: "0 0 20px rgba(255, 0, 238, 0.5)",
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "#1a001a";
              e.target.style.transform = "scale(1.05)";
              e.target.style.boxShadow = "0 0 30px rgba(255, 0, 238, 0.8)";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "#000000";
              e.target.style.transform = "scale(1)";
              e.target.style.boxShadow = "0 0 20px rgba(255, 0, 238, 0.5)";
            }}
          >
            Enter
          </button>
        </div>
      )}
    </div>
  );
};

export default PalmsScene;