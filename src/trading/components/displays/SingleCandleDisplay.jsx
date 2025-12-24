import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { collection, getDocs, query, orderBy, limit, where, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebaseClient';
import { useUser } from '@clerk/nextjs';


// Helper function to decode HTML entities
function decodeHTMLEntities(text) {
  if (!text) return text;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

// Model viewer component with candle data display and texture support
function ModelViewer({ modelPath, candleData = null, showPlaque = true, isFlipped = false, isRevealing = false }) {
  const gltf = useGLTF(modelPath);
  const { scene, materials, animations } = gltf;
  const modelRef = useRef();
  const groupRef = useRef();
  const [plaqueVisible, setPlaqueVisible] = useState(true);
  const textureLoader = new THREE.TextureLoader();
  const boxMeshRef = useRef(null);
  
  // Clone and setup the model with textures
  React.useEffect(() => {
    if (scene && modelRef.current) {
      const clonedModel = scene.clone();
      
      // Scale and position the model - adjust for mobile
      const isMobile = window.innerWidth <= 768;
      clonedModel.scale.set(1, 1, 1);
      clonedModel.position.set(0, isMobile ? -1.2 : -1.2, isMobile ? -2 : -2);
      
      // Debug: Log all meshes in the model when dealing with votive candles with images
      if (candleData && candleData.candleType === 'votive' && candleData.image) {
        console.log('[SingleCandleDisplay] Votive candle with custom image detected:', candleData.image);
        console.log('[SingleCandleDisplay] All meshes in votive model:');
        clonedModel.traverse((child) => {
          if (child.isMesh) {
            console.log(`  - Mesh: "${child.name}", Material: "${child.material?.name}"`);
          }
        });
      }
      
      // Process meshes and apply textures
      clonedModel.traverse((child) => {
        // Debug logging for rigged characters
        if (child.name && (child.name.includes('Robot') || child.name.includes('Macro') || child.name.includes('RL80') || child.name.includes('Empty'))) {
          // console.log('Found character-related object:', {
          //   name: child.name,
          //   type: child.type,
          //   isSkinnedMesh: child.isSkinnedMesh,
          //   isMesh: child.isMesh,
          //   isObject3D: child.isObject3D,
          //   isBone: child.isBone,
          //   hasChildren: child.children?.length > 0,
          //   children: child.children?.map(c => ({ name: c.name, type: c.type }))
          // });
          
          if (child.isSkinnedMesh) {
            // console.log('SkinnedMesh details:', {
            //   name: child.name,
            //   hasSkeleton: !!child.skeleton,
            //   boneCount: child.skeleton?.bones?.length,
            //   hasBindMatrix: !!child.bindMatrix,
            //   hasBindMatrixInverse: !!child.bindMatrixInverse
            // });
          }
        }
        
        // Handle SkinnedMesh (rigged characters like RL80 and Macro)
        if (child.isSkinnedMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // console.log(`Processing SkinnedMesh: ${child.name}`);
          // Force skeleton update to avoid t-pose
          if (child.skeleton) {
            child.skeleton.calculateInverses();
            child.skeleton.computeBoneTexture();
            child.skeleton.update();
          }
        } else if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          // Apply user image to senora mesh for votive candles
          // Check multiple possible names/materials for the senora mesh
          const isSenoraObject = child.name === 'senora' || 
                                child.name === 'Senora' ||
                                (child.material && (
                                  child.material.name === 'senora' ||
                                  child.material.name === 'senora.001' ||
                                  child.material.name === 'Senora' ||
                                  child.material.name === 'Material.001' // Sometimes the senora material has this name
                                )) ||
                                (child.parent && child.parent.name === 'senora');
          
          // Use 'image' field from Firebase (not imageUrl)
          if (candleData && candleData.image && candleData.candleType === 'votive' && isSenoraObject) {
            console.log('[SingleCandleDisplay] Found senora mesh, applying user image:', {
              meshName: child.name,
              materialName: child.material?.name,
              imageUrl: candleData.image
            });
            
            textureLoader.load(
              candleData.image,
              (texture) => {
                console.log('[SingleCandleDisplay] Senora texture loaded successfully');
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.flipY = false; // Fixed: Don't flip the senora image
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                
                // Clone material if not already cloned
                if (!child.material.userData.cloned) {
                  child.material = child.material.clone();
                  child.material.userData.cloned = true;
                }
                
                child.material.map = texture;
                child.material.transparent = true;
                child.material.opacity = 1;
                child.material.alphaTest = 0.1;
                child.material.needsUpdate = true;
              },
              undefined,
              (error) => {
                console.error('[SingleCandleDisplay] Error loading senora texture:', error);
              }
            );
          }
          
          // Clone material first for all meshes that we'll modify
          if (child.material) {
            child.material = child.material.clone();
          }
          
          // Check if this is the Box mesh first (for background texture)
          const isBoxMesh = child.name === 'Box' || child.name === 'box';
          
          // Apply baseColor to XBase meshes (but NOT to Box mesh)
          const meshNameLower = child.name.toLowerCase();
          const isXBaseMesh = !isBoxMesh && (
                             meshNameLower === 'xbase' || 
                             meshNameLower.startsWith('xbase') ||
                             (modelPath.includes('tinyVotive') && 
                              (meshNameLower === 'base' || 
                               meshNameLower === 'cylinder' || 
                               meshNameLower === 'candle' ||
                               meshNameLower.includes('candle_base') ||
                               meshNameLower.includes('wax'))));
          
          if (isXBaseMesh && candleData?.baseColor && candleData.baseColor !== '#ffffff') {
            const color = new THREE.Color(candleData.baseColor);
            child.material.color = color;
            child.material.needsUpdate = true;
          }
          
          // Apply background texture to Box mesh
          if (isBoxMesh && candleData && candleData.background && candleData.background !== 'none') {
            boxMeshRef.current = child;
            
            // Map background IDs to texture paths
            const BACKGROUND_TEXTURES = {
              'cyberpunk': '/cyberpunk.webp',
              'synthwave': '/synthwave.webp',
              'gothicTokyo': '/gothicTokyo.webp',
              'neoTokyo': '/neoTokyo.webp',
              'aurora': '/aurora.webp',
              'tradeScene': '/tradeScene.webp',
              'sunset': '/gradient-sunset.webp',
              'chart': '/images/chart.webp',
              'collectibles': '/pokemon2.webp',
              'dreams': '/gradient-dreams.webp'
            };
            
            const texturePath = BACKGROUND_TEXTURES[candleData.background];
            
            if (texturePath) {
              // console.log(`Loading background texture: ${texturePath} for background: ${candleData.background}`);
              textureLoader.load(
                texturePath,
                (texture) => {
                  texture.colorSpace = THREE.SRGBColorSpace;
                  texture.flipY = false; // Match the setting from CompactCandleModal
                  texture.wrapS = THREE.ClampToEdgeWrapping;
                  texture.wrapT = THREE.ClampToEdgeWrapping;
                  texture.needsUpdate = true;
                  
                  child.material = child.material.clone();
                  child.material.map = texture;
                  child.material.needsUpdate = true;
                  
                  // Reset color to white to show texture
                  if (child.material.color) {
                    child.material.color.set(0xffffff);
                  }
                  // console.log(`Background texture applied successfully to ${child.name}`);
                },
                (xhr) => {
                  // console.log(`Loading background: ${(xhr.loaded / xhr.total * 100)}% loaded`);
                },
                (error) => {
                  console.error(`Error loading background texture ${texturePath}:`, error);
                }
              );
            }
          } else if (isBoxMesh && (!candleData || !candleData.background || candleData.background === 'none')) {
            // Clear texture if no background
            child.material = child.material.clone();
            child.material.map = null;
            child.material.color.set(0x333333);
            child.material.needsUpdate = true;
          }
        }
      });
      
      // Clear previous model and add new one
      while (modelRef.current.children.length > 0) {
        modelRef.current.remove(modelRef.current.children[0]);
      }
      groupRef.current = clonedModel;
      modelRef.current.add(clonedModel);
      
      // Log if animations exist (shouldn't for candle-only models)
      // if (animations && animations.length > 0) {
      //   console.log(`Warning: Candle model has animations? ${animations.length} animations:`, animations.map(a => a.name));
      // }
    }
  }, [scene, materials, candleData]);
  
  if (!scene) {
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="orange" />
      </mesh>
    );
  }
  
  return (
    <>
      {/* Lighting setup - matching CompactCandleModal */}
      <ambientLight intensity={1.2} />
      <directionalLight 
        position={[5, 10, 5]} 
        intensity={0.8} 
        castShadow 
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[0, 3, 2]} intensity={0.5} color="#ffaa00" />
      <pointLight position={[-3, 2, -2]} intensity={0.3} color="#ffffff" />
      
      {/* The model - hide when flipped */}
      <group ref={modelRef} visible={!isFlipped}>
      </group>
      
      
      {/* Camera controls disabled entirely for SingleCandleDisplay */}
    </>
  );
}

