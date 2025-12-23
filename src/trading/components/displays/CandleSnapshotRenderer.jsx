// 'use client';

// import React, { useRef, useEffect, useState } from 'react';
// import { Canvas } from '@react-three/fiber';
// import { useGLTF, OrbitControls } from '@react-three/drei';
// import * as THREE from 'three';
// import PolaroidSnapshot from '@/components/PolaroidSnapshot';

// // Candle scene component (similar to FloatingCandleViewer but optimized for snapshot)
// function CandleScene({ userData, onReady }) {
//   const { scene, animations } = useGLTF("/models/singleCandleAnimatedFlame.glb");
//   const candleRef = useRef();
//   const mixerRef = useRef(null);
//   const spotlightRef = useRef();
//   const flamePointLightRef = useRef();
  
//   useEffect(() => {
//     if (!scene) return;
    
//     // Clone the scene to avoid conflicts
//     const clonedScene = scene.clone();
    
//     // Apply user image to label if provided
//     if (userData?.imageUrl) {
//       clonedScene.traverse((child) => {
//         if (child.name.includes("Label2") && child.isMesh) {
//           // Create texture from user image
//           const textureLoader = new THREE.TextureLoader();
//           textureLoader.load(userData.imageUrl, (texture) => {
//             texture.wrapS = THREE.ClampToEdgeWrapping;
//             texture.wrapT = THREE.ClampToEdgeWrapping;
//             texture.repeat.set(1, -1); // Flip vertically to fix upside-down issue
//             texture.offset.set(0, 1);
//             texture.colorSpace = THREE.SRGBColorSpace;
            
//             child.material = new THREE.MeshStandardMaterial({
//               map: texture,
//               emissive: new THREE.Color(0xff6600),
//               emissiveIntensity: 0.2, // Reduced to preserve texture colors
//               roughness: 0.8,
//               metalness: 0.1, // Less metallic for better color accuracy
//               side: THREE.DoubleSide,
//             });
            
//             // Signal that the scene is ready for capture
//             if (onReady) {
//               setTimeout(onReady, 1000); // Give more time to render properly
//             }
//           });
//         }
//       });
//     } else {
//       // No image, scene is ready immediately
//       if (onReady) {
//         setTimeout(onReady, 500);
//       }
//     }
    
//     // Set up animation for flame
//     if (animations && animations.length > 0) {
//       mixerRef.current = new THREE.AnimationMixer(clonedScene);
//       animations.forEach((clip) => {
//         const action = mixerRef.current.clipAction(clip);
//         action.play();
//       });
//     }
    
//     // Add to scene
//     if (candleRef.current) {
//       candleRef.current.add(clonedScene);
      
//       // Position spotlight after candle is added
//       if (spotlightRef.current && candleRef.current) {
//         const box = new THREE.Box3().setFromObject(candleRef.current);
//         const center = box.getCenter(new THREE.Vector3());
        
//         spotlightRef.current.position.set(center.x, center.y + 3, center.z + 2);
//         spotlightRef.current.target.position.set(
//           center.x,
//           center.y + 1.5,
//           center.z
//         );
//         spotlightRef.current.target.updateMatrixWorld();
//       }
//     }
    
//     return () => {
//       if (mixerRef.current) {
//         mixerRef.current.stopAllAction();
//       }
//     };
//   }, [scene, animations, userData, onReady]);
  
//   // Animation frame update
//   useEffect(() => {
//     let animationId;
//     const animate = () => {
//       if (candleRef.current && flamePointLightRef.current) {
//         // Get the world position of the candle
//         const box = new THREE.Box3().setFromObject(candleRef.current);
//         const center = box.getCenter(new THREE.Vector3());
        
//         // Position the light at the top of the candle
//         flamePointLightRef.current.position.set(
//           center.x,
//           center.y + 1.8, // Adjust this value to position at flame height
//           center.z
//         );
//       }
      
//       // Update animation mixer if it exists
//       if (mixerRef.current) {
//         mixerRef.current.update(0.016); // Update with approximately 60fps timing
//       }
      
//       animationId = requestAnimationFrame(animate);
//     };
    
//     animate();
    
//     return () => {
//       if (animationId) {
//         cancelAnimationFrame(animationId);
//       }
//     };
//   }, []);
  
//   return (
//     <>
//       {/* <ambientLight intensity={0.3} color="#ffffff" />   */}
//       {/* <directionalLight 
//         position={[5, 8, 5]} 
//         intensity={0.8}  // Reduced from 1.2
//         color="#ffffff"
//         castShadow
//       />
//       <directionalLight 
//         position={[-3, 5, 3]} 
//         intensity={0.4}  // Reduced from 0.6
//         color="#fff5ee" // Softer warm fill
//       />
//       <pointLight 
//         position={[0, 2, 4]} 
//         intensity={0.5}  // Reduced from 0.8
//         color="#ffaa66" // Warm candle glow
//       />
//       <pointLight 
//         position={[0, 0.5, 0]} 
//         intensity={1.0}  // Reduced from 1.5
//         color="#ff8833" // Orange glow at flame
//         distance={3}
//       />
//       <spotLight
//         position={[0, 10, 0]}
//         angle={0.5}
//         penumbra={0.5}
//         intensity={0.2}  // Reduced from 0.3
//         color="#ffffff" // Top down rim light
//       /> */}
//        <ambientLight intensity={2} />

