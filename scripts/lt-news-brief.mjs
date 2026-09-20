#!/usr/bin/env node
//
// lt-news-brief — step 1 of the LT Weekly News Recap pipeline.
//
// Collects one week of crypto signal into a single "brief" JSON file that the
// script generator (scripts/lt-news-script.mjs) reads. Nothing here touches the
// site: it only writes content/lt-tv/briefs/news-<YYYY>-W<ww>.json.
//
// WHY THIS EXISTS RATHER THAN CALLING /api/ai/trending
// ----------------------------------------------------
// That route already hits three of these sources, but it is tuned for the live
// /trade page: a 6-hour cache, Reddit's *hot* listing, titles truncated to 40
// characters, and only the top 3 topics kept. A weekly show needs the opposite
// of all four — a seven-day window, full headlines, source URLs to cite, and
// enough candidates that the editorial pass has something to choose between.
// So this reads the same upstreams directly and leaves the route alone.
//
// Every source is optional. A source that fails is recorded in `degraded` and
// the brief is still written — a news show that can't run because CoinGecko
// rate-limited is not a sustainable news show.
//
// Usage:
//   node scripts/lt-news-brief.mjs                 # this week
//   node scripts/lt-news-brief.mjs --week 2026-W38
//   node scripts/lt-news-brief.mjs --out some/path.json
//
// Optional env: CMC_PRO_API_KEY (adds CoinMarketCap global metrics + headlines)

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const UA = "lt-tv-newsroom/1.0 (+https://rl80.com)";
const FETCH_TIMEOUT_MS = 10_000;

// ── small helpers ─────────────────────────────────────────────────────────

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** ISO week label, e.g. 2026-W38 — the brief's identity and the episode's. */
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Thursday of the current ISO week decides the year.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function getJson(url, { headers } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "application/json", ...headers },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function getText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "user-agent": UA }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ── sources ───────────────────────────────────────────────────────────────

// Reddit's weekly top, not hot — the show covers a week, so it wants what the
// week decided mattered, not what is loud at the moment the script runs.
async function redditWeek() {
  const subs = ["bitcoin", "ethereum", "cryptocurrency"];
  const out = [];
  for (const sub of subs) {
    const data = await getJson(`https://www.reddit.com/r/${sub}/top.json?t=week&limit=10`);
    for (const child of data?.data?.children || []) {
      const p = child.data;
      if (!p || p.stickied || (p.score ?? 0) < 500) continue;
      out.push({
        title: p.title,
        url: `https://reddit.com${p.permalink}`,
        outlet: `r/${sub}`,
        score: p.score,
        comments: p.num_comments ?? 0,
        postedAt: new Date((p.created_utc ?? 0) * 1000).toISOString(),
      });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 12);
}

// CryptoPanic's public RSS — free and unlimited, same feed /api/ai/trending
// falls back to, but keeping the link and the date rather than a 40-char stub.
async function cryptoPanicWeek() {
  const xml = await getText("https://cryptopanic.com/news/rss/");
  const items = [];
  for (const block of xml.split("<item>").slice(1)) {
    const title =
      block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)?.[1] ??
      block.match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1];
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
    if (!title) continue;
    items.push({
      title: title.trim(),
      url: link?.trim() ?? null,
      outlet: "cryptopanic",
      postedAt: pubDate ? new Date(pubDate).toISOString() : null,
    });
  }
  const weekAgo = Date.now() - 7 * 86_400_000;
  return items
    .filter((i) => !i.postedAt || Date.parse(i.postedAt) >= weekAgo)
    .slice(0, 25);
}

async function coinGeckoTrending() {
  const data = await getJson("https://api.coingecko.com/api/v3/search/trending");
  return (data?.coins || []).slice(0, 10).map(({ item }) => ({
    name: item.name,
    symbol: item.symbol?.toUpperCase(),
    rank: item.market_cap_rank ?? null,
    change24h: item.data?.price_change_percentage_24h?.usd ?? null,
  }));
}

