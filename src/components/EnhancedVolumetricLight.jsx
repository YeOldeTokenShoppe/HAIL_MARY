import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const EnhancedVolumetricLight = ({ 
  position = [-5, 100, 0], 
  target = [3, -10, -45],
  color = '#0af9dd',
  intensity = 1,
  rayCount = 20,
  spread = 12,
  opacity = 0.015,
  scrollY = 0
}) => {
  const groupRef = useRef();
  const time = useRef(0);
  
  // Create ray data with more aligned, organized distribution
  const rays = useMemo(() => {
    const raysArray = [];
    const lightPos = new THREE.Vector3(...position);
    const targetPos = new THREE.Vector3(...target);
    const direction = targetPos.clone().sub(lightPos).normalize();
    const distance = lightPos.distanceTo(targetPos);
    
    // Create fewer layers with more separation
    for (let layer = 0; layer < 2; layer++) {  // Reduced to 2 layers
      const layerRayCount = Math.floor(rayCount / 2);
      const layerSpread = spread * (1 + layer * 0.5); // More variation for depth
      const layerOpacity = opacity * (1.2 - layer * 0.3); // Stronger front layer
      
      for (let i = 0; i < layerRayCount; i++) {
        // Create a more uniform circular pattern
        const angle = (i / layerRayCount) * Math.PI * 2;
        const radiusFactor = 0.6 + (layer * 0.2); // More consistent radius
        const radius = layerSpread * radiusFactor;
        
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        // Smaller, more controlled offset for slight variation
        const seedValue = ((i + layer * 100) * 137.5) % 1;
        const randomOffset = new THREE.Vector3(
          (seedValue - 0.5) * 1.5, // Reduced from 5 to 1.5
          0, // No vertical offset for better alignment
          (seedValue - 0.5) * 1.5  // Reduced from 5 to 1.5
        );
        
        // More parallel ray positions - maintain separation at bottom
        const rayStart = lightPos.clone().add(new THREE.Vector3(x, 0, z)).add(randomOffset);
        // Keep rays more parallel by maintaining similar spread at bottom
        const rayEnd = targetPos.clone().add(new THREE.Vector3(x * 0.8, 10, z * 0.8)); // Stop above model, maintain spread
        const rayLength = rayStart.distanceTo(rayEnd) * 2.2; // Shorten rays
        const rayDirection = rayEnd.clone().sub(rayStart).normalize();
        
        // Thinner, more defined cone width for godray effect
        const coneRadius = 1.5 + layer * 0.5; // Thinner cones
        
        raysArray.push({
          id: `${layer}-${i}`,
          position: rayStart.clone().add(rayDirection.clone().multiplyScalar(rayLength / 2)),
          rotation: new THREE.Euler(
            Math.acos(rayDirection.y) + Math.PI,
            Math.atan2(rayDirection.x, rayDirection.z),
            0
          ),
          scale: [coneRadius, rayLength, coneRadius],
          opacity: layerOpacity * (0.9 + Math.sin(angle) * 0.1), // Slight variation in opacity
          pulseSpeed: 0.1,
          pulsePhase: (i / layerRayCount) * Math.PI * 2
        });
      }
    }
    
    return raysArray;
  }, [position, target, rayCount, spread, opacity]);
  
  // Animate the rays with scroll-based movement
  useFrame((state) => {
    time.current = state.clock.getElapsedTime();
    
    if (groupRef.current) {
      // Very subtle rotation - reduced to prevent vibration
      groupRef.current.rotation.y = Math.sin(time.current * 0.05) * 0.01;
      
      // Scroll-based positioning similar to other models
      // Follow the camera/scene movement based on scroll
      const baseY = position[1]; // Use original Y position as base
      
      // Check if we're in drone approach phase (same logic as Model component)
      const droneAppearThreshold = 3500;
      const droneApproachDuration = 4000;
      const droneApproachEnd = droneAppearThreshold + droneApproachDuration;
      
      let effectiveScrollY = scrollY;
      
      // During drone approach, maintain consistent lighting position
      if (scrollY >= droneAppearThreshold - 200 && scrollY < droneApproachEnd) {
        effectiveScrollY = droneAppearThreshold - 200;
      } else if (scrollY >= droneApproachEnd) {
        effectiveScrollY = scrollY - droneApproachDuration;
      }
      
      // Move the light source with scroll to maintain illumination on models
      const scrollInfluence = effectiveScrollY * 0.035; // Same scroll speed as models
      const newY = baseY + scrollInfluence;
      
      // Update position while maintaining relative positioning
      groupRef.current.position.set(
        position[0], 
        newY, 
        position[2]
      );
      
      // Visibility control - fade out when scrolled very far to match other models
      const shouldFade = scrollY > 9000; // Start fading before complete disappearance
      const fadeProgress = Math.max(0, 1 - (scrollY - 9000) / 500); // Fade over 500 scroll units
      groupRef.current.visible = scrollY <= 9500; // Complete disappearance threshold
      
      // Apply opacity fade to all children if fading
      if (shouldFade && groupRef.current.visible) {
        groupRef.current.traverse((child) => {
          if (child.material && child.material.transparent) {
            child.material.opacity = child.material.opacity * fadeProgress;
          }
        });
      }
    }
  });
  
  return (
    <group ref={groupRef}>
      {/* Main light source */}
      {/* <pointLight
        position={position}
        color={color}
        intensity={intensity}
        distance={500}
        decay={1.5}
      /> */}
      
      {/* Additional spot light for focused beam */}
      <spotLight
        position={position}
        target-position={target}
        angle={0.9}
        penumbra={0.8}
        intensity={intensity * 0.5}
        color={color}
        castShadow={false}
      /> 
      
      {/* Volumetric ray meshes */}
      {rays.map((ray) => (
        <mesh
          key={ray.id}
          position={ray.position}
          rotation={ray.rotation}
          scale={ray.scale}
        >
          <coneGeometry args={[1, 1, 6, 1, true]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={ray.opacity}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      
      {/* Central bright core ray - better aligned */}
      <mesh
        position={[
          (position[0] + target[0]) / 2,  // Center between light and target
          (position[1] + target[1]) / 2,  // Center vertically
          (position[2] + target[2]) / 2   // Center in Z
        ]}
        rotation={[Math.PI, 0, 0]}
      >
        {/* <cylinderGeometry args={[2, 8, Math.abs(position[1] - target[1]) * 0.5, 18, 1, true]} /> */}
        {/* <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity * 2.5}  // More intense core
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        /> */}
      </mesh>
      
      {/* Atmospheric glow at the source - commented out to hide sphere */}
      <mesh position={position}>
        <sphereGeometry args={[20, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.05}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};

export default EnhancedVolumetricLight;