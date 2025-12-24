import { useState, useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import AnnotationMarker from '@/components/AnnotationMarker';

function AnnotationSystem({ annotations = [], is80sMode = false, scale = 1, textScale = null, showFloatingViewer = false, onAnnotationClick = null }) {
  const { camera, controls, gl } = useThree();
  const [activeAnnotation, setActiveAnnotation] = useState(null);
  const targetPosition = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());
  const isAnimating = useRef(false);
  const animationProgress = useRef(0);
  const startCameraPosition = useRef(new THREE.Vector3());
  const startControlsTarget = useRef(new THREE.Vector3());
  
  // Store original camera position for reset
  const originalCameraPosition = useRef(new THREE.Vector3());
  const originalControlsTarget = useRef(new THREE.Vector3());
  const originalAutoRotate = useRef(false);
  const hasStoredOriginal = useRef(false);
  
  // Store original camera position on mount, with a small delay to ensure controls are initialized
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasStoredOriginal.current && camera && controls) {
        // Store the initial camera position and target
        originalCameraPosition.current.copy(camera.position);
        originalControlsTarget.current.copy(controls.target);
        originalAutoRotate.current = controls.autoRotate;
        hasStoredOriginal.current = true;
        
        // console.log('Stored original camera position:', camera.position.toArray());
        // console.log('Stored original target:', controls.target.toArray());
        
        // Ensure camera near plane is set properly
        if (camera.near > 0.1) {
          camera.near = 0.1;
          camera.updateProjectionMatrix();
        }
      }
    }, 100); // Small delay to ensure controls are fully initialized
    
    return () => clearTimeout(timer);
  }, [camera, controls]);
  
  const handleFocus = (position, index) => {
    
    if (activeAnnotation === index) {
      // If clicking the same annotation, reset to original view
      resetCamera();
    } else {
      // Focus on new annotation
      setActiveAnnotation(index);
      
      // Call the callback to hide overlay when annotation is clicked
      if (onAnnotationClick) {
        onAnnotationClick();
      }
      
      // Disable autoRotate when focusing on annotation
      if (controls && controls.autoRotate) {
        controls.autoRotate = false;
      }
      
      const annotation = annotations[index];
      
      // Check if this annotation has custom camera settings
      if (annotation.customCamera) {
        // Use custom camera position and look-at point
        const customPos = annotation.customCamera.position;
        const customLookAt = annotation.customCamera.lookAt;
        const customDistance = annotation.customCamera.distance || 5;
        
        // Set camera position
        if (customPos) {
          targetPosition.current.set(...customPos);
          
          // If custom lookAt is provided, use it
          if (customLookAt) {
            targetLookAt.current.set(...customLookAt);
          } else {
            // Otherwise look at the annotation position
            targetLookAt.current.set(...position);
          }
          
          // If we need to apply distance from the lookAt point
          if (customDistance && customLookAt) {
            const dir = new THREE.Vector3();
            dir.subVectors(targetPosition.current, targetLookAt.current).normalize();
            targetPosition.current.copy(targetLookAt.current).add(dir.multiplyScalar(customDistance));
          }
        }
      } else {
        // Default camera behavior
        const annotationPos = new THREE.Vector3(...position);
        const currentCameraPos = camera.position.clone();
        
        // Calculate direction from annotation to camera
        const direction = new THREE.Vector3();
        direction.subVectors(currentCameraPos, annotationPos).normalize();
        
        // If direction is too vertical, adjust it to avoid gimbal lock
        if (Math.abs(direction.y) > 0.9) {
          direction.set(0.1, 0.9, 0.1).normalize();
        }
        
        // Position camera at a fixed distance from the annotation
        const distance = 5; // Adjust this value: smaller = closer zoom, larger = farther zoom
        targetPosition.current.copy(annotationPos).add(direction.multiplyScalar(distance));
        
        // Add upward offset to position camera higher
        targetPosition.current.y += 2; // Adjust this value to control how much higher the camera is
        targetPosition.current.x -=1;
        targetLookAt.current.copy(annotationPos);
      }
      
      // Start animation
      startCameraPosition.current.copy(camera.position);
      if (controls) {
        startControlsTarget.current.copy(controls.target);
      }
      animationProgress.current = 0;
      isAnimating.current = true;
    }
  };
  
  const resetCamera = () => {
    setActiveAnnotation(null);
    
    // Restore original autoRotate state
    if (controls) {
      controls.autoRotate = originalAutoRotate.current;
    }
    
    // Animate back to original position and target
    targetPosition.current.copy(originalCameraPosition.current);
    targetLookAt.current.copy(originalControlsTarget.current);
    
    startCameraPosition.current.copy(camera.position);
    if (controls) {
      startControlsTarget.current.copy(controls.target);
    }
    animationProgress.current = 0;
    isAnimating.current = true;
  };
  
  // Smooth camera animation
  useFrame((state, delta) => {
    if (isAnimating.current) {
      // Ease in-out animation
      animationProgress.current += delta * 1.5; // Adjust speed here
      const t = Math.min(animationProgress.current, 1);
      const eased = t < 0.5 
        ? 2 * t * t 
        : -1 + (4 - 2 * t) * t; // Quadratic ease in-out
      
      // Interpolate camera position
      camera.position.lerpVectors(
        startCameraPosition.current,
        targetPosition.current,
        eased
      );
      
      // Interpolate controls target if available
      if (controls) {
        controls.target.lerpVectors(
          startControlsTarget.current,
          targetLookAt.current,
          eased
        );
        controls.update();
      } else {
        // If no controls, look at target directly
        camera.lookAt(targetLookAt.current);
      }
      
      if (animationProgress.current >= 1) {
        isAnimating.current = false;
      }
    }
  });
  
  
  // Handle escape key to reset view
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeAnnotation !== null) {
        resetCamera();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAnnotation]);
  
  // Enable clicking anywhere to dismiss the annotation
  useEffect(() => {
    if (activeAnnotation !== null && gl && gl.domElement) {
      const handleCanvasClick = (e) => {
        // Small delay to prevent immediate exit when clicking a marker
        setTimeout(() => {
          if (activeAnnotation !== null) {
            resetCamera();
          }
        }, 100);
      };
      
      gl.domElement.addEventListener('click', handleCanvasClick);
      return () => gl.domElement.removeEventListener('click', handleCanvasClick);
    }
  }, [activeAnnotation, gl]);
  
  const markerColor = is80sMode ? '#D946EF' : '#ffff00';
  const hoverColor = is80sMode ? '#67e8f9' : '#c896ff';
  
  // Hide annotations and markers when FloatingCandleViewer is visible
  if (showFloatingViewer) {
    return null;
  }
  
  return (
    <>
      {annotations.map((annotation, index) => (
        <AnnotationMarker
          key={index}
          position={annotation.position}
          number={index + 1}
          text={annotation.text}
          onFocus={() => handleFocus(annotation.position, index)}
          isActive={activeAnnotation === index}
          color={markerColor}
          hoverColor={hoverColor}
          annotationOffset={annotation.annotationOffset}
          scale={scale}
          textScale={textScale}
          attachTo={annotation.attachTo}
          offset={annotation.offset}
          textOffset={annotation.textOffset}
        />
      ))}
    </>
  );
}

export default AnnotationSystem;