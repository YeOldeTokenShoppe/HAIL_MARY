import { NextResponse } from 'next/server';
import { generateJwt } from '@coinbase/cdp-sdk/auth';
import { verifyPhoneJwt } from '@/lib/phoneVerification';

const CDP_API_KEY_NAME = process.env.CDP_API_KEY_NAME;
const CDP_API_KEY_PRIVATE_KEY = process.env.CDP_API_KEY_PRIVATE_KEY;

const CDP_HOST = 'api.cdp.coinbase.com';
const CDP_PATH = '/platform/v2/onramp/orders';

const ALLOWED_ORIGINS = [
  'https://rl80.com',
  'https://www.rl80.com',
  process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
].filter(Boolean);

const VALID_PURCHASE_CURRENCIES = ['ETH', 'USDC'];
const VALID_PAYMENT_METHODS = ['GUEST_CHECKOUT_APPLE_PAY', 'GUEST_CHECKOUT_GOOGLE_PAY'];
const PHONE_VERIFICATION_MAX_DAYS = 60;

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

  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json(
      { error: 'Unauthorized origin' },
      { status: 403, headers: corsHeaders }
    );
  }

  try {
    const body = await request.json();
    const {
      destinationAddress,
      email,
      phoneVerificationToken,
      paymentMethod,
      purchaseCurrency,
      paymentAmount,
      purchaseAmount,
      partnerUserRef,
    } = body;

    if (!destinationAddress || !/^0x[a-fA-F0-9]{40}$/.test(destinationAddress)) {
      return NextResponse.json(
        { error: 'Valid wallet address is required' },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Verified email is required' },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!phoneVerificationToken) {
      return NextResponse.json(
        { error: 'Phone verification is required' },
        { status: 400, headers: corsHeaders }
      );
    }
    let phoneNumber;
    let phoneNumberVerifiedAt;
    try {
      const payload = await verifyPhoneJwt(phoneVerificationToken);
      phoneNumber = payload.phoneNumber;
      phoneNumberVerifiedAt = payload.verifiedAt;
    } catch {
      return NextResponse.json(
        { error: 'Phone verification has expired. Please re-verify your phone number.' },
        { status: 401, headers: corsHeaders }
      );
    }
    if (!phoneNumber || !/^\+1\d{10}$/.test(phoneNumber)) {
      return NextResponse.json(
        { error: 'Phone verification token is malformed' },
        { status: 400, headers: corsHeaders }
      );
    }
    const verifiedDate = new Date(phoneNumberVerifiedAt);
    const daysSinceVerification = (Date.now() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceVerification > PHONE_VERIFICATION_MAX_DAYS) {
      return NextResponse.json(
        { error: 'Phone verification has expired. Please re-verify your phone number.' },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      return NextResponse.json(
        { error: `Payment method must be one of: ${VALID_PAYMENT_METHODS.join(', ')}` },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!VALID_PURCHASE_CURRENCIES.includes(purchaseCurrency)) {
      return NextResponse.json(
        { error: `Purchase currency must be one of: ${VALID_PURCHASE_CURRENCIES.join(', ')}` },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!paymentAmount && !purchaseAmount) {
      return NextResponse.json(
        { error: 'Either paymentAmount or purchaseAmount is required' },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!partnerUserRef || typeof partnerUserRef !== 'string') {
      return NextResponse.json(
        { error: 'Partner user reference is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const resolvedPartnerUserRef =
      process.env.NODE_ENV === 'production'
        ? partnerUserRef
        : `sandbox-${partnerUserRef}`;

    const clientIp = getClientIp(request);

    const domain =
      process.env.NODE_ENV === 'production' ? 'rl80.com' : undefined;

    const cdpBody = {
      agreementAcceptedAt: new Date().toISOString(),
      destinationAddress,
      destinationNetwork: 'base',
      email,
      partnerUserRef: resolvedPartnerUserRef,
      paymentCurrency: 'USD',
      paymentMethod,
      phoneNumber,
      phoneNumberVerifiedAt,
      purchaseCurrency,
    };
    if (paymentAmount) cdpBody.paymentAmount = paymentAmount;
    if (purchaseAmount) cdpBody.purchaseAmount = purchaseAmount;
    if (domain) cdpBody.domain = domain;
    if (clientIp) cdpBody.clientIp = clientIp;

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
      console.error('CDP onramp order error:', cdpRes.status, text);
      return NextResponse.json(
        { error: 'Failed to create onramp order', detail: text },
        { status: cdpRes.status, headers: corsHeaders }
      );
    }

    return new NextResponse(text, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Onramp order error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
