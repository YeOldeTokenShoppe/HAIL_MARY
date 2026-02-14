'use client';

import { Suspense, useRef, useMemo, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import CleanCanvas from '@/components/CleanCanvas';
import HolographicStatue3 from '@/components/HolographicStatue3';

// --- Placeholder words (replace with Firebase data later) ---
const PLACEHOLDER_WORDS = [
  '✨ blessed', '🕯️ light', '🔥 fire', '💫 cosmic', '🌟 shine',
  '⭐ glow', '🌙 luna', '☀️ sol', '💎 gem', '🪐 orbit',
  '🚀 launch', 
  '💥 boom',  '🍀 luck', '🦋 morph', '🎯 focus',
  'RL80', 'HODL', 'wagmi', 'gm', 'based',
  'moon', 'degen', 'alpha', 'bullish', 'vibes',
  'candle', 'shrine', 'prayer', 'light it up', 'blessed be',
  'to the moon', 'diamond hands', 'lets go', 'believe', 'manifest',
  'power', 'energy', 'spirit', 'flame', 'radiant',
  'eternal', 'sacred', 'divine', 'cosmic', 'infinite',
  'transcend', 'illuminate', 'ascend', 'harmony', 'unity',
  '🕯️', '🔥', '✨',
];

// --- Canvas texture generators ---
function createGlowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(0, 255, 255, 0.7)');
  gradient.addColorStop(0.3, 'rgba(0, 200, 220, 0.35)');
  gradient.addColorStop(0.6, 'rgba(0, 150, 180, 0.12)');
  gradient.addColorStop(1, 'rgba(0, 100, 130, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}


const GLOW_COLORS = [
  '#ff66ff', '#66ccff', '#ffd36b', '#ff9966', '#8df59a',
  '#ffa0f8', '#c6a7ff', '#ff4444', '#44ff99', '#99ccff',
];

function createWordTexture(text, colorIndex = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 60px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.shadowColor = GLOW_COLORS[colorIndex % GLOW_COLORS.length];
  ctx.shadowBlur = 30;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.userData = { aspect: canvas.width / canvas.height };
  return texture;
}

// --- Stars ---
function Stars({ count = 2000 }) {
  const ref = useRef();
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 80 + Math.random() * 120;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i * 3 + 2] = r * Math.cos(phi);
    }
    return arr;
  }, [count]);

  const sizes = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      arr[i] = 0.3 + Math.random() * 0.7;
    }
    return arr;
  }, [count]);

  // Stars are static like the source

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          array={sizes}
          count={count}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#ffe8c0"
        size={0.5}
        sizeAttenuation
        transparent
        opacity={0.8}
      />
    </points>
  );
}

// --- Large Glow Sprite ---
function GlowSprite() {
  const ref = useRef();
  const texture = useMemo(() => createGlowTexture(), []);

  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.getElapsedTime();
      const s = 35 + Math.sin(t * 0.4) * 3;
      ref.current.scale.set(s, s, 1);
    }
  });

  return (
    <sprite ref={ref} scale={[60, 60, 1]} renderOrder={-1}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  );
}

// --- Arctic Orbit Rings (persistent looping arctic ring effect) ---
const ARCTIC_RING_COLORS = [
  new THREE.Color(0x00ffff),  // Cyan
  new THREE.Color(0x87ceeb),  // Sky blue
  new THREE.Color(0xffffff),  // White
  new THREE.Color(0x00ff66),  // Bright green
  new THREE.Color(0xff00ff),  // Magenta
  new THREE.Color(0x00ffff),  // Cyan again
  new THREE.Color(0x87ceeb),  // Sky blue again
];

