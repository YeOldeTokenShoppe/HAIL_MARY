'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as SkeletonUtilsClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import PolaroidSnapshot from '@/components/PolaroidSnapshot';

// Skybox textures configuration
const SKYBOX_TEXTURES = {
  cyberpunk: '/images/cyberpunk.webp',
  synthwave: '/images/synthwave.webp',
  gothicTokyo: '/images/gothicTokyo.webp',
  neoTokyo: '/images/neoTokyo.webp',
  aurora: '/images/aurora.webp',
  sunset: '/images/gradient-sunset.webp',
  dreams: '/images/gradient-dreams.webp',
  tradingView: '/images/uattr.webp',
  chart: '/images/chart.webp',
  collectibles: '/images/pokemon2.webp',
  alchemy: '/images/alchemy.gif',
};

// Preload models
if (typeof window !== 'undefined') {
  useGLTF.preload('/models/tinyVotiveBox.glb');
  useGLTF.preload('/models/tinyJapCanBox.glb');
  useGLTF.preload('/models/blockhead_Streetman.glb');
  useGLTF.preload('/models/blockhead2.glb');
  useGLTF.preload('/models/blockhead_runner.glb');
}

// Helper function to determine which model to load
function getModelPath(userData, includeBox = false) {
  if (userData?.devotionType === 'tattoo') {
    if (userData?.tattooCharacter === 'blockhead_Streetman') {
      return '/models/blockhead_Streetman.glb';  // Fixed typo: removed hyphen
    } else if (userData?.tattooCharacter === 'blockhead_runner') {
      return '/models/blockhead_runner.glb';
    } else if (userData?.tattooCharacter === 'blockhead2') {
      return '/models/blockhead2.glb';
    }
    return '/models/blockhead_Streetman.glb';
  }
  
  const candleType = userData?.candleType;
  if (candleType === 'votive') {
    return includeBox ? "/models/tinyVotiveBox.glb" : "/models/tinyVotiveOnly.glb";
  } else if (candleType === 'japanese') {
    return includeBox ? '/models/tinyJapCanBox.glb' : '/models/tinyJapCanOnly.glb';
  }
  return includeBox ? "/models/tinyVotiveBox.glb" : "/models/tinyVotiveOnly.glb";
}


