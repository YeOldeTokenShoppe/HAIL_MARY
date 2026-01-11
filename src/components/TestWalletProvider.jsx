'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { privateKeyToAccount } from 'thirdweb/wallets';
import { client } from '@/lib/constants';
import { getTestWalletForUser } from '@/lib/testWallets';
import { getBalance } from 'thirdweb/extensions/erc20';
import { CONTRACT } from '@/lib/constants';

const TestWalletContext = createContext({});

export const useTestWallet = () => useContext(TestWalletContext);

export const TestWalletProvider = ({ children }) => {
  const { user } = useUser();
  const [testWallet, setTestWallet] = useState(null);
  const [walletAccount, setWalletAccount] = useState(null);
  const [tokenBalance, setTokenBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initializeWallet = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        // Get assigned test wallet for this user
        const assignedWallet = getTestWalletForUser(user.id);
        
        if (!assignedWallet) {
          setError('No test wallets available. Please contact admin.');
          setIsLoading(false);
          return;
        }

        // Only proceed if we have a private key
        if (!assignedWallet.privateKey) {
          setError('Wallet not properly configured. Please check environment variables.');
          setIsLoading(false);
          return;
        }

        // Create account from private key
        const account = privateKeyToAccount({ 
          client, 
          privateKey: assignedWallet.privateKey 
        });

        setTestWallet(assignedWallet);
        setWalletAccount(account);

        // Fetch token balance
        try {
          const balance = await getBalance({
            contract: CONTRACT,
            address: assignedWallet.address,
          });
          
          setTokenBalance(balance.toString());
        } catch (balanceError) {
          console.error('Error fetching balance:', balanceError);
          setTokenBalance('0');
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Error initializing test wallet:', err);
        setError('Failed to initialize wallet');
        setIsLoading(false);
      }
    };

    initializeWallet();
  }, [user]);

  // Function to refresh balance
  const refreshBalance = async () => {
    if (!testWallet?.address) return;
    
    try {
      const balance = await getBalance({
        contract: CONTRACT,
        address: testWallet.address,
      });
      
      setTokenBalance(balance.toString());
    } catch (error) {
      console.error('Error refreshing balance:', error);
    }
  };

  // Function to execute transactions with the test wallet
  const executeTransaction = async (transaction) => {
    if (!walletAccount) {
      throw new Error('No wallet available');
    }

    try {
      const result = await sendTransaction({
        transaction,
        account: walletAccount,
      });
      
      // Refresh balance after transaction
      await refreshBalance();
      
      return result;
    } catch (error) {
      console.error('Transaction failed:', error);
      throw error;
    }
  };

  const value = {
    testWallet,
    walletAccount,
    walletAddress: testWallet?.address,
    tokenBalance,
    isLoading,
    error,
    refreshBalance,
    executeTransaction,
    isTestMode: true // Flag to indicate we're using test wallets
  };

  return (
    <TestWalletContext.Provider value={value}>
      {children}
    </TestWalletContext.Provider>
  );
};