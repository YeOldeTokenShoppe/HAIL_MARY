'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { useUser, useClerk, UserButton } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useEvmAccounts } from '@coinbase/cdp-hooks';
import { useWalletAuth } from './WalletAuthProvider';

// Client-only — @coinbase/cdp-react reads localStorage at module init,
// which throws during SSR. Mirrors the pattern in BuyModal/Providers.
const CopyAddress = dynamic(
  () => import('@coinbase/cdp-react').then((m) => ({ default: m.CopyAddress })),
  { ssr: false },
);
const ExportWalletModal = dynamic(
  () => import('@coinbase/cdp-react').then((m) => ({ default: m.ExportWalletModal })),
  { ssr: false },
);

// Custom wallet connect UI using wagmi connectors
function WalletConnectOptions({ connectExternal, connectingMethod, isMobile, theme = 'cyber' }) {
  // Hide MetaMask when no browser wallet extension is detected — the
  // connector is in extensionOnly mode and would just throw without
  // one. WalletConnect remains the path for mobile MetaMask users.
  const [hasInjectedProvider, setHasInjectedProvider] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      setHasInjectedProvider(true);
    }
  }, []);

  const allOptions = isMobile
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
  const walletOptions = allOptions.filter(
    (o) => o.id !== 'io.metamask' || hasInjectedProvider,
  );

  const ind = theme === 'industrial';
  const accent = ind ? '212, 168, 84' : '0, 245, 212';
  const btnBase = {
    background: ind ? 'rgba(60, 60, 70, 0.4)' : 'rgba(0, 0, 0, 0.4)',
    border: `1px solid rgba(${accent}, 0.25)`,
    borderRadius: ind ? '3px' : '10px',
    padding: '12px 14px',
    color: ind ? '#c8c0b4' : '#fff',
    fontSize: ind ? '11px' : '13px',
    fontFamily: ind ? "'Share Tech Mono', monospace" : "'Orbitron', monospace",
    letterSpacing: ind ? '0.1em' : 'normal',
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
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = `rgba(${accent}, 0.5)`; e.currentTarget.style.background = `rgba(${accent}, 0.08)`; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = `rgba(${accent}, 0.25)`; e.currentTarget.style.background = ind ? 'rgba(60, 60, 70, 0.4)' : 'rgba(0, 0, 0, 0.4)'; }}
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
        <span style={{ padding: '0 10px', fontFamily: ind ? "'Share Tech Mono', monospace" : "'Orbitron', monospace", letterSpacing: ind ? '0.12em' : '1px', color: ind ? '#8a8070' : undefined }}>
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
        Connect with Coinbase Wallet for an easy start.
      </p>

      {/* Primary create-wallet button — Coinbase for easy onboarding */}
      <button
        style={{
          background: ind ? '#d4a854' : 'linear-gradient(135deg, #00f5d4, #00bbff)',
          border: ind ? '1px solid #b8922e' : 'none',
          borderRadius: ind ? '3px' : '10px',
          padding: '13px 16px',
          color: ind ? '#1a1a1f' : '#000',
          fontSize: ind ? '11px' : '13px',
          fontWeight: ind ? '700' : '600',
          fontFamily: ind ? "'Share Tech Mono', monospace" : "'Orbitron', monospace",
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          width: '100%',
          letterSpacing: ind ? '0.12em' : '0.5px',
          textTransform: 'uppercase',
          opacity: connectingMethod && connectingMethod !== 'com.coinbase.wallet' ? 0.5 : 1,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = ind ? '0 6px 20px rgba(212, 168, 84, 0.3)' : '0 8px 24px rgba(0, 245, 212, 0.3)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
        onClick={() => connectExternal('com.coinbase.wallet')}
        disabled={!!connectingMethod}
      >
        {connectingMethod === 'com.coinbase.wallet'
          ? 'Connecting...'
          : 'Get Started with Coinbase'}
      </button>
    </div>
  );
}

