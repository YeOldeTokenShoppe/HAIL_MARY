import React, { useRef, useState, useEffect } from 'react'
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion'

// ============================================
// CONFIG
// ============================================
const TRANSITION_START = 0.3  // Start fading carousel at 30% scroll
const TRANSITION_END = 0.7    // Fully show shrine at 70% scroll
const SPRING_CONFIG = { stiffness: 100, damping: 30, restDelta: 0.001 }

// ============================================
// MAIN PAGE WRAPPER
// ============================================
export function ShrinePageWrapper({ 
  CarouselComponent,
  ShrineComponent,
  carouselProps = {},
  shrineProps = {},
}) {
  const containerRef = useRef(null)
  const [hasScrolledToShrine, setHasScrolledToShrine] = useState(false)
  
  // Track scroll progress through the transition zone
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  })
  
  // Smooth out the scroll progress
  const smoothProgress = useSpring(scrollYProgress, SPRING_CONFIG)
  
  // Carousel transforms - fades and scales out
  const carouselOpacity = useTransform(smoothProgress, [0, TRANSITION_START, TRANSITION_END], [1, 1, 0])
  const carouselScale = useTransform(smoothProgress, [0, TRANSITION_START, TRANSITION_END], [1, 1, 0.95])
  const carouselY = useTransform(smoothProgress, [0, TRANSITION_END], [0, -50])
  const carouselBlur = useTransform(smoothProgress, [TRANSITION_START, TRANSITION_END], [0, 10])
  
  // Shrine transforms - fades and rises in
  const shrineOpacity = useTransform(smoothProgress, [TRANSITION_START, TRANSITION_END], [0, 1])
  const shrineScale = useTransform(smoothProgress, [TRANSITION_START, TRANSITION_END], [0.98, 1])
  const shrineY = useTransform(smoothProgress, [TRANSITION_START, TRANSITION_END], [30, 0])
  
  // Track when user has scrolled past transition
  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (value) => {
      setHasScrolledToShrine(value > TRANSITION_END)
    })
    return unsubscribe
  }, [scrollYProgress])
  
  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Carousel Section */}
      <motion.section
        style={{
          position: 'relative',
          height: '100vh',
          width: '100%',
          opacity: carouselOpacity,
          scale: carouselScale,
          y: carouselY,
          filter: useTransform(carouselBlur, v => `blur(${v}px)`),
          zIndex: 2,
        }}
      >
        <CarouselComponent {...carouselProps} />
        
        {/* Scroll indicator */}
        <ScrollIndicator progress={smoothProgress} />
      </motion.section>
      
      {/* Shrine Section - Sticky once in view */}
      <motion.section
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          width: '100%',
          opacity: shrineOpacity,
          scale: shrineScale,
          y: shrineY,
          zIndex: 1,
        }}
      >
        <ShrineComponent 
          {...shrineProps} 
          isActive={hasScrolledToShrine}
        />
      </motion.section>
      
      {/* Spacer to allow scrolling */}
      <div style={{ height: '50vh' }} />
    </div>
  )
}

// ============================================
// ALTERNATIVE: Overlay transition
// Shrine is always behind, carousel overlays
// ============================================
export function ShrinePageWrapperOverlay({ 
  CarouselComponent,
  ShrineComponent,
  carouselProps = {},
  shrineProps = {},
}) {
  const containerRef = useRef(null)
  const [hasScrolledToShrine, setHasScrolledToShrine] = useState(false)
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  })
  
  const smoothProgress = useSpring(scrollYProgress, SPRING_CONFIG)
  
  // Carousel fades out as overlay
  const carouselOpacity = useTransform(smoothProgress, [0, 0.4, 0.8], [1, 0.8, 0])
  const carouselPointerEvents = useTransform(
    smoothProgress, 
    [0, 0.5], 
    ["auto", "none"]
  )
  
  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (value) => {
      setHasScrolledToShrine(value > 0.5)
    })
    return unsubscribe
  }, [scrollYProgress])
  
  return (
    <div ref={containerRef} style={{ 
      position: 'relative',
      height: '200vh', // Scroll distance
    }}>
      {/* Shrine - Fixed background */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100vh',
        zIndex: 1,
      }}>
        <ShrineComponent 
          {...shrineProps}
          isActive={hasScrolledToShrine}
        />
      </div>
      
      {/* Carousel - Fading overlay */}
      <motion.div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100vh',
          opacity: carouselOpacity,
          pointerEvents: carouselPointerEvents,
          zIndex: 2,
        }}
      >
        <CarouselComponent {...carouselProps} />
        <ScrollIndicator progress={smoothProgress} />
      </motion.div>
    </div>
  )
}

// ============================================
// SCROLL INDICATOR
// ============================================
function ScrollIndicator({ progress }) {
  const opacity = useTransform(progress, [0, 0.3], [1, 0])
  const y = useTransform(progress, [0, 0.3], [0, 20])
  
  return (
    <motion.div
      style={{
        position: 'absolute',
        bottom: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        opacity,
        y,
        pointerEvents: 'none',
      }}
    >
      <span style={{
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: '14px',
        fontFamily: 'monospace',
        textTransform: 'uppercase',
        letterSpacing: '2px',
      }}>
        Enter the Shrine
      </span>
      
      {/* Animated arrow */}
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ 
          duration: 1.5, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
      >
        <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none"
          style={{ opacity: 0.7 }}
        >
          <path 
            d="M12 4L12 20M12 20L6 14M12 20L18 14" 
            stroke="white" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      </motion.div>
      
      {/* Progress dots */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.5)',
            }}
            animate={{
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </motion.div>
  )
}

