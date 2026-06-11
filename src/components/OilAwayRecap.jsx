"use client";

import { useState, useEffect, useRef } from "react";

// ── WHILE YOU WERE AWAY ──────────────────────────────────────────────────────
// The landing recap for a returning player — the payoff moment of the whole
// "check back" loop. Shown once per absence (page.js computes the diff against
// a localStorage baseline and decides whether there's anything worth showing).
//
// Mobile: bottom sheet sliding up. Desktop: centered card. Everything reads
// from the recap object computed in page.js — this component is pure display.
//
// recap = {
//   awayMs, fromDepth, toDepth, strikes: [{layer, oil}], oilGained, hellHit,
//   tank, tankDelta, bankedDelta, fieldEvents: [{type, username, detail}],
//   fieldEventCount, unreadCount, demo?
// }

function formatAway(ms) {
  const m = Math.floor(ms / 60000);
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

// Ease-out count-up for the hero number — the little dopamine ramp.
function useCountUp(target, ms = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) { setV(0); return; }
    let raf;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const EVENT_META = {
  strike:     { icon: "⛏", verb: "struck paydirt" },
  gusher:     { icon: "◉", verb: "hit a GUSHER" },
  motherlode: { icon: "★", verb: "hit the MOTHERLODE" },
  hell:       { icon: "▲", verb: "cracked a hell pocket" },
  contain:    { icon: "✠", verb: "banished the demon" },
  claim:      { icon: "⚑", verb: "staked a claim" },
  rogue:      { icon: "☣", verb: "rogue intrusion" },
  system:     { icon: "◆", verb: "" },
};

export default function OilAwayRecap({
  recap,
  theme,
  isMobile,
  usdRate = 0,      // $ per oil unit (pot ÷ OIL_FIELD_UNITS)
  tankHeavy = false,
  referralCode = null, // baked into the share link — every share recruits
  onBank,           // optional — wired to the tank-drain handler
  onClose,
}) {
  const heroOil = useCountUp(recap?.oilGained || 0);
  const cardRef = useRef(null);
  const [shareNote, setShareNote] = useState(null);

  // Share the recap card itself: rendered card → PNG to clipboard → X compose
  // with the referral link (same pattern as the claim-certificate share).
  const shareStrike = async () => {
    try {
      setShareNote("Capturing…");
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: "#140b1c", useCORS: true });
      const pngBlob = await new Promise((r) => canvas.toBlob(r, "image/png"));
      let copied = false;
      if (pngBlob && navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
          copied = true;
        } catch { /* clipboard blocked — text share still works */ }
      }
      setShareNote(copied ? "Card copied! Paste it into your post (Cmd+V)" : null);
      if (copied) await new Promise((r) => setTimeout(r, 1200));
      const usdTxt = usdRate > 0 && recap.oilGained > 0 ? ` (≈ $${(recap.oilGained * usdRate).toFixed(2)})` : "";
      const text = `My rig struck ${recap.oilGained.toLocaleString()} Lyquid80${usdTxt} while I was away ⛏ Hail Mary Prospecting Co.\n\nrl80.com/hailmary${referralCode ? `?ref=${referralCode}` : ""}`;
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "width=550,height=420");
      setTimeout(() => setShareNote(null), 4000);
    } catch (err) {
      console.error("recap share failed:", err);
      setShareNote(null);
    }
  };

  if (!recap) return null;

  const mono = "'Share Tech Mono', monospace";
  const gold = theme?.gold || "#d4a854";
  const muted = theme?.muted || "#9e8e78";
  const text = theme?.text || "#e8dcc8";
  const green = theme?.green || "#5a8a3a";
  const red = theme?.red || "#b8402c";
  const border = theme?.border || "rgba(212,168,84,0.25)";

  const usd = (oil) => (usdRate > 0 ? `≈ $${(oil * usdRate).toFixed(2)}` : null);
  const layersGround = Math.max(0, recap.toDepth - recap.fromDepth);
  const bestStrike = recap.strikes.length
    ? recap.strikes.reduce((a, b) => (b.oil > a.oil ? b : a))
    : null;

  const sectionLabel = {
    fontSize: isMobile ? 10 : 9, letterSpacing: "0.2em", color: muted, margin: "14px 0 8px",
    paddingBottom: 4, borderBottom: `1px solid ${border}`, fontFamily: mono,
  };
  const row = { display: "flex", alignItems: "baseline", gap: 8, fontSize: isMobile ? 12 : 11, color: text, fontFamily: mono, marginBottom: 6, lineHeight: 1.5 };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9998,
        // Light dim only — the field (and any strike visual) stays visible as
        // the backdrop frame; the card carries its own contrast.
        background: "rgba(8, 4, 12, 0.55)",
        backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        animation: "oilRecapFade 0.25s ease-out",
      }}
    >
      <style>{`
        @keyframes oilRecapFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes oilRecapUp { from { transform: translateY(24px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
      <div
        ref={cardRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? "min(100%, 420px)" : 440,
          maxHeight: "86vh",
          overflowY: "auto",
          background: "linear-gradient(180deg, #1c1024, #140b1c)",
          border: `1px solid ${gold}55`,
          borderRadius: 10,
          padding: isMobile ? "20px 18px 18px" : "22px 24px",
          boxShadow: `0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.4), 0 0 32px ${gold}18`,
          animation: "oilRecapUp 0.3s ease-out",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: isMobile ? 16 : 17, fontWeight: 700, letterSpacing: "0.12em", color: gold, fontFamily: mono }}>
              ⛏ WHILE YOU WERE AWAY
            </div>
            <div style={{ fontSize: 10, letterSpacing: "0.12em", color: muted, marginTop: 3, fontFamily: mono }}>
              {formatAway(recap.awayMs)} ON THE CLOCK{recap.demo ? " · DEMO DATA" : ""}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "none", border: "none", color: muted, fontSize: 18, cursor: "pointer", padding: 4, lineHeight: 1 }}
          >✕</button>
        </div>

        {/* Hero — the haul (or the honest dry read) */}
        <div style={{ textAlign: "center", margin: "16px 0 4px" }}>
          {recap.oilGained > 0 ? (
            <>
              <div style={{ fontSize: isMobile ? 44 : 42, fontWeight: 700, color: gold, fontFamily: mono, lineHeight: 1, textShadow: `0 0 18px ${gold}44` }}>
                +{heroOil.toLocaleString()}
              </div>
              <div style={{ fontSize: isMobile ? 11 : 10, letterSpacing: "0.25em", color: muted, marginTop: 5, fontFamily: mono }}>
                LYQUID80 STRUCK {usd(recap.oilGained) ? `· ${usd(recap.oilGained)}` : ""}
              </div>
            </>
          ) : layersGround > 0 ? (
            <div style={{ fontSize: isMobile ? 13 : 12, color: muted, fontFamily: mono, fontStyle: "italic", lineHeight: 1.6 }}>
              {layersGround} layer{layersGround === 1 ? "" : "s"} of dry shale —<br />the vein is still down there.
            </div>
          ) : null}
        </div>

        {/* Your rig */}
        <div style={sectionLabel}>YOUR RIG</div>
        {layersGround > 0 && (
          <div style={row}>
            <span style={{ color: gold }}>▸</span>
            <span>ground <b>{layersGround}</b> layer{layersGround === 1 ? "" : "s"} deeper — depth {recap.fromDepth} → <b>{recap.toDepth}</b></span>
          </div>
        )}
        {recap.strikes.length > 0 && (
          <div style={row}>
            <span style={{ color: gold }}>▸</span>
            <span>
              <b>{recap.strikes.length}</b> strike{recap.strikes.length === 1 ? "" : "s"}
              {bestStrike ? <> — best <b style={{ color: gold }}>{bestStrike.oil.toLocaleString()}</b> at depth {bestStrike.layer + 1}</> : null}
            </span>
          </div>
        )}
        {recap.hellHit && (
          <div style={{ ...row, color: red }}>
            <span>▲</span>
            <span style={{ color: red }}>you cracked a <b>hell pocket</b> — something got out</span>
          </div>
        )}
        {recap.bankedDelta > 0 && (
          <div style={row}>
            <span style={{ color: green }}>▸</span>
            <span><b style={{ color: green }}>+{recap.bankedDelta.toLocaleString()}</b> banked while away {usd(recap.bankedDelta) ? `(${usd(recap.bankedDelta)})` : ""}</span>
          </div>
        )}
        <div style={{ ...row, marginTop: 8, padding: "8px 10px", border: `1px solid ${tankHeavy ? red : border}`, borderRadius: 3, background: tankHeavy ? `${red}14` : "rgba(212,168,84,0.06)", justifyContent: "space-between" }}>
          <span style={{ color: tankHeavy ? red : muted, fontSize: 10, letterSpacing: "0.1em" }}>
            TANK · UNBANKED
          </span>
          <span style={{ color: tankHeavy ? red : text, fontWeight: 700 }}>
            {(recap.tank ?? 0).toLocaleString()} {usd(recap.tank) ? <span style={{ fontWeight: 400, color: muted }}> {usd(recap.tank)}</span> : null}
          </span>
        </div>
        {tankHeavy && onBank && (
          <button
            onClick={() => { onBank(); onClose(); }}
            style={{
              width: "100%", marginTop: 2, marginBottom: 4, padding: "10px 12px",
              background: `linear-gradient(180deg, ${red}, #8a2a1e)`, border: `1px solid ${red}`,
              borderRadius: 3, color: "#fff", fontFamily: mono, fontSize: 11, fontWeight: 700,
              letterSpacing: "0.12em", cursor: "pointer",
            }}
          >
            ⚠ TANK HEAVY — BANK IT NOW
          </button>
        )}

        {/* The field */}
        {(recap.fieldEventCount > 0 || recap.unreadCount > 0) && (
          <>
            <div style={sectionLabel}>THE FIELD</div>
            {recap.fieldEvents.map((ev, i) => {
              const meta = EVENT_META[ev.type] || EVENT_META.system;
              return (
                <div key={i} style={row}>
                  <span style={{ color: gold, minWidth: 12, textAlign: "center" }}>{meta.icon}</span>
                  <span style={{ color: muted }}>
                    {ev.type === "system"
                      ? <span style={{ letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 10 }}>{ev.detail || "season event"}</span>
                      : <><b style={{ color: text }}>{ev.username || "a prospector"}</b> {meta.verb}{ev.detail ? <i> — {ev.detail}</i> : null}</>}
                  </span>
                </div>
              );
            })}
            {recap.fieldEventCount > recap.fieldEvents.length && (
              <div style={{ ...row, color: muted, fontSize: 10 }}>
                <span style={{ minWidth: 12 }} />
                <span>…and {recap.fieldEventCount - recap.fieldEvents.length} more in FIELD ACTIVITY</span>
              </div>
            )}
            {recap.unreadCount > 0 && (
              <div style={row}>
                <span style={{ color: gold, minWidth: 12, textAlign: "center" }}>✉</span>
                <span><b>{recap.unreadCount}</b> plot{recap.unreadCount === 1 ? " has" : "s have"} new messages for you</span>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        {recap.oilGained > 0 && (
          <button
            onClick={shareStrike}
            disabled={!!shareNote}
            style={{
              width: "100%", marginTop: 16, padding: "10px 12px",
              background: "transparent", border: `1px solid ${gold}`,
              borderRadius: 3, color: gold, fontFamily: mono, fontSize: 11, fontWeight: 700,
              letterSpacing: "0.12em", cursor: "pointer",
            }}
          >
            {shareNote || "📸 SHARE THIS STRIKE"}
          </button>
        )}
        <button
          onClick={onClose}
          style={{
            width: "100%", marginTop: recap.oilGained > 0 ? 8 : 16, padding: "13px 12px",
            background: `linear-gradient(180deg, ${gold}, #b8922e)`, border: `1px solid ${gold}`,
            borderRadius: 3, color: "#fff", fontFamily: mono, fontSize: 12, fontWeight: 700,
            letterSpacing: "0.15em", cursor: "pointer",
          }}
        >
          BACK TO THE FIELD →
        </button>
      </div>
    </div>
  );
}
