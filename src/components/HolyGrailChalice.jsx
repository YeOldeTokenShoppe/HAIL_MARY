"use client";

import React, { useRef, useState, useEffect, Suspense, useMemo } from "react";
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, OrbitControls, Environment } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField } from '@react-three/postprocessing';
import * as THREE from 'three'

// Coin names to animate
const TUMBLING_COINS = ['Coin5', 'Coin6', 'Coin7', 'Coin8', 'Coin9', 'Coin10', 'Coin11'];



// Flickering flame shader material for tiny votive (non-instanced version)
function createTinyFlameMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      uniform float uTime;
      varying float vHeight;

      void main() {
        vec3 pos = position;

        // Height normalized 0-1
        vHeight = clamp((pos.y + 0.1) / 0.6, 0.0, 1.0);

        // Flame flicker animation
        float flameTime = uTime * 3.0;

        // Sway side to side
        float sway = sin(flameTime * 1.5) * 0.06 * vHeight * vHeight;
        sway += sin(flameTime * 2.3) * 0.03 * vHeight;
        pos.x += sway;

        // Flicker height
        float flicker = sin(flameTime * 2.0) * 0.04 * vHeight;
        flicker += sin(flameTime * 3.7) * 0.02 * vHeight * vHeight;
        pos.y += flicker;

        // Z wobble
        pos.z += cos(flameTime * 1.8) * 0.04 * vHeight * vHeight;

        // Taper at top
        float taper = 1.0 - vHeight * 0.5;
        pos.x *= taper;
        pos.z *= taper;

        // Vertical stretch
        float stretch = 1.0 + sin(flameTime * 2.5) * 0.1 * vHeight;
        pos.y *= stretch;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying float vHeight;

      void main() {
        float time = uTime * 3.0;

        // Base flame colors
        vec3 innerColor = vec3(1.0, 0.95, 0.8);
        vec3 midColor = vec3(1.0, 0.5, 0.0);
        vec3 outerColor = vec3(1.0, 0.2, 0.0);

        vec3 color;
        if (vHeight < 0.3) {
          color = mix(innerColor, midColor, vHeight / 0.3);
        } else if (vHeight < 0.7) {
          color = mix(midColor, outerColor, (vHeight - 0.3) / 0.4);
        } else {
          color = mix(outerColor, vec3(1.0, 0.8, 0.0), (vHeight - 0.7) / 0.3);
        }

        float flicker = sin(time * 4.0) * 0.25 + sin(time * 9.0) * 0.15 + 1.0;
        float intensity = 3.5 * flicker;
        float alpha = (1.0 - vHeight * 0.5) * (0.8 + flicker * 0.2);

        gl_FragColor = vec4(color * intensity, alpha);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
}

// Holy Grail Chalice Model component
function ChaliceModel({ scale = 1, position = [0, 0, 0], rotation = [0, 0, 0], isMobile = false }) {
  const modelPath = isMobile ? '/models/holyGrail_MOBILE.glb' : '/models/holyGrail.glb';
  const { scene } = useGLTF(modelPath);
  const meshRef = useRef();
  const flameMaterialRef = useRef(null);
  const coinsRef = useRef([]);

  // Clone scene and set up materials (only once)
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);

    // Clone materials so each instance is independent
    clone.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
      }
    });

    return clone;
  }, [scene]);

  // Set up flame material and find coins once after clone is ready
  useEffect(() => {
    if (!clonedScene) return;

    // Create and apply flame material
    const flameMaterial = createTinyFlameMaterial();
    flameMaterialRef.current = flameMaterial;

    // Find coins and apply flame material
    const foundCoins = [];
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        // Apply flame material to flame meshes (flame, Flame, Flame.001, etc.)
        if (child.name.toLowerCase().startsWith('flame')) {
          child.material = flameMaterial;
        }
        // Collect coin meshes for animation
        if (TUMBLING_COINS.includes(child.name)) {
          const index = TUMBLING_COINS.indexOf(child.name);
          foundCoins.push({
            mesh: child,
            speedX: 0.003 + (index * 0.0005),
            speedY: 0.004 + (index * 0.0003),
            speedZ: 0.002 + (index * 0.0004),
            phase: index * 0.5,
          });
        }
      }
    });
    coinsRef.current = foundCoins;

    return () => {
      flameMaterial.dispose();
    };
  }, [clonedScene]);

  // Animation loop: update flame time uniform and coin rotations
  useFrame((state) => {
    const time = state.clock.elapsedTime;

    // Update flame shader time uniform
    if (flameMaterialRef.current) {
      flameMaterialRef.current.uniforms.uTime.value = time;
    }

    // Tumbling rotation for coins
    coinsRef.current.forEach((coin) => {
      if (coin.mesh) {
        coin.mesh.rotation.x += coin.speedX * (1 + 0.3 * Math.sin(time * 0.5 + coin.phase));
        coin.mesh.rotation.y += coin.speedY * (1 + 0.2 * Math.cos(time * 0.3 + coin.phase));
        coin.mesh.rotation.z += coin.speedZ * (1 + 0.25 * Math.sin(time * 0.4 + coin.phase));
      }
    });
  });

  return (
    <primitive
      ref={meshRef}
      object={clonedScene}
      scale={scale}
      position={position}
      rotation={rotation}
    />
  );
}

// Main exported component
export default function HolyGrailChalice({ isMobile: isMobileProp }) {
  const [clientReady, setClientReady] = useState(false);
  const [isMobileDetected, setIsMobileDetected] = useState(false);

  useEffect(() => {
    // Detect mobile on client
    const checkMobile = () => {
      setIsMobileDetected(window.innerWidth <= 480);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    setClientReady(true);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Use prop if provided, otherwise use detected value
  const isMobile = isMobileProp !== undefined ? isMobileProp : isMobileDetected;

  if (!clientReady) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
      }}>
        <div style={{ color: '#ffd700', fontFamily: 'monospace' }}>Loading...</div>
      </div>
    );
  }

  const chaliceScale = isMobile ? 0.7 : 0.4;
  const chalicePosition = isMobile ? [0, -6.9, -2] : [0, -1.5, -2];
    console.log('isMobile:', isMobile, 'modelPath:', isMobile ? '/models/holyGrail_MOBILE.glb' 
  : '/models/holyGrail.glb'); 

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
        }}
        camera={{
          fov: 45,
          position: [0, 0.6, 5],
          near: 0.1,
          far: 500
        }}
        style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
        }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.3} />
          {/* <spotLight position={[5, 5, 5]} angle={0.5} penumbra={1} intensity={1.5} />
          <pointLight position={[-2, 2, 2]} color="#ffd700" intensity={1} />
          <pointLight position={[2, 2, 2]} color="#ffd700" intensity={1} /> */}

          <ChaliceModel
            key={isMobile ? 'mobile' : 'desktop'}
            scale={chaliceScale}
            position={chalicePosition}
            isMobile={isMobile}
          />

          {/* <OrbitControls
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 1.5}
          /> */}

          <EffectComposer>
            {/* <DepthOfField
              focusDistance={0}
              focalLength={0.02}
              bokehScale={6}
              height={480}
              target={[0, -0.5, -2]}
            /> */}
            <Bloom
              intensity={0.3}
              luminanceThreshold={0.8}
              luminanceSmoothing={0.9}
            />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}

// Preload the models
useGLTF.preload('/models/holyGrail.glb');
useGLTF.preload('/models/holyGrail_MOBILE.glb');
