'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useUser, useClerk, UserButton } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import { useConnect } from "thirdweb/react";
import { client } from '@/lib/contract';
import { defineChain } from "thirdweb/chains";
import { inAppWallet } from "thirdweb/wallets/in-app";
import { createWallet } from "thirdweb/wallets";
import { useWalletAuth } from './WalletAuthProvider';
import { WalletDetailsModal } from './WalletDetailsModal';
import { collection, query, where, orderBy, getDocs, db } from '@/lib/firebaseClient';
import { useWeeklyPrize } from '@/hooks/useWeeklyPrize';
import CapsuleCollectible from './CapsuleCollectible';

const chain = defineChain(8453); // Base

// Map Clerk provider names to thirdweb strategies
const clerkToThirdweb = {
  google: 'google',
  oauth_google: 'google',
  discord: 'discord',
  oauth_discord: 'discord',
  oauth_x: 'x',
  x: 'x',
  oauth_farcaster: 'farcaster',
  farcaster: 'farcaster',
  oauth_telegram: 'telegram',
  telegram: 'telegram',
};

const providerLabels = {
  google: 'Google',
  discord: 'Discord',
  x: 'X',
  farcaster: 'Farcaster',
  telegram: 'Telegram',
};

// Custom wallet connect UI — bypasses thirdweb's UI components which have React 19 click issues
function WalletConnectOptions({ connectSocial, connectExternal, connectingMethod, isMobile, clerkUser }) {
  // Detect how user signed into Clerk to offer a matching wallet-creation option
  const clerkProvider = clerkUser?.externalAccounts?.[0]?.provider;
  const primaryStrategy = clerkToThirdweb[clerkProvider] || null;
  const primaryLabel = primaryStrategy ? providerLabels[primaryStrategy] : null;

  const walletOptions = isMobile
    ? [
        { id: 'walletConnect', label: 'WalletConnect' },
        { id: 'io.metamask', label: 'MetaMask' },
        { id: 'com.coinbase.wallet', label: 'Coinbase' },
      ]
    : [
        { id: 'io.metamask', label: 'MetaMask' },
        { id: 'com.coinbase.wallet', label: 'Coinbase' },
        { id: 'walletConnect', label: 'WalletConnect' },
      ];

  const btnBase = {
    background: 'rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(0, 245, 212, 0.25)',
    borderRadius: '10px',
    padding: '12px 14px',
    color: '#fff',
    fontSize: '13px',
    fontFamily: "'Orbitron', monospace",
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    textAlign: 'left',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', padding: '0.5rem 0' }}>
      {/* External wallet options — front and center */}
      {walletOptions.map(({ id, label }) => (
        <button
          key={id}
          style={{
            ...btnBase,
            padding: '14px 16px',
            opacity: connectingMethod && connectingMethod !== id ? 0.5 : 1,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(0, 245, 212, 0.5)'; e.currentTarget.style.background = 'rgba(0, 245, 212, 0.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(0, 245, 212, 0.25)'; e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)'; }}
          onClick={() => connectExternal(id)}
          disabled={!!connectingMethod}
        >
          <span style={{ flex: 1, fontWeight: 500 }}>{connectingMethod === id ? 'Connecting...' : label}</span>
        </button>
      ))}

      {/* Divider + new-to-wallets helper */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        margin: '6px 0 2px',
        color: 'rgba(255,255,255,0.25)',
        fontSize: '10px',
      }}>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
        <span style={{ padding: '0 10px', fontFamily: "'Orbitron', monospace", letterSpacing: '1px' }}>
          NEW TO WALLETS?
        </span>
        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }} />
      </div>

      <p style={{
        color: 'rgba(255,255,255,0.5)',
        fontSize: '12px',
        lineHeight: '1.5',
        margin: 0,
        textAlign: 'center',
      }}>
        {primaryLabel
          ? `A wallet will be created for you using your ${primaryLabel} sign-in.`
          : 'A wallet will be created for you automatically.'}
      </p>

      {/* Primary create-wallet button matching their Clerk auth */}
      <button
        style={{
          background: 'linear-gradient(135deg, #00f5d4, #00bbff)',
          border: 'none',
          borderRadius: '10px',
          padding: '13px 16px',
          color: '#000',
          fontSize: '13px',
          fontWeight: '600',
          fontFamily: "'Orbitron', monospace",
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          width: '100%',
          letterSpacing: '0.5px',
          textTransform: 'uppercase',
          opacity: connectingMethod && connectingMethod !== (primaryStrategy || 'google') ? 0.5 : 1,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 245, 212, 0.3)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
        onClick={() => connectSocial(primaryStrategy || 'google')}
        disabled={!!connectingMethod}
      >
        {connectingMethod === (primaryStrategy || 'google')
          ? 'Creating wallet...'
          : `Create Wallet${primaryLabel ? ` with ${primaryLabel}` : ''}`}
      </button>
    </div>
  );
}

