'use client';

import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet, injected, metaMask } from 'wagmi/connectors';
import { createCDPEmbeddedWalletConnector } from '@coinbase/cdp-wagmi';

const cdpKey = process.env.NEXT_PUBLIC_CDP_CLIENT_API_KEY;
const cdpProjectId = process.env.NEXT_PUBLIC_CDP_PROJECT_ID;
const baseRpcUrl = cdpKey
  ? `https://api.developer.coinbase.com/rpc/v1/base/${cdpKey}`
  : undefined;

export const cdpEmbeddedWalletConfig = {
  projectId: cdpProjectId,
  ethereum: { createOnLogin: 'smart' },
  appName: 'RL80',
  appLogoUrl: 'https://rl80.com/favicon.svg',
  authMethods: ['email', 'oauth:google', 'oauth:apple', 'oauth:x'],
  showCoinbaseFooter: true,
};

const connectors = [
  coinbaseWallet({
    appName: 'RL80',
    preference: 'eoaOnly',
  }),
  injected(),
  metaMask(),
];

if (cdpProjectId) {
  connectors.unshift(
    createCDPEmbeddedWalletConnector({
      cdpConfig: cdpEmbeddedWalletConfig,
      providerConfig: {
        chains: [base],
        transports: { [base.id]: http(baseRpcUrl, { batch: true }) },
      },
    })
  );
}

export const wagmiConfig = createConfig({
  chains: [base],
  connectors,
  transports: {
    [base.id]: http(baseRpcUrl, { batch: true }),
  },
});
