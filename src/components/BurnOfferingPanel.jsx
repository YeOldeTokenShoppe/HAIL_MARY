"use client";

// Burnt offering section for the candle picker popup. Optional flex on
// top of a free candle: burn RL80 by transferring it to the dead
// address (a PURE BURN — tokens are destroyed, nothing flows to us),
// then have /api/burn-offering verify the tx on-chain and credit the
// burn to the user's lit candle. The flex surfaces via the existing
// Firestore subscriptions: the candle's feed item on Our Lady's phone
// (WatchlistPhoneTexture) and the VigilTicker chyron both pick up
// `tokensBurned` from the shrineCandles doc within moments.

import React, { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { erc20Abi, parseUnits } from "viem";
import { RL80_ADDRESS, BURN_ADDRESS } from "@/lib/contracts";

function fmtTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

// RL80 trades sub-cent, so a burn of a few thousand tokens can be worth a
// fraction of a cent. Keep two decimals once we're above a penny; below it,
// show "<$0.01" rather than a misleading "$0.00".
function fmtUsd(v) {
  if (!Number.isFinite(v) || v <= 0) return "$0.00";
  if (v < 0.01) return "<$0.01";
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PRESETS = [10_000, 100_000, 1_000_000];

export default function BurnOfferingPanel({ onBurned }) {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const { data: balanceRaw, refetch: refetchBalance } = useReadContract({
    address: RL80_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const balanceTokens =
    typeof balanceRaw === "bigint" ? Number(balanceRaw / 10n ** 18n) : 0;

  const [amount, setAmount] = useState("");
  // idle → wallet (signature pending) → verifying (server checking the
  // receipt) → done | error. `pendingTxHash` survives a failed credit so
  // retry never asks the wallet to burn twice — the server route is
  // idempotent per tx hash.
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(null);
  const [pendingTxHash, setPendingTxHash] = useState(null);
  const [credited, setCredited] = useState(0);

  // Live RL80 price (USD per token) from the same feed the chart/ticker use,
  // so we can show what an offering is worth as the user picks an amount.
  const [price, setPrice] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/rl80-price")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && typeof d?.price === "number") setPrice(d.price);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const usdValue = price != null && Number(amount) > 0 ? Number(amount) * price : null;

  const creditBurn = async (txHash) => {
    setPhase("verifying");
    setError(null);
    try {
      const res = await fetch("/api/burn-offering", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCredited(data.tokensBurned);
        setPhase("done");
        setAmount("");
        setPendingTxHash(null);
        refetchBalance();
        onBurned?.(data.tokensBurned);
      } else if (data.retryable) {
        setError("Your burn is on-chain but crediting timed out.");
        setPhase("error");
      } else {
        setError(`Could not credit burn (${data.error || "unknown"}).`);
        setPhase("error");
        setPendingTxHash(null);
      }
    } catch {
      // Network blip — the tx hash is kept so retry just re-verifies.
      setError("Your burn is on-chain but crediting failed to reach the server.");
      setPhase("error");
    }
  };

  const handleBurn = async () => {
    const tokens = Math.floor(Number(amount));
    if (!Number.isFinite(tokens) || tokens < 1) {
      setError("Enter an amount to offer.");
      return;
    }
    if (tokens > balanceTokens) {
      setError(`You hold ${fmtTokens(balanceTokens)} RL80.`);
      return;
    }
    setError(null);
    setPhase("wallet");
    let txHash;
    try {
      txHash = await writeContractAsync({
        address: RL80_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [BURN_ADDRESS, parseUnits(String(tokens), 18)],
        chainId: 8453,
      });
    } catch (err) {
      // Wallet rejection is a quiet return to idle; real failures surface.
      const rejected = /reject|denied|cancel/i.test(err?.message || "");
      if (!rejected) setError("Transaction failed to send.");
      setPhase("idle");
      return;
    }
    setPendingTxHash(txHash);
    await creditBurn(txHash);
  };

  const busy = phase === "wallet" || phase === "verifying";

  return (
    <div className="votive-customize burn-offering">
      <p className="votive-customize-heading">Get Lit for RL80</p>
      <p className="burn-offering-copy">
        Burn RL80 with your candle — a pure burn and symbolic sacrifice.
      </p>

      {phase === "done" ? (
        <div className="burn-offering-done">
          <p className="burn-offering-done-text">
            🔥 {fmtTokens(credited)} RL80 burned. Our Lady has seen it.
          </p>
          <button
            type="button"
            className="candle-picker-secondary"
            onClick={() => setPhase("idle")}
          >
            Offer more
          </button>
        </div>
      ) : (
        <>
          <div className="burn-offering-presets">
            {PRESETS.filter((p) => p <= balanceTokens).map((p) => (
              <button
                key={p}
                type="button"
                className={`dedication-chip${
                  Number(amount) === p ? " is-active" : ""
                }`}
                disabled={busy}
                onClick={() => setAmount(String(p))}
              >
                {fmtTokens(p)}
              </button>
            ))}
            {balanceTokens >= 1 && (
              <button
                type="button"
                className={`dedication-chip${
                  Number(amount) === balanceTokens ? " is-active" : ""
                }`}
                disabled={busy}
                onClick={() => setAmount(String(balanceTokens))}
              >
                Max
              </button>
            )}
          </div>
          <div className="burn-offering-row">
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              placeholder="RL80 amount"
              value={amount}
              disabled={busy}
              onChange={(e) => setAmount(e.target.value)}
              className="burn-offering-input"
              aria-label="RL80 amount to burn"
            />
            <button
              type="button"
              className="shrine-btn primary burn-offering-btn"
              disabled={busy || !address}
              onClick={
                phase === "error" && pendingTxHash
                  ? () => creditBurn(pendingTxHash)
                  : handleBurn
              }
            >
              {phase === "wallet"
                ? "Confirm in wallet…"
                : phase === "verifying"
                  ? "Verifying burn…"
                  : phase === "error" && pendingTxHash
                    ? "Retry credit"
                    : "Burn 🔥"}
            </button>
          </div>
          {usdValue != null && (
            <p className="burn-offering-usd">
              ≈ <strong>{fmtUsd(usdValue)}</strong> USD
            </p>
          )}
          <p className="burn-offering-balance">
            balance: {fmtTokens(balanceTokens)} RL80
            {price != null && balanceTokens > 0 && ` (≈ ${fmtUsd(balanceTokens * price)})`}
          </p>
          {error && <p className="burn-offering-error">{error}</p>}
        </>
      )}

      <style>{`
        .burn-offering-copy {
          font-size: 0.72rem;
          line-height: 1.45;
          opacity: 0.75;
          margin: 0 0 8px;
        }
        .burn-offering-presets {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 8px;
        }
        .burn-offering-row {
          display: flex;
          gap: 8px;
          align-items: stretch;
        }
        .burn-offering-input {
          flex: 1;
          min-width: 0;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(212, 168, 84, 0.35);
          border-radius: 8px;
          color: inherit;
          font: inherit;
          padding: 6px 10px;
        }
        .burn-offering-input:focus {
          outline: none;
          border-color: rgba(255, 170, 60, 0.8);
        }
        .burn-offering-btn {
          white-space: nowrap;
        }
        .burn-offering-usd {
          font-size: 0.74rem;
          color: rgba(255, 196, 120, 0.95);
          margin: 6px 0 0;
        }
        .burn-offering-usd strong {
          font-weight: 700;
        }
        .burn-offering-balance {
          font-size: 0.68rem;
          opacity: 0.55;
          margin: 6px 0 0;
        }
        .burn-offering-error {
          font-size: 0.72rem;
          color: rgba(255, 120, 90, 0.95);
          margin: 6px 0 0;
        }
        .burn-offering-done-text {
          font-size: 0.8rem;
          color: rgba(255, 196, 120, 0.95);
          margin: 0 0 6px;
        }
      `}</style>
    </div>
  );
}
