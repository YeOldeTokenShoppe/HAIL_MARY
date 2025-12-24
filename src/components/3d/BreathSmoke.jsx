import React, { useMemo } from 'react';
import * as THREE from 'three';

const BreathSmoke = ({ 
  position = [3.1, 10.4, 25.1], 
  direction = [-0.1, -0.3, 2],
  rotation = [-2.2, 2.7, -0.2],
  debug = false
}) => {

  // Use props directly without Leva controls
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
  const baseOpacity = 0.4;
  const segments = 35;

  // Static cone shape - no animation needed
  const staticOpacity = debug ? 1 : baseOpacity;

  // Create breath particles with fire gradient colors
  const breathParticles = useMemo(() => {
    const particles = [];
    const particleCount = segments;
    
    // Fire gradient colors from hot (white/yellow) to cool (red/orange)
    const fireColors = [
      '#994422',  // Dark red
      '#cc4400',  // Red-orange
      // '#ff6b00', // Deep orange
      '#e5e0d9',  // Light beige (removed 'ff' alpha channel)
      '#ffffff',  // Hot white
    ];
    
    for (let i = 0; i < particleCount; i++) {
      // Create cone-shaped distribution
      const progress = i / particleCount;
      const radius = cloudBounds[0] * progress; // Expand outward
      const height = cloudBounds[1] * progress; // Rise upward
      const depth = cloudBounds[2] * progress; // Move forward
      
      // Use seeded random for consistent positioning
      const seededRandom = (seed) => {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
      };
      
      const angle = seededRandom(i * 13.7) * Math.PI * 2;
      const radiusVariation = seededRandom(i * 17.3) * radius;
      
      // Color gradient based on progress (distance from source)
      const colorIndex = Math.min(Math.floor(progress * fireColors.length), fireColors.length - 1);
      const particleColor = fireColors[colorIndex];
      
      particles.push({
        position: [
          Math.cos(angle) * radiusVariation,
          height + (seededRandom(i * 23.1) - 0.5) * cloudBounds[1] * 0.2,
          depth + (seededRandom(i * 29.7) - 0.5) * cloudBounds[2] * 0.3
        ],
        scale: 0.1 + seededRandom(i * 31.9) * 0.3,
        opacity: (1 - progress) * 0.8 + 0.2,
        color: particleColor,
        rotationX: seededRandom(i * 37.1) * Math.PI,
        rotationY: seededRandom(i * 41.3) * Math.PI,
        rotationZ: seededRandom(i * 43.7) * Math.PI
      });
    }
    return particles;
  }, []); // Empty dependency array - generate once and never change

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
          {/* Debug arrow to show direction */}
          <arrowHelper args={[new THREE.Vector3(dirX, dirY, dirZ).normalize(), new THREE.Vector3(0, 0, 0), 3, 0xff0000]} />
        </>
      )}
      {/* Breath particles arranged in cone shape with fire gradient */}
      {breathParticles.map((particle, i) => (
        <mesh 
          key={i}
          position={particle.position}
          scale={[
            particle.scale * (0.8 + Math.random() * 0.4), 
            particle.scale * (0.8 + Math.random() * 0.4), 
            particle.scale * (1.2 + Math.random() * 0.6)
          ]}
          rotation={[particle.rotationX, particle.rotationY, particle.rotationZ]}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial 
            color={debug ? "#00ff00" : particle.color}
            transparent
            opacity={staticOpacity * particle.opacity * 0.7}
            alphaTest={0.1}
          />
        </mesh>
      ))}
      
      {/* Additional wispy shapes for more volume with fire gradient */}
      {[...Array(Math.floor(segments / 4))].map((_, i) => {
        const progress = i / Math.floor(segments / 4);
        const radius = cloudBounds[0] * progress * 0.6;
        const angle = (i / Math.floor(segments / 4)) * Math.PI * 2;
        
        // Seeded random for consistent larger shape rotations
        const seededRandom = (seed) => {
          const x = Math.sin(seed) * 10000;
          return x - Math.floor(x);
        };
        
        // Fire gradient for larger shapes
        const fireColors = ['#ffffff', '#fff3a0', '#ffed4e', '#ff9500', '#ff6b00', '#cc4400', '#994422'];
        const colorIndex = Math.min(Math.floor(progress * fireColors.length), fireColors.length - 1);
        const shapeColor = fireColors[colorIndex];
        
        return (
          <mesh 
            key={`large-${i}`}
            position={[
              Math.cos(angle) * radius,
              cloudBounds[1] * progress * 0.6,
              cloudBounds[2] * progress * 0.8
            ]}
            scale={[
              0.15 + progress * 0.2,
              0.1 + progress * 0.15,
              0.3 + progress * 0.4
            ]}
            rotation={[
              seededRandom(i * 47.1 + 1000) * Math.PI,
              seededRandom(i * 53.3 + 1000) * Math.PI,
              seededRandom(i * 59.7 + 1000) * Math.PI
            ]}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial 
              color={debug ? "#00ff00" : shapeColor}
              transparent
              opacity={staticOpacity * (1 - progress) * 0.4}
              alphaTest={0.1}
            />
          </mesh>
        );
      })}

      {/* Extra fine particles for more density */}
      {[...Array(Math.floor(segments / 3))].map((_, i) => {
        const progress = i / Math.floor(segments / 3);
        const radius = cloudBounds[0] * progress * 0.3;
        const height = cloudBounds[1] * progress * 0.4;
        const depth = cloudBounds[2] * progress * 0.5;
        
        const seededRandom = (seed) => {
          const x = Math.sin(seed) * 10000;
          return x - Math.floor(x);
        };
        
        const angle = seededRandom(i * 71.3) * Math.PI * 2;
        const radiusVariation = seededRandom(i * 73.7) * radius;
        
        const fireColors = ['#ffffff', '#fff3a0', '#ffed4e', '#ff9500', '#ff6b00', '#cc4400', '#994422'];
        const colorIndex = Math.min(Math.floor(progress * fireColors.length), fireColors.length - 1);
        const particleColor = fireColors[colorIndex];
        
        return (
          <mesh 
            key={`fine-${i}`}
            position={[
              Math.cos(angle) * radiusVariation,
              height + (seededRandom(i * 79.1) - 0.5) * cloudBounds[1] * 0.15,
              depth + (seededRandom(i * 83.3) - 0.5) * cloudBounds[2] * 0.2
            ]}
            scale={[
              0.05 + seededRandom(i * 89.7) * 0.1,
              0.05 + seededRandom(i * 97.1) * 0.1,
              0.08 + seededRandom(i * 101.3) * 0.15
            ]}
            rotation={[
              seededRandom(i * 103.7) * Math.PI,
              seededRandom(i * 107.1) * Math.PI,
              seededRandom(i * 109.3) * Math.PI
            ]}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial 
              color={debug ? "#00ff00" : particleColor}
              transparent
              opacity={staticOpacity * (1 - progress) * 0.6}
              alphaTest={0.1}
            />
          </mesh>
        );
      })}
    </group>
  );
};

export default BreathSmoke;