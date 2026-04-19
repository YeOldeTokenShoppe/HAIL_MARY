"use client";
import { useEffect, useRef, useState } from "react";

const DEFAULT_POLL_MS = 20_000;

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

// Chunk N consecutive candles into one, aligned so the most-recent candle is
// always a complete bucket. Used when the CG OHLC granularity is finer than
// what we want to display (e.g. 6×4h → 1d).
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

export function useCandles({
  count = 18,
  days = 1,
  aggregate = 1,
  pollMs = DEFAULT_POLL_MS,
} = {}) {
  const [candles, setCandles] = useState([]);
  const [latestPrice, setLatestPrice] = useState(null);
  const [priceChange24h, setPriceChange24h] = useState(0);
  const [marketCap, setMarketCap] = useState(null);
  const [resolvedTimeframe, setResolvedTimeframe] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchOnce() {
      try {
        abortRef.current?.abort();
        const ctl = new AbortController();
        abortRef.current = ctl;
        const url = `/api/rl80-history?days=${days}`;
        const res = await fetch(url, { signal: ctl.signal });
        const data = await res.json();
        if (cancelled) return;
        const raw = Array.isArray(data.candles) ? data.candles : [];
        const bucketed = bucketCandles(raw, aggregate);
        setCandles(bucketed.slice(-count));
        setLatestPrice(data.price ?? null);
        setPriceChange24h(data.priceChange24h ?? 0);
        setMarketCap(data.fdv ?? null);
        setResolvedTimeframe(data.timeframe ?? null);
        setUpdatedAt(data.timestamp ?? null);
        setError(data.error ?? null);
      } catch (err) {
        if (err.name === "AbortError") return;
        if (!cancelled) setError(err.message || "fetch failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchOnce();
    const id = setInterval(fetchOnce, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [count, days, aggregate, pollMs]);

  const volatility = rollingVolatility(candles);

  return {
    candles,
    latestPrice,
    priceChange24h,
    marketCap,
    timeframe: resolvedTimeframe,
    updatedAt,
    volatility,
    error,
    loading,
  };
}
