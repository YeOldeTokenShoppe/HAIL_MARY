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
// Optional env: COINMARKETCAP_API_KEY (adds CoinMarketCap global metrics; the
//   name the rest of the site already uses. CMC_PRO_API_KEY is read as well.)

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

// Every flag this script knows. An unrecognised one is almost always a typo,
// and silently ignoring it is how `--check-sources.` — one stray full stop —
// quietly generated a brief instead of checking anything.
const KNOWN_FLAGS = ["check-sources", "out", "week"];

function rejectUnknownFlags(known) {
  const unknown = process.argv.slice(2).filter(
    (a) => a.startsWith("--") && !known.includes(a.slice(2)),
  );
  if (!unknown.length) return;
  for (const flag of unknown) {
    // Strip punctuation a shell or a paste may have carried in, so a near
    // miss is named rather than just rejected.
    const bare = flag.slice(2).replace(/[^a-z0-9-]/gi, "");
    const near = known.find((k) => k === bare) ||
      known.find((k) => k.startsWith(bare) || bare.startsWith(k));
    console.error(`Unknown option ${flag}${near ? ` — did you mean --${near}?` : ""}`);
  }
  console.error(`Known options: ${known.map((k) => `--${k}`).join(", ")}`);
  console.error("Values are passed with a space, as in --out path/to/file.json");
  process.exit(2);
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

async function fetchWithTimeout(url, { headers, accept, timeout, method, body } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout ?? FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: method ?? "GET",
      body,
      headers: { "user-agent": UA, ...(accept ? { accept } : {}), ...headers },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (err) {
    // AbortError's own message is "This operation was aborted", which says
    // nothing about which upstream was slow or for how long.
    if (err?.name === "AbortError") {
      throw new Error(`timed out after ${(timeout ?? FETCH_TIMEOUT_MS) / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// A source that cannot run because it has no credentials is not a failure; it
// is a source that is switched off. --check-sources shows the two differently,
// and the brief records which one it was rather than a bare null.
const SKIPPED = Symbol("skipped");
const skip = (reason) => ({ [SKIPPED]: reason });
const skipReason = (value) => (value && typeof value === "object" ? value[SKIPPED] : undefined);

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

// ── FRED ──────────────────────────────────────────────────────────────────
//
// fredgraph.csv is the St. Louis Fed's keyless CSV export: any number of
// series in one request, trimmed to a window with cosd. It is the backbone
// for rates and market levels because it replaced three upstreams that failed
// on the first real run — Treasury's own XML timed out, and Stooq returned
// neither indices nor commodities — and because it is a primary source, which
// is what the verification pass prefers anyway.
//
// Missing observations are published as "." (a market holiday, or a series
// that has not posted for the day yet), not as an empty cell, so every value
// has to survive Number() before it counts.
async function fredSeries(ids, { days = 21 } = {}) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const csv = await getText(
    `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${ids.join(",")}&cosd=${since}`,
  );
  const lines = csv.trim().split("\n").filter(Boolean);
  const header = (lines[0] || "").split(",").map((h) => h.trim());
  // FRED has called the first column DATE and observation_date at different
  // times; anything else means we got an error page rather than a series.
  if (!/^(date|observation_date)$/i.test(header[0] || "")) {
    throw new Error(`unexpected FRED response: ${(lines[0] || "").slice(0, 80)}`);
  }

  const out = {};
  for (const id of ids) {
    const col = header.indexOf(id);
    if (col === -1) continue;
    const rows = lines
      .slice(1)
      .map((line) => line.split(","))
      .map((cols) => ({ at: (cols[0] || "").trim(), value: Number(cols[col]) }))
      .filter((r) => r.at && Number.isFinite(r.value));
    if (rows.length) out[id] = rows;
  }
  if (!Object.keys(out).length) {
    throw new Error(`FRED returned no usable observations for ${ids.join(",")}`);
  }
  return out;
}

function summariseYields(rows, via) {
  const series = rows.slice(-8);
  const open = series[0] ?? null;
  const close = series[series.length - 1] ?? null;
  return {
    via,
    series,
    open,
    close,
    tenYearDelta: open && close ? Number((close.tenYear - open.tenYear).toFixed(2)) : null,
    // A negative 2s10s spread is the recession-signal everyone quotes.
    spread2s10s: close && close.twoYear !== null ? Number((close.tenYear - close.twoYear).toFixed(2)) : null,
  };
}

// The ten-year is the number the show actually wants; the two-year and
// three-month come along because the spread between them is usually the story.
//
// FRED first, because it answers in one small request. Treasury's own XML is
// the fallback: same data from the issuer, but it publishes a whole month at a
// time and took longer than twelve seconds on the first real run, so it gets a
// longer leash and only runs when FRED cannot be reached.
async function treasuryYields() {
  try {
    return await treasuryFromFred();
  } catch (fredErr) {
    try {
      return await treasuryFromTreasuryXml();
    } catch (xmlErr) {
      throw new Error(`FRED: ${fredErr.message}; Treasury XML: ${xmlErr.message}`);
    }
  }
}

async function treasuryFromFred() {
  const ids = ["DGS3MO", "DGS2", "DGS10", "DGS30"];
  const raw = await fredSeries(ids);
  const byDate = new Map();
  const merge = (id, key) => {
    for (const { at, value } of raw[id] || []) {
      const row = byDate.get(at) ||
        { at, threeMonth: null, twoYear: null, tenYear: null, thirtyYear: null };
      row[key] = value;
      byDate.set(at, row);
    }
  };
  merge("DGS3MO", "threeMonth");
  merge("DGS2", "twoYear");
  merge("DGS10", "tenYear");
  merge("DGS30", "thirtyYear");

  const rows = [...byDate.values()]
    .filter((r) => r.tenYear !== null)
    .sort((a, b) => a.at.localeCompare(b.at));
  if (!rows.length) throw new Error("no ten-year observations in the window");
  return summariseYields(rows, "fred.stlouisfed.org");
}

async function treasuryFromTreasuryXml() {
  const now = new Date();
  const month = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const xml = await getText(
    "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml" +
      `?data=daily_treasury_yield_curve&field_tdr_date_value_month=${month}`,
    { timeout: 30_000 },
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

  if (!rows.length) throw new Error("no yield rows parsed");
  return summariseYields(rows, "home.treasury.gov");
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

// Stooq serves plain daily CSV with no key and no quota ceremony, but it
// answered nothing at all on the first real run — it rate-limits by IP and
// replies with a plain-text notice rather than an HTTP error, which the old
// message ("unexpected CSV") hid. It is now a fallback for the one series
// FRED has no current equivalent of, and it reports what it actually said.
async function stooqSeries(symbol, label) {
  const csv = await getText(`https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`);
  const lines = csv.trim().split("\n");
  const header = lines[0]?.toLowerCase() ?? "";
  if (!header.startsWith("date")) {
    throw new Error(`${symbol}: stooq said "${csv.trim().slice(0, 60)}"`);
  }

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
    via: "stooq.com",
    last: close.close,
    asOf: close.at,
    weekChangePct: open.close ? Number((((close.close - open.close) / open.close) * 100).toFixed(2)) : null,
  };
}

// One FRED request covers every level the board reads, so a level is a level
// whether it is an index or a barrel.
async function fredLevels(specs, what) {
  const raw = await fredSeries(specs.map(([id]) => id));
  const out = [];
  for (const [id, label] of specs) {
    const rows = (raw[id] || []).slice(-6);
    if (!rows.length) continue;
    const open = rows[0];
    const close = rows[rows.length - 1];
    out.push({
      label,
      symbol: id,
      via: "fred.stlouisfed.org",
      last: close.value,
      asOf: close.at,
      weekChangePct: open.value
        ? Number((((close.value - open.value) / open.value) * 100).toFixed(2))
        : null,
    });
  }
  if (!out.length) throw new Error(`no ${what} series returned`);
  return out;
}

async function marketLevels() {
  return fredLevels(
    [
      ["SP500", "S&P 500"],
      ["NASDAQCOM", "Nasdaq Composite"],
      ["DJIA", "Dow Jones"],
    ],
    "index",
  );
}

// WTI comes from FRED. Gold does not: FRED's daily London fix was
// discontinued in 2021 and the replacements need a key, so gold is a
// best-effort Stooq call. A week with no gold print is a missing line on the
// board, not a failed source — which is why these settle independently.
async function commodityLevels() {
  const [oil, gold] = await Promise.allSettled([
    fredLevels([["DCOILWTICO", "WTI crude"]], "commodity"),
    stooqSeries("xauusd", "Gold"),
  ]);
  const out = [
    ...(oil.status === "fulfilled" ? oil.value : []),
    ...(gold.status === "fulfilled" ? [gold.value] : []),
  ];
  if (!out.length) {
    throw new Error(
      `no commodity series returned (WTI: ${oil.reason?.message}; gold: ${gold.reason?.message})`,
    );
  }
  return out;
}

// ── crypto ────────────────────────────────────────────────────────────────

// Reddit's weekly top, not hot — the show covers a week, so it wants what the
// week decided mattered, not what is loud at the moment the script runs.
//
// Every unauthenticated call returned 403 on the first real run. That is not a
// bug to route around: Reddit requires OAuth for API access, and the old
// www.reddit.com/*.json path now answers browsers and little else. So this
// asks for a token when credentials exist and skips cleanly when they do not,
// exactly as the CoinMarketCap source does.
//
// To turn it on: create a "script" app at https://www.reddit.com/prefs/apps,
// then set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET. Reddit's API rules also
// want a User-Agent naming a real account, so set REDDIT_USER_AGENT to
// something like "node:lt-tv-newsroom:1.0 (by /u/yourname)".
const REDDIT_UA = process.env.REDDIT_USER_AGENT || `node:lt-tv-newsroom:1.0 (${UA})`;

let redditTokenPromise = null;

async function redditToken() {
  const id = process.env.REDDIT_CLIENT_ID;
  const secret = process.env.REDDIT_CLIENT_SECRET;
  if (!id || !secret) return null;
  // One token per run, shared by every subreddit call.
  redditTokenPromise ??= (async () => {
    const res = await fetchWithTimeout("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": REDDIT_UA,
      },
    });
    const data = await res.json();
    if (!data?.access_token) throw new Error("Reddit returned no access_token");
    return data.access_token;
  })();
  return redditTokenPromise;
}

async function redditTopOfWeek(subs, minScore) {
  const token = await redditToken();
  if (!token) return skip("no REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET");

  const host = "https://oauth.reddit.com";
  const headers = { authorization: `bearer ${token}`, "user-agent": REDDIT_UA };
  const out = [];
  const errors = [];
  for (const sub of subs) {
    try {
      const data = await getJson(`${host}/r/${sub}/top?t=week&limit=10`, { headers });
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

// CryptoPanic's free RSS endpoint answered 410 Gone on the first real run — it
// was retired in favour of a keyed API. These are the crypto desks the
// verification allowlist already trusts, read directly and settled
// independently so one dead feed does not take the beat with it.
async function cryptoNews() {
  const feeds = [
    ["https://www.coindesk.com/arc/outboundfeeds/rss/", "coindesk"],
    ["https://decrypt.co/feed", "decrypt"],
    ["https://cointelegraph.com/rss", "cointelegraph"],
    ["https://www.theblock.co/rss.xml", "theblock"],
  ];
  const settled = await Promise.allSettled(
    feeds.map(([url, outlet]) => getText(url).then((xml) => parseFeed(xml, outlet))),
  );
  const items = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (!items.length) {
    const why = settled.map((r, i) => `${feeds[i][1]}: ${r.reason?.message ?? "no items"}`);
    throw new Error(why.join("; "));
  }
  return lastWeek(items, 25);
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
  if (!key) return skip("no COINMARKETCAP_API_KEY");
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
// Reddit was the only collectibles source, and it now needs credentials, so
// the beat no longer depends on it: Google News queries nominate the stories
// and Reddit enriches them when it is switched on. A weaker nominating source
// is tolerable here precisely because nothing reaches air until the
// verification pass confirms it against a real article.
async function newsQuery(query, outlet) {
  const xml = await getText(
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
  );
  return parseFeed(xml, outlet);
}

async function collectiblesChatter() {
  const queries = [
    ["pokemon cards investment frenzy", "news/pokemon"],
    ["sports cards market record price", "news/sportscards"],
    ["collectibles auction record", "news/collectibles"],
  ];
  const settled = await Promise.allSettled([
    ...queries.map(([q, outlet]) => newsQuery(q, outlet)),
    redditTopOfWeek(["PokemonTCG", "sportscards", "collectibles"], 300),
  ]);

  const items = [];
  const errors = [];
  for (const r of settled) {
    if (r.status === "rejected") {
      errors.push(r.reason?.message ?? String(r.reason));
    } else if (Array.isArray(r.value)) {
      items.push(...r.value);
    }
  }
  if (!items.length) throw new Error(errors.join("; ") || "no collectibles items");
  return lastWeek(items, 20);
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
    // The site's own routes read COINMARKETCAP_API_KEY, so that is the name
    // Michelle's .env.local has. The older name still works.
    ["crypto", "coinmarketcap", cmcContext(process.env.COINMARKETCAP_API_KEY || process.env.CMC_PRO_API_KEY)],
    ["collectibles", "chatter", collectiblesChatter()],
    ["predictions", "polymarket", polymarket()],
    ["predictions", "kalshi", kalshi()],
  ];
}

const countOf = (value) =>
  Array.isArray(value) ? value.length : value === null ? 0 : typeof value === "object" ? 1 : 0;

export async function main() {
  rejectUnknownFlags(KNOWN_FLAGS);

  const table = sourceTable();
  const settled = await Promise.allSettled(table.map(([, , promise]) => promise));

  // --check-sources: report which upstreams actually answer, write nothing.
  // The pipeline degrades silently by design, which is right for a Friday and
  // wrong for the first run on a new machine — this is how you tell them apart.
  if (arg("check-sources")) {
    let ok = 0;
    let off = 0;
    for (const [i, result] of settled.entries()) {
      const [group, name] = table[i];
      const label = `${group}/${name}`.padEnd(26);
      if (result.status === "fulfilled") {
        const reason = skipReason(result.value);
        if (reason) {
          console.log(`  – ${label} skipped (${reason})`);
          off += 1;
        } else {
          console.log(`  ✓ ${label} ${countOf(result.value)} item(s)`);
          ok += 1;
        }
      } else {
        console.log(`  ✗ ${label} ${result.reason?.message ?? result.reason}`);
      }
    }
    const failed = table.length - ok - off;
    console.log(
      `\n${ok} of ${table.length} sources answered` +
        (off ? `, ${off} switched off` : "") +
        (failed ? `, ${failed} failed` : "") +
        ".",
    );
    return;
  }

  const week = arg("week", isoWeek());
  const signals = {};
  const degraded = [];

  settled.forEach((result, i) => {
    const [group, name] = table[i];
    signals[group] ??= {};
    if (result.status === "fulfilled") {
      const reason = skipReason(result.value);
      if (reason) {
        signals[group][name] = null;
        degraded.push({ source: `${group}/${name}`, skipped: true, error: reason });
      } else {
        signals[group][name] = result.value;
      }
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

// Only run when invoked directly, so isoWeek() and main() can be imported —
// the fixture test in lt-news-brief.test.mjs calls main() itself.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
