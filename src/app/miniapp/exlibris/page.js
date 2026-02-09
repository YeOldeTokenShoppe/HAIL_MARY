"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import CoinLoader from '@/components/CoinLoader';

const Philosophy = dynamic(() => import('@/components/Philosophy'), {
  ssr: false,
  loading: () => <CoinLoader loading={true} />
});

export default function MiniappExlibrisPage() {
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobileDevice(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100dvh' }}>
      <Philosophy
        modelPath="/models/saint_robot2.glb"
        onLoadingChange={setIsPageLoading}
        is80sMode={false}
        isMiniApp={true}
      />
    </div>
  );
}
