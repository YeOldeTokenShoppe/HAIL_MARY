'use client';

import React, { useState, Suspense, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';

// Configure DRACO loader
useGLTF.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

/**
 * Determines rarity based on edition number
 */
function getRarity(editionNumber, maxEditions = 100) {
  if (editionNumber === 1) return 'legendary';
  if (editionNumber === maxEditions) return 'legendary';
  if (editionNumber <= 10) return 'epic';
  if (editionNumber === 69 || editionNumber === 80) return 'epic';
  if (editionNumber <= 25) return 'rare';
  return 'common';
}

function getRarityLabel(editionNumber, maxEditions = 100) {
  if (editionNumber === 1) return 'GENESIS';
  if (editionNumber === maxEditions) return 'FINAL';
  if (editionNumber <= 10) return 'EARLY';
  if (editionNumber === 69) return 'NICE';
  if (editionNumber === 80) return 'RL80';
  if (editionNumber <= 25) return 'RARE';
  return '';
}

/**
 * Display model - handles both capsule (grid) and toy-only (preview) views
 */
function DisplayModel({ modelPath, isPreview }) {
  const { scene } = useGLTF(modelPath);
  const modelRef = useRef();

  const clonedScene = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  // Gentle rotation animation
  useFrame((state) => {
    if (modelRef.current) {
      modelRef.current.rotation.y += isPreview ? 0.008 : 0.005;
    }
  });

  // Different scale/position for capsule vs toy-only
  const scale = isPreview ? 2.5 : 2.2;
  const position = isPreview ? [0, 0.05, 0] : [0, 0, 0];

  return (
    <primitive
      ref={modelRef}
      object={clonedScene}
      scale={scale}
      position={position}
    />
  );
}

/**
 * 3D Scene with model
 */
function CapsuleScene({ modelPath, onLoad, isPreview, isMobile }) {
  useEffect(() => {
    if (onLoad) onLoad();
  }, [onLoad]);

  return (
    <>
      {/* Brighter ambient on mobile to compensate for no Environment HDR */}
      <ambientLight intensity={isMobile ? 1.2 : 0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow={!isMobile} />
      <directionalLight position={[-3, 3, -3]} intensity={0.3} color="#00f5d4" />
      <spotLight
        position={[0, 5, 0]}
        intensity={0.5}
        angle={0.5}
        penumbra={1}
        color="#ffffff"
      />

      <Suspense fallback={null}>
        <DisplayModel modelPath={modelPath} isPreview={isPreview} />
        {/* Skip heavy Environment HDR on mobile for better performance */}
        {!isMobile && <Environment preset="city" />}
      </Suspense>

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={1.5}
        maxDistance={4}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  );
}

/**
 * Main CapsuleCollectible Component
 *
 * View progression in preview mode:
 * 1. Image (static thumbnail)
 * 2. Capsule (ipadMaryToy.glb - toy in capsule)
 * 3. Toy (Collectible1.glb - toy revealed)
 */
const CapsuleCollectible = ({
  prizeName = 'RL80 Collectible',
  prizeModelPath,           // Toy only model (Collectible1.glb)
  prizeCapsuleModelPath,    // Toy in capsule model (ipadMaryToy.glb)
  prizeImage,
  editionNumber = 1,
  maxEditions = 100,
  mintedAt,
  weekIdentifier,
  accentColor = '#00f5d4',
  className = '',
  onClick,
  isPreview = false, // True when shown in full preview modal
}) => {
  // View stages: 'image' -> 'capsule' -> 'toy'
  const [viewStage, setViewStage] = useState('image');
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const rarity = getRarity(editionNumber, maxEditions);
  const rarityLabel = getRarityLabel(editionNumber, maxEditions);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-show capsule 3D on desktop preview
  useEffect(() => {
    if (isPreview && !isMobile && prizeCapsuleModelPath) {
      setViewStage('capsule');
      setIsLoading(true);
    }
  }, [isPreview, isMobile, prizeCapsuleModelPath]);

  // Preload the toy model when viewing capsule (so transition is instant)
  useEffect(() => {
    if (viewStage === 'capsule' && prizeModelPath) {
      useGLTF.preload(prizeModelPath);
    }
  }, [viewStage, prizeModelPath]);

  // Get current model path based on stage
  const currentModelPath = viewStage === 'toy' ? prizeModelPath : prizeCapsuleModelPath;

  // Handle progression to next stage
  const handleNextStage = (e) => {
    if (e) e.stopPropagation();

    if (viewStage === 'image') {
      setViewStage('capsule');
      setIsLoading(true);
    } else if (viewStage === 'capsule' && prizeModelPath) {
      setViewStage('toy');
      setIsLoading(true);
    }
  };

  const handleModelLoaded = () => {
    setIsLoading(false);
  };

  // Get button text based on current stage
  const getActionText = () => {
    if (viewStage === 'image') return 'View Capsule';
    if (viewStage === 'capsule') return 'Open Capsule';
    return null;
  };

  // Format date
  const mintedDate = mintedAt?.toDate
    ? new Date(mintedAt.toDate()).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : mintedAt instanceof Date
      ? mintedAt.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })
      : null;

  // Determine if we should show 3D (capsule or toy stage)
  const show3D = viewStage === 'capsule' || viewStage === 'toy';

  return (
    <div
      className={`capsule-collectible ${rarity} ${className} ${viewStage === 'toy' ? 'revealed' : ''}`}
      style={{ '--accent-color': accentColor }}
      onClick={!isPreview ? onClick : undefined}
    >
      {/* 3D Viewer or Static Preview */}
      <div className="capsule-viewer">
        {show3D && currentModelPath ? (
          <>
            {isLoading && (
              <div className="capsule-loading">
                <div className="loading-spinner" />
              </div>
            )}
            <Canvas
              camera={{ position: [0, 0.5, 1.5], fov: 45 }}
              style={{ background: 'transparent' }}
              dpr={isMobile ? [1, 1.5] : [1, 2]}
              performance={{ min: 0.5 }}
            >
              <CapsuleScene
                modelPath={currentModelPath}
                onLoad={handleModelLoaded}
                isPreview={viewStage === 'toy'}
                isMobile={isMobile}
              />
            </Canvas>
            {/* Clickable overlay to open capsule */}
            {isPreview && viewStage === 'capsule' && prizeModelPath && (
              <div
                className="capsule-click-overlay"
                onClick={handleNextStage}
              />
            )}
          </>
        ) : (
          <div className="capsule-static">
            {prizeImage ? (
              <img src={prizeImage} alt={prizeName} className="capsule-image" />
            ) : (
              <div className="capsule-placeholder">🎁</div>
            )}
            {/* Show action button in preview mode (for mobile) */}
            {isPreview && getActionText() && (
              <button
                className="load-3d-button"
                onClick={handleNextStage}
              >
                {getActionText()}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Metadata Overlay */}
      <div className="capsule-meta">
        <div className="meta-top">
          {rarityLabel && <span className={`rarity-tag ${rarity}`}>{rarityLabel}</span>}
        </div>
        <div className="meta-bottom">
          <span className="edition">#{editionNumber}</span>
          <span className="name">{prizeName}</span>
          {mintedDate && <span className="date">{mintedDate}</span>}
        </div>
      </div>

      <style jsx>{`
        .capsule-collectible {
          --accent-color: #00f5d4;
          position: relative;
          width: 100%;
          aspect-ratio: 3 / 4;
          max-width: 280px;
          background: linear-gradient(135deg, rgba(20, 20, 35, 0.95) 0%, rgba(10, 10, 20, 0.98) 100%);
          border-radius: 16px;
          overflow: hidden;
          cursor: pointer;
          border: 2px solid rgba(255, 255, 255, 0.1);
        }

        .capsule-collectible.legendary {
          border-color: rgba(246, 224, 94, 0.4);
          box-shadow: 0 0 20px rgba(246, 224, 94, 0.2);
        }

        .capsule-collectible.epic {
          border-color: rgba(159, 122, 234, 0.4);
        }

        .capsule-collectible.rare {
          border-color: rgba(49, 130, 206, 0.4);
        }

        .capsule-viewer {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .capsule-viewer canvas {
          width: 100% !important;
          height: 100% !important;
        }

        .capsule-static {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          padding: 1rem;
        }

        .capsule-image {
          max-width: 70%;
          max-height: 60%;
          object-fit: contain;
          filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5));
        }

        .capsule-placeholder {
          font-size: 4rem;
          opacity: 0.3;
        }

        .load-3d-button {
          margin-top: 1rem;
          padding: 0.5rem 1rem;
          background: linear-gradient(135deg, rgba(0, 245, 212, 0.2), rgba(0, 187, 255, 0.2));
          border: 1px solid rgba(0, 245, 212, 0.5);
          color: #00f5d4;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          font-family: 'Orbitron', monospace;
        }

        .load-3d-button:hover {
          background: linear-gradient(135deg, rgba(0, 245, 212, 0.3), rgba(0, 187, 255, 0.3));
          box-shadow: 0 0 15px rgba(0, 245, 212, 0.3);
        }

        .capsule-click-overlay {
          position: absolute;
          inset: 0;
          cursor: pointer;
          z-index: 15;
        }

        .capsule-collectible.revealed {
          border-color: rgba(0, 245, 212, 0.5);
          box-shadow: 0 0 30px rgba(0, 245, 212, 0.3);
        }

        .capsule-loading {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.5);
          z-index: 10;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(0, 245, 212, 0.2);
          border-top-color: #00f5d4;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .capsule-meta {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 0.75rem;
          pointer-events: none;
        }

        .meta-top {
          display: flex;
          justify-content: flex-end;
        }

        .rarity-tag {
          padding: 0.25rem 0.5rem;
          border-radius: 8px;
          font-size: 0.6rem;
          font-weight: 700;
          font-family: 'Orbitron', monospace;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .rarity-tag.legendary {
          background: linear-gradient(135deg, rgba(246, 224, 94, 0.3), rgba(237, 137, 54, 0.3));
          color: #fbd38d;
        }

        .rarity-tag.epic {
          background: rgba(159, 122, 234, 0.3);
          color: #b794f4;
        }

        .rarity-tag.rare {
          background: rgba(49, 130, 206, 0.3);
          color: #63b3ed;
        }

        .rarity-tag.common {
          display: none;
        }

        .meta-bottom {
          background: linear-gradient(to top, rgba(0, 0, 0, 0.9), transparent);
          margin: -0.75rem;
          padding: 1.5rem 0.75rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .edition {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--accent-color);
          font-family: 'Orbitron', monospace;
          text-shadow: 0 0 10px var(--accent-color);
        }

        .name {
          font-size: 0.8rem;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .date {
          font-size: 0.65rem;
          color: rgba(255, 255, 255, 0.5);
        }

        @media (max-width: 480px) {
          .capsule-collectible {
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default CapsuleCollectible;
