import { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { TEMPLE_ANCHOR_NAME } from "@/components/CyborgTempleScene";

// How often (in frames) to re-hunt the temple anchor while it's missing.
// getObjectByName walks the whole graph, so this only runs while there's
// nothing to find — once resolved, the check below is a couple of pointer
// hops per frame.
const TEMPLE_PROBE_INTERVAL = 15;

// Would this anchor actually draw? It must hold a loaded model, have no hidden
// ancestor (R3F hides a suspended tree by flipping visible=false on its
// objects), and — the subtle one — still climb all the way to THIS scene.
// Unmounting the temple detaches its whole group, which leaves the anchor with
// a perfectly good parent that simply isn't in the scene anymore; checking
// `parent` alone reads that orphan as present and the ring keeps drawing.
const isAnchorDrawing = (anchor, scene) => {
  if (!anchor || anchor.children.length === 0) return false;
  let node = anchor;
  let root = anchor;
  while (node) {
    if (node.visible === false) return false;
    root = node;
    node = node.parent;
  }
  return root === scene;
};

// Is a temple currently on screen? Caches the anchor and re-hunts (throttled —
// getObjectByName walks the graph) whenever the cached one stops drawing.
const isTempleShowing = (templeRef, probeRef, scene) => {
  if (!scene) return false;
  if (isAnchorDrawing(templeRef.current, scene)) return true;
  probeRef.current += 1;
  if (probeRef.current % TEMPLE_PROBE_INTERVAL !== 0) return false;
  // getObjectByName only searches the live graph, so a detached anchor can't
  // come back this way — only a freshly mounted temple can.
  templeRef.current = scene.getObjectByName(TEMPLE_ANCHOR_NAME) || null;
  return isAnchorDrawing(templeRef.current, scene);
};

const SUB_DIGITS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
const toSubscript = (n) =>
  String(n).split("").map((d) => SUB_DIGITS[Number(d)] ?? d).join("");

// Compact sub-cent price notation, mirrors ChartShrine: 0.00000003352 → $0.0₇3352
const formatSubCentPrice = (p) => {
  if (p == null || !Number.isFinite(p) || p <= 0) return "—";
  if (p >= 1) return `$${p.toFixed(4)}`;
  if (p >= 0.001) return `$${p.toFixed(5)}`;
  const frac = p.toFixed(20).split(".")[1];
  let zeros = 0;
  while (zeros < frac.length && frac[zeros] === "0") zeros++;
  const sig = frac.slice(zeros, zeros + 4).replace(/0+$/, "") || "0";
  return `$0.0${toSubscript(zeros)}${sig}`;
};

const TickerDisplay3 = ({
  modelRef,
  is80sMode = false,
  onLoad,
  isMobile = false,
  yPosition = -1.53,
  mobileYPosition = -0.83,
  // Optional external override. Presence of the temple is checked per frame
  // below and is the usual reason the ring hides, so callers only need this to
  // suppress it for reasons of their own; false always wins.
  visible = true,
}) => {
  const meshRef = useRef();
  // Same mesh as meshRef, held in state so <primitive> re-renders when the
  // init effect rebuilds it.
  const [meshObject, setMeshObject] = useState(null);
  const templeRef = useRef(null);
  const probeRef = useRef(0);
  const canvasRef = useRef();
  const textureRef = useRef();
  const scrollPos = useRef(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const lastModelScale = useRef(1); // Track the last known model scale
  const isMountedRef = useRef(true); // Track if component is mounted
  const hasCalledOnLoad = useRef(false); // Track if onLoad has been called

  // Get access to the main Three.js scene
  const threeContext = useThree();
  const mainScene = threeContext?.scene;
  const sceneRef = useRef(mainScene); // Store a stable reference
  const [tickerPosition, setTickerPosition] = useState(null);
  const [tickerRotation, setTickerRotation] = useState(null);
  const [tickerScale, setTickerScale] = useState(null);
  const [isReady, setIsReady] = useState(false);

  const [marketData, setMarketData] = useState([
    // Initialize with placeholder data to avoid "Loading" message
    { name: "Bitcoin", symbol: "BTC", price: 0, changePercent: 0 },
    { name: "Ethereum", symbol: "ETH", price: 0, changePercent: 0 },
    { name: "S&P 500", symbol: "^GSPC", price: 0, changePercent: 0 },
    { name: "Nasdaq", symbol: "^IXIC", price: 0, changePercent: 0 }
  ]);
  const [fearGreed, setFearGreed] = useState(null);

  // Cleanup on unmount
  useEffect(() => {
    // Ensure mounted ref is true when component mounts
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Update scene ref when scene changes
  useEffect(() => {
    sceneRef.current = mainScene;
  }, [mainScene]);

  // Check if we're ready to proceed
  useEffect(() => {

    if (threeContext && mainScene && typeof mainScene.traverse === 'function') {
      setIsReady(true);
    } else {
      setIsReady(false);
    }
  }, [threeContext, mainScene]);

  // Fetch all data after a delay to not block initial render
  useEffect(() => {
    // Defer API calls to allow smooth animation
    const initTimer = setTimeout(() => {
      // Fetch data without blocking - fire and forget
      fetchYahooFinanceData().catch(err => console.error('Market data fetch error:', err));
      fetchCryptoData().catch(err => console.error('Crypto data fetch error:', err));
      fetchRL80Data().catch(err => console.error('RL80 data fetch error:', err));
    }, 1500); // 1.5 second delay to let animations establish

    // Set up intervals for regular updates
    const marketDataInterval = setInterval(fetchYahooFinanceData, 300000); // 5 minutes
    const cryptoInterval = setInterval(fetchCryptoData, 300000); // 5 minutes
    const rl80Interval = setInterval(fetchRL80Data, 300000); // 5 minutes

    return () => {
      clearTimeout(initTimer);
      clearInterval(marketDataInterval);
      clearInterval(cryptoInterval);
      clearInterval(rl80Interval);
    };
  }, []);

  // Alpha Vantage data effect - disabled due to CORS
  // useEffect(() => {
  //   fetchAlphaVantageData();
  //   // Fetch Alpha Vantage data every 30 minutes
  //   const interval = setInterval(fetchAlphaVantageData, 1800000);
  //   return () => clearInterval(interval);
  // }, []);

  // Instead of searching for ticker, just use a fixed position
  useEffect(() => {

    // Don't proceed if component is not ready
    if (!isReady) {
      return;
    }

    // Don't proceed if not mounted
    if (!isMountedRef.current) {
      return;
    }

    // Set a fixed position for the ticker instead of searching for it
    const y = isMobile ? mobileYPosition : yPosition;
    setTickerPosition(new THREE.Vector3(0.0, y, 0.0)); // Position at ground level
    setTickerRotation(new THREE.Euler(0, 0, 0));
    setTickerScale(new THREE.Vector3(2.23, 2.23, 2.23));
  }, [isReady, isMobile, yPosition, mobileYPosition]);

  // Initialize canvas and texture when ticker position is found
  useEffect(() => {
    if (!tickerPosition || !mainScene || !isReady) return;
    
    try {
      const canvas = document.createElement("canvas");
      // Set canvas dimensions for the thin height
      canvas.width = 2048; // Power of 2 for better GPU performance
      canvas.height = 32;  // Slightly deeper ticker for legibility
      canvasRef.current = canvas;

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1, 1);
      texture.needsUpdate = true;
      textureRef.current = texture;

      texture.flipY = false;
      texture.repeat.set(1, 1);
      texture.offset.set(0, 0);

      // Draw initial test pattern
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Fill with a black background
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Add some text
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 16px Arial"; // Smaller font for thin ticker
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          "LOADING TICKER DATA...",
          canvas.width / 2,
          canvas.height / 2
        );

        texture.needsUpdate = true;
      }

      textureRef.current = texture;

      // Create a curved cylinder for the ticker display matching the original dimensions
      // Original ticker dimensions: x: 4.16, y: 4.16, z: 0.213
      // Radius is 4.16 / 2 = 2.08, height is 0.213
      
      // Create cylinder matching the original ticker dimensions
      // Original dimensions from logs: x: 2, y: 0.08228, z: 2
      // So radius = 1 (2/2), height = 0.08228
      const originalRadius = 1; // Half of x or z dimension
      const originalHeight = 0.1; // y dimension from logs
      
      
      const geometry = new THREE.CylinderGeometry(
        originalRadius,    // radiusTop
        originalRadius,    // radiusBottom
        originalHeight,    // height
        64,               // radialSegments
        1,                // heightSegments
        true              // openEnded
      );

      // Create material with our texture
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: false,
        side: THREE.DoubleSide, // Only show front side
        color: 0xffffff,
        depthTest: true,
        depthWrite: true,
      });

      // Flip texture horizontally to correct mirroring
      texture.repeat.set(-1, 1); // Negative X to flip horizontally
      
      // Start rendering immediately with placeholder data
      const ctx2 = canvas.getContext("2d");
      if (ctx2) {
        ctx2.fillStyle = "#000000";
        ctx2.fillRect(0, 0, canvas.width, canvas.height);
        ctx2.fillStyle = "#FFFFFF";
        ctx2.font = "bold 16px Arial"; // Smaller font for smaller height
        ctx2.textAlign = "left";
        ctx2.textBaseline = "middle";
        // Show initial ticker items even with 0 values
        ctx2.fillText(
          "Bitcoin: Loading... ◆ Ethereum: Loading... ◆ S&P 500: Loading... ◆ Nasdaq: Loading...",
          10,
          canvas.height / 2
        );
        texture.needsUpdate = true;
      }

      // Create the mesh
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = visible;

      // Use the ticker's position, rotation AND scale
      mesh.position.copy(tickerPosition);
      mesh.position.y += 0.12; // Raise the ticker slightly (adjust this value as needed)
      mesh.rotation.copy(tickerRotation);
      mesh.scale.copy(tickerScale); // Apply the world scale
      
      // Flip the cylinder to correct text direction
      // Try rotating 180 degrees around Y axis
      mesh.rotation.x += Math.PI;

      // NOT scene.add(mesh). The mesh is handed to R3F via <primitive> below
      // so React owns its lifetime: it attaches to the same scene root either
      // way, but it now unmounts with this component instead of outliving it.
      // While it was added imperatively it survived everything — a temple
      // remount (LT TV swap, a dev Fast Refresh) left the ring hanging alone
      // in an empty room until the new GLB finished parsing.

      // Publish through STATE, not just the ref: <primitive> renders whatever
      // this effect built, and a ref assignment doesn't re-render. This effect
      // re-runs whenever the position/rotation/scale state objects change
      // identity, so a ref-only handoff would leave the primitive holding the
      // first mesh forever while later ones floated free.
      meshRef.current = mesh;
      setMeshObject(mesh);

      setIsInitialized(true);

      // Call onLoad callback if provided (only once)
      if (onLoad && !hasCalledOnLoad.current) {
        hasCalledOnLoad.current = true;
        // console.log('TickerDisplay3 loaded');
        onLoad();
      }

      // Dispose the mesh this run created. Also covers unmount, so the ring
      // never outlives the component (it used to be scene.add()ed and left
      // behind, which is how it ended up alone on screen during a temple
      // reload). R3F detaches the primitive itself; this frees the GPU side.
      return () => {
        mesh.geometry?.dispose();
        mesh.material?.map?.dispose();
        mesh.material?.dispose();
        if (meshRef.current === mesh) meshRef.current = null;
        setMeshObject((current) => (current === mesh ? null : current));
      };
    } catch (error) {
      console.error("Failed to initialize ticker display:", error);
    }
  }, [isReady, mainScene, tickerPosition, tickerRotation, tickerScale, onLoad]);

  // Animation loop
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // The ring belongs to the temple but lives in the root scene, so nothing
    // about React's tree keeps the two in step. Derive visibility from the
    // temple ITSELF every frame: it can't get stuck on (ring alone in an empty
    // room while the GLB reloads) or stuck off (a missed "it's back" signal).
    const showing = visible && isTempleShowing(templeRef, probeRef, sceneRef.current);
    mesh.visible = showing;

    // Nothing to paint while hidden — skip the canvas redraw + texture upload.
    if (isInitialized && showing) {
      updateCanvas();

      // Check if modelRef exists and update ticker geometry based on model scale
      if (modelRef && modelRef.current && modelRef.current.scale) {
        const modelScale = modelRef.current.scale.x;
        updateTickerGeometry(modelScale);
      }
    }
  });

  // Early return if we're not in a valid Three.js context
  if (!threeContext || !mainScene || typeof mainScene.traverse !== 'function') {
    return null;
  }


  // Define a smaller set of key market indicators
  const fmpIndices = [
    { name: "S&P 500", symbol: "^GSPC", fmpSymbol: "%5EGSPC" },
    { name: "Nasdaq", symbol: "^IXIC", fmpSymbol: "%5EIXIC" },
  ];

  // Reduced market data - only essentials
  const marketSymbolsGroup1 = [
    { name: "VIX", symbol: "^VIX" },
  ];
  
  const marketSymbolsGroup2 = [
    { name: "Gold", symbol: "GC=F" },
  ];

  // Use mock data as fallback when FMP API is unavailable
  const mockMarketData = () => {
    // Create reliable mock data with small fluctuations
    const now = Date.now();
    
    // Include all indices including Oil as fallback
    const allIndices = [
      { name: "S&P 500", symbol: "^GSPC" },
      { name: "Nasdaq", symbol: "^IXIC" },
      { name: "VIX", symbol: "^VIX" },
      { name: "Gold", symbol: "GC=F" },
      { name: "Oil", symbol: "CL=F" }
    ];
    
    // Create the initial data
    const mockIndices = allIndices.map(({ name, symbol }) => {
      // Base price with slight randomization based on time
      const basePrice = getMockPrice(symbol);
      // Small change that varies slightly over time 
      const timeVariation = Math.sin(now / 10000000) * 2; // Slow variation over time
      const randomVariation = (Math.random() - 0.5) * 0.5; // Small random component
      const changePercent = timeVariation + randomVariation;
      
      return {
        name,
        symbol,
        price: basePrice * (1 + changePercent/100), // Adjust price by change percentage
        changePercent: changePercent,
      };
    });
    
    // Update market data, preserving crypto data
    setMarketData(prevData => {
      // Keep crypto data (Bitcoin and Ethereum) from CoinGecko
      const cryptoData = prevData.filter(
        item => item.name === "Bitcoin" || item.name === "Ethereum"
      );
      
      return [...cryptoData, ...mockIndices];
    });
  };

  // Generate plausible mock prices for development/fallback
  const getMockPrice = (symbol) => {
    // Return realistic mock prices for different symbols
    switch(symbol) {
      case "^IXIC": return 16423.5;  // Nasdaq
      case "^DJI": return 38521.4;   // Dow Jones
      case "^GSPC": return 5231.3;   // S&P 500
      case "^VIX": return 14.2;      // VIX
      case "DX-Y.NYB": return 105.8; // Dollar Index
      case "GC=F": return 2328.7;    // Gold
      case "CL=F": return 72.5;      // Oil (WTI Crude)
      case "^TNX": return 4.427;     // 10Y Treasury
      default: return 100.0;
    }
  };
  
  
  // Fetch RL80 price (sourced from CoinMarketCap via the rl80-price route)
  const fetchRL80Data = async () => {
    try {
      const response = await fetch('/api/rl80-price');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      if (data?.price == null) return;
      setMarketData(prevData => {
        const filtered = prevData.filter(item => item.name !== "RL80");
        return [...filtered, {
          name: "RL80",
          symbol: "RL80",
          price: data.price,
          changePercent: data.priceChange24h ?? 0,
        }];
      });
    } catch (error) {
      console.error("Error fetching RL80 data:", error);
    }
  };

  // Fetch crypto data from our server-side API (with caching)
  const fetchCryptoData = async () => {
    try {
      const response = await fetch('/api/crypto-data');
      
      // Check if response is OK and is JSON
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Response is not JSON");
      }
      
      const cryptoMarketData = await response.json();

      // Validate the data is an array
      if (Array.isArray(cryptoMarketData)) {
        setMarketData(prevData => {
          // Remove any existing crypto entries
          const filteredData = prevData.filter(
            item => item.name !== "Bitcoin" && item.name !== "Ethereum" && 
                    item.name !== "Solana"
          );
          return [...filteredData, ...cryptoMarketData];
        });
      }
    } catch (error) {
      console.error("Error fetching crypto data:", error);
      // Use fallback data on error
      const fallbackCrypto = [
        { name: "Bitcoin", symbol: "BTC", price: 60000, changePercent: 2.5 },
        { name: "Ethereum", symbol: "ETH", price: 3000, changePercent: 3.1 },
        { name: "Solana", symbol: "SOL", price: 100, changePercent: 5.2 }
      ];
      setMarketData(prevData => {
        const filteredData = prevData.filter(
          item => item.name !== "Bitcoin" && item.name !== "Ethereum" && 
                  item.name !== "Solana"
        );
        return [...filteredData, ...fallbackCrypto];
      });
    }
  };






  const combinedData = [
    ...marketData,
    ...(fearGreed
      ? [
          {
            name: fearGreed.name,
            price: fearGreed.value,
            classification: fearGreed.classification,
            isSentiment: true,
          },
        ]
      : []),
  ];

  // Function to update ticker geometry based on model scale
  const updateTickerGeometry = (modelScale) => {
    if (!meshRef.current || !modelScale) return;

    // Only update if the scale has changed significantly
    if (Math.abs(lastModelScale.current - modelScale) < 0.01) return;

    // Calculate new radius based on model scale
    const newRadius = 2.08 * modelScale;

    // Create new geometry with updated radius, keeping the original height ratio
    const newGeometry = new THREE.CylinderGeometry(
      newRadius,
      newRadius,
      0.39 * modelScale, // Scale height proportionally
      128,
      1,
      true
    );

    // Replace the old geometry
    meshRef.current.geometry.dispose(); // Clean up old geometry
    meshRef.current.geometry = newGeometry;

    // Update the last known scale
    lastModelScale.current = modelScale;
  };

  // Update canvas content
  const updateCanvas = () => {
    if (!canvasRef.current || !isInitialized) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set up font first to get measurements
    ctx.font = "bold 16px Arial";

    // Clear canvas with black background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update scroll position for continuous scrolling (slower speed)
    scrollPos.current = (scrollPos.current + 0.4) % canvas.width; // Reduced speed from 2 to 0.5

    // Draw text
    ctx.textBaseline = "middle";

    // Single source of truth for layout: pass draw=false to measure without painting.
    const drawData = (startX, draw = true) => {
      let xPos = startX;
      const basepadding = 80;
      const yPos = canvas.height / 2;

      if (draw) {
        ctx.fillStyle = "#222222";
        ctx.fillRect(0, canvas.height - 3, canvas.width, 1);
      }

      let needSeparator = true;
      let previousItemName = "";

      combinedData.forEach((item, index) => {
        let separatorPadding = basepadding;
        if (previousItemName === "Fear & Greed") {
          separatorPadding = basepadding * 0.5;
        }

        if (needSeparator || item.name === "10Y Treasury Yield") {
          ctx.font = "bold 16px Arial";

          if (item.name === "10Y Treasury Yield") {
            xPos += 60;
          } else if (item.isSentiment) {
            xPos += 20;
          }

          if (draw) {
            ctx.fillStyle = is80sMode ? "#67e8f9" : "#666666";
            if (item.name === "10Y Treasury Yield") {
              ctx.fillText(" ◆ ", xPos, yPos - 2);
            } else {
              ctx.fillText(" ◆ ", xPos, yPos);
            }
          }

          xPos += ctx.measureText(" ◆ ").width + separatorPadding;
        }

        needSeparator = true;
        previousItemName = item.name;

        let changeColor = "#FFFFFF";
        let nameColor = is80sMode ? "#67e8f9" : "#DDDDDD";
        let priceColor = is80sMode ? "#00ff41" : "#FFFFFF";
        let changePercent = 0;

        if (item.name === "10Y Treasury Yield") {
          ctx.font = "bold 16px Arial";
          xPos += ctx.measureText(" ◆ ").width + 110;
          xPos += 25;
        } else if (item.isSentiment) {
          xPos += 55;
        }

        if (item.isSentiment) {
          const value = item.price;
          let sentimentColor = "#FFFFFF";

          if (value <= 25) sentimentColor = "#FF3B30";
          else if (value <= 40) sentimentColor = "#FF9500";
          else if (value <= 60) sentimentColor = "#FFCC00";
          else if (value <= 75) sentimentColor = "#34C759";
          else sentimentColor = "#00C7BE";

          ctx.font = "bold 16px Arial";
          if (draw) {
            ctx.fillStyle = is80sMode ? "#67e8f9" : "#E5E5EA";
            ctx.fillText("Fear & Greed:", xPos, yPos);
          }
          xPos += ctx.measureText("Fear & Greed:").width + 15;

          ctx.font = "bold 16px Arial";
          if (draw) {
            ctx.fillStyle = is80sMode ? "#00ff41" : "#FFFFFF";
            ctx.fillText(value, xPos, yPos);
          }
          xPos += ctx.measureText(String(value)).width + 70;

          ctx.font = "bold 14px Arial";
          if (draw) {
            ctx.fillStyle = sentimentColor;
            ctx.fillText(`(${item.classification})`, xPos, yPos);
          }
          xPos += ctx.measureText(`(${item.classification})`).width + basepadding * 3.6;
        } else if (item.symbol) {
          const price = item.price ?
            (item.symbol === "^VIX" || item.symbol === "^TNX" ?
              `${item.price.toFixed(2)}` :
              item.name === "RL80" ?
                formatSubCentPrice(item.price) :
                `$${item.price.toFixed(2)}`) :
            "N/A";

          changePercent = item.changePercent ? parseFloat(item.changePercent) : 0;
          changeColor = changePercent >= 0 ? "#4CD964" : "#FF3B30";

          const colorMap = is80sMode ? {
            "Gold": "#67e8f9", "Oil": "#67e8f9", "Nasdaq": "#67e8f9",
            "Dow Jones": "#67e8f9", "S&P 500": "#67e8f9", "VIX": "#67e8f9",
            "Bitcoin": "#67e8f9", "Ethereum": "#67e8f9",
            "Dollar Index": "#67e8f9", "10Y Treasury Yield": "#67e8f9",
            "RL80": "#ff5dd6"
          } : {
            "Gold": "#FFD700", "Oil": "#FF9500", "Nasdaq": "#5856D6",
            "Dow Jones": "#007AFF", "S&P 500": "#5AC8FA", "VIX": "#FF2D55",
            "Bitcoin": "#FF9500", "Ethereum": "#5856D6",
            "Dollar Index": "#64D2FF", "10Y Treasury Yield": "#FFCC00",
            "RL80": "#ff5dd6"
          };
          nameColor = colorMap[item.name] || (is80sMode ? "#67e8f9" : "#DDDDDD");

          const spacingMap = {
            "Gold": 32, "Oil": 32, "VIX": 32, "Dollar Index": 28,
            "10Y Treasury Yield": 15, "Nasdaq": 25, "Dow Jones": 25,
            "S&P 500": 25, "Bitcoin": 32, "Ethereum": 30, "RL80": 28
          };
          const nameSpacing = spacingMap[item.name] || 22;

          ctx.font = "bold 16px Arial";
          if (item.name === "10Y Treasury Yield") {
            if (draw) {
              ctx.fillStyle = nameColor;
              ctx.fillText(`${item.name}`, xPos, yPos);
            }
            xPos += ctx.measureText(`${item.name}`).width + 20;
          } else {
            if (draw) {
              ctx.fillStyle = nameColor;
              ctx.fillText(`${item.name}:`, xPos, yPos);
            }
            xPos += ctx.measureText(`${item.name}:`).width + nameSpacing;
          }

          const priceSpacingMap = {
            "VIX": 35, "10Y Treasury Yield": 15, "Dollar Index": 30,
            "Oil": 28, "Bitcoin": 25, "Ethereum": 25
          };
          const priceSpacing = priceSpacingMap[item.name] || 25;

          ctx.font = "bold 16px Arial";
          if (item.name === "10Y Treasury Yield") {
            if (draw) {
              ctx.fillStyle = priceColor;
              ctx.fillText(`: ${price}`, xPos, yPos);
            }
            xPos += ctx.measureText(`: ${price}`).width + 25;
          } else {
            if (draw) {
              ctx.fillStyle = priceColor;
              ctx.fillText(`${price}`, xPos, yPos);
            }
            xPos += ctx.measureText(`${price}`).width + priceSpacing;
          }

          const arrow = changePercent >= 0 ? "▲ " : "▼ ";
          const changeText = `${arrow}${Math.abs(changePercent).toFixed(2)}%`;
          ctx.font = "bold 14px Arial";
          if (draw) {
            ctx.fillStyle = changeColor;
            ctx.fillText(changeText, xPos, yPos);
          }

          const percentSpacingMap = {
            "VIX": 0.9, "10Y Treasury Yield": 0.7, "Dollar Index": 0.8,
            "Oil": 0.85, "Gold": 1.0
          };
          const percentSpacing = basepadding * (percentSpacingMap[item.name] || 0.7);

          xPos += ctx.measureText(changeText).width + percentSpacing;
        }
      });

      return xPos;
    };

    // Measure with the same logic that draws, so wrap-around copies don't overlap.
    const dataWidth = drawData(0, false);
    if (dataWidth <= 0) return;

    const startX = -(scrollPos.current % dataWidth);

    for (let i = -1; i <= Math.ceil(canvas.width / dataWidth) + 1; i++) {
      drawData(startX + (i * dataWidth));
    }

    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
    }
  };

  // Fetch real market data from our API route (bypasses CORS)
  const fetchYahooFinanceData = async () => {
    try {
      const response = await fetch('/api/market-data');
      
      // Check if response is OK and is JSON
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Response is not JSON");
      }
      
      const marketData = await response.json();
      
      // Validate the data is an array
      if (Array.isArray(marketData)) {
        // Update market data, preserving crypto data from CoinGecko
        setMarketData(prevData => {
          const cryptoData = prevData.filter(
            item => item.name === 'Bitcoin' || item.name === 'Ethereum' ||
                    item.name === 'Solana' || item.name === 'RL80'
          );
          return [...cryptoData, ...marketData];
        });
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
      // Use fallback data on error
      const fallbackMarket = [
        { name: "S&P 500", symbol: "^GSPC", price: 5231.3, changePercent: 0.5 },
        { name: "Nasdaq", symbol: "^IXIC", price: 16423.5, changePercent: 0.7 },
        { name: "VIX", symbol: "^VIX", price: 14.2, changePercent: -2.4 },
        { name: "Gold", symbol: "GC=F", price: 2328.7, changePercent: -0.3 }
      ];
      setMarketData(prevData => {
        const cryptoData = prevData.filter(
          item => item.name === 'Bitcoin' || item.name === 'Ethereum' || 
                  item.name === 'Solana'
        );
        return [...cryptoData, ...fallbackMarket];
      });
    }
  };

  // Hand the mesh to R3F. Attaching it here rather than with scene.add() ties
  // it to this component's lifetime and to the Suspense boundary it renders
  // in, so it can never be the only thing left on screen. `visible` is applied
  // as a prop (not just imperatively) so R3F restores the right value after it
  // un-hides a suspended subtree.
  return meshObject ? (
    <primitive object={meshObject} visible={visible} />
  ) : null;
};

export default TickerDisplay3;