'use client';

import { useState, useEffect } from 'react';
import { useUser, useClerk, UserButton } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import { useWalletAuth } from './WalletAuthProvider';
import { WalletConnectionModal } from './WalletConnectionModal';
import { WalletDetailsModal } from './WalletDetailsModal';
import { collection, query, where, orderBy, getDocs, db } from '@/lib/firebaseClient';

export function UnifiedAccountModal({ isOpen, onClose }) {
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
  
  const [activeTab, setActiveTab] = useState('account');
  const [showWalletConnection, setShowWalletConnection] = useState(false);
  const [showWalletDetails, setShowWalletDetails] = useState(false);
  const [showClerkDropdown, setShowClerkDropdown] = useState(false);
  // Polaroid and candle functionality removed
  
  // Listen for external wallet details event
  useEffect(() => {
    const handleOpenWalletDetails = () => {
      setShowWalletDetails(true);
    };
    
    window.addEventListener('openWalletDetails', handleOpenWalletDetails);
    return () => window.removeEventListener('openWalletDetails', handleOpenWalletDetails);
  }, []);
  
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
    onClose();
    // Sign out without redirectUrl to avoid a race condition where
    // Clerk's redirect fires while React is still reconciling the
    // auth state change — which causes a removeChild error when
    // non-default languages are active (extra re-render cycles).
    await signOut();
    window.location.href = pathname || '/';
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
                    <UserButton afterSignOutUrl={pathname || "/"} />
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
                  <div className="wallet-connect">
                    <p>No wallet connected</p>
                    <button 
                      className="action-button connect"
                      onClick={() => setShowWalletConnection(true)}
                    >
                      Connect Wallet
                    </button>
                  </div>
                )}
              </div>
            ) : null /* Candle tab content removed */}
          </div>
        </div>
      </div>

      {/* Wallet Connection Modal */}
      {showWalletConnection && (
        <WalletConnectionModal 
          onClose={() => setShowWalletConnection(false)} 
        />
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
          z-index: 50;
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
          padding: 0.75rem 1rem;
          font-size: 0.85rem;
          font-weight: 500;
          font-family: 'Orbitron', monospace;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          cursor: pointer;
          transition: all 0.2s;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          position: relative;
          flex: 1;
          text-align: center;
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