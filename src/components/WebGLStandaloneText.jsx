"use client";

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Text } from 'troika-three-text';

export default function WebGLStandaloneText({ 
  text = "WEBGL TEXT",
  textArray = null, // New prop for array of text lines
  className = "",
  fontSize = 2,
  lineHeight = 1.4,
  color = "#fdcdf9",
  id = "webgl-standalone-text",
  skipAnimation = false // New prop to skip the rise animation
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const textMeshRef = useRef(null);
  const frameIdRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const progressRef = useRef(0);

  useEffect(() => {
    if (!containerRef.current) return;

    // Setup Three.js scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Setup camera
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 10;
    cameraRef.current = camera;

    // Setup renderer
    const renderer = new THREE.WebGLRenderer({ 
      alpha: true, 
      antialias: true 
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create text mesh using Troika
    const textMesh = new Text();
    // Use textArray if provided, otherwise use single text
    textMesh.text = textArray ? textArray.join('\n') : text;
    textMesh.fontSize = fontSize;
    textMesh.lineHeight = lineHeight;
    textMesh.color = color;
    textMesh.anchorX = 'center';
    textMesh.anchorY = 'middle';
    textMesh.textAlign = 'center';
    textMesh.font = '/fonts/Humane-Bold.ttf';
    
    // Add stroke for better visibility
    textMesh.strokeColor = 0x000000;
    textMesh.strokeWidth = fontSize * 0.02;
    textMesh.strokeOpacity = 0.5;
    
    // Custom material with wave effect
    textMesh.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uVelocity: { value: 0 }
      },
      vertexShader: `
        uniform float uTime;
        uniform float uProgress;
        
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          vec3 pos = position;
          
          // Wave effect with vertical variation
          float wave = sin(uv.x * 8.0 + uTime * 2.0 + position.y * 0.5) * 0.08;
          pos.x += wave * uProgress;
          
          // Staggered reveal animation per line
          float lineProgress = smoothstep(0.0, 1.0, uProgress * 1.2 - vUv.y * 0.3);
          pos.y -= (1.0 - lineProgress) * 1.5;
          
          // Subtle Z depth for 3D effect
          pos.z += sin(uTime + position.y * 0.3) * 0.1 * uProgress;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uProgress;
        uniform float uTime;
        
        varying vec2 vUv;
        
        void main() {
          // Brighter base color
          vec3 color = uColor * 1.5;
          
          // Add glow effect
          float glow = 1.0 + sin(uTime * 2.0) * 0.2;
          color *= glow;
          
          // Gradient effect - less darkening at bottom
          float gradient = 1.0 - vUv.y * 0.15;
          color *= gradient;
          
          // Cyan/Magenta shift for synthwave style
          color.r *= 1.0 + sin(vUv.x * 8.0 + uTime) * 0.2;
          color.g *= 0.3; // Reduce green for more magenta
          color.b *= 1.0 + cos(vUv.x * 6.0 + uTime) * 0.3;
          
          // Add edge brightness
          float edgeGlow = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x);
          color += edgeGlow * 0.2;
          
          // Alpha based on progress
          float alpha = uProgress;
          
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true
    });

    textMesh.sync();
    scene.add(textMesh);
    textMeshRef.current = textMesh;

    // Animate in
    let animateIn = !skipAnimation;
    const animationDuration = 1500;
    
    // If skipping animation, set progress to 1 immediately
    if (skipAnimation) {
      progressRef.current = 1;
      textMesh.material.uniforms.uProgress.value = 1;
    }

    // Animation loop
    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate);
      
      const elapsedTime = (Date.now() - startTimeRef.current) / 1000;
      
      // Update time uniform
      if (textMeshRef.current && textMeshRef.current.material.uniforms) {
        textMeshRef.current.material.uniforms.uTime.value = elapsedTime;
        
        // Animate progress (only if not skipping)
        if (animateIn && progressRef.current < 1) {
          progressRef.current = Math.min(1, (Date.now() - startTimeRef.current) / animationDuration);
          textMeshRef.current.material.uniforms.uProgress.value = progressRef.current;
        }
      }
      
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
      
      window.removeEventListener('resize', handleResize);
      
      if (textMeshRef.current) {
        scene.remove(textMeshRef.current);
        textMeshRef.current.dispose();
      }
      
      if (renderer) {
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
    };
  }, []);

  // Update text when props change
  useEffect(() => {
    if (textMeshRef.current) {
      const newText = textArray ? textArray.join('\n') : text;
      if (textMeshRef.current.text !== newText) {
        textMeshRef.current.text = newText;
        textMeshRef.current.sync();
        
        // Reset animation
        progressRef.current = 0;
        startTimeRef.current = Date.now();
      }
    }
  }, [text, textArray]);

  return (
    <div 
      ref={containerRef}
      className={`webgl-standalone-text ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '300px'
      }}
    />
  );
}