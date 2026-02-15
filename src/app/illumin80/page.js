'use client'

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react'
import NavControlsHome from '@/components/NavControlsHome'
import CyberNav from '@/components/CyberNav'
import { useUser, SignInButton } from '@clerk/nextjs'
import { useMusic } from '@/components/MusicContext'
import { useWalletAuth } from '@/components/WalletAuthProvider'
import ThirdwebBuyModal from '@/components/ThirdwebBuyModal'
import LightCandleModal from '@/components/LightCandleModal'
import { WalletConnectionModal } from '@/components/WalletConnectionModal'
import { useRouter, usePathname } from 'next/navigation'
import { useLanguage } from '@/components/LanguageProvider'
import ShrineLeftPanel from '@/components/ShrineLeftPanel'
import { db, collection, getDocs, query, orderBy, limit, onSnapshot, updateDoc, doc } from '@/lib/firebaseClient'
import UnifiedShrine from '@/components/UnifiedShrine'
import PolaroidDisplay from '@/components/PolaroidDisplay'
import CoinLoader from '@/components/CoinLoader'

// CandleSnapshotRenderer removed - no longer needed

// Tiny Votive Model Component

export default function ShrinePage() {
  const router = useRouter()
  const { t } = useLanguage()
  const pathname = usePathname()
  const { user, isLoaded: userLoaded, isSignedIn } = useUser()
  const { isWalletConnected, walletAddress, connectWallet } = useWalletAuth()
  const unifiedShrineRef = useRef()
  const shrineLeftPanelRef = useRef()
  const latestOfferingRef = useRef(null) // Track the latest offering ID for updating with polaroid URL
  const pendingCandleEffectRef = useRef(null) // Queue candle effects when page is hidden (e.g. user in MetaMask)
  const localCandleEffectActiveRef = useRef(false) // Flag: this client just triggered a candle effect locally
  const { 
    play, 
    pause, 
    isPlaying: contextIsPlaying, 
    nextTrack,
    is80sMode: context80sMode, 
    setIs80sMode: setContext80sMode
  } = useMusic()
  const [isMobileView, setIsMobileView] = useState(false)
  const [isMobileDevice, setIsMobileDevice] = useState(false)
  const [fontLoaded, setFontLoaded] = useState(false)
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [showLightCandleModal, setShowLightCandleModal] = useState(false)
  const [modalKey, setModalKey] = useState(0) // Force modal to remount by changing key
  const [isProcessingCandle, setIsProcessingCandle] = useState(false) // Prevent modal from reopening during processing
  const [hasProcessedCandle, setHasProcessedCandle] = useState(false) // Track if candle was already processed this session
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [showAuthMessage, setShowAuthMessage] = useState(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showHelpOverlay, setShowHelpOverlay] = useState(false) // Help/onboarding overlay - set on mount from localStorage
  const [currentView, setCurrentView] = useState('shrine')
  const [mounted, setMounted] = useState(false)
  const [mobileMatchstickLit, setMobileMatchstickLit] = useState(false)
  const [remountKey, setRemountKey] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [polaroidUrl, setPolaroidUrl] = useState(null)
  const [showPolaroid, setShowPolaroid] = useState(false)
  const [hasDismissedPolaroid, setHasDismissedPolaroid] = useState(false)
  const [hasLitCandleThisSession, setHasLitCandleThisSession] = useState(false)
  // Snapshot functionality removed - no longer needed
  const is80sMode = context80sMode
  
  // State for offerings data
  const [hoveredOffering, setHoveredOffering] = useState(null)
  const [justLitOffering, setJustLitOfferingOriginal] = useState(null)
  
  // Wrap setJustLitOffering to log ALL calls
  const setJustLitOffering = (offering) => {

    setJustLitOfferingOriginal(offering)
  }
  const [priceChange, setPriceChange] = useState(0)
  const [offerings, setOfferings] = useState([])
  const [totalOfferingsCount, setTotalOfferingsCount] = useState(0)
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(true)
  const [sortOption, setSortOption] = useState('topBurners') // 'topBurners' or 'recent'
  const [selectedCandle, setSelectedCandle] = useState(null) // Currently selected candle from 3D scene

  // Choir audio for candle lighting ceremony
  const choirContextRef = useRef(null)
  const choirBufferRef = useRef(null)

  const [isClient, setIsClient] = useState(false)
  const [delayedMount, setDelayedMount] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [mountKey, setMountKey] = useState(0)

useEffect(() => {
  setIsClient(true)
}, [])

// Preload choir audio buffer for candle lighting ceremony
useEffect(() => {
  const loadChoir = async () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      choirContextRef.current = ctx

      const response = await fetch('/choir.mp3')
      const arrayBuffer = await response.arrayBuffer()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      choirBufferRef.current = audioBuffer
    } catch (e) {
      console.warn('Failed to load choir audio:', e)
    }
  }
  loadChoir()
  return () => {
    if (choirContextRef.current) {
      choirContextRef.current.close().catch(() => {})
    }
  }
}, [])

// Lock viewport scale for this page — prevents iOS Safari from auto-zooming when modals appear
useEffect(() => {
  const meta = document.querySelector('meta[name="viewport"]')
  const originalContent = meta?.getAttribute('content') || ''
  if (meta) {
    meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
  }
  return () => {
    if (meta && originalContent) meta.setAttribute('content', originalContent)
  }
}, [])

