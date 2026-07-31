import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import TBDScreen from './TBDScreen';
import RL80ChartScreen from './RL80ChartScreen';
import DetectiveScreen from './DetectiveScreen';
import RL80Screen from './RL80Screen';
import AgentChatScreen from './AgentChatScreen';
import DataCubeScreen from './DataCubeScreen';
import OrderBookScreen from './OrderBookScreen';
import MarketDepthScreen from './MarketDepthScreen';
import PriceChartScreen from './PriceChartScreen';
import VolumeAnalysisScreen from './VolumeAnalysisScreen';
import RiskMetricsScreen from './RiskMetricsScreen';
import PortfolioScreen from './PortfolioScreen';
import LiminalTeaserScreen from './LiminalTeaserScreen';
import SlotMachineScreen from './SlotMachineScreen';
import CRTScreen from './CRTScreen';
import MobiusScreen from './MobiusScreen';

function VideoScreens({ is80sMode = false, previewMode = false }) {
  const { scene } = useThree();
  const video1Ref = useRef();
  const video2Ref = useRef();
  const video3Ref = useRef();
  const video4Ref = useRef();
  const video5Ref = useRef();
  const video6Ref = useRef(); // For 80s80s80s video
  const texture1Ref = useRef();
  const texture2Ref = useRef();
  const texture3Ref = useRef();
  const texture4Ref = useRef();
  const texture5Ref = useRef();
  const texture6Ref = useRef(); // For 80s80s80s texture
  
  // Track which screens should show regular content even in 80s mode
  const [showRegularContent, setShowRegularContent] = useState({
    Screen1: false,
    Screen2: false,
    Screen3: false,
    Screen4: false
  });
  
  // Reset toggle state when 80s mode changes
  useEffect(() => {
    if (!is80sMode) {
      setShowRegularContent({
        Screen1: false,
        Screen2: false,
        Screen3: false,
        Screen4: false
      });
    }
  }, [is80sMode]);
  
  // Listen for screen click events from CyborgTempleScene
  useEffect(() => {
    const handleScreenClick = (event) => {
      if (is80sMode && event.detail && event.detail.screenName) {
        const screenName = event.detail.screenName;
        if (screenName in showRegularContent) {
          setShowRegularContent(prev => ({
            ...prev,
            [screenName]: !prev[screenName]
          }));
        }
      }
    };
    
    window.addEventListener('screenClicked', handleScreenClick);
    
    return () => {
      window.removeEventListener('screenClicked', handleScreenClick);
    };
  }, [is80sMode, showRegularContent]);

  useEffect(() => {
    // Determine which video to play based on mode
    // Using Firebase Storage CDN URLs with auth tokens
    const videoSource = is80sMode 
      ? 'https://firebasestorage.googleapis.com/v0/b/hailmary-3ff6c.firebasestorage.app/o/video%2Fsynthosaur2.mp4?alt=media&token=f972ca48-199c-4aa3-848b-b4c4492be049'
      : '/videos/23.mp4';
    const boomboxSource = is80sMode 
      ? 'https://firebasestorage.googleapis.com/v0/b/hailmary-3ff6c.firebasestorage.app/o/video%2Fboombox.mp4?alt=media&token=3c51b29d-ec93-4770-bac4-b1a42c306ab1'
      : '/videos/23.mp4';
    const eightySource = is80sMode
      ? 'https://firebasestorage.googleapis.com/v0/b/hailmary-3ff6c.firebasestorage.app/o/video%2F80s80s80s.mp4?alt=media&token=d6ff1f0a-979f-43f9-838b-5b4bb4fead76'
      : '/videos/23.mp4';
    
    const makeVideo = (src) => {
      const v = document.createElement('video');
      v.src = src;
      v.loop = true;
      v.muted = true; // Required for autoplay
      v.playsInline = true;
      v.crossOrigin = 'anonymous';
      return v;
    };

    // ONE DECODER OUTSIDE 80s MODE.
    //
    // Look at the three sources above: outside 80s mode they are all the same
    // file. This used to build five separate <video> elements pointed at it,
    // which meant five independent decoders and five downloads of the same
    // clip (measured: 5 x 572KB on every /trade load). iPadOS caps how many
    // videos can decode at once, so that was pure cost for zero difference —
    // every screen was already showing the same footage.
    //
    // 80s mode keeps five elements: there the three sources really are three
    // different files, and Screen1/Screen4 (boombox) must not be pinned to the
    // same playhead as Screen3 (synthosaur).
    const sharedVideo = is80sMode ? null : makeVideo(videoSource);

    // Create video elements
    const video1 = sharedVideo || makeVideo(boomboxSource); // Screen1 uses boombox in 80s mode
    video1Ref.current = video1;

    // Skip video2 creation since we'll use MacroAgentScreen for Screen2
    // const video2 = makeVideo(videoSource);
    // video2Ref.current = video2;

    const video3 = sharedVideo || makeVideo(videoSource);
    video3Ref.current = video3;

    const video4 = sharedVideo || makeVideo(videoSource);
    video4Ref.current = video4;

    const video5 = sharedVideo || makeVideo(boomboxSource); // Screen4 uses boombox in 80s mode
    video5Ref.current = video5;

    // Create video6 for 80s80s80s video (small screens and L/R screens)
    const video6 = sharedVideo || makeVideo(eightySource);
    video6Ref.current = video6;

    // Create video textures. Settings are byte-for-byte what each texture
    // carried before: flipY false, center 0.5, and repeat.x -1 (mirrored) on
    // 1/3/4/5 while 6 stays +1.
    const makeTexture = (video, mirrored) => {
      const t = new THREE.VideoTexture(video);
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.format = THREE.RGBFormat;
      t.flipY = false; // Flip Y-axis
      t.repeat.x = mirrored ? -1 : 1; // Flip X-axis
      t.center.set(0.5, 0.5); // Set center for proper flipping
      return t;
    };

    // 1/3/4/5 are configured identically, so when they're fed by the shared
    // element they can be ONE texture — one GPU upload per frame instead of
    // four of the same pixels. texture6 needs repeat.x +1, so it stays its own
    // texture even when it reads the shared video.
    const sharedMirrored = sharedVideo ? makeTexture(sharedVideo, true) : null;

    const texture1 = sharedMirrored || makeTexture(video1, true);
    texture1Ref.current = texture1;

    // Skip texture2 creation since we'll use MacroAgentScreen for Screen2
    // const texture2 = makeTexture(video2, true);
    // texture2Ref.current = texture2;

    const texture3 = sharedMirrored || makeTexture(video3, true);
    texture3Ref.current = texture3;

    const texture4 = sharedMirrored || makeTexture(video4, true);
    texture4Ref.current = texture4;

    const texture5 = sharedMirrored || makeTexture(video5, true);
    texture5Ref.current = texture5;

    // Create texture6 for 80s80s80s video
    const texture6 = makeTexture(video6, false);
    texture6Ref.current = texture6;

    // Find screens and apply textures
    const findAndSetupScreens = () => {
      let screen1Found = false;
      let screen1SmallFound = false;
      let screen1LFound = false;
      let screen1RFound = false;
      let screen2Found = false;
      let screen2SmallFound = false;
      let screen2LFound = false;
      let screen2RFound = false;
      let screen3Found = false;
      let screen3SmallFound = false;
      let screen3LFound = false;
      let screen3RFound = false;
      let screen4Found = false;
      let screen4SmallFound = false;
      let screen4LFound = false;
      let screen4RFound = false;
      let screen5Found = false;

      // console.log('[VideoScreens] Starting scene traversal to find screens...');
      scene.traverse((child) => {
        // Debug log for Screen1
        if (child.name === 'Screen1') {
          // console.log('[VideoScreens] Found object with name Screen1:', {
          //   isMesh: child.isMesh,
          //   type: child.type,
          //   screen1Found: screen1Found
          // });
        }
        
        // Screen1 - Setup canvas texture for RL80ChartScreen OR video texture for 80s mode
        if (child.isMesh && child.name === 'Screen1' && !screen1Found) {
          // console.log('[VideoScreens] Found Screen1, setting up texture');
          screen1Found = true;
          
          // Show video if in 80s mode AND not toggled to regular content
          if (is80sMode && !showRegularContent.Screen1) {
            // Apply video texture in 80s mode
            const material = new THREE.MeshBasicMaterial({
              map: texture1,
              side: THREE.FrontSide,
              toneMapped: false,
            });
            child.material = material;
            video1.play().catch(() => {});
          } else {
            // Create canvas for drawing
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 320;
            
            // Create texture from canvas
            const canvasTexture = new THREE.CanvasTexture(canvas);
            canvasTexture.minFilter = THREE.LinearFilter;
            canvasTexture.magFilter = THREE.LinearFilter;
            canvasTexture.flipY = false;
            canvasTexture.repeat.x = 1;
            canvasTexture.center.set(0.5, 0.5);
            
            // Apply to Screen1
            const material = new THREE.MeshBasicMaterial({
              map: canvasTexture,
              side: THREE.FrontSide,
              toneMapped: false,
            });
            
            child.material = material;
            
            // Store refs globally for RL80ChartScreen to use
            // @ts-ignore
            window['__screen1Canvas'] = canvas;
            // @ts-ignore
            window['__screen1Texture'] = canvasTexture;
            // @ts-ignore  
            window['__screen1Mesh'] = child;
          }
          
          // console.log('[VideoScreens] Screen1 canvas setup complete', {
          //   canvas: !!window['__screen1Canvas'],
          //   texture: !!window['__screen1Texture'],
          //   mesh: !!window['__screen1Mesh'],
          //   actualCanvas: canvas,
          //   actualTexture: canvasTexture
          // });
        }
        
        // Screen1_small - Apply video texture
        if (child.isMesh && child.name === 'Screen1_small' && !screen1SmallFound) {
          const material = new THREE.MeshBasicMaterial({
            map: texture6, // Use 80s80s80s video
            side: THREE.FrontSide,
            toneMapped: false,
          });
          child.material = material;
          screen1SmallFound = true;
          video6.play().catch(e => {});
        }
        
        // Screen1_LScreen - Setup canvas for Agent Chat OR video texture for 80s mode
        if (child.isMesh && child.name === 'Screen1_LScreen' && !screen1LFound) {
          // console.log('[VideoScreens] Found Screen1_LScreen');
          screen1LFound = true;
          
          if (is80sMode) {
            // Apply video texture in 80s mode
            const material = new THREE.MeshBasicMaterial({
              map: texture6, // Use 80s80s80s video
              side: THREE.FrontSide,
              toneMapped: false,
            });
            child.material = material;
            video6.play().catch(() => {});
          } else {
            // Create canvas for agent chat
            const canvasL = document.createElement('canvas');
            canvasL.width = 256;
            canvasL.height = 512;
            
            // Create texture from canvas
            const canvasTextureL = new THREE.CanvasTexture(canvasL);
            canvasTextureL.minFilter = THREE.LinearFilter;
            canvasTextureL.magFilter = THREE.LinearFilter;
            canvasTextureL.flipY = false;
            canvasTextureL.repeat.x = 1;
            canvasTextureL.center.set(0.5, 0.5);
            
            // Apply to Screen1_LScreen
            const materialL = new THREE.MeshBasicMaterial({
              map: canvasTextureL,
              side: THREE.FrontSide,
              toneMapped: false,
            });
            
            child.material = materialL;
            
            // Store refs globally for AgentChatScreen to use
            // @ts-ignore
            window['__screen1LCanvas'] = canvasL;
            // @ts-ignore
            window['__screen1LTexture'] = canvasTextureL;
            // @ts-ignore
            window['__screen1LMesh'] = child;
          }
          
          // console.log('[VideoScreens] Screen1_LScreen canvas setup complete');
        }
        
        // Screen1_RScreen - Setup canvas for Data Cube OR video texture for 80s mode
        if (child.isMesh && child.name === 'Screen1_RScreen' && !screen1RFound) {
          // console.log('[VideoScreens] Found Screen1_RScreen');
          screen1RFound = true;
          
          if (is80sMode) {
            // Apply video texture in 80s mode
            const material = new THREE.MeshBasicMaterial({
              map: texture6, // Use 80s80s80s video
              side: THREE.FrontSide,
              toneMapped: false,
            });
            child.material = material;
            video6.play().catch(() => {});
          } else {
            // Create canvas for data visualization
            const canvasR = document.createElement('canvas');
            canvasR.width = 256;
            canvasR.height = 512;
            
            // Create texture from canvas
            const canvasTextureR = new THREE.CanvasTexture(canvasR);
            canvasTextureR.minFilter = THREE.LinearFilter;
            canvasTextureR.magFilter = THREE.LinearFilter;
            canvasTextureR.flipY = false;
            canvasTextureR.repeat.x = 1;
            canvasTextureR.center.set(0.5, 0.5);
            
            // Apply to Screen1_RScreen
            const materialR = new THREE.MeshBasicMaterial({
              map: canvasTextureR,
              side: THREE.FrontSide,
              toneMapped: false,
            });
            
            child.material = materialR;
            
            // Store refs globally for DataCubeScreen to use
            // @ts-ignore
            window['__screen1RCanvas'] = canvasR;
            // @ts-ignore
            window['__screen1RTexture'] = canvasTextureR;
            // @ts-ignore
            window['__screen1RMesh'] = child;
          }
          
          // console.log('[VideoScreens] Screen1_RScreen canvas setup complete');
        }
        
        // Screen2 - Keep original GLB image texture (or waves video in preview mode)
        if (child.isMesh && child.name === 'Screen2' && !screen2Found) {
          screen2Found = true;
          if (previewMode) {
            // Canvas texture — CRTScreen paints it via __screen2Canvas
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 320;
            const canvasTexture = new THREE.CanvasTexture(canvas);
            canvasTexture.minFilter = THREE.LinearFilter;
            canvasTexture.magFilter = THREE.LinearFilter;
            canvasTexture.flipY = false;
            canvasTexture.center.set(0.5, 0.5);
            child.material = new THREE.MeshBasicMaterial({
              map: canvasTexture,
              side: THREE.FrontSide,
              toneMapped: false,
            });
            window['__screen2Canvas'] = canvas;
            window['__screen2Texture'] = canvasTexture;
            window['__screen2Mesh'] = child;
          }
          // Otherwise using the image texture already applied in the GLB
        }
        
        // Screen2_small - Apply video texture
        if (child.isMesh && child.name === 'Screen2_small' && !screen2SmallFound) {
          const material = new THREE.MeshBasicMaterial({
            map: texture6, // Use 80s80s80s video
            side: THREE.FrontSide,
            toneMapped: false,
          });
          child.material = material;
          screen2SmallFound = true;
          video6.play().catch(e => {});
        }
        
        // Screen2_LScreen - Setup canvas for Order Book OR video texture for 80s mode
        if (child.isMesh && child.name === 'Screen2_LScreen' && !screen2LFound) {
          screen2LFound = true;
          
          if (is80sMode) {
            // Apply video texture in 80s mode
            const material = new THREE.MeshBasicMaterial({
              map: texture6, // Use 80s80s80s video
              side: THREE.FrontSide,
              toneMapped: false,
            });
            child.material = material;
            video6.play().catch(() => {});
          } else {
            const canvas2L = document.createElement('canvas');
            canvas2L.width = 256;
            canvas2L.height = 512;
            
            const canvasTexture2L = new THREE.CanvasTexture(canvas2L);
            canvasTexture2L.minFilter = THREE.LinearFilter;
            canvasTexture2L.magFilter = THREE.LinearFilter;
            canvasTexture2L.flipY = false;
            canvasTexture2L.repeat.x = 1;
            canvasTexture2L.center.set(0.5, 0.5);
            
            const material2L = new THREE.MeshBasicMaterial({
              map: canvasTexture2L,
              side: THREE.FrontSide,
              toneMapped: false,
            });
            
            child.material = material2L;
            
            // @ts-ignore
            window['__screen2LCanvas'] = canvas2L;
            // @ts-ignore
            window['__screen2LTexture'] = canvasTexture2L;
            // @ts-ignore
            window['__screen2LMesh'] = child;
          }
        }
        
        // Screen2_RScreen - Setup canvas for Market Depth OR video texture for 80s mode
        if (child.isMesh && child.name === 'Screen2_RScreen' && !screen2RFound) {
          screen2RFound = true;
          
          if (is80sMode) {
            // Apply video texture in 80s mode
            const material = new THREE.MeshBasicMaterial({
              map: texture6, // Use 80s80s80s video
              side: THREE.FrontSide,
              toneMapped: false,
            });
            child.material = material;
            video6.play().catch(() => {});
          } else {
            const canvas2R = document.createElement('canvas');
            canvas2R.width = 256;
            canvas2R.height = 512;
            
            const canvasTexture2R = new THREE.CanvasTexture(canvas2R);
            canvasTexture2R.minFilter = THREE.LinearFilter;
            canvasTexture2R.magFilter = THREE.LinearFilter;
            canvasTexture2R.flipY = false;
            canvasTexture2R.repeat.x = 1;
            canvasTexture2R.center.set(0.5, 0.5);
            
            const material2R = new THREE.MeshBasicMaterial({
              map: canvasTexture2R,
              side: THREE.FrontSide,
              toneMapped: false,
            });
            
            child.material = material2R;
            
            // @ts-ignore
            window['__screen2RCanvas'] = canvas2R;
            // @ts-ignore
            window['__screen2RTexture'] = canvasTexture2R;
            // @ts-ignore
            window['__screen2RMesh'] = child;
          }
        }
        
        // Screen3 - Setup canvas texture for TeknoScreen OR video texture for 80s mode
        if (child.isMesh && child.name === 'Screen3' && !screen3Found) {
          // console.log('[VideoScreens] Found Screen3');
          screen3Found = true;

          if (previewMode) {
            // Preview mode → CRTScreen via __screen3Canvas
            const canvas3 = document.createElement('canvas');
            canvas3.width = 512;
            canvas3.height = 320;
            const canvasTexture3 = new THREE.CanvasTexture(canvas3);
            canvasTexture3.minFilter = THREE.LinearFilter;
            canvasTexture3.magFilter = THREE.LinearFilter;
            canvasTexture3.flipY = false;
            canvasTexture3.center.set(0.5, 0.5);
            child.material = new THREE.MeshBasicMaterial({
              map: canvasTexture3,
              side: THREE.FrontSide,
              toneMapped: false,
            });
            window['__screen3Canvas'] = canvas3;
            window['__screen3Texture'] = canvasTexture3;
            window['__screen3Mesh'] = child;
          } else
          // Show video if in 80s mode AND not toggled to regular content
          if (is80sMode && !showRegularContent.Screen3) {
            // Apply video texture in 80s mode
            const material = new THREE.MeshBasicMaterial({
              map: texture4,
              side: THREE.FrontSide,
              toneMapped: false,
            });
            child.material = material;
            video4.play().catch(() => {});
          } else {
            // Create canvas for drawing
            const canvas3 = document.createElement('canvas');
            canvas3.width = 512;
            canvas3.height = 320;
            
            // Create texture from canvas
            const canvasTexture3 = new THREE.CanvasTexture(canvas3);
            canvasTexture3.minFilter = THREE.LinearFilter;
            canvasTexture3.magFilter = THREE.LinearFilter;
            canvasTexture3.flipY = false;
            canvasTexture3.repeat.x = 1;
            canvasTexture3.center.set(0.5, 0.5);
            
            // Apply to Screen3
            const material3 = new THREE.MeshBasicMaterial({
              map: canvasTexture3,
              side: THREE.FrontSide,
              toneMapped: false,
            });
            
            child.material = material3;
            
            // Store refs globally for TeknoScreen to use
            // @ts-ignore
            window['__screen3Canvas'] = canvas3;
            // @ts-ignore
            window['__screen3Texture'] = canvasTexture3;
            // @ts-ignore
            window['__screen3Mesh'] = child;
          }
          
          // console.log('[VideoScreens] Screen3 canvas setup complete for TeknoScreen');
        }
        
        // Screen3_small - Apply video texture
        if (child.isMesh && child.name === 'Screen3_small' && !screen3SmallFound) {
          const material = new THREE.MeshBasicMaterial({
            map: texture6, // Use 80s80s80s video
            side: THREE.FrontSide,
            toneMapped: false,
          });
          child.material = material;
          screen3SmallFound = true;
          video6.play().catch(e => {});
        }
        
        // Screen3_LScreen - Setup canvas for Price Chart OR video texture for 80s mode
        if (child.isMesh && child.name === 'Screen3_LScreen' && !screen3LFound) {
          screen3LFound = true;
          
          if (is80sMode) {
            // Apply video texture in 80s mode
            const material = new THREE.MeshBasicMaterial({
              map: texture6, // Use 80s80s80s video
              side: THREE.FrontSide,
              toneMapped: false,
            });
            child.material = material;
            video6.play().catch(() => {});
          } else {
            const canvas3L = document.createElement('canvas');
            canvas3L.width = 256;
            canvas3L.height = 512;
            
            const canvasTexture3L = new THREE.CanvasTexture(canvas3L);
            canvasTexture3L.minFilter = THREE.LinearFilter;
            canvasTexture3L.magFilter = THREE.LinearFilter;
            canvasTexture3L.flipY = false;
            canvasTexture3L.repeat.x = 1;
            canvasTexture3L.center.set(0.5, 0.5);
            
            const material3L = new THREE.MeshBasicMaterial({
              map: canvasTexture3L,
              side: THREE.FrontSide,
              toneMapped: false,
            });
            
            child.material = material3L;
            
            // @ts-ignore
            window['__screen3LCanvas'] = canvas3L;
            // @ts-ignore
            window['__screen3LTexture'] = canvasTexture3L;
            // @ts-ignore
            window['__screen3LMesh'] = child;
          }
        }
        
        // Screen3_RScreen - Setup canvas for Volume Analysis OR video texture for 80s mode
        if (child.isMesh && child.name === 'Screen3_RScreen' && !screen3RFound) {
          screen3RFound = true;
          
          if (is80sMode) {
            // Apply video texture in 80s mode
            const material = new THREE.MeshBasicMaterial({
              map: texture6, // Use 80s80s80s video
              side: THREE.FrontSide,
              toneMapped: false,
            });
            child.material = material;
            video6.play().catch(() => {});
          } else {
            const canvas3R = document.createElement('canvas');
            canvas3R.width = 256;
            canvas3R.height = 512;
            
            const canvasTexture3R = new THREE.CanvasTexture(canvas3R);
            canvasTexture3R.minFilter = THREE.LinearFilter;
            canvasTexture3R.magFilter = THREE.LinearFilter;
            canvasTexture3R.flipY = false;
            canvasTexture3R.repeat.x = 1;
            canvasTexture3R.center.set(0.5, 0.5);
            
            const material3R = new THREE.MeshBasicMaterial({
              map: canvasTexture3R,
              side: THREE.FrontSide,
              toneMapped: false,
            });
            
            child.material = material3R;
            
            // @ts-ignore
            window['__screen3RCanvas'] = canvas3R;
            // @ts-ignore
            window['__screen3RTexture'] = canvasTexture3R;
            // @ts-ignore
            window['__screen3RMesh'] = child;
          }
        }
        
        // Screen4 - Keep original GLB image texture (or CRT canvas in preview mode)
        if (child.isMesh && child.name === 'Screen4' && !screen4Found) {
          screen4Found = true;
          if (previewMode) {
            const canvas4 = document.createElement('canvas');
            canvas4.width = 512;
            canvas4.height = 320;
            const canvasTexture4 = new THREE.CanvasTexture(canvas4);
            canvasTexture4.minFilter = THREE.LinearFilter;
            canvasTexture4.magFilter = THREE.LinearFilter;
            canvasTexture4.flipY = false;
            canvasTexture4.center.set(0.5, 0.5);
            child.material = new THREE.MeshBasicMaterial({
              map: canvasTexture4,
              side: THREE.FrontSide,
              toneMapped: false,
            });
            window['__screen4Canvas'] = canvas4;
            window['__screen4Texture'] = canvasTexture4;
            window['__screen4Mesh'] = child;
          }
          // Otherwise using the image texture already applied in the GLB
        }

        // Screen4_small - Apply video texture
        if (child.isMesh && child.name === 'Screen4_small' && !screen4SmallFound) {
          const material = new THREE.MeshBasicMaterial({
            map: texture6, // Use 80s80s80s video
            side: THREE.FrontSide,
            toneMapped: false,
          });
          child.material = material;
          screen4SmallFound = true;
          video6.play().catch(e => {});
        }
        
        // Screen4_LScreen - Setup canvas for Risk Metrics OR video texture for 80s mode
        if (child.isMesh && child.name === 'Screen4_LScreen' && !screen4LFound) {
          screen4LFound = true;
          
          if (is80sMode) {
            // Apply video texture in 80s mode
            const material = new THREE.MeshBasicMaterial({
              map: texture6, // Use 80s80s80s video
              side: THREE.FrontSide,
              toneMapped: false,
            });
            child.material = material;
            video6.play().catch(() => {});
          } else {
            const canvas4L = document.createElement('canvas');
            canvas4L.width = 256;
            canvas4L.height = 512;
            
            const canvasTexture4L = new THREE.CanvasTexture(canvas4L);
            canvasTexture4L.minFilter = THREE.LinearFilter;
            canvasTexture4L.magFilter = THREE.LinearFilter;
            canvasTexture4L.flipY = false;
            canvasTexture4L.repeat.x = 1;
            canvasTexture4L.center.set(0.5, 0.5);
            
            const material4L = new THREE.MeshBasicMaterial({
              map: canvasTexture4L,
              side: THREE.FrontSide,
              toneMapped: false,
            });
            
            child.material = material4L;
            
            // @ts-ignore
            window['__screen4LCanvas'] = canvas4L;
            // @ts-ignore
            window['__screen4LTexture'] = canvasTexture4L;
            // @ts-ignore
            window['__screen4LMesh'] = child;
          }
        }
        
        // Screen4_RScreen - Setup canvas for Portfolio OR video texture for 80s mode
        if (child.isMesh && child.name === 'Screen4_RScreen' && !screen4RFound) {
          screen4RFound = true;
          
          if (is80sMode) {
            // Apply video texture in 80s mode
            const material = new THREE.MeshBasicMaterial({
              map: texture6, // Use 80s80s80s video
              side: THREE.FrontSide,
              toneMapped: false,
            });
            child.material = material;
            video6.play().catch(() => {});
          } else {
            const canvas4R = document.createElement('canvas');
            canvas4R.width = 256;
            canvas4R.height = 512;
            
            const canvasTexture4R = new THREE.CanvasTexture(canvas4R);
            canvasTexture4R.minFilter = THREE.LinearFilter;
            canvasTexture4R.magFilter = THREE.LinearFilter;
            canvasTexture4R.flipY = false;
            canvasTexture4R.repeat.x = 1;
            canvasTexture4R.center.set(0.5, 0.5);
            
            const material4R = new THREE.MeshBasicMaterial({
              map: canvasTexture4R,
              side: THREE.FrontSide,
              toneMapped: false,
            });
            
            child.material = material4R;
            
            // @ts-ignore
            window['__screen4RCanvas'] = canvas4R;
            // @ts-ignore
            window['__screen4RTexture'] = canvasTexture4R;
            // @ts-ignore
            window['__screen4RMesh'] = child;
          }
        }
        
        if (child.isMesh && child.name === 'Screen5' && !screen5Found) {
          const material = new THREE.MeshBasicMaterial({
            map: texture5,
            side: THREE.FrontSide,
            toneMapped: false,
          });
          child.material = material;
          screen5Found = true;
          video5.play().catch(e => {});
        }
        
        // Removed fallback material code - it was interfering with Screen1 setup
      });

      const allScreensFound = screen1Found || screen1SmallFound || screen1LFound || screen1RFound || 
                             screen2Found || screen2SmallFound || screen2LFound || screen2RFound ||
                             screen3Found || screen3SmallFound || screen3LFound || screen3RFound ||
                             screen4Found || screen4SmallFound || screen4LFound || screen4RFound || 
                             screen5Found;
      
      // console.log('[VideoScreens] Search results:', {
      //   screen1Found, screen2Found, screen3Found, screen4Found,
      //   screen1SmallFound, screen2SmallFound, screen3SmallFound, screen4SmallFound
      // });
      
      if (!allScreensFound) {
        // console.log('[VideoScreens] No screens found, retrying in 500ms...');
        // Keep retrying if no screens found at all
        setTimeout(findAndSetupScreens, 500);
      } else {
        // At least some screens were found, setup interaction handler
        const handleInteraction = () => {
          video1.play().catch(() => {});
          // video2 is handled by MacroAgentScreen
          video3.play().catch(() => {});
          video4.play().catch(() => {});
          video5.play().catch(() => {});
          video6.play().catch(() => {});
          document.removeEventListener('click', handleInteraction);
          document.removeEventListener('touchstart', handleInteraction);
        };

        document.addEventListener('click', handleInteraction);
        document.addEventListener('touchstart', handleInteraction);
      }
    };

    findAndSetupScreens();

    // Cleanup
    return () => {
      if (video1Ref.current) {
        video1Ref.current.pause();
        video1Ref.current.src = '';
      }
      // video2 is handled by MacroAgentScreen
      // if (video2Ref.current) {
      //   video2Ref.current.pause();
      //   video2Ref.current.src = '';
      // }
      if (video3Ref.current) {
        video3Ref.current.pause();
        video3Ref.current.src = '';
      }
      if (video4Ref.current) {
        video4Ref.current.pause();
        video4Ref.current.src = '';
      }
      if (video5Ref.current) {
        video5Ref.current.pause();
        video5Ref.current.src = '';
      }
      if (video6Ref.current) {
        video6Ref.current.pause();
        video6Ref.current.src = '';
      }
      if (texture1Ref.current) texture1Ref.current.dispose();
      // if (texture2Ref.current) texture2Ref.current.dispose();
      if (texture3Ref.current) texture3Ref.current.dispose();
      if (texture4Ref.current) texture4Ref.current.dispose();
      if (texture5Ref.current) texture5Ref.current.dispose();
      if (texture6Ref.current) texture6Ref.current.dispose();
    };
  }, [scene, is80sMode, showRegularContent, previewMode]);

  // Find Screen2 position and render MacroAgentScreen there
  const [screen2Position, setScreen2Position] = useState(null);
  const [screen2Rotation, setScreen2Rotation] = useState(null);
  const [screen2Scale, setScreen2Scale] = useState(null);

  // Cleanup effect for screen textures
  useEffect(() => {
    return () => {
      // Clean up Screen1
      // @ts-ignore
      if (window.__screen1Canvas) {
        // @ts-ignore
        delete window.__screen1Canvas;
      }
      // @ts-ignore
      if (window.__screen1Texture) {
        // @ts-ignore
        window.__screen1Texture.dispose();
        // @ts-ignore
        delete window.__screen1Texture;
      }
      // @ts-ignore
      if (window.__screen1Mesh) {
        // @ts-ignore
        delete window.__screen1Mesh;
      }
      
      // Clean up Screen1 Left
      // @ts-ignore
      if (window.__screen1LCanvas) {
        // @ts-ignore
        delete window.__screen1LCanvas;
      }
      // @ts-ignore
      if (window.__screen1LTexture) {
        // @ts-ignore
        window.__screen1LTexture.dispose();
        // @ts-ignore
        delete window.__screen1LTexture;
      }
      // @ts-ignore
      if (window.__screen1LMesh) {
        // @ts-ignore
        delete window.__screen1LMesh;
      }
      
      // Clean up Screen1 Right
      // @ts-ignore
      if (window.__screen1RCanvas) {
        // @ts-ignore
        delete window.__screen1RCanvas;
      }
      // @ts-ignore
      if (window.__screen1RTexture) {
        // @ts-ignore
        window.__screen1RTexture.dispose();
        // @ts-ignore
        delete window.__screen1RTexture;
      }
      // @ts-ignore
      if (window.__screen1RMesh) {
        // @ts-ignore
        delete window.__screen1RMesh;
      }
      
      // Clean up Screen2
      // @ts-ignore
      if (window.__screen2Canvas) {
        // @ts-ignore
        delete window.__screen2Canvas;
      }
      // @ts-ignore
      if (window.__screen2Texture) {
        // @ts-ignore
        window.__screen2Texture.dispose();
        // @ts-ignore
        delete window.__screen2Texture;
      }
      // @ts-ignore
      if (window.__screen2Mesh) {
        // @ts-ignore
        delete window.__screen2Mesh;
      }
      
      // Clean up Screen3
      // @ts-ignore
      if (window.__screen3Canvas) {
        // @ts-ignore
        delete window.__screen3Canvas;
      }
      // @ts-ignore
      if (window.__screen3Texture) {
        // @ts-ignore
        window.__screen3Texture.dispose();
        // @ts-ignore
        delete window.__screen3Texture;
      }
      // @ts-ignore
      if (window.__screen3Mesh) {
        // @ts-ignore
        delete window.__screen3Mesh;
      }
      
      // Clean up Screen4
      // @ts-ignore
      if (window.__screen4Canvas) {
        // @ts-ignore
        delete window.__screen4Canvas;
      }
      // @ts-ignore
      if (window.__screen4Texture) {
        // @ts-ignore
        window.__screen4Texture.dispose();
        // @ts-ignore
        delete window.__screen4Texture;
      }
      // @ts-ignore
      if (window.__screen4Mesh) {
        // @ts-ignore
        delete window.__screen4Mesh;
      }
    };
  }, []);

  if (previewMode) {
    // Liminal Terminal preview — each screen paints a cryptic teaser instead
    // of the live trading content. Four big center screens map to the four
    // agents; surrounding panels cycle generic glyph/countdown/scanline art
    // to build a "coming soon" atmosphere.
    return (
      <>
        {/* Screen3 → Detective's crypto-fraud investigation terminal */}
        <DetectiveScreen />
        {/* Screen1/2/4 → mock CRT panels — three different variants so each
            monitor reads as its own instrument. */}
        <CRTScreen
          canvasGlobal="__screen1Canvas"
          textureGlobal="__screen1Texture"
          variant="leaderboard"
        />
        <CRTScreen
          canvasGlobal="__screen2Canvas"
          textureGlobal="__screen2Texture"
          variant="scope"
        />
        {/* Screen4 → Möbius / spiral-cell shader (Pixelomo, MIT) */}
        <MobiusScreen
          canvasGlobal="__screen4Canvas"
          textureGlobal="__screen4Texture"
        />

        {/* Side panels — countdown + scanline + glyph fields for atmosphere */}
        <LiminalTeaserScreen
          canvasGlobal="__screen1LCanvas"
          textureGlobal="__screen1LTexture"
          variant="countdown"
        />
        <LiminalTeaserScreen
          canvasGlobal="__screen1RCanvas"
          textureGlobal="__screen1RTexture"
          variant="glyph"
          tagline="SCROLL · I"
        />
        <LiminalTeaserScreen
          canvasGlobal="__screen2LCanvas"
          textureGlobal="__screen2LTexture"
          variant="scanlines"
        />
        <LiminalTeaserScreen
          canvasGlobal="__screen2RCanvas"
          textureGlobal="__screen2RTexture"
          variant="glyph"
          tagline="SCROLL · II"
        />
        <LiminalTeaserScreen
          canvasGlobal="__screen3LCanvas"
          textureGlobal="__screen3LTexture"
          variant="scanlines"
        />
        <LiminalTeaserScreen
          canvasGlobal="__screen3RCanvas"
          textureGlobal="__screen3RTexture"
          variant="glyph"
          tagline="SCROLL · III"
        />
        <LiminalTeaserScreen
          canvasGlobal="__screen4LCanvas"
          textureGlobal="__screen4LTexture"
          variant="countdown"
        />
        <LiminalTeaserScreen
          canvasGlobal="__screen4RCanvas"
          textureGlobal="__screen4RTexture"
          variant="glyph"
          tagline="SCROLL · IV"
        />
      </>
    );
  }

  return (
    <>
      <RL80ChartScreen />
      <TBDScreen />
      <DetectiveScreen />
      <RL80Screen />
      <AgentChatScreen />
      <DataCubeScreen />
      <OrderBookScreen />
      <MarketDepthScreen />
      <PriceChartScreen />
      <VolumeAnalysisScreen />
      <RiskMetricsScreen />
      <PortfolioScreen />
    </>
  );
}

export default VideoScreens;