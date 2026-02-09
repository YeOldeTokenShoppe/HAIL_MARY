import React, { Suspense, useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, useAnimations, } from '@react-three/drei';
import { 
  EffectComposer, 
  Bloom, 
  ChromaticAberration,
  Scanline,
  Glitch,
  Noise,
  Vignette
} from '@react-three/postprocessing';
import { BlendFunction, GlitchMode } from "postprocessing";
import * as THREE from 'three';
import Chart from 'chart.js/auto';
import PostProcessingEffects from './PostProcessingEffects';
import '../app/globals.css';
import CoinLoader from '@/components/CoinLoader';
import Numerology from '@/components/Numerology';
import ScrollTransition from '@/components/ScrollTransition';
import CleanCanvas from '@/components/CleanCanvas';
import { useLanguage } from './LanguageProvider';
function createChartTexture(data, chartType = 'line', label = '') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  
  // Save the initial state
  ctx.save();
  
  // First, fill the entire canvas with a solid color to test
  ctx.fillStyle = 'rgba(30, 30, 40, 1)'; // Solid dark background
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add a colored overlay based on chart type
  ctx.fillStyle = label === 'RSI' ? 'rgba(255, 165, 0, 0.15)' :
                  label === 'Moving Averages' ? 'rgba(255, 255, 0, 0.15)' :
                  label === 'Market Cap (B)' ? 'rgba(255, 100, 255, 0.15)' :
                  'rgba(0, 255, 255, 0.15)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Special handling for Moving Averages chart with multiple lines
  if (label === 'Moving Averages' && data.ma7 && data.ma3) {
    const datasets = [
      {
        label: 'Price',
        data: data.values,
        borderColor: '#00ffff',
        backgroundColor: 'transparent',
        borderWidth: 3,
        tension: 0.4,
        pointRadius: 4
      },
      {
        label: 'MA7',
        data: data.ma7,
        borderColor: '#ff64ff',
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 3,
        borderDash: [5, 5]
      },
      {
        label: 'MA3',
        data: data.ma3,
        borderColor: '#ffff00',
        backgroundColor: 'transparent',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 3,
        borderDash: [3, 3]
      }
    ];
    
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.timestamps,
        datasets: datasets
      },
      options: {
        responsive: false,
        animation: false,
        backgroundColor: 'transparent',
        plugins: {
          legend: {
            labels: {
              color: '#00ffff',
              font: {
                size: 12,
                weight: 'bold'
              }
            }
          },
          title: {
            display: true,
            text: label,
            color: '#00ffff',
            font: {
              size: 16,
              weight: 'bold'
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)',
              font: {
                size: 10
              }
            }
          },
          y: {
            grid: {
              color: 'rgba(255, 255, 255, 0.05)'
            },
            ticks: {
              color: 'rgba(255, 255, 255, 0.7)',
              font: {
                size: 10
              }
            }
          }
        }
      }
    });
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }
  
  // Configure based on chart type and label
  let chartConfig;
  if (label === 'RSI') {
    chartConfig = {
      label: label,
      data: data.values,
      borderColor: '#ffa500',
      backgroundColor: 'rgba(255, 165, 0, 0.1)',
      borderWidth: 3,
      tension: 0.4,
      pointBackgroundColor: '#ffa500',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointRadius: 5
    };
  } else if (label === 'Market Cap (B)') {
    chartConfig = {
      label: label,
      data: data.values,
      backgroundColor: 'rgba(255, 100, 255, 0.6)',
      borderColor: '#ff64ff',
      borderWidth: 2
    };
  } else if (chartType === 'bar') {
    chartConfig = {
      label: label || 'Volume (M)',
      data: data.values,
      backgroundColor: 'rgba(255, 100, 255, 0.6)',
      borderColor: '#ff64ff',
      borderWidth: 2
    };
  } else {
    chartConfig = {
      label: label || 'ETH Price',
      data: data.values,
      borderColor: '#00ffff',
      backgroundColor: 'rgba(0, 255, 255, 0.1)',
      borderWidth: 4,
      tension: 0.4,
      pointBackgroundColor: '#00ffff',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointRadius: 6,
      pointHoverRadius: 8
    };
  }
  
  // Add RSI overbought/oversold zones if it's an RSI chart
  const yScaleOptions = label === 'RSI' ? {
    min: 0,
    max: 100,
    grid: {
      color: 'rgba(255, 255, 255, 0.05)'
    },
    ticks: {
      color: 'rgba(255, 255, 255, 0.7)',
      font: {
        size: 12
      },
      callback: function(value) {
        if (value === 30) return '30 (Oversold)';
        if (value === 70) return '70 (Overbought)';
        return value;
      }
    }
  } : {
    grid: {
      color: 'rgba(255, 255, 255, 0.05)'
    },
    ticks: {
      color: 'rgba(255, 255, 255, 0.7)',
      font: {
        size: 12
      }
    }
  };
  
  new Chart(ctx, {
    type: chartType,
    data: {
      labels: data.timestamps,
      datasets: [chartConfig]
    },
    options: {
      responsive: false,
      animation: false,
      backgroundColor: 'transparent',
      plugins: {
        legend: {
          display: false // Hide legend since we'll use title
        },
        title: {
          display: true,
          text: label || 'Chart',
          color: '#00ffff',
          font: {
            size: 16,
            weight: 'bold'
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.05)'
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.7)',
            font: {
              size: 12
            }
          }
        },
        y: yScaleOptions
      }
    }
  });
  
  // Restore the context state
  ctx.restore();
  
  // Draw a border on top of everything
  ctx.strokeStyle = label === 'RSI' ? '#ffa500' :
                    label === 'Moving Averages' ? '#ffff00' :
                    label === 'Market Cap (B)' ? '#ff64ff' :
                    '#00ffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function FloatingChart({ position, chartData, chartType = 'line', chartLabel = '', index, onChartClick }) {
  const meshRef = useRef();
  const [texture, setTexture] = useState(null);
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);
  
  useEffect(() => {
    if (chartData && chartData.values && chartData.values.length > 0) {
      if (texture) {
        texture.dispose();
      }
      const newTexture = createChartTexture(chartData, chartType, chartLabel);
      newTexture.needsUpdate = true;
      setTexture(newTexture);
    }
  }, [chartData, chartType, chartLabel]);
  
  // Change cursor on hover
  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto';
    return () => {
      document.body.style.cursor = 'auto';
    };
  }, [hovered]);
  
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const time = clock.getElapsedTime();
      
      // Gentle floating animation
      const floatSpeed = clicked ? 0 : (hovered ? 0.3 : 1);
      meshRef.current.position.y = position[1] + Math.sin(time * 0.5 * floatSpeed + index) * 0.1;
      
      // Subtle rotation
      meshRef.current.rotation.y = Math.sin(time * 0.3 * floatSpeed) * 0.02;
      meshRef.current.rotation.x = Math.sin(time * 0.2 * floatSpeed + index) * 0.01;
      
      // Scale effect on hover/click
      const targetScale = clicked ? 1.15 : (hovered ? 1.08 : 1);
      meshRef.current.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        0.15
      );
    }
  });
  
  if (!texture) return null;
  
  const glowColor = 
    chartLabel === 'RSI' ? '#ffa500' :
    chartLabel === 'Moving Averages' ? '#ffff00' :
    chartLabel === 'Market Cap (B)' ? '#ff64ff' :
    '#00ffff';
  
  return (
    <group ref={meshRef} position={position}>
      {/* Glow backdrop */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[2.2, 1.2]} />
        <meshBasicMaterial 
          color={glowColor}
          transparent={true}
          opacity={hovered ? 1 : 0.75}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Main chart */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
        onClick={(e) => {
          e.stopPropagation();
          setClicked(!clicked);
          if (onChartClick) {
            onChartClick({
              type: chartType,
              data: chartData,
              label: chartLabel,
              index: index
            });
          }
        }}
      >
        <planeGeometry args={[2, 1]} />
        <meshStandardMaterial 
          map={texture} 
          transparent={true} 
          side={THREE.DoubleSide}
          opacity={1}
          alphaTest={0.01}
          emissive={glowColor}
          emissiveIntensity={hovered ? 3.5 : 2.5}
        />
      </mesh>
      
      {/* Edge glow */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[2.05, 1.05]} />
        <meshBasicMaterial 
          color={glowColor}
          transparent={true}
          opacity={hovered ? 0.8 : 0.5}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function Model({ modelPath, onLoaded, is80sMode, onScrollClick, onBallClick, onPyramidClick }) {
  const group = useRef();
  const { scene, animations } = useGLTF(modelPath);
  const { actions } = useAnimations(animations, group);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [windowHeight, setWindowHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 768);
  const [centerOffset, setCenterOffset] = useState(new THREE.Vector3(0, 0, 0));
  const scrollMaterialsRef = useRef([]);
  const scrollMeshesRef = useRef({});
  const ballMaterialRef = useRef(null);
  const ballMeshRef = useRef(null);
  const pyramidMeshRef = useRef(null);
  const pyramidMaterialRef = useRef(null);
  const [userRotation, setUserRotation] = useState(0); // User-controlled rotation offset
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouseX, setLastMouseX] = useState(0);
  const [hoveredObject, setHoveredObject] = useState(null); // Track which object is being hovered
  
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);
  
  // Signal when model is loaded
  useEffect(() => {
    if (scene) {
      if (onLoaded) {
        onLoaded();
      }
    }
  }, [scene, onLoaded, modelPath]);

  // Center the model's pivot point based on bounding box
  useEffect(() => {
    if (scene) {
      const box = new THREE.Box3().setFromObject(scene);
      const center = box.getCenter(new THREE.Vector3());
      // Shift scene so its center becomes the origin (pivot point)
      scene.position.sub(center);
      setCenterOffset(center);
    }
  }, [scene]);
  
  // Control Neon mesh visibility based on 80s mode
  useEffect(() => {
    if (scene) {
      const neonMesh = scene.getObjectByName('Neon');
      if (neonMesh) {
        neonMesh.visible = is80sMode;
        // console.log(`Neon mesh visibility set to: ${is80sMode}`);
      } else {
        // console.log('Neon mesh not found in the model');
      }
    }
  }, [scene, is80sMode]);
  
  // Add glow effects to scroll objects and make them clickable
  useEffect(() => {
    if (scene) {
      const scrollObjects = ['Scroll1', 'Scroll2', 'Scroll3', 'Scroll4'];
      scrollMaterialsRef.current = []; // Reset materials array
      scrollMeshesRef.current = {}; // Reset meshes object
      
      scrollObjects.forEach(scrollName => {
        const scrollMesh = scene.getObjectByName(scrollName);
        if (scrollMesh) {
          // console.log(`Found ${scrollName}, applying glow effect and click handler`);
          
          // Store the original scale to prevent accumulation
          if (!scrollMesh.userData.originalScale) {
            scrollMesh.userData.originalScale = scrollMesh.scale.clone();
          }
          
          // Store mesh reference for click handling
          scrollMeshesRef.current[scrollName] = scrollMesh;
          
          // Add click handler
          const handleScrollClick = (event) => {
            event.stopPropagation();
            // console.log(`${scrollName} clicked!`);
            if (onScrollClick) {
              const scrollNumber = scrollName.toLowerCase().replace('scroll', '');
              onScrollClick(`/scroll${scrollNumber}.html`);
            }
          };
          
          // Make the scroll clickable
          scrollMesh.traverse((child) => {
            if (child.isMesh) {
              child.userData.clickable = true;
              child.userData.scrollName = scrollName;
              child.userData.onClick = handleScrollClick;
              
              // Hover will be handled by the main pointer events
              
              if (child.material) {
                // Clone the material to avoid affecting other objects
                const originalMaterial = child.material;
                const glowMaterial = originalMaterial.clone();
                
                // Store original emissive settings
                glowMaterial.userData.originalEmissive = glowMaterial.emissive ? glowMaterial.emissive.clone() : new THREE.Color(0x000000);
                glowMaterial.userData.originalEmissiveIntensity = glowMaterial.emissiveIntensity || 0;
                
                // Add emissive glow
                glowMaterial.emissive = new THREE.Color(0xd4af37); // Golden glow
                glowMaterial.emissiveIntensity = 0.3; // Start with higher base intensity
                
                // Make it slightly transparent for a magical effect
                if (!glowMaterial.transparent) {
                  glowMaterial.transparent = true;
                  glowMaterial.opacity = 0.85;
                }
                
                // Enable better material properties for glow
                if (glowMaterial.metalness !== undefined) {
                  glowMaterial.metalness = 0.3;
                }
                if (glowMaterial.roughness !== undefined) {
                  glowMaterial.roughness = 0.4;
                }
                
                child.material = glowMaterial;
                
                // Store reference for pulsing animation
                scrollMaterialsRef.current.push(glowMaterial);
                
                // console.log(`Applied glow material to ${scrollName}`);
              }
            }
          });
        } else {
          // console.log(`${scrollName} not found in the model`);
        }
      });
    }
  }, [scene, onScrollClick]);
  
  // Add glow effects to ball object and make it clickable
  useEffect(() => {
    if (scene) {
      const ballMesh = scene.getObjectByName('ball');
      if (ballMesh) {
        // console.log('Found ball object, applying glow effect and click handler');
        
        // Store mesh reference for click handling
        ballMeshRef.current = ballMesh;
        
        // Add click handler
        const handleBallClick = (event) => {
          event.stopPropagation();
          // console.log('Ball clicked!');
          if (onBallClick) {
            onBallClick();
          }
        };
        
        // Make the ball clickable
        ballMesh.traverse((child) => {
          if (child.isMesh) {
            child.userData.clickable = true;
            child.userData.ballObject = true;
            child.userData.onClick = handleBallClick;
            
            if (child.material) {
              // Clone the material to avoid affecting other objects
              const originalMaterial = child.material;
              const glowMaterial = originalMaterial.clone();
              
              // Store original emissive settings
              glowMaterial.userData.originalEmissive = glowMaterial.emissive ? glowMaterial.emissive.clone() : new THREE.Color(0x000000);
              glowMaterial.userData.originalEmissiveIntensity = glowMaterial.emissiveIntensity || 0;
              
              // Add emissive glow - more subtle
              glowMaterial.emissive = new THREE.Color(0x4a90e2); // Blue glow for the ball
              glowMaterial.emissiveIntensity = 0.08; // Reduced intensity for subtlety
              
              // Make it slightly transparent for a magical effect
              if (!glowMaterial.transparent) {
                glowMaterial.transparent = true;
                glowMaterial.opacity = 0.9;
              }
              
              child.material = glowMaterial;
              
              // Store reference for pulsing animation
              ballMaterialRef.current = glowMaterial;
              
              // console.log('Applied glow material to ball');
            }
          }
        });
      } else {
        // console.log('Ball object not found in the model');
      }
    }
  }, [scene, onBallClick]);
  
  // Add interaction to Pyramid object
  useEffect(() => {
    if (scene) {
      // console.log('Searching for Pyramid mesh in scene...');
      
      // Find all pyramid-related meshes
      let pyramidMeshes = [];
      scene.traverse((child) => {
        if (child.isMesh && child.name.toLowerCase().includes('pyramid')) {
          pyramidMeshes.push(child);
          // console.log('Found pyramid mesh:', child.name, child);
        }
      });
      
      if (pyramidMeshes.length > 0) {
        // console.log(`Found ${pyramidMeshes.length} pyramid mesh(es)`);
        
        // Add click handler
        const handlePyramidClick = (event) => {
          event.stopPropagation();
          // console.log('Pyramid clicked!');
          if (onPyramidClick) {
            onPyramidClick();
          }
        };
        
        // Apply to all pyramid meshes
        pyramidMeshes.forEach(pyramidMesh => {
          // console.log('Setting up pyramid mesh:', pyramidMesh.name);
          
          // Store first mesh reference
          if (!pyramidMeshRef.current) {
            pyramidMeshRef.current = pyramidMesh;
          }
          
          // Make clickable
          pyramidMesh.userData.clickable = true;
          pyramidMesh.userData.pyramidObject = true;
          pyramidMesh.userData.onClick = handlePyramidClick;
          
          if (pyramidMesh.material) {
            // console.log('Original material:', pyramidMesh.material);
            
            // Clone the material to add glow effect
            const glowMaterial = pyramidMesh.material.clone();
            
            // Add emissive glow
            glowMaterial.emissive = new THREE.Color(0x9d4edd); // Purple glow
            glowMaterial.emissiveIntensity = 0.5; // Increased intensity more
            
            // Ensure the material can show emissive
            if (glowMaterial.metalness !== undefined) {
              glowMaterial.metalness = Math.min(glowMaterial.metalness, 0.5);
            }
            if (glowMaterial.roughness !== undefined) {
              glowMaterial.roughness = Math.max(glowMaterial.roughness, 0.3);
            }
            
            pyramidMesh.material = glowMaterial;
            
            // Store reference for hover effects
            if (!pyramidMaterialRef.current) {
              pyramidMaterialRef.current = glowMaterial;
            }
            
            // console.log('Applied glow material to', pyramidMesh.name);
          }
        });
      } else {
        // console.log('No pyramid meshes found in scene');
      }
    }
  }, [scene, onPyramidClick]);
  
  useEffect(() => {
    // Play multiple animations simultaneously
    const animationsToPlay = ['Experiment', 'HaloRotation', 'escrire', 'Animation'];
    
    if (actions && Object.keys(actions).length > 0) {
      // Play each animation if it exists
      animationsToPlay.forEach(animName => {
        if (actions[animName]) {
          actions[animName].play();
          actions[animName].setLoop(THREE.LoopRepeat);
          actions[animName].timeScale = 1; // Adjust speed if needed
          // console.log(`Playing animation: ${animName}`);
        }
      });
      
      // Also try to play Action or Action.001 if Experiment doesn't exist
      if (!actions['Experiment'] && (actions['Action'] || actions['Action.001'])) {
        const fallbackAnim = actions['Action'] || actions['Action.001'];
        fallbackAnim.play();
        fallbackAnim.setLoop(THREE.LoopRepeat);
        // console.log('Playing fallback animation');
      }
      
      // Play writing animation on Armature.001 if it exists
      if (scene) {
        const armature001 = scene.getObjectByName('Armature.001');
        if (armature001 && actions['escrire']) {
          // console.log('Found Armature.001, playing writing animation');
          actions['escrire'].play();
          actions['escrire'].setLoop(THREE.LoopRepeat);
          actions['escrire'].timeScale = 1;
        }
        
        // Play Animation on Flame object if it exists
        const flame = scene.getObjectByName('Flame');
        if (flame && actions['Animation']) {
          // console.log('Found Flame, playing Animation');
          actions['Animation'].play();
          actions['Animation'].setLoop(THREE.LoopRepeat);
          actions['Animation'].timeScale = 1;
        }
      }
    }
  }, [actions, scene]);
  
  // Check device type
  const isDesktop = windowWidth > 1024;
  const isTablet = windowWidth >= 768 && windowWidth <= 1024;
  const isMobile = windowWidth <= 768;

  // Check if tablet is in portrait mode (height > width)
  const isTabletPortrait = isTablet && windowHeight > windowWidth;

  // Different settings for desktop vs tablet vs mobile with user rotation
  const baseRotationY = isDesktop 
    ? -Math.PI/2
    : isTabletPortrait
    ? -Math.PI/6 // Tablet portrait: slight angle for centered view
    : isTablet 
    ? -Math.PI/2.5 // Tablet landscape: 30° angle
    : -Math.PI/12; // Mobile: 45° angle for better front-facing view
  
  const rotation = [0, baseRotationY + userRotation, 0];
  
  const position = isDesktop 
    ? [centerOffset.x + 1, centerOffset.y - 0, centerOffset.z + 2] // Desktop: offset to right side
    : isTabletPortrait
    ? [centerOffset.x + 1, centerOffset.y - 0, centerOffset.z] // Tablet portrait: offset right
    : isTablet
    ? [centerOffset.x + 2, centerOffset.y + 0.5, centerOffset.z + 1] // Tablet landscape: closer and higher
    : [centerOffset.x, centerOffset.y + 0.5, centerOffset.z - 1]; // Mobile: centered, higher
  
  const scale = isDesktop ? 2 : isTablet ? 1.8 : 1.5; // Tablet: between desktop and mobile

  // Pulsing animation for scroll objects and ball
  useFrame(({ clock }) => {
    if (scrollMaterialsRef.current.length > 0) {
      const time = clock.getElapsedTime();
      const pulseIntensity = 0.3 + Math.sin(time * 2) * 0.15; // Slightly brighter base pulse
      
      scrollMaterialsRef.current.forEach(material => {
        material.emissiveIntensity = pulseIntensity;
      });
    }
    
    // Ball pulsing animation - more subtle
    if (ballMaterialRef.current) {
      const time = clock.getElapsedTime();
      const ballPulseIntensity = 0.04 + Math.sin(time * 1.5) * 0.03; // Much more subtle pulse
      ballMaterialRef.current.emissiveIntensity = ballPulseIntensity;
    }
    
    // Pyramid pulsing animation
    if (pyramidMaterialRef.current) {
      const time = clock.getElapsedTime();
      const pyramidPulseIntensity = 0.5 + Math.sin(time * 1) * 0.15; // Slower pulse for pyramid
      pyramidMaterialRef.current.emissiveIntensity = pyramidPulseIntensity;
    }
  });
  
  // Track current hover state
  const currentHoverRef = useRef(null);
  
  // Handle pointer events - simplified, no scaling
  const handlePointerOver = (event) => {
    event.stopPropagation();
    const intersects = event.intersections;
    if (intersects.length > 0) {
      const hoveredObject = intersects[0].object;
      
      // Check for scroll objects
      if (hoveredObject.userData.scrollName) {
        const scrollName = hoveredObject.userData.scrollName;
        
        // Only apply if not already hovering this object
        if (currentHoverRef.current !== scrollName) {
          console.log(`Hovering over ${scrollName}`);
          currentHoverRef.current = scrollName;
          setHoveredObject(scrollName);
          document.body.style.cursor = 'pointer';
          
          // Only change materials, NO SCALING
          const scrollMesh = scrollMeshesRef.current[scrollName];
          if (scrollMesh) {
            scrollMesh.traverse((child) => {
              if (child.isMesh && child.material) {
                // Store original values if not stored
                if (!child.material.userData.originalEmissiveIntensity) {
                  child.material.userData.originalEmissiveIntensity = child.material.emissiveIntensity;
                }
                // Enhance glow
                child.material.emissiveIntensity = 1.0; // Bright glow
                child.material.emissive = new THREE.Color(0xffd700); // Bright gold
                child.material.opacity = 1;
              }
            });
          }
        }
      }
      // Check for other clickable objects
      else if (hoveredObject.userData.ballObject && currentHoverRef.current !== 'ball') {
        currentHoverRef.current = 'ball';
        setHoveredObject('ball');
        document.body.style.cursor = 'pointer';
      } else if (hoveredObject.userData.pyramidObject && currentHoverRef.current !== 'pyramid') {
        currentHoverRef.current = 'pyramid';
        setHoveredObject('pyramid');
        document.body.style.cursor = 'pointer';
      }
    }
  };
  
  const handlePointerOut = (event) => {
    event.stopPropagation();
    console.log('Pointer out, resetting:', currentHoverRef.current);
    
    // Reset the currently hovered object
    if (currentHoverRef.current && currentHoverRef.current.startsWith('Scroll')) {
      const scrollMesh = scrollMeshesRef.current[currentHoverRef.current];
      if (scrollMesh) {
        // Reset materials only
        scrollMesh.traverse((child) => {
          if (child.isMesh && child.material) {
            // Restore original values
            child.material.emissiveIntensity = child.material.userData.originalEmissiveIntensity || 0.3;
            child.material.emissive = new THREE.Color(0xd4af37); // Normal gold
            child.material.opacity = 0.85;
          }
        });
        
        // Make absolutely sure scale is normal
        if (scrollMesh.userData.originalScale) {
          scrollMesh.scale.copy(scrollMesh.userData.originalScale);
        } else {
          scrollMesh.scale.set(1, 1, 1);
        }
      }
    }
    
    currentHoverRef.current = null;
    setHoveredObject(null);
    document.body.style.cursor = 'auto';
  };
  
  // Handle clicks on scroll objects and ball
  const handleClick = (event) => {
    const intersects = event.intersections;
    // console.log('Click detected, intersections:', intersects.length);
    if (intersects.length > 0) {
      const clickedObject = intersects[0].object;
      // console.log('Clicked object:', clickedObject.name, 'userData:', clickedObject.userData);
      if (clickedObject.userData.clickable && clickedObject.userData.onClick) {
        // console.log('Executing click handler for:', clickedObject.name);
        clickedObject.userData.onClick(event);
      }
    }
  };

  // Handle mouse events for rotation
  const handlePointerDown = (event) => {
    setIsDragging(true);
    setLastMouseX(event.clientX);
  };

  const handlePointerMove = (event) => {
    if (!isDragging) return;
    
    const deltaX = event.clientX - lastMouseX;
    const rotationSpeed = 0.005; // Adjust sensitivity
    const newRotation = userRotation + deltaX * rotationSpeed;
    
    // Clamp rotation to ±10 degrees (Math.PI/18 radians)
    const maxRotation = Math.PI / 18;
    const clampedRotation = Math.max(-maxRotation, Math.min(maxRotation, newRotation));
    
    setUserRotation(clampedRotation);
    setLastMouseX(event.clientX);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };
  
  // Add global event listeners for mouse/touch events
  useEffect(() => {
    const handleGlobalPointerMove = (event) => handlePointerMove(event);
    const handleGlobalPointerUp = () => handlePointerUp();

    if (isDragging) {
      document.addEventListener('pointermove', handleGlobalPointerMove);
      document.addEventListener('pointerup', handleGlobalPointerUp);
    }

    return () => {
      document.removeEventListener('pointermove', handleGlobalPointerMove);
      document.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  }, [isDragging, lastMouseX, userRotation]);

  return (
    <group ref={group} position={position} rotation={rotation} scale={scale}>
      <primitive
        object={scene}
        onClick={handleClick}
        onPointerOver={(e) => {
          handlePointerOver(e);
        }}
        onPointerOut={(e) => {
          handlePointerOut(e);
        }}
        onPointerMove={(e) => {
          // Use pointer move as a backup for hover detection
          if (e.intersections.length > 0) {
            const obj = e.intersections[0].object;
            if (obj.userData.clickable && !hoveredObject) {
              handlePointerOver(e);
            }
          } else if (hoveredObject) {
            handlePointerOut(e);
          }
        }}
        onPointerDown={handlePointerDown}
      />
    </group>
  );
}

