"use client";

import React, { useRef, Suspense, useEffect, useMemo, useCallback, useState } from "react";
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, useAnimations, useHelper } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import InteractiveScroll2 from './InteractiveScroll2';
import ToyPreviewPortal, { TOY_PREVIEW_CONFIG } from './ToyPreviewPortal';
import { useWeeklyPrize } from '@/hooks/useWeeklyPrize';
import { useWalletAuth } from './WalletAuthProvider';
import { useUser } from '@clerk/nextjs';

// Configure DRACO loader for compressed GLB files
useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

// Set to true when the first collectible drop is ready to go live
const DROPS_ENABLED = false;

// Capsule base colors that cycle
const CAPSULE_COLORS = ['#3943BC', '#14A122', '#A81814'];

// Centered capsule model that appears when capsule is clicked
function CenteredCapsule({ visible, onToyClick, onZoomComplete, modelPath, capsuleColorIndex = 0 }) {
  const { scene } = useGLTF(modelPath || '/models/ipadMaryToy.glb');
  const { camera } = useThree();
  const groupRef = useRef();
  const glassRef = useRef();
  const baseRef = useRef();
  const toyRef = useRef();
  const [isOpening, setIsOpening] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomComplete, setZoomComplete] = useState(false);

  const initialPositions = useRef({ glass: null, base: null, toy: null });
  const initialCameraPos = useRef(null);
  const zoomTarget = useRef(new THREE.Vector3(0, 0.25, 0.65));

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
      }
    });
    return clone;
  }, [scene]);

  // Reset state when hidden
  useEffect(() => {
    if (!visible) {
      setIsOpening(false);
      setIsZooming(false);
      setZoomComplete(false);
      if (onZoomComplete) onZoomComplete(false);
      if (initialCameraPos.current && camera) {
        camera.position.copy(initialCameraPos.current);
      }
      initialCameraPos.current = null;
    }
  }, [visible, camera, onZoomComplete]);

  // Find capsule parts and toy, then start opening + zoom immediately
  useEffect(() => {
    if (groupRef.current && visible) {
      groupRef.current.traverse((child) => {
        if (child.name === 'CapsuleGlassA' || child.name.includes('Glass')) {
          glassRef.current = child;
          if (!initialPositions.current.glass) {
            initialPositions.current.glass = child.position.y;
          }
        }
        if (child.name === 'CapsuleBaseA' || child.name.includes('Base')) {
          baseRef.current = child;
          if (!initialPositions.current.base) {
            initialPositions.current.base = child.position.y;
          }
          const colorIndex = capsuleColorIndex % CAPSULE_COLORS.length;
          if (child.material) {
            child.material.color.set(CAPSULE_COLORS[colorIndex]);
          }
        }
        // Find the IpadMary parent object for rotation
        if (child.name === 'IpadMary') {
          toyRef.current = child;
          if (!initialPositions.current.toy) {
            initialPositions.current.toy = child.position.y;
          }
        }
      });

      // Start opening animation and zoom simultaneously
      setTimeout(() => {
        setIsOpening(true);
        // Save camera position and start zooming
        if (!initialCameraPos.current) {
          initialCameraPos.current = camera.position.clone();
        }
        setIsZooming(true);
      }, 300);
    }
  }, [visible, capsuleColorIndex, camera]);

  // Animation
  useFrame((state) => {
    if (!visible || !groupRef.current) return;

    // Opening animation for capsule parts
    if (isOpening) {
      if (glassRef.current && initialPositions.current.glass !== null) {
        const targetY = initialPositions.current.glass + 0.15;
        const diff = targetY - glassRef.current.position.y;
        if (Math.abs(diff) > 0.01) {
          glassRef.current.position.y += diff * 0.03;
        }
      }
      if (baseRef.current && initialPositions.current.base !== null) {
        const targetY = initialPositions.current.base - 0.15;
        const diff = targetY - baseRef.current.position.y;
        if (Math.abs(diff) > 0.01) {
          baseRef.current.position.y += diff * 0.03;
        }
      }
    }

    // Floating animation for the toy
    if (toyRef.current && initialPositions.current.toy !== undefined) {
      toyRef.current.position.y = initialPositions.current.toy + Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
      toyRef.current.rotation.y += 0.003;
    }

    // Camera zoom animation - starts automatically when visible
    if (isZooming && camera) {
      const target = zoomTarget.current;
      camera.position.lerp(target, 0.15);

      const dist = camera.position.distanceTo(target);
      if (dist < 0.1) {
        setIsZooming(false);
        setZoomComplete(true);
        if (onZoomComplete) onZoomComplete(true);
      }
    }
  });

  // Handle click - only triggers claim after zoom is complete
  const handleClick = useCallback((e) => {
    e.stopPropagation();
    if (zoomComplete) {
      if (onToyClick) onToyClick();
    }
  }, [zoomComplete, onToyClick]);

  if (!visible) return null;

  return (
    <group
      ref={groupRef}
      position={[0, 0.2, 0.5]}
      onClick={handleClick}
      onPointerOver={() => { document.body.style.cursor = zoomComplete ? 'pointer' : 'default'; }}
      onPointerOut={() => { document.body.style.cursor = 'auto'; }}
    >
      <primitive object={clonedScene} scale={0.3} />
    </group>
  );
}

