import { useEffect, useRef } from 'react';

const OrderBookScreen = () => {
  const animationFrameRef = useRef();
  const ordersRef = useRef({ bids: [], asks: [] });

  // Initialize order book data
  useEffect(() => {
    const generateOrders = () => {
      const basePrice = 96000;
      const bids = [];
      const asks = [];
      
      // Generate bid orders (buy orders)
      for (let i = 0; i < 8; i++) {
        bids.push({
          price: basePrice - (i * 50),
          amount: Math.random() * 5 + 0.5,
          total: 0
        });
      }
      
      // Generate ask orders (sell orders)
      for (let i = 0; i < 8; i++) {
        asks.push({
          price: basePrice + ((i + 1) * 50),
          amount: Math.random() * 5 + 0.5,
          total: 0
        });
      }
      
      // Calculate running totals
      let bidTotal = 0;
      let askTotal = 0;
      bids.forEach(bid => {
        bidTotal += bid.amount;
        bid.total = bidTotal;
      });
      asks.forEach(ask => {
        askTotal += ask.amount;
        ask.total = askTotal;
      });
      
      ordersRef.current = { bids, asks };
    };
    
    generateOrders();
    
    // Update orders periodically
    const interval = setInterval(() => {
      generateOrders();
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  // Drawing loop
  useEffect(() => {
    const draw = () => {
      // @ts-ignore
      const canvas = window['__screen2LCanvas'];
      // @ts-ignore
      const texture = window['__screen2LTexture'];

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
      ctx.fillStyle = '#ffaa00';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('◈ ORDER BOOK ◈', 20, 30);

      // Divider
      ctx.strokeStyle = '#ffaa00';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, 40);
      ctx.lineTo(236, 40);
      ctx.stroke();

      // Column headers
      ctx.font = '8px monospace';
      ctx.fillStyle = '#666666';
      ctx.fillText('PRICE', 20, 55);
      ctx.fillText('AMOUNT', 90, 55);
      ctx.fillText('TOTAL', 160, 55);

      // Draw asks (sell orders) - top section in red
      ctx.font = '9px monospace';
      const asks = ordersRef.current.asks.slice().reverse();
      asks.forEach((ask, i) => {
        const y = 75 + i * 20;
        
        // Background bar
        ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
        const barWidth = (ask.total / 30) * 200;
        ctx.fillRect(20, y - 12, barWidth, 16);
        
        // Price
        ctx.fillStyle = '#ff4444';
        ctx.fillText(ask.price.toFixed(0), 20, y);
        
        // Amount
        ctx.fillStyle = '#ffffff';
        ctx.fillText(ask.amount.toFixed(3), 90, y);
        
        // Total
        ctx.fillStyle = '#ff4444';
        ctx.fillText(ask.total.toFixed(2), 160, y);
      });

      // Spread indicator
      const spread = ordersRef.current.asks[0]?.price - ordersRef.current.bids[0]?.price || 0;
      ctx.fillStyle = '#ffaa00';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`SPREAD: $${spread.toFixed(0)}`, 85, 250);

      // Draw bids (buy orders) - bottom section in green
      ctx.font = '9px monospace';
      ordersRef.current.bids.forEach((bid, i) => {
        const y = 275 + i * 20;
        
        // Background bar
        ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
        const barWidth = (bid.total / 30) * 200;
        ctx.fillRect(20, y - 12, barWidth, 16);
        
        // Price
        ctx.fillStyle = '#00ff00';
        ctx.fillText(bid.price.toFixed(0), 20, y);
        
        // Amount
        ctx.fillStyle = '#ffffff';
        ctx.fillText(bid.amount.toFixed(3), 90, y);
        
        // Total
        ctx.fillStyle = '#00ff00';
        ctx.fillText(bid.total.toFixed(2), 160, y);
      });

      // Footer with activity pulse
      const pulseAlpha = (Math.sin(t * 3) + 1) / 2;
      ctx.fillStyle = `rgba(255, 170, 0, ${pulseAlpha})`;
      ctx.font = 'bold 9px monospace';
      ctx.fillText('● LIVE', 20, 485);

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

export default OrderBookScreen;