"use client";

import React, { useEffect, useRef, useState } from 'react';
import WebGLStandaloneText from './WebGLStandaloneText';
import gsap from 'gsap';

const MorphingWebGLText = ({ 
  startTextArray = ["YOUR", "REAL80"],
  endText = "RL80",
  shouldMorph = false,
  morphDelay = 500,
  fontSize = 2.8,
  lineHeight = 0.5,
  color = "#fdcdf9",
  className = "",
  isMobile = false
}) => {
  const containerRef = useRef(null);
  const realTextRef = useRef(null);
  const rlTextRef = useRef(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (shouldMorph && !hasAnimated) {
      const timer = setTimeout(() => {
        setHasAnimated(true);
        
        // Create timeline for the animation
        const tl = gsap.timeline();
        
        // Start with REAL80 visible, RL80 hidden
        // Morph by fading REAL80 out while fading RL80 in
        tl.to(realTextRef.current, {
          opacity: 0,
          scale: 0.95,
          filter: 'blur(20px)',
          duration: 1.5,
          ease: "power2.inOut"
        })
        .to(rlTextRef.current, {
          opacity: 1,
          scale: 1,
          filter: 'blur(0px)',
          duration: 1.5,
          ease: "power2.inOut"
        }, "<"); // Start at the same time
        
      }, morphDelay);
      
      return () => clearTimeout(timer);
    }
  }, [shouldMorph, morphDelay, hasAnimated]);

  return (
    <div 
      ref={containerRef}
      className={className}
      style={{ 
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center'
      }}
    >
      {/* YOUR REAL80 text - starts visible */}
      <div 
        ref={realTextRef}
        style={{ 
          position: 'absolute',
          width: '100%',
          height: '100%',
          opacity: 1,
          transform: 'scale(1)',
          filter: 'blur(0px)',
          transition: 'none'
        }}
      >
        <WebGLStandaloneText 
          textArray={startTextArray}
          fontSize={fontSize}
          lineHeight={lineHeight}
          color={color}
          id="morph-real80"
          skipAnimation={true}
        />
      </div>
      
      {/* RL80 text - starts hidden */}
      <div 
        ref={rlTextRef}
        style={{ 
          position: 'absolute',
          width: '100%',
          height: '100%',
          opacity: 0,
          transform: 'scale(1.05)',
          filter: 'blur(20px)',
          transition: 'none'
        }}
      >
        <WebGLStandaloneText 
          text={endText}
          fontSize={fontSize}
          lineHeight={lineHeight}
          color={color}
          id="morph-rl80"
          skipAnimation={true}
        />
      </div>
    </div>
  );
};

export default MorphingWebGLText;