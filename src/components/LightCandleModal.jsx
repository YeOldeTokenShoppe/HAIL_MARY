'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useWalletAuth } from './WalletAuthProvider';
import { db, collection, addDoc, serverTimestamp } from '@/lib/firebaseClient';
import ThirdwebBuyModal from './ThirdwebBuyModal';

const LightCandleModal = ({ isOpen, onClose, onLightCandle }) => {
  const { user } = useUser();
  const { walletAddress, tokenBalance } = useWalletAuth();
  
  const [offeringType, setOfferingType] = useState('petition');
  const [message, setMessage] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showNoBuyPrompt, setShowNoBuyPrompt] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setOfferingType('petition');
      setMessage('');
      setTokenAmount('');
      setIsSubmitting(false);
      // Check token balance immediately when modal opens
      // tokenBalance is a string from the provider, so convert to number
      const balance = parseInt(tokenBalance) || 0;
      if (walletAddress && balance === 0) {
        setShowNoBuyPrompt(true);
      } else {
        setShowNoBuyPrompt(false);
      }
    }
  }, [isOpen, walletAddress, tokenBalance]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!message.trim()) {
      alert('Please enter a message for your candle');
      return;
    }

    const amount = parseInt(tokenAmount) || 0;
    if (amount < 1) {
      alert('Minimum 1 RL80 token required to light a candle');
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

    setIsSubmitting(true);

    try {
      const newOffering = {
        name: user?.firstName || user?.username || 'Anonymous',
        type: offeringType,
        message: message.trim(),
        tokensBurned: parseInt(tokenAmount) || 0,
        userId: user?.id,
        walletAddress: walletAddress,
        userImageUrl: user?.imageUrl || null,
        createdAt: serverTimestamp(),
        timestamp: new Date().toISOString() // For immediate display
      };

      // Save to Firestore
      try {
        const docRef = await addDoc(collection(db, 'offerings'), newOffering);
        console.log('Offering saved to Firestore with ID:', docRef.id);
        
        // Add the Firestore ID to the offering
        newOffering.id = docRef.id;
        newOffering.timestamp = 'just now'; // For display
      } catch (firestoreError) {
        console.error('Error saving to Firestore:', firestoreError);
        // Continue anyway - don't block the user from lighting candle
      }

      // Call the parent's light candle handler
      await onLightCandle(newOffering);
      
      // Close modal after successful submission
      onClose();
    } catch (error) {
      console.error('Error lighting candle:', error);
      alert('Failed to light candle. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const offeringTypes = {
    petition: { 
      icon: '🙏', 
      color: '#ffaa00', 
      label: 'PETITION',
      description: 'Ask for guidance or help'
    },
    confession: { 
      icon: '❤️‍🔥', 
      color: '#aa66ff', 
      label: 'CONFESSION',
      description: 'Share what weighs on your heart'
    },
    appreciation: { 
      icon: '✨', 
      color: '#00ff66', 
      label: 'THANKS',
      description: 'Express gratitude'
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
                           linear-gradient(90deg, #8b5cf6, #ec4899);
          background-origin: border-box;
          background-clip: padding-box, border-box;
          border-radius: 20px;
          padding: 2rem;
          width: 90%;
          max-width: 500px;
          height: auto;
          max-height: 85vh;
          overflow: hidden;
          position: relative;
          animation: fadeIn 0.4s ease-out;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(139, 92, 246, 0.3);
        }

        .close-button {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: none;
          border: none;
          color: #ec4899;
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
          color: #f472b6;
        }

        .modal-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: #fff;
          text-align: center;
          margin-bottom: 1.5rem;
          font-family: 'Orbitron', monospace;
        }

        .offering-types {
          display: flex;
          gap: 0.4rem;
          margin-bottom: 1.5rem;
          justify-content: center;
        }

        .offering-type-button {
          flex: 1;
          padding: 0.5rem 0.3rem;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.3s;
          text-align: center;
          min-width: 0;
        }

        .offering-type-button:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .offering-type-button.selected {
          background: rgba(139, 92, 246, 0.1);
          border-color: #8b5cf6;
          color: #fff;
        }

        .type-icon {
          font-size: 1.25rem;
          display: block;
          margin-bottom: 0.3rem;
        }

        .type-label {
          font-size: 0.65rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          word-break: break-word;
        }

        .type-description {
          font-size: 0.5rem;
          opacity: 0.7;
          margin-top: 0.2rem;
          line-height: 1.2;
          padding: 0 0.2rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
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

        .message-textarea {
          width: 100%;
          height: 80px;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #fff;
          font-size: 0.9rem;
          resize: none;
          transition: all 0.3s;
        }

        .message-textarea:focus {
          outline: none;
          border-color: #8b5cf6;
          background: rgba(139, 92, 246, 0.05);
        }

        .token-input {
          width: 100%;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: #fff;
          font-size: 0.9rem;
          transition: all 0.3s;
        }

        .token-input:focus {
          outline: none;
          border-color: #8b5cf6;
          background: rgba(139, 92, 246, 0.05);
        }

        .token-balance {
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 0.5rem;
        }

        .buy-prompt-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.95);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          border-radius: 20px;
        }

        .buy-prompt-card {
          background: rgba(30, 30, 40, 0.98);
          border: 2px solid #8b5cf6;
          border-radius: 16px;
          padding: 2rem;
          max-width: 400px;
          width: 90%;
          text-align: center;
        }

        .buy-prompt-title {
          color: #fff;
          font-size: 1.25rem;
          margin-bottom: 1rem;
          font-weight: 600;
        }

        .buy-prompt-text {
          color: rgba(255, 255, 255, 0.8);
          margin-bottom: 1.5rem;
          line-height: 1.5;
        }

        .buy-prompt-buttons {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .buy-prompt-button {
          padding: 0.75rem 1.5rem;
          border-radius: 50px;
          border: none;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }

        .buy-prompt-button.primary {
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          color: white;
        }

        .buy-prompt-button.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(139, 92, 246, 0.3);
        }

        .buy-prompt-button.secondary {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .buy-prompt-button.secondary:hover {
          background: rgba(255, 255, 255, 0.15);
          color: white;
        }

        .submit-button {
          width: 100%;
          padding: 0.875rem;
          background: #fff;
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
          box-shadow: 0 10px 30px rgba(255, 255, 255, 0.2);
          background: #f0f0f0;
        }

        .submit-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

      `}</style>

      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="close-button" onClick={onClose}>✕</button>
          
          <h2 className="modal-title">Light a Candle</h2>

          {/* Buy RL80 Prompt Overlay */}
          {showNoBuyPrompt && (
            <div className="buy-prompt-overlay">
              <div className="buy-prompt-card">
                <h3 className="buy-prompt-title">No RL80 Tokens Detected</h3>
                <p className="buy-prompt-text">
                  You need RL80 tokens to light a candle. Would you like to purchase some RL80 tokens now?
                </p>
                <div className="buy-prompt-buttons">
                  <button 
                    className="buy-prompt-button primary"
                    onClick={() => {
                      setShowNoBuyPrompt(false);
                      setShowBuyModal(true);
                    }}
                  >
                    Buy RL80
                  </button>
                  <button 
                    className="buy-prompt-button secondary"
                    onClick={() => {
                      setShowNoBuyPrompt(false);
                      onClose(); // Close the entire LightCandleModal
                    }}
                  >
                    Maybe Later
                  </button>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* Offering Type Selection */}
            <div className="offering-types">
              {Object.entries(offeringTypes).map(([type, config]) => (
                <button
                  key={type}
                  type="button"
                  className={`offering-type-button ${offeringType === type ? 'selected' : ''}`}
                  style={{
                    borderColor: offeringType === type ? config.color : 'transparent',
                    color: offeringType === type ? config.color : '#fff'
                  }}
                  onClick={() => setOfferingType(type)}
                >
                  <span className="type-icon">{config.icon}</span>
                  <span className="type-label">{config.label}</span>
                  <div className="type-description">{config.description}</div>
                </button>
              ))}
            </div>

            {/* Message Input */}
            <div className="form-group">
              <label className="form-label" htmlFor="message">
                Your Message
              </label>
              <textarea
                id="message"
                className="message-textarea"
                placeholder=""
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={280}
                required
              />
              <div style={{ textAlign: 'right', fontSize: '0.6rem', color: '#666', marginTop: '0.1rem' }}>
                {message.length}/280
              </div>
            </div>

            {/* Token Amount */}
            <div className="form-group">
              <label className="form-label" htmlFor="tokens">
                RL80 Tokens to Burn
              </label>
              <input
                id="tokens"
                type="number"
                className="token-input"
                min="1"
                max={parseInt(tokenBalance) > 0 ? parseInt(tokenBalance) : 10000}
                value={tokenAmount}
                onChange={(e) => setTokenAmount(e.target.value)}
                placeholder="1 RL80 minimum"
                required
              />
              {tokenBalance !== null && tokenBalance !== undefined ? (
                <div className="token-balance">
                  Balance: {tokenBalance.toLocaleString()} RL80
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

            {/* Submit Button */}
            <button
              type="submit"
              className="submit-button"
              disabled={isSubmitting || !message.trim() || !tokenAmount || parseInt(tokenAmount) < 1}
            >
              {isSubmitting ? 'Lighting...' : 'Light Candle'}
            </button>
          </form>
        </div>
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
              // User didn't complete purchase, close the LightCandleModal
              onClose();
            }
          }} 
        />
      )}
    </>
  );
};

export default LightCandleModal;