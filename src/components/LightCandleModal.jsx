'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useWalletAuth } from './WalletAuthProvider';
import { db, collection, addDoc, serverTimestamp } from '@/lib/firebaseClient';

const LightCandleModal = ({ isOpen, onClose, onLightCandle }) => {
  const { user } = useUser();
  const { walletAddress, tokenBalance } = useWalletAuth();
  
  const [offeringType, setOfferingType] = useState('petition');
  const [message, setMessage] = useState('');
  const [tokenAmount, setTokenAmount] = useState(100);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setOfferingType('petition');
      setMessage('');
      setTokenAmount(100);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!message.trim()) {
      alert('Please enter a message for your candle');
      return;
    }

    setIsSubmitting(true);

    try {
      const newOffering = {
        name: user?.firstName || user?.username || 'Anonymous',
        type: offeringType,
        message: message.trim(),
        tokensBurned: tokenAmount,
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
      icon: '🖤', 
      color: '#aa66ff', 
      label: 'CONFESSION',
      description: 'Share what weighs on your heart'
    },
    appreciation: { 
      icon: '✨', 
      color: '#00ff66', 
      label: 'APPRECIATION',
      description: 'Express gratitude and thanks'
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
          z-index: 50;
          animation: fadeIn 0.3s ease-out;
        }

        .modal-content {
          background: linear-gradient(135deg, #1a0525 0%, #2a0a3a 100%);
          border: 2px solid rgba(255, 0, 255, 0.3);
          border-radius: 20px;
          padding: 2rem;
          width: 90%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
          position: relative;
          animation: fadeIn 0.4s ease-out;
        }

        .close-button {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: none;
          border: none;
          color: #fff;
          font-size: 1.5rem;
          cursor: pointer;
          opacity: 0.7;
          transition: opacity 0.2s;
        }

        .close-button:hover {
          opacity: 1;
        }

        .modal-title {
          font-size: 2rem;
          font-weight: bold;
          color: #fff;
          text-align: center;
          margin-bottom: 1.5rem;
          font-family: 'Orbitron', monospace;
          text-shadow: 0 0 20px rgba(255, 0, 255, 0.5);
        }

        .offering-types {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .offering-type-button {
          flex: 1;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid transparent;
          border-radius: 10px;
          color: #fff;
          cursor: pointer;
          transition: all 0.3s;
          text-align: center;
        }

        .offering-type-button:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .offering-type-button.selected {
          background: rgba(255, 255, 255, 0.15);
          animation: glow 2s ease-in-out infinite;
        }

        .type-icon {
          font-size: 1.5rem;
          display: block;
          margin-bottom: 0.25rem;
        }

        .type-label {
          font-size: 0.75rem;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .type-description {
          font-size: 0.6rem;
          opacity: 0.7;
          margin-top: 0.25rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-label {
          display: block;
          color: #fff;
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          opacity: 0.8;
        }

        .message-textarea {
          width: 100%;
          min-height: 120px;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          color: #fff;
          font-size: 1rem;
          resize: vertical;
          transition: all 0.3s;
        }

        .message-textarea:focus {
          outline: none;
          border-color: rgba(255, 0, 255, 0.5);
          background: rgba(255, 255, 255, 0.08);
        }

        .token-input {
          width: 100%;
          padding: 0.75rem;
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-radius: 10px;
          color: #fff;
          font-size: 1rem;
          transition: all 0.3s;
        }

        .token-input:focus {
          outline: none;
          border-color: rgba(255, 170, 0, 0.5);
          background: rgba(255, 255, 255, 0.08);
        }

        .token-balance {
          font-size: 0.75rem;
          color: #ffaa00;
          margin-top: 0.25rem;
        }

        .submit-button {
          width: 100%;
          padding: 1rem;
          background: linear-gradient(135deg, #ff006e 0%, #8338ec 100%);
          border: none;
          border-radius: 10px;
          color: #fff;
          font-size: 1rem;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 2px;
          cursor: pointer;
          transition: all 0.3s;
          position: relative;
          overflow: hidden;
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(255, 0, 110, 0.4);
        }

        .submit-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .candle-icon {
          display: inline-block;
          margin-right: 0.5rem;
        }
      `}</style>

      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="close-button" onClick={onClose}>✕</button>
          
          <h2 className="modal-title">🕯️ Light a Candle</h2>

          <form onSubmit={handleSubmit}>
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
                placeholder="Share your thoughts with Our Lady..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={280}
                required
              />
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
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
                max={tokenBalance || 10000}
                value={tokenAmount}
                onChange={(e) => setTokenAmount(parseInt(e.target.value) || 0)}
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
              disabled={isSubmitting || !message.trim()}
            >
              <span className="candle-icon">🕯️</span>
              {isSubmitting ? 'Lighting...' : 'Light Candle'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default LightCandleModal;