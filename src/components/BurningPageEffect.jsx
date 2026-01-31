"use client";

import React, { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function BurningPageEffect({
  targetUrl = "/",
  duration = 5000,
  onComplete,
}) {
  const router = useRouter();
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setTimeout(() => {
        if (targetUrl) router.push(targetUrl);
      }, 100);
      return;
    }

    // Set canvas size
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Simple noise generation (inline, no pre-computation needed)
    const random = (x, y) => {
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      return n - Math.floor(n);
    };

    const noise = (x, y) => {
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      const fx = x - ix;
      const fy = y - iy;
      const ux = fx * fx * (3 - 2 * fx);
      const uy = fy * fy * (3 - 2 * fy);
      const a = random(ix, iy);
      const b = random(ix + 1, iy);
      const c = random(ix, iy + 1);
      const d = random(ix + 1, iy + 1);
      return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
    };

    const fbm = (x, y) => {
      let value = 0;
      let amp = 0.5;
      for (let i = 0; i < 4; i++) {
        value += amp * noise(x, y);
        x *= 2;
        y *= 2;
        amp *= 0.5;
      }
      return value;
    };

    // Easing that starts faster (ease-out style)
    const easeOut = (t) => 1 - Math.pow(1 - t, 2);

    // Pre-create fire particles
    const particles = [];
    const numParticles = 150;
    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 30 + 10,
        speedY: Math.random() * 2 + 1,
        life: Math.random(),
        hue: Math.random() * 30, // 0-30 for orange/yellow
      });
    }

    startTimeRef.current = performance.now();

    const render = () => {
      const currentTime = performance.now();
      const elapsed = (currentTime - startTimeRef.current) / duration;
      // Start at 0.08 so fire is immediately visible at edges
      const progress = Math.min(0.08 + 0.92 * easeOut(elapsed), 1);

      ctx.clearRect(0, 0, width, height);

      // Draw burn mask using radial gradients from edges
      ctx.save();

      // Create composite burn shape
      const burnRadius = Math.max(width, height) * (1 - progress) * 0.8;
      const centerX = width / 2;
      const centerY = height / 2;

      // Draw black background where burned
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);

      // Cut out the unburned center with noise-distorted edges
      ctx.globalCompositeOperation = "destination-out";

      // Main unburned area with organic edges
      const segments = 120;
      ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const noiseOffset = fbm(
          Math.cos(angle) * 3 + currentTime * 0.0003,
          Math.sin(angle) * 3 + currentTime * 0.0002
        ) * 0.4 + 0.8;
        const r = burnRadius * noiseOffset;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // Draw fire edge
      ctx.save();
      ctx.globalCompositeOperation = "source-over";

      // Draw glowing fire ring at burn edge
      const fireGradient = ctx.createRadialGradient(
        centerX, centerY, burnRadius * 0.9,
        centerX, centerY, burnRadius * 1.15
      );
      fireGradient.addColorStop(0, "rgba(0, 0, 0, 0)");
      fireGradient.addColorStop(0.3, "rgba(255, 100, 0, 0.9)");
      fireGradient.addColorStop(0.5, "rgba(255, 200, 50, 1)");
      fireGradient.addColorStop(0.7, "rgba(255, 100, 0, 0.9)");
      fireGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.beginPath();
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const noiseOffset = fbm(
          Math.cos(angle) * 3 + currentTime * 0.0003,
          Math.sin(angle) * 3 + currentTime * 0.0002
        ) * 0.4 + 0.8;
        const r = burnRadius * noiseOffset * 1.1;
        const x = centerX + Math.cos(angle) * r;
        const y = centerY + Math.sin(angle) * r;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();

      // Inner clip to only show fire at edge
      ctx.clip();

      // Fill with fire gradient
      ctx.fillStyle = fireGradient;
      ctx.fillRect(0, 0, width, height);

      ctx.restore();

      // Animated fire particles along the burn edge
      ctx.save();
      for (const p of particles) {
        // Update particle position along edge
        const particleAngle = (p.life * Math.PI * 2 + currentTime * 0.001 * p.speedY) % (Math.PI * 2);
        const noiseOffset = fbm(
          Math.cos(particleAngle) * 3 + currentTime * 0.0003,
          Math.sin(particleAngle) * 3 + currentTime * 0.0002
        ) * 0.4 + 0.8;
        const r = burnRadius * noiseOffset;
        p.x = centerX + Math.cos(particleAngle) * r;
        p.y = centerY + Math.sin(particleAngle) * r - Math.sin(currentTime * 0.01 + p.life * 10) * 20;

        // Draw fire particle
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        gradient.addColorStop(0, `hsla(${p.hue + 20}, 100%, 70%, 0.8)`);
        gradient.addColorStop(0.4, `hsla(${p.hue + 10}, 100%, 50%, 0.5)`);
        gradient.addColorStop(1, "rgba(255, 50, 0, 0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Add ember particles floating up
      ctx.save();
      const time = currentTime * 0.001;
      for (let i = 0; i < 50; i++) {
        const emberAngle = (i / 50) * Math.PI * 2 + time * 0.2;
        const noiseOffset = fbm(
          Math.cos(emberAngle) * 3,
          Math.sin(emberAngle) * 3
        ) * 0.4 + 0.8;
        const emberR = burnRadius * noiseOffset;
        const emberX = centerX + Math.cos(emberAngle) * emberR + Math.sin(time * 2 + i) * 30;
        const emberY = centerY + Math.sin(emberAngle) * emberR - ((time * 50 + i * 20) % 100);

        const emberSize = 2 + Math.random() * 3;
        ctx.fillStyle = `rgba(255, ${150 + Math.random() * 100}, 0, ${0.5 + Math.random() * 0.5})`;
        ctx.beginPath();
        ctx.arc(emberX, emberY, emberSize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      if (elapsed < 1) {
        animationRef.current = requestAnimationFrame(render);
      } else {
        if (onComplete) onComplete();
        if (targetUrl) router.push(targetUrl);
      }
    };

    render();

    const handleResize = () => {
      // Simplified resize - just restart
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [duration, onComplete, targetUrl, router]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 99999,
      }}
    />
  );
}
