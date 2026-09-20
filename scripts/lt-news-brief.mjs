#!/usr/bin/env node
//
// lt-news-brief — step 1 of the LT Weekly News Recap pipeline.
//
// Collects one week of market signal into a single "brief" JSON file that the
// script generator (scripts/lt-news-script.mjs) reads. Nothing here touches the
// site: it only writes content/lt-tv/briefs/news-<YYYY>-W<ww>.json.
//
// SCOPE — the show is not a crypto show
// ------------------------------------
// It is a general investing and economics show that happens to live on a
// crypto site. A typical week is the Fed, the ten-year, the price of oil, a
// bill moving through Congress, whatever the indices did — and then crypto,
// and then whatever strange thing people are currently treating as an asset.
// So this reads five families of source:
//
//   macro        — Fed press releases, the Treasury yield curve, economy news
//   markets      — index and commodity levels, week over week
//   crypto       — the existing feeds
//   collectibles — the "people are buying trading cards as an investment" beat
//   predictions  — Polymarket and Kalshi, for what the crowd is pricing
//
// Everything here is free and keyless except CoinMarketCap, which is optional.
//
// Every source is optional in the stronger sense too: one that fails is
// recorded in `degraded` and the brief is still written. A news show that
// cannot run because Stooq rate-limited is not a sustainable news show.
//
// The brief NOMINATES stories. It does not confirm them — these are headlines
// and prices, and the editorial pass in lt-news-script.mjs is what searches out
// a real article before any number is spoken on air.
//
// Usage:
//   node scripts/lt-news-brief.mjs                 # this week
//   node scripts/lt-news-brief.mjs --week 2026-W38
//   node scripts/lt-news-brief.mjs --out some/path.json
//   node scripts/lt-news-brief.mjs --check-sources  # ping every source, write nothing
//
// Optional env: CMC_PRO_API_KEY (adds CoinMarketCap global metrics)

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const UA = "lt-tv-newsroom/1.0 (+https://rl80.com)";
const FETCH_TIMEOUT_MS = 12_000;

// ── small helpers ─────────────────────────────────────────────────────────

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const next = process.argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
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

async function fetchWithTimeout(url, { headers, accept } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, ...(accept ? { accept } : {}), ...headers },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

const getJson = async (url, opts) =>
  (await fetchWithTimeout(url, { accept: "application/json", ...opts })).json();
const getText = async (url, opts) => (await fetchWithTimeout(url, opts)).text();

const WEEK_MS = 7 * 86_400_000;

/**
 * Minimal feed reader covering both RSS <item> and Atom <entry>. These feeds
 * are small and well-formed; pulling in an XML parser for four fields would be
 * the only dependency this pipeline has.
 */
function parseFeed(xml, outlet) {
  const chunks = xml.includes("<item") ? xml.split(/<item[\s>]/).slice(1) : xml.split(/<entry[\s>]/).slice(1);
  const pick = (block, tag) => {
    const cdata = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`));
    if (cdata) return cdata[1].trim();
    const plain = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    if (plain) return plain[1].trim();
    // Atom links carry the URL in an attribute rather than a body.
    const href = block.match(new RegExp(`<${tag}[^>]*href="([^"]+)"`));
    return href ? href[1] : null;
  };

  return chunks
    .map((block) => {
      const title = pick(block, "title");
      if (!title) return null;
      const date = pick(block, "pubDate") || pick(block, "updated") || pick(block, "published");
      const parsed = date ? Date.parse(date) : NaN;
      return {
        title: title.replace(/<[^>]+>/g, "").trim(),
        url: pick(block, "link"),
        outlet,
        postedAt: Number.isNaN(parsed) ? null : new Date(parsed).toISOString(),
      };
    })
    .filter(Boolean);
}

/** Feed items from the last seven days, newest first; undated items are kept. */
function lastWeek(items, limit) {
  const cutoff = Date.now() - WEEK_MS;
  return items
    .filter((i) => !i.postedAt || Date.parse(i.postedAt) >= cutoff)
    .sort((a, b) => Date.parse(b.postedAt ?? 0) - Date.parse(a.postedAt ?? 0))
    .slice(0, limit);
}

