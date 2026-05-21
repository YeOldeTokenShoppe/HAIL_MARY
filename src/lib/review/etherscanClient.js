// Etherscan v2 client — free-tier endpoints only. Backs the non-Base
// onchain forensics for the /trade Token Review.
//
// Etherscan's v2 unified API is one host with a `chainid` query param;
// the API key works across all 60+ chains they index. Free tier is
// 5 calls/sec, 100k/day — plenty for per-paste reviews.
//
// What we read here (all free tier):
//   • Deployer EOA + deploy tx hash         → contract/getcontractcreation
//   • Total supply                          → stats/tokensupply
//   • Source-verified flag + contract name  → contract/getsourcecode
//   • Recent transfer activity              → account/tokentx (one page)
//
// What we DON'T have here (Pro-only — handled by covalentClient):
//   • Top holder list  (token/tokenholderlist is Pro)
//   • Holder count     (token/tokenholdercount is Pro)
//
// The transfer-activity numbers are a *lower bound*: tokentx returns at
// most 10k records per page. For high-volume tokens that's a cap, not a
// total. Callers should treat transferCount with the `isLowerBound` flag
// in mind. For DORMANT detection (the use case Trinity actually leans
// on) this is fine — DORMANT means <100 lifetime transfers, far under
// the page cap.

const ETHERSCAN_V2_BASE = 'https://api.etherscan.io/v2/api';
const PAGE_CAP = 10_000;

function apiKey() {
  return process.env.ETHERSCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || '';
}

async function etherscanFetch(chainId, params) {
  const key = apiKey();
  if (!key) throw new Error('ETHERSCAN_API_KEY not configured');
  const qs = new URLSearchParams({
    chainid: String(chainId),
    apikey: key,
    ...params,
  }).toString();
  const url = `${ETHERSCAN_V2_BASE}?${qs}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Etherscan ${res.status}: ${text.slice(0, 200)}`);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Etherscan non-JSON response: ${text.slice(0, 200)}`);
  }
  // Etherscan signals "no data" as status=0 with various messages.
  // Distinguish rate-limit ("Max calls per sec rate limit reached") from
  // empty-result ("No transactions found") — first is a transient retry,
  // second is a clean empty.
  if (json.status === '0') {
    const msg = String(json.message || '');
    if (/rate limit/i.test(String(json.result || msg))) {
      throw new Error('Etherscan rate limited');
    }
    // Clean empty result — return whatever's in `result` (often an
    // empty array, sometimes a string message). The caller handles it.
  }
  return json;
}

export async function getDeployer(chainId, address) {
  const json = await etherscanFetch(chainId, {
    module: 'contract',
    action: 'getcontractcreation',
    contractaddresses: address,
  });
  const row = Array.isArray(json.result) ? json.result[0] : null;
  if (!row || !row.contractCreator) return null;
  // `timestamp` is included on chains that support it; on older indexes
  // it may be missing. Render as ISO UTC for symmetry with the CDP
  // route's `deployedAt`.
  let deployedAt = null;
  if (row.timestamp) {
    const secs = Number(row.timestamp);
    if (Number.isFinite(secs) && secs > 0) {
      deployedAt = new Date(secs * 1000).toISOString().replace('T', ' ').replace(/\..+Z$/, '');
    }
  }
  return {
    address: String(row.contractCreator).toLowerCase(),
    deployedAt,
    deployTx: row.txHash || null,
  };
}

export async function getTotalSupply(chainId, address) {
  const json = await etherscanFetch(chainId, {
    module: 'stats',
    action: 'tokensupply',
    contractaddress: address,
  });
  if (typeof json.result === 'string' && /^\d+$/.test(json.result)) {
    return json.result;
  }
  return null;
}

export async function getSourceVerified(chainId, address) {
  const json = await etherscanFetch(chainId, {
    module: 'contract',
    action: 'getsourcecode',
    address,
  });
  const row = Array.isArray(json.result) ? json.result[0] : null;
  if (!row) return { verified: null, contractName: null };
  const verified = typeof row.SourceCode === 'string' && row.SourceCode.length > 0;
  return {
    verified,
    contractName: row.ContractName || null,
  };
}

// Returns a window of recent Transfer events. We pull one page (max
// 10k records, sort=desc) to compute the activity block. For dormant
// tokens this covers their entire history; for high-volume tokens it
// covers the most-recent slice and `isLowerBound` is true.
export async function getTokenTxActivity(chainId, address) {
  const json = await etherscanFetch(chainId, {
    module: 'account',
    action: 'tokentx',
    contractaddress: address,
    page: '1',
    offset: String(PAGE_CAP),
    sort: 'desc',
  });
  const rows = Array.isArray(json.result) ? json.result : [];
  const transferCount = rows.length;
  const isLowerBound = transferCount >= PAGE_CAP;

  if (transferCount === 0) {
    return {
      transferCount: 0,
      recentTransferCount30d: 0,
      recentTransferCount7d: 0,
      firstSeen: null,
      lastSeen: null,
      daysSinceDeployed: null,
      daysSinceLastTransfer: null,
      holderCount: null, // filled by Covalent
      isLowerBound: false,
    };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const day = 86_400;
  let recent30 = 0;
  let recent7 = 0;
  // Rows come back sorted desc by timeStamp, so first row = newest,
  // last row = oldest within the window.
  for (const row of rows) {
    const ts = Number(row.timeStamp);
    if (!Number.isFinite(ts)) continue;
    if (ts > nowSec - 30 * day) recent30++;
    if (ts > nowSec - 7 * day) recent7++;
  }
  const newestTs = Number(rows[0]?.timeStamp);
  const oldestTs = Number(rows[rows.length - 1]?.timeStamp);
  const fmt = (ts) =>
    Number.isFinite(ts) && ts > 0
      ? new Date(ts * 1000).toISOString().replace('T', ' ').replace(/\..+Z$/, '')
      : null;

  const daysSinceDeployed = Number.isFinite(oldestTs)
    ? Math.max(0, Math.floor((Date.now() - oldestTs * 1000) / 86_400_000))
    : null;
  const daysSinceLastTransfer = Number.isFinite(newestTs)
    ? Math.max(0, Math.floor((Date.now() - newestTs * 1000) / 86_400_000))
    : null;

  return {
    transferCount,
    recentTransferCount30d: recent30,
    recentTransferCount7d: recent7,
    firstSeen: fmt(oldestTs),
    lastSeen: fmt(newestTs),
    daysSinceDeployed,
    daysSinceLastTransfer,
    holderCount: null,
    isLowerBound,
  };
}

// Compose everything Etherscan provides for the review in parallel.
// Each leg soft-fails: a missing piece becomes `null` rather than
// torpedoing the whole review.
export async function fetchOnchainBundle({ chainId, address }) {
  const [deployer, totalSupply, source, activity] = await Promise.all([
    getDeployer(chainId, address).catch((err) => {
      console.warn('[etherscan] getDeployer failed:', err?.message || err);
      return null;
    }),
    getTotalSupply(chainId, address).catch((err) => {
      console.warn('[etherscan] getTotalSupply failed:', err?.message || err);
      return null;
    }),
    getSourceVerified(chainId, address).catch((err) => {
      console.warn('[etherscan] getSourceVerified failed:', err?.message || err);
      return { verified: null, contractName: null };
    }),
    getTokenTxActivity(chainId, address).catch((err) => {
      console.warn('[etherscan] getTokenTxActivity failed:', err?.message || err);
      return null;
    }),
  ]);

  return {
    deployer,
    totalSupply,
    sourceVerified: source.verified,
    contractName: source.contractName,
    activity,
  };
}
