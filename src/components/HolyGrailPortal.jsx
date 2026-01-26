"use client";

import React, { useRef, useState, useEffect, Suspense } from "react";
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, MeshPortalMaterial, Environment, useTexture, CameraControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { easing } from 'maath';
import DarkClouds from "./Clouds";

// Clipping planes for the model coming through the portal
// These will be set dynamically based on the screen angle
// screenPlane: angled to match the laptop screen tilt (-0.35 rad on x-axis)
const screenAngle = 0.32;
const screenPlane = new THREE.Plane(
  new THREE.Vector3(0, Math.sin(screenAngle), Math.cos(screenAngle)).normalize(),
  -0.09 // More negative = more of the model pokes through
);
// yPlane: clips the bottom to keep it above the keyboard
const yPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.2);

// Holy Grail Model component
function GrailModel({ clip = false, ...props }) {
  const { scene } = useGLTF('/models/ourlady_rider7.glb');
  const meshRef = useRef();

  // Clone scene once and apply clipping/glow hiding as needed
  const clonedScene = React.useMemo(() => {
    const clone = scene.clone();

    clone.traverse((child) => {
      if (child.isMesh) {
        // Log mesh names to help identify glow meshes
 

       
        // Apply clipping planes
        if (clip && child.material) {
          child.material = child.material.clone();
          child.material.clippingPlanes = [screenPlane, yPlane];
          child.material.clipShadows = true;
          child.material.side = THREE.DoubleSide;
          // Render clipped model after portal
          child.renderOrder = 10;
        }
      }
    });

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
      groundColor={'#e100ff'} 
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
      {/* <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[width + 0.15, height + 0.15]} />
        <meshBasicMaterial color="#ffd700" transparent opacity={0.3} />
      </mesh> */}

      {/* Outer glow */}
      {/* <mesh position={[0, 0, -0.02]}>
        <planeGeometry args={[width + 0.3, height + 0.3]} />
        <meshBasicMaterial color="#ffd700" transparent opacity={0.1} />
      </mesh> */}
    </group>
  );
}



// Cyberpunk Laptop Frame component
function LaptopFrame({ children, ...props }) {
  const { scene } = useGLTF('/models/laptop.glb');
  const portalRef = useRef();

  // Clone and hide the original screen mesh
  const clonedScene = React.useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if (child.isMesh && child.name === 'Cube_Screen_0') {
        child.visible = false;
      }
    });
    return clone;
  }, [scene]);

  return (
    <group {...props}>
      {/* The laptop model */}
      <primitive object={clonedScene} scale={0.06} />

      {/* Portal positioned where the screen is - ADJUST THESE VALUES */}
      <mesh position={[0, 0.65, -0.15]} rotation={[-0.35, 0, 0]}>
        <planeGeometry args={[1.45, 1.0]} />
        <MeshPortalMaterial ref={portalRef} side={THREE.DoubleSide} blend={0}>
          {children}
        </MeshPortalMaterial>
      </mesh>
    </group>
  );
}

// Floating hover wrapper
function FloatingGroup({ children, amplitude = 0.06, speed = 1.2, rotationAmplitude = 0.08, rotationSpeed = 0.8 }) {
  const groupRef = useRef();

  useFrame(({ clock }) => {
    if (groupRef.current) {
      const t = clock.getElapsedTime();
      groupRef.current.position.y = Math.sin(t * speed) * amplitude;
      groupRef.current.rotation.y = Math.sin(t * rotationSpeed) * rotationAmplitude;
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

// Main Portal Scene
function PortalScene({ isMobile = false }) {
  const grailScale = isMobile ? 0.7 : 0.7;
  const grailRotation = isMobile ? [0, -3.25, 0] : [0.1, -3.25, 0];

  // Inner model position (inside portal world) - closer to portal plane
  const innerGrailPosition = [0, -0.8, -1.1];
  // Clipped model position - needs to match where inner model appears at portal plane
  const clippedGrailPosition = [0, -0.8, -1.1];

  // Position for clipped model (accounting for LaptopFrame transforms)
  const laptopPos = [0, -0.4, 0];
  const laptopScale = isMobile ? 1.3 : 1.15;
  const portalPos = [0, 0.65, -0.15];

  // Overall rotation to accentuate 3D dimensionality
  const sceneRotation = [0, 0.6, 0]; // Tilt up slightly, rotate to the side

  return (
    <FloatingGroup>
    <group rotation={sceneRotation}>
      {/* The laptop frame with portal screen */}
      <LaptopFrame position={laptopPos} scale={laptopScale}>
        {/* Lighting inside the portal */}
        <hemisphereLight
          skyColor={'#0000ff'}
          groundColor={'#e100ff'}
          intensity={1}
        />
        {/* Clouds in the portal world */}
        <group position={[0, 5.3, -1.3]}>
          <DarkClouds />
        </group>
        {/* The grail model inside the portal (no glow) */}
        <GrailModel
          scale={grailScale}
          position={innerGrailPosition}
          rotation={grailRotation}
          hideGlow={true}
        />
      </LaptopFrame>

      {/* Clipped grail that pokes through the screen (with glow) */}
      <group position={laptopPos} scale={laptopScale}>
        <group position={portalPos} rotation={[-0.35, 0, 0]}>
          <GrailModel
            clip
            scale={grailScale}
            position={clippedGrailPosition}
            rotation={grailRotation}
          />
        </group>
      </group>

      {/* Ambient light to see the laptop model */}
      <ambientLight intensity={0.9} />
      {/* <directionalLight position={[2, 2, 2]} intensity={1} /> */}
    </group>
    </FloatingGroup>
  );
}

// Main exported component
export default function HolyGrailPortal({ isMobile = false }) {
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  // if (!clientReady) {
  //   return (
  //     <div style={{
  //       width: '100%',
  //       height: '100%',
  //       display: 'flex',
  //       alignItems: 'center',
  //       justifyContent: 'center',
  //       background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #000 100%)',
  //     }}>
  //       <div style={{ color: '#ffd700', fontFamily: 'monospace' }}>Loading...</div>
  //     </div>
  //   );
  // }

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
          position: [0, 0.8, 3],
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
          <EffectComposer>
            <Bloom
              intensity={0.4}
              luminanceThreshold={0.9}
              luminanceSmoothing={0.9}
              mipmapBlur
            />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}

// Preload the models
useGLTF.preload('/models/ourlady_rider7.glb');
useGLTF.preload('/models/laptop.glb');
