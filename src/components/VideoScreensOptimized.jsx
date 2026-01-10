import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

function VideoScreensOptimized({ is80sMode = false }) {
  const { scene } = useThree();
  const videoRef = useRef();
  const textureRef = useRef();
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  
  useEffect(() => {
    // Only load ONE video instead of 6
    // Use smaller video for better performance
    const videoSource = is80sMode 
      ? '/videos/neon80s.mp4'  // 972KB instead of 6.3MB synthosaur
      : '/videos/23.mp4';       // 571KB
    
    // Create single video element with reduced quality
    const video = document.createElement('video');
    video.src = videoSource;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    
    // Reduce video resolution for texture
    video.width = 256;  // Half resolution
    video.height = 144; // Half resolution
    
    videoRef.current = video;

    // Create single texture to share across all screens
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBFormat;
    texture.generateMipmaps = false; // Save memory
    texture.flipY = false;
    texture.repeat.x = -1;
    texture.center.set(0.5, 0.5);
    textureRef.current = texture;

    // Apply same texture to ALL screens
    const applyToScreens = () => {
      const screenNames = [
        'Screen1', 'Screen1_small', 'Screen1_LScreen', 'Screen1_RScreen',
        'Screen2', 'Screen2_small', 'Screen2_LScreen', 'Screen2_RScreen',
        'Screen3', 'Screen3_small', 'Screen3_LScreen', 'Screen3_RScreen',
        'Screen4', 'Screen4_small', 'Screen4_LScreen', 'Screen4_RScreen',
        'Screen5'
      ];
      
      let foundAny = false;
      
      scene.traverse((child) => {
        if (child.isMesh && screenNames.includes(child.name)) {
          foundAny = true;
          
          // Use same material with shared texture
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.FrontSide,
            toneMapped: false,
          });
          child.material = material;
        }
      });
      
      if (!foundAny) {
        setTimeout(applyToScreens, 500);
      } else {
        setIsVideoLoaded(true);
        
        // Start video playback on user interaction
        const handleInteraction = () => {
          video.play().catch(() => {});
          document.removeEventListener('click', handleInteraction);
          document.removeEventListener('touchstart', handleInteraction);
        };
        
        document.addEventListener('click', handleInteraction);
        document.addEventListener('touchstart', handleInteraction);
      }
    };

    applyToScreens();

    // Cleanup
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
        videoRef.current = null;
      }
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
    };
  }, [scene, is80sMode]);

  return null; // No visual elements, just applies textures
}

export default VideoScreensOptimized;