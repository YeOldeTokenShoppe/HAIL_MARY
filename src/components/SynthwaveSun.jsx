import React, { useMemo } from 'react';
import * as THREE from 'three';

const SynthwaveSun = ({ 
  position = [0, 5, -30],
  sunRadius = 8,
  louverCount = 5,
  louverGap = 0.3,
  sunColor = '#ff6b35',
  glowColor = '#ff006e',
  louverColor = '#1a0033'
}) => {
  const louvers = useMemo(() => {
    const louverArray = [];
    const louverHeight = (sunRadius * 2) / (louverCount * 2 - 1);
    
    for (let i = 0; i < louverCount; i++) {
      const y = sunRadius - (i * 2 * louverHeight) - louverHeight / 2;
      const chord = 2 * Math.sqrt(sunRadius * sunRadius - y * y);
      
      louverArray.push({
        position: [0, y, 0.1],
        width: chord,
        height: louverHeight - louverGap
      });
    }
    
    return louverArray;
  }, [sunRadius, louverCount, louverGap]);

  return (
    <group position={position}>
      {/* Sun circle */}
      <mesh>
        <circleGeometry args={[sunRadius, 64]} />
        <meshBasicMaterial color={sunColor} />
      </mesh>
      
      {/* Glow effect behind sun */}
      <mesh position={[0, 0, -0.5]}>
        <circleGeometry args={[sunRadius * 1.3, 64]} />
        <meshBasicMaterial 
          color={glowColor} 
          transparent 
          opacity={0.3}
        />
      </mesh>
      
      {/* Outer glow */}
      <mesh position={[0, 0, -1]}>
        <circleGeometry args={[sunRadius * 1.6, 64]} />
        <meshBasicMaterial 
          color={glowColor} 
          transparent 
          opacity={0.15}
        />
      </mesh>
      
      {/* Horizontal louvers */}
      {louvers.map((louver, index) => (
        <mesh key={index} position={louver.position}>
          <planeGeometry args={[louver.width, louver.height]} />
          <meshBasicMaterial color={louverColor} />
        </mesh>
      ))}
    </group>
  );
};

export default SynthwaveSun;