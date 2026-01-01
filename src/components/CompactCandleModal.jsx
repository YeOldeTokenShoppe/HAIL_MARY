import React, { useState, Suspense, useRef, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, useTexture, Html } from '@react-three/drei';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry';
import { clone as SkeletonUtilsClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
useGLTF.preload('/models/tinyVotiveOnly.glb');
useGLTF.preload('/models/tinyJapCanOnly.glb');
useGLTF.preload('/models/blockhead_Streetman.glb');
useGLTF.preload('/models/blockhead_StreetMan_Tpose.glb');
useGLTF.preload('/models/blockhead_Surfer.glb');
useGLTF.preload('/models/blockhead_Surfer_Tpose.glb');
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
import PoseSelector from './PoseSelector';

// Interactive tattoo placement viewer for Step 3
// REPLACE the InteractiveTattooViewer function in CompactCandleModal.jsx with this

// ALTERNATIVE: Uses a simple plane mesh instead of DecalGeometry
// Replace the InteractiveTattooViewer function in CompactCandleModal.jsx with this

// FIXED InteractiveTattooViewer - Stores bone name at placement time
// This ensures we attach to the correct bone regardless of pose




function InteractiveTattooViewer({ 
  modelPath, 
  tattooDesign, 
  onPlacementChange, 
  placementData, 
  isPlacementMode = false,
  characterSkinColor = 'Brown',
  tattooCharacter = ''
}) {
  const { scene } = useGLTF(modelPath);
  
  const groupRef = useRef();
  const tattooMeshRef = useRef();
  const textureRef = useRef();
  const skeletonRef = useRef();
  const skinTextureRef = useRef();
  
  const [hoveredPart, setHoveredPart] = useState(null);
  const [showRejectMessage, setShowRejectMessage] = useState(false);
  const [localPlacement, setLocalPlacement] = useState(placementData);
  
  // Clone scene
  const clonedScene = useMemo(() => {
    const clone = SkeletonUtilsClone(scene);
    clone.scale.set(1.5, 1.5, 1.5);
    clone.position.set(0, -2, 0);
    
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
      }
      if (child.isSkinnedMesh && child.skeleton) {
        skeletonRef.current = child.skeleton;
      }
    });
    
    return clone;
  }, [scene]);
  
  // Load texture
  useEffect(() => {
    if (!tattooDesign) return;
    const loader = new THREE.TextureLoader();
    loader.load(`/images/${tattooDesign}.png`, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      textureRef.current = texture;
    });
  }, [tattooDesign]);
  
  // Load skin texture for Streetman, Surfer, and Runner
  useEffect(() => {
    if ((tattooCharacter === 'blockhead_Streetman' || tattooCharacter === 'blockhead_Surfer' || tattooCharacter === 'blockhead_runner') && characterSkinColor && clonedScene) {
      console.log('[InteractiveTattoo] Loading skin texture:', tattooCharacter, characterSkinColor);
      const loader = new THREE.TextureLoader();
      const texturePath = tattooCharacter === 'blockhead_Streetman' 
        ? `/textures/Streetman_${characterSkinColor}.webp`
        : tattooCharacter === 'blockhead_Surfer'
        ? `/textures/SurferGuy_${characterSkinColor}.webp`
        : `/textures/Runner_${characterSkinColor}.webp`;
      
      console.log('[InteractiveTattoo] Texture path:', texturePath);
      
      loader.load(texturePath, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false; // GLTF models usually need flipY = false
        skinTextureRef.current = texture;
        console.log('[InteractiveTattoo] Texture loaded successfully');
        
        // Apply texture to all skinned meshes
        let applied = false;
        clonedScene.traverse((child) => {
          if (child.isSkinnedMesh && child.material) {
            child.material.map = texture;
            child.material.needsUpdate = true;
            applied = true;
            console.log('[InteractiveTattoo] Applied texture to mesh:', child.name);
          }
        });
        
        if (!applied) {
          console.log('[InteractiveTattoo] Warning: No skinned meshes found to apply texture');
        }
      }, undefined, (error) => {
        console.error('[InteractiveTattoo] Failed to load texture:', error);
      });
    }
  }, [tattooCharacter, characterSkinColor, clonedScene]);
  
  useEffect(() => {
    if (placementData && !localPlacement) {
      setLocalPlacement(placementData);
    }
  }, [placementData, localPlacement]);
  
  // Find closest bone
  const findClosestBone = useCallback((worldPosition) => {
    const skeleton = skeletonRef.current;
    if (!skeleton?.bones?.length) return null;
    
    clonedScene.updateMatrixWorld(true);
    
    const targetPos = new THREE.Vector3(worldPosition.x, worldPosition.y, worldPosition.z);
    let closestBone = null;
    let closestDistance = Infinity;
    
    skeleton.bones.forEach((bone) => {
      const boneWorldPos = new THREE.Vector3();
      bone.getWorldPosition(boneWorldPos);
      const distance = targetPos.distanceTo(boneWorldPos);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestBone = bone;
      }
    });
    
    return closestBone;
  }, [clonedScene]);
  
  // Skin detection
  const isClickOnSkin = useCallback((intersection) => {
    if (!intersection.uv) return true;
    const material = intersection.object?.material;
    if (!material?.map?.image) return true;
    
    try {
      const texture = material.map;
      const uv = intersection.uv;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = texture.image.width;
      canvas.height = texture.image.height;
      ctx.drawImage(texture.image, 0, 0);
      
      const x = Math.floor(uv.x * canvas.width);
      const y = Math.floor((1 - uv.y) * canvas.height);
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      const [r, g, b] = pixel;
      
      return (r > b && r > g * 0.9 && r > 50) || 
             (Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && r > 180);
    } catch (e) {
      return true;
    }
  }, []);
  
  // Handle click - SIMPLIFIED data storage
  const handleClick = useCallback((event) => {
    if (!isPlacementMode || !tattooDesign) return;
    event.stopPropagation();
    
    if (!event.point || !event.face) return;
    
    const clickedMesh = event.object;
    const worldPoint = event.point.clone();
    const faceNormal = event.face.normal.clone();
    
    if (!isClickOnSkin({ point: worldPoint, face: event.face, object: clickedMesh, uv: event.uv })) {
      setShowRejectMessage(true);
      setTimeout(() => setShowRejectMessage(false), 2000);
      return;
    }
    
    // Transform face normal to world space
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(clickedMesh.matrixWorld);
    const worldNormal = faceNormal.applyMatrix3(normalMatrix).normalize();
    
    // Find closest bone
    const closestBone = findClosestBone(worldPoint);
    
    let boneOffsetData = null;
    
    if (closestBone) {
      closestBone.updateMatrixWorld(true);
      
      // Get bone's world position and quaternion
      const boneWorldPos = new THREE.Vector3();
      const boneWorldQuat = new THREE.Quaternion();
      closestBone.getWorldPosition(boneWorldPos);
      closestBone.getWorldQuaternion(boneWorldQuat);
      
      // Calculate world-space offset from bone to tattoo
      const offsetWorld = new THREE.Vector3().subVectors(worldPoint, boneWorldPos);
      
      // Transform offset to bone's local space using inverse quaternion
      const invQuat = boneWorldQuat.clone().invert();
      const offsetLocal = offsetWorld.clone().applyQuaternion(invQuat);
      
      // Transform normal to bone's local space
      const normalLocal = worldNormal.clone().applyQuaternion(invQuat);
      
      boneOffsetData = {
        boneName: closestBone.name,
        // Store both for debugging
        offsetLocal: { x: offsetLocal.x, y: offsetLocal.y, z: offsetLocal.z },
        normalLocal: { x: normalLocal.x, y: normalLocal.y, z: normalLocal.z },
        // Also store original world offset for verification
        offsetWorld: { x: offsetWorld.x, y: offsetWorld.y, z: offsetWorld.z },
      };
      
      console.log('[InteractiveTattoo] Bone:', closestBone.name);
      console.log('[InteractiveTattoo] Bone world pos:', boneWorldPos.toArray().map(v => v.toFixed(3)));
      console.log('[InteractiveTattoo] Click world pos:', worldPoint.toArray().map(v => v.toFixed(3)));
      console.log('[InteractiveTattoo] Offset world:', offsetWorld.toArray().map(v => v.toFixed(3)));
      console.log('[InteractiveTattoo] Offset local:', offsetLocal.toArray().map(v => v.toFixed(3)));
    }
    
    const placementInfo = {
      worldPosition: { x: worldPoint.x, y: worldPoint.y, z: worldPoint.z },
      worldNormal: { x: worldNormal.x, y: worldNormal.y, z: worldNormal.z },
      meshName: clickedMesh.name || 'mesh',
      ...boneOffsetData,
    };
    
    console.log('[InteractiveTattoo] ✓ Placement saved');
    
    setLocalPlacement(placementInfo);
    onPlacementChange?.(placementInfo);
  }, [isPlacementMode, tattooDesign, isClickOnSkin, onPlacementChange, findClosestBone]);
  
  const handlePointerMove = useCallback((event) => {
    if (!isPlacementMode) return;
    if (event.object) {
      setHoveredPart(isClickOnSkin({
        point: event.point,
        face: event.face,
        object: event.object,
        uv: event.uv
      }) ? 'skin' : 'clothing');
    }
  }, [isPlacementMode, isClickOnSkin]);
  
  // Apply tattoo (T-pose)
  useEffect(() => {
    if (!localPlacement || !textureRef.current || !groupRef.current) return;
    
    if (tattooMeshRef.current) {
      tattooMeshRef.current.parent?.remove(tattooMeshRef.current);
      tattooMeshRef.current.geometry?.dispose();
      tattooMeshRef.current.material?.dispose();
      tattooMeshRef.current = null;
    }
    
    const planeGeom = new THREE.PlaneGeometry(0.3, 0.3);
    const planeMat = new THREE.MeshBasicMaterial({
      map: textureRef.current,
      transparent: true,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
    });
    
    const tattooPlane = new THREE.Mesh(planeGeom, planeMat);
    
    const worldPos = localPlacement.worldPosition;
    const worldNormal = new THREE.Vector3(
      localPlacement.worldNormal.x,
      localPlacement.worldNormal.y,
      localPlacement.worldNormal.z
    );
    
    tattooPlane.position.set(worldPos.x, worldPos.y, worldPos.z);
    tattooPlane.position.add(worldNormal.clone().multiplyScalar(0.02));
    
    const defaultNormal = new THREE.Vector3(0, 0, 1);
    const quat = new THREE.Quaternion();
    quat.setFromUnitVectors(defaultNormal, worldNormal);
    tattooPlane.quaternion.copy(quat);
    
    groupRef.current.add(tattooPlane);
    tattooMeshRef.current = tattooPlane;
  }, [localPlacement]);
  
  useFrame(() => {
    if (groupRef.current && !isPlacementMode && !localPlacement && !placementData) {
      groupRef.current.rotation.y += 0.005;
    }
  });
  
  return (
    <group 
      ref={groupRef}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      onPointerOut={() => setHoveredPart(null)}
    >
      <primitive object={clonedScene} />
      
      {isPlacementMode && hoveredPart && (
        <Html position={[0, 2.5, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            color: hoveredPart === 'clothing' ? '#ff3333' : '#00ff00',
            fontSize: '12px',
            fontWeight: 'bold',
            background: 'rgba(0, 0, 0, 0.8)',
            padding: '4px 8px',
            borderRadius: '4px'
          }}>
            {hoveredPart === 'clothing' ? '❌ Cannot place on clothing' : '✓ Click to place tattoo'}
          </div>
        </Html>
      )}
      
      {showRejectMessage && (
        <Html position={[0, 0, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            color: '#ff3333',
            fontSize: '14px',
            fontWeight: 'bold',
            background: 'rgba(0, 0, 0, 0.9)',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '2px solid #ff3333'
          }}>
            ⚠️ Tattoos can only be placed on skin
          </div>
        </Html>
      )}
      
      {localPlacement && (
        <Html position={[0, -2.5, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{ color: '#00ff00', fontSize: '10px', fontWeight: 'bold' }}>
            ✓ Tattoo placed{localPlacement.boneName ? ` (${localPlacement.boneName})` : ''}
          </div>
        </Html>
      )}
    </group>
  );
}




