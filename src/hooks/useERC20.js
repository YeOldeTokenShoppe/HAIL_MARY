'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { publicClient } from '@/lib/viemClient';
import { RL80_ADDRESS } from '@/lib/contracts';

export function useERC20() {
  const { address } = useAccount();
  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const [balance, setBalance] = useState(null);
  const [tokenInfo, setTokenInfo] = useState({
    name: '',
    symbol: '',
    decimals: 18,
    totalSupply: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch token info on mount
  useEffect(() => {
    const fetchTokenInfo = async () => {
      try {
        setLoading(true);
        const [name, symbol, decimals, totalSupply] = await Promise.all([
          publicClient.readContract({ address: RL80_ADDRESS, abi: erc20Abi, functionName: 'name' }),
          publicClient.readContract({ address: RL80_ADDRESS, abi: erc20Abi, functionName: 'symbol' }),
          publicClient.readContract({ address: RL80_ADDRESS, abi: erc20Abi, functionName: 'decimals' }),
          publicClient.readContract({ address: RL80_ADDRESS, abi: erc20Abi, functionName: 'totalSupply' }),
        ]);

        setTokenInfo({
          name,
          symbol,
          decimals: Number(decimals),
          totalSupply: totalSupply.toString(),
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
  const fetchBalance = useCallback(async () => {
    if (!address) {
      setBalance(null);
      return;
    }

    try {
      setLoading(true);
      const userBalance = await publicClient.readContract({
        address: RL80_ADDRESS,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      });
      setBalance(userBalance.toString());
    } catch (err) {
      console.error('Error fetching balance:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const sendTokens = async (to, amount) => {
    if (!address) throw new Error('No wallet connected');

    try {
      setLoading(true);
      setError(null);

      const hash = await writeContractAsync({
        address: RL80_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [to, BigInt(amount)],
      });

      await fetchBalance();
      return hash;
    } catch (err) {
      console.error('Error sending tokens:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const approveSpender = async (spender, amount) => {
    if (!address) throw new Error('No wallet connected');

    try {
      setLoading(true);
      setError(null);

      const hash = await writeContractAsync({
        address: RL80_ADDRESS,
        abi: erc20Abi,
        functionName: 'approve',
        args: [spender, BigInt(amount)],
      });

      return hash;
    } catch (err) {
      console.error('Error approving spender:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    account: address,
    balance,
    tokenInfo,
    loading: loading || isWriting,
    error,
    sendTokens,
    approveSpender,
    refetchBalance: fetchBalance,
  };
}