function FlatCharts({ onChartClick }) {
  const [priceChartData, setPriceChartData] = useState({
    timestamps: ['Loading...'],
    values: [0]
  });
  
  const [marketCapChartData, setMarketCapChartData] = useState({
    timestamps: ['Loading...'],
    values: [0]
  });
  
  const [rsiChartData, setRsiChartData] = useState({
    timestamps: ['Loading...'],
    values: [0]
  });
  
  const [maChartData, setMaChartData] = useState({
    timestamps: ['Loading...'],
    values: [0],
    ma7: [0],
    ma3: [0]
  });
  
  // Calculate RSI
  const calculateRSI = (prices, period = 14) => {
    if (prices.length < period + 1) return prices.map(() => 50);
    
    const rsiValues = [];
    const gains = [];
    const losses = [];
    
    // Calculate initial average gain/loss
    for (let i = 1; i <= period; i++) {
      const diff = prices[i] - prices[i - 1];
      gains.push(diff > 0 ? diff : 0);
      losses.push(diff < 0 ? Math.abs(diff) : 0);
    }
    
    let avgGain = gains.reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.reduce((a, b) => a + b, 0) / period;
    
    // Calculate RSI for each day
    for (let i = period; i < prices.length; i++) {
      const diff = prices[i] - prices[i - 1];
      const gain = diff > 0 ? diff : 0;
      const loss = diff < 0 ? Math.abs(diff) : 0;
      
      avgGain = ((avgGain * (period - 1)) + gain) / period;
      avgLoss = ((avgLoss * (period - 1)) + loss) / period;
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      rsiValues.push(Math.round(rsi));
    }
    
    // Pad the beginning with neutral RSI values
    while (rsiValues.length < prices.length) {
      rsiValues.unshift(50);
    }
    
    return rsiValues.slice(-7); // Return last 7 days
  };
  
  // Calculate Moving Averages
  const calculateMA = (prices, period) => {
    const ma = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        ma.push(prices[i]); // Use current price if not enough data
      } else {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        ma.push(Math.round(sum / period));
      }
    }
    return ma;
  };
  
  // Fetch Ethereum data from CoinGecko
  // useEffect(() => {
  //   const fetchEthereumData = async () => {
  //     try {
  //       // Fetch 30-day data to calculate proper RSI and MA
  //       const response = await fetch(
  //         'https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=30&interval=daily'
  //       );
        
  //       if (!response.ok) {
  //         throw new Error('Failed to fetch Ethereum data');
  //       }
        
  //       const data = await response.json();
        
  //       // Process price data (last 7 days)
  //       if (data.prices && data.prices.length > 0) {
  //         const last7Days = data.prices.slice(-8, -1); // Get last 7 complete days
  //         const dates = last7Days.map(([timestamp]) => {
  //           const date = new Date(timestamp);
  //           return date.toLocaleDateString('en-US', { weekday: 'short' });
  //         });
          
  //         const prices = last7Days.map(([, price]) => Math.round(price));
  //         const allPrices = data.prices.map(([, price]) => price);
          
  //         setPriceChartData({
  //           timestamps: dates,
  //           values: prices
  //         });
          
  //         // Calculate and set RSI
  //         const rsiValues = calculateRSI(allPrices);
  //         setRsiChartData({
  //           timestamps: dates,
  //           values: rsiValues
  //         });
  //         // console.log('RSI Data:', { timestamps: dates, values: rsiValues });
          
  //         // Calculate and set Moving Averages
  //         const ma7 = calculateMA(allPrices, 7).slice(-7);
  //         const ma3 = calculateMA(allPrices, 3).slice(-7);
          
  //         setMaChartData({
  //           timestamps: dates,
  //           values: prices,
  //           ma7: ma7,
  //           ma3: ma3
  //         });
  //         // console.log('MA Data:', { timestamps: dates, values: prices, ma7, ma3 });
  //       }
        
  //       // Process market cap data (convert to billions)
  //       if (data.market_caps && data.market_caps.length > 0) {
  //         const last7Days = data.market_caps.slice(-8, -1);
  //         const dates = last7Days.map(([timestamp]) => {
  //           const date = new Date(timestamp);
  //           return date.toLocaleDateString('en-US', { weekday: 'short' });
  //         });
          
  //         const marketCaps = last7Days.map(([, cap]) => 
  //           Math.round(cap / 1000000000) // Convert to billions
  //         );
          
  //         setMarketCapChartData({
  //           timestamps: dates,
  //           values: marketCaps
  //         });
  //         // console.log('Market Cap Data:', { timestamps: dates, values: marketCaps });
  //       }
  //     } catch (error) {
  //       console.error('Error fetching Ethereum data:', error);
  //       // Fallback to dummy data if API fails
  //       const fallbackDates = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  //       setPriceChartData({
  //         timestamps: fallbackDates,
  //         values: [2200, 2450, 2300, 2800, 3100, 2900, 3050]
  //       });
  //       setMarketCapChartData({
  //         timestamps: fallbackDates,
  //         values: [265, 295, 276, 336, 372, 348, 366]
  //       });
  //       setRsiChartData({
  //         timestamps: fallbackDates,
  //         values: [45, 52, 48, 65, 72, 68, 70]
  //       });
  //       setMaChartData({
  //         timestamps: fallbackDates,
  //         values: [2200, 2450, 2300, 2800, 3100, 2900, 3050],
  //         ma7: [2150, 2250, 2350, 2450, 2550, 2650, 2750],
  //         ma3: [2100, 2350, 2400, 2520, 2730, 2930, 3020]
  //       });
  //     }
  //   };
    
  //   fetchEthereumData();
  //   // Refresh data every 5 minutes
  //   const interval = setInterval(fetchEthereumData, 300000);
    
  //   return () => clearInterval(interval);
  // }, []);
  
  // const charts = useMemo(() => {
  //   const chartsArray = [];
  //   const chartTypes = [
  //     { data: priceChartData, type: 'line', label: 'ETH Price' },
  //     { data: marketCapChartData, type: 'bar', label: 'Market Cap (B)' },
  //     { data: rsiChartData, type: 'line', label: 'RSI' },
  //     { data: maChartData, type: 'line', label: 'Moving Averages' }
  //   ];
    
    
  //   const positions = [
  //     [-2.5, 1.5, 3],   // Top left
  //     [2.5, 1.5, 3],    // Top right
  //     [-2.5, -0.5, 3],  // Bottom left
  //     [2.5, -0.5, 3]    // Bottom right
  //   ];
    
  //   for (let i = 0; i < 4; i++) {
  //     const chartConfig = chartTypes[i];
      
  //     chartsArray.push({
  //       position: positions[i],
  //       data: chartConfig.data,
  //       type: chartConfig.type,
  //       label: chartConfig.label
  //     });
  //   }
  //   return chartsArray;
  // }, [priceChartData, marketCapChartData, rsiChartData, maChartData]);
  
  // return (
  //   <>
  //     {charts.map((chart, index) => (
  //       <FloatingChart
  //         key={index}
  //         position={chart.position}
  //         chartData={chart.data}
  //         chartType={chart.type}
  //         chartLabel={chart.label}
  //         index={index}
  //         onChartClick={onChartClick}
  //       />
  //     ))}
  //   </>
  // );
}


