import React, { useState, Suspense, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, useTexture, Html } from '@react-three/drei';
useGLTF.preload('/models/tinyVotiveOnly.glb');
useGLTF.preload('/models/tinyJapCanOnly.glb');
import { 
  db, 
  storage, 
  collection, 
  addDoc, 
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL
} from '@/lib/firebaseClient';
import * as THREE from 'three';
import { useUser } from '@clerk/nextjs';
import './CompactCandleModal.css';
import { useFirestoreResults } from '@/lib/useFirestoreResults';
import CandleSnapshotRenderer from './CandleSnapshotRenderer';

// Simple viewer component for displaying candle models with dynamic texture support
function SimpleCandleViewer({ modelPath, customImageUrl, backgroundTexturePath, backgroundGradient, dedicationName, dedicationMessage, showPlaque, userAvatar, burnAmount, baseColor, backgroundId }) {
  const { scene, materials } = useGLTF(modelPath);
  const modelRef = useRef();
  const groupRef = useRef();
  const textureLoader = new THREE.TextureLoader();
  const backgroundTextureRef = useRef(null);
  const currentBackgroundPath = useRef(null);
  const boxMeshRef = useRef(null);
  const originalBoxTextureRef = useRef(null);
  const [plaqueVisible, setPlaqueVisible] = useState(true);
  
  // Check camera position to hide plaque when viewing from behind
  useFrame(({ camera }) => {
    if (showPlaque && modelRef.current) {
      // Get the camera position relative to the model
      const cameraPosition = camera.position;
      // Check if camera is behind the model (negative z means behind)
      // We'll consider "front" as roughly -45 to +45 degrees from the front
      const angle = Math.atan2(cameraPosition.x, cameraPosition.z);
      const isFront = Math.abs(angle) < Math.PI / 2.5; // Narrower cone for better front detection
      
      if (isFront !== plaqueVisible) {
        setPlaqueVisible(isFront);
      }
    }
  });
  
  React.useEffect(() => {
    if (scene && modelRef.current) {
      const clonedModel = scene.clone(true); // Deep clone to preserve materials
      
      // Reset background path tracking when model changes
      currentBackgroundPath.current = null;
      
      // Different positioning for different models
      if (modelPath.includes('tinyVotiveOnly')) {
        clonedModel.scale.set(2, 2, 2);
        clonedModel.position.set(0, 0, -1);
      } else if (modelPath.includes('tinyVotiveBox')) {
        clonedModel.scale.set(1, 1, 1);
        clonedModel.position.set(0, -2.7, -1);  // Move down significantly
      } else if (modelPath.includes('tinyJapCanBox')) {
        clonedModel.scale.set(1, 1, 1);  // Same scale as votive box
        clonedModel.position.set(0, -2.7, -1);  // Move down significantly
      } else {
        clonedModel.scale.set(1.5, 1.5, 1.5);
        clonedModel.position.set(0, -1, 1);
      }
      
      // Track if we found and applied texture to Box mesh
      let boxMeshFound = false;
      
      // Log all meshes when we have a box model and background texture
      if ((modelPath.includes('tinyVotiveBox') || modelPath.includes('tinyJapCanBox')) && backgroundTexturePath) {
        console.log('=== SEARCHING FOR BOX MESH ===');
        console.log('Model:', modelPath);
        console.log('Background texture to apply:', backgroundTexturePath);
      }
      
      // Enable shadows and ensure materials/textures are visible
      clonedModel.traverse((child) => {
        if (child.isMesh) {
          
          child.castShadow = true;
          child.receiveShadow = true;
          
          // Log all meshes when we have a box model
          if ((modelPath.includes('tinyVotiveBox') || modelPath.includes('tinyJapCanBox')) && backgroundTexturePath) {
            console.log(`Mesh: "${child.name}" | Material: "${child.material?.name}" | Has map: ${!!child.material?.map}`);
          }
          
          // Ensure material and textures are properly configured
          if (child.material) {
            // Clone the material to avoid affecting the original
            child.material = child.material.clone();
            
            // Don't modify materials unless absolutely necessary
            // The model already has correct transparency settings from Blender
            
            // Ensure Card_Details renders on top of the plaque
            if (child.name === 'Card_Details' || child.name === 'card' || child.name.toLowerCase().includes('card')) {
              child.renderOrder = 10; // Render after the plaque
              if (child.material) {
                child.material.depthWrite = true;
                child.material.depthTest = true;
              }
            }
            
            // Target the 'senora' object/mesh/material specifically for votive candles
            const isSenoraObject = child.name === 'senora' || 
                                  child.material.name === 'senora' ||
                                  (child.parent && child.parent.name === 'senora');
            
            // Only apply custom image if it's different from the default senora.png
            // If no custom image or it's the default, keep the original texture
            const shouldApplyCustomTexture = customImageUrl && 
                                            customImageUrl !== '/images/nuestraSenora.webp' && 
                                            (modelPath.includes('tinyVotiveOnly') || modelPath.includes('tinyVotiveBox')) && 
                                            isSenoraObject;
            
            // If custom image URL is provided and this is the senora mesh (for votive)
            if (shouldApplyCustomTexture) {
              // Only set crossOrigin for actual URLs, not local paths
              if (customImageUrl && (customImageUrl.startsWith('http://') || customImageUrl.startsWith('https://'))) {
                textureLoader.crossOrigin = 'anonymous';
              }
              
              textureLoader.load(
                customImageUrl,
                (texture) => {
                  texture.colorSpace = THREE.SRGBColorSpace;
                  texture.flipY = false; // Adjust based on your model
                  
                  // Calculate aspect ratio and adjust texture repeat to maintain it
                  const imageAspect = texture.image.width / texture.image.height;
                  const targetAspect = 1.0; // Assuming the UV map is square
                  
                  if (imageAspect > targetAspect) {
                    // Image is wider than target, scale height
                    texture.repeat.set(1, imageAspect / targetAspect);
                  } else {
                    // Image is taller than target, scale width
                    texture.repeat.set(targetAspect / imageAspect, 1);
                  }
                  
                  // Center the texture
                  texture.offset.set(
                    (1 - texture.repeat.x) / 2,
                    (1 - texture.repeat.y) / 2
                  );
                  
                  texture.wrapS = THREE.ClampToEdgeWrapping;
                  texture.wrapT = THREE.ClampToEdgeWrapping;
                  texture.needsUpdate = true;
                  
                  // Enable transparency for PNG images
                  child.material.map = texture;
                  child.material.transparent = true;
                  child.material.opacity = 1;
                  child.material.alphaTest = 0.1; // Helps with transparency edges
                  child.material.needsUpdate = true;
                },
                undefined,
                (error) => {
                  console.error('Error loading texture:', error);
                  // Fallback to original texture if custom fails
                  if (child.material.map) {
                    child.material.map.needsUpdate = true;
                    child.material.map.colorSpace = THREE.SRGBColorSpace;
                    child.material.transparent = true;
                    child.material.opacity = 1;
                  }
                }
              );
            }
            
            // Apply background texture to the Box mesh for box models
            // Only target the specific "Box" mesh, not "OuterBox" or other box-related meshes
            const isBoxMesh = child.name === 'Box' || child.name === 'box';
            
            // Debug log for Japanese candle box
            if (modelPath.includes('tinyJapCanBox') && child.name.toLowerCase().includes('box')) {
              console.log(`Japanese box model - Found mesh: "${child.name}"`);
            }
            
            if (isBoxMesh && (modelPath.includes('tinyVotiveBox') || modelPath.includes('tinyJapCanBox'))) {
              boxMeshFound = true;
              // Store reference to the Box mesh
              boxMeshRef.current = child;
              
              // Store the original texture if it exists
              if (child.material && child.material.map) {
                originalBoxTextureRef.current = child.material.map;
                console.log(`✓ FOUND BOX MESH: "${child.name}" with original texture`);
                
                // If the current background selection is 'none', remove the default texture immediately
                if (!backgroundTexturePath) {
                  console.log('Removing default texture from Box mesh (No Background selected)');
                  child.material.map = null;
                  child.material.needsUpdate = true;
                  // Set a neutral color for the box
                  if (child.material.color) {
                    child.material.color.set(0x333333); // Dark gray
                  }
                }
              } else {
                originalBoxTextureRef.current = null;
                console.log(`✓ FOUND BOX MESH: "${child.name}" (no texture)`);
              }
              
              // Log mesh properties for debugging
              if (child.geometry) {
                child.geometry.computeBoundingBox();
                const box = child.geometry.boundingBox;
                console.log('Box mesh dimensions:', {
                  width: box.max.x - box.min.x,
                  height: box.max.y - box.min.y,
                  depth: box.max.z - box.min.z
                });
                console.log('Box mesh position:', child.position);
                console.log('Box mesh scale:', child.scale);
              }
            }
            
            // Update material
            child.material.needsUpdate = true;
          }
        }
      });
      
      // Log if we didn't find the Box mesh
      if ((modelPath.includes('tinyVotiveBox') || modelPath.includes('tinyJapCanBox')) && backgroundTexturePath && !boxMeshFound) {
        console.log('✗ BOX MESH NOT FOUND in model!');
      }
      
      // Clear previous model and add new one
      while (modelRef.current.children.length > 0) {
        modelRef.current.remove(modelRef.current.children[0]);
      }
      
      // Add the model to the group
      groupRef.current = clonedModel;
      modelRef.current.add(clonedModel);
    }
  }, [scene, materials, modelPath, customImageUrl]);
  
  // Separate effect for base color application
  React.useEffect(() => {
    if (groupRef.current && baseColor) {
      groupRef.current.traverse((child) => {
        if (child.isMesh) {
          const meshNameLower = child.name.toLowerCase();
          const isBoxMesh = child.name === 'Box' || child.name === 'box';
          
          // Apply color to XBase meshes but NOT to Box mesh
          const isXBaseMesh = !isBoxMesh && (
                             meshNameLower === 'xbase' || 
                             meshNameLower.startsWith('xbase') ||
                             (modelPath.includes('tinyVotive') && 
                              (meshNameLower === 'base' || 
                               meshNameLower === 'cylinder' || 
                               meshNameLower === 'candle' ||
                               meshNameLower.includes('candle_base') ||
                               meshNameLower.includes('wax'))));
          
          if (isXBaseMesh && baseColor !== '#ffffff') {
            const color = new THREE.Color(baseColor);
            child.material.color = color;
            child.material.needsUpdate = true;
          }
        }
      });
    }
  }, [baseColor, modelPath]);
  
  // Separate effect for background texture/gradient application
  React.useEffect(() => {
    let animationFrame;
    
    if (boxMeshRef.current && (backgroundTexturePath || backgroundGradient) && (modelPath.includes('tinyVotiveBox') || modelPath.includes('tinyJapCanBox'))) {
      // Handle gradient backgrounds
      if (backgroundGradient && !backgroundTexturePath) {
        // Create a gradient texture from canvas
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Check if it's a dynamic gradient
        if (backgroundGradient === 'dynamic-aurora') {
          // Aurora Borealis animated gradient
          let time = 0;
          const animate = () => {
            time += 0.002; // Much slower increment
            
            // Fill with base color first - darker for more contrast
            ctx.fillStyle = 'rgba(0, 5, 20, 1)'; // Very dark blue-black base
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Create marbling effect with multiple layers
            for (let layer = 0; layer < 2; layer++) {
              const offset = layer * Math.PI * 0.5;
              const posX = Math.sin(time * 0.3 + offset) * 80;
              const posY = Math.cos(time * 0.2 + offset) * 60;
              const posX2 = Math.sin(time * 0.4 + offset + 1) * 100;
              const posY2 = Math.cos(time * 0.35 + offset + 1) * 80;
              
              // Deep purples and magentas
              const grad1 = ctx.createRadialGradient(
                200 + posX, 100 + posY, 50 + Math.sin(time + offset) * 30,
                256, 256, 300
              );
              grad1.addColorStop(0, 'rgba(150, 0, 255, 0.6)'); // Pure purple, less opacity
              grad1.addColorStop(0.5, 'rgba(100, 0, 150, 0.5)'); // Deep purple
              grad1.addColorStop(1, 'rgba(30, 0, 60, 0.2)'); // Dark purple fade
              ctx.globalCompositeOperation = layer === 0 ? 'source-over' : 'screen';
              ctx.fillStyle = grad1;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              
              // Vibrant greens with cyan hints
              const grad2 = ctx.createRadialGradient(
                350 - posX2, 150 - posY2, 60 + Math.cos(time + offset) * 40,
                256, 256, 350
              );
              grad2.addColorStop(0, 'rgba(0, 255, 100, 0.6)'); // Pure green, less opacity
              grad2.addColorStop(0.4, 'rgba(0, 150, 80, 0.5)'); // Darker emerald
              grad2.addColorStop(1, 'rgba(0, 30, 50, 0.2)'); // Dark teal fade
              ctx.globalCompositeOperation = 'multiply';
              ctx.fillStyle = grad2;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            // Add some colored streaks for marbling (no white)
            const streakTime = time * 0.5;
            for (let i = 0; i < 3; i++) {
              const streakX = 256 + Math.sin(streakTime + i * 2) * 200;
              const streakY = 256 + Math.cos(streakTime * 0.7 + i * 2) * 200;
              const grad4 = ctx.createLinearGradient(
                streakX - 100, streakY - 100,
                streakX + 100, streakY + 100
              );
              if (i % 2 === 0) {
                // Purple streaks
                grad4.addColorStop(0, 'rgba(100, 0, 150, 0)');
                grad4.addColorStop(0.5, 'rgba(180, 0, 255, 0.4)');
                grad4.addColorStop(1, 'rgba(80, 0, 120, 0)');
              } else {
                // Green streaks
                grad4.addColorStop(0, 'rgba(0, 100, 50, 0)');
                grad4.addColorStop(0.5, 'rgba(0, 200, 100, 0.4)');
                grad4.addColorStop(1, 'rgba(0, 80, 40, 0)');
              }
              ctx.globalCompositeOperation = 'screen';
              ctx.fillStyle = grad4;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            ctx.globalCompositeOperation = 'source-over';
            
            // Update texture
            if (backgroundTextureRef.current) {
              backgroundTextureRef.current.needsUpdate = true;
            }
            
            animationFrame = requestAnimationFrame(animate);
          };
          
          const texture = new THREE.CanvasTexture(canvas);
          backgroundTextureRef.current = texture;
          boxMeshRef.current.material = boxMeshRef.current.material.clone();
          boxMeshRef.current.material.map = texture;
          boxMeshRef.current.material.needsUpdate = true;
          
          // Ensure material is set up for texture visibility
          if (boxMeshRef.current.material.color) {
            boxMeshRef.current.material.color.set(0xffffff); // White to show texture colors
          }
          boxMeshRef.current.material.emissive = new THREE.Color(0x000000);
          boxMeshRef.current.material.emissiveIntensity = 0;
          
          animate();
          currentBackgroundPath.current = backgroundGradient;
          return;
          
        } else if (backgroundGradient === 'dynamic-sunset') {
          // Animated sunset gradient
          let time = 0;
          const animate = () => {
            time += 0.003; // Slow, peaceful movement
            
            // Fill with sky gradient base
            const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
            skyGrad.addColorStop(0, 'rgba(25, 25, 112, 1)'); // Midnight blue at top
            skyGrad.addColorStop(0.3, 'rgba(75, 0, 130, 1)'); // Indigo
            skyGrad.addColorStop(0.5, 'rgba(255, 94, 77, 1)'); // Coral
            skyGrad.addColorStop(0.7, 'rgba(255, 140, 0, 1)'); // Dark orange
            skyGrad.addColorStop(1, 'rgba(255, 69, 0, 1)'); // Red-orange at bottom
            ctx.fillStyle = skyGrad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Add moving sun
            const sunY = 256 + Math.sin(time * 0.5) * 30;
            const sunGrad = ctx.createRadialGradient(
              256, sunY, 0,
              256, sunY, 120
            );
            sunGrad.addColorStop(0, 'rgba(255, 255, 200, 0.9)');
            sunGrad.addColorStop(0.3, 'rgba(255, 200, 0, 0.7)');
            sunGrad.addColorStop(0.6, 'rgba(255, 100, 0, 0.4)');
            sunGrad.addColorStop(1, 'rgba(255, 50, 0, 0)');
            ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = sunGrad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Add floating clouds/haze
            for (let i = 0; i < 3; i++) {
              const cloudX = (time * 20 + i * 170) % (canvas.width + 200) - 100;
              const cloudY = 150 + i * 60 + Math.sin(time + i) * 10;
              const cloudGrad = ctx.createRadialGradient(
                cloudX, cloudY, 0,
                cloudX, cloudY, 80
              );
              cloudGrad.addColorStop(0, 'rgba(255, 150, 100, 0.3)');
              cloudGrad.addColorStop(1, 'rgba(255, 100, 150, 0)');
              ctx.globalCompositeOperation = 'lighter';
              ctx.fillStyle = cloudGrad;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            ctx.globalCompositeOperation = 'source-over';
            
            // Update texture
            if (backgroundTextureRef.current) {
              backgroundTextureRef.current.needsUpdate = true;
            }
            
            animationFrame = requestAnimationFrame(animate);
          };
          
          const texture = new THREE.CanvasTexture(canvas);
          backgroundTextureRef.current = texture;
          boxMeshRef.current.material = boxMeshRef.current.material.clone();
          boxMeshRef.current.material.map = texture;
          boxMeshRef.current.material.needsUpdate = true;
          
          // Ensure material is set up for texture visibility
          if (boxMeshRef.current.material.color) {
            boxMeshRef.current.material.color.set(0xffffff); // White to show texture colors
          }
          boxMeshRef.current.material.emissive = new THREE.Color(0x000000);
          boxMeshRef.current.material.emissiveIntensity = 0;
          
          animate();
          currentBackgroundPath.current = backgroundGradient;
          return;
          
        } else if (backgroundGradient === 'dynamic-ethereal') {
          // Ethereal mist animated gradient
          let time = 0;
          const animate = () => {
            time += 0.004; // Gentle flow
            
            // Fill with deep ethereal base
            ctx.fillStyle = 'rgba(10, 0, 30, 1)'; // Deep purple-black
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Create multiple layers of flowing mist
            for (let layer = 0; layer < 4; layer++) {
              const offset = layer * Math.PI * 0.7;
              
              // Flowing mist patterns
              for (let i = 0; i < 2; i++) {
                const mistX = 256 + Math.sin(time * 0.3 + offset + i) * 150;
                const mistY = 256 + Math.cos(time * 0.2 + offset + i * 0.5) * 100;
                const mistGrad = ctx.createRadialGradient(
                  mistX, mistY, 20 + Math.sin(time + offset) * 10,
                  mistX, mistY, 100 + Math.cos(time + offset) * 30
                );
                
                if (layer % 2 === 0) {
                  // Blue-white ethereal mist
                  mistGrad.addColorStop(0, 'rgba(150, 200, 255, 0.4)');
                  mistGrad.addColorStop(0.5, 'rgba(100, 150, 255, 0.2)');
                  mistGrad.addColorStop(1, 'rgba(50, 100, 200, 0)');
                } else {
                  // Purple-pink ethereal mist
                  mistGrad.addColorStop(0, 'rgba(255, 150, 255, 0.4)');
                  mistGrad.addColorStop(0.5, 'rgba(200, 100, 255, 0.2)');
                  mistGrad.addColorStop(1, 'rgba(150, 50, 200, 0)');
                }
                
                ctx.globalCompositeOperation = layer === 0 ? 'source-over' : 'screen';
                ctx.fillStyle = mistGrad;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
              }
            }
            
            // Add sparkles/stars
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 5; i++) {
              const starX = (256 + Math.sin(time * 0.7 + i * 2) * 200);
              const starY = (256 + Math.cos(time * 0.5 + i * 2) * 200);
              const opacity = 0.3 + Math.sin(time * 2 + i) * 0.3;
              ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
              ctx.beginPath();
              ctx.arc(starX, starY, 1 + Math.sin(time * 3 + i) * 0.5, 0, Math.PI * 2);
              ctx.fill();
            }
            
            ctx.globalCompositeOperation = 'source-over';
            
            // Update texture
            if (backgroundTextureRef.current) {
              backgroundTextureRef.current.needsUpdate = true;
            }
            
            animationFrame = requestAnimationFrame(animate);
          };
          
          const texture = new THREE.CanvasTexture(canvas);
          backgroundTextureRef.current = texture;
          boxMeshRef.current.material = boxMeshRef.current.material.clone();
          boxMeshRef.current.material.map = texture;
          boxMeshRef.current.material.needsUpdate = true;
          
          // Ensure material is set up for texture visibility
          if (boxMeshRef.current.material.color) {
            boxMeshRef.current.material.color.set(0xffffff); // White to show texture colors
          }
          boxMeshRef.current.material.emissive = new THREE.Color(0x000000);
          boxMeshRef.current.material.emissiveIntensity = 0;
          
          animate();
          currentBackgroundPath.current = backgroundGradient;
          return;
          
        } else if (backgroundGradient === 'dynamic-lava') {
          // Lava flow animated gradient
          let time = 0;
          const animate = () => {
            time += 0.02;
            
            // Fill with base color first
            ctx.fillStyle = 'rgba(80, 20, 0, 1)'; // Dark red-brown base
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Create flowing lava effect
            for (let i = 0; i < 5; i++) {
              const x = 256 + Math.sin(time + i) * 100;
              const y = 256 + Math.cos(time * 0.5 + i) * 100;
              
              const grad = ctx.createRadialGradient(x, y, 20, x, y, 150);
              grad.addColorStop(0, `rgba(255, ${200 + Math.sin(time + i) * 50}, 0, 1)`); // Bright yellow-orange core
              grad.addColorStop(0.5, `rgba(255, ${100 + Math.sin(time + i) * 50}, 0, 0.8)`); // Orange
              grad.addColorStop(1, 'rgba(200, 50, 0, 0.4)'); // Red-orange glow
              
              ctx.fillStyle = grad;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            // Update texture
            if (backgroundTextureRef.current) {
              backgroundTextureRef.current.needsUpdate = true;
            }
            
            animationFrame = requestAnimationFrame(animate);
          };
          
          const texture = new THREE.CanvasTexture(canvas);
          backgroundTextureRef.current = texture;
          boxMeshRef.current.material = boxMeshRef.current.material.clone();
          boxMeshRef.current.material.map = texture;
          boxMeshRef.current.material.needsUpdate = true;
          
          // Ensure material is set up for texture visibility
          if (boxMeshRef.current.material.color) {
            boxMeshRef.current.material.color.set(0xffffff); // White to show texture colors
          }
          boxMeshRef.current.material.emissive = new THREE.Color(0x000000);
          boxMeshRef.current.material.emissiveIntensity = 0;
          
          animate();
          currentBackgroundPath.current = backgroundGradient;
          return;
          
        } else {
          // Static gradient handling (existing code)
          const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
          
          // Extract colors from the gradient string (simplified parsing)
          const colors = backgroundGradient.match(/#[0-9a-f]{6}|#[0-9a-f]{3}|rgb\([^)]+\)|rgba\([^)]+\)/gi);
          if (colors && colors.length >= 2) {
            gradient.addColorStop(0, colors[0]);
            gradient.addColorStop(1, colors[colors.length - 1]);
            if (colors.length > 2) {
              const step = 1 / (colors.length - 1);
              for (let i = 1; i < colors.length - 1; i++) {
                gradient.addColorStop(step * i, colors[i]);
              }
            }
          }
          
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Create texture from canvas
          const texture = new THREE.CanvasTexture(canvas);
          texture.needsUpdate = true;
          
          // Apply to box mesh
          boxMeshRef.current.material = boxMeshRef.current.material.clone();
          boxMeshRef.current.material.map = texture;
          boxMeshRef.current.material.needsUpdate = true;
          
          // Store for cleanup
          backgroundTextureRef.current = texture;
          currentBackgroundPath.current = backgroundGradient;
          return;
        }
      }
      
    if (boxMeshRef.current && backgroundTexturePath && (modelPath.includes('tinyVotiveBox') || modelPath.includes('tinyJapCanBox'))) {
      // Only load the texture if it's different from the current one
      if (currentBackgroundPath.current !== backgroundTexturePath) {
        console.log(`Applying background texture to Box mesh: ${backgroundTexturePath}`);
        console.log('Box mesh exists:', !!boxMeshRef.current);
        console.log('Model path:', modelPath);
        currentBackgroundPath.current = backgroundTexturePath;
        
        // Dispose of previous custom texture if exists (but not the original)
        if (backgroundTextureRef.current && backgroundTextureRef.current !== originalBoxTextureRef.current) {
          backgroundTextureRef.current.dispose();
          backgroundTextureRef.current = null;
        }
        
        // Only set crossOrigin for actual URLs, not local paths
        if (backgroundTexturePath.startsWith('http://') || backgroundTexturePath.startsWith('https://')) {
          textureLoader.crossOrigin = 'anonymous';
        }
        
        textureLoader.load(
          backgroundTexturePath,
          (texture) => {
            // Check if this is still the current texture we want
            if (currentBackgroundPath.current === backgroundTexturePath && boxMeshRef.current) {
              console.log('✓ Background texture loaded successfully');
              console.log('Applying to mesh:', boxMeshRef.current.name, 'for model:', modelPath);
              
              texture.colorSpace = THREE.SRGBColorSpace;
              texture.flipY = false; // Don't flip the background texture
              texture.wrapS = THREE.ClampToEdgeWrapping;
              texture.wrapT = THREE.ClampToEdgeWrapping;
              texture.needsUpdate = true;
              
              // Store reference to prevent garbage collection
              backgroundTextureRef.current = texture;
              
              // Update the existing material's texture instead of replacing the whole material
              boxMeshRef.current.material.map = texture;
              boxMeshRef.current.material.needsUpdate = true;
              
              // Ensure the material is set up correctly for texture display
              if (boxMeshRef.current.material.color) {
                boxMeshRef.current.material.color.set(0xffffff); // Reset to white to show texture colors
              }
              boxMeshRef.current.material.emissive = new THREE.Color(0x000000); // No emissive
              boxMeshRef.current.material.emissiveIntensity = 0;
              
              console.log('✓ Background texture applied to Box mesh successfully');
              console.log('Material check:', {
                hasMap: !!boxMeshRef.current.material.map,
                meshName: boxMeshRef.current.name,
                modelPath: modelPath,
                materialType: boxMeshRef.current.material.type,
                visible: boxMeshRef.current.visible
              });
            }
          },
          (xhr) => {
            // Progress callback
            console.log(`Loading background: ${(xhr.loaded / xhr.total * 100).toFixed(0)}% complete`);
          },
          (error) => {
            console.error('✗ Error loading background texture:', error);
            console.error('Failed texture path:', backgroundTexturePath);
            console.error('Error details:', {
              message: error.message,
              stack: error.stack,
              type: error.type
            });
            
            // Set fallback color if texture fails
            if (boxMeshRef.current && boxMeshRef.current.material) {
              boxMeshRef.current.material.map = null;
              boxMeshRef.current.material.color.set(0x444444);
              boxMeshRef.current.material.needsUpdate = true;
            }
          }
        );
      }
    } else if (boxMeshRef.current && !backgroundTexturePath) {
      // Clear texture completely when "No Background" is selected
      console.log('Clearing Box mesh texture (No Background selected)');
      currentBackgroundPath.current = null;
      
      // Dispose of the current texture if it's not the original
      if (backgroundTextureRef.current && backgroundTextureRef.current !== originalBoxTextureRef.current) {
        backgroundTextureRef.current.dispose();
        backgroundTextureRef.current = null;
      }
      
      // Remove texture completely
      boxMeshRef.current.material.map = null;
      boxMeshRef.current.material.needsUpdate = true;
      
      // Set a neutral color for the box when no texture
      if (boxMeshRef.current.material.color) {
        boxMeshRef.current.material.color.set(0x333333); // Dark gray
      }
    }
    }
    
    // Cleanup function for animation frames
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [backgroundTexturePath, backgroundGradient, modelPath]);
  
  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      // Clean up background texture reference
      if (backgroundTextureRef.current) {
        backgroundTextureRef.current.dispose();
        backgroundTextureRef.current = null;
      }
      
      // Clean up textures and materials when component unmounts
      if (modelRef.current) {
        modelRef.current.traverse((child) => {
          if (child.material) {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
          if (child.geometry) {
            child.geometry.dispose();
          }
        });
        while (modelRef.current.children.length > 0) {
          modelRef.current.remove(modelRef.current.children[0]);
        }
      }
    };
  }, []);
  
  return (
    <group ref={modelRef}>
      {showPlaque && dedicationName && (
        <Html
          position={[0, 0, -0.1]}
          center
          distanceFactor={18}
          transform
          style={{
            transition: 'opacity 0.3s ease',
            pointerEvents: 'none',
            userSelect: 'none',
            transform: 'scale(0.4)',
            opacity: plaqueVisible ? 1 : 0
          }}
        >
          <div style={{
            // Clean look without background overlay
            borderRadius: '8px',
            padding: '12px',
            minWidth: '120px',
            maxWidth: '180px',
            minHeight: '100px',
            textAlign: 'center',
            fontFamily: 'Georgia, serif',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start'
          }}>
            {userAvatar && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: '4px',
                position: 'relative',
                width: '28px',
                height: '28px',
                margin: '0 auto 4px auto'
              }}>
                {/* Solid black circle background */}
                <div style={{
                  position: 'absolute',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0, 0, 0, 0.9)',
                  border: '1px solid #eaea0b',
                  boxShadow: '0 0 6px rgba(234, 234, 11, 0.4)'
                }} />
                <img 
                  src={userAvatar} 
                  alt="User" 
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    position: 'relative',
                    zIndex: 1
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}
            <div style={{
              color: '#eaea0b',  // Yellow text
              fontSize: '9px',
              fontWeight: '900',  // Extra bold
              marginBottom: dedicationMessage ? '4px' : '0',
              // Subtle dark stroke with glow
              textShadow: `
                -1px -1px 2px rgba(0, 0, 0, 0.9),
                 1px -1px 2px rgba(0, 0, 0, 0.9),
                -1px  1px 2px rgba(0, 0, 0, 0.9),
                 1px  1px 2px rgba(0, 0, 0, 0.9),
                 0 0 6px rgba(0, 0, 0, 0.8),
                 0 0 15px rgba(234, 234, 11, 0.9),
                 0 0 25px rgba(234, 234, 11, 0.5)`
            }}>
              {dedicationName}
            </div>
            {dedicationMessage && (
              <div style={{
                color: '#eaea0b',  // Yellow text
                fontSize: '7px',
                fontStyle: 'italic',
                fontWeight: '800',  // Very bold
                lineHeight: '1.4',
                flex: 1,
                overflow: 'auto',
                wordWrap: 'break-word',
                maxWidth: '100%',
                paddingTop: '2px',
                // Subtle dark stroke with glow
                textShadow: `
                  -1px -1px 1px rgba(0, 0, 0, 0.8),
                   1px -1px 1px rgba(0, 0, 0, 0.8),
                  -1px  1px 1px rgba(0, 0, 0, 0.8),
                   1px  1px 1px rgba(0, 0, 0, 0.8),
                   0 0 4px rgba(0, 0, 0, 0.7),
                   0 0 12px rgba(234, 234, 11, 0.8),
                   0 0 20px rgba(234, 234, 11, 0.4)`
              }}>
                "{dedicationMessage}"
              </div>
            )}
            {burnAmount && burnAmount !== '0' && parseInt(burnAmount) > 0 && (
              <div style={{
                marginTop: '6px',
                paddingTop: '4px',
                borderTop: '1px solid rgba(234, 234, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px'
              }}>
                <span style={{
                  fontSize: '8px',
                  filter: 'drop-shadow(0 0 2px rgba(255, 100, 0, 0.8))'
                }}>🔥</span>
                <span style={{
                  color: '#ffb000',
                  fontSize: '7px',
                  fontWeight: 'bold',
                  textShadow: '0 0 4px rgba(255, 176, 0, 0.6)'
                }}>
                  {parseInt(burnAmount).toLocaleString()} RL80
                </span>
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}


const getUserLanguage = () => {
  if (typeof window === 'undefined') {
    return 'en';
  }
  const lang = navigator.language || navigator.userLanguage || 'en';
  const shortLang = lang.substring(0, 2).toLowerCase();
  return ['es', 'pt', 'zh', 'hi', 'fr', 'it'].includes(shortLang) ? shortLang : 'en';
};
const PRAYERS_BY_LANGUAGE = {
  en: {
    heading: ['Prayer to Our Lady', 'of Perpetual Profit'],
    prayers: [{
      id: 'scalper',
      title: "Scalper's Prayer",
      text: "Oh Lady of Perpetual Profit, bless my lightning fingers and low-latency reflexes. Protect me from fat-fingered orders and grant me the stamina to chase micro-movements without losing my soul. May every scalp be green, and every exit perfectly timed. Amen."
    }, {
      id: 'leverage',
      title: "Leverage Prayer",
      text: "Oh Blessed Virgin of Margin, shield me from the wicked lure of 100x leverage. Guard my trades from sudden liquidation, and deliver me from the temptation of adding 'just a little more.' Grant me the humility to close in profit, and the grace to walk away before the exchange claims my soul. Amen."
    }, {
      id: 'swing',
      title: "Swing Trader's Prayer",
      text: "Oh Lady of Perpetual Profit, grant me patience to ride the waves of volatility, and the wisdom to know when to take profit and when to let it run. Bless my charts, my Fibonacci retracements, and my RSI settings, that I may always enter at the bottom and exit at the top. Amen."
    }, {
      id: 'hodler',
      title: "Hodler's Prayer",
      text: "Oh Glorious Mother of Diamond Hands, let me never succumb to weak paper hands. Guard my seed phrase, strengthen my resolve, and remind me that one day the line shall go up forever. May my wallet survive bear markets, hacks, and exchange collapses, until the moon and beyond. Amen."
    }, {
      id: 'chart',
      title: "Chart Mystic's Prayer",
      text: "Oh Oracle of Eternal Candles, Our Lady of Perpetual Profit, guide my eyes as I read the sacred indicators. Grant me the gift of vision to see wedges before they break, triangles before they tighten, and golden crosses before they shine. Deliver me from false signals, and sanctify my trading view with holy confluence. Amen."
    }]
  },
  es: {
    heading: ['Oración a Nuestra Señora', 'del Beneficio Perpetuo'],
    prayers: [{
      id: 'scalper',
      title: "Oración del Scalper",
      text: "Oh Señora del Beneficio Perpetuo, bendice mis dedos veloces y reflejos de baja latencia. Protégeme de órdenes mal digitadas y dame la resistencia para perseguir micro-movimientos sin perder mi alma. Que cada scalp sea verde y cada salida perfectamente cronometrada. Amén."
    }, {
      id: 'leverage',
      title: "Oración del Apalancamiento",
      text: "Oh Bendita Virgen del Margen, protégeme del malvado señuelo del apalancamiento 100x. Guarda mis operaciones de la liquidación repentina, y líbrame de la tentación de agregar 'solo un poco más'. Dame la humildad para cerrar en ganancias y la gracia para alejarme antes de que el exchange reclame mi alma. Amén."
    }, {
      id: 'swing',
      title: "Oración del Swing Trader",
      text: "Oh Señora del Beneficio Perpetuo, dame paciencia para surfear las olas de volatilidad, y sabiduría para saber cuándo tomar ganancias y cuándo dejarlas correr. Bendice mis gráficos, mis retrocesos de Fibonacci y mi configuración RSI, para que siempre entre en el fondo y salga en la cima. Amén."
    }, {
      id: 'hodler',
      title: "Oración del Hodler",
      text: "Oh Gloriosa Madre de las Manos de Diamante, nunca me dejes sucumbir a las débiles manos de papel. Guarda mi frase semilla, fortalece mi determinación y recuérdame que algún día la línea subirá para siempre. Que mi cartera sobreviva mercados bajistas, hackeos y colapsos de exchanges, hasta la luna y más allá. Amén."
    }, {
      id: 'chart',
      title: "Oración del Místico de Gráficos",
      text: "Oh Oráculo de las Velas Eternas, Nuestra Señora del Beneficio Perpetuo, guía mis ojos mientras leo los indicadores sagrados. Dame el don de ver cuñas antes de que rompan, triángulos antes de que se estrechen y cruces doradas antes de que brillen. Líbrame de señales falsas y santifica mi vista de trading con confluencia sagrada. Amén."
    }]
  },
  pt: {
    heading: ['Oração a Nossa Senhora', 'do Lucro Perpétuo'],
    prayers: [{
      id: 'scalper',
      title: "Oração do Scalper",
      text: "Ó Senhora do Lucro Perpétuo, abençoe meus dedos rápidos e reflexos de baixa latência. Proteja-me de ordens digitadas erradas e me dê resistência para perseguir micro-movimentos sem perder minha alma. Que cada scalp seja verde e cada saída perfeitamente cronometrada. Amém."
    }, {
      id: 'leverage',
      title: "Oração da Alavancagem",
      text: "Ó Bendita Virgem da Margem, proteja-me da tentação maligna de alavancagem 100x. Guarde minhas operações da liquidação repentina e livre-me da tentação de adicionar 'só mais um pouco'. Dê-me humildade para fechar no lucro e a graça de ir embora antes que a exchange reclame minha alma. Amém."
    }, {
      id: 'swing',
      title: "Oração do Swing Trader",
      text: "Ó Senhora do Lucro Perpétuo, dê-me paciência para surfar as ondas de volatilidade e sabedoria para saber quando realizar lucros e quando deixar correr. Abençoe meus gráficos, minhas retrações de Fibonacci e minhas configurações de RSI, para que eu sempre entre no fundo e saia no topo. Amém."
    }, {
      id: 'hodler',
      title: "Oração do Hodler",
      text: "Ó Gloriosa Mãe das Mãos de Diamante, nunca me deixe sucumbir às fracas mãos de papel. Guarde minha seed phrase, fortaleça minha determinação e me lembre que um dia a linha subirá para sempre. Que minha carteira sobreviva a mercados em baixa, hacks e colapsos de exchanges, até a lua e além. Amém."
    }, {
      id: 'chart',
      title: "Oração do Místico dos Gráficos",
      text: "Ó Oráculo das Velas Eternas, Nossa Senhora do Lucro Perpétuo, guie meus olhos enquanto leio os indicadores sagrados. Dê-me o dom de ver cunhas antes que rompam, triângulos antes que apertem e cruzes douradas antes que brilhem. Livre-me de sinais falsos e santifique minha visão de trading com confluência sagrada. Amém."
    }]
  },
  fr: {
    heading: ['Prière à Notre Dame', 'du Profit Perpétuel'],
    prayers: [{
      id: 'scalper',
      title: "Prière du Scalper",
      text: "Ô Dame du Profit Perpétuel, bénis mes doigts rapides et mes réflexes à faible latence. Protège-moi des ordres mal saisis et donne-moi l'endurance pour chasser les micro-mouvements sans perdre mon âme. Que chaque scalp soit vert et chaque sortie parfaitement chronométrée. Amen."
    }, {
      id: 'leverage',
      title: "Prière du Levier",
      text: "Ô Bienheureuse Vierge de la Marge, protège-moi du maléfique appât du levier 100x. Garde mes trades de la liquidation soudaine, et délivre-moi de la tentation d'ajouter 'juste un peu plus'. Accorde-moi l'humilité de clôturer en profit et la grâce de partir avant que l'exchange ne réclame mon âme. Amen."
    }, {
      id: 'swing',
      title: "Prière du Swing Trader",
      text: "Ô Dame du Profit Perpétuel, accorde-moi la patience de chevaucher les vagues de volatilité, et la sagesse de savoir quand prendre des profits et quand les laisser courir. Bénis mes graphiques, mes retracements de Fibonacci et mes paramètres RSI, pour que j'entre toujours en bas et sorte au sommet. Amen."
    }, {
      id: 'hodler',
      title: "Prière du Hodler",
      text: "Ô Glorieuse Mère des Mains de Diamant, ne me laisse jamais succomber aux faibles mains de papier. Garde ma phrase de récupération, renforce ma détermination et rappelle-moi qu'un jour la ligne montera pour toujours. Que mon portefeuille survive aux marchés baissiers, aux piratages et aux effondrements d'exchanges, jusqu'à la lune et au-delà. Amen."
    }, {
      id: 'chart',
      title: "Prière du Mystique des Graphiques",
      text: "Ô Oracle des Bougies Éternelles, Notre Dame du Profit Perpétuel, guide mes yeux alors que je lis les indicateurs sacrés. Donne-moi le don de voir les biseaux avant qu'ils ne cassent, les triangles avant qu'ils ne se resserrent et les croix dorées avant qu'elles ne brillent. Délivre-moi des faux signaux et sanctifie ma vue de trading avec une confluence sacrée. Amen."
    }]
  },
  zh: {
    heading: ['永恒盈利圣母', '祈祷文'],
    prayers: [{
      id: 'scalper',
      title: "刷单者祈祷",
      text: "永恒盈利圣母啊，请保佑我闪电般的手指和低延迟的反应。保护我免受手滑下单之苦，赐予我追逐微小波动而不失灵魂的耐力。愿每次刷单都是绿色，每次退出都恰到好处。阿门。"
    }, {
      id: 'leverage',
      title: "杠杆祈祷",
      text: "保证金圣母啊，请保护我远离100倍杠杆的邪恶诱惑。保护我的交易免受突然爆仓，让我摆脱'再加一点点'的诱惑。赐予我在盈利时平仓的谦逊，以及在交易所夺走我灵魂之前离开的恩典。阿门。"
    }, {
      id: 'swing',
      title: "波段交易者祈祷",
      text: "永恒盈利圣母啊，赐予我驾驭波动浪潮的耐心，以及知道何时止盈何时持有的智慧。保佑我的图表、斐波那契回撤和RSI设置，让我总是在底部进场，在顶部离场。阿门。"
    }, {
      id: 'hodler',
      title: "囤币者祈祷",
      text: "钻石之手的圣母啊，永远不要让我屈服于软弱的纸手。守护我的助记词，坚定我的决心，提醒我总有一天线会永远向上。愿我的钱包在熊市、黑客攻击和交易所崩溃中幸存，直到月球和更远的地方。阿门。"
    }, {
      id: 'chart',
      title: "图表神秘主义者祈祷",
      text: "永恒K线的先知，永恒盈利圣母啊，在我阅读神圣指标时指引我的双眼。赐予我在楔形突破前看到它们、在三角形收紧前看到它们、在金叉闪耀前看到它们的天赋。让我免受假信号的困扰，用神圣的共振净化我的交易视野。阿门。"
    }]
  },
  hi: {
    heading: ['शाश्वत लाभ की माता', 'की प्रार्थना'],
    prayers: [{
      id: 'scalper',
      title: "स्कैल्पर की प्रार्थना",
      text: "हे शाश्वत लाभ की माता, मेरी बिजली जैसी उंगलियों और कम विलंबता वाले रिफ्लेक्स को आशीर्वाद दें। मुझे गलत ऑर्डर से बचाएं और मुझे अपनी आत्मा खोए बिना सूक्ष्म गतिविधियों का पीछा करने की सहनशक्ति दें। हर स्कैल्प हरा हो और हर निकास पूर्ण रूप से समयबद्ध हो। आमीन।"
    }, {
      id: 'leverage',
      title: "लीवरेज प्रार्थना",
      text: "हे मार्जिन की धन्य कुमारी, मुझे 100x लीवरेज के दुष्ट प्रलोभन से बचाएं। मेरे ट्रेडों को अचानक लिक्विडेशन से बचाएं, और मुझे 'बस थोड़ा और' जोड़ने के प्रलोभन से मुक्त करें। मुझे लाभ में बंद करने की विनम्रता और एक्सचेंज मेरी आत्मा का दावा करने से पहले दूर जाने की कृपा दें। आमीन।"
    }, {
      id: 'swing',
      title: "स्विंग ट्रेडर की प्रार्थना",
      text: "हे शाश्वत लाभ की माता, मुझे अस्थिरता की लहरों की सवारी करने का धैर्य दें, और यह जानने की बुद्धि दें कि कब लाभ लेना है और कब इसे चलने देना है। मेरे चार्ट, मेरे फिबोनाची रिट्रेसमेंट और मेरी RSI सेटिंग्स को आशीर्वाद दें, ताकि मैं हमेशा तल पर प्रवेश करूं और शीर्ष पर निकलूं। आमीन।"
    }, {
      id: 'hodler',
      title: "होडलर की प्रार्थना",
      text: "हे हीरे के हाथों की गौरवशाली माता, मुझे कभी भी कमजोर कागज के हाथों के सामने झुकने न दें। मेरे सीड फ्रेज की रक्षा करें, मेरे संकल्प को मजबूत करें और मुझे याद दिलाएं कि एक दिन रेखा हमेशा के लिए ऊपर जाएगी। मेरा वॉलेट भालू बाजारों, हैक और एक्सचेंज के पतन से बचे, चंद्रमा तक और उससे आगे। आमीन।"
    }, {
      id: 'chart',
      title: "चार्ट रहस्यवादी की प्रार्थना",
      text: "हे शाश्वत मोमबत्तियों के ओरेकल, शाश्वत लाभ की माता, पवित्र संकेतकों को पढ़ते समय मेरी आंखों का मार्गदर्शन करें। मुझे वेजेज को टूटने से पहले देखने, त्रिकोणों को कसने से पहले देखने और गोल्डन क्रॉस को चमकने से पहले देखने का वरदान दें। मुझे झूठे संकेतों से मुक्त करें और पवित्र संगम के साथ मेरे ट्रेडिंग दृष्टिकोण को पवित्र करें। आमीन।"
    }]
  },
  it: {
    heading: ['Preghiera a Nostra Signora', 'del Profitto Perpetuo'],
    prayers: [{
      id: 'scalper',
      title: "Preghiera dello Scalper",
      text: "O Signora del Profitto Perpetuo, benedici le mie dita veloci e i miei riflessi a bassa latenza. Proteggimi dagli ordini sbagliati e dammi la resistenza per inseguire i micro-movimenti senza perdere la mia anima. Che ogni scalp sia verde e ogni uscita perfettamente cronometrata. Amen."
    }, {
      id: 'leverage',
      title: "Preghiera della Leva",
      text: "O Beata Vergine del Margine, proteggimi dalla malvagia tentazione della leva 100x. Custodisci i miei trade dalla liquidazione improvvisa e liberami dalla tentazione di aggiungere 'solo un po' di più'. Concedimi l'umiltà di chiudere in profitto e la grazia di andarmene prima che l'exchange reclami la mia anima. Amen."
    }, {
      id: 'swing',
      title: "Preghiera dello Swing Trader",
      text: "O Signora del Profitto Perpetuo, concedimi la pazienza di cavalcare le onde della volatilità e la saggezza di sapere quando prendere profitto e quando lasciarlo correre. Benedici i miei grafici, i miei ritracciamenti di Fibonacci e le mie impostazioni RSI, affinché io entri sempre sul fondo e esca in cima. Amen."
    }, {
      id: 'hodler',
      title: "Preghiera dell'Hodler",
      text: "O Gloriosa Madre delle Mani di Diamante, non lasciarmi mai soccombere alle deboli mani di carta. Custodisci la mia seed phrase, rafforza la mia determinazione e ricordami che un giorno la linea salirà per sempre. Che il mio portafoglio sopravviva ai mercati orso, agli hack e ai crolli degli exchange, fino alla luna e oltre. Amen."
    }, {
      id: 'chart',
      title: "Preghiera del Mistico dei Grafici",
      text: "O Oracolo delle Candele Eterne, Nostra Signora del Profitto Perpetuo, guida i miei occhi mentre leggo gli indicatori sacri. Dammi il dono di vedere i cunei prima che si rompano, i triangoli prima che si stringano e le croci d'oro prima che brillino. Liberami dai falsi segnali e santifica la mia vista di trading con la sacra confluenza. Amen."
    }]
  }
};
// function CandlePreview({
//   imageUrl,
//   message,
//   isEncrypted,
//   username,
//   language = 'en',
//   template = null,
//   templatePosition = {
//     x: 50,
//     y: 50
//   },
//   templateScale = 100,
//   templateRotation = 0,
//   skinToneAdjustment = 0,
//   userImagePosition = {
//     x: 50,
//     y: 50
//   },
//   userImageScale = 100,
//   userImageRotation = 0,
//   candleModel = '/models/singleCandleAnimatedFlame.glb'
// }) {
//   const {
//     scene,
//     animations
//   } = useGLTF(candleModel);
//   const candleRef = useRef();
//   const clonedSceneRef = useRef(null);
//   const defaultTexture = useTexture('/defaultAvatar.png');
//   const mixerRef = useRef(null);
//   const [userTexture, setUserTexture] = useState(null);
//   const [textTexture, setTextTexture] = useState(null);
//   useEffect(() => {
//     if (defaultTexture) {
//       defaultTexture.wrapS = THREE.ClampToEdgeWrapping;
//       defaultTexture.wrapT = THREE.ClampToEdgeWrapping;
//       defaultTexture.repeat.set(1, -1);
//       defaultTexture.offset.set(0, 1);
//       defaultTexture.minFilter = THREE.LinearMipMapLinearFilter;
//       defaultTexture.magFilter = THREE.LinearFilter;
//       defaultTexture.anisotropy = 16;
//       defaultTexture.generateMipmaps = true;
//       defaultTexture.needsUpdate = true;
//     }
//   }, [defaultTexture]);
//   useEffect(() => {
//     if (userTexture) {
//       userTexture.dispose();
//       setUserTexture(null);
//     }
//     if (imageUrl && imageUrl !== '/defaultAvatar.png') {
//       const loader = new THREE.TextureLoader();
//       const finalUrl = imageUrl.startsWith('data:') ? imageUrl : `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
//       loader.setCrossOrigin('anonymous');
//       loader.load(finalUrl, texture => {
//         texture.wrapS = THREE.ClampToEdgeWrapping;
//         texture.wrapT = THREE.ClampToEdgeWrapping;
//         texture.repeat.set(1, -1);
//         texture.offset.set(0, 1);
//         texture.minFilter = THREE.LinearMipMapLinearFilter;
//         texture.magFilter = THREE.LinearFilter;
//         texture.anisotropy = 16;
//         texture.generateMipmaps = true;
//         texture.needsUpdate = true;
//         setUserTexture(texture);
//       }, undefined, error => {
//         const img = new Image();
//         img.crossOrigin = 'anonymous';
//         img.onload = () => {
//           const texture = new THREE.Texture(img);
//           texture.wrapS = THREE.ClampToEdgeWrapping;
//           texture.wrapT = THREE.ClampToEdgeWrapping;
//           texture.repeat.set(1, -1);
//           texture.offset.set(0, 1);
//           texture.needsUpdate = true;
//           setUserTexture(texture);
//         };
//         img.onerror = () => {
//           setUserTexture(null);
//         };
//         img.src = finalUrl;
//       });
//     } else {
//       setUserTexture(null);
//     }
//     return () => {
//       if (userTexture) {
//         userTexture.dispose();
//       }
//     };
//   }, [imageUrl]);
//   const label1MeshRef = useRef(null);
//   const label2MeshRef = useRef(null);
//   const lastSuccessfulImageUrl = useRef(null);
//   const lastTexture = useRef(null);
//   const effectActive = useRef(false);
//   useEffect(() => {
//     if (scene) {
//       clonedSceneRef.current = scene.clone();
//       if (animations && animations.length > 0) {
//         mixerRef.current = new THREE.AnimationMixer(clonedSceneRef.current);
//         animations.forEach(clip => {
//           const action = mixerRef.current.clipAction(clip);
//           action.play();
//         });
//       }
//     }
//     return () => {
//       if (mixerRef.current) {
//         mixerRef.current.stopAllAction();
//       }
//     };
//   }, [scene, animations]);
//   useEffect(() => {
//     if (clonedSceneRef.current) {
//       label1MeshRef.current = null;
//       label2MeshRef.current = null;
//       clonedSceneRef.current.traverse(child => {
//         if (child.isMesh) {
//           if (child.name === 'Label1' || child.name.includes('Label1')) {
//             label1MeshRef.current = child;
//             child.visible = true;
//           }
//           if (child.name === 'Label2' || child.name.includes('Label2')) {
//             label2MeshRef.current = child;
//           }
//         }
//       });
//     }
//   }, [clonedSceneRef.current]);
//   useEffect(() => {
//     if (!label1MeshRef.current) return;
//     const canvas = document.createElement('canvas');
//     canvas.width = 1024;
//     canvas.height = 1024;
//     const ctx = canvas.getContext('2d');
//     ctx.imageSmoothingEnabled = true;
//     ctx.imageSmoothingQuality = 'high';
//     ctx.fillStyle = '#F4E8D0';
//     ctx.fillRect(0, 0, canvas.width, canvas.height);
//     ctx.strokeStyle = '#e0e0e0';
//     ctx.lineWidth = 2;
//     ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
//     if (!message || !message.trim()) {
//       ctx.fillStyle = '#000000';
//       ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
//       ctx.textAlign = 'center';
//       ctx.textBaseline = 'middle';
//       ctx.fillText('Your message here', canvas.width / 2, canvas.height / 2);
//     } else {
//       const headingText = PRAYERS_BY_LANGUAGE[language]?.heading || PRAYERS_BY_LANGUAGE.en.heading;
//       ctx.fillStyle = '#000000';
//       ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
//       ctx.textAlign = 'center';
//       ctx.textBaseline = 'middle';
//       ctx.fillText(headingText[0], canvas.width / 2, 80);
//       ctx.fillText(headingText[1], canvas.width / 2, 130);
//       ctx.strokeStyle = '#333333';
//       ctx.lineWidth = 2;
//       ctx.beginPath();
//       ctx.moveTo(canvas.width * 0.2, 160);
//       ctx.lineTo(canvas.width * 0.8, 160);
//       ctx.stroke();
//       let displayMessage = message;
//       let headerHeight = 180;
//       if (isEncrypted) {
//         ctx.fillStyle = '#ff6600';
//         ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
//         ctx.textAlign = 'center';
//         ctx.textBaseline = 'middle';
//         ctx.fillText('This prayer has been encrypted:', canvas.width / 2, 210);
//         headerHeight = 250;
//       }
//       ctx.fillStyle = '#000000';
//       const fontSize = displayMessage.length > 200 ? 40 : displayMessage.length > 100 ? 48 : 56;
//       ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif`;
//       ctx.textAlign = 'center';
//       ctx.textBaseline = 'middle';
//       const wrapText = (text, maxWidth) => {
//         const isChinese = /[\u4e00-\u9fff]/.test(text);
//         if (isEncrypted && !text.includes(' ')) {
//           const lines = [];
//           const charsPerLine = Math.floor(maxWidth / (fontSize * 0.6));
//           for (let i = 0; i < text.length; i += charsPerLine) {
//             lines.push(text.substring(i, i + charsPerLine));
//           }
//           return lines;
//         }
//         if (isChinese) {
//           const lines = [];
//           let currentLine = '';
//           const charsPerLine = Math.floor(maxWidth / (fontSize * 0.9));
//           for (let i = 0; i < text.length; i++) {
//             currentLine += text[i];
//             if (ctx.measureText(currentLine).width > maxWidth || currentLine.length >= charsPerLine) {
//               const lastPunc = currentLine.search(/[，。！？；：、]/);
//               if (lastPunc > currentLine.length * 0.6) {
//                 lines.push(currentLine.substring(0, lastPunc + 1));
//                 currentLine = currentLine.substring(lastPunc + 1);
//               } else if (currentLine.length > 1) {
//                 lines.push(currentLine.substring(0, currentLine.length - 1));
//                 currentLine = text[i];
//               }
//             }
//           }
//           if (currentLine) {
//             lines.push(currentLine);
//           }
//           return lines;
//         }
//         const words = text.split(' ');
//         const lines = [];
//         let currentLine = '';
//         words.forEach(word => {
//           const testLine = currentLine + (currentLine ? ' ' : '') + word;
//           const metrics = ctx.measureText(testLine);
//           if (metrics.width > maxWidth && currentLine) {
//             lines.push(currentLine);
//             currentLine = word;
//             if (ctx.measureText(word).width > maxWidth) {
//               const chars = word.split('');
//               let tempWord = '';
//               for (let char of chars) {
//                 if (ctx.measureText(tempWord + char).width > maxWidth && tempWord) {
//                   lines.push(tempWord);
//                   tempWord = char;
//                 } else {
//                   tempWord += char;
//                 }
//               }
//               currentLine = tempWord;
//             }
//           } else {
//             currentLine = testLine;
//           }
//         });
//         if (currentLine) {
//           lines.push(currentLine);
//         }
//         return lines;
//       };
//       const lines = wrapText(displayMessage, canvas.width - 120);
//       const lineHeight = displayMessage.length > 200 ? 60 : 80;
//       const startY = headerHeight + 40;
//       ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
//       ctx.shadowBlur = 2;
//       ctx.shadowOffsetX = 1;
//       ctx.shadowOffsetY = 1;
//       lines.forEach((line, index) => {
//         ctx.fillText(line, canvas.width / 2, startY + index * lineHeight);
//       });
//     }
//     const texture = new THREE.CanvasTexture(canvas);
//     texture.wrapS = THREE.ClampToEdgeWrapping;
//     texture.wrapT = THREE.ClampToEdgeWrapping;
//     texture.repeat.set(-1, -1);
//     texture.offset.set(1, 1);
//     texture.flipY = false;
//     texture.minFilter = THREE.LinearMipMapLinearFilter;
//     texture.magFilter = THREE.LinearFilter;
//     texture.anisotropy = 16;
//     texture.generateMipmaps = true;
//     texture.needsUpdate = true;
//     setTextTexture(texture);
//   }, [message, isEncrypted, language]);
//   useEffect(() => {
//     if (label1MeshRef.current && textTexture) {
//       label1MeshRef.current.material = new THREE.MeshStandardMaterial({
//         map: textTexture,
//         transparent: true,
//         side: THREE.DoubleSide,
//         color: 0xffffff
//       });
//       label1MeshRef.current.material.needsUpdate = true;
//       label1MeshRef.current.visible = true;
//     }
//   }, [textTexture]);
//   useEffect(() => {
//     if (!label2MeshRef.current) return;
//     const timeoutId = setTimeout(() => {
//       effectActive.current = true;
//       const currentImageUrl = imageUrl || lastSuccessfulImageUrl.current;
//       if (imageUrl && imageUrl !== '/defaultAvatar.png') {
//         lastSuccessfulImageUrl.current = imageUrl;
//       }
//       const canvas = document.createElement('canvas');
//       canvas.width = 1024;
//       canvas.height = 1024;
//       const ctx = canvas.getContext('2d');
//       ctx.fillStyle = '#f5f5f5';
//       ctx.fillRect(0, 0, canvas.width, canvas.height);
//       const drawImageWithTemplate = (img, templateImg = null, handsImg = null) => {
//         const imageHeight = username ? canvas.height * 0.9 : canvas.height;
//         if (templateImg) {
//           ctx.fillStyle = '#f5f5f5';
//           ctx.fillRect(0, 0, canvas.width, canvas.height);
//           ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);
//           ctx.save();
//           const scaleFactor = userImageScale / 100;
//           const baseSize = Math.min(canvas.width, canvas.height) * 0.4;
//           const actualWidth = img.width <= 10 ? 200 : img.width;
//           const actualHeight = img.height <= 10 ? 200 : img.height;
//           const aspectRatio = actualWidth / actualHeight;
//           const circleSize = baseSize * scaleFactor;
//           const radius = circleSize / 2;
//           let drawWidth, drawHeight;
//           if (aspectRatio > 1) {
//             drawHeight = circleSize;
//             drawWidth = circleSize * aspectRatio;
//           } else {
//             drawWidth = circleSize;
//             drawHeight = circleSize / aspectRatio;
//           }
//           if (userImageRotation !== 0) {
//             const centerX = userImagePosition.x / 100 * canvas.width;
//             const centerY = userImagePosition.y / 100 * canvas.height;
//             ctx.translate(centerX, centerY);
//             ctx.rotate(userImageRotation * Math.PI / 180);
//             ctx.translate(-centerX, -centerY);
//           }
//           ctx.save();
//           ctx.beginPath();
//           const centerX = userImagePosition.x / 100 * canvas.width;
//           const centerY = userImagePosition.y / 100 * canvas.height;
//           const yCompressionFactor = 0.7;
//           ctx.ellipse(centerX, centerY, radius, radius * yCompressionFactor, 0, 0, Math.PI * 2);
//           ctx.clip();
//           ctx.drawImage(img, centerX - drawWidth / 2, centerY - drawHeight * yCompressionFactor / 2, drawWidth, drawHeight * yCompressionFactor);
//           ctx.restore();
//           ctx.restore();
//           if (handsImg && handsImg.complete) {
//             const prevComposite = ctx.globalCompositeOperation;
//             ctx.globalCompositeOperation = 'source-over';
//             if (skinToneAdjustment !== 0) {
//               const tempCanvas = document.createElement('canvas');
//               tempCanvas.width = canvas.width;
//               tempCanvas.height = canvas.height;
//               const tempCtx = tempCanvas.getContext('2d');
//               tempCtx.drawImage(handsImg, 0, 0, canvas.width, canvas.height);
//               const imageData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
//               const data = imageData.data;
//               for (let i = 0; i < data.length; i += 4) {
//                 if (data[i + 3] > 0) {
//                   const r = data[i];
//                   const g = data[i + 1];
//                   const b = data[i + 2];
//                   let newR, newG, newB;
//                   if (skinToneAdjustment < 0) {
//                     const lightness = Math.abs(skinToneAdjustment) / 100;
//                     newR = Math.min(255, r + (255 - r) * lightness * 0.5);
//                     newG = Math.min(255, g + (255 - g) * lightness * 0.5);
//                     newB = Math.min(255, b + (255 - b) * lightness * 0.6);
//                   } else {
//                     const darkness = skinToneAdjustment / 100;
//                     newR = Math.max(0, r - r * darkness * 0.5);
//                     newG = Math.max(0, g - g * darkness * 0.6);
//                     newB = Math.max(0, b - b * darkness * 0.7);
//                   }
//                   data[i] = newR;
//                   data[i + 1] = newG;
//                   data[i + 2] = newB;
//                 }
//               }
//               tempCtx.putImageData(imageData, 0, 0);
//               ctx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
//             } else {
//               ctx.drawImage(handsImg, 0, 0, canvas.width, canvas.height);
//             }
//             ctx.globalCompositeOperation = prevComposite;
//           }
//         } else {
//           ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
//         }
//         if (username && username.trim()) {
//           const gradient = ctx.createLinearGradient(0, imageHeight, 0, canvas.height);
//           gradient.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
//           gradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
//           ctx.fillStyle = gradient;
//           ctx.fillRect(0, imageHeight, canvas.width, canvas.height - imageHeight);
//           ctx.fillStyle = '#ffffff';
//           ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
//           ctx.textAlign = 'center';
//           ctx.textBaseline = 'middle';
//           const nameText = username;
//           const textY = imageHeight + (canvas.height - imageHeight) / 2;
//           ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
//           ctx.shadowBlur = 4;
//           ctx.shadowOffsetX = 2;
//           ctx.shadowOffsetY = 2;
//           ctx.fillText(nameText, canvas.width / 2, textY);
//         }
//         const texture = new THREE.CanvasTexture(canvas);
//         texture.wrapS = THREE.ClampToEdgeWrapping;
//         texture.wrapT = THREE.ClampToEdgeWrapping;
//         texture.repeat.set(1, -1);
//         texture.offset.set(0, 1);
//         texture.minFilter = THREE.LinearMipMapLinearFilter;
//         texture.magFilter = THREE.LinearFilter;
//         texture.anisotropy = 16;
//         texture.generateMipmaps = true;
//         texture.needsUpdate = true;
//         if (label2MeshRef.current && label2MeshRef.current.material) {
//           label2MeshRef.current.material.map = texture;
//           label2MeshRef.current.material.needsUpdate = true;
//           lastTexture.current = texture;
//         } else if (label2MeshRef.current) {
//           label2MeshRef.current.material = new THREE.MeshStandardMaterial({
//             map: texture,
//             emissive: new THREE.Color(0xff6600),
//             emissiveIntensity: 0.15,
//             roughness: 0.7,
//             metalness: 0.2,
//             envMapIntensity: 0.5,
//             side: THREE.FrontSide
//           });
//         }
//       };
//       const img = new Image();
//       img.crossOrigin = 'anonymous';
//       if (template) {
//         const templateImg = new Image();
//         templateImg.crossOrigin = 'anonymous';
//         templateImg.onload = () => {
//           img.onload = () => {
//             if (!effectActive.current) return;
//             const userImg = img;
//             drawImageWithTemplate(userImg, templateImg, null);
//             if (template === '/images/face2.png') {
//               const handsImg = new Image();
//               handsImg.crossOrigin = 'anonymous';
//               handsImg.onload = () => {
//                 if (effectActive.current) {
//                   drawImageWithTemplate(userImg, templateImg, handsImg);
//                 }
//               };
//               handsImg.onerror = () => {};
//               handsImg.src = '/images/FeetHands.png';
//             }
//           };
//           img.onerror = () => {
//             const placeholderImg = new Image();
//             placeholderImg.crossOrigin = 'anonymous';
//             placeholderImg.onload = () => {
//               if (effectActive.current) {
//                 drawImageWithTemplate(placeholderImg, templateImg, null);
//                 if (template === '/images/face2.png') {
//                   const handsImg = new Image();
//                   handsImg.crossOrigin = 'anonymous';
//                   handsImg.onload = () => {
//                     if (effectActive.current) {
//                       drawImageWithTemplate(placeholderImg, templateImg, handsImg);
//                     }
//                   };
//                   handsImg.src = '/images/FeetHands.png';
//                 }
//               }
//             };
//             placeholderImg.src = '/defaultAvatar.png';
//           };
//           if (currentImageUrl && currentImageUrl !== '/defaultAvatar.png') {
//             img.src = currentImageUrl;
//           } else {
//             img.src = '/defaultAvatar.png';
//           }
//         };
//         templateImg.onerror = () => {
//           if (effectActive.current) {
//             img.onload = () => {
//               if (effectActive.current) {
//                 drawImageWithTemplate(img, null, null);
//               }
//             };
//             img.src = currentImageUrl || defaultTexture?.image?.src || '/defaultAvatar.png';
//           }
//         };
//         templateImg.src = template;
//       }
//       img.onerror = () => {
//         ctx.fillStyle = '#ff6600';
//         ctx.fillRect(0, 0, canvas.width, canvas.height);
//         if (username && username.trim()) {
//           ctx.fillStyle = '#ffffff';
//           ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
//           ctx.textAlign = 'center';
//           ctx.textBaseline = 'middle';
//           ctx.fillText(username, canvas.width / 2, canvas.height / 2);
//         }
//         const texture = new THREE.CanvasTexture(canvas);
//         texture.wrapS = THREE.ClampToEdgeWrapping;
//         texture.wrapT = THREE.ClampToEdgeWrapping;
//         texture.repeat.set(1, -1);
//         texture.offset.set(0, 1);
//         texture.needsUpdate = true;
//         if (label2MeshRef.current.material) {
//           label2MeshRef.current.material.map = texture;
//           label2MeshRef.current.material.needsUpdate = true;
//         }
//       };
//       if (!template) {
//         img.onload = () => {
//           if (effectActive.current) {
//             drawImageWithTemplate(img, null, null);
//           }
//         };
//         img.onerror = () => {};
//         if (currentImageUrl && currentImageUrl !== '/defaultAvatar.png') {
//           img.src = currentImageUrl;
//         } else if (userTexture) {
//           img.src = userTexture.image.src;
//         } else if (defaultTexture) {
//           img.src = defaultTexture.image.src;
//         } else {
//           img.src = '/defaultAvatar.png';
//         }
//       }
//     }, 50);
//     return () => {
//       clearTimeout(timeoutId);
//       effectActive.current = false;
//     };
//   }, [userTexture, defaultTexture, username, template, templatePosition, templateScale, templateRotation, skinToneAdjustment, userImagePosition, userImageScale, userImageRotation, imageUrl]);
//   useFrame((state, delta) => {
//     if (mixerRef.current) {
//       mixerRef.current.update(delta);
//     }
//   });
//   return <>
//       {clonedSceneRef.current && <primitive ref={candleRef} object={clonedSceneRef.current} scale={[2, 2, 2]} position={[0, -1, 0]} />}
//       <OrbitControls enablePan={false} enableZoom={true} minDistance={2} maxDistance={8} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 2} autoRotate={false} />
//     </>;
// }
const BACKGROUND_TEXTURES = [{
  id: 'none',
  path: null,
  name: 'No Background',
  type: 'none'
}, {
  id: 'cyberpunk',
  path: '/images/cyberpunk.webp',
  name: 'Cyberpunk',
  type: 'image'
}, {
  id: 'synthwave',
  path: '/images/synthwave.webp',
  name: 'Synthwave',
  type: 'image'
}, {
  id: 'gothicTokyo',
  path: '/images/gothicTokyo.webp',
  name: 'Gothic Tokyo',
  type: 'image'
}, {
  id: 'neoTokyo',
  path: '/images/neoTokyo.webp',
  name: 'Neo Tokyo',
  type: 'image'
}, {
  id: 'aurora',
  path: '/images/aurora.webp',
  name: 'Aurora',
  type: 'image'
},  {
  id: 'sunset',
  path: '/images/gradient-sunset.webp',
  name: 'Sunset Sky',
  type: 'image'
}, {
  id: 'dreams',
  path: '/images/gradient-dreams.webp',
  name: 'Dream Waves',
  type: 'image'
},{
  id: 'tradingView',
  path: '/images/uattr.webp',
  name: 'TradingView',
  type: 'image'
},{
  id: 'chart',
  path: '/images/chart.webp',
  name: 'Chart Patterns',
  type: 'image'
}, {
  id: 'collectibles',
  path: '/images/pokemon2.webp',
  name: 'Collectibles',
  type: 'image'
},  {
  id: 'alchemy',
  path: '/images/alchemy.gif',
  name: 'Alchemy Pattern',
  type: 'image'
}, ];
const sanitizeInput = (input, maxLength = 500) => {
  if (!input) return '';
  let sanitized = String(input);  // Don't trim here - it prevents typing spaces
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/\//g, '&#x2F;');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/data:text\/html/gi, '');
  sanitized = sanitized.replace(/vbscript:/gi, '');
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  return sanitized;
};
const unescapeForDisplay = text => {
  if (!text) return '';
  return text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#x2F;/g, '/');
};
export default function CompactCandleModal({
  isOpen,
  onClose,
  onCandleCreated
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;
  const topBurners = useFirestoreResults("burnedAmount");
  const getIllumin80Threshold = () => {
    if (topBurners.length >= 8) {
      return topBurners[7].burnedAmount;
    }
    return null;
  };


  const {
    user,
    isSignedIn
  } = useUser();
  const clerkImageUrl = user?.imageUrl;
  const [selectedPrayer, setSelectedPrayer] = useState(null);
  const [currentLanguage, setCurrentLanguage] = useState(getUserLanguage());
  const [formData, setFormData] = useState({
    messageType: '',
    candleType: 'votive',
    candleHeight: 'medium',
    username: '',
    message: '',
    burnedAmount: '0',  // Default to 0
    allowLikes: false,
    background: 'none',  // Default to no background
    baseColor: '#ffffff'  // Default white color for XBase meshes
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('/images/nuestraSenora.webp'); // Default to senora.png
  const [selectedTemplate, setSelectedTemplate] = useState(null); // No template by default
  const [templatePosition, setTemplatePosition] = useState({
    x: 67,
    y: 40
  });
  const [templateScale, setTemplateScale] = useState(25);
  const [templateRotation, setTemplateRotation] = useState(0);
  const [userImagePosition, setUserImagePosition] = useState({
    x: 50,
    y: 35
  });
  const [userImageScale, setUserImageScale] = useState(150);
  const [userImageRotation, setUserImageRotation] = useState(0);
  const [skinToneAdjustment, setSkinToneAdjustment] = useState(0);
  const [showPositionControls, setShowPositionControls] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [encryptionPassword, setEncryptionPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [scrambledDisplay, setScrambledDisplay] = useState('');
  const [canvasKey, setCanvasKey] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showExitConfirmDialog, setShowExitConfirmDialog] = useState(false);
  const [showRotateTooltip, setShowRotateTooltip] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [candleWasCreated, setCandleWasCreated] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [showCandleSnapshot, setShowCandleSnapshot] = useState(false);
  const [savedCandleData, setSavedCandleData] = useState(null);
  const [preloadCandleData, setPreloadCandleData] = useState(null);
  const [readyToCapture, setReadyToCapture] = useState(false);
  const modalContentRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const scrollContainerRef = useRef(null);
  React.useEffect(() => {
    if (formData.username || imagePreview) {
      setPreloadCandleData({
        username: formData.username || 'Anonymous',
        imageUrl: imagePreview || '/iamges/defaultAvatar.png',
        message: formData.message,
        burnedAmount: formData.burnedAmount
      });
    }
  }, [formData, imagePreview]);
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setShowRotateTooltip(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setShowRotateTooltip(false);
    }
  }, [isOpen]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [remainingPrayers, setRemainingPrayers] = useState(10);

  const getByteLength = str => {
    return new TextEncoder().encode(str).length;
  };
  const handleInputChange = e => {
    const {
      name,
      value
    } = e.target;
    let sanitizedValue = value;
    if (name === 'username') {
      sanitizedValue = value.slice(0, 50).replace(/[<>\"'&]/g, '');
      const suspiciousExtensions = /\.(exe|bat|cmd|sh|ps1|vbs|js|jar|com|scr|msi|dll|app|deb|dmg|pkg|run|php|asp|jsp|cgi|pl|py|rb|java|c|cpp|cs|vb|swift|go|rs|kt|scala|lua|r|m|sql|db|zip|rar|7z|tar|gz|bz2|xz|iso|img|vmdk|vhd|pdf|doc|docx|xls|xlsx|ppt|pptx|html|htm|xml|json|yaml|yml|ini|cfg|conf|txt|log|bak|tmp|temp|swp|DS_Store)$/i;
      if (suspiciousExtensions.test(sanitizedValue)) {
        sanitizedValue = sanitizedValue.replace(suspiciousExtensions, '');
      }
    } else if (name === 'message') {
      sanitizedValue = value.slice(0, 500);
      sanitizedValue = sanitizedValue.replace(/([C-Z]:\\|\/usr\/|\/etc\/|\/var\/|\.\.\/|\.\/)/gi, '');
    }
    setFormData(prev => ({
      ...prev,
      [name]: sanitizedValue
    }));
    if (name === 'message' && isEncrypted) {
      setIsEncrypted(false);
      setEncryptionPassword('');
      setScrambledDisplay('');
    }
  };

  const handleImageChange = e => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB');
        e.target.value = '';
        return;
      }
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        setError('Please upload a valid image file (JPEG, PNG, or WebP only)');
        e.target.value = '';
        return;
      }
      const fileName = file.name.toLowerCase();
      const validExtensions = /\.(jpg|jpeg|png|webp)$/i;
      if (!validExtensions.test(fileName)) {
        setError('Invalid file extension. Only .jpg, .png, or .webp files are allowed');
        e.target.value = '';
        return;
      }
      const doubleExtension = /\.[^.]+\.(jpg|jpeg|png|webp)$/i;
      if (fileName.split('.').length > 2 && !doubleExtension.test(fileName)) {
        setError('Suspicious filename detected. Please rename your file and try again');
        e.target.value = '';
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
      setError('');
    }
  };
  // 
  const uploadImage = async () => {
    let finalImageUrl = null;
    if (imageFile) {
      // Direct upload without template
      const timestamp = Date.now();
      const fileName = `candles/${timestamp}_${imageFile.name}`;
      const storageRef = ref(storage, fileName);
      const snapshot = await uploadBytes(storageRef, imageFile);
      finalImageUrl = await getDownloadURL(snapshot.ref);
    } else if (imagePreview && imagePreview.startsWith('http')) {
      // Direct URL upload without template
      try {
        const response = await fetch(imagePreview);
        const blob = await response.blob();
        const timestamp = Date.now();
        const fileName = `candles/${timestamp}_clerk_profile.png`;
        const storageRef = ref(storage, fileName);
        const snapshot = await uploadBytes(storageRef, blob);
        finalImageUrl = await getDownloadURL(snapshot.ref);
      } catch (error) {
        finalImageUrl = imagePreview;
      }
    }
    if (!finalImageUrl && user?.imageUrl) {
      finalImageUrl = user.imageUrl;
    }
    return finalImageUrl;
  };
  const captureCandle = () => {
    setTimeout(() => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        try {
          const imageData = canvas.toDataURL('image/png');
          setCapturedImage(imageData);
        } catch (error) {}
      } else {}
    }, 100);
  };
  const handleSubmit = e => {
    e.preventDefault();
    e.stopPropagation();
    if (showPasswordDialog) {
      return;
    }
    const trimmedUsername = sanitizeInput(formData.username, 50).trim();
    let trimmedMessage = sanitizeInput(formData.message, 500).trim();
    if (getByteLength(trimmedMessage) > 500) {
      trimmedMessage = truncateToBytes(trimmedMessage, 500);
      setFormData(prev => ({
        ...prev,
        message: trimmedMessage
      }));
    }
    if (!formData.messageType) {
      setError('Please select a message type');
      return;
    }
    if (!formData.candleType) {
      setError('Please select a candle type');
      return;
    }
    if (!trimmedUsername) {
      setError('Please enter a dedication name');
      return;
    }
    if (!trimmedMessage) {
      setError('Please enter a message or select a prayer');
      return;
    }
    if (trimmedUsername.length > 50) {
      setError('Name must be less than 50 characters');
      return;
    }
    if (getByteLength(trimmedMessage) > 500) {
      setError('Message must be less than 500 bytes');
      return;
    }
    // Don't allow submission with 0 tokens
    if (!formData.burnedAmount || formData.burnedAmount === '0' || parseInt(formData.burnedAmount) === 0) {
      setError('Please select an amount of tokens to burn (minimum 1000)');
      return;
    }
    captureCandle();
    setShowConfirmDialog(true);
  };
  const handleConfirmedSave = async e => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    captureCandle();
    await new Promise(resolve => setTimeout(resolve, 100));
    setShowConfirmDialog(false);
    const trimmedUsername = sanitizeInput(formData.username, 50).trim();
    const trimmedMessage = sanitizeInput(formData.message, 500).trim();
    setIsSubmitting(true);
    setError('');
    try {
      const imageUrl = await uploadImage();
      let docData;
      if (isEncrypted && encryptionPassword) {
        const encryptedData = await encryptMessage(trimmedMessage, encryptionPassword);
        docData = {
          messageType: formData.messageType,
          candleType: formData.candleType,
          candleHeight: formData.candleHeight || 'medium',
          username: trimmedUsername,
          createdBy: user?.id,
          createdByUsername: user?.username || user?.firstName || user?.fullName,
          userAvatar: clerkImageUrl || null,
          encrypted: encryptedData.encrypted,
          salt: encryptedData.salt,
          iv: encryptedData.iv,
          isEncrypted: true,
          burnedAmount: parseInt(formData.burnedAmount) || 1000,
          image: imageUrl,
          background: formData.background || 'synthwave',
          baseColor: formData.baseColor || '#ffffff',
          staked: false,
          createdAt: serverTimestamp()
        };
      } else {
        docData = {
          messageType: formData.messageType,
          candleType: formData.candleType,
          candleHeight: formData.candleHeight || 'medium',
          username: trimmedUsername,
          createdBy: user?.id,
          createdByUsername: user?.username || user?.firstName || user?.fullName,
          userAvatar: clerkImageUrl || null,
          message: trimmedMessage,
          burnedAmount: parseInt(formData.burnedAmount) || 1000,
          image: imageUrl,
          background: formData.background || 'synthwave',
          baseColor: formData.baseColor || '#ffffff',
          staked: false,
          createdAt: serverTimestamp()
        };
      }
      const docRef = await addDoc(collection(db, 'candles'), docData);
      setCandleWasCreated(true);
      setSavedCandleData({
        username: formData.username || 'Anonymous',
        image: imagePreview || imageUrl,  // Use imagePreview (selected image) for snapshot, fallback to uploaded URL
        message: formData.message,
        burnedAmount: docData.burnedAmount,
        candleType: formData.candleType,
        candleHeight: formData.candleHeight || 'medium',
        background: formData.background || 'synthwave',
        baseColor: formData.baseColor || '#ffffff'
      });
      setFormData({
        messageType: '',
        candleType: 'votive',
        username: '',
        message: '',
        burnedAmount: '0',  // Reset to 0
        allowLikes: false,
        baseColor: '#ffffff'
      });
      setCurrentStep(1);
      setImageFile(null);
      setImagePreview(null);
      setSelectedTemplate(null); // Reset to no template
      setShowCandleSnapshot(true);
      onClose();
      if (onCandleCreated) {
        onCandleCreated({
          ...docData,
          id: docRef.id,
          createdAt: new Date()
        });
      }
    } catch (err) {
      setError(`Failed to create candle: ${err.message || 'Please try again.'}`);
      setCandleWasCreated(false);
    } finally {
      setIsSubmitting(false);
    }
  };
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <div style={{
          padding: '20px',
          textAlign: 'center'
        }}>
            <h2 style={{
            fontSize: '24px',
            marginBottom: '10px',
            color: '#ffd700',
            fontWeight: 'bold'
          }}>Choose Your Candle</h2>
            <p style={{
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '30px'
          }}>Select the style for your offering</p>
            
            <div className="candle-selection-container" style={{
            display: 'flex',
            gap: '20px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            maxWidth: '800px',
            margin: '0 auto'
          }}>
              {[{
              value: 'votive',
              label: 'Votive',
              description: 'Classic candle box',
              image: '/images/tinyVotive.webp',
              modelPath: '/models/tinyVotiveOnly.glb'
            }, {
              value: 'japanese',
              label: 'Japanese',
              description: 'Traditional Japanese style',
              image: '/images/tinyJapCan.webp',
              modelPath: '/models/tinyJapCanOnly.glb'
            }].map(type => <button key={type.value} className="candle-type-button" onClick={() => {
              setFormData(prev => ({
                ...prev,
                candleType: type.value
              }));
              if (type.value === 'votive') {
                setCanvasKey(prev => prev + 1);
              }
            }} style={{
              padding: '20px',
              width: '200px',
              background: formData.candleType === type.value ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.2))' : 'linear-gradient(135deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.3))',
              border: formData.candleType === type.value ? '2px solid #ffd700' : '1px solid rgba(255, 215, 0, 0.3)',
              borderRadius: '12px',
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '15px'
            }} onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 10px 30px rgba(255, 215, 0, 0.3)';
            }} onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}>
                  
                  <div style={{
                width: '160px',
                height: '120px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: 'rgba(0, 0, 0, 0.2)'
              }}>
                    <img src={type.image} alt={type.label} style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }} />
                  </div>
                  
                  <div>
                    <div style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  marginBottom: '5px'
                }}>
                      {type.label}
                    </div>
                    <div style={{
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.7)'
                }}>
                      {type.description}
                    </div>
                  </div>
                </button>)}
            </div>
          </div>;
      case 2:
        // For Japanese candles, we skip the personalization step
        // But we should still allow going back to step 1
        if (formData.candleType === 'japanese') {
          // Don't render anything for step 2, but don't force navigation here
          return <div style={{
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '400px'
          }}>
            <p style={{ color: '#999', fontSize: '14px' }}>
              Japanese candles don't support personalization
            </p>
          </div>;
        }
        
        return <div style={{
          padding: '20px'
        }}>
            <h3 style={{
            fontSize: '20px',
            marginBottom: '20px',
            color: '#ffd700',
            textAlign: 'center'
          }}>Choose Your Image</h3>
            
            <div style={{
              marginBottom: '20px'
            }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '15px',
                  maxWidth: '500px',
                  margin: '0 auto'
                }}>
                  {/* User's Clerk Image Option */}
                  {clerkImageUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setImagePreview(clerkImageUrl);
                        setImageFile(null);
                      }}
                      style={{
                        padding: '15px',
                        background: imagePreview === clerkImageUrl ? 
                          'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.2))' : 
                          'linear-gradient(135deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.3))',
                        border: imagePreview === clerkImageUrl ? '2px solid #ffd700' : '1px solid rgba(255, 215, 0, 0.3)',
                        borderRadius: '12px',
                        color: '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <img 
                        src={clerkImageUrl} 
                        alt="Your Image" 
                        style={{
                          width: '80px',
                          height: '80px',
                          borderRadius: '50%',
                          objectFit: 'cover'
                        }} 
                      />
                      <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Your Image</span>
                    </button>
                  )}
                  
                  {/* Senora Option (Default) */}
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview('/images/nuestraSenora.webp');
                      setImageFile(null);
                    }}
                    style={{
                      padding: '15px',
                      background: imagePreview === '/images/nuestraSenora.webp' ? 
                        'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.2))' : 
                        'linear-gradient(135deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.3))',
                      border: imagePreview === '/images/nuestraSenora.webp' ? '2px solid #ffd700' : '1px solid rgba(255, 215, 0, 0.3)',
                      borderRadius: '12px',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <img 
                      src="/images/nuestraSenora.webp" 
                      alt="Senora" 
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '8px',
                        objectFit: 'contain',
                        backgroundColor: 'rgba(0, 0, 0, 0.1)'
                      }} 
                    />
                    <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Senora (Default)</span>
                  </button>
                  
                  {/* Praying Hands Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview('/images/hands.webp');
                      setImageFile(null);
                    }}
                    style={{
                      padding: '15px',
                      background: imagePreview === '/images/hands.webp' ? 
                        'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.2))' : 
                        'linear-gradient(135deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.3))',
                      border: imagePreview === '/images/hands.webp' ? '2px solid #ffd700' : '1px solid rgba(255, 215, 0, 0.3)',
                      borderRadius: '12px',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <img 
                      src="/images/hands.webp" 
                      alt="Praying Hands" 
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '8px',
                        objectFit: 'cover'
                      }} 
                    />
                    <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Praying Hands</span>
                  </button>

                  {/* Illumin80 Option */}
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview('/images/ILLUMIN80_TATTOO.png');
                      setImageFile(null);
                    }}
                    style={{
                      padding: '15px',
                      background: imagePreview === '/images/ILLUMIN80_TATTOO.png' ? 
                        'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.2))' : 
                        'linear-gradient(135deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.3))',
                      border: imagePreview === '/images/ILLUMIN80_TATTOO.png' ? '2px solid #ffd700' : '1px solid rgba(255, 215, 0, 0.3)',
                      borderRadius: '12px',
                      color: '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    <img 
                      src="/images/ILLUMIN80_TATTOO.png" 
                      alt="Illumin80" 
                      style={{
                        width: 'auto',
                        height: '80px',
                        borderRadius: '8px',
                        objectFit: 'cover'
                      }} 
                    />
                    <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Illumin80</span>
                  </button>
                  
                  {/* Custom Upload Option */}
                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '15px',
                    background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.3))',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}>
                    <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleImageChange} style={{
                      display: 'none'
                    }} />
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 215, 0, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px'
                    }}>
                      📷
                    </div>
                    <span style={{
                      color: imageFile ? '#00ff00' : 'rgba(255, 215, 0, 0.8)',
                      fontWeight: '600',
                      fontSize: '12px'
                    }}>
                      {imageFile ? 'Uploaded' : 'Custom'}
                    </span>
                  </label>
                </div>
              </div>
          </div>;
      case 3:
        return <div style={{
          padding: '20px',
          textAlign: 'center'
        }}>
            <h2 style={{
            fontSize: '20px',
            marginBottom: '8px',
            color: '#ffd700',
            fontWeight: 'bold'
          }}>What type of message?</h2>
            <p style={{
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '20px'
          }}>Choose the intention for your candle</p>
            
            <div style={{
            display: 'flex',
            gap: '10px',
            width: '100%',
            justifyContent: 'space-between'
          }}>
              {[{
              value: 'petition',
              label: 'Petition',
              emoji: '🙏',
              description: 'Ask for intercession'
            }, {
              value: 'confession',
              label: 'Confession',
              emoji: '💭',
              description: 'Unburden heart'
            }, {
              value: 'appreciation',
              label: 'Appreciation',
              emoji: '✨',
              description: 'Express your gratitude'
            }].map(type => <button key={type.value} onClick={() => {
              setFormData(prev => ({
                ...prev,
                messageType: type.value
              }));
            }} style={{
              flex: 1,
              padding: '15px 8px',
              background: formData.messageType === type.value ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.2))' : 'linear-gradient(135deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.3))',
              border: formData.messageType === type.value ? '2px solid #ffd700' : '1px solid rgba(255, 215, 0, 0.3)',
              borderRadius: '8px',
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              minWidth: '0',
              boxShadow: formData.messageType === type.value ? '0 4px 15px rgba(255, 215, 0, 0.3)' : 'none'
            }}>
                  <div style={{
                fontSize: '24px',
                lineHeight: '1'
              }}>
                    {type.emoji}
                  </div>
                  <div style={{
                fontSize: '14px',
                fontWeight: 'bold',
                color: formData.messageType === type.value ? '#ffd700' : '#fff'
              }}>
                    {type.label}
                  </div>
                  <div style={{
                fontSize: '10px',
                color: 'rgba(255, 255, 255, 0.6)',
                lineHeight: '1.2'
              }}>
                    {type.description}
                  </div>
                </button>)}
            </div>
          </div>;
      case 4:
        return <div style={{
          padding: '20px'
        }}>
            
            <div style={{
            marginBottom: '20px'
          }}>
              <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.8)'
            }}>
                Dedication Name
              </label>
              <input type="text" value={formData.username} onChange={e => {
              const sanitized = sanitizeInput(e.target.value, 50);
              setFormData(prev => ({
                ...prev,
                username: sanitized
              }));
            }} placeholder="On behalf of..." maxLength={50} style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 215, 0, 0.3)',
              color: '#fff',
              fontSize: '14px'
            }} />
            </div>
            
            {formData.messageType === 'petition' && <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '10px'
          }}>
              <select value={currentLanguage} onChange={e => {
              setCurrentLanguage(e.target.value);
              setSelectedPrayer(null);
            }} style={{
              width: '80px',
              padding: '8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 215, 0, 0.3)',
              color: '#fff',
              fontSize: '12px',
              cursor: 'pointer'
            }}>
                <option value="en">EN</option>
                <option value="es">ES</option>
                <option value="pt">PT</option>
                <option value="fr">FR</option>
                <option value="zh">中文</option>
                <option value="hi">हिं</option>
                <option value="it">IT</option>
              </select>
              <select value={selectedPrayer || ''} onChange={e => {
              const value = e.target.value;
              if (value === '') {
                setSelectedPrayer(null);
              } else {
                const prayers = PRAYERS_BY_LANGUAGE[currentLanguage]?.prayers || PRAYERS_BY_LANGUAGE.en.prayers;
                const prayer = prayers.find(p => p.id === value);
                if (prayer) {
                  setSelectedPrayer(value);
                  setFormData(prev => ({
                    ...prev,
                    message: prayer.text
                  }));
                }
              }
            }} style={{
              flex: 1,
              padding: '8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 215, 0, 0.3)',
              color: '#fff',
              fontSize: '12px',
              cursor: 'pointer'
            }}>
                <option value="">Select prayer template (optional)...</option>
                {(PRAYERS_BY_LANGUAGE[currentLanguage]?.prayers || PRAYERS_BY_LANGUAGE.en.prayers).map(prayer => <option key={prayer.id} value={prayer.id}>
                    {prayer.title}
                  </option>)}
              </select>
            </div>}

            <div style={{
            marginBottom: '10px'
          }}>
              <label style={{
              display: 'block',
              marginBottom: '5px',
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.8)'
            }}>
                Your Message
              </label>
              <textarea ref={textareaRef} value={scrambledDisplay || formData.message} onChange={e => {
              if (!isEncrypted) {
                const newValue = sanitizeInput(e.target.value, 500);
                setFormData(prev => ({
                  ...prev,
                  message: newValue
                }));
                if (selectedPrayer) {
                  const currentPrayers = PRAYERS_BY_LANGUAGE[currentLanguage]?.prayers || PRAYERS_BY_LANGUAGE.en.prayers;
                  const selectedPrayerText = currentPrayers.find(p => p.id === selectedPrayer)?.text;
                  if (selectedPrayerText && newValue !== selectedPrayerText) {
                    setSelectedPrayer(null);
                  }
                }
              }
            }} placeholder={selectedPrayer ? 'Edit the selected prayer or write your own...' : formData.messageType === 'petition' ? 'What do you seek... or select a prayer above' : formData.messageType === 'confession' ? 'What weighs on your heart...' : 'What are you grateful for...'} maxLength={500} style={{
              width: '100%',
              minHeight: '150px',
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 215, 0, 0.3)',
              color: '#fff',
              fontSize: '14px',
              resize: 'vertical'
            }} />
              <div style={{
              marginTop: '5px',
              fontSize: '11px',
              color: 'rgba(255, 255, 255, 0.5)',
              textAlign: 'right'
            }}>
                {formData.message.length}/500 characters
              </div>
            </div>
          </div>;
      case 5:
        const scrollLeft = () => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({
              left: -220,
              behavior: 'smooth'
            });
          }
        };
        const scrollRight = () => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({
              left: 220,
              behavior: 'smooth'
            });
          }
        };
        return <div style={{
          padding: '20px 10px'
        }}>
            <h3 style={{
            fontSize: '18px',
            marginBottom: '15px',
            color: '#ffd700',
            textAlign: 'center'
          }}>Choose Your Sacred Space</h3>
            
            <div style={{
            position: 'relative'
          }}>
              
              <button onClick={scrollLeft} style={{
              position: 'absolute',
              left: '-5px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '30px',
              height: '60px',
              background: 'linear-gradient(90deg, rgba(0,0,0,0.8), transparent)',
              border: 'none',
              borderRadius: '0 8px 8px 0',
              color: '#ffd700',
              fontSize: '20px',
              cursor: 'pointer',
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0
            }}>
                ‹
              </button>
              
              <button onClick={scrollRight} style={{
              position: 'absolute',
              right: '-5px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '30px',
              height: '60px',
              background: 'linear-gradient(-90deg, rgba(0,0,0,0.8), transparent)',
              border: 'none',
              borderRadius: '8px 0 0 8px',
              color: '#ffd700',
              fontSize: '20px',
              cursor: 'pointer',
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0
            }}>
                ›
              </button>
              
              <div ref={scrollContainerRef} style={{
              display: 'flex',
              overflowX: 'auto',
              gap: '12px',
              padding: '10px 0',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitScrollbar: {
                display: 'none'
              }
            }}>
                {BACKGROUND_TEXTURES.map(bg => <button key={bg.id} onClick={() => setFormData(prev => ({
                ...prev,
                background: bg.id
              }))} style={{
                position: 'relative',
                padding: '0',
                background: 'none',
                border: formData.background === bg.id ? '3px solid #ffd700' : '2px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                cursor: 'pointer',
                overflow: 'hidden',
                flexShrink: 0,
                width: '200px',
                height: '112px',
                transition: 'all 0.3s ease',
                transform: formData.background === bg.id ? 'scale(1.05)' : 'scale(1)'
              }}>
                    {(bg.type === 'image' || bg.type === 'url') && bg.path ? (
                      <img 
                        src={bg.path} 
                        alt={bg.name}
                        crossOrigin={bg.type === 'url' ? 'anonymous' : undefined}
                        onError={(e) => {
                          // Fallback for failed image loads
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML = `
                            <div style="
                              width: 100%;
                              height: 100%;
                              display: flex;
                              align-items: center;
                              justify-content: center;
                              background: linear-gradient(135deg, #3a3a3a, #2a2a2a);
                              color: rgba(255, 255, 255, 0.7);
                              font-size: 12px;
                              text-align: center;
                              padding: 10px;
                            ">
                              <div>
                                <div style="font-size: 20px; margin-bottom: 5px;">🖼️</div>
                                <div>${bg.name}</div>
                              </div>
                            </div>
                          `;
                        }}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          opacity: formData.background === bg.id ? 1 : 0.7
                        }} 
                      />
                    ) : bg.type === 'gradient' ? (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        background: bg.gradient,
                        opacity: formData.background === bg.id ? 1 : 0.8
                      }} />
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'linear-gradient(135deg, #1a1a1a, #2a2a2a)',
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontSize: '24px'
                      }}>
                        ✕
                      </div>
                    )}
                    <div style={{
                  position: 'absolute',
                  bottom: '0',
                  left: '0',
                  right: '0',
                  background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)',
                  padding: '8px',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  textAlign: 'center'
                }}>
                      {bg.name}
                      {formData.background === bg.id && <span style={{
                    display: 'block',
                    marginTop: '3px',
                    color: '#ffd700',
                    fontSize: '10px'
                  }}>✓ Selected</span>}
                    </div>
                  </button>)}
              </div>
            </div>
            
            {/* Base Color Picker */}
            <div style={{
              marginTop: '20px',
              padding: '15px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '12px',
              border: '1px solid rgba(255, 215, 0, 0.2)'
            }}>
              <h4 style={{
                fontSize: '16px',
                marginBottom: '10px',
                color: '#ffd700'
              }}>Candle Base Color</h4>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '15px'
              }}>
                <input
                  type="color"
                  value={formData.baseColor}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    baseColor: e.target.value
                  }))}
                  style={{
                    width: '50px',
                    height: '50px',
                    border: '2px solid rgba(255, 215, 0, 0.5)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: 'transparent'
                  }}
                />
                <div style={{
                  flex: 1
                }}>
                  <div style={{
                    fontSize: '14px',
                    color: '#fff',
                    marginBottom: '5px'
                  }}>
                    Selected: <span style={{
                      color: formData.baseColor,
                      fontWeight: 'bold'
                    }}>{formData.baseColor}</span>
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.6)'
                  }}>
                    Adjust the color of the candle base material
                  </div>
                </div>
                <button
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    baseColor: '#ffffff'
                  }))}
                  style={{
                    padding: '8px 15px',
                    background: 'rgba(255, 215, 0, 0.2)',
                    border: '1px solid rgba(255, 215, 0, 0.4)',
                    borderRadius: '6px',
                    color: '#ffd700',
                    cursor: 'pointer',
                    fontSize: '12px',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(255, 215, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(255, 215, 0, 0.2)';
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>;
      case 6:
        return <div style={{
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
            {/* Token Burn Amount - Prominent and separated */}
            <div style={{
              backgroundColor: 'rgba(255, 215, 0, 0.1)',
              border: '2px solid rgba(255, 215, 0, 0.4)',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 0 20px rgba(255, 215, 0, 0.2)'
            }}>
              <label style={{
                color: '#ffd700',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'block',
                marginBottom: '8px',
                textAlign: 'center'
              }}>🔥 Select Token Amount to Burn (RL80) 🔥</label>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                justifyContent: 'center'
              }}>
                <button type="button" onClick={() => {
                  const currentValue = parseInt(formData.burnedAmount) || 0;
                  const newValue = Math.max(0, currentValue - 1000);
                  setFormData(prev => ({
                    ...prev,
                    burnedAmount: newValue.toString()
                  }));
                }} style={{
                  width: '40px',
                  height: '40px',
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.1))',
                  border: '2px solid rgba(255, 215, 0, 0.5)',
                  borderRadius: '8px',
                  color: '#ffd700',
                  cursor: 'pointer',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }} onMouseOver={e => {
                  e.target.style.transform = 'scale(1.1)';
                }} onMouseOut={e => {
                  e.target.style.transform = 'scale(1)';
                }}>
                  −
                </button>
                <input type="number" value={formData.burnedAmount} onChange={e => {
                  const value = e.target.value;
                  const numericValue = value.replace(/\D/g, '');
                  if (numericValue === '') {
                    setFormData(prev => ({
                      ...prev,
                      burnedAmount: '0'
                    }));
                  } else if (parseInt(numericValue) >= 0 && parseInt(numericValue) <= 1000000000000) {
                    setFormData(prev => ({
                      ...prev,
                      burnedAmount: numericValue
                    }));
                  }
                }} style={{
                  width: '150px',
                  padding: '10px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  border: '2px solid rgba(255, 215, 0, 0.5)',
                  color: '#ffd700',
                  fontSize: '18px',
                  textAlign: 'center',
                  fontWeight: 'bold'
                }} min="0" placeholder="0" />
                <button type="button" onClick={() => {
                  const currentValue = parseInt(formData.burnedAmount) || 0;
                  const newValue = currentValue + 1000;
                  setFormData(prev => ({
                    ...prev,
                    burnedAmount: newValue.toString()
                  }));
                }} style={{
                  width: '40px',
                  height: '40px',
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.1))',
                  border: '2px solid rgba(255, 215, 0, 0.5)',
                  borderRadius: '8px',
                  color: '#ffd700',
                  cursor: 'pointer',
                  fontSize: '20px',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }} onMouseOver={e => {
                  e.target.style.transform = 'scale(1.1)';
                }} onMouseOut={e => {
                  e.target.style.transform = 'scale(1)';
                }}>
                  +
                </button>
              </div>
              {formData.burnedAmount === '0' || !formData.burnedAmount ? (
                <div style={{
                  color: '#ff6b6b',
                  fontSize: '12px',
                  textAlign: 'center',
                  marginTop: '8px'
                }}>
                  ⚠️ Minimum 1000 tokens required to light candle
                </div>
              ) : (
                <div style={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '12px',
                  textAlign: 'center',
                  marginTop: '8px'
                }}>
                  Amount: {parseInt(formData.burnedAmount).toLocaleString()} RL80
                </div>
              )}
            </div>

            {/* Summary Section */}
            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              padding: '12px'
            }}>
              <h3 style={{
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '12px',
                marginBottom: '10px',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>Candle Summary</h3>
              <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              marginBottom: '10px'
            }}>
                <div>
                  <label style={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '10px'
                }}>Type</label>
                  <div style={{
                  color: '#fff',
                  fontSize: '13px',
                  marginTop: '2px'
                }}>
                    {formData.messageType === 'petition' && '🙏 Petition'}
                    {formData.messageType === 'confession' && '💭 Confession'}
                    {formData.messageType === 'praise' && '✨ Praise'}
                  </div>
                </div>
                
                <div>
                  <label style={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '10px'
                }}>Style</label>
                  <div style={{
                  color: '#fff',
                  fontSize: '13px',
                  marginTop: '2px'
                }}>
                    {formData.candleType === 'japanese' && '🏮 Japanese Box'}
                    {formData.candleType === 'votive' && '🕯️ Votive Box'}
                  </div>
                </div>
              </div>
              
              <div style={{
              marginBottom: '10px'
            }}>
                <label style={{
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '10px'
              }}>Creator</label>
                <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '3px'
              }}>
                  <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  border: '1px solid rgba(255, 215, 0, 0.5)',
                  overflow: 'hidden',
                  flexShrink: 0,
                  background: 'rgba(255, 215, 0, 0.1)'
                }}>
                    <img src={imagePreview || user?.imageUrl || '/defaultAvatar.png'} alt="Profile" style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }} onError={e => {
                    e.target.src = '/defaultAvatar.png';
                  }} />
                  </div>
                  <div style={{
                  color: '#fff',
                  fontSize: '13px'
                }}>
                    {user?.username || user?.firstName || user?.fullName || 'You'}
                  </div>
                  <label style={{
                  marginLeft: 'auto',
                  fontSize: '10px',
                  color: 'rgba(255, 215, 0, 0.8)',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}>
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleImageChange} style={{
                    display: 'none'
                  }} />
                    Change
                  </label>
                </div>
              </div>
              
              <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              marginBottom: '10px'
            }}>
                <div>
                  <label style={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '10px'
                }}>Dedicated To</label>
                  <div style={{
                  color: '#fff',
                  fontSize: '13px',
                  marginTop: '2px'
                }}>
                    {unescapeForDisplay(formData.username) || 'Anonymous'}
                  </div>
                </div>
                
                <div>
                  <label style={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '10px'
                }}>Background</label>
                  <div style={{
                  color: '#fff',
                  fontSize: '13px',
                  marginTop: '2px'
                }}>
                    {BACKGROUND_TEXTURES.find(bg => bg.id === formData.background)?.name || 'No Background'}
                  </div>
                </div>
              </div>
              
              {formData.baseColor && formData.baseColor !== '#ffffff' && (
                <div style={{
                  marginBottom: '10px'
                }}>
                  <label style={{
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '10px'
                  }}>Base Color</label>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '4px'
                  }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      backgroundColor: formData.baseColor,
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '4px'
                    }} />
                    <div style={{
                      color: '#fff',
                      fontSize: '13px'
                    }}>
                      Custom Color
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                <label style={{
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '10px'
              }}>Message</label>
                <div style={{
                color: '#fff',
                fontSize: '12px',
                marginTop: '3px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '60px',
                overflowY: 'auto',
                padding: '4px',
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '4px'
              }}>
                  {unescapeForDisplay(formData.message) || 'No message'}
                </div>
              </div>
            </div>
          </div>;
      default:
        return null;
    }
  };
  const handleNext = () => {
    if (currentStep < totalSteps) {
      // Skip step 2 (personalization) for Japanese candles
      if (currentStep === 1 && formData.candleType === 'japanese') {
        setCurrentStep(3); // Jump directly to step 3
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };
  const handlePrev = () => {
    console.log('handlePrev called, currentStep:', currentStep);
    if (currentStep > 1) {
      // For Japanese candles, skip step 2 when going back from step 3
      if (currentStep === 3 && formData.candleType === 'japanese') {
        setCurrentStep(1); // Jump back to step 1
        console.log('Skipping step 2, moving to step: 1');
      } else {
        setCurrentStep(currentStep - 1);
        console.log('Moving to step:', currentStep - 1);
      }
    }
  };
  const ExitDialog = () => {
    if (!showExitConfirmDialog) return null;
    return ReactDOM.createPortal(<div style={{
      position: 'fixed',
      top: '0px',
      left: '0px',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      zIndex: 999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
        <div style={{
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
        border: '2px solid rgba(255, 102, 0, 0.5)',
        borderRadius: '16px',
        padding: '32px',
        width: '90%',
        maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
        color: 'white'
      }}>
          <h3 style={{
          color: '#ff6600',
          margin: '0 0 20px 0',
          fontSize: '24px',
          textAlign: 'center'
        }}>
            ⚠️ Unsaved Changes
          </h3>
          
          <p style={{
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: '15px',
          lineHeight: '1.6',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
            You have unsaved changes. Are you sure you want to close without saving your candle?
          </p>
          
          <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center'
        }}>
            <button onClick={() => {
            setShowExitConfirmDialog(false);
          }} style={{
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            flex: 1
          }}>
              Continue Editing
            </button>
            <button onClick={() => {
            setShowExitConfirmDialog(false);
            onClose();
          }} style={{
            padding: '12px 24px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '8px',
            color: 'rgba(255, 255, 255, 0.8)',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            flex: 1
          }}>
              Discard Changes
            </button>
          </div>
        </div>
      </div>, document.body);
  };
  return <>
      <ExitDialog />
      
      {}
      {false && isOpen && currentStep >= 5 && formData.candleType && formData.background && <div style={{
      position: 'fixed',
      top: '-9999px',
      left: '-9999px',
      width: '1px',
      height: '1px',
      pointerEvents: 'none',
      visibility: 'hidden'
    }}>
          <CandleSnapshotRenderer isVisible={true} userData={{
        username: formData.username || 'Anonymous',
        imageUrl: imagePreview,
        candleType: formData.candleType,
        candleHeight: formData.candleHeight || 'medium',
        background: formData.background || 'synthwave',
        baseColor: formData.baseColor || '#ffffff'
      }} preloadOnly={true} />
        </div>}
      
      {}
      {!isOpen && showCandleSnapshot && savedCandleData && <div style={{
      position: 'relative',
      zIndex: 100000
    }} onClick={e => {
      if (!e.target.closest('.action-button')) {
        setShowCandleSnapshot(false);
        setSavedCandleData(null);
      }
    }}>
          
          <CandleSnapshotRenderer isVisible={true} userData={savedCandleData} instantCapture={false} onComplete={imageData => {}} />
        </div>}
      
      {}
      
      <style>{`
        @keyframes slideDown {
          from {
            transform: translate(-50%, -100%);
            opacity: 0;
          }
          to {
            transform: translate(-50%, 0);
            opacity: 1;
          }
        }
      `}</style>
      
      {!isOpen ? null : !isSignedIn ? <div style={{
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      zIndex: 999999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
          <div style={{
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)',
        border: '2px solid rgba(255, 102, 0, 0.5)',
        borderRadius: '16px',
        padding: '32px',
        width: '90%',
        maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8)',
        color: 'white',
        textAlign: 'center'
      }}>
            <h3 style={{
          color: '#ff6600',
          fontSize: '24px',
          marginBottom: '20px'
        }}>
              🕯️ Sign In Required
            </h3>
            <p style={{
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: '16px',
          lineHeight: '1.5',
          marginBottom: '20px'
        }}>
              Please sign in to create and light your candle. Your profile will be used to identify your candle in the display.
            </p>
            <button onClick={onClose} style={{
          padding: '12px 24px',
          background: 'linear-gradient(135deg, #ff6600 0%, #ff3300 100%)',
          border: 'none',
          borderRadius: '8px',
          color: '#fff',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 'bold'
        }}>
              Close
            </button>
          </div>
        </div> : <>
          <style>{`
        @keyframes tooltipFadeIn {
          0%, 100% {
            opacity: 0.9;
          }
          50% {
            opacity: 1;
          }
        }
        
        @keyframes rotateHand {
          0%, 100% {
            transform: rotate(0deg) translateX(0px);
          }
          25% {
            transform: rotate(-15deg) translateX(-10px);
          }
          75% {
            transform: rotate(15deg) translateX(10px);
          }
        }
        
        .rotate-tooltip {
          animation: tooltipFadeIn 4s ease-in-out infinite;
        }
        
        .rotate-hand {
          animation: rotateHand 2s ease-in-out infinite;
        }
        
        @keyframes subtle-glow {
          0%, 100% {
            filter: drop-shadow(0 20px 40px rgba(0, 0, 0, 0.5)) brightness(1);
          }
          50% {
            filter: drop-shadow(0 25px 50px rgba(255, 170, 0, 0.3)) brightness(1.1);
          }
        }
      `}</style>
      
      <div className="compact-modal-overlay" onClick={e => {
        if (e.target === e.currentTarget) {
          if (showPasswordDialog || showConfirmDialog) {
            return;
          }
          const modalContent = modalContentRef.current;
          if (modalContent) {
            const rect = modalContent.getBoundingClientRect();
            const margin = 150;
            if (e.clientX >= rect.left - margin && e.clientX <= rect.right + margin && e.clientY >= rect.top - margin && e.clientY <= rect.bottom + margin) {
              return;
            }
          }
          if (candleWasCreated) {
            onClose();
          } else {
            const hasUnsavedData = formData.username.trim() || formData.message.trim() || imageFile;
            if (hasUnsavedData) {
              setShowExitConfirmDialog(true);
            } else {
              onClose();
            }
          }
        }
      }}>
      <div className="compact-modal-content" ref={modalContentRef} onClick={e => e.stopPropagation()}>
        <button className="compact-modal-close" onClick={() => {
            if (candleWasCreated) {
              onClose();
            } else {
              const hasUnsavedData = formData.username.trim() || formData.message.trim() || imageFile;
              if (hasUnsavedData) {
                setShowExitConfirmDialog(true);
              } else {
                onClose();
              }
            }
          }}>×</button>
        
        <div className="compact-modal-layout">
          
          <div className={`compact-candle-preview ${currentStep === 4 ? 'message-step' : ''}`}>
            <div className="preview-label">Your Candle Preview</div>
            
            <div style={{
                width: '100%',
                height: 'calc(100% - 40px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: currentStep >= 5 ? 'none' : 'radial-gradient(circle at center, rgba(255, 170, 0, 0.03), transparent)',
                borderRadius: '12px',
                position: 'relative',
                overflow: 'hidden'
              }}>
              
              {!formData.candleType && currentStep === 1 ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'rgba(255, 255, 255, 0.3)',
                  fontSize: '14px',
                  textAlign: 'center'
                }}>
                  Select a candle type to see preview
                </div>
              ) : formData.candleType ? <Canvas camera={{
                  position: (currentStep === 5 || currentStep === 6) ? [0, -3, 9] : [0, -3, 9],
                  fov: 40
                }} style={{
                  background: 'transparent',
                  position: 'relative',
                  zIndex: 1
                }} dpr={window.devicePixelRatio} gl={{
                  antialias: true,
                  alpha: true,
                  powerPreference: "high-performance",
                  preserveDrawingBuffer: true,
                  outputColorSpace: THREE.SRGBColorSpace
                }}>
                  <ambientLight intensity={1.2} />
                  <directionalLight position={[5, 10, 5]} intensity={0.8} castShadow />
                  <pointLight position={[0, 3, 2]} intensity={0.5} color="#ffaa00" />
                  <pointLight position={[-3, 2, -2]} intensity={0.3} color="#ffffff" />
                  <Suspense fallback={null}>
                    {formData.candleType && <SimpleCandleViewer 
                      modelPath={
                        (currentStep === 5 || currentStep === 6 || (formData.background && currentStep > 4))
                          ? (formData.candleType === 'japanese' ? '/models/tinyJapCanBox.glb' : '/models/tinyVotiveBox.glb')
                          : (formData.candleType === 'japanese' ? '/models/tinyJapCanOnly.glb' : '/models/tinyVotiveOnly.glb')
                      } 
                      customImageUrl={imagePreview || imageFile ? imagePreview : null}
                      backgroundTexturePath={formData.background ? 
                        BACKGROUND_TEXTURES.find(bg => bg.id === formData.background)?.path : null
                      }
                      backgroundGradient={formData.background ? 
                        BACKGROUND_TEXTURES.find(bg => bg.id === formData.background)?.gradient : null
                      }
                      showPlaque={currentStep === 5 || currentStep === 6}
                      dedicationName={formData.username}
                      dedicationMessage={formData.message}
                      userAvatar={clerkImageUrl || imagePreview}
                      burnAmount={formData.burnedAmount}
                      baseColor={formData.baseColor}
                      backgroundId={formData.background}
                    />}
                  </Suspense>
                  <OrbitControls 
                    enablePan={false} 
                    enableZoom={true} 
                    minDistance={3} 
                    maxDistance={(currentStep === 5 || currentStep === 6) ? 12 : 10} 
                    minPolarAngle={Math.PI / 4} 
                    maxPolarAngle={Math.PI / 2}
                    // autoRotate={currentStep !== 5 && currentStep !== 6}
                    // autoRotateSpeed={2}
                    target={(currentStep === 5 || currentStep === 6) ? [0, -1, 0] : [0, 0, 0]}
                  />
                </Canvas> : <img src={formData.candleType === 'japanese' ? '/images/tinyJapCan.webp' : '/images/tinyVotive.webp'} alt={`${formData.candleType} candle`} style={{
                  width: 'auto',
                  height: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 20px 40px rgba(0, 0, 0, 0.5))',
                  animation: 'subtle-glow 3s ease-in-out infinite',
                  transform: 'scale(1.4)'
                }} />}
                
                {formData.username && <div style={{
                  position: 'absolute',
                  bottom: '20px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  textAlign: 'center',
                  color: '#ffd700',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
                }}>
                    <div style={{
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>
                      {formData.username}
                    </div>
                    {formData.messageType && <div style={{
                    fontSize: '12px',
                    marginTop: '5px',
                    opacity: 0.8
                  }}>
                        {formData.messageType === 'petition' && '🙏 Petition'}
                        {formData.messageType === 'confession' && '💭 Confession'}
                        {formData.messageType === 'praise' && '✨ Praise'}
                      </div>}
                  </div>}
              </div>
          </div>

          <div className={`compact-form-section ${currentStep === 4 ? 'message-step' : ''}`}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
              <h2 style={{
                  background: 'linear-gradient(45deg, #ff6600, #ffaa00, #ff6600, #ff3300)',
                  backgroundSize: '200% 200%',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: '0 0 40px rgba(255, 102, 0, 0.8)',
                  animation: 'flameGlow 2s ease-in-out infinite',
                  filter: 'drop-shadow(0 0 20px rgba(255, 102, 0, 0.5))',
                  fontWeight: 'bold'
                }}>Get Lit with RL80</h2>
            </div>
            
            <div className="step-indicator" style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '10px',
                gap: '8px'
              }}>
              {[1, 2, 3, 4, 5, 6].map(step => <div key={step} style={{
                  width: '40px',
                  height: '4px',
                  backgroundColor: currentStep >= step ? '#ffd700' : 'rgba(255, 215, 0, 0.2)',
                  borderRadius: '2px',
                  transition: 'background-color 0.3s ease'
                }} />)}
            </div>

            <div style={{
                paddingBottom: '100px'
              }}>
              {renderStepContent()}
            </div>
            
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '20px',
                paddingBottom: 'max(40px, env(safe-area-inset-bottom, 40px))',
                borderTop: '1px solid rgba(255, 215, 0, 0.2)',
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'linear-gradient(to top, rgba(10, 10, 10, 1), rgba(10, 10, 10, 0.98))',
                zIndex: 100,
                backdropFilter: 'blur(10px)'
              }}>
              <button onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePrev();
                }} style={{
                  padding: '10px 20px',
                  background: currentStep === 1 ? 'transparent' : 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 237, 78, 0.2))',
                  border: '1px solid rgba(255, 215, 0, 0.4)',
                  borderRadius: '8px',
                  color: currentStep === 1 ? 'rgba(255, 255, 255, 0.3)' : '#ffd700',
                  cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  opacity: currentStep === 1 ? 0.5 : 1,
                  position: 'relative',
                  zIndex: 101
                }} disabled={currentStep === 1}>
                Back
              </button>
              
              {currentStep < 6 ? <button onClick={handleNext} style={{
                  padding: '10px 30px',
                  background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#000',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)'
                }} disabled={currentStep === 1 && !formData.candleType || currentStep === 3 && !formData.messageType}>
                  Next
                </button> : <button onClick={handleConfirmedSave} style={{
                  padding: '10px 30px',
                  background: 'linear-gradient(135deg, #ff6b35, #ff9558)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  boxShadow: '0 4px 15px rgba(255, 107, 53, 0.4)'
                }} disabled={isSubmitting || !formData.messageType || !formData.candleType || !formData.username.trim() || !formData.burnedAmount || formData.burnedAmount === '0' || parseInt(formData.burnedAmount) === 0}>
                  {isSubmitting ? 'Lighting...' : 'Light Candle 🔥'}
                </button>}
            </div>
            
            {error && <div className="compact-error">{error}</div>}
            
            <form onSubmit={handleSubmit} style={{
                display: 'none'
              }}>
              
              <div className="compact-form-group" style={{
                  display: 'flex',
                  gap: '10px',
                  marginBottom: '12px'
                }}>
                
                <input type="text" name="username" value={formData.username} onChange={handleInputChange} onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                    }
                  }} placeholder="Name (on behalf of)" maxLength={50} required style={{
                    flex: '1',
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    color: '#fff',
                    fontSize: '14px'
                  }} />
                
                <div style={{
                    flex: '1.5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 215, 0, 0.3)'
                  }}>
                  <span style={{
                      color: 'rgba(255, 215, 0, 0.8)',
                      fontSize: '13px',
                      fontWeight: 'bold'
                    }}>
                    RL80:
                  </span>
                  
                  <div style={{
                      position: 'relative',
                      display: 'inline-block',
                      marginLeft: '5px'
                    }}>
                    <span style={{
                        fontSize: '12px',
                        cursor: 'help',
                        color: '#9ca3af',
                        fontWeight: 'bold'
                      }} title={`Illumin80: Exclusive status for top 8 burners${getIllumin80Threshold() ? ` (currently ${getIllumin80Threshold().toLocaleString()}+ RL80)` : '. Leaderboard loading...'}`}>
                      ℹ️
                    </span>
                  </div>
                  
                  {(() => {
                      const threshold = getIllumin80Threshold();
                      const currentAmount = parseInt(formData.burnedAmount) || 0;
                      if (!threshold || !currentAmount || currentAmount === 0) return null;
                      if (!wouldQualify) return null;
                      return <div style={{
                        position: 'relative',
                        display: 'inline-block',
                        marginLeft: '5px'
                      }}>
                        <span style={{
                          fontSize: '12px',
                          cursor: 'help',
                          color: '#10b981',
                          fontWeight: 'bold'
                        }} title={`✅ Qualifies for Illumin80! Your ${currentAmount.toLocaleString()} RL80 meets the top 8 threshold of ${threshold.toLocaleString()}`}>
                          👑
                        </span>
                      </div>;
                    })()}
                  <input type="text" name="burnedAmount" value={formData.burnedAmount} onChange={e => {
                      const value = e.target.value;
                      const numericValue = value.replace(/[^0-9]/g, '');
                      if (numericValue === '') {
                        setFormData(prev => ({
                          ...prev,
                          burnedAmount: ''
                        }));
                        return;
                      }
                      const parsed = parseInt(numericValue, 10);
                      if (parsed <= 999999999999999) {
                        setFormData(prev => ({
                          ...prev,
                          burnedAmount: parsed
                        }));
                      }
                    }} placeholder="1000" required style={{
                      flex: '1',
                      background: 'transparent',
                      border: 'none',
                      color: '#fff',
                      fontSize: '14px',
                      outline: 'none',
                      textAlign: 'right'
                    }} />
                  <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}>
                    <button type="button" onClick={() => {
                        const currentValue = parseInt(formData.burnedAmount) || 0;
                        const newValue = currentValue + 1000;
                        if (newValue <= 999999999999999) {
                          setFormData(prev => ({
                            ...prev,
                            burnedAmount: newValue
                          }));
                        }
                      }} style={{
                        background: 'rgba(255, 215, 0, 0.2)',
                        border: 'none',
                        borderRadius: '3px',
                        color: 'rgba(255, 215, 0, 0.8)',
                        cursor: 'pointer',
                        padding: '0 4px',
                        fontSize: '10px',
                        lineHeight: '1',
                        height: '12px'
                      }}>
                      ▲
                    </button>
                    <button type="button" onClick={() => {
                        const currentValue = parseInt(formData.burnedAmount) || 0;
                        const newValue = Math.max(0, currentValue - 1000);
                        setFormData(prev => ({
                          ...prev,
                          burnedAmount: newValue || ''
                        }));
                      }} style={{
                        background: 'rgba(255, 215, 0, 0.2)',
                        border: 'none',
                        borderRadius: '3px',
                        color: 'rgba(255, 215, 0, 0.8)',
                        cursor: 'pointer',
                        padding: '0 4px',
                        fontSize: '10px',
                        lineHeight: '1',
                        height: '12px'
                      }}>
                      ▼
                    </button>
                  </div>
                </div>
              </div>

              {(() => {
                  const threshold = getIllumin80Threshold();
                  const currentAmount = parseInt(formData.burnedAmount) || 0;
                  return <div style={{
                    margin: '12px 0',
                    padding: '10px 12px',
                    backgroundColor: 'rgba(212, 175, 55, 0.05)',
                    border: '1px solid rgba(212, 175, 55, 0.2)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    lineHeight: '1.4'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      marginBottom: '4px'
                    }}>
                      <span style={{
                        color: '#d4af37',
                        fontSize: '14px'
                      }}>✨</span>
                      <strong style={{
                        color: '#d4af37'
                      }}>Illumin80 Status</strong>
                    </div>
                    <p style={{
                      margin: 0,
                      fontSize: '11px'
                    }}>
                      The top 8 burners earn exclusive Illumin80 status with special privileges and recognition. 
                      {threshold ? <>
                          <br />
                          <span style={{
                          color: '#fbbf24'
                        }}>Current threshold: {threshold.toLocaleString()} RL80</span>
                          {currentAmount > 0 && currentAmount >= threshold && <span style={{
                          color: '#10b981',
                          fontWeight: 'bold'
                        }}> - You qualify! 👑</span>}
                        </> : <>
                          <br />
                          <span style={{
                          color: '#9ca3af'
                        }}>Loading current threshold...</span>
                        </>}
                    </p>
                  </div>;
                })()}

              {showAIPanel && <div style={{
                  margin: '15px 0',
                  padding: '15px',
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                  borderRadius: '12px',
                  border: '1px solid rgba(102, 126, 234, 0.3)'
                }}>
                  <div style={{
                    marginBottom: '12px'
                  }}>
                    <label style={{
                      fontSize: '13px',
                      color: '#fff',
                      marginBottom: '8px',
                      display: 'block'
                    }}>
                      Describe what you want to pray for:
                    </label>
                    <div style={{
                      display: 'flex',
                      gap: '8px'
                    }}>
                      <input type="text" value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="e.g., 'surviving a bear market' or 'finding the next moonshot'" disabled={isGenerating || remainingPrayers === 0} onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (!isGenerating && remainingPrayers > 0) {
                            handleAIGenerate();
                          }
                        }
                      }} style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        color: '#fff',
                        fontSize: '14px'
                      }} />
                      <button type="button" onClick={() => handleAIGenerate()} disabled={isGenerating || remainingPrayers === 0} style={{
                        padding: '8px 20px',
                        borderRadius: '8px',
                        backgroundColor: isGenerating ? '#666' : '#667eea',
                        color: '#fff',
                        border: 'none',
                        cursor: isGenerating || remainingPrayers === 0 ? 'not-allowed' : 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        minWidth: '100px'
                      }}>
                        {isGenerating ? '🤖 Generating...' : '🤖 Generate'}
                      </button>
                    </div>
                  </div>


                  {remainingPrayers === 0 && <div style={{
                    marginTop: '10px',
                    padding: '8px',
                    backgroundColor: 'rgba(255, 102, 0, 0.2)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#ff6600',
                    textAlign: 'center'
                  }}>
                      Daily limit reached. Try again tomorrow!
                    </div>}
                </div>}

              <div className="compact-form-group" style={{
                  display: 'flex',
                  gap: '10px',
                  marginBottom: '12px'
                }}>
                
                <select value={selectedPrayer || ''} onChange={e => {
                    const value = e.target.value;
                    if (value === '') {
                      setSelectedPrayer(null);
                    } else {
                      const prayers = PRAYERS_BY_LANGUAGE[currentLanguage]?.prayers || PRAYERS_BY_LANGUAGE.en.prayers;
                      const prayer = prayers.find(p => p.id === value);
                      if (prayer) {
                        setSelectedPrayer(value);
                        setFormData(prev => ({
                          ...prev,
                          message: prayer.text
                        }));
                      }
                    }
                  }} style={{
                    flex: '1',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    color: '#fff',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    fontSize: '14px',
                    cursor: 'pointer',
                    backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'rgba(255,215,0,0.8)\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 10px center',
                    backgroundSize: '18px',
                    appearance: 'none',
                    paddingRight: '35px'
                  }}>
                      <option value="">Preset Prayers</option>
                      {(PRAYERS_BY_LANGUAGE[currentLanguage]?.prayers || PRAYERS_BY_LANGUAGE.en.prayers).map(prayer => <option key={prayer.id} value={prayer.id}>
                            {currentLanguage === 'es' ? prayer.id === 'scalper' ? '⚡ Scalper' : prayer.id === 'leverage' ? '📊 Apalancado' : prayer.id === 'swing' ? '🌊 Swing' : prayer.id === 'hodler' ? '💎 Holdear' : prayer.id === 'chart' ? '📈 Gráficos' : prayer.title : currentLanguage === 'pt' ? prayer.id === 'scalper' ? '⚡ Scalper' : prayer.id === 'leverage' ? '📊 Alavancagem' : prayer.id === 'swing' ? '🌊 Swing' : prayer.id === 'hodler' ? '💎 Holder' : prayer.id === 'chart' ? '📈 Gráficos' : prayer.title : currentLanguage === 'fr' ? prayer.id === 'scalper' ? '⚡ Scalper' : prayer.id === 'leverage' ? '📊 Levier' : prayer.id === 'swing' ? '🌊 Swing' : prayer.id === 'hodler' ? '💎 Hodler' : prayer.id === 'chart' ? '📈 Graphiques' : prayer.title : currentLanguage === 'it' ? prayer.id === 'scalper' ? '⚡ Scalper' : prayer.id === 'leverage' ? '📊 Leva' : prayer.id === 'swing' ? '🌊 Swing' : prayer.id === 'hodler' ? '💎 Hodler' : prayer.id === 'chart' ? '📈 Grafici' : prayer.title : currentLanguage === 'zh' ? prayer.id === 'scalper' ? '⚡ 刷单' : prayer.id === 'leverage' ? '📊 杠杆' : prayer.id === 'swing' ? '🌊 波段' : prayer.id === 'hodler' ? '💎 囤币' : prayer.id === 'chart' ? '📈 图表' : prayer.title : currentLanguage === 'hi' ? prayer.id === 'scalper' ? '⚡ स्कैल्पर' : prayer.id === 'leverage' ? '📊 लीवरेज' : prayer.id === 'swing' ? '🌊 स्विंग' : prayer.id === 'hodler' ? '💎 होडलर' : prayer.id === 'chart' ? '📈 चार्ट' : prayer.title : prayer.id === 'scalper' ? '⚡ Scalper\'s Prayer' : prayer.id === 'leverage' ? '📊 Leverage Prayer' : prayer.id === 'swing' ? '🌊 Swing Trader\'s Prayer' : prayer.id === 'hodler' ? '💎 Hodler\'s Prayer' : prayer.id === 'chart' ? '📈 Chart Mystic\'s Prayer' : prayer.title}
                          </option>)}
                    </select>
                    
                <button type="button" onClick={() => setShowAIPanel(!showAIPanel)} title="AI Prayer Generator" style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    background: showAIPanel ? 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }} onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}>
                  🤖 AI Prayer
                </button>
              </div>
                  
              <div className="compact-form-group message-group">
                <textarea ref={textareaRef} name="message" value={formData.message} onChange={e => {
                    let newValue = e.target.value;
                    if (getByteLength(newValue) > 500) {
                      newValue = truncateToBytes(newValue, 500);
                      e.target.value = newValue;
                    }
                    const modifiedEvent = {
                      ...e,
                      target: {
                        ...e.target,
                        value: newValue,
                        name: 'message'
                      }
                    };
                    handleInputChange(modifiedEvent);
                    const currentPrayers = PRAYERS_BY_LANGUAGE[currentLanguage]?.prayers || PRAYERS_BY_LANGUAGE.en.prayers;
                    if (selectedPrayer && currentPrayers.find(p => p.id === selectedPrayer)?.text !== newValue) {
                      setSelectedPrayer(null);
                    }
                  }} placeholder={selectedPrayer ? "Edit the selected prayer or write your own..." : "Write your message, prayer, wish, or dedication (max 500 bytes)"} rows={2} maxLength={500} required disabled={isEncrypted} onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (e.shiftKey) {
                        return;
                      }
                    }
                  }} style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px',
                    paddingRight: '50px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    color: '#fff',
                    fontSize: '14px',
                    resize: 'vertical',
                    minHeight: '80px',
                    maxHeight: '150px'
                  }} />
                <span className="compact-char-count" style={{
                    position: 'absolute',
                    bottom: '12px',
                    right: '12px',
                    fontSize: '11px',
                    color: 'rgba(255, 215, 0, 0.5)',
                    pointerEvents: 'none'
                  }}>{getByteLength(formData.message)}/500 bytes</span>
              </div>

              <div className="compact-form-group" style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'stretch',
                  marginBottom: '12px'
                }}>
                
                <label className="compact-file-label" style={{
                    flex: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '10px',
                    backgroundColor: imageFile || imagePreview ? 'rgba(0, 255, 0, 0.1)' : 'rgba(255, 102, 0, 0.1)',
                    border: imageFile || imagePreview ? '1px solid rgba(0, 255, 0, 0.3)' : '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    margin: 0,
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }} onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }} onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}>
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleImageChange} className="compact-file-input" />
                  <span style={{
                      color: imageFile || imagePreview ? '#00ff00' : 'rgba(255, 215, 0, 0.8)',
                      fontWeight: '600',
                      fontSize: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                    {imageFile ? <>📷 Custom</> : imagePreview && !imageFile ? <>👤 Image</> : <>📷 Add Image</>}
                  </span>
                </label>
                
              </div>


              
              <div className="compact-form-actions" style={{
                  display: 'flex',
                  gap: '10px',
                  marginTop: '16px'
                }}>
                <button type="button" onClick={onClose} className="compact-btn-cancel" disabled={isSubmitting} style={{
                    flex: 1,
                    padding: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '8px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease'
                  }}>
                  Cancel
                </button>
                <button type="submit" className="compact-btn-submit" disabled={isSubmitting || !formData.username.trim() || !formData.message.trim() || !formData.burnedAmount || formData.burnedAmount === '0' || parseInt(formData.burnedAmount) === 0} title={!formData.username.trim() || !formData.message.trim() ? 'Please fill in all required fields' : (!formData.burnedAmount || formData.burnedAmount === '0' ? 'Please select an amount of tokens to burn' : 'Review and light your candle')} style={{
                    flex: 1,
                    padding: '12px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    transition: 'all 0.2s ease'
                  }}>
                  {isSubmitting ? <span>Creating...</span> : <span>🕯️ Light Candle</span>}
                </button>
              </div>

              {error && <div className="compact-error">{error}</div>}

            </form>
          </div>
        </div>
      </div>
    </div>
        </>}
    </>;
}