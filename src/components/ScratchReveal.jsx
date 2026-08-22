"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

// ScratchReveal — a scratch-off foil over whatever it wraps. React port of
// public/html/scratch.js: an opaque canvas painted as gold foil, rubbed away
// with `destination-out`, an alpha census that declares the ticket scratched
// past a threshold, and a coin that rides the pointer. What changed from the
// standalone page: the number under the foil is not random — the children are
// the real outcome, already decided — and scratching needs a pressed pointer
// (hover-scratching inside a scrolling column would uncover results by
// accident). Pointer Events cover mouse + touch; `touch-action: none` keeps the
// page from scrolling under a thumb. The canvas backing store is sized from
// getBoundingClientRect × devicePixelRatio so it stays crisp and maps pointer
// coordinates correctly under the column's CSS `zoom`.
//
// Accessibility: the foil is a focusable button — Enter/Space reveals — and a
// text REVEAL link sits beside it for anyone who can't rub. Under
// prefers-reduced-motion the shine sweep is off and the final clear is instant.

const MONO = "'Share Tech Mono', monospace";
const BRUSH = 18;          // radius, layout px
const CLEAR_ALPHA = 40;    // a sampled pixel with alpha below this counts as scratched

// Foil finishes. `gold` takes the theme's gold pair (the original scratch.js
// look); `silver` is the latex of a real lottery ticket — neutral greys with a
// speckle, the finish on the HAIL MARY ticket art.
const SILVER = ["#d6d7d2", "#9fa09b", "#e3e4df", "#a8a9a4", "#cdcec9"];
const foilStops = (variant, t) => (variant === "silver" ? SILVER : [t.gold, t.goldBorder, t.gold, t.goldBorder, t.gold]);
const foilInk = (variant) => (variant === "silver" ? ["rgba(24,24,20,0.82)", "rgba(24,24,20,0.6)"] : ["rgba(30,18,0,0.78)", "rgba(30,18,0,0.55)"]);

