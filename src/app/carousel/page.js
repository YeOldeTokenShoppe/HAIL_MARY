"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import MobileCarousel from '@/components/MobileCarousel';
import MainMobileNav from '@/components/MainMobileNav';

const SlantedCarousel = dynamic(() => import('@/components/SlantedCarousel').then(mod => ({ default: mod.App })), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      background: '#0a0a0a',
      fontFamily: 'monospace'
    }}>
      Loading...
    </div>
  )
});

export default function CarouselPage() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (isMobile) {
    return (
      <>
        <h1
          className="custom-title"
          style={{
            position: "fixed",
            top: "1rem",
            left: "1rem",
            zIndex: 290,
            color: "#f6f5f1ff",
            fontFamily: "UnifrakturCook, serif",
            textShadow: "0 0 10px rgba(212, 175, 55, 0.8), 0 0 20px rgba(212, 175, 55, 0.6), 0 0 30px rgba(212, 175, 55, 0.8), 6px 6px 16px rgba(0, 0, 0, 1), -2px -2px 8px rgba(255, 192, 203, 0.7)",
            fontSize: "2.5rem",
            fontWeight: 900,
            lineHeight: 0.85,
            transform: "rotate(-8deg) skew(-15deg)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            margin: 0,
          }}
        >
          <span className="title-line" style={{ display: "block" }}>Our Lady</span>
          <span className="title-line" style={{ display: "block" }}>
            <span style={{ fontSize: "1rem" }}>    of    </span>
            Perpetual
          </span>
          <span className="title-line" style={{ display: "block", marginLeft: "2rem" }}>Profit</span>
        </h1>
        <MobileCarousel />
        <MainMobileNav />
      </>
    );
  }

  return (
    <div style={{
      backgroundColor: "#0a0a0a",
      height: "100vh",
      width: "100vw",
      margin: 0,
      padding: 0,
    }}>
      <SlantedCarousel />
    </div>
  );
}
