'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import PolaroidSnapshot from '@/components/PolaroidSnapshot';

// Skybox textures configuration - includes gradient backgrounds as static images
const SKYBOX_TEXTURES = {
  cyberpunk: '/cyberpunk.webp',
  synthwave: '/synthwave.webp',
  gothicTokyo: '/gothicTokyo.webp',
  neoTokyo: '/neoTokyo.webp',
  aurora: '/aurora.webp',
  tradeScene: '/tradeScene.webp',
  sunset: '/gradient-sunset.webp',
  chart: '/images/chart.webp',
  collectibles: '/pokemon2.webp',
  dreams: '/gradient-dreams.webp'
};

// Preload models to prevent loading issues
if (typeof window !== 'undefined') {
  useGLTF.preload('/models/tinyVotiveBox.glb');
  useGLTF.preload('/models/tinyJapCanBox.glb');
}

// Helper function to determine which model to load
  function getCandleModelPath(candleType, candleHeight, includeBox = false) {
    if (candleType === 'votive') {
      return includeBox ? "/models/tinyVotiveBox.glb" : "/models/tinyVotiveOnly.glb"; // Use candle-only for snapshot
    } else if (candleType === 'japanese') {
      return includeBox ? '/models/tinyJapCanBox.glb' : '/models/tinyJapCanOnly.glb'; // Use candle-only for snapshot
    }
    // Default fallback to votive
    return includeBox ? "/models/tinyVotiveBox.glb" : "/models/tinyVotiveOnly.glb";
  }

