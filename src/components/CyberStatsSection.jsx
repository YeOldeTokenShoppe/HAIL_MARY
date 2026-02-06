'use client';
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import AnimatedCounter from './AnimatedCounter';
import { useReadContract } from 'thirdweb/react';
import { totalSupply } from 'thirdweb/extensions/erc20';
import { erc20Contract } from '@/lib/contract';
import { stakingContract } from '@/lib/stakingContract';

const INITIAL_SUPPLY = 80_000_000_000; // 80 billion

// Format a large number into { value, suffix } for AnimatedCounter
function formatLargeNumber(num) {
  if (num >= 1e9) return { value: parseFloat((num / 1e9).toFixed(1)), suffix: 'B' };
  if (num >= 1e6) return { value: parseFloat((num / 1e6).toFixed(1)), suffix: 'M' };
  if (num >= 1e3) return { value: parseFloat((num / 1e3).toFixed(1)), suffix: 'K' };
  return { value: num, suffix: '' };
}

export default function CyberStatsSection({ isMobile }) {
  const statsRef = useRef(null);
  const isInView = useInView(statsRef, { threshold: 0.3 });

  // Read total supply from ERC20 contract
  const { data: totalSupplyData } = useReadContract(
    totalSupply,
    { contract: erc20Contract }
  );

  // Read total staked from staking contract (works without wallet)
  const { data: totalStakedData } = useReadContract({
    contract: stakingContract,
    method: "function totalStaked() view returns (uint256)",
    params: [],
  });

  // Fetch holder count from our API route (BaseScan)
  const [holderCount, setHolderCount] = useState(null);
  useEffect(() => {
    fetch('/api/token-stats')
      .then(res => res.json())
      .then(data => {
        if (data.holderCount) setHolderCount(data.holderCount);
      })
      .catch(() => {});
  }, []);

  // Derive stats from contract data
  const currentSupply = useMemo(() => {
    if (totalSupplyData !== undefined && totalSupplyData !== null) {
      return Number(totalSupplyData / BigInt(10 ** 18));
    }
    return null;
  }, [totalSupplyData]);

  const totalStakedTokens = useMemo(() => {
    if (totalStakedData !== undefined && totalStakedData !== null) {
      return Number(totalStakedData / BigInt(10 ** 18));
    }
    return 0;
  }, [totalStakedData]);

  const burnedTokens = useMemo(() => {
    if (currentSupply === null) return 0;
    return INITIAL_SUPPLY - currentSupply;
  }, [currentSupply]);

  const dataLoaded = currentSupply !== null;

  // Build the 4 metric cards from real data
  const metrics = useMemo(() => {
    const supply = dataLoaded ? formatLargeNumber(currentSupply) : { value: 0, suffix: 'B' };
    const burned = formatLargeNumber(burnedTokens);
    const staked = formatLargeNumber(totalStakedTokens);
    return [
      {
        id: 'supply',
        value: supply.value,
        suffix: supply.suffix,
        prefix: '',
        label: 'TOTAL SUPPLY',
        status: 'LIVE',
        secLevel: 'ALPHA',
        power: dataLoaded ? 99.9 : 0,
        description: `Initial mint of ${INITIAL_SUPPLY.toLocaleString()} RL80 tokens on Base mainnet`,
        icon: '💎'
      },
      {
        id: 'burned',
        value: burned.value,
        suffix: burned.suffix,
        prefix: '',
        label: 'TOKENS BURNED',
        status: 'DEFLATIONARY',
        secLevel: 'BETA',
        power: dataLoaded ? Math.min((burnedTokens / INITIAL_SUPPLY) * 100 * 10, 99.9).toFixed(1) : 0,
        description: 'Permanently removed from circulation via candle offerings and burns',
        icon: '🔥'
      },
      {
        id: 'staked',
        value: staked.value,
        suffix: staked.suffix,
        prefix: '',
        label: 'TOTAL STAKED',
        status: totalStakedTokens > 0 ? 'LOCKED' : 'AWAITING',
        secLevel: 'GAMMA',
        power: dataLoaded && currentSupply > 0 ? ((totalStakedTokens / currentSupply) * 100).toFixed(1) : 0,
        description: 'Tokens committed to the staking contract earning future ETH rewards',
        icon: '⚡'
      },
      {
        id: 'holders',
        value: holderCount || 0,
        suffix: '',
        prefix: '',
        label: 'HOLDERS',
        status: holderCount ? 'CONNECTED' : 'LOADING',
        secLevel: 'DELTA',
        power: holderCount ? Math.min(holderCount / 10, 99.9).toFixed(1) : 0,
        description: 'Unique wallets holding RL80 tokens on Base network',
        icon: '🌐'
      }
    ];
  }, [dataLoaded, currentSupply, burnedTokens, totalStakedTokens, holderCount]);

  const renderMetricCard = (metric, index) => {
    const delay = 0.05 * index;

    return (
      <motion.div
        key={metric.id}
        className="cyber-card"
        data-card-id={metric.id}
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, delay }}
        style={{
          position: 'relative',
          background: 'transparent',
          cursor: 'pointer',
          perspective: '1000px',
          width: '100%',
          height: isMobile ? '280px' : '320px',
        }}
        whileHover={{ scale: 1.05 }}
      >
        <div style={{
          position: 'absolute',
          top: '-5px',
          left: '-5px',
          right: '-5px',
          bottom: '-5px',
          borderRadius: '15px',
          background: `radial-gradient(circle, rgba(0, 255, 170, 0.4) 0%, transparent 70%)`,
          filter: 'blur(15px)',
          opacity: 0.7,
          transition: 'all 0.3s ease',
          zIndex: -2,
        }} className="card-glow" />

        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(10, 15, 25, 0.85)',
          border: '1px solid rgba(0, 255, 170, 0.5)',
          borderRadius: '10px',
          zIndex: -1,
          overflow: 'hidden',
        }} className="card-glitch">
          <div style={{
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '5px',
            background: 'rgba(255, 255, 255, 0.1)',
            animation: `scanline 3s linear infinite ${index * 0.3}s`,
            pointerEvents: 'none',
          }} />
        </div>

        <div style={{
          width: '100%',
          height: '100%',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '10px',
          position: 'relative',
          zIndex: 1,
        }} className="card-content">
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '15px',
            fontSize: '0.8rem',
            fontFamily: 'monospace',
          }} className="card-header-area">
            <div style={{ color: '#0fa' }}>{`#${metric.id.toUpperCase()}`}</div>
            <div style={{ color: '#f55' }}>SEC.LVL: {metric.secLevel}</div>
          </div>

          <div style={{
            fontSize: '1.2rem',
            marginBottom: '10px',
            color: '#fff',
            textShadow: '0 0 5px rgba(0, 255, 170, 0.7)',
            letterSpacing: '1px',
            fontFamily: 'monospace',
            fontWeight: 'bold',
          }} className="card-title">
            {metric.label}
          </div>

          <div style={{
            fontSize: '3rem',
            textAlign: 'center',
            margin: '10px 0',
          }} className="card-symbol">
            {metric.icon}
          </div>

          <div style={{
            fontSize: isMobile ? '28px' : '36px',
            fontWeight: 'bold',
            color: '#00ff00',
            textAlign: 'center',
            marginBottom: '10px',
            fontFamily: 'monospace',
            textShadow: '0 0 10px rgba(0, 255, 0, 0.5)',
          }}>
            {(metric.id === 'holders' ? holderCount !== null : dataLoaded) ? (
              <AnimatedCounter
                target={metric.value}
                suffix={metric.suffix}
                prefix={metric.prefix}
              />
            ) : (
              <span style={{ opacity: 0.4 }}>...</span>
            )}
          </div>

          <div style={{
            fontSize: '0.75rem',
            marginBottom: '15px',
            color: '#ccc',
            textAlign: 'center',
            flexGrow: 1,
            fontFamily: 'monospace',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            hyphens: 'auto',
            lineHeight: '1.2',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }} className="card-description">
            {metric.description}
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.7rem',
            marginTop: 'auto',
            fontFamily: 'monospace',
          }} className="card-footer-area">
            <div style={{ color: '#0fa' }}>PWR: {metric.power}%</div>
            <div style={{ color: metric.status === 'AWAITING' ? '#ff0' : '#0fa' }}>
              STATUS: {metric.status}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div ref={statsRef} style={{ width: '100%' }}>
      <div style={{
        background: 'rgba(5, 10, 15, 0.9)',
        border: '1px solid rgba(0, 255, 170, 0.7)',
        borderRadius: '5px',
        padding: '10px 15px',
        marginBottom: '30px',
        boxShadow: '0 0 15px rgba(0, 255, 170, 0.7)',
      }} className="terminal-header">
        <div style={{
          display: 'flex',
          justifyContent: isMobile ? 'flex-start' : 'space-between',
          alignItems: 'center',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          gap: isMobile ? '8px' : '0'
        }}>
          <div style={{
            fontSize: isMobile ? '0.9rem' : '1.2rem',
            letterSpacing: '1px',
            color: '#0fa',
            fontFamily: 'monospace',
          }} className="terminal-title">
            SYSTEM://ON_CHAIN_METRICS
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginLeft: isMobile ? '0' : 'auto',
            flexShrink: 0
          }}>
            <span style={{
              display: 'inline-block',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: dataLoaded ? '#0f0' : '#ff0',
              animation: 'pulse 1.5s infinite',
            }} className="status-dot" />
            <span style={{ color: dataLoaded ? '#0f0' : '#ff0', fontFamily: 'monospace', fontSize: isMobile ? '0.7rem' : '0.9rem' }}>
              {dataLoaded ? 'LIVE DATA' : 'LOADING...'}
            </span>
          </div>
        </div>
        <div style={{
          height: '1px',
          background: 'linear-gradient(to right, transparent, rgba(0, 255, 170, 0.7), transparent)',
          margin: '8px 0',
        }} className="terminal-line" />
      </div>

      <div>
        <h3 style={{
          fontSize: isMobile ? '14px' : '16px',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #ffd700 0%, #b8ff00 50%, #00ff00 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '20px',
          fontFamily: 'Blackletter, serif !important',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          textAlign: 'center',
          filter: 'drop-shadow(0 0 10px rgba(255, 215, 0, 0.3))',
        }}>
          :: TOKEN METRICS :: BASE MAINNET ::
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(1, 1fr)' : 'repeat(4, 1fr)',
          gap: isMobile ? '20px' : '30px',
          width: '100%',
        }}>
          {metrics.map((metric, index) => renderMetricCard(metric, index))}
        </div>
      </div>

      <style jsx>{`
        @keyframes scanline {
          0% {
            top: -5px;
            opacity: 0.1;
          }
          50% {
            opacity: 0.3;
          }
          100% {
            top: 100%;
            opacity: 0.1;
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }

        .cyber-card:hover .card-glow {
          filter: blur(20px);
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}