// When user returns from MetaMask (or any background), play any queued candle effects
// and aggressively reset the viewport
useEffect(() => {
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      // Force viewport reset — iOS Safari can leave viewport offset/zoomed after app-switch
      window.scrollTo(0, 0)
      // Re-clamp any zoom that iOS applied while backgrounded
      const meta = document.querySelector('meta[name="viewport"]')
      if (meta) {
        meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
      }

      if (pendingCandleEffectRef.current) {
        const pending = pendingCandleEffectRef.current
        pendingCandleEffectRef.current = null
        // Small delay so the page is fully visible before effects fire
        setTimeout(() => {
          pending()
        }, 600)
      }
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [])

// Play layered choir swell — Dm chord (root, minor 3rd, 5th)
const playChoirSwell = useCallback(() => {
  const ctx = choirContextRef.current
  const buffer = choirBufferRef.current
  if (!ctx || !buffer) return

  if (ctx.state === 'suspended') ctx.resume()

  const pitches = [1.0, 1.189, 1.498] // D, F, A — Dm chord
  const now = ctx.currentTime

  pitches.forEach((rate, i) => {
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.playbackRate.value = rate

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.15, now + 1.5 + i * 0.3) // Staggered fade in
    gain.gain.linearRampToValueAtTime(0, now + 7)                 // Fade out

    source.connect(gain)
    gain.connect(ctx.destination)

    source.start(now + i * 0.4) // Stagger each voice
    source.stop(now + 8)
  })
}, [])

// Play a single short choir note pitched by candle index (D minor pentatonic)
const playCandleNote = useCallback((candleIndex) => {
  const ctx = choirContextRef.current
  const buffer = choirBufferRef.current
  if (!ctx || !buffer) return

  if (ctx.state === 'suspended') ctx.resume()

  // D minor pentatonic — always sounds harmonious
  const pentatonic = [0.75, 1.0, 1.189, 1.335, 1.498, 1.782, 2.0]

  // Each candle gets a unique note by cycling through the scale
  const idx = candleIndex ?? 0
  const noteIndex = idx % pentatonic.length
  const rate = pentatonic[noteIndex]

  const now = ctx.currentTime
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = rate

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.09, now + 0.15)  // Quick attack
  gain.gain.linearRampToValueAtTime(0.06, now + 0.5)   // Gentle sustain
  gain.gain.linearRampToValueAtTime(0, now + 1.5)      // Fade out

  source.connect(gain)
  gain.connect(ctx.destination)

  source.start(now)
  source.stop(now + 2)
}, [])

// Soft distant note when another user's candle arrives
const playArrivalNote = useCallback((posY) => {
  const ctx = choirContextRef.current
  const buffer = choirBufferRef.current
  if (!ctx || !buffer) return

  if (ctx.state === 'suspended') ctx.resume()

  const pentatonic = [0.75, 1.0, 1.189, 1.335, 1.498, 1.782, 2.0]
  const y = posY ?? 0
  const normalized = Math.max(0, Math.min(1, (y + 5) / 17))
  const noteIndex = Math.floor(normalized * (pentatonic.length - 1))
  const rate = pentatonic[noteIndex]

  const now = ctx.currentTime
  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.playbackRate.value = rate

  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.045, now + 0.6)  // Slow, soft attack
  gain.gain.linearRampToValueAtTime(0.03, now + 1.5)   // Gentle sustain
  gain.gain.linearRampToValueAtTime(0, now + 3.5)      // Long ethereal fade

  source.connect(gain)
  gain.connect(ctx.destination)

  source.start(now)
  source.stop(now + 4)
}, [])