// A week of the gauge, not a single reading — the arc from Monday to Friday is
// the story ("eighteen points of humility in five days"), the spot value isn't.
async function fearGreedWeek() {
  const data = await getJson("https://api.alternative.me/fng/?limit=8");
  const series = (data?.data || []).map((d) => ({
    value: Number(d.value),
    label: d.value_classification,
    at: new Date(Number(d.timestamp) * 1000).toISOString().slice(0, 10),
  }));
  // The API returns newest first; the show reads the week forward.
  series.reverse();
  const open = series[0] ?? null;
  const close = series[series.length - 1] ?? null;
  return {
    series,
    open,
    close,
    delta: open && close ? close.value - open.value : null,
  };
}

async function polymarketCrypto() {
  const markets = await getJson(
    "https://gamma-api.polymarket.com/markets?closed=false&limit=60&order=volume&ascending=false",
  );
  if (!Array.isArray(markets)) return [];
  const now = Date.now();
  return markets
    .filter((m) => {
      if (m.endDate && Date.parse(m.endDate) < now) return false;
      const q = (m.question || "").toLowerCase();
      return ["bitcoin", "btc", "ethereum", "eth", "crypto", "solana"].some((k) => q.includes(k));
    })
    .slice(0, 8)
    .map((m) => {
      // Gamma returns outcomePrices as a JSON-encoded string more often than not.
      let prices = m.outcomePrices;
      if (typeof prices === "string") {
        try {
          prices = JSON.parse(prices);
        } catch {
          prices = null;
        }
      }
      return {
        question: m.question,
        yesPrice: Array.isArray(prices) ? Number(prices[0]) : null,
        endDate: m.endDate ?? null,
        volume: m.volume ? Number(m.volume) : null,
        url: m.slug ? `https://polymarket.com/event/${m.slug}` : null,
      };
    });
}

async function cmcContext(key) {
  if (!key) return null;
  const headers = { "X-CMC_PRO_API_KEY": key };
  const [global, quotes] = await Promise.all([
    getJson("https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest", { headers }),
    getJson("https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC,ETH", {
      headers,
    }),
  ]);
  const btc = quotes?.data?.BTC?.quote?.USD;
  const eth = quotes?.data?.ETH?.quote?.USD;
  return {
    btcDominance: global?.data?.btc_dominance ?? null,
    totalMarketCapChange24h:
      global?.data?.quote?.USD?.total_market_cap_yesterday_percentage_change ?? null,
    btc: btc ? { price: btc.price, change7d: btc.percent_change_7d ?? null } : null,
    eth: eth ? { price: eth.price, change7d: eth.percent_change_7d ?? null } : null,
  };
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  const week = arg("week", isoWeek());
  const degraded = [];

  const named = [
    ["reddit", redditWeek()],
    ["cryptopanic", cryptoPanicWeek()],
    ["coingecko", coinGeckoTrending()],
    ["fearGreed", fearGreedWeek()],
    ["polymarket", polymarketCrypto()],
    ["coinmarketcap", cmcContext(process.env.CMC_PRO_API_KEY)],
  ];

  const settled = await Promise.allSettled(named.map(([, p]) => p));
  const signals = {};
  settled.forEach((result, i) => {
    const [name] = named[i];
    if (result.status === "fulfilled") {
      signals[name] = result.value;
    } else {
      signals[name] = null;
      degraded.push({ source: name, error: String(result.reason?.message ?? result.reason) });
    }
  });

  const brief = {
    id: `news-${week}`,
    week,
    generatedAt: new Date().toISOString(),
    windowDays: 7,
    signals,
    degraded,
  };

  const out = resolve(arg("out", `content/lt-tv/briefs/news-${week}.json`));
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(brief, null, 2) + "\n");

  const counts = [
    `${signals.reddit?.length ?? 0} reddit`,
    `${signals.cryptopanic?.length ?? 0} headlines`,
    `${signals.coingecko?.length ?? 0} trending`,
    `${signals.polymarket?.length ?? 0} markets`,
  ].join(", ");
  console.log(`Brief for ${week}: ${counts}`);
  if (degraded.length) {
    console.log(`Degraded: ${degraded.map((d) => `${d.source} (${d.error})`).join(", ")}`);
  }
  console.log(`Wrote ${out}`);
}

// Only run when invoked directly, so isoWeek() can be imported.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
