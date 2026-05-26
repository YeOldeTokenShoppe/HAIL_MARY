'use client'

import React, { useState, useEffect, useRef } from 'react'

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

const MAX_VISIBLE = 3
const ROTATE_MS = 5500

function getOfferingIntensity(burned) {
  if (burned >= 2500) return 'high'
  if (burned >= 800) return 'medium'
  return 'low'
}

function CandleAvatar({ image, tint, name, size = 30 }) {
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

function CandleToast({ item }) {
  const [entered, setEntered] = useState(false)
  useEffect(() => {
    const r = requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntered(true))
    )
    return () => cancelAnimationFrame(r)
  }, [])

  const intensity = getOfferingIntensity(item.burned)
  const glowAlpha = intensity === 'high' ? 0.28 : intensity === 'medium' ? 0.2 : 0.13
  const rgbMap = {
    '#b83b3b': '184, 59, 59',
    '#8b5fbf': '139, 95, 191',
    '#4aa876': '74, 168, 118',
    '#e57aa7': '229, 122, 167',
  }
  const rgb = rgbMap[item.tint] || '212, 159, 58'

  return (
    <div style={{
      transform: entered ? 'translateX(0)' : 'translateX(400px)',
      opacity: entered ? 1 : 0,
      transition: 'transform 0.55s cubic-bezier(0.2, 0.9, 0.25, 1), opacity 0.4s ease',
      pointerEvents: 'auto',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontFamily: "'IoskeleyMono', 'Courier New', monospace",
      background: `
        radial-gradient(circle at 8% 50%, ${item.tint || '#d49f3a'}${intensity === 'high' ? '2f' : '1f'} 0%, transparent 36%),
        linear-gradient(90deg, rgba(24, 10, 8, 0.82), rgba(9, 7, 5, 0.56) 56%, rgba(0,0,0,0.46)),
        repeating-linear-gradient(0deg, rgba(255, 229, 174, 0.035) 0 1px, transparent 1px 5px)
      `,
      backdropFilter: 'blur(8px) saturate(1.15)',
      border: '1px solid rgba(244, 205, 137, 0.16)',
      borderLeft: `2px solid ${item.tint || '#d49f3a'}`,
      borderRadius: 6,
      boxShadow: `
        inset 0 0 18px rgba(255, 213, 147, 0.045),
        0 0 20px rgba(0, 0, 0, 0.45),
        0 0 22px rgba(${rgb}, ${glowAlpha})
      `,
      padding: '8px 12px 8px 8px',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        inset: '1px 1px auto 1px',
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,234,185,0.34), transparent)',
      }} />
      <CandleAvatar image={item.image} tint={item.tint} name={item.name} size={32} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          color: '#7dff9d',
          textShadow: '0 0 8px rgba(99,255,144,0.56), 0 0 18px rgba(99,255,144,0.18)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 120,
        }}>
          {item.name}
        </span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{
            fontSize: '10px',
            color: '#f3b55f',
            textShadow: '0 0 8px rgba(255,170,68,0.32)',
          }}>
            {item.burned.toLocaleString()}
          </span>
          <span style={{
            fontSize: '7px',
            lineHeight: 1,
            color: '#301507',
            background: 'rgba(244, 181, 95, 0.72)',
            border: '1px solid rgba(255, 230, 180, 0.18)',
            borderRadius: 999,
            padding: '2px 4px',
            textShadow: 'none',
            fontWeight: 800,
          }}>
            RL80
          </span>
          <span style={{ fontSize: '8px', color: 'rgba(255,235,205,0.34)' }}>
            {item.litAgo}
          </span>
        </div>
      </div>
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: 1,
        background: item.tint || '#d49f3a',
        boxShadow: `0 0 6px ${item.tint || '#d49f3a'}`,
        width: '100%',
        transformOrigin: 'left',
        animation: `candleToastProgress ${ROTATE_MS}ms linear forwards`,
      }} />
    </div>
  )
}

export default function CommunityCandles() {
  const [visible, setVisible] = useState([])
  const [show, setShow] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const idxRef = useRef(0)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 700)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const depth = window.scrollY / Math.max(window.innerHeight * 2, 1)
      setShow(depth < 0.5)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const showNext = () => {
      const item = MOCK_OFFERINGS[idxRef.current % MOCK_OFFERINGS.length]
      idxRef.current += 1
      setVisible(prev => [
        ...prev.slice(-(MAX_VISIBLE - 1)),
        { key: `${item.id}-${Date.now()}`, item },
      ])
    }
    showNext()
    const id = setInterval(showNext, ROTATE_MS)
    return () => clearInterval(id)
  }, [])

  if (!show || isMobile) return null

  return (
    <div style={{
      position: 'fixed',
      top: '5%',
      right: 12,
      zIndex: 60,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      width: 250,
      maxWidth: 'calc(100vw - 24px)',
      pointerEvents: 'none',
    }}>
      {visible.map(({ key, item }) => (
        <CandleToast key={key} item={item} />
      ))}

      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />
    </div>
  )
}

const KEYFRAMES = `
  @keyframes candleToastProgress {
    from { transform: scaleX(1); }
    to   { transform: scaleX(0); }
  }
  @keyframes candleGlow {
    0%, 100% { box-shadow: 0 0 6px color-mix(in srgb, var(--glow-color, #00ff88) 30%, transparent); }
    50% { box-shadow: 0 0 14px color-mix(in srgb, var(--glow-color, #00ff88) 55%, transparent), 0 0 24px color-mix(in srgb, var(--glow-color, #00ff88) 20%, transparent); }
  }
`
