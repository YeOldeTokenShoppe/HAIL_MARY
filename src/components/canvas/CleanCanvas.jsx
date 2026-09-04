"use client";

import { Canvas } from '@react-three/fiber';
import { useEffect, useRef, forwardRef } from 'react';
import * as THREE from 'three';

/**
 * Enhanced Canvas component with automatic cleanup on unmount
 * Prevents memory leaks when navigating between pages
 */
const CleanCanvas = forwardRef(function CleanCanvas({ children, onCreated, onContextLost, onContextRestored, ...props }, ref) {
  const internalRef = useRef();
  const canvasRef = ref || internalRef;
  const sceneRef = useRef();
  const rendererRef = useRef();
  const cleanupTimeoutRef = useRef();
  // Set once this instance is going away: the cleanup below forces a context
  // loss on purpose, and that event must not be mistaken for the real thing.
  const disposingRef = useRef(false);
  const contextHandlersRef = useRef(null);

  const handleCreated = (state) => {
    sceneRef.current = state.scene;
    rendererRef.current = state.gl;

    // WebGL context loss. iOS Safari reclaims a backgrounded page's GPU
    // resources after a while; on return the page is alive and React keeps
    // updating, but the canvas can no longer draw — every control on the
    // scene looks dead until a reload (Michelle, 2026-09-03: the rig's style
    // pager "stops working after a few hours of inactivity"). preventDefault
    // lets the browser restore the context if it will; the page decides what
    // to do if it does not (it remounts the canvas — see hailmary/page.js).
    const el = state.gl.domElement;
    const onLost = (e) => {
      e.preventDefault();
      if (disposingRef.current) return;
      onContextLost?.();
    };
    const onRestored = () => { if (!disposingRef.current) onContextRestored?.(); };
    el.addEventListener("webglcontextlost", onLost, false);
    el.addEventListener("webglcontextrestored", onRestored, false);
    contextHandlersRef.current = { el, onLost, onRestored };

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

      disposingRef.current = true;
      if (contextHandlersRef.current) {
        const { el, onLost, onRestored } = contextHandlersRef.current;
        el.removeEventListener("webglcontextlost", onLost, false);
        el.removeEventListener("webglcontextrestored", onRestored, false);
        contextHandlersRef.current = null;
      }

      // Defer cleanup to ensure React has finished unmounting
      cleanupTimeoutRef.current = setTimeout(() => {
        // Dispose of scene objects
        try {
          if (sceneRef.current && sceneRef.current.traverse && typeof sceneRef.current.traverse === 'function') {
            // Collect first, then dispose: removing a child from its parent
            // inside traverse() shifts the siblings under the walk and threw
            // "undefined is not an object (evaluating 'children[i].traverse')",
            // which aborted the rest of the teardown.
            const toDispose = [];
            sceneRef.current.traverse((child) => { toDispose.push(child); });
            toDispose.forEach((child) => {
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