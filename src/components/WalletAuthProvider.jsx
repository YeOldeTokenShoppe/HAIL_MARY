'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { useUser } from '@clerk/nextjs';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { erc20Abi, formatUnits } from 'viem';
import { publicClient } from '@/lib/viemClient';
import { RL80_ADDRESS } from '@/lib/contracts';

const WalletAuthContext = createContext({});

export function WalletAuthProvider({ children }) {
  const { user, isLoaded: clerkLoaded } = useUser();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();

  const [tokenBalance, setTokenBalance] = useState(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [manuallyDisconnected, setManuallyDisconnected] = useState(false);

  // Fetch token balance when wallet is connected
  const fetchTokenBalance = useCallback(async (addr) => {
    if (!addr) {
      setTokenBalance(null);
      return;
    }

    try {
      setIsLoadingBalance(true);
      const [balance, decimals] = await Promise.all([
        publicClient.readContract({
          address: RL80_ADDRESS,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [addr],
        }),
        publicClient.readContract({
          address: RL80_ADDRESS,
          abi: erc20Abi,
          functionName: 'decimals',
        }),
      ]);

      const formattedBalance = formatUnits(balance, decimals);
      // Truncate to integer like the old code
      const intBalance = formattedBalance.split('.')[0];
      setTokenBalance(intBalance);
      return intBalance;
    } catch (error) {
      // Suppress noisy rate-limit errors from public RPC
      if (!String(error?.details || error?.message || '').includes('rate limit')) {
        console.error('Error fetching token balance:', error);
      }
      // Keep existing balance on transient errors instead of clearing it
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

  // Store wallet address locally (Clerk frontend doesn't allow metadata updates)
  const syncWalletWithClerk = useCallback(async (addr) => {
    if (!user || !addr) return;

    try {
      setIsSyncing(true);
      const walletData = {
        walletAddress: addr,
        lastWalletSync: new Date().toISOString(),
        userId: user.id,
      };
      localStorage.setItem(`wallet_${user.id}`, JSON.stringify(walletData));

      const balance = await fetchTokenBalance(addr);
      if (balance !== null) {
        walletData.tokenBalance = balance;
        localStorage.setItem(`wallet_${user.id}`, JSON.stringify(walletData));
      }
    } catch (error) {
      console.error('Error syncing wallet:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [user, fetchTokenBalance]);

  // Connect wallet by connector id. Accepts legacy/friendly aliases because
  // wagmi v3 renamed connector ids (e.g. coinbaseWallet → coinbaseWalletSDK).
  const connectWallet = useCallback(async (connectorId = 'coinbaseWallet') => {
    try {
      setManuallyDisconnected(false);
      const aliases = {
        coinbaseWallet: ['coinbaseWalletSDK', 'coinbaseWallet', 'com.coinbase.wallet', 'Coinbase Wallet'],
        coinbaseWalletSDK: ['coinbaseWalletSDK', 'coinbaseWallet', 'com.coinbase.wallet', 'Coinbase Wallet'],
        metamask: ['metaMaskSDK', 'metaMask', 'io.metamask', 'MetaMask'],
        metaMask: ['metaMaskSDK', 'metaMask', 'io.metamask', 'MetaMask'],
        walletConnect: ['walletConnect', 'WalletConnect'],
      };
      const candidates = aliases[connectorId] || [connectorId];
      const connector = connectors.find(
        (c) => candidates.includes(c.id) || candidates.includes(c.name)
      );
      if (!connector) {
        console.error('Connector not found:', connectorId, 'Available:', connectors.map(c => c.id));
        throw new Error(`Connector ${connectorId} not found`);
      }
      connect({ connector });
    } catch (error) {
      console.error('Error connecting wallet:', error);
      throw error;
    }
  }, [connect, connectors]);

  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    try {
      setManuallyDisconnected(true);
      disconnect();
      setTokenBalance(null);

      if (user) {
        localStorage.removeItem(`wallet_${user.id}`);
      }
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  }, [disconnect, user]);

  // Sync state when wagmi account changes
  useEffect(() => {
    if (address && isConnected) {
      syncWalletWithClerk(address);
    } else {
      setTokenBalance(null);
    }
  }, [address, isConnected, syncWalletWithClerk]);

  // Refresh balance periodically (every 60 seconds)
  useEffect(() => {
    if (!address) return;

    const interval = setInterval(() => {
      fetchTokenBalance(address);
    }, 60000);

    return () => clearInterval(interval);
  }, [address, fetchTokenBalance]);

  const refreshBalance = useCallback(
    () => fetchTokenBalance(address),
    [fetchTokenBalance, address]
  );

  // Memoize the context value so consumers don't re-render on every wagmi
  // block tick / Clerk session ping. Dep list is the set of primitive values
  // that actually change meaningfully.
  const value = useMemo(() => ({
    // Clerk user data
    user,
    isSignedIn: !!user,
    clerkLoaded,

    // Wallet data
    walletAddress: address || null,
    tokenBalance,
    isWalletConnected: isConnected,
    activeAccount: null, // Deprecated - components should use walletAddress

    // Test mode (removed)
    isTestMode: false,
    isTestUser: false,
    testWallet: null,
    testWalletAccount: null,

    // Loading states
    isConnecting,
    isLoadingBalance,
    isSyncing,

    // Actions
    connectWallet,
    disconnectWallet,
    switchToTestWallet: () => {},
    switchToOwnWallet: () => {},
    refreshBalance,

    // Wagmi-specific: expose connectors for wallet selection UIs
    connectors,

    // Combined status
    isFullyAuthenticated: !!user && isConnected,
    displayName: user?.firstName || user?.username ||
      (address ? address.slice(0, 6) + '...' + address.slice(-4) : 'Anonymous'),
  // Deps are primitive values — prevents Clerk/wagmi re-issuing a new object
  // with identical content from invalidating the memo and re-rendering every
  // consumer.
  }), [
    user?.id, user?.firstName, user?.username,
    clerkLoaded, address, tokenBalance, isConnected,
    isConnecting, isLoadingBalance, isSyncing,
    connectWallet, disconnectWallet, refreshBalance,
  ]);

  return (
    <WalletAuthContext.Provider value={value}>
      {children}
    </WalletAuthContext.Provider>
  );
}

export function useWalletAuth() {
  const context = useContext(WalletAuthContext);
  if (!context) {
    throw new Error('useWalletAuth must be used within WalletAuthProvider');
  }
  return context;
}