// ── macro ─────────────────────────────────────────────────────────────────

// The Fed's own monetary-policy press releases — the authoritative source for
// an FOMC decision, ahead of anybody's coverage of it.
async function fedPressReleases() {
  const xml = await getText("https://www.federalreserve.gov/feeds/press_monetary.xml");
  return lastWeek(parseFeed(xml, "federalreserve.gov"), 8);
}

// Treasury's daily yield curve, published as XML per month. The ten-year is
// the number the show actually wants; the two-year and three-month come along
// because the spread between them is usually the story.
async function treasuryYields() {
  const now = new Date();
  const month = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const xml = await getText(
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml" +
      `?data=daily_treasury_yield_curve&field_tdr_date_value_month=${month}`,
  );

  const rows = xml.split(/<entry[\s>]/).slice(1).map((block) => {
    const num = (tag) => {
      const m = block.match(new RegExp(`<d:${tag}[^>]*>([^<]*)</d:${tag}>`));
      const v = m ? Number(m[1]) : NaN;
      return Number.isFinite(v) ? v : null;
    };
    const date = block.match(/<d:NEW_DATE[^>]*>([^<]*)</)?.[1] ?? null;
    return {
      at: date ? date.slice(0, 10) : null,
      threeMonth: num("BC_3MONTH"),
      twoYear: num("BC_2YEAR"),
      tenYear: num("BC_10YEAR"),
      thirtyYear: num("BC_30YEAR"),
    };
  }).filter((r) => r.at && r.tenYear !== null);

  const series = rows.slice(-8);
  const open = series[0] ?? null;
  const close = series[series.length - 1] ?? null;
  return {
    series,
    open,
    close,
    tenYearDelta: open && close ? Number((close.tenYear - open.tenYear).toFixed(2)) : null,
    // A negative 2s10s spread is the recession-signal everyone quotes.
    spread2s10s: close && close.twoYear !== null ? Number((close.tenYear - close.twoYear).toFixed(2)) : null,
  };
}

async function macroNews() {
  const feeds = [
    ["https://www.cnbc.com/id/20910258/device/rss/rss.html", "cnbc/economy"],
    ["https://www.cnbc.com/id/10000664/device/rss/rss.html", "cnbc/markets"],
    ["https://finance.yahoo.com/news/rssindex", "yahoo-finance"],
  ];
  const settled = await Promise.allSettled(feeds.map(([url, outlet]) => getText(url).then((xml) => parseFeed(xml, outlet))));
  const items = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (!items.length) throw new Error("no macro feed returned items");
  return lastWeek(items, 30);
}

// ── markets ───────────────────────────────────────────────────────────────

// Stooq serves plain daily CSV with no key and no quota ceremony. One request
// per symbol, last rows only — enough for a week-over-week move.
async function stooqSeries(symbol, label) {
  const csv = await getText(`https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`);
  const lines = csv.trim().split("\n");
  const header = lines[0]?.toLowerCase() ?? "";
  if (!header.startsWith("date")) throw new Error(`unexpected CSV for ${symbol}`);

  const closeIdx = header.split(",").indexOf("close");
  const rows = lines
    .slice(1)
    .map((line) => line.split(","))
    .map((cols) => ({ at: cols[0], close: Number(cols[closeIdx]) }))
    .filter((r) => r.at && Number.isFinite(r.close))
    .slice(-6);

  if (!rows.length) throw new Error(`no rows for ${symbol}`);
  const open = rows[0];
  const close = rows[rows.length - 1];
  return {
    label,
    symbol,
    last: close.close,
    asOf: close.at,
    weekChangePct: open.close ? Number((((close.close - open.close) / open.close) * 100).toFixed(2)) : null,
  };
}

async function marketLevels() {
  const symbols = [
    ["^spx", "S&P 500"],
    ["^ndq", "Nasdaq 100"],
    ["^dji", "Dow Jones"],
  ];
  const settled = await Promise.allSettled(symbols.map(([s, l]) => stooqSeries(s, l)));
  const out = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);
  if (!out.length) throw new Error("no index series returned");
  return out;
}