// Interactive tattoo placement viewer for Step 3


// Simple viewer component for displaying tattoo character models (used in other steps)
// This properly applies poses and attaches tattoos to bones so they move with the skeleton

// FIXED SimpleTattooViewer - Uses stored bone name from placement time
// No more coordinate space mismatch!





// FIXED SimpleTattooViewer - Proper pose change handling
// Key fix: Remove tattoo before pose change, reattach after animation applies




const AVAILABLE_POSES = [
  { id: 'tpose', name: 'T-Pose', animationName: null },
  { id: 'run', name: 'Running', animationName: 'run' },  // For blockhead_runner
  { id: 'stand1', name: 'Stand Pose 1', animationName: 'StandPose1' },
  { id: 'stand2', name: 'Stand Pose 2', animationName: 'StandPose2' },
  { id: 'dance', name: 'Dance', animationName: 'Dance_Pose' },
  { id: 'action', name: 'Action', animationName: 'Action' },  // Streetman-specific animation
  { id: 'curl', name: 'Curl', animationName: 'Curl' },  // Streetman-specific animation
  { id: 'pray', name: 'Pray', animationName: 'Pray' },  // Streetman-specific animation
  { id: 'skateboard', name: 'Skateboard', animationName: 'Skateboard' },  // Streetman-specific animation
  { id: 'dance1', name: 'Dance 1', animationName: 'Dance1' },  // Streetman-specific animation
  { id: 'dance2', name: 'Dance 2', animationName: 'Dance2' },  // Streetman-specific animation
  { id: 'standpose1', name: 'Stand Pose', animationName: 'StandPose1' },  // Streetman-specific animation
  { id: 'surf', name: 'Surf', animationName: 'Surf' },  // Surfer-specific animation
];