export default function ScratchReveal({
  theme, children,
  variant = "gold",
  threshold = 0.45,
  label = "SCRATCH TO REVEAL",
  sublabel = "",
  labelSize = 11,
  minHeight = 72,
  brush = BRUSH,
  coinSize = 34,
  hoverScratch = false, // scratch.html behaviour: a mouse rubs on hover, no press needed (touch still needs contact)
  shape = "rect",       // "rect" | "circle" — a circle clips the foil, coin and shine to a disc
  revealed = false,     // controlled: true shows the content with no foil (a REVEAL ALL, a ticket already scratched)
  onRevealed,
  revealRef,        // optional: receives { reveal() } so a text link can clear the foil
  style,
}) {
  const t = theme;
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const coinRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const moves = useRef(0);
  const doneRef = useRef(false);
  const paintedRef = useRef(false);   // foil has been painted at least once
  const touchedRef = useRef(false);   // the player has rubbed — never repaint over their progress
  const [fading, setFading] = useState(false);
  const [done, setDone] = useState(false);
  const reduceMotion = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // ── paint the foil (in layout px; the transform carries zoom × DPR) ──
  // A resize after the player has started (rotation, a viewport change) must
  // not hand them a fresh foil: the current pixels — scratches included — are
  // carried over onto the new backing store instead.
  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    if (!w || !h) return;
    const k = (rect.width / w) * (window.devicePixelRatio || 1);
    const nw = Math.max(1, Math.round(w * k)), nh = Math.max(1, Math.round(h * k));
    let carry = null;
    if (paintedRef.current && touchedRef.current) {
      if (canvas.width === nw && canvas.height === nh) return; // nothing changed — keep the progress
      carry = document.createElement("canvas");
      carry.width = canvas.width; carry.height = canvas.height;
      carry.getContext("2d").drawImage(canvas, 0, 0);
    }
    canvas.width = nw;
    canvas.height = nh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    if (carry) { ctx.drawImage(carry, 0, 0, w, h); return; }
    paintedRef.current = true;

    const stops = foilStops(variant, t);
    const g = ctx.createLinearGradient(0, 0, w, h);
    stops.forEach((c, i) => g.addColorStop([0, 0.3, 0.5, 0.8, 1][i], c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Fine diagonal grain so the foil reads as foil, not a flat fill.
    ctx.strokeStyle = "rgba(0,0,0,0.09)";
    ctx.lineWidth = 1;
    for (let x = -h; x < w + h; x += 6) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke();
    }
    if (variant === "silver") {
      // Latex speckle — the flecked surface of a real scratch panel.
      for (let i = 0, n = (w * h) / 9; i < n; i++) {
        ctx.fillStyle = i % 3 ? "rgba(0,0,0,0.13)" : "rgba(255,255,255,0.35)";
        ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
      }
    }
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    if (!label && !sublabel) return;
    const [ink, inkSoft] = foilInk(variant);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ink;
    ctx.font = `700 ${labelSize}px ${MONO}`;
    try { ctx.letterSpacing = "0.2em"; } catch { /* older canvas */ }
    if (label) ctx.fillText(label, w / 2 + 1, sublabel ? h / 2 - labelSize * 0.55 : h / 2);
    if (sublabel) {
      ctx.fillStyle = inkSoft;
      ctx.font = `${Math.round(labelSize * 0.72)}px ${MONO}`;
      try { ctx.letterSpacing = "0.16em"; } catch { /* older canvas */ }
      ctx.fillText(sublabel, w / 2 + 1, h / 2 + labelSize * 0.8);
    }
  }, [t.gold, t.goldBorder, variant, label, sublabel, labelSize]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (done || revealed) return;
    paint();
    // Fonts can land after first paint; repaint the label once they do — unless
    // the player has already started on this foil.
    document.fonts?.ready?.then(() => { if (!doneRef.current && !touchedRef.current) paint(); });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { if (!doneRef.current) paint(); }) : null;
    if (ro && canvasRef.current) ro.observe(canvasRef.current);
    return () => ro?.disconnect();
  }, [paint, done, revealed]);

  // ── scratch ──
  const pointOf = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.offsetWidth,
      y: ((e.clientY - rect.top) / rect.height) * canvas.offsetHeight,
    };
  };
  const rub = (a, b) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    touchedRef.current = true;
    ctx.globalCompositeOperation = "destination-out";
    // destination-out erases by the SOURCE alpha — the brush must be opaque, or
    // it inherits paint()'s last translucent style and only thins the foil.
    ctx.strokeStyle = "#000"; ctx.fillStyle = "#000";
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = brush * 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(b.x, b.y, brush, 0, Math.PI * 2); ctx.fill();
  };
  // Alpha census over every 4th pixel — enough to judge "sufficiently scratched".
  const scratchedFraction = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return 0;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let clear = 0, n = 0;
    for (let i = 3; i < data.length; i += 16) { n++; if (data[i] < CLEAR_ALPHA) clear++; }
    return n ? clear / n : 0;
  };
  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    drawing.current = false;
    if (coinRef.current) coinRef.current.style.opacity = "0";
    if (reduceMotion) { setDone(true); onRevealed?.(); return; }
    setFading(true);
    setTimeout(() => { setDone(true); onRevealed?.(); }, 380);
  }, [reduceMotion, onRevealed]);
  useImperativeHandle(revealRef, () => ({ reveal: finish }), [finish]);

  const placeCoin = (e) => {
    const coin = coinRef.current, wrap = wrapRef.current;
    if (!coin || !wrap) return;
    const rect = wrap.getBoundingClientRect();
    const kz = wrap.offsetWidth / rect.width; // undo CSS zoom for the wrapper's layout space
    coin.style.left = `${(e.clientX - rect.left) * kz}px`;
    coin.style.top = `${(e.clientY - rect.top) * kz}px`;
    coin.style.opacity = "1";
  };
  const hideCoin = () => { if (coinRef.current) coinRef.current.style.opacity = "0"; };
  const isHover = (e) => hoverScratch && e.pointerType === "mouse";
  const onPointerDown = (e) => {
    if (doneRef.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    try { canvasRef.current?.setPointerCapture?.(e.pointerId); } catch { /* synthetic or already-captured pointer */ }
    drawing.current = true;
    const p = pointOf(e);
    last.current = p;
    rub(p, p);
    placeCoin(e);
  };
  const onPointerEnter = (e) => {
    if (!isHover(e) || doneRef.current) return;
    last.current = pointOf(e);
    placeCoin(e);
  };
  const onPointerLeave = (e) => {
    if (drawing.current) return;
    last.current = null;
    if (isHover(e)) hideCoin();
  };
  const onPointerMove = (e) => {
    if (doneRef.current) return;
    if (!drawing.current && !isHover(e)) return;
    e.preventDefault();
    const p = pointOf(e);
    rub(last.current || p, p);
    last.current = p;
    placeCoin(e);
    if (++moves.current % 4 === 0 && scratchedFraction() > threshold) finish();
  };
  const onPointerUp = (e) => {
    if (!drawing.current) return;
    drawing.current = false;
    if (!isHover(e)) hideCoin();
    if (scratchedFraction() > threshold) finish();
  };
  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); finish(); }
  };

  const shown = done || revealed;
  const shine = !reduceMotion && !shown && !fading;
  const radius = shape === "circle" ? "50%" : 3;
  return (
    <div ref={wrapRef} style={{ position: "relative", minHeight, ...style }}>
      {shine && (
        <style>{`@keyframes hmScratchShine { from { background-position: 0 0 } to { background-position: 100% 0 } }`}</style>
      )}
      {/* the outcome — mounted underneath the whole time; the foil is all that hides it */}
      <div style={{ minHeight, visibility: shown || fading ? "visible" : undefined }}>{children}</div>
      {!shown && (
        <>
          <canvas
            ref={canvasRef}
            role="button"
            tabIndex={0}
            aria-label={`${label.toLowerCase()} — press Enter to reveal without scratching`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            onKeyDown={onKeyDown}
            style={{
              position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: radius,
              touchAction: "none", cursor: hoverScratch ? "none" : "grab", userSelect: "none", WebkitUserSelect: "none",
              opacity: fading ? 0 : 1, transition: fading ? "opacity 0.36s ease" : "none",
              outline: "none",
            }}
          />
          {shine && (
            <div aria-hidden="true" style={{
              position: "absolute", inset: 0, borderRadius: radius, pointerEvents: "none",
              background: "linear-gradient(-70deg, transparent, transparent 50%, rgba(255,255,255,0.22) 57%, transparent 60%)",
              backgroundSize: "300% 100%", animation: "hmScratchShine 5s linear infinite",
              opacity: fading ? 0 : 1,
            }} />
          )}
          {/* the coin — rides the pointer while rubbing (scratch.css's RL80 coin, sized by coinSize) */}
          <div ref={coinRef} aria-hidden="true" style={{
            position: "absolute", left: 0, top: 0, width: coinSize, height: coinSize, marginLeft: -coinSize / 2, marginTop: -coinSize * 0.65,
            borderRadius: "50%", pointerEvents: "none", opacity: 0, transition: "opacity 0.12s",
            border: `${Math.max(2, Math.round(coinSize / 17))}px dashed ${t.goldBorder}`,
            boxShadow: `0 0 0 ${Math.max(1.5, coinSize / 24)}px ${t.goldBorder}, 0 ${coinSize * 0.08}px 0 ${t.goldBorder}, 0 ${coinSize * 0.2}px ${coinSize * 0.25}px -${coinSize * 0.1}px rgba(0,0,56,0.5)`,
            background: `radial-gradient(circle at 30% 30%, #ffe9a6, ${t.gold} 70%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: MONO, fontSize: Math.round(coinSize * 0.24), fontWeight: 700, letterSpacing: "0.04em", color: t.goldBorder,
            transform: "rotate(-18deg)",
          }}>RL80</div>
        </>
      )}
    </div>
  );
}
