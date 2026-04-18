'use client';

import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet, injected, metaMask } from 'wagmi/connectors';

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
    [base.id]: http(),
  },
});
