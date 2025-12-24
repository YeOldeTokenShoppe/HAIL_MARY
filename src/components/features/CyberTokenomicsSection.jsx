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

export default function CyberTokenomicsSection({ isMobile }) {
  const [activeCard, setActiveCard] = useState(null);
  const chartRef = useRef(null);
  const isInView = useInView(chartRef, { once: true, threshold: 0.3 });
  const [chartData, setChartData] = useState(null);

  const tokenomicsData = [
    {
      id: 'DIST001',
      title: 'LIQUIDITY MATRIX',
      percentage: 85,
      amount: '68B',
      color: '#00ff00',
      description: 'Quantum liquidity pools maintaining market stability through algorithmic balancing',
      details: [
        'Auto-rebalancing protocols',
        'Impermanent loss protection',
        'Multi-chain bridge reserves',
        'Emergency stability fund'
      ],
      status: 'LOCKED',
      securityLevel: 'MAXIMUM',
    },
    {
      id: 'DIST002',
      title: 'TREASURY VAULT',
      percentage: 10,
      amount: '8B',
      color: '#ffd700',
      description: 'Strategic reserves for ecosystem development and emergency protocols',
      details: [
        'Development funding',
        'Marketing campaigns',
        'Partnership acquisitions',
        'Community rewards'
      ],
      status: 'SECURED',
      securityLevel: 'HIGH',
    },
    {
      id: 'DIST003',
      title: 'MARKETING NEXUS',
      percentage: 5,
      amount: '4B',
      color: '#d946ef',
      description: 'Growth acceleration and exchange listing preparation matrix',
      details: [
        'CEX listing fees',
        'Global marketing ops',
        'Influencer partnerships',
        'Community events'
      ],
      status: 'ACTIVE',
      securityLevel: 'STANDARD',
    }
  ];

  const taxProtocols = [
    {
      id: 'TAX001',
      label: 'BUY / SELL TAX',
      value: '4%',
      description: 'Unified tax protocol for buy/sell transactions (wallet transfers exempt)',
      breakdown: [
        { label: 'Staking Rewards', value: '2%', color: '#00ff00' },
        { label: 'Auto-Liquidity', value: '1.5%', color: '#ffd700' },
        { label: 'Marketing', value: '0.5%', color: '#d946ef' }
      ]
    }
  ];

  // Set up Chart.js data when component mounts or comes into view
  useEffect(() => {
    if (isInView && !chartData) {
      setChartData({
        labels: tokenomicsData.map(item => item.title),
        datasets: [
          {
            data: tokenomicsData.map(item => item.percentage),
            backgroundColor: tokenomicsData.map(item => item.color),
            borderColor: tokenomicsData.map(item => item.color),
            borderWidth: 2,
            hoverBorderWidth: 4,
            // No cutout for full pie chart
          },
        ],
      });
    }
  }, [isInView, chartData]);

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
        padding: '10px 15px',
        marginBottom: '30px',
        boxShadow: '0 0 15px rgba(0, 255, 170, 0.7)',
      }}>
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
          }}>
            SYSTEM://TOKENOMICS_PROTOCOL
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
              backgroundColor: '#00ff00',
              animation: 'pulse 1.5s infinite',
            }} />
            <span style={{ color: '#00ff00', fontFamily: 'monospace', fontSize: isMobile ? '0.7rem' : '0.9rem' }}>
              IMMUTABLE CONTRACTS
            </span>
          </div>
        </div>
        <div style={{
          height: '1px',
          background: 'linear-gradient(to right, transparent, rgba(0, 255, 170, 0.7), transparent)',
          margin: '8px 0',
        }} />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: isMobile ? '40px' : '50px',
        alignItems: 'start'
      }}>
        <div>
          <h3 style={{
            fontSize: isMobile ? '14px' : '16px',
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #66ff00 0%, #00ff00 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '25px',
            fontFamily: 'Blackletter, serif !important',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            textAlign: 'center',
            filter: 'drop-shadow(0 0 10px rgba(0, 255, 0, 0.5))',
          }}>
            :: DISTRIBUTION MATRIX ::
          </h3>

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
                  border: '2px solid rgba(0, 255, 170, 0.3)',
                  backdropFilter: 'blur(10px)',
                }}>
                  <motion.div 
                    initial={{ opacity: 0, scale: 0 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 2.5, duration: 0.8 }}
                    style={{
                      fontSize: isMobile ? '1.8em' : '2.2em',
                      fontWeight: '800',
                      color: '#FFD700',
                      lineHeight: '1',
                      textShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
                      fontFamily: 'monospace',
                    }}
                  >
                    80B
                  </motion.div>
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 2.7, duration: 0.6 }}
                    style={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: isMobile ? '0.6em' : '0.7em',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      fontFamily: 'monospace',
                      marginTop: '2px',
                      textAlign: 'center',
                    }}
                  >
                    TOTAL
                  </motion.div>
                </div>
              </div>

              {tokenomicsData.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 * index }}
                  style={{
                    position: 'absolute',
                    top: index === 0 ? '10%' : index === 1 ? '45%' : '80%',
                    [index === 0 ? 'right' : index === 1 ? 'left' : 'right']: '-30px',
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
                    {item.percentage}%
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
              ))}
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
            marginBottom: '25px',
         fontFamily: 'Blackletter, serif !important',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            textAlign: 'center',
            filter: 'drop-shadow(0 0 10px rgba(0, 255, 0, 0.5))',
          }}>
            :: TAX PROTOCOLS ::
          </h3>

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
              
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '15px'
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
                    fontFamily: 'Blackletter, serif !important',
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
                    marginBottom: '10px'
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
                        color: 'rgba(255, 255, 255, 0.8)',
                        fontSize: '12px',
                        fontFamily: 'monospace'
                      }}>
                        {item.label}
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
            </motion.div>
          ))}

        </div>
      </div>

      {/* <div style={{
        background: 'rgba(5, 10, 15, 0.9)',
        border: '1px solid rgba(0, 255, 170, 0.7)',
        borderRadius: '5px',
        padding: '10px 15px',
        marginTop: '30px',
        boxShadow: '0 0 15px rgba(0, 255, 170, 0.7)',
      }}>
        <div style={{
          height: '1px',
          background: 'linear-gradient(to right, transparent, rgba(0, 255, 170, 0.7), transparent)',
          marginBottom: '8px',
        }} />
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
          }}>
            CLICK DISTRIBUTIONS TO EXPAND
          </div>
          <div style={{
            color: '#0f0',
            fontSize: '0.9rem',
            fontFamily: 'monospace',
            animation: 'pulse 2s infinite',
          }}>
            TOKENOMICS: IMMUTABLE
          </div>
        </div>
      </div> */}

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