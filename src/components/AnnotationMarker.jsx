import { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';

function AnnotationMarker({ 
  position = [0, 0, 0], 
  number = 1, 
  text = '', 
  onFocus,
  isActive = false,
  color = '#ffff00',
  hoverColor = '#c896ff',
  annotationOffset = null,
  scale = 1,
  textScale = null,
  attachTo = null, // Reference to a scene object
  offset = [0, 0, 0], // Offset from the attached object
  textOffset = [0, 1, 0] // 3D offset for text panel relative to marker
}) {
  const meshRef = useRef();
  const bgMeshRef = useRef();
  const groupRef = useRef();
  const { camera, invalidate } = useThree();
  const [hovered, setHovered] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(position);
  
  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth <= 768);
      }
    };
    
    checkMobile();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }
  }, []);

  // Force initial render of HTML elements
  useEffect(() => {
    // Force a re-render after mount to ensure HTML elements appear
    const timer = setTimeout(() => {
      setForceUpdate(prev => prev + 1);
      invalidate(); // Force three.js to re-render
    }, 100);
    
    return () => clearTimeout(timer);
  }, [invalidate]);
  
  // Update position from attached object and pulse animation
  useFrame((state) => {
    // Update position if attached to an object
    if (attachTo && attachTo.current) {
      const worldPos = new THREE.Vector3();
      attachTo.current.getWorldPosition(worldPos);
      const newPosition = [
        worldPos.x + offset[0],
        worldPos.y + offset[1], 
        worldPos.z + offset[2]
      ];
      setCurrentPosition(newPosition);
    }
    
    // Pulse animation for active state
    if (meshRef.current && isActive) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
      meshRef.current.scale.setScalar(scale);
    }
  });

  const handleClick = (e) => {
    e.stopPropagation();
    if (onFocus) {
      onFocus();
    }
  };

  const markerColor = hovered ? hoverColor : color;
  const effectiveTextScale = textScale !== null ? textScale : scale;
  
  // Handle different offset formats: [x, y] or { mobile: [x, y], desktop: [x, y] }
  const getEffectiveOffset = () => {
    if (!annotationOffset) return null;
    
    // If it's an object with mobile/desktop properties
    if (typeof annotationOffset === 'object' && annotationOffset.mobile && annotationOffset.desktop) {
      return isMobile ? annotationOffset.mobile : annotationOffset.desktop;
    }
    
    // If it's a simple [x, y] array, use as-is
    if (Array.isArray(annotationOffset)) {
      return annotationOffset;
    }
    
    return null;
  };
  
  const effectiveOffset = getEffectiveOffset();

  return (
    <group 
      ref={groupRef}
      position={currentPosition}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      {/* Only show the marker when annotation is not active */}
      {!isActive && (
        <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
          {/* Invisible larger click area */}
          <mesh visible={false}>
            <circleGeometry args={[0.2 * scale, 32]} />
            <meshBasicMaterial 
              transparent 
              opacity={0} 
              depthTest={true}
              depthWrite={true}
            />
          </mesh>
          
          {/* Visible marker */}
          <mesh ref={meshRef}>
            {/* Outer ring */}
            <ringGeometry args={[0.09 * scale, 0.11 * scale, 32]} />
            <meshBasicMaterial 
              color={markerColor} 
              transparent 
              opacity={0.9}
              depthTest={true}
              depthWrite={true}
            />
          </mesh>
          
          {/* Inner circle */}
          <mesh position={[0, 0, 0.001]}>
            <circleGeometry args={[0.09 * scale, 32]} />
            <meshBasicMaterial 
              color="#000000" 
              transparent 
              opacity={0.8}
              depthTest={true}
              depthWrite={true}
            />
          </mesh>
          
          {/* Question mark using drei Text component */}
          <Text
            position={[0, 0, 0.002]}
            fontSize={0.12 * scale}
            color={markerColor}
            anchorX="center"
            anchorY="middle"
            fontWeight={700}
            depthOffset={-1}
            material-transparent
            material-opacity={0.9}
            material-depthTest={true}
            material-depthWrite={false}
          >
            ?
          </Text>
        </Billboard>
      )}
      
      {/* Annotation text panel */}
      {isActive && (
        <group>
          {effectiveOffset ? (
            // Use HTML positioning when custom offset is provided
            <Html
              position={currentPosition}
              center
              style={{
                pointerEvents: 'none',
                transition: 'all 0.3s ease-in-out',
                opacity: isActive ? 1 : 0,
                position: 'fixed',
                left: '50%',
                top: '50%',
                transform: `translate(calc(-50% + ${effectiveOffset[0]}px), calc(-50% + ${effectiveOffset[1]}px))`,
              }}
            >
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.7)',
                  border: `1px solid ${color}`,
                  borderRadius: "3px",
                  padding: isMobile ? "4px 6px" : "6px 8px",
                  color: '#ffffff',
                  fontSize: isMobile ? "9px" : "10px",
                  fontFamily: 'Arial, sans-serif',
                  fontWeight: 500,
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.3',
                  textAlign: 'center',
                  width: isMobile ? "120px" : "160px",
                  maxWidth: isMobile ? "25vw" : "200px",
                  boxShadow: `0 2px 8px ${color}20`,
                }}
              >
                {text}
              </div>
            </Html>
          ) : (
            // Use 3D Billboard when no custom offset
            <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
              <group position={textOffset}>
                {/* Text first to calculate dimensions */}
                <Text
                  position={[0, 0, 0.001]}
                  fontSize={isMobile ? 0.04 : 0.05}
                  color="#ffffff"
                  anchorX="center"
                  anchorY="middle"
                  maxWidth={isMobile ? 0.6 : 0.7}
                  textAlign="center"
                  fontWeight={500}
                  depthOffset={-1}
                  material-transparent
                  material-opacity={1}
                  material-depthTest={false}
                  onSync={(troika) => {
                    // Get text bounds to size background
                    if (troika.textRenderInfo && bgMeshRef.current) {
                      const bounds = troika.textRenderInfo.blockBounds;
                      const width = (bounds[2] - bounds[0]) + 0.08; // Reduced padding
                      const height = (bounds[3] - bounds[1]) + 0.04; // Reduced padding
                      
                      // Update background geometry
                      const bgGeometry = bgMeshRef.current.geometry;
                      if (bgGeometry) {
                        bgGeometry.dispose();
                        bgMeshRef.current.geometry = new THREE.PlaneGeometry(width, height);
                      }
                    }
                  }}
                >
                  {text}
                </Text>
                
                {/* Background panel that will be resized */}
                <mesh ref={bgMeshRef} position={[0, 0, -0.001]}>
                  <planeGeometry args={[1.0, 0.3]} />
                  <meshBasicMaterial 
                    color="#000000" 
                    transparent 
                    opacity={0.7}
                    depthTest={false}
                  />
                </mesh>
              </group>
            </Billboard>
          )}
        </group>
      )}
    </group>
  );
}

export default AnnotationMarker;