"use client";

import { useFrame, extend, useThree } from "@react-three/fiber";
import CleanCanvas from "@/components/CleanCanvas";
import React, { Suspense, useRef, useMemo, useEffect, useState } from "react";
import { useGLTF, useAnimations, Text, shaderMaterial, OrbitControls, useHelper, Stats, Html } from "@react-three/drei";
import * as THREE from "three";
// import { CSS3DRenderer, CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer"; // No longer needed
// import DroneScreenCSS3D from "../../components/DroneScreenCSS3D"; // Replaced with video texture

// import { Leva } from "leva";
import DarkClouds from "../../components/Clouds";
import PostProcessingEffects from "../../components/PostProcessingEffects";
import { useFirestoreResults } from '@/lib/useFirestoreResults';
import { useMusic } from '../../components/MusicContext';
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import CyberNav from '../../components/CyberNav';
// import SocialBar from '../../components/SocialBar';
import EnhancedVolumetricLight from '@/components/EnhancedVolumetricLight';
import TranslatableDropInTitle from '../../components/TranslatableDropInTitle';
// import Coin from '../../components/Coin';
// import Link from 'next/link';
import { motion, useInView } from 'framer-motion';

// import HandsGLTFScene from "@/components/HandsGLTFScene";
// import CompactCandleModal from '@/components/CompactCandleModal';
// import CyberFAQSection from '@/components/CyberFAQSection';
import CoinLoader from '@/components/CoinLoader';
// import TokenomicsSection from '@/components/TokenomicsSection';
// import CyberStatsSection from '@/components/CyberStatsSection';
// import CyberTokenomicsSection from '@/components/CyberTokenomicsSection';
// import CyberButton from '@/components/CyberButton';
// import CyberCTACard from '@/components/CyberCTACard';
// import Illumin80Bouncer from '@/components/Illumin80Bouncer';
// import Numerology1 from '@/components/Numerology1';
// import TubesCursor from '@/components/TubesCursor';
// import CarouselWrapper from '@/components/CarouselWrapper';
import BreathSmoke from "@/components/BreathSmoke";
// import SlidingNav from "@/components/SlidingNav";
import ThirdwebBuyModal from '@/components/ThirdwebBuyModal';
// import CircularCTA from "@/components/CircularCTA";
// import FeatureCarousel from "@/components/FeatureCarousel";
// import { WatchlistSlide, Illumin80Slide, TradingDeskSlide, TokenomicsSlide } from "@/components/FeatureSlides";
import Footer from "@/components/Footer";
import { getDroneText } from '@/lib/utils/droneTranslations';
import { useLanguage } from '@/components/LanguageProvider';

// import VideoScreens from "@/components/VideoScreens";
// import NeuralNetworkR3F from '@/components/NeuralNetworkR3F'
// import { CubeWithWorkingCSS3D } from '@/components/CubeWithWorkingCSS3D';




// Animated counter component
// const AnimatedCounter = ({ target, suffix = '', prefix = '', duration = 2 }) => {
//   const [count, setCount] = useState(0);
//   const countRef = useRef(null);
//   const isInView = useInView(countRef, { once: true });
  
  
  
//   useEffect(() => {
//     if (!isInView) return;
    
//     let startTime;
//     let animationId;
    
//     const animate = (timestamp) => {
//       if (!startTime) startTime = timestamp;
//       const progress = (timestamp - startTime) / (duration * 1000);
      
//       if (progress < 1) {
//         setCount(Math.floor(target * progress));
//         animationId = requestAnimationFrame(animate);
//       } else {
//         setCount(target);
//       }
//     };
    
//     animationId = requestAnimationFrame(animate);
    
//     return () => {
//       if (animationId) {
//         cancelAnimationFrame(animationId);
//       }
//     };
//   }, [isInView, target, duration]);

//   return (
//     <span ref={countRef}>
//       {prefix}{count}{suffix}
//     </span>
//   );
// };

// Preload the models
useGLTF.preload('/models/ourlady_rider7.glb');
useGLTF.preload('/models/angel2.glb');
useGLTF.preload('/models/devil2.glb');
useGLTF.preload('/models/pacMan.glb'); // Preload Pac-Man for 80s mode
// Note: Drone models are conditionally loaded in DroneModel component

// Manual click handler component
const ClickHandler = () => {
  const { camera, scene, gl } = useThree();
  
  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    const handleMouseMove = (event) => {
      // Calculate mouse position in normalized device coordinates
      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      // Update raycaster
      raycaster.setFromCamera(mouse, camera);
      
      // Calculate intersections
      const intersects = raycaster.intersectObjects(scene.children, true);
      
      if (intersects.length > 0) {
        // Look for Screen1 specifically in the intersections
        const screen1Intersect = intersects.find(intersect => intersect.object.name === 'Screen1');
        
        if (screen1Intersect && screen1Intersect.object.userData.handleHover) {
          const uv = screen1Intersect.uv;
          if (uv) {
            // Check if drone is close enough to be interactive
            const approachProgress = screen1Intersect.object.userData.approachProgress || 0;
            if (approachProgress >= 0.8) {
              // Drone is interactive - show pointer cursor
              gl.domElement.style.cursor = 'pointer';
            } else {
              // Drone is too far - show default cursor
              gl.domElement.style.cursor = 'default';
            }
            
            // Account for texture rotation (-90 degrees)
            const screenX = uv.y * 512;
            const screenY = (1 - uv.x) * 512;
            screen1Intersect.object.userData.handleHover(screenX, screenY);
          }
        } else {
          // Not hovering over screen - clear hover state and reset cursor
          gl.domElement.style.cursor = 'default';
          const screen1 = scene.getObjectByName('Screen1');
          if (screen1 && screen1.userData.handleHover) {
            screen1.userData.handleHover(-1, -1); // Clear hover
          }
        }
      } else {
        // Not hovering over anything - clear hover state and reset cursor
        gl.domElement.style.cursor = 'default';
        const screen1 = scene.getObjectByName('Screen1');
        if (screen1 && screen1.userData.handleHover) {
          screen1.userData.handleHover(-1, -1); // Clear hover
        }
      }
    };
    
    const handleClick = (event) => {
      console.log('Manual click handler triggered');
      
      // Calculate mouse position in normalized device coordinates
      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      console.log('Mouse coords:', mouse.x, mouse.y);
      
      // Update raycaster
      raycaster.setFromCamera(mouse, camera);
      
      // Calculate intersections
      const intersects = raycaster.intersectObjects(scene.children, true);
      console.log('Manual intersections found:', intersects.length);
      
      intersects.forEach((intersect, index) => {
        console.log(`Manual intersection ${index}:`, intersect.object.name, intersect.object.type);
      });
      
      if (intersects.length > 0) {
        // Look for Screen1 specifically in the intersections
        const screen1Intersect = intersects.find(intersect => intersect.object.name === 'Screen1');
        
        if (screen1Intersect && screen1Intersect.object.userData.handleClick) {
          console.log('Manual: Found Screen1 with click handler');
          const uv = screen1Intersect.uv;
          if (uv) {
            // Account for texture rotation (-90 degrees)
            // Original texture rotation transforms coordinates differently
            const screenX = uv.y * 512;
            const screenY = (1 - uv.x) * 512;
            console.log('Manual: Screen clicked at UV:', uv.x, uv.y, '-> Screen coords:', screenX, screenY);
            screen1Intersect.object.userData.handleClick(screenX, screenY);
          } else {
            console.log('Manual: No UV coordinates found for Screen1');
          }
        } else {
          console.log('Manual: No Screen1 found in intersections');
        }
      }
    };
    
    gl.domElement.addEventListener('click', handleClick);
    gl.domElement.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      gl.domElement.removeEventListener('click', handleClick);
      gl.domElement.removeEventListener('mousemove', handleMouseMove);
    };
  }, [camera, scene, gl]);
  
  return null;
};

// Scroll-responsive Model component with Ticker
const Model = React.memo(function Model({ scrollY, scrollProgress, isMobile, onLoad, is80sMode }) {
  const { scene } = useGLTF('/models/ourlady_rider7.glb');
  const groupRef = useRef();
  const staticBreathRef = useRef();
  const hasLoadedRef = useRef(false);
  const lineRef = useRef();
  const originalLineMaterial = useRef();
  const line2Ref = useRef();
  const originalLine2Material = useRef();

  // Call onLoad when model is ready (prevent duplicate calls)
  useEffect(() => {
    if (scene && onLoad && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      // Disable shadows on the model and find Line meshes
      scene.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = false;
          object.receiveShadow = false;
          
          // Find the Line mesh
          if (object.name === 'Line') {
            lineRef.current = object;
            // Store original material
            originalLineMaterial.current = object.material.clone();
          }
          
          // Find Line2 mesh
          if (object.name === 'Line2') {
            line2Ref.current = object;
            // Store original material
            originalLine2Material.current = object.material.clone();
          }
        }
      });
      onLoad();
    }
  }, [scene, onLoad]);
  
  // Cleanup on unmount with proper texture disposal
  useEffect(() => {
    const currentScene = scene;
    return () => {
      if (currentScene) {
        currentScene.traverse((object) => {
          if (object.geometry) {
            object.geometry.dispose();
          }
          if (object.material) {
            const disposeMaterial = (material) => {
              // Dispose textures
              if (material.map) material.map.dispose();
              if (material.normalMap) material.normalMap.dispose();
              if (material.roughnessMap) material.roughnessMap.dispose();
              if (material.metalnessMap) material.metalnessMap.dispose();
              if (material.aoMap) material.aoMap.dispose();
              if (material.emissiveMap) material.emissiveMap.dispose();
              material.dispose();
            };
            
            if (Array.isArray(object.material)) {
              object.material.forEach(disposeMaterial);
            } else {
              disposeMaterial(object.material);
            }
          }
        });
      }
    };
  }, [scene]);
  
  // Lightning effect for Line meshes in 80s mode
  useEffect(() => {
    if (lineRef.current && is80sMode) {
      // Create cyan emissive lightning material for Line
      const lightningMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#00ffff'),
        emissive: new THREE.Color('#00ffff'),
        emissiveIntensity: 3, // Moderate boost for nice bloom
        metalness: 1.0,
        roughness: 0,
        toneMapped: false, // Disable tone mapping for pure emission
      });
      lineRef.current.material = lightningMaterial;
    } else if (lineRef.current && originalLineMaterial.current) {
      // Restore original material
      lineRef.current.material = originalLineMaterial.current;
    }
    
    // Red lightning for Line2
    if (line2Ref.current && is80sMode) {
      // Create red emissive lightning material for Line2
      const redLightningMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#ff0040'),
        emissive: new THREE.Color('#ff0040'),
        emissiveIntensity: 3, // Moderate boost for nice bloom
        metalness: 1.0,
        roughness: 0,
        toneMapped: false, // Disable tone mapping for pure emission
      });
      line2Ref.current.material = redLightningMaterial;
    } else if (line2Ref.current && originalLine2Material.current) {
      // Restore original material
      line2Ref.current.material = originalLine2Material.current;
    }
  }, [is80sMode]);
  
  // Track when we've reached the bottom (scroll drops from high to low)
  const scrollDroppedRef = useRef(false);
  const prevScrollRef = useRef(0);
  const [hideAtBottom, setHideAtBottom] = React.useState(false);
  
  React.useEffect(() => {
    // Detect any large scroll drop (more than 7000px drop to under 100)
    if (prevScrollRef.current > 7000 && scrollY < 100) {
      // console.log('Scroll drop detected - at bottom:', prevScrollRef.current, '->', scrollY);
      scrollDroppedRef.current = true;
      setHideAtBottom(true);
    } 
    // Only clear when we're clearly scrolling up from a reasonable position
    else if (scrollY > 500 && scrollY < 7000 && !scrollDroppedRef.current) {
      // We're in the middle of the page, safe to show
      setHideAtBottom(false);
    }
    // If we're still seeing high scroll values, we might still be at bottom
    else if (scrollY > 7500) {
      // Keep hidden if we previously detected a drop
      if (scrollDroppedRef.current) {
        setHideAtBottom(true);
      }
    }
    
    // Clear the ref when we're clearly not at bottom
    if (scrollY > 500 && scrollY < 3000) {
      scrollDroppedRef.current = false;
    }
    
    prevScrollRef.current = scrollY;
  }, [scrollY]);
  
  // Hide when scrolled far OR when at bottom (adjusted for longer page)
  const shouldHide = scrollY > 9500 || hideAtBottom;
  
  // Debug logging
  // useEffect(() => {
  //   if (scrollY > 3000 || scrollY <= 20 || hideAtBottom) {
  //     console.log('Scroll:', scrollY, 'shouldHide:', shouldHide, 'hideAtBottom:', hideAtBottom);
  //   }
  // }, [scrollY, shouldHide, hideAtBottom]);
  
  // Animate based on scroll (from Simple3DScene)
  useFrame((state, delta) => {
    if (groupRef.current) {
      // Check for bottom condition right in the render loop
      // This catches the scroll drop immediately without waiting for state updates
      const isAtBottomNow = scrollDroppedRef.current || 
                           (prevScrollRef.current > 7000 && scrollY < 100);
      
      // Hide model if scrolled far OR at bottom
      if (shouldHide || isAtBottomNow) {
        groupRef.current.visible = false;
      } else {
        groupRef.current.visible = true;
        const baseY = isMobile ? -15 : -15;
        
        // Check if we're in drone approach phase using scroll progress
        const droneAppearProgress = 0.35; // Drone appears at 35% of page
        const droneApproachDuration = 0.30; // Approach takes 30% of scroll
        const droneApproachEnd = droneAppearProgress + droneApproachDuration;
        
        let effectiveScrollProgress = scrollProgress;
        
        // During drone approach, lock the model at the appearance position
        if (scrollProgress >= droneAppearProgress - 0.02 && scrollProgress < droneApproachEnd) {
          // Lock model at the position it was when drone started appearing
          effectiveScrollProgress = droneAppearProgress - 0.02;
        } else if (scrollProgress >= droneApproachEnd) {
          // After drone approach, subtract the approach duration to continue smoothly
          effectiveScrollProgress = scrollProgress - droneApproachDuration;
        }
        
        // Clamp Y position to prevent model from going too high
        const maxY = 50;
        const calculatedY = baseY + effectiveScrollProgress * 350;
        groupRef.current.position.y = Math.min(calculatedY, maxY);
      }
    }
    
    // Animate lightning flash in 80s mode - MUCH less frequent
    if (lineRef.current && is80sMode) {
      const time = state.clock.getElapsedTime();
      
      // Very intermittent flash pattern - every 6-8 seconds
      const flashCycle = time % 8;
      let intensity = 0.5; // Subtle base glow
      
      // Main lightning strike - very brief
      if (flashCycle > 7.8 && flashCycle < 7.85) {
        intensity = 8;
        lineRef.current.material.color = new THREE.Color('#ffffff');
        lineRef.current.material.emissive = new THREE.Color('#ffffff');
      } else if (flashCycle > 7.85 && flashCycle < 7.9) {
        // Afterglow
        intensity = 4;
        lineRef.current.material.color = new THREE.Color('#00ffff');
        lineRef.current.material.emissive = new THREE.Color('#00ffff');
      } else if (flashCycle > 4.5 && flashCycle < 4.55) {
        // Secondary smaller flash
        intensity = 5;
        lineRef.current.material.color = new THREE.Color('#ff00ff');
        lineRef.current.material.emissive = new THREE.Color('#ff00ff');
      } else {
        // Normal state - very subtle glow
        lineRef.current.material.color = new THREE.Color('#00ffff');
        lineRef.current.material.emissive = new THREE.Color('#00ffff');
        intensity = 0.5 + Math.sin(time * 1.5) * 0.2; // Gentle pulse
      }
      
      // Very rare random flash (1 in 500 chance per frame)
      if (Math.random() > 0.998) {
        intensity = 6;
        lineRef.current.material.color = new THREE.Color('#ffff00');
        lineRef.current.material.emissive = new THREE.Color('#ffff00');
      }
      
      lineRef.current.material.emissiveIntensity = intensity;
    }
    
    // Animate smooth pulsing glow for Line2
    if (line2Ref.current && is80sMode) {
      const time = state.clock.getElapsedTime();
      
      // Smooth continuous pulsing - no flashing
      // Use multiple sine waves for more organic pulsing
      const pulse1 = Math.sin(time * 1.5) * 0.5 + 0.5; // Main pulse
      const pulse2 = Math.sin(time * 3.7) * 0.3 + 0.5; // Secondary faster pulse
      const combinedPulse = (pulse1 * 0.7 + pulse2 * 0.3); // Combine pulses
      
      // Intensity ranges from 0.8 to 3.5 for visible but not overwhelming glow
      const intensity = 0.8 + combinedPulse * 2.7;
      
      // Slowly cycle through red/orange/pink spectrum
      const colorCycle = time * 0.2; // Very slow color shift
      const r = 1.0;
      const g = Math.sin(colorCycle) * 0.3 + 0.2; // Varies between 0.0 and 0.5
      const b = Math.sin(colorCycle + 2) * 0.4 + 0.3; // Varies between 0.0 and 0.7
      
      const pulsingColor = new THREE.Color(r, g, b);
      line2Ref.current.material.color = pulsingColor;
      line2Ref.current.material.emissive = pulsingColor;
      line2Ref.current.material.emissiveIntensity = intensity;
    }
  });
  
  return (
    <group 
      ref={groupRef} 
      position={isMobile ? [2, -8, -10] : [2, 8, -11]}
    >
      <primitive 
        object={scene} 
        scale={isMobile ? [10, 10, 10] : [12, 12, 12]} 
        rotation={isMobile ? [0, -3.3, 0] : [0.1, -3.2, 0]}
      />
      {/* TickerCurve positioned relative to model (from Simple3DScene) */}
      <TickerCurve 
        scrollY={scrollY}
        scrollProgress={scrollProgress}
        scale={3}
        position={[0, 2, 8]} // Position relative to model - moved up
      />
      
    </group>
  );
});

// OLD CSS3D Implementation - DISABLED (replaced by DroneScreenCSS3D component)
/*
const CSS3DScreen = ({ droneGroup, screenMesh }) => {
  const { gl, camera, scene } = useThree();
  
  useEffect(() => {
    if (!screenMesh || !droneGroup) return;
    
    // Create CSS3D renderer
    const css3DRenderer = new CSS3DRenderer();
    css3DRenderer.setSize(window.innerWidth, window.innerHeight);
    css3DRenderer.domElement.style.position = 'absolute';
    css3DRenderer.domElement.style.top = '0';
    css3DRenderer.domElement.style.pointerEvents = 'none';
    document.body.appendChild(css3DRenderer.domElement);
    
    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.src = '/test-screen';
    iframe.style.width = '800px';
    iframe.style.height = '540px';
    iframe.style.border = 'none';
    iframe.style.pointerEvents = 'auto';
    
    // Create CSS3D object
    const css3DObject = new CSS3DObject(iframe);
    scene.add(css3DObject);
    
    // Update function
    const updatePosition = () => {
      if (droneGroup && screenMesh) {
        // Force update matrices
        droneGroup.updateMatrixWorld(true);
        screenMesh.updateMatrixWorld(true);
        
        // Get screen world position
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        screenMesh.getWorldPosition(pos);
        screenMesh.getWorldQuaternion(quat);
        
        // Apply to CSS3D object
        css3DObject.position.copy(pos);
        css3DObject.quaternion.copy(quat);
        
        // Scale to fit screen (7.9 x 5.4 units)
        const targetWidth = 8; // World units
        const iframeWidth = 800; // Pixels
        const scale = targetWidth / iframeWidth;
        css3DObject.scale.set(scale, scale, scale);
      }
      
      // Render CSS3D
      css3DRenderer.render(scene, camera);
      requestAnimationFrame(updatePosition);
    };
    
    updatePosition();
    
    // Handle resize
    const handleResize = () => {
      css3DRenderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      scene.remove(css3DObject);
      window.removeEventListener('resize', handleResize);
      if (css3DRenderer.domElement.parentNode) {
        css3DRenderer.domElement.parentNode.removeChild(css3DRenderer.domElement);
      }
    };
  }, [screenMesh, droneGroup, scene, camera]);
  
  return null;
};
*/

// Component to attach HTML to Screen1 mesh
const ScreenContent = ({ screenMesh }) => {
  if (!screenMesh) return null;
  
  return (
    <Html
      // Attach directly to the screen mesh object
      transform
      occlude
      position={[0, 0, 0.1]} // Slightly in front of screen surface
      scale={[2, 2, 1]} // Scale to match screen size
      style={{
        width: '400px',
        height: '270px',
      }}
    >
      <iframe
        src="/test-screen"
        style={{
          width: '400px',
          height: '270px',
          border: '2px solid #00ff41',
          background: '#000',
          borderRadius: '4px',
        }}
        title="Drone Screen"
      />
    </Html>
  );
};

// Global store for screen mesh
let globalScreenMesh = null;
let globalDroneGroup = null;

// Manager component for CSS3D screen - DISABLED
// Using DroneScreenCSS3D component instead
const CSS3DScreenManager = () => {
  // Disabled - using standalone DroneScreenCSS3D instead
  return null;
};

