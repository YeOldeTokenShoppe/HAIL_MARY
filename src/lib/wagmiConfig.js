'use client';

import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet, injected, metaMask } from 'wagmi/connectors';

const cdpKey = process.env.NEXT_PUBLIC_CDP_CLIENT_API_KEY;
const baseRpcUrl = cdpKey
  ? `https://api.developer.coinbase.com/rpc/v1/base/${cdpKey}`
  : undefined;

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: 'RL80',
      preference: 'smartWalletOnly',
    }),
    injected(),
    metaMask(),
  ],
  transports: {
    [base.id]: http(baseRpcUrl, { batch: true }),
  },
});
