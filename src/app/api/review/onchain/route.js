import { NextResponse } from 'next/server';
import { generateJwt } from '@coinbase/cdp-sdk/auth';
import { publicClient } from '@/lib/viemClient';

// /api/review/onchain — server-side onchain snapshot for the /trade Token
// Review service. Calls CDP's indexed-blockchain SQL endpoint to gather
// what Detective Trinity (marisol station) needs to compose her read:
//
//   • deployer EOA + first-mint timestamp + deploy tx hash
//   • total supply (computed from mints minus burns at the indexed level)
//   • top-10 net-balance holders + concentration ratios
//
// The CDP JWT pattern mirrors /api/swap/quote so the credential surface
// stays consistent. POST body is { chainId, address }.

const CDP_API_KEY_NAME = process.env.CDP_API_KEY_NAME;
const CDP_API_KEY_PRIVATE_KEY = process.env.CDP_API_KEY_PRIVATE_KEY;

const CDP_HOST = 'api.cdp.coinbase.com';
const CDP_PATH = '/platform/v2/data/query/run';

// Database name for the SQL endpoint. Map chainId → database. Base is
// the only one wired today (matches src/lib/wagmiConfig.js); add other
// chains here as transports land.
const CHAIN_TO_DATABASE = {
  8453: 'base',
};

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

// Run a single SQL against CDP. Each call gets its own JWT (the JWT
// auth signature is path+method-scoped; one signature covers any body
// to the same endpoint within the expiresIn window). We re-issue per
// call anyway because three queries is small and keeps the code linear.
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
      cache: { maxAgeMs: 5 * 60_000 }, // 5-minute CDP-side cache; same review hit twice is free.
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

// Five queries — deployer, total supply, top-10 holders, activity
// metrics (transfer counts + first/last seen), and distinct holder
// count. The activity + holder-count queries are what let the
// characters distinguish DORMANT (low/no activity, distributed over a
// long period) from RUG TEMPLATE (concentrated, recent, abandoned).
function buildQueries(db, addressLower) {
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

export async function POST(request) {
  const corsHeaders = getCorsHeaders(request);

  if (!CDP_API_KEY_NAME || !CDP_API_KEY_PRIVATE_KEY) {
    return NextResponse.json(
      { error: 'CDP API keys not configured' },
      { status: 500, headers: corsHeaders },
    );
  }

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
  if (!Number.isInteger(chainId) || !CHAIN_TO_DATABASE[chainId]) {
    return NextResponse.json(
      { error: 'Unsupported chainId', supported: Object.keys(CHAIN_TO_DATABASE).map(Number) },
      { status: 400, headers: corsHeaders },
    );
  }
  if (typeof address !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: 'Invalid address' },
      { status: 400, headers: corsHeaders },
    );
  }

  const db = CHAIN_TO_DATABASE[chainId];
  const addressLower = address.toLowerCase();
  const queries = buildQueries(db, addressLower);

  try {
    // Fire all queries in parallel — they're independent and the CDP
    // backend serves them concurrently.
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
      balance: row.balance, // String-encoded UInt256
    }));
    const activityRow = activityRes?.result?.[0] || null;
    const holderCountRow = holderCountRes?.result?.[0] || null;

    const transferCount = activityRow ? Number(activityRow.transfer_count) : null;
    const recentTransferCount30d = activityRow ? Number(activityRow.recent_30d) : null;
    const recentTransferCount7d = activityRow ? Number(activityRow.recent_7d) : null;
    const firstSeen = activityRow?.first_seen || null;
    const lastSeen = activityRow?.last_seen || null;
    const holderCount = holderCountRow ? Number(holderCountRow.holder_count) : null;

    // Days since the first Transfer event. Cheaper to compute server-
    // side than asking each character to do date math in their head.
    let daysSinceDeployed = null;
    if (firstSeen) {
      const then = Date.parse(firstSeen.replace(' ', 'T') + 'Z');
      if (!Number.isNaN(then)) {
        daysSinceDeployed = Math.max(0, Math.floor((Date.now() - then) / 86400000));
      }
    }
    let daysSinceLastTransfer = null;
    if (lastSeen) {
      const then = Date.parse(lastSeen.replace(' ', 'T') + 'Z');
      if (!Number.isNaN(then)) {
        daysSinceLastTransfer = Math.max(0, Math.floor((Date.now() - then) / 86400000));
      }
    }

    const totalSupplyStr = supplyRow?.total_supply || null;
    // Compute the top-10 share as basis points (0-10000). Done as
    // floating-point on the client side of this server (Node BigInt is
    // available but ratios are tiny floats). We sum holder balances as
    // BigInt, then divide.
    let top10ShareBps = null;
    let totalForShare = null;
    try {
      if (totalSupplyStr && holders.length > 0) {
        const total = BigInt(totalSupplyStr);
        if (total > 0n) {
          totalForShare = total;
          const top10Sum = holders.reduce((acc, h) => acc + BigInt(h.balance), 0n);
          // bps = top10Sum * 10000 / total. Multiply first to keep precision.
          top10ShareBps = Number((top10Sum * 10000n) / total);
        }
      }
    } catch {
      // BigInt parse failure — leave the share null; the caller falls
      // back to placeholder copy for the concentration question.
    }

    // Per-holder share + EOA-vs-contract detection. The contract check
    // is the missing signal that distinguishes "one whale holds the
    // float" (centralization risk) from "the LP / vault / staking
    // contract holds the float" (the *opposite* of risk — locked
    // liquidity reads as a structural good, not a structural bad).
    // viem's http transport batches the parallel getCode calls.
    try {
      const codes = await Promise.all(
        holders.map((h) =>
          publicClient
            .getCode({ address: h.address })
            .then((code) => (typeof code === 'string' && code.length > 2 ? code : null))
            .catch(() => null),
        ),
      );
      holders.forEach((h, i) => {
        h.isContract = codes[i] != null;
        if (totalForShare && totalForShare > 0n) {
          try {
            const bps = Number((BigInt(h.balance) * 10000n) / totalForShare);
            h.shareBps = bps;
          } catch {
            h.shareBps = null;
          }
        } else {
          h.shareBps = null;
        }
      });
    } catch (err) {
      console.warn('[review/onchain] getCode batch failed:', err?.message || err);
      // Soft-fail: leave isContract undefined on every holder. Trinity's
      // prompt will fall back to treating them as ambiguous addresses.
    }

    return NextResponse.json(
      {
        chainId,
        address: addressLower,
        deployer: deployerRow
          ? {
              address: deployerRow.deployer,
              deployedAt: deployerRow.deployed_at,
              deployTx: deployerRow.deploy_tx,
            }
          : null,
        totalSupply: totalSupplyStr,
        topHolders: holders,
        top10ShareBps,
        // Activity metrics — the inputs that distinguish DORMANT from
        // RUG TEMPLATE. The characters use these in their system prompts
        // to pick the right verdict for a low-activity contract.
        activity: {
          transferCount,
          recentTransferCount30d,
          recentTransferCount7d,
          holderCount,
          firstSeen,
          lastSeen,
          daysSinceDeployed,
          daysSinceLastTransfer,
        },
      },
      { headers: corsHeaders },
    );
  } catch (err) {
    console.error('[api/review/onchain]', err);
    return NextResponse.json(
      { error: 'Onchain snapshot failed', detail: String(err?.message || err) },
      { status: 502, headers: corsHeaders },
    );
  }
}