export function UnifiedAccountModal({ isOpen, onClose, initialTab = 'account', theme = 'cyber' }) {
  const { user } = useUser();
  const { signOut, openSignIn } = useClerk();
  const pathname = usePathname();
  const {
    walletAddress,
    isWalletConnected,
    isEmbeddedWallet,
    tokenBalance,
    connectWallet,
    disconnectWallet,
    connectors
  } = useWalletAuth();
  const { evmAccounts } = useEvmAccounts();
  const ownerEoaAddress = evmAccounts?.[0]?.address || null;

  const [activeTab, setActiveTab] = useState(initialTab);
  const [connectingMethod, setConnectingMethod] = useState(null); // Track which method is connecting

  // Update active tab when initialTab changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const [showClerkDropdown, setShowClerkDropdown] = useState(false);

  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Map wallet option ids to wagmi connector ids
  const walletIdToConnectorId = {
    'io.metamask': 'metaMask',
    'com.coinbase.wallet': 'coinbaseWallet',
    'walletConnect': 'walletConnect',
  };

  // Connect external wallet (MetaMask, Coinbase, WalletConnect) via wagmi.
  // For WalletConnect specifically, close this modal first so its QR
  // modal has a clean canvas — on iPad Safari the WC modal can render
  // behind UnifiedAccountModal even at a higher z-index due to stacking
  // context quirks, leaving the user with a "stuck pending" button.
  const connectExternal = useCallback(async (walletId) => {
    if (walletId === 'walletConnect') {
      onClose();
    }
    setConnectingMethod(walletId);
    try {
      const connectorId = walletIdToConnectorId[walletId] || walletId;
      await connectWallet(connectorId);
    } catch (e) {
      // User rejected or wallet not installed — not a real error
      if (e?.message) console.warn('Wallet connect cancelled:', e.message);
    } finally {
      setConnectingMethod(null);
    }
  }, [connectWallet, onClose]);

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
  if (typeof document === 'undefined') return null;

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

  return createPortal(
    <>
      <div className={`modal-overlay${theme === 'industrial' ? ' theme-industrial' : ''}`} onClick={onClose}>
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
          </div>

          {/* Tab Content */}
          <div className="modal-content">
            {activeTab === 'account' ? (
              <div className="account-content">
                {user ? (
                  <>
                    <div className="user-info">
                      <div className="user-avatar">
                        {user.imageUrl ? (
                          <img src={user.imageUrl} alt="Avatar" />
                        ) : (
                          <span>{user.firstName?.[0] || '?'}</span>
                        )}
                      </div>
                      <div className="user-details">
                        <h3>{user.firstName} {user.lastName}</h3>
                        <p>{user.primaryEmailAddress?.emailAddress}</p>
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
                          const userButtonTrigger = document.querySelector('.cl-userButtonTrigger');
                          if (userButtonTrigger) {
                            userButtonTrigger.click();
                          }
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
                  </>
                ) : (
                  <div className="account-signed-out">
                    <div className="account-signed-out-glyph" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 4 9 15l-3 3-3-3 11-11h6Z" />
                        <path d="m14 5 5 5" />
                        <path d="M9 15h2.5L14 12.5" />
                      </svg>
                    </div>
                    <p className="account-signed-out-eyebrow">Account access</p>
                    <p className="account-signed-out-body">
                      Sign in to unlock the full experience and follow your account across devices.
                    </p>
                    <button
                      className="action-button account-signed-out-cta"
                      onClick={() => {
                        onClose();
                        openSignIn();
                      }}
                    >
                      Sign In
                    </button>
                  </div>
                )}
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

                    {isEmbeddedWallet && (
                      <div style={{
                        marginTop: '14px',
                        padding: '12px',
                        background: 'rgba(0, 0, 0, 0.35)',
                        border: '1px solid rgba(0, 245, 212, 0.25)',
                        borderRadius: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}>
                        <span style={{
                          fontSize: '10px',
                          letterSpacing: '2px',
                          textTransform: 'uppercase',
                          color: 'rgba(255,255,255,0.6)',
                        }}>
                          Self-custody
                        </span>
                        <CopyAddress address={walletAddress} label="Full address" />
                        {ownerEoaAddress && <ExportWalletModal address={ownerEoaAddress} />}
                        <p style={{
                          fontSize: '11px',
                          color: 'rgba(255,255,255,0.55)',
                          lineHeight: '1.5',
                          margin: 0,
                        }}>
                          Export your private key to move this wallet into MetaMask, Coinbase Wallet, or any other app. Anyone with the key controls the funds — store it safely.
                        </p>
                      </div>
                    )}

                    <div className="wallet-actions">
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
                    connectExternal={connectExternal}
                    connectingMethod={connectingMethod}
                    isMobile={isMobile}
                    theme={theme}
                  />
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>


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
          z-index: 9500;
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
        .wallet-content {
          animation: simpleFadeIn 0.3s ease-out;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          width: 100%;
        }

        /* Signed-out empty state. Centered column with a soft cyan glyph,
           monospace eyebrow, body copy, and a non-full-width pill CTA so
           the modal doesn't feel like a single-action funnel. Matches the
           wallet tab's vertical rhythm and the modal's cyan accent. */
        .account-signed-out {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 18px 12px 8px;
          text-align: center;
        }

        .account-signed-out-glyph {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #00f5d4;
          background: rgba(0, 245, 212, 0.08);
          border: 1px solid rgba(0, 245, 212, 0.35);
          box-shadow: 0 0 24px rgba(0, 245, 212, 0.18);
          margin-bottom: 4px;
        }

        .account-signed-out-glyph svg {
          width: 26px;
          height: 26px;
        }

        .account-signed-out-eyebrow {
          margin: 0;
          font-family: 'Orbitron', monospace;
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: rgba(0, 245, 212, 0.75);
        }

        .account-signed-out-body {
          margin: 0;
          max-width: 280px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.88rem;
          line-height: 1.45;
        }

        .account-signed-out-cta {
          /* Override the base .action-button width:100% so the CTA reads
             as an invitation, not a wall. Min-width keeps it tappable. */
          width: auto;
          min-width: 160px;
          padding: 0.7rem 1.6rem;
          margin-top: 6px;
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

        /* ── Industrial / Oil theme ─────────────────────────── */
        .theme-industrial .unified-modal {
          background: rgba(20, 20, 28, 0.97);
          border: 1px solid #444;
          background-image: none;
          border-radius: 6px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
          font-family: 'Share Tech Mono', monospace;
        }

        .theme-industrial .modal-close-btn {
          color: #888;
        }
        .theme-industrial .modal-close-btn:hover {
          color: #d4a854;
        }

        .theme-industrial .modal-tabs {
          border-bottom-color: rgba(212, 168, 84, 0.25);
        }

        .theme-industrial .modal-tab {
          font-family: 'Share Tech Mono', monospace;
          color: #8a8070;
          letter-spacing: 0.12em;
          font-size: 0.7rem;
        }
        .theme-industrial .modal-tab.active {
          color: #d4a854;
          border-bottom-color: #d4a854;
          text-shadow: none;
        }
        .theme-industrial .modal-tab:hover:not(.active) {
          color: #c8c0b4;
        }

        .theme-industrial .user-avatar {
          background: rgba(212, 168, 84, 0.1);
          border-color: rgba(212, 168, 84, 0.3);
          border-radius: 6px;
        }

        .theme-industrial .user-details h3 {
          color: #e8e0d4;
          font-family: 'Share Tech Mono', monospace;
        }
        .theme-industrial .user-details p {
          color: #8a8070;
        }

        .theme-industrial .action-button {
          background: #d4a854;
          color: #1a1a1f;
          border-radius: 3px;
          font-family: 'Share Tech Mono', monospace;
          font-size: 0.75rem;
          letter-spacing: 0.12em;
        }
        .theme-industrial .action-button:hover {
          box-shadow: 0 6px 20px rgba(212, 168, 84, 0.3);
        }
        .theme-industrial .action-button.signout,
        .theme-industrial .action-button.disconnect {
          background: rgba(60, 60, 70, 0.5);
          border: 1px solid #555;
          color: #c8c0b4;
        }
        .theme-industrial .action-button.signout:hover,
        .theme-industrial .action-button.disconnect:hover {
          border-color: #f87171;
          color: #f87171;
          box-shadow: none;
        }
        .theme-industrial .action-button.connect {
          background: #d4a854;
          border: 1px solid #b8922e;
          color: #1a1a1f;
        }
        .theme-industrial .action-button.connect:hover {
          box-shadow: 0 6px 20px rgba(212, 168, 84, 0.3);
        }

        .theme-industrial .wallet-info {
          background: rgba(212, 168, 84, 0.08) !important;
          border: 1px solid rgba(212, 168, 84, 0.25) !important;
          border-radius: 4px;
        }
        .theme-industrial .wallet-label {
          color: #8a8070;
          font-family: 'Share Tech Mono', monospace;
        }
        .theme-industrial .wallet-address code {
          background: rgba(212, 168, 84, 0.05);
          border-color: rgba(212, 168, 84, 0.2);
          color: #d4a854;
          border-radius: 3px;
          font-family: 'Share Tech Mono', monospace;
        }
        .theme-industrial .copy-btn:hover {
          background: rgba(212, 168, 84, 0.1);
          border-color: rgba(212, 168, 84, 0.3);
          color: #d4a854;
        }
        .theme-industrial .balance-amount {
          color: #d4a854 !important;
          font-family: 'Share Tech Mono', monospace;
          text-shadow: none;
        }

        .theme-industrial .wallet-connect p {
          color: #8a8070;
        }

        .theme-industrial .modal-content::-webkit-scrollbar-thumb {
          background: rgba(212, 168, 84, 0.3);
        }
        .theme-industrial .modal-content::-webkit-scrollbar-thumb:hover {
          background: rgba(212, 168, 84, 0.5);
        }

        /* WalletConnectOptions buttons inside industrial theme */
        .theme-industrial .wallet-connect-options button {
          font-family: 'Share Tech Mono', monospace;
          border-radius: 3px;
        }
      `}</style>
    </>,
    document.body
  );
}