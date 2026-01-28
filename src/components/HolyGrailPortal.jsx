"use client";

import React, { useRef, useState, useEffect, Suspense } from "react";
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, MeshPortalMaterial, Environment, useTexture, CameraControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { easing } from 'maath';
import DarkClouds from "./Clouds";
import BreathSmoke from "./BreathSmoke";
// import { useControls, folder } from 'leva';

// Sky gradient shader for portal background
const SkyGradientMaterial = {
  uniforms: {
    zenithColor: { value: new THREE.Color('#000014') },
    upperColor: { value: new THREE.Color('#0a0040') },
    midColor: { value: new THREE.Color('#2200aa') },
    warmColor: { value: new THREE.Color('#8800cc') },
    horizonColor: { value: new THREE.Color('#ff0066') },
    horizonGlow: { value: new THREE.Color('#ff88aa') },
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 zenithColor;
    uniform vec3 upperColor;
    uniform vec3 midColor;
    uniform vec3 warmColor;
    uniform vec3 horizonColor;
    uniform vec3 horizonGlow;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize(vWorldPosition).y;
      vec3 color;
      if (h > 0.4) {
        // Zenith
        color = mix(upperColor, zenithColor, smoothstep(0.4, 0.9, h));
      } else if (h > 0.1) {
        // Upper to mid sky
        color = mix(midColor, upperColor, smoothstep(0.1, 0.4, h));
      } else if (h > -0.05) {
        // Mid to warm band
        color = mix(warmColor, midColor, smoothstep(-0.05, 0.1, h));
      } else if (h > -0.15) {
        // Warm to horizon
        color = mix(horizonColor, warmColor, smoothstep(-0.15, -0.05, h));
      } else {
        // Below horizon glow
        color = mix(horizonGlow, horizonColor, smoothstep(-0.3, -0.15, h));
      }
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

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
function GrailModel({ clip = false, onBullFound = null, ...props }) {
  const { scene } = useGLTF('/models/ourlady_rider7.glb');
  const meshRef = useRef();

  // Clone scene once and apply clipping as needed
  const clonedScene = React.useMemo(() => {
    const clone = scene.clone();

    clone.traverse((child) => {
      if (child.isMesh) {
        if (clip && child.material) {
          child.material = child.material.clone();
          child.material.clippingPlanes = [screenPlane, yPlane];
          child.material.clipShadows = true;
          child.material.side = THREE.DoubleSide;
          child.renderOrder = 10;
        }
      }
    });

    return clone;
  }, [scene, clip]);

  // Find the bull mesh after the scene is mounted and world matrices are ready
  useEffect(() => {
    if (!onBullFound || !clonedScene) return;
    clonedScene.traverse((child) => {
      if (child.name === 'Bull') {
        onBullFound(child);
      }
    });
  }, [clonedScene, onBullFound]);

  return (
    <primitive
      ref={meshRef}
      object={clonedScene}
      {...props}
    />
  );
}





// Cyberpunk Laptop Frame component
function LaptopFrame({ children, portalBlend = 0, ...props }) {
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
        <MeshPortalMaterial ref={portalRef} side={THREE.DoubleSide} blend={portalBlend}>
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

// Breath smoke that follows the bull mesh in its local space
function BullBreathSmoke({ bullObject, offset = [0, -0.4, 1.4], localScale = 0.1, rotation = [0, 0, 0] }) {
  const groupRef = useRef();
  const _worldPos = useRef(new THREE.Vector3());
  const _worldScale = useRef(new THREE.Vector3());

  useFrame(() => {
    if (bullObject && groupRef.current) {
      // Transform offset from bull's local space to world space
      bullObject.localToWorld(_worldPos.current.set(...offset));
      groupRef.current.position.copy(_worldPos.current);

      // Match the bull's world scale so smoke stays proportional
      bullObject.getWorldScale(_worldScale.current);
      const avgScale = (_worldScale.current.x + _worldScale.current.y + _worldScale.current.z) / 3;
      groupRef.current.scale.setScalar(avgScale * localScale);
    }
  });

  return (
    <group ref={groupRef} rotation={rotation}>
      <BreathSmoke
        name="Left Nostril"
        position={[0, 0, 0]}
        direction={[0.1, -0.3, 2]}
        rotation={[2.6, 2.4, -0.3]}
      />
      <BreathSmoke
        name="Right Nostril"
        position={[0, 0, 0]}
        direction={[-0.1, -0.3, 2]}
        rotation={[2.1, 2.3, 0.7]}
      />
    </group>
  );
}

/* --- Leva debug version (uncomment to re-enable) ---
import { useControls, folder } from 'leva';
function BreathSmokeDebug({ isMobile, bullObject }) {
  const groupRef = useRef();
  const { gx, gy, gz, gScale } = useControls('Nostril Group', {
    gx: { value: 0, min: -20, max: 20, step: 0.1 },
    gy: { value: -0.4, min: -20, max: 20, step: 0.1 },
    gz: { value: 1.4, min: -20, max: 20, step: 0.1 },
    gScale: { value: 0.1, min: 0.01, max: 3, step: 0.01 },
  });
  const left = useControls('Left Nostril', {
    position: folder({ lx: { value: 0, min: -5, max: 5, step: 0.1 }, ly: { value: 0, min: -5, max: 5, step: 0.1 }, lz: { value: 0, min: -5, max: 5, step: 0.1 } }),
    direction: folder({ ldx: { value: 0.1, min: -3, max: 3, step: 0.1 }, ldy: { value: -0.3, min: -3, max: 3, step: 0.1 }, ldz: { value: 2, min: -3, max: 3, step: 0.1 } }),
    rotation: folder({ lrx: { value: 2.6, min: -Math.PI, max: Math.PI, step: 0.1 }, lry: { value: 2.4, min: -Math.PI, max: Math.PI, step: 0.1 }, lrz: { value: -0.3, min: -Math.PI, max: Math.PI, step: 0.1 } }),
  });
  const right = useControls('Right Nostril', {
    position: folder({ rx: { value: 0, min: -5, max: 5, step: 0.1 }, ry: { value: 0, min: -5, max: 5, step: 0.1 }, rz: { value: 0, min: -5, max: 5, step: 0.1 } }),
    direction: folder({ rdx: { value: -0.1, min: -3, max: 3, step: 0.1 }, rdy: { value: -0.3, min: -3, max: 3, step: 0.1 }, rdz: { value: 2, min: -3, max: 3, step: 0.1 } }),
    rotation: folder({ rrx: { value: 2.1, min: -Math.PI, max: Math.PI, step: 0.1 }, rry: { value: 2.3, min: -Math.PI, max: Math.PI, step: 0.1 }, rrz: { value: 0.7, min: -Math.PI, max: Math.PI, step: 0.1 } }),
  });
  useFrame(() => {
    if (bullObject && groupRef.current) {
      const worldPos = new THREE.Vector3();
      bullObject.getWorldPosition(worldPos);
      groupRef.current.position.set(worldPos.x + gx, worldPos.y + gy, worldPos.z + gz);
    }
  });
  useEffect(() => {
    if (bullObject) { const wp = new THREE.Vector3(); bullObject.getWorldPosition(wp); console.log(`Bull world position: [${wp.x.toFixed(2)}, ${wp.y.toFixed(2)}, ${wp.z.toFixed(2)}]`); }
    console.log(`Group offset: [${gx}, ${gy}, ${gz}], scale: ${gScale}`);
  }, [gx, gy, gz, gScale, left, right, bullObject]);
  return (
    <group ref={groupRef} scale={gScale}>
      <mesh><sphereGeometry args={[5, 16, 16]} /><meshBasicMaterial color="magenta" wireframe /></mesh>
      <BreathSmoke name="Left Nostril" position={[left.lx, left.ly, left.lz]} direction={[left.ldx, left.ldy, left.ldz]} rotation={[left.lrx, left.lry, left.lrz]} />
      <BreathSmoke name="Right Nostril" position={[right.rx, right.ry, right.rz]} direction={[right.rdx, right.rdy, right.rdz]} rotation={[right.rrx, right.rry, right.rrz]} />
    </group>
  );
}
--- end leva debug version */

// Main Portal Scene
function PortalScene({ isMobile = false }) {
  const [bullObject, setBullObject] = useState(null);
  const [clippedBullObject, setClippedBullObject] = useState(null);
  const grailScale = isMobile ? 0.65 : 0.65;
  const grailRotation = isMobile ? [0, -3.25, 0] : [0.1, -3.25, 0];

  // Inner model position (inside portal world) - closer to portal plane
  const innerGrailPosition = [0, -0.7, -1.1];
  // Clipped model position - needs to match where inner model appears at portal plane
  const clippedGrailPosition = [0, -0.7, -1.1];

  // Position for clipped model (accounting for LaptopFrame transforms)
  const laptopPos = [0, -0.4, 0];
  const laptopScale = isMobile ? 1.3 : 1.15;
  const portalPos = [0, 0.65, -0.15];

  // Overall rotation to accentuate 3D dimensionality
  const sceneRotation = [0, 0.6, 0]; // Tilt up slightly, rotate to the side

  return (
    <group>
    <FloatingGroup>
    <group rotation={sceneRotation}>
      {/* The laptop frame with portal screen */}
      <LaptopFrame position={laptopPos} scale={laptopScale}>
        {/* Sky gradient background inside the portal */}
        <mesh scale={20}>
          <sphereGeometry args={[1, 64, 64]} />
          <shaderMaterial
            attach="material"
            args={[SkyGradientMaterial]}
            side={THREE.BackSide}
            toneMapped={false}
          />
        </mesh>
        {/* Lighting inside the portal */}
        <hemisphereLight
          skyColor={'#0000ff'}
          groundColor={'#e100ff'}
          intensity={1}
        />
        {/* Clouds in the portal world */}
        <group position={[1.5, 6.3, -1.7]}>
          <DarkClouds />
        </group>
        {/* The grail model inside the portal (no glow) */}
        <GrailModel
          scale={grailScale}
          position={innerGrailPosition}
          rotation={grailRotation}
          hideGlow={true}
          onBullFound={setBullObject}
        />
        <BullBreathSmoke bullObject={bullObject} offset={isMobile ? [-0.05, -0.2, 0.4] : [0, -0.4, 0.4]} />
      </LaptopFrame>

      {/* Clipped grail that pokes through the screen (with glow) */}
      <group position={laptopPos} scale={laptopScale}>
        <group position={portalPos} rotation={[-0.35, 0, 0]}>
          <GrailModel
            clip
            scale={grailScale}
            position={clippedGrailPosition}
            rotation={grailRotation}
            onBullFound={setClippedBullObject}
          />
        </group>
      </group>

      {/* Ambient light to see the laptop model */}
      <ambientLight intensity={0.7} />
      {/* <directionalLight position={[2, 2, 2]} intensity={1} /> */}
    </group>
    </FloatingGroup>
    {/* Clipped breath smoke — outside FloatingGroup to avoid double hover */}
    <BullBreathSmoke bullObject={clippedBullObject} offset={isMobile ? [0.0, 0.82, 1.38] : [-0.01, 0.77, 1.4] }  rotation={[0, 0.45, 0]}/>
    </group>
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
                 radius={0.4}
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
