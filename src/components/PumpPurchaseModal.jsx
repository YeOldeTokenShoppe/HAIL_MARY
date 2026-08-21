"use client";

import React, { useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { getItemPrice, getItemCategory } from "@/lib/oilPremium";
import { useWalletClient, useReadContract } from "wagmi";
import { erc20Abi } from "viem";
import { wrapFetchWithPayment } from "x402-fetch";

const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const BASE_CHAIN_ID = 8453;

// items = array of { id, label, category }
export default function PumpPurchaseModal({ items, activeAccount, userId, onComplete, onClose, onConnectWallet, onGetUsdc }) {
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const { data: walletClient } = useWalletClient();

  const totalUsdc = useMemo(() => {
    let sum = 0;
    for (const item of items) {
      const p = getItemPrice(item.id);
      if (p) sum += p.usdc;
    }
    return sum;
  }, [items]);

  // Pre-check USDC balance on Base so we can offer the Onramp fallback
  // before the user signs a payment that would fail at settle time.
  const { data: usdcBalanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: activeAccount ? [activeAccount] : undefined,
    chainId: BASE_CHAIN_ID,
    query: { enabled: !!activeAccount, refetchInterval: 30_000 },
  });
  const usdcBalance = usdcBalanceRaw ? Number(usdcBalanceRaw) / 1_000_000 : null;
  const insufficient = activeAccount && usdcBalance != null && usdcBalance < totalUsdc;
  const shortfall = insufficient ? Math.max(0, totalUsdc - usdcBalance) : 0;

  const handlePurchase = useCallback(async () => {
    if (!walletClient || !activeAccount) return onConnectWallet?.();
    if (totalUsdc <= 0) return;

    setStatus("processing");
    setErrorMsg("");

    try {
      // Allow up to $1 over the ask to absorb any rounding the facilitator
      // applies; this is the maxValue the x402-fetch wrapper will sign for.
      const maxValue = BigInt((totalUsdc + 1) * 1_000_000);
      const fetchWithPay = wrapFetchWithPayment(fetch, walletClient, maxValue);

      const res = await fetchWithPay("/api/oil-purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, itemIds: items.map((i) => i.id) }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Server returned ${res.status}`);
      }

      setStatus("done");
      setTimeout(() => onComplete?.(items.map((i) => i.id)), 1200);
    } catch (err) {
      const msg = err?.message || "Payment failed";
      if (/rejected|denied|cancelled|user denied/i.test(msg)) {
        setStatus("idle");
      } else if (/insufficient[_ ]funds|insufficient.*balance|exceeds balance/i.test(msg)) {
        setStatus("insufficient");
      } else {
        setStatus("error");
        setErrorMsg(msg.slice(0, 160));
      }
    }
  }, [walletClient, activeAccount, totalUsdc, items, userId, onComplete, onConnectWallet]);

  const isProcessing = status === "processing";

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

        {/* Pay action */}
        {status === "idle" && (
          <>
            <div style={sectionLabel}>PAY WITH</div>
            <div style={payCard}>
              <span style={priceNum}>${totalUsdc}</span>
              <span style={priceUnit}>USDC ON BASE</span>
            </div>

            {insufficient && onGetUsdc ? (
              <>
                <div style={shortfallNote}>
                  You have ${usdcBalance.toFixed(2)} USDC on Base — need ${shortfall.toFixed(2)} more.
                </div>
                <button onClick={onGetUsdc} style={purchaseBtn}>
                  GET USDC
                </button>
                <div style={x402Note}>
                  Buy USDC with a card via Coinbase, then return here to pay.
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={activeAccount ? handlePurchase : onConnectWallet}
                  style={purchaseBtn}
                >
                  {activeAccount ? "PAY NOW" : "CONNECT WALLET"}
                </button>
                <div style={x402Note}>
                  One signature — no separate transaction. Powered by x402.
                </div>
              </>
            )}
          </>
        )}

        {/* Status displays */}
        {status === "processing" && (
          <div style={statusBox}>
            <div style={spinner} />
            <div style={statusText}>PROCESSING PAYMENT...</div>
            <div style={statusSub}>Sign in your wallet, then settling on Base</div>
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

        {status === "insufficient" && (
          <div style={statusBox}>
            <div style={{ ...statusText, color: "#d4a854" }}>INSUFFICIENT USDC</div>
            <div style={statusSub}>You need ${totalUsdc} USDC on Base to pay.</div>
            {onGetUsdc && (
              <button onClick={onGetUsdc} style={{ ...purchaseBtn, marginTop: 10 }}>
                GET USDC
              </button>
            )}
            <button onClick={() => setStatus("idle")} style={retryBtn}>
              BACK
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
  width: "calc((100vw - 48px) / var(--hm-ui-scale, 1))",
  zoom: "var(--hm-ui-scale, 1)",
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

const payCard = {
  padding: "12px 8px",
  background: "rgba(212,168,84,0.15)",
  border: "1px solid #d4a854",
  borderRadius: 4,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
  marginBottom: 12,
  fontFamily: "'Share Tech Mono', monospace",
};

const priceNum = {
  fontSize: 22,
  fontWeight: 700,
  color: "#e8e0d4",
  letterSpacing: "0.05em",
};

const priceUnit = {
  fontSize: 9,
  letterSpacing: "0.12em",
  color: "#8a8070",
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

const x402Note = {
  fontSize: 9,
  color: "#8a8070",
  textAlign: "center",
  marginTop: 8,
  opacity: 0.7,
  letterSpacing: "0.04em",
};

const shortfallNote = {
  fontSize: 11,
  color: "#d4a854",
  textAlign: "center",
  marginBottom: 10,
  letterSpacing: "0.04em",
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
