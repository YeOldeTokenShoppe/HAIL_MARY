import { NextResponse } from 'next/server';
import { generateJwt } from '@coinbase/cdp-sdk/auth';
import { getPublicClient } from '@/lib/viemClient';
import { fetchOnchainBundle as fetchEtherscanBundle } from '@/lib/review/etherscanClient';
import { fetchTopHolders, fetchHolderCount } from '@/lib/review/covalentClient';
import { chainNameFor, SUPPORTED_CHAIN_IDS } from '@/lib/review/cmcClient';

// /api/review/onchain — server-side onchain snapshot for the /trade Token
// Review service. Branches by chainId:
//   • 8453 (Base) → CDP SQL endpoint (deployer/supply/top-holders/activity
//     all from one indexed source — the original implementation).
//   • Other supported chains → Etherscan v2 (free tier) for deployer,
//     supply, source-verified, and activity; Covalent (free tier) for
//     the top-holder list.
//
// Output shape is chain-agnostic so /api/review/characters consumes it
// identically. POST body is { chainId, address }.

const CDP_API_KEY_NAME = process.env.CDP_API_KEY_NAME;
const CDP_API_KEY_PRIVATE_KEY = process.env.CDP_API_KEY_PRIVATE_KEY;

const CDP_HOST = 'api.cdp.coinbase.com';
const CDP_PATH = '/platform/v2/data/query/run';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

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

// ── Base / CDP path (existing — unchanged behavior) ─────────────────

async function runCdpQuery(sql) {
  const jwt = await generateJwt({
    apiKeyId: CDP_API_KEY_NAME,
    apiKeySecret: CDP_API_KEY_PRIVATE_KEY,
    requestMethod: 'POST',
    requestHost: CDP_HOST,
    requestPath: CDP_PATH,
    expiresIn: 120,
  });

  const res = await fetch(`https://${CDP_HOST}${CDP_PATH}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql,
      cache: { maxAgeMs: 5 * 60_000 },
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`CDP SQL ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`CDP SQL non-JSON response: ${text.slice(0, 200)}`);
  }
}

function buildCdpQueries(db, addressLower) {
  const tokenFilter = `address = '${addressLower}' AND event_name = 'Transfer' AND action = 'added'`;
  return {
    deployer: `
      SELECT
        lower(CAST(parameters['to'] AS String)) AS deployer,
        block_timestamp AS deployed_at,
        transaction_hash AS deploy_tx
      FROM ${db}.events
      WHERE ${tokenFilter}
        AND CAST(parameters['from'] AS String) = '${ZERO_ADDRESS}'
      ORDER BY block_timestamp ASC
      LIMIT 1
    `,
    totalSupply: `
      SELECT
        toString(
          sumIf(toInt256(CAST(parameters['value'] AS UInt256)), CAST(parameters['from'] AS String) = '${ZERO_ADDRESS}')
          - sumIf(toInt256(CAST(parameters['value'] AS UInt256)), CAST(parameters['to'] AS String) = '${ZERO_ADDRESS}')
        ) AS total_supply
      FROM ${db}.events
      WHERE ${tokenFilter}
    `,
    topHolders: `
      WITH transfers AS (
        SELECT
          lower(CAST(parameters['from'] AS String)) AS from_addr,
          lower(CAST(parameters['to'] AS String)) AS to_addr,
          CAST(parameters['value'] AS UInt256) AS value
        FROM ${db}.events
        WHERE ${tokenFilter}
      ),
      flows AS (
        SELECT to_addr AS holder, toInt256(value) AS delta FROM transfers
        UNION ALL
        SELECT from_addr AS holder, -toInt256(value) AS delta FROM transfers
      )
      SELECT
        holder,
        toString(SUM(delta)) AS balance
      FROM flows
      WHERE holder != '${ZERO_ADDRESS}'
      GROUP BY holder
      HAVING SUM(delta) > 0
      ORDER BY SUM(delta) DESC
      LIMIT 10
    `,
    activity: `
      SELECT
        toString(count()) AS transfer_count,
        toString(countIf(block_timestamp > now() - INTERVAL 30 DAY)) AS recent_30d,
        toString(countIf(block_timestamp > now() - INTERVAL 7 DAY))  AS recent_7d,
        toString(min(block_timestamp)) AS first_seen,
        toString(max(block_timestamp)) AS last_seen
      FROM ${db}.events
      WHERE ${tokenFilter}
    `,
    holderCount: `
      WITH transfers AS (
        SELECT
          lower(CAST(parameters['from'] AS String)) AS from_addr,
          lower(CAST(parameters['to'] AS String)) AS to_addr,
          CAST(parameters['value'] AS UInt256) AS value
        FROM ${db}.events
        WHERE ${tokenFilter}
      ),
      flows AS (
        SELECT to_addr AS holder, toInt256(value) AS delta FROM transfers
        UNION ALL
        SELECT from_addr AS holder, -toInt256(value) AS delta FROM transfers
      )
      SELECT toString(count()) AS holder_count
      FROM (
        SELECT holder, SUM(delta) AS balance
        FROM flows
        WHERE holder != '${ZERO_ADDRESS}'
        GROUP BY holder
        HAVING balance > 0
      )
    `,
  };
}

