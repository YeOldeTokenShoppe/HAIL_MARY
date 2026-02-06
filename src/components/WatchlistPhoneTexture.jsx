import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { db, collection, query, orderBy, limit, onSnapshot, getDocs } from '@/lib/firebaseClient';

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
    verb: 'Dedicated a Green Candle',
    unit: 'candle',
    pluralUnit: 'candles',
    color: '#00ff66'
  },
  STAKE: {
    icon: '💎',
    verb: 'Staked RL80',
    unit: 'RL80',
    color: '#00bfff'
  },
  UNSTAKE: {
    icon: '📤',
    verb: 'Unstaked RL80',
    unit: 'RL80',
    color: '#ff9500'
  },
  CLAIM: {
    icon: '💰',
    verb: 'Claimed ETH',
    unit: 'ETH',
    color: '#ffeb3b'
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
  
  // Activity feed state
  const [activities, setActivities] = useState([]);
  const [activeTab, setActiveTab] = useState('ALL'); // ALL | CANDLES | STAKING
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
  
  
  // Add click handling to the 3D mesh instead of canvas
  useEffect(() => {
    if (meshRef && meshRef.material) {
      // Store the click handler on the mesh's userData
      meshRef.userData.onWatchlistClick = (uv) => {
        if (!uv) return;
        
        // Convert UV coordinates to canvas coordinates  
        const canvas = canvasRef.current;
        const x = (1 - uv.x) * canvas.width; // Flip X coordinate for texture mapping
        const y = (1 - uv.y) * canvas.height; // Flip Y coordinate
        
        // Check if click is in tab area (generous padding for touch targets)
        const tabY = 175;
        const tabHeight = 45;
        const tabPadding = 30; // Extra padding above and below for easier mobile taps
        const tabs = ['ALL', 'CANDLES', 'STAKING', 'XPOSTS'];
        const tabWidth = (canvas.width - 60) / tabs.length;

        if (y >= tabY - tabPadding && y <= tabY + tabHeight + tabPadding && x >= 10 && x <= canvas.width - 10) {
          // Determine which tab was clicked
          const tabIndex = Math.floor((x - 30) / tabWidth);
          
          if (tabIndex >= 0 && tabIndex < tabs.length) {
            setActiveTab(tabs[tabIndex]);
            scrollPositionRef.current = 0;
            targetScrollRef.current = 0;
            return true; // Indicate that we handled the click
          }
        }
        return false; // Let other handlers process the click
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
    canvas.width = 640;
    canvas.height = 1280;
    
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
    // Subscribe to Firebase offerings
    const offeringsRef = collection(db, 'offerings');
    const q = query(offeringsRef, orderBy('createdAt', 'desc'), limit(30));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newActivities = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        newActivities.push({
          id: doc.id,
          type: 'CANDLE',
          username: data.name || truncateAddress(data.walletAddress),
          userId: data.userId,
          userImageUrl: data.userImageUrl,
          prayerType: data.type || 'petition', // petition, confession, appreciation
          amount: parseInt(data.tokensBurned) || 1,
          timestamp: data.createdAt?.toMillis?.() || Date.now(),
          isNew: false,
        });
      });
      
      if (newActivities.length > 0) {
        setActivities(prev => {
          // Merge with existing staking activities
          const stakingActivities = prev.filter(a => a.type !== 'CANDLE');
          const merged = [...newActivities, ...stakingActivities];
          return merged.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
        });
      }
    }, (error) => {
      console.error('Error fetching offerings:', error);
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
        const data = doc.data();
        xPostActivities.push({
          id: doc.id,
          type: 'XPOST',
          username: data.author || 'Unknown',
          handle: data.handle || '',
          tweetText: data.text || '',
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
    img.src = '/images/electricRL80.png';
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
  
  const filteredActivities = activities.filter(activity => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'CANDLES') return activity.type === 'CANDLE';
    if (activeTab === 'STAKING') return ['STAKE', 'UNSTAKE', 'CLAIM'].includes(activity.type);
    if (activeTab === 'XPOSTS') return activity.type === 'XPOST';
    return true;
  });
  
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
      const initial = notification.username?.charAt(0).toUpperCase() || '🙏';
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
    const width = canvas.width;
    const height = canvas.height;
    
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
    
    // Draw background image if loaded, otherwise fallback to gradient
    if (backgroundImageRef.current) {
      const img = backgroundImageRef.current;
      
      // Scale up to ensure full coverage (like CSS object-fit: cover)
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const canvasAspect = width / height;
      
      let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
      
      if (imgAspect > canvasAspect) {
        // Image is wider - scale by height and center horizontally
        drawHeight = height;
        drawWidth = height * imgAspect;
        offsetX = (width - drawWidth) / 2;
      } else {
        // Image is taller - scale by width and center vertically  
        drawWidth = width;
        drawHeight = width / imgAspect;
        offsetY = (height - drawHeight) / 2;
      }
      
      // Add 10% padding to ensure full coverage
      const padding = 1.01;
      drawWidth *= padding;
      drawHeight *= padding;
      offsetX -= (drawWidth - width) / 2;
      offsetY -= (drawHeight - height) / 2;
      
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    } else {
      // Fallback gradient
      const backgroundGradient = ctx.createLinearGradient(0, 0, 0, height);
      backgroundGradient.addColorStop(0, '#1d065aff');    // Dark blue-purple top
      backgroundGradient.addColorStop(0.3, '#4005c9ff');  // Deep blue
      backgroundGradient.addColorStop(0.7, '#1967c7ff');  // Ocean blue
      backgroundGradient.addColorStop(1, '#190b62ff');    // Dark bottom
      
      ctx.fillStyle = backgroundGradient;
      ctx.fillRect(0, 0, width, height);
    }
    
    // Reset text alignment for content below
    ctx.textAlign = 'left';

    // ===========================================
    // STATUS BAR - LIVE TIME DISPLAY
    // ===========================================

    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const formattedTime = `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')}`;

    ctx.fillStyle = '#000';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(formattedTime, 60, 40);

    // ===========================================
    // HEADER WITH AVATAR AND TITLE
    // ===========================================
    
    const headerY = 120;
    const avatarSize = 80;
    const avatarX = 80;
    
    // Draw avatar if loaded
    if (avatarImageRef.current) {
      ctx.save();
      
      // Create circular clip for avatar
      ctx.beginPath();
      ctx.arc(avatarX, headerY, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      
      // Draw avatar image
      ctx.drawImage(
        avatarImageRef.current,
        avatarX - avatarSize / 2,
        headerY - avatarSize / 2,
        avatarSize,
        avatarSize
      );
      
      ctx.restore();
      
      // Draw border around avatar
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(avatarX, headerY, avatarSize / 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    // Draw title text
    ctx.fillStyle = '#060606ff';
    ctx.font = 'bold 28px serif';
    ctx.textAlign = 'left';
    ctx.fillText('𝓞𝖚𝖗 𝕷𝖆𝖉𝖞 𝔬𝔣 𝕻𝖊𝖗𝖕𝖊𝖙𝖚𝖆𝖑 𝕻𝖗𝖔𝖋𝖎𝖙', avatarX + avatarSize / 2 + 15, headerY + 8);
    
    // ===========================================
    // TABS
    // ===========================================
    
    const tabY = 175;
    const tabHeight = 45;
    const tabs = [
      { id: 'ALL', label: '🔥 ALL' },
      { id: 'CANDLES', label: '🕯️ CANDLES' },
      { id: 'STAKING', label: '💎 STAKING' },
      { id: 'XPOSTS', label: '𝕏 POSTS' },
    ];
    
    const tabWidth = (width - 60) / tabs.length;
    
    tabs.forEach((tab, index) => {
      const tabX = 30 + index * tabWidth;
      const isActive = activeTab === tab.id;
      
      // Tab background with strong contrast
      ctx.fillStyle = isActive ? '#1a1a2e' : 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.roundRect(tabX, tabY, tabWidth - 10, tabHeight, 8);
      ctx.fill();
      
      // Tab border for extra definition
      ctx.strokeStyle = isActive ? '#6c5ce7' : 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Tab text with strong contrast
      ctx.fillStyle = '#fff';
      ctx.font = `${isActive ? 'bold ' : ''}20px -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(tab.label, tabX + (tabWidth - 10) / 2, tabY + 30);
      ctx.textAlign = 'left';
    });
    
    // Tab underline
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, tabY + tabHeight + 10);
    ctx.lineTo(width - 30, tabY + tabHeight + 10);
    ctx.stroke();
    
    // ===========================================
    // ACTIVITY FEED
    // ===========================================
    
    const feedStartY = tabY + tabHeight + 20;
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
      let itemHeight = CONFIG.ITEM_HEIGHT;
      if (hasScreenshot) {
        const ss = screenshotImagesRef.current[activity.id];
        const ssDisplayW = width - 40;
        const ssDisplayH = ssDisplayW / (ss.naturalWidth / ss.naturalHeight);
        itemHeight = ssDisplayH; // Full image height, no cap
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

        currentY += itemHeight + CONFIG.ITEM_GAP;
        return;
      }

      const tier = getActivityTier(activity.type, activity.amount);
      const style = getTierStyle(tier);
      const activityType = ACTIVITY_TYPES[activity.type];
      
      // Glow effect for whales
      if (style.glowColor) {
        ctx.shadowColor = style.glowColor;
        ctx.shadowBlur = 15;
      }
      
      // New item pulse
      let itemAlpha = 1;
      if (activity.isNew) {
        const elapsed = Date.now() - activity.timestamp;
        const pulse = (Math.sin(elapsed / 150) + 1) / 2;
        ctx.shadowColor = 'rgba(0, 255, 102, 0.5)';
        ctx.shadowBlur = 10 + pulse * 10;
      }
      
      // Item background
      // Use different colors based on activity type
      const bgGradient = ctx.createLinearGradient(20, itemY, 20, itemY + itemHeight);
      
      if (activity.type === 'CANDLE') {
        bgGradient.addColorStop(0, '#c86d35ff');  // Orange for candles/burns
        bgGradient.addColorStop(1, '#89380cff');
      } else if (['STAKE', 'UNSTAKE', 'CLAIM'].includes(activity.type)) {
        bgGradient.addColorStop(0, '#071f39ff');  // Blue for staking
        bgGradient.addColorStop(1, '#357abd');
      } else if (activity.type === 'XPOST') {
        bgGradient.addColorStop(0, '#15202b');  // Dark X/Twitter theme
        bgGradient.addColorStop(1, '#192734');
      } else {
        bgGradient.addColorStop(0, style.bgGradient[0]);
        bgGradient.addColorStop(1, style.bgGradient[1]);
      }
      
      ctx.fillStyle = bgGradient;
      ctx.beginPath();
      ctx.roundRect(20, itemY, width - 40, itemHeight, 12);
      ctx.fill();
      
      // Border for whales
      if (tier === 'whale' || tier === 'mega') {
        ctx.strokeStyle = style.borderColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      
      ctx.shadowBlur = 0;
      
      // Emoji removed - shown in prayer type badge instead
      
      // User avatar (if available) - bigger size
      const avatarSize = 70;
      const avatarX = 70;
      const avatarY = itemY + itemHeight / 2;
      let usernameX = 130; // Default position if no avatar

      const userAvatar = activityAvatarsRef.current[activity.id];
      // Check if it's an actual Image object (not 'loading' or 'failed' strings)
      const isImageLoaded = userAvatar && userAvatar instanceof Image;

      if (isImageLoaded) {
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
        ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const initial = activity.username?.charAt(0).toUpperCase() || '?';
        ctx.fillText(initial, avatarX, avatarY);

        usernameX = avatarX + avatarSize / 2 + 10;
      }
      
      // Username
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fff';
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
      ctx.fillStyle = tier === 'mega' ? '#333' : '#888';
      ctx.font = '20px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatTimeAgo(activity.timestamp), width - 40, itemY + 35);
      
      if (activity.type === 'XPOST') {
        // Show @handle next to username
        if (activity.handle) {
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
        } else {
          // Fallback: show tweet text
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
        ctx.fillStyle = '#000';
        ctx.font = '22px -apple-system, BlinkMacSystemFont, sans-serif';

        ctx.fillText(activityType.verb, usernameX, itemY + 62);

        // Amount (bottom right)
        ctx.textAlign = 'right';
        ctx.fillStyle = activityType.color;
        ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';

        const amountText = activity.type === 'CANDLE'
          ? `+${formatAmount(activity.amount, activity.type)}`
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
      }
      return sum + h + CONFIG.ITEM_GAP;
    }, 0);
  }, [filteredActivities]);

  // ===========================================
  // AUTO-SCROLL STATE
  // ===========================================

  const autoScrollStateRef = useRef('pausing'); // 'pausing' | 'scrolling' | 'bottom_pause'
  const autoScrollPauseStartRef = useRef(Date.now());

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
    const feedVisibleHeight = 1280 - 100 - (175 + 45 + 20); // feedEndY - feedStartY
    const totalHeight = getTotalContentHeight();
    const maxScroll = Math.max(0, totalHeight - feedVisibleHeight);

    if (maxScroll > 0) {
      if (autoScrollStateRef.current === 'pausing') {
        // Wait at the top before starting to scroll
        if (now - autoScrollPauseStartRef.current > CONFIG.AUTO_SCROLL_PAUSE) {
          autoScrollStateRef.current = 'scrolling';
        }
      } else if (autoScrollStateRef.current === 'scrolling') {
        // Slowly scroll down
        scrollPositionRef.current += CONFIG.AUTO_SCROLL_SPEED;
        targetScrollRef.current = scrollPositionRef.current;

        if (scrollPositionRef.current >= maxScroll) {
          scrollPositionRef.current = maxScroll;
          targetScrollRef.current = maxScroll;
          autoScrollStateRef.current = 'bottom_pause';
          autoScrollPauseStartRef.current = now;
        }
      } else if (autoScrollStateRef.current === 'bottom_pause') {
        // Pause at the bottom, then reset to top
        if (now - autoScrollPauseStartRef.current > CONFIG.AUTO_SCROLL_BOTTOM_PAUSE) {
          scrollPositionRef.current = 0;
          targetScrollRef.current = 0;
          autoScrollStateRef.current = 'pausing';
          autoScrollPauseStartRef.current = now;
        }
      }
    }

    // Smooth scrolling for manual/programmatic scroll
    if (Math.abs(targetScrollRef.current - scrollPositionRef.current) > 0.5) {
      scrollPositionRef.current += (targetScrollRef.current - scrollPositionRef.current) * CONFIG.SCROLL_SPEED;
    }

    // Redraw at ~60fps
    if (now - lastUpdateTimeRef.current > 16) {
      drawWatchlist();
      lastUpdateTimeRef.current = now;
    }
  });
  
  // ===========================================
  // TAB SWITCHING (expose for external control)
  // ===========================================
  
  // You can call these from parent via ref if needed
  const switchTab = useCallback((tabId) => {
    setActiveTab(tabId);
    scrollPositionRef.current = 0;
    targetScrollRef.current = 0;
  }, []);
  
  const scrollToTop = useCallback(() => {
    targetScrollRef.current = 0;
  }, []);
  
  const scrollBy = useCallback((delta) => {
    const feedVisibleHeight = 1280 - 100 - (175 + 45 + 20);
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