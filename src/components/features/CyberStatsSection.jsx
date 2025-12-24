'use client';
import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import AnimatedCounter from './AnimatedCounter';

export default function CyberStatsSection({ isMobile }) {
  const statsRef = useRef(null);
  const isInView = useInView(statsRef, { threshold: 0.3 });

  const stakingMetrics = [
    { 
      id: 'stakers',
      value: 1337, 
      suffix: '', 
      prefix: '', 
      label: 'ACTIVE POSITIONS', 
      status: 'OPERATIONAL',
      secLevel: 'ALPHA',
      power: 87.3,
      description: 'Neural network participants maintaining system stability',
      icon: '⚡'
    },
    { 
      id: 'tvl',
      value: 888.8, 
      suffix: 'K', 
      prefix: '$', 
      label: 'TOTAL VALUE LOCKED', 
      status: 'SECURE',
      secLevel: 'BETA',
      power: 92.5,
      description: 'Protected assets within the quantum vault matrix',
      icon: '🔒'
    },
    { 
      id: 'pnl',
      value: 42.86, 
      suffix: '%', 
      prefix: '+', 
      label: 'PROFIT MARGIN', 
      status: 'ASCENDING',
      secLevel: 'GAMMA',
      power: 78.9,
      description: 'Algorithmic profit optimization protocols active',
      icon: '📈'
    },
    { 
      id: 'apy',
      value: 69.42, 
      suffix: '%', 
      prefix: '', 
      label: 'NEURAL APY', 
      status: 'ACTIVE',
      secLevel: 'DELTA',
      power: 94.1,
      description: 'Yield generation through quantum entanglement',
      icon: '🔮'
    }
  ];

  const marketMetrics = [
    { 
      id: 'mcap',
      value: 144.7, 
      suffix: 'K', 
      prefix: '$', 
      label: 'MARKET DOMINANCE', 
      status: 'EXPANDING',
      secLevel: 'EPSILON',
      power: 85.2,
      description: 'System influence across decentralized networks',
      icon: '💎'
    },
    { 
      id: 'holders',
      value: 134, 
      suffix: '', 
      prefix: '', 
      label: 'NETWORK NODES', 
      status: 'CONNECTED',
      secLevel: 'ZETA',
      power: 73.4,
      description: 'Distributed consciousness maintaining consensus',
      icon: '🌐'
    },
    { 
      id: 'burned',
      value: 2.8, 
      suffix: '%', 
      prefix: '', 
      label: 'ENTROPY RATE', 
      status: 'CONTROLLED',
      secLevel: 'ETA',
      power: 66.7,
      description: 'Systematic token reduction for deflation',
      icon: '🔥'
    },
    { 
      id: 'liquidity',
      value: 42.0, 
      suffix: 'K', 
      prefix: '$', 
      label: 'LIQUIDITY DEPTH', 
      status: 'STABLE',
      secLevel: 'THETA',
      power: 88.9,
      description: 'Trading pool stability maintained at optimal levels',
      icon: '💧'
    }
  ];

  const renderMetricCard = (metric, index, isMarket = false) => {
    const delay = isMarket ? 0.05 * (index + 4) : 0.05 * index;
    
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
            <AnimatedCounter 
              target={metric.value} 
              suffix={metric.suffix} 
              prefix={metric.prefix} 
            />
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
            <div style={{ color: metric.status === 'CRITICAL' ? '#f55' : '#0fa' }}>
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
            SYSTEM://METRICS_DASHBOARD
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
              backgroundColor: '#0f0',
              animation: 'pulse 1.5s infinite',
            }} className="status-dot" />
            <span style={{ color: '#0f0', fontFamily: 'monospace', fontSize: isMobile ? '0.7rem' : '0.9rem' }}>
              LIVE DATA
            </span>
          </div>
        </div>
        <div style={{
          height: '1px',
          background: 'linear-gradient(to right, transparent, rgba(0, 255, 170, 0.7), transparent)',
          margin: '8px 0',
        }} className="terminal-line" />
      </div>

      <div style={{ marginBottom: '40px' }}>
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
          :: STAKING PROTOCOLS ::
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(1, 1fr)' : 'repeat(2, 1fr) repeat(2, 1fr)',
          gap: isMobile ? '20px' : '30px',
          width: '100%',
        }}>
          {stakingMetrics.map((metric, index) => renderMetricCard(metric, index))}
        </div>
      </div>

      <div>
        <h3 style={{
          fontSize: isMobile ? '14px' : '16px',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #b8ff00 0%, #00ff00 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '20px',
           fontFamily: 'Blackletter, serif !important',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          textAlign: 'center',
          filter: 'drop-shadow(0 0 10px rgba(0, 255, 0, 0.5))',
        }}>
          :: MARKET DYNAMICS ::
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(1, 1fr)' : 'repeat(2, 1fr) repeat(2, 1fr)',
          gap: isMobile ? '20px' : '30px',
          width: '100%',
        }}>
          {marketMetrics.map((metric, index) => renderMetricCard(metric, index, true))}
        </div>
      </div>

      {/* <div style={{
        background: 'rgba(5, 10, 15, 0.9)',
        border: '1px solid rgba(0, 255, 170, 0.7)',
        borderRadius: '5px',
        padding: '10px 15px',
        marginTop: '30px',
        boxShadow: '0 0 15px rgba(0, 255, 170, 0.7)',
      }} className="terminal-footer">
        <div style={{
          height: '1px',
          background: 'linear-gradient(to right, transparent, rgba(0, 255, 170, 0.7), transparent)',
          marginBottom: '8px',
        }} className="terminal-line" />
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{
            fontSize: '0.9rem',
            opacity: 0.8,
            color: '#0fa',
            fontFamily: 'monospace',
          }} className="terminal-info">
            HOVER TO INTERACT
          </div>
          <div style={{
            color: '#ff0',
            fontSize: '0.9rem',
            fontFamily: 'monospace',
            animation: 'blink 2s infinite',
          }} className="terminal-warning">
            SYSTEM STABILITY: OPTIMAL
          </div>
        </div>
      </div> */}

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
        
        @keyframes blink {
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