function ArcticOrbitRings({ ringCount = 7, baseRadius = 3, speed = 0.3 }) {
  const groupRef = useRef();

  // Create ring data with staggered phases so they loop continuously
  const ringData = useMemo(() => {
    return Array.from({ length: ringCount }, (_, i) => ({
      color: ARCTIC_RING_COLORS[i % ARCTIC_RING_COLORS.length],
      innerRadius: baseRadius + i * 0.3,
      thickness: 0.06 + Math.random() * 0.04,
      phaseOffset: i / ringCount,        // Stagger so rings are always at different stages
      speedMult: 0.8 + Math.random() * 0.4,
      rotSpeed: (Math.random() - 0.5) * 0.003,  // Subtle z-rotation
    }));
  }, [ringCount, baseRadius]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime() * speed;

    groupRef.current.children.forEach((ring, i) => {
      const data = ringData[i];
      if (!data || !ring) return;

      // Looping phase: 0 → 1 → 0 → 1...
      const phase = (t * data.speedMult + data.phaseOffset) % 1;

      // Scale expands over the cycle
      const expandScale = 1 + phase * 1.8;
      ring.scale.set(expandScale, expandScale, 1);

      // Opacity: fade in then fade out over the cycle
      const fadeIn = Math.min(phase * 4, 1);          // Quick fade in (0-25%)
      const fadeOut = Math.max(1 - (phase - 0.5) * 2, 0); // Fade out (50-100%)
      ring.material.opacity = fadeIn * fadeOut * 0.6;

      // Gentle rotation
      ring.rotation.z += data.rotSpeed;
    });
  });

  return (
    <group ref={groupRef}>
      {ringData.map((data, i) => (
        <mesh key={i} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[data.innerRadius, data.innerRadius + data.thickness, 64]} />
          <meshBasicMaterial
            color={data.color}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// --- Floating Words ---
function FloatingWords({ words = PLACEHOLDER_WORDS }) {
  const groupRef = useRef();

  // Multiply words like source (6 copies)
  const allWords = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 2; i++) arr.push(...words);
    return arr;
  }, [words]);

  const wordData = useMemo(() => {
    return allWords.map((text, i) => {
      const texture = createWordTexture(text, i);
      const aspect = texture.userData?.aspect || 4;
      // Cube-root distribution for even volume fill → uniform ball shape
      // Re-roll if word lands too close to statue base region
      const minR = 12;
      const maxR = 25;
      let r, phi, theta, y;
      do {
        r = minR + (maxR - minR) * Math.cbrt(Math.random());
        // Bias upward: shift distribution so fewer words fall below equator
        phi = Math.acos(2 * Math.random() * 0.8 - 0.6); // range ~[-0.6, 1.0] biases upper hemisphere
        theta = Math.random() * Math.PI * 2;
        y = r * Math.cos(phi);
      } while (Math.abs(y) < 4 && r < 18); // Exclude band near statue body
      return {
        texture,
        aspect,
        radius: r,
        phi,
        theta,
        speed: 0.1 + Math.random() * 0.01,
        scale: 1.8 + Math.random() * 1,
      };
    });
  }, [allWords]);

  useEffect(() => {
    return () => {
      wordData.forEach((d) => d.texture.dispose());
    };
  }, [wordData]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.children.forEach((sprite, i) => {
      const d = wordData[i];
      if (!d) return;
      const angle = d.theta + t * d.speed;
      sprite.position.x = d.radius * Math.sin(d.phi) * Math.cos(angle);
      sprite.position.y = d.radius * Math.cos(d.phi); // fixed Y — no vertical drift
      sprite.position.z = d.radius * Math.sin(d.phi) * Math.sin(angle);
      sprite.material.opacity = 0.8 + 0.2 * Math.sin(t * 2); // unified gentle pulse
    });
  });

  return (
    <group ref={groupRef}>
      {wordData.map((d, i) => (
        <sprite key={i} scale={[d.scale * d.aspect, d.scale, 1]}>
          <spriteMaterial map={d.texture} transparent opacity={0.7} depthWrite={false} depthTest={true}  />
        </sprite>
      ))}
    </group>
  );
}

// --- Camera Controller ---
function CameraController() {
  const { camera, gl } = useThree();
  const spherical = useRef(new THREE.Spherical(30, Math.PI / 2, 0));
  const isDragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const targetSpherical = useRef(new THREE.Spherical(30, Math.PI / 2, 0));

  const onPointerDown = useCallback((e) => {
    isDragging.current = true;
    lastPointer.current = { x: e.clientX || e.touches?.[0]?.clientX || 0, y: e.clientY || e.touches?.[0]?.clientY || 0 };
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!isDragging.current) return;
    const x = e.clientX || e.touches?.[0]?.clientX || 0;
    const y = e.clientY || e.touches?.[0]?.clientY || 0;
    const dx = x - lastPointer.current.x;
    const dy = y - lastPointer.current.y;
    targetSpherical.current.theta -= dx * 0.005;
    targetSpherical.current.phi = Math.max(0.2, Math.min(Math.PI - 0.2, targetSpherical.current.phi - dy * 0.005));
    lastPointer.current = { x, y };
  }, []);

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const onWheel = useCallback((e) => {
    targetSpherical.current.radius = Math.max(10, Math.min(80, targetSpherical.current.radius + e.deltaY * 0.05));
  }, []);

  useEffect(() => {
    const el = gl.domElement;
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointerleave', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointerleave', onPointerUp);
      el.removeEventListener('wheel', onWheel);
    };
  }, [gl, onPointerDown, onPointerMove, onPointerUp, onWheel]);

  useFrame(() => {
    // Lerp toward target
    spherical.current.radius += (targetSpherical.current.radius - spherical.current.radius) * 0.05;
    spherical.current.theta += (targetSpherical.current.theta - spherical.current.theta) * 0.05;
    spherical.current.phi += (targetSpherical.current.phi - spherical.current.phi) * 0.05;

    const pos = new THREE.Vector3().setFromSpherical(spherical.current);
    camera.position.copy(pos);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

// --- Gentle hover bob for statue + rings ---
function HoverGroup({ position = [0, 0, 0], children }) {
  const ref = useRef();
  const baseY = position[1];

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.position.y = baseY + Math.sin(clock.getElapsedTime() * 0.5) * 0.3;
    }
  });

  return (
    <group ref={ref} position={position}>
      {children}
    </group>
  );
}

// --- Scene ---
function Scene() {
  return (
    <>
      <color attach="background" args={['#000000']} />
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 0, 0]} intensity={2} color="#00cccc" distance={50} />
      {/* Subtle warm core light — breaks the monochromatic teal, adds depth */}
      <pointLight position={[0, -1, 2]} intensity={0.6} color="#ffaa66" distance={20} decay={2} />
      <Stars />
      <Suspense fallback={null}>
        <HolographicStatue3
          position={[0, -2, 0]}
          scale={[15, 15, 15]}
          rotation={[0, 0 , 0]}
          hover={true}
          rotate={false}
        />
      </Suspense>
      <GlowSprite />
      <HoverGroup position={[0, -2, 0]}>
        <ArcticOrbitRings ringCount={7} baseRadius={3} speed={0.3} />
      </HoverGroup>
      <FloatingWords />
      <CameraController />
    </>
  );
}

// --- Main Export ---
export default function CosmicOrbit() {
  return (
    <CleanCanvas
      camera={{ fov: 60, near: 0.1, far: 500, position: [0, 0, 20] }}
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: false }}
    >
      <Scene />
    </CleanCanvas>
  );
}
