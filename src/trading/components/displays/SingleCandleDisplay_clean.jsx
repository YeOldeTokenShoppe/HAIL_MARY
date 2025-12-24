import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, useHelper } from '@react-three/drei';
import * as THREE from 'three';


// Texture preloader and cache
const textureLoader = new THREE.TextureLoader();
const textureCache = new Map();

// Theme configurations - Now using only equirectangular format
const themes = [
  {
    name: 'Sky Panorama',
    room: '/EquirectangularSky.webp',
    candle: '/Green1.webp',
    isEquirectangular: true
  }
];

// Preload all textures
async function preloadTextures() {
  const allTextures = [
    '/EquirectangularSky.webp',
    '/Green1.webp'
  ];
  
  const promises = allTextures.map(url => {
    return new Promise((resolve) => {
      if (textureCache.has(url)) {
        resolve(textureCache.get(url));
      } else {
        textureLoader.load(
          url, 
          (texture) => {
            texture.encoding = THREE.sRGBEncoding;
            
            // Different settings for Room vs Candle textures
            if (url.includes('EquirectangularSky')) {
              // Don't modify texture here - we'll handle it when applying to the sphere
              texture.minFilter = THREE.LinearFilter; // Smoother filtering
              texture.magFilter = THREE.LinearFilter;
              texture.generateMipmaps = false; // Don't generate mipmaps for skybox
            } else if (url.includes('BG.webp')) {
              texture.flipY = false;
              texture.wrapS = THREE.ClampToEdgeWrapping;
              texture.wrapT = THREE.ClampToEdgeWrapping;
              texture.repeat.set(1, 1);
              texture.offset.set(0, 0);
            } else {
              // Candle textures
              texture.flipY = true;
              texture.wrapS = THREE.RepeatWrapping;
              texture.wrapT = THREE.RepeatWrapping;
            }
            
            textureCache.set(url, texture);
            resolve(texture);
          },
          // Progress callback - removed for performance
          undefined,
          // Error callback
          (error) => {
            console.error('Error loading texture:', url, error);
            resolve(null); // Resolve with null instead of rejecting
          }
        );
      }
    });
  });
  
  await Promise.all(promises);
  console.log('All textures preloaded!');
}

