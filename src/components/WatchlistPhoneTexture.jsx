import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { db, collection, query, orderBy, limit, onSnapshot, getDocs, doc, getDoc } from '@/lib/firebaseClient';
import {
  publishPhoneScroll,
  isPhoneScrollExternalDrive,
  consumePhoneScrollFlick,
} from '@/utils/phoneScrollSync';
import { intentionText } from '@/lib/intentions';

// ===========================================
// CONFIGURATION
// ===========================================

const CONFIG = {
  // Timing
  SCROLL_SPEED: 0.12,
  NEW_ITEM_HIGHLIGHT_DURATION: 3000,
  BREAKTHROUGH_DURATION: 5000,
  AUTO_SCROLL_INTERVAL: 4000,
  
  // Thresholds for whale status
  WHALE_THRESHOLDS: {
    CANDLE: 1,          // 1+ tokens burned = whale  
    STAKE: 50,          // 50+ staked = whale
    MEGA_MULTIPLIER: 10 // 10x threshold = mega whale
  },
  
  // Visual
  MAX_VISIBLE_ITEMS: 6,
  ITEM_HEIGHT: 85,
  ITEM_GAP: 12,
  XPOST_ITEM_HEIGHT: 300,
  CANDLE_ITEM_HEIGHT: 320,       // expanded vigil rows: header + centered votive "image"
  AUTO_SCROLL_PAUSE: 3000,       // Pause at top before scrolling
  AUTO_SCROLL_SPEED: 0.4,        // Pixels per frame for auto-scroll
  AUTO_SCROLL_BOTTOM_PAUSE: 2000, // Pause at bottom before resetting
};

// ===========================================
// ACTIVITY TYPES
// ===========================================

