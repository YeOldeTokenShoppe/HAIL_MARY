import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

const cdpKey = process.env.NEXT_PUBLIC_CDP_CLIENT_API_KEY;
const rpcUrl = cdpKey
  ? `https://api.developer.coinbase.com/rpc/v1/base/${cdpKey}`
  : undefined;

export const publicClient = createPublicClient({
  chain: base,
  transport: http(rpcUrl, { batch: true }),
});
