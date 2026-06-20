import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const CoinStream = ({ 
  startPosition = [0, 0, 0], 
  endPosition = [0, -10, 5],
  coinCount = 30,
  coinSize = 0.1,
  streamWidth = 2,
  speed = 1,
  coinMesh = null,
  gravity = -9.8,
  initialVelocity = [3, 2, 2],
  trigger = 0,  // New prop: incremented to trigger a single event
  coinValue = 100, // Value of coins to award (total, not per coin)
  onCoinsDispensed = null // Callback when coins are triggered
}) => {
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const triggerStartTime = useRef(null);
  const lastTrigger = useRef(0);
  const audioRef = useRef(null);
  const coinsAwarded = useRef(0);
  const lastAwardTime = useRef(0);
  
  // Create coin data with random offsets and phases
  const coins = useMemo(() => {
    return Array.from({ length: coinCount }, (_, i) => ({
      delay: (i / coinCount) * 1.5, // Stagger coin release over 1.5 seconds
      offset: {
        x: (Math.random() - 0.5) * streamWidth,
        y: (Math.random() - 0.5) * 0.5,
        z: (Math.random() - 0.5) * streamWidth
      },
      rotationSpeed: {
        x: Math.random() * 2 + 1,
        y: Math.random() * 2 + 1,
        z: Math.random() * 2 + 1
      },
      velocity: {
        x: initialVelocity[0] + (Math.random() - 0.5) * 1,
        y: initialVelocity[1] + (Math.random() - 0.5) * 1,
        z: initialVelocity[2] + (Math.random() - 0.5) * 1
      }
    }));
  }, [coinCount, streamWidth, initialVelocity]);

  // Initialize audio
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/sounds/coins.mp3');
      audioRef.current.volume = 0.3; // Set volume to 30%
      audioRef.current.preload = 'auto';
    }
    
    // Cleanup on unmount
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useFrame((state) => {
    if (!meshRef.current) return;
    
    // Check if we need to start a new trigger event
    if (trigger !== lastTrigger.current) {
      triggerStartTime.current = state.clock.elapsedTime;
      lastTrigger.current = trigger;
      coinsAwarded.current = 0; // Reset coins awarded counter
      lastAwardTime.current = 0; // Reset last award time
      
      // Play coins sound effect
      if (audioRef.current) {
        try {
          audioRef.current.currentTime = 0; // Reset to beginning
          audioRef.current.play().catch(error => {
            console.log('Audio play failed (user interaction required):', error);
          });
        } catch (error) {
          console.error('Error playing coins sound:', error);
        }
      }
    }
    
    // Only animate if we have an active trigger
    if (triggerStartTime.current === null) {
      // Hide all coins when not triggered
      coins.forEach((_, i) => {
        dummy.position.set(0, -1000, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      });
      meshRef.current.instanceMatrix.needsUpdate = true;
      return;
    }
    
    const timeSinceTrigger = state.clock.elapsedTime - triggerStartTime.current;
    const animationDuration = 6; // Total animation duration (increased for longer effect)
    
    // Progressive coin awarding - award coins over the first 2 seconds to sync with wallet delay
    if (onCoinsDispensed && coinValue > 0 && timeSinceTrigger <= 1.0) {
      // Award coins in increments based on time progression
      const awardDuration = 1.0; // Award over 2 seconds to match wallet delay
      const awardInterval = 0.08; // Award coins every 80ms for smoother distribution
      const totalAwards = Math.floor(awardDuration / awardInterval); // Total number of award events
      const coinsPerAward = coinValue / totalAwards;
      
      // Check if it's time to award more coins
      if (timeSinceTrigger - lastAwardTime.current >= awardInterval) {
        const remainingCoins = coinValue - coinsAwarded.current;
        if (remainingCoins > 0) {
          const coinsToAward = Math.min(coinsPerAward, remainingCoins);
          onCoinsDispensed(coinsToAward);
          coinsAwarded.current += coinsToAward;
          lastAwardTime.current = timeSinceTrigger;
          console.log(`CoinStream: Awarded ${coinsToAward.toFixed(0)} coins (${coinsAwarded.current.toFixed(0)}/${coinValue} total)`);
        }
      }
    }
    
    // Reset trigger after animation completes
    if (timeSinceTrigger > animationDuration) {
      triggerStartTime.current = null;
      return;
    }
    
    coins.forEach((coin, i) => {
      // Calculate time for this specific coin (accounting for delay)
      const coinStartTime = coin.delay;
      const coinTime = timeSinceTrigger - coinStartTime;
      
      // Only animate coins whose time has come
      if (coinTime >= 0) {
        // Parabolic arc physics
        const t = coinTime * speed;
        const x = startPosition[0] + coin.velocity.x * t + coin.offset.x;
        const y = startPosition[1] + coin.velocity.y * t + 0.5 * gravity * t * t + coin.offset.y;
        const z = startPosition[2] + coin.velocity.z * t + coin.offset.z;
        
        // Fade out coins as they fall
        const maxTime = animationDuration - coinStartTime;
        const opacity = Math.max(0, 1 - (coinTime / maxTime));
        
        // Only show coins that haven't fallen too far
        if (y > endPosition[1] && opacity > 0.1) {
          dummy.position.set(x, y, z);
          
          // Spinning rotation
          dummy.rotation.x = (timeSinceTrigger + coinStartTime) * coin.rotationSpeed.x;
          dummy.rotation.y = (timeSinceTrigger + coinStartTime) * coin.rotationSpeed.y;
          dummy.rotation.z = (timeSinceTrigger + coinStartTime) * coin.rotationSpeed.z;
          
          dummy.scale.setScalar(coinSize * opacity);
          dummy.updateMatrix();
          meshRef.current.setMatrixAt(i, dummy.matrix);
        } else {
          // Hide coins that have fallen too far
          dummy.position.set(0, -1000, 0);
          dummy.updateMatrix();
          meshRef.current.setMatrixAt(i, dummy.matrix);
        }
      } else {
        // Hide coins that haven't started yet
        dummy.position.set(0, -1000, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      }
    });
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  // Create a simple coin geometry if no mesh provided
  const geometry = useMemo(() => {
    if (coinMesh?.geometry) {
      return coinMesh.geometry;
    }
    // Fallback to a simple cylinder for coin shape
    return new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
  }, [coinMesh]);

  const material = useMemo(() => {
    if (coinMesh?.material) {
      return coinMesh.material;
    }
    // Fallback gold material
    return new THREE.MeshStandardMaterial({
      color: '#FFD700',
      metalness: 0.8,
      roughness: 0.2,
      emissive: '#FFD700',
      emissiveIntensity: 0.1
    });
  }, [coinMesh]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, coinCount]}
      frustumCulled={false}
    />
  );
};

export default CoinStream;