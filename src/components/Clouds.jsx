import React, {
  useRef,
  useState,
  useEffect,
} from "react";
import { Cloud, Clouds } from "@react-three/drei";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import dynamic from "next/dynamic";
// import { useControls } from "leva"; // Uncomment for GUI controls

// Create context for sharing lightning effects

// Hemisphere Light without Helper
function HemisphereLightComponent() {
  // GUI Controls (commented out - uncomment to adjust lighting)
  // const cloudHemisphereLightControls = useControls('Cloud Hemisphere Light', {
  //   skyColor: {
  //     value: "#f5f5f5",
  //   },
  //   groundColor: {
  //     value: "#f2950b",
  //   },
  //   intensity: {
  //     value: 1.5,
  //     min: 0,
  //     max: 5,
  //     step: 0.1,
  //   },
  //   position: {
  //     value: [0, -20, -5],
  //     step: 0.1,
  //   },
  // });
  
  // Hard-coded values
  const lightingValues = {
    skyColor: "#f5f5f5",
    groundColor: "#f2950b",
    intensity: 1.5,
    position: [0, -20, -5],
  };
  
  return (
    <hemisphereLight 
      skyColor={lightingValues.skyColor} 
      groundColor={lightingValues.groundColor} 
      intensity={lightingValues.intensity} 
      position={lightingValues.position}
    />
  );
}

