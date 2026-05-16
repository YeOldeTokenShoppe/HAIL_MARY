"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAccount, useReadContracts, useSignTypedData } from 'wagmi';
import { erc20Abi, isAddress } from 'viem';
import { UnifiedAccountModal } from './UnifiedAccountModal';
import generateReviewCase from './game/cases/generateReviewCase';
import { fetchWithX402 } from '@/lib/review/x402Client';

// ReviewFunnel — multi-step "request a custom token review" flow on /trade.
// Wallet check → contract address input → name/symbol/decimals resolved
// via wagmi → confirmation card → onConfirm(reviewCase).
//
// This is step 1 of the broader x402-paid review service. NO payment is
// taken at this stage; on Confirm the funnel just hands the parent a
// case-file-shaped object built by generateReviewCase. Payment + real
// data + LLM dialogue land in subsequent passes.
//
// Currently fixed to Base (matches wagmiConfig.js — Base is the only
// chain in the transport map). The chain picker is intentionally
// deferred until the data layer can serve other chains.

const SUPPORTED_CHAIN_ID = 8453; // Base
const SUPPORTED_CHAIN_LABEL = 'Base';

// Display copy for the paywall step. Server enforces the actual price
// from the x402 challenge; this is just for UI honesty before the
// challenge round-trip.
const TIER1_PRICE_LABEL = '0.05 USDC';

