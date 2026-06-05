import { verifyToken } from "@clerk/nextjs/server";

// Server-side identity for oil mutation endpoints. The client sends its Clerk
// session token as `Authorization: Bearer <token>`; we verify it and return the
// authenticated Clerk userId. NEVER trust a userId from the request body — that
// would let a player act as anyone. Returns null if unauthenticated.
export async function authedUserId(req) {
  const header = req.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    const payload = await verifyToken(match[1], {
      secretKey: process.env.CLERK_SECRET_KEY,
    });
    return payload?.sub || null;
  } catch (e) {
    console.warn("[oilAuth] token verify failed:", e.message);
    return null;
  }
}
