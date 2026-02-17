import { useEffect, useState, useRef } from 'react'
import { db, collection, query, orderBy, limit, onSnapshot, getDocs } from '@/lib/firebaseClient'

// ===========================================
// CONFIGURATION (landscape 512×320)
// ===========================================

const CONFIG = {
  WIDTH: 512,
  HEIGHT: 320,

  // Layout
  HEADER_HEIGHT: 44,
  ITEM_HEIGHT: 80,

  // Whale thresholds
  WHALE_THRESHOLDS: {
    CANDLE: 1,
    MEGA_MULTIPLIER: 10,
  },

  // Auto-scroll
  AUTO_SCROLL_PAUSE: 3500,
  AUTO_SCROLL_SPEED: 0.25,
  AUTO_SCROLL_BOTTOM_PAUSE: 2500,
  SCROLL_LERP: 0.06,
}

// X/Twitter color palette (dark mode)
const X = {
  bg: '#000000',
  cardBg: '#000000',
  divider: '#2f3336',
  textPrimary: '#e7e9ea',
  textSecondary: '#71767b',
  accent: '#1d9bf0',
  verified: '#1d9bf0',
  burnOrange: '#ff7a00',
  whale: '#8a2be2',
  megaWhale: '#ffd700',
}

// System font stack for canvas (matches X)
const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