export default function ReviewFunnel({ isOpen, onClose, onConfirm }) {
  const { isConnected, address: walletAddress } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [showWalletModal, setShowWalletModal] = useState(false);
  // Form state.
  const [rawInput, setRawInput] = useState('');
  // Set to the validated address when the player submits — drives the
  // ERC-20 read. Reset to null when they edit or cancel.
  const [resolvingAddress, setResolvingAddress] = useState(null);

  const normalizedInput = useMemo(() => rawInput.trim(), [rawInput]);
  const inputIsValid = useMemo(
    () => normalizedInput.length > 0 && isAddress(normalizedInput),
    [normalizedInput],
  );

  // Reset funnel state whenever it opens fresh.
  useEffect(() => {
    if (isOpen) {
      setRawInput('');
      setResolvingAddress(null);
    }
  }, [isOpen]);

  // Batched ERC-20 reads: name, symbol, decimals. Gated on
  // resolvingAddress so the query only fires after the player submits a
  // valid input, not on every keystroke.
  const readContracts = useMemo(
    () =>
      resolvingAddress
        ? [
            { address: resolvingAddress, abi: erc20Abi, functionName: 'name',     chainId: SUPPORTED_CHAIN_ID },
            { address: resolvingAddress, abi: erc20Abi, functionName: 'symbol',   chainId: SUPPORTED_CHAIN_ID },
            { address: resolvingAddress, abi: erc20Abi, functionName: 'decimals', chainId: SUPPORTED_CHAIN_ID },
          ]
        : [],
    [resolvingAddress],
  );

  const { data: readData, error: readError, isLoading: isReading } = useReadContracts({
    contracts: readContracts,
    query: { enabled: !!resolvingAddress },
  });

  const resolved = useMemo(() => {
    if (!resolvingAddress || !readData) return null;
    const [nameRes, symbolRes, decimalsRes] = readData;
    if (nameRes?.status !== 'success' || symbolRes?.status !== 'success') return null;
    return {
      chainId: SUPPORTED_CHAIN_ID,
      address: resolvingAddress,
      name: String(nameRes.result),
      symbol: String(symbolRes.result),
      decimals: decimalsRes?.status === 'success' ? Number(decimalsRes.result) : 18,
    };
  }, [resolvingAddress, readData]);

  // Distinguish "still loading" from "loaded but the contract isn't ERC-20".
  const resolveFailed =
    !!resolvingAddress && !isReading && !resolved && (!!readError || !!readData);

  // Onchain snapshot — fires in parallel with the wagmi reads. Trinity
  // (marisol) station consumes this to compose her actual onchain read.
  // Failure here is non-blocking: we still let the user begin the review
  // and Trinity just falls back to placeholder copy.
  const [onchain, setOnchain] = useState(null);
  const [onchainLoading, setOnchainLoading] = useState(false);
  const [onchainError, setOnchainError] = useState(null);

  useEffect(() => {
    if (!resolvingAddress) {
      setOnchain(null);
      setOnchainError(null);
      return;
    }
    let cancelled = false;
    setOnchainLoading(true);
    setOnchainError(null);
    fetch('/api/review/onchain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chainId: SUPPORTED_CHAIN_ID, address: resolvingAddress }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`onchain ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setOnchain(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setOnchainError(String(err?.message || err));
      })
      .finally(() => {
        if (!cancelled) setOnchainLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvingAddress]);

  const handleSubmit = () => {
    if (!inputIsValid) return;
    setResolvingAddress(normalizedInput);
  };

  // Tier 1 generation flow.
  //   payStatus drives the UI:
  //     'idle'      → user is on the Confirm card
  //     'signing'   → wallet popup is open, user is reviewing the EIP-3009 sig
  //     'compiling' → payment settled, Claude pipeline running
  //   Server returns 402 first, the funnel signs an EIP-3009
  //   transferWithAuthorization via wagmi, retries with X-PAYMENT, gets
  //   the LLM response. CDP facilitator verifies + settles.
  const [payStatus, setPayStatus] = useState('idle');
  const [payError, setPayError] = useState(null);
  const compiling = payStatus === 'compiling' || payStatus === 'signing';

  const handleConfirm = async () => {
    if (!resolved) return;
    if (compiling) return;
    if (!walletAddress) {
      setPayError('Wallet disconnected — reconnect to pay');
      return;
    }
    setPayError(null);
    setPayStatus('signing');

    let characters = null;
    try {
      const { data } = await fetchWithX402({
        url: '/api/review/characters',
        requestBody: {
          token: {
            chainId: resolved.chainId,
            address: resolved.address,
            name: resolved.name,
            symbol: resolved.symbol,
            chainLabel: SUPPORTED_CHAIN_LABEL,
          },
          onchain,
        },
        // Flip the UI to "compiling" the moment the user accepts the
        // wallet prompt — fetchWithX402 calls onChallenge BEFORE
        // signing, but we want the visual update to happen AFTER the
        // sig is captured (i.e. inside signTypedDataAsync). Simpler:
        // we'll flip in the same place we call this, post-sign.
        signTypedDataAsync: async (typedData) => {
          const sig = await signTypedDataAsync(typedData);
          // Signature in hand → server will verify + settle next.
          setPayStatus('compiling');
          return sig;
        },
        payerAddress: walletAddress,
      });
      characters = data;
    } catch (err) {
      // Hard fail — the user either rejected the wallet prompt, the
      // signature was rejected, or settle failed (e.g. insufficient
      // USDC). Drop them back to the Confirm card with the reason; the
      // case is NOT built. Different from the previous soft-fail policy
      // because the user is paying — we shouldn't silently proceed
      // with a degraded result if the LLM pipeline never ran.
      console.warn('[ReviewFunnel] x402 + character compile failed:', err);
      setPayError(humanizePaymentError(err));
      setPayStatus('idle');
      return;
    }

    const reviewCase = generateReviewCase({ ...resolved, onchain, characters });
    setPayStatus('idle');
    onConfirm?.(reviewCase);
  };

  const handleClose = () => {
    setRawInput('');
    setResolvingAddress(null);
    onClose?.();
  };

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  // Three visual states inside the dialog body.
  let body = null;
  if (compiling) {
    // Outermost branch — once Confirm fires the paid pipeline, the
    // funnel sits on this screen through the wallet-signing prompt
    // ('signing') and the LLM compile ('compiling'). Backdrop-tap
    // is still allowed (handleClose resets state) so users can bail.
    body = <CompilingStep phase={payStatus} />;
  } else if (!isConnected) {
    body = (
      <ConnectWalletPrompt onConnect={() => setShowWalletModal(true)} />
    );
  } else if (!resolvingAddress) {
    body = (
      <AddressInputStep
        value={rawInput}
        onChange={setRawInput}
        onSubmit={handleSubmit}
        canSubmit={inputIsValid}
        normalizedInput={normalizedInput}
      />
    );
  } else if (isReading) {
    body = <ResolvingStep address={resolvingAddress} />;
  } else if (resolveFailed) {
    body = (
      <ResolveErrorStep
        address={resolvingAddress}
        onRetry={() => {
          setResolvingAddress(null);
        }}
      />
    );
  } else if (resolved) {
    body = (
      <ConfirmStep
        token={resolved}
        onEdit={() => setResolvingAddress(null)}
        onConfirm={handleConfirm}
        onchainLoading={onchainLoading}
        onchainReady={!!onchain}
        onchainError={onchainError}
        payError={payError}
      />
    );
  }

  return createPortal(
    <>
      <div
        onClick={handleClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-funnel-title"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 11500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          background: 'rgba(2,5,8,0.62)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          // While the wallet modal (zIndex 9999) is open, hide the funnel
          // chrome so its backdrop doesn't sit on top of the wallet modal
          // and intercept clicks. The funnel's state stays mounted so the
          // user returns to the next step (address input) once they close
          // or finish the wallet flow.
          visibility: showWalletModal ? 'hidden' : 'visible',
          pointerEvents: showWalletModal ? 'none' : 'auto',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(480px, 100%)',
            maxHeight: 'calc(100vh - 32px)',
            overflowY: 'auto',
            background: 'linear-gradient(180deg, rgba(4,12,8,0.94), rgba(2,5,8,0.9))',
            border: '1px solid rgba(142,233,255,0.55)',
            borderRadius: 12,
            boxShadow: '0 0 28px rgba(142,233,255,0.22)',
            color: '#c8ffe0',
            fontFamily: "'IBM Plex Mono','SF Mono',Menlo,monospace",
          }}
        >
          <div
            style={{
              background: '#8ee9ff',
              color: '#050a07',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.18em',
            }}
          >
            <span id="review-funnel-title">▸ TOKEN REVIEW</span>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close review funnel"
              style={{
                background: 'rgba(5,10,7,0.18)',
                border: '1px solid rgba(5,10,7,0.55)',
                color: '#050a07',
                width: 28,
                height: 28,
                borderRadius: 6,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                lineHeight: 1,
                fontWeight: 800,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ padding: '18px 18px 16px' }}>
            {body}
          </div>
        </div>
      </div>

      <UnifiedAccountModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
      />
    </>,
    document.body,
  );
}

