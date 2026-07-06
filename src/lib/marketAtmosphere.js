// Market "atmosphere" for the oracle (Our Lady) — a small, cached snapshot of
// the world as it now stands, which she interprets as OMENS: alluded to
// obliquely, never recited as a report, never turned into advice.
//
// Every source is optional and defensively wrapped: any failure simply omits
// that signal. If everything fails, this returns "" and the oracle runs exactly
// as before. It NEVER throws and NEVER blocks the reply — a stale-while-
// revalidate cache serves the last snapshot instantly and refreshes in the
// background (so a cold first prayer just gets no omens, not a slow one).
//
// Sources:
//   • Fear & Greed gauge — alternative.me (no key)
//   • CoinMarketCap global metrics + BTC/ETH quotes — needs CMC_PRO_API_KEY
//   • CoinMarketCap latest news/content — needs CMC_PRO_API_KEY + a plan that
//     includes the Content API (gracefully skipped otherwise)
//
// NOTE: these sources are crypto-weighted; each line self-labels ("crypto
// sentiment", "Bitcoin") so she treats it as crypto weather, not all markets.
// Broad equities / macro omens are a future add (needs a stock-data provider).

const TTL_MS = 20 * 60 * 1000; // refresh at most every 20 minutes
let cache = { at: 0, text: "" };
let refreshing = null;

async function fetchJson(url, { headers } = {}, timeoutMs = 3500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "rl80-oracle/1.0", accept: "application/json", ...headers },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fearGreed() {
  const j = await fetchJson("https://api.alternative.me/fng/?limit=1");
  const d = j?.data?.[0];
  if (!d?.value) return null;
  const label = String(d.value_classification || "").toLowerCase();
  return `Crypto sentiment reads ${label} (${d.value}/100 on the fear-and-greed gauge).`;
}

async function cmcMarket(key) {
  if (!key) return null;
  const headers = { "X-CMC_PRO_API_KEY": key };
  const [g, q] = await Promise.all([
    fetchJson("https://pro-api.coinmarketcap.com/v1/global-metrics/quotes/latest", { headers }),
    fetchJson("https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC,ETH", { headers }),
  ]);
  const parts = [];
  const usd = g?.data?.quote?.USD;
  const chg = usd?.total_market_cap_yesterday_percentage_change;
  if (typeof chg === "number") {
    parts.push(`the total crypto market is ${chg >= 0 ? "up" : "down"} ${Math.abs(chg).toFixed(1)}% on the day`);
  }
  const btc = q?.data?.BTC?.quote?.USD;
  if (typeof btc?.price === "number") {
    const c = btc.percent_change_24h;
    const move = typeof c === "number" ? ` (${c >= 0 ? "+" : ""}${c.toFixed(1)}% 24h)` : "";
    parts.push(`Bitcoin near $${Math.round(btc.price).toLocaleString()}${move}`);
  }
  const dom = g?.data?.btc_dominance;
  if (typeof dom === "number") parts.push(`Bitcoin dominance about ${dom.toFixed(0)}%`);
  return parts.length ? parts.join("; ") + "." : null;
}

async function cmcNews(key) {
  if (!key) return null;
  const j = await fetchJson(
    "https://pro-api.coinmarketcap.com/v1/content/latest?limit=4",
    { headers: { "X-CMC_PRO_API_KEY": key } },
  );
  const items = Array.isArray(j?.data) ? j.data : [];
  const heads = items
    .map((it) => it?.title)
    .filter((t) => typeof t === "string" && t.trim())
    .slice(0, 4);
  return heads.length ? "Word from the wires: " + heads.map((h) => `“${h.trim()}”`).join("; ") + "." : null;
}

async function refresh() {
  const key = process.env.CMC_PRO_API_KEY || "";
  const [sentiment, market, news] = await Promise.all([
    fearGreed().catch(() => null),
    cmcMarket(key).catch(() => null),
    cmcNews(key).catch(() => null),
  ]);
  const lines = [market, sentiment, news].filter(Boolean);
  cache = { at: Date.now(), text: lines.join(" ") };
}

/**
 * Returns the current market-atmosphere text (may be "" if nothing has loaded
 * yet or all sources are down). Sync + non-blocking: serves the cached snapshot
 * instantly and kicks off a background refresh when stale.
 */
export function getMarketAtmosphere() {
  const stale = Date.now() - cache.at >= TTL_MS;
  if (stale && !refreshing) {
    refreshing = refresh().finally(() => {
      refreshing = null;
    });
  }
  return cache.text;
}