// Scene content that loads the candle model directly
function CandleScene({ firestoreData, onDoubleClick, isMobile, currentTheme = 0, showHelpers = false, isFullscreen = false, entered = false }) {
  const { scene, animations } = useGLTF("/models/XCandleAnimatedFlame2.glb");
  const candleRef = useRef();
  const mixerRef = useRef(null);
  const spotlightRef = useRef();
  const orbitControlsRef = useRef();
  const [hovered, setHovered] = useState(false);
  const [texturesLoaded, setTexturesLoaded] = useState(false);
  const tapTimeoutRef = useRef(null);
  const lastTapRef = useRef(0);
  const pendingThemeRef = useRef(null);
  
  // Use helper for spotlight visualization
  useHelper(showHelpers && spotlightRef, THREE.SpotLightHelper, '#00ff00');
  
  // Preload textures on mount
  useEffect(() => {
    preloadTextures().then(() => {
      console.log('All textures loaded, cache size:', textureCache.size);
      setTexturesLoaded(true);
    });
  }, []);
  
  // Apply theme when textures are loaded or theme changes
  useEffect(() => {
    if (texturesLoaded && candleRef.current && candleRef.current.children.length > 0) {
      console.log('Applying theme after textures loaded, currentTheme:', currentTheme);
      console.log('Texture cache size before applying:', textureCache.size);
      
      // If cache is still empty, wait a bit and try again
      if (textureCache.size === 0) {
        pendingThemeRef.current = currentTheme;
        setTimeout(() => {
          if (textureCache.size > 0 && candleRef.current && candleRef.current.children.length > 0) {
            applyTheme(candleRef.current.children[0], pendingThemeRef.current || currentTheme);
            pendingThemeRef.current = null;
          }
        }, 500);
      } else {
        applyTheme(candleRef.current.children[0], currentTheme);
      }
    }
  }, [texturesLoaded, currentTheme]);
  
  // Apply texture swaps
  const applyTheme = (sceneToUpdate, themeIndex) => {
    if (!texturesLoaded || !sceneToUpdate) {
      console.log('Cannot apply theme - textures not loaded or scene not ready');
      return;
    }
    
    // Double-check cache is populated
    if (textureCache.size === 0) {
      console.log('Texture cache is empty, waiting for textures to load...');
      return;
    }
    
    const theme = themes[themeIndex];
    
    sceneToUpdate.traverse((child) => {
      if (child.isMesh) {
        // Swap Room/Background texture
        if (child.name === 'Room' || child.name?.includes('Room') || child.name?.toLowerCase().includes('room')) {
          const roomTexture = textureCache.get(theme.room);
          
          if (roomTexture && child.material) {
            // Validate texture is properly loaded
            if (!roomTexture.image || roomTexture.image.width === 0) {
              console.error('Texture image not properly loaded for:', theme.room);
              return;
            }
            
            // Store original texture settings if available
            const originalMap = child.material.map;
            
            child.material = child.material.clone();
            child.material.map = roomTexture;
            
            // Apply equirectangular-specific settings if needed
            if (theme.isEquirectangular) {
              // For equirectangular textures, we need proper UV mapping
              
              // Clone the texture to avoid modifying the cached version
              const textureClone = roomTexture.clone();
              textureClone.wrapS = THREE.RepeatWrapping;
              textureClone.wrapT = THREE.ClampToEdgeWrapping;
              textureClone.repeat.set(1, 1); // Normal scale
              textureClone.offset.set(0, 0); // Start with no offset
              textureClone.encoding = THREE.sRGBEncoding;
              textureClone.needsUpdate = true;
              
              // Create a new basic material with the cloned texture
              const newMaterial = new THREE.MeshBasicMaterial({
                map: textureClone,
                side: THREE.BackSide, // View from inside the sphere
                transparent: false,
                opacity: 1,
                depthWrite: true, // Write to depth buffer
                depthTest: true // Test depth normally
              });
              
              // Force material update
              newMaterial.needsUpdate = true;
              
              child.material = newMaterial;
              // Don't manipulate renderOrder - let Three.js handle it naturally
              child.frustumCulled = false; // Always render the skybox
            } else {
              // Copy UV transform from original if it exists
              if (originalMap) {
                roomTexture.repeat.copy(originalMap.repeat);
                roomTexture.offset.copy(originalMap.offset);
                roomTexture.rotation = originalMap.rotation;
                roomTexture.center.copy(originalMap.center);
              }
            }
            
            child.material.needsUpdate = true;
          }
        }
        
        // Swap Candle2 texture
        if (child.name === 'Candle2' || child.name?.includes('Candle2')) {
          const candleTexture = textureCache.get(theme.candle);
          if (candleTexture && child.material) {
            child.material = child.material.clone();
            child.material.map = candleTexture;
            child.material.needsUpdate = true;
          }
        }
      }
    });
  };
  
  // Clone and setup the candle
  useEffect(() => {
    if (scene && candleRef.current) {
      const clonedCandle = scene.clone();
      
      // Setup animations for the cloned scene
      if (animations && animations.length > 0) {
        mixerRef.current = new THREE.AnimationMixer(clonedCandle);
        
        // Find and play the 'Animation' clip specifically
        animations.forEach(clip => {
          console.log('Found animation clip:', clip.name);
          const action = mixerRef.current.clipAction(clip);
          action.play();
        });
      }
      
      // Scale up for better visibility
      clonedCandle.scale.set(1, 1, 1);
      clonedCandle.position.set(0, 0, 0);
      
      // Clear previous children and add new candle
      while (candleRef.current.children.length > 0) {
        candleRef.current.remove(candleRef.current.children[0]);
      }
      candleRef.current.add(clonedCandle);
      
      // Don't apply theme here - let the separate effect handle it
      // to ensure textures are loaded first
    }
    
    // Cleanup on unmount or when dependencies change
    return () => {
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
    };
  }, [scene, firestoreData, animations]); // Remove currentTheme and texturesLoaded from deps to avoid premature application
  
  // Animation loop
  useFrame((state, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
  });
  
  return (
    <>
      {/* Lighting setup */}
      <ambientLight intensity={0.8} />
      
      {/* Main spotlight with helper */}
      <spotLight 
        ref={spotlightRef}
        position={[-2, 5, 2]} 
        intensity={35.2} 
        angle={0.9}
        penumbra={0.1}
        castShadow 
        shadow-mapSize={[1024, 1024]}
        color="#ffffff"
        target-position={[0, 0, 0]}
        distance={20}
        decay={2}
      />
      
      {/* The candle model - clickable */}
      <group 
        ref={candleRef}
        onDoubleClick={!isMobile ? onDoubleClick : undefined}
        onPointerDown={isMobile ? (e) => {
          e.stopPropagation();
          const now = Date.now();
          const timeSinceLastTap = now - lastTapRef.current;
          
          if (timeSinceLastTap < 300) {
            // Double tap detected
            if (tapTimeoutRef.current) {
              clearTimeout(tapTimeoutRef.current);
            }
            onDoubleClick();
          } else {
            // Single tap - wait to see if it's a double tap
            tapTimeoutRef.current = setTimeout(() => {
              // Single tap action (if needed)
            }, 300);
          }
          
          lastTapRef.current = now;
        } : undefined}
        onPointerOver={() => !isMobile && setHovered(true)}
        onPointerOut={() => !isMobile && setHovered(false)}
        style={{ cursor: hovered ? 'pointer' : 'auto' }}
      />
      
      {/* Camera Animator for smooth transitions */}
      <CameraAnimator 
        entered={entered} 
        isFullscreen={isFullscreen} 
        orbitControlsRef={orbitControlsRef}
      />
      
      {/* Camera controls - with zoom and manual rotation enabled */}
      <OrbitControls
        ref={orbitControlsRef}
        dampingFactor={0.2}
        enablePan={!isMobile}
        enableZoom={true}
        minDistance={isMobile ? 3 : 2}
        maxDistance={isMobile ? 8 : 10}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN
        }}
      />
    </>
  );
}

