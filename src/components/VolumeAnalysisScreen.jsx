import { useEffect, useRef } from 'react';

const VolumeAnalysisScreen = () => {
  const animationFrameRef = useRef();
  const volumeBarsRef = useRef([]);
  const flowDataRef = useRef({ inflow: 0, outflow: 0 });

  // Initialize volume data
  useEffect(() => {
    const bars = [];
    for (let i = 0; i < 24; i++) {
      bars.push({
        volume: Math.random() * 1000 + 100,
        buyVolume: Math.random() * 600,
        sellVolume: Math.random() * 400
      });
    }
    volumeBarsRef.current = bars;
    
    // Update flow data periodically
    const updateFlow = () => {
      flowDataRef.current = {
        inflow: Math.random() * 5000 + 1000,
        outflow: Math.random() * 4000 + 1000
      };
    };
    
    updateFlow();
    const interval = setInterval(updateFlow, 2000);
    
    return () => clearInterval(interval);
  }, []);

  // Drawing loop
  useEffect(() => {
    const draw = () => {
      // @ts-ignore
      const canvas = window['__screen3RCanvas'];
      // @ts-ignore
      const texture = window['__screen3RTexture'];

      if (!canvas || !texture) {
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext('2d');
      const t = performance.now() / 1000;

      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 256, 512);

      // Header
      ctx.fillStyle = '#ffff00';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('◊ VOLUME FLOW ◊', 20, 30);

      // Divider
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, 40);
      ctx.lineTo(236, 40);
      ctx.stroke();

      // Volume bars chart
      const chartX = 20;
      const chartY = 60;
      const chartWidth = 216;
      const chartHeight = 150;
      
      // Find max volume for scaling
      const maxVolume = Math.max(...volumeBarsRef.current.map(b => b.volume));
      
      // Draw volume bars
      const barWidth = chartWidth / volumeBarsRef.current.length;
      
      volumeBarsRef.current.forEach((bar, i) => {
        const x = chartX + i * barWidth;
        const barHeight = (bar.volume / maxVolume) * chartHeight;
        const buyHeight = (bar.buyVolume / bar.volume) * barHeight;
        const sellHeight = barHeight - buyHeight;
        
        // Sell volume (red)
        ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.fillRect(x, chartY + chartHeight - barHeight, barWidth - 1, sellHeight);
        
        // Buy volume (green)
        ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
        ctx.fillRect(x, chartY + chartHeight - buyHeight, barWidth - 1, buyHeight);
      });

      // Volume trend line
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      const maWindow = 6;
      volumeBarsRef.current.forEach((bar, i) => {
        if (i >= maWindow) {
          let sum = 0;
          for (let j = 0; j < maWindow; j++) {
            sum += volumeBarsRef.current[i - j].volume;
          }
          const ma = sum / maWindow;
          const x = chartX + i * barWidth + barWidth / 2;
          const y = chartY + chartHeight - (ma / maxVolume) * chartHeight;
          
          if (i === maWindow) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      ctx.stroke();

      // Flow meter
      const flowY = 240;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('MONEY FLOW', 20, flowY);
      
      const { inflow, outflow } = flowDataRef.current;
      const netFlow = inflow - outflow;
      const flowRatio = inflow / (inflow + outflow) * 100;
      
      // Inflow bar
      ctx.fillStyle = '#00ff00';
      ctx.font = '9px monospace';
      ctx.fillText(`IN: $${(inflow/1000).toFixed(1)}K`, 20, flowY + 25);
      ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
      ctx.fillRect(100, flowY + 15, (inflow / 10000) * 100, 15);
      
      // Outflow bar
      ctx.fillStyle = '#ff0000';
      ctx.font = '9px monospace';
      ctx.fillText(`OUT: $${(outflow/1000).toFixed(1)}K`, 20, flowY + 45);
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.fillRect(100, flowY + 35, (outflow / 10000) * 100, 15);
      
      // Net flow indicator
      ctx.fillStyle = netFlow > 0 ? '#00ff00' : '#ff0000';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`NET: ${netFlow > 0 ? '+' : ''}$${(netFlow/1000).toFixed(1)}K`, 20, flowY + 70);
      
      // Flow ratio gauge
      const gaugeY = 340;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(128, gaugeY + 30, 40, Math.PI, 2 * Math.PI);
      ctx.stroke();
      
      // Colored gauge fill
      const gaugeAngle = Math.PI + (flowRatio / 100) * Math.PI;
      ctx.strokeStyle = flowRatio > 50 ? '#00ff00' : '#ff0000';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(128, gaugeY + 30, 40, Math.PI, gaugeAngle);
      ctx.stroke();
      
      // Center value
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`${flowRatio.toFixed(0)}%`, 115, gaugeY + 35);
      
      // Labels
      ctx.fillStyle = '#666666';
      ctx.font = '8px monospace';
      ctx.fillText('SELL', 70, gaugeY + 35);
      ctx.fillText('BUY', 175, gaugeY + 35);

      // Animated pulse rings
      const pulseRadius = 15 + (Math.sin(t * 2) * 10);
      ctx.strokeStyle = `rgba(255, 255, 0, ${0.5 - pulseRadius / 50})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(128, gaugeY + 30, pulseRadius, 0, 2 * Math.PI);
      ctx.stroke();

      // Footer
      const footerAlpha = (Math.sin(t * 3) + 1) / 2;
      ctx.fillStyle = `rgba(255, 255, 0, ${footerAlpha})`;
      ctx.font = 'bold 9px monospace';
      ctx.fillText('◊ ANALYZING', 20, 485);

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

export default VolumeAnalysisScreen;