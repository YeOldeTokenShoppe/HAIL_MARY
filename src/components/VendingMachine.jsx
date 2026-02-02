"use client";

import React, { useRef, Suspense, useEffect, useMemo, useCallback, useState } from "react";
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, useAnimations } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import InteractiveScroll2 from './InteractiveScroll2';
import ToyPreviewPortal, { TOY_PREVIEW_CONFIG } from './ToyPreviewPortal';
import { useWeeklyPrize } from '@/hooks/useWeeklyPrize';
import { useWalletAuth } from './WalletAuthProvider';
import { useUser } from '@clerk/nextjs';

// Capsule base colors that cycle
const CAPSULE_COLORS = ['#3943BC', '#14A122', '#A81814'];

// Centered capsule model that appears when capsule is clicked
function CenteredCapsule({ visible, onToyClick, modelPath, capsuleColorIndex = 0 }) {
  const { scene } = useGLTF(modelPath || '/models/ipadMaryToy.glb');
  const { camera } = useThree();
  const groupRef = useRef();
  const glassRef = useRef();
  const baseRef = useRef();
  const toyRef = useRef();
  const [isOpening, setIsOpening] = useState(false);
  const [isZooming, setIsZooming] = useState(false);

  const initialPositions = useRef({ glass: null, base: null, toy: null });
  const initialCameraPos = useRef(null);
  const zoomTarget = useRef(new THREE.Vector3(0, 0.3, 0.8));

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
      if (initialCameraPos.current && camera) {
        camera.position.copy(initialCameraPos.current);
      }
      initialCameraPos.current = null;
    }
  }, [visible, camera]);

  // Find capsule parts and toy
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
      setTimeout(() => setIsOpening(true), 300);
    }
  }, [visible, capsuleColorIndex]);

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

    // Camera zoom animation when toy is clicked
    if (isZooming && camera) {
      const target = zoomTarget.current;
      camera.position.lerp(target, 0.08);

      const dist = camera.position.distanceTo(target);
      if (dist < 0.05) {
        setIsZooming(false);
        setTimeout(() => {
          if (onToyClick) onToyClick();
        }, 2000);
      }
    }
  });

  const handleClick = useCallback((e) => {
    if (!isZooming) {
      e.stopPropagation();
      if (!initialCameraPos.current) {
        initialCameraPos.current = camera.position.clone();
      }
      setIsZooming(true);
    }
  }, [isZooming, camera]);

  if (!visible) return null;

  return (
    <group
      ref={groupRef}
      position={[0, 0.2, 0.5]}
      onClick={handleClick}
      onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
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
      }
    });
    return clone;
  }, [scene]);

  // Find objects after the scene is mounted
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.traverse((child) => {
        if (child.name === 'DIAL') {
          dialRef.current = child;
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
  useFrame(() => {
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
        return { text: 'Check back for next weekly prize', color: 'rgba(255, 255, 255, 0.5)' };
      case 'available':
        return { text: `${remainingClaims} of ${currentPrize?.maxClaims || 100} remaining`, color: '#00f5d4' };
      case 'claimed':
        return { text: "You collected this week's prize!", color: '#00ff88' };
      case 'sold_out':
        return { text: 'All 100 prizes claimed!', color: '#ff6b6b' };
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
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
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

// Inner scene component to access OrbitControls ref
function VendingSceneInner({ onToyClick, resetKey, capsuleColorIndex, modelPath, disabled }) {
  const controlsRef = useRef();
  const [showCenteredCapsule, setShowCenteredCapsule] = useState(false);

  useEffect(() => {
    setShowCenteredCapsule(false);
  }, [resetKey]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      {/* <pointLight position={[-3, 2, 2]} color="#ffffff" intensity={0.5} /> */}

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
  const {
    currentPrize,
    claimStatus,
    remainingClaims,
    claimPrize,
    isClaimLoading,
    isEligible,
    eligibilityDetails,
    userClaim
  } = useWeeklyPrize();

  const [showMainCanvas, setShowMainCanvas] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [claimedPrize, setClaimedPrize] = useState(null);

  // Determine if dial should be interactive
  const isDialDisabled = claimStatus !== 'available';

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
      {/* Main vending machine canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        {showMainCanvas && (
          <Canvas
            gl={{
              antialias: true,
              alpha: true,
            }}
            camera={{
              fov: 45,
              position: [0, 0.6, 2.5],
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
                resetKey={resetKey}
                capsuleColorIndex={0}
                modelPath={modelPath}
                disabled={isDialDisabled}
              />
            </Suspense>
          </Canvas>
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
