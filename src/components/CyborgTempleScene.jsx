import { useEffect, useRef, useState } from "react";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import AnnotationSystem from "@/components/AnnotationSystem";




const CyborgTempleScene = ({ 
  onLoad, 
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1.2, 1.2, 1.2],
  isPlaying = false, 
  currentTrack = null,
  showAnnotations = true,
  is80sMode = false,
  onAnnotationClick = null, // Callback when annotation is clicked
  onAgentClick = null, // Callback when an agent is clicked
  isMobile = false, // Pass this prop to determine device type
}) => {
  const groupRef = useRef();
  const { scene, camera, gl } = useThree();
  const hasLoadedRef = useRef(false);
  // Store multiple mixers for each animated character
  const mixersRef = useRef({}); // { characterName: mixer }
  const actionsRef = useRef({}); // { characterName: { animationName: action } }
  const [loadedModel, setLoadedModel] = useState(null);
  const [detectedMobile, setDetectedMobile] = useState(false);
  const cylinderMeshRef = useRef(); // Ref for the specific cylinder mesh
  const object7MeshRef = useRef(); // Ref for Object_5 (was Object_7)
  const cube010MeshRef = useRef(); // Ref for Cube010
  
  // Refs for MOBILE.glb animated objects
  const angelEmptyRef = useRef(); // Parent container for angel and coins
  const angelRef = useRef();
  const coin1Ref = useRef();
  const coin2Ref = useRef();
  const coin3Ref = useRef();
  const coin4Ref = useRef();
  
  // Camera focus state
  const [focusTarget, setFocusTarget] = useState(null);
  const ourLadyRef = useRef(); // Reference to RL80 (OurLady) mesh
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
  
  // Eye mesh refs for blinking animation
  const leftEyeRef = useRef();
  const rightEyeRef = useRef();
  const blinkStateRef = useRef({
    lastBlinkTime: 0,
    nextBlinkDelay: Math.random() * 3000 + 2000, // Random delay between 2-5 seconds
    isBlinking: false,
    blinkProgress: 0
  });
  
  // Macro animation alternation state
  const macroAnimStateRef = useRef({
    currentAnimation: 'TypingRobot2', // Start with TypingRobot2
    lastSwitchTime: 0,
    nextSwitchDelay: Math.random() * 10000 + 8000, // Initially wait 8-18 seconds before first switch
    isPlayingSpecial: false, // Track if a special animation is currently playing
  });
  
  // RL80 animation state
  const rl80AnimStateRef = useRef({
    currentAnimation: 'Typing',
    lastSwitchTime: 0,
    nextSwitchDelay: Math.random() * 8000 + 12000, // Wait 12-20 seconds before first switch
    recentAnimations: [], // Track recently used animations for better distribution
  });
  
  // Emo animation state
  const emoAnimStateRef = useRef({
    currentAnimation: 'Typing',
    lastSwitchTime: 0,
    nextSwitchDelay: Math.random() * 10000 + 15000, // Wait 15-25 seconds
  });
  
  // Tekno animation state
  const teknoAnimStateRef = useRef({
    currentAnimation: 'Typing',
    lastSwitchTime: 0,
    nextSwitchDelay: Math.random() * 10000 + 20000, // Wait 20-30 seconds
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
  
  // Use prop or detected mobile state
  const isOnMobile = isMobile || detectedMobile;
  
  // Expose the loaded model and camera control functions through ref
  /* useImperativeHandle(ref, () => ({
    current: loadedModel,
    focusOnAgent: (agentId) => {
      // Focus on a specific agent programmatically
      let targetRef = null;
      
      if (agentId === 'RL80' && ourLadyRef.current) {
        targetRef = ourLadyRef.current;
      } else if (agentId === 'Mike' && cube010MeshRef.current) {
        targetRef = cube010MeshRef.current;
      }
      
      if (targetRef) {
        const objectWorldPos = new THREE.Vector3();
        targetRef.getWorldPosition(objectWorldPos);
        
        // Calculate camera position relative to the object
        const cameraOffset = new THREE.Vector3(2, 0.5, 3);
        const cameraPosition = objectWorldPos.clone().add(cameraOffset);
        
        setFocusTarget({
          position: cameraPosition,
          lookAt: objectWorldPos,
          agentId: agentId,
          agentName: agentId
        });
      }
    },
    resetCamera: () => {
      // Reset camera to original position
      setFocusTarget(null);
      if (originalCameraPosition.current) {
        camera.position.copy(originalCameraPosition.current);
        camera.lookAt(0, 0, 0);
      }
    }
  }), [loadedModel, camera]); */

  // Define annotation points - adjust positions based on your temple scene
  const annotations = [
    {
      text: "RL80 Trades 24/7 - A virtuous and autonomous agent with one purpose: learn to trade perpetual contracts and maximize profits for her followers and token holders.",
      attachTo: object7MeshRef, // Attach to Object_7 mesh
      offset: [0, 1.9, 0], // Position slightly above the object center
      textOffset: [0, 0.2, -0.5], // Position text panel above and back
      customCamera: {
        position: [2, -0.8, -0.5], // Camera moved right and lower
        lookAt: [0, -0.5, 0], // Look outward toward the characters
        distance: 1.5 // Slightly increased distance for better framing
      }
    },
    // {
    //   position: [2, 0, -2], // Right side
    //   text: "Digital Offering Station\nPlace virtual candles here"
    // },

 {
      text: "RL80 Holder Neural Network - live display of holders online right now.",
      attachTo: cylinderMeshRef, // Attach to the cylinder mesh
      offset: [0, 0.5, 0], // Position at cylinder center
      textOffset: [0, 0.2, -1], // Position text panel 1.5 units up and 1 unit back
      customCamera: {
        position: [-2, -0.7, 3.3], // Camera moved right and lower
        lookAt: [1, -0.7, -0.1], // Look outward toward the characters
        distance: 1.2 // Slightly increased distance for better framing
      }
    },
    {
      text: "The 3 Wise Mechs - RL80's crypto council: Emo, Macro, and Tekno - specialists in market sentiment, macro trends, and technical analysis, respectively.",
      attachTo: cube010MeshRef, // Attach to Cube010 mesh
      offset: [-1.8, 1.1, 0.5], // Position above the cube center
      textOffset: [0.1, 0, -0.4], // Position text panel above and back
      customCamera: {
        position: [0.2, -1.3, -0.3], // Camera moved right and lower
        lookAt: [-2.7, -1, 0.3], // Look outward toward the characters
        distance: 2.5 // Slightly increased distance for better framing
      }
    },
  ];
  

  useEffect(() => {
    if (hasLoadedRef.current) return;
    
    // Small delay to ensure the ref is attached after first render
    const timer = setTimeout(() => {
      if (!groupRef.current) {
        console.error('[CyborgTempleScene] groupRef.current is still null after mount');
        return;
      }
      
      hasLoadedRef.current = true;
      const currentGroupRef = groupRef.current; // Capture the ref value

    // Temporarily suppress THREE.js warnings during model loading
    const originalWarn = console.warn;
    const suppressAnimationWarnings = (message) => {
      if (typeof message === 'string' && 
          message.includes('THREE.PropertyBinding') && 
          message.includes('No target node found')) {
        return; // Suppress animation binding warnings
      }
      return originalWarn.apply(console, arguments);
    };

    const gltfLoader = new GLTFLoader();
    
    // Always use DRACO loader since both models may have compression
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath("/draco/");
    gltfLoader.setDRACOLoader(dracoLoader);

    // Determine which model to load based on device type
    const modelPath = isOnMobile ? "/models/MOBILE.glb" : "/models/RL80_4anims.glb";
    const startTime = performance.now();
    
    // First, verify the model file is accessible
    fetch(modelPath, { method: 'HEAD' })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Model file not accessible: ${response.status} ${response.statusText}`);
        }
      })
      .catch(error => {
        console.error(`[CyborgTempleScene] Failed to verify model file:`, error);
      });
    
    let retryCount = 0;
    const maxRetries = 3;
    
    const loadModel = () => {
      gltfLoader.load(
      modelPath, 
      (gltf) => {
        const loadTime = performance.now() - startTime;
        
        const templeScene = gltf.scene;
      
      // Store the loaded model in state for external access
      setLoadedModel(templeScene);
      
      // Create an anchor group for positioning
      const anchorGroup = new THREE.Group();
      // Apply different positioning for MOBILE.glb vs RL80_4anims.glb
      if (isOnMobile) {
        // Custom position for MOBILE.glb - adjust these values as needed
        anchorGroup.position.set(0, 0.8, -1); // Lower the mobile model
        anchorGroup.rotation.set(0, 0, 0);
        anchorGroup.scale.set(1.2, 1.2, 1.2); // Slightly larger scale for mobile
      } else {
        // Keep original positioning for RL80_4anims.glb
        anchorGroup.position.set(0, 0, 0);
        anchorGroup.rotation.set(0, 0, 0);
        anchorGroup.scale.set(1, 1, 1);
      }
      
      // Add the temple scene to the anchor group
      anchorGroup.add(templeScene);
      
      // First, identify all animated characters and create mixers for each
      const animatedCharacters = {};
      
      // Find all animated objects in the scene
      templeScene.traverse((child) => {
        // RL80's animations target the root Empty object named "RL80_Empty"
        if (child.name === 'RL80_Empty') {
          animatedCharacters['RL80'] = child;
        }
        // Macro - look for the Robot2_Empty parent container
        else if (child.name === 'Robot2_Empty') {
          animatedCharacters['Macro'] = child;
        }
        // The other Wise Mechs
        else if (child.name === 'Emo') {
          animatedCharacters['Emo'] = child;
        }
        else if (child.name === 'Tekno') {
          animatedCharacters['Tekno'] = child;
        }
      });
      
      // Create separate mixers for each character
      Object.entries(animatedCharacters).forEach(([charName, charObject]) => {
        const mixer = new THREE.AnimationMixer(charObject);
        mixersRef.current[charName] = mixer;
        actionsRef.current[charName] = {};
      });

      // Helper function to clean animation tracks - only remove truly problematic tracks
      const cleanAnimationTracks = (animation, targetObject) => {
        // Get all bone names in the target object, including nested paths
        const availableBones = new Set();
        const collectBoneNames = (obj, path = '') => {
          if (obj.name) {
            availableBones.add(obj.name);
            // Also add the full path for nested bones
            if (path) {
              availableBones.add(`${path}/${obj.name}`);
            }
          }
          if (obj.children) {
            obj.children.forEach(child => {
              collectBoneNames(child, path ? `${path}/${obj.name}` : obj.name);
            });
          }
        };
        collectBoneNames(targetObject);
        
        // Known problematic bones that cause warnings (including _1 and _2 variants)
        // Only include bones that are genuinely missing, not leg bones that exist
        const problematicBones = new Set([
          // These bones don't exist in the model and should be filtered
          'Armature001', 'Armature002', 'Armature003'
          // Removed leg bones as they DO exist and are needed for proper animation
        ]);
        
        // Filter out only the truly problematic tracks
        const validTracks = animation.tracks.filter(track => {
          const boneName = track.name.split('.')[0];
          // Only remove if it's in our known problematic list AND not available
          if (problematicBones.has(boneName) && !availableBones.has(boneName)) {
            return false; // Remove this track
          }
          return true; // Keep all other tracks
        });
        
        // Only create a new clip if we removed any tracks
        if (validTracks.length < animation.tracks.length) {
          const cleanedAnimation = new THREE.AnimationClip(
            animation.name,
            animation.duration,
            validTracks
          );
          return cleanedAnimation;
        }
        
        return animation;
      };

      // Play specific animations based on character
      if (gltf.animations.length > 0) {
        // Suppress warnings during animation setup
        console.warn = suppressAnimationWarnings;
        
        // Analyze animations to understand their structure
        gltf.animations.forEach((animation) => {
          
          // Track names follow pattern: BoneName.property (e.g., Root.position)
          // This helps identify which bone hierarchy each animation targets
        });
        
        // Since all characters use the same Synty bone structure,
        // we'll assign animations based on naming patterns
        // Macro uses Robot animations, others use standard animations
        
        gltf.animations.forEach((animation) => {
          const animName = animation.name;
          
          // Check what bones this animation targets
          const firstTrackBone = animation.tracks[0]?.name.split('.')[0] || '';
          
          // Determine which character(s) this animation is for based on name AND bone structure
          let targetCharacters = [];
          
          // Check if it's a Macro-specific animation (Robot animations OR uses Pelvis/Root_1 bones)
          if (animName.includes('Robot') || animName.includes('robot') || 
              firstTrackBone === 'Pelvis' || firstTrackBone === 'Root_1') {
            targetCharacters = ['Macro'];
          }
          // Standard animations for RL80, Emo, Tekno (uses Root bone)
          else if (firstTrackBone === 'Root' || firstTrackBone === 'Root_2' ||
                   animName === 'Typing' || animName === 'Idle' || 
                   animName === 'Disbelief' || animName === 'FistPump' ||
                   animName === 'Clap' || animName === 'Victory' || animName === 'Cheer') {
            // Only assign to RL80/Emo/Tekno if it's not using Root_2 (which doesn't exist for them)
            if (firstTrackBone === 'Root_2') {
              // This is probably a misassigned Macro animation
              targetCharacters = ['Macro'];
            } else {
              targetCharacters = ['RL80', 'Emo', 'Tekno'];
            }
          }

          
          // Apply animation to target characters with track cleaning
          targetCharacters.forEach(charName => {
            if (animatedCharacters[charName] && mixersRef.current[charName]) {
              const mixer = mixersRef.current[charName];
              
              // Clean animation tracks to remove references to non-existent bones
              const cleanedAnimation = cleanAnimationTracks(animation, animatedCharacters[charName]);
              
              const action = mixer.clipAction(cleanedAnimation);
              
              if (!actionsRef.current[charName]) {
                actionsRef.current[charName] = {};
              }
              
              actionsRef.current[charName][animName] = action;
            }
          });
        });
        
        // Log all animation names to understand the structure
        
        // Play initial animations for each character
        Object.entries(actionsRef.current).forEach(([charName, charActions]) => {
          const availableAnims = Object.keys(charActions);
          
          if (availableAnims.length === 0) {
            console.error(`[Play] ERROR: ${charName} has no animations! Character will be in T-pose.`);
            return;
          }
          
          // Find a suitable default animation for each character
          let defaultAnimName = null;
          let defaultAnim = null;
          
          if (charName === 'RL80') {
            // Priority order for RL80
            if (charActions['Typing']) {
              defaultAnimName = 'Typing';
            } else if (charActions['Idle']) {
              defaultAnimName = 'Idle';
            } else {
              defaultAnimName = availableAnims[0];
            }
          } else if (charName === 'Macro') {
            // Priority order for Macro
            if (charActions['TypingRobot2']) {
              defaultAnimName = 'TypingRobot2';
            } else if (charActions['IdleRobot2']) {
              defaultAnimName = 'IdleRobot2';
            } else {
              defaultAnimName = availableAnims[0];
            }
          } else if (charName === 'Emo') {
            // Priority order for Emo
            if (charActions['Typing']) {
              defaultAnimName = 'Typing';
            } else if (charActions['Idle']) {
              defaultAnimName = 'Idle';
            } else {
              defaultAnimName = availableAnims[0];
            }
          } else if (charName === 'Tekno') {
            // Priority order for Tekno
            if (charActions['Typing']) {
              defaultAnimName = 'Typing';
            } else if (charActions['Idle']) {
              defaultAnimName = 'Idle';
            } else {
              defaultAnimName = availableAnims[0];
            }
          }
          
          if (defaultAnimName && charActions[defaultAnimName]) {
            defaultAnim = charActions[defaultAnimName];
            
            // Add some timing variation for visual interest
            if (charName === 'Emo' || charName === 'Tekno') {
              defaultAnim.time = Math.random() * defaultAnim.getClip().duration * 0.5;
            }
            defaultAnim.setLoop(THREE.LoopRepeat);
            defaultAnim.play();
            
            // Update the current animation state
            if (charName === 'RL80') {
              rl80AnimStateRef.current.currentAnimation = defaultAnimName;
            } else if (charName === 'Macro') {
              macroAnimStateRef.current.currentAnimation = defaultAnimName;
            } else if (charName === 'Emo') {
              emoAnimStateRef.current.currentAnimation = defaultAnimName;
            } else if (charName === 'Tekno') {
              teknoAnimStateRef.current.currentAnimation = defaultAnimName;
            }
          } else {
            console.error(`[Play] ERROR: Could not find a default animation for ${charName}`);
          }
        });
        
        // Restore original console.warn after animation setup
        console.warn = originalWarn;
      }
      
      // Create grid ground
      const gridHelper = new THREE.GridHelper(50, 50, 0x00ff41, 0x00ff41);
      gridHelper.material.opacity = 0.3;
      gridHelper.material.transparent = true;
      gridHelper.position.y = isOnMobile ? -6.5 : -0.06; // Lower grid on mobile
      anchorGroup.add(gridHelper);
      
      // Add the anchor group to our captured group ref
      // Using the captured ref to avoid closure issues
      if (currentGroupRef) {
        currentGroupRef.add(anchorGroup);
        // Ensure everything is visible
        anchorGroup.visible = true;
        templeScene.visible = true;
        
        // Force update
        anchorGroup.updateMatrix();
        anchorGroup.updateMatrixWorld(true);
      } else {
        // This shouldn't happen but as a fallback, add to scene
        console.error('[CyborgTempleScene] currentGroupRef is null, falling back to scene');
        scene.add(anchorGroup);
      }
      
      // Find the specific meshes and add click handlers
      templeScene.traverse((child) => {
        
        if (child.name === 'Cylinder043_0') {
          cylinderMeshRef.current = child;
        }
        if (child.name === 'Object_5') {
          object7MeshRef.current = child;
        }
        
        // Find eye meshes for blinking animation
        if (child.name === 'L_eye' || child.name === 'L_Eye') {
          leftEyeRef.current = child;
        }
        if (child.name === 'R_eye' || child.name === 'R_Eye') {
          rightEyeRef.current = child;
        }
        
        // Find OurLady (RL80) and make it clickable
        if (child.name === 'OurLady' || child.name === 'Object_7' || child.name === 'RL80') {
          

          
          ourLadyRef.current = child;
          
          // Set clickable data on this object and all its children
          const setClickableData = (obj) => {
            obj.userData.clickable = true;
            obj.userData.agentId = 'RL80';
            obj.userData.agentName = 'RL80';
            obj.userData.targetObject = child; // Store reference to the actual object
            
            // Also apply to all children if it's a group
            if (obj.children && obj.children.length > 0) {
              obj.children.forEach(setClickableData);
            }
          };
          
          setClickableData(child);
        }
        
        // Make the three mechs clickable
        if (child.name === 'Emo' || child.name === 'Macro' || child.name === 'Tekno') {
          
          const setMechClickableData = (obj) => {
            obj.userData.clickable = true;
            obj.userData.agentId = child.name;
            obj.userData.agentName = child.name;
            obj.userData.targetObject = child; // Store reference to the actual object
            
            // Also apply to all children if it's a group
            if (obj.children && obj.children.length > 0) {
              obj.children.forEach(setMechClickableData);
            }
          };
          
          setMechClickableData(child);
        }
        
        // Make the four screens clickable
        if (child.name === 'Screen1' || child.name === 'Screen2' || child.name === 'Screen3' || child.name === 'Screen4') {
          
          const setScreenClickableData = (obj) => {
            obj.userData.clickable = true;
            obj.userData.agentId = child.name;
            obj.userData.agentName = child.name;
            obj.userData.targetObject = child; // Store reference to the actual object
            
            // Also apply to all children if it's a group
            if (obj.children && obj.children.length > 0) {
              obj.children.forEach(setScreenClickableData);
            }
          };
          
          setScreenClickableData(child);
        }
        
        // Find angel and coin objects for MOBILE.glb animations
        if (isOnMobile) {
          if (child.name === 'Angel_Empty') {
            angelEmptyRef.current = child;
          }
          if (child.name === 'angel' || child.name === 'Angel') {
            angelRef.current = child;
          }
          
          // Coins only exist in MOBILE.glb, so only set them up on mobile
          if (child.name === 'Coin1') {
            coin1Ref.current = child;
            
            // Make Coin1 clickable - maps to Macro
            const setCoin1ClickableData = (obj) => {
              obj.userData.clickable = true;
              obj.userData.agentId = 'Macro';
              obj.userData.agentName = 'Macro';
              obj.userData.targetObject = child;
              obj.userData.isCoin = true; // Mark as coin for special handling
              
              // Also apply to all children if it's a group
              if (obj.children && obj.children.length > 0) {
                obj.children.forEach(setCoin1ClickableData);
              }
            };
            
            setCoin1ClickableData(child);
          }
          if (child.name === 'Coin2') {
            coin2Ref.current = child;
            
            // Make Coin2 clickable - maps to Tekno
            const setCoin2ClickableData = (obj) => {
              obj.userData.clickable = true;
              obj.userData.agentId = 'Tekno';
              obj.userData.agentName = 'Tekno';
              obj.userData.targetObject = child;
              obj.userData.isCoin = true;
              
              if (obj.children && obj.children.length > 0) {
                obj.children.forEach(setCoin2ClickableData);
              }
            };
            
            setCoin2ClickableData(child);
          }
          if (child.name === 'Coin3') {
            coin3Ref.current = child;
            
            // Make Coin3 clickable - maps to Emo
            const setCoin3ClickableData = (obj) => {
              obj.userData.clickable = true;
              obj.userData.agentId = 'Emo';
              obj.userData.agentName = 'Emo';
              obj.userData.targetObject = child;
              obj.userData.isCoin = true;
              
              if (obj.children && obj.children.length > 0) {
                obj.children.forEach(setCoin3ClickableData);
              }
            };
            
            setCoin3ClickableData(child);
          }
          if (child.name === 'Coin4') {
            coin4Ref.current = child;
            
            // Make Coin4 clickable - maps to RL80
            const setCoin4ClickableData = (obj) => {
              obj.userData.clickable = true;
              obj.userData.agentId = 'RL80';
              obj.userData.agentName = 'RL80';
              obj.userData.targetObject = child;
              obj.userData.isCoin = true;
              
              if (obj.children && obj.children.length > 0) {
                obj.children.forEach(setCoin4ClickableData);
              }
            };
            
            setCoin4ClickableData(child);
          }
        }
      });
      
      // Call onLoad callback if provided
      if (onLoad) {
        setTimeout(() => {
          onLoad();
        }, 100);
      }
    }, 
    // Progress callback
    () => {
      // Progress tracking available if needed
    },
    // Error callback
    (error) => {
      console.error(`[CyborgTempleScene] Error loading model ${modelPath}:`, error);
      console.error(`[CyborgTempleScene] Error details:`, {
        message: error.message,
        stack: error.stack,
        modelPath: modelPath,
        isOnMobile: isOnMobile
      });
      
      // Check if it's a 404 error
      if (error.message && error.message.includes('404')) {
        console.error(`[CyborgTempleScene] Model file not found at path: ${modelPath}`);
        console.error('[CyborgTempleScene] Please ensure the file exists at: public' + modelPath);
      }
      
      // Retry logic
      if (retryCount < maxRetries) {
        retryCount++;
        console.warn(`[CyborgTempleScene] Retrying model load (attempt ${retryCount}/${maxRetries})...`);
        setTimeout(() => {
          loadModel();
        }, 1000 * retryCount); // Exponential backoff
      } else {
        console.error(`[CyborgTempleScene] Failed to load model after ${maxRetries} attempts`);
        // Still call onLoad even if there's an error, so the page doesn't hang
        if (onLoad) {
          console.warn('[CyborgTempleScene] Calling onLoad despite error to prevent hanging');
          setTimeout(() => {
            onLoad();
          }, 100);
        }
      }
    });
    };
    
    // Start loading the model
    loadModel();

    }, 100); // 100ms delay to ensure ref is attached
    
    // Cleanup function
    return () => {
      clearTimeout(timer);
      if (groupRef.current) {
        // Clear the group's children
        while (groupRef.current.children.length > 0) {
          groupRef.current.remove(groupRef.current.children[0]);
        }
        
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
    };
  }, []); // Empty dependency array - only run once on mount

  // Store initial camera position only once
  useEffect(() => {
    if (!originalCameraPosition.current && camera) {
      originalCameraPosition.current = camera.position.clone();
    }
  }, [camera]);

  // Add raycaster for click detection and keyboard shortcuts
  useEffect(() => {
    if (!groupRef.current || !gl) return;
    
    
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // Handle escape key to reset camera
    const handleKeyDown = (event) => {
      // Debug: Press 'P' to log all character positions
      if (event.key === 'p' || event.key === 'P') {
        
        // Find and log each character's position
        if (groupRef.current) {
          groupRef.current.traverse((child) => {
            // Check various possible names
            if (child.name === 'OurLady' || child.name === 'Object_7' || child.name === 'RL80') {
              const pos = new THREE.Vector3();
              child.getWorldPosition(pos);
            }
            
            if (child.name === 'Emo' || child.name === 'Macro' || child.name === 'Tekno') {
              const pos = new THREE.Vector3();
              child.getWorldPosition(pos);
            }
            
            if (child.name === 'Mike' || child.name === 'Cube010') {
              const pos = new THREE.Vector3();
              child.getWorldPosition(pos);
            }
            
            // Log screen positions
            if (child.name === 'Screen1' || child.name === 'Screen2' || 
                child.name === 'Screen3' || child.name === 'Screen4') {
              const pos = new THREE.Vector3();
              child.getWorldPosition(pos);
            }
          });
        }
      }
      
      
      if (event.key === 'Escape' && focusTarget) {
        
        // Notify parent that focus is cleared
        if (onAgentClick) {
          onAgentClick(null);
        }
        
        if (originalCameraPosition.current) {
          const resetTarget = {
            position: originalCameraPosition.current.clone(),
            lookAt: new THREE.Vector3(0, 0, 0),
            agentId: null,
            agentName: 'Reset'
          };
          setFocusTarget(resetTarget);
          
          setTimeout(() => {
            setFocusTarget(null);
            // Clear the stored position after reset
            originalCameraPosition.current = null;
          }, 1000);
        } else {
          setFocusTarget(null);
        }
      }
    };
    
    // Touch events for mobile and tablets
    const handleTouchStart = (event) => {
      // Don't prevent default for better touch compatibility
      // event.preventDefault();
      
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
    
    // Also set up hover detection for visual feedback
    const handlePointerMove = (event) => {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(groupRef.current.children, true);
      
      // Change cursor if hovering over clickable object and handle coin hover
      let foundClickable = false;
      let foundCoin = null;
      
      for (let i = 0; i < intersects.length; i++) {
        const object = intersects[i].object;
        if (object.userData.clickable) {
          foundClickable = true;
          
          // Check if it's a coin
          if (object.userData.isCoin) {
            foundCoin = object.userData.agentId;
          }
          break;
        }
      }
      
      // Handle coin hover effects
      if (foundCoin && hoveredCoin !== foundCoin) {
        // Start hovering on a coin
        setHoveredCoin(foundCoin);
        
        // Get the appropriate coin ref and scale/emissive refs
        let coinRef, scaleRef, emissiveRef;
        switch(foundCoin) {
          case 'Coin1':
            coinRef = coin1Ref;
            scaleRef = coin1OriginalScale;
            emissiveRef = coin1OriginalEmissive;
            break;
          case 'Coin2':
            coinRef = coin2Ref;
            scaleRef = coin2OriginalScale;
            emissiveRef = coin2OriginalEmissive;
            break;
          case 'Coin3':
            coinRef = coin3Ref;
            scaleRef = coin3OriginalScale;
            emissiveRef = coin3OriginalEmissive;
            break;
          case 'Coin4':
            coinRef = coin4Ref;
            scaleRef = coin4OriginalScale;
            emissiveRef = coin4OriginalEmissive;
            break;
        }
        
        if (coinRef && coinRef.current) {
          // Store original values if not already stored
          if (!scaleRef.current) {
            scaleRef.current = coinRef.current.scale.clone();
          }
          
          // Find the mesh material and store original emissive
          coinRef.current.traverse((child) => {
            if (child.isMesh && child.material) {
              if (!emissiveRef.current) {
                emissiveRef.current = {
                  color: child.material.emissive ? child.material.emissive.clone() : new THREE.Color(0x000000),
                  intensity: child.material.emissiveIntensity || 0
                };
              }
              // Set hover emissive with different colors for each coin
              if (child.material.emissive) {
                const colors = {
                  'Coin1': 0x00ff00, // Green
                  'Coin2': 0x00ffff, // Cyan
                  'Coin3': 0xff00ff, // Magenta
                  'Coin4': 0xffdd00  // Gold
                };
                child.material.emissive = new THREE.Color(colors[foundCoin] || 0xffdd00);
              }
              child.material.emissiveIntensity = 3; // Increased emission for better visibility
            }
          });
          
          // Scale up more noticeably
          coinRef.current.scale.multiplyScalar(1.2);
        }
      } else if (!foundCoin && hoveredCoin) {
        // Stop hovering on any coin
        
        // Get the appropriate coin ref and scale/emissive refs
        let coinRef, scaleRef, emissiveRef;
        switch(hoveredCoin) {
          case 'Coin1':
            coinRef = coin1Ref;
            scaleRef = coin1OriginalScale;
            emissiveRef = coin1OriginalEmissive;
            break;
          case 'Coin2':
            coinRef = coin2Ref;
            scaleRef = coin2OriginalScale;
            emissiveRef = coin2OriginalEmissive;
            break;
          case 'Coin3':
            coinRef = coin3Ref;
            scaleRef = coin3OriginalScale;
            emissiveRef = coin3OriginalEmissive;
            break;
          case 'Coin4':
            coinRef = coin4Ref;
            scaleRef = coin4OriginalScale;
            emissiveRef = coin4OriginalEmissive;
            break;
        }
        
        if (coinRef && coinRef.current) {
          // Restore original scale
          if (scaleRef.current) {
            coinRef.current.scale.copy(scaleRef.current);
          }
          
          // Restore original emissive
          coinRef.current.traverse((child) => {
            if (child.isMesh && child.material && emissiveRef.current) {
              child.material.emissive = emissiveRef.current.color;
              child.material.emissiveIntensity = emissiveRef.current.intensity;
            }
          });
        }
        
        setHoveredCoin(null);
      }
      
      gl.domElement.style.cursor = foundClickable ? 'pointer' : 'default';
    };
    
    const handleClick = (event) => {
      // Prevent default to avoid any interference
      event.preventDefault();
      event.stopPropagation();
      
      // Calculate mouse position in normalized device coordinates
      const rect = gl.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      
      // Update the picking ray with the camera and mouse position
      raycaster.setFromCamera(mouse, camera);
      
      // Calculate objects intersecting the picking ray
      const intersects = raycaster.intersectObjects(groupRef.current.children, true);
      
      let clickedOnAgent = false;
      
      for (let i = 0; i < intersects.length; i++) {
        const object = intersects[i].object;
        
        if (object.userData.clickable) {
          clickedOnAgent = true;

          // Special handling for coins - trigger animation and show FocusedAgentCard
          if (object.userData.isCoin) {
            
            // Trigger the coin animation
            triggerCoinAnimation(object.userData.agentId);
            
            // Call the parent callback to show FocusedAgentCard
            if (onAgentClick) {
              onAgentClick(object.userData.agentId); // This will trigger the FocusedAgentCard to show
            }
            break; // Exit early for coins
          }
          
          // Store the current camera position BEFORE any animation
          // But only if we're not already focused on something
          if (!focusTarget) {
            originalCameraPosition.current = camera.position.clone();
          }
          
          // Get the target object's world position
          const targetObject = object.userData.targetObject || object;
          const objectWorldPos = new THREE.Vector3();
          targetObject.getWorldPosition(objectWorldPos);
          
          const agentSettings = {
            'RL80': { 
              // RL80 at (1.704, -1.652, 1.476)
              // Camera should be closer to center (opposite side)
              cameraPos: new THREE.Vector3(1, -0.4, 0.7),  // Positioned toward center, looking outward
              lookAtPos: new THREE.Vector3(1.804, -0.7, 2)  // Look at upper body
            },
            'Emo': { 
              // Emo at (-1.554, -1.719, -1.351)
              // Camera positioned on opposite side (toward center)
              cameraPos: new THREE.Vector3(-0.9, -0.5, -0.7),  // Positioned toward center, looking outward
              lookAtPos: new THREE.Vector3(-1.3, -0.6,  -1.351)  // Look at upper body
            },
            'Macro': { 
              // Macro at (-1.315, -1.672, 1.636)
              // Camera positioned on opposite side (toward center)
              cameraPos: new THREE.Vector3(-0.5, -0.5, 1.3),  // Positioned toward center, looking outward
              lookAtPos: new THREE.Vector3(-1.515, -0.7, 1.636)  // Look at upper body
            },
            'Tekno': { 
              // Tekno at (1.512, -1.625, -1.575)
              // Camera positioned on opposite side (toward center)
              cameraPos: new THREE.Vector3(0.7, -0.3, -1.3),  // Positioned toward center, looking outward
              lookAtPos: new THREE.Vector3(0.9, -0.4,  -1.351)  // Look at upper body
            },
            // Screen positions from console:
            // Screen1: (-0.632, 0.593, -0.682)
            // Screen2: (-0.766, 0.593, 0.975)
            // Screen3: (0.995, 0.614, -1.027)
            // Screen4: (0.770, 0.614, 0.552)
            
            'Screen1': {
              // Screen1 at (-0.632, 0.593, -0.682)
              // Position camera in front of screen
              cameraPos: new THREE.Vector3(-1.932, 0.563, -1.9),  // Move camera forward (positive Z)
              lookAtPos: new THREE.Vector3(0.732, 0.693, 0.482)  // Look at screen center
            },
            'Screen2': {
              // Screen2 at (-0.766, 0.593, 0.975)
              // Position camera in front of screen
              cameraPos: new THREE.Vector3(-1.866, 0.393, 2.2),  // Move camera forward (positive Z)
              lookAtPos: new THREE.Vector3(-0.766, 0.593, 0.975)  // Look at screen center
            },
            'Screen3': {
              // Screen3 at (0.995, 0.614, -1.027)
              // Position camera in front of screen
              cameraPos: new THREE.Vector3(1.9, 0.564, -2.3),  // Move camera forward (positive Z)
              lookAtPos: new THREE.Vector3(1.4, 0.614, -1.7)  // Look at screen center
            },
            'Screen4': {
              // Screen4 at (0.770, 0.614, 0.552)
              // Position camera in front of screen
              cameraPos: new THREE.Vector3(1.90, 0.314, 1.6),  // Move camera forward (positive Z)
              lookAtPos: new THREE.Vector3(0.470, 0.714, .352)  // Look at screen center
            },
          };
          
          const settings = agentSettings[object.userData.agentId];
          
          if (!settings) {
            // Fallback: calculate a reasonable position based on object location
            const cameraPosition = new THREE.Vector3(
              objectWorldPos.x + 2,
              objectWorldPos.y + 0.5,
              objectWorldPos.z + 3
            );
            const lookAtTarget = objectWorldPos.clone();
            lookAtTarget.y += 0.5;
            
            setFocusTarget({
              position: cameraPosition,
              lookAt: lookAtTarget,
              agentId: object.userData.agentId,
              agentName: object.userData.agentName
            });
          } else {
            // Use absolute positions for known agents
            setFocusTarget({
              position: settings.cameraPos.clone(),
              lookAt: settings.lookAtPos.clone(),
              agentId: object.userData.agentId,
              agentName: object.userData.agentName
            });
          }
          
          // Call the parent callback if provided
          if (onAgentClick) {
            onAgentClick(object.userData.agentId);
          }
          
          break; // Stop after first clickable object
        }
      }
      
      // If we didn't click on an agent and we're currently focused, reset the camera
      if (!clickedOnAgent && focusTarget) {
        
        // Notify parent that focus is cleared
        if (onAgentClick) {
          onAgentClick(null);
        }
        
        // Smoothly return to the position before we focused
        if (originalCameraPosition.current) {
          const resetTarget = {
            position: originalCameraPosition.current.clone(),
            lookAt: new THREE.Vector3(0, 0, 0),
            agentId: null,
            agentName: 'Reset'
          };
          setFocusTarget(resetTarget);
          
          // Clear the focus target after animation completes
          setTimeout(() => {
            setFocusTarget(null);
            // Clear the stored position after reset to avoid conflicts
            originalCameraPosition.current = null;
          }, 1000);
        } else {
          // If no stored position, just clear focus
          setFocusTarget(null);
        }
      }
    };
    
    gl.domElement.addEventListener('click', handleClick);
    gl.domElement.addEventListener('pointermove', handlePointerMove);
    gl.domElement.addEventListener('touchstart', handleTouchStart);
    
    // Also add touchend as a backup
    gl.domElement.addEventListener('touchend', (event) => {
      handleTouchStart(event);
    });
    
    // Add pointer events for better tablet support
    const handlePointerDown = (event) => {
      // Only handle if it's a touch/pen input (not mouse)
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        const rect = gl.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(groupRef.current.children, true);
        
        for (let i = 0; i < intersects.length; i++) {
          const object = intersects[i].object;
          
          if (object.userData.isCoin) {
            event.preventDefault();
            const coinName = object.userData.agentId;
            triggerCoinAnimation(coinName);
            
            if (onAgentClick) {
              onAgentClick(coinName);
            }
            break;
          }
        }
      }
    };
    
    gl.domElement.addEventListener('pointerdown', handlePointerDown);
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      gl.domElement.removeEventListener('click', handleClick);
      gl.domElement.removeEventListener('pointermove', handlePointerMove);
      gl.domElement.removeEventListener('touchstart', handleTouchStart);
      gl.domElement.removeEventListener('touchend', handleTouchStart);
      gl.domElement.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      gl.domElement.style.cursor = 'default';
    };
  }, [gl, camera, onAgentClick, loadedModel, focusTarget, originalCameraPosition, hoveredCoin, 
      coin1OriginalScale, coin1OriginalEmissive, coin2OriginalScale, coin2OriginalEmissive,
      coin3OriginalScale, coin3OriginalEmissive, coin4OriginalScale, coin4OriginalEmissive, 
      isOnMobile, clickedCoin]); // Added dependencies

  

  // Animation loop
  useFrame((state, delta) => {
    // Update all character mixers independently
    if (mixersRef.current) {
      Object.values(mixersRef.current).forEach(mixer => {
        if (mixer) {
          mixer.update(delta);
        }
      });
    }
    
    // Handle Macro animation alternation
    if (!isOnMobile && actionsRef.current['Macro']) {
      const currentTime = Date.now();
      const macroState = macroAnimStateRef.current;
      
      // Initialize lastSwitchTime if it's 0
      if (macroState.lastSwitchTime === 0) {
        macroState.lastSwitchTime = currentTime;
      }
      
      // Check if it's time to switch animations AND not playing a special animation
      if (!macroState.isPlayingSpecial && currentTime - macroState.lastSwitchTime > macroState.nextSwitchDelay) {
        const macroActions = actionsRef.current['Macro'];
        
        // Get available animations for Macro
        const availableAnimations = Object.keys(macroActions);
        
        // Filter animations into categories based on what's actually available
        const loopAnimations = availableAnimations.filter(anim => 
          anim === 'TypingRobot2' || anim === 'IdleRobot2');
        const specialAnimations = availableAnimations.filter(anim => 
          anim === 'Cheer_Robot2' || anim === 'Victory_Robot2' || anim === 'Clap_Robot2');
        
        // If we don't have any animations, skip
        if (availableAnimations.length === 0) {
          console.warn('[Macro] No animations available, skipping switch');
          return;
        }
        
        let nextAnimation;
        
        // If currently on a loop animation
        if (loopAnimations.includes(macroState.currentAnimation)) {
          // Only try special animations if they exist
          if (specialAnimations.length > 0 && Math.random() < 0.4) {
            // Pick a random special animation
            nextAnimation = specialAnimations[Math.floor(Math.random() * specialAnimations.length)];
          } else if (loopAnimations.length > 1) {
            // Switch between loop animations
            nextAnimation = loopAnimations.find(anim => anim !== macroState.currentAnimation) || loopAnimations[0];
          } else {
            // Only one loop animation available, keep using it
            nextAnimation = loopAnimations[0];
          }
        } else if (specialAnimations.includes(macroState.currentAnimation)) {
          // Return from special to a loop animation
          nextAnimation = loopAnimations.length > 0 ? 
            loopAnimations[Math.floor(Math.random() * loopAnimations.length)] : 
            availableAnimations[0];
        } else {
          // Fallback - use first available animation
          nextAnimation = availableAnimations[0];
        }
        
        
        // Fade out current animation first (using same timing as RL80)
        if (macroActions[macroState.currentAnimation]) {
          macroActions[macroState.currentAnimation].fadeOut(0.5);
        }
        
        // Play the next animation
        if (macroActions[nextAnimation]) {
          const nextAction = macroActions[nextAnimation];
          
          // Reset and fade in the animation (same as RL80)
          nextAction.reset();
          nextAction.fadeIn(0.5);
          
          // Check if this is a special animation
          const isSpecialAnimation = specialAnimations.includes(nextAnimation);
          
          if (isSpecialAnimation) {
            nextAction.setLoop(THREE.LoopOnce, 1);
            nextAction.clampWhenFinished = true; // Keep the final pose like RL80 does
            macroState.isPlayingSpecial = true; // Set flag to prevent interruptions
            
            // Set up return to loop animation
            const animDuration = nextAction.getClip().duration * 1000;
            const transitionTime = Math.max(100, animDuration - 500);
            
            setTimeout(() => {
              const returnAnimation = loopAnimations.length > 0 ? 
                loopAnimations[Math.floor(Math.random() * loopAnimations.length)] : 
                'TypingRobot2';
              
              
              if (returnAnimation && macroActions[returnAnimation]) {
                // Start the return animation with fadeIn for smooth transition
                const returnAction = macroActions[returnAnimation];
                returnAction.stop();
                returnAction.reset();
                returnAction.setLoop(THREE.LoopRepeat);
                returnAction.setEffectiveWeight(1);
                returnAction.fadeIn(0.5); // Add fadeIn for smooth transition
                returnAction.play();
                
                // Simultaneously fade out the special animation
                nextAction.fadeOut(0.5);
                
                // Update state
                macroState.currentAnimation = returnAnimation;
                macroState.isPlayingSpecial = false; // Clear the flag
                macroState.nextSwitchDelay = returnAnimation === 'IdleRobot2' ? 
                  Math.random() * 3000 + 4000 : // 4-7 seconds for idle
                  Math.random() * 10000 + 8000; // 8-18 seconds for typing
                macroState.lastSwitchTime = Date.now();
              } else {
                console.error(`[Macro] Failed to return to animation: ${returnAnimation}`);
                macroState.isPlayingSpecial = false; // Clear flag on error too
              }
            }, transitionTime);
            
          } else {
            // For loop animations
            nextAction.setLoop(THREE.LoopRepeat);
          }
          
          // Play the animation (same pattern as RL80)
          nextAction.play();
        } else {
          console.error(`[Macro] Animation ${nextAnimation} not found!`);
        }
        
        macroState.currentAnimation = nextAnimation;
        
        // Set next switch delay
        if (loopAnimations.includes(nextAnimation)) {
          if (nextAnimation === 'IdleRobot2') {
            macroState.nextSwitchDelay = Math.random() * 2000 + 3000; // 3-5 seconds for idle
          } else {
            macroState.nextSwitchDelay = Math.random() * 10000 + 8000; // 8-18 seconds for typing
          }
        } else {
          // For special animations, wait for them to complete
          macroState.nextSwitchDelay = 999999;
        }
        
        macroState.lastSwitchTime = currentTime;
      }
    }
    
    // Handle RL80 animation alternation
    if (!isOnMobile && actionsRef.current['RL80']) {
      const currentTime = Date.now();
      const rl80State = rl80AnimStateRef.current;
      
      // Initialize lastSwitchTime if it's 0
      if (rl80State.lastSwitchTime === 0) {
        rl80State.lastSwitchTime = currentTime;
      }
      
      if (currentTime - rl80State.lastSwitchTime > rl80State.nextSwitchDelay) {
        const rl80Actions = actionsRef.current['RL80'];
        
        // Get available animations for RL80
        const availableAnimations = Object.keys(rl80Actions);
        
        // Filter animations based on what's actually available
        // RL80 has Idle, Typing, Clap, and prayer animations
        const loopAnimations = availableAnimations.filter(anim => 
          anim === 'Typing' || anim === 'Idle' || anim === 'Clap');
        const specialAnimations = availableAnimations.filter(anim => 
          anim === 'Disbelief' || anim === 'FistPump');
        
        // If we don't have any animations, skip
        if (availableAnimations.length === 0) {
          console.warn('[RL80] No animations available, skipping switch');
          return;
        }
        
        let nextAnimation;
        
        // If we're on a loop animation, pick next animation
        if (loopAnimations.includes(rl80State.currentAnimation)) {
          // Initialize recentAnimations if it doesn't exist
          if (!rl80State.recentAnimations) {
            rl80State.recentAnimations = [];
          }
          
          // 70% chance to stay with loop animations, 30% for special
          if (Math.random() < 0.7 && loopAnimations.length > 0) {
            // If we have multiple loop animations, switch between them
            if (loopAnimations.length > 1) {
              const otherLoops = loopAnimations.filter(anim => anim !== rl80State.currentAnimation);
              nextAnimation = otherLoops[0];
            } else {
              // Only one loop animation (Typing), keep using it
              nextAnimation = loopAnimations[0];
            }
          } else if (specialAnimations.length > 0) {
            // Pick a special animation
            let availableSpecials = specialAnimations.filter(anim => 
              !rl80State.recentAnimations.includes(anim)
            );
            
            if (availableSpecials.length === 0) {
              availableSpecials = specialAnimations;
              rl80State.recentAnimations = [];
            }
            
            nextAnimation = availableSpecials[Math.floor(Math.random() * availableSpecials.length)];
            rl80State.recentAnimations.push(nextAnimation);
            
            if (rl80State.recentAnimations.length > 1) {
              rl80State.recentAnimations.shift();
            }
          } else {
            // No special animations available, keep current or use first available
            nextAnimation = rl80State.currentAnimation;
          }
        } else {
          // Return from special animation to a loop animation
          nextAnimation = loopAnimations.length > 0 ? 
            loopAnimations[Math.floor(Math.random() * loopAnimations.length)] : 
            availableAnimations[0];
        }
        
        
        // Fade out current animation
        if (rl80Actions[rl80State.currentAnimation]) {
          rl80Actions[rl80State.currentAnimation].fadeOut(0.5);
        }
        
        // Play the next animation
        if (rl80Actions[nextAnimation]) {
          const action = rl80Actions[nextAnimation];
          action.reset();
          action.fadeIn(0.5);
          
          // Check if this is a special (one-shot) animation
          const isSpecialAnimation = ['Disbelief', 'FistPump'].includes(nextAnimation);
          
          if (isSpecialAnimation) {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            
            // Calculate when to start transitioning back
            const animDuration = action.getClip().duration * 1000;
            const transitionStartTime = Math.max(100, animDuration - 500);
            
            // Start transition back to a loop animation
            setTimeout(() => {
              // Use the actual available loop animations
              const availableLoops = Object.keys(rl80Actions).filter(anim => 
                anim === 'Typing' || anim === 'Idle' || anim === 'Clap');
              const returnAnimation = availableLoops.length > 0 ? 
                availableLoops[Math.floor(Math.random() * availableLoops.length)] : 
                Object.keys(rl80Actions)[0]; // Fallback to first available animation
              
              if (returnAnimation && rl80Actions[returnAnimation]) {
                const loopAction = rl80Actions[returnAnimation];
                loopAction.stop();
                loopAction.reset();
                loopAction.setLoop(THREE.LoopRepeat);
                loopAction.setEffectiveWeight(1);
                loopAction.play();
              }
              
              // Fade out the special animation
              if (rl80Actions[rl80State.currentAnimation]) {
                rl80Actions[rl80State.currentAnimation].fadeOut(0.5);
              }
              
              rl80State.currentAnimation = returnAnimation;
              rl80State.nextSwitchDelay = Math.random() * 8000 + 12000;
              rl80State.lastSwitchTime = Date.now();
            }, transitionStartTime);
          } else {
            // For loop animations (Typing, Idle)
            action.setLoop(THREE.LoopRepeat);
          }
          
          action.play();
        }
        
        rl80State.currentAnimation = nextAnimation;
        
        // Set appropriate delay based on animation type
        if (nextAnimation === 'Typing') {
          rl80State.nextSwitchDelay = Math.random() * 8000 + 12000; // 12-20 seconds for typing
        } else if (nextAnimation === 'Idle' || nextAnimation === 'Clap') {
          // For other loop animations, set reasonable delays
          rl80State.nextSwitchDelay = Math.random() * 5000 + 5000; // 5-10 seconds
        } else {
          // For special animations (Disbelief, FistPump), wait for them to finish
          rl80State.nextSwitchDelay = 999999; // Large number to prevent switching during animation
        }
        
        rl80State.lastSwitchTime = currentTime;
      }
    }
    
    // Handle Emo animation alternation (same logic as RL80 - they share animations)
    if (!isOnMobile && actionsRef.current['Emo']) {
      const currentTime = Date.now();
      const emoState = emoAnimStateRef.current;
      
      if (emoState.lastSwitchTime === 0) {
        emoState.lastSwitchTime = currentTime;
      }
      
      if (currentTime - emoState.lastSwitchTime > emoState.nextSwitchDelay) {
        const emoActions = actionsRef.current['Emo'];
        const loopAnimations = ['Typing', 'Idle'];
        const specialAnimations = ['Disbelief', 'FistPump'];
        
        let nextAnimation;
        
        if (loopAnimations.includes(emoState.currentAnimation)) {
          if (Math.random() < 0.75) {
            nextAnimation = emoState.currentAnimation === 'Typing' ? 'Idle' : 'Typing';
          } else {
            nextAnimation = specialAnimations[Math.floor(Math.random() * specialAnimations.length)];
          }
        } else {
          nextAnimation = loopAnimations[Math.floor(Math.random() * loopAnimations.length)];
        }
        
        if (emoActions[emoState.currentAnimation]) {
          emoActions[emoState.currentAnimation].fadeOut(0.5);
        }
        
        if (emoActions[nextAnimation]) {
          const action = emoActions[nextAnimation];
          action.reset();
          action.fadeIn(0.5);
          
          if (specialAnimations.includes(nextAnimation)) {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            
            const animDuration = action.getClip().duration * 1000;
            setTimeout(() => {
              const returnAnim = loopAnimations[Math.floor(Math.random() * loopAnimations.length)];
              if (emoActions[returnAnim]) {
                action.fadeOut(0.5);
                emoActions[returnAnim].stop();
                emoActions[returnAnim].reset();
                emoActions[returnAnim].setLoop(THREE.LoopRepeat);
                emoActions[returnAnim].setEffectiveWeight(1);
                emoActions[returnAnim].play();
              }
              emoState.currentAnimation = returnAnim;
              emoState.nextSwitchDelay = Math.random() * 10000 + 15000;
              emoState.lastSwitchTime = Date.now();
            }, Math.max(100, animDuration - 500));
          } else {
            action.setLoop(THREE.LoopRepeat);
          }
          
          action.play();
        }
        
        emoState.currentAnimation = nextAnimation;
        
        if (loopAnimations.includes(nextAnimation)) {
          emoState.nextSwitchDelay = Math.random() * 10000 + 15000;
        } else {
          emoState.nextSwitchDelay = 999999;
        }
        
        emoState.lastSwitchTime = currentTime;
      }
    }
    
    // Handle Tekno animation alternation (same as Emo but with different timing)
    if (!isOnMobile && actionsRef.current['Tekno']) {
      const currentTime = Date.now();
      const teknoState = teknoAnimStateRef.current;
      
      if (teknoState.lastSwitchTime === 0) {
        teknoState.lastSwitchTime = currentTime;
      }
      
      if (currentTime - teknoState.lastSwitchTime > teknoState.nextSwitchDelay) {
        const teknoActions = actionsRef.current['Tekno'];
        
        // Get available animations for Tekno
        const availableAnimations = Object.keys(teknoActions);
        
        // Filter animations based on what's actually available
        // Tekno has Idle, Typing, Clap, and Pray.001/Pray001 as loop animations
        const loopAnimations = availableAnimations.filter(anim => 
          anim === 'Typing' || anim === 'Idle' || anim === 'Clap');
        const specialAnimations = availableAnimations.filter(anim => 
          anim === 'Disbelief' || anim === 'FistPump');
        
        // If we don't have any animations, skip
        if (availableAnimations.length === 0) {
          console.warn('[Tekno] No animations available, skipping switch');
          return;
        }
        
        let nextAnimation;
        
        if (loopAnimations.includes(teknoState.currentAnimation)) {
          if (Math.random() < 0.8) { // 80% chance for loop animations
            nextAnimation = teknoState.currentAnimation === 'Typing' ? 'Idle' : 'Typing';
          } else {
            nextAnimation = specialAnimations[Math.floor(Math.random() * specialAnimations.length)];
          }
        } else {
          nextAnimation = loopAnimations[Math.floor(Math.random() * loopAnimations.length)];
        }
        
        if (teknoActions[teknoState.currentAnimation]) {
          teknoActions[teknoState.currentAnimation].fadeOut(0.5);
        }
        
        if (teknoActions[nextAnimation]) {
          const action = teknoActions[nextAnimation];
          action.reset();
          action.fadeIn(0.5);
          
          if (specialAnimations.includes(nextAnimation)) {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
            
            const animDuration = action.getClip().duration * 1000;
            setTimeout(() => {
              const returnAnim = loopAnimations[Math.floor(Math.random() * loopAnimations.length)];
              if (teknoActions[returnAnim]) {
                action.fadeOut(0.5);
                teknoActions[returnAnim].stop();
                teknoActions[returnAnim].reset();
                teknoActions[returnAnim].setLoop(THREE.LoopRepeat);
                teknoActions[returnAnim].setEffectiveWeight(1);
                teknoActions[returnAnim].play();
              }
              teknoState.currentAnimation = returnAnim;
              teknoState.nextSwitchDelay = Math.random() * 10000 + 20000;
              teknoState.lastSwitchTime = Date.now();
            }, Math.max(100, animDuration - 500));
          } else {
            action.setLoop(THREE.LoopRepeat);
          }
          
          action.play();
        }
        
        teknoState.currentAnimation = nextAnimation;
        
        if (loopAnimations.includes(nextAnimation)) {
          teknoState.nextSwitchDelay = Math.random() * 10000 + 20000; // 20-30 seconds
        } else {
          teknoState.nextSwitchDelay = 999999;
        }
        
        teknoState.lastSwitchTime = currentTime;
      }
    }
    
    // Blinking animation for RL80's eyes
    if (leftEyeRef.current && rightEyeRef.current && !isOnMobile) {
      const currentTime = state.clock.getElapsedTime() * 1000; // Convert to milliseconds
      const blinkState = blinkStateRef.current;
      
      // Store original positions if not already stored
      if (!leftEyeRef.current.userData.originalPosition) {
        leftEyeRef.current.userData.originalPosition = leftEyeRef.current.position.clone();
        leftEyeRef.current.userData.originalScale = leftEyeRef.current.scale.clone();
      }
      if (!rightEyeRef.current.userData.originalPosition) {
        rightEyeRef.current.userData.originalPosition = rightEyeRef.current.position.clone();
        rightEyeRef.current.userData.originalScale = rightEyeRef.current.scale.clone();
      }
      
      // Check if it's time to blink
      if (!blinkState.isBlinking && currentTime - blinkState.lastBlinkTime > blinkState.nextBlinkDelay) {
        blinkState.isBlinking = true;
        blinkState.blinkProgress = 0;
        blinkState.lastBlinkTime = currentTime;
        // Set random delay for next blink (2-5 seconds)
        blinkState.nextBlinkDelay = Math.random() * 3000 + 2000;
      }
      
      // Animate the blink
      if (blinkState.isBlinking) {
        const blinkDuration = 150; // Total blink duration in milliseconds
        const timeSinceBlinkStart = currentTime - blinkState.lastBlinkTime;
        
        if (timeSinceBlinkStart < blinkDuration) {
          // Calculate blink progress (0 to 1 and back to 0)
          const halfDuration = blinkDuration / 2;
          let progress;
          
          if (timeSinceBlinkStart < halfDuration) {
            // Closing eyes
            progress = timeSinceBlinkStart / halfDuration;
          } else {
            // Opening eyes
            progress = 1 - ((timeSinceBlinkStart - halfDuration) / halfDuration);
          }
          
          // Apply scale transformation to simulate closing eyes
          // Use setFromMatrixScale to maintain position while scaling
          const eyeScale = 1 - (progress * 0.9); // Don't fully close to 0, leave at 0.1
          
          // Scale from the center of each eye mesh
          leftEyeRef.current.scale.set(
            leftEyeRef.current.userData.originalScale.x,
            leftEyeRef.current.userData.originalScale.y * eyeScale,
            leftEyeRef.current.userData.originalScale.z
          );
          rightEyeRef.current.scale.set(
            rightEyeRef.current.userData.originalScale.x,
            rightEyeRef.current.userData.originalScale.y * eyeScale,
            rightEyeRef.current.userData.originalScale.z
          );
          
          // Compensate for position shift when scaling
          // Move eyes slightly to maintain their visual position
          const positionOffset = (1 - eyeScale) * 0.01; // Adjust this value as needed
          leftEyeRef.current.position.y = leftEyeRef.current.userData.originalPosition.y - positionOffset;
          rightEyeRef.current.position.y = rightEyeRef.current.userData.originalPosition.y - positionOffset;
          
        } else {
          // Blink complete, reset to original
          blinkState.isBlinking = false;
          leftEyeRef.current.scale.copy(leftEyeRef.current.userData.originalScale);
          rightEyeRef.current.scale.copy(rightEyeRef.current.userData.originalScale);
          leftEyeRef.current.position.copy(leftEyeRef.current.userData.originalPosition);
          rightEyeRef.current.position.copy(rightEyeRef.current.userData.originalPosition);
        }
      }
    }
    
    // Camera focus animation
    if (focusTarget) {
      // Smoothly move camera to target position
      camera.position.lerp(focusTarget.position, 0.05);
      
      // Look at the target
      const lookAtVector = new THREE.Vector3();
      lookAtVector.lerpVectors(
        new THREE.Vector3(
          camera.getWorldDirection(new THREE.Vector3()).x,
          camera.getWorldDirection(new THREE.Vector3()).y,
          camera.getWorldDirection(new THREE.Vector3()).z
        ),
        focusTarget.lookAt,
        0.05
      );
      camera.lookAt(focusTarget.lookAt);
      
    }
    
    // Add subtle animations for mobile objects
    if (isOnMobile) {
      // Angel_Empty hover animation - subtle up and down motion for the entire group
      if (angelEmptyRef.current) {
        const time = state.clock.getElapsedTime();
        // Store original Y position if not already stored
        if (angelEmptyRef.current.userData.originalY === undefined) {
          angelEmptyRef.current.userData.originalY = angelEmptyRef.current.position.y;
        }
        // Apply hover animation relative to original position
        angelEmptyRef.current.position.y = angelEmptyRef.current.userData.originalY + Math.sin(time * 0.8) * 0.01; // Gentle hover with 0.05 units amplitude
      }
      
      // Coin animations - subtle individual hovering
      const time = state.clock.getElapsedTime();
      
      // Helper function for individual coin hovering with click effects
      const hoverCoin = (coinRef, coinName, phaseOffset, speed = 1.2, amplitude = 0.01) => {
        if (!coinRef.current) return;
        
        const animState = coinAnimationState.current[coinName];
        
        // Store initial Y position if not set
        if (coinRef.current.userData.initialY === undefined) {
          coinRef.current.userData.initialY = coinRef.current.position.y;
        }
        
        // Calculate base hover
        let yOffset = Math.sin(time * speed + phaseOffset) * amplitude;
        
        // Add flutter animation if coin was clicked
        if (animState && animState.isAnimating) {
          const elapsed = (Date.now() - animState.startTime) / 1000; // Convert to seconds
          const flutterDecay = Math.exp(-elapsed * 2); // Slower decay over time
          
          // Remove the vertical bounce - just keep the base hover
          // yOffset is already set from the base hover calculation above
          
          // Add rotation tilt on Y-axis - back and forth a couple times
          if (coinRef.current.rotation) {
            // Use a moderate speed for a nice spin effect
            const tiltSpeed = 6; // Speed of the rotation oscillation
            const tiltAmount = 0.6; // About 34 degrees max tilt - more pronounced
            // Sin wave creates smooth back and forth motion that decays
            coinRef.current.rotation.y = Math.sin(elapsed * tiltSpeed) * tiltAmount * flutterDecay;
            
            // Optional: Add a slight continuous spin as well
            // coinRef.current.rotation.y += elapsed * 2 * flutterDecay; // Continuous spin overlay
          }
          
          // Add glow effect by modifying emissive
          coinRef.current.traverse((child) => {
            if (child.isMesh && child.material) {
              if (!child.material.userData.originalEmissive) {
                child.material.userData.originalEmissive = child.material.emissive ? 
                  child.material.emissive.clone() : new THREE.Color(0x000000);
                child.material.userData.originalIntensity = child.material.emissiveIntensity || 0;
              }
              
              // Pulse the emissive glow
              const glowIntensity = 5 * flutterDecay * (0.5 + 0.5 * Math.sin(elapsed * 10));
              const colors = {
                'Coin1': 0x00ff00, // Green
                'Coin2': 0x00ffff, // Cyan
                'Coin3': 0xff00ff, // Magenta
                'Coin4': 0xffdd00  // Gold
              };
              
              if (child.material.emissive) {
                child.material.emissive = new THREE.Color(colors[coinName] || 0xffdd00);
              }
              child.material.emissiveIntensity = child.material.userData.originalIntensity + glowIntensity;
            }
          });
        } else {
          // Reset rotation when not animating
          if (coinRef.current.rotation) {
            coinRef.current.rotation.y *= 0.95; // Smooth return to zero on Y-axis
          }
          
          // Reset emissive if not hovering
          if (!hoveredCoin || hoveredCoin !== coinName) {
            coinRef.current.traverse((child) => {
              if (child.isMesh && child.material && child.material.userData.originalEmissive) {
                child.material.emissive = child.material.userData.originalEmissive;
                child.material.emissiveIntensity = child.material.userData.originalIntensity;
              }
            });
          }
        }
        
        // Apply position with special handling for Group coins
        if (coinRef.current.name === 'Coin3' && coinRef.current.type === 'Group') {
          // Use much smaller amplitude for the Group
          coinRef.current.position.y = coinRef.current.userData.initialY + yOffset * 0.1;
        } else {
          // Normal handling for Mesh coins
          coinRef.current.position.y = coinRef.current.userData.initialY + yOffset;
        }
      };
      
      // Apply hovering to each coin with different phases and speeds
      hoverCoin(coin1Ref, 'Coin1', 0, 1.2, 0.015);           // Base hover
      hoverCoin(coin2Ref, 'Coin2', Math.PI * 0.5, 1.0, 0.012);  // Quarter phase offset, slower
      hoverCoin(coin3Ref, 'Coin3', Math.PI * 1.5, 1.1, 0.01);        // Opposite phase, faster
      hoverCoin(coin4Ref, 'Coin4', Math.PI * 1.5, 1.1, 0.01);   // Three-quarter phase, smallest amplitude
    }
  });

  // Always return the group that contains the model  
  return (
    <group ref={groupRef} visible={true} position={position} scale={scale} rotation={rotation}>
      {/* The 3D model is added dynamically in useEffect */}
    </group>
  );
};

CyborgTempleScene.displayName = 'CyborgTempleScene';

export default CyborgTempleScene;