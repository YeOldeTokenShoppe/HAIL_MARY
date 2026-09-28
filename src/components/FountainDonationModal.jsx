'use client';

import React, { useState, useEffect } from 'react';
import { useWalletAuth } from './WalletAuthProvider';
import { DEV_WALLET, USDC_ADDRESS } from '@/lib/contracts';

// The fountain gives to ONE recipient: the site wallet (rl80.eth). The
// charity options were retired 2026-09-27. 'DEV' is the recipient key the
// API route writes to fountain_donations and the fountain iframe renders.
const RECIPIENT_KEY = 'DEV';
const recipient = DEV_WALLET;
import { useWriteContract, useSendTransaction, useBalance, useReadContract } from 'wagmi';
import { erc20Abi, parseEther, parseUnits, formatUnits } from 'viem';

const FountainDonationModal = ({ isOpen, onClose, onDonationComplete }) => {
  const [amount, setAmount] = useState('');
  // Optional public one-liner carried by the golden coin — shown in the
  // fountain's donation feed (server sanitizes + caps it).
  const [wish, setWish] = useState('');
  // Optional self-claimed donor name shown on the coin (server sanitizes +
  // caps it; NOT chain-verified, so it's always paired with the address).
  const [name, setName] = useState('');
  const [step, setStep] = useState('amount'); // 'amount', 'confirm', 'processing', 'success', 'error'
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

  // Fountain support is denominated in ETH or USDC (USDC default:
  // donations are dollar amounts). RL80 donations were retired 2026-06-11: pools holding the
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
      setStep('amount'); // single recipient — no select step
    }
  }, [isOpen]);

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
    if (!walletAddress || !amount) return;

    setStep('processing');
    setError(null);
    setIsTransactionPending(true);

    try {
      // Direct ETH send or USDC transfer (6 decimals) to the site wallet.
      let txHashValue;
      if (payCurrency === 'ETH') {
        txHashValue = await sendTransactionAsync({
          to: recipient.address,
          value: parseEther(amount),
          chainId: 8453,
        });
      } else {
        const units = parseUnits(amount, 6);
        txHashValue = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [recipient.address, units],
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
        charity: RECIPIENT_KEY,
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

  const displayCurrency = payCurrency;

  const presets = payCurrency === 'USDC' ? ['2', '5', '10'] : ['0.001', '0.002', '0.005'];
  const shortAddr = `${recipient.address.slice(0, 6)}…${recipient.address.slice(-4)}`;

  return (
    <>
      <style jsx>{`
        /* Same visual system as the fountain's Coin Guide panel: twilight-plum
           glass, gold rim, lemon-gold accents, neon magenta/violet glow. The
           title is the site's blackletter (Grenze Gotisch, loaded in layout.js);
           everything else is the Coin Guide's system sans. */
        .fdm-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          background: radial-gradient(120% 120% at 50% 40%, rgba(40, 18, 52, 0.55) 0%, rgba(20, 8, 28, 0.78) 100%);
          backdrop-filter: blur(10px) saturate(120%);
          -webkit-backdrop-filter: blur(10px) saturate(120%);
        }
        .fdm-card {
          position: relative;
          width: 100%;
          max-width: 400px;
          max-height: calc(100vh - 32px);
          overflow-y: auto;
          padding: 26px 24px 22px;
          box-sizing: border-box;
          color: rgba(255, 255, 255, 0.92);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          font-size: 14px;
          line-height: 1.4;
          text-align: left;
          background: linear-gradient(155deg, rgba(34, 20, 52, 0.94) 0%, rgba(52, 20, 58, 0.94) 52%, rgba(44, 16, 40, 0.95) 100%);
          border: 1.5px solid rgba(212, 175, 55, 0.6);
          border-radius: 18px;
          box-shadow: 0 16px 44px rgba(0, 0, 0, 0.5), 0 0 46px rgba(224, 64, 158, 0.26), 0 0 90px rgba(130, 60, 210, 0.16);
        }
        .fdm-card p { text-align: inherit; margin: 0; }
        .fdm-close {
          position: absolute;
          top: 10px;
          right: 10px;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(0, 0, 0, 0.25);
          color: rgba(255, 255, 255, 0.8);
          font-size: 15px;
          line-height: 1;
          cursor: pointer;
        }
        .fdm-close:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }
        .fdm-title {
          margin: 0;
          color: #ffe93d;
          font-family: 'Grenze Gotisch', 'UnifrakturMaguntia', Georgia, serif;
          font-weight: 600;
          font-size: 40px;
          line-height: 1;
          text-align: center;
          text-shadow: 0 2px 10px rgba(42, 25, 91, 0.6), 0 0 22px rgba(255, 233, 61, 0.25);
        }
        .fdm-card .fdm-sub {
          margin: 8px 0 0;
          color: rgba(255, 255, 255, 0.7);
          font-size: 13px;
          text-align: center;
        }
        .fdm-section { margin-top: 18px; }
        .fdm-recipient {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .fdm-recipient-icon { font-size: 22px; line-height: 1; }
        .fdm-recipient-name { color: #ffe93d; font-weight: 800; font-size: 14px; line-height: 1.15; }
        .fdm-recipient-desc { color: rgba(255, 255, 255, 0.68); font-size: 12px; margin-top: 2px; }
        .fdm-label {
          display: block;
          margin: 0 0 6px;
          color: rgba(255, 255, 255, 0.8);
          font-size: 12px;
          font-weight: 700;
        }
        .fdm-label small { font-weight: 500; color: rgba(255, 255, 255, 0.55); }
        /* The amount field is the one big element: a wide gold-rimmed well with
           the currency choice living inside it. */
        .fdm-amount {
          display: flex;
          align-items: stretch;
          border-radius: 14px;
          border: 1.5px solid rgba(212, 175, 55, 0.45);
          background: rgba(0, 0, 0, 0.28);
          overflow: hidden;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .fdm-amount:focus-within {
          border-color: #ffe93d;
          box-shadow: 0 0 0 3px rgba(255, 233, 61, 0.18);
        }
        .fdm-amount input {
          flex: 1;
          min-width: 0;
          padding: 12px 14px;
          border: 0;
          background: transparent;
          color: #fff;
          font: inherit;
          font-size: 30px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          outline: none;
          -moz-appearance: textfield;
        }
        .fdm-amount input::-webkit-outer-spin-button,
        .fdm-amount input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .fdm-amount input::placeholder { color: rgba(255, 255, 255, 0.28); }
        .fdm-currency {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 4px;
          padding: 6px;
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
        }
        .fdm-currency button {
          padding: 5px 10px;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          color: rgba(255, 255, 255, 0.55);
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
        }
        .fdm-currency button[aria-pressed='true'] {
          color: #3a2c00;
          background: linear-gradient(135deg, #ffd700, #ffb700);
        }
        .fdm-presets { display: flex; gap: 8px; margin-top: 10px; }
        .fdm-chip {
          flex: 1;
          padding: 8px 0;
          border-radius: 999px;
          border: 1px solid rgba(212, 175, 55, 0.45);
          background: rgba(255, 215, 0, 0.06);
          color: #ffe93d;
          font: inherit;
          font-size: 13px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          cursor: pointer;
        }
        .fdm-chip:hover, .fdm-chip[aria-pressed='true'] { background: rgba(255, 215, 0, 0.16); border-color: #ffe93d; }
        .fdm-balance {
          margin-top: 8px;
          color: rgba(255, 255, 255, 0.55);
          font-size: 12px;
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .fdm-input {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(0, 0, 0, 0.25);
          color: #fff;
          font: inherit;
          font-size: 14px;
          outline: none;
        }
        .fdm-input:focus { border-color: #ffe93d; box-shadow: 0 0 0 3px rgba(255, 233, 61, 0.15); }
        .fdm-input::placeholder { color: rgba(255, 255, 255, 0.35); }
        .fdm-error {
          margin-top: 12px;
          padding: 9px 12px;
          border-radius: 10px;
          background: rgba(255, 96, 96, 0.12);
          border: 1px solid rgba(255, 138, 128, 0.4);
          color: #ffb3ab;
          font-size: 13px;
        }
        .fdm-primary {
          display: block;
          width: 100%;
          margin-top: 18px;
          padding: 13px 16px;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, #ffd700, #ffb700);
          color: #3a2c00;
          font: inherit;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.2px;
          cursor: pointer;
          box-shadow: 0 6px 18px rgba(255, 183, 0, 0.25);
          transition: transform 0.12s, box-shadow 0.12s, filter 0.12s;
        }
        .fdm-primary:hover:not(:disabled) { filter: brightness(1.05); box-shadow: 0 8px 24px rgba(255, 183, 0, 0.35); }
        .fdm-primary:active:not(:disabled) { transform: translateY(1px); }
        .fdm-primary:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
        .fdm-primary:focus-visible, .fdm-chip:focus-visible, .fdm-close:focus-visible,
        .fdm-ghost:focus-visible, .fdm-currency button:focus-visible {
          outline: 2px solid #ffe93d;
          outline-offset: 2px;
        }
        .fdm-ghost {
          padding: 9px 16px;
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: transparent;
          color: rgba(255, 255, 255, 0.85);
          font: inherit;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .fdm-ghost:hover { border-color: rgba(255, 255, 255, 0.5); color: #fff; }
        .fdm-back {
          display: inline-block;
          margin-bottom: 4px;
          padding: 0;
          border: 0;
          background: none;
          color: rgba(255, 255, 255, 0.6);
          font: inherit;
          font-size: 13px;
          cursor: pointer;
        }
        .fdm-back:hover { color: #ffe93d; }
        .fdm-summary {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 8px 16px;
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 13px;
        }
        .fdm-summary dt { color: rgba(255, 255, 255, 0.6); margin: 0; }
        .fdm-summary dd { margin: 0; text-align: right; color: #fff; overflow-wrap: anywhere; }
        .fdm-summary dd.gold { color: #ffe93d; font-weight: 800; font-variant-numeric: tabular-nums; }
        .fdm-summary dd.addr { font-family: ui-monospace, Menlo, monospace; font-size: 12px; color: rgba(255, 255, 255, 0.8); }
        .fdm-note { margin-top: 12px; color: rgba(255, 255, 255, 0.62); font-size: 12px; }
        .fdm-center { text-align: center; }
        .fdm-center p { text-align: center; }
        .fdm-heading {
          margin: 0 0 8px;
          color: #ffe93d;
          font-family: 'Grenze Gotisch', 'UnifrakturMaguntia', Georgia, serif;
          font-weight: 600;
          font-size: 28px;
          line-height: 1.05;
          text-align: center;
        }
        .fdm-link { color: #ffe93d; font-weight: 700; text-decoration: underline; text-underline-offset: 3px; }
        .fdm-foot {
          margin-top: 18px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.14);
          color: rgba(255, 255, 255, 0.55);
          font-size: 11.5px;
          line-height: 1.35;
        }
        .fdm-spinner {
          width: 34px;
          height: 34px;
          margin: 0 auto 14px;
          border-radius: 50%;
          border: 3px solid rgba(255, 233, 61, 0.2);
          border-top-color: #ffe93d;
          animation: fdmSpin 0.9s linear infinite;
        }
        @keyframes fdmSpin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          .fdm-spinner { animation: none; }
          .fdm-primary { transition: none; }
        }
        @media (max-width: 420px) {
          .fdm-card { padding: 22px 18px 18px; }
          .fdm-title { font-size: 34px; }
          .fdm-amount input { font-size: 26px; }
        }
      `}</style>

      <div className="fdm-backdrop" onClick={onClose}>
        <div
          className="fdm-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="fdm-title"
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" className="fdm-close" onClick={onClose} aria-label="Close">✕</button>

          <h2 id="fdm-title" className="fdm-title">Toss a coin</h2>
          <p className="fdm-sub">A golden coin for the fountain.</p>

          {/* Not connected */}
          {!isWalletConnected && (
            <div className="fdm-section fdm-center">
              <p style={{ color: 'rgba(255,255,255,0.8)' }}>
                Connect a wallet to send a golden coin.
              </p>
              <button type="button" className="fdm-primary" onClick={() => connectWallet()}>
                Connect wallet
              </button>
            </div>
          )}

          {/* Step: amount */}
          {isWalletConnected && step === 'amount' && (
            <div>
              <div className="fdm-section fdm-recipient">
                <span className="fdm-recipient-icon" aria-hidden="true">{recipient.icon}</span>
                <div>
                  <div className="fdm-recipient-name">{recipient.shortName}</div>
                  <div className="fdm-recipient-desc">{recipient.description}</div>
                </div>
              </div>

              <div className="fdm-section">
                <label className="fdm-label" htmlFor="fdm-amount">Amount</label>
                <div className="fdm-amount">
                  <input
                    id="fdm-amount"
                    type="number"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setError(null); }}
                    placeholder="0"
                    min="0"
                    step="any"
                  />
                  <div className="fdm-currency" role="group" aria-label="Currency">
                    {['USDC', 'ETH'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={payCurrency === c}
                        onClick={() => { setPayCurrency(c); setAmount(''); setError(null); }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="fdm-presets">
                  {presets.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className="fdm-chip"
                      aria-pressed={amount === v}
                      onClick={() => { setAmount(v); setError(null); }}
                    >
                      {v} {payCurrency}
                    </button>
                  ))}
                </div>
                <div className="fdm-balance">Available: {payBalanceDisplay} {payCurrency}</div>
              </div>

              {error && <div className="fdm-error" role="alert">{error}</div>}

              <button
                type="button"
                className="fdm-primary"
                onClick={handleAmountSubmit}
                disabled={!amount || parseFloat(amount) <= 0}
              >
                Continue
              </button>
            </div>
          )}

          {/* Step: confirm */}
          {isWalletConnected && step === 'confirm' && (
            <div className="fdm-section">
              <button type="button" className="fdm-back" onClick={() => setStep('amount')}>← Change amount</button>

              <dl className="fdm-summary">
                <dt>Sending</dt>
                <dd className="gold">{amount} {displayCurrency}</dd>
                <dt>To</dt>
                <dd>{recipient.shortName}</dd>
                <dt>Wallet</dt>
                <dd className="addr">{recipient.ens} · {shortAddr}</dd>
              </dl>
              <p className="fdm-note">
                Goes straight to the site wallet. A voluntary contribution: no perks, no promises, just thanks.
              </p>

              <div className="fdm-section">
                <label className="fdm-label" htmlFor="fdm-name">
                  Your name <small>(optional, shown on your coin)</small>
                </label>
                <input
                  id="fdm-name"
                  type="text"
                  className="fdm-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={24}
                  placeholder="How you'd like to be credited"
                />
              </div>
              <div className="fdm-section" style={{ marginTop: 12 }}>
                <label className="fdm-label" htmlFor="fdm-wish">
                  A wish <small>(optional, shown publicly)</small>
                </label>
                <input
                  id="fdm-wish"
                  type="text"
                  className="fdm-input"
                  value={wish}
                  onChange={(e) => setWish(e.target.value)}
                  maxLength={80}
                  placeholder="Carried into the fountain by your golden coin"
                />
              </div>

              <button
                type="button"
                className="fdm-primary"
                onClick={handleDonate}
                disabled={isTransactionPending}
              >
                {isTransactionPending ? 'Waiting for your wallet…' : `Send ${amount} ${displayCurrency}`}
              </button>
            </div>
          )}

          {/* Step: processing */}
          {step === 'processing' && (
            <div className="fdm-section fdm-center">
              <div className="fdm-spinner" aria-hidden="true" />
              <p style={{ color: 'rgba(255,255,255,0.85)' }}>Confirm the transaction in your wallet.</p>
            </div>
          )}

          {/* Step: success */}
          {step === 'success' && (
            <div className="fdm-section fdm-center">
              <h3 className="fdm-heading">Thank you</h3>
              <p style={{ color: 'rgba(255,255,255,0.85)' }}>
                Your <strong style={{ color: '#ffe93d' }}>{amount} {payCurrency}</strong> is on its way to the site.
                A golden coin is waiting in your hand. Tap the water to toss it in.
              </p>
              {txHash && (
                <p style={{ marginTop: 10, fontSize: 13 }}>
                  <a
                    className="fdm-link"
                    href={`https://basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View the transaction on BaseScan
                  </a>
                </p>
              )}
              <button type="button" className="fdm-primary" onClick={handleWatchCoin}>
                Take your golden coin
              </button>
            </div>
          )}

          {/* Step: error */}
          {step === 'error' && (
            <div className="fdm-section fdm-center">
              <h3 className="fdm-heading">That didn’t go through</h3>
              <div className="fdm-error" style={{ textAlign: 'left' }}>
                {error || 'The transaction failed. Nothing was sent.'}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
                <button type="button" className="fdm-ghost" onClick={() => setStep('confirm')}>Try again</button>
                <button type="button" className="fdm-ghost" onClick={onClose}>Close</button>
              </div>
            </div>
          )}

          {/* Footer */}
          {isWalletConnected && ['amount', 'confirm'].includes(step) && (
            <p className="fdm-foot">
              Sent directly to {recipient.ens} on Base. Every transaction is public and verifiable.
            </p>
          )}
        </div>
      </div>
    </>
  );
};

export default FountainDonationModal;