// ============================================
// CANDLE RISE EFFECT
// Candles drift up from bottom as you scroll
// ============================================
export function CandleRiseWrapper({ children, scrollProgress }) {
  const y = useTransform(scrollProgress, [0, 1], [100, 0])
  const opacity = useTransform(scrollProgress, [0.2, 0.6], [0, 1])
  
  return (
    <motion.div style={{ y, opacity }}>
      {children}
    </motion.div>
  )
}

// ============================================
// PARALLAX LIGHT RAYS
// Light rays move slower than scroll for depth
// ============================================
export function ParallaxLightRays({ scrollProgress, children }) {
  const y = useTransform(scrollProgress, [0, 1], [0, -50])
  const opacity = useTransform(scrollProgress, [0, 0.3, 0.7, 1], [0.8, 0.6, 0.8, 1])
  
  return (
    <motion.div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        y,
        opacity,
        pointerEvents: 'none',
      }}
    >
      {children}
    </motion.div>
  )
}

// ============================================
// EXAMPLE USAGE
// ============================================
export function ExampleImplementation() {
  // Your existing carousel component
  const MyCarousel = ({ ...props }) => (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'linear-gradient(to bottom, #2d1b4e, #1a1a2e)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <h1 style={{ 
        color: '#fff', 
        fontFamily: 'serif',
        fontSize: '3rem',
      }}>
        The Legend of Our Lady
      </h1>
      {/* Your actual carousel here */}
    </div>
  )
  
  // Your shrine component
  const MyShrine = ({ isActive, ...props }) => (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#0a0a0a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <h1 style={{ 
        color: '#00ff66', 
        fontFamily: 'monospace',
        fontSize: '2rem',
      }}>
        {isActive ? 'Shrine Active' : 'Shrine Loading...'}
      </h1>
      {/* Your actual shrine component (CandleShrine) here */}
    </div>
  )
  
  return (
    <ShrinePageWrapper
      CarouselComponent={MyCarousel}
      ShrineComponent={MyShrine}
      carouselProps={{}}
      shrineProps={{}}
    />
  )
}

// ============================================
// INTEGRATION WITH YOUR ACTUAL COMPONENTS
// ============================================
export function RL80HomePage() {
  // Import your actual components:
  // import { PolaroidCarousel } from './PolaroidCarousel'
  // import CandleShrine from './CandleShrine'
  
  return (
    <ShrinePageWrapper
      CarouselComponent={({ ...props }) => {
        // Your existing carousel with polaroids
        return (
          <div style={{ 
            width: '100%', 
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {/* 
              <PolaroidCarousel {...props} /> 
              
              Or inline your carousel JSX here
            */}
            
            {/* Logo */}
            <div style={{
              position: 'absolute',
              top: '40px',
              left: '40px',
              zIndex: 10,
            }}>
              <img src="/logo.png" alt="RL80" style={{ height: '60px' }} />
            </div>
            
            {/* Carousel content placeholder */}
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 50%, #1a1a2e 100%)',
            }}>
              {/* Your 3D carousel scene */}
            </div>
          </div>
        )
      }}
      
      ShrineComponent={({ isActive, ...props }) => {
        // Your shrine component
        return (
          <div style={{ 
            width: '100%', 
            height: '100%',
            position: 'relative',
          }}>
            {/*
              <CandleShrine isActive={isActive} {...props} />
            */}
          </div>
        )
      }}
    />
  )
}

// ============================================
// OPTIONAL: Nav that updates based on section
// ============================================
export function SectionAwareNav({ scrollProgress }) {
  const [currentSection, setCurrentSection] = useState('lore')
  
  useEffect(() => {
    const unsubscribe = scrollProgress.on("change", (value) => {
      setCurrentSection(value > 0.5 ? 'shrine' : 'lore')
    })
    return unsubscribe
  }, [scrollProgress])
  
  return (
    <nav style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 100,
      display: 'flex',
      gap: '16px',
      fontFamily: 'monospace',
      fontSize: '14px',
    }}>
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        style={{
          background: 'none',
          border: 'none',
          color: currentSection === 'lore' ? '#fff' : '#666',
          cursor: 'pointer',
          padding: '8px 16px',
          borderBottom: currentSection === 'lore' ? '2px solid #fff' : '2px solid transparent',
          transition: 'all 0.3s ease',
        }}
      >
        Lore
      </button>
      <button
        onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
        style={{
          background: 'none',
          border: 'none',
          color: currentSection === 'shrine' ? '#00ff66' : '#666',
          cursor: 'pointer',
          padding: '8px 16px',
          borderBottom: currentSection === 'shrine' ? '2px solid #00ff66' : '2px solid transparent',
          transition: 'all 0.3s ease',
        }}
      >
        Shrine
      </button>
    </nav>
  )
}

export default ShrinePageWrapper