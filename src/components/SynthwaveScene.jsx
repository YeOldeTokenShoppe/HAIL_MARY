import React from 'react';
import { Environment } from '@react-three/drei';
import SynthwaveSun from './SynthwaveSun';

const SynthwaveScene = ({ 
  showGrid = false,
  isMobile = false 
}) => {
  return (
    <>
      {/* Gradient background using Environment */}
      <Environment>
        <mesh scale={100}>
          <sphereGeometry args={[1, 64, 64]} />
          <meshBasicMaterial 
            side={2}
            transparent={false}
          >
            <shaderMaterial
              vertexShader={`
                varying vec2 vUv;
                void main() {
                  vUv = uv;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
              `}
              fragmentShader={`
                varying vec2 vUv;
                void main() {
                  vec3 topColor = vec3(0.1, 0.0, 0.3);  // Deep purple
                  vec3 midColor = vec3(0.5, 0.0, 0.5);  // Magenta
                  vec3 bottomColor = vec3(1.0, 0.2, 0.4); // Pink-orange
                  
                  float h = vUv.y;
                  vec3 color;
                  
                  if (h > 0.5) {
                    color = mix(midColor, topColor, (h - 0.5) * 2.0);
                  } else {
                    color = mix(bottomColor, midColor, h * 2.0);
                  }
                  
                  gl_FragColor = vec4(color, 1.0);
                }
              `}
            />
          </meshBasicMaterial>
        </mesh>
      </Environment>
      
      {/* Synthwave sun with louvers */}
      <SynthwaveSun 
        position={[0, 3, -25]}
        sunRadius={isMobile ? 5 : 8}
        louverCount={5}
        sunColor="#ff6b35"
        glowColor="#ff006e"
      />
      
      {/* Optional: Grid floor */}
      {showGrid && (
        <gridHelper 
          args={[100, 50]} 
          position={[0, -2, 0]}
          rotation={[0, 0, 0]}
        >
          <meshBasicMaterial color="#ff00ff" />
        </gridHelper>
      )}
      
      {/* Fog for depth */}
      <fog attach="fog" args={['#1a0033', 30, 100]} />
    </>
  );
};

export default SynthwaveScene;