import { useEffect, useRef, useState } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { Canvas } from "@react-three/fiber";

// Internal 3D model component
function AngelModel({ 
  position = [-2, 0, 0],
  rotation = [0, 0.3, 0],
  scale = [8, 8, 8],
  onLoad
}) {
  const groupRef = useRef();
  const { scene } = useThree();
  const hasLoadedRef = useRef(false);
  const mixerRef = useRef();
  const actionsRef = useRef({});

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const gltfLoader = new GLTFLoader();
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    gltfLoader.setDRACOLoader(dracoLoader);

    // console.log('Loading angelOfCurrencies.glb...');
    
    gltfLoader.load("/models/angelOfCurrencies.glb", (gltf) => {
      // console.log('✓ angelOfCurrencies.glb loaded successfully');
      
      const angelScene = gltf.scene;
      
      // Create an anchor group for positioning
      const anchorGroup = new THREE.Group();
      anchorGroup.position.set(...position);
      anchorGroup.rotation.set(...rotation);
      anchorGroup.scale.set(...scale);
      
      // Add the angel scene to the anchor group
      anchorGroup.add(angelScene);
      
      // Create and store the animation mixer if animations exist
      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(angelScene);
        mixerRef.current = mixer;

        // Store all actions for later use
        gltf.animations.forEach((animation) => {
          const animName = animation.name;
          const action = mixer.clipAction(animation);
          actionsRef.current[animName] = action;
          
          // Auto-play any idle or floating animations
          if (animName.toLowerCase().includes('idle') || 
              animName.toLowerCase().includes('float') ||
              animName.toLowerCase().includes('hover')) {
            action.play();
            // console.log(`Playing angel animation: ${animation.name}`);
          }
        });
        
        // console.log('Angel animations available:', gltf.animations.map(a => a.name));
      }
      
      // Add the anchor group to the scene
      scene.add(anchorGroup);
      
      // Store reference for cleanup
      if (groupRef.current) {
        groupRef.current = anchorGroup;
      }
      
      // Call onLoad callback if provided
      if (onLoad) {
        setTimeout(() => {
          onLoad();
        }, 100);
      }
    }, 
    (progress) => {
      // console.log('Angel loading progress:', (progress.loaded / progress.total * 100) + '%');
    },
    (error) => {
      console.error('Error loading angelOfCurrencies.glb:', error);
      // Still call onLoad even if there's an error
      if (onLoad) {
        setTimeout(() => {
          onLoad();
        }, 100);
      }
    });

    // Cleanup function
    return () => {
      if (groupRef.current) {
        // Remove from scene
        scene.remove(groupRef.current);
        
        // Dispose of materials and geometries
        groupRef.current.traverse((child) => {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      }
      
      // Cleanup mixer
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }
    };
  }, [scene, position, rotation, scale, onLoad]);

  // Animation loop
  useFrame((_, delta) => {
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
  });

  // Add subtle floating animation via group ref
  useFrame(({ clock }) => {
    if (groupRef.current) {
      const time = clock.getElapsedTime();
      // Gentle floating motion
      groupRef.current.position.y = position[1] + Math.sin(time * 0.5) * 0.2;
      // Slight side-to-side sway
      groupRef.current.rotation.z = rotation[2] + Math.sin(time * 0.3) * 0.05;
    }
  });

  return null; // This component doesn't render JSX, it manipulates the Three.js scene directly
}

// Main wrapper component with its own Canvas
function AngelOfCurrencies({ 
  isMobile = false,
  style = {},
  onLoad
}) {
  const [modelLoaded, setModelLoaded] = useState(false);

  const handleModelLoad = () => {
    // console.log('✅ Angel model loaded successfully!');
    setModelLoaded(true);
    if (onLoad) onLoad();
  };

  return (
    <div style={{
      position: 'absolute',
      left: isMobile ? '-40%' : '-30%',
      top: isMobile ? '-1rem' : '20%',
      transform: 'translateY(-50%)',
      width: isMobile ? '100%' : '60%',
      height: isMobile ? '18rem' : '400px',
      pointerEvents: 'none',
      zIndex: 5,
      ...style
    }}>
      
      <Canvas
        camera={{ 
          position: [0, 0, 8], 
          fov: 60,
          near: 0.1,
          far: 100
        }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: isMobile ? "low-power" : "high-performance"
        }}
        style={{
          background: 'transparent',
          width: '100%',
          height: '100%'
        }}
      >
        {/* Match the main scene's lighting setup */}
        <ambientLight intensity={0.5} />
        <hemisphereLight 
          skyColor="#11c3f4c7" 
          groundColor="#ff00cc" 
          intensity={1.2} 
        />
        <directionalLight 
          position={[-20, 10, -10]} 
          color="#ff50ee" 
          intensity={1.5}
        />
        <spotLight 
          position={[7.4, 28, 19.9]}
          color="#ffac00"
          angle={0.02}
          decay={0.97}
          distance={300}
          penumbra={-0.3}
          intensity={77}
        />
        <AngelModel
          position={isMobile ? [0, 0.7, 0] : [0, -1.5, 0]}
          rotation={[0, 0.3, 0]}
          scale={isMobile ? [5, 5, 5] : [8.2, 8.2, 8.2]}
          onLoad={handleModelLoad}
        />
      </Canvas>
    </div>
  );
}

export default AngelOfCurrencies;