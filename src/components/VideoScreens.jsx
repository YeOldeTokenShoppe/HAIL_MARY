import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import MacroAgentScreen from './MacroAgentScreen';
import SentimentScreen from './SentimentScreen';
import TeknoScreen from './TeknoScreen';
import RL80Screen from './RL80Screen';
import AgentChatScreen from './AgentChatScreen';
import DataCubeScreen from './DataCubeScreen';
import OrderBookScreen from './OrderBookScreen';
import MarketDepthScreen from './MarketDepthScreen';
import PriceChartScreen from './PriceChartScreen';
import VolumeAnalysisScreen from './VolumeAnalysisScreen';
import RiskMetricsScreen from './RiskMetricsScreen';
import PortfolioScreen from './PortfolioScreen';

function VideoScreens() {
  const { scene } = useThree();
  const video1Ref = useRef();
  const video2Ref = useRef();
  const video3Ref = useRef();
  const video4Ref = useRef();
  const video5Ref = useRef();
  const texture1Ref = useRef();
  const texture2Ref = useRef();
  const texture3Ref = useRef();
  const texture4Ref = useRef();
  const texture5Ref = useRef();

  useEffect(() => {
    // Create video elements
    const video1 = document.createElement('video');
    video1.src = '/videos/23.mp4';
    video1.loop = true;
    video1.muted = true; // Required for autoplay
    video1.playsInline = true;
    video1.crossOrigin = 'anonymous';
    video1Ref.current = video1;

    // Skip video2 creation since we'll use MacroAgentScreen for Screen2
    // const video2 = document.createElement('video');
    // video2.src = '/videos/23.mp4';
    // video2.loop = true;
    // video2.muted = true; // Required for autoplay
    // video2.playsInline = true;
    // video2.crossOrigin = 'anonymous';
    // video2Ref.current = video2;

    const video3 = document.createElement('video');
    video3.src = '/videos/23.mp4';
    video3.loop = true;
    video3.muted = true;
    video3.playsInline = true;
    video3.crossOrigin = 'anonymous';
    video3Ref.current = video3;

    const video4 = document.createElement('video');
    video4.src = '/videos/23.mp4';
    video4.loop = true;
    video4.muted = true;
    video4.playsInline = true;
    video4.crossOrigin = 'anonymous';
    video4Ref.current = video4;

    const video5 = document.createElement('video');
    video5.src = '/videos/23.mp4';
    video5.loop = true;
    video5.muted = true;
    video5.playsInline = true;
    video5.crossOrigin = 'anonymous';
    video5Ref.current = video5;

    // Create video textures
    const texture1 = new THREE.VideoTexture(video1);
    texture1.minFilter = THREE.LinearFilter;
    texture1.magFilter = THREE.LinearFilter;
    texture1.format = THREE.RGBFormat;
    texture1.flipY = false; // Flip Y-axis
    texture1.repeat.x = -1; // Flip X-axis
    texture1.center.set(0.5, 0.5); // Set center for proper flipping
    texture1Ref.current = texture1;

    // Skip texture2 creation since we'll use MacroAgentScreen for Screen2
    // const texture2 = new THREE.VideoTexture(video2);
    // texture2.minFilter = THREE.LinearFilter;
    // texture2.magFilter = THREE.LinearFilter;
    // texture2.format = THREE.RGBFormat;
    // texture2.flipY = false; // Flip Y-axis
    // texture2.repeat.x = -1; // Flip X-axis
    // texture2.center.set(0.5, 0.5); // Set center for proper flipping
    // texture2Ref.current = texture2;

    const texture3 = new THREE.VideoTexture(video3);
    texture3.minFilter = THREE.LinearFilter;
    texture3.magFilter = THREE.LinearFilter;
    texture3.format = THREE.RGBFormat;
    texture3.flipY = false; // Flip Y-axis
    texture3.repeat.x = -1; // Flip X-axis
    texture3.center.set(0.5, 0.5); // Set center for proper flipping
    texture3Ref.current = texture3;

    const texture4 = new THREE.VideoTexture(video4);
    texture4.minFilter = THREE.LinearFilter;
    texture4.magFilter = THREE.LinearFilter;
    texture4.format = THREE.RGBFormat;
    texture4.flipY = true; // Flip Y-axis
    texture4.repeat.x = -1; // Flip X-axis
    texture4.center.set(0.5, 0.5); // Set center for proper flipping
    texture4Ref.current = texture4;

    const texture5 = new THREE.VideoTexture(video5);
    texture5.minFilter = THREE.LinearFilter;
    texture5.magFilter = THREE.LinearFilter;
    texture5.format = THREE.RGBFormat;
    texture5.flipY = true; // Flip Y-axis
    texture5.repeat.x = -1; // Flip X-axis
    texture5.center.set(0.5, 0.5); // Set center for proper flipping
    texture5Ref.current = texture5;

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
        
        // Screen1 - Setup canvas texture for SentimentScreen
        if (child.isMesh && child.name === 'Screen1' && !screen1Found) {
          // console.log('[VideoScreens] Found Screen1, setting up canvas texture');
          screen1Found = true;
          
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
          
          // Store refs globally for SentimentScreen to use
          // @ts-ignore
          window['__screen1Canvas'] = canvas;
          // @ts-ignore
          window['__screen1Texture'] = canvasTexture;
          // @ts-ignore  
          window['__screen1Mesh'] = child;
          
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
            map: texture1,
            side: THREE.FrontSide,
            toneMapped: false,
          });
          child.material = material;
          screen1SmallFound = true;
          video1.play().catch(e => {});
        }
        
        // Screen1_LScreen - Setup canvas for Agent Chat
        if (child.isMesh && child.name === 'Screen1_LScreen' && !screen1LFound) {
          // console.log('[VideoScreens] Found Screen1_LScreen, setting up agent chat canvas');
          screen1LFound = true;
          
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
          
          // console.log('[VideoScreens] Screen1_LScreen canvas setup complete');
        }
        
        // Screen1_RScreen - Setup canvas for Data Cube
        if (child.isMesh && child.name === 'Screen1_RScreen' && !screen1RFound) {
          // console.log('[VideoScreens] Found Screen1_RScreen, setting up data cube canvas');
          screen1RFound = true;
          
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
          
          // console.log('[VideoScreens] Screen1_RScreen canvas setup complete');
        }
        
        // Screen2 - Setup canvas texture for MacroAgentScreen  
        if (child.isMesh && child.name === 'Screen2' && !screen2Found) {
          // console.log('[VideoScreens] Found Screen2, setting up canvas texture');
          screen2Found = true;
          
          // Create canvas for drawing
          const canvas2 = document.createElement('canvas');
          canvas2.width = 512;
          canvas2.height = 320;
          
          // Create texture from canvas
          const canvasTexture2 = new THREE.CanvasTexture(canvas2);
          canvasTexture2.minFilter = THREE.LinearFilter;
          canvasTexture2.magFilter = THREE.LinearFilter;
          canvasTexture2.flipY = false;
          canvasTexture2.repeat.x = 1;
          canvasTexture2.center.set(0.5, 0.5);
          
          // Apply to Screen2
          const material2 = new THREE.MeshBasicMaterial({
            map: canvasTexture2,
            side: THREE.FrontSide,
            toneMapped: false,
          });
          
          child.material = material2;
          
          // Store refs globally for MacroAgentScreen to use
          // @ts-ignore
          window['__screen2Canvas'] = canvas2;
          // @ts-ignore
          window['__screen2Texture'] = canvasTexture2;
          // @ts-ignore
          window['__screen2Mesh'] = child;
          
          // console.log('[VideoScreens] Screen2 canvas setup complete', {
          //   canvas: !!window['__screen2Canvas'],
          //   texture: !!window['__screen2Texture']
          // });
        }
        
        // Screen2_small - Apply video texture
        if (child.isMesh && child.name === 'Screen2_small' && !screen2SmallFound) {
          const material = new THREE.MeshBasicMaterial({
            map: texture1,
            side: THREE.FrontSide,
            toneMapped: false,
          });
          child.material = material;
          screen2SmallFound = true;
          video1.play().catch(e => {});
        }
        
        // Screen2_LScreen - Setup canvas for Order Book
        if (child.isMesh && child.name === 'Screen2_LScreen' && !screen2LFound) {
          screen2LFound = true;
          
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
        
        // Screen2_RScreen - Setup canvas for Market Depth
        if (child.isMesh && child.name === 'Screen2_RScreen' && !screen2RFound) {
          screen2RFound = true;
          
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
        
        // Screen3 - Setup canvas texture for TeknoScreen
        if (child.isMesh && child.name === 'Screen3' && !screen3Found) {
          // console.log('[VideoScreens] Found Screen3, setting up canvas texture for TeknoScreen');
          screen3Found = true;
          
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
          
          // console.log('[VideoScreens] Screen3 canvas setup complete for TeknoScreen');
        }
        
        // Screen3_small - Apply video texture
        if (child.isMesh && child.name === 'Screen3_small' && !screen3SmallFound) {
          const material = new THREE.MeshBasicMaterial({
            map: texture1,
            side: THREE.FrontSide,
            toneMapped: false,
          });
          child.material = material;
          screen3SmallFound = true;
          video1.play().catch(e => {});
        }
        
        // Screen3_LScreen - Setup canvas for Price Chart
        if (child.isMesh && child.name === 'Screen3_LScreen' && !screen3LFound) {
          screen3LFound = true;
          
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
        
        // Screen3_RScreen - Setup canvas for Volume Analysis
        if (child.isMesh && child.name === 'Screen3_RScreen' && !screen3RFound) {
          screen3RFound = true;
          
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
        
        // Screen4 - Setup canvas texture for RL80Screen
        if (child.isMesh && child.name === 'Screen4' && !screen4Found) {
          // console.log('[VideoScreens] Found Screen4, setting up canvas texture for RL80Screen');
          screen4Found = true;
          
          // Create canvas for drawing
          const canvas4 = document.createElement('canvas');
          canvas4.width = 512;
          canvas4.height = 320;
          
          // Create texture from canvas
          const canvasTexture4 = new THREE.CanvasTexture(canvas4);
          canvasTexture4.minFilter = THREE.LinearFilter;
          canvasTexture4.magFilter = THREE.LinearFilter;
          canvasTexture4.flipY = false;
          canvasTexture4.repeat.x = 1;
          canvasTexture4.center.set(0.5, 0.5);
          
          // Apply to Screen4
          const material4 = new THREE.MeshBasicMaterial({
            map: canvasTexture4,
            side: THREE.FrontSide,
            toneMapped: false,
          });
          
          child.material = material4;
          
          // Store refs globally for RL80Screen to use
          // @ts-ignore
          window['__screen4Canvas'] = canvas4;
          // @ts-ignore
          window['__screen4Texture'] = canvasTexture4;
          // @ts-ignore
          window['__screen4Mesh'] = child;
          
          // console.log('[VideoScreens] Screen4 canvas setup complete for RL80Screen');
        }
        
        // Screen4_small - Apply video texture
        if (child.isMesh && child.name === 'Screen4_small' && !screen4SmallFound) {
          const material = new THREE.MeshBasicMaterial({
            map: texture1,
            side: THREE.FrontSide,
            toneMapped: false,
          });
          child.material = material;
          screen4SmallFound = true;
          video1.play().catch(e => {});
        }
        
        // Screen4_LScreen - Setup canvas for Risk Metrics
        if (child.isMesh && child.name === 'Screen4_LScreen' && !screen4LFound) {
          screen4LFound = true;
          
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
        
        // Screen4_RScreen - Setup canvas for Portfolio
        if (child.isMesh && child.name === 'Screen4_RScreen' && !screen4RFound) {
          screen4RFound = true;
          
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
      if (texture1Ref.current) texture1Ref.current.dispose();
      // if (texture2Ref.current) texture2Ref.current.dispose();
      if (texture3Ref.current) texture3Ref.current.dispose();
      if (texture4Ref.current) texture4Ref.current.dispose();
      if (texture5Ref.current) texture5Ref.current.dispose();
    };
  }, [scene]);

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

  return (
    <>
      <SentimentScreen />
      <MacroAgentScreen />
      <TeknoScreen />
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