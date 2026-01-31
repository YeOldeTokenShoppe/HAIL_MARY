"use client";

import React, { useRef, Suspense, useEffect, useMemo, useCallback, useState } from "react";
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls, useAnimations } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import InteractiveScroll2 from './InteractiveScroll2';
import ToyPreviewPortal, { TOY_PREVIEW_CONFIG } from './ToyPreviewPortal';

// Toy names in order of appearance
const TOY_NAMES = ['Scroll', 'BurningHeart', 'Coin', 'TATTOO', 'Unicorn', 'Painting', 'ToyMary'];

// Icons for each toy in collection bar (no icon for ToyMary)
// Can be emoji strings or image paths starting with '/'
const TOY_ICONS = {
  'Scroll': '📜',
  'BurningHeart': '/images/sacreCoeur.webp',
  'Coin': '/images/COIN_TATTOO.webp',
  'TATTOO': '/images/ILLUMIN80_TATTOO.webp',
  'Unicorn': '💬',
  'Painting': '🖼️'
};

// Centered capsule model that appears when capsule is clicked
function CenteredCapsule({ visible, onScrollClick, toyIndex = 0, capsuleColorIndex = 0 }) {
  const { scene } = useGLTF('/models/scrollAndMaryToys.glb');
  const { camera } = useThree();
  const groupRef = useRef();
  const glassRef = useRef();
  const baseRef = useRef();
  const toyRefs = useRef({}); // Store refs for all toys by name
  const [isOpening, setIsOpening] = useState(false);
  const [isZooming, setIsZooming] = useState(false);

  const initialPositions = useRef({ glass: null, base: null, toys: {} });
  const initialCameraPos = useRef(null);
  const zoomTarget = useRef(new THREE.Vector3(0, 0.3, 0.8)); // Close to the toy
  const currentToyName = TOY_NAMES[toyIndex % TOY_NAMES.length];

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
      // Reset camera position if we stored it
      if (initialCameraPos.current && camera) {
        camera.position.copy(initialCameraPos.current);
      }
      initialCameraPos.current = null;
    }
  }, [visible, camera]);

  // Find capsule parts in this model and set visibility
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
          // Apply cycling color to capsule base
          const colorIndex = capsuleColorIndex % CAPSULE_COLORS.length;
          if (child.material) {
            child.material.color.set(CAPSULE_COLORS[colorIndex]);
          }
        }
        // Find all toys by name and set initial visibility
        if (TOY_NAMES.includes(child.name)) {
          toyRefs.current[child.name] = child;
          if (!initialPositions.current.toys[child.name]) {
            initialPositions.current.toys[child.name] = child.position.y;
          }
          // Set visibility - only show current toy
          child.visible = (child.name === currentToyName);
        }
      });
      // Start opening after a short delay
      setTimeout(() => setIsOpening(true), 300);
    }
  }, [visible, capsuleColorIndex, currentToyName]);

  // Update toy visibility when toyIndex changes (for when viewing collected items)
  useEffect(() => {
    if (visible) {
      TOY_NAMES.forEach((name) => {
        const toyRef = toyRefs.current[name];
        if (toyRef) {
          toyRef.visible = (name === currentToyName);
        }
      });
    }
  }, [toyIndex, visible, currentToyName]);

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

    // Floating animation for the active toy
    const activeToy = toyRefs.current[currentToyName];
    const initialY = initialPositions.current.toys[currentToyName];
    if (activeToy && initialY !== undefined) {
      activeToy.position.y = initialY + Math.sin(state.clock.elapsedTime * 0.5) * 0.05;
      // Only rotate the Scroll
      if (currentToyName === 'Scroll') {
        activeToy.rotation.y += 0.003;
      }
    }

    // Camera zoom animation when toy is clicked
    if (isZooming && camera) {
      const target = zoomTarget.current;
      camera.position.lerp(target, 0.08);

      // Check if close enough to target
      const dist = camera.position.distanceTo(target);
      if (dist < 0.05) {
        setIsZooming(false);
        // Delay opening the modal for a couple seconds
        setTimeout(() => {
          if (onScrollClick) onScrollClick();
        }, 2000);
      }
    }
  });

  // Check if clicked object is the active toy
  const isToyObject = useCallback((obj) => {
    const activeToy = toyRefs.current[currentToyName];
    return obj === activeToy ||
           obj.name === currentToyName ||
           (obj.parent && obj.parent.name === currentToyName);
  }, [currentToyName]);

  const handleClick = useCallback((e) => {
    if (isToyObject(e.object) && !isZooming) {
      e.stopPropagation();
      // Store initial camera position and start zoom
      if (!initialCameraPos.current) {
        initialCameraPos.current = camera.position.clone();
      }
      setIsZooming(true);
    }
  }, [isToyObject, isZooming, camera]);

  if (!visible) return null;

  return (
    <group
      ref={groupRef}
      position={[0, 0.2, 0.5]}
      onClick={handleClick}
      onPointerOver={(e) => {
        if (isToyObject(e.object)) {
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      <primitive object={clonedScene} scale={0.3} />
    </group>
  );
}

// Capsule base colors that cycle
const CAPSULE_COLORS = ['#3943BC', '#14A122', '#A81814'];

// Vending Machine component with interactive dial
function VendingMachine({ scale = 1, position = [0, 0, 0], rotation = [0, 0, 0], controlsRef, onDialComplete, onCapsuleClick, resetKey = 0, toyIndex = 0, capsuleColorIndex = 0 }) {
  const { scene, animations } = useGLTF('/models/toyVEND.glb');
  const groupRef = useRef();
  const { actions } = useAnimations(animations, groupRef);
  const dialRef = useRef();
  const capsuleGlassRef = useRef();
  const capsuleBaseRef = useRef();
  const toyRefs = useRef({}); // Store refs for all toys
  const currentToyName = TOY_NAMES[toyIndex % TOY_NAMES.length];

  const [isDragging, setIsDragging] = useState(false);
  const [capsuleVisible, setCapsuleVisible] = useState(false);
  const [capsuleClicked, setCapsuleClicked] = useState(false);
  const [capsuleDropping, setCapsuleDropping] = useState(false);

  const dragStartRef = useRef({ x: 0, rotation: 0 });
  const targetRotation = useRef(0);
  const clankSoundRef = useRef(null);

  // Capsule drop animation state
  const capsuleAnimState = useRef({
    dropHeight: 0.3,    // How high above target to start
    currentOffset: 0,   // Current Y offset from target (0 = landed)
    velocity: 0,
    rotation: 0,
    rotationVelocity: 0,
    bounceCount: 0,
    settled: false,
    // Store initial positions for each part
    initialPositions: {
      glass: null,
      base: null,
      toys: {} // Store positions for all toys
    }
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
    // Reset dial rotation
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

  // Find objects after the scene is mounted - this ensures we get the actual rendered objects
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.traverse((child) => {
        // Find the dial
        if (child.name === 'DIAL') {
          dialRef.current = child;
        }

        // Find and hide capsule parts
        if (child.name === 'CapsuleGlassA') {
          capsuleGlassRef.current = child;
          child.visible = false;
        }
        if (child.name === 'CapsuleBaseA') {
          capsuleBaseRef.current = child;
          child.visible = false;
        }
        // Find and hide all toys
        if (TOY_NAMES.includes(child.name)) {
          toyRefs.current[child.name] = child;
          child.visible = false;
        }
      });
    }
  }, [clonedScene]);

  // Update capsule and toy visibility when state changes
  // Hide when capsule is clicked (transferring to centered model)
  useEffect(() => {
    const shouldShow = capsuleVisible && !capsuleClicked;

    if (shouldShow && capsuleGlassRef.current && !capsuleDropping) {
      // Store initial positions for all parts
      const anim = capsuleAnimState.current;
      anim.initialPositions.glass = capsuleGlassRef.current.position.y;
      if (capsuleBaseRef.current) anim.initialPositions.base = capsuleBaseRef.current.position.y;
      // Store initial positions for all toys
      TOY_NAMES.forEach((name) => {
        const toy = toyRefs.current[name];
        if (toy) anim.initialPositions.toys[name] = toy.position.y;
      });

      // Reset animation state
      anim.currentOffset = anim.dropHeight; // Start at dropHeight above target
      anim.velocity = 0;
      anim.rotation = 0;
      anim.rotationVelocity = (Math.random() - 0.5) * 0.3;
      anim.bounceCount = 0;
      anim.settled = false;

      // Immediately position capsule shell at elevated starting position
      // (Toys may be children in hierarchy, so don't move them separately)
      const startOffset = anim.dropHeight;
      capsuleGlassRef.current.position.y = anim.initialPositions.glass + startOffset;
      if (capsuleBaseRef.current) capsuleBaseRef.current.position.y = anim.initialPositions.base + startOffset;

      // Show all parts (now already at elevated position)
      capsuleGlassRef.current.visible = true;
      if (capsuleBaseRef.current) {
        capsuleBaseRef.current.visible = true;
        // Apply cycling color to capsule base
        const colorIndex = capsuleColorIndex % CAPSULE_COLORS.length;
        if (capsuleBaseRef.current.material) {
          capsuleBaseRef.current.material.color.set(CAPSULE_COLORS[colorIndex]);
        }
      }
      // Show only the current toy
      TOY_NAMES.forEach((name) => {
        const toy = toyRefs.current[name];
        if (toy) toy.visible = (name === currentToyName);
      });

      setCapsuleDropping(true);
    } else if (!shouldShow) {
      // Hide everything and reset positions
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
      // Hide all toys and reset positions
      TOY_NAMES.forEach((name) => {
        const toy = toyRefs.current[name];
        if (toy) {
          toy.visible = false;
          if (anim.initialPositions.toys[name] !== undefined) {
            toy.position.y = anim.initialPositions.toys[name];
            toy.rotation.z = 0;
          }
        }
      });
    }
  }, [capsuleVisible, capsuleClicked, toyIndex, currentToyName, capsuleDropping, capsuleColorIndex]);

  // Track current rotation amount
  const currentRotationAmount = useRef(0);

  // Axis for rotation - world X axis works for this dial
  const rotationAxis = useMemo(() => new THREE.Vector3(1, 0, 0), []);

  // Smooth dial rotation animation - using world axis
  useFrame(() => {
    // Dial animation
    if (dialRef.current) {
      const diff = targetRotation.current - currentRotationAmount.current;

      if (Math.abs(diff) > 0.001) {
        const delta = diff * 0.08;
        currentRotationAmount.current += delta;

        // Rotate on world axis
        dialRef.current.rotateOnWorldAxis(rotationAxis, delta);
      }

      // Check if dial has completed 90 degree turn - show capsules and snap back
      if (Math.abs(currentRotationAmount.current) >= Math.PI / 2 - 0.05 && targetRotation.current !== 0) {
        if (!capsuleVisible) {
          setCapsuleVisible(true);
          if (onDialComplete) onDialComplete();
        }
        // Always snap back after reaching 90 degrees
        targetRotation.current = 0;
      }
    }

    // Capsule drop animation
    if (capsuleDropping && !capsuleAnimState.current.settled) {
      const anim = capsuleAnimState.current;
      const gravity = 0.0015;
      const bounceDamping = 0.4;
      const rotationDamping = 0.85;

      // Apply gravity - currentOffset starts at dropHeight and goes to 0
      anim.velocity += gravity;
      anim.currentOffset -= anim.velocity;

      // Apply rotation tumble
      anim.rotation += anim.rotationVelocity;
      anim.rotationVelocity *= rotationDamping;

      // Check for ground collision (offset reaches 0)
      if (anim.currentOffset <= 0) {
        anim.currentOffset = 0;
        anim.bounceCount++;

        if (anim.bounceCount < 3 && Math.abs(anim.velocity) > 0.005) {
          // Bounce!
          anim.velocity = -anim.velocity * bounceDamping;
          anim.rotationVelocity = (Math.random() - 0.5) * 0.1;
        } else {
          // Settled
          anim.velocity = 0;
          anim.rotation = 0;
          anim.currentOffset = 0;
          anim.settled = true;
        }
      }

      // Apply the SAME offset to ALL parts (keeps capsule together)
      const offset = anim.currentOffset;

      // Only move the capsule shell - Scroll/ToyMary follow as children in hierarchy
      if (capsuleGlassRef.current && anim.initialPositions.glass !== null) {
        capsuleGlassRef.current.position.y = anim.initialPositions.glass + offset;
      }
      if (capsuleBaseRef.current && anim.initialPositions.base !== null) {
        capsuleBaseRef.current.position.y = anim.initialPositions.base + offset;
      }
    }
  });

  // Check if clicked object is the capsule or a toy inside it
  const isCapsuleObject = useCallback((obj) => {
    // Check capsule parts
    if (obj.name === 'CapsuleGlassA' || obj.name === 'CapsuleBaseA' ||
        obj === capsuleGlassRef.current || obj === capsuleBaseRef.current) {
      return true;
    }
    // Check if it's a toy inside the capsule
    if (TOY_NAMES.includes(obj.name) || toyRefs.current[obj.name]) {
      return true;
    }
    // Check if it's a child of a toy
    if (obj.parent && (TOY_NAMES.includes(obj.parent.name) || toyRefs.current[obj.parent.name])) {
      return true;
    }
    return false;
  }, []);

  // Handle capsule click - hide vending machine capsule and show centered one
  const handleCapsuleClick = useCallback(() => {
    if (!capsuleClicked && capsuleVisible) {
      setCapsuleClicked(true);
      if (onCapsuleClick) onCapsuleClick();
    }
  }, [capsuleClicked, capsuleVisible, onCapsuleClick]);

  // Helper to check if object is descendant of parent
  const isDescendant = useCallback((obj, parent) => {
    let current = obj.parent;
    while (current) {
      if (current === parent) return true;
      current = current.parent;
    }
    return false;
  }, []);

  // Check if clicked object is the dial or part of it
  const isDialObject = useCallback((obj) => {
    if (!dialRef.current) return false;
    return obj === dialRef.current ||
           obj.parent === dialRef.current ||
           isDescendant(obj, dialRef.current) ||
           obj.name === 'DIAL' ||
           (obj.parent && obj.parent.name === 'DIAL');
  }, [isDescendant]);

  // Handle pointer down on the dial
  const handlePointerDown = useCallback((e) => {
    if (isDialObject(e.object)) {
      e.stopPropagation();
      setIsDragging(true);
      // Play clank sound when starting to drag
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
  }, [controlsRef, isDialObject]);

  const handlePointerMove = useCallback((e) => {
    if (isDragging && dialRef.current) {
      e.stopPropagation();
      const deltaX = e.point.x - dragStartRef.current.x;
      // Map horizontal drag to rotation (negative for clockwise)
      let newRotation = dragStartRef.current.rotation - deltaX * 2;
      // Clamp rotation between 0 and -90 degrees
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
      // Snap to 90 degrees if past halfway, otherwise spring back
      if (targetRotation.current < -Math.PI / 4) {
        targetRotation.current = -Math.PI / 2;
      } else {
        // Spring back smoothly (the useFrame will animate it back)
        targetRotation.current = 0;
      }
    }
  }, [isDragging, controlsRef]);

  // Handle click to turn dial or open capsule
  const handleClick = useCallback((e) => {
    if (isDialObject(e.object)) {
      e.stopPropagation();
      // Play clank sound
      if (clankSoundRef.current) {
        clankSoundRef.current.currentTime = 0;
        clankSoundRef.current.play().catch(() => {});
      }
      // Turn dial 90 degrees on click
      targetRotation.current = -Math.PI / 2;
    } else if (isCapsuleObject(e.object)) {
      e.stopPropagation();
      handleCapsuleClick();
    }
  }, [isDialObject, isCapsuleObject, handleCapsuleClick]);

  // Make all meshes in the scene raycastable
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
        if (isDialObject(e.object) || isCapsuleObject(e.object)) {
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

// 2D Collection bar at bottom (no WebGL to avoid context limits)
function CollectionBar({ items, onItemClick }) {
  if (items.length === 0) return null;

  return (
    <div style={{
      height: '80px',
      width: '100%',
      background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '12px',
      padding: '10px',
      boxSizing: 'border-box',
    }}>
      {items.map((item, index) => {
        const baseColor = CAPSULE_COLORS[item.colorIndex % CAPSULE_COLORS.length];
        const icon = TOY_ICONS[item.toyName] || '🎁';
        const isImage = icon.startsWith('/');
        return (
          <button
            key={item.id}
            onClick={() => onItemClick(item)}
            style={{
              width: '55px',
              height: '55px',
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.3)',
              background: baseColor,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              animation: `pulse 2s ease-in-out ${index * 0.2}s infinite`,
              boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
              padding: isImage ? '8px' : 0,
            }}
          >
            {isImage ? (
              <img
                src={icon}
                alt={item.toyName}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: '50%',
                }}
              />
            ) : icon}
          </button>
        );
      })}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}

// Inner scene component to access OrbitControls ref
function VendingSceneInner({ onScrollClick, resetKey, toyIndex, capsuleColorIndex }) {
  const controlsRef = useRef();
  const [showCenteredCapsule, setShowCenteredCapsule] = useState(false);

  // Reset centered capsule when resetKey changes
  useEffect(() => {
    setShowCenteredCapsule(false);
  }, [resetKey]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[-3, 2, 2]} color="#ffffff" intensity={0.5} />

      <VendingMachine
        scale={0.3}
        position={[0, -0.65, 0]}
        controlsRef={controlsRef}
        onCapsuleClick={() => setShowCenteredCapsule(true)}
        resetKey={resetKey}
        toyIndex={toyIndex}
        capsuleColorIndex={capsuleColorIndex}
      />

      <CenteredCapsule
        visible={showCenteredCapsule}
        onScrollClick={onScrollClick}
        toyIndex={toyIndex}
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

// LocalStorage key for persistence
const STORAGE_KEY = 'vendingMachine_collected';

// Main exported component
export default function VendingMachineScene() {
  const [showScroll, setShowScroll] = useState(false);
  const [showPortalPreview, setShowPortalPreview] = useState(false);
  const [currentPreviewToy, setCurrentPreviewToy] = useState(null);
  const [showMainCanvas, setShowMainCanvas] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [toyIndex, setToyIndex] = useState(0);
  const [collectedItems, setCollectedItems] = useState([]);
  const [viewingCollectedItem, setViewingCollectedItem] = useState(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load collected items from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.collectedItems && Array.isArray(parsed.collectedItems)) {
          setCollectedItems(parsed.collectedItems);
          // Set toyIndex to continue from where they left off
          // Find the next toy that hasn't been collected yet
          const collectedNames = parsed.collectedItems.map(item => item.toyName);
          let nextIndex = 0;
          for (let i = 0; i < TOY_NAMES.length; i++) {
            const toyName = TOY_NAMES[i];
            if (!collectedNames.includes(toyName) && toyName !== 'ToyMary') {
              nextIndex = i;
              break;
            }
            // If all toys collected, cycle back
            if (i === TOY_NAMES.length - 1) {
              nextIndex = TOY_NAMES.length;
            }
          }
          setToyIndex(nextIndex);
        }
      }
    } catch (e) {
      console.error('Failed to load from localStorage:', e);
    }
    setIsHydrated(true);
  }, []);

  // Save collected items to localStorage whenever they change
  useEffect(() => {
    if (isHydrated && collectedItems.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          collectedItems,
          savedAt: Date.now()
        }));
      } catch (e) {
        console.error('Failed to save to localStorage:', e);
      }
    }
  }, [collectedItems, isHydrated]);

  // Check if the current toy has a portal preview config
  const hasPortalPreview = (toyName) => {
    return toyName !== 'Scroll' && toyName !== 'ToyMary' && TOY_PREVIEW_CONFIG[toyName];
  };

  // Open the appropriate overlay based on toy type
  const handleOpenOverlay = useCallback(() => {
    const toyName = TOY_NAMES[toyIndex % TOY_NAMES.length];

    if (toyName === 'Scroll') {
      // Scroll uses the InteractiveScroll2 overlay
      setShowMainCanvas(false);
      setTimeout(() => {
        setShowScroll(true);
      }, 50);
    } else if (hasPortalPreview(toyName)) {
      // Other toys use the portal preview (no need to unmount canvas - it's CSS-based)
      setCurrentPreviewToy(toyName);
      setShowPortalPreview(true);
    }
  }, [toyIndex]);

  // Handle scroll overlay close - reset machine, add to collection, and advance to next toy
  const handleScrollClose = useCallback(() => {
    // Only add if not viewing a collected item (i.e., it's a new item from the machine)
    if (!viewingCollectedItem) {
      setCollectedItems(prev => {
        const currentToyName = TOY_NAMES[toyIndex % TOY_NAMES.length];

        // Don't add ToyMary to collection, and don't add duplicates
        if (currentToyName === 'ToyMary' || prev.some(item => item.toyName === currentToyName)) {
          return prev;
        }

        const newItem = {
          id: Date.now(),
          toyName: currentToyName,
          colorIndex: prev.length // Store the color index at time of collection
        };
        return [...prev, newItem];
      });
    }

    // Close overlay first, then remount main canvas after delay
    setShowScroll(false);
    setViewingCollectedItem(null);
    setTimeout(() => {
      setShowMainCanvas(true);
      setResetKey(prev => prev + 1); // Trigger reset
      setToyIndex(prev => prev + 1); // Advance to next toy
    }, 50);
  }, [toyIndex, viewingCollectedItem]);

  // Handle portal preview close
  const handlePortalClose = useCallback(() => {
    // Add to collection if not viewing collected item
    if (!viewingCollectedItem && currentPreviewToy) {
      setCollectedItems(prev => {
        // Don't add duplicates
        if (prev.some(item => item.toyName === currentPreviewToy)) {
          return prev;
        }

        const newItem = {
          id: Date.now(),
          toyName: currentPreviewToy,
          colorIndex: prev.length
        };
        return [...prev, newItem];
      });
    }

    setShowPortalPreview(false);
    setCurrentPreviewToy(null);
    setViewingCollectedItem(null);
    setResetKey(prev => prev + 1);
    setToyIndex(prev => prev + 1);
  }, [currentPreviewToy, viewingCollectedItem]);

  // Handle clicking a collected item to view it again
  const handleCollectedItemClick = useCallback((item) => {
    setViewingCollectedItem(item);

    if (item.toyName === 'Scroll') {
      setShowMainCanvas(false);
      setTimeout(() => {
        setShowScroll(true);
      }, 50);
    } else if (hasPortalPreview(item.toyName)) {
      setCurrentPreviewToy(item.toyName);
      setShowPortalPreview(true);
    }
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {/* Main vending machine canvas - unmount when overlay is shown to avoid WebGL context conflict */}
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
                onScrollClick={handleOpenOverlay}
                resetKey={resetKey}
                toyIndex={toyIndex}
                capsuleColorIndex={collectedItems.length}
              />
            </Suspense>
          </Canvas>
        )}
      </div>

      {/* Collection bar at bottom */}
      <CollectionBar
        items={collectedItems}
        onItemClick={handleCollectedItemClick}
      />

      {/* Scroll overlay - for Scroll toy only */}
      {showScroll && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 100,
          }}
        >
          <InteractiveScroll2 onClose={handleScrollClose} />
        </div>
      )}

      {/* Portal preview - for other toys */}
      <ToyPreviewPortal
        toyName={currentPreviewToy}
        isOpen={showPortalPreview}
        onClose={handlePortalClose}
      />
    </div>
  );
}

// Preload the models
useGLTF.preload('/models/toyVEND.glb');
useGLTF.preload('/models/scrollAndMaryToys.glb');
