'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TransactionButton, useReadContract } from "thirdweb/react";
import { toWei, toEther } from "thirdweb/utils";
import {
  predictionMarketFunctions,
  predictionMarketContract,
  approveForPredictionMarket,
  getPredictionMarketAllowance,
  PREDICTION_MARKET_ADDRESS
} from '@/lib/contract';
import { useWalletAuth } from '@/components/WalletAuthProvider';
import {
  getActiveMarkets,
  getUserBets,
  placeBet,
  ensureCurrentWeekMarket,
  getCurrentOracleMarket
} from '../../services/predictionMarketService.js';

// Fallback mock data when Firebase is loading or unavailable
const FALLBACK_MARKETS = [
  // Multi-option: Agent markets
  {
    id: 1,
    question: "Most profitable agent this week?",
    type: 'multi',
    category: 'agent',
    options: [
      { id: 'macro', name: 'Macro Specialist', pool: 3200, color: '#00c8ff' },
      { id: 'sentiment', name: 'Sentiment (Grok)', pool: 4100, color: '#ff8800' },
      { id: 'technical', name: 'Technical Specialist', pool: 2700, color: '#aa44ff' }
    ],
    endTime: new Date('2026-01-26'),
    resolved: false
  },
  {
    id: 2,
    question: "Coordinator's next trade direction?",
    type: 'multi',
    category: 'agent',
    options: [
      { id: 'long', name: 'LONG', pool: 8500, color: '#00ff88' },
      { id: 'short', name: 'SHORT', pool: 6200, color: '#ff4466' },
      { id: 'hold', name: 'HOLD', pool: 2300, color: '#888888' }
    ],
    endTime: new Date('2026-01-20'),
    resolved: false
  },
  // Binary markets
  {
    id: 3,
    question: "BTC > $150k by March 2026?",
    type: 'binary',
    category: 'crypto',
    yesPool: 12500,
    noPool: 7500,
    endTime: new Date('2026-03-01'),
    resolved: false
  },
  {
    id: 4,
    question: "Fed cuts rates before June 2026?",
    type: 'binary',
    category: 'macro',
    yesPool: 31200,
    noPool: 12800,
    endTime: new Date('2026-06-01'),
    resolved: false
  },
  {
    id: 5,
    question: "VIX > 30 this month?",
    type: 'binary',
    category: 'macro',
    yesPool: 4200,
    noPool: 8800,
    endTime: new Date('2026-02-28'),
    resolved: false
  },
  // Multi-option: More agent markets
  {
    id: 6,
    question: "Which agent calls the next big move?",
    type: 'multi',
    category: 'agent',
    options: [
      { id: 'macro', name: 'Macro', pool: 1800, color: '#00c8ff' },
      { id: 'sentiment', name: 'Sentiment', pool: 2400, color: '#ff8800' },
      { id: 'technical', name: 'Technical', pool: 3100, color: '#aa44ff' },
      { id: 'coordinator', name: 'Coordinator', pool: 1200, color: '#00ff88' }
    ],
    endTime: new Date('2026-01-25'),
    resolved: false
  }
];

const FALLBACK_POSITIONS = [
  {
    marketId: 1,
    question: "Most profitable agent this week?",
    type: 'multi',
    selectedOption: { id: 'sentiment', name: 'Sentiment (Grok)', color: '#ff8800' },
    amount: 250,
    poolAtEntry: 3500,
    currentOptions: [
      { id: 'macro', pool: 3200 },
      { id: 'sentiment', pool: 4100 },
      { id: 'technical', pool: 2700 }
    ]
  },
  {
    marketId: 3,
    question: "BTC > $150k by March 2026?",
    type: 'binary',
    side: 'YES',
    amount: 500,
    poolAtEntry: 10000,
    currentYesPool: 12500,
    currentNoPool: 7500
  },
  {
    marketId: 4,
    question: "Fed cuts rates before June 2026?",
    type: 'binary',
    side: 'NO',
    amount: 200,
    poolAtEntry: 10000,
    currentYesPool: 31200,
    currentNoPool: 12800
  }
];

// Format time remaining
const formatTimeRemaining = (endTime) => {
  const now = new Date();
  const diff = endTime - now;

  if (diff <= 0) return 'Ended';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 30) {
    const months = Math.floor(days / 30);
    return `${months}mo ${days % 30}d`;
  }
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
};

