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

function getOfferingIntensity(burned) {
  if (burned >= 2500) return 'high'
  if (burned >= 800) return 'medium'
  return 'low'
}

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
  const intensity = getOfferingIntensity(o.burned)
  const glowAlpha = intensity === 'high' ? 0.28 : intensity === 'medium' ? 0.2 : 0.13

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: isHorizontal ? '8px' : '10px',
      fontFamily: "'IoskeleyMono', 'Courier New', monospace",
      letterSpacing: 0,
      background: `
        radial-gradient(circle at 8% 50%, ${o.tint || '#d49f3a'}${intensity === 'high' ? '2f' : '1f'} 0%, transparent 36%),
        linear-gradient(90deg, rgba(24, 10, 8, 0.82), rgba(9, 7, 5, 0.56) 56%, rgba(0,0,0,0.46)),
        repeating-linear-gradient(0deg, rgba(255, 229, 174, 0.035) 0 1px, transparent 1px 5px)
      `,
      backdropFilter: 'blur(8px) saturate(1.15)',
      border: '1px solid rgba(244, 205, 137, 0.16)',
      borderLeft: `2px solid ${o.tint || '#d49f3a'}`,
      borderRadius: 8,
      boxShadow: `
        inset 0 0 18px rgba(255, 213, 147, 0.045),
        0 0 20px rgba(0, 0, 0, 0.45),
        0 0 22px rgba(${o.tint === '#b83b3b' ? '184, 59, 59' : o.tint === '#8b5fbf' ? '139, 95, 191' : o.tint === '#4aa876' ? '74, 168, 118' : '212, 159, 58'}, ${glowAlpha})
      `,
      padding: isHorizontal ? '5px 11px 5px 4px' : '7px 10px 7px 6px',
      whiteSpace: 'nowrap',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        inset: '1px 1px auto 1px',
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,234,185,0.34), transparent)',
      }} />
      <CandleAvatar
        image={o.image}
        tint={o.tint}
        name={o.name}
        size={isHorizontal ? 30 : 38}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <span style={{
          fontSize: isHorizontal ? '11px' : '12px',
          fontWeight: 700,
          color: '#7dff9d',
          textShadow: '0 0 8px rgba(99,255,144,0.56), 0 0 18px rgba(99,255,144,0.18)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: isHorizontal ? 94 : 104,
        }}>
          {o.name}
        </span>
        <div style={{
          display: 'flex',
          gap: '6px',
          alignItems: 'center',
        }}>
          <span style={{
            fontSize: isHorizontal ? '10px' : '11px',
            color: '#f3b55f',
            textShadow: '0 0 8px rgba(255,170,68,0.32)',
          }}>
            {o.burned.toLocaleString()}
          </span>
          <span style={{
            fontSize: isHorizontal ? '7px' : '8px',
            lineHeight: 1,
            color: '#301507',
            background: 'rgba(244, 181, 95, 0.72)',
            border: '1px solid rgba(255, 230, 180, 0.18)',
            borderRadius: 999,
            padding: isHorizontal ? '2px 4px' : '2px 5px',
            textShadow: 'none',
            fontWeight: 800,
          }}>
            RL80
          </span>
          <span style={{
            fontSize: isHorizontal ? '8px' : '9px',
            color: 'rgba(255,235,205,0.34)',
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
      top: '60%',
      transform: 'translateY(-50%)',
      width: 210,
      height: '60vh',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 5,
      maskImage: 'linear-gradient(180deg, transparent 0%, black 10%, black 90%, transparent 100%)',
      WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, black 10%, black 90%, transparent 100%)',
    }}>
      <div style={{
        position: 'absolute',
        left: 14,
        top: 18,
        bottom: 18,
        width: 1,
        background: 'linear-gradient(180deg, transparent, rgba(244, 181, 95, 0.34), rgba(111,255,147,0.18), transparent)',
        boxShadow: '0 0 16px rgba(244,181,95,0.25)',
      }} />
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        animation: 'communityMarqueeV 42s linear infinite',
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