// Drone component with built-in hover animation and scroll-based appearance
const DroneModel = React.memo(function DroneModel({ position = [0, 0, 10], scrollY, scrollProgress, isMobile = false, isSignedIn = false, onOpenBuyModal, language = 'en', is80sMode = false }) {
  const modelPath = isMobile ? '/models/drone_mobile.glb' : '/models/drone.glb';
  const { scene, animations } = useGLTF(modelPath);
  const groupRef = useRef();
  const mixerRef = useRef();
  const screenRef = useRef();
  const hasAppearedRef = useRef(false);
  const [screenMesh, setScreenMesh] = useState(null);
  const [screenReady, setScreenReady] = useState(false);
  
  // No longer needed - we'll handle iframe in the texture setup
  // Removed video/iframe creation here
  
  // Set global drone group reference when scene is loaded
  useEffect(() => {
    if (scene) {
      // Set drone group immediately when scene is available
      const timer = setTimeout(() => {
        if (groupRef.current) {
          window.globalDroneGroup = groupRef.current;
          // console.log('DroneModel: Set global drone group:', groupRef.current);
          // Force trigger CSS3D init if it's waiting
          window.dispatchEvent(new CustomEvent('droneReady'));
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [scene]);
  
  // Set up animations and find Screen1 object
  useEffect(() => {
    if (scene) {
      // Find the Screen1 object
      let screenFound = false;
      scene.traverse((object) => {
        // Log all object names to help debug
        // if (object.name) {
        //   console.log('Drone object found:', object.name, object.type);
        // }
        
        if (object.name === 'Screen1' || object.name.includes('Screen')) {
          screenFound = true;
          screenRef.current = object;
          // console.log('✅ Found Screen1 on drone:', object);
          // console.log('Screen1 type:', object.type);
          // console.log('Screen1 parent:', object.parent?.name);
          // console.log('Screen1 position:', object.position);
          // console.log('Screen1 scale:', object.scale);
          
          // Set up interactive navigation/video system for Screen1
          if (object.isMesh) {
            // console.log('Setting up interactive screen on Screen1:', object.name);
            
            // Store language in userData so drawing functions can access it
            object.userData.language = language;
            object.userData.is80sMode = is80sMode;
            
            // Video element for 80s mode
            let videoElement = null;
            let videoTexture = null;
            
            // CRT Terminal system (for non-80s mode)
            let crtTerminal = null;
            let terminalAnimation = null;
            
            // ASCII art skull (full version - 55 lines)
            const asciiArt = [
              "                                      000000                                     ",
              "                                    010101000                                    ",
              "                                   111 1001010                                   ",
              "                                      000000010                                  ",
              "                                  1     1110100                                  ",
              "                                  1   110000110                                  ",
              "                                  1     01010101                                 ",
              "                                  1 1   10110100                                 ",
              "                                 1 111  10010110                                 ",
              "                                11010111000000000                                ",
              "                               001000010000101000                                ",
              "                               1001000000000000000                               ",
              "                              001000001000000000000                              ",
              "                             1100000000000010000000                              ",
              "                             00101000000000000000000                             ",
              "                            0101000010000001000000000                            ",
              "                           10001001001001001000000000                            ",
              "                          10010100001011001 0000000000                           ",
              "                          01010100101101110 00000000000                          ",
              "                        100010010000000000010000000000000                        ",
              "                       10001010010010100001010000000000000                       ",
              "                      0000000010001000001001100000000000001                      ",
              "                     000000001010010010000011000000000100000                     ",
              "                    01100000000100100100100101000000100001000                    ",
              "                   10000 1000100101010100000111000000001101000                   ",
              "                  001010         1100100001011 1100001   11  01                  ",
              "                  1010011 11     11010101000011           10110                  ",
              "                  000000110111   010010000000001        1101000                  ",
              "                  000000010111  1110110010000001 1   1 10111010                  ",
              "                  1000000101101 101001000000000011 1 1110101000                  ",
              "                  1000000010101110110110001000001110101010101000                 ",
              "                  10111000000011101001001000000010111011011   10                 ",
              "                  111 1000001010101101100010000010101011011    1                 ",
              "                   1110000000011110101000100000001001110000111                   ",
              "                    10100000101010010110001010000011001100010                    ",
              "                      100010001111010110010100001010111011100                    ",
              "                     1   000001011010110011010000011011010000                    ",
              "                     1111 00101111011110001110001010101100010                    ",
              "                     101  1000101100101000101100010110001   1                    ",
              "                      11  000011110111110010100100110001011                      ",
              "                      111 1000101110101100010100101110001                        ",
              "                       11 100101111011110001001001010101                         ",
              "                          10001110101111000010010111000                          ",
              "                           1000111110101000001000101101                          ",
              "                           10101 11110 110000000011010                           ",
              "                            1001 11 111110000101011011                           ",
              "                             101  0  1111000000000 10                            ",
              "                              11  1111101100000000011                            ",
              "                                 101001111000000000                              ",
              "                                10  10010 10000010                               ",
              "                                     110   1000                                  ",
              "                                           101                                   "
            ];
            
            // CRT Terminal - just initializing then ASCII art
            const terminalMessages = [
              { text: "INITIALIZING...", delay: 0.5 }
            ];
            
            // Track ASCII art animation
            let currentMessageIndex = 0;
            let currentText = '';
            let isTyping = false;
            let asciiLineIndex = 0;
            let showingAscii = false;
            
            // Create texture based on mode
            let texture;
            let canvas, ctx;
            
            if (is80sMode) {
              // Create video element for 80s mode
              videoElement = document.createElement('video');
              videoElement.src = '/videos/synthosaur.mp4'; // Synthosaur 80s video!
              videoElement.loop = true;
              videoElement.muted = true; // Muted to allow autoplay
              videoElement.playsInline = true;
              videoElement.autoplay = true;
              videoElement.crossOrigin = 'anonymous';
              
              // Create video texture
              videoTexture = new THREE.VideoTexture(videoElement);
              videoTexture.minFilter = THREE.LinearFilter;
              videoTexture.magFilter = THREE.LinearFilter;
              videoTexture.format = THREE.RGBFormat;
              videoTexture.center.set(0.5, 0.5);
              videoTexture.rotation = -Math.PI / 2; // Match the rotation
              
              texture = videoTexture;
              
              // Start playing the video
              videoElement.play().catch(err => {
                console.warn('Video autoplay failed:', err);
              });
            } else {
              // Create canvas for custom UI (CRT terminal mode)
              canvas = document.createElement('canvas');
              canvas.width = 512;
              canvas.height = 512;
              ctx = canvas.getContext('2d');
              
              // Create texture from canvas
              texture = new THREE.CanvasTexture(canvas);
              texture.minFilter = THREE.LinearFilter;
              texture.magFilter = THREE.LinearFilter;
              // Rotate texture 90 degrees counter-clockwise
              texture.center.set(0.5, 0.5);
              texture.rotation = -Math.PI / 2;
            }
            
            // Store original rotation for later
            const originalRotation = texture.rotation;
            
            // Screen states
            let screenMode = 'navigation'; // 'navigation', 'crt-terminal', 'post-video', 'video', 'access-denied', 'verifying', 'access-granted', 'token-prompt'
            let clickAreas = [];
            let hoveredButton = null;
            let lastRedrawTime = 0;
            const redrawThrottle = 16; // ~60fps
            
            // Initialize sound effects
            const sounds = {
              hover: new Audio('https://cdn.freesound.org/previews/582/582898_5965684-lq.mp3'),
              accept: new Audio('https://cdn.freesound.org/previews/370/370962_5450487-lq.mp3'),
              reject: new Audio('https://cdn.freesound.org/previews/370/370962_5450487-lq.mp3')
            };
            
            // Configure sounds
            Object.values(sounds).forEach(sound => {
              sound.volume = 0.3; // Set reasonable volume
              sound.preload = 'auto';
            });
            
            // CRT Terminal drawing function
            const drawCRTTerminal = () => {
              // Clear canvas with black background
              ctx.fillStyle = '#000000';
              ctx.fillRect(0, 0, 512, 512);
              
              // Draw CRT border effect with rounded corners
              ctx.strokeStyle = '#333333';
              ctx.lineWidth = 4;
              const borderRadius = 35;
              ctx.beginPath();
              ctx.roundRect(10, 10, 492, 492, borderRadius);
              ctx.stroke();
              
              // CRT glow effect
              const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 300);
              gradient.addColorStop(0, 'rgba(0, 255, 65, 0.1)');
              gradient.addColorStop(1, 'rgba(0, 255, 65, 0)');
              ctx.fillStyle = gradient;
              ctx.fillRect(0, 0, 512, 512);
              
              // Set up text styling
              ctx.font = '16px Courier New, monosse';
              ctx.fillStyle = '#00ff41';
              ctx.textBaseline = 'top';
              ctx.shadowColor = '#00ff41';
              ctx.shadowBlur = 5;
              
              // Header text
              let y = 60;
              const centerX = 256; // Center of 512px canvas
              
              ctx.textAlign = 'center';
              ctx.fillText(getDroneText('CLOUD_TERMINAL_v2.1', object.userData.language || 'en'), centerX, y);
              y += 30;
              
              // Switch to left align for message content
              ctx.textAlign = 'left';
              const leftMargin = 40;
              
              // Show text messages (INITIALIZING or TRANSMISSION COMPLETE)
              // if (currentText && currentText !== "TRANSMISSION COMPLETE") {
              //   ctx.font = '14px Courier New, monospace';
              //   ctx.fillText('> ' + currentText, leftMargin, y);
              //   y += 30;
              // }
              
              // Draw ASCII art line by line
              if (showingAscii) {
                ctx.font = '6px Courier New, monospace';  // Much smaller for 55 lines
                ctx.textAlign = 'center';
                ctx.shadowBlur = 2;
                
                let artY = y + 10;
                for (let i = 0; i < Math.min(asciiLineIndex, asciiArt.length); i++) {
                  ctx.fillStyle = `rgba(0, 255, 65, ${0.7 + Math.random() * 0.3})`; // Flicker effect
                  ctx.fillText(asciiArt[i], centerX, artY);
                  artY += 7;  // Smaller line spacing
                }
                
                ctx.textAlign = 'left';
                ctx.shadowBlur = 5;
                
                // Show "TRANSMISSION COMPLETE" below ASCII art
                if (currentText === "TRANSMISSION INITIATED") {
                  ctx.textAlign = 'center';
                  ctx.fillStyle = '#00ff41';
                  ctx.shadowBlur = 10;
                  ctx.font = 'bold 16px Courier New, monospace';
                  ctx.fillText(currentText, centerX, artY + 20);
                  ctx.textAlign = 'left';
                }
              }
              
              // Blinking cursor (only when typing, not during ASCII art)
              if (!showingAscii && (isTyping || Math.floor(Date.now() / 500) % 2 === 0)) {
                const cursorX = leftMargin + (currentText.length > 0 ? ctx.measureText('> ' + currentText).width : 20);
                ctx.fillText('█', cursorX, y - 5);
              }
              
              // Scanlines effect
              for (let i = 0; i < 512; i += 4) {
                ctx.fillStyle = 'rgba(0, 255, 65, 0.02)';
                ctx.fillRect(0, i, 512, 2);
              }
              
              texture.needsUpdate = true;
            };
            
            // CRT Terminal typing animation
            const startCRTTerminal = () => {
              currentMessageIndex = 0;
              currentText = '';
              isTyping = false;
              asciiLineIndex = 0;
              showingAscii = false;
              
              const typeNextMessage = () => {
                if (currentMessageIndex >= terminalMessages.length) {
                  // Start showing ASCII art after "INITIALIZING..."
                  if (!showingAscii) {
                    showingAscii = true;
                    asciiLineIndex = 0;
                    
                    // Animate ASCII art line by line
                    const showNextAsciiLine = () => {
                      if (asciiLineIndex < asciiArt.length) {
                        asciiLineIndex++;
                        drawCRTTerminal();
                        
                        setTimeout(showNextAsciiLine, 50); // Faster for more lines
                      } else {
                        // ASCII art complete, show final message
                        console.log('ASCII art complete, lines shown:', asciiLineIndex);
                        
                        // Display "TRANSMISSION COMPLETE" after ASCII art
                        setTimeout(() => {
                          currentText = "TRANSMISSION INITIATED";
                          // Keep showingAscii true to display both
                          drawCRTTerminal();
                          
                          // Play acceptance sound for completion
                          sounds.accept.cloneNode(true).play().catch(() => {});
                          
                          // Then show token prompt after a pause
                          setTimeout(() => {
                            console.log('CRT Terminal complete, showing token prompt');
                            screenMode = 'token-prompt';
                            drawTokenPromptScreen();
                          }, 2000);
                        }, 500);
                      }
                    };
                    
                    showNextAsciiLine();
                  }
                  return;
                }
                
                const message = terminalMessages[currentMessageIndex];
                
                // Add delay before typing
                setTimeout(() => {
                  if (message.text === '') {
                    // Empty line
                    currentText += '\n';
                    currentMessageIndex++;
                    typeNextMessage();
                    return;
                  }
                  
                  // Type character by character
                  isTyping = true;
                  let charIndex = 0;
                  const typeChar = () => {
                    if (charIndex < message.text.length) {
                      currentText += message.text[charIndex];
                      charIndex++;
                      drawCRTTerminal();
                      
                      // Variable typing speed for realism
                      setTimeout(typeChar, 50 + Math.random() * 100);
                    } else {
                      // Message complete
                      isTyping = false;
                      currentText += '\n';
                      currentMessageIndex++;
                      drawCRTTerminal();
                      
                      // Move to next message
                      setTimeout(typeNextMessage, 800);
                    }
                  };
                  typeChar();
                }, (message.delay || 0.5) * 1000);
              };
              
              typeNextMessage();
            };
            
            // Power-on animation state (stored on object for persistence)
            object.userData.bootProgress = 0;
            object.userData.isPoweringOn = false;
            object.userData.screenDrawn = false;
            
            // Draw initial navigation screen
            const drawNavigationScreen = (hoveredIndex = null) => {
              // Check if drone is interactive
              const approachProgress = object.userData.approachProgress || 0;
              const isInteractive = approachProgress >= 0.8;
              
              // If screen is off (not interactive yet)
              if (!isInteractive) {
                // Draw black/off screen with subtle static
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, 512, 512);
                
                // Add subtle static effect
                for (let i = 0; i < 20; i++) {
                  const x = Math.random() * 512;
                  const y = Math.random() * 512;
                  const brightness = Math.random() * 30;
                  ctx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, 0.5)`;
                  ctx.fillRect(x, y, 1, 1);
                }
                
                // Faint power indicator
                ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                ctx.beginPath();
                ctx.arc(256, 450, 5, 0, Math.PI * 2);
                ctx.fill();
                
                return; // Don't draw anything else when off
              }
              
              // Power-on effect tied to scroll progress
              if (object.userData.isPoweringOn) {
                const progress = object.userData.bootProgress || 0;
                
                // Clear screen
                ctx.fillStyle = '#000';
                ctx.fillRect(0, 0, 512, 512);
                
                // Boot sequence animation based on scroll progress
                if (progress < 0.25) {
                  // Phase 1 (0-25%): Power indicator transitions from red to green
                  const phase1Progress = progress / 0.25;
                  const greenAmount = Math.floor(phase1Progress * 255);
                  const redAmount = Math.floor((1 - phase1Progress) * 255);
                  ctx.fillStyle = `rgb(${redAmount}, ${greenAmount}, 0)`;
                  ctx.beginPath();
                  ctx.arc(256, 450, 5 + phase1Progress * 15, 0, Math.PI * 2);
                  ctx.fill();
                  
                  // Add pulsing effect
                  ctx.strokeStyle = `rgba(${redAmount}, ${greenAmount}, 0, ${0.5 - phase1Progress * 0.3})`;
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.arc(256, 450, 10 + phase1Progress * 20, 0, Math.PI * 2);
                  ctx.stroke();
                  
                } else if (progress < 0.6) {
                  // Phase 2 (25-60%): Scanline boot effect with crosshairs
                  const phase2Progress = (progress - 0.25) / 0.35;
                  
                  // Keep power indicator green
                  ctx.fillStyle = '#00ff41';
                  ctx.beginPath();
                  ctx.arc(256, 450, 20, 0, Math.PI * 2);
                  ctx.fill();
                  
                  // Expanding crosshairs from center
                  const expansion = phase2Progress;
                  ctx.strokeStyle = '#00ff41';
                  ctx.lineWidth = 3;
                  ctx.globalAlpha = Math.max(0, 1 - expansion * 0.3);
                  
                  // Horizontal line
                  ctx.beginPath();
                  ctx.moveTo(256 - expansion * 200, 256);
                  ctx.lineTo(256 + expansion * 200, 256);
                  ctx.stroke();
                  
                  // Vertical line
                  ctx.beginPath();
                  ctx.moveTo(256, 256 - expansion * 200);
                  ctx.lineTo(256, 256 + expansion * 200);
                  ctx.stroke();
                  
                  // Corner brackets that expand
                  ctx.lineWidth = 2;
                  const bracketSize = expansion * 50;
                  // Top-left
                  ctx.beginPath();
                  ctx.moveTo(256 - expansion * 150, 256 - expansion * 150);
                  ctx.lineTo(256 - expansion * 150 + bracketSize, 256 - expansion * 150);
                  ctx.moveTo(256 - expansion * 150, 256 - expansion * 150);
                  ctx.lineTo(256 - expansion * 150, 256 - expansion * 150 + bracketSize);
                  ctx.stroke();
                  
                  // Top-right
                  ctx.beginPath();
                  ctx.moveTo(256 + expansion * 150, 256 - expansion * 150);
                  ctx.lineTo(256 + expansion * 150 - bracketSize, 256 - expansion * 150);
                  ctx.moveTo(256 + expansion * 150, 256 - expansion * 150);
                  ctx.lineTo(256 + expansion * 150, 256 - expansion * 150 + bracketSize);
                  ctx.stroke();
                  
                  // Bottom-left
                  ctx.beginPath();
                  ctx.moveTo(256 - expansion * 150, 256 + expansion * 150);
                  ctx.lineTo(256 - expansion * 150 + bracketSize, 256 + expansion * 150);
                  ctx.moveTo(256 - expansion * 150, 256 + expansion * 150);
                  ctx.lineTo(256 - expansion * 150, 256 + expansion * 150 - bracketSize);
                  ctx.stroke();
                  
                  // Bottom-right
                  ctx.beginPath();
                  ctx.moveTo(256 + expansion * 150, 256 + expansion * 150);
                  ctx.lineTo(256 + expansion * 150 - bracketSize, 256 + expansion * 150);
                  ctx.moveTo(256 + expansion * 150, 256 + expansion * 150);
                  ctx.lineTo(256 + expansion * 150, 256 + expansion * 150 - bracketSize);
                  ctx.stroke();
                  
                  ctx.globalAlpha = 1;
                  
                  // Static effect that decreases
                  for (let i = 0; i < 150 * (1 - phase2Progress); i++) {
                    const x = Math.random() * 512;
                    const y = Math.random() * 512;
                    ctx.fillStyle = `rgba(0, 255, 65, ${Math.random() * (1 - phase2Progress) * 0.3})`;
                    ctx.fillRect(x, y, 1, 1);
                  }
                  
                } else {
                  // Phase 3 (60-100%): Boot text and progress
                  const phase3Progress = (progress - 0.6) / 0.4;
                  
                  // Keep power indicator
                  ctx.fillStyle = '#00ff41';
                  ctx.beginPath();
                  ctx.arc(256, 450, 20, 0, Math.PI * 2);
                  ctx.fill();
                  
                  // Fade in the UI
                  ctx.globalAlpha = phase3Progress;
                  
                  ctx.fillStyle = '#00ff41';
                  ctx.font = 'bold 24px Courier New';
                  ctx.textAlign = 'center';
                  ctx.fillText('SYSTEM BOOTING', 256, 200);
                  
                  // Boot messages appear progressively
                  ctx.font = '12px Courier New';
                  ctx.textAlign = 'left';
                  const messages = [
                    'Initializing drone OS...',
                    'Loading navigation module...',
                    'Calibrating sensors...',
                    'Establishing uplink...',
                    'System ready'
                  ];
                  
                  const numMessages = Math.floor(phase3Progress * messages.length);
                  for (let i = 0; i < numMessages; i++) {
                    ctx.fillText('> ' + messages[i], 100, 250 + i * 20);
                  }
                  
                  // Progress bar
                  ctx.strokeStyle = '#00ff41';
                  ctx.lineWidth = 2;
                  ctx.strokeRect(156, 380, 200, 20);
                  ctx.fillStyle = '#00ff41';
                  ctx.fillRect(158, 382, 196 * phase3Progress, 16);
                  
                  // Percentage
                  ctx.textAlign = 'center';
                  ctx.font = '14px Courier New';
                  ctx.fillText(`${Math.floor(phase3Progress * 100)}%`, 256, 420);
                  
                  ctx.globalAlpha = 1;
                }
                
                // Update texture
                texture.needsUpdate = true;
                return;
              }
              
              // Normal interactive screen with CRT terminal aesthetic
              ctx.fillStyle = '#000000';
              ctx.fillRect(0, 0, 512, 512);
              
              // Draw CRT border effect with rounded corners
              ctx.strokeStyle = '#333333';
              ctx.lineWidth = 4;
              const borderRadius = 35;
              ctx.beginPath();
              ctx.roundRect(10, 10, 492, 492, borderRadius);
              ctx.stroke();
              
              // CRT glow effect
              const crtGradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 300);
              crtGradient.addColorStop(0, 'rgba(0, 255, 65, 0.1)');
              crtGradient.addColorStop(1, 'rgba(0, 255, 65, 0)');
              ctx.fillStyle = crtGradient;
              ctx.fillRect(0, 0, 512, 512);
              
              // System ready indicator
              ctx.fillStyle = '#00ff41';
              ctx.font = 'bold 14px Courier New, monospace';
              ctx.textAlign = 'center';
              ctx.shadowColor = '#00ff41';
              ctx.shadowBlur = 5;
              ctx.fillText('CLOUD_TERMINAL_v2.1', 256, 45);
              
              // Title with terminal glow effect
              ctx.shadowColor = '#00ff41';
              ctx.shadowBlur = 10;
              ctx.fillStyle = '#00ff41';
              ctx.font = 'bold 28px Courier New, monospace';
              ctx.textAlign = 'center';
              ctx.fillText(getDroneText('[ MAIN MENU ]', object.userData.language || 'en'), 256, 75);
              ctx.shadowBlur = 0;
              
              // Welcome terminal button with cyberpunk style
              const terminalBtnX = 56;
              const terminalBtnY = 150;
              const terminalBtnWidth = 400;
              const terminalBtnHeight = 60;
              const isTerminalHovered = hoveredIndex === 0;
              
              ctx.save();
              
              // Create clipping path for terminal button (larger corner cut)
              ctx.beginPath();
              ctx.moveTo(terminalBtnX, terminalBtnY);
              ctx.lineTo(terminalBtnX + terminalBtnWidth, terminalBtnY);
              ctx.lineTo(terminalBtnX + terminalBtnWidth, terminalBtnY + terminalBtnHeight - 15);
              ctx.lineTo(terminalBtnX + terminalBtnWidth - 15, terminalBtnY + terminalBtnHeight);
              ctx.lineTo(terminalBtnX, terminalBtnY + terminalBtnHeight);
              ctx.closePath();
              
              // Fill with cyan/blue gradient when hovered (matching the codepen accent color)
              if (isTerminalHovered) {
                const gradient = ctx.createLinearGradient(terminalBtnX, terminalBtnY, terminalBtnX + terminalBtnWidth, terminalBtnY);
                gradient.addColorStop(0, 'rgba(114, 191, 190, 0.3)');  // Cyber blue from codepen
                gradient.addColorStop(0.5, 'rgba(114, 191, 190, 0.4)');
                gradient.addColorStop(1, 'rgba(114, 191, 190, 0.3)');
                ctx.fillStyle = gradient;
                ctx.fill();
              } else {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
                ctx.fill();
              }
              
              // Draw border with cyber blue
              ctx.strokeStyle = isTerminalHovered ? '#72bfbe' : 'rgba(114, 191, 190, 0.8)';  // Cyber blue
              ctx.lineWidth = isTerminalHovered ? 4 : 3;
              ctx.stroke();
              
              // Draw accent elements with cyber blue
              ctx.beginPath();
              ctx.moveTo(terminalBtnX - 20, terminalBtnY + 10);
              ctx.lineTo(terminalBtnX - 20, terminalBtnY + terminalBtnHeight - 10);
              ctx.strokeStyle = '#72bfbe';  // Cyber blue
              ctx.lineWidth = 4;
              ctx.stroke();
              
              // Terminal button text with cyber blue glow
              ctx.shadowColor = '#72bfbe';  // Cyber blue
              ctx.shadowBlur = isTerminalHovered ? 25 : 15;
              ctx.fillStyle = isTerminalHovered ? '#ffffff' : '#72bfbe';  // Cyber blue
              ctx.font = 'bold 20px Courier New';
              ctx.textAlign = 'center';
              ctx.fillText(getDroneText('▶ ACQUIRE TOKENS', object.userData.language || 'en'), terminalBtnX + terminalBtnWidth/2, terminalBtnY + terminalBtnHeight/2 + 7);
              
              ctx.shadowBlur = 0;
              ctx.textAlign = 'left';
              ctx.restore();
              
              // Navigation buttons - adjusted spacing for larger buttons
              const buttons = [
                // { text: '◆ HOME', y: 230, url: '/' },
                // { text: 'BUY RL80', y: 80, action: 'openBuyModal', style: 'special' },  // Special buy button
                // { text: '▶ VIDEO MESSAGE', y: 230, action: 'playVideo', video: '/videos/23.mp4' },
                { text: '▲ TRADING DESK', y: 220, url: '/trade' },
                { text: '◉ TOKENOMICS', y: 290, url: '/tokenomics' },
                { text: '🔒 ILLUMIN80 [RESTRICTED]', y: 360, action: 'checkAccess', url: '/gallery3' },

              ];
              
              clickAreas = [
                { x: 56, y: 150, width: 400, height: 60, action: 'activateTerminal' }
              ];
              
              buttons.forEach((btn, index) => {
                const btnX = 56;
                const btnY = btn.y;
                const btnWidth = 400;  // Same width as terminal button
                const btnHeight = 60;  // Same height as terminal button
                const cornerSize = 15;  // Same corner size as terminal button
                const isHovered = hoveredIndex === index + 1; // +1 because terminal button is index 0
                const isVideoBtn = btn.action === 'playVideo';
                const isRestrictedBtn = btn.action === 'checkAccess';
                const isSpecialBtn = btn.style === 'special';
                
                // Draw cyberpunk-style button with cut corner
                ctx.save();
                
                // Create clipping path for button shape (polygon with cut corner)
                ctx.beginPath();
                ctx.moveTo(btnX, btnY);
                ctx.lineTo(btnX + btnWidth, btnY);
                ctx.lineTo(btnX + btnWidth, btnY + btnHeight - cornerSize);
                ctx.lineTo(btnX + btnWidth - cornerSize, btnY + btnHeight);
                ctx.lineTo(btnX, btnY + btnHeight);
                ctx.closePath();
                
                // Fill background - special color for video button, restricted button, and special button
                if (isHovered) {
                  // Glitch effect for hovered state
                  const glitchOffset = Math.random() * 2 - 1;
                  if (isVideoBtn) {
                    ctx.fillStyle = 'rgba(147, 51, 234, 0.3)'; // Purple for video
                  } else if (isRestrictedBtn) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'; // Red for restricted
                  } else if (isSpecialBtn) {
                    ctx.fillStyle = 'rgba(255, 215, 0, 0.3)'; // Gold for special
                  } else {
                    ctx.fillStyle = 'rgba(0, 255, 65, 0.2)';
                  }
                  ctx.fill();
                  
                  // Add glitch lines
                  ctx.strokeStyle = isVideoBtn ? '#9333ea' : (isRestrictedBtn ? '#ff0000' : (isSpecialBtn ? '#ffd700' : '#00ff41'));
                  ctx.lineWidth = 1;
                  ctx.globalAlpha = 0.5;
                  ctx.beginPath();
                  ctx.moveTo(btnX + glitchOffset * 5, btnY + btnHeight * 0.3);
                  ctx.lineTo(btnX + btnWidth + glitchOffset * 3, btnY + btnHeight * 0.3);
                  ctx.stroke();
                  ctx.beginPath();
                  ctx.moveTo(btnX - glitchOffset * 3, btnY + btnHeight * 0.7);
                  ctx.lineTo(btnX + btnWidth - glitchOffset * 5, btnY + btnHeight * 0.7);
                  ctx.stroke();
                  ctx.globalAlpha = 1;
                } else {
                  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
                  ctx.fill();
                }
                
                // Draw border - different color for video button, restricted button, and special button
                if (isVideoBtn) {
                  ctx.strokeStyle = isHovered ? '#9333ea' : 'rgba(147, 51, 234, 0.8)';
                } else if (isRestrictedBtn) {
                  ctx.strokeStyle = isHovered ? '#ff0000' : 'rgba(255, 0, 0, 0.8)';
                } else if (isSpecialBtn) {
                  ctx.strokeStyle = isHovered ? '#ffd700' : 'rgba(255, 215, 0, 0.8)';
                } else {
                  ctx.strokeStyle = isHovered ? '#00ff41' : 'rgba(0, 255, 65, 0.8)';
                }
                ctx.lineWidth = isHovered ? 3 : 2;
                ctx.stroke();
                
                // Add accent line on the side - animated when hovered
                ctx.beginPath();
                const sideLineOffset = isHovered ? Math.sin(Date.now() * 0.01) * 2 : 0;
                ctx.moveTo(btnX - 20 + sideLineOffset, btnY + 10);
                ctx.lineTo(btnX - 20 + sideLineOffset, btnY + btnHeight - 10);
                if (isVideoBtn) {
                  ctx.strokeStyle = isHovered ? '#9333ea' : 'rgba(147, 51, 234, 0.6)';
                } else if (isRestrictedBtn) {
                  ctx.strokeStyle = isHovered ? '#ff0000' : 'rgba(255, 0, 0, 0.6)';
                } else if (isSpecialBtn) {
                  ctx.strokeStyle = isHovered ? '#ffd700' : 'rgba(255, 215, 0, 0.6)';
                } else {
                  ctx.strokeStyle = isHovered ? '#00ff41' : 'rgba(0, 255, 65, 0.6)';
                }
                ctx.lineWidth = isHovered ? 4 : 3;
                ctx.stroke();
                
                // No corner accent - matching terminal button style
                
                // Draw text with enhanced glow effect when hovered
                ctx.shadowColor = isVideoBtn ? '#9333ea' : (isRestrictedBtn ? '#ff0000' : (isSpecialBtn ? '#ffd700' : '#00ff41'));
                ctx.shadowBlur = isHovered ? 25 : 15;  // Match terminal button glow
                if (isVideoBtn) {
                  ctx.fillStyle = isHovered ? '#ffffff' : '#9333ea';
                } else if (isRestrictedBtn) {
                  ctx.fillStyle = isHovered ? '#ffffff' : '#ff0000';
                } else if (isSpecialBtn) {
                  ctx.fillStyle = isHovered ? '#ffffff' : '#ffd700';
                } else {
                  ctx.fillStyle = isHovered ? '#ffffff' : '#00ff41';
                }
                ctx.font = 'bold 20px Courier New';  // Same font size as terminal button
                ctx.textAlign = 'center';
                
                // Add glitch text effect when hovered
                if (isHovered && Math.random() > 0.9) {
                  // Occasional glitch displacement
                  const glitchX = (Math.random() - 0.5) * 4;
                  const glitchY = (Math.random() - 0.5) * 2;
                  ctx.fillStyle = 'rgba(255, 0, 100, 0.5)';
                  ctx.fillText(btn.text.toUpperCase(), btnX + btnWidth/2 + glitchX, btnY + btnHeight/2 + 7 + glitchY);
                  ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
                  ctx.fillText(btn.text.toUpperCase(), btnX + btnWidth/2 - glitchX, btnY + btnHeight/2 + 7 - glitchY);
                }
                
                if (isVideoBtn) {
                  ctx.fillStyle = isHovered ? '#ffffff' : '#9333ea';
                } else {
                  ctx.fillStyle = isHovered ? '#ffffff' : '#00ff41';
                }
                ctx.fillText(btn.text.toUpperCase(), btnX + btnWidth/2, btnY + btnHeight/2 + 7);  // Adjusted for larger button
                
                // Reset shadow
                ctx.shadowBlur = 0;
                ctx.textAlign = 'left';
                ctx.restore();
                
                clickAreas.push({
                  x: btnX, y: btnY, width: btnWidth, height: btnHeight,
                  action: btn.action || 'navigate',
                  url: btn.url,
                  video: btn.video,
                  index: index + 1
                });
              });
              
              // Add scanlines effect for CRT look
              for (let i = 0; i < 512; i += 4) {
                ctx.fillStyle = 'rgba(0, 255, 65, 0.02)';
                ctx.fillRect(0, i, 512, 2);
              }
              
              texture.needsUpdate = true;
            };
            
            // Draw post-video navigation (same design as pre-CRT)
            const drawPostVideoScreen = () => {
              // Simply use the exact same navigation screen
              // Users can click "ACTIVATE TERMINAL" again to replay
              drawNavigationScreen();
            };
            
            // Draw token prompt screen with yes/no buttons (no ASCII art)
            const drawTokenPromptScreen = () => {
              // Clear canvas with black background
              ctx.fillStyle = '#000000';
              ctx.fillRect(0, 0, 512, 512);
              
              // Draw CRT border effect with rounded corners
              ctx.strokeStyle = '#333333';
              ctx.lineWidth = 4;
              const borderRadius = 35;
              ctx.beginPath();
              ctx.roundRect(10, 10, 492, 492, borderRadius);
              ctx.stroke();
              
              // CRT glow effect
              const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 300);
              gradient.addColorStop(0, 'rgba(0, 255, 65, 0.1)');
              gradient.addColorStop(1, 'rgba(0, 255, 65, 0)');
              ctx.fillStyle = gradient;
              ctx.fillRect(0, 0, 512, 512);
              
              // Set up text styling
              ctx.font = '16px Courier New, monospace';
              ctx.fillStyle = '#00ff41';
              ctx.textBaseline = 'top';
              ctx.shadowColor = '#00ff41';
              ctx.shadowBlur = 5;
              
              // Header text
              const centerX = 256;
              const centerY = 256;
              
              ctx.textAlign = 'center';
              ctx.fillText('CLOUD_TERMINAL_v2.1', centerX, 60);
              
              // Draw RL80 flame logo (simplified ASCII version)
              ctx.font = '24px Courier New, monospace';
              ctx.shadowBlur = 10;
              ctx.fillStyle = '#00ff41';
              ctx.fillText('🔥', centerX, centerY - 80);
              ctx.font = 'bold 32px Courier New, monospace';
              ctx.fillText('RL80', centerX, centerY - 40);
              
              // Draw prompt text
              ctx.font = 'bold 18px Courier New, monospace';
              ctx.fillStyle = '#00ff41';
              ctx.shadowBlur = 8;
              ctx.textAlign = 'center';
              ctx.fillText(getDroneText('BUY RL80 TOKENS?', object.userData.language || 'en'), centerX, centerY + 20);
              
              // Clear click areas and define new ones for yes/no buttons
              clickAreas = [];
              
              // Debug: Log button drawing
              console.log('Drawing token prompt, hoveredButton:', hoveredButton);
              
              // Draw buttons - standard horizontal layout
              const buttonY = centerY + 70;
              const buttonWidth = 100;
              const buttonHeight = 40;
              const buttonSpacing = 50;
              
              // Draw YES button on LEFT in canvas space
              const yesX = centerX - buttonWidth - buttonSpacing/2;
              const yesHovered = hoveredButton === 'yes';
              console.log('Drawing YES button at X:', yesX, 'hovered:', yesHovered);
              
              // Draw YES button box
              ctx.strokeStyle = yesHovered ? '#00ff41' : 'rgba(0, 255, 65, 0.5)';
              ctx.fillStyle = yesHovered ? 'rgba(0, 255, 65, 0.2)' : 'rgba(0, 255, 65, 0.05)';
              ctx.lineWidth = 2;
              ctx.fillRect(yesX, buttonY, buttonWidth, buttonHeight);
              ctx.strokeRect(yesX, buttonY, buttonWidth, buttonHeight);
              
              // YES text
              ctx.fillStyle = '#00ff41';
              ctx.font = yesHovered ? 'bold 20px Courier New, monospace' : '18px Courier New, monospace';
              ctx.shadowBlur = yesHovered ? 12 : 6;
              ctx.textAlign = 'center';
              ctx.fillText(getDroneText('YES', object.userData.language || 'en'), yesX + buttonWidth/2, buttonY + buttonHeight/2 - 8);
              
              // Add YES click area
              clickAreas.push({
                x: yesX,
                y: buttonY,
                width: buttonWidth,
                height: buttonHeight,
                action: 'buyTokens',
                button: 'yes'
              });
              
              // Draw NO button on RIGHT in canvas space
              const noX = centerX + buttonSpacing/2;
              const noHovered = hoveredButton === 'no';
              console.log('Drawing NO button at X:', noX, 'hovered:', noHovered);
              
              // Draw NO button box
              ctx.strokeStyle = noHovered ? '#00ff41' : 'rgba(0, 255, 65, 0.5)';
              ctx.fillStyle = noHovered ? 'rgba(0, 255, 65, 0.2)' : 'rgba(0, 255, 65, 0.05)';
              ctx.lineWidth = 2;
              ctx.fillRect(noX, buttonY, buttonWidth, buttonHeight);
              ctx.strokeRect(noX, buttonY, buttonWidth, buttonHeight);
              
              // NO text
              ctx.fillStyle = '#00ff41';
              ctx.font = noHovered ? 'bold 20px Courier New, monospace' : '18px Courier New, monospace';
              ctx.shadowBlur = noHovered ? 12 : 6;
              ctx.textAlign = 'center';
              ctx.fillText(getDroneText('NO', object.userData.language || 'en'), noX + buttonWidth/2, buttonY + buttonHeight/2 - 8);
              
              // Add NO click area
              clickAreas.push({
                x: noX,
                y: buttonY,
                width: buttonWidth,
                height: buttonHeight,
                action: 'declineTokens',
                button: 'no'
              });
              
              // Scanlines effect
              for (let i = 0; i < 512; i += 4) {
                ctx.fillStyle = 'rgba(0, 255, 65, 0.02)';
                ctx.fillRect(0, i, 512, 2);
              }
              
              texture.needsUpdate = true;
            };
            
            // Draw access denied CRT screen
            const drawAccessDeniedScreen = () => {
              // Clear canvas with black background
              ctx.fillStyle = '#000000';
              ctx.fillRect(0, 0, 512, 512);
              
              // Draw CRT border effect
              ctx.strokeStyle = '#ff0000';

              ctx.lineWidth = 4;
              const borderRadius = 35;
              ctx.beginPath();
              ctx.roundRect(10, 10, 492, 492, borderRadius);
              ctx.stroke();
              
              // CRT glow effect with red tint
              const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 300);
              gradient.addColorStop(0, 'rgba(255, 0, 0, 0.1)');
              gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
              ctx.fillStyle = gradient;
              ctx.fillRect(0, 0, 512, 512);
              
              // Draw warning symbol
              ctx.font = '48px Courier New, monospace';
              ctx.fillStyle = '#ff0000';
              ctx.textAlign = 'center';
              ctx.shadowColor = '#ff0000';
              ctx.shadowBlur = 10;
              ctx.fillText('⚠', 256, 120);
              
              // Access denied text
              ctx.font = 'bold 24px Courier New, monospace';
              ctx.fillText(getDroneText('ACCESS DENIED', object.userData.language || 'en'), 256, 180);
              
              ctx.font = '16px Courier New, monospace';
              ctx.fillStyle = '#ff6600';
              ctx.fillText('RESTRICTED AREA', 256, 220);
              
              // Error message
              ctx.font = '14px Courier New, monospace';
              ctx.fillStyle = '#00ff41';
              ctx.fillText('AUTHENTICATION REQUIRED', 256, 280);
              ctx.fillText('CLEARANCE NEEDED', 256, 310);
              
              // Instructions
              ctx.font = '12px Courier New, monospace';
              ctx.fillStyle = '#00ff41';
              ctx.fillText('Please check back for updates', 256, 360);
              // ctx.fillText('Contact admin for credentials', 256, 380);
              
              // Return button
              const btnX = 156;
              const btnY = 420;
              const btnWidth = 200;
              const btnHeight = 50;
              
              ctx.save();
              ctx.strokeStyle = '#00ff41';
              ctx.lineWidth = 2;
              ctx.strokeRect(btnX, btnY, btnWidth, btnHeight);
              
              ctx.font = 'bold 16px Courier New, monospace';
              ctx.fillStyle = '#00ff41';
              ctx.fillText('[ RETURN ]', 256, btnY + 30);
              ctx.restore();
              
              // Set click area for return button
              clickAreas = [
                { x: btnX, y: btnY, width: btnWidth, height: btnHeight, action: 'returnToNav' }
              ];
              
              // Scanlines effect
              for (let i = 0; i < 512; i += 4) {
                ctx.fillStyle = 'rgba(255, 0, 0, 0.02)';
                ctx.fillRect(0, i, 512, 2);
              }
              
              texture.needsUpdate = true;
            };
            
            // Draw verifying credentials CRT screen
            const drawVerifyingScreen = () => {
              // Clear canvas with black background
              ctx.fillStyle = '#000000';
              ctx.fillRect(0, 0, 512, 512);
              
              // Draw CRT border effect with amber
              ctx.strokeStyle = '#ffa500';
              ctx.lineWidth = 4;
              ctx.strokeRect(10, 10, 492, 492);
              
              // CRT glow effect with amber tint
              const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 300);
              gradient.addColorStop(0, 'rgba(255, 165, 0, 0.1)');
              gradient.addColorStop(1, 'rgba(255, 165, 0, 0)');
              ctx.fillStyle = gradient;
              ctx.fillRect(0, 0, 512, 512);
              
              // Draw lock icon
              ctx.font = '48px Courier New, monospace';
              ctx.fillStyle = '#ffa500';
              ctx.textAlign = 'center';
              ctx.shadowColor = '#ffa500';
              ctx.shadowBlur = 10;
              ctx.fillText('🔐', 256, 140);
              
              // Verifying text
              ctx.font = 'bold 24px Courier New, monospace';
              ctx.fillText('VERIFYING CREDENTIALS', 256, 200);
              
              // Status messages
              ctx.font = '14px Courier New, monospace';
              ctx.fillStyle = '#00ff41';
              const messages = [
                'Checking authentication token...',
                'Validating user permissions...',
                'Accessing secure database...',
                'Decrypting clearance level...'
              ];
              
              // Animate typing effect for messages
              const currentTime = Date.now();
              const messageIndex = Math.floor((currentTime / 500) % messages.length);
              
              messages.forEach((msg, idx) => {
                if (idx <= messageIndex) {
                  ctx.fillText(msg, 256, 260 + (idx * 30));
                }
              });
              
              // Loading dots animation
              const dots = '.'.repeat((Math.floor(currentTime / 300) % 4));
              ctx.font = 'bold 20px Courier New, monospace';
              ctx.fillStyle = '#ffa500';
              ctx.fillText('Processing' + dots, 256, 420);
              
              // Scanlines effect
              for (let i = 0; i < 512; i += 4) {
                ctx.fillStyle = 'rgba(255, 165, 0, 0.02)';
                ctx.fillRect(0, i, 512, 2);
              }
              
              ctx.shadowBlur = 0;
              texture.needsUpdate = true;
              
              // Request animation frame to keep animating
              if (screenMode === 'verifying') {
                requestAnimationFrame(drawVerifyingScreen);
              }
            };
            
            // Draw access granted CRT screen
            const drawAccessGrantedScreen = () => {
              // Clear canvas with black background
              ctx.fillStyle = '#000000';
              ctx.fillRect(0, 0, 512, 512);
              
              // Draw CRT border effect with green
              ctx.strokeStyle = '#00ff41';
              ctx.lineWidth = 4;
              ctx.strokeRect(10, 10, 492, 492);
              
              // CRT glow effect with green tint
              const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 300);
              gradient.addColorStop(0, 'rgba(0, 255, 65, 0.2)');
              gradient.addColorStop(1, 'rgba(0, 255, 65, 0)');
              ctx.fillStyle = gradient;
              ctx.fillRect(0, 0, 512, 512);
              
              // Draw checkmark
              ctx.font = '64px Courier New, monospace';
              ctx.fillStyle = '#00ff41';
              ctx.textAlign = 'center';
              ctx.shadowColor = '#00ff41';
              ctx.shadowBlur = 20;
              ctx.fillText('✓', 256, 140);
              
              // Access granted text with glow
              ctx.font = 'bold 28px Courier New, monospace';
              ctx.shadowBlur = 15;
              ctx.fillText('ACCESS GRANTED', 256, 200);
              
              ctx.font = '16px Courier New, monospace';
              ctx.shadowBlur = 10;
              ctx.fillStyle = '#00ff41';
              ctx.fillText('LEVEL 5 CLEARANCE CONFIRMED', 256, 240);
              
              // Success messages
              ctx.font = '14px Courier New, monospace';
              ctx.shadowBlur = 5;
              const messages = [
                '> Authentication successful',
                '> Security protocols passed',
                '> ILLUMIN80 access authorized',
                '> Redirecting to secure area...'
              ];
              
              messages.forEach((msg, idx) => {
                ctx.fillText(msg, 256, 300 + (idx * 25));
              });
              
              // Flashing "WELCOME" text
              if (Math.floor(Date.now() / 500) % 2 === 0) {
                ctx.font = 'bold 20px Courier New, monospace';
                ctx.fillStyle = '#00ff41';
                ctx.shadowBlur = 20;
                ctx.fillText('[ WELCOME ]', 256, 420);
              }
              
              // Scanlines effect
              for (let i = 0; i < 512; i += 4) {
                ctx.fillStyle = 'rgba(0, 255, 65, 0.02)';
                ctx.fillRect(0, i, 512, 2);
              }
              
              ctx.shadowBlur = 0;
              texture.needsUpdate = true;
              
              // Keep animating if still in access-granted mode
              if (screenMode === 'access-granted') {
                requestAnimationFrame(drawAccessGrantedScreen);
              }
            };
            
            // Handle screen hover
            const handleScreenHover = (x, y) => {
              // Don't process hovers during animations
              if (screenMode === 'crt-terminal' || screenMode === 'verifying' || screenMode === 'access-granted') {
                return;
              }
              
              let newHoveredButton = null;
              
              // For token prompt, swap X coordinate due to rotation
              if (screenMode === 'token-prompt') {
                const swappedX = 512 - x;  // Mirror the X coordinate
                for (const area of clickAreas) {
                  if (swappedX >= area.x && swappedX <= area.x + area.width && 
                      y >= area.y && y <= area.y + area.height) {
                    newHoveredButton = area.button; // 'yes' or 'no'
                    console.log('Hovering over button:', area.button, 'swapped X:', swappedX);
                    break;
                  }
                }
              } else {
                // Check which button is being hovered (normal mode)
                for (const area of clickAreas) {
                  if (x >= area.x && x <= area.x + area.width && 
                      y >= area.y && y <= area.y + area.height) {
                    newHoveredButton = area.index !== undefined ? area.index : (area.action === 'activateTerminal' ? 0 : null);
                    break;
                  }
                }
              }
              
              // Only redraw if hover state changed
              if (newHoveredButton !== hoveredButton) {
                // Play hover sound when entering a button (but not during CRT animation)
                if (newHoveredButton !== null && hoveredButton === null && screenMode !== 'crt-terminal') {
                  // Clone and play to allow rapid hover sounds
                  sounds.hover.cloneNode(true).play().catch(err => {
                    console.log('Hover sound play failed:', err);
                  });
                }
                
                hoveredButton = newHoveredButton;
                const now = Date.now();
                if (now - lastRedrawTime > redrawThrottle) {
                  lastRedrawTime = now;
                  if (screenMode === 'navigation' || screenMode === 'post-video') {
                    drawNavigationScreen(hoveredButton);
                  } else if (screenMode === 'token-prompt') {
                    drawTokenPromptScreen();
                  }
                }
              }
            };
            
            // Handle screen clicks
            const handleScreenClick = (x, y) => {
              console.log('Screen click at:', x, y);
              console.log('Screen mode:', screenMode);
              console.log('Available click areas:', clickAreas.length);
              
              // Check terminal button in navigation or post-video mode (for replay)
              if (screenMode === 'navigation' || screenMode === 'post-video') {
                const terminalArea = clickAreas.find(area => area.action === 'activateTerminal');
                if (terminalArea && 
                    x >= terminalArea.x && x <= terminalArea.x + terminalArea.width && 
                    y >= terminalArea.y && y <= terminalArea.y + terminalArea.height) {
                  
                  console.log('Clicked TERMINAL button area:', terminalArea);
                  console.log('Activating CRT Terminal');
                  
                  // Play accept sound for terminal activation
                  sounds.accept.cloneNode(true).play().catch(err => {
                    console.log('Accept sound play failed:', err);
                  });
                  
                  screenMode = 'crt-terminal';
                  startCRTTerminal();
                  return; // Exit early
                }
              }
              
              // Handle token prompt clicks
              if (screenMode === 'token-prompt') {
                const swappedX = 512 - x;  // Mirror the X coordinate due to rotation
                console.log('Token prompt click at original X:', x, 'swapped X:', swappedX, 'Y:', y);
                console.log('Available click areas:', clickAreas);
                
                for (const area of clickAreas) {
                  console.log('Checking area:', area.button, 'at', area.x, area.y, 'to', area.x + area.width, area.y + area.height);
                  if (swappedX >= area.x && swappedX <= area.x + area.width && 
                      y >= area.y && y <= area.y + area.height) {
                    
                    console.log('Clicked on button:', area.button, 'with action:', area.action);
                    
                    if (area.action === 'buyTokens') {
                      console.log('User clicked YES to buy RL80 tokens');
                      // Play accept sound
                      sounds.accept.cloneNode(true).play().catch(() => {});
                      
                      // Open the buy modal
                      if (onOpenBuyModal) {
                        onOpenBuyModal();
                      }
                      
                      // Return to navigation screen
                      setTimeout(() => {
                        screenMode = 'post-video';
                        drawPostVideoScreen();
                      }, 500);
                      
                    } else if (area.action === 'declineTokens') {
                      console.log('User clicked NO to buying RL80 tokens');
                      // Play reject sound
                      sounds.reject.cloneNode(true).play().catch(() => {});
                      
                      // Return to navigation screen
                      setTimeout(() => {
                        screenMode = 'post-video';
                        drawPostVideoScreen();
                      }, 500);
                    }
                    return;
                  }
                }
              }
              
              // Check other areas
              for (const area of clickAreas) {
                console.log('Checking area:', area);
                if (x >= area.x && x <= area.x + area.width && 
                    y >= area.y && y <= area.y + area.height) {
                  
                  console.log('Clicked area action:', area.action, area.url);
                  
                  if (area.action === 'navigate' && area.url) {
                    console.log('Navigating to:', area.url);
                    // Play accept sound for navigation
                    sounds.accept.cloneNode(true).play().catch(err => {
                      console.log('Accept sound play failed:', err);
                    });
                    // Small delay to let sound play before navigation
                    setTimeout(() => {
                      window.location.href = area.url;
                    }, 200);
                  } else if (area.action === 'openBuyModal') {
                    console.log('Opening Buy Modal');
                    // Play accept sound
                    sounds.accept.cloneNode(true).play().catch(err => {
                      console.log('Accept sound play failed:', err);
                    });
                    // Call the prop function to open the modal
                    if (onOpenBuyModal) {
                      onOpenBuyModal();
                    }
                  } else if (area.action === 'checkAccess') {
                    console.log('Checking access for ILLUMIN80');
                    // Check if user is authenticated
                    const isAuthenticated = isSignedIn;
                    
                    if (isAuthenticated) {
                      // User is logged in, show verifying screen then access granted
                      sounds.accept.cloneNode(true).play().catch(() => {});
                      screenMode = 'verifying';
                      drawVerifyingScreen();
                      
                      // After 2 seconds, show access granted
                      setTimeout(() => {
                        screenMode = 'access-granted';
                        drawAccessGrantedScreen();
                        
                        // After another 2 seconds, navigate to gallery
                        setTimeout(() => {
                          window.location.href = area.url;
                        }, 2000);
                      }, 2000);
                    } else {
                      // User is not logged in, show access denied
                      sounds.reject.cloneNode(true).play().catch(() => {});
                      screenMode = 'access-denied';
                      drawAccessDeniedScreen();
                    }
                  } else if (area.action === 'returnToNav') {
                    console.log('Returning to navigation');
                    sounds.accept.cloneNode(true).play().catch(() => {});
                    screenMode = 'navigation';
                    hoveredButton = null; // Reset hover state when returning
                    // Reset canvas context to clear any lingering styles
                    ctx.save();
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                    ctx.restore();
                    drawNavigationScreen();
                  } else if (area.action === 'replay') {
                    console.log('Replaying CRT terminal');
                    // Play accept sound for replay
                    sounds.accept.cloneNode(true).play().catch(err => {
                      console.log('Accept sound play failed:', err);
                    });
                    screenMode = 'crt-terminal';
                    startCRTTerminal();
                  } else if (area.action === 'stopVideo') {
                    console.log('Stopping video, returning to navigation');
                    // Play reject/back sound for stopping video
                    sounds.reject.cloneNode(true).play().catch(err => {
                      console.log('Reject sound play failed:', err);
                    });
                    // Clean up video if reference exists
                    if (area.video) {
                      area.video.pause();
                      // Don't clear src as it causes an error, just pause is enough
                      area.video.removeAttribute('src');
                      area.video.load();
                    }
                    screenMode = 'navigation';
                    drawNavigationScreen();
                  } else if (area.action === 'playVideo' && area.video) {
                    console.log('Playing video:', area.video);
                    // Play special accept sound for video
                    sounds.accept.cloneNode(true).play().catch(err => {
                      console.log('Accept sound play failed:', err);
                    });
                    // Create and play video
                    const video = document.createElement('video');
                    video.src = area.video;
                    video.autoplay = true;
                    video.muted = true;
                    video.playsInline = true;
                    
                    // Store video reference for cleanup
                    let currentVideo = video;
                    
                    video.addEventListener('loadeddata', () => {
                      console.log('Video loaded, playing on screen');
                      screenMode = 'video';
                      
                      // Set click areas for video mode (back button in bottom area)
                      // Place it at the bottom to test if rotation is the issue
                      clickAreas = [
                        { 
                          x: 156,  // Center horizontally
                          y: 400,  // Near bottom
                          width: 200, 
                          height: 80, 
                          action: 'stopVideo',
                          video: currentVideo  // Store reference for cleanup
                        }
                      ];
                      
                      // Draw video to canvas
                      const drawVideo = () => {
                        if (!currentVideo || currentVideo.paused || currentVideo.ended || screenMode !== 'video') {
                          console.log('Video ended or stopped, returning to navigation');
                          if (currentVideo) {
                            currentVideo.pause();
                            // Properly clean up video without causing errors
                            currentVideo.removeAttribute('src');
                            currentVideo.load();
                            currentVideo = null;
                          }
                          screenMode = 'navigation';
                          drawNavigationScreen();
                          return;
                        }
                        
                        // Draw video frame
                        ctx.drawImage(video, 0, 0, 512, 512);
                        
                        // Draw back button overlay at bottom center
                        ctx.save();
                        
                        // Button background with cyberpunk style - bottom center position
                        const btnX = 156;
                        const btnY = 400;
                        const btnWidth = 200;
                        const btnHeight = 80;
                        const cornerSize = 10;
                        
                        ctx.beginPath();
                        ctx.moveTo(btnX, btnY);
                        ctx.lineTo(btnX + btnWidth, btnY);
                        ctx.lineTo(btnX + btnWidth, btnY + btnHeight - cornerSize);
                        ctx.lineTo(btnX + btnWidth - cornerSize, btnY + btnHeight);
                        ctx.lineTo(btnX, btnY + btnHeight);
                        ctx.closePath();
                        
                        // Semi-transparent background
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                        ctx.fill();
                        
                        // Border
                        ctx.strokeStyle = '#72bfbe';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                        
                        // Back arrow and text - larger
                        ctx.fillStyle = '#72bfbe';
                        ctx.font = 'bold 18px Courier New';
                        ctx.textAlign = 'center';
                        ctx.fillText('◄ BACK', btnX + btnWidth/2, btnY + btnHeight/2 + 6);
                        
                        ctx.restore();
                        
                        texture.needsUpdate = true;
                        
                        if (screenMode === 'video') {
                          requestAnimationFrame(drawVideo);
                        }
                      };
                      
                      video.play().then(() => {
                        drawVideo();
                      }).catch(err => {
                        console.error('Video play error:', err);
                        screenMode = 'navigation';
                        drawNavigationScreen();
                      });
                    });
                    
                    video.addEventListener('error', (err) => {
                      console.error('Video error:', err);
                      screenMode = 'navigation';
                      drawNavigationScreen();
                    });
                    
                    video.addEventListener('ended', () => {
                      console.log('Video playback complete');
                      screenMode = 'navigation';
                      drawNavigationScreen();
                    });
                  }
                  break;
                }
              }
            };
            
            // No video event listeners needed for CRT terminal
            
            // Apply canvas texture to screen material
            const material = new THREE.MeshBasicMaterial({
              map: texture,
              color: 0xffffff,
              transparent: false,
              opacity: 1.0
            });
            
            object.material = material;
            
            // Ensure object is raycastable
            object.raycast = THREE.Mesh.prototype.raycast;
            object.visible = true;
            
            // console.log('Applied interactive screen material to Screen1');
            // console.log('Screen1 setup complete - name:', object.name, 'visible:', object.visible, 'geometry:', !!object.geometry);
            
            // Update texture in render loop
            object.userData.updateTexture = () => {
              if (screenMode === 'crt-terminal') {
                // CRT terminal draws directly to canvas, just ensure texture updates
                drawCRTTerminal();
              } else if (screenMode === 'navigation' && hoveredButton !== null) {
                // Redraw with animation for hover effects
                const now = Date.now();
                if (now - lastRedrawTime > redrawThrottle) {
                  lastRedrawTime = now;
                  drawNavigationScreen(hoveredButton);
                }
              } else if (screenMode === 'token-prompt') {
                // Keep the token prompt screen updated with hover effects
                drawTokenPromptScreen();
              }
            };
            
            // Store handlers with approach progress check
            object.userData.handleClickOriginal = handleScreenClick;
            object.userData.handleHoverOriginal = handleScreenHover;
            object.userData.approachProgress = 0; // Initialize approach progress
            
            // Wrapped handlers that check if drone is close enough
            object.userData.handleClick = (x, y) => {
              if (object.userData.approachProgress >= 0.8) {
                handleScreenClick(x, y);
              }
            };
            object.userData.handleHover = (x, y) => {
              if (object.userData.approachProgress >= 0.8) {
                handleScreenHover(x, y);
              } else {
                // Clear hover when not interactive
                handleScreenHover(-1, -1);
              }
            };
            
            // Store references for cleanup
            object.userData.texture = texture;
            object.userData.canvas = canvas;
            object.userData.terminalAnimation = terminalAnimation;
            
            // Store draw function for later updates
            object.userData.drawNavigationScreen = drawNavigationScreen;
            
            // Draw initial screen
            drawNavigationScreen();
          }
        }
        // Disable shadows
        if (object.isMesh) {
          object.castShadow = false;
          object.receiveShadow = false;
        }
      });
      
      if (!screenFound) {
        // console.log('⚠️ Screen1 not found in drone model!');
        // console.log('Looking for any mesh that could be a screen...');
        scene.traverse((object) => {
          if (object.isMesh && (object.name.toLowerCase().includes('screen') || 
                                object.name.toLowerCase().includes('display') ||
                                object.name.toLowerCase().includes('panel'))) {
            // console.log('Possible screen mesh:', object.name);
            // Use this as fallback
            screenRef.current = object;
            window.globalScreenMesh = object;
            if (groupRef.current) {
              window.globalDroneGroup = groupRef.current;
            }
          }
        });
      }
      
      // Set up hover animation
      if (animations && animations.length > 0) {
        // console.log('Drone animations:', animations.map(clip => clip.name));
        mixerRef.current = new THREE.AnimationMixer(scene);
        
        // Find the hover animation
        const hoverAnimation = animations.find(clip => 
          clip.name === 'hover' || 
          clip.name.toLowerCase().includes('hover')
        );
        
        if (hoverAnimation) {
          // console.log('Playing drone hover animation:', hoverAnimation.name);
          const action = mixerRef.current.clipAction(hoverAnimation);
          action.reset();
          action.play();
          action.setLoop(THREE.LoopRepeat);
        } else if (animations.length > 0) {
          // Play first animation if hover not found
          // console.log('Playing first drone animation');
          const action = mixerRef.current.clipAction(animations[0]);
          action.reset();
          action.play();
          action.setLoop(THREE.LoopRepeat);
        }
      }
    }
  }, [scene, animations]);
  
  // Cleanup
  useEffect(() => {
    const currentScene = scene;
    const currentMixer = mixerRef.current;
    return () => {
      if (currentMixer) {
        currentMixer.stopAllAction();
        currentMixer.uncacheRoot(currentScene);
      }
      if (currentScene) {
        currentScene.traverse((object) => {
          // Clear screen interval if exists
          if (object.userData.screenInterval) {
            clearInterval(object.userData.screenInterval);
          }
          // Clean up terminal animation
          if (object.userData.terminalAnimation) {
            clearTimeout(object.userData.terminalAnimation);
          }
          // Clean up canvas texture
          if (object.userData.texture) {
            object.userData.texture.dispose();
          }
          if (object.userData.canvas) {
            object.userData.canvas.width = 0;
            object.userData.canvas.height = 0;
          }
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            const materials = Array.isArray(object.material) 
              ? object.material : [object.material];
            materials.forEach(mat => {
              if (mat.map) mat.map.dispose();
              if (mat.normalMap) mat.normalMap.dispose();
              if (mat.roughnessMap) mat.roughnessMap.dispose();
              if (mat.metalnessMap) mat.metalnessMap.dispose();
              if (mat.aoMap) mat.aoMap.dispose();
              if (mat.emissiveMap) mat.emissiveMap.dispose();
              mat.dispose();
            });
          }
        });
      }
    };
  }, [scene]);
  
  // Update language in screen object when it changes
  useEffect(() => {
    if (screenRef.current) {
      screenRef.current.userData.language = language;
      // Redraw the current screen with new language
      if (screenRef.current.userData.updateTexture) {
        screenRef.current.userData.updateTexture();
      }
    }
  }, [language]);
  
  // Update animation and handle scroll-based appearance
  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
    
    // Update video texture
    if (screenRef.current && screenRef.current.userData.updateTexture) {
      screenRef.current.userData.updateTexture();
    }
    
    if (groupRef.current) {
      // Drone appears at 35% of page scroll
      const appearProgress = 0.35;
      const approachDuration = 0.30; // Approach takes 30% of total scroll
      
      if (scrollProgress < appearProgress - 0.02) {
        // Hide drone well before threshold to prepare for approach
        groupRef.current.visible = false;
        hasAppearedRef.current = false;
      } else {
        // Start showing drone a bit before the threshold for smooth approach
        groupRef.current.visible = true;
        
        // Calculate raw approach progress
        const rawProgress = (scrollProgress - (appearProgress - 0.02)) / approachDuration;
        
        // Split the animation into two phases:
        // Phase 1 (0-0.3): Vertical rise from below
        // Phase 2 (0.3-1.0): Forward approach
        const risePhaseEnd = 0.3; // First 30% is vertical rise
        
        // Apply dramatic slowdown effect during drone approach
        // This makes it feel like scrolling through thick air/resistance
        let approachProgress;
        if (rawProgress < 0.3) {
          // Initial phase: very slow progress (heavy resistance)
          approachProgress = rawProgress * 0.5; // Moves at 50% speed
        } else if (rawProgress < 0.6) {
          // Middle phase: slightly faster but still slow
          approachProgress = 0.15 + (rawProgress - 0.3) * 1.5; // Gradually speeds up
        } else if (rawProgress < 0.9) {
          // Approaching phase: normal speed
          approachProgress = 0.6 + (rawProgress - 0.6) * 1.2;
        } else {
          // Final approach: slight slowdown for dramatic finish
          approachProgress = 0.96 + (rawProgress - 0.9) * 0.4;
        }
        
        // Clamp to 0-1 range
        approachProgress = Math.min(Math.max(approachProgress, 0), 1);
        
        // Update screen's approach progress for click handling
        if (screenRef.current) {
          const prevProgress = screenRef.current.userData.approachProgress || 0;
          screenRef.current.userData.approachProgress = approachProgress;
          
          // Handle boot animation based on scroll progress
          // Boot animation happens between 80% and 90% approach progress
          const bootStartProgress = 0.8;
          const bootEndProgress = 0.9;
          
          if (approachProgress < bootStartProgress) {
            // Screen is off
            screenRef.current.userData.isPoweringOn = false;
            screenRef.current.userData.bootProgress = 0;
            screenRef.current.userData.screenDrawn = false;
            if (screenRef.current.userData.drawNavigationScreen) {
              screenRef.current.userData.drawNavigationScreen();
            }
          } else if (approachProgress >= bootStartProgress && approachProgress < bootEndProgress) {
            // Screen is booting - progress tied to scroll
            screenRef.current.userData.isPoweringOn = true;
            // Calculate boot progress (0 to 1) based on scroll position
            const bootRange = bootEndProgress - bootStartProgress;
            const bootProgress = (approachProgress - bootStartProgress) / bootRange;
            screenRef.current.userData.bootProgress = Math.max(0, Math.min(1, bootProgress));
            
            if (screenRef.current.userData.drawNavigationScreen) {
              screenRef.current.userData.drawNavigationScreen();
            }
          } else if (approachProgress >= bootEndProgress) {
            // Screen is fully booted
            screenRef.current.userData.isPoweringOn = false;
            screenRef.current.userData.bootProgress = 1;
            if (!screenRef.current.userData.screenDrawn) {
              if (screenRef.current.userData.drawNavigationScreen) {
                screenRef.current.userData.drawNavigationScreen();
                screenRef.current.userData.screenDrawn = true;
              }
            }
          }
        }
        
        // Calculate progress for each phase
        const riseProgress = Math.min(approachProgress / risePhaseEnd, 1);
        const forwardProgress = Math.max((approachProgress - risePhaseEnd) / (1 - risePhaseEnd), 0);
        
        // Smooth easing for each phase
        const easedRiseProgress = 1 - Math.pow(1 - riseProgress, 3); // Cubic ease-out for rise
        const easedForwardProgress = 1 - Math.pow(1 - forwardProgress, 3); // Cubic ease-out for forward approach
        
        // During approach, drone stays centered in viewport
        // Only after fully approached does it move with the scene
        let scrolledY;
        const finalDroneY = 5; // Higher up in viewport for better centering
        
        if (approachProgress < 1) {
          // During approach: drone approaches its final viewport position
          scrolledY = finalDroneY; // Approach to higher position
        } else {
          // After approach: move with the scene normally
          // Calculate the position the drone should be at when it starts moving with the scene
          // This should match where it was at the end of the approach
          const scrollProgressAtApproachEnd = appearProgress - 0.02 + approachDuration;
          const baseY = finalDroneY - (scrollProgressAtApproachEnd * 350);
          scrolledY = baseY + scrollProgress * 350;
        }
        
        // Debug log to see where it is
        // if (scrollY > 1400 && scrollY < 1600) {
        //   console.log('Drone position calc:', {
        //     baseY,
        //     scrolledY,
        //     scrollY,
        //     approachProgress,
        //     easedProgress,
        //     visible: groupRef.current.visible
        //   });
        // }
        
        // Approach animation with two phases: vertical rise, then forward approach
        
        // Z position: gradually moves back during rise, then comes forward during approach
        const endZ = position[2] || -5; // Final Z position (close)
        const farZ = -30; // Far position to approach from
        
        // Smoothly transition Z position through both phases
        // During rise: gradually move from close to far
        // During forward: move from far back to close
        const currentZ = riseProgress < 1
          ? endZ + (farZ - endZ) * easedRiseProgress  // Move away during rise
          : farZ + (endZ - farZ) * easedForwardProgress; // Come back during approach
        
        // Y position: rises from below, then maintains height during forward approach
        const startYOffset = -25; // Starts 25 units below viewport
        const yRiseOffset = startYOffset * (1 - easedRiseProgress); // Rise animation
        const yApproachOffset = 0; // No additional Y movement during forward approach
        const totalYOffset = yRiseOffset + yApproachOffset;
        
        // Scale: continuously grows through both phases
        // Start small, reach medium size at end of rise, then grow to full size during approach
        const baseScale = 0.3; // Starting scale
        const midScale = 0.6;  // Scale at transition between rise and approach
        const finalScale = 1.7; // Final scale
        
        const approachScale = riseProgress < 1 
          ? baseScale + (midScale - baseScale) * easedRiseProgress  // Rise: 0.3 to 0.6
          : midScale + (finalScale - midScale) * easedForwardProgress; // Approach: 0.6 to 1.7
        
        // Final Y position with floating
        const time = state.clock.getElapsedTime();
        if (approachProgress >= 1) {
          // Fully appeared - add floating animation
          groupRef.current.position.y = scrolledY + Math.sin(time * 0.5) * 0.3;
          groupRef.current.rotation.y = Math.sin(time * 0.3) * 0.1;
          groupRef.current.position.z = endZ;
          groupRef.current.scale.setScalar(finalScale); // Use final approach scale to avoid jump
        } else {
          // During approach (both rise and forward phases)
          groupRef.current.position.y = scrolledY + totalYOffset;
          groupRef.current.rotation.y = 0;
          groupRef.current.position.z = currentZ;
          groupRef.current.scale.setScalar(approachScale);
        }
        
        // Keep X position fixed with slight sway during approach
        if (approachProgress < 1) {
          // Add subtle horizontal sway during approach
          groupRef.current.position.x = position[0] + Math.sin(approachProgress * Math.PI * 2) * 2;
        } else {
          groupRef.current.position.x = position[0];
        }
      }
    }
  });
  
  
  return (
    <group ref={groupRef} position={position}>
      <primitive 
        object={scene} 
        scale={[2, 2, 2]}
        rotation={[0, Math.PI, 0]}
      />
    </group>
  );
});

// Angel Model component with scroll-based swoop animation
const AngelModel = React.memo(function AngelModel({ position = [0, 0, 10], scrollY, scrollProgress, isMobile = false, isTabletPortrait = false, isTabletLandscape = false, is80sMode = false }) {
  // Load Pac-Man in 80s mode, angel otherwise
  const modelPath = is80sMode ? '/models/pacMan.glb' : '/models/angel2.glb';
  const { scene, animations } = useGLTF(modelPath);
  const groupRef = useRef();
  const mixerRef = useRef();

  // Create animation mixer
  useEffect(() => {
    if (animations && animations.length > 0) {
      mixerRef.current = new THREE.AnimationMixer(scene);
      
      if (is80sMode) {
        // For Pac-Man model, play both animations
        const eatingAnimation = animations.find(clip => clip.name === 'Eating');
        const ghostAnimation = animations.find(clip => clip.name === 'Animation');
        
        if (eatingAnimation) {
          const eatingAction = mixerRef.current.clipAction(eatingAnimation);
          eatingAction.setLoop(THREE.LoopRepeat);
          eatingAction.play();
        }
        
        if (ghostAnimation) {
          const ghostAction = mixerRef.current.clipAction(ghostAnimation);
          ghostAction.setLoop(THREE.LoopRepeat);
          ghostAction.play();
        }
      } else {
        // For Angel model, play its animations
        const idleAnimation = animations.find(clip => clip.name === 'Armature|Idle');
        const sceneAnimation = animations.find(clip => clip.name === 'Scene');
        
        if (idleAnimation) {
          const idleAction = mixerRef.current.clipAction(idleAnimation);
          idleAction.setLoop(THREE.LoopRepeat);
          idleAction.play();
        }
        
        if (sceneAnimation) {
          const sceneAction = mixerRef.current.clipAction(sceneAnimation);
          sceneAction.setLoop(THREE.LoopRepeat);
          sceneAction.play();
        }
      }
    }

    return () => {
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
    };
  }, [animations, scene, is80sMode]);

  // Animation constants - using scroll progress percentages
  // First appearance: 10% to 30% of page scroll
  const appearProgress = 0.10;
  const exitProgress = 0.30;
  const duration = exitProgress - appearProgress;
  
  // Second appearance for chase sequence: 85% to 95% of page scroll
  const chaseAppearProgress = 0.85;
  const chaseExitProgress = 0.95;
  const chaseDuration = chaseExitProgress - chaseAppearProgress;
  
  // Flight stages (as percentage of total scroll duration)
  const swoopInDuration = 0.25;    // 25% - swoop in from right
  const flyAcrossDuration = 0.3;   // 30% - fly across to left side  
  const spinDuration = 0.2;        // 20% - spin 180 degrees
  const pauseDuration = 0.15;      // 15% - brief pause
  const swoopOutDuration = 0.1;    // 10% - swoop out toward viewer
  
  // Update animation mixer and handle scroll-based movement
  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
    
    if (groupRef.current) {
      const time = state.clock.elapsedTime;
      
      // Calculate scroll-based visibility and movement using progress
      const inFirstSequence = scrollProgress >= appearProgress && scrollProgress <= exitProgress;
      const inChaseSequence = scrollProgress >= chaseAppearProgress && scrollProgress <= chaseExitProgress;
      
      if (!inFirstSequence && !inChaseSequence) {
        groupRef.current.visible = false;
        return;
      }
      
      groupRef.current.visible = true;
      
      // Determine which sequence we're in and calculate progress
      let overallProgress;
      let isChasing = false;
      
      if (inChaseSequence) {
        // Chase sequence - angel chases devil
        isChasing = true;
        overallProgress = (scrollProgress - chaseAppearProgress) / chaseDuration;
      } else {
        // Original sequence
        overallProgress = (scrollProgress - appearProgress) / duration;
      }
      
      // Determine which flight stage we're in
      let stage, stageProgress;
      let baseX, baseY, baseZ, rotationY, rotationX, scale;
      
      // Pac-Man mode: Simple crossing animation
      if (is80sMode) {
        if (isChasing) {
          // Second appearance: simple left-to-right crossing (chase)
          const startX = -15;
          const endX = 15;
          baseX = startX + (endX - startX) * overallProgress;
          baseY = isMobile ? 3 : 4;
          baseZ = 0;
          rotationY = Math.PI * 0.5; // Face right for chase
          rotationX = 0;
          scale = isMobile ? 1.5 : 2;
        } else {
          // First appearance: simple right-to-left crossing
          const startX = 15;
          const endX = -15;
          baseX = startX + (endX - startX) * overallProgress;
          baseY = isMobile ? 3 : 4;
          baseZ = 0;
          rotationY = -Math.PI * 0.5; // Face left
          rotationX = 0;
          scale = isMobile ? 1.5 : 2;
        }
      } else if (isChasing) {
        // Chase sequence animation
        if (overallProgress < 0.3) {
          // Stage 1: Angel swoops in from left, pauses when seeing devil
          stage = 'chaseEntry';
          stageProgress = overallProgress / 0.3;
          const easedProgress = 1 - Math.pow(1 - stageProgress, 2);
          
          const startX = isMobile ? -10 : -15;
          const startY = isMobile ? 6 : 8;
          const startZ = 6;
          const endX = isMobile ? -3 : -5;
          const endY = isMobile ? 5 : 7;
          const endZ = 3;
          
          baseX = startX + (endX - startX) * easedProgress;
          baseY = startY + (endY - startY) * easedProgress;
          baseZ = startZ + (endZ - startZ) * easedProgress;
          rotationY = Math.PI * 0.3; // Looking toward devil
          rotationX = 0; // No lean during entry
          scale = isMobile ? 2 : 2;
          
        } else if (overallProgress < 0.5) {
          // Stage 2: Brief pause, looking at devil with surprise
          stage = 'chasePause';
          stageProgress = (overallProgress - 0.3) / 0.2;
          
          baseX = isMobile ? -3 : -5;
          baseY = (isMobile ? 5 : 7) + Math.sin(time * 4) * 0.15; // Agitated hovering
          baseZ = 3;
          rotationY = Math.PI * 0.4 + Math.sin(time * 3) * 0.1; // Looking at devil with slight head movement
          rotationX = Math.PI * 0.05; // Slight forward lean as it prepares to chase
          scale = isMobile ? 2 : 2;
          
        } else {
          // Stage 3: Chase the devil off screen to the right
          stage = 'chaseChase';
          stageProgress = (overallProgress - 0.5) / 0.5;
          const easedProgress = Math.pow(stageProgress, 1.5); // Accelerating chase
          
          const startX = isMobile ? -3 : -5;
          const startY = isMobile ? 5 : 7;
          const startZ = 3;
          const endX = isMobile ? 28 : 30;
          const endY = isMobile ? 4 : 6;
          const endZ = -2; // Slight toward viewer like devil
          
          baseX = startX + (endX - startX) * easedProgress;
          baseY = startY + (endY - startY) * easedProgress + Math.sin(time * 3) * 0.3; // Wing beat
          baseZ = startZ + (endZ - startZ) * easedProgress;
          rotationY = Math.PI * 0.1 + Math.sin(time * 2) * 0.15; // Determined chase angle
          rotationX = Math.PI * 0.15 * (1 + easedProgress * 0.5); // Forward lean that increases with speed
          scale = (isMobile ? 2 : 2) * (1 + easedProgress * 0.8); // Getting bigger as it approaches viewer
        }
        
      } else if (overallProgress < swoopInDuration) {
        // Stage 1: Swoop in from right side
        stage = 'swoopIn';
        stageProgress = overallProgress / swoopInDuration;
        const easedProgress = 1 - Math.pow(1 - stageProgress, 3); // Ease-out cubic
        
        const startX = isMobile ? 8 : 12;
        const startY = isMobile ? 6 : 8;
        const startZ = 6;
        const endX = isMobile ? 2 : 4;
        const endY = isMobile ? 4 : 6;
        const endZ = 2;
        
        // Arc motion during swoop
        const arcHeight = 1.5;
        const yOffset = Math.sin(stageProgress * Math.PI) * arcHeight;
        
        baseX = startX + (endX - startX) * easedProgress;
        baseY = startY + (endY - startY) * easedProgress + yOffset;
        baseZ = startZ + (endZ - startZ) * easedProgress;
        rotationY = -Math.PI * 0.3; // Slight angle toward center
        rotationX = 0; // No lean during original sequence
        scale = isMobile ? 2 : 2;
        
      } else if (overallProgress < swoopInDuration + flyAcrossDuration) {
        // Stage 2: Fly across to left side
        stage = 'flyAcross';
        stageProgress = (overallProgress - swoopInDuration) / flyAcrossDuration;
        const easedProgress = stageProgress; // Linear movement for crossing
        
        const startX = isMobile ? 2 : 4;
        const startY = isMobile ? 4 : 6;
        const endX = isMobile ? -4 : -6;
        const endY = isMobile ? 5 : 7;
        
        baseX = startX + (endX - startX) * easedProgress;
        baseY = startY + (endY - startY) * easedProgress + Math.sin(time * 2) * 0.3; // Wing flutter
        baseZ = 2 + Math.sin(easedProgress * Math.PI * 2) * 0.5; // Gentle depth wave
        rotationY = -Math.PI * 0.2 + Math.sin(time * 1.5) * 0.1; // Flight banking
        rotationX = 0; // No lean during original sequence
        scale = isMobile ? 2 : 2;
        
      } else if (overallProgress < swoopInDuration + flyAcrossDuration + spinDuration) {
        // Stage 3: Spin 1.5 rotations (540 degrees)
        stage = 'spin';
        stageProgress = (overallProgress - swoopInDuration - flyAcrossDuration) / spinDuration;
        const easedSpin = stageProgress < 0.5 ? 
          2 * stageProgress * stageProgress : 
          -1 + (4 - 2 * stageProgress) * stageProgress; // Ease in-out
        
        baseX = isMobile ? -4 : -6;
        baseY = isMobile ? 5 : 7;
        baseZ = 2;
        rotationY = -Math.PI * 0.2 + (Math.PI * 2.5 * easedSpin); // 1.25 rotations, ends facing viewer
        rotationX = 0; // No lean during original sequence
        scale = isMobile ? 2 : 2;
        
      } else if (overallProgress < swoopInDuration + flyAcrossDuration + spinDuration + pauseDuration) {
        // Stage 4: Brief pause
        stage = 'pause';
        stageProgress = (overallProgress - swoopInDuration - flyAcrossDuration - spinDuration) / pauseDuration;
        
        baseX = isMobile ? -4 : -6;
        baseY = isMobile ? 5 : 7 + Math.sin(time * 3) * 0.2; // Gentle hover
        baseZ = 2;
        rotationY = Math.PI * 0.3 + Math.sin(time * 2) * 0.05; // Facing viewer with slight hover rotation
        rotationX = 0; // No lean during original sequence
        scale = isMobile ? 2 : 2;
        
      } else {
        // Stage 5: Swoop out toward viewer
        stage = 'swoopOut';
        stageProgress = (overallProgress - swoopInDuration - flyAcrossDuration - spinDuration - pauseDuration) / swoopOutDuration;
        const easedOut = Math.pow(stageProgress, 2); // Ease-in for acceleration
        
        const startX = isMobile ? -4 : -6;
        const startY = isMobile ? 5 : 7;
        const startZ = 2;
        const endX = isMobile ? 2 : 22;
        const endY = isMobile ? 3 : 4;
        const endZ = -3; // Move toward viewer
        
        baseX = startX + (endX - startX) * easedOut;
        baseY = startY + (endY - startY) * easedOut;
        baseZ = startZ + (endZ - startZ) * easedOut;
        rotationY = Math.PI * 0.8 + (Math.PI * 0.4 * easedOut); // Continue turning toward viewer
        rotationX = 0; // No lean during original sequence
        scale = (isMobile ? 2 : 2) * (1 + easedOut * 1.5); // Get bigger as it approaches
      }
      
      // Apply position, rotation, and scale
      groupRef.current.position.set(baseX, baseY, baseZ);
      groupRef.current.rotation.x = rotationX; // Forward lean for chase
      groupRef.current.rotation.y = rotationY;
      groupRef.current.rotation.z = is80sMode ? 0 : Math.sin(time * 0.8) * 0.1; // Wing tilt only for angel
      groupRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <primitive 
        object={scene} 
        scale={isMobile ? [1.5, 1.5, 1.5] : [1.5, 1.5, 1.5]}
      />
    </group>
  );
});

// Devil Model component with scroll-based swoop animation (appears at end of page)
const DevilModel = React.memo(function DevilModel({ position = [0, 0, 10], scrollY, scrollProgress, isMobile = false, isTabletPortrait = false, isTabletLandscape = false, is80sMode = false }) {
  // Load Pac-Man in 80s mode, devil otherwise
  const modelPath = is80sMode ? '/models/pacMan.glb' : '/models/devil2.glb';
  const { scene, animations } = useGLTF(modelPath);
  const groupRef = useRef();
  const mixerRef = useRef();

  // Create animation mixer
  useEffect(() => {
    if (animations && animations.length > 0) {
      mixerRef.current = new THREE.AnimationMixer(scene);
      
      if (is80sMode) {
        // For Pac-Man model, play both animations
        const eatingAnimation = animations.find(clip => clip.name === 'Eating');
        const ghostAnimation = animations.find(clip => clip.name === 'Animation');
        
        if (eatingAnimation) {
          const eatingAction = mixerRef.current.clipAction(eatingAnimation);
          eatingAction.setLoop(THREE.LoopRepeat);
          eatingAction.play();
        }
        
        if (ghostAnimation) {
          const ghostAction = mixerRef.current.clipAction(ghostAnimation);
          ghostAction.setLoop(THREE.LoopRepeat);
          ghostAction.play();
        }
      } else {
        // For Angel model, play its animations
        const idleAnimation = animations.find(clip => clip.name === 'Armature|Idle');
        const sceneAnimation = animations.find(clip => clip.name === 'Scene');
        
        if (idleAnimation) {
          const idleAction = mixerRef.current.clipAction(idleAnimation);
          idleAction.setLoop(THREE.LoopRepeat);
          idleAction.play();
        }
        
        if (sceneAnimation) {
          const sceneAction = mixerRef.current.clipAction(sceneAnimation);
          sceneAction.setLoop(THREE.LoopRepeat);
          sceneAction.play();
        }
      }
    }

    return () => {
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
    };
  }, [animations, scene, is80sMode]);

  // Animation constants - using scroll progress percentages
  // Devil appears near end of page: 80% to 90% of scroll
  const appearProgress = 0.80;
  const exitProgress = 0.90;
  const totalDuration = exitProgress - appearProgress;
  
  // Flight stages (as percentage of total scroll duration)
  const swoopInDuration = 0.25;    // 25% - swoop in from left 
  const flyAcrossDuration = 0.3;   // 30% - fly across to right side  
  const spinDuration = 0.2;        // 20% - spin 180 degrees
  const pauseDuration = 0.15;      // 15% - brief pause
  const swoopOutDuration = 0.1;    // 10% - swoop out toward viewer
  
  // Update animation mixer and handle scroll-based movement
  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
    
    if (groupRef.current) {
      const time = state.clock.elapsedTime;
      
      // Calculate scroll-based visibility and movement using progress
      if (scrollProgress < appearProgress || scrollProgress > exitProgress) {
        groupRef.current.visible = false;
        return;
      }
      
      groupRef.current.visible = true;
      
      // Calculate overall progress (0 to 1) through the flight sequence
      const overallProgress = (scrollProgress - appearProgress) / totalDuration;
      
      // Determine which flight stage we're in
      let stage, stageProgress;
      let baseX, baseY, baseZ, rotationY, scale;
      
      // Pac-Man mode: Simple crossing animation
      if (is80sMode) {
        // Simple right-to-left crossing (ghosts chasing Pac-Man)
        const startX = 15;
        const endX = -15;
        baseX = startX + (endX - startX) * overallProgress;
        baseY = isMobile ? 3 : 4;
        baseZ = 0;
        rotationY = -Math.PI * 0.5; // Face left for chase
        scale = isMobile ? 1.5 : 2;
      } else if (overallProgress < swoopInDuration) {
        // Stage 1: Swoop in from left side (opposite of angel)
        stage = 'swoopIn';
        stageProgress = overallProgress / swoopInDuration;
        const easedProgress = 1 - Math.pow(1 - stageProgress, 3); // Ease-out cubic
        
        const startX = isMobile ? -8 : -12;  // Start from left (opposite of angel)
        const startY = isMobile ? 6 : 8;
        const startZ = 6;
        const endX = isMobile ? -2 : -4;
        const endY = isMobile ? 4 : 6;
        const endZ = 2;
        
        // Arc motion during swoop
        const arcHeight = 1.5;
        const yOffset = Math.sin(stageProgress * Math.PI) * arcHeight;
        
        baseX = startX + (endX - startX) * easedProgress;
        baseY = startY + (endY - startY) * easedProgress + yOffset;
        baseZ = startZ + (endZ - startZ) * easedProgress;
        rotationY = Math.PI * 0.3; // Slight angle toward center (opposite of angel)
        scale = isMobile ? 2 : 2;
        
      } else if (overallProgress < swoopInDuration + flyAcrossDuration) {
        // Stage 2: Fly across to right side
        stage = 'flyAcross';
        stageProgress = (overallProgress - swoopInDuration) / flyAcrossDuration;
        const easedProgress = stageProgress; // Linear movement for crossing
        
        const startX = isMobile ? -2 : -4;
        const startY = isMobile ? 4 : 6;
        const endX = isMobile ? 4 : 6;    // End on right (opposite of angel)
        const endY = isMobile ? 5 : 7;
        
        baseX = startX + (endX - startX) * easedProgress;
        baseY = startY + (endY - startY) * easedProgress + Math.sin(time * 2) * 0.3; // Wing flutter
        baseZ = 2 + Math.sin(easedProgress * Math.PI * 2) * 0.5; // Gentle depth wave
        rotationY = Math.PI * 0.4 + Math.sin(time * 1.5) * 0.1; // Flight banking
        scale = isMobile ? 2 : 2;
        
      } else if (overallProgress < swoopInDuration + flyAcrossDuration + spinDuration) {
        // Stage 3: Spin 1.5 rotations (540 degrees)
        stage = 'spin';
        stageProgress = (overallProgress - swoopInDuration - flyAcrossDuration) / spinDuration;
        const easedSpin = stageProgress < 0.5 ? 
          2 * stageProgress * stageProgress : 
          -1 + (4 - 2 * stageProgress) * stageProgress; // Ease in-out
        
        baseX = isMobile ? 4 : 6;
        baseY = isMobile ? 5 : 7;
        baseZ = 2;
        rotationY = Math.PI * 0.2 + (Math.PI * 2.5 * easedSpin); // 1.25 rotations, ends facing viewer
        scale = isMobile ? 2 : 2;
        
      } else if (overallProgress < swoopInDuration + flyAcrossDuration + spinDuration + pauseDuration) {
        // Stage 4: Brief pause
        stage = 'pause';
        stageProgress = (overallProgress - swoopInDuration - flyAcrossDuration - spinDuration) / pauseDuration;
        
        baseX = isMobile ? 4 : 6;
        baseY = isMobile ? 5 : 7 + Math.sin(time * 3) * 0.2; // Gentle hover
        baseZ = 2;
        rotationY = -Math.PI * 0.3 + Math.sin(time * 2) * 0.05; // Facing viewer with slight hover rotation
        scale = isMobile ? 2 : 2;
        
      } else {
        // Stage 5: Swoop out toward viewer and slightly right
        stage = 'swoopOut';
        stageProgress = (overallProgress - swoopInDuration - flyAcrossDuration - spinDuration - pauseDuration) / swoopOutDuration;
        const easedOut = Math.pow(stageProgress, 2); // Ease-in for acceleration
        
        const startX = isMobile ? 4 : 6;
        const startY = isMobile ? 5 : 7;
        const startZ = 2;
        const endX = isMobile ? 8 : 22;   // Exit slightly to the right 
        const endY = isMobile ? 3 : 4;
        const endZ = -3; // Move toward viewer
        
        baseX = startX + (endX - startX) * easedOut;
        baseY = startY + (endY - startY) * easedOut;
        baseZ = startZ + (endZ - startZ) * easedOut;
        rotationY = -Math.PI * 0.8 + (-Math.PI * 0.4 * easedOut); // Continue turning toward viewer
        scale = (isMobile ? 2 : 2) * (1 + easedOut * 1.5); // Get bigger as it approaches
      }
      
      // Apply position, rotation, and scale
      groupRef.current.position.set(baseX, baseY, baseZ);
      groupRef.current.rotation.y = rotationY;
      groupRef.current.rotation.z = is80sMode ? 0 : Math.sin(time * 0.8) * 0.1; // Wing tilt only for devil
      groupRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <primitive 
        object={scene} 
        scale={isMobile ? [1.5, 1.5, 1.5] : [1.5, 1.5, 1.5]}
      />
    </group>
  );
});

// Breath component that follows the same scroll animation as the Model
function ScrollingBreath({ scrollY, scrollProgress, isMobile }) {
  const breathGroupRef = useRef();
  
  // Track when we've reached the bottom (same logic as Model)
  const scrollDroppedRef = useRef(false);
  const prevScrollRef = useRef(0);
  const [hideAtBottom, setHideAtBottom] = React.useState(false);
  
  React.useEffect(() => {
    if (prevScrollRef.current > 7000 && scrollY < 100) {
      scrollDroppedRef.current = true;
      setHideAtBottom(true);
    } 
    else if (scrollY > 500 && scrollY < 7000 && !scrollDroppedRef.current) {
      setHideAtBottom(false);
    }
    else if (scrollY > 7500) {
      if (scrollDroppedRef.current) {
        setHideAtBottom(true);
      }
    }
    
    if (scrollY > 500 && scrollY < 3000) {
      scrollDroppedRef.current = false;
    }
    
    prevScrollRef.current = scrollY;
  }, [scrollY]);
  
  // Same hide logic as model
  const shouldHide = scrollY > 9500 || hideAtBottom;
  
  // Match the exact same animation as the Model component
  useFrame(() => {
    if (breathGroupRef.current) {
      // Check for bottom condition right in the render loop
      const isAtBottomNow = scrollDroppedRef.current || 
                           (prevScrollRef.current > 7000 && scrollY < 100);
      
      if (shouldHide || isAtBottomNow) {
        breathGroupRef.current.visible = false;
        return;
      }
      
      const baseY = isMobile ? -15 : -15;
      
      // Check if we're in drone approach phase using scroll progress
      const droneAppearProgress = 0.35; // Drone appears at 35% of page
      const droneApproachDuration = 0.30; // Approach takes 30% of scroll
      const droneApproachEnd = droneAppearProgress + droneApproachDuration;
      
      let effectiveScrollProgress = scrollProgress;
      
      // During drone approach, lock the breath at the appearance position
      if (scrollProgress >= droneAppearProgress - 0.02 && scrollProgress < droneApproachEnd) {
        // Lock breath at the position it was when drone started appearing
        effectiveScrollProgress = droneAppearProgress - 0.02;
      } else if (scrollProgress >= droneApproachEnd) {
        // After drone approach, subtract the approach duration to continue smoothly
        effectiveScrollProgress = scrollProgress - droneApproachDuration;
      }
      
      // Match Model's increased scroll speed with same clamping
      const maxY = 40; // Same max as model
      const calculatedY = baseY + effectiveScrollProgress * 350;
      breathGroupRef.current.position.y = Math.min(calculatedY, maxY);
      breathGroupRef.current.visible = true;
    }
  });
  
  return (
    <group ref={breathGroupRef} position={isMobile ? [2, -8, -10] : [2, 8, -11]}>
      {/* Right nostril (from bull's perspective) */}
           <BreathSmoke 
        name="Left Nostril"
        position={[2.8, 10.6, 25.1]}
        direction={[0.1, -0.3, 2]}
        rotation={[2.6, 2.4, -0.3]}
      />
      <BreathSmoke 
        name="Right Nostril"
        position={[3.8, 10.2, 25.3]}
        direction={[-0.1, -0.3, 2]}
        rotation={[2.1, 2.3, 0.7]}
      />
    </group>
  );
}

// Scroll-responsive Clouds component wrapper
function ScrollClouds({ scrollY, scrollProgress, onLoad, is80sMode }) {
  const cloudGroupRef = useRef();
  
  // Animate clouds with scroll (from Simple3DScene)
  useFrame(() => {
    if (cloudGroupRef.current) {
      // Check if we're in drone approach phase
      const droneAppearThreshold = 3500; // Matches actual drone threshold
      const droneApproachDuration = 3000; // Matches actual drone duration
      const droneApproachEnd = droneAppearThreshold + droneApproachDuration;
      
      let effectiveScrollY = scrollY;
      
      // During drone approach, lock the clouds at the appearance position
      if (scrollY >= droneAppearThreshold - 200 && scrollY < droneApproachEnd) {
        // Lock clouds at the position they were when drone started appearing
        effectiveScrollY = droneAppearThreshold - 200;
      } else if (scrollY >= droneApproachEnd) {
        // After drone approach, subtract the approach duration to continue smoothly
        effectiveScrollY = scrollY - droneApproachDuration;
      }
      
      // Clouds move slightly slower than model for parallax effect
      cloudGroupRef.current.position.y = effectiveScrollY * 0.03;
    }
  });
  
  return (
    <group ref={cloudGroupRef}>
      <DarkClouds onLoad={onLoad} is80sMode={is80sMode} />
    </group>
  );
}

// ChromaticAberrationMaterial for TickerCurve
const ChromaticAberrationMaterial = shaderMaterial(
  {
    color: new THREE.Color("#1a1a1a"),
    opacity: 0.8,
    aberrationOffset: new THREE.Vector2(0.01, 0.01)
  },
  // Vertex shader
  `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment shader
  `
    uniform vec3 color;
    uniform float opacity;
    uniform vec2 aberrationOffset;
    varying vec2 vUv;
    
    void main() {
      vec2 uv = vUv;
      
      // Sample RGB channels with different offsets for chromatic aberration
      float r = color.r;
      float g = color.g;
      float b = color.b;
      
      // Apply chromatic aberration by offsetting UV coordinates
      vec2 rOffset = uv + aberrationOffset;
      vec2 gOffset = uv;
      vec2 bOffset = uv - aberrationOffset;
      
      // Simple color variation based on position for aberration effect
      float rFactor = 1.0 + sin(rOffset.x * 10.0) * 0.1;
      float bFactor = 1.0 + sin(bOffset.x * 10.0) * 0.1;
      
      vec3 finalColor = vec3(r * rFactor, g, b * bFactor);
      
      gl_FragColor = vec4(finalColor, opacity);
    }
  `
);

// GradientSkyMaterial from home/page
const GradientSkyMaterial = shaderMaterial(
  {
    topColor: new THREE.Color(0x1a0033), // Dark violet
    middleColor: new THREE.Color(0x87CEEB), // Light blue
    bottomColor: new THREE.Color(0x0a001a), // Dark blue/almost black
  },
  // Vertex shader
  `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  // Fragment shader
  `
    uniform vec3 topColor;
    uniform vec3 middleColor;
    uniform vec3 bottomColor;
    varying vec3 vWorldPosition;
    
    void main() {
      float h = normalize(vWorldPosition).y;
      vec3 color;
      
      if (h > 0.0) {
        // Upper hemisphere: blend from middle to top
        color = mix(middleColor, topColor, h);
      } else {
        // Lower hemisphere: blend from middle to bottom
        color = mix(middleColor, bottomColor, -h);
      }
      
      gl_FragColor = vec4(color, 1.0);
    }
  `
);

extend({ GradientSkyMaterial });
extend({ ChromaticAberrationMaterial });

// Hemisphere Light Component
function HemisphereLightComponent() {
  // GUI Controls (commented out - uncomment to adjust lighting)
  // const hemisphereLightControls = useControls('Hemisphere Light', {
  //   skyColor: {
  //     value: "#11c3f4c7",
  //   },
  //   groundColor: {
  //     value: "#ff00cc",
  //   },
  //   intensity: {
  //     value: 1.2,
  //     min: 0,
  //     max: 5,
  //     step: 0.1,
  //   },
  // });
  
  // Hard-coded values
  const lightingValues = {
    skyColor: "#11c3f4c7",
    groundColor: "#ff00cc",
    intensity: 1.2,
  };
  
  return (
    <hemisphereLight 
      skyColor={lightingValues.skyColor} 
      groundColor={lightingValues.groundColor} 
      intensity={lightingValues.intensity} 
    />
  );
}

// Spotlight Component
function SpotlightComponent() {
  const spotlightRef = useRef();
  
  // GUI Controls (commented out - uncomment to adjust lighting)
  // const spotlightControls = useControls('Spotlight', {
  //   position: {
  //     value: [7.4, 28, 19.9],
  //     step: 0.1,
  //   },
  //   color: "#ffac00",
  //   angle: {
  //     value: 0.02,
  //     min: 0,
  //     max: Math.PI / 2,
  //     step: 0.01,
  //   },
  //   decay: {
  //     value: 0.97,
  //     min: 0,
  //     max: 2,
  //     step: 0.01,
  //   },
  //   distance: {
  //     value: 300,
  //     min: 0,
  //     max: 1000,
  //     step: 1,
  //   },
  //   penumbra: {
  //     value: -0.3,
  //     min: -1,
  //     max: 1,
  //     step: 0.01,
  //   },
  //   intensity: {
  //     value: 77,
  //     min: 0,
  //     max: 1000,
  //     step: 1,
  //   },
  // });
  
  // Hard-coded values
  const lightingValues = {
    position: [7.4, 28, 19.9],
    color: "#ffac00",
    angle: 0.02,
    decay: 0.97,
    distance: 300,
    penumbra: -0.3,
    intensity: 77,
  };
  
  return (
    <spotLight 
      ref={spotlightRef}
      position={lightingValues.position} 
      color={new THREE.Color(lightingValues.color)} 
      angle={lightingValues.angle} 
      decay={lightingValues.decay} 
      distance={lightingValues.distance} 
      penumbra={lightingValues.penumbra} 
      intensity={lightingValues.intensity}
      castShadow={false}
    />
  );
}

// Apply bloom effect to Halo mesh
function GradientSkySphere() {
  return (
    <mesh scale={[100, 100, 100]}>
      <sphereGeometry args={[1, 8, 8]} />
      <gradientSkyMaterial 
        side={THREE.BackSide}
        topColor={new THREE.Color(0x1a0033)} // Dark violet
        middleColor={new THREE.Color(0x87CEEB)} // Light blue
        bottomColor={new THREE.Color(0x0a001a)} // Dark blue/almost black
      />
    </mesh>
  );
}

// ScrollTriggeredTitle - TranslatableDropInTitle that animates when in view
function ScrollTriggeredTitle({ isMobile, scrollProgress, language = 'en' }) {
  const titleRef = useRef(null);
  const titleInView = useInView(titleRef, { 
    threshold: 0.01, // Very low threshold - just 1% visible
    triggerOnce: false,  // Allow re-triggering for replay
    rootMargin: '200px 0px' // Trigger 200px before entering viewport
  });

  return (
    <div ref={titleRef} style={{ 
      minHeight: '200px',
      position: 'relative',
      zIndex: 100
    }}>
      <TranslatableDropInTitle
        lines={["BEHOLD!", "OUR LADY!", "HOLD RL80!"]}
        colors={["#d4af37", "#f4e4c1", "#00fffbff"]}
        fontSize={{ mobile: "2.5rem", desktop: "4rem" }}
        isMobile={isMobile}
        triggerAnimation={titleInView} // Will trigger whenever in view
        language={language}
        instanceId="welcome-title"
      />
      
      {/* <AnnunciationIntro 
  isMobile={isMobile}
  titleInView={titleInView}
  SkewedHeading={SkewedHeading}
  AngelOfCurrencies={AngelOfCurrencies}
/> */}
     
    </div>
  );
}





// Exact TickerCurve from Simple3DScene
const TickerCurve = ({ scrollY = 0, scrollProgress = 0, scale = 3, position = [0, 3, 5] }) => {
  const textRefs = useRef([]);
  const curveRef = useRef();
  const groupRef = useRef();
  
  const firestoreResults = useFirestoreResults();
  
  // Create the curve path
  const curve = useMemo(() => {
    // Create a wavy ribbon curve similar to your Blender model
    const points = [];
    const segments = 50;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = (t - 0.5) * 40; // Wider curve to match ticker
      const y = Math.sin(t * Math.PI * 2) * 1; // Wave amplitude
      const z = Math.cos(t * Math.PI) * 2; // More depth variation
      points.push(new THREE.Vector3(x, y, z));
    }
    return new THREE.CatmullRomCurve3(points);
  }, []);
  
  // Animate text along curve
  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const speed = 0.03;
    
    textRefs.current.forEach((mesh, index) => {
      if (mesh && mesh.userData.baseIndex === undefined) {
        // Store the initial index for each mesh
        mesh.userData.baseIndex = index;
      }
      
      if (mesh) {
        // Calculate position along curve - ensure each item has unique position
        const itemCount = Math.max(textRefs.current.length, 10); // Minimum 10 positions
        const spacing = 1.0 / itemCount; // More spacing by using higher divisor
        const baseIndex = mesh.userData.baseIndex || index;
        const offset = ((time * speed) + (baseIndex * spacing)) % 1;
        
        // Get point on curve (these are in local space relative to the group)
        const point = curve.getPoint(offset);
        const tangent = curve.getTangent(offset);
        
        // Set position directly without creating new vectors
        mesh.position.x = point.x;
        mesh.position.y = point.y;  // Slightly below the curve (was +0.1)
        mesh.position.z = point.z + 0.1;  // Closer to ribbon surface (was +0.5)
        
        // Calculate proper orientation for text to follow curve smoothly
        const up = new THREE.Vector3(0, 1, 0);
        const axis = new THREE.Vector3().crossVectors(up, tangent).normalize();
        const radians = Math.acos(up.dot(tangent));
        const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, radians);
        
        // Apply rotation to align text with curve direction
        mesh.quaternion.copy(quaternion);
        mesh.rotateY(Math.PI); // Rotate to face along the curve
        mesh.rotateZ(Math.PI / 2); // Additional rotation for readability
        mesh.rotateX(-Math.PI); // Flip 180 degrees over X-axis
      }
    });
  });
  
  // Create a flat ribbon mesh from the curve
  const ribbonGeometry = useMemo(() => {
    const points = curve.getPoints(100);
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const ribbonHeight = 0.6; // Height of the ribbon
    
    // Create vertices for a flat ribbon
    points.forEach(point => {
      // Top edge
      vertices.push(point.x, point.y + ribbonHeight/2, point.z);
      // Bottom edge  
      vertices.push(point.x, point.y - ribbonHeight/2, point.z);
    });
    
    // Create faces
    const indices = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      
      // Two triangles per segment
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    return geometry;
  }, [curve]);
  
  // Cleanup geometry and text materials on unmount
  useEffect(() => {
    const currentGeometry = ribbonGeometry;
    return () => {
      if (currentGeometry) {
        currentGeometry.dispose();
      }
      // Clean up text refs to prevent memory leaks
      textRefs.current.forEach(ref => {
        if (ref) {
          if (ref.geometry) ref.geometry.dispose();
          if (ref.material) ref.material.dispose();
        }
      });
      textRefs.current = [];
    };
  }, [ribbonGeometry]);
  
  // Create a small differential between text and mesh based on scroll
  // Text moves slightly less than mesh to maintain alignment
  const textOffsetY = scrollY * -0.00015; // Small negative offset to compensate for drift
  
  return (
    <group ref={groupRef} position={position} scale={scale}>
      {/* Render the curve as a flat ribbon */}
      <mesh ref={curveRef} renderOrder={0} geometry={ribbonGeometry}>
        <meshBasicMaterial 
          color="#1a1a1a" 
          transparent 
          opacity={0.8}
          depthTest={true}
          depthWrite={true}
          side={2} // DoubleSide
        />
      </mesh>
      
      {/* Text elements with slight scroll differential relative to mesh */}
      <group position={[0, textOffsetY, 0]}>
        {(firestoreResults.length > 0 
          ? firestoreResults.slice(0, 5).flatMap((item, i) => [
              { text: `${item.userName || 'ANON'}`, isName: true, key: `name-${i}` },
              { text: '▲', isName: false, key: `arrow-${i}` },
              { text: `${(item.burnedAmount || 0).toLocaleString()}`, isName: false, key: `amount-${i}` },
              { text: '•', isName: false, key: `dot-${i}` }
            ])
          : ['$', 'DIVINE', '+', 'ENERGY', '▲', 'FLOWS', '$', 'REALM'].map((text, i) => 
              ({ text, isName: false, key: `default-${i}` }))
        ).map((item, index) => {
          const isNameItem = item && item.isName;
          const textContent = item && item.text ? item.text : item;
          const keyValue = item && item.key ? item.key : index;
          
          return (
          <Text
            key={keyValue}
            ref={el => textRefs.current[index] = el}
            font="/fonts/BitcountSingleInk.ttf"
            fontSize={0.35}
            color={isNameItem ? "#FFFFFF" : "#00FF41"}  // White for names, green for numbers
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.2}
            renderOrder={0}  // Changed to 0 for proper depth sorting
          >
            {String(textContent).toUpperCase()}
          </Text>
        );
      })}
      </group>
    </group>
  );
};

export default function Home() {
  // Get language from context
  const { locale: language, t } = useLanguage();
  
  // Firestore data
  const topBurners = useFirestoreResults("burnedAmount");
  
  // State for overlay buttons (from home/page)
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [isTabletPortrait, setIsTabletPortrait] = useState(false);
  const [isTabletLandscape, setIsTabletLandscape] = useState(false);
  const [isSceneLoading, setIsSceneLoading] = useState(true);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [cloudsLoaded, setCloudsLoaded] = useState(false);
  const [showMusicControls, setShowMusicControls] = useState(false);
  const [emoji, setEmoji] = useState("😇");
  const [scrollY, setScrollY] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showNumerology, setShowNumerology] = useState(false);
  const [showDroneScreen, setShowDroneScreen] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);

  // Refs
  const secondTitleRef = useRef(null);
  const ctasRef = useRef(null);
  
  // useInView hooks
  // const ctasInView = useInView(ctasRef, { threshold: 0.3, once: true });
  const secondTitleInView = useInView(secondTitleRef, { 
    threshold: 0.01, // Very low threshold - just 1% visible (matches working first title)
    triggerOnce: false,  // Allow re-triggering for replay
    rootMargin: '200px 0px' // Trigger 200px before entering viewport (matches working first title)
  });

  // Auth state
  const { isSignedIn, user } = useUser();

    const handleOpenModal = () => {
    if (!isSignedIn) {
      const btn = document.getElementById('hidden-sign-in-home');
      btn?.click();
    } else {
      setIsModalOpen(true);
    }
  };
  
  
  // Get music context functions
  const {
    play,
    pause,
    isPlaying: contextIsPlaying,
    nextTrack,
    currentTrack,
    is80sMode: context80sMode,
    setIs80sMode: setContext80sMode
  } = useMusic();
  const is80sMode = context80sMode;

  // Helper function to get responsive values (from home/page)
  const getResponsiveValue = (mobile, tablet, tabletLandscape, desktop) => {
    if (isMobile) return mobile;
    return desktop; // Simplified for test page
  };

  // Get language from context - this will be handled by LanguageProvider now

  // Font loading effect
  useEffect(() => {
    let timeoutId;
    const checkFont = async () => {
      try {
        await document.fonts.load("1em 'UnifrakturCook'");
        await document.fonts.load("1em 'UnifrakturMaguntia'");
        await document.fonts.load("1em 'Fjalla One'");
        setFontLoaded(true);
        document.body.classList.add('fonts-loaded');
      } catch (e) {
        timeoutId = setTimeout(() => {
          setFontLoaded(true);
          document.body.classList.add('fonts-loaded');
        }, 1000);
      }
    };
    checkFont();
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  // Update loading state when font, model, and clouds are loaded
  useEffect(() => {
    if (fontLoaded && modelLoaded && cloudsLoaded) {
      setTimeout(() => {
        setIsSceneLoading(false);
      }, 500); // Small delay for smooth transition
    }
  }, [fontLoaded, modelLoaded, cloudsLoaded]);


  // Load Pirata One font
  // useEffect(() => {
  //   const link = document.createElement('link');
  //   link.href = 'https://fonts.googleapis.com/css2?family=Pirata+One&display=swap';
  //   link.rel = 'stylesheet';
  //   if (!document.querySelector('link[href*="Pirata+One"]')) {
  //     document.head.appendChild(link);
  //   }
  // }, []);

  // Initialize state
  useEffect(() => {
    setMounted(true);
    const checkDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const mobile = width <= 1024; // Increased breakpoint to catch more devices
      // iPad Mini portrait is 744px wide, so adjust the breakpoint  
      const isMobileValue = width <= 480; // Smaller breakpoint for true mobile phones
      const tabletPortrait = width >= 481 && width <= 1024 && height > width; // Captures iPad Mini portrait (744px)
      const tabletLandscape = width >= 481 && width <= 1024 && width > height;
      
      setIsMobile(isMobileValue);
      setIsMobileDevice(mobile);
      setIsTabletPortrait(tabletPortrait);
      setIsTabletLandscape(tabletLandscape);
    };
    
    // Handle scroll events - check all possible scroll sources
    const handleScroll = (event) => {
      // Try to find the actual scrolling element
      let currentScroll = 0;
      
      // Check if event target is scrolling
      if (event && event.target) {
        currentScroll = event.target.scrollTop || 0;
      }
      
      // Fallback to standard scroll detection
      if (currentScroll === 0) {
        const scrollingElement = document.scrollingElement || document.documentElement || document.body;
        currentScroll = scrollingElement.scrollTop || window.scrollY || window.pageYOffset || 0;
      }
      
      // Calculate scroll progress as percentage (0 to 1)
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = totalHeight > 0 ? Math.min(1, Math.max(0, currentScroll / totalHeight)) : 0;
      
      setScrollY(currentScroll);
      setScrollProgress(progress);
    };
    
    checkDevice();
    handleScroll(); // Set initial scroll position
    window.addEventListener('resize', checkDevice);
    
    // Add scroll listeners to multiple elements to catch the scroll
    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });
    document.body.addEventListener('scroll', handleScroll, { passive: true });
    
    // Add touch event handling for tablet scroll support - only during drone sequence
    let touchStartY = 0;
    let isScrolling = false;
    
    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
      isScrolling = false;
    };
    
    const handleTouchMove = (e) => {
      // Get current scroll progress
      const currentScroll = window.scrollY || document.documentElement.scrollTop || 0;
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const currentProgress = totalHeight > 0 ? Math.min(1, Math.max(0, currentScroll / totalHeight)) : 0;
      
      // Only apply custom scroll during drone sequence (33% to 65% of scroll)
      const droneStartProgress = 0.33;
      const droneEndProgress = 0.65;
      const inDroneSequence = currentProgress >= droneStartProgress && currentProgress <= droneEndProgress;
      
      // Skip custom handling on iPad/tablets to allow native scrolling
      const isIPad = /iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;
      const isTablet = window.innerWidth >= 768 && window.innerWidth <= 1024;
      
      if (inDroneSequence && !isScrolling && !isIPad && !isTablet) {
        const touchY = e.touches[0].clientY;
        const deltaY = touchStartY - touchY;
        
        // Reduced threshold during drone sequence for smoother control
        if (Math.abs(deltaY) > 2) {
          isScrolling = true;
          e.preventDefault(); // Only prevent default during drone sequence
          
          // Slower scroll speed during drone sequence for focus
          const newScroll = Math.max(0, currentScroll + deltaY * 0.5); // Slower multiplier for drone sequence
          
          window.scrollTo(0, newScroll);
          handleScroll(); // Update our scroll state
        }
      }
      // Let native scrolling handle everything outside drone sequence
    };
    
    const handleTouchEnd = () => {
      isScrolling = false;
    };
    
    // Add touch event listeners with passive true by default (only preventDefault during drone sequence)
    // Check if device is iPad/tablet
    const isIPad = /iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;
    const isTablet = window.innerWidth >= 768 && window.innerWidth <= 1024;
    
    // Use passive touch events on iPad/tablets to allow native scrolling
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: isIPad || isTablet }); // Passive on iPad/tablets
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    // Track dynamically added listeners for cleanup
    const addedListeners = [];
    
    // Also check for scrolling on the main app container
    const checkForScrollContainer = () => {
      // Find all elements that might be scrolling
      const possibleContainers = document.querySelectorAll('div, main, section');
      possibleContainers.forEach(container => {
        if (container.scrollHeight > container.clientHeight) {
          // Found scrollable container
          container.addEventListener('scroll', handleScroll, { passive: true });
          addedListeners.push(container);
        }
      });
    };
    
    // Delay to ensure DOM is ready
    const timeoutId = setTimeout(checkForScrollContainer, 100);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
      document.body.removeEventListener('scroll', handleScroll);
      
      // Remove touch event listeners
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      
      // Remove dynamically added listeners
      addedListeners.forEach(container => {
        container.removeEventListener('scroll', handleScroll);
      });
    };
  }, []);

  // Emoji animation
  useEffect(() => {
    const emojiInterval = setInterval(() => {
      setEmoji((prevEmoji) => (prevEmoji === "😇" ? "😈" : "😇"));
    }, 3000);
    return () => clearInterval(emojiInterval);
  }, []);

  // Keyboard shortcut for copying lighting values (commented out - uncomment if using GUI controls)
  // useEffect(() => {
  //   const handleKeyDown = (event) => {
  //     if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
  //       event.preventDefault();
  //       copyAllLightingValues();
  //     }
  //   };

  //   document.addEventListener('keydown', handleKeyDown);
  //   return () => document.removeEventListener('keydown', handleKeyDown);
  // }, []);

  // Function to copy all lighting values (commented out - uncomment if using GUI controls)
  // const copyAllLightingValues = () => {
  //   const allValues = {
  //     timestamp: new Date().toISOString(),
  //     note: "Copy these values back into your React components",
  //     lighting: {
  //       spotlight: {
  //         position: "[7.4, 28, 19.9]",
  //         color: "#ffac00",
  //         angle: 0.02,
  //         decay: 0.97,
  //         distance: 300,
  //         penumbra: -0.3,
  //         intensity: 77
  //       },
  //       hemisphereLight: {
  //         skyColor: "#11c3f4c7",
  //         groundColor: "#ff00cc", 
  //         intensity: 1.2
  //       },
  //       cloudHemisphereLight: {
  //         skyColor: "#f5f5f5",
  //         groundColor: "#f2950b",
  //         intensity: 1.5,
  //         position: "[0, -20, -5]"
  //       }
  //     }
  //   };
  //   navigator.clipboard.writeText(JSON.stringify(allValues, null, 2));
  //   console.log('All lighting values copied to clipboard');
  // };

  // Client-side hydration check
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Sync showMusicControls with playing state
  useEffect(() => {
    if (contextIsPlaying && !showMusicControls) {
      setShowMusicControls(true);
    }
  }, [contextIsPlaying, showMusicControls]);


  return (
    <>
      {/* Loading Screen */}
      <CoinLoader loading={isSceneLoading} />
      
      {/* Thirdweb Buy Modal */}
      <ThirdwebBuyModal 
        isOpen={showBuyModal} 
        onClose={() => setShowBuyModal(false)} 
      />
      
      {/* Scroll Position Indicator */}
      {/* <div style={{
        position: 'fixed',
        top: '80px',
        right: '20px',
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: '#00FFFF',
        padding: '15px 20px',
        borderRadius: '10px',
        fontFamily: 'monospace',
        fontSize: '14px',
        border: '2px solid #FFD700',
        boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)',
        backdropFilter: 'blur(10px)',
        minWidth: '220px'
      }}>
        <div style={{ marginBottom: '8px', color: '#FFD700', fontWeight: 'bold' }}>SCROLL POSITION</div>
        <div>Y: {Math.round(scrollY)}px</div>
        <div>Viewport: {isClient ? Math.round((scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100) : 0}%</div>
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#888' }}>
          Total Height: {isClient ? document.documentElement.scrollHeight : 0}px
        </div>
        <div style={{ fontSize: '12px', color: '#888' }}>
          Sections: Hero(100vh) → Clouds(1800vh) → Content(800vh) → Footer(300vh)
        </div>
      </div>  */}
      
      <div style={{ 
        width: '100vw', 
        background: 'transparent', 
        minHeight: '100vh',
        height: 'auto',
        opacity: isSceneLoading ? 0 : 1,
        transition: 'opacity 0.5s ease-in-out',
      }}>
      {/* 3D Scene Background - Fixed viewport with scrolling camera */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh', // Keep canvas at viewport height
        zIndex: 5, // Medium z-index
        pointerEvents: 'auto', // Enable pointer events for drone screen interaction
        background: 'linear-gradient(to bottom, #87CEEB, #98D8E8, #B0E0E6)', // Sky gradient
      }}>
        <CleanCanvas
          camera={{ position: [0, -10, 40], fov: 40, near: 0.1, far: 300 }}
          gl={{
            antialias: false,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: false, // Memory optimization
            alpha: true,
            premultipliedAlpha: false,
            stencil: false, // Disable stencil buffer if not needed
            depth: true,
            // clearColor: 0x000000,
            clearAlpha: 0,
          }}
          frameloop="always" // Keep for scroll animations
          dpr={[1, 1.5]} // Limit max DPR for performance
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
          }}
        >
             {/* Removed background color to allow CSS3D to show through */}
                     {/* <SpotlightComponent /> */}

          {/* TEMPORARY: OrbitControls for inspection */}
          {/* <OrbitControls 
            enableDamping={true}
            dampingFactor={0.05}
            makeDefault
          /> */}
          
          <ambientLight intensity={0.5} />
          {/* Sunset glow lighting */}
          <HemisphereLightComponent />
          <directionalLight 
            position={[-20, 10, -10]} 
            color="#ff50ee" 
            intensity={1.5}
            castShadow={false}
          />

          
          <Suspense fallback={null}>
            <GradientSkySphere />
            {/* <LayeredClouds scrollY={scrollY} /> */}
            <EnhancedVolumetricLight scrollY={scrollY}
              // position={[0, Math.min(50 + scrollY * 0.035, 150), 0]} 
              // target={[3, Math.min(-50 + scrollY * 0.035, 50), -5]}
              // color="#d89d12ff"
              // intensity={1.5}
            />
            <Model scrollY={scrollY} scrollProgress={scrollProgress} isMobile={isMobile} onLoad={() => setModelLoaded(true)} is80sMode={is80sMode} />
            {/* <VideoScreens /> */}
            {/* Breath that follows the same scroll animation as the bull */}
            <ScrollingBreath scrollY={scrollY} scrollProgress={scrollProgress} isMobile={isMobile} />
            
            {/* Drone with Screen1 display with interactive screen */}
            <DroneModel 
              position={[0, 5, -5]} 
              scrollY={scrollY}
              scrollProgress={scrollProgress}
              isMobile={isMobile}
              isSignedIn={isSignedIn}
              language={language}
              onOpenBuyModal={() => setShowBuyModal(true)}
              is80sMode={is80sMode}
            />
            
            {/* Angel Model with playful swoop animation */}
            <AngelModel 
              scrollY={scrollY}
              scrollProgress={scrollProgress}
              isMobile={isMobile}
              isTabletPortrait={isTabletPortrait}
              isTabletLandscape={isTabletLandscape}
              is80sMode={is80sMode}
            />
            
            {/* Devil Model with playful swoop animation (appears at end) */}
            <DevilModel 
              scrollY={scrollY}
              scrollProgress={scrollProgress}
              isMobile={isMobile}
              isTabletPortrait={isTabletPortrait}
              isTabletLandscape={isTabletLandscape}
              is80sMode={is80sMode}
            />
            
            {/* Manual click handler component */}
            <ClickHandler />
            
            {/* CSS3D Screen replaced with video texture on Screen1 mesh */}
            
            {/* Neural Network Visualization */}
            {/* <NeuralNetworkR3F 
              theme={0}
              formation={0}
              density={70}
              position={[0, -10, -10]}
              scale={0.5}
              enableInteraction={true}
            /> */}
            
            <ScrollClouds scrollY={scrollY} scrollProgress={scrollProgress} onLoad={() => setCloudsLoaded(true)} is80sMode={is80sMode} />
            {/* Additional point lights for desktop only */}
 
            <PostProcessingEffects is80sMode={is80sMode} />
          </Suspense>
          {/* Performance Monitor - Shows FPS, MS, MB */}
          {/* <Stats className="perf-monitor" /> */}
        </CleanCanvas>
      </div>
      
      {/* Screen now uses video texture directly on the 3D mesh */}

      {/* Leva Controls Panel - positioned middle right */}
      {/* <Leva
        fill={false}
        flat={false}
        oneLineLabels={false}
        hideCopyButton={false}
        titleBar={true}
        collapsed={false}
        theme={{
          colors: {
            elevation1: 'rgba(40, 40, 40, 0.9)',
            elevation2: 'rgba(60, 60, 60, 0.9)',
            elevation3: 'rgba(80, 80, 80, 0.9)',
            accent1: '#ff8c00',
            accent2: '#ffa500',
            accent3: '#ffb84d',
            highlight1: 'rgba(255, 140, 0, 0.2)',
            highlight2: 'rgba(255, 165, 0, 0.4)',
            highlight3: 'rgba(255, 184, 77, 0.6)',
          }
        }}
        style={{
          position: 'fixed',
          top: 'calc(50% + 400px)',
          right: '20px',
          transform: 'translateY(-50%)',
          zIndex: 1000,
          maxHeight: '80vh',
          overflowY: 'auto',
          backdropFilter: 'blur(10px)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 140, 0, 0.3)'
        }}
      /> */}

      {/* Scrollable Overlay Content - Allow clicks to pass through to 3D canvas */}
 <div style={{
          position: 'relative',
          width: '100%',
          minHeight: '100vh',
          zIndex: 10,
          pointerEvents: 'auto',
          opacity: isSceneLoading ? 0 : 1,
          transition: 'opacity 0.5s ease-in-out',
        }}>
  <div style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          paddingTop: '3rem',
          minHeight: '100vh',
        }}>
          
          <h1 className='custom-title'
              id="main-title"
              style={{ 
              position: "relative",
              left: isMobile ? "-10%" : "-25%",
              color: is80sMode ? "#D946EF" : "#d4af37",
              fontFamily: 'UnifrakturCook, serif',
              textShadow: is80sMode ? `
                0 0 10px rgba(217, 70, 239, 0.9),
                0 0 20px rgba(103, 232, 249, 0.7),
                0 0 30px rgba(217, 70, 239, 0.5),
                0 0 40px rgba(0, 255, 65, 0.3),
                6px 6px 16px rgba(0, 0, 0, 1),
                -2px -2px 8px rgba(255, 0, 255, 0.7),
                0 0 100px rgba(217, 70, 239, 0.2)
              ` : `
                0 0 10px rgba(212, 175, 55, 0.8),
                0 0 20px rgba(212, 175, 55, 0.6),
                0 0 30px rgba(212, 175, 55, 0.8),
                6px 6px 16px rgba(0, 0, 0, 1),
                -2px -2px 8px rgba(255, 192, 203, 0.7),
                0 0 100px rgba(212, 175, 55, 0.1)
              `,
              fontSize: getResponsiveValue("4rem", "5rem", "5rem", "5rem"),
              fontWeight: 900,
              lineHeight: 0.8,
              transform: isMobile ? "rotate(-5deg)" : "rotate(-8deg) skew(-15deg)",
              zIndex: 1000,
              whiteSpace: isMobile ? 'normal' : 'nowrap',
              cursor: 'pointer',
              marginTop: isMobile ? '1rem' : '3rem',
              pointerEvents: 'auto',
              transition: 'color 0.5s ease, text-shadow 0.5s ease',
            }}>
              <span className="title-line" style={{ display: 'block', position: 'relative' }}>{t('home.ourLady')}</span>
              <span className="title-line" style={{ display: 'block', position: 'relative' }}>
                <span style={{ fontSize: isMobile ? "1.2rem" : "3rem" }}>of    </span>
                Perpetual
              </span>
              <span className="title-line" style={{ display: 'block', marginLeft: isMobile ? "2rem" : "6rem", position: 'relative' }}>Profit</span>
            </h1>

        </div>
        
      </div>


      {/* Top Controls Container - Music, User, and Nav (from home/page) */}
      {mounted && !isSceneLoading && (
      <>
        {/* CyberNav Menu with integrated buttons */}
        <div
          style={{
            position: "fixed",
            top: "20px",
            right: "5rem",
            zIndex: 9999,
            opacity: isSceneLoading ? 0 : 1,
            transition: "opacity 0.5s ease-in-out"
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
                width: isMobile ? "3.5rem" : "3.5rem",
                height: isMobile ? "3.5rem" : "3.5rem",
                borderRadius: "0.5rem",
                backgroundColor: "rgba(0, 0, 0, 0.7)",
                border: "2px solid rgba(255, 255, 255, 0.2)",
                color: "#ffffff",
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
                width={isMobile ? "20" : "30"}
                height={isMobile ? "20" : "30"}
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

              <div
                className={contextIsPlaying ? "spinning-record" : ""}
                style={{
                  width: isMobile ? "3rem" : "3.5rem",
                  height: isMobile ? "3rem" : "3.5rem",
                  borderRadius: "50%",
                  backgroundImage: "url('/virginRecords.jpg')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              

              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (nextTrack) {
                    nextTrack();
                  }
                }}
                style={{
                  width: isMobile ? "2rem" : "3rem",
                  height: isMobile ? "2rem" : "3rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "rgba(0, 0, 0, 0.7)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  color: "white",
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
                <svg width={isMobile ? "16" : "24"} height={isMobile ? "16" : "24"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                  width: isMobile ? "1.75rem" : "2.625rem",
                  height: isMobile ? "1.75rem" : "2.625rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "rgba(0, 0, 0, 0.7)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  color: "white",
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
                <svg width={isMobile ? "14" : "21"} height={isMobile ? "14" : "21"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
              )
            }
            userButton={
              user ? (
                <UserButton
                  appearance={{
                    baseTheme: "dark",
                    elements: {
                      avatarBox: {
                        width: isMobile ? "3rem" : "3.5rem",
                        height: isMobile ? "3rem" : "3.5rem",
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
                <SignInButton mode="modal">
                  <button
                    style={{
                      width: isMobile ? "3rem" : "3.5rem",
                      height: isMobile ? "3rem" : "3.5rem",
                      borderRadius: "8px",
                      backgroundColor: "rgba(0, 0, 0, 0.7)",
                      border: "2px solid rgba(255, 255, 255, 0.2)",
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      backdropFilter: "blur(10px)",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)"
                    }}
                  >
                    <span style={{ fontSize: "1.8rem" }}>{emoji}</span>
                  </button>
                </SignInButton>
              )
            }
            extra80sButton={
              <button
                onClick={() => setContext80sMode(!is80sMode)}
                style={{
                  width: isMobile ? "3.5rem" : "3.75rem",
                  height: isMobile ? "3.5rem" : "3.75rem",
                  borderRadius: "0.5rem",
                  backgroundColor: is80sMode ? "rgba(217, 70, 239, 0.3)" : "rgba(0, 0, 0, 0.7)",
                  border: is80sMode ? "2px solid #D946EF" : "2px solid rgba(255, 255, 255, 0.2)",
                  color: is80sMode ? "#67e8f9" : "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  backdropFilter: "blur(10px)",
                  boxShadow: is80sMode 
                    ? "0 0 20px rgba(217, 70, 239, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3)" 
                    : "0 2px 8px rgba(0, 0, 0, 0.3)",
                }}
                onMouseEnter={(e) => {
                  if (is80sMode) {
                    e.currentTarget.style.boxShadow = "0 0 30px rgba(217, 70, 239, 0.7), 0 2px 8px rgba(0, 0, 0, 0.3)";
                  } else {
                    e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (is80sMode) {
                    e.currentTarget.style.boxShadow = "0 0 20px rgba(217, 70, 239, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3)";
                  } else {
                    e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
                  }
                }}
                title={is80sMode ? "Disable 80s Mode" : "Enable 80s Mode"}
              >
                <span style={{
                  fontSize: isMobile ? "18px" : "22px",
                  fontWeight: "bold",
                  color: is80sMode ? "#00ff41" : "#67e8f9",
                  textShadow: is80sMode ? "0 0 10px #00ff41" : "none",
                  fontFamily: "monospace",
                  lineHeight: 0.7,
                }}>
                  80s<br/><span style={{
                  fontSize: isMobile ? "10px" : "12px",
           
                }}>MODE
                </span></span>
              </button>
            }
          />
        </div>
        
        {/* Global Copy Lighting Values Button (commented out - uncomment if using GUI controls) */}
        {/* <div style={{ order: isMobileDevice ? 5 : 4 }}>
          <button
            onClick={copyAllLightingValues}
            style={{
              width: isMobileDevice ? "2.5rem" : "3.75rem",
              height: isMobileDevice ? "2.5rem" : "3.75rem",
              borderRadius: "0.5rem",
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              border: "2px solid rgba(255, 215, 0, 0.4)",
              color: "#ffd700",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 0.3s ease",
              backdropFilter: "blur(10px)",
              boxShadow: "0 0.125rem 0.5rem rgba(0, 0, 0, 0.3)",
            }}
            title="Copy All Lighting Values (Ctrl/Cmd + L)"
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255, 215, 0, 0.8)";
              e.currentTarget.style.backgroundColor = "rgba(255, 215, 0, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255, 215, 0, 0.4)";
              e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
            }}
          >
            📋
          </button>
        </div> */}
      </>
      )}

      {/* Welcome Section with DropInTitle */}
      {/* <motion.div
        style={{
          position: isMobile ? "relative" : "absolute",
          top: isMobile ? 0 : "100vh",
          marginTop: isMobile ? "100vh" : 0,
          left: 0,
          right: 0,
          minHeight: "1800vh", // Extended for longer cloud descent and more animation room
          // background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.8), rgba(0,0,0,0.9))",
          zIndex: 1,
          pointerEvents: "auto", // Keep auto to allow scrolling
        }}
        className="welcome-banner"
      > */}
        <div 
          ref={(el) => { 
            if (el) el.titleRef = el; 
          }}
          style={{
            textAlign: 'center',
            padding: isMobile ? '2rem 1rem' : '5rem 2.8rem',
            // maxWidth: '900px',
            margin: '0 auto',
          }}
        >
          {/* Animated Drop-In Title with scroll trigger */}
          <ScrollTriggeredTitle isMobile={isMobile} scrollProgress={scrollProgress} language={language} />
        </div>

       
        

        {/* Additional content sections */}

        

        {/* Extended scroll space for longer page */}
        <div style={{
          position: 'relative',
          height: '800vh', // Extended for more content and animation space
          width: '100%',
          zIndex: 1,
          pointerEvents: 'none', // Don't block interactions
        }} />

        {/* Additional mobile spacer for more runway after drone */}
        {isMobile && (
          <div style={{
            position: 'relative',
            height: '200vh', // Moderate extra space on mobile for animations
            width: '100%',
            zIndex: 1,
            pointerEvents: 'none',
          }} />
        )}
        
        {/* Feature Carousel Section - Hybrid Approach */}
        <div style={{
          position: 'relative',
          margin: '6rem auto',
          width: '100%',
          zIndex: 10,
          pointerEvents: 'auto',
        }}>
          {/* <div style={{
            textAlign: 'center',
            marginBottom: '3rem',
          }}>
            <SkewedHeading
              lines={["EXPLORE", "FEATURES"]}
              fontSize={isMobile ? "2.5rem" : "3.5rem"}
              color="#00ff9d"
              skewAngle={-2}
              shadowColor="#000"
            />
            <p style={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: isMobile ? '0.9rem' : '1rem',
              marginTop: '1rem',
            }}>
              Swipe through our key features and discover the power of RL80
            </p>
          </div> */}
          {/* <FeatureCarousel
            slides={[
              <WatchlistSlide key="watchlist" />,
              <Illumin80Slide key="illumin80" />,
              <TradingDeskSlide key="features/trading" />,
              <TokenomicsSlide key="tokenomics" />,
            ]}
            autoRotate={true}
            rotationInterval={7000}
          /> */}
        </div>


       

                        <div style={{position: 'relative', zIndex: 10, pointerEvents: 'auto', marginTop: (() => {
                          if (isMobile) return '5vh';
                          if (isTabletPortrait) return '-10rem';
                          if (isTabletLandscape) return '80vh';
                          return '5vh'; // Desktop
                        })(), marginBottom: '1rem'}}>
                         <div ref={secondTitleRef} style={{
                                  textAlign: 'center',
                                  padding: isMobile ? '3rem 1.5rem' : '5rem 2rem',
                                  maxWidth: '900px',
                                  margin: '0 auto',
                                }}>
                                  {/* Animated Drop-In Title */}
                                  <TranslatableDropInTitle
                                    lines={["PROSPER80", "FOR ALL", "HUMAN80!"]}
                                    colors={["#00ff00", "#f4e4c1", "#ffd700"]}
                                    fontSize={{ mobile: "2.5rem", desktop: "4rem" }}
                                    isMobile={isMobile}
                                    triggerAnimation={secondTitleInView}
                                    language={language}
                                    key={`dropintitle-${isMobile ? 'mobile' : 'desktop'}-${language}`}
                                  />
                                  {/* Debug info - remove after testing */}
                                  {/* <div style={{color: '#fff', fontSize: '12px', marginTop: '10px'}}>
                                    Debug: {secondTitleInView ? 'IN VIEW' : 'NOT IN VIEW'}
                                  </div> */}
                        </div>
                                 </div>
{/* Combined Token Information Section */}
     

        


     

        
        {/* Additional scroll space before footer */}
        <div style={{
          position: 'relative',
          height: '300vh', // Extended footer area for additional content if needed
          width: '100%',
          zIndex: 1,
        }} />
        
        {/* Footer - at the bottom of all content */}
        <div style={{ pointerEvents: 'auto', position: 'relative', zIndex: 10 }}>
          <Footer isMobile={isMobile} />
        </div>


      {/* </motion.div> */}

      Add spinning record CSS and fonts
      <style jsx global>{`
        /* Performance Monitor Styling */
        .perf-monitor {
          position: fixed !important;
          top: 10px !important;
          left: 10px !important;
          z-index: 10000 !important;
          transform: scale(0.5) !important;
          transform-origin: top left !important;
          opacity: 0.8 !important;
        }
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        html {
          width: 100%;
          height: auto;
          margin: 0;
          padding: 0;
          overflow-x: hidden;
          overflow-y: auto;
          box-sizing: border-box;
          scroll-behavior: auto;
          touch-action: pan-y; /* Allow vertical scrolling on touch devices */
        }
        
        body {
          width: 100%;
          height: auto;
          margin: 0;
          padding: 0;
          overflow-x: hidden;
          overflow-y: visible;
          box-sizing: border-box;
        }
        
        body > div:first-child {
          height: auto;
          min-height: 100vh;
        }
        
        #__next {
          height: auto;
          min-height: 100vh;
        }
        
        canvas {
          display: block !important;
          width: 100% !important;
          height: 100% !important;
        }
        
        @font-face {
          font-family: 'UnifrakturCook';
          src: url('/fonts/UnifrakturCook-Bold.ttf') format('truetype');
          font-weight: bold;
          font-style: normal;
          font-display: swap;
        }
        
        @font-face {
          font-family: 'UnifrakturMaguntia';
          src: url('/fonts/UnifrakturMaguntia-Regular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }

          @font-face {
          font-family: 'Bowlby One SC';
          src: url('/fonts/BowlbyOneSC-Regular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        /* Desktop rotating text - larger size */
        .desktop-rotating-text .rotating-text-body {
          font-size: 4rem !important;
        }
        
        .desktop-rotating-text .t3xts {
          height: 70px !important;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes glow {
          0% { filter: drop-shadow(0 0 25px rgba(0, 255, 0, 0.4)) drop-shadow(0 0 50px rgba(255, 215, 0, 0.2)); }
          100% { filter: drop-shadow(0 0 35px rgba(0, 255, 0, 0.6)) drop-shadow(0 0 60px rgba(255, 215, 0, 0.3)); }
        }

        @keyframes handsRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes statsRotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .spinning-record {
          animation: spin 3s linear infinite;
        }
        
        /* Complete 3D Coin CSS from coin.css */
        :root {
          --coin-diam: 6.75rem;
          --coin-depth: calc(var(--coin-diam) * 0.1);
          --spin-speed: 4s;
          --facets: 32;
          --spokes: calc(var(--facets) / 2);
          --facet-length: calc(var(--coin-diam) * sin(calc(3.14159 / var(--facets))));
          --facet-angle: calc((180deg - (360deg / var(--facets))) / 2);
        }

        .purse {
          height: var(--coin-diam);
          width: var(--coin-diam);
          position: relative;
          margin: 0 auto;
          perspective: 1000px;
          filter: saturate(1.45) hue-rotate(2deg);
        }

        .coin {
          height: var(--coin-diam);
          width: var(--coin-diam);
          position: absolute;
          transform-style: preserve-3d;
          transform-origin: 50%;
          animation: spinCoin 7s infinite linear;
          cursor: pointer;
        }

        .coin .front,
        .coin .back {
          position: absolute;
          height: var(--coin-diam);
          width: var(--coin-diam);
          border-radius: 50%;
          background-size: cover;
        }

        .coin .front {
          transform: translateZ(calc(var(--coin-depth) / 2));
          background-image: url("/coinFront.png");
        }

        .coin .back {
          transform: translateZ(calc(var(--coin-depth) / -2)) rotateY(180deg);
          background-image: url("/coinBack1.png");
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .coin .back::after {
          content: "CLICK TO BUY!";
          color: #000000ff;
          font-family: 'FjallaOne', serif;
          font-size: calc(var(--coin-diam) * 0.15);
          font-weight: bold;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
          background: linear-gradient(135deg, rgb(255, 215, 0), rgb(212, 175, 55), rgb(184, 134, 11));
          width: calc(var(--coin-diam) * 0.85);
          height: calc(var(--coin-diam) * 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          text-align: center;
          line-height: 1.2;
          border: 3px solid #fff;
          box-shadow: 
            0 0 20px rgba(255, 215, 0, 0.8),
            0 0 40px rgba(255, 215, 0, 0.4),
            inset 0 2px 0 rgba(255, 255, 255, 0.3),
            inset 0 -2px 0 rgba(0, 0, 0, 0.3);
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        .coin .side {
          transform: translateX(calc(var(--coin-diam) * 0.45));
          transform-style: preserve-3d;
          backface-visibility: hidden;
        }

        .coin .side .spoke {
          height: var(--coin-diam);
          width: var(--coin-depth);
          position: absolute;
          transform-style: preserve-3d;
          backface-visibility: hidden;
        }

        .coin .side .spoke::before,
        .coin .side .spoke::after {
          content: "";
          display: block;
          height: var(--facet-length);
          width: var(--coin-depth);
          position: absolute;
          background: hsl(42, 52%, 68%);
          background: linear-gradient(
            to bottom,
            hsl(42, 60%, 75%) 0%,
            hsl(42, 60%, 75%) 74%,
            hsl(42, 40%, 60%) 75%,
            hsl(42, 40%, 60%) 100%
          );
          background-size: 100% calc((var(--facets) * var(--facet-length)) / 144);
          transform: rotateX(var(--facet-angle));
        }

        .coin .side .spoke::before {
          transform-origin: top center;
        }

        .coin .side .spoke::after {
          bottom: 0;
          transform-origin: center bottom;
        }

        .coin .side .spoke:nth-child(1) { transform: rotateY(90deg) rotateX(calc(180deg / var(--spokes) * 0)); }
        .coin .side .spoke:nth-child(2) { transform: rotateY(90deg) rotateX(calc(180deg / var(--spokes) * 1)); }
        .coin .side .spoke:nth-child(3) { transform: rotateY(90deg) rotateX(calc(180deg / var(--spokes) * 2)); }
        .coin .side .spoke:nth-child(4) { transform: rotateY(90deg) rotateX(calc(180deg / var(--spokes) * 3)); }
        .coin .side .spoke:nth-child(5) { transform: rotateY(90deg) rotateX(calc(180deg / var(--spokes) * 4)); }
        .coin .side .spoke:nth-child(6) { transform: rotateY(90deg) rotateX(calc(180deg / var(--spokes) * 5)); }
        .coin .side .spoke:nth-child(7) { transform: rotateY(90deg) rotateX(calc(180deg / var(--spokes) * 6)); }
        .coin .side .spoke:nth-child(8) { transform: rotateY(90deg) rotateX(calc(180deg / var(--spokes) * 7)); }
        .coin .side .spoke:nth-child(9) { transform: rotateY(90deg) rotateX(calc(180deg / var(--spokes) * 8)); }
        .coin .side .spoke:nth-child(10) { transform: rotateY(90deg) rotateX(calc(180deg / var(--spokes) * 9)); }
        .coin .side .spoke:nth-child(11) { transform: rotateY(90deg) rotateX(calc(180deg / var(--spokes) * 10)); }
        .coin .side .spoke:nth-child(12) { transform: rotateY(90deg) rotateX(calc(180deg / var(--spokes) * 11)); }
        .coin .side .spoke:nth-child(13) { transform: rotateY(90deg) rotateX(calc(180deg / var(--spokes) * 12)); }
        .coin .side .spoke:nth-child(14) { transform: rotateY(90deg) rotateX(calc(180deg / var(--spokes) * 13)); }
        .coin .side .spoke:nth-child(15) { transform: rotateY(90deg) rotateX(calc(180deg / var(--spokes) * 14)); }
        .coin .side .spoke:nth-child(16) { transform: rotateY(90deg) rotateX(calc(180deg / var(--spokes) * 15)); }

        @keyframes spinCoin {
          0% { transform: rotateY(0deg); }
          25% { transform: rotateY(0deg); }
          37.5% { transform: rotateY(540deg); }
          62.5% { transform: rotateY(540deg); }
          75% { transform: rotateY(1080deg); }
          100% { transform: rotateY(1080deg); }
        }
       /* Override the font hiding rule for our title */
        .custom-title {
          font-family: 'UnifrakturCook', 'UnifrakturMaguntia', serif !important;
          visibility: visible !important;
          display: block !important;
          opacity: 1 !important;
        }

        .footer-title {
          font-family: 'UnifrakturCook', serif !important;
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        .custom-title span {
          visibility: visible !important;
          opacity: 1 !important;
        }
        
        
        /* Custom scrollbar for leaderboard */
        .leaderboard-scroll::-webkit-scrollbar {
          width: 6px;
        }
        
        .leaderboard-scroll::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }
        
        .leaderboard-scroll::-webkit-scrollbar-thumb {
          background: rgba(212, 175, 55, 0.5);
          border-radius: 3px;
        }
        
        .leaderboard-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(212, 175, 55, 0.7);
        }
        
        /* Simple Leva positioning fix */
        [data-leva-root] {
          top: 3rem !important;
          z-index: 10000 !important;
        }
        
        /* Canvas pointer events handled inline */
      `}</style>
      
      {/* <CompactCandleModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCandleCreated={() => {
          // Monitor real memory usage
          if (performance.memory) {
            console.log('Memory:', (performance.memory.usedJSHeapSize / 1048576).toFixed(1) + 'MB');
          }
        }}
      /> */}
      
      {/* Floating Action Bar - Only show after scrolling past halfway point */}
      {/* {scrollY > (isMobile ? 1800 : 2400) && (
        <CyberFloatingBar isMobile={isMobile} />
      )} */}
      
    </div>
    </>
  );
}