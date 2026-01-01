import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Html } from '@react-three/drei'

// ============================================
// CONFIG
// ============================================
const CYCLE_INTERVAL = 4000 // Time between auto-cycling offerings
const RECEIVED_DISPLAY_TIME = 3000 // How long "prayer received" shows
const NOTIFICATION_ANIMATION_DURATION = 300

// ============================================
// PHONE SCREEN FEED COMPONENT
// Position this inside your phone 3D model using <Html>
// ============================================
export function PhoneScreenFeed({ 
  offerings = [], 
  hoveredOffering = null, 
  justLitOffering = null,
  onJustLitComplete = () => {},
  style = {}
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [displayState, setDisplayState] = useState('cycling') // 'cycling' | 'hovered' | 'justLit'
  const [isAnimating, setIsAnimating] = useState(false)
  const cycleTimerRef = useRef(null)
  const litTimerRef = useRef(null)

  // Determine what to display based on priority:
  // 1. justLitOffering (highest priority - user just lit a candle)
  // 2. hoveredOffering (user is hovering a candle)
  // 3. cycling through offerings (default)
  
  useEffect(() => {
    if (justLitOffering) {
      setDisplayState('justLit')
      setIsAnimating(true)
      setTimeout(() => setIsAnimating(false), NOTIFICATION_ANIMATION_DURATION)
      
      // Clear any existing timer
      if (litTimerRef.current) clearTimeout(litTimerRef.current)
      
      // Return to cycling after display time
      litTimerRef.current = setTimeout(() => {
        setDisplayState('cycling')
        onJustLitComplete()
      }, RECEIVED_DISPLAY_TIME)
      
    } else if (hoveredOffering) {
      setDisplayState('hovered')
      setIsAnimating(true)
      setTimeout(() => setIsAnimating(false), NOTIFICATION_ANIMATION_DURATION)
      
    } else {
      setDisplayState('cycling')
    }
  }, [justLitOffering, hoveredOffering, onJustLitComplete])

  // Auto-cycle through offerings when in cycling state
  useEffect(() => {
    if (displayState !== 'cycling' || offerings.length === 0) {
      if (cycleTimerRef.current) clearInterval(cycleTimerRef.current)
      return
    }

    cycleTimerRef.current = setInterval(() => {
      setIsAnimating(true)
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % offerings.length)
        setIsAnimating(false)
      }, NOTIFICATION_ANIMATION_DURATION / 2)
    }, CYCLE_INTERVAL)

    return () => {
      if (cycleTimerRef.current) clearInterval(cycleTimerRef.current)
    }
  }, [displayState, offerings.length])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (cycleTimerRef.current) clearInterval(cycleTimerRef.current)
      if (litTimerRef.current) clearTimeout(litTimerRef.current)
    }
  }, [])

  // Determine which offering to show
  const displayedOffering = 
    displayState === 'justLit' ? justLitOffering :
    displayState === 'hovered' ? hoveredOffering :
    offerings[currentIndex]

  if (!displayedOffering && displayState !== 'justLit') {
    return (
      <PhoneScreenContainer style={style}>
        <EmptyState />
      </PhoneScreenContainer>
    )
  }

  return (
    <PhoneScreenContainer style={style}>
      {displayState === 'justLit' ? (
        <PrayerReceivedNotification 
          offering={justLitOffering} 
          isAnimating={isAnimating}
        />
      ) : (
        <OfferingNotification 
          offering={displayedOffering} 
          isAnimating={isAnimating}
          isHovered={displayState === 'hovered'}
        />
      )}
      
      {/* Notification queue indicator */}
      {displayState === 'cycling' && offerings.length > 1 && (
        <QueueIndicator 
          current={currentIndex} 
          total={offerings.length} 
        />
      )}
    </PhoneScreenContainer>
  )
}

