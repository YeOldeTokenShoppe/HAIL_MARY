'use client';

import React, { useState, Suspense, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, ContactShadows, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import './CollectibleCard.css';

/**
 * Determines rarity based on edition number
 */
function getRarity(editionNumber, maxEditions = 100) {
  if (editionNumber === 1) return 'legendary';      // Genesis
  if (editionNumber === maxEditions) return 'legendary'; // Final
  if (editionNumber <= 10) return 'epic';           // Early adopter
  if (editionNumber === 69 || editionNumber === 80) return 'epic'; // Meme numbers
  if (editionNumber <= 25) return 'rare';
  return 'common';
}

/**
 * Gets rarity label for display
 */
function getRarityLabel(editionNumber, maxEditions = 100) {
  if (editionNumber === 1) return 'GENESIS';
  if (editionNumber === maxEditions) return 'FINAL EDITION';
  if (editionNumber <= 10) return 'EARLY ADOPTER';
  if (editionNumber === 69) return 'NICE';
  if (editionNumber === 80) return 'RL80 SPECIAL';
  if (editionNumber <= 25) return 'RARE';
  return 'STANDARD';
}

/**
 * 3D Model component for the back of the card with video screen
 */
function RotatingModel({ modelPath, videoSrc, onScreenClick }) {
  const { scene } = useGLTF(modelPath);
  const modelRef = useRef();
  const videoRef = useRef();
  const textureRef = useRef();
  const [screenMesh, setScreenMesh] = useState(null);

  // Clone the scene
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

  // Find Screen mesh after clone is ready
  useEffect(() => {
    if (!clonedScene) return;

    clonedScene.traverse((child) => {
      if (child.isMesh && child.name === 'Screen') {
        setScreenMesh(child);
      }
    });
  }, [clonedScene]);

  // Set up video AFTER screen mesh is found
  useEffect(() => {
    if (!videoSrc || typeof videoSrc !== 'string' || !screenMesh) {
      return;
    }

    const video = document.createElement('video');
    video.src = videoSrc;
    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    videoRef.current = video;

    // Create and apply texture
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.flipY = false;
    textureRef.current = texture;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    screenMesh.material = material;

    // Play video
    video.play().catch(() => {});

    return () => {
      video.pause();
      video.removeAttribute('src');
      if (textureRef.current) {
        textureRef.current.dispose();
      }
    };
  }, [videoSrc, screenMesh]);


  // Update video texture each frame
  useFrame(() => {
    if (textureRef.current && videoRef.current && !videoRef.current.paused) {
      textureRef.current.needsUpdate = true;
    }
  });

  // Handle click on model
  const handleClick = (e) => {
    e.stopPropagation();
    if (onScreenClick) {
      onScreenClick();
    }
  };

  return (
    <primitive
      ref={modelRef}
      object={clonedScene}
      scale={4.8}
      position={[0, 0, 0]}
      onClick={handleClick}
    />
  );
}

/**
 * 3D Canvas for model preview
 */
function ModelCanvas({ modelPath, accentColor, videoSrc, onScreenClick }) {
  return (
    <Canvas
      camera={{ position: [0, 0.5, 2.5], fov: 40 }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
      <directionalLight position={[-5, 3, -5]} intensity={0.3} color={accentColor} />
      <spotLight
        position={[0, 5, 0]}
        intensity={0.5}
        angle={0.5}
        penumbra={1}
        color={accentColor}
      />
      <Suspense fallback={null}>
        <RotatingModel modelPath={modelPath} videoSrc={videoSrc} onScreenClick={onScreenClick} />
        <ContactShadows
          position={[0, -0.8, 0]}
          opacity={0.4}
          scale={3}
          blur={2}
          far={1}
        />
        <Environment preset="city" />
      </Suspense>
      <OrbitControls enablePan={false} enableZoom={true} enableRotate={true} />
    </Canvas>
  );
}

const CollectibleCard = ({
  prizeName = 'RL80 Collectible',
  prizeDescription = 'Weekly Prize',
  prizeImage,
  prizeModelPath,
  prizeVideoSrc,
  weekIdentifier = '2026-W01',
  editionNumber = 1,
  maxEditions = 100,
  mintedAt,
  claimedAt, // Legacy support - use mintedAt for new code
  tokenId,
  accentColor = '#00f5d4',
  isActive = false,
  className = '',
  onClick,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showFullscreenVideo, setShowFullscreenVideo] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Use mintedAt if provided, fall back to claimedAt for backwards compatibility
  const mintTimestamp = mintedAt || claimedAt;
  const rarity = getRarity(editionNumber, maxEditions);
  const rarityLabel = getRarityLabel(editionNumber, maxEditions);
  const progressPercent = (editionNumber / maxEditions) * 100;

  // Format minted date
  const mintedDate = mintTimestamp?.toDate
    ? new Date(mintTimestamp.toDate()).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    : mintTimestamp instanceof Date
      ? mintTimestamp.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      : null;

  const handleClick = (e) => {
    // If there's a model path, toggle flip
    if (prizeModelPath) {
      setIsFlipped(!isFlipped);
    }
    // Call external onClick if provided
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <div
      className={`collectible-card-container ${className}`}
      onClick={handleClick}
    >
      <div className={`collectible-card-inner ${isFlipped ? 'flipped' : ''}`}>
        {/* FRONT SIDE */}
        <div
          className={`collectible-card card-front ${rarity} ${isActive ? 'active' : ''}`}
          style={{ '--accent-color': accentColor }}
        >
          {/* Header with name and edition */}
          <div className="collectible-header">
            <div className="collectible-title-section">
              <h3 className="collectible-name">{prizeName}</h3>
              <span className="collectible-subtitle">{prizeDescription}</span>
            </div>
            <div className="collectible-edition">
              <span className="edition-hash">#</span>
              <span className="edition-number">{editionNumber}</span>
            </div>
          </div>

          {/* Prize image */}
          <div className="collectible-image">
            <div className="image-frame">
              {prizeImage ? (
                <img src={prizeImage} alt={prizeName} />
              ) : (
                <div className="image-placeholder">
                  <span>🎁</span>
                </div>
              )}
            </div>
          </div>

          {/* Edition stats */}
          <div className="collectible-stats">
            <div className="stats-header">
              <span className="stats-label">SERIES 1 • EDITION</span>
              <span className="stats-value">{editionNumber}/{maxEditions}</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
              <div className="progress-marker" style={{ left: `${progressPercent}%` }} />
            </div>
            <div className="stats-footer">
              <span className="stats-hint">
                {editionNumber === 1 ? '🌟 First ever minted!' :
                 editionNumber === maxEditions ? '🏁 Final edition!' :
                 editionNumber <= 10 ? '⚡ Early adopter' :
                 `${maxEditions - editionNumber} minted after`}
              </span>
            </div>
          </div>

          {/* Card footer */}
          <div className="collectible-footer">
            <span className="token-id">{tokenId || `S1-RL80-${weekIdentifier}-${editionNumber}`}</span>
            <span className={`rarity-badge ${rarity}`}>{rarityLabel}</span>
          </div>

          {/* Flip hint */}
          {prizeModelPath && (
            <div className="flip-hint">
              <span>Click to flip</span>
            </div>
          )}

          {/* Holographic effect overlay */}
          <div className="holo-effect"></div>

          {/* Rarity glow effect */}
          <div className="rarity-glow"></div>
        </div>

        {/* BACK SIDE */}
        <div
          className={`collectible-card card-back ${rarity}`}
          style={{ '--accent-color': accentColor }}
        >
          {/* Back header */}
          <div className="back-header">
            <h3 className="collectible-name">{prizeName}</h3>
            <div className="collectible-edition">
              <span className="edition-hash">#</span>
              <span className="edition-number">{editionNumber}</span>
            </div>
          </div>

          {/* 3D Model Canvas or Expanded Video - Lazy load on mobile */}
          <div className="model-canvas-container">
            {/* Mobile: Show video/image by default, with option to load 3D */}
            {isMobile && isFlipped && !showFullscreenVideo && (
              <div className="mobile-back-content">
                {prizeVideoSrc ? (
                  <video
                    className="mobile-video-player"
                    src={prizeVideoSrc}
                    autoPlay
                    loop
                    muted
                    playsInline
                    poster={prizeImage}
                  />
                ) : prizeImage ? (
                  <img src={prizeImage} alt={prizeName} className="mobile-back-image" />
                ) : (
                  <div className="no-model-placeholder">
                    <span>🎁</span>
                    <p>{prizeName}</p>
                  </div>
                )}
                {/* Button to load 3D model on mobile */}
                {prizeModelPath && (
                  <button
                    className="load-3d-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFullscreenVideo(true); // Reuse this state for "show 3D mode"
                    }}
                  >
                    View 3D Model
                  </button>
                )}
              </div>
            )}
            {/* Mobile: 3D viewer when requested */}
            {isMobile && isFlipped && showFullscreenVideo && prizeModelPath && (
              <div className="mobile-3d-container">
                <ModelCanvas
                  modelPath={prizeModelPath}
                  accentColor={accentColor}
                  videoSrc={null}
                  onScreenClick={() => {}}
                />
                <button
                  className="back-to-video-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFullscreenVideo(false);
                  }}
                >
                  ✕ Back
                </button>
              </div>
            )}
            {/* Desktop: Full 3D experience */}
            {!isMobile && isFlipped && prizeModelPath && !showFullscreenVideo && (
              <ModelCanvas
                modelPath={prizeModelPath}
                accentColor={accentColor}
                videoSrc={prizeVideoSrc}
                onScreenClick={() => prizeVideoSrc && setShowFullscreenVideo(true)}
              />
            )}
            {!isMobile && isFlipped && showFullscreenVideo && prizeVideoSrc && (
              <div className="expanded-video-container">
                <video
                  className="expanded-video"
                  src={prizeVideoSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                />
                <button
                  className="video-close-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFullscreenVideo(false);
                  }}
                >
                  ✕ Back to 3D
                </button>
              </div>
            )}
            {!isMobile && !prizeModelPath && (
              <div className="no-model-placeholder">
                <span>🎁</span>
                <p>3D Model Coming Soon</p>
              </div>
            )}
            {!isMobile && prizeVideoSrc && isFlipped && !showFullscreenVideo && (
              <div className="tap-to-expand-hint">Tap model to expand video</div>
            )}
          </div>

          {/* Back footer */}
          <div className="back-footer">
            <span className={`rarity-badge ${rarity}`}>{rarityLabel}</span>
            <span className="flip-back-hint">
              {isMobile
                ? (showFullscreenVideo ? 'Viewing 3D model' : 'Tap to flip back')
                : (showFullscreenVideo ? 'Tap video to return' : 'Click to flip back')}
            </span>
          </div>

          {/* Rarity glow effect */}
          <div className="rarity-glow"></div>
        </div>
      </div>
    </div>
  );
};

export default CollectibleCard;
