// x402 client helper — handles the "402 → sign → retry" dance for the
// Token Review paywall. Used by ReviewFunnel.
//
// Flow:
//   1. POST the request once with no payment.
//   2. If 402, parse the challenge body for paymentRequirements.
//   3. Build an EIP-3009 transferWithAuthorization payload.
//   4. Sign it via a passed-in signTypedData function (wagmi-bound).
//   5. Encode the signed payload as base64, retry with X-PAYMENT header.
//
// The retry path keeps things stateless on the server — verify + settle
// are part of the second request, not a separate "submit-payment"
// endpoint. That's the x402 spec.

// Generate a 32-byte random nonce as a 0x-prefixed hex string. Used by
// EIP-3009 to prevent replay (the USDC contract tracks consumed nonces
// per signer).
function randomNonce32() {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Server-side / non-secure fallback. The funnel only runs in the
    // browser so this branch is unreachable, but keep it deterministic.
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Build the EIP-712 typed-data envelope for a USDC transferWithAuthorization.
// The domain values come from the x402 challenge's `extra` block + asset
// address + chainId; we infer chainId from the network string ('base' →
// 8453). All `extra` fields default to USDC's known values so a thin
// challenge body still produces a valid sig.
function buildTransferWithAuthorizationTypedData({ requirements, from, chainId }) {
  const value = String(requirements.maxAmountRequired);
  const validAfter = '0';
  const validBefore = String(Math.floor(Date.now() / 1000) + (requirements.maxTimeoutSeconds || 300));
  const nonce = randomNonce32();

  const authorization = {
    from,
    to: requirements.payTo,
    value,
    validAfter,
    validBefore,
    nonce,
  };

  const typedData = {
    domain: {
      name: requirements.extra?.name || 'USD Coin',
      version: requirements.extra?.version || '2',
      chainId,
      verifyingContract: requirements.asset,
    },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    message: authorization,
  };

  return { authorization, typedData };
}

// Encode the signed x402 payload as base64 for the X-PAYMENT header.
function encodePaymentHeader({ x402Version, scheme, network, signature, authorization }) {
  const payload = {
    x402Version,
    scheme,
    network,
    payload: {
      signature,
      authorization,
    },
  };
  // The base64 encoder isn't named the same in browser vs Node — feature
  // detect. Funnel runs in the browser, so btoa is canonical.
  const json = JSON.stringify(payload);
  if (typeof btoa === 'function') return btoa(json);
  return Buffer.from(json).toString('base64');
}

// Map an x402 network string to a chainId. Only Base is wired today;
// extend as the funnel grows other chains.
const NETWORK_TO_CHAIN_ID = {
  base: 8453,
  'base-sepolia': 84532,
  'eip155:8453': 8453,
};

// Public entry point — accepts the fetch URL + body + a signTypedData
// function (wagmi-bound) + the payer's address. Resolves to the parsed
// JSON response on success; throws on persistent failure.
//
//   url            — endpoint to POST to (the resource server)
//   requestBody    — JSON-serializable body
//   signTypedDataAsync — async ({ domain, types, primaryType, message }) => signature
//   payerAddress   — connected wallet address (the `from` in the auth)
//   onChallenge    — optional callback fired when 402 is received,
//                    before signing. Receives the parsed challenge body.
//                    Useful for UI state ("payment required" surface).
//
// Returns: { data, paymentTxHash | null }
export async function fetchWithX402({
  url,
  requestBody,
  signTypedDataAsync,
  payerAddress,
  onChallenge,
}) {
  // First hop — no payment. Expect 402.
  const initialRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (initialRes.ok) {
    // Some resource servers grant free responses (e.g. cached for a
    // recent paying user). Return immediately if so.
    const data = await initialRes.json();
    return { data, paymentTxHash: null };
  }

  if (initialRes.status !== 402) {
    const detail = await initialRes.text().catch(() => '');
    throw new Error(`Unexpected ${initialRes.status} from ${url}: ${detail.slice(0, 200)}`);
  }

  const challenge = await initialRes.json();
  if (typeof onChallenge === 'function') onChallenge(challenge);

  // Pick the first accepts entry whose scheme + network we can satisfy.
  // Today that's exact + base; extend `NETWORK_TO_CHAIN_ID` to widen.
  const accept = (challenge?.accepts || []).find(
    (a) => a.scheme === 'exact' && NETWORK_TO_CHAIN_ID[a.network] != null,
  );
  if (!accept) {
    throw new Error('No supported payment scheme in 402 challenge');
  }

  const chainId = NETWORK_TO_CHAIN_ID[accept.network];
  const { authorization, typedData } = buildTransferWithAuthorizationTypedData({
    requirements: accept,
    from: payerAddress,
    chainId,
  });

  const signature = await signTypedDataAsync(typedData);

  const paymentHeader = encodePaymentHeader({
    x402Version: challenge.x402Version || 1,
    scheme: accept.scheme,
    network: accept.network,
    signature,
    authorization,
  });

  // Second hop — same body, now carrying X-PAYMENT. Server runs
  // verify + settle inline; on success returns 200 with the response
  // body plus an X-PAYMENT-RESPONSE header (settle result).
  const paidRes = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PAYMENT': paymentHeader,
    },
    body: JSON.stringify(requestBody),
  });

  if (!paidRes.ok) {
    let detail = '';
    try {
      const j = await paidRes.json();
      detail = j?.error || JSON.stringify(j).slice(0, 200);
    } catch {
      detail = await paidRes.text().catch(() => '');
    }
    throw new Error(`Paid request failed (${paidRes.status}): ${detail}`);
  }

  const data = await paidRes.json();
  // Decode the settle echo if present. Surface the tx hash so the
  // funnel can show "paid · 0xabc…" if it wants to.
  let paymentTxHash = null;
  const respHeader = paidRes.headers.get('x-payment-response');
  if (respHeader) {
    try {
      const decoded =
        typeof atob === 'function'
          ? atob(respHeader)
          : Buffer.from(respHeader, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded);
      paymentTxHash = parsed?.transaction || parsed?.txHash || null;
    } catch {
      // shrug — non-fatal, just no display value.
    }
  }
  return { data, paymentTxHash };
}
