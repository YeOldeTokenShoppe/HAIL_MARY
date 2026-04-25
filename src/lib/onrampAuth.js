import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';

export const NONCE_TTL_MS = 10 * 60 * 1000;
export const SESSION_JWT_TTL_SEC = 5 * 60;
const SESSION_JWT_ISSUER = 'rl80.com';
const SESSION_JWT_AUDIENCE = 'rl80-onramp';

function secretKey(secret) {
  return new TextEncoder().encode(secret);
}

export async function issueSessionJwt(address, secret) {
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(address.toLowerCase())
    .setIssuer(SESSION_JWT_ISSUER)
    .setAudience(SESSION_JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_JWT_TTL_SEC}s`)
    .sign(secretKey(secret));
}

export async function verifySessionJwt(token, secret) {
  const { payload } = await jwtVerify(token, secretKey(secret), {
    issuer: SESSION_JWT_ISSUER,
    audience: SESSION_JWT_AUDIENCE,
  });
  return payload;
}

export function buildOnrampAuthMessage({ address, nonce, expiresAt }) {
  return [
    'RL80 Onramp Authorization',
    '',
    'I authorize minting a Coinbase Onramp session for:',
    `Address: ${address}`,
    `Nonce: ${nonce}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
  ].join('\n');
}

export function signEnvelope(message, secret) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

export function verifyEnvelope(message, envelope, secret) {
  if (typeof envelope !== 'string') return false;
  const expected = signEnvelope(message, secret);
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(envelope, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function generateNonce() {
  return crypto.randomBytes(32).toString('hex');
}