// Format RL80 token amounts
const formatRL80 = (amount) => {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}k`;
  return amount.toLocaleString();
};

// Get total pool for a market
const getTotalPool = (market) => {
  if (market.type === 'binary') {
    return market.yesPool + market.noPool;
  }
  return market.options.reduce((sum, opt) => sum + opt.pool, 0);
};

// Category colors and icons
const categoryConfig = {
  agent: { color: '#aa44ff', icon: '🤖' },
  crypto: { color: '#ff8800', icon: '₿' },
  macro: { color: '#00c8ff', icon: '📊' }
};

// Oracle option colors (for oracle accuracy markets)
const ORACLE_COLORS = {
  'EMO': '#ff8800',
  'TEKNO': '#aa44ff',
  'MACRO': '#00c8ff',
  'RL80': '#00ff88'
};

// Hook to read on-chain market data
const useOnChainMarketData = (marketId, enabled = true) => {
  // Read market info
  const { data: marketInfo, isLoading: loadingInfo } = useReadContract({
    contract: predictionMarketContract,
    method: "function getMarketInfo(uint256 _marketId) view returns (string question, uint256 endTime, uint8 winningOption, uint8 optionCount, bool resolved)",
    params: [BigInt(marketId || 0)],
    enabled: enabled && marketId !== undefined && marketId !== null
  });

  // Read all options
  const { data: options, isLoading: loadingOptions } = useReadContract({
    contract: predictionMarketContract,
    method: "function getAllOptions(uint256 _marketId) view returns (string[] options)",
    params: [BigInt(marketId || 0)],
    enabled: enabled && marketId !== undefined && marketId !== null
  });

  // Read all option shares (pool sizes)
  const { data: shares, isLoading: loadingShares } = useReadContract({
    contract: predictionMarketContract,
    method: "function getAllOptionShares(uint256 _marketId) view returns (uint256[] shares)",
    params: [BigInt(marketId || 0)],
    enabled: enabled && marketId !== undefined && marketId !== null
  });

  const isLoading = loadingInfo || loadingOptions || loadingShares;

  // Parse the data
  const parsedData = marketInfo && options && shares ? {
    question: marketInfo[0],
    endTime: new Date(Number(marketInfo[1]) * 1000),
    winningOption: marketInfo[2],
    optionCount: marketInfo[3],
    resolved: marketInfo[4],
    options: options.map((name, idx) => ({
      id: name,
      name: name,
      pool: Number(toEther(shares[idx] || BigInt(0))),
      color: ORACLE_COLORS[name] || '#888888'
    }))
  } : null;

  return { data: parsedData, isLoading };
};

// Hook to read user's shares for a market
const useUserShares = (marketId, userAddress, optionCount, enabled = true) => {
  const { data: userShares, isLoading } = useReadContract({
    contract: predictionMarketContract,
    method: "function getAllUserShares(uint256 _marketId, address _user) view returns (uint256[] shares)",
    params: [BigInt(marketId || 0), userAddress || '0x0000000000000000000000000000000000000000'],
    enabled: enabled && marketId !== undefined && userAddress && optionCount > 0
  });

  return {
    shares: userShares ? userShares.map(s => Number(toEther(s))) : [],
    isLoading
  };
};

// Component to display user's shares and potential winnings
const UserSharesDisplay = ({ marketId, options, userAddress }) => {
  const optionCount = options?.length || 0;
  const { shares, isLoading } = useUserShares(marketId, userAddress, optionCount, !!userAddress);

  // Check if user has any shares
  const totalUserShares = shares.reduce((sum, s) => sum + s, 0);

  if (isLoading) {
    return (
      <div style={{
        padding: '10px',
        background: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '8px',
        marginTop: '12px',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.4)'
      }}>
        Loading your shares...
      </div>
    );
  }

  if (!userAddress || totalUserShares === 0) {
    return null;
  }

  // Calculate total pool
  const totalPool = options.reduce((sum, opt) => sum + opt.pool, 0);

  return (
    <div style={{
      padding: '12px',
      background: 'linear-gradient(135deg, rgba(0, 200, 255, 0.1) 0%, rgba(0, 100, 200, 0.05) 100%)',
      border: '1px solid rgba(0, 200, 255, 0.3)',
      borderRadius: '8px',
      marginTop: '12px'
    }}>
      <div style={{
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#00c8ff',
        marginBottom: '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        Your Position
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
        {options.map((opt, idx) => {
          const userSharesForOption = shares[idx] || 0;
          if (userSharesForOption === 0) return null;

          return (
            <div
              key={opt.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                borderRadius: '4px',
                background: `${opt.color}22`,
                border: `1px solid ${opt.color}44`
              }}
            >
              <span style={{ color: opt.color, fontWeight: 'bold', fontSize: '11px' }}>
                {opt.name}
              </span>
              <span style={{ color: '#fff', fontSize: '11px' }}>
                {formatRL80(userSharesForOption)} shares
              </span>
            </div>
          );
        })}
      </div>

      {/* Potential winnings for each option */}
      <div style={{
        fontSize: '10px',
        color: 'rgba(255,255,255,0.5)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        paddingTop: '8px'
      }}>
        <div style={{ marginBottom: '4px', fontWeight: 'bold' }}>If wins:</div>
        {options.map((opt, idx) => {
          const userSharesForOption = shares[idx] || 0;
          if (userSharesForOption === 0) return null;

          // Calculate potential winnings
          const optionPool = opt.pool;
          const opposingPool = totalPool - optionPool;
          const userShare = optionPool > 0 ? userSharesForOption / optionPool : 0;
          const potentialWinnings = userSharesForOption + (userShare * opposingPool);

          return (
            <div key={opt.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
              <span style={{ color: opt.color }}>{opt.name}:</span>
              <span style={{ color: '#00ff88', fontWeight: 'bold' }}>
                {formatRL80(Math.round(potentialWinnings))} RL80
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Live on-chain pool display component
const LivePoolDisplay = ({ marketId, options: fallbackOptions }) => {
  const { data: onChainData, isLoading } = useOnChainMarketData(marketId);

  // Use on-chain data if available, otherwise fallback
  const options = onChainData?.options || fallbackOptions;
  const totalPool = options?.reduce((sum, opt) => sum + opt.pool, 0) || 0;

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '10px',
        color: 'rgba(255,255,255,0.4)'
      }}>
        <span style={{
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#ff8800',
          animation: 'pulse 1.5s infinite'
        }} />
        Loading live data...
      </div>
    );
  }

  return (
    <div style={{ marginTop: '8px' }}>
      {/* Live indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '6px',
        fontSize: '9px',
        color: 'rgba(255,255,255,0.5)'
      }}>
        <span style={{
          display: 'inline-block',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: '#00ff88',
          boxShadow: '0 0 6px #00ff88'
        }} />
        LIVE ON-CHAIN
      </div>

      {/* Pool breakdown */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {options?.map(opt => {
          const percent = totalPool > 0 ? Math.round((opt.pool / totalPool) * 100) : 0;
          return (
            <div
              key={opt.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 6px',
                borderRadius: '4px',
                background: `${opt.color}15`,
                border: `1px solid ${opt.color}30`,
                fontSize: '10px'
              }}
            >
              <span style={{ color: opt.color, fontWeight: 'bold' }}>{opt.name}</span>
              <span style={{ color: 'rgba(255,255,255,0.6)' }}>{percent}%</span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>({formatRL80(opt.pool)})</span>
            </div>
          );
        })}
      </div>

      <div style={{
        fontSize: '10px',
        color: 'rgba(255,255,255,0.4)',
        marginTop: '6px'
      }}>
        Total Pool: {formatRL80(totalPool)} RL80
      </div>
    </div>
  );
};

// Multi-option probability bar
const MultiProbabilityBar = ({ options }) => {
  const total = options.reduce((sum, opt) => sum + opt.pool, 0);

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: '8px',
      borderRadius: '4px',
      overflow: 'hidden',
      background: 'rgba(0, 0, 0, 0.3)'
    }}>
      {options.map((opt, idx) => {
        const percent = total > 0 ? (opt.pool / total) * 100 : 100 / options.length;
        return (
          <div
            key={opt.id}
            style={{
              width: `${percent}%`,
              background: opt.color,
              opacity: 0.8,
              transition: 'width 0.3s ease',
              borderRight: idx < options.length - 1 ? '1px solid rgba(0,0,0,0.3)' : 'none'
            }}
          />
        );
      })}
    </div>
  );
};

// Binary probability bar
const BinaryProbabilityBar = ({ yesPool, noPool }) => {
  const total = yesPool + noPool;
  const yesPercent = total > 0 ? (yesPool / total) * 100 : 50;

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      height: '8px',
      borderRadius: '4px',
      overflow: 'hidden',
      background: 'rgba(0, 0, 0, 0.3)'
    }}>
      <div style={{
        width: `${yesPercent}%`,
        background: 'linear-gradient(90deg, #00ff88, #00cc66)',
        transition: 'width 0.3s ease'
      }} />
      <div style={{
        width: `${100 - yesPercent}%`,
        background: 'linear-gradient(90deg, #ff4466, #cc2244)',
        transition: 'width 0.3s ease'
      }} />
    </div>
  );
};

// Market card component - handles both binary and multi-option
const MarketCard = ({ market, onSelect, isSelected, walletAddress }) => {
  const totalPool = getTotalPool(market);
  const catConfig = categoryConfig[market.category] || { color: '#888', icon: '📈' };

  // Check if market has on-chain ID for live data
  const hasOnChainId = market.onChainId !== undefined && market.onChainId !== null;

  return (
    <div
      onClick={() => onSelect(market)}
      style={{
        background: isSelected
          ? 'linear-gradient(135deg, rgba(0, 255, 136, 0.15) 0%, rgba(0, 100, 50, 0.2) 100%)'
          : 'linear-gradient(135deg, rgba(20, 20, 30, 0.9) 0%, rgba(10, 10, 20, 0.95) 100%)',
        border: isSelected
          ? '1px solid rgba(0, 255, 136, 0.6)'
          : '1px solid rgba(100, 100, 120, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        marginBottom: '12px',
        boxShadow: isSelected
          ? '0 0 20px rgba(0, 255, 136, 0.2)'
          : '0 4px 12px rgba(0, 0, 0, 0.3)'
      }}
    >
      {/* Category tag */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '8px',
        background: `${catConfig.color}22`,
        color: catConfig.color,
        border: `1px solid ${catConfig.color}44`
      }}>
        <span>{catConfig.icon}</span>
        {market.category}
      </div>

      {/* Question */}
      <div style={{
        color: '#fff',
        fontSize: '14px',
        fontWeight: '600',
        marginBottom: '12px',
        lineHeight: '1.4'
      }}>
        {market.question}
      </div>

      {/* Probability bar */}
      {market.type === 'binary' ? (
        <BinaryProbabilityBar yesPool={market.yesPool} noPool={market.noPool} />
      ) : (
        <MultiProbabilityBar options={market.options} />
      )}

      {/* Options/outcomes display */}
      {market.type === 'binary' ? (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '10px',
          fontSize: '13px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#00ff88', fontWeight: 'bold' }}>YES</span>
            <span style={{ color: '#00ff88' }}>
              {Math.round((market.yesPool / totalPool) * 100)}%
            </span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>
              {formatRL80(market.yesPool)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>
              {formatRL80(market.noPool)}
            </span>
            <span style={{ color: '#ff4466' }}>
              {Math.round((market.noPool / totalPool) * 100)}%
            </span>
            <span style={{ color: '#ff4466', fontWeight: 'bold' }}>NO</span>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginTop: '10px'
        }}>
          {market.options.map(opt => {
            const percent = totalPool > 0 ? Math.round((opt.pool / totalPool) * 100) : 0;
            return (
              <div
                key={opt.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  background: `${opt.color}15`,
                  border: `1px solid ${opt.color}40`,
                  fontSize: '11px'
                }}
              >
                <span style={{ color: opt.color, fontWeight: 'bold' }}>{opt.name}</span>
                <span style={{ color: opt.color }}>{percent}%</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Total pool and time */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '10px',
        fontSize: '11px',
        color: 'rgba(255, 255, 255, 0.5)'
      }}>
        <span>Pool: {formatRL80(totalPool)} RL80</span>
        <span>Ends: {formatTimeRemaining(market.endTime)}</span>
      </div>

      {/* Live on-chain data display */}
      {hasOnChainId && market.type !== 'binary' && (
        <LivePoolDisplay marketId={market.onChainId} options={market.options} />
      )}

      {/* User's shares display */}
      {hasOnChainId && walletAddress && market.type !== 'binary' && (
        <UserSharesDisplay
          marketId={market.onChainId}
          options={market.options}
          userAddress={walletAddress}
        />
      )}
    </div>
  );
};

// Bet panel component - handles both binary and multi-option
const BetPanel = ({ market, onClose, userId = 'anonymous', onBetPlaced }) => {
  const { walletAddress, isWalletConnected } = useWalletAuth();
  const [selectedOption, setSelectedOption] = useState(
    market.type === 'binary' ? 'YES' : market.options[0]?.id
  );
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(true);
  const [checkingAllowance, setCheckingAllowance] = useState(false);

  // Get live on-chain data if market has onChainId
  const hasOnChainId = market.onChainId !== undefined && market.onChainId !== null;
  const { data: onChainData, isLoading: loadingOnChain } = useOnChainMarketData(
    market.onChainId,
    hasOnChainId
  );

  // Use on-chain data for pools if available, otherwise use firebase data
  const liveOptions = onChainData?.options || market.options;
  const liveMarket = { ...market, options: liveOptions };

  const betAmount = parseFloat(amount) || 0;
  const betAmountWei = betAmount > 0 ? toWei(betAmount.toString()) : BigInt(0);
  const totalPool = getTotalPool(liveMarket);

  // Check allowance when amount changes
  useEffect(() => {
    const checkAllowance = async () => {
      if (!walletAddress || betAmount <= 0) {
        setNeedsApproval(true);
        return;
      }

      setCheckingAllowance(true);
      try {
        const currentAllowance = await getPredictionMarketAllowance(walletAddress);
        setNeedsApproval(currentAllowance < betAmountWei);
      } catch (err) {
        console.error('[PredictionMarket] Error checking allowance:', err);
        setNeedsApproval(true);
      } finally {
        setCheckingAllowance(false);
      }
    };

    checkAllowance();
  }, [walletAddress, betAmount, betAmountWei]);

  // Calculate potential winnings using live data
  let yourPool, opposingPool, selectedName, selectedColor;

  if (liveMarket.type === 'binary') {
    yourPool = selectedOption === 'YES' ? liveMarket.yesPool : liveMarket.noPool;
    opposingPool = selectedOption === 'YES' ? liveMarket.noPool : liveMarket.yesPool;
    selectedName = selectedOption;
    selectedColor = selectedOption === 'YES' ? '#00ff88' : '#ff4466';
  } else {
    const selected = liveOptions.find(o => o.id === selectedOption || o.name === selectedOption);
    yourPool = selected?.pool || 0;
    opposingPool = totalPool - yourPool;
    selectedName = selected?.name || selectedOption || '';
    selectedColor = selected?.color || ORACLE_COLORS[selectedOption] || '#888';
  }

  const newYourPool = yourPool + betAmount;
  const yourSharePercent = newYourPool > 0 ? (betAmount / newYourPool) * 100 : 0;
  const potentialWinnings = newYourPool > 0 ? (betAmount / newYourPool) * opposingPool : 0;
  const totalReturn = betAmount + potentialWinnings;
  const multiplier = betAmount > 0 ? totalReturn / betAmount : 0;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(30, 30, 40, 0.98) 0%, rgba(20, 20, 30, 0.98) 100%)',
      border: '1px solid rgba(100, 100, 120, 0.4)',
      borderRadius: '12px',
      padding: '20px',
      marginTop: '16px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>
            Place Your Bet
          </span>
          {hasOnChainId && !loadingOnChain && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '9px',
              background: 'rgba(0, 255, 136, 0.15)',
              color: '#00ff88',
              border: '1px solid rgba(0, 255, 136, 0.3)'
            }}>
              <span style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: '#00ff88',
                boxShadow: '0 0 4px #00ff88'
              }} />
              LIVE
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '0',
            lineHeight: '1'
          }}
        >
          ×
        </button>
      </div>

      {/* Market question */}
      <div style={{
        color: 'rgba(255,255,255,0.7)',
        fontSize: '12px',
        marginBottom: '16px',
        padding: '10px',
        background: 'rgba(0,0,0,0.3)',
        borderRadius: '8px'
      }}>
        {market.question}
      </div>

      {/* Option selector */}
      {market.type === 'binary' ? (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px'
        }}>
          {['YES', 'NO'].map(option => {
            const pool = option === 'YES' ? market.yesPool : market.noPool;
            const percent = Math.round((pool / totalPool) * 100);
            const color = option === 'YES' ? '#00ff88' : '#ff4466';
            const isActive = selectedOption === option;

            return (
              <button
                key={option}
                onClick={() => setSelectedOption(option)}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  borderRadius: '8px',
                  border: isActive ? `2px solid ${color}` : '1px solid rgba(100,100,120,0.3)',
                  background: isActive ? `${color}22` : 'rgba(30, 30, 40, 0.5)',
                  color: isActive ? color : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  transition: 'all 0.2s ease',
                  textAlign: 'center'
                }}
              >
                <div>{option} ({percent}%)</div>
                <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>
                  {formatRL80(pool)} RL80
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: liveOptions.length <= 3 ? `repeat(${liveOptions.length}, 1fr)` : 'repeat(2, 1fr)',
          gap: '8px',
          marginBottom: '16px'
        }}>
          {liveOptions.map(option => {
            const percent = totalPool > 0 ? Math.round((option.pool / totalPool) * 100) : 0;
            const isActive = selectedOption === option.id || selectedOption === option.name;
            const optColor = option.color || ORACLE_COLORS[option.name] || '#888';

            return (
              <button
                key={option.id || option.name}
                onClick={() => setSelectedOption(option.id || option.name)}
                style={{
                  padding: '12px 8px',
                  borderRadius: '8px',
                  border: isActive ? `2px solid ${optColor}` : '1px solid rgba(100,100,120,0.3)',
                  background: isActive ? `${optColor}22` : 'rgba(30, 30, 40, 0.5)',
                  color: isActive ? optColor : 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  transition: 'all 0.2s ease',
                  textAlign: 'center'
                }}
              >
                <div>{option.name}</div>
                <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '2px' }}>
                  {percent}% • {formatRL80(option.pool)}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Amount input */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{
          display: 'block',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '11px',
          marginBottom: '6px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Bet Amount (RL80)
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            style={{
              width: '100%',
              padding: '12px',
              paddingRight: '60px',
              borderRadius: '8px',
              border: '1px solid rgba(100, 100, 120, 0.4)',
              background: 'rgba(0, 0, 0, 0.4)',
              color: '#fff',
              fontSize: '16px',
              fontFamily: 'monospace',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          <span style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'rgba(255,255,255,0.4)',
            fontSize: '12px',
            fontFamily: 'monospace'
          }}>
            RL80
          </span>
        </div>
      </div>

      {/* Bet summary */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '16px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '8px',
          fontSize: '12px'
        }}>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Your share of pool</span>
          <span style={{ color: '#fff' }}>{yourSharePercent.toFixed(1)}%</span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '8px',
          fontSize: '12px'
        }}>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>If {selectedName} wins</span>
          <span style={{ color: selectedColor, fontWeight: 'bold' }}>
            {formatRL80(Math.round(totalReturn))} RL80
          </span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '12px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <span style={{ color: 'rgba(255,255,255,0.5)' }}>Potential profit</span>
          <span style={{ color: selectedColor, fontWeight: 'bold' }}>
            +{formatRL80(Math.round(potentialWinnings))} RL80 ({multiplier.toFixed(2)}x)
          </span>
        </div>
      </div>

      {/* How it works note */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '6px',
        padding: '10px',
        marginBottom: '16px',
        fontSize: '10px',
        color: 'rgba(255,255,255,0.4)',
        lineHeight: '1.4'
      }}>
        <strong style={{ color: 'rgba(255,255,255,0.6)' }}>How it works:</strong> Winners split the losing pools proportionally.
        {market.type === 'multi' && ` With ${market.options.length} options, you win from all other pools combined.`}
      </div>

      {/* Submit button - Wallet connection check */}
      {!isWalletConnected ? (
        <div style={{
          width: '100%',
          padding: '14px',
          borderRadius: '8px',
          border: '1px solid rgba(255, 136, 0, 0.5)',
          background: 'rgba(255, 136, 0, 0.1)',
          color: '#ff8800',
          fontWeight: 'bold',
          fontSize: '14px',
          textAlign: 'center'
        }}>
          Connect wallet to place bets
        </div>
      ) : checkingAllowance ? (
        <div style={{
          width: '100%',
          padding: '14px',
          borderRadius: '8px',
          border: '1px solid rgba(100, 100, 120, 0.4)',
          background: 'rgba(30, 30, 40, 0.5)',
          color: 'rgba(255,255,255,0.5)',
          fontWeight: 'bold',
          fontSize: '14px',
          textAlign: 'center'
        }}>
          Checking allowance...
        </div>
      ) : needsApproval && betAmount > 0 ? (
        /* Step 1: Approve RL80 tokens */
        <TransactionButton
          transaction={() => approveForPredictionMarket(betAmountWei)}
          onTransactionSent={() => setIsSubmitting(true)}
          onTransactionConfirmed={() => {
            setIsSubmitting(false);
            setNeedsApproval(false);
            console.log('[PredictionMarket] Approval confirmed');
          }}
          onError={(err) => {
            setIsSubmitting(false);
            console.error('[PredictionMarket] Approval error:', err);
          }}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '8px',
            border: 'none',
            background: 'linear-gradient(135deg, #ff8800 0%, #cc6600 100%)',
            color: '#000',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 0 20px rgba(255, 136, 0, 0.3)'
          }}
        >
          {isSubmitting ? 'Approving...' : `Approve ${formatRL80(betAmount)} RL80`}
        </TransactionButton>
      ) : (
        /* Step 2: Buy shares on-chain */
        <TransactionButton
          transaction={() => {
            // Get the option index for the contract
            // For binary markets: YES=0, NO=1
            // For multi-option: use the option index from the market
            let optionIndex;
            if (market.type === 'binary') {
              optionIndex = selectedOption === 'YES' ? 0 : 1;
            } else {
              optionIndex = market.options.findIndex(o => o.id === selectedOption);
            }
            return predictionMarketFunctions.buyShares(
              market.onChainId || market.id,
              optionIndex,
              betAmountWei
            );
          }}
          disabled={!amount || parseFloat(amount) <= 0}
          onTransactionSent={() => setIsSubmitting(true)}
          onTransactionConfirmed={async (receipt) => {
            setIsSubmitting(false);
            console.log('[PredictionMarket] Bet confirmed:', receipt);

            // Also record in Firebase for tracking
            try {
              await placeBet({
                marketId: market.id,
                optionId: selectedOption,
                amount: betAmount,
                userId: userId || walletAddress,
                txHash: receipt.transactionHash
              });
            } catch (err) {
              console.warn('[PredictionMarket] Firebase recording failed:', err);
            }

            setAmount('');
            if (onBetPlaced) {
              onBetPlaced({ success: true, txHash: receipt.transactionHash });
            }
            onClose();
          }}
          onError={(err) => {
            setIsSubmitting(false);
            console.error('[PredictionMarket] Transaction error:', err);
          }}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '8px',
            border: 'none',
            background: `linear-gradient(135deg, ${selectedColor} 0%, ${selectedColor}aa 100%)`,
            color: '#000',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: (!amount || parseFloat(amount) <= 0) ? 'not-allowed' : 'pointer',
            opacity: (!amount || parseFloat(amount) <= 0) ? 0.5 : 1,
            boxShadow: `0 0 20px ${selectedColor}44`
          }}
        >
          {isSubmitting ? 'Placing Bet...' : `Bet ${betAmount > 0 ? formatRL80(betAmount) + ' on ' : ''}${selectedName}`}
        </TransactionButton>
      )}
    </div>
  );
};

// Position card component - handles both types
const PositionCard = ({ position, onClaim }) => {
  const [isClaiming, setIsClaiming] = useState(false);

  // Check if position is resolved and user won
  const isResolved = position.resolved;
  const didWin = position.won;
  const hasClaimed = position.claimed;

  if (position.type === 'binary') {
    const totalPool = position.currentYesPool + position.currentNoPool;
    const yourPool = position.side === 'YES' ? position.currentYesPool : position.currentNoPool;
    const opposingPool = position.side === 'YES' ? position.currentNoPool : position.currentYesPool;
    const yourShare = yourPool > 0 ? position.amount / yourPool : 0;
    const potentialWinnings = yourShare * opposingPool;
    const totalReturn = position.amount + potentialWinnings;
    const currentPercent = totalPool > 0 ? Math.round((yourPool / totalPool) * 100) : 50;
    const color = position.side === 'YES' ? '#00ff88' : '#ff4466';

    return (
      <div style={{
        background: isResolved
          ? didWin
            ? 'linear-gradient(135deg, rgba(0, 100, 50, 0.3) 0%, rgba(0, 50, 25, 0.4) 100%)'
            : 'linear-gradient(135deg, rgba(100, 30, 30, 0.3) 0%, rgba(50, 15, 15, 0.4) 100%)'
          : 'linear-gradient(135deg, rgba(20, 20, 30, 0.9) 0%, rgba(10, 10, 20, 0.95) 100%)',
        border: isResolved
          ? didWin ? '1px solid rgba(0, 255, 136, 0.4)' : '1px solid rgba(255, 68, 102, 0.4)'
          : '1px solid rgba(100, 100, 120, 0.3)',
        borderRadius: '10px',
        padding: '12px',
        marginBottom: '8px'
      }}>
        {/* Resolved badge */}
        {isResolved && (
          <div style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '9px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            marginBottom: '8px',
            background: didWin ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 68, 102, 0.2)',
            color: didWin ? '#00ff88' : '#ff4466'
          }}>
            {didWin ? (hasClaimed ? 'CLAIMED' : 'WON') : 'LOST'}
          </div>
        )}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: '11px',
              marginBottom: '4px',
              lineHeight: '1.3'
            }}>
              {position.question}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px'
            }}>
              <span style={{ color, fontWeight: 'bold' }}>
                {position.side} ({currentPercent}%)
              </span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                {formatRL80(position.amount)} RL80
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {isResolved ? (
              didWin ? (
                <>
                  <div style={{ color: '#00ff88', fontWeight: 'bold', fontSize: '12px' }}>
                    Won:
                  </div>
                  <div style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>
                    {formatRL80(Math.round(position.payout || totalReturn))} RL80
                  </div>
                </>
              ) : (
                <div style={{ color: '#ff4466', fontWeight: 'bold', fontSize: '12px' }}>
                  Lost {formatRL80(position.amount)} RL80
                </div>
              )
            ) : (
              <>
                <div style={{ color, fontWeight: 'bold', fontSize: '12px' }}>
                  If wins:
                </div>
                <div style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>
                  {formatRL80(Math.round(totalReturn))} RL80
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>
                  +{formatRL80(Math.round(potentialWinnings))} profit
                </div>
              </>
            )}
          </div>
        </div>
        {/* Claim button for won positions */}
        {isResolved && didWin && !hasClaimed && (
          <TransactionButton
            transaction={() => predictionMarketFunctions.claimWinnings(position.onChainMarketId || position.marketId)}
            onTransactionSent={() => setIsClaiming(true)}
            onTransactionConfirmed={() => {
              setIsClaiming(false);
              if (onClaim) onClaim(position.marketId);
            }}
            onError={(err) => {
              setIsClaiming(false);
              console.error('[PredictionMarket] Claim error:', err);
            }}
            style={{
              width: '100%',
              marginTop: '10px',
              padding: '10px',
              borderRadius: '6px',
              border: 'none',
              background: 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)',
              color: '#000',
              fontWeight: 'bold',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {isClaiming ? 'Claiming...' : 'Claim Winnings'}
          </TransactionButton>
        )}
      </div>
    );
  }

  // Multi-option position
  const totalPool = position.currentOptions?.reduce((sum, o) => sum + o.pool, 0) || 0;
  const yourOption = position.currentOptions?.find(o => o.id === position.selectedOption?.id);
  const yourPool = yourOption?.pool || 0;
  const opposingPool = totalPool - yourPool;
  const yourShare = yourPool > 0 ? position.amount / yourPool : 0;
  const potentialWinnings = yourShare * opposingPool;
  const totalReturn = position.amount + potentialWinnings;
  const currentPercent = totalPool > 0 ? Math.round((yourPool / totalPool) * 100) : 0;
  const optionColor = position.selectedOption?.color || '#888';

  return (
    <div style={{
      background: isResolved
        ? didWin
          ? 'linear-gradient(135deg, rgba(0, 100, 50, 0.3) 0%, rgba(0, 50, 25, 0.4) 100%)'
          : 'linear-gradient(135deg, rgba(100, 30, 30, 0.3) 0%, rgba(50, 15, 15, 0.4) 100%)'
        : 'linear-gradient(135deg, rgba(20, 20, 30, 0.9) 0%, rgba(10, 10, 20, 0.95) 100%)',
      border: isResolved
        ? didWin ? '1px solid rgba(0, 255, 136, 0.4)' : '1px solid rgba(255, 68, 102, 0.4)'
        : '1px solid rgba(100, 100, 120, 0.3)',
      borderRadius: '10px',
      padding: '12px',
      marginBottom: '8px'
    }}>
      {/* Resolved badge */}
      {isResolved && (
        <div style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '9px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          marginBottom: '8px',
          background: didWin ? 'rgba(0, 255, 136, 0.2)' : 'rgba(255, 68, 102, 0.2)',
          color: didWin ? '#00ff88' : '#ff4466'
        }}>
          {didWin ? (hasClaimed ? 'CLAIMED' : 'WON') : 'LOST'}
        </div>
      )}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '11px',
            marginBottom: '4px',
            lineHeight: '1.3'
          }}>
            {position.question}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px'
          }}>
            <span style={{
              color: optionColor,
              fontWeight: 'bold',
              padding: '2px 6px',
              borderRadius: '4px',
              background: `${optionColor}22`
            }}>
              {position.selectedOption?.name || 'Unknown'} ({currentPercent}%)
            </span>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>
              {formatRL80(position.amount)} RL80
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {isResolved ? (
            didWin ? (
              <>
                <div style={{ color: '#00ff88', fontWeight: 'bold', fontSize: '12px' }}>
                  Won:
                </div>
                <div style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>
                  {formatRL80(Math.round(position.payout || totalReturn))} RL80
                </div>
              </>
            ) : (
              <div style={{ color: '#ff4466', fontWeight: 'bold', fontSize: '12px' }}>
                Lost {formatRL80(position.amount)} RL80
              </div>
            )
          ) : (
            <>
              <div style={{
                color: optionColor,
                fontWeight: 'bold',
                fontSize: '12px'
              }}>
                If wins:
              </div>
              <div style={{ color: '#fff', fontSize: '13px', fontWeight: 'bold' }}>
                {formatRL80(Math.round(totalReturn))} RL80
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>
                +{formatRL80(Math.round(potentialWinnings))} profit
              </div>
            </>
          )}
        </div>
      </div>
      {/* Claim button for won positions */}
      {isResolved && didWin && !hasClaimed && (
        <TransactionButton
          transaction={() => predictionMarketFunctions.claimWinnings(position.onChainMarketId || position.marketId)}
          onTransactionSent={() => setIsClaiming(true)}
          onTransactionConfirmed={() => {
            setIsClaiming(false);
            if (onClaim) onClaim(position.marketId);
          }}
          onError={(err) => {
            setIsClaiming(false);
            console.error('[PredictionMarket] Claim error:', err);
          }}
          style={{
            width: '100%',
            marginTop: '10px',
            padding: '10px',
            borderRadius: '6px',
            border: 'none',
            background: 'linear-gradient(135deg, #00ff88 0%, #00cc66 100%)',
            color: '#000',
            fontWeight: 'bold',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          {isClaiming ? 'Claiming...' : 'Claim Winnings'}
        </TransactionButton>
      )}
    </div>
  );
};

// Main overlay component
export default function PredictionMarketOverlay({ show, onClose, userId = 'anonymous' }) {
  const { walletAddress } = useWalletAuth();
  const [markets, setMarkets] = useState(FALLBACK_MARKETS);
  const [positions, setPositions] = useState(FALLBACK_POSITIONS);
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [activeTab, setActiveTab] = useState('markets');
  const [filterCategory, setFilterCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load real data from Firebase
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Ensure current week's oracle market exists
      await ensureCurrentWeekMarket();

      // Load active markets
      const activeMarkets = await getActiveMarkets();
      if (activeMarkets.length > 0) {
        // Transform Firebase data to component format
        const transformedMarkets = activeMarkets.map(m => ({
          id: m.id,
          question: m.question,
          type: m.type === 'oracle_accuracy' ? 'multi' : m.type,
          category: m.type === 'oracle_accuracy' ? 'agent' : (m.category || 'crypto'),
          options: m.options?.map(opt => ({
            id: opt.id,
            name: opt.name,
            pool: opt.pool || 0,
            color: opt.color || '#888888'
          })),
          // Binary market support
          yesPool: m.options?.find(o => o.id === 'YES')?.pool || 0,
          noPool: m.options?.find(o => o.id === 'NO')?.pool || 0,
          endTime: new Date(m.endTime),
          resolved: m.resolved,
          winner: m.winner
        }));
        setMarkets(transformedMarkets);
      }

      // Load user's bets
      if (userId && userId !== 'anonymous') {
        const userBets = await getUserBets(userId);
        if (userBets.length > 0) {
          const transformedBets = userBets.map(b => ({
            marketId: b.marketId,
            question: b.question || 'Market bet',
            type: b.optionId === 'YES' || b.optionId === 'NO' ? 'binary' : 'multi',
            selectedOption: { id: b.optionId, name: b.optionName, color: '#ff8800' },
            side: b.optionId,
            amount: b.amount,
            poolAtEntry: b.poolAtBet,
            resolved: b.resolved,
            won: b.won,
            payout: b.payout
          }));
          setPositions(transformedBets);
        }
      }
    } catch (err) {
      console.error('[PredictionMarket] Error loading data:', err);
      setError('Failed to load markets');
      // Keep fallback data on error
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Load data when overlay opens
  useEffect(() => {
    if (show) {
      loadData();
    }
  }, [show, loadData]);

  // Filter markets by category
  const filteredMarkets = filterCategory === 'all'
    ? markets
    : markets.filter(m => m.category === filterCategory);

  // Calculate totals
  const totalStaked = positions.reduce((acc, pos) => acc + pos.amount, 0);
  const totalPotentialWinnings = positions.reduce((acc, pos) => {
    if (pos.type === 'binary') {
      const yourPool = pos.side === 'YES' ? pos.currentYesPool : pos.currentNoPool;
      const opposingPool = pos.side === 'YES' ? pos.currentNoPool : pos.currentYesPool;
      const yourShare = yourPool > 0 ? pos.amount / yourPool : 0;
      return acc + (yourShare * opposingPool);
    } else {
      const totalPool = pos.currentOptions.reduce((sum, o) => sum + o.pool, 0);
      const yourOption = pos.currentOptions.find(o => o.id === pos.selectedOption.id);
      const yourPool = yourOption?.pool || 0;
      const opposingPool = totalPool - yourPool;
      const yourShare = yourPool > 0 ? pos.amount / yourPool : 0;
      return acc + (yourShare * opposingPool);
    }
  }, 0);

  if (!show) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(4px)',
          zIndex: 999998,
          transition: 'all 0.3s ease'
        }}
      />

      {/* Main panel */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '90%',
        maxWidth: '480px',
        maxHeight: '85vh',
        background: 'linear-gradient(135deg, rgba(15, 15, 25, 0.98) 0%, rgba(5, 5, 15, 0.98) 100%)',
        border: '1px solid rgba(100, 100, 120, 0.4)',
        borderRadius: '16px',
        boxShadow: '0 0 60px rgba(0, 200, 255, 0.15), 0 0 100px rgba(255, 0, 255, 0.1)',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(100, 100, 120, 0.3)',
          background: 'linear-gradient(180deg, rgba(30, 30, 40, 0.5) 0%, transparent 100%)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>{loading ? '⏳' : '🎲'}</span>
              <div>
                <div style={{
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  fontFamily: 'monospace'
                }}>
                  PREDICTION MARKET
                </div>
                <div style={{
                  color: loading ? '#ff8800' : 'rgba(255, 255, 255, 0.5)',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  letterSpacing: '1px'
                }}>
                  {loading ? 'LOADING...' : error ? 'USING CACHED DATA' : 'BET RL80 • WINNERS TAKE ALL'}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: '#fff',
                width: '32px',
                height: '32px',
                cursor: 'pointer',
                fontSize: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease'
              }}
            >
              ×
            </button>
          </div>

          {/* Tab selector */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginTop: '16px'
          }}>
            <button
              onClick={() => setActiveTab('markets')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: activeTab === 'markets'
                  ? '1px solid rgba(0, 200, 255, 0.5)'
                  : '1px solid rgba(100, 100, 120, 0.3)',
                background: activeTab === 'markets'
                  ? 'linear-gradient(135deg, rgba(0, 200, 255, 0.2) 0%, rgba(0, 100, 200, 0.1) 100%)'
                  : 'transparent',
                color: activeTab === 'markets' ? '#00c8ff' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px',
                fontFamily: 'monospace',
                transition: 'all 0.2s ease'
              }}
            >
              MARKETS
            </button>
            <button
              onClick={() => setActiveTab('positions')}
              style={{
                flex: 1,
                padding: '10px',
                borderRadius: '8px',
                border: activeTab === 'positions'
                  ? '1px solid rgba(255, 136, 0, 0.5)'
                  : '1px solid rgba(100, 100, 120, 0.3)',
                background: activeTab === 'positions'
                  ? 'linear-gradient(135deg, rgba(255, 136, 0, 0.2) 0%, rgba(200, 100, 0, 0.1) 100%)'
                  : 'transparent',
                color: activeTab === 'positions' ? '#ff8800' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px',
                fontFamily: 'monospace',
                transition: 'all 0.2s ease'
              }}
            >
              MY BETS ({positions.length})
            </button>
          </div>
        </div>

        {/* Content area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px'
        }}>
          {activeTab === 'markets' && (
            <>
              {/* Category filter */}
              <div style={{
                display: 'flex',
                gap: '6px',
                marginBottom: '16px',
                flexWrap: 'wrap'
              }}>
                {['all', 'agent', 'crypto', 'macro'].map(cat => {
                  const config = categoryConfig[cat] || { color: '#00ff88', icon: '✓' };
                  return (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(cat)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: filterCategory === cat
                          ? `1px solid ${cat === 'all' ? 'rgba(0, 255, 136, 0.5)' : config.color + '88'}`
                          : '1px solid rgba(100, 100, 120, 0.3)',
                        background: filterCategory === cat
                          ? cat === 'all' ? 'rgba(0, 255, 136, 0.15)' : `${config.color}22`
                          : 'transparent',
                        color: filterCategory === cat
                          ? cat === 'all' ? '#00ff88' : config.color
                          : 'rgba(255,255,255,0.5)',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        textTransform: 'uppercase',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {cat !== 'all' && <span>{config.icon}</span>}
                      {cat}
                    </button>
                  );
                })}
              </div>

              {/* Market cards */}
              {filteredMarkets.map(market => (
                <MarketCard
                  key={market.id}
                  market={market}
                  onSelect={setSelectedMarket}
                  isSelected={selectedMarket?.id === market.id}
                  walletAddress={walletAddress}
                />
              ))}

              {/* Bet panel */}
              {selectedMarket && (
                <BetPanel
                  market={selectedMarket}
                  onClose={() => setSelectedMarket(null)}
                  userId={userId}
                  onBetPlaced={() => loadData()}
                />
              )}
            </>
          )}

          {activeTab === 'positions' && (
            <>
              {/* Portfolio summary */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(30, 30, 40, 0.9) 0%, rgba(20, 20, 30, 0.9) 100%)',
                border: '1px solid rgba(100, 100, 120, 0.3)',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '12px'
                }}>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{
                      color: 'rgba(255,255,255,0.5)',
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px'
                    }}>
                      Total Staked
                    </div>
                    <div style={{
                      color: '#fff',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      fontFamily: 'monospace'
                    }}>
                      {formatRL80(totalStaked)} RL80
                    </div>
                  </div>
                  <div style={{
                    width: '1px',
                    background: 'rgba(255,255,255,0.1)'
                  }} />
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{
                      color: 'rgba(255,255,255,0.5)',
                      fontSize: '10px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px'
                    }}>
                      Potential Profit
                    </div>
                    <div style={{
                      color: '#00ff88',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      fontFamily: 'monospace'
                    }}>
                      +{formatRL80(Math.round(totalPotentialWinnings))} RL80
                    </div>
                  </div>
                </div>
                <div style={{
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.3)',
                  textAlign: 'center'
                }}>
                  *Potential profit if all your bets win
                </div>
              </div>

              {/* Position cards */}
              {positions.length > 0 ? (
                positions.map((position, idx) => (
                  <PositionCard key={idx} position={position} onClaim={() => loadData()} />
                ))
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: 'rgba(255,255,255,0.4)'
                }}>
                  <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎲</div>
                  <div style={{ fontSize: '13px' }}>No bets yet</div>
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>
                    Select a market to place your first bet
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid rgba(100, 100, 120, 0.3)',
          background: 'linear-gradient(0deg, rgba(30, 30, 40, 0.5) 0%, transparent 100%)',
          textAlign: 'center'
        }}>
          <div style={{
            color: 'rgba(255, 255, 255, 0.3)',
            fontSize: '10px',
            fontFamily: 'monospace'
          }}>
            Powered by HAIL MARY Protocol
          </div>
        </div>
      </div>
    </>
  );
}
