"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

// Shared claim-certificate renderer + share pipeline (X / copy / download /
// native share via html2canvas — same capture pattern as PolaroidSnapshot).
// Two variants:
//   "hero"  — full-size inline certificate + share row (the OilQualify lobby).
//   "thumb" — small scaled-down certificate; click → Polaroid-style lightbox
//             (blur backdrop, ✕, Escape) with the share row under the
//             enlarged certificate (the field's pre-season panel).
//
// Storage coords are 0-indexed; every player-facing coordinate is 1-indexed.

const CERT_W = 480; // tuned render width — overlay %/px positions assume it
const CERT_RATIO = 503 / 400; // ClaimCertificate.webp intrinsic 400×503

function toClaimDate(raw) {
  if (!raw) return null;
  if (typeof raw.toDate === "function") return raw.toDate(); // Firestore Timestamp
  if (raw.seconds) return new Date(raw.seconds * 1000); // serialized Timestamp
  const d = new Date(raw); // ISO string (oilPlots.ownerHistory.claimedAt) / Date
  return Number.isNaN(d.getTime()) ? null : d;
}

// The certificate art + dynamic field overlays. `responsive` keeps the lobby's
// viewport-relative mobile font tuning; the thumb's inner render uses fixed px
// at CERT_W and scales the whole thing with a CSS transform instead.
function CertArt({ innerRef, claimId, grantedTo, plotCol, plotRow, pickedRaw, isMobile, responsive, style }) {
  const certFont = "'Share Tech Mono', monospace";
  const inkColor = "#3a2a18";
  const placeholderColor = "rgba(58, 42, 24, 0.32)";
  const rot = "rotate(-5.5deg)";
  const fieldStyle = {
    position: "absolute",
    fontFamily: certFont,
    whiteSpace: "nowrap",
    pointerEvents: "none",
    transform: rot,
  };
  const hasPlot = plotCol != null && plotRow != null;
  const claimDate = toClaimDate(pickedRaw) || new Date(); // today = preview before the plot is locked in
  const dateStr = claimDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const fz = (mobileVw, px) => (responsive && isMobile ? mobileVw : px);
  return (
    <div ref={innerRef} style={{ position: "relative", borderRadius: 4, overflow: "hidden", ...style }}>
      <img src="/ClaimCertificate.webp" alt="Claim Certificate" style={{ width: "100%", display: "block" }} />
      <div style={{ ...fieldStyle, top: "52%", left: "50%", fontSize: fz("2.8vw", 14), fontWeight: 700, color: claimId ? inkColor : placeholderColor }}>
        {claimId || "[ CLAIM ID ]"}
      </div>
      <div style={{ ...fieldStyle, top: "60%", left: "60%", fontSize: fz("2.8vw", 14), fontWeight: 700, color: hasPlot ? inkColor : placeholderColor }}>
        {hasPlot ? `(${plotCol + 1}, ${plotRow + 1})` : "( COL , ROW )"}
      </div>
      <div style={{ ...fieldStyle, top: "69%", left: "60%", fontSize: fz("2.8vw", 14), fontWeight: 700, color: grantedTo ? inkColor : placeholderColor }}>
        {grantedTo || "[ YOUR NAME ]"}
      </div>
      <div style={{ ...fieldStyle, top: "83%", left: "40%", fontSize: fz("2.4vw", 12), fontWeight: 700, color: pickedRaw ? inkColor : placeholderColor }}>
        {dateStr}
      </div>
      {/* Authorizing signature — issued/signed by the company, not the player */}
      <div style={{
        position: "absolute", top: "82%", right: "20%",
        fontFamily: "'Homemade Apple', cursive",
        fontSize: fz("0.5em", 15),
        color: inkColor, pointerEvents: "none", transform: rot,
        opacity: 0.85, whiteSpace: "nowrap",
      }}>
        Mary
      </div>
    </div>
  );
}

