import { useEffect, useRef } from 'react';

const MarketDepthScreen = () => {
  const animationFrameRef = useRef();
  const depthDataRef = useRef([]);

  // Initialize depth chart data
  useEffect(() => {
    const generateDepthData = () => {
      const data = [];
      const centerPrice = 96000;
      const range = 40;
      
      for (let i = 0; i < range; i++) {
        // Bids (left side)
        const bidPrice = centerPrice - (i * 10);
        const bidVolume = Math.exp(-i / 10) * 50 + Math.random() * 10;
        
        // Asks (right side)
        const askPrice = centerPrice + (i * 10);
        const askVolume = Math.exp(-i / 10) * 50 + Math.random() * 10;
        
        data.push({
          bidPrice,
          bidVolume,
          bidCumulative: 0,
          askPrice,
          askVolume,
          askCumulative: 0
        });
      }
      
      // Calculate cumulative volumes
      let bidSum = 0;
      let askSum = 0;
      data.forEach(d => {
        bidSum += d.bidVolume;
        askSum += d.askVolume;
        d.bidCumulative = bidSum;
        d.askCumulative = askSum;
      });
      
      depthDataRef.current = data;
    };
    
    generateDepthData();
    const interval = setInterval(generateDepthData, 4000);
    
    return () => clearInterval(interval);
  }, []);

  // Drawing loop
  useEffect(() => {
    const draw = () => {
      // @ts-ignore
      const canvas = window['__screen2RCanvas'];
      // @ts-ignore
      const texture = window['__screen2RTexture'];

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
      ctx.fillStyle = '#ff00ff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('◆ MARKET DEPTH ◆', 20, 30);

      // Divider
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, 40);
      ctx.lineTo(236, 40);
      ctx.stroke();

      // Draw depth chart
      const chartX = 20;
      const chartY = 60;
      const chartWidth = 216;
      const chartHeight = 200;
      const centerX = chartX + chartWidth / 2;

      // Grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < 5; i++) {
        const y = chartY + (i * chartHeight / 4);
        ctx.beginPath();
        ctx.moveTo(chartX, y);
        ctx.lineTo(chartX + chartWidth, y);
        ctx.stroke();
      }

      // Draw bid depth (green)
      ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX, chartY + chartHeight);
      
      depthDataRef.current.slice(0, 20).forEach((d, i) => {
        const x = centerX - (i * 5);
        const y = chartY + chartHeight - (d.bidCumulative / 1000 * chartHeight);
        ctx.lineTo(x, y);
      });
      
      ctx.lineTo(chartX, chartY + chartHeight);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Draw ask depth (red)
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.strokeStyle = '#ff0000';
      ctx.beginPath();
      ctx.moveTo(centerX, chartY + chartHeight);
      
      depthDataRef.current.slice(0, 20).forEach((d, i) => {
        const x = centerX + (i * 5);
        const y = chartY + chartHeight - (d.askCumulative / 1000 * chartHeight);
        ctx.lineTo(x, y);
      });
      
      ctx.lineTo(chartX + chartWidth, chartY + chartHeight);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Center price line
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(centerX, chartY);
      ctx.lineTo(centerX, chartY + chartHeight);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price label
      ctx.fillStyle = '#ffff00';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('$96,000', centerX - 25, chartY + chartHeight + 20);

      // Metrics
      const bidTotal = depthDataRef.current[19]?.bidCumulative || 0;
      const askTotal = depthDataRef.current[19]?.askCumulative || 0;
      const imbalance = ((bidTotal - askTotal) / (bidTotal + askTotal)) * 100;

      ctx.font = '9px monospace';
      ctx.fillStyle = '#00ff00';
      ctx.fillText(`BID VOL: ${bidTotal.toFixed(0)}`, 20, 300);
      ctx.fillStyle = '#ff0000';
      ctx.fillText(`ASK VOL: ${askTotal.toFixed(0)}`, 20, 320);
      
      // Imbalance indicator
      ctx.fillStyle = imbalance > 0 ? '#00ff00' : '#ff0000';
      ctx.fillText(`IMBALANCE: ${imbalance > 0 ? '+' : ''}${imbalance.toFixed(1)}%`, 20, 340);
      
      // Visual imbalance bar
      const barY = 360;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(20, barY, 200, 20);
      
      const barColor = imbalance > 0 ? '#00ff00' : '#ff0000';
      ctx.fillStyle = barColor;
      const barWidth = Math.abs(imbalance) * 2;
      const barX = imbalance > 0 ? 120 : 120 - barWidth;
      ctx.fillRect(barX, barY, barWidth, 20);

      // Animated scanner line
      const scanY = chartY + ((t * 30) % chartHeight);
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartX, scanY);
      ctx.lineTo(chartX + chartWidth, scanY);
      ctx.stroke();

      // Footer
      const pulseAlpha = (Math.sin(t * 3) + 1) / 2;
      ctx.fillStyle = `rgba(255, 0, 255, ${pulseAlpha})`;
      ctx.font = 'bold 9px monospace';
      ctx.fillText('◆ ANALYZING', 20, 485);

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

export default MarketDepthScreen;