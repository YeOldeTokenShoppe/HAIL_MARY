import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";

// Create stars distributed on a sphere far from the camera
const getRandomParticlePos = (particleCount, radius = 200) => {
  const arr = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const colors = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i += 3) {
    // Regular random distribution on sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    arr[i] = x;
    arr[i + 1] = y;
    arr[i + 2] = z;

    // Determine star type and size
    const rand = Math.random();
    let isConstellationStar = false;
    let sizeMultiplier;

    // Small percentage of very bright stars (3%)
    if (rand < 0.1) {
      isConstellationStar = true;
      sizeMultiplier = Math.random() * 2.0 + 2.0; // Large stars
    }
    // Medium stars (17%)
    else if (rand < 0.1) {
      sizeMultiplier = Math.random() * 0.5 + 0.1; // Medium stars
    }
    // Small stars (80%)
    else {
      sizeMultiplier = Math.random() * 0.0005 + 0.0001; // Small stars
    }

    sizes[i / 3] = sizeMultiplier;

    // Add color variation
    let colorVariation = Math.random() * 0.2;
    if (isConstellationStar) {
      // Give large stars color variations
      const colorType = Math.random();
      if (colorType < 0.4) {
        // Blue-white stars
        colors[i] = 0.9 + colorVariation * 0.1; // R (slightly less)
        colors[i + 1] = 0.95 + colorVariation * 0.05; // G (slightly less)
        colors[i + 2] = 1.0; // B (max blue)
      } else if (colorType < 0.7) {
        // Yellow-orange stars
        colors[i] = 1.0; // R (max red)
        colors[i + 1] = 0.9 + colorVariation * 0.1; // G (high)
        colors[i + 2] = 0.7 * colorVariation; // B (low)
      } else {
        // Slightly reddish stars
        colors[i] = 1.0; // R (max red)
        colors[i + 1] = 0.8 * colorVariation; // G (lower)
        colors[i + 2] = 0.8 * colorVariation; // B (lower)
      }
    } else {
      // Regular stars
      colors[i] = 1.0; // R
      colors[i + 1] = 0.9 + colorVariation; // G
      colors[i + 2] = 0.9 + colorVariation; // B
    }
  }
  return { positions: arr, sizes, colors };
};

const StarField = ({ count1 = 250, count2 = 150, is80sMode = false, radius = 200 }) => {
  const starsGroup = useRef();
  const smallStars = useRef();
  const largeStars = useRef();
  const { camera } = useThree();

  // Load textures with absolute URLs
  const [starTextures, setStarTextures] = useState([]);
  
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    // Load textures with proper error handling
    Promise.all([
      new Promise((resolve) => {
        loader.load(
          "/sp1.png",
          (texture) => resolve(texture),
          undefined,
          () => resolve(null) // Return null if texture fails to load
        );
      }),
      new Promise((resolve) => {
        loader.load(
          "/sp2.png",
          (texture) => resolve(texture),
          undefined,
          () => resolve(null) // Return null if texture fails to load
        );
      })
    ]).then((textures) => {
      setStarTextures(textures);
    });
  }, []);

  // Create the geometry on component mount
  const [geometry1] = useState(() => {
    const geo = new THREE.BufferGeometry();
    const { positions, sizes, colors } = getRandomParticlePos(count1, radius);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  });

  const [geometry2] = useState(() => {
    const geo = new THREE.BufferGeometry();
    const { positions, sizes, colors } = getRandomParticlePos(count2, radius * 1.1);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  });

  // Define materials without textures initially
  const starMaterial1 = useRef(
    new THREE.PointsMaterial({
      size: 0.7,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
      vertexColors: true,
      color: is80sMode ? new THREE.Color(0x88ccff) : new THREE.Color(0xffffff),
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      // Don't set map initially - will be set when textures load
    })
  );

  const starMaterial2 = useRef(
    new THREE.PointsMaterial({
      size: 1.0,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
      vertexColors: true,
      color: is80sMode ? new THREE.Color(0xff88ff) : new THREE.Color(0xffffff),
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      // Don't set map initially - will be set when textures load
    })
  );
  
  // Update materials when textures are loaded
  useEffect(() => {
    if (starTextures.length === 2) {
      if (starTextures[0] && starMaterial1.current) {
        starMaterial1.current.map = starTextures[0];
        starMaterial1.current.needsUpdate = true;
      }
      if (starTextures[1] && starMaterial2.current) {
        starMaterial2.current.map = starTextures[1];
        starMaterial2.current.needsUpdate = true;
      }
    }
  }, [starTextures]);

  // Update star colors when 80s mode changes
  useEffect(() => {
    starMaterial1.current.color.set(is80sMode ? 0x88ccff : 0xffffff);
    starMaterial2.current.color.set(is80sMode ? 0xff88ff : 0xffffff);
  }, [is80sMode]);

  // Ensure stars render properly behind other objects
  useEffect(() => {
    if (!starsGroup.current) return;
    
    // Set render order for the entire group to ensure it renders first (behind everything)
    starsGroup.current.renderOrder = -1000;
    
    return () => {};
  }, []);

  // Move stars with camera and apply mouse influence
  useFrame((state) => {
    if (starsGroup.current) {
      // Position stars far behind camera
      starsGroup.current.position.copy(camera.position);

      // Keep twinkling effect by modifying size
      const time = state.clock.getElapsedTime();

      // Twinkle small stars
      const smallStarSizes = geometry1.attributes.size.array;
      for (let i = 0; i < smallStarSizes.length; i++) {
        const originalSize = smallStarSizes[i];

        // Reduce twinkling for very large "constellation" stars
        const twinkleFactor = originalSize > 3.0 ? 0.05 : 0.15;

        // Use different frequencies for more varied twinkling
        const twinkle =
          Math.sin(time * (1 + Math.sin(i) * 0.5) + i * 1000) * twinkleFactor +
          1;
        geometry1.attributes.size.array[i] = originalSize * twinkle;
      }
      geometry1.attributes.size.needsUpdate = true;

      // Twinkle large stars (less frequently)
      const largeStarSizes = geometry2.attributes.size.array;
      for (let i = 0; i < largeStarSizes.length; i++) {
        const originalSize = largeStarSizes[i];

        // Reduce twinkling for very large "constellation" stars
        const twinkleFactor = originalSize > 3.0 ? 0.02 : 0.1;

        // Use different frequencies for more varied twinkling
        const twinkle =
          Math.sin(time * (0.5 + Math.cos(i) * 0.3) + i * 1000) *
            twinkleFactor +
          1;
        geometry2.attributes.size.array[i] = originalSize * twinkle;
      }
      geometry2.attributes.size.needsUpdate = true;
    }
  });

  return (
    <group ref={starsGroup}>
      <points
        ref={smallStars}
        geometry={geometry1}
        material={starMaterial1.current}
        frustumCulled={false}
      />
      <points
        ref={largeStars}
        geometry={geometry2}
        material={starMaterial2.current}
        frustumCulled={false}
      />
    </group>
  );
};

export default StarField;
