// EmojiRain.jsx
'use client'
import { useEffect, useRef, useCallback } from 'react'
import './EmojiRain.css'

const EMOJI_SETS = {
  moon: ['🚀', '🌙', '💎', '🙌', '🔥', '💰', '📈', '🎉', '✨', '💪'],
  bullish: ['😊', '🎉', '💚', '📈', '👍', '✨', '🙏', '💫'],
  neutral: ['😐', '🤔', '👀', '💭', '🧐', '❓', '⁉️', '🫤', '🥱'],
  bearish: ['😰', '😟', '📉', '💔', '😬', '🥺', '😮‍💨'],
  rekt: ['😱', '💀', '🔥', '📉', '😭', '🤮', '😈', '❗', '☠️', '🆘']
}

const getEmojiSet = (priceChange) => {
  if (priceChange > 5) return EMOJI_SETS.moon
  if (priceChange > 2) return EMOJI_SETS.bullish
  if (priceChange >= -2) return EMOJI_SETS.neutral
  if (priceChange >= -5) return EMOJI_SETS.bearish
  return EMOJI_SETS.rekt
}

const getBaseSpawnRate = (priceChange) => {
  const absChange = Math.abs(priceChange)
  if (absChange > 5) return 400
  if (absChange > 2) return 800
  return 1200
}

let emojiId = 0

export default function EmojiRain({ 
  priceChange = 0, 
  isActive = true,
  position = { x: '50%', y: '20%' },
  spread = 180,
  maxEmojis = 8
}) {
  const containerRef = useRef(null)
  const intervalRef = useRef(null)
  const priceChangeRef = useRef(priceChange)
  const isActiveRef = useRef(isActive)
  const emojiCountRef = useRef(0)
  
  // Keep refs in sync without causing re-renders
  useEffect(() => {
    priceChangeRef.current = priceChange
  }, [priceChange])
  
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])
  
  // Spawn emoji using direct DOM manipulation - NO STATE UPDATES
  const spawnEmoji = useCallback(() => {
    if (!isActiveRef.current || !containerRef.current) return
    
    // Enforce max emojis
    if (emojiCountRef.current >= maxEmojis) {
      const firstChild = containerRef.current.firstChild
      if (firstChild) {
        containerRef.current.removeChild(firstChild)
        emojiCountRef.current--
      }
    }
    
    const emojiSet = getEmojiSet(priceChangeRef.current)
    const emoji = emojiSet[Math.floor(Math.random() * emojiSet.length)]
    
    const side = Math.random() > 0.5 ? 1 : -1
    const xOffset = side * (20 + Math.random() * (spread / 2))
    const duration = 7 + Math.random() * 4
    const scale = 1.4 + Math.random() * 0.6
    const wobble = 5 + Math.random() * 10
    
    // Create DOM element directly
    const el = document.createElement('div')
    el.className = 'emoji-float'
    el.textContent = emoji
    el.style.setProperty('--start-x', `${xOffset}px`)
    el.style.setProperty('--end-x', `${xOffset + side * (10 + Math.random() * 30)}px`)
    el.style.setProperty('--duration', `${duration}s`)
    el.style.setProperty('--scale', scale)
    el.style.setProperty('--wobble', `${wobble}deg`)
    
    containerRef.current.appendChild(el)
    emojiCountRef.current++
    
    // Remove after animation completes
    setTimeout(() => {
      if (el.parentNode) {
        el.parentNode.removeChild(el)
        emojiCountRef.current--
      }
    }, duration * 1000 + 100)
    
  }, [spread, maxEmojis])
  
  // Setup/teardown interval
  useEffect(() => {
    const startInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      
      if (isActive) {
        spawnEmoji()
        const baseRate = getBaseSpawnRate(priceChange)
        intervalRef.current = setInterval(spawnEmoji, baseRate)
      }
    }
    
    startInterval()
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isActive, priceChange, spawnEmoji])
  
  // Cleanup all emojis on unmount
  useEffect(() => {
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
      emojiCountRef.current = 0
    }
  }, [])
  
  return (
    <div 
      ref={containerRef}
      className="emoji-rain-container"
      style={{
        left: position.x,
        top: position.y,
        width: spread * 2,
      }}
    />
  )
}