async function fetchBaseSnapshot({ chainId, addressLower }) {
  const queries = buildCdpQueries('base', addressLower);
  const [deployerRes, supplyRes, holdersRes, activityRes, holderCountRes] = await Promise.all([
    runCdpQuery(queries.deployer),
    runCdpQuery(queries.totalSupply),
    runCdpQuery(queries.topHolders),
    runCdpQuery(queries.activity),
    runCdpQuery(queries.holderCount),
  ]);

  const deployerRow = deployerRes?.result?.[0] || null;
  const supplyRow = supplyRes?.result?.[0] || null;
  const holders = (holdersRes?.result || []).map((row) => ({
    address: row.holder,
    balance: row.balance,
  }));
  const activityRow = activityRes?.result?.[0] || null;
  const holderCountRow = holderCountRes?.result?.[0] || null;

  const transferCount = activityRow ? Number(activityRow.transfer_count) : null;
  const recentTransferCount30d = activityRow ? Number(activityRow.recent_30d) : null;
  const recentTransferCount7d = activityRow ? Number(activityRow.recent_7d) : null;
  const firstSeen = activityRow?.first_seen || null;
  const lastSeen = activityRow?.last_seen || null;
  const holderCount = holderCountRow ? Number(holderCountRow.holder_count) : null;

  const totalSupply = supplyRow?.total_supply || null;

  return {
    chainId,
    deployer: deployerRow
      ? {
          address: deployerRow.deployer,
          deployedAt: deployerRow.deployed_at,
          deployTx: deployerRow.deploy_tx,
        }
      : null,
    totalSupply,
    holders,
    activity: {
      transferCount,
      recentTransferCount30d,
      recentTransferCount7d,
      firstSeen,
      lastSeen,
      holderCount,
    },
    sourceVerified: null, // CDP path doesn't surface this; etherscan
                          // path does. Set to null on Base.
  };
}

// ── Non-Base path: Etherscan + Covalent in parallel ─────────────────

async function fetchEtherscanCovalentSnapshot({ chainId, addressLower }) {
  const [etherscan, holdersBundle, holderCount] = await Promise.all([
    fetchEtherscanBundle({ chainId, address: addressLower }).catch((err) => {
      console.warn('[onchain] etherscan bundle failed:', err?.message || err);
      return null;
    }),
    fetchTopHolders({ chainId, address: addressLower, limit: 10 }).catch((err) => {
      console.warn('[onchain] covalent holders failed:', err?.message || err);
      return null;
    }),
    fetchHolderCount({ chainId, address: addressLower }).catch((err) => {
      console.warn('[onchain] covalent holder-count failed:', err?.message || err);
      return null;
    }),
  ]);

  // Total supply: prefer Etherscan's stats endpoint (canonical), fall
  // back to Covalent's per-row total_supply if Etherscan didn't return.
  const totalSupply = etherscan?.totalSupply || holdersBundle?.totalSupply || null;
  const holders = holdersBundle?.holders || [];

  // Activity block: Etherscan gives us the timing fields; holderCount
  // comes from Covalent's pagination metadata (Etherscan free doesn't
  // have it).
  const activity = etherscan?.activity
    ? { ...etherscan.activity, holderCount }
    : {
        transferCount: null,
        recentTransferCount30d: null,
        recentTransferCount7d: null,
        firstSeen: null,
        lastSeen: null,
        daysSinceDeployed: null,
        daysSinceLastTransfer: null,
        holderCount,
      };

  return {
    chainId,
    deployer: etherscan?.deployer || null,
    totalSupply,
    holders,
    activity,
    sourceVerified: etherscan?.sourceVerified ?? null,
    contractName: etherscan?.contractName || null,
  };
}

// ── Shared post-processing: shareBps + EOA/contract tags ─────────────

