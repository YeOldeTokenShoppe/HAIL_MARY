// Covalent (GoldRush) client — top-holder list for non-Base chains.
// Etherscan's tokenholderlist is Pro-only; Covalent's v2 endpoint is on
// the free tier (100k credits/month, ~3 credits per call).
//
// We only use one endpoint: token_holders_v2. It returns the holder list
// already ranked by balance and includes both the holder's balance and
// the token's total supply, which is everything the review needs from
// this source. EOA-vs-contract is added by the onchain route via viem
// `getCode` (matches the CDP path's behavior).
//
// Chain IDs: Covalent accepts EVM mainnet chainIds directly (1, 8453,
// 10, 42161, 137, 56, 43114, 59144, 81457, 7777777, …). No slug mapping
// needed.

const COVALENT_BASE = 'https://api.covalenthq.com/v1';
const DEFAULT_LIMIT = 10;

function apiKey() {
  return (
    process.env.COVALENT_API_KEY ||
    process.env.GOLDRUSH_API_KEY ||
    process.env.NEXT_PUBLIC_COVALENT_API_KEY ||
    ''
  );
}

async function covalentFetch(path) {
  const key = apiKey();
  if (!key) throw new Error('COVALENT_API_KEY not configured');
  const url = `${COVALENT_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${key}`,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Covalent ${res.status}: ${text.slice(0, 200)}`);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Covalent non-JSON response: ${text.slice(0, 200)}`);
  }
  if (json.error) {
    throw new Error(`Covalent error: ${json.error_message || 'unknown'}`);
  }
  return json;
}

// Returns top holders ranked by balance, plus the token's total supply
// as Covalent sees it. Shape matches what the CDP path returns so the
// downstream merging logic stays identical.
//
//   { holders: [{ address, balance }], totalSupply: string | null }
//
// `balance` is the raw uint256 string (consistent with CDP). The route
// computes shareBps after merging.
export async function fetchTopHolders({ chainId, address, limit = DEFAULT_LIMIT }) {
  const lower = address.toLowerCase();
  const path = `/${chainId}/tokens/${lower}/token_holders_v2/?page-size=${limit}&page-number=0`;
  const json = await covalentFetch(path);
  const items = Array.isArray(json?.data?.items) ? json.data.items : [];
  const totalSupply = items[0]?.total_supply ? String(items[0].total_supply) : null;
  const holders = items.map((row) => ({
    address: String(row.address || '').toLowerCase(),
    balance: row.balance != null ? String(row.balance) : '0',
  }));
  return {
    holders,
    totalSupply,
    contractName: json?.data?.items?.[0]?.contract_name || null,
    decimals:
      typeof json?.data?.items?.[0]?.contract_decimals === 'number'
        ? json.data.items[0].contract_decimals
        : null,
  };
}

// Covalent also exposes a holder-count via the same endpoint's
// pagination metadata (`total_count`) when available. Some chains
// return it; others don't. Used by the activity block's `holderCount`
// field. Soft-fails to null.
export async function fetchHolderCount({ chainId, address }) {
  const lower = address.toLowerCase();
  const path = `/${chainId}/tokens/${lower}/token_holders_v2/?page-size=1&page-number=0`;
  const json = await covalentFetch(path);
  const tc = json?.data?.pagination?.total_count;
  return typeof tc === 'number' ? tc : null;
}
