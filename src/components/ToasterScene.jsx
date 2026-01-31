"use client";

import React, { useRef, Suspense, useEffect, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

// Toaster Model component with interactive lever
function ToasterModel({ scale = 2, position = [0, 0, 0], rotation = [0, 0, 0], controlsRef }) {
  const { scene } = useGLTF('/models/toaster.glb');
  const meshRef = useRef();
  const leverRef = useRef();
  const toast0Ref = useRef();
  const toast1Ref = useRef();

  // Store original Y positions and rotations
  const originalPositions = useRef({});
  const originalRotations = useRef({});

  // Use refs for drag state to avoid React render delays
  const isDraggingRef = useRef(false);
  const isLatchedRef = useRef(false); // Stays down like a real toaster
  const isPoppedRef = useRef({ toast0: false, toast1: false }); // Track each toast separately
  const toastTimer0Ref = useRef(null);
  const toastTimer1Ref = useRef(null);
  const dragStartY = useRef(0);
  const targetOffset = useRef(0); // For lever: 0 = up, 1 = down

  // Separate tracking for each toast
  const targetToast0Offset = useRef(0);
  const targetToast1Offset = useRef(0);
  const currentToast0Offset = useRef(0);
  const currentToast1Offset = useRef(0);
  const targetToast0Rotation = useRef(0);
  const targetToast1Rotation = useRef(0);
  const currentToast0Rotation = useRef(0);
  const currentToast1Rotation = useRef(0);

  const currentOffset = useRef(0);

  const { gl } = useThree();

  // Maximum travel distances (in model units) - lever has much higher Y so needs larger value
  const MAX_LEVER_TRAVEL = 150;
  const MAX_TOAST_TRAVEL = 0.8;
  const TOAST_POP_HEIGHT = 2.8; // How high toast pops above original position
  const TOAST_POP_ROTATION = 0.3; // Rotation in radians when popped
  const LATCH_THRESHOLD = 0.85; // Latch when dragged past 85%
  const TOAST_TIME = 5000; // 5 seconds until first toast pops
  const TOAST_STAGGER = 300; // Delay between toast pops in ms

  // Clone scene and find meshes
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);

    // Clone materials
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
      }
    });

    return clone;
  }, [scene]);

  // Find and store references to lever and toast meshes
  useEffect(() => {
    if (!clonedScene) return;

    console.log('=== Toaster mesh names ===');
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        console.log('Mesh:', child.name, 'Y:', child.position.y);
        if (child.name === 'LEVER') {
          leverRef.current = child;
          originalPositions.current.lever = child.position.y;
          console.log('Found LEVER at Y:', child.position.y);
        } else if (child.name === 'Toast0') {
          toast0Ref.current = child;
          originalPositions.current.toast0 = child.position.y;
          originalRotations.current.toast0 = child.rotation.z;
          console.log('Found Toast0 at Y:', child.position.y);
        } else if (child.name === 'Toast1') {
          toast1Ref.current = child;
          originalPositions.current.toast1 = child.position.y;
          originalRotations.current.toast1 = child.rotation.z;
          console.log('Found Toast1 at Y:', child.position.y);
        }
      }
    });
    console.log('Original positions:', originalPositions.current);
  }, [clonedScene]);

  // Pointer move handler - stores drag progress as 0-1
  const handlePointerMove = useCallback((e) => {
    if (!isDraggingRef.current) return;

    const dragDelta = e.clientY - dragStartY.current;
    // Store as normalized progress (0-1)
    const progress = Math.max(0, Math.min(1, dragDelta * 0.005));
    targetOffset.current = progress;
    // Both toasts go down together while dragging
    targetToast0Offset.current = progress * MAX_TOAST_TRAVEL;
    targetToast1Offset.current = progress * MAX_TOAST_TRAVEL;
  }, []);

  // Pop toast 0
  const popToast0 = useCallback(() => {
    console.log('Toast 0 - POP!');
    isPoppedRef.current.toast0 = true;
    targetToast0Offset.current = -TOAST_POP_HEIGHT;
    targetToast0Rotation.current = -TOAST_POP_ROTATION; // Tilt one way
  }, []);

  // Pop toast 1
  const popToast1 = useCallback(() => {
    console.log('Toast 1 - POP!');
    isPoppedRef.current.toast1 = true;
    isLatchedRef.current = false; // Release latch after both have popped
    targetOffset.current = 0; // Lever springs back up
    targetToast1Offset.current = -TOAST_POP_HEIGHT * 0.9; // Slightly different height
    targetToast1Rotation.current = TOAST_POP_ROTATION * 0.8; // Tilt the other way, slightly less
  }, []);

  // Pointer up handler
  const handlePointerUp = useCallback(() => {
    if (!isDraggingRef.current) return;

    isDraggingRef.current = false;
    gl.domElement.style.cursor = 'auto';

    // Check if dragged far enough to latch
    if (targetOffset.current >= LATCH_THRESHOLD) {
      isLatchedRef.current = true;
      isPoppedRef.current = { toast0: false, toast1: false };
      targetOffset.current = 1; // Snap to fully down
      targetToast0Offset.current = MAX_TOAST_TRAVEL;
      targetToast1Offset.current = MAX_TOAST_TRAVEL;
      console.log('Toaster latched! Toast will be ready in 5 seconds...');

      // Start the toast timers with staggered timing
      if (toastTimer0Ref.current) clearTimeout(toastTimer0Ref.current);
      if (toastTimer1Ref.current) clearTimeout(toastTimer1Ref.current);

      toastTimer0Ref.current = setTimeout(popToast0, TOAST_TIME);
      toastTimer1Ref.current = setTimeout(popToast1, TOAST_TIME + TOAST_STAGGER);
    } else {
      // Spring back up
      targetOffset.current = 0;
      targetToast0Offset.current = 0;
      targetToast1Offset.current = 0;
    }

    // Re-enable OrbitControls
    if (controlsRef?.current) {
      controlsRef.current.enabled = true;
    }

    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  }, [gl, controlsRef, handlePointerMove, popToast0, popToast1]);

  // Handle pointer down on lever
  const handlePointerDown = useCallback((e) => {
    console.log('Pointer down on:', e.object.name);

    if (e.object.name === 'LEVER') {
      e.stopPropagation();

      // If latched, release on click (cancel timers)
      if (isLatchedRef.current) {
        isLatchedRef.current = false;
        if (toastTimer0Ref.current) {
          clearTimeout(toastTimer0Ref.current);
          toastTimer0Ref.current = null;
        }
        if (toastTimer1Ref.current) {
          clearTimeout(toastTimer1Ref.current);
          toastTimer1Ref.current = null;
        }
        targetOffset.current = 0; // Spring back up
        targetToast0Offset.current = 0;
        targetToast1Offset.current = 0;
        targetToast0Rotation.current = 0;
        targetToast1Rotation.current = 0;
        console.log('Toaster released early!');
        return;
      }

      // Reset popped state and rotations when starting new drag
      isPoppedRef.current = { toast0: false, toast1: false };
      targetToast0Offset.current = 0;
      targetToast1Offset.current = 0;
      targetToast0Rotation.current = 0;
      targetToast1Rotation.current = 0;

      // Disable OrbitControls IMMEDIATELY via ref
      if (controlsRef?.current) {
        controlsRef.current.enabled = false;
      }

      isDraggingRef.current = true;

      // Get clientY from the native event
      const clientY = e.nativeEvent?.clientY ?? 0;
      dragStartY.current = clientY;
      console.log('Started dragging lever, startY:', clientY);

      gl.domElement.style.cursor = 'grabbing';

      // Attach listeners immediately
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
  }, [gl, controlsRef, handlePointerMove, handlePointerUp]);

  // Animate lever and toast positions every frame
  useFrame(() => {
    // Smooth interpolation towards targets
    const lerpSpeed = isDraggingRef.current ? 0.3 : 0.15;
    const popLerpSpeed = 0.05; // For the pop animation

    // Lever interpolation
    currentOffset.current = THREE.MathUtils.lerp(currentOffset.current, targetOffset.current, lerpSpeed);

    // Toast 0 interpolation
    const toast0LerpSpeed = isPoppedRef.current.toast0 ? popLerpSpeed : lerpSpeed;
    currentToast0Offset.current = THREE.MathUtils.lerp(currentToast0Offset.current, targetToast0Offset.current, toast0LerpSpeed);
    currentToast0Rotation.current = THREE.MathUtils.lerp(currentToast0Rotation.current, targetToast0Rotation.current, toast0LerpSpeed);

    // Toast 1 interpolation
    const toast1LerpSpeed = isPoppedRef.current.toast1 ? popLerpSpeed : lerpSpeed;
    currentToast1Offset.current = THREE.MathUtils.lerp(currentToast1Offset.current, targetToast1Offset.current, toast1LerpSpeed);
    currentToast1Rotation.current = THREE.MathUtils.lerp(currentToast1Rotation.current, targetToast1Rotation.current, toast1LerpSpeed);

    const leverProgress = currentOffset.current;

    // Apply lever offset
    if (leverRef.current && originalPositions.current.lever !== undefined) {
      leverRef.current.position.y = originalPositions.current.lever - (leverProgress * MAX_LEVER_TRAVEL);
    }

    // Apply toast 0 offset and rotation
    if (toast0Ref.current && originalPositions.current.toast0 !== undefined) {
      toast0Ref.current.position.y = originalPositions.current.toast0 - currentToast0Offset.current;
      toast0Ref.current.rotation.z = (originalRotations.current.toast0 || 0) + currentToast0Rotation.current;
    }

    // Apply toast 1 offset and rotation
    if (toast1Ref.current && originalPositions.current.toast1 !== undefined) {
      toast1Ref.current.position.y = originalPositions.current.toast1 - currentToast1Offset.current;
      toast1Ref.current.rotation.z = (originalRotations.current.toast1 || 0) + currentToast1Rotation.current;
    }
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      if (toastTimer0Ref.current) clearTimeout(toastTimer0Ref.current);
      if (toastTimer1Ref.current) clearTimeout(toastTimer1Ref.current);
    };
  }, [handlePointerMove, handlePointerUp]);

  return (
    <primitive
      ref={meshRef}
      object={clonedScene}
      scale={scale}
      position={position}
      rotation={rotation}
      onPointerDown={handlePointerDown}
      onPointerOver={(e) => {
        if (e.object.name === 'LEVER') {
          gl.domElement.style.cursor = 'grab';
        }
      }}
      onPointerOut={() => {
        if (!isDraggingRef.current) {
          gl.domElement.style.cursor = 'auto';
        }
      }}
    />
  );
}

// Inner scene component to access OrbitControls ref
function ToasterSceneInner() {
  const controlsRef = useRef();

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <pointLight position={[-3, 2, 2]} color="#ffffff" intensity={0.5} />

      <ToasterModel
        scale={0.1}
        position={[0, 0, 0]}
        controlsRef={controlsRef}
      />

      <OrbitControls
        ref={controlsRef}
        enablePan={true}
        enableZoom={true}
        minDistance={1}
        maxDistance={10}
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
export default function ToasterScene() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
        }}
        camera={{
          fov: 45,
          position: [0, 0.5, 3],
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
          <ToasterSceneInner />
        </Suspense>
      </Canvas>
    </div>
  );
}

// Preload the model
useGLTF.preload('/models/toaster.glb');