function formatAmount(amount) {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`
  return amount.toString()
}

function truncateAddress(address) {
  if (!address) return 'anon'
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function getActivityTier(amount) {
  const threshold = CONFIG.WHALE_THRESHOLDS.CANDLE
  if (amount >= threshold * CONFIG.WHALE_THRESHOLDS.MEGA_MULTIPLIER) return 'mega'
  if (amount >= threshold) return 'whale'
  return 'normal'
}

// Truncate text to fit maxWidth, with ellipsis
function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text
  let t = text
  while (t.length > 0 && ctx.measureText(t + '...').width > maxWidth) {
    t = t.slice(0, -1)
  }
  return t + '...'
}

// Wrap text to multiple lines
function wrapText(ctx, text, maxWidth, maxLines) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      if (lines.length >= maxLines) break
      line = word
    } else {
      line = test
    }
  }
  if (line && lines.length < maxLines) {
    if (ctx.measureText(line).width > maxWidth) {
      line = truncateText(ctx, line, maxWidth)
    }
    lines.push(line)
  } else if (lines.length === maxLines && words.length > lines.join(' ').split(' ').length) {
    // Truncate last line
    lines[maxLines - 1] = truncateText(ctx, lines[maxLines - 1], maxWidth)
  }
  return lines
}

// ===========================================
// MAIN COMPONENT
// ===========================================

const RL80Screen = () => {
  const [activities, setActivities] = useState([])
  const [illumin80UserIds, setIllumin80UserIds] = useState(new Set())

  // Image caches
  const activityAvatarsRef = useRef({})
  const illumin80BadgeRef = useRef(null)
  const profileAvatarRef = useRef(null)

  // Scroll state
  const scrollPositionRef = useRef(0)
  const autoScrollStateRef = useRef('pausing')
  const autoScrollPauseStartRef = useRef(Date.now())

  // ===========================================
  // ILLUMIN80 BADGE + PROFILE AVATAR SETUP
  // ===========================================

  useEffect(() => {
    // Illumin80 badge
    const badgeImg = new Image()
    badgeImg.crossOrigin = 'anonymous'
    badgeImg.onload = () => { illumin80BadgeRef.current = badgeImg }
    badgeImg.src = '/images/ILLUMIN80_TATTOO.webp'

    // Profile avatar for header
    const avatarImg = new Image()
    avatarImg.crossOrigin = 'anonymous'
    avatarImg.onload = () => { profileAvatarRef.current = avatarImg }
    avatarImg.src = '/images/coinFront1.png'

    const fetchIllumin80 = async () => {
      try {
        const leaderboardQuery = query(
          collection(db, 'userStats'),
          orderBy('totalBurned', 'desc'),
          limit(20)
        )
        const snapshot = await getDocs(leaderboardQuery)
        const userIds = new Set()
        snapshot.docs.forEach(doc => {
          const data = doc.data()
          if (data.userId) userIds.add(data.userId)
        })
        setIllumin80UserIds(userIds)
      } catch (err) {
        console.warn('[RL80Screen] Failed to fetch Illumin80 leaderboard:', err)
      }
    }
    fetchIllumin80()
  }, [])

  // ===========================================
  // FIRESTORE SUBSCRIPTIONS
  // ===========================================

  useEffect(() => {
    if (!db) return

    // Offerings
    const offeringsQ = query(collection(db, 'offerings'), orderBy('createdAt', 'desc'), limit(30))
    const unsubOfferings = onSnapshot(offeringsQ, (snapshot) => {
      const items = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        items.push({
          id: doc.id,
          type: 'CANDLE',
          username: data.name || truncateAddress(data.walletAddress),
          userId: data.userId,
          userImageUrl: data.userImageUrl,
          amount: parseInt(data.tokensBurned) || 1,
          timestamp: data.createdAt?.toMillis?.() || Date.now(),
        })
      })
      if (items.length > 0) {
        setActivities(prev => {
          const other = prev.filter(a => a.type !== 'CANDLE')
          return [...items, ...other].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50)
        })
      }
    })

    // xPosts
    const xPostsQ = query(collection(db, 'xPost'), orderBy('createdAt', 'desc'), limit(20))
    const unsubXPosts = onSnapshot(xPostsQ, (snapshot) => {
      const items = []
      snapshot.forEach((doc) => {
        if (doc.id === '_meta') return
        const data = doc.data()
        if (!data.author || data.author === 'Unknown') return
        items.push({
          id: doc.id,
          type: 'XPOST',
          username: data.author,
          handle: data.handle || '',
          tweetText: data.text || '',
          userImageUrl: data.authorImageUrl || '',
          amount: 0,
          timestamp: data.createdAt?.toMillis?.() || Date.now(),
        })
      })
      if (items.length > 0) {
        setActivities(prev => {
          const other = prev.filter(a => a.type !== 'XPOST')
          return [...other, ...items].sort((a, b) => b.timestamp - a.timestamp).slice(0, 50)
        })
      }
    })

    return () => {
      unsubOfferings()
      unsubXPosts()
    }
  }, [])

  // ===========================================
  // LOAD USER AVATARS
  // ===========================================

  useEffect(() => {
    activities.forEach(activity => {
      if (!activity.userImageUrl || activityAvatarsRef.current.hasOwnProperty(activity.id)) return
      activityAvatarsRef.current[activity.id] = 'loading'

      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => { activityAvatarsRef.current[activity.id] = img }
      img.onerror = () => {
        const img2 = new Image()
        img2.onload = () => { activityAvatarsRef.current[activity.id] = img2 }
        img2.onerror = () => { activityAvatarsRef.current[activity.id] = 'failed' }
        img2.src = activity.userImageUrl
      }
      img.src = activity.userImageUrl
    })
  }, [activities])

  // ===========================================
  // DRAW LOOP
  // ===========================================

  useEffect(() => {
    const draw = () => {
      const canvas = window['__screen4Canvas']
      const texture = window['__screen4Texture']
      if (!canvas || !texture) return

      const ctx = canvas.getContext('2d')
      const W = CONFIG.WIDTH
      const H = CONFIG.HEIGHT
      const now = Date.now()

      // ---- Auto-scroll logic ----
      const feedTop = CONFIG.HEADER_HEIGHT
      const feedVisible = H - feedTop
      const totalContent = activities.length * CONFIG.ITEM_HEIGHT
      const maxScroll = Math.max(0, totalContent - feedVisible)

      if (maxScroll > 0) {
        if (autoScrollStateRef.current === 'pausing') {
          if (now - autoScrollPauseStartRef.current > CONFIG.AUTO_SCROLL_PAUSE) {
            autoScrollStateRef.current = 'scrolling'
          }
        } else if (autoScrollStateRef.current === 'scrolling') {
          scrollPositionRef.current += CONFIG.AUTO_SCROLL_SPEED
          if (scrollPositionRef.current >= maxScroll) {
            scrollPositionRef.current = maxScroll
            autoScrollStateRef.current = 'bottom_pause'
            autoScrollPauseStartRef.current = now
          }
        } else if (autoScrollStateRef.current === 'bottom_pause') {
          if (now - autoScrollPauseStartRef.current > CONFIG.AUTO_SCROLL_BOTTOM_PAUSE) {
            autoScrollStateRef.current = 'scrolling_up'
          }
        } else if (autoScrollStateRef.current === 'scrolling_up') {
          scrollPositionRef.current -= (scrollPositionRef.current * CONFIG.SCROLL_LERP) + 0.5
          if (scrollPositionRef.current < 1) {
            scrollPositionRef.current = 0
            autoScrollStateRef.current = 'pausing'
            autoScrollPauseStartRef.current = now
          }
        }
      }

      // ---- Background ----
      ctx.fillStyle = X.bg
      ctx.fillRect(0, 0, W, H)

      // ---- Header bar (X-style profile bar) ----
      // Slightly elevated header bg
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'
      ctx.fillRect(0, 0, W, CONFIG.HEADER_HEIGHT)

      // Profile avatar in header
      const headerAvatarR = 16
      const headerAvatarCX = 14 + headerAvatarR
      const headerAvatarCY = CONFIG.HEADER_HEIGHT / 2
      if (profileAvatarRef.current) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(headerAvatarCX, headerAvatarCY, headerAvatarR, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(profileAvatarRef.current, headerAvatarCX - headerAvatarR, headerAvatarCY - headerAvatarR, headerAvatarR * 2, headerAvatarR * 2)
        ctx.restore()
      }

      // Profile name + verified badge
      ctx.fillStyle = X.textPrimary
      ctx.font = `bold 15px ${FONT}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      const nameX = headerAvatarCX + headerAvatarR + 10
      ctx.fillText('𝕆𝖚𝖗 𝕷𝖆𝖉𝖞 ᵒᶠ 𝕻𝖊𝖗𝖕𝖊𝖙𝖚𝖆𝖑 𝕻𝖗𝖔𝖋𝖎𝖙', nameX, headerAvatarCY - 6)

      // Blue verified checkmark
      const nameW = ctx.measureText('𝕆𝖚𝖗 𝕷𝖆𝖉𝖞 ᵒᶠ 𝕻𝖊𝖗𝖕𝖊𝖙𝖚𝖆𝖑 𝕻𝖗𝖔𝖋𝖎𝖙').width
      const checkX = nameX + nameW + 15
      const checkY = headerAvatarCY - 6
      ctx.fillStyle = X.verified
      ctx.beginPath()
      ctx.arc(checkX, checkY, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = `bold 10px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText('\u2713', checkX, checkY + 1)

      // Handle below name
      ctx.fillStyle = X.textSecondary
      ctx.font = `13px ${FONT}`
      ctx.textAlign = 'left'
      ctx.fillText('@rl80token', nameX, headerAvatarCY + 10)

      // Header bottom divider
      ctx.strokeStyle = X.divider
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, CONFIG.HEADER_HEIGHT)
      ctx.lineTo(W, CONFIG.HEADER_HEIGHT)
      ctx.stroke()

      // ---- Activity Feed ----
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, feedTop, W, feedVisible)
      ctx.clip()

      let curY = feedTop - scrollPositionRef.current

      activities.forEach((activity) => {
        const itemH = CONFIG.ITEM_HEIGHT
        const itemY = curY

        // Skip offscreen
        if (itemY + itemH < feedTop - 10 || itemY > H + 10) {
          curY += itemH
          return
        }

        const isXPost = activity.type === 'XPOST'
        const tier = isXPost ? 'normal' : getActivityTier(activity.amount)

        // Whale glow
        if (tier === 'mega') {
          ctx.shadowColor = 'rgba(255, 215, 0, 0.3)'
          ctx.shadowBlur = 10
        } else if (tier === 'whale') {
          ctx.shadowColor = 'rgba(138, 43, 226, 0.2)'
          ctx.shadowBlur = 8
        }

        // ---- Avatar (40px circle) ----
        const avatarR = 20
        const avatarCX = 16 + avatarR
        const avatarCY = itemY + 12 + avatarR

        const userAvatar = activityAvatarsRef.current[activity.id]
        const hasAvatar = userAvatar && userAvatar instanceof Image

        if (hasAvatar) {
          ctx.save()
          ctx.beginPath()
          ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2)
          ctx.clip()
          ctx.drawImage(userAvatar, avatarCX - avatarR, avatarCY - avatarR, avatarR * 2, avatarR * 2)
          ctx.restore()
        } else {
          // Placeholder
          ctx.fillStyle = '#2f3336'
          ctx.beginPath()
          ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = X.textSecondary
          ctx.font = `bold 16px ${FONT}`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText((activity.username || '?').charAt(0).toUpperCase(), avatarCX, avatarCY)
        }

        ctx.shadowBlur = 0

        // ---- Text content ----
        const textX = avatarCX + avatarR + 10
        const maxTextW = W - textX - 12
        ctx.textAlign = 'left'
        ctx.textBaseline = 'alphabetic'

        // Line 1: Name (bold) + badge + handle + dot + time
        const displayName = activity.username || 'anon'
        const truncName = displayName.length > 16 ? displayName.slice(0, 14) + '..' : displayName
        ctx.fillStyle = X.textPrimary
        ctx.font = `bold 13px ${FONT}`
        const nameLineY = itemY + 22
        ctx.fillText(truncName, textX, nameLineY)

        let afterNameX = textX + ctx.measureText(truncName).width

        // Illumin80 badge
        if (activity.userId && illumin80UserIds.has(activity.userId) && illumin80BadgeRef.current) {
          const bSize = 14
          ctx.drawImage(illumin80BadgeRef.current, afterNameX + 4, nameLineY - 11, bSize, bSize)
          afterNameX += bSize + 6
        }

        // Handle (for xPosts) or action type label
        if (isXPost && activity.handle) {
          ctx.fillStyle = X.textSecondary
          ctx.font = `12px ${FONT}`
          ctx.fillText(`@${activity.handle}`, afterNameX + 4, nameLineY)
          afterNameX += ctx.measureText(`@${activity.handle}`).width + 8
        } else if (!isXPost) {
          // Burn action tag
          ctx.fillStyle = X.burnOrange
          ctx.font = `12px ${FONT}`
          const burnLabel = tier === 'mega' ? 'burned RL80  \uD83D\uDC0B' : tier === 'whale' ? 'burned RL80  \uD83D\uDD25' : 'burned RL80'
          ctx.fillText(burnLabel, afterNameX + 4, nameLineY)
          afterNameX += ctx.measureText(burnLabel).width + 8
        }

        // Dot separator + time
        ctx.fillStyle = X.textSecondary
        ctx.font = `12px ${FONT}`
        const timeStr = `\u00B7 ${formatTimeAgo(activity.timestamp)}`
        // Place time at end of name row, but not past edge
        const timeW = ctx.measureText(timeStr).width
        const timeX = Math.min(afterNameX + 4, W - timeW - 12)
        ctx.fillText(timeStr, timeX, nameLineY)

        // Line 2-3: Tweet text or burn details
        if (isXPost) {
          ctx.fillStyle = X.textPrimary
          ctx.font = `12px ${FONT}`
          const lines = wrapText(ctx, activity.tweetText || '', maxTextW, 3)
          lines.forEach((line, i) => {
            ctx.fillText(line, textX, nameLineY + 18 + i * 16)
          })
        } else {
          // Burn amount
          ctx.fillStyle = X.textPrimary
          ctx.font = `13px ${FONT}`
          const amountLine = `+${formatAmount(activity.amount)} RL80 offered`
          ctx.fillText(amountLine, textX, nameLineY + 18)

          // Whale badge text
          if (tier === 'mega') {
            ctx.fillStyle = X.megaWhale
            ctx.font = `bold 11px ${FONT}`
            ctx.fillText('MEGA WHALE', textX, nameLineY + 34)
          } else if (tier === 'whale') {
            ctx.fillStyle = X.whale
            ctx.font = `bold 11px ${FONT}`
            ctx.fillText('WHALE', textX, nameLineY + 34)
          }
        }

        // Divider line between items (X-style)
        ctx.strokeStyle = X.divider
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(textX, itemY + itemH - 1)
        ctx.lineTo(W, itemY + itemH - 1)
        ctx.stroke()

        curY += itemH
      })

      ctx.restore()

      // ---- Scroll indicator (thin, X-style) ----
      if (maxScroll > 0) {
        const scrollFrac = scrollPositionRef.current / maxScroll
        const indicatorH = Math.max(30, (feedVisible / totalContent) * feedVisible)
        const indicatorY = feedTop + scrollFrac * (feedVisible - indicatorH)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
        ctx.beginPath()
        ctx.roundRect(W - 3, indicatorY, 2, indicatorH, 1)
        ctx.fill()
      }

      texture.needsUpdate = true
    }

    const intervalId = setInterval(draw, 100)
    return () => clearInterval(intervalId)
  }, [activities, illumin80UserIds])

  return null
}

export default RL80Screen