// Scene component for both candles and tattoos
function CandleScene({ userData, onReady }) {
  // At the start of CandleScene function:
  console.log('[Snapshot] FULL userData received:', JSON.stringify(userData, null, 2));
  
  const modelPath = getModelPath(userData, false);
  
  let scene, animations;
  try {
    const model = useGLTF(modelPath);
    console.log('[Snapshot] Loaded model from:', modelPath);
    console.log('[Snapshot] Model object:', model);
    console.log('[Snapshot] Model animations:', model.animations);
    
    // Check if Character_Rig has animations
    let characterRig = null;
    model.scene.traverse((child) => {
      console.log('[Snapshot] Checking child:', child.name, 'type:', child.type);
      if (child.name === 'Character_Rig') {
        characterRig = child;
        console.log('[Snapshot] Found Character_Rig!', child);
      }
    });
    
    scene = model.scene;
    animations = model.animations;
  } catch (error) {
    console.error('Error loading model:', error);
    const fallbackModel = useGLTF('/models/tinyVotiveOnly.glb');
    scene = fallbackModel.scene;
    animations = fallbackModel.animations;
  }
  
  const candleRef = useRef();
  const mixerRef = useRef(null);
  const flamePointLightRef = useRef();
  const backgroundTextureRef = useRef(null);
  
  useEffect(() => {
    if (!scene) return;
    
    const currentModelPath = modelPath;
    let isTattooScene = false;
    let roomTextureNeeded = false;
    let roomMeshFound = false;
    
    // Clone the scene - use SkeletonUtils for skinned meshes (tattoo models)
    let clonedScene;
    if (userData?.devotionType === 'tattoo') {
      clonedScene = SkeletonUtilsClone(scene);
      clonedScene.scale.set(1.5, 1.5, 1.5);
      clonedScene.position.set(0, -2.3, -1);  // Lowered to center character in frame
    } else {
      clonedScene = scene.clone();
    }
    
    // Clone materials
    clonedScene.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
      }
    });
    
    // Add to scene
    if (candleRef.current) {
      candleRef.current.add(clonedScene);
    }
    
    // Apply animation for tattoo characters (if not T-pose)
    console.log('[Snapshot] Checking animation - devotionType:', userData?.devotionType, 'selectedPose:', userData?.selectedPose);
    console.log('[Snapshot] Animations object:', animations);
    console.log('[Snapshot] Number of animations:', animations?.length);
    
    // Simplified condition for debugging
    if (userData?.devotionType === 'tattoo') {
      console.log('[Snapshot] Tattoo detected, will try to apply pose:', userData?.selectedPose);
      console.log('[Snapshot] Available animations:', animations?.map(a => a.name));
      
      // Handle skateboard, platform, and dumbell visibility
      if (clonedScene) {
        clonedScene.traverse((child) => {
          if (child.isMesh && child.name) {
            const nameLower = child.name.toLowerCase();
            
            // Skateboard mesh visibility
            if (nameLower.includes('skateboard') && !nameLower.includes('platform')) {
              child.visible = userData?.selectedPose === 'skateboard';
            }
            // SkatePlatform visible only during skateboard animation
            else if (nameLower.includes('skateplatform') || 
                     (nameLower.includes('skate') && nameLower.includes('platform'))) {
              child.visible = userData?.selectedPose === 'skateboard';
            }
            // Platform2 visible for all other animations
            else if (nameLower === 'platform2' || nameLower.includes('platform2')) {
              child.visible = userData?.selectedPose !== 'skateboard';
            }
            // Dumbell1 visible only during curl animation
            else if (nameLower === 'dumbell1' || nameLower.includes('dumbell1')) {
              child.visible = userData?.selectedPose === 'curl';
            }
            // Dumbell2 visible only during curl animation
            else if (nameLower === 'dumbell2' || nameLower.includes('dumbell2')) {
              child.visible = userData?.selectedPose === 'curl';
            }
            // Surfboard visible only during surf animation
            else if (nameLower === 'surfboard' || nameLower.includes('surfboard')) {
              child.visible = userData?.selectedPose === 'surf';
            }
          }
        });
      }
      
      if (animations && animations.length > 0) {
        let targetAnimation = null;
        
        // Look for the appropriate animation based on selectedPose
        if (userData.selectedPose === 'run') {
          console.log('[Snapshot] Looking for run animation...');
          console.log('[Snapshot] All animation names:', animations.map(a => a.name));
          
          targetAnimation = animations.find(a => {
            const name = a.name;
            console.log('[Snapshot] Checking animation:', name, 'duration:', a.duration);
            // Check various possible names
            return name === 'Run_Pose' || 
                   name === 'RunPose' || 
                   name === 'Run' || 
                   name === 'Character_Rig|Run_Pose' ||  // Sometimes animations are named with rig prefix
                   name.toLowerCase().includes('run');
          });
        } else if (userData.selectedPose === 'dance') {
          targetAnimation = animations.find(a => {
            const name = a.name;
            return name === 'Dance_Pose' || 
                   name === 'DancePose' || 
                   name === 'Dance' ||
                   name === 'Character_Rig|Dance_Pose' ||
                   name.toLowerCase().includes('dance');
          });
        } else if (userData.selectedPose === 'stand1') {
          targetAnimation = animations.find(a => {
            const name = a.name;
            return name === 'StandPose1' || 
                   name === 'Stand_Pose_1' ||
                   name === 'Character_Rig|StandPose1' ||
                   name.includes('StandPose1') ||
                   name.includes('stand') && name.includes('1');
          });
        } else if (userData.selectedPose === 'stand2') {
          targetAnimation = animations.find(a => {
            const name = a.name;
            return name === 'StandPose2' || 
                   name === 'Stand_Pose_2' ||
                   name === 'Character_Rig|StandPose2' ||
                   name.includes('StandPose2') ||
                   name.includes('stand') && name.includes('2');
          });
        } else if (userData.selectedPose === 'action') {
          targetAnimation = animations.find(a => {
            const name = a.name;
            return name === 'Action' || 
                   name === 'Character_Rig|Action' ||
                   name.toLowerCase() === 'action';
          });
        } else if (userData.selectedPose === 'curl') {
          targetAnimation = animations.find(a => {
            const name = a.name;
            return name === 'Curl' || 
                   name === 'Character_Rig|Curl' ||
                   name.toLowerCase() === 'curl';
          });
        } else if (userData.selectedPose === 'pray') {
          targetAnimation = animations.find(a => {
            const name = a.name;
            return name === 'Pray' || 
                   name === 'Character_Rig|Pray' ||
                   name.toLowerCase() === 'pray';
          });
        } else if (userData.selectedPose === 'skateboard') {
          targetAnimation = animations.find(a => {
            const name = a.name;
            return name === 'Skateboard' || 
                   name === 'Character_Rig|Skateboard' ||
                   name.toLowerCase() === 'skateboard';
          });
        } else if (userData.selectedPose === 'dance1') {
          targetAnimation = animations.find(a => {
            const name = a.name;
            return name === 'Dance1' || 
                   name === 'Character_Rig|Dance1' ||
                   name.toLowerCase() === 'dance1';
          });
        } else if (userData.selectedPose === 'dance2') {
          targetAnimation = animations.find(a => {
            const name = a.name;
            return name === 'Dance2' || 
                   name === 'Character_Rig|Dance2' ||
                   name.toLowerCase() === 'dance2';
          });
        } else if (userData.selectedPose === 'standpose1') {
          targetAnimation = animations.find(a => {
            const name = a.name;
            return name === 'StandPose1' || 
                   name === 'Character_Rig|StandPose1' ||
                   name.toLowerCase() === 'standpose1';
          });
        } else if (userData.selectedPose === 'surf') {
          targetAnimation = animations.find(a => {
            const name = a.name;
            return name === 'Surf' || 
                   name === 'Character_Rig|Surf' ||
                   name.toLowerCase() === 'surf';
          });
        }
        
        if (targetAnimation) {
          console.log('[Snapshot] Found animation:', targetAnimation.name, 'duration:', targetAnimation.duration, 'for pose:', userData.selectedPose);
          
          const mixer = new THREE.AnimationMixer(clonedScene);
          
          // Stop all actions first to prevent blending
          mixer.stopAllAction();
          
          const action = mixer.clipAction(targetAnimation);
          // Match EXACTLY what the working version does
          action.reset();
          action.setEffectiveWeight(1);
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.play();
          
          // Use update(0.5) like the working version - this actually works!
          mixer.update(0.5);
          clonedScene.updateMatrixWorld(true);
          
          // Store mixer to potentially update it later if needed
          mixerRef.current = mixer;
          
          console.log('[Snapshot] Animation applied:', targetAnimation.name, 'duration:', targetAnimation.duration);
        } else {
          console.warn('[Snapshot] No animation found for pose:', userData.selectedPose);
        }
      }
    }
    
    // Handle tattoo devotions - add tattoo as plane mesh
    if (userData?.devotionType === 'tattoo' && userData?.tattooPlacement) {
      isTattooScene = true;
      
      console.log('[Snapshot] Processing tattoo devotion');
      console.log('[Snapshot] Selected pose:', userData.selectedPose);
      console.log('[Snapshot] Animations available:', animations?.map(a => a.name));
      console.log('[Snapshot] Tattoo placement data:', userData.tattooPlacement);
      console.log('[Snapshot] Selected pose:', userData.selectedPose || 'tpose');
      
      if (userData.tattooDesign && userData.tattooPlacement) {
        const textureLoader = new THREE.TextureLoader();
        const tattooPath = `/images/${userData.tattooDesign}.png`;
        
        textureLoader.load(
          tattooPath,
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.needsUpdate = true;
            
            // Create plane geometry for tattoo - scaled for snapshot
            const planeGeom = new THREE.PlaneGeometry(0.5, 0.5);
            const planeMat = new THREE.MeshBasicMaterial({
              map: texture,
              transparent: true,
              side: THREE.DoubleSide,
              depthTest: true,
              depthWrite: false,
              alphaTest: 0.1,
            });
            
            const tattooPlane = new THREE.Mesh(planeGeom, planeMat);
            tattooPlane.renderOrder = 999;
            
            const placement = userData.tattooPlacement;
            const worldPos = placement.worldPosition;
            const worldNormal = placement.worldNormal;
            
            // Check if we should use bone-relative positioning for animated poses
            const useAnimation = userData.selectedPose && userData.selectedPose !== 'tpose';
            const hasBoneData = placement.boneName && placement.offsetLocal && placement.normalLocal;
            
            if (useAnimation && hasBoneData) {
              // For animated poses, use bone-relative positioning
              console.log('[Snapshot] Using bone-relative positioning for pose:', userData.selectedPose);
              
              // Find the bone in the animated model
              let targetBone = null;
              clonedScene.traverse((child) => {
                if (child.isBone && child.name === placement.boneName) {
                  targetBone = child;
                }
              });
              
              if (targetBone) {
                // Get bone's world transform
                targetBone.updateMatrixWorld(true);
                const boneWorldPos = new THREE.Vector3();
                const boneWorldQuat = new THREE.Quaternion();
                targetBone.getWorldPosition(boneWorldPos);
                targetBone.getWorldQuaternion(boneWorldQuat);
                
                // Apply local offset
                const offsetVec = new THREE.Vector3(
                  placement.offsetLocal.x || 0,
                  placement.offsetLocal.y || 0,
                  placement.offsetLocal.z || 0
                );
                const worldOffset = offsetVec.clone().applyQuaternion(boneWorldQuat);
                
                // Set tattoo position
                tattooPlane.position.copy(boneWorldPos).add(worldOffset);
                
                // Apply normal offset
                const normalVec = new THREE.Vector3(
                  placement.normalLocal.x || 0,
                  placement.normalLocal.y || 0,
                  placement.normalLocal.z || 1
                );
                const worldNormal = normalVec.clone().applyQuaternion(boneWorldQuat).normalize();
                tattooPlane.position.add(worldNormal.clone().multiplyScalar(0.02));
                
                // Orient tattoo
                const defaultNormal = new THREE.Vector3(0, 0, 1);
                const quaternion = new THREE.Quaternion();
                quaternion.setFromUnitVectors(defaultNormal, worldNormal);
                tattooPlane.quaternion.copy(quaternion);
                
                console.log('[Snapshot] Tattoo positioned on bone:', placement.boneName);
              } else {
                console.warn('[Snapshot] Bone not found:', placement.boneName, 'falling back to world position');
                // Fallback to world position
                tattooPlane.position.set(worldPos.x || 0, worldPos.y || 0, worldPos.z || 0);
              }
            } else if (worldPos && worldNormal) {
              // For T-pose or if no bone data, use world position directly
              console.log('[Snapshot] Using world position for T-pose');
              tattooPlane.position.set(
                worldPos.x || 0,
                worldPos.y || 0,
                worldPos.z || 0
              );
              
            }
            
            if (!useAnimation || !hasBoneData) {
              // For T-pose, also apply the normal and orientation
              const normal = new THREE.Vector3(
                worldNormal.x || 0,
                worldNormal.y || 0,
                worldNormal.z || 1
              ).normalize();
              
              // Offset along normal to prevent z-fighting
              tattooPlane.position.add(normal.clone().multiplyScalar(0.02));
              
              // Orient using quaternion (NOT lookAt!)
              const defaultNormal = new THREE.Vector3(0, 0, 1);
              const quaternion = new THREE.Quaternion();
              quaternion.setFromUnitVectors(defaultNormal, normal);
              tattooPlane.quaternion.copy(quaternion);
            }
            
            console.log('[Snapshot] Tattoo positioned at:', tattooPlane.position.toArray().map(v => v.toFixed(3)));
            
            // Add to candleRef (parent of clonedScene) so it's in world space
            if (candleRef.current) {
              candleRef.current.add(tattooPlane);
              console.log('[Snapshot] Tattoo plane added to scene');
            }
            
            // Trigger ready callback after tattoo is applied
            if (onReady) {
              setTimeout(() => {
                console.log('[Snapshot] Triggering snapshot after tattoo application');
                onReady();
              }, 500);
            }
          },
          undefined,
          () => {
            console.error('[Snapshot] Failed to load tattoo texture');
            if (onReady) onReady();
          }
        );
      }
      
      // Apply optimal rotation for tattoo display
      const getOptimalRotation = (meshName) => {
        if (!meshName) return 0;
        const name = meshName.toLowerCase();
        if (name.includes('armleft') || name.includes('arm_left')) return -Math.PI / 5;
        if (name.includes('armright') || name.includes('arm_right')) return Math.PI / 5;
        if (name.includes('legleft') || name.includes('leg_left')) return -Math.PI / 8;
        if (name.includes('legright') || name.includes('leg_right')) return Math.PI / 8;
        if (name.includes('back')) return Math.PI;
        return 0;
      };
      
      if (userData.tattooPlacement.meshName) {
        clonedScene.rotation.y = getOptimalRotation(userData.tattooPlacement.meshName);
      }
    }
    
    // =====================================================
    // CANDLE HANDLING (unchanged from original)
    // =====================================================
    
    // Apply user's image to senora mesh for votive candles
    if (userData?.image && userData?.candleType === 'votive') {
      const textureLoader = new THREE.TextureLoader();
      
      clonedScene.traverse((child) => {
        const isSenoraObject = child.name === 'senora' || 
                              (child.material && child.material.name === 'senora') ||
                              (child.material && child.material.name === 'senora.001');
        
        if (child.isMesh && isSenoraObject) {
          textureLoader.load(
            userData.image,
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
              texture.needsUpdate = true;
              
              child.material = child.material.clone();
              child.material.map = texture;
              child.material.transparent = true;
              child.material.opacity = 1;
              child.material.alphaTest = 0.1;
              child.material.needsUpdate = true;
            }
          );
        }
      });
    }
    
    // Apply baseColor to XBase meshes
    if (userData?.baseColor && userData.baseColor !== '#ffffff') {
      clonedScene.traverse((child) => {
        if (child.isMesh) {
          const meshNameLower = child.name.toLowerCase();
          const isBoxMesh = child.name === 'Box' || child.name === 'box';
          
          const isXBaseMesh = !isBoxMesh && (
                             meshNameLower === 'xbase' || 
                             meshNameLower.startsWith('xbase') ||
                             (currentModelPath.includes('tinyVotive') && 
                              (meshNameLower === 'base' || 
                               meshNameLower === 'cylinder' || 
                               meshNameLower === 'candle' ||
                               meshNameLower.includes('candle_base') ||
                               meshNameLower.includes('wax'))));
          
          if (isXBaseMesh) {
            child.material = child.material.clone();
            child.material.color = new THREE.Color(userData.baseColor);
            child.material.needsUpdate = true;
          }
        }
      });
    }
    
    // Apply background
    if (userData?.background && SKYBOX_TEXTURES[userData.background]) {
      // Skip adding background plane for tattoo devotions - 
      // it will be composited in PolaroidSnapshot instead
      if (userData?.devotionType === 'tattoo') {
        // Don't add background plane - let PolaroidSnapshot composite it
      }
      
      roomTextureNeeded = true;
      
      clonedScene.traverse((child) => {
        if (child.isMesh && (child.name === 'Box' || child.name === 'box')) {
          roomMeshFound = true;
          child.visible = true;
          child.renderOrder = -1000;
          child.frustumCulled = false;
        }
      });
      
      if (roomMeshFound) {
        const textureLoader = new THREE.TextureLoader();
        const texturePath = SKYBOX_TEXTURES[userData.background];
        
        textureLoader.load(
          texturePath,
          (texture) => {
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.flipY = true;
            texture.needsUpdate = true;
            
            clonedScene.traverse((child) => {
              if ((child.name === 'Box' || child.name === 'box') && child.isMesh) {
                child.material = child.material.clone();
                child.material.map = texture;
                child.material.needsUpdate = true;
                child.visible = true;
                child.renderOrder = -1000;
                child.frustumCulled = false;
              }
            });
            
            if (!isTattooScene && onReady) {
              setTimeout(onReady, 1500);
            }
          },
          undefined,
          () => {
            if (!isTattooScene && onReady) {
              setTimeout(onReady, 500);
            }
          }
        );
      }
    }
    
    // Reset melted geometry
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        if (child.name.toLowerCase().includes('candle') || 
            child.name.toLowerCase().includes('wax') ||
            child.name.toLowerCase().includes('melt')) {
          if (child.morphTargetInfluences) {
            child.morphTargetInfluences.forEach((_, index) => {
              child.morphTargetInfluences[index] = 0;
            });
          }
          child.scale.set(1, 1, 1);
        }
      }
    });
    
    // Apply user image to label
    if (userData?.image) {
      let labelFound = false;
      clonedScene.traverse((child) => {
        if (child.name.includes("Label2") && child.isMesh) {
          labelFound = true;
          const textureLoader = new THREE.TextureLoader();
          textureLoader.load(userData.image, (texture) => {
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.repeat.set(1, -1);
            texture.offset.set(0, 1);
            texture.colorSpace = THREE.SRGBColorSpace;
            
            child.material = new THREE.MeshStandardMaterial({
              map: texture,
              emissive: new THREE.Color(0xff6600),
              emissiveIntensity: 0.2,
              roughness: 0.8,
              metalness: 0.1,
              side: THREE.DoubleSide,
            });
            
          });
        }
      });
      
    }
    
    // Set up animation for votive candles only
    if (animations && animations.length > 0 && userData?.candleType === 'votive') {
      mixerRef.current = new THREE.AnimationMixer(clonedScene);
      animations.forEach((clip) => {
        const action = mixerRef.current.clipAction(clip);
        action.reset();
        action.time = 0;
        action.setEffectiveTimeScale(1);
        action.setEffectiveWeight(1);
        
        if (clip.duration < 2) {
          action.play();
          action.setLoop(THREE.LoopRepeat);
        }
      });
    }
    
    // Fallback background plane
    if (userData?.background && !roomMeshFound && SKYBOX_TEXTURES[userData.background] && userData?.devotionType !== 'tattoo') {
      const textureLoader = new THREE.TextureLoader();
      const texturePath = SKYBOX_TEXTURES[userData.background];
      
      textureLoader.load(
        texturePath,
        (texture) => {
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.flipY = true;
          texture.needsUpdate = true;
          
          const planeGeometry = new THREE.PlaneGeometry(20, 20);
          const planeMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.DoubleSide,
            transparent: false,
            opacity: 1
          });
          const backgroundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
          backgroundPlane.position.z = -5;
          backgroundPlane.renderOrder = -1000;
          
          if (candleRef.current) {
            candleRef.current.add(backgroundPlane);
          }
          
          // Call onReady after background is loaded
          if (onReady && !isTattooScene) {
            setTimeout(() => {
              console.log('[Snapshot] Triggering ready after background load for candle');
              onReady();
            }, 500);
          }
        }
      );
    } else if (!isTattooScene && onReady) {
      // If no background needed, still call onReady for candles
      setTimeout(() => {
        console.log('[Snapshot] Triggering ready for candle (no background)');
        onReady();
      }, 500);
    }
    
    return () => {
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
      
      if (candleRef.current) {
        candleRef.current.traverse((child) => {
          if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.forEach(material => {
                if (material.map) material.map.dispose();
                if (material.normalMap) material.normalMap.dispose();
                if (material.roughnessMap) material.roughnessMap.dispose();
                if (material.metalnessMap) material.metalnessMap.dispose();
                if (material.emissiveMap) material.emissiveMap.dispose();
                material.dispose();
              });
            }
          }
        });
        
        while (candleRef.current.children.length > 0) {
          candleRef.current.remove(candleRef.current.children[0]);
        }
      }
      
      if (backgroundTextureRef.current) {
        backgroundTextureRef.current.dispose();
        backgroundTextureRef.current = null;
      }
    };
  }, [scene, animations, userData, onReady, modelPath]);
  
  // Animation frame update
  useEffect(() => {
    let animationId;
    const animate = () => {
      if (candleRef.current && flamePointLightRef.current) {
        const box = new THREE.Box3().setFromObject(candleRef.current);
        const center = box.getCenter(new THREE.Vector3());
        flamePointLightRef.current.position.set(center.x, center.y + 1.8, center.z);
      }
      
      // Only update animation for votive candles, NOT for tattoos
      // Tattoos should stay frozen at their setTime position
      if (mixerRef.current && userData?.candleType === 'votive' && userData?.devotionType !== 'tattoo') {
        mixerRef.current.update(0.016);
      }
      
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [userData?.candleType]);
  
  return (
    <>
      <ambientLight intensity={userData?.devotionType === 'tattoo' ? 2.0 : 1.5} color="#ffffff" />  
      <directionalLight 
        position={[-1, 5, 3]} 
        intensity={userData?.devotionType === 'tattoo' ? 1.8 : 1.4}
        color="#fff5ee"
      />
      <ambientLight intensity={0.8} />
      <group ref={candleRef} scale={[1, 1, 1]} position={[0, 0, 0]} />
    </>
  );
}

// Main component
export default function CandleSnapshotRenderer({ 
  isVisible, 
  userData, 
  onComplete,
  preloadOnly = false,
  onReady,
  instantCapture = false,
  // ADD THESE:
  saveToFirebase = false,
  onFirebaseUploadComplete = null,
}) {
  const renderInstanceId = useRef(Math.random().toString(36).substring(7));
  console.log(`[CandleSnapshotRenderer-${renderInstanceId.current}] Rendering with background:`, userData?.background, 'saveToFirebase:', saveToFirebase, 'instantCapture:', instantCapture);
  const [triggerSnapshot, setTriggerSnapshot] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [showLoading, setShowLoading] = useState(!preloadOnly && !instantCapture);
  const [loadingMessage, setLoadingMessage] = useState('Preparing your devotion...');
  const canvasRef = useRef();
  const hasUploadedRef = useRef(false); // Prevent duplicate uploads
  
  useEffect(() => {
    // Update loading message based on devotion type
    if (userData?.devotionType === 'tattoo') {
      setLoadingMessage('Loading character model...');
    } else {
      setLoadingMessage('Preparing your candle...');
    }
  }, [userData?.devotionType]);

  useEffect(() => {
    if (sceneReady && isVisible) {
      if (preloadOnly && onReady) {
        onReady();
        return;
      }
      
      if (instantCapture) {
        setShowLoading(false);
        setTriggerSnapshot(true);
        return;
      }
      
      // Update message when scene is ready
      setLoadingMessage('Creating your snapshot...');
      
      const timer = setTimeout(() => {
        setShowLoading(false);
        setTriggerSnapshot(true);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [sceneReady, isVisible, preloadOnly, instantCapture, onReady]);
  
  const handleSceneReady = () => {
    setSceneReady(true);
  };
  
  const handleSnapshotComplete = async (imageData) => {
    // Still call the original callback
    if (onComplete) {
      onComplete(imageData);
    }
    
    // Upload to Firebase via API - but only once per instance
    if (saveToFirebase && imageData && !hasUploadedRef.current) {
      hasUploadedRef.current = true; // Mark as uploaded to prevent duplicates
      console.log(`[CandleSnapshotRenderer-${renderInstanceId.current}] Starting Firebase upload`);
      try {
        // Check if this image has a background by looking at its content
        const hasBackground = imageData && imageData.length > 2000000; // Composited images are larger
        console.log('[CandleSnapshotRenderer] Image size:', imageData?.length, 'Has background:', hasBackground);
        
        console.log('[CandleSnapshotRenderer] Uploading to Firebase with metadata:', {
          username: userData?.username,
          createdBy: userData?.createdBy,
          devotionType: userData?.devotionType,
          background: userData?.background,
          burnedAmount: userData?.burnedAmount,
          tattooDesign: userData?.tattooDesign,
          tattooCharacter: userData?.tattooCharacter,
          candleType: userData?.candleType,
          baseColor: userData?.baseColor,
        });
        
        // Build metadata based on devotion type
        const metadata = {
          username: userData?.username,
          createdBy: userData?.createdBy,  // Add Clerk user ID
          devotionType: userData?.devotionType,
          background: userData?.background,
          burnedAmount: userData?.burnedAmount,
        };
        
        // Add type-specific fields
        if (userData?.devotionType === 'tattoo') {
          metadata.tattooDesign = userData?.tattooDesign;
          metadata.tattooCharacter = userData?.tattooCharacter;
          metadata.selectedPose = userData?.selectedPose || '';
        } else {
          metadata.candleType = userData?.candleType;
          metadata.baseColor = userData?.baseColor;
        }
        
        const response = await fetch('/api/upload-polaroid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: imageData,
            metadata: metadata,
          }),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
          console.error('[CandleSnapshotRenderer] Upload failed:', result);
          if (onFirebaseUploadComplete) {
            onFirebaseUploadComplete({ success: false, ...result });
          }
        } else if (onFirebaseUploadComplete) {
          console.log('[CandleSnapshotRenderer] Upload succeeded:', result);
          onFirebaseUploadComplete(result);
        }
      } catch (error) {
        console.error('[CandleSnapshotRenderer] Firebase upload error:', error);
        if (onFirebaseUploadComplete) {
          onFirebaseUploadComplete({ success: false, error: error.message });
        }
      }
    } else if (saveToFirebase && imageData && hasUploadedRef.current) {
      console.log(`[CandleSnapshotRenderer-${renderInstanceId.current}] Skipping duplicate Firebase upload`);
    }
  };
  
  if (!isVisible) return null;
  
  return (
    <>
      {showLoading && isVisible && (
        <>
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 99997,
            animation: 'fadeIn 0.3s ease',
          }} />
          
          <div style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 99998,
            background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(0, 20, 0, 0.9) 100%)',
            padding: '40px 50px',
            borderRadius: '20px',
            border: '2px solid rgba(0, 255, 0, 0.3)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 120px rgba(0, 255, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '25px',
            animation: 'slideUp 0.4s ease',
            minWidth: '320px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '48px', animation: 'bounce 1s ease infinite' }}>
                {userData?.devotionType === 'tattoo' ? '🎨' : '🕯️'}
              </div>
              <h2 style={{
                color: '#00ff00',
                fontSize: '24px',
                fontWeight: 'bold',
                margin: 0,
                textAlign: 'center',
                textShadow: '0 0 20px rgba(0, 255, 0, 0.5)'
              }}>
                Your message to RL80 has been created! ✨
              </h2>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{
                width: '24px', height: '24px',
                borderRadius: '50%',
                background: 'conic-gradient(from 0deg, transparent, #00ff00)',
                animation: 'spin 1s linear infinite',
                boxShadow: '0 0 20px rgba(0, 255, 0, 0.5)'
              }} />
              <div style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '16px' }}>
                {loadingMessage}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: '8px', height: '8px',
                  borderRadius: '50%',
                  background: 'rgba(0, 255, 0, 0.5)',
                  animation: `pulse 1.5s ease infinite ${i * 0.3}s`
                }} />
              ))}
            </div>
          </div>
          
          <style jsx>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { opacity: 0; transform: translate(-50%, -40%); } to { opacity: 1; transform: translate(-50%, -50%); } }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
            @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 1; transform: scale(1.2); } }
          `}</style>
        </>
      )}
      
      <div
        id="candle-snapshot-container"
        style={{
          position: 'fixed',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px', height: '600px',
          opacity: 0.01,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        <Canvas 
          ref={canvasRef} 
          camera={{ 
            position: userData?.devotionType === 'tattoo' ? [0, 2, 6] : [0, -1.7, 5], 
            fov: 40 
          }}
          gl={{ alpha: true, preserveDrawingBuffer: true }}
        >
          {/* Only set black background if NOT a tattoo devotion with background */}
          {!(userData?.devotionType === 'tattoo' && userData?.background) && (
            <color attach="background" args={['#000000']} />
          )}
          <CandleScene userData={userData} onReady={handleSceneReady} />
        </Canvas>
      </div>
      
      {!preloadOnly && (
        <PolaroidSnapshot 
          trigger={triggerSnapshot}
          onComplete={handleSnapshotComplete}
          captureElementId="candle-snapshot-container"
          label={userData?.burnedAmount ? `Burned ${parseInt(userData.burnedAmount).toLocaleString()} RL80 tokens!` : `${userData?.username || 'Anonymous'}'s Candle`}
          backgroundImage={userData?.background && SKYBOX_TEXTURES[userData.background] ? SKYBOX_TEXTURES[userData.background] : null}
          key={`polaroid-${userData?.background || 'none'}-${triggerSnapshot}`} // Force new instance when background changes
        />
      )}
    </>
  );
}