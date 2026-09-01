"use client";

// VigilRailDom — the guest-votive rail as stylized 2D DOM candles layered
// over the scene canvas, ported from the approved "Vigil Rail" mock
// artifact (2026-09-01). Michelle preferred the mock's graphic candles to
// GLB clones in-scene: crisp legible labels, saturated wax, and the
// visitor's candle stays the shrine's only real 3D object. Guests live on
// this HUD layer — part of the liminal-terminal fiction, so their
// detachment from scene lighting/occlusion is a feature, not a bug.
//
// Same state machine as the 3D rail (VigilRail.jsx, kept behind ?rail=3d):
// weighted rotation one guest at a time, rest-at-top gating, park-and-
// re-rise on scroll, silent swap when the visitor lingers away. Data comes
// from the shared lib/vigilRailPool layer (mock pool or the live
// shrineCandles ⨯ shrineCandlePrefs join with fallback tints).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { MOCK_POOL, useLivePool, fmtAge } from "@/lib/vigilRailPool";
import "./VigilRailDom.css";

// ---- choreography constants (approved in the Vigil Rail mock) --------------
const SWAP_CADENCE_MS = 12000; // one guest swapped per interval, never two
const ENTER_STAGGER_MS = 260; // between guests when the rack fills
const IGNITE_DELAY_MS = 1150; // flame catches a beat after the wax settles
const GUTTER_MS = 900; // flame collapse before the sink
const SINK_MS = 550; // drop below the viewport edge
const SMOKE_MS = 1900; // wisp lifetime after the flame dies
const REST_ARM_MS = 400; // viewport must rest at top this long before guests rise
const AWAY_SWAP_MS = 6000; // linger below the fold → one guest silently swapped

// Organic slot placement: x = center % of viewport width, y = px lift off
// the rail line (an uneven altar surface), s = size variation, r = resting
// tilt in degrees. Gaps are deliberately irregular — a rack of candles left
// by different hands, not a toolbar. Guests stay left-heavy to balance the
// statue + hero candle mass on the right (the hero's screen spot drifts
// with aspect between ~56-60%, so guests keep clear of 48-78%). On top of
// the slot values, each keeper gets a small stable jitter from their id.
const SLOTS_DESKTOP = [
  { x: 20, y: -30, s: 1.5, r: 0 },
  { x: 30, y: -30, s: 1.5, r: 0 },
  { x: 40, y: -30, s: 1.5, r: 0 },
  { x: 50, y: -30, s: 1.5, r: 0 },
];
const SLOTS_MOBILE = [
  { x: 9, y: 3, s: 1.0, r: -1.0 },
  { x: 31, y: 13, s: 0.94, r: 0.8 },
  { x: 84, y: 7, s: 0.98, r: 1.1 },
];
// Default label for keepers without a stored votiveImage — the DOM twin of
// the GLB's baked Nuestra Señora decal.
const DEFAULT_DECAL = "/images/nuestraSenora.webp";

function hashSlot(id, n) {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % n;
}
// Stable per-keeper jitter in [-1, 1] — the same keeper always leans and
// drifts the same way, so the organic scatter doesn't reshuffle per visit.
function hashJitter(id, salt) {
  let h = salt;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ((h % 1000) / 500) - 1;
}
function weightedPick(offstage) {
  if (!offstage.length) return null;
  const weights = offstage.map((p) =>
    p.burning ? 1 / Math.sqrt((p.ageDays ?? 0) + 0.5) : 0.07,
  );
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < offstage.length; i++) {
    r -= weights[i];
    if (r <= 0) return offstage[i];
  }
  return offstage[offstage.length - 1];
}

