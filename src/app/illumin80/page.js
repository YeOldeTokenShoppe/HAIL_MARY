'use client'

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react'
import NavControlsHome from '@/components/NavControlsHome'
import CyberNav from '@/components/CyberNav'
import { useUser, SignInButton } from '@clerk/nextjs'
import { useMusic } from '@/components/MusicContext'
import { useWalletAuth } from '@/components/WalletAuthProvider'
import ThirdwebBuyModal from '@/components/ThirdwebBuyModal'
import LightCandleModal from '@/components/LightCandleModal'
import StakeModal from '@/components/StakeModal'
import { WalletConnectionModal } from '@/components/WalletConnectionModal'
import { useRouter, usePathname } from 'next/navigation'
import ShrineLeftPanel from '@/components/ShrineLeftPanel'
import { db, collection, getDocs, query, orderBy, limit, onSnapshot, updateDoc, doc } from '@/lib/firebaseClient'
import UnifiedShrine from '@/components/UnifiedShrine'
import PolaroidDisplay from '@/components/PolaroidDisplay'
import CoinLoader from '@/components/CoinLoader'

// CandleSnapshotRenderer removed - no longer needed

// Tiny Votive Model Component

export default function ShrinePage() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isLoaded: userLoaded, isSignedIn } = useUser()
  const { isWalletConnected, walletAddress, connectWallet } = useWalletAuth()
  const unifiedShrineRef = useRef()
  const shrineLeftPanelRef = useRef()
  const latestOfferingRef = useRef(null) // Track the latest offering ID for updating with polaroid URL
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
  const [showStakeModal, setShowStakeModal] = useState(false)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [showAuthMessage, setShowAuthMessage] = useState(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
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
  const [mobileBannerType, setMobileBannerType] = useState('candle') // 'candle' or 'staking'
  const is80sMode = context80sMode
  
  // State for offerings data
  const [hoveredOffering, setHoveredOffering] = useState(null)
  const [justLitOffering, setJustLitOfferingOriginal] = useState(null)
  
  // Wrap setJustLitOffering to log ALL calls
  const setJustLitOffering = (offering) => {
    console.log('🚨 [ALL CALLS] setJustLitOffering called with:', {
      offering: offering?.username || offering,
      timestamp: Date.now(),
      stack: new Error().stack?.split('\n')[2]?.trim()
    })
    setJustLitOfferingOriginal(offering)
  }
  const [priceChange, setPriceChange] = useState(0)
  const [offerings, setOfferings] = useState([])
  const [totalOfferingsCount, setTotalOfferingsCount] = useState(0)
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(true)
  const [isHighlightingCandle, setIsHighlightingCandle] = useState(false)


  const [isClient, setIsClient] = useState(false)
  const [delayedMount, setDelayedMount] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [mountKey, setMountKey] = useState(0)

useEffect(() => {
  console.log('[Illumin80] Setting isClient to true')
  setIsClient(true)
}, [])

useEffect(() => {
  let mounted = true
  
  // Enhanced preload for navigation issues
  const handleMount = async () => {
    try {
      console.log('[Illumin80] Page mounting, checking for navigation issues...')
      
      // Import and preload the model
      const { useGLTF } = await import('@react-three/drei')
      
      // Clear the GLTF cache completely to ensure fresh load
      if (useGLTF.clear) {
        useGLTF.clear()  // Clear all cached models
        console.log('[Illumin80] Cleared all GLTF cache')
      }
      
      // Force fresh preload of the model
      useGLTF.preload('/models/tinyJapCanOnly.glb')
      console.log('[Illumin80] Model preload initiated after cache clear')
      
      // Reset any existing Three.js state that might interfere
      if (typeof window !== 'undefined') {
        // Reset shared uniforms if they exist
        if (window.sharedUniforms) {
          console.log('[Illumin80] Resetting shared uniforms for fresh start')
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
          console.log('[Illumin80] Clearing Three.js devtools cache')
        }
        
        // Force garbage collection if available (for debugging)
        if (window.gc && typeof window.gc === 'function') {
          try {
            window.gc()
            console.log('[Illumin80] Triggered garbage collection')
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
          console.log('[Illumin80] Ready to mount UnifiedShrine')
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
            console.log('[Illumin80] Fallback mount after error')
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

  // Fetch offerings from Firestore
  const fetchOfferings = useCallback(async () => {
    try {
      setIsLoadingOfferings(true)
      
      // Get total count of all offerings (more efficient than fetching all docs)
      // Note: If count() is not available in your Firebase version, uncomment the lines below
      // const countSnapshot = await getDocs(collection(db, 'offerings'))
      // setTotalOfferingsCount(countSnapshot.size)
      
      // For now, using getDocs until we verify Firebase version supports count()
      const countSnapshot = await getDocs(collection(db, 'offerings'))
      setTotalOfferingsCount(countSnapshot.size)
      
      // Get recent offerings for display
      const offeringsQuery = query(
        collection(db, 'offerings'),
        orderBy('createdAt', 'desc'),
        limit(50)  // Increased from 20 to 50
      )
      
      const snapshot = await getDocs(offeringsQuery)
      const fetchedOfferings = []
      
      snapshot.forEach((doc) => {
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
          polaroidUrl: data.polaroidUrl, // Add polaroidUrl field
          imageUrl: data.imageUrl, // Also check for imageUrl field
          timestamp: data.timestamp || 'just now',
          createdAt: data.createdAt, // Preserve the original Firestore timestamp
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
        
        fetchedOfferings.push(offering)
      })
      
      setOfferings(fetchedOfferings)
    } catch (error) {
      console.error('Error fetching offerings:', error)
      // Fallback to empty array on error
      setOfferings([])
    } finally {
      setIsLoadingOfferings(false)
    }
  }, [])

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
          // Only trigger the effect if this is from ANOTHER user (not the current user)
          // The current user's candle effect is already triggered in handleLightCandle
          const isCurrentUser = latestOffering.userId === user?.id || 
                               latestOffering.walletAddress === walletAddress
          
          if (!isCurrentUser) {
            console.log('New offering detected from another user!', latestOffering)
            
            // Trigger the pulse effect for all candles
            if (unifiedShrineRef.current) {
              unifiedShrineRef.current.triggerCandleEffect(latestOffering)
            }
          }
          
          // Always update the offerings list regardless of who lit the candle
          // Delay fetching to sync count update with ripple effect
          setTimeout(() => {
            // Fetch will update both offerings list AND total count
            fetchOfferings()
          }, 3000) // 3 second delay - ripple is well visible before count updates
        }
        
        lastOfferingId = latestDoc.id
      }
    })
    
    // Refresh offerings every 30 seconds as backup
    const interval = setInterval(fetchOfferings, 30000)
    
    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [fetchOfferings, unifiedShrineRef, user?.id, walletAddress])

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
    console.log('🔥 [BUTTON CLICK] handleLightCandleClick called', {
      isProcessingCandle,
      hasProcessedCandle,
      showLightCandleModal,
      isSignedIn,
      isWalletConnected,
      walletAddress
    });

    // Don't light the matchstick here - only light it when candle is actually lit
    // This prevents the flame from showing if user cancels

    // Reset the flags when user explicitly clicks to light a new candle
    // This allows users to light multiple candles in a session
    setHasProcessedCandle(false);
    setIsProcessingCandle(false);

    // Check if user is signed in
    if (!isSignedIn) {
      console.log('❌ [AUTH CHECK] User not signed in');
      setShowAuthMessage('sign-in');
      return;
    }

    // Check if wallet is connected
    if (!isWalletConnected || !walletAddress) {
      console.log('❌ [WALLET CHECK] Wallet not connected');
      setShowWalletModal(true);
      setWaitingForWallet(true); // Set flag that we're waiting for wallet connection
      setWalletActionType('candle'); // Track that this is for lighting a candle
      return;
    }

    // Both signed in and wallet connected - show the modal
    console.log('✅ [OPENING MODAL] Setting showLightCandleModal to true');
    setModalKey(prev => prev + 1); // Force modal to remount with fresh state
    setShowLightCandleModal(true);
  };
  
  // Handle stake button click with auth check
  const handleStakeClick = () => {
    // Check if user is signed in
    if (!isSignedIn) {
      setShowAuthMessage('sign-in-stake');
      return;
    }

    // Check if wallet is connected
    if (!isWalletConnected || !walletAddress) {
      setShowWalletModal(true);
      setWaitingForWallet(true); // Set flag that we're waiting for wallet connection for staking
      setWalletActionType('stake'); // Track that this is for staking
      return;
    }

    // Both signed in and wallet connected - show the modal
    setShowStakeModal(true);
  };

  // Handle finding user's candle
  const handleFindCandle = () => {
    setIsHighlightingCandle(true);
    // Call the UnifiedShrine's findUserCandle method
    if (unifiedShrineRef.current) {
      unifiedShrineRef.current.findUserCandle();
    }
  };

  // Handle returning to main view
  const handleResetView = () => {
    setIsHighlightingCandle(false);
    // Call the UnifiedShrine's resetView method
    if (unifiedShrineRef.current) {
      unifiedShrineRef.current.resetView();
    }
  };
  
  // Track if we're waiting for wallet connection and what action triggered it
  const [waitingForWallet, setWaitingForWallet] = useState(false);
  const [walletActionType, setWalletActionType] = useState(null); // 'candle' or 'stake'
  
  // Watch for wallet connection
  useEffect(() => {
    if (isWalletConnected && (showWalletModal || waitingForWallet)) {
      setShowWalletModal(false);
      setWaitingForWallet(false);
      
      // Open the appropriate modal based on what action triggered wallet connection
      // But only if we're not already processing a candle and haven't processed one
      if (walletActionType === 'stake') {
        setShowStakeModal(true);
      } else if (walletActionType === 'candle' && !isProcessingCandle && !hasProcessedCandle) {
        setShowLightCandleModal(true);
      }
      
      setWalletActionType(null); // Reset the action type
    }
  }, [isWalletConnected, showWalletModal, waitingForWallet, walletActionType, isProcessingCandle, hasProcessedCandle]);

  // Watch for successful sign-in and resume the intended action
  useEffect(() => {
    if (isSignedIn && userLoaded && showAuthMessage) {
      // Clear the auth message
      const actionType = showAuthMessage;
      setShowAuthMessage(null);
      
      // Small delay to allow test wallet auto-assignment to complete
      setTimeout(() => {
        // After sign-in, check wallet connection
        if (!isWalletConnected || !walletAddress) {
          // Need wallet connection
          setShowWalletModal(true);
          setWaitingForWallet(true);
          setWalletActionType(actionType === 'sign-in-stake' ? 'stake' : 'candle');
        } else {
          // Already have wallet, show the appropriate modal
          // But only if we're not already processing a candle and haven't processed one
          if (actionType === 'sign-in-stake') {
            setShowStakeModal(true);
          } else if (!isProcessingCandle && !hasProcessedCandle) {
            setShowLightCandleModal(true);
          }
        }
      }, 500); // 500ms delay for test wallet assignment
    }
  }, [isSignedIn, userLoaded, showAuthMessage, isWalletConnected, walletAddress, isProcessingCandle, hasProcessedCandle]);

  // Handle light candle from modal
  const handleLightCandle = async (newOffering) => {
    console.log('🚀 [HANDLE LIGHT CANDLE] Starting handleLightCandle with offering:', {
      offering: newOffering?.username || 'Anonymous',
      timestamp: Date.now()
    })
    
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
    
    // IMMEDIATELY set notification to sync with arctic rings (2.5s after candle is lit)
    setTimeout(() => {
      console.log('🔔 [NOTIFICATION] Showing notification when arctic rings appear');
      setJustLitOffering(newOffering);
      
      // Clear notification after display duration
      setTimeout(() => {
        console.log('⏰ [NOTIFICATION] Clearing notification');
        setJustLitOffering(null);
      }, 10000); // Show for 10 seconds - nice long display time
    }, 3500); // 2.5s to match when arctic rings appear
    
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
    console.log('[ShrinePage] Snapshot capture disabled - feature removed');
    
    // Set up a function to receive the offering ID
    window.setLatestOfferingId = (id) => {
      console.log('[ShrinePage] Setting latest offering ID:', id);
      latestOfferingRef.current = id;
    };
    
    // Set up a listener for when the polaroid is ready
    window.onPolaroidReady = async (url) => {
      console.log('[ShrinePage] Polaroid ready:', url);
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
          console.log('[ShrinePage] Updated offering with polaroid URL');
          
          // After delay, mark as ready for display
          setTimeout(async () => {
            await updateDoc(offeringDoc, {
              polaroidReady: true
            });
            console.log('[ShrinePage] Marked polaroid as ready for display');
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
        console.log('[ShrinePage] Triggering polaroid snapshot display');
        setShowPolaroid(true);
        setHasDismissedPolaroid(false);
      }, 1000); // 3 seconds - shows shortly after candle lands
    };
    
    // Trigger the candle launch animation
    console.log('🎨 [TRIGGER EFFECT] Calling triggerCandleEffect with offering:', {
      offering: newOffering?.username || 'Anonymous', 
      timestamp: Date.now()
    })
    if (unifiedShrineRef.current) {
      unifiedShrineRef.current.triggerCandleEffect(newOffering)
    }
    
    // Set the matchstick to lit state when candle is successfully lit
    if (isMobileView) {
      setMobileMatchstickLit(true);
      // Mark that user has lit a candle this session
      setHasLitCandleThisSession(true);
      // Collapse the banner if it's expanded
      setIsExpanded(false);
    } else if (shrineLeftPanelRef.current) {
      // Light the desktop matchstick
      shrineLeftPanelRef.current.lightMatchstick();
    }
    
    // Mobile haptic feedback
    if (isMobileView && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate([50, 50, 50]) // Pattern vibration
    }
    
    // Delay refreshing offerings to sync with ripple animation
    setTimeout(() => {
      fetchOfferings()
    }, 3000) // 3 second delay - same as remote offerings

    // Reset processing flags after candle effect completes (about 15 seconds total)
    // This allows the user to light another candle if they want
    setTimeout(() => {
      console.log('✅ [CLEANUP] Resetting candle processing flags');
      setIsProcessingCandle(false);
      setHasProcessedCandle(false);
    }, 15000); // 15 seconds - enough time for the full candle effect to complete

    // Don't reset matchsticks anymore - they stay lit after user lights a candle
    // The desktop matchstick will stay lit via hasLitCandleThisSession state
    // The mobile matchstick already stays lit
  };
  
  // Listen for openBuyModal event
  useEffect(() => {
    const handleOpenBuyModal = () => {
      setShowBuyModal(true);
    };
    
    window.addEventListener('openBuyModal', handleOpenBuyModal);
    return () => window.removeEventListener('openBuyModal', handleOpenBuyModal);
  }, []);
  
  // Auto-alternate between candle and staking banners on mobile
  useEffect(() => {
    if (!isMobileView || hasLitCandleThisSession) return;
    
    const interval = setInterval(() => {
      setMobileBannerType(prev => prev === 'candle' ? 'staking' : 'candle');
    }, 8000); // Switch every 8 seconds
    
    return () => clearInterval(interval);
  }, [isMobileView, hasLitCandleThisSession]);

  return (
    <>
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
        pointerEvents: 'auto'
      }}>
        {isClient && delayedMount ? (
          <UnifiedShrine 
            ref={unifiedShrineRef}
            key={`shrine-scene-${pathname}-${mountKey}`} // Force complete remount when cache cleared
            offerings={offerings}
            totalOfferingsCount={totalOfferingsCount}
            currentUserId={user?.id}
            onSelectOffering={setHoveredOffering}
            onLightCandle={(offering) => {
              console.log('🔥 [SHRINE CALLBACK] onLightCandle called from UnifiedShrine:', {
                offering: offering?.username || 'Anonymous',
                timestamp: Date.now(),
                stack: new Error().stack?.split('\n')[1]?.trim()
              })
              // Don't set justLitOffering here - it's already set in handleLightCandle
              // This callback happens AFTER the effect completes, which is too late
            }}
            onPriceChange={setPriceChange}
            is80sMode={is80sMode}
            hoveredOffering={hoveredOffering}
            justLitOffering={justLitOffering}
            onJustLitComplete={() => {
              console.log('✅ [COMPLETE CALLBACK] setJustLitOffering(null) called from onJustLitComplete')
              setJustLitOffering(null)
            }}
            user={user}
            onViewReset={() => {
              setIsHighlightingCandle(false)
            }}
          />
        ) : null}
      </div>
      
      {/* Title - positioned at top left, desktop/tablet only */}
      {!isMobileView && (
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
      )}
      
      {/* Only render ShrineLeftPanel on desktop/tablet after we know device type */}
      {mounted && !isMobileView && (
        <ShrineLeftPanel
          ref={shrineLeftPanelRef}
          is80sMode={is80sMode}
          isMobile={false}
          onLightCandle={handleLightCandleClick}
          onStakeClick={handleStakeClick}
          router={router}
          onFindCandle={handleFindCandle}
          onResetView={handleResetView}
          isHighlighting={isHighlightingCandle}
          hasActiveCandle={offerings.some(o => {
            if (o.userId !== user?.id) return false
            const litAt = o.createdAt?.toDate?.()?.getTime?.() || o.createdAt
            if (!litAt) return false
            return (Date.now() - litAt) / 1000 < 300
          })}
        />
      )}
      
      {/* Mobile CTA and Matchstick - Sliding Design */}
      {isMobileView && (
        <div 
          onClick={() => {
            // Don't expand if user has already lit a candle
            if (hasLitCandleThisSession) return;
            
            // If collapsed, just expand. If already expanded, do nothing (let the button handle the click)
            if (!isExpanded) {
              setIsExpanded(true);
            }
          }}
          style={{
            position: 'fixed',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: (isExpanded && !hasLitCandleThisSession) ? 'calc(100% - 32px)' : '80px',
            maxWidth: (isExpanded && !hasLitCandleThisSession) ? '340px' : '80px',
            background: 'rgba(10, 10, 20, 0.4)',
            border: mobileBannerType === 'candle' 
              ? '1px solid rgba(212, 175, 55, 0.15)'
              : '1px solid rgba(0, 245, 212, 0.15)',
            borderRadius: '50px',
            padding: isExpanded ? '12px 16px' : '10px',
            boxShadow: `
              0 4px 20px rgba(0, 0, 0, 0.3),
              inset 0 1px 0 rgba(255, 255, 255, 0.05)
            `,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: isExpanded ? 'space-between' : 'center',
            gap: isExpanded ? '16px' : '0',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            cursor: 'pointer',
            overflow: 'hidden',
          }}>
          {/* Left side - Text (slides in/out, hidden if user has lit candle) */}
          {!hasLitCandleThisSession && (
            <div style={{
              flex: isExpanded ? 1 : 0,
              fontFamily: "'Bebas Neue', sans-serif",
              color: 'rgba(246, 245, 241, 0.9)',
              textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
              opacity: isExpanded ? 1 : 0,
              transform: isExpanded ? 'translateX(0)' : 'translateX(-20px)',
              transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
              width: isExpanded ? 'auto' : '0',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}>
            {mobileBannerType === 'candle' ? (
              <>
                <div style={{ 
                  fontSize: '1.5rem',
                  fontWeight: 400,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '2px',
                  color: 'rgba(212, 175, 55, 0.9)',
                  textAlign: 'center',
                }}>
                  Get On Her Watchlist
                </div>
                <div style={{ 
                  fontSize: '1rem',
                  opacity: 0.7,
                  fontWeight: 300,
                  textAlign: 'center',
                }}>
                  Light a Green Candle!
                </div>
                <div style={{ 
                  fontSize: '0.65rem',
                  opacity: 0.5,
                  fontWeight: 300,
                  marginTop: '0.3rem',
                  fontStyle: 'italic',
                  textAlign: 'center',
                  width: '100%',
                }}>
                  Sign in + hold RL80 to participate
                </div>
              </>
            ) : (
              <>
                <div style={{ 
                  fontSize: '1.5rem',
                  fontWeight: 400,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: '2px',
                  color: 'rgba(0, 245, 212, 0.9)',
                  textAlign: 'center',
                }}>
                  STAKE RL80 TOKENS
                </div>
                <div style={{ 
                  fontSize: '1rem',
                  opacity: 0.7,
                  fontWeight: 300,
                  textAlign: 'center',
                }}>
                  Earn ETH Rewards!
                </div>
                <div style={{ 
                  fontSize: '0.65rem',
                  opacity: 0.5,
                  fontWeight: 300,
                  marginTop: '0.3rem',
                  fontStyle: 'italic',
                  textAlign: 'center',
                  width: '100%',
                }}>
                  Sign in + connect wallet to stake
                </div>
              </>
            )}
          </div>
          )}
          
          {/* Matchstick or Stake Button - Changes based on banner type */}
          <div 
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering the parent onClick
              
              // If user has lit a candle, clicking the flame does nothing (or could reopen modal)
              if (hasLitCandleThisSession) {
                // Optionally, you could still allow them to light another candle:
                // handleLightCandleClick();
                return; // For now, just do nothing
              }
              
              // If banner is collapsed, expand it first instead of opening modal
              if (!isExpanded) {
                setIsExpanded(true);
                return;
              }
              
              // If banner is expanded, then open the appropriate modal
              // Haptic feedback if available
              if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(50) // Short vibration
              }
              
              // Open different modal based on banner type
              if (mobileBannerType === 'candle') {
                handleLightCandleClick();
              } else {
                handleStakeClick();
              }
            }}
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              flexShrink: 0,
              background: mobileBannerType === 'candle' 
                ? (mobileMatchstickLit 
                  ? 'radial-gradient(circle, rgba(255, 149, 0, 0.2) 0%, rgba(255, 100, 0, 0.05) 70%, transparent 100%)'
                  : 'rgba(212, 175, 55, 0.1)')
                : 'rgba(0, 245, 212, 0.1)',
              border: mobileBannerType === 'candle'
                ? (mobileMatchstickLit 
                  ? '1.5px solid rgba(255, 149, 0, 0.4)' 
                  : '1.5px solid rgba(212, 175, 55, 0.15)')
                : '1.5px solid rgba(0, 245, 212, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: mobileBannerType === 'candle'
                ? (mobileMatchstickLit
                  ? '0 0 15px rgba(255, 149, 0, 0.3)'
                  : '0 0 0 0 rgba(212, 175, 55, 0)')
                : '0 0 0 0 rgba(0, 245, 212, 0)',
              animation: mobileMatchstickLit
                ? 'none'
                : 'buttonPulse 2s ease-in-out infinite',
              position: 'relative',
              overflow: 'hidden',
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
              {mobileBannerType === 'candle' ? (
                // Candle mode - show matchstick or flame
                mobileMatchstickLit ? (
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
                )
              ) : (
                // Staking mode - show stake icon
                <img 
                  src="/images/stakeIcon.webp"
                  alt="Stake"
                  style={{
                    width: '44px',
                    height: '44px',
                    objectFit: 'contain',
                    opacity: 0.9,
                    filter: 'brightness(1.1)',
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
      
      {/* Tiny Candle Button with Glowing Arrow - Bottom Right - Desktop Only */}
      {!isMobileView && (
        <>
          {/* Bottom-Right Corner Vignette - layered for smooth blending */}
          {/* Outer soft layer */}
          <div style={{
            position: "fixed",
            bottom: "-50px",
            right: "-50px",
            width: "500px",
            height: "350px",
            zIndex: 3,
            pointerEvents: "none",
            background: `radial-gradient(
              circle at 100% 100%,
              rgba(10,10,20,0.5) 0%,
              rgba(10,10,20,0.35) 30%,
              rgba(10,10,20,0.2) 50%,
              rgba(10,10,20,0.1) 70%,
              transparent 90%
            )`,
            filter: "blur(20px)",
          }} />
          
          {/* Middle layer */}
          <div style={{
            position: "fixed",
            bottom: "-20px",
            right: "-20px",
            width: "420px",
            height: "280px",
            zIndex: 3,
            pointerEvents: "none",
            background: `radial-gradient(
              ellipse 450px 300px at 100% 100%,
              rgba(10,10,20,0.7) 0%,
              rgba(10,10,20,0.55) 25%,
              rgba(10,10,20,0.35) 45%,
              rgba(10,10,20,0.2) 65%,
              transparent 85%
            )`,
            filter: "blur(8px)",
          }} />
          
          {/* Inner focused layer */}
          <div style={{
            position: "fixed",
            bottom: 0,
            right: 0,
            width: "350px",
            height: "220px",
            zIndex: 3,
            pointerEvents: "none",
            background: `radial-gradient(
              ellipse at 100% 100%,
              rgba(10,10,20,0.9) 0%,
              rgba(10,10,20,0.7) 30%,
              rgba(10,10,20,0.4) 55%,
              transparent 80%
            )`,
            filter: "blur(2px)",
          }} />

          <div 
            className="candle-button"
            style={{
              position: "fixed",
              bottom: "30px",
              right: "30px",
              width: "80px",
              height: "80px",
              zIndex: 297,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "transform 0.3s ease, filter 0.3s ease",
            }}
            onClick={() => router.push('/trade')}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.15) rotate(-5deg)";
              e.currentTarget.style.filter = "drop-shadow(0 0 20px #ff9500)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1) rotate(0deg)";
              e.currentTarget.style.filter = "none";
            }}
          >
            <img 
              src="/images/3ACES_TATTOO.webp"
              alt="Tiny Candle Button"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
              }}
            />
          </div>
          
          {/* Glowing Arrow with Text */}
          <svg
            className="luminarium-arrow"
            style={{
              position: "fixed",
              bottom: "20px",
              right: "20px",
              width: "300px",
              height: "150px",
              zIndex: 296,
              pointerEvents: "auto",
              cursor: "pointer",
            }}
            viewBox="0 0 300 150"
            onClick={() => router.push('/trade')}
        onMouseEnter={(e) => {
          const text = e.currentTarget.querySelector('text');
          const arrow = e.currentTarget.querySelector('#arrowPath');
          const arrowHead = e.currentTarget.querySelector('.arrow-head');
          if (text) {
            text.style.fontSize = '32';
            text.style.fill = '#ffffff';
            text.style.filter = 'url(#glow) drop-shadow(0 0 10px #ffcc00)';
          }
          if (arrow) {
            arrow.style.strokeWidth = '3.5';
            arrow.style.filter = 'url(#glow) drop-shadow(0 0 15px #ff9500)';
          }
          if (arrowHead) {
            arrowHead.style.strokeWidth = '3.5';
          }
        }}
        onMouseLeave={(e) => {
          const text = e.currentTarget.querySelector('text');
          const arrow = e.currentTarget.querySelector('#arrowPath');
          const arrowHead = e.currentTarget.querySelector('.arrow-head');
          if (text) {
            text.style.fontSize = '28';
            text.style.fill = '#ffcc00';
            text.style.filter = 'url(#candleGlow)';
          }
          if (arrow) {
            arrow.style.strokeWidth = '2.5';
            arrow.style.filter = 'url(#glow)';
          }
          if (arrowHead) {
            arrowHead.style.strokeWidth = '2.5';
          }
        }}
      >
        {/* Define gradients and filters */}
        <defs>
          <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#ffcc00" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ff9500" stopOpacity="1" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="candleGlow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feFlood floodColor="#ff9500" floodOpacity="0.4"/>
            <feComposite in2="coloredBlur" operator="in"/>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Curved arrow path */}
        <path
          id="arrowPath"
          d="M 20 100 Q 100 40, 200 60"
          stroke="url(#arrowGradient)"
          strokeWidth="2.5"
          fill="none"
          filter="url(#glow)"
          strokeLinecap="round"
          opacity="0.9"
        >
          <animate
            attributeName="stroke-opacity"
            values="0.6;1;0.6"
            dur="2.5s"
            repeatCount="indefinite"
          />
        </path>
        
        {/* Invisible path for text (offset above the arrow) */}
        <path
          id="textPath"
          d="M 20 85 Q 100 25, 200 45"
          fill="none"
          stroke="none"
        />
        
        {/* Arrow head */}
        <path
          className="arrow-head"
          d="M 195 55 L 205 60 L 195 65"
          stroke="url(#arrowGradient)"
          strokeWidth="2.5"
          fill="none"
          filter="url(#glow)"
          strokeLinecap="round"
        >
          <animate
            attributeName="stroke-opacity"
            values="0.6;1;0.6"
            dur="2.5s"
            repeatCount="indefinite"
          />
        </path>
        
        {/* Text along path - placeholder for user to update */}
        <text
          fill="#ffcc00"
          fontSize="28"
          fontFamily="'UnifrakturMaguntia', cursive"
          filter="url(#candleGlow)"
          style={{ transition: "all 0.3s ease" }}
        >
          <textPath href="#textPath" startOffset="5%">
            Trade School
          </textPath>
          <animate
            attributeName="fill-opacity"
            values="0.7;1;0.7"
            dur="3s"
            repeatCount="indefinite"
          />
        </text>
        
        {/* Floating particles */}
        {[...Array(6)].map((_, i) => (
          <circle
            key={i}
            r="1.5"
            fill="#ffcc00"
            filter="url(#glow)"
          >
            <animateMotion
              dur={`${4 + i}s`}
              repeatCount="indefinite"
              path="M 20 100 Q 100 40, 200 60"
            >
              <mpath href="#arrowPath" />
            </animateMotion>
            <animate
              attributeName="opacity"
              values="0;1;0"
              dur={`${4 + i}s`}
              repeatCount="indefinite"
            />
            <animate
              attributeName="r"
              values="0.5;2;0.5"
              dur={`${4 + i}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
          </svg>
        </>
      )}
      
      
      {/* RL80 Logo - Mobile Only */}
      {fontLoaded && isMobileView && (
        <div style={{
          position: "fixed",
          top: "20px", 
          left: "20px",
          borderRadius: "8px",
          padding: "10px",
          pointerEvents: "auto",
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
        right: "1rem",
        zIndex: 999,
        pointerEvents: 'auto'
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
        />
      </div>
      
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
          console.log('🚪 [MODAL] Closing modal via onClose');
          setShowLightCandleModal(false);
          // Also clear any pending actions when modal is closed
          setWalletActionType(null);
          setShowAuthMessage(null);
        }}
        onLightCandle={(offering) => {
          console.log('💡 [MODAL CALLBACK] onLightCandle called from LightCandleModal:', {
            offering: offering?.username || 'Anonymous',
            timestamp: Date.now()
          })
          // Close modal immediately when Light Candle is clicked
          setShowLightCandleModal(false);
          handleLightCandle(offering);
        }}
      />
      
      {/* Stake Modal */}
      <StakeModal
        isOpen={showStakeModal}
        onClose={() => setShowStakeModal(false)}
        currentPhase={1} // Phase 1: Pre-rewards. Change to 2, 3, or 4 as protocol evolves
        onStake={async (stakeData) => {
          console.log('Stake submitted:', stakeData);
          // TODO: Implement actual staking logic here
        }}
      />
      
      {/* Sign-In Message Overlay */}
      {(showAuthMessage === 'sign-in' || showAuthMessage === 'sign-in-stake') && (
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
            zIndex: 100,
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
              Please sign in to {showAuthMessage === 'sign-in-stake' ? 'stake tokens' : 'light a candle'}.
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
      
    </>
  )
}