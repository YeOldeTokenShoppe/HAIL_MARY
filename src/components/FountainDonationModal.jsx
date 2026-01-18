'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useWalletAuth } from './WalletAuthProvider';
import { CHARITY_WALLETS, tokenFunctions, client } from '@/lib/contract';
import { ConnectButton } from "thirdweb/react";
import { sendAndConfirmTransaction } from "thirdweb";
import { darkTheme } from "thirdweb/react";
import { defineChain } from "thirdweb/chains";
import { inAppWallet } from "thirdweb/wallets/in-app";
import { createWallet } from "thirdweb/wallets";
import { db, collection, addDoc, serverTimestamp } from '@/lib/firebaseClient';

const chain = defineChain(84532); // Base Sepolia

// Custom theme matching the donation modal style
const donationWalletTheme = darkTheme({
  colors: {
    primaryButtonBg: "linear-gradient(135deg, #FFD700, #FFA500)",
    primaryButtonText: "#000",
    modalBg: "rgba(20, 20, 30, 0.98)",
    borderColor: "rgba(255, 215, 0, 0.3)",
    accentText: "#FFD700",
    primaryText: "#ffffff",
    secondaryText: "rgba(255, 255, 255, 0.6)",
    connectedButtonBg: "rgba(255, 215, 0, 0.1)",
    connectedButtonBgHover: "rgba(255, 215, 0, 0.2)",
  },
  fontFamily: "'Orbitron', monospace",
});

// Wallet options
const donationWallets = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
  createWallet("walletConnect"),
  inAppWallet({
    auth: {
      options: ["google", "discord", "telegram", "farcaster", "email", "x", "passkey"],
    },
  }),
];