// Vending Machine component with interactive dial
function VendingMachine({ scale = 1, position = [0, 0, 0], rotation = [0, 0, 0], controlsRef, onDialComplete, onCapsuleClick, resetKey = 0, capsuleColorIndex = 0, disabled = false }) {
  const { scene, animations } = useGLTF('/models/toyVENDnft.glb');
  const groupRef = useRef();
  const { actions } = useAnimations(animations, groupRef);
  const dialRef = useRef();
  const dialMaterialsRef = useRef([]); // Store dial materials for glow effect
  const capsuleGlassRef = useRef();
  const capsuleBaseRef = useRef();
  const toyRef = useRef(); // Reference to the IpadMary toy object

  const [isDragging, setIsDragging] = useState(false);
  const [capsuleVisible, setCapsuleVisible] = useState(false);
  const [capsuleClicked, setCapsuleClicked] = useState(false);
  const [capsuleDropping, setCapsuleDropping] = useState(false);

  const dragStartRef = useRef({ x: 0, rotation: 0 });
  const targetRotation = useRef(0);
  const clankSoundRef = useRef(null);

  // Capsule drop animation state
  const capsuleAnimState = useRef({
    dropHeight: 0.3,
    currentOffset: 0,
    velocity: 0,
    rotation: 0,
    rotationVelocity: 0,
    bounceCount: 0,
    settled: false,
    initialPositions: { glass: null, base: null, toy: null }
  });

  // Initialize clank sound
  useEffect(() => {
    clankSoundRef.current = new Audio('/clank.mp3');
    clankSoundRef.current.volume = 0.5;
  }, []);

  // Play model animation on loop
  useEffect(() => {
    if (actions) {
      Object.values(actions).forEach((action) => {
        if (action) {
          action.setLoop(THREE.LoopRepeat);
          action.play();
        }
      });
    }
  }, [actions]);

  // Reset state when resetKey changes
  useEffect(() => {
    setCapsuleVisible(false);
    setCapsuleClicked(false);
    setCapsuleDropping(false);
    capsuleAnimState.current.settled = false;
    targetRotation.current = 0;
    currentRotationAmount.current = 0;
    if (dialRef.current) {
      dialRef.current.rotation.set(0, 0, 0);
    }
  }, [resetKey]);

  // Clone scene
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  // Find objects after the scene is mounted
  useEffect(() => {
    if (groupRef.current) {
      dialMaterialsRef.current = []; // Reset materials array
      groupRef.current.traverse((child) => {
        if (child.name === 'DIAL') {
          dialRef.current = child;
          // Collect all materials from the dial for glow effect
          child.traverse((dialChild) => {
            if (dialChild.isMesh && dialChild.material) {
              const mat = dialChild.material;
              mat.emissive = new THREE.Color(0x00f5d4); // Teal glow color
              mat.emissiveIntensity = 0;
              dialMaterialsRef.current.push(mat);
            }
          });
        }
        if (child.name === 'CapsuleGlassA') {
          capsuleGlassRef.current = child;
          child.visible = false;
        }
        if (child.name === 'CapsuleBaseA') {
          capsuleBaseRef.current = child;
          child.visible = false;
        }
        // Find and hide IpadMary toy (and its children will be hidden automatically)
        if (child.name === 'IpadMary') {
          toyRef.current = child;
          child.visible = false;
        }
      });
    }
  }, [clonedScene]);

  // Update capsule visibility when state changes
  useEffect(() => {
    const shouldShow = capsuleVisible && !capsuleClicked;

    if (shouldShow && capsuleGlassRef.current && !capsuleDropping) {
      const anim = capsuleAnimState.current;
      anim.initialPositions.glass = capsuleGlassRef.current.position.y;
      if (capsuleBaseRef.current) anim.initialPositions.base = capsuleBaseRef.current.position.y;
      if (toyRef.current) anim.initialPositions.toy = toyRef.current.position.y;

      anim.currentOffset = anim.dropHeight;
      anim.velocity = 0;
      anim.rotation = 0;
      anim.rotationVelocity = (Math.random() - 0.5) * 0.3;
      anim.bounceCount = 0;
      anim.settled = false;

      const startOffset = anim.dropHeight;
      capsuleGlassRef.current.position.y = anim.initialPositions.glass + startOffset;
      if (capsuleBaseRef.current) capsuleBaseRef.current.position.y = anim.initialPositions.base + startOffset;
      if (toyRef.current) toyRef.current.position.y = anim.initialPositions.toy + startOffset;

      capsuleGlassRef.current.visible = true;
      if (capsuleBaseRef.current) {
        capsuleBaseRef.current.visible = true;
        const colorIndex = capsuleColorIndex % CAPSULE_COLORS.length;
        if (capsuleBaseRef.current.material) {
          capsuleBaseRef.current.material.color.set(CAPSULE_COLORS[colorIndex]);
        }
      }
      // Show IpadMary toy when capsule drops
      if (toyRef.current) {
        toyRef.current.visible = true;
      }

      setCapsuleDropping(true);
    } else if (!shouldShow) {
      const anim = capsuleAnimState.current;
      if (capsuleGlassRef.current) {
        capsuleGlassRef.current.visible = false;
        if (anim.initialPositions.glass !== null) {
          capsuleGlassRef.current.position.y = anim.initialPositions.glass;
          capsuleGlassRef.current.rotation.z = 0;
        }
      }
      if (capsuleBaseRef.current) {
        capsuleBaseRef.current.visible = false;
        if (anim.initialPositions.base !== null) {
          capsuleBaseRef.current.position.y = anim.initialPositions.base;
          capsuleBaseRef.current.rotation.z = 0;
        }
      }
      // Hide IpadMary toy when capsule is hidden
      if (toyRef.current) {
        toyRef.current.visible = false;
        if (anim.initialPositions.toy !== null) {
          toyRef.current.position.y = anim.initialPositions.toy;
        }
      }
    }
  }, [capsuleVisible, capsuleClicked, capsuleDropping, capsuleColorIndex]);

  const currentRotationAmount = useRef(0);
  const rotationAxis = useMemo(() => new THREE.Vector3(1, 0, 0), []);

  // Smooth dial rotation animation
  useFrame((state) => {
    if (dialRef.current) {
      const diff = targetRotation.current - currentRotationAmount.current;

      if (Math.abs(diff) > 0.001) {
        const delta = diff * 0.08;
        currentRotationAmount.current += delta;
        dialRef.current.rotateOnWorldAxis(rotationAxis, delta);
      }

      if (Math.abs(currentRotationAmount.current) >= Math.PI / 2 - 0.05 && targetRotation.current !== 0) {
        if (!capsuleVisible) {
          setCapsuleVisible(true);
          if (onDialComplete) onDialComplete();
        }
        targetRotation.current = 0;
      }

      // Pulsing glow effect on dial when not disabled (eligible to claim)
      if (dialMaterialsRef.current.length > 0) {
        if (!disabled && !capsuleVisible) {
          // Subtle pulse between 0.05 and 0.15 intensity
          const pulseIntensity = 0.1 + Math.sin(state.clock.elapsedTime * 1.5) * 0.05;
          dialMaterialsRef.current.forEach(mat => {
            mat.emissiveIntensity = pulseIntensity;
          });
        } else {
          // No glow when disabled or capsule is visible
          dialMaterialsRef.current.forEach(mat => {
            mat.emissiveIntensity = 0;
          });
        }
      }
    }

    // Capsule drop animation
    if (capsuleDropping && !capsuleAnimState.current.settled) {
      const anim = capsuleAnimState.current;
      const gravity = 0.0015;
      const bounceDamping = 0.4;
      const rotationDamping = 0.85;

      anim.velocity += gravity;
      anim.currentOffset -= anim.velocity;
      anim.rotation += anim.rotationVelocity;
      anim.rotationVelocity *= rotationDamping;

      if (anim.currentOffset <= 0) {
        anim.currentOffset = 0;
        anim.bounceCount++;

        if (anim.bounceCount < 3 && Math.abs(anim.velocity) > 0.005) {
          anim.velocity = -anim.velocity * bounceDamping;
          anim.rotationVelocity = (Math.random() - 0.5) * 0.1;
        } else {
          anim.velocity = 0;
          anim.rotation = 0;
          anim.currentOffset = 0;
          anim.settled = true;
        }
      }

      const offset = anim.currentOffset;
      if (capsuleGlassRef.current && anim.initialPositions.glass !== null) {
        capsuleGlassRef.current.position.y = anim.initialPositions.glass + offset;
      }
      if (capsuleBaseRef.current && anim.initialPositions.base !== null) {
        capsuleBaseRef.current.position.y = anim.initialPositions.base + offset;
      }
      // Animate IpadMary toy drop along with capsule
      if (toyRef.current && anim.initialPositions.toy !== null) {
        toyRef.current.position.y = anim.initialPositions.toy + offset;
      }
    }

    // Rotate IpadMary toy continuously while visible
    if (toyRef.current && toyRef.current.visible) {
      toyRef.current.rotation.y += 0.01;
    }
  });

  const isCapsuleObject = useCallback((obj) => {
    // Check capsule parts
    if (obj.name === 'CapsuleGlassA' || obj.name === 'CapsuleBaseA' ||
        obj === capsuleGlassRef.current || obj === capsuleBaseRef.current) {
      return true;
    }
    // Check IpadMary toy and its children
    if (obj.name === 'IpadMary' || obj === toyRef.current) {
      return true;
    }
    // Check if it's a child of IpadMary
    let parent = obj.parent;
    while (parent) {
      if (parent.name === 'IpadMary' || parent === toyRef.current) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }, []);

  const handleCapsuleClick = useCallback(() => {
    if (!capsuleClicked && capsuleVisible) {
      setCapsuleClicked(true);
      if (onCapsuleClick) onCapsuleClick();
    }
  }, [capsuleClicked, capsuleVisible, onCapsuleClick]);

  const isDescendant = useCallback((obj, parent) => {
    let current = obj.parent;
    while (current) {
      if (current === parent) return true;
      current = current.parent;
    }
    return false;
  }, []);

  const isDialObject = useCallback((obj) => {
    if (!dialRef.current) return false;
    return obj === dialRef.current ||
           obj.parent === dialRef.current ||
           isDescendant(obj, dialRef.current) ||
           obj.name === 'DIAL' ||
           (obj.parent && obj.parent.name === 'DIAL');
  }, [isDescendant]);

  const handlePointerDown = useCallback((e) => {
    if (disabled) return;
    if (isDialObject(e.object)) {
      e.stopPropagation();
      setIsDragging(true);
      if (clankSoundRef.current) {
        clankSoundRef.current.currentTime = 0;
        clankSoundRef.current.play().catch(() => {});
      }
      dragStartRef.current = {
        x: e.point.x,
        rotation: targetRotation.current
      };
      if (controlsRef?.current) {
        controlsRef.current.enabled = false;
      }
    }
  }, [controlsRef, isDialObject, disabled]);

  const handlePointerMove = useCallback((e) => {
    if (isDragging && dialRef.current) {
      e.stopPropagation();
      const deltaX = e.point.x - dragStartRef.current.x;
      let newRotation = dragStartRef.current.rotation - deltaX * 2;
      newRotation = Math.max(-Math.PI / 2, Math.min(0, newRotation));
      targetRotation.current = newRotation;
    }
  }, [isDragging]);

  const handlePointerUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      if (controlsRef?.current) {
        controlsRef.current.enabled = true;
      }
      if (targetRotation.current < -Math.PI / 4) {
        targetRotation.current = -Math.PI / 2;
      } else {
        targetRotation.current = 0;
      }
    }
  }, [isDragging, controlsRef]);

  const handleClick = useCallback((e) => {
    if (disabled) return;
    if (isDialObject(e.object)) {
      e.stopPropagation();
      if (clankSoundRef.current) {
        clankSoundRef.current.currentTime = 0;
        clankSoundRef.current.play().catch(() => {});
      }
      targetRotation.current = -Math.PI / 2;
    } else if (isCapsuleObject(e.object)) {
      e.stopPropagation();
      handleCapsuleClick();
    }
  }, [isDialObject, isCapsuleObject, handleCapsuleClick, disabled]);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.traverse((child) => {
        if (child.isMesh) {
          child.raycast = new THREE.Mesh().raycast;
        }
      });
    }
  }, [clonedScene]);

  return (
    <group
      ref={groupRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={handleClick}
      onPointerOver={(e) => {
        if (!disabled && (isDialObject(e.object) || isCapsuleObject(e.object))) {
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      <primitive
        object={clonedScene}
        scale={scale}
        position={position}
        rotation={rotation}
      />
    </group>
  );
}

// Prize Status Bar - shows claim count and status
function PrizeStatusBar({ currentPrize, claimStatus, remainingClaims, eligibilityDetails, onSignIn, onConnectWallet }) {
  const getStatusMessage = () => {
    switch (claimStatus) {
      case 'loading':
        return { text: 'Loading...', color: 'rgba(255, 255, 255, 0.5)' };
      case 'no_prize':
        return { text: 'Check back for the first collectible drop coming soon', color: 'rgba(255, 255, 255, 0.5)', isNoPrize: true };
      case 'available':
        return { text: `${remainingClaims} of ${currentPrize?.maxClaims || 100} remaining`, color: '#00f5d4' };
      case 'claimed':
        return { text: "You collected this week's prize!", color: '#00ff88' };
      case 'sold_out':
        return { text: 'All 100 prizes claimed! Check back next week.', color: '#ff6b6b', isNoPrize: true };
      case 'ineligible':
        if (!eligibilityDetails.isSignedIn) {
          return { text: 'Sign in to claim', color: '#ffd700', action: onSignIn };
        }
        if (!eligibilityDetails.isWalletConnected) {
          return { text: 'Connect wallet to claim', color: '#ffd700', action: onConnectWallet };
        }
        if (!eligibilityDetails.hasTokens) {
          return { text: 'Hold RL80 tokens to claim', color: '#ffd700' };
        }
        return { text: 'Not eligible', color: '#ff6b6b' };
      default:
        return { text: '', color: 'rgba(255, 255, 255, 0.5)' };
    }
  };

  const status = getStatusMessage();

  // Show enhanced message when no prize is available
  if (status.isNoPrize) {
    return (
      <div style={{
        minHeight: '120px',
        width: '100%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.7), transparent)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '12px',
        padding: '20px 15px',
        paddingBottom: 'max(25px, calc(env(safe-area-inset-bottom) + 15px))',
        boxSizing: 'border-box',
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: '2rem',
          opacity: 0.6,
        }}>
          🎁
        </div>
        <div style={{
          color: '#fff',
          fontFamily: "'Orbitron', monospace",
          fontSize: '0.85rem',
          fontWeight: '600',
          textAlign: 'center',
          textShadow: '0 0 10px rgba(0,0,0,0.5)',
        }}>
          {claimStatus === 'sold_out' ? 'Sold Out!' : 'Coming Soon'}
        </div>
        <div style={{
          color: status.color,
          fontFamily: "'Orbitron', monospace",
          fontSize: '0.7rem',
          letterSpacing: '0.5px',
          textAlign: 'center',
          lineHeight: '1.5',
          maxWidth: '280px',
        }}>
          {status.text}
        </div>
        <div style={{
          color: 'rgba(255, 255, 255, 0.4)',
          fontSize: '0.65rem',
          textAlign: 'center',
          fontStyle: 'italic',
        }}>
          Collectibles for RL80 holders
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '90px',
      width: '100%',
      background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '8px',
      padding: '15px 10px',
      paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom) + 10px))',
      boxSizing: 'border-box',
      flexShrink: 0,
    }}>
      {currentPrize && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          {currentPrize.previewConfig?.icon && (
            <img
              src={currentPrize.previewConfig.icon}
              alt={currentPrize.name}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: `2px solid ${currentPrize.previewConfig?.accentColor || '#00f5d4'}`,
                boxShadow: `0 0 10px ${currentPrize.previewConfig?.accentColor || '#00f5d4'}40`,
              }}
            />
          )}
          <div style={{
            color: '#fff',
            fontFamily: "'Orbitron', monospace",
            fontSize: '0.9rem',
            fontWeight: '600',
            textShadow: '0 0 10px rgba(0,0,0,0.5)',
          }}>
            {currentPrize.name}
          </div>
        </div>
      )}
      <div
        onClick={status.action}
        style={{
          color: status.color,
          fontFamily: "'Orbitron', monospace",
          fontSize: '0.7rem',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          cursor: status.action ? 'pointer' : 'default',
          transition: 'all 0.3s ease',
          textAlign: 'center',
          padding: '0 15px',
          lineHeight: '1.4',
        }}
      >
        {status.text}
      </div>
    </div>
  );
}

