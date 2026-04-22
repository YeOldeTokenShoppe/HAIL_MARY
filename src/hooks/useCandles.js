"use client";
import { useEffect, useRef, useState } from "react";
import { db, doc, onSnapshot } from "@/lib/firebaseClient";

// Polling fallback kept for the brief window after first deploy when the
// scheduled Cloud Function hasn't yet written marketData/rl80, and for
// environments where Firestore isn't initialized.
const FALLBACK_POLL_MS = 60_000;

function stddev(nums) {
  if (nums.length < 2) return 0;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance =
    nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
  return Math.sqrt(variance);
}

function rollingVolatility(candles, window = 10) {
  if (candles.length < 2) return 0;
  const recent = candles.slice(-window);
  const returns = [];
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1].close;
    const curr = recent[i].close;
    if (prev > 0) returns.push((curr - prev) / prev);
  }
  return stddev(returns);
}

function bucketCandles(candles, n) {
  if (!n || n <= 1) return candles;
  const out = [];
  const offset = candles.length % n;
  for (let i = offset; i + n <= candles.length; i += n) {
    const chunk = candles.slice(i, i + n);
    out.push({
      time: chunk[0].time,
      open: chunk[0].open,
      close: chunk[chunk.length - 1].close,
      high: Math.max(...chunk.map((c) => c.high)),
      low: Math.min(...chunk.map((c) => c.low)),
      volume: chunk.reduce((a, c) => a + (c.volume || 0), 0),
    });
  }
  return out;
}

function applyTimeframe(raw, { count, days, aggregate }) {
  const tf = raw?.timeframes?.[String(days)] || null;
  const bucketed = bucketCandles(
    Array.isArray(tf?.candles) ? tf.candles : [],
    aggregate,
  );
  return {
    candles: bucketed.slice(-count),
    latestPrice: raw?.price ?? null,
    priceChange24h: tf?.priceChange24h ?? raw?.priceChange24h ?? 0,
    marketCap: raw?.fdv ?? null,
    timeframe: tf?.timeframe ?? null,
    source: tf?.source ?? null,
    updatedAt: raw?.updatedAtIso ?? null,
    error: tf?.error ?? null,
  };
}

export function useCandles({ count = 18, days = 1, aggregate = 1 } = {}) {
  const [state, setState] = useState({
    candles: [],
    latestPrice: null,
    priceChange24h: 0,
    marketCap: null,
    timeframe: null,
    source: null,
    updatedAt: null,
    error: null,
    loading: true,
  });
  const fallbackAbortRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchFallback() {
      try {
        fallbackAbortRef.current?.abort();
        const ctl = new AbortController();
        fallbackAbortRef.current = ctl;
        const res = await fetch(`/api/rl80-history?days=${days}`, {
          signal: ctl.signal,
        });
        const data = await res.json();
        if (cancelled) return;
        const raw = Array.isArray(data.candles) ? data.candles : [];
        const bucketed = bucketCandles(raw, aggregate);
        setState({
          candles: bucketed.slice(-count),
          latestPrice: data.price ?? null,
          priceChange24h: data.priceChange24h ?? 0,
          marketCap: data.fdv ?? null,
          timeframe: data.timeframe ?? null,
          source: data.source ?? null,
          updatedAt: data.timestamp ?? null,
          error: data.error ?? null,
          loading: false,
        });
      } catch (err) {
        if (err.name === "AbortError") return;
        if (!cancelled) {
          setState((s) => ({
            ...s,
            loading: false,
            error: err.message || "fetch failed",
          }));
        }
      }
    }

    // If Firestore isn't initialized (SSR or init failure), fall back to the
    // API route. Poll at a slow cadence since the server-side cache handles
    // the upstream rate limit for us.
    if (!db) {
      fetchFallback();
      const id = setInterval(fetchFallback, FALLBACK_POLL_MS);
      return () => {
        cancelled = true;
        clearInterval(id);
        fallbackAbortRef.current?.abort();
      };
    }

    const ref = doc(db, "marketData", "rl80");
    let gotData = false;
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (cancelled) return;
        if (!snap.exists()) {
          // First-deploy safety net: if the cron hasn't written the doc yet,
          // fall back to the API route so the chart renders immediately.
          if (!gotData) fetchFallback();
          return;
        }
        gotData = true;
        const raw = snap.data() || {};
        setState({ ...applyTimeframe(raw, { count, days, aggregate }), loading: false });
      },
      (err) => {
        if (cancelled) return;
        // On listener error, fall back to the API route.
        fetchFallback();
        setState((s) => ({ ...s, error: err.message }));
      },
    );

    return () => {
      cancelled = true;
      unsub();
      fallbackAbortRef.current?.abort();
    };
  }, [count, days, aggregate]);

  const volatility = rollingVolatility(state.candles);

  return {
    candles: state.candles,
    latestPrice: state.latestPrice,
    priceChange24h: state.priceChange24h,
    marketCap: state.marketCap,
    timeframe: state.timeframe,
    source: state.source,
    updatedAt: state.updatedAt,
    volatility,
    error: state.error,
    loading: state.loading,
  };
}