// ---- one guest candle ------------------------------------------------------
function RailCandle({ entry, slot, enterDelay, wave, leaving, parked, reduced, onGone }) {
  const [transformCls, setTransformCls] = useState("vr-parked");
  const [lit, setLit] = useState(false);
  const [guttering, setGuttering] = useState(false);
  const litRef = useRef(false);
  litRef.current = lit;
  const goneRef = useRef(false);
  const timersRef = useRef([]);
  const later = (fn, ms) => {
    timersRef.current.push(setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  // Entrance — on mount and again on each wave (the re-rise after the
  // viewport returns to rest at the top).
  useEffect(() => {
    setTransformCls("vr-parked");
    setLit(false);
    setGuttering(false);
    later(() => setTransformCls("vr-enter"), enterDelay + 40);
    if (entry.burning) {
      later(() => setLit(true), enterDelay + (reduced ? 120 : IGNITE_DELAY_MS));
    }
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wave]);

  // Scrolled far past the fold — snap below the edge, flame out.
  useEffect(() => {
    if (!parked) return;
    clearTimers();
    setTransformCls("vr-parked");
    setLit(false);
    setGuttering(false);
  }, [parked]);

  // Parent asked this guest to leave: gutter (if lit), sink, report gone.
  useEffect(() => {
    if (!leaving || goneRef.current) return;
    const wasLit = litRef.current;
    const finish = () => {
      if (goneRef.current) return;
      goneRef.current = true;
      onGone?.();
    };
    setLit(false);
    if (wasLit && !reduced) {
      setGuttering(true);
      later(() => {
        setGuttering(false);
        setTransformCls("vr-sinking");
        later(finish, SINK_MS + 80);
      }, GUTTER_MS);
    } else {
      setTransformCls("vr-sinking");
      later(finish, reduced ? 420 : SINK_MS + 80);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving]);

  const wax = Math.max(0.08, 1 - (entry.meltProgress ?? 0));
  const puddleW = 58 + Math.min(1, entry.meltProgress ?? 0) * 66;
  // Slot pose + this keeper's stable jitter = the organic scatter.
  const jx = hashJitter(entry.id, 7) * 1.4; // ±1.4% horizontal drift
  const jr = hashJitter(entry.id, 131) * 0.9; // ±0.9° extra lean
  return (
    <div
      className={`vr-votive ${transformCls}${lit ? " vr-lit" : ""}${guttering ? " vr-guttering" : ""}${entry.burning ? "" : " vr-out"}`}
      style={{
        "--tint": entry.votiveTint ?? "#efe3c4",
        "--wax": wax.toFixed(3),
        "--rot": `${(slot.r + jr).toFixed(2)}deg`,
        "--s": slot.s,
        left: `${(slot.x + jx).toFixed(2)}%`,
        bottom: `calc(var(--vr-nav-h) + ${slot.y}px)`,
      }}
    >
      <div className="vr-halo" />
      <div className="vr-flame" />
      <div className="vr-wick" />
      <div className="vr-glass">
        <div className="vr-wax" />
        {/* votiveImage may be a preset path or a data: URL from prefs */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="vr-decal" src={entry.votiveImage ?? DEFAULT_DECAL} alt="" />
        <div className="vr-shine" />
      </div>
      <div className="vr-puddle" style={{ width: `${puddleW}px` }} />
      <div className="vr-plate">
        <b>{entry.name}</b> &middot; {fmtAge(entry.ageDays ?? 0)}
      </div>
    </div>
  );
}

// ---- the rail --------------------------------------------------------------
export default function VigilRailDom({
  mock = true,
  candles = null,
  excludeUserId = null,
  isMobile = false,
}) {
  const livePool = useLivePool(mock ? null : candles, excludeUserId);
  const pool = mock ? MOCK_POOL : livePool;
  const poolRef = useRef(pool);
  poolRef.current = pool;

  const slots = isMobile ? SLOTS_MOBILE : SLOTS_DESKTOP;
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    [],
  );

  const railRef = useRef(null);
  const [guests, setGuests] = useState([]);
  const [smokes, setSmokes] = useState([]);
  const [wave, setWave] = useState(1);
  const [parked, setParked] = useState(false);
  const guestsRef = useRef(guests);
  guestsRef.current = guests;
  const keySeq = useRef(0);
  const armedRef = useRef(false);
  const parkedRef = useRef(false);
  const armTimerRef = useRef(null);
  const leftTopAtRef = useRef(0);

  const pickNext = () => {
    const staged = new Set(guestsRef.current.map((g) => g.entry.id));
    return weightedPick(poolRef.current.filter((p) => !staged.has(p.id)));
  };

  const fillStage = (staggerFrom = 0) => {
    setGuests((prev) => {
      const next = [...prev];
      let delay = staggerFrom;
      let guard = slots.length * 3;
      while (guard--) {
        const used = new Set(next.map((g) => g.slotIdx));
        const empties = [];
        for (let i = 0; i < slots.length; i++) if (!used.has(i)) empties.push(i);
        if (!empties.length) break;
        const staged = new Set(next.map((g) => g.entry.id));
        const entry = weightedPick(poolRef.current.filter((p) => !staged.has(p.id)));
        if (!entry) break;
        const home = hashSlot(entry.id, slots.length);
        const slotIdx = empties.includes(home) ? home : empties[0];
        next.push({ slotIdx, entry, key: `g${keySeq.current++}`, enterDelay: delay, leaving: false });
        delay += reduced ? 80 : ENTER_STAGGER_MS;
      }
      return next;
    });
  };

  const swapOne = () => {
    const settled = guestsRef.current.filter((g) => !g.leaving);
    if (!armedRef.current || !settled.length) return;
    const victim = settled[Math.floor(Math.random() * settled.length)];
    setGuests((prev) => prev.map((g) => (g.key === victim.key ? { ...g, leaving: true } : g)));
    if (victim.entry.burning && !reduced) {
      const slot = slots[victim.slotIdx];
      setTimeout(() => {
        const key = `s${keySeq.current++}`;
        setSmokes((prev) => [...prev, { key, x: slot.x, y: slot.y }]);
        setTimeout(() => setSmokes((prev) => prev.filter((s) => s.key !== key)), SMOKE_MS + 200);
      }, GUTTER_MS);
    }
  };

  const handleGone = (goneGuest) => {
    setGuests((prev) => prev.filter((g) => g.key !== goneGuest.key));
    setTimeout(() => {
      if (!armedRef.current) return;
      const entry = pickNext();
      if (!entry) return;
      setGuests((prev) => {
        if (prev.some((g) => g.entry.id === entry.id)) return prev;
        const used = new Set(prev.map((g) => g.slotIdx));
        const home = hashSlot(entry.id, slots.length);
        let slotIdx = !used.has(home) ? home : -1;
        if (slotIdx === -1) {
          for (let i = 0; i < slots.length; i++) if (!used.has(i)) { slotIdx = i; break; }
        }
        if (slotIdx === -1) return prev;
        return [...prev, { slotIdx, entry, key: `g${keySeq.current++}`, enterDelay: 0, leaving: false }];
      });
    }, 260);
  };

  // Scroll gate — the whole rail rides the scroll out with the visitor's
  // candle; guests park below the edge once fully offscreen and re-rise
  // (staggered, possibly changed) only after REST_ARM_MS of stillness.
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const rail = railRef.current;
        if (!rail) return;
        const y = window.scrollY;
        const off = Math.min(y * 1.08, 620);
        rail.style.transform = `translate3d(0, ${off}px, 0)`;
        rail.classList.toggle("vr-gone", off >= 620);
        if (y > 6) {
          if (armedRef.current || !leftTopAtRef.current) leftTopAtRef.current = performance.now();
          armedRef.current = false;
          if (armTimerRef.current) {
            clearTimeout(armTimerRef.current);
            armTimerRef.current = null;
          }
          if (off > 300 && !parkedRef.current) {
            parkedRef.current = true;
            setParked(true);
          }
        } else if (!armedRef.current && !armTimerRef.current) {
          armTimerRef.current = setTimeout(() => {
            armTimerRef.current = null;
            armedRef.current = true;
            const away = performance.now() - leftTopAtRef.current;
            if (parkedRef.current) {
              parkedRef.current = false;
              // The shrine changed while they were away: one silent swap.
              if (away > AWAY_SWAP_MS && guestsRef.current.length) {
                const gone = guestsRef.current[
                  Math.floor(Math.random() * guestsRef.current.length)
                ];
                const entry = pickNext();
                setGuests((prev) => {
                  const without = prev.filter((g) => g.key !== gone.key);
                  if (!entry || without.some((g) => g.entry.id === entry.id)) return without;
                  return [
                    ...without,
                    { slotIdx: gone.slotIdx, entry, key: `g${keySeq.current++}`, enterDelay: 0, leaving: false },
                  ];
                });
              }
              setParked(false);
              setWave((w) => w + 1); // staggered re-rise
            }
            fillStage();
          }, REST_ARM_MS);
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial fill once the pool has anything to show, if resting at top.
  useEffect(() => {
    if (!pool.length || guestsRef.current.length) return;
    if (typeof window !== "undefined" && window.scrollY > 6) return;
    const t = setTimeout(() => {
      armedRef.current = true;
      fillStage();
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.length]);

  // Rotation cadence — one swap per tick, only while armed and visible.
  useEffect(() => {
    const timer = setInterval(() => {
      if (armedRef.current && !document.hidden) swapOne();
    }, SWAP_CADENCE_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots.length, reduced]);

  return (
    <div className="vigil-rail-dom" ref={railRef} aria-hidden="true">
      {guests.map((g) => (
        <RailCandle
          key={g.key}
          entry={g.entry}
          slot={slots[g.slotIdx]}
          enterDelay={g.enterDelay}
          wave={wave}
          leaving={g.leaving}
          parked={parked}
          reduced={reduced}
          onGone={() => handleGone(g)}
        />
      ))}
      {smokes.map((s) => (
        <div
          key={s.key}
          className="vr-smoke"
          style={{ left: `${s.x}%`, bottom: `calc(var(--vr-nav-h) + ${170 + s.y}px)` }}
        />
      ))}
    </div>
  );
}
