import React, { useEffect, useRef } from 'react';

export default function ScrollTransition({ isTransitioning, onComplete, scrollBounds }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const animationRef = useRef(null);
  
  useEffect(() => {
    if (!isTransitioning || !canvasRef.current || !scrollBounds) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = scrollBounds.width;
    canvas.height = scrollBounds.height;
    
    // Create magical particles effect
    createMagicalParticles(ctx, canvas);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isTransitioning]);
  
  const createMagicalParticles = (ctx, canvas) => {
    // Initialize particles
    particlesRef.current = [];
    const particleCount = 150;
    
    for (let i = 0; i < particleCount; i++) {
      particlesRef.current.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2 - 1,
        size: Math.random() * 3 + 1,
        life: 1.0,
        decay: Math.random() * 0.02 + 0.005,
        color: Math.random() > 0.5 ? '#d4af37' : '#8e662b', // Gold and brown
        glow: Math.random() > 0.7
      });
    }
    
    let startTime = Date.now();
    const duration = 1500; // 1.5 seconds
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Create mystical background glow
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, canvas.width / 2
      );
      gradient.addColorStop(0, `rgba(212, 175, 55, ${0.1 * (1 - progress)})`);
      gradient.addColorStop(1, 'rgba(142, 102, 43, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw particles
      particlesRef.current.forEach(particle => {
        if (particle.life > 0) {
          // Update position
          particle.x += particle.vx;
          particle.y += particle.vy;
          particle.life -= particle.decay;
          
          // Draw particle
          ctx.save();
          ctx.globalAlpha = particle.life;
          
          if (particle.glow) {
            // Add glow effect
            ctx.shadowBlur = 10;
            ctx.shadowColor = particle.color;
          }
          
          ctx.fillStyle = particle.color;
          ctx.beginPath();
          const radius = Math.max(0.1, particle.size * particle.life); // Ensure radius is never negative
          ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
          ctx.fill();
          
          // Add sparkle effect
          if (Math.random() > 0.98) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particle.x - 5, particle.y);
            ctx.lineTo(particle.x + 5, particle.y);
            ctx.moveTo(particle.x, particle.y - 5);
            ctx.lineTo(particle.x, particle.y + 5);
            ctx.stroke();
          }
          
          ctx.restore();
        }
      });
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (onComplete) onComplete();
      }
    };
    
    animate();
  };
  
  if (!isTransitioning) return null;
  
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: scrollBounds?.top || 0,
        left: scrollBounds?.left || 0,
        width: scrollBounds?.width || '100%',
        height: scrollBounds?.height || '100%',
        pointerEvents: 'none',
        zIndex: 9999,
        mixBlendMode: 'screen'
      }}
    />
  );
}