// Component to load and display the pyramid model in examination view
function PyramidModel() {
  const { scene } = useGLTF('/models/pyramid.glb');
  const meshRef = useRef();
  
  // Clone the scene to avoid modifying the original
  const clonedScene = useMemo(() => scene.clone(), [scene]);
  
  // Apply enhanced material for examination view
  useEffect(() => {
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        // Create a more dramatic material for examination
        const material = child.material.clone();
        material.emissive = new THREE.Color(0x9d4edd);
        material.emissiveIntensity = 0.3;
        material.metalness = 0.6;
        material.roughness = 0.3;
        child.material = material;
      }
    });
  }, [clonedScene]);
  
  // Animate rotation
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.5;
    }
  });
  
  return (
    <primitive 
      ref={meshRef}
      object={clonedScene} 
      scale={[2, 2, 2]}
      position={isMobile ? [0, -2, 0] : [0, 0, 0]}
    />
  );
}

// Preload the pyramid model
useGLTF.preload('/models/pyramid.glb');

export default function Philosophy({ modelPath = '/models/saint_robot2.glb', onLoadingChange, is80sMode = false }) {
  const { locale } = useLanguage();
  const [selectedChart, setSelectedChart] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [windowHeight, setWindowHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 768);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  // Detect device type based on actual window dimensions (not iframe)
  const getDeviceType = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isPortrait = h > w;
    
    // iPad Pro 12.9" Portrait
    if (w >= 1024 && w <= 1050 && h >= 1350 && h <= 1380) {
      return 'ipad-pro-12-portrait';
    }
    // iPad Pro 12.9" Landscape
    if (w >= 1350 && w <= 1380 && h >= 1000 && h <= 1050) {
      return 'ipad-pro-12-landscape';
    }
    
    // iPad Pro 11" Portrait
    if (w >= 820 && w <= 850 && h >= 1180 && h <= 1210) {
      return 'ipad-pro-11-portrait';
    }
    // iPad Pro 11" Landscape
    if (w >= 1180 && w <= 1210 && h >= 820 && h <= 850) {
      return 'ipad-pro-11-landscape';
    }
    
    // iPad Mini Portrait
    if (w >= 760 && w <= 780 && h >= 1000 && h <= 1050) {
      return 'ipad-mini-portrait';
    }
    // iPad Mini Landscape
    if (w >= 1000 && w <= 1050 && h >= 760 && h <= 780) {
      return 'ipad-mini-landscape';
    }
    
    // Regular iPad Portrait
    if (w >= 768 && w <= 850 && h >= 1000 && h <= 1100 && isPortrait) {
      return 'ipad-portrait';
    }
    // Regular iPad Landscape
    if (w >= 1000 && w <= 1100 && h >= 768 && h <= 850 && !isPortrait) {
      return 'ipad-landscape';
    }
    
    // Mobile
    if (w <= 768 && h <= 950) {
      return 'mobile';
    }
    // Desktop
    return 'desktop';
  };

  const deviceType = getDeviceType();
  
  // Device-specific positioning for iframe
  const getIframePositioning = (device) => {
    const positions = {
      // iPad Pro 12.9"
      'ipad-pro-12-portrait': {
        left: '2%',
        bottom: '10rem',
        width: '55%',
        height: '40%'
      },
      'ipad-pro-12-landscape': {
        left: '3%',
        bottom: '10rem',
        width: '45%',
        height: '45%'
      },
      // iPad Pro 11"
      'ipad-pro-11-portrait': {
        left: '2%',
        bottom: '10rem',
        width: '42%',
        height: '38%'
      },
      'ipad-pro-11-landscape': {
        left: '3%',
        bottom: '9rem',
        width: '38%',
        height: '43%'
      },
      // iPad Mini
      'ipad-mini-portrait': {
        left: '3%',
        bottom: '5rem',
        width: '58%',
        height: '45%'
      },
      'ipad-mini-landscape': {
        left: '1%',
        bottom: '2rem',
        width: '50%',
        height: '65%'
      },
      // Regular iPad
      'ipad-portrait': {
        left: '1%',
        bottom: '7rem',
        width: '38%',
        height: '35%'
      },
      'ipad-landscape': {
        left: '1%',
        bottom: '8rem',
        width: '50%',
        height: '95%'
      },
      // Desktop
      'desktop': {
        left: '0',
        bottom: '4rem',
        width: '50%',
        height: '60%'
      },
      // Mobile
      'mobile': {
        left: '1rem',
        bottom: '4rem',
        width: 'calc(100% - 2rem)',
        height: '40%'
      }
    };
    return positions[device] || positions['desktop'];
  };
  
  const iframePos = getIframePositioning(deviceType);
  const [currentScrollSrc, setCurrentScrollSrc] = useState(`/scroll5.html?device=${deviceType}&lang=${locale}`); // Default scroll with device info
  const [showNumerology, setShowNumerology] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [nextScrollSrc, setNextScrollSrc] = useState(null);
  const [showMagnifiedScroll, setShowMagnifiedScroll] = useState(false);
  const [examinedObject, setExaminedObject] = useState(null); // For examining the pyramid
  const [showIntroText, setShowIntroText] = useState(true); // Control intro text visibility
  const [magnifiedZoom, setMagnifiedZoom] = useState(1.25); // Track zoom level for magnified view
  const [showPlainText, setShowPlainText] = useState(false); // Toggle plain text view
  const scrollIframeRef = useRef(null);
  const mobileScrollIframeRef = useRef(null);
  const magnifiedIframeRef = useRef(null); // Add ref for magnified iframe
  const isMobile = windowWidth <= 768;

  
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);
  
  // Check device type for overlay logic
  const isDesktop = windowWidth > 1024;
  const isTablet = windowWidth > 768 && windowWidth <= 1024;
  const isTabletPortrait = isTablet && windowHeight > windowWidth;
  
  // Load UnifrakturCook Font
  useEffect(() => {
    // Create @font-face style for local font
    const fontStyle = document.createElement('style');
    fontStyle.textContent = `
      @font-face {
        font-family: 'UnifrakturCook';
        src: url('/fonts/UnifrakturCook-Bold.ttf') format('truetype');
        font-weight: 700;
        font-style: normal;
        font-display: block;
      }
    `;
    document.head.appendChild(fontStyle);
    
    // Check if font is loaded using FontFaceSet API
    const checkFont = async () => {
      try {
        // Create a test element to force font loading
        const testDiv = document.createElement('div');
        testDiv.style.fontFamily = 'UnifrakturCook';
        testDiv.style.fontSize = '1px';
        testDiv.style.position = 'absolute';
        testDiv.style.visibility = 'hidden';
        testDiv.innerHTML = 'Test';
        document.body.appendChild(testDiv);
        
        // Wait for fonts to be ready
        if (document.fonts) {
          await document.fonts.ready;
          // console.log('Document fonts ready');
          
          // Check if our specific font is loaded
          const fontLoaded = document.fonts.check('700 1em UnifrakturCook');
          // console.log('UnifrakturCook font check:', fontLoaded);
          
          if (!fontLoaded) {
            // Try to explicitly load the font
            await document.fonts.load('700 1em UnifrakturCook');
          }
        }
        
        // Remove test element
        document.body.removeChild(testDiv);
        
        setFontLoaded(true);
        document.documentElement.classList.add('fonts-loaded');
      } catch (e) {
        console.error('Error during font loading:', e);
        // Fallback: just show the heading after a delay
        setTimeout(() => {
          // console.log('Showing heading after timeout');
          setFontLoaded(true);
          document.body.classList.add('fonts-loaded');
        }, 1500);
      }
    };
    
    // Start font loading check
    checkFont();
    
    return () => {
      if (fontStyle.parentNode) {
        document.head.removeChild(fontStyle);
      }
    };
  }, []);
  
  // Hide loader only when everything is loaded
  useEffect(() => {
    // console.log('Philosophy loading status:', { modelLoaded, fontLoaded, iframeLoaded, isDesktop });
    if (modelLoaded && fontLoaded && (iframeLoaded || !isDesktop)) {
      // console.log('All conditions met, hiding loader');
      // Add a small delay for smooth transition
      setTimeout(() => {
        setIsLoading(false);
        if (onLoadingChange) onLoadingChange(false);
      }, 500);
    }
  }, [modelLoaded, fontLoaded, iframeLoaded, isDesktop, onLoadingChange]);
  
  // Notify parent when loading starts
  useEffect(() => {
    if (onLoadingChange) onLoadingChange(true);
  }, []);
  
  return (
    <div style={{ 
      width: '100%', 
      height: '100vh', 
      background: is80sMode ? 'transparent' : '#000000', 
      position: 'relative',
      animation: is80sMode ? 'subtle-glitch 8s infinite' : 'none',
      overflow: 'hidden'
    }}>
      {/* Show loader over entire page when loading */}
      {isLoading && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0,
          zIndex: 99999,
          background: '#000000'
        }}>
          <CoinLoader />
        </div>
      )}
      
      {/* Heading - Show only after loading is complete */}
      {(isDesktop || isTablet || deviceType.includes('ipad')) && !isLoading && (
        <div style={{
          position: 'absolute',
          left: '0',
          top: isMobile ? '4rem' : '2rem',
          width: '50%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '1rem',
          zIndex: 100,
          pointerEvents: 'none',
          // backgroundColor: 'rgba(0, 0, 0, 0.3)', // Subtle black background
          borderRadius: '10px' // Rounded corners
        }}>
          <h1 style={{ 
            color: '#8e662b', // Golden brown color
            fontFamily: 'UnifrakturCook, serif', // Use UnifrakturCook font
            textShadow: '3px 3px 5px #000, -1px -1px 5px pink',
            fontSize: '4rem',
            fontWeight: 700,
            lineHeight: 0.8,
            transform: 'rotate(-8deg) skew(-15deg)',
            margin: 0,
            opacity: 1,
            visibility: 'visible',
            display: 'block',
            position: 'relative',
            zIndex: 101
          }}>The Scrolls <br/>of St. GR80</h1>
        </div>
      )}
      
      {/* Mobile Heading + Intro Text - Show only after loading is complete */}
      {windowWidth < 768 && !isLoading && (
        <div style={{
          position: 'absolute',
          top: '0.5rem',
          left: '1rem',

          zIndex: 100,
          textAlign: 'left',
          pointerEvents: 'none',
          borderRadius: '10px',
          padding: '1rem',
          maxWidth: '75%'
        }}>
          <h1 style={{
            color: '#8e662b',
            fontFamily: 'UnifrakturCook, serif',
            textShadow: '3px 3px 5px #000, -1px -1px 5px pink',
            fontSize: windowWidth <= 480 ? '2.5rem' : '3rem',
            fontWeight: 700,
            lineHeight: 0.8,
            transform: 'rotate(-8deg) skew(-15deg)',
            margin: 0,
            opacity: 1,
            visibility: 'visible'
          }}>The <br/>Scrolls <span style={{fontSize: '1.5rem', position: 'relative', top: '-0.5rem', left: '-0.5rem'}}>of</span><br/>St. GR80</h1>

          {/* Mobile intro text */}
          {showIntroText && (
            <div style={{
              marginTop: '3rem',
              padding: '0.4rem',
              background: 'linear-gradient(135deg, rgba(194, 154, 77, 0.2) 0%, rgba(142, 102, 43, 0.15) 50%, rgba(194, 154, 77, 0.2) 100%)',
              border: '2px double #8e662b',
              maxWidth: '220px',
              position: 'relative',
              pointerEvents: 'none',
              boxShadow: 'inset 0 0 20px rgba(142, 102, 43, 0.3), 0 3px 6px rgba(0, 0, 0, 0.5)',
              clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)',
              transform: 'rotate(0deg) skew(0deg)',
            }}>
              <p style={{
                color: '#d4af37',
                fontSize: '0.72rem',
                fontWeight: 500,
                letterSpacing: '0.02em',
                lineHeight: 1.2,
                margin: 0,
                textAlign: 'center',
                textShadow: '2px 2px 4px rgba(0, 0, 0, 0.9), 0 0 15px rgba(212, 175, 55, 0.3)',
                fontStyle: 'italic',
                pointerEvents: 'none'
              }}>
                Here you can find the works of devout RL80 devotee, Saint GR80, the anachronistic android, mystic and medieval scholar.
              </p>
              <button
                onClick={() => setShowIntroText(false)}
                style={{
                  position: 'absolute',
                  bottom: '-6px',
                  right: '-6px',
                  background: 'rgba(142, 102, 43, 0.4)',
                  border: '1px solid #8e662b',
                  color: '#8e662b',
                  width: '1rem',
                  height: '1rem',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  opacity: 0.6,
                  pointerEvents: 'auto'
                }}
                aria-label="Hide introduction"
                title="Hide this message"
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* Main content - hidden while loading */}
      <div style={{
        width: '100%',
        height: '100%',
        display: 'block',
        opacity: isLoading ? 0 : 1,
        transition: 'opacity 0.5s ease-in-out'
      }}>
      
      {/* Full-width 3D Model Container */}
      <div style={{
        width: '100%',
        height: '100%',
        position: 'relative'
      }}>
        
        {/* Left Column Overlay - Intro text and Scroll (Desktop, Tablet, and iPads) */}
        {(isDesktop || isTablet || deviceType.includes('ipad')) && (
          <>
            {/* Intro text Section - positioned below heading */}
            <div style={{
              position: 'absolute',
              left: '0',
              top: '0',
              width: '50%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'center',
              padding: '1rem',
              paddingTop: isMobile ? '8rem' : '8rem',
              zIndex: 1000,
              pointerEvents: 'none'  // Allow clicks to pass through to the 3D scene
            }}>
              {/* Heading placeholder - keep structure */}
              <div style={{
                marginBottom: '1rem',
                textAlign: 'center',
                pointerEvents: 'none'
              }}>
                <div style={{ height: '4rem' }}></div>
                
                {/* Introduction text - Parchment style */}
                {showIntroText && (
                  <div style={{
                    // marginTop: isTablet ? '0' : '0.5rem',
                    padding: '0.5rem',
                    background: 'linear-gradient(135deg, rgba(194, 154, 77, 0.2) 0%, rgba(142, 102, 43, 0.15) 50%, rgba(194, 154, 77, 0.2) 100%)',
                    border: '3px double #8e662b',
                    borderRadius: '0',
                    maxWidth: '320px',
                    margin: `${isTablet ? '1rem' : '0'} auto 0`,
                    position: 'relative',
                    pointerEvents: 'none', // Allow clicks to pass through the container
                    boxShadow: `
                      inset 0 0 30px rgba(142, 102, 43, 0.3),
                      0 4px 8px rgba(0, 0, 0, 0.5),
                      0 0 20px rgba(212, 175, 55, 0.1)
                    `,
                    clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%)'
                  }}>
                    {/* Decorative corner flourish */}
                    <div style={{
                      position: 'absolute',
                      top: '-5px',
                      left: '-5px',
                      fontSize: '1.5rem',
                      color: '#8e662b',
                      opacity: 0.7,
                      pointerEvents: 'none'
                    }}>✦</div>
                    <div style={{
                      position: 'absolute',
                      top: '-5px',
                      right: '-5px',
                      fontSize: '1.5rem',
                      color: '#8e662b',
                      opacity: 0.7,
                      pointerEvents: 'none'
                    }}>✦</div>
                    
                    {/* Main text content */}
                    <p style={{
                      color: '#d4af37',
                      fontSize: '0.9rem',
                      fontWeight: 500,
                      letterSpacing: '0.03em',
                      lineHeight: 1,
                      margin: '0 0 0.5rem 0',
                      textAlign: 'center',
                      textShadow: `
                        2px 2px 4px rgba(0, 0, 0, 0.9),
                        0 0 20px rgba(212, 175, 55, 0.3)
                      `,
                      fontStyle: 'italic',
                      pointerEvents: 'none'
                    }}>
                      Here you can find the works of devout RL80 devotee, Saint GR80, the anachronistic android, mystic and medieval scholar.
                    </p>
                    
                    {/* Additional flavor text */}
                    {/* <p style={{
                      color: '#c29a4d',
                      fontFamily: 'Georgia, "Times New Roman", serif',
                      fontSize: '0.95rem',
                      lineHeight: 1.5,
                      margin: 0,
                      textAlign: 'center',
                      textShadow: '1px 1px 3px rgba(0, 0, 0, 0.8)',
                      opacity: 0.9,
                      pointerEvents: 'none'
                    }}>
                      ✧ Click the scrolls to explore ancient wisdom ✧<br/>
                    </p> */}
                    
                    {/* Close button - needs pointer events */}
                    <button
                      onClick={() => setShowIntroText(false)}
                      style={{
                        position: 'absolute',
                        bottom: '-8px',
                        right: '-8px',
                        background: 'rgba(142, 102, 43, 0.4)',
                        border: '1px solid #8e662b',
                        color: '#8e662b',
                        width: '1.2rem',
                        height: '1.2rem',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        padding: 0,
                        opacity: 0.6,
                        pointerEvents: 'auto' // Button needs to be clickable
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.opacity = '1';
                        e.target.style.background = 'rgba(142, 102, 43, 0.6)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.opacity = '0.6';
                        e.target.style.background = 'rgba(142, 102, 43, 0.4)';
                      }}
                      aria-label="Hide introduction"
                      title="Hide this message"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            {/* Scroll iframe - separate positioning based on device */}
            <div style={{
              position: 'absolute',
              left: iframePos.left,
              bottom: iframePos.bottom,
              width: iframePos.width,
              height: iframePos.height,
              padding: '2rem',
              zIndex: 1000,
              pointerEvents: 'none'
            }}>
              <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                {/* Double-click magnify button */}
                <button
                  onClick={() => {
                    setMagnifiedZoom(1.25); // Reset zoom to default when opening
                    setShowMagnifiedScroll(true);
                  }}
                  style={{
                    position: 'absolute',
                    top: '60%',
                    left: '85%',
                    background: 'rgba(212, 175, 55, 0.3)',
                    border: '1px solid rgba(212, 175, 55, 0.6)',
                    color: '#d4af37',
                    padding: '0.25rem',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    fontSize: '3.8rem',
                    zIndex: 10,
                    pointerEvents: 'auto'
                  }}
                  title="Magnify scroll"
                >
                  🔍
                </button>
                
                <iframe
                  ref={scrollIframeRef}
                  src={currentScrollSrc}
                  onLoad={() => {
                    setIframeLoaded(true);
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    pointerEvents: 'auto', // Allow iframe interaction
                    background: 'transparent',
                    opacity: 0.9,
                    mixBlendMode: 'screen',
                    transition: 'opacity 0.5s'
                  }}
                  title="Scroll Overlay"
                />
              </div>
            </div>
          </>
        )}
        {/* 80s Mode Video Background */}
        {is80sMode && (
          <video
            autoPlay
            loop
            muted
            playsInline
            style={{
              position: 'absolute',
              top: isDesktop ? '20%' : isMobile ? '23%' : '30%',
              ...(isDesktop ? { left: '50%' } : isMobile ? { right: '65%' } : { right: '30%' }),
              transform: isDesktop ? 'translate(-50%, -50%) scale(0.6)' : isMobile ? 'translate(50%, -50%) scale(0.35)' : 'translate(50%, -50%) scale(0.4)',
              width: '50%',
              height: '50%',
              objectFit: 'contain',
              zIndex: 0,
              opacity: 0.7,
              // borderRadius: '10px',
              // boxShadow: '0 0 30px rgba(217, 70, 239, 0.5)'
            }}
          >
            <source src="/videos/neon80s.mp4" type="video/mp4" />
          </video>
        )}
        <CleanCanvas
          style={{ position: 'relative', zIndex: 1, pointerEvents: 'auto' }}
          camera={{ 
            position: isDesktop 
              ? [-7, 1, 6.5] 
              : isTablet 
              ? [-6, 1.5, 6] 
              : [4, 1, 5], 
            fov: isDesktop ? 40 : isTablet ? 45 : 50 
          }}
          gl={{ 
            antialias: true, 
            toneMapping: THREE.ACESFilmicToneMapping, 
            alpha: true,  // Keep alpha for compatibility
            premultipliedAlpha: true,  // Standard alpha handling
            preserveDrawingBuffer: false,
            failIfMajorPerformanceCaveat: false,
            powerPreference: "high-performance"
          }}
        >
        <ambientLight intensity={0.2} />
        {/* Multiple point lights around the cylinder */}
        {/* <pointLight position={[0, 3, 0]} color="#00ffff" intensity={0.3} />
        <pointLight position={[3, 2, 0]} color="#ff64ff" intensity={0.3} />
        <pointLight position={[-3, 2, 0]} color="#00ffff" intensity={0.3} />
        <pointLight position={[0, 2, 3]} color="#ff64ff" intensity={0.3} />
        <pointLight position={[0, 2, -3]} color="#00ffff" intensity={0.3} /> */}
        
        <Suspense fallback={null}>
          <Model 
            modelPath={modelPath} 
            onLoaded={() => setModelLoaded(true)} 
            is80sMode={is80sMode} 
            onScrollClick={(scrollPath) => {
              // Don't transition if already transitioning
              if (isTransitioning) return;
              
              // Store next scroll with device parameter
              setNextScrollSrc(`${scrollPath}?device=${deviceType}&lang=${locale}`);
              setIsTransitioning(true);
              
              // Hide iframe during transition
              const iframe = isDesktop || isTablet ? scrollIframeRef.current : mobileScrollIframeRef.current;
              if (iframe) {
                iframe.style.opacity = '0';
                iframe.style.transition = 'opacity 0.3s';
              }
            }}
            onBallClick={() => setShowNumerology(true)}
            onPyramidClick={() => {}} // Disabled for now
          />
          <Environment preset="night" />
          {/* <FlatCharts onChartClick={setSelectedChart} /> */}
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            enableRotate={true}
            minDistance={3}
            maxDistance={10}
            minPolarAngle={Math.PI / 3}    // ~60° - allow looking slightly from above
            maxPolarAngle={Math.PI / 2.2}  // ~82° - prevent looking from below
            minAzimuthAngle={-Math.PI / 8}  // -22.5 degrees
            maxAzimuthAngle={Math.PI / 8}   // +22.5 degrees (±22.5° total range)
            rotateSpeed={0.3}
            zoomSpeed={0.8}
            dampingFactor={0.05}
            enableDamping={true}
            target={[0, 0, 0]}
          />
        </Suspense>
        {is80sMode ? (
          <EffectComposer>
            <Bloom
              intensity={0.5}  // Reduced from 1 for this scene
              luminanceThreshold={0.3}  // Slightly lower to catch highlights
              luminanceSmoothing={0.5}
              radius={0.4}
              blendFunction={BlendFunction.ADD}
            />
            <ChromaticAberration
              offset={[0.01, 0.01]}
              radialModulation={true}
              modulationOffset={0.5}
            />
            <Scanline
              density={35.0}
              opacity={0.8}
              blendFunction={BlendFunction.OVERLAY}
            />
            <Glitch
              delay={[3.0, 5.0]}
              chromaticAberrationOffset={[0.00002, 0.000005]}
              mode={GlitchMode.SPORADIC}
            />
            <Noise opacity={0.15} />
            <Vignette eskil={false} offset={0.05} darkness={0.5} />
          </EffectComposer>
        ) : (
          <EffectComposer>
            <Bloom 
              intensity={0.9}
              luminanceThreshold={0.5}
              luminanceSmoothing={0.9}
              radius={0.3}
            />
          </EffectComposer>
        )}
      </CleanCanvas>
        
        {/* Mobile overlays - only show on actual mobile devices */}
        {windowWidth <= 768 && !deviceType.includes('ipad') && (
          <>
            
            {/* Scroll overlay for mobile/iPad - repositioned and resized based on device */}
            <div
              style={{
                position: 'absolute',
                bottom: deviceType === 'ipad-mini' ? '5rem' :
                        deviceType === 'ipad' ? '4rem' : '3rem',
                left: deviceType === 'ipad-mini' ? '25%' :
                      deviceType === 'ipad' ? '20%' : '1rem',
                right: deviceType === 'ipad-mini' ? '25%' :
                       deviceType === 'ipad' ? '20%' : '1rem',
                width: deviceType === 'ipad-mini' ? '50%' :
                       deviceType === 'ipad' ? '60%' : 'calc(100% - 2rem)',
                height: deviceType === 'ipad-mini' ? '45%' :
                        deviceType === 'ipad' ? '42%' :
                        windowWidth <= 480 ? '35%' : '40%',
                zIndex: 5,
                borderRadius: '8px'
              }}
            >
              {/* Mobile magnify button - positioned better */}
              <button
                onClick={() => {
                  setMagnifiedZoom(1.25); // Reset zoom to default when opening
                  setShowMagnifiedScroll(true);
                }}
                style={{
                  position: 'absolute',
                  top: isMobile ? '0' : '-2.5rem',
                  right: '0.5rem',
                  background: 'rgba(212, 175, 55, 0.4)',
                  border: '2px solid rgba(212, 175, 55, 0.8)',
                  color: '#d4af37',
                  padding: '0.4rem',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: isMobile ? '2.5rem' : '2.5rem',
                  zIndex: 10,
                  pointerEvents: 'auto',
                  width: isMobile ? '3.5rem' : '2.5rem',
                  height: isMobile ? '3.5rem' : '2.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
                  transition: 'all 0.3s ease'
                }}
                onTouchStart={(e) => {
                  e.currentTarget.style.transform = 'scale(0.95)';
                  e.currentTarget.style.background = 'rgba(212, 175, 55, 0.6)';
                }}
                onTouchEnd={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.background = 'rgba(212, 175, 55, 0.4)';
                }}
                title="Magnify scroll"
                aria-label="Magnify scroll for better reading"
              >
                🔍
              </button>
              
              <iframe
                ref={mobileScrollIframeRef}
                src={currentScrollSrc}
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                  pointerEvents: 'auto', // Allow iframe interaction
                  background: 'transparent',
                  opacity: 0.85,
                  mixBlendMode: 'screen',
                  borderRadius: '8px',
                  transition: 'opacity 0.5s'
                }}
                title="Scroll Overlay"
              />
            </div>
          </>
        )}
      </div>
      </div>
      
      {/* Scroll Transition Effect */}
      <ScrollTransition 
        isTransitioning={isTransitioning}
        scrollBounds={(() => {
          const iframe = isDesktop || isTablet ? scrollIframeRef.current : mobileScrollIframeRef.current;
          if (iframe) {
            const rect = iframe.getBoundingClientRect();
            return {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height
            };
          }
          return null;
        })()}
        onComplete={() => {
          // Change to new scroll
          if (nextScrollSrc) {
            setCurrentScrollSrc(nextScrollSrc);
            setNextScrollSrc(null);
            
            // Give iframe time to load new content
            setTimeout(() => {
              const iframe = isDesktop || isTablet ? scrollIframeRef.current : mobileScrollIframeRef.current;
              if (iframe) {
                iframe.style.transition = 'opacity 0.5s';
                iframe.style.opacity = '0.9';
              }
              setIsTransitioning(false);
            }, 200);
          }
        }}
      />
      
      {/* Numerology Modal Overlay - Styled like Pyramid viewer */}
      {showNumerology && (
        <div
          onClick={() => setShowNumerology(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.95)',
            zIndex: 10001,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '2rem',
            cursor: 'pointer'
          }}
        >
          {/* Content wrapper - stops click propagation */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'default'
            }}
          >
            {/* Title */}
            <h2 style={{
              color: '#d4af37',
              fontFamily: 'UnifrakturCook',
              fontSize: '2.5rem',
              marginBottom: '1rem',
              textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
              textAlign: 'center'
            }}>
              Magic 80-Ball
            </h2>

            {/* Content container with glow effect */}
            <div
              style={{
                position: 'relative',
                width: windowWidth > 768 ? '600px' : '100%',
                maxHeight: windowWidth > 768 ? '600px' : '70vh',
                background: 'radial-gradient(ellipse at center, rgba(74, 144, 226, 0.1) 0%, rgba(0, 0, 0, 0.8) 100%)',
                borderRadius: '1rem',
                border: '2px solid rgba(74, 144, 226, 0.5)',
                boxShadow: '0 0 30px rgba(74, 144, 226, 0.3)',
                padding: '2rem',
                overflow: 'auto'
              }}
            >
              {/* Numerology component */}
              <Numerology isMobile={windowWidth <= 768} />
            </div>

            {/* Description */}
            <p style={{
              color: '#d4af37',
              fontSize: '1.1rem',
              maxWidth: '20rem',
              textAlign: 'center',
              marginTop: '1.5rem',
              lineHeight: 1.6,
              textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
            }}>
              Consult the mystical 8-ball for divine numerological insights and ancient wisdom.<br/>
              (Not financial advice.)
            </p>
          </div>
        </div>
      )}
      
      {/* Magnified Scroll Modal Overlay */}
      {showMagnifiedScroll && (
        <div 
          onClick={() => setShowMagnifiedScroll(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: isMobile ? 'flex-start' : 'center',
            zIndex: 10001,
            backdropFilter: 'blur(5px)'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: isMobile ? '100vw' : '95vw',
              maxWidth: isMobile ? 'none' : '50vw',
              height: isMobile ? '100dvh' : '95vh',
              maxHeight: isMobile ? '-webkit-fill-available' : 'none',
              background: 'rgba(20, 20, 20, 0.95)',
              borderRadius: isMobile ? '0' : '1rem',
              border: isMobile ? 'none' : '2px solid #8e662b',
              padding: isMobile ? '0.5rem 0.5rem 0' : '1rem',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMagnifiedScroll(false);
              }}
              style={{
                position: 'absolute',
                top: isMobile ? '0.25rem' : '1rem',
                right: isMobile ? '0.25rem' : '1rem',
                background: isMobile ? 'rgba(20, 20, 20, 0.8)' : 'none',
                border: isMobile ? '1px solid #8e662b' : 'none',
                color: '#d4af37',
                fontSize: '1.5rem',
                cursor: 'pointer',
                fontWeight: 'bold',
                padding: '0.5rem',
                borderRadius: '50%',
                width: '2.5rem',
                height: '2.5rem',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                transition: 'all 0.3s ease',
                zIndex: 10003
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(212, 175, 55, 0.2)';
                e.target.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = isMobile ? 'rgba(20, 20, 20, 0.8)' : 'none';
                e.target.style.transform = 'scale(1)';
              }}
            >
              ×
            </button>
            
            {/* Title */}
            <div style={{
              color: '#d4af37',
              fontSize: isMobile ? '1rem' : '1.2rem',
              fontWeight: 'bold',
              marginBottom: isMobile ? '0.5rem' : '1rem',
              marginTop: isMobile ? '0.25rem' : '0',
              textAlign: 'center',
              fontFamily: '"UnifrakturCook", serif',
              flexShrink: 0
            }}>
              {(() => {
                const romanNumerals = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V' };
                let numeral = null;
                const base = currentScrollSrc
                  .split('?')[0]
                  .replace('.html', '')
                  .replace('/', '')
                  .replace(/scroll(\d+)?/i, (_, num) => {
                    if (num) numeral = romanNumerals[num] || num;
                    return 'Scroll';
                  });
                return <>{base}{numeral && <span style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}> {numeral}</span>} - Magnified View</>;
              })()}
            </div>
            
            {/* Magnified iframe with zoom controls */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              marginBottom: isMobile ? '0.25rem' : '0.5rem',
              gap: isMobile ? '0.4rem' : '1rem',
              position: 'relative',
              zIndex: 10002,
              pointerEvents: 'auto',
              padding: isMobile ? '0 2.5rem' : '0',
              flexShrink: 0
            }}>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const newZoom = Math.max(1.0, magnifiedZoom - 0.25);
                  setMagnifiedZoom(newZoom);
                }}
                style={{
                  background: 'rgba(212, 175, 55, 0.2)',
                  border: '1px solid #d4af37',
                  color: '#d4af37',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  zIndex: 10002
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(212, 175, 55, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(212, 175, 55, 0.2)';
                }}
              >
                Zoom Out
              </button>
              <span style={{
                color: '#d4af37',
                fontSize: '1rem',
                alignSelf: 'center'
              }}>
                {Math.round(magnifiedZoom * 100)}%
              </span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const newZoom = Math.min(2.0, magnifiedZoom + 0.25);
                  setMagnifiedZoom(newZoom);
                }}
                style={{
                  background: 'rgba(212, 175, 55, 0.2)',
                  border: '1px solid #d4af37',
                  color: '#d4af37',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  zIndex: 10002
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(212, 175, 55, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(212, 175, 55, 0.2)';
                }}
              >
                Zoom In
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowPlainText(!showPlainText);
                }}
                style={{
                  background: showPlainText ? 'rgba(212, 175, 55, 0.5)' : 'rgba(212, 175, 55, 0.2)',
                  border: '1px solid #d4af37',
                  color: '#d4af37',
                  padding: '0.5rem 1rem',
                  borderRadius: '0.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  zIndex: 10002
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(212, 175, 55, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = showPlainText ? 'rgba(212, 175, 55, 0.5)' : 'rgba(212, 175, 55, 0.2)';
                }}
              >
                {showPlainText ? 'Original Font' : 'Plain Text'}
              </button>
            </div>

            {/* Iframe container with overflow for zooming */}
            <div style={{
              width: '100%',
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              borderRadius: '0.5rem',
            }}>
              {/* Magnified iframe */}
              <iframe
                ref={magnifiedIframeRef}
                id="magnified-iframe"
                src={`${currentScrollSrc}&flat=true${showPlainText ? '&plaintext=true' : ''}`}
                style={{
                  width: `${100 / magnifiedZoom}%`,
                  height: `${100 / magnifiedZoom}%`,
                  border: 'none',
                  background: '#fefee0',
                  borderRadius: '0.5rem',
                  transform: `scale(${magnifiedZoom})`,
                  transformOrigin: 'top left',
                }}
                title="Magnified Scroll"
              />
            </div>
          </div>
        </div>
      )}
      
      {/* Pyramid Examination Overlay */}
      {examinedObject === 'pyramid' && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.95)',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2rem'
        }}>
          {/* Close button */}
          <button
            onClick={() => setExaminedObject(null)}
            style={{
              position: 'absolute',
              top: '2rem',
              right: '2rem',
              background: 'rgba(212, 175, 55, 0.2)',
              border: '2px solid #d4af37',
              color: '#d4af37',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1.2rem',
              fontFamily: 'Georgia, serif',
              transition: 'all 0.3s ease',
              zIndex: 10001
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(212, 175, 55, 0.4)';
              e.target.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(212, 175, 55, 0.2)';
              e.target.style.transform = 'scale(1)';
            }}
          >
            Close ✕
          </button>
          
          {/* Title */}
          <h2 style={{
            color: '#d4af37',
            fontFamily: 'Georgia, serif',
            fontSize: '2.5rem',
            marginBottom: '1rem',
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
            textAlign: 'center'
          }}>
            The Sacred Pyramid
          </h2>
          
          {/* 3D Canvas for examining the pyramid */}
          <div style={{
            width: windowWidth > 768 ? '600px' : '90%',
            height: windowWidth > 768 ? '600px' : '400px',
            background: 'radial-gradient(ellipse at center, rgba(157, 78, 221, 0.1) 0%, rgba(0, 0, 0, 0.8) 100%)',
            borderRadius: '1rem',
            border: '2px solid rgba(157, 78, 221, 0.5)',
            boxShadow: '0 0 30px rgba(157, 78, 221, 0.3)',
            position: 'relative'
          }}>
            <Canvas
              camera={{ position: [3, 3, 3], fov: 50 }}
              style={{ borderRadius: '1rem' }}
            >
              <ambientLight intensity={0.5} />
              <pointLight position={[10, 10, 10]} intensity={0.5} />
              <pointLight position={[-10, -10, -10]} intensity={0.2} color="#9d4edd" />
              
              <Suspense fallback={null}>
                {/* Load the actual pyramid GLB model */}
                <PyramidModel />
                <OrbitControls 
                  enablePan={false}
                  enableZoom={true}
                  minDistance={1}
                  maxDistance={5}
                  autoRotate
                  autoRotateSpeed={2}
                />
              </Suspense>
            </Canvas>
          </div>
          
          {/* Description */}
          <p style={{
            color: '#d4af37',
            fontFamily: 'Georgia, serif',
            fontSize: '1.1rem',
            maxWidth: '600px',
            textAlign: 'center',
            marginTop: '1.5rem',
            lineHeight: 1.6,
            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
          }}>
            An ancient artifact of mysterious origin, this pyramid holds secrets of the digital realm.
            Rotate to examine its mystical geometry and divine proportions.
          </p>
        </div>
      )}
      
      {/* 80s Mode Full-Page Effects */}
      {is80sMode && (
        <>
          {/* Scanlines overlay */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 9998,
            background: `repeating-linear-gradient(
              0deg,
              rgba(0, 0, 0, 0) 0px,
              rgba(0, 0, 0, 0) 2px,
              rgba(0, 0, 0, 0.03) 2px,
              rgba(0, 0, 0, 0.03) 4px
            )`,
            animation: 'scanlines 8s linear infinite'
          }} />
          
          {/* Chromatic aberration effect */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 9997,
            mixBlendMode: 'screen',
            opacity: 0.3
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              background: 'linear-gradient(45deg, #ff00ff 0%, transparent 50%, #00ffff 100%)',
              animation: 'chromatic-shift 4s ease-in-out infinite'
            }} />
          </div>
          
          {/* Static noise */}
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 9996,
            opacity: 0.05,
            animation: 'noise 0.2s infinite'
          }} />
        </>
      )}
      
      {/* 80s Mode CSS Animations */}
      <style jsx>{`
        @font-face {
          font-family: 'UnifrakturCook';
          src: url('/fonts/UnifrakturCook-Bold.ttf') format('truetype');
          font-weight: bold;
          font-style: normal;
          font-display: swap;
        }
        
        @keyframes scanlines {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(10px);
          }
        }
        
        @keyframes chromatic-shift {
          0%, 100% {
            transform: translate(0, 0);
          }
          25% {
            transform: translate(2px, -1px);
          }
          50% {
            transform: translate(-1px, 1px);
          }
          75% {
            transform: translate(1px, -2px);
          }
        }
        
        @keyframes subtle-glitch {
          0%, 98%, 100% {
            transform: translate(0, 0) skew(0deg);
            filter: hue-rotate(0deg);
          }
          98.5% {
            transform: translate(2px, 0) skew(0.5deg);
            filter: hue-rotate(10deg);
          }
          99% {
            transform: translate(-2px, 0) skew(-0.5deg);
            filter: hue-rotate(-10deg);
          }
        }
        
        @keyframes noise {
          0%, 100% {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='noise'%3E%3CfeTurbulence baseFrequency='0.9' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5' /%3E%3C/svg%3E");
          }
          50% {
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='noise'%3E%3CfeTurbulence baseFrequency='0.95' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.5' /%3E%3C/svg%3E");
          }
        }
      `}</style>
    </div>
  );
}