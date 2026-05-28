import { SignJWT, jwtVerify } from 'jose';

const ISSUER = 'rl80.com';
const AUDIENCE = 'rl80-phone-verification';
// CDP requires phone re-verification within 60 days.
export const PHONE_JWT_TTL_SEC = 60 * 24 * 60 * 60;

function getSecretKey() {
  const secret = process.env.PHONE_VERIFICATION_SECRET;
  if (!secret) throw new Error('PHONE_VERIFICATION_SECRET not configured');
  return new TextEncoder().encode(secret);
}

export async function issuePhoneJwt(phoneNumber, verifiedAt) {
  const key = getSecretKey();
  return new SignJWT({ phoneNumber, verifiedAt })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${PHONE_JWT_TTL_SEC}s`)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .sign(key);
}

export async function verifyPhoneJwt(token) {
  const key = getSecretKey();
  const { payload } = await jwtVerify(token, key, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  return payload;
}
