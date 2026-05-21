import { createPublicClient, http } from 'viem';
import {
  base,
  mainnet,
  optimism,
  arbitrum,
  polygon,
  bsc,
  avalanche,
  linea,
  blast,
  zora,
} from 'viem/chains';

// Multi-chain public-client factory. The original `publicClient` export
// stays as the Base-pinned default (existing callers rely on it); the
// new `getPublicClient(chainId)` lookup serves the token-review onchain
// route, which needs to call `getCode` on top holders across whatever
// chain the reviewed token actually lives on.
//
// Base routes through Coinbase CDP (one of our paid lanes — avoids the
// 429s public RPCs hit on the candle page). Other chains use viem's
// built-in defaults; review-time usage is low (≤10 getCode calls per
// review) so the rate-limit ceiling is well above our actual load.

const cdpKey = process.env.NEXT_PUBLIC_CDP_CLIENT_API_KEY;
const baseRpcUrl = cdpKey
  ? `https://api.developer.coinbase.com/rpc/v1/base/${cdpKey}`
  : undefined;

export const publicClient = createPublicClient({
  chain: base,
  transport: http(baseRpcUrl, { batch: true }),
});

const CHAIN_BY_ID = {
  1: mainnet,
  8453: base,
  10: optimism,
  42161: arbitrum,
  137: polygon,
  56: bsc,
  43114: avalanche,
  59144: linea,
  81457: blast,
  7777777: zora,
};

// Cache built clients — viem's `createPublicClient` is cheap but the
// review fires multiple getCode calls per request; reusing the client
// lets viem's internal batching kick in.
const clientCache = new Map();

export function getPublicClient(chainId) {
  if (chainId === 8453) return publicClient;
  const cached = clientCache.get(chainId);
  if (cached) return cached;
  const chain = CHAIN_BY_ID[chainId];
  if (!chain) return null;
  const client = createPublicClient({
    chain,
    transport: http(undefined, { batch: true }),
  });
  clientCache.set(chainId, client);
  return client;
}
