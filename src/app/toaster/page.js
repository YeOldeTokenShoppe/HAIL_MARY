"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamic import to avoid SSR issues with Three.js
const VendingScene = dynamic(() => import('@/components/VendingMachine'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontFamily: 'monospace'
    }}>
      Loading...
    </div>
  )
});

export default function ToasterPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div style={{
      backgroundColor: "#0a0a0a",
      height: "100vh",
      width: "100vw",
      margin: 0,
      padding: 0,
      position: "fixed",
      left: 0,
      top: 0,
      overflow: "hidden",
    }}>
      {/* Back link */}
      <Link
        href="/"
        style={{
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          color: '#fff',
          textDecoration: 'none',
          fontFamily: 'monospace',
          fontSize: '1rem',
          zIndex: 1000,
          padding: '0.5rem 1rem',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '4px',
          border: '1px solid rgba(255,255,255,0.2)',
        }}
      >
        &larr; Back
      </Link>

      {/* Toaster Scene */}
      {mounted && (
        <div style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
        }}>
          <VendingScene />
        </div>
      )}
    </div>
  );
}
