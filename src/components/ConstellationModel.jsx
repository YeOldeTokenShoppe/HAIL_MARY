import React, { useRef, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";

// Preload the models
useGLTF.preload("/models/marketFight.glb");
useGLTF.preload("/models/whale.glb");
useGLTF.preload("/models/arrow.glb");
// useGLTF.preload("/InfinityStars.glb");

function ConstellationModel({ 
  isVisible = true, 
  groupScale = [1, 1, 1], // Default scale if not provided
  groupPosition = [0, 0, 0], // Default position if not provided
  groupRotation = [0, 0, 0] // Default rotation if not provided
}) {
  const { camera } = useThree();
  const { scene: marketScene } = useGLTF("/models/marketFight.glb");
  const { scene: whaleScene } = useGLTF("/models/whale.glb");
  const { scene: arrowScene } = useGLTF("/models/arrow.glb");
  // const { scene: infinityStarsScene } = useGLTF("/InfinityStars.glb");
  const groupRef = useRef();
  const whaleModelRef = useRef();

  useEffect(() => {
    if (!marketScene || !whaleScene || !groupRef.current) return;

    // Clear previous models if any, before adding new ones
    while (groupRef.current.children.length > 0) {
      groupRef.current.remove(groupRef.current.children[0]);
    }

    const marketClone = marketScene.clone();
    const whaleClone = whaleScene.clone();
    const arrowClone = arrowScene.clone();
    // const infinityStarsClone = infinityStarsScene.clone();

    const processModel = (modelScene, namePrefix = "", position = [0, 0, 0], scale = [1, 1, 1]) => {
      // First pass: Mark all meshes with their parent model
      modelScene.traverse(child => {
        if (child.isMesh) {
          if (modelScene === whaleClone) {
            child.userData.isWhaleModel = true;
            // Check if this is a star or line mesh
            if (child.name.toLowerCase().includes("star") || 
                child.name.startsWith("RedStar") || 
                child.name.startsWith("GreenStar")) {
              child.userData.isWhaleStar = true;
            } else {
              child.userData.isWhaleLine = true;
            }
          } else if (modelScene === arrowClone) {
            child.userData.isArrowModel = true;
            // Check if this is a star or line mesh
            if (child.name.toLowerCase().includes("star") || 
                child.name.startsWith("RedStar") || 
                child.name.startsWith("GreenStar")) {
              child.userData.isArrowStar = true;
            } else {
              child.userData.isArrowLine = true;
            }
          }
        }
      });
      
      modelScene.traverse(child => {
        if (
          child.isMesh &&
          (child.name.startsWith("RedStar") || child.name.startsWith("GreenStar") || child.userData.isWhaleStar || child.userData.isArrowStar)
        ) {
          child.visible = true;
          if (child.material) {
            child.material.transparent = true;
            if (modelScene === whaleClone || child.userData.isWhaleStar) {
              child.material.opacity = 0.05;
            } else if (modelScene === marketClone) {
              child.userData.isBearStar = true;
              child.material.opacity = 0.05;
            } else if (modelScene === arrowClone || child.userData.isArrowStar) {
              child.material.opacity = 0.05;
            } else {
              child.material.opacity = 0.01;
            }
          }
        // }
        // if (child.isMesh && child.name.startsWith("Infinity")) {
        //   child.visible = true;
        //   if (child.material) {
        //     child.material.transparent = true;
        //     child.material.opacity = isVisible ? 0.3 : 0;
        //   }
        }
      });
      modelScene.traverse(child => {
        if (
          child.isMesh &&
          !child.name.startsWith("RedStar") &&
          !child.name.startsWith("GreenStar") &&
          // !child.name.startsWith("Infinity") &&
          !child.userData.isWhaleStar &&
          !child.userData.isBearStar &&
          !child.userData.isArrowStar
        ) {
          child.castShadow = false;
          child.receiveShadow = false;
          child.renderOrder = -1; 
          
          // For whale and arrow lines, handle visibility differently
          if (child.userData.isWhaleLine || child.userData.isArrowLine) {
            child.visible = true; // Keep in scene graph
            if (child.material) {
              child.material.transparent = true;
              if (child.userData.isArrowLine) {
                child.material.opacity = isVisible ? 0.05 : 0; // Control via opacity for arrow lines
              } else {
                child.material.opacity = isVisible ? 0.05 : 0; // Control via opacity for whale lines
              }
            }
          } else {
            child.visible = isVisible;
            if (child.material) {
              child.material.transparent = true;
              if (child.name.startsWith("Bear")) {
                child.material.opacity = isVisible ? 0.05 : 0;
              // } else if (modelScene === starCandlesClone) {
              //   child.material.opacity = isVisible ? 0.1 : 0;
              } else if (modelScene === whaleClone) {
                child.material.opacity = isVisible ? 0.05 : 0;
              } else if (modelScene === arrowClone) {
                child.material.opacity = isVisible ? 0.05 : 0;
              } else {
                child.material.opacity = isVisible ? 0.02 : 0;
              }
            }
          }
        }
      });
      modelScene.position.set(...position);
      modelScene.scale.set(...scale);
      groupRef.current.add(modelScene);
    };

    // Keep internal model positions and scales as they are, 
    // the main group's scale and position will adjust them globally.
    processModel(marketClone, "Market", [3, 0, 0], [1, 1, 1]);
    processModel(whaleClone, "Whale", [-9, 0.5, 7], [0.3, 0.3, 0.3]);
    // processModel(starCandlesClone, "StarCandles", [-15, -2, 30], [1.8 , 1.8, 1.8]);
    processModel(arrowClone, "ArrowStar", [-2, 1, 25], [1, 1, 1]);

    whaleModelRef.current = whaleClone;
    whaleClone.rotation.y = Math.PI / 4;
    whaleClone.rotation.x = Math.PI / 12;
    arrowClone.rotation.y = Math.PI; // Flip 180 degrees to point right
    arrowClone.rotation.z = Math.PI / -12;
    marketClone.rotation.y = Math.PI * 0.75;

    // Apply the new groupScale and groupPosition props
    groupRef.current.position.set(...groupPosition);
    groupRef.current.scale.set(...groupScale);
    groupRef.current.rotation.set(...groupRotation);
    
    // Ensure constellation renders behind other objects but in front of stars
    groupRef.current.renderOrder = -500;

    return () => {
      [marketClone, whaleClone, arrowClone].forEach(scene => {
        if (groupRef.current && groupRef.current.children.includes(scene)) {
          groupRef.current.remove(scene);
        }
        scene.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
      });
    };
  }, [marketScene, whaleScene, arrowScene, isVisible, groupScale, groupPosition, groupRotation]); // Added groupScale, groupPosition and groupRotation to dependencies

  // Update visibility and opacity based on isVisible prop
  useEffect(() => {
    if (!groupRef.current) return;

    groupRef.current.traverse(child => {
      if (child.isMesh) {
        if (child.name.startsWith("RedStar") || child.name.startsWith("GreenStar") || child.userData.isWhaleStar || child.userData.isBearStar || child.userData.isArrowStar) {
          child.visible = true; // Stars always visible in terms of object visibility
          if (child.material) {
            child.material.transparent = true;
            // Reduce star opacity when lines are hidden
            if (child.userData.isWhaleStar) {
              child.material.opacity = isVisible ? 0.06 : 0.02; // Dim whale stars when lines off
            } else if (child.userData.isBearStar) {
              child.material.opacity = isVisible ? 0.06 : 0.02; // Dim bear stars when lines off
            } else if (child.userData.isArrowStar) {
              child.material.opacity = isVisible ? 0.06 : 0.02; // Dim arrow stars when lines off
            } else {
              child.material.opacity = isVisible ? 0.1 : 0.05; // Dim other stars when lines off
            }
          }
        } else { // For all other meshes (parts of constellations)
          // Special handling for whale and arrow lines
          if (child.userData.isWhaleLine || child.userData.isArrowLine) {
            child.visible = true; // Keep in scene graph
            if (child.material) {
              child.material.transparent = true;
              if (child.userData.isArrowLine) {
                child.material.opacity = isVisible ? 0.05 : 0; // Control via opacity for arrow lines
              } else {
                child.material.opacity = isVisible ? 0.1 : 0; // Control via opacity for whale lines  
              }
            }
          } else {
            child.visible = isVisible;
            if (child.material) {
              child.material.transparent = true;
              // Set opacity based on isVisible for non-star/non-line meshes
              if (child.name.startsWith("Bear")) {
                child.material.opacity = isVisible ? 0.09 : 0;
              // } else if (child.parent?.name.includes("StarCandles")) { // Check parent for StarCandles context
              //   child.material.opacity = isVisible ? 0.03 : 0;
              } else if (child.parent?.name.includes("Whale") || child.userData.isWhaleModel) { // Check parent for Whale context
                child.material.opacity = isVisible ? 0.07 : 0; // was 0.1
              } else if (child.parent?.name.includes("ArrowStar") || child.userData.isArrowModel) { // Check parent for Arrow context
                child.material.opacity = isVisible ? 0.05 : 0;
              } else {
                child.material.opacity = isVisible ? 0.03 : 0; // was 0.1
              }
            }
          }
        }
      }
    });
  }, [isVisible]);

  // The third useEffect that was forcing stars visible and running requestAnimationFrame 
  // seemed overly complex and potentially conflicting with the main visibility logic.
  // The main useEffect for model setup and the useEffect for isVisible updates should be sufficient.
  // Removing it for simplification. If star visibility issues persist, we can revisit a targeted approach.

  return <group ref={groupRef} name="ConstellationModelGroup" />;
}

export default ConstellationModel;