// Define the component first
const DarkCloudsComponent = React.forwardRef(({ onLoad, ...props }, ref) => {
  // Load texture only on client side
  const [cloudTexture, setCloudTexture] = useState(null);
  
  // Hardcode pink color for all clouds
  const whiteCloudColor = "#fbf6fc";
  const pinkCloudColor = "#e61c9c";

  // Call onLoad immediately since we're not loading textures
  useEffect(() => {
    if (onLoad) {
      onLoad();
    }
  }, [onLoad]);

  // useEffect(() => {
  //   // Only load texture on client side
  //   const loader = new THREE.TextureLoader();
  //   loader.load("/cloud.png", (texture) => {
  //     setCloudTexture(texture);
  //     // Notify that clouds are ready
  //     if (onLoad) {
  //       // console.log('[DarkClouds] Texture loaded, clouds ready');
  //       onLoad();
  //     }
  //   });
  // }, [onLoad]);

  // const shake = shakeRef || useRef(); // Use passed shakeRef or create local one

  // Create multiple independent flash generators for distributed lightning
  // const [flash1] = useState(
  //   () =>
  //     new random.FlashGen({
  //       count: 6,
  //       minDuration: 40,
  //       maxDuration: 200,
  //     })
  // );

  // const [flash2] = useState(
  //   () =>
  //     new random.FlashGen({
  //       count: 4,
  //       minDuration: 60,
  //       maxDuration: 180,
  //     })
  // );

  // const [flash3] = useState(
  //   () =>
  //     new random.FlashGen({
  //       count: 5,
  //       minDuration: 50,
  //       maxDuration: 150,
  //     })
  // );

  // Refs for cloud groups
  const cloudsGroupRef = useRef();
  const cloud0 = useRef();
  const cloud1 = useRef();
  const cloud2 = useRef();
  const cloud3 = useRef();
  const cloud4 = useRef();
  const cloud5 = useRef();
  
  // Disable shadows on all cloud meshes after mount
  useEffect(() => {
    if (cloudsGroupRef.current) {
      cloudsGroupRef.current.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });
    }
  }, [cloudTexture]); // Run when texture loads
  
  // Target ref for spotlights
  // const targetRef = useRef();
  
  // Sun mesh ref for god rays
  // const sunRef = useRef();

  // Multiple lightning sources for more dramatic effect

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;



    // More dynamic rotation for the entire cloud group
    if (cloudsGroupRef.current) {
      cloudsGroupRef.current.rotation.y = Math.cos(time / 4) / 20;
      cloudsGroupRef.current.rotation.x = Math.sin(time / 4) / 30;
    }

    // Individual cloud movements - rotation and drift
    if (cloud0.current) {
      cloud0.current.rotation.y -= delta * 0.02;
      cloud0.current.position.x = Math.sin(time * 0.1) * 2;
      cloud0.current.position.y = -11 + Math.cos(time * 0.15) * 1;
    }
    
    if (cloud1.current) {
      cloud1.current.rotation.y += delta * 0.015;
      cloud1.current.position.x = 30 + Math.cos(time * 0.12) * 3;
      cloud1.current.position.y = -15 + Math.sin(time * 0.1) * 1.5;
    }
    
    if (cloud2.current) {
      cloud2.current.rotation.y -= delta * 0.018;
      cloud2.current.position.x = -30 + Math.sin(time * 0.08) * 2.5;
      cloud2.current.position.y = -12 + Math.cos(time * 0.12) * 1.2;
    }
    
    if (cloud3.current) {
      cloud3.current.rotation.y += delta * 0.012;
      cloud3.current.position.z = -20 + Math.sin(time * 0.09) * 2;
      cloud3.current.position.y = -30 + Math.cos(time * 0.11) * 1;
    }
    
    if (cloud4.current) {
      cloud4.current.rotation.y -= delta * 0.014;
      cloud4.current.position.x = 10 + Math.cos(time * 0.13) * 2;
      cloud4.current.position.z = 15 + Math.sin(time * 0.1) * 1.5;
    }
    
    if (cloud5.current) {
      cloud5.current.rotation.y += delta * 0.01;
      // Larger, slower movement for background cloud
      cloud5.current.position.x = Math.sin(time * 0.05) * 5;
      cloud5.current.position.z = -30 + Math.cos(time * 0.06) * 3;
    }

    // Apply emissive glow based on lightning (only when active)
  });

  // Manually trigger lightning bursts randomly with different probabilities

  // Expose sun ref for god rays
  // React.useImperativeHandle(ref, () => ({
  //   sunRef: sunRef
  // }), []);

  return (
    // <lightningContext.Provider value={{ flash1, flash2, flash3, shake, sunRef }}>
      <group>
        
        {/* Sun mesh for god rays - positioned high above */}
        {/* <mesh ref={sunRef} position={[0, 80, -30]}>
          <sphereGeometry args={[5, 32, 32]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0} />
        </mesh> */}
        
        
        {/* Directional light from sun position */}
        {/* <directionalLight
          position={[0, 80, -30]}
          intensity={3}
          color="#ffeecc"
          castShadow
        /> */}
        
        {/* Hemisphere light from below for sunset glow on cloud undersides */}

        
        {/* Multiple lightning sources for dramatic effect */}
        {/* <pointLight
          ref={lightningRef1}
          color="#a0c8ff" // Blue tint
          intensity={0}
          distance={500}
          decay={1.5}
          position={[0, 0, 0]}
        />
        <pointLight
          ref={lightningRef2}
          color="#d1e6ff" // Lighter blue tint
          intensity={0}
          distance={450}
          decay={2}
          position={[-50, -2, -10]}
        />
        <pointLight
          ref={lightningRef3}
          color="#f5f9ff" // Almost white with slight blue
          intensity={0}
          distance={550}
          decay={1.8}
          position={[40, 3, 8]}
        /> */}
         {/* <pointLight position={[0, 0, 0.5]} color="blue" /> */}

        {/* {cloudTexture ? ( */}
          <group ref={cloudsGroupRef} frustumCulled={false}>
            {/* Hemisphere Light with Helper for Clouds */}
  <HemisphereLightComponent />

            <Clouds material={THREE.MeshStandardMaterial} limit={400} frustumCulled={false} receiveShadow={false} castShadow={false}>
              {/* Main large white cloud  that is DIRECTLY under the bull */}
              <Cloud 
                ref={cloud0}
                receiveShadow={false}
                castShadow={false}
                seed={1}
                segments={10}
                volume={25}
                opacity={0.9}
                fade={1}
                growth={0}
                speed={0.00}
                bounds={[15, 2, 2]}
                // color={whiteCloudColor}
                position={[-40, -110, 0]}
                texture={cloudTexture}
                frustumCulled={false}
              />
  {/* <Cloud
    seed={99}  // Different seed for different shape
    segments={20}  // More segments for visibility
    volume={50}  // Much larger
    opacity={1.0}  // Full opacity
    fade={1}
    growth={10}  // Bigger growth
    speed={0.00}
    bounds={[30, 40, 30]}  // Much larger bounds
    color={'#ff00f0'}
    position={[0, -270, 10]}  // Centered, higher up, forward
    texture={cloudTexture}  // No texture to ensure color shows
    frustumCulled={false}
  /> */}
                           
             
 
          
              {/* Large white cloud to the right - mid level */}
              <Cloud 
                ref={cloud1}
                seed={2}
                segments={8}
                volume={25}
                opacity={0.8}
                fade={1}
                growth={6}
                speed={0.03}
                bounds={[15, 8, 6]}

                position={[30, -25, 0]}
                texture={cloudTexture}
              />
              
              {/* Large white cloud to the left - high level */}
              <Cloud 
                ref={cloud2}
                seed={3}
                segments={12}
                volume={10}
                opacity={0.8}
                fade={1}
                growth={6}
                speed={0.03}
                bounds={[-10, 0, 6]}
                // color={whiteCloudColor}
                position={[-40, 10, 0]}
                texture={cloudTexture}
                
              /> 
              
              {/* Background large cloud - mid-high level */}
              <Cloud 
                ref={cloud3}
                seed={14}
                segments={25}
                volume={25}
                opacity={0.6}
                fade={1}    
                growth={5}
                speed={0.02}
                bounds={[14, 15, 5]}

                position={[0, -8, -20]}
                texture={cloudTexture}
                frustumCulled={false}
              />
              
              {/* Front large cloud - low-mid level */}
              <Cloud 
                ref={cloud4}
                seed={5}
                segments={14}
                volume={20}
                opacity={0.7}
                fade={1}
                growth={5}
                speed={0.025}
                bounds={[14, 1, 5]}
                // color={whiteCloudColor}
                position={[60, -60, 15]}
                texture={cloudTexture}
                frustumCulled={false}
              />
              
              {/* Additional vertical clouds for cumulus effect */}
              <Cloud 
                seed={6}
                segments={10}
                volume={18}
                opacity={0.75}
                fade={1}
                growth={5}
                speed={0.025}
                bounds={[12, 10, 5]}

                position={[-20, -40, 10]}
                texture={cloudTexture}
                frustumCulled={false}
              />
              
              {/* <Cloud 
                seed={7}
                segments={12}
                volume={22}
                opacity={0.7}
                fade={1}
                growth={6}
                speed={0.02}
                bounds={[15, 12, 6]}
                 color={'#ff00f0'}
                position={[45, -10, -10]}
                texture={cloudTexture}
                frustumCulled={false}
              /> */}
              
              {/* <Cloud 
                seed={8}
                segments={8}
                volume={16}
                opacity={0.65}
                fade={1}
                growth={4}
                speed={0.03}
                bounds={[10, 8, 5]}
                color={'#ff00f0'}
                position={[-50, -70, 5]}
                texture={cloudTexture}
                frustumCulled={false}
              /> */}
              
              <Cloud 
                seed={9}
                segments={10}
                volume={20}
                opacity={0.8}
                fade={1}
                growth={5}
                speed={0.025}
                bounds={[14, 15, 7]}
     
                position={[20, 5, 20]}
                texture={cloudTexture}
                frustumCulled={false}
              />
              {/* <Cloud 
                seed={10}
                segments={9}
                volume={14}
                opacity={0.6}
                fade={1}
                growth={4}
                speed={0.035}
                bounds={[12, 10, 5]}
                              color={'#ff00f0'}
                position={[-35, -50, -15]}
                texture={cloudTexture}
                frustumCulled={false}
              /> */}
              
              <Cloud 
                seed={11}
                segments={11}
                volume={25}
                opacity={0.75}
                fade={1}
                growth={6}
                speed={0.02}
                bounds={[16, 18, 8]}
                // color={whiteCloudColor}
                position={[35, -35, -25]}
                texture={cloudTexture}
                frustumCulled={false}
              />
              
              {/* Tall vertical cloud formations */}
              {/* <Cloud 
                seed={12}
                segments={14}
                volume={18}
                opacity={0.7}
                fade={1}
                growth={5}
                speed={0.025}
                bounds={[18, 25, 6]}
                // color={whiteCloudColor}
                position={[5, -10, 0]}
                texture={cloudTexture}
                frustumCulled={false}
              /> */}
              
              <Cloud 
                seed={13}
                segments={12}
                volume={16}
                opacity={0.65}
                fade={1}
                growth={4}
                speed={0.03}
                bounds={[7, 20, 5]}
                // color={whiteCloudColor}
                position={[-25, -15, 12]}
                texture={cloudTexture}
                frustumCulled={false}
              />
              
              {/* Large background cloud - highest level */}
              <Cloud 
                ref={cloud5}
                concentrate="outside"
                growth={8}
                color={whiteCloudColor}
                opacity={0.3}
                seed={0.3}
                 bounds={[17, 30, 5]}
                volume={20}
                segments={6}
                fade={8}
                speed={0.015}
                position={[30, 10, -20]}
                // texture={cloudTexture}
                frustumCulled={false}
              />
              
              {/* New lower clouds for extended page content */}
              <Cloud 
                seed={15}
                segments={10}
                volume={22}
                opacity={0.75}
                fade={1}
                growth={5}
                speed={0.02}
                bounds={[16, 8, 6]}
                position={[-15, -75, 5]}
                texture={cloudTexture}
                frustumCulled={false}
              />
              
              <Cloud 
                seed={16}
                segments={18}
                volume={38}
                opacity={0.7}
                fade={1}
                growth={4}
                speed={0.025}
                bounds={[-5, 10, 9]}
                position={[-15, -110, -25]}
                        //  color={'#ff00f0'}
                frustumCulled={false}
              />
              */above cloud is where the drone starts to appear /*
              
              <Cloud 
                seed={17}
                segments={12}
                volume={30}
                opacity={0.65}
                fade={1}
                growth={6}
                speed={0.015}
                bounds={[18, 10, -6]}
                position={[20, -160, -20]}
        
                frustumCulled={false}
              />
              
              {/* <Cloud 
                seed={18}
                segments={9}
                volume={16}
                opacity={0.8}
                fade={1}
                growth={5}
                speed={0.03}
                bounds={[17, 6, -5]}
                position={[-32, -170, -28]}
                color={'#ff00f0'}
                frustumCulled={false}
              /> */}
              
              {/* <Cloud 
                seed={19}
                segments={11}
                volume={24}
                opacity={0.7}
                fade={1}
                growth={6}
                speed={0.02}
                bounds={[20, 12, 7]}
                position={[50, -180, -10]}
              color={'#ff00f0'}
                frustumCulled={false}
              /> */}
              
              <Cloud 
                seed={20}
                segments={10}
                volume={19}
                opacity={0.75}
                fade={1}
                growth={5}
                speed={0.025}
                bounds={[15, 9, 6]}
                position={[-35, -190, 8]}
            // color={'#ff00f0'}
                frustumCulled={false}
              />
              
              {/* Additional clouds for extended page */}
              <Cloud 
                seed={21}
                segments={14}
                volume={26}
                opacity={0.8}
                fade={1}
                growth={6}
                speed={0.02}
                bounds={[22, 14, 8]}
                position={[25, -120, -18]}
                      // color={'#ff00f0'}
                frustumCulled={false}
              />
              
              <Cloud 
                seed={22}
                segments={12}
                volume={20}
                opacity={0.75}
                fade={1}
                growth={5}
                speed={0.025}
                bounds={[16, 10, 6]}
                position={[-45, -140, -8]}
                //  color={'#ff00f0'}
                frustumCulled={false}
              />
              
              <Cloud 
                seed={23}
                segments={20}
                volume={32}
                opacity={0.7}
                fade={1}
                growth={5}
                speed={0.03}
                bounds={[25, 12, 7]}
                position={[15, -200, -22]}

                frustumCulled={false}
              />
              
              <Cloud 
                seed={24}
                segments={8}
                volume={28}
                opacity={0.65}
                fade={1}
                growth={4}
                speed={0.02}
                bounds={[14, 8, 5]}
                position={[-10, -250, 0]}
                // color={'#ff00f0'}
                frustumCulled={false}
              />
              
              <Cloud 
                seed={25}
                segments={11}
                volume={24}
                opacity={0.8}
                fade={1}
                growth={6}
                speed={0.025}
                bounds={[20, 15, 8]}
                position={[30, -320, -15]}
            // color={'#ff00f0'}
                frustumCulled={false}
              />
              
              {/* Even more clouds for extended page */}
              <Cloud 
                seed={26}
                segments={9}
                volume={20}
                opacity={0.75}
                fade={1}
                growth={5}
                speed={0.02}
                bounds={[16, 12, 6]}
                position={[2, -420, 8]}
                //  color={'#ff00f0'}
                frustumCulled={false}
              />
              
              {/* <Cloud 
                seed={27}
                segments={13}
                volume={24}
                opacity={0.7}
                fade={1}
                growth={6}
                speed={0.025}
                bounds={[18, 14, 7]}
                position={[20, -390, 5]}
          color={'#ff00f0'}
                frustumCulled={false}
              /> */}
              
              {/* <Cloud 
                seed={28}
                segments={10}
                volume={18}
                opacity={0.8}
                fade={1}
                growth={4}
                speed={0.03}
                bounds={[14, 10, 5]}
                position={[5, -400, 10]}
                      color={'#ff00f0'}
                frustumCulled={false}
              /> */}
              
              {/* <Cloud 
                seed={29}
                segments={12}
                volume={22}
                opacity={0.65}
                fade={1}
                growth={5}
                speed={0.02}
                bounds={[20, 12, 8]}
                position={[25, -500, 0]}
            color={'#ff00f0'}
                frustumCulled={false}
              /> */}
              
              {/* Additional clouds for 50% longer page */}
              <Cloud 
                seed={30}
                segments={24}
                volume={25}
                opacity={0.75}
                fade={1}
                growth={6}
                speed={0.025}
                bounds={[22, 15, 8]}
                position={[-5, -290, 12]}
              // color={'#ff00f0'}
                frustumCulled={false}
              />
              */ bottom cloud /*

                            <Cloud 
                seed={30}
                segments={24}
                volume={25}
                opacity={0.75}
                fade={1}
                growth={6}
                speed={0.025}
                bounds={[22, 15, 8]}
                position={[-5, -380, 12]}
              // color={'#ff00f0'}
                frustumCulled={false}
              />
              
              {/* <Cloud 
                seed={31}
                segments={10}
                volume={20}
                opacity={0.7}
                fade={1}
                growth={5}
                speed={0.02}
                bounds={[18, 12, 6]}
                position={[35, -600, -8]}
                texture={cloudTexture}
                frustumCulled={false}
              /> */}
              
              {/* <Cloud 
                seed={32}
                segments={12}
                volume={23}
                opacity={0.8}
                fade={1}
                growth={5}
                speed={0.03}
                bounds={[20, 14, 7]}
                position={[-25, -650, 5]}
                texture={cloudTexture}
                frustumCulled={false}
              /> */}
              
              {/* <Cloud 
                seed={33}
                segments={9}
                volume={18}
                opacity={0.65}
                fade={1}
                growth={4}
                speed={0.025}
                bounds={[16, 10, 5]}
                position={[20, -700, -10]}
                texture={cloudTexture}
                frustumCulled={false}
              /> */}
              
              {/* <Cloud 
                seed={34}
                segments={13}
                volume={26}
                opacity={0.75}
                fade={1}
                growth={6}
                speed={0.02}
                bounds={[24, 16, 8]}
                position={[-35, -750, 8]}
                texture={cloudTexture}
                frustumCulled={false}
              /> */}
              
              {/* <Cloud 
                seed={35}
                segments={11}
                volume={21}
                opacity={0.7}
                fade={1}
                growth={5}
                speed={0.028}
                bounds={[19, 13, 6]}
                position={[30, -800, 0]}
                texture={cloudTexture}
                frustumCulled={false}
              /> */}
              
              {/* Sparse distant clouds for depth */}
              {/* <Cloud 
                seed={36}
                segments={8}
                volume={28}
                opacity={0.5}
                fade={1}
                growth={7}
                speed={0.015}
                bounds={[30, 20, 10]}
                position={[50, -580, -25]}
                texture={cloudTexture}
                frustumCulled={false}
              /> */}
              
              {/* <Cloud 
                seed={37}
                segments={7}
                volume={30}
                opacity={0.45}
                fade={1}
                growth={8}
                speed={0.012}
                bounds={[35, 22, 12]}
                position={[-60, -610, -30]}
                texture={cloudTexture}
                frustumCulled={false}
              /> */}
              
              {/* Hidden light sources for glow effects */}
              {/* <pointLight
                ref={staticLightRef1}
                color={pinkCloudColor}
                intensity={0}
                position={[0, -4, 0]}
                distance={15}
                decay={2}
              />
              <pointLight
                ref={staticLightRef2}
                color={pinkCloudColor}
                intensity={0}
                position={[0, -10, 0]}
                distance={20}
                decay={2}
              /> */}
            </Clouds>
          </group>
    
      </group>
    // </lightningContext.Provider>
  );
});

// Add display name to fix the ESLint error
DarkCloudsComponent.displayName = 'DarkCloudsComponent';

// Use dynamic import with no SSR to avoid 'document is not defined' error
const DarkClouds = dynamic(() => Promise.resolve(DarkCloudsComponent), {
  ssr: false,
});

// Component for cloud with internal lightning - similar to Puffycloud from example
// function PuffyLightningComponent({ position = [0, 0, 0] }) {
//   const light = useRef();
//   const { flash2 } = useContext(lightningContext);

//   useFrame((state, delta) => {
//     const impulse = flash2.update(state.clock.elapsedTime, delta);
//     if (light.current) {
//       light.current.intensity = impulse * 80;
//     }
//   });

//   return (
//     <group position={position}>
//       <pointLight
//         ref={light}
//         color="#b1d5ff"
//         intensity={0}
//         distance={15}
//         decay={2}
//       />
//     </group>
//   );
// }

// Use dynamic import for PuffyLightning as well
// const PuffyLightning = dynamic(() => Promise.resolve(PuffyLightningComponent), {
//   ssr: false,
// });

export default DarkClouds;