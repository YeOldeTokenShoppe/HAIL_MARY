"use client";

// Right-hand panel of the /main triptych — "YOUR VIGIL".
// Counterweights the Confessional (left) around the Our Lady portrait (center):
//   · live RL80 price (from useCandles → marketData/rl80)
//   · the user's own lit votive candle (their saint image + wax tint)
//   · their dedication + when they lit it, or a "Light a candle" CTA
//   · a short feed of recent offerings from the shrine
//
// Desktop/iPad only — the parent gates rendering on a wide viewport. The 3D
// votive lives in its own capped-DPR canvas (PanelVotive) so it doesn't fight
// the neon-frame R3F canvas or the SitePal embed for GPU on smaller devices.

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useAccount, useReadContract } from "wagmi";
import { erc20Abi } from "viem";
import { RL80_ADDRESS } from "@/lib/contracts";
import { useCandles } from "@/hooks/useCandles";
import {
  readCandle,
  readCandlePrefs,
  subscribeLitCandles,
  lightCandle,
  extinguishCandle,
  dedicateCandle,
  writeCandlePrefs,
} from "@/lib/candleRitual";
import { readLocalCandle, writeLocalCandle, clearLocalCandle } from "@/lib/localCandle";
import { intentionText, toIntentionKeys } from "@/lib/intentions";
import {
  VOTIVE_IMAGE_STORAGE_PREFIX,
  writeVotiveImage,
  writeVotiveTint,
  compressVotiveImage,
} from "@/lib/candlePrefs";
import CandleCustomizePicker from "@/components/CandleCustomizePicker";
import { UnifiedAccountModal } from "@/components/UnifiedAccountModal";
import BuyModal from "@/components/BuyModal";

// Real 3D votive — client-only, its own WebGL context. Loaded lazily so the
// panel's price/dedication paint immediately while the model streams in.
const PanelVotive = dynamic(() => import("@/components/PanelVotive"), {
  ssr: false,
  loading: () => <CandleNiche />,
});

const GOLD = "#d4af37";
const CYAN = "rgba(0, 255, 255, 0.6)";

// Compact "3d ago" / "5h ago" / "just now" relative time.
function timeAgo(ms) {
  if (!ms) return null;
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// DEX-style subscript-zero shorthand — RL80 trades far below $1 (~3.9e-8), so
// plain decimals collapse to "$0.00000". Mirrors VigilTicker.fmtPrice so the
// price reads the same across the site: $0.0₇385 = 7 zeros then 3 sig digits.
const SUBSCRIPT_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
function formatPrice(p) {
  if (typeof p !== "number" || !Number.isFinite(p) || p <= 0) return "—";
  let body;
  if (p >= 1) {
    body = p.toFixed(2);
  } else if (p >= 0.01) {
    body = p.toPrecision(3);
  } else {
    const exponent = Math.floor(Math.log10(p));
    let zeros = -exponent - 1;
    let mantissa = Math.round((p / Math.pow(10, exponent)) * 100);
    if (mantissa >= 1000) {
      mantissa = 100;
      zeros -= 1;
    }
    if (zeros <= 2) {
      body = p.toFixed(zeros + 3);
    } else {
      const zeroCount = String(zeros)
        .split("")
        .map((d) => SUBSCRIPT_DIGITS[+d])
        .join("");
      body = `0.0${zeroCount}${mantissa}`;
    }
  }
  return `$${body}`;
}

// Neutral niche placeholder shown while the 3D votive streams in.
function CandleNiche({ children }) {
  return (
    <div
      style={{
        position: "relative",
        height: 260,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse 60% 55% at 50% 42%, rgba(255,180,90,0.14), rgba(0,0,0,0) 70%)",
      }}
    >
      {children}
    </div>
  );
}

const Eyebrow = ({ children }) => (
  <div
    style={{
      fontSize: "0.55rem",
      letterSpacing: "0.28em",
      textTransform: "uppercase",
      color: "rgba(0, 255, 255, 0.55)",
      fontFamily: "'Cyber', 'Geo', sans-serif",
    }}
  >
    {children}
  </div>
);

