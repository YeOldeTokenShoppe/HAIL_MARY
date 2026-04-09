'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { publicClient } from '@/lib/viemClient';
import { STAKING_ADDRESS } from '@/lib/contracts';
import { stakingAbi } from '@/lib/abis/stakingAbi';

// Fetch all staking data for a user
async function fetchFormattedStakingData(userAddress) {
  try {
    const [stakedBalance, earnedRewards, rewardPerToken, totalStaked, lockDuration, unlockTime] =
      await Promise.all([
        publicClient.readContract({ address: STAKING_ADDRESS, abi: stakingAbi, functionName: 'balances', args: [userAddress] }),
        publicClient.readContract({ address: STAKING_ADDRESS, abi: stakingAbi, functionName: 'earned', args: [userAddress] }),
        publicClient.readContract({ address: STAKING_ADDRESS, abi: stakingAbi, functionName: 'rewardPerTokenStored' }),
        publicClient.readContract({ address: STAKING_ADDRESS, abi: stakingAbi, functionName: 'totalStaked' }),
        publicClient.readContract({ address: STAKING_ADDRESS, abi: stakingAbi, functionName: 'lockDuration' }),
        publicClient.readContract({ address: STAKING_ADDRESS, abi: stakingAbi, functionName: 'unlockTime', args: [userAddress] }),
      ]);

    const canWithdraw = Number(unlockTime) <= Math.floor(Date.now() / 1000);
    const timeUntilUnlock = canWithdraw ? 0 : Number(unlockTime) - Math.floor(Date.now() / 1000);

    return {
      stakedBalance: stakedBalance.toString(),
      earnedRewards: earnedRewards.toString(),
      rewardPerToken: rewardPerToken.toString(),
      totalStaked: totalStaked.toString(),
      lockDuration: lockDuration.toString(),
      unlockTime: unlockTime.toString(),
      canWithdraw,
      timeUntilUnlock,
    };
  } catch (error) {
    console.error('Error formatting staking data:', error);
    return {
      stakedBalance: '0', earnedRewards: '0', rewardPerToken: '0',
      totalStaked: '0', lockDuration: '604800', unlockTime: '0',
      canWithdraw: false, timeUntilUnlock: 0,
    };
  }
}

export function useStaking() {
  const { address } = useAccount();
  const { writeContractAsync, isPending: isSending } = useWriteContract();

  const [stakingData, setStakingData] = useState({
    stakedBalance: '0', earnedRewards: '0', rewardPerToken: '0',
    totalStaked: '0', lockDuration: '604800', unlockTime: '0',
    canWithdraw: false, timeUntilUnlock: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchStakingData = useCallback(async () => {
    if (!address) {
      setStakingData({
        stakedBalance: '0', earnedRewards: '0', rewardPerToken: '0',
        totalStaked: '0', lockDuration: '604800', unlockTime: '0',
        canWithdraw: false, timeUntilUnlock: 0,
      });
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchFormattedStakingData(address);
      setStakingData(data);
    } catch (err) {
      console.error('Error fetching staking data:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => { fetchStakingData(); }, [fetchStakingData]);

  useEffect(() => {
    if (!address) return;
    const interval = setInterval(fetchStakingData, 30000);
    return () => clearInterval(interval);
  }, [address, fetchStakingData]);

  const stakeTokens = async (amount) => {
    if (!address) throw new Error('No wallet connected');
    try {
      setError(null);
      const hash = await writeContractAsync({
        address: STAKING_ADDRESS, abi: stakingAbi,
        functionName: 'stake', args: [parseEther(amount.toString())],
      });
      await fetchStakingData();
      return hash;
    } catch (err) {
      console.error('Error staking tokens:', err);
      setError(err.message);
      throw err;
    }
  };

  const withdrawTokens = async (amount) => {
    if (!address) throw new Error('No wallet connected');
    try {
      setError(null);
      const hash = await writeContractAsync({
        address: STAKING_ADDRESS, abi: stakingAbi,
        functionName: 'withdraw', args: [parseEther(amount.toString())],
      });
      await fetchStakingData();
      return hash;
    } catch (err) {
      console.error('Error withdrawing tokens:', err);
      setError(err.message);
      throw err;
    }
  };

  const withdrawAll = async () => {
    if (!address) throw new Error('No wallet connected');
    try {
      setError(null);
      const hash = await writeContractAsync({
        address: STAKING_ADDRESS, abi: stakingAbi,
        functionName: 'withdrawAll',
      });
      await fetchStakingData();
      return hash;
    } catch (err) {
      console.error('Error withdrawing all tokens:', err);
      setError(err.message);
      throw err;
    }
  };

  const claimRewards = async () => {
    if (!address) throw new Error('No wallet connected');
    try {
      setError(null);
      const hash = await writeContractAsync({
        address: STAKING_ADDRESS, abi: stakingAbi,
        functionName: 'claimRewards',
      });
      await fetchStakingData();
      return hash;
    } catch (err) {
      console.error('Error claiming rewards:', err);
      setError(err.message);
      throw err;
    }
  };

  const formatValue = (value) => {
    try {
      return formatEther(BigInt(value));
    } catch {
      return '0';
    }
  };

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
    account: address,
    stakedBalance: formatValue(stakingData.stakedBalance),
    earnedRewards: formatValue(stakingData.earnedRewards),
    rewardPerToken: formatValue(stakingData.rewardPerToken),
    totalStaked: formatValue(stakingData.totalStaked),
    lockDuration: stakingData.lockDuration,
    unlockTime: stakingData.unlockTime,
    canWithdraw: stakingData.canWithdraw,
    timeUntilUnlock: stakingData.timeUntilUnlock,
    timeUntilUnlockFormatted: formatTime(stakingData.timeUntilUnlock),
    rawStakedBalance: stakingData.stakedBalance,
    rawEarnedRewards: stakingData.earnedRewards,
    isLoading, isSending, error,
    stakeTokens, withdrawTokens, withdrawAll, claimRewards,
    refreshData: fetchStakingData,
    unstakeTokens: withdrawTokens,
    unstakeAll: withdrawAll,
  };
}
