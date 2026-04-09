'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
      console.error('Error fetching token balance:', error);
      setTokenBalance(null);
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

  // Connect wallet by connector id
  const connectWallet = useCallback(async (connectorId = 'coinbaseWallet') => {
    try {
      setManuallyDisconnected(false);
      const connector = connectors.find((c) => c.id === connectorId || c.name === connectorId);
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
      fetchTokenBalance(address);
    } else {
      setTokenBalance(null);
    }
  }, [address, isConnected, syncWalletWithClerk, fetchTokenBalance]);

  // Refresh balance periodically (every 30 seconds)
  useEffect(() => {
    if (!address) return;

    const interval = setInterval(() => {
      fetchTokenBalance(address);
    }, 30000);

    return () => clearInterval(interval);
  }, [address, fetchTokenBalance]);

  const value = {
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
    refreshBalance: () => fetchTokenBalance(address),

    // Wagmi-specific: expose connectors for wallet selection UIs
    connectors,

    // Combined status
    isFullyAuthenticated: !!user && isConnected,
    displayName: user?.firstName || user?.username ||
      (address ? address.slice(0, 6) + '...' + address.slice(-4) : 'Anonymous'),
  };

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
