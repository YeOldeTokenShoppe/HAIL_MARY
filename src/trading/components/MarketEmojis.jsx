import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Clone, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

const MarketEmoji = ({ type = 'devil', position, scale = 1, orbitRadius, orbitSpeed, orbitOffset, glowIntensity }) => {
  // Load the appropriate model based on type
  const modelPath = type === 'angel' ? '/models/angel_emoji.glb' : 
                    type === 'money' ? '/models/money_emoji.glb' : 
                    type === 'crying' ? '/models/crying_emoji.glb' :
                    '/models/devil_emoji.glb';
  
  const { scene, animations } = useGLTF(modelPath);
  const meshRef = useRef();
  const glowRef = useRef();
  const mixerRef = useRef();
  const [adaptiveScale, setAdaptiveScale] = useState(scale);
  const opacityRef = useRef(0);
  const lifeTimeRef = useRef(0);
  const localTimeRef = useRef(0); // Local time to prevent jumps
  
  const clonedScene = useMemo(() => {
    // Use SkeletonUtils for proper animated model cloning
    return SkeletonUtils.clone(scene);
  }, [scene]);
  
  // Set up animation mixer and play appropriate animation
  useEffect(() => {
    // Debug the model structure
    console.log(`${type} model loaded:`, {
      scene: clonedScene,
      animations: animations,
      animationNames: animations?.map(a => a.name),
      scale: scale
    });
    
    // Calculate actual size after scaling
    const boundingBox = new THREE.Box3().setFromObject(clonedScene);
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    console.log('Devil size before scaling:', size);
    console.log('Devil size after scaling (approx):', {
      x: size.x * scale,
      y: size.y * scale,
      z: size.z * scale
    });
    
    // Traverse and log all meshes in the model
    if (clonedScene) {
      clonedScene.traverse((child) => {
        if (child.isMesh || child.isSkinnedMesh) {
          console.log('Found mesh in devil:', child.name, {
            visible: child.visible,
            material: child.material,
            geometry: child.geometry,
            isSkinnedMesh: child.isSkinnedMesh
          });
          // Force visibility
          child.visible = true;
          child.frustumCulled = false;
          
          // Ensure material is set up properly
          if (child.material) {
            child.material.side = THREE.DoubleSide;
            child.material.transparent = false;
            child.material.opacity = 1;
            child.material.depthWrite = true;
            child.material.depthTest = true;
          }
        }
      });
    }
    
    if (animations && animations.length > 0 && clonedScene) {
      // Create animation mixer
      mixerRef.current = new THREE.AnimationMixer(clonedScene);
      
      // Log all available animations
      console.log('Available animations:', animations.map(clip => ({ 
        name: clip.name, 
        duration: clip.duration,
        tracks: clip.tracks.length 
      })));
      
      // Try to find and play appropriate animation based on type
      let idleClip;
      if (type === 'angel') {
        idleClip = animations.find(clip => 
          clip.name === 'Idle_2' || 
          clip.name === 'Bone.004_00|Idle_2' ||
          clip.name.includes('Idle_2')
        );
      } else if (type === 'money') {
        idleClip = animations.find(clip => 
          clip.name === 'Idle3' || 
          clip.name === 'Bone.002_01|Idle3' ||
          clip.name.includes('Idle3')
        );
      } else if (type === 'crying') {
        idleClip = animations.find(clip => 
          clip.name === 'Idle4' || 
          clip.name === 'Bone.004_01|Idle4' ||
          clip.name.includes('Idle4')
        );
      } else { // devil
        idleClip = animations.find(clip => 
          clip.name === 'Idle' || 
          clip.name.includes('Idle') && !clip.name.includes('Idle_') && !clip.name.includes('Idle3') && !clip.name.includes('Idle4') ||
          clip.name.includes('idle')
        );
      }
      
      if (idleClip) {
        const action = mixerRef.current.clipAction(idleClip, clonedScene);
        action.reset();
        action.setLoop(THREE.LoopRepeat);
        action.setEffectiveWeight(1.0);
        action.setEffectiveTimeScale(1.0);
        action.fadeIn(0.2);
        action.play();
        console.log('Playing Idle animation:', idleClip.name, 'Duration:', idleClip.duration);
        
        // Store action reference for debugging
        mixerRef.current.idleAction = action;
      } else if (animations.length > 0) {
        // Play all animations if we can't find Idle specifically
        animations.forEach((clip, index) => {
          const action = mixerRef.current.clipAction(clip, clonedScene);
          action.reset();
          action.setLoop(THREE.LoopRepeat);
          action.setEffectiveWeight(1.0);
          action.setEffectiveTimeScale(1.0);
          action.play();
          console.log(`Playing animation ${index}:`, clip.name);
        });
      }
    }
    
    return () => {
      // Clean up mixer on unmount
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }
    };
  }, [animations, clonedScene]);
  
  useFrame((state, delta) => {
    // Update animation mixer
    if (mixerRef.current && delta > 0) {
      mixerRef.current.update(delta);
    }
    if (meshRef.current && clonedScene) {
      // Use local time that increments smoothly
      localTimeRef.current += delta;
      const time = localTimeRef.current;
      lifeTimeRef.current += delta;
      
      // Fade in logic only - no fade out
      const fadeInDuration = 2.0; // 2 seconds to fade in
      
      if (lifeTimeRef.current < fadeInDuration) {
        // Fading in
        opacityRef.current = lifeTimeRef.current / fadeInDuration;
      } else {
        // Fully visible forever
        opacityRef.current = 1;
      }
      
      // Apply opacity to all materials
      clonedScene.traverse((child) => {
        if (child.isMesh || child.isSkinnedMesh) {
          if (child.material) {
            child.material.transparent = true;
            child.material.opacity = opacityRef.current;
          }
        }
      });
      
      // Orbital motion around the Virgin Mary - simple and stable
      const angle = time * orbitSpeed * 0.3 + orbitOffset; // Even slower speed
      meshRef.current.position.x = position[0] + Math.cos(angle) * orbitRadius;
      meshRef.current.position.z = position[2] + Math.sin(angle) * orbitRadius;
      
      // Enhanced floating motion with multiple sine waves for more organic movement
      if (type === 'money') {
        // Money emojis: Energetic, bouncy movement
        const floatBase = Math.sin(time * 1.2 + orbitOffset) * 4;
        const floatSecondary = Math.cos(time * 2.5 + orbitOffset * 0.5) * 1.5;
        meshRef.current.position.y = position[1] + 15 + floatBase + floatSecondary;
        
        // Add slight horizontal sway
        meshRef.current.position.x += Math.sin(time * 0.9 + orbitOffset) * 1.5;
      } else if (type === 'angel') {
        // Angels: Graceful, smooth floating
        const floatBase = Math.sin(time * 0.7 + orbitOffset) * 3;
        const floatSecondary = Math.sin(time * 1.4 + orbitOffset * 1.5) * 1;
        meshRef.current.position.y = position[1] + 8 + floatBase + floatSecondary;
        
        // Gentle horizontal figure-8 motion
        meshRef.current.position.x += Math.sin(time * 0.5 + orbitOffset) * 0.8;
        meshRef.current.position.z += Math.cos(time * 0.5 + orbitOffset) * 0.5;
      } else if (type === 'crying') {
        // Crying emojis: Slow, heavy sinking motion
        const floatBase = Math.sin(time * 0.3 + orbitOffset) * 1.5;
        const floatSecondary = Math.cos(time * 0.6 + orbitOffset * 2) * 0.5;
        meshRef.current.position.y = position[1] - 10 + floatBase - floatSecondary;
        
        // Slight trembling motion
        meshRef.current.position.x += Math.sin(time * 4 + orbitOffset) * 0.1;
      } else { // devil
        // Devils: Mischievous, irregular bobbing
        const floatBase = Math.sin(time * 0.8 + orbitOffset) * 2.5;
        const floatSecondary = Math.sin(time * 2.1 + orbitOffset * 0.7) * 1;
        const floatTertiary = Math.cos(time * 3.5 + orbitOffset * 1.2) * 0.5;
        meshRef.current.position.y = position[1] - 5 + floatBase + floatSecondary + floatTertiary;
        
        // Zigzag horizontal motion
        meshRef.current.position.x += Math.sin(time * 1.5 + orbitOffset) * 1.2;
      }
      
      // Enhanced rotation with more complex motion
      meshRef.current.rotation.y = angle * -1 + Math.sin(time * 0.5) * 0.1; // Face center with slight variation
      meshRef.current.rotation.z = Math.sin(time * 0.8 + orbitOffset) * 0.08; // More noticeable wobble
      meshRef.current.rotation.x = Math.cos(time * 0.6 + orbitOffset * 0.5) * 0.05; // Add pitch variation
      
      // Pulsing glow effect (also affected by opacity)
      if (glowRef.current) {
        glowRef.current.intensity = glowIntensity * opacityRef.current * (1 + Math.sin(time * 0.8) * 0.2); // Slower, subtler pulse
      }
    }
  });
  
  return (
    <group ref={meshRef}>
      {/* Billboard wrapper to always face camera */}
      <Billboard
        follow={true}
        lockX={false}
        lockY={false}
        lockZ={false}
      >
        <primitive 
          object={clonedScene} 
          scale={scale}  // Scale is already large enough (80-120)
          rotation={[0, 0, 0]}
        />
        {/* Colored glow effect based on type - reduced intensity */}
        <pointLight 
          ref={glowRef}
          color={type === 'angel' ? '#87ceeb' : type === 'money' ? '#ffd700' : type === 'crying' ? '#4169e1' : '#ff0000'} 
          intensity={glowIntensity * 0.5} 
          distance={20}
          decay={2}
        />
      </Billboard>
    </group>
  );
};

