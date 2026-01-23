"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import styled, { keyframes, createGlobalStyle } from "styled-components";

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment } from '@react-three/drei';
import { EffectComposer, DepthOfField, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import DarkClouds from "./Clouds";
import EnhancedVolumetricLight from '@/components/EnhancedVolumetricLight';

// Global styles for CSS custom properties
const GlobalStyles = createGlobalStyle`
  @property --r {
    syntax: "<percentage>";
    initial-value: 0%;
    inherits: false;
  }
  @property --g {
    syntax: "<percentage>";
    initial-value: 0%;
    inherits: false;
  }
`;

// Define the keyframes animations for r and g
const rAnimation = keyframes`
  to { --r: 100% }
`;

const gAnimation = keyframes`
  to { --g: 100% }
`;



// Levitation animation for the magic 8-ball and candle styles - using CSS instead of styled-components



// 3D Model Component with Coin Hover Animations
function Model({ url, scale = 1, position = [0, 0, 0], rotation = [0, 0, 0] }) {
  const { scene } = useGLTF(url);
  const meshRef = useRef();




  

  
  


  
  return (
    <primitive 
      ref={meshRef}
      object={scene} 
      scale={scale}
      position={position}
      rotation={rotation}
    //   onPointerOver={handlePointerOver}
    //   onPointerOut={handlePointerOut}
    />
  );
}

const HolyGrail = ({ isMobile = false }) => {
  const [clientSideReady, setClientSideReady] = useState(false);
  const [internalIsMobile, setInternalIsMobile] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const isBrowser = typeof window !== "undefined";
  
  // Use prop if provided, otherwise detect internally
  const effectiveIsMobile = isMobile || internalIsMobile;




  // Matrix rain effect using Canvas
  useEffect(() => {
    setClientSideReady(true);
    
    const checkMobile = () => {
      if (typeof window !== "undefined") {
        setInternalIsMobile(window.innerWidth <= 768);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);

function GradientSkySphere() {
  return (
    <mesh scale={[100, 100, 100]}>
      <sphereGeometry args={[1, 8, 8]} />
      <gradientSkyMaterial 
        side={THREE.BackSide}
        topColor={new THREE.Color(0x1a0033)} // Dark violet
        middleColor={new THREE.Color(0x87CEEB)} // Light blue
        bottomColor={new THREE.Color(0x0a001a)} // Dark blue/almost black
      />
    </mesh>
  );
}

    // Initialize Matrix rain on canvas
    const canvas = canvasRef.current;
    if (canvas && clientSideReady) {
      const ctx = canvas.getContext('2d');
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      
      // Matrix rain configuration
      const fontSize = effectiveIsMobile ? 14 : 20;
      const columnWidth = fontSize;
      const lineHeight = fontSize * 0.8; // Tighter vertical spacing
      const columns = Math.floor(canvas.width / columnWidth);
      const drops = Array(columns).fill(0);
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';
      
      // Track the stream of characters for each column
      const streams = Array(columns).fill(null).map(() => []);
      const streamLength = 25; // Length of each character stream
      
      function draw() {
        // Clear canvas completely for transparent background
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Green text with glow
        ctx.shadowColor = '#0f0';
        ctx.shadowBlur = 5;
        ctx.font = `${fontSize}px monospace`;
        
        // Draw characters
        for (let i = 0; i < columns; i++) {
          // Add new character to stream at regular intervals
          if (streams[i].length === 0 && Math.random() > 0.98) {
            // Start a new stream
            drops[i] = -streamLength * lineHeight;
          }
          
          // Add characters to active stream
          if (drops[i] !== null && streams[i].length < streamLength) {
            const newChar = chars[Math.floor(Math.random() * chars.length)];
            streams[i].push({
              char: newChar,
              y: drops[i] + (streams[i].length * lineHeight)
            });
          }
          
          // Draw and update stream
          for (let j = 0; j < streams[i].length; j++) {
            const item = streams[i][j];
            
            // Calculate opacity based on position in stream
            const streamPosition = j / streams[i].length;
            const leadChar = j === streams[i].length - 1;
            const streamOpacity = leadChar ? 1 : streamPosition * 0.7;
            const fadeOpacity = Math.max(0, 1 - Math.max(0, item.y / canvas.height));
            const opacity = streamOpacity * fadeOpacity;
            
            // Brighter color for lead character
            if (leadChar) {
              ctx.fillStyle = `rgba(150, 255, 150, ${opacity})`;
            } else {
              ctx.fillStyle = `rgba(0, 255, 0, ${opacity})`;
            }
            
            ctx.fillText(item.char, i * columnWidth, item.y);
            
            // Move character down
            item.y += lineHeight * 0.5; // Slower movement
          }
          
          // Remove characters that have gone off screen
          streams[i] = streams[i].filter(item => item.y < canvas.height + lineHeight * 2);
          
          // Update drop position
          if (drops[i] !== null) {
            drops[i] += lineHeight * 0.5;
          }
        }
      }
      
      // Start animation with fixed frame rate
      const animate = () => {
        draw();
        animationRef.current = setTimeout(() => {
          animationRef.current = requestAnimationFrame(animate);
        }, 50); // Fixed 20fps for consistent speed
      };
      
      animate();
    }
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        clearTimeout(animationRef.current);
      }
    };
  }, [clientSideReady, effectiveIsMobile]);

  

  return (
    <>

                      
                      {/* Matrix rain background effect using Canvas */}
                      {/* <canvas 
                        ref={canvasRef}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          zIndex: 0,
                          opacity: 0.65,
                          pointerEvents: 'none',
                        }}
                      /> */}
                      
                      {/* Fluid background as the base layer */}
                      {/* <FluidBackground /> */}

                      {/* Coin on the left */}
                      {/* <div style={{
                        position: 'absolute',
                        left: effectiveIsMobile ? '40px' : '100px',
                        top: '70%',
                        transform: 'translateY(-50%) scale(0.75)',
                        transformOrigin: 'center center',
                        width: '100px',
                        height: '100px',
                        zIndex: 4,
                      }}>
                        <Coin />
                      </div> */}

                      {/* Candle on the left */}
                      {/* <div 
                        className="candle-holder"
                        style={{
                          left: effectiveIsMobile ? '-20px' : '-80px',
                          bottom: '0',
                          transform: effectiveIsMobile ? 'scale(0.6)' : 'scale(0.8)',
                          transformOrigin: 'bottom center',
                        }}
                      >
                        <div className="candle">
                          <div className="blinking-glow"></div>
                          <div className="thread"></div>
                          <div className="glow"></div>
                          <div className="flame"></div>
                        </div>
                      </div> */}

                      {/* Holy Grail 3D Model */}
            
                        {clientSideReady && (
                          <Canvas
                            // camera={{ position: [0, 1.5, 6], fov: effectiveIsMobile ? 50 : 60 }}
                              camera={{ position: [0, -3, 40], fov: 42, near: 0.1, far: 300 }}
                            style={{
                              width: '100%',
                              height: '100%',
                              overflow: 'visible',
                            }}
                          >
                         <DarkClouds />
                            <Suspense fallback={null}>
                     
                              <ambientLight intensity={0.4} />
                              <spotLight position={[1, 4, 1]} angle={0.8} penumbra={0.1} intensity={18}/>
                              <pointLight position={[-1, 0, 2]} color="#ffd700" intensity={1.2} />
                              <pointLight position={[1, 0, 2]} color="#ffd700" intensity={1.2} /> 
                            
                              <Model 
                                url="/models/ourlady_rider7.glb"
                                // scale={effectiveIsMobile ? 0.45 : .45}
                                position={[0, effectiveIsMobile ? -1.8 : -13.5, -2.8]}
                                     scale={effectiveIsMobile ? [5, 5, 5] : [14, 14, 14]} 
                                rotation={effectiveIsMobile ? [0, -3.3, 0] : [0.1, -3.25, 0]}
                              />
                                    {/* <EnhancedVolumetricLight /> */}
                              {/* <OrbitControls 
                                enablePan={false}
                                enableZoom={false}
                                enableRotate={false}
                                // autoRotate={false}
                                // autoRotateSpeed={1}
                              /> */}
                              {/* <Environment preset="night" /> */}
                            
                            </Suspense>
                            <EffectComposer>
                              {/* <DepthOfField
                                focusDistance={0.01}
                                focalLength={0.025}
                                bokehScale={3}
                                height={480}
                              /> */}
                              <Bloom 
                                intensity={0.3}
                                luminanceThreshold={0.4}
                                luminanceSmoothing={0.9}
                              />
                            </EffectComposer>
                          </Canvas>
                        )}
    

                    </>
  ); 
                          }
export default HolyGrail;