// Main component for single candle display
export default function SingleCandleDisplay({ onOpenCompactModal, onClose }) {
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'my', or 'summary'
  const [allCandles, setAllCandles] = useState([]);
  const [myCandles, setMyCandles] = useState([]);
  const [currentAllCandleIndex, setCurrentAllCandleIndex] = useState(0);
  const [currentMyCandleIndex, setCurrentMyCandleIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMyCandles, setLoadingMyCandles] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const [particleCandleType, setParticleCandleType] = useState(null);
  const [showPlaque, setShowPlaque] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [filterMode, setFilterMode] = useState('newest'); // 'random', 'leaderboard', 'newest'
  const [filteredCandles, setFilteredCandles] = useState([]);
  const [isMobile, setIsMobile] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [summaryPeriod, setSummaryPeriod] = useState('daily'); // 'daily', 'weekly', 'monthly'
  const [summaryData, setSummaryData] = useState({
    sentimentScore: 75,
    totalCandles: 0,
    petitions: 0,
    praise: 0,
    confessions: 0,
    trend: 'up',
    summary: '',
    themes: []
  });
  const { user, isSignedIn } = useUser();
  
  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Helper function to estimate object size in bytes
  const getObjectSize = (obj) => {
    const jsonString = JSON.stringify(obj);
    return new Blob([jsonString]).size;
  };

  // Fetch all candles from Firebase
  useEffect(() => {
    const fetchAllCandles = async () => {
      try {
        setLoading(true);
        const candlesRef = collection(db, 'candles');
        
        // Fetch more for leaderboard to ensure we get high burners
        const limitCount = filterMode === 'leaderboard' ? 50 : 20;
        const q = query(candlesRef, orderBy('createdAt', 'desc'), limit(limitCount));
        const snapshot = await getDocs(q);
        
        const candlesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Log memory usage info
        if (candlesData.length > 0) {
          const totalSize = candlesData.reduce((sum, candle) => sum + getObjectSize(candle), 0);
          const avgSize = Math.round(totalSize / candlesData.length);
          // console.log('Candles memory usage:', {
          //   totalRecords: candlesData.length,
          //   totalSize: `${(totalSize / 1024).toFixed(2)} KB`,
          //   averageSize: `${avgSize} bytes`,
          //   largestRecord: Math.max(...candlesData.map(c => getObjectSize(c))) + ' bytes'
          // });
        }
        
        setAllCandles(candlesData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching all candles:', error);
        setLoading(false);
      }
    };
    
    fetchAllCandles();
  }, [filterMode]);
  
  // Fetch user's candles when signed in
  useEffect(() => {
    const fetchMyCandles = async () => {
      if (!isSignedIn || !user) return;
      
      // Debug: Log user info to see what's available
      // console.log('Current user:', {
      //   username: user?.username,
      //   firstName: user?.firstName,
      //   lastName: user?.lastName,
      //   fullName: user?.fullName,
      //   email: user?.emailAddresses?.[0]?.emailAddress,
      //   id: user?.id
      // });
      
      // Try username first, then fall back to firstName or fullName
      const userIdentifier = user?.username || user?.firstName || user?.fullName || 'Anonymous';
      
      try {
        setLoadingMyCandles(true);
        const candlesRef = collection(db, 'candles');
        
        // First try by createdBy (user ID) which is most reliable
        let q = query(
          candlesRef, 
          where('createdBy', '==', user.id),
          limit(20) // Reduced from 50 to 20
        );
        let snapshot = await getDocs(q);
        
        // console.log(`Found ${snapshot.size} candles for user ID: ${user.id}`);
        
        // If no results, try by createdByUsername
        if (snapshot.size === 0) {
          q = query(
            candlesRef, 
            where('createdByUsername', '==', userIdentifier),
            limit(20) // Reduced from 50 to 20
          );
          snapshot = await getDocs(q);
          // console.log(`Found ${snapshot.size} candles for username: ${userIdentifier}`);
        }
        
        const userCandlesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Log memory usage for user candles
        if (userCandlesData.length > 0) {
          const totalSize = userCandlesData.reduce((sum, candle) => sum + getObjectSize(candle), 0);
          // console.log('User candles memory:', {
          //   records: userCandlesData.length,
          //   totalSize: `${(totalSize / 1024).toFixed(2)} KB`
          // });
        }
        
        // Sort by createdAt client-side to avoid needing composite index
        const sortedUserCandles = userCandlesData.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime; // Descending order (newest first)
        });
        
        // Take only the first 10 after sorting
        setMyCandles(sortedUserCandles.slice(0, 10));
        setLoadingMyCandles(false);
      } catch (error) {
        console.error('Error fetching user candles:', error);
        setLoadingMyCandles(false);
      }
    };
    
    if (activeTab === 'my') {
      fetchMyCandles();
    }
  }, [activeTab, isSignedIn, user]);
  
  // Fetch and analyze summary data
  useEffect(() => {
    if (activeTab !== 'summary') return;
    
    const fetchSummaryData = async () => {
      try {
        // First, check if we have a cached summary for today
        const today = new Date();
        const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const summaryDocId = `${summaryPeriod}_${dateKey}`;
        
        // Try to get cached summary from Firestore
        // console.log('Looking for summary document:', summaryDocId);
        const cachedSummaryRef = doc(db, 'summaries', summaryDocId);
        const cachedSummary = await getDoc(cachedSummaryRef);
        
        if (cachedSummary.exists()) {
          // Use cached data
          const cached = cachedSummary.data();
          // console.log('Found cached summary:', cached);
          setSummaryData({
            sentimentScore: cached.sentimentScore || 75,
            totalCandles: cached.totalCandles || 0,
            petitions: cached.petitions || 0,
            praise: cached.praise || 0,
            confessions: cached.confessions || 0,
            trend: cached.trend || 'up',
            summary: cached.summary || '',
            themes: cached.themes || []
          });
          // console.log('Using cached summary from Firestore');
          return;
        }
        
        // No cache found - don't generate locally, wait for cloud function
        // console.log('No cached summary found. Run the cloud function to generate one.');
        return;
        
        // ALL CODE BELOW IS DISABLED - Cloud function handles summary generation
        /*
        const candlesRef = collection(db, 'candles');
        
        // Calculate date range based on period
        const now = new Date();
        let startDate = new Date();
        
        if (summaryPeriod === 'daily') {
          startDate.setDate(now.getDate() - 1);
        } else if (summaryPeriod === 'weekly') {
          startDate.setDate(now.getDate() - 7);
        } else {
          startDate.setMonth(now.getMonth() - 1);
        }
        
        // Fetch candles from the time period
        const q = query(candlesRef, orderBy('createdAt', 'desc'), limit(100));
        const snapshot = await getDocs(q);
        
        // Process the data
        let petitions = 0;
        let praise = 0;
        let confessions = 0;
        let totalBurned = 0;
        const messages = [];
        
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const messageType = data.messageType?.toLowerCase() || '';
          
          if (messageType.includes('petition') || messageType.includes('prayer')) {
            petitions++;
          } else if (messageType.includes('praise') || messageType.includes('gratitude') || messageType.includes('thanks')) {
            praise++;
          } else if (messageType.includes('confession')) {
            confessions++;
          }
          
          if (data.message) {
            messages.push(data.message);
          }
          
          if (data.burnedAmount) {
            totalBurned += parseInt(data.burnedAmount) || 0;
          }
        });
        
        // Try to use OpenAI for sentiment analysis if available
        let sentimentScore = 75;
        let aiSummary = '';
        let extractedThemes = ['Success', 'Growth', 'Community', 'Prosperity', 'Wellness'];
        
        // Check if we should use AI (limit to daily to save API calls)
        if (summaryPeriod === 'daily' && messages.length > 0) {
          try {
            const openAIKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
            
            if (openAIKey) {
              const prompt = `Analyze the following ${messages.length} temple candle messages and provide:
1. A sentiment score from 0-100 (where 100 is most positive)
2. A 2-3 sentence summary of the overall mood and themes
3. List 5 key themes (single words)

Messages:
${messages.slice(0, 30).join('\n')}

Respond in JSON format like:
{"sentiment": 75, "summary": "...", "themes": ["word1", "word2", "word3", "word4", "word5"]}`;

              const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${openAIKey}`
                },
                body: JSON.stringify({
                  model: 'gpt-3.5-turbo',
                  messages: [
                    {
                      role: 'system',
                      content: 'You are analyzing spiritual messages from a digital temple. Be respectful and insightful.'
                    },
                    {
                      role: 'user',
                      content: prompt
                    }
                  ],
                  temperature: 0.7,
                  max_tokens: 200
                })
              });
              
              if (response.ok) {
                const data = await response.json();
                const aiResponse = data.choices[0].message.content;
                
                try {
                  const parsed = JSON.parse(aiResponse);
                  sentimentScore = parsed.sentiment || 75;
                  aiSummary = parsed.summary || '';
                  extractedThemes = parsed.themes || extractedThemes;
                } catch (parseError) {
                  console.log('Could not parse AI response, using defaults');
                }
              }
            }
          } catch (aiError) {
            console.log('OpenAI analysis failed, using fallback:', aiError);
          }
        }
        
        // Fallback sentiment calculation if AI fails
        // if (!aiSummary) {
        //   const positiveWords = ['thank', 'grateful', 'blessed', 'happy', 'love', 'amazing', 'wonderful'];
        //   const negativeWords = ['sad', 'worried', 'fear', 'anxious', 'stressed', 'difficult', 'struggle'];
          
        //   let positiveCount = 0;
        //   let negativeCount = 0;
          
        //   messages.forEach(msg => {
        //     const lower = msg.toLowerCase();
        //     positiveWords.forEach(word => {
        //       if (lower.includes(word)) positiveCount++;
        //     });
        //     negativeWords.forEach(word => {
        //       if (lower.includes(word)) negativeCount++;
        //     });
        //   });
          
        //   sentimentScore = Math.min(100, Math.max(0, 
        //     50 + (positiveCount - negativeCount) * 5
        //   ));
          
        //   aiSummary = `The temple received ${snapshot.size} candles this ${summaryPeriod === 'daily' ? 'day' : summaryPeriod === 'weekly' ? 'week' : 'month'}. ${praise > petitions ? 'Gratitude and praise dominate the messages' : 'The community is actively seeking guidance and support'}. Total offerings reached ${totalBurned.toLocaleString()} RL80.`;
        // }
        
        // Prepare the summary data
        const summaryDataToSave = {
          sentimentScore,
          totalCandles: snapshot.size,
          petitions,
          praise,
          confessions,
          trend: sentimentScore > 50 ? 'up' : 'down',
          summary: aiSummary,
          themes: extractedThemes,
          createdAt: Timestamp.now(),
          period: summaryPeriod,
          date: dateKey
        };
        
        // Don't save locally-generated summaries - let the cloud function handle it
        // if (snapshot.size > 0) {
        //   try {
        //     await setDoc(cachedSummaryRef, summaryDataToSave);
        //     console.log('Summary saved to Firestore for other users');
        //   } catch (saveError) {
        //     console.error('Error saving summary to Firestore:', saveError);
        //   }
        // }
        
        // Update local state
        setSummaryData(summaryDataToSave);
        */
        
      } catch (error) {
        console.error('Error fetching summary data:', error);
      }
    };
    
    fetchSummaryData();
  }, [activeTab, summaryPeriod]);
  
  // Apply filtering/sorting based on filterMode
  useEffect(() => {
    if (allCandles.length === 0) {
      setFilteredCandles([]);
      return;
    }
    
    let processed = [...allCandles];
    
    switch (filterMode) {
      case 'leaderboard':
        // Sort by burnedAmount descending (highest burners first)
        processed = processed
          .filter(c => c.burnedAmount && parseInt(c.burnedAmount) > 0)
          .sort((a, b) => {
            const burnA = parseInt(a.burnedAmount) || 0;
            const burnB = parseInt(b.burnedAmount) || 0;
            return burnB - burnA;
          })
          .slice(0, 20); // Take top 20 burners
        break;
        
      case 'newest':
        // Already sorted by createdAt desc from Firebase
        processed = processed.slice(0, 20);
        break;
        
      case 'random':
        // Shuffle array using Fisher-Yates algorithm
        for (let i = processed.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [processed[i], processed[j]] = [processed[j], processed[i]];
        }
        processed = processed.slice(0, 20);
        break;
    }
    
    setFilteredCandles(processed);
    setCurrentAllCandleIndex(0); // Reset to first candle when filter changes
  }, [allCandles, filterMode]);
  
  // Cycle through candles every 5 seconds with reveal effect (when not paused)
  useEffect(() => {
    if (activeTab === 'all' && filteredCandles.length > 0 && !isPaused) {
      const interval = setInterval(() => {
        // Capture the current candle type before transition
        const currentType = filteredCandles[currentAllCandleIndex]?.candleType;
        // console.log('Transition starting - Current candle type:', currentType, 'Index:', currentAllCandleIndex);
        
        // Hide plaque immediately when starting reveal
        setShowPlaque(false);
        // Trigger reveal animation
        setIsRevealing(true);
        
        // Show particles earlier in the transition (but not when flipped)
        setTimeout(() => {
          if (!isFlipped) {
            // console.log('Setting particle type to:', currentType);
            setParticleCandleType(currentType);
            setShowParticles(true);
          }
        }, 150);  // Reduced from 400ms to 150ms
        
        // After curtains close, change the candle
        setTimeout(() => {
          setCurrentAllCandleIndex((prev) => (prev + 1) % filteredCandles.length);
        }, 600);
        
        // Hide particles after showing
        setTimeout(() => {
          setShowParticles(false);
          setParticleCandleType(null);
        }, 650);  // Adjusted to 650ms (500ms duration from 150ms start)
        
        // Open curtains after candle changes
        setTimeout(() => {
          setIsRevealing(false);
        }, 800);
        
        // Show plaque after curtains are fully open (add extra delay)
        setTimeout(() => {
          setShowPlaque(true);
        }, 1200);
      }, 5000); // 5 seconds
      
      return () => clearInterval(interval);
    } else if (activeTab === 'my' && myCandles.length > 1 && !isPaused) {
      const interval = setInterval(() => {
        // Capture the current candle type before transition
        const currentType = myCandles[currentMyCandleIndex]?.candleType;
        // console.log('My tab transition - Current candle type:', currentType, 'Index:', currentMyCandleIndex);
        
        // Hide plaque immediately when starting reveal
        setShowPlaque(false);
        // Trigger reveal animation
        setIsRevealing(true);
        
        // Show particles earlier in the transition (but not when flipped)
        setTimeout(() => {
          if (!isFlipped) {
            // console.log('Setting particle type to:', currentType);
            setParticleCandleType(currentType);
            setShowParticles(true);
          }
        }, 150);  // Reduced from 400ms to 150ms
        
        // After curtains close, change the candle
        setTimeout(() => {
          setCurrentMyCandleIndex((prev) => (prev + 1) % myCandles.length);
        }, 600);
        
        // Hide particles after showing
        setTimeout(() => {
          setShowParticles(false);
          setParticleCandleType(null);
        }, 650);  // Adjusted to 650ms (500ms duration from 150ms start)
        
        // Open curtains after candle changes
        setTimeout(() => {
          setIsRevealing(false);
        }, 800);
        
        // Show plaque after curtains are fully open (add extra delay)
        setTimeout(() => {
          setShowPlaque(true);
        }, 1200);
      }, 5000); // 5 seconds
      
      return () => clearInterval(interval);
    }
  }, [activeTab, filteredCandles, myCandles, isPaused, currentAllCandleIndex, currentMyCandleIndex, isFlipped]);
  
  // Clean up old textures when switching candles (helps with memory)
  useEffect(() => {
    return () => {
      // This cleanup runs when component unmounts or candle changes
      if (window.THREE) {
        const cache = window.THREE.Cache;
        if (cache && cache.enabled) {
          cache.clear();
        }
      }
    };
  }, [currentAllCandleIndex, currentMyCandleIndex]);

  // Get current candle data based on active tab
  const currentCandle = activeTab === 'all' 
    ? filteredCandles[currentAllCandleIndex]
    : myCandles[currentMyCandleIndex];
  
  // Determine model path based on candle type
  const getModelPath = (candle) => {
    if (!candle) return '/models/tinyVotiveBox.glb';
    
    // Use box versions for better display with backgrounds
    if (candle.candleType === 'japanese') {
      return '/models/tinyJapCanBox.glb';
    }
    return '/models/tinyVotiveBox.glb'; // Default to votive box
  };
  
  const currentModelPath = currentCandle 
    ? getModelPath(currentCandle)
    : '/models/tinyVotiveBox.glb'; // Default placeholder
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: isMobile ? '100%' : '26rem',
      height: isMobile ? '100vh' : '35rem',
      maxWidth: isMobile ? '100%' : '26rem',
      maxHeight: isMobile ? '100vh' : '35rem',
      margin: isMobile ? 0 : 'auto',
      background: '#1a1a1a',
      borderRadius: isMobile ? '0' : '10px',
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
      position: isMobile ? 'fixed' : 'relative',
      top: isMobile ? 0 : 'auto',
      left: isMobile ? 0 : 'auto',
      right: isMobile ? 0 : 'auto',
      bottom: isMobile ? 0 : 'auto',
      zIndex: isMobile ? 99999 : 'auto',
      paddingTop: isMobile ? 'env(safe-area-inset-top)' : 0,
      paddingBottom: isMobile ? 'env(safe-area-inset-bottom)' : 0
    }}>
      {/* Tab buttons */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0a0a',
        borderBottom: '1px solid #333',
        position: 'relative'
      }}>
        {/* Close button for mobile */}
        {isMobile && onClose && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#fff',
              fontSize: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 100000,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 0, 0, 0.3)';
              e.target.style.borderColor = 'rgba(255, 0, 0, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.1)';
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            }}
          >
            ✕
          </button>
        )}
        <div style={{ display: 'flex' }}>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              flex: 1,
              padding: '12px',
              background: activeTab === 'all' ? '#1a1a1a' : 'transparent',
              color: activeTab === 'all' ? '#00ff00' : '#666',
              border: 'none',
              borderBottom: activeTab === 'all' ? '2px solid #00ff00' : 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'all' ? 'bold' : 'normal',
              transition: 'all 0.3s ease'
            }}
          >
            All Candles
          </button>
          <button
            onClick={() => setActiveTab('my')}
            style={{
              flex: 1,
              padding: '12px',
              background: activeTab === 'my' ? '#1a1a1a' : 'transparent',
              color: activeTab === 'my' ? '#00ff00' : '#666',
              border: 'none',
              borderBottom: activeTab === 'my' ? '2px solid #00ff00' : 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'my' ? 'bold' : 'normal',
              transition: 'all 0.3s ease'
            }}
          >
            My Candle
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            style={{
              flex: 1,
              padding: '12px',
              background: activeTab === 'summary' ? '#1a1a1a' : 'transparent',
              color: activeTab === 'summary' ? '#00ff00' : '#666',
              border: 'none',
              borderBottom: activeTab === 'summary' ? '2px solid #00ff00' : 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 'summary' ? 'bold' : 'normal',
              transition: 'all 0.3s ease'
            }}
          >
            Summary
          </button>
        </div>
        
        {/* Filter dropdown for All Candles tab */}
        {activeTab === 'all' && (
          <div style={{
            padding: '8px',
            background: '#1a1a1a',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ color: '#888', fontSize: '12px' }}>View:</span>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              style={{
                background: '#2a2a2a',
                color: '#00ff00',
                border: '1px solid #444',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="random">🎲 Random Mix</option>
              <option value="leaderboard">🔥 Top Burners</option>
              <option value="newest">✨ Newest</option>
            </select>
            {filterMode === 'leaderboard' && filteredCandles.length > 0 && (
              <span style={{ 
                color: '#ffb000', 
                fontSize: '11px',
                marginLeft: 'auto'
              }}>
                #1 burned {parseInt(filteredCandles[0]?.burnedAmount || 0).toLocaleString()} RL80
              </span>
            )}
            {filterMode !== 'leaderboard' && currentCandle && (
              <span style={{ 
                color: '#888',
                fontSize: '14px',
                marginLeft: 'auto',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {(() => {
                  const messageType = currentCandle?.messageType;
                  if (messageType) {
                    const displayType = messageType.charAt(0).toUpperCase() + messageType.slice(1);
                    return (
                      <>
                        Msg Protocol: <span style={{ color: '#00ff00' }}>{displayType}</span>
                      </>
                    );
                  }
                  return 'TEMPLE CANDLES';
                })()}
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* 3D viewer or Summary Dashboard */}
      <div style={{ 
        flex: 1,
        position: 'relative',
        background: '#0f0f0f',
        display: 'flex',
        width: '100%',
        minHeight: 0
      }}>
        {activeTab === 'summary' ? (
          // Summary Dashboard
          <div style={{
            width: '100%',
            height: '100%',
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
          }}>
            {/* Time Period Selector */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '10px'
            }}>
              {['daily', 'weekly', 'monthly'].map(period => (
                <button
                  key={period}
                  onClick={() => setSummaryPeriod(period)}
                  style={{
                    padding: '8px 16px',
                    background: summaryPeriod === period ? '#00ff00' : 'transparent',
                    color: summaryPeriod === period ? '#000' : '#666',
                    border: `1px solid ${summaryPeriod === period ? '#00ff00' : '#333'}`,
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: summaryPeriod === period ? 'bold' : 'normal',
                    transition: 'all 0.3s ease',
                    textTransform: 'capitalize'
                  }}
                >
                  {period}
                </button>
              ))}
            </div>

            {/* Sentiment Score Circle */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}>
              <div style={{
                position: 'relative',
                width: '150px',
                height: '150px'
              }}>
                <svg width="150" height="150" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="75"
                    cy="75"
                    r="65"
                    stroke="#333"
                    strokeWidth="10"
                    fill="none"
                  />
                  <circle
                    cx="75"
                    cy="75"
                    r="65"
                    stroke={`hsl(${summaryData.sentimentScore * 1.2}, 100%, 50%)`}
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 65 * summaryData.sentimentScore / 100} ${2 * Math.PI * 65}`}
                    strokeLinecap="round"
                    style={{
                      transition: 'stroke-dasharray 1s ease'
                    }}
                  />
                </svg>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: '36px',
                    fontWeight: 'bold',
                    color: `hsl(${summaryData.sentimentScore * 1.2}, 100%, 50%)`
                  }}>
                    {summaryData.sentimentScore}
                  </div>
                  <div style={{ color: '#666', fontSize: '12px' }}>
                    {summaryData.sentimentScore >= 90 ? 'Joyful' :
                     summaryData.sentimentScore >= 70 ? 'Hopeful' :
                     summaryData.sentimentScore >= 50 ? 'Seeking' :
                     summaryData.sentimentScore >= 30 ? 'Struggling' : 'Crisis'}
                  </div>
                </div>
              </div>
              <div style={{
                display: 'flex',
                gap: '5px',
                alignItems: 'center'
              }}>
                <span style={{ 
                  color: summaryData.trend === 'up' ? '#00ff00' : '#ff0000',
                  fontSize: '14px'
                }}>
                  {summaryData.trend === 'up' ? '↑' : '↓'}
                </span>
                <span style={{ color: '#888', fontSize: '12px' }}>
                  vs {summaryPeriod === 'daily' ? 'yesterday' : summaryPeriod === 'weekly' ? 'last week' : 'last month'}
                </span>
              </div>
            </div>

            {/* Message Type Breakdown */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px'
            }}>
              <div style={{
                background: 'rgba(0, 255, 136, 0.1)',
                border: '1px solid rgba(0, 255, 136, 0.3)',
                borderRadius: '8px',
                padding: '15px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#00ff88' }}>
                  {summaryData.praise}
                </div>
                <div style={{ color: '#888', fontSize: '12px', marginTop: '5px' }}>
                  ✨ Praise
                </div>
              </div>
              <div style={{
                background: 'rgba(255, 176, 0, 0.1)',
                border: '1px solid rgba(255, 176, 0, 0.3)',
                borderRadius: '8px',
                padding: '15px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ffb000' }}>
                  {summaryData.petitions}
                </div>
                <div style={{ color: '#888', fontSize: '12px', marginTop: '5px' }}>
                  🙏 Petitions
                </div>
              </div>
              <div style={{
                background: 'rgba(150, 100, 255, 0.1)',
                border: '1px solid rgba(150, 100, 255, 0.3)',
                borderRadius: '8px',
                padding: '15px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9664ff' }}>
                  {summaryData.confessions}
                </div>
                <div style={{ color: '#888', fontSize: '12px', marginTop: '5px' }}>
                  💭 Confessions
                </div>
              </div>
            </div>

            {/* AI Summary */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid #333',
              borderRadius: '10px',
              padding: '20px'
            }}>
              <h3 style={{
                color: '#00ff00',
                fontSize: '16px',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                🤖 AI Insight
              </h3>
              <p style={{
                color: '#ccc',
                fontSize: '14px',
                lineHeight: '1.6',
                marginBottom: '15px'
              }}>
                {summaryData.summary || `Today's platform shows a strong sense of gratitude and hope. The community is actively seeking guidance, with ${summaryData.petitions} petitions focusing on financial stability and personal growth. The ${summaryData.praise} messages of praise reflect deep appreciation for recent successes and unexpected opportunities. Notable themes include career breakthroughs, personal wellness, and community support.`}
              </p>
              
              {/* Key Themes */}
              <div style={{ marginTop: '15px' }}>
                <div style={{ color: '#888', fontSize: '12px', marginBottom: '8px' }}>
                  Key Themes:
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(summaryData.themes.length ? summaryData.themes : ['Gratitude', 'Hope', 'Success', 'Growth', 'Wellness']).map((theme, i) => (
                    <span
                      key={i}
                      style={{
                        background: 'rgba(0, 255, 136, 0.2)',
                        border: '1px solid rgba(0, 255, 136, 0.4)',
                        borderRadius: '15px',
                        padding: '4px 12px',
                        color: '#00ff88',
                        fontSize: '11px'
                      }}
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Total Candles Footer */}
            <div style={{
              textAlign: 'center',
              padding: '10px',
              borderTop: '1px solid #333'
            }}>
              <div style={{
                color: '#666',
                fontSize: '12px'
              }}>
                Total Candles ({summaryPeriod})
              </div>
              <div style={{
                color: '#00ff00',
                fontSize: '24px',
                fontWeight: 'bold'
              }}>
                {summaryData.totalCandles || '42'}
              </div>
            </div>
          </div>
        ) : (loading && activeTab === 'all') || (loadingMyCandles && activeTab === 'my') ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#666',
            fontSize: '14px'
          }}>
            Loading candles...
          </div>
        ) : activeTab === 'my' && !isSignedIn ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '20px'
          }}>
            <div style={{ color: '#666', fontSize: '14px' }}>
              Please sign in to view your candles
            </div>
          </div>
        ) : activeTab === 'my' && myCandles.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            width: '100%',
            gap: '20px',
            position: 'relative'
          }}>
            <div style={{ 
              color: '#666', 
              fontSize: '14px',
              textAlign: 'center',
              width: '100%',
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)'
            }}>
              You haven't created any candles yet
            </div>
          </div>
        ) : activeTab !== 'summary' ? (
          <Canvas
            camera={{ 
              position: isFlipped ? [0, 0, -6] : (isMobile ? [0, 0, 5] : [0, 0, 5]), 
              fov: isMobile ? 45 : 45 
            }}
            style={{ width: '100%', height: '100%', display: 'block' }}
            shadows
            gl={{
              antialias: true,
              alpha: false,
              preserveDrawingBuffer: true,
              powerPreference: "high-performance"
            }}
            onCreated={({ gl, scene }) => {
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.2;
              scene.background = new THREE.Color(isFlipped ? 0x000000 : 0x0f0f0f);
              gl.shadowMap.enabled = true;
              gl.shadowMap.type = THREE.PCFSoftShadowMap;
            }}
          >
            <Suspense fallback={
              isRevealing ? null : (
                <mesh>
                  <boxGeometry args={[1, 1, 1]} />
                  <meshBasicMaterial color="gray" />
                </mesh>
              )
            }>
              <ModelViewer 
                key={currentModelPath}
                modelPath={currentModelPath}
                candleData={currentCandle}
                showPlaque={showPlaque}
                isFlipped={isFlipped}
                isRevealing={isRevealing}
              />
            </Suspense>
          </Canvas>
        ) : null}
        
        {/* Info Overlay - positioned on top of the canvas */}
        {currentCandle && showPlaque && !isRevealing && !loading && !loadingMyCandles && activeTab !== 'summary' && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            zIndex: 10
          }}>
            {/* Username and avatar at top */}
            <div style={{
              marginTop: isMobile ? '60px' : '40px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}>
              {currentCandle.userAvatar && (
                <img 
                  src={currentCandle.userAvatar} 
                  alt="User" 
                  style={{
                    width: isMobile ? '3rem' : '3rem',
                    height: isMobile ? '3rem' : '3rem',
                    borderRadius: '50%',
                    border: '2px solid #eaea0b',
                    boxShadow: '0 0 8px rgba(234, 234, 11, 0.6)'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              )}
              {currentCandle.username && (
                <div style={{
                  color: '#eaea0b',
                  fontSize: isMobile ? '1rem' : '1rem',
                  fontWeight: 'bold',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)',
                  letterSpacing: '0.5px'
                }}>
                  {currentCandle.username}
                </div>
              )}
              
              {/* Burned amount below username */}
              {currentCandle.burnedAmount && parseInt(currentCandle.burnedAmount) > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '8px'
                }}>
                  <span style={{
                    fontSize: isMobile ? '0.9rem' : '0.9rem',
                    filter: 'drop-shadow(0 0 4px rgba(255, 100, 0, 0.8))'
                  }}>🔥</span>
                  <span style={{
                    color: '#ffb000',
                    fontSize: isMobile ? '0.9rem' : '0.9rem',
                    fontWeight: 'bold',
                    textShadow: '0 0 4px rgba(255, 176, 0, 0.6)'
                  }}>
                    {parseInt(currentCandle.burnedAmount).toLocaleString()} RL80
                  </span>
                </div>
              )}
            </div>
            
            {/* Message in center/upper area */}
            {currentCandle.message && !isFlipped && (
              <div style={{
                marginTop: '20px',
                marginLeft: 'auto',
                marginRight: 'auto',
                maxWidth: isMobile ? '280px' : '240px',
                textAlign: 'center',
                padding: '12px',
                background: 'rgba(0, 0, 0, 0.4)',
                borderRadius: '8px',
                backdropFilter: 'blur(8px)'
              }}>
                <div style={{
                  color: '#eaea0b',
                  fontSize: isMobile ? '14px' : '12px',
                  fontStyle: 'italic',
                  lineHeight: '1.4',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.9)'
                }}>
                  "{decodeHTMLEntities(currentCandle.message)}"
                </div>
              </div>
            )}
            
            
            {/* Flipped view - larger display */}
            {isFlipped && (
              <div style={{
                marginTop: '60px',
                marginLeft: 'auto',
                marginRight: 'auto',
                padding: '24px',
                textAlign: 'center',
                maxWidth: isMobile ? '80%' : '80%'
              }}>
                {currentCandle.message && (
                  <p style={{
                    fontSize: isMobile ? '1rem' : '1rem',
                    lineHeight: '1.5',
                    fontStyle: 'italic',
                    color: '#ffd700',
                    margin: '0 0 12px 0'
                  }}>
                    "{decodeHTMLEntities(currentCandle.message)}"
                  </p>
                )}
                {currentCandle.messageType && (
                  <div style={{
                    fontSize: isMobile ? '1rem' : '1rem',
                    color: '#00ff00',
                    marginBottom: '0'
                  }}>
                    {currentCandle.messageType.charAt(0).toUpperCase() + currentCandle.messageType.slice(1)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Reveal Effect Curtains */}
        {!loading && !loadingMyCandles && (
          <>
            <div style={{
              position: 'absolute',
              top: 0,
              left: '-1px',
              width: '50%',
              height: '100%',
              background: 'linear-gradient(135deg, #dc143c 0%, #ff1744 100%)',
              transformOrigin: 'left center',
              transform: isRevealing ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: 20,
              boxShadow: isRevealing ? '10px 0 30px rgba(220, 20, 60, 0.5)' : 'none'
            }} />
            <div style={{
              position: 'absolute',
              top: 0,
              right: '-1px',
              width: '50%',
              height: '100%',
              background: 'linear-gradient(135deg, #ff1744 0%, #dc143c 100%)',
              transformOrigin: 'right center',
              transform: isRevealing ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
              zIndex: 20,
              boxShadow: isRevealing ? '-10px 0 30px rgba(220, 20, 60, 0.5)' : 'none'
            }} />
            
            {/* Particle Container */}
            {showParticles && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 25,
                overflow: 'hidden'
              }}>
                {/* Japanese candle: 4 flame points */}
                {particleCandleType === 'japanese' ? (
                  // 4 flame sources at different positions
                  <>
                    {/* Top-left flame */}
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={`tl-${i}`}
                        style={{
                          position: 'absolute',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: `hsl(${15 + Math.random() * 30}, 100%, ${50 + Math.random() * 20}%)`,
                          left: '45%',
                          top: '45%',
                          animation: `particleExplosion ${0.8 + Math.random() * 0.4}s ease-out forwards`,
                          animationDelay: `${Math.random() * 0.15}s`,
                          '--x-offset': `${Math.random() * 150 - 75}px`,
                          '--y-offset': `${Math.random() * -150}px`
                        }}
                      />
                    ))}
                    {/* Top-right flame */}
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={`tr-${i}`}
                        style={{
                          position: 'absolute',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: `hsl(${15 + Math.random() * 30}, 100%, ${50 + Math.random() * 20}%)`,
                          left: '55%',
                          top: '40%',
                          animation: `particleExplosion ${0.8 + Math.random() * 0.4}s ease-out forwards`,
                          animationDelay: `${Math.random() * 0.15}s`,
                          '--x-offset': `${Math.random() * 150 - 75}px`,
                          '--y-offset': `${Math.random() * -150}px`
                        }}
                      />
                    ))}
                    {/* Bottom-left flame */}
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={`bl-${i}`}
                        style={{
                          position: 'absolute',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: `hsl(${15 + Math.random() * 30}, 100%, ${50 + Math.random() * 20}%)`,
                          left: '35%',
                          top: '50%',
                          animation: `particleExplosion ${0.8 + Math.random() * 0.4}s ease-out forwards`,
                          animationDelay: `${Math.random() * 0.15}s`,
                          '--x-offset': `${Math.random() * 150 - 75}px`,
                          '--y-offset': `${Math.random() * -150}px`
                        }}
                      />
                    ))}
                    {/* Bottom-right flame */}
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={`br-${i}`}
                        style={{
                          position: 'absolute',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: `hsl(${15 + Math.random() * 30}, 100%, ${50 + Math.random() * 20}%)`,
                          left: '65%',
                          top: '38%',
                          animation: `particleExplosion ${0.8 + Math.random() * 0.4}s ease-out forwards`,
                          animationDelay: `${Math.random() * 0.15}s`,
                          '--x-offset': `${Math.random() * 150 - 75}px`,
                          '--y-offset': `${Math.random() * -150}px`
                        }}
                      />
                    ))}
                  </>
                ) : (
                  // Votive candle: single flame point
                  [...Array(30)].map((_, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: `hsl(${15 + Math.random() * 30}, 100%, ${50 + Math.random() * 20}%)`,
                        left: '50%',
                        top: '50%',
                        animation: `particleExplosion ${1 + Math.random() * 0.5}s ease-out forwards`,
                        animationDelay: `${Math.random() * 0.2}s`,
                        '--x-offset': `${Math.random() * 400 - 200}px`,
                        '--y-offset': `${Math.random() * 400 - 200}px`
                      }}
                    />
                  ))
                )}
              </div>
            )}
            
            {/* Diagonal Corner Flip Tab - Hide on Summary tab */}
            {activeTab !== 'summary' && (
              <button
                onClick={() => setIsFlipped(!isFlipped)}
                onMouseEnter={(e) => {
                const ribbon = e.currentTarget.querySelector('div');
                if (ribbon && !isMobile) {
                  ribbon.style.transform = 'rotate(45deg) scale(1.1)';
                  ribbon.style.background = isFlipped ? 'linear-gradient(135deg, #ff6666 0%, #ff0000 100%)' : 'linear-gradient(135deg, #ff4444 0%, #ff6666 100%)';
                }
              }}
              onMouseLeave={(e) => {
                const ribbon = e.currentTarget.querySelector('div');
                if (ribbon && !isMobile) {
                  ribbon.style.transform = 'rotate(45deg) scale(1)';
                  ribbon.style.background = isFlipped ? 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)' : 'linear-gradient(135deg, #ff0000 0%, #ff4444 100%)';
                }
              }}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '80px',
                height: '80px',
                padding: 0,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                overflow: 'hidden',
                zIndex: 20
              }}
            >
              <div style={{
                position: 'absolute',
                top: '10px',
                right: '-24px',
                width: '100px',
                height: '30px',
                background: isFlipped ? 'linear-gradient(135deg, #ff4444 0%, #cc0000 100%)' : 'linear-gradient(135deg, #ff0000 0%, #ff4444 100%)',
                transform: 'rotate(45deg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                transition: 'all 0.3s ease'
              }}>
                <span style={{
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  {isFlipped ? 'Back' : 'Flip'}
                </span>
              </div>
            </button>
            )}
            
            {/* Pause/Play Button */}
            {((activeTab === 'all' && filteredCandles.length > 1) || (activeTab === 'my' && myCandles.length > 1)) && (
              <button
                onClick={() => setIsPaused(!isPaused)}
                style={{
                  position: 'absolute',
                  bottom: isMobile && activeTab === 'my' ? 'calc(100px + env(safe-area-inset-bottom))' : isMobile ? 'calc(60px + env(safe-area-inset-bottom))' : '60px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '10px',
                  background: 'rgba(0, 0, 0, 0.7)',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '50%',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '18px',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                  zIndex: 15,
                  backdropFilter: 'blur(10px)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(0, 0, 0, 0.7)';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
                title={isPaused ? 'Resume auto-play' : 'Pause auto-play'}
              >
                {isPaused ? '▶' : '⏸'}
              </button>
            )}
            
          </>
        )}
        
        {/* Progress indicator */}
        {((activeTab === 'all' && filteredCandles.length > 0) || (activeTab === 'my' && myCandles.length > 1)) && (
          <div style={{
            position: 'absolute',
            bottom: isMobile ? 'calc(20px + env(safe-area-inset-bottom))' : '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '6px',
            padding: '8px',
            background: 'rgba(0, 0, 0, 0.7)',
            borderRadius: '20px',
            backdropFilter: 'blur(10px)'
          }}>
            {(activeTab === 'all' ? filteredCandles : myCandles).map((_, index) => (
              <div
                key={index}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: index === (activeTab === 'all' ? currentAllCandleIndex : currentMyCandleIndex) ? '#00ff88' : 'rgba(255, 255, 255, 0.3)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
                onClick={() => activeTab === 'all' ? setCurrentAllCandleIndex(index) : setCurrentMyCandleIndex(index)}
              />
            ))}
          </div>
        )}
        
        {/* Create Candle Button - Only show on "My Candle" tab */}
        {activeTab === 'my' && onOpenCompactModal && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenCompactModal();
            }}
            style={{
              position: 'absolute',
              bottom: isMobile ? 'calc(20px + env(safe-area-inset-bottom))' : '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #00ff88 0%, #00dd66 100%)',
              border: '2px solid #00ff88',
              borderRadius: '8px',
              color: '#000',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 15px rgba(0, 255, 136, 0.4)',
              whiteSpace: 'nowrap',
              zIndex: 10
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateX(-50%) scale(1.05)';
              e.target.style.boxShadow = '0 6px 20px rgba(0, 255, 136, 0.6)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateX(-50%) scale(1)';
              e.target.style.boxShadow = '0 4px 15px rgba(0, 255, 136, 0.4)';
            }}
          >
            🕯️ Create Candle
          </button>
        )}
      </div>
    </div>
  );
}

// Inject animation styles
if (typeof document !== 'undefined' && !document.getElementById('animation-styles')) {
  const styleElement = document.createElement('style');
  styleElement.id = 'animation-styles';
  styleElement.textContent = `
    @keyframes particleExplosion {
      0% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 1;
      }
      100% {
        transform: translate(
          calc(-50% + var(--x-offset)),
          calc(-50% + var(--y-offset))
        ) scale(0);
        opacity: 0;
      }
    }
    @keyframes pulse {
      0% {
        box-shadow: 0 4px 20px rgba(255, 215, 0, 0.6);
      }
      50% {
        box-shadow: 0 4px 30px rgba(255, 215, 0, 0.9), 0 0 50px rgba(255, 215, 0, 0.4);
      }
      100% {
        box-shadow: 0 4px 20px rgba(255, 215, 0, 0.6);
      }
    }
  `;
  document.head.appendChild(styleElement);
}

// Preload the models
useGLTF.preload('/models/tinyVotiveBox.glb');
useGLTF.preload('/models/tinyJapCanBox.glb');