export default function MainVigilPanel({ show = true }) {
  const { address, isConnected } = useAccount();
  const userId = isConnected && address ? address.toLowerCase() : null;

  const { latestPrice, priceChange24h } = useCandles({ count: 2, days: 1 });

  // RL80 holding gates the customization picker (cosmetics only) — mirrors the
  // landing page. Intentions/lighting stay free.
  const { data: rl80BalanceRaw } = useReadContract({
    address: RL80_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const hasRL80 = typeof rl80BalanceRaw === "bigint" && rl80BalanceRaw > 0n;

  const [candle, setCandle] = useState(null); // { litAtMs, intention, displayName }
  const [recent, setRecent] = useState([]);
  const [closeup, setCloseup] = useState(false); // click the votive → enlarge
  const tapStartRef = useRef({ x: 0, y: 0 }); // distinguish a tap (enlarge) from a drag (rotate)
  // Live cosmetics + dedications, edited in place via the shared picker. Seeded
  // from Firestore prefs / the candle doc on load; persisted through the same
  // candleRitual + candlePrefs helpers the landing page uses, so both stay in
  // sync (the two pages share the votive GLB cache — see PanelVotive).
  const [votiveImage, setVotiveImage] = useState(null);
  const [votiveTint, setVotiveTint] = useState(null);
  const [intentions, setIntentions] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [votiveUploadError, setVotiveUploadError] = useState(null);

  // Load the current user's candle + cosmetics (or the anon local candle).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (userId) {
        const [c, p] = await Promise.all([
          readCandle(userId).catch(() => null),
          readCandlePrefs(userId).catch(() => null),
        ]);
        if (!cancelled) {
          setCandle(c && c.litAtMs ? c : null);
          setVotiveImage(p?.votiveImage || null);
          setVotiveTint(p?.votiveTint || null);
          setIntentions(c?.intention ? toIntentionKeys(c.intention) : []);
        }
      } else {
        const local = readLocalCandle();
        if (!cancelled) {
          setCandle(local && local.litAtMs ? { litAtMs: local.litAtMs } : null);
          setVotiveImage(null);
          setVotiveTint(null);
          setIntentions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Live feed of recent offerings for the bottom of the panel.
  useEffect(() => {
    const unsub = subscribeLitCandles((list) => setRecent(list || []), 6);
    return () => unsub && unsub();
  }, []);

  if (!show) return null;

  const lit = !!candle?.litAtMs;
  const up = (priceChange24h ?? 0) >= 0;
  const dedication = candle?.intention ? intentionText(candle.intention) : null;
  const shortAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;
  const canCustomize = !!userId && hasRL80;

  // --- Candle actions (mirror the landing page's FAB, scoped to the panel) ---
  const doLight = () => {
    const now = Date.now();
    if (userId) {
      lightCandle(userId, { displayName: shortAddress, avatarUrl: null });
    } else {
      writeLocalCandle(now);
    }
    setIntentions([]);
    // Optimistic flip so the votive lights + PanelVotive mounts immediately.
    setCandle((prev) => ({
      ...(prev || {}),
      litAtMs: now,
      displayName: shortAddress || prev?.displayName || null,
      intention: null,
    }));
  };

  const doExtinguish = () => {
    if (userId) extinguishCandle(userId);
    else clearLocalCandle();
    setCandle(null);
    setIntentions([]);
    setShowPicker(false);
  };

  const toggleIntention = (key) => {
    const next = intentions.includes(key)
      ? intentions.filter((k) => k !== key)
      : [...intentions, key];
    setIntentions(next);
    setCandle((prev) => (prev ? { ...prev, intention: next.length ? next : null } : prev));
    if (userId) dedicateCandle(userId, next);
  };

  const handlePickImage = (src) => {
    if (!canCustomize) return;
    setVotiveUploadError(null);
    setVotiveImage(src ?? null);
    writeVotiveImage(userId, src ?? null);
    writeCandlePrefs(userId, { votiveImage: src ?? null });
  };

  const handleUpload = async (file) => {
    if (!file || !canCustomize) return;
    setVotiveUploadError(null);
    try {
      const compressed = await compressVotiveImage(file);
      try {
        window.localStorage.setItem(VOTIVE_IMAGE_STORAGE_PREFIX + userId, compressed);
      } catch {
        setVotiveUploadError(
          "Image too large to save on this device — try a smaller one.",
        );
        return;
      }
      setVotiveImage(compressed);
      const result = await writeCandlePrefs(userId, { votiveImage: compressed });
      if (result && !result.ok && result.reason === "image-too-large") {
        setVotiveUploadError(
          "Image saved on this device, but it's too large to sync to your other devices.",
        );
      }
    } catch {
      setVotiveUploadError("Couldn't read that image.");
    }
  };

  const handlePickTint = (hex) => {
    if (!canCustomize) return;
    setVotiveTint(hex ?? null);
    writeVotiveTint(userId, hex ?? null);
    writeCandlePrefs(userId, { votiveTint: hex ?? null });
  };

  // Button under the votive, mirroring the landing FAB:
  //   unlit → light · lit+signed-in → customize · lit+anon → connect to save.
  const onCandleButton = () => {
    if (!lit) {
      doLight();
      return;
    }
    if (userId) {
      setShowPicker(true);
      return;
    }
    setShowAccountModal(true);
  };

  return (
    <aside
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 88,
        width: "clamp(300px, 24vw, 380px)",
        zIndex: 95,
        display: "flex",
        flexDirection: "column",
        gap: 18,
        padding: "22px 20px",
        overflowY: "auto",
        overflowX: "hidden",
        fontFamily: "'Cyber', 'Geo', sans-serif",
        color: "#e8f6f6",
        background: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "saturate(180%) blur(8px)",
        WebkitBackdropFilter: "saturate(180%) blur(8px)",
        borderLeft: "1px solid rgba(0, 255, 255, 0.2)",
        boxShadow: "inset 1px 0 0 rgba(0, 255, 255, 0.05)",
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <Eyebrow>Your Vigil</Eyebrow>
      </div>

      {/* ── RL80 price ── */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid rgba(0, 255, 255, 0.1)",
        }}
      >
        <span style={{ fontSize: "0.7rem", letterSpacing: "0.15em", color: GOLD }}>RL80</span>
        <span style={{ fontFamily: "Orbitron, sans-serif", fontSize: "1.35rem", fontWeight: 800, color: "#fff" }}>
          {formatPrice(latestPrice)}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.75rem",
            fontWeight: 700,
            color: up ? "#39d98a" : "#ff5c7a",
          }}
        >
          {up ? "▲" : "▼"} {Math.abs(priceChange24h ?? 0).toFixed(1)}%
        </span>
      </div>

      {/* ── The user's candle ── */}
      {lit ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            role="button"
            tabIndex={0}
            aria-label="Enlarge your candle"
            title="Drag to rotate · click to enlarge"
            onPointerDown={(e) => {
              tapStartRef.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerUp={(e) => {
              // A tap (barely moved) enlarges; a real drag rotated the votive
              // instead, so don't open the close-up.
              const dx = e.clientX - tapStartRef.current.x;
              const dy = e.clientY - tapStartRef.current.y;
              if (Math.hypot(dx, dy) < 8) setCloseup(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setCloseup(true);
              }
            }}
            style={{ cursor: "grab", display: "block", borderRadius: 10 }}
          >
            <CandleNiche>
              <PanelVotive votiveImage={votiveImage} votiveTint={votiveTint} height={260} draggable />
            </CandleNiche>
          </div>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 6 }}>
            {dedication && (
              <div style={{ fontSize: "0.85rem", color: "#f3ede0", lineHeight: 1.4 }}>
                “{dedication}”
              </div>
            )}
            <div
              style={{
                fontSize: "0.6rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "rgba(0, 255, 255, 0.4)",
              }}
            >
              Your flame · lit {timeAgo(candle?.litAtMs)}
            </div>
            {/* Discreet round edit button — a lit candle shouldn't shout a
                text CTA; the pencil invites customization without competing
                with the flame. Anon taps route to connect-to-save. */}
            <button
              type="button"
              onClick={onCandleButton}
              title={userId ? "Customize candle" : "Connect to save & customize"}
              aria-label={userId ? "Customize candle" : "Connect to save & customize"}
              style={{
                marginTop: 2,
                alignSelf: "center",
                width: 30,
                height: 30,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                cursor: "pointer",
                color: "rgba(212, 175, 55, 0.85)",
                background: "rgba(212, 175, 55, 0.08)",
                border: "1px solid rgba(212, 175, 55, 0.35)",
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ width: 14, height: 14 }}
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        // Unlit: show the (dark) votive with its default saint image so the
        // niche reads as a ready-to-light candle — like the shrine — instead of
        // an empty placeholder. Small CTA below lights it in place.
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <CandleNiche>
            <PanelVotive
              lit={false}
              votiveImage={votiveImage}
              votiveTint={votiveTint}
              height={260}
              draggable
            />
          </CandleNiche>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                fontSize: "0.6rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "rgba(255, 211, 107, 0.45)",
              }}
            >
              Your candle · unlit
            </div>
            <button
              type="button"
              onClick={onCandleButton}
              style={{
                alignSelf: "center",
                padding: "8px 20px",
                borderRadius: 999,
                fontSize: "0.66rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 700,
                cursor: "pointer",
                color: "#0a0a0f",
                background: GOLD,
                border: "none",
                boxShadow: "0 0 16px rgba(212,175,55,0.4)",
              }}
            >
              Light a candle
            </button>
          </div>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* ── Recent offerings ── */}
      {recent.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Eyebrow>Recent offerings</Eyebrow>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {recent.slice(0, 4).map((c, i) => (
              <div
                key={c.userId || i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "0.72rem",
                  color: "rgba(232,246,246,0.75)",
                }}
              >
                <span style={{ color: "#ffb347" }}>✦</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.displayName || "A pilgrim"}
                </span>
                <span style={{ marginLeft: "auto", color: "rgba(0,255,255,0.35)", whiteSpace: "nowrap" }}>
                  {timeAgo(c.litAtMs || c.litAt?.toMillis?.())}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Close-up ── click the votive to inspect it large (drag to rotate) ── */}
      {closeup && lit && (
        <div
          onClick={() => setCloseup(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10050,
            background: "rgba(3, 3, 8, 0.82)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 14,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(560px, 88vw)",
              height: "min(70vh, 680px)",
              cursor: "grab",
            }}
          >
            <PanelVotive votiveImage={votiveImage} votiveTint={votiveTint} height="100%" draggable />
          </div>
          {dedication && (
            <div style={{ maxWidth: 460, textAlign: "center", fontSize: "1rem", color: "#f3ede0", lineHeight: 1.5 }}>
              “{dedication}”
            </div>
          )}
          <div
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(0,255,255,0.4)",
            }}
          >
            Drag to rotate · click anywhere to close
          </div>
        </div>
      )}

      {/* ── Customize modal — same picker the landing FAB opens, shared via
          CandleCustomizePicker. Cosmetics gated on holding RL80; intentions
          free. Persists through candleRitual + candlePrefs so edits made here
          show up on the shrine and vice-versa. ── */}
      <CandleCustomizePicker
        open={showPicker}
        placement="modal"
        onClose={() => setShowPicker(false)}
        canCustomize={canCustomize}
        candleLit={lit}
        votiveImage={votiveImage}
        votiveTint={votiveTint}
        intentions={intentions}
        votiveUploadError={votiveUploadError}
        onToggleIntention={toggleIntention}
        onPickImage={handlePickImage}
        onUploadImage={handleUpload}
        onPickTint={handlePickTint}
        onExtinguish={() => {
          setShowPicker(false);
          doExtinguish();
        }}
        onBuyRL80={() => {
          setShowPicker(false);
          setShowBuyModal(true);
        }}
      />

      {/* Wallet connect / account — opened by the lit+anon "connect to save"
          button. */}
      <UnifiedAccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        initialTab="wallet"
        theme="cyber"
      />

      {/* Buy RL80 — opened by the picker's lock CTA (signed in, no RL80). */}
      <BuyModal isOpen={showBuyModal} onClose={() => setShowBuyModal(false)} />
    </aside>
  );
}