const FountainDonationModal = ({ isOpen, onClose, onDonationComplete, preselectedCharity = null }) => {
  const [selectedCharity, setSelectedCharity] = useState(null);
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState('select'); // 'select', 'amount', 'confirm', 'processing', 'success', 'error'
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [pendingDonation, setPendingDonation] = useState(null); // Store donation info for coin toss

  const { user } = useUser();
  const {
    walletAddress,
    tokenBalance,
    isWalletConnected,
    activeAccount,
    refreshBalance
  } = useWalletAuth();

  // Get user display info for donation feed
  const getUserDisplayName = () => {
    if (user?.username) return user.username;
    if (user?.firstName && user?.lastName) return `${user.firstName} ${user.lastName}`;
    if (user?.firstName) return user.firstName;
    if (walletAddress) return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
    return 'Anonymous';
  };

  const getUserAvatar = () => {
    return user?.imageUrl || null;
  };

  const [isTransactionPending, setIsTransactionPending] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);




  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setError(null);
      setTxHash(null);
      setPendingDonation(null);

      // If charity is preselected from toggle, skip to amount step
      if (preselectedCharity && CHARITY_WALLETS[preselectedCharity]) {
        setSelectedCharity(preselectedCharity);
        setStep('amount');
      } else {
        setSelectedCharity(null);
        setStep('select');
      }
    }
  }, [isOpen, preselectedCharity]);

  const handleCharitySelect = (charityKey) => {
    setSelectedCharity(charityKey);
    setStep('amount');
  };

  // Close modal and trigger coin toss animation
  const handleWatchCoin = () => {
    if (pendingDonation && onDonationComplete) {
      onDonationComplete(pendingDonation);
    }
    setPendingDonation(null);
    onClose();
  };

  const handleAmountSubmit = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (numAmount > parseFloat(tokenBalance || '0')) {
      setError('Insufficient balance');
      return;
    }
    setError(null);
    setStep('confirm');
  };

  const handleDonate = async () => {
    if (!activeAccount || !selectedCharity || !amount) return;

    setStep('processing');
    setError(null);
    setIsTransactionPending(true);

    try {
      const charity = CHARITY_WALLETS[selectedCharity];
      const decimals = await tokenFunctions.getDecimals();

      // Parse amount properly to avoid floating-point precision issues
      // Split into integer and decimal parts
      const [intPart, decPart = ''] = amount.split('.');
      const paddedDecimal = decPart.padEnd(decimals, '0').slice(0, decimals);
      const amountInWei = BigInt(intPart + paddedDecimal);

      console.log('Amount calculation:', { amount, decimals, intPart, decPart, paddedDecimal, amountInWei: amountInWei.toString() });

      // Prepare the transfer transaction
      const transaction = tokenFunctions.transfer(charity.address, amountInWei);
      console.log('Prepared transaction:', transaction);
      console.log('Active account:', activeAccount);

      // Send the transaction using sendAndConfirmTransaction with the active account
      const result = await sendAndConfirmTransaction({
        transaction,
        account: activeAccount
      });
      console.log('Transaction result:', result);

      // Get transaction hash from result
      const txHashValue = result?.transactionHash || result?.hash || '';
      setTxHash(txHashValue);

      // Log to Firestore
      try {
        await addDoc(collection(db, 'fountain_donations'), {
          donor: walletAddress,
          userName: getUserDisplayName(),
          userAvatar: getUserAvatar(),
          charity: selectedCharity,
          charityName: charity.name,
          charityAddress: charity.address,
          amount: amount,
          amountWei: amountInWei.toString(),
          txHash: txHashValue,
          timestamp: serverTimestamp(),
          network: 'base-sepolia'
        });
      } catch (firestoreError) {
        console.error('Error logging donation to Firestore:', firestoreError);
        // Don't fail the donation if Firestore logging fails
      }

      // Refresh balance
      await refreshBalance();

      // Store donation info for coin toss (triggered when user clicks "Watch Your Coin!")
      setPendingDonation({
        charity: selectedCharity,
        amount,
        txHash: txHashValue
      });

      setStep('success');

    } catch (err) {
      console.error('Donation error:', err);
      setError(err.message || 'Transaction failed');
      setStep('error');
    } finally {
      setIsTransactionPending(false);
    }
  };

  if (!isOpen) return null;

  const charity = selectedCharity ? CHARITY_WALLETS[selectedCharity] : null;

  return (
    <>
      <style jsx>{`
        @keyframes modalGlitch {
          0%, 100% { transform: translate(0); filter: hue-rotate(0deg); }
          10% { transform: translate(-2px, 2px); filter: hue-rotate(90deg); }
          20% { transform: translate(-2px, -2px); filter: hue-rotate(180deg); }
          30% { transform: translate(2px, 2px); filter: hue-rotate(270deg); }
          40% { transform: translate(2px, -2px); filter: hue-rotate(360deg); }
        }

        @keyframes textGlitch {
          0%, 100% { text-shadow: 2px 2px #FFD700, -2px -2px #00f5d4, 0 0 20px rgba(255, 215, 0, 0.8); }
          25% { text-shadow: -2px 2px #00f5d4, 2px -2px #FFD700, 0 0 30px rgba(0, 245, 212, 0.8); }
          50% { text-shadow: 2px -2px #ff6b6b, -2px 2px #FFD700, 0 0 25px rgba(255, 107, 107, 0.8); }
          75% { text-shadow: -2px -2px #00f5d4, 2px 2px #ff6b6b, 0 0 35px rgba(0, 245, 212, 0.8); }
        }

        @keyframes coinSpin {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }


        .coin-spin { animation: coinSpin 2s linear infinite; }
        .pulse { animation: pulse 1.5s ease-in-out infinite; }

        .charity-card {
          background: rgba(20, 20, 30, 0.9);
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 12px;
          padding: 1rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .charity-card:hover {
          border-color: #FFD700;
          box-shadow: 0 0 20px rgba(255, 215, 0, 0.3);
          transform: translateY(-2px);
        }

        .charity-card.selected {
          border-color: #00f5d4;
          box-shadow: 0 0 25px rgba(0, 245, 212, 0.4);
        }

        .amount-input {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 12px;
          padding: 0.75rem;
          color: #fff;
          font-size: 0.9rem;
          font-family: 'Orbitron', monospace;
          text-align: center;
          width: 100%;
          outline: none;
          transition: all 0.3s ease;
        }

        .amount-input:focus {
          border-color: #FFD700;
          background: rgba(255, 215, 0, 0.05);
        }

        .donate-btn {
          background: linear-gradient(135deg, #FFD700, #FFA500);
          border: none;
          border-radius: 50px;
          padding: 0.875rem;
          color: #000;
          font-family: 'Orbitron', monospace;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.3s ease;
          text-transform: uppercase;
          letter-spacing: 1px;
          width: 100%;
        }

        .donate-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(255, 215, 0, 0.3);
        }

        .donate-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .back-btn {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          padding: 0.5rem 1rem;
          color: rgba(255, 255, 255, 0.7);
          font-family: 'Orbitron', monospace;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .back-btn:hover {
          border-color: rgba(255, 255, 255, 0.6);
          color: #fff;
        }
      `}</style>

      {/* Modal Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          zIndex: 100000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={onClose}
      >
        {/* Modal Content */}
        <div
       
          style={{
            position: 'relative',
            background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            border: '2px solid rgba(255, 215, 0, 0.3)',
            borderRadius: '16px',
            padding: '1.5rem',
            maxWidth: '480px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 0 40px rgba(255, 215, 0, 0.2), 0 0 80px rgba(0, 245, 212, 0.1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
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
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
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

          {/* Title */}
          <h2  style={{
            color: '#FFD700',
            textAlign: 'center',
            marginBottom: '0.5rem',
            fontSize: '1.4rem',
            fontFamily: "'Orbitron', monospace",
            textTransform: 'uppercase',
            letterSpacing: '2px',
          }}>
            Toss a Coin
          </h2>

          <p style={{
            color: 'rgba(255, 255, 255, 0.6)',
            textAlign: 'center',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            fontFamily: "'Orbitron', monospace",
          }}>
            Make a wish for good in the world
          </p>

          {/* Not Connected State */}
          {!isWalletConnected && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '1.5rem', fontFamily: "'Orbitron', monospace" }}>
                Connect your wallet to toss a coin for charity
              </p>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <ConnectButton
                  client={client}
                  chain={chain}
                  wallets={donationWallets}
                  theme={donationWalletTheme}
                  connectButton={{
                    label: "Connect Wallet",
                    style: {
                      background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                      color: '#000',
                      fontFamily: "'Orbitron', monospace",
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      padding: '1rem 2rem',
                      borderRadius: '8px',
                      textTransform: 'uppercase',
                      letterSpacing: '2px',
                    }
                  }}
                  connectModal={{
                    size: "compact",
                    showThirdwebBranding: false,
                    title: "Connect to Donate",
                  }}
                />
              </div>
            </div>
          )}

          {/* Step: Select Charity */}
          {isWalletConnected && step === 'select' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <p style={{
                color: 'rgba(255, 255, 255, 0.8)',
                textAlign: 'center',
                fontSize: '0.8rem',
                marginBottom: '0.25rem',
              }}>
                Choose a charity to support:
              </p>

              {Object.entries(CHARITY_WALLETS).map(([key, charity]) => (
                <div
                  key={key}
                  className="charity-card"
                  onClick={() => handleCharitySelect(key)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{
                        color: '#FFD700',
                        fontSize: '0.95rem',
                        fontFamily: "'Orbitron', monospace",
                        marginBottom: '0.25rem',
                      }}>
                        {charity.shortName}
                      </h3>
                      <p style={{
                        color: 'rgba(255, 255, 255, 0.6)',
                        fontSize: '0.75rem',
                        fontStyle: 'italic',
                      }}>
                        {charity.description}
                      </p>
                    </div>
                  </div>
                  <a
                    href={charity.givingBlockUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: 'block',
                      color: '#00f5d4',
                      fontSize: '0.65rem',
                      marginTop: '0.75rem',
                      textDecoration: 'underline',
                    }}
                  >
                    Learn more at The Giving Block →
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Step: Enter Amount */}
          {isWalletConnected && step === 'amount' && charity && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button className="back-btn" onClick={() => setStep('select')}>
                ← Back
              </button>

              <div style={{ textAlign: 'center' }}>
                <h3 style={{
                  color: '#FFD700',
                  fontFamily: "'Orbitron', monospace",
                  marginTop: '0.5rem',
                  fontSize: '1.1rem',
                }}>
                  {charity.shortName}
                </h3>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '0.75rem',
                  marginBottom: '0.5rem',
                  fontFamily: "'Orbitron', monospace",
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}>
                  Amount (RL80 Tokens)
                </label>
                <input
                  type="number"
                  className="amount-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  min="1"
                  step="1"
                />
                <p style={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '0.7rem',
                  marginTop: '0.5rem',
                  textAlign: 'right',
                }}>
                  Available: {tokenBalance || '0'} RL80
                </p>
              </div>

              {error && (
                <p style={{ color: '#ff6b6b', fontSize: '0.85rem', textAlign: 'center' }}>
                  {error}
                </p>
              )}

              <button
                className="donate-btn"
                onClick={handleAmountSubmit}
                disabled={!amount || parseFloat(amount) <= 0}
              >
                Continue
              </button>
            </div>
          )}

          {/* Step: Confirm */}
          {isWalletConnected && step === 'confirm' && charity && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button className="back-btn" onClick={() => setStep('amount')}>
                ← Back
              </button>

              <div style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                borderRadius: '12px',
                padding: '1rem',
              }}>
                <h3 style={{
                  color: '#FFD700',
                  fontFamily: "'Orbitron', monospace",
                  fontSize: '0.9rem',
                  marginBottom: '1rem',
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}>
                  Confirm Your Donation
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>Charity:</span>
                    <span style={{ color: '#fff', fontSize: '0.85rem' }}>{charity.shortName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>Amount:</span>
                    <span style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '0.85rem' }}>{amount} RL80</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>To:</span>
                    <span style={{ color: '#00f5d4', fontSize: '0.75rem' }}>
                      {charity.address.slice(0, 6)}...{charity.address.slice(-4)}
                    </span>
                  </div>
                </div>
              </div>

              <p style={{
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '0.7rem',
                textAlign: 'center',
                lineHeight: 1.5,
              }}>
                Tokens are collected and converted to ETH when the pool reaches ~$500,
                then donated via The Giving Block.
              </p>

              <button
                className="donate-btn"
                onClick={handleDonate}
                disabled={isTransactionPending}
              >
                {isTransactionPending ? 'Processing...' : 'Toss Coin'}
              </button>
            </div>
          )}

          {/* Step: Processing - minimal UI, user sees wallet popup */}
          {step === 'processing' && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <p style={{
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '0.9rem',
              }}>
                Confirm in your wallet...
              </p>
            </div>
          )}

          {/* Step: Success */}
          {step === 'success' && charity && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <h3 style={{
                color: '#00f5d4',
                fontFamily: "'Orbitron', monospace",
                fontSize: '1.2rem',
                marginBottom: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}>
                Thank You!
              </h3>
              <p style={{
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '0.85rem',
                marginBottom: '1rem',
              }}>
                Your donation of <span style={{ color: '#FFD700' }}>{amount} RL80</span> to {charity.shortName} has been sent.
              </p>

              {txHash && (
                <a
                  href={`https://sepolia.basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    color: '#00f5d4',
                    fontSize: '0.75rem',
                    marginBottom: '1rem',
                    textDecoration: 'underline',
                  }}
                >
                  View transaction →
                </a>
              )}

              <button
                className="donate-btn"
                onClick={handleWatchCoin}
                style={{ marginTop: '0.5rem' }}
              >
                Aim & Toss Your Coin!
              </button>
            </div>
          )}

          {/* Step: Error */}
          {step === 'error' && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <h3 style={{
                color: '#ff6b6b',
                fontFamily: "'Orbitron', monospace",
                fontSize: '1.1rem',
                marginBottom: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}>
                Something went wrong
              </h3>
              <p style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '0.85rem',
                marginBottom: '1.5rem',
              }}>
                {error || 'Transaction failed. Please try again.'}
              </p>

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button className="back-btn" onClick={() => setStep('confirm')}>
                  Try Again
                </button>
                <button className="back-btn" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Footer - Transparency Info */}
          {isWalletConnected && ['select', 'amount', 'confirm'].includes(step) && (
            <div style={{
              marginTop: '1.5rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              <p style={{
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '0.65rem',
                textAlign: 'center',
                lineHeight: 1.5,
              }}>
                100% of donations go to charity. Tokens are batched and converted
                when pool reaches ~$500. All transactions are publicly verifiable on-chain.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default FountainDonationModal;
