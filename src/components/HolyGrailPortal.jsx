"use client";

import React, { useRef, useState, useEffect, Suspense } from "react";
import { createPortal } from "react-dom";
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, MeshPortalMaterial, Environment, CameraControls, Text, useProgress } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { easing } from 'maath';
import DarkClouds from "./Clouds";
import BreathSmoke from "./BreathSmoke";
import ThirdwebBuyModal from './ThirdwebBuyModal';
// import { useControls, folder } from 'leva';

// CRT transition shader for screen toggle effect
const CRTTransitionMaterial = {
  uniforms: {
    transition: { value: 0.0 },
    time: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float transition;
    uniform float time;
    varying vec2 vUv;

    float random(vec2 st) {
      return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    }

    void main() {
      vec2 uv = vUv;

      // Scanlines
      float scanline = sin(uv.y * 400.0 + time * 10.0) * 0.15;

      // Static noise
      float noise = random(uv * time) * 0.5;

      // CRT glow color (cyan/white)
      vec3 crtColor = vec3(0.4, 0.9, 1.0);

      // Bright horizontal line sweep
      float sweepPos = fract(time * 2.0);
      float sweep = smoothstep(sweepPos - 0.05, sweepPos, uv.y) * smoothstep(sweepPos + 0.05, sweepPos, uv.y);
      sweep *= 3.0;

      // Combine effects
      vec3 finalColor = crtColor * (noise + scanline + sweep);

      // Overall intensity based on transition (peaks at 0.5)
      float intensity = sin(transition * 3.14159);

      gl_FragColor = vec4(finalColor * intensity, intensity * 0.8);
    }
  `,
};

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

// CRT Background component with radial gradient effect
function CRTBackground() {
  return (
    <mesh position={[0, 0, 0.7]}>
      <planeGeometry args={[10, 10]} />
      <shaderMaterial
        uniforms={{
          darkGreen: { value: new THREE.Color('#0a1f0a') },
          black: { value: new THREE.Color('#000000') },
        }}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 darkGreen;
          uniform vec3 black;
          varying vec2 vUv;

          void main() {
            // Center the UV coordinates
            vec2 center = vUv - 0.5;

            // Radial distance from center
            float dist = length(center) * 2.0;

            // Radial gradient from dark green center to black edges
            vec3 color = mix(darkGreen, black, smoothstep(0.0, 1.0, dist));

            // Inner shadow/vignette effect
            float vignette = 1.0 - smoothstep(0.3, 1.2, dist);
            color *= mix(0.3, 1.0, vignette);

            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}

// Clipping planes for the model coming through the portal
// screenPlane is updated dynamically each frame to follow the screen mesh
const screenPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
// yPlane: clips the bottom to keep it above the keyboard
const yPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.2);
// Offset to control how much of the model pokes through the screen
const FRONT_OFFSET = 0.05;

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
function LaptopFrame({ children, portalBlend = 0, screenRef, onKeyPress, onScreenClick, ...props }) {
  const { scene } = useGLTF('/models/laptop.glb');
  const portalRef = useRef();
  const keyMaterialsRef = useRef([]);

  // Clone and hide original screen
  const clonedScene = React.useMemo(() => {
    const clone = scene.clone();
    clone.traverse((child) => {
      if (child.isMesh && child.name === 'Cube_Screen_0') {
        child.visible = false;
      }
    });
    return clone;
  }, [scene]);

  // Set up green key after mount
  useEffect(() => {
    if (!clonedScene) return;

    const materials = [];
    clonedScene.traverse((child) => {
      if (child.isMesh && child.name === 'GreenKey1') {
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: new THREE.Color('#00ff00'),
          toneMapped: false, // Prevents tone mapping from dimming the color
        });
        child.material = glowMaterial;
        materials.push(glowMaterial);
      }
    });
    keyMaterialsRef.current = materials;
  }, [clonedScene]);

  // Pulse the green keys - animate color directly for reliable cross-device rendering
  useFrame(({ clock }) => {
    const materials = keyMaterialsRef.current;
    if (materials.length === 0) return;

    const t = clock.getElapsedTime();
    const pulse = (Math.sin(t * 4) + 1) / 2; // 0 to 1 pulse

    // Animate between dark green and bright green
    const r = pulse * 0.2;
    const g = 0.4 + pulse * 0.6; // 0.4 to 1.0
    const b = pulse * 0.2;

    materials.forEach((mat) => {
      mat.color.setRGB(r, g, b);
    });
  });

  // Handle click on the laptop - check if it's the green key or hit areas
  const handleClick = (e) => {
    if (e.object?.name === 'GreenKey1' || e.object?.name === 'GreenKeyHitArea' || e.object?.name === 'ExtendedButtonArea') {
      e.stopPropagation();
      onKeyPress?.();
    }
  };

  return (
    <group {...props}>
      {/* The laptop model with click detection */}
      <group onPointerDown={handleClick} onClick={handleClick}>
        <primitive object={clonedScene} scale={0.06} />
      </group>
      {/* Larger hit area for the green key - use tiny opacity for reliable raycasting */}
      <mesh
        name="GreenKeyHitArea"
        position={[-0.52, 0.02, 0.32]}
        onPointerDown={(e) => {
          e.stopPropagation();
          onKeyPress?.();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onKeyPress?.();
        }}
      >
        <boxGeometry args={[0.18, 0.08, 0.18]} />
        <meshBasicMaterial transparent opacity={0.001} depthWrite={false} />
      </mesh>

      {/* Portal positioned where the screen is */}
      <mesh
        ref={screenRef}
        position={[0, 0.65, -0.15]}
        rotation={[-0.35, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onScreenClick?.();
        }}
      >
        <planeGeometry args={[1.45, 1.0]} />
        <MeshPortalMaterial ref={portalRef} side={THREE.DoubleSide} blend={portalBlend}>
          {children}
        </MeshPortalMaterial>
      </mesh>
    </group>
  );
}

// Floating hover wrapper
function FloatingGroup({ children, amplitude = 0.0, speed = 1.2, rotationAmplitude = 0.02, rotationSpeed = 0.8 }) {
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

// CRT Screen with typing effect
const crtTextSequence = [
  { text: '> ESTABLISHING CONNECTION...', type: 'command', delay: 800 },
  { text: '> RECEIVING TRANSMISSION...', type: 'command', delay: 1000 },
  { text: '', type: 'pause', delay: 1000 },
  { text: 'RL80 CORE MODULE:', type: 'header', delay: 800 },
  { text: '', type: 'pause', delay: 400 },
  { text: "We are trustless....", type: 'body', delay: 600 },
  { text: 'but we believe in', type: 'body', delay: 600 },
  { text: '', type: 'pause', delay: 300 },
  { text: 'Code and cryptography', type: 'body', delay: 500 },
  { text: 'purity in circuitry', type: 'body', delay: 600 },
  { text: '', type: 'pause', delay: 300 },
  { text: 'Virtue over villainy and', type: 'body', delay: 1000 },
  { text: 'The Virtual machine', type: 'body', delay: 600 },
  { text: '', type: 'pause', delay: 1200 },
  { text: 'Mater ex machina', type: 'highlight', delay: 3000 },
  { text: 'Incorruptible integrity', type: 'body', delay: 600 },
  // { text: 'And fairness.', type: 'body', delay: 800 },
  { text: '', type: 'pause', delay: 400 },
  { text: 'An avatar of resistance', type: 'body', delay: 100 },
  { text: 'in a market built to break you.', type: 'body', delay: 1200 },
  { text: '', type: 'pause', delay: 600 },
  { text: '> HOLD RL80 IN YOUR WALLET', type: 'command', delay: 600 },
  { text: '> AS A ROSARY FOR PROSPERITY', type: 'command', delay: 0 },
];

// Fullscreen CRT Overlay for mobile
function FullscreenCRTOverlay({ isActive, onClose, onBuyClick, onLineComplete }) {
  const [displayedLines, setDisplayedLines] = useState([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [buttonPulse, setButtonPulse] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef(null);

  // Handle fade in/out
  useEffect(() => {
    if (isActive) {
      // Small delay before fade in for smoother transition from zoom
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isActive]);

  // Reset animation when becoming active
  useEffect(() => {
    if (isActive) {
      setDisplayedLines([]);
      setCurrentLineIndex(0);
      setCurrentCharIndex(0);
      setAnimationComplete(false);
      const timer = setTimeout(() => {
        setIsTyping(true);
      }, 800);
      return () => clearTimeout(timer);
    } else {
      setIsTyping(false);
      setDisplayedLines([]);
      setCurrentLineIndex(0);
      setCurrentCharIndex(0);
      setAnimationComplete(false);
    }
  }, [isActive]);


  // Detect when animation is complete
  useEffect(() => {
    if (currentLineIndex >= crtTextSequence.length && !animationComplete) {
      const timer = setTimeout(() => {
        setAnimationComplete(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [currentLineIndex, animationComplete]);

  // Button pulse animation
  useEffect(() => {
    if (!animationComplete) return;
    const interval = setInterval(() => {
      setButtonPulse(p => (p + 0.1) % (Math.PI * 2));
    }, 50);
    return () => clearInterval(interval);
  }, [animationComplete]);

  // Typing effect
  useEffect(() => {
    if (!isTyping || currentLineIndex >= crtTextSequence.length) {
      return;
    }

    const currentLine = crtTextSequence[currentLineIndex];
    const typingSpeed = currentLine.type === 'command' ? 25 : 35;

    if (currentLine.type === 'pause') {
      const timer = setTimeout(() => {
        setDisplayedLines(prev => [...prev, { text: '', type: 'pause' }]);
        setCurrentLineIndex(prev => prev + 1);
        setCurrentCharIndex(0);
      }, currentLine.delay);
      return () => clearTimeout(timer);
    }

    if (currentCharIndex < currentLine.text.length) {
      const timer = setTimeout(() => {
        setCurrentCharIndex(prev => prev + 1);
      }, typingSpeed);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setDisplayedLines(prev => [...prev, { text: currentLine.text, type: currentLine.type }]);
      setCurrentLineIndex(prev => prev + 1);
      setCurrentCharIndex(0);
      onLineComplete?.(); // Play sound for each line
    }, currentLine.delay);

    return () => clearTimeout(timer);
  }, [isTyping, currentLineIndex, currentCharIndex, onLineComplete]);

  // Blinking cursor
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayedLines, currentCharIndex]);

  const currentLine = crtTextSequence[currentLineIndex];
  const typingText = currentLine && currentLine.type !== 'pause'
    ? currentLine.text.slice(0, currentCharIndex)
    : '';

  const getColor = (type) => {
    switch (type) {
      case 'command': return '#00ffaa';
      case 'header': return '#ffff00';
      case 'highlight': return '#ff00ff';
      default: return '#00ff88';
    }
  };

  const getFontSize = (type) => {
    switch (type) {
      case 'header': return '1.4rem';
      case 'command': return '1.1rem';
      default: return '1.2rem';
    }
  };

  if (!isActive) return null;

  const pulseValue = (Math.sin(buttonPulse) + 1) / 2;

  return (
    <div
      onClick={(e) => {
        // Only close if clicking the background, not buttons
        if (e.target === e.currentTarget) {
          onClose?.();
        }
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: 'radial-gradient(ellipse at center, #0a1f0a 0%, #000000 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        fontFamily: "'Courier New', 'Orbitron', monospace",
        overflow: 'hidden',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 0.4s ease-in-out',
      }}
    >
      {/* Scanline overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.15) 0px, rgba(0,0,0,0.15) 1px, transparent 1px, transparent 2px)',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* CRT flicker effect */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%)',
        pointerEvents: 'none',
        zIndex: 2,
      }} />

      {/* Screen content container */}
      <div style={{
        position: 'relative',
        width: '95%',
        maxWidth: '800px',
        height: '90%',
        maxHeight: '900px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 3,
      }}>
        {/* Terminal header */}
        <div style={{
          padding: '0.5rem 1rem',
          color: '#00ff66',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          opacity: 0.7,
        }}>
          <span>RL80 TERMINAL v1.0</span>
          <span style={{ opacity: 0.6 }}>SECURE CONNECTION</span>
        </div>

        {/* Content area */}
        <div
          ref={containerRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            padding: '1rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.3rem',
          }}
        >
          {/* Rendered lines */}
          {displayedLines.map((line, index) => {
            if (line.type === 'pause') {
              return <div key={index} style={{ height: '0.5rem' }} />;
            }
            return (
              <div
                key={index}
                style={{
                  color: getColor(line.type),
                  fontSize: getFontSize(line.type),
                  lineHeight: 1.4,
                  textShadow: `0 0 10px ${getColor(line.type)}`,
                }}
              >
                {line.text}
              </div>
            );
          })}

          {/* Current typing line */}
          {currentLine && currentLine.type !== 'pause' && currentLineIndex < crtTextSequence.length && (
            <div style={{
              color: getColor(currentLine.type),
              fontSize: getFontSize(currentLine.type),
              lineHeight: 1.4,
              textShadow: `0 0 10px ${getColor(currentLine.type)}`,
            }}>
              {typingText}{showCursor ? '█' : ' '}
            </div>
          )}
        </div>

        {/* Button area */}
        {animationComplete && (
          <div style={{
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1rem',
          }}>
            {/* Buy button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBuyClick?.();
              }}
              style={{
                background: `rgba(0, 68, 34, ${0.6 + pulseValue * 0.4})`,
                border: '2px solid #00ff66',
                borderRadius: '4px',
                padding: '0.75rem 2rem',
                color: '#00ffaa',
                fontSize: '1rem',
                fontFamily: "'Courier New', monospace",
                fontWeight: 'bold',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                boxShadow: `0 0 ${10 + pulseValue * 10}px rgba(0, 255, 102, ${0.3 + pulseValue * 0.3})`,
                transition: 'all 0.2s',
              }}
            >
              BUY RL80
            </button>

            {/* Exit hint */}
            <div style={{
              color: '#00ff66',
              fontSize: '0.75rem',
              opacity: 0.7,
              letterSpacing: '0.05em',
            }}>
              {'> tap anywhere to return'}{showCursor ? '_' : ' '}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// CRT Screen component with typing animation
function CRTScreen({ width = 2, height = 1.4, isActive = true, noBackground = false, onButtonClick, buttonText = "ENTER THE PORTAL", onLineComplete, textScale = 1, ...props }) {
  const [displayedLines, setDisplayedLines] = useState([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [showCursor, setShowCursor] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [animationComplete, setAnimationComplete] = useState(false);
  const [buttonHovered, setButtonHovered] = useState(false);
  const [buttonPulse, setButtonPulse] = useState(0);

  const lineHeight = 0.05 * textScale;
  const fontSize = 0.042 * textScale;
  // Start scrolling earlier to leave room for button at bottom
  const scrollThreshold = 8;
  // Bottom clipping - leave space for button
  const bottomClip = -height / 2 + 0.18 * textScale;

  // Reset animation when becoming active
  useEffect(() => {
    if (isActive) {
      setDisplayedLines([]);
      setCurrentLineIndex(0);
      setCurrentCharIndex(0);
      setScrollOffset(0);
      setAnimationComplete(false);
      // Delay before starting typing to let transmission effects play
      const timer = setTimeout(() => {
        setIsTyping(true);
      }, 1500); // 1.5 second delay
      return () => clearTimeout(timer);
    } else {
      setIsTyping(false);
    }
  }, [isActive]);

  // Detect when animation is complete
  useEffect(() => {
    if (currentLineIndex >= crtTextSequence.length && !animationComplete) {
      // Small delay before showing button
      const timer = setTimeout(() => {
        setAnimationComplete(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [currentLineIndex, animationComplete]);

  // Button pulse animation
  useFrame(({ clock }) => {
    if (animationComplete) {
      setButtonPulse((Math.sin(clock.getElapsedTime() * 3) + 1) / 2);
    }
  });

  // Typing effect
  useEffect(() => {
    if (!isTyping || currentLineIndex >= crtTextSequence.length) {
      return;
    }

    const currentLine = crtTextSequence[currentLineIndex];
    const typingSpeed = currentLine.type === 'command' ? 25 : 35;

    // If it's a pause, wait then move to next line
    if (currentLine.type === 'pause') {
      const timer = setTimeout(() => {
        setDisplayedLines(prev => {
          const newLines = [...prev, { text: '', type: 'pause' }];
          // Scroll up if we exceed visible lines
          if (newLines.filter(l => l.type !== 'pause').length > scrollThreshold) {
            setScrollOffset(off => off + lineHeight);
          }
          return newLines;
        });
        setCurrentLineIndex(prev => prev + 1);
        setCurrentCharIndex(0);
      }, currentLine.delay);
      return () => clearTimeout(timer);
    }

    // If we haven't finished typing the current line
    if (currentCharIndex < currentLine.text.length) {
      const timer = setTimeout(() => {
        setCurrentCharIndex(prev => prev + 1);
      }, typingSpeed);
      return () => clearTimeout(timer);
    }

    // Line finished, wait then move to next
    const timer = setTimeout(() => {
      setDisplayedLines(prev => {
        const newLines = [...prev, { text: currentLine.text, type: currentLine.type }];
        // Scroll up if we exceed visible lines
        const textLines = newLines.filter(l => l.type !== 'pause').length;
        if (textLines > scrollThreshold) {
          setScrollOffset(off => off + lineHeight);
        }
        return newLines;
      });
      setCurrentLineIndex(prev => prev + 1);
      setCurrentCharIndex(0);
      onLineComplete?.(); // Play sound for each line
    }, currentLine.delay);

    return () => clearTimeout(timer);
  }, [isTyping, currentLineIndex, currentCharIndex, scrollThreshold, onLineComplete]);

  // Blinking cursor
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, []);

  // Get current typing line
  const currentLine = crtTextSequence[currentLineIndex];
  const typingText = currentLine && currentLine.type !== 'pause'
    ? currentLine.text.slice(0, currentCharIndex)
    : '';

  // Calculate line positions with scroll
  let lineIndex = 0;
  const getLineY = () => {
    const y = height / 2 - 0.06 - (lineIndex * lineHeight) + scrollOffset;
    lineIndex++;
    return y;
  };

  const getColor = (type) => {
    switch (type) {
      case 'command': return '#00ffaa';
      case 'header': return '#ffff00';
      case 'highlight': return '#ff00ff';
      default: return '#00ff88';
    }
  };

  const getFontSize = (type) => {
    switch (type) {
      case 'header': return fontSize * 1.2;
      case 'command': return fontSize * 0.9;
      default: return fontSize;
    }
  };

  return (
    <group {...props}>
      {/* Solid black background - small plane behind text only */}
      {!noBackground && (
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[width * 0.95, height * 0.95]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.9} />
        </mesh>
      )}

      {/* Render completed lines */}
      {displayedLines.map((line, index) => {
        if (line.type === 'pause') {
          lineIndex++; // Still increment for spacing
          return null;
        }

        const y = height / 2 - 0.06 - (lineIndex * lineHeight) + scrollOffset;
        lineIndex++;

        // Don't render lines that have scrolled off screen or below button area
        if (y > height / 2 || y < bottomClip) return null;

        return (
          <Text
            key={index}
            position={[-width / 2 + 0.08, y, 0.02]}
            fontSize={getFontSize(line.type)}
            color={getColor(line.type)}
            anchorX="left"
            anchorY="top"
            font="/fonts/Orbitron.ttf"
            maxWidth={width - 0.16}
            renderOrder={2}
          >
            {line.text}
          </Text>
        );
      })}

      {/* Current typing line with cursor */}
      {currentLine && currentLine.type !== 'pause' && currentLineIndex < crtTextSequence.length && (
        <Text
          position={[-width / 2 + 0.08, height / 2 - 0.06 - (lineIndex * lineHeight) + scrollOffset, 0.02]}
          fontSize={getFontSize(currentLine.type)}
          color={getColor(currentLine.type)}
          anchorX="left"
          anchorY="top"
          font="/fonts/Orbitron.ttf"
          maxWidth={width - 0.16}
          renderOrder={2}
        >
          {typingText}{showCursor ? '█' : ' '}
        </Text>
      )}

      {/* Clickable button after animation completes */}
      {animationComplete && (
        <group position={[0, -height / 2 + 0.12 * textScale, 0.02]}>
          {/* Button background */}
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              onButtonClick?.();
            }}
            onPointerOver={() => {
              setButtonHovered(true);
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              setButtonHovered(false);
              document.body.style.cursor = 'auto';
            }}
          >
            <planeGeometry args={[0.38 * textScale, 0.09 * textScale]} />
            <meshBasicMaterial
              color={buttonHovered ? '#00ff88' : '#004422'}
              transparent
              opacity={0.6 + buttonPulse * 0.4}
            />
          </mesh>
          {/* Button border */}
          <mesh position={[0, 0, -0.001]}>
            <planeGeometry args={[0.4 * textScale, 0.105 * textScale]} />
            <meshBasicMaterial
              color={buttonHovered ? '#00ffaa' : '#00ff66'}
              transparent
              opacity={0.3 + buttonPulse * 0.5}
            />
          </mesh>
          {/* Button text */}
          <Text
            position={[0, 0, 0.01]}
            fontSize={0.035 * textScale}
            color={buttonHovered ? '#ffffff' : '#00ffaa'}
            anchorX="center"
            anchorY="middle"
            font="/fonts/Orbitron.ttf"
            renderOrder={4}
          >
            {buttonText}
          </Text>
        </group>
      )}

      {/* Scanline overlay - only when background is shown */}
      {!noBackground && (
        <mesh position={[0, 0, 0.03]} renderOrder={3}>
          <planeGeometry args={[width, height]} />
          <shaderMaterial
            transparent
            depthWrite={false}
            uniforms={{
              time: { value: 0 },
            }}
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
                float scanline = sin(vUv.y * 300.0) * 0.08;
                vec2 vignetteUV = vUv * (1.0 - vUv.yx);
                float vignette = vignetteUV.x * vignetteUV.y * 25.0;
                vignette = pow(vignette, 0.5);
                float alpha = (1.0 - vignette) * 0.2 + scanline * 0.3;
                gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
              }
            `}
          />
        </mesh>
      )}
    </group>
  );
}