export function UnifiedAccountModal({ isOpen, onClose, initialTab = 'account' }) {
  const { user } = useUser();
  const { signOut } = useClerk();
  const pathname = usePathname();
  const {
    walletAddress,
    isWalletConnected,
    tokenBalance,
    connectWallet,
    disconnectWallet
  } = useWalletAuth();

  const { connect, isConnecting: isThirdwebConnecting } = useConnect();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [connectingMethod, setConnectingMethod] = useState(null); // Track which method is connecting

  // Update active tab when initialTab changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const [showWalletDetails, setShowWalletDetails] = useState(false);
  const [showClerkDropdown, setShowClerkDropdown] = useState(false);

  // Collection tab state
  const [collectedPrizes, setCollectedPrizes] = useState([]);
  const [loadingPrizes, setLoadingPrizes] = useState(false);
  const [selectedPrize, setSelectedPrize] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const { fetchUserPrizes } = useWeeklyPrize();

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Connect with social auth (Google, Discord, etc.) using our own buttons
  const connectSocial = useCallback(async (strategy) => {
    setConnectingMethod(strategy);
    try {
      const wallet = inAppWallet();
      await connect(async () => {
        await wallet.connect({ client, chain, strategy });
        return wallet;
      });
    } catch (e) {
      // User cancelled or popup blocked — not a real error
      if (e?.message) console.warn('Social connect cancelled:', e.message);
    } finally {
      setConnectingMethod(null);
    }
  }, [connect]);

  // Connect external wallet (MetaMask, Coinbase, WalletConnect)
  const connectExternal = useCallback(async (walletId) => {
    setConnectingMethod(walletId);
    try {
      const wallet = createWallet(walletId);
      await connect(async () => {
        await wallet.connect({ client, chain });
        return wallet;
      });
    } catch (e) {
      // User rejected or wallet not installed — not a real error
      if (e?.message) console.warn('Wallet connect cancelled:', e.message);
    } finally {
      setConnectingMethod(null);
    }
  }, [connect]);

  // Listen for external wallet details event
  useEffect(() => {
    const handleOpenWalletDetails = () => {
      setShowWalletDetails(true);
    };

    window.addEventListener('openWalletDetails', handleOpenWalletDetails);
    return () => window.removeEventListener('openWalletDetails', handleOpenWalletDetails);
  }, []);

  // Fetch collected prizes when Collection tab is active
  useEffect(() => {
    const loadPrizes = async () => {
      if (!isOpen || activeTab !== 'collection' || !walletAddress) return;

      setLoadingPrizes(true);
      try {
        const prizes = await fetchUserPrizes();
        setCollectedPrizes(prizes);
      } catch (error) {
        console.error('Failed to fetch collected prizes:', error);
      } finally {
        setLoadingPrizes(false);
      }
    };

    loadPrizes();
  }, [isOpen, activeTab, walletAddress, fetchUserPrizes]);
  
  // Polaroid fetching removed
  /* Removed useEffect for fetching polaroids
  useEffect(() => {
    const fetchUserPolaroids = async () => {
      if (!isOpen || !walletAddress) return;
      

      setLoadingPolaroids(true);
      
      try {
        const offeringsRef = collection(db, 'offerings');

        
        // Query without orderBy to avoid needing a composite index
        const simpleQuery = query(
          offeringsRef,
          where('walletAddress', '==', walletAddress)
        );
        
        const querySnapshot = await getDocs(simpleQuery);
        
        const polaroids = [];
        let offeringsWithPolaroids = 0;
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();

          
          if (data.polaroidUrl) {
            offeringsWithPolaroids++;
            polaroids.push({
              id: doc.id,
              url: data.polaroidUrl,
              burnedAmount: data.tokensBurned || 0,
              timestamp: data.createdAt?.toDate?.() || new Date(data.timestamp),
              message: data.message || '',
              name: data.name || 'Anonymous'
            });
          }
        });
        
        
        // If no results, try with lowercase wallet address
        if (querySnapshot.size === 0) {
          const lowercaseQuery = query(
            offeringsRef,
            where('walletAddress', '==', walletAddress.toLowerCase())
          );
          
          const lowercaseSnapshot = await getDocs(lowercaseQuery);
          
          lowercaseSnapshot.forEach((doc) => {
            const data = doc.data();

            
            if (data.polaroidUrl) {
              polaroids.push({
                id: doc.id,
                url: data.polaroidUrl,
                burnedAmount: data.tokensBurned || 0,
                timestamp: data.createdAt?.toDate?.() || new Date(data.timestamp),
                message: data.message || '',
                name: data.name || 'Anonymous'
              });
            }
          });
        }
        
        // Sort polaroids by timestamp (newest first) since we can't use orderBy in Firestore
        polaroids.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        setUserPolaroids(polaroids);
        
        // Calculate time remaining for the most recent candle (if any)
        if (polaroids.length > 0) {
          const mostRecentCandle = polaroids[0];
          const createdAt = new Date(mostRecentCandle.timestamp);
          const expirationTime = new Date(createdAt.getTime() + (80 * 60 * 60 * 1000)); // 80 hours
          const now = new Date();
          const remaining = expirationTime.getTime() - now.getTime();
          
          setTimeRemaining(remaining > 0 ? remaining : 0);
        } else {
          setTimeRemaining(null);
        }
      } catch (error) {
        console.error('Failed to fetch polaroids:', error);
        // Fallback to localStorage as backup
        try {
          const saved = localStorage.getItem('userPolaroids');
          if (saved) {
            setUserPolaroids(JSON.parse(saved));
          }
        } catch (localError) {
          console.error('Failed localStorage fallback:', localError);
        }
      } finally {
        setLoadingPolaroids(false);
      }
    };
    
    // fetchUserPolaroids();
  }, [isOpen, walletAddress]); */

  /* Timer functionality removed
  // Update time remaining every minute
  useEffect(() => {
    if (!timeRemaining || timeRemaining <= 0) return;
    
    const interval = setInterval(() => {
      if (userPolaroids.length > 0) {
        const mostRecentCandle = userPolaroids[0];
        const createdAt = new Date(mostRecentCandle.timestamp);
        const expirationTime = new Date(createdAt.getTime() + (80 * 60 * 60 * 1000)); // 80 hours
        const now = new Date();
        const remaining = expirationTime.getTime() - now.getTime();
        
        setTimeRemaining(remaining > 0 ? remaining : 0);
      }
    }, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [timeRemaining, userPolaroids]); */

  if (!isOpen) return null;

  /* Helper function removed
  // Helper function to format time remaining
  const formatTimeRemaining = (ms) => {
    if (!ms || ms <= 0) return 'Expired';
    
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }; */

  const handleSignOut = async () => {
    await signOut({ redirectUrl: pathname || '/' });
    onClose();
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="unified-modal" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close-btn" onClick={onClose}>×</button>
          
          {/* Tab Navigation */}
          <div className="modal-tabs">
            <button
              className={`modal-tab ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => setActiveTab('account')}
            >
              Account
            </button>
            <button
              className={`modal-tab ${activeTab === 'wallet' ? 'active' : ''}`}
              onClick={() => setActiveTab('wallet')}
            >
              Wallet
            </button>
            <button
              className={`modal-tab ${activeTab === 'collection' ? 'active' : ''}`}
              onClick={() => setActiveTab('collection')}
            >
              Collection
            </button>
          </div>

          {/* Tab Content */}
          <div className="modal-content">
            {activeTab === 'account' ? (
              <div className="account-content">
                <div className="user-info">
                  <div className="user-avatar">
                    {user?.imageUrl ? (
                      <img src={user.imageUrl} alt="Avatar" />
                    ) : (
                      <span>{user?.firstName?.[0] || '?'}</span>
                    )}
                  </div>
                  <div className="user-details">
                    <h3>{user?.firstName} {user?.lastName}</h3>
                    <p>{user?.primaryEmailAddress?.emailAddress}</p>
                  </div>
                </div>
                
                <div className="account-actions">
                  {/* Hidden UserButton that we'll trigger programmatically */}
                  <div style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}>
                    <UserButton afterSignOutUrl={pathname || window.location.pathname} />
                  </div>
                  
                  <button 
                    className="action-button"
                    onClick={() => {
                      setShowClerkDropdown(true);
                      // Find and click the hidden UserButton to open its dropdown
                      const userButtonTrigger = document.querySelector('.cl-userButtonTrigger');
                      if (userButtonTrigger) {
                        userButtonTrigger.click();
                      }
                      // Listen for when the dropdown closes
                      setTimeout(() => {
                        const checkInterval = setInterval(() => {
                          const dropdown = document.querySelector('.cl-userButtonPopoverCard');
                          if (!dropdown) {
                            setShowClerkDropdown(false);
                            clearInterval(checkInterval);
                          }
                        }, 100);
                      }, 500);
                    }}
                  >
                    Manage Account
                  </button>
                  <button 
                    className="action-button signout"
                    onClick={handleSignOut}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : activeTab === 'wallet' ? (
              <div className="wallet-content">
                {isWalletConnected ? (
                  <>
                    <div className="wallet-info">
                      <div className="wallet-address" style={{ flexDirection: 'column', gap: '8px' }}>
                        <span className="wallet-label" style={{ textAlign: 'center', width: '100%' }}>Address</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                          <code style={{ flex: 1 }}>{walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}</code>
                          <button 
                            className="copy-btn"
                            onClick={() => {
                              navigator.clipboard.writeText(walletAddress);
                              const btn = event.target;
                              const originalText = btn.textContent;
                              btn.textContent = '✓';
                              setTimeout(() => {
                                btn.textContent = originalText;
                              }, 1000);
                            }}
                          >
                            ⧉
                          </button>
                        </div>
                      </div>
                      <div className="wallet-balance" style={{ flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                        <span className="wallet-label" style={{ textAlign: 'center', width: '100%' }}>Balance</span>
                        <strong className="balance-amount" style={{ width: '100%' }}>{tokenBalance?.toLocaleString() || '0'} <span style={{color: '#fff'}}>RL80</span></strong>
                      </div>
                    </div>
                    
                    <div className="wallet-actions">
                      <button 
                        className="action-button"
                        onClick={() => {
                          setShowWalletDetails(true);
                        }}
                      >
                        View Details & Stake
                      </button>
                      <button 
                        className="action-button disconnect"
                        onClick={async () => {
                          await disconnectWallet();
                          // Small delay to let state updates propagate
                          setTimeout(() => {
                            // This will cause the modal to re-render with updated state
                            setActiveTab('wallet');
                          }, 200);
                        }}
                      >
                        Disconnect Wallet
                      </button>
                    </div>
                  </>
                ) : (
                  <WalletConnectOptions
                    connectSocial={connectSocial}
                    connectExternal={connectExternal}
                    connectingMethod={connectingMethod}
                    isMobile={isMobile}
                    clerkUser={user}
                  />
                )}
              </div>
            ) : activeTab === 'collection' ? (
              <div className="collection-content">
                {!walletAddress ? (
                  <WalletConnectOptions
                    connectSocial={connectSocial}
                    connectExternal={connectExternal}
                    connectingMethod={connectingMethod}
                    isMobile={isMobile}
                    clerkUser={user}
                  />
                ) : loadingPrizes ? (
                  <div className="collection-loading">
                    <div className="loading-spinner" />
                    <p>Loading your collection...</p>
                  </div>
                ) : collectedPrizes.length === 0 ? (
                  <div className="collection-empty">
                    <div className="empty-icon">🎁</div>
                    <h3>No prizes collected yet</h3>
                    <p>Visit the Gachapon to claim weekly prizes!</p>
                  </div>
                ) : (
                  <>
                    <p className="collection-hint">Tap a thumbnail to view</p>
                    <div className="capsule-grid">
                      {collectedPrizes.map((prize) => (
                      <CapsuleCollectible
                        key={prize.id}
                        prizeName={prize.prizeName}
                        prizeModelPath={prize.prizeModelPath}
                        prizeCapsuleModelPath={prize.prizeCapsuleModelPath}
                        prizeImage={prize.prizeIcon}
                        editionNumber={prize.claimNumber || 1}
                        maxEditions={prize.maxClaims || 100}
                        mintedAt={prize.claimedAt}
                        weekIdentifier={prize.weekIdentifier}
                        accentColor={prize.prizeAccentColor || '#00f5d4'}
                        onClick={() => setSelectedPrize(prize)}
                      />
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>


      {/* Full-size Capsule Preview Modal */}
      {selectedPrize && (
        <div className="capsule-preview-overlay" onClick={() => setSelectedPrize(null)}>
          <div className="capsule-preview-container" onClick={(e) => e.stopPropagation()}>
            <button className="capsule-preview-close" onClick={() => setSelectedPrize(null)}>×</button>
            <CapsuleCollectible
              prizeName={selectedPrize.prizeName}
              prizeModelPath={selectedPrize.prizeModelPath}
              prizeCapsuleModelPath={selectedPrize.prizeCapsuleModelPath}
              prizeImage={selectedPrize.prizeIcon}
              editionNumber={selectedPrize.claimNumber || 1}
              maxEditions={selectedPrize.maxClaims || 100}
              mintedAt={selectedPrize.claimedAt}
              weekIdentifier={selectedPrize.weekIdentifier}
              accentColor={selectedPrize.prizeAccentColor || '#00f5d4'}
              isPreview={true}
            />
            <p className="capsule-preview-hint">
              {isMobile ? 'Tap to view capsule, then tap again to open' : 'Tap capsule to reveal your collectible inside'}
            </p>
          </div>
        </div>
      )}

      {/* Wallet Details Modal */}
      {showWalletDetails && (
        <WalletDetailsModal 
          onClose={() => setShowWalletDetails(false)} 
        />
      )}
      
      {/* Blurred backdrop when Clerk dropdown is open */}
      {showClerkDropdown && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(5px)',
            zIndex: 9999,
            pointerEvents: 'none'
          }}
        />
      )}
      
      {/* Global styles for Clerk dropdown z-index */}
      <style jsx global>{`
        .cl-userButtonPopoverCard,
        .cl-userButtonPopoverFooter,
        .cl-popoverCard,
        .cl-userButtonPopoverMain,
        .cl-scrollBox,
        [data-localization-key] {
          z-index: 10000 !important;
        }
        
        .cl-portal {
          z-index: 10001 !important;
        }
        
        /* Override Clerk's inline positioning to center the dropdown */
        .cl-userButtonPopoverCard {
          position: fixed !important;
          top: 50% !important;
          left: 50% !important;
          transform: translate(-50%, -50%) !important;
        }
      `}</style>

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700&display=swap');

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes simpleFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1001;
          pointer-events: auto;
        }

        .unified-modal {
          background: rgba(20, 20, 30, 0.98);
          border: 2px solid transparent;
          background-image: linear-gradient(rgba(20, 20, 30, 0.98), rgba(20, 20, 30, 0.98)),
                           linear-gradient(90deg, #00f5d4, #00bbff);
          background-origin: border-box;
          background-clip: padding-box, border-box;
          border-radius: 20px;
          padding: 1.5rem;
          width: 90%;
          max-width: 480px;
          max-height: 80vh;
          position: relative;
          box-shadow: 0 20px 60px rgba(0, 245, 212, 0.3);
          display: flex;
          flex-direction: column;
          pointer-events: auto;
        }

        .modal-close-btn {
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          background: transparent;
          border: none;
          color: #00f5d4;
          width: 32px;
          height: 32px;
          border-radius: 6px;
          font-size: 1.5rem;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-close-btn:hover {
          transform: scale(1.1);
          color: #00f5d4;
        }

        .modal-tabs {
          display: flex;
          gap: 0;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          justify-content: stretch;
        }

        .modal-tab {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.5);
          padding: 0.75rem 0.5rem;
          font-size: 0.75rem;
          font-weight: 500;
          font-family: 'Orbitron', monospace;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          cursor: pointer;
          transition: all 0.2s;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          position: relative;
          flex: 1;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .modal-tab.active {
          color: #00f5d4;
          border-bottom-color: #00f5d4;
          text-shadow: 0 0 10px rgba(0, 245, 212, 0.3);
        }

        .modal-tab:hover:not(.active) {
          color: rgba(255, 255, 255, 0.8);
        }

        .modal-content {
          min-height: 300px;
          max-height: 450px;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 0.5rem;
        }
        
        .modal-content::-webkit-scrollbar {
          width: 6px;
        }
        
        .modal-content::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }
        
        .modal-content::-webkit-scrollbar-thumb {
          background: rgba(0, 245, 212, 0.3);
          border-radius: 3px;
        }
        
        .modal-content::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 245, 212, 0.5);
        }
        
        .account-content,
        .wallet-content,
        .collection-content {
          animation: simpleFadeIn 0.3s ease-out;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          width: 100%;
        }

        .collection-content {
          min-height: 250px;
        }

        .collection-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          text-align: center;
          color: rgba(255, 255, 255, 0.6);
        }

        .collection-empty .empty-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }

        .collection-empty h3 {
          color: #fff;
          margin: 0 0 0.5rem 0;
          font-size: 1.1rem;
        }

        .collection-empty p {
          margin: 0 0 1.5rem 0;
          font-size: 0.9rem;
        }

        .collection-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          gap: 1rem;
          color: rgba(255, 255, 255, 0.6);
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(0, 245, 212, 0.2);
          border-top-color: #00f5d4;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .collection-hint {
          text-align: center;
          font-size: 0.75rem;
          color: rgba(255, 255, 255, 0.4);
          margin: 0 0 0.75rem 0;
          font-family: 'Orbitron', monospace;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .capsule-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 1rem;
          padding: 0.5rem;
        }

        .capsule-preview-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.92);
          backdrop-filter: blur(10px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 1002;
          animation: simpleFadeIn 0.3s ease-out;
        }

        .capsule-preview-container {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          width: 320px;
          max-width: 90vw;
        }

        .capsule-preview-close {
          position: absolute;
          top: -50px;
          right: 0;
          background: rgba(0, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #fff;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          font-size: 1.5rem;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }

        .capsule-preview-close:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: #00f5d4;
          color: #00f5d4;
        }

        .capsule-preview-hint {
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.8rem;
          margin: 0;
          font-style: italic;
          text-align: center;
        }

        .prizes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 1rem;
          padding: 0.5rem;
        }

        .prize-card {
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid rgba(0, 245, 212, 0.3);
          border-radius: 12px;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .prize-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 20px rgba(0, 245, 212, 0.2);
          border-color: #00f5d4;
        }

        .prize-icon {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          object-fit: cover;
        }

        .prize-icon-placeholder {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: rgba(0, 245, 212, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
        }

        .prize-name {
          color: #fff;
          font-size: 0.75rem;
          font-weight: 600;
          text-align: center;
          font-family: 'Orbitron', monospace;
        }

        .prize-date {
          color: rgba(255, 255, 255, 0.4);
          font-size: 0.65rem;
        }

        .prize-preview-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          animation: simpleFadeIn 0.3s ease-out;
        }

        .prize-preview-modal {
          background: rgba(20, 20, 30, 0.98);
          border: 2px solid #00f5d4;
          border-radius: 20px;
          padding: 2rem;
          max-width: 400px;
          width: 90%;
          position: relative;
          box-shadow: 0 20px 60px rgba(0, 245, 212, 0.3);
        }

        .preview-close-btn {
          position: absolute;
          top: 0.75rem;
          right: 0.75rem;
          background: transparent;
          border: none;
          color: #00f5d4;
          font-size: 1.5rem;
          cursor: pointer;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .preview-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .preview-image {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid #00f5d4;
          box-shadow: 0 0 30px rgba(0, 245, 212, 0.4);
          margin-bottom: 1.5rem;
        }

        .preview-placeholder {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: rgba(0, 245, 212, 0.1);
          border: 3px solid #00f5d4;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 3rem;
          margin-bottom: 1.5rem;
        }

        .preview-title {
          color: #00f5d4;
          font-family: 'Orbitron', monospace;
          font-size: 1.3rem;
          margin: 0 0 0.5rem 0;
        }

        .preview-description {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.9rem;
          margin: 0 0 1.5rem 0;
        }

        .preview-details {
          width: 100%;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 10px;
          padding: 1rem;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 0.5rem 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-label {
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .detail-value {
          color: #fff;
          font-size: 0.85rem;
          font-weight: 500;
        }

        .user-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
          text-align: center;
          align-self: center;
        }

        .user-avatar {
          width: 60px;
          height: 60px;
          border-radius: 12px;
          background: rgba(0, 245, 212, 0.1);
          border: 1px solid rgba(0, 245, 212, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .user-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .user-avatar span {
          color: white;
          font-size: 1.5rem;
          font-weight: bold;
        }

        .user-details h3 {
          color: white;
          margin: 0 0 0.25rem 0;
          font-size: 1.2rem;
        }

        .user-details p {
          color: rgba(255, 255, 255, 0.6);
          margin: 0;
          font-size: 0.9rem;
        }

        .account-actions,
        .wallet-actions {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          width: 100%;
        }

        .action-button {
          background: #00f5d4;
          border: none;
          color: #000;
          padding: 0.75rem;
          border-radius: 10px;
          font-size: 0.9rem;
          font-family: 'Orbitron', monospace;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.3s;
          width: 100%;
        }

        .action-button:hover {
          opacity: 0.9;
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0, 245, 212, 0.3);
        }

        .action-button.signout,
        .action-button.disconnect {
          background: #ff6b6b;
          border: none;
          color: #fff;
        }

        .action-button.signout:hover,
        .action-button.disconnect:hover {
          opacity: 0.9;
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(255, 107, 107, 0.3);
        }

        .wallet-info {
          background: rgba(0, 0, 0, 0.4) !important;
          border: 1px solid rgba(0, 245, 212, 0.2) !important;
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          width: 100%;
        }

        .wallet-address,
        .wallet-balance {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 1rem 0;
          color: white;
        }
        
        .wallet-label {
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-family: 'Orbitron', monospace;
          min-width: 70px;
          text-align: left;
        }

        .wallet-address code {
          background: rgba(0, 245, 212, 0.05);
          border: 1px solid rgba(0, 245, 212, 0.2);
          padding: 0.4rem 0.75rem;
          border-radius: 8px;
          font-family: 'Courier New', monospace;
          color: #00f5d4;
          font-size: 0.95rem;
          font-weight: 500;
          flex: 1;
          text-align: center;
          margin: 0 0.5rem;
        }

        .copy-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.6);
          width: 28px;
          height: 28px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
        }

        .copy-btn:hover {
          background: rgba(0, 245, 212, 0.1);
          border-color: rgba(0, 245, 212, 0.3);
          color: #00f5d4;
        }

        .balance-amount {
          color: #00f5d4 !important;
          font-family: 'Orbitron', monospace;
          font-size: 1rem;
          font-weight: 600;
          text-shadow: 0 0 10px rgba(0, 245, 212, 0.3);
          // background: rgba(0, 245, 212, 0.05) !important;
          padding: 0.4rem 0.75rem;
          border-radius: 8px;
          // border: 1px solid rgba(0, 245, 212, 0.2) !important;
          flex: 1;
          text-align: center;
          margin-left: 0.5rem;
        }

        .wallet-connect {
          text-align: center;
          padding: 2rem;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .wallet-connect p {
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 1.5rem;
        }
        
        .wallet-connect .action-button {
          width: 100%;
          max-width: 280px;
        }

        .action-button.connect {
          background: linear-gradient(135deg, #00f5d4, #00bbff);
          border: none;
          color: #000;
          font-weight: 600;
        }

        .action-button.connect:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0, 245, 212, 0.3);
        }

        @media (max-width: 480px) {
          .unified-modal {
            width: 95%;
            padding: 1.5rem;
          }
        }
      `}</style>
    </>
  );
}