/**
 * AgentKit Wallet Plugin — Gives Our Lady a CDP-managed wallet on Base.
 *
 * Receive-only wallet: Our Lady can accept tips/payments and display balances.
 * No send/spend actions are registered — funds stay safe.
 *
 * On init:
 *  1. Creates a CdpEvmWalletProvider on Base mainnet
 *  2. Stores the wallet address in runtime settings
 *  3. Registers a provider so the agent can reference her address and balances
 *
 * Required env vars:
 *   CDP_API_KEY_NAME       — CDP API key ID
 *   CDP_API_KEY_PRIVATE_KEY — CDP API key secret
 *   CDP_WALLET_SECRET      — Wallet encryption key (from CDP portal)
 *   CDP_NETWORK_ID         — e.g. "base-mainnet" (default)
 */

import type {
  Plugin,
  Provider,
  ProviderResult,
  IAgentRuntime,
  Memory,
  State,
} from '@elizaos/core';
import { logger } from '@elizaos/core';
import { CdpEvmWalletProvider } from '@coinbase/agentkit';

// RL80 token contract on Base mainnet
const RL80_TOKEN_ADDRESS = '0x30D01555d88c76500a82754A1D53cAc082A6CB75';
const ERC20_BALANCE_ABI = [{
  inputs: [{ name: 'account', type: 'address' }],
  name: 'balanceOf',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function',
}] as const;

let walletProvider: CdpEvmWalletProvider | null = null;
let walletAddress: string = '';

const walletInfoProvider: Provider = {
  name: 'CDP_WALLET',
  description: 'Provides Our Lady\'s wallet address and balances (ETH + RL80) on Base. She can share her address to receive tips and payments.',

  async get(
    _runtime: IAgentRuntime,
    _message: Memory,
    _state: State,
  ): Promise<ProviderResult> {
    if (!walletProvider || !walletAddress) {
      return { text: 'CDP wallet not configured.' };
    }

    try {
      // Fetch ETH balance
      const rawBalance = await walletProvider.getBalance();
      const ethBalance = Number(rawBalance) / 1e18;

      // Fetch RL80 token balance via direct RPC call
      let rl80Balance = 0;
      try {
        const result = await walletProvider.readContract({
          address: RL80_TOKEN_ADDRESS as `0x${string}`,
          abi: ERC20_BALANCE_ABI,
          functionName: 'balanceOf',
          args: [walletAddress as `0x${string}`],
        });
        rl80Balance = Number(BigInt(result as bigint) / BigInt(10 ** 18));
      } catch (err) {
        logger.debug('[AgentKit] Could not fetch RL80 balance:', err);
      }

      const text = [
        `Our Lady's PRIMARY wallet: RL80.eth (0x07363eac9c24Af6451EBA07ff16CbD687dA4508A) — works on Ethereum and all EVM chains.`,
        `Our Lady's SECONDARY wallet (Base only): rl80.base.eth (${walletAddress}) on Base`,
        `ETH balance: ${ethBalance.toFixed(6)} ETH`,
        `RL80 balance: ${rl80Balance.toLocaleString()} RL80`,
        ``,
        `When sharing your wallet address, ALWAYS say RL80.eth first. Mention rl80.base.eth as a secondary option for users on Base.`,
        `Anyone can send tips or donations to RL80.eth on any network, or rl80.base.eth on Base.`,
      ].join('\n');

      return {
        text,
        values: {
          walletAddress,
          ethBalance: ethBalance.toString(),
          rl80Balance: rl80Balance.toString(),
          network: 'Base',
        },
      };
    } catch (err) {
      logger.error('[AgentKit] Failed to get wallet info:', err);
      return {
        text: `Our Lady's wallet address on Base: ${walletAddress} (balance temporarily unavailable)`,
        values: { walletAddress, network: 'Base' },
      };
    }
  },
};

const agentkitWalletPlugin: Plugin = {
  name: 'agentkit-wallet',
  description: 'Receive-only CDP wallet for Our Lady — accepts tips/payments, displays balances. No send/spend actions.',

  async init(_config: Record<string, string>, runtime?: IAgentRuntime) {
    const apiKeyId = process.env.CDP_API_KEY_NAME;
    const apiKeySecret = process.env.CDP_API_KEY_PRIVATE_KEY;
    const walletSecret = process.env.CDP_WALLET_SECRET;
    const networkId = process.env.CDP_NETWORK_ID || 'base-mainnet';

    if (!apiKeyId || !apiKeySecret || !walletSecret) {
      logger.warn('[AgentKit] Missing env vars — wallet disabled. Need: CDP_API_KEY_NAME, CDP_API_KEY_PRIVATE_KEY, CDP_WALLET_SECRET');
      return;
    }

    try {
      // Pin to Our Lady's fixed wallet address so a new one isn't created on each restart
      const fixedAddress = process.env.CDP_WALLET_ADDRESS || '0xaE336eE8E7b2013167de5f0094DD9B06550A33fA';

      walletProvider = await CdpEvmWalletProvider.configureWithWallet({
        apiKeyId,
        apiKeySecret,
        walletSecret,
        networkId,
        address: fixedAddress as `0x${string}`,
        rpcUrl: 'https://mainnet.base.org',
      });

      walletAddress = walletProvider.getAddress();
      const network = walletProvider.getNetwork();

      logger.info('===========================================');
      logger.info('   AgentKit Wallet Initialized');
      logger.info(`   Address: ${walletAddress}`);
      logger.info(`   Network: ${network.networkId || networkId}`);
      logger.info('   Mode: Receive-only (no send actions)');
      logger.info('===========================================');

      if (runtime) {
        runtime.setSetting('CDP_WALLET_ADDRESS', walletAddress);
      }
    } catch (err) {
      logger.error('[AgentKit] Failed to initialize wallet:', err);
      walletProvider = null;
    }
  },

  // No actions registered — wallet is receive-only
  providers: [walletInfoProvider],
};

export default agentkitWalletPlugin;

/** Utility to get the wallet address from outside the plugin */
export function getWalletAddress(): string {
  return walletAddress;
}
