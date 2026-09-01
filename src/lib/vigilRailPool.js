"use client";

// Shared data layer for the VigilRail guest-candle feature — used by both
// renderers (VigilRailDom, the 2D votive overlay, and VigilRail, the 3D
// GLB-clone rail kept behind ?rail=3d for comparison). Owns the mock pool,
// the live shrineCandles→prefs join, the melt-from-age mapping, and the
// deterministic fallback tint for keepers who never persisted cosmetics.

import { useEffect, useMemo, useRef, useState } from "react";
import { readCandlePrefs } from "@/lib/candleRitual";

export const DAY_MS = 86400000;

// Live-feed melt window. shrineCandles docs don't carry their owner's melt
// duration, so melt reads elapsed burn against the signed-in window (8h,
// mirroring MELT_DURATION_SIGNED_IN_MS in page.js). After the burn window
// the stub keeps settling slowly for months, so months-old candles don't
// all clamp to one identical height.
export const LIVE_MELT_WINDOW_MS = 8 * 60 * 60 * 1000;
const LIVE_MELT_ACTIVE_MAX = 0.75; // melt reached by the end of the 8h burn
const LIVE_MELT_TAIL_MS = 180 * DAY_MS; // slow settle window after burnout

// Deterministic fallback wax tint for keepers with NO prefs doc at all —
// without it every unconfigured candle renders identically and the rack
// reads as clones (the first real dataset did exactly that). Nulls keep a
// share of candles natural; an existing doc's null tint means "Natural"
// was chosen and is respected.
const FALLBACK_TINTS = [null, null, "#b83b3b", "#d49f3a", "#e57aa7", "#8b5fbf", "#0ef178", "#14f7ff"];
export function fallbackTint(uid) {
  let h = 0;
  for (const ch of String(uid)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return FALLBACK_TINTS[h % FALLBACK_TINTS.length];
}

// Mock pool — cast borrowed from CommunityCandles.jsx, decals/tints from
// lib/candlePrefs presets. Ages are spread wide so every melt state is on
// display; exactly six burn, matching the ticker copy. votiveImage null =
// the shrine's default Nuestra Señora label.
export const MOCK_POOL = [
  { id: "degen", name: "degen.eth", votiveImage: "/queenOfHearts1.jpg", votiveTint: "#e57aa7", ageDays: 0.008, burning: true },
  { id: "sarah", name: "cryptoSarah", votiveImage: "/images/sacreCoeur.webp", votiveTint: "#b83b3b", ageDays: 0.09, burning: true },
  { id: "wagmi", name: "wagmiQueen", votiveImage: "/images/RL80_KNUCKLES.webp", votiveTint: "#14f7ff", ageDays: 0.42, burning: true },
  { id: "hodl", name: "hodlKing", votiveImage: null, votiveTint: "#0ef178", ageDays: 3, burning: true },
  { id: "luna", name: "lunaSol", votiveImage: "/images/face.png", votiveTint: "#d49f3a", ageDays: 9, burning: true },
  { id: "maria", name: "0xMaria", votiveImage: null, votiveTint: "#8b5fbf", ageDays: 21, burning: true },
  { id: "bd", name: "0x59bD…3Ef7", votiveImage: "/images/ILLUMIN80_TATTOO.webp", votiveTint: "#d49f3a", ageDays: 40, burning: false },
  { id: "ngmi", name: "ngmi_cope", votiveImage: null, votiveTint: "#b83b3b", ageDays: 66, burning: false },
  { id: "fa2", name: "0x8Fa2…09c1", votiveImage: "/images/I-80.webp", votiveTint: null, ageDays: 100, burning: false },
  { id: "rl80", name: "RL80", votiveImage: null, votiveTint: null, ageDays: 135, burning: false },
].map((c) => ({
  ...c,
  // Mock melt maps lifetime age onto the wax so the rack shows history:
  // fresh pillar at hours old, stub-in-a-puddle at 135 days. Same mapping
  // as the approved mock artifact's meltWax().
  meltProgress: Math.min(0.9, 0.08 + (c.ageDays / 140) * 0.85),
}));

// "12m" / "2h" / "40d" — plate + tooltip age labels.
export function fmtAge(days) {
  if (days < 0.04) return `${Math.round(days * 1440)}m`;
  if (days < 1) return `${Math.round(days * 24)}h`;
  return `${Math.round(days)}d`;
}

// Turns shrineCandles docs (from subscribeLitCandles, passed down by the
// page) into rail entries, joining each doc with its owner's cosmetic
// prefs. Prefs fetches are cached per userId for the life of the caller.
// Pass candles = null to disable (mock mode).
export function useLivePool(candles, excludeUserId) {
  const [prefsMap, setPrefsMap] = useState({});
  const fetchedRef = useRef(new Set());

  useEffect(() => {
    if (!candles?.length) return;
    let cancelled = false;
    const missing = candles
      .map((c) => c.userId ?? c.id)
      .filter((uid) => uid && uid !== excludeUserId && !fetchedRef.current.has(uid));
    if (!missing.length) return;
    missing.forEach((uid) => fetchedRef.current.add(uid));
    Promise.all(
      missing.map(async (uid) => [uid, await readCandlePrefs(uid)]),
    ).then((pairs) => {
      if (cancelled) return;
      setPrefsMap((prev) => {
        const next = { ...prev };
        // Keep null (no prefs doc) distinct from {} — the fallback tint
        // applies only to keepers who never wrote prefs at all.
        pairs.forEach(([uid, prefs]) => { next[uid] = prefs; });
        return next;
      });
    });
    return () => { cancelled = true; };
  }, [candles, excludeUserId]);

  return useMemo(() => {
    if (!candles?.length) return [];
    return candles
      .filter((c) => (c.userId ?? c.id) !== excludeUserId)
      .map((c) => {
        const uid = c.userId ?? c.id;
        const prefs = prefsMap[uid];
        const elapsed = Date.now() - (c.litAtMs ?? Date.now());
        // Active burn melts to LIVE_MELT_ACTIVE_MAX over the 8h window;
        // past it, the stub settles slowly toward 0.92 over months so age
        // still reads in the wax height.
        const meltProgress =
          elapsed <= LIVE_MELT_WINDOW_MS
            ? LIVE_MELT_ACTIVE_MAX * (elapsed / LIVE_MELT_WINDOW_MS)
            : Math.min(
                0.92,
                LIVE_MELT_ACTIVE_MAX +
                  (0.92 - LIVE_MELT_ACTIVE_MAX) *
                    ((elapsed - LIVE_MELT_WINDOW_MS) / LIVE_MELT_TAIL_MS),
              );
        return {
          id: uid,
          name: c.displayName ?? `${String(uid).slice(0, 6)}…`,
          votiveImage: prefs?.votiveImage ?? null,
          votiveTint: prefs ? prefs.votiveTint ?? null : fallbackTint(uid),
          ageDays: elapsed / DAY_MS,
          // Live docs only exist while lit, so every guest burns.
          burning: true,
          meltProgress,
        };
      });
  }, [candles, prefsMap, excludeUserId]);
}