// User Info Overlay Component
function UserInfoOverlay({ userData, isMobile }) {
  const [imageError, setImageError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  
  if (!userData) return null;
  
  const username = userData.username || userData.userName || userData.name || 'Anonymous Trader';
  const message = userData.message || userData.prayer || 'May the gains be with you 🚀';
  const imageUrl = userData.image || userData.profileImage || '/defaultAvatar.png';
  
  return (
    <div style={{
      position: 'absolute',
      bottom: '-1px',
      left: '-1px',
      right: '-1px', 
      background: 'linear-gradient(90deg, rgba(0, 0, 0, 0.85) 0%, rgba(0, 20, 0, 0.8) 50%, rgba(0, 0, 0, 0.85) 100%)',
      borderTop: '1px solid rgba(0, 255, 0, 0.2)',
      padding: isMobile ? '8px 10px' : '10px 12px 11px 12px',
      backdropFilter: 'blur(8px)',
      boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.5)',
      zIndex: 10
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        {/* User Image - Larger */}
        <div style={{
          width: isMobile ? '40px' : '48px',
          height: isMobile ? '40px' : '48px',
          borderRadius: '50%',
          overflow: 'hidden',
          border: '2px solid rgba(0, 255, 0, 0.4)',
          flexShrink: 0,
          background: 'rgba(0, 255, 0, 0.1)',
          boxShadow: '0 0 12px rgba(0, 255, 0, 0.2)'
        }}>
          <img 
            src={imageError ? '/defaultAvatar.png' : imageUrl}
            alt={username}
            onError={() => setImageError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        </div>
        
        {/* User Info - Stacked Layout */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          {/* Username with Flame Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <h4 style={{
              margin: 0,
              color: '#00ff00',
              fontSize: isMobile ? '12px' : '13px',
              fontWeight: '600',
              letterSpacing: '0.5px',
              textShadow: '0 0 10px rgba(0, 255, 0, 0.5)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {username}
            </h4>
            
            {/* Small Flame Indicator without text */}
            <span style={{ 
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #ffff00, #ff8800)',
              boxShadow: '0 0 8px #ff8800',
              animation: 'flicker 2s infinite'
            }} />
          </div>
          
          {/* Prayer/Message - Expandable and with Tooltip */}
          <div style={{ position: 'relative' }}>
            <p 
              onClick={() => setIsExpanded(!isExpanded)}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              style={{
                margin: 0,
                color: 'rgba(255, 255, 255, 0.75)',
                fontSize: isMobile ? '10px' : '11px',
                lineHeight: '1.3',
                fontStyle: 'italic',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: isExpanded ? 'block' : '-webkit-box',
                WebkitLineClamp: isExpanded ? 'unset' : 2,
                WebkitBoxOrient: 'vertical',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                userSelect: 'none'
              }}
            >
              "{message}"
            </p>
            
            {/* Tooltip for full message on hover */}
            {showTooltip && !isExpanded && message.length > 50 && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                left: '0',
                right: '0',
                marginBottom: '8px',
                padding: '8px 10px',
                background: 'rgba(0, 0, 0, 0.95)',
                border: '1px solid rgba(0, 255, 0, 0.3)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.9)',
                fontSize: '11px',
                lineHeight: '1.4',
                fontStyle: 'italic',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.7)',
                zIndex: 100,
                pointerEvents: 'none',
                animation: 'fadeIn 0.2s ease',
                maxHeight: '120px',
                overflowY: 'auto',
                wordWrap: 'break-word'
              }}>
                "{message}"
              </div>
            )}
            
            {/* Click hint for long messages */}
            {message.length > 50 && (
              <span style={{
                fontSize: '9px',
                color: 'rgba(0, 255, 0, 0.4)',
                marginLeft: '4px',
                fontStyle: 'normal',
                cursor: 'pointer'
              }}>
                {isExpanded ? '(less)' : '(more)'}
              </span>
            )}
          </div>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes flicker {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}


// Camera animation component
function CameraAnimator({ entered, isFullscreen = false, orbitControlsRef }) {
  const [hasReachedTarget, setHasReachedTarget] = useState(false);
  const [initialAnimationComplete, setInitialAnimationComplete] = useState(false);
  
  useFrame((state) => {
    // If initial animation is complete and we're not changing states, let OrbitControls handle it
    if (!isFullscreen && initialAnimationComplete && !entered) {
      if (orbitControlsRef?.current) {
        orbitControlsRef.current.enabled = true;
      }
      return;
    }
    
    // Don't animate if we're in fullscreen and have reached target
    if (isFullscreen && hasReachedTarget) {
      if (orbitControlsRef?.current) {
        orbitControlsRef.current.enabled = true;
      }
      return;
    }
    
    // Disable OrbitControls during animation
    if (orbitControlsRef?.current) {
      orbitControlsRef.current.enabled = false;
    }
    
    let targetPos, targetFov;
    
    if (isFullscreen) {
      targetPos = { x: 0, y: 2, z: 8 };
      targetFov = 45;
    } else if (entered) {
      targetPos = { x: 0, y: 0, z: 3 };
      targetFov = 35;
      setInitialAnimationComplete(false);
    } else {
      targetPos = { x: 0, y: 0, z: 7 };
      targetFov = 45;
    }
    
    // Animate camera
    state.camera.position.lerp(targetPos, 0.1);
    state.camera.fov = THREE.MathUtils.lerp(state.camera.fov, targetFov, 0.1);
    state.camera.updateProjectionMatrix();
    state.camera.lookAt(0, 0, 0);
    
    // Check if we've reached the target
    const distance = state.camera.position.distanceTo(new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z));
    if (distance < 0.1) {
      if (isFullscreen) {
        setHasReachedTarget(true);
      } else if (!entered) {
        setInitialAnimationComplete(true);
      }
    }
    
    // Reset flags when leaving fullscreen
    if (!isFullscreen) {
      setHasReachedTarget(false);
    }
  });
  
  return null;
}

// Main component for single candle display
export default function SingleCandleDisplay({ firestoreData }) {
  const [isCanvasReady, setIsCanvasReady] = useState(false);
  const [portalEntered, setPortalEntered] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const selectedTheme = 0; // Always use the first (and only) theme
  const containerRef = useRef();
  
  useEffect(() => {
    // Detect mobile viewport
    const checkMobile = () => {
      const mobile = window.matchMedia('(max-width: 768px)').matches || 
                    ('ontouchstart' in window) ||
                    (navigator.maxTouchPoints > 0);
      setIsMobile(mobile);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Small delay to ensure canvas mounts properly
    const timer = setTimeout(() => {
      setIsCanvasReady(true);
    }, 100);
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkMobile);
    };
  }, []);
  
  // ESC key handler for fullscreen
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        setPortalEntered(false);
      }
    };
    
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFullscreen]);
  
  const handlePortalClick = () => {
    setPortalEntered(!portalEntered);
    
    // Toggle fullscreen
    if (!isFullscreen) {
      setIsFullscreen(true);
    } else {
      setIsFullscreen(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      style={{ 
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto', 
        right: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 'auto',
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : '100%',
        zIndex: isFullscreen ? 999999 : 'auto',
        background: isFullscreen ? 'black' : 'transparent',
      }}>
      {isCanvasReady ? (
        <Canvas
          camera={{ position: [0, 0, isMobile ? 8 : 7], fov: isMobile ? 50 : 45 }}
          style={{ width: '100%', height: '100%' }}
          gl={{ 
            antialias: !isMobile,
            alpha: false,
            preserveDrawingBuffer: false,
            powerPreference: "high-performance",
            failIfMajorPerformanceCaveat: false,
            stencil: false
          }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 1.2;
            gl.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
          }}
        >
          <CandleScene 
            firestoreData={firestoreData} 
            isMobile={isMobile}
            onDoubleClick={handlePortalClick}
            currentTheme={selectedTheme}
            showHelpers={false}
            isFullscreen={isFullscreen}
            entered={portalEntered}
          />
        </Canvas>
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#00ff00',
          fontSize: '12px'
        }}>
          Loading...
        </div>
      )}
      
      {/* User Info Overlay - only show when not fullscreen */}
      {!isFullscreen && <UserInfoOverlay userData={firestoreData} isMobile={isMobile} />}
      
      {/* Mobile Portal Hint */}
      {isMobile && !isFullscreen && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          padding: '6px 12px',
          background: 'rgba(0, 0, 0, 0.7)',
          border: '1px solid rgba(0, 255, 0, 0.3)',
          borderRadius: '15px',
          color: 'rgba(0, 255, 0, 0.8)',
          fontSize: '10px',
          fontWeight: '500',
          pointerEvents: 'none',
          animation: 'pulse 2s infinite'
        }}>
          Double tap to enter
        </div>
      )}
      
      {/* Exit button for fullscreen */}
      {isFullscreen && (
        <button
          onClick={() => {
            setIsFullscreen(false);
            setPortalEntered(false);
          }}
          style={{
            position: 'absolute',
            top: isMobile ? '10px' : '20px',
            right: isMobile ? '10px' : '20px',
            padding: isMobile ? '8px 16px' : '10px 20px',
            background: 'rgba(0, 255, 0, 0.1)',
            border: '1px solid #00ff00',
            color: '#00ff00',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: isMobile ? '12px' : '14px',
            zIndex: 100000
          }}
        >
          {isMobile ? 'Exit' : 'Exit Portal (ESC)'}
        </button>
      )}
      
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

// Preload the model
useGLTF.preload("/models/XCandleAnimatedFlame2.glb");