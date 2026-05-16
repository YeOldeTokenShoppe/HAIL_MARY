import { NextResponse } from 'next/server';
import { generateJwt } from '@coinbase/cdp-sdk/auth';
import { CHARACTER_PROMPTS, buildUserMessage } from '@/lib/review/characterPrompts';

// /api/review/characters — server-side Claude pipeline for the four
// Forensic Files characters. Fires four parallel calls (one per
// character) using the same `fetch('https://api.anthropic.com/v1/messages')`
// pattern as src/trading/agents/macro-specialist.js so the credential
// surface stays consistent across the app.
//
// Gated behind an x402 paywall (USDC on Base). First request returns
// HTTP 402 with the payment requirements; client signs an EIP-3009
// transferWithAuthorization and retries with X-PAYMENT header. The CDP
// facilitator handles verify + settle.
//
// Returns:
//   {
//     monk:    { intro, questions[], entries[], summary, verdict, _raw? },
//     demon:   { ... },
//     marisol: { ... },
//     eugene:  { ... },
//     consensus: {
//       verdicts: { monk, demon, marisol, eugene },     // each: believe|doubt|abstain
//       counts:   { believe, doubt, abstain },
//       leaning:  'believe' | 'doubt' | 'abstain' | 'split',
//       headline: short share-worthy synthesis line
//     }
//   }
//
// Failure handling is per-character: if one Claude call errors, that
// station falls back to a placeholder block but the other three still
// land. The consensus reflects only the stations that returned a real
// verdict.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = process.env.REVIEW_CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

// x402 paywall configuration.
const X402_PAY_TO = process.env.X402_PAY_TO || '0x9DD264CE36687f2763285ac30E74530D5B0b6f2b'; // RL80 treasury
const X402_PRICE_USDC_BASE_UNITS = process.env.X402_PRICE_USDC_BASE_UNITS || '50000'; // 0.05 USDC (6 decimals)
// USDC on Base mainnet. Verified address.
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const X402_NETWORK = 'base';
const X402_SCHEME = 'exact';
const X402_VERSION = 1;
const X402_RESOURCE = '/api/review/characters';
const X402_TIMEOUT_SECONDS = 300;
// CDP facilitator endpoints (same JWT auth pattern as the swap quote
// route uses for its own CDP calls).
const CDP_HOST = 'api.cdp.coinbase.com';
const CDP_X402_VERIFY_PATH = '/platform/v2/x402/verify';
const CDP_X402_SETTLE_PATH = '/platform/v2/x402/settle';
const CDP_API_KEY_NAME = process.env.CDP_API_KEY_NAME;
const CDP_API_KEY_PRIVATE_KEY = process.env.CDP_API_KEY_PRIVATE_KEY;

// Build the x402 paymentRequirements object — the resource server's
// statement of what it expects. The same shape is sent to both the
// client (in the 402 challenge body) and the CDP facilitator (in
// verify + settle calls).
function buildPaymentRequirements({ tickerLabel } = {}) {
  return {
    scheme: X402_SCHEME,
    network: X402_NETWORK,
    maxAmountRequired: X402_PRICE_USDC_BASE_UNITS,
    resource: X402_RESOURCE,
    description: tickerLabel ? `Forensic File for ${tickerLabel}` : 'Forensic File — four-character token review',
    mimeType: 'application/json',
    payTo: X402_PAY_TO,
    maxTimeoutSeconds: X402_TIMEOUT_SECONDS,
    asset: USDC_BASE,
    // EIP-712 domain hints so the client signTypedData call matches the
    // exact USDC contract on Base.
    extra: { name: 'USD Coin', version: '2' },
  };
}

// 402 challenge body — what the client receives when no X-PAYMENT
// header is present (or when verify/settle fails).
function buildChallengeBody({ tickerLabel, errorReason } = {}) {
  return {
    x402Version: X402_VERSION,
    accepts: [buildPaymentRequirements({ tickerLabel })],
    error: errorReason || 'Payment required',
  };
}

// CDP-facilitator call. Same JWT-per-request pattern as the swap quote
// route. CDP signs/verifies the EIP-3009 authorization for us; we just
// pass through the payment payload + requirements.
async function cdpFacilitatorCall(path, body) {
  if (!CDP_API_KEY_NAME || !CDP_API_KEY_PRIVATE_KEY) {
    throw new Error('CDP API keys not configured');
  }
  const jwt = await generateJwt({
    apiKeyId: CDP_API_KEY_NAME,
    apiKeySecret: CDP_API_KEY_PRIVATE_KEY,
    requestMethod: 'POST',
    requestHost: CDP_HOST,
    requestPath: path,
    expiresIn: 120,
  });
  const res = await fetch(`https://${CDP_HOST}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`CDP ${path} ${res.status}: ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`CDP ${path} non-JSON: ${text.slice(0, 200)}`);
  }
}

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

