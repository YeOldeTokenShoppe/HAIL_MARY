import React, { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  EffectComposer,
  Bloom,
  Noise,
  Vignette,
  ChromaticAberration,
  Scanline,
  DepthOfField,
  // GodRays,
  Glitch,
} from "@react-three/postprocessing";
import { BlendFunction, GlitchMode } from "postprocessing";

// Set default is80sMode to false so component can be used without props
const PostProcessingEffects = ({ is80sMode = false }) => {
  const { scene, gl, camera } = useThree();
  const composerRef = useRef();
  const timeRef = useRef(0);
  const [isReady, setIsReady] = useState(false);
  const [bloomIntensity, setBloomIntensity] = useState(1);

  // Increase time for animated effects
  useFrame((_, delta) => {
    timeRef.current += delta;
  });

  // Check if WebGL context is ready
  useEffect(() => {
    let checkTimer = null;
    let mounted = true;
    
    if (gl && camera && scene) {
      const checkContext = () => {
        if (!mounted) return;
        
        try {
          // Check if gl exists and has getContext method
          if (!gl || typeof gl.getContext !== 'function') {
            console.warn('PostProcessingEffects: WebGL renderer not ready');
            checkTimer = setTimeout(checkContext, 100);
            return;
          }
          
          // Check if WebGL context has required properties
          const webglContext = gl.getContext();
          
          // Additional null check for the context itself
          if (!webglContext) {
            console.warn('PostProcessingEffects: WebGL context is null');
            checkTimer = setTimeout(checkContext, 100);
            return;
          }
          
          // Check for valid dimensions
          if (webglContext.drawingBufferWidth > 0 && webglContext.drawingBufferHeight > 0) {
            setIsReady(true);
          } else {
            // Retry after a short delay
            checkTimer = setTimeout(checkContext, 100);
          }
        } catch (error) {
          console.warn('PostProcessingEffects: WebGL context check failed', error);
          checkTimer = setTimeout(checkContext, 100);
        }
      };
      checkContext();
    }
    
    // Handle WebGL context loss
    const canvas = gl?.domElement;
    const handleContextLost = (event) => {
      event.preventDefault();
      console.warn('PostProcessingEffects: WebGL context lost');
      setIsReady(false);
    };
    
    const handleContextRestored = () => {
      console.log('PostProcessingEffects: WebGL context restored');
      setIsReady(true);
    };
    
    if (canvas) {
      canvas.addEventListener('webglcontextlost', handleContextLost);
      canvas.addEventListener('webglcontextrestored', handleContextRestored);
    }
    
    return () => {
      mounted = false;
      if (checkTimer) {
        clearTimeout(checkTimer);
      }
      if (canvas) {
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      }
    };
  }, [gl, camera, scene]);

  // Make the component visible from window for debugging
  useEffect(() => {
    try {
      // Store a reference to this component on window for external access
      window.postProcessingEffects = {
        composerRef,
        filmScanlines: 0,
        setBloomIntensity: (intensity) => {
          setBloomIntensity(intensity);
        }
      };
    } catch (error) {
      console.warn('PostProcessingEffects: Error setting window reference', error);
    }
    
    return () => {
      try {
        delete window.postProcessingEffects;
      } catch (error) {
        console.warn('PostProcessingEffects: Error cleaning up window reference', error);
      }
    };
  }, []);

  // Regular effects for normal mode with enhanced sunset bloom
  const normalEffects = (
    <>
      {/* Temporarily disable GodRays to prevent errors */}
      {/* {sunRef && (
        // <GodRays
        //   sun={sunRef}
        //   exposure={1.0}
        //   decay={0.95}
        //   density={0.96}
        //   weight={1.0}
        //   samples={100}
        //   clampMax={1}
        //   blur={true}
        //   blendFunction={BlendFunction.SCREEN}
        // />
      )} */}
      <Bloom
        intensity={bloomIntensity}           // Dynamically controlled intensity
        luminanceThreshold={0.8}  // Lowered from 0.4 to catch more of the sunset colors
        luminanceSmoothing={0.7}  // Adjusted from 0.9 for sharper bloom edges
        height={400}              // Increased from 300 for more detail
        blendFunction={BlendFunction.SCREEN} // Use SCREEN blend mode for a more natural glow
      />
      <DepthOfField
        focusDistance={4.0}       // Focus distance (equivalent to focus parameter)
        focalLength={0.0003}      // Focal length (equivalent to aperture parameter)
        bokehScale={0.01}         // Bokeh scale (equivalent to maxblur parameter)
      />
      {/* <ChromaticAberration
        offset={[0.001, 0.001]}   // Subtle chromatic aberration
      /> */}
      {/* <Noise opacity={0.3} />      Film grain effect */}
      <Vignette eskil={false} offset={0.3} darkness={0.5} />
    </>
  );

  // Enhanced effects for 80s mode with even stronger bloom
  const eightiesEffects = (
    <>
      {/* Temporarily disable GodRays to prevent errors */}
      {/* {sunRef && (
        <GodRays
          sun={sunRef}
          exposure={0.5}
          decay={0.95}
          density={0.96}
          weight={0.6}
          samples={60}
          clampMax={1}
          blur={true}
          blendFunction={BlendFunction.ADD}
        />
      )} */}
      <Bloom
        intensity={bloomIntensity * 0.5}  // Dynamically controlled, scaled for 80s mode
        luminanceThreshold={0.3} // Lower threshold to catch more colors
        luminanceSmoothing={0.6}  // Sharper, more pronounced bloom
        height={512}              // Higher resolution for better quality
        blendFunction={BlendFunction.ADD} // ADD for more intense glow
      />
      <ChromaticAberration
        offset={[0.01, 0.01]}     // Doubled the chromatic aberration
        radialModulation={true}
        modulationOffset={0.5}     // Increased modulation
      />
      <Scanline
        density={35.0}             // Much more visible scanlines
        opacity={0.8}             // Increased opacity for stronger effect
        blendFunction={BlendFunction.OVERLAY}
      />
      <Glitch
        delay={[3.0, 5.0]}        // Less frequent glitches (every 3-5 seconds)
        chromaticAberrationOffset={[0.00002, 0.000005]}  // Reduced intensity
        // delay={[1.5, 2.5]}        // Random glitch every 1.5-3.5 seconds
        // duration={[0.1, 0.3]}     // Quick glitches
        // strength={[0.00005, 0.00001]}     // Moderate strength
        mode={GlitchMode.SPORADIC} // Sporadic glitches for that 80s VHS feel
      />
      <Noise opacity={0.15} />    More visible noise
      <Vignette eskil={false} offset={0.05} darkness={0.5} /> {/* Stronger vignette */}
    </>
  );

  try {
    // Don't render effects until WebGL context is ready
    if (!isReady) {
      return null;
    }

    return (
      <EffectComposer 
        ref={composerRef}
        multisampling={0} // Disable multisampling to avoid potential issues
        renderPriority={1} // Ensure proper render order
        stencilBuffer={false} // Disable stencil buffer if not needed
        disableNormalPass // Disable normal pass to improve performance
        depthBuffer={true} // Ensure depth buffer is enabled
        autoClear={true} // Auto clear before rendering
      >
        {/* In Synthwave context, we'll always use normalEffects */}
        {is80sMode ? eightiesEffects : normalEffects}
      </EffectComposer>
    );
  } catch (error) {
    console.error('PostProcessingEffects: Error rendering effects', error);
    // Return null to prevent the entire scene from crashing
    return null;
  }
};

export default PostProcessingEffects;