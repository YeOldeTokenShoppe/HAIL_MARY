import { NextResponse } from 'next/server';
import twilio from 'twilio';
import { issuePhoneJwt, PHONE_JWT_TTL_SEC } from '@/lib/phoneVerification';

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

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!sid || !token || !verifyServiceSid) {
    return NextResponse.json(
      { error: 'Phone verification service not configured' },
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
    const { phoneNumber, code } = await request.json();
    if (!phoneNumber || !/^\+1\d{10}$/.test(phoneNumber)) {
      return NextResponse.json(
        { error: 'Valid US phone number is required' },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!code || !/^\d{4,8}$/.test(code)) {
      return NextResponse.json(
        { error: 'Valid verification code is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const client = twilio(sid, token);
    const check = await client.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({ to: phoneNumber, code });

    if (check.status !== 'approved') {
      return NextResponse.json(
        { error: 'Invalid code. Please try again.' },
        { status: 401, headers: corsHeaders }
      );
    }

    const verifiedAt = new Date().toISOString();
    const jwt = await issuePhoneJwt(phoneNumber, verifiedAt);

    return NextResponse.json(
      { token: jwt, phoneNumber, verifiedAt, expiresIn: PHONE_JWT_TTL_SEC },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Phone OTP verify error:', error);
    const msg = error?.message || 'Failed to verify code';
    return NextResponse.json(
      { error: msg },
      { status: 500, headers: corsHeaders }
    );
  }
}
