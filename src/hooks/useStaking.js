'use client';

import { useState, useEffect, useCallback } from 'react';
import { useActiveAccount, useSendAndConfirmTransaction } from "thirdweb/react";
import { stakingFunctions, stakingTransactions, formatStakingData } from '@/lib/stakingContract';
import { toWei, toEther } from "thirdweb/utils";

export function useStaking() {
  const account = useActiveAccount();
  const { sendAndConfirmTransaction, isLoading: isSending } = useSendAndConfirmTransaction();
  
  const [stakingData, setStakingData] = useState({
    stakedBalance: '0',
    earnedRewards: '0',
    apr: '0',
    totalStaked: '0',
    minClaimAmount: '0',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch staking data
  const fetchStakingData = useCallback(async () => {
    if (!account?.address) {
      setStakingData({
        stakedBalance: '0',
        earnedRewards: '0',
        apr: '0',
        totalStaked: '0',
        minClaimAmount: '0',
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await formatStakingData(account.address);
      setStakingData(data);
    } catch (err) {
      console.error('Error fetching staking data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [account?.address]);

  // Fetch data on mount and when account changes
  useEffect(() => {
    fetchStakingData();
  }, [fetchStakingData]);

  // Refresh data every 30 seconds
  useEffect(() => {
    if (!account?.address) return;
    
    const interval = setInterval(() => {
      fetchStakingData();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [account?.address, fetchStakingData]);

  // Stake tokens
  const stakeTokens = async (amount) => {
    if (!account) throw new Error('No wallet connected');
    
    try {
      setError(null);
      
      // Convert amount to wei
      const amountInWei = toWei(amount.toString());
      
      // Prepare the transaction
      const transaction = stakingTransactions.prepareStake(amountInWei);
      
      // Send and confirm
      const result = await sendAndConfirmTransaction(transaction);
      
      // Refresh staking data
      await fetchStakingData();
      
      return result;
    } catch (err) {
      console.error('Error staking tokens:', err);
      setError(err.message);
      throw err;
    }
  };

  // Unstake tokens
  const unstakeTokens = async (amount) => {
    if (!account) throw new Error('No wallet connected');
    
    try {
      setError(null);
      
      // Convert amount to wei
      const amountInWei = toWei(amount.toString());
      
      // Prepare the transaction
      const transaction = stakingTransactions.prepareUnstake(amountInWei);
      
      // Send and confirm
      const result = await sendAndConfirmTransaction(transaction);
      
      // Refresh staking data
      await fetchStakingData();
      
      return result;
    } catch (err) {
      console.error('Error unstaking tokens:', err);
      setError(err.message);
      throw err;
    }
  };

  // Unstake all tokens
  const unstakeAll = async () => {
    if (!account) throw new Error('No wallet connected');
    
    try {
      setError(null);
      
      // Prepare the transaction
      const transaction = stakingTransactions.prepareUnstakeAll();
      
      // Send and confirm
      const result = await sendAndConfirmTransaction(transaction);
      
      // Refresh staking data
      await fetchStakingData();
      
      return result;
    } catch (err) {
      console.error('Error unstaking all tokens:', err);
      setError(err.message);
      throw err;
    }
  };

  // Claim rewards
  const claimRewards = async () => {
    if (!account) throw new Error('No wallet connected');
    
    try {
      setError(null);
      
      // Prepare the transaction
      const transaction = stakingTransactions.prepareClaim();
      
      // Send and confirm
      const result = await sendAndConfirmTransaction(transaction);
      
      // Refresh staking data
      await fetchStakingData();
      
      return result;
    } catch (err) {
      console.error('Error claiming rewards:', err);
      setError(err.message);
      throw err;
    }
  };

  // Format values for display
  const formatValue = (value, decimals = 18) => {
    try {
      return toEther(BigInt(value));
    } catch {
      return '0';
    }
  };

  return {
    // Account info
    account: account?.address,
    
    // Staking data
    stakedBalance: formatValue(stakingData.stakedBalance),
    earnedRewards: formatValue(stakingData.earnedRewards),
    apr: stakingData.apr,
    totalStaked: formatValue(stakingData.totalStaked),
    minClaimAmount: formatValue(stakingData.minClaimAmount),
    
    // Raw values (in wei)
    rawStakedBalance: stakingData.stakedBalance,
    rawEarnedRewards: stakingData.earnedRewards,
    
    // Loading states
    isLoading,
    isSending,
    
    // Error
    error,
    
    // Actions
    stakeTokens,
    unstakeTokens,
    unstakeAll,
    claimRewards,
    refreshData: fetchStakingData,
  };
}