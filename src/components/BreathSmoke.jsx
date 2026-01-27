import React, { useMemo } from 'react';
import * as THREE from 'three';

const BreathSmoke = ({
  position = [3.1, 10.4, 25.1],
  direction = [-0.1, -0.3, 2],
  rotation = [-2.2, 2.7, -0.2],
  debug = false
}) => {

  const posX = position[0];
  const posY = position[1];
  const posZ = position[2];
  const dirX = direction[0];
  const dirY = direction[1];
  const dirZ = direction[2];
  const rotX = rotation[0];
  const rotY = rotation[1];
  const rotZ = rotation[2];
  const cloudBounds = [1.5, 6, 2.5];
  const baseOpacity = 0.25;
  const segments = 30;

  const staticOpacity = debug ? 1 : baseOpacity;

  // Warm steam colors - from hot white core to cooler wisps
  const steamColors = [
    '#ffffff',  // Hot white (near nostrils)
    '#f5ece3',  // Warm white
    '#e0d5ca',  // Warm beige
    '#c8b8a8',  // Muted warm gray
    '#a89888',  // Fading gray
  ];

  // Create breath particles
  const breathParticles = useMemo(() => {
    const particles = [];
    const particleCount = segments;

    const seededRandom = (seed) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < particleCount; i++) {
      const progress = i / particleCount;
      const radius = cloudBounds[0] * progress;
      const height = cloudBounds[1] * progress;
      const depth = cloudBounds[2] * progress;

      const angle = seededRandom(i * 13.7) * Math.PI * 2;
      const radiusVariation = seededRandom(i * 17.3) * radius;

      const colorIndex = Math.min(Math.floor(progress * steamColors.length), steamColors.length - 1);
      const particleColor = steamColors[colorIndex];

      // Particles grow larger as they dissipate
      const baseScale = 0.15 + progress * 0.25;

      particles.push({
        position: [
          Math.cos(angle) * radiusVariation,
          height + (seededRandom(i * 23.1) - 0.5) * cloudBounds[1] * 0.2,
          depth + (seededRandom(i * 29.7) - 0.5) * cloudBounds[2] * 0.3
        ],
        scale: baseScale + seededRandom(i * 31.9) * 0.1,
        opacity: (1 - progress * 0.8) * 0.6,
        color: particleColor,
        rotationX: seededRandom(i * 37.1) * Math.PI,
        rotationY: seededRandom(i * 41.3) * Math.PI,
        rotationZ: seededRandom(i * 43.7) * Math.PI
      });
    }
    return particles;
  }, []);

  // Wispy volume shapes
  const wispParticles = useMemo(() => {
    const wisps = [];
    const wispCount = Math.floor(segments / 3);

    const seededRandom = (seed) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < wispCount; i++) {
      const progress = i / wispCount;
      const angle = (i / wispCount) * Math.PI * 2;
      const radius = cloudBounds[0] * progress * 0.5;

      const colorIndex = Math.min(Math.floor(progress * steamColors.length), steamColors.length - 1);

      wisps.push({
        position: [
          Math.cos(angle) * radius,
          cloudBounds[1] * progress * 0.5,
          cloudBounds[2] * progress * 0.7
        ],
        scale: [
          0.2 + progress * 0.3,
          0.15 + progress * 0.2,
          0.3 + progress * 0.4
        ],
        rotation: [
          seededRandom(i * 47.1 + 1000) * Math.PI,
          seededRandom(i * 53.3 + 1000) * Math.PI,
          seededRandom(i * 59.7 + 1000) * Math.PI
        ],
        color: steamColors[colorIndex],
        opacity: (1 - progress) * 0.3,
      });
    }
    return wisps;
  }, []);

  return (
    <group position={[posX, posY, posZ]} rotation={[rotX, rotY, rotZ]}>
      {/* Debug sphere to show exact position */}
      {debug && (
        <>
          <mesh>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshBasicMaterial color="yellow" />
          </mesh>
          <pointLight color="yellow" intensity={5} distance={10} />
          <arrowHelper args={[new THREE.Vector3(dirX, dirY, dirZ).normalize(), new THREE.Vector3(0, 0, 0), 3, 0xff0000]} />
        </>
      )}

      {/* Main breath particles — soft spheres */}
      {breathParticles.map((particle, i) => (
        <mesh
          key={i}
          position={particle.position}
          scale={particle.scale}
          rotation={[particle.rotationX, particle.rotationY, particle.rotationZ]}
        >
          <sphereGeometry args={[1, 12, 12]} />
          <meshBasicMaterial
            color={debug ? "#00ff00" : particle.color}
            transparent
            opacity={staticOpacity * particle.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}

      {/* Larger wispy shapes for volume */}
      {wispParticles.map((wisp, i) => (
        <mesh
          key={`wisp-${i}`}
          position={wisp.position}
          scale={wisp.scale}
          rotation={wisp.rotation}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial
            color={debug ? "#00ff00" : wisp.color}
            transparent
            opacity={staticOpacity * wisp.opacity}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
};

export default BreathSmoke;
