'use client';

import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet, injected, metaMask } from 'wagmi/connectors';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: 'RL80',
      preference: 'smartWalletOnly',
    }),
    injected(),
    metaMask(),
    farcasterMiniApp(),
  ],
  transports: {
    [base.id]: http(),
  },
});
