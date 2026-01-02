'use client'

import React from 'react'
import dynamic from 'next/dynamic'

const CandleShrine = dynamic(() => import('../../components/CandleShrine'), {
  ssr: false,
  loading: () => <div style={{ width: '100vw', height: '100vh', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>Loading Candle Shrine...</div>
})

export default function CandleTestPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <CandleShrine />
      
      {/* Simple test controls */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        background: 'rgba(0,0,0,0.8)',
        color: '#fff',
        padding: '16px',
        borderRadius: '8px',
        fontFamily: 'monospace'
      }}>
        <h2 style={{ margin: 0, marginBottom: '8px' }}>CandleShrine Test Page</h2>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>Isolated component testing</p>
      </div>
    </div>
  )
}