"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import MobileCarousel from '@/components/MobileCarousel';
import MainMobileNav from '@/components/MainMobileNav';
import BuyModal from '@/components/BuyModal';

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

export default function HomePage() {
  const [isMobile, setIsMobile] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);

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
        <MainMobileNav
          variant="home"
          characters={[
            { name: "𝓞𝖚𝖗 𝕷𝖆𝖉𝖞", image: "/cameo_rl80.webp" },
            { name: "Saint GR80", image: "/cameo_GR80.webp" },
            { name: "H80Z", image: "/cameo_h80z.webp" },
            { name: "Virgil", image: "/cameo_kitty.webp" },
          ]}
          onCharSelect={(i) => { window.location.href = `/main?char=${i}`; }}
          onBuyClick={() => setShowBuyModal(true)}
          businesses={[
            {
              label: "Hail Mary Prospecting Co",
              live: true,
              onProceed: () => { window.location.href = "/oil?mode=test"; },
              icon: (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m14 13-8.381 8.38a1 1 0 0 1-3.001-3L11 9.999" />
                  <path d="M15.973 4.027A13 13 0 0 0 5.902 2.373c-1.398.342-1.092 2.158.277 2.601a19.9 19.9 0 0 1 5.822 3.024" />
                  <path d="M16.001 11.999a19.9 19.9 0 0 1 3.024 5.824c.444 1.369 2.26 1.676 2.603.278A13 13 0 0 0 20 8.069" />
                  <path d="M18.352 3.352a1.205 1.205 0 0 0-1.704 0l-5.296 5.296a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l5.296-5.296a1.205 1.205 0 0 0 0-1.704z" />
                </svg>
              ),
            },
          ]}
        />
        <BuyModal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)} />
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