// Candle scene component (similar to FloatingCandleViewer but optimized for snapshot)
function CandleScene({ userData, onReady }) {
  // For snapshot, we want candle-only (no box) but keep the background if specified
  const modelPath = getCandleModelPath(userData?.candleType, userData?.candleHeight, false);
  // console.log('CandleScene userData:', userData);
  // console.log('Loading candle model:', modelPath, 'for type:', userData?.candleType, 'burnedAmount:', userData?.burnedAmount, 'background:', userData?.background);
  
  let scene, animations;
  try {
    const model = useGLTF(modelPath);
    scene = model.scene;
    animations = model.animations;
  } catch (error) {
    console.error('Error loading model:', error);
    // Fallback to votive candle-only if model fails to load
    const fallbackModel = useGLTF('/models/tinyVotiveOnly.glb');
    scene = fallbackModel.scene;
    animations = fallbackModel.animations;
  }
  const candleRef = useRef();
  const mixerRef = useRef(null);
  const flamePointLightRef = useRef();
  const backgroundTextureRef = useRef(null);
  
  useEffect(() => {
    if (!scene) return;
    
    // Clone the scene to avoid conflicts
    const clonedScene = scene.clone();
    const currentModelPath = modelPath; // Store modelPath for use in traversal
    
    // Debug: Log all meshes in the scene
    // console.log('=== Debugging CandleSnapshotRenderer ===');
    // console.log('UserData:', userData);
    // console.log('All meshes in scene:');
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        // console.log('- Mesh name:', child.name, 'visible:', child.visible);
      }
    });
    
    // Track if we need to load room texture
    let roomTextureNeeded = false;
    let roomMeshFound = false;
    
    // Apply user's image to senora mesh for votive candles (matching SimpleCandleViewer logic)
    if (userData?.image && userData?.candleType === 'votive') {
      const textureLoader = new THREE.TextureLoader();
      
      clonedScene.traverse((child) => {
        // Target the senora mesh specifically for votive candles
        const isSenoraObject = child.name === 'senora' || 
                              (child.material && child.material.name === 'senora') ||
                              (child.material && child.material.name === 'senora.001');
        
        if (child.isMesh && isSenoraObject) {
          console.log('Found senora mesh in snapshot, applying user image');
          
          textureLoader.load(
            userData.image,
            (texture) => {
              texture.colorSpace = THREE.SRGBColorSpace;
              texture.flipY = false;
              texture.wrapS = THREE.ClampToEdgeWrapping;
              texture.wrapT = THREE.ClampToEdgeWrapping;
              texture.needsUpdate = true;
              
              // Clone and update the material
              child.material = child.material.clone();
              child.material.map = texture;
              child.material.transparent = true;
              child.material.opacity = 1;
              child.material.alphaTest = 0.1;
              child.material.needsUpdate = true;
            },
            undefined,
            (error) => {
              console.error('Error loading user image for senora in snapshot:', error);
            }
          );
        }
      });
    }
    
    // Apply baseColor to XBase meshes (matching SimpleCandleViewer logic)
    if (userData?.baseColor && userData.baseColor !== '#ffffff') {
      console.log(`[Snapshot] Applying base color: ${userData.baseColor} to model: ${currentModelPath}`);
      let colorApplied = false;
      
      clonedScene.traverse((child) => {
        if (child.isMesh) {
          const meshNameLower = child.name.toLowerCase();
          const isBoxMesh = child.name === 'Box' || child.name === 'box';
          
          // Look for XBase meshes in the same way as SimpleCandleViewer (but NOT Box mesh)
          const isXBaseMesh = !isBoxMesh && (
                             meshNameLower === 'xbase' || 
                             meshNameLower.startsWith('xbase') ||
                             (currentModelPath.includes('tinyVotive') && 
                              (meshNameLower === 'base' || 
                               meshNameLower === 'cylinder' || 
                               meshNameLower === 'candle' ||
                               meshNameLower.includes('candle_base') ||
                               meshNameLower.includes('wax'))));
          
          if (isXBaseMesh) {
            console.log(`[Snapshot] Found XBase mesh to color: "${child.name}"`);
            // Clone the material and apply the color
            child.material = child.material.clone();
            const color = new THREE.Color(userData.baseColor);
            child.material.color = color;
            child.material.needsUpdate = true;
            colorApplied = true;
            console.log(`[Snapshot] Applied color ${userData.baseColor} to mesh: "${child.name}"`);
          }
        }
      });
      
      if (!colorApplied) {
        console.log(`[Snapshot] No XBase meshes found to apply color to`);
      }
    } else {
      console.log(`[Snapshot] No custom base color to apply (color: ${userData?.baseColor})`);
    }
    
    // Apply skybox texture to Box mesh for ALL candle types
    if (userData?.background && SKYBOX_TEXTURES[userData.background]) {
      roomTextureNeeded = true;
      
      // Find Box mesh (the background mesh in the new models)
      clonedScene.traverse((child) => {
        if (child.isMesh && (child.name === 'Box' || child.name === 'box')) {
          roomMeshFound = true;
          // console.log('Found Box mesh! Loading background:', userData.background);
          
          // Make Room visible and set initial properties
          child.visible = true;
          child.renderOrder = -1000; // Render behind everything
          child.frustumCulled = false; // Prevent culling
        }
      });
      
      if (!roomMeshFound) {
        console.warn(`Box mesh not found in ${userData?.candleType} model! Using gradient fallback.`);
        // console.log('All meshes in scene:');
        clonedScene.traverse((child) => {
          if (child.isMesh) {
            // console.log('- Mesh:', child.name);
          }
        });
        
        // Don't create gradient plane here - will add it later when candleRef is ready
        
        // If no room mesh, just signal ready
        if (onReady) {
          setTimeout(onReady, 500);
        }
      } else {
        // Load the texture immediately
        const textureLoader = new THREE.TextureLoader();
        const texturePath = SKYBOX_TEXTURES[userData.background];
        // console.log('Loading texture from:', texturePath);
        
        textureLoader.load(
          texturePath,
          (texture) => {
            // console.log('Skybox texture loaded successfully');
            
            // Configure texture exactly like SingleCandleDisplay
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.flipY = true; // Flip vertically for correct orientation in snapshot
            texture.needsUpdate = true;
            
            // Apply to Box mesh (the background mesh in the new models)
            clonedScene.traverse((child) => {
              if ((child.name === 'Box' || child.name === 'box') && child.isMesh) {
                // console.log('Applying texture to Box mesh');
                // console.log('Original Box material:', child.material);
                
                // Update existing material's texture instead of replacing the whole material
                child.material = child.material.clone();
                child.material.map = texture;
                child.material.needsUpdate = true;
                child.visible = true;
                child.renderOrder = -1000;
                child.frustumCulled = false;
                
                // console.log('Box mesh updated:', {
                //   material: child.material,
                //   hasMap: !!child.material.map,
                //   mapImage: child.material.map?.image,
                //   visible: child.visible,
                //   renderOrder: child.renderOrder
                // });
              }
            });
            
            // Signal ready after room texture loads with time to render
            if (onReady) {
              setTimeout(onReady, 1500); // Allow time for texture to render
            }
          },
          undefined,
          (error) => {
            console.error('Failed to load skybox texture:', error);
            if (onReady) {
              setTimeout(onReady, 500);
            }
          }
        );
      }
    }
    
    // Reset any melted geometry to initial state
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        // If this is a candle mesh that might be melted, try to reset it
        if (child.name.toLowerCase().includes('candle') || 
            child.name.toLowerCase().includes('wax') ||
            child.name.toLowerCase().includes('melt')) {
          // Reset any morphTargetInfluences that might control melting
          if (child.morphTargetInfluences) {
            child.morphTargetInfluences.forEach((_, index) => {
              child.morphTargetInfluences[index] = 0;
            });
          }
          // Reset scale in case melting uses scale
          child.scale.set(1, 1, 1);
        }
      }
    });
    
    // Apply user image to label if provided (votive candles only)
    if (userData?.image) {
      let labelFound = false;
      clonedScene.traverse((child) => {
        if (child.name.includes("Label2") && child.isMesh) {
          labelFound = true;
          // Create texture from user image
          const textureLoader = new THREE.TextureLoader();
          textureLoader.load(userData.image, (texture) => {
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.repeat.set(1, -1); // Flip vertically to fix upside-down issue
            texture.offset.set(0, 1);
            texture.colorSpace = THREE.SRGBColorSpace;
            
            child.material = new THREE.MeshStandardMaterial({
              map: texture,
              emissive: new THREE.Color(0xff6600),
              emissiveIntensity: 0.2, // Reduced to preserve texture colors
              roughness: 0.8,
              metalness: 0.1, // Less metallic for better color accuracy
              side: THREE.DoubleSide,
            });
            
            // For votive with room, wait for room texture to load first
            if (!roomTextureNeeded && onReady) {
              setTimeout(onReady, 1000);
            }
          });
        }
      });
      
      // If no label mesh found (Japanese/Ecclesiastical candles), signal ready immediately
      if (!labelFound && !roomTextureNeeded && onReady) {
        setTimeout(onReady, 500);
      }
    } else {
      // No image, scene is ready immediately (unless room texture is needed)
      if (!roomTextureNeeded && onReady) {
        setTimeout(onReady, 500);
      }
    }
    
    // Set up animation ONLY for votive candles
    // Japanese and Ecclesiastical candles should NOT animate at all in snapshot
    if (animations && animations.length > 0 && userData?.candleType === 'votive') {
      mixerRef.current = new THREE.AnimationMixer(clonedScene);
      animations.forEach((clip) => {
        const action = mixerRef.current.clipAction(clip);
        // Reset to beginning
        action.reset();
        action.time = 0;
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(1);
        
        // Only play flame animations (very short clips under 2 seconds)
        if (clip.duration < 2) {
          action.play();
          action.setLoop(THREE.LoopRepeat);
        }
      });
    } else {
      // No animations for Japanese/Ecclesiastical candles
      mixerRef.current = null;
    }
    
    // Add to scene
    if (candleRef.current) {
      candleRef.current.add(clonedScene);
      
      // Add background plane for models without Box mesh (fallback)
      // All backgrounds are now static images in SKYBOX_TEXTURES
      if (userData?.background && !roomMeshFound && SKYBOX_TEXTURES[userData.background]) {
        console.log('No Box mesh found, creating fallback background plane for:', userData.background);
        
        const textureLoader = new THREE.TextureLoader();
        const texturePath = SKYBOX_TEXTURES[userData.background];
        
        textureLoader.load(
          texturePath,
          (texture) => {
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.flipY = true;
            texture.needsUpdate = true;
            
            const planeGeometry = new THREE.PlaneGeometry(20, 20);
            const planeMaterial = new THREE.MeshBasicMaterial({
              map: texture,
              side: THREE.DoubleSide,
              transparent: false,
              opacity: 1
            });
            const backgroundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
            backgroundPlane.position.z = -5;
            backgroundPlane.renderOrder = -1000;
            
            if (candleRef.current) {
              candleRef.current.add(backgroundPlane);
            }
          },
          undefined,
          (error) => {
            console.error('Failed to load background texture for fallback plane:', error);
          }
        );
      }
    }
    
    return () => {
      // Stop animations
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
      
      // Dispose of textures and materials to prevent shader overflow
      if (candleRef.current) {
        candleRef.current.traverse((child) => {
          if (child.isMesh) {
            // Dispose geometry
            if (child.geometry) {
              child.geometry.dispose();
            }
            
            // Dispose material and its textures
            if (child.material) {
              // Handle array of materials
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.forEach(material => {
                if (material.map) material.map.dispose();
                if (material.normalMap) material.normalMap.dispose();
                if (material.roughnessMap) material.roughnessMap.dispose();
                if (material.metalnessMap) material.metalnessMap.dispose();
                if (material.emissiveMap) material.emissiveMap.dispose();
                material.dispose();
              });
            }
          }
        });
        
        // Clear the candle reference
        while (candleRef.current.children.length > 0) {
          candleRef.current.remove(candleRef.current.children[0]);
        }
      }
      
      // Dispose background texture if it exists
      if (backgroundTextureRef.current) {
        backgroundTextureRef.current.dispose();
        backgroundTextureRef.current = null;
      }
    };
  }, [scene, animations, userData, onReady]);
  
  // Animation frame update - ONLY for light positioning, NOT animations
  useEffect(() => {
    let animationId;
    const animate = () => {
      if (candleRef.current && flamePointLightRef.current) {
        // Get the world position of the candle
        const box = new THREE.Box3().setFromObject(candleRef.current);
        const center = box.getCenter(new THREE.Vector3());
        
        // Position the light at the top of the candle
        flamePointLightRef.current.position.set(
          center.x,
          center.y + 1.8, // Adjust this value to position at flame height
          center.z
        );
      }
      
      // DON'T update animation mixer for Japanese/Ecclesiastical candles
      // Only update for votive candles with flame animations
      if (mixerRef.current && userData?.candleType === 'votive') {
        mixerRef.current.update(0.016); // Update with approximately 60fps timing
      }
      
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [userData?.candleType]);
  
  // Debug log
  console.log('CandleScene render - burnedAmount:', userData?.burnedAmount, 'type:', typeof userData?.burnedAmount);
  
  return (
    <>
      <ambientLight intensity={1.5} color="#ffffff" />  
            <directionalLight 
        position={[-1, 5, 3]} 
        intensity={1.4}  // Reduced from 0.6
        color="#fff5ee" // Softer warm fill
      />
      {/* <directionalLight 
        position={[5, 8, 5]} 
        intensity={0.8}  // Reduced from 1.2
        color="#ffffff"
        castShadow
      />

      <pointLight 
        position={[0, 2, 4]} 
        intensity={0.5}  // Reduced from 0.8
        color="#ffaa66" // Warm candle glow
      />
      <pointLight 
        position={[0, 0.5, 0]} 
        intensity={1.0}  // Reduced from 1.5
        color="#ff8833" // Orange glow at flame
        distance={3}
      />
      <spotLight
        position={[0, 10, 0]}
        angle={0.5}
        penumbra={0.5}
        intensity={0.2}  // Reduced from 0.3
        color="#ffffff" // Top down rim light
      /> */}
       <ambientLight intensity={0.8} />
        {/* <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
        <pointLight position={[0, 3, 2]} intensity={0.5} color="#ffaa00" />
        <pointLight position={[-3, 2, -2]} intensity={0.3} color="#ffffff" /> */}

        {/* Spotlight for general candle illumination */}
        {/* <spotLight
          intensity={0.8}
          angle={0.4}
          penumbra={0.5}
          distance={5}
          castShadow={false}
          color="#ffedd0"
        /> */}

        {/* Point light that will always follow the flame area */}
        {/* <pointLight
          ref={flamePointLightRef}
          intensity={1.0}
          distance={3}
          color="#ff9c5e"
          decay={2}
        /> */}
      <group 
        ref={candleRef} 
        scale={[1.2, 1.2, 1.2]} 
        position={[0, userData?.candleType === 'japanese' ? -0.8 : -0.2, 0]} 
      /> {/* Conditional position: lower for Japanese candles */}
    </>
  );
}

// Main component that combines candle renderer with polaroid snapshot
export default function CandleSnapshotRenderer({ 
  isVisible, 
  userData, 
  onComplete,
  preloadOnly = false,
  onReady,
  instantCapture = false
}) {
  const [triggerSnapshot, setTriggerSnapshot] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [showLoading, setShowLoading] = useState(!preloadOnly && !instantCapture);
  const canvasRef = useRef();
  
  // console.log('CandleSnapshotRenderer render:', { 
  //   isVisible, 
  //   userData, 
  //   instantCapture, 
  //   sceneReady, 
  //   triggerSnapshot,
  //   showLoading 
  // });
  
  // Trigger snapshot once scene is ready
  useEffect(() => {
    if (sceneReady && isVisible) {
      // If preloading, just notify ready
      if (preloadOnly && onReady) {
        onReady();
        return;
      }
      
      // If instant capture, trigger immediately
      if (instantCapture) {
        setShowLoading(false);
        setTriggerSnapshot(true);
        return;
      }
      
      // Normal flow with loading indicator
      const timer = setTimeout(() => {
        setShowLoading(false);
        setTriggerSnapshot(true);
      }, 1500); // Reduced from 3000ms
      
      return () => clearTimeout(timer);
    }
  }, [sceneReady, isVisible, preloadOnly, instantCapture, onReady]);
  
  const handleSceneReady = () => {
    setSceneReady(true);
  };
  
  const handleSnapshotComplete = (imageData) => {
    // Don't reset - keep the snapshot visible until user dismisses it
    // The PolaroidSnapshot component handles its own dismissal via click
    
    // Notify parent immediately (parent shouldn't auto-hide)
    if (onComplete) {
      onComplete(imageData);
    }
  };
  
  if (!isVisible) return null;
  
  return (
    <>
      {/* Loading indicator with full-screen backdrop */}
      {showLoading && isVisible && (
        <>
          {/* Full screen backdrop with blur */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 99997,
            animation: 'fadeIn 0.3s ease',
          }} />
          
          {/* Centered message card */}
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 99998,
            background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(0, 20, 0, 0.9) 100%)',
            padding: '40px 50px',
            borderRadius: '20px',
            border: '2px solid rgba(0, 255, 0, 0.3)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 120px rgba(0, 255, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '25px',
            animation: 'slideUp 0.4s ease',
            minWidth: '320px'
          }}>
            {/* Success header */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                fontSize: '48px',
                animation: 'bounce 1s ease infinite'
              }}>
                🕯️
              </div>
              <h2 style={{
                color: '#00ff00',
                fontSize: '24px',
                fontWeight: 'bold',
                margin: 0,
                textAlign: 'center',
                textShadow: '0 0 20px rgba(0, 255, 0, 0.5)'
              }}>
                Your candle has been lit! ✨
              </h2>
            </div>
            
            {/* Loading animation */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '15px'
            }}>
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'conic-gradient(from 0deg, transparent, #00ff00)',
                animation: 'spin 1s linear infinite',
                boxShadow: '0 0 20px rgba(0, 255, 0, 0.5)'
              }} />
              <div style={{
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '16px',
                fontWeight: '400'
              }}>
                Creating your snapshot...
              </div>
            </div>
            
            {/* Progress dots */}
            <div style={{
              display: 'flex',
              gap: '8px'
            }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'rgba(0, 255, 0, 0.5)',
                  animation: `pulse 1.5s ease infinite ${i * 0.3}s`
                }} />
              ))}
            </div>
          </div>
          
          <style jsx>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { 
                opacity: 0;
                transform: translate(-50%, -40%);
              }
              to { 
                opacity: 1;
                transform: translate(-50%, -50%);
              }
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes bounce {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-10px); }
            }
            @keyframes pulse {
              0%, 100% { 
                opacity: 0.3;
                transform: scale(1);
              }
              50% { 
                opacity: 1;
                transform: scale(1.2);
              }
            }
          `}</style>
        </>
      )}
      
      {/* Hidden canvas for rendering the candle */}
      <div
        id="candle-snapshot-container"  // Add ID to capture entire container
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          opacity: 0.01, // Very slight opacity to ensure rendering
          pointerEvents: 'none',
          zIndex: 1, // Above page but below modal
        }}
      >
        <Canvas
          ref={canvasRef}
          camera={{ 
            position: [0, 0, 6],  // Raised camera Y position to better capture flame
            fov: 30  // Standard FOV for consistent framing
          }}
          // gl={{
          //   preserveDrawingBuffer: true,
          //   antialias: true,
          //   alpha: false,
          //   outputColorSpace: 'srgb', // Ensure correct color space
          //   toneMapping: THREE.ACESFilmicToneMapping, // Better color reproduction
          //   toneMappingExposure: 1.2, // Slightly brighter exposure
          // }}
        >
          {/* All candles should show the user's selected background */}
          {/* Use black background to let the skybox/gradient show through */}
          <color attach="background" args={['#000000']} />
          
          <CandleScene 
            userData={userData} 
            onReady={handleSceneReady}
          />
        </Canvas>
      </div>
      
      {/* Polaroid snapshot component - only show when not preloading */}
      {!preloadOnly && (
        <PolaroidSnapshot 
          trigger={triggerSnapshot}
          onComplete={handleSnapshotComplete}
          captureElementId="candle-snapshot-container"  // Capture entire container with overlay
          label={userData?.burnedAmount ? `Burned ${parseInt(userData.burnedAmount).toLocaleString()} RL80 tokens!` : `${userData?.username || 'Anonymous'}'s Candle`}
        />
      )}
    </>
  );
}