// Single source of truth for the Base JSON-RPC endpoint (server-side).
//
// Prefer an explicit override (BASE_RPC_URL / NEXT_PUBLIC_BASE_RPC_URL); else
// build the Coinbase CDP RPC URL from NEXT_PUBLIC_CDP_CLIENT_API_KEY — the same
// paid lane viemClient uses, and already a prod secret in apphosting.yaml. This
// means no separate BASE_RPC_URL secret is needed in production.
export function getBaseRpcUrl() {
  const explicit = process.env.NEXT_PUBLIC_BASE_RPC_URL || process.env.BASE_RPC_URL;
  if (explicit) return explicit;
  const cdpKey = process.env.NEXT_PUBLIC_CDP_CLIENT_API_KEY;
  if (cdpKey) return `https://api.developer.coinbase.com/rpc/v1/base/${cdpKey}`;
  return null;
}
