'use client'

import React, { useState, useEffect } from 'react'

const MOCK_OFFERINGS = [
  { id: '1', name: 'cryptoSarah',  burned: 420,  litAgo: '2h ago',  tint: '#b83b3b', image: '/images/sacreCoeur.webp' },
  { id: '2', name: 'diamondHands', burned: 1000, litAgo: '45m ago', tint: '#8b5fbf', image: null },
  { id: '3', name: '0xMaria',      burned: 250,  litAgo: '5h ago',  tint: '#d49f3a', image: '/images/nuestraSenora.webp' },
  { id: '4', name: 'hodlKing',     burned: 69,   litAgo: '1h ago',  tint: '#4aa876', image: null },
  { id: '5', name: 'degen.eth',    burned: 2500, litAgo: '12m ago', tint: '#e57aa7', image: '/queenOfHearts1.jpg' },
  { id: '6', name: 'lunaSol',      burned: 800,  litAgo: '3h ago',  tint: '#b83b3b', image: null },
  { id: '7', name: 'wagmiQueen',   burned: 150,  litAgo: '30m ago', tint: '#8b5fbf', image: '/images/sacreCoeur.webp' },
  { id: '8', name: 'ngmi_cope',    burned: 5000, litAgo: '8h ago',  tint: '#d49f3a', image: null },
]

const duplicated = [...MOCK_OFFERINGS, ...MOCK_OFFERINGS]

function CandleAvatar({ image, tint, name, size = 42 }) {
  const glowStyle = {
    width: size,
    height: size,
    borderRadius: '50%',
    border: `2px solid ${tint || '#00ff88'}`,
    flexShrink: 0,
    position: 'relative',
    animation: 'candleGlow 2.5s ease-in-out infinite',
    '--glow-color': tint || '#00ff88',
  }

  if (image) {
    return (
      <div style={{ ...glowStyle, overflow: 'hidden' }}>
        <img
          src={image}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          boxShadow: 'inset 0 0 6px rgba(0,0,0,0.5)',
        }} />
      </div>
    )
  }

  const initial = (name || '?')[0].toUpperCase()
  return (
    <div style={{
      ...glowStyle,
      background: `${tint || '#00ff88'}22`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: `${size * 0.4}px`,
      fontWeight: 700,
      color: tint || '#00ff88',
      textShadow: `0 0 6px ${tint || '#00ff88'}88`,
      fontFamily: "'Courier New', monospace",
    }}>
      {initial}
    </div>
  )
}

function OfferingCard({ o, layout }) {
  const isHorizontal = layout === 'horizontal'
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: isHorizontal ? '8px' : '10px',
      fontFamily: "'Courier New', monospace",
      letterSpacing: '0.04em',
      background: 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(6px)',
      border: '1px solid rgba(0,255,136,0.1)',
      borderRadius: isHorizontal ? '8px' : '10px',
      padding: isHorizontal ? '5px 12px 5px 5px' : '8px 10px',
      whiteSpace: 'nowrap',
    }}>
      <CandleAvatar
        image={o.image}
        tint={o.tint}
        name={o.name}
        size={isHorizontal ? 32 : 42}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <span style={{
          fontSize: isHorizontal ? '11px' : '12px',
          fontWeight: 600,
          color: '#00ff88',
          textShadow: '0 0 8px rgba(0,255,136,0.5)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {o.name}
        </span>
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'baseline',
        }}>
          <span style={{
            fontSize: isHorizontal ? '10px' : '11px',
            color: '#ffaa44',
            textShadow: '0 0 6px rgba(255,170,68,0.3)',
          }}>
            {o.burned.toLocaleString()} RL80
          </span>
          <span style={{
            fontSize: isHorizontal ? '8px' : '9px',
            color: 'rgba(255,255,255,0.3)',
          }}>
            {o.litAgo}
          </span>
        </div>
      </div>
    </div>
  )
}

export default function CommunityCandles() {
  const [visible, setVisible] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 900)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const depth = window.scrollY / Math.max(window.innerHeight * 2, 1)
      setVisible(depth < 0.5)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  if (isMobile) {
    return (
      <div style={{
        position: 'fixed',
        top: 8,
        left: 0,
        right: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 5,
        padding: '8px 0',
        maskImage: 'linear-gradient(90deg, transparent 0%, black 6%, black 94%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, black 6%, black 94%, transparent 100%)',
      }}>
        <div style={{
          display: 'flex',
          gap: '24px',
          alignItems: 'center',
          animation: 'communityMarqueeH 40s linear infinite',
          width: 'max-content',
        }}>
          {duplicated.map((o, i) => (
            <OfferingCard key={`${o.id}-${i}`} o={o} layout="horizontal" />
          ))}
        </div>

        <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      left: '15%',
      top: '50%',
      transform: 'translateY(-50%)',
      width: 180,
      height: '60vh',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 5,
      maskImage: 'linear-gradient(180deg, transparent 0%, black 10%, black 90%, transparent 100%)',
      WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, black 10%, black 90%, transparent 100%)',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        animation: 'communityMarqueeV 35s linear infinite',
        width: '100%',
      }}>
        {duplicated.map((o, i) => (
          <OfferingCard key={`${o.id}-${i}`} o={o} layout="vertical" />
        ))}
      </div>

      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
    </div>
  )
}

const KEYFRAMES = `
  @keyframes communityMarqueeV {
    0% { transform: translateY(0); }
    100% { transform: translateY(-50%); }
  }
  @keyframes communityMarqueeH {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  @keyframes candleGlow {
    0%, 100% { box-shadow: 0 0 6px color-mix(in srgb, var(--glow-color, #00ff88) 30%, transparent); }
    50% { box-shadow: 0 0 14px color-mix(in srgb, var(--glow-color, #00ff88) 55%, transparent), 0 0 24px color-mix(in srgb, var(--glow-color, #00ff88) 20%, transparent); }
  }
`
