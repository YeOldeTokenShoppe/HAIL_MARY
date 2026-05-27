import { NextResponse } from 'next/server';
import { erc20Abi } from 'viem';
import { getTokenByAddress, chainNameFor, SUPPORTED_CHAIN_IDS } from '@/lib/review/cmcClient';
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
//         { unknown: true, _debug: '...' }
//
// Free of x402 — chain detection is cheap and we don't want a wallet
// prompt before the user even knows their address is a real token.
// CMC cost (and Anthropic cost downstream) is folded into the
// /api/review/characters x402 charge.
//
// Resolution strategy:
//   1. CMC chain-detect (covers ~50 chains, returns market context).
//   2. If CMC fails — direct ERC-20 reads on all 10 supported chains
//      in parallel. First chain that responds with valid name+symbol wins.
//   3. If both fail → { unknown: true, _debug }.

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

  // Step 1 — CMC chain-detect. Soft-fail so the fallback probes can
  // still resolve the token.
  let cmc = null;
  let cmcDebug = null;
  try {
    cmc = await getTokenByAddress(address);
    if (!cmc) {
      cmcDebug = 'CMC returned no data for this address';
    } else if (!cmc.primary) {
      cmcDebug = `CMC found token "${cmc.name || '?'}" (id ${cmc.cmcId}) but no platform matched a supported chain`;
    }
  } catch (err) {
    cmcDebug = `CMC lookup threw: ${err?.message || err}`;
  }
  if (cmcDebug) {
    console.warn(`[review/resolve] ${address}: ${cmcDebug}`);
  }

  if (!cmc || !cmc.primary) {
    // Step 2 — CMC miss. Probe all supported chains in parallel via
    // direct ERC-20 reads. First chain with valid name+symbol wins.
    const probeResults = await Promise.all(
      SUPPORTED_CHAIN_IDS.map((chainId) =>
        readErc20OnChain({ chainId, address }).then((r) =>
          r?.name && r?.symbol ? { chainId, ...r } : null,
        ),
      ),
    );

    const found = probeResults.find((r) => r != null) || null;

    if (!found) {
      console.warn(`[review/resolve] ${address}: all fallbacks failed`);
      return NextResponse.json(
        { unknown: true, _debug: cmcDebug || 'all resolution paths failed' },
        { headers: corsHeaders },
      );
    }

    console.info(
      `[review/resolve] ${address}: resolved via erc20-probe → ${chainNameFor(found.chainId)} (${found.symbol})`,
    );

    return NextResponse.json(
      {
        chainId: found.chainId,
        chainName: chainNameFor(found.chainId),
        address: address.toLowerCase(),
        name: found.name,
        symbol: found.symbol,
        decimals: found.decimals ?? 18,
        market: null,
        cmcId: null,
        logo: null,
        alternatives: [],
      },
      { headers: corsHeaders },
    );
  }

  const { chainId, chainName, address: resolvedAddress } = cmc.primary;

  // Step 3 — fill in decimals (CMC's `/v2/cryptocurrency/info` doesn't
  // include them) and double-check name/symbol against the contract.
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
