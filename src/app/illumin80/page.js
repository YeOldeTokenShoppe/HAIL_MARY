'use client'

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react'
import dynamic from 'next/dynamic'
import NavControlsHome from '@/components/NavControlsHome'
import CyberNav from '@/components/CyberNav'
import Link from 'next/link'
import { useUser, SignInButton } from '@clerk/nextjs'
import { useMusic } from '@/components/MusicContext'
import { useWalletAuth } from '@/components/WalletAuthProvider'
import ThirdwebBuyModal from '@/components/ThirdwebBuyModal'
import LightCandleModal from '@/components/LightCandleModal'
import StakeModal from '@/components/StakeModal'
import { WalletConnectionModal } from '@/components/WalletConnectionModal'
import { useRouter } from 'next/navigation'
import ShrineLeftPanel from '@/components/ShrineLeftPanel'
import { db, collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit, onSnapshot } from '@/lib/firebaseClient'
import UnifiedShrine from '@/components/UnifiedShrine'


// Tiny Votive Model Component

export default function ShrinePage() {
  const router = useRouter()
  const { user, isLoaded: userLoaded, isSignedIn } = useUser()
  const { isWalletConnected, walletAddress, connectWallet } = useWalletAuth()
  const unifiedShrineRef = useRef()
  const shrineLeftPanelRef = useRef()
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
  const [showStakeModal, setShowStakeModal] = useState(false)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [showAuthMessage, setShowAuthMessage] = useState(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [currentView, setCurrentView] = useState('shrine')
  const [mounted, setMounted] = useState(false)
  const [mobileMatchstickLit, setMobileMatchstickLit] = useState(false)
  const [remountKey, setRemountKey] = useState(0)
  const [isExpanded, setIsExpanded] = useState(false)
  const [hasLitCandleThisSession, setHasLitCandleThisSession] = useState(false)
  const is80sMode = context80sMode
  
  // State for offerings data
  const [hoveredOffering, setHoveredOffering] = useState(null)
  const [justLitOffering, setJustLitOffering] = useState(null)
  const [priceChange, setPriceChange] = useState(0)
  const [offerings, setOfferings] = useState([])
  const [totalOfferingsCount, setTotalOfferingsCount] = useState(0)
  const [isLoadingOfferings, setIsLoadingOfferings] = useState(true)


  const [isClient, setIsClient] = useState(false)
  const [delayedMount, setDelayedMount] = useState(false)

useEffect(() => {
  setIsClient(true)
}, [])

useEffect(() => {
  // Small delay to let previous page fully cleanup
  const timer = setTimeout(() => {
    setDelayedMount(true)
  }, 100)
  
  return () => {
    clearTimeout(timer)
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
          timestamp: data.timestamp || 'just now',
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
          console.log('New offering detected from another user!', latestOffering)
          
          // Trigger the pulse effect for all candles
          if (unifiedShrineRef.current) {
            unifiedShrineRef.current.triggerCandleEffect(latestOffering)
          }
          
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
  
  // Track if we're waiting for wallet connection and what action triggered it
  const [waitingForWallet, setWaitingForWallet] = useState(false);
  const [walletActionType, setWalletActionType] = useState(null); // 'candle' or 'stake'
  
  // Watch for wallet connection
  useEffect(() => {
    if (isWalletConnected && (showWalletModal || waitingForWallet)) {
      setShowWalletModal(false);
      setWaitingForWallet(false);
      
      // Open the appropriate modal based on what action triggered wallet connection
      if (walletActionType === 'stake') {
        setShowStakeModal(true);
      } else if (walletActionType === 'candle') {
        setShowLightCandleModal(true);
      }
      
      setWalletActionType(null); // Reset the action type
    }
  }, [isWalletConnected, showWalletModal, waitingForWallet, walletActionType]);

  // Handle light candle from modal
  const handleLightCandle = async (newOffering) => {
    // Trigger the candle launch animation (this will also show on phone via onLightCandle callback)
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

  return (
    <>
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
            // key={`shrine-scene-${remountKey}`}
            offerings={offerings}
            totalOfferingsCount={totalOfferingsCount}
            onSelectOffering={setHoveredOffering}
            onLightCandle={(offering) => {
              setJustLitOffering(offering)
              setTimeout(() => setJustLitOffering(null), 8000) // 1.5s for Prayer Received + 6.5s for user info
            }}
            onPriceChange={setPriceChange}
            is80sMode={is80sMode}
            hoveredOffering={hoveredOffering}
            justLitOffering={justLitOffering}
            onJustLitComplete={() => setJustLitOffering(null)}
            user={user}
          />
        ) : null}
      </div>
      
      {/* Only render ShrineLeftPanel on desktop/tablet after we know device type */}
      {mounted && !isMobileView && (
        <ShrineLeftPanel 
          ref={shrineLeftPanelRef}
          is80sMode={is80sMode}
          isMobile={false}
          onLightCandle={handleLightCandleClick}
          onStakeClick={handleStakeClick}
          router={router}
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
            border: '1px solid rgba(212, 175, 55, 0.15)',
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
            <div style={{ 
              fontSize: '1.5rem',
              fontWeight: 400,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '2px',
              color: 'rgba(212, 175, 55, 0.9)',
            }}>
              Get On Her Watchlist
            </div>
            <div style={{ 
              fontSize: '1rem',
              opacity: 0.7,
              fontWeight: 300,
            }}>
              Strike match to Light a Green Candle!
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
          </div>
          )}
          
          {/* Matchstick Button - Always visible */}
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
              
              // If banner is expanded, then open the modal
              // Haptic feedback if available
              if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(50) // Short vibration
              }
              
              // Use the auth check handler
              handleLightCandleClick()
            }}
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              flexShrink: 0,
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
              overflow: 'hidden',
            }}
          >
            {/* Mobile matchstick - lit or unlit based on state */}
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
                  src="/images/matchstick.svg"
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
            <Link href="/about" style={{ textDecoration: 'none', color: 'inherit', display: 'inline-block' }}>
              RL80
            </Link>
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
      
      {/* Light Candle Modal */}
      <LightCandleModal
        isOpen={showLightCandleModal}
        onClose={() => setShowLightCandleModal(false)}
        onLightCandle={handleLightCandle}
      />
      
      {/* Stake Modal */}
      <StakeModal
        isOpen={showStakeModal}
        onClose={() => setShowStakeModal(false)}
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
            <SignInButton mode="modal">
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
      
    </>
  )
}