import { useEffect, useRef } from 'react';

const DataCubeScreen = () => {
  const animationFrameRef = useRef();
  const nodesRef = useRef([]);
  const connectionsRef = useRef([]);
  const pulseRef = useRef(0);

  // Initialize neural network nodes
  useEffect(() => {
    const nodes = [];
    const connections = [];
    
    // Create layers of nodes - smaller and more centered
    const layers = [3, 4, 4, 3]; // More symmetrical: Input, hidden1, hidden2, output
    const layerSpacing = 90; // Reduced from 140 for smaller network
    const nodeSpacing = 25; // Reduced from 35 for tighter spacing
    
    // Center the network better on screen
    const networkWidth = layerSpacing;
    const startX = 35; // Shifted right for better centering
    
    layers.forEach((count, layerIndex) => {
      const x = startX + layerIndex * layerSpacing / (layers.length - 1);
      const layerHeight = count * nodeSpacing;
      const startY = 100 + (60 - layerHeight / 2); // Center vertically around y=150
      
      for (let i = 0; i < count; i++) {
        const y = startY + i * nodeSpacing;
        nodes.push({
          x,
          y,
          layer: layerIndex,
          index: i,
          activation: Math.random(),
          pulsePhase: Math.random() * Math.PI * 2
        });
      }
    });
    
    // Create connections between layers
    let nodeIndex = 0;
    for (let layer = 0; layer < layers.length - 1; layer++) {
      const currentLayerSize = layers[layer];
      const nextLayerSize = layers[layer + 1];
      const currentLayerStart = nodeIndex;
      const nextLayerStart = currentLayerStart + currentLayerSize;
      
      for (let i = 0; i < currentLayerSize; i++) {
        for (let j = 0; j < nextLayerSize; j++) {
          connections.push({
            from: currentLayerStart + i,
            to: nextLayerStart + j,
            weight: Math.random() * 2 - 1, // -1 to 1
            flow: Math.random()
          });
        }
      }
      nodeIndex += currentLayerSize;
    }
    
    nodesRef.current = nodes;
    connectionsRef.current = connections;
  }, []);

  // Drawing loop
  useEffect(() => {
    const draw = () => {
      // @ts-ignore
      const canvas = window['__screen1RCanvas'];
      // @ts-ignore
      const texture = window['__screen1RTexture'];

      if (!canvas || !texture) {
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext('2d');
      const t = performance.now() / 1000;

      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 256, 512);

      // Update pulse
      pulseRef.current = t;

      // Header - smaller and more padding
      ctx.fillStyle = '#00ffff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('◇ NEURAL NET ◇', 30, 30); // More padding, moved down

      // Draw divider
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, 40);
      ctx.lineTo(236, 40);
      ctx.stroke();

      // Update node activations
      nodesRef.current.forEach(node => {
        node.activation = (Math.sin(t * 2 + node.pulsePhase) + 1) / 2;
      });

      // Update connection flows with smoother, slower waves
      connectionsRef.current.forEach((conn, idx) => {
        // Create wave patterns that flow through the network
        const waveSpeed = 0.5; // Much slower
        const phaseOffset = idx * 0.2; // Stagger the flows
        conn.flow = (Math.sin(t * waveSpeed + phaseOffset) + 1) / 2;
      });

      // Draw connections with flowing data
      connectionsRef.current.forEach(conn => {
        const fromNode = nodesRef.current[conn.from];
        const toNode = nodesRef.current[conn.to];
        
        // Connection strength based on weight and flow
        const alpha = Math.abs(conn.weight) * 0.3 + conn.flow * 0.2;
        const color = conn.weight > 0 ? 
          `rgba(0, 255, 255, ${alpha})` : 
          `rgba(255, 0, 255, ${alpha})`;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.abs(conn.weight) * 2 + 0.5;
        
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        ctx.stroke();
        
        // Draw flowing particles along connections - slower and bidirectional
        if (conn.flow > 0.5) {
          // Create oscillating movement (back and forth)
          const oscillation = (Math.sin(t * 0.8 + conn.from) + 1) / 2; // Slower with 0.8 multiplier
          
          // Particles move from edges toward center and back
          let particlePos;
          if (fromNode.layer < toNode.layer) {
            // Forward direction (toward output)
            particlePos = oscillation;
          } else {
            // For same layer connections, just oscillate
            particlePos = oscillation;
          }
          
          const particleX = fromNode.x + (toNode.x - fromNode.x) * particlePos;
          const particleY = fromNode.y + (toNode.y - fromNode.y) * particlePos;
          
          // Particle size based on position (smaller at edges, larger in center)
          const particleSize = 1 + Math.sin(particlePos * Math.PI) * 1.5;
          
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = conn.flow * 0.8;
          ctx.beginPath();
          ctx.arc(particleX, particleY, particleSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      });

      // Draw nodes - smaller size
      nodesRef.current.forEach((node, index) => {
        const radius = 2 + node.activation * 1; // Reduced from 8 + activation * 4
        
        // Node glow effect
        const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 2);
        gradient.addColorStop(0, `rgba(0, 255, 255, ${node.activation})`);
        gradient.addColorStop(0.5, `rgba(0, 255, 255, ${node.activation * 0.5})`);
        gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Node core
        const coreColor = node.layer === 0 ? '#00ff00' : // Input layer
                         node.layer === 3 ? '#ff00ff' : // Output layer
                         '#00ffff'; // Hidden layers
        
        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner bright core
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = node.activation;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Layer labels - adjusted for smaller network
      const labelY = 250; // Moved up due to smaller network
      ctx.font = '8px monospace';
      
      // Calculate label positions based on actual node positions (startX = 55, spacing = 90)
      const inputX = 55 - 8; // First layer x position
      const hidden1X = 55 + 90/3 - 8;
      const hidden2X = 55 + 2*90/3 - 8;
      const outputX = 55 + 90 - 7;
      
      ctx.fillStyle = '#00ff00';
      ctx.fillText('INPUT', inputX, labelY);
      ctx.fillStyle = '#00ffff';
      ctx.fillText('HID1', hidden1X, labelY);
      ctx.fillText('HID2', hidden2X, labelY);
      ctx.fillStyle = '#ff00ff';
      ctx.fillText('OUT', outputX, labelY);

      // Neural network metrics - more padding and smaller
      ctx.font = '9px monospace';
      const avgActivation = nodesRef.current.reduce((sum, node) => sum + node.activation, 0) / nodesRef.current.length;
      const avgFlow = connectionsRef.current.reduce((sum, conn) => sum + conn.flow, 0) / connectionsRef.current.length;
      
      const metrics = [
        { label: 'ACTIVE', value: avgActivation * 100, unit: '%', color: '#00ffff' },
        { label: 'SIGNAL', value: avgFlow * 100, unit: '%', color: '#00ff00' },
        { label: 'CONF', value: Math.sin(t * 0.5) * 50 + 50, unit: '%', color: '#ff00ff' }
      ];

      metrics.forEach((metric, i) => {
        const y = 280 + i * 20; // Adjusted for smaller network
        ctx.fillStyle = metric.color;
        ctx.fillText(metric.label, 20, y); // More padding from edge
        
        // Value
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${metric.value.toFixed(1)}${metric.unit}`, 75, y);
        
        // Progress bar - smaller and adjusted position
        ctx.fillStyle = metric.color;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(130, y - 6, metric.value * 0.6, 4); // Smaller bars
        ctx.globalAlpha = 0.8;
        ctx.fillRect(130, y - 6, metric.value * 0.6 * (metric.value / 100), 4);
        ctx.globalAlpha = 1;
      });

      // Training status - adjusted position with more padding
      ctx.fillStyle = '#666666';
      ctx.font = '8px monospace';
      ctx.fillText('Epoch: ' + Math.floor(t / 10), 20, 360);
      ctx.fillText('Loss: ' + (0.1 + Math.sin(t * 0.2) * 0.05).toFixed(3), 100, 360);

      // Footer status with pulse - more padding
      const pulseAlpha = (Math.sin(t * 4) + 1) / 2;
      ctx.fillStyle = `rgba(0, 255, 255, ${pulseAlpha})`;
      ctx.font = 'bold 9px monospace';
      ctx.fillText('◆ LEARNING', 20, 385);
      
      // Activity indicator dots
      for (let i = 0; i < 3; i++) {
        const dotAlpha = (Math.sin(t * 3 - i * 0.5) + 1) / 2;
        ctx.fillStyle = `rgba(255, 255, 255, ${dotAlpha})`;
        ctx.beginPath();
        ctx.arc(100 + i * 6, 383, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Update texture
      texture.needsUpdate = true;

      animationFrameRef.current = requestAnimationFrame(draw);
    };

    animationFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return null;
};

export default DataCubeScreen;