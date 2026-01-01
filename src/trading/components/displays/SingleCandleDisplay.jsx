import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as SkeletonUtilsClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { collection, getDocs, query, orderBy, limit, where, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import { useUser, SignIn } from '@clerk/nextjs';

// Preload models like CandleSnapshotRenderer does
if (typeof window !== 'undefined') {
  useGLTF.preload('/models/tinyVotiveBox.glb');
  useGLTF.preload('/models/tinyJapCanBox.glb');
  useGLTF.preload('/models/blockhead1.glb');
  useGLTF.preload('/models/blockhead2.glb');
  useGLTF.preload('/models/blockhead_runner.glb');
}




// Model viewer component with candle data display and texture support
// REPLACE the entire ModelViewer function in SingleCandleDisplay.jsx with this:

function ModelViewer({ modelPath, candleData = null, showPlaque = true, isFlipped = false, isRevealing = false }) {
  const gltf = useGLTF(modelPath);
  const { scene, materials, animations } = gltf;
  const modelRef = useRef();
  const groupRef = useRef();
  const [plaqueVisible, setPlaqueVisible] = useState(true);
  const [modelReady, setModelReady] = useState(false);
  const textureLoader = new THREE.TextureLoader();
  const boxMeshRef = useRef(null);
  const mixerRef = useRef();
  
  // Clone and setup the model with textures
  React.useEffect(() => {
    if (scene && modelRef.current) {
      // Use SkeletonUtilsClone for tattoo models (skinned meshes)
      let clonedModel;
      if (candleData?.devotionType === 'tattoo') {
        clonedModel = SkeletonUtilsClone(scene);
      } else {
        clonedModel = scene.clone();
      }
      
      // Scale and position the model - adjust for mobile
      const isMobile = window.innerWidth <= 768;
      clonedModel.scale.set(1, 1, 1);
      clonedModel.position.set(0, isMobile ? -1.2 : -1.2, isMobile ? -2 : -2);
      
      // Initialize bonesMap outside the blocks so it's accessible everywhere
      let bonesMap = {};
      
      // Handle tattoo devotions
      if (candleData && candleData.devotionType === 'tattoo') {
        console.log('[SingleCandleDisplay] TATTOO DEVOTION DETECTED');
        console.log('[SingleCandleDisplay] Model path:', modelPath);
        console.log('[SingleCandleDisplay] Candle data:', candleData);
        
        // Match CandleSnapshotRenderer's scale and position exactly
        clonedModel.scale.set(1.5, 1.5, 1.5);
        clonedModel.position.set(0, 0.5, -1);
        
        // Clear previous model and add new one
        while (modelRef.current.children.length > 0) {
          modelRef.current.remove(modelRef.current.children[0]);
        }
        groupRef.current = clonedModel;
        modelRef.current.add(clonedModel);
        
        // Build bones map BEFORE animation
        bonesMap = {};
        clonedModel.traverse((child) => {
          if (child.isBone) {
            bonesMap[child.name] = child;
          }
          // Handle skateboard, platform, and dumbell visibility
          if (child.isMesh && child.name) {
            const nameLower = child.name.toLowerCase();
            
            // Skateboard mesh visibility
            if (nameLower.includes('skateboard') && !nameLower.includes('platform')) {
              child.visible = candleData.selectedPose === 'skateboard';
            }
            // SkatePlatform visible only during skateboard animation
            else if (nameLower.includes('skateplatform') || 
                     (nameLower.includes('skate') && nameLower.includes('platform'))) {
              child.visible = candleData.selectedPose === 'skateboard';
            }
            // Platform2 visible for all other animations
            else if (nameLower === 'platform2' || nameLower.includes('platform2')) {
              child.visible = candleData.selectedPose !== 'skateboard';
            }
            // Dumbell1 visible only during curl animation
            else if (nameLower === 'dumbell1' || nameLower.includes('dumbell1')) {
              child.visible = candleData.selectedPose === 'curl';
            }
            // Dumbell2 visible only during curl animation
            else if (nameLower === 'dumbell2' || nameLower.includes('dumbell2')) {
              child.visible = candleData.selectedPose === 'curl';
            }
            // Surfboard visible only during surf animation
            else if (nameLower === 'surfboard' || nameLower.includes('surfboard')) {
              child.visible = candleData.selectedPose === 'surf';
            }
          }
        }); 
        console.log('[SingleCandleDisplay] Found', Object.keys(bonesMap).length, 'bones');
        
        // Apply animation EXACTLY like CompactCandleModal does
        console.log('[SingleCandleDisplay] Available animations:', animations?.map(a => a.name));
        console.log('[SingleCandleDisplay] Selected pose:', candleData.selectedPose);
        
        // Clear any existing mixer BEFORE checking for animations
        if (mixerRef.current) {
          mixerRef.current.stopAllAction();
          mixerRef.current = null;
        }
        
        // Create a new mixer for this model
        mixerRef.current = new THREE.AnimationMixer(clonedModel);
        
        if (candleData.selectedPose && animations && animations.length > 0) {
          console.log('[SingleCandleDisplay] Applying pose animation:', candleData.selectedPose);
          
          let targetAnimation = null;
          
          console.log('[SingleCandleDisplay] All animation names:', animations.map(a => a.name));
          
          if (candleData.selectedPose === 'run') {
            targetAnimation = animations.find(a => {
              const name = a.name;
              return name === 'Run_Pose' || 
                     name === 'RunPose' || 
                     name === 'Run' || 
                     name === 'Character_Rig|Run_Pose' ||
                     name.toLowerCase().includes('run');
            });
          } else if (candleData.selectedPose === 'dance') {
            targetAnimation = animations.find(a => {
              const name = a.name;
              return name === 'Dance_Pose' || 
                     name === 'DancePose' || 
                     name === 'Dance' ||
                     name === 'Character_Rig|Dance_Pose' ||
                     name.toLowerCase().includes('dance');
            });
          } else if (candleData.selectedPose === 'stand1') {
            targetAnimation = animations.find(a => {
              const name = a.name;
              return name === 'StandPose1' || 
                     name === 'Stand_Pose_1' ||
                     name === 'Character_Rig|StandPose1' ||
                     name.includes('StandPose1') ||
                     (name.includes('stand') && name.includes('1'));
            });
          } else if (candleData.selectedPose === 'stand2') {
            targetAnimation = animations.find(a => {
              const name = a.name;
              return name === 'StandPose2' || 
                     name === 'Stand_Pose_2' ||
                     name === 'Character_Rig|StandPose2' ||
                     name.includes('StandPose2') ||
                     (name.includes('stand') && name.includes('2'));
            });
          } else if (candleData.selectedPose === 'action') {
            targetAnimation = animations.find(a => {
              const name = a.name;
              return name === 'Action' || 
                     name === 'Character_Rig|Action' ||
                     name.toLowerCase() === 'action';
            });
          } else if (candleData.selectedPose === 'curl') {
            targetAnimation = animations.find(a => {
              const name = a.name;
              return name === 'Curl' || 
                     name === 'Character_Rig|Curl' ||
                     name.toLowerCase() === 'curl';
            });
          } else if (candleData.selectedPose === 'pray') {
            targetAnimation = animations.find(a => {
              const name = a.name;
              return name === 'Pray' || 
                     name === 'Character_Rig|Pray' ||
                     name.toLowerCase() === 'pray';
            });
          } else if (candleData.selectedPose === 'skateboard') {
            targetAnimation = animations.find(a => {
              const name = a.name;
              return name === 'Skateboard' || 
                     name === 'Character_Rig|Skateboard' ||
                     name.toLowerCase() === 'skateboard';
            });
          } else if (candleData.selectedPose === 'dance1') {
            targetAnimation = animations.find(a => {
              const name = a.name;
              return name === 'Dance1' || 
                     name === 'Character_Rig|Dance1' ||
                     name.toLowerCase() === 'dance1';
            });
          } else if (candleData.selectedPose === 'dance2') {
            targetAnimation = animations.find(a => {
              const name = a.name;
              return name === 'Dance2' || 
                     name === 'Character_Rig|Dance2' ||
                     name.toLowerCase() === 'dance2';
            });
          } else if (candleData.selectedPose === 'standpose1') {
            targetAnimation = animations.find(a => {
              const name = a.name;
              return name === 'StandPose1' || 
                     name === 'Character_Rig|StandPose1' ||
                     name.toLowerCase() === 'standpose1';
            });
          } else if (candleData.selectedPose === 'surf') {
            targetAnimation = animations.find(a => {
              const name = a.name;
              return name === 'Surf' || 
                     name === 'Character_Rig|Surf' ||
                     name.toLowerCase() === 'surf';
            });
          }
          
          if (targetAnimation) {
            console.log('[SingleCandleDisplay] Found target animation:', targetAnimation.name, 'duration:', targetAnimation.duration);
            
            // Stop ALL actions first to prevent blending
            mixerRef.current.stopAllAction();
            
            // Now play only the target animation - match working version
            const action = mixerRef.current.clipAction(targetAnimation);
            action.reset();
            action.setEffectiveWeight(1);
            action.setLoop(THREE.LoopRepeat, Infinity);
            action.play();
            
            // Use update(0.5) like the working version
            mixerRef.current.update(0.5);
            clonedModel.updateMatrixWorld(true);
            
            // Rebuild bones map after animation
            const newBonesMap = {};
            clonedModel.traverse(child => {
              if (child.isSkinnedMesh && child.skeleton) {
                child.skeleton.bones.forEach(bone => { 
                  newBonesMap[bone.name] = bone; 
                });
              }
            });
            bonesMap = newBonesMap;
            
            console.log('[SingleCandleDisplay] Animation applied with', Object.keys(bonesMap).length, 'bones');
          }
        }
        
        // Force re-render after model is ready
        setModelReady(true);
        
        // Model is already added to scene and bones map is rebuilt after animation
        
        // Apply optimal rotation for tattoo display
        
        // Handle background for tattoos
        if (candleData.background && candleData.background !== 'none') {
          const BACKGROUND_TEXTURES = {
            'cyberpunk': '/images/cyberpunk.webp',
            'synthwave': '/images/synthwave.webp',
            'gothicTokyo': '/images/gothicTokyo.webp',
            'neoTokyo': '/images/neoTokyo.webp',
            'aurora': '/images/aurora.webp',
            'sunset': '/images/gradient-sunset.webp',
            'dreams': '/images/gradient-dreams.webp',
            'tradingView': '/images/uattr.webp',
            'chart': '/images/chart.webp',
            'collectibles': '/images/pokemon2.webp',
            'alchemy': '/images/alchemy.gif',
              'guadalupe_pink': '/images/guadalupePink.jpg',
            'guadalupe_blue': '/images/guadalupeBlue.jpg'
          };
          
          const texturePath = BACKGROUND_TEXTURES[candleData.background];
          if (texturePath) {
            textureLoader.load(
              texturePath,
              (texture) => {
                const bgPlane = new THREE.PlaneGeometry(10, 10);
                const bgMaterial = new THREE.MeshBasicMaterial({ 
                  map: texture,
                  side: THREE.DoubleSide 
                });
                const bgMesh = new THREE.Mesh(bgPlane, bgMaterial);
                bgMesh.position.z = -3;
                bgMesh.renderOrder = -1000;
                // Add background to modelRef (world space), not clonedModel
                if (modelRef.current) {
                  modelRef.current.add(bgMesh);
                }
              }
            );
          }
        }
      }
      
      // Process meshes for candles (senora, baseColor, background textures)
      clonedModel.traverse((child) => {
        if (child.isSkinnedMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.skeleton) {
            child.skeleton.calculateInverses();
            child.skeleton.computeBoneTexture();
            child.skeleton.update();
          }
        } else if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          // Apply user image to senora mesh for votive candles
          const isSenoraObject = child.name === 'senora' || 
                                child.name === 'Senora' ||
                                (child.material && (
                                  child.material.name === 'senora' ||
                                  child.material.name === 'senora.001' ||
                                  child.material.name === 'Senora' ||
                                  child.material.name === 'Material.001'
                                )) ||
                                (child.parent && child.parent.name === 'senora');
          
          if (candleData && candleData.image && candleData.candleType === 'votive' && isSenoraObject) {
            if (candleData.image && (candleData.image.startsWith('http://') || candleData.image.startsWith('https://'))) {
              textureLoader.crossOrigin = 'anonymous';
            }
            
            textureLoader.load(
              candleData.image,
              (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.flipY = false;
                
                const imageAspect = texture.image.width / texture.image.height;
                const targetAspect = 1.0;
                
                if (imageAspect > targetAspect) {
                  texture.repeat.set(1, imageAspect / targetAspect);
                } else {
                  texture.repeat.set(targetAspect / imageAspect, 1);
                }
                
                texture.offset.set(
                  (1 - texture.repeat.x) / 2,
                  (1 - texture.repeat.y) / 2
                );
                
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                
                if (!child.material.userData.cloned) {
                  child.material = child.material.clone();
                  child.material.userData.cloned = true;
                }
                
                child.material.map = texture;
                child.material.transparent = true;
                child.material.opacity = 1;
                child.material.alphaTest = 0.1;
                child.material.needsUpdate = true;
              },
              undefined,
              (error) => {
                console.error('[SingleCandleDisplay] Error loading senora texture:', error);
              }
            );
          }
          
          // Clone material for all meshes
          if (child.material) {
            child.material = child.material.clone();
          }
          
          // Check if this is the Box mesh
          const isBoxMesh = child.name === 'Box' || child.name === 'box';
          
          // Apply baseColor to XBase meshes (but NOT to Box mesh)
          const meshNameLower = child.name.toLowerCase();
          const isXBaseMesh = !isBoxMesh && (
                             meshNameLower === 'xbase' || 
                             meshNameLower.startsWith('xbase') ||
                             (modelPath.includes('tinyVotive') && 
                              (meshNameLower === 'base' || 
                               meshNameLower === 'cylinder' || 
                               meshNameLower === 'candle' ||
                               meshNameLower.includes('candle_base') ||
                               meshNameLower.includes('wax'))));
          
          if (isXBaseMesh && candleData?.baseColor && candleData.baseColor !== '#ffffff') {
            const color = new THREE.Color(candleData.baseColor);
            child.material.color = color;
            child.material.needsUpdate = true;
          }
          
          // Apply background texture to Box mesh (candles only, not tattoos)
          if (isBoxMesh && candleData && candleData.background && candleData.background !== 'none' && candleData.devotionType !== 'tattoo') {
            boxMeshRef.current = child;
            
            const BACKGROUND_TEXTURES = {
              'cyberpunk': '/images/cyberpunk.webp',
              'synthwave': '/images/synthwave.webp',
              'gothicTokyo': '/images/gothicTokyo.webp',
              'neoTokyo': '/images/neoTokyo.webp',
              'aurora': '/images/aurora.webp',
              'sunset': '/images/gradient-sunset.webp',
              'dreams': '/images/gradient-dreams.webp',
              'tradingView': '/images/uattr.webp',
              'chart': '/images/chart.webp',
              'collectibles': '/images/pokemon2.webp',
              'alchemy': '/images/alchemy.gif',
              'guadalupe_pink': '/images/guadalupePink.jpg',
            'guadalupe_blue': '/images/guadalupeBlue.jpg'
            };
            
            const texturePath = BACKGROUND_TEXTURES[candleData.background];
            
            if (texturePath) {
              if (texturePath.startsWith('http://') || texturePath.startsWith('https://')) {
                textureLoader.crossOrigin = 'anonymous';
              }
              
              textureLoader.load(
                texturePath,
                (texture) => {
                  texture.colorSpace = THREE.SRGBColorSpace;
                  texture.flipY = false;
                  texture.wrapS = THREE.ClampToEdgeWrapping;
                  texture.wrapT = THREE.ClampToEdgeWrapping;
                  texture.needsUpdate = true;
                  
                  child.material = child.material.clone();
                  child.material.map = texture;
                  child.material.needsUpdate = true;
                  
                  if (child.material.color) {
                    child.material.color.set(0xffffff);
                  }
                },
                undefined,
                (error) => {
                  console.error(`Error loading background texture ${texturePath}:`, error);
                }
              );
            }
          } else if (isBoxMesh && (!candleData || !candleData.background || candleData.background === 'none')) {
            child.material = child.material.clone();
            child.material.map = null;
            child.material.color.set(0x333333);
            child.material.needsUpdate = true;
          }
        }
      });
      
      // ============================================
      // TATTOO PLACEMENT - FIXED VERSION
      // ============================================
      if (candleData && candleData.devotionType === 'tattoo' && candleData.tattooPlacement && candleData.tattooDesign) {
        const placement = candleData.tattooPlacement;
        const useAnimation = candleData.selectedPose && candleData.selectedPose !== 'tpose';
        const hasBoneData = placement.boneName && placement.offsetLocal && placement.normalLocal;
        
        console.log('[SingleCandleDisplay] Tattoo mode:', useAnimation && hasBoneData ? 'BONE' : 'WORLD');
        
        // Check for worldPosition (new format) or fall back to legacy formats
        const worldPos = placement.worldPosition || placement.position;
        const worldNormal = placement.worldNormal || placement.normal;
        
        if ((useAnimation && hasBoneData) || worldPos) {
          // Create tattoo mesh
          const tattooGeometry = new THREE.PlaneGeometry(0.4, 0.4);
          const tattooMaterial = new THREE.MeshBasicMaterial({
            color: 0xff00ff, // Placeholder until texture loads
            transparent: true,
            opacity: 1,
            depthWrite: false,
            depthTest: true,
            side: THREE.DoubleSide,
            alphaTest: 0.1
          });
          
          const tattooMesh = new THREE.Mesh(tattooGeometry, tattooMaterial);
          tattooMesh.renderOrder = 999;
          
          // Apply positioning based on animation state
          if (useAnimation && hasBoneData) {
            // === BONE-RELATIVE POSITIONING ===
            const bone = bonesMap[placement.boneName];
            
            if (bone) {
              console.log('[SingleCandleDisplay] Attaching to bone:', placement.boneName);
              
              bone.updateMatrixWorld(true);
              const boneWorldPos = new THREE.Vector3();
              const boneWorldQuat = new THREE.Quaternion();
              bone.getWorldPosition(boneWorldPos);
              bone.getWorldQuaternion(boneWorldQuat);
              
              // Transform local offset to world
              const offsetLocal = new THREE.Vector3(
                placement.offsetLocal.x,
                placement.offsetLocal.y,
                placement.offsetLocal.z
              );
              const offsetWorld = offsetLocal.clone().applyQuaternion(boneWorldQuat);
              
              // Calculate world position
              const tattooWorldPos = boneWorldPos.clone().add(offsetWorld);
              
              // Transform local normal to world
              const normalLocal = new THREE.Vector3(
                placement.normalLocal.x,
                placement.normalLocal.y,
                placement.normalLocal.z
              );
              const normalWorld = normalLocal.clone().applyQuaternion(boneWorldQuat).normalize();
              
              // Offset along normal
              tattooWorldPos.add(normalWorld.clone().multiplyScalar(0.02));
              
              // Set position
              tattooMesh.position.copy(tattooWorldPos);
              
              // FIX: Use quaternion instead of lookAt!
              const defaultNormal = new THREE.Vector3(0, 0, 1);
              const orientQuat = new THREE.Quaternion();
              orientQuat.setFromUnitVectors(defaultNormal, normalWorld);
              tattooMesh.quaternion.copy(orientQuat);
              
              console.log('[SingleCandleDisplay] Tattoo at:', tattooWorldPos.toArray().map(v => v.toFixed(3)));
            } else {
              console.warn('[SingleCandleDisplay] Bone not found:', placement.boneName);
              // Fallback to world position
              if (worldPos) {
                tattooMesh.position.set(worldPos.x || 0, worldPos.y || 0, worldPos.z || 0);
              }
            }
          } else if (worldPos) {
            // For T-pose or no bone data, use world position directly
            console.log('[SingleCandleDisplay] Using world position for T-pose');
            tattooMesh.position.set(
              worldPos.x || 0,
              worldPos.y || 0,
              worldPos.z || 0
            );
            
            // Orient based on normal
            if (worldNormal) {
              const normal = new THREE.Vector3(
                worldNormal.x || 0,
                worldNormal.y || 0,
                worldNormal.z || 1
              ).normalize();
              
              // Offset along normal to prevent z-fighting
              tattooMesh.position.add(normal.clone().multiplyScalar(0.02));
              
              // Orient using quaternion
              const defaultNormal = new THREE.Vector3(0, 0, 1);
              const quaternion = new THREE.Quaternion();
              quaternion.setFromUnitVectors(defaultNormal, normal);
              tattooMesh.quaternion.copy(quaternion);
            }
          }
          
          // KEY FIX: Add to modelRef (world space), NOT to clonedModel!
          modelRef.current.add(tattooMesh);
          
          console.log('[SingleCandleDisplay] Tattoo added at world position:', tattooMesh.position.toArray());
          
          // Load texture and update material
          textureLoader.load(
            `/images/${candleData.tattooDesign}.png`,
            (texture) => {
              texture.colorSpace = THREE.SRGBColorSpace;
              texture.needsUpdate = true;
              
              tattooMesh.material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                opacity: 1,
                depthWrite: false,
                depthTest: true,
                side: THREE.DoubleSide,
                alphaTest: 0.1  // Add alphaTest like CandleSnapshotRenderer
              });
              
              console.log('[SingleCandleDisplay] Tattoo texture loaded and applied');
            },
            undefined,
            (error) => {
              console.error('[SingleCandleDisplay] Failed to load tattoo texture:', error);
            }
          );
        } else {
          console.warn('[SingleCandleDisplay] No worldPosition found in tattoo placement data');
        }
      }
    }
    
    // Cleanup mixer on unmount or when candleData changes
    return () => {
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
    };
  }, [scene, materials, candleData]);
  
  // Update animation mixer - but NOT for tattoos with poses (they should be frozen)
  useFrame((state, delta) => {
    // For tattoos with poses, DON'T update anything - keep completely frozen
    if (candleData?.devotionType === 'tattoo' && candleData?.selectedPose) {
      // Do nothing - keep the pose frozen exactly where we set it
      return;
    }
    
    // For non-tattoo items or items without poses, update normally
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
  });
  
  if (!scene) {
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="orange" />
      </mesh>
    );
  }
  
  return (
    <>
      {/* Lighting setup - matching CompactCandleModal */}
      <ambientLight intensity={1.2} />
      <directionalLight 
        position={[5, 10, 5]} 
        intensity={0.8} 
        castShadow 
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[0, 3, 2]} intensity={0.5} color="#ffaa00" />
      <pointLight position={[-3, 2, -2]} intensity={0.3} color="#ffffff" />
      
      {/* The model - hide when flipped */}
      <group ref={modelRef} visible={!isFlipped}>
      </group>
    </>
  );
}

