import { useState, useEffect, useRef } from 'react';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';
import * as THREE from 'three';

/**
 * Hook for preloading and managing 3D assets with progress tracking
 * @param {Array} assetList - List of assets to preload
 * @returns {Object} Loading state, progress, and preloaded assets
 */
export const useAssetPreloader = (assetList = []) => {
  const [loadingState, setLoadingState] = useState({
    isLoading: true,
    progress: 0,
    currentAsset: null,
    error: null
  });
  
  const [assets, setAssets] = useState({});
  const loadersRef = useRef({});
  const abortControllerRef = useRef(new AbortController());
  
  useEffect(() => {
    // Initialize loaders once
    if (!loadersRef.current.gltfLoader) {
      const gltfLoader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('/draco/');
      gltfLoader.setDRACOLoader(dracoLoader);
      
      loadersRef.current = {
        gltfLoader,
        textureLoader: new THREE.TextureLoader(),
        audioLoader: new THREE.AudioLoader(),
        fileLoader: new THREE.FileLoader()
      };
    }
    
    const loadAssets = async () => {
      const totalWeight = assetList.reduce((sum, asset) => sum + (asset.weight || 1), 0);
      let loadedWeight = 0;
      const loadedAssets = {};
      
      for (const asset of assetList) {
        if (abortControllerRef.current.signal.aborted) break;
        
        setLoadingState(prev => ({
          ...prev,
          currentAsset: asset.name || asset.path,
          progress: Math.round((loadedWeight / totalWeight) * 100)
        }));
        
        try {
          const loadedAsset = await loadAsset(asset, loadersRef.current);
          loadedAssets[asset.key || asset.path] = loadedAsset;
          loadedWeight += asset.weight || 1;
        } catch (error) {
          console.error(`Failed to load asset: ${asset.path}`, error);
          loadedWeight += asset.weight || 1;
        }
      }
      
      setAssets(loadedAssets);
      setLoadingState({
        isLoading: false,
        progress: 100,
        currentAsset: null,
        error: null
      });
    };
    
    if (assetList.length > 0) {
      loadAssets();
    }
    
    return () => {
      // Cleanup on unmount
      abortControllerRef.current.abort();
    };
  }, [assetList]);
  
  return {
    ...loadingState,
    assets,
    getAsset: (key) => assets[key]
  };
};

/**
 * Load a single asset based on its type
 */
async function loadAsset(asset, loaders) {
  return new Promise((resolve, reject) => {
    const { type, path, options = {} } = asset;
    
    switch (type) {
      case 'model':
      case 'gltf':
        loaders.gltfLoader.load(
          path,
          (gltf) => {
            // Optimize the model
            if (options.optimize) {
              optimizeModel(gltf);
            }
            resolve(gltf);
          },
          (progress) => {
            // Progress callback can be used here if needed
          },
          reject
        );
        break;
        
      case 'texture':
        loaders.textureLoader.load(
          path,
          (texture) => {
            // Apply texture settings
            if (options.repeat) {
              texture.wrapS = THREE.RepeatWrapping;
              texture.wrapT = THREE.RepeatWrapping;
              texture.repeat.set(options.repeat.x, options.repeat.y);
            }
            if (options.encoding) {
              texture.encoding = options.encoding;
            }
            resolve(texture);
          },
          undefined,
          reject
        );
        break;
        
      case 'audio':
        loaders.audioLoader.load(
          path,
          (buffer) => resolve(buffer),
          undefined,
          reject
        );
        break;
        
      case 'json':
        loaders.fileLoader.load(
          path,
          (data) => resolve(JSON.parse(data)),
          undefined,
          reject
        );
        break;
        
      default:
        // For other file types, just fetch them
        fetch(path, { cache: 'force-cache' })
          .then(response => response.blob())
          .then(resolve)
          .catch(reject);
    }
  });
}

/**
 * Optimize a loaded GLTF model
 */
function optimizeModel(gltf) {
  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      // Enable frustum culling
      child.frustumCulled = true;
      
      // Optimize materials
      if (child.material) {
        child.material.needsUpdate = false;
        
        // Use lower precision for mobile
        if (window.innerWidth <= 768) {
          if (child.material.map) {
            child.material.map.minFilter = THREE.LinearFilter;
            child.material.map.generateMipmaps = false;
          }
        }
      }
      
      // Optimize geometry
      if (child.geometry) {
        child.geometry.computeBoundingBox();
        child.geometry.computeBoundingSphere();
      }
    }
  });
  
  return gltf;
}

export default useAssetPreloader;