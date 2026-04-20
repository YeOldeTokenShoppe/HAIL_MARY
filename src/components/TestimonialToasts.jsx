"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { subscribeTestimonials } from "@/lib/testimonials";
import "./testimonials.css";

const ROTATE_MS = 5500;
const LIVE_JUMP_MIN_GAP_MS = 30_000;
const MAX_VISIBLE_DESKTOP = 2;
const MOBILE_BP = 700;

// Seed testimonials so a fresh shrine (or one with no writes yet) still
// has whispers rotating. Same copy as the mockup — swap in your own at
// will. `id` namespace "seed-*" keeps them out of live-jump detection.
const SEEDS = [
  { id: "seed-1", displayName: "Kairos", text: "I lit a candle and my bag 5x'd our lady is real", lit: true },
  { id: "seed-2", displayName: "Sister Liquidity", text: "Prayed during the crash. Dip bought. Now +40%. Ave Maria.", lit: true },
  { id: "seed-3", displayName: "Vesper the Investor", text: "I doubted Her. I shouldn't have.", lit: false },
  { id: "seed-4", displayName: "Moloch", text: "Rug proof. The candle knows.", lit: true },
  { id: "seed-5", displayName: "Compounded", text: "Confession: I bought the top. Relit anyway. Forgiveness came.", lit: false },
  { id: "seed-6", displayName: "Anathema", text: "My wife left me but RL80 stayed. The Lady provides.", lit: true },
  { id: "seed-7", displayName: "Brother Tenor", text: "This token pays more in hope than my 401k ever did", lit: false },
  { id: "seed-8", displayName: "Primum", text: "Never selling. The Lady watches.", lit: true },
];

