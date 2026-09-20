// Signing in and out of the lineup page. The password is compared here, on
// the server, and never reaches the browser — see src/lib/ltTv/lineupAuth.mjs
// for why that matters and what the older /admin page does instead.

import { cookies, headers } from "next/headers";
import {
  SESSION_COOKIE,
  checkPassword,
  clearFailures,
  cookieOptions,
  isLockedOut,
  issueToken,
  recordFailure,
} from "@/lib/ltTv/lineupAuth.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Every rejection says the same thing. A message that distinguished "no
// password set" from "wrong password" would be telling an attacker which
// problem to solve.
const REFUSED = { ok: false, error: "Wrong password." };

async function callerId() {
  try {
    const head = await headers();
    const forwarded = head.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return head.get("x-real-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

export async function POST(request) {
  const id = await callerId();

  if (isLockedOut(id)) {
    return Response.json(
      { ok: false, error: "Too many attempts. Try again in a few minutes." },
      { status: 429 },
    );
  }

  let password = null;
  try {
    const body = await request.json();
    password = body?.password ?? null;
  } catch {
    // An unparseable body is just a wrong password, handled below.
  }

  if (!checkPassword(password)) {
    recordFailure(id);
    return Response.json(REFUSED, { status: 401 });
  }

  const token = issueToken();
  if (!token) {
    recordFailure(id);
    return Response.json(REFUSED, { status: 401 });
  }

  clearFailures(id);
  const store = await cookies();
  store.set(
    SESSION_COOKIE,
    token,
    cookieOptions({ secure: process.env.NODE_ENV !== "development" }),
  );
  return Response.json({ ok: true });
}

export async function DELETE() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
