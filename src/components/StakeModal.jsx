'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useWalletAuth } from './WalletAuthProvider';
import { db, collection, addDoc, serverTimestamp } from '@/lib/firebaseClient';
import ThirdwebBuyModal from './ThirdwebBuyModal';
import { 
  useSendTransaction,
  TransactionButton
} from "thirdweb/react";
import { prepareContractCall, sendAndConfirmTransaction } from "thirdweb";
import { approve } from "thirdweb/extensions/erc20";
import { stakingContract } from '@/lib/stakingContract';
import { erc20Contract } from '@/lib/contract';
import { toWei } from "thirdweb/utils";
import { useStaking } from '@/hooks/useStaking';
import { validateAmount, validateTransaction, checkRateLimit, formatSafeErrorMessage } from '@/utils/security';

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
  const [transactionStatus, setTransactionStatus] = useState(''); // 'approving', 'staking', 'confirming', 'success'
  const [isDataRefreshing, setIsDataRefreshing] = useState(false);
  const [validationError, setValidationError] = useState('');
  const { mutate: sendTransaction } = useSendTransaction();
  const isStakeSignedRef = useRef(false); // Track if stake was actually signed
  const lastTransactionRef = useRef(0); // For rate limiting
  
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
      isStakeSignedRef.current = false;
      setIsDataRefreshing(false);
      
      // Check if user has existing stakes and should see dashboard
      const hasExistingStakes = parseFloat(stakedBalance || 0) > 0;
      
      if (hasExistingStakes) {
        // Show dashboard view for users with existing stakes
        setShowSuccess(true);
        setSuccessData({
          showDashboard: true,
          optimisticStakedAmount: stakedBalance
        });
        setShowNoBuyPrompt(false);
      } else {
        // Show form view for new stakers
        setShowSuccess(false);
        setSuccessData(null);
        
        // Check token balance for new stakers
        const balance = parseInt(tokenBalance) || 0;
        if (walletAddress && balance === 0) {
          setShowNoBuyPrompt(true);
        } else {
          setShowNoBuyPrompt(false);
        }
      }
    }
  }, [isOpen, walletAddress, tokenBalance, stakedBalance]);
  
  // Safe error display function - moved before early return
  const showError = useCallback((message) => {
    setValidationError(message);
    setTimeout(() => setValidationError(''), 5000); // Clear after 5 seconds
  }, []);

  // Enhanced validation function - moved before early return
  const validateStakeForm = useCallback(() => {
    const currentBalance = parseInt(tokenBalance) || 0;
    
    // Rate limiting check
    const rateLimitResult = checkRateLimit(walletAddress, 3, 60000);
    if (!rateLimitResult.allowed) {
      showError(rateLimitResult.error);
      return false;
    }
    
    // Transaction validation
    const transactionValidation = validateTransaction(stakeAmount, currentBalance, walletAddress);
    if (!transactionValidation.isValid) {
      if (currentBalance === 0) {
        setShowNoBuyPrompt(true);
        return false;
      }
      showError(transactionValidation.error);
      return false;
    }
    
    return true;
  }, [stakeAmount, tokenBalance, walletAddress, showError]);

  // No auto-close anymore since we have actionable content
  // No longer need to check approval separately - getApprovalForTransaction handles it

  if (!isOpen) return null;
  
  // Handle approval is now done via TransactionButton

  const handleSubmit = (e) => {
    e.preventDefault();
    // Validation is now handled by validateStakeForm
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
          width: 90%;
          max-width: 480px;
          max-height: 90vh;
          overflow: hidden;
          position: relative;
          animation: fadeIn 0.4s ease-out;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 245, 212, 0.3);
        }
        
        /* Height-based media queries */
        @media (max-height: 700px) {
          .modal-content {
            max-height: 95vh;
            padding: 1rem;
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
          margin-bottom: 0.75rem;
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
          0%, 80%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          40% {
            opacity: 1;
            transform: scale(1.2);
          }
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
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
              {isDataRefreshing && (
                <div style={{
                  fontSize: '0.75rem',
                  color: '#00f5d4',
                  marginTop: '0.5rem',
                  opacity: 0.8,
                  animation: 'pulse 1.5s ease-in-out infinite'
                }}>
                  Updating balances...
                </div>
              )}
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
                    fontSize: '0.8rem',
                    color: 'rgba(255, 255, 255, 0.5)',
                    marginBottom: '0.25rem',
                    textTransform: 'uppercase'
                  }}>
                    Staked Amount
                  </div>
                  <div style={{
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    color: '#fff'
                  }}>
                    {parseFloat(successData?.optimisticStakedAmount || stakedBalance || 0).toLocaleString()} RL80
                  </div>
                </div>
                
                <div>
                  <div style={{
                    fontSize: '0.8rem',
                    color: 'rgba(255, 255, 255, 0.5)',
                    marginBottom: '0.25rem',
                    textTransform: 'uppercase'
                  }}>
                    Lock Status
                  </div>
                  <div style={{
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    color: canWithdraw ? '#00ff88' : '#ff6b6b'
                  }}>
                    {canWithdraw ? 'Unlocked' : timeUntilUnlockFormatted}
                  </div>
                </div>
                
                <div>
                  <div style={{
                    fontSize: '0.8rem',
                    color: 'rgba(255, 255, 255, 0.5)',
                    marginBottom: '0.25rem',
                    textTransform: 'uppercase'
                  }}>
                    Rewards Earned
                  </div>
                  <div style={{
                    fontSize: '1.2rem',
                    fontWeight: '600',
                    color: '#00f5d4'
                  }}>
                    {parseFloat(earnedRewards || 0).toFixed(6)} ETH
                  </div>
                </div>
                
                <div>
                  <div style={{
                    fontSize: '0.8rem',
                    color: 'rgba(255, 255, 255, 0.5)',
                    marginBottom: '0.25rem',
                    textTransform: 'uppercase'
                  }}>
                    Total Pool
                  </div>
                  <div style={{
                    fontSize: '1.2rem',
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
                  setSuccessData(null);
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
                {canWithdraw ? `WITHDRAW ALL (${parseFloat(successData?.optimisticStakedAmount || stakedBalance || 0).toLocaleString()} RL80)` : `🔒 LOCKED`}
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
              height: '240px',
              marginBottom: '0.75rem',
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
            
            
            {/* Compact Info Toggle Button */}
            <div style={{ 
              textAlign: 'right', 
              marginBottom: '0.25rem',
              marginTop: '-0.75rem'
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
                padding: '0.5rem',
                marginBottom: '0.5rem',
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
            
            <form onSubmit={handleSubmit} style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.5rem'
            }}>
              {/* Compact Lock Period Display - Info Banner Style */}
              <div style={{
                background: 'linear-gradient(90deg, rgba(0, 245, 212, 0.05), rgba(0, 187, 255, 0.05))',
                border: 'none',
                borderLeft: '3px solid #00f5d4',
                borderRadius: '4px',
                padding: '0.4rem 0.6rem',
                marginBottom: '0.4rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ 
                    fontSize: '0.65rem',
                    color: '#00f5d4',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>
                    🔐 Testnet Mode
                  </span>
                  <span style={{ 
                    color: 'rgba(255, 255, 255, 0.7)', 
                    fontSize: '0.75rem'
                  }}>
                    •
                  </span>
                  <span style={{ 
                    color: 'rgba(255, 255, 255, 0.7)', 
                    fontSize: '0.75rem'
                  }}>
                    10 minute lock period
                  </span>
                </div>
                <div style={{ 
                  color: '#00ff66', 
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  <span>💰</span>
                  ETH Rewards
                </div>
              </div>

              {/* Stake Amount Input */}
              <div className="form-group" style={{ marginBottom: '0' }}>
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

              {/* Validation Error Display */}
              {validationError && (
                <div style={{
                  background: 'rgba(255, 107, 107, 0.1)',
                  border: '1px solid rgba(255, 107, 107, 0.3)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  fontSize: '0.8rem',
                  color: '#ff6b6b',
                  textAlign: 'center'
                }}>
                  ⚠️ {validationError}
                </div>
              )}

              {/* Compact Staking Info Preview */}
              {stakeAmount && parseInt(stakeAmount) >= 1 && (
                <div style={{
                  background: 'rgba(255, 215, 0, 0.03)',
                  border: '1px solid rgba(255, 215, 0, 0.2)',
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
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
              {/* Single Stake Button - handles approval automatically */}
              {activeAccount?.sendTransaction ? (
                // Test wallet - handle approve and stake in one flow
                <button
                  onClick={async () => {
                    try {
                      // Validate before proceeding
                      if (!validateStakeForm()) {
                        return;
                      }
                      
                      setIsSubmitting(true);
                      setTransactionStatus('signing');
                      setValidationError(''); // Clear any existing errors
                      
                      const validation = validateAmount(stakeAmount, parseInt(tokenBalance));
                      if (!validation.isValid) {
                        showError(validation.error);
                        setIsSubmitting(false);
                        return;
                      }
                      
                      const amountInWei = toWei(validation.value.toString());
                      console.log("Test wallet staking amount:", amountInWei.toString());
                      
                      // First approve the tokens
                      console.log("Approving tokens...");
                      const approveTx = approve({
                        contract: erc20Contract,
                        spender: stakingContract.address,
                        amount: amountInWei,
                      });
                      
                      const approvalResult = await sendAndConfirmTransaction({
                        transaction: approveTx,
                        account: activeAccount
                      });
                      
                      console.log("Approval confirmed:", approvalResult);
                      
                      // Small delay to ensure approval is fully processed
                      await new Promise(resolve => setTimeout(resolve, 1000));
                      
                      console.log("Now staking...");
                      setTransactionStatus('confirming');
                      
                      // Then stake the tokens
                      const stakeTx = prepareContractCall({
                        contract: stakingContract,
                        method: "stake",
                        params: [amountInWei]
                      });
                      
                      const result = await sendAndConfirmTransaction({
                        transaction: stakeTx,
                        account: activeAccount
                      });
                      
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
                        name: user?.username || user?.firstName || 'Anonymous',
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

                      // Show success immediately with optimistic update
                      setSuccessData({
                        amount: parseInt(stakeAmount),
                        unlockTime: IS_TESTNET 
                          ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)
                          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                        txHash: result.transactionHash,
                        optimisticStakedAmount: (parseFloat(stakedBalance || 0) + parseInt(stakeAmount)).toString()
                      });
                      setShowSuccess(true);
                      setStakeAmount('');
                      setIsSubmitting(false);
                      
                      // Refresh data in the background
                      setIsDataRefreshing(true);
                      Promise.all([
                        refreshStakingData(),
                        refreshBalance ? refreshBalance() : Promise.resolve()
                      ]).then(() => {
                        console.log('Data refreshed after staking');
                        setIsDataRefreshing(false);
                      }).catch(err => {
                        console.error('Error refreshing data:', err);
                        setIsDataRefreshing(false);
                      });
                      
                      // Call parent handler
                      if (onStake) {
                        await onStake(stakeData);
                      }
                    } catch (error) {
                      console.error("Staking failed");
                      setTransactionStatus('');
                      
                      // Use safe error messaging
                      const safeErrorMessage = formatSafeErrorMessage(error);
                      if (!error?.message?.includes('User rejected') && !error?.message?.includes('User denied')) {
                        showError(safeErrorMessage);
                      }
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={!stakeAmount || parseInt(stakeAmount) < 1 || isSubmitting}
                  className="submit-button"
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: isSubmitting ? 'gray' : 'linear-gradient(135deg, #00f5d4, #00bbff)',
                    border: 'none',
                    borderRadius: '50px',
                    color: '#000',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {transactionStatus === 'signing' || transactionStatus === 'approving' ? 'Approving...' : 
                   transactionStatus === 'staking' ? 'Signing Stake...' :
                   transactionStatus === 'confirming' ? 'Confirming...' : 
                   `Stake ${stakeAmount || '0'} RL80`}
                </button>
              ) : (
                // Regular wallet - manual approval and stake flow
                <button
                  onClick={async () => {
                    if (isSubmitting) return;
                    
                    // Validate before proceeding
                    if (!validateStakeForm()) {
                      return;
                    }
                    
                    try {
                      setIsSubmitting(true);
                      setValidationError(''); // Clear any existing errors
                      
                      const validation = validateAmount(stakeAmount, parseInt(tokenBalance));
                      if (!validation.isValid) {
                        showError(validation.error);
                        setIsSubmitting(false);
                        return;
                      }
                      
                      const amountInWei = toWei(validation.value.toString());
                      
                      // Step 1: Approval
                      console.log("Starting approval process...");
                      // Don't set transaction status for regular wallets
                      // setTransactionStatus('approving');
                      
                      const approvalTx = approve({
                        contract: erc20Contract,
                        spender: stakingContract.address,
                        amount: amountInWei,
                      });
                      
                      // Send approval transaction
                      sendTransaction(approvalTx, {
                        onSuccess: async (approvalResult) => {
                          console.log("Approval SIGNED by user and sent to blockchain");
                          
                          // Keep showing Step 1 while approval confirms
                          
                          // Wait for approval confirmation
                          if (approvalResult?.wait) {
                            console.log("Waiting for approval to be mined...");
                            await approvalResult.wait();
                          } else {
                            // For networks that don't return a wait function, wait a bit
                            console.log("Waiting for approval to propagate...");
                            await new Promise(resolve => setTimeout(resolve, 3000));
                          }
                          
                          console.log("Approval CONFIRMED on blockchain!");
                          
                          // Don't set transaction status for regular wallets
                          // setTransactionStatus('staking');
                          
                          // Small delay to ensure UI updates
                          await new Promise(resolve => setTimeout(resolve, 200));
                          
                          // Prepare stake transaction
                          const stakeTx = prepareContractCall({
                            contract: stakingContract,
                            method: "stake",
                            params: [amountInWei]
                          });
                          
                          console.log("About to call sendTransaction for stake...");
                          
                          // Add a longer delay to ensure approval is fully processed before staking
                          setTimeout(() => {
                            console.log("Now calling sendTransaction for stake - wallet will prompt user...");
                            
                            // Send stake transaction - this will prompt the user
                            sendTransaction(stakeTx, {
                              onSuccess: async (stakeResult) => {
                                console.log("Stake onSuccess fired - user has signed the stake!");
                                
                                // Don't show confirming box for regular wallets
                                // setTransactionStatus('confirming');
                              
                              // Wait for confirmation
                              if (stakeResult?.wait) {
                                await stakeResult.wait();
                              }
                              
                              console.log("Stake confirmed!");
                              
                              // Save to Firestore
                              const stakeData = {
                                amount: parseInt(stakeAmount),
                                duration: LOCK_DURATION_MINUTES,
                                durationUnit: 'minutes',
                                userId: user?.id,
                                walletAddress: walletAddress,
                                userImageUrl: user?.imageUrl || null,
                                name: user?.username || user?.firstName || 'Anonymous',
                                createdAt: serverTimestamp(),
                                timestamp: new Date().toISOString(),
                                isTestnet: IS_TESTNET,
                                txHash: stakeResult.transactionHash || stakeResult.hash
                              };

                              try {
                                const docRef = await addDoc(collection(db, 'stakes'), stakeData);
                                console.log('Stake saved to Firestore with ID:', docRef.id);
                                stakeData.id = docRef.id;
                              } catch (firestoreError) {
                                console.error('Error saving stake to Firestore:', firestoreError);
                              }

                              // Show success immediately with optimistic update
                              // setTransactionStatus('success');
                              setSuccessData({
                                amount: parseInt(stakeAmount),
                                unlockTime: IS_TESTNET 
                                  ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)
                                  : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                                txHash: stakeResult.transactionHash || stakeResult.hash,
                                optimisticStakedAmount: (parseFloat(stakedBalance || 0) + parseInt(stakeAmount)).toString()
                              });
                              setShowSuccess(true);
                              setStakeAmount('');
                              setIsSubmitting(false);
                              
                              // Refresh data in the background
                              setIsDataRefreshing(true);
                              Promise.all([
                                refreshStakingData(),
                                refreshBalance ? refreshBalance() : Promise.resolve()
                              ]).then(() => {
                                console.log('Data refreshed after staking');
                                setIsDataRefreshing(false);
                              }).catch(err => {
                                console.error('Error refreshing data:', err);
                                setIsDataRefreshing(false);
                              });
                              
                              // Call parent handler
                              if (onStake) {
                                await onStake(stakeData);
                              }
                            },
                              onError: (error) => {
                                console.error("Stake transaction failed:", error);
                                // setTransactionStatus('');
                                setIsSubmitting(false);
                                
                                // Check for specific error signatures
                                if (error?.message?.includes('0xfb8f41b2')) {
                                  showError('Insufficient token allowance. Please try again.');
                                } else if (!error?.message?.includes('User rejected') && 
                                    !error?.message?.includes('User denied')) {
                                  showError(formatSafeErrorMessage(error));
                                }
                              }
                            });
                          }, 2000); // Longer delay to ensure approval is fully processed
                        },
                        onError: (error) => {
                          console.error("Approval transaction failed:", error);
                          // setTransactionStatus('');
                          setIsSubmitting(false);
                          
                          if (!error?.message?.includes('User rejected') && 
                              !error?.message?.includes('User denied')) {
                            showError(formatSafeErrorMessage(error));
                          }
                        }
                      });
                    } catch (error) {
                      console.error("Failed to initiate staking");
                      setIsSubmitting(false);
                      showError('Failed to stake tokens. Please try again.');
                    }
                  }}
                  disabled={!stakeAmount || parseInt(stakeAmount) < 1 || isSubmitting}
                  className="submit-button"
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: 'linear-gradient(135deg, #00f5d4, #00bbff)',
                    border: 'none',
                    borderRadius: '50px',
                    color: '#000',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                  }}
                >
                  {isSubmitting ? 'Processing...' : `Stake ${stakeAmount || '0'} RL80`}
                </button>
              )}
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