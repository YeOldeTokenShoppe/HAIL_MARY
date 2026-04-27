'use client';

import { http, createConfig } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet, metaMask, walletConnect } from 'wagmi/connectors';
import { createCDPEmbeddedWalletConnector } from '@coinbase/cdp-wagmi';

const cdpKey = process.env.NEXT_PUBLIC_CDP_CLIENT_API_KEY;
const cdpProjectId = process.env.NEXT_PUBLIC_CDP_PROJECT_ID;
const wcProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
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
  metaMask({
    // Only attempt the browser extension flow. Without this the SDK
    // falls back to its own unstyled QR modal when no MetaMask
    // extension is detected — redundant since WalletConnect already
    // covers MetaMask mobile with a polished QR flow.
    extensionOnly: true,
    dappMetadata: {
      name: 'RL80',
      url: 'https://rl80.com',
      iconUrl: 'https://rl80.com/favicon.svg',
    },
  }),
  // WalletConnect (id: 'walletConnect') — desktop QR + mobile deep-link
  // for Phantom mobile, Rainbow, Trust, Rabby, Argent, Zerion, Uniswap
  // Wallet, etc. Only registered when a project ID is present so a
  // missing env var doesn't blow up the connector list at boot.
  //
  // Skipped during SSR because the WC connector eagerly instantiates
  // its EthereumProvider, which touches localStorage synchronously and
  // throws ReferenceErrors / unhandledRejections on the server. On the
  // client the connector is added after hydration; no DOM depends on
  // its presence (consumers look it up by id at click time), so there's
  // no hydration mismatch.
  ...(typeof window !== 'undefined' && wcProjectId
    ? [
        walletConnect({
          projectId: wcProjectId,
          metadata: {
            name: 'RL80',
            description: 'Our Lady of Perpetual Profit',
            url: 'https://rl80.com',
            icons: ['https://rl80.com/favicon.svg'],
          },
          showQrModal: true,
          // BuyModal renders at z-index 10000 (and the unified account
          // modal at 9500). WalletConnect's QR modal defaults much
          // lower, so without this it opens behind whichever modal
          // launched it and the button just looks "stuck pending".
          // Both CSS vars are set: older WC modal uses --wcm-z-index,
          // newer Reown AppKit uses --w3m-z-index.
          qrModalOptions: {
            themeVariables: {
              '--wcm-z-index': '20000',
              '--w3m-z-index': '20000',
            },
          },
        }),
      ]
    : []),
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