function SimpleTattooViewer({ 
  modelPath, 
  dedicationName, 
  dedicationMessage, 
  tattooDesign, 
  placementData, 
  showBackground = false, 
  backgroundTexture = null, 
  backgroundGradient = null,
  selectedPose = 'tpose',
  characterSkinColor = 'Brown',
  tattooCharacter = '',
}) {
  const { scene, animations } = useGLTF(modelPath);
  const groupRef = useRef();
  const tattooMeshRef = useRef();
  const textureRef = useRef();
  const backgroundRef = useRef();
  const mixerRef = useRef();
  const bonesMapRef = useRef({});
  const skinnedMeshRef = useRef();
  const [targetRotation, setTargetRotation] = useState(0);
  const [tattooVersion, setTattooVersion] = useState(0);
  const [poseReady, setPoseReady] = useState(false);
  
  // Load texture
  useEffect(() => {
    if (!tattooDesign) return;
    const loader = new THREE.TextureLoader();
    loader.load(`/images/${tattooDesign}.png`, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      textureRef.current = texture;
      setTattooVersion(v => v + 1);
    });
  }, [tattooDesign]);
  
  // Clone model
  const clonedModel = useMemo(() => {
    const clone = SkeletonUtilsClone(scene);
    clone.scale.set(1.5, 1.5, 1.5);
    clone.position.set(0, -2, 0);
    
    const bonesMap = {};
    clone.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) child.material = child.material.clone();
        
        // Hide skateboard mesh by default
        if (child.name && child.name.toLowerCase().includes('skateboard')) {
          child.visible = false;
        }
        
        // Handle platform visibility - default state before pose is applied
        const nameLower = child.name ? child.name.toLowerCase() : '';
        if (nameLower.includes('skateplatform') || 
            (nameLower.includes('skate') && nameLower.includes('platform'))) {
          child.visible = false; // Will be updated when pose changes
          console.log('[SimpleTattoo] Found SkatePlatform:', child.name, 'setting visible=false');
        } else if (nameLower === 'platform2' || nameLower.includes('platform2')) {
          child.visible = true; // Will be updated when pose changes
          console.log('[SimpleTattoo] Found Platform2:', child.name, 'setting visible=true');
        }
        
        // Hide Dumbell1 by default (only visible during curl)
        if (nameLower === 'dumbell1' || nameLower.includes('dumbell1')) {
          child.visible = false;
          console.log('[SimpleTattoo] Found Dumbell1:', child.name, 'setting visible=false');
        }
        
        // Hide Dumbell2 by default (only visible during curl)
        if (nameLower === 'dumbell2' || nameLower.includes('dumbell2')) {
          child.visible = false;
          console.log('[SimpleTattoo] Found Dumbell2:', child.name, 'setting visible=false');
        }
        
        // Hide surfboard by default (only visible during surf)
        if (nameLower === 'surfboard' || nameLower.includes('surfboard')) {
          child.visible = false;
          console.log('[SimpleTattoo] Found Surfboard:', child.name, 'setting visible=false');
        }
      }
      if (child.isSkinnedMesh && child.skeleton) {
        child.skeleton.bones.forEach(bone => { bonesMap[bone.name] = bone; });
        // Store reference to the main skinned mesh
        if (!skinnedMeshRef.current) {
          skinnedMeshRef.current = child;
        }
      }
    });
    bonesMapRef.current = bonesMap;
    return clone;
  }, [scene]);
  
  // Load skin texture for Streetman, Surfer, and Runner
  useEffect(() => {
    if ((tattooCharacter === 'blockhead_Streetman' || tattooCharacter === 'blockhead_Surfer' || tattooCharacter === 'blockhead_runner') && characterSkinColor && clonedModel) {
      console.log('[SimpleTattoo] Loading skin texture:', tattooCharacter, characterSkinColor);
      const loader = new THREE.TextureLoader();
      const texturePath = tattooCharacter === 'blockhead_Streetman' 
        ? `/textures/Streetman_${characterSkinColor}.webp`
        : tattooCharacter === 'blockhead_Surfer'
        ? `/textures/SurferGuy_${characterSkinColor}.webp`
        : `/textures/Runner_${characterSkinColor}.webp`;
      
      console.log('[SimpleTattoo] Texture path:', texturePath);
      
      loader.load(texturePath, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false; // GLTF models usually need flipY = false
        console.log('[SimpleTattoo] Texture loaded successfully');
        
        // Apply texture to all skinned meshes
        let applied = false;
        clonedModel.traverse((child) => {
          if (child.isSkinnedMesh && child.material) {
            child.material.map = texture;
            child.material.needsUpdate = true;
            applied = true;
            console.log('[SimpleTattoo] Applied texture to mesh:', child.name);
          }
        });
        
        if (!applied) {
          console.log('[SimpleTattoo] Warning: No skinned meshes found to apply texture');
        }
      }, undefined, (error) => {
        console.error('[SimpleTattoo] Failed to load texture:', error);
      });
    }
  }, [tattooCharacter, characterSkinColor, clonedModel]);
  
  const removeTattoo = useCallback(() => {
    if (tattooMeshRef.current) {
      tattooMeshRef.current.parent?.remove(tattooMeshRef.current);
      tattooMeshRef.current.geometry?.dispose();
      tattooMeshRef.current.material?.dispose();
      tattooMeshRef.current = null;
    }
  }, []);
  
  // Apply pose
  useEffect(() => {
    console.log('[SimpleTattoo] Pose change:', selectedPose);
    
    removeTattoo();
    setPoseReady(false);
    
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
      mixerRef.current = null;
    }
    
    // Handle skateboard visibility
    if (clonedModel) {
      clonedModel.traverse((child) => {
        if (child.isMesh && child.name && child.name.toLowerCase().includes('skateboard')) {
          child.visible = selectedPose === 'skateboard';
        }
      });
    }
    
    const poseConfig = AVAILABLE_POSES.find(p => p.id === selectedPose);
    
    if (!poseConfig?.animationName || !animations?.length) {
      // Reset model rotation for T-Pose
      if (clonedModel) {
        clonedModel.rotation.set(0, 0, 0);
      }
      setPoseReady(true);
      setTattooVersion(v => v + 1);
      return;
    }
    
    // Debug: Log all available animations
    console.log('[SimpleTattoo] Available animations:', animations.map(a => a.name));
    console.log('[SimpleTattoo] Looking for:', poseConfig.animationName);
    console.log('[SimpleTattoo] Selected pose:', selectedPose);
    
    // Special check for Surfer animations
    if (tattooCharacter === 'blockhead_Surfer') {
      console.log('[SimpleTattoo] Surfer character detected, checking for surf animation');
      animations.forEach(a => {
        if (a.name.toLowerCase().includes('surf')) {
          console.log('[SimpleTattoo] Found surf-like animation:', a.name);
        }
      });
    }
    
    const clip = animations.find(a => {
      const search = poseConfig.animationName.toLowerCase();
      const name = a.name.toLowerCase();
      console.log(`[SimpleTattoo] Comparing: "${name}" with "${search}"`);
      
      // Special cases for Streetman animations
      if (search === 'action' && (name === 'action' || name.includes('action'))) {
        console.log('[SimpleTattoo] Action animation found!');
        return true;
      }
      if (search === 'curl' && (name === 'curl' || name.includes('curl'))) {
        console.log('[SimpleTattoo] Curl animation found!');
        return true;
      }
      if (search === 'pray' && (name === 'pray' || name.includes('pray'))) {
        console.log('[SimpleTattoo] Pray animation found!');
        return true;
      }
      if (search === 'skateboard' && (name === 'skateboard' || name.includes('skate'))) {
        console.log('[SimpleTattoo] Skateboard animation found!');
        return true;
      }
      if (search === 'dance1' && (name === 'dance1' || name.includes('dance1'))) {
        console.log('[SimpleTattoo] Dance1 animation found!');
        return true;
      }
      if (search === 'dance2' && (name === 'dance2' || name.includes('dance2'))) {
        console.log('[SimpleTattoo] Dance2 animation found!');
        return true;
      }
      if (search === 'standpose1' && (name === 'standpose1' || name.includes('standpose1'))) {
        console.log('[SimpleTattoo] StandPose1 animation found!');
        return true;
      }
      if (search === 'surf') {
        // Try various possible names for surf animation
        if (name === 'surf' || 
            name === 'Surf' || 
            name === 'Character_Rig|Surf' ||
            name.toLowerCase() === 'surf' || 
            name.toLowerCase().includes('surf')) {
          console.log('[SimpleTattoo] Surf animation found with name:', name);
          return true;
        }
      }
      
      // More specific matching that preserves numbers
      // First try exact match
      if (name === search) {
        console.log('[SimpleTattoo] Exact match found!');
        return true;
      }
      
      // Then try with underscores removed but keeping numbers
      const searchNoUnderscore = search.replace(/_/g, '');
      const nameNoUnderscore = name.replace(/_/g, '');
      if (nameNoUnderscore === searchNoUnderscore) {
        console.log('[SimpleTattoo] Match found without underscores!');
        return true;
      }
      
      // Try partial match but must include the number
      if (search.includes('1') && name.includes('stand') && name.includes('1')) {
        console.log('[SimpleTattoo] StandPose1 match!');
        return true;
      }
      if (search.includes('2') && name.includes('stand') && name.includes('2')) {
        console.log('[SimpleTattoo] StandPose2 match!');
        return true;
      }
      
      // For other animations without numbers
      if (!search.match(/\d/) && name.includes(search.replace('_pose', '').replace('pose', ''))) {
        console.log('[SimpleTattoo] Non-numbered animation match!');
        return true;
      }
      
      return false;
    });
    
    if (!clip) {
      console.warn('[SimpleTattoo] No matching animation found for:', poseConfig.animationName);
      // If we're looking for 'action' and it's not found, try to use the first available animation
      if (selectedPose === 'action' && animations.length > 0) {
        console.log('[SimpleTattoo] Using first available animation as fallback');
        const firstClip = animations[0];
        mixerRef.current = new THREE.AnimationMixer(clonedModel);
        const action = mixerRef.current.clipAction(firstClip);
        action.reset();
        action.setEffectiveWeight(1);
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.play();
        mixerRef.current.update(0.5);  // Apply stronger update here too
        clonedModel.updateMatrixWorld(true);
      }
      setPoseReady(true);
      setTattooVersion(v => v + 1);
      return;
    }
    
    console.log('[SimpleTattoo] Playing:', clip.name);
    
    mixerRef.current = new THREE.AnimationMixer(clonedModel);
    const action = mixerRef.current.clipAction(clip);
    action.reset();
    action.setEffectiveWeight(1);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();
    
    // Apply a stronger initial update to ensure the pose takes effect
    mixerRef.current.update(0.5);  // Update with a time delta to move into the animation
    clonedModel.updateMatrixWorld(true);
    
    // Rebuild bones map
    const newMap = {};
    clonedModel.traverse(child => {
      if (child.isSkinnedMesh && child.skeleton) {
        child.skeleton.bones.forEach(bone => { newMap[bone.name] = bone; });
      }
    });
    bonesMapRef.current = newMap;
    
    setTimeout(() => {
      setPoseReady(true);
      setTattooVersion(v => v + 1);
    }, 100);
    
    return () => { if (mixerRef.current) mixerRef.current.stopAllAction(); };
  }, [selectedPose, animations, clonedModel, removeTattoo]);
  
  // Create tattoo mesh (but DON'T position it yet - that happens in useFrame)
  useEffect(() => {
    if (!poseReady || !placementData || !textureRef.current || !groupRef.current) {
      return;
    }
    
    removeTattoo();
    
    const { worldPosition, worldNormal } = placementData;
    if (!worldPosition) return;
    
    // Create tattoo
    const planeGeom = new THREE.PlaneGeometry(0.3, 0.3);
const planeMat = new THREE.MeshBasicMaterial({
  map: textureRef.current,
  transparent: true,
  side: THREE.DoubleSide,
  depthTest: true,
  depthWrite: false,
  alphaTest: 0.1,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
});
    const tattooPlane = new THREE.Mesh(planeGeom, planeMat);
    tattooPlane.renderOrder = 999;
    
    // Add to group (NOT to bone!)
    groupRef.current.add(tattooPlane);
    tattooMeshRef.current = tattooPlane;
    
    console.log('[SimpleTattoo] Tattoo mesh created');
    
  }, [poseReady, tattooVersion, placementData, removeTattoo]);
  
  // Auto rotation
  useEffect(() => {
    if (placementData?.meshName) {
      const name = placementData.meshName.toLowerCase();
      if (name.includes('left')) setTargetRotation(-Math.PI / 4);
      else if (name.includes('right')) setTargetRotation(Math.PI / 4);
      else if (name.includes('back')) setTargetRotation(Math.PI);
      else setTargetRotation(0);
    }
  }, [placementData]);
  
  // Frame update - UPDATE TATTOO POSITION HERE
  useFrame((state, delta) => {
    // Model rotation
    if (groupRef.current) {
      if (showBackground && placementData) {
        groupRef.current.rotation.y += (targetRotation - groupRef.current.rotation.y) * 0.1;
      } else if (!placementData) {
        groupRef.current.rotation.y += 0.005;
      }
    }
    
    // Animation mixer
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
    
    // Update skateboard, platform, and dumbell visibility based on current pose
    if (clonedModel) {
      clonedModel.traverse((child) => {
        if (child.isMesh && child.name) {
          const nameLower = child.name.toLowerCase();
          
          // Skateboard visibility
          if (nameLower.includes('skateboard') && !nameLower.includes('platform')) {
            child.visible = selectedPose === 'skateboard';
          }
          // SkatePlatform visible only during skateboard animation
          else if (nameLower.includes('skateplatform') || 
                   (nameLower.includes('skate') && nameLower.includes('platform'))) {
            child.visible = selectedPose === 'skateboard';
          }
          // Platform2 visible for all other animations
          else if (nameLower === 'platform2' || nameLower.includes('platform2')) {
            child.visible = selectedPose !== 'skateboard';
          }
          // Dumbell1 visible only during curl animation
          else if (nameLower === 'dumbell1' || nameLower.includes('dumbell1')) {
            child.visible = selectedPose === 'curl';
          }
          // Dumbell2 visible only during curl animation
          else if (nameLower === 'dumbell2' || nameLower.includes('dumbell2')) {
            child.visible = selectedPose === 'curl';
          }
          // Surfboard visible only during surf animation
          else if (nameLower === 'surfboard' || nameLower.includes('surfboard')) {
            child.visible = selectedPose === 'surf';
          }
        }
      });
    }
    
    // UPDATE TATTOO POSITION based on bone
    if (tattooMeshRef.current && placementData) {
      const { worldPosition, worldNormal, boneName, offsetLocal, normalLocal } = placementData;
      
      const useAnimation = selectedPose !== 'tpose';
      const hasBoneData = boneName && offsetLocal && normalLocal;
      
      if (useAnimation && hasBoneData) {
        // === ANIMATED POSE: Calculate position from bone ===
        const bone = bonesMapRef.current[boneName];
        
        if (bone) {
          bone.updateMatrixWorld(true);
          
          // Get bone's current world transform
          const boneWorldPos = new THREE.Vector3();
          const boneWorldQuat = new THREE.Quaternion();
          bone.getWorldPosition(boneWorldPos);
          bone.getWorldQuaternion(boneWorldQuat);
          
          // Transform local offset back to world space using bone's current quaternion
          const offsetLocalVec = new THREE.Vector3(offsetLocal.x, offsetLocal.y, offsetLocal.z);
          const offsetWorld = offsetLocalVec.clone().applyQuaternion(boneWorldQuat);
          
          // Calculate initial world position
          const tattooWorldPos = boneWorldPos.clone().add(offsetWorld);
          
          // Transform local normal to world space
          const normalLocalVec = new THREE.Vector3(normalLocal.x, normalLocal.y, normalLocal.z);
          const normalWorld = normalLocalVec.clone().applyQuaternion(boneWorldQuat).normalize();
          
          // Use raycasting to find the exact surface position
          if (skinnedMeshRef.current) {
            const raycaster = new THREE.Raycaster();
            raycaster.set(
              tattooWorldPos.clone().add(normalWorld.clone().multiplyScalar(0.1)), // start slightly outside
              normalWorld.clone().negate() // cast inward
            );
            
            const hits = raycaster.intersectObject(skinnedMeshRef.current);
            if (hits.length > 0) {
              // Use the exact hit point on the surface
              tattooMeshRef.current.position.copy(hits[0].point);
              
              // Use the actual surface normal
              const faceNormal = hits[0].face.normal.clone().transformDirection(skinnedMeshRef.current.matrixWorld);
              
              // Offset slightly along the face normal to prevent z-fighting
              tattooMeshRef.current.position.add(faceNormal.clone().multiplyScalar(0.002));
              
              // Orient to the actual surface normal
              const defaultNormal = new THREE.Vector3(0, 0, 1);
              const orientQuat = new THREE.Quaternion();
              orientQuat.setFromUnitVectors(defaultNormal, faceNormal);
              tattooMeshRef.current.quaternion.copy(orientQuat);
            } else {
              // Fallback to calculated position if raycast misses
              tattooWorldPos.add(normalWorld.clone().multiplyScalar(0.02));
              tattooMeshRef.current.position.copy(tattooWorldPos);
              
              const defaultNormal = new THREE.Vector3(0, 0, 1);
              const orientQuat = new THREE.Quaternion();
              orientQuat.setFromUnitVectors(defaultNormal, normalWorld);
              tattooMeshRef.current.quaternion.copy(orientQuat);
            }
          } else {
            // Fallback if no skinned mesh reference
            tattooWorldPos.add(normalWorld.clone().multiplyScalar(0.02));
            tattooMeshRef.current.position.copy(tattooWorldPos);
            
            const defaultNormal = new THREE.Vector3(0, 0, 1);
            const orientQuat = new THREE.Quaternion();
            orientQuat.setFromUnitVectors(defaultNormal, normalWorld);
            tattooMeshRef.current.quaternion.copy(orientQuat);
          }
        }
        
      } else {
        // === T-POSE: Use original world position ===
        const pos = new THREE.Vector3(worldPosition.x, worldPosition.y, worldPosition.z);
        const normal = new THREE.Vector3(worldNormal.x, worldNormal.y, worldNormal.z).normalize();
        
        tattooMeshRef.current.position.copy(pos);
        tattooMeshRef.current.position.add(normal.clone().multiplyScalar(0.02));
        
        const defaultNormal = new THREE.Vector3(0, 0, 1);
        const quat = new THREE.Quaternion();
        quat.setFromUnitVectors(defaultNormal, normal);
        tattooMeshRef.current.quaternion.copy(quat);
      }
    }
  });
  
  useEffect(() => () => { removeTattoo(); if (mixerRef.current) mixerRef.current.stopAllAction(); }, [removeTattoo]);
  
  return (
    <>
      {showBackground && (backgroundTexture || backgroundGradient) && (
        <mesh ref={backgroundRef} position={[0, 0, -5]}>
          <planeGeometry args={[20, 20]} />
          <meshBasicMaterial 
            map={backgroundTexture}
            color={backgroundGradient ? "#4a0080" : "#ffffff"}
          />
        </mesh>
      )}
      <group ref={groupRef}>
        <primitive object={clonedModel} />
        {dedicationName && (
          <Html position={[0, 3, 0]} center style={{ color: '#ffd700', fontSize: '12px', fontWeight: 'bold', textShadow: '0 0 10px rgba(255, 215, 0, 0.5)' }}>
            <div>{dedicationName}</div>
          </Html>
        )}
      </group>
    </>
  );
}








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
        clonedModel.position.set(0, -1.5, -1);  // Raised from -2.7 to -0.5
      } else if (modelPath.includes('tinyJapCanBox')) {
        clonedModel.scale.set(1, 1, 1);  // Same scale as votive box
        clonedModel.position.set(0, -1.5, -1);  // Raised from -2.7 to -0.5
      } else {
        clonedModel.scale.set(1.5, 1.5, 1.5);
        clonedModel.position.set(0, -1, 1);
      }
      
      // Track if we found and applied texture to Box mesh
      let boxMeshFound = false;
      

      
      // Enable shadows and ensure materials/textures are visible
      clonedModel.traverse((child) => {
        if (child.isMesh) {
          
          child.castShadow = true;
          child.receiveShadow = true;
          

          
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
            

            
            if (isBoxMesh && (modelPath.includes('tinyVotiveBox') || modelPath.includes('tinyJapCanBox'))) {
              boxMeshFound = true;
              // Store reference to the Box mesh
              boxMeshRef.current = child;
              
              // Store the original texture if it exists
              if (child.material && child.material.map) {
                originalBoxTextureRef.current = child.material.map;
                
                // If the current background selection is 'none', remove the default texture immediately
                if (!backgroundTexturePath) {
                  child.material.map = null;
                  child.material.needsUpdate = true;
                  // Set a neutral color for the box
                  if (child.material.color) {
                    child.material.color.set(0x333333); // Dark gray
                  }
                }
              } else {
                originalBoxTextureRef.current = null;
              }
              

            }
            
            // Update material
            child.material.needsUpdate = true;
          }
        }
      });
      

      
      // Clear previous model and add new one
      while (modelRef.current.children.length > 0) {
        modelRef.current.remove(modelRef.current.children[0]);
      }
      
      // Clear boxMeshRef if we're switching from a box model to a non-box model
      if (!boxMeshFound) {
        boxMeshRef.current = null;
      }
      
      // Add the model to the group
      groupRef.current = clonedModel;
      modelRef.current.add(clonedModel);
    }
  }, [scene, materials, modelPath, customImageUrl]);
  
  // Effect to update Box mesh texture when backgroundTexturePath changes
  React.useEffect(() => {
    let retryCount = 0;
    const maxRetries = 10;
    let retryTimeout = null;
    
    // Function to apply the texture
    const applyTexture = () => {
      // Only apply texture if this is a box model
      const isBoxModel = modelPath && (modelPath.includes('tinyVotiveBox') || modelPath.includes('tinyJapCanBox'));
      
      if (!isBoxModel) {
        // Not a box model, no need to apply texture to Box mesh
        return;
      }
      
      if (!boxMeshRef.current || !boxMeshRef.current.material) {
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`[SimpleCandleViewer] Box mesh not ready yet, retry ${retryCount}/${maxRetries}...`);
          // Try again in a moment if the mesh isn't ready
          retryTimeout = setTimeout(applyTexture, 100);
        } else {
          console.log('[SimpleCandleViewer] Max retries reached, Box mesh not found');
        }
        return;
      }

      if (backgroundTexturePath && backgroundTexturePath !== currentBackgroundPath.current) {
        // Load and apply new background texture
        console.log('[SimpleCandleViewer] Loading background texture:', backgroundTexturePath);
        console.log('[SimpleCandleViewer] Box mesh found:', !!boxMeshRef.current);
        console.log('[SimpleCandleViewer] Box material type:', boxMeshRef.current?.material?.type);
        
        textureLoader.load(backgroundTexturePath, (texture) => {
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.repeat.set(1, -1);  // Negative Y to flip vertically
          texture.offset.set(0, 1);   // Adjust offset when flipping
          
          if (boxMeshRef.current && boxMeshRef.current.material) {
            // Make sure the material can accept a map
            if (!boxMeshRef.current.material.map) {
              console.log('[SimpleCandleViewer] Material had no map, adding texture');
            }
            boxMeshRef.current.material.map = texture;
            boxMeshRef.current.material.color.set(0xffffff); // Set to white so texture shows properly
            boxMeshRef.current.material.needsUpdate = true;
            backgroundTextureRef.current = texture;
            currentBackgroundPath.current = backgroundTexturePath;
            console.log('[SimpleCandleViewer] Background texture applied to Box mesh');
            console.log('[SimpleCandleViewer] Material map is now:', boxMeshRef.current.material.map);
          }
        }, undefined, (error) => {
          console.error('[SimpleCandleViewer] Failed to load background texture:', error);
        });
      } else if (!backgroundTexturePath && currentBackgroundPath.current) {
        // Remove texture when backgroundTexturePath is null
        console.log('[SimpleCandleViewer] Removing background texture from Box mesh');
        if (boxMeshRef.current && boxMeshRef.current.material && boxMeshRef.current.material.map) {
          boxMeshRef.current.material.map = null;
          boxMeshRef.current.material.color.set(0x333333);
          boxMeshRef.current.material.needsUpdate = true;
        }
        currentBackgroundPath.current = null;
      }
    };

    // Start the texture application process
    applyTexture();
    
    // Cleanup function to clear timeout if component unmounts or dependencies change
    return () => {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [backgroundTexturePath, modelPath, textureLoader]);

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
}, 
 {
  id: 'guadalupe_pink',
  path: '/images/pinkGuadalupe.jpg',
  name: 'Pink Guadalupe',
  type: 'image'
},
 {
  id: 'guadalupe_blue',
  path: '/images/blueGuadalupe.jpg',
  name: 'Blue Guadalupe',
  type: 'image'
},
];
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
  const totalSteps = 7; // Added new step for devotion type selection
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
    devotionType: '', // 'candle' or 'tattoo'
    messageType: '',
    candleType: 'votive',
    selectedPose: '',  // Will be set based on character
    tattooCharacter: '', // 'blockhead_Streetman', 'blockhead_Surfer', or 'blockhead_runner'
    characterSkinColor: 'Brown', // 'Black', 'Brown', or 'White' for Streetman and Runner
    tattooDesign: '', // 'RL80_TATTOO' or 'ROSE_TATTOO'
    tattooPlacement: null, // Stores position, normal, meshName for tattoo placement
    candleHeight: 'medium',
    username: user?.username || user?.firstName || user?.fullName || '',  // Prepopulate with Clerk user's name
    message: '',
    burnedAmount: '0',  // Default to 0
    allowLikes: false,
    background: 'none',  // Default to no background
    baseColor: '#ffffff'  // Default white color for XBase meshes
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('/images/nuestraSenora.webp'); // Default to senora.png
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [encryptionPassword, setEncryptionPassword] = useState('');
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [scrambledDisplay, setScrambledDisplay] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showExitConfirmDialog, setShowExitConfirmDialog] = useState(false);
  const [candleWasCreated, setCandleWasCreated] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedPolaroidUrl, setCapturedPolaroidUrl] = useState(null);  // Add state for Firebase URL
  const polaroidResolveRef = useRef(null);  // Store resolve function
  const [isCapturing, setIsCapturing] = useState(false);  // Prevent duplicate captures
  const [showCandleSnapshot, setShowCandleSnapshot] = useState(false);
  const [savedCandleData, setSavedCandleData] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const modalContentRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Update username when Clerk user data loads
  useEffect(() => {
    if (user && !formData.username) {
      setFormData(prev => ({
        ...prev,
        username: user.username || user.firstName || user.fullName || ''
      }));
    }
  }, [user]);
  
  // Auto-switch to 'run' pose when tattoo placement is complete
  useEffect(() => {
    if (formData.tattooPlacement && formData.devotionType === 'tattoo') {
      // When tattoo placement is done, automatically switch from T-Pose to Run
      setFormData(prev => ({ 
        ...prev, 
        selectedPose: 'action'  // Default to action for Streetman 
      }));
    }
  }, [formData.tattooPlacement, formData.devotionType]);
  const textareaRef = useRef(null);
  const scrollContainerRef = useRef(null);


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
    
    // For tattoo devotions, we don't need to upload an image here
    // The polaroid will be created and saved later
    if (formData.devotionType === 'tattoo') {
      console.log('[CompactModal] Tattoo devotion - using design as placeholder image');
      // Use the tattoo design image as a placeholder
      if (formData.tattooDesign) {
        finalImageUrl = `/images/${formData.tattooDesign}.png`;
      } else {
        finalImageUrl = '/images/rose.png'; // Default fallback
      }
      console.log('[CompactModal] Using placeholder image for tattoo:', finalImageUrl);
    } else if (imageFile) {
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
    // For tattoo devotions, the hidden CandleSnapshotRenderer will capture automatically
    if (formData.devotionType === 'tattoo') {
      console.log('[CompactModal] Tattoo snapshot will be captured by hidden renderer');
      return;
    }
    
    // For non-tattoo devotions, capture regular canvas
    setTimeout(() => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        try {
          const imageData = canvas.toDataURL('image/png');
          setCapturedImage(imageData);
          console.log('[CompactModal] Captured canvas for non-tattoo');
        } catch (error) {
          console.error('[CompactModal] Error capturing canvas:', error);
        }
      }
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
    
    // Prevent duplicate captures
    if (isCapturing) {
      console.log('[CompactModal] Already capturing, ignoring duplicate request');
      return;
    }
    setIsCapturing(true);
    
    try {
      // For tattoo devotions, set up the wait BEFORE triggering capture
      let waitForUpload;
      if (formData.devotionType === 'tattoo') {
        console.log('[CompactModal] Setting up wait for polaroid upload BEFORE capture...');
        
        // Clear any existing URL
        setCapturedPolaroidUrl(null);
        
        // Create a promise to wait for the upload
        waitForUpload = new Promise((resolve) => {
          polaroidResolveRef.current = resolve;
          // Timeout after 15 seconds (increased timeout)
          setTimeout(() => {
            if (polaroidResolveRef.current) {
              console.log('[CompactModal] Polaroid upload timed out');
              polaroidResolveRef.current(null);
              polaroidResolveRef.current = null;
            }
          }, 15000);
        });
      }
      
      // Now trigger the capture
      captureCandle();
      
      // Give time for tattoo snapshots to render and capture the polaroid
      const captureDelay = formData.devotionType === 'tattoo' ? 3000 : 100; // Increased delay
      await new Promise(resolve => setTimeout(resolve, captureDelay));
      
      // Wait for polaroid upload to complete for tattoo devotions
      if (formData.devotionType === 'tattoo' && waitForUpload) {
        console.log('[CompactModal] Waiting for polaroid upload...');
        const uploadedUrl = await waitForUpload;
        if (uploadedUrl) {
          console.log('[CompactModal] Polaroid upload complete, URL:', uploadedUrl);
          // Make sure it's set in state too
          setCapturedPolaroidUrl(uploadedUrl);
          // Extra delay to ensure state is updated
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          console.log('[CompactModal] Polaroid upload failed or timed out, checking if already uploaded...');
          // Check if it was already uploaded
          if (capturedPolaroidUrl) {
            console.log('[CompactModal] Found existing polaroid URL:', capturedPolaroidUrl);
          }
        }
      }
    } finally {
      setIsCapturing(false);
    }
    
    setShowConfirmDialog(false);
    const trimmedUsername = sanitizeInput(formData.username, 50).trim();
    const trimmedMessage = sanitizeInput(formData.message, 500).trim();
    setIsSubmitting(true);
    setError('');
    try {
      const imageUrl = await uploadImage();
      console.log('[CompactModal] Final imageUrl to save to Firestore:', imageUrl);
      
      // Serialize tattoo placement data for Firebase
// UPDATE the serializeTattooPlacement function in handleConfirmedSave
// This ensures the correct fields are saved to Firebase

// UPDATED serializeTattooPlacement function for Firebase
// Include this in handleConfirmedSave in CompactCandleModal.jsx

const serializeTattooPlacement = (placement) => {
  if (!placement) return null;
  
  return {
    // World coordinates (for T-pose display and backwards compatibility)
    worldPosition: placement.worldPosition ? {
      x: placement.worldPosition.x || 0,
      y: placement.worldPosition.y || 0,
      z: placement.worldPosition.z || 0
    } : null,
    
    worldNormal: placement.worldNormal ? {
      x: placement.worldNormal.x || 0,
      y: placement.worldNormal.y || 0,
      z: placement.worldNormal.z || 0
    } : null,
    
    // Mesh name for camera rotation
    meshName: placement.meshName || 'unknown',
    
    // BONE ATTACHMENT INFO (NEW!)
    // This allows tattoo to move with skeleton in any pose
    boneName: placement.boneName || null,
    
    // Use offsetLocal/normalLocal field names (matching what InteractiveTattooViewer provides)
    offsetLocal: (placement.offsetLocal || placement.boneLocalOffset) ? {
      x: (placement.offsetLocal?.x || placement.boneLocalOffset?.x) || 0,
      y: (placement.offsetLocal?.y || placement.boneLocalOffset?.y) || 0,
      z: (placement.offsetLocal?.z || placement.boneLocalOffset?.z) || 0
    } : null,
    
    normalLocal: (placement.normalLocal || placement.boneLocalNormal) ? {
      x: (placement.normalLocal?.x || placement.boneLocalNormal?.x) || 0,
      y: (placement.normalLocal?.y || placement.boneLocalNormal?.y) || 0,
      z: (placement.normalLocal?.z || placement.boneLocalNormal?.z) || 0
    } : null,
  };
};

// Example placement data structure:
// {
//   worldPosition: { x: 0.5, y: 0.3, z: 0.2 },    // T-pose world coords
//   worldNormal: { x: 0, y: 0, z: 1 },             // Surface normal
//   meshName: "ArmLeft",                           // For camera angle
//   boneName: "mixamorigLeftForeArm",              // Bone to attach to
//   boneLocalOffset: { x: 0.02, y: -0.01, z: 0.1 }, // Offset from bone origin
//   boneLocalNormal: { x: 0, y: 0, z: 1 },         // Normal in bone space
// }



// The placement data structure from InteractiveTattooViewer:
// {
//   worldPosition: { x, y, z },  // Where to place the tattoo
//   worldNormal: { x, y, z },    // Which direction it faces
//   meshName: string,            // For smart camera positioning
// }

// Example usage in handleConfirmedSave:
// tattooPlacement: serializeTattooPlacement(formData.tattooPlacement),
      
      let docData;
      if (isEncrypted && encryptionPassword) {
        const encryptedData = await encryptMessage(trimmedMessage, encryptionPassword);
        docData = {
          messageType: formData.messageType,
          devotionType: formData.devotionType,
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
          staked: false,
          createdAt: serverTimestamp()
        };
        
        // Add candle-specific fields
        if (formData.devotionType === 'candle') {
          docData.candleType = formData.candleType;
          docData.candleHeight = formData.candleHeight || 'medium';
          docData.baseColor = formData.baseColor || '#ffffff';
        }
        
        // Add tattoo-specific fields
        if (formData.devotionType === 'tattoo') {
          docData.tattooCharacter = formData.tattooCharacter;
          docData.tattooDesign = formData.tattooDesign;
          docData.tattooPlacement = serializeTattooPlacement(formData.tattooPlacement);
          docData.selectedPose = formData.selectedPose || 
            (formData.tattooCharacter === 'blockhead_Streetman' ? 'action' : 
             formData.tattooCharacter === 'blockhead_runner' ? 'run' : 'run');
        }
      } else {
        docData = {
          messageType: formData.messageType,
          devotionType: formData.devotionType,
          username: trimmedUsername,
          createdBy: user?.id,
          createdByUsername: user?.username || user?.firstName || user?.fullName,
          userAvatar: clerkImageUrl || null,
          message: trimmedMessage,
          burnedAmount: parseInt(formData.burnedAmount) || 1000,
          image: imageUrl,
          background: formData.background || 'synthwave',
          staked: false,
          createdAt: serverTimestamp()
        };
        
        // Add candle-specific fields
        if (formData.devotionType === 'candle') {
          docData.candleType = formData.candleType;
          docData.candleHeight = formData.candleHeight || 'medium';
          docData.baseColor = formData.baseColor || '#ffffff';
        }
        
        // Add tattoo-specific fields
        if (formData.devotionType === 'tattoo') {
          docData.tattooCharacter = formData.tattooCharacter;
          docData.tattooDesign = formData.tattooDesign;
          docData.tattooPlacement = serializeTattooPlacement(formData.tattooPlacement);
          docData.selectedPose = formData.selectedPose || 
            (formData.tattooCharacter === 'blockhead_Streetman' ? 'action' : 
             formData.tattooCharacter === 'blockhead_runner' ? 'run' : 'run');
        }
      }
      // Skip saving to candles collection - will save to polaroids collection instead
      // const docRef = await addDoc(collection(db, 'candles'), docData);
      setCandleWasCreated(true);
      setIsSubmitting(true); // Show loading state immediately
      setSavedCandleData({
        username: formData.username || 'Anonymous',
        createdBy: user?.id || '',  // Add Clerk user ID
        image: imagePreview || imageUrl,  // Use imagePreview (selected image) for snapshot, fallback to uploaded URL
        message: formData.message,
        burnedAmount: docData.burnedAmount,
        devotionType: formData.devotionType,
        candleType: formData.candleType,
        candleHeight: formData.candleHeight || 'medium',
        tattooCharacter: formData.tattooCharacter,
        characterSkinColor: formData.characterSkinColor,
        tattooDesign: formData.tattooDesign,
        tattooPlacement: formData.tattooPlacement,
        selectedPose: formData.selectedPose || 
          (formData.tattooCharacter === 'blockhead_Streetman' ? 'action' : 
           formData.tattooCharacter === 'blockhead_runner' ? 'run' : 'run'),  // Add selectedPose here!
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
      
      // Show loading immediately before closing modal
      setShowCandleSnapshot(true);
      
      // Small delay to ensure loading state is visible before modal closes
      setTimeout(() => {
        onClose();
      }, 100);
      if (onCandleCreated) {
        onCandleCreated({
          ...docData,
          id: `temp-${Date.now()}`, // Temporary ID until polaroid is saved
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
        // New Step 1: Choose devotion type (candle or tattoo)
        return <div style={{
          padding: '20px',
          textAlign: 'center'
        }}>
            <h2 style={{
            fontSize: '24px',
            marginBottom: '10px',
            color: '#ffd700',
            fontWeight: 'bold'
          }}>Choose Your Devotion</h2>
            <p style={{
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '30px'
          }}>Select how you'd like to honor Our Lady of Perpetual Profit</p>
            
            <div style={{
            display: 'flex',
            gap: '20px',
            justifyContent: 'center',
            flexWrap: 'wrap',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
              <button
                onClick={() => setFormData(prev => ({ ...prev, devotionType: 'candle' }))}
                style={{
                  padding: '30px',
                  width: '250px',
                  background: formData.devotionType === 'candle' ? 
                    'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.2))' : 
                    'linear-gradient(135deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.3))',
                  border: formData.devotionType === 'candle' ? '2px solid #ffd700' : '1px solid rgba(255, 215, 0, 0.3)',
                  borderRadius: '12px',
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '15px'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(255, 215, 0, 0.3)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <img
                  src="/images/tinyVotive.webp"
                  alt="Virtual Candle"
                  style={{
                    width: '100px',
                    height: '100px',
                    objectFit: 'contain'
                  }}
                />
                <div>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    marginBottom: '5px'
                  }}>Virtual Candle</div>
                  <div style={{
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.7)'
                  }}>Light a sacred candle offering</div>
                </div>
              </button>
              
              <button
                onClick={() => setFormData(prev => ({ 
                  ...prev, 
                  devotionType: 'tattoo', 
                  tattooCharacter: 'blockhead_Streetman',
                  selectedPose: 'action'  // Set default pose for Streetman
                }))}
                style={{
                  padding: '30px',
                  width: '250px',
                  background: formData.devotionType === 'tattoo' ? 
                    'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.2))' : 
                    'linear-gradient(135deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.3))',
                  border: formData.devotionType === 'tattoo' ? '2px solid #ffd700' : '1px solid rgba(255, 215, 0, 0.3)',
                  borderRadius: '12px',
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '15px'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(255, 215, 0, 0.3)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <img
                  src="/images/blockhead_Streetman.webp"
                  alt="Virtual Tattoo"
                  style={{
                    width: '100px',
                    height: '100px',
                    objectFit: 'contain'
                  }}
                />
                <div>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    marginBottom: '5px'
                  }}>Virtual Tattoo</div>
                  <div style={{
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.7)'
                  }}>Get a permanent digital devotion</div>
                </div>
              </button>
            </div>
          </div>;
          
      case 2:
        // Step 2: Choose candle type or tattoo character
        if (formData.devotionType === 'tattoo') {
          return <div style={{
            padding: '20px',
            textAlign: 'center'
          }}>
              <h2 style={{
              fontSize: '24px',
              marginBottom: '10px',
              color: '#ffd700',
              fontWeight: 'bold'
            }}>Select Your Rep</h2>
              <p style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '30px'
            }}>Select who will bear your tattoo</p>
              
              <div style={{
              display: 'flex',
              gap: '20px',
              justifyContent: 'center',
              flexWrap: 'wrap',
              maxWidth: '800px',
              margin: '0 auto'
            }}>
                {[
                  { value: 'blockhead_Streetman', label: 'Streetman', image: '/images/blockhead_Streetman.webp' },
                  { value: 'blockhead_Surfer', label: 'Surfer', image: '/images/blockhead_Surfer2.webp' },
                  { value: 'blockhead_runner', label: 'Runner', image: '/images/blockhead_runner.png' }
                ].map(character => (
                  <button
                    key={character.value}
                    onClick={() => setFormData(prev => ({ 
                      ...prev, 
                      tattooCharacter: character.value,
                      // Set appropriate default pose for each character
                      selectedPose: character.value === 'blockhead_Streetman' ? 'action' : 
                                    character.value === 'blockhead_Surfer' ? 'action' :
                                   character.value === 'blockhead_runner' ? 'run' : 
                                   'run'
                    }))}
                    style={{
                      padding: '20px',
                      width: '200px',
                      background: formData.tattooCharacter === character.value ? 
                        'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.2))' : 
                        'linear-gradient(135deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.3))',
                      border: formData.tattooCharacter === character.value ? '2px solid #ffd700' : '1px solid rgba(255, 215, 0, 0.3)',
                      borderRadius: '12px',
                      color: '#fff',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '15px'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-5px)';
                      e.currentTarget.style.boxShadow = '0 10px 30px rgba(255, 215, 0, 0.3)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
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
                      <img
                        src={character.image}
                        alt={character.label}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain'
                        }}
                      />
                    </div>
                    <div>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: 'bold',
                        marginBottom: '5px'
                      }}>{character.label}</div>
                    </div>
                  </button>
                ))}
              </div>
              
              {/* Skin Color Selector - Only show for Streetman, Surfer, and Runner */}
              {(formData.tattooCharacter === 'blockhead_Streetman' || formData.tattooCharacter === 'blockhead_Surfer' || formData.tattooCharacter === 'blockhead_runner') && (
                <div style={{
                  marginTop: '30px',
                  padding: '20px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 215, 0, 0.2)'
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    color: '#ffd700',
                    marginBottom: '15px',
                    textAlign: 'center'
                  }}>Choose Skin Color</h3>
                  
                  <div style={{
                    display: 'flex',
                    gap: '15px',
                    justifyContent: 'center'
                  }}>
                    {['Black', 'Brown', 'White'].map(color => (
                      <button
                        key={color}
                        onClick={() => setFormData(prev => ({ ...prev, characterSkinColor: color }))}
                        style={{
                          padding: '12px 24px',
                          background: formData.characterSkinColor === color ?
                            'linear-gradient(135deg, rgba(255, 215, 0, 0.4), rgba(255, 215, 0, 0.3))' :
                            'rgba(0, 0, 0, 0.4)',
                          border: formData.characterSkinColor === color ?
                            '2px solid #ffd700' :
                            '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '8px',
                          color: formData.characterSkinColor === color ? '#ffd700' : '#fff',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                        onMouseEnter={e => {
                          if (formData.characterSkinColor !== color) {
                            e.currentTarget.style.background = 'rgba(255, 215, 0, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.5)';
                          }
                        }}
                        onMouseLeave={e => {
                          if (formData.characterSkinColor !== color) {
                            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                          }
                        }}
                      >
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: color === 'Black' ? '#3A2317' :
                                     color === 'Brown' ? '#8B6B4E' :
                                     '#F5DEB3',
                          border: '2px solid rgba(255, 255, 255, 0.3)'
                        }} />
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>;
        }
        
        // Original candle selection for candle devotion type
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
          
      case 3:
        // Step 3: Different for tattoos vs candles
        if (formData.devotionType === 'tattoo') {
          // Tattoo selection and placement step
          return <div style={{
            padding: '20px',
            textAlign: 'center'
          }}>
            <h2 style={{
              fontSize: '24px',
              marginBottom: '10px',
              color: '#ffd700',
              fontWeight: 'bold'
            }}>Choose Your Tattoo</h2>
            <p style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '20px'
            }}>
              {formData.tattooDesign ? 
                (formData.tattooPlacement ? 
                  '✅ Tattoo placed! You can click again to reposition or proceed to next step' : 
                  '⚠️ Click on the character above to place your tattoo') : 
                'Select the sacred design for your devotion'}
            </p>
            
            {formData.tattooDesign && !formData.tattooPlacement && (
              <div style={{
                padding: '15px',
                background: 'rgba(255, 165, 0, 0.1)',
                border: '2px solid #ffa500',
                borderRadius: '10px',
                marginBottom: '20px',
                animation: 'pulse 2s infinite'
              }}>
                <div style={{
                  fontSize: '16px',
                  color: '#ffa500',
                  fontWeight: 'bold'
                }}>
                  👆 Click on the character to place your tattoo!
                </div>
                <div style={{
                  fontSize: '13px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  marginTop: '5px'
                }}>
                  You must place the tattoo before proceeding
                </div>
              </div>
            )}
            
            <div style={{
              display: 'flex',
              gap: '20px',
              justifyContent: 'center',
              flexWrap: 'wrap',
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              <button
                onClick={() => setFormData(prev => ({ ...prev, tattooDesign: 'RL80_TATTOO' }))}
                style={{
                  padding: '20px',
                  width: '200px',
                  background: formData.tattooDesign === 'RL80_TATTOO' ? 
                    'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.2))' : 
                    'linear-gradient(135deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.3))',
                  border: formData.tattooDesign === 'RL80_TATTOO' ? '2px solid #ffd700' : '1px solid rgba(255, 215, 0, 0.3)',
                  borderRadius: '12px',
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '15px'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(255, 215, 0, 0.3)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  width: '120px',
                  height: '120px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)'
                }}>
                  <img
                    src="/images/RL80_TATTOO.png"
                    alt="RL80 Tattoo"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain'
                    }}
                  />
                </div>
                <div>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    marginBottom: '5px'
                  }}>RL80 Sacred Symbol</div>
                  <div style={{
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.7)'
                  }}>The mark of eternal profit</div>
                </div>
              </button>
              
              <button
                onClick={() => setFormData(prev => ({ ...prev, tattooDesign: 'ROSE_TATTOO' }))}
                style={{
                  padding: '20px',
                  width: '200px',
                  background: formData.tattooDesign === 'ROSE_TATTOO' ? 
                    'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.2))' : 
                    'linear-gradient(135deg, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.3))',
                  border: formData.tattooDesign === 'ROSE_TATTOO' ? '2px solid #ffd700' : '1px solid rgba(255, 215, 0, 0.3)',
                  borderRadius: '12px',
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '15px'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-5px)';
                  e.currentTarget.style.boxShadow = '0 10px 30px rgba(255, 215, 0, 0.3)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  width: '120px',
                  height: '120px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)'
                }}>
                  <img
                    src="/images/ROSE_TATTOO.png"
                    alt="Rose Tattoo"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain'
                    }}
                  />
                </div>
                <div>
                  <div style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    marginBottom: '5px'
                  }}>Sacred Rose</div>
                  <div style={{
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.7)'
                  }}>Blooming eternal devotion</div>
                </div>
              </button>
            </div>
            
            {formData.tattooDesign && (
              <div style={{
                marginTop: '20px',
                padding: '10px',
                background: formData.tattooPlacement ? 
                  'linear-gradient(135deg, rgba(0, 255, 0, 0.1), rgba(0, 255, 0, 0.05))' :
                  'linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 215, 0, 0.05))',
                border: formData.tattooPlacement ? 
                  '1px solid rgba(0, 255, 0, 0.3)' : 
                  '1px solid rgba(255, 215, 0, 0.3)',
                borderRadius: '8px',
                fontSize: '12px',
                color: formData.tattooPlacement ? '#00ff00' : '#ffd700'
              }}>
                {formData.tattooPlacement ? 
                  `✓ Tattoo placed on ${formData.tattooPlacement.meshName}` : 
                  '👆 Click on the model above to place your tattoo'}
              </div>
            )}
          </div>;
        }
        
        // Personalization step - skipped for Japanese candles
        if (formData.candleType === 'japanese') {
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
        
        // Original personalization step content
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
      case 4:
        // Pose selection for tattoos only
        if (formData.devotionType === 'tattoo') {
          return <div style={{
            padding: '20px',
            textAlign: 'center'
          }}>
            <h2 style={{
              fontSize: '20px',
              marginBottom: '8px',
              color: '#ffd700',
              fontWeight: 'bold'
            }}>Choose Your Pose</h2>
            <p style={{
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '20px'
            }}>Select how your character will appear</p>
            
            <PoseSelector
              selectedPose={formData.selectedPose}
              onPoseChange={(pose) => setFormData(prev => ({ 
                ...prev, 
                selectedPose: pose 
              }))}
              // Only show specific poses for each character
              availablePoseIds={
                formData.tattooCharacter === 'blockhead_Streetman' 
                  ? ['action', 'curl', 'pray', 'skateboard', 'dance1', 'dance2', 'standpose1']
                  : formData.tattooCharacter === 'blockhead_Surfer'
                  ? ['action', 'curl', 'pray', 'standpose1', 'stand2', 'surf']
                  : formData.tattooCharacter === 'blockhead_runner'
                  ? ['run', 'standpose1', 'stand2']
                  : null // Use default for other characters
              }
            />
          </div>;
        }
        // For candles, skip to message type selection
        // Fall through to case 5
      case 5:
        // Combined message type selection and composition
        return <div style={{
          padding: '20px'
        }}>
            <h2 style={{
              fontSize: '20px',
              marginBottom: '8px',
              color: '#ffd700',
              fontWeight: 'bold',
              textAlign: 'center'
            }}>Create Your Message</h2>
            <p style={{
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '20px',
              textAlign: 'center'
            }}>Choose the intention and compose your message</p>
            
            {/* Message type selection */}
            <div style={{
              display: 'flex',
              gap: '10px',
              width: '100%',
              justifyContent: 'space-between',
              marginBottom: '20px'
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

            {/* Alert message when no message type is selected */}
            {!formData.messageType && (
              <div style={{
                padding: '12px 16px',
                marginBottom: '20px',
                background: 'rgba(255, 193, 7, 0.1)',
                border: '1px solid rgba(255, 193, 7, 0.5)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                animation: 'pulse 2s infinite'
              }}>
                <span style={{ fontSize: '20px' }}>⚠️</span>
                <span style={{
                  color: '#ffd700',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  Please select a message type to continue
                </span>
              </div>
            )}

            {/* Message composition fields - only show after message type is selected */}
            {formData.messageType && (
              <>
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
              </>
            )}
          </div>;
      case 6:
        // Original step 5 - background selection
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
            
            {/* Base Color Picker - Only show for candles */}
            {formData.devotionType === 'candle' && (
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
            )}
          </div>;
      case 7:
        // Final review
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
                  ⚠️ Minimum 1000 tokens required
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
    // Validation for tattoo placement in step 3
    if (currentStep === 3 && formData.devotionType === 'tattoo') {
      if (!formData.tattooDesign) {
        setError('Please select a tattoo design');
        return;
      }
      if (!formData.tattooPlacement) {
        setError('Please click on the character to place your tattoo');
        return;
      }
      // Set default pose when moving to step 4
      setFormData(prev => ({ 
        ...prev, 
        selectedPose: prev.selectedPose || 
          (formData.tattooCharacter === 'blockhead_Streetman' ? 'action' : 
           formData.tattooCharacter === 'blockhead_Surfer' ? 'action' :
           formData.tattooCharacter === 'blockhead_runner' ? 'run' : 'action')
      }));
    }
    
    if (currentStep < totalSteps) {
      // Skip steps for candles vs tattoos
      if (currentStep === 2 && formData.candleType === 'japanese') {
        setCurrentStep(5); // Skip personalization (3) and pose selection (4)
      } else if (currentStep === 3 && formData.devotionType === 'candle') {
        setCurrentStep(5); // Skip pose selection (4) for candles
      } else if (currentStep === 4 && formData.devotionType === 'candle') {
        setCurrentStep(5); // This shouldn't happen but just in case
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };
  const handlePrev = () => {
    if (currentStep > 1) {
      // Skip steps when going back
      if (currentStep === 5 && formData.candleType === 'japanese') {
        setCurrentStep(2); // Skip personalization (3) and pose selection (4)
      } else if (currentStep === 5 && formData.devotionType === 'candle') {
        setCurrentStep(3); // Skip pose selection (4) for candles
      } else {
        setCurrentStep(currentStep - 1);
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
      
      {/* Hidden snapshot renderer for tattoo devotions */}
      {formData.devotionType === 'tattoo' && isOpen && currentStep >= 5 && formData.tattooCharacter && formData.tattooDesign && <div style={{
      position: 'fixed',
      top: '-9999px',
      left: '-9999px',
      width: '1px',
      height: '1px',
      pointerEvents: 'none',
      visibility: 'hidden'
    }}>
          <CandleSnapshotRenderer 
  isVisible={true}   
  userData={{
    devotionType: 'tattoo',
    tattooCharacter: formData.tattooCharacter,
    characterSkinColor: formData.characterSkinColor,
    tattooDesign: formData.tattooDesign,
    background: formData.background,
    selectedPose: formData.selectedPose || 
      (formData.tattooCharacter === 'blockhead_Streetman' ? 'action' : 
       formData.tattooCharacter === 'blockhead_runner' ? 'run' : 'run'),           // Character-appropriate default
    tattooPlacement: formData.tattooPlacement,      // From InteractiveTattooViewer
    username: formData.username,
    createdBy: user?.id || '',  // Add Clerk user ID
    burnedAmount: formData.burnedAmount,
  }}
  onComplete={(imageData) => {
    // Store the polaroid image when it's ready
    if (imageData) {
      setCapturedImage(imageData);
      console.log('[CompactModal] Tattoo polaroid captured from hidden renderer');
    }
  }} 
  preloadOnly={true}  // Just preload, don't capture
  instantCapture={false}
  saveToFirebase={false}  // Don't save from the preloader
  onFirebaseUploadComplete={(result) => {
    if (result.success) {
      console.log('[CompactModal] Tattoo saved to Firebase:', result.storageUrl);
      setCapturedPolaroidUrl(result.storageUrl);  // Save the Firebase URL
      // Resolve the promise if it exists
      if (polaroidResolveRef.current) {
        console.log('[CompactModal] Resolving polaroid upload promise');
        polaroidResolveRef.current(result.storageUrl);
        polaroidResolveRef.current = null;
      } else {
        console.log('[CompactModal] No promise to resolve (likely already timed out)');
      }
    } else {
      console.error('[CompactModal] Failed to save tattoo to Firebase:', {
        error: result.error,
        message: result.message,
        details: result.details,
        fullResult: result
      });
      setCapturedPolaroidUrl('ERROR');  // Set error state
      // Resolve with error
      if (polaroidResolveRef.current) {
        polaroidResolveRef.current(null);
        polaroidResolveRef.current = null;
      }
    }
  }} />
        </div>}
      
      {}
      {!isOpen && showCandleSnapshot && savedCandleData && <div style={{
      position: 'relative',
      zIndex: 100000
    }} onClick={e => {
      if (!e.target.closest('.action-button')) {
        setShowCandleSnapshot(false);
        setSavedCandleData(null);
        onClose(); // Also close the modal completely
      }
    }}>
          {/* Click to close instruction */}
          <div style={{
            position: 'fixed',
            bottom: '30px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100002,
            padding: '10px 20px',
            background: 'rgba(0, 0, 0, 0.8)',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#ffffff',
            fontSize: '14px',
            fontFamily: 'monospace',
            pointerEvents: 'none',
            animation: 'fadeInOut 2s ease infinite',
          }}>
            Click anywhere to close
          </div>
          {showSuccessMessage && (
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 100001,
              background: 'linear-gradient(135deg, rgba(0, 255, 0, 0.95) 0%, rgba(0, 150, 0, 0.9) 100%)',
              padding: '30px 50px',
              borderRadius: '20px',
              border: '2px solid #00ff00',
              boxShadow: '0 20px 60px rgba(0, 255, 0, 0.4)',
              textAlign: 'center',
              animation: 'fadeInScale 0.3s ease',
            }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>✨</div>
              <h2 style={{
                color: '#ffffff',
                margin: 0,
                fontSize: '24px',
                fontWeight: 'bold',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}>
                {savedCandleData.devotionType === 'tattoo' ? 'Tattoo Saved!' : 'Candle Lit!'}
              </h2>
              <p style={{
                color: '#ffffff',
                margin: '10px 0 0 0',
                fontSize: '16px',
                opacity: 0.95
              }}>
                Your devotion has been saved.
              </p>
            </div>
          )}
          
          <CandleSnapshotRenderer 
            isVisible={true} 
            userData={savedCandleData} 
            instantCapture={false} 
            onComplete={imageData => {
              // Capture the polaroid image when it's ready
              if (imageData) {
                setCapturedImage(imageData);
                console.log('[CompactModal] Received polaroid from CandleSnapshotRenderer for', savedCandleData.devotionType);
              }
            }}
            saveToFirebase={true}  // Enable Firebase upload for both candles and tattoos
            onFirebaseUploadComplete={(result) => {
              if (result && result.success) {
                console.log('[CompactModal] Polaroid uploaded successfully:', result.storageUrl);
                setCapturedPolaroidUrl(result.storageUrl);
                setShowSuccessMessage(true);
                // Don't auto-close - let user dismiss when ready
                // Hide the success message after a few seconds, but keep polaroid visible
                setTimeout(() => {
                  setShowSuccessMessage(false);
                }, 3000);  // Hide success message after 3 seconds
              } else if (result && !result.success) {
                console.error('[CompactModal] Upload failed:', result.error);
                // Show error for a moment, then allow user to dismiss
                setShowSuccessMessage(false); // Hide success, could show error message instead
              }
            }} 
          />
        </div>}
      
      {}
      
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.02);
          }
        }
        
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
        
        @keyframes fadeInOut {
          0%, 100% {
            opacity: 0.7;
          }
          50% {
            opacity: 1;
          }
        }
        
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
            <div className="preview-label">Preview</div>
            
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
              
              {currentStep === 1 && !formData.devotionType ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'rgba(255, 255, 255, 0.3)',
                  fontSize: '14px',
                  textAlign: 'center'
                }}>
                  Choose a devotion type to see preview
                </div>
              ) : currentStep === 1 ? (
                // Show default model based on devotion type for Step 1
                <Canvas camera={{
                  position: [0, -3, 9],
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
                    {formData.devotionType === 'tattoo' ? (
        <SimpleTattooViewer
  modelPath="/models/blockhead_StreetMan_Tpose.glb"
  tattooDesign={formData.tattooDesign}
  placementData={formData.tattooPlacement}  // Same data, same position!
  dedicationName={formData.username}
  characterSkinColor={formData.characterSkinColor}
  tattooCharacter={formData.tattooCharacter}
/>
                    ) : (
                      <SimpleCandleViewer
                        modelPath="/models/tinyVotiveOnly.glb"
                        customImageUrl={null}
                        backgroundTexturePath={null}
                        backgroundGradient={null}
                        showPlaque={false}
                        dedicationName=""
                        dedicationMessage=""
                        userAvatar={null}
                        burnAmount="0"
                        baseColor="#ffffff"
                        backgroundId={null}
                      />
                    )}
                  </Suspense>
                  <OrbitControls
                    enablePan={false}
                    enableZoom={true}
                    minDistance={5}
                    maxDistance={25}
                    autoRotate={true}
                    autoRotateSpeed={0.5}
                  />
                </Canvas>
              ) : (!formData.candleType && !formData.tattooCharacter && currentStep === 2) ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: 'rgba(255, 255, 255, 0.3)',
                  fontSize: '14px',
                  textAlign: 'center'
                }}>
                  Select an option to see preview
                </div>
              ) : (formData.candleType || formData.tattooCharacter) ? <Canvas 
                key={`canvas-step-${currentStep}`}
                camera={{
                  position: [0, -3, 9],
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
                    {formData.devotionType === 'tattoo' && formData.tattooCharacter ? (
                      currentStep === 3 ? (
                        // Interactive tattoo placement for Step 3
                        <InteractiveTattooViewer
                          modelPath={
                            formData.tattooCharacter === 'blockhead_Streetman' ? '/models/blockhead_StreetMan_Tpose.glb' : 
                            formData.tattooCharacter === 'blockhead_Surfer' ? '/models/blockhead_Surfer_Tpose.glb' :
                            formData.tattooCharacter === 'blockhead_runner' ? '/models/blockhead_runner.glb' :
                            '/models/blockhead_StreetMan_Tpose.glb' // fallback
                          }
                          tattooDesign={formData.tattooDesign}
                          onPlacementChange={(placement) => setFormData(prev => ({ 
                            ...prev, 
                            tattooPlacement: placement
                          }))}
                          placementData={formData.tattooPlacement}
                          isPlacementMode={true}
                          characterSkinColor={formData.characterSkinColor}
                          tattooCharacter={formData.tattooCharacter}
                        />
                      ) : (
                        // Regular viewer for other steps
                        <SimpleTattooViewer
                          modelPath={
                            // Use non-T-pose model for Streetman in steps 4-7
                            formData.tattooCharacter === 'blockhead_Streetman' && currentStep >= 4 
                              ? '/models/blockhead_Streetman.glb' 
                              : formData.tattooCharacter === 'blockhead_Streetman' 
                                ? '/models/blockhead_StreetMan_Tpose.glb' 
                                : formData.tattooCharacter === 'blockhead_Surfer' 
                                  ? '/models/blockhead_Surfer.glb' 
                                  : formData.tattooCharacter === 'blockhead_runner' 
                                    ? '/models/blockhead_runner.glb' 
                                    : '/models/blockhead_Streetman.glb' // fallback
                          }
                          dedicationName={formData.username}
                          dedicationMessage={formData.message}
                          tattooDesign={formData.tattooDesign}
                          placementData={formData.tattooPlacement}
                          showBackground={currentStep >= 6 && formData.background && formData.background !== 'none'}
                          backgroundTexture={(() => {
                            if (!formData.background || formData.background === 'none') return null;
                            const bgData = BACKGROUND_TEXTURES.find(bg => bg.id === formData.background);
                            if (bgData && bgData.path && !bgData.gradient) {
                              return new THREE.TextureLoader().load(bgData.path);
                            }
                            return null;
                          })()}
                          backgroundGradient={formData.background && formData.background.startsWith('dynamic-') ? formData.background : null}
                          selectedPose={
                            formData.selectedPose || 
                            (formData.tattooCharacter === 'blockhead_Streetman' ? 'action' : 
                             formData.tattooCharacter === 'blockhead_runner' ? 'run' : 'run')
                          }
                          characterSkinColor={formData.characterSkinColor}
                          tattooCharacter={formData.tattooCharacter}
                        />
                      )
                    ) : formData.candleType ? (
                      <SimpleCandleViewer 
                        modelPath={
                          (currentStep === 6 || currentStep === 7 || (formData.background && currentStep > 5))
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
                        showPlaque={currentStep === 6 || currentStep === 7}
                        dedicationName={formData.username}
                        dedicationMessage={formData.message}
                        userAvatar={clerkImageUrl || imagePreview}
                        burnAmount={formData.burnedAmount}
                        baseColor={formData.baseColor}
                        backgroundId={formData.background}
                      />
                    ) : null}
                  </Suspense>
                  <OrbitControls 
                    enablePan={false} 
                    enableZoom={true} 
                    minDistance={3} 
                    maxDistance={25} 
                    minPolarAngle={Math.PI / 4} 
                    maxPolarAngle={Math.PI / 2}
                    // autoRotate={currentStep !== 5 && currentStep !== 6}
                    // autoRotateSpeed={2}
                    target={[0, 0, 0]}
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
              {[1, 2, 3, 4, 5, 6, 7].map(step => <div key={step} style={{
                  width: '35px',
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
              
              {currentStep < 7 ? <button onClick={handleNext} style={{
                  padding: '10px 30px',
                  background: (currentStep === 3 && formData.devotionType === 'tattoo' && (!formData.tattooDesign || !formData.tattooPlacement)) || 
                    (currentStep === 5 && !formData.messageType) ? 
                    'linear-gradient(135deg, #888, #999)' : 
                    'linear-gradient(135deg, #ffd700, #ffed4e)',
                  border: 'none',
                  borderRadius: '8px',
                  color: (currentStep === 3 && formData.devotionType === 'tattoo' && (!formData.tattooDesign || !formData.tattooPlacement)) || 
                    (currentStep === 5 && !formData.messageType) ? 
                    '#555' : '#000',
                  cursor: (currentStep === 3 && formData.devotionType === 'tattoo' && (!formData.tattooDesign || !formData.tattooPlacement)) || 
                    (currentStep === 5 && !formData.messageType) ? 
                    'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  boxShadow: (currentStep === 3 && formData.devotionType === 'tattoo' && (!formData.tattooDesign || !formData.tattooPlacement)) || 
                    (currentStep === 5 && !formData.messageType) ? 
                    'none' : '0 4px 15px rgba(255, 215, 0, 0.3)',
                  opacity: (currentStep === 3 && formData.devotionType === 'tattoo' && (!formData.tattooDesign || !formData.tattooPlacement)) || 
                    (currentStep === 5 && !formData.messageType) ? 
                    0.6 : 1
                }} disabled={currentStep === 1 && !formData.devotionType || currentStep === 2 && !formData.candleType && !formData.tattooCharacter || currentStep === 3 && formData.devotionType === 'tattoo' && (!formData.tattooDesign || !formData.tattooPlacement) || currentStep === 5 && !formData.messageType}>
                  {currentStep === 3 && formData.devotionType === 'tattoo' && !formData.tattooPlacement && formData.tattooDesign ? 
                    'Place Tattoo First' : 
                   currentStep === 5 && !formData.messageType ? 
                    'Select Message Type' : 'Next'}
                </button> : <button onClick={handleConfirmedSave} style={{
                  padding: '10px 30px',
                  background: isSubmitting 
                    ? 'linear-gradient(135deg, #00ff00, #00dd00)' 
                    : 'linear-gradient(135deg, #ff6b35, #ff9558)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: isSubmitting ? 'wait' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  boxShadow: isSubmitting 
                    ? '0 4px 15px rgba(0, 255, 0, 0.4)' 
                    : '0 4px 15px rgba(255, 107, 53, 0.4)',
                  opacity: isSubmitting ? 0.8 : 1,
                  transition: 'all 0.3s ease'
                }} disabled={isSubmitting || !formData.messageType || (!formData.candleType && !formData.tattooCharacter) || !formData.username || !formData.username.trim() || !formData.burnedAmount || formData.burnedAmount === '0' || parseInt(formData.burnedAmount) === 0}>
                  {isSubmitting ? '✨ Creating...' : 'Send it! 🔥'}
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
                    }} placeholder="1" required style={{
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
                  {isSubmitting ? <span>Creating...</span> : <span>Send it!</span>}
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