'use client';

import React, { useState, useEffect } from 'react';
import { useWalletAuth } from './WalletAuthProvider';
import { CHARITY_WALLETS, DEV_WALLET, USDC_ADDRESS } from '@/lib/contracts';
import { useWriteContract, useSendTransaction, useBalance, useReadContract } from 'wagmi';
import { erc20Abi, parseEther, parseUnits, formatUnits } from 'viem';

const FountainDonationModal = ({ isOpen, onClose, onDonationComplete, preselectedCharity = null }) => {
  const [selectedCharity, setSelectedCharity] = useState(null);
  const [amount, setAmount] = useState('');
  // Optional public one-liner carried by the golden coin — shown in the
  // fountain's donation feed (server sanitizes + caps it).
  const [wish, setWish] = useState('');
  // Optional self-claimed donor name shown on the coin (server sanitizes +
  // caps it; NOT chain-verified, so it's always paired with the address).
  const [name, setName] = useState('');
  const [step, setStep] = useState('select'); // 'select', 'amount', 'confirm', 'processing', 'success', 'error'
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [pendingDonation, setPendingDonation] = useState(null); // Store donation info for coin toss

  const {
    walletAddress,
    tokenBalance,
    isWalletConnected,
    refreshBalance,
    connectWallet,
    connectors,
  } = useWalletAuth();

  const { writeContractAsync, isPending: isWritePending } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();

  // ALL fountain giving — charities and the dev tip alike — is
  // denominated in ETH or USDC (USDC default: donations are dollar
  // amounts). RL80 donations were retired 2026-06-11: pools holding the
  // project's own token needed a conversion step before forwarding and
  // invited "team wallet dumping" optics when they sold.
  const [payCurrency, setPayCurrency] = useState('USDC');
  const { data: ethBalance } = useBalance({
    address: walletAddress || undefined,
    chainId: 8453,
    query: { enabled: !!walletAddress },
  });
  const { data: usdcBalanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    chainId: 8453,
    query: { enabled: !!walletAddress },
  });
  const usdcBalance = typeof usdcBalanceRaw === 'bigint' ? usdcBalanceRaw : 0n;
  const payBalanceDisplay =
    payCurrency === 'ETH'
      ? Number(formatUnits(ethBalance?.value ?? 0n, 18)).toFixed(4)
      : Number(formatUnits(usdcBalance, 6)).toFixed(2);

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
      setWish('');
      setName('');
      setError(null);
      setTxHash(null);
      setPendingDonation(null);

      // If charity is preselected from toggle, skip to amount step
      // ('DEV' = the coffee tip pseudo-charity from the fountain toggle)
      if (
        preselectedCharity &&
        (preselectedCharity === 'DEV' || CHARITY_WALLETS[preselectedCharity])
      ) {
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
    // Compare in base units to dodge float precision (USDC is 6
    // decimals, not 18).
    try {
      const units =
        payCurrency === 'ETH' ? parseEther(amount) : parseUnits(amount, 6);
      const bal =
        payCurrency === 'ETH' ? (ethBalance?.value ?? 0n) : usdcBalance;
      if (units > bal) {
        setError(`Insufficient ${payCurrency} balance`);
        return;
      }
    } catch {
      setError('Please enter a valid amount');
      return;
    }
    setError(null);
    setStep('confirm');
  };

  const handleDonate = async () => {
    if (!walletAddress || !selectedCharity || !amount) return;

    setStep('processing');
    setError(null);
    setIsTransactionPending(true);

    try {
      const isDev = selectedCharity === 'DEV';
      const charity = isDev ? DEV_WALLET : CHARITY_WALLETS[selectedCharity];

      // One payment path for every recipient: direct ETH send or USDC
      // transfer (6 decimals). Recipients differ, mechanics don't.
      let txHashValue;
      if (payCurrency === 'ETH') {
        txHashValue = await sendTransactionAsync({
          to: charity.address,
          value: parseEther(amount),
          chainId: 8453,
        });
      } else {
        const units = parseUnits(amount, 6);
        txHashValue = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [charity.address, units],
          chainId: 8453,
        });
      }
      setTxHash(txHashValue);

      // Log via the server route: it waits for the receipt, verifies
      // donor/recipient/amount on-chain, computes the dollar value, and
      // writes fountain_donations with the admin SDK (the collection is
      // write:false to clients). Fire-and-forget — the donation itself
      // already succeeded, and the feed toast arrives via the fountain's
      // snapshot listener once the server confirms. Idempotent per tx
      // hash, so even a duplicate POST can't double-count.
      const trimmedWish = wish.trim().slice(0, 80);
      const trimmedName = name.trim().slice(0, 24);
      fetch('/api/fountain-donation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txHash: txHashValue,
          ...(trimmedWish ? { wish: trimmedWish } : {}),
          ...(trimmedName ? { donorName: trimmedName } : {}),
        }),
        keepalive: true,
      }).catch((logError) => {
        console.error('Error logging donation:', logError);
      });

      // Refresh balance
      await refreshBalance();

      // Everything the fountain needs to arm the golden coin in hand
      // (tossed by the user's next water tap).
      setPendingDonation({
        charity: selectedCharity,
        amount,
        currency: payCurrency,
        wish: trimmedWish || null,
        donorName: trimmedName || null,
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

  const isDevTip = selectedCharity === 'DEV';
  const charity = selectedCharity
    ? isDevTip
      ? DEV_WALLET
      : CHARITY_WALLETS[selectedCharity]
    : null;
  const displayCurrency = payCurrency;

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
            for
          </p>

          {/* Not Connected State */}
          {!isWalletConnected && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <p style={{ color: 'rgba(255, 255, 255, 0.8)', marginBottom: '1.5rem', fontFamily: "'Orbitron', monospace" }}>
                Connect your wallet to toss a coin for charity
              </p>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button
                  onClick={() => connectWallet()}
                  style={{
                    background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                    color: '#000',
                    fontFamily: "'Orbitron', monospace",
                    fontWeight: 'bold',
                    fontSize: '1rem',
                    padding: '1rem 2rem',
                    borderRadius: '8px',
                    textTransform: 'uppercase',
                    letterSpacing: '2px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                  }}
                >
                  Connect Wallet
                </button>
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

              {/* Dev tip jar — deliberately styled as the humble last
                  option below the charities, and denominated in
                  ETH/USDC rather than RL80 (see DEV_WALLET). */}
              <p style={{
                color: 'rgba(255, 255, 255, 0.4)',
                textAlign: 'center',
                fontSize: '0.7rem',
                margin: '0.25rem 0',
              }}>
                — or —
              </p>
              <div
                className="charity-card"
                onClick={() => handleCharitySelect('DEV')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{
                      color: '#FFD700',
                      fontSize: '0.95rem',
                      fontFamily: "'Orbitron', monospace",
                      marginBottom: '0.25rem',
                    }}>
                      {DEV_WALLET.icon} {DEV_WALLET.shortName}
                    </h3>
                    <p style={{
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontSize: '0.75rem',
                      fontStyle: 'italic',
                    }}>
                      {DEV_WALLET.description}
                    </p>
                  </div>
                </div>
                <a
                  href={`https://basescan.org/address/${DEV_WALLET.address}`}
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
                  {DEV_WALLET.ens} · verify on BaseScan →
                </a>
              </div>
            </div>
          )}

          {/* Step: Enter Amount */}
          {isWalletConnected && step === 'amount' && charity && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* <button className="back-btn" onClick={() => setStep('select')}>
                ← Back
              </button> */}

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

              {/* Everything is given in USDC or ETH — charities and dev
                  tips alike */}
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                {['USDC', 'ETH'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="back-btn"
                    onClick={() => {
                      setPayCurrency(c);
                      setAmount('');
                      setError(null);
                    }}
                    style={
                      payCurrency === c
                        ? { borderColor: '#FFD700', color: '#FFD700' }
                        : undefined
                    }
                  >
                    {c}
                  </button>
                ))}
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
                  Amount ({payCurrency})
                </label>
                <input
                  type="number"
                  className="amount-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="any"
                />
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  justifyContent: 'center',
                  marginTop: '0.5rem',
                }}>
                  {/* Coffee-sized presets for the dev, a bit more generous
                      for the charities */}
                  {(payCurrency === 'USDC'
                    ? isDevTip
                      ? ['2', '5', '10']
                      : ['5', '10', '25']
                    : isDevTip
                      ? ['0.001', '0.002', '0.005']
                      : ['0.002', '0.005', '0.01']
                  ).map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="back-btn"
                      onClick={() => setAmount(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <p style={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '0.7rem',
                  marginTop: '0.5rem',
                  textAlign: 'right',
                }}>
                  Available: {payBalanceDisplay} {payCurrency}
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
                    <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>{isDevTip ? 'Recipient:' : 'Charity:'}</span>
                    <span style={{ color: '#fff', fontSize: '0.85rem' }}>{charity.shortName}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>Amount:</span>
                    <span style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '0.85rem' }}>{amount} {displayCurrency}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.85rem' }}>To:</span>
                    <span style={{ color: '#00f5d4', fontSize: '0.75rem' }}>
                      {isDevTip
                        ? `${charity.ens} (${charity.address.slice(0, 6)}...${charity.address.slice(-4)})`
                        : `${charity.address.slice(0, 6)}...${charity.address.slice(-4)}`}
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
                {isDevTip
                  ? 'Goes directly to the dev’s wallet. A voluntary tip — no perks, no promises, just thanks. ☕'
                  : 'Donations pool in the charity wallet and are forwarded via The Giving Block once the pool reaches ~100 USDC in value (or the ETH equivalent).'}
              </p>

              <div style={{ marginBottom: '0.9rem' }}>
                <label style={{
                  display: 'block',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '0.7rem',
                  marginBottom: '0.4rem',
                  fontFamily: "'Orbitron', monospace",
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}>
                  Your name <span style={{ opacity: 0.6, textTransform: 'none' }}>(optional · shown on your coin)</span>
                </label>
                <input
                  type="text"
                  className="amount-input"
                  style={{ textAlign: 'left', fontSize: '0.8rem' }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                  placeholder="how you'd like to be credited…"
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '0.7rem',
                  marginBottom: '0.4rem',
                  fontFamily: "'Orbitron', monospace",
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}>
                  Attach a wish <span style={{ opacity: 0.6, textTransform: 'none' }}>(optional · shown publicly)</span>
                </label>
                <input
                  type="text"
                  className="amount-input"
                  style={{ textAlign: 'left', fontSize: '0.8rem' }}
                  value={wish}
                  onChange={(e) => setWish(e.target.value)}
                  maxLength={80}
                  placeholder="carried into the fountain by your golden coin…"
                />
              </div>

              <button
                className="donate-btn"
                onClick={handleDonate}
                disabled={isTransactionPending}
              >
                {isTransactionPending ? 'Processing...' : 'Mint Your Golden Coin'}
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
                {isDevTip ? (
                  <>Your <span style={{ color: '#FFD700' }}>{amount} {payCurrency}</span> coffee is on its way to the dev. ☕</>
                ) : (
                  <>Your donation of <span style={{ color: '#FFD700' }}>{amount} {payCurrency}</span> to {charity.shortName} has been sent.</>
                )}
                {' '}A golden coin is waiting in your hand — tap the water to toss it in.
              </p>

              {txHash && (
                <a
                  href={`https://basescan.org/tx/${txHash}`}
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
                🥇 Take Your Golden Coin
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
                100% of charity donations go to charity (pooled, then forwarded
                via The Giving Block at ~100 USDC in value, or the ETH
                equivalent). Dev tips go straight to rl80.eth.
                All transactions are publicly verifiable on-chain.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default FountainDonationModal;
