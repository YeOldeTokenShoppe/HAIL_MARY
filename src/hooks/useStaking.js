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
    rewardPerToken: '0',
    totalStaked: '0',
    lockDuration: '600',
    unlockTime: '0',
    canWithdraw: false,
    timeUntilUnlock: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch staking data
  const fetchStakingData = useCallback(async () => {
    if (!account?.address) {
      setStakingData({
        stakedBalance: '0',
        earnedRewards: '0',
        rewardPerToken: '0',
        totalStaked: '0',
        lockDuration: '600',
        unlockTime: '0',
        canWithdraw: false,
        timeUntilUnlock: 0,
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

  // Withdraw tokens (testnet uses 'withdraw' not 'unstake')
  const withdrawTokens = async (amount) => {
    if (!account) throw new Error('No wallet connected');
    
    try {
      setError(null);
      
      // Convert amount to wei
      const amountInWei = toWei(amount.toString());
      
      // Prepare the transaction
      const transaction = stakingTransactions.prepareWithdraw(amountInWei);
      
      // Send and confirm
      const result = await sendAndConfirmTransaction(transaction);
      
      // Refresh staking data
      await fetchStakingData();
      
      return result;
    } catch (err) {
      console.error('Error withdrawing tokens:', err);
      setError(err.message);
      throw err;
    }
  };

  // Withdraw all tokens
  const withdrawAll = async () => {
    if (!account) throw new Error('No wallet connected');
    
    try {
      setError(null);
      
      // Prepare the transaction
      const transaction = stakingTransactions.prepareWithdrawAll();
      
      // Send and confirm
      const result = await sendAndConfirmTransaction(transaction);
      
      // Refresh staking data
      await fetchStakingData();
      
      return result;
    } catch (err) {
      console.error('Error withdrawing all tokens:', err);
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
      const transaction = stakingTransactions.prepareClaimRewards();
      
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

  // Format time for display
  const formatTime = (seconds) => {
    if (seconds <= 0) return 'Unlocked';
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    return `${seconds} seconds`;
  };

  return {
    // Account info
    account: account?.address,
    
    // Staking data
    stakedBalance: formatValue(stakingData.stakedBalance),
    earnedRewards: formatValue(stakingData.earnedRewards),
    totalStaked: formatValue(stakingData.totalStaked),
    
    // Testnet specific data
    lockDuration: stakingData.lockDuration,
    unlockTime: stakingData.unlockTime,
    canWithdraw: stakingData.canWithdraw,
    timeUntilUnlock: stakingData.timeUntilUnlock,
    timeUntilUnlockFormatted: formatTime(stakingData.timeUntilUnlock),
    
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
    withdrawTokens, // Changed from unstakeTokens
    withdrawAll,    // Changed from unstakeAll
    claimRewards,
    refreshData: fetchStakingData,
    
    // Legacy aliases for compatibility
    unstakeTokens: withdrawTokens,
    unstakeAll: withdrawAll,
  };
}