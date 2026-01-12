'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useConnect, useActiveAccount, useDisconnect, useActiveWallet } from "thirdweb/react";
import { inAppWallet } from "thirdweb/wallets/in-app";
import { createWallet } from "thirdweb/wallets";
import { client, tokenFunctions } from '@/lib/contract';
import { logWalletConnection, logWalletDisconnection } from '@/lib/authLogger';
import { useAuthLogger } from '@/hooks/useAuthLogger';
import { getTestWalletForEmail, isAuthorizedTestUser } from '@/lib/testWallets';

// Enable test mode for simplified wallet experience
const TEST_MODE = true; // Set to false for production

const WalletAuthContext = createContext({});

export function WalletAuthProvider({ children }) {
  // Use auth logger hook to track Clerk logins
  const { user, isLoaded: clerkLoaded } = useAuthLogger();
  const { connect, isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const activeAccount = useActiveAccount();
  const activeWallet = useActiveWallet();
  
  const [walletAddress, setWalletAddress] = useState(null);
  const [tokenBalance, setTokenBalance] = useState(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testWallet, setTestWallet] = useState(null);

  // Fetch token balance when wallet is connected
  const fetchTokenBalance = useCallback(async (address) => {
    if (!address) {
      setTokenBalance(null);
      return;
    }
    
    try {
      setIsLoadingBalance(true);
      const balance = await tokenFunctions.getBalance(address);
      const decimals = await tokenFunctions.getDecimals();
      
      // Convert from wei to token units
      const formattedBalance = (BigInt(balance) / BigInt(10 ** decimals)).toString();
      setTokenBalance(formattedBalance);
      
      return formattedBalance;
    } catch (error) {
      console.error('Error fetching token balance:', error);
      setTokenBalance(null);
    } finally {
      setIsLoadingBalance(false);
    }
  }, []);

  // Store wallet address locally (Clerk frontend doesn't allow metadata updates)
  const syncWalletWithClerk = useCallback(async (address) => {
    if (!user || !address) return;
    
    try {
      setIsSyncing(true);
      
      // Store wallet data in localStorage linked to user ID
      const walletData = {
        walletAddress: address,
        lastWalletSync: new Date().toISOString(),
        userId: user.id
      };
      
      localStorage.setItem(`wallet_${user.id}`, JSON.stringify(walletData));
      
      // Also fetch and store the balance
      const balance = await fetchTokenBalance(address);
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

  // Handle wallet connection - auto-creates wallet using Clerk email
  const connectWallet = useCallback(async (walletType = 'inApp', autoConnect = false) => {
    try {
      // Create wallet instance based on type
      let wallet;
      if (walletType === 'inApp') {
        // Use Clerk user's email for in-app wallet
        const userEmail = user?.primaryEmailAddress?.emailAddress;
        
        if (autoConnect && userEmail) {
          // Auto-connect with Clerk email
          wallet = inAppWallet({
            auth: {
              options: ["email"],
              email: {
                mode: "auto" // Automatically handle email verification
              }
            },
          });
        } else {
          // Manual connection with multiple options
          wallet = inAppWallet({
            auth: {
              options: ["email", "google", "apple", "facebook"],
            },
          });
        }
      } else {
        wallet = createWallet(walletType);
      }
      
      // Connect the wallet
      const account = await connect(async () => {
        const connectedAccount = await wallet.connect({ client });
        return connectedAccount;
      });
      
      if (account?.address) {
        setWalletAddress(account.address);
        await syncWalletWithClerk(account.address);
        await fetchTokenBalance(account.address);
        
        // Log wallet connection to Firebase
        if (user) {
          logWalletConnection(user, account.address, walletType).then(docId => {
            if (docId) {
            }
          }).catch(error => {
            console.error('Error logging wallet connection:', error);
          });
        }
      }
      
      return account;
    } catch (error) {
      console.error('Error connecting wallet:', error);
      throw error;
    }
  }, [connect, syncWalletWithClerk, fetchTokenBalance]);

  // Handle wallet disconnection
  const disconnectWallet = useCallback(async () => {
    const currentAddress = walletAddress; // Store before clearing
    
    try {
      // Disconnect requires the wallet object
      if (activeWallet) {
        await disconnect(activeWallet);
      }
      
      setWalletAddress(null);
      setTokenBalance(null);
      setTestWallet(null);
      
      // Clear wallet from localStorage
      if (user) {
        localStorage.removeItem(`wallet_${user.id}`);
        // Don't clear preference on disconnect - user may want to reconnect same type
        
        // Log wallet disconnection to Firebase
        logWalletDisconnection(user, currentAddress).then(docId => {
          if (docId) {
          }
        }).catch(error => {
          console.error('Error logging wallet disconnection:', error);
        });
      }
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  }, [disconnect, user, walletAddress, activeWallet]);

  // Switch to test wallet (for users with both options)
  const switchToTestWallet = useCallback(() => {
    if (!user) return;
    
    const userEmail = user.primaryEmailAddress?.emailAddress;
    if (!userEmail || !isAuthorizedTestUser(userEmail)) {
      console.log('User not authorized for test wallet');
      return;
    }
    
    // Disconnect current wallet if connected
    if (activeWallet || walletAddress) {
      disconnectWallet();
    }
    
    // Set preference to test wallet
    localStorage.setItem(`wallet_preference_${user.id}`, 'test_wallet');
    
    // Assign test wallet
    const assignedWallet = getTestWalletForEmail(userEmail);
    if (assignedWallet) {
      setTestWallet(assignedWallet);
      setWalletAddress(assignedWallet.address);
      
      const walletData = {
        walletAddress: assignedWallet.address,
        lastWalletSync: new Date().toISOString(),
        userId: user.id,
        isTestWallet: true
      };
      localStorage.setItem(`wallet_${user.id}`, JSON.stringify(walletData));
      
      fetchTokenBalance(assignedWallet.address);
      console.log(`Switched to test wallet: ${assignedWallet.address}`);
    }
  }, [user, activeWallet, walletAddress, disconnectWallet, fetchTokenBalance]);

  // Switch to own wallet (MetaMask, etc.)
  const switchToOwnWallet = useCallback(async () => {
    if (!user) return;
    
    // Disconnect test wallet if connected
    if (testWallet) {
      setTestWallet(null);
      setWalletAddress(null);
      setTokenBalance(null);
      localStorage.removeItem(`wallet_${user.id}`);
    }
    
    // Set preference to own wallet
    localStorage.setItem(`wallet_preference_${user.id}`, 'own_wallet');
    
    // Open wallet connection modal
    return connectWallet('metamask'); // or could show a selection modal
  }, [user, testWallet, connectWallet]);

  // Auto-connect test wallet in test mode for authorized users only
  useEffect(() => {
    console.log('Test wallet auto-connect check:', {
      TEST_MODE,
      clerkLoaded,
      hasUser: !!user,
      userEmail: user?.primaryEmailAddress?.emailAddress,
      hasActiveAccount: !!activeAccount,
      isConnecting,
      hasWalletAddress: !!walletAddress
    });
    
    if (TEST_MODE && clerkLoaded && user && !activeAccount && !isConnecting && !walletAddress) {
      const userEmail = user.primaryEmailAddress?.emailAddress;
      
      console.log('Checking test wallet for email:', userEmail);
      
      // Check if user is authorized for test wallet
      if (!userEmail || !isAuthorizedTestUser(userEmail)) {
        console.log('User not authorized for test wallet:', userEmail);
        return;
      }
      
      // Check if user prefers to use their own wallet
      const walletPreference = localStorage.getItem(`wallet_preference_${user.id}`);
      if (walletPreference === 'own_wallet') {
        console.log('User prefers to use their own wallet, skipping test wallet assignment');
        return;
      }
      
      const assignedWallet = getTestWalletForEmail(userEmail);
      
      if (assignedWallet) {
        // Only auto-assign if user hasn't explicitly chosen to use their own wallet
        console.log('Assigning test wallet:', assignedWallet);
        setTestWallet(assignedWallet);
        setWalletAddress(assignedWallet.address);
        
        // Sync with localStorage for persistence
        const walletData = {
          walletAddress: assignedWallet.address,
          lastWalletSync: new Date().toISOString(),
          userId: user.id,
          isTestWallet: true
        };
        localStorage.setItem(`wallet_${user.id}`, JSON.stringify(walletData));
        localStorage.setItem(`wallet_preference_${user.id}`, 'test_wallet');
        
        // Fetch balance for test wallet
        fetchTokenBalance(assignedWallet.address);
        
        // Log connection (optional)
        console.log(`Test wallet assigned to ${user.firstName || userEmail}: ${assignedWallet.address}`);
      } else {
        console.log(`No test wallet available for ${userEmail}`);
      }
    } else if (TEST_MODE && clerkLoaded && user && !activeAccount && !isConnecting && !walletAddress) {
      // Check if we have a stored test wallet for this user
      const storedData = localStorage.getItem(`wallet_${user.id}`);
      
      if (storedData) {
        try {
          const walletData = JSON.parse(storedData);
          if (walletData.isTestWallet && walletData.walletAddress) {
            console.log('Restoring test wallet from localStorage:', walletData.walletAddress);
            
            // Verify this user is still authorized for test wallet
            const userEmail = user.primaryEmailAddress?.emailAddress;
            if (userEmail && isAuthorizedTestUser(userEmail)) {
              const assignedWallet = getTestWalletForEmail(userEmail);
              if (assignedWallet && assignedWallet.address === walletData.walletAddress) {
                setTestWallet(assignedWallet);
                setWalletAddress(assignedWallet.address);
                fetchTokenBalance(assignedWallet.address);
              }
            }
          }
        } catch (error) {
          console.error('Error parsing stored wallet data:', error);
        }
      }
    } else if (!TEST_MODE && clerkLoaded && user && !activeAccount && !isConnecting) {
      // Original auto-reconnect logic for production
      const storedData = localStorage.getItem(`wallet_${user.id}`);
      
      if (storedData) {
        try {
          const walletData = JSON.parse(storedData);
          if (walletData.walletAddress) {
            // Note: Auto-reconnect would require storing wallet type
            // For now, user needs to manually reconnect
          }
        } catch (error) {
          console.error('Error parsing stored wallet data:', error);
        }
      }
    }
  }, [clerkLoaded, user, activeAccount, isConnecting, walletAddress, fetchTokenBalance]);

  // Update wallet address when active account changes
  useEffect(() => {
    if (activeAccount?.address) {
      setWalletAddress(activeAccount.address);
      syncWalletWithClerk(activeAccount.address);
      fetchTokenBalance(activeAccount.address);
    } else {
      setWalletAddress(null);
      setTokenBalance(null);
    }
  }, [activeAccount, syncWalletWithClerk, fetchTokenBalance]);

  // Refresh balance periodically (every 30 seconds)
  useEffect(() => {
    if (!walletAddress) return;
    
    const interval = setInterval(() => {
      fetchTokenBalance(walletAddress);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [walletAddress, fetchTokenBalance]);

  // Check if current user is authorized for test wallets
  const userEmail = user?.primaryEmailAddress?.emailAddress;
  const isTestUser = TEST_MODE && userEmail && isAuthorizedTestUser(userEmail);
  
  const value = {
    // Clerk user data
    user,
    isSignedIn: !!user,
    clerkLoaded,
    
    // Wallet data
    walletAddress,
    tokenBalance,
    isWalletConnected: isTestUser ? !!walletAddress : !!(activeAccount && walletAddress),
    activeAccount,
    
    // Test mode
    isTestMode: TEST_MODE,
    isTestUser, // Whether this specific user gets test wallet
    testWallet,
    
    // Loading states
    isConnecting,
    isLoadingBalance,
    isSyncing,
    
    // Actions
    connectWallet,
    disconnectWallet,
    switchToTestWallet,
    switchToOwnWallet,
    refreshBalance: () => fetchTokenBalance(walletAddress),
    
    // Combined status
    isFullyAuthenticated: !!user && (isTestUser ? !!walletAddress : !!activeAccount),
    displayName: user?.firstName || user?.username || walletAddress?.slice(0, 6) + '...' + walletAddress?.slice(-4) || 'Anonymous'
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