async function commodityLevels() {
  const symbols = [
    ["cl.f", "WTI crude"],
    ["gc.f", "Gold"],
  ];
  const settled = await Promise.allSettled(symbols.map(([s, l]) => stooqSeries(s, l)));
  const out = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);
  if (!out.length) throw new Error("no commodity series returned");
  return out;
}

// ── crypto ────────────────────────────────────────────────────────────────

// Reddit's weekly top, not hot — the show covers a week, so it wants what the
// week decided mattered, not what is loud at the moment the script runs.
async function redditTopOfWeek(subs, minScore) {
  const out = [];
  const errors = [];
  for (const sub of subs) {
    try {
      const data = await getJson(`https://www.reddit.com/r/${sub}/top.json?t=week&limit=10`);
      for (const child of data?.data?.children || []) {
        const p = child.data;
        if (!p || p.stickied || (p.score ?? 0) < minScore) continue;
        out.push({
          title: p.title,
          url: `https://reddit.com${p.permalink}`,
          outlet: `r/${sub}`,
          score: p.score,
          comments: p.num_comments ?? 0,
          postedAt: new Date((p.created_utc ?? 0) * 1000).toISOString(),
        });
      }
    } catch (err) {
      errors.push(`r/${sub}: ${err.message}`);
    }
  }
  if (!out.length && errors.length) throw new Error(errors.join("; "));
  return out.sort((a, b) => b.score - a.score).slice(0, 12);
}

async function cryptoNews() {
  const xml = await getText("https://cryptopanic.com/news/rss/");
  return lastWeek(parseFeed(xml, "cryptopanic"), 25);
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
  series.reverse(); // the API returns newest first; the show reads forward
  const open = series[0] ?? null;
  const close = series[series.length - 1] ?? null;
  return { series, open, close, delta: open && close ? close.value - open.value : null };
}

async function cmcContext(key) {
  if (!key) return null;
  const headers = { "X-CMC_PRO_API_KEY": key };
  const [global, quotes] = await Promise.all([
    getJson("https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest", { headers }),
    getJson("https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC,ETH", { headers }),
  ]);
  const quote = (sym) => {
    const q = quotes?.data?.[sym]?.quote?.USD;
    return q ? { price: q.price, change7d: q.percent_change_7d ?? null } : null;
  };
  return {
    btcDominance: global?.data?.btc_dominance ?? null,
    totalMarketCapChange24h: global?.data?.quote?.USD?.total_market_cap_yesterday_percentage_change ?? null,
    btc: quote("BTC"),
    eth: quote("ETH"),
  };
}

// ── collectibles ──────────────────────────────────────────────────────────

// There is no free price API for trading cards worth wiring, so the beat is
// sourced the way a human would notice it: the collector subreddits, when a
// set launch or a frenzy pushes a post to the top of the week. The editorial
// pass confirms any actual number from a real article.
async function collectiblesChatter() {
  return redditTopOfWeek(["PokemonTCG", "sportscards", "collectibles"], 300);
}

// ── predictions ───────────────────────────────────────────────────────────

const PREDICTION_KEYWORDS = [
  "bitcoin", "btc", "ethereum", "eth", "crypto", "solana",
  "fed", "fomc", "rate", "inflation", "cpi", "recession", "gdp",
  "s&p", "nasdaq", "stock", "oil", "gold", "treasury", "congress", "bill",
];

const matchesBeat = (text) => {
  const q = (text || "").toLowerCase();
  return PREDICTION_KEYWORDS.some((k) => q.includes(k));
};

async function polymarket() {
  const markets = await getJson(
    "https://gamma-api.polymarket.com/markets?closed=false&limit=80&order=volume&ascending=false",
  );
  if (!Array.isArray(markets)) return [];
  const now = Date.now();
  return markets
    .filter((m) => (!m.endDate || Date.parse(m.endDate) >= now) && matchesBeat(m.question))
    .slice(0, 10)
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
        venue: "polymarket",
        question: m.question,
        yesPrice: Array.isArray(prices) ? Number(prices[0]) : null,
        endDate: m.endDate ?? null,
        volume: m.volume ? Number(m.volume) : null,
        url: m.slug ? `https://polymarket.com/event/${m.slug}` : null,
      };
    });
}

