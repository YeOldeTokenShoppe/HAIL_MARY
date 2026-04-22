import { NextResponse } from 'next/server';
import { generateJwt } from '@coinbase/cdp-sdk/auth';

const CDP_API_KEY_NAME = process.env.CDP_API_KEY_NAME;
const CDP_API_KEY_PRIVATE_KEY = process.env.CDP_API_KEY_PRIVATE_KEY;

const CDP_HOST = 'api.cdp.coinbase.com';
const CDP_PATH = '/platform/v2/evm/swaps';

const ALLOWED_ORIGINS = [
  'https://rl80.com',
  'https://www.rl80.com',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
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

export async function POST(request) {
  const corsHeaders = getCorsHeaders(request);

  if (!CDP_API_KEY_NAME || !CDP_API_KEY_PRIVATE_KEY) {
    return NextResponse.json(
      { error: 'CDP API keys not configured' },
      { status: 500, headers: corsHeaders }
    );
  }

  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json(
      { error: 'Unauthorized origin' },
      { status: 403, headers: corsHeaders }
    );
  }

  try {
    const body = await request.json();
    const { fromToken, toToken, fromAmount, taker, slippageBps } = body;

    const addressPattern = /^0x[a-fA-F0-9]{40}$/;
    if (
      !addressPattern.test(fromToken) ||
      !addressPattern.test(toToken) ||
      !addressPattern.test(taker) ||
      typeof fromAmount !== 'string' ||
      !/^\d+$/.test(fromAmount)
    ) {
      return NextResponse.json(
        { error: 'Invalid swap parameters' },
        { status: 400, headers: corsHeaders }
      );
    }

    const cdpBody = {
      network: 'base',
      fromToken,
      toToken,
      fromAmount,
      taker,
    };
    if (Number.isInteger(slippageBps)) {
      cdpBody.slippageBps = slippageBps;
    }

    const jwt = await generateJwt({
      apiKeyId: CDP_API_KEY_NAME,
      apiKeySecret: CDP_API_KEY_PRIVATE_KEY,
      requestMethod: 'POST',
      requestHost: CDP_HOST,
      requestPath: CDP_PATH,
      expiresIn: 120,
    });

    const cdpRes = await fetch(`https://${CDP_HOST}${CDP_PATH}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(cdpBody),
    });

    const text = await cdpRes.text();
    if (!cdpRes.ok) {
      console.error('CDP swap execute error:', cdpRes.status, text);
      return NextResponse.json(
        { error: 'Swap unavailable', detail: text },
        { status: cdpRes.status, headers: corsHeaders }
      );
    }

    return new NextResponse(text, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Swap execute error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
