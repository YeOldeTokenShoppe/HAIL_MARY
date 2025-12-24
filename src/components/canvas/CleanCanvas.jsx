"use client";

import { Canvas } from '@react-three/fiber';
import { useEffect, useRef, forwardRef } from 'react';
import * as THREE from 'three';

/**
 * Enhanced Canvas component with automatic cleanup on unmount
 * Prevents memory leaks when navigating between pages
 */
const CleanCanvas = forwardRef(function CleanCanvas({ children, onCreated, ...props }, ref) {
  const internalRef = useRef();
  const canvasRef = ref || internalRef;
  const sceneRef = useRef();
  const rendererRef = useRef();
  const cleanupTimeoutRef = useRef();

  const handleCreated = (state) => {
    sceneRef.current = state.scene;
    rendererRef.current = state.gl;
    
    // Call user's onCreated if provided
    if (onCreated) {
      onCreated(state);
    }
  };

  useEffect(() => {
    // Cleanup function
    return () => {
      // Cancel any pending cleanup timeout
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }

      // Defer cleanup to ensure React has finished unmounting
      cleanupTimeoutRef.current = setTimeout(() => {
        // Dispose of scene objects
        try {
          if (sceneRef.current && sceneRef.current.traverse && typeof sceneRef.current.traverse === 'function') {
            sceneRef.current.traverse((child) => {
            // Dispose geometry
            if (child.geometry) {
              child.geometry.dispose();
            }

            // Dispose material
            if (child.material) {
              const materials = Array.isArray(child.material) 
                ? child.material 
                : [child.material];

              materials.forEach(material => {
                if (!material) return;

                // Dispose all textures
                const textureKeys = [
                  'alphaMap', 'aoMap', 'bumpMap', 'displacementMap',
                  'emissiveMap', 'envMap', 'lightMap', 'map',
                  'metalnessMap', 'normalMap', 'roughnessMap', 'specularMap'
                ];

                textureKeys.forEach(key => {
                  if (material[key]) {
                    material[key].dispose();
                  }
                });

                // Dispose uniforms if shader material
                if (material.uniforms) {
                  Object.values(material.uniforms).forEach(uniform => {
                    if (uniform && uniform.value && uniform.value.dispose) {
                      uniform.value.dispose();
                    }
                  });
                }

                material.dispose();
              });
            }

            // Remove from parent
            if (child.parent) {
              child.parent.remove(child);
            }
          });

          // Clear the scene
          while(sceneRef.current.children.length > 0) {
            sceneRef.current.remove(sceneRef.current.children[0]);
          }
        }

        // Dispose renderer and lose WebGL context
        if (rendererRef.current) {
          rendererRef.current.dispose();
          rendererRef.current.forceContextLoss();
          
          // Get the canvas element and lose its context
          const canvas = rendererRef.current.domElement;
          if (canvas) {
            const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
            if (gl) {
              const loseContext = gl.getExtension('WEBGL_lose_context');
              if (loseContext) {
                loseContext.loseContext();
              }
            }
          }
        }

        // Clear refs
        sceneRef.current = null;
        rendererRef.current = null;

        // Clear Three.js cache
        THREE.Cache.clear();

        // Suggest garbage collection (browser may ignore)
        if (typeof window !== 'undefined' && window.gc) {
          window.gc();
        }
        } catch (error) {
          console.warn('CleanCanvas cleanup error:', error);
        }
      }, 0);
    };
  }, []);

  return (
    <Canvas
      ref={canvasRef}
      onCreated={handleCreated}
      {...props}
    >
      {children}
    </Canvas>
  );
});

export default CleanCanvas;