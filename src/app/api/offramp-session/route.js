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
    'Access-Control-Allow-Headers': 'Content-Type, X-Onramp-Auth',
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

// Same IP extraction logic as onramp-session — CDP sell/token also requires
// the originating user IP for security validation. Set ONRAMP_DEV_CLIENT_IP
// in .env.local for local dev (find yours at https://api.ipify.org).
function getClientIp(request) {
  if (process.env.ONRAMP_DEV_CLIENT_IP) return process.env.ONRAMP_DEV_CLIENT_IP;
  const fastly = request.headers.get('fastly-client-ip');
  if (fastly) return fastly;
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    null
  );
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

  // Reuses the same custom header / JWT issued by /api/onramp-auth.
  const authHeader = request.headers.get('x-onramp-auth');
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

  const clientIp = getClientIp(request);
  if (!clientIp) {
    console.error(
      '[offramp-session] no public client IP — set ONRAMP_DEV_CLIENT_IP in .env.local for local dev'
    );
    return NextResponse.json(
      { error: 'Client IP not available' },
      { status: 500, headers: corsHeaders }
    );
  }

  try {
    const jwt = await generateJwt({
      apiKeyId: CDP_API_KEY_NAME,
      apiKeySecret: CDP_API_KEY_PRIVATE_KEY,
      requestMethod: 'POST',
      requestHost: 'api.developer.coinbase.com',
      requestPath: '/onramp/v1/sell/token',
      expiresIn: 120,
    });

    const response = await fetch('https://api.developer.coinbase.com/onramp/v1/sell/token', {
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
        clientIp,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Coinbase offramp session token error:', err);
      return NextResponse.json(
        { error: 'Failed to generate offramp session token' },
        { status: response.status, headers: corsHeaders }
      );
    }

    const data = await response.json();
    return NextResponse.json({ token: data.token }, { headers: corsHeaders });
  } catch (error) {
    console.error('Offramp session error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
