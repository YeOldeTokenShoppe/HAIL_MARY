// CoinMarketCap client for the /trade Token Review service. Used by
// /api/review/resolve to:
//   1. Figure out which chain a pasted address actually lives on
//      (CMC's contract_address index covers ~50 chains and is the only
//      cheap multi-chain detector).
//   2. Pull market-context fields (price, market cap, 24h volume, rank,
//      date added, CEX listings) that feed into the characters' read.
//
// Two transport modes, server-decided:
//   • If CMC_X402_BASE_URL is set, route through that proxy — it pays
//     the per-call x402 fee out of the proxy's wallet. No CMC key needed
//     here. Matches the "metered via cmc-x402" choice from the design.
//   • Otherwise use the regular CMC Pro API key (COINMARKETCAP_API_KEY).
//     This is a server-only var — never NEXT_PUBLIC — shared with
//     /api/cmc-fear-greed, /api/btc-price and /api/market-data.
//
// CMC's `/v2/cryptocurrency/info?address=...` returns a map keyed by
// CMC numeric id; each entry has a `platform` plus a `contract_address`
// array that lists every chain that token deploys to. We pick the most-
// trafficked deployment for chain-detect and also surface the rest as
// `alternatives` so the UI can offer "also on Polygon, Arbitrum…".

// CMC's "platform" / "contract" entries use these slugs. Map them to
// EVM chain IDs the rest of the review pipeline already speaks.
const CMC_SLUG_TO_CHAIN_ID = {
  ethereum: 1,
  base: 8453,
  'op-mainnet': 10,
  optimism: 10,
  'arbitrum-one': 42161,
  arbitrum: 42161,
  polygon: 137,
  'binance-smart-chain': 56,
  'bnb-smart-chain-bep20': 56,
  'avalanche-c-chain': 43114,
  avalanche: 43114,
  linea: 59144,
  blast: 81457,
  zora: 7777777,
};

const CHAIN_ID_TO_NAME = {
  1: 'Ethereum',
  8453: 'Base',
  10: 'Optimism',
  42161: 'Arbitrum',
  137: 'Polygon',
  56: 'BNB Chain',
  43114: 'Avalanche',
  59144: 'Linea',
  81457: 'Blast',
  7777777: 'Zora',
};

export const SUPPORTED_CHAIN_IDS = Object.values(CHAIN_ID_TO_NAME).length
  ? Object.keys(CHAIN_ID_TO_NAME).map(Number)
  : [];

export function chainNameFor(chainId) {
  return CHAIN_ID_TO_NAME[chainId] || `chain ${chainId}`;
}

function resolveCmcAuth() {
  const proxy = process.env.CMC_X402_BASE_URL;
  if (proxy) {
    return { mode: 'x402', baseUrl: proxy.replace(/\/+$/, ''), apiKey: null };
  }
  const apiKey = process.env.COINMARKETCAP_API_KEY || null;
  return {
    mode: 'direct',
    baseUrl: 'https://pro-api.coinmarketcap.com',
    apiKey,
  };
}

// CMC's `/v2/cryptocurrency/info` accepts `address=` with optional
// `aux=urls,logo,description,tags,platform,date_added,notice,status`. We
// don't need the long-form auxes (description/notice) but we want
// platform + date_added.
const INFO_AUX = 'platform,date_added,tags';