//         {/* Spotlight for general candle illumination */}
//         <spotLight
//           ref={spotlightRef}
//           intensity={1.5}
//           angle={0.4}
//           penumbra={0.5}
//           distance={5}
//           castShadow={false}
//           color="#ffedd0"
//         />

//         {/* Point light that will always follow the flame area */}
//         <pointLight
//           ref={flamePointLightRef}
//           intensity={2.0}
//           distance={3}
//           color="#ff9c5e"
//           decay={2}
//         />
//       <group ref={candleRef} scale={[1.8, 1.8, 1.8]} position={[0, -1.8, 0]} /> {/* Adjusted scale and position to show full candle */}
//       <OrbitControls 
//         enableZoom={false}
//         enablePan={false}
//         autoRotate={true}
//         autoRotateSpeed={0.5}
//         minPolarAngle={Math.PI / 3}
//         maxPolarAngle={Math.PI / 2}
//       />
//     </>
//   );
// }

// // Main component that combines candle renderer with polaroid snapshot
// export default function CandleSnapshotRenderer({ 
//   isVisible, 
//   userData, 
//   onComplete,
//   onShare,
//   preloadOnly = false,
//   onReady,
//   instantCapture = false
// }) {
//   const [triggerSnapshot, setTriggerSnapshot] = useState(false);
//   const [sceneReady, setSceneReady] = useState(false);
//   const [showLoading, setShowLoading] = useState(!preloadOnly && !instantCapture);
//   const canvasRef = useRef();
  
//   // Trigger snapshot once scene is ready
//   useEffect(() => {
//     if (sceneReady && isVisible) {
//       // If preloading, just notify ready
//       if (preloadOnly && onReady) {
//         onReady();
//         return;
//       }
      
//       // If instant capture, trigger immediately
//       if (instantCapture) {
//         setShowLoading(false);
//         setTriggerSnapshot(true);
//         return;
//       }
      
//       // Normal flow with loading indicator
//       const timer = setTimeout(() => {
//         setShowLoading(false);
//         setTriggerSnapshot(true);
//       }, 1500); // Reduced from 3000ms
      
//       return () => clearTimeout(timer);
//     }
//   }, [sceneReady, isVisible, preloadOnly, instantCapture, onReady]);
  
//   const handleSceneReady = () => {
//     setSceneReady(true);
//   };
  
//   const handleSnapshotComplete = (imageData) => {
//     // Don't reset immediately - keep the snapshot visible
//     // The user can dismiss it when they're done
    
//     // Notify parent after a delay
//     if (onComplete) {
//       setTimeout(() => {
//         onComplete(imageData);
//       }, 5000); // Give user time to interact with polaroid
//     }
//   };
  
//   if (!isVisible) return null;
  
//   return (
//     <>
//       {/* Loading indicator with full-screen backdrop */}
//       {showLoading && isVisible && (
//         <>
//           {/* Full screen backdrop with blur */}
//           <div style={{
//             position: 'fixed',
//             top: 0,
//             left: 0,
//             right: 0,
//             bottom: 0,
//             background: 'rgba(0, 0, 0, 0.75)',
//             backdropFilter: 'blur(8px)',
//             WebkitBackdropFilter: 'blur(8px)',
//             zIndex: 99997,
//             animation: 'fadeIn 0.3s ease',
//           }} />
          
//           {/* Centered message card */}
//           <div style={{
//             position: 'fixed',
//             top: '50%',
//             left: '50%',
//             transform: 'translate(-50%, -50%)',
//             zIndex: 99998,
//             background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(0, 20, 0, 0.9) 100%)',
//             padding: '40px 50px',
//             borderRadius: '20px',
//             border: '2px solid rgba(0, 255, 0, 0.3)',
//             boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 120px rgba(0, 255, 0, 0.1)',
//             display: 'flex',
//             flexDirection: 'column',
//             alignItems: 'center',
//             gap: '25px',
//             animation: 'slideUp 0.4s ease',
//             minWidth: '320px'
//           }}>
//             {/* Success header */}
//             <div style={{
//               display: 'flex',
//               flexDirection: 'column',
//               alignItems: 'center',
//               gap: '12px'
//             }}>
//               <div style={{
//                 fontSize: '48px',
//                 animation: 'bounce 1s ease infinite'
//               }}>
//                 🕯️
//               </div>
//               <h2 style={{
//                 color: '#00ff00',
//                 fontSize: '24px',
//                 fontWeight: 'bold',
//                 margin: 0,
//                 textAlign: 'center',
//                 textShadow: '0 0 20px rgba(0, 255, 0, 0.5)'
//               }}>
//                 Your candle has been lit! ✨
//               </h2>
//             </div>
            