useEffect(() => {
  let mounted = true

  // Enhanced preload for navigation issues
  const handleMount = async () => {
    try {
      
      // Import and preload the model
      const { useGLTF } = await import('@react-three/drei')
      
      // Clear the GLTF cache completely to ensure fresh load
      if (useGLTF.clear) {
        useGLTF.clear()  // Clear all cached models
      }
      
      // Force fresh preload of the model
      useGLTF.preload('/models/tinyJapCanOnly.glb')
      
      // Reset any existing Three.js state that might interfere
      if (typeof window !== 'undefined') {
        // Reset shared uniforms if they exist
        if (window.sharedUniforms) {
          window.sharedUniforms.uTime.value = 0
          window.sharedUniforms.uClickedId.value = -1
          window.sharedUniforms.uPriceDirection.value = 0
          window.sharedUniforms.uContinuousOffset.value = 0
          window.sharedUniforms.uShortTermPrice.value = 0
          window.sharedUniforms.uPulseTime.value = -1
          window.sharedUniforms.uHighlightedId.value = -1
        }
        
        // Clear any Three.js renderer cache that might exist
        if (window.__THREE_DEVTOOLS__) {
        }
        
        // Force garbage collection if available (for debugging)
        if (window.gc && typeof window.gc === 'function') {
          try {
            window.gc()
          } catch (e) {
            // GC not available, ignore
          }
        }
      }
      
      // Delay mounting to ensure everything is ready
      setTimeout(() => {
        if (mounted) {
          setMountKey(Date.now()) // Ensure fresh component mount
          setDelayedMount(true)
          setIsLoading(false)
        }
      }, 800) // Reasonable delay for model preload
      
    } catch (error) {
      console.error('[Illumin80] Error in mounting process:', error)
      // Fallback - still mount even if preload fails
      if (mounted) {
        setTimeout(() => {
          if (mounted) {
            setMountKey(Date.now())
            setDelayedMount(true)
            setIsLoading(false)
          }
        }, 500)
      }
    }
  }
  
  handleMount()
  
  return () => {
    mounted = false
    setDelayedMount(false)
  }
}, [])

  // Helper to format offering data from Firestore doc
  const formatOffering = (doc) => {
    const data = doc.data()
    const offering = {
      id: doc.id,
      name: data.name || 'Anonymous',
      type: data.type || 'petition',
      message: data.message || '',
      tokensBurned: data.tokensBurned || 0,
      userId: data.userId,
      walletAddress: data.walletAddress,
      userImageUrl: data.userImageUrl,
      polaroidUrl: data.polaroidUrl,
      imageUrl: data.imageUrl,
      timestamp: data.timestamp || 'just now',
      createdAt: data.createdAt,
      litAt: data.litAt,
      // Include stored position for consistent candle placement
      position: data.position,
      rotation: data.rotation,
      scale: data.scale,
      icon: data.type === 'petition' ? '🙏' :
            data.type === 'appreciation' ? '✨' : '🖤'
    }

    // Format timestamp
    if (data.createdAt) {
      const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
      const now = new Date()
      const diff = now - date
      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(minutes / 60)
      const days = Math.floor(hours / 24)

      if (minutes < 1) {
        offering.timestamp = 'just now'
      } else if (minutes < 60) {
        offering.timestamp = `${minutes} minute${minutes > 1 ? 's' : ''} ago`
      } else if (hours < 24) {
        offering.timestamp = `${hours} hour${hours > 1 ? 's' : ''} ago`
      } else {
        offering.timestamp = `${days} day${days > 1 ? 's' : ''} ago`
      }
    }

    return offering
  }

  // Generate St. GR80 placeholder candles to fill empty slots
  const generateStGR80Candles = (startIndex, count) => {
    const placeholders = []
    for (let i = 0; i < count; i++) {
      const index = startIndex + i
      placeholders.push({
        id: `st-gr80-${index}`,
        name: 'St. GR80',
        type: 'shrine-keeper',
        message: '',
        tokensBurned: 0,
        userId: `st-gr80-${index}`,
        walletAddress: null,
        userImageUrl: '/images/GR80_headshot.webp',
        polaroidUrl: null,
        imageUrl: null,
        timestamp: 'eternal',
        createdAt: null,
        icon: '🕯️',
        isPlaceholder: true, // Flag to identify St. GR80 candles
        // First candle gets a fixed centered position for visibility (especially on mobile)
        ...(i === 0 ? { position: { x: 0, y: 1.5, z: -10 } } : {}),
      })
    }
    return placeholders
  }

  // Fetch offerings from Firestore - always 80 candles total (users + St. GR80 placeholders)
  const fetchOfferings = useCallback(async () => {
    try {
      setIsLoadingOfferings(true)

      // Get total count of all offerings
      const countSnapshot = await getDocs(collection(db, 'offerings'))
      setTotalOfferingsCount(countSnapshot.size)

      // Query based on current sort option
      const offeringsQuery = query(
        collection(db, 'offerings'),
        orderBy(sortOption === 'topBurners' ? 'tokensBurned' : 'createdAt', 'desc'),
        limit(80)
      )

      const snapshot = await getDocs(offeringsQuery)
      const fetchedOfferings = []

      // TEMP: Only show 1 St. GR80 candle + real user candles
      snapshot.forEach((doc) => {
        const o = formatOffering(doc)
        if (!o.isPlaceholder) fetchedOfferings.push(o)
      })

      // Just one St. GR80 candle
      fetchedOfferings.push(...generateStGR80Candles(fetchedOfferings.length, 1))

      setOfferings(fetchedOfferings)
    } catch (error) {
      console.error('[fetchOfferings] Error fetching offerings:', error)
      // On error, show all St. GR80 candles
      setOfferings(generateStGR80Candles(0, 80))
    } finally {
      setIsLoadingOfferings(false)
    }
  }, [sortOption])

  // Set up real-time listener for new offerings
  useEffect(() => {
    // Initial fetch
    fetchOfferings()

    // Set up real-time listener for new offerings
    const offeringsQuery = query(
      collection(db, 'offerings'),
      orderBy('createdAt', 'desc'),
      limit(1)
    )

    let lastOfferingId = null
    const unsubscribe = onSnapshot(offeringsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const latestDoc = snapshot.docs[0]
        const latestOffering = {
          id: latestDoc.id,
          ...latestDoc.data()
        }

        // Check if this is a new offering (not initial load and different from last)
        if (lastOfferingId && lastOfferingId !== latestDoc.id) {

          // Skip if THIS client already triggered the effect locally via handleLightCandle.
          // Using a local flag avoids identity-matching edge cases (null===null, same user
          // on multiple devices, etc.). Only the browser tab that lit the candle sets this flag.
          if (localCandleEffectActiveRef.current) {
          } else {
            // Trigger the full candle flight + ripple + arctic rings effect
            if (unifiedShrineRef.current) {
              unifiedShrineRef.current.triggerCandleEffect(latestOffering)
            } else {
              console.warn('[onSnapshot] unifiedShrineRef.current is null - 3D scene not ready')
            }

            // Show notification + choir swell synced with arctic rings (~3.5s into flight)
            setTimeout(() => {
              setJustLitOffering(latestOffering)
              playChoirSwell()
              // Clear notification after display duration
              setTimeout(() => {
                setJustLitOffering(null)
              }, 10000)
            }, 3500)

            // Soft choir note when candle lands (~3s into flight animation)
            setTimeout(() => {
              playArrivalNote(latestOffering.position?.y)
            }, 3000)
          }

          // Always update the offerings list regardless of who lit the candle
          // Short delay to let Firestore write propagate, then fetch permanent candle
          setTimeout(() => {
            fetchOfferings()
          }, 500)
        }

        lastOfferingId = latestDoc.id
      }
    }, (error) => {
      console.error('[onSnapshot] Listener error:', error)
    })

    // Refresh offerings every 30 seconds as backup
    const interval = setInterval(fetchOfferings, 30000)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [fetchOfferings, unifiedShrineRef])

  // Set mounted state after hydration
  useEffect(() => {
    // Check mobile status immediately before mounting
    const checkMobile = () => {
      const isMobile = window.innerWidth <= 768;
      setIsMobileView(isMobile);
      setIsMobileDevice(isMobile);
    };
    checkMobile();
    
    // Then mount
    setMounted(true);

    // Show help annotations on first visit
    const hasVisited = localStorage.getItem('illumin80_visited')
    if (!hasVisited) {
      setShowHelpOverlay(true)
      localStorage.setItem('illumin80_visited', '1')
    }
  }, []);

  // Auto-expand and collapse effect for mobile banner
  useEffect(() => {
    if (!isMobileView) return;
    
    // Don't show animations if user has already lit a candle this session
    if (hasLitCandleThisSession) return;
    
    // Initial expand after 2 seconds
    const initialTimer = setTimeout(() => {
      setIsExpanded(true);
      
      // Collapse after 4 seconds of being expanded
      setTimeout(() => {
        setIsExpanded(false);
      }, 4000);
    }, 2000);

    // Then repeat the expand/collapse cycle every 60 seconds (less frequent after first show)
    const interval = setInterval(() => {
      setIsExpanded(true);
      setTimeout(() => {
        setIsExpanded(false);
      }, 4000);
    }, 60000); // Changed from 15000ms to 60000ms

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [isMobileView, hasLitCandleThisSession]);

  // Check if font is loaded and add fonts-loaded class
  useEffect(() => {
    const checkFont = async () => {
      try {
        await document.fonts.load("1em 'UnifrakturMaguntia'");
        setFontLoaded(true);
        // Add the fonts-loaded class to make the font visible
        document.documentElement.classList.add('fonts-loaded');
      } catch (e) {
        setTimeout(() => {
          setFontLoaded(true);
          document.documentElement.classList.add('fonts-loaded');
        }, 100);
      }
    };
    checkFont();
  }, []);

  // Check if mobile view and device
  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth <= 768;
      setIsMobileView(isMobile);
      setIsMobileDevice(isMobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  // Handle light candle button click with auth check
  const handleLightCandleClick = () => {


    // Don't light the matchstick here - only light it when candle is actually lit
    // This prevents the flame from showing if user cancels

    // Reset the flags when user explicitly clicks to light a new candle
    // This allows users to light multiple candles in a session
    setHasProcessedCandle(false);
    setIsProcessingCandle(false);

    // Check if user is signed in
    if (!isSignedIn) {
      setShowAuthMessage('sign-in');
      return;
    }

    // Check if wallet is connected
    if (!isWalletConnected || !walletAddress) {
      setShowWalletModal(true);
      setWaitingForWallet(true); // Set flag that we're waiting for wallet connection
      setWalletActionType('candle'); // Track that this is for lighting a candle
      return;
    }

    // Both signed in and wallet connected - show the modal
    setModalKey(prev => prev + 1); // Force modal to remount with fresh state
    setShowLightCandleModal(true);
  };
  

  // Find My Candle functionality moved to stats tab in UnifiedShrine

  // Track if we're waiting for wallet connection and what action triggered it
  const [waitingForWallet, setWaitingForWallet] = useState(false);
  const [walletActionType, setWalletActionType] = useState(null); // 'candle'

  // Watch for wallet connection
  useEffect(() => {
    if (isWalletConnected && (showWalletModal || waitingForWallet)) {
      setShowWalletModal(false);
      setWaitingForWallet(false);

      // Open the candle modal if that's what triggered wallet connection
      if (walletActionType === 'candle' && !isProcessingCandle && !hasProcessedCandle) {
        setShowLightCandleModal(true);
      }

      setWalletActionType(null); // Reset the action type
    }
  }, [isWalletConnected, showWalletModal, waitingForWallet, walletActionType, isProcessingCandle, hasProcessedCandle]);

  // Watch for successful sign-in and resume the intended action
  useEffect(() => {
    if (isSignedIn && userLoaded && showAuthMessage) {
      setShowAuthMessage(null);

      // Small delay to allow test wallet auto-assignment to complete
      setTimeout(() => {
        // After sign-in, check wallet connection
        if (!isWalletConnected || !walletAddress) {
          // Need wallet connection
          setShowWalletModal(true);
          setWaitingForWallet(true);
          setWalletActionType('candle');
        } else {
          // Already have wallet, show the candle modal
          if (!isProcessingCandle && !hasProcessedCandle) {
            setShowLightCandleModal(true);
          }
        }
      }, 500); // 500ms delay for test wallet assignment
    }
  }, [isSignedIn, userLoaded, showAuthMessage, isWalletConnected, walletAddress, isProcessingCandle, hasProcessedCandle]);

  // Handle light candle from modal
  const handleLightCandle = async (newOffering) => {
    // Resume audio context on user gesture (before the setTimeout loses gesture context)
    if (choirContextRef.current?.state === 'suspended') {
      choirContextRef.current.resume()
    }

    // Immediately close the modal and set processing flags
    setShowLightCandleModal(false);
    setIsProcessingCandle(true);
    setHasProcessedCandle(true); // Mark that we've processed a candle this session
    // Clear any pending wallet action to prevent modal from reopening
    setWalletActionType(null);
    setShowAuthMessage(null);
    
    // Reset previous polaroid state when lighting a new candle
    setShowPolaroid(false);
    setHasDismissedPolaroid(false);
    setPolaroidUrl(null);
    
    // Map offering types to background images
    const backgroundMap = {
      petition: 'tradingView',      // Hopeful, asking for guidance
      confession: 'sunset', // Darker, introspective
      appreciation: 'chart'    // Warm, grateful
    };

    // Trigger snapshot capture with the offering data
    const snapData = {
      name: newOffering.name,
      message: newOffering.message,
      polaroidMessage: newOffering.polaroidMessage || `Burned ${newOffering.tokensBurned} RL80 tokens!`, // Use custom message or fallback
      type: newOffering.type,
      image: newOffering.customImage || null,
      burnedAmount: newOffering.tokensBurned,
      devotionType: 'candle',
      candleType: 'votive',
      background: backgroundMap[newOffering.type] || 'synthwave', // Use type-specific background or default
      username: user?.username || user?.firstName || 'Anonymous',
      createdBy: user?.id || '',
    };

    // Snapshot functionality removed - no longer capturing polaroids

    // Set up a function to receive the offering ID
    window.setLatestOfferingId = (id) => {
      latestOfferingRef.current = id;
    };

    // Set up a listener for when the polaroid is ready
    window.onPolaroidReady = async (url) => {
      setPolaroidUrl(url);

      // Update the offerings document with the polaroid URL
      if (latestOfferingRef.current) {
        try {
          const offeringDoc = doc(db, 'offerings', latestOfferingRef.current);
          // First update with URL but not ready
          await updateDoc(offeringDoc, {
            polaroidUrl: url,
            polaroidReady: false
          });

          // After delay, mark as ready for display
          setTimeout(async () => {
            await updateDoc(offeringDoc, {
              polaroidReady: true
            });
          }, 5000); // 5 second delay for effects to complete
        } catch (error) {
          console.error('[ShrinePage] Failed to update offering with polaroid URL:', error);
        }
      }

      // Save to localStorage for retrieval in account modal
      try {
        const savedPolaroids = JSON.parse(localStorage.getItem('userPolaroids') || '[]');
        const newPolaroid = {
          url,
          timestamp: Date.now(),
          username: user?.username || user?.firstName || 'Anonymous',
          burnedAmount: newOffering.tokensBurned || 1
        };
        // Keep only last 10 polaroids
        const updated = [newPolaroid, ...savedPolaroids].slice(0, 10);
        localStorage.setItem('userPolaroids', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save polaroid to localStorage:', e);
      }

      // Show the polaroid on the side after the candle effect completes
      // NewCandleEffect takes about 10 seconds (5s rise + 5s glow)
      setTimeout(() => {
        setShowPolaroid(true);
        setHasDismissedPolaroid(false);
      }, 1000); // 3 seconds - shows shortly after candle lands
    };

    // All visual/audio effects bundled so they can be deferred if page is hidden
    // (e.g. user is in MetaMask signing the transaction on mobile)
    const playEffects = () => {
      // Notification + choir swell synced with arctic rings
      setTimeout(() => {
        setJustLitOffering(newOffering);
        playChoirSwell();

        // Clear notification after display duration
        setTimeout(() => {
          setJustLitOffering(null);
        }, 10000); // Show for 10 seconds
      }, 3500); // Matches when arctic rings appear

      // 3D candle animation
      if (unifiedShrineRef.current) {
        // Flag that THIS client is already playing the effect locally
        // so the onSnapshot listener won't double-trigger it
        localCandleEffectActiveRef.current = true
        setTimeout(() => { localCandleEffectActiveRef.current = false }, 20000)

        unifiedShrineRef.current.triggerCandleEffect(newOffering)
      }

      // Matchstick lighting
      if (isMobileView) {
        setMobileMatchstickLit(true);
        setHasLitCandleThisSession(true);
        setIsExpanded(false);
      } else if (shrineLeftPanelRef.current) {
        shrineLeftPanelRef.current.lightMatchstick();
      }

      // Mobile haptic feedback
      if (isMobileView && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate([50, 50, 50])
      }

      // Refresh offerings after ripple animation
      setTimeout(() => fetchOfferings(), 3000)

      // Reset processing flags after full effect completes
      setTimeout(() => {
        setIsProcessingCandle(false);
        setHasProcessedCandle(false);
      }, 15000);
    }

    // If user is looking at the page, play immediately.
    // If page is hidden (user in MetaMask/another app), queue until they return.
    if (document.hidden) {
      pendingCandleEffectRef.current = playEffects
    } else {
      playEffects()
    }
  };
  
  // Listen for openBuyModal event
  useEffect(() => {
    const handleOpenBuyModal = () => {
      setShowBuyModal(true);
    };
    
    window.addEventListener('openBuyModal', handleOpenBuyModal);
    return () => window.removeEventListener('openBuyModal', handleOpenBuyModal);
  }, []);
  
  // Lock body scroll on mount to prevent mobile viewport bounce/shift
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const savedHtmlOverflow = html.style.overflow
    const savedBodyOverflow = body.style.overflow
    const savedBodyPosition = body.style.position
    const savedBodyWidth = body.style.width
    const savedBodyHeight = body.style.height
    const savedBodyTop = body.style.top

    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.position = 'fixed'
    body.style.width = '100%'
    body.style.height = '100%'
    body.style.top = '0'

    return () => {
      html.style.overflow = savedHtmlOverflow
      body.style.overflow = savedBodyOverflow
      body.style.position = savedBodyPosition
      body.style.width = savedBodyWidth
      body.style.height = savedBodyHeight
      body.style.top = savedBodyTop
    }
  }, [])

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      overscrollBehavior: 'none',
    }}>
      {/* CoinLoader */}
      <CoinLoader loading={isLoading} />
      
      <style dangerouslySetInnerHTML={{ __html: `
        @font-face {
          font-family: 'UnifrakturMaguntia';
          src: url('/fonts/UnifrakturMaguntia-Regular.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        
        #text, .text__copy {
          font-family: 'UnifrakturMaguntia', serif !important;
        }
      `}} />
      
      {/* Unified Shrine Scene */}
      <div style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 1,
        pointerEvents: 'auto',
        touchAction: 'none',
      }}>
        {isClient && delayedMount ? (
          <UnifiedShrine
            ref={unifiedShrineRef}
            key={`shrine-scene-${pathname}-${mountKey}`} // Force complete remount when cache cleared
            offerings={offerings}
            totalOfferingsCount={totalOfferingsCount}
            currentUserId={user?.id}
            onSelectOffering={(offering) => {
              setHoveredOffering(offering)
              setSelectedCandle(offering)
              playCandleNote(offering.candleIndex)
            }}
            onLightCandle={(offering) => {
              // Don't set justLitOffering here - it's already set in handleLightCandle
              // This callback happens AFTER the effect completes, which is too late
            }}
            onPriceChange={setPriceChange}
            is80sMode={is80sMode}
            hoveredOffering={hoveredOffering}
            justLitOffering={justLitOffering}
            onJustLitComplete={() => {
              setJustLitOffering(null)
            }}
            user={user}
            onViewReset={() => {
              // View reset handled internally by UnifiedShrine
            }}
            showHelpOverlay={showHelpOverlay}
            onToggleHelp={() => setShowHelpOverlay(prev => !prev)}
            sortOption={sortOption}
            onSortChange={setSortOption}
            selectedCandle={selectedCandle}
            onRefreshOfferings={fetchOfferings}
          />
        ) : null}
      </div>
      
      {/* Title - positioned at top left, desktop/tablet only */}
      {/* {!isMobileView && (
      <h1 className='custom-title'
          id="main-title"
          style={{ 
            position: 'fixed',
            left: isMobileView ? '20px' : '40px',
            top: isMobileView ? '20px' : '40px',
            pointerEvents: 'auto',
            color: is80sMode ? "#ffffff" : "#d4af37",
            fontFamily: 'UnifrakturCook, serif',
            textShadow: is80sMode 
              ? `
                0 0 20px rgba(201, 55, 255, 0.9),
                0 0 40px rgba(201, 55, 255, 0.8),
                0 0 60px rgba(201, 55, 255, 0.7),
                4px 4px 12px rgba(201, 55, 255, 1),
                -2px -2px 8px rgba(255, 0, 255, 0.8),
                0 0 100px rgba(201, 55, 255, 0.5)
              `
              : `
                rgba(83, 61, 74, 0.9) 1px 1px,
                rgba(83, 61, 74, 0.9) 2px 2px,
                rgba(83, 61, 74, 0.8) 3px 3px,
                rgba(83, 61, 74, 0.8) 4px 4px,
                rgba(83, 61, 74, 0.7) 5px 5px,
                rgba(83, 61, 74, 0.7) 6px 6px,
                rgba(83, 61, 74, 0.6) 7px 7px,
                rgba(83, 61, 74, 0.6) 8px 8px,
                rgba(255, 192, 203, 0.4) -1px -1px 5px,
                rgba(0, 0, 0, 0.8) 10px 10px 15px
              `,
            fontSize: isMobileView ? "1.5rem" : "3rem",
            fontWeight: 900,
            lineHeight: 0.75,
            transform: "rotate(-8deg) skew(-15deg)",
            cursor: 'pointer',
            margin: 0,
            zIndex: 100,
          }}
          onClick={() => router?.push('/about')}
        >
          <span className="title-line" style={{ display: 'block', position: 'relative' }}>Our Lady</span>
          <span className="title-line" style={{ display: 'block', position: 'relative' }}>
            <span style={{ fontSize: isMobileView ? "1.2rem" : "1.6rem" }}>of    </span>
            Perpetual
          </span>
          <span className="title-line" style={{ display: 'block', marginLeft: isMobileView ? "2rem" : "3rem", position: 'relative' }}>Profit</span>
        </h1>
      )} */}
      
      {/* Only render ShrineLeftPanel on desktop/tablet after we know device type */}
      {mounted && !isMobileView && (
        <ShrineLeftPanel
          ref={shrineLeftPanelRef}
          is80sMode={is80sMode}
          isMobile={false}
          onLightCandle={handleLightCandleClick}
          router={router}
        />
      )}
      
      {/* Mobile CTA and Matchstick - Sliding Design */}
      {isMobileView && (
        <div
          onClick={() => {
            // If collapsed, expand. If already expanded, collapse it.
            // (The icon button uses stopPropagation, so this only fires on the body area)
            if (!isExpanded) {
              setIsExpanded(true);
            } else {
              setIsExpanded(false);
            }
          }}
          style={{
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            width: isExpanded ? 'calc(100% - 32px)' : '80px',
            maxWidth: isExpanded ? '340px' : '80px',
            background: 'rgba(10, 10, 20, 0.4)',
            border: '1px solid rgba(212, 175, 55, 0.15)',
            borderRadius: '50px',
            paddingTop: isExpanded ? '12px' : '10px',
            paddingRight: isExpanded ? '16px' : '10px',
            paddingLeft: isExpanded ? '16px' : '10px',
            boxShadow: `
              0 4px 20px rgba(0, 0, 0, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.05)
            `,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: isExpanded ? 'space-between' : 'center',
            gap: isExpanded ? '16px' : '0',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: 'pointer',
            overflow: 'visible',
            paddingBottom: isExpanded ? '12px' : '10px',
            marginBottom: isExpanded ? '-12px' : '0',
          }}>
          {/* Left side - Text (slides in/out) */}
          <div style={{
              flex: isExpanded ? 1 : 0,
              fontFamily: "'Bebas Neue', sans-serif",
              color: 'rgba(246, 245, 241, 0.9)',
              textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
              opacity: isExpanded ? 1 : 0,
              transform: isExpanded ? 'translateX(0)' : 'translateX(20px)',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              width: isExpanded ? 'auto' : '0',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: 400,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '2px',
              color: 'rgba(212, 175, 55, 0.9)',
              textAlign: 'center',
            }}>
              {t('illumin80.watchlistTitle')}
            </div>
            <div style={{
              fontSize: '1rem',
              opacity: 0.7,
              fontWeight: 300,
              textAlign: 'center',
            }}>
              {t('illumin80.lightGreenCandle')}
            </div>
          </div>

          {/* Matchstick Button */}
          <div
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering the parent onClick

              // If banner is collapsed, expand it first instead of opening modal
              if (!isExpanded) {
                setIsExpanded(true);
                return;
              }

              // Haptic feedback if available
              if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(50) // Short vibration
              }

              handleLightCandleClick();
            }}
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              flexShrink: 0,
              margin: isExpanded ? '0' : 'auto',
              background: mobileMatchstickLit
                ? 'radial-gradient(circle, rgba(255, 149, 0, 0.2) 0%, rgba(255, 100, 0, 0.05) 70%, transparent 100%)'
                : 'rgba(212, 175, 55, 0.1)',
              border: mobileMatchstickLit
                ? '1.5px solid rgba(255, 149, 0, 0.4)'
                : '1.5px solid rgba(212, 175, 55, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: mobileMatchstickLit
                ? '0 0 15px rgba(255, 149, 0, 0.3)'
                : '0 0 0 0 rgba(212, 175, 55, 0)',
              animation: mobileMatchstickLit
                ? 'none'
                : 'buttonPulse 2s ease-in-out infinite',
              position: 'relative',
              overflow: 'visible',
            }}
          >
            {/* Mobile button icon - changes based on banner type */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              pointerEvents: 'none',  // Prevent internal click handling
            }}>
              {mobileMatchstickLit ? (
                // Lit state - flame emoji
                <div style={{
                  fontSize: '32px',
                  animation: 'flicker 0.5s ease-in-out infinite',
                }}>
                  🔥
                </div>
              ) : (
                // Unlit state - matchstick SVG
                <img
                  src="/images/torchIcon.webp"
                  alt="Matchstick"
                  style={{
                    width: '28px',
                    height: '28px',
                    opacity: 0.9,
                    filter: 'brightness(1.2)',
                  }}
                />
              )}
            </div>
            
            {/* Pulse animation */}
            {mobileMatchstickLit ? (
              // Pulse for lit state
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                border: '2px solid rgba(255, 149, 0, 0.6)',
                animation: 'pulse 2s infinite',
                pointerEvents: 'none',
              }} />
            ) : (
              // Subtle glow ring for unlit state
              <div style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                boxShadow: '0 0 0 0 rgba(212, 175, 55, 0.4)',
                animation: 'inviteGlow 3s ease-in-out infinite',
                pointerEvents: 'none',
              }} />
            )}

            {/* Action indicator - only shows when expanded */}
            {isExpanded && (
              <div style={{
                position: 'absolute',
                bottom: '-18px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: '9px',
                fontFamily: "'Bebas Neue', sans-serif",
                color: 'rgba(212, 175, 55, 0.9)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                animation: 'tapBounce 1.5s ease-in-out infinite',
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
              }}>
                {t('illumin80.lightIt')}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Add keyframe animations */}
      <style jsx>{`
        @keyframes flicker {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
          25% { transform: scale(1.1) rotate(-5deg); opacity: 0.9; }
          50% { transform: scale(0.95) rotate(3deg); opacity: 1; }
          75% { transform: scale(1.05) rotate(-3deg); opacity: 0.95; }
        }
        
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 0; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        
        @keyframes candleGlow {
          0%, 100% { 
            opacity: 0.7;
            filter: drop-shadow(0 0 3px rgba(212, 175, 55, 0));
          }
          50% { 
            opacity: 0.9;
            filter: drop-shadow(0 0 8px rgba(212, 175, 55, 0.4));
          }
        }
        
        @keyframes inviteGlow {
          0%, 100% {
            box-shadow:
              0 0 0 0 rgba(212, 175, 55, 0),
              0 0 10px 2px rgba(212, 175, 55, 0.2);
          }
          50% {
            box-shadow:
              0 0 0 8px rgba(212, 175, 55, 0),
              0 0 20px 4px rgba(212, 175, 55, 0.3);
          }
        }

        @keyframes tapBounce {
          0%, 100% {
            transform: translateX(-50%) translateY(0);
            opacity: 0.8;
          }
          50% {
            transform: translateX(-50%) translateY(-3px);
            opacity: 1;
          }
        }

        @keyframes buttonPulse {
          0%, 100% {
            box-shadow: 
              0 0 0 0 rgba(212, 175, 55, 0.4),
              0 0 10px 2px rgba(212, 175, 55, 0.2);
            border-color: rgba(212, 175, 55, 0.15);
          }
          50% {
            box-shadow: 
              0 0 0 6px rgba(212, 175, 55, 0),
              0 0 20px 4px rgba(212, 175, 55, 0.3);
            border-color: rgba(212, 175, 55, 0.3);
          }
        }
      `}</style>
      
   
      
      
      {/* RL80 Logo - Mobile Only */}
      {fontLoaded && isMobileView && (
        <div style={{
          position: "fixed",
          top: "20px",
          left: "0.5rem",
          borderRadius: "8px",
          padding: "10px",
          pointerEvents: "none",
          zIndex: 999,
        }}>
          <div 
            id="text"
            style={{
              position: "relative",
              fontFamily: "'UnifrakturMaguntia', serif",
              fontSize: "3rem",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            <span style={{ textDecoration: 'none', color: 'inherit', display: 'inline-block' }}>
              RL80
            </span>
            {Array.from({length: 100}).map((_, i) => {
              const index = i + 1;
              const r80s = 201 - index * 2;
              const g80s = 55 - index * 3;
              const b80s = 256 - index * 2;
              const rNormal = 255 - index * 2;
              const gNormal = 255 - index * 3;
              const bNormal = 255 - index * 2;
              const translateX = index * 0.1;
              const translateY = index * 0.1;
              const scale = 1 + index * 0.01;
              
              const color80s = 'rgba(' + r80s + ', ' + g80s + ', ' + b80s + ')';
              const colorNormal = 'rgba(' + rNormal + ', ' + gNormal + ', ' + bNormal + ')';
              const transformStr = 'translate(' + translateX + 'rem, ' + translateY + 'rem) scale(' + scale + ')';
              
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
                    color: is80sMode ? color80s : colorNormal,
                    filter: "blur(0.1rem)",
                    transform: transformStr,
                    opacity: (1 / index) * 1.5,
                  }}
                >
                  RL80
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Nav Controls - Top Right */}
      <div style={{
        position: "fixed",
        top: "1rem",
        right: "0.5rem",
        zIndex: 999,
        pointerEvents: 'none'
      }}>
        <NavControlsHome
          isPlaying={contextIsPlaying}
          onPlayMusic={() => play()}
          onStopMusic={() => pause()}
          onSkipTrack={() => nextTrack()}
          onMenuClick={() => setIsMenuOpen(!isMenuOpen)}
          onUserClick={() => {}}
          isUserSignedIn={!!user}
          isMenuOpen={isMenuOpen}
          is80sMode={is80sMode}
          onToggle80sMode={() => setContext80sMode(!is80sMode)}
          userImage={user?.imageUrl}
          onBuyClick={() => setShowBuyModal(true)}
          isMobile={isMobileView}
          onHelpClick={null}
          showHelpActive={false}
          hideMusicOnMobile={true}
        />
      </div>

      {/* Help Button - bottom left */}
      <button
        onClick={() => setShowHelpOverlay(prev => !prev)}
        title="Show help annotations"
        style={{
          position: 'fixed',
          bottom: isMobileView ? 20 : 28,
          left: isMobileView ? 20 : 28,
          zIndex: 50,
          width: 40,
          height: 40,
          borderRadius: 10,
          background: showHelpOverlay
            ? (is80sMode ? 'rgba(255, 0, 255, 0.15)' : 'rgba(212, 175, 55, 0.15)')
            : (is80sMode ? 'rgba(255, 0, 255, 0.05)' : 'rgba(212, 175, 55, 0.05)'),
          border: `1.5px solid ${showHelpOverlay
            ? (is80sMode ? 'rgba(255, 0, 255, 0.5)' : 'rgba(212, 175, 55, 0.5)')
            : (is80sMode ? 'rgba(255, 0, 255, 0.2)' : 'rgba(212, 175, 55, 0.2)')}`,
          color: is80sMode ? '#ff00ff' : '#d4af37',
          fontSize: '1.3rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          backdropFilter: 'blur(8px)',
        }}
      >
        ?
      </button>

      {/* CyberNav Menu Panel */}
      <CyberNav
        is80sMode={is80sMode}
        position="fixed"
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        showButton={false}
      />
      
      {/* Thirdweb Buy Modal */}
      <ThirdwebBuyModal 
        isOpen={showBuyModal} 
        onClose={() => setShowBuyModal(false)}
      />
      
      {/* Light Candle Modal - Always mounted to allow snapshot renderer to complete */}
      <LightCandleModal
        key={modalKey}
        isOpen={showLightCandleModal}
        onClose={() => {
          setShowLightCandleModal(false);
          // Also clear any pending actions when modal is closed
          setWalletActionType(null);
          setShowAuthMessage(null);
        }}
        onLightCandle={(offering) => {

          // Close modal immediately when Light Candle is clicked
          setShowLightCandleModal(false);
          handleLightCandle(offering);
        }}
      />
      
      {/* Sign-In Message Overlay */}
      {showAuthMessage === 'sign-in' && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowAuthMessage(null)}
        >
          <div 
            style={{
              background: 'rgba(20, 20, 30, 0.98)',
              border: '1px solid rgba(138, 43, 226, 0.4)',
              borderRadius: '24px',
              padding: '3rem 2.5rem',
              maxWidth: '420px',
              textAlign: 'center',
              color: '#fff',
              boxShadow: '0 0 60px rgba(138, 43, 226, 0.3)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'transparent',
                border: 'none',
                color: '#ff006e',
                fontSize: '2rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.2s',
              }}
              onClick={() => setShowAuthMessage(null)}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            >
              ×
            </button>
            
            {/* Icon */}
            <div style={{ marginBottom: '1rem' }}>
              <img 
                src="/images/ILLUMIN80_TATTOO.webp" 
                alt="ILLUMIN80" 
                style={{ 
                  width: '60px', 
                  height: '60px', 
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 0 20px rgba(138, 43, 226, 0.8)) drop-shadow(0 0 40px rgba(138, 43, 226, 0.5)) drop-shadow(0 0 60px rgba(138, 43, 226, 0.3))'
                }} 
              />
            </div>
            
            <h2 style={{ 
              fontSize: '1.2rem', 
              marginBottom: '0.5rem', 
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              fontFamily: "'Orbitron', monospace"
            }}>
              Sign In Required
            </h2>
            <p style={{ 
              marginBottom: '2rem', 
              color: '#00f5d4',
              fontSize: '0.95rem',
              lineHeight: '1.5'
            }}>
              Please sign in to light a candle.
            </p>
            <SignInButton mode="modal" forceRedirectUrl="/illumin80">
              <button style={{
                padding: '1rem 2rem',
                background: '#fff',
                border: 'none',
                borderRadius: '50px',
                color: '#000',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                width: '100%',
                fontFamily: "'Orbitron', monospace",
                letterSpacing: '1px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.9)';
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = '#fff';
                e.target.style.transform = 'translateY(0)';
              }}
              >
                Continue →
              </button>
            </SignInButton>
          </div>
        </div>
      )}
      
      {/* Wallet Connection Modal */}
      {showWalletModal && (
        <WalletConnectionModal onClose={() => setShowWalletModal(false)} />
      )}
      

      
      {/* CandleSnapshotRenderer removed - snapshots no longer needed */}

    </div>
  )
}