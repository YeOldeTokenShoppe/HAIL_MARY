import { NextResponse } from 'next/server';
import { erc20Abi } from 'viem';
import { getTokenByAddress, chainNameFor } from '@/lib/review/cmcClient';
import { getPublicClient } from '@/lib/viemClient';

// /api/review/resolve — paste-and-detect endpoint for the /trade Token
// Review service.
//
// Input:  POST { address: '0x...' }
// Output: {
//           chainId, chainName,
//           name, symbol, decimals,
//           market: { price, marketCap, volume24h, percentChange24h, cmcRank, dateAdded } | null,
//           cmcId, logo,
//           alternatives: [{ chainId, chainName, address }]  // other chains it deploys to
//         }
// Or on unknown:
//         { unknown: true }
//
// Free of x402 — chain detection is cheap and we don't want a wallet
// prompt before the user even knows their address is a real token.
// CMC cost (and Anthropic cost downstream) is folded into the
// /api/review/characters x402 charge.
//
// If CMC has no record of the address we return { unknown: true }; the
// client falls back to the original Base/CDP path. That covers brand-
// new launches that CMC hasn't indexed yet.

const ALLOWED_ORIGINS = [
  'https://rl80.com',
  'https://www.rl80.com',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
  process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : null,
].filter(Boolean);

function getCorsHeaders(request) {
  const origin = request.headers.get('origin');
  const headers = {
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export async function OPTIONS(request) {
  return NextResponse.json({}, { headers: getCorsHeaders(request) });
}

// Fill in decimals (and name/symbol if CMC didn't have them) by reading
// the ERC-20 contract directly on the resolved chain. One multicall per
// resolve — cheap.
async function readErc20OnChain({ chainId, address }) {
  const client = getPublicClient(chainId);
  if (!client) return null;
  try {
    const [name, symbol, decimals] = await Promise.all([
      client.readContract({ address, abi: erc20Abi, functionName: 'name' }).catch(() => null),
      client.readContract({ address, abi: erc20Abi, functionName: 'symbol' }).catch(() => null),
      client.readContract({ address, abi: erc20Abi, functionName: 'decimals' }).catch(() => null),
    ]);
    return {
      name: typeof name === 'string' ? name : null,
      symbol: typeof symbol === 'string' ? symbol : null,
      decimals: typeof decimals === 'number' ? decimals : null,
    };
  } catch (err) {
    console.warn('[review/resolve] erc20 read failed:', err?.message || err);
    return null;
  }
}

export async function POST(request) {
  const corsHeaders = getCorsHeaders(request);

  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json(
      { error: 'Unauthorized origin' },
      { status: 403, headers: corsHeaders },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: corsHeaders },
    );
  }

  const { address } = body || {};
  if (typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: 'Invalid address' },
      { status: 400, headers: corsHeaders },
    );
  }

  // Step 1 — CMC chain-detect. Soft-fail to "unknown" on any error so
  // the client always has a path forward (Base fallback).
  let cmc = null;
  try {
    cmc = await getTokenByAddress(address);
  } catch (err) {
    console.warn('[review/resolve] CMC lookup failed:', err?.message || err);
  }

  if (!cmc || !cmc.primary) {
    return NextResponse.json({ unknown: true }, { headers: corsHeaders });
  }

  const { chainId, chainName, address: resolvedAddress } = cmc.primary;

  // Step 2 — fill in decimals (CMC's `/v2/cryptocurrency/info` doesn't
  // include them) and double-check name/symbol against the contract.
  // If the chain-specific RPC fails (rate limit, unsupported chain),
  // fall back to CMC's name/symbol and a sensible decimals default.
  const onchainErc20 = await readErc20OnChain({ chainId, address: resolvedAddress });

  return NextResponse.json(
    {
      chainId,
      chainName: chainName || chainNameFor(chainId),
      address: resolvedAddress,
      name: onchainErc20?.name || cmc.name || null,
      symbol: onchainErc20?.symbol || cmc.symbol || null,
      decimals: onchainErc20?.decimals ?? 18,
      market: cmc.market,
      cmcId: cmc.cmcId,
      logo: cmc.logo,
      alternatives: cmc.alternatives || [],
    },
    { headers: corsHeaders },
  );
}