//             {/* Loading animation */}
//             <div style={{
//               display: 'flex',
//               alignItems: 'center',
//               gap: '15px'
//             }}>
//               <div style={{
//                 width: '24px',
//                 height: '24px',
//                 borderRadius: '50%',
//                 background: 'conic-gradient(from 0deg, transparent, #00ff00)',
//                 animation: 'spin 1s linear infinite',
//                 boxShadow: '0 0 20px rgba(0, 255, 0, 0.5)'
//               }} />
//               <div style={{
//                 color: 'rgba(255, 255, 255, 0.8)',
//                 fontSize: '16px',
//                 fontWeight: '400'
//               }}>
//                 Creating your snapshot...
//               </div>
//             </div>
            
//             {/* Progress dots */}
//             <div style={{
//               display: 'flex',
//               gap: '8px'
//             }}>
//               {[0, 1, 2].map(i => (
//                 <div key={i} style={{
//                   width: '8px',
//                   height: '8px',
//                   borderRadius: '50%',
//                   background: 'rgba(0, 255, 0, 0.5)',
//                   animation: `pulse 1.5s ease infinite ${i * 0.3}s`
//                 }} />
//               ))}
//             </div>
//           </div>
          
//           <style jsx>{`
//             @keyframes fadeIn {
//               from { opacity: 0; }
//               to { opacity: 1; }
//             }
//             @keyframes slideUp {
//               from { 
//                 opacity: 0;
//                 transform: translate(-50%, -40%);
//               }
//               to { 
//                 opacity: 1;
//                 transform: translate(-50%, -50%);
//               }
//             }
//             @keyframes spin {
//               0% { transform: rotate(0deg); }
//               100% { transform: rotate(360deg); }
//             }
//             @keyframes bounce {
//               0%, 100% { transform: translateY(0); }
//               50% { transform: translateY(-10px); }
//             }
//             @keyframes pulse {
//               0%, 100% { 
//                 opacity: 0.3;
//                 transform: scale(1);
//               }
//               50% { 
//                 opacity: 1;
//                 transform: scale(1.2);
//               }
//             }
//           `}</style>
//         </>
//       )}
      
//       {/* Hidden canvas for rendering the candle */}
//       <div
//         style={{
//           position: 'fixed',
//           top: '50%',
//           left: '50%',
//           transform: 'translate(-50%, -50%)',
//           width: '600px',
//           height: '600px',
//           opacity: 0.01, // Very slight opacity to ensure rendering
//           pointerEvents: 'none',
//           zIndex: 1, // Above page but below modal
//         }}
//       >
//         <Canvas
//           ref={canvasRef}
//           id="candle-snapshot-canvas"
//           camera={{ 
//             position: [0, 0.5, 8.5], // Pulled back more to show full candle
//             fov: 35 // Slightly narrower FOV for better perspective
//           }}
//           gl={{
//             preserveDrawingBuffer: true,
//             antialias: true,
//             alpha: false,
//             outputColorSpace: 'srgb', // Ensure correct color space
//             toneMapping: THREE.ACESFilmicToneMapping, // Better color reproduction
//             toneMappingExposure: 1.2, // Slightly brighter exposure
//           }}
//         >
//           {/* Gradient background */}
//           <color attach="background" args={['#0f0820']} /> {/* Deep purple-black */}
          
//           {/* Background gradient planes */}
//           <mesh position={[0, 0, -8]} rotation={[0, 0, 0]}>
//             <planeGeometry args={[30, 30]} />
//             <meshBasicMaterial color="#2a1650" transparent opacity={0.6} />
//           </mesh>
          
//           <mesh position={[0, 3, -10]} rotation={[0, 0, 0]}>
//             <planeGeometry args={[30, 15]} />
//             <meshBasicMaterial color="#ff6b35" transparent opacity={0.3} />
//           </mesh>
          
//           <mesh position={[0, -3, -9]} rotation={[0, 0, 0]}>
//             <planeGeometry args={[30, 15]} />
//             <meshBasicMaterial color="#1a0f2e" transparent opacity={0.4} />
//           </mesh>
          
//           {/* Add fog for atmospheric depth */}
//           <fog attach="fog" args={['#0f0820', 8, 20]} />
          
//           <CandleScene 
//             userData={userData} 
//             onReady={handleSceneReady}
//           />
//         </Canvas>
//       </div>
      
//       {/* Polaroid snapshot component - only show when not preloading */}
//       {!preloadOnly && (
//         <PolaroidSnapshot 
//           trigger={triggerSnapshot}
//           onComplete={handleSnapshotComplete}
//           captureElementId="candle-snapshot-canvas"
//           label={`${userData?.username || 'Anonymous'}'s Candle`}
//         />
//       )}
//     </>
//   );
// }