async function kalshi() {
  const data = await getJson(
    "https://api.elections.kalshi.com/trade-api/v2/markets?limit=200&status=open",
  );
  const markets = Array.isArray(data?.markets) ? data.markets : [];
  return markets
    .filter((m) => matchesBeat(m.title) || matchesBeat(m.subtitle))
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 10)
    .map((m) => ({
      venue: "kalshi",
      question: [m.title, m.subtitle].filter(Boolean).join(" — "),
      // Kalshi quotes in cents; the show says it as a probability like Polymarket.
      yesPrice: Number.isFinite(m.yes_bid) ? Number((m.yes_bid / 100).toFixed(2)) : null,
      endDate: m.close_time ?? null,
      volume: m.volume ?? null,
      url: m.ticker ? `https://kalshi.com/markets/${m.ticker}` : null,
    }));
}

// ── wiring ────────────────────────────────────────────────────────────────

/** Every source, grouped the way the brief is shaped. */
function sourceTable() {
  return [
    ["macro", "fedPressReleases", fedPressReleases()],
    ["macro", "treasuryYields", treasuryYields()],
    ["macro", "macroNews", macroNews()],
    ["markets", "indices", marketLevels()],
    ["markets", "commodities", commodityLevels()],
    ["crypto", "reddit", redditTopOfWeek(["bitcoin", "ethereum", "cryptocurrency"], 500)],
    ["crypto", "news", cryptoNews()],
    ["crypto", "trending", coinGeckoTrending()],
    ["crypto", "fearGreed", fearGreedWeek()],
    ["crypto", "coinmarketcap", cmcContext(process.env.CMC_PRO_API_KEY)],
    ["collectibles", "chatter", collectiblesChatter()],
    ["predictions", "polymarket", polymarket()],
    ["predictions", "kalshi", kalshi()],
  ];
}

const countOf = (value) =>
  Array.isArray(value) ? value.length : value === null ? 0 : typeof value === "object" ? 1 : 0;

async function main() {
  const table = sourceTable();
  const settled = await Promise.allSettled(table.map(([, , promise]) => promise));

  // --check-sources: report which upstreams actually answer, write nothing.
  // The pipeline degrades silently by design, which is right for a Friday and
  // wrong for the first run on a new machine — this is how you tell them apart.
  if (arg("check-sources")) {
    let ok = 0;
    for (const [i, result] of settled.entries()) {
      const [group, name] = table[i];
      const label = `${group}/${name}`.padEnd(26);
      if (result.status === "fulfilled") {
        const n = countOf(result.value);
        const skipped = result.value === null;
        console.log(`  ${skipped ? "–" : "✓"} ${label} ${skipped ? "skipped (no key)" : `${n} item(s)`}`);
        if (!skipped) ok += 1;
      } else {
        console.log(`  ✗ ${label} ${result.reason?.message ?? result.reason}`);
      }
    }
    console.log(`\n${ok} of ${table.length} sources answered.`);
    return;
  }

  const week = arg("week", isoWeek());
  const signals = {};
  const degraded = [];

  settled.forEach((result, i) => {
    const [group, name] = table[i];
    signals[group] ??= {};
    if (result.status === "fulfilled") {
      signals[group][name] = result.value;
    } else {
      signals[group][name] = null;
      degraded.push({ source: `${group}/${name}`, error: String(result.reason?.message ?? result.reason) });
    }
  });

  const brief = {
    id: `news-${week}`,
    week,
    generatedAt: new Date().toISOString(),
    windowDays: 7,
    scope: "general investing and economics, including crypto and collectibles",
    signals,
    degraded,
  };

  const out = resolve(arg("out", `content/lt-tv/briefs/news-${week}.json`));
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(brief, null, 2) + "\n");

  console.log(
    `Brief for ${week}: ` +
      [
        `${countOf(signals.macro?.macroNews) + countOf(signals.macro?.fedPressReleases)} macro items`,
        `${countOf(signals.markets?.indices)} indices`,
        `${countOf(signals.crypto?.news)} crypto headlines`,
        `${countOf(signals.collectibles?.chatter)} collectibles posts`,
        `${countOf(signals.predictions?.polymarket) + countOf(signals.predictions?.kalshi)} markets`,
      ].join(", "),
  );
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