async function cmcFetch(path) {
  const auth = resolveCmcAuth();
  if (auth.mode === 'direct' && !auth.apiKey) {
    throw new Error('CMC not configured (set COINMARKETCAP_API_KEY or CMC_X402_BASE_URL)');
  }
  const url = `${auth.baseUrl}${path}`;
  const headers = { Accept: 'application/json' };
  if (auth.mode === 'direct') {
    headers['X-CMC_PRO_API_KEY'] = auth.apiKey;
  }
  const res = await fetch(url, { headers });
  const text = await res.text();
  if (!res.ok) {
    // CMC returns useful detail in `status.error_message`. Surface a
    // truncated snippet so the resolve endpoint can log it.
    throw new Error(`CMC ${res.status}: ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`CMC non-JSON response: ${text.slice(0, 200)}`);
  }
}

// Take CMC's `contract_address` array (one entry per chain the token
// deploys to) and the top-level `platform` (the "primary" chain). Return
// a normalized list of { chainId, address } across our supported chains,
// with the primary platform first.
function normalizeContractEntries(entry) {
  const out = [];
  const seen = new Set();
  const push = (slug, addr) => {
    const chainId = CMC_SLUG_TO_CHAIN_ID[slug];
    if (!chainId || !addr) return;
    const key = `${chainId}:${addr.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ chainId, address: addr.toLowerCase(), chainName: chainNameFor(chainId) });
  };
  if (entry?.platform?.slug && entry?.platform?.token_address) {
    push(entry.platform.slug, entry.platform.token_address);
  }
  if (Array.isArray(entry?.contract_address)) {
    for (const c of entry.contract_address) {
      const slug = c?.platform?.coin?.slug || c?.platform?.slug;
      const addr = c?.contract_address;
      if (slug && addr) push(slug, addr);
    }
  }
  return out;
}

// Optional follow-up call for the market quote. `/v2/cryptocurrency/quotes/latest`
// keyed by CMC `id` returns price, market cap, volume, % changes.
async function fetchQuoteById(cmcId) {
  const data = await cmcFetch(
    `/v2/cryptocurrency/quotes/latest?id=${encodeURIComponent(cmcId)}&convert=USD`,
  );
  const entry = data?.data?.[String(cmcId)];
  const q = entry?.quote?.USD;
  if (!q) return null;
  return {
    price: typeof q.price === 'number' ? q.price : null,
    marketCap: typeof q.market_cap === 'number' ? q.market_cap : null,
    volume24h: typeof q.volume_24h === 'number' ? q.volume_24h : null,
    percentChange24h: typeof q.percent_change_24h === 'number' ? q.percent_change_24h : null,
    cmcRank: typeof entry.cmc_rank === 'number' ? entry.cmc_rank : null,
  };
}

// Main entry point. Given a raw EVM address, ask CMC what token it is
// and which chain(s) it lives on. Returns null if CMC has no record.
export async function getTokenByAddress(address) {
  if (typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error('Invalid address passed to getTokenByAddress');
  }
  const data = await cmcFetch(
    `/v2/cryptocurrency/info?address=${encodeURIComponent(address)}&aux=${INFO_AUX}`,
  );
  const map = data?.data;
  if (!map || typeof map !== 'object') return null;
  const ids = Object.keys(map);
  if (ids.length === 0) return null;
  // `data` is keyed by CMC numeric id. With a single-address lookup
  // there's exactly one entry; defensive `[0]` in case CMC ever returns
  // multiple matches.
  const cmcId = ids[0];
  const entry = map[cmcId];
  const platforms = normalizeContractEntries(entry);
  if (platforms.length === 0) return null;

  // Pick the primary chain. CMC's `platform` field is the canonical
  // "home" chain; if that's in our supported set, prefer it. Otherwise
  // fall back to the first supported entry.
  const primary = platforms[0];

  // Market quote — separate call, but the failure here is non-fatal.
  // We still want chain-detect to succeed even if quotes time out.
  let market = null;
  try {
    market = await fetchQuoteById(cmcId);
  } catch (err) {
    console.warn('[cmc] quote fetch failed:', err?.message || err);
  }

  return {
    cmcId,
    name: entry.name || null,
    symbol: entry.symbol || null,
    slug: entry.slug || null,
    logo: entry.logo || null,
    dateAdded: entry.date_added || null,
    tags: Array.isArray(entry.tags) ? entry.tags : [],
    primary, // { chainId, address, chainName }
    alternatives: platforms.slice(1), // remaining chains it deploys to
    market: market
      ? { ...market, dateAdded: entry.date_added || null }
      : null,
  };
}