// 3D Model Preview component for displaying collectibles
function ModelPreviewScene({ modelPath }) {
  const { scene } = useGLTF(modelPath);
  const modelRef = useRef();

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
      }
    });
    return clone;
  }, [scene]);

  // Auto-rotate the model
  useFrame((state) => {
    if (modelRef.current) {
      modelRef.current.rotation.y += 0.01;
    }
  });

  // Find the toy object (IpadMary or similar) and only show that
  useEffect(() => {
    if (modelRef.current) {
      modelRef.current.traverse((child) => {
        // Hide capsule parts, only show the toy
        if (child.name.includes('Capsule') || child.name.includes('Glass') || child.name.includes('Base')) {
          child.visible = false;
        }
      });
    }
  }, [clonedScene]);

  return (
    <primitive ref={modelRef} object={clonedScene} scale={3.5} position={[0, -0.1, 0]} />
  );
}

// Exportable Model Preview component with Canvas
export function ModelPreview({ modelPath, size = 150 }) {
  if (!modelPath) return null;

  return (
    <div style={{ width: size, height: size, margin: '0 auto' }}>
      <Canvas
        camera={{ position: [0, 0.2, 1.2], fov: 45 }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={1} />
        {/* <directionalLight position={[-2, 2, 0]} intensity={5} /> */}
        <Suspense fallback={null}>
          <ModelPreviewScene modelPath={modelPath} />
        </Suspense>
      </Canvas>
    </div>
  );
}

// Success Modal after claiming
function ClaimSuccessModal({ isOpen, prize, onClose }) {
  if (!isOpen || !prize) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        animation: 'fadeIn 0.3s ease-out',
      }}
    >
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.8); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 245, 212, 0.5); }
          50% { box-shadow: 0 0 40px rgba(0, 245, 212, 0.8); }
        }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(20, 20, 30, 0.98)',
          border: '2px solid #00f5d4',
          borderRadius: '20px',
          padding: '2rem',
          maxWidth: '400px',
          textAlign: 'center',
          animation: 'scaleIn 0.4s ease-out, glow 2s ease-in-out infinite',
        }}
      >
        {/* Prize Image */}
        <div style={{ marginBottom: '1rem' }}>
          {prize.icon ? (
            <img
              src={prize.icon}
              alt={prize.name}
              style={{
                width: '150px',
                height: '150px',
                objectFit: 'contain',
                borderRadius: '12px',
              }}
            />
          ) : (
            <div style={{ fontSize: '3rem' }}>🎉</div>
          )}
        </div>
        <h2 style={{
          fontFamily: "'Orbitron', monospace",
          fontSize: '1.5rem',
          color: '#00f5d4',
          marginBottom: '0.5rem',
        }}>
          Prize Claimed!
        </h2>
        <p style={{
          color: '#fff',
          fontSize: '1.1rem',
          marginBottom: '0.5rem',
        }}>
          {prize.name}
        </p>
        <p style={{
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '0.9rem',
          marginBottom: '1.5rem',
        }}>
          {prize.description}
        </p>
        <p style={{
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: '0.75rem',
        }}>
          View your collection in Account &gt; Collection
        </p>
        <button
          onClick={onClose}
          style={{
            marginTop: '1.5rem',
            padding: '0.75rem 2rem',
            background: '#00f5d4',
            border: 'none',
            borderRadius: '50px',
            color: '#000',
            fontFamily: "'Orbitron', monospace",
            fontSize: '0.9rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s',
          }}
        >
          CONTINUE
        </button>
      </div>
    </div>
  );
}

