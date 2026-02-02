"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import CyberNav from '@/components/CyberNav';


// Dynamic import to avoid SSR issues with Three.js
const VendingMachineScene = dynamic(() => import('@/components/VendingMachine'), {
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
      height: "100dvh",
      width: "100vw",
      margin: 0,
      padding: 0,
      position: "fixed",
      left: 0,
      top: 0,
      overflow: "hidden",
    }}>
       <div style={{
          position: "fixed",
          top: "20px", 
          left: "20px",
          borderRadius: "8px",
          padding: "10px",
          pointerEvents: "auto",
          zIndex: 10,
        }}>
        <div 
            id="text"
            style={{
              position: "relative",
              fontFamily: "'UnifrakturMaguntia', serif",
              fontSize: "3rem",
              color: "#ffffff",
              cursor: "pointer",
              userSelect: "none",
            }}
            // onClick={(e) => {
            //   e.preventDefault();
            //   e.stopPropagation();
            //   window.location.href = "/about";
            // }}
          >
            RL80
            {Array.from({length: 100}).map((_, i) => {
              const index = i + 1;
              return (
                <div
                  key={index}
                  className="text__copy"
                  style={{
                    position: "absolute",
                    pointerEvents: "none",
                    zIndex: -1,
                    top: 0,
                    left: 0,
                    color: `rgba(${201 - index * 2}, ${55 - index * 3}, ${256 - index * 2})` ,
                    //   : `rgba(${255 - index * 2}, ${255 - index * 3}, ${255 - index * 2})`,
                    filter: "blur(0.1rem)",
                    transform: `translate(
                      ${index * 0.1}rem, 
                      ${index * 0.1}rem
                    ) scale(${1 + index * 0.01})`,
                    opacity: (1 / index) * 1.5,
                  }}
                >
                  RL80
                </div>
              );
            })}
          </div>
              <CyberNav position="fixed" />
        </div>
  
      {mounted && (
        <div style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
        }}>
          <VendingMachineScene />
        </div>
      )}
    </div>
  );
}
