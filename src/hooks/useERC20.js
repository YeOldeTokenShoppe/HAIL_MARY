'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { tokenFunctions } from '@/lib/contract';

export function useERC20() {
  const account = useActiveAccount();
  const [balance, setBalance] = useState(null);
  const [tokenInfo, setTokenInfo] = useState({
    name: '',
    symbol: '',
    decimals: 18,
    totalSupply: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch token info on mount
  useEffect(() => {
    const fetchTokenInfo = async () => {
      try {
        setLoading(true);
        const [name, symbol, decimals, totalSupply] = await Promise.all([
          tokenFunctions.getName(),
          tokenFunctions.getSymbol(),
          tokenFunctions.getDecimals(),
          tokenFunctions.getTotalSupply()
        ]);
        
        setTokenInfo({
          name,
          symbol,
          decimals: Number(decimals),
          totalSupply: totalSupply.toString()
        });
      } catch (err) {
        console.error('Error fetching token info:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTokenInfo();
  }, []);

  // Fetch balance when account changes
  useEffect(() => {
    const fetchBalance = async () => {
      if (!account?.address) {
        setBalance(null);
        return;
      }

      try {
        setLoading(true);
        const userBalance = await tokenFunctions.getBalance(account.address);
        setBalance(userBalance.toString());
      } catch (err) {
        console.error('Error fetching balance:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [account?.address]);

  const sendTokens = async (to, amount) => {
    if (!account) throw new Error('No wallet connected');
    
    try {
      setLoading(true);
      setError(null);
      
      // Amount should be in wei (smallest unit)
      const transaction = await tokenFunctions.transfer(to, amount);
      
      // Send transaction with the connected wallet
      const result = await account.sendTransaction(transaction);
      
      // Refresh balance after transfer
      const newBalance = await tokenFunctions.getBalance(account.address);
      setBalance(newBalance.toString());
      
      return result;
    } catch (err) {
      console.error('Error sending tokens:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const approveSpender = async (spender, amount) => {
    if (!account) throw new Error('No wallet connected');
    
    try {
      setLoading(true);
      setError(null);
      
      const transaction = await tokenFunctions.approve(spender, amount);
      const result = await account.sendTransaction(transaction);
      
      return result;
    } catch (err) {
      console.error('Error approving spender:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    account: account?.address,
    balance,
    tokenInfo,
    loading,
    error,
    sendTokens,
    approveSpender,
    refetchBalance: async () => {
      if (account?.address) {
        const newBalance = await tokenFunctions.getBalance(account.address);
        setBalance(newBalance.toString());
      }
    }
  };
}