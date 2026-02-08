'use client';
import React, { useState, useRef, useEffect } from 'react';
import { motion, useInView } from 'framer-motion';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

const CONTRACT_ADDRESS = "0x30D01555d88c76500a82754A1D53cAc082A6CB75";

export default function CyberTokenomicsSection({ isMobile }) {
  const [activeCard, setActiveCard] = useState(null);
  const [activePhase, setActivePhase] = useState('phase1');
  const [viewMode, setViewMode] = useState('distribution'); // 'distribution' or 'tax'
  const [copied, setCopied] = useState(false);
  const chartRef = useRef(null);
  const isInView = useInView(chartRef, { once: true, threshold: 0.3 });
  const [chartData, setChartData] = useState(null);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(CONTRACT_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Initial token distribution (fixed, not phase-dependent)
  const tokenDistribution = {
    title: 'TOKEN DISTRIBUTION',
    subtitle: 'INITIAL SUPPLY ALLOCATION',
    total: '80B',
    data: [
      {
        id: 'TOKEN001',
        title: 'LIQUIDITY POOL',
        percentage: 80,
        amount: '64B',
        color: '#00ff00',
        description: 'Locked liquidity ensuring deep markets and stable trading from day one',
        details: [
          'Permanently locked LP',
          'DEX liquidity depth',
          'Price stability foundation',
          'Slippage minimization'
        ],
        status: 'LOCKED',
        securityLevel: 'MAXIMUM',
      },
      {
        id: 'TOKEN002',
        title: 'TREASURY',
        percentage: 12,
        amount: '9.6B',
        color: '#ffd700',
        description: 'Strategic reserves for development, partnerships, and ecosystem growth',
        details: [
          'Development funding',
          'Partnership acquisitions',
          'Emergency reserves',
          'Ecosystem expansion'
        ],
        status: 'SECURED',
        securityLevel: 'HIGH',
      },
      {
        id: 'TOKEN003',
        title: 'MARKETING',
        percentage: 8,
        amount: '6.4B',
        color: '#d946ef',
        description: 'Growth acceleration, exchange listings, and community building',
        details: [
          'CEX listing fees',
          'Influencer campaigns',
          'Community events',
          'Brand awareness'
        ],
        status: 'ACTIVE',
        securityLevel: 'STANDARD',
      },
    ],
  };

  // Phase configurations for tax distribution (3-phase rollout)
  const phaseConfigs = {
    phase1: {
      id: 'PHASE1',
      label: 'PHASE 1: LIQUIDITY BUILD',
      status: 'BOOT',
      tax: {
        id: 'TAX001',
        label: 'BUY / SELL TAX',
        value: '4%',
        description:
          'Liquidity-first routing while the pool is thin. Deepens LP, stabilizes price discovery.',
        breakdown: [
          { label: 'Liquidity (Build)', value: '2.5%', color: '#ffd700' },
          { label: 'Treasury (LP ops)', value: '1.0%', color: '#00ff00' },
          { label: 'Marketing', value: '0.5%', color: '#d946ef' },
          { label: 'Staking (Queued)', value: '0%', color: '#555' },
          { label: 'Wallet Transfers', value: '0%', color: '#0fa', always: true },
        ],
      },
      note:
        'Staking rewards queued but not distributed. Advances to Phase 2 once LP depth + organic volume thresholds are met.',
    },
    phase2: {
      id: 'PHASE2',
      label: 'PHASE 2: PILOT DIVIDENDS',
      status: 'HYBRID',
      tax: {
        id: 'TAX001',
        label: 'BUY / SELL TAX',
        value: '4%',
        description:
          'Hybrid mode: staking rewards come online while liquidity growth continues.',
        breakdown: [
          { label: 'Liquidity (Growth)', value: '2.0%', color: '#ffd700' },
          { label: 'Staking Rewards', value: '1.0%', color: '#00ff00' },
          { label: 'Marketing', value: '0.5%', color: '#d946ef' },
          { label: 'Treasury', value: '0.5%', color: '#0fa' },
          { label: 'Wallet Transfers', value: '0%', color: '#0fa', always: true },
        ],
      },
      note:
        'Pilot dividends active. LP remains primary recipient. Advances to Phase 3 once rewards are meaningful + LP is sturdy.',
    },
    phase3: {
      id: 'PHASE3',
      label: 'PHASE 3: STAKING DOMINANT',
      status: 'MATURE',
      tax: {
        id: 'TAX001',
        label: 'BUY / SELL TAX',
        value: '4%',
        description:
          'Mature mode: staking is the main character. Liquidity is healthy; rewards maximized for holders.',
        breakdown: [
          { label: 'Staking Rewards', value: '2.0%', color: '#00ff00' },
          { label: 'Liquidity (Maintenance)', value: '1.5%', color: '#ffd700' },
          { label: 'Marketing', value: '0.5%', color: '#d946ef' },
          { label: 'Wallet Transfers', value: '0%', color: '#0fa', always: true },
        ],
      },
      note:
        'Full dividend mode. Liquidity allocation maintains long-term pool stability.',
    },
    phase4: {
      id: 'PHASE4',
      label: 'PHASE 4: ZERO TAX',
      status: 'FINAL',
      tax: {
        id: 'TAX001',
        label: 'ALL TRANSACTIONS',
        value: '0%',
        description:
          'Zero-tax mode: protocol generates sufficient non-tax revenue to support staking rewards. Full frictionless trading.',
        breakdown: [
          { label: 'Buy Tax', value: '0%', color: '#fff' },
          { label: 'Sell Tax', value: '0%', color: '#fff' },
          { label: 'Wallet Transfers', value: '0%', color: '#0fa', always: true },
        ],
      },
      note:
        'Optional final state. Enacted only when liquidity is mature and non-tax revenue sustains staking rewards. Transition will be gradual and announced in advance.',
    },
  };

  const currentPhase = phaseConfigs[activePhase] || phaseConfigs.phase1;

  const taxProtocols = [
    {
      ...currentPhase.tax,
      phaseLabel: currentPhase.label,
      phaseStatus: currentPhase.status,
      phaseNote: currentPhase.note,
    },
  ];

  // Phase-aware tax distribution data for pie chart
  const distributionConfigs = {
    phase1: {
      title: 'TAX ALLOCATION',
      subtitle: '4% FEE DISTRIBUTION',
      data: [
        {
          id: 'DIST001',
          title: 'LIQUIDITY',
          percentage: 62.5,
          amount: '2.5%',
          color: '#ffd700',
          description: 'Primary allocation to deepen liquidity pool during bootstrap phase',
          details: ['LP depth building', 'Price stability', 'Slippage reduction', 'DEX reserves'],
          status: 'ACTIVE',
          securityLevel: 'PRIORITY',
        },
        {
          id: 'DIST002',
          title: 'TREASURY',
          percentage: 25,
          amount: '1.0%',
          color: '#00ff00',
          description: 'Operational runway for LP management and protocol development',
          details: ['LP operations', 'Development funding', 'Emergency reserves', 'Infrastructure'],
          status: 'SECURED',
          securityLevel: 'HIGH',
        },
        {
          id: 'DIST003',
          title: 'MARKETING',
          percentage: 12.5,
          amount: '0.5%',
          color: '#d946ef',
          description: 'Growth acceleration and community expansion initiatives',
          details: ['Community growth', 'Partnerships', 'Content creation', 'Exchange outreach'],
          status: 'ACTIVE',
          securityLevel: 'STANDARD',
        },
      ],
    },
    phase2: {
      title: 'TAX ALLOCATION',
      subtitle: '4% FEE DISTRIBUTION',
      data: [
        {
          id: 'DIST001',
          title: 'LIQUIDITY',
          percentage: 50,
          amount: '2.0%',
          color: '#ffd700',
          description: 'Continued liquidity growth while staking rewards begin',
          details: ['LP expansion', 'Price stability', 'Volume support', 'DEX reserves'],
          status: 'ACTIVE',
          securityLevel: 'HIGH',
        },
        {
          id: 'DIST002',
          title: 'STAKING',
          percentage: 25,
          amount: '1.0%',
          color: '#00ff00',
          description: 'Pilot staking rewards distributed to token holders',
          details: ['Holder rewards', 'Staking yields', 'Dividend pool', 'Reward distribution'],
          status: 'LIVE',
          securityLevel: 'PRIORITY',
        },
        {
          id: 'DIST003',
          title: 'MARKETING',
          percentage: 12.5,
          amount: '0.5%',
          color: '#d946ef',
          description: 'Sustained growth and awareness campaigns',
          details: ['Community events', 'Partnerships', 'Content creation', 'Influencer ops'],
          status: 'ACTIVE',
          securityLevel: 'STANDARD',
        },
        {
          id: 'DIST004',
          title: 'TREASURY',
          percentage: 12.5,
          amount: '0.5%',
          color: '#0fa',
          description: 'Reduced treasury allocation as protocol matures',
          details: ['Operations', 'Development', 'Emergency fund', 'Infrastructure'],
          status: 'SECURED',
          securityLevel: 'STANDARD',
        },
      ],
    },
    phase3: {
      title: 'TAX ALLOCATION',
      subtitle: '4% FEE DISTRIBUTION',
      data: [
        {
          id: 'DIST001',
          title: 'STAKING',
          percentage: 50,
          amount: '2.0%',
          color: '#00ff00',
          description: 'Maximum staking rewards - the main feature of mature protocol',
          details: ['Max holder rewards', 'Dividend priority', 'Yield optimization', 'Reward pool'],
          status: 'DOMINANT',
          securityLevel: 'MAXIMUM',
        },
        {
          id: 'DIST002',
          title: 'LIQUIDITY',
          percentage: 37.5,
          amount: '1.5%',
          color: '#ffd700',
          description: 'Maintenance allocation to sustain healthy liquidity levels',
          details: ['LP maintenance', 'Stability ops', 'Volume support', 'Long-term reserves'],
          status: 'STABLE',
          securityLevel: 'HIGH',
        },
        {
          id: 'DIST003',
          title: 'MARKETING',
          percentage: 12.5,
          amount: '0.5%',
          color: '#d946ef',
          description: 'Ongoing community and ecosystem growth',
          details: ['Brand building', 'Partnerships', 'Community events', 'Ecosystem expansion'],
          status: 'ACTIVE',
          securityLevel: 'STANDARD',
        },
      ],
    },
    phase4: {
      title: 'TAX ALLOCATION',
      subtitle: 'ZERO TAX MODE',
      data: [
        {
          id: 'DIST001',
          title: 'NO TAX',
          percentage: 100,
          amount: '0%',
          color: '#ffd700',
          description: 'All transaction fees eliminated - fully frictionless trading',
          details: ['Zero buy tax', 'Zero sell tax', 'Zero transfer tax', 'Maximum freedom'],
          status: 'FINAL',
          securityLevel: 'COMPLETE',
        },
      ],
    },
  };

  // Select data based on view mode
  const currentDistribution = viewMode === 'distribution'
    ? tokenDistribution
    : (distributionConfigs[activePhase] || distributionConfigs.phase1);
  const tokenomicsData = currentDistribution.data;


  // Set up Chart.js data when component mounts, comes into view, view mode, or phase changes
  useEffect(() => {
    if (isInView) {
      const data = viewMode === 'distribution'
        ? tokenDistribution.data
        : (distributionConfigs[activePhase]?.data || distributionConfigs.phase1.data);
      setChartData({
        labels: data.map(item => item.title),
        datasets: [
          {
            data: data.map(item => item.percentage),
            backgroundColor: data.map(item => item.color),
            borderColor: data.map(item => item.color),
            borderWidth: 2,
            hoverBorderWidth: 4,
          },
        ],
      });
    }
  }, [isInView, activePhase, viewMode]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // We'll use custom labels
      },
      tooltip: {
        enabled: false, // Using custom hover cards instead
      },
    },
    animation: {
      animateRotate: true,
      animateScale: false, // Disable scale animation to prevent snake effect
      duration: 1500,
      easing: 'easeOutQuart',
      delay: (context) => {
        return context.dataIndex * 300; // Stagger each segment by 300ms
      },
    },
    elements: {
      arc: {
        borderWidth: 2,
        hoverBorderWidth: 4,
      },
    },
    interaction: {
      intersect: false,
    },
  };

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <div style={{
        background: 'rgba(5, 10, 15, 0.9)',
        border: '1px solid rgba(0, 255, 170, 0.7)',
        borderRadius: '5px',
        padding: isMobile ? '12px' : '15px 20px',
        marginBottom: '30px',
        boxShadow: '0 0 15px rgba(0, 255, 170, 0.7)',
      }}>
        {/* Contract Address Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
          marginBottom: '10px',
        }}>
          <div style={{
            color: '#ffd700',
            fontSize: isMobile ? '10px' : '11px',
            fontFamily: 'monospace',
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }}>
            RL80 Contract Address (Base)
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#00ff00',
              animation: 'pulse 1.5s infinite',
            }} />
            <span style={{
              color: '#00ff00',
              fontFamily: 'monospace',
              fontSize: isMobile ? '9px' : '10px',
              letterSpacing: '0.5px',
            }}>
              VERIFIED
            </span>
          </div>
        </div>

        {/* Copyable Contract Address */}
        <div
          onClick={copyToClipboard}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '10px 12px',
            background: 'rgba(0, 0, 0, 0.4)',
            borderRadius: '4px',
            border: '1px solid rgba(0, 255, 170, 0.3)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 255, 170, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(0, 255, 170, 0.6)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)';
            e.currentTarget.style.borderColor = 'rgba(0, 255, 170, 0.3)';
          }}
        >
          <code style={{
            color: '#0fa',
            fontSize: isMobile ? '10px' : '13px',
            fontFamily: 'monospace',
            letterSpacing: '0.5px',
            wordBreak: 'break-all',
          }}>
            {CONTRACT_ADDRESS}
          </code>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            background: copied ? 'rgba(0, 255, 0, 0.2)' : 'rgba(0, 255, 170, 0.15)',
            borderRadius: '3px',
            border: copied ? '1px solid #00ff00' : '1px solid rgba(0, 255, 170, 0.4)',
            flexShrink: 0,
            transition: 'all 0.2s ease',
          }}>
            <span style={{
              color: copied ? '#00ff00' : '#0fa',
              fontSize: '10px',
              fontFamily: 'monospace',
              fontWeight: 'bold',
            }}>
              {copied ? '✓ COPIED' : 'COPY'}
            </span>
          </div>
        </div>

        {/* Verification Warning */}
        <div style={{
          marginTop: '10px',
          padding: '8px 10px',
          background: 'rgba(255, 215, 0, 0.08)',
          borderRadius: '3px',
          borderLeft: '3px solid #ffd700',
        }}>
          <div style={{
            color: 'rgba(255, 215, 0, 0.9)',
            fontSize: isMobile ? '9px' : '10px',
            fontFamily: 'monospace',
            lineHeight: '1.4',
          }}>
            ⚠️ Always verify the contract address before buying. Only purchase RL80 through official links or by pasting this exact address.
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: isMobile ? '40px' : '50px',
        alignItems: 'start'
      }}>
        <div>
          {/* View Mode Toggle */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '4px',
            marginBottom: '15px',
          }}>
            <button
              onClick={() => setViewMode('distribution')}
              style={{
                padding: '6px 12px',
                background: viewMode === 'distribution'
                  ? 'rgba(0, 255, 0, 0.15)'
                  : 'rgba(0, 0, 0, 0.4)',
                border: viewMode === 'distribution'
                  ? '1px solid #00ff00'
                  : '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '4px 0 0 4px',
                color: viewMode === 'distribution' ? '#00ff00' : 'rgba(255, 255, 255, 0.5)',
                fontFamily: 'monospace',
                fontSize: '9px',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            >
              TOKEN DIST
            </button>
            <button
              onClick={() => setViewMode('tax')}
              style={{
                padding: '6px 12px',
                background: viewMode === 'tax'
                  ? 'rgba(0, 255, 170, 0.15)'
                  : 'rgba(0, 0, 0, 0.4)',
                border: viewMode === 'tax'
                  ? '1px solid #0fa'
                  : '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '0 4px 4px 0',
                color: viewMode === 'tax' ? '#0fa' : 'rgba(255, 255, 255, 0.5)',
                fontFamily: 'monospace',
                fontSize: '9px',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
              }}
            >
              TAX ALLOC
            </button>
          </div>

          <h3 style={{
            fontSize: isMobile ? '14px' : '16px',
            fontWeight: 'bold',
            backgroundImage: viewMode === 'distribution'
              ? 'linear-gradient(135deg, #66ff00 0%, #00ff00 100%)'
              : 'linear-gradient(135deg, #00ffaa 0%, #0fa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '8px',
            fontFamily: 'Fjalla One !important',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            textAlign: 'center',
            filter: viewMode === 'distribution'
              ? 'drop-shadow(0 0 10px rgba(0, 255, 0, 0.5))'
              : 'drop-shadow(0 0 10px rgba(0, 255, 170, 0.5))',
          }}>
            :: {currentDistribution.title} ::
          </h3>
          <div style={{
            textAlign: 'center',
            marginBottom: viewMode === 'tax' ? '10px' : '20px',
            color: viewMode === 'distribution'
              ? 'rgba(0, 255, 0, 0.8)'
              : (activePhase === 'phase4' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 255, 170, 0.8)'),
            fontSize: '11px',
            fontFamily: 'monospace',
            letterSpacing: '1px',
          }}>
            {currentDistribution.subtitle}
          </div>

          {/* Phase selector - only show in tax allocation mode */}
          {viewMode === 'tax' && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '6px',
              marginBottom: '15px',
              flexWrap: 'wrap',
            }}>
              {['phase1', 'phase2', 'phase3', 'phase4'].map((phase) => {
                const isActive = activePhase === phase;
                const phaseColors = {
                  phase1: { border: '#ffd700', text: '#ffd700' },
                  phase2: { border: '#0fa', text: '#0fa' },
                  phase3: { border: '#00ff00', text: '#00ff00' },
                  phase4: { border: '#fff', text: '#fff' },
                };
                const colors = phaseColors[phase];
                return (
                  <button
                    key={phase}
                    onClick={() => setActivePhase(phase)}
                    style={{
                      padding: '4px 8px',
                      background: isActive ? `${colors.border}20` : 'transparent',
                      border: isActive
                        ? `1px solid ${colors.border}`
                        : '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '3px',
                      color: isActive ? colors.text : 'rgba(255, 255, 255, 0.4)',
                      fontFamily: 'monospace',
                      fontSize: '9px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    P{phase.replace('phase', '')}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ position: 'relative', marginBottom: '30px' }}>
            <div 
              ref={chartRef}
              style={{
                position: 'relative',
                width: isMobile ? '280px' : '320px',
                height: isMobile ? '280px' : '320px',
                margin: '0 auto'
              }}
            >
              {/* Chart.js Animated Donut Chart */}
              <div style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                filter: 'drop-shadow(0 10px 30px rgba(0, 0, 0, 0.5))',
                borderRadius: '50%',
              }}>
                {chartData && (
                  <Pie 
                    data={chartData} 
                    options={chartOptions}
                    style={{
                      filter: 'drop-shadow(0 0 20px rgba(0, 255, 170, 0.3))',
                    }}
                  />
                )}
                
                {/* Center text overlay with background */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  background: 'rgba(0, 0, 0, 0.8)',
                  borderRadius: '50%',
                  width: isMobile ? '100px' : '120px',
                  height: isMobile ? '100px' : '120px',
                  border: viewMode === 'distribution'
                    ? '2px solid rgba(0, 255, 0, 0.3)'
                    : `2px solid ${activePhase === 'phase4' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 255, 170, 0.3)'}`,
                  backdropFilter: 'blur(10px)',
                }}>
                  <motion.div
                    key={`${viewMode}-${activePhase}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      fontSize: isMobile ? '1.8em' : '2.2em',
                      fontWeight: '800',
                      color: viewMode === 'distribution'
                        ? '#ffd700'
                        : (activePhase === 'phase4' ? '#fff' : '#0fa'),
                      lineHeight: '1',
                      textShadow: viewMode === 'distribution'
                        ? '0 0 10px rgba(255, 215, 0, 0.5)'
                        : (activePhase === 'phase4'
                          ? '0 0 15px rgba(255, 255, 255, 0.6)'
                          : '0 0 10px rgba(0, 255, 170, 0.5)'),
                      fontFamily: 'monospace',
                    }}
                  >
                    {viewMode === 'distribution'
                      ? '80B'
                      : (activePhase === 'phase4' ? '0%' : '4%')}
                  </motion.div>
                  <motion.div
                    key={`label-${viewMode}-${activePhase}`}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                    style={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: isMobile ? '0.55em' : '0.65em',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      fontFamily: 'monospace',
                      marginTop: '2px',
                      textAlign: 'center',
                    }}
                  >
                    {viewMode === 'distribution'
                      ? 'TOTAL'
                      : (activePhase === 'phase4' ? 'NO TAX' : 'TAX')}
                  </motion.div>
                </div>
              </div>

              {tokenomicsData.map((item, index) => {
                // Calculate position based on pie segment angle
                // Pie starts at 12 o'clock (270°) and goes clockwise
                const totalPercentage = tokenomicsData.reduce((sum, d) => sum + d.percentage, 0);
                const previousPercentage = tokenomicsData.slice(0, index).reduce((sum, d) => sum + d.percentage, 0);
                const segmentCenter = previousPercentage + (item.percentage / 2);

                // Convert percentage to angle (starting at top, going clockwise)
                // 0% = top (270° or -90°), 25% = right (0°), 50% = bottom (90°), 75% = left (180°)
                const angleInDegrees = (segmentCenter / totalPercentage) * 360 - 90;
                const angleInRadians = (angleInDegrees * Math.PI) / 180;

                // Calculate position on a circle around the chart
                // Use percentage of container size for positioning
                const radius = 58; // percentage from center
                const centerX = 50;
                const centerY = 50;
                const x = centerX + radius * Math.cos(angleInRadians);
                const y = centerY + radius * Math.sin(angleInRadians);

                // Determine if label should be on left or right side
                const isRightSide = x > 50;

                // For Phase 4 in tax mode, show image instead of label
                if (viewMode === 'tax' && activePhase === 'phase4') {
                  return (
                    <motion.div
                      key={`${activePhase}-image`}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.2 }}
                      style={{
                        position: 'absolute',
                        bottom: '-6.5rem',
                        left: '-1rem',
                        transform: 'translateX(-50%)',
                      }}
                    >
                      <img
                        src="/images/muryTokenomics.webp"
                        alt="Zero Tax Mode"
                        style={{
                          width: '20rem',
                          height: 'auto',
                          filter: 'drop-shadow(0 0 15px rgba(255, 255, 255, 0.3))',
                        }}
                      />
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={`${viewMode}-${activePhase}-${item.id}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.15 * index }}
                    style={{
                      position: 'absolute',
                      top: `${y}%`,
                      left: isRightSide ? 'auto' : `${x - 15}%`,
                      right: isRightSide ? `${100 - x - 15}%` : 'auto',
                      transform: 'translateY(-50%)',
                      padding: '10px 15px',
                      background: 'rgba(0, 0, 0, 0.9)',
                      borderRadius: '8px',
                      border: `1px solid ${item.color}`,
                      backdropFilter: 'blur(10px)',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      boxShadow: `0 0 20px ${item.color}40`,
                    }}
                    whileHover={{
                      scale: 1.05,
                      boxShadow: `0 0 30px ${item.color}60`,
                    }}
                    onClick={() => setActiveCard(activeCard === item.id ? null : item.id)}
                  >
                    <div style={{
                      fontSize: '18px',
                      fontWeight: 'bold',
                      color: item.color,
                      marginBottom: '4px',
                      fontFamily: 'monospace'
                    }}>
                      {`${item.percentage}%`}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: 'rgba(255,255,255,0.9)',
                      whiteSpace: 'nowrap',
                      fontFamily: 'monospace',
                      letterSpacing: '1px'
                    }}>
                      {item.title}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: item.color,
                      marginTop: '2px',
                      fontFamily: 'monospace'
                    }}>
                      {item.amount}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {activeCard && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'rgba(10, 15, 25, 0.95)',
                border: `1px solid ${tokenomicsData.find(d => d.id === activeCard)?.color}`,
                borderRadius: '10px',
                padding: '20px',
                marginBottom: '30px',
                boxShadow: `0 0 30px ${tokenomicsData.find(d => d.id === activeCard)?.color}40`,
              }}
            >
              {(() => {
                const card = tokenomicsData.find(d => d.id === activeCard);
                return (
                  <>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '15px'
                    }}>
                      <h4 style={{
                        color: card.color,
                        fontSize: '16px',
                        fontFamily: 'Blackletter, serif !important',
                        margin: 0
                      }}>
                        {card.title}
                      </h4>
                      <span style={{
                        color: '#f55',
                        fontSize: '12px',
                        fontFamily: 'monospace'
                      }}>
                        SEC: {card.securityLevel}
                      </span>
                    </div>
                    <p style={{
                      color: 'rgba(255, 255, 255, 0.8)',
                      fontSize: '12px',
                      marginBottom: '15px',
                      fontFamily: 'monospace',
                      lineHeight: '1.5'
                    }}>
                      {card.description}
                    </p>
                    <div style={{
                      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                      paddingTop: '15px'
                    }}>
                      {card.details.map((detail, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '8px'
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: card.color,
                            flexShrink: 0
                          }} />
                          <span style={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            fontSize: '11px',
                            fontFamily: 'monospace'
                          }}>
                            {detail}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: '15px',
                      paddingTop: '15px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <span style={{
                        color: '#0fa',
                        fontSize: '11px',
                        fontFamily: 'monospace'
                      }}>
                        ALLOCATION: {card.amount}
                      </span>
                      <span style={{
                        color: card.status === 'LOCKED' ? '#f55' : '#0fa',
                        fontSize: '11px',
                        fontFamily: 'monospace'
                      }}>
                        STATUS: {card.status}
                      </span>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          )}
        </div>

        <div>
          <h3 style={{
            fontSize: isMobile ? '14px' : '16px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #33ff00 0%, #00ff00 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '15px',
            fontFamily: 'Fjalla One !important',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            textAlign: 'center',
            filter: 'drop-shadow(0 0 10px rgba(0, 255, 0, 0.5))',
          }}>
            :: TAX PROTOCOLS ::
          </h3>

          {/* Phase Toggle Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '20px',
            flexWrap: 'wrap',
          }}>
            {['phase1', 'phase2', 'phase3', 'phase4'].map((phase) => {
              const isActive = activePhase === phase;
              const phaseColors = {
                phase1: { bg: 'rgba(255, 215, 0, 0.2)', border: '#ffd700', text: '#ffd700' },
                phase2: { bg: 'rgba(0, 255, 170, 0.2)', border: '#0fa', text: '#0fa' },
                phase3: { bg: 'rgba(0, 255, 0, 0.2)', border: '#00ff00', text: '#00ff00' },
                phase4: { bg: 'rgba(255, 255, 255, 0.15)', border: '#fff', text: '#fff' },
              };
              const colors = phaseColors[phase];
              return (
                <button
                  key={phase}
                  onClick={() => setActivePhase(phase)}
                  style={{
                    padding: '8px 14px',
                    background: isActive ? colors.bg : 'rgba(0, 0, 0, 0.6)',
                    border: isActive
                      ? `1px solid ${colors.border}`
                      : '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    color: isActive ? colors.text : 'rgba(255, 255, 255, 0.6)',
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    letterSpacing: '1px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: isActive ? `0 0 10px ${colors.border}40` : 'none',
                  }}
                >
                  {phase.toUpperCase().replace('PHASE', 'PHASE ')}
                </button>
              );
            })}
          </div>

          {taxProtocols.map((tax, index) => (
            <motion.div
              key={tax.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.2 }}
              style={{
                background: 'rgba(10, 15, 25, 0.85)',
                border: '1px solid rgba(0, 255, 170, 0.5)',
                borderRadius: '10px',
                padding: '25px',
                marginBottom: '20px',
                position: 'relative',
                overflow: 'hidden',
                maxWidth: '500px',
                margin: '0 auto 20px auto',
              }}
            >
              <div style={{
                position: 'absolute',
                top: '-5px',
                left: '-5px',
                right: '-5px',
                bottom: '-5px',
                borderRadius: '15px',
                background: 'radial-gradient(circle, rgba(0, 255, 170, 0.3) 0%, transparent 70%)',
                filter: 'blur(15px)',
                opacity: 0.5,
                zIndex: -1,
              }} />
              
              {/* Phase Label Pill */}
              {(() => {
                const pillColors = {
                  phase1: { bg: 'rgba(255, 215, 0, 0.15)', border: 'rgba(255, 215, 0, 0.4)', text: '#ffd700' },
                  phase2: { bg: 'rgba(0, 255, 170, 0.15)', border: 'rgba(0, 255, 170, 0.4)', text: '#0fa' },
                  phase3: { bg: 'rgba(0, 255, 0, 0.15)', border: 'rgba(0, 255, 0, 0.4)', text: '#00ff00' },
                  phase4: { bg: 'rgba(255, 255, 255, 0.1)', border: 'rgba(255, 255, 255, 0.4)', text: '#fff' },
                };
                const colors = pillColors[activePhase] || pillColors.phase1;
                return (
                  <div style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '3px',
                    marginBottom: '12px',
                  }}>
                    <span style={{
                      color: colors.text,
                      fontSize: '10px',
                      fontFamily: 'monospace',
                      letterSpacing: '1px',
                    }}>
                      {tax.phaseLabel}
                    </span>
                  </div>
                );
              })()}

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px'
              }}>
                <div>
                  <div style={{
                    color: '#0fa',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    marginBottom: '4px',
                    opacity: 0.8
                  }}>
                    {tax.id}
                  </div>
                  <h4 style={{
                    color: '#fff',
                    fontSize: '18px',
                    fontFamily: 'Fjalla One !important',
                    margin: 0,
                    letterSpacing: '1px'
                  }}>
                    {tax.label}
                  </h4>
                </div>
                <div style={{
                  fontSize: '36px',
                  fontWeight: 'bold',
                  color: '#00ff00',
                  fontFamily: 'monospace',
                  textShadow: '0 0 10px rgba(0, 255, 0, 0.5)',
                }}>
                  {tax.value}
                </div>
              </div>

              {/* Phase Status */}
              {(() => {
                const statusColors = {
                  phase1: 'rgba(255, 215, 0, 0.85)',
                  phase2: 'rgba(0, 255, 170, 0.85)',
                  phase3: 'rgba(0, 255, 0, 0.85)',
                  phase4: 'rgba(255, 255, 255, 0.9)',
                };
                return (
                  <div style={{
                    color: statusColors[activePhase] || statusColors.phase1,
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    marginBottom: '12px',
                    letterSpacing: '1px',
                  }}>
                    STATUS: {tax.phaseStatus}
                  </div>
                );
              })()}
              
              <p style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '11px',
                marginBottom: '15px',
                fontFamily: 'monospace'
              }}>
                {tax.description}
              </p>
              
              <div style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                paddingTop: '15px'
              }}>
                {tax.breakdown.map((item, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px',
                    ...(item.always && {
                      marginTop: '12px',
                      paddingTop: '10px',
                      borderTop: '1px dashed rgba(0, 255, 170, 0.3)',
                    }),
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: item.color,
                        boxShadow: `0 0 10px ${item.color}`,
                      }} />
                      <span style={{
                        color: item.always ? '#0fa' : 'rgba(255, 255, 255, 0.8)',
                        fontSize: '12px',
                        fontFamily: 'monospace'
                      }}>
                        {item.label}
                        {item.always && (
                          <span style={{
                            marginLeft: '6px',
                            fontSize: '9px',
                            color: 'rgba(0, 255, 170, 0.7)',
                            textTransform: 'uppercase',
                          }}>
                            (always)
                          </span>
                        )}
                      </span>
                    </div>
                    <span style={{
                      color: item.color,
                      fontSize: '14px',
                      fontWeight: 'bold',
                      fontFamily: 'monospace'
                    }}>
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Phase Note */}
              {tax.phaseNote && (
                <div style={{
                  marginTop: '14px',
                  paddingTop: '12px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.65)',
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  lineHeight: '1.5',
                  fontStyle: 'italic',
                }}>
                  <span style={{ color: '#0fa', fontStyle: 'normal' }}>NOTE:</span> {tax.phaseNote}
                </div>
              )}
            </motion.div>
          ))}

        </div>
      </div>

      {/* TL;DR Section */}
      <div style={{
        marginTop: '3rem',
        padding: isMobile ? '20px' : '25px 30px',
        background: 'rgba(5, 10, 15, 0.95)',
        border: '1px solid rgba(0, 255, 170, 0.5)',
        borderRadius: '8px',
        boxShadow: '0 0 25px rgba(0, 255, 170, 0.15)',
      }}>
        <h3 style={{
          fontSize: isMobile ? '16px' : '18px',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #ffd700 0%, #00ff00 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '20px',
          fontFamily: 'Fjalla One, sans-serif',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          textAlign: 'center',
          filter: 'drop-shadow(0 0 10px rgba(255, 215, 0, 0.4))',
        }}>
          RL80 Tokenomics — TL;DR
        </h3>

        <div style={{
          display: 'grid',
          gap: '12px',
        }}>
          {[
            { icon: '🔒', text: 'Fixed supply — 80B forever', color: '#ffd700' },
            { icon: '✓', text: '0% tax on normal transfers', color: '#00ff00' },
            { icon: '📊', text: '~4% trading fee only on DEX buys/sells', color: '#0fa' },
            { icon: '🔄', text: 'Fees → swapped to ETH → split to:', color: '#0fa', indent: false },
            { text: 'Treasury (liquidity)', color: 'rgba(255, 255, 255, 0.7)', subItem: true },
            { text: 'Stakers (rewards)', color: 'rgba(255, 255, 255, 0.7)', subItem: true },
            { text: 'Marketing', color: 'rgba(255, 255, 255, 0.7)', subItem: true },
            { icon: '💎', text: 'Stake RL80 → earn ETH', color: '#00ff00' },
            { icon: '🛡️', text: 'No minting • No wallet freezes • No hidden taxes', color: '#ffd700' },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                paddingLeft: item.subItem ? '32px' : '0',
              }}
            >
              {item.icon && (
                <span style={{
                  fontSize: '14px',
                  width: '22px',
                  textAlign: 'center',
                }}>
                  {item.icon}
                </span>
              )}
              {item.subItem && (
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: item.color,
                  flexShrink: 0,
                }} />
              )}
              <span style={{
                color: item.color,
                fontSize: isMobile ? '12px' : '13px',
                fontFamily: 'monospace',
                letterSpacing: '0.5px',
              }}>
                {item.text}
              </span>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(0, 255, 170, 0.2)',
          textAlign: 'center',
        }}>
          <span style={{
            color: '#0fa',
            fontSize: isMobile ? '11px' : '12px',
            fontFamily: 'monospace',
            letterSpacing: '1px',
            fontStyle: 'italic',
          }}>
            Simple, sustainable, on-chain.
          </span>
        </div>
      </div>

      {/* Verification Links */}
      <div style={{
        marginTop: '2rem',
        padding: '20px',
        background: 'rgba(5, 10, 15, 0.9)',
        border: '1px solid rgba(0, 255, 170, 0.3)',
        borderRadius: '5px',
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '15px',
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: '11px',
          fontFamily: 'monospace',
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}>
          Verify Contract
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '20px',
          flexWrap: 'wrap',
        }}>
          <a
            href={`https://basescan.org/token/${CONTRACT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 15px',
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              transition: 'all 0.3s ease',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 170, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(0, 255, 170, 0.4)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <img
              src="/images/baseScan.svg"
              alt="BaseScan"
              style={{
                height: '24px',
                width: 'auto',
                filter: 'brightness(0.9)',
              }}
            />
          </a>
          <a
            href="https://dexscreener.com/base/0x40d827acdbefd8ef46953e2b1ac87b8697b82203"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 15px',
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              transition: 'all 0.3s ease',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 170, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(0, 255, 170, 0.4)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <img
              src="/images/dexscreener.webp"
              alt="DexScreener"
              style={{
                height: '24px',
                width: 'auto',
                filter: 'brightness(0.9)',
              }}
            />
          </a>
          <a
            href="https://tokensniffer.com/token/base/0x30d01555d88c76500a82754a1d53cac082a6cb75"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 15px',
              background: 'rgba(0, 0, 0, 0.4)',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              transition: 'all 0.3s ease',
              textDecoration: 'none',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 170, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(0, 255, 170, 0.4)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 0, 0, 0.4)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <img
              src="/images/tokensniffer.webp"
              alt="TokenSniffer"
              style={{
                height: '24px',
                width: 'auto',
                filter: 'brightness(0.9)',
              }}
            />
          </a>

        </div>

      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
      `}</style>
    </div>
  );
}