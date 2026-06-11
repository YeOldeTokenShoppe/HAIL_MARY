import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { EffectComposer, SelectiveBloom } from '@react-three/postprocessing';
import * as THREE from 'three';

// Preload the candle model
useGLTF.preload('/models/tinyJapCanOnly.glb');

// Layer dedicated to bloom-selected flame meshes. Both the default layer (0)
// and this one are enabled on each flame so the main pass still draws them
// normally while SelectiveBloom's masked pass isolates them.
export const FLAME_BLOOM_LAYER = 10;

// Shared time uniform for flame animation
const flameUniforms = {
  uTime: { value: 0 }
};

// Create flame material with flicker animation (from CandleShrine)
function createFlameMaterial(phase = 0) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: flameUniforms.uTime,
      uPhase: { value: phase }
    },
    vertexShader: `
      uniform float uTime;
      uniform float uPhase;

      varying float vHeight;
      varying float vPhase;

      void main() {
        vec3 pos = position;

        // Height normalized 0-1
        vHeight = clamp((pos.y + 0.1) / 0.6, 0.0, 1.0);
        vPhase = uPhase;

        // Flame flicker animation
        float flameTime = uTime * 3.0 + uPhase;

        // Strong sway side to side
        float sway = sin(flameTime * 1.5) * 0.06 * vHeight * vHeight;
        sway += sin(flameTime * 2.3) * 0.03 * vHeight;
        pos.x += sway;

        // Flicker height
        float flicker = sin(flameTime * 2.0) * 0.04 * vHeight;
        flicker += sin(flameTime * 3.7) * 0.02 * vHeight * vHeight;
        pos.y += flicker;

        // Z wobble
        pos.z += cos(flameTime * 1.8) * 0.04 * vHeight * vHeight;

        // Taper at top
        float taper = 1.0 - vHeight * 0.5;
        pos.x *= taper;
        pos.z *= taper;

        // Vertical stretch
        float stretch = 1.0 + sin(flameTime * 2.5) * 0.1 * vHeight;
        pos.y *= stretch;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPhase;
      varying float vHeight;
      varying float vPhase;

      void main() {
        float time = uTime * 3.0 + vPhase;

        // Base flame colors
        vec3 innerColor = vec3(1.0, 0.95, 0.8);
        vec3 midColor = vec3(1.0, 0.5, 0.0);
        vec3 outerColor = vec3(1.0, 0.2, 0.0);

        vec3 color;
        if (vHeight < 0.3) {
          color = mix(innerColor, midColor, vHeight / 0.3);
        } else if (vHeight < 0.7) {
          color = mix(midColor, outerColor, (vHeight - 0.3) / 0.4);
        } else {
          color = mix(outerColor, vec3(1.0, 0.8, 0.0), (vHeight - 0.7) / 0.3);
        }

        float flicker = sin(time * 4.0) * 0.25 + sin(time * 9.0) * 0.15 + 1.0;
        float intensity = 3.5 * flicker;
        float alpha = (1.0 - vHeight * 0.5) * (0.8 + flicker * 0.2);

        gl_FragColor = vec4(color * intensity, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
}

// Postprocessing component to be used alongside MobileCandleOrbital.
// Uses SelectiveBloom keyed off FLAME_BLOOM_LAYER so the composer only
// has to render a small subset of the scene (the flame meshes) into its
// bloom pass — much less work and avoids the full-frame black-flash that
// the plain <Bloom> pass produces in this stack.
//
// React.memo because SelectiveBloom's internal useMemo depends on a
// spread `...props` object and recreates the effect on every render —
// each recreation increments postprocessing's Selection idManager and
// after ~30 remounts it overflows layer 31 and logs "Layer out of range".
export const CandleOrbitalEffects = React.memo(function CandleOrbitalEffects({ lights }) {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false} stencilBuffer={false}>
      <SelectiveBloom
        selectionLayer={FLAME_BLOOM_LAYER}
        lights={lights}
        intensity={1.2}
        luminanceThreshold={0.2}
        luminanceSmoothing={0.9}
        radius={0.5}
        resolutionScale={0.5}
      />
    </EffectComposer>
  );
});

// Global cache to prevent duplicate candle extraction across remounts
const globalCandleCache = {
  candles: null,
  modelId: null
};

// Orbital candle component that receives a cloned VCANDLE
function OrbitalCandle({ angle, radius, candleObject, index, onClick, transitionState, isViewerOpen, yOffset = 0, redChance = 0.35 }) {
  const groupRef = useRef();
  const candleRef = useRef();
  const frozenTimeRef = useRef(null);
  const frozenRotationRef = useRef(null);
  const createdMaterialsRef = useRef([]);
  // Cloned wax materials, kept separately from createdMaterialsRef so the
  // market-direction recolor effect below can retint them in place without
  // re-running the whole mount/setup effect.
  const waxMaterialsRef = useRef([]);

  // Per-index hash in [0,1) — shuffled (not alternating) so the same candle
  // keeps its draw across re-renders. Compared against `redChance`: as the
  // real market direction moves the threshold, each candle flips color at
  // its own hash value, so a mood swing sweeps through the helix candle by
  // candle instead of snapping all at once.
  const hashFrac = useMemo(() => {
    const hash = Math.sin(index * 127.1 + 311.7) * 43758.5453;
    return hash - Math.floor(hash);
  }, [index]);
  const isRed = hashFrac < redChance;
  // Mirror into a ref so the mount effect can paint the initial color
  // without listing `isRed` as a dependency (recoloring is the second
  // effect's job; remounting the candle for a color change would be
  // wasteful and visually jarring).
  const isRedRef = useRef(isRed);
  isRedRef.current = isRed;

  // Setup candle on mount
  useEffect(() => {
    if (!candleObject || !groupRef.current) return;

    // Scale the candle appropriately for mobile
    candleObject.scale.set(0.3, 0.3, 0.3);

    // Ensure the candle is centered in its group
    const box = new THREE.Box3().setFromObject(candleObject);
    const center = box.getCenter(new THREE.Vector3());
    candleObject.position.sub(center);
    candleObject.position.y = 0;

    // Apply flame flicker shader to flame meshes
    const flamePhase = Math.random() * Math.PI * 2;
    candleObject.traverse((child) => {
      if (child.isMesh && child.name?.toLowerCase().includes('flame')) {
        const flameMaterial = createFlameMaterial(flamePhase);
        createdMaterialsRef.current.push(flameMaterial);
        child.material = flameMaterial;
        child.renderOrder = 10;
        child.layers.enable(FLAME_BLOOM_LAYER);
      }
    });

    // Red/green wax — initial draw from the current market-shifted
    // threshold; later threshold moves are handled by the recolor effect.
    const waxColor = isRedRef.current ? 0xcc2222 : 0x22cc22;

    candleObject.traverse((child) => {
      if (child.isMesh && child.name?.toLowerCase() === 'wax') {
        const waxMaterial = child.material.clone();
        createdMaterialsRef.current.push(waxMaterial);
        waxMaterialsRef.current.push(waxMaterial);
        waxMaterial.color = new THREE.Color(waxColor);
        child.material = waxMaterial;
      }
    });

    // Add candle to group
    candleRef.current = candleObject;
    groupRef.current.add(candleObject);

    // Cleanup on unmount
    return () => {
      if (candleRef.current && groupRef.current) {
        groupRef.current.remove(candleRef.current);
      }
      createdMaterialsRef.current.forEach(material => {
        if (material && material.dispose) material.dispose();
      });
      createdMaterialsRef.current = [];
      waxMaterialsRef.current = [];
    };
  }, [candleObject, index]);

  // Retint the wax when the market direction moves this candle across the
  // red/green threshold. The hash-scaled delay staggers the flips so a
  // direction change reads as a wave washing over the helix.
  useEffect(() => {
    const mats = waxMaterialsRef.current;
    if (mats.length === 0) return;
    const id = setTimeout(() => {
      const color = new THREE.Color(isRed ? 0xcc2222 : 0x22cc22);
      mats.forEach((m) => m.color.copy(color));
    }, hashFrac * 2500);
    return () => clearTimeout(id);
  }, [isRed, hashFrac]);
  
  useFrame((state) => {
    if (groupRef.current) {
      // Check if viewer is open
      const viewerOpen = isViewerOpen;
      
      // Manage frozen time
      if (viewerOpen && frozenTimeRef.current === null) {
        // Just opened - freeze the time
        frozenTimeRef.current = state.clock.elapsedTime;
        if (candleRef.current) {
          frozenRotationRef.current = candleRef.current.rotation.y;
        }
      } else if (!viewerOpen && frozenTimeRef.current !== null) {
        // Just closed - unfreeze
        frozenTimeRef.current = null;
        frozenRotationRef.current = null;
      }
      
      // Use frozen time if viewer is open
      const currentTime = frozenTimeRef.current !== null ? frozenTimeRef.current : state.clock.elapsedTime;
      
      // Check if we're in a transition
      if (transitionState && transitionState.isTransitioning && transitionState.progress !== undefined) {
        const { progress, isFadingOut } = transitionState;
        
        // Debug log transition in candle
        if (index === 0 && Math.random() < 0.05) {
         
        }
        
        if (isFadingOut) {
          // Fade out phase - spiral outward
          const spiralOffset = progress * Math.PI * 2;
          const spiralRadius = radius + (progress * 8);
          const fadeOut = Math.max(0, 1 - progress * 2);
          const scaleEffect = Math.max(0.1, 1 - progress);
          
          groupRef.current.position.x = Math.cos(angle + spiralOffset) * spiralRadius;
          groupRef.current.position.z = Math.sin(angle + spiralOffset) * spiralRadius;
          groupRef.current.position.y = progress * 3;
          groupRef.current.scale.setScalar(scaleEffect);
          
          // Fade materials
          if (candleRef.current) {
            candleRef.current.traverse((child) => {
              if (child.material) {
                if (!child.material.transparent) {
                  child.material.transparent = true;
                }
                child.material.opacity = fadeOut;
              }
            });
          }
        } else {
          // Fade in phase - spiral inward
          const time = currentTime * 0.25;
          const targetOrbitAngle = angle + time;
          
          // Calculate where the candle should be in its normal orbit
          const targetRadiusVariation = Math.sin(targetOrbitAngle * 3) * 0.3;
          const targetEffectiveRadius = radius + targetRadiusVariation;
          const targetX = Math.cos(targetOrbitAngle) * targetEffectiveRadius * 1.3;
          const targetZ = Math.sin(targetOrbitAngle) * targetEffectiveRadius * 0.7;
          const targetY = Math.sin(targetOrbitAngle * 2) * 0.3 + Math.sin(currentTime * 2 + index) * 0.1;
          
          // Start from far out and spiral in to the target position
          const spiralOffset = (1 - progress) * Math.PI * 2;
          const spiralRadius = radius + ((1 - progress) * 8);
          const fadeIn = progress;
          const scaleEffect = 0.1 + (progress * 0.9);
          
          // Interpolate from spiral position to target orbit position
          const spiralX = Math.cos(angle + spiralOffset) * spiralRadius;
          const spiralZ = Math.sin(angle + spiralOffset) * spiralRadius;
          const spiralY = (1 - progress) * 3;
          
          // Smooth interpolation to target position
          groupRef.current.position.x = spiralX * (1 - progress) + targetX * progress;
          groupRef.current.position.z = spiralZ * (1 - progress) + targetZ * progress;
          groupRef.current.position.y = spiralY * (1 - progress) + targetY * progress;
          
          // Scale interpolation
          const targetFrontness = (targetZ + radius * 0.7) / (radius * 1.4);
          const targetScale = 0.4 + targetFrontness * 0.3;
          groupRef.current.scale.setScalar(scaleEffect * (1 - progress) + targetScale * progress);
          
          // Fade materials
          if (candleRef.current) {
            candleRef.current.traverse((child) => {
              if (child.material) {
                if (!child.material.transparent) {
                  child.material.transparent = true;
                }
                child.material.opacity = fadeIn;
              }
            });
          }
        }
      } else {
        // Normal orbital animation
        const time = currentTime * 0.25;
        const orbitAngle = angle + time;
        
        const radiusVariation = Math.sin(orbitAngle * 3) * 0.3;
        const effectiveRadius = radius + radiusVariation;
        
        const x = Math.cos(orbitAngle) * effectiveRadius * 1.3;
        const z = Math.sin(orbitAngle) * effectiveRadius * 0.7;
        const y = yOffset + Math.sin(orbitAngle * 2) * 0.9 + Math.sin(currentTime * 2 + index) * 0.1;
        
        groupRef.current.position.set(x, y, z);
        
        if (candleRef.current) {
          candleRef.current.rotation.y = frozenRotationRef.current !== null ? frozenRotationRef.current : currentTime * 0.5;
        }
        
        const frontness = (z + radius * 0.7) / (radius * 1.4);
        const scale = 0.4 + frontness * 0.3;
        groupRef.current.scale.setScalar(scale);
        
        if (candleRef.current) {
          candleRef.current.traverse((child) => {
            if (child.material) {
              // Reset opacity to full for non-transition state
              if (child.material.transparent && child.material.opacity < 1) {
                child.material.opacity = 1;
              }
            }
          });
        }
      }
    }
  });
  
  const handleClick = (e) => {
    e.stopPropagation();
    onClick?.({
      candleId: `mobile-candle-${index}`,
      candleTimestamp: Date.now(),
    });
  };
  
  return (
    <group ref={groupRef} onClick={handleClick}>
      {/* No badges or text - just the pure candle objects */}
    </group>
  );
}

// Main orbital system to be added to existing scene
function MobileCandleOrbital({ candleData = [], onCandleClick, onPaginationChange, isViewerOpen = false, priceDirection = 0 }) {
  const groupRef = useRef();
  const [vcandleObjects, setVcandleObjects] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Load the candle model directly
  const { scene: candleModel } = useGLTF('/models/tinyJapCanOnly.glb');

  const [transitionStartTime, setTransitionStartTime] = useState(0);

  // Configuration for the Illumin80
  const VISIBLE_CANDLES = 48;
  // Helix spread — total vertical range candles occupy, centered on the
  // group's y. Roughly matches the BackgroundChart's vertical extent so the
  // candle column fills the visible chart from near-bottom to near-top.
  const HELIX_SPREAD = 23;
  const ROTATION_INTERVAL = 15000; // 15 seconds between rotations
  const TRANSITION_DURATION = 2000; // 2 second fade transition

  // Map real market direction [-1, 1] onto the share of red candles.
  // 0.35 is the authored bullish-lean baseline; a full pump leaves a few
  // embers of red (0.05) and a full dump turns the sky mostly red (0.65)
  // while keeping both colors present so the helix never goes monochrome.
  const redChance = Math.max(0.05, Math.min(0.65, 0.35 - priceDirection * 0.3));

  // Extract and clone candle objects from the loaded model
  useEffect(() => {
    if (!candleModel) return;

    // Check global cache first to prevent duplicate extractions across remounts
    const modelId = 'tinyJapCanOnly';
    if (globalCandleCache.modelId === modelId && globalCandleCache.candles) {
      setVcandleObjects(globalCandleCache.candles);
      return;
    }

    const extractedCandles = [];

    // Clone the entire model as our base candle
    const clonedCandle = candleModel.clone(true);

    // Make sure the cloned candle and all its children are visible
    clonedCandle.visible = true;
    clonedCandle.traverse((descendant) => {
      descendant.visible = true;
    });

    // Create multiple candle instances for the orbital display
    for (let i = 0; i < 8; i++) {
      const candleInstance = clonedCandle.clone(true);
      candleInstance.visible = true;
      candleInstance.traverse((descendant) => {
        descendant.visible = true;
      });

      extractedCandles.push({
        object: candleInstance,
        name: `CANDLE${i}`,
      });
    }

    // Debug: Log details about extracted candles

    // Cache the extracted candles globally
    globalCandleCache.modelId = modelId;
    globalCandleCache.candles = extractedCandles;

    setVcandleObjects(extractedCandles);
  }, [candleModel]);
  
  // Get candle count (up to 80 for display)
  const candleCount = React.useMemo(() => {
    return Math.min(Math.max(candleData.length, VISIBLE_CANDLES), 80);
  }, [candleData.length]);

  // Calculate total pages
  const totalPages = Math.ceil(candleCount / VISIBLE_CANDLES);

  // Create candle objects for display
  const combinedData = React.useMemo(() => {
    if (vcandleObjects.length === 0) return [];

    const startIdx = currentPage * VISIBLE_CANDLES;
    const count = Math.min(VISIBLE_CANDLES, candleCount - startIdx);

    return Array.from({ length: count }, (_, index) => {
      const vcandleIndex = index % vcandleObjects.length;
      const clonedCandle = vcandleObjects[vcandleIndex].object.clone(true);

      return {
        candleObject: clonedCandle,
        originalName: `candle-page${currentPage}-idx${index}`,
      };
    });
  }, [vcandleObjects, currentPage, candleCount]);
  
  // Create a stable setCurrentPage function
  const handleSetCurrentPage = useCallback((page) => {
    // If viewer is open, just change page without transition animation
    if (isViewerOpen) {
      setCurrentPage(page);
      return;
    }

    // Start transition with current candles
    setIsTransitioning(true);
    setTransitionStartTime(Date.now());

    // Immediately set initial transition state
    setTransitionState({
      isTransitioning: true,
      progress: 0,
      isFadingOut: true
    });

    // Wait for candles to spiral out before changing
    setTimeout(() => {
      setCurrentPage(page);

      // Continue transition for fade-in
      setTimeout(() => {
        setIsTransitioning(false);
        setTransitionStartTime(0);
      }, TRANSITION_DURATION / 2);
    }, TRANSITION_DURATION / 2); // Change page halfway through transition
  }, [TRANSITION_DURATION, isViewerOpen]);
  
  // Create transition state to pass to children
  const [transitionState, setTransitionState] = useState(null);
  
  // Track if we've done the initial spin effect
  const [hasInitialSpinCompleted, setHasInitialSpinCompleted] = useState(false);
  
  // Auto spin effect after initial load (without pagination)
  useEffect(() => {
    if (!hasInitialSpinCompleted && vcandleObjects.length > 0) {
      // Wait for the initial load time before doing the spin effect
      const timer = setTimeout(() => {

        
        // Start the transition animation
        setIsTransitioning(true);
        const startTime = Date.now();
        setTransitionStartTime(startTime);
        
        // Set initial transition state for spin effect
        setTransitionState({
          isTransitioning: true,
          progress: 0,
          isFadingOut: true // Start with fade-out for the spin
        });
        
        // After half duration, switch to fade-in (but don't change page)
        setTimeout(() => {
          setTransitionState({
            isTransitioning: true,
            progress: 0,
            isFadingOut: false
          });
        }, TRANSITION_DURATION / 2);
        
        // End the transition after full duration
        setTimeout(() => {
          setIsTransitioning(false);
          setTransitionStartTime(0);
          setHasInitialSpinCompleted(true);
    
        }, TRANSITION_DURATION);
      }, ROTATION_INTERVAL); // Use same delay as before
      
      return () => clearTimeout(timer);
    }
  }, [hasInitialSpinCompleted, vcandleObjects.length, ROTATION_INTERVAL, TRANSITION_DURATION]);
  
  
  // Add a slow overall rotation to the entire group and update flame animation
  useFrame((state) => {
    // Update flame animation time uniform
    flameUniforms.uTime.value = state.clock.elapsedTime;

    if (groupRef.current) {
      if (isViewerOpen) {
        // Don't update rotation when viewer is open
      } else {
        // Only rotate when viewer is closed
        groupRef.current.rotation.y = state.clock.elapsedTime * 0.05;
      }
    }
    
    // Update transition state
    if (groupRef.current && isTransitioning && transitionStartTime > 0) {
        const elapsed = Date.now() - transitionStartTime;
        const halfDuration = TRANSITION_DURATION / 2;
        
        // Determine which phase we're in
        const isFadingOut = elapsed < halfDuration;
        const phaseProgress = isFadingOut 
          ? elapsed / halfDuration // 0 to 1 during fade out
          : (elapsed - halfDuration) / halfDuration; // 0 to 1 during fade in
        
        // Update transition state for children
        setTransitionState({
          isTransitioning: true,
          progress: phaseProgress,
          isFadingOut
        });
        
        // Debug logging - only log every 10th frame or so
        if (Math.random() < 0.05) {
         
        }
    } else if (transitionState) {
      // Clear transition state when not transitioning
      setTransitionState(null);
    }
  });
  

  // Pass pagination state up to parent
  useEffect(() => {
    if (onPaginationChange) {
      onPaginationChange({
        currentPage,
        totalPages,
        setCurrentPage: handleSetCurrentPage,
        visibleRange: {
          start: currentPage * VISIBLE_CANDLES + 1,
          end: Math.min((currentPage + 1) * VISIBLE_CANDLES, candleCount)
        },
        total: candleCount
      });
    }
  }, [currentPage, totalPages, candleCount, onPaginationChange, handleSetCurrentPage]);

  return (
    <group ref={groupRef} position={[0, -3.5, 0]}>
      {/* The candles — helix: even angular spread + linear vertical spread */}
      {combinedData.map((item, index) => {
        const total = combinedData.length;
        const angle = (index / total) * Math.PI * 4;
        const yOffset = total > 1
          ? (index / (total - 1) - 0.5) * HELIX_SPREAD
          : 0;
        return (
          <OrbitalCandle
            key={item.originalName || index}
            angle={angle}
            radius={1.5}
            candleObject={item.candleObject}
            index={index}
            yOffset={yOffset}
            onClick={onCandleClick}
            transitionState={transitionState}
            isViewerOpen={isViewerOpen}
            redChance={redChance}
          />
        );
      })}
      
      {/* Central glow effect */}
      <pointLight
        position={[0, 0, 0]}
        color="#8b7dd8"
        intensity={0.5}
        distance={6}
        decay={2}
      />
    </group>
  );
}

// Wrap with React.memo to prevent unnecessary re-renders and re-extractions
export default React.memo(MobileCandleOrbital, (prevProps, nextProps) => {
  return (
    prevProps.candleData === nextProps.candleData &&
    prevProps.isViewerOpen === nextProps.isViewerOpen &&
    prevProps.onCandleClick === nextProps.onCandleClick &&
    prevProps.onPaginationChange === nextProps.onPaginationChange &&
    prevProps.priceDirection === nextProps.priceDirection
  );
});