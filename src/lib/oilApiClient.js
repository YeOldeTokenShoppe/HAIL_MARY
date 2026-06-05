"use client";

import { useCallback } from "react";
import { useClerk } from "@clerk/nextjs";

// Shared client helper: fetch an oil mutation endpoint with the Clerk session
// token attached as `Authorization: Bearer <token>`, so the server verifies the
// caller's identity from the session (never a userId in the body).
export function useOilApiFetch() {
  const clerk = useClerk();
  return useCallback(async (url, opts = {}) => {
    let token = null;
    try { token = await clerk.session?.getToken(); } catch {}
    return fetch(url, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers || {}),
      },
    });
  }, [clerk]);
}