// Checkerboard floor component
function CheckerboardFloor({ position = [0, -0.65, 0], size = 6 }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const tileSize = 8;
    for (let y = 0; y < 64; y += tileSize) {
      for (let x = 0; x < 64; x += tileSize) {
        const isWhite = ((x / tileSize) + (y / tileSize)) % 2 === 0;
        ctx.fillStyle = isWhite ? '#ffffff' : '#000000';
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

// Inner scene component to access OrbitControls ref
function VendingSceneInner({ onToyClick, onZoomComplete, resetKey, capsuleColorIndex, modelPath, disabled }) {
  const controlsRef = useRef();
  const spotlightRef = useRef();
  const [showCenteredCapsule, setShowCenteredCapsule] = useState(false);

  // Spotlight helper for debugging - shows cone and direction
  // useHelper(spotlightRef, THREE.SpotLightHelper, 'cyan');

  useEffect(() => {
    setShowCenteredCapsule(false);
  }, [resetKey]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      {/* <pointLight position={[-3, 2, 2]} color="#ffffff" intensity={0.5} /> */}

      {/* Spotlight for dramatic effect */}
      <spotLight
        ref={spotlightRef}
        color={0xffffff}
        intensity={30}
        position={[0.5, 2, 1.5]}
        angle={0.52}
        penumbra={1}
        decay={2}
        distance={0}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={2}
        shadow-camera-far={10}
        shadow-focus={1}
        shadow-bias={-0.003}
      />

      {/* Checkerboard floor */}
      <CheckerboardFloor position={[0, -0.65, 0]} size={6} />

      <VendingMachine
        scale={0.3}
        position={[0, -0.65, 0]}
        controlsRef={controlsRef}
        onCapsuleClick={() => setShowCenteredCapsule(true)}
        resetKey={resetKey}
        capsuleColorIndex={capsuleColorIndex}
        disabled={disabled}
      />

      <CenteredCapsule
        visible={showCenteredCapsule}
        onToyClick={onToyClick}
        onZoomComplete={onZoomComplete}
        modelPath={modelPath}
        capsuleColorIndex={capsuleColorIndex}
      />

      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        minDistance={0.5}
        maxDistance={1.5}
        zoomToCursor
        dampingFactor={0.1}
        target={[0, 0, 0]}
      />

      <EffectComposer>
        <Bloom
          intensity={0.2}
          luminanceThreshold={0.9}
          luminanceSmoothing={0.9}
        />
      </EffectComposer>
    </>
  );
}

// Main exported component
export default function VendingMachineScene() {
  const { user } = useUser();
  const { isWalletConnected } = useWalletAuth();
  const weeklyPrize = useWeeklyPrize();

  // Override prize data when drops aren't enabled yet
  const currentPrize = DROPS_ENABLED ? weeklyPrize.currentPrize : null;
  const claimStatus = DROPS_ENABLED ? weeklyPrize.claimStatus : 'no_prize';
  const remainingClaims = DROPS_ENABLED ? weeklyPrize.remainingClaims : 0;
  const claimPrize = weeklyPrize.claimPrize;
  const isClaimLoading = weeklyPrize.isClaimLoading;
  const eligibilityDetails = DROPS_ENABLED ? weeklyPrize.eligibilityDetails : {};
  const userClaim = weeklyPrize.userClaim;

  const [showMainCanvas, setShowMainCanvas] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [claimedPrize, setClaimedPrize] = useState(null);
  const [showClaimButton, setShowClaimButton] = useState(false);

  // Determine if dial should be interactive
  const isDialDisabled = claimStatus !== 'available';

  // Handle zoom complete from CenteredCapsule
  const handleZoomComplete = useCallback((isComplete) => {
    setShowClaimButton(isComplete);
  }, []);

  // Handle toy click - this is when the user wants to claim the prize
  const handleToyClick = useCallback(async () => {
    if (claimStatus !== 'available' || isClaimLoading) {
      // Just reset if not available
      setResetKey(prev => prev + 1);
      return;
    }

    try {
      const claim = await claimPrize();
      setClaimedPrize({
        name: currentPrize.name,
        description: currentPrize.description,
        modelPath: currentPrize.modelPath,
        icon: currentPrize.previewConfig?.icon,
      });
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Failed to claim prize:', error);
      alert(error.message || 'Failed to claim prize. Please try again.');
    }

    setResetKey(prev => prev + 1);
  }, [claimStatus, isClaimLoading, claimPrize, currentPrize]);

  const handleSuccessModalClose = useCallback(() => {
    setShowSuccessModal(false);
    setClaimedPrize(null);
  }, []);

  // Handle sign in click
  const handleSignIn = useCallback(() => {
    // Dispatch event to open sign-in modal
    window.dispatchEvent(new CustomEvent('openSignIn'));
  }, []);

  // Handle connect wallet click
  const handleConnectWallet = useCallback(() => {
    // Dispatch event to open wallet connection
    window.dispatchEvent(new CustomEvent('openWalletConnection'));
  }, []);

  // Get model path from current prize or use default
  const modelPath = currentPrize?.modelPath || '/models/ipadMaryToy.glb';

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes claimButtonPulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 30px rgba(0, 245, 212, 0.5), 0 0 60px rgba(0, 245, 212, 0.3);
          }
          50% {
            transform: scale(1.02);
            box-shadow: 0 0 40px rgba(0, 245, 212, 0.7), 0 0 80px rgba(0, 245, 212, 0.4);
          }
        }
      `}</style>
      {/* Main vending machine canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        {showMainCanvas && (
          <Canvas
            shadows
            gl={{
              antialias: true,
              alpha: true,
            }}
            camera={{
              fov: 45,
              position: [0, 0.4, 2.1],
              near: 0.1,
              far: 500
            }}
            style={{
              width: '100%',
              height: '100%',
              background: 'transparent',
            }}
          >
            <Suspense fallback={null}>
              <VendingSceneInner
                onToyClick={handleToyClick}
                onZoomComplete={handleZoomComplete}
                resetKey={resetKey}
                capsuleColorIndex={0}
                modelPath={modelPath}
                disabled={isDialDisabled}
              />
            </Suspense>
          </Canvas>
        )}

        {/* Click to Claim button - shows after zoom completes */}
        {showClaimButton && claimStatus === 'available' && (
          <div style={{
            position: 'absolute',
            bottom: '20%',
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'auto',
            zIndex: 10,
          }}>
            <button
              onClick={handleToyClick}
              style={{
                padding: '1rem 2.5rem',
                background: 'linear-gradient(135deg, #00f5d4, #00bbf9)',
                border: 'none',
                borderRadius: '50px',
                color: '#000',
                fontFamily: "'Orbitron', monospace",
                fontSize: '1rem',
                fontWeight: '700',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                boxShadow: '0 0 30px rgba(0, 245, 212, 0.5), 0 0 60px rgba(0, 245, 212, 0.3)',
                animation: 'claimButtonPulse 2s ease-in-out infinite',
                transition: 'all 0.3s ease',
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'scale(1.05)';
                e.target.style.boxShadow = '0 0 40px rgba(0, 245, 212, 0.7), 0 0 80px rgba(0, 245, 212, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = '0 0 30px rgba(0, 245, 212, 0.5), 0 0 60px rgba(0, 245, 212, 0.3)';
              }}
            >
              Click to Claim
            </button>
          </div>
        )}

        {/* Disabled overlay when not available */}
        {isDialDisabled && claimStatus !== 'loading' && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            {claimStatus === 'claimed' && (
              <div style={{
                background: 'rgba(0, 255, 136, 0.1)',
                border: '1px solid rgba(0, 255, 136, 0.3)',
                borderRadius: '10px',
                padding: '1rem 2rem',
                color: '#00ff88',
                fontFamily: "'Orbitron', monospace",
                fontSize: '0.9rem',
                textAlign: 'center',
              }}>
                Prize Collected!
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prize status bar at bottom */}
      <PrizeStatusBar
        currentPrize={currentPrize}
        claimStatus={claimStatus}
        remainingClaims={remainingClaims}
        eligibilityDetails={eligibilityDetails}
        onSignIn={handleSignIn}
        onConnectWallet={handleConnectWallet}
      />

      {/* Success modal */}
      <ClaimSuccessModal
        isOpen={showSuccessModal}
        prize={claimedPrize}
        onClose={handleSuccessModalClose}
      />
    </div>
  );
}

// Preload the vending machine model
useGLTF.preload('/models/toyVENDnft.glb');
