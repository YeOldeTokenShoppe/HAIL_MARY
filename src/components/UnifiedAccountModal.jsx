'use client';

import { useState, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useWalletAuth } from './WalletAuthProvider';
import { WalletConnectionModal } from './WalletConnectionModal';
import { WalletDetailsModal } from './WalletDetailsModal';

export function UnifiedAccountModal({ isOpen, onClose }) {
  const { user } = useUser();
  const { signOut } = useClerk();
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
  
  // Listen for external wallet details event
  useEffect(() => {
    const handleOpenWalletDetails = () => {
      setShowWalletDetails(true);
    };
    
    window.addEventListener('openWalletDetails', handleOpenWalletDetails);
    return () => window.removeEventListener('openWalletDetails', handleOpenWalletDetails);
  }, []);

  if (!isOpen) return null;

  const handleSignOut = async () => {
    await signOut();
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
              👤 Account
            </button>
            <button 
              className={`modal-tab ${activeTab === 'wallet' ? 'active' : ''}`}
              onClick={() => setActiveTab('wallet')}
            >
              💎 Wallet
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
                  <button 
                    className="action-button"
                    onClick={() => window.open('https://accounts.clerk.dev/user', '_blank')}
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
            ) : (
              <div className="wallet-content">
                {isWalletConnected ? (
                  <>
                    <div className="wallet-info">
                      <div className="wallet-address">
                        <span>Address:</span>
                        <code>{walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}</code>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(walletAddress);
                            alert('Address copied!');
                          }}
                        >
                          📋
                        </button>
                      </div>
                      <div className="wallet-balance">
                        <span>Balance:</span>
                        <strong>{tokenBalance || '0'} RL80</strong>
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
                        onClick={disconnectWallet}
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
            )}
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

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }

        .unified-modal {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border: 2px solid rgba(0, 245, 212, 0.3);
          border-radius: 20px;
          padding: 2rem;
          width: 90%;
          max-width: 400px;
          position: relative;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }

        .modal-close-btn {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          font-size: 20px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .modal-close-btn:hover {
          background: rgba(255, 0, 0, 0.3);
          transform: scale(1.1);
        }

        .modal-tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          border-bottom: 1px solid rgba(0, 245, 212, 0.2);
        }

        .modal-tab {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
        }

        .modal-tab.active {
          color: #00f5d4;
          border-bottom-color: #00f5d4;
        }

        .modal-tab:hover {
          color: #00f5d4;
        }

        .modal-content {
          min-height: 250px;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .user-avatar {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
        }

        .action-button {
          background: rgba(0, 245, 212, 0.1);
          border: 1px solid rgba(0, 245, 212, 0.3);
          color: #00f5d4;
          padding: 0.75rem;
          border-radius: 10px;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-button:hover {
          background: rgba(0, 245, 212, 0.2);
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0, 245, 212, 0.3);
        }

        .action-button.signout,
        .action-button.disconnect {
          background: rgba(255, 59, 48, 0.1);
          border-color: rgba(255, 59, 48, 0.3);
          color: #ff3b30;
        }

        .action-button.signout:hover,
        .action-button.disconnect:hover {
          background: rgba(255, 59, 48, 0.2);
          box-shadow: 0 5px 15px rgba(255, 59, 48, 0.3);
        }

        .wallet-info {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(0, 245, 212, 0.2);
          border-radius: 10px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .wallet-address,
        .wallet-balance {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0.5rem 0;
          color: white;
        }

        .wallet-address code {
          background: rgba(0, 245, 212, 0.1);
          padding: 0.25rem 0.5rem;
          border-radius: 5px;
          font-family: monospace;
          color: #00f5d4;
        }

        .wallet-address button {
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 1rem;
          transition: transform 0.2s;
        }

        .wallet-address button:hover {
          transform: scale(1.2);
        }

        .wallet-balance strong {
          color: #ffee00;
        }

        .wallet-connect {
          text-align: center;
          padding: 2rem;
        }

        .wallet-connect p {
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 1.5rem;
        }

        .action-button.connect {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          color: white;
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