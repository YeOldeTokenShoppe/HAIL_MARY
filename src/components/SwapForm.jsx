'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAccount, useBalance, useReadContract, useSendTransaction, useSignTypedData, useSwitchChain, useWriteContract } from 'wagmi';
import { base } from 'wagmi/chains';
import { parseUnits, formatUnits, erc20Abi, maxUint256, concat, numberToHex, size } from 'viem';
import { publicClient } from '@/lib/viemClient';
import { RL80_ADDRESS, USDC_ADDRESS, NATIVE_TOKEN } from '@/lib/contracts';
import { useLanguage } from './LanguageProvider';
import { useWalletAuth } from './WalletAuthProvider';

const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const RL80_DECIMALS = 18;

const TOKENS = {
  ETH: { symbol: 'ETH', address: NATIVE_TOKEN, decimals: 18 },
  USDC: { symbol: 'USDC', address: USDC_ADDRESS, decimals: 6 },
};

const SLIPPAGE_OPTIONS = [
  { label: '0.5%', bps: 50 },
  { label: '1%', bps: 100 },
  { label: '2%', bps: 200 },
];

const isNative = (addr) => addr.toLowerCase() === NATIVE_TOKEN.toLowerCase();

const CONNECTORS = [
  { id: 'coinbaseWalletSDK', label: 'COINBASE' },
  { id: 'metaMaskSDK', label: 'METAMASK' },
  { id: 'injected', label: 'BROWSER' },
];