// Single Claude call for one character. Returns parsed JSON or throws.
async function callCharacter(stationKey, system, userMsg) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        system,
        messages: [{ role: 'user', content: userMsg }],
        max_tokens: 1200,
        // Lower temperature on Trinity (factual onchain reads benefit
        // from less variance), higher on Demon/Eugene whose value is in
        // the entertainment voice.
        temperature: stationKey === 'marisol' ? 0.5 : 0.85,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data?.content?.[0]?.text;
    if (typeof text !== 'string') {
      throw new Error('Anthropic returned no text content');
    }
    return parseCharacterJson(text);
  } finally {
    clearTimeout(timeoutId);
  }
}

// Pull JSON out of the model output. Strict JSON-only is what the system
// prompt asks for, but models occasionally wrap in ```json fences or
// add a single-line preamble. Be defensive: strip fences, find the
// first {...} block.
function parseCharacterJson(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  }
  // Slice to the outermost {...}.
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('No JSON object found in character response');
  }
  const slice = cleaned.slice(first, last + 1);
  const parsed = JSON.parse(slice);
  // Light schema validation — anything else gets filled in by the
  // caller's placeholder fallback so the funnel never freezes on a
  // half-baked response.
  if (typeof parsed.intro !== 'string') parsed.intro = '';
  if (!Array.isArray(parsed.questions)) parsed.questions = [];
  if (!Array.isArray(parsed.entries)) parsed.entries = [];
  if (typeof parsed.summary !== 'string') parsed.summary = '';
  // Four-state verdict — DORMANT is structurally different from
  // ABSTAIN (see characterPrompts.js for the distinction). Default
  // to DORMANT on parse failure rather than ABSTAIN, since a missing
  // verdict on a low-data token is far more likely "couldn't read
  // it" than "deliberately withholding."
  if (!['believe', 'doubt', 'abstain', 'dormant'].includes(parsed.verdict)) {
    parsed.verdict = 'dormant';
  }
  return parsed;
}

// Per-character fallback when Claude errors. Keeps the station playable
// even when one call fails; that station just doesn't contribute to the
// consensus.
function fallbackStation(stationKey, ticker) {
  return {
    intro: `Standing by.`,
    questions: [
      {
        q: 'What can you tell me about this token?',
        a: `My read on ${ticker || 'this token'} did not complete. Try again in a moment.`,
        reveals: 'OFFLINE',
      },
    ],
    entries: [
      { label: 'OFFLINE', value: 'Character offline — try the review again', threat: 'amber' },
    ],
    summary: 'No reading available.',
    verdict: null, // null verdict → excluded from consensus
    _fallback: true,
  };
}

function computeConsensus(verdicts) {
  const counts = { believe: 0, doubt: 0, abstain: 0, dormant: 0 };
  let total = 0;
  for (const v of Object.values(verdicts)) {
    if (v === 'believe' || v === 'doubt' || v === 'abstain' || v === 'dormant') {
      counts[v]++;
      total++;
    }
  }
  if (total === 0) {
    return { verdicts, counts, leaning: 'dormant', headline: 'No team reading available.' };
  }
  // Find the plurality.
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [topLabel, topCount] = entries[0];
  const [, secondCount] = entries[1];
  const leaning = topCount > secondCount ? topLabel : 'split';
  const verdictNoun = {
    believe: 'BELIEVE',
    doubt: 'DOUBT',
    abstain: 'ABSTAIN',
    dormant: 'DORMANT',
  };
  // DORMANT majority gets a specific headline that frames the verdict
  // honestly — "team agrees there isn't enough signal" rather than the
  // ambiguous "X of N say DORMANT" which reads like an indictment.
  let headline;
  if (leaning === 'split') {
    const parts = [];
    if (counts.believe) parts.push(`${counts.believe} believe`);
    if (counts.doubt) parts.push(`${counts.doubt} doubt`);
    if (counts.abstain) parts.push(`${counts.abstain} abstain`);
    if (counts.dormant) parts.push(`${counts.dormant} dormant`);
    headline = `Team is split — ${parts.join(' / ')}`;
  } else if (leaning === 'dormant') {
    headline =
      total === 4
        ? 'All four agree: insufficient activity to render a verdict'
        : `${topCount} of ${total} say there isn't enough signal yet`;
  } else {
    headline = `${topCount} of ${total} say ${verdictNoun[topLabel]}`;
  }
  return { verdicts, counts, leaning, headline };
}

