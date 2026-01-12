'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useWalletAuth } from './WalletAuthProvider';
import { db, collection, addDoc, serverTimestamp } from '@/lib/firebaseClient';
import ThirdwebBuyModal from './ThirdwebBuyModal';
import { useActiveAccount } from "thirdweb/react";
import { sendAndConfirmTransaction } from "thirdweb";
import { stakingTransactions, stakingContract, stakingFunctions } from '@/lib/stakingContract';
import { tokenFunctions } from '@/lib/contract';
import { toWei, toEther } from "thirdweb/utils";
import { useStaking } from '@/hooks/useStaking';

const StakeModal = ({ isOpen, onClose, onStake }) => {
  const { user } = useUser();
  const { walletAddress, tokenBalance, refreshBalance } = useWalletAuth();
  const activeAccount = useActiveAccount();
  const { 
    stakedBalance, 
    earnedRewards, 
    canWithdraw, 
    timeUntilUnlockFormatted,
    claimRewards,
    withdrawAll,
    refreshData: refreshStakingData 
  } = useStaking();
  
  const [stakeAmount, setStakeAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showNoBuyPrompt, setShowNoBuyPrompt] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [isCheckingApproval, setIsCheckingApproval] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState(''); // 'signing', 'confirming', 'success'
  const [isClaimingRewards, setIsClaimingRewards] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  
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
  
  // Check approval when stake amount changes
  useEffect(() => {
    const checkApproval = async () => {
      if (!walletAddress || !stakeAmount || stakeAmount === '0') {
        setNeedsApproval(false);
        return;
      }
      
      try {
        setIsCheckingApproval(true);
        const amountInWei = toWei(stakeAmount);
        const currentAllowance = await tokenFunctions.getAllowance(walletAddress, stakingContract.address);
        setNeedsApproval(BigInt(currentAllowance) < BigInt(amountInWei));
      } catch (error) {
        console.error('Error checking approval:', error);
        setNeedsApproval(true);
      } finally {
        setIsCheckingApproval(false);
      }
    };
    
    checkApproval();
  }, [stakeAmount, walletAddress]);

  if (!isOpen) return null;
  
  // Handle approval
  const handleApprove = async () => {
    if (!activeAccount || !stakeAmount) return;
    
    try {
      setIsSubmitting(true);
      const amountInWei = toWei(stakeAmount);
      const transaction = tokenFunctions.prepareApprove(stakingContract.address, amountInWei);
      
      console.log('Approving tokens for staking contract...');
      
      // Send and wait for confirmation
      const result = await sendAndConfirmTransaction({
        transaction,
        account: activeAccount
      });
      
      console.log('Approval successful!', result);
      setNeedsApproval(false);
    } catch (error) {
      console.error('Error approving tokens:', error);
      if (error.message?.includes('rejected') || error.message?.includes('denied')) {
        alert('Approval was rejected');
      } else {
        alert('Failed to approve tokens. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
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
      alert(`You only have ${currentBalance} RL80 tokens. Please enter a valid amount.`);
      return;
    }
    
    // Check if we need approval first
    if (needsApproval) {
      alert('Please approve tokens first before staking');
      return;
    }
    
    if (!activeAccount) {
      alert('Please connect your wallet first');
      return;
    }

    setIsSubmitting(true);
    setTransactionStatus('signing');

    try {
      // Prepare the stake transaction
      const amountInWei = toWei(amount.toString());
      const transaction = stakingTransactions.prepareStake(amountInWei);
      
      console.log('Executing stake transaction for amount:', amount);
      
      // User is signing in wallet
      setTransactionStatus('signing');
      
      // Send and wait for blockchain confirmation
      const result = await sendAndConfirmTransaction({
        transaction,
        account: activeAccount,
        onTransactionSent: () => {
          console.log('Transaction sent, waiting for confirmation...');
          setTransactionStatus('confirming');
        }
      });
      
      console.log('Stake transaction confirmed!', result);
      
      // Only show success after blockchain confirmation
      if (result && result.transactionHash) {
        setTransactionStatus('success');
        
        // Save to Firestore for record keeping
        const stakeData = {
          amount: amount,
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

        // Refresh balance and staking data
        if (refreshBalance) {
          await refreshBalance();
        }
        
        // Refresh staking data to get updated balances
        await refreshStakingData();
        
        // Call the parent's stake handler
        if (onStake) {
          await onStake(stakeData);
        }
        
        // Show success message only after confirmed
        setSuccessData({
          amount: amount,
          unlockTime: IS_TESTNET 
            ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)
            : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          txHash: result.transactionHash
        });
        setShowSuccess(true);
      } else {
        // Transaction failed or was rejected
        throw new Error('Transaction failed or was rejected');
      }
      
    } catch (error) {
      console.error('Error staking tokens:', error);
      if (error.message?.includes('insufficient')) {
        alert('Insufficient tokens or gas. Please check your balance.');
      } else if (error.message?.includes('rejected')) {
        alert('Transaction was rejected by user');
      } else {
        alert('Failed to stake tokens. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
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
                           linear-gradient(90deg, #d4af37, #ffd700);
          background-origin: border-box;
          background-clip: padding-box, border-box;
          border-radius: 20px;
          padding: 1.5rem;
          padding-bottom: 2rem;
          width: 90%;
          max-width: 600px;
          height: auto;
          max-height: 85vh;
          overflow-y: auto;
          overflow-x: hidden;
          position: relative;
          animation: fadeIn 0.4s ease-out;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(212, 175, 55, 0.3);
        }
        
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
          color: #d4af37;
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
          color: #ffd700;
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
          color: #d4af37;
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
          border-color: #d4af37;
          background: rgba(212, 175, 55, 0.05);
        }

        .token-balance {
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 0.5rem;
        }

        .submit-button {
          width: 100%;
          padding: 0.875rem;
          background: linear-gradient(135deg, #d4af37, #ffd700);
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
          box-shadow: 0 10px 30px rgba(212, 175, 55, 0.3);
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
              border: '1px solid rgba(212, 175, 55, 0.4)',
              borderRadius: '24px',
              padding: '1rem',
              maxWidth: '420px',
              textAlign: 'center',
              color: '#fff',
              boxShadow: '0 0 60px rgba(212, 175, 55, 0.3)',
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
                color: '#d4af37',
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
              color: '#d4af37',
              fontSize: '1.1rem',
              marginBottom: '2.5rem',
              lineHeight: '1.5',
            }}>
              You need RL80 tokens to stake.
            </p>
            
            {/* Info message for test mode */}
            <div style={{
              background: 'rgba(212, 175, 55, 0.1)',
              border: '1px solid rgba(212, 175, 55, 0.3)',
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
            maxWidth: '500px'
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
                color: successData?.showDashboard ? '#d4af37' : '#00ff66',
                fontFamily: 'Orbitron, monospace'
              }}>
                {successData?.showDashboard ? 'STAKING DASHBOARD' : 'Staking Successful!'}
              </h2>
            </div>
            
            {/* Your Staking Position */}
            <div style={{
              background: 'rgba(20, 20, 30, 0.5)',
              border: '2px solid rgba(212, 175, 55, 0.3)',
              borderRadius: '12px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <h3 style={{
                fontSize: '0.9rem',
                color: '#d4af37',
                marginBottom: '1rem',
                textAlign: 'center',
                fontWeight: '600'
              }}>
                YOUR STAKING POSITION
              </h3>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div style={{
                  background: 'rgba(0, 245, 212, 0.05)',
                  border: '1px solid rgba(0, 245, 212, 0.2)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: '0.65rem',
                    color: 'rgba(255, 255, 255, 0.6)',
                    marginBottom: '0.25rem'
                  }}>
                    Total Staked
                  </div>
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    color: '#00f5d4'
                  }}>
                    {parseFloat(stakedBalance || 0).toFixed(2)} RL80
                  </div>
                </div>
                
                <div style={{
                  background: 'rgba(255, 215, 0, 0.05)',
                  border: '1px solid rgba(255, 215, 0, 0.2)',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: '0.65rem',
                    color: 'rgba(255, 255, 255, 0.6)',
                    marginBottom: '0.25rem'
                  }}>
                    Pending Rewards
                  </div>
                  <div style={{
                    fontSize: '1.1rem',
                    fontWeight: '700',
                    color: '#ffd700'
                  }}>
                    {parseFloat(earnedRewards || 0).toFixed(6)} ETH
                  </div>
                </div>
              </div>
              
              <div style={{
                background: 'rgba(138, 43, 226, 0.05)',
                border: '1px solid rgba(138, 43, 226, 0.2)',
                borderRadius: '8px',
                padding: '0.75rem',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '0.65rem',
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginBottom: '0.25rem'
                }}>
                  {canWithdraw ? 'Status' : 'Unlock In'}
                </div>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: canWithdraw ? '#00ff66' : '#ff6b6b'
                }}>
                  {canWithdraw ? '🔓 Unlocked' : `🔒 ${timeUntilUnlockFormatted}`}
                </div>
              </div>
            </div>
            
            {/* Token Balance */}
            <div style={{
              background: 'rgba(59, 130, 246, 0.05)',
              border: '1px solid rgba(59, 130, 246, 0.2)',
              borderRadius: '8px',
              padding: '0.75rem',
              marginBottom: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.7)'
              }}>
                Wallet Balance:
              </span>
              <span style={{
                fontSize: '0.9rem',
                fontWeight: '600',
                color: '#3b82f6'
              }}>
                {tokenBalance?.toLocaleString() || '0'} RL80
              </span>
            </div>
            
            {/* Action Buttons */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: parseFloat(earnedRewards || 0) > 0 ? 'repeat(2, 1fr)' : '1fr',
              gap: '0.75rem',
              marginBottom: '1rem'
            }}>
              {parseFloat(earnedRewards || 0) > 0 && (
                <button
                  onClick={async () => {
                    try {
                      setIsClaimingRewards(true);
                      await claimRewards();
                      await refreshStakingData();
                      alert('Rewards claimed successfully!');
                    } catch (err) {
                      console.error('Error claiming rewards:', err);
                      alert('Failed to claim rewards');
                    } finally {
                      setIsClaimingRewards(false);
                    }
                  }}
                  disabled={isClaimingRewards}
                  style={{
                    padding: '0.75rem',
                    background: 'linear-gradient(135deg, #ffd700, #ffed4e)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#000',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: isClaimingRewards ? 'not-allowed' : 'pointer',
                    opacity: isClaimingRewards ? 0.5 : 1,
                    transition: 'all 0.3s'
                  }}
                >
                  {isClaimingRewards ? 'Claiming...' : '💰 Claim Rewards'}
                </button>
              )}
              
              {canWithdraw && parseFloat(stakedBalance || 0) > 0 && (
                <button
                  onClick={async () => {
                    if (!confirm('Are you sure you want to withdraw all staked tokens?')) return;
                    try {
                      setIsWithdrawing(true);
                      await withdrawAll();
                      await refreshStakingData();
                      alert('Tokens withdrawn successfully!');
                    } catch (err) {
                      console.error('Error withdrawing tokens:', err);
                      alert('Failed to withdraw tokens');
                    } finally {
                      setIsWithdrawing(false);
                    }
                  }}
                  disabled={isWithdrawing || !canWithdraw}
                  style={{
                    padding: '0.75rem',
                    background: canWithdraw 
                      ? 'linear-gradient(135deg, #00f5d4, #00bbff)'
                      : 'rgba(100, 100, 100, 0.3)',
                    border: 'none',
                    borderRadius: '8px',
                    color: canWithdraw ? '#000' : 'rgba(255, 255, 255, 0.5)',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: canWithdraw && !isWithdrawing ? 'pointer' : 'not-allowed',
                    opacity: isWithdrawing ? 0.5 : 1,
                    transition: 'all 0.3s'
                  }}
                >
                  {isWithdrawing ? 'Withdrawing...' : canWithdraw ? '📤 Withdraw All' : `🔒 Locked`}
                </button>
              )}
            </div>
            
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
            
            <button
              onClick={() => {
                setShowSuccess(false);
                setStakeAmount('');
              }}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              Stake More
            </button>
          </div>
        ) : (
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Decorative Image with Title Overlay */}
            <div style={{
              width: '100%',
              height: window.innerHeight < 700 ? '12rem' : window.innerHeight < 800 ? '16rem' : '22rem',
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
                Stake RL80 Tokens {IS_TESTNET && <span style={{ fontSize: '0.7em', color: '#ffd700' }}>(Testnet)</span>}
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
                  color: '#d4af37',
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
                background: 'rgba(212, 175, 55, 0.05)',
                border: '1px solid rgba(212, 175, 55, 0.2)',
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
                    color: '#ffd700',
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

              {/* Submit Button - Shows Approve or Stake based on approval status */}
              {needsApproval ? (
                <button
                  type="button"
                  onClick={handleApprove}
                  className="submit-button"
                  disabled={isSubmitting || !stakeAmount || parseInt(stakeAmount) < 1 || isCheckingApproval}
                  style={{
                    background: isSubmitting ? 'linear-gradient(135deg, #666, #888)' : 'linear-gradient(135deg, #ff9500, #ff6200)'
                  }}
                >
                  {isSubmitting ? 'Approving...' : isCheckingApproval ? 'Checking...' : `Approve ${stakeAmount || '0'} RL80`}
                </button>
              ) : (
                <button
                  type="submit"
                  className="submit-button"
                  disabled={isSubmitting || !stakeAmount || parseInt(stakeAmount) < 1}
                >
                  {transactionStatus === 'signing' ? '⏳ Waiting for signature...' :
                   transactionStatus === 'confirming' ? '⏳ Confirming on blockchain...' :
                   transactionStatus === 'success' ? '✅ Success!' :
                   isSubmitting ? 'Processing...' : 
                   `Stake ${stakeAmount || '0'} RL80`}
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