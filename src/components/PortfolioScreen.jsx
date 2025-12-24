import { useEffect, useRef } from 'react';

const PortfolioScreen = () => {
  const animationFrameRef = useRef();
  const portfolioRef = useRef({
    totalValue: 250000,
    positions: [
      { symbol: 'BTC', amount: 2.5, value: 240000, allocation: 48 },
      { symbol: 'ETH', amount: 35, value: 87500, allocation: 17.5 },
      { symbol: 'SOL', amount: 500, value: 50000, allocation: 10 },
      { symbol: 'AVAX', amount: 1200, value: 42000, allocation: 8.4 },
      { symbol: 'MATIC', amount: 25000, value: 30000, allocation: 6 },
      { symbol: 'USD', amount: 50500, value: 50500, allocation: 10.1 }
    ]
  });

  // Drawing loop
  useEffect(() => {
    const draw = () => {
      // @ts-ignore
      const canvas = window['__screen4RCanvas'];
      // @ts-ignore
      const texture = window['__screen4RTexture'];

      if (!canvas || !texture) {
        animationFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      const ctx = canvas.getContext('2d');
      const t = performance.now() / 1000;

      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 256, 512);

      // Header - more padding
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('◉ PORTFOLIO ◉', 100, 30);

      // Divider - narrower
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, 40);
      ctx.lineTo(226, 40);
      ctx.stroke();

      // Total value with animation
      const animatedValue = portfolioRef.current.totalValue + Math.sin(t * 2) * 1000;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(`$${animatedValue.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`, 30, 65);
      
      // P&L indicator
      const dailyPnL = Math.sin(t * 0.5) * 5000;
      const dailyPercent = (dailyPnL / portfolioRef.current.totalValue) * 100;
      ctx.fillStyle = dailyPnL >= 0 ? '#00ff00' : '#ff0000';
      ctx.font = '9px monospace';
      ctx.fillText(`${dailyPnL >= 0 ? '+' : ''}${dailyPnL.toFixed(0)} (${dailyPercent >= 0 ? '+' : ''}${dailyPercent.toFixed(2)}%)`, 30, 85);

      // Pie chart for allocation - moved left
      const pieX = 165;
      const pieY = 120;
      const pieRadius = 30;
      
      let currentAngle = -Math.PI / 2;
      const colors = ['#00ff00', '#00ffff', '#ffff00', '#ff00ff', '#ffaa00', '#ffffff'];
      
      portfolioRef.current.positions.forEach((pos, i) => {
        const angle = (pos.allocation / 100) * Math.PI * 2;
        
        // Draw pie slice
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.moveTo(pieX, pieY);
        ctx.arc(pieX, pieY, pieRadius, currentAngle, currentAngle + angle);
        ctx.closePath();
        ctx.fill();
        
        // Outline
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        currentAngle += angle;
      });

      // Portfolio positions list - more padding
      ctx.font = '8px monospace';
      ctx.fillStyle = '#666666';
      ctx.fillText('ASSET', 30, 115);
      ctx.fillText('VALUE', 75, 115);
      ctx.fillText('ALLOC', 115, 115);

      portfolioRef.current.positions.forEach((pos, i) => {
        const y = 135 + i * 20;
        
        // Color dot
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.arc(25, y - 3, 3, 0, 2 * Math.PI);
        ctx.fill();
        
        // Symbol
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px monospace';
        ctx.fillText(pos.symbol, 35, y);
        
        // Value
        ctx.fillStyle = '#999999';
        ctx.fillText(`$${(pos.value/1000).toFixed(1)}K`, 75, y);
        
        // Allocation
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillText(`${pos.allocation}%`, 115, y);
        
        // Mini bar - narrower
        ctx.fillStyle = colors[i % colors.length];
        ctx.globalAlpha = 0.3;
        ctx.fillRect(150, y - 8, pos.allocation * 0.5, 8);
        ctx.globalAlpha = 1;
      });

      // Performance metrics - more padding
      const metricsY = 280;
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.fillText('PERFORMANCE', 30, metricsY);
      
      const metrics = [
        { label: '24H', value: 2.3, color: '#00ff00' },
        { label: '7D', value: 5.8, color: '#00ff00' },
        { label: '30D', value: -3.2, color: '#ff0000' },
        { label: 'YTD', value: 45.6, color: '#00ff00' }
      ];
      
      metrics.forEach((metric, i) => {
        const x = 30 + (i % 2) * 90;
        const y = metricsY + 20 + Math.floor(i / 2) * 20;
        
        ctx.fillStyle = '#666666';
        ctx.font = '8px monospace';
        ctx.fillText(metric.label + ':', x, y);
        
        ctx.fillStyle = metric.color;
        ctx.font = '9px monospace';
        ctx.fillText(`${metric.value >= 0 ? '+' : ''}${metric.value}%`, x + 30, y);
      });

      // Rebalance indicator
      const rebalanceNeeded = Math.sin(t * 0.2) > 0.5;
      if (rebalanceNeeded) {
        const pulseAlpha = (Math.sin(t * 4) + 1) / 2;
        ctx.fillStyle = `rgba(255, 170, 0, ${pulseAlpha})`;
        ctx.font = '9px monospace';
        ctx.fillText('↻ REBALANCE SUGGESTED', 60, 360);
      }

      // Trading activity sparkline - narrower
      const sparkY = 380;
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      for (let i = 0; i < 40; i++) {
        const x = 30 + i * 4;
        const y = sparkY + Math.sin(t * 2 + i * 0.5) * 10 + Math.random() * 5;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      
      ctx.fillStyle = '#666666';
      ctx.font = '8px monospace';
      ctx.fillText('TRADING ACTIVITY', 30, sparkY + 25);

      // Health score
      const healthScore = 85 + Math.sin(t * 0.3) * 5;
      const healthColor = healthScore > 80 ? '#00ff00' : 
                         healthScore > 60 ? '#ffff00' : '#ff0000';
      
      ctx.fillStyle = healthColor;
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`HEALTH: ${healthScore.toFixed(0)}%`, 30, 440);
      
      // Health bar - narrower
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(100, 432, 80, 10);
      ctx.fillStyle = healthColor;
      ctx.fillRect(100, 432, healthScore * 0.8, 10);

      // Footer
      const footerAlpha = (Math.sin(t * 3) + 1) / 2;
      ctx.fillStyle = `rgba(0, 255, 0, ${footerAlpha})`;
      ctx.font = 'bold 9px monospace';
      ctx.fillText('◉ OPTIMIZING', 30, 485);

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

export default PortfolioScreen;