// Main component for single candle display
export default function SingleCandleDisplay({ onOpenCompactModal, onClose }) {
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'my', or 'summary'
  const [allCandles, setAllCandles] = useState([]);
  const [myCandles, setMyCandles] = useState([]);
  const [currentAllCandleIndex, setCurrentAllCandleIndex] = useState(0);
  const [currentMyCandleIndex, setCurrentMyCandleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMyCandles, setLoadingMyCandles] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const [particleCandleType, setParticleCandleType] = useState(null);
  const [showPlaque, setShowPlaque] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [filterMode, setFilterMode] = useState('newest'); // 'random', 'leaderboard', 'newest'
  const [filteredCandles, setFilteredCandles] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [summaryPeriod, setSummaryPeriod] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [summaryData, setSummaryData] = useState({
    sentimentScore: 75,
    totalCandles: 0,
    petitions: 0,
    praise: 0,
    confessions: 0,
    trend: 'up',
    summary: '',
    themes: []
  });
  const { user, isSignedIn } = useUser();
  const [showSignInModal, setShowSignInModal] = useState(false);
  
  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Helper function to estimate object size in bytes
  const getObjectSize = (obj) => {
    const jsonString = JSON.stringify(obj);
    return new Blob([jsonString]).size;
  };

  // Fetch all candles from Firebase
  useEffect(() => {
    const fetchAllCandles = async () => {
      try {
        setLoading(true);
        const allData = [];
        
        // Fetch from legacy candles collection
        const candlesRef = collection(db, 'candles');
        const limitCount = filterMode === 'leaderboard' ? 25 : 10;
        const q = query(candlesRef, orderBy('createdAt', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);
        
        const candlesData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            isPolaroid: false
          };
        });
        
        allData.push(...candlesData);
        
        // Also fetch from polaroids collection
        const polaroidsRef = collection(db, 'polaroids');
        const polaroidQuery = query(polaroidsRef, limit(limitCount));
        const polaroidSnapshot = await getDocs(polaroidQuery);
        
        const polaroidsData = polaroidSnapshot.docs.map(doc => {
          const data = doc.data();
          // Debug log for polaroid items
          console.log('[SingleCandleDisplay] Fetched polaroid:', {
            id: doc.id,
            devotionType: data.devotionType,
            username: data.username
          });
          return {
            id: doc.id,
            ...data,
            // Map polaroid fields to expected format
            isPolaroid: true,
            image: data.imageUrl, // Polaroids use imageUrl for the snapshot
            userName: data.username || 'Anonymous',
            burnedAmount: parseInt(data.burnedAmount) || 0,
            candleType: data.candleType || data.devotionType || 'votive',
            createdAt: data.createdAt,
            devotionType: data.devotionType,
            tattooDesign: data.tattooDesign,
            tattooCharacter: data.tattooCharacter,
            baseColor: data.baseColor,
            background: data.background
          };
        });
        
        allData.push(...polaroidsData);
        
        // Log memory usage info
        if (allData.length > 0) {
          const totalSize = allData.reduce((sum, candle) => sum + getObjectSize(candle), 0);
          const avgSize = Math.round(totalSize / allData.length);
          console.log(`Fetched ${allData.length} total items (${polaroidsData.length} polaroids, ${candlesData.length} legacy)`);
        }
        
        // Sort all data by createdAt
        const sortedData = allData.sort((a, b) => {
          // Handle different timestamp formats
          const getTime = (item) => {
            if (item.createdAt?.seconds) return item.createdAt.seconds;
            if (item.createdAt instanceof Date) return item.createdAt.getTime() / 1000;
            if (typeof item.createdAt === 'string') return new Date(item.createdAt).getTime() / 1000;
            return 0;
          };
          
          const aTime = getTime(a);
          const bTime = getTime(b);
          return bTime - aTime; // Descending order (newest first)
        });
        
        // Apply filter mode
        let processedData = sortedData;
        if (filterMode === 'leaderboard') {
          // Filter and sort by burnedAmount for leaderboard
          processedData = sortedData
            .filter(candle => candle.burnedAmount && candle.burnedAmount > 100)
            .sort((a, b) => (b.burnedAmount || 0) - (a.burnedAmount || 0))
            .slice(0, 10); // Top 10 burners
        } else {
          // Take first 20 for other modes
          processedData = sortedData.slice(0, 20);
        }
        
        setAllCandles(processedData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching all candles:', error);
        setLoading(false);
      }
    };
    
    fetchAllCandles();
  }, [filterMode]);
  
  // Fetch user's candles when signed in
  useEffect(() => {
    const fetchMyCandles = async () => {
      if (!isSignedIn || !user) return;
      
      
      // Try username first, then fall back to firstName or fullName
      const userIdentifier = user?.username || user?.firstName || user?.fullName || 'Anonymous';
      
      try {
        setLoadingMyCandles(true);
        const allUserData = [];
        
        // Fetch from legacy candles collection
        const candlesRef = collection(db, 'candles');
        
        // First try by createdBy (user ID) which is most reliable
        let q = query(
          candlesRef, 
          where('createdBy', '==', user.id),
          limit(10) // Reduced limit
        );
        let snapshot = await getDocs(q);
        
        
        // If no results, try by createdByUsername
        if (snapshot.size === 0) {
          q = query(
            candlesRef, 
            where('createdByUsername', '==', userIdentifier),
            limit(10) // Reduced limit
          );
          snapshot = await getDocs(q);
          // console.log(`Found ${snapshot.size} candles for username: ${userIdentifier}`);
        }
        
        const userCandlesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          isPolaroid: false
        }));
        
        allUserData.push(...userCandlesData);
        
        // Also fetch from polaroids collection (new candles and tattoos)
        const polaroidsRef = collection(db, 'polaroids');
        
        // Try to fetch by createdBy (user ID) first, then by username
        let polaroidQuery = query(
          polaroidsRef,
          where('createdBy', '==', user.id),
          limit(10)
        );
        let polaroidSnapshot = await getDocs(polaroidQuery);
        
        // If no results with createdBy, try username
        if (polaroidSnapshot.size === 0) {
          polaroidQuery = query(
            polaroidsRef,
            where('username', '==', userIdentifier),
            limit(10)
          );
          polaroidSnapshot = await getDocs(polaroidQuery);
        }
        
        const polaroidsData = polaroidSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            // Map polaroid fields to expected format
            isPolaroid: true,
            image: data.imageUrl, // Polaroids use imageUrl for the snapshot
            userName: data.username || 'Anonymous',
            burnedAmount: parseInt(data.burnedAmount) || 0,
            candleType: data.candleType || data.devotionType || 'votive',
            createdAt: data.createdAt,
            devotionType: data.devotionType,
            tattooDesign: data.tattooDesign,
            tattooCharacter: data.tattooCharacter,
            baseColor: data.baseColor,
            background: data.background
          };
        });
        
        allUserData.push(...polaroidsData);
        
        // Log memory usage for combined data
        if (allUserData.length > 0) {
          const totalSize = allUserData.reduce((sum, candle) => sum + getObjectSize(candle), 0);
          console.log(`Fetched ${allUserData.length} user items (${polaroidsData.length} polaroids, ${userCandlesData.length} legacy)`);
        }
        
        // Sort by createdAt client-side to avoid needing composite index
        const sortedUserCandles = allUserData.sort((a, b) => {
          // Handle different timestamp formats
          const getTime = (item) => {
            if (item.createdAt?.seconds) return item.createdAt.seconds;
            if (item.createdAt instanceof Date) return item.createdAt.getTime() / 1000;
            if (typeof item.createdAt === 'string') return new Date(item.createdAt).getTime() / 1000;
            return 0;
          };
          
          const aTime = getTime(a);
          const bTime = getTime(b);
          return bTime - aTime; // Descending order (newest first)
        });
        
        // Take only the first 10 after sorting
        setMyCandles(sortedUserCandles.slice(0, 10));
        setLoadingMyCandles(false);
      } catch (error) {
        console.error('Error fetching user candles:', error);
        setLoadingMyCandles(false);
      }
    };
    
    if (activeTab === 'my') {
      fetchMyCandles();
    }
  }, [activeTab, isSignedIn, user]);
  
  // Fetch and analyze summary data
  useEffect(() => {
    if (activeTab !== 'summary') return;
    
    const fetchSummaryData = async () => {
      try {
        // First, check if we have a cached summary for today
        const today = new Date();
        const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const summaryDocId = `${summaryPeriod}_${dateKey}`;
        
        // Try to get cached summary from Firestore
        // console.log('Looking for summary document:', summaryDocId);
        const cachedSummaryRef = doc(db, 'summaries', summaryDocId);
        const cachedSummary = await getDoc(cachedSummaryRef);
        
        if (cachedSummary.exists()) {
          // Use cached data
          const cached = cachedSummary.data();
          // console.log('Found cached summary:', cached);
          setSummaryData({
            sentimentScore: cached.sentimentScore || 75,
            totalCandles: cached.totalCandles || 0,
            petitions: cached.petitions || 0,
            praise: cached.praise || 0,
            confessions: cached.confessions || 0,
            trend: cached.trend || 'up',
            summary: cached.summary || '',
            themes: cached.themes || []
          });
          // console.log('Using cached summary from Firestore');
          return;
        }
        
        // No cache found - don't generate locally, wait for cloud function
        // console.log('No cached summary found. Run the cloud function to generate one.');
        return;
        
        
      } catch (error) {
        console.error('Error fetching summary data:', error);
      }
    };
    
    fetchSummaryData();
  }, [activeTab, summaryPeriod]);
  
  // Apply filtering/sorting based on filterMode
  useEffect(() => {
    if (allCandles.length === 0) {
      setFilteredCandles([]);
      return;
    }
    
    let processed = [...allCandles];
    
    switch (filterMode) {
      case 'leaderboard':
        // Sort by burnedAmount descending (highest burners first)
        processed = processed
          .filter(c => c.burnedAmount && parseInt(c.burnedAmount) > 0)
          .sort((a, b) => {
            const burnA = parseInt(a.burnedAmount) || 0;
            const burnB = parseInt(b.burnedAmount) || 0;
            return burnB - burnA;
          })
          .slice(0, 20); // Take top 20 burners
        break;
        
      case 'newest':
        // Already sorted by createdAt desc from Firebase
        processed = processed.slice(0, 20);
        break;
        
      case 'random':
        // Shuffle array using Fisher-Yates algorithm
        for (let i = processed.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [processed[i], processed[j]] = [processed[j], processed[i]];
        }
        processed = processed.slice(0, 20);
        break;
    }
    
    setFilteredCandles(processed);
    setCurrentAllCandleIndex(0); // Reset to first candle when filter changes
  }, [allCandles, filterMode]);
  
  // Cycle through candles every 5 seconds with reveal effect (when not paused)
  useEffect(() => {
    if (activeTab === 'all' && filteredCandles.length > 0 && !isPaused) {
      const interval = setInterval(() => {
        // Capture the current candle type before transition
        const currentType = filteredCandles[currentAllCandleIndex]?.candleType;
        // console.log('Transition starting - Current candle type:', currentType, 'Index:', currentAllCandleIndex);
        
        // Hide plaque immediately when starting reveal
        setShowPlaque(false);
        // Trigger reveal animation
        setIsRevealing(true);
        
        // Show particles earlier in the transition (but not when flipped)
        setTimeout(() => {
          if (!isFlipped) {
            // console.log('Setting particle type to:', currentType);
            setParticleCandleType(currentType);
            setShowParticles(true);
          }
        }, 150);  // Reduced from 400ms to 150ms
        
        // After curtains close, change the candle
        setTimeout(() => {
          setCurrentAllCandleIndex((prev) => (prev + 1) % filteredCandles.length);
        }, 600);
        
        // Hide particles after showing
        setTimeout(() => {
          setShowParticles(false);
          setParticleCandleType(null);
        }, 650);  // Adjusted to 650ms (500ms duration from 150ms start)
        
        // Open curtains after candle changes
        setTimeout(() => {
          setIsRevealing(false);
        }, 800);
        
        // Show plaque after curtains are fully open (add extra delay)
        setTimeout(() => {
          setShowPlaque(true);
        }, 1200);
      }, 5000); // 5 seconds
      
      return () => clearInterval(interval);
    } else if (activeTab === 'my' && myCandles.length > 1 && !isPaused) {
      const interval = setInterval(() => {
        // Capture the current candle type before transition
        const currentType = myCandles[currentMyCandleIndex]?.candleType;
        // console.log('My tab transition - Current candle type:', currentType, 'Index:', currentMyCandleIndex);
        
        // Hide plaque immediately when starting reveal
        setShowPlaque(false);
        // Trigger reveal animation
        setIsRevealing(true);
        
        // Show particles earlier in the transition (but not when flipped)
        setTimeout(() => {
          if (!isFlipped) {
            // console.log('Setting particle type to:', currentType);
            setParticleCandleType(currentType);
            setShowParticles(true);
          }
        }, 150);  // Reduced from 400ms to 150ms
        
        // After curtains close, change the candle
        setTimeout(() => {
          setCurrentMyCandleIndex((prev) => (prev + 1) % myCandles.length);
        }, 600);
        
        // Hide particles after showing
        setTimeout(() => {
          setShowParticles(false);
          setParticleCandleType(null);
        }, 650);  // Adjusted to 650ms (500ms duration from 150ms start)
        
        // Open curtains after candle changes
        setTimeout(() => {
          setIsRevealing(false);
        }, 800);
        
        // Show plaque after curtains are fully open (add extra delay)
        setTimeout(() => {
          setShowPlaque(true);
        }, 1200);
      }, 5000); // 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [activeTab, filteredCandles, myCandles, isPaused, currentAllCandleIndex, currentMyCandleIndex, isFlipped]);
  
  // Clean up old textures when switching candles (helps with memory)
  useEffect(() => {
    return () => {
      // This cleanup runs when component unmounts or candle changes
      if (window.THREE) {
        const cache = window.THREE.Cache;
        if (cache && cache.enabled) {
          cache.clear();
        }
      }
    };
  }, [currentAllCandleIndex, currentMyCandleIndex]);

  // Get current candle data based on active tab
  const currentCandle = activeTab === 'all' 
    ? filteredCandles[currentAllCandleIndex]
    : myCandles[currentMyCandleIndex];
  
  // Determine model path based on devotion type
  const getModelPath = (candle) => {
    if (!candle) return '/models/tinyVotiveBox.glb';
    
    // Handle tattoo devotions
    if (candle.devotionType === 'tattoo') {
      if (candle.tattooCharacter === 'blockhead2') {
        return '/models/blockhead2.glb';
      } else if (candle.tattooCharacter === 'blockhead_runner') {
        return '/models/blockhead_runner.glb';
      }
      return '/models/blockhead1.glb';
    }
    
    // Use box versions for better display with backgrounds
    if (candle.candleType === 'japanese') {
      return '/models/tinyJapCanBox.glb';
    }
    return '/models/tinyVotiveBox.glb'; // Default to votive box
  };
  
  const currentModelPath = currentCandle 
    ? getModelPath(currentCandle)
    : '/models/tinyVotiveBox.glb'; // Default placeholder
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: isMobile ? '100%' : '26rem',
      height: isMobile ? '100vh' : '35rem',
      maxWidth: isMobile ? '100%' : '26rem',
      maxHeight: isMobile ? '100vh' : '35rem',
      margin: isMobile ? 0 : 'auto',
      background: 'rgba(10, 10, 20, 0.1)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRadius: isMobile ? '0' : '20px',
      border: !isMobile ? '1px solid rgba(255, 215, 0, 0.2)' : 'none',
      overflow: 'hidden',
      boxShadow: !isMobile ? 'inset 0 0 30px rgba(255, 215, 0, 0.05), 0 8px 32px rgba(0, 0, 0, 0.3)' : 'none',
      position: isMobile ? 'fixed' : 'relative',
      top: isMobile ? 0 : 'auto',
      left: isMobile ? 0 : 'auto',
      right: isMobile ? 0 : 'auto',
      bottom: isMobile ? 0 : 'auto',
      zIndex: isMobile ? 99999 : 'auto',
      paddingTop: isMobile ? 'env(safe-area-inset-top)' : 0,
      paddingBottom: isMobile ? 'env(safe-area-inset-bottom)' : 0
    }}>
      {/* Tab buttons */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(90deg, rgba(255, 215, 0, 0.05) 0%, transparent 100%)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
        position: 'relative'
      }}>
        {/* Close button for mobile */}
        {isMobile && onClose && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255, 0, 0, 0.1)',
              border: '1px solid rgba(255, 0, 0, 0.3)',
              color: '#ff6666',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 100000,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 0, 0, 0.2)';
              e.target.style.borderColor = 'rgba(255, 0, 0, 0.5)';
              e.target.style.color = '#ff9999';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 0, 0, 0.1)';
              e.target.style.borderColor = 'rgba(255, 0, 0, 0.3)';
              e.target.style.color = '#ff6666';
            }}
          >
            ✕
          </button>
        )}
        <div style={{ display: 'flex' }}>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              flex: 1,
              padding: '12px',
              background: activeTab === 'all' ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
              color: activeTab === 'all' ? '#ffd700' : 'rgba(255, 255, 255, 0.6)',
              border: 'none',
              borderBottom: activeTab === 'all' ? '2px solid #ffd700' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'all' ? 'bold' : 'normal',
              transition: 'all 0.3s ease',
              textShadow: activeTab === 'all' ? '0 0 10px rgba(255, 215, 0, 0.5)' : 'none'
            }}
          >
            All Votives
          </button>
          <button
            onClick={() => setActiveTab('my')}
            style={{
              flex: 1,
              padding: '12px',
              background: activeTab === 'my' ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
              color: activeTab === 'my' ? '#ffd700' : 'rgba(255, 255, 255, 0.6)',
              border: 'none',
              borderBottom: activeTab === 'my' ? '2px solid #ffd700' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'my' ? 'bold' : 'normal',
              transition: 'all 0.3s ease',
              textShadow: activeTab === 'my' ? '0 0 10px rgba(255, 215, 0, 0.5)' : 'none'
            }}
          >
            My Votives
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            style={{
              flex: 1,
              padding: '12px',
              background: activeTab === 'summary' ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
              color: activeTab === 'summary' ? '#ffd700' : 'rgba(255, 255, 255, 0.6)',
              border: 'none',
              borderBottom: activeTab === 'summary' ? '2px solid #ffd700' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'summary' ? 'bold' : 'normal',
              transition: 'all 0.3s ease',
              textShadow: activeTab === 'summary' ? '0 0 10px rgba(255, 215, 0, 0.5)' : 'none'
            }}
          >
            Summary
          </button>
        </div>
        
        {/* Filter dropdown for All Candles tab */}
        {activeTab === 'all' && (
          <div style={{
            padding: '8px',
            background: '#1a1a1a',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ color: '#888', fontSize: '12px' }}>View:</span>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              style={{
                background: '#2a2a2a',
                color: '#00ff00',
                border: '1px solid #444',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="random">🎲 Random Mix</option>
              <option value="leaderboard">🔥 Top Burners</option>
              <option value="newest">✨ Newest</option>
            </select>
            {filterMode === 'leaderboard' && filteredCandles.length > 0 && (
              <span style={{ 
                color: '#ffb000', 
                fontSize: '11px',
                marginLeft: 'auto'
              }}>
                #1 burned {parseInt(filteredCandles[0]?.burnedAmount || 0).toLocaleString()} RL80
              </span>
            )}
            {filterMode !== 'leaderboard' && currentCandle && (
              <span style={{ 
                color: '#888',
                fontSize: '14px',
                marginLeft: 'auto',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {(() => {
                  const messageType = currentCandle?.messageType;
                  if (messageType) {
                    const displayType = messageType.charAt(0).toUpperCase() + messageType.slice(1);
                    return (
                      <>
                        Msg Protocol: <span style={{ color: '#00ff00' }}>{displayType}</span>
                      </>
                    );
                  }
                  return 'EX VOTO';
                })()}
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* 3D viewer or Summary Dashboard */}
      <div style={{ 
        flex: 1,
        position: 'relative',
        background: 'rgba(0, 0, 0, 0.3)',
        display: 'flex',
        width: '100%',
        minHeight: 0
      }}>
        {activeTab === 'summary' ? (
          // Summary Dashboard
          <div style={{
            width: '100%',
            height: '100%',
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {/* Time Period Selector */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '10px'
            }}>
              {['daily', 'weekly', 'monthly'].map(period => (
                <button
                  key={period}
                  onClick={() => setSummaryPeriod(period)}
                  style={{
                    padding: '8px 16px',
                    background: summaryPeriod === period ? '#00ff00' : 'transparent',
                    color: summaryPeriod === period ? '#000' : '#666',
                    border: `1px solid ${summaryPeriod === period ? '#00ff00' : '#333'}`,
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: summaryPeriod === period ? 'bold' : 'normal',
                    transition: 'all 0.3s ease',
                    textTransform: 'capitalize'
                  }}
                >
                  {period}
                </button>
              ))}
            </div>

            {/* Sentiment Score Circle */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}>
              <div style={{
                position: 'relative',
                width: '150px',
                height: '150px'
              }}>
                <svg width="150" height="150" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="75"
                    cy="75"
                    r="65"
                    stroke="#333"
                    strokeWidth="10"
                    fill="none"
                  />
                  <circle
                    cx="75"
                    cy="75"
                    r="65"
                    stroke={`hsl(${summaryData.sentimentScore * 1.2}, 100%, 50%)`}
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 65 * summaryData.sentimentScore / 100} ${2 * Math.PI * 65}`}
                    strokeLinecap="round"
                    style={{
                      transition: 'stroke-dasharray 1s ease'
                    }}
                  />
                </svg>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: '36px',
                    fontWeight: 'bold',
                    color: `hsl(${summaryData.sentimentScore * 1.2}, 100%, 50%)`
                  }}>
                    {summaryData.sentimentScore}
                  </div>
                  <div style={{ color: '#666', fontSize: '12px' }}>
                    {summaryData.sentimentScore >= 90 ? 'Joyful' :
                     summaryData.sentimentScore >= 70 ? 'Hopeful' :
                     summaryData.sentimentScore >= 50 ? 'Seeking' :
                     summaryData.sentimentScore >= 30 ? 'Struggling' : 'Crisis'}
                  </div>
                </div>
              </div>
              <div style={{
                display: 'flex',
                gap: '5px',
                alignItems: 'center'
              }}>
                <span style={{ 
                  color: summaryData.trend === 'up' ? '#00ff00' : '#ff0000',
                  fontSize: '14px'
                }}>
                  {summaryData.trend === 'up' ? '↑' : '↓'}
                </span>
                <span style={{ color: '#888', fontSize: '12px' }}>
                  vs {summaryPeriod === 'daily' ? 'yesterday' : summaryPeriod === 'weekly' ? 'last week' : 'last month'}
                </span>
              </div>
            </div>

            {/* Message Type Breakdown */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px'
            }}>
              <div style={{
                background: 'rgba(0, 255, 136, 0.1)',
                border: '1px solid rgba(0, 255, 136, 0.3)',
                borderRadius: '8px',
                padding: '15px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#00ff88' }}>
                  {summaryData.praise}
                </div>
                <div style={{ color: '#888', fontSize: '12px', marginTop: '5px' }}>
                  ✨ Praise
                </div>
              </div>
              <div style={{
                background: 'rgba(255, 176, 0, 0.1)',
                border: '1px solid rgba(255, 176, 0, 0.3)',
                borderRadius: '8px',
                padding: '15px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffb000' }}>
                  {summaryData.petitions}
                </div>
                <div style={{ color: '#888', fontSize: '12px', marginTop: '5px' }}>
                  🙏 Petitions
                </div>
              </div>
              <div style={{
                background: 'rgba(150, 100, 255, 0.1)',
                border: '1px solid rgba(150, 100, 255, 0.3)',
                borderRadius: '8px',
                padding: '15px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9664ff' }}>
                  {summaryData.confessions}
                </div>
                <div style={{ color: '#888', fontSize: '12px', marginTop: '5px' }}>
                  💭 Confessions
                </div>
              </div>
            </div>

            {/* AI Summary */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid #333',
              borderRadius: '10px',
              padding: '20px'
            }}>
              <h3 style={{
                color: '#00ff00',
                fontSize: '16px',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                🤖 AI Insight
              </h3>
              <p style={{
                color: '#ccc',
                fontSize: '14px',
                lineHeight: '1.6',
                marginBottom: '15px'
              }}>
                {summaryData.summary || `Today's platform shows a strong sense of gratitude and hope. The community is actively seeking guidance, with ${summaryData.petitions} petitions focusing on financial stability and personal growth. The ${summaryData.praise} messages of praise reflect deep appreciation for recent successes and unexpected opportunities. Notable themes include career breakthroughs, personal wellness, and community support.`}
              </p>
              
              {/* Key Themes */}
              <div style={{ marginTop: '15px' }}>
                <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>
                  Key Themes:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(summaryData.themes.length ? summaryData.themes : ['Gratitude', 'Hope', 'Success', 'Growth', 'Wellness']).map((theme, i) => (
                    <span
                      key={i}
                      style={{
                        background: 'rgba(0, 255, 136, 0.2)',
                        border: '1px solid rgba(0, 255, 136, 0.4)',
                        borderRadius: '15px',
                        padding: '4px 12px',
                        color: '#00ff88',
                        fontSize: '11px'
                      }}
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Total Candles Footer */}
            <div style={{
              textAlign: 'center',
              padding: '10px',
              borderTop: '1px solid #333'
            }}>
              <div style={{
                color: '#666',
                fontSize: '12px'
              }}>
                Total Candles ({summaryPeriod})
              </div>
              <div style={{
                color: '#00ff00',
                fontSize: '24px',
                fontWeight: 'bold'
              }}>
                {summaryData.totalCandles || '42'}
              </div>
            </div>
          </div>
        ) : (loading && activeTab === 'all') || (loadingMyCandles && activeTab === 'my') ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            color: '#666',
            fontSize: '14px'
          }}>
            Loading candles...
          </div>
        ) : activeTab === 'my' && !isSignedIn ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '20px'
          }}>
            <div style={{ color: '#666', fontSize: '14px' }}>
              Please sign in to view your candles
            </div>
            <button
              onClick={() => setShowSignInModal(true)}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #00ff88 0%, #00dd66 100%)',
                border: '2px solid #00ff88',
                borderRadius: '8px',
                color: '#000',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 15px rgba(0, 255, 136, 0.4)'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'scale(1.05)';
                e.target.style.boxShadow = '0 6px 20px rgba(0, 255, 136, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = '0 4px 15px rgba(0, 255, 136, 0.4)';
              }}
            >
              Sign In
            </button>
          </div>
        ) : activeTab === 'my' && myCandles.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
            gap: '20px',
            position: 'relative'
          }}>
            <div style={{ 
              color: '#666', 
              fontSize: '14px',
              textAlign: 'center',
              width: '100%',
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)'
            }}>
              You haven't created any candles yet
            </div>
          </div>
        ) : activeTab !== 'summary' && currentCandle?.isPolaroid && currentCandle?.image ? (
          // Display polaroid snapshot for both tattoo and candle devotions from polaroids collection
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: '500px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <img 
              src={currentCandle.image}
              alt="Tattoo Devotion"
              style={{
                width: '100%',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 0 30px rgba(255, 215, 0, 0.3)'
              }}
            />
          </div>
        ) : activeTab !== 'summary' ? (
          <Canvas
            camera={{ 
              position: isFlipped ? [0, 0, -6] : (isMobile ? [0, 0.3, 7] : [0, 0, 7]), 
              fov: isMobile ? 45 : 45 
            }}
            style={{ width: '100%', height: '100%', display: 'block' }}
            shadows
            gl={{
              antialias: true,
              alpha: false,
              preserveDrawingBuffer: true,
              powerPreference: "high-performance"
            }}
            onCreated={({ gl, scene }) => {
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.2;
              scene.background = new THREE.Color(isFlipped ? 0x000000 : 0x0f0f0f);
              gl.shadowMap.enabled = true;
              gl.shadowMap.type = THREE.PCFSoftShadowMap;
            }}
          >
            <Suspense fallback={
              isRevealing ? null : (
                <mesh>
                  <boxGeometry args={[1, 1, 1]} />
                  <meshBasicMaterial color="gray" />
                </mesh>
              )
            }>
              <ModelViewer 
                key={currentModelPath}
                modelPath={currentModelPath}
                candleData={currentCandle}
                showPlaque={showPlaque}
                isFlipped={isFlipped}
                isRevealing={isRevealing}
              />
            </Suspense>
          </Canvas>
        ) : null}
        
        {/* Info Overlay - positioned on top of the canvas */}
  
        
        {/* Reveal Effect Curtains */}
        {!loading && !loadingMyCandles && (
          <>
            {/* <div style={{
              position: 'absolute',
              top: 0,
              left: '-1px',
              width: '50%',
              height: '100%',
              background: 'linear-gradient(135deg, #dc143c 0%, #ff1744 100%)',
              transformOrigin: 'left center',
              transform: isRevealing ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: 20,
              boxShadow: isRevealing ? '10px 0 30px rgba(220, 20, 60, 0.5)' : 'none'
            }} />
            <div style={{
              position: 'absolute',
              top: 0,
              right: '-1px',
              width: '50%',
              height: '100%',
              background: 'linear-gradient(135deg, #ff1744 0%, #dc143c 100%)',
              transformOrigin: 'right center',
              transform: isRevealing ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: 20,
              boxShadow: isRevealing ? '-10px 0 30px rgba(220, 20, 60, 0.5)' : 'none'
            }} /> */}
            
            {/* Particle Container */}
            
            {/* Diagonal Corner Flip Tab - Hide on Summary tab */}
            {/* {activeTab !== 'summary' && (
              <button
                onClick={() => setIsFlipped(!isFlipped)}
                onMouseEnter={(e) => {
                const ribbon = e.currentTarget.querySelector('div');
                if (ribbon && !isMobile) {
                  ribbon.style.transform = 'rotate(45deg) scale(1.1)';
                  ribbon.style.background = isFlipped ? 'linear-gradient(135deg, #ff6666 0%, #ff0000 100%)' : 'linear-gradient(135deg, #ff4444 0%, #ff6666 100%)';
                }
              }}
              onMouseLeave={(e) => {
                const ribbon = e.currentTarget.querySelector('div');
                if (ribbon && !isMobile) {
                  ribbon.style.transform = 'rotate(45deg) scale(1)';
                  ribbon.style.background = isFlipped ? 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)' : 'linear-gradient(135deg, #ff0000 0%, #ff4444 100%)';
                }
              }}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '80px',
                height: '80px',
                padding: 0,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                overflow: 'hidden',
                zIndex: 20
              }}
            >
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '-24px',
                width: '100px',
                height: '30px',
                background: isFlipped ? 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)' : 'linear-gradient(135deg, #ff0000 0%, #ff4444 100%)',
                transform: 'rotate(45deg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.3s ease'
              }}>
                <span style={{
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  {isFlipped ? 'Back' : 'Flip'}
                </span>
              </div>
            </button>
            )} */}
            
            {/* Pause/Play Button */}
            {((activeTab === 'all' && filteredCandles.length > 1) || (activeTab === 'my' && myCandles.length > 1)) && (
              <button
                onClick={() => setIsPaused(!isPaused)}
                style={{
                  position: 'absolute',
                  bottom: isMobile && activeTab === 'my' ? 'calc(100px + env(safe-area-inset-bottom))' : isMobile ? 'calc(60px + env(safe-area-inset-bottom))' : '60px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '10px',
                  background: 'rgba(0, 0, 0, 0.7)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '50%',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '18px',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  zIndex: 15,
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(0, 0, 0, 0.7)';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
                title={isPaused ? 'Resume auto-play' : 'Pause auto-play'}
              >
                {isPaused ? '▶' : '⏸'}
              </button>
            )}
            
          </>
        )}
        
        {/* Progress indicator */}
        {((activeTab === 'all' && filteredCandles.length > 0) || (activeTab === 'my' && myCandles.length > 1)) && (
          <div style={{
            position: 'absolute',
            bottom: isMobile ? 'calc(20px + env(safe-area-inset-bottom))' : '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '6px',
            padding: '8px',
            background: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '20px',
            backdropFilter: 'blur(10px)'
          }}>
            {(activeTab === 'all' ? filteredCandles : myCandles).map((_, index) => (
              <div
                key={index}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: index === (activeTab === 'all' ? currentAllCandleIndex : currentMyCandleIndex) ? '#00ff88' : 'rgba(255, 255, 255, 0.3)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onClick={() => activeTab === 'all' ? setCurrentAllCandleIndex(index) : setCurrentMyCandleIndex(index)}
              />
            ))}
          </div>
        )}
        
        {/* Create Candle Button - Only show on "My Candle" tab */}
        {activeTab === 'my' && onOpenCompactModal && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isSignedIn) {
                setShowSignInModal(true);
              } else {
                onOpenCompactModal();
              }
            }}
            style={{
              position: 'absolute',
              bottom: isMobile ? 'calc(20px + env(safe-area-inset-bottom))' : '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #00ff88 0%, #00dd66 100%)',
              border: '2px solid #00ff88',
              borderRadius: '8px',
              color: '#000',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 15px rgba(0, 255, 136, 0.4)',
              whiteSpace: 'nowrap',
              zIndex: 10
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateX(-50%) scale(1.05)';
              e.target.style.boxShadow = '0 6px 20px rgba(0, 255, 136, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateX(-50%) scale(1)';
              e.target.style.boxShadow = '0 4px 15px rgba(0, 255, 136, 0.4)';
            }}
          >
            Show Youri Devotion
          </button>
        )}
      </div>
      
      {/* Clerk Sign-In Modal */}
      {showSignInModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100000,
          backdropFilter: 'blur(10px)'
        }}
        onClick={() => setShowSignInModal(false)}
        >
          <div 
            style={{
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <SignIn 
              routing="hash"
              signUpUrl="#"
              forceRedirectUrl={window.location.pathname}
              appearance={{
                elements: {
                  rootBox: {
                    borderRadius: '12px',
                    overflow: 'hidden'
                  }
                }
              }}
            />
            <button
              onClick={() => setShowSignInModal(false)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#fff',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Inject animation styles
if (typeof document !== 'undefined' && !document.getElementById('animation-styles')) {
  const styleElement = document.createElement('style');
  styleElement.id = 'animation-styles';
  styleElement.textContent = `
    @keyframes particleExplosion {
      0% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
      }
      100% {
        transform: translate(
          calc(-50% + var(--x-offset)),
          calc(-50% + var(--y-offset))
        ) scale(0);
        opacity: 0;
      }
    }
    @keyframes pulse {
      0% {
        box-shadow: 0 4px 20px rgba(255, 215, 0, 0.6);
      }
      50% {
        box-shadow: 0 4px 30px rgba(255, 215, 0, 0.9), 0 0 50px rgba(255, 215, 0, 0.4);
      }
      100% {
        box-shadow: 0 4px 20px rgba(255, 215, 0, 0.6);
      }
    }
  `;
  document.head.appendChild(styleElement);
}

// Preload the models
useGLTF.preload('/models/tinyVotiveBox.glb');
useGLTF.preload('/models/tinyJapCanBox.glb');
useGLTF.preload('/models/blockhead1.glb');
useGLTF.preload('/models/blockhead2.glb');
useGLTF.preload('/models/blockhead_runner.glb');