export async function POST(request) {
  const corsHeaders = getCorsHeaders(request);

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured' },
      { status: 500, headers: corsHeaders },
    );
  }

  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json({ error: 'Unauthorized origin' }, { status: 403, headers: corsHeaders });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders });
  }

  const { token, onchain } = body || {};
  if (!token || typeof token !== 'object' || !token.address) {
    return NextResponse.json({ error: 'Missing token info' }, { status: 400, headers: corsHeaders });
  }
  const ticker = token.symbol || '';
  const tickerLabel = ticker ? `$${ticker}` : 'this token';

  // ── x402 paywall ────────────────────────────────────────────────
  // Two paths. (1) No X-PAYMENT header → 402 with the challenge body
  // describing what we expect (amount, asset, payTo, network).
  // (2) X-PAYMENT present → decode + verify + settle through the CDP
  // facilitator; only proceed to the LLM pipeline if both succeed.
  const paymentRequirements = buildPaymentRequirements({ tickerLabel });
  const paymentHeader = request.headers.get('x-payment');

  if (!paymentHeader) {
    return NextResponse.json(
      buildChallengeBody({ tickerLabel }),
      { status: 402, headers: corsHeaders },
    );
  }

  // Decode the X-PAYMENT header — base64-encoded JSON per the x402 spec.
  let paymentPayload;
  try {
    const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8');
    paymentPayload = JSON.parse(decoded);
  } catch (err) {
    return NextResponse.json(
      buildChallengeBody({ tickerLabel, errorReason: 'Malformed X-PAYMENT header' }),
      { status: 402, headers: corsHeaders },
    );
  }

  // Verify first — cheap, no broadcast. Surface a 402 with the
  // facilitator's invalidReason so the client can correct (e.g.
  // insufficient balance, expired authorization).
  try {
    const verifyRes = await cdpFacilitatorCall(CDP_X402_VERIFY_PATH, {
      x402Version: X402_VERSION,
      paymentPayload,
      paymentRequirements,
    });
    if (!verifyRes?.isValid) {
      return NextResponse.json(
        buildChallengeBody({
          tickerLabel,
          errorReason: verifyRes?.invalidReason || 'Payment verification failed',
        }),
        { status: 402, headers: corsHeaders },
      );
    }
  } catch (err) {
    // Surface the actual CDP error in the response body so we can debug
    // the network/auth/path/body issue without digging through dev-
    // server logs. Tighten this back to a generic message before
    // production.
    console.error('[review/characters] x402 verify error:', err);
    return NextResponse.json(
      buildChallengeBody({
        tickerLabel,
        errorReason: `Verifier unavailable: ${String(err?.message || err).slice(0, 400)}`,
      }),
      { status: 402, headers: corsHeaders },
    );
  }

  // Settle — broadcasts the transferWithAuthorization. We hold the LLM
  // response on the success path until this returns so the user never
  // pays without receiving the report.
  let settleResult = null;
  try {
    settleResult = await cdpFacilitatorCall(CDP_X402_SETTLE_PATH, {
      x402Version: X402_VERSION,
      paymentPayload,
      paymentRequirements,
    });
    if (settleResult?.success === false) {
      return NextResponse.json(
        buildChallengeBody({
          tickerLabel,
          errorReason: settleResult?.errorReason || 'Settlement failed',
        }),
        { status: 402, headers: corsHeaders },
      );
    }
  } catch (err) {
    console.error('[review/characters] x402 settle error:', err);
    return NextResponse.json(
      buildChallengeBody({ tickerLabel, errorReason: 'Settlement unavailable' }),
      { status: 402, headers: corsHeaders },
    );
  }

  // Echo back the settle result via the X-PAYMENT-RESPONSE header per
  // the x402 spec so the client can surface the tx hash if it wants to.
  const paymentResponseHeader = Buffer.from(JSON.stringify(settleResult || {})).toString('base64');
  const responseHeaders = { ...corsHeaders, 'X-PAYMENT-RESPONSE': paymentResponseHeader };

  // ── LLM pipeline (existing) ─────────────────────────────────────
  const userMsg = buildUserMessage({ token, onchain });

  const stationKeys = ['monk', 'demon', 'marisol', 'eugene'];
  const results = await Promise.all(
    stationKeys.map(async (key) => {
      const prompt = CHARACTER_PROMPTS[key];
      if (!prompt) return [key, fallbackStation(key, ticker)];
      try {
        const parsed = await callCharacter(key, prompt.system, userMsg);
        return [key, parsed];
      } catch (err) {
        console.error(`[review/characters] ${key} failed:`, err?.message || err);
        return [key, fallbackStation(key, ticker)];
      }
    }),
  );

  const characters = Object.fromEntries(results);
  const consensus = computeConsensus({
    monk: characters.monk?.verdict,
    demon: characters.demon?.verdict,
    marisol: characters.marisol?.verdict,
    eugene: characters.eugene?.verdict,
  });

  return NextResponse.json(
    {
      model: CLAUDE_MODEL,
      characters,
      consensus,
    },
    { headers: responseHeaders },
  );
}
