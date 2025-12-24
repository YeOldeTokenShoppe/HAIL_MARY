import { useEffect, useRef } from 'react';

const PriceChartScreen = () => {
  const animationFrameRef = useRef();
  const candlesRef = useRef([]);
  
  // Initialize candlestick data
  useEffect(() => {
    const candles = [];
    let currentPrice = 96000;
    
    for (let i = 0; i < 30; i++) {
      const change = (Math.random() - 0.5) * 500;
      const open = currentPrice;
      const close = currentPrice + change;
      const high = Math.max(open, close) + Math.random() * 200;
      const low = Math.min(open, close) - Math.random() * 200;
      
      candles.push({ open, high, low, close });
      currentPrice = close;
    }
    
    candlesRef.current = candles;
  }, []);

  // Drawing loop
  useEffect(() => {
    const draw = () => {
      // @ts-ignore
      const canvas = window['__screen3LCanvas'];
      // @ts-ignore
      const texture = window['__screen3LTexture'];

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
      ctx.fillStyle = '#00ffff';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('▲ PRICE CHART ▲', 20, 30);

      // Divider
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, 40);
      ctx.lineTo(236, 40);
      ctx.stroke();

      // Chart area
      const chartX = 20;
      const chartY = 60;
      const chartWidth = 216;
      const chartHeight = 250;
      
      // Find min/max for scaling
      let minPrice = Infinity;
      let maxPrice = -Infinity;
      candlesRef.current.forEach(c => {
        minPrice = Math.min(minPrice, c.low);
        maxPrice = Math.max(maxPrice, c.high);
      });
      const priceRange = maxPrice - minPrice;

      // Grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 5; i++) {
        const y = chartY + (i * chartHeight / 5);
        ctx.beginPath();
        ctx.moveTo(chartX, y);
        ctx.lineTo(chartX + chartWidth, y);
        ctx.stroke();
        
        // Price labels
        const price = maxPrice - (i * priceRange / 5);
        ctx.fillStyle = '#666666';
        ctx.font = '8px monospace';
        ctx.fillText(price.toFixed(0), chartX + chartWidth + 5, y + 3);
      }

      // Draw candlesticks
      const candleWidth = chartWidth / candlesRef.current.length;
      
      candlesRef.current.forEach((candle, i) => {
        const x = chartX + i * candleWidth + candleWidth / 2;
        const isGreen = candle.close >= candle.open;
        
        // Wick
        ctx.strokeStyle = isGreen ? '#00ff00' : '#ff0000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const highY = chartY + ((maxPrice - candle.high) / priceRange) * chartHeight;
        const lowY = chartY + ((maxPrice - candle.low) / priceRange) * chartHeight;
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();
        
        // Body
        const openY = chartY + ((maxPrice - candle.open) / priceRange) * chartHeight;
        const closeY = chartY + ((maxPrice - candle.close) / priceRange) * chartHeight;
        const bodyHeight = Math.abs(closeY - openY);
        const bodyY = Math.min(openY, closeY);
        
        ctx.fillStyle = isGreen ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 0, 0, 0.8)';
        ctx.fillRect(x - candleWidth * 0.3, bodyY, candleWidth * 0.6, bodyHeight || 1);
      });

      // Moving average line
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      const maWindow = 7;
      candlesRef.current.forEach((candle, i) => {
        if (i >= maWindow) {
          let sum = 0;
          for (let j = 0; j < maWindow; j++) {
            sum += candlesRef.current[i - j].close;
          }
          const ma = sum / maWindow;
          const x = chartX + i * candleWidth + candleWidth / 2;
          const y = chartY + ((maxPrice - ma) / priceRange) * chartHeight;
          
          if (i === maWindow) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
      });
      ctx.stroke();

      // Current price indicator
      const currentPrice = candlesRef.current[candlesRef.current.length - 1]?.close || 96000;
      const currentY = chartY + ((maxPrice - currentPrice) / priceRange) * chartHeight;
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(chartX, currentY);
      ctx.lineTo(chartX + chartWidth, currentY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price info
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`$${currentPrice.toFixed(0)}`, 20, 330);
      
      const change = currentPrice - (candlesRef.current[0]?.open || 96000);
      const changePercent = (change / (candlesRef.current[0]?.open || 96000)) * 100;
      ctx.fillStyle = change >= 0 ? '#00ff00' : '#ff0000';
      ctx.font = '10px monospace';
      ctx.fillText(`${change >= 0 ? '+' : ''}${change.toFixed(0)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`, 20, 350);

      // Time frame
      ctx.fillStyle = '#666666';
      ctx.font = '8px monospace';
      ctx.fillText('15M', 200, 330);

      // RSI indicator
      const rsi = 50 + Math.sin(t * 0.5) * 30;
      ctx.fillStyle = rsi > 70 ? '#ff0000' : rsi < 30 ? '#00ff00' : '#ffff00';
      ctx.font = '9px monospace';
      ctx.fillText(`RSI: ${rsi.toFixed(1)}`, 20, 380);

      // Footer
      const pulseAlpha = (Math.sin(t * 3) + 1) / 2;
      ctx.fillStyle = `rgba(0, 255, 255, ${pulseAlpha})`;
      ctx.font = 'bold 9px monospace';
      ctx.fillText('● TRACKING', 20, 485);

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

export default PriceChartScreen;