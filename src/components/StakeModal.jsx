'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useWalletAuth } from './WalletAuthProvider';
import { db, collection, addDoc, serverTimestamp } from '@/lib/firebaseClient';
import ThirdwebBuyModal from './ThirdwebBuyModal';
import { 
  TransactionButton
} from "thirdweb/react";
import { prepareContractCall, sendAndConfirmTransaction } from "thirdweb";
import { approve } from "thirdweb/extensions/erc20";
import { stakingContract } from '@/lib/stakingContract';
import { erc20Contract } from '@/lib/contract';
import { toWei } from "thirdweb/utils";
import { useStaking } from '@/hooks/useStaking';

const StakeModal = ({ isOpen, onClose, onStake }) => {
  const { user } = useUser();
  const { walletAddress, tokenBalance, refreshBalance, activeAccount } = useWalletAuth();
  const { 
    stakedBalance, 
    earnedRewards, 
    canWithdraw, 
    timeUntilUnlockFormatted,
    refreshData: refreshStakingData 
  } = useStaking();
  
  const [stakeAmount, setStakeAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showNoBuyPrompt, setShowNoBuyPrompt] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [transactionStatus, setTransactionStatus] = useState(''); // 'signing', 'confirming', 'success'
  
  // Testnet contract has a 10-minute lock period by default
  const LOCK_DURATION_MINUTES = 10;
  const IS_TESTNET = true; // Flag to show testnet UI

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStakeAmount('');
      setIsSubmitting(false);
      setShowInfo(false);
      setTransactionStatus('');
      
      // If user has staked balance, show the dashboard directly
      if (parseFloat(stakedBalance) > 0) {
        setShowSuccess(true);
        setSuccessData({ 
          showDashboard: true 
        });
        setShowNoBuyPrompt(false);
      } else {
        setShowSuccess(false);
        setSuccessData(null);
        // Check token balance immediately when modal opens
        const balance = parseInt(tokenBalance) || 0;
        if (walletAddress && balance === 0) {
          setShowNoBuyPrompt(true);
        } else {
          setShowNoBuyPrompt(false);
        }
      }
    }
  }, [isOpen, walletAddress, tokenBalance, stakedBalance]);
  
  // No auto-close anymore since we have actionable content
  
  // No longer need to check approval separately - getApprovalForTransaction handles it

  if (!isOpen) return null;
  
  // Handle approval is now done via TransactionButton

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const amount = parseInt(stakeAmount) || 0;
    if (amount < 1) {
      alert('Minimum 1 RL80 token required to stake');
      return;
    }

    // Check if user has enough tokens
    const currentBalance = parseInt(tokenBalance) || 0;
    if (currentBalance === 0) {
      setShowNoBuyPrompt(true);
      return;
    } else if (amount > currentBalance) {
      alert(`You only have ${currentBalance.toLocaleString()} RL80 tokens. Please enter a valid amount.`);
      return;
    }
    
    if (!activeAccount) {
      alert('Please connect your wallet first');
      return;
    }
    
    // The actual transaction is handled by TransactionButton
    // This function now just validates the form
  };


  return (
    <>
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes glow {
          0%, 100% {
            box-shadow: 0 0 20px currentColor;
          }
          50% {
            box-shadow: 0 0 30px currentColor, 0 0 40px currentColor;
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
          z-index: 5000;
          animation: fadeIn 0.3s ease-out;
        }

        .modal-content {
          background: rgba(20, 20, 30, 0.98);
          border: 2px solid transparent;
          background-image: linear-gradient(rgba(20, 20, 30, 0.98), rgba(20, 20, 30, 0.98)),
                           linear-gradient(90deg, #00f5d4, #00bbff);
          background-origin: border-box;
          background-clip: padding-box, border-box;
          border-radius: 20px;
          padding: 1.5rem;
          padding-bottom: 2rem;
          width: 90%;
          max-width: 500px;
          height: auto;
          max-height: 85vh;
          overflow-y: auto;
          overflow-x: hidden;
          position: relative;
          animation: fadeIn 0.4s ease-out;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 245, 212, 0.3);
        }
        
        /* Desktop scaling - keep modal reasonable size */
        @media (min-width: 1200px) and (min-height: 800px) {
          .modal-content {
            max-width: 550px;
            max-height: 90vh;
          }
        }
        
        @media (min-width: 1600px) and (min-height: 900px) {
          .modal-content {
            max-width: 600px;
            max-height: 90vh;
          }
        }
        
        /* Height-based media queries */
        @media (max-height: 800px) {
          .modal-content {
            max-height: 90vh;
            padding: 1rem;
          }
        }
        
        @media (max-height: 700px) {
          .modal-content {
            max-height: 95vh;
          }
        }

        .close-button {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: none;
          border: none;
          color: #00f5d4;
          font-size: 1.5rem;
          cursor: pointer;
          transition: all 0.2s;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .close-button:hover {
          transform: scale(1.1);
          color: #00f5d4;
        }

        .modal-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: #fff;
          text-align: center;
          margin-bottom: 1.5rem;
          font-family: 'Orbitron', monospace;
        }


        .form-group {
          margin-bottom: 1rem;
        }

        .form-label {
          display: block;
          color: #00f5d4;
          margin-bottom: 0.5rem;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 500;
        }

        .stake-input {
          width: 100%;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #fff;
          font-size: 0.9rem;
          transition: all 0.3s;
        }

        .stake-input:focus {
          outline: none;
          border-color: #00f5d4;
          background: rgba(0, 245, 212, 0.05);
        }

        .token-balance {
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 0.5rem;
        }

        .submit-button {
          width: 100%;
          padding: 0.875rem;
          background: linear-gradient(135deg, #00f5d4, #00bbff);
          border: none;
          border-radius: 50px;
          color: #000;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          position: relative;
          overflow: hidden;
          margin-top: 1rem;
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(0, 245, 212, 0.3);
        }

        .submit-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }

      `}</style>

      <div className="modal-overlay" onClick={showSuccess ? undefined : onClose}>
        {/* Buy RL80 Prompt - Show this INSTEAD of the modal content */}
        {showNoBuyPrompt ? (
          <div 
            style={{
              background: 'rgba(20, 20, 30, 0.98)',
              border: '1px solid rgba(0, 245, 212, 0.4)',
              borderRadius: '24px',
              padding: '1rem',
              maxWidth: '420px',
              textAlign: 'center',
              color: '#fff',
              boxShadow: '0 0 60px rgba(0, 245, 212, 0.3)',
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
                color: '#00f5d4',
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
              onClick={onClose}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
            >
              ×
            </button>
            
            {/* Title */}
            <h2 style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: '1.2rem',
              fontWeight: '700',
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: '3px',
              marginBottom: '1.5rem',
            }}>
              RL80 TOKENS REQUIRED
            </h2>
            
            {/* Description */}
            <p style={{
              color: '#00f5d4',
              fontSize: '1.1rem',
              marginBottom: '2.5rem',
              lineHeight: '1.5',
            }}>
              You need RL80 tokens to stake.
            </p>
            
            {/* Info message for test mode */}
            <div style={{
              background: 'rgba(0, 245, 212, 0.1)',
              border: '1px solid rgba(0, 245, 212, 0.3)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '2rem'
            }}>
              <p style={{
                color: '#fff',
                fontSize: '0.9rem',
                margin: 0
              }}>
                💡 Test tokens have been provided for this demo. Please close this window and try staking again.
              </p>
            </div>
            
            {/* Secondary link */}
            <button 
              onClick={() => {
                setShowNoBuyPrompt(false);
                onClose();
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '0.9rem',
                cursor: 'pointer',
                padding: '0.5rem 1rem',
                transition: 'color 0.3s',
                textDecoration: 'underline',
              }}
              onMouseEnter={(e) => {
                e.target.style.color = 'rgba(255, 255, 255, 0.8)';
              }}
              onMouseLeave={(e) => {
                e.target.style.color = 'rgba(255, 255, 255, 0.5)';
              }}
            >
              Maybe Later
            </button>
          </div>
        ) : showSuccess ? (
          // Success Dashboard with Staking Info
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{
            maxWidth: '500px !important'
          }}>
            <button 
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                color: '#fff',
                fontSize: '1.2rem',
                cursor: 'pointer',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              ✕
            </button>
            
            <div style={{
              textAlign: 'center',
              marginBottom: '1.5rem'
            }}>
              {!successData?.showDashboard && (
                <div style={{
                  fontSize: '2rem',
                  marginBottom: '0.5rem',
                  animation: 'fadeIn 0.5s ease-out'
                }}>
                  ✅
                </div>
              )}
              <h2 style={{
                fontSize: '1.3rem',
                fontWeight: '600',
                color: '#fff',
                fontFamily: 'Orbitron, monospace',
                textTransform: 'uppercase',
                letterSpacing: '2px'
              }}>
                {successData?.showDashboard ? 'STAKING DASHBOARD' : 'Staking Successful!'}
              </h2>
            </div>
            
            {/* Staking Activity Section */}
            <div style={{
              marginBottom: '1.5rem'
            }}>
              <h3 style={{
                fontSize: '0.9rem',
                color: '#00f5d4',
                marginBottom: '1rem',
                textAlign: 'center',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                STAKING ACTIVITY
              </h3>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '1.5rem',
                marginBottom: '1.5rem'
              }}>
                <div>
                  <div style={{
                    fontSize: '0.7rem',
                    color: 'rgba(255, 255, 255, 0.5)',
                    marginBottom: '0.25rem',
                    textTransform: 'uppercase'
                  }}>
                    Staked Amount
                  </div>
                  <div style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#fff'
                  }}>
                    {parseFloat(stakedBalance || 0).toLocaleString()} RL80
                  </div>
                </div>
                
                <div>
                  <div style={{
                    fontSize: '0.7rem',
                    color: 'rgba(255, 255, 255, 0.5)',
                    marginBottom: '0.25rem',
                    textTransform: 'uppercase'
                  }}>
                    Lock Status
                  </div>
                  <div style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: canWithdraw ? '#00ff88' : '#ff6b6b'
                  }}>
                    {canWithdraw ? 'Unlocked' : timeUntilUnlockFormatted}
                  </div>
                </div>
                
                <div>
                  <div style={{
                    fontSize: '0.7rem',
                    color: 'rgba(255, 255, 255, 0.5)',
                    marginBottom: '0.25rem',
                    textTransform: 'uppercase'
                  }}>
                    Rewards Earned
                  </div>
                  <div style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#00f5d4'
                  }}>
                    {parseFloat(earnedRewards || 0).toFixed(6)} ETH
                  </div>
                </div>
                
                <div>
                  <div style={{
                    fontSize: '0.7rem',
                    color: 'rgba(255, 255, 255, 0.5)',
                    marginBottom: '0.25rem',
                    textTransform: 'uppercase'
                  }}>
                    Total Pool
                  </div>
                  <div style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#fff'
                  }}>
                    600 RL80
                  </div>
                </div>
              </div>
            </div>
            
            {/* Claimable Rewards Box - matching WalletDetails style */}
            {parseFloat(earnedRewards || 0) > 0 && (
              <div style={{
                background: 'rgba(0, 245, 212, 0.1)',
                border: '1px solid rgba(0, 245, 212, 0.3)',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{
                  fontSize: '0.85rem',
                  color: '#00f5d4'
                }}>
                  Claimable Rewards: {parseFloat(earnedRewards).toFixed(6)} ETH
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  color: '#00f5d4'
                }}>
                  Ready to claim!
                </span>
              </div>
            )}
            
            {/* Action Buttons - matching WalletDetails style */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              <button
                onClick={() => {
                  setShowSuccess(false);
                  setStakeAmount('');
                }}
                style={{
                  padding: '0.9rem',
                  background: '#00f5d4',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#000',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  textTransform: 'uppercase'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                STAKE MORE
              </button>
              
              <TransactionButton
                transaction={() => prepareContractCall({
                  contract: stakingContract,
                  method: "withdrawAll",
                  params: []
                })}
                onTransactionConfirmed={async () => {
                  console.log('Withdrawn successfully!');
                  await refreshStakingData();
                  await refreshBalance();
                  alert('Tokens withdrawn successfully!');
                }}
                onError={(error) => {
                  console.error('Error withdrawing tokens:', error);
                  alert('Failed to withdraw tokens');
                }}
                disabled={!canWithdraw || parseFloat(stakedBalance) === 0}
                style={{
                  padding: '0.9rem',
                  background: canWithdraw ? '#ff6b6b' : 'rgba(100, 100, 100, 0.3)',
                  border: 'none',
                  borderRadius: '8px',
                  color: canWithdraw ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: canWithdraw ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s',
                  textTransform: 'uppercase',
                  width: '100%'
                }}
              >
                {canWithdraw ? `WITHDRAW ALL (${parseFloat(stakedBalance).toLocaleString()} RL80)` : `🔒 LOCKED`}
              </TransactionButton>
            </div>
            
            {/* Claim Rewards Button - full width when available */}
            {parseFloat(earnedRewards || 0) > 0 && (
              <TransactionButton
                transaction={() => prepareContractCall({
                  contract: stakingContract,
                  method: "claimRewards",
                  params: []
                })}
                onTransactionConfirmed={async () => {
                  console.log('Rewards claimed successfully!');
                  await refreshStakingData();
                  await refreshBalance();
                  alert('Rewards claimed successfully!');
                }}
                onError={(error) => {
                  console.error('Error claiming rewards:', error);
                  alert('Failed to claim rewards');
                }}
                disabled={!canWithdraw || parseFloat(earnedRewards) === 0}
                style={{
                  width: '100%',
                  padding: '0.9rem',
                  background: canWithdraw ? '#00f5d4' : 'rgba(100, 100, 100, 0.3)',
                  border: 'none',
                  borderRadius: '8px',
                  color: canWithdraw ? '#000' : 'rgba(255, 255, 255, 0.5)',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  cursor: canWithdraw ? 'pointer' : 'not-allowed',
                  transition: 'all 0.3s',
                  textTransform: 'uppercase',
                  marginBottom: '1rem'
                }}
              >
                CLAIM {parseFloat(earnedRewards).toFixed(6)} ETH
              </TransactionButton>
            )}
            
            {/* Transaction Link */}
            {successData?.txHash && (
              <div style={{
                fontSize: '0.65rem',
                color: 'rgba(255, 255, 255, 0.5)',
                textAlign: 'center',
                marginBottom: '1rem'
              }}>
                <a 
                  href={`https://sepolia.basescan.org/tx/${successData.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    color: '#3b82f6',
                    textDecoration: 'none'
                  }}
                >
                  View transaction on BaseScan →
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Decorative Image with Title Overlay */}
            <div style={{
              width: '100%',
              height: window.innerHeight < 700 ? '12rem' : 
                      window.innerHeight < 800 ? '16rem' : 
                      window.innerHeight < 900 ? '18rem' : '20rem',
              marginBottom: '1rem',
              borderRadius: '12px',
              overflow: 'hidden',
              position: 'relative',
              background: 'linear-gradient(180deg, rgba(20,20,30,0) 0%, rgba(20,20,30,0.9) 100%)',
              flexShrink: 0,
            }}>
              <img 
                src="/carousel_images/img13.jpg" 
                alt="Stake" 
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: 0.7,
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '100%',
                background: 'linear-gradient(to top, rgba(20,20,30,0.95) 0%, rgba(20,20,30,0.7) 50%, transparent 100%)',
              }} />
              
              {/* Title Overlay on Image */}
              <h2 style={{
                position: 'absolute',
                bottom: '15px',
                left: '50%',
                transform: 'translateX(-50%)',
                margin: 0,
                fontSize: '1.4rem',
                fontWeight: '600',
                color: '#fff',
                textAlign: 'center',
                fontFamily: 'Orbitron, monospace',
                textShadow: '0 2px 10px rgba(0,0,0,0.7)',
                width: '100%',
              }}>
                Stake RL80 Tokens {IS_TESTNET && <span style={{ fontSize: '0.7em', color: '#00f5d4' }}>(Testnet)</span>}
              </h2>
              
              {/* Close button on image */}
              <button 
                onClick={onClose}
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: '#fff',
                  fontSize: '1.2rem',
                  cursor: 'pointer',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  zIndex: 10,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.5)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                ✕
              </button>
            </div>
            
            {/* Compact Transaction Status Indicator - positioned absolutely */}
            {transactionStatus && transactionStatus !== 'success' && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: transactionStatus === 'confirming' ? 'rgba(0, 123, 255, 0.95)' : 'rgba(255, 193, 7, 0.95)',
                border: `2px solid ${transactionStatus === 'confirming' ? '#007bff' : '#ffc107'}`,
                borderRadius: '12px',
                padding: '1.5rem',
                minWidth: '250px',
                textAlign: 'center',
                zIndex: 100,
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(5px)',
              }}>
                <div style={{
                  fontSize: '1.5rem',
                  marginBottom: '0.5rem',
                  animation: transactionStatus === 'confirming' ? 'spin 2s linear infinite' : 'none'
                }}>
                  {transactionStatus === 'signing' ? '✍️' : '⏳'}
                </div>
                <div style={{
                  color: '#fff',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  marginBottom: '0.25rem'
                }}>
                  {transactionStatus === 'signing' ? 'Please sign the transaction in your wallet' :
                   'Transaction submitted! Waiting for blockchain confirmation...'}
                </div>
                {transactionStatus === 'confirming' && (
                  <div style={{
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '0.75rem',
                    marginTop: '0.5rem'
                  }}>
                    This usually takes 10-30 seconds
                  </div>
                )}
              </div>
            )}
            
            {/* Compact Info Toggle Button */}
            <div style={{ 
              textAlign: 'right', 
              marginBottom: '0.5rem',
              marginTop: '-0.5rem'
            }}>
              <button
                type="button"
                onClick={() => setShowInfo(!showInfo)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#00f5d4',
                  fontSize: '0.65rem',
                  cursor: 'pointer',
                  opacity: 0.7,
                  transition: 'opacity 0.2s',
                  padding: '0.25rem',
                }}
                onMouseEnter={(e) => e.target.style.opacity = '1'}
                onMouseLeave={(e) => e.target.style.opacity = '0.7'}
              >
                {showInfo ? '▼ Hide' : '▶ Info'}
              </button>
            </div>
            
            {/* Collapsible Info Section - More Compact */}
            {showInfo && (
              <div style={{
                background: 'rgba(0, 245, 212, 0.05)',
                border: '1px solid rgba(0, 245, 212, 0.2)',
                borderRadius: '8px',
                padding: '0.75rem',
                marginBottom: '1rem',
                fontSize: '0.65rem',
                color: 'rgba(255, 255, 255, 0.8)',
                lineHeight: '1.4',
              }}>
                <ul style={{ 
                  margin: 0, 
                  paddingLeft: '1rem',
                  listStyle: 'none',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.3rem'
                }}>
                  <li>🧪 <strong>TESTNET</strong> - 10min lock</li>
                  <li>💎 Min 1 RL80 to stake</li>
                  <li>💰 Earn ETH rewards</li>
                  <li>📊 Pro-rata distribution</li>
                </ul>
              </div>
            )}
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              {/* Compact Lock Period Display */}
              <div style={{
                background: 'rgba(255, 215, 0, 0.03)',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                borderRadius: '8px',
                padding: '0.75rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ 
                    background: '#1a1a2a',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    fontSize: '0.6rem',
                    color: '#00f5d4',
                    fontWeight: '600'
                  }}>
                    TESTNET
                  </span>
                  <span style={{ 
                    color: '#fff', 
                    fontSize: '0.85rem',
                    fontWeight: '500'
                  }}>
                    10 min lock
                  </span>
                </div>
                <div style={{ 
                  color: '#00ff66', 
                  fontSize: '0.85rem',
                  fontWeight: '500'
                }}>
                  ETH Rewards
                </div>
              </div>

              {/* Stake Amount Input */}
              <div className="form-group">
                <label className="form-label" htmlFor="stakeAmount">
                  Amount to Stake
                </label>
                <input
                  id="stakeAmount"
                  type="number"
                  className="stake-input"
                  min="1"
                  max={parseInt(tokenBalance) > 0 ? parseInt(tokenBalance) : 100000}
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  placeholder="Enter amount to stake"
                  required
                />
                {tokenBalance !== null && tokenBalance !== undefined ? (
                  <div className="token-balance">
                    Available: {tokenBalance.toLocaleString()} RL80
                  </div>
                ) : walletAddress ? (
                  <div className="token-balance">
                    Loading balance...
                  </div>
                ) : (
                  <div className="token-balance" style={{ color: '#ff6b35' }}>
                    Connect wallet to see balance
                  </div>
                )}
              </div>

              {/* Compact Staking Info Preview */}
              {stakeAmount && parseInt(stakeAmount) >= 1 && (
                <div style={{
                  background: 'rgba(255, 215, 0, 0.03)',
                  border: '1px solid rgba(255, 215, 0, 0.2)',
                  borderRadius: '8px',
                  padding: '0.5rem',
                  marginBottom: '0.75rem',
                  fontSize: '0.75rem',
                  color: 'rgba(255, 255, 255, 0.8)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span>Amount: <strong>{parseInt(stakeAmount).toLocaleString()} RL80</strong></span>
                    <span>Unlock: <strong>{IS_TESTNET 
                      ? new Date(Date.now() + 10 * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()
                    }</strong></span>
                  </div>
                  <div style={{
                    fontSize: '0.6rem',
                    color: 'rgba(255, 215, 0, 0.8)',
                    textAlign: 'center',
                    marginTop: '0.25rem'
                  }}>
                    ETH rewards distributed proportionally
                  </div>
                </div>
              )}

              {/* Approve Button - First step */}
              <TransactionButton
                  transaction={() => {
                    const amountInWei = toWei(stakeAmount || "0");
                    console.log("Approving amount:", amountInWei.toString());
                    console.log("Spender:", stakingContract.address);
                    
                    return approve({
                      contract: erc20Contract,
                      spender: stakingContract.address,
                      amount: amountInWei,
                    });
                  }}
                  onTransactionConfirmed={() => {
                    console.log("Approval confirmed!");
                    alert("Approval successful! You can now stake your tokens.");
                  }}
                  onError={(error) => {
                    console.error("Approval failed:", error);
                  }}
                  disabled={!stakeAmount || parseInt(stakeAmount) < 1}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: 'linear-gradient(135deg, #ff9500, #ff6200)',
                    border: 'none',
                    borderRadius: '50px',
                    color: '#000',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    marginBottom: '0.5rem',
                  }}
                >
                  Step 1: Approve {stakeAmount || '0'} RL80
              </TransactionButton>

              {/* Stake Button - Second step */}
              <TransactionButton
                  transaction={() => {
                    const amountInWei = toWei(stakeAmount || "0");
                    console.log("Staking amount:", amountInWei.toString());
                    console.log("User token balance:", tokenBalance);
                    console.log("Active account:", activeAccount?.address);
                    console.log("Staking contract:", stakingContract.address);
                    console.log("Contract chain:", stakingContract.chain?.id);
                    
                    // Prepare the stake transaction
                    const tx = prepareContractCall({
                      contract: stakingContract,
                      method: "stake",
                      params: [amountInWei]
                    });
                    
                    console.log("Prepared transaction:", tx);
                    return tx;
                  }}
                  onTransactionSent={() => {
                    console.log("Stake transaction sent!");
                    setTransactionStatus('confirming');
                  }}
                  onTransactionConfirmed={async (result) => {
                    console.log("Stake successful!", result);
                    setTransactionStatus('success');
                    
                    // Save to Firestore
                    const stakeData = {
                      amount: parseInt(stakeAmount),
                      duration: LOCK_DURATION_MINUTES,
                      durationUnit: 'minutes',
                      userId: user?.id,
                      walletAddress: walletAddress,
                      userImageUrl: user?.imageUrl || null,
                      userName: user?.firstName || user?.username || 'Anonymous',
                      createdAt: serverTimestamp(),
                      timestamp: new Date().toISOString(),
                      isTestnet: IS_TESTNET,
                      txHash: result.transactionHash
                    };

                    try {
                      const docRef = await addDoc(collection(db, 'stakes'), stakeData);
                      console.log('Stake saved to Firestore with ID:', docRef.id);
                      stakeData.id = docRef.id;
                    } catch (firestoreError) {
                      console.error('Error saving stake to Firestore:', firestoreError);
                    }

                    // Refresh data
                    await refreshStakingData();
                    if (refreshBalance) {
                      await refreshBalance();
                    }
                    
                    // Call parent handler
                    if (onStake) {
                      await onStake(stakeData);
                    }
                    
                    // Show success
                    setSuccessData({
                      amount: parseInt(stakeAmount),
                      unlockTime: IS_TESTNET 
                        ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)
                        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                      txHash: result.transactionHash
                    });
                    setShowSuccess(true);
                    setStakeAmount('');
                  }}
                  onError={(error) => {
                    console.error("Staking failed:", error);
                    setTransactionStatus('');
                    if (error.message?.includes('insufficient')) {
                      alert('Insufficient tokens or gas. Please check your balance.');
                    } else {
                      alert('Failed to stake tokens. Please try again.');
                    }
                  }}
                  disabled={!stakeAmount || parseInt(stakeAmount) < 1}
                  className="submit-button"
                >
                  {transactionStatus === 'confirming' ? 'Confirming...' : `Step 2: Stake ${stakeAmount || '0'} RL80`}
                </TransactionButton>
            </form>
            
          </div>
        )}
      </div>

      {/* ThirdwebBuyModal */}
      {showBuyModal && (
        <ThirdwebBuyModal 
          isOpen={showBuyModal} 
          onClose={() => {
            setShowBuyModal(false);
            // Check if balance is still 0 after closing buy modal
            const balance = parseInt(tokenBalance) || 0;
            if (balance === 0) {
              // User didn't complete purchase, close the StakeModal
              onClose();
            }
          }} 
        />
      )}
    </>
  );
};

export default StakeModal;