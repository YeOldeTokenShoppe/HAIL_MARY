import React from 'react';
import { useGLTF } from '@react-three/drei';

const SynthSunset = ({ 
  position = [0, 0, -30],
  scale = [1, 1, 1],
  rotation = [0, 0, 0]
}) => {
  const { scene } = useGLTF('/models/synthSunset.glb');
  
  return (
    <primitive 
      object={scene} 
      position={position}
      scale={scale}
      rotation={rotation}
    />
  );
};

// Preload the model
useGLTF.preload('/models/synthSunset.glb');

export default SynthSunset;