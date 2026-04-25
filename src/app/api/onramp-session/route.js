import { NextResponse } from 'next/server';
import { generateJwt } from '@coinbase/cdp-sdk/auth';
import { verifySessionJwt } from '@/lib/onrampAuth';

const CDP_API_KEY_NAME = process.env.CDP_API_KEY_NAME;
const CDP_API_KEY_PRIVATE_KEY = process.env.CDP_API_KEY_PRIVATE_KEY;

const ALLOWED_ORIGINS = [
  'https://rl80.com',
  'https://www.rl80.com',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
].filter(Boolean);

function getCorsHeaders(request) {
  const origin = request.headers.get('origin');
  const headers = {
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
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

  const secret = process.env.ONRAMP_AUTH_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'Onramp auth secret not configured' },
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

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing bearer token' },
      { status: 401, headers: corsHeaders }
    );
  }
  const bearer = authHeader.slice('Bearer '.length).trim();

  let payload;
  try {
    payload = await verifySessionJwt(bearer, secret);
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid or expired session token' },
      { status: 401, headers: corsHeaders }
    );
  }

  const address = typeof payload.sub === 'string' ? payload.sub : null;
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: 'Invalid session subject' },
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    const jwt = await generateJwt({
      apiKeyId: CDP_API_KEY_NAME,
      apiKeySecret: CDP_API_KEY_PRIVATE_KEY,
      requestMethod: 'POST',
      requestHost: 'api.developer.coinbase.com',
      requestPath: '/onramp/v1/token',
      expiresIn: 120,
    });

    const response = await fetch('https://api.developer.coinbase.com/onramp/v1/token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addresses: [
          {
            address,
            blockchains: ['base'],
          },
        ],
        assets: ['ETH', 'USDC'],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Coinbase session token error:', err);
      return NextResponse.json(
        { error: 'Failed to generate session token' },
        { status: response.status, headers: corsHeaders }
      );
    }

    const data = await response.json();
    return NextResponse.json({ token: data.token }, { headers: corsHeaders });
  } catch (error) {
    console.error('Onramp session error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