// Preload the models
useGLTF.preload('/models/devil_emoji.glb');
useGLTF.preload('/models/angel_emoji.glb');
useGLTF.preload('/models/money_emoji.glb');
useGLTF.preload('/models/crying_emoji.glb');

const MarketEmojis = ({ centerPosition = [1, 15, -9], onDataUpdate, manualFearGreedData = null }) => {
  const [fearGreedIndex, setFearGreedIndex] = useState(null);
  const [devilCount, setDevilCount] = useState(0);
  const [angelCount, setAngelCount] = useState(0);
  const [moneyCount, setMoneyCount] = useState(0);
  const [cryingCount, setCryingCount] = useState(0);
  const [marketVolume, setMarketVolume] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Fetch Market Volume Data
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        // Try CoinGecko API first (no CORS, free tier available)
        const geckoResponse = await fetch(
          'https://api.coingecko.com/api/v3/global',
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            }
          }
        ).catch(() => null);

        if (geckoResponse && geckoResponse.ok) {
          const geckoData = await geckoResponse.json();
          // CoinGecko returns volume in USD already
          const volume24h = geckoData.data?.total_volume?.usd || 0;
          const volumeInBillions = volume24h / 1000000000;
          
          setMarketVolume({
            raw: volume24h,
            billions: volumeInBillions,
            formatted: `$${volumeInBillions.toFixed(1)}B`,
            marketCap: geckoData.data?.total_market_cap?.usd || 0,
            source: 'CoinGecko'
          });
          
          console.log('Market Volume (24h from CoinGecko):', volumeInBillions.toFixed(1), 'billion');
          return;
        }

        // Try Firebase Cloud Function as backup
        const response = await fetch(
          'https://us-central1-illumin8-e963f.cloudfunctions.net/api/global-metrics',
          {
            method: 'GET',
            mode: 'cors',
            headers: {
              'Accept': 'application/json',
            }
          }
        ).catch(() => null);

        if (response && response.ok) {
          const data = await response.json();
          // Extract 24h volume (in billions)
          const volume24h = data.data?.quote?.USD?.total_volume_24h || 0;
          const volumeInBillions = volume24h / 1000000000;
          
          setMarketVolume({
            raw: volume24h,
            billions: volumeInBillions,
            formatted: `$${volumeInBillions.toFixed(1)}B`,
            marketCap: data.data?.quote?.USD?.total_market_cap || 0,
            source: 'CoinMarketCap'
          });
          
          console.log('Market Volume (24h from CMC):', volumeInBillions.toFixed(1), 'billion');
        } else {
          // Fallback to more realistic simulated volume (150-200B range)
          const hour = new Date().getHours();
          const baseVolume = 175; // More realistic base
          const variance = Math.sin((hour / 24) * Math.PI * 2) * 25 + Math.random() * 10;
          const simulatedVolume = baseVolume + variance;
          
          setMarketVolume({
            raw: simulatedVolume * 1000000000,
            billions: simulatedVolume,
            formatted: `$${simulatedVolume.toFixed(1)}B`,
            simulated: true
          });
          
          console.log('Using simulated volume:', simulatedVolume.toFixed(1), 'billion (more realistic)');
        }
      } catch (error) {
        console.warn('Market data fetch failed:', error);
        // Set more realistic default simulated volume
        const simulatedVolume = 150 + Math.random() * 50;
        setMarketVolume({
          raw: simulatedVolume * 1000000000,
          billions: simulatedVolume,
          formatted: `$${simulatedVolume.toFixed(1)}B`,
          simulated: true
        });
      }
    };

    fetchMarketData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchMarketData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Fear & Greed Index
  useEffect(() => {
    const fetchFearGreedIndex = async () => {
      try {
        // Try CoinMarketCap API first with your API key
        const cmcApiKey = process.env.NEXT_PUBLIC_COINMARKETCAP;
        if (cmcApiKey) {
          // Using proxy to avoid CORS issues
          const cmcResponse = await fetch('/api/cmc-fear-greed', {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            }
          }).catch((err) => {
            console.error('CMC Fear & Greed fetch error:', err);
            return null;
          });
          
          if (cmcResponse && cmcResponse.ok) {
            const cmcData = await cmcResponse.json();
            console.log('CMC API Response:', cmcData);
            
            // CMC returns data as an object with value, update_time, and value_classification
            if (cmcData && cmcData.data && cmcData.data.value !== undefined) {
              const value = parseInt(cmcData.data.value);
              const classification = cmcData.data.value_classification || (
                value <= 20 ? 'Extreme Fear' :
                value <= 39 ? 'Fear' :
                value <= 60 ? 'Neutral' :
                value <= 80 ? 'Greed' : 'Extreme Greed'
              );
              
              setFearGreedIndex({
                value: value,
                classification: classification,
                updateTime: cmcData.data.update_time,
                source: 'CoinMarketCap'
              });
              console.log('Fear & Greed Index (CoinMarketCap):', {
                value: value,
                classification: classification,
                updateTime: cmcData.data.update_time
              });
              setLoading(false);
              return;
            } else {
              console.warn('CMC response missing expected data structure:', cmcData);
            }
          }
        }
        
        // Fallback to our server-side API endpoint
        const altResponse = await fetch('/api/fear-greed', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        }).catch((err) => {
          console.error('Fear-greed API fetch error:', err);
          return null;
        });
        
        if (altResponse && altResponse.ok) {
          const altData = await altResponse.json();
          if (altData && altData.data && altData.data[0]) {
            const latestData = altData.data[0];
            const value = parseInt(latestData.value);
            setFearGreedIndex({
              value: value,
              classification: latestData.value_classification,
              timestamp: latestData.timestamp,
              time_until_update: latestData.time_until_update
            });
            console.log('Fear & Greed Index (Alternative.me):', {
              value: value,
              classification: latestData.value_classification,
              timestamp: new Date(latestData.timestamp * 1000).toLocaleString()
            });
            setLoading(false);
            return;
          }
        } else if (altResponse) {
          console.warn('Alternative.me API response not ok:', altResponse.status);
        }
        
        // Try to get CMC Fear & Greed via proxy/alternative endpoint
        // Note: Direct CMC API requires API key, so we'll try public alternatives
        
        // Try CoinStats as another alternative (updates every 12 hours)
        const coinStatsResponse = await fetch(
          'https://api.coinstats.app/public/v1/charts/bitcoin/fear-greed',
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            }
          }
        ).catch((err) => {
          console.error('CoinStats fetch error:', err);
          return null;
        });
        
        if (coinStatsResponse && coinStatsResponse.ok) {
          const coinStatsData = await coinStatsResponse.json();
          if (coinStatsData && coinStatsData.value) {
            const value = parseInt(coinStatsData.value);
            let classification = 'Neutral';
            if (value <= 20) classification = 'Extreme Fear';
            else if (value <= 39) classification = 'Fear';
            else if (value > 80) classification = 'Extreme Greed';
            else if (value > 60) classification = 'Greed';
            
            setFearGreedIndex({
              value: value,
              classification: classification,
              source: 'CoinStats'
            });
            console.log('Fear & Greed Index (CoinStats):', value, classification);
            setLoading(false);
            return;
          }
        }
        
        // Try Firebase Cloud Function as final backup
        const cmcResponse = await fetch(
          'https://us-central1-illumin8-e963f.cloudfunctions.net/api/fear-and-greed',
          { 
            method: 'GET',
            mode: 'cors',
            headers: {
              'Accept': 'application/json',
            }
          }
        ).catch(() => null);
        
        if (cmcResponse && cmcResponse.ok) {
          const cmcData = await cmcResponse.json();
          setFearGreedIndex({
            value: cmcData.value,
            classification: cmcData.classification,
            source: 'CMC via Firebase'
          });
          console.log('Fear & Greed Index (CMC via Firebase):', cmcData);
          setLoading(false);
          return;
        }
        
        // If both fail, use a simulated value based on time of day
        // This creates a dynamic experience even without API access
        const hour = new Date().getHours();
        const simulatedValue = 50 + Math.sin((hour / 24) * Math.PI * 2) * 30 + Math.random() * 10;
        const value = Math.floor(Math.min(100, Math.max(0, simulatedValue)));
        
        let classification = 'Neutral';
        if (value > 80) classification = 'Extreme Greed';
        else if (value > 60) classification = 'Greed';
        else if (value <= 20) classification = 'Extreme Fear';
        else if (value <= 39) classification = 'Fear';
        
        setFearGreedIndex({
          value,
          classification,
          simulated: true
        });
        console.log('Using simulated Fear & Greed:', value, classification);
        
      } catch (error) {
        console.warn('Fear & Greed API unavailable, using simulated value:', error.message);
        // Set a default value for testing
        const simulatedValue = 65 + Math.random() * 20;
        setFearGreedIndex({
          value: Math.floor(simulatedValue),
          classification: 'Greed',
          simulated: true
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchFearGreedIndex();
    // Refresh every 5 minutes
    const interval = setInterval(fetchFearGreedIndex, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Use manual data if provided
  useEffect(() => {
    if (manualFearGreedData && manualFearGreedData.value !== undefined) {
      // Only update if the value actually changed
      if (fearGreedIndex?.value === manualFearGreedData.value && fearGreedIndex?.manual === true) {
        return; // Skip if value hasn't changed
      }
      
      console.log('MarketEmojis: Manual mode update received, value:', manualFearGreedData.value);
      // Set the fear greed index from manual data
      setFearGreedIndex(manualFearGreedData);
      // Calculate emoji counts dynamically based on manual value
      const { value } = manualFearGreedData;
      
      let devils = 0;
      let angels = 0;
      let money = 0;
      let crying = 0;
      
      if (value > 80) {
        // Extreme Greed (>80): Money emojis appear!
        devils = 0;
        angels = 0; // No angels, pure greed!
        money = Math.floor(4 + (value - 80) / 20 * 3); // 4-7 money emojis
        console.log(`EXTREME GREED MANUAL: Setting angels=0, money=${money} for value=${value}`);
      } else if (value > 60) {
        // Greed (61-80): Angels warning
        devils = 0;
        angels = Math.floor(3 + (value - 60) / 20 * 3); // 3-6 angels
        money = 0;
      } else if (value >= 40) {
        // Neutral (40-60): Balanced
        const neutralMid = 50;
        if (value < neutralMid) {
          devils = Math.floor(1 + (neutralMid - value) / 10 * 2); // 1-3 devils
          angels = Math.floor(1 + (value - 40) / 10); // 1-2 angels
        } else {
          devils = Math.floor(1 + (60 - value) / 10); // 1-2 devils
          angels = Math.floor(1 + (value - neutralMid) / 10 * 2); // 1-3 angels
        }
        money = 0;
      } else if (value >= 20) {
        // Fear (20-39): Devils tempting
        devils = Math.floor(3 + (40 - value) / 20 * 3); // 3-6 devils
        angels = 0;
        money = 0;
        crying = 0;
      } else {
        // Extreme Fear (<20): Maximum devils and crying
        devils = Math.floor(5 + (20 - value) / 20 * 3); // 5-8 devils
        angels = 0;
        money = 0;
        crying = Math.floor(3 + (20 - value) / 20 * 3); // 3-6 crying emojis
      }
      
      setDevilCount(devils);
      setAngelCount(angels);
      setMoneyCount(money);
      setCryingCount(crying);
      // console.log(`MarketEmojis: Manual mode emoji counts - Devils: ${devils}, Angels: ${angels}, Money: ${money}`);
      
      // Call the callback with updated data for manual mode
      if (onDataUpdate) {
        onDataUpdate({
          ...manualFearGreedData,
          devilCount: devils,
          angelCount: angels,
          moneyCount: money,
          cryingCount: crying,
          marketVolume: marketVolume
        });
      }
    }
  }, [manualFearGreedData?.value, manualFearGreedData?.manual, marketVolume, onDataUpdate]); // Watch for value, manual flag, and volume changes
  
  // Calculate devil and angel counts based on Fear & Greed value (for live data)
  useEffect(() => {
    // Skip if we're in manual mode
    if (manualFearGreedData) return;
    
    if (fearGreedIndex) {
      const { value } = fearGreedIndex;
      
      // Devils appear during fear (temptation), angels during greed (warning), money at peak greed, crying at extreme fear
      let devils = 0;
      let angels = 0;
      let money = 0;
      let crying = 0;
      
      if (value > 80) {
        // Extreme Greed (>80): Money emojis appear!
        devils = 0;
        angels = 0; // No angels, pure greed!
        money = Math.floor(4 + (value - 80) / 20 * 3); // 4-7 money emojis
        console.log(`EXTREME GREED LIVE: Setting angels=0, money=${money} for value=${value}`);
      } else if (value > 60) {
        // Greed (61-80): Angels warning
        devils = 0;
        angels = Math.floor(3 + (value - 60) / 20 * 3); // 3-6 angels
        money = 0;
      } else if (value >= 40) {
        // Neutral (40-60): Balanced
        const neutralMid = 50;
        if (value < neutralMid) {
          devils = Math.floor(1 + (neutralMid - value) / 10 * 2); // 1-3 devils
          angels = Math.floor(1 + (value - 40) / 10); // 1-2 angels
        } else {
          devils = Math.floor(1 + (60 - value) / 10); // 1-2 devils
          angels = Math.floor(1 + (value - neutralMid) / 10 * 2); // 1-3 angels
        }
        money = 0;
      } else if (value >= 20) {
        // Fear (20-39): Devils tempting
        devils = Math.floor(3 + (40 - value) / 20 * 3); // 3-6 devils
        angels = 0;
        money = 0;
        crying = 0;
      } else {
        // Extreme Fear (<20): Maximum devils and crying
        devils = Math.floor(5 + (20 - value) / 20 * 3); // 5-8 devils
        angels = 0;
        money = 0;
        crying = Math.floor(3 + (20 - value) / 20 * 3); // 3-6 crying emojis
      }
      
      setDevilCount(devils);
      setAngelCount(angels);
      setMoneyCount(money);
      setCryingCount(crying);
      console.log(`Fear & Greed: ${value} (${fearGreedIndex.classification}) - Spawning ${devils} devils, ${angels} angels, ${money} money, and ${crying} crying emojis`);
      
      // Call the callback with updated data
      if (onDataUpdate) {
        onDataUpdate({
          ...fearGreedIndex,
          devilCount: devils,
          angelCount: angels,
          moneyCount: money,
          cryingCount: crying,
          marketVolume: marketVolume
        });
      }
    }
  }, [fearGreedIndex, manualFearGreedData, marketVolume]);
  
  // Generate devil positions and parameters
  const devils = useMemo(() => {
    const devilArray = [];
    for (let i = 0; i < devilCount; i++) {
      const layer = Math.floor(i / 3); // Create layers of devils
      const indexInLayer = i % 3;
      
      // Use deterministic values based on index instead of Math.random()
      const seedValue = (i * 137.5) % 1; // Golden angle for distribution
      
      devilArray.push({
        id: i,
        scale: 0.4 + seedValue * 0.2, // Scale 0.4-0.6
        orbitRadius: 25 + layer * 10 + (seedValue * 5), // Inner orbit
        orbitSpeed: 0.08 + (seedValue * 0.1), // Slower, more controlled speed
        orbitOffset: (indexInLayer * Math.PI * 2) / 3 + (seedValue * 0.5), // Spread around orbit
        height: -5 - layer * 5, // Devils orbit BELOW the Virgin Mary
        glowIntensity: 2.0 + (fearGreedIndex?.value || 50) / 50, // Stronger glow
      });
    }
    return devilArray;
  }, [devilCount, fearGreedIndex]);
  
  // Generate angel positions and parameters
  const angels = useMemo(() => {
    const angelArray = [];
    for (let i = 0; i < angelCount; i++) {
      const layer = Math.floor(i / 3); // Create layers of angels
      const indexInLayer = i % 3;
      
      // Use deterministic values based on index
      const seedValue = ((i * 137.5) % 1); // Golden angle for distribution
      
      angelArray.push({
        id: i,
        scale: 0.4 + seedValue * 0.2, // Scale 0.4-0.6
        orbitRadius: 30 + layer * 10 + (seedValue * 5), // Outer orbit
        orbitSpeed: 0.1 + (seedValue * 0.15), // Slower, more peaceful movement
        orbitOffset: (indexInLayer * Math.PI * 2) / 3 + (seedValue * 0.5) + Math.PI, // Opposite side from devils
        height: 20 + layer * 5, // Angels orbit ABOVE the Virgin Mary
        glowIntensity: 1.5 + (50 - (fearGreedIndex?.value || 50)) / 50, // Glow based on fear level
      });
    }
    return angelArray;
  }, [angelCount, fearGreedIndex]);
  
  // Generate money emoji positions and parameters
  const moneyEmojis = useMemo(() => {
    const moneyArray = [];
    for (let i = 0; i < moneyCount; i++) {
      const layer = Math.floor(i / 3); // Create layers of money (3 per layer like devils/angels)
      const indexInLayer = i % 3;
      
      // Use deterministic values based on index
      const seedValue = ((i * 137.5) % 1); // Golden angle for distribution
      
      moneyArray.push({
        id: i,
        scale: 0.5 + seedValue * 0.2, // Slightly larger scale
        orbitRadius: 35 + layer * 12 + (seedValue * 7), // Widest orbit
        orbitSpeed: 0.2 + (seedValue * 0.2), // Fast spinning
        orbitOffset: (indexInLayer * Math.PI * 2 / 3) + (seedValue * 0.8), // Evenly spread around full circle
        height: 35 + layer * 8 + (seedValue * 3), // Highest position with variation
        glowIntensity: 3.0, // Strong golden glow
      });
    }
    return moneyArray;
  }, [moneyCount]);
  
  // Generate crying emoji positions and parameters
  const cryingEmojis = useMemo(() => {
    const cryingArray = [];
    for (let i = 0; i < cryingCount; i++) {
      const layer = Math.floor(i / 3); // Create layers
      const indexInLayer = i % 3;
      
      // Use deterministic values based on index
      const seedValue = ((i * 137.5) % 1); // Golden angle for distribution
      
      cryingArray.push({
        id: i,
        scale: 0.5 + seedValue * 0.2, // Scale 0.5-0.7
        orbitRadius: 20 + layer * 8 + (seedValue * 4), // Close orbit
        orbitSpeed: 0.05 + (seedValue * 0.05), // Very slow, sad movement
        orbitOffset: (indexInLayer * Math.PI * 2 / 3) + (seedValue * 0.3),
        height: -15 - layer * 3, // Lowest position
        glowIntensity: 1.0 + (30 - (fearGreedIndex?.value || 30)) / 20, // Dim blue glow
      });
    }
    return cryingArray;
  }, [cryingCount, fearGreedIndex]);
  
  if (loading) return null;
  
  return (
    <>
      {/* Display current Fear & Greed value */}
      {fearGreedIndex && (
        <group position={[centerPosition[0], centerPosition[1] + 30, centerPosition[2]]}>
          {/* You could add 3D text here to show the index value */}
        </group>
      )}
      
      {/* Render devil emojis */}
      {devils.map((devil) => (
        <MarketEmoji
          type="devil"
          key={`devil-${devil.id}`}
          position={[centerPosition[0], centerPosition[1] + devil.height, centerPosition[2]]}
          scale={devil.scale}
          orbitRadius={devil.orbitRadius}
          orbitSpeed={devil.orbitSpeed}
          orbitOffset={devil.orbitOffset}
          glowIntensity={devil.glowIntensity}
        />
      ))}
      
      {/* Render angel emojis */}
      {angels.map((angel) => (
        <MarketEmoji
          type="angel"
          key={`angel-${angel.id}`}
          position={[centerPosition[0], centerPosition[1] + angel.height, centerPosition[2]]}
          scale={angel.scale}
          orbitRadius={angel.orbitRadius}
          orbitSpeed={angel.orbitSpeed}
          orbitOffset={angel.orbitOffset}
          glowIntensity={angel.glowIntensity}
        />
      ))}
      
      {/* Render money emojis for extreme greed */}
      {moneyEmojis.map((money) => (
        <MarketEmoji
          type="money"
          key={`money-${money.id}`}
          position={[centerPosition[0], centerPosition[1] + money.height, centerPosition[2]]}
          scale={money.scale}
          orbitRadius={money.orbitRadius}
          orbitSpeed={money.orbitSpeed}
          orbitOffset={money.orbitOffset}
          glowIntensity={money.glowIntensity}
        />
      ))}
      
      {/* Render crying emojis for extreme fear */}
      {cryingEmojis.map((crying) => (
        <MarketEmoji
          type="crying"
          key={`crying-${crying.id}`}
          position={[centerPosition[0], centerPosition[1] + crying.height, centerPosition[2]]}
          scale={crying.scale}
          orbitRadius={crying.orbitRadius}
          orbitSpeed={crying.orbitSpeed}
          orbitOffset={crying.orbitOffset}
          glowIntensity={crying.glowIntensity}
        />
      ))}
      
      {/* Particle effects removed - was causing bubble appearance at high index values */}
    </>
  );
};


export default MarketEmojis;