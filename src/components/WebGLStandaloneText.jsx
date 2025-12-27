"use client";

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';

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
  const composerRef = useRef(null);
  const customPassRef = useRef(null);
  const velocityRef = useRef(0);
  const targetVelocityRef = useRef(0);

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

    // Setup post-processing
    const composer = new EffectComposer(renderer);
    composerRef.current = composer;

    // Add render pass
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Create custom shader pass with your shaders
    const customShader = {
      uniforms: {
        tDiffuse: { value: null },
        uVelocity: { value: 0 },
        uTime: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uVelocity;
        uniform float uTime;

        varying vec2 vUv;

        void main() {
          vec2 uv = vUv;
          
          // Calculating wave distortion based on velocity
          float waveAmplitude = uVelocity * 0.0009;
          float waveFrequency = 4.0 + uVelocity * 0.01;
          
          // Applying wave distortion to the UV coordinates
          vec2 waveUv = uv;
          waveUv.x += sin(uv.y * waveFrequency + uTime) * waveAmplitude;
          waveUv.y += sin(uv.x * waveFrequency * 5. + uTime * 0.8) * waveAmplitude;
          
          // Applying the RGB shift to the wave-distorted coordinates
          float r = texture2D(tDiffuse, vec2(waveUv.x, waveUv.y + uVelocity * 0.005)).r;
          vec2 gb = texture2D(tDiffuse, waveUv).gb;

          gl_FragColor = vec4(r, gb, r);
        }
      `
    };

    const customPass = new ShaderPass(customShader);
    customPass.renderToScreen = true;
    composer.addPass(customPass);
    customPassRef.current = customPass;

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
    // textMesh.strokeColor = 0x000000;
    // textMesh.strokeWidth = fontSize * 0.02;
    // textMesh.strokeOpacity = 0.5;
    
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
          color += edgeGlow * 0.4;
          
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

        // Update velocity uniform in text material
        textMeshRef.current.material.uniforms.uVelocity.value = velocityRef.current;
      }
      
      // Calculate velocity based on animation progress changes
      targetVelocityRef.current = Math.abs(progressRef.current - (progressRef.current - 0.016)) * 60;
      velocityRef.current += (targetVelocityRef.current - velocityRef.current) * 0.1;
      
      // Update post-processing uniforms
      if (customPassRef.current) {
        customPassRef.current.uniforms.uTime.value = elapsedTime;
        customPassRef.current.uniforms.uVelocity.value = velocityRef.current;
      }
      
      // Use composer instead of direct renderer
      composer.render();
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
      
      if (composerRef.current) {
        composerRef.current.dispose();
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