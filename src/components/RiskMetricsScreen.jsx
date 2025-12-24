import { useEffect, useRef } from 'react';

const RiskMetricsScreen = () => {
  const animationFrameRef = useRef();
  const riskDataRef = useRef({
    var: 0,
    sharpe: 0,
    maxDrawdown: 0,
    beta: 0,
    correlation: 0
  });

  // Update risk metrics periodically
  useEffect(() => {
    const updateMetrics = () => {
      riskDataRef.current = {
        var: 2.5 + Math.random() * 2,
        sharpe: 1.2 + Math.random() * 0.8,
        maxDrawdown: 5 + Math.random() * 10,
        beta: 0.8 + Math.random() * 0.4,
        correlation: 0.6 + Math.random() * 0.3
      };
    };
    
    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Drawing loop
  useEffect(() => {
    const draw = () => {
      // @ts-ignore
      const canvas = window['__screen4LCanvas'];
      // @ts-ignore
      const texture = window['__screen4LTexture'];

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
      ctx.fillStyle = '#ff6600';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('⚠ RISK METRICS ⚠', 20, 30);

      // Divider
      ctx.strokeStyle = '#ff6600';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, 40);
      ctx.lineTo(236, 40);
      ctx.stroke();

      const metrics = riskDataRef.current;

      // VaR gauge
      const drawRiskGauge = (value, max, label, x, y, color) => {
        // Background circle
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Value arc
        const angle = (value / max) * 2 * Math.PI;
        ctx.strokeStyle = color;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + angle);
        ctx.stroke();
        
        // Center text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(value.toFixed(1), x - 12, y + 4);
        
        // Label
        ctx.fillStyle = color;
        ctx.font = '8px monospace';
        ctx.fillText(label, x - 15, y + 50);
      };

      // Draw risk gauges
      drawRiskGauge(metrics.var, 10, 'VaR %', 60, 100, '#ff0000');
      drawRiskGauge(metrics.sharpe, 3, 'SHARPE', 140, 100, '#00ff00');
      drawRiskGauge(metrics.maxDrawdown, 20, 'MAX DD', 60, 180, '#ffaa00');
      drawRiskGauge(metrics.beta, 2, 'BETA', 140, 180, '#00ffff');

      // Risk heat map
      const heatMapY = 250;
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.fillText('RISK HEATMAP', 20, heatMapY);
      
      const risks = [
        { name: 'MARKET', level: Math.sin(t * 0.5) * 50 + 50 },
        { name: 'LIQUID', level: Math.cos(t * 0.7) * 40 + 40 },
        { name: 'CREDIT', level: Math.sin(t * 0.3) * 30 + 30 },
        { name: 'OPERATIONAL', level: Math.cos(t * 0.4) * 35 + 35 }
      ];
      
      risks.forEach((risk, i) => {
        const y = heatMapY + 20 + i * 25;
        
        // Risk name
        ctx.fillStyle = '#999999';
        ctx.font = '8px monospace';
        ctx.fillText(risk.name, 20, y);
        
        // Risk bar
        const barX = 90;
        const barWidth = 130;
        
        // Background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(barX, y - 8, barWidth, 10);
        
        // Risk level bar
        const color = risk.level > 66 ? '#ff0000' : 
                     risk.level > 33 ? '#ffaa00' : '#00ff00';
        ctx.fillStyle = color;
        ctx.fillRect(barX, y - 8, (risk.level / 100) * barWidth, 10);
        
        // Value
        ctx.fillStyle = '#ffffff';
        ctx.font = '8px monospace';
        ctx.fillText(`${risk.level.toFixed(0)}%`, barX + barWidth + 5, y);
      });

      // Correlation matrix mini view
      const matrixY = 380;
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.fillText('CORRELATION', 20, matrixY);
      
      // Simple 3x3 correlation matrix
      const assets = ['BTC', 'ETH', 'SOL'];
      const cellSize = 20;
      
      assets.forEach((asset, i) => {
        // Labels
        ctx.fillStyle = '#666666';
        ctx.font = '7px monospace';
        ctx.fillText(asset, 100 + i * cellSize, matrixY + 15);
        ctx.fillText(asset, 85, matrixY + 25 + i * cellSize);
        
        // Matrix cells
        assets.forEach((_, j) => {
          const correlation = i === j ? 1 : 
                            Math.abs(i - j) === 1 ? 0.7 : 0.3;
          const intensity = correlation * 255;
          ctx.fillStyle = `rgba(0, ${intensity}, ${intensity}, 0.8)`;
          ctx.fillRect(100 + j * cellSize, matrixY + 20 + i * cellSize, 
                      cellSize - 2, cellSize - 2);
        });
      });

      // Warning indicator
      const warningLevel = Math.sin(t) * 50 + 50;
      if (warningLevel > 70) {
        const pulseAlpha = (Math.sin(t * 8) + 1) / 2;
        ctx.fillStyle = `rgba(255, 0, 0, ${pulseAlpha})`;
        ctx.font = 'bold 10px monospace';
        ctx.fillText('⚠ HIGH RISK ⚠', 70, 470);
      }

      // Footer
      ctx.fillStyle = `rgba(255, 102, 0, ${(Math.sin(t * 3) + 1) / 2})`;
      ctx.font = 'bold 9px monospace';
      ctx.fillText('⚠ MONITORING', 20, 485);

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

export default RiskMetricsScreen;