async function enrichHolders({ chainId, holders, totalSupply }) {
  let totalForShare = null;
  try {
    if (totalSupply) {
      const total = BigInt(totalSupply);
      if (total > 0n) totalForShare = total;
    }
  } catch {
    /* leave as null */
  }

  // shareBps
  if (totalForShare && totalForShare > 0n) {
    for (const h of holders) {
      try {
        h.shareBps = Number((BigInt(h.balance) * 10000n) / totalForShare);
      } catch {
        h.shareBps = null;
      }
    }
  } else {
    for (const h of holders) h.shareBps = null;
  }

  // isContract — per-chain viem public client (Base uses the CDP-backed
  // client; others use viem defaults). Soft-fail leaves isContract
  // undefined on a holder, which the prompt treats as ambiguous.
  const client = getPublicClient(chainId);
  if (client && holders.length > 0) {
    try {
      const codes = await Promise.all(
        holders.map((h) =>
          client
            .getCode({ address: h.address })
            .then((code) => (typeof code === 'string' && code.length > 2 ? code : null))
            .catch(() => null),
        ),
      );
      holders.forEach((h, i) => {
        h.isContract = codes[i] != null;
      });
    } catch (err) {
      console.warn('[onchain] getCode batch failed:', err?.message || err);
    }
  }

  // top10ShareBps — sum of top-10 shares against total.
  let top10ShareBps = null;
  if (totalForShare && totalForShare > 0n) {
    try {
      const top10Sum = holders.reduce((acc, h) => acc + BigInt(h.balance || '0'), 0n);
      top10ShareBps = Number((top10Sum * 10000n) / totalForShare);
    } catch {
      top10ShareBps = null;
    }
  }

  return { holders, top10ShareBps };
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

  const { chainId, address } = body || {};
  if (!Number.isInteger(chainId) || !SUPPORTED_CHAIN_IDS.includes(chainId)) {
    return NextResponse.json(
      { error: 'Unsupported chainId', supported: SUPPORTED_CHAIN_IDS },
      { status: 400, headers: corsHeaders },
    );
  }
  if (typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: 'Invalid address' },
      { status: 400, headers: corsHeaders },
    );
  }

  const addressLower = address.toLowerCase();

  // Branch on chain. Base keeps the CDP-only path (one indexed source);
  // other chains use Etherscan + Covalent.
  let snapshot;
  try {
    if (chainId === 8453) {
      if (!CDP_API_KEY_NAME || !CDP_API_KEY_PRIVATE_KEY) {
        return NextResponse.json(
          { error: 'CDP API keys not configured' },
          { status: 500, headers: corsHeaders },
        );
      }
      snapshot = await fetchBaseSnapshot({ chainId, addressLower });
    } else {
      snapshot = await fetchEtherscanCovalentSnapshot({ chainId, addressLower });
    }
  } catch (err) {
    console.error('[api/review/onchain]', err);
    return NextResponse.json(
      { error: 'Onchain snapshot failed', detail: String(err?.message || err) },
      { status: 502, headers: corsHeaders },
    );
  }

  const { holders, top10ShareBps } = await enrichHolders({
    chainId,
    holders: snapshot.holders,
    totalSupply: snapshot.totalSupply,
  });

  // daysSinceDeployed / daysSinceLastTransfer — the CDP path stored the
  // raw timestamps but didn't compute the day-deltas inline. Do it here
  // so both paths produce identical activity shape.
  const activity = { ...snapshot.activity };
  if (activity.daysSinceDeployed == null && activity.firstSeen) {
    const then = Date.parse(String(activity.firstSeen).replace(' ', 'T') + 'Z');
    if (!Number.isNaN(then)) {
      activity.daysSinceDeployed = Math.max(0, Math.floor((Date.now() - then) / 86400000));
    }
  }
  if (activity.daysSinceLastTransfer == null && activity.lastSeen) {
    const then = Date.parse(String(activity.lastSeen).replace(' ', 'T') + 'Z');
    if (!Number.isNaN(then)) {
      activity.daysSinceLastTransfer = Math.max(0, Math.floor((Date.now() - then) / 86400000));
    }
  }

  return NextResponse.json(
    {
      chainId: snapshot.chainId,
      chainName: chainNameFor(snapshot.chainId),
      address: addressLower,
      deployer: snapshot.deployer,
      totalSupply: snapshot.totalSupply,
      topHolders: holders,
      top10ShareBps,
      activity,
      sourceVerified: snapshot.sourceVerified ?? null,
      contractName: snapshot.contractName || null,
    },
    { headers: corsHeaders },
  );
}