export default function SwapForm({ isSmallPhone, isMobile }) {
  const { t } = useLanguage();
  const { walletAddress, isWalletConnected, connectWallet, disconnectWallet } = useWalletAuth();
  const { chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync } = useSendTransaction();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const [connectError, setConnectError] = useState(null);

  const [fromSymbol, setFromSymbol] = useState('ETH');
  const [amountInput, setAmountInput] = useState('');
  const [slippageBps, setSlippageBps] = useState(100);
  const [quote, setQuote] = useState(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState(null);
  const [status, setStatus] = useState('idle');
  const [txError, setTxError] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const [isSwitchingChain, setIsSwitchingChain] = useState(false);

  const fromToken = TOKENS[fromSymbol];
  const isOnBase = chainId === base.id;

  const { data: ethBalance } = useBalance({
    address: walletAddress,
    chainId: base.id,
    query: { enabled: !!walletAddress, refetchInterval: 30000 },
  });
  const { data: usdcBalanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    chainId: base.id,
    query: { enabled: !!walletAddress, refetchInterval: 30000 },
  });
  const usdcBalance = useMemo(
    () => (usdcBalanceRaw != null ? { value: usdcBalanceRaw, decimals: 6, symbol: 'USDC' } : undefined),
    [usdcBalanceRaw],
  );
  const balanceData = fromSymbol === 'USDC' ? usdcBalance : ethBalance;

  const hasAutoSelectedRef = useRef(false);
  useEffect(() => {
    if (hasAutoSelectedRef.current) return;
    if (!ethBalance || !usdcBalance) return;
    const ethZero = ethBalance.value === 0n;
    const usdcZero = usdcBalance.value === 0n;
    if (ethZero && !usdcZero) setFromSymbol('USDC');
    else if (usdcZero && !ethZero) setFromSymbol('ETH');
    hasAutoSelectedRef.current = true;
  }, [ethBalance, usdcBalance]);

  const fromAmountAtomic = useMemo(() => {
    if (!amountInput || !/^\d*\.?\d*$/.test(amountInput)) return null;
    if (amountInput === '.' || amountInput === '') return null;
    try {
      const parsed = parseUnits(amountInput, fromToken.decimals);
      return parsed > 0n ? parsed.toString() : null;
    } catch {
      return null;
    }
  }, [amountInput, fromToken.decimals]);

  const balanceDisplay = useMemo(() => {
    if (!balanceData) return null;
    try {
      const val = formatUnits(balanceData.value, balanceData.decimals);
      const num = parseFloat(val);
      if (num === 0) return '0';
      if (num < 0.0001) return '<0.0001';
      return num.toFixed(num >= 1 ? 4 : 6);
    } catch {
      return null;
    }
  }, [balanceData]);

  const hasInsufficientBalance = useMemo(() => {
    if (!balanceData || !fromAmountAtomic) return false;
    try {
      return balanceData.value < BigInt(fromAmountAtomic);
    } catch {
      return false;
    }
  }, [balanceData, fromAmountAtomic]);

  useEffect(() => {
    if (!fromAmountAtomic || !walletAddress) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsQuoting(true);
      setQuoteError(null);
      try {
        const res = await fetch('/api/swap/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromToken: fromToken.address,
            toToken: RL80_ADDRESS,
            fromAmount: fromAmountAtomic,
            taker: walletAddress,
            slippageBps,
          }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          const msg = data.detail ? `${data.error}: ${data.detail}` : (data.error || 'quote_failed');
          throw new Error(msg);
        }
        setQuote(data);
      } catch (e) {
        if (e.name !== 'AbortError') {
          setQuote(null);
          setQuoteError(e.message || 'quote_failed');
        }
      } finally {
        setIsQuoting(false);
      }
    }, 400);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [fromAmountAtomic, walletAddress, fromToken.address, slippageBps]);

  const toAmountDisplay = useMemo(() => {
    if (!quote) return '';
    const raw = quote.toAmount || quote.buyAmount || quote.toAmountMin;
    if (!raw) return '';
    try {
      return formatUnits(BigInt(raw), RL80_DECIMALS);
    } catch {
      return '';
    }
  }, [quote]);

  const handleConnect = useCallback(async (connectorId) => {
    setConnectError(null);
    try {
      await connectWallet(connectorId);
    } catch (e) {
      setConnectError(e?.message || 'wallet_connect_failed');
    }
  }, [connectWallet]);

  const handleSwitchToBase = useCallback(async () => {
    setTxError(null);
    setIsSwitchingChain(true);
    try {
      await switchChainAsync({ chainId: base.id });
    } catch (e) {
      setTxError(e?.shortMessage || e?.message || 'chain_switch_failed');
    } finally {
      setIsSwitchingChain(false);
    }
  }, [switchChainAsync]);

  const handleSwap = useCallback(async () => {
    if (!isWalletConnected) return;
    if (!fromAmountAtomic) return;

    setTxError(null);
    setTxHash(null);

    if (!isOnBase) {
      try {
        setIsSwitchingChain(true);
        await switchChainAsync({ chainId: base.id });
      } catch (e) {
        setTxError(e?.shortMessage || e?.message || 'chain_switch_failed');
        setIsSwitchingChain(false);
        return;
      }
      setIsSwitchingChain(false);
    }

    try {
      if (!isNative(fromToken.address)) {
        const allowance = await publicClient.readContract({
          address: fromToken.address,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [walletAddress, PERMIT2_ADDRESS],
        });
        if (allowance < BigInt(fromAmountAtomic)) {
          setStatus('approving');
          await writeContractAsync({
            address: fromToken.address,
            abi: erc20Abi,
            functionName: 'approve',
            args: [PERMIT2_ADDRESS, maxUint256],
          });
        }
      }

      setStatus('swapping');
      const res = await fetch('/api/swap/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromToken: fromToken.address,
          toToken: RL80_ADDRESS,
          fromAmount: fromAmountAtomic,
          taker: walletAddress,
          slippageBps,
        }),
      });
      const swap = await res.json();
      if (!res.ok) {
        const msg = swap.detail ? `${swap.error}: ${swap.detail}` : (swap.error || 'swap_failed');
        throw new Error(msg);
      }

      if (swap.liquidityAvailable === false) {
        throw new Error('insufficient_liquidity');
      }
      if (swap.issues?.allowance) {
        const { currentAllowance, spender } = swap.issues.allowance;
        throw new Error(`allowance_insufficient: current=${currentAllowance} spender=${spender}`);
      }
      if (!swap.transaction?.to || !swap.transaction?.data) {
        throw new Error('missing_calldata');
      }

      let txData = swap.transaction.data;
      if (swap.permit2?.eip712) {
        const signature = await signTypedDataAsync({
          domain: swap.permit2.eip712.domain,
          types: swap.permit2.eip712.types,
          primaryType: swap.permit2.eip712.primaryType,
          message: swap.permit2.eip712.message,
        });
        const sigLenHex = numberToHex(size(signature), { signed: false, size: 32 });
        txData = concat([txData, sigLenHex, signature]);
      }

      const hash = await sendTransactionAsync({
        to: swap.transaction.to,
        data: txData,
        value: swap.transaction.value ? BigInt(swap.transaction.value) : 0n,
        gas: swap.transaction.gas ? BigInt(swap.transaction.gas) : undefined,
      });
      setTxHash(hash);
      setStatus('success');
    } catch (e) {
      setTxError(e?.shortMessage || e?.message || 'tx_failed');
      setStatus('error');
    }
  }, [
    isWalletConnected,
    fromAmountAtomic,
    fromToken.address,
    walletAddress,
    slippageBps,
    sendTransactionAsync,
    signTypedDataAsync,
    writeContractAsync,
    isOnBase,
    switchChainAsync,
  ]);

  const buttonLabel = useMemo(() => {
    if (isSwitchingChain) return t('swapForm.switching') || 'SWITCHING TO BASE...';
    if (status === 'approving') return t('swapForm.approving') || 'APPROVING...';
    if (status === 'swapping') return t('swapForm.swapping') || 'SWAPPING...';
    if (status === 'success') return t('swapForm.success') || 'SUCCESS';
    if (!fromAmountAtomic) return t('swapForm.enterAmount') || 'ENTER AMOUNT';
    if (hasInsufficientBalance) {
      return `${t('swapForm.insufficientBalance') || 'INSUFFICIENT'} ${fromSymbol}`;
    }
    if (!isOnBase) return t('swapForm.switchToBase') || 'SWITCH TO BASE TO SWAP';
    if (isQuoting) return t('swapForm.loadingQuote') || 'FETCHING QUOTE...';
    if (!quote) return t('swapForm.noQuote') || 'NO QUOTE';
    return t('swapForm.swap') || 'SWAP FOR RL80';
  }, [status, fromAmountAtomic, isQuoting, quote, t, isOnBase, hasInsufficientBalance, fromSymbol, isSwitchingChain]);

  const isBusy = status === 'approving' || status === 'swapping' || isSwitchingChain;
  const canSubmit =
    isWalletConnected &&
    !isBusy &&
    !!fromAmountAtomic &&
    !hasInsufficientBalance &&
    (isOnBase ? !!quote : true);

  const fieldLabelStyle = {
    fontFamily: 'monospace',
    fontSize: '10px',
    color: 'rgba(253, 237, 0, 0.7)',
    letterSpacing: '2px',
    textTransform: 'uppercase',
  };

  const inputStyle = {
    width: '100%',
    background: 'rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(253, 237, 0, 0.3)',
    color: '#fff',
    fontFamily: 'monospace',
    fontSize: isSmallPhone ? '14px' : '18px',
    padding: '10px 12px',
    outline: 'none',
    letterSpacing: '1px',
  };

  return (
    <div style={{ width: '100%', maxWidth: '360px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Wallet status / connect */}
      {isWalletConnected ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 10px',
            border: '1px solid rgba(0, 229, 114, 0.3)',
            background: 'rgba(0, 229, 114, 0.08)',
          }}
        >
          <span style={{ ...fieldLabelStyle, color: '#00e572' }}>
            {walletAddress
              ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
              : t('swapForm.connected') || 'CONNECTED'}
          </span>
          <button
            onClick={disconnectWallet}
            style={{
              fontFamily: 'monospace',
              fontSize: '9px',
              letterSpacing: '1px',
              padding: '3px 8px',
              border: '1px solid rgba(255, 24, 76, 0.4)',
              background: 'transparent',
              color: '#ff184c',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {t('swapForm.disconnect') || 'DISCONNECT'}
          </button>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '10px',
            border: '1px solid rgba(253, 237, 0, 0.3)',
            background: 'rgba(253, 237, 0, 0.05)',
          }}
        >
          <span style={{ ...fieldLabelStyle, textAlign: 'center' }}>
            {t('swapForm.connectToSwap') || 'CONNECT WALLET TO SWAP'}
          </span>
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
            {CONNECTORS.map((c) => (
              <button
                key={c.id}
                onClick={() => handleConnect(c.id)}
                style={{
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  fontWeight: '700',
                  letterSpacing: '1px',
                  padding: '6px 10px',
                  border: '1px solid rgba(253, 237, 0, 0.5)',
                  background: 'rgba(0, 0, 0, 0.4)',
                  color: '#fded00',
                  cursor: 'pointer',
                  flex: 1,
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          {connectError && (
            <span
              style={{
                fontFamily: 'monospace',
                fontSize: '9px',
                color: '#ff184c',
                textAlign: 'center',
              }}
            >
              {connectError.slice(0, 120)}
            </span>
          )}
        </div>
      )}

      {/* Wrong network warning */}
      {isWalletConnected && !isOnBase && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '10px',
            border: '1px solid rgba(255, 24, 76, 0.5)',
            background: 'rgba(255, 24, 76, 0.08)',
          }}
        >
          <span style={{ ...fieldLabelStyle, color: '#ff184c', textAlign: 'center' }}>
            {t('swapForm.wrongNetwork') || 'WRONG NETWORK — RL80 IS ON BASE'}
          </span>
          <button
            onClick={handleSwitchToBase}
            disabled={isSwitchingChain}
            style={{
              fontFamily: 'monospace',
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '2px',
              padding: '8px 12px',
              border: '1px solid #00e572',
              background: 'rgba(0, 229, 114, 0.15)',
              color: '#00e572',
              cursor: isSwitchingChain ? 'wait' : 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {isSwitchingChain
              ? t('swapForm.switching') || 'SWITCHING...'
              : t('swapForm.switchToBase') || 'SWITCH TO BASE'}
          </button>
        </div>
      )}

      {/* From row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={fieldLabelStyle}>
            {t('swapForm.from') || 'FROM'}
            {balanceDisplay !== null && isOnBase && (
              <span
                style={{
                  marginLeft: '8px',
                  color: hasInsufficientBalance ? '#ff184c' : 'rgba(0, 229, 114, 0.8)',
                }}
              >
                {(t('swapForm.balance') || 'BAL')}: {balanceDisplay}
              </span>
            )}
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {Object.keys(TOKENS).map((sym) => {
              const active = sym === fromSymbol;
              return (
                <button
                  key={sym}
                  onClick={() => {
                    hasAutoSelectedRef.current = true;
                    setFromSymbol(sym);
                  }}
                  disabled={isBusy}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    letterSpacing: '2px',
                    padding: '4px 10px',
                    border: active
                      ? '1px solid #00e572'
                      : '1px solid rgba(255, 255, 255, 0.2)',
                    background: active ? 'rgba(0, 229, 114, 0.15)' : 'transparent',
                    color: active ? '#00e572' : 'rgba(255, 255, 255, 0.6)',
                    cursor: isBusy ? 'wait' : 'pointer',
                  }}
                >
                  {sym}
                </button>
              );
            })}
          </div>
        </div>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amountInput}
          onChange={(e) => setAmountInput(e.target.value.replace(/[^0-9.]/g, ''))}
          disabled={isBusy}
          style={inputStyle}
        />
      </div>

      {/* To row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={fieldLabelStyle}>{t('swapForm.to') || 'TO'}</span>
          <span style={{ ...fieldLabelStyle, color: '#00e572' }}>RL80</span>
        </div>
        <div
          style={{
            ...inputStyle,
            color: toAmountDisplay ? '#00e572' : 'rgba(255, 255, 255, 0.3)',
            minHeight: isSmallPhone ? '36px' : '42px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {isQuoting ? '…' : toAmountDisplay || '0.00'}
        </div>
      </div>

      {/* Slippage */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={fieldLabelStyle}>{t('swapForm.slippage') || 'SLIPPAGE'}</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {SLIPPAGE_OPTIONS.map((opt) => {
            const active = opt.bps === slippageBps;
            return (
              <button
                key={opt.bps}
                onClick={() => setSlippageBps(opt.bps)}
                disabled={isBusy}
                style={{
                  fontFamily: 'monospace',
                  fontSize: '10px',
                  letterSpacing: '1px',
                  padding: '3px 8px',
                  border: active
                    ? '1px solid #fded00'
                    : '1px solid rgba(255, 255, 255, 0.2)',
                  background: active ? 'rgba(253, 237, 0, 0.15)' : 'transparent',
                  color: active ? '#fded00' : 'rgba(255, 255, 255, 0.6)',
                  cursor: isBusy ? 'wait' : 'pointer',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error */}
      {(quoteError || txError) && (
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#ff184c',
            letterSpacing: '1px',
            padding: '6px 8px',
            border: '1px solid rgba(255, 24, 76, 0.4)',
            background: 'rgba(255, 24, 76, 0.08)',
            wordBreak: 'break-word',
          }}
        >
          {(txError || quoteError).slice(0, 400)}
        </div>
      )}

      {/* Success */}
      {status === 'success' && txHash && (
        <a
          href={`https://basescan.org/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#00e572',
            letterSpacing: '1px',
            textDecoration: 'underline',
            textAlign: 'center',
          }}
        >
          {t('swapForm.viewTx') || 'VIEW ON BASESCAN'} ↗
        </a>
      )}

      {/* Swap button */}
      <button
        onClick={handleSwap}
        disabled={!canSubmit}
        style={{
          fontFamily: 'monospace',
          fontSize: isSmallPhone ? '14px' : '16px',
          fontWeight: '900',
          textTransform: 'uppercase',
          letterSpacing: '3px',
          color: '#000',
          background: canSubmit
            ? 'linear-gradient(135deg, #ff184c, #8B00FF)'
            : 'rgba(100, 100, 100, 0.5)',
          border: 'none',
          padding: isSmallPhone ? '14px 28px' : '16px 40px',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
          transition: 'all 0.3s ease',
          marginTop: '4px',
        }}
        onMouseEnter={(e) => {
          if (canSubmit) {
            e.currentTarget.style.transform = 'scale(1.03)';
            e.currentTarget.style.boxShadow = '0 0 30px rgba(255, 24, 76, 0.6)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '';
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
