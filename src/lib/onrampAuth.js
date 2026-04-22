import crypto from 'crypto';

export const NONCE_TTL_MS = 10 * 60 * 1000;

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
