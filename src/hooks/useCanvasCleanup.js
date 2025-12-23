import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Custom hook to properly cleanup Three.js/R3F resources
 * Helps prevent memory leaks when navigating between pages
 */
export function useCanvasCleanup() {
  const cleanupFunctionsRef = useRef([]);

  // Register a cleanup function to be called on unmount
  const registerCleanup = (cleanupFn) => {
    if (typeof cleanupFn === 'function') {
      cleanupFunctionsRef.current.push(cleanupFn);
    }
  };

  // Dispose of Three.js geometries and materials
  const disposeObject = (obj) => {
    if (!obj) return;

    // Dispose geometry
    if (obj.geometry) {
      obj.geometry.dispose();
    }

    // Dispose material(s)
    if (obj.material) {
      const disposeMaterial = (material) => {
        // Dispose all texture maps
        const textureProperties = [
          'map', 'lightMap', 'bumpMap', 'normalMap', 
          'specularMap', 'envMap', 'alphaMap', 'aoMap',
          'displacementMap', 'emissiveMap', 'gradientMap',
          'metalnessMap', 'roughnessMap'
        ];

        textureProperties.forEach(prop => {
          if (material[prop]) {
            material[prop].dispose();
          }
        });

        // Dispose the material itself
        material.dispose();
      };

      if (Array.isArray(obj.material)) {
        obj.material.forEach(disposeMaterial);
      } else {
        disposeMaterial(obj.material);
      }
    }

    // Recursively dispose children
    if (obj.children) {
      obj.children.forEach(child => disposeObject(child));
    }
  };

  // Cleanup all registered functions on unmount
  useEffect(() => {
    return () => {
      // Execute all registered cleanup functions
      cleanupFunctionsRef.current.forEach(fn => {
        try {
          fn();
        } catch (error) {
          console.warn('Cleanup function error:', error);
        }
      });

      // Clear the array
      cleanupFunctionsRef.current = [];

      // Force garbage collection hint (browser may or may not honor this)
      if (window.gc) {
        window.gc();
      }
    };
  }, []);

  return {
    registerCleanup,
    disposeObject
  };
}

/**
 * Wrapper component for Canvas that ensures proper cleanup
 */
export function CanvasWithCleanup({ children, ...props }) {
  const { registerCleanup } = useCanvasCleanup();
  const canvasRef = useRef();

  useEffect(() => {
    return () => {
      // Access the Canvas's gl context and dispose it
      if (canvasRef.current) {
        const gl = canvasRef.current.getContext('webgl') || 
                   canvasRef.current.getContext('webgl2');
        
        if (gl) {
          // Clear all WebGL resources
          const loseContext = gl.getExtension('WEBGL_lose_context');
          if (loseContext) {
            loseContext.loseContext();
          }
        }
      }
    };
  }, []);

  return (
    <div ref={canvasRef}>
      {children}
    </div>
  );
}