// ============================================
// PHONE SCREEN CONTAINER
// ============================================
function PhoneScreenContainer({ children, style }) {
  return (
    <div style={{
      width: '280px',
      height: '480px',  // Adjusted height to prevent clipping
      background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
      borderRadius: '24px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden',
      position: 'relative',
      boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)',
      ...style
    }}>
      {/* Status bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        fontSize: '12px',
        color: '#888'
      }}>
        <span>9:41</span>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <span>📶</span>
          <span>🔋</span>
        </div>
      </div>
      
      {/* App header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #00ff66 0%, #00aa44 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px'
        }}>
          🕯️
        </div>
        <div>
          <div style={{ color: '#fff', fontWeight: '600', fontSize: '14px' }}>
            Our Lady's Inbox
          </div>
          <div style={{ color: '#00ff66', fontSize: '10px' }}>
            ● Receiving prayers
          </div>
        </div>
      </div>
      
      {/* Content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}

// ============================================
// OFFERING NOTIFICATION (default/hover state)
// ============================================
function OfferingNotification({ offering, isAnimating, isHovered }) {
  if (!offering) return null
  
  const typeConfig = {
    petition: { icon: '🙏', label: 'Petition', color: '#ffaa00' },
    confession: { icon: '🖤', label: 'Confession', color: '#aa66ff' },
    appreciation: { icon: '✨', label: 'Appreciation', color: '#00ff66' }
  }
  
  const config = typeConfig[offering.type] || typeConfig.petition
  
  return (
    <div style={{
      background: isHovered 
        ? 'rgba(0, 255, 102, 0.15)' 
        : 'rgba(255, 255, 255, 0.05)',
      borderRadius: '16px',
      padding: '16px',
      border: isHovered 
        ? '1px solid rgba(0, 255, 102, 0.3)'
        : '1px solid rgba(255, 255, 255, 0.1)',
      transition: 'all 0.3s ease',
      opacity: isAnimating ? 0 : 1,
      transform: isAnimating ? 'translateY(-10px)' : 'translateY(0)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '12px'
      }}>
        {/* Avatar */}
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${config.color}44 0%, ${config.color}22 100%)`,
          border: `2px solid ${config.color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px'
        }}>
          {config.icon}
        </div>
        
        <div style={{ flex: 1 }}>
          <div style={{ 
            color: '#fff', 
            fontWeight: '600',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {offering.name || 'Anonymous'}
            {offering.tokensBurned >= 5000 && (
              <span style={{ fontSize: '12px' }}>🔥</span>
            )}
          </div>
          <div style={{ 
            color: config.color, 
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {config.label}
          </div>
        </div>
        
        {/* Timestamp */}
        <div style={{ 
          color: '#666', 
          fontSize: '11px' 
        }}>
          {offering.timestamp || 'just now'}
        </div>
      </div>
      
      {/* Message */}
      {offering.message && (
        <div style={{
          color: '#ccc',
          fontSize: '14px',
          lineHeight: '1.5',
          marginBottom: '12px',
          padding: '12px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '12px',
          borderLeft: `3px solid ${config.color}`
        }}>
          "{offering.message}"
        </div>
      )}
      
      {/* Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        color: '#666',
        fontSize: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>🔥</span>
          <span style={{ color: '#ff6b35' }}>
            {offering.tokensBurned?.toLocaleString() || '???'} RL80
          </span>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <span style={{ cursor: 'pointer' }}>💚</span>
          <span style={{ cursor: 'pointer' }}>🔄</span>
        </div>
      </div>
    </div>
  )
}

// ============================================
// PRAYER RECEIVED NOTIFICATION (just lit state)
// ============================================
function PrayerReceivedNotification({ offering, isAnimating }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      opacity: isAnimating ? 0 : 1,
      transform: isAnimating ? 'scale(0.9)' : 'scale(1)',
      transition: 'all 0.3s ease'
    }}>
      {/* Animated glow */}
      <div style={{
        width: '80px',
        height: '80px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,255,102,0.4) 0%, rgba(0,255,102,0) 70%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '20px',
        animation: 'pulse 2s ease-in-out infinite'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #00ff66 0%, #00aa44 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '28px',
          boxShadow: '0 0 30px rgba(0, 255, 102, 0.5)'
        }}>
          ✓
        </div>
      </div>
      
      <div style={{
        color: '#00ff66',
        fontSize: '18px',
        fontWeight: '700',
        marginBottom: '8px',
        textTransform: 'uppercase',
        letterSpacing: '2px'
      }}>
        Prayer Received
      </div>
      
      <div style={{
        color: '#888',
        fontSize: '14px',
        marginBottom: '16px'
      }}>
        Our Lady has heard you
      </div>
      
      {offering && (
        <div style={{
          background: 'rgba(0, 255, 102, 0.1)',
          border: '1px solid rgba(0, 255, 102, 0.3)',
          borderRadius: '12px',
          padding: '12px 20px',
          color: '#ccc',
          fontSize: '13px'
        }}>
          <span style={{ color: '#00ff66' }}>🔥 {offering.tokensBurned?.toLocaleString()}</span>
          {' '}RL80 sacrificed
        </div>
      )}
      
      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `}</style>
    </div>
  )
}

// ============================================
// EMPTY STATE (no offerings yet)
// ============================================
function EmptyState() {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      color: '#666'
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>
        🕯️
      </div>
      <div style={{ fontSize: '14px', marginBottom: '8px' }}>
        No prayers yet
      </div>
      <div style={{ fontSize: '12px', color: '#444' }}>
        Be the first to light a candle
      </div>
    </div>
  )
}

// ============================================
// QUEUE INDICATOR (dots showing position in cycle)
// ============================================
function QueueIndicator({ current, total }) {
  // Only show up to 5 dots
  const dotsToShow = Math.min(total, 5)
  const normalizedCurrent = current % dotsToShow
  
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      gap: '6px',
      marginTop: '16px'
    }}>
      {Array.from({ length: dotsToShow }).map((_, i) => (
        <div
          key={i}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: i === normalizedCurrent ? '#00ff66' : '#333',
            transition: 'background 0.3s ease'
          }}
        />
      ))}
      {total > 5 && (
        <div style={{ color: '#444', fontSize: '10px', marginLeft: '4px' }}>
          +{total - 5}
        </div>
      )}
    </div>
  )
}

// ============================================
// WRAPPER FOR USE IN R3F SCENE
// Position this where your phone screen is
// ============================================
export function PhoneScreenFeed3D({
  position = [0, 0, -3],
  scale = 0.01,
  rotation = [0, 0, 0],
  offerings,
  hoveredOffering,
  justLitOffering,
  onJustLitComplete
}) {
  return (
    <Html
      position={position}
      transform
      occlude={false}  // Disable occlusion to show full content
      center  // Center the HTML content
      distanceFactor={1}  // This controls the size - higher = bigger
      zIndexRange={[10, 0]}  // Lower z-index range
      style={{
        pointerEvents: 'none',
      }}
    >
      <div style={{
        transform: `scale(${scale * 10})`,  // Apply scale manually
        transformOrigin: 'center center'
      }}>
        <PhoneScreenFeed
          offerings={offerings}
          hoveredOffering={hoveredOffering}
          justLitOffering={justLitOffering}
          onJustLitComplete={onJustLitComplete}
        />
      </div>
    </Html>
  )
}

// ============================================
// EXAMPLE INTEGRATION
// ============================================
export function ExampleUsage() {
  const [hoveredOffering, setHoveredOffering] = useState(null)
  const [justLitOffering, setJustLitOffering] = useState(null)
  
  const mockOfferings = [
    { 
      name: 'chelleville', 
      type: 'petition', 
      message: 'May my bags pump eternally', 
      tokensBurned: 1000,
      timestamp: '2m ago'
    },
    { 
      name: 'degen_mike', 
      type: 'appreciation', 
      message: 'Thanks for the 10x Our Lady 🚀', 
      tokensBurned: 5000,
      timestamp: '5m ago'
    },
    { 
      name: 'cryptopriest', 
      type: 'confession', 
      message: 'I sold the bottom... forgive me', 
      tokensBurned: 2500,
      timestamp: '12m ago'
    },
    { 
      name: 'hodlqueen', 
      type: 'petition', 
      message: 'Deliver us from paper hands', 
      tokensBurned: 10000,
      timestamp: '1h ago'
    },
    { 
      name: 'anonymous', 
      type: 'appreciation', 
      message: null, 
      tokensBurned: 500,
      timestamp: '2h ago'
    },
  ]
  
  // Simulate lighting a candle
  const handleLightCandle = () => {
    setJustLitOffering({
      name: 'you',
      type: 'petition',
      message: 'Test prayer',
      tokensBurned: 1000
    })
  }
  
  // Simulate hovering a candle
  const handleHoverCandle = () => {
    const randomOffering = mockOfferings[Math.floor(Math.random() * mockOfferings.length)]
    setHoveredOffering(randomOffering)
  }
  
  return (
    <div style={{ 
      padding: '40px', 
      background: '#0a0a0a', 
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '20px'
    }}>
      <h1 style={{ color: '#fff', fontFamily: 'monospace' }}>Phone Screen Feed Demo</h1>
      
      <div style={{ display: 'flex', gap: '12px' }}>
        <button 
          onClick={handleLightCandle}
          style={{
            padding: '12px 24px',
            background: '#00ff66',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          🕯️ Light a Candle
        </button>
        
        <button 
          onMouseEnter={handleHoverCandle}
          onMouseLeave={() => setHoveredOffering(null)}
          style={{
            padding: '12px 24px',
            background: '#333',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Hover to Preview
        </button>
      </div>
      
      <PhoneScreenFeed
        offerings={mockOfferings}
        hoveredOffering={hoveredOffering}
        justLitOffering={justLitOffering}
        onJustLitComplete={() => setJustLitOffering(null)}
      />
    </div>
  )
}

export default PhoneScreenFeed