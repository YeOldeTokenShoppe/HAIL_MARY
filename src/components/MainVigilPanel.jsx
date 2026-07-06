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
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAccount } from "wagmi";
import { useCandles } from "@/hooks/useCandles";
import { readCandle, readCandlePrefs, subscribeLitCandles } from "@/lib/candleRitual";
import { readLocalCandle } from "@/lib/localCandle";
import { intentionText } from "@/lib/intentions";

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

  const [candle, setCandle] = useState(null); // { litAtMs, intention, displayName }
  const [prefs, setPrefs] = useState(null); // { votiveImage, votiveTint }
  const [recent, setRecent] = useState([]);
  const [closeup, setCloseup] = useState(false); // click the votive → enlarge
  const tapStartRef = useRef({ x: 0, y: 0 }); // distinguish a tap (enlarge) from a drag (rotate)

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
          setPrefs(p || null);
        }
      } else {
        const local = readLocalCandle();
        if (!cancelled) {
          setCandle(local && local.litAtMs ? { litAtMs: local.litAtMs } : null);
          setPrefs(null);
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
  // null → keep the votive's baked saint decal; a pref path/data-URL overrides it.
  const votiveImage = prefs?.votiveImage || null;
  const votiveTint = prefs?.votiveTint || null;
  const dedication = candle?.intention ? intentionText(candle.intention) : null;

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
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "28px 16px",
            textAlign: "center",
            borderRadius: 10,
            border: "1px dashed rgba(255, 211, 107, 0.25)",
            background:
              "radial-gradient(ellipse 70% 60% at 50% 30%, rgba(255,180,90,0.08), rgba(0,0,0,0) 70%)",
          }}
        >
          <div
            style={{
              fontFamily: "UnifrakturCook, serif",
              fontSize: "1.4rem",
              color: GOLD,
            }}
          >
            No candle lit
          </div>
          <p style={{ fontSize: "0.78rem", color: "rgba(232,246,246,0.6)", margin: 0, lineHeight: 1.5 }}>
            Light one at the shrine and your flame will keep vigil here.
          </p>
          <Link
            href="/"
            style={{
              marginTop: 4,
              padding: "9px 18px",
              borderRadius: 999,
              fontSize: "0.7rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: "#0a0a0f",
              background: GOLD,
              textDecoration: "none",
              boxShadow: "0 0 16px rgba(212,175,55,0.4)",
            }}
          >
            Light a candle
          </Link>
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
    </aside>
  );
}