// CRT overlay effect during transition
function CRTOverlay({ transition }) {
  const materialRef = useRef();

  useFrame(({ clock }) => {
    if (materialRef.current && materialRef.current.uniforms) {
      materialRef.current.uniforms.transition.value = transition;
      materialRef.current.uniforms.time.value = clock.getElapsedTime();
    }
  });

  if (transition <= 0) return null;

  return (
    <mesh position={[0, 0, 0.2]}>
      <planeGeometry args={[3, 2.2]} />
      <shaderMaterial
        ref={materialRef}
        args={[CRTTransitionMaterial]}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

// Main Portal Scene
// Component to apply camera view offset (shifts view without affecting rotation center)
function CameraViewOffset({ offsetX = 0 }) {
  const { camera, size } = useThree();

  useEffect(() => {
    if (offsetX === 0) {
      camera.clearViewOffset();
    } else {
      // Use setViewOffset to shift the view
      // fullWidth/fullHeight = virtual canvas size (larger than actual)
      // width/height = actual canvas size
      // offsetX/offsetY = where to position the actual view within the virtual canvas
      const fullWidth = size.width * 1.5;
      const xOffset = (fullWidth - size.width) / 2 + (offsetX * size.width * 0.3);
      camera.setViewOffset(fullWidth, size.height, xOffset, 0, size.width, size.height);
    }
    camera.updateProjectionMatrix();

    return () => {
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
  }, [camera, offsetX, size]);

  return null;
}

function PortalScene({ isMobile = false, isTabletPortrait = false, onScreenClick, isZoomedIn = false, onBuyClick, onLineComplete }) {
  const [bullObject, setBullObject] = useState(null);
  const [clippedBullObject, setClippedBullObject] = useState(null);
  const [showScroll, setShowScroll] = useState(false);
  const [transition, setTransition] = useState(0);
  const transitionTarget = useRef(0);
  const screenRef = useRef();
  const localPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));
  const _tempPlane = useRef(new THREE.Plane());

  const grailScale = isMobile ? 0.65 : 0.65;
  const grailRotation = isMobile ? [0, -3.25, 0] : [0.1, -3.25, 0];

  // Scroll model transforms - tweak these!
  // CRT screen position inside portal
  const crtScreenPosition = [0, 0, 0.5];

  // Handle green key press - toggle between grail/CRT and zoom camera
  const handleKeyPress = () => {
    // For mobile/tablet portrait, skip the 3D CRT transition - use fullscreen overlay instead
    if (!isMobile && !isTabletPortrait) {
      transitionTarget.current = showScroll ? 0 : 1;
    }
    // Trigger camera zoom (or fullscreen overlay for mobile/tablet portrait)
    onScreenClick?.();
  };

  // Inner model position (inside portal world) - closer to portal plane
  const innerGrailPosition = [0, -0.7, -1.1];
  // Clipped model position - needs to match where inner model appears at portal plane
  const clippedGrailPosition = [0, -0.7, -1.1];

  // Position for clipped model (accounting for LaptopFrame transforms)
  const laptopPos = [0, isTabletPortrait ? -0.6 : -0.5, 0];
  const laptopScale = isMobile ? 0.8 : isTabletPortrait ? 0.75 : 0.9;
  const portalPos = [0, 0.65, -0.15];

  // Overall rotation to accentuate 3D dimensionality
  const sceneRotation = [0, 0.6, 0]; // Tilt up slightly, rotate to the side

  // Dynamically update clipping plane and handle transition animation
  useFrame((_, delta) => {
    // Animate transition (lower = slower/longer effect)
    const speed = 1.2;
    if (transition < transitionTarget.current) {
      const newVal = Math.min(transition + delta * speed, transitionTarget.current);
      setTransition(newVal);
      // Switch content at midpoint of transition
      if (newVal >= 0.5 && !showScroll) {
        setShowScroll(true);
      }
    } else if (transition > transitionTarget.current) {
      const newVal = Math.max(transition - delta * speed, transitionTarget.current);
      setTransition(newVal);
      // Switch content at midpoint of transition
      if (newVal <= 0.5 && showScroll) {
        setShowScroll(false);
      }
    }

    // Update clipping plane
    if (!screenRef.current) return;

    const screen = screenRef.current;
    screen.updateMatrixWorld();

    // Transform local-space plane to world-space using screen's matrix
    _tempPlane.current.copy(localPlane.current);
    _tempPlane.current.applyMatrix4(screen.matrixWorld);

    // Update the clipping plane
    screenPlane.normal.copy(_tempPlane.current.normal);
    screenPlane.constant = _tempPlane.current.constant + FRONT_OFFSET;
  });

  return (
    <group>
    <FloatingGroup amplitude={0} rotationAmplitude={(isMobile || showScroll) ? 0 : 0.04}>
    <group rotation={sceneRotation}>
      {/* The laptop frame with portal screen */}
      <LaptopFrame
        position={laptopPos}
        scale={laptopScale}
        screenRef={screenRef}
        onKeyPress={handleKeyPress}
        onScreenClick={onScreenClick}
      >
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
        {/* The grail model inside the portal (no glow) - hidden when showing scroll */}
        {!showScroll && (
          <>
            <GrailModel
              scale={grailScale}
              position={innerGrailPosition}
              rotation={grailRotation}
              hideGlow={true}
              onBullFound={setBullObject}
            />
            <BullBreathSmoke bullObject={bullObject} offset={isMobile ? [-0.05, -0.2, 0.4] : [0, -0.4, 0.4]} />
          </>
        )}
        {/* Black screen background inside portal when showing CRT */}
        {showScroll && (
          <CRTBackground />
        )}
        {/* CRT transition overlay */}
        <CRTOverlay transition={transition > 0 && transition < 1 ? transition : 0} />
      </LaptopFrame>

      {/* Clipped grail that pokes through the screen (only when showing grail) */}
      {!showScroll && (
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
      )}

      {/* CRT screen text - outside portal to follow screen transform */}
      {showScroll && (
        <group position={laptopPos} scale={laptopScale}>
          <group position={portalPos} rotation={[-0.35, 0, 0]}>
            <CRTScreen
              position={[0, 0.05, 0.02]}
              width={1.35}
              height={0.9}
              isActive={showScroll}
              noBackground={true}
              onButtonClick={onBuyClick}
              buttonText="BUY RL80"
              onLineComplete={onLineComplete}
              textScale={isMobile ? 0.7 : isTabletPortrait ? 0.65 : 1}
            />
          </group>
        </group>
      )}


      {/* Ambient light to see the laptop model */}
      <ambientLight intensity={0.7} />
      {/* <directionalLight position={[2, 2, 2]} intensity={1} /> */}
    </group>
    </FloatingGroup>
    {/* Clipped breath smoke — outside FloatingGroup to avoid double hover (only when showing grail) */}
    {!showScroll && clippedBullObject && (
      <BullBreathSmoke bullObject={clippedBullObject} offset={isMobile ? [0.0, 0.82, 1.38] : [-0.01, 0.77, 1.4] }  rotation={[0, 0.45, 0]}/>
    )}
    </group>
  );
}

// Loader component that waits for models before showing scene
function SceneLoader({ children }) {
  const [ready, setReady] = useState(false);
  const hasScheduledRef = useRef(false);

  useEffect(() => {
    // Subscribe to progress changes without causing re-renders during child renders
    const checkProgress = (state) => {
      if (state.progress === 100 && !state.active && !hasScheduledRef.current) {
        hasScheduledRef.current = true;
        setTimeout(() => setReady(true), 50);
      }
    };

    // Check initial state
    checkProgress(useProgress.getState());

    // Subscribe to future changes
    const unsubscribe = useProgress.subscribe(checkProgress);
    return unsubscribe;
  }, []);

  return (
    <group visible={ready}>
      {children}
    </group>
  );
}

// Main exported component
export default function HolyGrailPortal({ isMobile = false, isTabletPortrait = false, onZoomChange, viewOffsetX = 0, isActive = true }) {
  const [clientReady, setClientReady] = useState(false);
  const cameraControlsRef = useRef();
  const [isZoomedIn, setIsZoomedIn] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showFullscreenCRT, setShowFullscreenCRT] = useState(false);

  // Audio refs for sound effects
  const pressEnterSoundRef = useRef(null);
  const dataDisplaySoundRef = useRef(null);
  const digitalTextSoundRef = useRef(null);

  useEffect(() => {
    setClientReady(true);
    // Initialize audio elements
    pressEnterSoundRef.current = new Audio('/pressEnter.mp3');
    dataDisplaySoundRef.current = new Audio('/dataDisplay.mp3');
    digitalTextSoundRef.current = new Audio('/');
    pressEnterSoundRef.current.volume = 0.5;
    dataDisplaySoundRef.current.volume = 0.4;
    digitalTextSoundRef.current.volume = 0.3;
  }, []);

  // Notify parent when zoom state changes (either camera zoom or fullscreen CRT)
  useEffect(() => {
    onZoomChange?.(isZoomedIn || showFullscreenCRT);
  }, [isZoomedIn, showFullscreenCRT, onZoomChange]);

  // Reset state when section becomes inactive (user navigated away)
  useEffect(() => {
    if (!isActive && (isZoomedIn || showFullscreenCRT)) {
      // Stop all sounds
      [pressEnterSoundRef, dataDisplaySoundRef, digitalTextSoundRef].forEach(ref => {
        if (ref.current) {
          ref.current.pause();
          ref.current.currentTime = 0;
        }
      });
      // Reset zoom state
      setShowFullscreenCRT(false);
      setIsZoomedIn(false);
      // Reset camera position
      if (cameraControlsRef.current) {
        cameraControlsRef.current.setLookAt(0, 0, 3, 0, 0, 0, false);
      }
    }
  }, [isActive]);


  // Play sound effect helper
  const playSound = (audioRef) => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  // Toggle camera zoom or fullscreen CRT on mobile
  const handleCameraZoom = () => {
    if (!cameraControlsRef.current) return;

    const controls = cameraControlsRef.current;

    // On mobile/tablet portrait, show fullscreen CRT overlay
    if (isMobile || isTabletPortrait) {
      if (showFullscreenCRT) {
        // Exiting: hide overlay first, then zoom out
        setShowFullscreenCRT(false);
        setTimeout(() => {
          controls.setLookAt(0, 0, 3, 0, 0, 0, true);
          setIsZoomedIn(false);
        }, 300);
      } else {
        // Entering: play key press sound and zoom in
        playSound(pressEnterSoundRef);

        // Mobile/tablet portrait: zoom in first, then show overlay
        const distance = isMobile ? 0.6 : 0.8; // Tablet portrait slightly further back
        const sceneRotY = 0.55;
        const camX = Math.sin(sceneRotY) * distance;
        const camZ = Math.cos(sceneRotY) * distance;
        const camY = isTabletPortrait ? 0.05 : 0.25;
        const targetY = isTabletPortrait ? -0.1 : 0.1;
        controls.setLookAt(camX, camY, camZ, -0.2, targetY, -0.2, true);
        setIsZoomedIn(true);
        // Show fullscreen overlay after zoom animation, play data display sound
        setTimeout(() => {
          setShowFullscreenCRT(true);
          playSound(dataDisplaySoundRef);
        }, 600); // Delay to let camera zoom complete
      }
      return;
    }

    // Desktop behavior - just zoom
    if (isZoomedIn) {
      // Zoom out to default position
      controls.setLookAt(0, 0, 3, 0, 0, 0, true);
      setIsZoomedIn(false);
    } else {
      // Entering: play key press sound and zoom in
      playSound(pressEnterSoundRef);
      // Play data display sound when CRT content appears (after transition)
      setTimeout(() => {
        playSound(dataDisplaySoundRef);
      }, 500);
      // Zoom in directly facing the screen (accounting for scene rotation of 0.6 rad on Y)
      // Position camera perpendicular to screen surface
      const distance = 1.0;
      const sceneRotY = 0.55; // Match scene rotation for proper screen view
      const camX = Math.sin(sceneRotY) * distance;
      const camZ = Math.cos(sceneRotY) * distance;
      controls.setLookAt(camX - 0.32, 0.15, camZ, -0.55, 0.05, -0.2, true);
      setIsZoomedIn(true);
    }
  };

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
    <div style={{
      width: '100%',
      height: '100%',
      ...((isMobile || isTabletPortrait) && {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }),
    }}>
      <Canvas
        gl={{
          localClippingEnabled: true,
          antialias: true,
          alpha: true,
        }}
        camera={{
          fov: 50,
          position: [0, 0.5, 3],
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
          {/* Apply view offset to shift laptop to left side without affecting rotation */}
          {!isMobile && viewOffsetX !== 0 && <CameraViewOffset offsetX={viewOffsetX} />}
          <SceneLoader>
            <PortalScene
              isMobile={isMobile}
              isTabletPortrait={isTabletPortrait}
              onScreenClick={handleCameraZoom}
              isZoomedIn={isZoomedIn}
              onBuyClick={() => setShowBuyModal(true)}
              onLineComplete={() => {
                if (digitalTextSoundRef.current) {
                  digitalTextSoundRef.current.currentTime = 0;
                  digitalTextSoundRef.current.play().catch(() => {});
                }
              }}
            />
          </SceneLoader>
          <CameraControls
            ref={cameraControlsRef}
            makeDefault
            target={[0, 0, 0]}
            minAzimuthAngle={-Math.PI / 2.5}
            maxAzimuthAngle={Math.PI / 2.5}
            minPolarAngle={0.5}
            maxPolarAngle={Math.PI / 2}
            minDistance={1.5}
            maxDistance={3}
            dollySpeed={0}
            truckSpeed={0}
            mouseButtons={{
              left: 1,    // ROTATE - enable left-click drag to rotate
              middle: 0,  // NONE
              right: 0,   // NONE
              wheel: 0,   // NONE - allow page scroll
            }}
            touches={{
              one: 1,     // ROTATE - enable single touch rotation
              two: 0,     // NONE - disable two-finger gestures
              three: 0,   // NONE
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

      {/* Buy Modal */}
      <ThirdwebBuyModal
        isOpen={showBuyModal}
        onClose={() => {
          setShowBuyModal(false);
          // Return to zoomed out view when modal closes
          if (cameraControlsRef.current) {
            cameraControlsRef.current.setLookAt(0, 0, 3, 0, 0, 0, true);
          }
          setIsZoomedIn(false);
          setShowFullscreenCRT(false);
        }}
      />

      {/* Fullscreen CRT Overlay - rendered via portal to escape carousel transforms */}
      {typeof document !== 'undefined' && createPortal(
        <FullscreenCRTOverlay
          isActive={showFullscreenCRT}
          onClose={() => {
            // Fade out overlay, then zoom camera out
            setShowFullscreenCRT(false);
            setTimeout(() => {
              if (cameraControlsRef.current) {
                cameraControlsRef.current.setLookAt(0, 0, 3, 0, 0, 0, true);
                setIsZoomedIn(false);
              }
            }, 300);
          }}
          onBuyClick={() => {
            setShowFullscreenCRT(false);
            setShowBuyModal(true);
          }}
          onLineComplete={() => {
            if (digitalTextSoundRef.current) {
              digitalTextSoundRef.current.currentTime = 0;
              digitalTextSoundRef.current.play().catch(() => {});
            }
          }}
        />,
        document.body
      )}
    </div>
  );
}

// Preload the models
useGLTF.preload('/models/ourlady_rider7.glb');
useGLTF.preload('/models/laptop.glb');