const ACTIVITY_TYPES = {
  CANDLE: {
    icon: '🕯️',
    verb: 'Lit a candle for Prosper80',
    unit: 'candle',
    pluralUnit: 'candles',
    color: '#00ff66'
  },
  
  XPOST: {
    icon: '𝕏',
    verb: 'posted',
    unit: '',
    color: '#1d9bf0'
  },
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function formatAmount(amount, type) {
  if (type === 'CLAIM') {
    return amount.toFixed(4);
  }
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K`;
  }
  return amount.toString();
}

function truncateAddress(address) {
  if (!address) return 'anon';
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// First *code point* of a display name, for avatar-placeholder
// initials. charAt(0) splits surrogate pairs, so an emoji-leading name
// ("🅱️erry") rendered as a broken-glyph box instead of the emoji.
function nameInitial(name) {
  return (Array.from(name || '')[0] || '?').toUpperCase();
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? currentLine + ' ' + word : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      if (lines.length >= maxLines) break;
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine && lines.length < maxLines) {
    // Truncate last line if needed
    if (ctx.measureText(currentLine).width > maxWidth) {
      while (ctx.measureText(currentLine + '...').width > maxWidth && currentLine.length > 0) {
        currentLine = currentLine.slice(0, -1);
      }
      currentLine += '...';
    }
    lines.push(currentLine);
  } else if (lines.length === maxLines) {
    // Add ellipsis to last line if we truncated
    let last = lines[maxLines - 1];
    if (words.length > lines.join(' ').split(' ').length) {
      while (ctx.measureText(last + '...').width > maxWidth && last.length > 0) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = last + '...';
    }
  }
  return lines;
}

function getActivityTier(type, amount) {
  const threshold = CONFIG.WHALE_THRESHOLDS[type] || CONFIG.WHALE_THRESHOLDS.CANDLE;
  
  if (amount >= threshold * CONFIG.WHALE_THRESHOLDS.MEGA_MULTIPLIER) {
    return 'mega';
  } else if (amount >= threshold) {
    return 'whale';
  } else if (amount >= threshold * 0.1) {
    return 'solid';
  }
  return 'normal';
}

function getTierStyle(tier) {
  switch (tier) {
    case 'mega':
      return {
        bgGradient: ['#ffd700', '#ff8c00'],
        icon: '🐋',
        glowColor: 'rgba(255, 215, 0, 0.4)',
        textColor: '#000',
        borderColor: '#ffd700',
      };
    case 'whale':
      return {
        bgGradient: ['#8a2be2', '#6a1ba2'],
        icon: '🔥',
        glowColor: 'rgba(138, 43, 226, 0.3)',
        textColor: '#fff',
        borderColor: '#8a2be2',
      };
    case 'solid':
      return {
        bgGradient: ['#2a2a2a', '#222'],
        icon: '✨',
        glowColor: null,
        textColor: '#fff',
        borderColor: '#444',
      };
    default:
      return {
        bgGradient: ['#1a1a1a', '#151515'],
        icon: '🙏',
        glowColor: null,
        textColor: '#ccc',
        borderColor: '#333',
      };
  }
}

// Simple monochrome settings gear (emoji ⚙ renders colored on Apple
// platforms, so it's drawn by hand to match X's flat icon).
function drawGear(ctx, x, y, r, color = '#e7e9ea') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = 4;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (r - 6), y + Math.sin(a) * (r - 6));
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y, r - 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.28, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// Fallback wax tints for holders who never picked one — the landing
// page's picker presets (keep in sync with VOTIVE_TINT_PRESETS in
// app/page.js), chosen deterministically per holder so the feed shows
// a varied vigil without misrepresenting anyone's customization: a
// real votiveTint pref always wins over the fallback.
const VOTIVE_FALLBACK_TINTS = [
  '#1fae5a', // shrine green (the old fixed default)
  '#b83b3b', // crimson
  '#d49f3a', // amber
  '#e57aa7', // rose
  '#8b5fbf', // violet
  '#0ef178', // jade
  '#14f7ff', // cyan
];

function fallbackTintFor(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return VOTIVE_FALLBACK_TINTS[Math.abs(h) % VOTIVE_FALLBACK_TINTS.length];
}

// Miniature novena/prayer candle, stylized flat-vector (not photoreal):
// glass jar, saint-image label with gold trim, tinted wax band at the
// top, flickering teardrop flame. (cx, cy) is the center of the full
// w×h footprint including the flame.
function drawVotiveCandle(ctx, cx, cy, w, h, labelImg, tint, seed = 0, flex = false) {
  // `flex` = the holder burned RL80 with this candle: gold rim, taller
  // flame, hotter glow.
  const flameH = h * (flex ? 0.25 : 0.2);
  const bodyH = h - flameH;
  const x = cx - w / 2;
  const y = cy - h / 2 + flameH;
  const r = w * 0.16;
  const waxH = bodyH * 0.2;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, bodyH, r);
  ctx.clip();

  // Wax, washed with the holder's votive tint. 0.7 alpha — at 0.35 the
  // cream base plus the flame glow flattened every color to near-white
  // at this size.
  ctx.fillStyle = '#f5ecd8';
  ctx.fillRect(x, y, w, bodyH);
  if (tint) {
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = tint;
    ctx.fillRect(x, y, w, waxH + 3);
    ctx.globalAlpha = 1;
  }

  // Saint label, contain-fit below the wax line so the artwork is
  // never cropped — it's the featured image of the post. Whatever the
  // label doesn't cover shows the cream wax, like a real jar sticker.
  const ly = y + waxH;
  const lh = bodyH - waxH;
  const iw = labelImg.naturalWidth || w;
  const ih = labelImg.naturalHeight || lh;
  const fit = Math.min(w / iw, lh / ih);
  const dw = iw * fit;
  const dh = ih * fit;
  const dx = x + (w - dw) / 2;
  const dy = ly + (lh - dh) / 2;
  ctx.drawImage(labelImg, dx, dy, dw, dh);

  // Gold trim hugging the artwork rather than the label area, so any
  // wax margins read as intentional framing
  ctx.strokeStyle = 'rgba(241, 215, 122, 0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(dx + 1, dy + 1, dw - 2, dh - 2);

  // Warm glow cast onto the wax from the flame — kept faint so it
  // doesn't bleach the wax tint to white
  const glow = ctx.createRadialGradient(cx, y + 3, 0, cx, y + 3, w * 0.75);
  glow.addColorStop(0, 'rgba(255, 190, 90, 0.28)');
  glow.addColorStop(1, 'rgba(255, 190, 90, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, waxH + 6);

  // Glass shading: highlight stripe left, shadow right
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(x + 3, y, 3, bodyH);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.fillRect(x + w - 6, y, 4, bodyH);

  ctx.restore();

  // Glass rim — gold for burnt offerings, otherwise the holder's wax
  // tint (colored-glass look; a white rim left every candle reading as
  // identical cream at this size)
  ctx.lineWidth = flex ? 2.5 : 1.5;
  if (flex) {
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.85)';
  } else {
    ctx.strokeStyle = tint || 'rgba(255, 255, 255, 0.45)';
    ctx.globalAlpha = 0.85;
  }
  ctx.beginPath();
  ctx.roundRect(x, y, w, bodyH, r);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Flame — sways and stretches a little each frame; seed staggers
  // the phase so a column of candles doesn't flicker in unison
  const t = Date.now();
  const sway = Math.sin(t / 120 + seed * 7) * 1.2;
  const stretch = 1 + Math.sin(t / 85 + seed * 3) * 0.08;
  const fx = cx + sway;
  const fBase = y + 3;
  const fTop = fBase - flameH * 1.15 * stretch;
  const fw = flameH * 0.5;

  const fGlow = ctx.createRadialGradient(
    fx, fBase - flameH * 0.5, 0,
    fx, fBase - flameH * 0.5, flameH * 1.5,
  );
  fGlow.addColorStop(0, `rgba(255, 170, 60, ${flex ? 0.55 : 0.4})`);
  fGlow.addColorStop(1, 'rgba(255, 170, 60, 0)');
  ctx.fillStyle = fGlow;
  ctx.fillRect(fx - flameH * 1.5, fBase - flameH * 2, flameH * 3, flameH * 2.5);

  const fGrad = ctx.createLinearGradient(fx, fTop, fx, fBase);
  fGrad.addColorStop(0, '#ffd54a');
  fGrad.addColorStop(0.6, '#ffa726');
  fGrad.addColorStop(1, '#ff7043');
  ctx.fillStyle = fGrad;
  ctx.beginPath();
  ctx.moveTo(fx, fTop);
  ctx.bezierCurveTo(fx + fw, fBase - flameH * 0.45, fx + fw * 0.7, fBase, fx, fBase);
  ctx.bezierCurveTo(fx - fw * 0.7, fBase, fx - fw, fBase - flameH * 0.45, fx, fTop);
  ctx.fill();

  // White-hot core
  ctx.fillStyle = 'rgba(255, 252, 230, 0.9)';
  ctx.beginPath();
  ctx.ellipse(fx, fBase - flameH * 0.3, fw * 0.3, flameH * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ===========================================
// MAIN COMPONENT
// ===========================================

export function WatchlistPhoneTexture({
  meshRef,
  justLitOffering = null,
  stakingEvents = null,      // { type: 'STAKE'|'UNSTAKE'|'CLAIM', amount, user }
  tradeAlerts = null,        // { action, asset, leverage, pnl }
  candleCount = 0,
  totalBurned = 0,
  totalStaked = 0,
  onlineCount = 0,
  user = null,
}) {
  const canvasRef = useRef(document.createElement('canvas'));
  const textureRef = useRef();
  const materialRef = useRef();
  const canvasContextRef = useRef(null);
  // Device-pixel supersampling factor for the canvas. All drawing code
  // works in logical 640×1280 coords; drawWatchlist applies this as a
  // base transform.
  const texScaleRef = useRef(1);
  
  // Activity feed state
  const [activities, setActivities] = useState([]);
  // 'ALL' so the vigil's candles interleave with her X mentions — the
  // feed reads as Our Lady scrolling both her notifications AND the
  // intentions of the faithful.
  const [activeTab, setActiveTab] = useState('ALL');
  const [breakthroughEvent, setBreakthroughEvent] = useState(null);

  // Live time display state
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Prayer Received notification state
  const [showPrayerReceived, setShowPrayerReceived] = useState(false);
  const [currentNotification, setCurrentNotification] = useState(null);
  const notificationImagesRef = useRef({});
  
  // User avatar cache for activity items
  const activityAvatarsRef = useRef({});
  const screenshotImagesRef = useRef({});
  // Holder profile avatars for vigil candle rows — the votive label
  // image lives in activityAvatarsRef; this is the human in the
  // avatar slot.
  const candleAvatarsRef = useRef({});
  // Votive prefs (saint image) per shrine-candle holder, fetched once
  // per userId per session.
  const votivePrefsCacheRef = useRef({});

  // Illumin80 badge state
  const [illumin80UserIds, setIllumin80UserIds] = useState(new Set());
  const illumin80BadgeRef = useRef(null);
  
  // Background image ref
  const backgroundImageRef = useRef(null);
  
  // Avatar image ref
  const avatarImageRef = useRef(null);
  
  // Scroll state
  const scrollPositionRef = useRef(0);
  const targetScrollRef = useRef(0);
  const lastUpdateTimeRef = useRef(Date.now());
  const autoScrollTimerRef = useRef(null);
  
  // Touch/interaction state
  const isScrollingRef = useRef(false);

  // ===========================================
  // ILLUMIN80 BADGE SETUP
  // ===========================================

  // Fetch Illumin80 top burners and load badge image
  useEffect(() => {
    // Load the badge image
    const badgeImg = new Image();
    badgeImg.crossOrigin = 'anonymous';
    badgeImg.onload = () => {
      illumin80BadgeRef.current = badgeImg;
    };
    badgeImg.src = '/images/ILLUMIN80_TATTOO.webp';

    // Fetch top 20 burners from userStats
    const fetchIllumin80 = async () => {
      try {
        const leaderboardQuery = query(
          collection(db, 'userStats'),
          orderBy('totalBurned', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(leaderboardQuery);
        const userIds = new Set();
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.userId) {
            userIds.add(data.userId);
          }
        });
        setIllumin80UserIds(userIds);
      } catch (err) {
        console.warn('Failed to fetch Illumin80 leaderboard:', err);
      }
    };

    fetchIllumin80();
  }, []);

  // ===========================================
  // CLICK HANDLING FOR TABS
  // ===========================================
  
  
  // Click handling on the 3D mesh (tabs removed — single XPOSTS view)
  useEffect(() => {
    if (meshRef && meshRef.material) {
      meshRef.userData.onWatchlistClick = (uv) => {
        return false;
      };
    }
  }, [meshRef]);
  
  // ===========================================
  // PRAYER RECEIVED NOTIFICATION HANDLER
  // ===========================================
  
  useEffect(() => {
    if (justLitOffering) {
      // Create notification object
      const notification = {
        id: `candle-${Date.now()}`,
        username: justLitOffering.name || 'Anonymous',
        userImageUrl: justLitOffering.userImageUrl,
        tokensBurned: justLitOffering.tokensBurned || justLitOffering.amount || '1',
        message: justLitOffering.message || justLitOffering.prayer || '',
        timestamp: Date.now()
      };
      
      
      // Load user image if available
      if (notification.userImageUrl) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          notificationImagesRef.current[notification.id] = img;
        };
        img.src = notification.userImageUrl;
      }
      
      // Show prayer received screen
      setCurrentNotification(notification);
      setShowPrayerReceived(true);
      
      // Hide after 5 seconds
      setTimeout(() => {
        setShowPrayerReceived(false);
        setCurrentNotification(null);
      }, 5000);
    }
  }, [justLitOffering]);
  
  // ===========================================
  // LOAD USER AVATARS FOR ACTIVITIES
  // ===========================================

  useEffect(() => {
    // Load avatars for all activities that have userImageUrl
    activities.forEach(activity => {
      // Skip if already loaded, loading, or marked as failed
      if (!activity.userImageUrl || activityAvatarsRef.current.hasOwnProperty(activity.id)) {
        return;
      }

      // Mark as loading to prevent duplicate attempts
      activityAvatarsRef.current[activity.id] = 'loading';

      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        activityAvatarsRef.current[activity.id] = img;
        // Force a redraw when avatar loads
        if (textureRef.current) {
          textureRef.current.needsUpdate = true;
        }
      };

      img.onerror = () => {
        // Try again without crossOrigin (some servers don't support CORS but still allow loading)
        const imgNoCors = new Image();
        imgNoCors.onload = () => {
          activityAvatarsRef.current[activity.id] = imgNoCors;
          if (textureRef.current) {
            textureRef.current.needsUpdate = true;
          }
        };
        imgNoCors.onerror = () => {
          // Mark as failed permanently
          activityAvatarsRef.current[activity.id] = 'failed';
        };
        imgNoCors.src = activity.userImageUrl;
      };

      img.src = activity.userImageUrl;
    });
  }, [activities]);

  // ===========================================
  // LOAD HOLDER AVATARS FOR CANDLE ROWS
  // ===========================================

  useEffect(() => {
    activities.forEach(activity => {
      if (activity.type !== 'CANDLE' || !activity.avatarUrl) return;
      if (candleAvatarsRef.current.hasOwnProperty(activity.id)) return;

      candleAvatarsRef.current[activity.id] = 'loading';

      const img = new Image();
      // No non-CORS retry here: a tainted canvas can't upload to the
      // WebGL texture, so a CORS-blocked avatar must fail to the
      // initial circle instead.
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        candleAvatarsRef.current[activity.id] = img;
        if (textureRef.current) textureRef.current.needsUpdate = true;
      };
      img.onerror = () => {
        candleAvatarsRef.current[activity.id] = 'failed';
      };
      img.src = activity.avatarUrl;
    });
  }, [activities]);

  // ===========================================
  // LOAD SCREENSHOT IMAGES FOR XPOSTS
  // ===========================================

  useEffect(() => {
    activities.forEach(activity => {
      if (activity.type !== 'XPOST' || !activity.screenshotUrl) return;
      if (screenshotImagesRef.current.hasOwnProperty(activity.id)) return;

      screenshotImagesRef.current[activity.id] = 'loading';

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        screenshotImagesRef.current[activity.id] = img;
        if (textureRef.current) textureRef.current.needsUpdate = true;
      };
      img.onerror = () => {
        screenshotImagesRef.current[activity.id] = 'failed';
      };
      img.src = activity.screenshotUrl;
    });
  }, [activities]);

  // ===========================================
  // CANVAS & TEXTURE INITIALIZATION
  // ===========================================
  
  useEffect(() => {
    const canvas = canvasRef.current;
    // 2× supersample on desktop so the texture stays crisp when the
    // camera gets close to the phone. Mobile keeps 1× — the canvas is
    // re-uploaded to the GPU every frame, and 2× quadruples that
    // bandwidth.
    const scale = window.matchMedia?.('(pointer: coarse)')?.matches ? 1 : 2;
    texScaleRef.current = scale;
    canvas.width = 640 * scale;
    canvas.height = 1280 * scale;
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.flipY = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.anisotropy = 16;
    textureRef.current = texture;
    
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.FrontSide,
      transparent: false,
      toneMapped: true,
      color: 0xeeeeee,
    });
    materialRef.current = material;
    
    if (meshRef && materialRef.current) {
      meshRef.material = materialRef.current;
    }
    
    return () => {
      if (texture && !texture.disposed) texture.dispose();
      if (material && material.dispose) material.dispose();
    };
  }, [meshRef]);
  
  // ===========================================
  // LOAD INITIAL DATA & SUBSCRIBE
  // ===========================================
  
  useEffect(() => {
    let cancelled = false;
    // Subscribe to the LIVE shrine candles — the same data the landing
    // page's ticker and vigil wall use. Each burning candle becomes a
    // CANDLE feed item carrying the holder's saint image (votive prefs)
    // and their dedication, so the phone literally shows the vigil.
    // (Replaced the legacy `offerings` source, which has been stale
    // since the shrine moved to shrineCandles.)
    const candlesRef = collection(db, 'shrineCandles');
    const q = query(candlesRef, orderBy('litAt', 'desc'), limit(20));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const docs = [];
      snapshot.forEach((d) => docs.push({ id: d.id, ...d.data() }));

      // Resolve votive saint images. Preset paths only — custom uploads
      // are stored as ~900KB data: URLs and a feed must not pull
      // megabytes of them; those fall back to the default saint.
      await Promise.all(
        docs.map(async (c) => {
          if (votivePrefsCacheRef.current[c.id] !== undefined) return;
          try {
            const snap = await getDoc(doc(db, 'shrineCandlePrefs', c.id));
            votivePrefsCacheRef.current[c.id] = snap.exists() ? snap.data() : null;
          } catch {
            votivePrefsCacheRef.current[c.id] = null;
          }
        }),
      );
      if (cancelled) return;

      const newActivities = docs.map((c) => {
        const prefs = votivePrefsCacheRef.current[c.id];
        const image =
          prefs?.votiveImage && prefs.votiveImage.startsWith('/')
            ? prefs.votiveImage
            : '/images/nuestraSenora.webp';
        const dedication = intentionText(c.intention);
        return {
          id: `vigil-${c.id}`,
          type: 'CANDLE',
          username: c.displayName || 'a pilgrim',
          userId: c.id,
          userImageUrl: image,
          // Holder's profile picture for the avatar slot — most candle
          // docs carry avatarUrl: null today, so this usually falls
          // back to the wax-tinted initial circle.
          avatarUrl: c.avatarUrl || null,
          // Shown in place of the generic verb when the holder dedicated
          // their flame.
          feedLine: dedication ? `Lit a candle ${dedication}` : null,
          waxTint: prefs?.votiveTint || null,
          // Verified on-chain burn credited by /api/burn-offering — the
          // flex. Admin-SDK-written; firestore.rules block client forgery.
          tokensBurned:
            typeof c.tokensBurned === 'number' && c.tokensBurned > 0
              ? c.tokensBurned
              : 0,
          amount: 1,
          timestamp: c.litAt?.toMillis?.() || Date.now(),
          isNew: false,
        };
      });

      setActivities(prev => {
        const others = prev.filter(a => a.type !== 'CANDLE');
        const merged = [...newActivities, ...others];
        return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
      });
    }, (error) => {
      console.error('Error fetching shrine candles:', error);
    });
    
    // Subscribe to Firebase stakes
    const stakesRef = collection(db, 'stakes');
    const stakesQuery = query(stakesRef, orderBy('createdAt', 'desc'), limit(30));
    
    const unsubscribeStakes = onSnapshot(stakesQuery, (snapshot) => {
      const stakingActivities = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Determine staking action type
        let actionType = 'STAKE';
        if (data.action === 'unstake') actionType = 'UNSTAKE';
        if (data.action === 'claim') actionType = 'CLAIM';
        
        stakingActivities.push({
          id: doc.id,
          type: actionType,
          username: data.name || truncateAddress(data.walletAddress),
          userId: data.userId,
          userImageUrl: data.userImageUrl,
          amount: parseFloat(data.amount) || 0,
          timestamp: data.createdAt?.toMillis?.() || Date.now(),
          isNew: false,
        });
      });
      
      if (stakingActivities.length > 0) {
        setActivities(prev => {
          // Merge with existing candle activities
          const otherActivities = prev.filter(a => !['STAKE', 'UNSTAKE', 'CLAIM'].includes(a.type));
          const merged = [...otherActivities, ...stakingActivities];
          return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
        });
      }
    }, (error) => {
      console.error('Error fetching stakes:', error);
    });

    // Subscribe to Firebase xPosts
    const xPostsRef = collection(db, 'xPost');
    const xPostsQuery = query(xPostsRef, orderBy('createdAt', 'desc'), limit(20));

    const unsubscribeXPosts = onSnapshot(xPostsQuery, (snapshot) => {
      const xPostActivities = [];

      snapshot.forEach((doc) => {
        if (doc.id === '_meta') return; // Skip metadata doc
        const data = doc.data();
        xPostActivities.push({
          id: doc.id,
          type: 'XPOST',
          username: data.author || 'Unknown',
          handle: data.handle || '',
          tweetText: data.text || '',
          replyText: data.replyText || '',
          replyHandle: data.replyHandle || '',
          tweetUrl: data.tweetUrl || '',
          userImageUrl: data.authorImageUrl || '',
          screenshotUrl: data.screenshotUrl || '',
          amount: 0,
          timestamp: data.createdAt?.toMillis?.() || Date.now(),
          isNew: false,
        });
      });

      if (xPostActivities.length > 0) {
        setActivities(prev => {
          const nonXPostActivities = prev.filter(a => a.type !== 'XPOST');
          const merged = [...nonXPostActivities, ...xPostActivities];
          return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
        });
      }
    }, (error) => {
      console.error('Error fetching xPosts:', error);
    });

    return () => {
      cancelled = true;
      unsubscribe();
      unsubscribeStakes();
      unsubscribeXPosts();
    };
  }, []);
  
  // ===========================================
  // HANDLE NEW CANDLE LIT
  // ===========================================
  
  useEffect(() => {
    if (!justLitOffering) return;

    const newActivity = {
      id: `candle-${Date.now()}`,
      type: 'CANDLE',
      username: justLitOffering.name || user?.firstName || 'You',
      userId: justLitOffering.userId,
      userImageUrl: justLitOffering.userImageUrl,
      avatarUrl: justLitOffering.userImageUrl || null,
      prayerType: justLitOffering.type || 'petition', // petition, confession, appreciation
      amount: parseInt(justLitOffering.tokensBurned) || 1,
      timestamp: Date.now(),
      isNew: true,
    };

    setActivities(prev => {
      // Check for duplicate (same user, same type, within 5 seconds)
      const isDuplicate = prev.some(a =>
        a.type === 'CANDLE' &&
        a.userId === newActivity.userId &&
        Math.abs(a.timestamp - newActivity.timestamp) < 5000
      );
      if (isDuplicate) return prev;
      return [newActivity, ...prev].slice(0, 50);
    });
    
    // Scroll to top to show new item
    targetScrollRef.current = 0;
    
    // Remove "new" flag after highlight duration
    setTimeout(() => {
      setActivities(prev => 
        prev.map(a => a.id === newActivity.id ? { ...a, isNew: false } : a)
      );
    }, CONFIG.NEW_ITEM_HIGHLIGHT_DURATION);
    
  }, [justLitOffering, user]);
  
  // ===========================================
  // HANDLE STAKING EVENTS
  // ===========================================
  
  useEffect(() => {
    if (!stakingEvents) return;
    
    const newActivity = {
      id: `staking-${Date.now()}`,
      type: stakingEvents.type, // STAKE | UNSTAKE | CLAIM
      username: stakingEvents.user?.name || truncateAddress(stakingEvents.user?.address),
      amount: stakingEvents.amount,
      timestamp: Date.now(),
      isNew: true,
    };
    
    setActivities(prev => [newActivity, ...prev].slice(0, 50));
    targetScrollRef.current = 0;
    
    setTimeout(() => {
      setActivities(prev =>
        prev.map(a => a.id === newActivity.id ? { ...a, isNew: false } : a)
      );
    }, CONFIG.NEW_ITEM_HIGHLIGHT_DURATION);
    
  }, [stakingEvents]);
  
  // ===========================================
  // HANDLE TRADE ALERTS (BREAKTHROUGH)
  // ===========================================
  
  useEffect(() => {
    if (!tradeAlerts) return;
    
    let text = '';
    let icon = '';
    
    switch (tradeAlerts.action) {
      case 'LONG':
        icon = '📈';
        text = `${icon} Our Lady opened ${tradeAlerts.leverage} LONG on ${tradeAlerts.asset}`;
        break;
      case 'SHORT':
        icon = '📉';
        text = `${icon} Our Lady opened ${tradeAlerts.leverage} SHORT on ${tradeAlerts.asset}`;
        break;
      case 'CLOSE':
        icon = tradeAlerts.pnl?.startsWith('+') ? '💰' : '📊';
        text = `${icon} Position closed: ${tradeAlerts.asset} ${tradeAlerts.pnl}`;
        break;
      default:
        return;
    }
    
    setBreakthroughEvent({
      id: `trade-${Date.now()}`,
      type: 'TRADE',
      text,
      timestamp: Date.now(),
    });
    
    setTimeout(() => {
      setBreakthroughEvent(null);
    }, CONFIG.BREAKTHROUGH_DURATION);
    
  }, [tradeAlerts]);
  
  // Load background image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      backgroundImageRef.current = img;
    };
    img.src = '/images/screen1flat.svg';
  }, []);
  
  // Load avatar image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      avatarImageRef.current = img;
    };
    img.src = '/images/coinFront1.png';
  }, []);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);
  
  // ===========================================
  // FILTER ACTIVITIES BY TAB
  // ===========================================

  const tabActivities = activities.filter(activity => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'CANDLES') return activity.type === 'CANDLE';
    if (activeTab === 'STAKING') return ['STAKE', 'UNSTAKE', 'CLAIM'].includes(activity.type);
    if (activeTab === 'XPOSTS') return activity.type === 'XPOST';
    return true;
  });

  // Interleave the vigil candles with the post notifications. A strict
  // timestamp sort clumps them into two blocks (the posts are usually
  // older than the live candles), so instead spread the two streams
  // evenly through each other — each keeps its own newest-first order,
  // and just-lit candles stay pinned to the top.
  const freshItems = tabActivities.filter(a => a.isNew);
  const candleStream = tabActivities.filter(a => !a.isNew && a.type === 'CANDLE');
  const postStream = tabActivities.filter(a => !a.isNew && a.type !== 'CANDLE');
  const filteredActivities = [...freshItems];
  let ci = 0;
  let pi = 0;
  while (ci < candleStream.length || pi < postStream.length) {
    const takeCandle =
      pi >= postStream.length ||
      (ci < candleStream.length &&
        ci * postStream.length <= pi * candleStream.length);
    filteredActivities.push(takeCandle ? candleStream[ci++] : postStream[pi++]);
  }
  
  // ===========================================
  // DRAW PRAYER RECEIVED NOTIFICATION
  // ===========================================
  
  const drawPrayerReceived = useCallback((ctx, width, height, notification) => {
    // Save context and apply horizontal flip to match texture mapping
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-width, 0);
    
    // Fully opaque dark purple background to completely cover watchlist
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#1a0033');
    bgGradient.addColorStop(0.5, '#2d1b69');
    bgGradient.addColorStop(1, '#1a0033');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
    
    const centerX = width / 2;
    const centerY = height / 2 - 120; // Move content higher up
    
    // Draw glowing circle effect on top of background
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 250);
    gradient.addColorStop(0, 'rgba(139, 43, 226, 0.8)');
    gradient.addColorStop(0.5, 'rgba(139, 43, 226, 0.4)');
    gradient.addColorStop(1, 'rgba(139, 43, 226, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Draw large flame icon
    ctx.fillStyle = '#ffeb3b';
    ctx.font = 'bold 180px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔥', centerX, centerY - 80);
    
    // Draw "PRAYER RECEIVED" text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 56px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('MESSAGE RECEIVED', centerX, centerY + 40);
    
    // Draw user avatar or initial
    const avatarSize = 100;
    const avatarY = centerY + 120;
    
    // Check if we have a loaded image for this notification
    const userImage = notificationImagesRef.current[notification.id];
    
    if (userImage && userImage.complete) {
      // Draw actual user image
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, avatarY, avatarSize/2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      
      // Draw the image
      ctx.drawImage(userImage, centerX - avatarSize/2, avatarY - avatarSize/2, avatarSize, avatarSize);
      ctx.restore();
      
      // Draw border around avatar
      ctx.strokeStyle = '#ffeb3b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(centerX, avatarY, avatarSize/2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Draw initial in circle
      ctx.fillStyle = '#ffeb3b';
      ctx.beginPath();
      ctx.arc(centerX, avatarY, avatarSize/2, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#1a0033';
      ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      const initial = notification.username ? nameInitial(notification.username) : '🙏';
      ctx.fillText(initial, centerX, avatarY + 16);
    }
    
    // Draw username below avatar
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(notification.username, centerX, avatarY + avatarSize + 20);
    
    // Draw tokens burned
    ctx.fillStyle = '#ffeb3b';
    ctx.font = '28px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`${notification.tokensBurned} RL80 burned`, centerX, avatarY + avatarSize + 55);
    
    // Restore context
    ctx.restore();
  }, []);
  
  // ===========================================
  // DRAW WATCHLIST INTERFACE
  // ===========================================
  
  const drawWatchlist = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvasContextRef.current) {
      canvasContextRef.current = canvas.getContext('2d', {
        alpha: false,
        desynchronized: false,
        willReadFrequently: false
      });
    }
    const ctx = canvasContextRef.current;
    // Logical coordinate space — the supersample factor is baked into
    // the base transform, so every draw call below stays in 640×1280.
    const scale = texScaleRef.current;
    const width = canvas.width / scale;
    const height = canvas.height / scale;

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Check if we should show prayer received notification
    if (showPrayerReceived && currentNotification) {
      // Draw prayer notification WITHOUT the flip transform
      drawPrayerReceived(ctx, width, height, currentNotification);
      if (textureRef.current) {
        textureRef.current.needsUpdate = true;
      }
      return;
    }
    
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-width, 0);
    
    // ===========================================
    // BACKGROUND
    // ===========================================
    
    // Pure black — X "Lights Out" theme, matching the real account
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
    
    // Reset text alignment for content below
    ctx.textAlign = 'left';

    // ===========================================
    // STATUS BAR - LIVE TIME DISPLAY
    // ===========================================

    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const formattedTime = `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')}`;

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(formattedTime, 48, 52);

    // iOS system icons, right-aligned: signal bars, wifi, battery
    const sbY = 50;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 4; i++) {
      const barH = 8 + i * 5;
      ctx.beginPath();
      ctx.roundRect(width - 178 + i * 11, sbY - barH, 7, barH, 2);
      ctx.fill();
    }

    const wifiX = width - 112;
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.lineWidth = 5;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.arc(wifiX, sbY, 10 + i * 9, Math.PI * 1.25, Math.PI * 1.75);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(wifiX, sbY - 3, 4, 0, Math.PI * 2);
    ctx.fill();

    const batX = width - 84;
    const batY = sbY - 23;
    ctx.beginPath();
    ctx.roundRect(batX, batY, 52, 25, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(batX + 54, batY + 7, 4, 11, 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('99', batX + 26, batY + 19);

    // ===========================================
    // X NOTIFICATIONS HEADER (avatar / title / gear)
    // ===========================================

    const headerY = 126;
    const avatarSize = 60;
    const avatarX = 72;

    // Account avatar — small, borderless, like the real app
    if (avatarImageRef.current) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, headerY, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(
        avatarImageRef.current,
        avatarX - avatarSize / 2,
        headerY - avatarSize / 2,
        avatarSize,
        avatarSize
      );
      ctx.restore();
    }

    // Centered title
    ctx.fillStyle = '#e7e9ea';
    ctx.font = 'bold 40px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Notifications', width / 2, headerY + 14);

    // Settings gear on the right
    drawGear(ctx, width - 66, headerY, 21);

    // ===========================================
    // TAB BAR — All | Mentions (All active)
    // ===========================================

    const tabsBaselineY = 208;
    ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e7e9ea';
    ctx.fillText('All', width / 4, tabsBaselineY);
    ctx.fillStyle = '#71767b';
    ctx.fillText('Mentions', (3 * width) / 4, tabsBaselineY);

    // Active-tab underline in X blue
    ctx.fillStyle = '#1d9bf0';
    ctx.beginPath();
    ctx.roundRect(width / 4 - 34, tabsBaselineY + 14, 68, 7, 4);
    ctx.fill();

    // Hairline divider under the tab bar
    ctx.fillStyle = '#2f3336';
    ctx.fillRect(0, tabsBaselineY + 26, width, 2);

    ctx.textAlign = 'left';
    
    // ===========================================
    // ACTIVITY FEED
    // ===========================================

    const feedStartY = 245;
    const feedEndY = height - 100;
    const feedHeight = feedEndY - feedStartY;
    
    // Clip to feed area
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, feedStartY, width, feedHeight);
    ctx.clip();
    
    let currentY = feedStartY - scrollPositionRef.current + 10;
    
    // Check if we need to draw breakthrough event
    const hasBreakthrough = breakthroughEvent && (Date.now() - breakthroughEvent.timestamp < CONFIG.BREAKTHROUGH_DURATION);
    
    if (hasBreakthrough) {
      // Draw breakthrough event banner
      const breakthroughY = feedStartY + 10;
      const breakthroughHeight = 60;
      
      // Animated glow
      const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
      
      // Glow effect
      ctx.shadowColor = `rgba(255, 215, 0, ${0.3 + pulse * 0.3})`;
      ctx.shadowBlur = 20;
      
      // Background
      const btGradient = ctx.createLinearGradient(20, breakthroughY, width - 20, breakthroughY);
      btGradient.addColorStop(0, '#ffd700');
      btGradient.addColorStop(0.5, '#ffaa00');
      btGradient.addColorStop(1, '#ffd700');
      
      ctx.fillStyle = btGradient;
      ctx.beginPath();
      ctx.roundRect(20, breakthroughY, width - 40, breakthroughHeight, 12);
      ctx.fill();
      
      ctx.shadowBlur = 0;
      
      // Text
      ctx.fillStyle = '#000';
      ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(breakthroughEvent.text, width / 2, breakthroughY + 38);
      ctx.textAlign = 'left';
      
      // Offset the rest of the feed
      currentY += breakthroughHeight + 15;
    }
    
    // Draw activity items
    filteredActivities.forEach((activity, index) => {
      const hasScreenshot = activity.type === 'XPOST' && activity.screenshotUrl && screenshotImagesRef.current[activity.id] instanceof Image;
      // Hide XPOST items while their screenshot is still loading to prevent "Unknown" flash
      if (activity.type === 'XPOST' && activity.screenshotUrl && !hasScreenshot) {
        return;
      }
      let itemHeight = CONFIG.ITEM_HEIGHT;
      if (hasScreenshot) {
        const ss = screenshotImagesRef.current[activity.id];
        const ssDisplayW = width - 40;
        const ssDisplayH = ssDisplayW / (ss.naturalWidth / ss.naturalHeight);
        itemHeight = ssDisplayH; // Full image height, no cap
      } else if (activity.type === 'XPOST' && activity.replyText) {
        itemHeight = 200; // Taller card for reply pairs
      } else if (activity.type === 'CANDLE' && activityAvatarsRef.current[activity.id] instanceof Image) {
        // Expanded vigil row — once the votive label image is in, the
        // candle renders centered like an attached image.
        itemHeight = CONFIG.CANDLE_ITEM_HEIGHT;
      }
      const itemY = currentY;
      
      // Skip if not visible
      if (itemY + itemHeight < feedStartY - 50 || itemY > feedEndY + 50) {
        currentY += itemHeight + CONFIG.ITEM_GAP;
        return;
      }

      // XPOST with screenshot: draw just the image, no card frame
      if (hasScreenshot) {
        const screenshot = screenshotImagesRef.current[activity.id];
        const ssW = width - 40;
        const ssH = ssW / (screenshot.naturalWidth / screenshot.naturalHeight);

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(20, itemY, ssW, ssH, 10);
        ctx.clip();
        ctx.drawImage(screenshot, 20, itemY, ssW, ssH);
        ctx.restore();

        // Hairline separator between rows
        ctx.fillStyle = '#2f3336';
        ctx.fillRect(0, itemY + itemHeight + CONFIG.ITEM_GAP / 2, width, 1);

        currentY += itemHeight + CONFIG.ITEM_GAP;
        return;
      }

      const tier = getActivityTier(activity.type, activity.amount);
      const style = getTierStyle(tier);
      const activityType = ACTIVITY_TYPES[activity.type];

      // Flat black rows like the real notifications feed — no card
      // fill; unread items get X's faint blue tint instead of a pulse.
      if (activity.isNew) {
        ctx.fillStyle = 'rgba(29, 155, 240, 0.08)';
        ctx.fillRect(0, itemY - CONFIG.ITEM_GAP / 2, width, itemHeight + CONFIG.ITEM_GAP);
      }
      
      // Emoji removed - shown in prayer type badge instead
      
      // User avatar (if available) - bigger size
      const avatarSize = 70;
      const avatarX = 70;
      let usernameX = 130; // Default position if no avatar

      const userAvatar = activityAvatarsRef.current[activity.id];
      // Check if it's an actual Image object (not 'loading' or 'failed' strings)
      const isImageLoaded = userAvatar && userAvatar instanceof Image;
      // Expanded vigil rows pin the avatar to the header line;
      // everything else stays vertically centered in its row.
      const isBigCandle = activity.type === 'CANDLE' && isImageLoaded;
      const avatarY = isBigCandle ? itemY + 42 : itemY + itemHeight / 2;

      if (isBigCandle) {
        const tint =
          activity.waxTint || fallbackTintFor(activity.userId || activity.id);

        // Holder's avatar in the usual left slot (X-style, borderless);
        // wax-tinted initial circle when they never set one.
        const holderAvatar = candleAvatarsRef.current[activity.id];
        if (holderAvatar instanceof Image) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(
            holderAvatar,
            avatarX - avatarSize / 2,
            avatarY - avatarSize / 2,
            avatarSize,
            avatarSize
          );
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalAlpha = 0.28;
          ctx.fillStyle = tint;
          ctx.beginPath();
          ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          ctx.fillStyle = tint;
          ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(nameInitial(activity.username), avatarX, avatarY + 2);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
        }
        usernameX = avatarX + avatarSize / 2 + 12;

        // The votive itself — the holder's saint image as the jar
        // label, their wax tint up top, live flickering flame —
        // centered in the post like an attached image, inside a faint
        // X-style media card.
        const cardW = 208;
        const cardH = 220;
        const cardX = (width - cardW) / 2;
        const cardY = itemY + 82;
        ctx.fillStyle = '#101214';
        ctx.strokeStyle = '#2f3336';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 16);
        ctx.fill();
        ctx.stroke();

        // Scale the whole drawing instead of passing bigger w/h so the
        // trim, glass shading, and flame keep their tuned small-size
        // proportions.
        const vScale = 2.0;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 16);
        ctx.clip();
        ctx.translate(width / 2, cardY + cardH / 2 + 8);
        ctx.scale(vScale, vScale);
        drawVotiveCandle(
          ctx,
          0,
          0,
          40,
          84,
          userAvatar,
          tint,
          index,
          activity.tokensBurned > 0,
        );
        ctx.restore();
      } else if (isImageLoaded) {
        // Draw avatar image
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(
          userAvatar,
          avatarX - avatarSize / 2,
          avatarY - avatarSize / 2,
          avatarSize,
          avatarSize
        );
        ctx.restore();

        // Draw border around avatar
        ctx.strokeStyle = style.borderColor || activityType.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.stroke();

        usernameX = avatarX + avatarSize / 2 + 12; // Position username after avatar
      } else if (activity.userImageUrl) {
        // Avatar is loading or failed, draw placeholder circle with initial
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw border
        ctx.strokeStyle = style.borderColor || activityType.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.stroke();

        // Draw initial in circle
        ctx.fillStyle = style.textColor;
        ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(nameInitial(activity.username), avatarX, avatarY);

        usernameX = avatarX + avatarSize / 2 + 10;
      }
      
      // Username
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#e7e9ea';
      ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(activity.username, usernameX, itemY + 35);

      // Illumin80 badge (if user is in top 20 burners)
      if (activity.userId && illumin80UserIds.has(activity.userId) && illumin80BadgeRef.current) {
        const badgeSize = 36;
        const usernameWidth = ctx.measureText(activity.username).width;
        const badgeX = usernameX + usernameWidth + 8;
        const badgeY = itemY + 35 - badgeSize + 8;
        ctx.drawImage(illumin80BadgeRef.current, badgeX, badgeY, badgeSize, badgeSize);
      }

      // Time ago (top right)
      ctx.fillStyle = '#71767b';
      ctx.font = '20px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatTimeAgo(activity.timestamp), width - 40, itemY + 35);
      
      if (activity.type === 'XPOST') {
        // Show @handle next to username
        if (activity.handle) {
          // Measure in the bold font the username was actually drawn
          // in — the context is still on the 20px timestamp font here,
          // which under-measures and overlapped the handle onto the name.
          ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, sans-serif';
          const usernameWidth = ctx.measureText(activity.username).width;
          ctx.fillStyle = '#8899a6';
          ctx.font = '20px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(`@${activity.handle}`, usernameX + usernameWidth + 8, itemY + 35);
        }

        // X badge (top right, before time)
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('𝕏', width - 90, itemY + 35);

        // Check for screenshot image
        const screenshot = screenshotImagesRef.current[activity.id];
        const hasLoadedScreenshot = screenshot instanceof Image;

        if (hasLoadedScreenshot) {
          // Draw screenshot below the header, fit to full width
          const ssPad = 15;
          const ssX = 20 + ssPad;
          const ssY = itemY + 75;
          const ssW = width - 40 - ssPad * 2;
          const ssH = ssW / (screenshot.naturalWidth / screenshot.naturalHeight);

          // Draw with rounded corners
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(ssX, ssY, ssW, ssH, 8);
          ctx.clip();
          ctx.drawImage(screenshot, ssX, ssY, ssW, ssH);
          ctx.restore();
        } else if (activity.replyText) {
          // Reply pair: show source tweet + agent reply
          const textX = usernameX;
          const maxTextWidth = width - textX - 40;

          // Source tweet text (wrap up to 2 lines)
          ctx.fillStyle = '#e1e8ed';
          ctx.font = '19px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.textAlign = 'left';
          const srcLines = wrapText(ctx, activity.tweetText || '', maxTextWidth, 2);
          let textY = itemY + 58;
          srcLines.forEach(line => {
            ctx.fillText(line, textX, textY);
            textY += 24;
          });

          // Divider line
          textY += 6;
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(textX, textY);
          ctx.lineTo(width - 40, textY);
          ctx.stroke();
          textY += 12;

          // Reply label
          ctx.fillStyle = '#1d9bf0';
          ctx.font = 'bold 17px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.fillText(`@${activity.replyHandle}`, textX, textY);
          textY += 22;

          // Reply text (wrap up to 3 lines)
          ctx.fillStyle = '#ccd6dd';
          ctx.font = '19px -apple-system, BlinkMacSystemFont, sans-serif';
          const replyLines = wrapText(ctx, activity.replyText, maxTextWidth, 3);
          replyLines.forEach(line => {
            ctx.fillText(line, textX, textY);
            textY += 24;
          });
        } else {
          // Fallback: show tweet text only (no reply)
          ctx.fillStyle = '#e1e8ed';
          ctx.font = '20px -apple-system, BlinkMacSystemFont, sans-serif';
          ctx.textAlign = 'left';
          const maxTextWidth = width - usernameX - 50;
          let displayText = activity.tweetText || '';
          if (ctx.measureText(displayText).width > maxTextWidth) {
            while (ctx.measureText(displayText + '...').width > maxTextWidth && displayText.length > 0) {
              displayText = displayText.slice(0, -1);
            }
            displayText += '...';
          }
          ctx.fillText(displayText, usernameX, itemY + 62);
        }
      } else {
        // Action description (align with username)
        ctx.textAlign = 'left';
        ctx.fillStyle = '#71767b';
        ctx.font = '22px -apple-system, BlinkMacSystemFont, sans-serif';

        ctx.fillText(activity.feedLine || activityType.verb, usernameX, itemY + 62);

        // Amount (bottom right)
        const isBurnFlex =
          activity.type === 'CANDLE' && activity.tokensBurned > 0;
        ctx.textAlign = 'right';
        ctx.fillStyle = isBurnFlex ? '#ffd700' : activityType.color;
        ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';

        // Candles show the glyph rather than a meaningless "+1" —
        // unless the holder burned an offering, which IS the flex.
        const amountText = activity.type === 'CANDLE'
          ? isBurnFlex
            ? `🔥 ${formatAmount(activity.tokensBurned, 'STAKE')} RL80`
            : '🕯️'
          : `${activity.type === 'UNSTAKE' ? '-' : '+'}${formatAmount(activity.amount, activity.type)} ${activityType.unit}`;
        ctx.fillText(amountText, width - 40, itemY + 62);

        // Prayer type badge (for candles only)
        if (activity.type === 'CANDLE' && activity.prayerType) {
          const typeConfig = {
            petition: { icon: '🙏', color: '#ffaa00', label: 'PETITION' },
            confession: { icon: '🖤', color: '#aa66ff', label: 'CONFESSION' },
            appreciation: { icon: '✨', color: '#00ff66', label: 'APPRECIATION' }
          };
          const config = typeConfig[activity.prayerType] || typeConfig.petition;

          // Draw prayer type badge on the right side
          const badgeText = `${config.icon} ${config.label}`;
          ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';

          // Measure text for badge background
          const metrics = ctx.measureText(badgeText);
          const badgeX = width - 235;
          const badgeY = itemY + 10;
          const padding = 8;

          // Draw badge background
          ctx.fillStyle = config.color + '22'; // Low opacity background
          ctx.strokeStyle = config.color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, metrics.width + padding * 2, 28, 6);
          ctx.fill();
          ctx.stroke();

          // Draw badge text
          ctx.fillStyle = config.color;
          ctx.textAlign = 'left';
          ctx.fillText(badgeText, badgeX + padding, badgeY + 20);
        }
      }
      
      ctx.textAlign = 'left';

      // Hairline separator between rows
      ctx.fillStyle = '#2f3336';
      ctx.fillRect(0, itemY + itemHeight + CONFIG.ITEM_GAP / 2, width, 1);

      currentY += itemHeight + CONFIG.ITEM_GAP;
    });
    
    // Restore from clip
    ctx.restore();
    
    // ===========================================
    // FOOTER STATS BAR
    // ===========================================
    
    // Footer background
    const footerGradient = ctx.createLinearGradient(0, height - 100, 0, height);
    footerGradient.addColorStop(0, '#111');
    footerGradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = footerGradient;
    ctx.fillRect(0, height - 100, width, 100);
    
    // Top border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 100);
    ctx.lineTo(width, height - 100);
    ctx.stroke();
    
    // Stats
    const statsY = height - 55;
    
    // Candle count
    ctx.fillStyle = '#888';
    ctx.font = '20px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🕯️', 40, statsY);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(formatAmount(candleCount, 'CANDLE'), 70, statsY);
    ctx.fillStyle = '#666';
    ctx.font = '18px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('candles', 40, statsY + 25);
    
    // Divider
    ctx.fillStyle = '#333';
    ctx.fillRect(width / 3, height - 85, 1, 50);
    
    // Tokens burned
    ctx.fillStyle = '#888';
    ctx.font = '20px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🔥', width / 3 + 30, statsY);
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(formatAmount(totalBurned, 'STAKE'), width / 3 + 60, statsY);
    ctx.fillStyle = '#666';
    ctx.font = '18px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('burned', width / 3 + 30, statsY + 25);
    
    // Divider
    ctx.fillStyle = '#333';
    ctx.fillRect(2 * width / 3, height - 85, 1, 50);
    
    // Total staked
    ctx.fillStyle = '#888';
    ctx.font = '20px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('💎', 2 * width / 3 + 30, statsY);
    ctx.fillStyle = '#00bfff';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(formatAmount(totalStaked, 'STAKE'), 2 * width / 3 + 60, statsY);
    ctx.fillStyle = '#666';
    ctx.font = '18px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('staked', 2 * width / 3 + 30, statsY + 25);
    
    // ===========================================
    // UPDATE TEXTURE
    // ===========================================
    
    if (textureRef.current) {
      textureRef.current.needsUpdate = true;
    }
    
    ctx.restore();
  }, [filteredActivities, activeTab, breakthroughEvent, candleCount, totalBurned, totalStaked, onlineCount, showPrayerReceived, currentNotification, drawPrayerReceived, currentTime]);
  
  // ===========================================
  // COMPUTE TOTAL CONTENT HEIGHT
  // ===========================================

  const getTotalContentHeight = useCallback(() => {
    const canvasW = 640;
    return filteredActivities.reduce((sum, a) => {
      let h = CONFIG.ITEM_HEIGHT;
      if (a.type === 'XPOST' && a.screenshotUrl && screenshotImagesRef.current[a.id] instanceof Image) {
        const ss = screenshotImagesRef.current[a.id];
        const ssDisplayW = canvasW - 40;
        const ssDisplayH = ssDisplayW / (ss.naturalWidth / ss.naturalHeight);
        h = ssDisplayH;
      } else if (a.type === 'XPOST' && a.replyText) {
        h = 200;
      } else if (a.type === 'CANDLE' && activityAvatarsRef.current[a.id] instanceof Image) {
        h = CONFIG.CANDLE_ITEM_HEIGHT;
      }
      return sum + h + CONFIG.ITEM_GAP;
    }, 0);
  }, [filteredActivities]);

  // ===========================================
  // AUTO-SCROLL STATE
  // ===========================================

  const autoScrollStateRef = useRef('pausing'); // 'pausing' | 'scrolling' | 'bottom_pause'
  const autoScrollPauseStartRef = useRef(Date.now());

  // Chamber-flick glide (external drive): each impulse animates the
  // scroll with quartic ease-out — snaps into motion the same frame as
  // the thumb's quick pull, covering ~half the distance in the first
  // quarter second, then a long momentum roll to a stop while her
  // thumb drifts back. The generic lerp below is bypassed (position
  // and target are kept equal during the glide).
  const FLICK_GLIDE_MS = 1600;
  const glideFromRef = useRef(0);
  const glideToRef = useRef(0);
  const glideStartRef = useRef(0);
  const glideActiveRef = useRef(false);

  // Reset auto-scroll when tab changes or new items arrive
  useEffect(() => {
    scrollPositionRef.current = 0;
    targetScrollRef.current = 0;
    autoScrollStateRef.current = 'pausing';
    autoScrollPauseStartRef.current = Date.now();
  }, [activeTab]);

  // ===========================================
  // ANIMATION LOOP
  // ===========================================

  useFrame(() => {
    const now = Date.now();

    // Auto-scroll logic for real-phone-like behavior
    const feedVisibleHeight = 1280 - 100 - 245; // feedEndY - feedStartY
    const totalHeight = getTotalContentHeight();
    const maxScroll = Math.max(0, totalHeight - feedVisibleHeight);

    if (maxScroll > 0) {
      if (autoScrollStateRef.current === 'pausing') {
        // Wait at the top before starting to scroll
        if (now - autoScrollPauseStartRef.current > CONFIG.AUTO_SCROLL_PAUSE) {
          autoScrollStateRef.current = 'scrolling';
        }
      } else if (autoScrollStateRef.current === 'scrolling') {
        if (isPhoneScrollExternalDrive()) {
          // Chamber-driven: the content advances only when her thumb
          // flicks (impulses from MaryChamber). Each impulse starts an
          // eased glide; between gestures the feed sits still.
          const impulse = consumePhoneScrollFlick();
          if (impulse > 0) {
            glideFromRef.current = scrollPositionRef.current;
            glideToRef.current = Math.min(
              scrollPositionRef.current + impulse,
              maxScroll,
            );
            glideStartRef.current = now;
            glideActiveRef.current = true;
          }
          if (glideActiveRef.current) {
            const u = Math.min(
              (now - glideStartRef.current) / FLICK_GLIDE_MS,
              1,
            );
            const eased = 1 - Math.pow(1 - u, 4);
            scrollPositionRef.current =
              glideFromRef.current +
              (glideToRef.current - glideFromRef.current) * eased;
            targetScrollRef.current = scrollPositionRef.current;
            if (u >= 1) glideActiveRef.current = false;
          }
          if (scrollPositionRef.current >= maxScroll - 0.5) {
            scrollPositionRef.current = maxScroll;
            targetScrollRef.current = maxScroll;
            glideActiveRef.current = false;
            autoScrollStateRef.current = 'bottom_pause';
            autoScrollPauseStartRef.current = now;
          }
        } else {
          // Slowly scroll down
          scrollPositionRef.current += CONFIG.AUTO_SCROLL_SPEED;
          targetScrollRef.current = scrollPositionRef.current;

          if (scrollPositionRef.current >= maxScroll) {
            scrollPositionRef.current = maxScroll;
            targetScrollRef.current = maxScroll;
            autoScrollStateRef.current = 'bottom_pause';
            autoScrollPauseStartRef.current = now;
          }
        }
      } else if (autoScrollStateRef.current === 'bottom_pause') {
        // Pause at the bottom, then smoothly scroll back to top
        if (now - autoScrollPauseStartRef.current > CONFIG.AUTO_SCROLL_BOTTOM_PAUSE) {
          targetScrollRef.current = 0;
          autoScrollStateRef.current = 'scrolling_up';
        }
      } else if (autoScrollStateRef.current === 'scrolling_up') {
        // Smooth scroll back to top (lerp handled below), then pause
        if (scrollPositionRef.current < 1) {
          scrollPositionRef.current = 0;
          targetScrollRef.current = 0;
          autoScrollStateRef.current = 'pausing';
          autoScrollPauseStartRef.current = now;
        }
      }
    }

    // Broadcast the scroll phase so the chamber's hand animation can
    // flick Our Lady's thumb in sync with the content actually moving.
    publishPhoneScroll(maxScroll > 0 ? autoScrollStateRef.current : 'pausing');

    // Smooth scrolling for manual/programmatic scroll
    if (Math.abs(targetScrollRef.current - scrollPositionRef.current) > 0.5) {
      const speed = autoScrollStateRef.current === 'scrolling_up' ? 0.04 : CONFIG.SCROLL_SPEED;
      scrollPositionRef.current += (targetScrollRef.current - scrollPositionRef.current) * speed;
    }

    // Redraw at ~60fps
    if (now - lastUpdateTimeRef.current > 16) {
      drawWatchlist();
      lastUpdateTimeRef.current = now;
    }
  });
  
  const scrollToTop = useCallback(() => {
    targetScrollRef.current = 0;
  }, []);
  
  const scrollBy = useCallback((delta) => {
    const feedVisibleHeight = 1280 - 100 - 245;
    const totalHeight = getTotalContentHeight();
    const maxScroll = Math.max(0, totalHeight - feedVisibleHeight);
    targetScrollRef.current = Math.max(0, Math.min(maxScroll, targetScrollRef.current + delta));
    // Interrupt auto-scroll when manually scrolling
    autoScrollStateRef.current = 'pausing';
    autoScrollPauseStartRef.current = Date.now() + 5000; // Extra delay before auto-scroll resumes
  }, [getTotalContentHeight]);
  
  return null;
}

// ===========================================
// EXPORTS
// ===========================================

export { CONFIG as WATCHLIST_CONFIG };
export { ACTIVITY_TYPES };