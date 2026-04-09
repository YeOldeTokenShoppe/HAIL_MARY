'use client';

import React, { useState } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

const CLAIM_CONTRACT_ADDRESS = '0x71e90d43a3f00b02d140d5c714422e8eb78459fa';

// Minimal ABI for the claim function (ERC20 drop/claim)
const claimAbi = [
  {
    inputs: [
      { name: '_receiver', type: 'address' },
      { name: '_quantity', type: 'uint256' },
      { name: '_currency', type: 'address' },
      { name: '_pricePerToken', type: 'uint256' },
      { name: '_allowlistProof', type: 'tuple', components: [
        { name: 'proof', type: 'bytes32[]' },
        { name: 'quantityLimitPerWallet', type: 'uint256' },
        { name: 'pricePerToken', type: 'uint256' },
        { name: 'currency', type: 'address' },
      ]},
      { name: '_data', type: 'bytes' },
    ],
    name: 'claim',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
];

const ClaimTokensModal = ({ isOpen, onClose, walletAddress }) => {
  const [claimError, setClaimError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { address: connectedAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();

  if (!isOpen) return null;

  const effectiveAddress = connectedAddress || walletAddress;

  const handleClaim = async () => {
    if (!effectiveAddress) return;

    setIsProcessing(true);
    setClaimError(null);

    try {
      const tx = await writeContractAsync({
        address: CLAIM_CONTRACT_ADDRESS,
        abi: claimAbi,
        functionName: 'claim',
        args: [
          effectiveAddress,
          BigInt(100) * BigInt(10 ** 18), // 100 tokens in wei
          '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // Native token (free claim)
          BigInt(0), // price per token (free)
          {
            proof: [],
            quantityLimitPerWallet: BigInt(0),
            pricePerToken: BigInt(0),
            currency: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
          },
          '0x', // empty data
        ],
      });

      setIsProcessing(false);
      setTimeout(() => {
        onClose();
        window.location.reload(); // Refresh to update balance
      }, 2000);
    } catch (error) {
      console.error('Claim error:', error);
      setIsProcessing(false);
      if (error.message?.includes('COOP') || error.message?.includes('Cross-Origin')) {
        setClaimError('Pop-up blocked. Please allow pop-ups for this site and try again.');
      } else if (error.message?.includes('user rejected') || error.message?.includes('denied')) {
        setClaimError('Transaction cancelled.');
      } else {
        setClaimError('Failed to claim tokens. Please try again.');
      }
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
          z-index: 6000;
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
          padding: 2.5rem;
          width: 90%;
          max-width: 450px;
          position: relative;
          animation: fadeIn 0.4s ease-out;
          box-shadow: 0 20px 60px rgba(139, 92, 246, 0.3);
          text-align: center;
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

        .modal-icon {
          font-size: 4rem;
          margin-bottom: 1.5rem;
          filter: drop-shadow(0 0 30px rgba(255, 215, 0, 0.5));
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            filter: drop-shadow(0 0 30px rgba(255, 215, 0, 0.5));
          }
          50% {
            transform: scale(1.05);
            filter: drop-shadow(0 0 40px rgba(255, 215, 0, 0.7));
          }
        }

        .modal-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: #fff;
          text-transform: uppercase;
          letter-spacing: 3px;
          margin-bottom: 1rem;
          font-family: 'Orbitron', monospace;
        }

        .modal-subtitle {
          color: #00f5d4;
          font-size: 1.1rem;
          margin-bottom: 1.5rem;
          line-height: 1.5;
        }

        .modal-description {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.9rem;
          margin-bottom: 2rem;
          line-height: 1.6;
        }

        .claim-button-wrapper {
          margin-bottom: 1.5rem;
        }

        .info-box {
          background: rgba(0, 245, 212, 0.05);
          border: 1px solid rgba(0, 245, 212, 0.2);
          border-radius: 12px;
          padding: 1rem;
          margin-top: 1.5rem;
        }

        .info-text {
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.75rem;
          line-height: 1.4;
        }

        .cancel-button {
          background: none;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.7);
          padding: 0.75rem 2rem;
          border-radius: 50px;
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.3s;
          margin-top: 1rem;
        }

        .cancel-button:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.3);
          color: white;
        }
      `}</style>

      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="close-button" onClick={onClose}>✕</button>

          <div className="modal-icon">🪙</div>

          <h2 className="modal-title">Claim Test Tokens</h2>

          <p className="modal-subtitle">
            Get 100 FREE RL80 tokens to light your candle!
          </p>

          <p className="modal-description">
            These test tokens allow you to participate in the shrine by lighting candles.
            Each claim gives you 100 RL80 tokens on Base.
          </p>

          <div className="claim-button-wrapper">
            {!effectiveAddress ? (
              <div style={{
                background: 'rgba(255, 100, 100, 0.1)',
                border: '1px solid rgba(255, 100, 100, 0.3)',
                borderRadius: '12px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <p style={{
                  color: '#ff6464',
                  fontSize: '0.9rem',
                  margin: 0
                }}>
                  Please connect your wallet first to claim tokens.
                </p>
              </div>
            ) : (
              <>
                {claimError && (
                  <div style={{
                    background: 'rgba(255, 100, 100, 0.1)',
                    border: '1px solid rgba(255, 100, 100, 0.3)',
                    borderRadius: '12px',
                    padding: '1rem',
                    marginBottom: '1rem'
                  }}>
                    <p style={{
                      color: '#ff6464',
                      fontSize: '0.85rem',
                      margin: 0
                    }}>
                      {claimError}
                    </p>
                  </div>
                )}
                <button
                  onClick={handleClaim}
                  disabled={isProcessing}
                  style={{
                    background: isProcessing ? 'rgba(139, 92, 246, 0.5)' : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                    border: 'none',
                    borderRadius: '50px',
                    padding: '1rem 2.5rem',
                    color: 'white',
                    fontSize: '1rem',
                    fontWeight: '700',
                    cursor: isProcessing ? 'wait' : 'pointer',
                    transition: 'all 0.3s',
                    width: '100%',
                    fontFamily: "'Orbitron', monospace",
                    letterSpacing: '1px',
                    textTransform: 'uppercase'
                  }}
                >
                  {isProcessing ? 'Processing...' : 'Claim 100 RL80 Tokens'}
                </button>
              </>
            )}
          </div>

          <div className="info-box">
            <p className="info-text">
              ℹ️ Make sure you're connected to Base network.
              The transaction will require a small amount of ETH for gas fees.
              <br /><br />
              ⚠️ If you see a popup blocker warning, please allow popups for this site to connect your wallet.
            </p>
          </div>

          <button className="cancel-button" onClick={onClose}>
            Maybe Later
          </button>
        </div>
      </div>
    </>
  );
};

export default ClaimTokensModal;