export default function OilClaimCertificate({
  user,
  walletAddress,
  plotCol, // 0-indexed (raw storage value)
  plotRow,
  pickedAt, // Firestore Timestamp | {seconds} | ISO string | Date | null
  referralCode, // real oilDrills code when available; falls back to the legacy wallet-derived one
  theme,
  isMobile = false,
  variant = "hero",
  showShare = true,
  thumbWidth = 132,
}) {
  const [shareNote, setShareNote] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const certRef = useRef(null);
  const mono = "'Share Tech Mono', monospace";

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e) => { if (e.key === "Escape") setLightboxOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  const claimId = walletAddress
    ? walletAddress.slice(0, 10).toUpperCase()
    : user?.id
    ? user.id.slice(0, 10).toUpperCase()
    : null;
  const grantedTo = user?.fullName || user?.firstName || (user ? "Anonymous" : null);
  const refCode = referralCode || (walletAddress ? walletAddress.slice(2, 10).toLowerCase() : user?.id?.slice(0, 8));

  const capturePng = async () => {
    const { default: html2canvas } = await import("html2canvas");
    return html2canvas(certRef.current, { scale: 2, backgroundColor: null, useCORS: true });
  };

  const shareOnX = async () => {
    try {
      setShareNote("Capturing image...");
      const canvas = await capturePng();
      // Re-draw onto a fresh canvas to get a clean PNG blob (same pattern as PolaroidSnapshot)
      const img = new Image();
      img.src = canvas.toDataURL("image/png");
      await new Promise((r) => { img.onload = r; img.onerror = r; });
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      const pngBlob = await new Promise((r) => c.toBlob(r, "image/png"));

      let clipboardOk = false;
      if (pngBlob && navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
          clipboardOk = true;
        } catch (clipErr) {
          console.error("Clipboard copy failed:", clipErr);
        }
      }
      if (clipboardOk) {
        setShareNote("Image copied! Press Cmd+V (or Ctrl+V) to paste it into your tweet");
        await new Promise((r) => setTimeout(r, 1500));
      }
      const text = `I just staked my claim at Hail Mary Prospecting Co.\n\nrl80.com/hailmary?ref=${refCode}`;
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "width=550,height=420");
      setTimeout(() => setShareNote(null), 5000);
    } catch (err) { console.error("Share failed:", err); }
  };

  const copyImage = async () => {
    try {
      setShareNote("Copying...");
      const canvas = await capturePng();
      const pngBlob = await new Promise((r) => canvas.toBlob(r, "image/png"));
      if (pngBlob && navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
        setShareNote("Copied to clipboard!");
      }
      setTimeout(() => setShareNote(null), 3000);
    } catch (err) { console.error("Copy failed:", err); }
  };

  const download = async () => {
    try {
      const canvas = await capturePng();
      const link = document.createElement("a");
      link.download = "hail-mary-claim.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      setShareNote("Downloaded!");
      setTimeout(() => setShareNote(null), 3000);
    } catch (err) { console.error("Download failed:", err); }
  };

  const nativeShare = async () => {
    try {
      const canvas = await capturePng();
      const pngBlob = await new Promise((r) => canvas.toBlob(r, "image/png"));
      if (!pngBlob) return;
      const file = new File([pngBlob], "hail-mary-claim.png", { type: "image/png" });
      await navigator.share({
        title: "Hail Mary Prospecting Co.",
        text: `I just staked my claim! Join me: rl80.com/hailmary?ref=${refCode}`,
        files: [file],
      });
    } catch (err) {
      if (err.name !== "AbortError") console.error("Share failed:", err);
    }
  };

  const shareBtn = (primary) => ({
    padding: "8px 16px",
    background: primary ? `${theme.gold}22` : "transparent",
    border: `1px solid ${primary ? theme.gold : theme.border}`,
    borderRadius: 3,
    color: primary ? theme.gold : theme.muted,
    fontFamily: mono,
    fontSize: 10,
    letterSpacing: "0.1em",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 6,
  });

  const shareRow = (
    <div style={{ margin: "12px auto 0", maxWidth: CERT_W, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
      <button onClick={shareOnX} style={shareBtn(true)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
        SHARE ON X
      </button>
      <button onClick={copyImage} style={shareBtn(false)}>COPY IMAGE</button>
      <button onClick={download} style={shareBtn(false)}>DOWNLOAD</button>
      {typeof navigator !== "undefined" && navigator.share && (
        <button onClick={nativeShare} style={shareBtn(false)}>SHARE</button>
      )}
      {shareNote && (
        <div style={{ width: "100%", textAlign: "center", fontSize: 10, color: theme.green, marginTop: 4 }}>
          {shareNote}
        </div>
      )}
    </div>
  );

  const art = (responsive, innerRef, style) => (
    <CertArt
      innerRef={innerRef}
      claimId={claimId}
      grantedTo={grantedTo}
      plotCol={plotCol}
      plotRow={plotRow}
      pickedRaw={pickedAt}
      isMobile={isMobile}
      responsive={responsive}
      style={style}
    />
  );

  if (variant === "hero") {
    return (
      <>
        <div style={{ margin: "20px auto 0", maxWidth: CERT_W }}>
          {art(true, certRef)}
        </div>
        {showShare && shareRow}
      </>
    );
  }

  // ── thumb: scaled-down preview → click for the lightbox + share row ────────
  const scale = thumbWidth / CERT_W;
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setLightboxOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setLightboxOpen(true); } }}
        title="View & share your claim certificate"
        style={{ cursor: "zoom-in", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
      >
        {/* Fixed-size frame around a full-size render scaled down, so the
            overlay positions/typography stay pixel-identical to the enlarged
            certificate at any thumb size. */}
        <div style={{
          width: thumbWidth,
          height: Math.round(thumbWidth * CERT_RATIO),
          overflow: "hidden",
          borderRadius: 3,
          boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
        }}>
          <div style={{ width: CERT_W, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            {art(false)}
          </div>
        </div>
        <div style={{ fontSize: 8, letterSpacing: "0.1em", color: theme.muted, fontFamily: mono }}>
          YOUR CLAIM CERTIFICATE — TAP TO SHARE
        </div>
      </div>

      {/* Portal to <body>: the pre-season panel sits under backdrop-filter /
          transform ancestors, which turn position:fixed into panel-relative —
          rendered in place, the lightbox would only cover the side panel. */}
      {lightboxOpen && createPortal(
        <div
          onClick={() => setLightboxOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 100000,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 4, padding: 24,
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
            cursor: "zoom-out",
            overflowY: "auto",
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
            aria-label="Close"
            title="Close"
            style={{
              position: "absolute", top: 18, right: 18,
              width: 40, height: 40, borderRadius: "50%",
              background: "rgba(0,0,0,0.5)", color: "#fff",
              border: "1px solid rgba(255,255,255,0.3)", cursor: "pointer",
              fontSize: 20, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >✕</button>
          <div onClick={(e) => e.stopPropagation()} style={{ cursor: "default", width: "min(calc(92vw / var(--hm-ui-scale, 1)), 440px)", zoom: "var(--hm-ui-scale, 1)" }}>
            {art(true, certRef, { filter: "drop-shadow(0 24px 70px rgba(0,0,0,0.65))" })}
            {shareRow}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
