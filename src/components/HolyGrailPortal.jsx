"use client";

import React, { useRef, useState, useEffect, Suspense } from "react";
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, MeshPortalMaterial, Environment, useTexture, CameraControls } from '@react-three/drei';
import { easing } from 'maath';
import DarkClouds from "./Clouds";

// Clipping planes for the model coming through the portal
// zPlane: normal (0,0,1) with constant 0 means plane at z=0
// This KEEPS z > 0 (toward camera) and CLIPS z < 0 (behind portal)
const zPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
// yPlane: clips the bottom to keep it above the frame edge
const yPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1.2);

// Holy Grail Model component
function GrailModel({ clip = false, ...props }) {
  const { scene } = useGLTF('/models/ourlady_rider7.glb');
  const meshRef = useRef();

  // Gentle floating animation - preserve base rotation
  const baseRotationY = props.rotation?.[1] ?? 0;
  const basePositionY = props.position?.[1] ?? 0;

  // useFrame((state) => {
  //   if (meshRef.current) {
  //     // Add subtle wobble to base rotation
  //     meshRef.current.rotation.y = baseRotationY + Math.sin(state.clock.elapsedTime * 0.3) * 0.05;
  //     // Gentle float up and down
  //     meshRef.current.position.y = basePositionY + Math.sin(state.clock.elapsedTime * 0.5) * 0.03;
  //   }
  // });

  // Clone scene once and apply clipping if needed
  const clonedScene = React.useMemo(() => {
    const clone = scene.clone();

    if (clip) {
      clone.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
          child.material.clippingPlanes = [zPlane, yPlane];
          child.material.clipShadows = true;
          child.material.side = THREE.DoubleSide;
        }
      });
    }

    return clone;
  }, [scene, clip]);

  return (
    <primitive
      ref={meshRef}
      object={clonedScene}
      {...props}
    />
  );
}

// Portal Frame component
function PortalFrame({ children, width = 1.8, height = 2.2, ...props }) {
  const portalRef = useRef();

  return (
    <group {...props}>
      {/* Portal mesh with MeshPortalMaterial */}
      <mesh>
        <planeGeometry args={[width, height]} />
        <MeshPortalMaterial ref={portalRef} side={THREE.DoubleSide} blend={0}>
          {/* Environment inside the portal */}
          {/* <ambientLight intensity={0.5} /> */}
          {/* <spotLight position={[0, 5, 5]} angle={0.5} penumbra={1} intensity={2} /> */}
         <hemisphereLight 
      skyColor={'#0000ff'} 
      groundColor={'#e100ffff'} 
      intensity={1} 
    />
          {/* <pointLight position={[-2, 0, 2]} color="#ffd700" intensity={1.5} />
          <pointLight position={[2, 0, 2]} color="#ffd700" intensity={1.5} />  */}

          {/* Background gradient sphere */}
          {/* <mesh scale={10}>
            <sphereGeometry args={[1, 32, 32]} />
            <meshBasicMaterial side={THREE.BackSide} color="#0a0a1a" />
          </mesh> */}

          {/* Children (the grail model inside portal) */}
          {children}
        </MeshPortalMaterial>
      </mesh>

      {/* Glowing border effect */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[width + 0.15, height + 0.15]} />
        <meshBasicMaterial color="#ffd700" transparent opacity={0.3} />
      </mesh>

      {/* Outer glow */}
      <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[width + 0.3, height + 0.3]} />
        <meshBasicMaterial color="#ffd700" transparent opacity={0.1} />
      </mesh>
    </group>
  );
}

// Gold Frame overlay component (rendered in 3D space)
function GoldFrameOverlay({ width = 2, height = 2.4 }) {
  const texture = useTexture('/images/goldFrame.webp');

  return (
    <mesh position={[0, 0, 0.01]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// Main Portal Scene
function PortalScene({ isMobile = false }) {
  const grailScale = isMobile ? 1.1 : 1.1;
  // Model AT the portal plane (z=0) - only parts extending toward camera will poke through
  const grailPosition = [0, -1.2, -1.67];
  const grailRotation = isMobile ? [0, -3.3, 0] : [0.1, -3.25, 0];

  // Rotate the entire scene slightly for a more dynamic initial view
  const sceneRotation = [0, 0.25, 0];

  return (
    <group rotation={sceneRotation}>
      {/* The portal frame with grail inside (full model visible in portal world) */}
      <PortalFrame position={[0, 0, 0]}>
        {/* Move clouds up to immerse the model */}
        <group position={[0, 5.3, -1.3]}>
          <DarkClouds />
        </group>
        <GrailModel
          scale={grailScale}
          position={grailPosition}
          rotation={grailRotation}
        />
      </PortalFrame>

      {/* The clipped grail - SAME position, clipping shows only what extends toward viewer */}
      <GrailModel
        clip
        scale={grailScale}
        position={grailPosition}
        rotation={grailRotation}
      />
    </group>
  );
}

// Main exported component
export default function HolyGrailPortal({ isMobile = false }) {
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  if (!clientReady) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #000 100%)',
      }}>
        <div style={{ color: '#ffd700', fontFamily: 'monospace' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        gl={{
          localClippingEnabled: true,
          antialias: true,
          alpha: true,
        }}
        camera={{
          fov: 50,
          position: [0, 0, 3],
          near: 0.1,
          far: 100
        }}
        style={{
          width: '100%',
          height: '100%',
          background: 'transparent',
        }}
      >
        <Suspense fallback={null}>
          {/* <ambientLight intensity={0.3} /> */}
          <PortalScene isMobile={isMobile} />
          <CameraControls
            makeDefault
            minAzimuthAngle={-Math.PI / 2.5}
            maxAzimuthAngle={Math.PI / 2.5}
            minPolarAngle={0.5}
            maxPolarAngle={Math.PI / 2}
            minDistance={3}
            maxDistance={3}
            dollySpeed={0}
            truckSpeed={0}
            mouseButtons={{
              left: 1,    // ROTATE
              middle: 0,  // NONE
              right: 0,   // NONE
              wheel: 0,   // NONE - allow page scroll
            }}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

// Preload the model
useGLTF.preload('/models/ourlady_rider7.glb');
