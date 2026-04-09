"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { getItemPrice, getItemCategory } from "@/lib/oilPremium";
import { useWriteContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { RL80_ADDRESS, USDC_ADDRESS, BURN_ADDRESS } from '@/lib/contracts';
const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_OIL_PURCHASE_TREASURY;

// Format large numbers: 155000000 → "~155M", 1200000 → "~1.2M", 850000 → "~850K"
function formatRL80(amount) {
  if (amount >= 1_000_000_000) return `~${(amount / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (amount >= 1_000_000) return `~${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (amount >= 1_000) return `~${(amount / 1_000).toFixed(0)}K`;
  return `~${amount.toFixed(0)}`;
}

// items = array of { id, label, category }
export default function PumpPurchaseModal({ items, activeAccount, userId, onComplete, onClose, onConnectWallet }) {
  const [currency, setCurrency] = useState("rl80");
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [rl80Price, setRl80Price] = useState(null);
  const [priceLoading, setPriceLoading] = useState(true);

  const { writeContractAsync } = useWriteContract();

  // Calculate total USD price across all items
  const totalUsdc = useMemo(() => {
    let sum = 0;
    for (const item of items) {
      const p = getItemPrice(item.id);
      if (p) sum += p.usdc;
    }
    return sum;
  }, [items]);

  // Fetch RL80 price on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/rl80-price");
        const data = await res.json();
        if (!cancelled && data.price) {
          setRl80Price(data.price);
        }
      } catch {
        // Fallback: leave null, disable RL80 option
      } finally {
        if (!cancelled) setPriceLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Calculate RL80 token amount from total USD price
  const rl80Amount = rl80Price ? Math.ceil(totalUsdc / rl80Price) : null;

  const handlePurchase = useCallback(async () => {
    if (!activeAccount || totalUsdc === 0) return;
    setStatus("signing");
    setErrorMsg("");

    try {
      let txHash;
      if (currency === "rl80") {
        if (!rl80Amount) throw new Error("RL80 price unavailable");
        txHash = await writeContractAsync({
          address: RL80_ADDRESS,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [BURN_ADDRESS, BigInt(rl80Amount) * BigInt(10 ** 18)],
        });
      } else {
        if (!TREASURY_ADDRESS) {
          throw new Error("Treasury address not configured");
        }
        txHash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [TREASURY_ADDRESS, BigInt(totalUsdc) * BigInt(10 ** 6)],
        });
      }

      setStatus("confirming");
      await submitToServer(txHash);
    } catch (err) {
      const msg = err?.message || "Transaction failed";
      if (msg.includes("rejected") || msg.includes("denied") || msg.includes("cancelled")) {
        setStatus("idle");
      } else {
        setStatus("error");
        setErrorMsg(msg.slice(0, 120));
      }
    }
  }, [activeAccount, currency, totalUsdc, rl80Amount, items, writeContractAsync]);

  const submitToServer = useCallback(async (txHash) => {
    if (!txHash) {
      setStatus("error");
      setErrorMsg("No transaction hash received");
      return;
    }
    setStatus("submitting");
    try {
      const itemIds = items.map((i) => i.id);
      const res = await fetch("/api/oil-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          txHash,
          itemIds,
          currency,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server verification failed");
      setStatus("done");
      setTimeout(() => onComplete?.(itemIds), 1200);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message?.slice(0, 120) || "Verification failed");
    }
  }, [userId, items, currency, onComplete]);

  const isProcessing = status === "signing" || status === "confirming" || status === "submitting";
  const rl80Available = !priceLoading && rl80Amount != null;

  if (!items || items.length === 0 || totalUsdc === 0) return null;

  return createPortal(
    <div style={overlay} onClick={isProcessing ? undefined : onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={header}>
          <span style={headerIcon}>&#128274;</span>
          <span>UNLOCK {items.length === 1 ? "ITEM" : `${items.length} ITEMS`}</span>
          {!isProcessing && (
            <button onClick={onClose} style={closeBtn}>&times;</button>
          )}
        </div>

        {/* Item list */}
        <div style={itemBox}>
          {items.map((item) => {
            const p = getItemPrice(item.id);
            const catLabel = {
              theme: "THEME", fence: "FENCE", addon: "ADD-ON",
              accessory: "ACCESSORY", slotUnlock: "SLOT UNLOCK",
            }[getItemCategory(item.id)] || "ITEM";
            return (
              <div key={item.id} style={itemRow}>
                <span style={itemLabel}>{item.label}</span>
                <span style={itemCat}>{catLabel}</span>
                <span style={itemPrice}>${p?.usdc || "?"}</span>
              </div>
            );
          })}
          {items.length > 1 && (
            <div style={totalRow}>
              <span style={totalLabel}>TOTAL</span>
              <span style={totalPrice}>${totalUsdc}</span>
            </div>
          )}
          <div style={itemSub}>PERMANENT UNLOCK{items.length > 1 ? "S" : ""}</div>
        </div>

        {/* Currency toggle */}
        {status === "idle" && (
          <>
            <div style={sectionLabel}>PAY WITH</div>
            <div style={toggleRow}>
              <button
                onClick={() => rl80Available && setCurrency("rl80")}
                style={{
                  ...(currency === "rl80" ? toggleActive : toggleBtn),
                  opacity: rl80Available ? 1 : 0.35,
                  cursor: rl80Available ? "pointer" : "default",
                }}
              >
                {priceLoading ? (
                  <span style={priceNum}>...</span>
                ) : rl80Available ? (
                  <>
                    <span style={priceNum}>{formatRL80(rl80Amount)}</span>
                    <span style={priceUnit}>RL80 (BURN)</span>
                    <span style={priceDollar}>${totalUsdc} value</span>
                  </>
                ) : (
                  <>
                    <span style={priceNum}>N/A</span>
                    <span style={priceUnit}>RL80 UNAVAILABLE</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setCurrency("usdc")}
                style={currency === "usdc" ? toggleActive : toggleBtn}
              >
                <span style={priceNum}>${totalUsdc}</span>
                <span style={priceUnit}>USDC</span>
              </button>
            </div>

            {currency === "rl80" && rl80Available && (
              <div style={burnNote}>
                Tokens are permanently burned — reducing total supply
              </div>
            )}

            <button
              onClick={activeAccount ? handlePurchase : onConnectWallet}
              disabled={activeAccount && currency === "rl80" && !rl80Available}
              style={{
                ...purchaseBtn,
                opacity: (activeAccount ? (currency !== "rl80" || rl80Available) : true) ? 1 : 0.4,
                cursor: (activeAccount ? (currency !== "rl80" || rl80Available) : true) ? "pointer" : "default",
              }}
            >
              {activeAccount ? "CONFIRM PURCHASE" : "CONNECT WALLET"}
            </button>
          </>
        )}

        {/* Status displays */}
        {status === "signing" && (
          <div style={statusBox}>
            <div style={spinner} />
            <div style={statusText}>APPROVE IN WALLET...</div>
            <div style={statusSub}>Check your wallet for the transaction prompt</div>
          </div>
        )}

        {status === "confirming" && (
          <div style={statusBox}>
            <div style={spinner} />
            <div style={statusText}>CONFIRMING ON-CHAIN...</div>
            <div style={statusSub}>Waiting for block confirmations</div>
          </div>
        )}

        {status === "submitting" && (
          <div style={statusBox}>
            <div style={spinner} />
            <div style={statusText}>VERIFYING PURCHASE...</div>
            <div style={statusSub}>Validating transaction on server</div>
          </div>
        )}

        {status === "done" && (
          <div style={statusBox}>
            <div style={checkmark}>&#10003;</div>
            <div style={{ ...statusText, color: "#4ade80" }}>UNLOCKED!</div>
            <div style={statusSub}>{items.length === 1 ? `${items[0].label} is now permanently yours` : `${items.length} items are now permanently yours`}</div>
          </div>
        )}

        {status === "error" && (
          <div style={statusBox}>
            <div style={{ ...statusText, color: "#f87171" }}>ERROR</div>
            <div style={{ ...statusSub, color: "#fca5a5" }}>{errorMsg}</div>
            <button onClick={() => setStatus("idle")} style={retryBtn}>
              TRY AGAIN
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>,
    document.body
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9000,
  animation: "fadeIn 0.2s ease-out",
};

const modal = {
  background: "rgba(20,20,28,0.97)",
  border: "1px solid #444",
  borderRadius: 6,
  padding: "20px 24px",
  maxWidth: 360,
  width: "calc(100vw - 48px)",
  fontFamily: "'Share Tech Mono', monospace",
  color: "#c8c0b4",
  animation: "fadeIn 0.25s ease-out",
};

const header = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "0.15em",
  color: "#d4a854",
  marginBottom: 16,
};

const headerIcon = {
  fontSize: 16,
};

const closeBtn = {
  marginLeft: "auto",
  background: "none",
  border: "none",
  color: "#888",
  fontSize: 20,
  cursor: "pointer",
  padding: "0 4px",
  fontFamily: "inherit",
};

const itemBox = {
  background: "rgba(212,168,84,0.08)",
  border: "1px solid rgba(212,168,84,0.25)",
  borderRadius: 4,
  padding: "10px 14px",
  marginBottom: 16,
};

const itemRow = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "3px 0",
};

const itemLabel = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.08em",
  color: "#e8e0d4",
  flex: 1,
};

const itemCat = {
  fontSize: 9,
  letterSpacing: "0.08em",
  color: "#8a8070",
};

const itemPrice = {
  fontSize: 12,
  fontWeight: 600,
  color: "#d4a854",
  minWidth: 28,
  textAlign: "right",
};

const totalRow = {
  display: "flex",
  alignItems: "center",
  borderTop: "1px solid rgba(212,168,84,0.25)",
  marginTop: 6,
  paddingTop: 6,
};

const totalLabel = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.12em",
  color: "#e8e0d4",
  flex: 1,
};

const totalPrice = {
  fontSize: 14,
  fontWeight: 700,
  color: "#d4a854",
};

const itemSub = {
  fontSize: 9,
  letterSpacing: "0.1em",
  color: "#8a8070",
  textAlign: "center",
  marginTop: 6,
};

const sectionLabel = {
  fontSize: 10,
  letterSpacing: "0.15em",
  color: "#8a8070",
  marginBottom: 6,
};

const toggleRow = {
  display: "flex",
  gap: 8,
  marginBottom: 12,
};

const toggleBtn = {
  flex: 1,
  padding: "10px 8px",
  background: "rgba(60,60,70,0.4)",
  border: "1px solid #555",
  borderRadius: 4,
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  fontFamily: "'Share Tech Mono', monospace",
  transition: "all 0.15s",
};

const toggleActive = {
  ...toggleBtn,
  background: "rgba(212,168,84,0.15)",
  border: "1px solid #d4a854",
};

const priceNum = {
  fontSize: 18,
  fontWeight: 700,
  color: "#e8e0d4",
  letterSpacing: "0.05em",
};

const priceUnit = {
  fontSize: 9,
  letterSpacing: "0.12em",
  color: "#8a8070",
};

const priceDollar = {
  fontSize: 9,
  letterSpacing: "0.06em",
  color: "#8a8070",
  opacity: 0.7,
  marginTop: 2,
};

const burnNote = {
  fontSize: 10,
  color: "#d4a854",
  textAlign: "center",
  marginBottom: 12,
  opacity: 0.7,
  letterSpacing: "0.04em",
};

const purchaseBtn = {
  width: "100%",
  padding: "10px 0",
  background: "#d4a854",
  border: "1px solid #b8922e",
  borderRadius: 3,
  color: "#1a1a1f",
  fontFamily: "'Share Tech Mono', monospace",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.12em",
  cursor: "pointer",
  transition: "all 0.15s",
};

const statusBox = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 8,
  padding: "20px 0 8px",
};

const spinner = {
  width: 28,
  height: 28,
  border: "2px solid #444",
  borderTopColor: "#d4a854",
  borderRadius: "50%",
  animation: "spin 1s linear infinite",
};

const statusText = {
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "0.12em",
  color: "#e8e0d4",
};

const statusSub = {
  fontSize: 10,
  color: "#8a8070",
  letterSpacing: "0.06em",
  textAlign: "center",
};

const checkmark = {
  fontSize: 32,
  color: "#4ade80",
};

const retryBtn = {
  marginTop: 8,
  padding: "6px 16px",
  background: "rgba(60,60,70,0.5)",
  border: "1px solid #555",
  borderRadius: 3,
  color: "#c8c0b4",
  fontFamily: "'Share Tech Mono', monospace",
  fontSize: 10,
  letterSpacing: "0.1em",
  cursor: "pointer",
};
