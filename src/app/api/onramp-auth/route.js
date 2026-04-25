import { NextResponse } from 'next/server';
import { publicClient } from '@/lib/viemClient';
import {
  buildOnrampAuthMessage,
  verifyEnvelope,
  issueSessionJwt,
  SESSION_JWT_TTL_SEC,
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

function parseAuthMessage(message) {
  if (typeof message !== 'string') return null;
  const lines = message.split('\n');
  const kv = {};
  for (const line of lines) {
    const m = line.match(/^(Address|Nonce|Expires):\s*(.+)$/);
    if (m) kv[m[1]] = m[2];
  }
  if (!kv.Address || !kv.Nonce || !kv.Expires) return null;
  const expiresAt = Date.parse(kv.Expires);
  if (!Number.isFinite(expiresAt)) return null;
  return { address: kv.Address, nonce: kv.Nonce, expiresAt };
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
    const { address, message, envelope, signature } = await request.json();

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Valid wallet address is required' },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!message || !envelope || !signature) {
      return NextResponse.json(
        { error: 'Missing authorization fields' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!verifyEnvelope(message, envelope, secret)) {
      return NextResponse.json(
        { error: 'Invalid authorization envelope' },
        { status: 401, headers: corsHeaders }
      );
    }

    const parsed = parseAuthMessage(message);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Malformed authorization message' },
        { status: 400, headers: corsHeaders }
      );
    }
    const canonical = buildOnrampAuthMessage({
      address: parsed.address,
      nonce: parsed.nonce,
      expiresAt: parsed.expiresAt,
    });
    if (canonical !== message) {
      return NextResponse.json(
        { error: 'Malformed authorization message' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (parsed.address.toLowerCase() !== address.toLowerCase()) {
      return NextResponse.json(
        { error: 'Address mismatch' },
        { status: 401, headers: corsHeaders }
      );
    }

    if (Date.now() > parsed.expiresAt) {
      return NextResponse.json(
        { error: 'Authorization expired' },
        { status: 401, headers: corsHeaders }
      );
    }

    // ERC-1271 capable so Coinbase Smart Wallet works.
    const validSig = await publicClient.verifyMessage({
      address,
      message,
      signature,
    });
    if (!validSig) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401, headers: corsHeaders }
      );
    }

    const token = await issueSessionJwt(address, secret);
    return NextResponse.json(
      { token, expiresIn: SESSION_JWT_TTL_SEC },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Onramp auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
