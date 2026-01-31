import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { useGLTF, Html } from "@react-three/drei";

// Preload the model
useGLTF.preload('/models/MOBILE2.glb');




const CyborgTempleScene = ({
  onLoad,
  position = [0, 1, 0],
  rotation = [0, 0, 0],
  scale = [1.2, 1.2, 1.2],
  isMobile = false,
  onCoinTap = null, // Callback when a coin is tapped: (coinName) => void
}) => {
  const groupRef = useRef();
  const { scene, camera, gl } = useThree();
  // Store multiple mixers for each animated character
  const [loadedModel, setLoadedModel] = useState(null);
  const [detectedMobile, setDetectedMobile] = useState(false);

  // Load the appropriate model based on device
  const modelPath = isMobile ? '/models/MOBILE2.glb' : '/models/MOBILE2.glb';
  const gltf = useGLTF(modelPath);
  const hasReportedLoad = useRef(false);
  
  // Refs for MOBILE.glb animated objects
  const coin1Ref = useRef();
  const coin2Ref = useRef();
  const coin3Ref = useRef();
  const coin4Ref = useRef();
  
  // Camera focus state
  const [focusTarget, setFocusTarget] = useState(null);
  const originalCameraPosition = useRef(null); // Store original camera position
  
  // Hover state for coins
  const [hoveredCoin, setHoveredCoin] = useState(null);
  const coin1OriginalScale = useRef(null);
  const coin1OriginalEmissive = useRef(null);
  const coin2OriginalScale = useRef(null);
  const coin2OriginalEmissive = useRef(null);
  const coin3OriginalScale = useRef(null);
  const coin3OriginalEmissive = useRef(null);
  const coin4OriginalScale = useRef(null);
  const coin4OriginalEmissive = useRef(null);
  
  // Click animation state for coins
  const [clickedCoin, setClickedCoin] = useState(null);
  const coinAnimationState = useRef({
    Coin1: { isAnimating: false, startTime: 0, flutterIntensity: 0 },
    Coin2: { isAnimating: false, startTime: 0, flutterIntensity: 0 },
    Coin3: { isAnimating: false, startTime: 0, flutterIntensity: 0 },
    Coin4: { isAnimating: false, startTime: 0, flutterIntensity: 0 }
  });
  
  
  // Detect mobile device on mount
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase()) ||
                             (window.innerWidth <= 768);
      setDetectedMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // State to track Coin positions for emoji overlays
  const [coin1Position, setCoin1Position] = useState(null);
  const [coin2Position, setCoin2Position] = useState(null);
  const [coin3Position, setCoin3Position] = useState(null);
  const [coin4Position, setCoin4Position] = useState(null);


  // Report load when model is ready and find Coins
  useEffect(() => {
    if (gltf && !hasReportedLoad.current) {
      if (onLoad) onLoad();
      hasReportedLoad.current = true;

      // Traverse model to find Coins and get their positions
      gltf.scene.traverse((child) => {
        if (child.name === 'Coin1') {
          console.log('Found Coin1:', child.name, child.position);
          coin1Ref.current = child;
          setCoin1Position([child.position.x, child.position.y, child.position.z]);
        }
        if (child.name === 'Coin2') {
          console.log('Found Coin2:', child.name, child.position);
          coin2Ref.current = child;
          setCoin2Position([child.position.x, child.position.y, child.position.z]);
        }
        if (child.name === 'Coin3') {
          console.log('Found Coin3:', child.name, child.position);
          coin3Ref.current = child;
          setCoin3Position([child.position.x, child.position.y, child.position.z]);
        }
        if (child.name === 'Coin4') {
          console.log('Found Coin4:', child.name, child.position);
          coin4Ref.current = child;
          setCoin4Position([child.position.x, child.position.y, child.position.z]);
        }
      });
    }
  }, [gltf, onLoad]);


  

  


  
  // Add raycaster for tap detection
  useEffect(() => {
    if (!groupRef.current || !gl) return;

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
  
    
    // Touch events for mobile and tablets
    const handleTouchStart = (event) => {
      // Don't prevent default for better touch compatibility
      // event.preventDefault();

      // Safety check for groupRef
      if (!groupRef.current) return;

      // For touchend events, use changedTouches instead of touches
      const touch = event.touches ? event.touches[0] : event.changedTouches[0];
      if (!touch) return; // Safety check

      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(groupRef.current.children, true);
      
      for (let i = 0; i < intersects.length; i++) {
        const object = intersects[i].object;
        
        if (object.userData.isCoin) {
          // Prevent default only when we're actually interacting with a coin and it's cancelable
          if (event.cancelable) {
            event.preventDefault();
          }
          
          // Trigger coin animation
          const coinName = object.userData.agentId;
          triggerCoinAnimation(coinName);
          
          // Also trigger the card display
          if (onAgentClick) {
            onAgentClick(coinName);
          }
          break;
        }
      }
    };
    
    // Function to trigger coin click animation
    const triggerCoinAnimation = (coinName) => {
      const animState = coinAnimationState.current[coinName];
      if (animState) {
        animState.isAnimating = true;
        animState.startTime = Date.now();
        animState.flutterIntensity = 1.0;
        setClickedCoin(coinName);
        
        // Reset after animation completes
        setTimeout(() => {
          animState.isAnimating = false;
          animState.flutterIntensity = 0;
          setClickedCoin(null);
        }, 1500); // 1.5 second animation
      }
    };
    
    // Handle tap on coins
    const handleTap = (event) => {
      if (!groupRef.current) return;

      const rect = gl.domElement.getBoundingClientRect();
      let clientX, clientY;

      // Handle both touch and click events
      if (event.touches && event.touches[0]) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else if (event.changedTouches && event.changedTouches[0]) {
        clientX = event.changedTouches[0].clientX;
        clientY = event.changedTouches[0].clientY;
      } else {
        clientX = event.clientX;
        clientY = event.clientY;
      }

      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(groupRef.current.children, true);

      let foundCoin = null;
      for (let i = 0; i < intersects.length; i++) {
        let object = intersects[i].object;
        // Traverse up parent chain to find a parent named Coin1, Coin2, etc.
        while (object) {
          if (object.name && object.name.startsWith('Coin')) {
            foundCoin = object.name;
            break;
          }
          object = object.parent;
        }
        if (foundCoin) break;
      }

      if (foundCoin) {
        // Call the callback if provided, including tap position
        if (onCoinTap) {
          onCoinTap(foundCoin, { x: clientX, y: clientY });
        }
      }
    };

    // Add touch event listeners - use only one to prevent double firing
    let lastTapTime = 0;
    const handleTapDebounced = (event) => {
      const now = Date.now();
      if (now - lastTapTime < 300) return; // Debounce 300ms
      lastTapTime = now;
      handleTap(event);
    };

    gl.domElement.addEventListener('touchend', handleTapDebounced);
    gl.domElement.addEventListener('click', handleTapDebounced);

    return () => {
      gl.domElement.removeEventListener('touchend', handleTapDebounced);
      gl.domElement.removeEventListener('click', handleTapDebounced);
    };
  }, [gl, camera, loadedModel, focusTarget, originalCameraPosition, hoveredCoin, 
      coin1OriginalScale, coin1OriginalEmissive, coin2OriginalScale, coin2OriginalEmissive,
      coin3OriginalScale, coin3OriginalEmissive, coin4OriginalScale, coin4OriginalEmissive, 
     clickedCoin]); // Added dependencies

  



  // Clone the scene to avoid issues with cached/shared GLTF
  const clonedScene = useMemo(() => {
    if (gltf?.scene) {
      return gltf.scene.clone();
    }
    return null;
  }, [gltf]);

  // Refs for cloned coin meshes and their original positions
  const clonedCoin1Ref = useRef(null);
  const clonedCoin2Ref = useRef(null);
  const clonedCoin3Ref = useRef(null);
  const clonedCoin4Ref = useRef(null);
  const coinOriginalY = useRef({});
  const coinOriginalScale = useRef({});

  // Refs for emoji groups to follow coins
  const emoji1GroupRef = useRef(null);
  const emoji2GroupRef = useRef(null);
  const emoji3GroupRef = useRef(null);
  const emoji4GroupRef = useRef(null);


  // Find and store refs to coin meshes in the cloned scene
  useEffect(() => {
    if (clonedScene) {
      clonedScene.traverse((child) => {
        if (child.name === 'Coin1') {
          clonedCoin1Ref.current = child;
          coinOriginalY.current.coin1 = child.position.y;
          coinOriginalScale.current.coin1 = child.scale.x;
          child.userData.clickable = true;
          child.userData.isCoin = true;
          child.userData.agentId = 'Coin1';
          // Enable raycast on coin and all its children
          child.traverse((c) => {
            if (c.isMesh) {
              c.raycast = THREE.Mesh.prototype.raycast;
              c.userData.isCoin = true;
              c.userData.agentId = 'Coin1';
            }
          });
        }
        if (child.name === 'Coin2') {
          clonedCoin2Ref.current = child;
          coinOriginalY.current.coin2 = child.position.y;
          child.userData.clickable = true;
          child.userData.isCoin = true;
          child.userData.agentId = 'Coin2';
          child.traverse((c) => {
            if (c.isMesh) {
              c.raycast = THREE.Mesh.prototype.raycast;
              c.userData.isCoin = true;
              c.userData.agentId = 'Coin2';
            }
          });
        }
        if (child.name === 'Coin3') {
          clonedCoin3Ref.current = child;
          coinOriginalY.current.coin3 = child.position.y;
          child.userData.clickable = true;
          child.userData.isCoin = true;
          child.userData.agentId = 'Coin3';
          child.traverse((c) => {
            if (c.isMesh) {
              c.raycast = THREE.Mesh.prototype.raycast;
              c.userData.isCoin = true;
              c.userData.agentId = 'Coin3';
            }
          });
        }
        if (child.name === 'Coin4') {
          clonedCoin4Ref.current = child;
          coinOriginalY.current.coin4 = child.position.y;
          child.userData.clickable = true;
          child.userData.isCoin = true;
          child.userData.agentId = 'Coin4';
          child.traverse((c) => {
            if (c.isMesh) {
              c.raycast = THREE.Mesh.prototype.raycast;
              c.userData.isCoin = true;
              c.userData.agentId = 'Coin4';
            }
          });
        }
      });
    }
  }, [clonedScene]);

  // Animate coins with subtle floating effect and sync emoji positions
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const floatAmount = 0.008; // Subtle float distance

    if (clonedCoin1Ref.current && coinOriginalY.current.coin1 !== undefined) {
      const newY = coinOriginalY.current.coin1 + Math.sin(t * 1.5) * floatAmount;
      clonedCoin1Ref.current.position.y = newY;
      if (emoji1GroupRef.current) {
        emoji1GroupRef.current.position.y = newY + 0.07;
      }
    }
    if (clonedCoin2Ref.current && coinOriginalY.current.coin2 !== undefined) {
      const newY = coinOriginalY.current.coin2 + Math.sin(t * 1.3 + 1) * floatAmount;
      clonedCoin2Ref.current.position.y = newY;
      if (emoji2GroupRef.current) {
        emoji2GroupRef.current.position.y = newY + 0.07;
      }
    }
    if (clonedCoin3Ref.current && coinOriginalY.current.coin3 !== undefined) {
      const newY = coinOriginalY.current.coin3 + Math.sin(t * 1.7 + 2) * floatAmount;
      clonedCoin3Ref.current.position.y = newY;
      if (emoji3GroupRef.current) {
        emoji3GroupRef.current.position.y = newY + 0.07;
      }
    }
    if (clonedCoin4Ref.current && coinOriginalY.current.coin4 !== undefined) {
      const newY = coinOriginalY.current.coin4 + Math.sin(t * 1.4 + 3) * floatAmount;
      clonedCoin4Ref.current.position.y = newY;
      if (emoji4GroupRef.current) {
        emoji4GroupRef.current.position.y = newY + 0.07;
      }
    }
  });

  // Always return the group that contains the model
  return (
    <group ref={groupRef} visible={true} position={position} scale={scale} rotation={rotation}>
      {clonedScene && (
        <primitive object={clonedScene} />
      )}

      {/* Emoji overlay on Coin1 */}
      {coin1Position && (
        <group ref={emoji1GroupRef} position={[coin1Position[0]+ 0.01, coin1Position[1] + 0.07, coin1Position[2]+ 0.01]} rotation={[0, 0, 0]}>
          <Html
            center
            transform
            distanceFactor={8}
            pointerEvents="none"
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            <span style={{ fontSize: '4px' }}>📜</span>
          </Html>
        </group>
      )}

      {/* Emoji overlay on Coin2 */}
      {coin2Position && (
        <group ref={emoji2GroupRef} position={[coin2Position[0]+ 0.01, coin2Position[1] + 0.07, coin2Position[2]+ 0.01]} rotation={[0, -0.15, 0]}>
          <Html
            center
            transform
            distanceFactor={8}
            pointerEvents="none"
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            <span style={{ fontSize: '4px' }}>🔥</span>
          </Html>
        </group>
      )}

      {/* Emoji overlay on Coin3 */}
      {coin3Position && (
        <group ref={emoji3GroupRef} position={[coin3Position[0]+ 0.01, coin3Position[1] + 0.07, coin3Position[2]+ 0.01]} rotation={[0, 0, 0]}>
          <Html
            center
            transform
            distanceFactor={8}
            pointerEvents="none"
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            <span style={{ fontSize: '4px' }}>📈</span>
          </Html>
        </group>
      )}

      {/* Emoji overlay on Coin4 */}
      {coin4Position && (
        <group ref={emoji4GroupRef} position={[coin4Position[0] + 0.01, coin4Position[1] + 0.07, coin4Position[2] + 0.01]} rotation={[0, -0.25, 0]}>
          <Html
            center
            transform
            distanceFactor={8}
            pointerEvents="none"
            style={{
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            <span style={{ fontSize: '4px' }}>💬</span>
          </Html>
        </group>
      )}
    </group>
  );
};



export default CyborgTempleScene;