function relativeTime(ms) {
  if (!ms) return "";
  const diff = Math.max(0, Date.now() - ms);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function TestimonialToasts({ onInscribeClick }) {
  const [pool, setPool] = useState(SEEDS);
  const [isMobile, setIsMobile] = useState(false);
  // Portal to document.body so the stack escapes .shrine-page.neon's
  // `position: relative` rule that would otherwise force fixed-position
  // children into the page flow and lengthen the page.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Track breakpoint so we can render the mobile ticker vs. the desktop
  // stack.
  useEffect(() => {
    const update = () => {
      setIsMobile(
        window.matchMedia(`(max-width: ${MOBILE_BP}px)`).matches,
      );
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Subscribe to live testimonials once; merge with seeds so the rotation
  // is never empty. Track first-snapshot state so we don't flag every
  // backfilled doc as "live" on initial load — that belongs to StackView
  // but lives here because the pool is shared.
  const knownIdsRef = useRef(new Set(SEEDS.map((s) => s.id)));
  const firstSnapshotRef = useRef(true);
  const newLiveIdsRef = useRef([]); // consumed by StackView

  useEffect(() => {
    const unsub = subscribeTestimonials((list) => {
      if (!Array.isArray(list)) return;
      const merged = [];
      const seenIds = new Set();
      for (const l of list) {
        if (!l.id || seenIds.has(l.id)) continue;
        seenIds.add(l.id);
        merged.push(l);
      }
      for (const s of SEEDS) {
        if (!seenIds.has(s.id)) {
          seenIds.add(s.id);
          merged.push(s);
        }
      }
      setPool(merged);

      if (firstSnapshotRef.current) {
        firstSnapshotRef.current = false;
        for (const l of list) knownIdsRef.current.add(l.id);
        return;
      }
      for (const l of list) {
        if (knownIdsRef.current.has(l.id)) continue;
        knownIdsRef.current.add(l.id);
        newLiveIdsRef.current.push(l.id);
      }
    });
    return unsub;
  }, []);

  if (!mounted) return null;

  return createPortal(
    isMobile ? (
      <TickerView pool={pool} onInscribeClick={onInscribeClick} />
    ) : (
      <StackView
        pool={pool}
        onInscribeClick={onInscribeClick}
        newLiveIdsRef={newLiveIdsRef}
      />
    ),
    document.body,
  );
}

/* ========================================================================
   Desktop: vertical stack with rotation + live-jump.
   ======================================================================== */

function StackView({ pool, onInscribeClick, newLiveIdsRef }) {
  const [visible, setVisible] = useState([]);
  const idxRef = useRef(0);
  const lastLiveJumpRef = useRef(0);
  const poolRef = useRef(pool);
  useEffect(() => { poolRef.current = pool; }, [pool]);

  const showItem = (item, isLive) => {
    setVisible((prev) => {
      const cap = MAX_VISIBLE_DESKTOP;
      const next = [...prev.slice(-(cap - 1)), {
        key: `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        item,
        isLive,
      }];
      return next;
    });
  };

  // Rotation.
  useEffect(() => {
    const tick = () => {
      const list = poolRef.current;
      if (!list.length) return;
      // Drain any pending live-jump ids (cooldown-gated) before falling
      // back to sequential rotation.
      while (newLiveIdsRef.current.length) {
        const pendingId = newLiveIdsRef.current.shift();
        const now = Date.now();
        if (now - lastLiveJumpRef.current > LIVE_JUMP_MIN_GAP_MS) {
          const item = list.find((x) => x.id === pendingId);
          if (item) {
            lastLiveJumpRef.current = now;
            showItem(item, true);
            return;
          }
        }
      }
      const item = list[idxRef.current % list.length];
      idxRef.current += 1;
      showItem(item, false);
    };
    tick();
    const id = setInterval(tick, ROTATE_MS);
    return () => clearInterval(id);
  }, [newLiveIdsRef]);

  return (
    <div className="tst-stack" aria-live="polite">
      <div className="tst-stack-head">
        <span className="tst-label"></span>
        <button
          type="button"
          className="tst-inscribe-btn"
          onClick={onInscribeClick}
          title="Add your witness"
        >
          + GET LIT FOR RL80
        </button>
      </div>
      {visible.map(({ key, item, isLive }) => (
        <Toast key={key} item={item} isLive={isLive} />
      ))}
    </div>
  );
}

function Toast({ item, isLive }) {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const r1 = requestAnimationFrame(() =>
      requestAnimationFrame(() => setEntered(true)),
    );
    return () => cancelAnimationFrame(r1);
  }, []);
  const letter = (item.displayName?.[0] ?? "?").toUpperCase();
  const caps =
    item.text && item.text.length > 3 && item.text === item.text.toUpperCase() && /[A-Z]/.test(item.text);
  return (
    <div className={`tst ${entered ? "in" : ""} ${isLive ? "live" : ""}`}>
      <div className="tst-meta">
        <div className={`tst-avatar ${item.lit ? "lit" : ""}`}>
          {item.avatarUrl ? (
            <img src={item.avatarUrl} alt="" />
          ) : (
            letter
          )}
        </div>
        <span className="tst-handle">{item.displayName ?? "Anonymous"}</span>
        <span className="tst-time">{relativeTime(item.createdAtMs)}</span>
      </div>
      <p className={`tst-text ${caps ? "caps" : ""}`}>{item.text}</p>
      <div className="tst-progress" />
    </div>
  );
}

/* ========================================================================
   Mobile: single-line ticker scrolling right → left.
   One testimony per pass; advance on animationEnd.
   ======================================================================== */

function TickerView({ pool, onInscribeClick }) {
  const [idx, setIdx] = useState(0);
  const current = pool.length ? pool[idx % pool.length] : null;

  const handleEnd = () => {
    setIdx((i) => (pool.length ? (i + 1) % pool.length : 0));
  };

  return (
    <div className="tst-ticker" aria-live="polite">
      <button
        type="button"
        className="tst-ticker-btn"
        onClick={onInscribeClick}
        title="Add your witness"
      >
        +
      </button>
      <div className="tst-ticker-viewport">
        {current && (
          <div
            key={idx}
            className="tst-ticker-content"
            onAnimationEnd={handleEnd}
          >
            <span className={`tst-ticker-dot ${current.lit ? "lit" : ""}`} />
            <span className="tst-ticker-handle">{current.displayName ?? "Anonymous"}</span>
            <span className="tst-ticker-sep">·</span>
            <span className="tst-ticker-text">{current.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
