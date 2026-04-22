import { NextResponse } from 'next/server';
import {
  buildOnrampAuthMessage,
  generateNonce,
  signEnvelope,
  NONCE_TTL_MS,
} from '@/lib/onrampAuth';

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

  try {
    const { address } = await request.json();
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Valid wallet address is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const checksumAddress = address;
    const nonce = generateNonce();
    const expiresAt = Date.now() + NONCE_TTL_MS;
    const message = buildOnrampAuthMessage({
      address: checksumAddress,
      nonce,
      expiresAt,
    });
    const envelope = signEnvelope(message, secret);

    return NextResponse.json(
      { message, envelope, expiresAt },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Onramp nonce error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