// ─── Step components ───────────────────────────────────────────────

function StepTitle({ children }) {
  return (
    <div
      style={{
        fontFamily: "'Cinzel Decorative','Cinzel',serif",
        fontSize: 18,
        letterSpacing: '0.10em',
        color: '#c8ffe0',
        marginBottom: 8,
        textShadow: '0 0 12px rgba(142,233,255,0.35)',
      }}
    >
      {children}
    </div>
  );
}

function StepHelp({ children }) {
  return (
    <div style={{ fontSize: 12, lineHeight: 1.45, color: '#88c4b2', marginBottom: 14 }}>
      {children}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '10px 18px',
        background: disabled ? 'rgba(142,233,255,0.06)' : 'rgba(142,233,255,0.14)',
        color: disabled ? 'rgba(200,255,224,0.4)' : '#c8ffe0',
        border: `1px solid ${disabled ? 'rgba(142,233,255,0.18)' : 'rgba(142,233,255,0.55)'}`,
        borderRadius: 8,
        fontFamily: 'inherit',
        fontSize: 12,
        letterSpacing: '0.18em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textShadow: disabled ? 'none' : '0 0 8px rgba(142,233,255,0.35)',
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 16px',
        background: 'transparent',
        color: '#c8ffe0',
        border: '1px solid rgba(142,233,255,0.35)',
        borderRadius: 8,
        fontFamily: 'inherit',
        fontSize: 12,
        letterSpacing: '0.18em',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function ConnectWalletPrompt({ onConnect }) {
  return (
    <>
      <StepTitle>CONNECT WALLET</StepTitle>
      <StepHelp>
        Token Review needs a connected wallet so the verdict and any future
        payment can be attributed. Nothing is charged yet at this stage.
      </StepHelp>
      <PrimaryButton onClick={onConnect}>▸ CONNECT</PrimaryButton>
    </>
  );
}

function AddressInputStep({ value, onChange, onSubmit, canSubmit, normalizedInput }) {
  const showInvalidHint = normalizedInput.length > 0 && !canSubmit;
  return (
    <>
      <StepTitle>PASTE TOKEN ADDRESS</StepTitle>
      <StepHelp>
        Paste a contract address on {SUPPORTED_CHAIN_LABEL}. We will look up the
        token name and ticker before you confirm the request.
      </StepHelp>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canSubmit) onSubmit();
        }}
        placeholder="0x…"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        style={{
          width: '100%',
          padding: '10px 12px',
          background: 'rgba(2,5,8,0.6)',
          color: '#c8ffe0',
          border: `1px solid ${showInvalidHint ? 'rgba(255,77,109,0.55)' : 'rgba(142,233,255,0.35)'}`,
          borderRadius: 8,
          fontFamily: 'inherit',
          fontSize: 13,
          letterSpacing: '0.04em',
          marginBottom: 8,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {showInvalidHint && (
        <div style={{ fontSize: 11, color: '#ff8aa0', marginBottom: 10 }}>
          That doesn't look like a valid 0x address.
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <PrimaryButton onClick={onSubmit} disabled={!canSubmit}>
          ▸ LOOK UP
        </PrimaryButton>
      </div>
    </>
  );
}

function ResolvingStep({ address }) {
  return (
    <>
      <StepTitle>READING CONTRACT…</StepTitle>
      <StepHelp>
        Calling <code>name()</code>, <code>symbol()</code>, and <code>decimals()</code> on
        {' '}{address.slice(0, 6)}…{address.slice(-4)} on {SUPPORTED_CHAIN_LABEL}.
      </StepHelp>
      <div style={{ fontSize: 11, color: '#6db59a', fontStyle: 'italic' }}>
        Hold tight — the chain is talking back.
      </div>
    </>
  );
}

function ResolveErrorStep({ address, onRetry }) {
  return (
    <>
      <StepTitle>COULDN'T READ THAT CONTRACT</StepTitle>
      <StepHelp>
        The ERC-20 read failed for{' '}
        <strong style={{ color: '#c8ffe0' }}>{address.slice(0, 6)}…{address.slice(-4)}</strong>{' '}
        on {SUPPORTED_CHAIN_LABEL}. It might not be ERC-20, or the contract may live on a
        different chain. Nothing was charged.
      </StepHelp>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <SecondaryButton onClick={onRetry}>▸ TRY ANOTHER ADDRESS</SecondaryButton>
      </div>
    </>
  );
}

// Map raw x402/wallet errors to short user-facing strings. Anything we
// don't recognize falls back to the message so a real bug isn't hidden.
function humanizePaymentError(err) {
  const msg = String(err?.message || err || '');
  if (/User rejected|user denied|reject/i.test(msg)) return 'Payment cancelled in wallet.';
  if (/insufficient/i.test(msg)) return 'Insufficient USDC on Base to cover the fee.';
  if (/invalid signature|verify/i.test(msg)) return 'Signature verification failed. Try again.';
  if (/settle/i.test(msg)) return 'Payment settlement failed. No funds were moved.';
  return msg.slice(0, 120);
}

function CompilingStep({ phase }) {
  const isSigning = phase === 'signing';
  return (
    <>
      <StepTitle>
        {isSigning ? 'CONFIRM PAYMENT IN WALLET…' : 'COMPILING THE TEAM’S READ…'}
      </StepTitle>
      <StepHelp>
        {isSigning ? (
          <>
            A wallet popup is asking you to sign a USDC transfer of <strong>{TIER1_PRICE_LABEL}</strong>{' '}
            to authorize the review. Nothing is broadcast until you sign.
          </>
        ) : (
          <>
            Four characters are looking at the contract from four angles. This usually
            takes 5&ndash;15 seconds. Don&rsquo;t close the window.
          </>
        )}
      </StepHelp>
      <div
        style={{
          fontSize: 11,
          color: '#8ee9ff',
          fontStyle: 'italic',
          padding: '14px 16px',
          border: '1px solid rgba(142,233,255,0.25)',
          borderLeft: '2px solid #8ee9ff',
          borderRadius: 6,
          background: 'rgba(142,233,255,0.06)',
          lineHeight: 1.5,
        }}
      >
        {isSigning ? (
          <>
            Sign in your wallet to release the payment.<br />
            On success, the four characters get to work.
          </>
        ) : (
          <>
            Saint GR80 is reading the deployer&rsquo;s track record.<br />
            John Barron is reading the launch shape.<br />
            Detective Trinity has the wallets pulled up.<br />
            Eugene is checking the pitch against past patterns.
          </>
        )}
      </div>
    </>
  );
}

function ConfirmStep({ token, onEdit, onConfirm, onchainLoading, onchainReady, onchainError, payError }) {
  return (
    <>
      <StepTitle>CONFIRM TOKEN</StepTitle>
      <StepHelp>You're requesting a forensic reading on:</StepHelp>
      <div
        style={{
          padding: '14px 16px',
          marginBottom: 14,
          border: '1px solid rgba(142,233,255,0.45)',
          borderRadius: 10,
          background: 'rgba(142,233,255,0.08)',
        }}
      >
        <div
          style={{
            fontFamily: "'Cinzel Decorative','Cinzel',serif",
            fontSize: 22,
            color: '#effff5',
            letterSpacing: '0.04em',
            marginBottom: 4,
          }}
        >
          {token.name}
        </div>
        <div style={{ fontSize: 13, color: '#8ee9ff', letterSpacing: '0.12em', marginBottom: 10 }}>
          ${token.symbol}
        </div>
        <div style={{ fontSize: 11, color: '#88c4b2', fontFamily: 'inherit', wordBreak: 'break-all' }}>
          {token.address}
        </div>
        <div style={{ fontSize: 10, color: '#6db59a', letterSpacing: '0.18em', marginTop: 6 }}>
          // {SUPPORTED_CHAIN_LABEL} · {token.decimals} decimals
        </div>
      </div>
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.16em',
          color: onchainError
            ? '#ff8aa0'
            : onchainReady
            ? '#8effc4'
            : onchainLoading
            ? '#8ee9ff'
            : '#6db59a',
          marginBottom: 10,
          fontStyle: 'italic',
        }}
      >
        {onchainError
          ? `// onchain snapshot unavailable — Trinity will improvise`
          : onchainReady
          ? `// onchain snapshot ready · Trinity has the receipts`
          : onchainLoading
          ? `// reading the chain…`
          : `// onchain snapshot queued`}
      </div>
      {payError && (
        <div
          style={{
            marginBottom: 10,
            padding: '8px 10px',
            border: '1px solid rgba(255,77,109,0.55)',
            borderRadius: 6,
            background: 'rgba(255,77,109,0.08)',
            color: '#ff8aa0',
            fontSize: 11,
            lineHeight: 1.4,
          }}
        >
          {payError}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
        <SecondaryButton onClick={onEdit}>▸ EDIT</SecondaryButton>
        <PrimaryButton onClick={onConfirm}>▸ PAY {TIER1_PRICE_LABEL} &amp; BEGIN</PrimaryButton>
      </div>
      <div style={{ fontSize: 10, color: '#3a6b54', fontStyle: 'italic', marginTop: 12, textAlign: 'right' }}>
        Pays via USDC on Base. Nothing moves until you sign in your wallet.
      </div>
    </>
  );
}
