"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

const EMOJIS = [
  "🚀", "🥸", "🤑", "😭", "😈", "💬", "💬",
  "🔥", "💎", "😇", "❤️‍🔥", "💰", "💵", "🪙"
];

export default function EmojiBurstEffect({
  targetUrl = "/",
  navigateDelay = 1500, // How long before navigating (ms)
  prefetchImmediately = true, // Start loading page in background immediately
  onComplete,
  emojisPerBurst = 5, // Emojis per burst wave
  burstInterval = 200, // Time between burst waves (ms)
  originX = null,
  originY = null,
}) {
  const router = useRouter();
  const containerRef = useRef(null);
  const [particles, setParticles] = useState([]);
  const particleIdRef = useRef(0);
  const hasNavigatedRef = useRef(false);

  // Create a burst of emojis
  const createBurst = useCallback((centerX, centerY) => {
    const newParticles = [];
    for (let i = 0; i < emojisPerBurst; i++) {
      const angle = (Math.PI * 2 * i) / emojisPerBurst + (Math.random() - 0.5) * 0.8;
      const velocity = 400 + Math.random() * 600;
      const spin = (Math.random() - 0.5) * 720;

      newParticles.push({
        id: particleIdRef.current++,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        x: centerX + (Math.random() - 0.5) * 50,
        y: centerY + (Math.random() - 0.5) * 50,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - 300,
        rotation: Math.random() * 360,
        spin,
        scale: 0.8 + Math.random() * 1.2,
        opacity: 1,
        gravity: 600 + Math.random() * 3,
        createdAt: performance.now(),
        lifetime: 2000 + Math.random() * 1000, // Each particle lives 2-3 seconds
      });
    }
    return newParticles;
  }, [emojisPerBurst]);

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = originX ?? width / 2;
    const centerY = originY ?? height / 2;

    // Prefetch the target page immediately so it loads in background
    if (prefetchImmediately && targetUrl) {
      router.prefetch(targetUrl);
    }

    // Initial burst
    setParticles(createBurst(centerX, centerY));

    // Keep creating bursts
    const burstIntervalId = setInterval(() => {
      setParticles(prev => [...prev, ...createBurst(centerX, centerY)]);
    }, burstInterval);

    // Navigate after delay
    const navigateTimeout = setTimeout(() => {
      if (!hasNavigatedRef.current) {
        hasNavigatedRef.current = true;
        if (onComplete) onComplete();
        if (targetUrl) router.push(targetUrl);
      }
    }, navigateDelay);

    // Animation loop
    let animationId;
    const animate = () => {
      const now = performance.now();

      setParticles(prev => {
        return prev
          .map(p => {
            const age = now - p.createdAt;
            const lifeProgress = age / p.lifetime;
            const dt = 0.005;

            return {
              ...p,
              x: p.x + p.vx * dt,
              y: p.y + p.vy * dt,
              vy: p.vy + p.gravity * dt,
              vx: p.vx * 0.99, // slight air resistance
              rotation: p.rotation + p.spin * dt,
              opacity: lifeProgress > 0.7 ? 1 - ((lifeProgress - 0.7) / 0.3) : 1,
              scale: p.scale * (lifeProgress > 0.8 ? 1 - ((lifeProgress - 0.8) / 0.2) * 0.5 : 1),
            };
          })
          .filter(p => {
            const age = now - p.createdAt;
            return age < p.lifetime; // Remove dead particles
          });
      });

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      clearInterval(burstIntervalId);
      clearTimeout(navigateTimeout);
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [createBurst, burstInterval, navigateDelay, prefetchImmediately, onComplete, targetUrl, router, originX, originY]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 99999,
        overflow: "hidden",
      }}
    >
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            transform: `translate(-50%, -50%) rotate(${p.rotation}deg) scale(${p.scale})`,
            fontSize: "2.5rem",
            opacity: p.opacity,
            willChange: "transform, opacity",
            textShadow: "0 0 10px rgba(255,255,255,0.5), 0 0 20px rgba(255,200,0,0.3)",
          }}
        >
          {p.emoji}
        </div>
      ))}
    </div>
  );
}
