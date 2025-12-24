import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(SplitText);

const AnnunciationIntro = ({ isMobile, titleInView, SkewedHeading, AngelOfCurrencies }) => {
  const textRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!titleInView || !textRef.current) return;

    // Create GSAP context for cleanup
    const ctx = gsap.context(() => {
      // Split text into words and characters, keeping words together
      const split = new SplitText(textRef.current, { 
        type: 'words,chars',
        wordsClass: 'word',
        charsClass: 'char'
      });

      // Initial state - hide all chars with a subtle effect
      gsap.set(split.chars, { 
        visibility: 'hidden',
        opacity: 0,
        filter: 'blur(8px)',
      });

      // Main reveal timeline with sci-fi glow effect
      const revealTl = gsap.timeline({ delay: 0.5 });
      
      // Characters appear with STRONG RGB chromatic aberration
      revealTl.fromTo(split.chars, {
        visibility: 'hidden',
        opacity: 0,
        textShadow: `
          8px 2px 0 rgba(255, 0, 0, 1),
          -8px -2px 0 rgba(0, 255, 255, 1),
          0 0 20px rgb(3, 233, 244)
        `,
        filter: 'blur(4px) brightness(2)',
        transform: 'scale(1.1) translateZ(0)',
      }, {
        visibility: 'visible',
        opacity: 1,
        textShadow: `
          2px 1px 0 rgba(255, 0, 0, 0.5),
          -2px -1px 0 rgba(0, 255, 255, 0.5),
          0 0 30px rgb(3, 233, 244)
        `,
        filter: 'blur(0px) brightness(1)',
        transform: 'scale(1) translateZ(0)',
        duration: 1,
        ease: 'power2.out',
        stagger: {
          each: 0.02,
          from: 'start'
        }
      });
      
      // Strong RGB aberration pulse
      revealTl.to(split.chars, {
        textShadow: `
          4px 2px 0 rgba(255, 0, 0, 0.7),
          -4px -2px 0 rgba(0, 255, 255, 0.7),
          0 0 25px rgb(3, 233, 244)
        `,
        duration: 0.2,
        ease: 'power2.inOut',
        yoyo: true,
        repeat: 1
      }, '-=0.3');
      
      // Settle to subtle RGB shift
      revealTl.to(split.chars, {
        textShadow: `
          1px 0.5px 0 rgba(255, 0, 0, 0.2),
          -1px -0.5px 0 rgba(0, 255, 255, 0.2),
          0 0 20px rgb(3, 233, 244)
        `,
        duration: 0.5,
        ease: 'power2.out'
      });

      // Holy glow pulse - more dramatic, multiple waves
      revealTl.to(textRef.current, {
        textShadow: `
          0 0 10px rgba(255, 215, 0, 0.8),
          0 0 30px rgba(212, 175, 55, 0.6),
          0 0 50px rgba(255, 215, 0, 0.4),
          2px 2px 4px rgba(0,0,0,0.9)
        `,
        duration: 0.6,
        ease: 'power2.in'
      }, '-=0.3');

      // Second pulse - intensify
      revealTl.to(textRef.current, {
        textShadow: `
          0 0 20px rgba(255, 255, 255, 0.9),
          0 0 40px rgba(255, 215, 0, 0.8),
          0 0 80px rgba(212, 175, 55, 0.5),
          0 0 120px rgba(0, 255, 251, 0.3),
          2px 2px 4px rgba(0,0,0,0.9)
        `,
        duration: 0.4,
        ease: 'power2.out'
      });

      // Fade back to subtle glow
      revealTl.to(textRef.current, {
        textShadow: `
          0 0 8px rgba(212, 175, 55, 0.2),
          2px 2px 4px rgba(0,0,0,0.9)
        `,
        duration: 1.5,
        ease: 'power2.out'
      });

      // Removed glitch effect - keeping the text stable after reveal
    }, containerRef);

    // Cleanup
    return () => {
      ctx.revert();
    };
  }, [titleInView]);

  return (
    <div 
      ref={containerRef}
      style={{
        maxWidth: '1200px',
        margin: '15rem auto 0 auto',
        padding: isMobile ? '30px 0' : '40px 0',
        background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.5), rgba(0, 20, 0, 0.4))',
        borderRadius: '1rem',
        border: '2px solid #00fffbff',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 0 40px rgba(7, 247, 247, 0.3), inset 0 0 40px rgba(12, 236, 252, 0.05)',
        textAlign: 'center',
        opacity: titleInView ? 1 : 0,
        transform: titleInView ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.5s ease-out 0.5s',
        position: 'relative',
        width: '100%',
        zIndex: 10,
      }}
    >
      {/* Grid pattern overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `
          repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 255, 0, 0.02) 2px,
            rgba(0, 255, 0, 0.02) 4px
          ),
          repeating-linear-gradient(
            90deg,
            transparent,
            transparent 2px,
            rgba(0, 255, 0, 0.02) 2px,
            rgba(0, 255, 0, 0.02) 4px
          )
        `,
        pointerEvents: 'none',
        borderRadius: '1rem',
      }} />

      {/* Scanline overlay for extra cyber effect */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0, 0, 0, 0.1) 2px, rgba(0, 0, 0, 0.1) 4px)',
        pointerEvents: 'none',
        borderRadius: '1rem',
        opacity: 0.3,
      }} />

      {/* The Annunciation Heading */}
      <SkewedHeading 
        lines={["THE", "ANNUNCIATION"]}
        colors={["#d4af37", "#f4e4c1", "#ffd700"]}
        fontSize={{ mobile: "1.8rem", desktop: "3rem" }}
        isMobile={isMobile}
        textAlign="left"
      />

      <div style={{
        fontSize: isMobile ? '2.7rem' : '3.5rem',
        color: '#ffffff',
        fontFamily: "'scotland', sans-serif",
        marginBottom: '0',
        textShadow: '2px 2px 4px rgba(0,0,0,0.9)',
        lineHeight: '1.1',
        width: '100%',
        padding: isMobile ? '40px 60px' : '0 100px',
        position: 'relative'
      }}>
        
        {/* Angel of Currencies presenting the introduction */}
        <AngelOfCurrencies 
          isMobile={isMobile}
         
        />
        
        {/* Animated text content */}
        <div 
          ref={textRef}
          style={{
            perspective: '1000px',
            transformStyle: 'preserve-3d',
          }}
        >
          <span style={{ fontFamily: "Blackletter", fontSize: isMobile ? '2rem' : '3rem' }}>D</span>
          escending from the cloud servers comes the digital manifestation of the icon of intercession - the virtual mary in the virtual machine, guardian of good times, patron saint of portfolios, aider to traders, fren to degens - here to light the way through the dark realm of{' '}
          <span style={{ fontFamily: "Blackletter", fontSize: isMobile ? '1.5rem' : '2.5rem' }}>D</span>
          e
          <span style={{ fontFamily: "Blackletter", fontSize: isMobile ? '1.5rem' : '2.5rem' }}>F</span>
          i.
        </div>
      </div>

      <style>{`
        .word {
          display: inline-block;
          white-space: nowrap;
        }
        .char {
          display: inline-block;
          will-change: transform, opacity, filter;
        }
      `}</style>
    </div>
  );
};

export default AnnunciationIntro;